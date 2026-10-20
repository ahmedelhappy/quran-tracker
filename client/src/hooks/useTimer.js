import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';

// Kept apart from TimerContext.jsx so that file exports only its provider
// component (see useAuth.js for why). The context holds the one timer store
// (services/timerStore.js); its value never changes, so reading it re-renders
// nothing — each hook below subscribes to just the part it needs.
export const TimerContext = createContext(null);

export const useTimerStore = () => useContext(TimerContext);

// The persisted state (mode, stopwatch, countdown run). Changes on actions and
// on other tabs' writes — never on the tick.
export const useTimerState = () => {
  const store = useTimerStore();
  return useSyncExternalStore(store.subscribe, store.getState);
};

export const useTimerSettings = () => {
  const store = useTimerStore();
  return useSyncExternalStore(store.subscribe, store.getSettings);
};

// A value derived from the timer AND the clock, such as a readout's text.
// `read(state, settings, now)` must return a primitive: the component re-renders
// only when that value changes, so a display that shows whole seconds renders
// once a second however often the store ticks. `live: false` skips the tick for
// a display that is not running.
export const useTimerValue = (read, { live = true } = {}) => {
  const store = useTimerStore();
  return useSyncExternalStore(
    live ? store.subscribeLive : store.subscribe,
    () => read(store.getState(), store.getSettings(), store.getNow()),
  );
};

// Run `fn` on the timer's events: { type: 'phaseEnd' } in every tab when a focus
// period, a break or the whole countdown ends; { type: 'announce' } in the ONE
// tab that chimes for it. The latest `fn` is always the one called.
export const useTimerEvent = (fn) => {
  const store = useTimerStore();
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => store.onEvent((e) => ref.current(e)), [store]);
};
