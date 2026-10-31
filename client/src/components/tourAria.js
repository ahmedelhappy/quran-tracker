// driver.js marks every element it spotlights as the trigger of its popover:
// aria-haspopup="dialog", aria-expanded="true", aria-controls. On a plain <div>
// or <section> those attributes are not allowed (axe's aria-allowed-attr, M-11 /
// M-12), and on a real button they overwrite the button's OWN state — a closed
// menu button announced as expanded — and driver.js then removes them outright
// on the way out, so the button loses its aria-expanded until React next
// changes it. These hooks keep the element's own attributes and only let the
// tour's stand on elements that can carry them.
//
// The tour's popover itself is fine as it is: driver.js gives it role="dialog",
// a label and description, moves focus into it, keeps Tab inside it, closes on
// Escape and gives focus back when it ends.

const ATTRS = ['aria-haspopup', 'aria-expanded', 'aria-controls'];
const CAN_EXPAND = 'button, a[href], summary, [role="button"], [role="link"], [role="combobox"], [role="menuitem"], [role="tab"]';
const saved = new WeakMap();

const snapshot = (el) => Object.fromEntries(ATTRS.map((a) => [a, el.getAttribute(a)]));
const restore = (el, values) => {
  for (const a of ATTRS) {
    if (values[a] == null) el.removeAttribute(a);
    else el.setAttribute(a, values[a]);
  }
};

// onHighlightStarted: before driver.js writes its attributes.
export const rememberTourTarget = (el) => {
  if (el && !saved.has(el)) saved.set(el, snapshot(el));
};

// onHighlighted: after it has. A non-interactive target drops them; an
// interactive one gets its own state back.
export const tidyTourTarget = (el) => {
  if (!el) return;
  const own = saved.get(el);
  if (!el.matches(CAN_EXPAND)) restore(el, own ?? {});
  else if (own) restore(el, own);
};

// onDeselected: driver.js strips the attributes after this hook runs, so the
// element's own values go back on once it is done.
export const releaseTourTarget = (el) => {
  if (!el) return;
  const own = saved.get(el);
  saved.delete(el);
  if (own) setTimeout(() => restore(el, own), 0);
};

// driver.js builds its popover with a <header> (the title row) and a <footer>
// (the buttons). Inside a plain div those are the PAGE's banner and contentinfo
// landmarks to a screen reader — a second navbar and footer for as long as a
// tour runs (axe: landmark-no-duplicate-banner/-contentinfo). They are only rows
// of the popover, which is already a labelled dialog. onPopoverRender.
export const tidyTourPopover = (popover) => {
  popover?.wrapper?.querySelectorAll('header, footer').forEach((el) => el.setAttribute('role', 'none'));
};
