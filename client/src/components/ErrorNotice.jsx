import { useTranslation } from 'react-i18next';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

// What a part of the page shows when its data could not be loaded, or when it
// crashed (see RegionFallback) — an honest "this failed" with a Retry, in place
// of a spinner that never stops or an empty list that reads as "you have none"
// (M-14). Two sizes:
//   block  — a section's worth: the Progress/Leaderboard error banner
//   inline — one line inside a small panel (a sidebar list, a toolbar)
// `onRetry` is optional: without it the notice only says what happened.
// `onDismiss` (block only) adds Close, for a notice standing in for a panel
// that floats over the page (the tafsir sheet, the search box).
export default function ErrorNotice({ message, onRetry, onDismiss, variant = 'block', className = '' }) {
  const { t } = useTranslation();
  const text = message ?? t('common.loadFailed');

  if (variant === 'inline') {
    return (
      <div role="alert" className={`flex items-center gap-2 text-xs text-red-700 dark:text-red-300 ${className}`}>
        <FiAlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">{text}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1 font-semibold text-[#004f35] dark:text-emerald-400 hover:underline"
          >
            <FiRefreshCw className="w-3 h-3" aria-hidden="true" />
            {t('common.retry')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <p className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-300">
        <FiAlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </p>
      {(onRetry || onDismiss) && (
        <div className="self-start sm:self-auto shrink-0 flex items-center gap-3">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm text-[#707974] dark:text-gray-400 hover:text-[#003527] dark:hover:text-gray-200 underline underline-offset-2"
            >
              {t('common.close')}
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#004f35] hover:bg-[#003527] dark:bg-emerald-700 dark:hover:bg-emerald-600 px-4 py-2 rounded-lg transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" aria-hidden="true" />
              {t('common.retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// What a local ErrorBoundary shows in place of one region of a page that
// crashed: that part failed, Retry draws it again, the rest carries on.
//   <ErrorBoundary name="tafsir" fallback={({ reset }) => <RegionFallback onRetry={reset} />}>
export function RegionFallback(props) {
  const { t } = useTranslation();
  return <ErrorNotice {...props} message={t('errorBoundary.region')} />;
}
