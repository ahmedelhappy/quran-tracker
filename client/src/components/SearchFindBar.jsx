import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiChevronLeft, FiChevronRight, FiCheck } from 'react-icons/fi';
import Tooltip from './Tooltip';

// The occurrence bar: where in a search's hits the reader is ("3 / 47"), a step
// either way, and Done.
//
// WHERE it sits is the point. The mushaf fits the window by a settled decision —
// its height is the window minus a fixed budget of chrome (index.css,
// --mushaf-chrome) — so nothing new may take room from it, sit in the reading
// column, or float over the text. The one strip that budget already gives away is
// the navbar's, so the bar takes over THAT band while a search is being stepped
// through, the way a phone's find-in-page takes over its toolbar: same height,
// same surface, fixed to the top. It cannot cover a glyph the navbar would not
// already cover, it changes nothing about the page's size or position, and it is
// nowhere near the audio bar, the zoom control or the edge arrows. Done gives the
// band back to the navbar.
//
// The arrows follow the book, not the interface language: the mushaf is read
// right to left, so FORWARD is the LEFT arrow in both languages — exactly the
// pager's convention (dir="ltr" pins the physical order).
//
// Keys, while focus is in the bar (it takes focus when a result is picked):
// Enter = next, Shift+Enter = previous, Escape = Done. F3 / Shift+F3 work from
// anywhere on the page (the reader handles those).
const SearchFindBar = forwardRef(function SearchFindBar(
  { query, index, total, announce, onNext, onPrev, onDone, onEdit, fmtNum },
  ref,
) {
  const { t } = useTranslation();

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone(); return; }
    if (e.key !== 'Enter') return;
    if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); onPrev(); return; }
    // A focused button does its own thing on Enter (Done is done, ‹ is next…);
    // anywhere else in the bar Enter steps forward.
    if (e.target.closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    onNext();
  };

  const stepCls = 'w-9 h-9 rounded-lg flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 border border-[#dce2f3] dark:border-gray-600 transition-colors disabled:opacity-30';

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label={t('library.search.bar.label')}
      onKeyDown={onKeyDown}
      data-keeps-selection
      data-testid="search-find-bar"
      className="search-find-bar fixed top-0 inset-x-0 z-55 h-[72px] bg-white dark:bg-gray-900 border-b border-emerald-100/40 dark:border-gray-700/60 sacred-shadow"
    >
      <div className="h-full max-w-[760px] mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('library.search.bar.edit', { q: query })}
          className="min-w-0 flex-1 h-9 flex items-center gap-2 px-3 rounded-lg bg-[#f0f4ff] dark:bg-gray-800 text-start text-sm text-[#1A1A1A] dark:text-gray-100 hover:bg-[#e6ecfb] dark:hover:bg-gray-700 transition-colors"
        >
          <FiSearch className="w-4 h-4 shrink-0 text-[#004f35] dark:text-emerald-400" aria-hidden="true" />
          <span className="truncate" dir="auto">{query}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
          <Tooltip label={t('library.search.bar.next')} placement="bottom">
            <button type="button" onClick={onNext} disabled={total < 2} aria-label={t('library.search.bar.next')} className={stepCls} data-testid="search-next">
              <FiChevronLeft className="w-5 h-5" />
            </button>
          </Tooltip>
          <span className="min-w-18 text-center text-sm font-semibold tabular-nums text-[#003527] dark:text-gray-100" data-testid="search-position">
            {t('library.search.bar.position', { i: fmtNum(index + 1), n: fmtNum(total) })}
          </span>
          <Tooltip label={t('library.search.bar.prev')} placement="bottom">
            <button type="button" onClick={onPrev} disabled={total < 2} aria-label={t('library.search.bar.prev')} className={stepCls} data-testid="search-prev">
              <FiChevronRight className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <Tooltip label={t('library.search.bar.doneHint')} placement="bottom">
          <button
            type="button"
            onClick={onDone}
            data-testid="search-done"
            className="shrink-0 h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#004f35] hover:bg-[#003527] text-white text-sm font-semibold transition-colors"
          >
            <FiCheck className="w-4 h-4" aria-hidden="true" />
            {t('library.search.bar.done')}
          </button>
        </Tooltip>
      </div>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  );
});

export default SearchFindBar;
