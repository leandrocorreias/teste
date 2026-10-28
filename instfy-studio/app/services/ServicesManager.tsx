'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';

const BILLING_MODELS = [
  { id: 'one_time', label: 'Etapa única' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'per_unit', label: 'Por unidade' },
  { id: 'percent_of_base', label: 'Percentual da verba' },
  { id: 'tiered_monthly', label: 'Mensal escalonado' },
  { id: 'third_party_spend', label: 'Verba de terceiros' },
] as const;

export interface ServiceRow {
  id: string;
  code: string;
  name: string;
  category: string;
  summary: string | null;
  active: boolean;
  versionCount: number;
  currentVersion: number;
  billingModel: string;
  amount: string;
  percentPct: number | null;
  tiers: Array<{ fromMonth: number; toMonth: number | null; amount: string }>;
  scope: string[];
  exclusions: string[];
  notes: string | null;
}

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ServiceRow>>({});
  const [creating, setCreating] = useState(false);
  const [newService, setNewService] = useState({
    code: '',
    name: '',
    category: '',
    summary: '',
    billingModel: 'one_time',
    amount: '',
    percentPct: 20,
    scopeText: '',
    exclusionsText: '',
    notes: '',
  });
  const { pending, error, ok, run } = useAsyncAction();

  async function saveEdit(id: string) {
    const result = await run(
      () =>
        api(`/api/services/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: draft.name,
            category: draft.category,
            summary: draft.summary ?? null,
            amount: draft.amount,
            percentPct: draft.percentPct ?? undefined,
            tiers: draft.tiers,
            scope: draft.scope,
            exclusions: draft.exclusions,
            notes: draft.notes ?? null,
          }),
        }),
      'Serviço atualizado. Uma nova versão foi registrada.',
    );
    if (result) {
      setEditing(null);
      router.refresh();
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const done = await run(() => api(`/api/services/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }));
    if (done) router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remover "${name}" do catálogo? Propostas já emitidas não são afetadas.`)) return;
    const done = await run(() => api(`/api/services/${id}`, { method: 'DELETE' }), 'Serviço removido do catálogo.');
    if (done) router.refresh();
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const result = await run(
      () =>
        api('/api/services', {
          method: 'POST',
          body: JSON.stringify({
            code: newService.code.toUpperCase().replace(/\s+/g, '-'),
            name: newService.name,
            category: newService.category,
            summary: newService.summary,
            billingModel: newService.billingModel,
            amount: newService.amount,
            percentPct: newService.billingModel === 'percent_of_base' ? newService.percentPct : undefined,
            scope: newService.scopeText.split('\n').map((s) => s.trim()).filter(Boolean),
            exclusions: newService.exclusionsText.split('\n').map((s) => s.trim()).filter(Boolean),
            notes: newService.notes,
          }),
        }),
      'Serviço criado.',
    );
    if (result) {
      setCreating(false);
      setNewService({ ...newService, code: '', name: '', amount: '', scopeText: '', exclusionsText: '', notes: '' });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="ok">{ok}</Alert>}

      <div className="flex justify-end">
        <button onClick={() => setCreating((v) => !v)} className="btn-primary">
          {creating ? 'Cancelar' : 'Novo serviço'}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card grid gap-4 p-6 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="ns-code">Código *</label>
            <input id="ns-code" required className="field mt-1" placeholder="BRANDING-PLUS" value={newService.code} onChange={(e) => setNewService({ ...newService, code: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ns-category">Categoria *</label>
            <input id="ns-category" required className="field mt-1" placeholder="Marca" value={newService.category} onChange={(e) => setNewService({ ...newService, category: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="ns-name">Nome *</label>
            <input id="ns-name" required className="field mt-1" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="ns-summary">Resumo</label>
            <input id="ns-summary" className="field mt-1" value={newService.summary} onChange={(e) => setNewService({ ...newService, summary: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ns-model">Modelo de cobrança *</label>
            <select id="ns-model" className="field mt-1" value={newService.billingModel} onChange={(e) => setNewService({ ...newService, billingModel: e.target.value })}>
              {BILLING_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            {newService.billingModel === 'percent_of_base' ? (
              <>
                <label className="label" htmlFor="ns-pct">Percentual (%)</label>
                <input id="ns-pct" type="number" min={0} max={100} step={0.5} className="field mt-1" value={newService.percentPct} onChange={(e) => setNewService({ ...newService, percentPct: Number(e.target.value) })} />
              </>
            ) : (
              <>
                <label className="label" htmlFor="ns-amount">Valor de referência (R$)</label>
                <input id="ns-amount" inputMode="decimal" className="field mt-1" placeholder="10.000,00" value={newService.amount} onChange={(e) => setNewService({ ...newService, amount: e.target.value })} />
              </>
            )}
          </div>
          <div>
            <label className="label" htmlFor="ns-scope">Escopo (uma linha por item)</label>
            <textarea id="ns-scope" rows={5} className="field mt-1" value={newService.scopeText} onChange={(e) => setNewService({ ...newService, scopeText: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ns-excl">Não incluído (uma linha por item)</label>
            <textarea id="ns-excl" rows={5} className="field mt-1" value={newService.exclusionsText} onChange={(e) => setNewService({ ...newService, exclusionsText: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? <Spinner label="Criando…" /> : 'Criar serviço'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {services.map((s) => (
          <article key={s.id} className={`card p-5 ${s.active ? '' : 'opacity-60'}`}>
            {editing === s.id ? (
              <div className="space-y-3">
                <input className="field font-display text-base" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Nome do serviço" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="field" value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Categoria" />
                  {s.billingModel === 'percent_of_base' ? (
                    <input type="number" min={0} max={100} step={0.5} className="field" value={draft.percentPct ?? 0} onChange={(e) => setDraft({ ...draft, percentPct: Number(e.target.value) })} aria-label="Percentual" />
                  ) : (
                    <input inputMode="decimal" className="field" value={draft.amount ?? ''} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} aria-label="Valor" />
                  )}
                </div>
                <input className="field" value={draft.summary ?? ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} aria-label="Resumo" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Escopo</label>
                    <textarea rows={6} className="field mt-1" value={(draft.scope ?? []).join('\n')} onChange={(e) => setDraft({ ...draft, scope: e.target.value.split('\n') })} />
                  </div>
                  <div>
                    <label className="label">Não incluído</label>
                    <textarea rows={6} className="field mt-1" value={(draft.exclusions ?? []).join('\n')} onChange={(e) => setDraft({ ...draft, exclusions: e.target.value.split('\n') })} />
                  </div>
                </div>
                <div>
                  <label className="label">Observações internas</label>
                  <textarea rows={2} className="field mt-1" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => saveEdit(s.id)} disabled={pending}>Salvar nova versão</button>
                  <button className="btn-ghost text-xs" onClick={() => setEditing(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="kicker">
                      {s.category} · {s.code} · v{s.currentVersion} de {s.versionCount}
                      {!s.active && ' · inativo'}
                    </div>
                    <h3 className="mt-1 font-display text-base font-medium text-ink">{s.name}</h3>
                    {s.summary && <p className="mt-1 text-sm text-ink-soft">{s.summary}</p>}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                      {s.billingModel === 'percent_of_base'
                        ? `${s.percentPct ?? 0}%`
                        : s.tiers.length > 0
                          ? s.tiers.map((t) => `R$ ${t.amount}`).join(' → ')
                          : s.amount
                            ? `R$ ${s.amount}`
                            : '—'}
                    </div>
                    <div className="text-[10px] uppercase tracking-kicker text-ink-mute">
                      {BILLING_MODELS.find((m) => m.id === s.billingModel)?.label ?? s.billingModel}
                    </div>
                  </div>
                </div>
                {s.tiers.length > 0 && (
                  <div className="mt-2 text-xs text-ink-mute">
                    {s.tiers.map((t, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        R$ {t.amount} {t.toMonth ? `nos meses ${t.fromMonth}–${t.toMonth}` : `do mês ${t.fromMonth} em diante`}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="kicker">Escopo ({s.scope.length})</div>
                    <ul className="mt-1.5 space-y-1">
                      {s.scope.slice(0, 4).map((item, i) => <li key={i} className="text-xs leading-relaxed text-ink-soft">· {item}</li>)}
                      {s.scope.length > 4 && <li className="text-xs text-ink-mute">+ {s.scope.length - 4} itens</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="kicker">Não incluído ({s.exclusions.length})</div>
                    <ul className="mt-1.5 space-y-1">
                      {s.exclusions.slice(0, 4).map((item, i) => <li key={i} className="text-xs leading-relaxed text-ink-mute">· {item}</li>)}
                    </ul>
                  </div>
                </div>
                {s.notes && (
                  <p className="mt-3 border-l-2 border-paper-line pl-3 text-[11px] leading-relaxed text-ink-mute">{s.notes}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost text-xs" onClick={() => { setEditing(s.id); setDraft(s); }}>Editar</button>
                  <button className="btn-ghost text-xs" onClick={() => toggleActive(s.id, !s.active)} disabled={pending}>
                    {s.active ? 'Desativar' : 'Reativar'}
                  </button>
                  <button className="btn-ghost text-xs text-[#8E2B1E]" onClick={() => remove(s.id, s.name)} disabled={pending}>Remover</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
