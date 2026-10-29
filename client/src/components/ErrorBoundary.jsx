import { Component } from 'react';
import i18n from '../i18n';
import { reportError } from '../utils/reportError';

// Top-level error boundary. If a render error escapes the app, show a friendly,
// bilingual recovery screen instead of a blank white page. Error boundaries must
// be class components, so this reads translations from the i18n instance directly
// (not the useTranslation hook) with English fallbacks in case i18n hasn't loaded.
//
// Given a `fallback`, it is a local boundary instead: the fallback takes the
// place of the part that failed (e.g. a lazy chart whose chunk could not load,
// a crashed tafsir panel) and the rest of the page carries on (M-14). The
// fallback is an element, or a function given { error, reset } — `reset` draws
// the part again (after `onReset`, which can e.g. swap in a fresh lazy import).
// `name` says which part it was in the error report.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      source: 'error-boundary',
      region: this.props.name ?? (this.props.fallback ? 'part of the page' : 'app'),
      componentStack: info?.componentStack,
    });
  }

  reset() {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback({ error: this.state.error, reset: this.reset });
    if (fallback) return fallback;

    const t = (key, fallback) => i18n.t(key, { defaultValue: fallback });
    const isRtl = i18n.dir() === 'rtl';

    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900 flex items-center justify-center px-6"
      >
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-[#e5e7eb] dark:border-gray-700 p-8">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <h1 className="text-xl font-semibold text-[#151c27] dark:text-gray-100 mb-2">
            {t('errorBoundary.title', 'Something went wrong')}
          </h1>
          <p className="text-sm text-[#404944] dark:text-gray-400 mb-6 leading-relaxed">
            {t('errorBoundary.message', 'An unexpected error occurred. Reloading the page usually fixes it.')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center bg-[#1B4332] hover:bg-[#064e3b] text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {t('errorBoundary.reload', 'Reload page')}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
