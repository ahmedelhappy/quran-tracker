import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The first 12 KB of an MP3: one MPEG-1 layer III frame header (128 kbps,
// 44.1 kHz) and zeros. Long enough that the file's size is asked for next.
const head = () => {
  const b = new Uint8Array(12 * 1024);
  b.set([0xff, 0xfb, 0x90, 0x64]);
  return b;
};

let verseEdges;
beforeEach(async () => {
  vi.resetModules();
  ({ verseEdges } = await import('./verseEdges'));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('verseEdges (M-14)', () => {
  it('a refused HEAD request is not remembered: the verse is measured again next time', async () => {
    const fetch = vi.fn(async (url, { method } = {}) => (method === 'HEAD'
      ? { ok: false, status: 503, headers: new Headers() }
      : { ok: true, status: 206, arrayBuffer: async () => head().buffer }));
    vi.stubGlobal('fetch', fetch);

    await expect(verseEdges('ar.alafasy', 10)).resolves.toBeNull();
    await expect(verseEdges('ar.alafasy', 10)).resolves.toBeNull();
    // Two tries, each a range GET and a HEAD — not one try remembered as "can't".
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(2);
  });

  it('a file that answers but is too short to measure IS remembered', async () => {
    const fetch = vi.fn(async (url, { method } = {}) => (method === 'HEAD'
      ? { ok: true, status: 200, headers: new Headers({ 'content-length': '100' }) }
      : { ok: true, status: 206, arrayBuffer: async () => head().buffer }));
    vi.stubGlobal('fetch', fetch);

    await expect(verseEdges('ar.alafasy', 11)).resolves.toBeNull();
    await expect(verseEdges('ar.alafasy', 11)).resolves.toBeNull();
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'HEAD')).toHaveLength(1);
  });
});
