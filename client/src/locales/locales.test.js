import { describe, expect, it } from 'vitest';
import en from './en.json';
import ar from './ar.json';

// i18n.js gives Arabic NO fallback language (loading English next to Arabic would
// undo the per-language chunks), so a key missing from ar.json would show as the
// raw key. This keeps the two files covering the same keys. Plural forms are
// compared by their base key: Arabic has more of them (_zero, _two, _few, _many)
// than English (_one, _other).
const PLURAL = /_(zero|one|two|few|many|other)$/;

const keysOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const baseKeys = (obj) => new Set(keysOf(obj).map((k) => k.replace(PLURAL, '')));

describe('locale files', () => {
  const enKeys = baseKeys(en);
  const arKeys = baseKeys(ar);

  it('Arabic has every English key', () => {
    expect([...enKeys].filter((k) => !arKeys.has(k))).toEqual([]);
  });

  it('English has every Arabic key (English is the fallback for anything else)', () => {
    expect([...arKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });
});
