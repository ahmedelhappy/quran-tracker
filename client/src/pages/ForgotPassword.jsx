import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMail } from 'react-icons/fi';
import { authAPI } from '../services/api';
import { useToast } from '../hooks/useToast';
import { usePasswordResetAvailable } from '../hooks/usePasswordResetAvailable';
import { useHeadMeta } from '../hooks/useHeadMeta';
import { apiErrorMessage } from '../utils/apiError';
import AuthCard, { authLinkCls } from '../components/AuthCard';

// Asks the server to email a reset link (H-06). Every accepted request gets the
// same neutral confirmation, whether or not the address has an account — the
// server answers them identically, and the page must not tell them apart
// either. Only what the reader can fix (a malformed address, too many tries, no
// connection) is reported as an error.
const ForgotPassword = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const location = useLocation();
  const available = usePasswordResetAvailable();
  useHeadMeta('robots', 'noindex');
  // The sign-in form hands over what was typed there, so it need not be typed again.
  const [email, setEmail] = useState(() => (typeof location.state?.email === 'string' ? location.state.email : ''));
  const [sentTo, setSentTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const address = email.trim();
    try {
      await authAPI.forgotPassword(address);
      // The form is replaced by the confirmation; focus goes to its heading.
      flushSync(() => setSentTo(address));
      titleRef.current?.focus();
    } catch (err) {
      const message = apiErrorMessage(err, t, 'common.error');
      // Rendered before focus moves, so the field is already described by it.
      flushSync(() => setError(message));
      document.getElementById('email')?.focus();
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = (
    <p className="mt-6 text-center">
      <Link to="/login" className={authLinkCls}>{t('auth.backToLogin')}</Link>
    </p>
  );

  if (available === false) {
    return (
      <AuthCard title={t('auth.forgot.title')}>
        <p className="text-center text-[#404944] dark:text-gray-300">{t('auth.forgot.unavailable')}</p>
        {backToLogin}
      </AuthCard>
    );
  }

  if (sentTo !== null) {
    return (
      <AuthCard title={t('auth.forgot.sentTitle')} titleRef={titleRef}>
        <p role="status" className="text-center text-[#404944] dark:text-gray-300">
          {t('auth.forgot.sent', { email: sentTo })}
        </p>
        <p className="mt-6 text-center">
          <button type="button" onClick={() => setSentTo(null)} className={authLinkCls}>
            {t('auth.forgot.tryAgain')}
          </button>
        </p>
        {backToLogin}
      </AuthCard>
    );
  }

  const invalid = error ? { 'aria-invalid': true, 'aria-describedby': 'forgot-error' } : {};
  return (
    <AuthCard title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#404944] dark:text-gray-200 mb-1" htmlFor="email">{t('auth.email')}</label>
          <div className="relative">
            <FiMail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404944] dark:text-gray-400" aria-hidden="true" />
            <input
              id="email" type="email" value={email} autoComplete="email" required {...invalid}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full ps-10 pe-4 py-3 bg-[#f0f3ff] dark:bg-gray-700 border-transparent dark:border-gray-600 rounded-lg text-sm text-[#151c27] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#064e3b] transition-all dark:placeholder:text-gray-500"
            />
          </div>
          {error && <p id="forgot-error" className="text-sm text-[#ba1a1a] dark:text-red-400 mt-1">{error}</p>}
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-[#064e3b] text-white py-3 rounded-lg font-medium hover:bg-[#004f35] transition-colors disabled:opacity-60">
          {loading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
        </button>
      </form>
      {backToLogin}
    </AuthCard>
  );
};

export default ForgotPassword;
