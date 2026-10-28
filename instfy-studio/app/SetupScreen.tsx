'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InstfyLockup } from '@/components/InstfyMark';

/**
 * First-run screen for an empty database.
 *
 * Shown instead of the dashboard when no organization exists yet. Seeding from
 * here needs no secret precisely because the database is empty; once it holds
 * an organization, the same route demands BOOTSTRAP_SECRET.
 */
export function SetupScreen() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ services: number; clients: number; layouts: number } | null>(null);

  async function initialise() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/bootstrap', { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Erro ${res.status}`);
      setResult(body.seeded);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <InstfyLockup size={26} />
        <div className="mt-8 h-2 w-12 bg-lime-600" />
        <h1 className="mt-6 font-display text-3xl font-normal tracking-[-0.03em] text-ink">
          Inicializar o Intelligence Studio
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          O banco desta instalação está vazio. Ao inicializar, são criados a organização Instfy, a biblioteca de layouts, o
          questionário de discovery e um catálogo de serviços de partida.
        </p>
        <div className="mt-6 border-l-2 border-paper-line pl-4 text-xs leading-relaxed text-ink-mute">
          Os valores do catálogo são <strong>exemplos</strong> retirados de propostas anteriores da Instfy (Muscle Up, MYO e
          comunicação digital), com a origem anotada em cada serviço. Não são uma tabela de preços — revise antes de emitir
          qualquer proposta.
        </div>

        {error && (
          <div className="mt-6 bg-[#FBE4E0] px-4 py-3 text-sm text-[#8E2B1E]">{error}</div>
        )}
        {result && (
          <div className="mt-6 bg-[#E6F0E3] px-4 py-3 text-sm text-[#14401F]">
            Pronto: {result.services} serviços, {result.clients} clientes de demonstração e {result.layouts} layouts.
          </div>
        )}

        <button onClick={initialise} className="btn-primary mt-8 self-start" disabled={pending || Boolean(result)}>
          {pending ? 'Inicializando…' : result ? 'Inicializado' : 'Inicializar agora'}
        </button>

        {result && (
          <button onClick={() => router.refresh()} className="btn-ghost mt-3 self-start">
            Abrir o painel
          </button>
        )}
      </div>
    </div>
  );
}
