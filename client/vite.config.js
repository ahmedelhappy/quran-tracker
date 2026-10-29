import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const CLIENT_DIR = fileURLToPath(new URL('.', import.meta.url))

// A build bakes the API's address into the bundle (services/api.js), so one
// made without it would ship a site whose every sign-in fails. Stop the build
// instead. `vite` (dev) and Vitest are not builds and keep the localhost
// fallback. loadEnv sees both the shell's environment and client/.env*.
const requireApiUrl = (mode) => {
  const url = loadEnv(mode, CLIENT_DIR, 'VITE_').VITE_API_URL?.trim()
  const hint = 'Set it to the API\'s base URL, e.g. VITE_API_URL=https://<your-api-host>/api ' +
    '(in client/.env for a local build, in the hosting project\'s environment variables for a deploy).'
  if (!url) throw new Error(`VITE_API_URL is not set, so this build would not know where the API is.\n${hint}`)
  let parsed
  try { parsed = new URL(url) } catch { parsed = null }
  if (!parsed || !/^https?:$/.test(parsed.protocol)) {
    throw new Error(`VITE_API_URL is not an http(s) URL: "${url}".\n${hint}`)
  }
}

// Each language's strings are a JSON file of their own (src/i18n.js), and the
// app renders only once the active one has arrived. Left to itself, that file
// is requested only after the entry chunk has downloaded and run: one more
// round trip before the first paint. This adds a tiny script to index.html that
// starts fetching the visitor's language (the same localStorage 'lang' i18n.js
// reads, English otherwise) next to the entry chunk. It is a file, not an
// inline script, so the Content-Security-Policy can keep script-src 'self'.
// The preload is as=fetch with crossorigin, the request i18n.js's fetch() makes,
// so the browser hands that fetch the preloaded response instead of a second one.
const preloadActiveLocale = () => {
  let base = '/'
  return {
    name: 'preload-active-locale',
    apply: 'build',
    // After Vite's own HTML plugin, so index.html is already in the bundle.
    enforce: 'post',
    configResolved(config) { base = config.base },
    generateBundle(_, bundle) {
      const fileFor = (lng) => Object.values(bundle).find(
        (f) => f.type === 'asset' && f.originalFileNames?.some(
          (name) => name.replace(/\\/g, '/').endsWith(`src/locales/${lng}.json`),
        ),
      )?.fileName
      const en = fileFor('en')
      const ar = fileFor('ar')
      const html = bundle['index.html']
      if (!en || !ar || !html) this.error('preload-active-locale: the locale files or index.html are missing')
      const source = `(function () {
  var lang;
  try { lang = localStorage.getItem('lang'); } catch (e) { /* storage blocked: English */ }
  var link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'fetch';
  link.crossOrigin = 'anonymous';
  link.href = ${JSON.stringify(base)} + (lang === 'ar' ? ${JSON.stringify(ar)} : ${JSON.stringify(en)});
  document.head.appendChild(link);
})();
`
      const hash = createHash('sha256').update(source).digest('base64url').slice(0, 8)
      const fileName = `assets/locale-preload-${hash}.js`
      this.emitFile({ type: 'asset', fileName, source })
      const tag = `<script async src="${base}${fileName}"></script>\n    `
      const html2 = String(html.source).replace(/<script type="module"/, (m) => tag + m)
      if (html2 === html.source) this.error('preload-active-locale: no module script in index.html')
      html.source = html2
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') requireApiUrl(mode)
  return {
    plugins: [react(), preloadActiveLocale()],
    build: {
      // Never inline a font as a data: URL, however small: the self-hosted UI
      // fonts (src/fonts.css) must stay files, so they are cached on their own
      // and the Content-Security-Policy's font-src can stay 'self' only.
      assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    },
    // Vitest reads this block; `vite build` ignores it. Unit tests sit next to the
    // code they cover (src/**/*.test.js); the Playwright flows in e2e/ are a
    // separate runner and must not be picked up here.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
  }
})
