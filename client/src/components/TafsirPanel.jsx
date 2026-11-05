import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiBookOpen, FiChevronLeft, FiChevronRight, FiX, FiPlay, FiPause, FiAlertCircle } from 'react-icons/fi';
import Tooltip from './Tooltip';
import InfoHint from './InfoHint';
import {
  fetchPageTafsir, fetchEditionAyahTafsir, findTafsirRun, toArabicDigits, TAFSIR_EDITIONS,
} from '../services/quranApi';
import { ayahCount, ordOfKey, TOTAL_AYAHS } from '../utils/verseIndex';
import { reportLoadFailure } from '../utils/reportError';
import { TAFSIR_MIN_W, TAFSIR_MAX_W, TAFSIR_DEFAULT_W, clampTafsirWidth } from './tafsirWidth';

// The ayah's plain Uthmani text (basmala excluded), used for the legible
// preview. Taken verse-level from the API — word-level text is no longer
// fetched (it corrupts boundary page numbers; see mushafApi fetch note).
const verseText = (verse) => verse.textUthmani ?? '';

// Shown while the tafsir text loads, and while the panel waits on the page a
// cross-page step has just turned to.
const tafsirSkeleton = (
  <div className="flex flex-col gap-2.5 animate-pulse pt-1" dir="rtl">
    {Array(6).fill(0).map((_, i) => (
      <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-700" style={{ width: `${95 - (i % 3) * 8}%` }} />
    ))}
  </div>
);

// The Library's tafsir panel: the verse, its commentary in the chosen edition,
// and the docked column's resize handle.
//
// Below lg it is a bottom sheet with a backdrop on phones and an overlaying side
// panel on tablets. From lg it is a COLUMN OF THE ROW instead of a `fixed`
// overlay, so the reader column shrinks and the page — uniformly scaled inside
// its fixed 576×852 frame — simply renders smaller rather than being covered.
//
// Mounted only while the panel is open, inside its own error boundary: the
// commentary's loading state, the text split into paragraphs and the live width
// of a resize all live here, so a bad response crashes this panel and not the
// reader (M-14), and a resize re-renders this panel and not the whole Library
// (M-10). The boundary's Retry remounts it, which reads the commentary again.
//
// Which verse it shows is the reader's business (it follows the selection, and
// remembers the last verse when the selection goes): `verse` is that verse, or
// null while a verse's page is still arriving; `panelVerseKey` is null when
// nothing at all is picked.
export default function TafsirPanel({
  verse,
  panelVerseKey,
  edition,
  onEditionChange,
  dialog,
  onClose,
  isWide,
  width,
  onWidthCommit,
  onWidthPreview,
  stepOrd,
  onStep,
  playingOrd,
  isPlaying,
  onToggleVerseAudio,
  verseRef,
  fmtNum,
  isArabic,
  selectClassName,
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  // { from, to } when the edition returned one block for a run of verses rather
  // than for this verse alone — see findTafsirRun. null when it is per-ayah.
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The width while the handle is being dragged; null otherwise. The reader only
  // hears about the result, on release.
  const [dragWidth, setDragWidth] = useState(null);
  const shownWidth = dragWidth ?? width;
  const ed = TAFSIR_EDITIONS.find((e) => e.id === edition) ?? TAFSIR_EDITIONS[0];

  // A new verse, edition or Retry starts a fresh read: the old commentary goes
  // and the skeleton shows, in the same render (React's "adjust state when a
  // prop changes" pattern), and the effect below fetches.
  const [readFor, setReadFor] = useState({ verse, ed, reloadKey });
  if (readFor.verse !== verse || readFor.ed !== ed || readFor.reloadKey !== reloadKey) {
    setReadFor({ verse, ed, reloadKey });
    setLoading(true);
    setError(false);
    setText('');
    setRun(null);
  }

  useEffect(() => {
    if (!verse) return;
    let cancelled = false;
    const load = ed.source === 'page'
      ? fetchPageTafsir(verse.page, ed.edition).then(list =>
          list.find(a => a.number === verse.id)?.text ?? '')
      : fetchEditionAyahTafsir(ed, verse.surahNumber, verse.ayahNumber);
    load
      .then(loaded => {
        if (cancelled) return;
        setText(loaded);
        // Only the spa5k editions still hand back one block for a whole passage —
        // the hefz ones are per-ayah, and the page ones always were. Work out how
        // far a block reaches only AFTER the text is on screen, so the banner
        // never costs the reader any waiting.
        if (ed.source !== 'ayah') return;
        findTafsirRun(ed.slug, verse.surahNumber, verse.ayahNumber, ayahCount(verse.surahNumber), loaded)
          .then(found => { if (!cancelled && found.to > found.from) setRun(found); })
          .catch(() => { /* the label is a nicety — never fail the read over it */ });
      })
      .catch((err) => { reportLoadFailure(err, `tafsir for ${verse.verseKey}`); if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [verse, ed, reloadKey]);

  // The commentary as real paragraphs. Every line break in the source starts a new
  // one — for a book like Aysar those are its labelled definitions, one per line —
  // and the styles give them modest spacing instead of the full blank line a
  // pre-wrapped block used to produce. Kept as one element, so a resize, which
  // re-renders the panel per move, never re-renders a long commentary.
  const paragraphs = useMemo(
    () => text.split(/\n+/).map((para) => para.trim()).filter(Boolean).map((para, i) => <p key={i}>{para}</p>),
    [text]
  );

  // Drag the panel's inner edge to resize it. The handle always sits on the
  // panel's INLINE-START edge — the side facing the mushaf in both writing
  // directions — so dragging toward the mushaf widens the panel in LTR and
  // dragging away from it does in RTL; `dir` decides which way that is.
  const startResize = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();          // never start a text selection or a page-turn swipe
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const rtl = document.documentElement.getAttribute('dir') === 'rtl';
    const widthAt = (ev) => clampTafsirWidth(startW + (rtl ? ev.clientX - startX : startX - ev.clientX));
    setDragWidth(startW);
    const onMove = (ev) => {
      // Inline-start edge: in LTR the panel grows as the pointer moves LEFT.
      const next = widthAt(ev);
      setDragWidth(next);
      onWidthPreview?.(next);
    };
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragWidth(null);
      onWidthCommit(widthAt(ev));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [width, onWidthCommit, onWidthPreview]);

  // Same job from the keyboard, for anyone not using a pointer.
  // The arrow moves the handle the way it points, as the pointer drag does: the
  // panel is on the right in English (left widens it) and on the left in Arabic
  // (right widens it). A key the handle uses is spent here — it used to reach
  // the reader's own handler too and turn the page as well (M-12).
  const onResizeKey = useCallback((e) => {
    const step = e.shiftKey ? 64 : 16;
    const widen = isArabic ? 'ArrowRight' : 'ArrowLeft';
    const narrow = isArabic ? 'ArrowLeft' : 'ArrowRight';
    let next = null;
    if (e.key === widen) next = width + step;
    else if (e.key === narrow) next = width - step;
    else if (e.key === 'Home') next = TAFSIR_MIN_W;
    else if (e.key === 'End') next = TAFSIR_MAX_W;
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    onWidthCommit(clampTafsirWidth(next));
  }, [width, onWidthCommit, isArabic]);

  return (
    <>
      <div
        data-dialog-keep
        className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div
        {...dialog.dialogProps}
        data-testid="tafsir-panel"
        data-keeps-selection
        className="fixed z-50 bg-white dark:bg-gray-800 shadow-2xl border-[#dce2f3] dark:border-gray-700 flex flex-col
                   bottom-0 inset-x-0 max-h-[78vh] rounded-t-3xl border-t
                   md:bottom-0 md:top-0 md:inset-x-auto md:end-0 md:h-full md:max-h-full md:w-[420px] md:rounded-none md:border-s md:border-t-0
                   lg:sticky lg:top-20 lg:self-start lg:inset-auto lg:z-auto lg:h-auto lg:max-h-[calc(100vh-6rem)]
                   lg:shrink-0 lg:rounded-2xl lg:rounded-e-none lg:border lg:border-e-0 lg:shadow-xl
                   reader-panel reader-panel--end"
        style={isWide ? { width: shownWidth } : undefined}
      >
        {/* Resize handle on the panel's inner edge — only where the panel is
            part of the layout. Absolutely positioned and 1px wide in flow
            terms, so it changes nothing about the panel's own box. */}
        {isWide && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('library.tafsirResize')}
            aria-valuenow={shownWidth}
            aria-valuemin={TAFSIR_MIN_W}
            aria-valuemax={TAFSIR_MAX_W}
            tabIndex={0}
            data-testid="tafsir-resize"
            onPointerDown={startResize}
            onKeyDown={onResizeKey}
            onDoubleClick={() => onWidthCommit(clampTafsirWidth(TAFSIR_DEFAULT_W))}
            className={`absolute inset-y-0 start-0 w-2 -ms-1 cursor-col-resize z-10 group
                        flex items-center justify-center touch-none
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004f35] dark:focus-visible:ring-emerald-400 ${
              dragWidth != null ? 'bg-[#004f35]/20 dark:bg-emerald-400/20' : ''
            }`}
          >
            <span className="w-0.5 h-10 rounded-full bg-[#dce2f3] dark:bg-gray-600 group-hover:bg-[#004f35] dark:group-hover:bg-emerald-400 transition-colors" />
          </div>
        )}
        {/* Header */}
        <div className="px-5 lg:pe-[25px] py-4 border-b border-[#dce2f3] dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <FiBookOpen className="w-4 h-4 text-[#004f35] dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 id={dialog.titleId} className="text-sm font-bold text-[#003527] dark:text-gray-100 truncate">
              {t(ed.kind === 'irab' ? 'library.irabTitle' : 'library.tafsirTitle')}
            </h2>
            <InfoHint text={t('hints.tafsir')} label={t('library.tafsir')} />
          </div>
          {/* Prev/next move the SELECTION, so the mushaf's highlight travels
              with the panel — crossing to the next page when it runs off
              the end of the visible one. */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip label={t('tooltips.prevVerse')}>
              <button
                onClick={() => onStep(-1)}
                disabled={stepOrd == null || stepOrd === 1}
                aria-label={t('tooltips.prevVerse')}
                className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <FiChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            </Tooltip>
            <Tooltip label={t('tooltips.nextVerse')}>
              <button
                onClick={() => onStep(1)}
                disabled={stepOrd == null || stepOrd === TOTAL_AYAHS}
                aria-label={t('tooltips.nextVerse')}
                className="w-8 h-8 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 flex items-center justify-center hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
              >
                <FiChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </Tooltip>
            <Tooltip label={t('tooltips.close')}>
              <button
                onClick={onClose}
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
          {!verse && !panelVerseKey ? (
            <div data-testid="tafsir-empty" className="flex flex-col items-center gap-3 py-10 text-center">
              <FiBookOpen className="w-8 h-8 text-[#b0b6bd] dark:text-gray-600" />
              <p className="text-sm text-[#707974] dark:text-gray-400 max-w-[24ch]">{t('library.tafsirPickVerse')}</p>
            </div>
          ) : !verse ? tafsirSkeleton : (
            <>
              {/* The verse, mushaf-styled — only once its text is known, never an empty frame */}
              {verseText(verse) && (
                <div dir="rtl" data-testid="tafsir-verse-text" className="rounded-xl bg-[#fdf8ec] dark:bg-[#1f1b14] border border-amber-200/70 dark:border-amber-900/40 px-4 py-3">
                  <p className="mushaf-text !text-xl text-[#1f1505] dark:text-[#f3e9d2]">
                    {verseText(verse)}
                    <span className="text-emerald-700 dark:text-emerald-400 select-none mx-1 text-[0.85em]">
                      ﴿{toArabicDigits(verse.ayahNumber)}﴾
                    </span>
                  </p>
                </div>
              )}

              {/* Surah / verse + play (toggles: pauses if this verse is playing) */}
              <div className="flex items-center justify-between gap-3">
                <p data-testid="tafsir-verse-ref" className="text-xs font-semibold text-[#404944] dark:text-gray-300">{verseRef(verse)}</p>
                {(() => {
                  const ord = ordOfKey(verse.verseKey);
                  const playing = ord != null && ord === playingOrd && isPlaying;
                  return (
                    <button
                      onClick={() => onToggleVerseAudio(ord)}
                      title={playing ? t('library.pause') : t('library.playThisVerse')}
                      aria-label={playing ? t('library.pause') : t('library.playThisVerse')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f35] dark:text-emerald-400 border border-[#004f35]/30 dark:border-emerald-500/30 px-3 py-1.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      {playing
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
                    value={edition}
                    aria-label={t('library.tafsirEdition')}
                    onChange={e => onEditionChange(e.target.value)}
                    className={selectClassName}
                  >
                    {TAFSIR_EDITIONS.map(option => (
                      <option key={option.id} value={option.id}>{isArabic ? option.nameAr : option.nameEn}</option>
                    ))}
                  </select>
                </Tooltip>
              </div>

              {/* Tafsir text */}
              {loading ? tafsirSkeleton : error ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <FiAlertCircle className="w-8 h-8 text-[#707974] dark:text-gray-500" />
                  <p className="text-sm text-[#404944] dark:text-gray-400">{t('library.tafsirError')}</p>
                  <button
                    onClick={() => setReloadKey(k => k + 1)}
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
                  {run && (
                    <p
                      data-testid="tafsir-run"
                      dir={isArabic ? 'rtl' : 'ltr'}
                      className="rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200"
                    >
                      {t('library.tafsirCovers', { from: fmtNum(run.from), to: fmtNum(run.to) })}
                    </p>
                  )}
                  <div data-testid="tafsir-text" dir="rtl" className="tafsir-prose text-[#1A1A1A] dark:text-gray-200">
                    {paragraphs}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
