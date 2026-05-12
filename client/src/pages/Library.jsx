import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiImage, FiHeadphones, FiPlay, FiPause, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { progressAPI } from '../services/api';
import {
  getPageImageUrl,
  getChapterAudioUrl,
  fetchVersesByPage,
  fetchChapters,
} from '../services/quranApi';

const JUZ_START_PAGES = [
  1,22,42,62,82,102,122,142,162,182,
  202,222,242,262,282,302,322,342,362,382,
  402,422,442,462,482,502,522,542,562,582,
];

export default function Library() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [verses, setVerses] = useState([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [versesError, setVersesError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [showVerses, setShowVerses] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffering, setAudioBuffering] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [memorizedPages, setMemorizedPages] = useState(new Set());
  const [lastChapterId, setLastChapterId] = useState(null);
  const audioRef = useRef(null);

  // Mount: load chapters and memorized pages
  useEffect(() => {
    fetchChapters().then(setChapters).catch(() => {});
    try {
      progressAPI.getAllProgress().then(res => {
        const pages = res.data?.memorizedPages ?? res.data?.data?.map?.(p => p.pageNumber) ?? [];
        setMemorizedPages(new Set(pages));
      }).catch(() => {});
    } catch {
      // not logged in — ignore
    }
  }, []);

  // Page change: reload image + verses + audio reset
  useEffect(() => {
    setPageInput(String(currentPage));
    setImageLoaded(false);
    setImageError(false);
    setVersesLoading(true);
    setVersesError(false);

    fetchVersesByPage(currentPage)
      .then(data => {
        setVerses(data);
        const newChapterId = data[0]?.chapter_id ?? null;
        if (newChapterId !== lastChapterId) {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.load();
          }
          setIsPlaying(false);
          setAudioError(false);
          setLastChapterId(newChapterId);
        }
      })
      .catch(() => setVersesError(true))
      .finally(() => setVersesLoading(false));
  }, [currentPage]);

  const goToPage = (n) => {
    const page = Math.max(1, Math.min(604, Number(n)));
    if (page !== currentPage) setCurrentPage(page);
  };

  const handlePageInputKey = (e) => {
    if (e.key === 'Enter') goToPage(pageInput);
  };

  const handlePageInputBlur = () => {
    const n = Number(pageInput);
    if (!n || n < 1 || n > 604) setPageInput(String(currentPage));
  };

  const currentJuz = JUZ_START_PAGES.reduce(
    (juz, start, i) => (start <= currentPage ? i + 1 : juz),
    1
  );

  const selectedJuz = JUZ_START_PAGES.reduce(
    (juz, start, i) => (start <= currentPage ? i + 1 : juz),
    1
  );

  const currentChapterId = verses[0]?.chapter_id ?? null;
  const currentSurahName = chapters.find(c => c.id === currentChapterId)?.[isArabic ? 'name_arabic' : 'name_simple'] ?? '';

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const memorizedCount = memorizedPages.size;

  return (
    <div className="min-h-screen bg-[#FFFDF5] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="grow w-full max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left Sidebar ───────────────────────────────── */}
          <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-4 flex flex-col gap-5 sacred-shadow lg:sticky lg:top-28 lg:self-start">

            {/* 1. Page navigation */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">Page</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
                >
                  ‹
                </button>
                <span className="flex-1 text-center text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">
                  {currentPage} / 604
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= 604}
                  className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 flex items-center justify-center text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
                >
                  ›
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="604"
                  value={pageInput}
                  onChange={e => setPageInput(e.target.value)}
                  onKeyDown={handlePageInputKey}
                  onBlur={handlePageInputBlur}
                  className="flex-1 rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                  placeholder="Go to page…"
                />
              </div>
              {memorizedPages.has(currentPage) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 px-2.5 py-1 rounded-full w-max">
                  ✓ Memorized
                </span>
              )}
            </div>

            {/* 2. Jump to Juz */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">Jump to Juz</span>
              <select
                value={selectedJuz}
                onChange={e => goToPage(JUZ_START_PAGES[Number(e.target.value) - 1])}
                className="w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
              >
                {JUZ_START_PAGES.map((_, i) => (
                  <option key={i + 1} value={i + 1}>Juz {i + 1}</option>
                ))}
              </select>
            </div>

            {/* 3. Jump to Surah */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500">Jump to Surah</span>
              {chapters.length === 0 ? (
                <div className="w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm text-[#707974] dark:text-gray-500 animate-pulse">
                  Loading…
                </div>
              ) : (
                <select
                  value={currentChapterId ?? ''}
                  onChange={e => {
                    const ch = chapters.find(c => c.id === Number(e.target.value));
                    if (ch?.pages?.[0]) goToPage(ch.pages[0]);
                  }}
                  className="w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
                >
                  {chapters.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.id}. {isArabic ? ch.name_arabic : ch.name_simple}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 4. Stats */}
            <div className="text-sm text-[#707974] dark:text-gray-500">
              <span className={memorizedCount > 0 ? 'text-green-600 dark:text-green-400 font-semibold' : ''}>
                {memorizedCount}
              </span>
              {' '}/ 604 pages memorized
            </div>
          </aside>

          {/* ── Right Content ───────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* Page image */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full flex justify-center">
                {!imageLoaded && !imageError && (
                  <div className="h-[72vh] w-80 bg-gray-100 dark:bg-gray-700 animate-pulse rounded" />
                )}
                {imageError ? (
                  <div className="h-64 w-80 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-800 rounded border border-[#dce2f3] dark:border-gray-700">
                    <FiImage className="w-10 h-10 text-[#707974] dark:text-gray-500" />
                    <p className="text-sm font-medium text-[#404944] dark:text-gray-400">Page image unavailable</p>
                    <p className="text-xs text-[#707974] dark:text-gray-500">Check your connection</p>
                  </div>
                ) : (
                  <img
                    key={currentPage}
                    src={getPageImageUrl(currentPage)}
                    alt={`Quran page ${currentPage}`}
                    className={`max-h-[72vh] w-auto object-contain rounded shadow-xl dark:shadow-black/40 select-none ${imageLoaded ? '' : 'hidden'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => { setImageError(true); setImageLoaded(false); }}
                  />
                )}
              </div>

              {/* Page info bar */}
              <p className="text-sm text-[#707974] dark:text-gray-500 text-center">
                Page {currentPage}
                {currentSurahName && <> · Surah {currentSurahName}</>}
                {' '}· Juz {currentJuz}
              </p>
            </div>

            {/* Audio player bar */}
            {!audioError && currentChapterId && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FiHeadphones className="w-4 h-4 text-[#004f35] dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] dark:text-gray-100 truncate">
                      {currentSurahName || 'Surah'}
                    </p>
                    <p className="text-[11px] text-[#707974] dark:text-gray-500">Mishary Rashid Al-Afasy</p>
                  </div>
                </div>
                <button
                  onClick={togglePlayPause}
                  className="w-9 h-9 rounded-full bg-[#004f35] text-white flex items-center justify-center shrink-0 hover:bg-[#003527] transition-colors"
                >
                  {audioBuffering ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <FiPause className="w-4 h-4" />
                  ) : (
                    <FiPlay className="w-4 h-4 ml-0.5" />
                  )}
                </button>
              </div>
            )}

            {/* Hidden audio element */}
            {currentChapterId && (
              <audio
                ref={audioRef}
                src={getChapterAudioUrl(currentChapterId)}
                onWaiting={() => setAudioBuffering(true)}
                onCanPlay={() => setAudioBuffering(false)}
                onError={() => { setAudioError(true); setIsPlaying(false); }}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            {/* Verse list collapsible */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowVerses(v => !v)}
                className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-[#f9f9ff] dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1A1A1A] dark:text-gray-100">
                    Verses on this page
                  </span>
                  {verses.length > 0 && (
                    <span className="text-xs bg-[#dce2f3] dark:bg-gray-700 text-[#404944] dark:text-gray-300 px-2 py-0.5 rounded-full">
                      {verses.length}
                    </span>
                  )}
                </div>
                {showVerses
                  ? <FiChevronUp className="w-4 h-4 text-[#707974] dark:text-gray-500" />
                  : <FiChevronDown className="w-4 h-4 text-[#707974] dark:text-gray-500" />
                }
              </button>

              {showVerses && (
                <div className="border-t border-[#dce2f3] dark:border-gray-700 p-4">
                  {versesLoading ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-1.5">
                          <div className="h-6 bg-gray-100 dark:bg-gray-700 animate-pulse rounded w-full" />
                          <div className="h-3 bg-gray-100 dark:bg-gray-700 animate-pulse rounded w-24" />
                        </div>
                      ))}
                    </div>
                  ) : versesError ? (
                    <p className="text-sm text-[#707974] dark:text-gray-500 text-center py-4">
                      Could not load verses
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {verses.map((verse, idx) => {
                        const chName = chapters.find(c => c.id === verse.chapter_id)?.[isArabic ? 'name_arabic' : 'name_simple'] ?? '';
                        return (
                          <div key={verse.id}>
                            <div dir="rtl" className="py-3">
                              <p className="arabic text-xl leading-loose text-[#1A1A1A] dark:text-gray-100 mb-1">
                                {verse.text_uthmani}
                              </p>
                              <p className="text-xs text-[#707974] dark:text-gray-500 text-left">
                                {chName} : {verse.verse_number}
                              </p>
                            </div>
                            {idx < verses.length - 1 && (
                              <hr className="border-[#dce2f3] dark:border-gray-700" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
