import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSettings, FiGlobe, FiMoon, FiMenu, FiX, FiLogOut } from 'react-icons/fi';

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
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-[#1B4332] text-lg flex-shrink-0">
          <span className="text-2xl leading-none">📖</span>
          <span className="hidden sm:block">Quran Tracker</span>
        </Link>

        {/* Desktop centre links */}
        <div className="hidden md:flex items-center">
          {NAV_LINKS.map((link) =>
            link.disabled ? (
              <span key={link.label} className="px-4 py-2 text-sm text-gray-300 cursor-not-allowed select-none">
                {link.label}
              </span>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
                  isActive(link.to)
                    ? 'text-[#1B4332] bg-green-50'
                    : 'text-[#4A4A4A] hover:text-[#1B4332] hover:bg-green-50'
                }`}
              >
                {link.label}
                {isActive(link.to) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#1B4332] rounded-full" />
                )}
              </Link>
            )
          )}
        </div>

        {/* Desktop right icons */}
        <div className="hidden md:flex items-center gap-1">
          <button title="Language (coming soon)" className="p-2 text-gray-400 hover:text-[#1B4332] hover:bg-green-50 rounded-lg transition-colors">
            <FiGlobe className="w-4 h-4" />
          </button>
          <button title="Dark mode (coming soon)" className="p-2 text-gray-400 hover:text-[#1B4332] hover:bg-green-50 rounded-lg transition-colors">
            <FiMoon className="w-4 h-4" />
          </button>
          <Link
            to="/settings"
            title="Settings"
            className={`p-2 rounded-lg transition-colors ${
              isActive('/settings') ? 'text-[#1B4332] bg-green-50' : 'text-gray-400 hover:text-[#1B4332] hover:bg-green-50'
            }`}
          >
            <FiSettings className="w-4 h-4" />
          </Link>
          <div className="relative ml-2">
            <button
              onClick={() => setAvatarOpen(!avatarOpen)}
              className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-sm font-bold hover:bg-[#2D6A4F] transition-colors"
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </button>
            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAvatarOpen(false)} />
                <div className="absolute right-0 top-10 z-40 bg-white rounded-xl shadow-lg border border-gray-100 w-44 py-1 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-[#1A1A1A] truncate">{user?.name}</p>
                    <p className="text-xs text-[#4A4A4A] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#E63946] font-medium hover:bg-red-50 flex items-center gap-2"
                  >
                    <FiLogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[#1B4332] rounded-lg hover:bg-green-50"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map((link) =>
            link.disabled ? (
              <span key={link.label} className="px-4 py-2.5 text-sm text-gray-300 rounded-lg">
                {link.label}
              </span>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg ${
                  isActive(link.to) ? 'bg-green-50 text-[#1B4332]' : 'text-[#4A4A4A] hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 ${
              isActive('/settings') ? 'bg-green-50 text-[#1B4332]' : 'text-[#4A4A4A] hover:bg-gray-50'
            }`}
          >
            <FiSettings className="w-4 h-4" /> Settings
          </Link>
          <div className="border-t border-gray-100 mt-2 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-sm font-bold">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">{user?.name}</p>
                <p className="text-xs text-[#4A4A4A]">{user?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-[#E63946] font-medium">
              <FiLogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
