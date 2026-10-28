'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';
import type { ProposalSpec } from '@/lib/proposal-spec';
import type { PricingFlag, PricingTotals } from '@/lib/pricing';

const BILLING_LABEL: Record<string, string> = {
  one_time: 'Etapa única',
  monthly: 'Mensal',
  per_unit: 'Por unidade',
  percent_of_base: '% da verba',
  tiered_monthly: 'Mensal escalonado',
  third_party_spend: 'Verba de terceiros',
};

export interface Tier { fromMonth: number; toMonth: number | null; amount: string; label?: string }

export interface Item {
  serviceVersionId: string | null;
  label: string;
  description: string | null;
  billingModel: string;
  quantity: number;
  unitAmount: string;
  percentPct: number | null;
  percentBase: string | null;
  tiers: Tier[];
  monthsCovered: number | null;
  bonified: boolean;
  discountPct: number;
  discountApproved: boolean;
  isThirdPartySpend: boolean;
  scope: string[];
  exclusions: string[];
}

interface CatalogEntry {
  serviceId: string;
  serviceVersionId: string;
  code: string;
  name: string;
  category: string;
  summary: string | null;
  billingModel: string;
  amount: string;
  percentPct: number | null;
  tiers: Tier[];
  scope: string[];
  exclusions: string[];
  notes: string | null;
}

interface ProposalRow {
  id: string;
  version: number;
  title: string;
  status: string;
  termMonths: number;
  taxRatePct: number | null;
  aiCopyStatus: string;
  conditions: string[];
  narrative: { headline?: string; openingParagraphs?: string[]; valuePillars?: Array<{ heading: string; text: string }>; closingNote?: string };
  items: Item[];
  documents: Array<{ id: string; version: number; pageCount: number | null; fileBytes: number | null; hasFile: boolean; createdAt: string }>;
}

export function ProposalStudio({
  projectId,
  discountCapPct,
  catalog,
  proposals,
  pdfEngine,
}: {
  projectId: string;
  discountCapPct: number;
  catalog: CatalogEntry[];
  proposals: ProposalRow[];
  pdfEngine: 'server' | 'browser';
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.id ?? null);
  const selected = proposals.find((p) => p.id === selectedId) ?? null;
  const [items, setItems] = useState<Item[]>(selected?.items ?? []);
  const [termMonths, setTermMonths] = useState(selected?.termMonths ?? 12);
  const [taxRatePct, setTaxRatePct] = useState<number | null>(selected?.taxRatePct ?? null);
  const [flags, setFlags] = useState<PricingFlag[]>([]);
  const [spec, setSpec] = useState<ProposalSpec | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<{ status: string; attempts: number; error: string | null; downloadUrl: string | null; result: { pageCount?: number; bytes?: number } | null } | null>(null);

  const create = useAsyncAction();
  const save = useAsyncAction();
  const copy = useAsyncAction();
  const generate = useAsyncAction();

  // Reload the editor when the operator switches proposal version.
  useEffect(() => {
    if (!selected) return;
    setItems(selected.items);
    setTermMonths(selected.termMonths);
    setTaxRatePct(selected.taxRatePct);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the authoritative totals from the server engine on mount/selection.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void api<{ spec: ProposalSpec; totals: PricingTotals; flags: PricingFlag[] }>(`/api/proposals/${selectedId}`)
      .then((r) => {
        if (cancelled) return;
        setSpec(r.spec);
        setFlags(r.flags);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await api<typeof job>(`/api/jobs/${jobId}`);
        if (cancelled || !status) return;
        setJob(status);
        if (status.status === 'done' || status.status === 'failed') {
          router.refresh();
          return;
        }
      } catch {
        /* transient read failure: keep polling */
      }
      if (!cancelled) setTimeout(tick, 1200);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, router]);

  const blocking = useMemo(() => flags.filter((f) => f.severity === 'block'), [flags]);

  async function createProposal() {
    const result = await create.run(() => api<{ proposal: { id: string } }>(`/api/projects/${projectId}/proposal`, { method: 'POST' }));
    if (result) {
      setSelectedId(result.proposal.id);
      router.refresh();
    }
  }

  async function persist(extra: Record<string, unknown> = {}) {
    if (!selectedId) return null;
    const result = await save.run(
      () =>
        api<{ spec: ProposalSpec; totals: PricingTotals; flags: PricingFlag[] }>(`/api/proposals/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify({ items, termMonths, taxRatePct, ...extra }),
        }),
      'Proposta recalculada e salva.',
    );
    if (result) {
      setSpec(result.spec);
      setFlags(result.flags);
      router.refresh();
    }
    return result;
  }

  async function draftCopy() {
    if (!selectedId) return;
    const result = await copy.run(
      () => api(`/api/proposals/${selectedId}/copy`, { method: 'POST' }),
      'Texto de enquadramento gerado. Os valores continuam vindo do motor de precificação.',
    );
    if (result) router.refresh();
  }

  async function generatePdf() {
    if (!selectedId) return;
    setJob(null);
    const result = await generate.run(() =>
      api<{ jobId: string | null; engine: string; printUrl?: string }>(`/api/proposals/${selectedId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ screenshots: false }),
      }),
    );
    if (!result) return;
    if (result.engine === 'browser' && result.printUrl) {
      window.open(result.printUrl, '_blank', 'noopener');
      router.refresh();
      return;
    }
    if (result.jobId) setJobId(result.jobId);
  }

  function addFromCatalog(entry: CatalogEntry) {
    setItems((prev) => [
      ...prev,
      {
        serviceVersionId: entry.serviceVersionId,
        label: entry.name,
        description: entry.summary,
        billingModel: entry.billingModel,
        quantity: 1,
        unitAmount: entry.amount,
        percentPct: entry.percentPct,
        percentBase: entry.billingModel === 'percent_of_base' ? '0,00' : null,
        tiers: entry.tiers,
        monthsCovered: ['monthly', 'tiered_monthly', 'percent_of_base', 'third_party_spend'].includes(entry.billingModel) ? termMonths : null,
        bonified: false,
        discountPct: 0,
        discountApproved: false,
        isThirdPartySpend: entry.billingModel === 'third_party_spend',
        scope: entry.scope,
        exclusions: entry.exclusions,
      },
    ]);
  }

  function patchItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  if (proposals.length === 0) {
    return (
      <div className="card px-6 py-14 text-center">
        <h3 className="font-display text-lg text-ink">Nenhuma proposta criada</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-mute">
          Crie a primeira versão para selecionar serviços do catálogo, configurar verbas e condições, e emitir o PDF.
        </p>
        {create.error && <div className="mt-4"><Alert kind="error">{create.error}</Alert></div>}
        <button onClick={createProposal} className="btn-primary mt-6" disabled={create.pending}>
          {create.pending ? <Spinner label="Criando…" /> : 'Criar proposta v1'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="kicker" htmlFor="proposal-version">Versão</label>
          <select id="proposal-version" className="field w-auto" value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>v{p.version} · {p.status}</option>
            ))}
          </select>
          <span className="text-xs text-ink-mute">Limite de desconto autorizado: <strong>{discountCapPct}%</strong></span>
        </div>
        <button onClick={createProposal} className="btn-ghost text-xs" disabled={create.pending}>Nova versão</button>
      </section>

      {blocking.length > 0 && (
        <Alert kind="error">
          <strong>{blocking.length} pendência(s) bloqueando a aprovação:</strong>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {blocking.map((f, i) => <li key={i}>{f.message}</li>)}
          </ul>
        </Alert>
      )}
      {flags.filter((f) => f.severity === 'warn').length > 0 && (
        <Alert kind="warn">
          <ul className="list-disc space-y-1 pl-5">
            {flags.filter((f) => f.severity === 'warn').map((f, i) => <li key={i}>{f.message}</li>)}
          </ul>
        </Alert>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-display text-xl font-medium text-ink">Itens contratados</h2>
            {items.length === 0 ? (
              <div className="card px-5 py-10 text-center text-sm text-ink-mute">
                Nenhum item. Selecione serviços no catálogo à direita.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <article key={index} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="kicker">{BILLING_LABEL[item.billingModel] ?? item.billingModel}</span>
                        <input
                          className="field mt-1 font-display text-base"
                          aria-label={`Nome do item ${index + 1}`}
                          value={item.label}
                          onChange={(e) => patchItem(index, { label: e.target.value })}
                        />
                      </div>
                      <button className="btn-ghost text-xs text-[#8E2B1E]" onClick={() => setItems((p) => p.filter((_, i) => i !== index))}>
                        Remover
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {['one_time', 'per_unit', 'monthly', 'third_party_spend'].includes(item.billingModel) && (
                        <div>
                          <label className="label" htmlFor={`amount-${index}`}>
                            {item.billingModel === 'monthly' || item.billingModel === 'third_party_spend' ? 'Valor mensal (R$)' : 'Valor unitário (R$)'}
                          </label>
                          <input id={`amount-${index}`} inputMode="decimal" className="field mt-1" value={item.unitAmount} onChange={(e) => patchItem(index, { unitAmount: e.target.value })} />
                        </div>
                      )}
                      {item.billingModel === 'per_unit' && (
                        <div>
                          <label className="label" htmlFor={`qty-${index}`}>Quantidade</label>
                          <input id={`qty-${index}`} type="number" min={0} className="field mt-1" value={item.quantity} onChange={(e) => patchItem(index, { quantity: Number(e.target.value) })} />
                        </div>
                      )}
                      {item.billingModel === 'percent_of_base' && (
                        <>
                          <div>
                            <label className="label" htmlFor={`pct-${index}`}>Percentual (%)</label>
                            <input id={`pct-${index}`} type="number" min={0} max={100} step={0.5} className="field mt-1" value={item.percentPct ?? 0} onChange={(e) => patchItem(index, { percentPct: Number(e.target.value) })} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`base-${index}`}>Verba de mídia mensal (R$)</label>
                            <input id={`base-${index}`} inputMode="decimal" className="field mt-1" value={item.percentBase ?? ''} placeholder="não informada" onChange={(e) => patchItem(index, { percentBase: e.target.value })} />
                            <p className="mt-1 text-[11px] text-ink-mute">Se ficar vazia, o honorário é exibido como pendente, não estimado.</p>
                          </div>
                        </>
                      )}
                      {['monthly', 'tiered_monthly', 'percent_of_base', 'third_party_spend'].includes(item.billingModel) && (
                        <div>
                          <label className="label" htmlFor={`months-${index}`}>Meses cobertos</label>
                          <input id={`months-${index}`} type="number" min={1} max={60} className="field mt-1" value={item.monthsCovered ?? termMonths} onChange={(e) => patchItem(index, { monthsCovered: Number(e.target.value) })} />
                        </div>
                      )}
                    </div>

                    {item.billingModel === 'tiered_monthly' && (
                      <div className="mt-4 border-t border-paper-line pt-3">
                        <div className="kicker">Faixas por mês</div>
                        <div className="mt-2 space-y-2">
                          {item.tiers.map((tier, ti) => (
                            <div key={ti} className="grid grid-cols-[80px_80px_1fr_auto] items-end gap-2">
                              <div>
                                <label className="label text-[10px]" htmlFor={`tf-${index}-${ti}`}>Do mês</label>
                                <input id={`tf-${index}-${ti}`} type="number" min={1} className="field mt-1" value={tier.fromMonth} onChange={(e) => {
                                  const tiers = [...item.tiers];
                                  tiers[ti] = { ...tier, fromMonth: Number(e.target.value) };
                                  patchItem(index, { tiers });
                                }} />
                              </div>
                              <div>
                                <label className="label text-[10px]" htmlFor={`tt-${index}-${ti}`}>Até o mês</label>
                                <input id={`tt-${index}-${ti}`} type="number" min={1} className="field mt-1" placeholder="∞" value={tier.toMonth ?? ''} onChange={(e) => {
                                  const tiers = [...item.tiers];
                                  tiers[ti] = { ...tier, toMonth: e.target.value === '' ? null : Number(e.target.value) };
                                  patchItem(index, { tiers });
                                }} />
                              </div>
                              <div>
                                <label className="label text-[10px]" htmlFor={`ta-${index}-${ti}`}>Valor mensal (R$)</label>
                                <input id={`ta-${index}-${ti}`} inputMode="decimal" className="field mt-1" value={tier.amount} onChange={(e) => {
                                  const tiers = [...item.tiers];
                                  tiers[ti] = { ...tier, amount: e.target.value };
                                  patchItem(index, { tiers });
                                }} />
                              </div>
                              <button className="btn-ghost text-xs" onClick={() => patchItem(index, { tiers: item.tiers.filter((_, i) => i !== ti) })}>×</button>
                            </div>
                          ))}
                          <button
                            className="text-xs font-semibold text-forest-600"
                            onClick={() => patchItem(index, { tiers: [...item.tiers, { fromMonth: (item.tiers.at(-1)?.toMonth ?? 0) + 1, toMonth: null, amount: '0,00' }] })}
                          >
                            + Adicionar faixa
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-paper-line pt-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                        <input type="checkbox" checked={item.bonified} onChange={(e) => patchItem(index, { bonified: e.target.checked })} />
                        Bonificado
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
                        <input type="checkbox" checked={item.isThirdPartySpend} onChange={(e) => patchItem(index, { isThirdPartySpend: e.target.checked })} />
                        Verba de terceiros
                      </label>
                      <div>
                        <label className="label text-[10px]" htmlFor={`disc-${index}`}>Desconto (%)</label>
                        <input id={`disc-${index}`} type="number" min={0} max={100} className="field mt-1 w-24" value={item.discountPct} onChange={(e) => patchItem(index, { discountPct: Number(e.target.value) })} />
                      </div>
                      {item.discountPct > 0 && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#7A3F10]">
                          <input type="checkbox" checked={item.discountApproved} onChange={(e) => patchItem(index, { discountApproved: e.target.checked })} />
                          Override aprovado por responsável
                        </label>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-4 card p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="term">Vigência (meses)</label>
                  <input id="term" type="number" min={1} max={60} className="field mt-1" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label" htmlFor="tax">Tributo (%)</label>
                  <input
                    id="tax"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="field mt-1"
                    placeholder="não aplicado"
                    value={taxRatePct ?? ''}
                    onChange={(e) => setTaxRatePct(e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <p className="mt-1 text-[11px] text-ink-mute">Vazio = nenhum tributo é adicionado. Nada é presumido.</p>
                </div>
                <div className="flex items-end">
                  <button onClick={() => persist()} className="btn-primary w-full" disabled={save.pending}>
                    {save.pending ? <Spinner label="Calculando…" /> : 'Recalcular e salvar'}
                  </button>
                </div>
              </div>
              {save.error && <div className="mt-3"><Alert kind="error">{save.error}</Alert></div>}
              {save.ok && <div className="mt-3"><Alert kind="ok">{save.ok}</Alert></div>}
            </div>
          </section>

          {spec && (
            <section>
              <h2 className="mb-3 font-display text-xl font-medium text-ink">Resumo financeiro calculado</h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Implantação única (honorários)', spec.headline.oneTimeLabel, true],
                      ['Operação mensal (mês 1)', spec.headline.recurringFirstLabel, false],
                      ['Valor do primeiro mês', spec.headline.firstMonthDueLabel, true],
                      ['Honorários Instfy no período', spec.financial.instfyFeesLabel, true],
                      ['Verba de terceiros (anúncios)', spec.financial.thirdPartySpendLabel, false],
                      ['Desembolso total do cliente', spec.financial.clientTotalLabel, true],
                      ['Bonificação concedida', spec.financial.bonifiedLabel, false],
                      ['Desconto aprovado', spec.financial.discountLabel, false],
                      ['Tributos', spec.financial.taxLabel ?? 'não aplicado (nenhum configurado)', false],
                    ].map(([label, value, strong], i) => (
                      <tr key={i} className="border-b border-paper-line last:border-0">
                        <td className={`px-4 py-2.5 ${strong ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{label as string}</td>
                        <td className={`px-4 py-2.5 text-right font-display ${strong ? 'text-base font-bold' : 'font-medium'}`}>{value as string}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="card mt-3 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Detalhamento mês a mês</summary>
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr>{['Mês', 'Honorários Instfy', 'Verba de mídia'].map((h) => <th key={h} className="tablehead pb-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {spec.financial.monthly.map((m) => (
                      <tr key={m.month} className="border-b border-paper-line last:border-0">
                        <td className="py-1.5">{m.month}</td>
                        <td className="py-1.5 text-right">{m.instfyLabel}</td>
                        <td className="py-1.5 text-right text-ink-mute">{m.thirdPartyLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          <div className="card p-5">
            <h2 className="font-display text-base font-medium text-ink">Catálogo de serviços</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
              Os valores do catálogo são <strong>exemplos</strong> de propostas anteriores. Revise cada um antes de emitir.
            </p>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {catalog.map((entry) => (
                <div key={entry.serviceVersionId} className="border border-paper-line p-3">
                  <div className="kicker">{entry.category} · {BILLING_LABEL[entry.billingModel] ?? entry.billingModel}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{entry.name}</div>
                  {entry.summary && <div className="mt-1 text-[11px] leading-relaxed text-ink-mute">{entry.summary}</div>}
                  <button onClick={() => addFromCatalog(entry)} className="btn-ghost mt-2 w-full text-xs">Adicionar</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-2 p-5">
            <h2 className="font-display text-base font-medium text-ink">Texto e emissão</h2>
            <p className="text-[11px] leading-relaxed text-ink-mute">
              Status do texto: <strong>{selected?.aiCopyStatus === 'demo' ? 'modo demonstração' : selected?.aiCopyStatus === 'generated' ? 'gerado por IA' : 'não gerado'}</strong>
            </p>
            <button onClick={draftCopy} className="btn-ghost w-full text-xs" disabled={copy.pending || items.length === 0}>
              {copy.pending ? <Spinner label="Redigindo…" /> : 'Redigir enquadramento estratégico'}
            </button>
            <button onClick={() => persist({ status: 'approved' })} className="btn-accent w-full text-xs" disabled={save.pending || blocking.length > 0}>
              Aprovar condições comerciais
            </button>
            <button onClick={generatePdf} className="btn-primary w-full text-xs" disabled={generate.pending || items.length === 0}>
              {generate.pending ? <Spinner label="Gerando…" /> : pdfEngine === 'browser' ? 'Montar e abrir para impressão' : 'Gerar PDF da proposta'}
            </button>
            {pdfEngine === 'browser' && (
              <p className="text-[11px] leading-relaxed text-ink-mute">
                O PDF é impresso pelo seu navegador a partir da rota de impressão da aplicação. A proposta abre em nova aba
                com o botão de impressão; os valores já vêm congelados no snapshot desta versão.
              </p>
            )}
            {copy.error && <Alert kind="error">{copy.error}</Alert>}
            {copy.ok && <Alert kind="ok">{copy.ok}</Alert>}
            {generate.error && <Alert kind="error">{generate.error}</Alert>}
            {job && (
              <Alert kind={job.status === 'failed' ? 'error' : job.status === 'done' ? 'ok' : 'info'}>
                {job.status === 'done' ? (
                  <>
                    PDF com {job.result?.pageCount ?? '?'} páginas.{' '}
                    {job.downloadUrl && <a href={job.downloadUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Abrir</a>}
                  </>
                ) : job.status === 'failed' ? (
                  <>Falha: {job.error}</>
                ) : (
                  'Renderizando…'
                )}
              </Alert>
            )}
          </div>

          {selected && selected.documents.length > 0 && (
            <div className="card p-5">
              <h2 className="font-display text-base font-medium text-ink">Documentos emitidos</h2>
              <div className="mt-3 space-y-2">
                {selected.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 border-b border-paper-line pb-2 last:border-0">
                    <div className="text-xs">
                      <div className="font-semibold text-ink">doc v{d.version}</div>
                      <div className="text-ink-mute">
                        {d.pageCount ?? '?'} pág · {d.fileBytes ? `${Math.round(d.fileBytes / 1024)} KB` : 'gerando'}
                      </div>
                    </div>
                    {d.hasFile && (
                      <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-forest-600 hover:underline">
                        Baixar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
