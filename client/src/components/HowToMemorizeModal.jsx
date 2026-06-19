import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiVolume2 } from 'react-icons/fi';

/**
 * A clean, readable modal that teaches a recommended 7-step method for
 * memorizing a single page. Content lives in i18n (`howTo.*`) so it stays
 * bilingual and in sync. The modal is dismissible (close button, backdrop
 * click, Escape) and inherits the document `dir`, so it reads correctly in
 * Arabic/RTL.
 *
 * It is reused in three places: an opt-in help control on the Dashboard, a
 * per-card "How to memorize this page" link, and a one-time auto-open right
 * after onboarding (gated by a localStorage flag on the Dashboard).
 */
export default function HowToMemorizeModal({ isOpen, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps = t('howTo.steps', { returnObjects: true });
  const stepList = Array.isArray(steps) ? steps : [];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('howTo.title')}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl sacred-shadow border border-[#dce2f3] dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-lg font-semibold text-[#003527] dark:text-gray-100">{t('howTo.title')}</h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Cross-page flow intro */}
          <div className="rounded-xl bg-[#f0fdf4] dark:bg-emerald-900/20 border border-green-100 dark:border-emerald-800/30 px-4 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#004f35]/10 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 text-[#004f35] dark:text-emerald-400 mt-0.5">
              <FiVolume2 className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm text-[#404944] dark:text-gray-300 leading-relaxed">{t('howTo.intro')}</p>
          </div>

          {/* 7-step method */}
          <ol className="space-y-4">
            {stepList.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#004f35]/10 dark:bg-emerald-900/40 text-[#004f35] dark:text-emerald-400 flex items-center justify-center shrink-0 text-sm font-bold mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#003527] dark:text-gray-100">{step.title}</p>
                  <p className="text-sm text-[#404944] dark:text-gray-400 leading-relaxed mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-[#dce2f3] dark:border-gray-700 px-6 py-4 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-[#003527] text-white rounded-lg hover:bg-[#064e3b] transition-colors"
          >
            {t('howTo.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
