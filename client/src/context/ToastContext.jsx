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
const ACTION_DURATION = 7000;

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
      className={`${s.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[260px] max-w-sm`}
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
      <div role="status" aria-live="polite" className="fixed bottom-6 end-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
