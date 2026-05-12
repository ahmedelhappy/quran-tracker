import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI, authAPI } from '../services/api';
import { FiPlus, FiX } from 'react-icons/fi';
import Logo from '../components/Logo';

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
  { value: 'light',    labelKey: 'settings.intensityLight',    descKey: 'settings.intensityLightDesc' },
  { value: 'standard', labelKey: 'settings.intensityStandard', descKey: 'settings.intensityStandardDesc' },
  { value: 'strong',   labelKey: 'settings.intensityIntensive', descKey: 'settings.intensityIntensiveDesc' },
];

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

function computeSelectedPages(selectedJuz, pageRanges) {
  const pages = new Set();
  JUZ_RANGES.forEach(({ juz, start, end }) => {
    if (selectedJuz.has(juz)) {
      for (let p = start; p <= end; p++) pages.add(p);
    }
  });
  pageRanges.forEach(({ start, end }) => {
    const s = parseInt(start, 10), e = parseInt(end, 10);
    if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 604 && s < e)
      for (let p = s; p <= e; p++) pages.add(p);
  });
  return Array.from(pages).sort((a, b) => a - b);
}

function validateRanges(pageRanges) {
  const errors = pageRanges.map(() => ({}));
  const parsed = pageRanges.map(r => ({ start: parseInt(r.start, 10), end: parseInt(r.end, 10) }));
  parsed.forEach((r, i) => {
    if (r.start !== '' && !isNaN(r.start) && (r.start < 1 || r.start > 604))
      errors[i].start = 'common.validationRange';
    if (r.end !== '' && !isNaN(r.end) && (r.end < 1 || r.end > 604))
      errors[i].end = 'common.validationRange';
    if (!isNaN(r.start) && !isNaN(r.end) && r.start >= r.end)
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
        <div className="text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider">
          {t('onboarding.stepOf', { step: displayStep })}
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
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedJuz, setSelectedJuz] = useState(new Set());
  const [pageRanges, setPageRanges] = useState([{ start: '', end: '' }]);
  const [rangeErrors, setRangeErrors] = useState([{}]);
  const [dailyPages, setDailyPages] = useState(1);
  const [reviewIntensity, setReviewIntensity] = useState('standard');
  const [offDays, setOffDays] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const selectedPages = computeSelectedPages(selectedJuz, pageRanges);
  const selectedCount = selectedPages.length;

  // Client-side estimate
  const activeDays = 7 - offDays.length;
  const effectiveDaily = dailyPages * (activeDays / 7);
  const remaining = 604 - selectedCount;
  const estimatedDays = effectiveDaily > 0 ? Math.ceil(remaining / effectiveDaily) : null;
  const estimateDisplay = formatEstimate(estimatedDays);

  const toggleJuz = (n) => setSelectedJuz(prev => {
    const next = new Set(prev);
    next.has(n) ? next.delete(n) : next.add(n);
    return next;
  });

  const selectAll = () => setSelectedJuz(new Set(JUZ_RANGES.map(j => j.juz)));

  const toggleOffDay = (d) =>
    setOffDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : prev.length < 2 ? [...prev, d] : prev);

  const addRange = () => {
    setPageRanges(r => [...r, { start: '', end: '' }]);
    setRangeErrors(e => [...e, {}]);
  };
  const removeRange = (i) => {
    setPageRanges(r => r.filter((_, idx) => idx !== i));
    setRangeErrors(e => e.filter((_, idx) => idx !== i));
  };
  const updateRange = (i, key, val) => {
    const updated = pageRanges.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setPageRanges(updated);
    setRangeErrors(validateRanges(updated));
  };

  const hasRangeErrors = rangeErrors.some(e => e.start || e.end);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await progressAPI.completeOnboarding({ memorizedPages: selectedPages, dailyNewPages: dailyPages });
      await authAPI.updateProfile({ reviewIntensity, offDays });
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
            {t('onboarding.letsBegin')} <span>→</span>
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

          <div>
            <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-3">{t('onboarding.selectByJuz')}</p>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {JUZ_RANGES.map(({ juz }) => (
                <button
                  key={juz}
                  onClick={() => toggleJuz(juz)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer transition-colors border ${
                    selectedJuz.has(juz)
                      ? 'bg-[#003527] text-white border-[#003527]'
                      : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 dark:hover:text-emerald-400'
                  }`}
                >
                  {juz}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              {selectedJuz.size > 0 && (
                <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">{t('onboarding.juzSelected', { count: selectedJuz.size })}</p>
              )}
              <button onClick={selectAll} className="ml-auto text-xs font-medium text-[#003527] dark:text-emerald-400 hover:text-[#064e3b] transition-colors flex items-center gap-1">
                {t('onboarding.selectAll')} ✓✓
              </button>
            </div>
          </div>

          <div className="border-t border-[#f0f3ff] dark:border-gray-700 pt-4">
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
                        placeholder="Start page (1–604)"
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.start ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`}
                      />
                    </div>
                    <span className="text-[#404944] dark:text-gray-400 text-sm flex-shrink-0">{t('onboarding.to')}</span>
                    <div className="flex-1 relative">
                      <input
                        type="number" min="1" max="604" value={r.end}
                        onChange={e => updateRange(i, 'end', e.target.value)}
                        placeholder="End page (1–604)"
                        className={`w-full border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.end ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`}
                      />
                    </div>
                    {pageRanges.length > 1 && (
                      <button onClick={() => removeRange(i)} className="text-[#404944] dark:text-gray-400 hover:text-[#ba1a1a] flex-shrink-0">
                        <FiX className="w-4 h-4" />
                      </button>
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

          {selectedCount > 0 && (
            <div className="bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-lg px-4 py-2 border border-green-100 dark:border-emerald-800/30">
              <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">
                {t('onboarding.totalSelected', { count: selectedCount })}{selectedJuz.size > 0 && ` ${t('onboarding.totalSelectedWithJuz', { count: selectedJuz.size })}`}
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
                  <div className="absolute top-0 right-0 bg-[#fe932c] text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">
                    {t(badgeKey)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Estimate banner */}
        {estimateDisplay && (
          <section className="bg-[#f0f3ff] dark:bg-gray-800 rounded-xl p-6 border border-[#bfc9c3]/50 dark:border-gray-700 flex items-start md:items-center gap-6 flex-col md:flex-row">
            <div className="w-12 h-12 rounded-full bg-[#fe932c]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#904d00] text-xl">🚩</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.estimatedCompletion')}</h3>
              <p className="text-[#404944] dark:text-gray-300">
                {t('onboarding.estimateText', {
                  pages: dailyPages,
                  juz: Math.round(remaining / 20),
                  value: estimateDisplay.value,
                  unit: t(estimateDisplay.unitKey),
                })}
              </p>
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="mt-auto pt-6 flex justify-between items-center border-t border-[#dce2f3] dark:border-gray-700">
          <button
            onClick={() => setStep(1)}
            className="text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-[#e7eefe] dark:hover:bg-gray-800"
          >
            ← {t('onboarding.back')}
          </button>
          <button
            onClick={() => setStep(3)}
            disabled={hasRangeErrors}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {t('onboarding.continue')} →
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {INTENSITY_OPTIONS.map(({ value, labelKey, descKey }) => (
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
                  <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{t(descKey)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 p-6">
          <h3 className="font-semibold text-[#151c27] dark:text-gray-100 mb-1">{t('onboarding.restDays')}</h3>
          <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">{t('onboarding.restDaysDesc')}</p>
          <div className="flex flex-wrap gap-4">
            {DAY_LABEL_KEYS.map((labelKey, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offDays.includes(i)}
                  onChange={() => toggleOffDay(i)}
                  className="w-5 h-5 rounded border-[#707974] accent-[#003527] cursor-pointer"
                />
                <span className="font-medium text-[#151c27] dark:text-gray-200">{t(labelKey)}</span>
              </label>
            ))}
          </div>
          {offDays.length === 2 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t('onboarding.maxRestDays')}</p>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-[#dce2f3] dark:border-gray-700 pt-6">
          <button onClick={() => setStep(2)} className="text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors flex items-center gap-2 px-4 py-3 rounded-lg hover:bg-[#e7eefe] dark:hover:bg-gray-800">
            ← {t('onboarding.back')}
          </button>
          <button
            onClick={() => {
              setGeneratingPlan(true);
              setTimeout(() => { setGeneratingPlan(false); setStep(4); }, 2500);
            }}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm"
          >
            {t('onboarding.generate')} →
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
            { labelKey: 'dashboard.review',                value: t(INTENSITY_OPTIONS.find(o => o.value === reviewIntensity)?.labelKey ?? 'settings.intensityStandard') },
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
            ← {t('onboarding.back')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#003527] text-white px-8 py-4 rounded-xl text-sm font-medium hover:bg-[#064e3b] transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            {submitting ? t('onboarding.savingBtn') : t('onboarding.startJourney')} →
          </button>
        </div>
      </main>
    </div>
  );
}
