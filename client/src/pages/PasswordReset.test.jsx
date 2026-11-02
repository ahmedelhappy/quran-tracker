import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Password reset pages (H-06): the sign-in link appears only when the server
// offers reset, the request page says the same thing for every address, and the
// reset page takes its token from the fragment, wipes it from the URL, and
// reports problems inline.
const api = vi.hoisted(() => ({
  getConfig: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));
const auth = vi.hoisted(() => ({ isAuthenticated: false, logout: vi.fn(), login: vi.fn() }));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({ authAPI: api }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../hooks/useToast', () => ({ useToast: () => ({ showToast }) }));
// Translation keys stand in for the text; an interpolated email is appended.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, opts) => (opts?.email ? `${key}[${opts.email}]` : key) }),
}));
vi.mock('../components/Footer', () => ({ default: () => null }));
vi.mock('../components/Logo', () => ({ default: () => null }));
vi.mock('../components/LanguageToggle', () => ({ default: () => null }));
vi.mock('../components/Tooltip', () => ({ default: ({ children }) => children }));

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v';
const axiosError = (status, code) => Object.assign(new Error(code), { isAxiosError: true, request: {}, response: { status, data: { code } } });

// The hook keeps a successful answer for the visit, so every test loads the
// modules afresh (the mocks above stay in place).
const PAGES = {
  Login: () => import('./Login.jsx'),
  ForgotPassword: () => import('./ForgotPassword.jsx'),
  ResetPassword: () => import('./ResetPassword.jsx'),
};
const load = async (name) => (await PAGES[name]()).default;

const renderAt = (path, element, extra = null) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={path.split(/[?#]/)[0]} element={element} />
      <Route path="/login" element={<div>login page</div>} />
      {extra}
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.resetModules();
  for (const fn of [...Object.values(api), auth.logout, showToast]) fn.mockReset();
  auth.isAuthenticated = false;
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('Login: "Forgot password?" (H-06)', () => {
  it('is hidden while reset is off', async () => {
    api.getConfig.mockResolvedValue({ data: { data: { passwordReset: false } } });
    const Login = await load('Login');
    renderAt('/login-form', <Login />);
    await waitFor(() => expect(api.getConfig).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText('auth.forgotPasswordLink')).toBeNull();
  });

  it('is hidden when the check fails', async () => {
    api.getConfig.mockRejectedValue(axiosError(503, 'SERVER_ERROR'));
    const Login = await load('Login');
    renderAt('/login-form', <Login />);
    await waitFor(() => expect(api.getConfig).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText('auth.forgotPasswordLink')).toBeNull();
  });

  it('is shown when reset is on, and points at the request page', async () => {
    api.getConfig.mockResolvedValue({ data: { data: { passwordReset: true } } });
    const Login = await load('Login');
    renderAt('/login-form', <Login />);
    const link = await screen.findByText('auth.forgotPasswordLink');
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });
});

describe('ForgotPassword (H-06)', () => {
  beforeEach(() => {
    api.getConfig.mockResolvedValue({ data: { data: { passwordReset: true } } });
  });

  const submit = (email) => {
    fireEvent.change(document.getElementById('email'), { target: { value: email } });
    fireEvent.submit(document.getElementById('email').closest('form'));
  };

  it('shows the same neutral confirmation for every address, and moves focus to it', async () => {
    api.forgotPassword.mockResolvedValue({ data: { success: true } });
    const ForgotPassword = await load('ForgotPassword');
    renderAt('/forgot-password', <ForgotPassword />);

    submit(' known@example.com ');
    const first = await screen.findByRole('status');
    // The address on its own left-to-right line, then the one sentence.
    expect(first.textContent).toBe('known@example.comauth.forgot.sent');
    expect(screen.getByText('known@example.com').getAttribute('dir')).toBe('ltr');
    expect(document.activeElement.textContent).toBe('auth.forgot.sentTitle');
    expect(api.forgotPassword).toHaveBeenCalledWith('known@example.com');

    fireEvent.click(screen.getByText('auth.forgot.tryAgain'));
    submit('nobody@example.com');
    const second = await screen.findByRole('status');
    // Identical wording; only the echoed address differs.
    expect(second.textContent.replace('nobody', 'known')).toBe(first.textContent);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('says what went wrong under the field, for errors the reader can act on', async () => {
    api.forgotPassword.mockRejectedValue(axiosError(429, 'RATE_LIMITED'));
    const ForgotPassword = await load('ForgotPassword');
    renderAt('/forgot-password', <ForgotPassword />);
    submit('known@example.com');
    const error = await screen.findByText('errors.RATE_LIMITED');
    const field = document.getElementById('email');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(error.id);
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says reset is unavailable, with no form, when the server has it off', async () => {
    api.getConfig.mockResolvedValue({ data: { data: { passwordReset: false } } });
    const ForgotPassword = await load('ForgotPassword');
    renderAt('/forgot-password', <ForgotPassword />);
    expect(await screen.findByText('auth.forgot.unavailable')).toBeTruthy();
    expect(document.getElementById('email')).toBeNull();
  });

  it('is kept out of search indexes', async () => {
    api.forgotPassword.mockResolvedValue({});
    const ForgotPassword = await load('ForgotPassword');
    renderAt('/forgot-password', <ForgotPassword />);
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex');
    cleanup();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});

describe('ResetPassword (H-06)', () => {
  const openLink = async (hash = `#token=${TOKEN}`) => {
    window.history.replaceState({ idx: 0 }, '', `/reset-password${hash}`);
    const ResetPassword = await load('ResetPassword');
    renderAt('/reset-password', <ResetPassword />, <Route path="/forgot-password" element={<div>request page</div>} />);
  };
  const fill = (password, confirm = password) => {
    fireEvent.change(document.getElementById('password'), { target: { value: password } });
    fireEvent.change(document.getElementById('confirmPassword'), { target: { value: confirm } });
    fireEvent.submit(document.getElementById('password').closest('form'));
  };

  it('reads the token from the fragment and wipes it from the address bar and history entry', async () => {
    await openLink();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.history.state).toEqual({ idx: 0 }); // the router's entry is kept
    expect(document.head.querySelector('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
    expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex');

    api.resetPassword.mockResolvedValue({ data: { success: true } });
    fill('a-new-password1');
    await screen.findByText('login page');
    expect(api.resetPassword).toHaveBeenCalledWith(TOKEN, 'a-new-password1');
    expect(showToast).toHaveBeenCalledWith('auth.reset.done', 'success');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('signs this device out too when someone was signed in', async () => {
    auth.isAuthenticated = true;
    await openLink();
    api.resetPassword.mockResolvedValue({ data: { success: true } });
    fill('a-new-password1');
    await screen.findByText('login page');
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('checks the same rules as sign-up, inline, before sending anything', async () => {
    await openLink();
    fill('a-new-password1', 'something-else1');
    const confirm = document.getElementById('confirmPassword');
    expect(document.activeElement).toBe(confirm);
    expect(document.getElementById(confirm.getAttribute('aria-describedby')).textContent).toBe('auth.passwordsMismatch');

    fill('short');
    const password = document.getElementById('password');
    expect(document.activeElement).toBe(password);
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(password.getAttribute('aria-describedby')).textContent).toBe('auth.passwordTooShort');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('describes the password field with the policy hint until there is an error', async () => {
    await openLink();
    const password = document.getElementById('password');
    expect(document.getElementById(password.getAttribute('aria-describedby')).textContent).toBe('auth.reset.hint');
  });

  it('turns into "ask for a new link" when the server refuses the token', async () => {
    await openLink();
    api.resetPassword.mockRejectedValue(axiosError(400, 'RESET_TOKEN_INVALID'));
    fill('a-new-password1');
    expect(await screen.findByText('auth.reset.invalid')).toBeTruthy();
    expect(document.activeElement.textContent).toBe('auth.reset.invalidTitle');
    expect(screen.getByText('auth.reset.requestNew').getAttribute('href')).toBe('/forgot-password');
  });

  it('shows a server policy refusal on the field and any other failure under the form', async () => {
    await openLink();
    api.resetPassword.mockRejectedValueOnce(axiosError(400, 'PASSWORD_TOO_LONG'));
    fill('a-new-password1');
    await waitFor(() => expect(document.getElementById('reset-error-password')?.textContent).toBe('auth.passwordTooLong'));

    api.resetPassword.mockRejectedValueOnce(axiosError(404, 'RESET_DISABLED'));
    fill('a-new-password1');
    await waitFor(() => expect(document.getElementById('reset-error-form')?.textContent).toBe('errors.RESET_DISABLED'));
    expect(document.getElementById('password').getAttribute('aria-describedby')).toBe('reset-error-form');
  });

  it('with no token in the link, offers a new link straight away', async () => {
    await openLink('');
    expect(screen.getByText('auth.reset.invalid')).toBeTruthy();
    expect(document.getElementById('password')).toBeNull();
  });
});
