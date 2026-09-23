import { createContext, useContext } from 'react';

// The context object lives here, next to its hook, and not in AuthContext.jsx:
// that file exports only its provider COMPONENT, which is what React Fast Refresh
// needs to hot-swap it without losing state (a file that also exports a hook or
// an object makes every edit a full reload).
export const AuthContext = createContext(null);

// Read (or change) the logged-in user from any component under <AuthProvider>.
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
