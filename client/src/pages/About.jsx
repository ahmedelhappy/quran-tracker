import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMoon, FiSun } from 'react-icons/fi';
import Logo from '../components/Logo';
import LanguageToggle from '../components/LanguageToggle';
import { useTheme } from '../context/ThemeContext';

const About = () => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const steps = [
    { num: '01', title: t('about.step1Title'), desc: t('about.step1Desc') },
    { num: '02', title: t('about.step2Title'), desc: t('about.step2Desc') },
    { num: '03', title: t('about.step3Title'), desc: t('about.step3Desc') },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex flex-col">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <LanguageToggle variant="icon" />
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              title={isDark ? t('nav.lightModeTitle') : t('nav.darkModeTitle')}
              aria-label={isDark ? t('nav.lightModeTitle') : t('nav.darkModeTitle')}
              className="p-2 rounded-lg cursor-pointer text-[#4A4A4A] dark:text-gray-400 hover:text-[#1B4332] dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-16">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1A1A1A] dark:text-gray-100 mb-3">{t('about.title')}</h1>
          <p className="text-[#4A4A4A] dark:text-gray-400 text-lg">{t('about.subtitle')}</p>
        </div>

        {/* Mission */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-[#1B4332] dark:text-emerald-400 mb-4">{t('about.missionTitle')}</h2>
          <p className="text-[#4A4A4A] dark:text-gray-300 leading-relaxed text-base">{t('about.missionText')}</p>
        </section>

        {/* Science & Tradition */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl p-8 mb-12 border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-[#1B4332] dark:text-emerald-400 mb-4">{t('about.scienceTitle')}</h2>
          <p className="text-[#4A4A4A] dark:text-gray-300 leading-relaxed text-base">{t('about.scienceText')}</p>
        </section>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-[#1B4332] dark:text-emerald-400 mb-6">{t('about.howItWorksTitle')}</h2>
          <div className="space-y-5">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-green-50 dark:bg-emerald-900/30 text-[#1B4332] dark:text-emerald-400 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0">
                  {num}
                </div>
                <div>
                  <h3 className="font-semibold text-[#1A1A1A] dark:text-gray-100 mb-1">{title}</h3>
                  <p className="text-sm text-[#4A4A4A] dark:text-gray-300 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Graduation Project */}
        <section className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-8 mb-12 border border-amber-100 dark:border-amber-800/30">
          <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400 mb-4">{t('about.projectTitle')}</h2>
          <p className="text-amber-900/80 dark:text-amber-300/80 leading-relaxed text-sm">{t('about.projectText')}</p>
        </section>

        {/* Contact */}
        <section className="text-center mb-12">
          <h2 className="text-xl font-bold text-[#1B4332] dark:text-emerald-400 mb-3">{t('about.contactTitle')}</h2>
          <p className="text-[#4A4A4A] dark:text-gray-300 mb-5">{t('about.contactText')}</p>
          <a
            href="mailto:ahmedelhappy@gmail.com"
            className="inline-flex items-center gap-2 bg-[#1B4332] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#2D6A4F] transition-colors"
          >
            {t('about.contactLink')}
          </a>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link to="/" className="text-sm text-[#1B4332] dark:text-emerald-400 hover:underline font-medium">
            {t('about.backHome')}
          </Link>
        </div>
      </main>

      <footer className="bg-[#FAF9F6] dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 py-6">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-[#4A4A4A] dark:text-gray-400">
          {t('landing.footer.copyright')}
        </div>
      </footer>
    </div>
  );
};

export default About;
