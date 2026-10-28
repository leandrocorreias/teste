import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.generationJob.findUnique({
    where: { id },
    include: { document: { include: { versions: { orderBy: { version: 'desc' }, take: 1 } } } },
  });
  if (!job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
  const latest = job.document?.versions[0];
  return NextResponse.json({
    id: job.id,
    kind: job.kind,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    error: job.error,
    result: job.resultJson ? JSON.parse(job.resultJson) : null,
    documentVersionId: latest?.id ?? null,
    downloadUrl: latest?.filePath ? `/api/documents/${latest.id}/file` : null,
  });
}
