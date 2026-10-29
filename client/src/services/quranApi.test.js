import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Each test gets a fresh module, so its caches start empty.
let api;
beforeEach(async () => {
  vi.resetModules();
  api = await import('./quranApi');
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
