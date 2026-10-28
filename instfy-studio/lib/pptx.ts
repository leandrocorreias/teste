/**
 * PPTX export.
 *
 * A text-faithful editable deck, NOT a pixel copy of the PDF: PowerPoint has no
 * equivalent for the CSS motifs and gradients the renderer uses, so the exporter
 * maps each archetype to native shapes and text frames using the same tokens.
 * The PDF remains the presentation-grade artifact.
 */
import PptxGenJS from 'pptxgenjs';
import { EVIDENCE_LABELS, type SlidePage } from './design/schema';
import { resolveTokens, type ThemeId } from './design/tokens';
import { ensureArtifactDir, ensureParentDir } from './artifacts';
import { writeFile } from 'node:fs/promises';

const W = 10; // inches, 16:9 at 10 x 5.625
const H = 5.625;
const M = 0.55;

function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

export interface PptxResult {
  filePath: string;
  bytes: number;
  pageCount: number;
}

/** Builds the deck in memory. No filesystem access, so it runs on serverless. */
export async function buildPresentationPptx(
  pages: SlidePage[],
  opts: { themeId: ThemeId; clientName: string; title: string; demoMode: boolean },
): Promise<Buffer> {
  const t = resolveTokens(opts.themeId);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'INSTFY_16x9', width: W, height: H });
  pptx.layout = 'INSTFY_16x9';
  pptx.title = opts.title;
  pptx.company = 'Instfy Brasil Ltda';

  const paper = { bg: hex(t.colors.bg), ink: hex(t.colors.ink), soft: hex(t.colors.inkSoft), mute: hex(t.colors.inkMute) };
  const dark = { bg: hex(t.colors.chapterBg), ink: hex(t.colors.chapterInk) };
  const accent = hex(t.colors.accent);

  for (const [index, page] of pages.entries()) {
    const slide = pptx.addSlide();
    const onDark = ['cover', 'chapter', 'metric-grid', 'key-insight', 'closing'].includes(page.layoutId);
    slide.background = { color: onDark ? dark.bg : paper.bg };
    const fg = onDark ? dark.ink : paper.ink;
    const fgSoft = onDark ? dark.ink : paper.soft;

    const kicker = (text: string, y = M) =>
      slide.addText(text.toUpperCase(), {
        x: M, y, w: W - M * 2, h: 0.22,
        fontSize: 9, bold: true, charSpacing: 2, color: onDark ? accent : paper.mute, fontFace: 'Arial',
      });

    const rule = (y: number) => slide.addShape(pptx.ShapeType.rect, { x: M, y, w: 0.6, h: 0.045, fill: { color: accent } });

    switch (page.layoutId) {
      case 'cover': {
        if (page.eyebrow) kicker(page.eyebrow);
        slide.addText(page.title, { x: M, y: 1.5, w: W * 0.62, h: 1.7, fontSize: 36, color: fg, fontFace: 'Arial', valign: 'top' });
        rule(3.35);
        if (page.subtitle) {
          slide.addText(page.subtitle, { x: M, y: 3.6, w: W * 0.58, h: 0.9, fontSize: 13, color: fgSoft, fontFace: 'Arial' });
        }
        slide.addShape(pptx.ShapeType.rect, { x: W * 0.68, y: 0, w: W * 0.32, h: H, fill: { color: hex(t.colors.bgAlt) } });
        slide.addText(
          [
            { text: 'PREPARADO PARA\n', options: { fontSize: 8, bold: true, charSpacing: 2, color: paper.mute } },
            { text: page.preparedFor.join(' · ') || page.clientName, options: { fontSize: 13, bold: true, color: paper.ink } },
          ],
          { x: W * 0.72, y: 4.1, w: W * 0.24, h: 1, fontFace: 'Arial' },
        );
        slide.addText(`${page.clientName}${page.dateLabel ? ` · ${page.dateLabel}` : ''}`, {
          x: M, y: H - 0.75, w: W * 0.6, h: 0.3, fontSize: 9, charSpacing: 1.5, color: fgSoft, fontFace: 'Arial',
        });
        break;
      }
      case 'chapter': {
        kicker(`Parte ${page.numeral}${page.kicker ? ` · ${page.kicker}` : ''}`, 1.6);
        slide.addText(page.title, { x: M, y: 1.95, w: W * 0.72, h: 1.3, fontSize: 34, color: fg, fontFace: 'Arial' });
        rule(3.35);
        if (page.lead) slide.addText(page.lead, { x: M, y: 3.6, w: W * 0.62, h: 1, fontSize: 12, color: fgSoft, fontFace: 'Arial' });
        break;
      }
      case 'editorial-split': {
        kicker(`${page.kicker ?? ''} · ${EVIDENCE_LABELS[page.evidenceType]}`);
        slide.addText(page.title, { x: M, y: 0.95, w: W * 0.56, h: 1, fontSize: 22, color: fg, fontFace: 'Arial' });
        slide.addText(page.paragraphs.map((text) => ({ text, options: { breakLine: true, paraSpaceAfter: 6 } })), {
          x: M, y: 2.05, w: W * 0.56, h: 2.9, fontSize: 11, color: fgSoft, fontFace: 'Arial', valign: 'top',
        });
        slide.addShape(pptx.ShapeType.rect, { x: W * 0.64, y: 0, w: W * 0.36, h: H, fill: { color: dark.bg } });
        if (page.pullQuote) {
          slide.addText(page.pullQuote, { x: W * 0.68, y: 2, w: W * 0.28, h: 1.6, fontSize: 13, bold: true, color: dark.ink, fontFace: 'Arial' });
        }
        break;
      }
      case 'metric-grid': {
        if (page.kicker) kicker(page.kicker);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        const cols = page.metrics.length;
        const colW = (W - M * 2) / cols;
        page.metrics.forEach((metric, i) => {
          const x = M + i * colW;
          slide.addText(metric.value, { x, y: 1.7, w: colW - 0.2, h: 1, fontSize: 40, color: fg, fontFace: 'Arial' });
          slide.addShape(pptx.ShapeType.rect, { x, y: 2.75, w: 0.4, h: 0.03, fill: { color: accent } });
          slide.addText(metric.label, { x, y: 2.9, w: colW - 0.2, h: 0.9, fontSize: 10, color: fgSoft, fontFace: 'Arial' });
          slide.addText(`${EVIDENCE_LABELS[metric.evidenceType]} · ${metric.source ? `Fonte: ${metric.source}` : 'Fonte não informada'}`, {
            x, y: 3.8, w: colW - 0.2, h: 0.5, fontSize: 8, color: fgSoft, fontFace: 'Arial',
          });
        });
        if (page.callout) {
          slide.addText(page.callout, { x: M, y: 4.5, w: W - M * 2, h: 0.6, fontSize: 11, bold: true, color: fg, fontFace: 'Arial' });
        }
        break;
      }
      case 'comparison': {
        kicker(`${page.kicker ?? ''} · ${EVIDENCE_LABELS[page.evidenceType]}`);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        const colW = (W - M * 2) / page.columns.length;
        page.columns.forEach((col, i) => {
          const x = M + i * colW;
          slide.addShape(pptx.ShapeType.rect, { x, y: 1.6, w: colW - 0.18, h: 0.035, fill: { color: accent } });
          slide.addText(col.heading, { x, y: 1.72, w: colW - 0.18, h: 0.4, fontSize: 12, bold: true, color: fg, fontFace: 'Arial' });
          slide.addText(col.items.map((text) => ({ text, options: { bullet: true, breakLine: true } })), {
            x, y: 2.2, w: colW - 0.18, h: 2.8, fontSize: 10, color: fgSoft, fontFace: 'Arial', valign: 'top',
          });
        });
        break;
      }
      case 'timeline': {
        if (page.kicker) kicker(page.kicker);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        const colW = (W - M * 2) / page.steps.length;
        slide.addShape(pptx.ShapeType.rect, { x: M, y: 2.05, w: W - M * 2, h: 0.012, fill: { color: hex(t.colors.rule) } });
        page.steps.forEach((step, i) => {
          const x = M + i * colW;
          slide.addShape(pptx.ShapeType.ellipse, { x, y: 1.93, w: 0.16, h: 0.16, fill: { color: accent } });
          slide.addText(step.period.toUpperCase(), { x, y: 2.3, w: colW - 0.15, h: 0.28, fontSize: 8, bold: true, charSpacing: 1.5, color: paper.mute, fontFace: 'Arial' });
          slide.addText(step.heading, { x, y: 2.6, w: colW - 0.15, h: 0.5, fontSize: 12, bold: true, color: fg, fontFace: 'Arial' });
          if (step.detail) slide.addText(step.detail, { x, y: 3.1, w: colW - 0.15, h: 1.2, fontSize: 9, color: fgSoft, fontFace: 'Arial' });
        });
        break;
      }
      case 'matrix': {
        kicker(`${page.kicker ?? ''} · ${EVIDENCE_LABELS[page.evidenceType]}`);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        slide.addTable(
          [
            page.headers.map((h) => ({ text: h.toUpperCase(), options: { bold: true, fontSize: 8, color: paper.mute, fill: { color: paper.bg } } })),
            ...page.rows.map((row) => row.map((cell) => ({ text: cell, options: { fontSize: 9, color: paper.soft } }))),
          ],
          { x: M, y: 1.65, w: W - M * 2, border: { type: 'solid', color: hex(t.colors.rule), pt: 0.5 }, fontFace: 'Arial', autoPage: false },
        );
        break;
      }
      case 'key-insight': {
        kicker(`${page.kicker ?? ''} · ${EVIDENCE_LABELS[page.evidenceType]}`, 1.3);
        slide.addShape(pptx.ShapeType.rect, { x: M, y: 1.7, w: 0.05, h: 1.9, fill: { color: accent } });
        slide.addText(page.statement, { x: M + 0.25, y: 1.7, w: W - M * 2 - 0.3, h: 1.9, fontSize: 24, color: fg, fontFace: 'Arial', valign: 'top' });
        if (page.support.length) {
          const colW = (W - M * 2) / page.support.length;
          page.support.forEach((text, i) => {
            slide.addText(text, { x: M + i * colW, y: 3.9, w: colW - 0.2, h: 1.1, fontSize: 10, color: fgSoft, fontFace: 'Arial' });
          });
        }
        break;
      }
      case 'roadmap': {
        if (page.kicker) kicker(page.kicker);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        const colW = (W - M * 2) / page.phases.length;
        page.phases.forEach((phase, i) => {
          const x = M + i * colW;
          slide.addShape(pptx.ShapeType.rect, { x, y: 1.65, w: colW - 0.18, h: 0.035, fill: { color: i === 0 ? accent : hex(t.colors.rule) } });
          slide.addText(phase.label.toUpperCase(), { x, y: 1.78, w: colW - 0.18, h: 0.26, fontSize: 8, bold: true, charSpacing: 1.5, color: paper.mute, fontFace: 'Arial' });
          slide.addText(phase.focus, { x, y: 2.05, w: colW - 0.18, h: 0.5, fontSize: 12, bold: true, color: fg, fontFace: 'Arial' });
          slide.addText(phase.outcomes.map((text) => ({ text, options: { bullet: true, breakLine: true } })), {
            x, y: 2.6, w: colW - 0.18, h: 2.2, fontSize: 9, color: fgSoft, fontFace: 'Arial', valign: 'top',
          });
        });
        break;
      }
      case 'bullets': {
        kicker(`${page.kicker ?? ''} · ${EVIDENCE_LABELS[page.evidenceType]}`);
        slide.addText(page.title, { x: M, y: 0.9, w: W - M * 2, h: 0.6, fontSize: 20, color: fg, fontFace: 'Arial' });
        if (page.lead) slide.addText(page.lead, { x: M, y: 1.5, w: W - M * 2, h: 0.6, fontSize: 11, color: fgSoft, fontFace: 'Arial' });
        slide.addText(
          page.bullets.map((b) => ({
            text: b.heading ? `${b.heading} — ${b.text}` : b.text,
            options: { bullet: true, breakLine: true, paraSpaceAfter: 6 },
          })),
          { x: M, y: page.lead ? 2.15 : 1.55, w: W - M * 2, h: 3, fontSize: 11, color: fgSoft, fontFace: 'Arial', valign: 'top' },
        );
        break;
      }
      case 'closing': {
        slide.addText(page.title, { x: M, y: 1.4, w: W * 0.8, h: 1.1, fontSize: 30, color: fg, fontFace: 'Arial' });
        rule(2.65);
        if (page.message) slide.addText(page.message, { x: M, y: 2.9, w: W * 0.72, h: 0.9, fontSize: 11, color: fgSoft, fontFace: 'Arial' });
        if (page.nextSteps.length) {
          const colW = (W - M * 2) / page.nextSteps.length;
          page.nextSteps.forEach((step, i) => {
            const x = M + i * colW;
            slide.addShape(pptx.ShapeType.rect, { x, y: 3.95, w: colW - 0.2, h: 0.03, fill: { color: accent } });
            slide.addText(`PASSO ${i + 1}\n${step}`, { x, y: 4.08, w: colW - 0.2, h: 0.9, fontSize: 9, color: fgSoft, fontFace: 'Arial' });
          });
        }
        slide.addText(page.contactLine ?? 'Instfy Brasil Ltda · instfy.com', {
          x: M, y: H - 0.6, w: W - M * 2, h: 0.3, fontSize: 8, charSpacing: 1.5, color: fgSoft, fontFace: 'Arial',
        });
        break;
      }
      default: {
        const exhaustive: never = page;
        throw new Error(`Layout sem exportador PPTX: ${JSON.stringify(exhaustive)}`);
      }
    }

    if (page.layoutId !== 'cover' && page.layoutId !== 'closing') {
      slide.addText(`${opts.clientName}`, { x: M, y: H - 0.48, w: W * 0.6, h: 0.25, fontSize: 8, charSpacing: 1.5, color: fgSoft, fontFace: 'Arial' });
      slide.addText(String(index + 1).padStart(2, '0'), {
        x: W - M - 0.6, y: H - 0.48, w: 0.6, h: 0.25, fontSize: 8, charSpacing: 1.5, color: fgSoft, align: 'right', fontFace: 'Arial',
      });
    }
  }

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
}

/** Writes the deck to the artifact directory. Requires a writable disk. */
export async function renderPresentationPptx(
  pages: SlidePage[],
  opts: { filePath: string; themeId: ThemeId; clientName: string; title: string; demoMode: boolean },
): Promise<PptxResult> {
  await ensureArtifactDir();
  await ensureParentDir(opts.filePath);
  const buffer = await buildPresentationPptx(pages, opts);
  await writeFile(opts.filePath, buffer);
  return { filePath: opts.filePath, bytes: buffer.length, pageCount: pages.length };
}
