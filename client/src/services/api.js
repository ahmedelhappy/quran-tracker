import axios from 'axios';

// Create axios instance
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Add token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
      if (hadToken) localStorage.removeItem('token');
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

// Progress API functions
export const progressAPI = {
  completeOnboarding: (data) => API.post('/progress/onboarding', data),
  updateMemorized: (data) => API.put('/progress/memorized', data),
  // { add?: [pages], remove?: [pages] } — touches only the named pages.
  changeMemorized: (data) => API.patch('/progress/memorized', data),
  resetProgress: () => API.delete('/progress/reset'),
  getTodayTasks: (params) => API.get('/progress/today', { params }),
  // The streak check-in for a rest day or a day with nothing left to do. The GET
  // above writes nothing, so every screen that shows today's plan sends this
  // after it (fire and forget — it never changes what is on screen).
  checkIn: (ignoreOffDay = false) =>
    API.post('/progress/checkin', ignoreOffDay ? { ignoreOffDay: true } : {}).catch(() => {}),
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