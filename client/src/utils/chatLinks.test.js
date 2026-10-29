import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { splitChatLinks, splitBold, safeAppPath, unboldLinks } from './chatLinks';

// The regex unboldLinks replaced. Kept here only as the reference its output is
// checked against; it must never run on a long input (quadratic).
const OLD_UNBOLD = /\*\*(\[[^\]\n]+\]\([^)\s]+\))\*\*/g;
const oldUnbold = (text) => text.replace(OLD_UNBOLD, '$1');

// Runs `fn(input)` in a vm cut off after `ms` (as the server's email ReDoS test
// does). A backtracking scan blocks the event loop, so a timing assertion could
// never fire — the vm's timeout does interrupt it. This is a cut-off, not a
// budget: the linear scan needs tens of ms on the inputs below, the old regex
// needed 8.5 s on 200 K characters and ~20 s on these, so the verdict does not
// depend on how busy the machine is.
const bounded = (fn, input, ms = 2000) => {
  try {
    return vm.runInNewContext('fn(input)', { fn, input }, { timeout: ms });
  } catch (error) {
    if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      throw new Error(`still running after ${ms} ms on a ${input.length}-char input`);
    }
    throw error;
  }
};

// A small deterministic PRNG, so a failure names a case that can be re-run.
const lcg = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

describe('unboldLinks', () => {
  it('strips the bold around a link and nothing else', () => {
    expect(unboldLinks('see **[the plan](/dashboard)** now')).toBe('see [the plan](/dashboard) now');
    expect(unboldLinks('**[a](/x)****[b](/y)**')).toBe('[a](/x)[b](/y)');
    expect(unboldLinks('**bold** and **[x](/a b)**')).toBe('**bold** and **[x](/a b)**');
    expect(unboldLinks('**[](/x)**')).toBe('**[](/x)**');
    expect(unboldLinks('**[a\nb](/x)**')).toBe('**[a\nb](/x)**');
    expect(unboldLinks('no links at all')).toBe('no links at all');
  });

  it('gives exactly what the old regex gave, on 20,000 random replies', () => {
    const alphabet = ['*', '*', '*', '[', ']', '(', ')', ' ', '\n', 'a', '/', '\t'];
    const rand = lcg(20261029);
    for (let c = 0; c < 20000; c++) {
      const len = Math.floor(rand() * 40);
      let s = '';
      for (let k = 0; k < len; k++) s += alphabet[Math.floor(rand() * alphabet.length)];
      expect(unboldLinks(s), JSON.stringify(s)).toBe(oldUnbold(s));
    }
  });

  it('stays linear on the inputs that made the old regex quadratic', () => {
    // ~300 K characters each (the old regex: ~20 s apiece; the scan: ~30 ms):
    // "**[" with no "]" (the label scan), "**[a](" with no ")" (the target scan),
    // and a mix that keeps both scans busy.
    const inputs = [
      '**['.repeat(100_000),
      '**[a]('.repeat(50_000),
      '**[x](/library?page=1)'.repeat(5_000) + '**['.repeat(50_000) + ']('.repeat(30_000),
    ];
    for (const input of inputs) {
      expect(() => bounded(splitChatLinks, input)).not.toThrow();
    }
  });
});

describe('splitChatLinks', () => {
  it('turns only whitelisted app paths into links', () => {
    expect(splitChatLinks('Open [page 291](/library?page=291) today.')).toEqual([
      { text: 'Open ' },
      { to: '/library?page=291', label: 'page 291' },
      { text: ' today.' },
    ]);
    expect(splitChatLinks('see /progress.')).toEqual([
      { text: 'see ' },
      { to: '/progress', label: '/progress' },
      { text: '.' },
    ]);
    expect(splitChatLinks('[evil](https://evil.com) [x](javascript:alert(1)) //evil.com')).toEqual([
      { text: 'evil' },
      { text: ' ' },
      { text: 'x' },
      { text: ') //evil.com' },
    ]);
    expect(splitChatLinks('/library?page=9999')).toEqual([{ text: '/library?page=9999' }]);
  });

  it('drops the bold around a link, so no asterisks are left beside it', () => {
    expect(splitChatLinks('**[Settings](/settings?tab=profile)**')).toEqual([
      { to: '/settings?tab=profile', label: 'Settings' },
    ]);
  });
});

describe('splitBold and safeAppPath', () => {
  it('marks **bold** runs', () => {
    expect(splitBold('a **b** c')).toEqual([{ text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false }]);
  });

  it('keeps only known pages with accepted parameters', () => {
    expect(safeAppPath('/settings?tab=memorization&edit=1')).toBe('/settings?tab=memorization&edit=1');
    expect(safeAppPath('/settings?tab=billing')).toBeNull();
    expect(safeAppPath('/library#x')).toBeNull();
    expect(safeAppPath('//evil.com')).toBeNull();
  });
});
