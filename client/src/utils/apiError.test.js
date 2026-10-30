import { describe, it, expect } from 'vitest';
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

  it('says the server could not be reached when there was no response', async () => {
    const t = await make('ar');
    expect(apiErrorMessage(new Error('Network Error'), t)).toBe(ar.errors.NETWORK);
    expect(apiErrorMessage(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }), t)).toBe(ar.common.error);
  });
});
