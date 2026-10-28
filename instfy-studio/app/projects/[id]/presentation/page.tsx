import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell, PageHeader } from '@/components/Shell';
import { ProjectTabs } from '@/components/ProjectTabs';
import { prisma, getOrg } from '@/lib/db';
import { slidePage, type SlidePage } from '@/lib/design/schema';
import { PresentationStudio } from './PresentationStudio';
import { pdfEngine } from '@/lib/pdf-engine';

export const dynamic = 'force-dynamic';

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await getOrg();
  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: { client: { include: { contacts: true } }, narratives: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!project) notFound();

  const document = await prisma.document.findFirst({
    where: { projectId: id, kind: 'presentation', deletedAt: null },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        include: { pages: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  });

  // The preview must come from a PDF version: PPTX versions carry no page rows.
  const latest = document?.versions.find((v) => v.format === 'pdf');
  const pages: SlidePage[] = [];
  const warnings: Array<{ code: string; message: string }> = [];
  for (const row of latest?.pages ?? []) {
    const parsed = slidePage.safeParse(JSON.parse(row.contentJson));
    if (parsed.success) pages.push(parsed.data);
    for (const w of JSON.parse(row.warningsJson || '[]')) warnings.push(w);
  }

  const approvedNarrative = project.narratives[0]?.status === 'approved';

  return (
    <Shell breadcrumb={<><Link href="/" className="hover:underline">Painel</Link> / {project.client.name} / {project.name}</>}>
      <PageHeader
        kicker="Apresentação estratégica"
        title="Montagem e exportação"
        description="A IA escolhe o layout e o conteúdo; os renderizadores da Instfy produzem todo o markup, verificam o orçamento de texto e dividem páginas em vez de cortar conteúdo."
      />
      <ProjectTabs projectId={id} active="presentation" />
      <PresentationStudio
        projectId={id}
        clientName={project.client.name}
        approvedNarrative={approvedNarrative}
        narrativeStatus={project.narratives[0]?.status ?? 'none'}
        currentTheme={(latest?.theme as 'instfy-light') ?? 'instfy-light'}
        pages={pages}
        warnings={warnings}
        pdfEngine={pdfEngine()}
        versions={(document?.versions ?? []).map((v) => ({
          id: v.id,
          version: v.version,
          theme: v.theme,
          format: v.format,
          pageCount: v.pageCount,
          fileBytes: v.fileBytes,
          hasFile: Boolean(v.filePath),
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </Shell>
  );
}
