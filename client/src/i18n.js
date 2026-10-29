import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { storage } from './utils/safeStorage';
import { reloadForStaleBuild } from './utils/staleChunkReload';
import enUrl from './locales/en.json?url';
import arUrl from './locales/ar.json?url';

// Each language is a file of its own (a hashed JSON file in /assets/), fetched
// when it is first needed: at start only the active one (the other is ~20 KB
// gzipped a visitor would download for nothing — both used to sit in the entry
// chunk, M-09), the other on a switch. A production build starts fetching the
// active one next to the entry chunk (preloadActiveLocale in vite.config.js);
// keep its choice in step with the detection below.
//
// Fetched rather than import()ed: a browser remembers a failed import() for the
// rest of the page's life, so every retry, and every later switch to that
// language, failed again without even a request. A failed fetch can simply be
// tried again.
const LOCALES = { en: enUrl, ar: arUrl };

const NS = 'translation';

// A minimal i18next backend over those files.
//
// A failed fetch passes `true` as the data, not null. i18next retries a read
// only when it gets data alongside the error (maxRetries / retryTimeout below),
// and after the last try that leaves the language loadable — the next switch
// to it fetches it again — where null would mark it failed for the rest of the
// session. With an error set i18next stores nothing (it adds a bundle only when
// there is no error), so the `true` never stands in for the strings.
const localeFiles = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const url = LOCALES[language];
    if (!url) return callback(null, {});
    fetch(url)
      .then((res) => {
        if (res.ok) return res.json();
        // A tab from before a deploy asking for a file the deploy replaced.
        if (res.status === 404) reloadForStaleBuild();
        throw new Error(`HTTP ${res.status} for ${url}`);
      })
      .then((data) => callback(null, data), (err) => callback(err, true));
  },
};

// A language whose strings could not be fetched (after the retries) is logged
// here and announced by LanguageLoadNotice (App.jsx) as a toast. A failure at
// start comes before the app has rendered, so it waits for the notice to mount.
const unannounced = [];
let announce = null;
i18n.on('failedLoading', (lng, ns, err) => {
  console.error(`Could not load the "${lng}" interface strings:`, err);
  if (announce) announce(lng);
  else unannounced.push(lng);
});

export const onLanguageUnavailable = (fn) => {
  announce = fn;
  unannounced.splice(0).forEach(fn);
  return () => { if (announce === fn) announce = null; };
};

// Fetch a language's strings if they are not here yet, and switch to it only
// once they are. i18n.changeLanguage alone switches even when the fetch failed,
// and every label on the screen turns into its raw key.
const loadAndSwitch = async (lng) => {
  if (!i18n.hasResourceBundle(lng, NS)) {
    await new Promise((resolve) => i18n.reloadResources([lng], [NS], resolve));
    if (!i18n.hasResourceBundle(lng, NS)) return false;
  }
  await i18n.changeLanguage(lng);
  return true;
};

// Everything that changes the language (LanguageToggle, Settings, the account's
// saved language in AuthContext) goes through here. Resolves true once the
// screen is in `lng`, remembered for the next visit ('lang', which the detector
// below and the build's locale preload read). Resolves false when its strings
// could not be fetched: the screen stays in the language it was in, nothing is
// remembered, and the reader is told (see above) — a caller must not save the
// language to the account either.
export const switchLanguage = async (lng) => {
  if (!(await loadAndSwitch(lng))) return false;
  storage.set('lang', lng);
  return true;
};

// main.jsx renders once this has settled, so the first paint already has the
// active language's strings: no flash of untranslated keys. When they could not
// be fetched it falls back to English for this visit (the reader's choice is
// kept, so the next visit tries again). Only if English fails too does the app
// render with raw keys — and the toast says why.
export const i18nReady = i18n
  .use(localeFiles)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'ar'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'lang',
      // switchLanguage remembers a language once it has loaded. The detector's
      // own cache would write it before, and would overwrite the reader's
      // choice with the English fallback above.
      caches: [],
    },
    // English for anything unexpected, but Arabic falls back to nothing: a
    // fallback language is loaded alongside the active one, which would put
    // English back on every Arabic first load. ar.json has every English key
    // (src/locales/locales.test.js keeps it that way), so nothing is missed.
    fallbackLng: { ar: [], default: ['en'] },
    // Two retries, 300 ms then 600 ms apart: enough for a blip, and a failure
    // is reported within about a second instead of i18next's default ~11 s.
    maxRetries: 2,
    retryTimeout: 300,
    interpolation: { escapeValue: false },
  })
  .then(async () => {
    if (!i18n.hasResourceBundle(i18n.language, NS) && i18n.language !== 'en') {
      await loadAndSwitch('en');
    }
    // Before the first paint, so an Arabic page is right-to-left from its first
    // frame (App.jsx keeps these in step after a switch).
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir();
  });

export default i18n;
