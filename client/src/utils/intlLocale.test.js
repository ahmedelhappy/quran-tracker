// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { intlLocale } from './intlLocale';

const DAY = new Date('2026-10-29T00:00:00Z');

describe('intlLocale (L-08)', () => {
  it('gives Arabic a Gregorian date with Arabic-Indic digits', () => {
    const s = DAY.toLocaleDateString(intlLocale(true), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    expect(s).toContain('أكتوبر');   // the Gregorian month, not a Hijri one
    expect(s).toContain('٢٩');
    expect(s).toContain('٢٠٢٦');
  });

  it('is what ar-SA was not: the same calendar as English', () => {
    const month = (loc) => DAY.toLocaleDateString(loc, { month: 'numeric', timeZone: 'UTC' });
    expect(month(intlLocale(false))).toBe('10');
    expect(month(intlLocale(true))).toBe('١٠');
  });

  it('is the only locale tag the source passes to a formatter', () => {
    const src = fileURLToPath(new URL('..', import.meta.url));
    const files = (dir) => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.jsx?$/.test(n) && !/\.test\./.test(n) && !p.endsWith('intlLocale.js') ? [p] : [];
    });
    const offenders = files(src).flatMap((f) => {
      const code = readFileSync(f, 'utf8');
      return [...code.matchAll(/toLocale(?:Date|Time)?String\(\s*(['"][^'"]*['"])|Intl\.\w+\(\s*(['"][^'"]*['"])|['"](ar-[A-Za-z]{2}|ar-u-[\w-]+)['"]/g)]
        .map((m) => `${f.slice(src.length)}: ${m[0]}`);
    });
    expect(offenders).toEqual([]);
  });
});
