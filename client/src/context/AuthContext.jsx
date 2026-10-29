import { useState, useEffect, useCallback, useRef } from 'react';
import { authAPI, getSessionToken, setSessionToken, adoptSessionToken } from '../services/api';
import { AuthContext } from '../hooks/useAuth';
import i18n, { switchLanguage } from '../i18n';
import { storage, TOKEN_KEY, clearUserScopedStorage } from '../utils/safeStorage';
import { clearRecentPages } from '../services/recentPages';

// The context object and its useAuth() hook live in hooks/useAuth.js, so that
// this file exports only a component.

// The server's auth messages are English. Its two 429s are the ones a person
// can act on, so they are shown in the reader's language instead: the account's
// failed-login lock (code LOGIN_LOCKED) and the per-device attempt limit.
const tooManyMessage = (err) => {
  if (err.response?.status !== 429) return null;
  return i18n.t(err.response.data?.code === 'LOGIN_LOCKED' ? 'auth.loginLocked' : 'auth.tooManyAttempts');
};

// The token to check: what storage holds (this visit's start, or another tab's
// change), or — with storage blocked — the one this tab signed in with.
const currentToken = () => storage.get(TOKEN_KEY) ?? getSessionToken();

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
      // Remembers it on this device once its strings have loaded.
      switchLanguage(userData.language);
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
  //
  // `token` is the one to check — at start-up the stored token; after another
  // tab changed it, the new one. This tab keeps using the token it already has
  // until the check succeeds, and only then adopts the new one; when it belongs
  // to a different account the routes remount (see AccountScope in App.jsx),
  // so no screen goes on showing or saving the previous account's data (M-08).
  const checkSeqRef = useRef(0);
  const checkAuth = useCallback(async (token) => {
    const seq = ++checkSeqRef.current;

    if (!token) {
      adoptSessionToken(null);
      setUser(null);
      setSessionError(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getMe(token);
      if (seq !== checkSeqRef.current) return; // a newer check owns the outcome
      const userData = response.data.data;
      adoptSessionToken(token);
      setUser(userData);
      setSessionError(null);
      syncLanguage(userData);
    } catch (err) {
      if (seq !== checkSeqRef.current) return;
      if (err.response?.status === 401) {
        // The interceptor has already dropped the dead token from storage.
        adoptSessionToken(null);
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
    checkAuth(currentToken());
  }, [checkAuth]);

  // Another tab signed out, signed in, or got a fresh token. Signing out
  // follows at once; a new token is checked before this tab adopts it.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY && e.key !== null) return; // null: storage cleared
      if (e.storageArea && e.storageArea !== storage.area()) return;
      const stored = storage.get(TOKEN_KEY);
      if (stored === getSessionToken()) return;
      if (!stored) {
        checkSeqRef.current++; // any check still in flight is now moot
        adoptSessionToken(null);
        setUser(null);
        setSessionError(null);
        setLoading(false);
        return;
      }
      checkAuth(stored);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkAuth]);

  // The retry screen's button, and the automatic retries: when the browser says
  // the connection is back, and when the tab is shown again. 'online' never
  // fires for a server-side failure — and when the failed check was of a token
  // another tab stored (a sign-in as someone else), this tab is still signed in
  // as before, so no retry screen shows: without a retry on return it sat on
  // the old account indefinitely while storage held the new one.
  const retrySession = useCallback(() => checkAuth(currentToken()), [checkAuth]);
  useEffect(() => {
    if (!sessionError) return;
    const onOnline = () => { retrySession(); };
    const onShow = () => { if (document.visibilityState === 'visible') retrySession(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onShow);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onShow);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [sessionError, retrySession]);

  // Register new user
  const register = async (name, email, password) => {
    try {
      setError(null);
      const response = await authAPI.register({ name, email, password });

      const { token, ...userData } = response.data.data;

      checkSeqRef.current++; // a session check still in flight must not undo this
      setSessionToken(token);
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

      checkSeqRef.current++; // a session check still in flight must not undo this
      setSessionToken(token);
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
      setSessionToken(token);
      return { signedOut: false };
    }
    console.error('Password changed but the response carried no token; signing out');
    logout();
    return { signedOut: true };
  };

  // Logout user (also what account deletion ends with). Clears what this
  // browser kept about the person — their reading position and recent pages —
  // and keeps the device's settings; the list is in utils/safeStorage.js (L-06).
  const logout = () => {
    checkSeqRef.current++;
    setSessionToken(null);
    clearUserScopedStorage();
    clearRecentPages(); // also resets the list this tab holds in memory
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