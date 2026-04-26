import { useState, useEffect, useMemo } from 'react';
import { progressAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const HEAT_COLORS = ['bg-gray-100', 'bg-green-100', 'bg-green-300', 'bg-[#40916C]', 'bg-[#1B4332]'];

// Generate empty heatmap cells from user's registration date (or last 90 days)
function buildHeatmap(createdAt) {
  const cells = [];
  const today = new Date();
  const start = createdAt ? new Date(createdAt) : new Date();
  start.setDate(start.getDate() - 89); // fallback: 90 days

  const from = createdAt ? new Date(createdAt) : start;
  const daysDiff = Math.ceil((today - from) / 86400000);
  const days = Math.min(daysDiff + 1, 183); // cap at 6 months

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

export default function Progress() {
  const { user } = useAuth();
  const [juzData, setJuzData] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const heatmap = useMemo(() => {
    const cells = buildHeatmap(user?.createdAt);
    const byDate = overallStats?.memorizedByDate || {};
    cells.forEach(cell => {
      const count = byDate[cell.date] || 0;
      cell.level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
    });
    return cells;
  }, [user?.createdAt, overallStats]);

  const chartData = useMemo(() => {
    const byDate = overallStats?.memorizedByDate;
    if (!byDate || Object.keys(byDate).length === 0) {
      return [{ label: 'Now', pages: totalMemorized }];
    }
    const sorted = Object.keys(byDate).sort();
    let cumulative = 0;
    const all = sorted.map(d => {
      cumulative += byDate[d];
      const dt = new Date(d + 'T00:00:00Z');
      return {
        label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
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

  const completedJuz = juzData.filter(j => j.isComplete).length;
  const inProgressJuz = juzData.filter(j => j.memorizedPages > 0 && !j.isComplete).length;
  const pendingJuz = juzData.filter(j => j.memorizedPages === 0).length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <Navbar />

      {/* Header bar — padded to clear fixed navbar */}
      <div className="bg-[#1B4332] dark:bg-gray-800 text-white pt-24 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold mb-1">Progress & Statistics</h1>
          <p className="text-green-300 dark:text-gray-400 text-sm">Track your spiritual journey and memorization milestones.</p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Top row */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Overall completion */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-sm font-bold text-[#4A4A4A] dark:text-gray-400 uppercase tracking-wide mb-4">Overall Completion</h2>
            {loading ? (
              <div className="space-y-3"><Skeleton h="h-10" w="w-24" /><Skeleton h="h-3" /><Skeleton h="h-3" w="w-32" /></div>
            ) : (
              <>
                <p className="text-sm text-[#4A4A4A] dark:text-gray-400 mb-1">Total Quran Memorized</p>
                <div className="flex items-end gap-3 mb-3">
                  <span className="text-5xl font-extrabold text-[#1A1A1A] dark:text-gray-100">{percentage}%</span>
                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-1 rounded-lg mb-2">
                    {totalMemorized} pages
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, #40916C, #1B4332)',
                    }}
                  />
                </div>
                <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mt-2">{604 - totalMemorized} pages remaining</p>
              </>
            )}
          </div>

          {/* Activity heatmap */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-sm font-bold text-[#4A4A4A] dark:text-gray-400 uppercase tracking-wide mb-4">Activity Streak</h2>
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
                <p className="text-sm text-gray-400 italic">Your activity will appear here as you progress</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-0.5 mb-3">
                  {heatmap.map((cell, i) => (
                    <div
                      key={i}
                      title={cell.date}
                      className={`w-2.5 h-2.5 rounded-sm ${HEAT_COLORS[cell.level] ?? HEAT_COLORS[0]}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#4A4A4A]">
                  <span>Less</span>
                  {HEAT_COLORS.map((c, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                  ))}
                  <span>More</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Juz status grid */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100">Juz Status</h2>
            <div className="flex items-center gap-4 text-xs font-medium text-[#4A4A4A] dark:text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" /> Memorized</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> In Progress</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600 inline-block" /> Pending</span>
            </div>
          </div>

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
                  { label: 'Completed', count: completedJuz, color: 'text-[#1B4332] dark:text-emerald-400' },
                  { label: 'In Progress', count: inProgressJuz, color: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Pending', count: pendingJuz, color: 'text-gray-400 dark:text-gray-500' },
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

        {/* Memorization chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-5">Pages Memorized Over Time</h2>
          {loading ? (
            <Skeleton h="h-52" />
          ) : !hasActivity ? (
            <div className="h-52 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📈</div>
              <p className="text-sm text-gray-400 italic">Your activity will appear here as you progress</p>
              <p className="text-xs text-gray-300">Start memorizing pages to see your chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={chartData}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4A4A4A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#4A4A4A' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontSize: 12 }}
                  formatter={(v) => [`${v} pages`, 'Memorized']}
                />
                <Line type="monotone" dataKey="pages" stroke="#1B4332" strokeWidth={2.5} dot={{ fill: '#1B4332', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
