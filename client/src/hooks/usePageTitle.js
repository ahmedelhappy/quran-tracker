import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setTitleBase } from '../utils/documentTitle';

// Every route's tab title (L-09). Before, every page — the public Library and
// About included — had index.html's one title, so tabs, history entries and a
// screen reader's page-change announcement could not tell them apart.
export const PAGE_TITLE_KEYS = {
  '/': 'titles.home',
  '/about': 'titles.about',
  '/library': 'titles.library',
  '/login': 'titles.login',
  '/register': 'titles.register',
  '/dashboard': 'titles.dashboard',
  '/onboarding': 'titles.onboarding',
  '/progress': 'titles.progress',
  '/settings': 'titles.settings',
  '/leaderboard': 'titles.leaderboard',
};

// "Settings · Quran Tracker"; the home page carries the full tagline.
export const pageTitle = (pathname, t) => {
  const key = PAGE_TITLE_KEYS[pathname] ?? PAGE_TITLE_KEYS['/'];
  return key === PAGE_TITLE_KEYS['/'] ? t(key) : `${t(key)} · ${t('titles.app')}`;
};

// Sets the title for the current route, again whenever the route or the
// language changes. Used once, inside the router (App.jsx).
export const usePageTitle = () => {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const title = pageTitle(pathname, t);
  useEffect(() => { setTitleBase(title); }, [title, i18n.language]);
};
