import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ChangePasswordCard, CommunityCard, EditProgressModal } from './Settings';
import { authAPI } from '../services/api';

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

// A refusal the server sends is said where it applies too, not only in a toast.
const refusal = (code) => Object.assign(new Error(code), { isAxiosError: true, response: { status: 400, data: { code } } });
const offline = () => Object.assign(new Error('Network Error'), { isAxiosError: true, request: {} });

describe('Settings says the server\'s refusals next to the field (M-12)', () => {
  afterEach(cleanup);

  const fillPassword = (current) => {
    const values = { current, newPw: 'brand-new-pass', confirm: 'brand-new-pass' };
    for (const [key, value] of Object.entries(values)) {
      fireEvent.change(document.getElementById(`settings-pw-${key}`), { target: { value } });
    }
    fireEvent.submit(document.getElementById('settings-pw-current').closest('form'));
  };

  it('change password: a wrong current password is said on that field, which takes focus', async () => {
    auth.changePassword = vi.fn().mockRejectedValue(refusal('WRONG_PASSWORD'));
    render(<ChangePasswordCard />);
    fillPassword('not-my-password');
    const current = document.getElementById('settings-pw-current');
    await vi.waitFor(() => expect(current.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(current.getAttribute('aria-describedby')).textContent).toBe('errors.WRONG_PASSWORD');
    expect(document.activeElement).toBe(current);
    expect(showToast).toHaveBeenLastCalledWith('errors.WRONG_PASSWORD', 'error');
  });

  it('change password: a failure about no field is said under the button, with every field left valid', async () => {
    auth.changePassword = vi.fn().mockRejectedValue(offline());
    render(<ChangePasswordCard />);
    fillPassword('my-password-1');
    await vi.waitFor(() => expect(screen.getByText('errors.NETWORK')).toBeTruthy());
    for (const key of ['current', 'newPw', 'confirm']) {
      expect(document.getElementById(`settings-pw-${key}`).getAttribute('aria-invalid')).toBe('false');
    }
  });

  it('community: a display name the server refuses is said under the field', async () => {
    authAPI.updateProfile.mockRejectedValueOnce(refusal('DISPLAY_NAME_LENGTH'));
    render(<CommunityCard />);
    const name = document.getElementById('settings-public-name');
    fireEvent.change(name, { target: { value: 'Abdullah' } });
    fireEvent.click(name.parentElement.querySelector('button'));
    await vi.waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('errors.DISPLAY_NAME_LENGTH')).toBeTruthy();
    expect(document.activeElement).toBe(name);
  });

  it('community: a network failure stays a toast and marks no field', async () => {
    authAPI.updateProfile.mockRejectedValueOnce(offline());
    render(<CommunityCard />);
    const name = document.getElementById('settings-public-name');
    fireEvent.change(name, { target: { value: 'Abdullah' } });
    fireEvent.click(name.parentElement.querySelector('button'));
    await vi.waitFor(() => expect(showToast).toHaveBeenLastCalledWith('errors.NETWORK', 'error'));
    expect(name.getAttribute('aria-invalid')).toBe('false');
  });
});

describe('Settings progress editor ranges (M-12)', () => {
  afterEach(cleanup);

  it('a range field points at its error only while that error is on screen', () => {
    render(
      <EditProgressModal isOpen onClose={() => {}} onSave={() => {}} onRetryLoad={() => {}}
        progressLoad="ready" memorizedPageNums={[]} partialPages={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'onboarding.byRange' }));
    const start = screen.getByRole('spinbutton', { name: 'settings.rangeStart' });
    fireEvent.change(start, { target: { value: '700' } });
    const described = () => start.getAttribute('aria-describedby');
    expect(described()).toBe('settings-range-error-0');
    expect(document.getElementById(described())).not.toBeNull();
    // Asking to delete the row swaps its error line for the confirm.
    fireEvent.click(start.parentElement.querySelector('button'));
    expect(screen.getByText('settings.rangeDeleteConfirmBtn')).toBeTruthy();
    expect(document.getElementById('settings-range-error-0')).toBeNull();
    expect(described()).toBeNull();
  });
});
