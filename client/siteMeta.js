import { loadEnv } from 'vite'

// The site's own public address, for the sitemap, robots.txt, the share-card
// (og:/twitter:) URLs in index.html and the canonical link the app sets per
// route (L-09). It used to be the hard-coded quran-tracker-gilt.vercel.app,
// which every preview deploy, fork or move of the domain then advertised.
//
// From, in order:
//   1. VITE_SITE_URL — set it in the hosting project (and client/.env for a
//      local build) to the production origin, e.g. https://quran.example.com;
//   2. on Vercel, its VERCEL_PROJECT_PRODUCTION_URL system variable (the
//      project's production domain, the same for every deploy of it), so a
//      Vercel build is right without any setup;
//   3. neither: the build still succeeds, with a warning, but ships no sitemap,
//      no Sitemap line in robots.txt, no absolute share-card URLs and no
//      canonical link. Unlike VITE_API_URL — without which the app cannot work
//      at all, so that build fails — a missing origin only costs search and
//      link previews, and failing would stop every deploy until it is set.
// A value that is set but not a bare http(s) origin fails the build: that is a
// typo, and shipping it would advertise a broken address.

// The pages a search engine should index. Everything else needs an account.
export const PUBLIC_ROUTES = ['/', '/about', '/library']

export const resolveSiteUrl = (env) => {
  const raw = env.VITE_SITE_URL
    || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!raw) return null
  const fail = (why) => {
    throw new Error(`VITE_SITE_URL ${why}: ${JSON.stringify(raw)}. Set it to the site's origin, e.g. VITE_SITE_URL=https://quran.example.com`)
  }
  if (raw !== raw.trim()) fail('has spaces or a line break around it')
  let url
  try { url = new URL(raw) } catch { fail('is not a URL') }
  if (!/^https?:$/.test(url.protocol)) fail('is not an http(s) URL')
  if (url.pathname !== '/' || url.search || url.hash || url.username) fail('must be an origin only, with no path, query or login')
  return url.origin
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const sitemapXml = (origin) => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...PUBLIC_ROUTES.map((path) => `  <url><loc>${escapeXml(origin + path)}</loc></url>`),
  '</urlset>',
  '',
].join('\n')

export const robotsTxt = (origin) => [
  'User-agent: *',
  'Allow: /',
  ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
  '',
].join('\n')

// The share-card tags that need an absolute URL; index.html marks where they go.
export const shareTags = (origin) => (origin ? [
  `<meta property="og:url" content="${origin}/" />`,
  `<meta property="og:image" content="${origin}/og-image.png" />`,
  `<meta name="twitter:image" content="${origin}/og-image.png" />`,
].join('\n    ') : '')

const SHARE_MARK = '<!-- site-meta: share-card URLs -->'

export const siteMeta = (clientDir) => {
  let origin = null
  return {
    name: 'site-meta',
    config(_, { command, mode }) {
      origin = resolveSiteUrl({ ...loadEnv(mode, clientDir, ['VITE_', 'VERCEL_']) })
      if (command === 'build' && !origin) {
        console.warn('\n\x1b[33m!!! VITE_SITE_URL is not set: this build has no sitemap.xml, no Sitemap line in robots.txt, ' +
          'no absolute share-card URLs and no canonical links. Set it to the site\'s origin for a deploy.\x1b[0m\n')
      }
      // The app reads it for the canonical link (hooks/usePageTitle.js).
      return { define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(origin ?? '') } }
    },
    transformIndexHtml(html) {
      if (!html.includes(SHARE_MARK)) throw new Error(`site-meta: index.html has no "${SHARE_MARK}" marker`)
      return html.replace(SHARE_MARK, shareTags(origin))
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(origin) })
      if (origin) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(origin) })
    },
  }
}
