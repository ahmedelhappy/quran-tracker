import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload, reloadForStaleBuild, isChunkLoadError, RELOAD_GAP_MS, RELOAD_STAMP_KEY } from './staleChunkReload';

const fakeWindow = ({ onLine = true } = {}) => {
  const target = new EventTarget();
  return {
    addEventListener: target.addEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    navigator: { onLine },
    location: { reload: vi.fn() },
  };
};

beforeEach(() => sessionStorage.clear());

describe('reloadForStaleBuild', () => {
  it('reloads once, then not again within the gap, and again after it', () => {
    const win = fakeWindow();
    let t = 1_000_000;
    const now = () => t;
    expect(reloadForStaleBuild(win, now)).toBe(true);
    expect(sessionStorage.getItem(RELOAD_STAMP_KEY)).toBe(String(t));
    t += RELOAD_GAP_MS - 1;
    expect(reloadForStaleBuild(win, now)).toBe(false);
    t += 1;
    expect(reloadForStaleBuild(win, now)).toBe(true);
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload while the browser is offline', () => {
    const win = fakeWindow({ onLine: false });
    expect(reloadForStaleBuild(win)).toBe(false);
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('does not reload when storage is blocked (no way to stop a loop)', () => {
    const win = fakeWindow();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(reloadForStaleBuild(win)).toBe(false);
    expect(win.location.reload).not.toHaveBeenCalled();
  });
});

describe('installStaleChunkReload', () => {
  it('reloads on a failed lazy import, once', () => {
    const win = fakeWindow();
    installStaleChunkReload(win);
    win.dispatchEvent(new Event('vite:preloadError'));
    win.dispatchEvent(new Event('vite:preloadError'));
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });
});

describe('isChunkLoadError', () => {
  it("knows a failed lazy import in Chrome's, Firefox's and Safari's words", () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/VerseSearch-a1.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('is false for an ordinary render error, or nothing', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
