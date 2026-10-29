import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Each test gets a fresh module, so its caches start empty.
let api;
beforeEach(async () => {
  vi.resetModules();
  api = await import('./quranApi');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('quranApi caches are bounded (L-15)', () => {
  it('a long session through the tafsir keeps only the most recent verses', async () => {
    const fetch = vi.fn(async (url) => jsonResponse({ text: `tafsir of ${url}` }));
    vi.stubGlobal('fetch', fetch);
    const n = api.AYAH_CACHE_MAX;
    expect(n).toBe(200);
    // n + 50 distinct verses, oldest first.
    for (let a = 1; a <= n + 50; a++) await api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, a);
    expect(fetch).toHaveBeenCalledTimes(n + 50);
    // The most recent n are still cached…
    await api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, n + 50);
    await api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, 51);
    expect(fetch).toHaveBeenCalledTimes(n + 50);
    // …the oldest were let go, and are fetched again when asked for.
    await api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, 1);
    expect(fetch).toHaveBeenCalledTimes(n + 51);
  });

  it('page editions keep at most PAGE_CACHE_MAX pages', async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: { ayahs: [{ text: 'x' }] } }));
    vi.stubGlobal('fetch', fetch);
    const n = api.PAGE_CACHE_MAX;
    for (let p = 1; p <= n + 1; p++) await api.fetchPageTafsir(p, 'ar.muyassar');
    await api.fetchPageTafsir(n + 1, 'ar.muyassar');   // cached
    await api.fetchPageTafsir(1, 'ar.muyassar');       // evicted: fetched again
    expect(fetch).toHaveBeenCalledTimes(n + 2);
  });
});

describe('quranApi caches keep only what really arrived (M-14)', () => {
  it('a timed-out tafsir request is not cached: the next ask fetches again', async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
      }
      return Promise.resolve(jsonResponse({ text: 'commentary' }));
    }));
    const first = api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, 255);
    const outcome = expect(first).rejects.toMatchObject({ name: 'RequestTimeoutError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await outcome;
    await expect(api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, 255)).resolves.toBe('commentary');
    await expect(api.fetchAyahTafsir('ar-tafseer-al-saddi', 2, 255)).resolves.toBe('commentary');
    expect(calls).toBe(2);   // the success is cached; the timeout was not
  });

  it('an unexpected tafsir payload is an error, not an empty panel for the session', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ nothing: true }))
      .mockResolvedValueOnce(jsonResponse({ text: 'second try' }));
    vi.stubGlobal('fetch', fetch);
    await expect(api.fetchAyahTafsir('ar-tafsir-al-tabari', 1, 1)).rejects.toThrow('Unexpected tafsir payload');
    await expect(api.fetchAyahTafsir('ar-tafsir-al-tabari', 1, 1)).resolves.toBe('second try');
  });

  it('a failed page edition is not cached', async () => {
    const page = { data: { ayahs: [{ text: '﻿بِسْمِ', numberInSurah: 1, surah: { number: 1 } }] } };
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(page));
    vi.stubGlobal('fetch', fetch);
    await expect(api.fetchPageTafsir(1, 'ar.muyassar')).rejects.toMatchObject({ status: 500 });
    const ayahs = await api.fetchPageTafsir(1, 'ar.muyassar');
    expect(ayahs[0].text).toBe('بِسْمِ');   // BOM stripped
    await api.fetchPageTafsir(1, 'ar.muyassar');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
