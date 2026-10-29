import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDailyVerse, purgeOldDailyVerses, DAILY_VERSE_PREFIX } from './dailyVerse';

const apiAnswer = {
  data: { text: 'Indeed, with hardship comes ease.', numberInSurah: 6, surah: { number: 94, englishName: 'Ash-Sharh', name: 'سُورَةُ الشَّرۡحِ' } },
};
const dailyKeys = () => Object.keys(window.localStorage).filter((k) => k.startsWith(DAILY_VERSE_PREFIX)).sort();

describe('daily verse cache keeps only the current day (L-15)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T09:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("storing today's verse removes every earlier day's, in both languages", async () => {
    // What a returning user's storage looked like: two keys a day, never removed.
    for (const day of ['2026-01-01', '2026-10-27', '2026-10-28']) {
      window.localStorage.setItem(`dailyVerse:${day}:en`, '{"text":"old"}');
      window.localStorage.setItem(`dailyVerse:${day}:ar`, '{"text":"old"}');
    }
    window.localStorage.setItem('dailyVerse:2026-10-29:ar', '{"text":"today ar","lang":"ar"}');
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('recentPages', '[]');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => apiAnswer })));

    const verse = await getDailyVerse('en');

    expect(verse).toMatchObject({ text: apiAnswer.data.text, lang: 'en', source: 'Ash-Sharh 94:6' });
    expect(dailyKeys()).toEqual(['dailyVerse:2026-10-29:ar', 'dailyVerse:2026-10-29:en']);
    // Other keys are not the purge's business.
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(window.localStorage.getItem('recentPages')).toBe('[]');
  });

  it("a cached verse for today is used as is, without a request", async () => {
    window.localStorage.setItem('dailyVerse:2026-10-29:en', JSON.stringify({ text: 'cached', source: 's', lang: 'en' }));
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(getDailyVerse('en')).resolves.toMatchObject({ text: 'cached' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a failed fetch removes nothing and stores nothing', async () => {
    window.localStorage.setItem('dailyVerse:2026-10-28:en', '{"text":"yesterday"}');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    await expect(getDailyVerse('en')).rejects.toMatchObject({ status: 503 });
    expect(dailyKeys()).toEqual(['dailyVerse:2026-10-28:en']);
  });

  it('purgeOldDailyVerses keeps the named day and leaves look-alike keys alone', () => {
    window.localStorage.setItem('dailyVerse:2026-10-28:en', '{}');
    window.localStorage.setItem('dailyVerse:2026-10-29:en', '{}');
    window.localStorage.setItem('dailyVerseSeen', '1');
    purgeOldDailyVerses('2026-10-29');
    expect(dailyKeys()).toEqual(['dailyVerse:2026-10-29:en']);
    expect(window.localStorage.getItem('dailyVerseSeen')).toBe('1');
  });
});
