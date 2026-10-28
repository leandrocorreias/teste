import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { runLayoutPlan } from '@/lib/ai/orchestrator';
import { narrativeOutput } from '@/lib/design/schema';
import { createPresentationVersion } from '@/lib/documents';
import { artifactPath, fileSize } from '@/lib/artifacts';
import { enqueue, runJob } from '@/lib/jobs';
import { renderPresentationPdf } from '@/lib/pdf';
import { resolveProvider } from '@/lib/ai/provider';
import { checkTheme } from '@/lib/design/validate';
import { THEMES } from '@/lib/design/tokens';

const body = z.object({
  themeId: z.enum(['instfy-light', 'instfy-dark', 'instfy-client']).default('instfy-light'),
  screenshots: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { client: { include: { contacts: true } } },
  });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const narrativeRow = await prisma.narrative.findFirst({
    where: { projectId: id, status: 'approved' },
    orderBy: { version: 'desc' },
  });
  if (!narrativeRow) {
    return NextResponse.json(
      { error: 'Nenhuma narrativa aprovada. Edite e aprove a narrativa na aba de análise antes de gerar a apresentação.' },
      { status: 400 },
    );
  }

  const narrative = narrativeOutput.safeParse(JSON.parse(narrativeRow.bodyJson));
  if (!narrative.success) {
    return NextResponse.json({ error: 'A narrativa armazenada está corrompida e não passou na validação.' }, { status: 500 });
  }

  const provider = resolveProvider();
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());

  const { pages, warnings, meta } = await runLayoutPlan(id, narrative.data, {
    clientName: project.client.name,
    preparedFor: project.client.contacts.map((c) => `${c.name}${c.role ? ` · ${c.role}` : ''}`),
    dateLabel,
  });

  const themeWarnings = checkTheme(THEMES[parsed.data.themeId]);

  const { document, documentVersion } = await createPresentationVersion({
    orgId: org.id,
    projectId: id,
    title: narrative.data.title,
    themeId: parsed.data.themeId,
    pages,
    warnings: [...warnings, ...themeWarnings],
    spec: {
      title: narrative.data.title,
      subtitle: narrative.data.subtitle,
      clientName: project.client.name,
      themeId: parsed.data.themeId,
      narrativeVersion: narrativeRow.version,
      demoMode: provider.demoMode,
      researchPerformed: false,
      generatedAt: new Date().toISOString(),
    },
  });

  const filePath = artifactPath(
    project.client.name,
    `apresentacao-${project.name}-v${documentVersion.version}.pdf`,
  );

  const job = await enqueue('presentation_pdf', { documentVersionId: documentVersion.id, filePath }, {
    projectId: id,
    documentId: document.id,
  });

  // Background: the UI polls /api/jobs/[id] and never blocks on Chromium.
  void runJob(job.id, async () => {
    const result = await renderPresentationPdf(documentVersion.id, filePath, {
      screenshotPages: parsed.data.screenshots ? 4 : 0,
    });
    const bytes = (await fileSize(result.filePath)) ?? result.bytes;
    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: { filePath: result.filePath, fileBytes: bytes, pageCount: result.pageCount },
    });
    if (result.overflowPages.length > 0) {
      // Recorded rather than hidden: the operator sees which page spilled.
      await prisma.generationJob.updateMany({
        where: { documentId: document.id, status: 'running' },
        data: {
          error: `Transbordo de conteúdo em ${result.overflowPages.length} página(s): ${result.overflowPages
            .map((p) => `página ${p.index + 1} excede o papel em ${p.spillsBy}px`)
            .join('; ')}`,
        },
      });
    }
    await prisma.document.update({ where: { id: document.id }, data: { status: 'ready' } });
    return {
      filePath: result.filePath,
      bytes,
      pageCount: result.pageCount,
      logicalPageCount: result.logicalPageCount,
      overflowPages: result.overflowPages,
      screenshots: result.screenshots,
    };
  }).catch(async () => {
    await prisma.document.update({ where: { id: document.id }, data: { status: 'failed' } }).catch(() => {});
  });

  await audit(org.id, 'generate_presentation', 'DocumentVersion', documentVersion.id, {
    pages: pages.length,
    theme: parsed.data.themeId,
  });

  return NextResponse.json({
    jobId: job.id,
    documentId: document.id,
    documentVersionId: documentVersion.id,
    version: documentVersion.version,
    pages: pages.length,
    warnings: [...warnings, ...themeWarnings],
    meta,
  });
}
