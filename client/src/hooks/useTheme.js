import { createContext, useContext } from 'react';

// Kept apart from ThemeContext.jsx so that file exports only its provider
// component (see useAuth.js for why).
export const ThemeContext = createContext(null);

// { theme: 'light' | 'dark' | 'auto', setTheme }
export const useTheme = () => useContext(ThemeContext);
