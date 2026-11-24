// The browser tab's title, written from two parts that change independently:
// the page's own title (set on every navigation, in the reader's language —
// L-09) and the running timer's readout in front of it ("12:04 · "). Each part
// is set here and the title is rebuilt from both, so neither can overwrite the
// other.
let base = typeof document === 'undefined' ? '' : document.title;
let prefix = '';

const render = () => { document.title = prefix + base; };

export const setTitleBase = (title) => { base = title; render(); };
export const setTitlePrefix = (value) => { prefix = value; render(); };
