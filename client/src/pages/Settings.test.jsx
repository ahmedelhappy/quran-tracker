import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ChangePasswordCard, CommunityCard } from './Settings';

const showToast = vi.fn();
const auth = { user: { displayName: '', leaderboardOptIn: false }, updateUser: vi.fn(), changePassword: vi.fn() };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: () => {} }) }));
// Translation keys stand in for the text, so the test needs no locale files.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) }));
vi.mock('../i18n', () => ({ switchLanguage: vi.fn() }));
vi.mock('../services/api', () => ({ authAPI: { updateProfile: vi.fn() }, progressAPI: {} }));
vi.mock('../components/Tooltip', () => ({ default: ({ children }) => children }));

// What a screen reader finds on the field at the moment focus lands on it.
const onFocusOf = (el) => {
  const seen = [];
  el.addEventListener('focus', () => {
    const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    seen.push({
      invalid: el.getAttribute('aria-invalid'),
      description: ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' | ') || null,
    });
  });
  return seen;
};

describe('Settings fields say their error before they take focus (M-12)', () => {
  afterEach(cleanup);

  it('change password: a client-side refusal', () => {
    render(<ChangePasswordCard />);
    const current = document.getElementById('settings-pw-current');
    const seen = onFocusOf(current);
    fireEvent.submit(current.closest('form'));
    expect(document.activeElement).toBe(current);
    expect(seen).toEqual([{ invalid: 'true', description: 'settings.password.allRequired' }]);
  });

  it('community: a display name that is too short', () => {
    render(<CommunityCard />);
    const name = document.getElementById('settings-public-name');
    const seen = onFocusOf(name);
    fireEvent.change(name, { target: { value: 'ab' } });
    fireEvent.click(name.parentElement.querySelector('button'));
    expect(document.activeElement).toBe(name);
    expect(seen).toEqual([{ invalid: 'true', description: 'settings.community.nameTooShort | settings.community.displayNameHint' }]);
  });
});
