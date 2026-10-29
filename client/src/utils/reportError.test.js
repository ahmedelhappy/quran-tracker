import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportError, installGlobalErrorHandlers } from './reportError';

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
