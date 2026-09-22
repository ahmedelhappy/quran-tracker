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
  return url.pathname + url.search + url.hash;
}

// The sign-in link for a page that wants the reader back afterwards.
export const loginPathFor = (location) =>
  `/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
