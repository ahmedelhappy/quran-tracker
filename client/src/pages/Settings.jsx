import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';

const DAY_LABELS = ['S','M','T','W','T','F','S'];
const DAY_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const DAILY_OPTIONS = [
  { value: 0.5, label: '0.5' },
  { value: 1,   label: '1' },
  { value: 2,   label: '2' },
  { value: 5,   label: '5' },
];

const INTENSITY_OPTIONS = [
  { value: 'light',    label: 'Light',    icon: '🌿', desc: 'Fewer reviews, relaxed pace' },
  { value: 'standard', label: 'Standard', icon: '⚖️', desc: 'Balanced retention' },
  { value: 'strong',   label: 'Strong',   icon: '🔥', desc: 'Rigorous, maximum retention' },
];

export default function Settings() {
  const { user, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();

  // Profile
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name ?? '');

  // Plan settings (track dirty state)
  const [dailyPages, setDailyPages]       = useState(user?.dailyNewPages ?? 1);
  const [intensity, setIntensity]         = useState(user?.reviewIntensity ?? 'standard');
  const [offDays, setOffDays]             = useState(user?.offDays ?? []);
  const [planDirty, setPlanDirty]         = useState(false);
  const [planSaving, setPlanSaving]       = useState(false);

  // Appearance (visual only)
  const [theme, setTheme]         = useState('light');
  const [language, setLanguage]   = useState('en');

  // Danger zone modals
  const [resetModal, setResetModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  // Sync from user on mount
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setDailyPages(user.dailyNewPages ?? 1);
      setIntensity(user.reviewIntensity ?? 'standard');
      setOffDays(user.offDays ?? []);
    }
  }, [user]);

  // Detect plan changes
  useEffect(() => {
    if (!user) return;
    const changed =
      dailyPages !== (user.dailyNewPages ?? 1) ||
      intensity  !== (user.reviewIntensity ?? 'standard') ||
      JSON.stringify(offDays.sort()) !== JSON.stringify((user.offDays ?? []).slice().sort());
    setPlanDirty(changed);
  }, [dailyPages, intensity, offDays, user]);

  const saveName = async () => {
    if (!name.trim() || name.trim() === user?.name) { setEditingName(false); return; }
    try {
      const res = await authAPI.updateProfile({ name: name.trim() });
      updateUser({ name: res.data.data.name });
      showToast('Name updated!', 'success');
    } catch {
      showToast('Failed to update name', 'error');
    }
    setEditingName(false);
  };

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      await authAPI.updateProfile({ dailyNewPages: dailyPages, reviewIntensity: intensity, offDays });
      await refreshUser();
      setPlanDirty(false);
      showToast('Plan updated!', 'success');
    } catch {
      showToast('Failed to update plan', 'error');
    } finally {
      setPlanSaving(false);
    }
  };

  const toggleOffDay = (d) =>
    setOffDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : prev.length < 2 ? [...prev, d] : prev
    );

  const handleReset = () => showToast('Reset feature coming soon', 'info');
  const handleDelete = () => showToast('Delete account feature coming soon', 'info');

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">Settings</h1>
          <p className="text-sm text-[#4A4A4A]">Manage your spiritual productivity preferences.</p>
        </div>

        {/* ── Profile ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-[#1A1A1A] mb-5">Profile</h2>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#40916C]"
                    autoFocus
                  />
                  <button onClick={saveName} className="text-[#1B4332] hover:text-[#2D6A4F]"><FiCheck className="w-4 h-4" /></button>
                  <button onClick={() => { setName(user?.name ?? ''); setEditingName(false); }} className="text-gray-400 hover:text-gray-600"><FiX className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#1A1A1A] truncate">{user?.name}</p>
                  <button onClick={() => setEditingName(true)} className="text-gray-400 hover:text-[#1B4332]"><FiEdit2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <p className="text-sm text-[#4A4A4A] mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
            <div className="bg-[#FAF9F6] rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#1B4332]">{user?.currentStreak ?? 0}</p>
              <p className="text-xs text-[#4A4A4A]">Day Streak</p>
            </div>
            <div className="bg-[#FAF9F6] rounded-xl p-3 text-center">
              <p className="text-2xl font-extrabold text-[#1B4332]">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
              </p>
              <p className="text-xs text-[#4A4A4A]">Member Since</p>
            </div>
          </div>
        </div>

        {/* ── Memorization Plan ───────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <h2 className="font-bold text-[#1A1A1A]">Memorization Plan</h2>

          {/* Daily target */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Daily Target (pages/day)</p>
            <div className="flex gap-2">
              {DAILY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDailyPages(value)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${
                    dailyPages === value
                      ? 'border-[#1B4332] bg-green-50 text-[#1B4332]'
                      : 'border-gray-100 text-[#4A4A4A] hover:border-green-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Review intensity */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Review Intensity</p>
            <div className="grid grid-cols-3 gap-2">
              {INTENSITY_OPTIONS.map(({ value, label, icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setIntensity(value)}
                  className={`rounded-xl p-3 text-left border-2 transition-colors ${
                    intensity === value ? 'border-[#1B4332] bg-green-50' : 'border-gray-100 hover:border-green-200'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <p className={`text-sm font-bold mt-1 ${intensity === value ? 'text-[#1B4332]' : 'text-[#1A1A1A]'}`}>{label}</p>
                  <p className="text-xs text-[#4A4A4A] mt-0.5 leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Rest days */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Rest Days</p>
            <p className="text-xs text-[#4A4A4A] mb-3">
              {offDays.length > 0
                ? `Off days: ${offDays.map(d => DAY_NAMES[d]).join(', ')}`
                : 'No rest days selected'}
            </p>
            <div className="flex gap-2">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => toggleOffDay(i)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
                    offDays.includes(i)
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-gray-100 text-[#4A4A4A] hover:bg-green-50 hover:text-[#1B4332]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {planDirty && (
            <button
              onClick={savePlan}
              disabled={planSaving}
              className="w-full bg-[#1B4332] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#2D6A4F] transition-colors disabled:opacity-60"
            >
              {planSaving ? 'Saving…' : 'Update Plan'}
            </button>
          )}
        </div>

        {/* ── Appearance ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <h2 className="font-bold text-[#1A1A1A]">Appearance</h2>

          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Theme</p>
            <div className="flex gap-2">
              {['light','dark','auto'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 capitalize transition-colors ${
                    theme === t ? 'border-[#1B4332] bg-green-50 text-[#1B4332]' : 'border-gray-100 text-[#4A4A4A] hover:border-green-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Dark mode is visual only — full theming coming soon.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-3">Interface Language</p>
            <div className="flex gap-2">
              {[{ code: 'en', label: 'English' }, { code: 'ar', label: 'العربية' }].map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                    language === code ? 'border-[#1B4332] bg-green-50 text-[#1B4332]' : 'border-gray-100 text-[#4A4A4A] hover:border-green-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Arabic interface coming in a future update.</p>
          </div>
        </div>

        {/* ── Danger Zone ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border-2 border-red-100 p-6 space-y-4">
          <h2 className="font-bold text-[#E63946]">Danger Zone</h2>

          <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Reset Progress</p>
              <p className="text-xs text-[#4A4A4A]">Clear all tracking history and start fresh.</p>
            </div>
            <button
              onClick={() => setResetModal(true)}
              className="flex-shrink-0 border-2 border-[#E63946] text-[#E63946] text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reset Data
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">Delete Account</p>
              <p className="text-xs text-[#4A4A4A]">Permanently remove your account and all data.</p>
            </div>
            <button
              onClick={() => setDeleteModal(true)}
              className="flex-shrink-0 bg-[#E63946] text-white text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </main>

      <Footer />

      <ConfirmModal
        isOpen={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleReset}
        title="Reset All Progress?"
        message="This will permanently delete all your memorization records and review history. Your account will remain but your plan will start from scratch. This cannot be undone."
        confirmText="Yes, Reset"
        isDanger
      />
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Your Account?"
        message="This will permanently delete your account, all progress data, and your memorization history. You will not be able to recover this information."
        confirmText="Yes, Delete"
        isDanger
      />
    </div>
  );
}
