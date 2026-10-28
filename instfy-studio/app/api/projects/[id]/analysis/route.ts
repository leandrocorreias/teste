import { NextResponse } from 'next/server';
import { prisma, getOrg, audit } from '@/lib/db';
import { runAnalysis } from '@/lib/ai/orchestrator';

/** Lists the stored findings for a project. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const findings = await prisma.finding.findMany({ where: { projectId: id }, orderBy: { orderIndex: 'asc' } });
  return NextResponse.json({
    findings: findings.map((f) => ({
      id: f.id,
      dimension: f.dimension,
      title: f.title,
      body: f.body,
      evidenceType: f.evidenceType,
      sourceRefs: JSON.parse(f.sourceRefs || '[]'),
      confidence: f.confidence,
      approved: f.approved,
      editedByHuman: f.editedByHuman,
    })),
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({ where: { id, orgId: org.id, deletedAt: null } });
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

  const submission = await prisma.submission.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
    include: { answers: true },
  });
  if (!submission || submission.answers.length === 0) {
    return NextResponse.json(
      { error: 'Responda ao menos uma pergunta do discovery antes de rodar a análise.' },
      { status: 400 },
    );
  }

  try {
    const { output, meta } = await runAnalysis(id);

    // Replace machine-generated findings, but keep the ones a human edited.
    await prisma.finding.deleteMany({ where: { projectId: id, editedByHuman: false } });
    const kept = await prisma.finding.count({ where: { projectId: id } });

    await prisma.finding.createMany({
      data: output.findings.map((f, index) => ({
        projectId: id,
        dimension: f.dimension,
        title: f.title,
        body: f.body,
        evidenceType: f.evidenceType,
        sourceRefs: JSON.stringify(f.sourceRefs),
        confidence: f.confidence,
        orderIndex: kept + index,
      })),
    });

    await prisma.project.update({ where: { id }, data: { status: 'analysis' } });
    await audit(org.id, 'run_analysis', 'Project', id, { findings: output.findings.length, demoMode: meta.demoMode });

    return NextResponse.json({
      findings: output.findings.length,
      keptEdited: kept,
      missingCriticalData: output.missingCriticalData,
      researchPerformed: output.researchPerformed,
      meta,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
