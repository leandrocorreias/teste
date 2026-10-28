/**
 * Renderer-side guard rails.
 *
 * The model may propose any layout + content. Before rendering, we check the
 * content against each layout's text budget. Over-budget pages are SPLIT or
 * downgraded to a layout that fits — never silently clipped.
 */
import { type SlidePage, type LayoutId } from './schema';
import { contrastRatio, type DesignTokens } from './tokens';

export interface LayoutWarning {
  pageIndex: number;
  layoutId: LayoutId;
  code: 'TEXT_OVER_BUDGET' | 'SPLIT_APPLIED' | 'LAYOUT_DOWNGRADED' | 'LOW_CONTRAST' | 'MIN_FONT';
  message: string;
}

/** Characters a layout can hold in its body region at the minimum readable size. */
export const TEXT_BUDGET: Record<LayoutId, number> = {
  cover: 260,
  chapter: 420,
  'editorial-split': 1150,
  'metric-grid': 900,
  comparison: 980,
  timeline: 900,
  matrix: 1250,
  'key-insight': 620,
  roadmap: 1000,
  bullets: 1050,
  closing: 760,
};

function pageTextLength(page: SlidePage): number {
  const parts: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  const { layoutId: _layoutId, ...rest } = page as Record<string, unknown>;
  walk(rest);
  return parts.join(' ').length;
}

/**
 * Splits an over-budget page where the archetype allows it, otherwise
 * downgrades it to a layout with a larger budget.
 */
export function fitPages(pages: SlidePage[]): { pages: SlidePage[]; warnings: LayoutWarning[] } {
  const warnings: LayoutWarning[] = [];
  const out: SlidePage[] = [];

  pages.forEach((page, index) => {
    const budget = TEXT_BUDGET[page.layoutId];
    const length = pageTextLength(page);
    if (length <= budget) {
      out.push(page);
      return;
    }

    warnings.push({
      pageIndex: index,
      layoutId: page.layoutId,
      code: 'TEXT_OVER_BUDGET',
      message: `Conteúdo com ${length} caracteres excede o limite de ${budget} do layout "${page.layoutId}".`,
    });

    if (page.layoutId === 'editorial-split' && page.paragraphs.length > 1) {
      const half = Math.ceil(page.paragraphs.length / 2);
      out.push({ ...page, paragraphs: page.paragraphs.slice(0, half) });
      out.push({
        ...page,
        title: `${page.title} (continuação)`,
        paragraphs: page.paragraphs.slice(half),
        pullQuote: undefined,
      });
      warnings.push({
        pageIndex: index,
        layoutId: page.layoutId,
        code: 'SPLIT_APPLIED',
        message: 'Página dividida em duas para preservar o tamanho mínimo de fonte.',
      });
      return;
    }

    if (page.layoutId === 'bullets' && page.bullets.length > 3) {
      const half = Math.ceil(page.bullets.length / 2);
      out.push({ ...page, bullets: page.bullets.slice(0, half) });
      out.push({ ...page, title: `${page.title} (continuação)`, lead: undefined, bullets: page.bullets.slice(half) });
      warnings.push({ pageIndex: index, layoutId: page.layoutId, code: 'SPLIT_APPLIED', message: 'Tópicos divididos em duas páginas.' });
      return;
    }

    if (page.layoutId === 'matrix' && page.rows.length > 4) {
      const half = Math.ceil(page.rows.length / 2);
      out.push({ ...page, rows: page.rows.slice(0, half) });
      out.push({ ...page, title: `${page.title} (continuação)`, rows: page.rows.slice(half), note: undefined });
      warnings.push({ pageIndex: index, layoutId: page.layoutId, code: 'SPLIT_APPLIED', message: 'Tabela dividida em duas páginas.' });
      return;
    }

    if (page.layoutId === 'key-insight') {
      out.push({
        layoutId: 'editorial-split',
        kicker: page.kicker,
        title: page.statement.slice(0, 118),
        paragraphs: page.support.length ? page.support : [page.statement],
        side: 'right',
        evidenceType: page.evidenceType,
        sourceRefs: page.sourceRefs,
      });
      warnings.push({
        pageIndex: index,
        layoutId: page.layoutId,
        code: 'LAYOUT_DOWNGRADED',
        message: 'Insight muito longo: reconvertido para split editorial.',
      });
      return;
    }

    // No split rule for this archetype: keep it, but the warning is surfaced
    // in the UI and persisted with the document version.
    out.push(page);
  });

  return { pages: out, warnings };
}

export function checkTheme(tokens: DesignTokens): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];
  const pairs: Array<[string, string, string]> = [
    [tokens.colors.ink, tokens.colors.bg, 'texto principal sobre fundo'],
    [tokens.colors.inkMute, tokens.colors.bg, 'texto auxiliar sobre fundo'],
    [tokens.colors.chapterInk, tokens.colors.chapterBg, 'texto de capítulo'],
    [tokens.colors.accentInk, tokens.colors.accent, 'texto sobre acento'],
  ];
  for (const [fg, bg, label] of pairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio < 4.5) {
      warnings.push({
        pageIndex: -1,
        layoutId: 'cover',
        code: 'LOW_CONTRAST',
        message: `Contraste insuficiente (${ratio.toFixed(2)}:1) em ${label}. Mínimo WCAG AA: 4.5:1.`,
      });
    }
  }
  if (tokens.type.minBodyPx < 12) {
    warnings.push({
      pageIndex: -1,
      layoutId: 'cover',
      code: 'MIN_FONT',
      message: `Tamanho mínimo de corpo (${tokens.type.minBodyPx}px) abaixo do piso de legibilidade de 12px.`,
    });
  }
  return warnings;
}
