import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSettings, FiGlobe, FiMoon, FiMenu, FiX, FiLogOut, FiUser } from 'react-icons/fi';
import Logo from './Logo';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/progress',  label: 'Progress' },
  { to: null,         label: 'Quran Library', disabled: true },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
    setAvatarOpen(false);
  };

  const isActive = (to) => to && location.pathname === to;

  return (
    <header className="bg-white fixed top-0 w-full z-50 border-b border-emerald-100/20 sacred-shadow">
      <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link to="/dashboard">
            <Logo size="md" />
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-6">
            {NAV_LINKS.map((link) =>
              link.disabled ? (
                <span key={link.label} className="text-emerald-800/40 font-medium cursor-not-allowed select-none text-sm">
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-medium pb-1 transition-colors duration-200 ${
                    isActive(link.to)
                      ? 'text-[#064e3b] font-semibold border-b-2 border-amber-500'
                      : 'text-emerald-800/60 hover:text-amber-600'
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Desktop right icons */}
        <div className="hidden md:flex items-center gap-4">
          <button title="Language" className="text-[#064e3b] hover:text-amber-600 transition-colors">
            <FiGlobe className="w-5 h-5" />
          </button>
          <button title="Dark mode" className="text-[#064e3b] hover:text-amber-600 transition-colors">
            <FiMoon className="w-5 h-5" />
          </button>
          <Link
            to="/settings"
            title="Settings"
            className={`transition-colors ${isActive('/settings') ? 'text-[#064e3b] border-b-2 border-amber-500 pb-1 font-semibold' : 'text-[#064e3b] hover:text-amber-600'}`}
          >
            <FiSettings className="w-5 h-5" />
          </Link>

          {/* Avatar with dropdown */}
          <div className="relative">
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-8 h-8 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-sm font-bold border-2 border-amber-500 hover:opacity-90 transition-opacity"
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
                <div className="absolute right-0 top-10 z-40 bg-white rounded-lg sacred-shadow border border-[#dce2f3] w-48 py-1 overflow-hidden">
                  <Link
                    to="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="px-4 py-2 text-[#404944] hover:bg-[#dce2f3]/50 hover:text-[#003527] transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiUser className="w-4 h-4" /> Profile
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="px-4 py-2 text-[#404944] hover:bg-[#dce2f3]/50 hover:text-[#003527] transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiSettings className="w-4 h-4" /> Settings
                  </Link>
                  <hr className="my-1 border-[#dce2f3]/50" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-[#ba1a1a] hover:bg-red-50 transition-colors flex items-center gap-3 text-sm"
                  >
                    <FiLogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#064e3b] hover:text-amber-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#dce2f3]/50 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) =>
            link.disabled ? (
              <span key={link.label} className="px-4 py-2.5 text-sm text-emerald-800/40">{link.label}</span>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg ${
                  isActive(link.to) ? 'text-[#064e3b] bg-emerald-50' : 'text-emerald-800/60'
                }`}
              >
                {link.label}
              </Link>
            )
          )}
          <Link to="/settings" onClick={() => setMobileOpen(false)} className="px-4 py-2.5 text-sm font-medium text-emerald-800/60 rounded-lg flex items-center gap-2">
            <FiSettings className="w-4 h-4" /> Settings
          </Link>
          <div className="border-t border-[#dce2f3]/50 mt-2 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#064e3b] text-white flex items-center justify-center text-sm font-bold border-2 border-amber-500">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="text-sm font-medium text-[#151c27]">{user?.name}</p>
                <p className="text-xs text-[#404944]">{user?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-[#ba1a1a] text-sm font-medium flex items-center gap-1.5">
              <FiLogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
