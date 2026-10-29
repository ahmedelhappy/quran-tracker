// A Map that holds at most `max` entries, dropping the one used longest ago
// (L-15). A Map keeps insertion order, so "used" is moving an entry to the back
// (delete + set) and the first key is always the least recently used one.
//
// For the reader's per-page / per-verse caches: a long study session reads
// through hundreds of pages and thousands of verses, and a tafsir entry alone can
// be 20–30 K characters, so a plain Map grew for as long as the tab stayed open.
export class LruCache {
  constructor(max) {
    if (!(max >= 1)) throw new RangeError('LruCache needs a max of at least 1');
    this.max = max;
    this.map = new Map();
  }

  get size() { return this.map.size; }

  has(key) { return this.map.has(key); }

  // The value (marking it as just used), or undefined.
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
    return this;
  }

  delete(key) { return this.map.delete(key); }

  clear() { this.map.clear(); }
}
