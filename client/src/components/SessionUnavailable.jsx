import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiWifiOff, FiCloudOff, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';

// Shown in place of a page while a stored session could not be CHECKED (no
// network, a 5xx, a timeout — see checkAuth in AuthContext). The reader is
// still signed in, so this must not look like the login page: it says what
// happened, retries on demand (and by itself when the connection comes back),
// and offers signing out only as the deliberate second choice.
const SessionUnavailable = () => {
  const { t } = useTranslation();
  const { sessionError, retrySession, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const offline = sessionError === 'offline';
  const Icon = offline ? FiWifiOff : FiCloudOff;

  const retry = async () => {
    setRetrying(true);
    try { await retrySession(); } finally { setRetrying(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex items-center justify-center px-4">
      <div role="alert" className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-amber-700 dark:text-amber-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-[#151c27] dark:text-gray-100 mb-2">
          {t(offline ? 'session.offlineTitle' : 'session.serverTitle')}
        </h1>
        <p className="text-sm text-[#404944] dark:text-gray-400 mb-6 leading-relaxed">
          {t(offline ? 'session.offlineBody' : 'session.serverBody')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] dark:bg-emerald-700 dark:hover:bg-emerald-600 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            <FiRefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            {retrying ? t('session.retrying') : t('common.retry')}
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
          >
            {t('session.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
};

// The same news on a PUBLIC page (the Library, About), which stays readable
// without an account: a slim bar instead of a screen. Without it the page just
// looked signed out — with nothing saying the session was only unchecked —
// and its account features stay hidden until the check succeeds.
export const SessionNotice = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loading, sessionError, retrySession } = useAuth();
  const [retrying, setRetrying] = useState(false);
  if (loading || isAuthenticated || !sessionError) return null;
  const offline = sessionError === 'offline';
  const Icon = offline ? FiWifiOff : FiCloudOff;

  const retry = async () => {
    setRetrying(true);
    try { await retrySession(); } finally { setRetrying(false); }
  };

  return (
    <div role="status" className="bg-amber-50 dark:bg-amber-900/25 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-amber-900 dark:text-amber-200">
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{t(offline ? 'session.noticeOffline' : 'session.noticeServer')}</span>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100 disabled:opacity-60"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          {retrying ? t('session.retrying') : t('common.retry')}
        </button>
      </div>
    </div>
  );
};

export default SessionUnavailable;
