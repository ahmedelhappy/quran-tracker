import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
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

// Redirect authenticated users away from public pages
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
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
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/"         element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/about"    element={<About />} />
              <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingWrapper /></ProtectedRoute>} />
              <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/progress"  element={<ProtectedRoute><Progress /></ProtectedRoute>} />
              <Route path="/library"   element={<ProtectedRoute><Library /></ProtectedRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <PersistentChatbot />
        </Router>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
