import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward, FiX,
  FiBookOpen, FiChevronLeft, FiChevronRight, FiChevronDown, FiAlertCircle, FiHeadphones, FiInfo, FiMove,
  FiEye, FiEyeOff, FiHelpCircle, FiCheckSquare, FiSquare, FiFile, FiColumns,
  FiMaximize2, FiMinimize2, FiCheckCircle, FiCircle, FiBookmark, FiTrash2, FiPlus,
  FiFlag, FiMessageSquare, FiCornerUpRight,
  FiPenTool, FiEdit2, FiEdit3, FiDelete, FiRotateCcw, FiRotateCw, FiCheck, FiDroplet, FiType, FiRepeat,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import HowToMemorizeModal from '../components/HowToMemorizeModal';
import ConfirmModal from '../components/ConfirmModal';
import MushafPage from '../components/MushafPage';
import MushafMarks from '../components/MushafMarks';
import MushafDrawLayer from '../components/MushafDrawLayer';
import PageScrubber from '../components/PageScrubber';
import { startLibraryTour, startVerseActionsCoachmark } from '../components/libraryTour';
import { progressAPI, bookmarksAPI, annotationsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  fetchPageTafsir,
  fetchAyahTafsir,
  getAyahAudioUrl,
  toArabicDigits,
  RECITERS,
  DEFAULT_RECITER,
  TAFSIR_EDITIONS,
} from '../services/quranApi';
import { fetchMushafPage, ensurePageFont, mushafFontFamily, peekMushafPage } from '../services/mushafApi';
import { SURAH_PAGES } from '../data/surahPages';
import { useDraggable } from '../hooks/useDraggable';

const JUZ_START_PAGES = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582,
];

const clampPage = (n) => Math.max(1, Math.min(604, Number(n) || 1));
const EMPTY_SET = new Set(); // stable empty set for the hidden-annotations state
const REP_COUNTS = [2, 3, 5, Infinity]; // repeat-count choices (verse & range)

// The four highlight colours offered in the verse popover (must match the
// server's Annotation color enum). `cls` is the swatch's fill in the picker.
const ANNOTATION_COLORS = [
  { key: 'yellow', cls: 'bg-yellow-300', labelKey: 'library.annotations.colorYellow' },
  { key: 'green',  cls: 'bg-emerald-300', labelKey: 'library.annotations.colorGreen' },
  { key: 'blue',   cls: 'bg-blue-300', labelKey: 'library.annotations.colorBlue' },
  { key: 'pink',   cls: 'bg-pink-300', labelKey: 'library.annotations.colorPink' },
];

// Ink colours offered in the drawing toolbar — the highlight enum plus a dark-ink
// pen (must match the server's stroke-colour set).
const DRAW_COLORS = [
  { key: 'ink',    cls: 'bg-gray-800 dark:bg-gray-200', labelKey: 'library.annotations.colorInk' },
  { key: 'yellow', cls: 'bg-yellow-300', labelKey: 'library.annotations.colorYellow' },
  { key: 'green',  cls: 'bg-emerald-300', labelKey: 'library.annotations.colorGreen' },
  { key: 'blue',   cls: 'bg-blue-400', labelKey: 'library.annotations.colorBlue' },
  { key: 'pink',   cls: 'bg-pink-400', labelKey: 'library.annotations.colorPink' },
];

// The ayah's plain Uthmani text (basmala excluded), used for the legible
// tafsir-panel preview. Taken verse-level from the API — word-level text is no
// longer fetched (it corrupts boundary page numbers; see mushafApi fetch note).
const verseText = (verse) => verse.textUthmani ?? '';

// A page's reading order for the self-test watermark: every real glyph in
// `pd.lines` (top line to bottom, right→left within a line — i.e. `pd.lines`
// order, then each line's `words` array order, both already print order),
// flattened to a 0-based index. `indexOf` maps a word (by verseKey:position,
// unique within a page since a word physically lives on exactly one page) to
// its index; `verseRanges` gives each verse's [first, last] index ON THIS PAGE
// (a verse straddling a page break only counts the words that sit here).
function buildPageOrder(pd) {
  const indexOf = new Map();
  const verseRanges = new Map();
  let idx = 0;
  pd.lines.forEach((line) => {
    if (line.type !== 'ayah') return;
    line.words.forEach((w) => {
      indexOf.set(`${w.verseKey}:${w.position}`, idx);
      const range = verseRanges.get(w.verseKey);
      if (!range) verseRanges.set(w.verseKey, { first: idx, last: idx });
      else range.last = idx;
      idx++;
    });
  });
  return { indexOf, verseRanges, total: idx };
}

// Direction-aware page-turn: when `flipKey` changes, the outgoing content (a
// snapshot of the previous children) slides + fades out in the travel direction
// while the incoming children slide in from the opposite side. The card/frame
// never move — only this content box does — and it clips its own overflow.
// First mount and reduced-motion (`animate=false`) swap instantly; the CSS also
// no-ops the keyframes under prefers-reduced-motion as a belt-and-braces guard.
function Flip({ flipKey, dir, animate, children }) {
  const prevKeyRef = useRef(flipKey);
  const prevNodeRef = useRef(children);
  const [exiting, setExiting] = useState(null);   // { id, node, dir } | null
  const [enterDir, setEnterDir] = useState(null); // 'fwd' | 'back' | null
  const timerRef = useRef();

  // Detect the turn synchronously (before paint) so the outgoing snapshot and
  // the entering copy appear in the same frame — no flash between them.
  useLayoutEffect(() => {
    if (flipKey === prevKeyRef.current) return;
    const fromNode = prevNodeRef.current;
    prevKeyRef.current = flipKey;
    if (!animate) { setExiting(null); setEnterDir(null); return; }
    setExiting({ id: `${flipKey}-${Date.now()}`, node: fromNode, dir });
    setEnterDir(dir);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setExiting(null); setEnterDir(null); }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipKey]);

  useEffect(() => { prevNodeRef.current = children; });
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const enterCls = enterDir === 'fwd' ? 'mushaf-enter-fwd' : enterDir === 'back' ? 'mushaf-enter-back' : '';
  const exitCls = exiting?.dir === 'fwd' ? 'mushaf-exit-fwd' : exiting?.dir === 'back' ? 'mushaf-exit-back' : '';

  return (
    <div className="mushaf-flip">
      {exiting && (
        <div className={`mushaf-flip-layer mushaf-flip-exit ${exitCls}`} aria-hidden="true">
          {exiting.node}
        </div>
      )}
      <div className={`mushaf-flip-layer ${enterCls}`}>{children}</div>
    </div>
  );
}

export default function Library() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const isArabic = i18n.language === 'ar';
  const fmtNum = (n) => (isArabic ? toArabicDigits(n) : String(n));

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = clampPage(searchParams.get('page') ?? 1);
  const [pageInput, setPageInput] = useState(String(currentPage));

  // Whether the URL already named a page when Library first mounted — captured
  // once so an explicit ?page (dashboard links, bookmarks, deep links) always
  // wins, and so this doesn't re-fire on later in-app navigation (goToPage
  // always writes an explicit page, so there's never a "default" to resolve
  // again). Gates the page-content fetch below until the default (if any) is
  // resolved, so we never briefly load page 1 before jumping to the real target.
  const hadExplicitPageRef = useRef(searchParams.has('page'));
  const [pageResolved, setPageResolved] = useState(hadExplicitPageRef.current);

  // Self-test style: 'off' | 'hide' (blur everything, hover peeks a window) |
  // 'cover' (text shown, hover blurs a window under the cursor). Always
  // available in the reader — there is no separate "memorize mode" anymore.
  const [selfTest, setSelfTest] = useState('off');
  // Reading-position watermark per visible page number: a word is revealed iff
  // its page-order index (top line to bottom, right→left within a line) is <=
  // that page's watermark (default -1 = nothing revealed). The revealed region
  // is always a clean prefix of the page — see revealVerse/hideVerse/revealThrough.
  const [watermarks, setWatermarks] = useState({}); // { [pageNumber]: lastRevealedIndex }
  const [checkedSteps, setCheckedSteps] = useState(() => new Set()); // ephemeral method ticks
  const [methodOpen, setMethodOpen] = useState(false); // collapsed by default
  const [howToOpen, setHowToOpen] = useState(false);

  // ── View mode: single page or two-page spread (spread needs width, so it's
  // only honoured on large screens — but works in the memorize session too).
  const [view, setView] = useState(() => (localStorage.getItem('mushafView') === 'double' ? 'double' : 'single'));
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  const twoPage = view === 'double' && isWide;

  // ── Focus mode: a distraction-free read that hides the sidebar + page header
  // and centres the mushaf.
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('mushafFocus') === '1');
  const focused = focusMode;

  // Page-turn animation: the last travel direction ('fwd' | 'back') drives which
  // way the content slides; disabled entirely when the OS asks for reduced motion.
  const turnDirRef = useRef('fwd');
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const [pagesData, setPagesData] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Bump-only: re-renders once a previous page is warmed so a top-of-page
  // juz/hizb/quarter ornament can be drawn (see the cache-warming effect).
  const [, bumpMarginContext] = useState(0);
  const [memorizedPages, setMemorizedPages] = useState(new Set());
  // pageNumber -> fraction (0,1) for pages with partial (sub-page) coverage —
  // memorizedPages already includes these pages too (any progress counts).
  const [partialPages, setPartialPages] = useState(new Map());
  const [savingMemorized, setSavingMemorized] = useState(false);

  // ── Mark verses (sub-page memorization) ──────────────────
  // Tap the first verse, then the last verse, to add that exact range via
  // PUT /api/progress/units (unit: 'verses') instead of marking a whole page.
  const [markVersesMode, setMarkVersesMode] = useState(false);
  const [markRangeStart, setMarkRangeStart] = useState(null);
  const [markingVerses, setMarkingVerses] = useState(false);

  // ── Bookmarks (account-saved, multiple per user) ────────
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [savingBookmark, setSavingBookmark] = useState(false);

  // ── Annotations (highlights / notes / hard flags, verse-anchored) ──
  // annotationsByPage: pageNumber -> Annotation[] for the visible page(s),
  // refetched on every mutation. hardList: the user's hard items (enriched with
  // surah labels) for the sidebar. notePanel drives the note editor sheet.
  const [annotationsByPage, setAnnotationsByPage] = useState(new Map());
  const [hardList, setHardList] = useState([]);
  const [hardOpen, setHardOpen] = useState(false);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [notePanel, setNotePanel] = useState(null); // { pageNumber, verseKey, id? } | null
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  // A free-form text note opened for READING (its icon was tapped outside draw
  // mode). Read-only sheet; editing happens in draw mode. { text, color } | null
  const [readTextNote, setReadTextNote] = useState(null);

  // ── Free-form drawing (annotate mode) ──────────────────────────────
  // drawPage = the page currently in annotate mode (null = off). Only one page
  // is annotated at a time; drawStrokes is that page's working strokes, seeded
  // from its saved doc and auto-saved (debounced) via PUT /annotations/drawing.
  const [drawPage, setDrawPage] = useState(null);
  const [drawStrokes, setDrawStrokes] = useState([]);
  const [drawTool, setDrawTool] = useState('pen'); // 'pen' | 'highlighter' | 'eraser' | 'text'
  const [drawColor, setDrawColor] = useState('ink');
  const [clearConfirm, setClearConfirm] = useState(false);
  const drawDirtyRef = useRef(false);
  const drawSaveTimerRef = useRef(null);
  const drawLatestRef = useRef({ page: null, strokes: [] });
  const drawStrokesRef = useRef([]);          // synchronous mirror for undo/redo
  const undoStackRef = useRef([]);            // past stroke-array snapshots (cap 50)
  const redoStackRef = useRef([]);
  const [, bumpHistory] = useReducer((n) => n + 1, 0); // re-render undo/redo enabled state
  // Lets the keyboard handler (declared before these callbacks) reach the latest
  // exit/undo/redo without pulling later-declared callbacks into its deps.
  const exitDrawRef = useRef(null);
  const undoRef = useRef(null);
  const redoRef = useRef(null);
  const drawWidth = drawTool === 'highlighter' ? 22 : 3;
  // Draw toolbar = a dropdown anchored under the active page's pencil button.
  const drawAnchorRef = useRef(null);          // the active pencil button
  const drawMenuRef = useRef(null);            // the dropdown panel
  const [drawMenuPos, setDrawMenuPos] = useState({ top: 0, left: 0 });

  // ── Annotation visibility (clean-reading toggle) ───────────────────
  const [annoVisible, setAnnoVisible] = useState(() => localStorage.getItem('mushafAnnoVisible') !== '0');
  useEffect(() => { localStorage.setItem('mushafAnnoVisible', annoVisible ? '1' : '0'); }, [annoVisible]);

  // ── Annotation navigation ──────────────────────────────────────────
  const [annoSummary, setAnnoSummary] = useState([]); // [{ pageNumber, counts, noteExcerpt }]
  const [annoNavOpen, setAnnoNavOpen] = useState(false);
  const [pulsePage, setPulsePage] = useState(null);    // page to pulse after nav arrival

  // The "tap a verse" cue retires once the reader has selected a verse (self-test
  // keeps its own cue). The drag flag suppresses the popover's tooltip mid-drag.
  const [seenVerseTap, setSeenVerseTap] = useState(() => localStorage.getItem('seenVerseTapCue') === '1');
  const [handleDragging, setHandleDragging] = useState(false);

  // ── Audio state ─────────────────────────────────────────
  const [reciter, setReciter] = useState(() => {
    const saved = localStorage.getItem('reciter');
    return RECITERS.some(r => r.id === saved) ? saved : DEFAULT_RECITER;
  });
  const [playingIndex, setPlayingIndex] = useState(null); // index into the combined `verses`
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // ── Playback speed (persisted) ──────────────────────────
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const [playbackRate, setPlaybackRate] = useState(() => {
    const v = parseFloat(localStorage.getItem('playbackRate'));
    return SPEEDS.includes(v) ? v : 1;
  });

  // ── Repetition for memorization ─────────────────────────
  // 'off' → continuous whole-Quran auto-advance. 'verse' → repeat the current
  // verse N times then advance. 'range' → loop [rangeStart..rangeEnd] M times.
  const [repeatMode, setRepeatMode] = useState('off');
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [verseRepeat, setVerseRepeat] = useState(3);      // 2 | 3 | 5 | Infinity
  const [rangeStart, setRangeStart] = useState(0);        // index into `verses`
  const [rangeEnd, setRangeEnd] = useState(0);
  const [rangeRepeat, setRangeRepeat] = useState(3);
  const repeatsDoneRef = useRef(0);   // times the current verse has finished (verse mode)
  const rangePassesRef = useRef(0);   // completed passes over the range (range mode)
  // A page turn driven by continuous playback: 'first' | 'last' | null. Resumed by
  // the effect below once the new page's verses have loaded.
  const pendingPlayRef = useRef(null);

  // ── Verse selection + tafsir state (verses addressed by stable verseKey) ──
  const [selectedVerseKey, setSelectedVerseKey] = useState(null);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsirIndex, setTafsirIndex] = useState(null);
  const [tafsirEdition, setTafsirEdition] = useState(() => {
    const saved = localStorage.getItem('tafsirEdition');
    return TAFSIR_EDITIONS.some(e => e.id === saved) ? saved : TAFSIR_EDITIONS[0].id;
  });
  const [tafsirText, setTafsirText] = useState('');
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState(false);
  const [tafsirReloadKey, setTafsirReloadKey] = useState(0);

  // Verse action popover — placed near the selection each time, then draggable via
  // the grip (current instance only, so no persisted position).
  const { ref: popoverRef, style: popoverDragStyle, setPos: setPopoverPos, dragHandlers: popoverDragHandlers } = useDraggable(null);
  useEffect(() => { localStorage.removeItem('versePopoverPos'); }, []); // drop the old persisted spot
  const lastPointerRef = useRef(null);   // last pointer-down in the reader (for placement)
  const placeNextRef = useRef(false);    // re-place the popover only after a word click

  // ── Contextual onboarding (driver.js) ────────────────────
  const tourRef = useRef(null);
  const tourActiveRef = useRef(false);
  const libTourCheckedRef = useRef(false);

  // The pages currently on screen (the spread is anchored to the right/odd page).
  const visiblePages = useMemo(() => {
    if (!twoPage) return [currentPage];
    const right = currentPage % 2 === 1 ? currentPage : currentPage - 1;
    const left = right + 1;
    return left <= 604 ? [right, left] : [right];
  }, [twoPage, currentPage]);

  // All verses on screen, in reading order, each tagged with the page it sits on.
  // A verse straddling a page break is returned for both pages — keep the first
  // so the audio/tafsir list has no duplicate verseKeys across the spread.
  const verses = useMemo(() => {
    const seen = new Set();
    const out = [];
    pagesData.forEach((pd) =>
      pd.verses.forEach((v) => {
        if (seen.has(v.verseKey)) return;
        seen.add(v.verseKey);
        out.push({ ...v, page: pd.page });
      })
    );
    return out;
  }, [pagesData]);

  // Each visible page's reading-order index (for the hide-mode watermark).
  const pageOrders = useMemo(() => {
    const map = new Map();
    pagesData.forEach((pd) => map.set(pd.page, buildPageOrder(pd)));
    return map;
  }, [pagesData]);

  // The page the reader most recently interacted with in a two-page spread —
  // clicking a word, a footer tick, or anywhere on a page card sets it (see
  // renderPageCard). Defaults to the right (first, anchor) page of the spread;
  // single view always targets currentPage directly, so this is unused there.
  const [activePage, setActivePage] = useState(visiblePages[0]);
  useEffect(() => { setActivePage(visiblePages[0]); }, [visiblePages]);
  // Bookmarks target this page: the active page of a spread, or simply the
  // current page in single view (unchanged there).
  const bookmarkTargetPage = twoPage ? activePage : currentPage;

  useEffect(() => { localStorage.setItem('mushafView', view); }, [view]);
  useEffect(() => { localStorage.setItem('mushafFocus', focusMode ? '1' : '0'); }, [focusMode]);

  // Track the lg breakpoint so the spread only ever renders where it fits.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mount: memorized pages (for the badge + stat), and — when the URL didn't
  // name a page — resolve the default landing page from this same fetch (no
  // extra request): the first page not yet memorized, i.e. where a new-
  // memorization session would pick up. Falls back to the last page the
  // reader had open (persisted below), then page 1, if everything is
  // memorized or this fetch fails. Resolved with `replace` so a refresh keeps
  // landing on the resolved page rather than re-resolving (or worse, snapping
  // back to page 1) every time.
  useEffect(() => {
    const fallbackPage = () => {
      const last = Number(localStorage.getItem('lastMushafPage'));
      return last >= 1 && last <= 604 ? last : 1;
    };
    const landOn = (target) => {
      setSearchParams({ page: String(target) }, { replace: true });
      setPageResolved(true);
    };
    progressAPI.getAllProgress().then(res => {
      const pages = res.data?.data?.memorizedPages ?? [];
      const memorized = new Set(pages);
      setMemorizedPages(memorized);
      const partial = res.data?.data?.partialPages ?? [];
      setPartialPages(new Map(partial.map(p => [p.pageNumber, p.fraction])));
      if (hadExplicitPageRef.current) return;
      let nextNew = null;
      for (let p = 1; p <= 604; p++) { if (!memorized.has(p)) { nextNew = p; break; } }
      landOn(nextNew ?? fallbackPage());
    }).catch(() => {
      if (!hadExplicitPageRef.current) landOn(fallbackPage());
    });
    // Mount-only: resolves once against the URL/localStorage as they stood at
    // that moment; every later navigation writes an explicit page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember the last page opened, as a fallback default landing page.
  useEffect(() => { localStorage.setItem('lastMushafPage', String(currentPage)); }, [currentPage]);

  // Mount: the user's saved bookmarks.
  useEffect(() => {
    bookmarksAPI.list().then(res => setBookmarks(res.data?.data ?? [])).catch(() => {});
  }, []);

  // While the popover grip is held, suppress its "drag to move" tooltip.
  useEffect(() => {
    if (!handleDragging) return;
    const stop = () => setHandleDragging(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [handleDragging]);

  // Page / view change: load each visible page's word data + its glyph font.
  // Held until the default-page resolution above (if any) completes, so we
  // never briefly fetch page 1 before jumping to the resolved target.
  useEffect(() => {
    if (!pageResolved) return;
    let cancelled = false;
    setPageInput(String(currentPage));
    setPageLoading(true);
    setPageError(false);
    Promise.all(
      visiblePages.map(async (p) => {
        const [data] = await Promise.all([fetchMushafPage(p), ensurePageFont(p)]);
        return data;
      })
    )
      .then((datas) => { if (!cancelled) setPagesData(datas); })
      .catch(() => { if (!cancelled) setPageError(true); })
      .finally(() => { if (!cancelled) setPageLoading(false); });
    return () => { cancelled = true; };
  }, [visiblePages, currentPage, reloadKey, pageResolved]);

  // Warm the cache for the page just before the first visible one so a
  // juz/hizb/quarter boundary that lands on that page's very first verse can be
  // drawn — detecting it needs the previous page's last rub-el-hizb. Matters on
  // cold jumps (Jump-to-Juz lands directly on a juz-start page's first line);
  // during sequential reading the previous page is already cached. The bump
  // re-renders so renderPageCard recomputes `prevLastRub` from the warm cache.
  useEffect(() => {
    if (!pageResolved) return;
    const first = visiblePages[0];
    if (!first || first <= 1 || peekMushafPage(first - 1)) return;
    let cancelled = false;
    fetchMushafPage(first - 1)
      .then(() => { if (!cancelled) bumpMarginContext((k) => k + 1); })
      .catch(() => { /* the top-of-page boundary just won't show — harmless */ });
    return () => { cancelled = true; };
  }, [visiblePages, pageResolved]);

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute('src'); }
    setPlayingIndex(null);
    setIsPlaying(false);
    setAudioBuffering(false);
  }, []);

  // Page / view change: clear selection + close tafsir (verse indices shift when
  // the on-screen verse set changes). Audio normally stops too — but NOT when the
  // turn was driven by continuous playback (pendingPlayRef), which resumes on the
  // new page.
  useEffect(() => {
    if (!pendingPlayRef.current) stopAudio();
    setSelectedVerseKey(null);
    setTafsirOpen(false);
    setTafsirIndex(null);
  }, [currentPage, view, stopAudio]);

  // Page change: start a fresh self-test (everything concealed again)
  useEffect(() => {
    setWatermarks({});
  }, [currentPage]);

  // First-visit reader tour (self-test and the per-page mark tick are folded
  // in alongside the original nav/audio/verse steps — there's no separate
  // "memorize mode" tour anymore), gated by `seenLibraryTour`. `?tour=1`
  // (Settings → Replay) forces it and is then stripped from the URL. Mount-only.
  useEffect(() => {
    if (libTourCheckedRef.current) return;
    const forceTour = searchParams.get('tour') === '1';
    if (!forceTour && localStorage.getItem('seenLibraryTour')) {
      libTourCheckedRef.current = true;
      return;
    }
    const id = setTimeout(() => {
      libTourCheckedRef.current = true;
      // The tour walks the sidebar, so never run it behind focus mode.
      setFocusMode(false);
      if (forceTour) {
        const next = new URLSearchParams(searchParams);
        next.delete('tour');
        setSearchParams(next, { replace: true });
      }
      const tour = startLibraryTour({
        t,
        onDone: () => {
          localStorage.setItem('seenLibraryTour', '1');
          tourActiveRef.current = false;
          tourRef.current = null;
        },
      });
      if (tour) { tourRef.current = tour; tourActiveRef.current = true; }
      else localStorage.setItem('seenLibraryTour', '1');
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear down a running tour only on real unmount (navigating away mid-tour).
  useEffect(() => () => {
    tourRef.current?.destroy?.();
    tourRef.current = null;
    tourActiveRef.current = false;
  }, []);

  // One-time coachmark the first time a verse is selected — highlights the
  // Play + Tafsir buttons in the popover.
  useEffect(() => {
    if (selectedVerseKey == null || tourActiveRef.current) return;
    if (localStorage.getItem('seenVerseActionsHint')) return;
    const id = setTimeout(() => {
      if (tourActiveRef.current || localStorage.getItem('seenVerseActionsHint')) return;
      if (!document.querySelector('[data-tour="verse-actions"]')) return;
      localStorage.setItem('seenVerseActionsHint', '1');
      tourActiveRef.current = true;
      startVerseActionsCoachmark({ t, onDone: () => { tourActiveRef.current = false; } });
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseKey]);

  // Drive the single <audio> element: load + play current ayah (at the chosen speed).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || playingIndex == null || !verses[playingIndex]) return;
    setAudioError(false);
    el.src = getAyahAudioUrl(reciter, verses[playingIndex].id);
    el.playbackRate = playbackRate;
    if (isPlaying) {
      el.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex, reciter, verses]);

  // Apply a speed change to the live element immediately and persist it.
  useEffect(() => {
    const el = audioRef.current;
    if (el) el.playbackRate = playbackRate;
    localStorage.setItem('playbackRate', String(playbackRate));
  }, [playbackRate]);

  useEffect(() => {
    localStorage.setItem('reciter', reciter);
  }, [reciter]);

  // Reset repeat counters when the mode / range changes.
  useEffect(() => { repeatsDoneRef.current = 0; rangePassesRef.current = 0; }, [repeatMode]);
  useEffect(() => { rangePassesRef.current = 0; }, [rangeStart, rangeEnd, rangeRepeat]);
  // Default the range pickers to the visible page's verse span (until in range mode).
  useEffect(() => {
    if (repeatMode === 'range') return;
    setRangeStart(0);
    setRangeEnd(Math.max(0, verses.length - 1));
  }, [verses.length, repeatMode]);

  const pageStep = twoPage ? 2 : 1;
  const maxPage = twoPage ? 603 : 604;

  const playAyah = (index) => {
    if (index < 0 || index >= verses.length) return;
    setAudioError(false);
    if (index === playingIndex) {
      const el = audioRef.current;
      if (el && !isPlaying) { el.play().catch(() => {}); setIsPlaying(true); }
      return;
    }
    repeatsDoneRef.current = 0;
    setPlayingIndex(index);
    setIsPlaying(true);
  };

  // Replay the current verse from its start without reloading (verse-repeat).
  const replayCurrent = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
    setIsPlaying(true);
  };

  // Move one verse in `dir`, crossing to the adjacent page at the boundary so
  // playback (and the bar's prev/next) flow continuously across the whole Quran.
  const advance = (dir) => {
    const nextIdx = (playingIndex ?? 0) + dir;
    if (nextIdx >= 0 && nextIdx < verses.length) {
      repeatsDoneRef.current = 0;
      setPlayingIndex(nextIdx);
      setIsPlaying(true);
      return;
    }
    repeatsDoneRef.current = 0;
    if (dir > 0) {
      if (currentPage + pageStep <= 604) { pendingPlayRef.current = 'first'; goToPage(currentPage + pageStep); }
      else stopAudio();
    } else {
      if (currentPage > 1) { pendingPlayRef.current = 'last'; goToPage(currentPage - pageStep); }
      else stopAudio();
    }
  };
  // Bar prev/next: start playback if idle, else step (crossing pages at the ends).
  const stepVerse = (dir) => {
    if (playingIndex == null) { playAyah(dir > 0 ? 0 : verses.length - 1); return; }
    advance(dir);
  };

  const togglePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playingIndex == null) { playAyah(repeatMode === 'range' ? rangeStart : 0); return; }
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else { el.play().catch(() => {}); setIsPlaying(true); }
  };

  // Popover / tafsir play button: play from that verse, or pause if it's already the one playing.
  const toggleSelectedVerse = (index) => {
    const el = audioRef.current;
    if (index === playingIndex && isPlaying && el) { el.pause(); setIsPlaying(false); }
    else playAyah(index);
  };

  const handleEnded = () => {
    if (playingIndex == null) return;
    if (repeatMode === 'verse') {
      repeatsDoneRef.current += 1;
      if (verseRepeat === Infinity || repeatsDoneRef.current < verseRepeat) { replayCurrent(); return; }
      repeatsDoneRef.current = 0;
      advance(1);
      return;
    }
    if (repeatMode === 'range') {
      if (playingIndex < rangeEnd) { setPlayingIndex(playingIndex + 1); setIsPlaying(true); return; }
      rangePassesRef.current += 1; // finished one pass over the range
      if (rangeRepeat === Infinity || rangePassesRef.current < rangeRepeat) {
        if (rangeStart === playingIndex) replayCurrent();   // single-verse range
        else { setPlayingIndex(rangeStart); setIsPlaying(true); }
        return;
      }
      rangePassesRef.current = 0;
      stopAudio();
      return;
    }
    advance(1); // 'off' → continuous auto-advance across pages
  };

  // Resume playback on the freshly-turned page once its verses have loaded.
  useEffect(() => {
    if (!pendingPlayRef.current || verses.length === 0) return;
    const where = pendingPlayRef.current;
    pendingPlayRef.current = null;
    setAudioError(false);
    repeatsDoneRef.current = 0;
    setPlayingIndex(where === 'first' ? 0 : verses.length - 1);
    setIsPlaying(true);
  }, [verses]);

  // Preload the next page's data + font while the last verse plays, so the
  // continuous turn at the boundary doesn't stutter.
  useEffect(() => {
    if (playingIndex == null || repeatMode === 'range') return;
    if (playingIndex >= verses.length - 1 && currentPage + pageStep <= 604) {
      fetchMushafPage(currentPage + pageStep).catch(() => {});
      ensurePageFont(currentPage + pageStep).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex]);

  const goToPage = useCallback((n) => {
    let page = clampPage(n);
    // In the spread, anchor navigation to the right (odd) page of the pair.
    if (twoPage && page % 2 === 0) page = Math.max(1, page - 1);
    if (page === currentPage) return;
    turnDirRef.current = page > currentPage ? 'fwd' : 'back'; // for the turn animation
    setSearchParams({ page: String(page) }, { replace: true });
  }, [twoPage, currentPage, setSearchParams]);

  // Directional turns for a right-to-left book: "next" always moves forward
  // (higher page number), "prev" back — independent of UI language. The pager,
  // keyboard, edge-clicks and swipe all route through these two.
  const goNext = useCallback(() => goToPage(currentPage + pageStep), [goToPage, currentPage, pageStep]);
  const goPrev = useCallback(() => goToPage(currentPage - pageStep), [goToPage, currentPage, pageStep]);

  // ── Keyboard page-turning + shortcuts ────────────────────
  // RTL book: ArrowLeft/PageDown go forward, ArrowRight/PageUp go back — in both
  // UI languages. Escape peels back the top-most overlay; 'f' toggles focus mode.
  // Ignored while typing in a field or while a driver.js tour owns the screen.
  useEffect(() => {
    const onKey = (e) => {
      if (tourActiveRef.current) return;
      const el = e.target;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      // While annotating, page turns are suspended; Escape leaves draw mode and
      // Ctrl+Z / Ctrl+Alt+Z (or Ctrl+Shift+Z / Ctrl+Y) undo/redo. Keys are gated
      // by the input-focus check above, so typing a text note isn't intercepted.
      if (drawPage != null) {
        if (e.key === 'Escape') { e.preventDefault(); exitDrawRef.current?.(); return; }
        const mod = e.ctrlKey || e.metaKey;
        const z = e.key === 'z' || e.key === 'Z';
        const y = e.key === 'y' || e.key === 'Y';
        if (mod && z && !e.altKey && !e.shiftKey) { e.preventDefault(); undoRef.current?.(); }
        else if (mod && ((z && (e.altKey || e.shiftKey)) || y)) { e.preventDefault(); redoRef.current?.(); }
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageDown':
          e.preventDefault(); goNext(); break;
        case 'ArrowRight':
        case 'PageUp':
          e.preventDefault(); goPrev(); break;
        case 'Escape':
          if (tafsirOpen) setTafsirOpen(false);
          else if (readTextNote) setReadTextNote(null);
          else if (notePanel) setNotePanel(null);
          else if (selectedVerseKey != null) setSelectedVerseKey(null);
          else if (focused) setFocusMode(false);
          break;
        case 'f':
        case 'F':
          e.preventDefault(); setFocusMode((v) => !v);
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, tafsirOpen, notePanel, readTextNote, selectedVerseKey, focused, drawPage]);

  // ── Touch swipe to turn the page (physical RTL book) ─────
  // Swipe right → next, swipe left → prev, but only when the horizontal move
  // clearly dominates (so vertical scrolling is never hijacked) and no tour runs.
  // Suspended while annotating (the drawing layer owns touch there).
  const touchStartRef = useRef(null);
  const onTouchStart = (e) => {
    if (tourActiveRef.current || drawPage != null) { touchStartRef.current = null; return; }
    const p = e.touches[0];
    touchStartRef.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || tourActiveRef.current || drawPage != null) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0) goNext(); else goPrev();
  };

  const setViewMode = (mode) => {
    setView(mode);
    // Snap onto the right (odd) page so the new spread pairs correctly.
    if (mode === 'double' && isWide && currentPage % 2 === 0) {
      setSearchParams({ page: String(Math.max(1, currentPage - 1)) }, { replace: true });
    }
  };

  // The active conceal style for the page ('hide' | 'cover' | null when off).
  const concealMode = selfTest !== 'off' ? selfTest : null;

  // 1st click of the hide-mode cycle: reveal the WHOLE verse — the watermark
  // advances to its last word on EVERY visible page it has words on, so a verse
  // straddling the spread reveals its portion on each half.
  const revealVerse = useCallback((verseKey) => {
    setWatermarks((prev) => {
      let changed = false;
      const next = { ...prev };
      pageOrders.forEach((order, page) => {
        const range = order.verseRanges.get(verseKey);
        if (!range) return;
        if (range.last > (next[page] ?? -1)) { next[page] = range.last; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [pageOrders]);

  // 3rd click of the cycle: hide this verse and everything after it by winding
  // the watermark back to just before its first word (on each page it's on).
  const hideVerse = useCallback((verseKey) => {
    setWatermarks((prev) => {
      let changed = false;
      const next = { ...prev };
      pageOrders.forEach((order, page) => {
        const range = order.verseRanges.get(verseKey);
        if (!range) return;
        const val = range.first - 1;
        if ((next[page] ?? -1) !== val) { next[page] = val; changed = true; }
      });
      return changed ? next : prev;
    });
    setSelectedVerseKey(prev => (prev === verseKey ? null : prev));
  }, [pageOrders]);

  // Drag-reveal: advance the watermark to the furthest word made visible during
  // the drag. MushafPage calls this with the peek window's forward edge on
  // every word entered, so the last call before release already covers
  // "the peek window at the moment of release" — nothing shown mid-drag re-hides.
  const revealThrough = useCallback((verseKey, position) => {
    const key = `${verseKey}:${position}`;
    setWatermarks((prev) => {
      for (const [page, order] of pageOrders) {
        const idx = order.indexOf.get(key);
        if (idx == null) continue;
        return idx > (prev[page] ?? -1) ? { ...prev, [page]: idx } : prev;
      }
      return prev;
    });
  }, [pageOrders]);

  const selectVerse = useCallback((verseKey) => {
    setSelectedVerseKey(prev => (prev === verseKey ? null : verseKey));
    setSeenVerseTap(true);
    localStorage.setItem('seenVerseTapCue', '1'); // the "tap a verse" cue has served its purpose
  }, []);

  // Re-reads memorized/partial pages after a units mutation — cheaper to just
  // refetch than to reconcile every affected page's fraction locally.
  const refreshMemorizedPages = useCallback(() => {
    progressAPI.getAllProgress().then(res => {
      setMemorizedPages(new Set(res.data?.data?.memorizedPages ?? []));
      const partial = res.data?.data?.partialPages ?? [];
      setPartialPages(new Map(partial.map(p => [p.pageNumber, p.fraction])));
    }).catch(() => {});
  }, []);

  const cancelMarkVerses = useCallback(() => {
    setMarkVersesMode(false);
    setMarkRangeStart(null);
  }, []);
  // Abort an in-progress "mark verses" selection if the reader turns the page.
  useEffect(() => { cancelMarkVerses(); }, [currentPage, cancelMarkVerses]);

  // First tap sets the range start; the second tap (any later verse, in either
  // reading order) submits [start, end] to the units endpoint. compileUnitRange
  // on the server normalizes the order, so which one is tapped first doesn't matter.
  const handleMarkVersesTap = useCallback(async (verseKey) => {
    if (!markRangeStart) {
      setMarkRangeStart(verseKey);
      return;
    }
    if (verseKey === markRangeStart) { setMarkRangeStart(null); return; } // tapped the same word again — restart
    setMarkingVerses(true);
    try {
      await progressAPI.updateUnits({ action: 'add', unit: 'verses', ref: { from: markRangeStart, to: verseKey } });
      showToast(t('library.markVerses.added'), 'success');
      refreshMemorizedPages();
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setMarkingVerses(false);
      setMarkRangeStart(null);
      setMarkVersesMode(false);
    }
  }, [markRangeStart, showToast, t, refreshMemorizedPages]);

  // Routes word taps to the mark-verses flow while it's active, otherwise the
  // normal verse-selection behaviour.
  const handleWordSelect = useCallback((verseKey) => {
    if (markVersesMode) { handleMarkVersesTap(verseKey); return; }
    placeNextRef.current = true; // a fresh word click re-anchors the popover
    selectVerse(verseKey);
  }, [markVersesMode, handleMarkVersesTap, selectVerse]);

  // Entering "mark verses" clears any selected verse so its popover (with the
  // annotation actions) can't fire while the two-word picking mode owns taps.
  const startMarkVerses = useCallback(() => {
    setSelectedVerseKey(null);
    setMarkVersesMode(true);
  }, []);

  // ── Annotations: highlights / notes / hard flags (verse-anchored) ──
  // Load all annotations for the given pages, replacing each page's cached list.
  const loadAnnotationsForPages = useCallback((pages) => {
    Promise.all(
      pages.map((p) =>
        annotationsAPI.listForPage(p)
          .then((r) => [p, r.data?.data ?? []])
          .catch(() => [p, []])
      )
    ).then((entries) => {
      setAnnotationsByPage((prev) => {
        const next = new Map(prev);
        entries.forEach(([p, list]) => next.set(p, list));
        return next;
      });
    });
  }, []);

  const loadHardList = useCallback(() => {
    annotationsAPI.listByKind('hard')
      .then((r) => setHardList(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // The per-page annotation summary powers the navigator; refetched after any
  // mutation so its counts/jump targets stay current.
  const loadSummary = useCallback(() => {
    annotationsAPI.getSummary()
      .then((r) => setAnnoSummary(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // Load the visible page(s)' annotations alongside the mushaf pages, and the
  // hard list + summary once (both span every page, kept independently).
  useEffect(() => { if (pageResolved) loadAnnotationsForPages(visiblePages); }, [visiblePages, pageResolved, loadAnnotationsForPages]);
  useEffect(() => { loadHardList(); loadSummary(); }, [loadHardList, loadSummary]);

  const findAnn = useCallback(
    (page, predicate) => (annotationsByPage.get(page) ?? []).find(predicate),
    [annotationsByPage]
  );

  // Highlight a verse in `color`; clicking the active colour again removes it,
  // a different colour updates it (whole-verse; word spans stay a server option).
  const setVerseHighlight = useCallback(async (page, verseKey, color) => {
    if (savingAnnotation) return;
    const existing = findAnn(page, (a) => a.kind === 'highlight' && a.verseKey === verseKey);
    setSavingAnnotation(true);
    try {
      if (existing && existing.color === color) {
        await annotationsAPI.remove(existing._id);
        showToast(t('library.annotations.highlightRemoved'), 'success');
      } else if (existing) {
        await annotationsAPI.update(existing._id, { color });
        showToast(t('library.annotations.highlightAdded'), 'success');
      } else {
        await annotationsAPI.create({ pageNumber: page, verseKey, kind: 'highlight', color });
        showToast(t('library.annotations.highlightAdded'), 'success');
      }
      loadAnnotationsForPages([page]);
      loadSummary();
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setSavingAnnotation(false);
    }
  }, [savingAnnotation, findAnn, showToast, t, loadAnnotationsForPages, loadSummary]);

  // Toggle a verse-level or (verseKey null) whole-page hard flag.
  const toggleHard = useCallback(async (page, verseKey) => {
    if (savingAnnotation) return;
    const existing = findAnn(page, (a) => a.kind === 'hard' && (a.verseKey ?? null) === (verseKey ?? null));
    setSavingAnnotation(true);
    try {
      if (existing) {
        await annotationsAPI.remove(existing._id);
        showToast(t('library.annotations.hardRemoved'), 'success');
      } else {
        await annotationsAPI.create({ pageNumber: page, verseKey: verseKey ?? null, kind: 'hard' });
        showToast(t('library.annotations.hardAdded'), 'success');
      }
      loadAnnotationsForPages([page]);
      loadHardList();
      loadSummary();
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setSavingAnnotation(false);
    }
  }, [savingAnnotation, findAnn, showToast, t, loadAnnotationsForPages, loadHardList, loadSummary]);

  // Open the note editor for a verse (prefilled if a note already exists). Closes
  // the tafsir sheet so the two side panels never stack.
  const openNote = useCallback((page, verseKey) => {
    const existing = findAnn(page, (a) => a.kind === 'note' && a.verseKey === verseKey);
    setTafsirOpen(false);
    setNotePanel({ pageNumber: page, verseKey, id: existing?._id ?? null });
    setNoteDraft(existing?.text ?? '');
  }, [findAnn]);

  const saveNote = useCallback(async () => {
    if (!notePanel || savingNote) return;
    const text = noteDraft.trim();
    const { pageNumber, verseKey, id } = notePanel;
    setSavingNote(true);
    try {
      if (!text) {
        if (id) { await annotationsAPI.remove(id); showToast(t('library.annotations.noteDeleted'), 'success'); }
      } else if (id) {
        await annotationsAPI.update(id, { text });
        showToast(t('library.annotations.noteSaved'), 'success');
      } else {
        await annotationsAPI.create({ pageNumber, verseKey, kind: 'note', text });
        showToast(t('library.annotations.noteSaved'), 'success');
      }
      loadAnnotationsForPages([pageNumber]);
      loadSummary();
      setNotePanel(null);
      setNoteDraft('');
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setSavingNote(false);
    }
  }, [notePanel, noteDraft, savingNote, showToast, t, loadAnnotationsForPages, loadSummary]);

  const deleteNote = useCallback(async () => {
    if (!notePanel || savingNote) return;
    if (!notePanel.id) { setNotePanel(null); setNoteDraft(''); return; }
    setSavingNote(true);
    try {
      await annotationsAPI.remove(notePanel.id);
      showToast(t('library.annotations.noteDeleted'), 'success');
      loadAnnotationsForPages([notePanel.pageNumber]);
      loadSummary();
      setNotePanel(null);
      setNoteDraft('');
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setSavingNote(false);
    }
  }, [notePanel, savingNote, showToast, t, loadAnnotationsForPages, loadSummary]);

  // Remove a hard item from the sidebar list (and refresh the page if it's on screen).
  const removeHardItem = useCallback(async (id, page) => {
    try {
      await annotationsAPI.remove(id);
      loadHardList();
      loadSummary();
      if (visiblePages.includes(page)) loadAnnotationsForPages([page]);
    } catch {
      showToast(t('common.error'), 'error');
    }
  }, [loadHardList, loadSummary, visiblePages, loadAnnotationsForPages, showToast, t]);

  // Close the note sheet when the reader turns the page.
  useEffect(() => { setNotePanel(null); }, [currentPage]);

  // ── Drawing (annotate mode) ────────────────────────────────────────
  // Keep the latest page+strokes in a ref so a flush (debounce fire, exit, page
  // change, unmount) always saves the freshest state without stale closures.
  useEffect(() => { drawLatestRef.current = { page: drawPage, strokes: drawStrokes }; }, [drawPage, drawStrokes]);

  const flushDrawing = useCallback(async () => {
    if (drawSaveTimerRef.current) { clearTimeout(drawSaveTimerRef.current); drawSaveTimerRef.current = null; }
    if (!drawDirtyRef.current) return;
    const { page, strokes } = drawLatestRef.current;
    drawDirtyRef.current = false;
    if (page == null) return;
    try {
      await annotationsAPI.saveDrawing({ pageNumber: page, strokes });
      loadSummary();
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    }
  }, [loadSummary, showToast, t]);

  const scheduleDrawSave = useCallback(() => {
    drawDirtyRef.current = true;
    if (drawSaveTimerRef.current) clearTimeout(drawSaveTimerRef.current);
    drawSaveTimerRef.current = setTimeout(() => { flushDrawing(); }, 1500); // ~1.5s after last stroke
  }, [flushDrawing]);

  // Apply a new strokes snapshot, recording history for undo/redo. Every ink
  // change (draw, erase, clear) funnels through here; `record` pushes the prior
  // snapshot onto the undo stack (capped at 50) and clears the redo stack.
  const applyStrokes = useCallback((next, record = true) => {
    if (record) {
      undoStackRef.current.push(drawStrokesRef.current);
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    }
    drawStrokesRef.current = next;
    setDrawStrokes(next);
    scheduleDrawSave();
    bumpHistory();
  }, [scheduleDrawSave]);

  const handleDrawChange = useCallback((next) => applyStrokes(next, true), [applyStrokes]);

  const enterDraw = useCallback((page) => {
    if (drawPage != null && drawPage !== page) flushDrawing(); // flush the other page first
    setSelectedVerseKey(null);
    setAnnoVisible(true);                 // drawing always shows what you're editing
    const doc = (annotationsByPage.get(page) ?? []).find((a) => a.kind === 'drawing');
    const seed = doc?.strokes ?? [];
    drawStrokesRef.current = seed;
    setDrawStrokes(seed);
    undoStackRef.current = [];             // history is session-local, reset per page
    redoStackRef.current = [];
    drawDirtyRef.current = false;
    setDrawPage(page);
    bumpHistory();
  }, [drawPage, flushDrawing, annotationsByPage]);

  const exitDraw = useCallback(async () => {
    const page = drawPage;
    await flushDrawing();
    setDrawPage(null);
    setClearConfirm(false);
    if (page != null && visiblePages.includes(page)) loadAnnotationsForPages([page]);
  }, [drawPage, flushDrawing, visiblePages, loadAnnotationsForPages]);

  const toggleDraw = useCallback((page) => {
    if (drawPage === page) exitDraw();
    else enterDraw(page);
  }, [drawPage, exitDraw, enterDraw]);
  useEffect(() => { exitDrawRef.current = exitDraw; }, [exitDraw]);

  // Position the draw dropdown under the active pencil button — flipping above /
  // shifting horizontally when it would overflow the viewport.
  const positionDrawMenu = useCallback(() => {
    const a = drawAnchorRef.current;
    if (!a) return;
    const r = a.getBoundingClientRect();
    const m = drawMenuRef.current;
    const mw = m?.offsetWidth || 240;
    const mh = m?.offsetHeight || 150;
    const gap = 6;
    let top = r.bottom + gap;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - gap - mh); // flip above
    let left = r.left + r.width / 2 - mw / 2;                                   // centre under the button
    left = Math.min(Math.max(left, 8), window.innerWidth - mw - 8);            // shift into view
    setDrawMenuPos({ top, left });
  }, []);
  useLayoutEffect(() => {
    if (drawPage == null) return;
    positionDrawMenu();
    const reposition = () => positionDrawMenu();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
  }, [drawPage, positionDrawMenu]);

  const undoStroke = useCallback(() => {
    if (!undoStackRef.current.length) return;
    redoStackRef.current.push(drawStrokesRef.current);
    applyStrokes(undoStackRef.current.pop(), false);
  }, [applyStrokes]);
  const redoStroke = useCallback(() => {
    if (!redoStackRef.current.length) return;
    undoStackRef.current.push(drawStrokesRef.current);
    applyStrokes(redoStackRef.current.pop(), false);
  }, [applyStrokes]);
  useEffect(() => { undoRef.current = undoStroke; }, [undoStroke]);
  useEffect(() => { redoRef.current = redoStroke; }, [redoStroke]);

  const clearDrawing = useCallback(() => {
    applyStrokes([], true);
    setClearConfirm(false);
  }, [applyStrokes]);

  // ── Text notes (free-floating labels placed with the 'T' tool) ─────
  const createText = useCallback(async (page, x, y, text, color) => {
    try {
      await annotationsAPI.create({ pageNumber: page, kind: 'text', x, y, text, color });
      loadAnnotationsForPages([page]);
      loadSummary();
    } catch (e) { showToast(e.response?.data?.message || t('common.error'), 'error'); }
  }, [loadAnnotationsForPages, loadSummary, showToast, t]);
  const updateText = useCallback(async (page, id, patch) => {
    try {
      await annotationsAPI.update(id, patch);
      loadAnnotationsForPages([page]);
      loadSummary();
    } catch (e) { showToast(e.response?.data?.message || t('common.error'), 'error'); }
  }, [loadAnnotationsForPages, loadSummary, showToast, t]);
  const deleteText = useCallback(async (page, id) => {
    try {
      await annotationsAPI.remove(id);
      loadAnnotationsForPages([page]);
      loadSummary();
    } catch (e) { showToast(e.response?.data?.message || t('common.error'), 'error'); }
  }, [loadAnnotationsForPages, loadSummary, showToast, t]);

  // Flush + exit if the active drawing page scrolls out of view (bookmark / juz
  // jump / scrubber — the on-page turn controls are already suspended in draw mode).
  useEffect(() => {
    if (drawPage != null && !visiblePages.includes(drawPage)) {
      flushDrawing().finally(() => { setDrawPage(null); setClearConfirm(false); });
    }
  }, [visiblePages, drawPage, flushDrawing]);

  // Save any pending drawing if the reader leaves the Library mid-stroke.
  useEffect(() => () => {
    if (drawDirtyRef.current) {
      const { page, strokes } = drawLatestRef.current;
      if (page != null) annotationsAPI.saveDrawing({ pageNumber: page, strokes }).catch(() => {});
    }
  }, []);

  // ── Annotation navigation: prev / next annotated page (wraps) + pulse ──
  const annotatedPages = useMemo(() => annoSummary.map((s) => s.pageNumber), [annoSummary]);
  const jumpToAnnotatedPage = useCallback((page) => {
    setPulsePage(page);
    goToPage(page);
  }, [goToPage]);
  const gotoAdjacentAnnotated = useCallback((dir) => {
    if (!annotatedPages.length) return;
    const after = annotatedPages.filter((p) => (dir > 0 ? p > currentPage : p < currentPage));
    const target = dir > 0
      ? (after[0] ?? annotatedPages[0])                        // next, wrap to first
      : (after[after.length - 1] ?? annotatedPages[annotatedPages.length - 1]); // prev, wrap to last
    jumpToAnnotatedPage(target);
  }, [annotatedPages, currentPage, jumpToAnnotatedPage]);

  // Clear the arrival pulse once its animation has run.
  useEffect(() => {
    if (pulsePage == null) return;
    const id = setTimeout(() => setPulsePage(null), 2600);
    return () => clearTimeout(id);
  }, [pulsePage]);

  // "Hide all": collapse every visible page's watermark back to the start.
  const hideAllVerses = () => setWatermarks({});
  // "Reveal all": push every visible page's watermark to its last word.
  const revealAllVisible = () => {
    const next = {};
    pageOrders.forEach((order, page) => { next[page] = order.total - 1; });
    setWatermarks(next);
  };
  // Switching style starts a clean test (nothing revealed yet).
  const setSelfTestMode = (m) => { setSelfTest(m); setWatermarks({}); };
  const toggleStep = (i) => setCheckedSteps(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const handlePageInputKey = (e) => { if (e.key === 'Enter') goToPage(pageInput); };
  const handlePageInputBlur = () => {
    const n = Number(pageInput);
    if (!n || n < 1 || n > 604) setPageInput(String(currentPage));
    else goToPage(n);
  };

  // ── Mark / unmark a single page as memorized ──────────
  // The per-page check button on each page card is the only mark/unmark
  // control, so this only ever acts on one page. One optimistic update, rolled
  // back on failure. Adding uses markComplete (it also registers the
  // memorization event + streak); removing replaces the whole set in one call.
  const markPageMemorized = async (page) => {
    if (savingMemorized || memorizedPages.has(page)) return;
    const prevPages = memorizedPages;
    const prevPartial = partialPages;
    const nextPages = new Set(prevPages);
    nextPages.add(page);
    setSavingMemorized(true);
    setMemorizedPages(nextPages);
    // A whole-page mark always results in full coverage — drop any stale
    // partial-fraction entry so the tick doesn't show "½" right after this.
    if (partialPages.has(page)) {
      const nextPartial = new Map(partialPages);
      nextPartial.delete(page);
      setPartialPages(nextPartial);
    }
    try {
      await progressAPI.markComplete({ pageNumber: page, type: 'new' });
      showToast(t('library.markedToast', { n: fmtNum(page) }), 'success');
    } catch {
      setMemorizedPages(prevPages); // roll back the optimistic change
      setPartialPages(prevPartial);
      showToast(t('common.error'), 'error');
    } finally {
      setSavingMemorized(false);
    }
  };

  const unmarkPageMemorized = async (page) => {
    if (savingMemorized || !memorizedPages.has(page)) return;
    const prevPages = memorizedPages;
    const prevPartial = partialPages;
    const nextPages = new Set(prevPages);
    nextPages.delete(page);
    setSavingMemorized(true);
    setMemorizedPages(nextPages);
    if (partialPages.has(page)) {
      const nextPartial = new Map(partialPages);
      nextPartial.delete(page);
      setPartialPages(nextPartial);
    }
    try {
      await progressAPI.updateMemorized({ memorizedPages: Array.from(nextPages) });
      showToast(t('library.unmarkedToast', { n: fmtNum(page) }), 'success');
    } catch {
      setMemorizedPages(prevPages); // roll back the optimistic change
      setPartialPages(prevPartial);
      showToast(t('common.error'), 'error');
    } finally {
      setSavingMemorized(false);
    }
  };

  // ── Bookmarks ────────────────────────────────────────────
  const addBookmark = async () => {
    if (savingBookmark) return;
    setSavingBookmark(true);
    try {
      const label = bookmarkLabel.trim();
      const res = await bookmarksAPI.add({ pageNumber: bookmarkTargetPage, ...(label ? { label } : {}) });
      setBookmarks(prev => [...prev, res.data.data].sort((a, b) => a.pageNumber - b.pageNumber));
      setBookmarkLabel('');
      showToast(t('library.bookmarks.added', { n: fmtNum(bookmarkTargetPage) }), 'success');
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setSavingBookmark(false);
    }
  };

  const removeBookmark = async (id) => {
    const prev = bookmarks;
    setBookmarks(prev.filter(b => b._id !== id)); // optimistic
    try {
      await bookmarksAPI.remove(id);
    } catch {
      setBookmarks(prev); // roll back
      showToast(t('common.error'), 'error');
    }
  };

  // ── Tafsir loading ───────────────────────────────────────
  const tafsirVerse = tafsirIndex != null ? verses[tafsirIndex] : null;

  // The chosen edition — one of them is grammatical analysis (إعراب) rather than
  // commentary, which only changes what the panel calls itself.
  const tafsirEd = TAFSIR_EDITIONS.find(e => e.id === tafsirEdition) ?? TAFSIR_EDITIONS[0];

  useEffect(() => {
    if (!tafsirOpen || !tafsirVerse) return;
    let cancelled = false;
    const ed = TAFSIR_EDITIONS.find(e => e.id === tafsirEdition) ?? TAFSIR_EDITIONS[0];
    setTafsirLoading(true);
    setTafsirError(false);
    setTafsirText('');
    const load = ed.source === 'page'
      ? fetchPageTafsir(tafsirVerse.page, ed.edition).then(list =>
          list.find(a => a.number === tafsirVerse.id)?.text ?? '')
      : fetchAyahTafsir(ed.slug, tafsirVerse.surahNumber, tafsirVerse.ayahNumber);
    load
      .then(text => { if (!cancelled) setTafsirText(text); })
      .catch(() => { if (!cancelled) setTafsirError(true); })
      .finally(() => { if (!cancelled) setTafsirLoading(false); });
    return () => { cancelled = true; };
  }, [tafsirOpen, tafsirVerse, tafsirEdition, tafsirReloadKey]);

  useEffect(() => {
    localStorage.setItem('tafsirEdition', tafsirEdition);
  }, [tafsirEdition]);

  const openTafsir = (index) => {
    setNotePanel(null); // don't stack the two side panels
    setTafsirIndex(index);
    setTafsirOpen(true);
  };

  // ── Derived data ─────────────────────────────────────────
  const currentJuz = JUZ_START_PAGES.reduce((juz, start, i) => (start <= currentPage ? i + 1 : juz), 1);
  const firstSurahNumber = pagesData[0]?.verses?.[0]?.surahNumber ?? null;
  const sidebarSurah = SURAH_PAGES.find(s =>
    firstSurahNumber ? s.number === firstSurahNumber : (s.start <= currentPage && currentPage <= s.end)
  ) ?? SURAH_PAGES.find(s => s.start <= currentPage && currentPage <= s.end);
  // The surah's display name, honouring the EN/AR toggle.
  const surahLabelFor = (surahNumber) => {
    const s = SURAH_PAGES.find(x => x.number === surahNumber);
    return isArabic ? (s?.arabic ?? '') : (s?.name ?? '');
  };
  // Every distinct surah actually on a page, in reading order — multi-surah
  // pages (e.g. the short-surah pages near the end) list them all, joined by ' · '.
  const pageSurahLabels = (pageVerses) =>
    [...new Set((pageVerses ?? []).map((v) => v.surahNumber))].map(surahLabelFor).join(' · ');
  const currentSurahName = pageSurahLabels(pagesData[0]?.verses);
  const memorizedCount = memorizedPages.size;

  const selectedAudioIndex = useMemo(
    () => (selectedVerseKey != null ? verses.findIndex(v => v.verseKey === selectedVerseKey) : -1),
    [verses, selectedVerseKey]
  );
  const selectedVerse = selectedAudioIndex >= 0 ? verses[selectedAudioIndex] : null;
  // Only tint the verse while it's actually playing — pausing clears the tint
  // (resuming restores it; the audio element keeps its position, so play() picks
  // up from the same offset).
  const playingVerseKey = (isPlaying && playingIndex != null) ? verses[playingIndex]?.verseKey ?? null : null;

  // Popover prev/next: move the selection to the adjacent verse (the popover
  // follows), and keep audio going if it was playing. Programmatic, so it does
  // NOT re-anchor the popover (only a fresh word click does).
  const gotoPopoverVerse = (dir) => {
    const nidx = selectedAudioIndex + dir;
    if (nidx < 0 || nidx >= verses.length) return;
    setSelectedVerseKey(verses[nidx].verseKey);
    if (isPlaying || playingIndex != null) playAyah(nidx);
  };

  // Place the popover near the clicked word: below the pointer when it's in the
  // top half of the viewport, above it in the bottom half; centred on x; clamped
  // to the viewport with a small offset (standard selection-toolbar flip/shift).
  useLayoutEffect(() => {
    if (!selectedVerse || !popoverRef.current || !placeNextRef.current) return;
    placeNextRef.current = false;
    const el = popoverRef.current;
    const { width: w, height: h } = el.getBoundingClientRect();
    const p = lastPointerRef.current || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const gap = 14;
    let top = p.y < window.innerHeight / 2 ? p.y + gap : p.y - h - gap;
    let left = p.x - w / 2;
    left = Math.min(Math.max(left, 8), window.innerWidth - w - 8);
    top = Math.min(Math.max(top, 8), window.innerHeight - h - 8);
    setPopoverPos({ x: left, y: top });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseKey]);
  // The selected verse's own annotations, for the popover's active states.
  const selectedVerseAnns = selectedVerse ? (annotationsByPage.get(selectedVerse.page) ?? []) : [];
  const selectedHighlightColor = selectedVerse
    ? selectedVerseAnns.find(a => a.kind === 'highlight' && a.verseKey === selectedVerse.verseKey)?.color ?? null
    : null;
  const selectedHasNote = selectedVerse
    ? selectedVerseAnns.some(a => a.kind === 'note' && a.verseKey === selectedVerse.verseKey)
    : false;
  const selectedIsHard = selectedVerse
    ? selectedVerseAnns.some(a => a.kind === 'hard' && a.verseKey === selectedVerse.verseKey)
    : false;
  // Localized surah label(s) for a page (from SURAH_PAGES) — used by the hard list.
  const surahsForPage = (page) =>
    [...new Set(SURAH_PAGES.filter(s => s.start <= page && page <= s.end).map(s => s.number))]
      .map(surahLabelFor).filter(Boolean).join(' · ');
  // A one-line label for a hard-list item: page · surah (+ verse, or "whole page").
  const hardItemLabel = (h) => {
    const pageLbl = t('library.pageInfoLabel', { n: fmtNum(h.pageNumber) });
    if (h.verseKey) {
      const [s, a] = h.verseKey.split(':').map(Number);
      return `${pageLbl} · ${surahLabelFor(s)} ${t('library.verseLabel', { n: fmtNum(a) })}`;
    }
    return `${pageLbl} · ${surahsForPage(h.pageNumber) || t('library.annotations.wholePage')}`;
  };
  const bookmarkedPages = useMemo(() => new Set(bookmarks.map(b => b.pageNumber)), [bookmarks]);
  // The bookmark (if any) already saved for the active/current page — when set,
  // the add control swaps for this bookmark's own remove affordance.
  const targetBookmark = bookmarks.find(b => b.pageNumber === bookmarkTargetPage) ?? null;

  // Reuse the shared 7-step method strings (also powering HowToMemorizeModal).
  const methodSteps = t('howTo.steps', { returnObjects: true });
  const stepList = Array.isArray(methodSteps) ? methodSteps : [];

  const verseRef = (verse) =>
    `${surahLabelFor(verse.surahNumber)} · ${t('library.verseLabel', { n: fmtNum(verse.ayahNumber) })}`;

  const selectCls =
    'w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500';

  // One bordered mushaf page card (used for both single and the spread halves).
  // The top running head (surah · juz) and the centred page number at the foot
  // mirror a printed mushaf page's furniture. `slot` is a stable key (0/1) so the
  // card persists across page turns — letting the inner content crossfade.
  const renderPageCard = (pd, slot = 0) => {
    const pageJuz = JUZ_START_PAGES.reduce((j, s, i) => (s <= pd.page ? i + 1 : j), 1);
    const pageSurah = pageSurahLabels(pd.verses);
    // Word concealment is page-scoped: the same verse can be at a different
    // reveal point on each half of a spread, since each page has its own watermark.
    const order = pageOrders.get(pd.page);
    const watermark = watermarks[pd.page] ?? -1;
    const isConcealedHere = (verseKey, position) => {
      if (concealMode !== 'hide' || !order) return false;
      const idx = order.indexOf.get(`${verseKey}:${position}`);
      return idx != null && idx > watermark;
    };
    // Margin ornaments hug the page's OUTER edge, matching the physical book:
    // an odd page is right-hand (ornaments on the right), an even page is
    // left-hand (ornaments on the left) — true in both single-page view and
    // the two-page spread (whose right/left halves are always odd/even).
    // Detecting a boundary on the page's first verse needs the previous page's
    // last rub — read it from the in-session cache (in a spread the previous
    // page is the on-screen sibling, so it's always present there).
    const outerEdge = pd.page % 2 === 0 ? 'left' : 'right';
    const prevVerses = peekMushafPage(pd.page - 1)?.verses;
    const prevLastRub = prevVerses?.length ? prevVerses[prevVerses.length - 1].rubElHizb ?? null : null;

    // Compile this page's annotations into per-word lookups for MushafPage. A
    // highlight tints its verse (a word span when set); notes/hard mark verses;
    // a verseKey-null hard flag marks the whole page (the footer flag control).
    const anns = annotationsByPage.get(pd.page) ?? [];
    const highlightIndex = new Map();
    const noteVerses = new Set();
    const hardVerses = new Set();
    let pageHard = null;
    for (const a of anns) {
      if (a.kind === 'highlight' && a.verseKey) {
        const arr = highlightIndex.get(a.verseKey) ?? [];
        arr.push(a);
        highlightIndex.set(a.verseKey, arr);
      } else if (a.kind === 'note' && a.verseKey) {
        noteVerses.add(a.verseKey);
      } else if (a.kind === 'hard') {
        if (a.verseKey) hardVerses.add(a.verseKey);
        else pageHard = a;
      }
    }
    const highlightFor = (verseKey, position) => {
      const hs = highlightIndex.get(verseKey);
      if (!hs) return null;
      for (const h of hs) {
        if (h.wordFrom == null || h.wordTo == null) return h.color; // whole verse
        if (position >= h.wordFrom && position <= h.wordTo) return h.color;
      }
      return null;
    };
    const isPageHard = !!pageHard;
    // Drawing: the active page renders the live working strokes; every other page
    // renders its saved doc (display-only). Only the active page captures input.
    const drawDoc = anns.find((a) => a.kind === 'drawing');
    const isDrawingHere = drawPage === pd.page;
    const layerStrokes = isDrawingHere ? drawStrokes : (drawDoc?.strokes ?? []);
    const textNotes = anns.filter((a) => a.kind === 'text');
    // Clean-reading toggle: while hidden (and not drawing this page), suppress all
    // annotation visuals AND their click targets.
    const showAnns = annoVisible || isDrawingHere;
    return (
      <div
        key={slot}
        onClick={() => setActivePage(pd.page)}
        className="flex-1 min-w-0 rounded-2xl ring-1 ring-amber-200/60 dark:ring-amber-900/30 bg-[#f7f0da] dark:bg-[#1f1b14] shadow-xl dark:shadow-black/40 overflow-hidden"
      >
        <div className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col">
          {/* Running head — surah (outer) · juz (toward the spine), with a
              bookmark ribbon when this page is bookmarked. */}
          <div className="flex items-center justify-between gap-2 mb-2 px-1.5 text-[11px] font-semibold tracking-wide text-amber-900/55 dark:text-amber-200/35 select-none" dir="rtl">
            <span className="min-w-0 leading-tight flex items-center gap-1.5">
              {bookmarkedPages.has(pd.page) && (
                <FiBookmark className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400 fill-current" aria-label={t('library.bookmarks.marked')} />
              )}
              {pageSurah}
            </span>
            <span className="shrink-0 flex items-center gap-1.5">
              {t('library.juzInfoLabel', { n: fmtNum(pageJuz) })}
              {/* Show/hide all annotation visuals (clean reading) */}
              <Tooltip label={annoVisible ? t('library.annotations.hideAll') : t('library.annotations.showAll')}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setAnnoVisible((v) => !v); }}
                  disabled={isDrawingHere}
                  aria-label={annoVisible ? t('library.annotations.hideAll') : t('library.annotations.showAll')}
                  aria-pressed={!annoVisible}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-amber-800/55 dark:text-amber-200/45 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
                >
                  {annoVisible ? <FiEye className="w-3.5 h-3.5" /> : <FiEyeOff className="w-3.5 h-3.5" />}
                </button>
              </Tooltip>
              {/* Annotate (free-draw) toggle for this page */}
              <Tooltip label={isDrawingHere ? t('library.draw.exit') : t('library.draw.enter')}>
                <button
                  ref={isDrawingHere ? drawAnchorRef : undefined}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleDraw(pd.page); }}
                  disabled={markVersesMode}
                  aria-label={isDrawingHere ? t('library.draw.exit') : t('library.draw.enter')}
                  aria-pressed={isDrawingHere}
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors disabled:opacity-40 ${
                    isDrawingHere
                      ? 'bg-[#004f35] text-white'
                      : 'text-amber-800/55 dark:text-amber-200/45 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <FiEdit2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </span>
          </div>
          {/* Fixed-size framed page, uniformly scaled to fit the column. The turn
              animation lives INSIDE the frame so the frame itself never moves.
              `.mushaf-canvas-frame` reserves a proportional gutter around the
              canvas for the margin marks, which hang past the frame's border
              into that gutter — see MushafMarks and index.css. */}
          <div className="mushaf-canvas-frame">
            <div className="mushaf-canvas">
              <div className={`mushaf-frame${pulsePage === pd.page ? ' is-anno-pulse' : ''}`}>
                <Flip flipKey={pd.page} dir={turnDirRef.current} animate={!reduceMotion}>
                  <MushafPage
                    pageData={pd}
                    fontFamily={mushafFontFamily(pd.page)}
                    selectedVerseKey={selectedVerseKey}
                    playingVerseKey={playingVerseKey}
                    concealMode={concealMode}
                    isConcealed={isConcealedHere}
                    onSelectVerse={handleWordSelect}
                    onRevealVerse={revealVerse}
                    onRevealThrough={revealThrough}
                    onHideVerse={hideVerse}
                    highlightFor={showAnns ? highlightFor : null}
                    noteVerses={showAnns ? noteVerses : EMPTY_SET}
                    hardVerses={showAnns ? hardVerses : EMPTY_SET}
                    onOpenNote={(markVersesMode || !showAnns) ? null : (vk) => openNote(pd.page, vk)}
                    noteIndicatorLabel={t('library.annotations.noteIndicator')}
                  />
                </Flip>
                {/* Free-form ink + text overlays are siblings of the Flip/page-grid,
                    not children — that grid clips overflow. Their extended box
                    reaches into the margins (see MushafDrawLayer / index.css). */}
                <MushafDrawLayer
                  strokes={layerStrokes}
                  active={isDrawingHere}
                  visible={annoVisible}
                  tool={drawTool}
                  color={drawColor}
                  width={drawWidth}
                  onStrokesChange={handleDrawChange}
                  textNotes={textNotes}
                  onCreateText={(x, y, text, color) => createText(pd.page, x, y, text, color)}
                  onUpdateText={(id, patch) => updateText(pd.page, id, patch)}
                  onDeleteText={(id) => deleteText(pd.page, id)}
                  onReadText={(n) => setReadTextNote({ text: n.text, color: n.color || 'ink' })}
                  placeholder={t('library.draw.textPlaceholder')}
                />
                <MushafMarks pageData={pd} outerEdge={outerEdge} prevLastRub={prevLastRub} />
              </div>
            </div>
          </div>
          {/* Page number + an interactive per-page memorized toggle, so each half
              of a spread can be marked/unmarked on its own. */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-800/60 dark:text-amber-200/40 select-none">
            {(() => {
              const done = memorizedPages.has(pd.page);
              const fraction = partialPages.get(pd.page);
              const isPartial = done && fraction != null;
              const label = isPartial
                ? t('library.halfMemorized', { n: fmtNum(pd.page), pct: Math.round(fraction * 100) })
                : done
                  ? t('library.removePage', { n: fmtNum(pd.page) })
                  : t('library.markPage', { n: fmtNum(pd.page) });
              return (
                <Tooltip label={label}>
                  <button
                    type="button"
                    onClick={() => (done ? unmarkPageMemorized(pd.page) : markPageMemorized(pd.page))}
                    disabled={savingMemorized}
                    aria-label={label}
                    aria-pressed={done}
                    data-tour="lib-mark"
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPartial
                      ? <FiCheckCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      : done
                        ? <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        : <FiCircle className="w-4 h-4 text-amber-800/45 dark:text-amber-200/35" />}
                  </button>
                </Tooltip>
              );
            })()}
            {/* Whole-page "mark hard" flag — sits beside the memorized tick, same
                round-icon-button treatment so the pair reads as one control set. */}
            {(() => {
              const label = isPageHard
                ? t('library.annotations.unmarkPageHard', { n: fmtNum(pd.page) })
                : t('library.annotations.markPageHard', { n: fmtNum(pd.page) });
              return (
                <Tooltip label={label}>
                  <button
                    type="button"
                    onClick={() => toggleHard(pd.page, null)}
                    disabled={savingAnnotation || markVersesMode}
                    aria-label={label}
                    aria-pressed={isPageHard}
                    className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiFlag className={`w-4 h-4 ${isPageHard ? 'text-red-600 dark:text-red-400 fill-current' : 'text-amber-800/45 dark:text-amber-200/35'}`} />
                  </button>
                </Tooltip>
              );
            })()}
            <span>{fmtNum(pd.page)}</span>
          </div>
        </div>
      </div>
    );
  };

  const skeletonCard = (key) => (
    <div key={key} className="flex-1 min-w-0 rounded-2xl border-2 border-amber-200/70 dark:border-amber-900/40 bg-[#f7f0da] dark:bg-[#1f1b14] shadow-xl dark:shadow-black/40 overflow-hidden">
      <div className="border border-amber-100 dark:border-amber-950/60 m-2 rounded-xl px-5 py-6 sm:px-8 sm:py-8 min-h-[60vh]">
        <div className="flex flex-col gap-4 animate-pulse pt-2" dir="rtl">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="h-6 rounded bg-amber-100/70 dark:bg-gray-700/60" style={{ width: `${88 + (i % 3) * 4}%` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FFFDF5] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="grow w-full max-w-7xl mx-auto px-6 pt-28 pb-12">
        {/* Page header — orient a first-time visitor (hidden in focus mode) */}
        {!focused && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#003527] dark:text-gray-100">{t('nav.library')}</h1>
            <p className="text-sm text-[#404944] dark:text-gray-400 mt-1">{t('library.subtitle')}</p>
          </div>
        )}

        {/* Floating exit for focus mode — the sidebar toggle is hidden, so this
            (plus Escape / 'f') is how you leave. The fixed position lives on the
            Tooltip wrapper (logical start-*), so it sits on the SAME side the
            sidebar occupies — the start side, left in EN / right in AR — and the
            bubble anchors to it (opening down, toward the page centre). */}
        {focused && (
          <Tooltip label={t('library.focus.exit')} placement="bottom" className="fixed top-24 start-6 z-40">
            <button
              onClick={() => setFocusMode(false)}
              aria-label={t('library.focus.exit')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-gray-800/95 backdrop-blur border border-[#dce2f3] dark:border-gray-700 shadow-lg px-3 py-2 text-xs font-semibold text-[#004f35] dark:text-emerald-400 hover:bg-white dark:hover:bg-gray-700 transition-colors"
            >
              <FiMinimize2 className="w-4 h-4" /> {t('library.focus.exit')}
            </button>
          </Tooltip>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Sidebar (hidden in focus mode) ────────────── */}
          {!focused && (
          <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-4 flex flex-col gap-5 sacred-shadow lg:sticky lg:top-28 lg:self-start">

            {/* Page navigation */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.pageLabel')}</span>
              {/* dir=ltr pins the physical layout: the LEFT button always turns
                  forward (next page) and the RIGHT goes back, in both UI
                  languages — the mushaf is a right-to-left book, so forward is
                  always leftward. */}
              <div className="flex items-center gap-2" data-tour="lib-nav" dir="ltr">
                <Tooltip label={t('library.nextPageKey')}>
                  <button
                    onClick={goNext}
                    disabled={currentPage >= maxPage}
                    aria-label={t('library.nextPage')}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                </Tooltip>
                <span className="flex-1 text-center text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">
                  {fmtNum(currentPage)} / {fmtNum(604)}
                </span>
                <Tooltip label={t('library.prevPageKey')}>
                  <button
                    onClick={goPrev}
                    disabled={currentPage <= 1}
                    aria-label={t('library.prevPage')}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
              <input
                type="number"
                min="1"
                max="604"
                value={pageInput}
                onChange={e => setPageInput(e.target.value)}
                onKeyDown={handlePageInputKey}
                onBlur={handlePageInputBlur}
                className="w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                placeholder={t('library.gotoPagePlaceholder')}
              />

              {/* Single / two-page spread toggle + focus toggle (large screens only). */}
              <div className="hidden lg:flex items-center gap-1 rounded-lg border border-[#dce2f3] dark:border-gray-600 p-1">
                <button
                  onClick={() => setViewMode('single')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md px-2 py-1.5 transition-colors ${
                    view === 'single' ? 'bg-[#004f35] text-white' : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                  }`}
                >
                  <FiFile className="w-3.5 h-3.5" /> {t('library.view.single')}
                </button>
                <button
                  onClick={() => setViewMode('double')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-md px-2 py-1.5 transition-colors ${
                    view === 'double' ? 'bg-[#004f35] text-white' : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                  }`}
                >
                  <FiColumns className="w-3.5 h-3.5" /> {t('library.view.double')}
                </button>
              </div>
              <button
                onClick={() => setFocusMode(true)}
                className="hidden lg:inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg border border-[#dce2f3] dark:border-gray-600 px-3 py-2 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
              >
                <FiMaximize2 className="w-3.5 h-3.5" /> {t('library.focus.enter')}
              </button>
            </div>

            {/* ── Self-test (active recall) — always available ── */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#dce2f3] dark:border-gray-700 p-3.5">
              {/* Label + tappable explainer (the how-it-works text lives here). */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">
                  {t('library.selfTest.label')}
                </span>
                <InfoHint text={t(`library.selfTest.hint.${selfTest}`)} label={t('library.selfTest.label')} size="xs" />
              </div>
              {/* Segmented control: pick a testing style (or turn it off). */}
              <div
                className="grid grid-cols-3 gap-1 rounded-lg border border-[#dce2f3] dark:border-gray-600 p-1"
                role="group"
                aria-label={t('library.selfTest.label')}
                data-tour="lib-test"
              >
                {['off', 'hide', 'cover'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelfTestMode(m)}
                    aria-pressed={selfTest === m}
                    className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-md px-1.5 py-1.5 transition-colors ${
                      selfTest === m
                        ? 'bg-[#004f35] text-white'
                        : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                    }`}
                  >
                    {m === 'hide' && <FiEyeOff className="w-3.5 h-3.5" />}
                    {m === 'cover' && <FiEye className="w-3.5 h-3.5" />}
                    {t(`library.selfTest.mode.${m}`)}
                  </button>
                ))}
              </div>
              {selfTest === 'hide' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={revealAllVisible}
                    className="flex-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('library.selfTest.revealAll')}
                  </button>
                  <button
                    onClick={hideAllVerses}
                    className="flex-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('library.selfTest.hideAll')}
                  </button>
                </div>
              )}
            </div>

            {/* ── Method checklist (ephemeral ticks), collapsed by default ── */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMethodOpen(o => !o)}
                className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500 hover:text-[#404944] dark:hover:text-gray-300 transition-colors"
              >
                {t('library.method.title')}
                <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${methodOpen ? 'rotate-180' : ''}`} />
              </button>
              {methodOpen && (
                <>
                  <ol className="flex flex-col gap-0.5">
                    {stepList.map((step, i) => (
                      <li key={i}>
                        <button
                          onClick={() => toggleStep(i)}
                          className="w-full flex items-start gap-2 text-start py-0.5 group"
                        >
                          {checkedSteps.has(i)
                            ? <FiCheckSquare className="w-4 h-4 mt-0.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                            : <FiSquare className="w-4 h-4 mt-0.5 shrink-0 text-[#b0b6bd] dark:text-gray-500 group-hover:text-[#707974] dark:group-hover:text-gray-400 transition-colors" />}
                          <span className={`text-xs leading-snug ${checkedSteps.has(i) ? 'line-through text-[#a0a6ab] dark:text-gray-600' : 'text-[#404944] dark:text-gray-300'}`}>
                            {step.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() => setHowToOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#004f35] dark:text-emerald-400 hover:underline underline-offset-2 mt-0.5 w-max"
                  >
                    <FiHelpCircle className="w-3.5 h-3.5" /> {t('library.method.fullGuide')}
                  </button>
                </>
              )}
            </div>

            {/* Jump to Juz */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.jumpToJuz')}</span>
              <select
                value={currentJuz}
                onChange={e => goToPage(JUZ_START_PAGES[Number(e.target.value) - 1])}
                className={selectCls}
              >
                {JUZ_START_PAGES.map((_, i) => (
                  <option key={i + 1} value={i + 1}>{t('library.juzInfoLabel', { n: fmtNum(i + 1) })}</option>
                ))}
              </select>
            </div>

            {/* Jump to Surah */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.jumpToSurah')}</span>
              <select
                value={sidebarSurah?.number ?? ''}
                onChange={e => {
                  const s = SURAH_PAGES.find(x => x.number === Number(e.target.value));
                  if (s) goToPage(s.start);
                }}
                className={selectCls}
              >
                {SURAH_PAGES.map(s => (
                  <option key={s.number} value={s.number}>
                    {fmtNum(s.number)}. {isArabic ? s.arabic : s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bookmarks */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.bookmarks.title')}</span>
              {targetBookmark ? (
                // The active/current page is already bookmarked — swap the
                // add control for this bookmark's own state + remove action.
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-3 py-2 rounded-lg">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <FiBookmark className="w-3.5 h-3.5 shrink-0 fill-current" />
                    <span className="truncate">{targetBookmark.label || t('library.bookmarks.pageLabel', { n: fmtNum(bookmarkTargetPage) })}</span>
                  </span>
                  <button
                    onClick={() => removeBookmark(targetBookmark._id)}
                    className="shrink-0 text-[11px] font-medium text-green-800/70 dark:text-green-300/70 hover:underline underline-offset-2"
                  >
                    {t('library.bookmarks.remove')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={bookmarkLabel}
                    onChange={e => setBookmarkLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addBookmark(); }}
                    maxLength={50}
                    placeholder={t('library.bookmarks.labelPlaceholder')}
                    className="flex-1 min-w-0 rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                  />
                  <Tooltip label={t('library.bookmarks.add', { n: fmtNum(bookmarkTargetPage) })}>
                    <button
                      onClick={addBookmark}
                      disabled={savingBookmark}
                      aria-label={t('library.bookmarks.add', { n: fmtNum(bookmarkTargetPage) })}
                      className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#004f35] text-white hover:bg-[#003527] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
              {bookmarks.length === 0 ? (
                <p className="text-xs text-[#9aa3a0] dark:text-gray-600">{t('library.bookmarks.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto -mr-1 pr-1">
                  {bookmarks.map(b => (
                    <li key={b._id} className="flex items-center gap-1">
                      <button
                        onClick={() => goToPage(b.pageNumber)}
                        className={`flex-1 min-w-0 inline-flex items-center gap-1.5 text-start text-xs rounded-lg px-2 py-1.5 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors ${
                          b.pageNumber === bookmarkTargetPage ? 'text-[#003527] dark:text-emerald-300 font-semibold' : 'text-[#404944] dark:text-gray-300'
                        }`}
                      >
                        <FiBookmark className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                        <span className="truncate">{b.label || t('library.bookmarks.pageLabel', { n: fmtNum(b.pageNumber) })}</span>
                        {b.label && <span className="shrink-0 text-[10px] text-[#9aa3a0] dark:text-gray-600">{fmtNum(b.pageNumber)}</span>}
                      </button>
                      <Tooltip label={t('library.bookmarks.remove')}>
                        <button
                          onClick={() => removeBookmark(b._id)}
                          aria-label={t('library.bookmarks.remove')}
                          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#9aa3a0] dark:text-gray-500 hover:text-[#ba1a1a] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Mark verses — sub-page memorization by verse range */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.markVerses.title')}</span>
              {markVersesMode ? (
                <div className="flex flex-col gap-2 text-xs bg-[#f0f4ff] dark:bg-gray-700/40 border border-[#dce2f3] dark:border-gray-600 rounded-lg px-3 py-2">
                  <p className="text-[#404944] dark:text-gray-300 font-medium">
                    {markingVerses
                      ? t('common.loading')
                      : markRangeStart
                        ? t('library.markVerses.tapLast')
                        : t('library.markVerses.tapFirst')}
                  </p>
                  <button
                    onClick={cancelMarkVerses}
                    disabled={markingVerses}
                    className="self-start text-[#707974] dark:text-gray-400 hover:text-[#ba1a1a] dark:hover:text-red-400 font-medium disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <Tooltip label={t('library.markVerses.hint')}>
                  <button
                    onClick={startMarkVerses}
                    className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-[#004f35] dark:text-emerald-400 hover:underline underline-offset-2"
                  >
                    <FiPlus className="w-3.5 h-3.5" /> {t('library.markVerses.start')}
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Annotations navigator — prev/next annotated page + the full list */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setAnnoNavOpen((o) => !o)}
                className="flex items-center justify-between gap-2 text-start"
                aria-expanded={annoNavOpen}
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">
                  <FiEdit3 className="w-3 h-3 text-[#004f35] dark:text-emerald-400" />
                  {t('library.annotations.navTitle')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {annotatedPages.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#e6f0ea] dark:bg-emerald-900/40 text-[#004f35] dark:text-emerald-300 text-[10px] font-bold">
                      {fmtNum(annotatedPages.length)}
                    </span>
                  )}
                  <FiChevronDown className={`w-4 h-4 text-[#707974] dark:text-gray-500 transition-transform ${annoNavOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {/* Prev / next annotated page (wraps at the ends) */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => gotoAdjacentAnnotated(-1)}
                  disabled={annotatedPages.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <FiChevronRight className="w-4 h-4 rtl:rotate-180" /> {t('library.annotations.prevAnnotated')}
                </button>
                <button
                  onClick={() => gotoAdjacentAnnotated(1)}
                  disabled={annotatedPages.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('library.annotations.nextAnnotated')} <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

              {annoNavOpen && (
                annotatedPages.length === 0 ? (
                  <p className="text-xs text-[#9aa3a0] dark:text-gray-600">{t('library.annotations.navEmpty')}</p>
                ) : (
                  <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto -mr-1 pr-1">
                    {annoSummary.map((s) => (
                      <li key={s.pageNumber}>
                        <button
                          onClick={() => jumpToAnnotatedPage(s.pageNumber)}
                          className={`w-full text-start rounded-lg px-2 py-1.5 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors ${
                            s.pageNumber === bookmarkTargetPage ? 'bg-[#f0f4ff] dark:bg-gray-700/60' : ''
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#003527] dark:text-emerald-300">
                              {t('library.pageInfoLabel', { n: fmtNum(s.pageNumber) })}
                            </span>
                            <span className="inline-flex items-center gap-2 text-[10px] text-[#707974] dark:text-gray-400">
                              {s.counts.highlight > 0 && <span className="inline-flex items-center gap-0.5"><FiDroplet className="w-3 h-3 text-amber-500" />{fmtNum(s.counts.highlight)}</span>}
                              {s.counts.note > 0 && <span className="inline-flex items-center gap-0.5"><FiMessageSquare className="w-3 h-3 text-blue-500" />{fmtNum(s.counts.note)}</span>}
                              {s.counts.hard > 0 && <span className="inline-flex items-center gap-0.5"><FiFlag className="w-3 h-3 text-red-500" />{fmtNum(s.counts.hard)}</span>}
                              {s.counts.drawing > 0 && <FiPenTool className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                            </span>
                          </span>
                          {s.noteExcerpt && (
                            <span className="block truncate text-[11px] text-[#707974] dark:text-gray-500 mt-0.5" dir="auto">“{s.noteExcerpt}”</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>

            {/* Hard verses & pages — the user's "hard" list with jump links */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setHardOpen((o) => !o)}
                className="flex items-center justify-between gap-2 text-start"
                aria-expanded={hardOpen}
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">
                  <FiFlag className="w-3 h-3 text-red-500 dark:text-red-400" />
                  {t('library.annotations.hardTitle')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {hardList.length > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold">
                      {fmtNum(hardList.length)}
                    </span>
                  )}
                  <FiChevronDown className={`w-4 h-4 text-[#707974] dark:text-gray-500 transition-transform ${hardOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {hardOpen && (
                hardList.length === 0 ? (
                  <p className="text-xs text-[#9aa3a0] dark:text-gray-600">{t('library.annotations.hardEmpty')}</p>
                ) : (
                  <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto -mr-1 pr-1">
                    {hardList.map((h) => (
                      <li key={h._id} className="flex items-center gap-1">
                        <button
                          onClick={() => goToPage(h.pageNumber)}
                          className={`flex-1 min-w-0 inline-flex items-center gap-1.5 text-start text-xs rounded-lg px-2 py-1.5 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors ${
                            h.pageNumber === bookmarkTargetPage ? 'text-[#003527] dark:text-emerald-300 font-semibold' : 'text-[#404944] dark:text-gray-300'
                          }`}
                        >
                          <FiFlag className="w-3 h-3 shrink-0 text-red-500 dark:text-red-400" />
                          <span className="truncate">{hardItemLabel(h)}</span>
                          <FiCornerUpRight className="w-3 h-3 shrink-0 ms-auto text-[#9aa3a0] dark:text-gray-600 rtl:rotate-180" />
                        </button>
                        <Tooltip label={t('library.annotations.removeHard')}>
                          <button
                            onClick={() => removeHardItem(h._id, h.pageNumber)}
                            aria-label={t('library.annotations.removeHard')}
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-[#9aa3a0] dark:text-gray-500 hover:text-[#ba1a1a] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>

            {/* Stats */}
            <div className="text-sm text-[#707974] dark:text-gray-500">
              {t('library.pagesMemorizedStat', { count: memorizedCount })}
            </div>
          </aside>
          )}

          {/* ── Mushaf column ─────────────────────────────── */}
          {/* w-full so that when the layout stacks (below lg) the column fills the
              row — `items-start` otherwise shrinks it to content width and pins it
              to the start edge, leaving the page card off-centre on narrow screens.
              In focus mode the sidebar is gone, so cap + centre the reading column. */}
          <div className={`flex-1 w-full flex flex-col gap-4 min-w-0${focused ? ' lg:max-w-5xl lg:mx-auto' : ''}`}>

            {/* Discoverability cue — the self-test hint stays while testing; the
                plain "tap a verse" cue retires once the reader has selected one. */}
            {(concealMode || !seenVerseTap) && (
              <p data-tour="lib-verse" className="w-full max-w-[650px] mx-auto -mb-1 flex items-center justify-center gap-1.5 text-center text-xs text-[#707974] dark:text-gray-500">
                <FiInfo className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                {concealMode ? t(`library.selfTest.hint.${concealMode}`) : t('hints.libraryVerseTap')}
              </p>
            )}

            {/* Mushaf page(s) — the relative wrapper hosts the floating edge
                arrows (they fade in on hover of this viewport) and the swipe
                target. In single view it hugs the card; in the spread it spans
                the full row so the arrows flank the whole spread. */}
            <div
              className={`mushaf-viewport relative w-full mx-auto${twoPage ? '' : ' max-w-[760px]'}`}
              onPointerDownCapture={(e) => { lastPointerRef.current = { x: e.clientX, y: e.clientY }; }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Edge hot-zones: LEFT turns forward, RIGHT turns back (RTL book).
                  Pure affordance — hidden on touch (swipe covers that), sit in the
                  margin outside the text frame, and step aside at the book's ends.
                  Hidden while annotating (page turns are suspended in draw mode). */}
              {pagesData.length > 0 && !pageError && drawPage == null && (
                <>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={currentPage >= maxPage}
                    aria-label={t('library.nextPage')}
                    className="mushaf-edge-zone mushaf-edge-zone--next"
                  >
                    <FiChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={currentPage <= 1}
                    aria-label={t('library.prevPage')}
                    className="mushaf-edge-zone mushaf-edge-zone--prev"
                  >
                    <FiChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
              {pageError ? (
                <div className="w-full max-w-[700px] mx-auto rounded-2xl border-2 border-amber-200/70 dark:border-amber-900/40 bg-[#fdf8ec] dark:bg-[#1f1b14] shadow-xl">
                  <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
                    <FiAlertCircle className="w-10 h-10 text-[#707974] dark:text-gray-500" />
                    <p className="text-sm font-medium text-[#404944] dark:text-gray-400">{t('library.loadError')}</p>
                    <button
                      onClick={() => setReloadKey(k => k + 1)}
                      className="text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                </div>
              ) : pagesData.length === 0 ? (
                // First load only — on later turns we keep the current content
                // (dimmed) so the page-turn animation has something to leave from.
                <div className={twoPage ? 'w-full flex gap-3 items-stretch' : 'w-full max-w-[700px] mx-auto'} style={twoPage ? { direction: 'rtl' } : undefined}>
                  {(twoPage ? visiblePages : [currentPage]).map((p) => skeletonCard(p))}
                </div>
              ) : (
                <div className={`transition-opacity duration-200${pageLoading ? ' opacity-60' : ''}`} aria-busy={pageLoading || undefined}>
                  {twoPage ? (
                    <div className="w-full flex gap-3 items-stretch" style={{ direction: 'rtl' }}>
                      {pagesData.map(renderPageCard)}
                    </div>
                  ) : (
                    <div className="w-full max-w-[700px] mx-auto">
                      {renderPageCard(pagesData[0], 0)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Page scrubber — fast navigation without typing, tight
                against the page card(s) so it's visible without scrolling ── */}
            <div className="w-full max-w-[650px] mx-auto -mt-2">
              <PageScrubber currentPage={currentPage} onNavigate={goToPage} fmtNum={fmtNum} />
            </div>

            {/* Page info bar */}
            <p className="text-sm text-[#707974] dark:text-gray-500 text-center">
              {t('library.pageInfoLabel', { n: fmtNum(currentPage) })}
              {currentSurahName && <> · {t('library.surahLabel')} {currentSurahName}</>}
              {' '}· {t('library.juzInfoLabel', { n: fmtNum(currentJuz) })}
            </p>

            {/* Verse action popover — placed near the selection (fixed), draggable
                via the grip. While it's open the bottom audio bar is hidden and the
                popover is the sole transport (play/pause + prev/next). */}
            {selectedVerse && (
              <div
                ref={popoverRef}
                style={popoverDragStyle}
                className="fixed left-0 top-0 z-40 bg-white dark:bg-gray-800 rounded-3xl border border-[#dce2f3] dark:border-gray-600 shadow-lg ps-1.5 pe-4 py-2 flex flex-wrap items-center justify-center gap-2 select-none max-w-[calc(100vw-1.5rem)]"
              >
                <Tooltip label={t('tooltips.dragHandle')} suppressed={handleDragging}>
                  <span
                    {...popoverDragHandlers}
                    onPointerDown={(e) => { setHandleDragging(true); popoverDragHandlers.onPointerDown(e); }}
                    aria-label={t('tooltips.dragHandle')}
                    className="flex items-center justify-center w-6 h-8 rounded-full text-[#b0b6bd] dark:text-gray-500 hover:text-[#707974] dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
                  >
                    <FiMove className="w-3.5 h-3.5" />
                  </span>
                </Tooltip>
                <span className="text-xs font-semibold text-[#003527] dark:text-gray-200 whitespace-nowrap">
                  {verseRef(selectedVerse)}
                </span>
                {/* Transport (play/pause + prev/next) + Tafsir — the popover is the
                    sole controller while it's open (the bottom bar is hidden). */}
                <div className="flex items-center gap-1.5" data-tour="verse-actions">
                  <Tooltip label={t('tooltips.prevVerse')}>
                    <button
                      onClick={() => gotoPopoverVerse(-1)}
                      disabled={selectedAudioIndex <= 0}
                      aria-label={t('tooltips.prevVerse')}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <FiSkipBack className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </Tooltip>
                  {(() => {
                    const isThisPlaying = selectedAudioIndex === playingIndex && isPlaying;
                    return (
                      <Tooltip label={isThisPlaying ? t('tooltips.pause') : t('tooltips.playFromHere')}>
                        <button
                          onClick={() => toggleSelectedVerse(selectedAudioIndex)}
                          className="w-8 h-8 rounded-full bg-[#004f35] text-white flex items-center justify-center hover:bg-[#003527] transition-colors"
                        >
                          {isThisPlaying
                            ? <FiPause className="w-3.5 h-3.5" />
                            : <FiPlay className="w-3.5 h-3.5 ms-0.5 rtl:rotate-180" />}
                        </button>
                      </Tooltip>
                    );
                  })()}
                  <Tooltip label={t('tooltips.nextVerse')}>
                    <button
                      onClick={() => gotoPopoverVerse(1)}
                      disabled={selectedAudioIndex >= verses.length - 1}
                      aria-label={t('tooltips.nextVerse')}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <FiSkipForward className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </Tooltip>
                  <Tooltip label={t('tooltips.verseTafsir')}>
                    <button
                      onClick={() => openTafsir(selectedAudioIndex)}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#004f35] dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <FiBookOpen className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
                {/* Annotation actions — highlight swatches, note, mark hard. Kept
                    off while the "mark verses" picking mode owns taps (it clears
                    the selection anyway, so this is a double guard). */}
                {!markVersesMode && (
                  <div className="flex items-center gap-1.5" data-tour="verse-annotate">
                    <span className="w-px h-6 bg-[#dce2f3] dark:bg-gray-600" aria-hidden="true" />
                    {ANNOTATION_COLORS.map(({ key, cls, labelKey }) => {
                      const active = selectedHighlightColor === key;
                      return (
                        <Tooltip key={key} label={t(labelKey)}>
                          <button
                            onClick={() => setVerseHighlight(selectedVerse.page, selectedVerse.verseKey, key)}
                            disabled={savingAnnotation}
                            aria-label={t(labelKey)}
                            aria-pressed={active}
                            className={`w-6 h-6 rounded-full transition-transform disabled:opacity-50 ${cls} ${
                              active
                                ? 'ring-2 ring-offset-1 ring-[#004f35] dark:ring-emerald-400 dark:ring-offset-gray-800 scale-110'
                                : 'ring-1 ring-black/10 dark:ring-white/25 hover:scale-110'
                            }`}
                          />
                        </Tooltip>
                      );
                    })}
                    <Tooltip label={selectedHasNote ? t('library.annotations.editNote') : t('library.annotations.addNote')}>
                      <button
                        onClick={() => openNote(selectedVerse.page, selectedVerse.verseKey)}
                        aria-label={selectedHasNote ? t('library.annotations.editNote') : t('library.annotations.addNote')}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                          selectedHasNote
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-300'
                            : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                        }`}
                      >
                        <FiMessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip label={selectedIsHard ? t('library.annotations.unmarkHard') : t('library.annotations.markHard')}>
                      <button
                        onClick={() => toggleHard(selectedVerse.page, selectedVerse.verseKey)}
                        disabled={savingAnnotation}
                        aria-label={selectedIsHard ? t('library.annotations.unmarkHard') : t('library.annotations.markHard')}
                        aria-pressed={selectedIsHard}
                        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-50 ${
                          selectedIsHard
                            ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                            : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        <FiFlag className={`w-3.5 h-3.5 ${selectedIsHard ? 'fill-current' : ''}`} />
                      </button>
                    </Tooltip>
                  </div>
                )}
                <Tooltip label={t('tooltips.close')}>
                  <button
                    onClick={() => setSelectedVerseKey(null)}
                    className="w-8 h-8 rounded-full text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            )}

            {/* ── Sticky audio bar — stays visible with the popover (reciter, speed, repeat live here) ── */}
            <div data-tour="lib-audio" className="sticky bottom-3 z-20 w-full max-w-[720px] mx-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl border border-[#dce2f3] dark:border-gray-700 shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tooltip label={t('tooltips.prevVerse')}>
                  <button
                    onClick={() => stepVerse(-1)}
                    disabled={pageLoading || pageError || verses.length === 0 || (playingIndex === 0 && currentPage <= 1)}
                    className="w-9 h-9 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <FiSkipBack className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
                <Tooltip label={isPlaying ? t('tooltips.pause') : t('tooltips.play')}>
                  <button
                    onClick={togglePlayPause}
                    disabled={pageLoading || pageError || verses.length === 0}
                    className="w-11 h-11 rounded-full bg-[#004f35] text-white flex items-center justify-center hover:bg-[#003527] disabled:opacity-40 transition-colors shrink-0"
                  >
                    {audioBuffering && isPlaying ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isPlaying ? (
                      <FiPause className="w-5 h-5" />
                    ) : (
                      <FiPlay className="w-5 h-5 ms-0.5 rtl:rotate-180 rtl:me-0.5 rtl:ms-0" />
                    )}
                  </button>
                </Tooltip>
                <Tooltip label={t('tooltips.nextVerse')}>
                  <button
                    onClick={() => stepVerse(1)}
                    disabled={pageLoading || pageError || verses.length === 0 || (playingIndex != null && playingIndex >= verses.length - 1 && currentPage >= maxPage)}
                    className="w-9 h-9 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <FiSkipForward className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
              </div>

              <div className="flex-1 min-w-[120px]">
                <p className="text-xs font-semibold text-[#003527] dark:text-gray-200 flex items-center gap-1.5">
                  <FiHeadphones className="w-3.5 h-3.5 text-[#004f35] dark:text-emerald-400 shrink-0" />
                  {audioError
                    ? <span className="text-[#ba1a1a] dark:text-red-400">{t('library.audioError')}</span>
                    : playingIndex != null
                      ? t('library.verseOf', { current: fmtNum(playingIndex + 1), total: fmtNum(verses.length) })
                      : t('library.listen')}
                </p>
              </div>

              {/* Playback speed */}
              <Tooltip label={t('library.audio.speed')}>
                <select
                  value={playbackRate}
                  onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                  aria-label={t('library.audio.speed')}
                  className="rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                >
                  {SPEEDS.map(s => (
                    <option key={s} value={s}>{fmtNum(s)}×</option>
                  ))}
                </select>
              </Tooltip>

              {/* Repeat for memorization (verse ×N / range loop) */}
              <div className="relative">
                <Tooltip label={t('library.audio.repeat')}>
                  <button
                    type="button"
                    onClick={() => setRepeatOpen(o => !o)}
                    aria-label={t('library.audio.repeat')}
                    aria-pressed={repeatMode !== 'off'}
                    className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                      repeatMode !== 'off'
                        ? 'bg-[#004f35] text-white border-[#004f35]'
                        : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                    }`}
                  >
                    <FiRepeat className="w-4 h-4" />
                  </button>
                </Tooltip>
                {repeatOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setRepeatOpen(false)} />
                    <div className="absolute bottom-full mb-2 end-0 z-40 w-64 bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-600 shadow-xl p-3 flex flex-col gap-3" dir={isArabic ? 'rtl' : 'ltr'}>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f0f4ff] dark:bg-gray-700/50 p-0.5">
                        {[['off', t('library.audio.repeatOff')], ['verse', t('library.audio.repeatVerse')], ['range', t('library.audio.repeatRange')]].map(([m, label]) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setRepeatMode(m)}
                            className={`text-xs font-semibold rounded-md px-1.5 py-1.5 transition-colors ${
                              repeatMode === m ? 'bg-white dark:bg-gray-800 text-[#003527] dark:text-emerald-400 shadow-sm' : 'text-[#707974] dark:text-gray-400'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {repeatMode === 'verse' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#707974] dark:text-gray-400">{t('library.audio.repeatTimes')}</span>
                          {REP_COUNTS.map(n => (
                            <button
                              key={String(n)}
                              type="button"
                              onClick={() => setVerseRepeat(n)}
                              className={`flex-1 text-xs font-bold rounded-md py-1 border transition-colors ${
                                verseRepeat === n ? 'bg-[#004f35] text-white border-[#004f35]' : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300'
                              }`}
                            >
                              {n === Infinity ? '∞' : `×${fmtNum(n)}`}
                            </button>
                          ))}
                        </div>
                      )}

                      {repeatMode === 'range' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#707974] dark:text-gray-500">{t('library.audio.rangeFrom')}</span>
                              <select value={rangeStart} onChange={e => setRangeStart(Math.min(Number(e.target.value), rangeEnd))} className={selectCls}>
                                {verses.map((v, i) => <option key={v.verseKey} value={i}>{v.verseKey}</option>)}
                              </select>
                            </label>
                            <label className="flex-1 flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#707974] dark:text-gray-500">{t('library.audio.rangeTo')}</span>
                              <select value={rangeEnd} onChange={e => setRangeEnd(Math.max(Number(e.target.value), rangeStart))} className={selectCls}>
                                {verses.map((v, i) => <option key={v.verseKey} value={i}>{v.verseKey}</option>)}
                              </select>
                            </label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#707974] dark:text-gray-400">{t('library.audio.repeatTimes')}</span>
                            {REP_COUNTS.map(n => (
                              <button
                                key={String(n)}
                                type="button"
                                onClick={() => setRangeRepeat(n)}
                                className={`flex-1 text-xs font-bold rounded-md py-1 border transition-colors ${
                                  rangeRepeat === n ? 'bg-[#004f35] text-white border-[#004f35]' : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300'
                                }`}
                              >
                                {n === Infinity ? '∞' : `×${fmtNum(n)}`}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => { setRepeatOpen(false); playAyah(rangeStart); }}
                            className="text-xs font-semibold text-white bg-[#004f35] hover:bg-[#003527] rounded-lg py-1.5 transition-colors"
                          >
                            {t('library.audio.playRange')}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <Tooltip label={t('tooltips.reciter')}>
                <select
                  value={reciter}
                  onChange={e => setReciter(e.target.value)}
                  aria-label={t('tooltips.reciter')}
                  className="rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500 max-w-[160px]"
                >
                  {RECITERS.map(r => (
                    <option key={r.id} value={r.id}>{isArabic ? r.nameAr : r.nameEn}</option>
                  ))}
                </select>
              </Tooltip>
            </div>

            <audio
              ref={audioRef}
              onEnded={handleEnded}
              onWaiting={() => setAudioBuffering(true)}
              onPlaying={() => setAudioBuffering(false)}
              onCanPlay={() => setAudioBuffering(false)}
              onError={() => {
                if (playingIndex != null) { setAudioError(true); setIsPlaying(false); }
              }}
            />
          </div>
        </div>
      </main>

      {/* ── Tafsir panel: bottom sheet (mobile) / side panel (desktop) ── */}
      {tafsirOpen && tafsirVerse && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setTafsirOpen(false)}
          />
          <div className="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl border-[#dce2f3] dark:border-gray-700 flex flex-col
                          bottom-0 inset-x-0 max-h-[78vh] rounded-t-3xl border-t
                          md:bottom-0 md:top-0 md:inset-x-auto md:end-0 md:h-full md:max-h-full md:w-[420px] md:rounded-none md:border-s md:border-t-0">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#dce2f3] dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <FiBookOpen className="w-4 h-4 text-[#004f35] dark:text-emerald-400 shrink-0" />
                <h3 className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">
                  {t(tafsirEd.kind === 'irab' ? 'library.irabTitle' : 'library.tafsirTitle')}
                </h3>
                <InfoHint text={t('hints.tafsir')} label={t('library.tafsir')} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip label={t('tooltips.prevVerse')}>
                  <button
                    onClick={() => setTafsirIndex(i => Math.max(0, i - 1))}
                    disabled={tafsirIndex === 0}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
                <Tooltip label={t('tooltips.nextVerse')}>
                  <button
                    onClick={() => setTafsirIndex(i => Math.min(verses.length - 1, i + 1))}
                    disabled={tafsirIndex >= verses.length - 1}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <FiChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
                <Tooltip label={t('tooltips.close')}>
                  <button
                    onClick={() => setTafsirOpen(false)}
                    className="w-8 h-8 rounded-lg text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* The verse, mushaf-styled */}
              <div dir="rtl" className="rounded-xl bg-[#fdf8ec] dark:bg-[#1f1b14] border border-amber-200/70 dark:border-amber-900/40 px-4 py-3">
                <p className="mushaf-text !text-xl text-[#1f1505] dark:text-[#f3e9d2]">
                  {verseText(tafsirVerse)}
                  <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                    ﴿{toArabicDigits(tafsirVerse.ayahNumber)}﴾
                  </span>
                </p>
              </div>

              {/* Surah · verse + play (toggles: pauses if this verse is playing) */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#404944] dark:text-gray-300">{verseRef(tafsirVerse)}</p>
                {(() => {
                  const tafsirPlaying = tafsirIndex === playingIndex && isPlaying;
                  return (
                    <button
                      onClick={() => toggleSelectedVerse(tafsirIndex)}
                      title={tafsirPlaying ? t('library.pause') : t('library.playThisVerse')}
                      aria-label={tafsirPlaying ? t('library.pause') : t('library.playThisVerse')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f35] dark:text-emerald-400 border border-[#004f35]/30 dark:border-emerald-500/30 px-3 py-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      {tafsirPlaying
                        ? <><FiPause className="w-3 h-3" /> {t('library.pause')}</>
                        : <><FiPlay className="w-3 h-3 rtl:rotate-180" /> {t('library.playThisVerse')}</>}
                    </button>
                  );
                })()}
              </div>

              {/* Edition select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">
                  {t('library.tafsirEdition')}
                </label>
                <Tooltip label={t('tooltips.tafsirEdition')} className="w-full">
                  <select
                    value={tafsirEdition}
                    onChange={e => setTafsirEdition(e.target.value)}
                    className={selectCls}
                  >
                    {TAFSIR_EDITIONS.map(ed => (
                      <option key={ed.id} value={ed.id}>{isArabic ? ed.nameAr : ed.nameEn}</option>
                    ))}
                  </select>
                </Tooltip>
              </div>

              {/* Tafsir text */}
              {tafsirLoading ? (
                <div className="flex flex-col gap-2.5 animate-pulse pt-1" dir="rtl">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-700" style={{ width: `${95 - (i % 3) * 8}%` }} />
                  ))}
                </div>
              ) : tafsirError ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <FiAlertCircle className="w-8 h-8 text-[#707974] dark:text-gray-500" />
                  <p className="text-sm text-[#404944] dark:text-gray-400">{t('library.tafsirError')}</p>
                  <button
                    onClick={() => setTafsirReloadKey(k => k + 1)}
                    className="text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors"
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : (
                <p dir="rtl" className="text-base leading-loose text-[#1A1A1A] dark:text-gray-200 whitespace-pre-wrap" style={{ fontFamily: "'Noto Sans Arabic', 'Inter', sans-serif" }}>
                  {tafsirText}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Note editor: same bottom-sheet (mobile) / side-panel (desktop) shell as tafsir ── */}
      {notePanel && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setNotePanel(null)}
          />
          <div className="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl border-[#dce2f3] dark:border-gray-700 flex flex-col
                          bottom-0 inset-x-0 max-h-[78vh] rounded-t-3xl border-t
                          md:bottom-0 md:top-0 md:inset-x-auto md:end-0 md:h-full md:max-h-full md:w-[420px] md:rounded-none md:border-s md:border-t-0">
            <div className="px-5 py-4 border-b border-[#dce2f3] dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <FiMessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <h3 className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">
                  {notePanel.id ? t('library.annotations.editNote') : t('library.annotations.addNote')}
                </h3>
              </div>
              <Tooltip label={t('tooltips.close')}>
                <button
                  onClick={() => setNotePanel(null)}
                  aria-label={t('tooltips.close')}
                  className="w-8 h-8 rounded-lg text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {(() => {
                const [s, a] = notePanel.verseKey.split(':').map(Number);
                return (
                  <p className="text-xs font-semibold text-[#404944] dark:text-gray-300">
                    {surahLabelFor(s)} · {t('library.verseLabel', { n: fmtNum(a) })}
                  </p>
                );
              })()}
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                maxLength={2000}
                rows={8}
                dir="auto"
                placeholder={t('library.annotations.notePlaceholder')}
                className="w-full rounded-xl border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#9aa3a0] dark:text-gray-600">{fmtNum(noteDraft.length)} / {fmtNum(2000)}</span>
                <div className="flex items-center gap-2">
                  {notePanel.id && (
                    <button
                      onClick={deleteNote}
                      disabled={savingNote}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ba1a1a] dark:text-red-400 border border-red-200 dark:border-red-900/50 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" /> {t('library.annotations.delete')}
                    </button>
                  )}
                  <button
                    onClick={saveNote}
                    disabled={savingNote}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {t('library.annotations.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Read a free-form text note (its icon was tapped outside draw mode). The
          text never renders on the page itself — only here, read-only. */}
      {readTextNote && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setReadTextNote(null)}
          />
          <div className="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl border-[#dce2f3] dark:border-gray-700 flex flex-col
                          bottom-0 inset-x-0 max-h-[78vh] rounded-t-3xl border-t
                          md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:inset-x-auto md:start-1/2 md:-translate-x-1/2 md:w-[420px] md:max-h-[70vh] md:rounded-2xl md:border">
            <div className="px-5 py-4 border-b border-[#dce2f3] dark:border-gray-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <FiMessageSquare className={`w-4 h-4 shrink-0 mushaf-text-note--${readTextNote.color}`} />
                <h3 className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">
                  {t('library.draw.noteTitle')}
                </h3>
              </div>
              <Tooltip label={t('tooltips.close')}>
                <button
                  onClick={() => setReadTextNote(null)}
                  aria-label={t('tooltips.close')}
                  className="w-8 h-8 rounded-lg text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p dir="auto" className="text-sm leading-relaxed text-[#1A1A1A] dark:text-gray-100 whitespace-pre-wrap break-words">
                {readTextNote.text}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Draw toolbar — a dropdown anchored under the active page's pencil button.
          Opens with draw mode, stays open while drawing, closes on Done/Escape/exit. */}
      {drawPage != null && (
        <div
          ref={drawMenuRef}
          data-testid="draw-menu"
          style={{ top: drawMenuPos.top, left: drawMenuPos.left }}
          className="fixed z-40 bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-600 shadow-xl p-2 flex flex-col gap-1.5 select-none"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tools row */}
          <div className="flex items-center gap-1">
            {[
              { k: 'pen', icon: FiPenTool, label: t('library.draw.pen') },
              { k: 'highlighter', icon: FiEdit3, label: t('library.draw.highlighter') },
              { k: 'text', icon: FiType, label: t('library.draw.text') },
              { k: 'eraser', icon: FiDelete, label: t('library.draw.eraser') },
            ].map((tl) => {
              const ToolIcon = tl.icon;
              return (
                <Tooltip key={tl.k} label={tl.label}>
                  <button
                    type="button"
                    onClick={() => setDrawTool(tl.k)}
                    aria-label={tl.label}
                    aria-pressed={drawTool === tl.k}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      drawTool === tl.k ? 'bg-[#004f35] text-white' : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                    }`}
                  >
                    <ToolIcon className="w-4 h-4" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
          {/* Colours row (hidden for the eraser) */}
          {drawTool !== 'eraser' && (
            <div className="flex items-center gap-2 px-1 py-0.5">
              {DRAW_COLORS.map(({ key, cls, labelKey }) => (
                <Tooltip key={key} label={t(labelKey)}>
                  <button
                    type="button"
                    onClick={() => setDrawColor(key)}
                    aria-label={t(labelKey)}
                    aria-pressed={drawColor === key}
                    className={`w-6 h-6 rounded-full transition-transform ${cls} ${
                      drawColor === key
                        ? 'ring-2 ring-offset-1 ring-[#004f35] dark:ring-emerald-400 dark:ring-offset-gray-800 scale-110'
                        : 'ring-1 ring-black/10 dark:ring-white/25 hover:scale-110'
                    }`}
                  />
                </Tooltip>
              ))}
            </div>
          )}
          {/* Actions row */}
          <div className="flex items-center gap-1 border-t border-[#dce2f3] dark:border-gray-700 pt-1.5">
            <Tooltip label={t('library.draw.undo')}>
              <button type="button" onClick={undoStroke} disabled={undoStackRef.current.length === 0} aria-label={t('library.draw.undo')}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <FiRotateCcw className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label={t('library.draw.redo')}>
              <button type="button" onClick={redoStroke} disabled={redoStackRef.current.length === 0} aria-label={t('library.draw.redo')}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <FiRotateCw className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label={t('library.draw.clear')}>
              <button type="button" onClick={() => setClearConfirm(true)} disabled={drawStrokes.length === 0} aria-label={t('library.draw.clear')}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#ba1a1a] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors">
                <FiTrash2 className="w-4 h-4" />
              </button>
            </Tooltip>
            <span className="flex-1" />
            <Tooltip label={t('library.draw.done')}>
              <button type="button" onClick={exitDraw} aria-label={t('library.draw.done')}
                className="h-9 px-3 rounded-xl flex items-center justify-center gap-1.5 bg-[#004f35] text-white hover:bg-[#003527] transition-colors text-xs font-semibold">
                <FiCheck className="w-4 h-4" /> {t('library.draw.done')}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Confirm before wiping a page's ink */}
      <ConfirmModal
        isOpen={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={clearDrawing}
        title={t('library.draw.clearTitle')}
        message={t('library.draw.clearMessage')}
        confirmText={t('library.draw.clear')}
        isDanger
      />

      {/* Full 7-step method, reused from the dashboard guide */}
      <HowToMemorizeModal isOpen={howToOpen} onClose={() => setHowToOpen(false)} />

      <Footer />
    </div>
  );
}
