import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { FiBook, FiList, FiChevronDown, FiChevronUp } from 'react-icons/fi';

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

// ── Circular Juz progress ring ───────────────────────────
const JuzRing = ({ pct = 0 }) => {
  const v = Math.min(100, Math.max(0, parseFloat(pct) || 0));
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="none" r="16" stroke="#dce2f3" strokeDasharray="100 100" strokeLinecap="round" strokeWidth="4" />
        <circle cx="18" cy="18" fill="none" r="16" stroke="#fe932c" strokeDasharray={`${v} 100`} strokeLinecap="round" strokeWidth="4" />
      </svg>
      <span className="absolute text-[11px] font-bold text-[#003527]">{Math.round(v)}%</span>
    </div>
  );
};

const Sk = ({ h = 'h-4', w = 'w-full' }) => <div className={`${h} ${w} rounded bg-[#e7eefe] animate-pulse`} />;

// ── Task card ────────────────────────────────────────────
const TaskCard = ({ page, type, done, marking, onComplete, onUndo }) => {
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  return (
    <div
      className={`bg-white rounded-xl p-4 sacred-shadow border border-[#dce2f3] border-l-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-opacity ${done ? 'opacity-70' : ''}`}
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
          <p className="text-lg font-medium text-[#003527]">Page {page.pageNumber}</p>
          <p className="text-sm text-[#404944]">{page.surahName}</p>
        </div>
      </div>
      {done ? (
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#004f35] bg-[#004f35]/10 px-4 py-2 rounded-lg">
            ✓ Done
          </span>
          <button
            onClick={() => onUndo(page.pageNumber, type)}
            className="text-xs text-[#707974] hover:text-[#003527] underline underline-offset-2 transition-colors"
          >
            Undo
          </button>
        </div>
      ) : (
        <button
          onClick={() => onComplete(page.pageNumber, type)}
          disabled={marking}
          className={`text-xs font-semibold uppercase tracking-wide px-4 py-2 rounded-lg transition-colors self-stretch sm:self-auto disabled:opacity-60 ${
            isNew
              ? 'bg-[#004f35] text-white hover:bg-[#003527]'
              : 'bg-[#dce2f3] text-[#404944] hover:bg-[#d3daea] hover:text-[#003527] border border-[#bfc9c3]'
          }`}
        >
          {marking ? '…' : 'Mark as Complete'}
        </button>
      )}
    </div>
  );
};

// ── Extra task card (for Want More section) ──────────────
const ExtraTaskCard = ({ pageNumber, type, done, marking, onComplete, onUndo }) => {
  const isNew = type === 'new';
  const accentColor = isNew ? '#004f35' : '#fe932c';
  return (
    <div
      className={`bg-white rounded-xl p-3 border border-[#dce2f3] border-l-4 flex justify-between items-center gap-3 transition-opacity ${done ? 'opacity-70' : ''}`}
      style={{ borderLeftColor: accentColor }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}1a`, color: accentColor }}>
          {isNew ? <FiBook className="w-4 h-4" /> : <span className="text-xs font-bold">↺</span>}
        </div>
        <p className="text-sm font-medium text-[#003527]">Page {pageNumber}</p>
      </div>
      {done ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#004f35] bg-[#004f35]/10 px-3 py-1.5 rounded-lg">✓ Done</span>
          <button onClick={() => onUndo(pageNumber, type)} className="text-xs text-[#707974] hover:text-[#003527] underline">Undo</button>
        </div>
      ) : (
        <button
          onClick={() => onComplete(pageNumber, type)}
          disabled={marking}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
            isNew ? 'bg-[#004f35] text-white hover:bg-[#003527]' : 'bg-[#dce2f3] text-[#404944] hover:bg-[#d3daea] border border-[#bfc9c3]'
          }`}
        >
          {marking ? '…' : 'Mark Complete'}
        </button>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [juzData, setJuzData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedKeys, setCompletedKeys] = useState(new Set());
  const [markingKeys, setMarkingKeys] = useState(new Set());
  const [tipOpen, setTipOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showWantMore, setShowWantMore] = useState(false);
  const [extraData, setExtraData] = useState(null);

  const doy = dayOfYear();
  const quote = QUOTES[doy % QUOTES.length];
  const tip = TIPS[doy % TIPS.length];

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
    } catch {
      showToast('Failed to undo. Try again.', 'error');
    }
  };

  const markAllNew = () => {
    newPending.forEach(p => markComplete(p.pageNumber, 'new'));
  };
  const markAllReview = () => {
    revPending.forEach(p => markComplete(p.pageNumber, 'review'));
  };

  const loadExtraPages = () => {
    if (extraData) return;
    const extraNew = (data?.extraNewPages ?? []).map(p => p.pageNumber);
    const extraReview = (data?.extraReviewPages ?? []).map(p => p.pageNumber);
    setExtraData({ extraNew, extraReview });
  };

  const stats = data?.stats;
  const activeJuz = juzData.find(j => j.percentage > 0 && !j.isComplete) || juzData.find(j => j.percentage > 0) || null;
  const juzPct = activeJuz?.percentage ?? 0;
  const totalJuz = stats ? (stats.totalMemorized / 20.13).toFixed(1) : '0';
  const pagesToHifz = stats ? `${stats.totalMemorized} / 604` : '— / 604';

  const missedDay = (() => {
    if (!user?.lastActiveDate) return false;
    const last = new Date(user.lastActiveDate);
    last.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Math.round((today - last) / 86400000) > 1;
  })();

  const newPending = (data?.newPages ?? []).filter(p => !completedKeys.has(`new-${p.pageNumber}`));
  const revPending = (data?.reviewPages ?? []).filter(p => !completedKeys.has(`review-${p.pageNumber}`));
  const allTasksDone = data && !loading && newPending.length === 0 && revPending.length === 0 &&
    (completedKeys.size > 0 || data.stats?.todayComplete);

  const REVIEW_LIMIT = 3;
  const hasMoreReviews = (data?.reviewPages ?? []).length > REVIEW_LIMIT;

  return (
    <div className="min-h-screen bg-[#FFFDF5] sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow w-full max-w-[1280px] mx-auto px-6 pt-32 pb-12 flex flex-col gap-12">

        {/* Missed day banner */}
        {missedDay && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <span>💛</span>
            <p className="text-sm text-amber-800 font-medium">
              You missed yesterday — no worries! Your plan continues from where you left off.
            </p>
          </div>
        )}

        {/* ── Welcome & Stats Bento ─────────────────────────── */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2 bg-white rounded-xl p-6 sacred-shadow flex flex-col justify-between border border-[#dce2f3] relative overflow-hidden">
            <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none text-[#064e3b]">
              <svg fill="currentColor" height="200" viewBox="0 0 24 24" width="200">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[32px] font-semibold text-[#003527] mb-2 leading-tight">
                Assalamu Alaikum, {user?.name?.split(' ')[0]}
              </h2>
              <p className="text-[#404944]">Your journey of Hifz continues. You're doing great!</p>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 bg-[#b0f0d6]/20 px-4 py-2 rounded-full text-[#064e3b] w-max">
              <span className="text-[#fe932c]">🔥</span>
              <span className="text-xs font-bold uppercase tracking-wider">
                {stats?.currentStreak ?? user?.currentStreak ?? 0} Days Streak
              </span>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 sacred-shadow border border-[#dce2f3] flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-16" /><Sk h="h-6" w="w-20" /></>
              ) : (
                <>
                  <FiBook className="w-8 h-8 text-[#004f35] mb-2" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] mb-1">Daily Review</div>
                  <div className="text-2xl font-semibold text-[#003527]">{stats?.dailyReviewTarget ?? 0} Pages</div>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 sacred-shadow border border-[#dce2f3] flex flex-col justify-center items-center text-center">
              {loading ? (
                <><Sk h="h-16" w="w-16" /><Sk h="h-3" w="w-16" /><Sk h="h-5" w="w-20" /></>
              ) : (
                <>
                  <JuzRing pct={juzPct} />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] mt-2 mb-1">Juz Progress</div>
                  <div className="text-sm font-semibold text-[#003527]">{totalJuz} / 30</div>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 sacred-shadow border border-[#dce2f3] flex flex-col justify-center items-center text-center col-span-2">
              {loading ? (
                <><Sk h="h-8" w="w-8" /><Sk h="h-3" w="w-24" /><Sk h="h-7" w="w-32" /></>
              ) : (
                <>
                  <FiList className="w-8 h-8 text-[#fe932c] mb-2" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#404944] mb-1">Pages to Hifz</div>
                  <div className="text-2xl font-semibold text-[#003527]">{pagesToHifz}</div>
                  <div className="text-[10px] text-[#404944]/70 uppercase tracking-widest font-bold mt-1">Remaining</div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Tasks Section ─────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h3 className="text-2xl font-semibold text-[#003527] border-b border-[#dce2f3] pb-2">
            Today's Tasks
          </h3>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 sacred-shadow border border-[#dce2f3] space-y-2">
                  <Sk h="h-5" w="w-24" /><Sk h="h-4" w="w-36" />
                </div>
              ))}
            </div>
          ) : data?.isOffDay ? (
            <div className="bg-white rounded-xl p-12 sacred-shadow border border-[#dce2f3] flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center text-[#004f35]">
                <span style={{ fontSize: 200 }}>🌿</span>
              </div>
              <div className="w-20 h-20 rounded-full bg-[#004f35]/10 flex items-center justify-center text-[#004f35] mb-6">
                <span className="text-4xl">🌿</span>
              </div>
              <h2 className="text-4xl font-bold text-[#003527] mb-4 tracking-tight">Today is your rest day 🌿</h2>
              <p className="text-lg text-[#404944] max-w-2xl mb-8 leading-relaxed">
                The mind is a vessel; allowing it to rest expands its capacity to hold the words of Allah.
                Enjoy your day of pause without guilt, for consistency is built on sustainable rhythms.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 z-10">
                <button className="bg-[#003527] hover:bg-[#064e3b] text-white text-xs font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide flex items-center gap-2">
                  🧘 Start a 5-Min Reflection
                </button>
                <button className="bg-transparent border border-[#bfc9c3] text-[#404944] hover:bg-[#d3daea] hover:text-[#003527] text-xs font-semibold px-6 py-3 rounded-lg transition-colors uppercase tracking-wide">
                  Memorize Anyway
                </button>
              </div>
            </div>
          ) : allTasksDone ? (
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-xl p-10 sacred-shadow border border-[#dce2f3] flex flex-col items-center text-center">
                <p className="text-4xl mb-3">🎉</p>
                <h3 className="text-2xl font-semibold text-[#003527] mb-2">ما شاء الله! Tasks Complete!</h3>
                <p className="text-[#404944]">Come back tomorrow for your next session.</p>
              </div>

              {/* Want more? expandable section */}
              <div className="bg-white rounded-xl sacred-shadow border border-[#dce2f3] overflow-hidden">
                <button
                  onClick={() => {
                    setShowWantMore(!showWantMore);
                    if (!showWantMore) loadExtraPages();
                  }}
                  className="w-full p-4 flex justify-between items-center hover:bg-[#f9f9ff] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">✨</span>
                    <span className="text-base font-semibold text-[#003527]">Want to do more today?</span>
                  </div>
                  {showWantMore ? <FiChevronUp className="w-4 h-4 text-[#707974]" /> : <FiChevronDown className="w-4 h-4 text-[#707974]" />}
                </button>

                {showWantMore && (
                  <div className="border-t border-[#dce2f3] p-4 space-y-6">
                    <>
                      {/* Extra new memorization */}
                      {extraData?.extraNew?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-2 h-2 rounded-full bg-[#004f35]" />
                              <h4 className="text-sm font-semibold text-[#151c27]">Memorize More</h4>
                              <span className="text-xs text-[#707974]">— upcoming pages</span>
                            </div>
                            <div className="space-y-2">
                              {extraData.extraNew.map(pageNum => (
                                <ExtraTaskCard
                                  key={`extra-new-${pageNum}`}
                                  pageNumber={pageNum}
                                  type="new"
                                  done={completedKeys.has(`new-${pageNum}`)}
                                  marking={markingKeys.has(`new-${pageNum}`)}
                                  onComplete={markComplete}
                                  onUndo={undoComplete}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Extra review */}
                        {extraData?.extraReview?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-2 h-2 rounded-full bg-[#fe932c]" />
                              <h4 className="text-sm font-semibold text-[#151c27]">Review More</h4>
                              <span className="text-xs text-[#707974]">— additional pages</span>
                            </div>
                            <div className="space-y-2">
                              {extraData.extraReview.map(pageNum => (
                                <ExtraTaskCard
                                  key={`extra-review-${pageNum}`}
                                  pageNumber={pageNum}
                                  type="review"
                                  done={completedKeys.has(`review-${pageNum}`)}
                                  marking={markingKeys.has(`review-${pageNum}`)}
                                  onComplete={markComplete}
                                  onUndo={undoComplete}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                      {extraData?.extraNew?.length === 0 && extraData?.extraReview?.length === 0 && (
                        <p className="text-sm text-[#707974] text-center py-4">No additional pages available.</p>
                      )}
                    </>
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
                    <h4 className="text-lg font-semibold text-[#151c27]">New Memorization</h4>
                  </div>
                  {newPending.length > 0 && (
                    <button
                      onClick={markAllNew}
                      className="text-[#004f35] border border-[#004f35]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#004f35]/5 transition-colors"
                    >
                      Mark All
                    </button>
                  )}
                </div>
                {(data?.newPages ?? []).length === 0 ? (
                  <p className="text-sm text-[#404944] py-4">No new memorization today.</p>
                ) : (
                  data.newPages.map(p => (
                    <TaskCard
                      key={`new-${p.pageNumber}`}
                      page={p} type="new"
                      done={completedKeys.has(`new-${p.pageNumber}`)}
                      marking={markingKeys.has(`new-${p.pageNumber}`)}
                      onComplete={markComplete}
                      onUndo={undoComplete}
                    />
                  ))
                )}
              </div>

              {/* Review column */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#fe932c]" />
                    <h4 className="text-lg font-semibold text-[#151c27]">
                      Review
                      {(data?.reviewPages ?? []).length > 0 && (
                        <span className="ml-2 text-xs font-normal text-[#707974]">
                          {(data?.reviewPages ?? []).length} pages
                        </span>
                      )}
                    </h4>
                  </div>
                  {revPending.length > 0 && (
                    <button
                      onClick={markAllReview}
                      className="text-[#904d00] border border-[#904d00]/30 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-[#904d00]/5 transition-colors"
                    >
                      Mark All
                    </button>
                  )}
                </div>
                {(data?.reviewPages ?? []).length === 0 ? (
                  <p className="text-sm text-[#404944] py-4">No review pages today.</p>
                ) : (
                  <>
                    {/* Always show first REVIEW_LIMIT items (all, not just pending — enables undo) */}
                    {data.reviewPages.slice(0, REVIEW_LIMIT).map(p => (
                      <TaskCard
                        key={`review-${p.pageNumber}`}
                        page={p} type="review"
                        done={completedKeys.has(`review-${p.pageNumber}`)}
                        marking={markingKeys.has(`review-${p.pageNumber}`)}
                        onComplete={markComplete}
                        onUndo={undoComplete}
                      />
                    ))}

                    {/* Toggle button when more exist */}
                    {hasMoreReviews && (
                      <button
                        onClick={() => setShowAllReviews(!showAllReviews)}
                        className="flex items-center justify-center gap-2 text-sm text-[#404944] hover:text-[#003527] py-2 border border-[#dce2f3] rounded-xl hover:bg-[#f9f9ff] transition-colors"
                      >
                        {showAllReviews ? (
                          <><FiChevronUp className="w-4 h-4" /> Show less</>
                        ) : (
                          <><FiChevronDown className="w-4 h-4" /> Show all {data.reviewPages.length} review pages ({REVIEW_LIMIT} of {data.reviewPages.length} shown)</>
                        )}
                      </button>
                    )}

                    {/* Remaining items in scrollable section when expanded */}
                    {showAllReviews && hasMoreReviews && (
                      <div className="max-h-[600px] overflow-y-auto space-y-3 pr-1">
                        {data.reviewPages.slice(REVIEW_LIMIT).map(p => (
                          <TaskCard
                            key={`review-extra-${p.pageNumber}`}
                            page={p} type="review"
                            done={completedKeys.has(`review-${p.pageNumber}`)}
                            marking={markingKeys.has(`review-${p.pageNumber}`)}
                            onComplete={markComplete}
                            onUndo={undoComplete}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Tip of the Day ───────────────────────────────── */}
        <section>
          <div className="bg-white rounded-xl sacred-shadow border border-[#dce2f3] overflow-hidden">
            <button
              onClick={() => setTipOpen(!tipOpen)}
              className="w-full p-4 flex justify-between items-center bg-[#b0f0d6]/5 hover:bg-[#b0f0d6]/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#fe932c]">💡</span>
                <span className="text-lg font-semibold text-[#003527]">Tip of the Day</span>
              </div>
              <span className={`text-[#707974] transition-transform duration-300 ${tipOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {tipOpen && (
              <div className="p-4 border-t border-[#dce2f3] text-[#404944] leading-relaxed bg-white">
                "{tip}"
              </div>
            )}
          </div>
        </section>

        {/* Daily quote */}
        <div className="text-center pb-4">
          <p className="text-[#404944] italic text-sm max-w-2xl mx-auto">
            "{quote.text}"
          </p>
          <p className="text-[#707974] text-xs mt-1">— {quote.source}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
