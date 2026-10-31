import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';
import { ToastContext } from '../hooks/useToast';

const STYLES = {
  success: { bg: 'bg-[#1B4332]', icon: <FiCheckCircle className="w-4 h-4 flex-shrink-0" /> },
  error:   { bg: 'bg-[#E63946]', icon: <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> },
  info:    { bg: 'bg-blue-600',  icon: <FiInfo className="w-4 h-4 flex-shrink-0" /> },
};

const DURATION = 4000;
// A toast with an action (e.g. "Restore") stays longer, so there's time to reach it.
const ACTION_DURATION = 10000;

const ToastItem = ({ id, message, type, action, duration, onDismiss }) => {
  const { t } = useTranslation();
  const s = STYLES[type] || STYLES.info;
  // The timer pauses while the toast is hovered or holds focus, so an action
  // button never vanishes from under the pointer or the keyboard.
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef(null);
  const start = useCallback(() => {
    clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onDismiss(id), remaining.current);
  }, [id, onDismiss]);
  const pause = () => {
    clearTimeout(timer.current);
    remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
  };
  useEffect(() => { start(); return () => clearTimeout(timer.current); }, [start]);

  return (
    <div
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) start(); }}
      className={`${s.bg} pointer-events-auto text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[260px] max-w-sm`}
    >
      {s.icon}
      <span className="flex-1 text-sm font-medium leading-snug">{message}</span>
      {action && (
        <button
          onClick={() => { onDismiss(id); action.onClick(); }}
          className="shrink-0 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1 text-sm font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
      <button onClick={() => onDismiss(id)} aria-label={t('common.close')} className="text-white/70 hover:text-white ms-1 shrink-0">
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  // showToast(message, type, { action: { label, onClick }, duration })
  const showToast = useCallback((message, type = 'info', { action, duration } = {}) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action, duration: duration ?? (action ? ACTION_DURATION : DURATION) }]);
  }, []);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* data-dialog-keep: a modal's inert sweep (useDialog) skips this region,
          so a toast raised while a dialog is up is still announced and clickable.

          Top centre, just under the navbar — never at the bottom, where every
          action that raises a toast lives: the onboarding "Start my journey"
          button (a 4-line error toast at the bottom end covered it at
          1280×720), the Settings save bar, the progress editor's footer, the
          Library audio bar and the chat panel. Centred, so it is the same in
          either direction, and full-width-with-margins on a phone (M-12,
          WCAG 2.4.11 Focus Not Obscured). */}
      <div data-dialog-keep className="fixed top-20 inset-x-0 px-4 z-[100] flex flex-col items-center pointer-events-none">
        {/* Two live regions in the one stack, both always present (a region
            that appears with its first message is often not announced): a
            failure interrupts (role="alert", assertive) so it is never lost
            behind other speech, and everything else waits its turn (M-12).
            Spacing is padding on each toast, not a gap, so an empty region
            takes no room. */}
        {[['alert', toasts.filter(t => t.type === 'error')], ['status', toasts.filter(t => t.type !== 'error')]].map(([role, list]) => (
          <div key={role} role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} className="flex flex-col items-center">
            {list.map(t => (
              <div key={t.id} className="pb-2">
                <ToastItem {...t} onDismiss={dismiss} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
