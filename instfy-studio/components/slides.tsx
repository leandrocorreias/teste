/**
 * Deterministic slide renderers.
 *
 * One pure function per layout archetype. The AI never supplies markup; it
 * supplies validated content and a layoutId, and these components decide every
 * element, size and colour. Shared by the on-screen preview and the print HTML
 * so what you see is what the PDF contains.
 */
import type { CSSProperties, ReactNode } from 'react';
import { EVIDENCE_LABELS, type EvidenceTypeT, type SlidePage } from '@/lib/design/schema';
import { InstfyLockup, InstfyMark } from './InstfyMark';

const SLIDE_W = 1280;
const SLIDE_H = 720;

function Kicker({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  if (!children) return null;
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 600,
        color: inverted ? 'var(--c-chapter-ink)' : 'var(--c-ink-mute)',
      }}
    >
      {children}
    </div>
  );
}

export function EvidenceChip({ type, compact }: { type: EvidenceTypeT; compact?: boolean }) {
  const palette: Record<EvidenceTypeT, { bg: string; fg: string }> = {
    FACT: { bg: '#E6F0E3', fg: '#14401F' },
    SIGNAL: { bg: '#E8EFF4', fg: '#123A52' },
    INFERENCE: { bg: '#F1EDE2', fg: '#4A3C1C' },
    HYPOTHESIS: { bg: '#F7E9D9', fg: '#7A3F10' },
  };
  const c = palette[type];
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontSize: compact ? 9 : 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
        padding: compact ? '2px 6px' : '3px 8px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {EVIDENCE_LABELS[type]}
    </span>
  );
}

function Rule({ width = 44 }: { width?: number }) {
  return <div style={{ width, height: 3, background: 'var(--c-accent)', borderRadius: 2 }} />;
}

function PageFrame({
  children,
  variant = 'paper',
  footerLeft,
  footerRight,
  padded = true,
}: {
  children: ReactNode;
  variant?: 'paper' | 'chapter' | 'alt';
  footerLeft?: string;
  footerRight?: string;
  padded?: boolean;
}) {
  const bg =
    variant === 'chapter' ? 'var(--c-chapter-bg)' : variant === 'alt' ? 'var(--c-bg-alt)' : 'var(--c-bg)';
  const fg = variant === 'chapter' ? 'var(--c-chapter-ink)' : 'var(--c-ink)';
  return (
    <section
      className="instfy-slide"
      style={{
        width: SLIDE_W,
        height: SLIDE_H,
        background: bg,
        color: fg,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--f-sans)',
        display: 'flex',
        flexDirection: 'column',
        padding: padded ? 'var(--s-margin)' : 0,
        boxSizing: 'border-box',
      }}
    >
      {children}
      {(footerLeft || footerRight) && (
        <footer
          style={{
            position: 'absolute',
            left: 'var(--s-margin)',
            right: 'var(--s-margin)',
            bottom: 34,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: variant === 'chapter' ? 'var(--c-chapter-ink)' : 'var(--c-ink-mute)',
            opacity: variant === 'chapter' ? 0.72 : 1,
          }}
        >
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </footer>
      )}
    </section>
  );
}

/** Original geometric motif: concentric arcs. Replaces stock photography. */
function ArcMotif({ opacity = 0.14, flip = false }: { opacity?: number; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 400 400"
      style={{
        position: 'absolute',
        right: flip ? undefined : -60,
        left: flip ? -60 : undefined,
        bottom: -80,
        width: 420,
        height: 420,
        opacity,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {[80, 140, 200, 260, 320].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="var(--c-accent)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** Editorial panel standing in for a photographic block, built from CSS only. */
function TexturePanel({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        background:
          'linear-gradient(145deg, var(--c-chapter-bg) 0%, var(--c-bg-alt) 160%)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 300" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={i * 16} y1="300" x2={i * 16 + 70} y2="0" stroke="var(--c-accent)" strokeWidth="0.6" opacity="0.26" />
        ))}
        <circle cx="150" cy="70" r="46" fill="none" stroke="var(--c-accent)" strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  );
}

export interface SlideContext {
  pageNumber: number;
  totalPages: number;
  clientName: string;
  footerLine?: string;
}

/* ------------------------------- archetypes ------------------------------- */

function Cover({ page }: { page: Extract<SlidePage, { layoutId: 'cover' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="chapter" padded={false}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', height: '100%' }}>
        <div style={{ padding: 'var(--s-margin)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
          <ArcMotif opacity={0.16} flip />
          <div style={{ position: 'relative' }}>
            <InstfyLockup inverted size={26} />
          </div>
          <div style={{ position: 'relative' }}>
            {page.eyebrow && (
              <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--c-accent)', fontWeight: 600, marginBottom: 18 }}>
                {page.eyebrow}
              </div>
            )}
            <h1
              style={{
                fontFamily: 'var(--f-display)',
                fontSize: 60,
                lineHeight: 1.03,
                fontWeight: 300,
                letterSpacing: '-0.025em',
                margin: 0,
                maxWidth: 620,
              }}
            >
              {page.title}
            </h1>
            <div style={{ marginTop: 22 }}>
              <Rule width={56} />
            </div>
            {page.subtitle && (
              <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.5, color: 'var(--c-chapter-ink)', opacity: 0.84, maxWidth: 520 }}>
                {page.subtitle}
              </p>
            )}
          </div>
          <div style={{ position: 'relative', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>
            {page.clientName}
            {page.dateLabel ? ` · ${page.dateLabel}` : ''}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <TexturePanel style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: 'var(--c-accent)', opacity: 0.4 }} />
          <div style={{ position: 'absolute', bottom: 48, left: 40, right: 40, color: 'var(--c-chapter-ink)' }}>
            {page.preparedFor.length > 0 && (
              <>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.66, marginBottom: 8 }}>
                  Preparado para
                </div>
                <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.35 }}>{page.preparedFor.join(' · ')}</div>
              </>
            )}
            {page.tagline && (
              <div style={{ marginTop: 18, fontSize: 13, opacity: 0.74, lineHeight: 1.5 }}>{page.tagline}</div>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

function Chapter({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'chapter' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="chapter" footerLeft={page.kicker ?? ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <ArcMotif opacity={0.12} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', maxWidth: 780 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 15, letterSpacing: '0.2em', color: 'var(--c-accent)', fontWeight: 600 }}>
            PARTE {page.numeral}
          </span>
          {page.kicker && (
            <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>{page.kicker}</span>
          )}
        </div>
        <h2
          style={{
            fontFamily: 'var(--f-display)',
            fontSize: 54,
            lineHeight: 1.06,
            fontWeight: 300,
            letterSpacing: '-0.025em',
            margin: 0,
          }}
        >
          {page.title}
        </h2>
        <div style={{ marginTop: 24 }}>
          <Rule width={56} />
        </div>
        {page.lead && (
          <p style={{ marginTop: 24, fontSize: 17, lineHeight: 1.6, opacity: 0.82, maxWidth: 620 }}>{page.lead}</p>
        )}
      </div>
    </PageFrame>
  );
}

function EditorialSplit({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'editorial-split' }>; ctx: SlideContext }) {
  const panelFirst = page.side === 'left';
  const text = (
    <div style={{ padding: 'var(--s-margin)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Kicker>{page.kicker}</Kicker>
        <EvidenceChip type={page.evidenceType} compact />
      </div>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 38, lineHeight: 1.12, fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>
        {page.title}
      </h2>
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
        {page.paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.62, color: 'var(--c-ink-soft)' }}>
            {p}
          </p>
        ))}
      </div>
      {page.pullQuote && (
        <blockquote
          style={{
            margin: '22px 0 0',
            paddingLeft: 16,
            borderLeft: '3px solid var(--c-accent)',
            fontSize: 16,
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {page.pullQuote}
        </blockquote>
      )}
    </div>
  );
  return (
    <PageFrame padded={false} footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <div style={{ display: 'grid', gridTemplateColumns: panelFirst ? '0.8fr 1.2fr' : '1.2fr 0.8fr', height: '100%' }}>
        {panelFirst ? <TexturePanel /> : text}
        {panelFirst ? text : <TexturePanel />}
      </div>
    </PageFrame>
  );
}

function MetricGrid({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'metric-grid' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="chapter" footerLeft={page.kicker ?? ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <ArcMotif opacity={0.1} />
      <Kicker inverted>{page.kicker}</Kicker>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: 820 }}>
        {page.title}
      </h2>
      <div
        style={{
          marginTop: 34,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(page.metrics.length, 4)}, 1fr)`,
          gap: 30,
          position: 'relative',
        }}
      >
        {page.metrics.map((m, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily: 'var(--f-display)',
                fontSize: page.metrics.length > 3 ? 56 : 72,
                lineHeight: 0.95,
                fontWeight: 300,
                letterSpacing: '-0.04em',
              }}
            >
              {m.value}
            </div>
            <div style={{ marginTop: 14, height: 2, width: 36, background: 'var(--c-accent)' }} />
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, opacity: 0.86 }}>{m.label}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <EvidenceChip type={m.evidenceType} compact />
              <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
                {m.source ? `Fonte: ${m.source}` : 'Fonte não informada'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', marginBottom: 56, display: 'grid', gridTemplateColumns: page.callout ? '1fr 1fr' : '1fr', gap: 28, position: 'relative' }}>
        {page.note && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.74, maxWidth: 520 }}>{page.note}</p>}
        {page.callout && (
          <div style={{ borderLeft: '3px solid var(--c-accent)', paddingLeft: 16, fontSize: 14, lineHeight: 1.55, fontWeight: 500 }}>
            {page.callout}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

function Comparison({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'comparison' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="alt" footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Kicker>{page.kicker}</Kicker>
        <EvidenceChip type={page.evidenceType} compact />
      </div>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: 860 }}>
        {page.title}
      </h2>
      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: `repeat(${page.columns.length}, 1fr)`, gap: 24 }}>
        {page.columns.map((col, i) => (
          <div key={i} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-rule)', borderTop: '3px solid var(--c-accent)', padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{col.heading}</h3>
            <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {col.items.map((it, j) => (
                <li key={j} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--c-ink-soft)', paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 8, width: 5, height: 5, borderRadius: 5, background: 'var(--c-accent)' }} />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {page.note && (
        <p style={{ marginTop: 'auto', marginBottom: 56, fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-mute)', maxWidth: 760 }}>{page.note}</p>
      )}
    </PageFrame>
  );
}

function Timeline({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'timeline' }>; ctx: SlideContext }) {
  return (
    <PageFrame footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <Kicker>{page.kicker}</Kicker>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: 860 }}>
        {page.title}
      </h2>
      <div style={{ marginTop: 44, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 7, height: 1, background: 'var(--c-rule)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${page.steps.length}, 1fr)`, gap: 18 }}>
          {page.steps.map((s, i) => (
            <div key={i} style={{ position: 'relative', paddingRight: 10 }}>
              <div style={{ width: 15, height: 15, borderRadius: 15, background: 'var(--c-accent)', border: '3px solid var(--c-bg)', marginBottom: 20 }} />
              <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', fontWeight: 600 }}>
                {s.period}
              </div>
              <div style={{ marginTop: 7, fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{s.heading}</div>
              {s.detail && <div style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.55, color: 'var(--c-ink-soft)' }}>{s.detail}</div>}
            </div>
          ))}
        </div>
      </div>
      {page.note && (
        <p style={{ marginTop: 'auto', marginBottom: 56, fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-mute)', maxWidth: 780 }}>{page.note}</p>
      )}
    </PageFrame>
  );
}

function Matrix({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'matrix' }>; ctx: SlideContext }) {
  return (
    <PageFrame footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Kicker>{page.kicker}</Kicker>
        <EvidenceChip type={page.evidenceType} compact />
      </div>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: 880 }}>
        {page.title}
      </h2>
      <table style={{ marginTop: 32, width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            {page.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: 'left',
                  padding: '0 14px 11px 0',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--c-ink-mute)',
                  borderBottom: '2px solid var(--c-accent)',
                  fontWeight: 700,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '14px 14px 14px 0',
                    borderBottom: '1px solid var(--c-rule)',
                    color: j === 0 ? 'var(--c-ink)' : 'var(--c-ink-soft)',
                    fontWeight: j === 0 ? 600 : 400,
                    lineHeight: 1.45,
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {page.note && (
        <p style={{ marginTop: 'auto', marginBottom: 56, fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-mute)', maxWidth: 780 }}>{page.note}</p>
      )}
    </PageFrame>
  );
}

function KeyInsight({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'key-insight' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="chapter" footerLeft={page.kicker ?? ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <ArcMotif opacity={0.13} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 900, position: 'relative' }}>
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Kicker inverted>{page.kicker}</Kicker>
          <EvidenceChip type={page.evidenceType} compact />
        </div>
        <p
          style={{
            fontFamily: 'var(--f-display)',
            fontSize: 42,
            lineHeight: 1.18,
            fontWeight: 300,
            letterSpacing: '-0.02em',
            margin: 0,
            borderLeft: '4px solid var(--c-accent)',
            paddingLeft: 28,
          }}
        >
          {page.statement}
        </p>
        {page.support.length > 0 && (
          <div style={{ marginTop: 34, display: 'grid', gridTemplateColumns: `repeat(${page.support.length}, 1fr)`, gap: 26 }}>
            {page.support.map((s, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.8, borderTop: '1px solid var(--c-rule)', paddingTop: 14 }}>
                {s}
              </div>
            ))}
          </div>
        )}
        {page.attribution && (
          <div style={{ marginTop: 26, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>
            {page.attribution}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

function Roadmap({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'roadmap' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="alt" footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <Kicker>{page.kicker}</Kicker>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0' }}>{page.title}</h2>
      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: `repeat(${page.phases.length}, 1fr)`, gap: 20 }}>
        {page.phases.map((ph, i) => (
          <div key={i} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-rule)', padding: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: i === 0 ? 'var(--c-accent)' : 'var(--c-rule)' }} />
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--c-ink-mute)', fontWeight: 700 }}>{ph.label}</div>
            <h3 style={{ margin: '10px 0 0', fontSize: 17, fontWeight: 600, lineHeight: 1.25 }}>{ph.focus}</h3>
            <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ph.outcomes.map((o, j) => (
                <li key={j} style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--c-ink-soft)', paddingLeft: 14, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, background: 'var(--c-accent)', borderRadius: 5 }} />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {page.note && (
        <p style={{ marginTop: 'auto', marginBottom: 56, fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-mute)', maxWidth: 780 }}>{page.note}</p>
      )}
    </PageFrame>
  );
}

function Bullets({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'bullets' }>; ctx: SlideContext }) {
  return (
    <PageFrame footerLeft={ctx.clientName} footerRight={String(ctx.pageNumber).padStart(2, '0')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Kicker>{page.kicker}</Kicker>
        <EvidenceChip type={page.evidenceType} compact />
      </div>
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: 860 }}>
        {page.title}
      </h2>
      {page.lead && <p style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, color: 'var(--c-ink-soft)', maxWidth: 760 }}>{page.lead}</p>}
      <div
        style={{
          marginTop: 28,
          display: 'grid',
          gridTemplateColumns: page.bullets.length > 3 ? '1fr 1fr' : '1fr',
          gap: '20px 40px',
        }}
      >
        {page.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: 13, fontWeight: 700, color: 'var(--c-accent)', minWidth: 22, paddingTop: 2 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              {b.heading && <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{b.heading}</div>}
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-ink-soft)' }}>{b.text}</div>
            </div>
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

function Closing({ page, ctx }: { page: Extract<SlidePage, { layoutId: 'closing' }>; ctx: SlideContext }) {
  return (
    <PageFrame variant="chapter" padded={false}>
      <div style={{ height: '100%', padding: 'var(--s-margin)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        <ArcMotif opacity={0.14} />
        <InstfyLockup inverted size={26} />
        <div style={{ position: 'relative', maxWidth: 860 }}>
          <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 48, fontWeight: 300, letterSpacing: '-0.025em', lineHeight: 1.08, margin: 0 }}>
            {page.title}
          </h2>
          <div style={{ marginTop: 22 }}>
            <Rule width={56} />
          </div>
          {page.message && <p style={{ marginTop: 22, fontSize: 16, lineHeight: 1.6, opacity: 0.84, maxWidth: 680 }}>{page.message}</p>}
          {page.nextSteps.length > 0 && (
            <ol style={{ marginTop: 28, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: `repeat(${Math.min(page.nextSteps.length, 4)}, 1fr)`, gap: 22 }}>
              {page.nextSteps.map((s, i) => (
                <li key={i} style={{ borderTop: '2px solid var(--c-accent)', paddingTop: 12, fontSize: 13, lineHeight: 1.55, opacity: 0.88 }}>
                  <span style={{ display: 'block', fontSize: 10, letterSpacing: '0.16em', opacity: 0.6, marginBottom: 6 }}>PASSO {i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>
          <span>{page.contactLine ?? ctx.footerLine ?? 'Instfy Brasil Ltda · instfy.com'}</span>
          <InstfyMark size={22} />
        </div>
      </div>
    </PageFrame>
  );
}

export function SlideRenderer({ page, ctx }: { page: SlidePage; ctx: SlideContext }) {
  switch (page.layoutId) {
    case 'cover':
      return <Cover page={page} ctx={ctx} />;
    case 'chapter':
      return <Chapter page={page} ctx={ctx} />;
    case 'editorial-split':
      return <EditorialSplit page={page} ctx={ctx} />;
    case 'metric-grid':
      return <MetricGrid page={page} ctx={ctx} />;
    case 'comparison':
      return <Comparison page={page} ctx={ctx} />;
    case 'timeline':
      return <Timeline page={page} ctx={ctx} />;
    case 'matrix':
      return <Matrix page={page} ctx={ctx} />;
    case 'key-insight':
      return <KeyInsight page={page} ctx={ctx} />;
    case 'roadmap':
      return <Roadmap page={page} ctx={ctx} />;
    case 'bullets':
      return <Bullets page={page} ctx={ctx} />;
    case 'closing':
      return <Closing page={page} ctx={ctx} />;
    default: {
      const exhaustive: never = page;
      throw new Error(`Layout desconhecido: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export const SLIDE_DIMENSIONS = { width: SLIDE_W, height: SLIDE_H };
