'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVIDENCE_HELP, EVIDENCE_LABELS, type EvidenceTypeT, type NarrativeOutput } from '@/lib/design/schema';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';

interface FindingRow {
  id: string;
  dimension: string;
  title: string;
  body: string;
  evidenceType: string;
  sourceRefs: Array<{ kind: string; ref: string; label?: string }>;
  confidence: number;
  approved: boolean;
  editedByHuman: boolean;
}

const EVIDENCE_STYLE: Record<string, string> = {
  FACT: 'bg-[#E6F0E3] text-[#14401F]',
  SIGNAL: 'bg-[#E8EFF4] text-[#123A52]',
  INFERENCE: 'bg-[#F1EDE2] text-[#4A3C1C]',
  HYPOTHESIS: 'bg-[#F7E9D9] text-[#7A3F10]',
};

export function AnalysisWorkbench({
  projectId,
  demoMode,
  providerLabel,
  researchEnabled,
  answerCount,
  missingCritical,
  findings,
  narrative,
  aiRuns,
}: {
  projectId: string;
  demoMode: boolean;
  providerLabel: string;
  researchEnabled: boolean;
  answerCount: number;
  missingCritical: Array<{ questionId: string; label: string; dimension: string }>;
  findings: FindingRow[];
  narrative: { id: string; version: number; status: string; body: NarrativeOutput } | null;
  aiRuns: Array<{ stage: string; provider: string; demoMode: boolean; status: string; validationOk: boolean; latencyMs: number | null; error: string | null; createdAt: string }>;
}) {
  const router = useRouter();
  const analysis = useAsyncAction();
  const narrativeAction = useAsyncAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; evidenceType: string }>({ title: '', body: '', evidenceType: 'INFERENCE' });
  const [narrativeDraft, setNarrativeDraft] = useState<NarrativeOutput | null>(narrative?.body ?? null);

  const approvedCount = findings.filter((f) => f.approved).length;

  async function runAnalysis() {
    const result = await analysis.run(
      () => api<{ findings: number; researchPerformed: boolean }>(`/api/projects/${projectId}/analysis`, { method: 'POST' }),
    );
    if (result) router.refresh();
  }

  async function patchFinding(id: string, data: Record<string, unknown>) {
    const done = await analysis.run(() => api(`/api/findings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }));
    if (done) {
      setEditing(null);
      router.refresh();
    }
  }

  async function removeFinding(id: string) {
    if (!window.confirm('Remover este achado?')) return;
    const done = await analysis.run(() => api(`/api/findings/${id}`, { method: 'DELETE' }));
    if (done) router.refresh();
  }

  async function generateNarrative() {
    const result = await narrativeAction.run(
      () => api<{ narrative: { id: string; version: number; bodyJson: string } }>(`/api/projects/${projectId}/narrative`, { method: 'POST' }),
      'Narrativa gerada. Revise e aprove antes de exportar.',
    );
    if (result) router.refresh();
  }

  async function saveNarrative(approve: boolean) {
    if (!narrative || !narrativeDraft) return;
    const result = await narrativeAction.run(
      () =>
        api(`/api/projects/${projectId}/narrative`, {
          method: 'PATCH',
          body: JSON.stringify({ narrativeId: narrative.id, body: narrativeDraft, approve }),
        }),
      approve ? 'Narrativa aprovada. Já pode gerar a apresentação.' : 'Alterações salvas.',
    );
    if (result) router.refresh();
  }

  return (
    <div className="space-y-8">
      {demoMode && (
        <Alert kind="warn">
          <strong>Modo demonstração.</strong> Nenhuma chave de IA está configurada. Os achados são derivados mecanicamente das
          respostas do questionário, sem chamada a modelo de linguagem e sem qualquer pesquisa externa. Configure{' '}
          <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> ou <code className="font-mono text-xs">OPENAI_API_KEY</code> em{' '}
          <code className="font-mono text-xs">.env</code> para habilitar a redação por IA.
        </Alert>
      )}
      {!researchEnabled && (
        <Alert kind="info">
          Nenhum conector de pesquisa externa está configurado. Esta instalação <strong>não realiza</strong> pesquisa de mercado e
          nenhum documento afirmará ter realizado. Números de mercado só aparecem se vierem de fonte informada pelo cliente.
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Respostas registradas', value: String(answerCount) },
          { label: 'Achados', value: String(findings.length) },
          { label: 'Achados aprovados', value: String(approvedCount) },
          { label: 'Lacunas críticas', value: String(missingCritical.length) },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="kicker">{s.label}</div>
            <div className="mt-1.5 font-display text-2xl font-light tracking-[-0.03em] text-ink">{s.value}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium text-ink">Achados</h2>
            <p className="mt-1 text-xs text-ink-mute">Provedor: {providerLabel}</p>
          </div>
          <button onClick={runAnalysis} className="btn-primary" disabled={analysis.pending || answerCount === 0}>
            {analysis.pending ? <Spinner label="Analisando…" /> : findings.length ? 'Rodar análise novamente' : 'Rodar análise'}
          </button>
        </div>
        {answerCount === 0 && (
          <Alert kind="warn">
            Nenhuma resposta registrada. <Link href={`/projects/${projectId}/discovery`} className="font-semibold underline">Preencha o discovery</Link> antes de analisar.
          </Alert>
        )}
        {analysis.error && <Alert kind="error">{analysis.error}</Alert>}

        {findings.length > 0 && (
          <>
            <div className="mb-4 mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(EVIDENCE_LABELS) as EvidenceTypeT[]).map((type) => (
                <div key={type} className="card p-3">
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-kicker ${EVIDENCE_STYLE[type]}`}>
                    {EVIDENCE_LABELS[type]}
                  </span>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">{EVIDENCE_HELP[type]}</p>
                </div>
              ))}
            </div>

            <div className="card divide-y divide-paper-line">
              {findings.map((f) => (
                <article key={f.id} className="p-5">
                  {editing === f.id ? (
                    <div className="space-y-3">
                      <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Título do achado" />
                      <textarea rows={4} className="field" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label="Corpo do achado" />
                      <select className="field" value={draft.evidenceType} onChange={(e) => setDraft({ ...draft, evidenceType: e.target.value })} aria-label="Tipo de evidência">
                        {(Object.keys(EVIDENCE_LABELS) as EvidenceTypeT[]).map((t) => (
                          <option key={t} value={t}>{EVIDENCE_LABELS[t]} — {EVIDENCE_HELP[t]}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs" onClick={() => patchFinding(f.id, draft)} disabled={analysis.pending}>Salvar</button>
                        <button className="btn-ghost text-xs" onClick={() => setEditing(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-kicker ${EVIDENCE_STYLE[f.evidenceType] ?? 'bg-paper-alt text-ink-mute'}`}>
                          {EVIDENCE_LABELS[f.evidenceType as EvidenceTypeT] ?? f.evidenceType}
                        </span>
                        <span className="kicker">{f.dimension}</span>
                        <span className="text-[10px] text-ink-mute">confiança {f.confidence}%</span>
                        {f.editedByHuman && <span className="bg-paper-alt px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-kicker text-ink-mute">editado</span>}
                        {f.approved && <span className="bg-lime-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-kicker text-ink">aprovado</span>}
                      </div>
                      <h3 className="mt-2 font-display text-base font-medium text-ink">{f.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
                      {f.sourceRefs.length > 0 ? (
                        <div className="mt-2 text-[11px] text-ink-mute">
                          Fontes: {f.sourceRefs.map((r) => `${r.kind === 'url' ? r.ref : `questionário:${r.ref}`}`).join(' · ')}
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-[#7A3F10]">Sem fonte vinculada — não pode ser apresentado como fato.</div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => {
                            setEditing(f.id);
                            setDraft({ title: f.title, body: f.body, evidenceType: f.evidenceType });
                          }}
                        >
                          Editar
                        </button>
                        <button className={f.approved ? 'btn-ghost text-xs' : 'btn-accent text-xs'} onClick={() => patchFinding(f.id, { approved: !f.approved })} disabled={analysis.pending}>
                          {f.approved ? 'Revogar aprovação' : 'Aprovar'}
                        </button>
                        <button className="btn-ghost text-xs text-[#8E2B1E]" onClick={() => removeFinding(f.id)} disabled={analysis.pending}>Remover</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-medium text-ink">Narrativa estratégica</h2>
            <p className="mt-1 text-xs text-ink-mute">
              {narrative ? `Versão ${narrative.version} · ${narrative.status === 'approved' ? 'aprovada' : 'rascunho'}` : 'Nenhuma narrativa gerada'}
            </p>
          </div>
          <button onClick={generateNarrative} className="btn-primary" disabled={narrativeAction.pending || approvedCount === 0}>
            {narrativeAction.pending ? <Spinner label="Redigindo…" /> : narrative ? 'Gerar nova versão' : 'Gerar narrativa'}
          </button>
        </div>
        {approvedCount === 0 && <Alert kind="warn">Aprove ao menos um achado. A IA só redige sobre conteúdo que uma pessoa aprovou.</Alert>}
        {narrativeAction.error && <Alert kind="error">{narrativeAction.error}</Alert>}
        {narrativeAction.ok && <Alert kind="ok">{narrativeAction.ok}</Alert>}

        {narrative && narrativeDraft && (
          <div className="mt-4 space-y-4">
            <div className="card p-5">
              <label className="label" htmlFor="narrative-title">Título do documento</label>
              <input id="narrative-title" className="field mt-1" value={narrativeDraft.title} onChange={(e) => setNarrativeDraft({ ...narrativeDraft, title: e.target.value })} />
              <label className="label mt-3" htmlFor="narrative-subtitle">Subtítulo</label>
              <input id="narrative-subtitle" className="field mt-1" value={narrativeDraft.subtitle ?? ''} onChange={(e) => setNarrativeDraft({ ...narrativeDraft, subtitle: e.target.value })} />
            </div>

            {narrativeDraft.sections.map((section, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-center gap-2">
                  <span className="kicker">Parte {section.numeral}</span>
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-kicker ${EVIDENCE_STYLE[section.evidenceType] ?? 'bg-paper-alt'}`}>
                    {EVIDENCE_LABELS[section.evidenceType]}
                  </span>
                </div>
                <input
                  className="field mt-2 font-display text-base"
                  value={section.heading}
                  aria-label={`Título da parte ${section.numeral}`}
                  onChange={(e) => {
                    const sections = [...narrativeDraft.sections];
                    sections[i] = { ...section, heading: e.target.value };
                    setNarrativeDraft({ ...narrativeDraft, sections });
                  }}
                />
                <textarea
                  rows={2}
                  className="field mt-2 text-sm"
                  placeholder="Lead da parte"
                  aria-label={`Lead da parte ${section.numeral}`}
                  value={section.lead ?? ''}
                  onChange={(e) => {
                    const sections = [...narrativeDraft.sections];
                    sections[i] = { ...section, lead: e.target.value };
                    setNarrativeDraft({ ...narrativeDraft, sections });
                  }}
                />
                {section.body.map((paragraph, j) => (
                  <textarea
                    key={j}
                    rows={3}
                    className="field mt-2 text-sm"
                    aria-label={`Parágrafo ${j + 1} da parte ${section.numeral}`}
                    value={paragraph}
                    onChange={(e) => {
                      const sections = [...narrativeDraft.sections];
                      const body = [...section.body];
                      body[j] = e.target.value;
                      sections[i] = { ...section, body };
                      setNarrativeDraft({ ...narrativeDraft, sections });
                    }}
                  />
                ))}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => saveNarrative(false)} disabled={narrativeAction.pending}>Salvar alterações</button>
              <button className="btn-accent" onClick={() => saveNarrative(true)} disabled={narrativeAction.pending}>
                Aprovar narrativa
              </button>
              {narrative.status === 'approved' && (
                <Link href={`/projects/${projectId}/presentation`} className="btn-primary">Gerar apresentação →</Link>
              )}
            </div>
          </div>
        )}
      </section>

      {aiRuns.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-medium text-ink">Execuções de IA</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Etapa', 'Provedor', 'Status', 'Validação', 'Latência', 'Erro'].map((h) => (
                    <th key={h} className="tablehead px-4 pt-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiRuns.map((r, i) => (
                  <tr key={i} className="border-b border-paper-line last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.stage}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{r.provider}{r.demoMode ? ' (demo)' : ''}</td>
                    <td className="px-4 py-2.5">{r.status}</td>
                    <td className="px-4 py-2.5">{r.validationOk ? 'ok' : 'reprovada'}</td>
                    <td className="px-4 py-2.5 text-ink-mute">{r.latencyMs ?? '—'} ms</td>
                    <td className="px-4 py-2.5 text-xs text-[#8E2B1E]">{r.error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">
            Apenas o hash do prompt é armazenado. O conteúdo das respostas do cliente não é registrado em log.
          </p>
        </section>
      )}
    </div>
  );
}
