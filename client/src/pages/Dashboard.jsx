import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';
import { FiBook, FiList, FiCalendar, FiChevronDown, FiChevronUp, FiRefreshCw, FiZap } from 'react-icons/fi';

// ── Daily rotating quotes ────────────────────────────────
const QUOTES = [
  { text: 'The best among you (Muslims) are those who learn the Qur\'an and teach it.', source: 'Sahih Al-Bukhari 5027' },
  { text: 'Whoever recites a letter from the Book of Allah will receive one good deed worth ten times its value.', source: 'Tirmidhi 2910' },
  { text: 'The Quran is a healing for what is in the hearts.', source: 'Quran 10:57' },
  { text: 'Indeed, this Qur\'an guides to that which is most suitable.', source: 'Quran 17:9' },
  { text: 'And We have certainly made the Qur\'an easy for remembrance, so is there any who will remember?', source: 'Quran 54:17' },
  { text: 'Recite the Quran for it will come as an intercessor for its reciters on the Day of Resurrection.', source: 'Muslim 804' },
  { text: 'The one who is skilled in the Quran will be with the honourable, righteous scribes.', source: 'Bukhari & Muslim' },
  { text: 'It will be said to the companion of the Quran: Recite and rise in status.', source: 'Abu Dawud 1464' },
  { text: 'The heart that has no Quran in it is like a ruined house.', source: 'Tirmidhi' },
  { text: 'Hold fast to the Quran, for it is the rope of Allah extended to you from the heaven to the earth.', source: 'Tabarani' },
];

const TIPS = [
  'Connect verses conceptually. Don\'t just memorize sounds — try to understand the flow and logical progression.',
  'Start after Fajr. Your mind is sharpest before the distractions of the day begin.',
  'Recite aloud. Hearing your own voice reinforces neural pathways for retention.',
  'Review before sleeping. The brain consolidates memory during sleep.',
  'Write out verses by hand to engage multiple senses in memorization.',
];

const dayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};

const formatDate = (iso) => {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// ── Circular Juz progress ring ───────────────────────────
const JuzRing = ({ pct = 0 }) => {
  const v = Math.min(100, Math.max(0, parseFloat(pct) || 0));
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="none" r="16" stroke="#dce2f3" strokeDasharray="100 100" strokeLinecap="round" strokeWidth="4" />
        <circle cx="18" cy="18" fill="none" r="16" stroke="#fe932c" strokeDasharray={`${v} 100`} strokeLinecap="round" strokeWidth="4" />
      </svg>
      <span className="absolute text-[11px] font-bold text-[#003527] dark:text-gray-100">{Math.round(v)}%</span>
    </div>
  );
};

const Sk = ({ h = 'h-4', w = 'w-full' }) => <div className={`${h} ${w} rounded bg-[#e7eefe] dark:bg-gray-700 animate-pulse`} />;

// ── Task card ────────────────────────────────────────────
const TaskCard = ({ page, type, done, marking, onComplete, onUndo, badge }) => {
  const { t } = useTranslation();
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 border-l-4 rtl:border-l-0 rtl:border-r-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-opacity ${done ? 'opacity-70' : ''}`}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}1a`, color: accentColor }}
        >
          {isNew ? <FiBook className="w-5 h-5" /> : <span className="text-sm font-bold">↺</span>}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-medium text-[#003527] dark:text-gray-100">{t('dashboard.page')} {page.pageNumber}</p>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-[#404944] dark:text-gray-400">{page.surahName}</p>
        </div>
      </div>
      {done ? (
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#004f35] bg-[#004f35]/10 px-4 py-2 rounded-lg">
            {t('dashboard.done')}
          </span>
          <button
            onClick={() => onUndo(page.pageNumber, type)}
            className="text-xs text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
          >
            {t('dashboard.undo')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => onComplete(page.pageNumber, type)}
          disabled={marking}
          className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-lg transition-colors self-stretch sm:self-auto disabled:opacity-60 ${
            isNew
              ? 'bg-[#004f35] text-white hover:bg-[#003527]'
              : 'bg-[#dce2f3] dark:bg-gray-700 text-[#404944] dark:text-gray-300 hover:bg-[#d3daea] dark:hover:bg-gray-600 hover:text-[#003527] dark:hover:text-gray-100 border border-[#bfc9c3] dark:border-gray-600'
          }`}
        >
          {marking ? t('dashboard.marking') : t('dashboard.markComplete')}
        </button>
      )}
    </div>
  );
};

// ── Extra task card ──────────────────────────────────────
const ExtraTaskCard = ({ page, type, done, marking, onComplete, onUndo }) => {
  const { t } = useTranslation();
  const { pageNumber, surahName } = page;
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-3 border border-[#dce2f3] dark:border-gray-700 border-l-4 rtl:border-l-0 rtl:border-r-4 flex justify-between items-center gap-3 transition-opacity ${done ? 'opacity-70' : ''}`}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}1a`, color: accentColor }}>
          {isNew ? <FiBook className="w-4 h-4" /> : <span className="text-xs font-bold">↺</span>}
        </div>
        <div>
          <p className="text-sm font-medium text-[#003527] dark:text-gray-100">{t('dashboard.page')} {pageNumber}</p>
          {surahName && <p className="text-xs text-[#404944] dark:text-gray-400">{surahName}</p>}
        </div>
      </div>
      {done ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#004f35] bg-[#004f35]/10 px-3 py-1.5 rounded-lg">{t('dashboard.done')}</span>
          <button onClick={() => onUndo(pageNumber, type)} className="text-xs text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-200 underline">{t('dashboard.undo')}</button>
        </div>
      ) : (
        <button
          onClick={() => onComplete(pageNumber, type)}
          disabled={marking}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
            isNew
              ? 'bg-[#004f35] text-white hover:bg-[#003527]'
              : 'bg-[#dce2f3] dark:bg-gray-700 text-[#404944] dark:text-gray-300 hover:bg-[#d3daea] dark:hover:bg-gray-600 border border-[#bfc9c3] dark:border-gray-600'
          }`}
        >
          {marking ? t('dashboard.marking') : t('dashboard.markCompact')}
        </button>
      )}
    </div>
  );
};

// ── Week plan day card (This Week tab) ───────────────────
const WeekDayCard = ({ day, isToday, todayData, allReviewPages }) => {
  const { t } = useTranslation();
  const base = 'bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 sacred-shadow';
  const isOffDay = isToday ? todayData?.isOffDay : day?.isOffDay;
  const dateLabel = formatDate(day.date);

  const fmtPages = (pages) => {
    if (!pages || pages.length === 0) return '';
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const nums = sorted.map(p => p.pageNumber);
    const isSeq = nums.length === 1 || nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    const range = nums.length === 1
      ? `Page ${nums[0]}`
      : isSeq
        ? `Pages ${nums[0]}–${nums[nums.length - 1]}`
        : `Pages ${nums.join(', ')}`;
    const surah = sorted[0]?.surahName;
    return surah ? `${range} · ${surah}` : range;
  };

  if (isOffDay) {
    return (
      <div className={`${base} ${isToday ? 'border-l-4 border-l-[#004f35]' : ''} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {isToday && <span className="w-2 h-2 rounded-full bg-[#004f35] flex-shrink-0" />}
          <span className="text-sm font-medium text-[#404944] dark:text-gray-300">{dateLabel}</span>
          {isToday && (
            <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 dark:bg-emerald-900/40 text-green-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">{t('dashboard.today')}</span>
          )}
        </div>
        <span className="text-sm text-[#707974] dark:text-gray-500">{t('dashboard.restDayLabel')}</span>
      </div>
    );
  }

  if (isToday && todayData) {
    const newPages = todayData.newPages ?? [];
    const reviewCount = allReviewPages?.length ?? 0;
    const pagesStr = fmtPages(newPages);

    return (
      <div className={`${base} px-4 py-3 border-l-4 border-l-[#004f35] bg-emerald-50/30 dark:bg-emerald-900/10 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#004f35] flex-shrink-0" />
          <span className="text-sm font-semibold text-[#003527] dark:text-gray-100">{dateLabel}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 dark:bg-emerald-900/40 text-green-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">{t('dashboard.today')}</span>
        </div>
        <div className="text-xs text-right">
          {pagesStr && <span className="text-[#004f35] dark:text-emerald-400 font-medium">{pagesStr}</span>}
          {reviewCount > 0 && (
            <span className="text-[#904d00] dark:text-amber-400">{pagesStr ? ' · ' : ''}{t('dashboard.reviewLabel')} {reviewCount}</span>
          )}
          {!pagesStr && reviewCount === 0 && <span className="text-[#707974] dark:text-gray-500">{t('dashboard.noTasks')}</span>}
        </div>
      </div>
    );
  }

  // Future day card
  const newPagesInfo = day.newPagesInfo ?? (day.newPageInfo ? [day.newPageInfo] : []);
  const pagesStr = fmtPages(newPagesInfo);
  const reviewCount = day.reviewPagesCount ?? 0;

  return (
    <div className={`${base} px-4 py-3 flex items-center justify-between gap-3`}>
      <span className="text-sm font-medium text-[#003527] dark:text-gray-100 flex-shrink-0">{dateLabel}</span>
      <div className="text-xs text-right">
        {day.newPagesCount > 0 ? (
          <>
            <span className="text-[#004f35] dark:text-emerald-400 font-medium">
              {pagesStr || `${day.newPagesCount} page${day.newPagesCount !== 1 ? 's' : ''}`}
            </span>
            {reviewCount > 0 && <span className="text-[#904d00] dark:text-amber-400"> · {t('dashboard.reviewLabel')} {reviewCount}</span>}
          </>
        ) : (
          <span className="text-[#707974] dark:text-gray-500">{t('dashboard.reviewLabel')} {reviewCount}</span>
        )}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [juzData, setJuzData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedKeys, setCompletedKeys] = useState(new Set());
  const [markingKeys, setMarkingKeys] = useState(new Set());
  const [tipOpen, setTipOpen] = useState(false);
  const [showAllCycle, setShowAllCycle] = useState(false);
  const [showWantMore, setShowWantMore] = useState(false);
  const [extraData, setExtraData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [isOverrideDay, setIsOverrideDay] = useState(false);

  const doy = dayOfYear();
  const quote = QUOTES[doy % QUOTES.length];
  const tip = TIPS[doy % TIPS.length];
  const todayDateString = new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      try {
        const [taskRes, juzRes] = await Promise.all([
          progressAPI.getTodayTasks(),
          progressAPI.getJuzProgress(),
        ]);
        setData(taskRes.data.data);
        setJuzData(juzRes.data.data);
      } catch {
        showToast('Failed to load today\'s tasks', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadWeekPlan = async () => {
    if (weekData || weekLoading) return;
    setWeekLoading(true);
    try {
      const res = await progressAPI.getWeekPlan();
      setWeekData(res.data.data);
    } catch {
      showToast('Failed to load week plan', 'error');
    } finally {
      setWeekLoading(false);
    }
  };

  const markComplete = async (pageNumber, type) => {
    const key = `${type}-${pageNumber}`;
    if (markingKeys.has(key) || completedKeys.has(key)) return;
    setMarkingKeys(prev => new Set(prev).add(key));
    try {
      await progressAPI.markComplete({ pageNumber, type });
      setCompletedKeys(prev => new Set(prev).add(key));
      showToast(`Page ${pageNumber} marked as ${type === 'new' ? 'memorized' : 'reviewed'}!`, 'success');
    } catch {
      showToast('Failed to mark page. Try again.', 'error');
    } finally {
      setMarkingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const undoComplete = async (pageNumber, type) => {
    const key = `${type}-${pageNumber}`;
    try {
      await progressAPI.uncomplete({ pageNumber, type });
      setCompletedKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      showToast('Undone', 'info');
    } catch {
      showToast('Failed to undo. Try again.', 'error');
    }
  };

  const loadExtraPages = () => {
    if (extraData) return;
    setExtraData({
      extraNew: data?.extraNewPages ?? [],
      extraReview: data?.extraReviewPages ?? [],
    });
  };

  const stats = data?.stats;
  const activeJuz = juzData.find(j => j.percentage > 0 && !j.isComplete) || juzData.find(j => j.percentage > 0) || null;
  const juzPct = activeJuz?.percentage ?? 0;
  const completedJuz = juzData.filter(j => j.isComplete).length;
  const totalJuz = juzData.length > 0
    ? (completedJuz + (activeJuz?.percentage ?? 0) / 100).toFixed(1)
    : '0';
  const pagesToHifz = stats ? `${stats.totalMemorized} / 604` : '— / 604';

  const missedDay = (() => {
    if (!user?.lastActiveDate) return false;
    const last = new Date(user.lastActiveDate);
    last.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Math.round((today - last) / 86400000) > 1;
  })();

  // Split review pages into recent and cycle
  const recentPages = data?.recentReviewPages ?? [];
  const cycleReviewPages = data?.reviewPages ?? [];
  const allReviewPages = [
    ...recentPages.map(p => ({ ...p, isRecent: true })),
    ...cycleReviewPages.map(p => ({ ...p, isRecent: false })),
  ];

  const newPending = (data?.newPages ?? []).filter(p => !completedKeys.has(`new-${p.pageNumber}`));
  const revPending = allReviewPages.filter(p => !completedKeys.has(`review-${p.pageNumber}`));
  const recentPending = recentPages.filter(p => !completedKeys.has(`review-${p.pageNumber}`));
  const cyclePending = cycleReviewPages.filter(p => !completedKeys.has(`review-${p.pageNumber}`));

  const allTasksDone = data && !loading && newPending.length === 0 && revPending.length === 0 &&
    (completedKeys.size > 0 || data.stats?.todayComplete);

  const CYCLE_LIMIT = 3;
  const hasMoreCycle = cycleReviewPages.length > CYCLE_LIMIT;

  const showContinuation = !loading && data && stats?.targetNewPages === 0 && data.continuationPage;

  const markAllNew = () => newPending.forEach(p => markComplete(p.pageNumber, 'new'));
  const markAllRecent = () => recentPending.forEach(p => markComplete(p.pageNumber, 'review'));
  const markAllCycle = () => cyclePending.forEach(p => markComplete(p.pageNumber, 'review'));

  return (
    <div className="min-h-screen bg-[#FFFDF5] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-6 pt-32 pb-12 flex flex-col gap-12">

        {/* Missed day banner */}
        {missedDay && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span>💛</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              {t('dashboard.missedDay')}
            </p>
          </div>
        )}

        {/* ── Welcome & Stats Bento ─────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow flex flex-col justify-between border border-[#dce2f3] dark:border-gray-700 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none text-[#064e3b]">
              <svg fill="currentColor" height="200" viewBox="0 0 24 24" width="200">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[32px] font-semibold text-[#003527] dark:text-gray-100 mb-2 leading-tight">
                {t('dashboard.greeting', { name: user?.name?.split(' ')[0] })}
              </h2>
              <p className="text-[#404944] dark:text-gray-400">{t('dashboard.subtitle')}</p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 bg-[#b0f0d6]/20 dark:bg-emerald-900/20 px-4 py-2 rounded-full text-[#064e3b] dark:text-emerald-400 w-max">
              <span className="text-[#fe932c]">🔥</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {stats?.currentStreak ?? user?.currentStreak ?? 0} {t('dashboard.streak')}
              </span>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-16" /><Sk h="h-6" w="w-20" /></>
              ) : (
                <>
                  <FiBook className="w-8 h-8 text-[#004f35] dark:text-emerald-400 mb-2" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400 mb-1">{t('dashboard.dailyReview')}</div>
                  <div className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{stats?.dailyReviewTarget ?? 0} {t('dashboard.pages')}</div>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-16" w="w-16" /><Sk h="h-3" w="w-16" /><Sk h="h-5" w="w-20" /></>
              ) : (
                <>
                  <JuzRing pct={juzPct} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400 mt-2 mb-1">{t('dashboard.juzProgress')}</div>
                  <div className="text-sm font-semibold text-[#003527] dark:text-gray-100">{totalJuz} / 30</div>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center col-span-2">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-24" /><Sk h="h-7" w="w-32" /></>
              ) : (
                <>
                  <FiList className="w-8 h-8 text-[#fe932c] mb-2" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400 mb-1">{t('dashboard.pagesToHifz')}</div>
                  <div className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{pagesToHifz}</div>
                  <div className="text-[10px] text-[#404944]/70 dark:text-gray-500 uppercase tracking-widest font-bold mt-1">{t('dashboard.remaining')}</div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Tasks Section with Tabs ───────────────────────── */}
        <section className="flex flex-col gap-4">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-[#dce2f3] dark:border-gray-700">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === 'today'
                  ? 'border-[#004f35] text-[#003527] dark:text-emerald-400 dark:border-emerald-500'
                  : 'border-transparent text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-300'
              }`}
            >
              <FiCalendar className="w-4 h-4" />{t('dashboard.today')}
            </button>
            <button
              onClick={() => { setActiveTab('week'); loadWeekPlan(); }}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === 'week'
                  ? 'border-[#004f35] text-[#003527] dark:text-emerald-400 dark:border-emerald-500'
                  : 'border-transparent text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-300'
              }`}
            >
              <FiList className="w-4 h-4" />{t('dashboard.thisWeek')}
            </button>
          </div>

          {/* ── TODAY TAB ─────────────────────────────────────── */}
          {activeTab === 'today' && (
            loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 space-y-2">
                    <Sk h="h-5" w="w-24" /><Sk h="h-4" w="w-36" />
                  </div>
                ))}
              </div>
            ) : data?.isOffDay && !isOverrideDay ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center text-[#004f35]">
                  <span style={{ fontSize: 200 }}>🌿</span>
                </div>
                <div className="w-20 h-20 rounded-full bg-[#004f35]/10 flex items-center justify-center text-[#004f35] mb-6">
                  <span className="text-4xl">🌿</span>
                </div>
                <h2 className="text-4xl font-bold text-[#003527] dark:text-gray-100 mb-4 tracking-tight">{t('dashboard.restDay')}</h2>
                <p className="text-lg text-[#404944] dark:text-gray-400 max-w-2xl mb-8 leading-relaxed">
                  {t('dashboard.restSubtitle')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 z-10">
                  <button
                    onClick={() => navigate('/progress')}
                    className="bg-[#003527] hover:bg-[#064e3b] text-white text-xs font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide flex items-center gap-2"
                  >
                    {t('dashboard.reflection')}
                  </button>
                  <button
                    onClick={() => setIsOverrideDay(true)}
                    className="bg-transparent border border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-[#d3daea] dark:hover:bg-gray-700 hover:text-[#003527] dark:hover:text-gray-100 text-xs font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide"
                  >
                    {t('dashboard.memorizeAnyway')}
                  </button>
                </div>
              </div>
            ) : allTasksDone ? (
              <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-10 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col items-center text-center">
                  <p className="text-4xl mb-3">🎉</p>
                  <h3 className="text-2xl font-semibold text-[#003527] dark:text-gray-100 mb-2">{t('dashboard.allDone')}</h3>
                  <p className="text-[#404944] dark:text-gray-400">{t('dashboard.comeBack')}</p>
                </div>

                {/* Want more? */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => { setShowWantMore(!showWantMore); if (!showWantMore) loadExtraPages(); }}
                    className="w-full p-4 flex justify-between items-center hover:bg-[#f9f9ff] dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">✨</span>
                      <span className="text-base font-semibold text-[#003527] dark:text-gray-100">{t('dashboard.wantMore')}</span>
                    </div>
                    {showWantMore ? <FiChevronUp className="w-4 h-4 text-[#707974] dark:text-gray-500" /> : <FiChevronDown className="w-4 h-4 text-[#707974] dark:text-gray-500" />}
                  </button>

                  {showWantMore && (
                    <div className="border-t border-[#dce2f3] dark:border-gray-700 p-4 space-y-6">
                      {extraData?.extraNew?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-[#004f35]" />
                            <h4 className="text-sm font-semibold text-[#151c27] dark:text-gray-200">{t('dashboard.memorizeMore')}</h4>
                            <span className="text-xs text-[#707974] dark:text-gray-500">{t('dashboard.upcomingPages')}</span>
                          </div>
                          <div className="space-y-2">
                            {extraData.extraNew.map(page => (
                              <ExtraTaskCard key={`extra-new-${page.pageNumber}`} page={page} type="new"
                                done={completedKeys.has(`new-${page.pageNumber}`)} marking={markingKeys.has(`new-${page.pageNumber}`)}
                                onComplete={markComplete} onUndo={undoComplete} />
                            ))}
                          </div>
                        </div>
                      )}
                      {extraData?.extraReview?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-[#fe932c]" />
                            <h4 className="text-sm font-semibold text-[#151c27] dark:text-gray-200">{t('dashboard.reviewMore')}</h4>
                            <span className="text-xs text-[#707974] dark:text-gray-500">{t('dashboard.additionalPages')}</span>
                          </div>
                          <div className="space-y-2">
                            {extraData.extraReview.map(page => (
                              <ExtraTaskCard key={`extra-review-${page.pageNumber}`} page={page} type="review"
                                done={completedKeys.has(`review-${page.pageNumber}`)} marking={markingKeys.has(`review-${page.pageNumber}`)}
                                onComplete={markComplete} onUndo={undoComplete} />
                            ))}
                          </div>
                        </div>
                      )}
                      {extraData?.extraNew?.length === 0 && extraData?.extraReview?.length === 0 && (
                        <p className="text-sm text-[#707974] dark:text-gray-500 text-center py-4">{t('dashboard.noAdditional')}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* New Memorization column */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#004f35]" />
                      <h4 className="text-lg font-semibold text-[#151c27] dark:text-gray-100">{t('dashboard.newMem')}</h4>
                    </div>
                    {newPending.length > 0 && (
                      <button onClick={markAllNew} className="text-[#004f35] border border-[#004f35]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#004f35]/5 transition-colors">
                        {t('dashboard.markAll')}
                      </button>
                    )}
                  </div>

                  {/* Continuation page card */}
                  {showContinuation && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/40 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                        <FiBook className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{t('dashboard.continuePage')}</p>
                        <p className="text-lg font-medium text-blue-900 dark:text-blue-200">{t('dashboard.page')} {data.continuationPage.pageNumber}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{data.continuationPage.surahName}</p>
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{t('dashboard.continueHint')}</p>
                      </div>
                    </div>
                  )}

                  {(data?.newPages ?? []).length === 0 && !showContinuation ? (
                    <p className="text-sm text-[#404944] dark:text-gray-400 py-4">{t('dashboard.noNewToday')}</p>
                  ) : (
                    (data?.newPages ?? []).map(p => (
                      <TaskCard key={`new-${p.pageNumber}`} page={p} type="new"
                        done={completedKeys.has(`new-${p.pageNumber}`)} marking={markingKeys.has(`new-${p.pageNumber}`)}
                        onComplete={markComplete} onUndo={undoComplete} />
                    ))
                  )}
                </div>

                {/* Review column — split into Recent + Cycle */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#fe932c]" />
                    <h4 className="text-lg font-semibold text-[#151c27] dark:text-gray-100">
                      {t('dashboard.review')}
                      {allReviewPages.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-[#707974] dark:text-gray-500">
                          {t('dashboard.reviewCount', { count: allReviewPages.length })}
                        </span>
                      )}
                    </h4>
                  </div>

                  {allReviewPages.length === 0 ? (
                    <p className="text-sm text-[#404944] dark:text-gray-400 py-4">{t('dashboard.noReviewToday')}</p>
                  ) : (
                    <>
                      {/* Recent Review sub-section */}
                      {recentPages.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FiRefreshCw className="w-3 h-3 text-[#404944] dark:text-gray-400" />
                              <span className="text-sm font-semibold text-[#404944] dark:text-gray-300">{t('dashboard.recentReview')}</span>
                              <span className="text-xs text-[#707974] dark:text-gray-500">{t('dashboard.last3days')} · {recentPages.length} {t('dashboard.pages')}</span>
                            </div>
                            {recentPending.length > 0 && (
                              <button onClick={markAllRecent} className="text-[#904d00] border border-[#904d00]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#904d00]/5 transition-colors">
                                {t('dashboard.markAll')}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {recentPages.map(p => (
                              <TaskCard
                                key={`review-recent-${p.pageNumber}`}
                                page={p} type="review"
                                done={completedKeys.has(`review-${p.pageNumber}`)}
                                marking={markingKeys.has(`review-${p.pageNumber}`)}
                                onComplete={markComplete}
                                onUndo={undoComplete}
                                badge={t('dashboard.recentBadge')}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cycle Review sub-section */}
                      {cycleReviewPages.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#fe932c] flex-shrink-0" />
                              <span className="text-sm font-semibold text-[#404944] dark:text-gray-300">{t('dashboard.cycleReview')}</span>
                              <span className="text-xs text-[#707974] dark:text-gray-500">· {cycleReviewPages.length} {t('dashboard.pages')}</span>
                            </div>
                            {cyclePending.length > 0 && (
                              <button onClick={markAllCycle} className="text-[#904d00] border border-[#904d00]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#904d00]/5 transition-colors">
                                {t('dashboard.markAll')}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {cycleReviewPages.slice(0, showAllCycle ? cycleReviewPages.length : CYCLE_LIMIT).map(p => (
                              <TaskCard
                                key={`review-cycle-${p.pageNumber}`}
                                page={p} type="review"
                                done={completedKeys.has(`review-${p.pageNumber}`)}
                                marking={markingKeys.has(`review-${p.pageNumber}`)}
                                onComplete={markComplete}
                                onUndo={undoComplete}
                              />
                            ))}
                          </div>
                          {hasMoreCycle && (
                            <button
                              onClick={() => setShowAllCycle(!showAllCycle)}
                              className="flex items-center justify-center gap-2 text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 py-2 border border-[#dce2f3] dark:border-gray-700 rounded-xl hover:bg-[#f9f9ff] dark:hover:bg-gray-800/50 transition-colors"
                            >
                              {showAllCycle ? (
                                <><FiChevronUp className="w-4 h-4" /> {t('dashboard.showLess')}</>
                              ) : (
                                <><FiChevronDown className="w-4 h-4" /> {t('dashboard.showAll', { count: cycleReviewPages.length })}</>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {/* ── THIS WEEK TAB ──────────────────────────────────── */}
          {activeTab === 'week' && (
            <div className="flex flex-col gap-3">
              {/* Today card — always from loaded data */}
              {loading ? (
                <Sk h="h-24" />
              ) : (
                <WeekDayCard
                  day={{ date: todayDateString }}
                  isToday={true}
                  todayData={data}
                  allReviewPages={allReviewPages}
                />
              )}

              {/* Next 6 days */}
              {weekLoading ? (
                Array(6).fill(0).map((_, i) => <Sk key={i} h="h-14" />)
              ) : weekData ? (
                weekData.map((day, i) => (
                  <WeekDayCard key={i} day={day} isToday={false} todayData={null} allReviewPages={null} />
                ))
              ) : (
                <p className="text-sm text-[#707974] dark:text-gray-500 py-3 text-center">Unable to load week plan.</p>
              )}
            </div>
          )}
        </section>

        {/* ── Tip of the Day ───────────────────────────────── */}
        <section>
          <div className="bg-white dark:bg-gray-800 rounded-xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setTipOpen(!tipOpen)}
              className="w-full p-4 flex justify-between items-center bg-[#b0f0d6]/5 dark:bg-emerald-900/10 hover:bg-[#b0f0d6]/10 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FiZap className="w-5 h-5 text-[#fe932c]" />
                <span className="text-lg font-semibold text-[#003527] dark:text-gray-100">{t('dashboard.tipTitle')}</span>
              </div>
              <span className={`text-[#707974] dark:text-gray-500 transition-transform duration-300 ${tipOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {tipOpen && (
              <div className="p-4 border-t border-[#dce2f3] dark:border-gray-700 text-[#404944] dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800">
                "{tip}"
              </div>
            )}
          </div>
        </section>

        {/* Daily quote */}
        <div className="text-center pb-4">
          <p className="text-[#404944] dark:text-gray-400 italic text-sm max-w-2xl mx-auto">
            "{quote.text}"
          </p>
          <p className="text-[#707974] dark:text-gray-500 text-xs mt-1">— {quote.source}</p>
        </div>
      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}
