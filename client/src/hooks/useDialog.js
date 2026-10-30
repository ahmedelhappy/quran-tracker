import { useCallback, useEffect, useId, useRef } from 'react';

// Everything a keyboard or screen-reader user needs from a dialog, in one place
// (M-12). ConfirmModal got this right first; every other modal, sheet and panel
// now shares the same behaviour instead of a copy of it:
//
//   - focus moves INTO the dialog when it opens (`initialFocusRef`, else the
//     first element marked `data-autofocus`, else the dialog itself);
//   - Tab and Shift+Tab wrap inside a modal dialog;
//   - Escape closes it — unless something inside it already used that Escape
//     (a combobox clearing itself calls preventDefault);
//   - keys pressed inside a modal never reach the page's own shortcuts (the
//     Library turns pages on the arrow keys, which must not happen behind a
//     dialog);
//   - a modal dialog makes everything else `inert` while it is open, so neither
//     Tab nor a screen reader's virtual cursor can wander behind it;
//   - focus goes back to whatever opened it when it closes.
//
// Usage: spread `dialogProps` on the element that holds the dialog's content
// (it carries the ref, the role and the key handling) and put `titleId` on its
// heading. Backdrops are siblings of that element: mark them
// `data-dialog-keep`, or the inert sweep would make them unclickable.
//
// `modal: false` is for a panel that sits beside the page (the chat widget, the
// tafsir column on a wide screen): it still takes focus, closes on Escape and
// hands focus back, but traps nothing and leaves the page usable.

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])',
].join(',');

// What Tab can actually land on inside `root`, in DOM (= tab) order. Layout is
// not consulted where the environment has none (jsdom); a real browser also
// drops anything not rendered (display:none, a closed <details>).
export const focusableIn = (root) => {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
    return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
  });
};

// How many open modals have asked for each element to be inert. A count, not a
// flag: a confirm dialog opened over a sheet inerts some of the same elements,
// and closing it must not wake what the sheet still needs asleep.
const inertCount = new Map();

// Makes everything outside `el` inert: every sibling of `el` and of each of its
// ancestors, up to <body>. Elements already inert for another reason are left
// alone (and so never woken by us), as are `data-dialog-keep` ones — the
// backdrop that closes the dialog on a click, and the toast region, whose
// messages must still be announced and clickable while a modal is up.
export const inertOutside = (el) => {
  const mine = [];
  for (let node = el; node && node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sib of node.parentElement.children) {
      if (sib === node || sib.hasAttribute('data-dialog-keep')) continue;
      if (['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(sib.tagName)) continue;
      const count = inertCount.get(sib) ?? 0;
      if (count === 0) {
        if (sib.hasAttribute('inert')) continue;
        sib.setAttribute('inert', '');
      }
      inertCount.set(sib, count + 1);
      mine.push(sib);
    }
  }
  return () => {
    for (const sib of mine) {
      const count = (inertCount.get(sib) ?? 1) - 1;
      if (count > 0) { inertCount.set(sib, count); continue; }
      inertCount.delete(sib);
      sib.removeAttribute('inert');
    }
  };
};

export function useDialog({
  open,
  onClose,
  modal = true,
  role = 'dialog',
  initialFocusRef,
  // Where focus goes on close when it should not simply go back to the element
  // that had it on open — e.g. a launcher that is unmounted while its panel is
  // up. A function, read at close time, after that element is back.
  returnFocus,
  // Where focus goes on close when the opener is gone (a popover button that
  // folded away meanwhile). Also a function read at close time.
  fallbackFocus,
  onKeyDown,
}) {
  const ref = useRef(null);
  const titleId = useId();
  // Read through a ref so a parent passing a fresh arrow each render doesn't
  // re-run the open/close effect (which would steal focus back every render).
  const live = useRef({});
  useEffect(() => { live.current = { onClose, returnFocus, fallbackFocus, initialFocusRef, onKeyDown }; });

  // Only a modal puts the rest of the page to sleep. Held in a ref so the
  // close path below can wake the page BEFORE handing focus back: an inert
  // opener cannot take focus.
  const releaseInert = useRef(null);
  const setInert = useCallback((on) => {
    if (on && !releaseInert.current && ref.current) releaseInert.current = inertOutside(ref.current);
    if (!on && releaseInert.current) { releaseInert.current(); releaseInert.current = null; }
  }, []);

  // Focus in on open, back out on close. Keyed on `open` alone: a panel that
  // turns modal or not while it stays open (a sheet on a phone, a column on a
  // wide screen, across a resize) keeps the reader's place.
  useEffect(() => {
    if (!open) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const opener = document.activeElement;
    const target = live.current.initialFocusRef?.current
      ?? el.querySelector('[data-autofocus]')
      ?? el;
    // An element of the dialog that took focus by itself (autoFocus) keeps it.
    // preventScroll: a sheet that slides in shouldn't yank the page under it.
    if (!el.contains(document.activeElement)) target.focus({ preventScroll: true });
    return () => {
      setInert(false);
      // The dialog is gone (or going): focus fell to <body>, or is still on a
      // node inside it. Hand it back — unless the reader has already put it
      // somewhere else themselves (clicked into the page beside a panel).
      const active = document.activeElement;
      const lost = !active || active === document.body || el.contains(active) || !active.isConnected;
      if (!lost) return;
      const back = live.current.returnFocus?.()
        ?? (opener?.isConnected && opener !== document.body ? opener : live.current.fallbackFocus?.());
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open, setInert]);

  // After the focus effect, so the opener was read before anything went inert;
  // re-run when a panel turns modal or not while it stays open.
  useEffect(() => { if (open) setInert(modal); }, [open, modal, setInert]);
  // And never left behind by an unmount that skipped the close.
  useEffect(() => () => setInert(false), [setInert]);

  const handleKeyDown = useCallback((e) => {
    live.current.onKeyDown?.(e);
    // Keys typed inside a modal belong to it. A panel beside the page leaves
    // the page its keys (the arrows still turn the mushaf from the tafsir
    // column) — all but Escape, which is spent here and must not also run the
    // page's own Escape ladder.
    if (modal || e.key === 'Escape') e.stopPropagation();
    if (e.key === 'Escape') {
      if (e.defaultPrevented) return;
      e.preventDefault();
      live.current.onClose?.();
      return;
    }
    if (e.key !== 'Tab' || !modal) return;
    const items = focusableIn(ref.current);
    if (!items.length) { e.preventDefault(); ref.current?.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current || !ref.current.contains(active))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (active === last || !ref.current.contains(active))) {
      e.preventDefault(); first.focus();
    }
  }, [modal]);

  return {
    ref,
    titleId,
    dialogProps: {
      ref,
      role,
      'aria-modal': modal ? 'true' : undefined,
      'aria-labelledby': titleId,
      tabIndex: -1,
      onKeyDown: handleKeyDown,
    },
  };
}
