/**
 * Artifact storage.
 *
 * Generated PDFs/PPTX live OUTSIDE /public and are served only through a guarded
 * route that resolves a DocumentVersion id to a stored path. User-supplied text
 * never reaches the filesystem unsanitised.
 */
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const ARTIFACT_DIR = path.resolve(process.env.ARTIFACT_DIR || './storage/artifacts');

/** Collapses any string to a safe, lowercase, path-free slug. */
export function safeSlug(input: string, fallback = 'documento'): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Sanitises a filename while preserving a single known extension, so
 * "proposta v1.pdf" becomes "proposta-v1.pdf" rather than "proposta-v1-pdf".
 */
const ALLOWED_EXTENSIONS = new Set(['pdf', 'pptx', 'png', 'json', 'html']);

export function safeFileName(input: string, fallback = 'documento'): string {
  const dot = input.lastIndexOf('.');
  if (dot > 0) {
    const ext = input.slice(dot + 1).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      return `${safeSlug(input.slice(0, dot), fallback)}.${ext}`;
    }
  }
  return safeSlug(input, fallback);
}

export async function ensureArtifactDir(): Promise<string> {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  return ARTIFACT_DIR;
}

/**
 * Builds an absolute path inside ARTIFACT_DIR. Rejects traversal attempts.
 * The last segment is treated as a filename and keeps its extension.
 */
export function artifactPath(...segments: string[]): string {
  const safe = segments.map((s, i) => (i === segments.length - 1 ? safeFileName(s) : safeSlug(s)));
  const resolved = path.resolve(ARTIFACT_DIR, ...safe);
  const relative = path.relative(ARTIFACT_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Caminho de artefato fora do diretório permitido.');
  }
  return resolved;
}

/** Verifies a stored path still lives under ARTIFACT_DIR before serving it. */
export function assertInsideArtifactDir(filePath: string): string {
  const resolved = path.resolve(filePath);
  const relative = path.relative(ARTIFACT_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Acesso negado: arquivo fora do diretório de artefatos.');
  }
  return resolved;
}

/** Creates the parent directory of an artifact path, inside ARTIFACT_DIR only. */
export async function ensureParentDir(filePath: string): Promise<void> {
  const resolved = assertInsideArtifactDir(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
}

export async function fileSize(filePath: string): Promise<number | null> {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return null;
  }
}
