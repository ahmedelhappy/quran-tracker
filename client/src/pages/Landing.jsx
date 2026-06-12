import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlay, FiCalendar, FiActivity, FiTrendingUp, FiZap, FiChevronDown, FiMoon, FiSun } from 'react-icons/fi';
import Logo from '../components/Logo';
import LanguageToggle from '../components/LanguageToggle';
import { useTheme } from '../context/ThemeContext';

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

const LandingNavbar = ({ activeSection }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const navLinks = [
    { href: '#features', id: 'features', label: t('landing.navbar.features') },
    { href: '#how-it-works', id: 'how-it-works', label: t('landing.navbar.howItWorks') },
    { href: '#faq', id: 'faq', label: t('landing.navbar.faq') },
  ];
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo size="md" />
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A4A4A] dark:text-gray-400">
          {navLinks.map(({ href, id, label }) => (
            <a
              key={id}
              href={href}
              className={`pb-0.5 transition-colors ${
                activeSection === id
                  ? 'text-[#1B4332] dark:text-emerald-400 font-semibold border-b-2 border-[#40916C] dark:border-emerald-500'
                  : 'hover:text-[#1B4332] dark:hover:text-emerald-400'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle variant="icon" />
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? t('nav.lightModeTitle') : t('nav.darkModeTitle')}
            className="p-2 rounded-lg cursor-pointer text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
          </button>
          <Link to="/login" className="text-sm font-medium text-[#4A4A4A] dark:text-gray-200 hover:text-[#1B4332] dark:hover:text-white transition-colors">
            {t('landing.navbar.login')}
          </Link>
          <Link to="/register" className="bg-[#1B4332] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2D6A4F] transition-colors">
            {t('landing.navbar.getStarted')}
          </Link>
        </div>
      </div>
    </nav>
  );
};

const Landing = () => {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [activeSection, setActiveSection] = useState('');

  const faqItems = t('landing.faq.items', { returnObjects: true });
  const planDays = [t('landing.hero.planToday'), t('landing.hero.planTomorrow'), t('landing.hero.planDay3')];
  const statsItems = [
    { value: '10k+', label: t('landing.stats.students') },
    { value: '5M+',  label: t('landing.stats.ayahs') },
    { value: '4.9/5', label: t('landing.stats.rating') },
  ];
  const howItWorksSteps = [
    { step: '01', title: t('landing.howItWorks.step1Title'), desc: t('landing.howItWorks.step1Desc') },
    { step: '02', title: t('landing.howItWorks.step2Title'), desc: t('landing.howItWorks.step2Desc') },
    { step: '03', title: t('landing.howItWorks.step3Title'), desc: t('landing.howItWorks.step3Desc') },
  ];

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
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900">
      <LandingNavbar activeSection={activeSection} />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left copy */}
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
              {t('landing.hero.badge')}
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-[#1A1A1A] dark:text-gray-100 leading-tight">
              {t('landing.hero.title')}{' '}
              <span className="text-[#1B4332] dark:text-emerald-400">{t('landing.hero.titleHighlight')}</span>
            </h1>
            <p className="text-[#4A4A4A] dark:text-gray-400 text-lg leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="bg-[#1B4332] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2D6A4F] transition-colors"
              >
                {t('landing.hero.cta')}
              </Link>
              <a
                href="#how-it-works"
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#1A1A1A] dark:text-gray-200 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span className="w-6 h-6 rounded-full bg-[#1B4332] flex items-center justify-center flex-shrink-0">
                  <FiPlay className="w-3 h-3 text-white ms-0.5" />
                </span>
                {t('landing.hero.seeHow')}
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
              <span className="text-sm text-[#4A4A4A] dark:text-gray-300">
                {t('landing.hero.joinedBy')}{' '}
                <span className="font-semibold text-[#1B4332] dark:text-emerald-400">{t('landing.hero.students')}</span>
                {' '}{t('landing.hero.studentsGlobal')}
              </span>
            </div>
          </div>

          {/* Right decorative cards */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-[#4A4A4A] font-medium uppercase tracking-wide mb-0.5">{t('landing.hero.cardGoalLabel')}</p>
                  <p className="text-xl font-bold text-[#1A1A1A]">{t('landing.hero.cardGoalTitle')}</p>
                </div>
                <CircleRing pct={75} />
              </div>
              <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1B4332]">{t('landing.hero.cardStreak')}</span>
                <span className="ms-auto text-xs text-[#40916C] font-medium">{t('landing.hero.cardKeepItUp')}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="arabic text-xl text-[#1A1A1A] text-center mb-3 leading-loose">
                تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ
              </p>
              <p className="text-sm text-[#4A4A4A] text-center italic mb-4">
                {t('landing.hero.cardVerseTranslation')}
              </p>
              <div className="flex justify-center gap-2">
                <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">{t('landing.hero.cardMeccan')}</span>
                <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">{t('landing.hero.cardVerses')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section id="features" className="bg-white dark:bg-gray-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">{t('landing.features.title')}</h2>
            <p className="text-[#4A4A4A] dark:text-gray-400 text-lg max-w-xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {/* 1 — Personalized Plans */}
            <div className="bg-[#FAF9F6] dark:bg-gray-700/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-600">
              <div className="w-10 h-10 bg-green-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
                <FiCalendar className="w-5 h-5 text-[#1B4332] dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{t('landing.features.personalizedTitle')}</h3>
              <p className="text-[#4A4A4A] dark:text-gray-300 text-sm mb-4 leading-relaxed">
                {t('landing.features.personalizedDesc')}
              </p>
              <div className="flex gap-2">
                {planDays.map((d) => (
                  <div key={d} className="flex-1 bg-white dark:bg-gray-700 rounded-lg p-2.5 text-center border border-gray-100 dark:border-gray-600">
                    <p className="text-xs text-[#4A4A4A] dark:text-gray-400 mb-0.5">{d}</p>
                    <p className="text-xs font-semibold text-[#1B4332] dark:text-emerald-400">5 Ayahs</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2 — Smart Review */}
            <div className="bg-[#FAF9F6] dark:bg-gray-700/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-600">
              <div className="w-10 h-10 bg-green-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
                <FiActivity className="w-5 h-5 text-[#1B4332] dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{t('landing.features.reviewTitle')}</h3>
              <p className="text-[#4A4A4A] dark:text-gray-300 text-sm mb-4 leading-relaxed">
                {t('landing.features.reviewDesc')}
              </p>
              <div className="bg-white dark:bg-gray-700 rounded-xl p-3 border border-gray-100 dark:border-gray-600">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#4A4A4A] dark:text-gray-300">{t('landing.features.reviewRetention')}</span>
                  <span className="font-semibold text-[#1B4332] dark:text-emerald-400">92%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full bg-[#40916C] rounded-full" style={{ width: '92%' }} />
                </div>
              </div>
            </div>

            {/* 3 — Track Progress */}
            <div className="bg-[#FAF9F6] dark:bg-gray-700/40 rounded-2xl p-6 border border-gray-100 dark:border-gray-600">
              <div className="w-10 h-10 bg-green-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
                <FiTrendingUp className="w-5 h-5 text-[#1B4332] dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{t('landing.features.progressTitle')}</h3>
              <p className="text-[#4A4A4A] dark:text-gray-300 text-sm leading-relaxed">
                {t('landing.features.progressDesc')}
              </p>
            </div>

            {/* 4 — Stay Motivated */}
            <div className="bg-green-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-green-100 dark:border-emerald-800/30">
              <div className="w-10 h-10 bg-green-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mb-4">
                <FiZap className="w-5 h-5 text-[#1B4332] dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{t('landing.features.motivateTitle')}</h3>
              <p className="text-[#4A4A4A] dark:text-gray-300 text-sm mb-4 leading-relaxed">
                {t('landing.features.motivateDesc')}
              </p>
              <div className="space-y-2">
                <div className="bg-white dark:bg-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 border border-green-100 dark:border-gray-600">
                  <span>🔥</span>
                  <span className="text-[#1B4332] dark:text-emerald-400 text-sm font-medium">{t('landing.features.streakBadge')}</span>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded-xl px-3 py-2 flex items-center gap-2 border border-green-100 dark:border-gray-600">
                  <span>⭐</span>
                  <span className="text-[#1B4332] dark:text-emerald-400 text-sm font-medium">{t('landing.features.juzBadge')}</span>
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
            {statsItems.map(({ value, label }) => (
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
          <h2 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">{t('landing.howItWorks.title')}</h2>
          <p className="text-[#4A4A4A] dark:text-gray-400">{t('landing.howItWorks.subtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {howItWorksSteps.map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-14 h-14 bg-green-50 dark:bg-emerald-900/30 text-[#1B4332] dark:text-emerald-400 rounded-2xl flex items-center justify-center text-xl font-extrabold mx-auto mb-4">
                {step}
              </div>
              <h3 className="font-bold text-[#1A1A1A] dark:text-gray-100 text-lg mb-2">{title}</h3>
              <p className="text-[#4A4A4A] dark:text-gray-300 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section id="faq" className="bg-white dark:bg-gray-800 py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-gray-100 text-center mb-10">{t('landing.faq.title')}</h2>
          <div className="space-y-3">
            {Array.isArray(faqItems) && faqItems.map(({ q, a }, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden dark:bg-gray-700/30">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between text-start gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-[#1A1A1A] dark:text-gray-200 text-sm">{q}</span>
                  <FiChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-[#4A4A4A] dark:text-gray-400 leading-relaxed">{a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-[#FAF9F6] dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#4A4A4A] dark:text-gray-400">
          <span>{t('landing.footer.copyright')}</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t('landing.footer.privacy')}</a>
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t('landing.footer.terms')}</a>
            <Link to="/about" className="hover:text-[#1B4332] transition-colors">{t('footer.about')}</Link>
            <a href="#" className="hover:text-[#1B4332] transition-colors">{t('landing.footer.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
