import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { FiBook, FiRefreshCw, FiTarget, FiChevronDown, FiChevronUp, FiCheck } from 'react-icons/fi';

// ── Daily quotes (rotated by day-of-year) ──────────────
const QUOTES = [
  { text: 'The best among you (Muslims) are those who learn the Qur\'an and teach it.', source: 'Sahih Al-Bukhari 5027' },
  { text: 'Whoever recites a letter from the Book of Allah will receive one good deed, and that good deed is worth ten times its value.', source: 'Tirmidhi 2910' },
  { text: 'The Quran is a healing for what is in the hearts.', source: 'Quran 10:57' },
  { text: 'Indeed, this Qur\'an guides to that which is most suitable and gives good tidings to the believers.', source: 'Quran 17:9' },
  { text: 'And We have certainly made the Qur\'an easy for remembrance, so is there any who will remember?', source: 'Quran 54:17' },
  { text: 'Those who recite the Book of Allah, establish prayer, and spend from what We have provided them secretly and publicly — they expect a transaction that will never fail.', source: 'Quran 35:29' },
  { text: 'Recite the Quran for it will come as an intercessor for its reciters on the Day of Resurrection.', source: 'Muslim 804' },
  { text: 'The one who is skilled in the Quran will be with the honourable, righteous scribes.', source: 'Bukhari & Muslim' },
  { text: 'Read the Quran; for verily it will come on the Day of Resurrection as an intercessor for those who recite it.', source: 'Muslim 804' },
  { text: 'It will be said to the companion of the Quran: Recite and rise in status.', source: 'Abu Dawud 1464' },
  { text: 'Envy is not permitted except in two cases: envy of a man whom Allah has given the Quran, and he recites it night and day.', source: 'Bukhari 5026' },
  { text: 'The heart that has no Quran in it is like a ruined house.', source: 'Tirmidhi' },
  { text: 'The most superior among you is the one who learns the Quran and teaches it.', source: 'Bukhari 5027' },
  { text: 'Adorn the Quran with your voices, for a beautiful voice increases the beauty of the Quran.', source: 'Darimi' },
  { text: 'Hold fast to the Quran, for it is the rope of Allah extended to you from the heaven to the earth.', source: 'Tabarani' },
  { text: 'Whoever memorizes the Quran and acts according to it, Allah will reward him and honour him greatly.', source: 'Tirmidhi' },
];

const dayOfYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
};

const TIPS = [
  'Memorize after Fajr. Your mind is sharpest before the distractions of the day begin.',
  'Recite aloud — hearing your own voice reinforces neural pathways for retention.',
  'Review before sleeping. The brain consolidates memory during sleep.',
  'Break a page into smaller sections and perfect each before moving on.',
  'Write out verses by hand to engage multiple senses in memorization.',
];

// ── Achievement definitions ──────────────────────────────
const getAchievements = (stats) => [
  { name: '7 Day Streak',    icon: '🔥', earned: (stats?.currentStreak ?? 0) >= 7,  desc: '7 consecutive active days' },
  { name: 'First Page',      icon: '📄', earned: (stats?.totalMemorized ?? 0) >= 1,  desc: 'Memorized your first page' },
  { name: 'First Juz',       icon: '⭐', earned: (stats?.totalMemorized ?? 0) >= 20, desc: '20 pages memorized' },
  { name: '30 Day Streak',   icon: '🌟', earned: (stats?.currentStreak ?? 0) >= 30,  desc: '30 consecutive days' },
  { name: '5 Juz Milestone', icon: '📖', earned: (stats?.totalMemorized ?? 0) >= 100, desc: '100+ pages memorized' },
  { name: 'Hafiz',           icon: '👑', earned: (stats?.totalMemorized ?? 0) === 604, desc: 'Complete Quran memorized' },
];

// ── Skeleton card ─────────────────────────────────────────
const Skeleton = ({ h = 'h-6', w = 'w-full', rounded = 'rounded' }) => (
  <div className={`${h} ${w} ${rounded} bg-gray-100 animate-pulse`} />
);

// ── Task card ─────────────────────────────────────────────
const TaskCard = ({ page, type, onComplete, done }) => (
  <div className={`bg-white rounded-xl border p-4 transition-all ${done ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className={`text-xs font-semibold uppercase tracking-wide ${type === 'new' ? 'text-[#1B4332]' : 'text-blue-600'}`}>
          {type === 'new' ? '📖 New Memorization' : '📘 Daily Review'}
        </span>
        <p className="text-xl font-bold text-[#1A1A1A] mt-1">Page {page.pageNumber}</p>
        <p className="text-sm text-[#4A4A4A]">{page.surahName}</p>
      </div>
      {done ? (
        <span className="flex items-center gap-1 text-green-600 text-sm font-semibold bg-green-100 px-3 py-1.5 rounded-lg">
          <FiCheck className="w-4 h-4" /> Done
        </span>
      ) : (
        <button
          onClick={() => onComplete(page.pageNumber, type)}
          className="bg-[#1B4332] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#2D6A4F] transition-colors whitespace-nowrap"
        >
          ✓ Mark Complete
        </button>
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [juzData, setJuzData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedKeys, setCompletedKeys] = useState(new Set());
  const [showExtra, setShowExtra] = useState(false);
  const [showTip, setShowTip] = useState(true);
  const [marking, setMarking] = useState(new Set());

  const quote = QUOTES[dayOfYear() % QUOTES.length];
  const tip = TIPS[dayOfYear() % TIPS.length];

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
    if (marking.has(key) || completedKeys.has(key)) return;
    setMarking(prev => new Set(prev).add(key));
    try {
      await progressAPI.markComplete({ pageNumber, type });
      setCompletedKeys(prev => new Set(prev).add(key));
      showToast(`Page ${pageNumber} marked as ${type === 'new' ? 'memorized' : 'reviewed'}!`, 'success');
    } catch {
      showToast('Failed to mark page. Try again.', 'error');
    } finally {
      setMarking(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const stats = data?.stats;
  const achievements = getAchievements(stats);

  // Current working Juz (first with 0 < pct < 100, else first with pct > 0)
  const activeJuz = juzData.find(j => j.percentage > 0 && j.percentage < 100)
    || juzData.find(j => j.percentage > 0)
    || juzData[0];

  // Missed day detection
  const missedDay = (() => {
    if (!user?.lastActiveDate) return false;
    const last = new Date(user.lastActiveDate);
    last.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Math.round((today - last) / 86400000) > 1;
  })();

  // Pending counts (exclude already completed locally)
  const newPending  = (data?.newPages ?? []).filter(p => !completedKeys.has(`new-${p.pageNumber}`));
  const revPending  = (data?.reviewPages ?? []).filter(p => !completedKeys.has(`review-${p.pageNumber}`));
  const totalPending = newPending.length + revPending.length;
  const allDone = data && !loading && totalPending === 0 && (stats?.todayComplete || completedKeys.size > 0);

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Missed day banner */}
        {missedDay && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-lg">💛</span>
            <p className="text-sm text-amber-800 font-medium">
              You missed yesterday — no worries! Your plan has been adjusted and continues from where you left off.
            </p>
          </div>
        )}

        {/* Off day state */}
        {data?.isOffDay && (
          <div className="bg-[#1B4332] rounded-2xl p-8 text-center text-white">
            <p className="text-4xl mb-3">🌿</p>
            <h2 className="text-2xl font-bold mb-2">Today is your rest day</h2>
            <p className="text-green-200">Enjoy your break. You can still review pages below if you'd like.</p>
          </div>
        )}

        {/* Welcome banner */}
        {!data?.isOffDay && (
          <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-2xl p-6 text-white">
            <h2 className="text-xl font-bold mb-1">Assalamu Alaikum, {user?.name?.split(' ')[0]}! 👋</h2>
            <p className="text-green-100 text-sm italic">"{quote.text}"</p>
            <p className="text-green-300 text-xs mt-1">— {quote.source}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                <Skeleton h="h-3" w="w-20" />
                <Skeleton h="h-8" w="w-16" />
                <Skeleton h="h-2" w="w-24" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A] mb-1 flex items-center gap-1.5">
                  <span>🔥</span> Current Streak
                </p>
                <p className="text-3xl font-extrabold text-[#1A1A1A]">{stats?.currentStreak ?? 0}</p>
                <p className="text-xs text-[#4A4A4A] mt-0.5">days</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A] mb-1 flex items-center gap-1.5">
                  <FiBook className="w-3.5 h-3.5" /> Total Memorized
                </p>
                <p className="text-3xl font-extrabold text-[#1A1A1A]">
                  {((stats?.totalMemorized ?? 0) / 20).toFixed(1)}
                </p>
                <p className="text-xs text-[#4A4A4A] mt-0.5">Juz ({stats?.totalMemorized ?? 0} pages)</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A] mb-1 flex items-center gap-1.5">
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  {activeJuz ? `Juz ${activeJuz.juzNumber} Progress` : 'Progress'}
                </p>
                <p className="text-3xl font-extrabold text-[#1A1A1A]">{activeJuz?.percentage ?? 0}%</p>
                <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#40916C] rounded-full"
                    style={{ width: `${activeJuz?.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A] mb-1 flex items-center gap-1.5">
                  <FiTarget className="w-3.5 h-3.5" /> Daily Review
                </p>
                <p className="text-3xl font-extrabold text-[#1A1A1A]">{stats?.dailyReviewTarget ?? 0}</p>
                <p className="text-xs text-[#4A4A4A] mt-0.5">pages to review</p>
              </div>
            </>
          )}
        </div>

        {/* Today's tasks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Today's Tasks</h2>
            {!loading && totalPending > 0 && (
              <span className="bg-[#1B4332] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {totalPending} pending
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                  <Skeleton h="h-3" w="w-24" />
                  <Skeleton h="h-7" w="w-32" />
                  <Skeleton h="h-3" w="w-40" />
                </div>
              ))}
            </div>
          ) : allDone && !data?.isOffDay ? (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <h3 className="text-xl font-bold text-[#1A1A1A] mb-1">ما شاء الله! You've completed today's tasks!</h3>
              <p className="text-sm text-[#4A4A4A]">Come back tomorrow for your next session.</p>
              <button
                onClick={() => setShowExtra(!showExtra)}
                className="mt-4 text-sm text-[#1B4332] font-semibold hover:underline flex items-center gap-1 mx-auto"
              >
                Want more practice? {showExtra ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* New pages */}
              {data?.newPages?.map(p => (
                <TaskCard
                  key={`new-${p.pageNumber}`}
                  page={p} type="new"
                  done={completedKeys.has(`new-${p.pageNumber}`)}
                  onComplete={markComplete}
                />
              ))}
              {/* Review pages */}
              {data?.reviewPages?.map(p => (
                <TaskCard
                  key={`review-${p.pageNumber}`}
                  page={p} type="review"
                  done={completedKeys.has(`review-${p.pageNumber}`)}
                  onComplete={markComplete}
                />
              ))}
              {/* Off day optional review */}
              {data?.isOffDay && (data?.extraReviewPages?.length > 0) && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-[#4A4A4A] mb-3">Optional review (off day):</p>
                  {data.extraReviewPages.map(p => (
                    <TaskCard key={`review-${p.pageNumber}`} page={p} type="review" done={completedKeys.has(`review-${p.pageNumber}`)} onComplete={markComplete} />
                  ))}
                </div>
              )}
              {/* No tasks */}
              {!data?.isOffDay && data?.newPages?.length === 0 && data?.reviewPages?.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <p className="text-[#4A4A4A] text-sm">No tasks for today. Start memorizing to generate your plan!</p>
                </div>
              )}
            </div>
          )}

          {/* Extra practice (expandable) */}
          {(showExtra || allDone) && (data?.extraNewPages?.length > 0 || data?.extraReviewPages?.length > 0) && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold text-[#4A4A4A] uppercase tracking-wide">Extra Practice</p>
              {data.extraNewPages?.map(p => (
                <TaskCard key={`new-${p.pageNumber}`} page={p} type="new" done={completedKeys.has(`new-${p.pageNumber}`)} onComplete={markComplete} />
              ))}
              {data.extraReviewPages?.map(p => (
                <TaskCard key={`review-${p.pageNumber}`} page={p} type="review" done={completedKeys.has(`review-${p.pageNumber}`)} onComplete={markComplete} />
              ))}
            </div>
          )}
        </div>

        {/* Achievements */}
        <div>
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Recent Achievements</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {achievements.map(({ name, icon, earned, desc }) => (
              <div key={name} className="flex-shrink-0 flex flex-col items-center gap-2 w-20">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                  earned ? 'bg-[#1B4332]' : 'bg-gray-100'
                }`}>
                  {earned ? icon : '🔒'}
                </div>
                <p className={`text-xs text-center font-medium leading-tight ${earned ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>
                  {name}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tip of the day */}
        {showTip && (
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">💡</span>
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A] mb-0.5">Tip of the Day</p>
                  <p className="text-sm text-[#4A4A4A] leading-relaxed">{tip}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTip(false)}
                className="text-gray-300 hover:text-gray-500 flex-shrink-0 text-lg leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
