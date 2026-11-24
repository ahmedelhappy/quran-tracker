import { describe, it, expect, vi, afterEach } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import i18n from 'i18next';
import { apiErrorMessage } from './apiError';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

// A real i18next instance over the real locale files, so the test sees exactly
// the strings a reader would.
const make = async (lng) => {
  const inst = i18n.createInstance();
  await inst.init({ lng, resources: { en: { translation: en }, ar: { translation: ar } }, interpolation: { escapeValue: false } });
  return inst.t.bind(inst);
};
const failed = (status, data) => Object.assign(new Error('Request failed'), { response: { status, data } });

describe('apiErrorMessage (L-08)', () => {
  it('shows the Arabic login error in Arabic, not the server\'s English', async () => {
    const t = await make('ar');
    const err = failed(401, { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    expect(apiErrorMessage(err, t)).toBe('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    expect(apiErrorMessage(err, await make('en'))).toBe('Invalid email or password');
  });

  it('falls back to the caller\'s own string for a code with no sentence of its own', async () => {
    const t = await make('ar');
    const err = failed(400, { code: 'INVALID_REQUEST', message: 'type must be "new" or "review"' });
    expect(apiErrorMessage(err, t)).toBe(ar.common.error);
    expect(apiErrorMessage(err, t, 'settings.password.failed')).toBe(ar.settings.password.failed);
  });

  it('never shows the server message, even when there is no code at all', async () => {
    const t = await make('en');
    expect(apiErrorMessage(failed(500, { message: 'db exploded' }), t)).toBe(en.common.error);
    expect(apiErrorMessage(failed(400, { code: '<script>', message: 'x' }), t)).toBe(en.common.error);
  });

  // What axios rejects with when a request was sent and no reply came back.
  const noReply = (code, message) => new AxiosError(message, code, {}, {});

  it('says the server could not be reached only when a request got no reply', async () => {
    const t = await make('ar');
    expect(apiErrorMessage(noReply('ERR_NETWORK', 'Network Error'), t)).toBe(ar.errors.NETWORK);
    expect(apiErrorMessage(new CanceledError(), t)).toBe(ar.common.error);
  });

  it('says the server is slow, not unreachable, when the request timed out', async () => {
    const t = await make('ar');
    expect(apiErrorMessage(noReply('ECONNABORTED', 'timeout of 60000ms exceeded'), t)).toBe(ar.errors.TIMEOUT);
    expect(apiErrorMessage(noReply('ETIMEDOUT', 'timeout exceeded'), await make('en'))).toBe(en.errors.TIMEOUT);
  });

  describe('an error that is not a failed request', () => {
    afterEach(() => vi.restoreAllMocks());

    it('is reported as a bug and gets the caller\'s fallback, not "check your connection"', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = await make('en');
      // A plain Error that merely says "Network Error", and a throw in the caller's own code.
      const lookalike = new Error('Network Error');
      expect(apiErrorMessage(lookalike, t, 'auth.registrationFailed')).toBe(en.auth.registrationFailed);
      const bug = new TypeError("Cannot destructure property 'token' of undefined");
      expect(apiErrorMessage(bug, t)).toBe(en.common.error);
      expect(logged.mock.calls.map((c) => c[1])).toEqual([lookalike, bug]);
      expect(logged.mock.calls[0][2]).toEqual({ source: 'apiErrorMessage' });
    });

    it('is not reported when it is a real request failure or a cancel', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = await make('en');
      apiErrorMessage(noReply('ERR_NETWORK', 'Network Error'), t);
      apiErrorMessage(new CanceledError(), t);
      apiErrorMessage(failed(500, { code: 'SERVER_ERROR' }), t);
      expect(logged).not.toHaveBeenCalled();
    });
  });
});
