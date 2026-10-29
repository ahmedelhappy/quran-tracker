import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '../hooks/useTheme';

// The Progress page's "pages memorized over time" line chart. It is the only
// thing in the app drawn with recharts, which is most of the Progress chunk's
// weight (~200 KB of ~380 KB), so Progress loads this file lazily: the page
// renders straight away and the chart follows (M-09). Its Suspense fallback in
// Progress.jsx has the same 220 px height, so nothing moves when it arrives.

export default function MemorizationChart({ data }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
  );
}
