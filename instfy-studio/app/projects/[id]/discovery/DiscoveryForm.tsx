'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dimension, Completion } from '@/lib/questionnaire';
import { Alert, Spinner, api, useAsyncAction } from '@/components/ui';

type AnswerMap = Record<string, string | number | string[] | null>;

export function DiscoveryForm({
  projectId,
  dimensions,
  initialAnswers,
  submissionStatus,
  formVersion,
}: {
  projectId: string;
  dimensions: Dimension[];
  initialAnswers: AnswerMap;
  submissionStatus: string;
  formVersion: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  const [openDimension, setOpenDimension] = useState<string>(dimensions[0]?.id ?? '');
  const { pending, error, ok, run } = useAsyncAction();

  // Recomputed with the same pure function the server uses, so the progress bar
  // and the server's stored completion never disagree.
  const sectorQuestionIds = useMemo(() => new Set(dimensions.flatMap((d) => d.questions.map((q) => q.id))), [dimensions]);
  const completion = useMemo(() => {
    const total = sectorQuestionIds.size;
    const base = computeCompletionLocal(dimensions, answers);
    return { ...base, total };
  }, [dimensions, answers, sectorQuestionIds]);

  function setAnswer(questionId: string, value: AnswerMap[string]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function save(submit: boolean) {
    const result = await run(
      () =>
        api<{ completion: Completion }>(`/api/projects/${projectId}/discovery`, {
          method: 'POST',
          body: JSON.stringify({ answers, submit }),
        }),
      submit ? 'Questionário enviado. Siga para a análise.' : 'Respostas salvas.',
    );
    if (result) router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {dimensions.map((dimension) => {
          const isOpen = openDimension === dimension.id;
          const answeredHere = dimension.questions.filter((q) => isFilled(answers[q.id])).length;
          return (
            <section key={dimension.id} className="card">
              <button
                type="button"
                onClick={() => setOpenDimension(isOpen ? '' : dimension.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span>
                  <span className="font-display text-base font-medium text-ink">{dimension.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-mute">{dimension.intent}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-semibold text-ink-mute">
                    {answeredHere}/{dimension.questions.length}
                  </span>
                  <span className={`h-1.5 w-10 ${answeredHere === dimension.questions.length ? 'bg-lime-600' : 'bg-paper-line'}`} />
                  <span className="text-ink-mute">{isOpen ? '−' : '+'}</span>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-5 border-t border-paper-line px-5 py-5">
                  {dimension.questions.map((q) => (
                    <div key={q.id}>
                      <label className="label flex items-center gap-2" htmlFor={q.id}>
                        <span>{q.label}</span>
                        {q.critical && (
                          <span className="bg-paper-alt px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-kicker text-ink-mute">
                            crítica
                          </span>
                        )}
                      </label>
                      {q.help && <p className="mt-1 text-xs leading-relaxed text-ink-mute">{q.help}</p>}
                      <div className="mt-1.5">{renderInput(q, answers[q.id], setAnswer)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="card p-5">
          <div className="kicker">Progresso</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl font-light tracking-[-0.04em] text-ink">{completion.pct}%</span>
            <span className="text-xs text-ink-mute">
              {completion.answered} de {completion.total} respostas
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-paper-line" role="progressbar" aria-valuenow={completion.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-lime-600 transition-all" style={{ width: `${completion.pct}%` }} />
          </div>
          <div className="mt-4 text-xs text-ink-mute">
            Formulário v{formVersion} · {submissionStatus === 'submitted' ? 'enviado' : submissionStatus === 'draft' ? 'rascunho salvo' : 'não iniciado'}
          </div>
        </div>

        <div className="card p-5">
          <div className="kicker">Dados críticos</div>
          <div className="mt-2 text-sm font-semibold text-ink">
            {completion.criticalAnswered} de {completion.criticalTotal} preenchidos
          </div>
          {completion.missingCritical.length > 0 ? (
            <>
              <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                Estes campos aparecem como <strong>lacunas declaradas</strong> nos documentos. Nada é estimado no lugar deles.
              </p>
              <ul className="mt-3 space-y-1.5">
                {completion.missingCritical.map((m) => (
                  <li key={m.questionId} className="text-xs text-[#7A3F10]">
                    <span className="font-semibold">{m.dimension}:</span> {m.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-xs text-[#14401F]">Todos os dados críticos foram preenchidos.</p>
          )}
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {ok && <Alert kind="ok">{ok}</Alert>}

        <div className="space-y-2">
          <button type="button" onClick={() => save(false)} className="btn-ghost w-full" disabled={pending}>
            {pending ? <Spinner label="Salvando…" /> : 'Salvar rascunho'}
          </button>
          <button type="button" onClick={() => save(true)} className="btn-primary w-full" disabled={pending}>
            Enviar questionário
          </button>
        </div>
      </aside>
    </div>
  );
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value);
}

function computeCompletionLocal(dimensions: Dimension[], answers: AnswerMap) {
  const questions = dimensions.flatMap((d) => d.questions.map((q) => ({ q, dimension: d.name })));
  const answered = questions.filter(({ q }) => isFilled(answers[q.id])).length;
  const criticals = questions.filter(({ q }) => q.critical);
  const missingCritical = criticals
    .filter(({ q }) => !isFilled(answers[q.id]))
    .map(({ q, dimension }) => ({ questionId: q.id, label: q.label, dimension }));
  return {
    answered,
    total: questions.length,
    pct: questions.length === 0 ? 0 : Math.round((answered / questions.length) * 100),
    missingCritical,
    criticalTotal: criticals.length,
    criticalAnswered: criticals.length - missingCritical.length,
  };
}

function renderInput(
  q: Dimension['questions'][number],
  value: AnswerMap[string],
  setAnswer: (id: string, v: AnswerMap[string]) => void,
) {
  switch (q.type) {
    case 'longtext':
      return (
        <textarea id={q.id} rows={3} className="field" placeholder={q.placeholder} value={(value as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} />
      );
    case 'single':
      return (
        <select id={q.id} className="field" value={(value as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)}>
          <option value="">Não informado</option>
          {(q.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case 'multi': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={q.id}>
          {(q.options ?? []).map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => setAnswer(q.id, on ? selected.filter((s) => s !== o) : [...selected, o])}
                className={`border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on ? 'border-forest-800 bg-forest-800 text-paper' : 'border-paper-line bg-white text-ink-soft hover:border-forest-600'
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            id={q.id}
            type="number"
            className="field"
            placeholder={q.placeholder}
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => setAnswer(q.id, e.target.value === '' ? null : Number(e.target.value))}
          />
          {q.unit && <span className="shrink-0 text-xs text-ink-mute">{q.unit}</span>}
        </div>
      );
    case 'currency':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-mute">R$</span>
          <input id={q.id} inputMode="decimal" className="field" placeholder="0,00" value={(value as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} />
        </div>
      );
    case 'url':
      return <input id={q.id} type="url" className="field" placeholder="https://" value={(value as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} />;
    case 'attachment':
      return (
        <textarea
          id={q.id}
          rows={2}
          className="field"
          placeholder="Liste os materiais entregues fora do sistema (upload de arquivos não está habilitado neste MVP)."
          value={(value as string) ?? ''}
          onChange={(e) => setAnswer(q.id, e.target.value)}
        />
      );
    default:
      return <input id={q.id} className="field" placeholder={q.placeholder} value={(value as string) ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} />;
  }
}
