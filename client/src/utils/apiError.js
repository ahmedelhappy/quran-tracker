// What to tell the reader when an API request failed, in their language.
//
// The server's `message` is English, and showing it put English sentences into
// the Arabic interface — the Arabic login form said "Invalid email or password"
// (L-08). Every error the server sends now carries a stable `code` as well
// (server/middleware/errorCode.js), and the strings for the codes a person can
// act on live in the locale files under `errors.`. Anything else — a code with
// no string of its own, or no response at all — gets the caller's own fallback,
// already in the reader's language. The server's message is never shown.
//
// `t` is the caller's translate function, so the text follows the active language.
export const apiErrorMessage = (err, t, fallbackKey = 'common.error') => {
  const response = err?.response;
  if (!response) {
    // Cancelled on purpose (a newer request replaced it): not worth a sentence.
    if (err?.code === 'ERR_CANCELED') return t(fallbackKey);
    return t('errors.NETWORK');
  }
  const code = response.data?.code;
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code)) {
    return t(`errors.${code}`, { defaultValue: t(fallbackKey) });
  }
  return t(fallbackKey);
};
