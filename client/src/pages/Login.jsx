import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import Footer from '../components/Footer';
import Logo from '../components/Logo';

const Login = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      showToast(result.message || 'Invalid email or password', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] dark:bg-gray-900 sacred-pattern flex flex-col">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 sacred-shadow relative overflow-hidden border border-transparent dark:border-gray-700">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#064e3b] via-[#004f35] to-[#064e3b]" />

            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-[#151c27] dark:text-gray-100 mb-1">Welcome Back</h2>
              <p className="text-[#404944] dark:text-gray-400">Continue your hifz journey today.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#404944] dark:text-gray-200 mb-1" htmlFor="email">Email</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404944] dark:text-gray-400" />
                  <input
                    id="email" type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com" required
                    className="w-full pl-10 pr-4 py-3 bg-[#f0f3ff] dark:bg-gray-700 border-transparent dark:border-gray-600 rounded-lg text-sm text-[#151c27] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#064e3b] transition-all dark:placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#404944] dark:text-gray-200 mb-1" htmlFor="password">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404944] dark:text-gray-400" />
                  <input
                    id="password" type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••" required
                    className="w-full pl-10 pr-10 py-3 bg-[#f0f3ff] dark:bg-gray-700 border-transparent dark:border-gray-600 rounded-lg text-sm text-[#151c27] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#064e3b] transition-all dark:placeholder:text-gray-500"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707974] dark:text-gray-400 hover:text-[#404944]">
                    {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={loading}
                  className="w-full bg-[#064e3b] text-white py-3 rounded-lg font-medium hover:bg-[#004f35] transition-colors disabled:opacity-60">
                  {loading ? 'Signing in…' : 'Log In'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[#404944] dark:text-gray-400">
                Don't have an account?{' '}
                <Link to="/register" className="font-medium text-[#064e3b] dark:text-emerald-400 hover:text-[#004f35] underline underline-offset-4 transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
