import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import SessionUnavailable from './SessionUnavailable';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, sessionError } = useAuth();
  const { t } = useTranslation();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Signed in, but the session could not be checked (offline, server down):
  // the login page would be a lie — offer a retry instead.
  if (!isAuthenticated && sessionError) return <SessionUnavailable />;

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Show the protected page
  return children;
};

export default ProtectedRoute;