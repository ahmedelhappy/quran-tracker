import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRef, useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useDialog, inertOutside } from './useDialog';

// A page with a trigger, a dialog with three controls, and the things a modal
// must and must not put to sleep: page content, a toast region, a backdrop.
function Harness({ modal = true, onClose: spy = () => {}, withAutofocus = false, returnToOther = false }) {
  const [open, setOpen] = useState(false);
  const firstRef = useRef(null);
  const otherRef = useRef(null);
  const close = () => { spy(); setOpen(false); };
  const { dialogProps, titleId } = useDialog({
    open,
    onClose: close,
    modal,
    initialFocusRef: withAutofocus ? undefined : firstRef,
    returnFocus: returnToOther ? () => otherRef.current : undefined,
  });
  return (
    <>
      <main data-testid="page">
        <button onClick={() => setOpen(true)}>Open</button>
        <button ref={otherRef}>Other</button>
      </main>
      <div data-testid="toasts" data-dialog-keep />
      {open && (
        <div data-testid="layer">
          <div data-testid="backdrop" data-dialog-keep onClick={close} />
          <div {...dialogProps}>
            <h2 id={titleId}>Title</h2>
            <button ref={firstRef}>First</button>
            <input aria-label="Middle" data-autofocus={withAutofocus ? '' : undefined} />
            <button disabled>Disabled</button>
            <button>Last</button>
          </div>
        </div>
      )}
    </>
  );
}

const open = () => {
  const trigger = screen.getByRole('button', { name: 'Open' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
};

describe('useDialog (M-12)', () => {
  afterEach(cleanup);

  it('is a labelled modal dialog and moves focus into it on open', () => {
    render(<Harness />);
    open();
    const dialog = screen.getByRole('dialog', { name: 'Title' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('falls back to a data-autofocus element when no ref is given', () => {
    render(<Harness withAutofocus />);
    open();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Middle' }));
  });

  it('traps Tab and Shift+Tab inside, skipping disabled controls', () => {
    render(<Harness />);
    open();
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    // In the middle, Tab is left to the browser.
    const middle = screen.getByRole('textbox', { name: 'Middle' });
    middle.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    middle.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('closes on Escape and gives focus back to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = open();
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('hands focus to returnFocus() when one is given', () => {
    render(<Harness returnToOther />);
    open();
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Other' }));
  });

  it('leaves an Escape that something inside already used', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    open();
    const input = screen.getByRole('textbox', { name: 'Middle' });
    input.addEventListener('keydown', (e) => e.preventDefault());
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps its keys from page-level shortcuts', () => {
    const pageKeys = vi.fn();
    window.addEventListener('keydown', pageKeys);
    try {
      render(<Harness />);
      open();
      fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'ArrowLeft' });
      expect(pageKeys).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', pageKeys);
    }
  });

  it('makes the page inert while open, but not the backdrop or the toasts', () => {
    render(<Harness />);
    open();
    expect(screen.getByTestId('page').hasAttribute('inert')).toBe(true);
    expect(screen.getByTestId('toasts').hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('backdrop').hasAttribute('inert')).toBe(false);
    fireEvent.keyDown(screen.getByRole('button', { name: 'First' }), { key: 'Escape' });
    expect(screen.getByTestId('page').hasAttribute('inert')).toBe(false);
  });

  it('a non-modal panel takes focus and closes on Escape, but traps and inerts nothing', () => {
    render(<Harness modal={false} />);
    const trigger = open();
    const dialog = screen.getByRole('dialog', { name: 'Title' });
    expect(dialog.hasAttribute('aria-modal')).toBe(false);
    expect(screen.getByTestId('page').hasAttribute('inert')).toBe(false);
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    fireEvent.keyDown(last, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  it('turning modal while open (a resize across a breakpoint) inerts the page without moving focus', () => {
    function Sheet({ modal }) {
      const { dialogProps } = useDialog({ open: true, onClose: () => {}, modal });
      return (
        <>
          <main data-testid="page"><button>Page</button></main>
          <div {...dialogProps} aria-label="Sheet"><button>A</button><button>B</button></div>
        </>
      );
    }
    const { rerender } = render(<Sheet modal={false} />);
    const b = screen.getByRole('button', { name: 'B' });
    b.focus();
    rerender(<Sheet modal />);
    expect(screen.getByTestId('page').hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(b);
    rerender(<Sheet modal={false} />);
    expect(screen.getByTestId('page').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(b);
  });

  it('falls back to fallbackFocus() when the opener is gone', () => {
    function Popover() {
      const [open, setOpen] = useState(false);
      const anchor = useRef(null);
      const { dialogProps } = useDialog({ open, onClose: () => setOpen(false), fallbackFocus: () => anchor.current });
      return (
        <>
          <button ref={anchor}>Verse</button>
          {!open && <button onClick={() => setOpen(true)}>Tafsir</button>}
          {open && <div {...dialogProps} aria-label="Panel"><button>Inside</button></div>}
        </>
      );
    }
    render(<Popover />);
    const opener = screen.getByRole('button', { name: 'Tafsir' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Inside' }), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Verse' }));
  });

  it('does not take focus back when the reader moved it elsewhere', () => {
    function Panel() {
      const [open, setOpen] = useState(true);
      const { dialogProps } = useDialog({ open, onClose: () => setOpen(false), modal: false });
      return (
        <>
          <button onClick={() => setOpen(false)}>Elsewhere</button>
          {open && <div {...dialogProps} aria-label="Panel"><button>Inside</button></div>}
        </>
      );
    }
    render(<Panel />);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    act(() => { elsewhere.focus(); });
    fireEvent.click(elsewhere);
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe('inertOutside (M-12)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('counts overlapping modals, so closing the top one does not wake what the lower one hid', () => {
    document.body.innerHTML = '<div id="page"></div><div id="sheet"></div><div id="confirm"></div>';
    const [page, sheet, confirm] = ['page', 'sheet', 'confirm'].map((id) => document.getElementById(id));
    const releaseSheet = inertOutside(sheet);
    expect(page.hasAttribute('inert')).toBe(true);
    const releaseConfirm = inertOutside(confirm);
    expect(sheet.hasAttribute('inert')).toBe(true);
    releaseConfirm();
    expect(sheet.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);
    releaseSheet();
    expect(page.hasAttribute('inert')).toBe(false);
  });

  it('never wakes an element that was inert before it', () => {
    document.body.innerHTML = '<div id="asleep" inert></div><div id="dialog"></div>';
    const release = inertOutside(document.getElementById('dialog'));
    release();
    expect(document.getElementById('asleep').hasAttribute('inert')).toBe(true);
  });
});
