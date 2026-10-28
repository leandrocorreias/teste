import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, PageHeader } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { questionsForSector, SECTORS } from '@/lib/questionnaire';
import { DiscoveryForm } from './DiscoveryForm';
import { ProjectTabs } from '@/components/ProjectTabs';

export const dynamic = 'force-dynamic';

export default async function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      client: true,
      submissions: { orderBy: { createdAt: 'desc' }, take: 1, include: { answers: true } },
    },
  });
  if (!project) notFound();

  const submission = project.submissions[0];
  const answers: Record<string, string | number | string[] | null> = {};
  for (const a of submission?.answers ?? []) {
    try {
      answers[a.questionId] = JSON.parse(a.valueJson);
    } catch {
      answers[a.questionId] = a.valueJson;
    }
  }

  const dimensions = questionsForSector(project.sector);
  const formVersion = await prisma.formVersion.findFirst({
    where: { form: { orgId: org.id } },
    orderBy: { version: 'desc' },
  });

  return (
    <Shell breadcrumb={<><Link href="/" className="hover:underline">Painel</Link> / {project.client.name} / {project.name}</>}>
      <PageHeader
        kicker={`Discovery · ${SECTORS.find((s) => s.id === project.sector)?.name ?? project.sector}`}
        title={project.name}
        description="Questionário setorial de 14 dimensões. As respostas são a única base factual do estudo: o que não for respondido é exibido como lacuna, nunca estimado."
        actions={<Link href={`/projects/${id}/analysis`} className="btn-ghost">Ir para análise</Link>}
      />
      <ProjectTabs projectId={id} active="discovery" />
      <DiscoveryForm
        projectId={id}
        dimensions={dimensions}
        initialAnswers={answers}
        submissionStatus={submission?.status ?? 'none'}
        formVersion={formVersion?.version ?? 1}
      />
    </Shell>
  );
}
