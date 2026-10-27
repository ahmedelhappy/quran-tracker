import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck, FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import Tooltip from './Tooltip';
import { RECITERS, RECITER_STYLES, getReciter } from '../services/quranApi';
import { storage } from '../utils/safeStorage';

const RECENTS_KEY = 'recentReciters';
const RECENTS_MAX = 4;
const MARGIN = 12;   // keep the panel this far from the viewport edges
const GAP = 8;       // between the trigger and the panel

// Search folds away what people don't type: case, Latin accents, hyphens and
// spaces ("al-afasy" finds "Alafasy"), and in Arabic the tashkeel, tatweel and the
// letter variants (أ إ آ ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي), so "عبدالباسط"
// finds "عبد الباسط" and "الشريم" finds "الشُّريم".
const fold = (s) => String(s ?? '')
  .normalize('NFD')
  .toLowerCase()
  .replace(/[̀-ًͯ-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^a-z0-9ء-ي]/g, '');

// The style is searchable too, in both languages ("mujawwad", "مجود").
const STYLE_WORDS = { murattal: 'murattal مرتل', mujawwad: 'mujawwad مجود', muallim: 'muallim teaching معلم تعليمي' };
const HAYSTACK = new Map(RECITERS.map((r) => [r.id, fold(`${r.nameEn} ${r.nameAr} ${r.aka ?? ''} ${STYLE_WORDS[r.style] ?? ''}`)]));

// A qari who appears in more than one style always shows which one, so two
// recordings never read as the same name.
const MULTI_STYLE = new Set(
  Object.entries(RECITERS.reduce((n, r) => ({ ...n, [r.nameEn]: (n[r.nameEn] ?? 0) + 1 }), {}))
    .filter(([, c]) => c > 1).map(([name]) => name),
);

const readRecents = () => {
  const ids = storage.getJSON(RECENTS_KEY, []);
  return Array.isArray(ids) ? ids.filter((id) => RECITERS.some((r) => r.id === id)).slice(0, RECENTS_MAX) : [];
};

// The reader's reciter picker: a button in the audio bar that opens a searchable
// list, grouped by style, with the reciters used lately on top.
//
// WHY NOT A <select>: with dozens of reciters a native list is a long scroll with
// no search, and it can't show the style groups or say which of two Husary
// recordings is which.
//
// KEYBOARD: focus stays in the search box the whole time (the listbox is driven
// through aria-activedescendant), so ↑/↓/Home/End move, Enter picks, Escape
// closes and hands focus back to the button. Because focus is in an INPUT, the
// reader's own shortcuts (arrows turn pages, letters pick tools) stand down on
// their own.
//
// WHERE: the panel is portalled to <body> with fixed positioning measured from the
// button — the bar's backdrop-blur would otherwise become the containing block —
// so it opens above the bar, aligned to the button's END edge, clamped inside the
// viewport at phone width. It carries data-keeps-selection, so using it never
// drops the verse the reader picked.
export default function ReciterPicker({ value, onChange, isArabic }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState(readRecents);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useId();

  const nameOf = useCallback((r) => (isArabic ? r.nameAr : r.nameEn), [isArabic]);
  const styleOf = useCallback((style) => t(`library.reciters.style.${style}`), [t]);
  const labelOf = useCallback(
    (r) => (MULTI_STYLE.has(r.nameEn) ? `${nameOf(r)} · ${styleOf(r.style)}` : nameOf(r)),
    [nameOf, styleOf],
  );
  const current = getReciter(value);

  // Groups in display order, each option once per group it appears in. The
  // flattened list is what the arrow keys walk.
  const { groups, flat } = useMemo(() => {
    const q = fold(query);
    const match = (r) => !q || HAYSTACK.get(r.id).includes(q);
    const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), isArabic ? 'ar' : 'en');
    const out = [];
    if (!q) {
      const recent = recents.map((id) => RECITERS.find((r) => r.id === id)).filter(Boolean);
      if (recent.length) out.push({ key: 'recent', label: t('library.reciters.recent'), items: recent, showStyle: true });
    }
    for (const style of RECITER_STYLES) {
      const items = RECITERS.filter((r) => r.style === style && match(r)).sort(byName);
      if (items.length) out.push({ key: style, label: styleOf(style), items, showStyle: false });
    }
    const flatList = [];
    for (const g of out) {
      g.items = g.items.map((r) => {
        const opt = { r, optId: `${uid}-${g.key}-${r.id}`, i: flatList.length };
        flatList.push(opt);
        return opt;
      });
    }
    return { groups: out, flat: flatList };
  }, [query, recents, nameOf, styleOf, isArabic, t, uid]);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const width = Math.min(340, vw - 2 * MARGIN);
    // The panel's END edge lines up with the button's: right in LTR, left in RTL.
    const left = Math.min(Math.max(isArabic ? b.left : b.right - width, MARGIN), vw - MARGIN - width);
    setPos({ left, width, bottom: window.innerHeight - b.top + GAP, maxHeight: Math.max(220, Math.min(460, b.top - GAP - MARGIN)) });
  }, [isArabic]);

  const close = useCallback((refocus) => {
    setOpen(false);
    setQuery('');
    if (refocus) btnRef.current?.focus();
  }, []);

  const openPanel = () => {
    const cur = flat.findIndex((f) => f.r.id === value);
    setActive(cur >= 0 ? cur : 0);
    place();
    setOpen(true);
  };

  // Measured on open (above); re-measured while open if the window moves under it.
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Typing straight away is the point on a keyboard; on a touch screen it would
  // throw the soft keyboard over the very list the reader came to scroll.
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Closes the way the reader's other menus do: a press anywhere else (capture
  // phase, never swallowed), or Escape — which it takes, so the same key doesn't
  // also clear the verse selection underneath.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  // Keep the active option in view as the arrows walk past the edge.
  useEffect(() => {
    if (!open) return;
    const id = flat[active]?.optId;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, flat]);

  const pick = (id) => {
    const next = [id, ...recents.filter((x) => x !== id)].slice(0, RECENTS_MAX);
    setRecents(next);
    storage.setJSON(RECENTS_KEY, next); // private mode: recents just don't persist
    if (id !== value) onChange(id);
    close(true);
  };

  const onKeyDown = (e) => {
    const n = flat.length;
    if (e.key === 'Tab') { close(false); return; }
    if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + n) % n); }
    else if (e.key === 'Home' && !query) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && !query) { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = flat[Math.min(active, n - 1)]; if (f) pick(f.r.id); }
  };

  const listId = `${uid}-list`;

  return (
    <>
      <Tooltip label={t('tooltips.reciter')} suppressed={open}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? close(false) : openPanel())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${t('tooltips.reciter')}: ${labelOf(current)}`}
          data-testid="reciter-picker"
          className="inline-flex items-center gap-1 max-w-45 rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 ps-2 pe-1.5 py-1.5 text-xs text-[#1A1A1A] dark:text-gray-100 hover:border-[#004f35] dark:hover:border-emerald-500 focus:outline-none focus-visible:border-[#004f35] dark:focus-visible:border-emerald-500 transition-colors"
        >
          <span className="truncate">{labelOf(current)}</span>
          <FiChevronDown className={`w-3.5 h-3.5 shrink-0 text-[#707974] dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </Tooltip>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          data-keeps-selection
          dir={isArabic ? 'rtl' : 'ltr'}
          style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
          className="z-50 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-[#dce2f3] dark:border-gray-600 shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-[#dce2f3] dark:border-gray-700">
            <div className="relative">
              <FiSearch className="absolute top-1/2 -translate-y-1/2 start-2.5 w-4 h-4 text-[#707974] dark:text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={flat[active]?.optId}
                aria-label={t('library.reciters.search')}
                placeholder={t('library.reciters.search')}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                autoComplete="off"
                spellCheck={false}
                data-testid="reciter-search"
                // 16px on phones: anything smaller makes iOS zoom the page on focus.
                className="w-full rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-[#f8faff] dark:bg-gray-700 ps-8 pe-8 py-2 text-base sm:text-sm text-[#1A1A1A] dark:text-gray-100 placeholder:text-[#707974] dark:placeholder:text-gray-400 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setActive(0); inputRef.current?.focus(); }}
                  aria-label={t('library.reciters.clear')}
                  className="absolute top-1/2 -translate-y-1/2 end-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[#707974] dark:text-gray-400 hover:bg-[#f0f4ff] dark:hover:bg-gray-600"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div id={listId} role="listbox" aria-label={t('tooltips.reciter')} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1">
            {flat.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-[#707974] dark:text-gray-400">
                {t('library.reciters.noMatch', { query })}
              </p>
            )}
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`${uid}-${g.key}-h`}>
                <p id={`${uid}-${g.key}-h`} className="sticky top-0 z-10 px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#40916C] dark:text-emerald-400 bg-white dark:bg-gray-800">
                  {g.label}
                </p>
                {g.items.map(({ r, optId, i }) => {
                  const selected = r.id === value;
                  const isActive = i === active;
                  return (
                    <div
                      key={r.id}
                      id={optId}
                      role="option"
                      aria-selected={selected}
                      data-reciter={r.id}
                      // Keep focus in the search box; the click still lands.
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(i); }}
                      onClick={() => pick(r.id)}
                      className={`mx-1 flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer text-sm ${
                        isActive ? 'bg-[#f0f4ff] dark:bg-gray-700' : ''
                      } ${selected ? 'text-[#003527] dark:text-emerald-300 font-semibold' : 'text-[#1A1A1A] dark:text-gray-100'}`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{nameOf(r)}</span>
                        {/* The other script underneath, so either spelling is recognisable.
                            <bdi> isolates its direction without flipping its alignment. */}
                        <span className="block truncate text-[11px] font-normal text-[#707974] dark:text-gray-400">
                          <bdi>{isArabic ? r.nameEn : r.nameAr}</bdi>
                        </span>
                      </span>
                      {g.showStyle && (
                        <span className="shrink-0 rounded-full bg-[#f0f4ff] dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-[#404944] dark:text-gray-300">
                          {styleOf(r.style)}
                        </span>
                      )}
                      <FiCheck className={`w-4 h-4 shrink-0 text-[#004f35] dark:text-emerald-400 ${selected ? '' : 'invisible'}`} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="px-3 py-2 border-t border-[#dce2f3] dark:border-gray-700 text-[11px] text-[#707974] dark:text-gray-400">
            {t('library.reciters.hafsNote')}
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
