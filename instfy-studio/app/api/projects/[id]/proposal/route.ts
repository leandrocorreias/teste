import { NextResponse } from 'next/server';
import { prisma, getOrg, audit } from '@/lib/db';
import { DEFAULT_CONDITIONS } from '@/lib/proposal-spec';

/** Creates the next proposal version for a project. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { client: { include: { contacts: true } } },
  });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const last = await prisma.proposal.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 15);

  const proposal = await prisma.proposal.create({
    data: {
      projectId: id,
      version: (last?.version ?? 0) + 1,
      title: `Proposta comercial · ${project.client.name}`,
      status: 'draft',
      termMonths: 12,
      issuedAt: new Date(),
      validUntil,
      preparedForJson: JSON.stringify(project.client.contacts.map((c) => `${c.name}${c.role ? ` · ${c.role}` : ''}`)),
      conditionsJson: JSON.stringify(DEFAULT_CONDITIONS),
      narrativeJson: JSON.stringify({ openingParagraphs: [], valuePillars: [] }),
    },
  });

  // Carry the previous version's items forward so a revision starts from the
  // approved mix rather than an empty sheet.
  if (last) {
    const previousItems = await prisma.proposalItem.findMany({ where: { proposalId: last.id }, orderBy: { orderIndex: 'asc' } });
    for (const item of previousItems) {
      const { id: _ignored, proposalId: _p, createdAt: _c, updatedAt: _u, priceSnapshot: _s, ...rest } = item;
      await prisma.proposalItem.create({ data: { ...rest, proposalId: proposal.id } });
    }
  }

  await prisma.project.update({ where: { id }, data: { status: 'proposal' } });
  await audit(org.id, 'create', 'Proposal', proposal.id, { version: proposal.version });
  return NextResponse.json({ proposal }, { status: 201 });
}
