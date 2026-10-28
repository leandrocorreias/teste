import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { EvidenceType } from '@/lib/design/schema';

const patch = z.object({
  title: z.string().min(1).max(160).optional(),
  body: z.string().min(1).max(2000).optional(),
  evidenceType: EvidenceType.optional(),
  approved: z.boolean().optional(),
  dimension: z.string().max(80).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const finding = await prisma.finding.findUnique({ where: { id } });
  if (!finding) return NextResponse.json({ error: 'Achado não encontrado' }, { status: 404 });

  const touchesContent = parsed.data.title !== undefined || parsed.data.body !== undefined || parsed.data.evidenceType !== undefined;
  const updated = await prisma.finding.update({
    where: { id },
    data: { ...parsed.data, editedByHuman: finding.editedByHuman || touchesContent },
  });
  await audit(org.id, 'update', 'Finding', id, parsed.data);
  return NextResponse.json({ finding: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const finding = await prisma.finding.findUnique({ where: { id } });
  if (!finding) return NextResponse.json({ error: 'Achado não encontrado' }, { status: 404 });
  await prisma.finding.delete({ where: { id } });
  await audit(org.id, 'delete', 'Finding', id, { title: finding.title });
  return NextResponse.json({ ok: true });
}
