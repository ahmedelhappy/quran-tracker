import axios from 'axios';
import { storage, TOKEN_KEY } from '../utils/safeStorage';

// Create axios instance
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// The token THIS TAB's screens belong to — kept in memory, not read from storage
// on every request. localStorage is shared by every tab: when another tab signs
// in as someone else, the token there changes at once, while this tab is still
// showing (and saving) the first account's data. Reading storage per request
// sent those saves to the other account (M-08). AuthContext adopts a changed
// stored token only after checking whose it is, and resets the screens when
// the account is a different one.
let sessionToken = storage.get(TOKEN_KEY);
export const getSessionToken = () => sessionToken;
// This tab signed in (or got a fresh token): use it and persist it for the
// other tabs and the next visit.
export const setSessionToken = (token) => {
  sessionToken = token || null;
  if (sessionToken) storage.set(TOKEN_KEY, sessionToken);
  else storage.remove(TOKEN_KEY);
};
// Take on a token another tab already stored (or its removal) — memory only.
export const adoptSessionToken = (token) => { sessionToken = token || null; };
// A token turned out to be dead: forget it, here and in storage — but only if
// it is still the one there, so a fresh sign-in from another tab survives.
const dropToken = (token) => {
  if (sessionToken === token) sessionToken = null;
  if (storage.get(TOKEN_KEY) === token) storage.remove(TOKEN_KEY);
};
const tokenOf = (config) => config?.headers?.Authorization?.replace(/^Bearer /, '') || null;

// Add token to every request automatically (a caller that sets its own header —
// the cross-tab session check — keeps it).
API.interceptors.request.use((config) => {
  if (sessionToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

// A session that expired mid-use: drop the dead token and send the reader to the
// login page — with where they were, so signing in brings them back.
//
// Two 401s must NOT do that, now that some pages are public (the Library):
//   - a request made with NO token at all. That is a visitor, and bouncing them
//     off a public page they are allowed to read would be wrong.
//   - the startup session check. AuthContext handles that failure itself by
//     dropping the stale token, and protected pages redirect through
//     ProtectedRoute — a visitor with a stale token just carries on reading.
// And a 401 for a token this tab has already let go of (another tab signed in
// meanwhile) says nothing about the current session, so it is left alone.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const sent = tokenOf(error.config);
      const current = !!sent && sent === sessionToken;
      const isSessionCheck = error.config?.url === '/auth/me';
      if (sent) dropToken(sent);
      if (current && !isSessionCheck) {
        const here = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(here)}`;
      }
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  // Bounded, so a server that never answers ends in AuthContext's retry screen
  // rather than an endless spinner.
  // `token` checks a token this tab has not adopted yet (one another tab stored).
  getMe: (token) => API.get('/auth/me', {
    timeout: 20000,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  }),
  updateProfile: (data) => API.put('/auth/profile', data),
  changePassword: (data) => API.put('/auth/password', data),
  deleteAccount: () => API.delete('/auth/account'),
};

// The streak check-in for a rest day or a day with nothing left to do. Nothing
// on screen waits for it, but a lost one is invisible until the streak resets on
// the next working day — when the dashboard used to tick inside its own GET, a
// loaded dashboard meant a counted day. So a failure that may be passing (no
// response, or a 5xx) is retried once shortly after, then once more when the tab
// is next shown, and only for the same UTC day the plan was loaded on. A 4xx is
// not retried: the same request would fail the same way (and a 401 already
// sends the reader to sign in).
const CHECKIN_RETRY_MS = 5000;
const utcDay = () => new Date().toISOString().slice(0, 10);
const isTransient = (err) => !err?.response || err.response.status >= 500;
let checkInOnShow = null; // the one pending "retry when shown" listener

const checkIn = (ignoreOffDay = false) => {
  const day = utcDay();
  const send = () => API.post('/progress/checkin', ignoreOffDay ? { ignoreOffDay: true } : {});
  const report = (err) => console.error('Streak check-in failed:', err?.response?.status ?? '', err?.message ?? err);
  return send()
    .catch((err) => {
      if (!isTransient(err)) throw err;
      return new Promise((resolve) => setTimeout(resolve, CHECKIN_RETRY_MS)).then(send);
    })
    .catch((err) => {
      report(err);
      if (!isTransient(err) || typeof document === 'undefined') return;
      if (checkInOnShow) document.removeEventListener('visibilitychange', checkInOnShow);
      checkInOnShow = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', checkInOnShow);
        checkInOnShow = null;
        if (utcDay() === day) send().catch(report);
      };
      document.addEventListener('visibilitychange', checkInOnShow);
    });
};

// Progress API functions
export const progressAPI = {
  completeOnboarding: (data) => API.post('/progress/onboarding', data),
  // { add?: [pages], remove?: [pages] } — touches only the named pages. Every
  // editor saves through this (and the units endpoint) as a delta of what it
  // loaded; the whole-set replace (PUT) is no longer called from the client.
  changeMemorized: (data) => API.patch('/progress/memorized', data),
  resetProgress: () => API.delete('/progress/reset'),
  getTodayTasks: (params) => API.get('/progress/today', { params }),
  // The GET above writes nothing, so every screen that shows today's plan sends
  // this after it (it never changes what is on screen, and never rejects; see
  // checkIn above for how a failure is retried).
  checkIn,
  markComplete: (data) => API.post('/progress/complete', data),
  uncomplete: (data) => API.post('/progress/uncomplete', data),
  getAllProgress: () => API.get('/progress/all'),
  getJuzProgress: () => API.get('/progress/juz'),
  getEstimate: (dailyPages) => API.get(`/progress/estimate${dailyPages != null ? `?dailyPages=${dailyPages}` : ''}`),
  getWeekPlan: () => API.get('/progress/week'),
  updateUnits: (data) => API.put('/progress/units', data),
};

// Page bookmarks (account-saved, multiple per user)
export const bookmarksAPI = {
  list: () => API.get('/bookmarks'),
  add: (data) => API.post('/bookmarks', data),
  // { label?, pageNumber?, replace? } — rename and/or move; replace takes over an occupied page.
  update: (id, data) => API.put(`/bookmarks/${id}`, data),
  remove: (id) => API.delete(`/bookmarks/${id}`),
};

// Mushaf annotations (highlights, notes, hard flags — account-saved, anchored to
// verse keys). listForPage powers the reader; listByKind('hard') the hard list.
export const annotationsAPI = {
  listForPage: (page) => API.get('/annotations', { params: { page } }),
  listByKind: (kind) => API.get('/annotations', { params: { kind } }),
  getSummary: () => API.get('/annotations/summary'),
  create: (data) => API.post('/annotations', data),
  update: (id, data) => API.put(`/annotations/${id}`, data),
  remove: (id) => API.delete(`/annotations/${id}`),
  // Upsert a page's free-form drawing (empty strokes deletes it).
  saveDrawing: (data) => API.put('/annotations/drawing', data),
  // The same save while the page is being closed: a keepalive fetch, which the
  // browser completes after unload (an XHR would be cancelled). Fire and forget —
  // nothing is left to show the result to. Bodies are capped at 64 KB, the same
  // as a page's drawing.
  saveDrawingOnUnload: (data) => {
    if (!sessionToken) return;
    try {
      fetch(`${API.defaults.baseURL}/annotations/drawing`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify(data),
      }).catch(() => {});
    } catch { /* body over the keepalive limit: nothing more can be done */ }
  },
  // Set the state of many verse annotations at once, all-or-nothing. Each op is
  // { kind, pageNumber, verseKey, value }; the reply reports every key's state
  // before and after (span actions, and the reader's undo / redo).
  batch: (ops) => API.post('/annotations/batch', { ops }),
  // The highlights / notes / hard flags on pages from..to, in one request.
  listVerseRange: (from, to) => API.get('/annotations/verses', { params: { from, to } }),
};

// The personal to-do list ("My to-do" — not the daily plan's tasks). Signed-in
// only: a visitor's list lives in localStorage (services/todoBackends.js), so a
// logged-out page never calls these.
export const todosAPI = {
  list: () => API.get('/todos'),
  add: (text) => API.post('/todos', { text }),
  // { text?, done? }
  update: (id, data) => API.put(`/todos/${id}`, data),
  remove: (id) => API.delete(`/todos/${id}`),
  // The whole list's ids in the new order.
  reorder: (ids) => API.put('/todos/reorder', { ids }),
  // Removes every ticked item; replies { data: kept, removed: [{ text, done, index }] }.
  clearCompleted: () => API.delete('/todos/completed'),
  // Puts removed items back at their index; replies { data: list, created }.
  restore: (items) => API.post('/todos/restore', { items }),
};

// Opt-in leaderboard (weekly / all-time). period is 'week' | 'all'.
export const leaderboardAPI = {
  get: (period) => API.get('/leaderboard', { params: { period } }),
};

export const chatAPI = {
  sendMessage: (messages) => API.post('/chat', { messages }),
};

export default API;