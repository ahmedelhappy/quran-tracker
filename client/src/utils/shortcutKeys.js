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
// USE THIS FOR EVERY LETTER SHORTCUT. See docs/CODE_GUIDE.md.
export const isShortcutKey = (e, letter) =>
  e.code === `Key${letter.toUpperCase()}` || e.key?.toLowerCase() === letter.toLowerCase();

// The first entry of `map` ({ letter -> value }) whose letter this event matches.
export const shortcutValue = (e, map) => {
  for (const [letter, value] of Object.entries(map)) {
    if (isShortcutKey(e, letter)) return value;
  }
  return null;
};
