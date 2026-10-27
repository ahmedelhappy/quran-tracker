import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { TimerProvider } from './context/TimerContext';
import ProtectedRoute from './components/ProtectedRoute';
import SessionUnavailable, { SessionNotice } from './components/SessionUnavailable';
import { safeReturnTo } from './utils/returnTo';
import Chatbot from './components/Chatbot';

// Pages are lazy-loaded so each route ships its own chunk — this keeps heavy,
// route-specific dependencies (Recharts on /progress, driver.js tours on
// /dashboard and /library) out of the initial bundle.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Settings = lazy(() => import('./pages/Settings'));
const Progress = lazy(() => import('./pages/Progress'));
const Library = lazy(() => import('./pages/Library'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const About = lazy(() => import('./pages/About'));

// Full-screen spinner, reused as the Suspense fallback while a route chunk loads
// and while auth state is resolving.
const PageLoader = () => (
  <div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-[#1B4332] dark:border-emerald-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Redirect to /onboarding if onboarding not complete
const DashboardWrapper = () => {
  const { user } = useAuth();
  if (user && !user.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Dashboard />;
};

// Redirect to /dashboard if onboarding already complete
const OnboardingWrapper = () => {
  const { user } = useAuth();
  if (user && user.onboardingComplete) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
};

const PersistentChatbot = () => {
  const { user } = useAuth();
  return user && user.onboardingComplete ? <Chatbot /> : null;
};

// A new page starts at its top. Only a change of PAGE counts: the reader moves
// around the Library with ?page=…, and yanking that back to the top on every turn
// would fight them. Instant, because this is a new page appearing, not a journey
// across the current one — and a smooth ride would be one more thing to wait for.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  return null;
};

// Everything under the router belongs to ONE account. When the signed-in user
// changes under a mounted page — another tab signed out and in as someone else —
// the pages remount instead of going on showing (and saving into the new
// session) the previous account's data (M-08). A fresh token for the same
// account (a password change in another tab) keeps the same key, and so does
// signing out: the pages already react to the user going away, and a remount
// there would let a page that is still on screen (the Library) store its state
// again right after sign-out cleared it.
//
// Nor does the FIRST account to appear: the session check resolving (or its
// retry succeeding) turns "no one yet" into the reader, and the public Library
// is already mounted by then — remounting it there threw away the audio, the
// open tafsir and the scroll the reader may already have. Only one account
// replacing a different one moves the key.
const AccountScope = ({ children }) => {
  const { user } = useAuth();
  const id = user?._id ?? null;
  const [scope, setScope] = useState({ id, generation: 0 });
  // Adjusted during render: no extra pass on screen.
  if (id && id !== scope.id) {
    setScope({ id, generation: scope.id ? scope.generation + 1 : scope.generation });
  }
  return <Fragment key={scope.generation}>{children}</Fragment>;
};

// Redirect authenticated users away from public pages — to wherever they were
// headed when they were asked to sign in, if that is a page of this app.
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading, sessionError } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <PageLoader />;
  // A stored session that could not be checked is still a session: don't show
  // the landing or login page as if the reader were signed out.
  if (!isAuthenticated && sessionError) return <SessionUnavailable />;
  if (isAuthenticated) return <Navigate to={safeReturnTo(params.get('returnTo')) ?? '/dashboard'} replace />;
  return children;
};

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
      {/* Above the router: the one timer outlives every route change. */}
      <TimerProvider>
        <Router>
          <ScrollToTop />
          <AccountScope>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/"         element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/about"    element={<><SessionNotice /><About /></>} />
              {/* The mushaf reads without an account: the reader, the recitation and
                  the tafsir are public, and everything that saves to an account is
                  hidden behind a sign-in nudge (see Library). */}
              <Route path="/library"  element={<><SessionNotice /><Library /></>} />
              <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingWrapper /></ProtectedRoute>} />
              <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/progress"  element={<ProtectedRoute><Progress /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <PersistentChatbot />
          </AccountScope>
        </Router>
      </TimerProvider>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
