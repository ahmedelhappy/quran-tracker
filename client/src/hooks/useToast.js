import { createContext, useContext } from 'react';

// Kept apart from ToastContext.jsx so that file exports only its provider
// component (see useAuth.js for why).
export const ToastContext = createContext(null);

// { showToast(message, type = 'info', { action, duration }) } — type is
// 'success' | 'error' | 'info'; action = { label, onClick } adds a button
// (e.g. "Restore") and keeps the toast up longer.
export const useToast = () => useContext(ToastContext);
