// Links in the assistant's replies.
//
// The assistant is told it may point at pages of this app (see server/chat/
// appGuide.md). Its reply is still model output, so nothing in it is trusted:
// a path becomes a link only if it is one of the app's own pages, with only the
// query parameters that page understands and values it accepts. Anything else —
// an external URL, a made-up path, a javascript: scheme, a stray parameter —
// stays plain text. Links are in-app (react-router), never a full reload.

// page → { param: accepts(value) }
const APP_PAGES = {
  '/dashboard': {},
  '/progress': {},
  '/leaderboard': {},
  '/about': {},
  '/library': { page: (v) => /^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 604 },
  '/settings': {
    tab: (v) => ['profile', 'memorization', 'appearance'].includes(v),
    edit: (v) => v === '1',
  },
};

const BASE = 'https://app.invalid';

// The path, normalised, if it is a page of this app; otherwise null.
export function safeAppPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  let url;
  try { url = new URL(raw, BASE); } catch { return null; }
  if (url.origin !== BASE || url.hash) return null;
  const params = APP_PAGES[url.pathname];
  if (!params) return null;
  for (const [key, value] of url.searchParams) {
    if (!params[key]?.(value)) return null;
  }
  return url.pathname + url.search;
}

// A markdown link "[label](target)", or a bare app path such as /library?page=291.
// Bare paths stop at punctuation, so "see /progress." keeps its full stop.
const LINK_RE = /\[([^\]\n]{1,80})\]\(([^)\s]{1,200})\)|(^|[\s(])(\/(?:dashboard|progress|leaderboard|about|library|settings)(?:\?[A-Za-z0-9=&]*)?)/g;

// "**[label](target)**" → "[label](target)": bold around a link would otherwise
// leave stray asterisks on either side of it. The same result as
//   text.replace(/\*\*(\[[^\]\n]+\]\([^)\s]+\))\*\*/g, '$1')
// but in one pass. That regex scanned from EVERY "**[" to the label's end and then
// backtracked all the way, so a reply made of "**[" repeated took quadratic time
// (200 K characters: 8.5 s, the tab frozen). Here the label and the target can
// each end in only one place — the first ']' or newline, the first ')' or space —
// and later candidates only look further on, so one forward-moving scan head per
// part finds every end: each character is looked at a bounded number of times.
const isSpace = (c) => /\s/.test(c);
export function unboldLinks(text) {
  const n = text.length;
  let out = '';
  let copied = 0;
  let labelEnd = 0;    // the first ']' or '\n' at or after the label being tried
  let targetEnd = 0;   // the first ')' or whitespace at or after the target being tried
  for (let i = text.indexOf('**['); i !== -1; i = text.indexOf('**[', i + 1)) {
    const labelStart = i + 3;
    if (labelEnd < labelStart) labelEnd = labelStart;
    while (labelEnd < n && text[labelEnd] !== ']' && text[labelEnd] !== '\n') labelEnd++;
    if (labelEnd === labelStart || text[labelEnd] !== ']' || text[labelEnd + 1] !== '(') continue;
    const targetStart = labelEnd + 2;
    if (targetEnd < targetStart) targetEnd = targetStart;
    while (targetEnd < n && text[targetEnd] !== ')' && !isSpace(text[targetEnd])) targetEnd++;
    if (targetEnd === targetStart || text[targetEnd] !== ')' || text[targetEnd + 1] !== '*' || text[targetEnd + 2] !== '*') continue;
    out += text.slice(copied, i) + text.slice(i + 2, targetEnd + 1);
    copied = targetEnd + 3;
    i = targetEnd + 2;   // the next search starts after this match, as /g does
  }
  return copied === 0 ? text : out + text.slice(copied);
}

// Split a reply into text and link pieces: { text } | { to, label }.
export function splitChatLinks(raw) {
  const text = unboldLinks(String(raw ?? ''));
  const out = [];
  let last = 0;
  const push = (t) => { if (t) out.push({ text: t }); };
  for (const m of text.matchAll(LINK_RE)) {
    if (m[1] !== undefined) {
      // [label](target): a link only if the target is ours; otherwise just the label.
      push(text.slice(last, m.index));
      const to = safeAppPath(m[2]);
      out.push(to ? { to, label: m[1] } : { text: m[1] });
      last = m.index + m[0].length;
    } else {
      const lead = m[3];
      const path = m[4];
      const to = safeAppPath(path);
      if (!to) continue;   // a lookalike path with a parameter we don't take: leave it as text
      push(text.slice(last, m.index) + lead);
      out.push({ to, label: path });
      last = m.index + m[0].length;
    }
  }
  push(text.slice(last));
  return out;
}

// Models write **bold** whatever they are told; show it as bold rather than as
// asterisks. Returns [{ text, bold }] — rendered as React elements, never as HTML.
export function splitBold(text) {
  return String(text).split(/\*\*([^*\n]+)\*\*/g).map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text);
}
