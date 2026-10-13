import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle } from 'react-icons/fi';

// A small yes/no dialog in the site's card style (the same surface, border,
// shadow and type as the other modals), with a round tinted icon badge: the
// app's red for a destructive action, its green otherwise. Pass `icon` to name
// what is at stake (a trash can, a bookmark…); a destructive dialog without one
// shows a warning sign.
//
// Keyboard-complete: focus lands on Cancel (the safe choice) when it opens, Tab
// stays inside it, Escape cancels, and focus goes back to whatever had it
// before. Keys never leak out to page-level shortcuts — the Library turns pages
// on the arrow keys, which must not fire behind a dialog.
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, isDanger = false, icon }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      // The dialog has unmounted by now, so focus fell to <body>. Hand it back to
      // the opener if it still exists and nothing else has claimed focus.
      if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        opener.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const Icon = icon ?? (isDanger ? FiAlertTriangle : null);

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Tab') {
      const buttons = dialogRef.current?.querySelectorAll('button');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="relative z-10 w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 p-6"
      >
        <div className="flex items-start gap-4">
          {Icon && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-red-50 text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-400'
                : 'bg-[#004f35]/10 text-[#004f35] dark:bg-emerald-900/40 dark:text-emerald-400'
            }`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-lg font-semibold text-[#003527] dark:text-gray-100">{title}</h3>
            {message && (
              <p id={messageId} className="mt-1.5 text-sm leading-relaxed text-[#404944] dark:text-gray-300 wrap-break-word">{message}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-sm font-medium text-[#404944] dark:text-gray-200 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
              isDanger ? 'bg-[#ba1a1a] hover:bg-[#93000a]' : 'bg-[#003527] hover:bg-[#064e3b]'
            }`}
          >
            {confirmText ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
