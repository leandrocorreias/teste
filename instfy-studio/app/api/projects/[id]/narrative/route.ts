import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, getOrg, audit } from '@/lib/db';
import { runNarrative } from '@/lib/ai/orchestrator';
import { narrativeOutput } from '@/lib/design/schema';

/** Generates a narrative draft from the APPROVED findings. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const approved = await prisma.finding.findMany({
    where: { projectId: id, approved: true },
    orderBy: { orderIndex: 'asc' },
  });
  if (approved.length === 0) {
    return NextResponse.json(
      { error: 'Aprove ao menos um achado antes de gerar a narrativa. A IA só redige sobre conteúdo aprovado.' },
      { status: 400 },
    );
  }

  try {
    const { output, meta } = await runNarrative(id, approved);
    const last = await prisma.narrative.findFirst({ where: { projectId: id }, orderBy: { version: 'desc' } });
    const narrative = await prisma.narrative.create({
      data: {
        projectId: id,
        version: (last?.version ?? 0) + 1,
        title: output.title,
        subtitle: output.subtitle ?? null,
        bodyJson: JSON.stringify(output),
        status: 'draft',
      },
    });
    await audit(org.id, 'generate_narrative', 'Narrative', narrative.id, { version: narrative.version, demoMode: meta.demoMode });
    return NextResponse.json({ narrative, meta });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}

const patchNarrative = z.object({
  narrativeId: z.string().min(1),
  body: z.unknown().optional(),
  approve: z.boolean().optional(),
});

/** Saves human edits and/or records human approval. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const parsed = patchNarrative.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

  const narrative = await prisma.narrative.findFirst({ where: { id: parsed.data.narrativeId, projectId: id } });
  if (!narrative) return NextResponse.json({ error: 'Narrativa não encontrada' }, { status: 404 });

  const data: { bodyJson?: string; title?: string; subtitle?: string | null; status?: string; approvedAt?: Date } = {};

  if (parsed.data.body !== undefined) {
    const validated = narrativeOutput.safeParse(parsed.data.body);
    if (!validated.success) {
      return NextResponse.json(
        { error: `Narrativa inválida: ${validated.error.issues[0]?.path.join('.')} — ${validated.error.issues[0]?.message}` },
        { status: 400 },
      );
    }
    data.bodyJson = JSON.stringify(validated.data);
    data.title = validated.data.title;
    data.subtitle = validated.data.subtitle ?? null;
  }

  if (parsed.data.approve) {
    data.status = 'approved';
    data.approvedAt = new Date();
  }

  const updated = await prisma.narrative.update({ where: { id: narrative.id }, data });

  if (parsed.data.approve) {
    await prisma.approval.create({
      data: { projectId: id, subject: `Narrativa v${narrative.version}`, decision: 'approved', note: 'Aprovada pelo estrategista no Studio.' },
    });
  }
  await audit(org.id, parsed.data.approve ? 'approve_narrative' : 'edit_narrative', 'Narrative', narrative.id, {});
  return NextResponse.json({ narrative: updated });
}
