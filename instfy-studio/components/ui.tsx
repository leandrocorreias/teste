'use client';

import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';

export function Alert({ kind, children }: { kind: 'error' | 'warn' | 'ok' | 'info'; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    error: 'bg-[#FBE4E0] text-[#8E2B1E]',
    warn: 'bg-[#F7E9D9] text-[#7A3F10]',
    ok: 'bg-[#E6F0E3] text-[#14401F]',
    info: 'bg-paper-alt text-ink-soft',
  };
  return <div className={`px-4 py-3 text-sm leading-relaxed ${styles[kind]}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-mute">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-paper-line border-t-forest-600" />
      {label}
    </span>
  );
}

export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>, successMessage?: string): Promise<T | null> {
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const result = await fn();
      if (successMessage) setOk(successMessage);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, ok, setError, setOk, run };
}

/** Thin fetch wrapper that surfaces API error messages instead of swallowing them. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  // Next.js does not prefix fetch URLs with basePath; do it here, once.
  const res = await fetch(withBasePath(url), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Resposta inválida do servidor (${res.status}).`);
  }
  if (!res.ok) {
    const message = (json as { error?: string } | null)?.error ?? `Erro ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}
