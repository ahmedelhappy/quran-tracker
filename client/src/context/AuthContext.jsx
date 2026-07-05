import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import i18n from '../i18n';

// Create the context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reconcile the account's saved language with this device's UI language.
  // A deliberate local choice (LanguageToggle sets 'langExplicit') always wins
  // — if it hasn't reached the profile yet (e.g. toggled while logged out, so
  // there was no account to save it to), push it up now instead of letting the
  // account's stale/default value silently pull the UI back on this refresh.
  // With no explicit local choice (a fresh device), adopt the account's saved
  // preference instead.
  const syncLanguage = useCallback((userData) => {
    const explicitLocalLang = localStorage.getItem('langExplicit') === '1' ? localStorage.getItem('lang') : null;
    if (explicitLocalLang) {
      if (userData.language !== explicitLocalLang) {
        authAPI.updateProfile({ language: explicitLocalLang }).catch(() => {});
      }
    } else if (userData.language && userData.language !== i18n.language) {
      i18n.changeLanguage(userData.language);
      localStorage.setItem('lang', userData.language);
    }
  }, []);

  // Verify token and get user data
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getMe();
      const userData = response.data.data;
      setUser(userData);
      syncLanguage(userData);
    } catch (err) {
      console.log(err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [syncLanguage]);

  // Check if user is logged in on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Register new user
  const register = async (name, email, password) => {
    try {
      setError(null);
      const response = await authAPI.register({ name, email, password });

      const { token, ...userData } = response.data.data;

      localStorage.setItem('token', token);
      setUser(userData);
      syncLanguage(userData);

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  };

  // Login user
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });

      const { token, ...userData } = response.data.data;

      localStorage.setItem('token', token);
      setUser(userData);
      syncLanguage(userData);

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  // Logout user
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Update user data in context (used after profile updates)
  const updateUser = (updatedData) => {
    setUser(prev => ({
      ...prev,
      ...updatedData
    }));
  };

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.data);
    } catch (err) {
      console.log('Refresh user error:', err);
    }
  };

  // Clear error
  const clearError = () => setError(null);

  // Values to share with all components
  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateUser,
    refreshUser,
    clearError,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};