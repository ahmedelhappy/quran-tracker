// "Come back here after signing in."
//
// The value travels in a query string, so it is never trusted: only a path
// inside this app is accepted — no other origin, no protocol-relative "//host",
// and not the auth pages themselves (which would bounce the reader in a circle).

const BASE = 'https://app.invalid';

export function safeReturnTo(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  let url;
  try { url = new URL(raw, BASE); } catch { return null; }
  if (url.origin !== BASE) return null;
  if (/^\/(login|register)(\/|$)/.test(url.pathname)) return null;
  // Check what we RETURN, not only what came in: normalising dot segments can
  // turn an innocent-looking input into a protocol-relative URL ("/.//evil.com",
  // "/%2e//evil.com" and "/a/..//evil.com" all become "//evil.com"). The router
  // collapses the double slash today, but a plain href or location.assign fed
  // this value would leave the site.
  const out = url.pathname + url.search + url.hash;
  return out.startsWith('//') ? null : out;
}

// The sign-in link for a page that wants the reader back afterwards.
export const loginPathFor = (location) =>
  `/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
