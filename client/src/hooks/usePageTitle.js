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
  '/forgot-password': 'titles.forgotPassword',
  '/reset-password': 'titles.resetPassword',
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

// The pages a search engine may index (the sitemap lists the same ones,
// client/siteMeta.js); the rest need an account and get no canonical link.
export const INDEXABLE = new Set(['/', '/about', '/library']);

// <link rel="canonical"> for an indexable route, on the site's own origin
// (VITE_SITE_URL, resolved at build time), so a preview deploy or a ?page=
// variant of /library points search engines at the one real address. Without
// an origin, or on any other route, there is none.
export const syncCanonical = (pathname, origin = import.meta.env.VITE_SITE_URL) => {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!origin || !INDEXABLE.has(pathname)) { link?.remove(); return; }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = origin + pathname;
};

// Sets the title (and canonical link) for the current route, again whenever
// the route or the language changes. Used once, inside the router (App.jsx).
export const usePageTitle = () => {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const title = pageTitle(pathname, t);
  useEffect(() => { setTitleBase(title); }, [title, i18n.language]);
  useEffect(() => { syncCanonical(pathname); }, [pathname]);
};
