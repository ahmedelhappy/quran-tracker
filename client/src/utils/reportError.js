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
