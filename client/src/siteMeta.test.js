// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveSiteUrl, sitemapXml, robotsTxt, shareTags, PUBLIC_ROUTES } from '../siteMeta.js';
import { INDEXABLE } from './hooks/usePageTitle';

// The site's origin for the sitemap, robots.txt, share cards and canonical
// links comes from the build's environment, not a hard-coded domain (L-09).
describe('resolveSiteUrl', () => {
  it('takes VITE_SITE_URL first, then Vercel\'s production domain', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://quran.example.com' })).toBe('https://quran.example.com');
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://quran.example.com/' })).toBe('https://quran.example.com');
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'quran-tracker.vercel.app' })).toBe('https://quran-tracker.vercel.app');
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://a.example.com', VERCEL_PROJECT_PRODUCTION_URL: 'b.vercel.app' })).toBe('https://a.example.com');
  });

  it('is null when nothing is set, so the build skips the sitemap with a warning', () => {
    expect(resolveSiteUrl({})).toBeNull();
    expect(resolveSiteUrl({ VITE_SITE_URL: '' })).toBeNull();
  });

  it('refuses a value that is set but is not a bare http(s) origin', () => {
    expect(() => resolveSiteUrl({ VITE_SITE_URL: 'quran.example.com' })).toThrow(/not a URL/);
    expect(() => resolveSiteUrl({ VITE_SITE_URL: 'ftp://quran.example.com' })).toThrow(/http\(s\)/);
    expect(() => resolveSiteUrl({ VITE_SITE_URL: 'https://quran.example.com/app' })).toThrow(/origin only/);
    expect(() => resolveSiteUrl({ VITE_SITE_URL: 'https://quran.example.com ' })).toThrow(/spaces/);
  });

  it('names the variable it read in that refusal', () => {
    expect(() => resolveSiteUrl({ VITE_SITE_URL: 'quran.example.com' })).toThrow(/^VITE_SITE_URL is not a URL: "quran\.example\.com"/);
    // Vercel's value gets "https://" put in front; a path in it is still wrong,
    // and the message must not blame a VITE_SITE_URL nobody set.
    expect(() => resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'quran.example.com/app' }))
      .toThrow(/^VERCEL_PROJECT_PRODUCTION_URL must be an origin only.*: "quran\.example\.com\/app"\. Set VITE_SITE_URL/);
  });
});

describe('the files built from it', () => {
  const origin = 'https://quran.example.com';

  it('lists the public routes in the sitemap', () => {
    const xml = sitemapXml(origin);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
      .toEqual(['https://quran.example.com/', 'https://quran.example.com/about', 'https://quran.example.com/library']);
  });

  it('points robots.txt at the sitemap, or leaves the line out', () => {
    expect(robotsTxt(origin)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://quran.example.com/sitemap.xml\n');
    expect(robotsTxt(null)).toBe('User-agent: *\nAllow: /\n');
  });

  it('writes absolute share-card URLs, or none', () => {
    expect(shareTags(origin)).toContain('<meta property="og:url" content="https://quran.example.com/" />');
    expect(shareTags(origin)).toContain('<meta property="og:image" content="https://quran.example.com/og-image.png" />');
    expect(shareTags(null)).toBe('');
  });

  it('indexes the same routes the app gives a canonical link', () => {
    expect([...INDEXABLE].sort()).toEqual([...PUBLIC_ROUTES].sort());
  });
});
