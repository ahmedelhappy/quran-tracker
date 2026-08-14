import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { progressAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import InfoHint from '../components/InfoHint';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FiChevronDown, FiChevronUp, FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { SURAH_PAGES } from '../data/surahPages';
import { JUZ_RANGES } from '../data/juzRanges';

const HEAT_COLORS = ['bg-gray-200 dark:bg-gray-700', 'bg-green-100 dark:bg-green-900/40', 'bg-green-300 dark:bg-green-700', 'bg-[#40916C]', 'bg-[#1B4332]'];
// Sun..Sat rows; labels only on Mon/Wed/Fri like GitHub's contribution graph.
const WEEKDAY_LABEL_KEYS = ['', 'settings.dayMon', '', 'settings.dayWed', '', 'settings.dayFri', ''];

const toISODate = (d) => d.toISOString().split('T')[0];
const levelForCount = (c) => (c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4);

// Display-friendly time estimate from a raw day count; unit is a translation key
// (reuses the onboarding.time* strings so both estimate cards read identically).
function formatEstimate(days) {
  if (!days || days <= 0) return null;
  if (days < 7) return { value: days, unitKey: days === 1 ? 'onboarding.timeDay' : 'onboarding.timeDays' };
  if (days < 30) { const w = Math.round(days / 7); return { value: w, unitKey: w === 1 ? 'onboarding.timeWeek' : 'onboarding.timeWeeks' }; }
  if (days < 365) { const m = Math.round(days / 30); return { value: m, unitKey: m === 1 ? 'onboarding.timeMonth' : 'onboarding.timeMonths' }; }
  const y = parseFloat((days / 365).toFixed(1));
  return { value: y, unitKey: y === 1 ? 'onboarding.timeYear' : 'onboarding.timeYears' };
}

const toUTCMidnight = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Build a GitHub-style contribution grid: an array of week-columns, each a 7-cell
// (Sun→Sat) array. Cells are null for days outside the range (padding). All date
// math is in UTC so cell dates line up exactly with the server's date keys.
function buildContributionWeeks(createdAt, byDate = {}, fullHistory = false) {
  const today = toUTCMidnight(new Date());

  let start;
  if (fullHistory && createdAt) {
    start = toUTCMidnight(createdAt);
  } else {
    start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 7 * 25); // ~26 weeks
    if (createdAt) {
      const c = toUTCMidnight(createdAt);
      if (c > start) start = c;
    }
  }
  start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // align to Sunday

  const weeks = [];
  let week = [];
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = toISODate(d);
    const count = byDate[ds] || 0;
    week.push({ date: ds, count, level: levelForCount(count) });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

// GitHub-style contribution graph (weeks as columns, weekday rows, month labels).
function ContributionGraph({ weeks, locale }) {
  const { t } = useTranslation();
  const monthLabels = useMemo(() => {
    // Month of each week's first real day (-1 if the column is all padding).
    const firstMonths = weeks.map(week => {
      const real = week.find(c => c);
      return real ? new Date(real.date + 'T00:00:00Z').getUTCMonth() : -1;
    });
    // Group consecutive week-columns into month segments so we know how many
    // columns each month actually owns. A month that owns only one column skips
    // its label entirely — otherwise the (wider) label text overflows into the
    // next column and collides with the following month's label (e.g. "AprMay").
    const labels = new Array(weeks.length).fill('');
    let segStart = 0;
    for (let i = 1; i <= firstMonths.length; i++) {
      if (i === firstMonths.length || firstMonths[i] !== firstMonths[segStart]) {
        const month = firstMonths[segStart];
        if (month !== -1 && i - segStart >= 2) {
          const real = weeks[segStart].find(c => c);
          labels[segStart] = new Date(real.date + 'T00:00:00Z').toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
        }
        segStart = i;
      }
    }
    return labels;
  }, [weeks, locale]);

  return (
    <div dir="ltr" className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-[3px]">
        {/* Month labels */}
        <div className="flex gap-[3px] ps-7">
          {weeks.map((_, i) => (
            <div key={i} className="w-3 text-[10px] leading-none text-[#4A4A4A] dark:text-gray-500 whitespace-nowrap overflow-visible">
              {monthLabels[i]}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {/* Weekday labels */}
          <div className="flex flex-col gap-[3px] w-6 shrink-0 pe-1">
            {WEEKDAY_LABEL_KEYS.map((k, i) => (
              <div key={i} className="h-3 text-[9px] leading-3 text-[#4A4A4A] dark:text-gray-500 text-end">
                {k ? t(k) : ''}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => cell ? (
                <div
                  key={di}
                  title={`${cell.date} · ${t('progress.pagesCount', { count: cell.count })}`}
                  className={`w-3 h-3 rounded-sm ${HEAT_COLORS[cell.level]}`}
                />
              ) : (
                <div key={di} className="w-3 h-3" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const Skeleton = ({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) => (
  <div className={`${h} ${w} ${rounded} bg-gray-100 dark:bg-gray-700 animate-pulse`} />
);

const ACHIEVEMENTS = [
  // ── Memorization milestones ───────────────────────────────
  { id: 'first_page',  icon: '🌱', nameKey: 'achievements.first_page_name',  descKey: 'achievements.first_page_desc',  check: ({ total }) => total >= 1 },
  { id: '10_pages',    icon: '📖', nameKey: 'achievements.10_pages_name',    descKey: 'achievements.10_pages_desc',    check: ({ total }) => total >= 10 },
  { id: '50_pages',    icon: '🎯', nameKey: 'achievements.50_pages_name',    descKey: 'achievements.50_pages_desc',    check: ({ total }) => total >= 50 },
  { id: '100_pages',   icon: '💯', nameKey: 'achievements.100_pages_name',   descKey: 'achievements.100_pages_desc',   check: ({ total }) => total >= 100 },
  { id: '300_pages',   icon: '🌟', nameKey: 'achievements.300_pages_name',   descKey: 'achievements.300_pages_desc',   check: ({ total }) => total >= 300 },
  { id: 'hafiz',       icon: '👑', nameKey: 'achievements.hafiz_name',       descKey: 'achievements.hafiz_desc',       check: ({ total }) => total >= 604 },
  // ── Juz milestones ────────────────────────────────────────
  { id: 'first_juz',  icon: '📚', nameKey: 'achievements.first_juz_name',  descKey: 'achievements.first_juz_desc',  check: ({ completedJuz }) => completedJuz >= 1 },
  { id: '5_juz',      icon: '📕', nameKey: 'achievements.5_juz_name',      descKey: 'achievements.5_juz_desc',      check: ({ completedJuz }) => completedJuz >= 5 },
  { id: '10_juz',     icon: '📗', nameKey: 'achievements.10_juz_name',     descKey: 'achievements.10_juz_desc',     check: ({ completedJuz }) => completedJuz >= 10 },
  { id: '15_juz',     icon: '📘', nameKey: 'achievements.15_juz_name',     descKey: 'achievements.15_juz_desc',     check: ({ completedJuz }) => completedJuz >= 15 },
  { id: '30_juz',     icon: '🕋', nameKey: 'achievements.30_juz_name',     descKey: 'achievements.30_juz_desc',     check: ({ completedJuz }) => completedJuz >= 30 },
  // ── Streak milestones ─────────────────────────────────────
  { id: 'streak_3',   icon: '🔥', nameKey: 'achievements.streak_3_name',   descKey: 'achievements.streak_3_desc',   check: ({ streak }) => streak >= 3 },
  { id: 'streak_7',   icon: '⚡', nameKey: 'achievements.streak_7_name',   descKey: 'achievements.streak_7_desc',   check: ({ streak }) => streak >= 7 },
  { id: 'streak_30',  icon: '💪', nameKey: 'achievements.streak_30_name',  descKey: 'achievements.streak_30_desc',  check: ({ streak }) => streak >= 30 },
  { id: 'streak_100', icon: '🏆', nameKey: 'achievements.streak_100_name', descKey: 'achievements.streak_100_desc', check: ({ streak }) => streak >= 100 },
];

export default function Progress() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';
  const isArabic = i18n.language === 'ar';
  const [juzData, setJuzData] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState('progress');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showAllSurahs, setShowAllSurahs] = useState(false);
  const [showSurahBreakdown, setShowSurahBreakdown] = useState(false);
  const [showDetailedMap, setShowDetailedMap] = useState(false);
  // In-place progress editing: a draft page-set the map/breakdown edit, saved via
  // updateMemorized. editMode gates every interactive affordance below.
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [juzRes, allRes, estRes] = await Promise.all([
        progressAPI.getJuzProgress(),
        progressAPI.getAllProgress(),
        progressAPI.getEstimate(),
      ]);
      setJuzData(juzRes.data.data);
      setOverallStats(allRes.data.data);
      setEstimate(estRes.data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalMemorized = overallStats?.totalMemorized ?? 0;
  const percentage = overallStats?.percentage ?? '0.0';

  const memorizedSet = useMemo(() => new Set(overallStats?.memorizedPages ?? []), [overallStats]);
  // pageNumber → fraction (0<f<1) for partially-memorized pages, so the map can
  // render them as half-filled amber instead of full green.
  const partialMap = useMemo(
    () => new Map((overallStats?.partialPages ?? []).map(p => [p.pageNumber, p.fraction])),
    [overallStats]
  );

  // While editing, the map + breakdown reflect the DRAFT set; otherwise the saved
  // set. Every fill/coverage computation reads activeSet so both views stay in sync.
  const activeSet = editMode ? draft : memorizedSet;
  const pageChanged = (p) => editMode && draft.has(p) !== memorizedSet.has(p);
  const changedCount = useMemo(() => {
    if (!editMode) return 0;
    let n = 0;
    for (const p of draft) if (!memorizedSet.has(p)) n++;
    for (const p of memorizedSet) if (!draft.has(p)) n++;
    return n;
  }, [editMode, draft, memorizedSet]);

  const enterEditMode = () => { setDraft(new Set(memorizedSet)); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setDraft(new Set(memorizedSet)); };
  const togglePage = (page) => setDraft(prev => {
    const next = new Set(prev);
    if (next.has(page)) next.delete(page); else next.add(page);
    return next;
  });
  // Toggle a whole page span (a Juz or a Surah): if every page is already in the
  // draft, clear them all; otherwise add them all — same semantics as the
  // onboarding/settings tile toggles.
  const toggleRange = (start, end) => setDraft(prev => {
    const next = new Set(prev);
    let allIn = true;
    for (let p = start; p <= end; p++) if (!next.has(p)) { allIn = false; break; }
    for (let p = start; p <= end; p++) { if (allIn) next.delete(p); else next.add(p); }
    return next;
  });
  const rangeChanged = (start, end) => {
    if (!editMode) return false;
    for (let p = start; p <= end; p++) if (pageChanged(p)) return true;
    return false;
  };
  const saveEdit = async () => {
    if (changedCount === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      // updateMemorized is segment-preserving: pages already memorized keep their
      // verse segments, only added/removed whole pages change. See the server note.
      await progressAPI.updateMemorized({ memorizedPages: Array.from(draft) });
      await load();
      showToast(t('progress.changesSaved'), 'success');
      setEditMode(false);
    } catch {
      showToast(t('progress.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Fractional coverage of a page range: full pages count 1, partial pages by
  // their fraction. Reads activeSet so it works in both view and edit mode; a
  // page toggled in edit mode counts as a full page (no fractions while editing).
  const rangeCoverage = (start, end) => {
    let full = 0, frac = 0, partial = 0;
    for (let p = start; p <= end; p++) {
      if (!activeSet.has(p)) continue;
      const f = pageChanged(p) ? null : partialMap.get(p);
      if (f != null && f < 1) { frac += f; partial++; }
      else { full++; frac += 1; }
    }
    return { full, frac, total: end - start + 1, partial };
  };
  const round1 = (n) => Math.round(n * 10) / 10;

  // Projected completion (GET /api/progress/estimate). estimateDisplay is null
  // once nothing is left to memorize (whole Quran done).
  const estimateDisplay = formatEstimate(estimate?.estimatedDays);
  const projectedDate = estimate?.estimatedDays
    ? new Date(Date.now() + estimate.estimatedDays * 86400000)
    : null;
  const dateLocale = isArabic ? 'ar-u-ca-gregory-nu-arab' : 'en-US';

  const surahStats = useMemo(() => SURAH_PAGES.map(surah => {
    const total = surah.end - surah.start + 1;
    let count = 0;
    for (let p = surah.start; p <= surah.end; p++) {
      if (activeSet.has(p)) count++;
    }
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    return { ...surah, pct };
  }), [activeSet]);

  const surahComplete   = surahStats.filter(s => s.pct === 100).length;
  const surahInProgress = surahStats.filter(s => s.pct > 0 && s.pct < 100).length;
  const surahNotStarted = surahStats.filter(s => s.pct === 0).length;

  const weeks = useMemo(
    () => buildContributionWeeks(user?.createdAt, overallStats?.memorizedByDate || {}, showFullHistory),
    [user?.createdAt, overallStats, showFullHistory]
  );

  const chartData = useMemo(() => {
    const byDate = overallStats?.memorizedByDate;
    if (!byDate || Object.keys(byDate).length === 0) {
      return [{ label: t('progress.chartNow'), pages: totalMemorized }];
    }
    const sorted = Object.keys(byDate).sort();
    let cumulative = 0;
    const all = sorted.map(d => {
      cumulative += byDate[d];
      const dt = new Date(d + 'T00:00:00Z');
      return {
        label: dt.toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        pages: cumulative,
      };
    });
    if (all.length <= 20) return all;
    const step = Math.ceil(all.length / 20);
    const sampled = all.filter((_, i) => i % step === 0);
    if (sampled[sampled.length - 1] !== all[all.length - 1]) sampled.push(all[all.length - 1]);
    return sampled;
  }, [overallStats, totalMemorized]);

  const hasActivity = totalMemorized > 0;

  // The default graph already starts ~26 weeks back (capped at account creation),
  // so "view full history" only reveals more for accounts older than that window.
  const canViewFullHistory = useMemo(() => {
    if (!user?.createdAt) return false;
    const created = toUTCMidnight(user.createdAt);
    const cutoff = toUTCMidnight(new Date());
    cutoff.setUTCDate(cutoff.getUTCDate() - 7 * 25);
    return created < cutoff;
  }, [user?.createdAt]);

  const completedJuz  = juzData.filter(j => j.isComplete).length;
  const inProgressJuz = juzData.filter(j => j.memorizedPages > 0 && !j.isComplete).length;
  const pendingJuz    = juzData.filter(j => j.memorizedPages === 0).length;

  const achievementInput = {
    total: overallStats?.totalMemorized ?? 0,
    completedJuz: (juzData ?? []).filter(j => j.isComplete).length,
    streak: user?.currentStreak ?? 0,
  };

  const earned = ACHIEVEMENTS.filter(a => a.check(achievementInput));
  const locked = ACHIEVEMENTS.filter(a => !a.check(achievementInput));

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <Navbar />

      {/* Header bar */}
      <div className="bg-[#1B4332] dark:bg-gray-800 text-white pt-24 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold mb-1">{t('progress.title')}</h1>
          <p className="text-green-300 dark:text-gray-400 text-sm">{t('progress.subtitle')}</p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Load error — friendly message + retry (degrades to empty state below) */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('common.error')}</p>
            <button
              onClick={load}
              className="text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors self-start sm:self-auto"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="border-b border-[#dce2f3] dark:border-gray-700 flex gap-6">
          {[
            { key: 'progress',      labelKey: 'progress.progressTab' },
            { key: 'achievements',  labelKey: 'progress.achievementsTab' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-[#004f35] dark:border-emerald-400 text-[#003527] dark:text-emerald-400'
                  : 'text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-300'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'progress' && (
          <>
            {/* ── Top row: Overall completion + Activity heatmap ── */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Overall completion */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-sm font-bold text-[#4A4A4A] dark:text-gray-400 uppercase tracking-wide mb-4">{t('progress.overallCompletion')}</h2>
                {loading ? (
                  <div className="space-y-3"><Skeleton h="h-10" w="w-24" /><Skeleton h="h-3" /><Skeleton h="h-3" w="w-32" /></div>
                ) : (
                  <>
                    <p className="text-sm text-[#4A4A4A] dark:text-gray-400 mb-1">{t('progress.totalMemorized')}</p>
                    <div className="flex items-end gap-3 mb-3">
                      <span className="text-5xl font-extrabold text-[#1A1A1A] dark:text-gray-100">{percentage}%</span>
                      <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-1 rounded-lg mb-2">
                        {t('progress.pagesCount', { count: totalMemorized })}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percentage}%`, background: 'linear-gradient(90deg, #40916C, #1B4332)' }}
                      />
                    </div>
                    <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mt-2">{t('progress.pagesRemaining', { count: 604 - totalMemorized })}</p>
                  </>
                )}
              </div>

              {/* Activity heatmap */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-sm font-bold text-[#4A4A4A] dark:text-gray-400 uppercase tracking-wide mb-4">{t('progress.activityStreak')}</h2>
                {loading ? (
                  <div className="space-y-2">
                    <Skeleton h="h-24" />
                    <Skeleton h="h-4" w="w-32" />
                  </div>
                ) : (
                  <>
                    <ContributionGraph weeks={weeks} locale={isArabic ? 'ar-SA' : 'en-US'} />
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <div className="flex items-center gap-2 text-xs text-[#4A4A4A] dark:text-gray-400">
                        <span>{t('progress.less')}</span>
                        {HEAT_COLORS.map((c, i) => (
                          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                        ))}
                        <span>{t('progress.more')}</span>
                      </div>
                      {canViewFullHistory && (
                        <button
                          onClick={() => setShowFullHistory(prev => !prev)}
                          className="text-xs text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400 transition-colors"
                        >
                          {showFullHistory ? t('progress.collapse') : t('progress.viewFullHistory')}
                        </button>
                      )}
                    </div>
                    {!hasActivity && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">{t('progress.activityPlaceholder')}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Projected completion ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-sm font-bold text-[#4A4A4A] dark:text-gray-400 uppercase tracking-wide mb-4">{t('progress.projectedCompletion')}</h2>
              {loading ? (
                <div className="flex flex-wrap gap-8"><Skeleton h="h-10" w="w-28" /><Skeleton h="h-10" w="w-44" /></div>
              ) : (estimate && estimate.remainingPages === 0) ? (
                <p className="text-sm text-[#1B4332] dark:text-emerald-400 font-medium">{t('progress.alreadyComplete')}</p>
              ) : !estimateDisplay ? (
                <p className="text-sm text-[#4A4A4A] dark:text-gray-400">{t('progress.estimateUnavailable')}</p>
              ) : (
                <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
                  <div>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-extrabold text-[#1A1A1A] dark:text-gray-100 tabular-nums">{estimateDisplay.value}</span>
                      <span className="text-lg font-semibold text-[#4A4A4A] dark:text-gray-400 mb-1 capitalize">{t(estimateDisplay.unitKey)}</span>
                    </div>
                    <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mt-1">{t('progress.atPace', { count: estimate.dailyPages })}</p>
                  </div>
                  {projectedDate && (
                    <div>
                      <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mb-1">{t('progress.projectedFinish')}</p>
                      <p className="text-lg font-bold text-[#1B4332] dark:text-emerald-400">
                        {projectedDate.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Memorization Map (primary view) ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100">{t('progress.memorizeMap')}</h2>
                {!loading && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowDetailedMap(v => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4332] dark:text-emerald-400 border border-[#1B4332]/30 dark:border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-[#1B4332]/5 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      {showDetailedMap ? t('progress.showCompactMap') : t('progress.showDetailedMap')}
                    </button>
                    {!editMode ? (
                      <button
                        onClick={enterEditMode}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1B4332] hover:bg-[#143728] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" /> {t('progress.editProgress')}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A4A4A] dark:text-gray-300 border border-gray-300 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors disabled:opacity-50"
                        >
                          <FiX className="w-3.5 h-3.5" /> {t('progress.cancel')}
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving || changedCount === 0}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1B4332] hover:bg-[#143728] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiSave className="w-3.5 h-3.5" /> {saving ? t('progress.saving') : t('progress.saveChanges')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {editMode && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t('progress.editHint', { count: changedCount })}
                </div>
              )}
              {loading ? (
                <Skeleton h="h-64" />
              ) : (
                <>
                  {showDetailedMap ? (
                    <>
                      {/* Per-page legend */}
                      <div className="flex items-center gap-4 text-xs font-medium text-[#4A4A4A] dark:text-gray-400 mb-4">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500 inline-block" /> {t('progress.memorized')}</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 inline-block" /> {t('progress.notMemorized')}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {JUZ_RANGES.map(({ juz, start, end }) => {
                          const { full, frac, total } = rangeCoverage(start, end);
                          const pct = Math.round((frac / total) * 100);
                          const complete = full === total;
                          return (
                            <div
                              key={juz}
                              className={`rounded-xl border p-3 transition-colors ${
                                complete
                                  ? 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/60 dark:bg-emerald-900/15'
                                  : 'border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="text-sm font-bold text-[#1A1A1A] dark:text-gray-100">{t('settings.cycleStartJuz', { juz })}</span>
                                <span className={`text-[11px] font-semibold tabular-nums ${complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#4A4A4A] dark:text-gray-400'}`}>
                                  {round1(frac)}/{total} · {pct}%
                                </span>
                              </div>
                              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
                                {Array.from({ length: total }, (_, i) => start + i).map(page => {
                                  const done = activeSet.has(page);
                                  const changed = pageChanged(page);
                                  const f = (!changed && done) ? partialMap.get(page) : null;
                                  const isPartial = f != null && f < 1;
                                  const pp = isPartial ? Math.round(f * 100) : 0;
                                  const ring = changed ? ' ring-2 ring-offset-1 ring-amber-500 dark:ring-amber-400 dark:ring-offset-gray-800' : '';
                                  const base = done && !isPartial
                                    ? 'bg-emerald-600 dark:bg-emerald-500'
                                    : isPartial
                                      ? 'bg-gray-200 dark:bg-gray-700 relative overflow-hidden'
                                      : 'bg-gray-200 dark:bg-gray-700';
                                  const title = isPartial
                                    ? t('progress.mapPagePartial', { page, pct: pp })
                                    : done ? t('progress.mapPageMemorized', { page }) : t('progress.mapPageNot', { page });
                                  const inner = isPartial
                                    ? <div className="absolute inset-x-0 bottom-0 bg-amber-400 dark:bg-amber-500" style={{ height: `${pp}%` }} />
                                    : null;
                                  if (editMode) {
                                    return (
                                      <button
                                        key={page}
                                        type="button"
                                        onClick={() => togglePage(page)}
                                        aria-pressed={done}
                                        title={title}
                                        className={`aspect-square rounded-xs ${base}${ring} cursor-pointer hover:opacity-80 transition-opacity`}
                                      >
                                        {inner}
                                      </button>
                                    );
                                  }
                                  return (
                                    <div key={page} title={title} className={`aspect-square rounded-xs ${base}`}>
                                      {inner}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Three-state legend */}
                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#4A4A4A] dark:text-gray-400 mb-4">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" /> {t('progress.completed')}</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300 dark:bg-amber-700 inline-block" /> {t('progress.inProgress')}</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 inline-block" /> {t('progress.pending')}</span>
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {JUZ_RANGES.map(({ juz, start, end }) => {
                          const { full, frac, total, partial } = rangeCoverage(start, end);
                          const pct = Math.round((frac / total) * 100);
                          const complete = full === total;
                          const started = frac > 0;
                          const changed = rangeChanged(start, end);
                          const title = partial > 0
                            ? `${t('progress.juz')} ${juz} — ${round1(frac)}/${total} (${pct}%) · ${t('progress.partialCount', { count: partial })}`
                            : `${t('progress.juz')} ${juz} — ${full}/${total} (${pct}%)`;
                          const cls = `rounded-lg p-2 text-center transition-colors ${
                            complete
                              ? 'bg-[#1B4332] text-white'
                              : started
                                ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700/50'
                                : 'bg-gray-100 dark:bg-gray-700/50'
                          }${changed ? ' ring-2 ring-amber-500 dark:ring-amber-400' : ''}`;
                          const content = (
                            <>
                              <p className={`text-base font-bold leading-none ${complete ? 'text-white' : started ? 'text-amber-800 dark:text-amber-300' : 'text-gray-400 dark:text-gray-500'}`}>{juz}</p>
                              <p className={`text-[10px] mt-1 tabular-nums ${complete ? 'text-green-200' : started ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>{pct}%</p>
                            </>
                          );
                          if (editMode) {
                            return (
                              <button key={juz} type="button" onClick={() => toggleRange(start, end)} aria-pressed={complete} title={title} className={`${cls} cursor-pointer hover:opacity-90`}>
                                {content}
                              </button>
                            );
                          }
                          return (
                            <div key={juz} title={title} className={cls}>
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Juz summary + prominent edit CTA */}
                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      {[
                        { label: t('progress.completed'),  count: completedJuz,  color: 'text-[#1B4332] dark:text-emerald-400' },
                        { label: t('progress.inProgress'), count: inProgressJuz, color: 'text-amber-600 dark:text-amber-400' },
                        { label: t('progress.pending'),    count: pendingJuz,    color: 'text-gray-400 dark:text-gray-500' },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="text-center">
                          <p className={`text-2xl font-extrabold ${color}`}>{count}</p>
                          <p className="text-xs text-[#4A4A4A] dark:text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    {!editMode && (
                      <button
                        onClick={() => navigate('/settings?tab=memorization&edit=1')}
                        className="inline-flex items-center gap-2 text-[#1B4332] dark:text-emerald-400 text-sm font-semibold px-4 py-2.5 rounded-lg border border-[#1B4332]/30 dark:border-emerald-500/30 hover:bg-[#1B4332]/5 dark:hover:bg-emerald-900/20 transition-colors shrink-0"
                      >
                        <FiEdit2 className="w-4 h-4" /> {t('progress.editInSettings')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Surah breakdown (collapsible) ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowSurahBreakdown(v => !v)}
                aria-expanded={showSurahBreakdown}
                className="w-full flex items-center justify-between gap-2 p-6 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <span className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100">
                  {showSurahBreakdown ? t('progress.hideSurahBreakdown') : t('progress.showSurahBreakdown')}
                </span>
                {showSurahBreakdown
                  ? <FiChevronUp className="w-5 h-5 text-[#707974] dark:text-gray-500 shrink-0" />
                  : <FiChevronDown className="w-5 h-5 text-[#707974] dark:text-gray-500 shrink-0" />}
              </button>

              {showSurahBreakdown && (
                <div className="px-6 pb-6">
                  <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mb-4">
                    {t('progress.surahSummary', {
                      complete: surahComplete,
                      inProgress: surahInProgress,
                      notStarted: surahNotStarted,
                    })}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                    {surahStats
                      .filter(s => showAllSurahs || s.pct > 0 || (editMode && rangeChanged(s.start, s.end)))
                      .map(surah => {
                        const changed = rangeChanged(surah.start, surah.end);
                        const title = `${surah.number}. ${isArabic ? surah.arabic : surah.name} — ${surah.pct}%`;
                        const cls = `relative rounded-lg p-2 text-center ${editMode ? 'cursor-pointer hover:opacity-90' : 'cursor-default'} ${
                          surah.pct === 100
                            ? 'bg-[#1B4332] text-white'
                            : surah.pct > 0
                            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                        }${changed ? ' ring-2 ring-amber-500 dark:ring-amber-400' : ''}`;
                        const inner = (
                          <>
                            {surah.pct > 0 && surah.pct < 100 && (
                              <span className="absolute top-1 ltr:right-1 rtl:left-1 text-[9px] font-bold leading-none text-amber-700 dark:text-amber-400">
                                {surah.pct}%
                              </span>
                            )}
                            <p className={`text-xs font-semibold leading-tight line-clamp-2 mt-1 ${
                              surah.pct === 100 ? 'text-white' : surah.pct > 0 ? 'text-amber-800 dark:text-amber-200' : ''
                            }`}>
                              {isArabic ? surah.arabic : surah.name}
                            </p>
                            {!isArabic && (
                              <p className={`text-[10px] leading-tight line-clamp-1 mt-0.5 ${
                                surah.pct === 100 ? 'text-green-200' : 'text-[#4A4A4A]/60 dark:text-gray-500'
                              }`}>
                                {surah.arabic}
                              </p>
                            )}
                          </>
                        );
                        return editMode ? (
                          <button
                            key={surah.number}
                            type="button"
                            onClick={() => toggleRange(surah.start, surah.end)}
                            aria-pressed={surah.pct === 100}
                            title={title}
                            className={cls}
                          >
                            {inner}
                          </button>
                        ) : (
                          <div key={surah.number} title={title} className={cls}>
                            {inner}
                          </div>
                        );
                      })
                    }
                  </div>
                  {surahNotStarted > 0 && (
                    <button
                      onClick={() => setShowAllSurahs(prev => !prev)}
                      className="mt-3 text-xs text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400 transition-colors underline-offset-2 hover:underline"
                    >
                      {showAllSurahs ? t('progress.showLessSurahs') : t('progress.showAllSurahs')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Memorization chart ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-5">{t('progress.chartTitle')}</h2>
              {loading ? (
                <Skeleton h="h-52" />
              ) : !hasActivity ? (
                <div className="h-52 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">📈</div>
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">{t('progress.chartEmpty')}</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600">{t('progress.chartStart')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F0F0F0'} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: isDark ? '#9CA3AF' : '#4A4A4A' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: isDark ? '#9CA3AF' : '#4A4A4A' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      contentStyle={isDark ? { background: '#1F2937', border: '1px solid #374151', color: '#F9FAFB', borderRadius: 8, fontSize: 12 } : { border: 'none', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontSize: 12 }}
                      itemStyle={isDark ? { color: '#6EE7B7' } : {}}
                      formatter={(v) => [t('progress.pagesCount', { count: v }), t('progress.memorized')]}
                    />
                    <Line type="monotone" dataKey="pages" stroke={isDark ? '#6EE7B7' : '#1B4332'} strokeWidth={2.5} dot={{ fill: isDark ? '#6EE7B7' : '#1B4332', r: 3 }} activeDot={{ r: 5, fill: isDark ? '#A7F3D0' : '#1B4332' }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-8">
            {/* Summary bar */}
            {!loading && (
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                  🏅 {t('progress.achievementsEarned', { count: earned.length, total: ACHIEVEMENTS.length })}
                </span>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  📚 {t('progress.juzComplete', { count: achievementInput.completedJuz })}
                </span>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                  🔥 {t('progress.dayStreak', { count: achievementInput.streak })}
                  <InfoHint text={t('hints.streak')} label={t('dashboard.streak')} size="xs" />
                </span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array(8).fill(0).map((_, i) => <Skeleton key={i} h="h-36" rounded="rounded-2xl" />)}
              </div>
            ) : (
              <>
                {earned.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-3">🌱</div>
                    <p className="text-base font-semibold text-[#1A1A1A] dark:text-gray-100">{t('progress.earnedEmpty')}</p>
                    <p className="text-sm text-[#707974] dark:text-gray-400 mt-1">{t('progress.earnedEmptyHint')}</p>
                  </div>
                )}

                {earned.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-gray-100 mb-4">{t('progress.earnedSection', { count: earned.length })}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {earned.map(a => (
                        <div key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-[#dce2f3] dark:border-gray-700 sacred-shadow flex flex-col items-center text-center gap-2">
                          <span className="text-4xl">{a.icon}</span>
                          <span className="text-sm font-semibold text-[#003527] dark:text-gray-100">{t(a.nameKey)}</span>
                          <span className="text-xs text-[#707974] dark:text-gray-400 leading-snug">{t(a.descKey)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            {t('progress.earnedBadge')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-semibold text-[#707974] dark:text-gray-500 mb-4">{t('progress.lockedSection', { count: locked.length })}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {locked.map(a => (
                      <div key={a.id} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-[#dce2f3] dark:border-gray-700 sacred-shadow flex flex-col items-center text-center gap-2 opacity-50 grayscale">
                        <span className="text-4xl">{a.icon}</span>
                        <span className="text-sm font-semibold text-[#003527] dark:text-gray-100">{t(a.nameKey)}</span>
                        <span className="text-xs text-[#707974] dark:text-gray-400 leading-snug">{t(a.descKey)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          {t('progress.lockedBadge')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
