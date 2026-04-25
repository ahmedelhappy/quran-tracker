import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authAPI, progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { FiBook, FiEdit2, FiUser, FiSave, FiX } from 'react-icons/fi';

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

// ── Edit Progress Modal ──────────────────────────────────
function EditProgressModal({ isOpen, onClose, onSave, currentJuzData }) {
  const [selectedJuz, setSelectedJuz] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen && currentJuzData) {
      const memorized = new Set(
        currentJuzData.filter(j => j.isComplete).map(j => j.juzNumber)
      );
      setSelectedJuz(memorized);
    }
  }, [isOpen, currentJuzData]);

  const toggleJuz = (n) => setSelectedJuz(prev => {
    const next = new Set(prev);
    next.has(n) ? next.delete(n) : next.add(n);
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const pages = [];
      JUZ_RANGES.forEach(({ juz, start, end }) => {
        if (selectedJuz.has(juz)) {
          for (let p = start; p <= end; p++) pages.push(p);
        }
      });
      await progressAPI.completeOnboarding({ memorizedPages: pages });
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
      <div className="relative bg-white rounded-2xl sacred-shadow border border-[#dce2f3] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#dce2f3] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-lg font-semibold text-[#003527]">Edit Memorized Progress</h3>
          <button onClick={onClose} className="text-[#707974] hover:text-[#003527] transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#404944] mb-4">Select the Juz you have completely memorized.</p>
          <div className="grid grid-cols-5 gap-2 mb-6">
            {JUZ_RANGES.map(({ juz }) => (
              <button
                key={juz}
                onClick={() => toggleJuz(juz)}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors border ${
                  selectedJuz.has(juz)
                    ? 'bg-[#003527] text-white border-[#003527]'
                    : 'bg-[#f9f9ff] border-[#bfc9c3] text-[#404944] hover:border-[#003527] hover:text-[#003527]'
                }`}
              >
                {juz}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#707974] mb-4">
            {selectedJuz.size > 0 ? `${selectedJuz.size} Juz selected` : 'No Juz selected'}
          </p>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#dce2f3] px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#404944] border border-[#bfc9c3] rounded-lg hover:bg-[#f9f9ff] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
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
  const { user, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState('profile');
  const [memorizedJuz, setMemorizedJuz] = useState([]);
  const [editProgressOpen, setEditProgressOpen] = useState(false);

  // Profile state
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Plan state
  const [dailyPages, setDailyPages]   = useState(user?.dailyNewPages ?? 1);
  const [intensity, setIntensity]     = useState(user?.reviewIntensity ?? 'standard');
  const [offDays, setOffDays]         = useState(user?.offDays ?? []);
  const [planDirty, setPlanDirty]     = useState(false);
  const [planSaving, setPlanSaving]   = useState(false);

  // Appearance
  const [theme, setTheme]       = useState('light');
  const [language, setLanguage] = useState('en');

  // Danger modals
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
    progressAPI.getJuzProgress()
      .then(res => setMemorizedJuz(res.data.data.filter(j => j.isComplete)))
      .catch(() => {});
  }, []);

  // Dirty tracking
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
    setOffDays(prev =>
      prev.includes(jsDay) ? prev.filter(x => x !== jsDay) : prev.length < 2 ? [...prev, jsDay] : prev
    );

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

  const sidebarItems = [
    { id: 'profile',      label: 'Profile',           icon: <FiUser className="w-5 h-5" /> },
    { id: 'memorization', label: 'Memorization Plan',  icon: <FiBook className="w-5 h-5" /> },
    { id: 'appearance',   label: 'Appearance',         icon: <span className="text-lg leading-none">🎨</span> },
  ];

  const saving = profileSaving || planSaving;

  return (
    <div className="min-h-screen bg-[#f9f9ff] sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-24 px-6 max-w-[1280px] w-full mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold text-[#003527] mb-2">Settings</h1>
          <p className="text-lg text-[#404944]">Customize your hifz journey and app preferences.</p>
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
                      ? 'bg-[#e2e8f8] text-[#003527]'
                      : 'text-[#404944] hover:bg-[#e7eefe] hover:text-[#003527]'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Mobile tab row */}
          <div className="lg:hidden flex gap-1 bg-[#f0f3ff] p-1 rounded-xl border border-[#dce2f3]">
            {sidebarItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === id ? 'bg-white text-[#003527] shadow-sm' : 'text-[#404944]'
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
              <section className="bg-white rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] pb-4">
                  <FiUser className="w-6 h-6 text-[#003527]" />
                  <h2 className="text-2xl font-semibold text-[#003527]">Profile</h2>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0 border-2 border-amber-400">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#151c27]">{user?.name}</p>
                    <p className="text-xs text-[#707974]">{user?.email}</p>
                    <p className="text-xs text-[#bfc9c3] mt-1">Avatar is generated from your initials</p>
                  </div>
                </div>

                {/* Display name */}
                <div className="mb-6">
                  <label className="block text-xs font-medium text-[#404944] uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Your name"
                    className="w-full max-w-sm border border-[#bfc9c3] rounded-lg px-4 py-2.5 text-sm bg-[#f0f3ff] text-[#151c27] focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="block text-xs font-medium text-[#404944] uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email ?? ''}
                    readOnly
                    className="w-full max-w-sm border border-[#bfc9c3] rounded-lg px-4 py-2.5 text-sm bg-[#e7eefe] text-[#707974] cursor-not-allowed"
                  />
                  <p className="text-xs text-[#707974] mt-1">Email cannot be changed</p>
                </div>
              </section>
            )}

            {/* ── Memorization Plan ────────────────────────── */}
            {activeSection === 'memorization' && (
              <section className="bg-white rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] pb-4">
                  <FiBook className="w-6 h-6 text-[#003527]" />
                  <h2 className="text-2xl font-semibold text-[#003527]">Memorization Plan</h2>
                </div>

                {/* Prior Memorization */}
                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <div>
                      <p className="text-lg font-medium text-[#151c27]">Prior Memorization</p>
                      <p className="text-sm text-[#404944]">Update what you have already memorized.</p>
                    </div>
                    <button
                      onClick={() => setEditProgressOpen(true)}
                      className="px-4 py-2 rounded-lg border border-[#bfc9c3] text-[#003527] font-medium hover:bg-[#e7eefe] transition-colors flex items-center gap-2 flex-shrink-0"
                    >
                      <FiEdit2 className="w-4 h-4" /> Edit Progress
                    </button>
                  </div>
                  <div className="bg-[#f9f9ff] rounded-xl p-4 border border-[#bfc9c3]">
                    <p className="text-sm text-[#404944] mb-3">Currently tracking as completed:</p>
                    <div className="flex flex-wrap gap-2">
                      {memorizedJuz.length > 0 ? (
                        memorizedJuz.map(j => (
                          <span key={j.juzNumber} className="px-3 py-1.5 bg-[#003527]/10 text-[#003527] rounded-lg text-sm font-medium">
                            Juz {j.juzNumber}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[#707974] italic">No completed Juz yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <hr className="border-[#dce2f3] my-6" />

                {/* Daily Target */}
                <div className="mb-6">
                  <p className="text-lg font-medium text-[#151c27] mb-1">Daily Target (Pages)</p>
                  <p className="text-sm text-[#404944] mb-4">Select your preferred number of pages to memorize per day.</p>
                  <div className="flex flex-wrap gap-3">
                    {DAILY_OPTIONS.map(v => (
                      <button
                        key={v}
                        onClick={() => setDailyPages(v)}
                        className={`px-6 py-3 rounded-xl border font-medium transition-colors ${
                          dailyPages === v
                            ? 'border-2 border-[#003527] bg-[#003527] text-white shadow-sm'
                            : 'border-[#bfc9c3] text-[#404944] hover:border-[#003527] hover:text-[#003527] bg-[#f9f9ff]'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review Intensity */}
                <div className="mb-6">
                  <p className="text-lg font-medium text-[#151c27] mb-1">Review Intensity</p>
                  <p className="text-sm text-[#404944] mb-4">How rigorously would you like to review past memorization?</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {INTENSITY_OPTIONS.map(({ value, label, desc }) => (
                      <label key={value} className="cursor-pointer">
                        <input type="radio" name="settings-intensity" value={value}
                          checked={intensity === value} onChange={() => setIntensity(value)} className="sr-only" />
                        <div className={`p-4 rounded-xl border-2 transition-all h-full ${
                          intensity === value
                            ? 'border-[#fe932c] bg-[#f9f9ff] shadow-sm'
                            : 'border-[#bfc9c3] bg-[#f9f9ff]'
                        }`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-medium ${intensity === value ? 'text-[#904d00]' : 'text-[#151c27]'}`}>{label}</span>
                            <span className={intensity === value ? 'text-[#fe932c]' : 'text-[#bfc9c3]'}>
                              {intensity === value ? '●' : '○'}
                            </span>
                          </div>
                          <p className="text-xs text-[#404944] leading-relaxed">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rest Days */}
                <div>
                  <p className="text-lg font-medium text-[#151c27] mb-1">Rest Days</p>
                  <p className="text-sm text-[#404944] mb-4">Select days you do not plan to memorize new portions.</p>
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
                          <span className="font-medium text-[#151c27]">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ── Appearance ──────────────────────────────── */}
            {activeSection === 'appearance' && (
              <section className="bg-white rounded-xl p-6 sacred-shadow">
                <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] pb-4">
                  <span className="text-2xl">🎨</span>
                  <h2 className="text-2xl font-semibold text-[#003527]">Appearance</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] mb-3">Theme</p>
                    <div className="bg-[#f9f9ff] rounded-xl p-2 flex gap-1 border border-[#bfc9c3]">
                      {[
                        { id: 'light', label: '☀ Light' },
                        { id: 'dark',  label: '🌙 Dark' },
                        { id: 'auto',  label: '⚡ Auto' },
                      ].map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setTheme(id)}
                          className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                            theme === id
                              ? 'bg-white shadow-sm border border-[#bfc9c3] text-[#003527]'
                              : 'text-[#404944] hover:bg-[#e7eefe]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <p className="text-lg font-medium text-[#151c27] mb-3">Language</p>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="w-full appearance-none bg-[#f9f9ff] border border-[#bfc9c3] text-[#151c27] py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003527] font-medium"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic (العربية)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#404944]">▾</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Danger Zone — always shown */}
            <section className="bg-white rounded-xl p-6 sacred-shadow border-2 border-red-100">
              <h2 className="text-xl font-semibold text-[#ba1a1a] mb-4">Danger Zone</h2>
              <div className="flex items-center justify-between gap-4 py-3 border-b border-[#dce2f3]">
                <div>
                  <p className="font-medium text-[#151c27]">Reset Progress</p>
                  <p className="text-sm text-[#404944]">Clear all tracking history and start fresh.</p>
                </div>
                <button onClick={() => setResetModal(true)} className="flex-shrink-0 border-2 border-[#ba1a1a] text-[#ba1a1a] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
                  Reset Data
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 pt-3">
                <div>
                  <p className="font-medium text-[#151c27]">Delete Account</p>
                  <p className="text-sm text-[#404944]">Permanently remove your account and all data.</p>
                </div>
                <button onClick={() => setDeleteModal(true)} className="flex-shrink-0 bg-[#ba1a1a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-800 transition-colors">
                  Delete Account
                </button>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* ── Sticky save bar ───────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#dce2f3] shadow-lg px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#404944]">You have unsaved changes.</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#003527] text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-[#064e3b] transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? 'Saving…' : <><FiSave className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      )}

      <Footer />

      <EditProgressModal
        isOpen={editProgressOpen}
        onClose={() => setEditProgressOpen(false)}
        onSave={() => {
          progressAPI.getJuzProgress()
            .then(res => setMemorizedJuz(res.data.data.filter(j => j.isComplete)))
            .catch(() => {});
        }}
        currentJuzData={memorizedJuz}
      />

      <ConfirmModal isOpen={resetModal} onClose={() => setResetModal(false)} onConfirm={() => showToast('Reset feature coming soon', 'info')}
        title="Reset All Progress?" message="This will permanently delete all your memorization records. This cannot be undone." confirmText="Yes, Reset" isDanger />
      <ConfirmModal isOpen={deleteModal} onClose={() => setDeleteModal(false)} onConfirm={() => showToast('Delete account feature coming soon', 'info')}
        title="Delete Your Account?" message="This will permanently delete your account and all data. You cannot recover this." confirmText="Yes, Delete" isDanger />
    </div>
  );
}
