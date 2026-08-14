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

// Redirect to login on 401
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
  resetProgress: () => API.delete('/progress/reset'),
  getTodayTasks: (params) => API.get('/progress/today', { params }),
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
};

export const chatAPI = {
  sendMessage: (messages) => API.post('/chat', { messages }),
};

export default API;