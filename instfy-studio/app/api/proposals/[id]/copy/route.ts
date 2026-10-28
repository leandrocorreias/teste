import { NextResponse } from 'next/server';
import { prisma, getOrg, audit } from '@/lib/db';
import { runProposalCopy } from '@/lib/ai/orchestrator';
import { resolveProvider } from '@/lib/ai/provider';

/** Drafts the contextual proposal prose. Never touches a number. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null },
    include: { items: { orderBy: { orderIndex: 'asc' } }, project: { include: { client: true } } },
  });
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
  if (proposal.items.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos um serviço antes de redigir o texto da proposta.' }, { status: 400 });
  }

  const approvedFindings = await prisma.finding.findMany({
    where: { projectId: proposal.projectId, approved: true },
    orderBy: { orderIndex: 'asc' },
    take: 12,
  });
  const context = approvedFindings.map((f) => `[${f.evidenceType}] ${f.title}: ${f.body}`).join('\n');

  try {
    const { output, meta } = await runProposalCopy(
      proposal.projectId,
      proposal.project.client.name,
      proposal.items.map((i) => i.label),
      context,
    );
    const provider = resolveProvider();
    await prisma.proposal.update({
      where: { id },
      data: { narrativeJson: JSON.stringify(output), aiCopyStatus: provider.demoMode ? 'demo' : 'generated' },
    });
    await audit(org.id, 'generate_proposal_copy', 'Proposal', id, { demoMode: meta.demoMode, notes: meta.notes.length });
    return NextResponse.json({ narrative: output, meta });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
