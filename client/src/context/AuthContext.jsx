import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { AuthContext } from '../hooks/useAuth';
import i18n from '../i18n';

// The context object and its useAuth() hook live in hooks/useAuth.js, so that
// this file exports only a component.

// The server's auth messages are English. Its two 429s are the ones a person
// can act on, so they are shown in the reader's language instead: the account's
// failed-login lock (code LOGIN_LOCKED) and the per-device attempt limit.
const tooManyMessage = (err) => {
  if (err.response?.status !== 429) return null;
  return i18n.t(err.response.data?.code === 'LOGIN_LOCKED' ? 'auth.loginLocked' : 'auth.tooManyAttempts');
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
      const message = tooManyMessage(err) || err.response?.data?.message || 'Registration failed';
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
      const message = tooManyMessage(err) || err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  // Change the password. The server revokes every token issued before the change
  // — this tab's included — and answers with a fresh one, which must replace the
  // stored token at once or the very next request would sign this tab out.
  // Errors propagate: the caller shows the server's reason. Resolves to
  // { signedOut }: true when the change went through but no fresh token came
  // back (an older server build, a body rewritten on the way), so the stored
  // token is already dead — sign out cleanly now rather than claim this session
  // stays signed in and bounce to the login page on the next request.
  const changePassword = async (currentPassword, newPassword) => {
    const response = await authAPI.changePassword({ currentPassword, newPassword });
    const token = response.data?.data?.token;
    if (token) {
      localStorage.setItem('token', token);
      return { signedOut: false };
    }
    console.error('Password changed but the response carried no token; signing out');
    logout();
    return { signedOut: true };
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
    changePassword,
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