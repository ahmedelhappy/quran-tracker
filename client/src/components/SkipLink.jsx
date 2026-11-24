import { useTranslation } from 'react-i18next';

// The first thing Tab reaches on every page: a way past the navbar straight to
// the page's content (WCAG 2.4.1, M-12). Hidden until it has keyboard focus,
// then shown at the top start corner, in either direction.
//
// Every route renders exactly one <main id="main-content">, the link's target.
// Focus moves to it (not just the scroll position), so the next Tab continues
// from the content.
export default function SkipLink() {
  const { t } = useTranslation();
  const skip = (e) => {
    const main = document.getElementById('main-content');
    if (!main) return;
    e.preventDefault();
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  return (
    <a
      href="#main-content"
      onClick={skip}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold focus:bg-white focus:text-[#003527] focus:shadow-lg dark:focus:bg-gray-800 dark:focus:text-emerald-300"
    >
      {t('common.skipToContent')}
    </a>
  );
}
