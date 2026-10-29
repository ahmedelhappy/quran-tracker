import { describe, it, expect } from 'vitest';
import { LruCache } from './lruCache';

describe('LruCache (L-15)', () => {
  it('never holds more than its max, dropping the least recently used', () => {
    const c = new LruCache(3);
    c.set('a', 1).set('b', 2).set('c', 3);
    c.get('a');            // a is now the most recent; b the oldest
    c.set('d', 4);
    expect(c.size).toBe(3);
    expect(c.has('b')).toBe(false);
    expect([...c.map.keys()]).toEqual(['c', 'a', 'd']);
  });

  it('re-setting a key refreshes it instead of adding a second entry', () => {
    const c = new LruCache(2);
    c.set('a', 1).set('b', 2).set('a', 10).set('c', 3);
    expect(c.get('a')).toBe(10);
    expect(c.has('b')).toBe(false);
    expect(c.size).toBe(2);
  });

  it('stays at its cap through a long run of distinct keys', () => {
    const c = new LruCache(200);
    for (let i = 0; i < 10_000; i++) c.set(`ayah:${i}`, 'x'.repeat(10));
    expect(c.size).toBe(200);
    expect(c.has('ayah:9999')).toBe(true);
    expect(c.has('ayah:9799')).toBe(false);
  });

  it('misses are undefined and delete/clear work', () => {
    const c = new LruCache(2);
    expect(c.get('none')).toBeUndefined();
    c.set('a', 1);
    expect(c.delete('a')).toBe(true);
    c.set('b', 2);
    c.clear();
    expect(c.size).toBe(0);
    expect(() => new LruCache(0)).toThrow(RangeError);
  });
});
