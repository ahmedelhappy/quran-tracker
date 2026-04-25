import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

const Register = () => {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (form.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    const result = await register(form.name.trim(), form.email, form.password);
    setLoading(false);
    if (result.success) {
      navigate('/onboarding');
    } else {
      showToast(result.message || 'Registration failed', 'error');
    }
  };

  const Field = ({ label, icon: Icon, type, value, onChange, placeholder, rightEl }) => (
    <div>
      <label className="block text-xs font-semibold text-[#4A4A4A] uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#40916C] focus:ring-1 focus:ring-[#40916C] transition-colors"
        />
        {rightEl && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-[#1B4332] font-bold text-lg">
            <span className="text-2xl">📖</span> Quran Tracker
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌙</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1A1A1A]">Create Your Account</h1>
            <p className="text-[#4A4A4A] text-sm mt-1">Begin your Hifz journey today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Full Name"
              icon={FiUser}
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="John Doe"
            />
            <Field
              label="Email Address"
              icon={FiMail}
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              icon={FiLock}
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Min. 6 characters"
              rightEl={
                <button type="button" onClick={() => setShowPw(!showPw)} className="text-gray-400 hover:text-gray-600">
                  {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              }
            />
            <Field
              label="Confirm Password"
              icon={FiLock}
              type={showConfirm ? 'text' : 'password'}
              value={form.confirm}
              onChange={set('confirm')}
              placeholder="Repeat your password"
              rightEl={
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-600">
                  {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1B4332] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#2D6A4F] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-[#4A4A4A] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1B4332] font-semibold hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
