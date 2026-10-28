/**
 * HTML -> PDF via Playwright/Chromium.
 *
 * Renders the app's own /print routes, so the preview and the PDF share the
 * exact same renderer components.
 */
import { chromium, type Browser } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { ensureArtifactDir, ensureParentDir } from './artifacts';
import { BASE_PATH } from './base-path';

const PRESENTATION_PX = { width: 1280, height: 720 };
/** A4 at 96dpi, matching the .instfy-page CSS box. */
const A4_CSS_HEIGHT = 1123;

function executablePath(): string | undefined {
  const explicit = process.env.CHROMIUM_EXECUTABLE_PATH?.trim();
  if (explicit) return explicit;
  // The managed environment ships a Chromium at a fixed path.
  return '/opt/pw-browsers/chromium';
}

async function launch(): Promise<Browser> {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'];
  try {
    return await chromium.launch({ args, executablePath: executablePath() });
  } catch {
    // Fall back to whatever Playwright resolves on its own.
    return await chromium.launch({ args });
  }
}

export interface RenderResult {
  filePath: string;
  bytes: number;
  /** Physical pages in the produced PDF. */
  pageCount: number;
  /** Logical page elements in the source document. */
  logicalPageCount: number;
  /**
   * Logical pages whose content exceeds the paper box and therefore spill onto
   * an extra physical page. Empty means no page overflowed.
   */
  overflowPages: Array<{ index: number; heightPx: number; spillsBy: number }>;
  screenshots: string[];
}

async function renderUrl(
  url: string,
  filePath: string,
  mode: 'presentation' | 'document',
  opts: { screenshotPages?: number } = {},
): Promise<RenderResult> {
  await ensureArtifactDir();
  await ensureParentDir(filePath);
  const browser = await launch();
  const screenshots: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: mode === 'presentation' ? PRESENTATION_PX : { width: 1240, height: 1754 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    if (!response || !response.ok()) {
      throw new Error(`A página de impressão respondeu ${response?.status() ?? 'sem resposta'} em ${url}`);
    }
    // Fail loudly rather than printing a blank/error page.
    const marker = await page.locator('[data-print-ready="true"]').count();
    if (marker === 0) {
      const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
      throw new Error(`A página de impressão não sinalizou prontidão. Conteúdo: ${body}`);
    }
    await page.emulateMedia({ media: 'print' });

    const pdf =
      mode === 'presentation'
        ? await page.pdf({
            printBackground: true,
            width: `${PRESENTATION_PX.width}px`,
            height: `${PRESENTATION_PX.height}px`,
            pageRanges: '',
            margin: { top: '0', bottom: '0', left: '0', right: '0' },
          })
        : await page.pdf({
            printBackground: true,
            format: 'A4',
            margin: { top: '0', bottom: '0', left: '0', right: '0' },
            displayHeaderFooter: false,
          });

    await writeFile(filePath, pdf);

    // Screenshot the first N pages so clipping can be inspected visually.
    const limit = opts.screenshotPages ?? 0;
    if (limit > 0) {
      const slides = page.locator(mode === 'presentation' ? '.instfy-slide' : '.instfy-page');
      const count = Math.min(await slides.count(), limit);
      for (let i = 0; i < count; i += 1) {
        const shotPath = filePath.replace(/\.pdf$/, `-p${i + 1}.png`);
        await slides.nth(i).screenshot({ path: shotPath });
        screenshots.push(shotPath);
      }
    }

    // Measure the real pagination instead of trusting the element count: an
    // A4 page whose content exceeds the paper box spills onto another sheet.
    const selector = mode === 'presentation' ? '.instfy-slide' : '.instfy-page';
    const boxHeight = mode === 'presentation' ? PRESENTATION_PX.height : A4_CSS_HEIGHT;
    const heights = await page.$$eval(selector, (nodes) =>
      nodes.map((n) => Math.round((n as HTMLElement).getBoundingClientRect().height)),
    );
    const logicalPageCount = heights.length;
    const overflowPages = heights
      .map((heightPx, index) => ({ index, heightPx, spillsBy: heightPx - boxHeight }))
      .filter((p) => p.spillsBy > 1);
    const pageCount = heights.reduce((total, h) => total + Math.max(1, Math.ceil(h / boxHeight)), 0);

    await context.close();
    return { filePath, bytes: pdf.length, pageCount, logicalPageCount, overflowPages, screenshots };
  } finally {
    await browser.close();
  }
}

export function renderPresentationPdf(
  documentVersionId: string,
  filePath: string,
  opts?: { screenshotPages?: number },
): Promise<RenderResult> {
  const base = process.env.APP_BASE_URL || 'http://localhost:3100';
  return renderUrl(`${base}${BASE_PATH}/print/presentation/${documentVersionId}`, filePath, 'presentation', opts);
}

export function renderProposalPdf(
  documentVersionId: string,
  filePath: string,
  opts?: { screenshotPages?: number },
): Promise<RenderResult> {
  const base = process.env.APP_BASE_URL || 'http://localhost:3100';
  return renderUrl(`${base}${BASE_PATH}/print/proposal/${documentVersionId}`, filePath, 'document', opts);
}
