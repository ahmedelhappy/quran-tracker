import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));

const { default: InfoHint } = await import('./InfoHint');
const { default: Tooltip } = await import('./Tooltip');

const button = () => screen.getByRole('button', { name: 'Daily target' });
const renderHint = () => render(<InfoHint text="Pages to memorize per day." label="Daily target" />);

describe('InfoHint — one hint, reachable by hover, tap and keyboard', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('is closed at first and names its button', () => {
    renderHint();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a tap or click pins it open and describes the button; a second tap closes it', () => {
    renderHint();
    fireEvent.click(button());
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toBe('Pages to memorize per day.');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-describedby')).toBe(tip.id);
    // The pointer leaving does not close a pinned hint.
    fireEvent.pointerLeave(button(), { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.click(button());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on mouse hover and closes shortly after the pointer leaves', () => {
    vi.useFakeTimers();
    renderHint();
    fireEvent.pointerEnter(button(), { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerLeave(button(), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a touch "hover" does not open it (the tap does)', () => {
    renderHint();
    fireEvent.pointerEnter(button(), { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on keyboard focus, closes on blur and on Escape', () => {
    // jsdom never reports :focus-visible; a real browser does for Tab focus.
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (sel) {
      return sel === ':focus-visible' ? true : matches.call(this, sel);
    });
    renderHint();
    act(() => { button().focus(); });
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => { button().blur(); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(button());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('an outside tap closes a pinned hint', () => {
    renderHint();
    fireEvent.click(button());
    const catcher = document.querySelector('.fixed.inset-0');
    fireEvent.click(catcher);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip — names icon buttons, never sticks after a tap', () => {
  afterEach(cleanup);
  const renderTip = () => render(<Tooltip label="Close menu"><button type="button">×</button></Tooltip>);

  it('gives the trigger an aria-label and shows on mouse hover', () => {
    renderTip();
    const btn = screen.getByRole('button', { name: 'Close menu' });
    fireEvent.pointerEnter(btn.parentElement, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip').textContent).toBe('Close menu');
    fireEvent.pointerLeave(btn.parentElement, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a touch pointer does not open it', () => {
    renderTip();
    const btn = screen.getByRole('button', { name: 'Close menu' });
    fireEvent.pointerEnter(btn.parentElement, { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
