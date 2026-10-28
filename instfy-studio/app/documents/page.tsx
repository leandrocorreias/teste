import Link from 'next/link';
import { Shell, PageHeader, EmptyState } from '@/components/Shell';
import { prisma, getOrg } from '@/lib/db';
import { withBasePath } from '@/lib/base-path';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-paper-alt text-ink-mute' },
  generating: { label: 'Gerando', className: 'bg-[#E8EFF4] text-[#123A52]' },
  ready: { label: 'Pronto', className: 'bg-[#E6F0E3] text-[#14401F]' },
  failed: { label: 'Falhou', className: 'bg-[#FBE4E0] text-[#8E2B1E]' },
};

export default async function DocumentsPage() {
  const org = await getOrg();
  const [documents, jobs] = await Promise.all([
    prisma.document.findMany({
      where: { orgId: org.id, deletedAt: null },
      include: {
        versions: { orderBy: { version: 'desc' } },
        project: { include: { client: true } },
        proposal: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.generationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return (
    <Shell>
      <PageHeader
        kicker="Biblioteca"
        title="Documentos e versões"
        description="Cada geração cria uma nova versão imutável, com o snapshot dos valores usados. Versões anteriores continuam acessíveis."
      />

      {documents.length === 0 ? (
        <EmptyState
          title="Nenhum documento gerado"
          description="Apresentações e propostas aparecem aqui assim que a primeira geração for concluída."
          action={<Link href="/" className="btn-primary">Ir para os projetos</Link>}
        />
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const status = STATUS[doc.status] ?? { label: doc.status, className: 'bg-paper-alt text-ink-mute' };
            return (
              <article key={doc.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="kicker">
                      {doc.kind === 'presentation' ? 'Apresentação estratégica' : 'Proposta comercial'}
                      {doc.project && ` · ${doc.project.client.name}`}
                    </div>
                    <h3 className="mt-1 font-display text-base font-medium text-ink">{doc.title}</h3>
                    {doc.proposal && <div className="mt-1 text-xs text-ink-mute">Proposta v{doc.proposal.version} · {doc.proposal.status}</div>}
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-kicker ${status.className}`}>{status.label}</span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>{['Versão', 'Formato', 'Tema', 'Páginas', 'Tamanho', 'Gerado em', 'Arquivo'].map((h) => (
                        <th key={h} className="tablehead">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {doc.versions.map((v) => (
                        <tr key={v.id} className="border-b border-paper-line last:border-0">
                          <td className="py-2.5 font-semibold">v{v.version}</td>
                          <td className="py-2.5 uppercase text-ink-mute">{v.format}</td>
                          <td className="py-2.5 text-ink-mute">{v.theme}</td>
                          <td className="py-2.5">{v.pageCount ?? '—'}</td>
                          <td className="py-2.5 text-ink-mute">{v.fileBytes ? `${Math.round(v.fileBytes / 1024)} KB` : '—'}</td>
                          <td className="py-2.5 text-ink-mute">{v.createdAt.toLocaleString('pt-BR')}</td>
                          <td className="py-2.5">
                            {v.filePath ? (
                              <a href={withBasePath(`/api/documents/${v.id}/file`)} target="_blank" rel="noreferrer" className="font-semibold text-forest-600 hover:underline">
                                Baixar
                              </a>
                            ) : (
                              <span className="text-xs text-ink-mute">não gerado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-medium text-ink">Fila de geração</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>{['Tipo', 'Status', 'Tentativas', 'Criado', 'Erro'].map((h) => <th key={h} className="tablehead px-4 pt-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-paper-line last:border-0">
                    <td className="px-4 py-2.5 font-medium">{j.kind}</td>
                    <td className="px-4 py-2.5">{j.status}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{j.attempts}/{j.maxAttempts}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{j.createdAt.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2.5 text-xs text-[#8E2B1E]">{j.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  );
}
