import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { authAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useHeadMeta } from '../hooks/useHeadMeta';
import { apiErrorMessage } from '../utils/apiError';
import { reportError } from '../utils/reportError';
import { newPasswordProblem } from '../utils/passwordRules';
import AuthCard, { authLinkCls } from '../components/AuthCard';
import Tooltip from '../components/Tooltip';

// The emailed link is /reset-password#token=… (H-06). The token is in the
// fragment, which the browser sends to no server — not the static host, not
// the API, not any Referer. It is read once, here, and then wiped from the
// address bar and from this history entry, so it does not linger in history,
// a bookmark, or a screenshot of the URL.
const TOKEN_IN_HASH = /(?:^#|&)token=([A-Za-z0-9_-]+)/;
const readResetToken = (hash) => hash.match(TOKEN_IN_HASH)?.[1] ?? null;

const ResetPassword = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  useHeadMeta('robots', 'noindex');
  useHeadMeta('referrer', 'no-referrer');

  const [token] = useState(() => readResetToken(window.location.hash));
  useEffect(() => {
    if (!window.location.hash) return;
    // A browser may refuse (Safari throttles replaceState, a sandboxed frame
    // forbids it). The token is already read, so the page works on; the throw
    // must not reach an error boundary and take the form away with it. The
    // report carries no URL: the one still in the address bar has the token.
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    } catch (err) {
      reportError(err, { source: 'reset-password: clearing the token from the URL' });
    }
  }, []);

  // No token, or the server refused it: the link is dead, and the only way on
  // is a new one. The server's one code covers unknown, used and expired alike.
  const [linkDead, setLinkDead] = useState(!token);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const titleRef = useRef(null);

  // The same inline-error pattern as Register (M-12): said under the field it is
  // about, or under the form, tied to it, rendered before focus moves there.
  const [error, setError] = useState(null); // { field: 'password' | 'confirm' | 'form', message } | null
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setError(null); };
  const fail = (field, message) => {
    flushSync(() => setError({ field, message }));
    if (field !== 'form') document.getElementById(field === 'confirm' ? 'confirmPassword' : 'password')?.focus();
    showToast(message, 'error');
  };
  const errorFor = (field) => (error?.field === field || error?.field === 'form'
    ? { 'aria-invalid': true, 'aria-describedby': `reset-error-${error.field}` }
    : {});
  const errorText = (field) => (error?.field === field
    ? <p id={`reset-error-${field}`} className="text-xs text-[#ba1a1a] dark:text-red-400 mt-1">{error.message}</p>
    : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { fail('confirm', t('auth.passwordsMismatch')); return; }
    const pwProblem = newPasswordProblem(form.password);
    if (pwProblem === 'tooShort') { fail('password', t('auth.passwordTooShort')); return; }
    if (pwProblem === 'tooLong') { fail('password', t('auth.passwordTooLong')); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, form.password);
      // The reset ended every session, this device's included: let it go here
      // too, rather than leave a dead token to bounce the next request.
      if (isAuthenticated) logout();
      showToast(t('auth.reset.done'), 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setLoading(false);
      const code = err?.response?.data?.code;
      if (code === 'RESET_TOKEN_INVALID') {
        flushSync(() => setLinkDead(true));
        titleRef.current?.focus();
      } else if (code === 'PASSWORD_TOO_SHORT') fail('password', t('auth.passwordTooShort'));
      else if (code === 'PASSWORD_TOO_LONG') fail('password', t('auth.passwordTooLong'));
      else fail('form', apiErrorMessage(err, t, 'common.error'));
    }
  };

  const backToLogin = (
    <p className="mt-6 text-center">
      <Link to="/login" className={authLinkCls}>{t('auth.backToLogin')}</Link>
    </p>
  );

  if (linkDead) {
    return (
      <AuthCard title={t('auth.reset.invalidTitle')} titleRef={titleRef}>
        <p className="text-center text-[#404944] dark:text-gray-300">{t('auth.reset.invalid')}</p>
        <div className="mt-6">
          <Link to="/forgot-password"
            className="block w-full text-center bg-[#064e3b] text-white py-3 rounded-lg font-medium hover:bg-[#004f35] transition-colors">
            {t('auth.reset.requestNew')}
          </Link>
        </div>
        {backToLogin}
      </AuthCard>
    );
  }

  const inputCls = 'w-full ps-10 pe-10 py-3 bg-[#f0f3ff] dark:bg-gray-700 border-transparent dark:border-gray-600 rounded-lg text-sm text-[#151c27] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#064e3b] transition-all dark:placeholder:text-gray-500';
  const labelCls = 'block text-xs font-medium text-[#404944] dark:text-gray-200 mb-1';
  const eye = (shown, toggle) => (
    <Tooltip label={shown ? t('tooltips.hidePassword') : t('tooltips.showPassword')} className="absolute end-3 top-1/2 -translate-y-1/2">
      <button type="button" onClick={toggle} className="text-[#707974] dark:text-gray-400 hover:text-[#404944]">
        {shown ? <FiEyeOff className="w-4 h-4" aria-hidden="true" /> : <FiEye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </Tooltip>
  );

  return (
    <AuthCard title={t('auth.reset.title')} subtitle={t('auth.reset.subtitle')} titleRef={titleRef}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="password">{t('auth.reset.newPassword')}</label>
          <div className="relative">
            <FiLock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404944] dark:text-gray-400" aria-hidden="true" />
            <input id="password" type={showPw ? 'text' : 'password'} autoComplete="new-password" required
              {...errorFor('password')}
              aria-describedby={errorFor('password')['aria-describedby'] ?? 'reset-hint'}
              value={form.password} onChange={set('password')} placeholder={t('auth.passwordPlaceholder')} className={inputCls} />
            {eye(showPw, () => setShowPw(!showPw))}
          </div>
          {errorText('password') ?? <p id="reset-hint" className="text-xs text-[#707974] dark:text-gray-400 mt-1">{t('auth.reset.hint')}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
          <div className="relative">
            <FiLock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404944] dark:text-gray-400" aria-hidden="true" />
            <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" required
              {...errorFor('confirm')}
              value={form.confirm} onChange={set('confirm')} placeholder={t('auth.confirmPlaceholder')} className={inputCls} />
            {eye(showConfirm, () => setShowConfirm(!showConfirm))}
          </div>
          {errorText('confirm')}
        </div>
        {errorText('form')}
        <button type="submit" disabled={loading}
          className="w-full bg-[#064e3b] text-white py-3 rounded-lg font-medium hover:bg-[#004f35] transition-colors disabled:opacity-60">
          {loading ? t('auth.reset.saving') : t('auth.reset.submit')}
        </button>
      </form>
      {backToLogin}
    </AuthCard>
  );
};

export default ResetPassword;
