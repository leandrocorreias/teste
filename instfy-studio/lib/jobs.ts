/**
 * Durable local job model.
 *
 * Generation requests are persisted as GenerationJob rows and executed in the
 * background, so the UI never blocks on Chromium. Jobs retry with backoff and
 * surface their error text to the operator.
 */
import { prisma } from './db';

export type JobKind = 'presentation_pdf' | 'proposal_pdf' | 'presentation_pptx';

export async function enqueue(kind: JobKind, payload: Record<string, unknown>, opts: { projectId?: string; documentId?: string } = {}) {
  return prisma.generationJob.create({
    data: {
      kind,
      projectId: opts.projectId ?? null,
      documentId: opts.documentId ?? null,
      payloadJson: JSON.stringify(payload),
      status: 'queued',
    },
  });
}

export async function markRunning(jobId: string) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 }, error: null },
  });
}

export async function markDone(jobId: string, result: Record<string, unknown>) {
  return prisma.generationJob.update({
    where: { id: jobId },
    data: { status: 'done', finishedAt: new Date(), resultJson: JSON.stringify(result), error: null },
  });
}

export async function markFailed(jobId: string, error: string) {
  const job = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  const exhausted = job.attempts >= job.maxAttempts;
  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? 'failed' : 'queued',
      finishedAt: exhausted ? new Date() : null,
      error: error.slice(0, 1000),
    },
  });
}

export function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt * 1000, 15_000);
}

/** Runs a job to completion in the background, retrying transient failures. */
export async function runJob(jobId: string, work: () => Promise<Record<string, unknown>>): Promise<void> {
  for (;;) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'done' || job.status === 'failed') return;
    await markRunning(jobId);
    try {
      const result = await work();
      await markDone(jobId, result);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated = await markFailed(jobId, message);
      if (updated.status === 'failed') return;
      await new Promise((r) => setTimeout(r, backoffMs(updated.attempts)));
    }
  }
}
