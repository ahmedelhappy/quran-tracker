import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward, FiX,
  FiBookOpen, FiChevronLeft, FiChevronRight, FiChevronDown, FiAlertCircle, FiHeadphones, FiInfo, FiMove, FiCheck,
  FiTarget, FiEye, FiEyeOff, FiArrowRight, FiHelpCircle, FiCheckSquare, FiSquare,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import HowToMemorizeModal from '../components/HowToMemorizeModal';
import { startLibraryTour, startMemorizeTour, startVerseActionsCoachmark } from '../components/libraryTour';
import { progressAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  fetchPageText,
  fetchPageTafsir,
  fetchAyahTafsir,
  getAyahAudioUrl,
  splitBasmala,
  toArabicDigits,
  RECITERS,
  DEFAULT_RECITER,
  TAFSIR_EDITIONS,
} from '../services/quranApi';
import { SURAH_PAGES } from '../data/surahPages';
import { useDraggable } from '../hooks/useDraggable';

const JUZ_START_PAGES = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582,
];

const clampPage = (n) => Math.max(1, Math.min(604, Number(n) || 1));

export default function Library() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const isArabic = i18n.language === 'ar';
  const fmtNum = (n) => (isArabic ? toArabicDigits(n) : String(n));

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = clampPage(searchParams.get('page') ?? 1);
  const [pageInput, setPageInput] = useState(String(currentPage));

  // ── Memorize mode: a focused, guided session reflected in the URL so it
  // deep-links and survives refresh. The reader itself is unchanged; this
  // only re-frames the sidebar and layers self-testing on top of the text.
  const memorizeMode = searchParams.get('mode') === 'memorize';
  const [testSelf, setTestSelf] = useState(false);          // hide text for active recall
  const [revealAll, setRevealAll] = useState(false);
  const [revealedSet, setRevealedSet] = useState(() => new Set()); // verses peeked one by one
  const [checkedSteps, setCheckedSteps] = useState(() => new Set()); // ephemeral method ticks
  const [methodOpen, setMethodOpen] = useState(true);
  const [howToOpen, setHowToOpen] = useState(false);

  const [ayahs, setAyahs] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [memorizedPages, setMemorizedPages] = useState(new Set());
  const [savingMemorized, setSavingMemorized] = useState(false);

  // ── Audio state ─────────────────────────────────────────
  const [reciter, setReciter] = useState(() => {
    const saved = localStorage.getItem('reciter');
    return RECITERS.some(r => r.id === saved) ? saved : DEFAULT_RECITER;
  });
  const [playingIndex, setPlayingIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // ── Verse selection + tafsir state ──────────────────────
  const [selectedIndex, setSelectedIndex] = useState(null);
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
  // One live tour at a time; `tourActiveRef` also blocks the verse coachmark
  // from stacking on top of a running tour. The *-checked refs latch each
  // walkthrough to one attempt per mount.
  const tourRef = useRef(null);
  const tourActiveRef = useRef(false);
  const libTourCheckedRef = useRef(false);
  const memTourCheckedRef = useRef(false);

  // Mount: memorized pages (for the badge + stat)
  useEffect(() => {
    progressAPI.getAllProgress().then(res => {
      const pages = res.data?.data?.memorizedPages ?? [];
      setMemorizedPages(new Set(pages));
    }).catch(() => {});
  }, []);

  // Page change: fetch mushaf text
  useEffect(() => {
    let cancelled = false;
    setPageInput(String(currentPage));
    setPageLoading(true);
    setPageError(false);
    fetchPageText(currentPage)
      .then(data => { if (!cancelled) setAyahs(data); })
      .catch(() => { if (!cancelled) setPageError(true); })
      .finally(() => { if (!cancelled) setPageLoading(false); });
    return () => { cancelled = true; };
  }, [currentPage, reloadKey]);

  const stopAudio = useCallback(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.removeAttribute('src'); }
    setPlayingIndex(null);
    setIsPlaying(false);
    setAudioBuffering(false);
  }, []);

  // Page change / unmount: stop audio, clear selection, close tafsir
  useEffect(() => {
    return () => {
      stopAudio();
      setSelectedIndex(null);
      setTafsirOpen(false);
      setTafsirIndex(null);
    };
  }, [currentPage, stopAudio]);

  // Page change: start a fresh self-test (everything concealed again)
  useEffect(() => {
    setRevealAll(false);
    setRevealedSet(new Set());
  }, [currentPage]);

  // Leaving memorize mode: drop the self-test so the reader shows normally
  useEffect(() => {
    if (!memorizeMode) {
      setTestSelf(false);
      setRevealAll(false);
      setRevealedSet(new Set());
    }
  }, [memorizeMode]);

  // First-visit reader tour — only in the normal reader (memorize mode has its
  // own tour below), gated by `seenLibraryTour`. `?tour=1` (Settings → Replay)
  // forces it and is then stripped from the URL. Deferred a beat so the reader
  // has painted before spotlighting. The cleanup only cancels a still-pending
  // launch; an already-running tour is torn down on real unmount, so React
  // StrictMode's dev double-run can't kill a live tour.
  useEffect(() => {
    if (memorizeMode || libTourCheckedRef.current) return;
    const forceTour = searchParams.get('tour') === '1';
    if (!forceTour && localStorage.getItem('seenLibraryTour')) {
      libTourCheckedRef.current = true;
      return;
    }
    const id = setTimeout(() => {
      libTourCheckedRef.current = true;
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
  }, [memorizeMode]);

  // First memorize-mode entry — a short tour of only the controls it adds,
  // gated by `seenMemorizeModeTour`. Mode-exclusive with the reader tour above,
  // so the two never stack.
  useEffect(() => {
    if (!memorizeMode || memTourCheckedRef.current) return;
    if (localStorage.getItem('seenMemorizeModeTour')) {
      memTourCheckedRef.current = true;
      return;
    }
    const id = setTimeout(() => {
      memTourCheckedRef.current = true;
      const tour = startMemorizeTour({
        t,
        onDone: () => {
          localStorage.setItem('seenMemorizeModeTour', '1');
          tourActiveRef.current = false;
          tourRef.current = null;
        },
      });
      if (tour) { tourRef.current = tour; tourActiveRef.current = true; }
      else localStorage.setItem('seenMemorizeModeTour', '1');
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memorizeMode]);

  // Tear down a running tour only on real unmount (navigating away mid-tour).
  useEffect(() => () => {
    tourRef.current?.destroy?.();
    tourRef.current = null;
    tourActiveRef.current = false;
  }, []);

  // One-time coachmark the first time a verse is selected — highlights the
  // Play + Tafsir buttons in the popover. Fires at most once ever (the flag is
  // set up-front) and never while a tour is running (guards against stacking).
  useEffect(() => {
    if (selectedIndex == null || tourActiveRef.current) return;
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
  }, [selectedIndex]);

  // Drive the single <audio> element: load + play current ayah
  useEffect(() => {
    const el = audioRef.current;
    if (!el || playingIndex == null || !ayahs[playingIndex]) return;
    setAudioError(false);
    el.src = getAyahAudioUrl(reciter, ayahs[playingIndex].number);
    if (isPlaying) {
      el.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex, reciter, ayahs]);

  useEffect(() => {
    localStorage.setItem('reciter', reciter);
  }, [reciter]);

  const playAyah = (index) => {
    if (index < 0 || index >= ayahs.length) return;
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
    if (playingIndex != null && playingIndex < ayahs.length - 1) {
      setPlayingIndex(playingIndex + 1);
    } else {
      stopAudio();
    }
  };

  const goToPage = (n) => {
    const page = clampPage(n);
    if (page === currentPage) return;
    // Preserve memorize mode across page navigation so the session continues.
    const params = { page: String(page) };
    if (memorizeMode) params.mode = 'memorize';
    setSearchParams(params, { replace: true });
  };

  // ── Memorize mode controls ───────────────────────────────
  const enterMemorize = () => setSearchParams({ page: String(currentPage), mode: 'memorize' }, { replace: true });
  const exitMemorize = () => setSearchParams({ page: String(currentPage) }, { replace: true });

  // A verse is hidden while self-testing until it's peeked (or "Reveal all").
  const isConcealed = (index) => memorizeMode && testSelf && !revealAll && !revealedSet.has(index);
  const revealVerse = (index) => setRevealedSet(prev => new Set(prev).add(index));
  const hideAllVerses = () => { setRevealAll(false); setRevealedSet(new Set()); };
  const toggleTestSelf = () => { setTestSelf(v => !v); hideAllVerses(); };
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

  // ── Mark / unmark the current page as memorized ──────────
  // This always marks/unmarks the FULL page (the app has no half-page mode),
  // so there's no half-index to track here. Optimistically flip the local
  // set + count, then reconcile with the server, rolling back on error.
  const toggleMemorized = async () => {
    if (savingMemorized) return;
    const prevPages = memorizedPages;
    const adding = !prevPages.has(currentPage);
    const nextPages = new Set(prevPages);
    if (adding) nextPages.add(currentPage); else nextPages.delete(currentPage);

    setSavingMemorized(true);
    setMemorizedPages(nextPages);
    try {
      if (adding) {
        // memorizedDate is set server-side by the 'new' handler.
        await progressAPI.markComplete({ pageNumber: currentPage, type: 'new' });
        showToast(t('library.markedToast', { n: fmtNum(currentPage) }), 'success');
      } else {
        // Replace the memorized set instead of calling `uncomplete`: that route
        // only undoes pages memorized *today*, so it 400s on older/onboarded
        // pages. updateMemorized deletes the dropped page regardless of date.
        await progressAPI.updateMemorized({ memorizedPages: Array.from(nextPages) });
        showToast(t('library.unmarkedToast', { n: fmtNum(currentPage) }), 'success');
      }
    } catch {
      setMemorizedPages(prevPages); // roll back the optimistic change
      showToast(t('common.error'), 'error');
    } finally {
      setSavingMemorized(false);
    }
  };

  // ── Tafsir loading ───────────────────────────────────────
  const tafsirAyah = tafsirIndex != null ? ayahs[tafsirIndex] : null;

  useEffect(() => {
    if (!tafsirOpen || !tafsirAyah) return;
    let cancelled = false;
    const ed = TAFSIR_EDITIONS.find(e => e.id === tafsirEdition) ?? TAFSIR_EDITIONS[0];
    setTafsirLoading(true);
    setTafsirError(false);
    setTafsirText('');
    const load = ed.source === 'page'
      ? fetchPageTafsir(currentPage, ed.edition).then(list =>
          list.find(a => a.number === tafsirAyah.number)?.text ?? '')
      : fetchAyahTafsir(ed.slug, tafsirAyah.surah.number, tafsirAyah.numberInSurah);
    load
      .then(text => { if (!cancelled) setTafsirText(text); })
      .catch(() => { if (!cancelled) setTafsirError(true); })
      .finally(() => { if (!cancelled) setTafsirLoading(false); });
    return () => { cancelled = true; };
  }, [tafsirOpen, tafsirAyah, tafsirEdition, currentPage, tafsirReloadKey]);

  useEffect(() => {
    localStorage.setItem('tafsirEdition', tafsirEdition);
  }, [tafsirEdition]);

  const openTafsir = (index) => {
    setTafsirIndex(index);
    setTafsirOpen(true);
  };

  // ── Derived data ─────────────────────────────────────────
  const blocks = useMemo(() => {
    const out = [];
    let run = null;
    ayahs.forEach((ayah, index) => {
      const { basmala, text } = splitBasmala(ayah);
      if (ayah.numberInSurah === 1) {
        run = null;
        out.push({ type: 'surah', key: `s-${ayah.surah.number}`, surah: ayah.surah });
      }
      if (basmala) {
        run = null;
        out.push({ type: 'basmala', key: `b-${ayah.surah.number}`, text: basmala });
      }
      if (!run) {
        run = { type: 'run', key: `r-${ayah.number}`, items: [] };
        out.push(run);
      }
      run.items.push({ index, ayah, text });
    });
    return out;
  }, [ayahs]);

  const currentJuz = JUZ_START_PAGES.reduce((juz, start, i) => (start <= currentPage ? i + 1 : juz), 1);
  const firstSurah = ayahs[0]?.surah ?? null;
  const sidebarSurah = SURAH_PAGES.find(s =>
    firstSurah ? s.number === firstSurah.number : (s.start <= currentPage && currentPage <= s.end)
  ) ?? SURAH_PAGES.find(s => s.start <= currentPage && currentPage <= s.end);
  const currentSurahName = firstSurah
    ? (isArabic
        // API name already carries the "سورة" prefix; use the bare name from
        // SURAH_PAGES so the "سورة" label isn't repeated.
        ? (SURAH_PAGES.find(s => s.number === firstSurah.number)?.arabic ?? firstSurah.name)
        : firstSurah.englishName)
    : '';
  const memorizedCount = memorizedPages.size;
  const selectedAyah = selectedIndex != null ? ayahs[selectedIndex] : null;
  const pageMemorized = memorizedPages.has(currentPage);

  // Reuse the shared 7-step method strings (also powering HowToMemorizeModal).
  const methodSteps = t('howTo.steps', { returnObjects: true });
  const stepList = Array.isArray(methodSteps) ? methodSteps : [];

  const verseRef = (ayah) =>
    `${isArabic ? (SURAH_PAGES.find(s => s.number === ayah.surah.number)?.arabic ?? ayah.surah.name) : ayah.surah.englishName} · ${t('library.verseLabel', { n: fmtNum(ayah.numberInSurah) })}`;

  const selectCls =
    'w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500';

  return (
    <div className="min-h-screen bg-[#FFFDF5] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="grow w-full max-w-7xl mx-auto px-6 pt-28 pb-12">
        {/* Page header — orient a first-time visitor */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#003527] dark:text-gray-100">{t('nav.library')}</h1>
          <p className="text-sm text-[#404944] dark:text-gray-400 mt-1">{t('library.subtitle')}</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Sidebar ───────────────────────────────────── */}
          <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-4 flex flex-col gap-5 sacred-shadow lg:sticky lg:top-28 lg:self-start">

            {/* Memorize-mode header + exit */}
            {memorizeMode && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#004f35]/5 dark:bg-emerald-900/20 border border-[#004f35]/15 dark:border-emerald-800/30 px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#003527] dark:text-emerald-300">
                  <FiTarget className="w-4 h-4 text-[#004f35] dark:text-emerald-400" />
                  {t('library.memorize.title')}
                </span>
                <Tooltip label={t('library.memorize.exit')}>
                  <button
                    onClick={exitMemorize}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#707974] dark:text-gray-300 hover:text-[#003527] dark:hover:text-gray-100 rounded-lg px-2 py-1 hover:bg-white/60 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FiX className="w-3.5 h-3.5" /> {t('library.memorize.exitShort')}
                  </button>
                </Tooltip>
              </div>
            )}

            {/* Page navigation */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.pageLabel')}</span>
              <div className="flex items-center gap-2" data-tour="lib-nav">
                <Tooltip label={t('tooltips.prevPage')}>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </Tooltip>
                <span className="flex-1 text-center text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">
                  {fmtNum(currentPage)} / {fmtNum(604)}
                </span>
                <Tooltip label={t('tooltips.nextPage')}>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= 604}
                    className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronRight className="w-4 h-4 rtl:rotate-180" />
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
              {memorizedPages.has(currentPage) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-2.5 py-1 rounded-full w-max">
                  ✓ {t('library.memorizedBadge')}
                </span>
              )}
              {/* Quick edit: mark/unmark this page as memorized without leaving the reader.
                  In memorize mode the prominent CTA below replaces this. */}
              {!memorizeMode && (
                <button
                  onClick={toggleMemorized}
                  disabled={savingMemorized}
                  className={`mt-0.5 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    pageMemorized
                      ? 'border border-[#dce2f3] dark:border-gray-600 text-[#707974] dark:text-gray-400 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
                      : 'bg-[#004f35] text-white hover:bg-[#003527]'
                  }`}
                >
                  {pageMemorized ? (
                    t('library.undoMemorized')
                  ) : (
                    <><FiCheck className="w-3.5 h-3.5" /> {t('library.markMemorized')}</>
                  )}
                </button>
              )}
            </div>

            {memorizeMode ? (
              <>
                {/* ── Self-test (active recall) ── */}
                <div className="flex flex-col gap-2.5 rounded-xl border border-[#dce2f3] dark:border-gray-700 p-3.5">
                  <button
                    onClick={toggleTestSelf}
                    data-tour="mem-test"
                    className={`w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-colors ${
                      testSelf
                        ? 'bg-[#004f35] text-white hover:bg-[#003527]'
                        : 'border border-[#004f35]/30 dark:border-emerald-500/30 text-[#004f35] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    {testSelf
                      ? <><FiEye className="w-3.5 h-3.5" /> {t('library.memorize.showText')}</>
                      : <><FiEyeOff className="w-3.5 h-3.5" /> {t('library.memorize.testSelf')}</>}
                  </button>
                  <p className="text-xs text-[#707974] dark:text-gray-500 leading-relaxed">{t('library.memorize.testSelfHint')}</p>
                  {testSelf && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRevealAll(true)}
                        className="flex-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
                      >
                        {t('library.memorize.revealAll')}
                      </button>
                      <button
                        onClick={hideAllVerses}
                        className="flex-1 text-xs font-medium rounded-lg border border-[#dce2f3] dark:border-gray-600 px-2 py-1.5 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
                      >
                        {t('library.memorize.hideAll')}
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Mark memorized CTA + continue ── */}
                <div className="flex flex-col gap-2">
                  {pageMemorized ? (
                    <>
                      <span className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-3 py-2 rounded-lg">
                        ✓ {t('library.memorize.memorizedDone')}
                      </span>
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= 604}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2.5 bg-[#004f35] text-white hover:bg-[#003527] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('library.memorize.nextPage')} <FiArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </button>
                      <button
                        onClick={toggleMemorized}
                        disabled={savingMemorized}
                        className="text-xs text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        {t('library.memorize.undo')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={toggleMemorized}
                      disabled={savingMemorized}
                      data-tour="mem-mark"
                      className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl px-3 py-3 bg-[#004f35] text-white hover:bg-[#003527] disabled:opacity-50 disabled:cursor-not-allowed transition-colors sacred-shadow"
                    >
                      <FiCheck className="w-4 h-4" /> {t('library.memorize.markThisPage')}
                    </button>
                  )}
                </div>

                {/* ── Method checklist (ephemeral ticks) ── */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setMethodOpen(o => !o)}
                    className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500 hover:text-[#404944] dark:hover:text-gray-300 transition-colors"
                  >
                    {t('library.memorize.method')}
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
                        <FiHelpCircle className="w-3.5 h-3.5" /> {t('library.memorize.fullGuide')}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Enter memorize mode */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={enterMemorize}
                    data-tour="lib-memorize"
                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2.5 bg-[#004f35] text-white hover:bg-[#003527] transition-colors"
                  >
                    <FiTarget className="w-4 h-4" /> {t('library.memorize.enter')}
                  </button>
                  <p className="text-xs text-[#707974] dark:text-gray-500 leading-relaxed">{t('library.memorize.enterHint')}</p>
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

                {/* Stats */}
                <div className="text-sm text-[#707974] dark:text-gray-500">
                  {t('library.pagesMemorizedStat', { count: memorizedCount })}
                </div>
              </>
            )}
          </aside>

          {/* ── Mushaf column ─────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* Discoverability cue: in self-test the tap reveals a hidden verse;
                otherwise the per-verse listen/tafsir actions appear after a tap. */}
            <p data-tour="lib-verse" className="w-full max-w-[650px] mx-auto -mb-1 flex items-center justify-center gap-1.5 text-center text-xs text-[#707974] dark:text-gray-500">
              <FiInfo className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
              {memorizeMode && testSelf ? t('library.memorize.tapToReveal') : t('hints.libraryVerseTap')}
            </p>

            {/* Mushaf page card */}
            <div className="w-full max-w-[650px] mx-auto rounded-2xl border-2 border-amber-200/70 dark:border-amber-900/40 bg-[#fdf8ec] dark:bg-[#1f1b14] shadow-xl dark:shadow-black/40 overflow-hidden">
              <div className="border border-amber-100 dark:border-amber-950/60 m-2 rounded-xl px-5 py-6 sm:px-8 sm:py-8 min-h-[60vh]">
                {pageLoading ? (
                  <div className="flex flex-col gap-4 animate-pulse pt-2" dir="rtl">
                    {Array(10).fill(0).map((_, i) => (
                      <div key={i} className="h-6 rounded bg-amber-100/70 dark:bg-gray-700/60" style={{ width: `${88 + (i % 3) * 4}%` }} />
                    ))}
                  </div>
                ) : pageError ? (
                  <div className="h-64 flex flex-col items-center justify-center gap-3 text-center">
                    <FiAlertCircle className="w-10 h-10 text-[#707974] dark:text-gray-500" />
                    <p className="text-sm font-medium text-[#404944] dark:text-gray-400">{t('library.loadError')}</p>
                    <button
                      onClick={() => setReloadKey(k => k + 1)}
                      className="text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                ) : (
                  <div dir="rtl">
                    {blocks.map(block => {
                      if (block.type === 'surah') {
                        return (
                          <div key={block.key} className="my-4 rounded-xl border-2 border-emerald-800/30 dark:border-emerald-500/30 bg-emerald-900/5 dark:bg-emerald-500/5 px-4 py-2.5 flex items-center justify-center gap-3">
                            <span className="text-emerald-800/50 dark:text-emerald-400/50 select-none">۞</span>
                            <span className="mushaf-surah-name text-xl sm:text-2xl text-emerald-900 dark:text-emerald-300">
                              {block.surah.name}
                            </span>
                            <span className="text-emerald-800/50 dark:text-emerald-400/50 select-none">۞</span>
                          </div>
                        );
                      }
                      if (block.type === 'basmala') {
                        return (
                          <p key={block.key} className="mushaf-basmala text-[#1f1505] dark:text-[#f3e9d2] my-2">
                            {block.text}
                          </p>
                        );
                      }
                      return (
                        <p key={block.key} className="mushaf-text text-[#1f1505] dark:text-[#f3e9d2]">
                          {block.items.map(({ index, ayah, text }) => {
                            const concealed = isConcealed(index);
                            return (
                              <span
                                key={ayah.number}
                                onClick={() => {
                                  // While testing, the first tap peeks at a hidden verse;
                                  // afterwards a tap selects it for the listen/tafsir actions.
                                  if (concealed) { revealVerse(index); return; }
                                  setSelectedIndex(prev => prev === index ? null : index);
                                }}
                                className={`cursor-pointer transition-colors rounded px-0.5 -mx-0.5 box-decoration-clone ${
                                  playingIndex === index
                                    ? 'bg-emerald-200/70 dark:bg-emerald-700/40'
                                    : selectedIndex === index
                                      ? 'bg-amber-200/70 dark:bg-amber-600/30'
                                      : 'hover:bg-emerald-100/60 dark:hover:bg-emerald-800/20'
                                }`}
                              >
                                {/* Blur (not hide) the words so the line shape stays as a memory cue */}
                                <span className={concealed ? 'blur-[6px] opacity-50 select-none' : 'transition-[filter,opacity] duration-300'}>
                                  {text}
                                </span>
                                {/* Ayah-number marker stays sharp as an anchor */}
                                <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                                  ﴿{toArabicDigits(ayah.numberInSurah)}﴾
                                </span>
                              </span>
                            );
                          })}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Page info bar */}
            <p className="text-sm text-[#707974] dark:text-gray-500 text-center">
              {t('library.pageInfoLabel', { n: fmtNum(currentPage) })}
              {currentSurahName && <> · {t('library.surahLabel')} {currentSurahName}</>}
              {' '}· {t('library.juzInfoLabel', { n: fmtNum(currentJuz) })}
            </p>

            {/* Verse action popover — draggable only via the grip handle */}
            {selectedAyah && (
              <div
                ref={popoverRef}
                style={popoverDragStyle}
                className="sticky bottom-20 z-30 mx-auto bg-white dark:bg-gray-800 rounded-full border border-[#dce2f3] dark:border-gray-600 shadow-lg ps-1.5 pe-4 py-2 flex items-center gap-2 select-none"
              >
                <Tooltip label={t('tooltips.dragHandle')}>
                  <span
                    {...popoverDragHandlers}
                    aria-label={t('tooltips.dragHandle')}
                    className="flex items-center justify-center w-6 h-8 rounded-full text-[#b0b6bd] dark:text-gray-500 hover:text-[#707974] dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
                  >
                    <FiMove className="w-3.5 h-3.5" />
                  </span>
                </Tooltip>
                <span className="text-xs font-semibold text-[#003527] dark:text-gray-200 whitespace-nowrap">
                  {verseRef(selectedAyah)}
                </span>
                {/* Play + Tafsir actions — also the anchor for the one-time coachmark */}
                <div className="flex items-center gap-2" data-tour="verse-actions">
                  {(() => {
                    const isThisPlaying = selectedIndex === playingIndex && isPlaying;
                    return (
                      <Tooltip label={isThisPlaying ? t('tooltips.pause') : t('tooltips.playFromHere')}>
                        <button
                          onClick={() => toggleSelectedVerse(selectedIndex)}
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
                      onClick={() => openTafsir(selectedIndex)}
                      className="w-8 h-8 rounded-full border border-[#dce2f3] dark:border-gray-600 text-[#004f35] dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <FiBookOpen className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
                <Tooltip label={t('tooltips.close')}>
                  <button
                    onClick={() => setSelectedIndex(null)}
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
                    disabled={pageLoading || pageError || ayahs.length === 0}
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
                    disabled={pageLoading || pageError || ayahs.length === 0 || (playingIndex != null && playingIndex >= ayahs.length - 1)}
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
                      ? t('library.verseOf', { current: fmtNum(playingIndex + 1), total: fmtNum(ayahs.length) })
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
      {tafsirOpen && tafsirAyah && (
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
                    onClick={() => setTafsirIndex(i => Math.min(ayahs.length - 1, i + 1))}
                    disabled={tafsirIndex >= ayahs.length - 1}
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
                  {splitBasmala(tafsirAyah).text}
                  <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                    ﴿{toArabicDigits(tafsirAyah.numberInSurah)}﴾
                  </span>
                </p>
              </div>

              {/* Surah · verse + play */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#404944] dark:text-gray-300">{verseRef(tafsirAyah)}</p>
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
