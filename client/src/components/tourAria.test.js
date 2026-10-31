import { describe, it, expect, vi, afterEach } from 'vitest';
import { rememberTourTarget, tidyTourTarget, releaseTourTarget } from './tourAria';

// What driver.js does to the element it spotlights.
const driverMarks = (el) => {
  el.setAttribute('aria-haspopup', 'dialog');
  el.setAttribute('aria-expanded', 'true');
  el.setAttribute('aria-controls', 'driver-popover-content');
};
const driverUnmarks = (el) => ['aria-haspopup', 'aria-expanded', 'aria-controls'].forEach((a) => el.removeAttribute(a));

describe('tour target attributes (M-12)', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('a plain element spotlighted by the tour carries none of the popover-trigger attributes', () => {
    document.body.innerHTML = '<div id="t"></div>';
    const el = document.getElementById('t');
    rememberTourTarget(el);
    driverMarks(el);
    tidyTourTarget(el);
    expect(el.hasAttribute('aria-expanded')).toBe(false);
    expect(el.hasAttribute('aria-haspopup')).toBe(false);
    expect(el.hasAttribute('aria-controls')).toBe(false);
  });

  it('a menu button keeps its own collapsed state during and after the tour', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<button id="b" aria-expanded="false" aria-controls="menu"></button>';
    const el = document.getElementById('b');
    rememberTourTarget(el);
    driverMarks(el);
    tidyTourTarget(el);
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(el.getAttribute('aria-controls')).toBe('menu');
    expect(el.hasAttribute('aria-haspopup')).toBe(false);
    releaseTourTarget(el);
    driverUnmarks(el);
    vi.runAllTimers();
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(el.getAttribute('aria-controls')).toBe('menu');
  });
});
