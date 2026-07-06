import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI, authAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Tooltip from '../components/Tooltip';
import InfoHint from '../components/InfoHint';
import HowToMemorizeModal from '../components/HowToMemorizeModal';
import { startDashboardTour } from '../components/dashboardTour';
import { FiBook, FiList, FiCalendar, FiChevronDown, FiChevronUp, FiZap, FiPause, FiVolume2, FiHelpCircle, FiTarget } from 'react-icons/fi';
import { formatSurahNames, formatSurahRangesLabel } from '../utils/surahDisplay';

// Ghost icon button: open the Library at this page to listen while reviewing.
// `tourAnchor` tags this button as the guided-tour "Listen" target.
const ListenButton = ({ pageNumber, compact = false, tourAnchor = false }) => {
  const { t } = useTranslation();
  return (
    <Tooltip label={t('tooltips.listen')}>
      <Link
        to={`/library?page=${pageNumber}`}
        {...(tourAnchor ? { 'data-tour': 'listen' } : {})}
        className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center text-[#707974] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-400 hover:bg-[#004f35]/5 dark:hover:bg-emerald-900/20 transition-colors shrink-0`}
      >
        <FiVolume2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </Link>
    </Tooltip>
  );
};


const dayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};

const formatDate = (iso, lang = 'en') => {
  const d = new Date(iso + 'T00:00:00Z');
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  return d.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
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
const TaskCard = ({ page, type, done, marking, onComplete, onAlreadyKnow, onUndo, badge, onHowTo, tourAnchor = false }) => {
  const { t, i18n } = useTranslation();
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  const isAr = i18n.language === 'ar';
  const surahLabel = isNew ? formatSurahRangesLabel(page, isAr, t) : formatSurahNames(page, isAr);
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 border-s-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-opacity ${done ? 'opacity-70' : ''}`}
      style={{ borderInlineStartColor: accentColor }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}1a`, color: accentColor }}
        >
          {isNew ? <FiBook className="w-5 h-5" /> : (
            <Tooltip label={t('tooltips.reviewIcon')}>
              <span className="text-sm font-bold cursor-help">↺</span>
            </Tooltip>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-medium text-[#003527] dark:text-gray-100">{t('dashboard.page')} {page.pageNumber}</p>
            {!isNew && !badge && (
              <span className="sm:hidden inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#fe932c]/15 text-[#904d00] dark:text-amber-400">
                ↺ {t('dashboard.review')}
              </span>
            )}
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                {badge}
              </span>
            )}
            <ListenButton pageNumber={page.pageNumber} tourAnchor={tourAnchor} />
          </div>
          <p className="text-sm text-[#404944] dark:text-gray-400">{surahLabel}</p>
          {isNew && (
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
              {/* Open this page in the Library to memorize it */}
              <Link
                to={`/library?page=${page.pageNumber}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#004f35] dark:text-emerald-400 hover:underline underline-offset-2 transition-colors"
              >
                <FiTarget className="w-3.5 h-3.5" /> {t('dashboard.memorizeInLibrary')}
              </Link>
              {onHowTo && (
                <button
                  onClick={onHowTo}
                  className="inline-flex items-center gap-1 text-xs text-[#707974] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-400 transition-colors"
                >
                  <FiHelpCircle className="w-3.5 h-3.5" /> {t('howTo.openCard')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {done ? (
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#004f35] dark:text-emerald-400 bg-[#004f35]/10 dark:bg-emerald-900/30 px-4 py-2 rounded-lg">
            {t('dashboard.done')}
          </span>
          <Tooltip label={t('tooltips.undo')}>
            <button
              onClick={() => onUndo(page.pageNumber, type)}
              className="text-xs text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
            >
              {t('dashboard.undo')}
            </button>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {isNew && onAlreadyKnow && (
            <button
              onClick={() => onAlreadyKnow(page.pageNumber)}
              disabled={marking}
              className="text-xs text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {t('dashboard.alreadyKnow')}
            </button>
          )}
          <button
            onClick={() => onComplete(page.pageNumber, type)}
            disabled={marking}
            className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-lg transition-colors disabled:opacity-60 ${
              isNew
                ? 'bg-[#004f35] text-white hover:bg-[#003527]'
                : 'bg-[#dce2f3] dark:bg-gray-700 text-[#404944] dark:text-gray-300 hover:bg-[#d3daea] dark:hover:bg-gray-600 hover:text-[#003527] dark:hover:text-gray-100 border border-[#bfc9c3] dark:border-gray-600'
            }`}
          >
            {marking ? t('dashboard.marking') : t('dashboard.markComplete')}
          </button>
        </div>
      )}
    </div>
  );
};

// ── Extra task card ──────────────────────────────────────
const ExtraTaskCard = ({ page, type, done, marking, onComplete, onUndo }) => {
  const { t, i18n } = useTranslation();
  const { pageNumber } = page;
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-3 border border-[#dce2f3] dark:border-gray-700 border-s-4 flex justify-between items-center gap-3 transition-opacity ${done ? 'opacity-70' : ''}`}
      style={{ borderInlineStartColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}1a`, color: accentColor }}>
          {isNew ? <FiBook className="w-4 h-4" /> : (
            <Tooltip label={t('tooltips.reviewIcon')}>
              <span className="text-xs font-bold cursor-help">↺</span>
            </Tooltip>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-[#003527] dark:text-gray-100">{t('dashboard.page')} {pageNumber}</p>
            {!isNew && (
              <span className="sm:hidden inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#fe932c]/15 text-[#904d00] dark:text-amber-400">
                ↺ {t('dashboard.review')}
              </span>
            )}
            <ListenButton pageNumber={pageNumber} compact />
          </div>
          {formatSurahNames(page, i18n.language === 'ar') && <p className="text-xs text-[#404944] dark:text-gray-400">{formatSurahNames(page, i18n.language === 'ar')}</p>}
        </div>
      </div>
      {done ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#004f35] dark:text-emerald-400 bg-[#004f35]/10 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg">{t('dashboard.done')}</span>
          <Tooltip label={t('tooltips.undo')}>
            <button onClick={() => onUndo(pageNumber, type)} className="text-xs text-[#707974] dark:text-gray-500 hover:text-[#003527] dark:hover:text-gray-200 underline">{t('dashboard.undo')}</button>
          </Tooltip>
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
const WeekDayCard = ({ day, isToday, todayData }) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const isOffDay = isToday ? todayData?.isOffDay : day?.isOffDay;
  const dateLabel = formatDate(day.date, i18n.language);

  const getNewStr = () => {
    const infos = isToday
      ? (todayData?.newPages ?? [])
      : (day?.newPagesInfo ?? (day?.newPageInfo ? [day.newPageInfo] : []));
    if (infos.length === 0) {
      const count = isToday ? 0 : (day?.newPagesCount ?? 0);
      return count > 0 ? t('dashboard.reviewCount', { count }) : '—';
    }
    // Show every page assigned that day, not just the first.
    const nums = infos.map(p => p.pageNumber);
    const pageStr = nums.length === 1
      ? t('dashboard.fmtPage', { num: nums[0] })
      : t('dashboard.fmtPagesMulti', { nums: nums.join(isAr ? '، ' : ', ') });
    const firstSurah = formatSurahNames(infos[0], isAr);
    const sameSurah = infos.every(p => formatSurahNames(p, isAr) === firstSurah);
    return sameSurah && firstSurah ? `${pageStr} · ${firstSurah}` : pageStr;
  };

  // Today shows the stable daily total (it does not shrink as pages are ticked
  // off); future days use the projected cycle-plus-recent count from the server.
  const reviewCount = isToday
    ? (todayData?.stats?.dailyReviewTotal
        ?? ((todayData?.reviewPages?.length ?? 0) + (todayData?.recentReviewPages?.length ?? 0)))
    : (day?.reviewPagesCount ?? 0);
  const newStr = getNewStr();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-700 sacred-shadow overflow-hidden${isToday ? ' border-s-4 border-s-[#004f35]' : ''}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-2 border-b border-[#dce2f3] dark:border-gray-700 ${isToday ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'bg-[#f9fafb] dark:bg-gray-800/50'}`}>
        {isToday && <span className="w-2 h-2 rounded-full bg-[#004f35] flex-shrink-0" />}
        <span className={`text-sm ${isToday ? 'font-semibold text-[#003527] dark:text-gray-100' : 'font-medium text-[#003527] dark:text-gray-100'}`}>{dateLabel}</span>
        {isToday && (
          <span className="ms-auto text-[10px] font-bold uppercase tracking-wide bg-green-100 dark:bg-emerald-900/40 text-green-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">{t('dashboard.today')}</span>
        )}
      </div>
      {/* Body */}
      {isOffDay ? (
        <div className="px-4 py-4 bg-gray-50/50 dark:bg-gray-800/30 text-center">
          <span className="text-sm text-[#707974] dark:text-gray-500">{t('dashboard.week.restDay')} 🌿</span>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 flex-shrink-0" />
            <span className="text-[#404944] dark:text-gray-400 w-14 flex-shrink-0">{t('dashboard.week.newRow')}</span>
            <span className="text-[#003527] dark:text-gray-200 font-medium truncate">{newStr}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 flex-shrink-0" />
            <span className="text-[#404944] dark:text-gray-400 w-14 flex-shrink-0">{t('dashboard.review')}</span>
            <span className="text-[#904d00] dark:text-amber-300 font-medium">
              {reviewCount > 0 ? t('dashboard.reviewCount', { count: reviewCount }) : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [juzData, setJuzData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [howToOpen, setHowToOpen] = useState(false);
  const tourRef = useRef(null);
  const tourTimeoutRef = useRef(null);
  const tourCheckedRef = useRef(false);
  const [completedKeys, setCompletedKeys] = useState(new Set());
  const [markingKeys, setMarkingKeys] = useState(new Set());
  const [tipOpen, setTipOpen] = useState(false);
  const [cycleBannerDismissed, setCycleBannerDismissed] = useState(false);
  const [showAllReview, setShowAllReview] = useState(false);
  const [showWantMore, setShowWantMore] = useState(false);
  const [extraData, setExtraData] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [isOverrideDay, setIsOverrideDay] = useState(false);

  const quotes = t('dashboard.quotes', { returnObjects: true });
  const tips = t('dashboard.tips', { returnObjects: true });
  const doy = dayOfYear();
  const quote = quotes[doy % quotes.length];
  const tip = tips[doy % tips.length];
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
        showToast(t('dashboard.failedTasks'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // First-run onboarding helpers: run the guided tour once, then show the
  // "how to memorize" guide once. Both are gated by localStorage flags so the
  // resting UI never re-triggers them; `?tour=1` (from Settings → Replay) forces
  // the tour regardless. The work is deferred behind a short timer so the
  // dashboard has painted before spotlighting. A one-shot guard latches only once
  // the timer fires, and the cleanup here just cancels a *pending* timer — it must
  // NOT destroy a running tour, because `data` changing again (e.g. React
  // StrictMode's dev double-fetch) re-runs this effect and would otherwise tear
  // the live tour down. Destroying on real unmount is handled separately below.
  useEffect(() => {
    if (loading || !data || tourCheckedRef.current) return;

    const showGuideOnce = () => {
      if (!localStorage.getItem('seenMemorizeGuide')) {
        localStorage.setItem('seenMemorizeGuide', '1');
        setHowToOpen(true);
      }
    };

    const launchTour = (chainGuide) => {
      const tour = startDashboardTour({
        t,
        onDone: () => {
          localStorage.setItem('seenDashboardTour', '1');
          tourRef.current = null;
          if (chainGuide) showGuideOnce();
        },
      });
      tourRef.current = tour;
      if (!tour && chainGuide) showGuideOnce(); // no targets present
    };

    tourTimeoutRef.current = setTimeout(() => {
      tourCheckedRef.current = true;
      const forceTour = searchParams.get('tour') === '1';
      if (forceTour) {
        const next = new URLSearchParams(searchParams);
        next.delete('tour');
        setSearchParams(next, { replace: true });
        launchTour(false);
      } else if (!localStorage.getItem('seenDashboardTour')) {
        launchTour(true);
      } else {
        showGuideOnce();
      }
    }, 350);

    // Only cancel a still-pending launch; never destroy an already-running tour here.
    return () => clearTimeout(tourTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  // Tear down the tour only when the dashboard actually unmounts (e.g. the user
  // navigates away mid-walkthrough), so it isn't left orphaned over the next page.
  useEffect(() => () => {
    tourRef.current?.destroy?.();
    tourRef.current = null;
  }, []);

  const loadWeekPlan = async () => {
    if (weekData || weekLoading) return;
    setWeekLoading(true);
    try {
      const res = await progressAPI.getWeekPlan();
      setWeekData(res.data.data);
    } catch {
      showToast(t('dashboard.failedWeekPlan'), 'error');
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
      showToast(t(type === 'new' ? 'dashboard.pageMarkedMemorized' : 'dashboard.pageMarkedReviewed', { number: pageNumber }), 'success');
    } catch {
      showToast(t('dashboard.failedMark'), 'error');
    } finally {
      setMarkingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const undoComplete = async (pageNumber, type) => {
    const key = `${type}-${pageNumber}`;
    try {
      const res = await progressAPI.uncomplete({ pageNumber, type });
      setCompletedKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
      // The server may have just restored the streak (this was the day's last
      // completion) — reflect that in the stats chip without a full refetch.
      const restoredStreak = res.data?.data?.currentStreak;
      if (restoredStreak !== undefined) {
        setData(prev => prev ? { ...prev, stats: { ...prev.stats, currentStreak: restoredStreak } } : prev);
      }
      showToast(t('dashboard.undone'), 'info');
    } catch {
      showToast(t('dashboard.failedUndo'), 'error');
    }
  };

  const alreadyKnow = async (pageNumber) => {
    const key = `new-${pageNumber}`;
    if (markingKeys.has(key) || completedKeys.has(key)) return;
    setMarkingKeys(prev => new Set(prev).add(key));
    try {
      await progressAPI.markComplete({ pageNumber, type: 'new', alreadyKnow: true });
      const taskRes = await progressAPI.getTodayTasks(isOverrideDay ? { ignoreOffDay: 'true' } : undefined);
      setData(taskRes.data.data);
      setCompletedKeys(new Set());
    } catch {
      showToast(t('dashboard.failedMark'), 'error');
    } finally {
      setMarkingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
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
  const completedJuz = juzData.filter(j => j.isComplete).length;
  // The Juz the user is currently working through = lowest-numbered incomplete Juz.
  const currentJuzObj = juzData.find(j => !j.isComplete) || null;
  const currentJuzNumber = currentJuzObj?.juzNumber ?? null; // null only when all 30 are complete
  const currentJuzPct = currentJuzObj?.percentage ?? (juzData.length > 0 ? 100 : 0);
  const memorizedPagesStat = stats ? `${stats.totalMemorized} / 604` : '— / 604';

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

  // Daily review breakdown — the stable per-day targets (cycle pages + recently
  // memorized pages), not the live list lengths, so the stat card and its hint
  // show the everyday review load and don't count down to zero as pages are done.
  const reviewCycleCount = stats?.cycleReviewTarget ?? 0;
  const reviewRecentCount = stats?.recentReviewTarget ?? 0;
  const reviewTotalCount = stats?.dailyReviewTotal ?? (reviewCycleCount + reviewRecentCount);
  const reviewBreakdown =
    reviewCycleCount > 0 && reviewRecentCount > 0
      ? t('hints.reviewBoth', { cycle: reviewCycleCount, recent: reviewRecentCount })
      : reviewCycleCount > 0
        ? t('hints.reviewCycleOnly', { cycle: reviewCycleCount })
        : reviewRecentCount > 0
          ? t('hints.reviewRecentOnly', { recent: reviewRecentCount })
          : '';
  // Stat-card hint: explains why the total may exceed the cycle target they set.
  const dailyReviewHintText = reviewBreakdown
    ? t('hints.dailyReviewHint', { breakdown: reviewBreakdown })
    : t('hints.dailyReviewNone');
  // Review-heading hint: keep the concept, then append today's live split.
  const reviewHeadingHintText = reviewBreakdown
    ? `${t('hints.review')} ${t('hints.reviewToday', { breakdown: reviewBreakdown })}`
    : t('hints.review');

  const newPending = (data?.newPages ?? []).filter(p => !completedKeys.has(`new-${p.pageNumber}`));
  const revPending = allReviewPages.filter(p => !completedKeys.has(`review-${p.pageNumber}`));

  const allTasksDone = data && !loading && newPending.length === 0 && revPending.length === 0 &&
    (completedKeys.size > 0 || data.stats?.todayComplete);

  const REVIEW_LIMIT = 5;
  const hasMoreReview = allReviewPages.length > REVIEW_LIMIT;

  const showContinuation = !loading && data && stats?.targetNewPages === 0 && data.continuationPage;

  const isHafiz = (stats?.totalMemorized ?? 0) >= 604;
  const isPaused = !isHafiz && (user?.pauseNewMemorization === true);

  const markAllNew = () => newPending.forEach(p => markComplete(p.pageNumber, 'new'));
  const markAllReview = () => revPending.forEach(p => markComplete(p.pageNumber, 'review'));

  const handleFirstCycleResume = async () => {
    try {
      await authAPI.updateProfile({ pauseNewMemorization: false, pausedFromOnboarding: false });
      updateUser({ pauseNewMemorization: false, pausedFromOnboarding: false });
      const [taskRes, juzRes] = await Promise.all([
        progressAPI.getTodayTasks(),
        progressAPI.getJuzProgress(),
      ]);
      setData(taskRes.data.data);
      setJuzData(juzRes.data.data);
      setCycleBannerDismissed(true);
    } catch {
      showToast(t('dashboard.failedMark'), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-6 pt-32 pb-12 flex flex-col gap-12">

        {/* First cycle complete banner */}
        {data?.firstCycleComplete && !cycleBannerDismissed && (
          <div className="bg-[#003527] rounded-2xl p-5 md:p-6 flex items-start gap-4 relative overflow-hidden shadow-lg">
            <div className="absolute end-4 top-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none text-amber-300 text-[120px] leading-none select-none">🎊</div>
            <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center shrink-0 text-xl">🎊</div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">{t('dashboard.firstCycleTitle')}</p>
              <p className="text-white/80 text-sm leading-relaxed">{t('dashboard.firstCycleMsg')}</p>
              <div className="flex gap-3 mt-3 flex-wrap">
                <button
                  onClick={handleFirstCycleResume}
                  className="text-xs font-semibold bg-white text-[#003527] px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  {t('dashboard.firstCycleResume')}
                </button>
                <button
                  onClick={() => setCycleBannerDismissed(true)}
                  className="text-xs text-white/60 hover:text-white px-4 py-2 rounded-lg transition-colors border border-white/20 hover:border-white/40"
                >
                  {t('dashboard.firstCycleDismiss')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Missed day banner */}
        {missedDay && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-xl px-5 py-3 flex items-center gap-3">
            <span>💛</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              {t('dashboard.missedDay')}
            </p>
          </div>
        )}

        {/* Khatam Al-Quran banner */}
        {isHafiz && !loading && (
          <div className="bg-[#003527] rounded-2xl p-6 md:p-8 border border-amber-400/30 relative overflow-hidden shadow-lg">
            <div className="absolute end-6 top-1/2 -translate-y-1/2 opacity-[0.07] pointer-events-none">
              <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor" className="text-amber-300">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
            </div>
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0 text-2xl">🌟</div>
              <div className="flex-1">
                <p className="text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-1">{t('dashboard.hafizBadge')}</p>
                <h3 className="text-white text-xl md:text-2xl font-bold mb-2">{t('dashboard.hafizCongrats')}</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-xl">{t('dashboard.hafizMessage')}</p>
                <div className="flex gap-3 mt-4 flex-wrap">
                  {[
                    { value: '604', label: t('dashboard.hafizPages') },
                    { value: '30',  label: t('progress.juz') },
                    { value: String(stats?.currentStreak ?? user?.currentStreak ?? 0), label: t('dashboard.streak') },
                  ].map(({ value, label }) => (
                    <div key={label} className="bg-white/10 rounded-lg px-4 py-2 text-center min-w-[72px]">
                      <p className="text-amber-300 text-lg font-bold">{value}</p>
                      <p className="text-white/50 text-[10px] uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Welcome & Stats Bento ─────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow flex flex-col justify-between border border-[#dce2f3] dark:border-gray-700 relative overflow-hidden">
            <div className="absolute -end-12 -top-12 opacity-5 pointer-events-none text-[#064e3b]">
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
            {(() => {
              const streak = stats?.currentStreak ?? user?.currentStreak ?? 0;
              const lastActive = user?.lastActiveDate
                ? new Date(user.lastActiveDate).toLocaleDateString()
                : null;
              if (streak === 0) {
                return (
                  <div data-tour="streak" className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[#707974] dark:text-gray-500 bg-[#f0f3ff] dark:bg-gray-700/50 w-max">
                    <FiZap className="w-4 h-4" />
                    <span className="text-xs font-medium">{t('dashboard.streakStart')}</span>
                    <InfoHint text={t('hints.streak')} label={t('dashboard.streak')} size="xs" />
                  </div>
                );
              }
              return (
                <div
                  data-tour="streak"
                  title={lastActive ? t('dashboard.streakLastActive', { date: lastActive }) : undefined}
                  className="mt-6 inline-flex items-center gap-2 bg-[#b0f0d6]/20 dark:bg-emerald-900/20 px-4 py-2 rounded-full text-[#064e3b] dark:text-emerald-400 w-max cursor-default"
                >
                  <FiZap className="w-4 h-4 text-[#fe932c]" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {streak} {t(streak === 1 ? 'dashboard.streakDay' : 'dashboard.streakDays')}
                  </span>
                  <InfoHint text={t('hints.streak')} label={t('dashboard.streak')} size="xs" />
                </div>
              );
            })()}
          </div>

          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-16" /><Sk h="h-6" w="w-20" /></>
              ) : (
                <>
                  <FiBook className="w-8 h-8 text-[#004f35] dark:text-emerald-400 mb-2" />
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400">{t('dashboard.dailyReview')}</span>
                    <InfoHint text={dailyReviewHintText} label={t('dashboard.dailyReview')} size="xs" />
                  </div>
                  <div className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{reviewTotalCount} {t('dashboard.pages')}</div>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-16" w="w-16" /><Sk h="h-3" w="w-16" /><Sk h="h-5" w="w-20" /></>
              ) : (
                <>
                  <JuzRing pct={currentJuzPct} />
                  <div className="flex items-center gap-1 mt-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400">{t('dashboard.currentJuzLabel')}</span>
                    <InfoHint text={t('hints.juz')} label={t('progress.juz')} size="xs" />
                  </div>
                  <Tooltip label={juzData.length === 0 ? '' : currentJuzNumber ? t('dashboard.currentJuzTooltip', { juz: currentJuzNumber }) : t('dashboard.currentJuzAllDone')}>
                    <div className="text-sm font-semibold text-[#003527] dark:text-gray-100 cursor-default">
                      {juzData.length === 0 ? '—' : currentJuzNumber ? t('dashboard.currentJuzValue', { juz: currentJuzNumber }) : '30 / 30'}
                    </div>
                  </Tooltip>
                  {juzData.length > 0 && currentJuzNumber && (
                    <div className="text-[10px] text-[#404944]/70 dark:text-gray-500 uppercase tracking-widest font-bold mt-1">
                      {t('dashboard.juzCompleteCount', { done: completedJuz })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sacred-shadow border border-[#dce2f3] dark:border-gray-700 flex flex-col justify-center items-center text-center col-span-2">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-24" /><Sk h="h-7" w="w-32" /></>
              ) : (
                <>
                  <FiList className="w-8 h-8 text-[#fe932c] mb-2" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] dark:text-gray-400 mb-1">{t('dashboard.memorizedPages')}</div>
                  <div className="text-2xl font-semibold text-[#003527] dark:text-gray-100">{memorizedPagesStat}</div>
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
            <button
              onClick={() => setHowToOpen(true)}
              className="ms-auto -mb-px inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-[#707974] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-400 transition-colors"
            >
              <FiHelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('howTo.open')}</span>
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
                <div className="w-20 h-20 rounded-full bg-[#004f35]/10 dark:bg-emerald-900/20 flex items-center justify-center text-[#004f35] dark:text-emerald-400 mb-6">
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
                    onClick={async () => {
                      setIsOverrideDay(true);
                      setLoading(true);
                      try {
                        const [taskRes, juzRes] = await Promise.all([
                          progressAPI.getTodayTasks({ ignoreOffDay: 'true' }),
                          progressAPI.getJuzProgress(),
                        ]);
                        setData(taskRes.data.data);
                        setJuzData(juzRes.data.data);
                      } catch {
                        showToast(t('dashboard.failedTasks'), 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}
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
              <div className={`grid gap-4 ${!isHafiz && allReviewPages.length > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* New Memorization column — hidden for Hafiz users */}
                {!isHafiz && (
                <div className="flex flex-col gap-4">
                  {/* Tour anchors on this compact header row, not the full-height
                      column, so the popover tucks right under the heading. */}
                  <div className="flex items-center justify-between gap-2" data-tour="new-mem">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#004f35]" />
                      <h4 className="text-lg font-semibold text-[#151c27] dark:text-gray-100">{t('dashboard.newMem')}</h4>
                      <InfoHint text={t('hints.newMem')} label={t('dashboard.newMem')} />
                    </div>
                    {!isPaused && newPending.length > 0 && (
                      <Tooltip label={t('tooltips.markAll')}>
                        <button onClick={markAllNew} className="text-[#004f35] dark:text-emerald-400 border border-[#004f35]/30 dark:border-emerald-500/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#004f35]/5 dark:hover:bg-emerald-900/20 transition-colors">
                          {t('dashboard.markAll')}
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  {isPaused ? (
                    <div className="bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-xl p-5 border border-[#003527]/20 dark:border-emerald-700/30">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#003527]/10 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <FiPause className="w-4 h-4 text-[#003527] dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#003527] dark:text-emerald-400">{t('dashboard.pausedTitle')}</p>
                          <p className="text-xs text-[#707974] dark:text-gray-400 mt-1 leading-relaxed">
                            {t('dashboard.pausedGoalNote', { pages: user?.dailyNewPages ?? 1 })}
                          </p>
                          <button
                            onClick={() => navigate('/settings?tab=memorization')}
                            className="mt-3 text-xs text-[#003527] dark:text-emerald-400 font-medium hover:underline"
                          >
                            {t('dashboard.resumeMem')} <span className="inline-block rtl:rotate-180">→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Continuation page card */}
                      {showContinuation && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/40 flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                            <FiBook className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                              {t('dashboard.continuePage')}
                              <InfoHint text={t('hints.continuation')} label={t('dashboard.continuePage')} size="xs" />
                            </p>
                            <p className="text-lg font-medium text-blue-900 dark:text-blue-200">{t('dashboard.page')} {data.continuationPage.pageNumber}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{formatSurahNames(data.continuationPage, i18n.language === 'ar')}</p>
                            <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">{t('dashboard.continueHint')}</p>
                          </div>
                        </div>
                      )}
                      {(data?.newPages ?? []).length === 0 && !showContinuation ? (
                        <p className="text-sm text-[#404944] dark:text-gray-400 py-4">{t('dashboard.noNewToday')}</p>
                      ) : (
                        (data?.newPages ?? []).map((p, idx) => (
                          <TaskCard key={`new-${p.pageNumber}`} page={p} type="new"
                            done={completedKeys.has(`new-${p.pageNumber}`)} marking={markingKeys.has(`new-${p.pageNumber}`)}
                            onComplete={markComplete} onAlreadyKnow={alreadyKnow} onUndo={undoComplete}
                            onHowTo={() => setHowToOpen(true)} tourAnchor={idx === 0} />
                        ))
                      )}
                    </>
                  )}
                </div>
                )}

                {/* Review column — hidden entirely when nothing to review */}
                {(allReviewPages.length > 0 || isHafiz) && (
                <div className="flex flex-col gap-3">
                  {/* Tour anchors on this compact header row, not the full-height
                      column, so the popover tucks right under the heading. */}
                  <div className="flex items-center justify-between gap-2" data-tour="review">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#fe932c]" />
                      <h4 className="text-lg font-semibold text-[#151c27] dark:text-gray-100">{t('dashboard.review')}</h4>
                      <InfoHint text={reviewHeadingHintText} label={t('dashboard.review')} />
                      <span className="text-xs text-[#707974] dark:text-gray-500">{t('dashboard.reviewCount', { count: allReviewPages.length })}</span>
                    </div>
                    {revPending.length > 0 && (
                      <Tooltip label={t('tooltips.markAll')}>
                        <button onClick={markAllReview} className="text-[#904d00] border border-[#904d00]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#904d00]/5 transition-colors">
                          {t('dashboard.markAll')}
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {allReviewPages.length === 0 ? (
                    <p className="text-sm text-[#404944] dark:text-gray-400 py-4">{t('dashboard.noReviewToday')}</p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2">
                        {allReviewPages.slice(0, showAllReview ? allReviewPages.length : REVIEW_LIMIT).map(p => (
                          <TaskCard
                            key={`review-${p.pageNumber}`}
                            page={p} type="review"
                            done={completedKeys.has(`review-${p.pageNumber}`)}
                            marking={markingKeys.has(`review-${p.pageNumber}`)}
                            onComplete={markComplete}
                            onUndo={undoComplete}
                            badge={p.isRecent ? t('dashboard.recentBadge') : undefined}
                          />
                        ))}
                      </div>
                      {hasMoreReview && (
                        <button
                          onClick={() => setShowAllReview(!showAllReview)}
                          className="flex items-center justify-center gap-2 text-sm text-[#404944] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 py-2 border border-[#dce2f3] dark:border-gray-700 rounded-xl hover:bg-[#f9f9ff] dark:hover:bg-gray-800/50 transition-colors"
                        >
                          {showAllReview ? (
                            <><FiChevronUp className="w-4 h-4" /> {t('dashboard.showLess')}</>
                          ) : (
                            <><FiChevronDown className="w-4 h-4" /> {t('dashboard.showAll', { count: allReviewPages.length })}</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
                )}
              </div>
            )
          )}

          {/* ── THIS WEEK TAB ──────────────────────────────────── */}
          {activeTab === 'week' && (
            <div className="flex flex-col gap-3">
              {/* Today card — always from loaded data */}
              {loading ? (
                <Sk h="h-32" />
              ) : (
                <WeekDayCard
                  day={{ date: todayDateString }}
                  isToday={true}
                  todayData={data}
                />
              )}

              {/* Next 6 days */}
              {weekLoading ? (
                Array(6).fill(0).map((_, i) => <Sk key={i} h="h-28" />)
              ) : weekData ? (
                weekData.map((day, i) => (
                  <WeekDayCard key={i} day={day} isToday={false} todayData={null} />
                ))
              ) : (
                <p className="text-sm text-[#707974] dark:text-gray-500 py-3 text-center">{t('dashboard.weekPlanError')}</p>
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

      <HowToMemorizeModal isOpen={howToOpen} onClose={() => setHowToOpen(false)} />
    </div>
  );
}
