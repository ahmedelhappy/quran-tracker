import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpStatusError, NetworkError } from './fetchWithTimeout';
import { reportError, installGlobalErrorHandlers, reportLoadFailure } from './reportError';

afterEach(() => vi.restoreAllMocks());

describe('reportError (M-14)', () => {
  it('logs the error with where it came from', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    reportError(err, { source: 'error-boundary', region: 'tafsir' });
    expect(log).toHaveBeenCalledWith('Reported error (error-boundary):', err, { source: 'error-boundary', region: 'tafsir' });
  });

  it('the global handlers send uncaught errors and unhandled rejections to it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const win = new EventTarget();
    installGlobalErrorHandlers(win);

    const thrown = new TypeError('x is undefined');
    const errorEvent = new Event('error');
    Object.assign(errorEvent, { error: thrown, message: thrown.message, filename: 'app.js', lineno: 3, colno: 7 });
    win.dispatchEvent(errorEvent);
    expect(log).toHaveBeenLastCalledWith('Reported error (window.error):', thrown, expect.objectContaining({ file: 'app.js', line: 3, column: 7 }));

    const rejection = new Event('unhandledrejection');
    rejection.reason = new Error('nobody caught me');
    win.dispatchEvent(rejection);
    expect(log).toHaveBeenLastCalledWith('Reported error (unhandledrejection):', rejection.reason, { source: 'unhandledrejection' });
  });

  it('an error event with no error object still reports its message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const win = new EventTarget();
    installGlobalErrorHandlers(win);
    const ev = new Event('error');
    ev.message = 'Script error.';
    win.dispatchEvent(ev);
    expect(log.mock.calls[0][1]).toBeInstanceOf(Error);
    expect(log.mock.calls[0][1].message).toBe('Script error.');
  });
});

describe('reportLoadFailure (M-14)', () => {
  it('a failed API request is logged with how it failed, not reported', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const timeout = Object.assign(new Error('timeout of 20000ms exceeded'), {
      name: 'AxiosError', isAxiosError: true, code: 'ECONNABORTED', config: { url: '/progress/today' },
    });
    expect(reportLoadFailure(timeout, "today's plan")).toBe('request');
    const status = Object.assign(new Error('Request failed with status code 503'), {
      name: 'AxiosError', isAxiosError: true, response: { status: 503 }, config: { url: '/bookmarks' },
    });
    expect(reportLoadFailure(status, 'bookmarks')).toBe('request');
    expect(warn).toHaveBeenNthCalledWith(1, "Couldn't load today's plan:", { name: 'AxiosError', status: undefined, code: 'ECONNABORTED', url: '/progress/today' });
    expect(warn).toHaveBeenNthCalledWith(2, "Couldn't load bookmarks:", expect.objectContaining({ status: 503, url: '/bookmarks' }));
    expect(error).not.toHaveBeenCalled();
  });

  it("another host's failed request (fetchWithTimeout) is a request failure too", () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(reportLoadFailure(new HttpStatusError('https://api.example/x', 502), 'tafsir')).toBe('request');
    expect(reportLoadFailure(new NetworkError('https://api.example/x', new TypeError('Failed to fetch')), 'tafsir')).toBe('request');
  });

  it('a reply that could not be read, or a bug, is reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError("Cannot read properties of undefined (reading 'data')");
    expect(reportLoadFailure(bug, 'progress')).toBe('content');
    expect(error).toHaveBeenCalledWith('Reported error (load):', bug, { source: 'load', what: 'progress' });
  });
});
