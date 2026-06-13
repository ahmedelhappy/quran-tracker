import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Footer from '../components/Footer';
import Logo from '../components/Logo';
import LanguageToggle from '../components/LanguageToggle';

const Register = () => {
  const { register } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { showToast(t('auth.passwordsMismatch'), 'error'); return; }
    if (form.password.length < 6) { showToast(t('auth.passwordTooShort'), 'error'); return; }
    setLoading(true);
    const result = await register(form.name.trim(), form.email, form.password);
    setLoading(false);
    if (result.success) navigate('/onboarding');
    else showToast(result.message || t('auth.registrationFailed'), 'error');
  };

  const inputCls = 'w-full ps-11 pe-4 py-3 bg-[#f0f3ff] dark:bg-gray-700 border border-[#bfc9c3]/50 dark:border-gray-600 text-[#151c27] dark:text-white rounded-lg text-sm focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[#003527] focus:border-transparent transition-all placeholder:text-[#bfc9c3] dark:placeholder:text-gray-500';
  const labelCls = 'block text-xs font-medium text-[#404944] dark:text-gray-200 uppercase tracking-wider mb-1.5';

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_#e2e8f8_0%,_transparent_60%)] dark:bg-none opacity-40" />
      <div className="fixed inset-0 pointer-events-none sacred-pattern opacity-80" />
      <div className="absolute top-4 end-4 z-20">
        <LanguageToggle variant="icon" />
      </div>

      <main className="flex-grow flex items-center justify-center p-6 relative z-10 py-12">
        <div className="w-full max-w-[440px] bg-white dark:bg-gray-800 rounded-[24px] sacred-shadow p-8 md:p-10 border border-[#bfc9c3]/20 dark:border-gray-700 relative overflow-hidden">
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#064e3b] via-[#fe932c] to-[#064e3b] opacity-90" />

          {/* Header */}
          <div className="text-center mb-10 mt-2">
            <div className="flex justify-center mb-4">
              <Logo size="md" />
            </div>
            <h1 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-2 tracking-tight">{t('auth.createAccount')}</h1>
            <p className="text-[#404944] dark:text-gray-400">{t('auth.joinUs')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="fullName">{t('auth.fullName')}</label>
              <div className="relative group">
                <FiUser className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707974] group-focus-within:text-[#003527] dark:group-focus-within:text-emerald-400 transition-colors " />
                <input id="fullName" type="text" value={form.name} onChange={set('name')} placeholder={t('auth.namePlaceholder')} required className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="email">{t('auth.email')}</label>
              <div className="relative group">
                <FiMail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707974] group-focus-within:text-[#003527] dark:group-focus-within:text-emerald-400 transition-colors " />
                <input id="email" type="email" value={form.email} onChange={set('email')} placeholder={t('auth.emailPlaceholder')} required className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="password">{t('auth.password')}</label>
              <div className="relative group">
                <FiLock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707974] group-focus-within:text-[#003527] dark:group-focus-within:text-emerald-400 transition-colors " />
                <input id="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder={t('auth.passwordPlaceholder')} required className={inputCls + ' pe-10'} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[#707974] hover:text-[#404944]">
                  {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
              <div className="relative group">
                <FiLock className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707974] group-focus-within:text-[#003527] dark:group-focus-within:text-emerald-400 transition-colors " />
                <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} placeholder={t('auth.confirmPlaceholder')} required className={inputCls + ' pe-10'} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[#707974] hover:text-[#404944]">
                  {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#003527] text-white font-medium rounded-lg py-3.5 px-6 hover:bg-[#064e3b] active:scale-[0.98] transition-all duration-200 flex justify-center items-center gap-2 shadow-[0_2px_8px_rgba(0,53,39,0.2)] disabled:opacity-60"
              >
                <span>{loading ? t('auth.creating') : t('auth.createAccount')}</span>
                {!loading && <span className="text-base inline-block rtl:rotate-180">→</span>}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center border-t border-[#bfc9c3]/20 dark:border-gray-700 pt-6">
            <p className="text-[#404944] dark:text-gray-400">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="text-[#003527] dark:text-emerald-400 font-semibold hover:text-[#fe932c] underline underline-offset-4 decoration-[#003527]/30 transition-colors">
                {t('auth.loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Register;
