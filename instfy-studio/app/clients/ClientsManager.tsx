'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SECTORS } from '@/lib/questionnaire';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';

export interface ClientRow {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  sector: string;
  website: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  contacts: Array<{ id: string; name: string; role: string | null; email: string | null }>;
  projectCount: number;
}

const EMPTY = {
  name: '',
  legalName: '',
  taxId: '',
  sector: 'fitness_wellness',
  website: '',
  city: '',
  state: '',
  notes: '',
  contacts: [{ name: '', role: '', email: '', phone: '' }],
};

export function ClientsManager({ initialClients }: { initialClients: ClientRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(initialClients.length === 0);
  const { pending, error, ok, run } = useAsyncAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await run(
      () => api<{ client: ClientRow }>('/api/clients', { method: 'POST', body: JSON.stringify(form) }),
      'Cliente criado.',
    );
    if (created) {
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remover "${name}"? Os projetos vinculados também saem da listagem.`)) return;
    const done = await run(() => api(`/api/clients/${id}`, { method: 'DELETE' }), 'Cliente removido.');
    if (done) router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        {initialClients.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <h3 className="font-display text-lg text-ink">Nenhum cliente cadastrado</h3>
            <p className="mt-2 text-sm text-ink-mute">Use o formulário ao lado para criar o primeiro.</p>
          </div>
        ) : (
          <div className="card divide-y divide-paper-line">
            {initialClients.map((c) => (
              <div key={c.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="kicker">{SECTORS.find((s) => s.id === c.sector)?.name ?? c.sector}</div>
                  <div className="mt-1 font-display text-base font-medium text-ink">{c.name}</div>
                  <div className="mt-1 text-xs text-ink-mute">
                    {[c.legalName, c.taxId, [c.city, c.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') || 'Sem dados complementares'}
                  </div>
                  {c.contacts.length > 0 && (
                    <div className="mt-2 text-xs text-ink-soft">
                      {c.contacts.map((ct) => `${ct.name}${ct.role ? ` (${ct.role})` : ''}`).join(' · ')}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-ink-mute">{c.projectCount} projeto(s)</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/projects/new?clientId=${c.id}`} className="btn-ghost text-xs">Novo projeto</Link>
                  <button onClick={() => remove(c.id, c.name)} className="btn-ghost text-xs text-[#8E2B1E]" disabled={pending}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-ink">Novo cliente</h2>
            <button onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-forest-600">
              {open ? 'Recolher' : 'Expandir'}
            </button>
          </div>
          {open && (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="label" htmlFor="name">Nome *</label>
                <input id="name" required className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="sector">Setor *</label>
                <select id="sector" className="field mt-1" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                  {SECTORS.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="legalName">Razão social</label>
                  <input id="legalName" className="field mt-1" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="taxId">CNPJ</label>
                  <input id="taxId" className="field mt-1" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div>
                  <label className="label" htmlFor="city">Cidade</label>
                  <input id="city" className="field mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="state">UF</label>
                  <input id="state" className="field mt-1" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="website">Site</label>
                <input id="website" className="field mt-1" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>

              <fieldset className="border-t border-paper-line pt-3">
                <legend className="kicker">Contatos</legend>
                {form.contacts.map((contact, i) => (
                  <div key={i} className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      aria-label={`Nome do contato ${i + 1}`}
                      placeholder="Nome"
                      className="field"
                      value={contact.name}
                      onChange={(e) => {
                        const contacts = [...form.contacts];
                        contacts[i] = { ...contact, name: e.target.value };
                        setForm({ ...form, contacts });
                      }}
                    />
                    <input
                      aria-label={`Cargo do contato ${i + 1}`}
                      placeholder="Cargo"
                      className="field"
                      value={contact.role}
                      onChange={(e) => {
                        const contacts = [...form.contacts];
                        contacts[i] = { ...contact, role: e.target.value };
                        setForm({ ...form, contacts });
                      }}
                    />
                  </div>
                ))}
                {form.contacts.length < 6 && (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-forest-600"
                    onClick={() => setForm({ ...form, contacts: [...form.contacts, { name: '', role: '', email: '', phone: '' }] })}
                  >
                    + Adicionar contato
                  </button>
                )}
              </fieldset>

              {error && <Alert kind="error">{error}</Alert>}
              {ok && <Alert kind="ok">{ok}</Alert>}

              <button type="submit" className="btn-primary w-full" disabled={pending}>
                {pending ? <Spinner label="Salvando…" /> : 'Criar cliente'}
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
