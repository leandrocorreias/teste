import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { SECTORS } from '@/lib/questionnaire';

const createClient = z.object({
  name: z.string().min(2, 'Informe o nome do cliente').max(120),
  legalName: z.string().max(160).optional().or(z.literal('')),
  taxId: z.string().max(40).optional().or(z.literal('')),
  sector: z.enum(SECTORS.map((s) => s.id) as [string, ...string[]]),
  website: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  state: z.string().max(40).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        role: z.string().max(80).optional().or(z.literal('')),
        email: z.string().max(160).optional().or(z.literal('')),
        phone: z.string().max(40).optional().or(z.literal('')),
      }),
    )
    .max(6)
    .default([]),
});

export async function GET() {
  const org = await getOrg();
  const clients = await prisma.client.findMany({
    where: { orgId: org.id, deletedAt: null },
    include: { contacts: true, projects: { where: { deletedAt: null } } },
    orderBy: { updatedAt: 'desc' },
  });
  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const org = await getOrg();
  const body = await request.json().catch(() => null);
  const parsed = createClient.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const { contacts, ...data } = parsed.data;
  const client = await prisma.client.create({
    data: {
      orgId: org.id,
      name: data.name,
      legalName: data.legalName || null,
      taxId: data.taxId || null,
      sector: data.sector,
      website: data.website || null,
      city: data.city || null,
      state: data.state || null,
      notes: data.notes || null,
      contacts: {
        create: contacts
          .filter((c) => c.name.trim() !== '')
          .map((c, i) => ({
            name: c.name,
            role: c.role || null,
            email: c.email || null,
            phone: c.phone || null,
            isPrimary: i === 0,
          })),
      },
    },
    include: { contacts: true },
  });
  await audit(org.id, 'create', 'Client', client.id, { name: client.name });
  return NextResponse.json({ client }, { status: 201 });
}
