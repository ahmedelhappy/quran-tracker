// The to-do list's state: ONE store per owner (an account or this browser's
// guest list), kept outside React so the Library's sidebar and the Dashboard
// card show the same list, and a page you come back to paints it at once
// instead of loading again.
//
// Optimistic, with exact rollback. The store keeps the list as the backend last
// CONFIRMED it, plus a queue of changes not yet confirmed. What you see is the
// confirmed list with the queued changes replayed on top. Changes are sent one
// at a time, in order; one that fails is simply dropped from the queue, so the
// view rolls back exactly that change while later ones still apply — then the
// list is re-read from the backend in case it changed elsewhere.
//
// Each change is { apply(list), send(confirmed), commit(confirmed, result) }:
// `apply` is the optimistic edit, `send` the backend call, and `commit` turns
// the confirmed list into the new confirmed list from the backend's reply.
//
// An item added here has a temporary id until the backend gives it a real one.
// Changes queued in between still name the temporary id; `real(id)` maps it
// when they run. Rows are keyed by `key`, which an item keeps for life (its
// first id), so React never remounts a row — or loses its focus — when the real
// id arrives.

const stores = new Map();

const byOrder = (a, b) => a.order - b.order;

export function createTodoStore(backend) {
  let confirmed = [];
  let status = 'loading'; // 'loading' | 'ready' | 'error'
  const queue = [];
  const idMap = new Map();
  let snapshot = { items: [], status, local: backend.local };
  const listeners = new Set();
  let running = false;
  let resyncWanted = false;
  let tmpCount = 0;

  const real = (id) => idMap.get(id) ?? id;
  const same = (item, id) => item._id === real(id);
  // A list from the backend, each item carrying the key it already had here.
  const keyed = (list, prev, extra = new Map()) => {
    const keys = new Map(prev.map((it) => [it._id, it.key]));
    return list.map((it) => ({ ...it, key: extra.get(it._id) ?? keys.get(it._id) ?? it._id }));
  };

  const publish = () => {
    const items = queue.reduce((list, entry) => entry.change.apply(list), confirmed);
    snapshot = { items, status, local: backend.local };
    listeners.forEach((fn) => fn());
  };

  const pump = async () => {
    if (running) return;
    running = true;
    while (queue.length) {
      const entry = queue[0];
      entry.started = true;
      try {
        const result = await entry.change.send(confirmed);
        confirmed = entry.change.commit(confirmed, result);
        queue.shift();
        entry.waiters.forEach((w) => w.resolve(result));
      } catch (error) {
        queue.shift();
        entry.waiters.forEach((w) => w.reject(error));
        if (!entry.change.isSync) resyncWanted = true;
        else if (status === 'loading') status = 'error';
      }
      publish();
    }
    running = false;
    if (resyncWanted) {
      resyncWanted = false;
      sync().catch(() => {});
    }
  };

  const run = (change) => new Promise((resolve, reject) => {
    // Successive reorders (holding Alt+↓) collapse into one request: a reorder
    // still waiting its turn just takes the newer order.
    const last = queue[queue.length - 1];
    if (change.coalesce && last && !last.started && last.change.coalesce) {
      last.change = change;
      last.waiters.push({ resolve, reject });
    } else {
      queue.push({ change, waiters: [{ resolve, reject }], started: false });
    }
    publish();
    pump();
  });

  // Re-read the whole list. Queued behind any pending change, so it never
  // overwrites one in flight.
  const sync = () => run({
    isSync: true,
    apply: (list) => list,
    send: () => backend.list(),
    commit: (prev, list) => {
      status = 'ready';
      return keyed([...list].sort(byOrder), prev);
    },
  });

  // Put the items of `ids` in that order; anything not named keeps its place
  // after them (an item another change added meanwhile).
  const arrange = (list, ids) => {
    const pos = new Map(ids.map((id, i) => [real(id), i]));
    const named = list.filter((it) => pos.has(it._id)).sort((a, b) => pos.get(a._id) - pos.get(b._id));
    return [...named, ...list.filter((it) => !pos.has(it._id))];
  };

  // Insert entries ({ index, item }) at their indexes, ascending.
  const insertAt = (list, entries) => {
    const next = [...list];
    [...entries].sort((a, b) => a.index - b.index)
      .forEach(({ index, item }) => next.splice(Math.min(index, next.length), 0, item));
    return next;
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    local: backend.local,

    // Called while a list is on screen: load it (again), and follow changes made
    // elsewhere — another tab, or (signed in) another device when this tab
    // comes back into view.
    activate() {
      if (!queue.some((e) => e.change.isSync)) sync().catch(() => {});
      return backend.subscribe(() => {
        if (!queue.length) sync().catch(() => {});
      });
    },
    retry: () => sync(),

    add(text) {
      const key = `tmp-${++tmpCount}`;
      return run({
        apply: (list) => [...list, { _id: key, key, text: text.trim(), done: false, order: Infinity, pending: true }],
        send: () => backend.add(text),
        commit: (prev, item) => {
          idMap.set(key, item._id);
          return [...prev, { ...item, key }];
        },
      });
    },

    update(id, patch) {
      return run({
        apply: (list) => list.map((it) => (same(it, id) ? { ...it, ...patch } : it)),
        send: () => backend.update(real(id), patch),
        commit: (prev, item) => prev.map((it) => (it._id === item._id ? { ...item, key: it.key } : it)),
      });
    },

    remove(id) {
      return run({
        apply: (list) => list.filter((it) => !same(it, id)),
        send: () => backend.remove(real(id)),
        commit: (prev) => prev.filter((it) => !same(it, id)),
      });
    },

    // `ids`: the whole list in its new order (as shown).
    reorder(ids) {
      return run({
        coalesce: true,
        apply: (list) => arrange(list, ids),
        send: (prev) => backend.reorder(arrange(prev, ids).map((it) => it._id)),
        commit: (prev, list) => keyed(list, prev),
      });
    },

    // Resolves to the backend's { data, removed } — `removed` is what the Undo
    // puts back.
    clearCompleted() {
      return run({
        apply: (list) => list.filter((it) => !it.done),
        send: () => backend.clearCompleted(),
        commit: (prev, res) => keyed(res.data, prev),
      });
    },

    // The Undo of a delete or a clear: entries [{ _id, text, done, index }].
    restore(entries) {
      const keys = entries.map(() => `tmp-${++tmpCount}`);
      return run({
        apply: (list) => insertAt(list, entries.map((e, i) => ({
          index: e.index,
          item: { _id: keys[i], key: keys[i], text: e.text, done: e.done === true, order: Infinity, pending: true },
        }))),
        send: () => backend.restore(entries),
        commit: (prev, res) => {
          const extra = new Map();
          res.created.forEach((item, i) => {
            idMap.set(keys[i], item._id);
            extra.set(item._id, keys[i]);
          });
          return keyed(res.data, prev, extra);
        },
      });
    },
  };
}

// The store for an owner ('guest', or 'user:<id>'). Switching owner (signing in
// or out) drops the other one, so no list outlives its account on this page.
export function todoStoreFor(owner, backend) {
  if (!stores.has(owner)) {
    stores.clear();
    stores.set(owner, createTodoStore(backend));
  }
  return stores.get(owner);
}
