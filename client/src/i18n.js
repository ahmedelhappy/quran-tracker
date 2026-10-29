import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Each language is a chunk of its own, fetched when it is first needed: at start
// only the active one (the other is ~20 KB gzipped a visitor would download for
// nothing — both used to sit in the entry chunk, M-09), the other on a switch.
const LOCALES = {
  en: () => import('./locales/en.json'),
  ar: () => import('./locales/ar.json'),
};

// A minimal i18next backend over those imports. A failed fetch is retried by
// i18next itself (a few times, backing off) before a language is given up on.
const localeChunks = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const load = LOCALES[language];
    if (!load) return callback(null, {});
    load().then((mod) => callback(null, mod.default), (err) => callback(err, null));
  },
};

// Everything that changes the language (LanguageToggle, Settings, the account's
// saved language in AuthContext) goes through i18n.changeLanguage, which loads
// the new language's chunk BEFORE switching — the screen stays in the old
// language for that moment, never showing raw keys.
//
// main.jsx renders only once this has settled, so the first paint already has
// the active language's strings: no flash of untranslated keys.
export const i18nReady = i18n
  .use(localeChunks)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'ar'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'lang',
    },
    // English for anything unexpected, but Arabic falls back to nothing: a
    // fallback language is loaded alongside the active one, which would put
    // English back on every Arabic first load. ar.json has every English key
    // (src/locales/locales.test.js keeps it that way), so nothing is missed.
    fallbackLng: { ar: [], default: ['en'] },
    interpolation: { escapeValue: false },
  })
  .then(() => {
    // Before the first paint, so an Arabic page is right-to-left from its first
    // frame (App.jsx keeps these in step after a switch).
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir();
  });

export default i18n;
