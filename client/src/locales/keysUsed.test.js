// @vitest-environment node
// (it reads the source tree from disk: under jsdom import.meta.url is not a file: URL)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './en.json';

// Every string in the locale files must be used somewhere, and every key the
// code asks for must exist (L-08: 52 keys had been left behind by refactors,
// and nothing noticed). "Used" means the source has the key as a string
// literal (a list read whole with returnObjects, such as dashboard.quotes, is
// one key), or a template literal builds it — `timer.mode.${m}` covers every
// key under that prefix. Plural forms (_one, _few …) count as their base key.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const PLURAL = /_(zero|one|two|few|many|other)$/;

const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === 'locales' ? [] : sourceFiles(path);
  return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});
const code = sourceFiles(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');

const keysOf = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const baseKeys = [...new Set(keysOf(en).map((k) => k.replace(PLURAL, '')))];

const literals = new Set([...code.matchAll(/(['"`])([A-Za-z][\w.]*)\1/g)].map((m) => m[2]));
// `prefix.${…}` and `prefix${…}` (onboarding.dayName${d}).
const dynamicPrefixes = [...code.matchAll(/`([A-Za-z][\w.]*)\$\{/g)].map((m) => m[1]).filter((p) => p.includes('.'));

const ancestors = (key) => key.split('.').slice(0, -1).map((_, i) => key.split('.').slice(0, i + 1).join('.'));
const isUsed = (key) => literals.has(key) || dynamicPrefixes.some((p) => key.startsWith(p));

describe('locale keys and the code', () => {
  it('every key in en.json (and so ar.json) is used by the code', () => {
    expect(baseKeys.filter((k) => !isUsed(k))).toEqual([]);
  });

  it('every key the code passes to t() exists', () => {
    const known = new Set(baseKeys);
    const parents = new Set(baseKeys.flatMap(ancestors));
    const asked = [...code.matchAll(/\bt\(\s*(['"])([A-Za-z][\w.]*)\1/g)].map((m) => m[2]);
    expect([...new Set(asked)].filter((k) => !known.has(k) && !parents.has(k))).toEqual([]);
  });

  it('can tell a used key from an unused one', () => {
    expect(isUsed('timer.mode.anything')).toBe(true);      // built from a template
    expect(baseKeys).toContain('dashboard.quotes');        // a list is one key, read whole
    expect(isUsed('dashboard.quotes')).toBe(true);
    expect(isUsed('settings.noSuchKey')).toBe(false);      // a used parent is not enough
    expect(isUsed('no.such.key.anywhere')).toBe(false);
  });
});
