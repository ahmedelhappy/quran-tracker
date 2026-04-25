import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { progressAPI, authAPI } from '../services/api';
import { FiPlus, FiX } from 'react-icons/fi';

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

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const DAILY_OPTIONS = [
  { value: 0.5, label: '0.5 Pages/Day', sub: 'Half a page' },
  { value: 1,   label: '1 Page/Day',    sub: 'Recommended' },
  { value: 2,   label: '2 Pages/Day',   sub: 'Ambitious' },
  { value: 5,   label: '5 Pages/Day',   sub: 'Intensive' },
];

const INTENSITY_OPTIONS = [
  { value: 'light',    label: 'Light',    desc: 'Gentle pace, fewer reviews daily. Best for tight schedules.' },
  { value: 'standard', label: 'Standard', desc: 'Balanced retention. Recommended for steady progress.' },
  { value: 'strong',   label: 'Strong',   desc: 'Rigorous volume. Ideal for dedicated focus periods.' },
];

function computeSelectedPages(mode, selectedJuz, pageRanges) {
  const pages = new Set();
  if (mode === 'juz') {
    JUZ_RANGES.forEach(({ juz, start, end }) => {
      if (selectedJuz.has(juz)) {
        for (let p = start; p <= end; p++) pages.add(p);
      }
    });
  } else {
    pageRanges.forEach(({ start, end }) => {
      const s = parseInt(start, 10), e = parseInt(end, 10);
      if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 604 && s <= e) {
        for (let p = s; p <= e; p++) pages.add(p);
      }
    });
  }
  return Array.from(pages).sort((a, b) => a - b);
}

const ProgressBar = ({ step }) => (
  <div className="flex gap-1.5 mb-8">
    {[1, 2, 3, 4].map((s) => (
      <div
        key={s}
        className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${s <= step ? 'bg-[#1B4332]' : 'bg-gray-200'}`}
      />
    ))}
  </div>
);

export default function Onboarding() {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState('juz');
  const [selectedJuz, setSelectedJuz] = useState(new Set());
  const [pageRanges, setPageRanges] = useState([{ start: '', end: '' }]);
  const [dailyPages, setDailyPages] = useState(1);
  const [reviewIntensity, setReviewIntensity] = useState('standard');
  const [offDays, setOffDays] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedPages = computeSelectedPages(mode, selectedJuz, pageRanges);
  const selectedCount = selectedPages.length;

  // Compute estimate client-side (pages not yet in DB during onboarding)
  const activeDays = 7 - offDays.length;
  const effectiveDaily = dailyPages * (activeDays / 7);
  const remaining = 604 - selectedCount;
  const estimatedDays = effectiveDaily > 0 ? Math.ceil(remaining / effectiveDaily) : null;
  const estimatedMonths = estimatedDays ? Math.round(estimatedDays / 30) : null;
  const estimatedYears = estimatedDays ? parseFloat((estimatedDays / 365).toFixed(1)) : null;

  const toggleJuz = (n) => {
    setSelectedJuz(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const toggleOffDay = (d) => {
    setOffDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : prev.length < 2 ? [...prev, d] : prev
    );
  };

  const addRange = () => setPageRanges(r => [...r, { start: '', end: '' }]);
  const removeRange = (i) => setPageRanges(r => r.filter((_, idx) => idx !== i));
  const updateRange = (i, key, val) =>
    setPageRanges(r => r.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await progressAPI.completeOnboarding({ memorizedPages: selectedPages, dailyNewPages: dailyPages });
      await authAPI.updateProfile({ reviewIntensity, offDays });
      await refreshUser();
      navigate('/dashboard');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── STEP 1 ────────────────────────────────────────────
  if (step === 1) return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full p-8">
        <ProgressBar step={1} />
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-3xl">✨</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">Welcome to Your Hifz Journey! 🎉</h1>
          <p className="text-[#4A4A4A] leading-relaxed">
            Find tranquility in discipline. Let's set up a personalized memorization plan to build a lasting connection with the Quran.
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-[#1B4332] text-white py-3 rounded-lg font-semibold hover:bg-[#2D6A4F] transition-colors mt-4"
          >
            Let's Begin →
          </button>
        </div>
      </div>
    </div>
  );

  // ── STEP 2 ────────────────────────────────────────────
  if (step === 2) return (
    <div className="min-h-screen bg-[#FAF9F6] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-[#1B4332] flex items-center gap-2 text-lg"><span>📖</span> Quran Tracker</span>
          <span className="text-xs font-semibold text-[#4A4A4A] uppercase tracking-wide">Step 2 of 4</span>
        </div>
        <ProgressBar step={2} />

        {/* Section A — Already memorized */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">What have you already memorized?</h2>
          <p className="text-sm text-[#4A4A4A] mb-5">Select the portions you have completely memorized to establish your baseline.</p>

          {/* Tab toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5 w-fit">
            {['juz', 'range'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white text-[#1B4332] shadow-sm' : 'text-[#4A4A4A] hover:text-[#1B4332]'
                }`}
              >
                {m === 'juz' ? 'By Juz' : 'By Surah / Range'}
              </button>
            ))}
          </div>

          {mode === 'juz' ? (
            <div className="grid grid-cols-10 gap-1.5">
              {JUZ_RANGES.map(({ juz }) => (
                <button
                  key={juz}
                  onClick={() => toggleJuz(juz)}
                  className={`aspect-square rounded-lg text-sm font-semibold transition-colors ${
                    selectedJuz.has(juz)
                      ? 'bg-[#1B4332] text-white'
                      : 'bg-gray-100 text-[#4A4A4A] hover:bg-green-50 hover:text-[#1B4332]'
                  }`}
                >
                  {juz}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pageRanges.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number" min="1" max="604"
                    value={r.start}
                    onChange={e => updateRange(i, 'start', e.target.value)}
                    placeholder="Start page"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#40916C]"
                  />
                  <span className="text-[#4A4A4A] text-sm">to</span>
                  <input
                    type="number" min="1" max="604"
                    value={r.end}
                    onChange={e => updateRange(i, 'end', e.target.value)}
                    placeholder="End page"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#40916C]"
                  />
                  {pageRanges.length > 1 && (
                    <button onClick={() => removeRange(i)} className="text-gray-400 hover:text-[#E63946]">
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addRange} className="flex items-center gap-1.5 text-sm text-[#1B4332] font-medium hover:underline mt-1">
                <FiPlus className="w-4 h-4" /> Add another range
              </button>
            </div>
          )}

          {selectedCount > 0 && (
            <p className="text-xs text-[#40916C] font-medium mt-3">{selectedCount} pages selected</p>
          )}
        </div>

        {/* Section B — Daily goal */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">Set your daily goal</h2>
          <p className="text-sm text-[#4A4A4A] mb-5">Consistency is the key to Hifz. Choose a pace you can maintain comfortably every day.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DAILY_OPTIONS.map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => setDailyPages(value)}
                className={`rounded-xl p-4 text-center border-2 transition-colors ${
                  dailyPages === value
                    ? 'border-[#1B4332] bg-green-50'
                    : 'border-gray-100 hover:border-green-200'
                }`}
              >
                <p className={`text-sm font-bold ${dailyPages === value ? 'text-[#1B4332]' : 'text-[#1A1A1A]'}`}>{label}</p>
                <p className="text-xs text-[#4A4A4A] mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Estimate banner */}
        {estimatedYears && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⭐</span>
            <div>
              <p className="text-sm font-bold text-amber-800">Estimated Completion</p>
              <p className="text-sm text-amber-700 mt-0.5">
                At {dailyPages} page{dailyPages !== 1 ? 's' : ''}/day, you will complete the memorization of the Quran in approximately{' '}
                <strong>{estimatedYears} year{estimatedYears !== 1 ? 's' : ''}</strong>
                {estimatedMonths && estimatedMonths < 24 ? ` (${estimatedMonths} months)` : ''}.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-[#4A4A4A] hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(3)} className="bg-[#1B4332] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2D6A4F] transition-colors">Continue →</button>
        </div>
      </div>
    </div>
  );

  // ── STEP 3 ────────────────────────────────────────────
  if (step === 3) return (
    <div className="min-h-screen bg-[#FAF9F6] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-[#1B4332] flex items-center gap-2 text-lg"><span>📖</span> Quran Tracker</span>
          <span className="text-xs font-semibold text-[#4A4A4A] uppercase tracking-wide">Step 3 of 4</span>
        </div>
        <ProgressBar step={3} />

        <div className="text-center mb-8">
          <h2 className="text-2xl font-extrabold text-[#1A1A1A] mb-2">Customize Your Experience</h2>
          <p className="text-[#4A4A4A] text-sm">Set a sustainable rhythm for your memorization journey. You can always adjust this later.</p>
        </div>

        {/* Review Intensity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <h3 className="font-bold text-[#1A1A1A] mb-1 flex items-center gap-2">
            <span>🔍</span> Review Intensity
          </h3>
          <p className="text-xs text-[#4A4A4A] mb-4">How many pages per day do you want to review?</p>
          <div className="grid grid-cols-3 gap-3">
            {INTENSITY_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setReviewIntensity(value)}
                className={`rounded-xl p-4 text-left border-2 transition-colors relative ${
                  reviewIntensity === value
                    ? 'border-[#1B4332] bg-green-50'
                    : 'border-gray-100 hover:border-green-200'
                }`}
              >
                {reviewIntensity === value && (
                  <span className="absolute top-2 right-2 text-[#1B4332] text-xs">✓</span>
                )}
                <p className={`text-sm font-bold mb-1 ${reviewIntensity === value ? 'text-[#1B4332]' : 'text-[#1A1A1A]'}`}>{label}</p>
                <p className="text-xs text-[#4A4A4A] leading-relaxed">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Rest Days */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="font-bold text-[#1A1A1A] mb-1 flex items-center gap-2">
            <span>📅</span> Rest Days
          </h3>
          <p className="text-xs text-[#4A4A4A] mb-4">
            Select up to 2 days where no new memorization goals will be scheduled.
          </p>
          <div className="flex gap-2 justify-center">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleOffDay(i)}
                className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors ${
                  offDays.includes(i)
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-gray-100 text-[#4A4A4A] hover:bg-green-50 hover:text-[#1B4332]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {offDays.length === 2 && (
            <p className="text-xs text-amber-600 text-center mt-2">Maximum 2 rest days selected</p>
          )}
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(2)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-[#4A4A4A] hover:bg-gray-50">← Back</button>
          <button onClick={() => setStep(4)} className="bg-[#1B4332] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2D6A4F] transition-colors">Generate My Plan →</button>
        </div>
      </div>
    </div>
  );

  // ── STEP 4 ────────────────────────────────────────────
  const approxJuzMemorized = Math.round(selectedCount / 20.13);
  const offDayLabel = offDays.length > 0 ? offDays.map(d => DAY_NAMES[d]).join(', ') : 'None';

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6">
      <div className="max-w-2xl mx-auto">
        <ProgressBar step={4} />

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⭐</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#1A1A1A]">Your Plan is Ready! ✨</h1>
          <p className="text-sm text-[#4A4A4A] mt-2 max-w-md mx-auto">
            Based on your current progress and goals, we've structured a personalized path to help you achieve consistent memorization.
          </p>
        </div>

        {/* Summary top row */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#1B4332] rounded-2xl p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-300 mb-1">Estimated Completion</p>
            <p className="text-3xl font-extrabold">{estimatedMonths ?? '—'}</p>
            <p className="text-sm text-green-200">{estimatedMonths ? 'Months' : 'Already a Hafiz!'}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4A4A4A] mb-1">Target Goal</p>
            <p className="text-2xl font-extrabold text-[#1A1A1A]">Entire</p>
            <p className="text-sm text-[#4A4A4A]">Quran (604 pages)</p>
          </div>
        </div>

        {/* Summary bottom row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Already Memorized', value: `${approxJuzMemorized} Juz` },
            { label: 'Daily New',         value: `${dailyPages} Page${dailyPages !== 1 ? 's' : ''}` },
            { label: 'Review Intensity',  value: reviewIntensity.charAt(0).toUpperCase() + reviewIntensity.slice(1) },
            { label: 'Off Days',          value: offDayLabel },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-[#4A4A4A] mb-1">{label}</p>
              <p className="text-sm font-bold text-[#1B4332]">{value}</p>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h3 className="font-bold text-[#1A1A1A] mb-4">Tips for Success</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: '🌅', title: 'Start After Fajr', desc: 'The mind is clearest in the early hours.' },
              { icon: '📏', title: 'Consistency over Volume', desc: 'Memorizing half a page perfectly is better than two pages with poor retention.' },
              { icon: '🎧', title: 'Listen Frequently', desc: 'Play the verses you are currently memorizing repeatedly during your commute.' },
              { icon: '🌙', title: 'Revise Before Sleep', desc: 'Briefly read over what you memorized that day before bed.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 bg-[#FAF9F6] rounded-xl">
                <span className="text-xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{title}</p>
                  <p className="text-xs text-[#4A4A4A] mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={() => setStep(3)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-[#4A4A4A] hover:bg-gray-50">← Back</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#1B4332] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Start Memorizing →'}
          </button>
        </div>
      </div>
    </div>
  );
}
