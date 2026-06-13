import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { progressAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SURAH_PAGES } from '../data/surahPages';
import { JUZ_RANGES } from '../data/juzRanges';

const HEAT_COLORS = ['bg-gray-200 dark:bg-gray-700', 'bg-green-100 dark:bg-green-900/40', 'bg-green-300 dark:bg-green-700', 'bg-[#40916C]', 'bg-[#1B4332]'];

function buildHeatmap(createdAt, fullHistory = false) {
  const cells = [];
  const today = new Date();
  const from = createdAt ? new Date(createdAt) : new Date();
  if (!createdAt) from.setDate(from.getDate() - 89);

  const daysDiff = Math.ceil((today - from) / 86400000);
  const days = fullHistory ? daysDiff + 1 : Math.min(daysDiff + 1, 183);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cells.push({ date: d.toISOString().split('T')[0], level: 0 });
  }
  return cells;
}

const Skeleton = ({ h = 'h-4', w = 'w-full', rounded = 'rounded' }) => (
  <div className={`${h} ${w} ${rounded} bg-gray-100 animate-pulse`} />
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
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isArabic = i18n.language === 'ar';
  const [juzData, setJuzData] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('progress');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showAllSurahs, setShowAllSurahs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [juzRes, allRes] = await Promise.all([
          progressAPI.getJuzProgress(),
          progressAPI.getAllProgress(),
        ]);
        setJuzData(juzRes.data.data);
        setOverallStats(allRes.data.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalMemorized = overallStats?.totalMemorized ?? 0;
  const percentage = overallStats?.percentage ?? '0.0';

  const memorizedSet = useMemo(() => new Set(overallStats?.memorizedPages ?? []), [overallStats]);

  const surahStats = useMemo(() => SURAH_PAGES.map(surah => {
    const total = surah.end - surah.start + 1;
    let count = 0;
    for (let p = surah.start; p <= surah.end; p++) {
      if (memorizedSet.has(p)) count++;
    }
    const pct = total > 0 ? Math.round(count / total * 100) : 0;
    return { ...surah, pct };
  }), [memorizedSet]);

  const surahComplete   = surahStats.filter(s => s.pct === 100).length;
  const surahInProgress = surahStats.filter(s => s.pct > 0 && s.pct < 100).length;
  const surahNotStarted = surahStats.filter(s => s.pct === 0).length;

  const heatmap = useMemo(() => {
    const cells = buildHeatmap(user?.createdAt, showFullHistory);
    const byDate = overallStats?.memorizedByDate || {};
    cells.forEach(cell => {
      const count = byDate[cell.date] || 0;
      cell.level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
    });
    return cells;
  }, [user?.createdAt, overallStats, showFullHistory]);

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
                    <Skeleton h="h-16" />
                    <Skeleton h="h-4" w="w-32" />
                  </div>
                ) : !hasActivity ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="flex flex-wrap gap-0.5 mb-3 opacity-30">
                      {heatmap.slice(0, 90).map((cell, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-sm bg-gray-100" />
                      ))}
                    </div>
                    <p className="text-sm text-gray-400 italic">{t('progress.activityPlaceholder')}</p>
                  </div>
                ) : (
                  <>
                    <div className={showFullHistory ? 'overflow-x-auto' : ''}>
                      <div className={`flex gap-0.5 mb-3 ${showFullHistory ? 'flex-nowrap' : 'flex-wrap'}`}>
                        {heatmap.map((cell, i) => (
                          <div
                            key={i}
                            title={cell.date}
                            className={`w-2.5 h-2.5 rounded-sm shrink-0 ${HEAT_COLORS[cell.level] ?? HEAT_COLORS[0]}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#4A4A4A] dark:text-gray-400">
                      <span>{t('progress.less')}</span>
                      {HEAT_COLORS.map((c, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                      ))}
                      <span>{t('progress.more')}</span>
                    </div>
                    <button
                      onClick={() => setShowFullHistory(prev => !prev)}
                      className="mt-2 text-xs text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400 transition-colors"
                    >
                      {showFullHistory ? t('progress.collapse') : t('progress.viewFullHistory')}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Juz status grid ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100">{t('progress.juzStatus')}</h2>
                <div className="flex items-center gap-4 text-xs font-medium text-[#4A4A4A] dark:text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" /> {t('progress.memorized')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> {t('progress.inProgress')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600 inline-block" /> {t('progress.pending')}</span>
                </div>
              </div>

              {/* Edit-in-Settings link */}
              <p className="text-xs text-[#707974] dark:text-gray-500 mb-5">
                <Link
                  to="/settings?tab=memorization"
                  className="hover:text-[#1B4332] dark:hover:text-emerald-400 transition-colors underline-offset-2 hover:underline"
                >
                  {t('progress.editInSettings')}
                </Link>
              </p>

              {loading ? (
                <div className="grid grid-cols-10 gap-2">
                  {Array(30).fill(0).map((_, i) => <Skeleton key={i} h="h-14" rounded="rounded-lg" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6">
                    {juzData.map(j => (
                      <div
                        key={j.juzNumber}
                        title={`Juz ${j.juzNumber}: ${j.memorizedPages}/${j.totalPages} pages (${j.percentage}%)`}
                        className={`rounded-lg p-2 text-center cursor-default transition-all hover:scale-105 ${
                          j.isComplete
                            ? 'bg-[#1B4332] text-white'
                            : j.memorizedPages > 0
                            ? 'bg-amber-100 border-2 border-amber-400'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <p className={`text-lg font-bold leading-none ${j.isComplete ? 'text-white' : j.memorizedPages > 0 ? 'text-amber-800' : ''}`}>
                          {j.juzNumber}
                        </p>
                        <p className={`text-xs mt-1 ${j.isComplete ? 'text-green-200' : j.memorizedPages > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {j.percentage}%
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    {[
                      { label: t('progress.completed'), count: completedJuz,  color: 'text-[#1B4332] dark:text-emerald-400' },
                      { label: t('progress.inProgress'), count: inProgressJuz, color: 'text-amber-600 dark:text-amber-400' },
                      { label: t('progress.pending'),    count: pendingJuz,    color: 'text-gray-400 dark:text-gray-500' },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="text-center">
                        <p className={`text-2xl font-extrabold ${color}`}>{count}</p>
                        <p className="text-xs text-[#4A4A4A] dark:text-gray-400">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Surah Progress ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{t('progress.surahProgress')}</h2>
              {loading ? (
                <Skeleton h="h-48" />
              ) : (
                <>
                  <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mb-4">
                    {t('progress.surahSummary', {
                      complete: surahComplete,
                      inProgress: surahInProgress,
                      notStarted: surahNotStarted,
                    })}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                    {surahStats
                      .filter(s => showAllSurahs || s.pct > 0)
                      .map(surah => (
                        <div
                          key={surah.number}
                          title={`${surah.number}. ${surah.name} — ${surah.pct}%`}
                          className={`relative rounded-lg p-2 text-center cursor-default ${
                            surah.pct === 100
                              ? 'bg-[#1B4332] text-white'
                              : surah.pct > 0
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}
                        >
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
                        </div>
                      ))
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
                </>
              )}
            </div>

            {/* ── Memorization Map ── */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-5">{t('progress.memorizeMap')}</h2>
              {loading ? (
                <Skeleton h="h-64" />
              ) : (
                <div className="space-y-1">
                  {JUZ_RANGES.map(({ juz, start, end }) => (
                    <div key={juz} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#4A4A4A] dark:text-gray-500 w-14 shrink-0 text-right rtl:text-left">
                        {t('settings.cycleStartJuz', { juz })}
                      </span>
                      <div className="flex flex-wrap gap-px">
                        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(page => (
                          <div
                            key={page}
                            title={String(page)}
                            className={`w-2.5 h-2.5 rounded-xs ${memorizedSet.has(page) ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-gray-100 dark:bg-gray-700'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
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
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📈</div>
                  <p className="text-sm text-gray-400 italic">{t('progress.chartEmpty')}</p>
                  <p className="text-xs text-gray-300">{t('progress.chartStart')}</p>
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
