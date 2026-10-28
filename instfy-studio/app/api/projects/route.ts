import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { SECTORS } from '@/lib/questionnaire';

const createProject = z.object({
  clientId: z.string().min(1, 'Selecione um cliente'),
  name: z.string().min(3, 'Informe o nome do projeto').max(160),
  sector: z.enum(SECTORS.map((s) => s.id) as [string, ...string[]]).optional(),
  summary: z.string().max(800).optional().or(z.literal('')),
});

export async function POST(request: Request) {
  const org = await getOrg();
  const parsed = createProject.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, orgId: org.id, deletedAt: null },
  });
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      clientId: client.id,
      name: parsed.data.name,
      sector: parsed.data.sector ?? client.sector,
      summary: parsed.data.summary || null,
      status: 'discovery',
    },
  });
  await audit(org.id, 'create', 'Project', project.id, { name: project.name });
  return NextResponse.json({ project }, { status: 201 });
}
