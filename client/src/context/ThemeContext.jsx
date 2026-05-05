import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      return;
    }

    if (theme === 'light') {
      root.classList.remove('dark');
      return;
    }

    // auto — follow system preference
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (dark) => {
      if (dark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    apply(mq.matches);
    const listener = (e) => apply(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
