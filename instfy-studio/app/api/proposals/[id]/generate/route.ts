import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { buildProposalSpec } from '@/lib/proposal-spec';
import { countProposalPages } from '@/components/proposal-doc';
import { createProposalVersion } from '@/lib/documents';
import { artifactPath, fileSize } from '@/lib/artifacts';
import { enqueue, runJob } from '@/lib/jobs';
import { renderProposalPdf } from '@/lib/pdf';
import { blockingFlags } from '@/lib/pricing';
import { pdfEngine } from '@/lib/pdf-engine';

const body = z.object({
  themeId: z.enum(['instfy-light', 'instfy-dark', 'instfy-client']).default('instfy-light'),
  allowDraft: z.boolean().default(true),
  screenshots: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });

  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null },
    include: { items: true, project: { include: { client: true } } },
  });
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
  if (proposal.items.length === 0) {
    return NextResponse.json({ error: 'A proposta não possui itens. Selecione serviços no catálogo.' }, { status: 400 });
  }

  const { spec, pricing } = await buildProposalSpec(id);
  const blocking = blockingFlags(pricing.flags);
  if (blocking.length > 0 && !parsed.data.allowDraft) {
    return NextResponse.json({ error: `Pendências bloqueiam a emissão: ${blocking.map((f) => f.message).join(' ')}` }, { status: 409 });
  }

  const pageCount = countProposalPages(spec);
  const { document, documentVersion } = await createProposalVersion({
    orgId: org.id,
    projectId: proposal.projectId,
    proposalId: id,
    title: proposal.title,
    themeId: parsed.data.themeId,
    pageCount,
    spec: {
      ...spec,
      // The numbers in the document are frozen at generation time.
      totalsSnapshot: pricing.totals,
      engineVersion: pricing.computedAtVersion,
      generatedAt: new Date().toISOString(),
      blockingAtGeneration: blocking.map((f) => f.message),
    },
  });

  if (pdfEngine() === 'browser') {
    await prisma.document.update({ where: { id: document.id }, data: { status: 'ready' } });
    await audit(org.id, 'generate_proposal', 'DocumentVersion', documentVersion.id, { pages: pageCount, engine: 'browser' });
    return NextResponse.json({
      jobId: null,
      engine: 'browser',
      documentId: document.id,
      documentVersionId: documentVersion.id,
      version: documentVersion.version,
      pages: pageCount,
      printUrl: `/print/proposal/${documentVersion.id}`,
      blocking: blocking.map((f) => f.message),
    });
  }

  const filePath = artifactPath(
    proposal.project.client.name,
    `proposta-comercial-v${proposal.version}-doc${documentVersion.version}.pdf`,
  );

  const job = await enqueue('proposal_pdf', { documentVersionId: documentVersion.id, filePath }, {
    projectId: proposal.projectId,
    documentId: document.id,
  });

  void runJob(job.id, async () => {
    const result = await renderProposalPdf(documentVersion.id, filePath, {
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

  await audit(org.id, 'generate_proposal', 'DocumentVersion', documentVersion.id, { pages: pageCount });

  return NextResponse.json({
    jobId: job.id,
    engine: 'server',
    documentId: document.id,
    documentVersionId: documentVersion.id,
    version: documentVersion.version,
    pages: pageCount,
    blocking: blocking.map((f) => f.message),
  });
}
