import { describe, expect, it } from 'vitest';
import { artifactPath, assertInsideArtifactDir, safeFileName, safeSlug, ARTIFACT_DIR } from '../lib/artifacts';
import path from 'node:path';

describe('filename sanitisation', () => {
  it('strips accents, spaces and punctuation', () => {
    expect(safeSlug('Proposta Comercial — Myo Training & Wellness')).toBe('proposta-comercial-myo-training-wellness');
    expect(safeSlug('Estratégia 2027')).toBe('estrategia-2027');
  });

  it('neutralises path traversal in names', () => {
    expect(safeSlug('../../etc/passwd')).toBe('etc-passwd');
    expect(safeSlug('/absolute/path')).toBe('absolute-path');
    expect(safeSlug('a\\b\\c')).toBe('a-b-c');
  });

  it('falls back when nothing survives sanitisation', () => {
    expect(safeSlug('...///')).toBe('documento');
    expect(safeSlug('')).toBe('documento');
  });
});

describe('artifact path containment', () => {
  it('keeps built paths inside the artifact directory', () => {
    const p = artifactPath('cliente', 'documento.pdf');
    expect(p.startsWith(ARTIFACT_DIR)).toBe(true);
  });

  it('cannot be escaped through traversal segments', () => {
    const p = artifactPath('../../../etc', 'passwd');
    // Traversal segments are flattened into harmless name parts, so the file
    // lands inside the artifact dir rather than at the filesystem root.
    expect(path.relative(ARTIFACT_DIR, p)).toBe(path.join('etc', 'passwd'));
    expect(p).toBe(path.join(ARTIFACT_DIR, 'etc', 'passwd'));
  });

  it('rejects serving a file stored outside the artifact directory', () => {
    expect(() => assertInsideArtifactDir('/etc/passwd')).toThrow();
    expect(() => assertInsideArtifactDir(path.join(ARTIFACT_DIR, 'ok.pdf'))).not.toThrow();
  });
});

describe('filename extensions', () => {
  it('preserves a known extension through sanitisation', () => {
    expect(safeFileName('Proposta Comercial v1.pdf')).toBe('proposta-comercial-v1.pdf');
    expect(safeFileName('apresentação — estratégia.PDF')).toBe('apresentacao-estrategia.pdf');
    expect(safeFileName('deck.pptx')).toBe('deck.pptx');
    expect(safeFileName('page-1.png')).toBe('page-1.png');
  });

  it('does not invent an extension for unknown suffixes', () => {
    expect(safeFileName('arquivo.exe')).toBe('arquivo-exe');
    expect(safeFileName('sem-extensao')).toBe('sem-extensao');
  });

  it('keeps the extension on the last segment of an artifact path', () => {
    const p = artifactPath('Cliente Exemplo', 'proposta v2.pdf');
    expect(p).toBe(path.join(ARTIFACT_DIR, 'cliente-exemplo', 'proposta-v2.pdf'));
  });
});
