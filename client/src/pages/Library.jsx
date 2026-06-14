import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiPlay, FiPause, FiSkipBack, FiSkipForward, FiX,
  FiBookOpen, FiChevronLeft, FiChevronRight, FiAlertCircle, FiHeadphones, FiInfo, FiMove,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import { progressAPI } from '../services/api';
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
  const isArabic = i18n.language === 'ar';
  const fmtNum = (n) => (isArabic ? toArabicDigits(n) : String(n));

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = clampPage(searchParams.get('page') ?? 1);
  const [pageInput, setPageInput] = useState(String(currentPage));

  const [ayahs, setAyahs] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [memorizedPages, setMemorizedPages] = useState(new Set());

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
    if (page !== currentPage) setSearchParams({ page: String(page) }, { replace: true });
  };

  const handlePageInputKey = (e) => { if (e.key === 'Enter') goToPage(pageInput); };
  const handlePageInputBlur = () => {
    const n = Number(pageInput);
    if (!n || n < 1 || n > 604) setPageInput(String(currentPage));
    else goToPage(n);
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
    ? (isArabic ? firstSurah.name : firstSurah.englishName)
    : '';
  const memorizedCount = memorizedPages.size;
  const selectedAyah = selectedIndex != null ? ayahs[selectedIndex] : null;

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

            {/* Page navigation */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">{t('library.pageLabel')}</span>
              <div className="flex items-center gap-2">
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
          </aside>

          {/* ── Mushaf column ─────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* Discoverability cue: the per-verse listen/tafsir actions only
                appear after a tap, so tell the user up front. */}
            <p className="w-full max-w-[650px] mx-auto -mb-1 flex items-center justify-center gap-1.5 text-center text-xs text-[#707974] dark:text-gray-500">
              <FiInfo className="w-3.5 h-3.5 shrink-0 text-[#004f35] dark:text-emerald-400" />
              {t('hints.libraryVerseTap')}
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
                          {block.items.map(({ index, ayah, text }) => (
                            <span
                              key={ayah.number}
                              onClick={() => setSelectedIndex(prev => prev === index ? null : index)}
                              className={`cursor-pointer transition-colors rounded px-0.5 -mx-0.5 box-decoration-clone ${
                                playingIndex === index
                                  ? 'bg-emerald-200/70 dark:bg-emerald-700/40'
                                  : selectedIndex === index
                                    ? 'bg-amber-200/70 dark:bg-amber-600/30'
                                    : 'hover:bg-emerald-100/60 dark:hover:bg-emerald-800/20'
                              }`}
                            >
                              {text}
                              <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                                ﴿{toArabicDigits(ayah.numberInSurah)}﴾
                              </span>
                            </span>
                          ))}
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
            <div className="sticky bottom-3 z-20 w-full max-w-[650px] mx-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl border border-[#dce2f3] dark:border-gray-700 shadow-lg px-4 py-3 flex flex-wrap items-center gap-3">
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

      <Footer />
    </div>
  );
}
