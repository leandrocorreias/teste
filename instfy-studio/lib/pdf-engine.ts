/**
 * How PDFs get produced, which differs by where the app runs.
 *
 * - 'server': Chromium (Playwright) prints the /print route server-side and the
 *   file is stored as a DocumentVersion artifact. Used locally and on any host
 *   with a writable disk and a Chromium binary. This is the path that is
 *   covered by the acceptance suite.
 * - 'browser': the app opens the same /print route and the viewer's browser
 *   prints it. Used on serverless hosts, which have no persistent disk and no
 *   Chromium. Identical renderers and CSS, so the output matches; what is lost
 *   is the stored artifact file and the automated overflow measurement.
 *
 * Both paths render the exact same components, so neither invents a layout the
 * other would not produce.
 */
export type PdfEngine = 'server' | 'browser';

export function pdfEngine(): PdfEngine {
  const explicit = process.env.PDF_ENGINE?.trim();
  if (explicit === 'server' || explicit === 'browser') return explicit;
  // Vercel and similar serverless runtimes cannot host Chromium or keep files.
  return process.env.VERCEL ? 'browser' : 'server';
}

export function artifactsArePersisted(): boolean {
  return pdfEngine() === 'server';
}
