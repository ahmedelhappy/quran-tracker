import { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiX } from 'react-icons/fi';
import { LuGripVertical, LuListTodo } from 'react-icons/lu';
import { useTodos } from '../hooks/useTodos';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { MAX_TODO_TEXT } from '../services/todoBackends';
import { toArabicDigits } from '../utils/formatNumber';
import Tooltip from './Tooltip';

// "My to-do" — a personal list in the Library's sidebar (a tab beside the
// timer) and on the Dashboard: the SAME list in both (services/todoStore.js).
// Deliberately not called "tasks": on the Dashboard that word is the daily
// memorization plan, which this has nothing to do with.
//
// Add with Enter; tick with the checkbox; edit by double-clicking the text or
// with the pencil (Enter saves, Escape cancels); delete and "Clear completed"
// both offer Undo. Reorder by dragging the grip (mouse, pen or touch — the grip
// alone takes touch, so the rest of the row still scrolls the page), or from
// the keyboard: ↑ / ↓ on the grip, Alt+↑ / Alt+↓ anywhere in the row.
//
// Ticked items stay where they are: the order is the reader's own, and an item
// that jumped to the bottom on a tick would move out from under the pointer
// (and need a place to jump back to on an untick). "Clear completed" tidies up.
//
// variant 'sidebar' — grows with the list (the sidebar scrolls);
// 'card' — the Dashboard: a fixed height whatever the list holds or whether it
// has loaded yet, so the page never shifts under it.

const iconBtn = 'shrink-0 inline-flex items-center justify-center w-6 h-6 pointer-coarse:w-8 pointer-coarse:h-8 rounded-md text-[#707974] dark:text-gray-500 hover:text-[#004f35] dark:hover:text-emerald-400 hover:bg-[#f0f4ff] dark:hover:bg-gray-700 transition-colors';

export default function TodoList({ variant = 'sidebar' }) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { items, status, local, store } = useTodos();
  const { retrySession } = useAuth();
  const isArabic = i18n.language === 'ar';
  const num = (n) => (isArabic ? toArabicDigits(n) : String(n));
  const hintId = useId();
  const card = variant === 'card';
  // An item can be in either script whatever the UI language: each text box
  // takes its direction from its own text (so "(Ibn Kathir)" or an Arabic line
  // in the English UI orders correctly) but stays aligned to the UI's side.
  const textDir = { dir: 'auto', style: { textAlign: isArabic ? 'right' : 'left' } };

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null); // an item's key
  const [announcement, setAnnouncement] = useState('');
  const [drag, setDrag] = useState(null); // { key, from, to, dy, slot }
  const dragRef = useRef(null);
  const rowRefs = useRef(new Map());
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const failed = (e) => showToast(t(e?.code === 'TODO_LIMIT' ? 'todo.full' : 'todo.saveFailed'), 'error');

  // Put focus on an element once the list has re-rendered: back where it was
  // after a move (moving a focused node in the DOM can drop its focus), or onto
  // a control that only exists after this render. `find` runs then.
  const refocus = (find) => requestAnimationFrame(() => {
    const el = find();
    if (el?.isConnected && document.activeElement !== el) el.focus();
  });
  const rowControl = (key, attr) => rowRefs.current.get(key)?.querySelector(`[${attr}]`);

  const add = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !store) return;
    setDraft('');
    store.add(text).catch(failed);
  };

  const toggle = (item) => store.update(item._id, { done: !item.done }).catch(failed);

  const remove = (item, index) => {
    // Hand focus to a neighbour (or the input) before this row goes.
    const next = items[index + 1] ?? items[index - 1];
    refocus(() => (next ? rowControl(next.key ?? next._id, 'data-todo-delete') : inputRef.current));
    store.remove(item._id).then(() => {
      showToast(t('todo.removed'), 'success', {
        action: {
          label: t('todo.undo'),
          onClick: () => store.restore([{ _id: item._id, text: item.text, done: item.done, index }]).catch(failed),
        },
      });
    }).catch(failed);
  };

  const clearCompleted = () => {
    store.clearCompleted().then(({ removed }) => {
      if (!removed.length) return;
      showToast(t('todo.cleared', { count: removed.length, n: num(removed.length) }), 'success', {
        action: { label: t('todo.undo'), onClick: () => store.restore(removed).catch(failed) },
      });
    }).catch(failed);
  };

  // `keepFocus`: finished from the keyboard (Enter / Escape), so focus goes back
  // to the row's pencil; leaving the field by clicking elsewhere keeps that click's focus.
  const endEdit = (item, text, keepFocus) => {
    const key = item.key ?? item._id;
    setEditing(null);
    if (keepFocus) refocus(() => rowControl(key, 'data-todo-edit'));
    const clean = text?.trim();
    if (clean && clean !== item.text) store.update(item._id, { text: clean }).catch(failed);
  };

  const moveTo = (from, to) => {
    if (to < 0 || to >= items.length || to === from) return false;
    const ids = items.map((it) => it._id);
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    store.reorder(ids).catch(failed);
    setAnnouncement(t('todo.moved', { pos: num(to + 1), total: num(items.length) }));
    return true;
  };

  // ↑ / ↓ on the grip; Alt+↑ / Alt+↓ from anywhere in the row (but not while
  // editing the text, where Alt+arrows belong to the field).
  const onRowKeyDown = (e, index, onGrip) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!e.altKey && !onGrip) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    const focused = e.target;
    if (moveTo(index, index + (e.key === 'ArrowUp' ? -1 : 1))) refocus(() => focused);
  };

  // ── Pointer dragging (mouse, pen, touch) by the grip ──────────────────────
  // The grip captures the pointer, so the drag follows it even outside the
  // list. Rows are measured once at the start; the dragged row follows the
  // pointer and the rows it passes slide one slot the other way. Dropping
  // saves the new order; Escape or a cancelled pointer puts it back.
  const startDrag = (e, index, key) => {
    if (e.button !== 0 || items.length < 2 || editing != null) return;
    // No text selection or compatibility mouse events during the drag — which
    // also cancels the click's usual focus, so focus the grip by hand: the
    // arrow keys then carry on from where the pointer left off.
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rects = items.map((it) => rowRefs.current.get(it.key)?.getBoundingClientRect());
    if (rects.some((r) => !r)) return;
    const gap = rects[1].top - rects[0].bottom;
    const d = {
      key, from: index, to: index, dy: 0,
      slot: rects[index].height + gap,
      startY: e.clientY,
      pointerId: e.pointerId,
      mids: rects.map((r) => r.top + r.height / 2),
    };
    dragRef.current = d;
    setDrag({ key, from: index, to: index, dy: 0, slot: d.slot });
  };

  const moveDrag = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const last = d.mids.length - 1;
    // Keep the row within the list (half a slot past either end at most).
    const min = d.mids[0] - d.mids[d.from] - d.slot / 2;
    const max = d.mids[last] - d.mids[d.from] + d.slot / 2;
    const dy = Math.min(max, Math.max(min, e.clientY - d.startY));
    const center = d.mids[d.from] + dy;
    let to = d.from;
    for (let i = d.from + 1; i <= last; i++) if (center > d.mids[i]) to = i;
    for (let i = d.from - 1; i >= 0; i--) if (center < d.mids[i]) to = i;
    d.dy = dy;
    d.to = to;
    setDrag({ key: d.key, from: d.from, to, dy, slot: d.slot });
  };

  const endDrag = (commit) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    if (commit && d.to !== d.from) {
      const grip = rowControl(d.key, 'data-todo-grip');
      const hadFocus = grip && document.activeElement === grip;
      moveTo(d.from, d.to);
      if (hadFocus) refocus(() => grip);
    }
  };

  const dragging = drag != null;
  useEffect(() => {
    if (!dragging) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      endDrag(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // endDrag(false) only reads refs and a state setter, so the first one is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const shiftOf = (i) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.slot;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.slot;
    return 0;
  };

  const done = items.filter((it) => it.done).length;
  const left = items.length - done;
  const ready = status === 'ready' || items.length > 0;

  let body;
  if (status === 'unverified') {
    // Signed in, but the session could not be checked: the list is the
    // account's, so it waits for that check rather than showing the guest one.
    body = (
      <div className="flex flex-col items-start gap-2 py-2 text-xs text-[#707974] dark:text-gray-400">
        {t('todo.sessionUnverified')}
        <button type="button" onClick={() => retrySession()} className="font-semibold text-[#004f35] dark:text-emerald-400 hover:underline">
          {t('common.retry')}
        </button>
      </div>
    );
  } else if (!ready && status === 'error') {
    body = (
      <div className="flex flex-col items-start gap-2 py-2 text-xs text-[#707974] dark:text-gray-400">
        {t('todo.loadFailed')}
        <button type="button" onClick={() => store?.retry().catch(() => {})} className="font-semibold text-[#004f35] dark:text-emerald-400 hover:underline">
          {t('common.retry')}
        </button>
      </div>
    );
  } else if (!ready) {
    body = (
      <div className="flex flex-col gap-2 py-1" aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => <div key={i} className="h-5 rounded bg-[#eef1f8] dark:bg-gray-700/60 animate-pulse" />)}
      </div>
    );
  } else if (items.length === 0) {
    body = <p className="py-2 text-xs text-[#707974] dark:text-gray-500">{t('todo.empty')}</p>;
  } else {
    body = (
      <ul ref={listRef} aria-label={t('todo.listLabel')} className="flex flex-col gap-0.5" data-testid="todo-list">
        {items.map((item, index) => {
          const key = item.key ?? item._id;
          const textId = `${hintId}-t-${key}`;
          const dragged = drag?.key === key;
          const shift = shiftOf(index);
          return (
            <li
              key={key}
              ref={(el) => { if (el) rowRefs.current.set(key, el); else rowRefs.current.delete(key); }}
              onKeyDown={(e) => onRowKeyDown(e, index, false)}
              style={shift ? { transform: `translateY(${shift}px)` } : undefined}
              className={`group relative flex items-start gap-1 rounded-md py-0.5 pe-0.5 ${
                dragged
                  ? 'z-10 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-[#004f35]/25 dark:ring-emerald-500/30'
                  : drag ? 'transition-transform duration-150' : ''
              } ${item.pending ? 'opacity-70' : ''}`}
              data-todo-row={item.text}
            >
              <button
                type="button"
                data-todo-grip
                aria-label={t('todo.moveLabel', { text: item.text })}
                aria-describedby={`${hintId}-hint`}
                onPointerDown={(e) => startDrag(e, index, key)}
                onPointerMove={moveDrag}
                onPointerUp={() => endDrag(true)}
                onPointerCancel={() => endDrag(false)}
                onLostPointerCapture={() => endDrag(false)}
                onKeyDown={(e) => onRowKeyDown(e, index, true)}
                className={`${iconBtn} touch-none select-none ${dragged ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <LuGripVertical className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item)}
                aria-labelledby={textId}
                className="shrink-0 mt-1 w-4 h-4 rounded accent-[#004f35] dark:accent-emerald-500 cursor-pointer"
              />
              {editing === key ? (
                <EditField item={item} label={t('todo.editField')} textDir={textDir} onDone={(text, keepFocus) => endEdit(item, text, keepFocus)} />
              ) : (
                <span
                  id={textId}
                  {...textDir}
                  onDoubleClick={() => setEditing(key)}
                  className={`flex-1 min-w-0 px-0.5 py-0.5 text-sm leading-snug wrap-anywhere ${
                    item.done ? 'line-through text-[#a0a6ab] dark:text-gray-600' : 'text-[#253033] dark:text-gray-200'
                  }`}
                >
                  {item.text}
                </span>
              )}
              {editing !== key && (
                <span className="flex items-center">
                  <Tooltip label={t('todo.editLabel', { text: item.text })}>
                    <button type="button" data-todo-edit onClick={() => setEditing(key)} className={iconBtn}>
                      <FiEdit2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip label={t('todo.deleteLabel', { text: item.text })}>
                    <button type="button" data-todo-delete onClick={() => remove(item, index)} className={`${iconBtn} hover:text-red-600! dark:hover:text-red-400!`}>
                      <FiX className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${card ? 'h-full min-h-0' : ''}`} data-testid="todo">
      <form onSubmit={add} className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          {...(draft ? textDir : {})}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TODO_TEXT}
          placeholder={t('todo.addPlaceholder')}
          aria-label={t('todo.addLabel')}
          enterKeyHint="done"
          className="flex-1 min-w-0 rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-900/40 px-2.5 py-1.5 text-sm text-[#253033] dark:text-gray-100 placeholder:text-[#9aa1a6] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#004f35]/30 dark:focus:ring-emerald-500/40"
        />
        <Tooltip label={t('todo.add')}>
          <button
            type="submit"
            disabled={!draft.trim() || !store}
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#004f35] text-white hover:bg-[#003527] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiPlus className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </form>

      <div className={card ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1' : ''}>{body}</div>

      {ready && items.length > 0 && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#707974] dark:text-gray-500">
          <span>{left ? t('todo.left', { n: num(left) }) : t('todo.allDone')}</span>
          {done > 0 && (
            <button type="button" onClick={clearCompleted} className="font-semibold hover:text-[#004f35] dark:hover:text-emerald-400 transition-colors">
              {t('todo.clearCompleted')}
            </button>
          )}
        </div>
      )}
      {local && <p className="text-[11px] leading-snug text-[#707974] dark:text-gray-500">{t('todo.localNote')}</p>}

      <p id={`${hintId}-hint`} className="sr-only">{t('todo.moveHint')}</p>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}

// The text, being edited: Enter saves, Escape cancels, leaving the field saves.
// onDone(text | null, keepFocus) — null text = cancelled.
function EditField({ item, label, textDir, onDone }) {
  const ref = useRef(null);
  const finished = useRef(false);
  const finish = (text, keepFocus) => {
    if (finished.current) return;
    finished.current = true;
    onDone(text, keepFocus);
  };
  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.select();
  }, []);
  return (
    <input
      ref={ref}
      {...textDir}
      defaultValue={item.text}
      maxLength={MAX_TODO_TEXT}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(e.currentTarget.value, true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null, true); }
      }}
      onBlur={(e) => finish(e.currentTarget.value, false)}
      className="flex-1 min-w-0 rounded-md border border-[#004f35]/40 dark:border-emerald-500/50 bg-white dark:bg-gray-900/40 px-1.5 py-0.5 text-sm text-[#253033] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#004f35]/30 dark:focus:ring-emerald-500/40"
    />
  );
}

// The collapsed sidebar row's one-line summary: how many are left.
export function TodoSummary() {
  const { t, i18n } = useTranslation();
  const { items, status } = useTodos();
  if (status !== 'ready' || items.length === 0) return null;
  const left = items.filter((it) => !it.done).length;
  const n = i18n.language === 'ar' ? toArabicDigits(left) : String(left);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#707974] dark:text-gray-400">
      <LuListTodo className="w-3.5 h-3.5" aria-hidden="true" />
      {left ? t('todo.left', { n }) : t('todo.allDone')}
    </span>
  );
}
