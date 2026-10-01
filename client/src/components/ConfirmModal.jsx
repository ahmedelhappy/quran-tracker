import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// A small yes/no dialog. Keyboard-complete: focus lands on Cancel (the safe
// choice) when it opens, Tab stays inside it, Escape cancels, and focus goes back
// to whatever had it before. Keys never leak out to page-level shortcuts — the
// Library turns pages on the arrow keys, which must not fire behind a dialog.
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, isDanger = false }) => {
  const { t } = useTranslation();
  const titleId = useId();
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
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 z-10 border border-transparent dark:border-gray-700"
      >
        <h3 id={titleId} className="text-lg font-bold text-[#1A1A1A] dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-[#4A4A4A] dark:text-gray-300 text-sm leading-relaxed mb-6 break-words">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-[#4A4A4A] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-lg font-medium text-sm text-white transition-colors ${
              isDanger ? 'bg-[#E63946] hover:bg-red-700' : 'bg-[#1B4332] hover:bg-[#2D6A4F]'
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
