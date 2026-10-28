/**
 * Instfy design tokens.
 *
 * Derived as original design *principles* from the reference material
 * (warm off-white paper, deep forest green, lime signal accent, restrained
 * bronze client accent, geometric sans, wide-tracked kickers). No reference
 * page is reused as artwork.
 */

export type ThemeId = 'instfy-light' | 'instfy-dark' | 'instfy-client';

export interface DesignTokens {
  id: ThemeId;
  name: string;
  colors: {
    bg: string;
    bgAlt: string;
    surface: string;
    ink: string;
    inkSoft: string;
    inkMute: string;
    accent: string;
    accentInk: string;
    rule: string;
    chapterBg: string;
    chapterInk: string;
  };
  type: {
    displayFamily: string;
    sansFamily: string;
    /** Minimum rendered size in px for any body text. Enforced by the validator. */
    minBodyPx: number;
    baseBodyPx: number;
  };
  layout: {
    /** Slide canvas in px at 1x. 16:9. */
    slideW: number;
    slideH: number;
    marginPx: number;
  };
}

export const THEMES: Record<ThemeId, DesignTokens> = {
  'instfy-light': {
    id: 'instfy-light',
    name: 'Instfy Claro',
    colors: {
      bg: '#F7F6F1',
      bgAlt: '#EFEDE5',
      surface: '#FFFFFF',
      ink: '#14201B',
      inkSoft: '#3A4A43',
      inkMute: '#5B6C64',
      accent: '#A8D92A',
      accentInk: '#14201B',
      rule: '#DEDBD0',
      chapterBg: '#0E2A20',
      chapterInk: '#F7F6F1',
    },
    type: {
      displayFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
      sansFamily: "'Inter', system-ui, sans-serif",
      minBodyPx: 13,
      baseBodyPx: 16,
    },
    layout: { slideW: 1280, slideH: 720, marginPx: 72 },
  },
  'instfy-dark': {
    id: 'instfy-dark',
    name: 'Instfy Escuro',
    colors: {
      bg: '#0A1F18',
      bgAlt: '#0E2A20',
      surface: '#123528',
      ink: '#F2F5F0',
      inkSoft: '#C6D2CB',
      inkMute: '#8EA398',
      accent: '#C3F53C',
      accentInk: '#0A1F18',
      rule: '#1F4435',
      chapterBg: '#061612',
      chapterInk: '#F2F5F0',
    },
    type: {
      displayFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
      sansFamily: "'Inter', system-ui, sans-serif",
      minBodyPx: 13,
      baseBodyPx: 16,
    },
    layout: { slideW: 1280, slideH: 720, marginPx: 72 },
  },
  'instfy-client': {
    id: 'instfy-client',
    name: 'Instfy + Acento do cliente',
    colors: {
      bg: '#F7F6F1',
      bgAlt: '#F0ECE2',
      surface: '#FFFFFF',
      ink: '#14201B',
      inkSoft: '#3A4A43',
      inkMute: '#5B6C64',
      accent: '#C2A26B',
      accentInk: '#14201B',
      rule: '#E2D3B5',
      chapterBg: '#123528',
      chapterInk: '#F7F6F1',
    },
    type: {
      displayFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
      sansFamily: "'Inter', system-ui, sans-serif",
      minBodyPx: 13,
      baseBodyPx: 16,
    },
    layout: { slideW: 1280, slideH: 720, marginPx: 72 },
  },
};

export interface BrandKitTokens {
  themeId: ThemeId;
  /** Optional client accent override, applied only to the 'instfy-client' theme. */
  clientAccent?: string;
  clientName?: string;
  /** Logo lockup position on the cover. */
  logoPlacement: 'top-left' | 'top-right' | 'bottom-left';
  footerLine?: string;
}

export const DEFAULT_BRAND_KIT: BrandKitTokens = {
  themeId: 'instfy-light',
  logoPlacement: 'top-left',
  footerLine: 'Instfy Brasil Ltda · instfy.com',
};

export function resolveTokens(themeId: ThemeId, brand?: Partial<BrandKitTokens>): DesignTokens {
  const base = THEMES[themeId] ?? THEMES['instfy-light'];
  if (themeId === 'instfy-client' && brand?.clientAccent) {
    return {
      ...base,
      colors: { ...base.colors, accent: brand.clientAccent, rule: brand.clientAccent + '55' },
    };
  }
  return base;
}

/** CSS custom properties consumed by both the on-screen preview and print HTML. */
export function tokensToCssVars(t: DesignTokens): Record<string, string> {
  return {
    '--c-bg': t.colors.bg,
    '--c-bg-alt': t.colors.bgAlt,
    '--c-surface': t.colors.surface,
    '--c-ink': t.colors.ink,
    '--c-ink-soft': t.colors.inkSoft,
    '--c-ink-mute': t.colors.inkMute,
    '--c-accent': t.colors.accent,
    '--c-accent-ink': t.colors.accentInk,
    '--c-rule': t.colors.rule,
    '--c-chapter-bg': t.colors.chapterBg,
    '--c-chapter-ink': t.colors.chapterInk,
    '--f-display': t.type.displayFamily,
    '--f-sans': t.type.sansFamily,
    '--s-min-body': `${t.type.minBodyPx}px`,
    '--s-body': `${t.type.baseBodyPx}px`,
    '--s-margin': `${t.layout.marginPx}px`,
  };
}

/** WCAG relative luminance, used by the contrast guard. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
