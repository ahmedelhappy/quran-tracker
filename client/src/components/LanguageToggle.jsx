import { useTranslation } from 'react-i18next';
import { FiGlobe } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import Tooltip from './Tooltip';

// The app's single language-switching code path. Calling i18n.changeLanguage
// persists the choice (detector cache → localStorage 'lang') and App.jsx's
// language effect updates document.documentElement.lang/dir. Logged-in users
// additionally get the preference saved on their profile.
//
// The 'langExplicit' flag marks this as a deliberate choice (as opposed to the
// language i18next merely fell back to) — AuthContext reads it to decide which
// direction to sync in in on the next login/refresh: an explicit choice made
// before the profile could be updated (e.g. toggled while logged out) is
// pushed UP to the account rather than a stale saved value pulling it back.
const LanguageToggle = ({ variant = 'icon', className = '' }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';
  const nextLang = isArabic ? 'en' : 'ar';

  const toggle = () => {
    i18n.changeLanguage(nextLang);
    localStorage.setItem('lang', nextLang);
    localStorage.setItem('langExplicit', '1');
    if (user) {
      authAPI.updateProfile({ language: nextLang }).catch(() => {});
    }
  };

  if (variant === 'menu') {
    return (
      <button
        onClick={toggle}
        className={`px-4 py-2.5 text-sm font-medium text-emerald-800/60 dark:text-gray-400 rounded-lg flex items-center gap-2 ${className}`}
      >
        <FiGlobe className="w-4 h-4" />
        {isArabic ? 'English' : 'العربية'}
      </button>
    );
  }

  return (
    <Tooltip label={t('tooltips.language')}>
      <button
        onClick={toggle}
        aria-label={t('tooltips.language')}
        className={`text-[#064e3b] dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-xs font-bold w-8 h-8 flex items-center justify-center ${className}`}
      >
        {isArabic ? 'EN' : 'AR'}
      </button>
    </Tooltip>
  );
};

export default LanguageToggle;
