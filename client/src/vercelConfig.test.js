// @vitest-environment node
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// client/vercel.json is the only place the deployed site's headers and routing
// live. These checks keep it in step with the code: a missing asset must never
// be answered with index.html (L-12).
const CLIENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercel = JSON.parse(fs.readFileSync(path.join(CLIENT, 'vercel.json'), 'utf8'));

// Vercel sources are path-to-regexp patterns; the ones used here are plain
// regular expressions anchored to the whole path.
const matches = (source, p) => new RegExp(`^${source}$`).test(p);
const headersFor = (p) => Object.fromEntries(
  vercel.headers.filter((h) => matches(h.source, p)).flatMap((h) => h.headers).map(({ key, value }) => [key, value]),
);
const rewritten = (p) => vercel.rewrites.some((r) => matches(r.source, p));

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
