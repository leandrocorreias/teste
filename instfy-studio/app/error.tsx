'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="h-2 w-10 bg-lime-600" />
      <h1 className="mt-5 font-display text-2xl font-normal text-ink">Algo falhou nesta tela</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{error.message}</p>
      {error.digest && <p className="mt-1 font-mono text-xs text-ink-mute">digest: {error.digest}</p>}
      <button onClick={reset} className="btn-primary mt-6">Tentar novamente</button>
    </div>
  );
}
