import { useState, useEffect } from 'react';
import { progressAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ── Mock heatmap data (last 6 months) ────────────────────
const generateHeatmap = () => {
  const cells = [];
  const today = new Date();
  for (let i = 182; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    cells.push({ date: d.toISOString().split('T')[0], level: Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 4) + 1 });
  }
  return cells;
};

// ── Mock chart data ───────────────────────────────────────
const generateChartData = (totalMemorized) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const ratio = (i + 1) / 6;
    return { month: months[d.getMonth()], pages: Math.round(totalMemorized * ratio * (0.85 + Math.random() * 0.15)) };
  });
};

const HEATMAP = generateHeatmap();
const HEAT_COLORS = ['bg-gray-100', 'bg-green-100', 'bg-green-300', 'bg-[#40916C]', 'bg-[#1B4332]'];

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
  const chartData = generateChartData(totalMemorized);

  const completedJuz = juzData.filter(j => j.isComplete).length;
  const inProgressJuz = juzData.filter(j => j.memorizedPages > 0 && !j.isComplete).length;
  const pendingJuz = juzData.filter(j => j.memorizedPages === 0).length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      <Navbar />

      {/* Header bar */}
      <div className="bg-[#1B4332] text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold mb-1">Progress & Statistics</h1>
          <p className="text-green-300 text-sm">Track your spiritual journey and memorization milestones.</p>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Top row */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Overall completion */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-[#4A4A4A] uppercase tracking-wide mb-4">Overall Completion</h2>
            {loading ? (
              <div className="space-y-3"><Skeleton h="h-10" w="w-24" /><Skeleton h="h-3" /><Skeleton h="h-3" w="w-32" /></div>
            ) : (
              <>
                <p className="text-sm text-[#4A4A4A] mb-1">Total Quran Memorized</p>
                <div className="flex items-end gap-3 mb-3">
                  <span className="text-5xl font-extrabold text-[#1A1A1A]">{percentage}%</span>
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded-lg mb-2">
                    {totalMemorized} pages
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, #40916C, #1B4332)',
                    }}
                  />
                </div>
                <p className="text-xs text-[#4A4A4A] mt-2">{604 - totalMemorized} pages remaining</p>
              </>
            )}
          </div>

          {/* Activity heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-[#4A4A4A] uppercase tracking-wide mb-4">Activity Streak</h2>
            <div className="flex flex-wrap gap-0.5 mb-3">
              {HEATMAP.map((cell, i) => (
                <div
                  key={i}
                  title={`${cell.date}: ${cell.level > 0 ? `${cell.level} tasks` : 'No activity'}`}
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
            <p className="text-xs text-gray-400 mt-2">Last 6 months · mock data</p>
          </div>
        </div>

        {/* Juz status grid */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Juz Status</h2>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#1B4332] inline-block" /> Memorized</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> In Progress</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Pending</span>
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

              {/* Summary counts */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                {[
                  { label: 'Completed', count: completedJuz, color: 'text-[#1B4332]' },
                  { label: 'In Progress', count: inProgressJuz, color: 'text-amber-600' },
                  { label: 'Pending', count: pendingJuz, color: 'text-gray-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-2xl font-extrabold ${color}`}>{count}</p>
                    <p className="text-xs text-[#4A4A4A]">{label}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Memorization chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#1A1A1A]">Pages Memorized Over Time</h2>
            <span className="text-xs text-gray-400">mock data</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#4A4A4A' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#4A4A4A' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ border: 'none', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.1)', fontSize: 12 }}
                formatter={(v) => [`${v} pages`, 'Memorized']}
              />
              <Line
                type="monotone"
                dataKey="pages"
                stroke="#1B4332"
                strokeWidth={2.5}
                dot={{ fill: '#1B4332', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Juz detail list */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Detailed Breakdown</h2>
          {loading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />)}</div>
          ) : (
            <div className="space-y-3">
              {juzData.map(j => (
                <div key={j.juzNumber} className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-[#4A4A4A] w-14 flex-shrink-0">Juz {j.juzNumber}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${j.percentage}%`,
                        background: j.isComplete ? '#1B4332' : j.memorizedPages > 0 ? '#F59E0B' : 'transparent',
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#4A4A4A] w-20 text-right flex-shrink-0">
                    {j.memorizedPages}/{j.totalPages} pages
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
