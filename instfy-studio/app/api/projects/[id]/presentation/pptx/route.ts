import { NextResponse } from 'next/server';
import { prisma, getOrg, audit } from '@/lib/db';
import { slidePage, type SlidePage } from '@/lib/design/schema';
import type { ThemeId } from '@/lib/design/tokens';
import { artifactPath, fileSize } from '@/lib/artifacts';
import { nextDocumentVersion } from '@/lib/documents';
import { enqueue, runJob } from '@/lib/jobs';
import { renderPresentationPptx } from '@/lib/pptx';

/**
 * Exports the LATEST generated presentation as an editable PPTX.
 *
 * The deck is text-faithful, not a pixel copy of the PDF: PowerPoint cannot
 * reproduce the CSS motifs the renderer uses, so archetypes are mapped to
 * native shapes with the same design tokens.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { client: true },
  });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const document = await prisma.document.findFirst({
    where: { projectId: id, kind: 'presentation', deletedAt: null },
    include: { versions: { where: { format: 'pdf' }, orderBy: { version: 'desc' }, take: 1, include: { pages: { orderBy: { orderIndex: 'asc' } } } } },
  });
  const source = document?.versions[0];
  if (!document || !source || source.pages.length === 0) {
    return NextResponse.json(
      { error: 'Gere a apresentação em PDF primeiro. O PPTX é exportado a partir das páginas já montadas e validadas.' },
      { status: 400 },
    );
  }

  const pages: SlidePage[] = [];
  for (const row of source.pages) {
    const parsed = slidePage.safeParse(JSON.parse(row.contentJson));
    if (parsed.success) pages.push(parsed.data);
  }
  if (pages.length === 0) {
    return NextResponse.json({ error: 'Nenhuma página válida encontrada na versão de origem.' }, { status: 500 });
  }

  const spec = JSON.parse(source.specJson || '{}') as { title?: string; demoMode?: boolean };
  const version = await nextDocumentVersion(document.id, 'pptx');
  const documentVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version,
      format: 'pptx',
      theme: source.theme,
      specJson: JSON.stringify({ ...spec, sourcePdfVersion: source.version, fidelity: 'text-faithful' }),
      pageCount: pages.length,
    },
  });

  const filePath = artifactPath(project.client.name, `apresentacao-${project.name}-v${version}.pptx`);
  const job = await enqueue('presentation_pptx', { documentVersionId: documentVersion.id, filePath }, {
    projectId: id,
    documentId: document.id,
  });

  void runJob(job.id, async () => {
    const result = await renderPresentationPptx(pages, {
      filePath,
      themeId: (source.theme as ThemeId) ?? 'instfy-light',
      clientName: project.client.name,
      title: spec.title ?? document.title,
      demoMode: Boolean(spec.demoMode),
    });
    const bytes = (await fileSize(result.filePath)) ?? result.bytes;
    await prisma.documentVersion.update({
      where: { id: documentVersion.id },
      data: { filePath: result.filePath, fileBytes: bytes, pageCount: result.pageCount },
    });
    return { filePath: result.filePath, bytes, pageCount: result.pageCount };
  }).catch(() => {});

  await audit(org.id, 'generate_pptx', 'DocumentVersion', documentVersion.id, { pages: pages.length });

  return NextResponse.json({ jobId: job.id, documentVersionId: documentVersion.id, version, pages: pages.length });
}
