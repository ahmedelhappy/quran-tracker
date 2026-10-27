import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { AuthContext } from '../hooks/useAuth';
import i18n from '../i18n';
import { storage } from '../utils/safeStorage';

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
  // Why a stored token could not be checked: null, 'offline' or 'server'.
  const [sessionError, setSessionError] = useState(null);

  // Reconcile the account's saved language with this device's UI language.
  // A deliberate local choice (LanguageToggle sets 'langExplicit') always wins
  // — if it hasn't reached the profile yet (e.g. toggled while logged out, so
  // there was no account to save it to), push it up now instead of letting the
  // account's stale/default value silently pull the UI back on this refresh.
  // With no explicit local choice (a fresh device), adopt the account's saved
  // preference instead.
  const syncLanguage = useCallback((userData) => {
    const explicitLocalLang = storage.get('langExplicit') === '1' ? storage.get('lang') : null;
    if (explicitLocalLang) {
      if (userData.language !== explicitLocalLang) {
        authAPI.updateProfile({ language: explicitLocalLang }).catch(() => {});
      }
    } else if (userData.language && userData.language !== i18n.language) {
      i18n.changeLanguage(userData.language);
      storage.set('lang', userData.language);
    }
  }, []);

  // Verify the stored token and load the user.
  //
  // Only a 401 means the session is over. Anything else — no network, a 5xx
  // from a redeploy, a cold start that times out — says nothing about the
  // token, and dropping it there signed people out just for opening the app
  // offline (M-03). Then the token is KEPT and sessionError says why the user
  // could not be loaded ('offline' | 'server'): the routes show a retry screen
  // instead of the login page, and coming back online retries by itself.
  const checkAuth = useCallback(async () => {
    const token = storage.get('token');

    if (!token) {
      setSessionError(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getMe();
      const userData = response.data.data;
      setUser(userData);
      setSessionError(null);
      syncLanguage(userData);
    } catch (err) {
      if (err.response?.status === 401) {
        storage.remove('token');
        setUser(null);
        setSessionError(null);
      } else {
        console.error('Session check failed:', err.response?.status ?? err.code ?? err.message);
        // Only the browser knows it is offline; no answer while it reports a
        // connection (a timeout, a server that is down) is the server's side.
        const offline = !err.response && typeof navigator !== 'undefined' && navigator.onLine === false;
        setSessionError(offline ? 'offline' : 'server');
      }
    } finally {
      setLoading(false);
    }
  }, [syncLanguage]);

  // Check if user is logged in on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // The retry screen's button, and the automatic retry when the browser says
  // the connection is back.
  const retrySession = useCallback(() => checkAuth(), [checkAuth]);
  useEffect(() => {
    if (!sessionError) return;
    const onOnline = () => { retrySession(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sessionError, retrySession]);

  // Register new user
  const register = async (name, email, password) => {
    try {
      setError(null);
      const response = await authAPI.register({ name, email, password });

      const { token, ...userData } = response.data.data;

      storage.set('token', token);
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

      storage.set('token', token);
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
      storage.set('token', token);
      return { signedOut: false };
    }
    console.error('Password changed but the response carried no token; signing out');
    logout();
    return { signedOut: true };
  };

  // Logout user
  const logout = () => {
    storage.remove('token');
    setUser(null);
    setSessionError(null);
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
    sessionError,
    retrySession,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};