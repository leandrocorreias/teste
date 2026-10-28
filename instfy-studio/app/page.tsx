import Link from 'next/link';
import { Shell, PageHeader, EmptyState } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { SetupScreen } from './SetupScreen';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  discovery: 'Discovery',
  analysis: 'Análise',
  proposal: 'Proposta',
  won: 'Fechado',
  archived: 'Arquivado',
  draft: 'Rascunho',
  generating: 'Gerando',
  ready: 'Pronto',
  approved: 'Aprovado',
  failed: 'Falhou',
};

export default async function Dashboard() {
  // A fresh deployment starts with an empty database: offer to initialise it
  // rather than failing with a stack trace.
  const existing = await prisma.organization.findFirst({ where: { deletedAt: null } });
  if (!existing) return <SetupScreen />;

  const org = await getOrg();
  const [projects, documents, proposals, services] = await Promise.all([
    prisma.project.findMany({
      where: { orgId: org.id, deletedAt: null },
      include: { client: true, submissions: { take: 1, orderBy: { createdAt: 'desc' } }, proposals: { where: { deletedAt: null } } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.document.findMany({
      where: { orgId: org.id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, project: { include: { client: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    }),
    prisma.proposal.count({ where: { deletedAt: null } }),
    prisma.service.count({ where: { orgId: org.id, deletedAt: null, active: true } }),
  ]);

  return (
    <Shell>
      <PageHeader
        kicker="Painel"
        title="Instfy Intelligence Studio"
        description="Do questionário de discovery à proposta comercial assinada. Os textos podem ser redigidos por IA; os valores são sempre calculados pelo motor determinístico e aprovados por uma pessoa."
        actions={
          <>
            <Link href="/projects/new" className="btn-primary">Novo projeto</Link>
            <Link href="/clients" className="btn-ghost">Clientes</Link>
          </>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Projetos ativos', value: String(projects.length) },
          { label: 'Propostas', value: String(proposals) },
          { label: 'Documentos gerados', value: String(documents.length) },
          { label: 'Serviços no catálogo', value: String(services) },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="kicker">{stat.label}</div>
            <div className="mt-2 font-display text-3xl font-light tracking-[-0.04em] text-ink">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-4 font-display text-xl font-medium text-ink">Projetos</h2>
          {projects.length === 0 ? (
            <EmptyState
              title="Nenhum projeto ainda"
              description="Crie um cliente e um projeto para iniciar o discovery estratégico."
              action={<Link href="/projects/new" className="btn-primary">Criar projeto</Link>}
            />
          ) : (
            <div className="card divide-y divide-paper-line">
              {projects.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="kicker">{p.client.name}</div>
                    <Link href={`/projects/${p.id}/discovery`} className="mt-1 block font-display text-base font-medium text-ink hover:underline">
                      {p.name}
                    </Link>
                    <div className="mt-1 text-xs text-ink-mute">
                      {STATUS_LABEL[p.status] ?? p.status} · {p.submissions.length ? 'questionário iniciado' : 'questionário não iniciado'} ·{' '}
                      {p.proposals.length} proposta(s)
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/projects/${p.id}/discovery`} className="btn-ghost text-xs">Discovery</Link>
                    <Link href={`/projects/${p.id}/analysis`} className="btn-ghost text-xs">Análise</Link>
                    <Link href={`/projects/${p.id}/presentation`} className="btn-ghost text-xs">Apresentação</Link>
                    <Link href={`/projects/${p.id}/proposal`} className="btn-accent text-xs">Proposta</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-xl font-medium text-ink">Documentos recentes</h2>
          {documents.length === 0 ? (
            <EmptyState title="Nenhum documento" description="Apresentações e propostas aparecem aqui assim que forem geradas." />
          ) : (
            <div className="card divide-y divide-paper-line">
              {documents.map((d) => {
                const latest = d.versions[0];
                return (
                  <div key={d.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="kicker">{d.kind === 'presentation' ? 'Apresentação' : 'Proposta'}</div>
                        <div className="mt-1 truncate text-sm font-medium text-ink">{d.title}</div>
                        <div className="text-xs text-ink-mute">{d.project?.client.name ?? '—'}</div>
                      </div>
                      <span className="shrink-0 bg-paper-alt px-2 py-1 text-[9px] font-bold uppercase tracking-kicker text-ink-mute">
                        {STATUS_LABEL[d.status] ?? d.status}
                      </span>
                    </div>
                    {latest && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-ink-mute">
                        <span>v{latest.version}</span>
                        <span>{latest.pageCount ?? 0} páginas</span>
                        {latest.fileBytes && <span>{Math.round(latest.fileBytes / 1024)} KB</span>}
                        {latest.filePath && (
                          <a href={`/api/documents/${latest.id}/file`} className="font-semibold text-forest-600 hover:underline">
                            Baixar
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="p-4">
                <Link href="/documents" className="text-xs font-semibold text-forest-600 hover:underline">Ver todos os documentos →</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
