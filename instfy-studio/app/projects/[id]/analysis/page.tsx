import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, PageHeader } from '@/components/Shell';
import { ProjectTabs } from '@/components/ProjectTabs';
import { prisma, getOrg } from '@/lib/db';
import { resolveProvider } from '@/lib/ai/provider';
import { computeCompletion } from '@/lib/questionnaire';
import { AnalysisWorkbench } from './AnalysisWorkbench';

export const dynamic = 'force-dynamic';

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      client: true,
      findings: { orderBy: { orderIndex: 'asc' } },
      narratives: { orderBy: { version: 'desc' } },
      submissions: { orderBy: { createdAt: 'desc' }, take: 1, include: { answers: true } },
      aiRuns: { orderBy: { createdAt: 'desc' }, take: 6 },
    },
  });
  if (!project) notFound();

  const provider = resolveProvider();
  const raw: Record<string, unknown> = {};
  for (const a of project.submissions[0]?.answers ?? []) {
    try {
      raw[a.questionId] = JSON.parse(a.valueJson);
    } catch {
      raw[a.questionId] = a.valueJson;
    }
  }
  const completion = computeCompletion(project.sector, raw);
  const latestNarrative = project.narratives[0];

  return (
    <Shell breadcrumb={<><Link href="/" className="hover:underline">Painel</Link> / {project.client.name} / {project.name}</>}>
      <PageHeader
        kicker="Análise e narrativa"
        title="Achados, evidências e narrativa"
        description="Cada achado carrega uma classificação de evidência e as perguntas que o sustentam. Edite, aprove e só então gere a narrativa — a IA redige apenas sobre conteúdo aprovado."
      />
      <ProjectTabs projectId={id} active="analysis" />
      <AnalysisWorkbench
        projectId={id}
        demoMode={provider.demoMode}
        providerLabel={provider.demoMode ? 'Modo demonstração' : `${provider.id} · ${provider.model}`}
        researchEnabled={provider.researchEnabled}
        answerCount={project.submissions[0]?.answers.length ?? 0}
        missingCritical={completion.missingCritical}
        findings={project.findings.map((f) => ({
          id: f.id,
          dimension: f.dimension,
          title: f.title,
          body: f.body,
          evidenceType: f.evidenceType,
          sourceRefs: JSON.parse(f.sourceRefs || '[]'),
          confidence: f.confidence,
          approved: f.approved,
          editedByHuman: f.editedByHuman,
        }))}
        narrative={
          latestNarrative
            ? {
                id: latestNarrative.id,
                version: latestNarrative.version,
                status: latestNarrative.status,
                body: JSON.parse(latestNarrative.bodyJson),
              }
            : null
        }
        aiRuns={project.aiRuns.map((r) => ({
          stage: r.stage,
          provider: r.provider,
          demoMode: r.demoMode,
          status: r.status,
          validationOk: r.validationOk,
          latencyMs: r.latencyMs,
          error: r.error,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </Shell>
  );
}
