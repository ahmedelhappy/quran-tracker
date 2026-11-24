import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';

const showToast = vi.fn();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ register: vi.fn() }) }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast }) }));
// Translation keys stand in for the text, so the test needs no locale files.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/Logo', () => ({ default: () => null }));
vi.mock('../components/LanguageToggle', () => ({ default: () => null }));
vi.mock('../components/Tooltip', () => ({ default: ({ children }) => children }));

// What a screen reader finds on the field at the moment focus lands on it.
const onFocusOf = (el) => {
  const seen = [];
  el.addEventListener('focus', () => {
    const describedBy = el.getAttribute('aria-describedby');
    seen.push({
      invalid: el.getAttribute('aria-invalid'),
      description: describedBy ? document.getElementById(describedBy)?.textContent ?? null : null,
    });
  });
  return seen;
};

describe('Register (M-12)', () => {
  afterEach(cleanup);

  it('renders the inline error before the field takes focus', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);
    const password = document.getElementById('password');
    const confirm = document.getElementById('confirmPassword');
    const seen = onFocusOf(confirm);
    fireEvent.change(password, { target: { value: 'longenough1' } });
    fireEvent.change(confirm, { target: { value: 'different12' } });
    fireEvent.submit(password.closest('form'));
    expect(document.activeElement).toBe(confirm);
    expect(seen).toEqual([{ invalid: 'true', description: 'auth.passwordsMismatch' }]);
    expect(showToast).toHaveBeenCalledWith('auth.passwordsMismatch', 'error');
    expect(screen.getByText('auth.passwordsMismatch')).toBeTruthy();
  });
});
