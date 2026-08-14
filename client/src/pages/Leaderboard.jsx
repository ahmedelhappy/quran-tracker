import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAward } from 'react-icons/fi';
import { leaderboardAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

const Skeleton = ({ h = 'h-4', w = 'w-full' }) => (
  <div className={`${h} ${w} rounded bg-gray-100 dark:bg-gray-700 animate-pulse`} />
);

// A single ranked row. `mine` highlights the signed-in user; `showStreak` adds the
// streak column (all-time tab only).
function Row({ entry, mine, showStreak, t }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        mine
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700/60'
          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
      }`}
    >
      <span className="w-9 shrink-0 text-center text-lg font-bold tabular-nums text-[#1B4332] dark:text-emerald-400">
        {MEDALS[entry.rank] || entry.rank}
      </span>
      <span className="flex-1 min-w-0 truncate font-semibold text-[#1A1A1A] dark:text-gray-100">
        {entry.displayName}
        {mine && (
          <span className="ms-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-600 text-white align-middle">
            {t('leaderboard.you')}
          </span>
        )}
      </span>
      {showStreak && (
        <span className="shrink-0 text-sm font-medium text-orange-600 dark:text-orange-400 tabular-nums">
          🔥 {entry.streak}
        </span>
      )}
      <span className="w-20 shrink-0 text-end font-bold tabular-nums text-[#1B4332] dark:text-emerald-400">
        {entry.pages}
      </span>
    </div>
  );
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [period, setPeriod] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [name, setName] = useState(user?.displayName || user?.name || '');
  const [joining, setJoining] = useState(false);

  const optedIn = !!user?.leaderboardOptIn;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await leaderboardAPI.get(period);
      setData(res.data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) { showToast(t('leaderboard.nameTooShort'), 'error'); return; }
    setJoining(true);
    try {
      const res = await authAPI.updateProfile({ leaderboardOptIn: true, displayName: trimmed });
      updateUser(res.data.data);
      showToast(t('leaderboard.joined'), 'success');
      load();
    } catch (e) {
      showToast(e.response?.data?.message || t('common.error'), 'error');
    } finally {
      setJoining(false);
    }
  };

  const showStreak = period === 'all';
  const entries = data?.entries ?? [];

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <Navbar />

      {/* Header bar */}
      <div className="bg-[#1B4332] dark:bg-gray-800 text-white pt-24 pb-10 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-extrabold mb-1 flex items-center gap-2">
            <FiAward className="w-7 h-7" /> {t('leaderboard.title')}
          </h1>
          <p className="text-green-300 dark:text-gray-400 text-sm">{t('leaderboard.subtitle')}</p>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-6">

        {/* Opt-in card (only when not yet opted in) */}
        {!optedIn && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-1">{t('leaderboard.joinTitle')}</h2>
            <p className="text-sm text-[#4A4A4A] dark:text-gray-400 mb-4">{t('leaderboard.joinBody')}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                placeholder={t('leaderboard.displayNamePlaceholder')}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B4332] dark:focus:ring-emerald-500"
              />
              <button
                onClick={join}
                disabled={joining}
                className="inline-flex items-center justify-center gap-2 bg-[#1B4332] hover:bg-[#143728] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
              >
                <FiAward className="w-4 h-4" /> {joining ? t('leaderboard.joining') : t('leaderboard.joinButton')}
              </button>
            </div>
          </div>
        )}

        {/* Period tabs */}
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
          {[
            { key: 'week', label: t('leaderboard.thisWeek') },
            { key: 'all', label: t('leaderboard.allTime') },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === tab.key
                  ? 'bg-white dark:bg-gray-700 text-[#1B4332] dark:text-emerald-400 shadow-sm'
                  : 'text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Column header */}
        {!loading && !error && entries.length > 0 && (
          <div className="flex items-center gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#707974] dark:text-gray-500">
            <span className="w-9 shrink-0 text-center">{t('leaderboard.rank')}</span>
            <span className="flex-1">{t('leaderboard.player')}</span>
            {showStreak && <span className="shrink-0">{t('leaderboard.streak')}</span>}
            <span className="w-20 shrink-0 text-end">{t('leaderboard.pages')}</span>
          </div>
        )}

        {/* Board */}
        {loading ? (
          <div className="space-y-2">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} h="h-14" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{t('common.error')}</p>
            <button onClick={load} className="text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] px-4 py-2 rounded-lg transition-colors self-start sm:self-auto">
              {t('common.retry')}
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🏅</div>
            <p className="text-base font-semibold text-[#1A1A1A] dark:text-gray-100">{t('leaderboard.empty')}</p>
            <p className="text-sm text-[#707974] dark:text-gray-400 mt-1">{t('leaderboard.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <Row key={entry.userId} entry={entry} mine={entry.userId === user?._id} showStreak={showStreak} t={t} />
            ))}
          </div>
        )}

        {/* "Your rank" card — only when the user is ranked but outside the visible top */}
        {!loading && !error && data?.me && !data.meInTop && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-emerald-300 dark:border-emerald-700/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#707974] dark:text-gray-500 mb-2">{t('leaderboard.yourRankTitle')}</p>
            <Row entry={data.me} mine showStreak={showStreak} t={t} />
          </div>
        )}

        {/* Gentle nudge for opted-in users who have no pages yet in this period */}
        {!loading && !error && optedIn && !data?.me && entries.length > 0 && (
          <p className="text-center text-sm text-[#707974] dark:text-gray-400">{t('leaderboard.notRankedYet')}</p>
        )}
      </main>

      <Footer />
    </div>
  );
}
