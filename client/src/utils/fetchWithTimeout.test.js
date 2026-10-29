import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithTimeout, fetchJSON, RequestTimeoutError, HttpStatusError, isRequestFailure, DEFAULT_TIMEOUT_MS,
} from './fetchWithTimeout';

// A fetch that never answers, as a stalled host does — it only ends when its
// signal is aborted, the way the real fetch rejects.
const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
const hangingFetch = () => vi.fn((url, { signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(abortError()));
}));
const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('fetchWithTimeout', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('gives back what `read` made of the response, and leaves no timer behind', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ a: 1 })));
    await expect(fetchWithTimeout('/x', { read: (r) => r.json() })).resolves.toEqual({ a: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a request that never answers and rejects with a timeout error', async () => {
    const fetch = hangingFetch();
    vi.stubGlobal('fetch', fetch);
    const pending = fetchWithTimeout('https://slow.example/page', { timeoutMs: 5000 });
    const outcome = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('uses a 15 s deadline by default', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const pending = fetchWithTimeout('/x');
    const outcome = expect(pending).rejects.toMatchObject({ name: 'RequestTimeoutError', timeoutMs: DEFAULT_TIMEOUT_MS });
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    await outcome;
    expect(DEFAULT_TIMEOUT_MS).toBe(15_000);
  });

  it('covers a body that stalls after the headers arrived', async () => {
    // Headers at once; the body only ends when the request is aborted.
    vi.stubGlobal('fetch', vi.fn(async (url, { signal }) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(abortError()))),
    })));
    const pending = fetchJSON('/big.json', { timeoutMs: 1000 });
    const outcome = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await outcome;
  });

  it("aborts with the caller's own signal, reported as an abort and not a timeout", async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const pending = fetchWithTimeout('/x', { signal: controller.signal });
    const outcome = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await outcome;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fetchJSON refuses a non-2xx answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'down' }, 503)));
    await expect(fetchJSON('/x')).rejects.toMatchObject({ name: 'HttpStatusError', status: 503 });
  });

  it('tells a failed request from content that cannot be used', () => {
    expect(isRequestFailure(new RequestTimeoutError('/x', 1))).toBe(true);
    expect(isRequestFailure(new HttpStatusError('/x', 502))).toBe(true);
    expect(isRequestFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRequestFailure(abortError())).toBe(true);
    expect(isRequestFailure(new DOMException('bad data', 'EncodingError'))).toBe(false);
    expect(isRequestFailure(new Error('Unexpected payload'))).toBe(false);
  });
});
