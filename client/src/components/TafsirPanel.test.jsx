import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import TafsirPanel from './TafsirPanel';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) }));
vi.mock('./Tooltip', () => ({ default: ({ children }) => children }));
vi.mock('./InfoHint', () => ({ default: () => null }));
vi.mock('../services/quranApi', () => ({
  TAFSIR_EDITIONS: [{ id: 'saadi', source: 'ayah', slug: 'saadi', nameEn: 'Saadi', nameAr: 'السعدي' }],
  fetchPageTafsir: vi.fn(),
  fetchEditionAyahTafsir: vi.fn(async () => 'first line\nsecond line\n\nthird'),
  findTafsirRun: vi.fn(async () => ({ from: 2, to: 2 })),
  toArabicDigits: String,
}));

const verse = { verseKey: '3:2', page: 50, id: 295, surahNumber: 3, ayahNumber: 2, textUthmani: 'نص' };
const panel = (props) => (
  <TafsirPanel
    verse={verse} panelVerseKey="3:2" edition="saadi" onEditionChange={() => {}}
    dialog={{ dialogProps: {}, titleId: 't' }} onClose={() => {}} isWide width={400}
    onWidthCommit={() => {}} onWidthPreview={() => {}} stepOrd={295} onStep={() => {}}
    playingOrd={null} isPlaying={false} onToggleVerseAudio={() => {}}
    verseRef={() => 'ref'} fmtNum={String} isArabic={false} selectClassName=""
    {...props}
  />
);

describe('TafsirPanel (M-10, M-20)', () => {
  afterEach(cleanup);

  it('shows the commentary as paragraphs', async () => {
    render(panel());
    await waitFor(() => expect(screen.getByTestId('tafsir-text').querySelectorAll('p')).toHaveLength(3));
  });

  it('a resize previews while dragging and commits once, on release', () => {
    const onWidthPreview = vi.fn();
    const onWidthCommit = vi.fn();
    render(panel({ onWidthPreview, onWidthCommit }));
    const handle = screen.getByTestId('tafsir-resize');
    fireEvent.pointerDown(handle, { button: 0, clientX: 1000 });
    fireEvent.pointerMove(window, { clientX: 960 });
    fireEvent.pointerMove(window, { clientX: 940 });
    expect(onWidthPreview).toHaveBeenLastCalledWith(460);
    expect(handle.getAttribute('aria-valuenow')).toBe('460');
    expect(onWidthCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 940 });
    expect(onWidthCommit).toHaveBeenCalledTimes(1);
    expect(onWidthCommit).toHaveBeenCalledWith(460);
  });

  it('a resize ends with the panel: nothing is written after it closes', () => {
    const onWidthPreview = vi.fn();
    const onWidthCommit = vi.fn();
    const { unmount } = render(panel({ onWidthPreview, onWidthCommit }));
    fireEvent.pointerDown(screen.getByTestId('tafsir-resize'), { button: 0, clientX: 1000 });
    fireEvent.pointerMove(window, { clientX: 980 });
    const previews = onWidthPreview.mock.calls.length;
    unmount();
    fireEvent.pointerMove(window, { clientX: 900 });
    fireEvent.pointerUp(window, { clientX: 900 });
    expect(onWidthPreview).toHaveBeenCalledTimes(previews);
    expect(onWidthCommit).not.toHaveBeenCalled();
  });

  it('a resize ends when the layout leaves the docked column', () => {
    const onWidthCommit = vi.fn();
    const { rerender } = render(panel({ onWidthCommit }));
    fireEvent.pointerDown(screen.getByTestId('tafsir-resize'), { button: 0, clientX: 1000 });
    rerender(panel({ onWidthCommit, isWide: false }));
    fireEvent.pointerUp(window, { clientX: 900 });
    expect(onWidthCommit).not.toHaveBeenCalled();
  });
});
