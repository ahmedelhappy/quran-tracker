import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiX } from 'react-icons/fi';
import Tooltip from './Tooltip';
import InfoHint from './InfoHint';
import { SURAH_PAGES } from '../data/surahPages';
import { HIZB_RANGES, RUB_RANGES } from '../data/hizbRanges';
import { JUZ_RANGES } from '../data/juzRanges';
import {
  hizbOrdRange, rubOrdRange, surahOrdRange, pageOrdRange, mergeOrdRanges, subtractOrdRanges,
  coverageOf, fullyCoveredPages,
} from '../utils/unitRanges';
import { toPageRanges, rangesToPages, validateRanges, countIn } from '../utils/pageRanges';
import { useDragSelect } from '../hooks/useDragSelect';

const MODES = [
  { mode: 'juz',   labelKey: 'onboarding.byJuz' },
  { mode: 'hizb',  labelKey: 'onboarding.byHizb' },
  { mode: 'rub',   labelKey: 'onboarding.byQuarterHizb' },
  { mode: 'surah', labelKey: 'onboarding.bySurah' },
  { mode: 'range', labelKey: 'onboarding.byRange' },
];

const TILE_FULL = 'bg-[#003527] text-white border-[#003527]';
const TILE_REMOVED = 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-700 dark:text-red-300';
const TILE_PARTIAL = 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 text-amber-800 dark:text-amber-300';
const TILE_NONE = 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:text-emerald-400 dark:hover:border-emerald-500';
const tileClass = ({ isFull, isPartial, isRemoved }) =>
  isFull ? TILE_FULL : isRemoved ? TILE_REMOVED : isPartial ? TILE_PARTIAL : TILE_NONE;

// Percentage of a unit's VERSES that are covered, for the editor's tile badge.
const verseCoveragePct = (merged, range) => {
  if (!range) return 0;
  let covered = 0;
  for (const m of merged) {
    if (m.to < range.from) continue;
    if (m.from > range.to) break;
    covered += Math.min(m.to, range.to) - Math.max(m.from, range.from) + 1;
  }
  return Math.round((covered / (range.to - range.from + 1)) * 100);
};

// "Which parts have you memorized?" — the five-tab selector (Juz, Hizb, quarter
// Hizb, Surah, page Range) shared by Onboarding and the Settings progress editor.
// It used to be written out twice and the two copies had drifted (M-20).
//
// The selection is VERSE ranges (global ayah numbers, `coverage`), owned by the
// parent: a Juz starts at the top of a page, but a Surah, Hizb or quarter-Hizb
// boundary falls mid-page and adjacent units SHARE that page, so rounding to
// pages spilled a selection into both neighbours. The page-shaped tabs (Juz,
// Range) read and write a derived view of whole pages and carry over the
// sub-page coverage they cannot show — rebuilding from pages alone once dropped
// it (toggling Juz 1 deleted a half-memorized page 22).
//
//   variant         'onboarding' | 'editor'. The editor also shows what the
//                   change removes (red, against `original`), each unit's
//                   percentage, and asks before deleting a range row.
//   coverage        the selection, as merged verse ranges
//   setCoverage     the parent's state setter (takes a value or an updater)
//   original        editor: { pages: Set, coverage } as loaded
//   onRangeErrorsChange(hasErrors)  the Range tab's rows became (in)valid
//   tabsExtra       editor: a control at the end of the tab row (Restore)
//
// The tab, the surah search and the range rows are this component's own state;
// remount it (a new `key`) to start them over.
export default function MemorizedUnitPicker({
  variant, coverage, setCoverage, original, onRangeErrorsChange, tabsExtra,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const editor = variant === 'editor';
  const [selectionMode, setSelectionMode] = useState('juz');
  const [surahSearch, setSurahSearch] = useState('');
  const [pageRanges, setPageRanges] = useState([{ start: '', end: '' }]);
  const [rangeErrors, setRangeErrorsState] = useState([{}]);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState(null);
  const ds = useDragSelect(); // drag across tiles to toggle the whole swept range

  const setRangeErrors = (next) => {
    setRangeErrorsState(next);
    onRangeErrorsChange?.(next.some(e => e.start || e.end));
  };
  // The range rows die with the picker (Onboarding's Back, the editor closing),
  // so their errors must not outlive it: a parent that kept "has errors" would
  // block its Continue or Save with nothing on screen to say why.
  const reportRef = useRef(onRangeErrorsChange);
  useEffect(() => { reportRef.current = onRangeErrorsChange; }, [onRangeErrorsChange]);
  useEffect(() => () => reportRef.current?.(false), []);

  const selectedPages = useMemo(() => fullyCoveredPages(coverage), [coverage]);
  const origPages = original?.pages;
  const origCoverage = original?.coverage;

  // Whole pages in, whole pages out — see the note above about sub-page coverage.
  // Always an updater, worked out from the selection as it is when it applies:
  // a drag across tiles toggles several in one gesture with the handler it
  // started with, and a value computed from that render's selection made each
  // tile overwrite the one before (only the last Juz of a sweep stayed).
  const setSelectedPages = (next) => setCoverage((current) => {
    const prevFull = fullyCoveredPages(current);
    const pages = typeof next === 'function' ? next(prevFull) : next;
    const subPage = subtractOrdRanges(current, [...prevFull].map(pageOrdRange));
    return mergeOrdRanges([...subPage, ...[...pages].map(pageOrdRange)]);
  });

  // Toggle every page in [start, end]: clear them if fully covered, otherwise add them all.
  const toggleRange = (start, end) => setSelectedPages(prev => {
    const next = new Set(prev);
    const full = countIn(next, start, end) === (end - start + 1);
    for (let p = start; p <= end; p++) { if (full) next.delete(p); else next.add(p); }
    return next;
  });
  const toggleJuz = (n) => { const r = JUZ_RANGES.find(j => j.juz === n); if (r) toggleRange(r.start, r.end); };
  // Surah, Hizb and quarter-Hizb are verse-exact: they add and remove the unit's
  // own verse span, which is what stops a selection bleeding into the unit next
  // door over the page the two share — and what lets a surah's last verses, on
  // the page the next surah opens, be selected at all (M-13). Same span the
  // server compiles for /progress/units.
  const toggleUnitRange = (range) => {
    if (!range) return;
    setCoverage((c) => (coverageOf(c, range) === 'full'
      ? subtractOrdRanges(c, [range])
      : mergeOrdRanges([...c, range])));
  };
  const toggleHizb = (n) => toggleUnitRange(hizbOrdRange(n));
  const toggleRub = (n) => toggleUnitRange(rubOrdRange(n));
  const toggleSurah = (n) => toggleUnitRange(surahOrdRange(n));

  const filteredSurahs = SURAH_PAGES.filter(s => {
    if (!surahSearch.trim()) return true;
    const q = surahSearch.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.arabic.includes(surahSearch.trim()) ||
      String(s.number).includes(q)
    );
  });

  // Tabs are views over one selection, so switching only re-renders. The Range
  // tab keeps editable text rows, so they are regenerated from it on entering.
  const handleTabSwitch = (newMode) => {
    if (newMode === selectionMode) return;
    if (newMode === 'range') {
      const derived = toPageRanges(Array.from(selectedPages).sort((a, b) => a - b));
      setPageRanges(derived);
      setRangeErrors(derived.map(() => ({})));
      setPendingDeleteIdx(null);
    }
    setSurahSearch('');
    setSelectionMode(newMode);
  };

  const addRange = () => {
    setPageRanges(r => [...r, { start: '', end: '' }]);
    setRangeErrors([...rangeErrors, {}]);
  };
  const removeRange = (i) => {
    const updated = pageRanges.filter((_, idx) => idx !== i);
    setPageRanges(updated);
    // Checked again: a row that overlapped only the one removed is fine now.
    setRangeErrors(validateRanges(updated));
    setSelectedPages(rangesToPages(updated));
  };
  const updateRange = (i, key, val) => {
    const updated = pageRanges.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setPageRanges(updated);
    setRangeErrors(validateRanges(updated));
    setSelectedPages(rangesToPages(updated));
  };
  // A row's error line gives way to its delete confirm, and its fields point at
  // the line only while it is there (M-12: a describedby to a missing id).
  const rangeErrorShown = (i) => !!(rangeErrors[i]?.start || rangeErrors[i]?.end) && pendingDeleteIdx !== i;
  const errorIdPrefix = editor ? 'settings-range-error' : 'onboarding-range-error';

  // A tile's state. "Removed" (red) is the editor's: the unit had something
  // memorized when the editor opened and has nothing now.
  const unitState = (range, pagesStart, pagesEnd, removedByVerses = false) => {
    const state = coverageOf(coverage, range);
    const isFull = state === 'full';
    const isPartial = state === 'partial';
    const isRemoved = editor && state === 'none' && (removedByVerses
      ? coverageOf(origCoverage, range) !== 'none'
      : countIn(origPages, pagesStart, pagesEnd) > 0);
    return { isFull, isPartial, isRemoved };
  };
  const pressed = ({ isFull, isPartial }) => (isFull ? true : isPartial ? 'mixed' : false);
  const pctBadge = (s, pct, className = 'text-[9px] leading-none opacity-80') => (editor && (s.isFull || s.isPartial || s.isRemoved) && (
    <span className={className}>{s.isFull ? '100' : s.isRemoved ? '0' : pct}%</span>
  ));

  const fullJuzCount = JUZ_RANGES.filter(({ start, end }) => countIn(selectedPages, start, end) === (end - start + 1)).length;
  const fullSurahCount = SURAH_PAGES.filter(s => coverageOf(coverage, surahOrdRange(s.number)) === 'full').length;
  const fullHizbCount = HIZB_RANGES.filter(({ hizb }) => coverageOf(coverage, hizbOrdRange(hizb)) === 'full').length;
  const fullRubCount = RUB_RANGES.filter(({ rub }) => coverageOf(coverage, rubOrdRange(rub)) === 'full').length;
  const allJuzSelected = fullJuzCount === JUZ_RANGES.length;
  const selectAll = () => setSelectedPages(allJuzSelected ? new Set() : new Set(Array.from({ length: 604 }, (_, i) => i + 1)));
  // The count under a grid. The editor always says something; onboarding only
  // once something is picked.
  const countLine = (count, key) => (editor ? (
    <p className="text-xs text-[#707974] dark:text-gray-400 mt-2">
      {count > 0 ? t(key, { count }) : t('settings.noJuzSelected')}
    </p>
  ) : count > 0 && (
    <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium mt-2">{t(key, { count })}</p>
  ));

  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-[#404944] dark:text-gray-400 flex items-center gap-1">
          {t('onboarding.selectMode')}
          {!editor && <InfoHint text={t('hints.juz')} label={t('progress.juz')} size="xs" />}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {MODES.map(({ mode, labelKey }) => (
            <button
              key={mode}
              onClick={() => handleTabSwitch(mode)}
              aria-pressed={selectionMode === mode}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                selectionMode === mode
                  ? 'bg-[#003527] text-white border-[#003527]'
                  : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:text-emerald-400 dark:hover:border-emerald-500'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
          {tabsExtra}
        </div>
      </div>

      {selectionMode === 'juz' && (
        <div>
          <div className={`grid gap-2 ${editor ? 'grid-cols-5' : 'grid-cols-5 md:grid-cols-10'}`}>
            {JUZ_RANGES.map(({ juz, start, end }) => {
              const size = end - start + 1;
              const sel = countIn(selectedPages, start, end);
              const s = {
                isFull: sel === size,
                isPartial: sel > 0 && sel < size,
                isRemoved: editor && sel === 0 && countIn(origPages, start, end) > 0,
              };
              return (
                <button
                  key={juz}
                  data-tile-id={juz}
                  onPointerDown={(e) => ds.start(e, juz, toggleJuz)}
                  onClick={() => ds.handleClick(juz, toggleJuz)}
                  aria-pressed={pressed(s)}
                  // The editor's tile reads its number and percentage; Onboarding's
                  // shows just the number, so it is named in full.
                  aria-label={editor ? undefined : t('common.juzN', { n: juz })}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-pointer transition-colors border touch-pan-y select-none ${tileClass(s)}`}
                >
                  <span>{juz}</span>
                  {pctBadge(s, Math.round((sel / size) * 100))}
                </button>
              );
            })}
          </div>
          {editor ? (
            <>
              {countLine(fullJuzCount, 'settings.juzSelected')}
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t('settings.juzGridNote')}</p>
            </>
          ) : (
            <div className="flex items-center justify-between mt-2">
              {fullJuzCount > 0 && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">{t('onboarding.juzSelected', { count: fullJuzCount })}</p>
              )}
              <button onClick={selectAll} className="ms-auto text-xs font-medium text-[#003527] dark:text-emerald-400 hover:text-[#064e3b] transition-colors flex items-center gap-1">
                {allJuzSelected ? t('onboarding.deselectAll') : t('onboarding.selectAll')}
              </button>
            </div>
          )}
        </div>
      )}

      {selectionMode === 'hizb' && (
        <div>
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
            {HIZB_RANGES.map(({ hizb, start, end }) => {
              const range = hizbOrdRange(hizb);
              const s = unitState(range, start, end);
              return (
                <button
                  key={hizb}
                  data-tile-id={hizb}
                  onPointerDown={(e) => ds.start(e, hizb, toggleHizb)}
                  onClick={() => ds.handleClick(hizb, toggleHizb)}
                  aria-pressed={pressed(s)}
                  // The editor's tile reads its number and percentage; Onboarding's
                  // shows just the number, so it is named in full.
                  aria-label={editor ? undefined : t('common.hizbN', { n: hizb })}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-pointer transition-colors border touch-pan-y select-none ${tileClass(s)}`}
                >
                  <span>{hizb}</span>
                  {pctBadge(s, editor ? verseCoveragePct(coverage, range) : 0)}
                </button>
              );
            })}
          </div>
          {countLine(fullHizbCount, 'onboarding.hizbSelected')}
        </div>
      )}

      {selectionMode === 'rub' && (
        <div>
          <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
            {RUB_RANGES.map(({ rub, hizb, quarter, start, end }) => {
              const s = unitState(rubOrdRange(rub), start, end);
              return (
                <Tooltip key={rub} label={t('onboarding.quarterHizbTooltip', { hizb, quarter })}>
                  <button
                    data-tile-id={rub}
                    onPointerDown={(e) => ds.start(e, rub, toggleRub)}
                    onClick={() => ds.handleClick(rub, toggleRub)}
                    aria-pressed={pressed(s)}
                    className={`aspect-square w-full rounded-md flex items-center justify-center text-[10px] font-medium cursor-pointer transition-colors border touch-pan-y select-none ${tileClass(s)}`}
                  >
                    {hizb}.{quarter}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          {countLine(fullRubCount, 'onboarding.quarterHizbSelected')}
        </div>
      )}

      {selectionMode === 'surah' && (
        <div>
          <input
            type="text"
            aria-label={t('onboarding.surahSearchPlaceholder')}
            placeholder={t('onboarding.surahSearchPlaceholder')}
            value={surahSearch}
            onChange={e => setSurahSearch(e.target.value)}
            className="w-full border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 mb-3"
          />
          <div className={`grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${editor ? '' : 'lg:grid-cols-5'}`}>
            {filteredSurahs.map(surah => {
              const range = surahOrdRange(surah.number);
              // The editor's "removed" is against the VERSES held when it opened:
              // a surah's first and last pages are shared, so "a page of it was
              // memorized" would flag a surah none of whose verses were.
              const s = unitState(range, 0, -1, true);
              return (
                <button
                  key={surah.number}
                  data-tile-id={surah.number}
                  onPointerDown={(e) => ds.start(e, surah.number, toggleSurah)}
                  onClick={() => ds.handleClick(surah.number, toggleSurah)}
                  aria-pressed={pressed(s)}
                  className={`${editor
                    ? 'relative flex flex-col items-center justify-center h-[76px] px-2 pt-4 pb-1'
                    : 'flex flex-col items-center justify-center p-2'} rounded-lg border text-center transition-colors touch-pan-y select-none ${tileClass(s)}`}
                >
                  {pctBadge(s, editor ? verseCoveragePct(coverage, range) : 0, 'absolute top-1 end-1 text-[9px] leading-none opacity-80')}
                  <span className={`text-xs font-medium leading-tight${editor ? ' line-clamp-2 w-full' : ''}`}>
                    {surah.number}. {isArabic ? surah.arabic : surah.name}
                  </span>
                  <span className={`text-[10px] mt-0.5 leading-tight${editor ? ' line-clamp-1 w-full' : ''} ${
                    s.isFull ? 'text-white/70'
                      : s.isRemoved ? 'text-red-600/70 dark:text-red-300/70'
                        : s.isPartial ? 'text-amber-700/70 dark:text-amber-300/70'
                          : 'text-[#404944]/60 dark:text-gray-400'}`}
                  >
                    {isArabic ? surah.name : surah.arabic}
                  </span>
                </button>
              );
            })}
          </div>
          {fullSurahCount > 0 && (
            <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium mt-2">{t('onboarding.surahsSelected', { count: fullSurahCount })}</p>
          )}
        </div>
      )}

      {selectionMode === 'range' && (
        <div>
          {editor ? (
            <>
              <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-1">{t('settings.rangeTabTitle')}</p>
              <p className="text-xs text-[#707974] dark:text-gray-400 mb-3">{t('settings.rangeTabHint')}</p>
            </>
          ) : (
            <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-3">
              {t('onboarding.addPageRanges')} <span className="text-xs font-normal text-[#404944] dark:text-gray-400">{t('onboarding.optional')}</span>
            </p>
          )}
          <div className="space-y-2">
            {pageRanges.map((r, i) => {
              const field = (key, labelKey) => (
                <input
                  type="number" min="1" max="604" value={r[key]}
                  onChange={e => { updateRange(i, key, e.target.value); setPendingDeleteIdx(null); }}
                  aria-label={t(labelKey)}
                  aria-invalid={!!rangeErrors[i]?.[key]}
                  aria-describedby={rangeErrorShown(i) ? `${errorIdPrefix}-${i}` : undefined}
                  placeholder={t(labelKey)}
                  className={`${editor ? 'flex-1 ' : 'w-full '}border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.[key] ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`}
                />
              );
              const startField = field('start', editor ? 'settings.rangeStart' : 'onboarding.rangeStart');
              const endField = field('end', editor ? 'settings.rangeEnd' : 'onboarding.rangeEnd');
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {editor ? startField : <div className="flex-1 relative">{startField}</div>}
                    <span className="text-[#404944] dark:text-gray-400 text-sm shrink-0">{t(editor ? 'settings.to' : 'onboarding.to')}</span>
                    {editor ? endField : <div className="flex-1 relative">{endField}</div>}
                    {editor ? (
                      // Removing a row of an existing selection asks first.
                      <Tooltip label={t('tooltips.removeRange')}>
                        <button
                          onClick={() => setPendingDeleteIdx(pendingDeleteIdx === i ? null : i)}
                          className={`shrink-0 transition-colors ${pendingDeleteIdx === i ? 'text-[#ba1a1a]' : 'text-[#bfc9c3] dark:text-gray-500 hover:text-[#ba1a1a] dark:hover:text-red-400'}`}
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    ) : pageRanges.length > 1 && (
                      <Tooltip label={t('tooltips.removeRange')} className="flex-shrink-0">
                        <button onClick={() => removeRange(i)} className="text-[#404944] dark:text-gray-400 hover:text-[#ba1a1a]">
                          <FiX className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {pendingDeleteIdx === i && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-lg">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {t('settings.rangeDeleteConfirm', { start: r.start || '?', end: r.end || '?' })}
                      </p>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => setPendingDeleteIdx(null)} className="text-xs text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors">
                          {t('settings.cancel')}
                        </button>
                        <button
                          onClick={() => {
                            removeRange(i);
                            setPendingDeleteIdx(null);
                          }}
                          className="text-xs font-semibold text-[#ba1a1a] hover:text-red-800 dark:hover:text-red-300 transition-colors"
                        >
                          {t('settings.rangeDeleteConfirmBtn')}
                        </button>
                      </div>
                    </div>
                  )}
                  {rangeErrorShown(i) && (
                    <p id={`${errorIdPrefix}-${i}`} className="text-xs text-[#ba1a1a]">{t(rangeErrors[i]?.end || rangeErrors[i]?.start)}</p>
                  )}
                </div>
              );
            })}
            <button onClick={addRange} className="flex items-center gap-1.5 text-xs text-[#003527] dark:text-emerald-400 font-medium hover:underline mt-1">
              <FiPlus className="w-3 h-3" /> {t(editor ? 'settings.addRange' : 'onboarding.addRange')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
