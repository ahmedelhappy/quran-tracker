import axios from 'axios';
import { storage } from '../utils/safeStorage';

// Create axios instance
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Add token to every request automatically
API.interceptors.request.use((config) => {
  const token = storage.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!error.config?.headers?.Authorization;
      const isSessionCheck = error.config?.url === '/auth/me';
      if (hadToken) storage.remove('token');
      if (hadToken && !isSessionCheck) {
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
  getMe: () => API.get('/auth/me'),
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
  updateMemorized: (data) => API.put('/progress/memorized', data),
  // { add?: [pages], remove?: [pages] } — touches only the named pages.
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