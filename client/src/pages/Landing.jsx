import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlay, FiCalendar, FiActivity, FiTrendingUp, FiZap, FiChevronDown } from 'react-icons/fi';
import Logo from '../components/Logo';

const CircleRing = ({ pct = 75, size = 88, stroke = 7 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#E8E8E8" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#40916C" strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="#1B4332" fontSize="16" fontWeight="700">
        {pct}%
      </text>
    </svg>
  );
};

const FAQ_ITEMS = [
  { q: 'Is Quran Tracker free to use?', a: 'Yes, completely free. All core features — personalized plans, spaced repetition reviews, and progress tracking — are available at no cost.' },
  { q: 'How does the smart review system work?', a: 'Pages are scheduled for revision based on how recently you memorized them. Newer pages appear more often, with intervals growing as your retention strengthens — grounded in the Ebbinghaus Forgetting Curve.' },
  { q: 'Can I track specific Surahs or page ranges?', a: 'Yes. During onboarding and in Settings you can select memorized content by Juz or by custom page ranges.' },
  { q: 'What happens if I miss a day?', a: 'No penalties. Your daily plan stays the same — missed review pages simply join the next cycle. Consistency matters more than perfection.' },
];

const LandingNavbar = ({ activeSection }) => {
  const navLinks = [
    { href: '#features', id: 'features', label: 'Features' },
    { href: '#how-it-works', id: 'how-it-works', label: 'How It Works' },
    { href: '#faq', id: 'faq', label: 'FAQ' },
  ];
  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo size="md" />
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A4A4A]">
          {navLinks.map(({ href, id, label }) => (
            <a
              key={id}
              href={href}
              className={`pb-0.5 transition-colors ${
                activeSection === id
                  ? 'text-[#1B4332] font-semibold border-b-2 border-[#40916C]'
                  : 'hover:text-[#1B4332]'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-[#4A4A4A] hover:text-[#1B4332] transition-colors">Login</Link>
          <Link to="/register" className="bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2D6A4F] transition-colors">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
};

const Landing = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    ['features', 'how-it-works', 'faq'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <LandingNavbar activeSection={activeSection} />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left copy */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
              ✨ Spiritual Productivity Reimagined
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-[#1A1A1A] leading-tight">
              Your Journey to Memorize the Quran{' '}
              <span className="text-[#1B4332]">Starts Here</span>
            </h1>
            <p className="text-[#4A4A4A] text-lg leading-relaxed">
              Transform your Hifz goals into daily habits. A serene, disciplined tracker that brings focus and peace to your memorization journey.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="bg-[#1B4332] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2D6A4F] transition-colors"
              >
                Start Memorizing Free →
              </Link>
              <a
                href="#how-it-works"
                className="bg-white border border-gray-200 text-[#1A1A1A] px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded-full bg-[#1B4332] flex items-center justify-center flex-shrink-0">
                  <FiPlay className="w-3 h-3 text-white ml-0.5" />
                </span>
                See How It Works
              </a>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex -space-x-2">
                {['#40916C', '#2D6A4F', '#E09F3E', '#1B4332', '#74C69D'].map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: c }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm text-[#4A4A4A]">
                Joined by <span className="font-semibold text-[#1B4332]">10,000+</span> students globally
              </span>
            </div>
          </div>

          {/* Right decorative cards */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-[#4A4A4A] font-medium uppercase tracking-wide mb-0.5">Current Goal</p>
                  <p className="text-xl font-bold text-[#1A1A1A]">Surah Al-Mulk</p>
                </div>
                <CircleRing pct={75} />
              </div>
              <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1B4332]">🔥 14 Day Streak</span>
                <span className="ml-auto text-xs text-[#40916C] font-medium">Keep it up!</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="arabic text-xl text-[#1A1A1A] text-center mb-3 leading-loose">
                تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ
              </p>
              <p className="text-sm text-[#4A4A4A] text-center italic mb-4">
                "Blessed is He in whose hand is dominion, and He is over all things competent."
              </p>
              <div className="flex justify-center gap-2">
                <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">Meccan</span>
                <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">30 Verses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-[#1A1A1A] mb-3">Designed for Deep Focus</h2>
            <p className="text-[#4A4A4A] text-lg max-w-xl mx-auto">
              Everything you need to memorize, review, and retain the Quran
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {/* 1 — Personalized Plans */}
            <div className="bg-[#FAF9F6] rounded-2xl p-6 border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <FiCalendar className="w-5 h-5 text-[#1B4332]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Personalized Plans</h3>
              <p className="text-[#4A4A4A] text-sm mb-4 leading-relaxed">
                Set your pace based on your schedule. Whether it's half a page or 5 pages a day.
              </p>
              <div className="flex gap-2">
                {['Today', 'Tomorrow', 'Day 3'].map((d) => (
                  <div key={d} className="flex-1 bg-white rounded-lg p-2.5 text-center border border-gray-100">
                    <p className="text-xs text-[#4A4A4A] mb-0.5">{d}</p>
                    <p className="text-xs font-semibold text-[#1B4332]">5 Ayahs</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2 — Smart Review */}
            <div className="bg-[#FAF9F6] rounded-2xl p-6 border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <FiActivity className="w-5 h-5 text-[#1B4332]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Smart Review</h3>
              <p className="text-[#4A4A4A] text-sm mb-4 leading-relaxed">
                Spaced repetition algorithms ensure you review right before you forget.
              </p>
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#4A4A4A]">Retention Strength</span>
                  <span className="font-semibold text-[#1B4332]">92%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#40916C] rounded-full" style={{ width: '92%' }} />
                </div>
              </div>
            </div>

            {/* 3 — Track Progress */}
            <div className="bg-[#FAF9F6] rounded-2xl p-6 border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <FiTrendingUp className="w-5 h-5 text-[#1B4332]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Track Progress</h3>
              <p className="text-[#4A4A4A] text-sm leading-relaxed">
                Visualize your journey through all 30 Juz. See exactly how much you've accomplished and how far you have to go.
              </p>
            </div>

            {/* 4 — Stay Motivated (light green card) */}
            <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <FiZap className="w-5 h-5 text-[#1B4332]" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Stay Motivated</h3>
              <p className="text-[#4A4A4A] text-sm mb-4 leading-relaxed">
                Build consistent habits with daily streaks, achievements, and gentle reminders.
              </p>
              <div className="space-y-2">
                <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 border border-green-100">
                  <span>🔥</span>
                  <span className="text-[#1B4332] text-sm font-medium">14 Day Streak</span>
                </div>
                <div className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 border border-green-100">
                  <span>⭐</span>
                  <span className="text-[#1B4332] text-sm font-medium">Juz 30 Completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="bg-[#1B4332] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '10k+', label: 'Active Students' },
              { value: '5M+',  label: 'Ayahs Memorized' },
              { value: '4.9/5', label: 'Average Rating' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-4xl font-extrabold text-white mb-1">{value}</p>
                <p className="text-green-300 text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-[#1A1A1A] mb-3">How It Works</h2>
          <p className="text-[#4A4A4A]">Get started in minutes and build a lasting Hifz habit</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            { step: '01', title: 'Create Your Profile', desc: "Register and tell us how much you've already memorized and how many pages per day you can commit to." },
            { step: '02', title: 'Get Your Daily Plan', desc: 'Each day we assign new pages to memorize and review old ones using spaced repetition.' },
            { step: '03', title: 'Track & Stay Consistent', desc: 'Check off tasks, maintain your streak, and watch your progress grow across all 30 Juz.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-14 h-14 bg-green-50 text-[#1B4332] rounded-2xl flex items-center justify-center text-xl font-extrabold mx-auto mb-4">
                {step}
              </div>
              <h3 className="font-bold text-[#1A1A1A] text-lg mb-2">{title}</h3>
              <p className="text-[#4A4A4A] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="bg-white py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-[#1A1A1A] text-center mb-10">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-[#1A1A1A] text-sm">{q}</span>
                  <FiChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-[#4A4A4A] leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#FAF9F6] border-t border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#4A4A4A]">
          <span>© 2025 Quran Tracker. Dedicated to the pursuit of Hifz.</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-[#1B4332] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#1B4332] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#1B4332] transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
