import { isRequestFailure } from './fetchWithTimeout';

// The one place an unexpected client error is reported (M-14).
//
// Today that is the browser console. It is also the hook for an error-reporting
// service: the error boundaries (components/ErrorBoundary.jsx) and the window's
// global handlers below all come through here, so wiring one in is a change to
// this file alone. With Sentry (the audit's suggestion — whether to use it, and
// its DSN, are the owner's call) it would be, after Sentry.init in main.jsx:
//
//   Sentry.captureException(error, { extra: context });
//
// `context` says where the error came from: { source, ...details }.
export function reportError(error, context = {}) {
  console.error(`Reported error (${context.source ?? 'app'}):`, error, context);
}

// Errors no boundary sees: a throw in an event handler, a timer or a promise
// nobody caught. The browser logs these too; this sends them to the same hook.
export function installGlobalErrorHandlers(win = window) {
  win.addEventListener('error', (event) => {
    reportError(event.error ?? new Error(event.message), {
      source: 'window.error',
      file: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });
  win.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
}

// A screen's data could not be loaded (M-14). Every loader's catch comes here
// instead of dropping the error. A failed REQUEST — offline, a timeout, a server
// still waking up, an error status — happens to everyone now and then and is
// not a bug: it is logged with what failed and how, and the screen offers Retry.
// Anything else — a reply that could not be read, a bug in the loader — would
// fail the same way on every Retry, so it is reported like any other error.
// The API's requests (axios) and other hosts' (fetchWithTimeout) both count as
// requests. Returns which it was, 'request' or 'content', so a screen can say
// "check your connection" only when that is the likely cause.
export function reportLoadFailure(error, what) {
  if (error?.isAxiosError || isRequestFailure(error)) {
    console.warn(`Couldn't load ${what}:`, {
      name: error.name,
      status: error.response?.status ?? error.status,
      code: error.code,
      url: error.config?.url ?? error.url,
    });
    return 'request';
  }
  reportError(error, { source: 'load', what });
  return 'content';
}
