import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI, authAPI } from '../services/api';
import { FiPlus, FiX } from 'react-icons/fi';
import Logo from '../components/Logo';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import LanguageToggle from '../components/LanguageToggle';
import { SURAH_PAGES } from '../data/surahPages';
import { HIZB_RANGES, RUB_RANGES } from '../data/hizbRanges';

function toPageRanges(sortedPages) {
  if (!sortedPages || sortedPages.length === 0) return [{ start: '', end: '' }];
  const pages = [...sortedPages].sort((a, b) => a - b);
  const ranges = [];
  let start = pages[0], prev = pages[0];
  for (let i = 1; i < pages.length; i++) {
    if (pages[i] !== prev + 1) {
      ranges.push({ start: String(start), end: String(prev) });
      start = pages[i];
    }
    prev = pages[i];
  }
  ranges.push({ start: String(start), end: String(prev) });
  return ranges;
}

const JUZ_RANGES = [
  {juz:1,start:1,end:21},{juz:2,start:22,end:41},{juz:3,start:42,end:61},
  {juz:4,start:62,end:81},{juz:5,start:82,end:101},{juz:6,start:102,end:121},
  {juz:7,start:122,end:141},{juz:8,start:142,end:161},{juz:9,start:162,end:181},
  {juz:10,start:182,end:201},{juz:11,start:202,end:221},{juz:12,start:222,end:241},
  {juz:13,start:242,end:261},{juz:14,start:262,end:281},{juz:15,start:282,end:301},
  {juz:16,start:302,end:321},{juz:17,start:322,end:341},{juz:18,start:342,end:361},
  {juz:19,start:362,end:381},{juz:20,start:382,end:401},{juz:21,start:402,end:421},
  {juz:22,start:422,end:441},{juz:23,start:442,end:461},{juz:24,start:462,end:481},
  {juz:25,start:482,end:501},{juz:26,start:502,end:521},{juz:27,start:522,end:541},
  {juz:28,start:542,end:561},{juz:29,start:562,end:581},{juz:30,start:582,end:604},
];

const DAY_LABEL_KEYS = ['onboarding.dayName0','onboarding.dayName1','onboarding.dayName2','onboarding.dayName3','onboarding.dayName4','onboarding.dayName5','onboarding.dayName6'];

const INTENSITY_OPTIONS = [
  { value: 'light',    labelKey: 'settings.intensityLight',    descKey: 'settings.intensityLightDesc',     divisor: 14 },
  { value: 'standard', labelKey: 'settings.intensityStandard', descKey: 'settings.intensityStandardDesc',  divisor: 10 },
  { value: 'strong',   labelKey: 'settings.intensityIntensive', descKey: 'settings.intensityIntensiveDesc', divisor: 7 },
];

// Approximate daily review pages for a preset given memorized page count.
const estimateReviewPages = (memorized, divisor) =>
  memorized > 0 ? Math.max(1, Math.round(memorized / divisor)) : null;

// Returns display-friendly time estimate from a raw day count (unit is a translation key)
function formatEstimate(days) {
  if (!days || days <= 0) return null;
  if (days < 7) return { value: days, unitKey: days === 1 ? 'onboarding.timeDay' : 'onboarding.timeDays' };
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return { value: weeks, unitKey: weeks === 1 ? 'onboarding.timeWeek' : 'onboarding.timeWeeks' };
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return { value: months, unitKey: months === 1 ? 'onboarding.timeMonth' : 'onboarding.timeMonths' };
  }
  const years = parseFloat((days / 365).toFixed(1));
  return { value: years, unitKey: years === 1 ? 'onboarding.timeYear' : 'onboarding.timeYears' };
}

// Expand the range rows into the set of pages they cover.
function rangesToPages(pageRanges) {
  const pages = new Set();
  pageRanges.forEach(({ start, end }) => {
    const s = parseInt(start, 10), e = parseInt(end, 10);
    if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 604 && s <= e)
      for (let p = s; p <= e; p++) pages.add(p);
  });
  return pages;
}

// Is every page in [start, end] present in the selected set?
function isCovered(selected, start, end) {
  for (let p = start; p <= end; p++) if (!selected.has(p)) return false;
  return true;
}

function validateRanges(pageRanges) {
  const errors = pageRanges.map(() => ({}));
  const parsed = pageRanges.map(r => ({ start: parseInt(r.start, 10), end: parseInt(r.end, 10) }));
  parsed.forEach((r, i) => {
    if (r.start !== '' && !isNaN(r.start) && (r.start < 1 || r.start > 604))
      errors[i].start = 'common.validationRange';
    if (r.end !== '' && !isNaN(r.end) && (r.end < 1 || r.end > 604))
      errors[i].end = 'common.validationRange';
    if (!isNaN(r.start) && !isNaN(r.end) && r.start > r.end)
      errors[i].end = 'common.validationEndGreater';
    parsed.forEach((other, j) => {
      if (i === j) return;
      if (!isNaN(r.start) && !isNaN(r.end) && !isNaN(other.start) && !isNaN(other.end) &&
          r.start < other.end && r.end > other.start)
        errors[i].start = 'common.validationNoOverlap';
    });
  });
  return errors;
}

const OnboardingHeader = ({ step }) => {
  const { t } = useTranslation();
  const displayStep = step - 1;
  return (
    <header className="w-full max-w-[800px] mx-auto px-6 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider">
            {t('onboarding.stepOf', { step: displayStep })}
          </div>
          <LanguageToggle variant="icon" />
        </div>
      </div>
      <div className="w-full h-2 bg-[#e2e8f8] dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#fe932c] rounded-full transition-all duration-500"
          style={{ width: `${(displayStep / 3) * 100}%` }}
        />
      </div>
    </header>
  );
};

export default function Onboarding() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  // Single source of truth: the set of page numbers the user has marked memorized.
  // The Juz / Surah / Range tabs are just different views/editors over this set.
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState('juz');
  const [surahSearch, setSurahSearch] = useState('');
  const [pageRanges, setPageRanges] = useState([{ start: '', end: '' }]);
  const [rangeErrors, setRangeErrors] = useState([{}]);
  const [dailyPages, setDailyPages] = useState(1);
  // 'fromStart' | 'fromEnd' | 'custom' — custom anchors new memorization at a
  // Juz/Surah start page; the selection id keeps only the clicked card highlighted
  // when several share a start page (e.g. the short surahs on page 604).
  const [direction, setDirection] = useState('fromStart');
  const [customStartMode, setCustomStartMode] = useState('juz');
  const [customStartPage, setCustomStartPage] = useState(null);
  const [customStartSel, setCustomStartSel] = useState(null);
  const [reviewIntensity, setReviewIntensity] = useState('standard');
  const [fixedReviewValue, setFixedReviewValue] = useState(5);
  const [offDays, setOffDays] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const selectedCount = selectedPages.size;
  const selectedJuzCount = JUZ_RANGES.filter(({ start, end }) => isCovered(selectedPages, start, end)).length;
  const selectedSurahCount = SURAH_PAGES.filter(s => isCovered(selectedPages, s.start, s.end)).length;
  const selectedHizbCount = HIZB_RANGES.filter(({ start, end }) => isCovered(selectedPages, start, end)).length;
  const selectedRubCount = RUB_RANGES.filter(({ start, end }) => isCovered(selectedPages, start, end)).length;

  // Client-side estimate
  const activeDays = 7 - offDays.length;
  const effectiveDaily = dailyPages * (activeDays / 7);
  const remaining = 604 - selectedCount;
  const estimatedDays = effectiveDaily > 0 ? Math.ceil(remaining / effectiveDaily) : null;
  const estimateDisplay = formatEstimate(estimatedDays);

  // Toggle every page in [start, end]: clear them if fully covered, otherwise add them all.
  const toggleRange = (start, end) => setSelectedPages(prev => {
    const next = new Set(prev);
    const covered = isCovered(next, start, end);
    for (let p = start; p <= end; p++) { if (covered) next.delete(p); else next.add(p); }
    return next;
  });

  const toggleJuz = (n) => { const r = JUZ_RANGES.find(j => j.juz === n); if (r) toggleRange(r.start, r.end); };
  const toggleSurah = (n) => { const s = SURAH_PAGES.find(x => x.number === n); if (s) toggleRange(s.start, s.end); };
  // Hizb/¼-Hizb selections round to whole pages, same as Juz/Surah — a boundary
  // that falls mid-page just includes that whole page. Verse-exact partial
  // coverage is edited later from the Library ("mark verses") or Progress page.
  const toggleHizb = (n) => { const r = HIZB_RANGES.find(h => h.hizb === n); if (r) toggleRange(r.start, r.end); };
  const toggleRub = (n) => { const r = RUB_RANGES.find(x => x.rub === n); if (r) toggleRange(r.start, r.end); };

  const filteredSurahs = SURAH_PAGES.filter(s => {
    if (!surahSearch.trim()) return true;
    const q = surahSearch.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.arabic.includes(surahSearch.trim()) ||
      String(s.number).includes(q)
    );
  });

  const allJuzSelected = selectedJuzCount === JUZ_RANGES.length;
  const selectAll = () => setSelectedPages(allJuzSelected ? new Set() : new Set(Array.from({ length: 604 }, (_, i) => i + 1)));

  const toggleOffDay = (d) =>
    setOffDays(prev => {
      if (!prev.includes(d) && prev.length === 6) return prev;
      return prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d];
    });

  // Tabs are views over one canonical set, so switching only re-renders. The Range
  // tab keeps editable text rows, so we regenerate them from the set when entering it.
  const handleTabSwitch = (newMode) => {
    if (newMode === selectionMode) return;
    if (newMode === 'range') {
      const derived = toPageRanges(Array.from(selectedPages).sort((a, b) => a - b));
      setPageRanges(derived.length > 0 ? derived : [{ start: '', end: '' }]);
      setRangeErrors(derived.length > 0 ? derived.map(() => ({})) : [{}]);
    }
    setSelectionMode(newMode);
  };

  const addRange = () => {
    setPageRanges(r => [...r, { start: '', end: '' }]);
    setRangeErrors(e => [...e, {}]);
  };
  const removeRange = (i) => {
    const updated = pageRanges.filter((_, idx) => idx !== i);
    setPageRanges(updated);
    setRangeErrors(e => e.filter((_, idx) => idx !== i));
    setSelectedPages(rangesToPages(updated));
  };
  const updateRange = (i, key, val) => {
    const updated = pageRanges.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setPageRanges(updated);
    setRangeErrors(validateRanges(updated));
    setSelectedPages(rangesToPages(updated));
  };

  const hasRangeErrors = rangeErrors.some(e => e.start || e.end);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await progressAPI.completeOnboarding({ memorizedPages: Array.from(selectedPages).sort((a, b) => a - b), dailyNewPages: dailyPages });
      await authAPI.updateProfile({
        offDays,
        memorizationDirection: direction === 'fromEnd' ? 'fromEnd' : 'fromStart',
        newMemorizationStartPage: direction === 'custom' ? customStartPage : null,
        ...(reviewIntensity === 'fixed'
          ? { cycleReviewCount: fixedReviewValue, recentReviewCount: null }
          : { reviewIntensity, cycleReviewCount: null, recentReviewCount: null }),
      });
      await refreshUser();
      navigate('/dashboard');
    } catch {
      showToast(t('onboarding.submitError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── STEP 1 — Welcome ──────────────────────────────────
  if (step === 1) return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex items-center justify-center p-6">
      {/* Floating, RTL-aware (logical start-*) so it sits at the same top
          corner the rest of the app's controls do in either language. */}
      <div className="fixed top-4 start-4 z-10">
        <LanguageToggle variant="icon" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow max-w-lg w-full p-8 relative overflow-hidden border border-[#dce2f3] dark:border-gray-700">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#064e3b] via-[#004f35] to-[#064e3b]" />
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100">{t('onboarding.welcome')} {t('onboarding.hifzJourney')}</h1>
          <p className="text-[#404944] dark:text-gray-400 leading-relaxed">
            {t('onboarding.welcomeBody')}
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-[#003527] text-white py-3.5 rounded-lg font-medium hover:bg-[#064e3b] transition-colors mt-4 flex items-center justify-center gap-2"
          >
            {t('onboarding.letsBegin')} <span className="inline-block rtl:rotate-180">→</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP 2 — Memorized + Daily Goal ──────────────────
  if (step === 2) return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 flex flex-col">
      <OnboardingHeader step={2} />
      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 pb-12 flex flex-col gap-10">

        <section className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl sacred-shadow border border-[#f0f3ff] dark:border-gray-700">
          <div>
            <h1 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.alreadyMemorized')}</h1>
            <p className="text-[#404944] dark:text-gray-400">{t('onboarding.alreadyMemorizedHint')}</p>
          </div>

          {/* Quick guide to the selection tabs + combine note */}
          <div className="rounded-lg bg-[#f0f3ff] dark:bg-gray-700/40 border border-[#dce2f3] dark:border-gray-600 px-4 py-3 text-xs text-[#404944] dark:text-gray-300 space-y-1.5">
            <p><span className="font-semibold text-[#003527] dark:text-emerald-400">{t('onboarding.byJuz')}</span> — {t('onboarding.tabGuideByJuz')}</p>
            <p><span className="font-semibold text-[#003527] dark:text-emerald-400">{t('onboarding.byHizb')}</span> — {t('onboarding.tabGuideByHizb')}</p>
            <p><span className="font-semibold text-[#003527] dark:text-emerald-400">{t('onboarding.byQuarterHizb')}</span> — {t('onboarding.tabGuideByQuarterHizb')}</p>
            <p><span className="font-semibold text-[#003527] dark:text-emerald-400">{t('onboarding.bySurah')}</span> — {t('onboarding.tabGuideBySurah')}</p>
            <p><span className="font-semibold text-[#003527] dark:text-emerald-400">{t('onboarding.byRange')}</span> — {t('onboarding.tabGuideByRange')}</p>
            <p className="pt-1 text-[#904d00] dark:text-amber-400 font-medium">💡 {t('onboarding.tabGuideCombine')}</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-[#404944] dark:text-gray-400 flex items-center gap-1">
              {t('onboarding.selectMode')}
              <InfoHint text={t('hints.juz')} label={t('progress.juz')} size="xs" />
            </p>
            <div className="flex gap-2 flex-wrap">
              {[
                { mode: 'juz',   labelKey: 'onboarding.byJuz' },
                { mode: 'hizb',  labelKey: 'onboarding.byHizb' },
                { mode: 'rub',   labelKey: 'onboarding.byQuarterHizb' },
                { mode: 'surah', labelKey: 'onboarding.bySurah' },
                { mode: 'range', labelKey: 'onboarding.byRange' },
              ].map(({ mode, labelKey }) => (
                <button
                  key={mode}
                  onClick={() => handleTabSwitch(mode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectionMode === mode
                      ? 'bg-[#003527] text-white border-[#003527]'
                      : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {selectionMode === 'juz' && (
            <div>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                {JUZ_RANGES.map(({ juz, start, end }) => (
                  <button
                    key={juz}
                    onClick={() => toggleJuz(juz)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer transition-colors border ${
                      isCovered(selectedPages, start, end)
                        ? 'bg-[#003527] text-white border-[#003527]'
                        : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                    }`}
                  >
                    {juz}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                {selectedJuzCount > 0 && (
                  <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">{t('onboarding.juzSelected', { count: selectedJuzCount })}</p>
                )}
                <button onClick={selectAll} className="ms-auto text-xs font-medium text-[#003527] dark:text-emerald-400 hover:text-[#064e3b] transition-colors flex items-center gap-1">
                  {allJuzSelected ? t('onboarding.deselectAll') : t('onboarding.selectAll')}
                </button>
              </div>
            </div>
          )}

          {selectionMode === 'hizb' && (
            <div>
              <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                {HIZB_RANGES.map(({ hizb, start, end }) => (
                  <button
                    key={hizb}
                    onClick={() => toggleHizb(hizb)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer transition-colors border ${
                      isCovered(selectedPages, start, end)
                        ? 'bg-[#003527] text-white border-[#003527]'
                        : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                    }`}
                  >
                    {hizb}
                  </button>
                ))}
              </div>
              {selectedHizbCount > 0 && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium mt-2">{t('onboarding.hizbSelected', { count: selectedHizbCount })}</p>
              )}
            </div>
          )}

          {selectionMode === 'rub' && (
            <div>
              <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
                {RUB_RANGES.map(({ rub, hizb, quarter, start, end }) => (
                  <Tooltip key={rub} label={t('onboarding.quarterHizbTooltip', { hizb, quarter })}>
                    <button
                      onClick={() => toggleRub(rub)}
                      className={`aspect-square w-full rounded-md flex items-center justify-center text-[10px] font-medium cursor-pointer transition-colors border ${
                        isCovered(selectedPages, start, end)
                          ? 'bg-[#003527] text-white border-[#003527]'
                          : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                      }`}
                    >
                      {hizb}.{quarter}
                    </button>
                  </Tooltip>
                ))}
              </div>
              {selectedRubCount > 0 && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium mt-2">{t('onboarding.quarterHizbSelected', { count: selectedRubCount })}</p>
              )}
            </div>
          )}

          {selectionMode === 'surah' && (
            <div>
              <input
                type="text"
                placeholder={t('onboarding.surahSearchPlaceholder')}
                value={surahSearch}
                onChange={e => setSurahSearch(e.target.value)}
                className="w-full border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 mb-3"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {filteredSurahs.map(s => {
                  const surahSelected = isCovered(selectedPages, s.start, s.end);
                  return (
                  <button
                    key={s.number}
                    onClick={() => toggleSurah(s.number)}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-colors ${
                      surahSelected
                        ? 'bg-[#003527] text-white border-[#003527]'
                        : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                    }`}
                  >
                    <span className="text-xs font-medium leading-tight">
                      {s.number}. {isArabic ? s.arabic : s.name}
                    </span>
                    <span className={`text-[10px] mt-0.5 leading-tight ${surahSelected ? 'text-white/70' : 'text-[#404944]/60 dark:text-gray-400'}`}>
                      {isArabic ? s.name : s.arabic}
                    </span>
                  </button>
                  );
                })}
              </div>
              {selectedSurahCount > 0 && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium mt-2">{t('onboarding.surahsSelected', { count: selectedSurahCount })}</p>
              )}
            </div>
          )}

          {selectionMode === 'range' && (
            <div>
              <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-3">
                {t('onboarding.addPageRanges')} <span className="text-xs font-normal text-[#404944] dark:text-gray-400">{t('onboarding.optional')}</span>
              </p>
              <div className="space-y-2">
                {pageRanges.map((r, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="number" min="1" max="604" value={r.start}
                          onChange={e => updateRange(i, 'start', e.target.value)}
                          placeholder={t('onboarding.rangeStart')}
                          className={`w-full border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.start ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`}
                        />
                      </div>
                      <span className="text-[#404944] dark:text-gray-400 text-sm flex-shrink-0">{t('onboarding.to')}</span>
                      <div className="flex-1 relative">
                        <input
                          type="number" min="1" max="604" value={r.end}
                          onChange={e => updateRange(i, 'end', e.target.value)}
                          placeholder={t('onboarding.rangeEnd')}
                          className={`w-full border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.end ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`}
                        />
                      </div>
                      {pageRanges.length > 1 && (
                        <Tooltip label={t('tooltips.removeRange')} className="flex-shrink-0">
                          <button onClick={() => removeRange(i)} className="text-[#404944] dark:text-gray-400 hover:text-[#ba1a1a]">
                            <FiX className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                    {(rangeErrors[i]?.start || rangeErrors[i]?.end) && (
                      <p className="text-xs text-[#ba1a1a]">{t(rangeErrors[i]?.end || rangeErrors[i]?.start)}</p>
                    )}
                  </div>
                ))}
                <button onClick={addRange} className="flex items-center gap-1.5 text-xs text-[#003527] dark:text-emerald-400 font-medium hover:underline mt-1">
                  <FiPlus className="w-3 h-3" /> {t('onboarding.addRange')}
                </button>
              </div>
            </div>
          )}

          {selectedCount > 0 && (
            <div className="bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-lg px-4 py-2 border border-green-100 dark:border-emerald-800/30">
              <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">
                {t('onboarding.totalSelectedAll', { pages: selectedCount, juz: selectedJuzCount, surah: selectedSurahCount })}
              </p>
            </div>
          )}
        </section>

        {/* Daily goal */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.dailyGoalTitle')}</h2>
            <p className="text-[#404944] dark:text-gray-400">{t('onboarding.dailyGoalDesc')}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 0.5, label: '0.5', subKey: 'onboarding.pagesPerDay' },
              { value: 1,   label: '1',   subKey: 'onboarding.pagePerDay' },
              { value: 2,   label: '2',   subKey: 'onboarding.pagesPerDay' },
              { value: 5,   label: '5',   subKey: 'onboarding.pagesPerDay', badgeKey: 'onboarding.intense' },
            ].map(({ value, label, subKey, badgeKey }) => (
              <button
                key={value}
                onClick={() => setDailyPages(value)}
                className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-colors relative overflow-hidden ${
                  dailyPages === value
                    ? 'border-[#003527] bg-[#b0f0d6] dark:bg-emerald-900/40 text-[#064e3b] dark:text-emerald-300'
                    : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-800 text-[#404944] dark:text-gray-300 hover:bg-[#e7eefe] dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-4xl font-semibold">{label}</span>
                <span className="text-xs">{t(subKey)}</span>
                {badgeKey && (
                  <div className="absolute top-0 end-0 bg-[#fe932c] text-white text-[10px] px-2 py-1 rounded-es-lg font-bold">
                    {t(badgeKey)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Memorization direction */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.directionTitle')}</h2>
            <p className="text-[#404944] dark:text-gray-400">{t('onboarding.directionDesc')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: 'fromStart', titleKey: 'onboarding.directionFromStart', descKey: 'onboarding.directionFromStartDesc' },
              { value: 'fromEnd',   titleKey: 'onboarding.directionFromEnd',   descKey: 'onboarding.directionFromEndDesc' },
              { value: 'custom',    titleKey: 'onboarding.directionCustom',    descKey: 'onboarding.directionCustomDesc' },
            ].map(({ value, titleKey, descKey }) => (
              <button
                key={value}
                onClick={() => setDirection(value)}
                className={`flex flex-col items-start gap-1.5 p-5 rounded-xl border-2 text-start transition-colors ${
                  direction === value
                    ? 'border-[#003527] bg-[#b0f0d6] dark:bg-emerald-900/40 text-[#064e3b] dark:text-emerald-300'
                    : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-800 text-[#404944] dark:text-gray-300 hover:bg-[#e7eefe] dark:hover:bg-gray-700'
                }`}
              >
                <span className="font-semibold">{t(titleKey)}</span>
                <span className={`text-xs leading-relaxed ${direction === value ? 'text-[#064e3b]/80 dark:text-emerald-300/80' : 'text-[#404944]/80 dark:text-gray-400'}`}>
                  {t(descKey)}
                </span>
              </button>
            ))}
          </div>

          {direction === 'fromEnd' && (
            <p className="text-xs text-[#904d00] dark:text-amber-400 font-medium">💡 {t('onboarding.directionEndHint')}</p>
          )}

          {direction === 'custom' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#f0f3ff] dark:border-gray-700 p-4 flex flex-col gap-3">
              <div className="flex gap-2">
                {[
                  { mode: 'juz',   labelKey: 'onboarding.byJuz' },
                  { mode: 'surah', labelKey: 'onboarding.bySurah' },
                ].map(({ mode, labelKey }) => (
                  <button
                    key={mode}
                    onClick={() => setCustomStartMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      customStartMode === mode
                        ? 'bg-[#003527] text-white border-[#003527]'
                        : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>

              {customStartMode === 'juz' && (
                <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                  {JUZ_RANGES.map(({ juz, start }) => (
                    <button
                      key={juz}
                      onClick={() => { setCustomStartPage(start); setCustomStartSel(`juz-${juz}`); }}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors border ${
                        customStartSel === `juz-${juz}`
                          ? 'bg-[#003527] text-white border-[#003527]'
                          : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                      }`}
                    >
                      {juz}
                    </button>
                  ))}
                </div>
              )}

              {customStartMode === 'surah' && (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#dce2f3] dark:border-gray-700 divide-y divide-[#dce2f3] dark:divide-gray-700">
                  {SURAH_PAGES.map(s => {
                    const isSelected = customStartSel === `surah-${s.number}`;
                    return (
                      <button
                        key={s.number}
                        onClick={() => { setCustomStartPage(s.start); setCustomStartSel(`surah-${s.number}`); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-start transition-colors ${
                          isSelected ? 'bg-[#003527] text-white' : 'hover:bg-[#f0fdf4] dark:hover:bg-emerald-900/20 text-[#151c27] dark:text-gray-200'
                        }`}
                      >
                        <span className="text-sm font-medium">{s.number}. {isArabic ? s.arabic : s.name}</span>
                        <span className={`text-xs shrink-0 ${isSelected ? 'text-white/70' : 'text-[#707974] dark:text-gray-400'}`}>
                          {t('settings.cycleStartPage', { page: s.start })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {customStartPage && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">
                  ✓ {t('onboarding.directionCustomSelected', { page: customStartPage })}
                </p>
              )}
              <p className="text-xs text-[#707974] dark:text-gray-400">{t('onboarding.directionCustomHint')}</p>
            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="mt-auto pt-6 flex justify-between items-center border-t border-[#dce2f3] dark:border-gray-700">
          <button
            onClick={() => setStep(1)}
            className="text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-[#e7eefe] dark:hover:bg-gray-800"
          >
            <span className="inline-block rtl:rotate-180">←</span> {t('onboarding.back')}
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={hasRangeErrors || (direction === 'custom' && !customStartPage)}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {t('onboarding.continue')} <span className="inline-block rtl:rotate-180">→</span>
          </button>
        </div>
      </main>
    </div>
  );

  // ── GENERATING PLAN — Loading screen ─────────────────
  if (generatingPlan) return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 max-w-sm w-full p-10 flex flex-col items-center text-center gap-8">
        <div className="relative w-20 h-20 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border-4 border-[#dce2f3] dark:border-gray-700" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#2D6A4F] animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#003527] dark:text-gray-100 mb-4">
            {t('onboarding.buildingPlan')}
          </h2>
          <div className="flex items-center justify-center gap-2">
            {[0, 0.2, 0.4].map((delay) => (
              <span
                key={delay}
                className="w-2 h-2 rounded-full bg-[#2D6A4F]"
                style={{ animation: `dot-bounce 1.4s ease-in-out infinite`, animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── STEP 3 — Review Intensity + Rest Days ─────────────
  if (step === 3) return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col">
      <OnboardingHeader step={3} />
      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 pb-12 flex flex-col gap-8">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-2">{t('onboarding.customizeTitle')}</h2>
          <p className="text-[#404944] dark:text-gray-400">{t('onboarding.customizeDesc')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 p-6">
          <h3 className="font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.reviewIntensity')}</h3>
          <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">{t('onboarding.reviewIntensityDesc')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INTENSITY_OPTIONS.map(({ value, labelKey, descKey, divisor }) => {
              const estimate = estimateReviewPages(selectedCount, divisor);
              return (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="intensity" value={value} checked={reviewIntensity === value}
                  onChange={() => setReviewIntensity(value)} className="sr-only" />
                <div className={`p-4 rounded-xl border-2 transition-all h-full ${
                  reviewIntensity === value
                    ? 'border-[#fe932c] bg-[#f9f9ff] dark:bg-gray-700/50 shadow-sm'
                    : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-medium ${reviewIntensity === value ? 'text-[#904d00]' : 'text-[#151c27] dark:text-gray-200'}`}>{t(labelKey)}</span>
                    <span className={`text-sm ${reviewIntensity === value ? 'text-[#fe932c]' : 'text-[#bfc9c3] dark:text-gray-500'}`}>
                      {reviewIntensity === value ? '●' : '○'}
                    </span>
                  </div>
                  {estimate != null && (
                    <p className="text-xs font-semibold text-[#904d00] dark:text-amber-400 mb-1">{t('settings.intensityEstimate', { count: estimate })}</p>
                  )}
                  <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t(descKey)}</p>
                </div>
              </label>
              );
            })}
            {/* Fourth option — fixed page count (mirrors Settings) */}
            <label className="cursor-pointer">
              <input type="radio" name="intensity" value="fixed" checked={reviewIntensity === 'fixed'}
                onChange={() => setReviewIntensity('fixed')} className="sr-only" />
              <div className={`p-4 rounded-xl border-2 transition-all h-full ${
                reviewIntensity === 'fixed'
                  ? 'border-[#fe932c] bg-[#f9f9ff] dark:bg-gray-700/50 shadow-sm'
                  : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-medium ${reviewIntensity === 'fixed' ? 'text-[#904d00]' : 'text-[#151c27] dark:text-gray-200'}`}>{t('settings.modeFixed')}</span>
                  <span className={`text-sm ${reviewIntensity === 'fixed' ? 'text-[#fe932c]' : 'text-[#bfc9c3] dark:text-gray-500'}`}>
                    {reviewIntensity === 'fixed' ? '●' : '○'}
                  </span>
                </div>
                <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t('onboarding.fixedReviewDesc')}</p>
              </div>
            </label>
          </div>

          {reviewIntensity === 'fixed' && (
            <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-[#f9f9ff] dark:bg-gray-700/30 rounded-xl border border-[#bfc9c3] dark:border-gray-600">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{t('onboarding.fixedReviewLabel')}</p>
                <p className="text-xs text-[#707974] dark:text-gray-400">{t('onboarding.fixedReviewHint')}</p>
              </div>
              <input type="number" min="1" max="40" value={fixedReviewValue}
                onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= 1 && n <= 40) setFixedReviewValue(n); }}
                className="w-16 shrink-0 border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527]" />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 p-6">
          <h3 className="font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.restDays')}</h3>
          <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">{t('onboarding.restDaysDesc')}</p>
          <div className="flex flex-wrap gap-4">
            {DAY_LABEL_KEYS.map((labelKey, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!offDays.includes(i)}
                  onChange={() => toggleOffDay(i)}
                  className="w-5 h-5 rounded border-[#707974] accent-[#003527] cursor-pointer"
                />
                <span className="font-medium text-[#151c27] dark:text-gray-200">{t(labelKey)}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[#707974] dark:text-gray-400 mt-2">
            {t('onboarding.availableDaysHint', { n: 7 - offDays.length })}
          </p>
        </div>

        <div className="flex justify-between items-center border-t border-[#dce2f3] dark:border-gray-700 pt-6">
          <button onClick={() => setStep(2)} className="text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-[#e7eefe] dark:hover:bg-gray-800">
            <span className="inline-block rtl:rotate-180">←</span> {t('onboarding.back')}
          </button>
          <button
            onClick={() => {
              setGeneratingPlan(true);
              setTimeout(() => { setGeneratingPlan(false); setStep(4); }, 2500);
            }}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm"
          >
            {t('onboarding.generate')} <span className="inline-block rtl:rotate-180">→</span>
          </button>
        </div>
      </main>
    </div>
  );

  // ── STEP 4 — Plan Ready ───────────────────────────────
  const approxJuz = Math.round(selectedCount / 20.13);
  const offDayLabel = offDays.length > 0 ? offDays.map(d => t(`onboarding.dayName${d}`)).join(', ') : '—';

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col">
      <OnboardingHeader step={4} />
      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 pb-12 flex flex-col gap-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⭐</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100">{t('onboarding.planReady')} ✨</h1>
          <p className="text-sm text-[#404944] dark:text-gray-400 mt-2 max-w-md mx-auto">
            {t('onboarding.planReadyBody')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#003527] rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80bea6] mb-1">{t('onboarding.estimatedCompletion')}</p>
            <p className="text-4xl font-bold">{estimateDisplay ? `${estimateDisplay.value}` : '—'}</p>
            <p className="text-sm text-[#80bea6] capitalize">{estimateDisplay ? t(estimateDisplay.unitKey) : t('onboarding.timeMonths')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-[#dce2f3] dark:border-gray-700 p-5 sacred-shadow">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#404944] dark:text-gray-400 mb-1">{t('onboarding.targetGoalLabel')}</p>
            <p className="text-3xl font-bold text-[#151c27] dark:text-gray-100">{t('onboarding.entireQuran')}</p>
            <p className="text-sm text-[#404944] dark:text-gray-400">{t('onboarding.quranPages')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { labelKey: 'onboarding.alreadyMemorizedStat', value: `${approxJuz} ${t('progress.juz')}` },
            { labelKey: 'onboarding.dailyNew',             value: `${dailyPages} ${t(dailyPages !== 1 ? 'onboarding.pagesPerDay' : 'onboarding.pagePerDay')}` },
            { labelKey: 'dashboard.review',                value: reviewIntensity === 'fixed' ? t('dashboard.reviewCount', { count: fixedReviewValue }) : t(INTENSITY_OPTIONS.find(o => o.value === reviewIntensity)?.labelKey ?? 'settings.intensityStandard') },
            { labelKey: 'onboarding.offDaysStat',          value: offDayLabel },
          ].map(({ labelKey, value }) => (
            <div key={labelKey} className="bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 p-4 text-center sacred-shadow">
              <p className="text-xs text-[#404944] dark:text-gray-400 mb-1">{t(labelKey)}</p>
              <p className="text-sm font-bold text-[#064e3b] dark:text-emerald-400">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 p-6 sacred-shadow">
          <h3 className="font-semibold text-[#151c27] dark:text-gray-100 mb-4">{t('onboarding.tipsTitle')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: '🌅', titleKey: 'onboarding.tip1Title', descKey: 'onboarding.tip1Desc' },
              { icon: '📏', titleKey: 'onboarding.tip2Title', descKey: 'onboarding.tip2Desc' },
              { icon: '🎧', titleKey: 'onboarding.tip3Title', descKey: 'onboarding.tip3Desc' },
              { icon: '🌙', titleKey: 'onboarding.tip4Title', descKey: 'onboarding.tip4Desc' },
            ].map(({ icon, titleKey, descKey }) => (
              <div key={titleKey} className="flex gap-3 p-3 bg-[#f9f9ff] dark:bg-gray-700/50 rounded-xl">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#151c27] dark:text-gray-200">{t(titleKey)}</p>
                  <p className="text-xs text-[#404944] dark:text-gray-400 mt-0.5 leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-[#dce2f3] dark:border-gray-700 pt-6">
          <button onClick={() => setStep(3)} className="text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-[#e7eefe] dark:hover:bg-gray-800">
            <span className="inline-block rtl:rotate-180">←</span> {t('onboarding.back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            {submitting ? t('onboarding.savingBtn') : t('onboarding.startJourney')} <span className="inline-block rtl:rotate-180">→</span>
          </button>
        </div>
      </main>
    </div>
  );
}
