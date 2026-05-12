import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import { FiSettings, FiGlobe, FiMoon, FiSun, FiMenu, FiX, FiLogOut, FiUser } from 'react-icons/fi';
import Logo from './Logo';

const NAV_LINKS = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/progress',  labelKey: 'nav.progress' },
  { to: '/library',   labelKey: 'nav.library' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
    setAvatarOpen(false);
  };

  const isActive = (to) => to && location.pathname === to;

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    if (user) {
      authAPI.updateProfile({ language: newLang }).catch(() => {});
    }
  };

  const isDark = theme === 'dark';

  return (
    <header className="bg-white dark:bg-gray-900 fixed top-0 w-full z-50 border-b border-emerald-100/20 dark:border-gray-700/30 sacred-shadow">
      <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <Logo size="md" />
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-6">
            {NAV_LINKS.map((link) =>
              link.disabled ? (
                <span key={link.labelKey} title={t('nav.comingSoon')} className="text-emerald-800/40 dark:text-gray-500 font-medium cursor-not-allowed select-none text-sm">
                  {t(link.labelKey)}
                </span>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-medium pb-1 transition-colors duration-200 ${
                    isActive(link.to)
                      ? 'text-[#064e3b] dark:text-emerald-400 font-semibold border-b-2 border-amber-500'
                      : 'text-emerald-800/60 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Desktop right icons */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={toggleLanguage}
            title={t('nav.language')}
            className="text-[#064e3b] dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-xs font-bold w-8 h-8 flex items-center justify-center"
          >
            {i18n.language === 'en' ? 'AR' : 'EN'}
          </button>
          <button
            title={isDark ? t('nav.lightModeTitle') : t('nav.darkModeTitle')}
            onClick={toggleTheme}
            className="text-[#064e3b] dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            {isDark ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
          </button>
          <Link
            to="/settings?tab=memorization"
            title={t('nav.settings')}
            className={`transition-colors ${isActive('/settings') ? 'text-[#064e3b] dark:text-emerald-400 border-b-2 border-amber-500 pb-1 font-semibold' : 'text-[#064e3b] dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400'}`}
          >
            <FiSettings className="w-5 h-5" />
          </Link>

          {/* Avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-8 h-8 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-sm font-bold border-2 border-amber-500 hover:opacity-90 transition-opacity"
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
                <div className="absolute right-0 top-10 z-40 bg-white dark:bg-gray-800 rounded-lg sacred-shadow border border-[#dce2f3] dark:border-gray-700 w-48 py-1 overflow-hidden">
                  <Link
                    to="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="px-4 py-2 text-[#404944] dark:text-gray-300 hover:bg-[#dce2f3]/50 dark:hover:bg-gray-700 hover:text-[#003527] dark:hover:text-gray-100 transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiUser className="w-4 h-4" /> {t('settings.profile')}
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="px-4 py-2 text-[#404944] dark:text-gray-300 hover:bg-[#dce2f3]/50 dark:hover:bg-gray-700 hover:text-[#003527] dark:hover:text-gray-100 transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiSettings className="w-4 h-4" /> {t('nav.settings')}
                  </Link>
                  <hr className="my-1 border-[#dce2f3]/50 dark:border-gray-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-[#ba1a1a] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiLogOut className="w-4 h-4" /> {t('nav.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#064e3b] dark:text-gray-400 hover:text-amber-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-t border-[#dce2f3]/50 dark:border-gray-700/50 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) =>
            link.disabled ? (
              <span key={link.labelKey} className="px-4 py-2.5 text-sm text-emerald-800/40 dark:text-gray-500">{t(link.labelKey)}</span>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg ${
                  isActive(link.to)
                    ? 'text-[#064e3b] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-emerald-800/60 dark:text-gray-400'
                }`}
              >
                {t(link.labelKey)}
              </Link>
            )
          )}
          <Link to="/settings?tab=memorization" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 text-sm font-medium text-emerald-800/60 dark:text-gray-400 rounded-lg flex items-center gap-2">
            <FiSettings className="w-4 h-4" /> {t('nav.settings')}
          </Link>
          <button
            onClick={toggleTheme}
            className="px-4 py-2.5 text-sm font-medium text-emerald-800/60 dark:text-gray-400 rounded-lg flex items-center gap-2 text-left"
          >
            {isDark ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
            {isDark ? t('nav.lightMode') : t('nav.darkMode')}
          </button>
          <button
            onClick={toggleLanguage}
            className="px-4 py-2.5 text-sm font-medium text-emerald-800/60 dark:text-gray-400 rounded-lg flex items-center gap-2 text-left"
          >
            <FiGlobe className="w-4 h-4" />
            {i18n.language === 'en' ? 'العربية' : 'English'}
          </button>
          <div className="border-t border-[#dce2f3]/50 dark:border-gray-700/50 mt-2 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-sm font-bold border-2 border-amber-500">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="text-sm font-medium text-[#151c27] dark:text-gray-100">{user?.name}</p>
                <p className="text-xs text-[#404944] dark:text-gray-400">{user?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-[#ba1a1a] text-sm font-medium flex items-center gap-1.5">
              <FiLogOut className="w-4 h-4" /> {t('nav.logout')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
