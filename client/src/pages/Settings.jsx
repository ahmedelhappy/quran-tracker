import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authAPI, progressAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { FiBook, FiEdit2 } from 'react-icons/fi';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Day indices in JS: Mon=1,Tue=2,Wed=3,Thu=4,Fri=5,Sat=6,Sun=0
const DAY_JS_INDICES = [1, 2, 3, 4, 5, 6, 0];

const INTENSITY_OPTIONS = [
  { value: 'light',    label: 'Light',     desc: 'Focus mainly on new memorization. Less time spent on review.' },
  { value: 'standard', label: 'Standard',  desc: 'Balanced approach. Equal time on new and review.' },
  { value: 'strong',   label: 'Intensive', desc: 'Heavy focus on solidifying past hifz before moving forward.' },
];

const DAILY_OPTIONS = [0.5, 1, 2, 5];

export default function Settings() {
  const { user, updateUser, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState('memorization');
  const [memorizedJuz, setMemorizedJuz] = useState([]);

  // Plan state
  const [dailyPages, setDailyPages]     = useState(user?.dailyNewPages ?? 1);
  const [intensity, setIntensity]       = useState(user?.reviewIntensity ?? 'standard');
  const [offDays, setOffDays]           = useState(user?.offDays ?? []);
  const [planDirty, setPlanDirty]       = useState(false);
  const [planSaving, setPlanSaving]     = useState(false);

  // Appearance
  const [theme, setTheme]       = useState('light');
  const [language, setLanguage] = useState('en');

  // Danger modals
  const [resetModal, setResetModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    if (user) {
      setDailyPages(user.dailyNewPages ?? 1);
      setIntensity(user.reviewIntensity ?? 'standard');
      setOffDays(user.offDays ?? []);
    }
  }, [user]);

  // Load completed Juz chips
  useEffect(() => {
    progressAPI.getJuzProgress()
      .then(res => setMemorizedJuz(res.data.data.filter(j => j.isComplete)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const changed =
      dailyPages !== (user.dailyNewPages ?? 1) ||
      intensity  !== (user.reviewIntensity ?? 'standard') ||
      JSON.stringify([...offDays].sort()) !== JSON.stringify([...(user.offDays ?? [])].sort());
    setPlanDirty(changed);
  }, [dailyPages, intensity, offDays, user]);

  const toggleOffDay = (jsDay) =>
    setOffDays(prev =>
      prev.includes(jsDay) ? prev.filter(x => x !== jsDay) : prev.length < 2 ? [...prev, jsDay] : prev
    );

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

  const sidebarItems = [
    { id: 'memorization', label: 'Memorization Plan', icon: <FiBook className="w-5 h-5" /> },
    { id: 'appearance',   label: 'Appearance',        icon: <span className="text-lg">🎨</span> },
  ];

  return (
    <div className="min-h-screen bg-[#f9f9ff] sacred-pattern flex flex-col">
      <Navbar />

      <main className="flex-grow pt-[100px] pb-12 px-6 max-w-[1280px] w-full mx-auto">
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

          {/* Content */}
          <div className="col-span-1 lg:col-span-9 flex flex-col gap-12">

            {/* Memorization Plan */}
            <section id="memorization" className="bg-white rounded-xl p-6 sacred-shadow">
              <div className="flex items-center gap-3 mb-6 border-b border-[#dce2f3] pb-4">
                <FiBook className="w-6 h-6 text-[#003527]" />
                <h2 className="text-2xl font-semibold text-[#003527]">Memorization Plan</h2>
              </div>

              {/* Prior Memorization */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-lg font-medium text-[#151c27]">Prior Memorization</p>
                    <p className="text-sm text-[#404944]">Update what you have already memorized before starting your plan.</p>
                  </div>
                  <button className="px-4 py-2 rounded-lg border border-[#bfc9c3] text-[#003527] font-medium hover:bg-[#e7eefe] transition-colors flex items-center gap-2 flex-shrink-0">
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
                      <div className={`p-4 rounded-xl border-2 transition-all ${
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

            {/* Appearance */}
            <section id="appearance" className="bg-white rounded-xl p-6 sacred-shadow">
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

            {/* Danger Zone */}
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

            {/* Save Changes */}
            {planDirty && (
              <div className="flex justify-end">
                <button
                  onClick={savePlan}
                  disabled={planSaving}
                  className="bg-[#003527] text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-[#064e3b] transition-colors shadow-sm disabled:opacity-60"
                >
                  {planSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      <ConfirmModal isOpen={resetModal} onClose={() => setResetModal(false)} onConfirm={() => showToast('Reset feature coming soon', 'info')}
        title="Reset All Progress?" message="This will permanently delete all your memorization records. This cannot be undone." confirmText="Yes, Reset" isDanger />
      <ConfirmModal isOpen={deleteModal} onClose={() => setDeleteModal(false)} onConfirm={() => showToast('Delete account feature coming soon', 'info')}
        title="Delete Your Account?" message="This will permanently delete your account and all data. You cannot recover this." confirmText="Yes, Delete" isDanger />
    </div>
  );
}
