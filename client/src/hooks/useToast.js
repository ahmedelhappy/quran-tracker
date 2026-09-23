import { createContext, useContext } from 'react';

// Kept apart from ToastContext.jsx so that file exports only its provider
// component (see useAuth.js for why).
export const ToastContext = createContext(null);

// { showToast(message, type = 'info') } — type is 'success' | 'error' | 'info'.
export const useToast = () => useContext(ToastContext);
