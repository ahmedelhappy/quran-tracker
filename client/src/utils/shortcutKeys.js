// Matching keyboard shortcuts so they work on ANY keyboard layout.
//
// `e.key` is the character the active layout PRODUCES. On an Arabic layout the
// physical P key emits 'ح', on a Russian one 'з', on a Greek one 'π' — so a
// shortcut that only tests `e.key === 'p'` silently does nothing for a large
// share of this app's readers. `e.code` names the PHYSICAL key ('KeyP') and
// ignores the layout entirely, which is what rescues them.
//
// We accept EITHER, deliberately:
//   - `e.code` covers non-Latin layouts, where the produced character is unrelated.
//   - `e.key` keeps the letter the reader SEES printed on the key on AZERTY and
//     Dvorak, and covers IMEs and on-screen keyboards, which can leave `e.code`
//     empty.
//
// Escape, the arrow keys and PageUp/PageDown need none of this — their `e.key`
// is already identical on every layout — so match those on `e.key` as before.
//
// Digits need their own rule, because the produced character drifts the same way
// on the number row: AZERTY types & é " ' unshifted (the digit needs Shift), the
// macOS Arabic layout types the Arabic-Indic ١ ٢ ٣ ٤, and Persian / Urdu layouts
// the Eastern Arabic-Indic ۱ ۲ ۳ ۴. So a digit matches on any of:
//   - `e.code` 'Digit1' — the physical number-row key, whatever it types;
//   - `e.key` '1', '١' or '۱' — the digit itself, in any of the three scripts,
//     which also covers the numpad with NumLock on and on-screen keyboards;
//   - `e.code` 'Numpad1' ONLY while it types a character. With NumLock off the
//     numpad keys are End / ArrowDown / PageDown / ArrowLeft, and those must
//     stay navigation keys (two of them turn the page).
//
// USE THIS FOR EVERY LETTER OR DIGIT SHORTCUT. See docs/CODE_GUIDE.md.
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0]; // '0', Arabic-Indic '٠', Eastern Arabic-Indic '۰'

// '0'..'9' for a single digit character in any of those scripts, else null.
const digitOf = (ch) => {
  if (ch?.length !== 1) return null;
  const cp = ch.codePointAt(0);
  const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
  return zero == null ? null : String(cp - zero);
};

const isDigitKey = (e, digit) =>
  e.code === `Digit${digit}` ||
  digitOf(e.key) === digit ||
  (e.code === `Numpad${digit}` && e.key?.length === 1);

// Punctuation shortcuts drift the same way: the physical '/' key types 'ظ' on the
// Arabic layout and '.' on Hebrew. So they match the physical key UNSHIFTED (with
// Shift it is a different key: '?' on US), or the character itself however it was
// typed (AZERTY and QWERTZ need Shift for '/').
const PUNCT_CODES = { '/': 'Slash' };

export const isShortcutKey = (e, key) =>
  /^[0-9]$/.test(key)
    ? isDigitKey(e, key)
    : PUNCT_CODES[key]
      ? e.key === key || (e.code === PUNCT_CODES[key] && !e.shiftKey)
      : e.code === `Key${key.toUpperCase()}` || e.key?.toLowerCase() === key.toLowerCase();

// The first entry of `map` ({ letter or digit -> value }) whose key this event matches.
export const shortcutValue = (e, map) => {
  for (const [key, value] of Object.entries(map)) {
    if (isShortcutKey(e, key)) return value;
  }
  return null;
};
