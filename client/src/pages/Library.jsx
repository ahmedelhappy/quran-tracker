import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward, FiX,
  FiBookOpen, FiChevronLeft, FiChevronRight, FiChevronDown, FiAlertCircle, FiHeadphones, FiInfo, FiMove,
  FiEye, FiEyeOff, FiHelpCircle, FiCheckSquare, FiSquare, FiFile, FiColumns,
  FiMaximize2, FiMinimize2, FiCheckCircle, FiCircle, FiBookmark, FiTrash2, FiPlus, FiMapPin,
  FiFlag, FiMessageSquare, FiCornerUpRight, FiSlash,
  FiPenTool, FiEdit2, FiEdit3, FiRotateCcw, FiRotateCw, FiCheck, FiDroplet, FiType, FiRepeat,
} from 'react-icons/fi';
// Feather has no eraser; this one actually looks like the thing it does.
import { BsEraser } from 'react-icons/bs';
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
import MushafZoomControl from '../components/MushafZoomControl';
import ReciterPicker from '../components/ReciterPicker';
import { startLibraryTour, startVerseActionsCoachmark } from '../components/libraryTour';
import { progressAPI, bookmarksAPI, annotationsAPI } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { loginPathFor } from '../utils/returnTo';
import {
  fetchPageTafsir,
  fetchEditionAyahTafsir,
  findTafsirRun,
  getAyahAudioUrl,
  getFallbackAyahAudioUrl,
  ayahWarmMethod,
  getLeadingSilenceMs,
  toArabicDigits,
  resolveReciterId,
  TAFSIR_EDITIONS,
} from '../services/quranApi';
import { verseEdges, peekVerseEdges, matchesDuration } from '../services/verseEdges';
import { fetchMushafPage, ensurePageFont, decodePageFont, takeReadyPages, mushafFontFamily, peekMushafPage } from '../services/mushafApi';
import { setPrefetchFocus, holdPrefetch, resumePrefetch, stopPrefetch } from '../services/pagePrefetch';
import { SURAH_PAGES } from '../data/surahPages';
import {
  TOTAL_AYAHS, ordOf, ordOfKey, keyOfOrd, verseOfOrd, pageOfOrd, ayahCount,
} from '../utils/verseIndex';
import { useDraggable } from '../hooks/useDraggable';
import { useMushafZoom } from '../hooks/useMushafZoom';
import { isShortcutKey } from '../utils/shortcutKeys';
import { hideModeStep, isSecondaryPress } from '../utils/selfTestCycle';

const JUZ_START_PAGES = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582,
];

const clampPage = (n) => Math.max(1, Math.min(604, Number(n) || 1));
const SIDEBAR_WIDTH = 288;   // lg:w-72 — the offset the sidebar's edge tab rides to

// "Clicking off the verse" has to mean clicking EMPTY SPACE. Reaching for the
// tafsir panel, the sidebar, the audio bar or any control is the reader doing
// something WITH the verse they picked — throwing the selection away there made
// the panels almost unusable. Anything matching this keeps the selection exactly
// as it is; only bare background walks the select -> hide -> deselect ladder.
const KEEPS_VERSE_SELECTION = [
  'button', 'a', 'input', 'select', 'textarea', 'label',
  '[role="button"]', '[role="separator"]', '[contenteditable="true"]',
  'aside', 'header', '[data-keeps-selection]',
].join(', ');

// The reader's two panel handles: a small tab hugging one edge of the viewport,
// rounded on its inner side only so it reads as something tucked against the edge.
// `edge` is logical ('start' | 'end'), so the pair mirrors itself in Arabic.
const READER_EDGE_TAB = (edge) =>
  'inline-flex items-center justify-center w-6 h-14 shadow-md backdrop-blur transition-colors ' +
  'bg-white/95 dark:bg-gray-800/95 border border-[#dce2f3] dark:border-gray-700 ' +
  'text-[#004f35] dark:text-emerald-400 hover:bg-white dark:hover:bg-gray-700 ' +
  (edge === 'start'
    ? 'rounded-e-lg border-s-0'
    : 'rounded-s-lg border-e-0');
const EMPTY_SET = new Set(); // stable empty set for the hidden-annotations state
// The mushaf word under a screen point, looking THROUGH whatever covers it (the
// ink layer while annotating).
const wordAtPoint = (x, y) => document.elementsFromPoint(x, y)
  .map((el) => el.closest?.('.mushaf-word[data-verse-key]'))
  .find(Boolean) ?? null;
const REP_COUNTS = [2, 3, 5, Infinity]; // repeat-count choices (verse & range)
// The PER-VERSE count inside a range needs one more choice than those: ×1, "say
// each verse once and move on", which is what range repeat did before it could
// repeat verses too. Without it a range could no longer be played straight through.
const RANGE_VERSE_COUNTS = [1, ...REP_COUNTS];

// Drag-across-verses range picking (see the block in the component).
const RANGE_DRAG_SLOP = 5;      // px before a press counts as a drag rather than a tap
const RANGE_TOUCH_HOLD = 400;   // ms a finger must rest before it starts picking
const RANGE_EDGE_W = 64;        // px of the viewport's sides that count as "at the edge"
const RANGE_EDGE_DWELL = 550;   // ms the pointer must stay there before the page turns
const RANGE_EDGE_REPEAT = 900;  // ms between further turns while it stays there
const RANGE_SCROLL_EDGE = 40;   // px of a ZOOMED page's visible edge that scrolls it during a drag
const RANGE_SCROLL_SPEED = 18;  // px per frame at the very edge

// The verse-to-verse handover (see the effect that schedules it in the component).
// The guess is only used until this device's own play()-to-sound delay has been
// measured, and it is deliberately LOW: guessing short starts the next verse a hair
// late, never early. The margin aims every start a little late for the same reason.
const HANDOVER_LATENCY_GUESS_MS = 20;
const HANDOVER_MARGIN_MS = 8;
// Measured silence is never used right up to the sound beside it: this much of it is
// left alone, against the edge of a 10 ms analysis window landing on a fading letter.
const EDGE_GUARD_MS = 30;
// What the 'tight' pause setting trims the silence between two verses down to.
const TIGHT_PAUSE_MS = 150;
// How much leading digital silence is an encoder's doing rather than the recording's:
// within 50 ms of the reciter's measured floor (getLeadingSilenceMs) — 15-86 ms across
// the reciters here, measured 2026-10-13 — and never over 100 ms (one reciter's encode
// runs to 146 ms and simply keeps the remainder).
const ENCODER_DELAY_SPREAD_MS = 50;
const ENCODER_DELAY_MAX_MS = 100;
// The leading-silence lead was measured with Chrome's decoder; another engine may
// trim an MP3's start differently, so elsewhere the next verse just starts on time.
const HANDOVER_LEAD_OK = typeof navigator !== 'undefined'
  && !!navigator.userAgentData?.brands?.some((b) => b.brand === 'Chromium');

// The four highlight colours offered in the verse popover (must match the
// server's Annotation color enum). `cls` is the swatch's fill in the picker.
const ANNOTATION_COLORS = [
  { key: 'yellow', cls: 'bg-yellow-300', labelKey: 'library.annotations.colorYellow' },
  { key: 'green',  cls: 'bg-emerald-300', labelKey: 'library.annotations.colorGreen' },
  { key: 'blue',   cls: 'bg-blue-300', labelKey: 'library.annotations.colorBlue' },
  { key: 'pink',   cls: 'bg-pink-300', labelKey: 'library.annotations.colorPink' },
];

// The undo history keeps this many steps (ink strokes and verse annotations).
const HISTORY_CAP = 50;
// The most verses one change can touch — the server's batch limit (MAX_BATCH_OPS).
const MAX_SPAN_OPS = 300;
// How long an annotation's "saved — Undo" toast stays (the timer pauses on hover).
const UNDO_TOAST_MS = 6000;

// Ink colours offered in the drawing toolbar — the highlight enum plus a dark-ink
// pen (must match the server's stroke-colour set).
const DRAW_COLORS = [
  { key: 'ink',    cls: 'bg-gray-800 dark:bg-gray-200', labelKey: 'library.annotations.colorInk' },
  { key: 'yellow', cls: 'bg-yellow-300', labelKey: 'library.annotations.colorYellow' },
  { key: 'green',  cls: 'bg-emerald-300', labelKey: 'library.annotations.colorGreen' },
  { key: 'blue',   cls: 'bg-blue-400', labelKey: 'library.annotations.colorBlue' },
  { key: 'pink',   cls: 'bg-pink-400', labelKey: 'library.annotations.colorPink' },
];

// The annotate toolbar's tools, in print order, each with the two keys that
// select it: a letter and a number. Both are part of the tool's own tooltip, the
// number is also badged on its button, and pressing (or clicking) the tool that
// is already active stops annotating — see selectTool. The order IS the
// numbering: a tool's position in the toolbar matches its number (the text note
// used to sit before the eraser — swap those two lines back to restore that).
const DRAW_TOOLS = [
  { k: 'pen',         key: 'p', num: '1', icon: FiPenTool, labelKey: 'library.draw.pen' },
  { k: 'highlighter', key: 'h', num: '2', icon: FiEdit3,   labelKey: 'library.draw.highlighter' },
  { k: 'eraser',      key: 'e', num: '3', icon: BsEraser,  labelKey: 'library.draw.eraser' },
  { k: 'text',        key: 't', num: '4', icon: FiType,    labelKey: 'library.draw.text' },
];
// The tool a key event selects, or null — by its letter or its number, through
// the same layout-proof matching (physical key OR produced character, Arabic-Indic
// digits included), so this works on a non-Latin layout too — see
// utils/shortcutKeys.js.
const toolForKey = (e) =>
  DRAW_TOOLS.find((tl) => isShortcutKey(e, tl.key) || isShortcutKey(e, tl.num))?.k ?? null;

// The ayah's plain Uthmani text (basmala excluded), used for the legible
// tafsir-panel preview. Taken verse-level from the API — word-level text is no
// longer fetched (it corrupts boundary page numbers; see mushafApi fetch note).
const verseText = (verse) => verse.textUthmani ?? '';

// One repeat count, under its own words. The nested counts are only usable if it
// is obvious which is which, so each gets a full-width label of its own rather
// than sharing a "Times" caption with a row of numbers beside it.
function RepeatCountRow({ label, counts, value, onChange, fmtNum, testId }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#707974] dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5" data-testid={testId} role="group" aria-label={label}>
        {counts.map((n) => (
          <button
            key={String(n)}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`flex-1 text-xs font-bold rounded-md py-1 border transition-colors ${
              value === n ? 'bg-[#004f35] text-white border-[#004f35]' : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300'
            }`}
          >
            {n === Infinity ? '∞' : `×${fmtNum(n)}`}
          </button>
        ))}
      </div>
    </div>
  );
}

// One end of the repeat range. Any verse of the Quran is reachable, so this is a
// surah picker plus that surah's ayah picker — two short lists — rather than one
// flat list of all 6236 verses. Value in / out is the global ayah number.
function VerseRangePicker({ label, surahName, ayahName, ord, onChange, surahLabelFor, fmtNum, selectCls }) {
  const v = verseOfOrd(ord) ?? { surahNumber: 1, ayahNumber: 1 };
  const count = ayahCount(v.surahNumber);
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#707974] dark:text-gray-500">{label}</span>
      {/* A grid, not a flex row: the shared select class already carries w-full,
          which would beat any width utility added here. Each select simply fills
          its own column — wide for the surah, narrow for the ayah — and the
          columns flip with the writing direction on their own. */}
      <div className="grid grid-cols-[1fr_4.5rem] items-center gap-1.5 min-w-0">
        <select
          value={v.surahNumber}
          aria-label={surahName}
          // Keep the ayah in range when the surah shrinks under it.
          onChange={(e) => {
            const s = Number(e.target.value);
            onChange(ordOf(s, Math.min(v.ayahNumber, ayahCount(s))));
          }}
          className={`${selectCls} min-w-0 px-2`}
        >
          {SURAH_PAGES.map((s) => (
            <option key={s.number} value={s.number}>{`${fmtNum(s.number)}. ${surahLabelFor(s.number)}`}</option>
          ))}
        </select>
        <select
          value={v.ayahNumber}
          aria-label={ayahName}
          onChange={(e) => onChange(ordOf(v.surahNumber, Number(e.target.value)))}
          className={`${selectCls} min-w-0 px-2`}
        >
          {Array.from({ length: count }, (_, i) => i + 1).map((a) => (
            <option key={a} value={a}>{fmtNum(a)}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

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
  const fmtNum = useCallback((n) => (isArabic ? toArabicDigits(n) : String(n)), [isArabic]);

  // The reader is public: anyone can read, listen, look up tafsir, self-test and
  // zoom. Everything that belongs to an ACCOUNT — the memorized ticks, marking
  // verses, bookmarks, annotations, the hard list — is hidden and, more
  // importantly, never REQUESTED while signed out: one 401 would clear the token
  // and bounce the visitor to the login page (see the interceptor in api.js).
  const { user, loading: authLoading } = useAuth();
  const signedIn = !!user;
  // Callbacks fired from events read this rather than closing over the flag.
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const location = useLocation();

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = clampPage(searchParams.get('page') ?? 1);
  const [pageInput, setPageInput] = useState(String(currentPage));
  // The go-to field follows the page. Adjusted during render rather than in an
  // effect, so a page turn doesn't spend a second commit on it.
  const [pageInputFor, setPageInputFor] = useState(currentPage);
  if (pageInputFor !== currentPage) {
    setPageInputFor(currentPage);
    setPageInput(String(currentPage));
  }

  // Whether the URL already named a page when Library first mounted — captured
  // once so an explicit ?page (dashboard links, bookmarks, deep links) always
  // wins, and so this doesn't re-fire on later in-app navigation (goToPage
  // always writes an explicit page, so there's never a "default" to resolve
  // again). Gates the page-content fetch below until the default (if any) is
  // resolved, so we never briefly load page 1 before jumping to the real target.
  const hadExplicitPageRef = useRef(searchParams.has('page'));
  const [pageResolved, setPageResolved] = useState(hadExplicitPageRef.current);
  // The page the reader last had open, read at the FIRST render — before any
  // effect (including the one that persists it) can touch it. That ordering is
  // the whole point: this value is what a bare /library opens on.
  const [lastOpenedPage] = useState(() => {
    const stored = Number(localStorage.getItem('lastMushafPage'));
    return stored >= 1 && stored <= 604 ? stored : null;
  });

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

  // ── The sidebar is shown or hidden explicitly, by its own toggle (or 'S').
  // This replaces the old focus mode: the page header is gone for everyone now,
  // so "focus" had nothing left to hide that this doesn't.
  //
  // Opening the tafsir hides it automatically to hand over the room — but only as
  // a DEFAULT. `userSetSidebarRef` records that the reader chose for themselves,
  // and from then on their choice wins: show the sidebar with the tafsir open and
  // both stay docked, and closing the tafsir won't undo it.
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('mushafSidebar') !== '0');
  const sidebarOpenRef = useRef(sidebarOpen);
  const userSetSidebarRef = useRef(false);
  const sidebarBeforeTafsirRef = useRef(null);
  useEffect(() => { sidebarOpenRef.current = sidebarOpen; }, [sidebarOpen]);

  // An explicit show/hide: remembered across visits, and it outranks the
  // automatic hide above.
  const setSidebarByUser = useCallback((next) => {
    userSetSidebarRef.current = true;
    setSidebarOpen(next);
    localStorage.setItem('mushafSidebar', next ? '1' : '0');
  }, []);
  const toggleSidebarRef = useRef(null);

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
  // Per-row actions: which row is being renamed inline (and its draft), and the
  // pending replace/remove confirm.
  const [renamingBookmarkId, setRenamingBookmarkId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [bookmarkConfirm, setBookmarkConfirm] = useState(null); // { kind: 'replace' | 'remove', bookmark, conflict?, page? }
  const renameSettledRef = useRef(false);  // Enter/Escape and the blur that follows must settle a rename once
  const bookmarkRowRefs = useRef(new Map()); // bookmark id → its <li>, to put focus back on one of its buttons

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
  // Annotate mode is on while drawPage != null. drawPage is the ANCHOR page — the
  // one whose pencil started it, and where the toolbar hangs — but EVERY visible
  // page is annotatable, so a spread can be drawn on across both halves without
  // stopping to re-arm. That means the working strokes, the undo history and the
  // unsaved-changes flags are all kept per page.
  const [drawPage, setDrawPage] = useState(null);
  const [drawStrokesByPage, setDrawStrokesByPage] = useState({});
  const [drawTool, setDrawTool] = useState('pen'); // 'pen' | 'highlighter' | 'eraser' | 'text'
  const [drawColor, setDrawColor] = useState('ink');
  const [clearConfirm, setClearConfirm] = useState(false);
  const drawDirtyRef = useRef(new Set());     // pages with unsaved strokes
  const drawSaveTimerRef = useRef(null);
  const drawStrokesRef = useRef({});          // page -> strokes, synchronous mirror
  const undoStacksRef = useRef({});           // page -> past snapshots (cap 50)
  const redoStacksRef = useRef({});
  // Undo, redo and clear act on the page last drawn on — in a spread, "the page
  // I am working on" is the one the ink just went onto.
  const lastDrawnPageRef = useRef(null);
  const [, bumpHistory] = useReducer((n) => n + 1, 0); // re-render undo/redo enabled state
  // Lets the keyboard handler (declared before these callbacks) reach the latest
  // exit/undo/redo without pulling later-declared callbacks into its deps.
  const exitDrawRef = useRef(null);
  const undoRef = useRef(null);
  const redoRef = useRef(null);
  const drawWidth = drawTool === 'highlighter' ? 22 : 3;
  // Draw toolbar = a dropdown anchored under the active page's pencil button.
  // Whether that MENU is open is deliberately a separate thing from whether
  // annotate mode is on: collapsing the toolbar (click outside, Escape, the
  // pencil again) leaves the reader still drawing, with the collapsed chip
  // saying which tool is live.
  const drawAnchorRef = useRef(null);          // the active pencil button
  const drawMenuRef = useRef(null);            // the dropdown panel (or collapsed chip)
  const [drawMenuOpen, setDrawMenuOpen] = useState(false);
  const [drawMenuPos, setDrawMenuPos] = useState({ top: 0, left: 0 });
  // Lets the keyboard handler (declared before it) reach the latest selectTool.
  const selectToolRef = useRef(null);

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
  // A saved id from an older build always resolves; one this build doesn't know
  // quietly becomes the default.
  const [reciter, setReciter] = useState(() => resolveReciterId(localStorage.getItem('reciter')));
  // The verse being recited, as a GLOBAL ayah number (1–6236) rather than an index
  // into `verses`: playback has to be able to name verses that aren't on screen —
  // a repeat range ending two pages later, or plain continuous recitation running
  // past the page break. The reader follows the recitation to its page (below).
  const [playingOrd, setPlayingOrd] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [audioError, setAudioError] = useState(false);
  // The audio CDN 502s on a COLD file and then serves the very same URL fine.
  // Measured against cdn.islamic.network: a first request to an ayah nobody has
  // fetched lately comes back 502, and every retry after it is a 200 — the origin
  // fails while the edge fills, then the file is there. Across five reciters and a
  // spread of 22 ayahs the failures moved around between runs, which is the same
  // story from the other side. So ONE failure does not mean "this verse has no
  // recitation", and treating it as fatal is exactly what produced "failed to
  // play" on verses that play perfectly a second later.
  //
  // The corollary took longer to see, and it is what made the recitation stall
  // rather than recover: the PREFETCH is by definition always the cold request. The
  // verse now sounding was fetched a verse ago, so its edge is warm; the only file
  // nobody has touched yet is the next one. Every cold 502 therefore lands on the
  // prefetch — precisely the request the retry below used to walk away from.
  //
  // Two budgets, because the two failures cost different things. A prefetch giving up
  // is invisible: the verse is simply loaded again on the active element when it comes
  // round, with a fresh budget behind it. The ACTIVE verse giving up is what the
  // reader sees, so that is the one worth being patient with. Measured against this
  // CDN, a cold file turned 200 somewhere between its 2nd and 8th request, and three
  // retries sat under that — a verse this reader had already been told was broken
  // answered 200 on the very next request made for it.
  const AUDIO_RETRIES_ACTIVE = 6;
  const AUDIO_RETRIES_PREFETCH = 3;
  const AUDIO_RETRY_MS = 400;
  // Some files the primary cannot serve at all, however often it is asked (three
  // stayed 502 across ten attempts on 2026-09-12). For the verse the reader is
  // waiting on, a verse whose ACTIVE budget is spent gets one more road: the same
  // recording from a second source (getFallbackAyahAudioUrl — verified
  // byte-identical, see quranApi.js), with a short budget of its own. The primary
  // stays first for every load; the prefetch never falls back — it has nobody
  // waiting on it, and its verse gets a fresh primary budget when it becomes active.
  const AUDIO_RETRIES_FALLBACK = 2;
  // Two <audio> elements, ping-ponged: while one plays, the other preloads the verse
  // that comes next, so the handoff costs no fetch and no decode — that is what
  // removes the audible gap between verses.
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const activeBufRef = useRef(0);
  // What each buffer holds AND how far it actually got. An ordinal on its own was
  // not enough: it recorded the INTENT to load a verse, so a handover that trusted
  // it would adopt an element whose download had 502'd and then sit in silence
  // forever. `status` is what the element achieved — 'loading' until it reports it
  // can play, 'ready' once it has, 'failed' when the load broke — and only a
  // 'ready' buffer may ever be swapped into.
  const bufStateRef = useRef([{ ord: null, status: 'idle' }, { ord: null, status: 'idle' }]);
  // Retry bookkeeping per BUFFER, so the prefetch gets its own budget and its own
  // backoff rather than sharing the active element's. `fallback` marks that this
  // buffer's verse has moved on to the second source.
  const audioRetryRef = useRef([{ ord: null, tries: 0, timer: null, fallback: false }, { ord: null, tries: 0, timer: null, fallback: false }]);
  const bufEl = (i) => (i === 0 ? audioARef.current : audioBRef.current);
  const activeEl = () => bufEl(activeBufRef.current);
  const bufIndexOf = (el) => (el && el === audioARef.current ? 0 : el && el === audioBRef.current ? 1 : -1);
  const bufHolds = (i, ord) => ord != null && bufStateRef.current[i].ord === ord;
  const bufReady = (i, ord) => bufHolds(i, ord) && bufStateRef.current[i].status === 'ready';
  const markBuf = (i, ord, status) => { bufStateRef.current[i] = { ord, status }; };
  // Retry timers and play() rejections land a beat after the render that armed them,
  // so they read the live values through refs instead of a stale closure.
  const isPlayingRef = useRef(false);
  const playingOrdRef = useRef(null);
  const reciterRef = useRef(reciter);
  const playbackRateRef = useRef(1);
  // The watchdog's clock: when the active element last proved it was still moving.
  const lastProgressRef = useRef(0);
  const STALL_MS = 2500;
  // The handover (see the effect that schedules it, below the stall watchdog): the
  // next verse's element is started a beat before the current one runs out, so it is
  // heard as that one finishes. preStartRef holds such an early start until the
  // current verse's `ended` commits it; the start-latency samples are start-to-sound
  // delays measured on this device; concurrentOk drops to false for the session if
  // the platform ever pauses one element because the other one started.
  const preStartRef = useRef(null);       // { idx, ord } while the next verse sounds early
  const latencyProbeRef = useRef(null);   // { idx, at, from, got } a start being timed
  const startLatencyRef = useRef([]);     // recent start → audible delays, ms
  const concurrentOkRef = useRef(true);
  const letGoRef = useRef(null);          // { idx, at } a verse the 'tight' setting stopped early
  const handleEndedRef = useRef(null);    // the current render's handleEnded, for timers

  // ── Playback speed (persisted) ──────────────────────────
  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const [playbackRate, setPlaybackRate] = useState(() => {
    const v = parseFloat(localStorage.getItem('playbackRate'));
    return SPEEDS.includes(v) ? v : 1;
  });
  // The pause between verses (persisted): 'natural' plays the reciter's pause exactly as
  // recorded; 'tight' trims the silence at the two edges of each handover down to about
  // TIGHT_PAUSE_MS, never into a word. See the handover effect.
  const [versePause, setVersePause] = useState(() => (localStorage.getItem('versePause') === 'tight' ? 'tight' : 'natural'));
  useEffect(() => { localStorage.setItem('versePause', versePause); }, [versePause]);

  // Kept current during render, so a timer or a promise callback never acts on a
  // value from the render that scheduled it.
  isPlayingRef.current = isPlaying;
  playingOrdRef.current = playingOrd;
  reciterRef.current = reciter;
  playbackRateRef.current = playbackRate;

  // ── Repetition for memorization ─────────────────────────
  // 'off' → continuous whole-Quran auto-advance. 'verse' → repeat the current
  // verse N times then advance. 'range' → work through [rangeStartOrd..rangeEndOrd]
  // and loop it M times, with the two counts NESTED: each verse of the range is
  // said `rangeVerseRepeat` times before the range moves on, and the whole range
  // then runs `rangeRepeat` times. That nesting is how the memorisation actually
  // goes — drill a verse, join it to its neighbours, then run the passage again.
  const [repeatMode, setRepeatMode] = useState('off');
  const [repeatOpen, setRepeatOpen] = useState(false);
  const repeatMenuRef = useRef(null);
  const [verseRepeat, setVerseRepeat] = useState(3);      // 2 | 3 | 5 | Infinity
  // The range is addressed by GLOBAL ayah number, so it can start on the verse in
  // front of the reader and end pages later; playback turns the pages itself.
  const [rangeStartOrd, setRangeStartOrd] = useState(1);
  const [rangeEndOrd, setRangeEndOrd] = useState(1);
  const [rangeRepeat, setRangeRepeat] = useState(3);
  // The inner count of the nesting. Starts at 1 — a range played straight through,
  // exactly what range repeat meant before — so nobody's saved habit changes shape
  // the first time they open the panel after this.
  const [rangeVerseRepeat, setRangeVerseRepeat] = useState(1);
  const repeatsDoneRef = useRef(0);   // times the current verse has finished
  const rangePassesRef = useRef(0);   // completed passes over the range
  // handleEnded reads those two through the refs, so it can never act on a stale
  // closure. The audio bar has to SHOW them as well — "verse 2 of 5 · pass 1 of 3",
  // otherwise a nested repeat is impossible to follow by ear — so every write goes
  // through these setters, which keep a state mirror for the display alongside.
  const [repeatsDone, setRepeatsDoneUI] = useState(0);
  const [rangePasses, setRangePassesUI] = useState(0);
  const setRepeatsDone = useCallback((n) => { repeatsDoneRef.current = n; setRepeatsDoneUI(n); }, []);
  const setRangePasses = useCallback((n) => { rangePassesRef.current = n; setRangePassesUI(n); }, []);
  // Set just before a page turn that PLAYBACK asked for, so the turn doesn't stop
  // the recitation the way a manual turn does.
  const followTurnRef = useRef(false);
  // Set the moment the READER turns the page themselves. Playback keeps sounding
  // through it, but from then on it stops STEERING the view: they went to look at
  // something, and being dragged back mid-ayah is not what "keep playing" means.
  // Cleared whenever playback is deliberately (re)aimed — see playOrd / stepVerse.
  const readerLedRef = useRef(false);
  // The same idea for the SELECTION: set before a page turn that stepping the
  // selection asked for, so the turn keeps the selection and the tafsir panel.
  // pendingSelectRef holds the verseKey to land on once that page's verses are in.
  const selectTurnRef = useRef(false);
  const pendingSelectRef = useRef(null);
  // The selection can also ride along with the recitation (see the follower
  // below). recitedOrd is the last verse it actually followed to, and
  // followingAudio says the two are still in step — which is what lets a
  // playback-driven page turn keep the selection instead of clearing it.
  const recitedOrdRef = useRef(null);
  const followingAudioRef = useRef(false);
  const selectedKeyRef = useRef(null);

  // ── Verse selection + tafsir state (verses addressed by stable verseKey) ──
  const [selectedVerseKey, setSelectedVerseKey] = useState(null);
  // The tafsir panel FOLLOWS the selection but does not share its life. Picking a
  // verse moves the panel onto it; LOSING the selection does not move it back off:
  // deselecting, clicking empty space, or reaching for the pencil (enterDraw clears
  // the selection so the popover can't fire over the ink) all leave the panel
  // showing the verse it already had. Nobody who starts annotating has asked to
  // stop reading the tafsir. Only closing the panel, or picking another verse,
  // changes it — and because the flow stays ONE-WAY (selection → panel) there is
  // still no pair of effects syncing each other into a render loop.
  const [tafsirVerseKey, setTafsirVerseKey] = useState(null);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsirEdition, setTafsirEdition] = useState(() => {
    const saved = localStorage.getItem('tafsirEdition');
    return TAFSIR_EDITIONS.some(e => e.id === saved) ? saved : TAFSIR_EDITIONS[0].id;
  });
  // How wide the docked tafsir panel is, in px, remembered across visits. Only
  // meaningful from lg up, where the panel is a column of the layout; below that
  // it is a full-width sheet / fixed overlay and this is ignored.
  const TAFSIR_MIN_W = 300;
  const TAFSIR_MAX_W = 720;
  const [tafsirWidth, setTafsirWidth] = useState(() => {
    const saved = Number(localStorage.getItem('tafsirPanelWidth'));
    return saved >= TAFSIR_MIN_W && saved <= TAFSIR_MAX_W ? saved : 400;
  });
  const [tafsirResizing, setTafsirResizing] = useState(false);
  const [tafsirText, setTafsirText] = useState('');
  // { from, to } when the edition returned one block for a run of verses rather
  // than for this verse alone — see findTafsirRun. null when it is per-ayah.
  const [tafsirRun, setTafsirRun] = useState(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState(false);
  const [tafsirReloadKey, setTafsirReloadKey] = useState(0);

  // Verse action popover — placed near the selection each time, then draggable via
  // the grip (current instance only, so no persisted position).
  const { ref: popoverRef, style: popoverDragStyle, setPos: setPopoverPos, dragHandlers: popoverDragHandlers } = useDraggable(null);
  useEffect(() => { localStorage.removeItem('versePopoverPos'); }, []); // drop the old persisted spot
  const lastPointerRef = useRef(null);   // last pointer-down in the reader (for placement)
  const placeNextRef = useRef(false);    // re-place the popover only after a word click
  // The popover can be dismissed WITHOUT dropping the selection: the verse stays
  // highlighted and the tafsir panel keeps tracking it. Tapping the verse again
  // brings the actions back (and a hint above the mushaf says so).
  const [popoverHidden, setPopoverHidden] = useState(false);
  // A picked SPAN of verses is a selection in its own right, and it has to behave
  // like one: a span you cannot get rid of is worse than no span at all. So it sits
  // here beside the single-verse selection and goes away exactly the ways that one
  // does — click a verse, click off the page, press Escape.
  //
  // Deliberately NOT read off `repeatMode === 'range'`, which is what the band used
  // to be: clearing what is DRAWN must not throw away the range that repeat is set
  // to play. `setRange` further down keeps the two pointed at the same verses
  // whenever the reader picks a range, which is the only time they should agree.
  // Only ever one of this and `selectedVerseKey` is set — picking either clears
  // the other — so nothing has to decide which of the two a gesture meant.
  // `actions: true` while the span's actions popover is up (a right-click inside
  // it). Every new span is a new object without it, so a fresh span never opens
  // its actions by itself.
  const [rangeSelection, setRangeSelection] = useState(null);   // { startOrd, endOrd, actions? }
  const rangeSelectionRef = useRef(null);
  useEffect(() => { rangeSelectionRef.current = rangeSelection; }, [rangeSelection]);
  // Bumped on every request for actions, so the popover re-places under the new
  // press even when it was already open (a second right-click inside the span).
  const [popoverPlaceTick, setPopoverPlaceTick] = useState(0);

  // ── Contextual onboarding (driver.js) ────────────────────
  const tourRef = useRef(null);
  const tourActiveRef = useRef(false);
  // A render-visible mirror of the ref: the auto-hiding navbar has to know a tour
  // is running so it doesn't fade out from under a walkthrough that scrolls the
  // page around. Refs don't re-render, so the flag has to be state as well.
  const [tourActive, setTourActive] = useState(false);
  const markTour = useCallback((on) => { tourActiveRef.current = on; setTourActive(on); }, []);
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
  useEffect(() => { toggleSidebarRef.current = () => setSidebarByUser(!sidebarOpenRef.current); }, [setSidebarByUser]);

  // Docking the tafsir takes the sidebar's room, so opening it hides the sidebar
  // — as a DEFAULT only. Show the sidebar again and that choice sticks: both stay
  // docked side by side, and closing the tafsir won't undo it. Closing the tafsir
  // otherwise puts the sidebar back exactly as it was before.
  useEffect(() => {
    const docked = tafsirOpen && isWide;
    if (docked) {
      if (sidebarBeforeTafsirRef.current != null) return;   // already handled this opening
      sidebarBeforeTafsirRef.current = sidebarOpenRef.current;
      userSetSidebarRef.current = false;
      setSidebarOpen(false);
      return;
    }
    if (sidebarBeforeTafsirRef.current == null) return;
    const previous = sidebarBeforeTafsirRef.current;
    sidebarBeforeTafsirRef.current = null;
    if (!userSetSidebarRef.current) setSidebarOpen(previous);
  }, [tafsirOpen, isWide]);

  // Track the lg breakpoint so the spread only ever renders where it fits.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mount: memorized pages (for the badge + stat), and — when the URL didn't
  // name a page — resolve the default landing page.
  //
  // Precedence: an explicit ?page in the URL always wins (dashboard links,
  // bookmarks, deep links) → then the LAST PAGE THE READER HAD OPEN → then the
  // first page not yet memorized → then page 1. Reopening the Library should
  // feel like picking the mushaf back up where it was put down, so the
  // last-opened page beats the "where new memorization picks up" guess. It is
  // read straight from localStorage, so it doesn't wait for the progress
  // request; the first-unmemorized fallback comes out of that same fetch (no
  // extra request). Resolved with `replace` so a refresh keeps landing on the
  // resolved page rather than re-resolving every time.
  // An explicit ?page is already the answer, so nothing may land over it.
  const landedRef = useRef(hadExplicitPageRef.current);
  const landOn = useCallback((target) => {
    if (landedRef.current) return;
    landedRef.current = true;
    setSearchParams({ page: String(target) }, { replace: true });
    setPageResolved(true);
  }, [setSearchParams]);

  useEffect(() => {
    if (!hadExplicitPageRef.current && lastOpenedPage) landOn(lastOpenedPage);
    // Mount-only: resolves once against the URL/localStorage as they stood at
    // that moment; every later navigation writes an explicit page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The memorized pages, and — with neither a ?page nor a last-opened page — the
  // first page not yet memorized. Both need an account, so this waits until it is
  // known whether there is one: a visitor simply opens page 1.
  useEffect(() => {
    if (authLoading) return;
    if (!signedIn) {
      setMemorizedPages(new Set());
      setPartialPages(new Map());
      landOn(1);
      return;
    }
    progressAPI.getAllProgress().then(res => {
      const pages = res.data?.data?.memorizedPages ?? [];
      const memorized = new Set(pages);
      setMemorizedPages(memorized);
      const partial = res.data?.data?.partialPages ?? [];
      setPartialPages(new Map(partial.map(p => [p.pageNumber, p.fraction])));
      let nextNew = null;
      for (let p = 1; p <= 604; p++) { if (!memorized.has(p)) { nextNew = p; break; } }
      landOn(nextNew ?? 1);
    }).catch(() => {
      landOn(1);
    });
  }, [authLoading, signedIn, landOn]);

  // Remember the last page opened. Only once the landing page is resolved: before
  // that `currentPage` is just the un-resolved default, and writing it would
  // destroy the very value the resolution above is about to read.
  useEffect(() => {
    if (pageResolved) localStorage.setItem('lastMushafPage', String(currentPage));
  }, [currentPage, pageResolved]);

  // The reader's saved bookmarks — an account feature, so nothing is asked for
  // while signed out.
  useEffect(() => {
    if (!signedIn) { setBookmarks([]); return; }
    bookmarksAPI.list().then(res => setBookmarks(res.data?.data ?? [])).catch(() => {});
  }, [signedIn]);

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

  // Page / view change: put each visible page's word data + its glyph font on
  // screen. Held until the default-page resolution above (if any) completes, so
  // we never briefly fetch page 1 before jumping to the resolved target.
  //
  // When everything the pages need is already in memory — the usual case, since
  // the neighbours are kept ready (services/pagePrefetch.js) — they are drawn in
  // the SAME render that turned to them: adjusted during render, with no loading
  // state, no await and no extra commit. Only otherwise does the effect below
  // fetch them, keeping the old page on screen meanwhile.
  const arrivalKey = `${visiblePages.join(',')}|${reloadKey}`;
  const [arrivedKey, setArrivedKey] = useState(null);
  if (pageResolved && arrivedKey !== arrivalKey) {
    const ready = takeReadyPages(visiblePages);
    if (ready) {
      setArrivedKey(arrivalKey);
      setPagesData(ready);
      setPageLoading(false);
      setPageError(false);
    }
  }
  const pageArrived = arrivedKey === arrivalKey;

  useEffect(() => {
    if (!pageResolved || pageArrived) return;
    let cancelled = false;
    setPageLoading(true);
    setPageError(false);
    Promise.all(
      visiblePages.map(async (p) => {
        const [data] = await Promise.all([fetchMushafPage(p), ensurePageFont(p)]);
        return data;
      })
    )
      .then((datas) => {
        if (cancelled) return;
        setPagesData(datas);
        setArrivedKey(arrivalKey);
        setPageLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPageError(true);
        setPageLoading(false);
      });
    return () => { cancelled = true; };
  }, [visiblePages, arrivalKey, pageArrived, pageResolved]);

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

  // ── Audio buffer plumbing ──────────────────────────────────────────
  // The chosen speed, on an element in a way that lasts. load() resets playbackRate
  // to defaultPlaybackRate (the media element spec), so setting playbackRate alone
  // before a load was undone by it: every preloaded verse came up at 1x, and with the
  // early handover adopting those as they were, all but the first verse played at
  // normal speed whatever the speed control said. The default is set as well, so a
  // load keeps it.
  const applyRate = (el) => {
    if (!el) return;
    const rate = playbackRateRef.current;
    if (el.defaultPlaybackRate !== rate) el.defaultPlaybackRate = rate;
    if (el.playbackRate !== rate) el.playbackRate = rate;
  };

  // Everything that points an <audio> element at a verse goes through loadBuf, so
  // the recorded status can never drift from what the element is really doing.
  const loadBuf = (i, ord) => {
    const el = bufEl(i);
    if (!el) return;
    markBuf(i, ord, 'loading');
    const r = audioRetryRef.current[i];
    el.src = (r.ord === ord && r.fallback && getFallbackAyahAudioUrl(reciterRef.current, keyOfOrd(ord)))
      || getAyahAudioUrl(reciterRef.current, ord);
    applyRate(el);
    el.load();
    applyRate(el);   // and once more after, for an engine that resets it anyway
  };

  // Hand a buffer back empty: cancels its pending retry and aborts any download
  // still in flight. The status is cleared BEFORE the src goes, because dropping a
  // src fires `error` and that error must not be mistaken for a verse failing.
  const releaseBuf = useCallback((i) => {
    clearTimeout(audioRetryRef.current[i].timer);
    audioRetryRef.current[i] = { ord: null, tries: 0, timer: null, fallback: false };
    bufStateRef.current[i] = { ord: null, status: 'idle' };
    if (preStartRef.current?.idx === i) preStartRef.current = null;
    const el = i === 0 ? audioARef.current : audioBRef.current;
    if (!el) return;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }, []);   // refs only, so the callbacks that stop playback stay stable

  // The element says it has real audio: this buffer is now safe to play from, and
  // safe to swap into. Nothing else promotes a buffer to 'ready'.
  const markBufReady = (el) => {
    const i = bufIndexOf(el);
    if (i < 0) return;
    const { ord, status } = bufStateRef.current[i];
    if (ord == null) return;
    if (status !== 'ready') markBuf(i, ord, 'ready');
    if (audioRetryRef.current[i].ord === ord) {
      clearTimeout(audioRetryRef.current[i].timer);
      audioRetryRef.current[i] = { ord: null, tries: 0, timer: null, fallback: false };
    }
    if (i === activeBufRef.current) {
      lastProgressRef.current = performance.now();
      setAudioBuffering(false);
      setAudioError(false);
    }
  };

  // One buffer's load broke. The SAME warm-the-edge retry now runs whichever buffer
  // it was — the prefetch is the cold request, so it is the one that needs it most —
  // backing off a little each time. What differs is what a failure is allowed to
  // touch: the active buffer owns the spinner and, once its attempts are spent, the
  // error line. A prefetch fails in silence — it never moves the current verse,
  // never stops playback, never raises the error banner; it just keeps trying.
  // Re-entrant calls while a retry is already armed are no-ops, so an `error` event
  // and a rejected play() for the same verse cost one attempt between them, not two.
  const failBuf = (i, ord) => {
    if (ord == null || !bufHolds(i, ord)) return;          // playback has moved on
    if (bufStateRef.current[i].status === 'failed') return; // a retry is already armed
    markBuf(i, ord, 'failed');
    // An early start that broke is no handover: `ended` takes the ordinary road.
    if (preStartRef.current?.idx === i) preStartRef.current = null;
    const active = i === activeBufRef.current && ord === playingOrdRef.current;
    const r = audioRetryRef.current[i];
    if (r.ord !== ord) { r.ord = ord; r.tries = 0; r.fallback = false; }
    // Load the verse into this buffer again after `delay`. Bail if playback moved on
    // while we waited — a retry must never drag the reader back to the verse they
    // have already left.
    const retryIn = (delay) => {
      clearTimeout(r.timer);
      r.timer = setTimeout(() => {
        if (!bufHolds(i, ord)) return;
        loadBuf(i, ord);
        if (i === activeBufRef.current && ord === playingOrdRef.current) {
          lastProgressRef.current = performance.now();   // a clean window for the watchdog
          if (isPlayingRef.current) playEl(i, ord);
        }
      }, delay);
    };
    const budget = !active ? AUDIO_RETRIES_PREFETCH : r.fallback ? AUDIO_RETRIES_FALLBACK : AUDIO_RETRIES_ACTIVE;
    if (r.tries >= budget) {
      // The primary has had its whole budget for the verse the reader is waiting on.
      // If this reciter has a verified second source, that is the next road — same
      // spinner, a budget of its own, and its first ask goes at once (the primary's
      // backoff has already been waited out). Only when it too is spent is it an error.
      if (active && !r.fallback && getFallbackAyahAudioUrl(reciterRef.current, keyOfOrd(ord))) {
        r.fallback = true;
        r.tries = 0;
        setAudioBuffering(true);
        retryIn(0);
        return;
      }
      // Spent. Only the verse the reader is actually waiting on says so out loud.
      if (active) { setAudioBuffering(false); setAudioError(true); setIsPlaying(false); }
      return;
    }
    // One extra ask at the edge alongside the element's own retry. Repeated requests
    // are what actually fill the edge — a verse that failed here has been watched to
    // answer 200 moments later, once enough of them had asked for it — and one per
    // attempt keeps that pressure on without turning a dead file into a flood. (The
    // second source is an ordinary origin with no cold edge to warm.)
    if (active && !r.fallback) touchAyah(reciterRef.current, ord);
    r.tries += 1;
    if (active) setAudioBuffering(true);   // it is still trying, so say "loading", not "broken"
    retryIn(AUDIO_RETRY_MS * r.tries);
  };

  // play() rejects for three unrelated reasons, and swallowing all three is what let
  // a dead element stall in silence. AbortError is ordinary ping-pong traffic — a new
  // load or a pause cut the play short. NotAllowedError is the autoplay policy
  // wanting a gesture, which no amount of retrying can supply. Anything else is the
  // source refusing to start, which is the same failure an `error` event reports, so
  // it takes the same road.
  const playEl = (i, ord) => {
    const el = bufEl(i);
    applyRate(el);   // every start — early handover, swap, repeat, retry — at the chosen speed
    // Time how long a READY element takes from play() to sound — exactly what an early
    // start is, and what the handover has to start ahead by. Starts that must load or
    // seek first (a cold verse, a repeat rewinding) would be timing those instead.
    if (el?.paused && el.readyState >= 3 /* HAVE_FUTURE_DATA */) {
      latencyProbeRef.current = { idx: i, at: performance.now(), from: el.currentTime, got: [] };
    }
    const promise = el?.play();
    if (!promise || typeof promise.catch !== 'function') return;
    promise.catch((err) => {
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') { setIsPlaying(false); setAudioBuffering(false); return; }
      failBuf(i, ord);
    });
  };

  // Take back an early start that is not going to be committed — playback paused, the
  // verse replays instead, or the platform would not play two at once. The element is
  // silenced and rewound, so it is still a ready buffer to swap into.
  const cancelPreStart = () => {
    const pre = preStartRef.current;
    if (!pre) return;
    preStartRef.current = null;
    const el = bufEl(pre.idx);
    if (!el) return;
    el.pause();
    try { el.currentTime = 0; } catch { /* it starts from 0 on its next load anyway */ }
  };

  // Resume the verse already loaded. If its last load FAILED, pressing play is a
  // deliberate second chance: the retry budget resets and the file is fetched again,
  // so a reader who presses play after "could not load the recitation" is not stuck
  // with the old verdict.
  const resumeActive = () => {
    const i = activeBufRef.current;
    const ord = playingOrdRef.current;
    lastProgressRef.current = performance.now();
    if (ord != null && bufStateRef.current[i].status === 'failed') {
      clearTimeout(audioRetryRef.current[i].timer);
      audioRetryRef.current[i] = { ord: null, tries: 0, timer: null, fallback: false };
      setAudioError(false);
      setAudioBuffering(true);
      loadBuf(i, ord);
    }
    playEl(i, ord);
    setIsPlaying(true);
  };

  // ── Warming the CDN edge ahead of the recitation ───────────────────
  // The media prefetch on its own is too little runway: it starts when the current
  // verse starts, and the short ayahs of Juz Amma last two seconds, so a cold 502 on
  // the next verse has barely time to be retried before it is wanted. So the edge is
  // warmed WARM_AHEAD verses out with a plain fetch — no media element, no playback
  // state, nothing a failure there can break. A 502 costs nothing at that distance,
  // and the file is touched again and again long before the recitation arrives, by
  // which time it is sitting on the edge and the prefetch is no longer cold.
  //
  // Three things about this CDN decided the shape, each measured against it rather
  // than assumed:
  //
  //  - The touches are BLIND. The fetch has to be no-cors, because the CDN sends no
  //    access-control-allow-origin, and an opaque response hides everything: `ok` is
  //    false either way, and Resource Timing reports responseStatus 0 (it reports a
  //    real 200 for a same-origin entry, so that is the cross-origin rule and not
  //    something to work around). Nothing in the page can tell a 502 from a 200 here,
  //    so there is no condition to loop on — only a fixed number of touches.
  //
  //  - Blind is affordable, because a touch is cheap. Sampling cold ayahs, a file
  //    turned 200 somewhere between the 2nd and the 8th request — one touch is usually
  //    NOT enough — so WARM_TOUCHES covers the slow tail.
  //
  //  - For the CDN it is a HEAD (ayahWarmMethod). It used to be a whole-file GET —
  //    Chrome strips Range from a no-cors fetch, so a cheap ranged GET was never on
  //    the table — and that GET turned out to be harmful, not just costly: this CDN
  //    answers a fetch GZIP-ENCODED, and the <audio> element later revalidated that
  //    cached gzip copy and played it CUT SHORT (measured 2026-10-13: up to 24% of a
  //    file, words included — see getAyahAudioUrl). A HEAD warms the edge exactly as
  //    the GET did (a cold object answers HEAD with MISS and the next GET with HIT)
  //    and carries no body, so it costs a header's worth and leaves nothing behind.
  //    everyayah sends MP3s uncompressed, so for it the GET stays, and its repeat
  //    touches are disk-cache reads.
  const WARM_AHEAD = 3;
  const WARM_TOUCHES = 6;
  const WARM_GAP_MS = 500;
  const warmedRef = useRef(new Set());   // reciter:ord pairs already warmed this session
  const warmGenRef = useRef(0);          // bumped on stop / reciter change to retire warms in flight

  // One blind request at the edge, and nothing else: no state, no element, no reader
  // visible consequence either way.
  const touchAyah = useCallback((rec, ord) => {
    fetch(getAyahAudioUrl(rec, ord), { mode: 'no-cors', method: ayahWarmMethod(rec) })
      .catch(() => { /* a failed warm-up is a no-op by design */ });
  }, []);

  const warmAyah = useCallback((rec, ord) => {
    const key = rec + ':' + ord;
    if (warmedRef.current.has(key)) return;
    if (warmedRef.current.size > 800) warmedRef.current.clear();   // a long sitting must not grow a set forever
    warmedRef.current.add(key);
    const gen = warmGenRef.current;
    const touch = (n) => {
      if (gen !== warmGenRef.current) return;   // playback stopped, or the reciter changed
      touchAyah(rec, ord);
      // Widening gaps: the early ones are what ask the origin for the file, the later
      // ones are cache reads confirming it arrived.
      if (n + 1 < WARM_TOUCHES) setTimeout(() => touch(n + 1), WARM_GAP_MS * (n + 1));
    };
    touch(0);
  }, [touchAyah]);

  // Stop playback and release BOTH buffers — removing the src and reloading aborts
  // any download still in flight, so nothing keeps fetching once playback is over.
  // The warm-up generation is bumped with them, so the reads running ahead of the
  // recitation stop retrying for a recitation that is finished.
  const stopAudio = useCallback(() => {
    warmGenRef.current += 1;
    releaseBuf(0);
    releaseBuf(1);
    activeBufRef.current = 0;
    setPlayingOrd(null);
    setIsPlaying(false);
    setAudioBuffering(false);
    setRepeatsDone(0);
    setRangePasses(0);
    readerLedRef.current = false;
  }, [releaseBuf, setRepeatsDone, setRangePasses]);

  // Page / view change: clear the selection, because the on-screen verse set
  // changed and the highlight would be pointing at a verse that has gone. The
  // selection survives a turn the RECITATION asked for, landing on its verse below.
  //
  // The recitation is no longer stopped here either. Turning the page while
  // listening is an ordinary thing to do — checking the next page, glancing back at
  // a verse — and having the audio cut out every time made it impossible. What a
  // reader-made turn does instead is take the wheel: the sound carries on, and the
  // page stops chasing it (see readerLedRef and the follow effect below).
  //
  // The tafsir panel is deliberately NOT closed here. It is a docked panel, not
  // something attached to one page: turning the page is "show me the next page",
  // never "put the tafsir away", and having to reopen it after every turn made it
  // unusable for reading through a surah. It keeps the verse it was showing (its
  // own key survives losing the selection) until a verse on the new page is
  // tapped, or it is closed on purpose — Escape, its X, the toggle, or opening a
  // note over it.
  useEffect(() => {
    const audioTurn = followTurnRef.current;
    if (audioTurn) followTurnRef.current = false;
    else readerLedRef.current = true;
    if (selectTurnRef.current) selectTurnRef.current = false;
    // A turn the recitation asked for keeps the selection too WHILE the selection
    // is riding along with it — the follower lands it on the new page's verse as
    // soon as that page's verses arrive.
    else if (!(audioTurn && followingAudioRef.current)) {
      setSelectedVerseKey(null);
    }
  }, [currentPage, view]);

  // Keep the selection on the verse being recited. While the two are in step,
  // every new verse carries the selection along — so the popover, the mushaf
  // highlight and the tafsir panel all follow the recitation without the reader
  // touching anything. Picking a different verse breaks the link and the
  // selection stays where it was put, until playback is started from there again.
  // Nothing is selected? Then nothing is conjured up: pressing play in the bottom
  // bar must not make a popover appear out of thin air.
  useEffect(() => { selectedKeyRef.current = selectedVerseKey; }, [selectedVerseKey]);
  useEffect(() => {
    if (playingOrd == null || !isPlaying) { followingAudioRef.current = false; return; }
    const selOrd = ordOfKey(selectedKeyRef.current);
    if (selOrd == null || (selOrd !== playingOrd && selOrd !== recitedOrdRef.current)) {
      followingAudioRef.current = false;
      return;
    }
    followingAudioRef.current = true;
    const key = keyOfOrd(playingOrd);
    // Not on screen yet — the page is still being turned to. Leave recitedOrd
    // where it is so this runs again, and lands, once the verses are in.
    if (!key || !verses.some((v) => v.verseKey === key)) return;
    recitedOrdRef.current = playingOrd;
    setSelectedVerseKey(key);
  }, [playingOrd, isPlaying, verses]);

  // Land a selection that was waiting on its page. Stepping the selection past
  // the edge of the visible page(s) turns the page first (exactly as playback
  // does) and lands here once the new page's verses have arrived.
  useEffect(() => {
    const key = pendingSelectRef.current;
    if (!key || !verses.some((v) => v.verseKey === key)) return;
    pendingSelectRef.current = null;
    setSelectedVerseKey(key);
  }, [verses]);

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
      // The tour walks the sidebar, so make sure it is actually on screen.
      setSidebarByUser(true);
      if (forceTour) {
        const next = new URLSearchParams(searchParams);
        next.delete('tour');
        setSearchParams(next, { replace: true });
      }
      const tour = startLibraryTour({
        t,
        onDone: () => {
          localStorage.setItem('seenLibraryTour', '1');
          markTour(false);
          tourRef.current = null;
        },
      });
      if (tour) { tourRef.current = tour; markTour(true); }
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
      markTour(true);
      startVerseActionsCoachmark({ t, onDone: () => { markTour(false); } });
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseKey]);

  // A reciter change invalidates both buffers — same verses, different files. Runs
  // before the playback effect below (declaration order), so that one reloads.
  useEffect(() => {
    warmGenRef.current += 1;   // the verses warmed ahead belong to a different recording
    releaseBuf(1 - activeBufRef.current);
    markBuf(activeBufRef.current, null, 'idle');
    localStorage.setItem('reciter', reciter);
  }, [reciter, releaseBuf]);

  // Drive the active <audio> element: point it at the current verse and play.
  useEffect(() => {
    if (playingOrd == null) return;
    // The handover already started this verse, so it would be heard the instant the
    // last one ran out: adopt it exactly as it is — no rewind, no second play(). An
    // early start for some OTHER verse (playback was re-aimed meanwhile) is taken back.
    const pre = preStartRef.current;
    if (pre) {
      preStartRef.current = null;
      const preEl = bufEl(pre.idx);
      if (pre.ord === playingOrd && bufHolds(pre.idx, playingOrd) && preEl && !preEl.paused) {
        if (activeBufRef.current !== pre.idx) {
          bufEl(activeBufRef.current)?.pause();
          activeBufRef.current = pre.idx;
        }
        setAudioError(false);
        lastProgressRef.current = performance.now();
        return;
      }
      if (preEl) {
        preEl.pause();
        try { preEl.currentTime = 0; } catch { /* it starts from 0 on its next load anyway */ }
      }
    }
    const cur = activeBufRef.current;
    const other = 1 - cur;
    // The idle buffer preloaded this verse while the previous one played — swap to
    // it rather than fetching again. This swap is the gapless handoff, and it is
    // allowed ONLY into a buffer that has said it can play. Adopting one that had
    // merely been TOLD to load this verse is what turned a prefetch 502 into
    // permanent silence: the element was dead, the swap trusted it anyway, and
    // nothing ever asked for that verse again.
    if (bufReady(other, playingOrd) && !bufReady(cur, playingOrd)) {
      bufEl(cur)?.pause();
      activeBufRef.current = other;
    } else if (bufHolds(other, playingOrd) && !bufReady(other, playingOrd)) {
      // It holds this verse but never got it. Let it go: the active element takes
      // the verse over below with the retry path behind it, and the preloader gets a
      // clean buffer for the verse after this one. A late start is fine; a silent
      // stall is not.
      releaseBuf(other);
    }
    const idx = activeBufRef.current;
    const el = bufEl(idx);
    if (!el) return;
    setAudioError(false);
    lastProgressRef.current = performance.now();
    const held = bufStateRef.current[idx];
    if (held.ord !== playingOrd || held.status === 'failed') {
      loadBuf(idx, playingOrd);
    } else if (el.currentTime > 0) {
      try { el.currentTime = 0; } catch { /* not seekable yet — it starts at 0 anyway */ }
    }
    applyRate(el);
    if (isPlaying) playEl(idx, playingOrd);
    // Speed and pause/resume are applied by their own handlers; re-running here on
    // either would restart the verse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingOrd, reciter]);

  // Apply a speed change to BOTH elements immediately (the idle one is already
  // primed with the next verse and must start at the same speed) and persist it.
  useEffect(() => {
    [0, 1].forEach((i) => applyRate(bufEl(i)));
    localStorage.setItem('playbackRate', String(playbackRate));
  }, [playbackRate]);

  // Reset both counters whenever what they are counting against changes — the
  // mode, either end of the range, either repeat count, or the reciter (a new
  // recording restarts the verse, so a half-finished tally would be a lie).
  useEffect(() => {
    setRepeatsDone(0);
    setRangePasses(0);
  }, [repeatMode, rangeStartOrd, rangeEndOrd, rangeRepeat, rangeVerseRepeat, verseRepeat,
      reciter, setRepeatsDone, setRangePasses]);

  // Until the reader actually turns range repeat on, keep the range pickers
  // defaulted to what's in front of them: start at the selected verse if there is
  // one, otherwise the first verse of the page; end at the last verse of the page
  // the start verse sits on. Once range mode is on, the values belong to the user.
  useEffect(() => {
    if (repeatMode === 'range') return;
    const startOrd = ordOfKey(selectedVerseKey) ?? ordOfKey(verses[0]?.verseKey);
    if (!startOrd) return;
    const startPage = pageOfOrd(startOrd);
    const onStartPage = verses.filter((v) => v.page === startPage);
    const endOrd = onStartPage.length ? ordOfKey(onStartPage[onStartPage.length - 1].verseKey) : startOrd;
    setRangeStartOrd(startOrd);
    setRangeEndOrd(Math.max(startOrd, endOrd ?? startOrd));
  }, [verses, repeatMode, selectedVerseKey]);

  const pageStep = twoPage ? 2 : 1;
  const maxPage = twoPage ? 603 : 604;

  // Which verse follows the one playing — the same question the preloader and the
  // ended-handler both ask. In verse-repeat mode the repeats replay the SAME
  // element, so the verse worth preloading is still the one after it.
  const nextOrdAfter = useCallback((ord) => {
    if (ord == null) return null;
    if (repeatMode === 'range') return ord < rangeEndOrd ? ord + 1 : rangeStartOrd;
    return ord < TOTAL_AYAHS ? ord + 1 : null;
  }, [repeatMode, rangeStartOrd, rangeEndOrd]);

  const playOrd = (ord) => {
    if (!(ord >= 1 && ord <= TOTAL_AYAHS)) return;
    setAudioError(false);
    if (ord === playingOrd) {
      if (!isPlaying) resumeActive();
      return;
    }
    setRepeatsDone(0);
    readerLedRef.current = false;   // an aimed play takes the view with it again
    setPlayingOrd(ord);
    setIsPlaying(true);
  };

  // Replay the current verse from its start without reloading (verse-repeat).
  const replayCurrent = () => {
    const el = activeEl();
    if (!el) return;
    cancelPreStart();   // the end replays the verse, so nothing may have started after it
    el.currentTime = 0;
    lastProgressRef.current = performance.now();
    playEl(activeBufRef.current, playingOrd);
    setIsPlaying(true);
  };

  // Move one verse in `dir` through the whole Quran. Page boundaries don't enter
  // into it any more: the verse is addressed globally and the view follows it.
  const advanceOrd = (dir) => {
    const next = (playingOrd ?? 1) + dir;
    setRepeatsDone(0);
    if (next < 1 || next > TOTAL_AYAHS) { stopAudio(); return; }
    setPlayingOrd(next);
    setIsPlaying(true);
  };

  // Bar prev/next: start playback if idle, else step.
  const stepVerse = (dir) => {
    readerLedRef.current = false;   // "next verse" means show me it, too
    if (playingOrd == null) {
      const fallback = dir > 0 ? verses[0] : verses[verses.length - 1];
      const ord = ordOfKey(fallback?.verseKey);
      if (ord) playOrd(ord);
      return;
    }
    advanceOrd(dir);
  };

  // The bar's play/pause always does what its icon says. While it shows PAUSE it
  // pauses, full stop. When it shows PLAY it starts what the reader has PICKED —
  // a verse, or the start of a span — which need not be the verse still loaded
  // from last time. It used to resume whatever was loaded and ignore the pick
  // entirely, so choosing a new verse and pressing play replayed the old one.
  const togglePlayPause = () => {
    const pickedOrd = rangeSelection
      ? rangeSelection.startOrd
      : ordOfKey(selectedVerseKey) ?? (repeatMode === 'range' ? rangeStartOrd : null);
    // Nothing loaded: start from the pick, or from the top of the page if there
    // is none — pressing play must never conjure a verse out of nowhere.
    if (playingOrd == null) {
      playOrd(pickedOrd ?? ordOfKey(verses[0]?.verseKey));
      return;
    }
    const el = activeEl();
    if (!el) return;
    if (isPlaying) { cancelPreStart(); el.pause(); setIsPlaying(false); return; }
    if (pickedOrd != null && pickedOrd !== playingOrd) { playOrd(pickedOrd); return; }
    resumeActive();
  };

  // Popover / tafsir play button: play from that verse, or pause if it's already the one playing.
  const toggleVerseAudio = (ord) => {
    if (ord == null) return;
    if (ord === playingOrd && isPlaying) { cancelPreStart(); activeEl()?.pause(); setIsPlaying(false); }
    else playOrd(ord);
  };

  const handleEnded = (e) => {
    // Only the element actually playing drives the sequence; the idle buffer is
    // preloading and must never advance anything.
    if (e && e.currentTarget !== activeEl()) return;
    if (playingOrd == null) return;
    if (repeatMode === 'verse') {
      const done = repeatsDoneRef.current + 1;
      setRepeatsDone(done);
      if (verseRepeat === Infinity || done < verseRepeat) { replayCurrent(); return; }
      setRepeatsDone(0);
      advanceOrd(1);
      return;
    }
    if (repeatMode === 'range') {
      // The two counts nest, INNER FIRST: this verse takes all of its turns before
      // the range moves on, and only the last verse of the range having taken all
      // of its own ends a pass. Both branches replay or hand over the SAME way the
      // single counts did, so neither the verse repeat nor the range wrap costs a
      // fetch — the gapless double buffer is untouched by the nesting.
      const done = repeatsDoneRef.current + 1;
      if (rangeVerseRepeat === Infinity || done < rangeVerseRepeat) {
        setRepeatsDone(done);
        replayCurrent();
        return;
      }
      setRepeatsDone(0);
      if (playingOrd < rangeEndOrd) { setPlayingOrd(playingOrd + 1); setIsPlaying(true); return; }
      const passes = rangePassesRef.current + 1; // finished one pass over the range
      if (rangeRepeat === Infinity || passes < rangeRepeat) {
        setRangePasses(passes);
        if (rangeStartOrd === playingOrd) replayCurrent();   // single-verse range
        else { setPlayingOrd(rangeStartOrd); setIsPlaying(true); }
        return;
      }
      setRangePasses(0);
      stopAudio();
      return;
    }
    advanceOrd(1); // 'off' → continuous auto-advance through the whole Quran
  };
  handleEndedRef.current = handleEnded;

  // A failed load is retried on the SAME url before it is called an error: the retry
  // is what warms the edge, so the second attempt is the one that plays. BOTH
  // elements report here now, the one that is merely preloading included — it used
  // to return early on exactly the request that is always cold. failBuf holds the
  // backoff and decides what each case may touch.
  const handleAudioError = (e) => {
    const i = bufIndexOf(e.currentTarget);
    if (i < 0) return;
    failBuf(i, bufStateRef.current[i].ord);
  };

  // Preload the verse that comes next into the idle buffer, so that by the time the
  // current one ends its successor is already fetched and decoded. Nothing is
  // preloaded while playback is stopped or paused.
  useEffect(() => {
    if (playingOrd == null || !isPlaying) return;
    const next = nextOrdAfter(playingOrd);
    // The edges of both files of the coming handover (see the handover effect).
    verseEdges(reciter, playingOrd);
    if (next != null && next !== playingOrd) verseEdges(reciter, next);
    if (next == null || next === playingOrd) return;
    const idle = 1 - activeBufRef.current;
    // Already on it, or already has it, or failed on it with its own retry pending —
    // in none of those cases does starting over help.
    if (bufHolds(idle, next)) return;
    bufEl(idle)?.pause();
    loadBuf(idle, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingOrd, isPlaying, nextOrdAfter, reciter]);

  // Warm the CDN edge WARM_AHEAD verses out (see warmAyah), so the prefetch above
  // stops being the first request its file ever gets, and stops being the one that
  // eats the cold 502.
  useEffect(() => {
    if (playingOrd == null || !isPlaying) return;
    let ord = playingOrd;
    for (let k = 0; k < WARM_AHEAD; k += 1) {
      ord = nextOrdAfter(ord);
      if (ord == null || ord === playingOrd) break;
      warmAyah(reciter, ord);
    }
  }, [playingOrd, isPlaying, nextOrdAfter, reciter, warmAyah]);

  // Stall watchdog. A media element can go quiet without ever firing `error` — the
  // request hangs, or it was handed a src it never managed to load — while isPlaying
  // still says sound should be coming out. So if no timeupdate has landed for
  // STALL_MS and the element has nothing buffered to play, treat the silence as the
  // failure it is and put it through the same retry as a reported error.
  useEffect(() => {
    if (!isPlaying || playingOrd == null) return;
    const id = setInterval(() => {
      const i = activeBufRef.current;
      const el = bufEl(i);
      if (!el || el.ended) return;
      if (performance.now() - lastProgressRef.current < STALL_MS) return;
      if (el.readyState >= 3 /* HAVE_FUTURE_DATA */) {
        // It has audio and simply isn't playing it — nudge it rather than refetch.
        if (el.paused) { lastProgressRef.current = performance.now(); playEl(i, playingOrd); }
        return;
      }
      setAudioBuffering(true);
      failBuf(i, playingOrd);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playingOrd]);

  // ── The handover: start the next verse in time to be HEARD on time ──
  // Waiting for `ended` puts dead air between every two verses: it fires once the last
  // sample has played, then React renders, then the next element's play() still has to
  // start its audio pipeline — 92-177 ms of silence at every verse change, measured
  // 2026-10-13, cutting off the room tone mid-breath. So while a verse plays, its clock
  // is read every frame, and the next verse's element — only once it is 'ready' — is
  // started so that it becomes audible as this one runs out: ahead by the start latency
  // measured on this device, and by the next file's leading digital silence, which then
  // plays under the last instant of this verse — exact zeros, adding nothing. How far
  // ahead is capped PER BOUNDARY by the silence this verse ends with plus those zeros,
  // both measured on the files themselves (verseEdges.js): were the latency somehow
  // zero, the next verse could still only land on silence, never on a final letter. A
  // verse whose edges are unknown gets no lead beyond the zeros. Nothing is faded and
  // no sound overlaps sound. The reciter's own pause between verses lives in the room
  // tone at the end of one file and the start of the next, and with the pause setting
  // on 'natural' (the default) it plays exactly as recorded; 'tight' trims that
  // silence to about TIGHT_PAUSE_MS, from the edges inward, never into a word.
  //
  // `ended` still drives everything else — the repeat counts, the range wrap, the page
  // follower, the highlight — so the verse shown switches when the new one is heard,
  // never when its element is started. Anything uncertain leaves the handover to
  // `ended`, which is exactly the road it always took: the next file not ready, a
  // duration that moved while playing, a hidden tab (no frames), a replay, a stop.
  useEffect(() => {
    if (!isPlaying || playingOrd == null) { cancelPreStart(); return; }
    let raf = 0;
    let timer = 0;
    let cutTimer = 0;
    let firstDur = null;   // the duration this verse started with; if it moves, it isn't known
    // Where the end of THIS verse leads, read exactly as handleEnded will act on it.
    // null whenever that is not a different verse: a replay, a stop, the last ayah.
    const ordAfterEnd = () => {
      const ord = playingOrdRef.current;
      if (ord == null) return null;
      const done = repeatsDoneRef.current + 1;
      if (repeatMode === 'verse') {
        if (verseRepeat === Infinity || done < verseRepeat) return null;
        return ord < TOTAL_AYAHS ? ord + 1 : null;
      }
      if (repeatMode === 'range') {
        if (rangeVerseRepeat === Infinity || done < rangeVerseRepeat) return null;
        if (ord < rangeEndOrd) return ord + 1;
        const passes = rangePassesRef.current + 1;
        if (rangeRepeat !== Infinity && passes >= rangeRepeat) return null;
        return rangeStartOrd === ord ? null : rangeStartOrd;
      }
      return ord < TOTAL_AYAHS ? ord + 1 : null;
    };
    // Lower median of the recent measurements: an estimate that errs SHORT starts the
    // next verse a touch late — a hair of extra silence — never early.
    const startLatency = () => {
      const a = [...startLatencyRef.current].sort((x, y) => x - y);
      return a.length ? a[Math.floor((a.length - 1) / 2)] : HANDOVER_LATENCY_GUESS_MS;
    };
    // The verse's clock, as wall-time readings. currentTime does not move smoothly: it
    // holds still for 17-30 ms at a time (worst near the end of a file) and then jumps,
    // so a reading taken at the moment of decision can be stale by that much. Only
    // FRESH readings — the value just moved — are kept, and the end is projected from
    // the median of the last half second of them. Fired from that projection by the
    // wall clock, a stall-free verse is handed over on time even while its clock freezes.
    const seen = [];   // [performance.now(), currentTime, rate] — fresh readings only
    const readClock = (el) => {
      const ct = el.currentTime;
      const last = seen[seen.length - 1];
      if (last && last[1] === ct) return;
      // A clock that went BACK is a replay (verse repeat) or a seek: what it said before
      // describes a pass that is over. Kept, it projected that pass's end onto the new
      // one and started the next verse over the repeat.
      if (last && ct < last[1]) seen.length = 0;
      const now = performance.now();
      seen.push([now, ct, el.playbackRate || 1]);
      while (seen.length && now - seen[0][0] > 500) seen.shift();
    };
    // When, in performance.now() terms, this verse runs out — or null if not yet known.
    const endsAt = (dur) => {
      if (seen.length < 4) return null;
      const at = seen.map(([t, ct, r]) => t + (dur - ct) * 1000 / r).sort((x, y) => x - y);
      return at[Math.floor(at.length / 2)];
    };
    // The plan for this handover: when to call play() on the next verse and from where
    // in its file, and ('tight' only) when to let go of this one — all in
    // performance.now() terms. null when there is to be no early start.
    const plan = () => {
      if (preStartRef.current || !concurrentOkRef.current) return null;
      const next = ordAfterEnd();
      if (next == null) return null;
      const cur = activeBufRef.current;
      const idle = 1 - cur;
      if (!bufHolds(cur, playingOrdRef.current) || !bufReady(idle, next)) return null;
      const el = bufEl(cur);
      const nx = bufEl(idle);
      if (!el || !nx || el.paused || el.ended || el.seeking || !nx.paused || nx.seeking) return null;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return null;
      if (firstDur == null) firstDur = dur;
      if (dur !== firstDur) return null;
      // The media clock runs at the playback rate: file times are divided by it.
      const rate = el.playbackRate || 1;
      const rec = reciterRef.current;
      // The edges of the two files, if measured — and only if the measurement is of
      // these very files (verseEdges.js). Unknown counts as no silence at all.
      const eN = peekVerseEdges(rec, playingOrdRef.current);
      const eN1 = peekVerseEdges(rec, next);
      const okN = matchesDuration(eN, dur);
      const okN1 = matchesDuration(eN1, nx.duration);
      // Where the sound really runs out. `duration` is the browser's estimate, and on a
      // file without a Xing header it counts the trailing ID3 tag as audio (8-32 ms
      // too long); the measured length counts frames, so where it is known it wins.
      const endPos = okN ? Math.min(dur, eN.durMs / 1000) : dur;
      const end = endsAt(endPos);
      if (end == null) return null;
      // The projection must agree with the clock as it reads right now; if it doesn't,
      // the readings are from some other stretch of playback, and nothing is started.
      if (Math.abs(end - performance.now() - (endPos - el.currentTime) * 1000 / rate) > 150) return null;
      const tail = okN ? eN.tailSilenceMs : 0;
      // Only encoder delay counts as padding to play under this verse: up to 50 ms past
      // this reciter's measured floor of it, and 100 ms at most. A longer run of zeros is
      // the recording's own pause, edited down to digital silence (Hani ar-Rifai opens
      // some files with 500-800 ms of it), and 'natural' plays it as it is.
      const floorZeros = getLeadingSilenceMs(rec);
      const zeros = HANDOVER_LEAD_OK
        ? Math.min(okN1 ? eN1.headZerosMs : floorZeros, floorZeros + ENCODER_DELAY_SPREAD_MS, ENCODER_DELAY_MAX_MS)
        : 0;
      // 'tight': whatever silence the two edges add up to beyond TIGHT_PAUSE_MS comes
      // off — the next verse's opening silence first (it simply starts further in),
      // then this verse's closing silence (it is let go of early). Never within
      // EDGE_GUARD_MS of a sound, so not a letter is touched.
      let skip = 0;
      let cut = 0;
      if (versePause === 'tight' && okN && okN1) {
        let excess = (tail + eN1.headSilenceMs) / rate - TIGHT_PAUSE_MS;
        if (excess > 0) {
          skip = Math.min(excess * rate, Math.max(0, eN1.headSilenceMs - EDGE_GUARD_MS));
          excess -= skip / rate;
          cut = Math.max(0, Math.min(excess * rate, tail - EDGE_GUARD_MS));
        }
      }
      // The next verse has to be waiting at the point it will start from.
      if (Math.abs(nx.currentTime * 1000 - skip) > 2) { nx.currentTime = skip / 1000; return null; }
      const stopAt = end - cut / rate;
      // Ahead by this device's start-up time, and by the next file's remaining exact
      // zeros — but never further ahead than the silence this verse still has before
      // it stops, plus those zeros: so even if the next verse sounded the instant
      // play() was called, it could only ever land on silence, never on a letter.
      const zerosLeft = Math.max(0, zeros - skip);
      const budget = (Math.max(0, tail - cut - EDGE_GUARD_MS) + zerosLeft) / rate;
      const early = Math.max(0, Math.min(startLatency() - HANDOVER_MARGIN_MS + zerosLeft / rate, budget));
      return { idle, next, at: stopAt - early, stopAt: cut > 0 ? stopAt : null };
    };
    // 'tight' only: this verse's remaining silence is let go of, and `ended` is run as
    // if it had come — the next verse is already sounding.
    const letGo = (idx, ord) => {
      cutTimer = 0;
      const pre = preStartRef.current;
      const el = bufEl(idx);
      if (!pre || pre.ord === ord || activeBufRef.current !== idx || !el || el.paused) return;
      letGoRef.current = { idx, at: performance.now() };   // so handleAudioPause knows it was us
      el.pause();
      handleEndedRef.current?.();
    };
    const fire = () => {
      timer = 0;
      const p = plan();
      if (!p) return;                                       // the next frame looks again
      const wait = p.at - performance.now();
      if (wait > 4) { timer = setTimeout(fire, wait); return; }
      preStartRef.current = { idx: p.idle, ord: p.next };
      playEl(p.idle, p.next);
      if (p.stopAt != null) {
        const cur = activeBufRef.current;
        const ord = playingOrdRef.current;
        cutTimer = setTimeout(() => letGo(cur, ord), Math.max(0, p.stopAt - performance.now()));
      }
    };
    // How long a timed play() took to be heard. A clock's first readings
    // can't say: for its first ~100 ms it runs AHEAD of where it settles, which read as
    // 3-19 ms against a steady 59-76 ms (measured 2026-10-13) and started verses 60 ms
    // early. So it is back-dated only from fresh readings 0.25-0.6 s in, by their median.
    const measure = () => {
      const probe = latencyProbeRef.current;
      if (!probe) return;
      const el = bufEl(probe.idx);
      const now = performance.now();
      const done = () => {
        latencyProbeRef.current = null;
        if (probe.got.length < 3) return;
        const ms = probe.got.sort((x, y) => x - y)[Math.floor(probe.got.length / 2)];
        if (ms >= 0 && ms < 300) startLatencyRef.current = [...startLatencyRef.current.slice(-6), ms];
      };
      if (!el || el.paused) { done(); return; }
      const ct = el.currentTime;
      const into = ct - probe.from;
      if (into > 0.6) { done(); return; }
      if (into < 0.25 || ct === probe.lastCt) return;
      probe.lastCt = ct;
      probe.got.push(now - probe.at - into * 1000 / (el.playbackRate || 1));
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      measure();
      const el = activeEl();
      if (el && !el.paused) readClock(el);
      if (timer) return;
      const p = plan();
      // Two frames out is close enough to hand the last stretch to a timer.
      if (p && p.at - performance.now() <= 40) timer = setTimeout(fire, Math.max(0, p.at - performance.now()));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); clearTimeout(cutTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playingOrd, repeatMode, verseRepeat, rangeVerseRepeat, rangeRepeat, rangeStartOrd, rangeEndOrd, versePause]);

  // Some platforms (older iOS among them) will not play two media elements at once and
  // pause the one already playing when another starts — which an early start would
  // turn into the end of a verse cut off. If that is ever seen, the early start is
  // taken back, the verse is finished, and the handover stays on `ended` for the rest
  // of the session. Pauses the app makes itself never get here: each of them takes
  // the early start back first, and a natural end has `ended` set.
  const handleAudioPause = (e) => {
    const el = e.currentTarget;
    const i = activeBufRef.current;
    const ours = letGoRef.current;   // the 'tight' setting letting go of a verse's tail
    if (ours && ours.idx === bufIndexOf(el) && performance.now() - ours.at < 1000) { letGoRef.current = null; return; }
    if (!preStartRef.current || el !== activeEl() || el.ended) return;
    if (!bufHolds(i, playingOrdRef.current)) return;   // being released, not interrupted
    concurrentOkRef.current = false;
    cancelPreStart();
    playEl(i, playingOrdRef.current);
  };

  // Where a turn steps FROM. The router re-renders in a transition, so on a busy
  // device several key presses can land before `currentPage` catches up — and a
  // handler bound in an earlier render still sees an older page. Stepping from
  // either lost presses (5 quick presses at 4x CPU landed 1–4 pages short). So the
  // base is kept in refs: the page last ASKED for, until it is on screen, else the
  // page on screen — mirrored in a layout effect, which runs in the same task as
  // the commit, so no input can slip in between.
  const shownPageRef = useRef(currentPage);
  const requestedPageRef = useRef(null);
  useLayoutEffect(() => {
    shownPageRef.current = currentPage;
    if (requestedPageRef.current === currentPage) requestedPageRef.current = null;
  }, [currentPage]);

  // Returns whether it actually navigated — the playback follower needs to know,
  // so it doesn't leave its "this turn was mine" flag set on a no-op.
  const goToPage = useCallback((n) => {
    let page = clampPage(n);
    // In the spread, anchor navigation to the right (odd) page of the pair.
    if (twoPage && page % 2 === 0) page = Math.max(1, page - 1);
    const from = requestedPageRef.current ?? shownPageRef.current;
    if (page === from) return false;
    turnDirRef.current = page > from ? 'fwd' : 'back'; // for the turn animation
    requestedPageRef.current = page === shownPageRef.current ? null : page;
    setSearchParams({ page: String(page) }, { replace: true });
    return true;
  }, [twoPage, setSearchParams]);

  // Directional turns for a right-to-left book: "next" always moves forward
  // (higher page number), "prev" back — independent of UI language. The pager,
  // keyboard, edge-clicks and swipe all route through these two.
  const goNext = useCallback(
    () => goToPage((requestedPageRef.current ?? shownPageRef.current) + pageStep),
    [goToPage, pageStep]
  );
  const goPrev = useCallback(
    () => goToPage((requestedPageRef.current ?? shownPageRef.current) - pageStep),
    [goToPage, pageStep]
  );

  // Keep the mushaf on the verse being recited. When playback reaches a verse that
  // isn't on screen — a repeat range spanning pages, or continuous recitation
  // running past the page break — turn to its page. The <audio> element is
  // untouched by the turn, so the recitation itself never pauses for it.
  useEffect(() => {
    if (playingOrd == null) return;
    // ...unless the reader has turned the page themselves since. Then they are
    // steering and the recitation is only sound; it gets the wheel back the next
    // time playback is aimed on purpose.
    if (readerLedRef.current) return;
    const page = pageOfOrd(playingOrd);
    if (!page || visiblePages.includes(page)) return;
    followTurnRef.current = true;
    if (!goToPage(page)) followTurnRef.current = false;
  }, [playingOrd, visiblePages, goToPage]);

  // Ready the next verse's page (data + decoded font) while the current one is
  // still playing, so the follow-along turn lands on a page that draws at once.
  useEffect(() => {
    if (playingOrd == null || !isPlaying) return;
    const next = nextOrdAfter(playingOrd);
    const page = next == null ? null : pageOfOrd(next);
    if (!page || visiblePages.includes(page)) return;
    fetchMushafPage(page).catch(() => {});
    decodePageFont(page);
  }, [playingOrd, isPlaying, nextOrdAfter, visiblePages]);

  // Keep the pages around the one being read ready to draw — two turns each way,
  // re-ranked on every turn by one persistent queue (services/pagePrefetch.js),
  // so turning by hand is as instant as the turns playback makes. It starts once
  // the visible page has painted, holds while a page is still loading (so the
  // arrival has the connection), and yields to the audio warm-up while reciting.
  useEffect(() => {
    if (!pageArrived || pageError) { holdPrefetch(); return; }
    setPrefetchFocus({ visible: visiblePages, step: pageStep, playing: isPlaying });
  }, [pageArrived, pageError, visiblePages, pageStep, isPlaying]);
  useEffect(() => stopPrefetch, []);

  // ── Keyboard page-turning + shortcuts ────────────────────
  // RTL book: ArrowLeft/PageDown go forward, ArrowRight/PageUp go back — in both
  // UI languages. Escape peels back the top-most overlay; S (or F) shows/hides the
  // sidebar; P/H/E/T or 1/2/3/4 pick an annotation tool, turning annotate mode on if
  // it is off. Letter and digit shortcuts match the PHYSICAL key as well as the
  // produced character, so they work on a non-Latin layout — see utils/shortcutKeys.js.
  // Ignored while typing in a field or while a driver.js tour owns the screen.
  useEffect(() => {
    const onKey = (e) => {
      if (tourActiveRef.current) return;
      const el = e.target;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      // While annotating, page turns are suspended; Escape peels back one layer
      // (the toolbar first, then annotate mode itself — the same peel-back rule
      // Escape follows everywhere else in this reader), Ctrl+Z / Ctrl+Alt+Z (or
      // Ctrl+Shift+Z / Ctrl+Y) undo/redo, and P/H/E/T or 1-4 pick a tool. Keys are gated
      // by the input-focus check above, so typing a text note isn't intercepted.
      const mod = e.ctrlKey || e.metaKey;
      // Page turns keep working while annotating, so a run of pages can be marked
      // up without leaving the mode between each one. (Touch swipes still don't:
      // the drawing layer owns touch over the page, so a swipe there is a stroke.)
      const isPageTurnKey = ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key);
      // Undo / redo work in AND out of annotate mode: one timeline holds the ink
      // strokes and the verse annotations (highlights, hard flags, notes) in the
      // order they were made, so Ctrl+Z always undoes whichever came last.
      const z = isShortcutKey(e, 'z');
      const y = isShortcutKey(e, 'y');
      const wantsUndo = mod && z && !e.altKey && !e.shiftKey;
      const wantsRedo = mod && ((z && (e.altKey || e.shiftKey)) || y);
      if ((wantsUndo || wantsRedo) && (drawPage != null || signedInRef.current)) {
        e.preventDefault();
        (wantsUndo ? undoRef : redoRef).current?.();
        return;
      }
      if (drawPage != null && !isPageTurnKey) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (drawMenuOpen) setDrawMenuOpen(false);
          // Actions opened by a right-click while annotating fold away before the
          // mode itself is left — the same top-layer-first peel-back.
          else if (selectedVerseKey != null && !popoverHidden) setPopoverHidden(true);
          else if (rangeSelection?.actions) setRangeSelection(({ startOrd, endOrd }) => ({ startOrd, endOrd }));
          else exitDrawRef.current?.();
          return;
        }
        // A tool's own key picks it; pressing it again puts the tools away, and
        // once away stops annotating — the same ladder as its button. Never with
        // Ctrl / Alt / Meta held (Ctrl+1..4 switches browser tabs), and a held
        // key's auto-repeat is swallowed so holding it can't run the ladder.
        if (!mod && !e.altKey) {
          const tool = toolForKey(e);
          if (tool) { e.preventDefault(); if (!e.repeat) selectToolRef.current?.(tool); }
        }
        return;
      }
      // Annotate mode is OFF: a tool's key turns it on AND picks that tool, so
      // reaching for the pen is one keystroke rather than two.
      if (drawPage == null && !mod && !e.altKey) {
        const tool = toolForKey(e);
        if (tool) { e.preventDefault(); if (!e.repeat) startDrawRef.current?.(tool); return; }
        // 'S' shows/hides the sidebar. 'F' does the same — it used to toggle focus
        // mode, which this replaced, so the old key keeps working.
        if (isShortcutKey(e, 's') || isShortcutKey(e, 'f')) {
          e.preventDefault(); toggleSidebarRef.current?.(); return;
        }
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
          else if (selectedVerseKey != null && !popoverHidden) setPopoverHidden(true);
          else if (selectedVerseKey != null) setSelectedVerseKey(null);
          // A span's actions fold first and the span stays, like a verse's.
          else if (rangeSelection?.actions) setRangeSelection(({ startOrd, endOrd }) => ({ startOrd, endOrd }));
          else if (rangeSelection) setRangeSelection(null);
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, tafsirOpen, notePanel, readTextNote, selectedVerseKey, rangeSelection, popoverHidden, drawPage, drawMenuOpen]);

  // ── Touch swipe to turn the page (physical RTL book) ─────
  // Swipe right → next, swipe left → prev, but only when the horizontal move
  // clearly dominates (so vertical scrolling is never hijacked) and no tour runs.
  // Suspended while annotating (the drawing layer owns touch there).
  const touchStartRef = useRef(null);
  const onTouchStart = (e) => {
    if (tourActiveRef.current || drawPage != null) { touchStartRef.current = null; return; }
    const p = e.touches[0];
    const s = scrollerRef.current;
    touchStartRef.current = { x: p.clientX, y: p.clientY, left: s?.scrollLeft ?? 0, top: s?.scrollTop ?? 0 };
  };
  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || tourActiveRef.current || drawPage != null) return;
    // That gesture was a range drag, not a swipe (either check can be the one that
    // catches it — pointerup and touchend arrive in either order across browsers).
    if (rangeDragRef.current?.dragging || suppressWordClickRef.current) return;
    // On a zoomed page one finger pans it. A gesture that MOVED the page was a pan,
    // not a swipe: only a swipe that found the page already against its edge (so
    // there was nothing left to pan) turns it.
    const s = scrollerRef.current;
    if (s && (Math.abs(s.scrollLeft - start.left) > 2 || Math.abs(s.scrollTop - start.top) > 2)) return;
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

  // ── Drag across verses to pick a playback range ──────────
  // Press a verse and drag over the ones after it: the range starts where the
  // press landed and ends where the pointer is let go. Both ends are GLOBAL ayah
  // ordinals — the same addressing `rangeStartOrd`/`rangeEndOrd` already use — so a
  // released drag simply hands its two numbers to the range machinery that plays
  // and repeats them. There is no second, page-local idea of a range in here.
  //
  // Reaching the page's LEADING edge (visually LEFT — forward in a mushaf, in both
  // UI languages, exactly as the edge arrows are) turns the page and the range goes
  // on growing onto it, because the START ordinal never moves: a turn EXTENDS the
  // selection, it does not restart it. The turn waits out a dwell first, so a fast
  // drag across the width of the page can't flip it in passing.
  //
  // What it must not fight, and how:
  //   annotate mode        — the ink layer takes the pointer; `canDragRange` is off
  //   "mark verses"        — that two-tap mode owns taps; off
  //   hide-mode self-test  — a drag there walks the reveal watermark; off
  //   the swipe page-turn  — a finger has to press and HOLD first, and a gesture
  //                          that became a range drag is not also read as a swipe
  //   a plain word tap     — the trailing click is swallowed only after a real drag
  //
  // Not `useDragSelect`: that hook TOGGLES every tile a sweep crosses and has no
  // idea of a start and an end, which is the whole of what a range is. The house
  // habits it established are kept though — window-level moves, elementFromPoint
  // over a `data-` attribute, and swallowing the click that ends a drag.
  const canDragRange = drawPage == null && !markVersesMode && concealMode !== 'hide';
  const viewportRef = useRef(null);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  // The page sits in a scroller that only becomes one when zoomed; see
  // useMushafZoom for how the level is applied and why it bypasses React state.
  const scrollerRef = useRef(null);
  const zoom = useMushafZoom({ scrollerRef, viewportRef, isBlocked: () => tourActiveRef.current });
  const { isZoomed, toReadingStart: zoomToReadingStart } = zoom;
  // A turn keeps the zoom level and opens the new page where a page is read from:
  // its top, right-hand end.
  useLayoutEffect(() => { zoomToReadingStart(); }, [visiblePages, zoomToReadingStart]);
  const rangeDragRef = useRef(null);
  const suppressWordClickRef = useRef(false);
  // Set below, once showVerseActions exists: a long press that never became a drag
  // is touch's right-click, and this is how the drag hands it over.
  const showVerseActionsRef = useRef(null);
  // The range being dragged out right now. On release it is handed to
  // rangeStartOrd/rangeEndOrd and this goes back to null — the band below then
  // reads the real range, so nothing the reader sees changes at the handover.
  const [dragRange, setDragRange] = useState(null);

  // What the mushaf paints as a band: the drag in progress, else the span standing
  // selected. It is the SAME continuous per-verse band a single verse uses, so ten
  // verses read as one shape rather than ten.
  const bandStart = dragRange ? dragRange.startOrd : rangeSelection?.startOrd ?? null;
  const bandEnd = dragRange ? dragRange.endOrd : rangeSelection?.endOrd ?? null;
  const inRange = useCallback((verseKey) => {
    if (bandStart == null) return false;
    const ord = ordOfKey(verseKey);
    return ord != null && ord >= bandStart && ord <= bandEnd;
  }, [bandStart, bandEnd]);

  // Point repeat at [a, b] AND show it as the selection on the page. The drag and
  // the two pickers all come through here, so what is drawn and what will play can
  // never drift apart. The defaults effect further up deliberately does NOT use it
  // — keeping the pickers on the current page is bookkeeping, not a selection, and
  // must not light up the mushaf.
  const setRange = useCallback((a, b) => {
    const startOrd = Math.min(a, b);
    const endOrd = Math.max(a, b);
    setRangeStartOrd(startOrd);
    setRangeEndOrd(endOrd);
    setRangeSelection({ startOrd, endOrd });
  }, []);

  // Page turns are fired from a TIMER, not from the next pointermove: a reader who
  // parks the pointer at the edge and holds it perfectly still produces no further
  // moves at all, and would otherwise wait there for a turn that never comes. It
  // re-arms itself, so holding on keeps turning, one page per dwell.
  const goNextRef = useRef(null);
  const goPrevRef = useRef(null);
  useEffect(() => { goNextRef.current = goNext; goPrevRef.current = goPrev; }, [goNext, goPrev]);

  const endRangeDrag = useCallback(() => {
    const d = rangeDragRef.current;
    if (d?.holdTimer) clearTimeout(d.holdTimer);
    if (d?.edgeTimer) clearTimeout(d.edgeTimer);
    rangeDragRef.current = null;
    setDragRange(null);
    return d;
  }, []);

  const armEdgeTurn = useCallback((d, dir) => {
    if (d.edgeDir === dir) return;      // already waiting out this same edge
    clearTimeout(d.edgeTimer);
    d.edgeDir = dir;
    d.edgeTimer = null;
    if (!dir) return;
    const turn = () => {
      if (rangeDragRef.current !== d || d.edgeDir !== dir) return;
      selectTurnRef.current = true;     // this turn is ours: keep the selection and the panel
      if (dir === 'next' ? goNextRef.current?.() : goPrevRef.current?.()) d.extendTo = dir;
      else selectTurnRef.current = false;   // nothing to turn to — don't leave it armed
      // Slower once it is running: the first turn answers "I want the next page",
      // the ones after it are an unattended sweep, and a mushaf page holds a lot of
      // verses to overshoot by.
      d.edgeTimer = setTimeout(turn, RANGE_EDGE_REPEAT);
    };
    d.edgeTimer = setTimeout(turn, RANGE_EDGE_DWELL);
  }, []);

  const rangeDragDown = (e) => {
    suppressWordClickRef.current = false;   // a new gesture owes nothing to the last one
    if (!canDragRange || tourActiveRef.current) return;
    if (e.button > 0) return;               // primary button only
    const wordEl = e.target?.closest?.('[data-verse-key]');
    const ord = wordEl ? ordOfKey(wordEl.getAttribute('data-verse-key')) : null;
    if (ord == null) return;
    const touch = e.pointerType !== 'mouse';
    const d = {
      pointerId: e.pointerId, touch, startOrd: ord, lastOrd: ord,
      x: e.clientX, y: e.clientY,
      armed: !touch, dragging: false, edgeDir: null, edgeTimer: null,
      extendTo: null, holdTimer: null,
    };
    if (touch) {
      // A finger presses and HOLDS, the way a phone starts a text selection.
      // Anything shorter stays a tap or a swipe — both already mean something here.
      d.holdTimer = setTimeout(() => {
        const cur = rangeDragRef.current;
        if (!cur || cur.pointerId !== e.pointerId) return;
        cur.armed = true;
        cur.dragging = true;   // the band appears on the hold itself, so the hold is visible
        setDragRange({ startOrd: cur.startOrd, endOrd: cur.startOrd });
      }, RANGE_TOUCH_HOLD);
    }
    rangeDragRef.current = d;
  };

  // A drag that really happened must not ALSO be read as a tap on whichever word it
  // finished over. Capture phase, so the word's own onClick never runs.
  const swallowRangeClick = (e) => {
    if (!suppressWordClickRef.current) return;
    suppressWordClickRef.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    const paint = (d) => {
      // Dragging out a span replaces whatever single verse was picked — there is
      // one selection, and this drag is now it. (The reverse is handled where a
      // word is clicked; between them, exactly one of the two is ever set.)
      setSelectedVerseKey(null);
      setDragRange({
        startOrd: Math.min(d.startOrd, d.lastOrd),
        endOrd: Math.max(d.startOrd, d.lastOrd),
      });
    };

    // The range's moving end follows whatever word is under (x, y).
    const extendAt = (d, x, y) => {
      // elementFromPoint rather than pointerenter on the words: touch never fires
      // enter/leave mid-gesture, and the edge dwell needs the coordinates anyway.
      const wordEl = document.elementFromPoint(x, y)?.closest?.('[data-verse-key]');
      const ord = wordEl ? ordOfKey(wordEl.getAttribute('data-verse-key')) : null;
      if (ord != null) { d.lastOrd = ord; d.extendTo = null; }
      paint(d);

      // The PAGE's edge, not the window's: on a zoomed page the leading edge only
      // counts once it has been scrolled into view.
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      armEdgeTurn(d, x <= rect.left + RANGE_EDGE_W ? 'next'
        : x >= rect.right - RANGE_EDGE_W ? 'prev'
          : null);
    };

    // On a zoomed page the verses the range wants can be out of view. Holding the
    // pointer near an edge of the visible part scrolls it that way — the way a text
    // selection does — faster the closer it gets, and the range keeps following the
    // word under the (still) pointer. Once there is nothing left to scroll, the edge
    // dwell above takes over and turns the page.
    let autoRaf = 0;
    const autoScroll = (d) => {
      cancelAnimationFrame(autoRaf);
      autoRaf = 0;
      const s = scrollerRef.current;
      if (!s || !isZoomed()) return;
      const tick = () => {
        autoRaf = 0;
        if (rangeDragRef.current !== d || !d.dragging) return;
        const b = s.getBoundingClientRect();
        const top = Math.max(b.top, 0);
        const bottom = Math.min(b.bottom, window.innerHeight);
        const speed = (dist) => Math.min(1, Math.max(0, (RANGE_SCROLL_EDGE - dist) / RANGE_SCROLL_EDGE)) * RANGE_SCROLL_SPEED;
        const vx = d.px < b.left + RANGE_SCROLL_EDGE ? -speed(d.px - b.left)
          : d.px > b.right - RANGE_SCROLL_EDGE ? speed(b.right - d.px) : 0;
        const vy = d.py < top + RANGE_SCROLL_EDGE ? -speed(d.py - top)
          : d.py > bottom - RANGE_SCROLL_EDGE ? speed(bottom - d.py) : 0;
        if (!vx && !vy) return;
        const [left0, top0] = [s.scrollLeft, s.scrollTop];
        s.scrollBy({ left: vx, top: vy, behavior: 'instant' });
        if (s.scrollLeft === left0 && s.scrollTop === top0) return;   // against the edge already
        extendAt(d, d.px, d.py);
        autoRaf = requestAnimationFrame(tick);
      };
      autoRaf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      const d = rangeDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.armed) {
        // Moved before the hold finished: that gesture is a swipe or a scroll, and
        // it belongs to them, not to us.
        if (Math.abs(e.clientX - d.x) > RANGE_DRAG_SLOP || Math.abs(e.clientY - d.y) > RANGE_DRAG_SLOP) endRangeDrag();
        return;
      }
      if (!d.dragging) {
        if (Math.abs(e.clientX - d.x) <= RANGE_DRAG_SLOP && Math.abs(e.clientY - d.y) <= RANGE_DRAG_SLOP) return;
        d.dragging = true;
      }
      d.px = e.clientX;
      d.py = e.clientY;
      extendAt(d, e.clientX, e.clientY);
      autoScroll(d);
    };

    const onUp = (e) => {
      const d = rangeDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      endRangeDrag();
      if (!d.dragging) return;                  // a tap after all — the word keeps it
      suppressWordClickRef.current = true;
      const startOrd = Math.min(d.startOrd, d.lastOrd);
      const endOrd = Math.max(d.startOrd, d.lastOrd);
      if (startOrd === endOrd) {
        // Never left the verse it started on. Under a FINGER that is a completed
        // long press and nothing else — touch has no right button, so this is the
        // gesture that opens the verse's actions. Under a mouse it is a stray
        // wobble, and a wobble should do nothing.
        if (d.touch) showVerseActionsRef.current?.(keyOfOrd(d.startOrd));
        return;
      }
      // The offer: point the range at what was just dragged out and open the repeat
      // panel, which is where both counts and "Play range" already live.
      setRange(startOrd, endOrd);
      setRepeatMode('range');
      setRepeatOpen(true);
      showToast(t('library.audio.rangeDragHint', { verses: fmtNum(endOrd - startOrd + 1) }), 'info');
    };

    const onCancel = () => { endRangeDrag(); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      cancelAnimationFrame(autoRaf);
    };
  }, [armEdgeTurn, endRangeDrag, setRange, showToast, t, fmtNum, isZoomed]);

  // A page turned under the drag: reach the range onto the verse just across the
  // boundary, so the band grows even if the pointer never moves again. startOrd is
  // untouched — that is what makes this extend the selection rather than restart it.
  useEffect(() => {
    const d = rangeDragRef.current;
    if (!d?.extendTo || verses.length === 0) return;
    const ords = verses.map((v) => ordOfKey(v.verseKey)).filter((o) => o != null);
    if (!ords.length) return;
    d.lastOrd = d.extendTo === 'next' ? Math.min(...ords) : Math.max(...ords);
    d.extendTo = null;
    setDragRange({ startOrd: Math.min(d.startOrd, d.lastOrd), endOrd: Math.max(d.startOrd, d.lastOrd) });
  }, [verses]);

  // While a FINGER is picking a range the page must not scroll under it. The hold
  // has already passed by then and no scroll has begun, so cancelling the touch
  // here still works — which it would not if we waited for the movement to start.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onTouchMove = (e) => {
      const d = rangeDragRef.current;
      if (d?.touch && d.dragging && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const selectVerse = useCallback((verseKey) => {
    setSelectedVerseKey(prev => (prev === verseKey ? null : verseKey));
    setSeenVerseTap(true);
    localStorage.setItem('seenVerseTapCue', '1'); // the "tap a verse" cue has served its purpose
  }, []);

  // Re-reads memorized/partial pages after a units mutation — cheaper to just
  // refetch than to reconcile every affected page's fraction locally.
  const refreshMemorizedPages = useCallback(() => {
    if (!signedInRef.current) return;
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
  //
  // A plain click SELECTS AND NOTHING ELSE. Picking out a verse is the common
  // thing a reader does — to see where they are, to point at a line — and putting
  // a toolbar over the page every single time made the mushaf hard to read. The
  // actions are on the secondary gesture instead (see showVerseActions).
  //
  // The rest of the ladder is unchanged, so a popover that IS up still folds away
  // before the selection drops:
  //   1. not selected      -> select it, quietly
  //   2. selected, actions -> put the actions away, KEEP the verse selected
  //   3. selected, no acts -> deselect entirely
  // Clicking off the verse does the same thing at each stage: away, then out.
  const handleWordSelect = useCallback((verseKey) => {
    if (markVersesMode) { handleMarkVersesTap(verseKey); return; }
    // Picking one verse replaces a picked span, the same way it replaces another
    // single verse: there is one selection, and this click is now it.
    setRangeSelection(null);
    if (verseKey === selectedVerseKey) {
      if (!popoverHidden) setPopoverHidden(true);   // 1 -> 2
      else { setPopoverHidden(false); setSelectedVerseKey(null); }   // 2 -> 3
      return;
    }
    placeNextRef.current = true; // anchor the popover here if it is asked for next
    setPopoverHidden(true);
    selectVerse(verseKey);
  }, [markVersesMode, handleMarkVersesTap, selectVerse, popoverHidden, selectedVerseKey]);

  // The secondary gesture: RIGHT-CLICK a verse, or — where there is no right
  // button — press and hold it and let go without dragging, which is the touch
  // equivalent and the same press that starts a range drag if you do move. Either
  // way it selects the verse and opens its actions, anchored where the press
  // landed. Unconditional, not a toggle: asking for the actions twice keeps them.
  //
  // With a span picked it follows the usual selection rule: the press lands INSIDE
  // the span → the actions are for the whole span, which stays as it is; OUTSIDE it
  // → that one verse replaces the span.
  const showVerseActions = useCallback((verseKey) => {
    if (markVersesMode) return;   // the two-tap picking mode owns taps
    const ord = ordOfKey(verseKey);
    placeNextRef.current = true;
    setPopoverPlaceTick((n) => n + 1);   // re-place even if the actions are already up
    setSeenVerseTap(true);
    localStorage.setItem('seenVerseTapCue', '1');
    const span = rangeSelectionRef.current;
    if (span && ord != null && ord >= span.startOrd && ord <= span.endOrd) {
      setSelectedVerseKey(null);
      setRangeSelection({ startOrd: span.startOrd, endOrd: span.endOrd, actions: true });
      return;
    }
    setRangeSelection(null);
    setPopoverHidden(false);
    setSelectedVerseKey(verseKey);
  }, [markVersesMode]);
  useEffect(() => { showVerseActionsRef.current = showVerseActions; }, [showVerseActions]);

  // ── Right-click while annotating ──
  // In annotate mode the ink layer covers the words, so a plain click draws and
  // can never reach them. The right button (never used for ink) reaches THROUGH
  // the layer instead: it hands over the press's screen point, we look for the
  // word underneath, and the press means what a right-click means when not
  // annotating:
  //   - hide-all self-test on → the same reveal → select → hide ladder a plain
  //     click runs (a quiet select: the verse is banded, the tafsir follows it);
  //   - self-test off         → select the verse and open its actions (or a
  //     span's, by the span rule), so highlighting works mid-annotation;
  //   - cover self-test on    → nothing: the press is inert.
  //
  // Hit-testing the point (not the layer's page) means a spread and a zoomed page
  // need nothing special: whichever word is under the pointer is the one meant,
  // and its concealed state is read from ITS page's watermark, as the click path
  // reads it. Blank margin finds no word and does nothing.
  const selfTestWhileDrawing = drawPage != null && concealMode === 'hide';
  const actionsAtPoint = useCallback((x, y) => {
    const word = wordAtPoint(x, y);
    if (!word) return;
    lastPointerRef.current = { x, y };   // the popover keeps its distance from this spot
    showVerseActions(word.getAttribute('data-verse-key'));
  }, [showVerseActions]);
  const cycleVerseAtPoint = useCallback((x, y) => {
    const word = wordAtPoint(x, y);
    if (!word) return;
    const verseKey = word.getAttribute('data-verse-key');
    const key = `${verseKey}:${word.getAttribute('data-word-position')}`;
    let concealed = false;
    for (const [page, order] of pageOrders) {
      const idx = order.indexOf.get(key);
      if (idx == null) continue;
      concealed = idx > (watermarks[page] ?? -1);
      break;
    }
    const step = hideModeStep({ concealed, selected: verseKey === selectedVerseKey });
    if (step === 'reveal') revealVerse(verseKey);
    else if (step === 'hide') hideVerse(verseKey);
    else handleWordSelect(verseKey);
  }, [pageOrders, watermarks, selectedVerseKey, revealVerse, hideVerse, handleWordSelect]);
  const secondaryPressWhileDrawing = drawPage == null ? undefined
    : concealMode === 'hide' ? cycleVerseAtPoint
      : concealMode == null ? actionsAtPoint
        : undefined;

  // Entering "mark verses" clears any selected verse so its popover (with the
  // annotation actions) can't fire while the two-word picking mode owns taps.
  const startMarkVerses = useCallback(() => {
    setSelectedVerseKey(null);
    setMarkVersesMode(true);
  }, []);

  // ── Annotations: highlights / notes / hard flags (verse-anchored) ──
  // Load all annotations for the given pages, replacing each page's cached list.
  const loadAnnotationsForPages = useCallback((pages) => {
    if (!signedInRef.current) return;
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
    if (!signedInRef.current) return;
    annotationsAPI.listByKind('hard')
      .then((r) => setHardList(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // The per-page annotation summary powers the navigator; refetched after any
  // mutation so its counts/jump targets stay current.
  const loadSummary = useCallback(() => {
    if (!signedInRef.current) return;
    annotationsAPI.getSummary()
      .then((r) => setAnnoSummary(r.data?.data ?? []))
      .catch(() => {});
  }, []);

  // Load the visible page(s)' annotations alongside the mushaf pages, and the
  // hard list + summary once (both span every page, kept independently).
  useEffect(() => { if (pageResolved && signedIn) loadAnnotationsForPages(visiblePages); }, [visiblePages, pageResolved, signedIn, loadAnnotationsForPages]);
  useEffect(() => { if (signedIn) { loadHardList(); loadSummary(); } }, [signedIn, loadHardList, loadSummary]);

  const findAnn = useCallback(
    (page, predicate) => (annotationsByPage.get(page) ?? []).find(predicate),
    [annotationsByPage]
  );

  // ── One path for every verse-annotation change ─────────────────────
  // A popover action, its undo and its redo all go through the batch endpoint:
  // the server is told the STATE each verse should end in (a colour or none, hard
  // or not, a note's text or none) and reports what each was before — which is
  // exactly what the undo history keeps. Keyed by page + verse + kind, never by
  // _id: an undo that re-creates a highlight gives it a new id, and a redo after
  // that must still find it. One request however many verses a span holds.
  const visiblePagesRef = useRef(visiblePages);
  useEffect(() => { visiblePagesRef.current = visiblePages; }, [visiblePages]);
  const spanAnnsReloadRef = useRef(null);   // the open span's state loader, once it exists
  const annoBusyRef = useRef(false);        // one annotation write (or undo) at a time

  const commitAnnoOps = useCallback(async (ops) => {
    const res = await annotationsAPI.batch(ops);
    const results = res.data?.data?.results ?? [];
    const pages = [...new Set(results.map((r) => r.pageNumber))];
    const onScreen = pages.filter((p) => visiblePagesRef.current.includes(p));
    const offScreen = pages.filter((p) => !visiblePagesRef.current.includes(p));
    loadAnnotationsForPages(onScreen);
    // A page off screen is refetched when it is next shown; drop the copy held
    // for it so that visit can't flash the state from before this change.
    if (offScreen.length) {
      setAnnotationsByPage((prev) => {
        if (!offScreen.some((p) => prev.has(p))) return prev;
        const next = new Map(prev);
        offScreen.forEach((p) => next.delete(p));
        return next;
      });
    }
    if (results.some((r) => r.kind === 'hard')) loadHardList();
    loadSummary();
    spanAnnsReloadRef.current?.();
    return results;
  }, [loadAnnotationsForPages, loadHardList, loadSummary]);

  // ── Undo history (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, and the toasts' Undo) ──
  // ONE timeline for the session: the verse-annotation changes above and, while
  // annotating, the ink strokes, in the order they were made — so Ctrl+Z undoes
  // whichever came last. An annotation step holds each verse's before and after
  // state; an ink step only names its page, whose snapshot stacks (undoStacksRef /
  // redoStacksRef) hold the ink itself. Session-local, capped. Self-test reveals,
  // page turns, selection changes and bookmarks (which have their own Restore)
  // are never recorded.
  const historyRef = useRef({ undo: [], redo: [] });
  const historyRunRef = useRef(null);   // (dir) => void, set once the runner exists
  const pushHistory = useCallback((step) => {
    const h = historyRef.current;
    h.undo.push(step);
    if (h.undo.length > HISTORY_CAP) h.undo.shift();
    h.redo = [];
    redoStacksRef.current = {};   // a new change ends every redo, the ink's included
    bumpHistory();
  }, []);
  // Ink steps stop meaning anything once their page's snapshots are reset (the
  // page left the screen, or annotate mode ended). `page` null drops them all.
  const dropInkSteps = useCallback((page = null) => {
    const h = historyRef.current;
    const keep = (s) => s.type !== 'ink' || (page != null && s.page !== page);
    h.undo = h.undo.filter(keep);
    h.redo = h.redo.filter(keep);
    bumpHistory();
  }, []);
  const recordAnnoStep = useCallback((results, what) => {
    const ops = results.filter((r) => r.before !== r.after);
    if (!ops.length) return null;
    const step = { type: 'anno', what, ops };
    pushHistory(step);
    return step;
  }, [pushHistory]);
  // A toast's Undo / Redo button acts on ITS step, and only while that step is
  // still the latest one — reversing an older change out of order would leave the
  // steps above it pointing at states that no longer hold.
  const historyToastAction = useCallback((step, dir) => ({
    label: t(dir === 'undo' ? 'library.history.undo' : 'library.history.redo'),
    onClick: () => {
      const list = dir === 'undo' ? historyRef.current.undo : historyRef.current.redo;
      if (list[list.length - 1] === step) historyRunRef.current?.(dir);
      else showToast(t('library.history.notLatest'), 'info');
    },
  }), [t, showToast]);

  // A popover action: commit it, record it as ONE undo step, confirm with an Undo
  // button (the touch screen's Ctrl+Z). Resolves true once saved.
  const applyVerseAction = useCallback(async (ops, what, message) => {
    if (annoBusyRef.current) return false;
    if (ops.length > MAX_SPAN_OPS) {
      showToast(t('library.span.tooMany', { max: fmtNum(MAX_SPAN_OPS) }), 'error');
      return false;
    }
    annoBusyRef.current = true;
    setSavingAnnotation(true);
    try {
      const results = await commitAnnoOps(ops);
      const step = recordAnnoStep(results, what);
      showToast(message, 'success', step ? { action: historyToastAction(step, 'undo'), duration: UNDO_TOAST_MS } : undefined);
      return true;
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
      return false;
    } finally {
      annoBusyRef.current = false;
      setSavingAnnotation(false);
    }
  }, [commitAnnoOps, recordAnnoStep, historyToastAction, showToast, t, fmtNum]);

  // Highlight a verse in `color`; clicking the active colour again removes it,
  // a different colour updates it (whole-verse; word spans stay a server option).
  const setVerseHighlight = useCallback((page, verseKey, color) => {
    const existing = findAnn(page, (a) => a.kind === 'highlight' && a.verseKey === verseKey);
    const value = existing?.color === color ? null : color;
    applyVerseAction([{ kind: 'highlight', pageNumber: page, verseKey, value }], 'highlight',
      t(value ? 'library.annotations.highlightAdded' : 'library.annotations.highlightRemoved'));
  }, [findAnn, applyVerseAction, t]);

  // Toggle a verse-level or (verseKey null) whole-page hard flag.
  const toggleHard = useCallback((page, verseKey) => {
    const existing = findAnn(page, (a) => a.kind === 'hard' && (a.verseKey ?? null) === (verseKey ?? null));
    applyVerseAction([{ kind: 'hard', pageNumber: page, verseKey: verseKey ?? null, value: !existing }], 'hard',
      t(existing ? 'library.annotations.hardRemoved' : 'library.annotations.hardAdded'));
  }, [findAnn, applyVerseAction, t]);

  // Open the note editor for a verse (prefilled if a note already exists). Closes
  // the tafsir sheet so the two side panels never stack.
  const openNote = useCallback((page, verseKey) => {
    const existing = findAnn(page, (a) => a.kind === 'note' && a.verseKey === verseKey);
    setTafsirOpen(false);
    setNotePanel({ pageNumber: page, verseKey, id: existing?._id ?? null });
    setNoteDraft(existing?.text ?? '');
  }, [findAnn]);

  // Saving and removing a note are undoable like the rest: the reply carries the
  // note's previous text, so an undo can put exactly that text back.
  const writeNote = useCallback(async (text) => {
    const { pageNumber, verseKey } = notePanel;
    setSavingNote(true);
    const ok = await applyVerseAction([{ kind: 'note', pageNumber, verseKey, value: text || null }], 'note',
      t(text ? 'library.annotations.noteSaved' : 'library.annotations.noteDeleted'));
    setSavingNote(false);
    if (ok) { setNotePanel(null); setNoteDraft(''); }
  }, [notePanel, applyVerseAction, t]);

  const saveNote = useCallback(() => {
    if (!notePanel || savingNote) return;
    const text = noteDraft.trim();
    if (!text && !notePanel.id) { setNotePanel(null); setNoteDraft(''); return; }   // nothing to save or remove
    writeNote(text);
  }, [notePanel, noteDraft, savingNote, writeNote]);

  const deleteNote = useCallback(() => {
    if (!notePanel || savingNote) return;
    if (!notePanel.id) { setNotePanel(null); setNoteDraft(''); return; }
    writeNote('');
  }, [notePanel, savingNote, writeNote]);

  // Remove a hard item from the sidebar list (the page refreshes if it's on screen).
  const removeHardItem = useCallback((item) => {
    applyVerseAction([{ kind: 'hard', pageNumber: item.pageNumber, verseKey: item.verseKey ?? null, value: false }], 'hard',
      t('library.annotations.hardRemoved'));
  }, [applyVerseAction, t]);

  // ── The picked span's actions ──────────────────────────────────────
  // Up while a right-click landed inside a picked span. Every verse of the span,
  // each on the page it is annotated on: the on-screen page that shows it (what a
  // single verse's popover uses), else the page it starts on — so a span that
  // crosses a page turn writes each verse to its own page.
  const spanActionsOpen = !!rangeSelection?.actions && !dragRange && selectedVerseKey == null;
  const spanVerses = useMemo(() => {
    if (!spanActionsOpen) return [];
    const pageOnScreen = new Map(verses.map((v) => [v.verseKey, v.page]));
    const out = [];
    for (let ord = rangeSelection.startOrd; ord <= rangeSelection.endOrd; ord++) {
      const verseKey = keyOfOrd(ord);
      out.push({ ord, verseKey, page: pageOnScreen.get(verseKey) ?? pageOfOrd(ord) });
    }
    return out;
  }, [spanActionsOpen, rangeSelection, verses]);
  const spanFrom = spanVerses.length ? Math.min(...spanVerses.map((v) => v.page)) : null;
  const spanTo = spanVerses.length ? Math.max(...spanVerses.map((v) => v.page)) : null;

  // The span's current annotations, read in ONE request however many pages it
  // reaches (most of them are usually off screen). Reloaded after every change
  // while the actions are up; only the latest reply is kept.
  const [spanAnns, setSpanAnns] = useState(null);   // { from, to, list }
  const spanAnnsReqRef = useRef(0);
  const loadSpanAnns = useCallback(() => {
    if (spanFrom == null || !signedInRef.current) return;
    const req = ++spanAnnsReqRef.current;
    annotationsAPI.listVerseRange(spanFrom, spanTo)
      .then((r) => { if (req === spanAnnsReqRef.current) setSpanAnns({ from: spanFrom, to: spanTo, list: r.data?.data ?? [] }); })
      .catch(() => {});
  }, [spanFrom, spanTo]);
  useEffect(() => {
    spanAnnsReloadRef.current = spanFrom == null ? null : loadSpanAnns;
    loadSpanAnns();
  }, [loadSpanAnns, spanFrom]);

  // How much of the span each colour and the hard flag cover — 'all', 'some' or
  // 'none' drive the swatches' pressed / mixed / plain looks and what a press does.
  const spanState = useMemo(() => {
    if (!spanVerses.length || !spanAnns || spanAnns.from !== spanFrom || spanAnns.to !== spanTo) return null;
    const first = new Map();   // the oldest doc per key, as the server reads a verse's state
    for (const a of spanAnns.list) {
      const k = `${a.pageNumber}|${a.verseKey ?? ''}|${a.kind}`;
      if (!first.has(k)) first.set(k, a);
    }
    const colors = Object.fromEntries(ANNOTATION_COLORS.map(({ key }) => [key, 0]));
    let highlighted = 0;
    let hard = 0;
    for (const v of spanVerses) {
      const h = first.get(`${v.page}|${v.verseKey}|highlight`);
      if (h) { highlighted++; colors[h.color] = (colors[h.color] ?? 0) + 1; }
      if (first.has(`${v.page}|${v.verseKey}|hard`)) hard++;
    }
    const cover = (n) => (n === 0 ? 'none' : n === spanVerses.length ? 'all' : 'some');
    return {
      total: spanVerses.length,
      color: Object.fromEntries(Object.entries(colors).map(([k, n]) => [k, cover(n)])),
      highlighted,
      hard: cover(hard),
    };
  }, [spanVerses, spanAnns, spanFrom, spanTo]);

  const spanVersesLabel = useCallback((n) => t('library.span.verses', { count: n, n: fmtNum(n) }), [t, fmtNum]);

  // A colour on a span toggles the way a tile range does: if EVERY verse already
  // has it, it comes off all of them; otherwise all of them get it. `null` (the
  // remove button) clears every highlight in the span.
  const setSpanHighlight = useCallback((color) => {
    if (!spanState) return;
    const value = color == null || spanState.color[color] === 'all' ? null : color;
    applyVerseAction(
      spanVerses.map((v) => ({ kind: 'highlight', pageNumber: v.page, verseKey: v.verseKey, value })),
      'highlight',
      t(value ? 'library.span.highlightAdded' : 'library.span.highlightRemoved', { verses: spanVersesLabel(spanState.total) }),
    );
  }, [spanState, spanVerses, applyVerseAction, t, spanVersesLabel]);

  const toggleSpanHard = useCallback(() => {
    if (!spanState) return;
    const value = spanState.hard !== 'all';
    applyVerseAction(
      spanVerses.map((v) => ({ kind: 'hard', pageNumber: v.page, verseKey: v.verseKey, value })),
      'hard',
      t(value ? 'library.span.hardAdded' : 'library.span.hardRemoved', { verses: spanVersesLabel(spanState.total) }),
    );
  }, [spanState, spanVerses, applyVerseAction, t, spanVersesLabel]);

  // Close the note sheet when the reader turns the page.
  useEffect(() => { setNotePanel(null); }, [currentPage]);

  // ── Drawing (annotate mode) ────────────────────────────────────────
  // Keep the latest page+strokes in a ref so a flush (debounce fire, exit, page
  // change, unmount) always saves the freshest state without stale closures.
  const flushDrawing = useCallback(async () => {
    if (drawSaveTimerRef.current) { clearTimeout(drawSaveTimerRef.current); drawSaveTimerRef.current = null; }
    const pages = [...drawDirtyRef.current];
    if (!pages.length) return;
    drawDirtyRef.current = new Set();
    try {
      // Both halves of a spread can be dirty at once, so save each of them.
      await Promise.all(pages.map((page) =>
        annotationsAPI.saveDrawing({ pageNumber: page, strokes: drawStrokesRef.current[page] ?? [] })));
      loadSummary();
      // Refresh what we hold for those pages. Without this the cache still has the
      // pre-save doc, and turning back to a page would reseed the working copy
      // from it — showing the ink gone, and saving over it on the next stroke.
      loadAnnotationsForPages(pages);
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    }
  }, [loadSummary, loadAnnotationsForPages, showToast, t]);

  const scheduleDrawSave = useCallback((page) => {
    drawDirtyRef.current.add(page);
    if (drawSaveTimerRef.current) clearTimeout(drawSaveTimerRef.current);
    drawSaveTimerRef.current = setTimeout(() => { flushDrawing(); }, 1500); // ~1.5s after last stroke
  }, [flushDrawing]);

  // Apply a new strokes snapshot, recording history for undo/redo. Every ink
  // change (draw, erase, clear) funnels through here; `record` pushes the prior
  // snapshot onto the page's undo stack and puts a step for it on the reader's one
  // timeline (which also ends every redo).
  const applyStrokes = useCallback((page, next, record = true) => {
    if (record) {
      const undo = undoStacksRef.current[page] ?? (undoStacksRef.current[page] = []);
      undo.push(drawStrokesRef.current[page] ?? []);
      if (undo.length > HISTORY_CAP) undo.shift();
      pushHistory({ type: 'ink', page });
    }
    drawStrokesRef.current = { ...drawStrokesRef.current, [page]: next };
    setDrawStrokesByPage(drawStrokesRef.current);
    lastDrawnPageRef.current = page;
    scheduleDrawSave(page);
    bumpHistory();
  }, [scheduleDrawSave, pushHistory]);

  const handleDrawChange = useCallback((page, next) => applyStrokes(page, next, true), [applyStrokes]);

  // Keep a working copy of the ink for every page on screen.
  //
  // This has to react to the SAVED DOC ARRIVING, not just to the page changing:
  // turning the page refetches its annotations, so seeding at turn time would
  // seed from nothing and leave a page that has ink looking blank — and the next
  // stroke would then save over what was there. A page with unsaved ink of its
  // own is never reseeded, and pages that scroll away are dropped once clean.
  useEffect(() => {
    if (drawPage == null) return;
    const next = { ...drawStrokesRef.current };
    let changed = false;
    for (const page of visiblePages) {
      if (drawDirtyRef.current.has(page)) continue;
      const saved = (annotationsByPage.get(page) ?? []).find((a) => a.kind === 'drawing')?.strokes ?? [];
      const have = next[page];
      if (have === undefined || (have.length === 0 && saved.length > 0)) {
        next[page] = saved;
        undoStacksRef.current[page] = [];    // history is session-local, per page
        redoStacksRef.current[page] = [];
        dropInkSteps(page);
        changed = true;
      }
    }
    for (const key of Object.keys(next)) {
      const page = Number(key);
      if (!visiblePages.includes(page) && !drawDirtyRef.current.has(page)) { delete next[key]; dropInkSteps(page); changed = true; }
    }
    if (!changed) return;
    drawStrokesRef.current = next;
    setDrawStrokesByPage(next);
    bumpHistory();
  }, [drawPage, visiblePages, annotationsByPage, dropInkSteps]);

  const enterDraw = useCallback((page) => {
    if (!signedInRef.current) return;   // ink is saved to the account
    setSelectedVerseKey(null);
    setAnnoVisible(true);                 // drawing always shows what you're editing
    drawStrokesRef.current = {};          // the effect above seeds every visible page
    setDrawStrokesByPage({});
    drawDirtyRef.current = new Set();
    lastDrawnPageRef.current = page;
    setDrawPage(page);                    // the anchor: whose pencil, where the toolbar hangs
    setDrawMenuOpen(true);                // the toolbar comes up with the mode
    bumpHistory();
  }, []);

  const exitDraw = useCallback(async () => {
    await flushDrawing();
    setDrawPage(null);
    setDrawMenuOpen(false);
    setClearConfirm(false);
    lastDrawnPageRef.current = null;
    // The ink's history ends with the mode (its snapshots are reset on the next
    // entry); the verse annotations' steps stay undoable outside it.
    dropInkSteps();
    loadAnnotationsForPages(visiblePages);
  }, [flushDrawing, visiblePages, loadAnnotationsForPages, dropInkSteps]);

  // The pencil cycles through the three states, so one button covers all of them:
  //   1. off            -> annotating, toolbar shown
  //   2. toolbar shown   -> toolbar hidden, STILL ANNOTATING (same as clicking off it)
  //   3. toolbar hidden  -> off, normal cursor
  // State 2 and state 3 have to be tellable apart at a glance — whether the next
  // stroke draws depends on it — and with the toolbar gone in state 2 there is no
  // chip to say so. Three things do instead: the page card carries a soft accent
  // ring (`is-annotating`), the pencil button stays filled, and the cursor over the
  // page is a crosshair. State 3 has none of them.
  const toggleDraw = useCallback((page) => {
    if (drawPage !== page) enterDraw(page);
    else if (drawMenuOpen) setDrawMenuOpen(false);
    else exitDraw();
  }, [drawPage, drawMenuOpen, exitDraw, enterDraw]);
  useEffect(() => { exitDrawRef.current = exitDraw; }, [exitDraw]);

  // What a tool's key does when annotate mode is OFF: turn it on for the page in
  // front of the reader, with that tool already picked.
  const startDrawWithTool = useCallback((tool) => {
    if (markVersesMode) return;   // the picking mode owns taps; the pencil is disabled too
    if (!signedInRef.current) return;   // ink belongs to an account; the pencil is hidden too
    setDrawTool(tool);
    enterDraw(twoPage ? activePage : currentPage);
  }, [markVersesMode, enterDraw, twoPage, activePage, currentPage]);
  const startDrawRef = useRef(null);
  useEffect(() => { startDrawRef.current = startDrawWithTool; }, [startDrawWithTool]);

  // Picking the tool that is ALREADY active puts the tools away and leaves you
  // drawing — that is the point of picking a tool, and the open menu is sitting
  // over the page you want to draw on. Only once they are already away does the
  // same gesture stop annotating, which keeps one rule for the button and its
  // key: reach for the tool, then get the menu out of the way, then stop.
  //
  // (The button can only ever hit the first branch — with the menu shut there is
  // no button to click — so the second is what a key press does from state 2.)
  const selectTool = useCallback((tool) => {
    if (drawTool !== tool) { setDrawTool(tool); return; }
    if (drawMenuOpen) setDrawMenuOpen(false);
    else exitDraw();
  }, [drawTool, drawMenuOpen, exitDraw]);

  // A colour swatch behaves the same way: choosing the one already in use means
  // "yes, this one" — so get the tools out of the way and let the drawing start.
  const selectColor = useCallback((color) => {
    if (drawColor === color) setDrawMenuOpen(false);
    else setDrawColor(color);
  }, [drawColor]);
  useEffect(() => { selectToolRef.current = selectTool; }, [selectTool]);

  // A click anywhere outside the toolbar collapses it and leaves annotate mode
  // ON, so the very stroke that collapsed it still lands on the page. Capture
  // phase (the toolbar stops propagation on its own pointerdown) and never
  // preventDefault, so the drawing layer still receives the pointer.
  useEffect(() => {
    if (drawPage == null || !drawMenuOpen) return;
    const onPointerDown = (e) => {
      if (drawMenuRef.current?.contains(e.target)) return;
      // The pencil runs the cycle itself (show -> hide -> off); collapsing the
      // menu from under it here would eat the middle step.
      if (drawAnchorRef.current?.contains(e.target)) return;
      setDrawMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [drawPage, drawMenuOpen]);

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
  }, [drawPage, drawMenuOpen, positionDrawMenu]);

  // The page clear acts on: whichever was drawn on last, or the anchor before any
  // ink has been laid down.
  const targetDrawPage = () => lastDrawnPageRef.current ?? drawPage;

  // Moves one page's ink a step back (undo) or forward (redo) along its snapshot
  // stacks. False when there is nothing to move there: annotate mode is off, the
  // page is off screen, or its history was reset when it was last loaded.
  const moveInk = (page, dir) => {
    if (drawPage == null || !visiblePages.includes(page)) return false;
    const [from, to] = dir === 'undo' ? [undoStacksRef, redoStacksRef] : [redoStacksRef, undoStacksRef];
    const stack = from.current[page];
    if (!stack?.length) return false;
    (to.current[page] ??= []).push(drawStrokesRef.current[page] ?? []);
    applyStrokes(page, stack.pop(), false);
    return true;
  };

  // One press of undo or redo, through the whole timeline. An ink step moves its
  // page's ink; an annotation step re-sends the states it recorded — `before` to
  // undo, `after` to redo — as ONE batch (a span's undo is one request) and
  // refreshes exactly as the original action did. A failed request leaves the
  // step where it was, so the next press, or the error toast's Retry, tries again.
  const stepHistory = async (dir) => {
    const h = historyRef.current;
    const list = () => (dir === 'undo' ? h.undo : h.redo);   // re-read: a push replaces h.redo
    const other = () => (dir === 'undo' ? h.redo : h.undo);
    while (list().length) {
      const step = list()[list().length - 1];
      if (step.type === 'ink') {
        list().pop();
        if (moveInk(step.page, dir)) { other().push(step); bumpHistory(); return; }
        continue;   // that page's ink history is gone; go on to the step under it
      }
      if (annoBusyRef.current) return;   // a popover action is still saving
      annoBusyRef.current = true;
      setSavingAnnotation(true);
      try {
        await commitAnnoOps(step.ops.map(({ kind, pageNumber, verseKey, before, after }) => (
          { kind, pageNumber, verseKey, value: dir === 'undo' ? before : after })));
      } catch {
        historyGenRef.current++;   // drop the presses queued behind this one
        showToast(t(dir === 'undo' ? 'library.history.undoFailed' : 'library.history.redoFailed'), 'error',
          { action: { label: t('common.retry'), onClick: () => historyRunRef.current?.(dir) } });
        return;
      } finally {
        annoBusyRef.current = false;
        setSavingAnnotation(false);
      }
      const at = list().lastIndexOf(step);
      if (at >= 0) list().splice(at, 1);
      other().push(step);
      bumpHistory();
      showToast(
        t(dir === 'undo' ? 'library.history.undone' : 'library.history.redone', { what: t(`library.history.what.${step.what}`) }),
        'info',
        { action: historyToastAction(step, dir === 'undo' ? 'redo' : 'undo'), duration: UNDO_TOAST_MS },
      );
      return;
    }
  };

  // Presses run strictly one after another — an annotation step waits on the
  // network, and the ink step pressed after it must not jump the queue. The
  // runner always calls the LATEST render's stepHistory, so it sees the pages
  // and the annotate state as they are when its turn comes.
  const stepHistoryRef = useRef(null);
  useEffect(() => { stepHistoryRef.current = stepHistory; });
  const historyGenRef = useRef(0);
  const historyQueueRef = useRef(Promise.resolve());
  const runHistory = useCallback((dir) => {
    const gen = historyGenRef.current;
    historyQueueRef.current = historyQueueRef.current
      .then(() => (gen === historyGenRef.current ? stepHistoryRef.current?.(dir) : undefined))
      .catch(() => {});
  }, []);
  useEffect(() => {
    historyRunRef.current = runHistory;
    undoRef.current = () => runHistory('undo');
    redoRef.current = () => runHistory('redo');
  }, [runHistory]);
  const clearDrawing = useCallback(() => {
    const page = lastDrawnPageRef.current ?? drawPage;
    if (page != null) applyStrokes(page, [], true);
    setClearConfirm(false);
  }, [applyStrokes, drawPage]);

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
  // Turning the page while annotating used to drop you out of annotate mode. Now
  // it saves what is on the old pages and re-arms on the new ones, so paging
  // through a run of pages marking them up is one continuous act.
  useEffect(() => {
    if (drawPage == null || visiblePages.includes(drawPage)) return;
    flushDrawing().finally(() => {
      lastDrawnPageRef.current = visiblePages[0];
      setDrawPage(visiblePages[0]);       // the seeding effect picks up the new pages
      setClearConfirm(false);
    });
  }, [visiblePages, drawPage, flushDrawing]);

  // Save any pending drawing if the reader leaves the Library mid-stroke.
  useEffect(() => () => {
    for (const page of drawDirtyRef.current) {
      annotationsAPI.saveDrawing({ pageNumber: page, strokes: drawStrokesRef.current[page] ?? [] }).catch(() => {});
    }
  }, []);

  // ── Annotation navigation: prev / next annotated page (wraps) + pulse ──
  const annotatedPages = useMemo(() => annoSummary.map((s) => s.pageNumber), [annoSummary]);
  const jumpToAnnotatedPage = useCallback((page) => {
    // Landing on the page with annotations hidden shows nothing at all, which just
    // reads as a broken jump — so turn them back on for the reader.
    setAnnoVisible(true);
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
  // List order, matching the server's: by page, then by name (unnamed first) —
  // a page can hold several bookmarks with different names.
  const byBookmarkOrder = (a, c) => a.pageNumber - c.pageNumber || (a.label < c.label ? -1 : a.label > c.label ? 1 : 0);
  // Wrap a user's label in Unicode isolates (FSI…PDI) before putting it in a
  // sentence, so an English name inside Arabic text (or the reverse) can't drag
  // the quotes and brackets around it into the wrong order.
  const isolate = (s) => `⁨${s}⁩`;

  const addBookmark = async () => {
    if (savingBookmark) return;
    setSavingBookmark(true);
    const label = bookmarkLabel.trim();
    try {
      const res = await bookmarksAPI.add({ pageNumber: bookmarkTargetPage, ...(label ? { label } : {}) });
      setBookmarks(prev => [...prev, res.data.data].sort(byBookmarkOrder));
      setBookmarkLabel('');
      showToast(t('library.bookmarks.added', { n: fmtNum(bookmarkTargetPage) }), 'success');
    } catch (e) {
      // 409: an unnamed bookmark already sits on this page, or the name is taken.
      const msg = e.response?.status === 409
        ? (label ? t('library.bookmarks.duplicateName') : t('library.bookmarks.unnamedTaken', { n: fmtNum(bookmarkTargetPage) }))
        : e.response?.data?.message || t('common.error');
      showToast(msg, 'error');
    } finally {
      setSavingBookmark(false);
    }
  };

  // Re-create a removed bookmark (same page and name; it gets a new id). Returns
  // the new bookmark, or null if it couldn't be restored (e.g. the name has
  // since been reused).
  const restoreBookmark = async ({ pageNumber, label }) => {
    try {
      const res = await bookmarksAPI.add({ pageNumber, ...(label ? { label } : {}) });
      setBookmarks(list => [...list, res.data.data].sort(byBookmarkOrder));
      return res.data.data;
    } catch {
      return null;
    }
  };

  // Removal (after its confirm) is optimistic; the toast that follows offers
  // Restore, which re-creates it.
  const removeBookmark = async (b) => {
    setBookmarks(list => list.filter(x => x._id !== b._id));
    try {
      await bookmarksAPI.remove(b._id);
      showToast(t('library.bookmarks.removed'), 'success', {
        action: {
          label: t('library.bookmarks.restore'),
          onClick: async () => {
            const back = await restoreBookmark(b);
            showToast(t(back ? 'library.bookmarks.restored' : 'library.bookmarks.restoreFailed'), back ? 'success' : 'error');
          },
        },
      });
    } catch {
      setBookmarks(list => [...list, b].sort(byBookmarkOrder)); // roll back
      showToast(t('common.error'), 'error');
    }
  };

  // Every removal asks first.
  const requestRemoveBookmark = (b) => setBookmarkConfirm({ kind: 'remove', bookmark: b });

  // Put focus back on one of a row's action buttons once the list has
  // re-rendered — after a rename, a move that re-sorted the row, or a confirm.
  // Falls back to Rename if that button is missing; a no-op once the row is gone.
  const focusBookmarkAction = (id, action) => requestAnimationFrame(() => {
    const row = bookmarkRowRefs.current.get(id);
    (row?.querySelector(`[data-bm-action="${action}"]`) ?? row?.querySelector('[data-bm-action="rename"]'))?.focus();
  });

  const startRenameBookmark = (b) => {
    renameSettledRef.current = false;
    setRenameDraft(b.label);
    setRenamingBookmarkId(b._id);
  };

  // Enter and blur save, Escape cancels. Optimistic, rolled back on failure.
  const finishRenameBookmark = async (b, save, { refocus = false } = {}) => {
    if (renameSettledRef.current) return;
    renameSettledRef.current = true;
    setRenamingBookmarkId(null);
    if (refocus) focusBookmarkAction(b._id, 'rename');
    const label = renameDraft.trim();
    if (!save || label === b.label) return;
    setBookmarks(list => list.map(x => (x._id === b._id ? { ...x, label } : x)));
    try {
      const res = await bookmarksAPI.update(b._id, { label });
      setBookmarks(list => list.map(x => (x._id === b._id ? res.data.data : x)));
    } catch (e) {
      setBookmarks(list => list.map(x => (x._id === b._id ? { ...x, label: b.label } : x)));
      // 409: the name is taken — or, when clearing it, this page already has
      // an unnamed bookmark (two would both read "Page N").
      const msg = e.response?.status !== 409 ? t('common.error')
        : label ? t('library.bookmarks.duplicateName')
        : t('library.bookmarks.unnamedTaken', { n: fmtNum(b.pageNumber) });
      showToast(msg, 'error');
    }
  };

  // Changing a bookmark to `page` (the active page) always asks first. Pages hold
  // any number of differently-named bookmarks, so usually that is a plain
  // "Change … to page N?". The one clash is an UNNAMED bookmark landing where an
  // unnamed one already is (both would read "Page N"): then the same single
  // dialog asks to replace it instead, and Replace sends replace:true so the
  // server swaps them in one request.
  const requestMoveBookmark = (b, page) => {
    if (b.pageNumber === page) return;
    const occupant = b.label ? null : bookmarks.find(x => x.pageNumber === page && !x.label && x._id !== b._id);
    setBookmarkConfirm(occupant
      ? { kind: 'replace', bookmark: b, conflict: occupant, page }
      : { kind: 'move', bookmark: b, page });
  };

  // Undo a change: move the bookmark back to the page it came from and, if it
  // had replaced an unnamed bookmark, re-create that one (after the move back,
  // so the page's one unnamed slot is free again).
  const undoMoveBookmark = async (b, replaced) => {
    try {
      const res = await bookmarksAPI.update(b._id, { pageNumber: b.pageNumber });
      setBookmarks(list => list.map(x => (x._id === b._id ? res.data.data : x)).sort(byBookmarkOrder));
      const back = replaced ? await restoreBookmark(replaced) : true;
      showToast(t(back ? 'library.bookmarks.restored' : 'library.bookmarks.restoreFailed'), back ? 'success' : 'error');
    } catch {
      showToast(t('library.bookmarks.restoreFailed'), 'error');
    }
  };

  // Runs once the change is confirmed. Optimistic; the toast that follows offers
  // Restore. A server 409 (another device added an unnamed bookmark there since
  // the list loaded) rolls back and opens the replace dialog.
  const moveBookmark = async (b, page, replace = false) => {
    if (b.pageNumber === page) return;
    const occupant = replace ? bookmarks.find(x => x.pageNumber === page && !x.label && x._id !== b._id) : null;
    const before = bookmarks;
    setBookmarks(before
      .filter(x => x._id !== occupant?._id)
      .map(x => (x._id === b._id ? { ...x, pageNumber: page } : x))
      .sort(byBookmarkOrder));
    focusBookmarkAction(b._id, 'move');
    try {
      const res = await bookmarksAPI.update(b._id, { pageNumber: page, ...(replace ? { replace: true } : {}) });
      const replacedId = res.data.replaced?._id;
      setBookmarks(list => list
        .filter(x => x._id !== replacedId)
        .map(x => (x._id === b._id ? res.data.data : x))
        .sort(byBookmarkOrder));
      showToast(t('library.bookmarks.moved', { n: fmtNum(page) }), 'success', {
        action: { label: t('library.bookmarks.restore'), onClick: () => undoMoveBookmark(b, res.data.replaced) },
      });
    } catch (e) {
      setBookmarks(before);
      const conflict = e.response?.status === 409 ? e.response.data?.conflict : null;
      if (conflict) setBookmarkConfirm({ kind: 'replace', bookmark: b, conflict, page });
      else showToast(e.response?.status === 409 ? t('library.bookmarks.unnamedTaken', { n: fmtNum(page) }) : t('common.error'), 'error');
    }
  };

  // The chosen edition — one of them is grammatical analysis (إعراب) rather than
  // commentary, which only changes what the panel calls itself.
  const tafsirEd = TAFSIR_EDITIONS.find(e => e.id === tafsirEdition) ?? TAFSIR_EDITIONS[0];

  const showSidebar = sidebarOpen;

  useEffect(() => {
    localStorage.setItem('tafsirEdition', tafsirEdition);
  }, [tafsirEdition]);

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
  // How a verse is announced to a screen reader, in the interface's language.
  const verseAriaLabel = (v) => t('library.verseAria', {
    surah: surahLabelFor(v.surahNumber),
    ayah: fmtNum(v.ayahNumber),
  });
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
  const selectedOrd = ordOfKey(selectedVerseKey);
  // What the tafsir panel's own prev/next step FROM. The panel outlives the
  // selection now, so falling back to its verse is what keeps those arrows alive
  // after the reader has deselected or started annotating.
  const panelStepOrd = selectedOrd ?? ordOfKey(tafsirVerseKey);
  // Where the verse being recited sits among the on-screen verses (-1 while the
  // view is still catching up to it), for the audio bar's "verse N of M".
  const playingIndex = useMemo(
    () => (playingOrd == null ? -1 : verses.findIndex((v) => ordOfKey(v.verseKey) === playingOrd)),
    [verses, playingOrd]
  );
  // How far into a nested repeat playback is: "verse 2 of 5 - pass 1 of 3", with
  // the per-verse tally folded in whenever that count is doing anything. Without it
  // a reader hearing the same verse a third time has no way to tell whether the
  // range is on its first pass or its last. Null unless a range is actually
  // playing, so the ordinary listen shows nothing extra.
  const countLabel = (n) => (n === Infinity ? '∞' : fmtNum(n));
  const rangeProgress = (repeatMode === 'range' && playingOrd != null
    && playingOrd >= rangeStartOrd && playingOrd <= rangeEndOrd)
    ? t(rangeVerseRepeat === 1 ? 'library.audio.rangeProgress' : 'library.audio.rangeProgressRep', {
      verse: fmtNum(playingOrd - rangeStartOrd + 1),
      total: fmtNum(rangeEndOrd - rangeStartOrd + 1),
      rep: fmtNum(repeatsDone + 1),
      reps: countLabel(rangeVerseRepeat),
      pass: fmtNum(rangePasses + 1),
      passes: countLabel(rangeRepeat),
    })
    : null;

  // Only tint the verse while it's actually playing — pausing clears the tint
  // (resuming restores it; the audio element keeps its position, so play() picks
  // up from the same offset).
  const playingVerseKey = (isPlaying && playingOrd != null) ? keyOfOrd(playingOrd) : null;

  // On a zoomed page the verse being recited (or stepped to from the popover) can
  // move off the visible part; bring it back into view. A no-op when not zoomed,
  // and when the verse is already visible — a tapped verse never jumps.
  const { revealWords: zoomRevealWords } = zoom;
  const followKey = playingVerseKey ?? selectedVerseKey;
  useEffect(() => {
    if (!followKey || !isZoomed()) return;
    zoomRevealWords(viewportRef.current?.querySelectorAll(`.mushaf-word[data-verse-key="${followKey}"]`));
  }, [followKey, pagesData, isZoomed, zoomRevealWords]);

  // Move the selection one verse in `dir`, through the WHOLE Quran. The popover
  // and the tafsir panel both step through here, which is what keeps them and the
  // mushaf's highlight in step: there is one selection, and everything reads it.
  // Crossing the edge of the visible page(s) turns the page and lands on the verse
  // there — the same follow-the-content turn playback already does — instead of
  // dead-ending at the page edge. Audio comes along if it was already going.
  // Programmatic, so it does NOT re-anchor the popover (only a word click does).
  const stepSelection = (dir) => {
    const from = panelStepOrd ?? ordOfKey(verses[0]?.verseKey);
    if (from == null) return;
    const next = from + dir;
    if (next < 1 || next > TOTAL_AYAHS) return;
    const key = keyOfOrd(next);
    const following = isPlaying || playingOrd != null;
    if (verses.some((v) => v.verseKey === key)) {
      setSelectedVerseKey(key);
      if (following) playOrd(next);
      return;
    }
    pendingSelectRef.current = key;
    selectTurnRef.current = true;
    if (following) { followTurnRef.current = true; playOrd(next); }
    if (!goToPage(pageOfOrd(next))) {
      // Nothing to turn to — drop the flags so they can't swallow a later turn.
      pendingSelectRef.current = null;
      selectTurnRef.current = false;
      followTurnRef.current = false;
    }
  };

  // ── Tafsir loading ───────────────────────────────────────
  // Stepping inside the panel moves the selection, and picking a verse on the
  // mushaf moves the panel: the selection is still what drives it. What changed is
  // the fallback — with no selection the panel reads its own MEMORY of the last
  // verse it showed instead of going blank. Derived during render, so opening the
  // panel and picking a verse never flash an empty frame first.
  const panelVerseKey = tafsirOpen ? (selectedVerseKey ?? tafsirVerseKey) : null;
  useEffect(() => {
    if (selectedVerseKey != null) setTafsirVerseKey(selectedVerseKey);
  }, [selectedVerseKey]);
  // Closing the panel is the one thing that forgets it, so the next time it opens
  // it starts on the "tap any verse" empty state again — which is precisely what
  // that empty state is for: nothing has been shown HERE yet. Once a verse has
  // been shown, deselecting never falls back to it.
  useEffect(() => { if (!tafsirOpen) setTafsirVerseKey(null); }, [tafsirOpen]);

  // The verse object the panel renders. Normally it is right there on the visible
  // page; when it isn't, the last one resolved for this same key stands in, which
  // is what lets the panel keep its verse (and its header keep naming it) after a
  // range drag has turned the page out from under it. A key we have NEVER resolved
  // is a different matter — that one really is loading, and gets the skeleton.
  const lastTafsirVerseRef = useRef(null);
  const onPageTafsirVerse = panelVerseKey != null
    ? verses.find((v) => v.verseKey === panelVerseKey) ?? null
    : null;
  const tafsirVerse = onPageTafsirVerse
    ?? (lastTafsirVerseRef.current?.verseKey === panelVerseKey ? lastTafsirVerseRef.current : null);
  useEffect(() => { if (onPageTafsirVerse) lastTafsirVerseRef.current = onPageTafsirVerse; }, [onPageTafsirVerse]);

  useEffect(() => {
    if (!tafsirOpen || !tafsirVerse) return;
    let cancelled = false;
    const ed = TAFSIR_EDITIONS.find(e => e.id === tafsirEdition) ?? TAFSIR_EDITIONS[0];
    setTafsirLoading(true);
    setTafsirError(false);
    setTafsirText('');
    setTafsirRun(null);
    const load = ed.source === 'page'
      ? fetchPageTafsir(tafsirVerse.page, ed.edition).then(list =>
          list.find(a => a.number === tafsirVerse.id)?.text ?? '')
      : fetchEditionAyahTafsir(ed, tafsirVerse.surahNumber, tafsirVerse.ayahNumber);
    load
      .then(text => {
        if (cancelled) return;
        setTafsirText(text);
        // Only the spa5k editions still hand back one block for a whole passage —
        // the hefz ones are per-ayah, and the page ones always were. Work out how
        // far a block reaches only AFTER the text is on screen, so the banner
        // never costs the reader any waiting.
        if (ed.source !== 'ayah') return;
        findTafsirRun(ed.slug, tafsirVerse.surahNumber, tafsirVerse.ayahNumber, ayahCount(tafsirVerse.surahNumber), text)
          .then(run => { if (!cancelled && run.to > run.from) setTafsirRun(run); })
          .catch(() => { /* the label is a nicety — never fail the read over it */ });
      })
      .catch(() => { if (!cancelled) setTafsirError(true); })
      .finally(() => { if (!cancelled) setTafsirLoading(false); });
    return () => { cancelled = true; };
  }, [tafsirOpen, tafsirVerse, tafsirEdition, tafsirReloadKey]);

  // Drag the panel's inner edge to resize it. The handle always sits on the
  // panel's INLINE-START edge — the side facing the mushaf in both writing
  // directions — so dragging toward the mushaf widens the panel in LTR and
  // dragging away from it does in RTL; `dir` decides which way that is. Capped so
  // the reader can never squeeze the mushaf out or lose the panel.
  const clampTafsirWidth = useCallback(
    (w) => Math.round(Math.min(Math.max(w, TAFSIR_MIN_W), Math.min(TAFSIR_MAX_W, window.innerWidth * 0.55))),
    []
  );
  const commitTafsirWidth = useCallback((w) => {
    const next = clampTafsirWidth(w);
    setTafsirWidth(next);
    localStorage.setItem('tafsirPanelWidth', String(next));
  }, [clampTafsirWidth]);

  const startTafsirResize = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();          // never start a text selection or a page-turn swipe
    e.stopPropagation();
    const startX = e.clientX;
    const startW = tafsirWidth;
    const rtl = document.documentElement.getAttribute('dir') === 'rtl';
    setTafsirResizing(true);
    const onMove = (ev) => {
      // Inline-start edge: in LTR the panel grows as the pointer moves LEFT.
      const delta = rtl ? ev.clientX - startX : startX - ev.clientX;
      setTafsirWidth(clampTafsirWidth(startW + delta));
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setTafsirResizing(false);
      const delta = rtl ? ev.clientX - startX : startX - ev.clientX;
      commitTafsirWidth(startW + delta);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [tafsirWidth, clampTafsirWidth, commitTafsirWidth]);

  // Same job from the keyboard, for anyone not using a pointer.
  const onTafsirResizeKey = useCallback((e) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') { e.preventDefault(); commitTafsirWidth(tafsirWidth + step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); commitTafsirWidth(tafsirWidth - step); }
    else if (e.key === 'Home') { e.preventDefault(); commitTafsirWidth(TAFSIR_MIN_W); }
    else if (e.key === 'End') { e.preventDefault(); commitTafsirWidth(TAFSIR_MAX_W); }
  }, [tafsirWidth, commitTafsirWidth]);

  // The commentary as real paragraphs. Every line break in the source starts a new
  // one — for a book like Aysar those are its labelled definitions, one per line —
  // and the styles give them modest spacing instead of the full blank line a
  // pre-wrapped block used to produce.
  const tafsirParagraphs = useMemo(
    () => tafsirText.split(/\n+/).map((para) => para.trim()).filter(Boolean),
    [tafsirText]
  );

  // The popover's tafsir icon — unchanged in effect: read THIS verse. Selecting
  // it is what points the panel at it.
  const openTafsir = (verseKey) => {
    setNotePanel(null); // don't stack the two side panels
    if (verseKey) setSelectedVerseKey(verseKey);
    setTafsirOpen(true);
  };

  // ── The span's actions popover ──
  // Shown while a verse of the span is on screen (it floats over the page, so it
  // has nothing to point at once the span has been turned away from).
  const spanPopoverShown = spanActionsOpen && verses.some((v) => inRange(v.verseKey));
  // "Ya-Sin 41–46" (or "Ya-Sin 83 – As-Saffat 3" across a surah boundary).
  const spanRangeLabel = (() => {
    if (!spanActionsOpen) return '';
    const a = verseOfOrd(rangeSelection.startOrd);
    const b = verseOfOrd(rangeSelection.endOrd);
    if (!a || !b) return '';
    return a.surahNumber === b.surahNumber
      ? `${surahLabelFor(a.surahNumber)} ${fmtNum(a.ayahNumber)}–${fmtNum(b.ayahNumber)}`
      : `${surahLabelFor(a.surahNumber)} ${fmtNum(a.ayahNumber)} – ${surahLabelFor(b.surahNumber)} ${fmtNum(b.ayahNumber)}`;
  })();

  // Tafsir for a span opens on its first verse WITHOUT selecting it, so the span
  // stays picked. That verse may sit on a page turned away from (the span was
  // dragged across the turn); the panel then reads it from its global address.
  const openSpanTafsir = () => {
    const ord = rangeSelection.startOrd;
    const verseKey = keyOfOrd(ord);
    const v = verseOfOrd(ord);
    if (!verses.some((x) => x.verseKey === verseKey) && v) {
      lastTafsirVerseRef.current = { verseKey, id: ord, surahNumber: v.surahNumber, ayahNumber: v.ayahNumber, page: pageOfOrd(ord) };
    }
    setNotePanel(null);
    setTafsirVerseKey(verseKey);
    setTafsirOpen(true);
  };

  // Play the span = the range repeat aimed at it, with the counts the repeat menu
  // holds; pressed while that is what is playing, it pauses (and resumes).
  const spanIsLoaded = spanActionsOpen && repeatMode === 'range' && playingOrd != null
    && playingOrd >= rangeSelection.startOrd && playingOrd <= rangeSelection.endOrd
    && rangeStartOrd === rangeSelection.startOrd && rangeEndOrd === rangeSelection.endOrd;
  const spanIsPlaying = spanIsLoaded && isPlaying;
  const toggleSpanAudio = () => {
    if (spanIsPlaying) { cancelPreStart(); activeEl()?.pause(); setIsPlaying(false); return; }
    if (spanIsLoaded) { resumeActive(); return; }
    const { startOrd, endOrd } = rangeSelection;
    setRangeStartOrd(startOrd);
    setRangeEndOrd(endOrd);
    setRepeatMode('range');
    setRangePasses(0);
    setRepeatsDone(0);
    playOrd(startOrd);
  };

  // The persistent panel toggle. Opened with nothing selected it falls back to the
  // first verse of the page in front of the reader, so the panel normally has a
  // verse from the moment it appears. When there is no page to fall back to — the
  // toggle pressed while the mushaf is still arriving — it opens ANYWAY, on its
  // "tap any verse" empty state, rather than silently doing nothing. That is the
  // one place that empty state belongs: a panel session that has shown nothing yet.
  const toggleTafsir = () => {
    if (tafsirOpen) { setTafsirOpen(false); return; }
    if (!selectedVerse) {
      const page = twoPage ? activePage : currentPage;
      const first = verses.find((v) => v.page === page) ?? verses[0];
      // Quietly: opening the tafsir is a request to READ, not to act on a verse,
      // and the seeded verse was chosen for the reader rather than by them. Same
      // rule as a plain click — actions only ever come from asking for them.
      if (first) { setPopoverHidden(true); setSelectedVerseKey(first.verseKey); }
      setRangeSelection(null);
    }
    setNotePanel(null);
    setTafsirOpen(true);
  };

  // Place the popover near the clicked word: below the pointer when it's in the
  // top half of the viewport, above it in the bottom half; centred on x; clamped
  // to the viewport with a small offset (standard selection-toolbar flip/shift).
  //
  // The gap is deliberately generous — a toolbar right under the cursor hides the
  // word just tapped — and larger still when it opens UPWARD, where it would
  // otherwise sit over the line the reader is looking at.
  useLayoutEffect(() => {
    if (!(selectedVerse || spanPopoverShown) || !popoverRef.current || !placeNextRef.current) return;
    placeNextRef.current = false;
    const el = popoverRef.current;
    const { width: w, height: h } = el.getBoundingClientRect();
    const p = lastPointerRef.current || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const gapBelow = 34;
    const gapAbove = 54;
    let top = p.y < window.innerHeight / 2 ? p.y + gapBelow : p.y - h - gapAbove;
    let left = p.x - w / 2;
    left = Math.min(Math.max(left, 8), window.innerWidth - w - 8);
    top = Math.min(Math.max(top, 8), window.innerHeight - h - 8);
    setPopoverPos({ x: left, y: top });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseKey, popoverHidden, spanPopoverShown, popoverPlaceTick]);

  // A click anywhere outside the popover folds it away — the mushaf margins, the
  // sidebar, the tafsir panel, anywhere — while the verse stays selected. Capture
  // phase and never preventDefault, so whatever was clicked still gets the click:
  // tapping a WORD collapses on pointerdown and then unfolds again on the click
  // that selects it, which is why a fresh word tap still opens the actions.
  useEffect(() => {
    if (!selectedVerseKey && !rangeSelection) return;
    const onPointerDown = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      // A word click runs the ladder itself (handleWordSelect) — leave it alone.
      if (e.target.closest?.('.mushaf-word')) return;
      // A control, or somewhere inside a panel being used: not "off the verse".
      // The repeat panel counts, so the pickers can be adjusted with the span lit.
      if (e.target.closest?.(KEEPS_VERSE_SELECTION)) return;
      // Self-test while annotating: the ink layer is where the verse cycle runs
      // (right-click) and drawing there is working WITH the verse just checked —
      // a stroke must not drop it, or the next right-click would select it again
      // instead of hiding it.
      if (selfTestWhileDrawing && e.target.closest?.('.mushaf-draw-svg, .mushaf-text-layer')) return;
      // Any other annotate mode: a right-click on the ink layer is the press that
      // opens the actions (see actionsAtPoint), not a click off the verse.
      if (drawPage != null && isSecondaryPress(e) && e.target.closest?.('.mushaf-draw-svg, .mushaf-text-layer')) return;
      // A picked span: with its actions up they fold first and the span stays,
      // the same two steps a single verse takes; otherwise the span goes. (It and
      // a single verse are never both selected — picking either clears the other.)
      if (rangeSelection) {
        if (rangeSelection.actions) setRangeSelection(({ startOrd, endOrd }) => ({ startOrd, endOrd }));
        else setRangeSelection(null);
        return;
      }
      // Empty space. Same ladder as tapping the verse: the first click puts the
      // actions away, the next one drops the selection.
      if (!popoverHidden) setPopoverHidden(true);
      else setSelectedVerseKey(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVerseKey, rangeSelection, popoverHidden, selfTestWhileDrawing, drawPage]);

  // The repeat menu goes away on a click anywhere, exactly as the verse actions do
  // — and by the same means: a capture-phase listener that never preventDefaults,
  // so whatever was clicked still gets its click. It used to be a full-screen
  // backdrop div, which closed the menu but ATE the click, making every first
  // click on the page a wasted one.
  useEffect(() => {
    if (!repeatOpen) return;
    const onPointerDown = (e) => {
      if (repeatMenuRef.current?.contains(e.target)) return;  // the menu, or the button that opens it
      setRepeatOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [repeatOpen]);

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
  // "Al-Baqarah 255" for any verse in the Quran, on screen or not — the repeat-range
  // pickers and the audio bar both name verses the current page doesn't hold.
  const ordLabel = (ord) => {
    const v = verseOfOrd(ord);
    return v ? `${surahLabelFor(v.surahNumber)} ${t('library.verseLabel', { n: fmtNum(v.ayahNumber) })}` : '';
  };
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
  // What the bookmark confirm dialog says, by kind: change the page, replace
  // an unnamed bookmark (an unnamed one landing on another), or remove.
  const bookmarkDialog = (() => {
    const c = bookmarkConfirm;
    if (!c) return {};
    const b = c.bookmark;
    const from = fmtNum(b.pageNumber);
    if (c.kind === 'move') return {
      icon: FiMapPin,
      title: t('library.bookmarks.changeTitle'),
      message: b.label
        ? t('library.bookmarks.changeMessage', { label: isolate(b.label), from, to: fmtNum(c.page) })
        : t('library.bookmarks.changeMessageUnnamed', { from, to: fmtNum(c.page) }),
      confirmText: t('library.bookmarks.change'),
      isDanger: false,
    };
    if (c.kind === 'replace') return {
      icon: FiBookmark,
      title: t('library.bookmarks.replaceTitle'),
      message: t('library.bookmarks.replaceMessageUnnamed', { n: fmtNum(c.page) }),
      confirmText: t('library.bookmarks.replace'),
      isDanger: true,
    };
    return {
      icon: FiTrash2,
      title: t('library.bookmarks.removeTitle'),
      message: b.label
        ? t('library.bookmarks.removeMessage', { n: from, label: isolate(b.label) })
        : t('library.bookmarks.removeMessageUnnamed', { n: from }),
      confirmText: t('library.bookmarks.remove'),
      isDanger: true,
    };
  })();

  // Reuse the shared 7-step method strings (also powering HowToMemorizeModal).
  const methodSteps = t('howTo.steps', { returnObjects: true });
  const stepList = Array.isArray(methodSteps) ? methodSteps : [];

  const verseRef = (verse) =>
    `${surahLabelFor(verse.surahNumber)} · ${t('library.verseLabel', { n: fmtNum(verse.ayahNumber) })}`;

  const selectCls =
    'w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500';

  // Shown while the tafsir text loads, and while the panel waits on the page a
  // cross-page step has just turned to.
  const tafsirSkeleton = (
    <div className="flex flex-col gap-2.5 animate-pulse pt-1" dir="rtl">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-700" style={{ width: `${95 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );

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
    // Annotate mode covers every page on screen; the anchor is only where the
    // toolbar hangs. Each page draws its own working strokes.
    const annotating = drawPage != null;
    const isAnchor = drawPage === pd.page;
    const isDrawingHere = annotating;
    const layerStrokes = annotating ? (drawStrokesByPage[pd.page] ?? drawDoc?.strokes ?? []) : (drawDoc?.strokes ?? []);
    const textNotes = anns.filter((a) => a.kind === 'text');
    // Clean-reading toggle: while hidden (and not drawing this page), suppress all
    // annotation visuals AND their click targets.
    const showAnns = annoVisible || isDrawingHere;
    return (
      <div
        key={slot}
        onClick={() => setActivePage(pd.page)}
        className={`flex-1 min-w-0 rounded-2xl ring-1 bg-[#f7f0da] dark:bg-[#1f1b14] shadow-xl dark:shadow-black/40 overflow-hidden transition-shadow ${
          isDrawingHere
            ? 'ring-2 ring-[#004f35] dark:ring-emerald-400 is-annotating'
            : 'ring-amber-200/60 dark:ring-amber-900/30'
        }`}
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
              {signedIn && (
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
              )}
              {/* Annotate (free-draw) toggle for this page */}
              {signedIn && (
              <Tooltip label={isDrawingHere ? t('library.draw.exit') : t('library.draw.enter')}>
                <button
                  ref={isAnchor ? drawAnchorRef : undefined}
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
              )}
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
                    inRange={inRange}
                    verseLabel={verseAriaLabel}
                    onVerseContextMenu={markVersesMode ? null : showVerseActions}
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
                  onStrokesChange={(next) => handleDrawChange(pd.page, next)}
                  textNotes={textNotes}
                  onCreateText={(x, y, text, color) => createText(pd.page, x, y, text, color)}
                  onUpdateText={(id, patch) => updateText(pd.page, id, patch)}
                  onDeleteText={(id) => deleteText(pd.page, id)}
                  onReadText={(n) => setReadTextNote({ text: n.text, color: n.color || 'ink' })}
                  placeholder={t('library.draw.textPlaceholder')}
                  onSecondaryPress={secondaryPressWhileDrawing}
                />
                <MushafMarks pageData={pd} outerEdge={outerEdge} prevLastRub={prevLastRub} />
              </div>
            </div>
          </div>
          {/* Page number + an interactive per-page memorized toggle, so each half
              of a spread can be marked/unmarked on its own. */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-800/60 dark:text-amber-200/40 select-none">
            {signedIn && (() => {
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
            {signedIn && (() => {
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
      {/* The reader hands the window over to the mushaf: the navbar fades out after
          a few idle seconds and returns the moment the pointer nears the top, on
          Tab into it, or on Escape. It animates by TRANSFORM only and the page
          keeps its top padding, so the mushaf never jumps. */}
      <Navbar autoHide holdOpen={tourActive || notePanel != null || readTextNote != null} />

      {/* The page header is gone: its title and subtitle told a returning reader
          nothing the navbar doesn't, and the mushaf wants the height. `pt-20`
          clears the navbar with a little less air than before, for the same
          reason. */}
      {/* Full-bleed: the panels dock against the WINDOW edges, the way an editor
          docks its side bars, so neither is floating in a gutter. Only the reading
          column between them gets padding and a measure. */}
      <main className="grow w-full pt-20 pb-6">
        {/* The two panel handles: small chevron tabs flush to the viewport edges,
            the way an IDE hangs a panel handle. The sidebar's sits on the START
            edge it lives on, the tafsir's on the END edge its panel opens from, so
            they mirror correctly in Arabic without either being hard-coded to a
            side.

            Both hang from the TOP of their panel rather than the middle of the
            window, so each stays attached to its panel however short it gets.

            The chevron POINTS THE WAY THE PANEL WILL MOVE: with the sidebar open
            it points back toward the start edge (click to tuck it away), and when
            closed it points inward (click to bring it out). `rtl:rotate-180` flips
            the glyph with the writing direction, so "outward" stays outward.
            No text label — the tooltip and aria-label carry the meaning. */}
        {/* Each tab rides its own panel's inner edge, so it reads as the panel's
            handle rather than a button stranded at the window edge — and it slides
            across as the panel opens and closes. With the panel shut it rests
            against the window edge itself. */}
        <div
          className="reader-edge-tab fixed top-24 z-40"
          style={{ insetInlineStart: sidebarOpen && isWide ? SIDEBAR_WIDTH : 0 }}
        >
          <Tooltip label={sidebarOpen ? t('library.sidebar.hide') : t('library.sidebar.show')} placement="bottom">
            <button
              onClick={() => setSidebarByUser(!sidebarOpen)}
              data-testid="sidebar-toggle"
              aria-label={sidebarOpen ? t('library.sidebar.hide') : t('library.sidebar.show')}
              aria-pressed={sidebarOpen}
              className={READER_EDGE_TAB('start')}
            >
              {sidebarOpen
                ? <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
                : <FiChevronRight className="w-4 h-4 rtl:rotate-180" />}
            </button>
          </Tooltip>
        </div>

        {/* Level with the panel's header rather than the middle of the window:
            with no verse picked the panel is short, and a chevron floating beside
            empty space read as unattached to anything. */}
        <div
          className="reader-edge-tab fixed top-24 z-40"
          style={{ insetInlineEnd: tafsirOpen && isWide ? tafsirWidth : 0 }}
        >
          <Tooltip label={tafsirOpen ? t('library.tafsirHide') : t('library.tafsirShow')} placement="bottom">
            <button
              onClick={toggleTafsir}
              data-testid="tafsir-toggle"
              aria-label={tafsirOpen ? t('library.tafsirHide') : t('library.tafsirShow')}
              aria-pressed={tafsirOpen}
              className={READER_EDGE_TAB('end')}
            >
              {tafsirOpen
                ? <FiChevronRight className="w-4 h-4 rtl:rotate-180" />
                : <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />}
            </button>
          </Tooltip>
        </div>

        <div className="flex flex-col lg:flex-row lg:gap-0 gap-6 items-start">

          {/* ── Sidebar — shown or hidden by its own toggle. Docking the tafsir
              hides it by default (that column of room is what the panel takes),
              but an explicit toggle outranks that; see the effect above. ── */}
          {showSidebar && (
          <aside className="reader-panel reader-panel--start w-full lg:w-72 shrink-0 bg-white dark:bg-gray-800 rounded-2xl lg:rounded-s-none border border-[#dce2f3] dark:border-gray-700 lg:border-s-0 p-4 flex flex-col gap-5 sacred-shadow lg:sticky lg:top-20 lg:self-start">

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
            </div>

            {/* Jump to Juz / Surah — side by side: two controls of the same kind,
                and stacked they cost a lot of height for what they do. */}
            {/* Each is a <label>, so its heading names the select for screen readers. */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-2 min-w-0">
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
              </label>
              <label className="flex flex-col gap-2 min-w-0">
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
              </label>
            </div>

            {/* Signed out: ONE nudge in place of every account feature — the
                memorized ticks, mark-verses, bookmarks, annotations and the hard
                list are all hidden while there is no account to save them to. */}
            {!signedIn && !authLoading && (
              <div className="flex flex-col gap-2 rounded-xl border border-[#dce2f3] dark:border-gray-700 bg-[#f0f4ff] dark:bg-gray-700/40 px-3 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003527] dark:text-gray-100">
                  <FiBookmark className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                  {t('library.signedOut.title')}
                </span>
                <p className="text-xs leading-relaxed text-[#707974] dark:text-gray-400">{t('library.signedOut.body')}</p>
                <div className="flex items-center gap-3">
                  <Link
                    to={loginPathFor(location)}
                    className="text-xs font-semibold text-white bg-[#004f35] hover:bg-[#003527] rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {t('library.signedOut.signIn')}
                  </Link>
                  <Link to="/register" className="text-xs font-semibold text-[#004f35] dark:text-emerald-400 hover:underline">
                    {t('library.signedOut.register')}
                  </Link>
                </div>
              </div>
            )}

            {signedIn && (
            <>
            {/* Bookmarks */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.bookmarks.title')}</span>
              {/* Add a bookmark for the active page — always available: a page
                  can hold several bookmarks as long as their names differ. The
                  rows already on this page show a green pin. */}
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
              {bookmarks.length === 0 ? (
                <p className="text-xs text-[#9aa3a0] dark:text-gray-600">{t('library.bookmarks.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto -mr-1 pr-1">
                  {bookmarks.map(b => {
                    const name = b.label || t('library.bookmarks.pageLabel', { n: fmtNum(b.pageNumber) });
                    const onTarget = b.pageNumber === bookmarkTargetPage;
                    const iconBtn = 'shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors';
                    return (
                    // Tapping the row jumps (as always); its three actions sit on
                    // the same line as always-visible icons — rename, move here,
                    // remove — so each is one tap and none is hover-only.
                    <li
                      key={b._id}
                      ref={el => { if (el) bookmarkRowRefs.current.set(b._id, el); else bookmarkRowRefs.current.delete(b._id); }}
                      className="flex items-center gap-0.5"
                    >
                      {renamingBookmarkId === b._id ? (
                        <input
                          autoFocus
                          onFocus={e => e.target.select()}
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); finishRenameBookmark(b, true, { refocus: true }); }
                            else if (e.key === 'Escape') { e.stopPropagation(); finishRenameBookmark(b, false, { refocus: true }); }
                          }}
                          onBlur={() => finishRenameBookmark(b, true)}
                          maxLength={50}
                          placeholder={t('library.bookmarks.pageLabel', { n: fmtNum(b.pageNumber) })}
                          aria-label={t('library.bookmarks.renameLabel', { name })}
                          className="flex-1 min-w-0 rounded-lg border border-[#004f35] dark:border-emerald-500 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-[#1A1A1A] dark:text-gray-100 focus:outline-none"
                        />
                      ) : (
                        <>
                          <button
                            onClick={() => goToPage(b.pageNumber)}
                            className={`flex-1 min-w-0 inline-flex items-center gap-1.5 text-start text-xs rounded-lg px-2 py-1.5 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors ${
                              onTarget ? 'text-[#003527] dark:text-emerald-300 font-semibold' : 'text-[#404944] dark:text-gray-300'
                            }`}
                          >
                            <FiBookmark className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                            <span className="truncate">{name}</span>
                            {b.label && <span className="shrink-0 text-[10px] text-[#9aa3a0] dark:text-gray-600">{fmtNum(b.pageNumber)}</span>}
                          </button>
                          <Tooltip label={t('library.bookmarks.rename')}>
                            <button
                              data-bm-action="rename"
                              onClick={() => startRenameBookmark(b)}
                              aria-label={t('library.bookmarks.renameFor', { name })}
                              className={`${iconBtn} text-[#9aa3a0] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700`}
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          {/* Change the bookmark to the active page. Always shown;
                              on the bookmark that already marks the active page
                              it turns green as a "you are here" marker and does
                              nothing (aria-disabled, still focusable so its
                              tooltip reads by keyboard too). */}
                          <Tooltip label={onTarget
                            ? t('library.bookmarks.onThisPage')
                            : t('library.bookmarks.moveTo', { n: fmtNum(bookmarkTargetPage) })}>
                            <button
                              data-bm-action="move"
                              onClick={() => { if (!onTarget) requestMoveBookmark(b, bookmarkTargetPage); }}
                              aria-disabled={onTarget || undefined}
                              aria-label={onTarget
                                ? t('library.bookmarks.onThisPageFor', { name })
                                : t('library.bookmarks.moveFor', { name, n: fmtNum(bookmarkTargetPage) })}
                              className={`${iconBtn} ${onTarget
                                ? 'text-[#004f35] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 cursor-default'
                                : 'text-[#9aa3a0] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'}`}
                            >
                              <FiMapPin className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip label={t('library.bookmarks.remove')}>
                            <button
                              data-bm-action="remove"
                              onClick={() => requestRemoveBookmark(b)}
                              aria-label={t('library.bookmarks.removeFor', { name })}
                              className={`${iconBtn} text-[#9aa3a0] dark:text-gray-500 hover:text-[#ba1a1a] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </>
            )}

                        {/* Everything above is about GETTING somewhere in the mushaf;
                everything below is about memorizing it. The rule is the only
                thing separating them — headings would be noise in a column
                this short. */}
            <hr className="border-0 border-t border-[#dce2f3] dark:border-gray-700 -mx-4" />

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

            {/* ── Self-test (active recall) — always available ── */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#dce2f3] dark:border-gray-700 p-3.5">
              {/* Label + tappable explainer (the how-it-works text lives here). */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">
                  {t('library.selfTest.label')}
                </span>
                {/* Hide-all also says how to use it while annotating — right-click
                    — for anyone who can annotate, so it is found before it's needed. */}
                <InfoHint
                  text={selfTest === 'hide' && signedIn
                    ? `${t('library.selfTest.hint.hide')} ${t('library.selfTest.hint.hideDrawing')}`
                    : t(`library.selfTest.hint.${selfTest}`)}
                  label={t('library.selfTest.label')}
                  size="xs"
                />
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

            {signedIn && (
            <>
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
            </>
            )}

                        {signedIn && (
            <>
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
                              {s.counts.text > 0 && <span className="inline-flex items-center gap-0.5"><FiType className="w-3 h-3 text-violet-500 dark:text-violet-400" />{fmtNum(s.counts.text)}</span>}
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
            </>
            )}

                        {signedIn && (
            <>
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
                            onClick={() => removeHardItem(h)}
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
            </>
            )}

                        {signedIn && (
            <>
            {/* Stats */}
            <div className="text-sm text-[#707974] dark:text-gray-500">
              {t('library.pagesMemorizedStat', { count: memorizedCount })}
            </div>
            </>
            )}

                      </aside>
          )}

          {/* ── Mushaf column ─────────────────────────────── */}
          {/* w-full so that when the layout stacks (below lg) the column fills the
              row — `items-start` otherwise shrinks it to content width and pins it
              to the start edge, leaving the page card off-centre on narrow screens.

              The PANELS are full-bleed to the window edges, but the column between
              them still needs a measure: `main` lost its cap so the panels could
              reach the edges, which left this column free to stretch across an
              ultrawide monitor. 1620px is the widest spread (1560) plus this
              column's own `sm:px-6` gutters, so the cap bounds the column without
              ever squeezing the mushaf. */}
          <div className="flex-1 w-full max-w-[1620px] mx-auto flex flex-col gap-4 min-w-0 px-4 sm:px-6">

            {/* Discoverability cue — the self-test hint stays while testing; the
                plain "tap a verse" cue retires once the reader has selected one. */}
            {(concealMode || !seenVerseTap) && (
              <p data-tour="lib-verse" className="w-full max-w-[650px] mx-auto -mb-1 flex items-center justify-center gap-1.5 text-center text-xs text-[#707974] dark:text-gray-500">
                <FiInfo className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
                {selfTestWhileDrawing
                  ? t('library.selfTest.hint.hideDrawing')
                  : concealMode ? t(`library.selfTest.hint.${concealMode}`) : t('hints.libraryVerseTap')}
              </p>
            )}

            {/* The scroller spans the column and carries the size cap; at the
                default fit it is not a scroll box at all. Zoomed, it becomes the
                window the enlarged page is panned inside (see useMushafZoom). */}
            <div
              ref={scrollerRef}
              className={`mushaf-scroller w-full ${twoPage ? 'mushaf-spread-cap' : 'mushaf-page-cap'}`}
            >
            {/* Mushaf page(s) — the relative wrapper hosts the floating edge
                arrows (they fade in on hover of this viewport) and the swipe
                target. In single view it hugs the card; in the spread it spans
                the full row so the arrows flank the whole spread. */}
            <div
              ref={viewportRef}
              className="mushaf-viewport relative"
              onPointerDownCapture={(e) => { lastPointerRef.current = { x: e.clientX, y: e.clientY }; rangeDragDown(e); }}
              onClickCapture={swallowRangeClick}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Edge hot-zones: LEFT turns forward, RIGHT turns back (RTL book).
                  Pure affordance — hidden on touch (swipe covers that), sit in the
                  margin outside the text frame, and step aside at the book's ends.
                  Hidden while annotating (page turns are suspended in draw mode). */}
              {/* Still here while annotating: marking up a run of pages shouldn't
                  mean stopping to leave annotate mode between each one. */}
              {pagesData.length > 0 && !pageError && (
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
                <div className="w-full rounded-2xl border-2 border-amber-200/70 dark:border-amber-900/40 bg-[#fdf8ec] dark:bg-[#1f1b14] shadow-xl">
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
                // so the page-turn animation has something to leave from (dimmed,
                // but only once a load has taken long enough to be noticed —
                // delay-150 — so a quick load never flashes).
                <div className={twoPage ? 'w-full flex gap-3 items-stretch' : 'w-full'} style={twoPage ? { direction: 'rtl' } : undefined}>
                  {(twoPage ? visiblePages : [currentPage]).map((p) => skeletonCard(p))}
                </div>
              ) : (
                <div className={`transition-opacity duration-200${pageLoading ? ' opacity-60 delay-150' : ''}`} aria-busy={pageLoading || undefined}>
                  {twoPage ? (
                    <div className="w-full flex gap-3 items-stretch" style={{ direction: 'rtl' }}>
                      {pagesData.map(renderPageCard)}
                    </div>
                  ) : (
                    <div className="w-full">
                      {renderPageCard(pagesData[0], 0)}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* ── Page scrubber — fast navigation without typing, tight
                against the page card(s) so it's visible without scrolling ── */}
            <div className="w-full max-w-[650px] mx-auto -mt-2">
              <PageScrubber
                currentPage={currentPage}
                onNavigate={goToPage}
                onScrubbingChange={(on) => (on ? holdPrefetch() : resumePrefetch())}
                fmtNum={fmtNum}
              />
            </div>

            {/* Page info bar */}
            <p className="text-sm text-[#707974] dark:text-gray-500 text-center">
              {t('library.pageInfoLabel', { n: fmtNum(currentPage) })}
              {currentSurahName && <> · {t('library.surahLabel')} {currentSurahName}</>}
              {' '}· {t('library.juzInfoLabel', { n: fmtNum(currentJuz) })}
            </p>

            {/* Verse action popover — placed near the selection (fixed), draggable
                via the grip. It can be folded down to a pill (the chevron / Escape)
                without losing the selection — the verse stays highlighted and the
                tafsir panel keeps following it; the bottom audio bar is always
                there, so nothing is lost by folding this away. */}
            {((selectedVerse && !popoverHidden) || spanPopoverShown) && (
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
                {/* What the actions act on: one verse, or the whole span — named
                    and counted, so a span can't be mistaken for its first verse. */}
                <span data-testid="popover-verse-ref" className="text-xs font-semibold text-[#003527] dark:text-gray-200 whitespace-nowrap">
                  {selectedVerse
                    ? verseRef(selectedVerse)
                    : t('library.span.label', { range: spanRangeLabel, verses: spanVersesLabel(rangeSelection.endOrd - rangeSelection.startOrd + 1) })}
                </span>
                {/* Transport (play/pause + prev/next) + Tafsir — the popover is the
                    sole controller while it's open (the bottom bar is hidden). A
                    span has no prev/next: stepping is a single verse's move. */}
                {selectedVerse ? (
                <div className="flex items-center gap-1.5" data-tour="verse-actions">
                  <Tooltip label={t('tooltips.prevVerse')}>
                    <button
                      onClick={() => stepSelection(-1)}
                      disabled={selectedOrd === 1}
                      aria-label={t('tooltips.prevVerse')}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <FiSkipBack className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </Tooltip>
                  {(() => {
                    const isThisPlaying = selectedOrd != null && selectedOrd === playingOrd && isPlaying;
                    return (
                      <Tooltip label={isThisPlaying ? t('tooltips.pause') : t('tooltips.playFromHere')}>
                        <button
                          onClick={() => toggleVerseAudio(selectedOrd)}
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
                      onClick={() => stepSelection(1)}
                      disabled={selectedOrd === TOTAL_AYAHS}
                      aria-label={t('tooltips.nextVerse')}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                    >
                      <FiSkipForward className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  </Tooltip>
                  <Tooltip label={t('tooltips.verseTafsir')}>
                    <button
                      onClick={() => openTafsir(selectedVerse.verseKey)}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#004f35] dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <FiBookOpen className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
                ) : (
                <div className="flex items-center gap-1.5">
                  <Tooltip label={spanIsPlaying ? t('tooltips.pause') : t('library.span.play')}>
                    <button
                      onClick={toggleSpanAudio}
                      className="w-8 h-8 rounded-full bg-[#004f35] text-white flex items-center justify-center hover:bg-[#003527] transition-colors"
                    >
                      {spanIsPlaying
                        ? <FiPause className="w-3.5 h-3.5" />
                        : <FiPlay className="w-3.5 h-3.5 ms-0.5 rtl:rotate-180" />}
                    </button>
                  </Tooltip>
                  <Tooltip label={t('library.span.tafsir')}>
                    <button
                      onClick={openSpanTafsir}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#004f35] dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <FiBookOpen className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
                )}
                {/* Annotation actions — highlight swatches, note, mark hard. Kept
                    off while the "mark verses" picking mode owns taps (it clears
                    the selection anyway, so this is a double guard). */}
                {signedIn && !markVersesMode && selectedVerse && (
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
                {/* The same actions for a whole span. Each swatch shows whether its
                    colour covers ALL the span (pressed), SOME of it (a dashed ring
                    — mixed) or none; pressing it sets all, or clears all when all
                    already have it. A note anchors to one verse, so it is offered
                    but explains itself instead of acting. */}
                {signedIn && !markVersesMode && !selectedVerse && (
                  <div className="flex items-center gap-1.5" data-tour="verse-annotate">
                    <span className="w-px h-6 bg-[#dce2f3] dark:bg-gray-600" aria-hidden="true" />
                    {ANNOTATION_COLORS.map(({ key, cls, labelKey }) => {
                      const cover = spanState?.color[key] ?? 'none';
                      const label = cover === 'some' ? t('library.span.partly', { label: t(labelKey) }) : t(labelKey);
                      return (
                        <Tooltip key={key} label={label}>
                          <button
                            onClick={() => setSpanHighlight(key)}
                            disabled={savingAnnotation || !spanState}
                            aria-label={label}
                            aria-pressed={cover === 'all' ? true : cover === 'some' ? 'mixed' : false}
                            data-cover={cover}
                            className={`w-6 h-6 rounded-full transition-transform disabled:opacity-50 ${cls} ${
                              cover === 'all'
                                ? 'ring-2 ring-offset-1 ring-[#004f35] dark:ring-emerald-400 dark:ring-offset-gray-800 scale-110'
                                : cover === 'some'
                                  ? 'outline-2 outline-dashed outline-offset-2 outline-[#004f35] dark:outline-emerald-400 hover:scale-110'
                                  : 'ring-1 ring-black/10 dark:ring-white/25 hover:scale-110'
                            }`}
                          />
                        </Tooltip>
                      );
                    })}
                    {spanState?.highlighted > 0 && (
                      <Tooltip label={t('library.span.removeHighlight')}>
                        <button
                          onClick={() => setSpanHighlight(null)}
                          disabled={savingAnnotation}
                          aria-label={t('library.span.removeHighlight')}
                          className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          <FiSlash className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    {/* aria-disabled, not disabled: a disabled button gets no hover,
                        and the tooltip is the whole point here. */}
                    <Tooltip label={t('library.span.noteDisabled')}>
                      <button
                        type="button"
                        aria-disabled="true"
                        aria-label={t('library.span.noteDisabled')}
                        onClick={(e) => e.preventDefault()}
                        className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center opacity-40 cursor-not-allowed"
                      >
                        <FiMessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    {(() => {
                      const cover = spanState?.hard ?? 'none';
                      const label = cover === 'all' ? t('library.span.unmarkHard') : t('library.span.markHard');
                      return (
                        <Tooltip label={label}>
                          <button
                            onClick={toggleSpanHard}
                            disabled={savingAnnotation || !spanState}
                            aria-label={label}
                            aria-pressed={cover === 'all' ? true : cover === 'some' ? 'mixed' : false}
                            data-cover={cover}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors disabled:opacity-50 ${
                              cover === 'all'
                                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                                : cover === 'some'
                                  ? 'border-dashed border-red-400 dark:border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                  : 'border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                          >
                            <FiFlag className={`w-3.5 h-3.5 ${cover === 'all' ? 'fill-current' : ''}`} />
                          </button>
                        </Tooltip>
                      );
                    })()}
                  </div>
                )}
                {/* Put the actions away but KEEP the selection — distinct from the
                    X beside it, which drops the selection altogether. The verse (or
                    span) stays highlighted and the tafsir panel keeps following it;
                    a hint above the mushaf says how to bring these back. */}
                <Tooltip label={t('tooltips.collapseVerseActions')}>
                  <button
                    onClick={() => (selectedVerse
                      ? setPopoverHidden(true)
                      : setRangeSelection(({ startOrd, endOrd }) => ({ startOrd, endOrd })))}
                    aria-label={t('tooltips.collapseVerseActions')}
                    className="w-8 h-8 rounded-full text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiEyeOff className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
                <Tooltip label={t('tooltips.close')}>
                  <button
                    onClick={() => (selectedVerse ? setSelectedVerseKey(null) : setRangeSelection(null))}
                    className="w-8 h-8 rounded-full text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            )}

            {/* ── Sticky audio bar — stays visible with the popover (reciter, speed, repeat live here) ── */}
            <div data-tour="lib-audio" data-keeps-selection className="sticky bottom-3 z-20 w-full max-w-[720px] mx-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl border border-[#dce2f3] dark:border-gray-700 shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tooltip label={t('tooltips.prevVerse')}>
                  <button
                    onClick={() => stepVerse(-1)}
                    disabled={pageLoading || pageError || verses.length === 0 || playingOrd === 1}
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
                    disabled={pageLoading || pageError || verses.length === 0 || playingOrd === TOTAL_AYAHS}
                    className="w-9 h-9 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                  >
                    <FiSkipForward className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
              </div>

              <div className="flex-1 min-w-25 sm:min-w-30">
                <p className="text-xs font-semibold text-[#003527] dark:text-gray-200 flex items-center gap-1.5">
                  <FiHeadphones className="w-3.5 h-3.5 text-[#004f35] dark:text-emerald-400 shrink-0" />
                  {audioError
                    ? <span className="text-[#ba1a1a] dark:text-red-400">{t('library.audioError')}</span>
                    : playingOrd == null
                      ? t('library.listen')
                      : playingIndex >= 0
                        ? t('library.verseOf', { current: fmtNum(playingIndex + 1), total: fmtNum(verses.length) })
                        : ordLabel(playingOrd)}
                </p>
                {rangeProgress && (
                  <p data-testid="repeat-progress" className="mt-0.5 ps-5 text-[11px] text-[#707974] dark:text-gray-400">
                    {rangeProgress}
                  </p>
                )}
              </div>

              {/* Page zoom. Not an audio control — it lives in this bar because the
                  bar is always on screen and never over the text (see the
                  component). Last in the bar from sm up. On a phone the bar wraps
                  and only its first row has room, and the chat launcher sits over
                  that row's END — so there it leads the bar instead. */}
              <MushafZoomControl zoom={zoom} fmtNum={fmtNum} className="order-first sm:order-last" />

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

              {/* Pause between verses: the reciter's own, or trimmed short */}
              <Tooltip label={t('library.audio.versePause')}>
                <select
                  value={versePause}
                  onChange={e => setVersePause(e.target.value === 'tight' ? 'tight' : 'natural')}
                  aria-label={t('library.audio.versePause')}
                  data-testid="verse-pause"
                  className="rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                >
                  <option value="natural">{t('library.audio.versePauseNatural')}</option>
                  <option value="tight">{t('library.audio.versePauseTight')}</option>
                </select>
              </Tooltip>

              {/* Repeat for memorization (verse ×N / range loop) */}
              <div className="relative" ref={repeatMenuRef}>
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
                  <div className={`absolute bottom-full mb-2 end-0 z-40 ${repeatMode === 'range' ? 'w-80' : 'w-64'} bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-600 shadow-xl p-3 flex flex-col gap-3`} dir={isArabic ? 'rtl' : 'ltr'}>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#f0f4ff] dark:bg-gray-700/50 p-0.5">
                      {[['off', t('library.audio.repeatOff')], ['verse', t('library.audio.repeatVerse')], ['range', t('library.audio.repeatRange')]].map(([m, label]) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setRepeatMode(m);
                            // The span repeat is aimed at IS the selection while
                            // Range is on; leaving Range drops it.
                            setRangeSelection(m === 'range' ? { startOrd: rangeStartOrd, endOrd: rangeEndOrd } : null);
                          }}
                          className={`text-xs font-semibold rounded-md px-1.5 py-1.5 transition-colors ${
                            repeatMode === m ? 'bg-white dark:bg-gray-800 text-[#003527] dark:text-emerald-400 shadow-sm' : 'text-[#707974] dark:text-gray-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {repeatMode === 'verse' && (
                      <RepeatCountRow
                        label={t('library.audio.repeatEachVerse')}
                        counts={REP_COUNTS}
                        value={verseRepeat}
                        onChange={setVerseRepeat}
                        fmtNum={fmtNum}
                        testId="repeat-verse-count"
                      />
                    )}

                    {repeatMode === 'range' && (
                      <div className="flex flex-col gap-2">
                        {/* The range is addressed globally: any verse of the Quran can be
                            picked, and playback turns the pages to follow it. */}
                        <VerseRangePicker
                          label={t('library.audio.rangeFrom')}
                          surahName={`${t('library.audio.rangeFrom')} — ${t('library.surahLabel')}`}
                          ayahName={`${t('library.audio.rangeFrom')} — ${t('library.verseLabel', { n: '' }).trim()}`}
                          ord={rangeStartOrd}
                          onChange={(ord) => setRange(ord, Math.max(ord, rangeEndOrd))}
                          surahLabelFor={surahLabelFor}
                          fmtNum={fmtNum}
                          selectCls={selectCls}
                        />
                        <VerseRangePicker
                          label={t('library.audio.rangeTo')}
                          surahName={`${t('library.audio.rangeTo')} — ${t('library.surahLabel')}`}
                          ayahName={`${t('library.audio.rangeTo')} — ${t('library.verseLabel', { n: '' }).trim()}`}
                          ord={rangeEndOrd}
                          onChange={(ord) => setRange(Math.min(ord, rangeStartOrd), ord)}
                          surahLabelFor={surahLabelFor}
                          fmtNum={fmtNum}
                          selectCls={selectCls}
                        />
                        {/* Says out loud how far the range reaches — a range that
                            spans pages is the whole point, so show the page span. */}
                        <p className="text-[11px] text-[#707974] dark:text-gray-400">
                          {t(
                            pageOfOrd(rangeStartOrd) === pageOfOrd(rangeEndOrd)
                              ? 'library.audio.rangeSpanOnePage'
                              : 'library.audio.rangeSpan',
                            {
                              verses: fmtNum(rangeEndOrd - rangeStartOrd + 1),
                              from: fmtNum(pageOfOrd(rangeStartOrd)),
                              to: fmtNum(pageOfOrd(rangeEndOrd)),
                            }
                          )}
                        </p>
                        {/* The two counts, listed in the order they apply: the
                            inner one drills each verse, the outer one runs the
                            whole passage again. */}
                        <RepeatCountRow
                          label={t('library.audio.repeatEachVerse')}
                          counts={RANGE_VERSE_COUNTS}
                          value={rangeVerseRepeat}
                          onChange={setRangeVerseRepeat}
                          fmtNum={fmtNum}
                          testId="repeat-range-verse-count"
                        />
                        <RepeatCountRow
                          label={t('library.audio.repeatWholeRange')}
                          counts={REP_COUNTS}
                          value={rangeRepeat}
                          onChange={setRangeRepeat}
                          fmtNum={fmtNum}
                          testId="repeat-range-count"
                        />
                        <button
                          type="button"
                          onClick={() => { setRepeatOpen(false); setRangePasses(0); setRepeatsDone(0); playOrd(rangeStartOrd); }}
                          className="text-xs font-semibold text-white bg-[#004f35] hover:bg-[#003527] rounded-lg py-1.5 transition-colors"
                        >
                          {t('library.audio.playRange')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ReciterPicker value={reciter} onChange={setReciter} isArabic={isArabic} />
            </div>

            {/* The ping-pong pair: one plays while the other preloads the next verse.
                The playback-state handlers — spinner, error line, auto-advance —
                still listen to the ACTIVE element only, so a buffering preload never
                touches what the reader sees. Readiness and failure are recorded for
                BOTH: a prefetch that 502s has to be seen and retried, and a buffer
                may only be swapped into once it has said it can play. */}
            {[audioARef, audioBRef].map((ref, i) => (
              <audio
                key={i}
                ref={ref}
                preload="auto"
                onEnded={handleEnded}
                onPause={handleAudioPause}
                onWaiting={(e) => { if (e.currentTarget === activeEl()) setAudioBuffering(true); }}
                onPlaying={(e) => { if (e.currentTarget === activeEl()) { lastProgressRef.current = performance.now(); setAudioBuffering(false); setAudioError(false); } }}
                onTimeUpdate={(e) => { if (e.currentTarget === activeEl()) lastProgressRef.current = performance.now(); }}
                onLoadedData={(e) => markBufReady(e.currentTarget)}
                onCanPlay={(e) => markBufReady(e.currentTarget)}
                onCanPlayThrough={(e) => markBufReady(e.currentTarget)}
                onError={handleAudioError}
              />
            ))}
          </div>

          {/* ── Tafsir panel ───────────────────────
              Below lg it is exactly what it was: a bottom sheet with a backdrop
              on phones, an overlaying side panel on tablets. From lg it becomes
              a COLUMN OF THE ROW instead of a `fixed` overlay, so the reader
              column shrinks and the page — uniformly scaled inside its fixed
              576×852 frame — simply renders smaller rather than being covered.
              The sidebar hides itself to pay for that room (see showSidebar). */}
          {tafsirOpen && (
            <>
              <div
                className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={() => setTafsirOpen(false)}
              />
              <div
                data-testid="tafsir-panel"
                data-keeps-selection
                className="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl border-[#dce2f3] dark:border-gray-700 flex flex-col
                           bottom-0 inset-x-0 max-h-[78vh] rounded-t-3xl border-t
                           md:bottom-0 md:top-0 md:inset-x-auto md:end-0 md:h-full md:max-h-full md:w-[420px] md:rounded-none md:border-s md:border-t-0
                           lg:sticky lg:top-20 lg:self-start lg:inset-auto lg:z-auto lg:h-auto lg:max-h-[calc(100vh-6rem)]
                           lg:shrink-0 lg:rounded-2xl lg:rounded-e-none lg:border lg:border-e-0 lg:shadow-xl
                           reader-panel reader-panel--end"
                style={isWide ? { width: tafsirWidth } : undefined}
              >
                {/* Resize handle on the panel's inner edge — only where the panel is
                    part of the layout. Absolutely positioned and 1px wide in flow
                    terms, so it changes nothing about the panel's own box. */}
                {isWide && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('library.tafsirResize')}
                    aria-valuenow={tafsirWidth}
                    aria-valuemin={TAFSIR_MIN_W}
                    aria-valuemax={TAFSIR_MAX_W}
                    tabIndex={0}
                    data-testid="tafsir-resize"
                    onPointerDown={startTafsirResize}
                    onKeyDown={onTafsirResizeKey}
                    onDoubleClick={() => commitTafsirWidth(400)}
                    className={`absolute inset-y-0 start-0 w-2 -ms-1 cursor-col-resize z-10 group
                                flex items-center justify-center touch-none
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004f35] dark:focus-visible:ring-emerald-400 ${
                      tafsirResizing ? 'bg-[#004f35]/20 dark:bg-emerald-400/20' : ''
                    }`}
                  >
                    <span className="w-0.5 h-10 rounded-full bg-[#dce2f3] dark:bg-gray-600 group-hover:bg-[#004f35] dark:group-hover:bg-emerald-400 transition-colors" />
                  </div>
                )}
                {/* Header */}
                <div className="px-5 lg:pe-[25px] py-4 border-b border-[#dce2f3] dark:border-gray-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FiBookOpen className="w-4 h-4 text-[#004f35] dark:text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">
                      {t(tafsirEd.kind === 'irab' ? 'library.irabTitle' : 'library.tafsirTitle')}
                    </h3>
                    <InfoHint text={t('hints.tafsir')} label={t('library.tafsir')} />
                  </div>
                  {/* Prev/next move the SELECTION, so the mushaf's highlight travels
                      with the panel — crossing to the next page when it runs off
                      the end of the visible one. */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip label={t('tooltips.prevVerse')}>
                      <button
                        onClick={() => stepSelection(-1)}
                        disabled={panelStepOrd == null || panelStepOrd === 1}
                        aria-label={t('tooltips.prevVerse')}
                        className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      >
                        <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
                      </button>
                    </Tooltip>
                    <Tooltip label={t('tooltips.nextVerse')}>
                      <button
                        onClick={() => stepSelection(1)}
                        disabled={panelStepOrd == null || panelStepOrd === TOTAL_AYAHS}
                        aria-label={t('tooltips.nextVerse')}
                        className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
                      >
                        <FiChevronRight className="w-4 h-4 rtl:rotate-180" />
                      </button>
                    </Tooltip>
                    <Tooltip label={t('tooltips.close')}>
                      <button
                        onClick={() => setTafsirOpen(false)}
                        aria-label={t('tooltips.close')}
                        className="w-8 h-8 rounded-lg text-[#707974] dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Body */}
                {/* pe-[25px]: the panel is flush against the window edge now, so the
                    text needs a little room on that side to breathe. */}
                <div className="flex-1 overflow-y-auto p-5 lg:pe-[25px] flex flex-col gap-4">
                  {/* Nothing selected at all: say so. An empty panel reads like a
                      load that never finished. (A selected verse whose page is
                      still arriving — a cross-page step — keeps the skeleton,
                      because that one really IS loading.) */}
                  {!tafsirVerse && !panelVerseKey ? (
                    <div data-testid="tafsir-empty" className="flex flex-col items-center gap-3 py-10 text-center">
                      <FiBookOpen className="w-8 h-8 text-[#b0b6bd] dark:text-gray-600" />
                      <p className="text-sm text-[#707974] dark:text-gray-400 max-w-[24ch]">{t('library.tafsirPickVerse')}</p>
                    </div>
                  ) : !tafsirVerse ? tafsirSkeleton : (
                    <>
                      {/* The verse, mushaf-styled */}
                      <div dir="rtl" className="rounded-xl bg-[#fdf8ec] dark:bg-[#1f1b14] border border-amber-200/70 dark:border-amber-900/40 px-4 py-3">
                        <p className="mushaf-text !text-xl text-[#1f1505] dark:text-[#f3e9d2]">
                          {verseText(tafsirVerse)}
                          <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                            ﴿{toArabicDigits(tafsirVerse.ayahNumber)}﴾
                          </span>
                        </p>
                      </div>

                      {/* Surah / verse + play (toggles: pauses if this verse is playing) */}
                      <div className="flex items-center justify-between gap-3">
                        <p data-testid="tafsir-verse-ref" className="text-xs font-semibold text-[#404944] dark:text-gray-300">{verseRef(tafsirVerse)}</p>
                        {(() => {
                          const tafsirOrd = ordOfKey(tafsirVerse.verseKey);
                          const tafsirPlaying = tafsirOrd != null && tafsirOrd === playingOrd && isPlaying;
                          return (
                            <button
                              onClick={() => toggleVerseAudio(tafsirOrd)}
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
                            aria-label={t('library.tafsirEdition')}
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
                      {tafsirLoading ? tafsirSkeleton : tafsirError ? (
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
                        <>
                          {/* This book comments on a whole passage at once and returns
                              the same text for every verse in it. Say so, rather than
                              let it look as though the wrong verse loaded. */}
                          {tafsirRun && (
                            <p
                              data-testid="tafsir-run"
                              dir={isArabic ? 'rtl' : 'ltr'}
                              className="rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
                            >
                              {t('library.tafsirCovers', { from: fmtNum(tafsirRun.from), to: fmtNum(tafsirRun.to) })}
                            </p>
                          )}
                          <div data-testid="tafsir-text" dir="rtl" className="tafsir-prose text-[#1A1A1A] dark:text-gray-200">
                            {tafsirParagraphs.map((para, i) => <p key={i}>{para}</p>)}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </main>

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
          Collapsing it does NOT stop annotating: the collapsed chip keeps saying
          which tool is live, the page keeps taking strokes, and the pencil (or a
          click on the chip) brings the toolbar back. */}
      {drawPage != null && drawMenuOpen && (
        <div
          ref={drawMenuRef}
          data-testid="draw-menu"
          data-keeps-selection
          style={{ top: drawMenuPos.top, left: drawMenuPos.left }}
          className="fixed z-40 bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-600 shadow-xl p-2 flex flex-col gap-1.5 select-none"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tools row — each tooltip names both keys that pick it, the number is
              badged on the button, and pressing or clicking the tool that is
              already active stops annotating. The number stays a Western digit in
              Arabic too (deliberately not fmtNum): it labels a KEYCAP, like the
              Latin letter beside it, and Western digits are printed on the number
              row of every Arabic keyboard — Arabic-Indic ones only on some. */}
          <div className="flex items-center gap-1">
            {DRAW_TOOLS.map((tl) => {
              const ToolIcon = tl.icon;
              const isActive = drawTool === tl.k;
              const label = t('library.draw.toolKeys', { tool: t(tl.labelKey), num: tl.num, key: tl.key.toUpperCase() });
              return (
                <Tooltip key={tl.k} label={isActive ? `${label} — ${t('library.draw.hideTools')}` : label}>
                  <button
                    type="button"
                    onClick={() => selectTool(tl.k)}
                    aria-label={label}
                    aria-keyshortcuts={`${tl.num} ${tl.key.toUpperCase()}`}
                    aria-pressed={isActive}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? 'bg-[#004f35] text-white' : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                    }`}
                  >
                    <ToolIcon className="w-4 h-4" />
                    <span
                      aria-hidden="true"
                      data-testid="draw-tool-num"
                      className={`absolute bottom-0.5 end-1 text-[9px] font-semibold leading-none tabular-nums ${
                        isActive ? 'text-white/80' : 'text-[#707974] dark:text-gray-400'
                      }`}
                    >
                      {tl.num}
                    </span>
                  </button>
                </Tooltip>
              );
            })}
            <InfoHint text={t('hints.drawTools')} label={t('library.draw.enter')} />
          </div>
          {/* Colours row (hidden for the eraser) */}
          {drawTool !== 'eraser' && (
            <div className="flex items-center gap-2 px-1 py-0.5">
              {DRAW_COLORS.map(({ key, cls, labelKey }) => (
                <Tooltip key={key} label={drawColor === key ? `${t(labelKey)} — ${t('library.draw.hideTools')}` : t(labelKey)}>
                  <button
                    type="button"
                    onClick={() => selectColor(key)}
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
              <button type="button" onClick={() => runHistory('undo')} disabled={historyRef.current.undo.length === 0} aria-label={t('library.draw.undo')}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <FiRotateCcw className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label={t('library.draw.redo')}>
              <button type="button" onClick={() => runHistory('redo')} disabled={historyRef.current.redo.length === 0} aria-label={t('library.draw.redo')}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-40 transition-colors">
                <FiRotateCw className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip label={t('library.draw.clear')}>
              <button type="button" onClick={() => setClearConfirm(true)} disabled={(drawStrokesByPage[targetDrawPage()] ?? []).length === 0} aria-label={t('library.draw.clear')}
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

      {/* Confirm changing a bookmark's page (a replace when an unnamed one would
          land on another unnamed one), or removing a bookmark */}
      <ConfirmModal
        isOpen={!!bookmarkConfirm}
        onClose={() => {
          // Back to the button that asked (Remove, or Move) — its row may have
          // re-sorted or re-rendered meanwhile, so find it afresh.
          if (bookmarkConfirm) focusBookmarkAction(bookmarkConfirm.bookmark._id, bookmarkConfirm.kind === 'remove' ? 'remove' : 'move');
          setBookmarkConfirm(null);
        }}
        onConfirm={() => {
          const c = bookmarkConfirm;
          if (c.kind === 'move') moveBookmark(c.bookmark, c.page);
          else if (c.kind === 'replace') moveBookmark(c.bookmark, c.page, true);
          else removeBookmark(c.bookmark);
        }}
        {...bookmarkDialog}
      />

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
