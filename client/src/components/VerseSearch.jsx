import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiX, FiCornerDownLeft, FiBookOpen, FiFile, FiLayers, FiAlertCircle, FiClock } from 'react-icons/fi';
import { loadSearchEngine } from '../services/quranSearch';
import { parseJumps, arabicTokens } from '../utils/quranSearchQuery';
import { verseOfOrd, pageOfOrd, ordOf } from '../utils/verseIndex';
import { SURAH_BY_NUMBER } from '../data/surahPages';
import { useRecentRows } from '../hooks/useRecentPages';

const DEBOUNCE_MS = 120;
const PAGE_SIZE = 30;          // verse rows shown before "show more"
const MIN_LETTERS = 2;         // a single letter matches most of the Quran
const SNIPPET_CONTEXT = 6;     // words kept either side of the hits in a long verse
const SNIPPET_WHOLE = 18;      // verses up to this many words are shown whole

// The search dialog: one box for words, phrases, references and names.
//
// A combobox (the input keeps focus; ↑/↓ move the active suggestion, Enter takes
// it, Escape closes), with two groups of suggestions:
//   - "Go to": references and names that jump straight somewhere (parseJumps);
//   - verses: every verse the words occur in, in mushaf order, each with its
//     surah, ayah and page, a voweled snippet with the hit marked, and how many
//     times it occurs there. The summary counts OCCURRENCES (a verse matching
//     twice counts two), which is what the occurrence bar steps through.
// The first VERSE is the default suggestion when there is one, so a word that is
// also a surah's name ("الرحمن") still opens on its first occurrence; the jump is
// one ↑ (or a click) away. With no verses, the first jump is the default.
//
// The index is loaded on the first open (services/quranSearch.js).
//
// With nothing typed the box lists the pages read recently (newest first, minus
// the page(s) on screen, `recentExclude`) as options of the same combobox.
// Nothing is picked until ↓ (or ↑) — so "/", ↓, Enter goes back to the last page
// read; Enter opens the picked one, Delete (or its ×) removes it, and "Clear
// history" empties the list.
export default function VerseSearch({ open, query, onQueryChange, onClose, onPickOccurrence, onJump, fmtNum, isArabic, recentExclude = [], onPickRecent, onRemoveRecent, onClearRecent }) {
  const { t } = useTranslation();
  const recent = useRecentRows(recentExclude, open);
  const listId = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [engineState, setEngineState] = useState({ status: 'idle', engine: null });
  const [retryKey, setRetryKey] = useState(0);
  const [debounced, setDebounced] = useState(query);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [active, setActive] = useState(0);
  const [recentActive, setRecentActive] = useState(-1);

  // Load the index the first time the box opens (and again after a failure, on Retry).
  useEffect(() => {
    if (!open || engineState.status === 'ready') return;
    let cancelled = false;
    setEngineState({ status: 'loading', engine: null });
    loadSearchEngine()
      .then((engine) => { if (!cancelled) setEngineState({ status: 'ready', engine }); })
      .catch(() => { if (!cancelled) setEngineState({ status: 'error', engine: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retryKey]);

  // Focus the box and select what is in it, so typing replaces the last query.
  useEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const jumps = useMemo(() => parseJumps(debounced), [debounced]);
  const engine = engineState.engine;
  const letters = useMemo(() => arabicTokens(debounced).join('').replace(/[0-9]/g, '').length, [debounced]);

  // The text search proper. Timed with the User Timing API ('quran-search'), so
  // its cost per keystroke can be read off the performance timeline.
  const result = useMemo(() => {
    if (!engine || letters < MIN_LETTERS) return null;
    const t0 = performance.now();
    const { occurrences } = engine.search(debounced);
    const byVerse = new Map();
    occurrences.forEach((o, i) => {
      let row = byVerse.get(o.ord);
      if (!row) { row = { ord: o.ord, first: i, hits: [] }; byVerse.set(o.ord, row); }
      row.hits.push(o);
    });
    performance.measure?.('quran-search', { start: t0, end: performance.now() });
    return { occurrences, verses: [...byVerse.values()] };
  }, [engine, debounced, letters]);

  // A new query starts at the top of a fresh list.
  const [listFor, setListFor] = useState(null);
  if (listFor !== result) {
    setListFor(result);
    setShown(PAGE_SIZE);
    setActive(result?.verses.length ? jumps.length : 0);
  }
  const [jumpsFor, setJumpsFor] = useState(jumps);
  if (jumpsFor !== jumps) {
    setJumpsFor(jumps);
    setActive(result?.verses.length ? jumps.length : 0);
  }

  // Back to an empty box (or opened again): no recent page is picked yet.
  const typed = query.trim().length > 0;
  const showingRecent = open && !typed;
  const [recentFor, setRecentFor] = useState(showingRecent);
  if (recentFor !== showingRecent) {
    setRecentFor(showingRecent);
    setRecentActive(-1);
  }
  const recentIndex = Math.min(recentActive, recent.length - 1);

  const verseRows = result ? result.verses.slice(0, shown) : [];
  const moreCount = result ? result.verses.length - verseRows.length : 0;
  // Everything ↑/↓ walks through, in screen order.
  const items = [
    ...jumps.map((j) => ({ kind: 'jump', jump: j })),
    ...verseRows.map((row) => ({ kind: 'verse', row })),
    ...(moreCount > 0 ? [{ kind: 'more' }] : []),
  ];
  const activeIndex = Math.min(active, items.length - 1);
  const optionId = (i) => `${listId}-opt-${i}`;
  const recentId = (i) => `${listId}-recent-${i}`;

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, shown]);
  useEffect(() => {
    if (recentIndex < 0) return;
    document.getElementById(recentId(recentIndex))?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentIndex]);

  if (!open) return null;

  const surahName = (n) => (isArabic ? SURAH_BY_NUMBER[n]?.arabic : SURAH_BY_NUMBER[n]?.name) ?? '';

  const choose = (item) => {
    if (!item) return;
    if (item.kind === 'more') { setShown((n) => n + PAGE_SIZE); return; }
    if (item.kind === 'jump') { onJump(item.jump); return; }
    onPickOccurrence({ query: debounced.trim(), occurrences: result.occurrences, index: item.row.first });
  };

  const onKeyDown = (e) => {
    // Nothing typed here may reach the reader's own shortcuts (arrows turn pages).
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (!typed) { onRecentKey(e); return; }
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((activeIndex + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((activeIndex - 1 + items.length) % items.length); }
    else if (e.key === 'Enter') {
      // Still typing: let the debounce catch up first, so Enter acts on what is in the box.
      if (debounced !== query) return;
      e.preventDefault();
      choose(items[activeIndex]);
    }
  };

  // The recent pages: ↓ from nothing picks the newest, ↑ the oldest; both wrap.
  const onRecentKey = (e) => {
    const n = recent.length;
    if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setRecentActive(recentIndex < 0 ? 0 : (recentIndex + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setRecentActive(recentIndex < 0 ? n - 1 : (recentIndex - 1 + n) % n); }
    else if (e.key === 'Enter' && recentIndex >= 0) { e.preventDefault(); onPickRecent(recent[recentIndex].entry); }
    else if (e.key === 'Delete' && recentIndex >= 0) {
      e.preventDefault();
      onRemoveRecent(recent[recentIndex].key);
      // The next row moves up into its place and is the one picked now.
      if (recentIndex === n - 1) setRecentActive(n - 2);
    }
  };

  const jumpRow = (j) => {
    switch (j.type) {
      case 'verse': {
        const page = pageOfOrd(ordOf(j.surahNumber, j.ayahNumber));
        return { icon: FiBookOpen, title: t('library.search.jump.verse', { surah: surahName(j.surahNumber), ayah: fmtNum(j.ayahNumber) }), meta: t('library.search.pageShort', { n: fmtNum(page) }) };
      }
      case 'surah':
        return { icon: FiBookOpen, title: t('library.search.jump.surah', { n: fmtNum(j.surahNumber), surah: surahName(j.surahNumber) }), meta: t('library.search.pageShort', { n: fmtNum(SURAH_BY_NUMBER[j.surahNumber].start) }) };
      case 'page':
        return { icon: FiFile, title: t('library.search.jump.page', { n: fmtNum(j.page) }), meta: '' };
      case 'juz':
        return { icon: FiLayers, title: t('library.search.jump.juz', { n: fmtNum(j.juz) }), meta: t('library.search.pageShort', { n: fmtNum(j.page) }) };
      default:
        return { icon: FiLayers, title: t('library.search.jump.hizb', { n: fmtNum(j.hizb) }), meta: t('library.search.pageShort', { n: fmtNum(j.page) }) };
    }
  };

  // The verse's words with the hits marked, cut to a window around them when long.
  const snippet = (row) => {
    const words = engine.words(row.ord);
    const hit = new Set();
    for (const o of row.hits) for (let p = o.from; p <= o.to; p++) hit.add(p);
    let start = 0;
    let end = words.length;
    if (words.length > SNIPPET_WHOLE) {
      start = Math.max(0, row.hits[0].from - 1 - SNIPPET_CONTEXT);
      end = Math.min(words.length, row.hits[row.hits.length - 1].to + SNIPPET_CONTEXT);
    }
    // A run of matched words is ONE mark, spaces included, so a phrase reads as one.
    const parts = [];
    for (let i = start; i < end; ) {
      if (i > start) parts.push(' ');
      if (!hit.has(i + 1)) { parts.push(words[i]); i++; continue; }
      let j = i;
      while (j + 1 < end && hit.has(j + 2)) j++;
      parts.push(<mark key={i}>{words.slice(i, j + 1).join(' ')}</mark>);
      i = j + 1;
    }
    return (
      <p className="search-snippet" dir="rtl" lang="ar">
        {start > 0 && '… '}{parts}{end < words.length && ' …'}
      </p>
    );
  };

  const loading = engineState.status === 'loading' || engineState.status === 'idle';
  // One Arabic letter is too little to search on; no Arabic at all (a Latin word
  // that names no surah, say) is simply nothing found.
  const tooShort = letters > 0 && letters < MIN_LETTERS;
  const noResults = typed && debounced === query && !jumps.length && (
    letters === 0 || (letters >= MIN_LETTERS && engineState.status === 'ready' && !result?.occurrences.length));
  const occCount = result?.occurrences.length ?? 0;
  const groupHead = 'px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500';

  const optionCls = (i, layout = 'flex items-start gap-3') => `w-full text-start ${layout} px-4 py-2.5 cursor-pointer transition-colors ${
    i === activeIndex ? 'bg-[#f0f4ff] dark:bg-gray-700/70' : 'hover:bg-[#f7f9ff] dark:hover:bg-gray-700/40'
  }`;
  // An option is pressed with the mouse without taking focus off the box.
  const keepFocus = (e) => e.preventDefault();

  return (
    <div className="fixed inset-0 z-60 flex justify-center items-start p-3 sm:p-4 sm:pt-[9vh]" onKeyDown={onKeyDown} data-keeps-selection>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('library.search.dialogLabel')}
        className="relative z-10 w-full max-w-160 max-h-[calc(100dvh-1.5rem)] sm:max-h-[78vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 border-b border-[#dce2f3] dark:border-gray-700">
          <FiSearch className="w-5 h-5 shrink-0 text-[#004f35] dark:text-emerald-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={typed ? items.length > 0 : recent.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={typed
              ? (items.length ? optionId(activeIndex) : undefined)
              : (recentIndex >= 0 ? recentId(recentIndex) : undefined)}
            aria-label={t('library.search.dialogLabel')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('library.search.placeholder')}
            dir="auto"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="search-input flex-1 min-w-0 bg-transparent py-3.5 text-base text-[#1A1A1A] dark:text-gray-100 placeholder:text-[#9aa3a0] dark:placeholder:text-gray-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {typed && (
            <button
              type="button"
              onClick={() => { onQueryChange(''); inputRef.current?.focus(); }}
              aria-label={t('library.search.clear')}
              className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[#707974] hover:bg-[#f0f4ff] dark:hover:bg-gray-700"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs font-semibold text-[#404944] dark:text-gray-300 px-2 py-1 rounded-md border border-[#dce2f3] dark:border-gray-600 hover:bg-[#f0f4ff] dark:hover:bg-gray-700"
          >
            {t('library.search.esc')}
          </button>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {!typed ? (
            <div data-search-empty>
              {recent.length > 0 && (
                <div className="pb-2 border-b border-[#dce2f3] dark:border-gray-700" data-testid="recent-list">
                  <div className={`${groupHead} flex items-center justify-between gap-2`}>
                    <span id={`${listId}-recent-title`}>{t('library.recent.title')}</span>
                    <button
                      type="button"
                      onMouseDown={keepFocus}
                      onClick={() => { onClearRecent(); inputRef.current?.focus(); }}
                      data-testid="recent-clear"
                      className="normal-case tracking-normal text-[11px] font-semibold text-[#004f35] dark:text-emerald-400 hover:underline"
                    >
                      {t('library.recent.clear')}
                    </button>
                  </div>
                  <div id={listId} role="listbox" aria-labelledby={`${listId}-recent-title`}>
                    {recent.map((r, i) => (
                      <div key={r.key} id={recentId(i)} role="option" aria-selected={i === recentIndex} data-recent={r.key}
                        className={`w-full text-start flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                          i === recentIndex ? 'bg-[#f0f4ff] dark:bg-gray-700/70' : 'hover:bg-[#f7f9ff] dark:hover:bg-gray-700/40'
                        }`}
                        onMouseDown={keepFocus}
                        onMouseMove={() => { if (recentIndex !== i) setRecentActive(i); }}
                        onClick={() => onPickRecent(r.entry)}>
                        <FiClock className="w-4 h-4 shrink-0 text-[#707974] dark:text-gray-500" aria-hidden="true" />
                        <span className="flex-1 min-w-0 flex items-baseline gap-2 text-sm">
                          <span className="font-semibold text-[#1A1A1A] dark:text-gray-100 whitespace-nowrap">{r.label}</span>
                          {r.surah && <span className="truncate text-[#707974] dark:text-gray-400">{r.surah}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-[#707974] dark:text-gray-400">{r.ago}</span>
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={keepFocus}
                          onClick={(e) => { e.stopPropagation(); onRemoveRecent(r.key); inputRef.current?.focus(); }}
                          aria-label={t('library.recent.remove', { label: r.label })}
                          data-testid="recent-remove"
                          className="w-6 h-6 -me-1 shrink-0 rounded-full flex items-center justify-center text-[#707974] hover:bg-white hover:text-[#1A1A1A] dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                        >
                          <FiX className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="px-4 pt-1 text-[11px] text-[#9aa3a0] dark:text-gray-500">{t('library.recent.deviceNote')}</p>
                </div>
              )}
              <div className="px-4 py-5">
                <p className="text-sm font-semibold text-[#003527] dark:text-gray-100">{t('library.search.emptyTitle')}</p>
                <p className="mt-1 text-sm text-[#707974] dark:text-gray-400">{t('library.search.emptyBody')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['الرحمن', 'يا أيها الذين آمنوا', '2:255', t('library.search.exampleSurah'), t('library.search.examplePage')].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => { onQueryChange(ex); inputRef.current?.focus(); }}
                      dir="auto"
                      className="px-2.5 py-1 rounded-full border border-[#dce2f3] dark:border-gray-600 text-xs text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label={t('library.search.dialogLabel')} className="pb-2">
              {jumps.length > 0 && (
                <div role="group" aria-label={t('library.search.goTo')}>
                  <div className={groupHead} aria-hidden="true">{t('library.search.goTo')}</div>
                  {jumps.map((j, i) => {
                    const r = jumpRow(j);
                    const Icon = r.icon;
                    return (
                      <div key={i} id={optionId(i)} role="option" aria-selected={i === activeIndex} className={optionCls(i)}
                        onMouseDown={keepFocus}
                        onMouseMove={() => { if (activeIndex !== i) setActive(i); }}
                        onClick={() => choose(items[i])}>
                        <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#004f35] dark:text-emerald-400" aria-hidden="true" />
                        <span className="flex-1 min-w-0 text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">{r.title}</span>
                        {r.meta && <span className="text-xs text-[#707974] dark:text-gray-400 shrink-0">{r.meta}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {loading && letters >= MIN_LETTERS && (
                <p className="px-4 py-4 text-sm text-[#707974] dark:text-gray-400 flex items-center gap-2" role="status">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#004f35]/30 border-t-[#004f35] dark:border-emerald-400/30 dark:border-t-emerald-400 animate-spin" aria-hidden="true" />
                  {t('library.search.loading')}
                </p>
              )}
              {engineState.status === 'error' && letters >= MIN_LETTERS && (
                <div className="px-4 py-4 text-sm text-[#404944] dark:text-gray-300 flex items-center gap-2" role="alert">
                  <FiAlertCircle className="w-4 h-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="flex-1">{t('library.search.loadError')}</span>
                  <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="font-semibold text-[#004f35] dark:text-emerald-400 hover:underline">
                    {t('common.retry')}
                  </button>
                </div>
              )}
              {tooShort && !jumps.length && (
                <p className="px-4 py-4 text-sm text-[#707974] dark:text-gray-400">{t('library.search.tooShort')}</p>
              )}

              {result && result.verses.length > 0 && (
                <div role="group" aria-label={t('library.search.verses')}>
                  <div className={`${groupHead} flex items-center justify-between gap-2`}>
                    <span aria-hidden="true">{t('library.search.verses')}</span>
                    <span className="normal-case tracking-normal font-semibold text-[11px] text-[#404944] dark:text-gray-300">
                      {t('library.search.occurrences', { count: occCount, n: fmtNum(occCount) })}
                      {' '}{t('library.search.inVerses', { count: result.verses.length, n: fmtNum(result.verses.length) })}
                    </span>
                  </div>
                  {verseRows.map((row, k) => {
                    const i = jumps.length + k;
                    const v = verseOfOrd(row.ord);
                    return (
                      <div key={row.ord} id={optionId(i)} role="option" aria-selected={i === activeIndex} className={`search-row ${optionCls(i, 'flex flex-col gap-0.5')}`}
                        onMouseDown={keepFocus}
                        onMouseMove={() => { if (activeIndex !== i) setActive(i); }}
                        onClick={() => choose(items[i])}>
                        <span className="w-full flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#003527] dark:text-gray-100">
                            {t('library.search.verseRef', { surah: surahName(v.surahNumber), ayah: fmtNum(v.ayahNumber) })}
                          </span>
                          <span className="text-[#707974] dark:text-gray-400">· {t('library.search.pageShort', { n: fmtNum(pageOfOrd(row.ord)) })}</span>
                          {row.hits.length > 1 && (
                            <span className="ms-auto px-1.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 font-semibold"
                              title={t('library.search.inThisVerse', { count: row.hits.length, n: fmtNum(row.hits.length) })}>
                              ×{fmtNum(row.hits.length)}
                            </span>
                          )}
                        </span>
                        {snippet(row)}
                      </div>
                    );
                  })}
                  {moreCount > 0 && (
                    <div id={optionId(items.length - 1)} role="option" aria-selected={activeIndex === items.length - 1} data-testid="search-more"
                      className={`${optionCls(items.length - 1, 'flex justify-center')} text-sm font-semibold text-[#004f35] dark:text-emerald-400`}
                      onMouseDown={keepFocus}
                        onMouseMove={() => { if (activeIndex !== items.length - 1) setActive(items.length - 1); }}
                      onClick={() => choose({ kind: 'more' })}>
                      {t('library.search.showMore', { count: Math.min(moreCount, PAGE_SIZE), n: fmtNum(Math.min(moreCount, PAGE_SIZE)), total: fmtNum(moreCount) })}
                    </div>
                  )}
                </div>
              )}

              {noResults && (
                <div className="px-4 py-6 text-center" role="status">
                  <p className="text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">{t('library.search.noResults', { q: query.trim() })}</p>
                  <p className="mt-1 text-xs text-[#707974] dark:text-gray-400">{t('library.search.noResultsHint')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-[#dce2f3] dark:border-gray-700 text-[11px] text-[#707974] dark:text-gray-400">
          <span><kbd className="search-kbd">↑</kbd> <kbd className="search-kbd">↓</kbd> {t('library.search.keys.move')}</span>
          <span><kbd className="search-kbd"><FiCornerDownLeft className="inline w-3 h-3" /></kbd> {t('library.search.keys.open')}</span>
          {!typed && recent.length > 0 && <span><kbd className="search-kbd">Del</kbd> {t('library.recent.keys.remove')}</span>}
          <span><kbd className="search-kbd">Esc</kbd> {t('library.search.keys.close')}</span>
        </div>
      </div>
    </div>
  );
}
