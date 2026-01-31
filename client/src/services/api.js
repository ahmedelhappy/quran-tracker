import axios from 'axios';

// Create axios instance
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Add token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API functions
export const authAPI = {
  register: (data) => API.post('/auth/register', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
};

// Progress API functions
export const progressAPI = {
  completeOnboarding: (data) => API.post('/progress/onboarding', data),
  getTodayTasks: () => API.get('/progress/today'),
  markComplete: (data) => API.post('/progress/complete', data),
  getAllProgress: () => API.get('/progress/all'),
  getJuzProgress: () => API.get('/progress/juz'),
};

export default API;