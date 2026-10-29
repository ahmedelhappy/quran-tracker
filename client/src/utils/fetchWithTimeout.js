// fetch() with a deadline (M-14).
//
// A plain fetch has no timeout of its own: a host that accepts the connection and
// then never answers leaves the request pending until the browser gives up, which
// can be minutes. Every screen waiting on it spins that long, and every cache that
// shares the pending promise (so two callers don't fetch the same page twice)
// hands the same dead request to every later caller. So every request to another
// host goes through here and is aborted after `timeoutMs`.
//
// The deadline covers the BODY too when the caller reads it in `read` (res.json(),
// res.arrayBuffer()): a server can send its headers at once and stall halfway
// through the body, and an abort is the only thing that ends that. Without
// `read`, the deadline ends when the headers arrive (a fire-and-forget request
// that only needs to have been made, like the audio warm-up).
//
// A caller's own `signal` still works: aborting it aborts the request.

// 15 s: an API page, a tafsir entry or a font is a few KB to ~100 KB and comes
// back in well under a second on a slow phone; one that has not started in 15 s
// is not going to. Bigger downloads pass a longer one.
export const DEFAULT_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  constructor(url, timeoutMs) {
    super(`No answer from ${url} within ${timeoutMs} ms`);
    this.name = 'RequestTimeoutError';
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

// A response that came back but not with a 2xx.
export class HttpStatusError extends Error {
  constructor(url, status) {
    super(`${url} answered ${status}`);
    this.name = 'HttpStatusError';
    this.url = url;
    this.status = status;
  }
}

// Did the REQUEST fail (offline, refused, aborted, timed out, a non-2xx) rather
// than the content? Worth asking again later; a file that arrived but cannot be
// used is not. fetch itself rejects with a TypeError when the network fails.
export const isRequestFailure = (err) =>
  err instanceof RequestTimeoutError
  || err instanceof HttpStatusError
  || err?.name === 'TypeError'
  || err?.name === 'AbortError';

export async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, signal, read, ...init } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const forward = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
  }
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return read ? await read(res) : res;
  } catch (err) {
    throw timedOut ? new RequestTimeoutError(url, timeoutMs) : err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

// The parsed JSON of a 2xx response; anything else throws (HttpStatusError for a
// non-2xx, RequestTimeoutError past the deadline, the fetch's own error offline).
export const fetchJSON = (url, options = {}) => fetchWithTimeout(url, {
  ...options,
  read: async (res) => {
    if (!res.ok) throw new HttpStatusError(url, res.status);
    return res.json();
  },
});
