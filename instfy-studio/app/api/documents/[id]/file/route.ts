import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';
import { assertInsideArtifactDir, safeSlug } from '@/lib/artifacts';

/**
 * Guarded artifact download.
 *
 * The client supplies only a DocumentVersion id; the path comes from the
 * database and is re-verified to live inside ARTIFACT_DIR before any read.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = await prisma.documentVersion.findUnique({
    where: { id },
    include: { document: { include: { project: { include: { client: true } } } } },
  });
  if (!version) return NextResponse.json({ error: 'Versão de documento não encontrada' }, { status: 404 });
  if (version.document.deletedAt) return NextResponse.json({ error: 'Documento removido' }, { status: 410 });
  if (!version.filePath) {
    return NextResponse.json({ error: 'O arquivo ainda não foi gerado para esta versão.' }, { status: 409 });
  }

  let resolved: string;
  try {
    resolved = assertInsideArtifactDir(version.filePath);
  } catch {
    return NextResponse.json({ error: 'Caminho de arquivo inválido.' }, { status: 403 });
  }

  let data: Buffer;
  try {
    data = await readFile(resolved);
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado no armazenamento local.' }, { status: 404 });
  }

  const extension = path.extname(resolved) || '.pdf';
  const mime =
    extension === '.pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : extension === '.png'
        ? 'image/png'
        : 'application/pdf';
  const filename = `${safeSlug(version.document.project?.client.name ?? 'instfy')}-${safeSlug(
    version.document.title,
  )}-v${version.version}${extension}`;

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'content-type': mime,
      'content-length': String(data.length),
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
