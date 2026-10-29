// @vitest-environment node
// (it reads files next to it: under jsdom import.meta.url is not a file: URL)
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A url() in fonts.css that points at no file only costs a warning at build
// time ("didn't resolve at build time, it will remain unchanged to be resolved
// at runtime"), and at runtime the face silently falls back. Catch it here.
const css = readFileSync(fileURLToPath(new URL('./fonts.css', import.meta.url)), 'utf8');
const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);

describe('fonts.css', () => {
  it('has a source for every @font-face', () => {
    const faces = css.match(/@font-face\s*{/g) ?? [];
    expect(faces.length).toBeGreaterThan(0);
    expect(urls.length).toBe(faces.length);
  });

  it.each(urls)('%s exists', (url) => {
    expect(existsSync(fileURLToPath(new URL(url, import.meta.url)))).toBe(true);
  });
});
