// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// client/vercel.json is the only place the deployed site's headers and routing
// live. These checks keep it in step with the code: a new external host in
// src/ must be added to the Content-Security-Policy, and a missing asset must
// never be answered with index.html (M-05, L-12).
const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(fs.readFileSync(path.join(CLIENT, 'vercel.json'), 'utf8'));

// Vercel sources are path-to-regexp patterns; the ones used here are plain
// regular expressions anchored to the whole path.
const matches = (source, p) => new RegExp(`^${source}$`).test(p);
const headersFor = (p) => Object.fromEntries(
  vercel.headers.filter((h) => matches(h.source, p)).flatMap((h) => h.headers).map(({ key, value }) => [key, value]),
);
const rewritten = (p) => vercel.rewrites.some((r) => matches(r.source, p));

const csp = headersFor('/')['Content-Security-Policy-Report-Only'];
const directive = (name) => (csp.split(';').map((d) => d.trim().split(/\s+/)).find(([n]) => n === name) || []).slice(1);

// Every https origin the shipped code names (tests and placeholder bases aside).
const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  if (e.isDirectory()) return sourceFiles(full);
  return /\.(js|jsx|css)$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : [];
});
const PLACEHOLDERS = new Set(['https://app.invalid', 'https://www.w3.org']);
const origins = new Set();
for (const file of sourceFiles(path.join(CLIENT, 'src'))) {
  for (const [, origin] of fs.readFileSync(file, 'utf8').matchAll(/['"`(](https:\/\/[a-z0-9.-]+)/gi)) {
    if (!PLACEHOLDERS.has(origin)) origins.add(origin);
  }
}

describe('vercel.json security headers (M-05)', () => {
  it('sends the framing, sniffing, referrer, HSTS and permission headers on every route', () => {
    for (const p of ['/', '/settings', '/library', '/assets/index-abc.js']) {
      const h = headersFor(p);
      expect(h['X-Frame-Options']).toBe('DENY');
      expect(h['Content-Security-Policy']).toBe("frame-ancestors 'none'");
      expect(h['X-Content-Type-Options']).toBe('nosniff');
      expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(h['Strict-Transport-Security']).toMatch(/^max-age=\d+/);
      expect(h['Permissions-Policy']).toMatch(/camera=\(\)/);
    }
  });

  it('the report-only policy allows every external host the code contacts', () => {
    expect(origins).toContain('https://api.quran.com'); // the scan found the hosts at all
    const connect = directive('connect-src');
    for (const origin of origins) expect(connect, origin).toContain(origin);
  });

  it('allows the recitation hosts as media and no longer mentions Google Fonts', () => {
    const quranApi = fs.readFileSync(path.join(CLIENT, 'src/services/quranApi.js'), 'utf8');
    for (const name of ['AUDIO_CDN', 'FALLBACK_AUDIO_BASE']) {
      const origin = new URL(quranApi.match(new RegExp(`${name} = '([^']+)'`))[1]).origin;
      expect(directive('media-src')).toContain(origin);
    }
    expect(csp).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(directive('font-src')).toEqual(["'self'"]);
  });
});

describe('vercel.json routing and caching (L-12)', () => {
  it('rewrites app routes to index.html but never a missing asset, font or data file', () => {
    for (const p of ['/', '/dashboard', '/library', '/settings/profile']) expect(rewritten(p), p).toBe(true);
    for (const p of ['/assets/index-OLDHASH.js', '/fonts/qcf/v1/p999.woff2', '/data/search-index.json']) {
      expect(rewritten(p), p).toBe(false);
    }
  });

  it('caches hashed assets for good, revalidates fonts and data, and always revalidates index.html', () => {
    expect(headersFor('/assets/index-abc.js')['Cache-Control']).toBe('public, max-age=31536000, immutable');
    // Not content-hashed file names: long-lived, but never `immutable`.
    for (const p of ['/fonts/qcf/v1/p1.woff2', '/data/search-index.json']) {
      expect(headersFor(p)['Cache-Control']).toMatch(/max-age=\d+/);
      expect(headersFor(p)['Cache-Control']).not.toMatch(/immutable/);
    }
    for (const p of ['/', '/dashboard']) expect(headersFor(p)['Cache-Control']).toBe('no-cache');
  });
});
