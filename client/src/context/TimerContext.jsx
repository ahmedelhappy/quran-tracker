import { useState, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerContext } from '../hooks/useTimer';
import { createTimerStore } from '../services/timerStore';
import { playChime, unlockChime, chimeUnlocked } from '../services/chime';
import { toArabicDigits } from '../utils/formatNumber';
import { liveReadout } from '../utils/timerCore';

// What a phase end says, aloud and in a notification.
const phaseMessageKey = (e) => (e.done ? 'timer.ended.done' : e.kind === 'focus' ? 'timer.ended.focus' : 'timer.ended.break');

// The tab-title prefix this provider last put there, so it can be swapped or
// taken off again without disturbing the rest of the title.
let titlePrefix = '';
const setTitlePrefix = (prefix) => {
  const base = titlePrefix && document.title.startsWith(titlePrefix)
    ? document.title.slice(titlePrefix.length)
    : document.title;
  titlePrefix = prefix;
  document.title = prefix + base;
};

// The app-wide timer (see services/timerStore.js). Above the router, so the one
// timer outlives every route change — the Library and the Dashboard show the
// same run.
export function TimerProvider({ children }) {
  const { t, i18n } = useTranslation();
  const [store] = useState(createTimerStore);
  const [liveMessage, setLiveMessage] = useState('');
  const isArabic = i18n.language === 'ar';

  useEffect(() => store.attach(), [store]);

  // Every tab announces a phase end to its own screen reader; the ONE tab that
  // won the claim plays the chime, and notifies if the reader is elsewhere.
  useEffect(() => store.onEvent((e) => {
    const message = t(phaseMessageKey(e));
    if (e.type === 'phaseEnd') {
      // Cleared first so the same words twice in a row are still read out.
      setLiveMessage('');
      requestAnimationFrame(() => setLiveMessage(message));
      return;
    }
    if (e.type !== 'announce') return;
    if (e.settings.chime) playChime({ kind: e.done ? 'end' : 'phase', volume: e.settings.volume });
    if (e.settings.notify && document.visibilityState === 'hidden'
      && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(t('timer.notifyTitle'), { body: message, tag: 'quran-timer', icon: '/icon-192.png' });
        n.onclick = () => { window.focus(); n.close(); };
      } catch { /* some mobile browsers only notify from a service worker */ }
    }
  }), [store, t]);

  // After a reload the countdown is still running but the audio is locked again
  // (autoplay policy). The reader's next click or key press anywhere unlocks it,
  // so the end can still chime.
  const hasRun = useSyncExternalStore(store.subscribe, () => store.getState().timer.run != null);
  useEffect(() => {
    if (!hasRun || chimeUnlocked()) return undefined;
    const unlock = () => {
      unlockChime();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [hasRun]);

  // Optional: the running time at the front of the tab title.
  const wantsTitle = useSyncExternalStore(store.subscribe, () => store.getSettings().titleTime);
  const title = useSyncExternalStore(
    wantsTitle ? store.subscribeLive : store.subscribe,
    () => {
      if (!wantsTitle) return '';
      const r = liveReadout(store.getState(), store.getNow());
      if (!r) return '';
      return r.status === 'done' ? `⏰ ${t('timer.ended.short')}` : `${r.which === 'timer' ? '⏳' : '⏱'} ${isArabic ? toArabicDigits(r.text) : r.text}`;
    },
  );
  useEffect(() => { setTitlePrefix(title ? `${title} · ` : ''); }, [title]);
  useEffect(() => () => setTitlePrefix(''), []);

  return (
    <TimerContext.Provider value={store}>
      {children}
      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">{liveMessage}</div>
    </TimerContext.Provider>
  );
}
