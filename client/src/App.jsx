import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Chatbot from './components/Chatbot';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Progress from './pages/Progress';
import Library from './pages/Library';

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
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
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
          <Routes>
            {/* Public routes */}
            <Route path="/"         element={<PublicRoute><Landing /></PublicRoute>} />
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
          <PersistentChatbot />
        </Router>
      </ToastProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
