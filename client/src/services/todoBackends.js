import { todosAPI } from './api';
import { storage } from '../utils/safeStorage';

// Where the to-do list ("My to-do") is kept. Two backends with ONE interface, so
// the list's UI and its store (services/todoStore.js) never ask whether anyone
// is signed in:
//
//   list()               → items, in order
//   add(text)            → the new item (appended)
//   update(id, patch)    → the item ({ text?, done? })
//   remove(id)           → { _id }
//   reorder(ids)         → items in that order (ids = the WHOLE list)
//   clearCompleted()     → { data: kept items, removed: [{ _id, text, done, index }] }
//   restore(items)       → { data: items, created }  (items: [{ _id?, text, done, index }])
//
// An item is { _id, text, done, order, createdAt, updatedAt } in both, so a
// visitor's local list can later be imported into an account as-is (the local
// ids are ObjectId-shaped and stable). Errors carry a `code` ('TODO_LIMIT' when
// the list is full) for the UI to translate.

export const MAX_TODOS = 200;
export const MAX_TODO_TEXT = 200;

const fail = (code) => Object.assign(new Error(code), { code });

// ── Signed in: the server (syncs across devices) ───────────────────────────
export const serverBackend = {
  local: false,
  async list() { return (await todosAPI.list()).data.data; },
  async add(text) { return (await todosAPI.add(text)).data.data; },
  async update(id, patch) { return (await todosAPI.update(id, patch)).data.data; },
  async remove(id) { return (await todosAPI.remove(id)).data.data; },
  async reorder(ids) { return (await todosAPI.reorder(ids)).data.data; },
  async clearCompleted() {
    const { data, removed } = (await todosAPI.clearCompleted()).data;
    return { data, removed };
  },
  async restore(items) {
    const { data, created } = (await todosAPI.restore(items.map(({ text, done, index }) => ({ text, done, index })))).data;
    return { data, created };
  },
  // Another device may have changed the list: the store re-reads it when this
  // tab comes back into view.
  subscribe(onChange) {
    const onVisible = () => { if (document.visibilityState === 'visible') onChange(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  },
};

// Normalise the thrown axios error into the same shape as the local one.
for (const name of ['list', 'add', 'update', 'remove', 'reorder', 'clearCompleted', 'restore']) {
  const call = serverBackend[name];
  serverBackend[name] = async (...args) => {
    try {
      return await call(...args);
    } catch (e) {
      throw Object.assign(e, { code: e.response?.data?.code ?? e.code });
    }
  };
}

// ── Signed out: this browser's localStorage ─────────────────────────────────
const KEY = 'guestTodos';

// 24 hex digits like a Mongo ObjectId: 8 of seconds, then 16 random.
const newId = () => {
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return seconds + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const read = () => {
  try {
    const raw = storage.getJSON(KEY);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((it) => it && typeof it._id === 'string' && typeof it.text === 'string')
      .map((it) => ({ ...it, done: it.done === true, order: Number.isFinite(it.order) ? it.order : 0 }))
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
};
const write = (items) => {
  if (!storage.setJSON(KEY, items)) throw fail('STORAGE');
  return items;
};
// Same rule as the server: trimmed, 1–200 characters.
const clean = (text) => {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t || t.length > MAX_TODO_TEXT) throw fail('TEXT');
  return t;
};
const renumber = (items) => items.map((it, i) => (it.order === i ? it : { ...it, order: i }));

export const localBackend = {
  local: true,
  async list() { return read(); },
  async add(text) {
    const items = read();
    if (items.length >= MAX_TODOS) throw fail('TODO_LIMIT');
    const now = new Date().toISOString();
    const item = { _id: newId(), text: clean(text), done: false, order: items.length ? items[items.length - 1].order + 1 : 0, createdAt: now, updatedAt: now };
    write([...items, item]);
    return item;
  },
  async update(id, patch) {
    const items = read();
    const at = items.findIndex((it) => it._id === id);
    if (at < 0) throw fail('NOT_FOUND');
    const next = { ...items[at], updatedAt: new Date().toISOString() };
    if (patch.text !== undefined) next.text = clean(patch.text);
    if (patch.done !== undefined) next.done = patch.done === true;
    items[at] = next;
    write(items);
    return next;
  },
  async remove(id) {
    const items = read();
    if (!items.some((it) => it._id === id)) throw fail('NOT_FOUND');
    write(items.filter((it) => it._id !== id));
    return { _id: id };
  },
  async reorder(ids) {
    const items = read();
    const byId = new Map(items.map((it) => [it._id, it]));
    if (ids.length !== items.length || new Set(ids).size !== ids.length || ids.some((id) => !byId.has(id))) {
      throw fail('STALE');
    }
    return write(renumber(ids.map((id) => byId.get(id))));
  },
  async clearCompleted() {
    const items = read();
    const removed = [];
    const kept = [];
    items.forEach((it, index) => (it.done ? removed.push({ _id: it._id, text: it.text, done: true, index }) : kept.push(it)));
    write(kept);
    return { data: kept, removed };
  },
  async restore(entries) {
    const items = read();
    if (items.length + entries.length > MAX_TODOS) throw fail('TODO_LIMIT');
    const taken = new Set(items.map((it) => it._id));
    const now = new Date().toISOString();
    // A restored item keeps its old id when it's free, so it is the same item
    // (not an id the store made up while an add was still on its way).
    const created = entries.map(({ _id, text, done }) => {
      const id = /^[0-9a-f]{24}$/.test(_id ?? '') && !taken.has(_id) ? _id : newId();
      taken.add(id);
      return { _id: id, text: clean(text), done: done === true, order: 0, createdAt: now, updatedAt: now };
    });
    const list = [...items];
    entries
      .map((e, i) => ({ index: e.index, item: created[i] }))
      .sort((a, b) => a.index - b.index)
      .forEach(({ index, item }) => list.splice(Math.min(index, list.length), 0, item));
    const data = write(renumber(list));
    const byId = new Map(data.map((it) => [it._id, it]));
    return { data, created: created.map((it) => byId.get(it._id)) };
  },
  // Another tab of this browser changed the list.
  subscribe(onChange) {
    const onStorage = (e) => { if (e.key === KEY || e.key === null) onChange(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },
};
