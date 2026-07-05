import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { JUZ_RANGES } from '../data/juzRanges';

const TOTAL_PAGES = 604;
const clampPage = (n) => Math.max(1, Math.min(TOTAL_PAGES, Math.round(n) || 1));

// The mushaf is a right-to-left book regardless of the UI language, so the
// track always reads page 1 at the right end and 604 at the left. Rather than
// fight the browser's range-input RTL quirks (which key off `dir`, not book
// direction), the native input keeps its ordinary min=1..max=604 layout and we
// simply invert the VALUE mapping: raw slider value v (1 at its native left,
// 604 at its native right) stands for page (605 - v). So native-left (v=1) is
// page 604, native-right (v=604) is page 1 — exactly the wanted orientation,
// with zero reliance on CSS transforms or `dir` for hit-testing correctness.
const sliderValueForPage = (page) => TOTAL_PAGES + 1 - page;
const pageForSliderValue = (v) => clampPage(TOTAL_PAGES + 1 - v);
// Percent-from-the-left position of a given page along that same native track,
// used to place the juz ticks and the drag bubble in sync with the thumb.
const pctForPage = (page) => ((TOTAL_PAGES - page) / (TOTAL_PAGES - 1)) * 100;

// A slim full-width scrubber for jumping around the 604-page mushaf without
// typing. Dragging only updates a local preview + floating bubble — the
// mushaf itself doesn't navigate (and so doesn't reload) until release, at
// which point `onNavigate` (Library's goToPage) is called once, which already
// snaps a two-page spread onto its odd anchor page.
export default function PageScrubber({ currentPage, onNavigate, fmtNum }) {
  const { t } = useTranslation();
  // Non-null only while a pointer drag is in progress; its value is the page
  // the thumb is currently over. Deriving the preview from this (rather than
  // mirroring `currentPage` into state via an effect) means there's nothing to
  // resync when navigation happens elsewhere (pager, keyboard, bookmarks,
  // juz/surah jump, edge clicks, swipe) — outside a drag, `currentPage` alone
  // is always the source of truth.
  const [dragPage, setDragPage] = useState(null);
  const scrubbing = dragPage !== null;
  const previewPage = scrubbing ? dragPage : currentPage;

  const previewJuz = JUZ_RANGES.reduce((juz, { juz: n, start }) => (start <= previewPage ? n : juz), 1);

  const handleChange = (e) => {
    const page = pageForSliderValue(Number(e.target.value));
    if (scrubbing) setDragPage(page);
    else onNavigate(page); // keyboard nudge or a plain click: commit immediately
  };
  const startScrub = () => setDragPage(currentPage);
  const commitScrub = () => {
    if (dragPage !== null) onNavigate(dragPage);
    setDragPage(null);
  };

  return (
    <div className="page-scrubber">
      {scrubbing && (
        <div className="page-scrubber-bubble" style={{ left: `${pctForPage(previewPage)}%` }}>
          {fmtNum(previewPage)} · {t('library.juzInfoLabel', { n: fmtNum(previewJuz) })}
        </div>
      )}
      <div className="page-scrubber-track">
        {JUZ_RANGES.map(({ juz, start }) => (
          <span key={juz} className="page-scrubber-tick" style={{ left: `${pctForPage(start)}%` }} aria-hidden="true" />
        ))}
        <input
          type="range"
          className="page-scrubber-input"
          // Pin the native track's own physical direction regardless of UI
          // language — browsers mirror a range input's min/max sides under an
          // inherited `rtl` (as the whole document is in Arabic), which would
          // otherwise double-flip against the value inversion above and put
          // page 1 back on the left. Forcing ltr here keeps the numeric
          // inversion the only thing deciding the visual orientation.
          dir="ltr"
          min={1}
          max={TOTAL_PAGES}
          step={1}
          value={sliderValueForPage(previewPage)}
          onChange={handleChange}
          onPointerDown={startScrub}
          onPointerUp={commitScrub}
          onPointerCancel={commitScrub}
          aria-label={t('library.scrubberLabel')}
          aria-valuetext={`${fmtNum(previewPage)} · ${t('library.juzInfoLabel', { n: fmtNum(previewJuz) })}`}
        />
      </div>
    </div>
  );
}
