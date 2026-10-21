import { useTranslation } from 'react-i18next';
import { FiClock } from 'react-icons/fi';
import Tooltip from './Tooltip';
import { useRecentRows } from '../hooks/useRecentPages';

// One compact row under the pager: the last few pages read, one tap each
// ("291 · 50 · 604"), and "More" for the whole list — which lives in the search
// box, where each entry can also be removed and the history cleared. Nothing is
// drawn while there is nothing recent. The page(s) on screen (`exclude`) are left
// out.
const MAX_CHIPS = 4;

export default function RecentPagesRow({ exclude, onPick, onMore }) {
  const { t } = useTranslation();
  const recent = useRecentRows(exclude);
  if (!recent.length) return null;
  // A spread's chip ("603–604") is twice as wide; one fewer keeps it one line.
  const max = recent.slice(0, MAX_CHIPS).some((r) => r.entry.pages.length > 1) ? MAX_CHIPS - 1 : MAX_CHIPS;
  const chip = 'shrink-0 h-7 px-2 rounded-lg border border-[#dce2f3] dark:border-gray-600 text-xs font-semibold transition-colors';
  return (
    <div role="group" aria-label={t('library.recent.chipsLabel')} data-testid="recent-row" className="flex items-center gap-1.5 min-w-0">
      <FiClock className="w-3.5 h-3.5 shrink-0 text-[#707974] dark:text-gray-500" aria-hidden="true" />
      {recent.slice(0, max).map((r) => (
        <Tooltip key={r.key} label={t('library.recent.chip', { label: r.label, surah: r.surah, ago: r.ago })}>
          <button
            type="button"
            onClick={() => onPick(r.entry)}
            data-recent={r.key}
            className={`${chip} text-[#1A1A1A] dark:text-gray-100 hover:bg-[#f0f4ff] dark:hover:bg-gray-700`}
          >
            {r.short}
          </button>
        </Tooltip>
      ))}
      <Tooltip label={t('library.recent.moreHint')}>
        <button
          type="button"
          onClick={onMore}
          data-testid="recent-more"
          aria-haspopup="dialog"
          className={`${chip} ms-auto text-[#004f35] dark:text-emerald-400 hover:bg-[#f0f4ff] dark:hover:bg-gray-700`}
        >
          {t('library.recent.more')}
        </button>
      </Tooltip>
    </div>
  );
}
