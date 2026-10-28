import { describe, expect, it } from 'vitest';
import { fitPages, checkTheme, TEXT_BUDGET } from '../lib/design/validate';
import { THEMES, contrastRatio, resolveTokens } from '../lib/design/tokens';
import { presentationSpec, slidePage, LAYOUT_CATALOG } from '../lib/design/schema';

describe('layout catalog', () => {
  it('ships at least 10 distinct page archetypes', () => {
    const ids = new Set(LAYOUT_CATALOG.map((l) => l.layoutId));
    expect(ids.size).toBeGreaterThanOrEqual(10);
  });

  it('declares a text budget for every archetype', () => {
    for (const l of LAYOUT_CATALOG) {
      expect(TEXT_BUDGET[l.layoutId]).toBeGreaterThan(0);
    }
  });
});

describe('schema validation', () => {
  it('rejects a page with an unknown layout id', () => {
    const r = slidePage.safeParse({ layoutId: 'freeform-html', html: '<script>x</script>' });
    expect(r.success).toBe(false);
  });

  it('rejects content that exceeds a hard field limit', () => {
    const r = slidePage.safeParse({
      layoutId: 'key-insight',
      statement: 'x'.repeat(400),
    });
    expect(r.success).toBe(false);
  });

  it('accepts a well-formed deck', () => {
    const r = presentationSpec.safeParse({
      title: 'Estratégia de posicionamento',
      clientName: 'Exemplo',
      themeId: 'instfy-light',
      pages: [
        { layoutId: 'cover', title: 'Estratégia', clientName: 'Exemplo', preparedFor: [] },
        { layoutId: 'chapter', numeral: 'I', title: 'Contexto' },
        { layoutId: 'closing', title: 'Próximo passo', nextSteps: [] },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe('overflow handling', () => {
  it('splits an over-budget editorial page instead of clipping it', () => {
    const long = 'a'.repeat(600);
    const { pages, warnings } = fitPages([
      {
        layoutId: 'editorial-split',
        title: 'Longa',
        paragraphs: [long, long],
        side: 'right',
        evidenceType: 'INFERENCE',
        sourceRefs: [],
      },
    ]);
    expect(pages).toHaveLength(2);
    expect(warnings.map((w) => w.code)).toContain('SPLIT_APPLIED');
  });

  it('downgrades an over-long key insight to an editorial split', () => {
    const { pages, warnings } = fitPages([
      {
        layoutId: 'key-insight',
        statement: 'b'.repeat(210),
        support: ['c'.repeat(210), 'd'.repeat(210), 'e'.repeat(210)],
        evidenceType: 'HYPOTHESIS',
        sourceRefs: [],
      },
    ]);
    expect(pages[0].layoutId).toBe('editorial-split');
    expect(warnings.map((w) => w.code)).toContain('LAYOUT_DOWNGRADED');
  });

  it('leaves within-budget pages untouched', () => {
    const { pages, warnings } = fitPages([
      { layoutId: 'chapter', numeral: 'I', title: 'Contexto', lead: 'Curto.' },
    ]);
    expect(pages).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it('splits a long table across pages', () => {
    const { pages } = fitPages([
      {
        layoutId: 'matrix',
        title: 'Concorrência',
        headers: ['Categoria', 'Força', 'Oportunidade'],
        rows: Array.from({ length: 8 }, () => ['a'.repeat(60), 'b'.repeat(60), 'c'.repeat(60)]),
        evidenceType: 'SIGNAL',
        sourceRefs: [],
      },
    ]);
    expect(pages).toHaveLength(2);
  });
});

describe('theme accessibility', () => {
  it('every shipped theme passes WCAG AA for body text', () => {
    for (const theme of Object.values(THEMES)) {
      expect(checkTheme(theme)).toEqual([]);
    }
  });

  it('computes known contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 2);
  });

  it('applies a client accent only to the client theme', () => {
    const client = resolveTokens('instfy-client', { clientAccent: '#C2A26B' });
    expect(client.colors.accent).toBe('#C2A26B');
    const light = resolveTokens('instfy-light', { clientAccent: '#FF0000' });
    expect(light.colors.accent).toBe(THEMES['instfy-light'].colors.accent);
  });
});
