import { createContext, useContext, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: { bg: 'bg-[#1B4332]', icon: <FiCheckCircle className="w-4 h-4 flex-shrink-0" /> },
  error:   { bg: 'bg-[#E63946]', icon: <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> },
  info:    { bg: 'bg-blue-600',  icon: <FiInfo className="w-4 h-4 flex-shrink-0" /> },
};

const ToastItem = ({ id, message, type, onDismiss }) => {
  const s = STYLES[type] || STYLES.info;
  return (
    <div className={`${s.bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[260px] max-w-xs`}>
      {s.icon}
      <span className="flex-1 text-sm font-medium leading-snug">{message}</span>
      <button onClick={() => onDismiss(id)} className="text-white/70 hover:text-white ms-1 shrink-0">
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 end-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
