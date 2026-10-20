import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FiChevronDown } from 'react-icons/fi';

// The reader sidebar's tools row: ONE collapsible line for small session tools.
// Collapsed, it is a single line — the active tool's name and a live summary
// (the running time, for the timer). Open, it shows that tool.
//
// It takes a LIST of tools, each a tab here — "Timer | My to-do" — instead of
// another row in an already long column. With a single tool there is nothing
// to switch, and the tab strip is not drawn.
//
// `tools`: [{ id, label, icon: Component, summary: node, content: node,
// backgroundSummary?: node }] — `backgroundSummary` stays on the line while
// ANOTHER tab is chosen (the timer's, only while a time is running or has just
// ended, so switching to the list never hides a countdown).
// `open` and `activeId` are the caller's (persisted there), so other controls
// can open the row on a given tool.
export default function ReaderTools({ tools, open, onOpenChange, activeId, onActiveChange, id }) {
  const { t } = useTranslation();
  const bodyId = useId();
  const active = tools.find((tool) => tool.id === activeId) ?? tools[0];
  const Icon = active.icon;

  return (
    <div id={id} className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex items-center justify-between gap-2 text-start group"
      >
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500 group-hover:text-[#404944] dark:group-hover:text-gray-300 transition-colors">
          <Icon className="w-3 h-3 text-[#004f35] dark:text-emerald-400" aria-hidden="true" />
          {tools.length > 1 ? t('library.tools.title') : active.label}
        </span>
        <span className="inline-flex items-center gap-2.5 min-w-0">
          {tools.filter((tool) => tool !== active && tool.backgroundSummary).map((tool) => (
            <span key={tool.id} className="contents">{tool.backgroundSummary}</span>
          ))}
          {active.summary}
          <FiChevronDown className={`w-4 h-4 shrink-0 text-[#707974] dark:text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-3">
          {tools.length > 1 && (
            <div role="tablist" aria-label={t('library.tools.title')} className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-[#f0f4ff] dark:bg-gray-700/50 p-1">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  role="tab"
                  aria-selected={tool.id === active.id}
                  onClick={() => onActiveChange(tool.id)}
                  className={`text-xs font-semibold rounded-md px-2 py-1 transition-colors ${
                    tool.id === active.id
                      ? 'bg-white dark:bg-gray-800 text-[#003527] dark:text-gray-100 shadow-sm'
                      : 'text-[#707974] dark:text-gray-400 hover:text-[#404944] dark:hover:text-gray-200'
                  }`}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          )}
          <div role={tools.length > 1 ? 'tabpanel' : undefined}>{active.content}</div>
        </div>
      )}
    </div>
  );
}
