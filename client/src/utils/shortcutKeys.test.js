import { describe, it, expect } from 'vitest';
import { isShortcutKey, shortcutValue } from './shortcutKeys';

// The shape of a KeyboardEvent the helpers read.
const ev = (code, key, shiftKey = false) => ({ code, key, shiftKey });

describe('isShortcutKey — letters match on e.code OR e.key', () => {
  it('matches the physical key on a non-Latin layout (e.code)', () => {
    expect(isShortcutKey(ev('KeyP', 'ح'), 'p')).toBe(true);  // Arabic
    expect(isShortcutKey(ev('KeyP', 'з'), 'p')).toBe(true);  // Russian
    expect(isShortcutKey(ev('KeyP', 'π'), 'p')).toBe(true);  // Greek
  });

  it('matches the printed letter on AZERTY / Dvorak and when e.code is empty (e.key)', () => {
    expect(isShortcutKey(ev('KeyQ', 'a'), 'a')).toBe(true);  // AZERTY: physical Q types "a"
    expect(isShortcutKey(ev('', 'p'), 'p')).toBe(true);      // IME / on-screen keyboard
    expect(isShortcutKey(ev(undefined, 'P'), 'p')).toBe(true); // Shift or Caps Lock
  });

  it('does not match a different key', () => {
    expect(isShortcutKey(ev('KeyO', 'o'), 'p')).toBe(false);
    expect(isShortcutKey(ev('KeyO', 'خ'), 'p')).toBe(false);
    expect(isShortcutKey(ev('', undefined), 'p')).toBe(false);
  });
});

describe('isShortcutKey — digits', () => {
  it('matches the number-row key whatever it types (AZERTY needs Shift for the digit)', () => {
    expect(isShortcutKey(ev('Digit1', '&'), '1')).toBe(true);
    expect(isShortcutKey(ev('Digit2', 'é'), '2')).toBe(true);
  });

  it('matches the digit itself in Western, Arabic-Indic and Eastern Arabic-Indic script', () => {
    expect(isShortcutKey(ev('', '3'), '3')).toBe(true);
    expect(isShortcutKey(ev('', '٣'), '3')).toBe(true);
    expect(isShortcutKey(ev('', '۳'), '3')).toBe(true);
    expect(isShortcutKey(ev('', '٣'), '4')).toBe(false);
  });

  it('matches the numpad only while it types a character, so NumLock-off keys stay navigation', () => {
    expect(isShortcutKey(ev('Numpad1', '1'), '1')).toBe(true);
    expect(isShortcutKey(ev('Numpad1', 'End'), '1')).toBe(false);
    expect(isShortcutKey(ev('Numpad4', 'ArrowLeft'), '4')).toBe(false);
    expect(isShortcutKey(ev('Numpad3', 'PageDown'), '3')).toBe(false);
  });

  it('does not mistake a multi-character key name for a digit', () => {
    expect(isShortcutKey(ev('F1', 'F1'), '1')).toBe(false);
  });
});

describe('isShortcutKey — punctuation', () => {
  it('matches "/" as the typed character or the unshifted physical key', () => {
    expect(isShortcutKey(ev('Slash', '/'), '/')).toBe(true);
    expect(isShortcutKey(ev('Slash', 'ظ'), '/')).toBe(true);        // Arabic layout
    expect(isShortcutKey(ev('Digit7', '/', true), '/')).toBe(true); // QWERTZ: Shift+7
  });

  it('does not match the shifted physical key, which is another character ("?" on US)', () => {
    expect(isShortcutKey(ev('Slash', '?', true), '/')).toBe(false);
  });
});

describe('shortcutValue', () => {
  const MAP = { p: 'play', r: 'repeat', 1: 'speed-1', '/': 'search' };

  it('returns the value of the first key the event matches', () => {
    expect(shortcutValue(ev('KeyP', 'ح'), MAP)).toBe('play');
    expect(shortcutValue(ev('', '١'), MAP)).toBe('speed-1');
    expect(shortcutValue(ev('Slash', 'ظ'), MAP)).toBe('search');
  });

  it('returns null when nothing matches', () => {
    expect(shortcutValue(ev('KeyZ', 'z'), MAP)).toBeNull();
    expect(shortcutValue(ev('ArrowLeft', 'ArrowLeft'), MAP)).toBeNull();
  });
});
