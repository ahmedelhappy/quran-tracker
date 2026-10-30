import { reportError } from './reportError';

// What to tell the reader when an API request failed, in their language.
//
// The server's `message` is English, and showing it put English sentences into
// the Arabic interface — the Arabic login form said "Invalid email or password"
// (L-08). Every error the server sends now carries a stable `code` as well
// (server/middleware/errorCode.js), and the strings for the codes a person can
// act on live in the locale files under `errors.`. Anything else — a code with
// no string of its own — gets the caller's own fallback, already in the
// reader's language. The server's message is never shown.
//
// `t` is the caller's translate function, so the text follows the active language.

// axios's codes for a request that ran out of time: ECONNABORTED, or ETIMEDOUT
// when the instance asks for clearer timeout errors.
const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

export const apiErrorMessage = (err, t, fallbackKey = 'common.error') => {
  const response = err?.response;
  if (!response) {
    // Cancelled by the caller's own AbortSignal: nothing failed that a sentence
    // about the network would explain. (No API call cancels today.)
    if (err?.code === 'ERR_CANCELED') return t(fallbackKey);
    // Sent, and no reply: the network, or the server, which may also just be slow.
    if (err?.isAxiosError && err.request) {
      return t(TIMEOUT_CODES.has(err.code) ? 'errors.TIMEOUT' : 'errors.NETWORK');
    }
    // Not a failed request at all — a throw in the caller's own code, or a reply
    // it could not read. "Check your connection" would send the person looking
    // in the wrong place and hide the bug, so report it and say the fallback.
    reportError(err, { source: 'apiErrorMessage' });
    return t(fallbackKey);
  }
  const code = response.data?.code;
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)) {
    return t(`errors.${code}`, { defaultValue: t(fallbackKey) });
  }
  return t(fallbackKey);
};
