/**
 * Base path support, for serving the app under a sub-path of another site
 * (for example instfy.com/comercial behind that site's reverse proxy).
 *
 * Next.js prefixes `next/link` hrefs, router navigations and bundled assets by
 * itself. It does NOT prefix raw `fetch` URLs, plain `<a href>` or
 * `window.open`, so those go through `withBasePath`.
 *
 * Empty by default, so the app keeps serving from the domain root unless
 * NEXT_PUBLIC_BASE_PATH is set at build time.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');

export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  if (!path.startsWith('/')) return path;
  // Guard against double-prefixing if a caller already applied it.
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
