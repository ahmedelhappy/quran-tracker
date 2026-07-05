import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward, FiX,
  FiBookOpen, FiChevronLeft, FiChevronRight, FiChevronDown, FiAlertCircle, FiHeadphones, FiInfo, FiMove,
  FiEye, FiEyeOff, FiHelpCircle, FiCheckSquare, FiSquare, FiFile, FiColumns,
  FiMaximize2, FiMinimize2, FiCheckCircle, FiCircle, FiBookmark, FiTrash2, FiPlus,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import HowToMemorizeModal from '../components/HowToMemorizeModal';
import MushafPage from '../components/MushafPage';
import { startLibraryTour, startVerseActionsCoachmark } from '../components/libraryTour';
import { progressAPI, bookmarksAPI } from '../services/api';
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
import { fetchMushafPage, ensurePageFont, mushafFontFamily } from '../services/mushafApi';
import { SURAH_PAGES } from '../data/surahPages';
import { useDraggable } from '../hooks/useDraggable';

const JUZ_START_PAGES = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582,
];

const clampPage = (n) => Math.max(1, Math.min(604, Number(n) || 1));

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
  const [memorizedPages, setMemorizedPages] = useState(new Set());
  const [savingMemorized, setSavingMemorized] = useState(false);

  // ── Bookmarks (account-saved, multiple per user) ────────
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [savingBookmark, setSavingBookmark] = useState(false);

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

  // Draggable verse action popover — dragged only via the grip handle
  const { ref: popoverRef, style: popoverDragStyle, dragHandlers: popoverDragHandlers } = useDraggable('versePopoverPos');

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

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute('src'); }
    setPlayingIndex(null);
    setIsPlaying(false);
    setAudioBuffering(false);
  }, []);

  // Page / view change: stop audio, clear selection, close tafsir (verse
  // indices shift when the on-screen verse set changes).
  useEffect(() => {
    stopAudio();
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

  // Drive the single <audio> element: load + play current ayah
  useEffect(() => {
    const el = audioRef.current;
    if (!el || playingIndex == null || !verses[playingIndex]) return;
    setAudioError(false);
    el.src = getAyahAudioUrl(reciter, verses[playingIndex].id);
    if (isPlaying) {
      el.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex, reciter, verses]);

  useEffect(() => {
    localStorage.setItem('reciter', reciter);
  }, [reciter]);

  const playAyah = (index) => {
    if (index < 0 || index >= verses.length) return;
    setAudioError(false);
    if (index === playingIndex) {
      const el = audioRef.current;
      if (el && !isPlaying) { el.play().catch(() => {}); setIsPlaying(true); }
      return;
    }
    setPlayingIndex(index);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playingIndex == null) { playAyah(0); return; }
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else { el.play().catch(() => {}); setIsPlaying(true); }
  };

  // Popover play button: play from the selected verse, or pause if it's the one already playing
  const toggleSelectedVerse = (index) => {
    const el = audioRef.current;
    if (index === playingIndex && isPlaying && el) { el.pause(); setIsPlaying(false); }
    else playAyah(index);
  };

  const handleEnded = () => {
    if (playingIndex != null && playingIndex < verses.length - 1) {
      setPlayingIndex(playingIndex + 1);
    } else {
      stopAudio();
    }
  };

  const pageStep = twoPage ? 2 : 1;
  const maxPage = twoPage ? 603 : 604;

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
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageDown':
          e.preventDefault(); goNext(); break;
        case 'ArrowRight':
        case 'PageUp':
          e.preventDefault(); goPrev(); break;
        case 'Escape':
          if (tafsirOpen) setTafsirOpen(false);
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
  }, [goNext, goPrev, tafsirOpen, selectedVerseKey, focused]);

  // ── Touch swipe to turn the page (physical RTL book) ─────
  // Swipe right → next, swipe left → prev, but only when the horizontal move
  // clearly dominates (so vertical scrolling is never hijacked) and no tour runs.
  const touchStartRef = useRef(null);
  const onTouchStart = (e) => {
    if (tourActiveRef.current) { touchStartRef.current = null; return; }
    const p = e.touches[0];
    touchStartRef.current = { x: p.clientX, y: p.clientY };
  };
  const onTouchEnd = (e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || tourActiveRef.current) return;
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
    const nextPages = new Set(prevPages);
    nextPages.add(page);
    setSavingMemorized(true);
    setMemorizedPages(nextPages);
    try {
      await progressAPI.markComplete({ pageNumber: page, type: 'new' });
      showToast(t('library.markedToast', { n: fmtNum(page) }), 'success');
    } catch {
      setMemorizedPages(prevPages); // roll back the optimistic change
      showToast(t('common.error'), 'error');
    } finally {
      setSavingMemorized(false);
    }
  };

  const unmarkPageMemorized = async (page) => {
    if (savingMemorized || !memorizedPages.has(page)) return;
    const prevPages = memorizedPages;
    const nextPages = new Set(prevPages);
    nextPages.delete(page);
    setSavingMemorized(true);
    setMemorizedPages(nextPages);
    try {
      await progressAPI.updateMemorized({ memorizedPages: Array.from(nextPages) });
      showToast(t('library.unmarkedToast', { n: fmtNum(page) }), 'success');
    } catch {
      setMemorizedPages(prevPages); // roll back the optimistic change
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
  const playingVerseKey = playingIndex != null ? verses[playingIndex]?.verseKey ?? null : null;
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
            <span className="shrink-0">{t('library.juzInfoLabel', { n: fmtNum(pageJuz) })}</span>
          </div>
          {/* Fixed-size framed page, uniformly scaled to fit the column. The turn
              animation lives INSIDE the frame so the frame itself never moves. */}
          <div className="mushaf-canvas">
            <div className="mushaf-frame">
              <Flip flipKey={pd.page} dir={turnDirRef.current} animate={!reduceMotion}>
                <MushafPage
                  pageData={pd}
                  fontFamily={mushafFontFamily(pd.page)}
                  selectedVerseKey={selectedVerseKey}
                  playingVerseKey={playingVerseKey}
                  concealMode={concealMode}
                  isConcealed={isConcealedHere}
                  onSelectVerse={selectVerse}
                  onRevealVerse={revealVerse}
                  onRevealThrough={revealThrough}
                  onHideVerse={hideVerse}
                />
              </Flip>
            </div>
          </div>
          {/* Page number + an interactive per-page memorized toggle, so each half
              of a spread can be marked/unmarked on its own. */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-800/60 dark:text-amber-200/40 select-none">
            {(() => {
              const done = memorizedPages.has(pd.page);
              const label = done
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
                    {done
                      ? <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      : <FiCircle className="w-4 h-4 text-amber-800/45 dark:text-amber-200/35" />}
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
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* Edge hot-zones: LEFT turns forward, RIGHT turns back (RTL book).
                  Pure affordance — hidden on touch (swipe covers that), sit in the
                  margin outside the text frame, and step aside at the book's ends. */}
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

            {/* Page info bar */}
            <p className="text-sm text-[#707974] dark:text-gray-500 text-center">
              {t('library.pageInfoLabel', { n: fmtNum(currentPage) })}
              {currentSurahName && <> · {t('library.surahLabel')} {currentSurahName}</>}
              {' '}· {t('library.juzInfoLabel', { n: fmtNum(currentJuz) })}
            </p>

            {/* Verse action popover — draggable only via the grip handle */}
            {selectedVerse && (
              <div
                ref={popoverRef}
                style={popoverDragStyle}
                className="sticky bottom-20 z-30 mx-auto bg-white dark:bg-gray-800 rounded-full border border-[#dce2f3] dark:border-gray-600 shadow-lg ps-1.5 pe-4 py-2 flex items-center gap-2 select-none"
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
                {/* Play + Tafsir actions — also the anchor for the one-time coachmark */}
                <div className="flex items-center gap-2" data-tour="verse-actions">
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
                  <Tooltip label={t('tooltips.verseTafsir')}>
                    <button
                      onClick={() => openTafsir(selectedAudioIndex)}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#004f35] dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <FiBookOpen className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
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

            {/* ── Sticky audio bar ───────────────────────── */}
            <div data-tour="lib-audio" className="sticky bottom-3 z-20 w-full max-w-[650px] mx-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl border border-[#dce2f3] dark:border-gray-700 shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Tooltip label={t('tooltips.prevVerse')}>
                  <button
                    onClick={() => playAyah((playingIndex ?? 0) - 1)}
                    disabled={pageLoading || pageError || playingIndex == null || playingIndex === 0}
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
                    onClick={() => playAyah(playingIndex == null ? 0 : playingIndex + 1)}
                    disabled={pageLoading || pageError || verses.length === 0 || (playingIndex != null && playingIndex >= verses.length - 1)}
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

              <Tooltip label={t('tooltips.reciter')}>
                <select
                  value={reciter}
                  onChange={e => setReciter(e.target.value)}
                  aria-label={t('tooltips.reciter')}
                  className="rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500 max-w-[180px]"
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
                <h3 className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">{t('library.tafsirTitle')}</h3>
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

              {/* Surah · verse + play */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#404944] dark:text-gray-300">{verseRef(tafsirVerse)}</p>
                <button
                  onClick={() => playAyah(tafsirIndex)}
                  title={t('library.playThisVerse')}
                  aria-label={t('library.playThisVerse')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f35] dark:text-emerald-400 border border-[#004f35]/30 dark:border-emerald-500/30 px-3 py-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <FiPlay className="w-3 h-3 rtl:rotate-180" /> {t('library.playThisVerse')}
                </button>
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

      {/* Full 7-step method, reused from the dashboard guide */}
      <HowToMemorizeModal isOpen={howToOpen} onClose={() => setHowToOpen(false)} />

      <Footer />
    </div>
  );
}
