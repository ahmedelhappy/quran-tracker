import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';
import { todoStoreFor } from '../services/todoStore';
import { serverBackend, localBackend } from '../services/todoBackends';

const WAITING = { items: [], status: 'loading', local: false };
const UNVERIFIED = { items: [], status: 'unverified', local: false };
const noSubscribe = () => () => {};
const waiting = () => WAITING;
const unverifiedSnapshot = () => UNVERIFIED;

// The to-do list for whoever is reading: the account's list (on the server)
// when signed in, this browser's guest list otherwise. This is the ONE place
// that looks at the session — the list's component just gets a store.
//
// While the session is still being checked (a saved token, /auth/me in flight)
// there is no store yet, so nothing is requested until we know whose list it
// is: a visitor never calls /api/todos (whose 401 would send them to /login).
//
// Nor is there one while a stored session could not be checked at all (no
// network, a 5xx — AuthContext's sessionError). That reader is signed in, not a
// guest: falling back to the guest list put their items into this browser's
// guest list, which outlives sign-out, instead of their account (M-03).
export function useTodos() {
  const { user, loading, sessionError } = useAuth();
  const userId = user?._id ?? user?.id;
  const unverified = !loading && !userId && !!sessionError;
  const owner = loading || unverified ? null : userId ? `user:${userId}` : 'guest';
  const store = owner ? todoStoreFor(owner, userId ? serverBackend : localBackend) : null;
  const snapshot = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    store ? store.getSnapshot : unverified ? unverifiedSnapshot : waiting,
  );
  useEffect(() => store?.activate(), [store]);
  return { ...snapshot, store };
}
