import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { slidePage, type SlidePage } from '@/lib/design/schema';
import type { ThemeId } from '@/lib/design/tokens';
import { buildPresentationPptx } from '@/lib/pptx';
import { safeFileName, safeSlug } from '@/lib/artifacts';

export const maxDuration = 60;

/**
 * Streams an editable PPTX built from a stored DocumentVersion's pages.
 *
 * Nothing is written to disk, so this works on serverless hosts where the
 * artifact directory does not persist between invocations.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = await prisma.documentVersion.findUnique({
    where: { id },
    include: {
      pages: { orderBy: { orderIndex: 'asc' } },
      document: { include: { project: { include: { client: true } } } },
    },
  });
  if (!version) return NextResponse.json({ error: 'Versão de documento não encontrada' }, { status: 404 });
  if (version.document.deletedAt) return NextResponse.json({ error: 'Documento removido' }, { status: 410 });
  if (version.document.kind !== 'presentation') {
    return NextResponse.json({ error: 'Apenas apresentações podem ser exportadas em PPTX.' }, { status: 400 });
  }

  const pages: SlidePage[] = [];
  for (const row of version.pages) {
    const parsed = slidePage.safeParse(JSON.parse(row.contentJson));
    if (parsed.success) pages.push(parsed.data);
  }
  if (pages.length === 0) {
    return NextResponse.json({ error: 'Esta versão não possui páginas armazenadas.' }, { status: 409 });
  }

  const spec = JSON.parse(version.specJson || '{}') as { title?: string; demoMode?: boolean };
  const clientName = version.document.project?.client.name ?? 'Cliente';

  const buffer = await buildPresentationPptx(pages, {
    themeId: (version.theme as ThemeId) ?? 'instfy-light',
    clientName,
    title: spec.title ?? version.document.title,
    demoMode: Boolean(spec.demoMode),
  });

  const filename = safeFileName(
    `${safeSlug(clientName)}-${safeSlug(version.document.title)}-v${version.version}.pptx`,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'content-length': String(buffer.length),
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
