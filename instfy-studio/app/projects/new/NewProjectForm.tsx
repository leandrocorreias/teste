'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SECTORS } from '@/lib/questionnaire';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';

export function NewProjectForm({
  clients,
  preselected,
}: {
  clients: Array<{ id: string; name: string; sector: string }>;
  preselected?: string;
}) {
  const router = useRouter();
  const initialClient = clients.find((c) => c.id === preselected) ?? clients[0];
  const [clientId, setClientId] = useState(initialClient.id);
  const [name, setName] = useState('');
  const [sector, setSector] = useState(initialClient.sector);
  const [summary, setSummary] = useState('');
  const { pending, error, run } = useAsyncAction();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await run(() =>
      api<{ project: { id: string } }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ clientId, name, sector, summary }),
      }),
    );
    if (created) router.push(`/projects/${created.project.id}/discovery`);
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-4 p-6">
      <div>
        <label className="label" htmlFor="clientId">Cliente *</label>
        <select
          id="clientId"
          className="field mt-1"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            const client = clients.find((c) => c.id === e.target.value);
            if (client) setSector(client.sector);
          }}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">Nome do projeto *</label>
        <input
          id="name"
          required
          minLength={3}
          className="field mt-1"
          placeholder="Ex.: Posicionamento, experiência e crescimento"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="sector">Setor do projeto *</label>
        <select id="sector" className="field mt-1" value={sector} onChange={(e) => setSector(e.target.value)}>
          {SECTORS.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-mute">O setor define quais perguntas condicionais aparecem no questionário.</p>
      </div>
      <div>
        <label className="label" htmlFor="summary">Resumo interno</label>
        <textarea id="summary" rows={3} className="field mt-1" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? <Spinner label="Criando…" /> : 'Criar projeto e abrir discovery'}
      </button>
    </form>
  );
}
