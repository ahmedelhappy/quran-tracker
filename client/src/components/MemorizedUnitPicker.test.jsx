import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState, useEffect } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import MemorizedUnitPicker from './MemorizedUnitPicker';
import { coverageFromProgress, hizbOrdRange, coverageOf } from '../utils/unitRanges';

// Translation keys stand in for the text, so the test needs no locale files.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) }));
vi.mock('./Tooltip', () => ({ default: ({ children }) => children }));
vi.mock('./InfoHint', () => ({ default: () => null }));

// The selection the parent holds, read back after each render.
const seen = { coverage: [] };
function Harness({ initial = [], ...props }) {
  const [coverage, setCoverage] = useState(initial);
  useEffect(() => { seen.coverage = coverage; }, [coverage]);
  return <MemorizedUnitPicker {...props} coverage={coverage} setCoverage={setCoverage} />;
}

const tab = (key) => fireEvent.click(screen.getByRole('button', { name: key }));
const tile = (id) => document.querySelector(`[data-tile-id="${id}"]`);

describe('MemorizedUnitPicker (M-20)', () => {
  afterEach(cleanup);

  it('toggling a Juz keeps the part of a Hizb that falls mid-page', () => {
    render(<Harness variant="onboarding" />);
    tab('onboarding.byHizb');
    fireEvent.click(tile(2));
    expect(tile(2).getAttribute('aria-pressed')).toBe('true');
    tab('onboarding.byJuz');
    // Hizb 2 covers part of Juz 1 only: the Juz says so.
    expect(tile(1).getAttribute('aria-pressed')).toBe('mixed');
    fireEvent.click(tile(30));
    expect(tile(30).getAttribute('aria-pressed')).toBe('true');
    tab('onboarding.byHizb');
    expect(tile(2).getAttribute('aria-pressed')).toBe('true');
    expect(coverageOf(seen.coverage, hizbOrdRange(2))).toBe('full');
  });

  it('editing a range row keeps the sub-page selection too', () => {
    render(<Harness variant="onboarding" />);
    tab('onboarding.byHizb');
    fireEvent.click(tile(2));
    tab('onboarding.byRange');
    // The first row holds Hizb 2's whole pages; a second row adds Juz 30.
    fireEvent.click(screen.getByText('onboarding.addRange'));
    const [, , start, end] = screen.getAllByRole('spinbutton');
    fireEvent.change(start, { target: { value: '582' } });
    fireEvent.change(end, { target: { value: '604' } });
    expect(coverageOf(seen.coverage, hizbOrdRange(2))).toBe('full');
    expect(coverageOf(seen.coverage, hizbOrdRange(60))).toBe('full');
  });

  it('reports when its range rows become invalid and valid again', () => {
    const onRangeErrorsChange = vi.fn();
    render(<Harness variant="onboarding" onRangeErrorsChange={onRangeErrorsChange} />);
    tab('onboarding.byRange');
    const [start] = screen.getAllByRole('spinbutton');
    fireEvent.change(start, { target: { value: '700' } });
    expect(onRangeErrorsChange).toHaveBeenLastCalledWith(true);
    expect(document.getElementById('onboarding-range-error-0')).not.toBeNull();
    fireEvent.change(start, { target: { value: '7' } });
    expect(onRangeErrorsChange).toHaveBeenLastCalledWith(false);
  });

  it('the editor marks what a change removes and shows each unit\'s share', () => {
    const pages = Array.from({ length: 21 }, (_, i) => i + 1);
    const original = { pages: new Set(pages), coverage: coverageFromProgress(pages, []) };
    render(<Harness variant="editor" initial={original.coverage} original={original} />);
    expect(tile(1).getAttribute('aria-pressed')).toBe('true');
    expect(tile(1).textContent).toBe('1100%');
    fireEvent.click(tile(1));
    expect(tile(1).getAttribute('aria-pressed')).toBe('false');
    expect(tile(1).textContent).toBe('10%');
    expect(tile(1).className).toContain('bg-red-50');
    // The editor's tiles are read by their text (number and share), not a label.
    expect(tile(1).hasAttribute('aria-label')).toBe(false);
  });

  it('the editor asks before deleting a range row', () => {
    const pages = [1, 2, 3, 10];
    const original = { pages: new Set(pages), coverage: coverageFromProgress(pages, []) };
    render(<Harness variant="editor" initial={original.coverage} original={original} />);
    tab('onboarding.byRange');
    expect(screen.getAllByRole('spinbutton').map((el) => el.value)).toEqual(['1', '3', '10', '10']);
    fireEvent.click(screen.getAllByRole('spinbutton')[0].parentElement.querySelector('button'));
    expect(screen.getByText('settings.rangeDeleteConfirm')).toBeTruthy();
    fireEvent.click(screen.getByText('settings.rangeDeleteConfirmBtn'));
    expect(screen.getAllByRole('spinbutton').map((el) => el.value)).toEqual(['10', '10']);
    expect([...coverageOf(seen.coverage, { from: 1, to: 1 })].join('')).toBe('none');
  });
});
