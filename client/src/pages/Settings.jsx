import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI, progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { FiBook, FiEdit2, FiUser, FiSave, FiX, FiPlus, FiMonitor, FiSun, FiMoon, FiZap } from 'react-icons/fi';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_JS_INDICES = [1, 2, 3, 4, 5, 6, 0];

const INTENSITY_OPTIONS = [
  { value: 'light',    label: 'Light',     desc: 'Review 1/14 of memorized pages daily (~7% per day). Best for busy schedules.' },
  { value: 'standard', label: 'Standard',  desc: 'Review 1/10 of memorized pages daily (~10% per day). Recommended for steady progress.' },
  { value: 'strong',   label: 'Intensive', desc: 'Review 1/7 of memorized pages daily (~14% per day). Ideal for serious commitment.' },
];

const DAILY_OPTIONS = [0.5, 1, 2, 5];

const JUZ_RANGES = [
  {juz:1,start:1,end:21},{juz:2,start:22,end:41},{juz:3,start:42,end:61},
  {juz:4,start:62,end:81},{juz:5,start:82,end:101},{juz:6,start:102,end:121},
  {juz:7,start:122,end:141},{juz:8,start:142,end:161},{juz:9,start:162,end:181},
  {juz:10,start:182,end:201},{juz:11,start:202,end:221},{juz:12,start:222,end:241},
  {juz:13,start:242,end:261},{juz:14,start:262,end:281},{juz:15,start:282,end:301},
  {juz:16,start:302,end:321},{juz:17,start:322,end:341},{juz:18,start:342,end:361},
  {juz:19,start:362,end:381},{juz:20,start:382,end:401},{juz:21,start:402,end:421},
  {juz:22,start:422,end:441},{juz:23,start:442,end:461},{juz:24,start:462,end:481},
  {juz:25,start:482,end:501},{juz:26,start:502,end:521},{juz:27,start:522,end:541},
  {juz:28,start:542,end:561},{juz:29,start:562,end:581},{juz:30,start:582,end:604},
];

function computeSelectedPages(selectedJuz, pageRanges) {
  const pages = new Set();
  JUZ_RANGES.forEach(({ juz, start, end }) => {
    if (selectedJuz.has(juz)) { for (let p = start; p <= end; p++) pages.add(p); }
  });
  pageRanges.forEach(({ start, end }) => {
    const s = parseInt(start, 10), e = parseInt(end, 10);
    if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 604 && s < e)
      for (let p = s; p <= e; p++) pages.add(p);
  });
  return Array.from(pages).sort((a, b) => a - b);
}

function validateRanges(pageRanges) {
  const errors = pageRanges.map(() => ({}));
  const parsed = pageRanges.map(r => ({ start: parseInt(r.start, 10), end: parseInt(r.end, 10) }));
  parsed.forEach((r, i) => {
    if (r.start !== '' && !isNaN(r.start) && (r.start < 1 || r.start > 604))
      errors[i].start = 'Must be between 1 and 604';
    if (r.end !== '' && !isNaN(r.end) && (r.end < 1 || r.end > 604))
      errors[i].end = 'Must be between 1 and 604';
    if (!isNaN(r.start) && !isNaN(r.end) && r.start >= r.end)
      errors[i].end = 'End page must be greater than start page';
    parsed.forEach((other, j) => {
      if (i === j) return;
      if (!isNaN(r.start) && !isNaN(r.end) && !isNaN(other.start) && !isNaN(other.end) &&
          r.start < other.end && r.end > other.start)
        errors[i].start = 'Ranges cannot overlap';
    });
  });
  return errors;
}

// ── Edit Progress Modal ──────────────────────────────────
function EditProgressModal({ isOpen, onClose, onSave, currentJuzData }) {
  const [selectedJuz, setSelectedJuz] = useState(new Set());
  const [pageRanges, setPageRanges] = useState([{ start: '', end: '' }]);
  const [rangeErrors, setRangeErrors] = useState([{}]);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && currentJuzData) {
      const memorized = new Set(currentJuzData.filter(j => j.isComplete).map(j => j.juzNumber));
      setSelectedJuz(memorized);
      setPageRanges([{ start: '', end: '' }]);
      setRangeErrors([{}]);
    }
  }, [isOpen, currentJuzData]);

  const toggleJuz = (n) => setSelectedJuz(prev => {
    const next = new Set(prev);
    next.has(n) ? next.delete(n) : next.add(n);
    return next;
  });

  const addRange = () => { setPageRanges(r => [...r, { start: '', end: '' }]); setRangeErrors(e => [...e, {}]); };
  const removeRange = (i) => { setPageRanges(r => r.filter((_, idx) => idx !== i)); setRangeErrors(e => e.filter((_, idx) => idx !== i)); };
  const updateRange = (i, key, val) => {
    const updated = pageRanges.map((item, idx) => idx === i ? { ...item, [key]: val } : item);
    setPageRanges(updated);
    setRangeErrors(validateRanges(updated));
  };

  const hasRangeErrors = rangeErrors.some(e => e.start || e.end);
  const selectedPages = computeSelectedPages(selectedJuz, pageRanges);

  const handleSave = async () => {
    setSaving(true);
    try {
      await progressAPI.updateMemorized({ memorizedPages: selectedPages });
      showToast('Progress updated!', 'success');
      onSave();
      onClose();
    } catch {
      showToast('Failed to update progress', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-lg font-semibold text-[#003527] dark:text-gray-100">Edit Memorized Progress</h3>
          <button onClick={onClose} className="text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-3">Select by Juz (complete Juz only)</p>
            <div className="grid grid-cols-5 gap-2">
              {JUZ_RANGES.map(({ juz }) => (
                <button
                  key={juz}
                  onClick={() => toggleJuz(juz)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors border ${
                    selectedJuz.has(juz)
                      ? 'bg-[#003527] text-white border-[#003527]'
                      : 'bg-[#f9f9ff] dark:bg-gray-700 border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500'
                  }`}
                >
                  {juz}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#707974] dark:text-gray-400 mt-2">
              {selectedJuz.size > 0 ? `${selectedJuz.size} Juz selected` : 'No Juz selected'}
            </p>
          </div>

          <div className="border-t border-[#dce2f3] dark:border-gray-700 pt-4">
            <p className="text-sm font-medium text-[#151c27] dark:text-gray-200 mb-3">
              Add specific page ranges <span className="text-xs font-normal text-[#404944] dark:text-gray-400">(optional)</span>
            </p>
            <div className="space-y-2">
              {pageRanges.map((r, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="604" value={r.start} onChange={e => updateRange(i, 'start', e.target.value)}
                      placeholder="Start (1–604)"
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.start ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`} />
                    <span className="text-[#404944] dark:text-gray-400 text-sm flex-shrink-0">to</span>
                    <input type="number" min="1" max="604" value={r.end} onChange={e => updateRange(i, 'end', e.target.value)}
                      placeholder="End (1–604)"
                      className={`flex-1 border rounded-lg px-3 py-2 text-sm bg-[#f0f3ff] dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] dark:placeholder:text-gray-500 ${rangeErrors[i]?.end ? 'border-[#ba1a1a]' : 'border-[#bfc9c3] dark:border-gray-600'}`} />
                    {pageRanges.length > 1 && (
                      <button onClick={() => removeRange(i)} className="text-[#404944] dark:text-gray-400 hover:text-[#ba1a1a] flex-shrink-0">
                        <FiX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {(rangeErrors[i]?.start || rangeErrors[i]?.end) && (
                    <p className="text-xs text-[#ba1a1a]">{rangeErrors[i]?.end || rangeErrors[i]?.start}</p>
                  )}
                </div>
              ))}
              <button onClick={addRange} className="flex items-center gap-1.5 text-xs text-[#003527] dark:text-emerald-400 font-medium hover:underline mt-1">
                <FiPlus className="w-3 h-3" /> Add another range
              </button>
            </div>
          </div>

          {selectedPages.length > 0 && (
            <div className="bg-[#f0fdf4] dark:bg-emerald-900/20 rounded-lg px-4 py-2 border border-green-100 dark:border-emerald-800/30">
              <p className="text-xs text-[#004f35] dark:text-emerald-400 font-medium">
                Total: <strong>{selectedPages.length}</strong> pages selected
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#404944] dark:text-gray-300 border border-[#bfc9c3] dark:border-gray-600 rounded-lg hover:bg-[#f9f9ff] dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || hasRangeErrors}
            className="px-5 py-2 text-sm font-medium bg-[#003527] text-white rounded-lg hover:bg-[#064e3b] transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? 'Saving…' : <><FiSave className="w-4 h-4" /> Save Progress</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSection = searchParams.get('tab') || 'profile';
  const setActiveSection = (tab) => setSearchParams({ tab }, { replace: true });

  const [memorizedJuz, setMemorizedJuz] = useState([]);
  const [editProgressOpen, setEditProgressOpen] = useState(false);

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [dailyPages, setDailyPages]   = useState(user?.dailyNewPages ?? 1);
  const [intensity, setIntensity]     = useState(user?.reviewIntensity ?? 'standard');
  const [offDays, setOffDays]         = useState(user?.offDays ?? []);
  const [planDirty, setPlanDirty]     = useState(false);
  const [planSaving, setPlanSaving]   = useState(false);

  const [language, setLanguage] = useState('en');

  const [resetModal, setResetModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? '');
      setDailyPages(user.dailyNewPages ?? 1);
      setIntensity(user.reviewIntensity ?? 'standard');
      setOffDays(user.offDays ?? []);
    }
  }, [user]);

  useEffect(() => {
    progressAPI.getJuzProgress().then(res => setMemorizedJuz(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setProfileDirty((user?.name ?? '') !== profileName && profileName.trim().length > 0);
  }, [profileName, user]);

  useEffect(() => {
    if (!user) return;
    const changed =
      dailyPages !== (user.dailyNewPages ?? 1) ||
      intensity  !== (user.reviewIntensity ?? 'standard') ||
      JSON.stringify([...offDays].sort()) !== JSON.stringify([...(user.offDays ?? [])].sort());
    setPlanDirty(changed);
  }, [dailyPages, intensity, offDays, user]);

  const isDirty = (activeSection === 'profile' && profileDirty) ||
                  (activeSection === 'memorization' && planDirty);

  const toggleOffDay = (jsDay) =>
    setOffDays(prev => prev.includes(jsDay) ? prev.filter(x => x !== jsDay) : prev.length < 2 ? [...prev, jsDay] : prev);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await authAPI.updateProfile({ name: profileName.trim() });
      updateUser({ name: profileName.trim() });
      setProfileDirty(false);
      showToast('Profile updated!', 'success');
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
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

  const handleSave = () => {
    if (activeSection === 'profile') saveProfile();
    else if (activeSection === 'memorization') savePlan();
  };

  const handleDiscard = () => {
    if (activeSection === 'profile') setProfileName(user?.name ?? '');
    else if (activeSection === 'memorization') {
      setDailyPages(user?.dailyNewPages ?? 1);
      setIntensity(user?.reviewIntensity ?? 'standard');
      setOffDays(user?.offDays ?? []);
    }
  };

  const handleResetProgress = async () => {
    try {
      await progressAPI.resetProgress();
      await refreshUser();
      showToast('Progress reset. Starting fresh!', 'success');
    } catch {
      showToast('Failed to reset progress', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authAPI.deleteAccount();
      logout();
      navigate('/');
    } catch {
      showToast('Failed to delete account', 'error');
    }
  };

  const sidebarItems = [
    { id: 'profile',      label: 'Profile',           icon: <FiUser className="w-5 h-5" /> },
    { id: 'memorization', label: 'Memorization Plan',  icon: <FiBook className="w-5 h-5" /> },
    { id: 'appearance',   label: 'Appearance',         icon: <FiMonitor className="w-5 h-5" /> },
  ];

  const saving = profileSaving || planSaving;

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-24 px-6 max-w-[1280px] w-full mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold text-[#003527] dark:text-gray-100 mb-2">Settings</h1>
          <p className="text-lg text-[#404944] dark:text-gray-400">Customize your hifz journey and app preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Sidebar */}
          <div className="hidden lg:block lg:col-span-3">
            <nav className="flex flex-col gap-2 sticky top-[120px]">
              {sidebarItems.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`px-4 py-3 rounded-lg font-medium flex items-center gap-3 text-left transition-colors ${
                    activeSection === id
                      ? 'bg-[#e2e8f8] dark:bg-gray-700 text-[#003527] dark:text-gray-100'
                      : 'text-[#404944] dark:text-gray-400 hover:bg-[#e7eefe] dark:hover:bg-gray-800 hover:text-[#003527] dark:hover:text-gray-200'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Mobile tab row */}
          <div className="lg:hidden flex gap-1 bg-[#f0f3ff] dark:bg-gray-800 p-1 rounded-xl border border-[#dce2f3] dark:border-gray-700">
            {sidebarItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === id
                    ? 'bg-white dark:bg-gray-700 text-[#003527] dark:text-gray-100 shadow-sm'
                    : 'text-[#404944] dark:text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="col-span-1 lg:col-span-9 flex flex-col gap-8">

            {/* ── Profile ──────────────────────────────────── */}
            {activeSection === 'profile' && (
              <>
                <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                  <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                    <FiUser className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                    <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">Profile</h2>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0 border-2 border-amber-400">
                      {user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#151c27] dark:text-gray-200">{user?.name}</p>
                      <p className="text-xs text-[#707974] dark:text-gray-400">{user?.email}</p>
                      <p className="text-xs text-[#bfc9c3] dark:text-gray-500 mt-1">Avatar is generated from your initials</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="Your name"
                      className="w-full max-w-sm border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-[#f0f3ff] dark:bg-gray-700 text-[#151c27] dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent dark:placeholder:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#404944] dark:text-gray-400 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      className="w-full max-w-sm border border-[#bfc9c3] dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm bg-[#e7eefe] dark:bg-gray-700/50 text-[#707974] dark:text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-[#707974] dark:text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                </section>

                <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow border-2 border-red-100 dark:border-red-900/30">
                  <h2 className="text-xl font-semibold text-[#ba1a1a] mb-4">Danger Zone</h2>
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#dce2f3] dark:border-gray-700">
                    <div>
                      <p className="font-medium text-[#151c27] dark:text-gray-200">Reset Progress</p>
                      <p className="text-sm text-[#404944] dark:text-gray-400">Clear all tracking history and start fresh. Your account and settings are kept.</p>
                    </div>
                    <button onClick={() => setResetModal(true)} className="flex-shrink-0 border-2 border-[#ba1a1a] text-[#ba1a1a] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      Reset Data
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-3">
                    <div>
                      <p className="font-medium text-[#151c27] dark:text-gray-200">Delete Account</p>
                      <p className="text-sm text-[#404944] dark:text-gray-400">Permanently remove your account and all data. This cannot be undone.</p>
                    </div>
                    <button onClick={() => setDeleteModal(true)} className="flex-shrink-0 bg-[#ba1a1a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-800 transition-colors">
                      Delete Account
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* ── Memorization Plan ────────────────────────── */}
            {activeSection === 'memorization' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                  <FiBook className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                  <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">Memorization Plan</h2>
                </div>

                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <div>
                      <p className="text-lg font-medium text-[#151c27] dark:text-gray-200">Prior Memorization</p>
                      <p className="text-sm text-[#404944] dark:text-gray-400">Update what you have already memorized.</p>
                    </div>
                    <button
                      onClick={() => setEditProgressOpen(true)}
                      className="px-4 py-2 rounded-lg border border-[#bfc9c3] dark:border-gray-600 text-[#003527] dark:text-gray-200 font-medium hover:bg-[#e7eefe] dark:hover:bg-gray-700 transition-colors flex items-center gap-2 flex-shrink-0"
                    >
                      <FiEdit2 className="w-4 h-4" /> Edit Progress
                    </button>
                  </div>
                  <div className="bg-[#f9f9ff] dark:bg-gray-700/50 rounded-xl p-4 border border-[#bfc9c3] dark:border-gray-600">
                    <p className="text-sm text-[#404944] dark:text-gray-400 mb-3">Currently tracking as completed:</p>
                    <div className="flex flex-wrap gap-2">
                      {memorizedJuz.filter(j => j.isComplete).length > 0 ? (
                        memorizedJuz.filter(j => j.isComplete).map(j => (
                          <span key={j.juzNumber} className="px-3 py-1.5 bg-[#003527]/10 dark:bg-emerald-900/30 text-[#003527] dark:text-emerald-400 rounded-lg text-sm font-medium">
                            Juz {j.juzNumber}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[#707974] dark:text-gray-500 italic">No completed Juz yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-[#dce2f3] dark:border-gray-700 my-6" />

                <div className="mb-6">
                  <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-1">Daily Target (Pages)</p>
                  <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">Select your preferred number of pages to memorize per day.</p>
                  <div className="flex flex-wrap gap-3">
                    {DAILY_OPTIONS.map(v => (
                      <button
                        key={v}
                        onClick={() => setDailyPages(v)}
                        className={`px-6 py-3 rounded-xl border font-medium transition-colors ${
                          dailyPages === v
                            ? 'border-2 border-[#003527] bg-[#003527] text-white shadow-sm'
                            : 'border-[#bfc9c3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:border-[#003527] hover:text-[#003527] dark:hover:border-emerald-500 bg-[#f9f9ff] dark:bg-gray-700/50'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-1">Review Intensity</p>
                  <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">How rigorously would you like to review past memorization?</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {INTENSITY_OPTIONS.map(({ value, label, desc }) => (
                      <label key={value} className="cursor-pointer">
                        <input type="radio" name="settings-intensity" value={value}
                          checked={intensity === value} onChange={() => setIntensity(value)} className="sr-only" />
                        <div className={`p-4 rounded-xl border-2 transition-all h-full ${
                          intensity === value
                            ? 'border-[#fe932c] bg-[#f9f9ff] dark:bg-gray-700/50 shadow-sm'
                            : 'border-[#bfc9c3] dark:border-gray-600 bg-[#f9f9ff] dark:bg-gray-700/30'
                        }`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-medium ${intensity === value ? 'text-[#904d00]' : 'text-[#151c27] dark:text-gray-200'}`}>{label}</span>
                            <span className={intensity === value ? 'text-[#fe932c]' : 'text-[#bfc9c3] dark:text-gray-500'}>
                              {intensity === value ? '●' : '○'}
                            </span>
                          </div>
                          <p className="text-xs text-[#404944] dark:text-gray-400 leading-relaxed">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-1">Rest Days</p>
                  <p className="text-sm text-[#404944] dark:text-gray-400 mb-4">Select days you do not plan to memorize new portions.</p>
                  <div className="flex flex-wrap gap-6">
                    {DAY_LABELS.map((label, idx) => {
                      const jsDay = DAY_JS_INDICES[idx];
                      return (
                        <label key={label} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={offDays.includes(jsDay)}
                            onChange={() => toggleOffDay(jsDay)}
                            className="w-5 h-5 rounded border-[#707974] accent-[#003527] cursor-pointer"
                          />
                          <span className="font-medium text-[#151c27] dark:text-gray-200">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ── Appearance ──────────────────────────────── */}
            {activeSection === 'appearance' && (
              <section className="bg-white dark:bg-gray-800 rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] dark:border-gray-700 pb-4">
                  <FiMonitor className="w-6 h-6 text-[#003527] dark:text-emerald-400" />
                  <h2 className="text-2xl font-semibold text-[#003527] dark:text-gray-100">Appearance</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-3">Theme</p>
                    <div className="bg-[#f9f9ff] dark:bg-gray-700/50 rounded-xl p-2 flex gap-1 border border-[#bfc9c3] dark:border-gray-600">
                      {[
                        { id: 'light', label: 'Light', icon: <FiSun className="w-4 h-4" /> },
                        { id: 'dark',  label: 'Dark',  icon: <FiMoon className="w-4 h-4" /> },
                        { id: 'auto',  label: 'Auto',  icon: <FiZap className="w-4 h-4" /> },
                      ].map(({ id, label, icon }) => (
                        <button
                          key={id}
                          onClick={() => setTheme(id)}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            theme === id
                              ? 'bg-white dark:bg-gray-600 shadow-sm border border-[#bfc9c3] dark:border-gray-500 text-[#003527] dark:text-gray-100'
                              : 'text-[#404944] dark:text-gray-400 hover:bg-[#e7eefe] dark:hover:bg-gray-700'
                          }`}
                        >
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] dark:text-gray-200 mb-3">Language</p>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="w-full appearance-none bg-[#f9f9ff] dark:bg-gray-700 border border-[#bfc9c3] dark:border-gray-600 text-[#151c27] dark:text-gray-200 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003527] font-medium"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic (العربية)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#404944] dark:text-gray-400">▾</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </div>
        </div>
      </main>

      {/* ── Sticky save bar ───────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-[#dce2f3] dark:border-gray-700 shadow-lg px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#404944] dark:text-gray-400">You have unsaved changes.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="text-sm text-[#404944] dark:text-gray-400 border border-[#bfc9c3] dark:border-gray-600 px-4 py-2.5 rounded-xl hover:bg-[#f0f3ff] dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#003527] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#064e3b] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? 'Saving…' : <><FiSave className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      )}

      <Footer />

      <EditProgressModal
        isOpen={editProgressOpen}
        onClose={() => setEditProgressOpen(false)}
        onSave={() => progressAPI.getJuzProgress().then(res => setMemorizedJuz(res.data.data)).catch(() => {})}
        currentJuzData={memorizedJuz}
      />

      <ConfirmModal
        isOpen={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleResetProgress}
        title="Reset All Progress?"
        message="This will permanently delete all your memorization records and reset your streak to 0. Your account and settings will be kept. This cannot be undone."
        confirmText="Yes, Reset"
        isDanger
      />
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Your Account?"
        message="This will permanently delete your account and all associated data. You will be logged out immediately. This cannot be undone."
        confirmText="Yes, Delete"
        isDanger
      />
    </div>
  );
}
