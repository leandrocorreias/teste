import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';

const patchClient = z.object({
  name: z.string().min(2).max(120).optional(),
  legalName: z.string().max(160).nullable().optional(),
  taxId: z.string().max(40).nullable().optional(),
  sector: z.string().max(40).optional(),
  website: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = patchClient.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const existing = await prisma.client.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  const client = await prisma.client.update({ where: { id }, data: parsed.data });
  await audit(org.id, 'update', 'Client', id, parsed.data);
  return NextResponse.json({ client });
}

/** Soft delete: the row is retained so historical documents keep resolving. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const existing = await prisma.client.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.project.updateMany({ where: { clientId: id, deletedAt: null }, data: { deletedAt: new Date() } });
  await audit(org.id, 'soft_delete', 'Client', id, { name: existing.name });
  return NextResponse.json({ ok: true });
}
