import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The mushaf data layer, faked: fonts are always ready, and a page's data is
// "cached" only once the test says so.
const cached = new Set();
const fetchMushafPage = vi.fn();
vi.mock('./mushafApi', () => ({
  fetchMushafPage: (p) => fetchMushafPage(p),
  peekMushafPage: (p) => (cached.has(p) ? { page: p } : null),
  decodePageFont: async () => true,
  isPageFontReady: () => true,
  primePageFont: async () => true,
  isPageFontPrimed: () => true,
}));

const { setPrefetchFocus, stopPrefetch } = await import('./pagePrefetch');

describe('pagePrefetch (M-14)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cached.clear();
    fetchMushafPage.mockReset();
  });
  afterEach(() => {
    stopPrefetch();
    vi.useRealTimers();
  });

  it('backs off from a page that came back without being cached, instead of asking again at once', async () => {
    // Page 50 comes back drawable but incomplete (page+1 could not be had);
    // every other page arrives whole.
    fetchMushafPage.mockImplementation(async (p) => {
      if (p !== 50) cached.add(p);
      return { page: p };
    });
    setPrefetchFocus({ visible: [49], step: 1, playing: false });

    await vi.advanceTimersByTimeAsync(5_000);
    const asksFor50 = () => fetchMushafPage.mock.calls.filter(([p]) => p === 50).length;
    // Once — not once per idle slot (~160 in 5 s before the fix).
    expect(asksFor50()).toBe(1);
    // The rest of the window was still fetched.
    expect(cached.has(48) && cached.has(51) && cached.has(47)).toBe(true);

    // A turn inside the back-off does not ask again; one after it does.
    setPrefetchFocus({ visible: [48], step: 1, playing: false });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(asksFor50()).toBe(1);
    await vi.advanceTimersByTimeAsync(25_000);
    setPrefetchFocus({ visible: [49], step: 1, playing: false });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(asksFor50()).toBe(2);
  });

  it('a page that arrives whole is fetched once and left alone', async () => {
    fetchMushafPage.mockImplementation(async (p) => { cached.add(p); return { page: p }; });
    setPrefetchFocus({ visible: [49], step: 1, playing: false });
    await vi.advanceTimersByTimeAsync(40_000);
    const calls = fetchMushafPage.mock.calls.map(([p]) => p);
    expect(new Set(calls).size).toBe(calls.length);
  });
});
