'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SlidePage } from '@/lib/design/schema';
import { SlideRenderer } from '@/components/slides';
import { THEMES, tokensToCssVars, resolveTokens, type ThemeId } from '@/lib/design/tokens';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';
import { withBasePath } from '@/lib/base-path';

interface JobStatus {
  status: string;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  downloadUrl: string | null;
  result: { pageCount?: number; bytes?: number } | null;
}

export function PresentationStudio({
  projectId,
  clientName,
  approvedNarrative,
  narrativeStatus,
  currentTheme,
  pages,
  warnings,
  versions,
  pdfEngine,
}: {
  projectId: string;
  clientName: string;
  approvedNarrative: boolean;
  narrativeStatus: string;
  currentTheme: ThemeId;
  pages: SlidePage[];
  warnings: Array<{ code: string; message: string }>;
  versions: Array<{ id: string; version: number; theme: string; format: string; pageCount: number | null; fileBytes: number | null; hasFile: boolean; createdAt: string }>;
  pdfEngine: 'server' | 'browser';
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>(currentTheme);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const { pending, error, run } = useAsyncAction();

  // Poll the durable job instead of holding the request open during rendering.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await api<JobStatus>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(status);
        if (status.status === 'done' || status.status === 'failed') {
          router.refresh();
          return;
        }
      } catch {
        /* keep polling: a transient read failure is not a job failure */
      }
      if (!cancelled) setTimeout(tick, 1200);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  async function exportPptx() {
    const latestPdf = versions.find((v) => v.format === 'pdf');
    if (pdfEngine === 'browser') {
      if (!latestPdf) return;
      window.open(withBasePath(`/api/documents/${latestPdf.id}/pptx`), '_blank', 'noopener');
      return;
    }
    setJob(null);
    const result = await run(() => api<{ jobId: string }>(`/api/projects/${projectId}/presentation/pptx`, { method: 'POST' }));
    if (result) setJobId(result.jobId);
  }

  async function generate(withScreenshots: boolean) {
    setJob(null);
    const result = await run(() =>
      api<{ jobId: string | null; engine: string; printUrl?: string; pages: number; warnings: Array<{ code: string; message: string }> }>(
        `/api/projects/${projectId}/presentation`,
        { method: 'POST', body: JSON.stringify({ themeId: theme, screenshots: withScreenshots }) },
      ),
    );
    if (!result) return;
    if (result.engine === 'browser' && result.printUrl) {
      window.open(withBasePath(result.printUrl), '_blank', 'noopener');
      router.refresh();
      return;
    }
    if (result.jobId) setJobId(result.jobId);
  }

  const tokens = resolveTokens(theme);
  const cssVars = tokensToCssVars(tokens) as Record<string, string>;

  return (
    <div className="space-y-8">
      {pdfEngine === 'browser' && (
        <Alert kind="info">
          Nesta hospedagem o PDF é impresso pelo <strong>seu navegador</strong> a partir da mesma rota de impressão que o
          renderizador usa — mesmos componentes, mesmo CSS. Ao clicar em montar, a apresentação abre em uma nova aba com o
          botão de impressão. O que não existe aqui é o arquivo guardado no servidor e a medição automática de transbordo,
          porque esta hospedagem não tem disco persistente nem Chromium.
        </Alert>
      )}
      {!approvedNarrative && (
        <Alert kind="warn">
          A narrativa ainda não foi aprovada ({narrativeStatus === 'none' ? 'nenhuma versão gerada' : narrativeStatus}). Aprove-a em{' '}
          <Link href={`/projects/${projectId}/analysis`} className="font-semibold underline">Análise e narrativa</Link> para liberar a geração.
        </Alert>
      )}

      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker">Variação de design</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(THEMES) as ThemeId[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={`flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors ${
                    theme === t ? 'border-forest-800 bg-forest-800 text-paper' : 'border-paper-line bg-white text-ink-soft hover:border-forest-600'
                  }`}
                >
                  <span className="flex gap-0.5">
                    <span className="h-3 w-3" style={{ background: THEMES[t].colors.bg, outline: '1px solid #DEDBD0' }} />
                    <span className="h-3 w-3" style={{ background: THEMES[t].colors.chapterBg }} />
                    <span className="h-3 w-3" style={{ background: THEMES[t].colors.accent }} />
                  </span>
                  {THEMES[t].name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => generate(false)} className="btn-primary" disabled={pending || !approvedNarrative}>
              {pending ? <Spinner label="Montando…" /> : pdfEngine === 'browser' ? 'Montar e abrir para impressão' : 'Gerar PDF'}
            </button>
            {pdfEngine === 'server' && (
              <button onClick={() => generate(true)} className="btn-ghost" disabled={pending || !approvedNarrative}>
                Gerar com capturas de página
              </button>
            )}
            <button onClick={exportPptx} className="btn-ghost" disabled={pending || pages.length === 0} title="Exporta as páginas já montadas como PPTX editável (fidelidade de texto, não cópia visual do PDF)">
              Exportar PPTX
            </button>
          </div>
        </div>
      </section>

      {error && <Alert kind="error">{error}</Alert>}
      {job && (
        <Alert kind={job.status === 'failed' ? 'error' : job.status === 'done' ? 'ok' : 'info'}>
          {job.status === 'queued' && 'Geração na fila…'}
          {job.status === 'running' && `Renderizando no Chromium (tentativa ${job.attempts}/${job.maxAttempts})…`}
          {job.status === 'done' && (
            <>
              PDF gerado com {job.result?.pageCount ?? '?'} páginas ({Math.round((job.result?.bytes ?? 0) / 1024)} KB).{' '}
              {job.downloadUrl && (
                <a href={job.downloadUrl} className="font-semibold underline" target="_blank" rel="noreferrer">Abrir PDF</a>
              )}
            </>
          )}
          {job.status === 'failed' && <>Falha na geração após {job.attempts} tentativa(s): {job.error}</>}
        </Alert>
      )}

      {warnings.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-medium text-ink">Ajustes aplicados pelo renderizador</h2>
          <div className="card divide-y divide-paper-line">
            {warnings.map((w, i) => (
              <div key={i} className="px-4 py-2.5 text-xs">
                <span className="mr-2 bg-paper-alt px-1.5 py-0.5 font-bold uppercase tracking-kicker text-ink-mute">{w.code}</span>
                <span className="text-ink-soft">{w.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pages.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-medium text-ink">Pré-visualização · {pages.length} páginas</h2>
            <span className="text-xs text-ink-mute">Mesmos componentes usados na geração do PDF</span>
          </div>
          <div className="space-y-6">
            {pages.map((page, i) => (
              <div key={i}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="kicker">Página {i + 1}</span>
                  <span className="bg-paper-alt px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-kicker text-ink-mute">{page.layoutId}</span>
                </div>
                <div className="overflow-hidden border border-paper-line" style={{ width: '100%', aspectRatio: '16 / 9' }}>
                  <div style={{ ...cssVars, width: 1280, height: 720, transformOrigin: 'top left', transform: 'scale(var(--preview-scale, 1))' }} className="preview-slide">
                    <SlideRenderer page={page} ctx={{ pageNumber: i + 1, totalPages: pages.length, clientName }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            .preview-slide { --preview-scale: 1; }
            @media (max-width: 1400px) { .preview-slide { --preview-scale: 0.72; } }
            @media (max-width: 1100px) { .preview-slide { --preview-scale: 0.55; } }
            @media (max-width: 800px) { .preview-slide { --preview-scale: 0.38; } }
          `}</style>
        </section>
      )}

      {versions.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-medium text-ink">Versões do documento</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Versão', 'Tema', 'Páginas', 'Tamanho', 'Gerado em', 'Arquivo'].map((h) => (
                    <th key={h} className="tablehead px-4 pt-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b border-paper-line last:border-0">
                    <td className="px-4 py-2.5 font-semibold">v{v.version}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{THEMES[v.theme as ThemeId]?.name ?? v.theme}</td>
                    <td className="px-4 py-2.5">{v.pageCount ?? '—'}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{v.fileBytes ? `${Math.round(v.fileBytes / 1024)} KB` : '—'}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{new Date(v.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-2.5">
                      {v.hasFile ? (
                        <a href={withBasePath(`/api/documents/${v.id}/file`)} target="_blank" rel="noreferrer" className="font-semibold text-forest-600 hover:underline">Baixar PDF</a>
                      ) : (
                        <span className="text-xs text-ink-mute">não gerado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
