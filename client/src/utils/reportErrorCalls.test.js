// @vitest-environment node
// (it reads the source tree from disk: under jsdom import.meta.url is not a file: URL)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// reportLoadFailure(error, what) and reportError(error, context) take the error
// FIRST. A call with the two swapped still runs — the Library's span-verse load
// passed its label as the error, so a dropped connection was reported as a bug
// with the real error tucked into the context (L-17). A string literal as the
// first argument is always that mistake.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return sourceFiles(path);
  return /\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
});

describe('error reporting calls', () => {
  it('pass the error first, never a label', () => {
    const swapped = sourceFiles(SRC).flatMap((file) => [...readFileSync(file, 'utf8')
      .matchAll(/\b(reportLoadFailure|reportError)\(\s*['"`][^\n]*/g)]
      .map((m) => `${relative(SRC, file)}: ${m[0]}`));
    expect(swapped).toEqual([]);
  });
});
