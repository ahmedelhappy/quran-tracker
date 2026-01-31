import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';

// Wrapper to check onboarding status
const DashboardWrapper = () => {
  const { user } = useAuth();
  
  // If user hasn't completed onboarding, redirect to onboarding
  if (user && !user.onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <Dashboard />;
};

const OnboardingWrapper = () => {
  const { user } = useAuth();
  
  // If user already completed onboarding, redirect to dashboard
  if (user && user.onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Onboarding />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingWrapper />
              </ProtectedRoute>
            }
          />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 - Redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;