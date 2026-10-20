const mongoose = require('mongoose');
const Todo = require('../models/Todo');
const { serverError } = require('../utils/errorResponse');

// A personal list, not a project tracker: a ceiling keeps it a list (and the
// renumbering below cheap) and stops one account from filling the collection.
const MAX_TODOS = 200;
const MAX_TEXT = 200;

const notFound = (res) => res.status(404).json({ success: false, message: 'To-do not found' });
// `code` lets the client show its own (translated) message for this one case.
const capReached = (res) =>
  res.status(400).json({
    success: false,
    code: 'TODO_LIMIT',
    message: `Your list is full (${MAX_TODOS} items). Clear some to add more.`,
  });

// The trimmed text, or null when it is empty / too long / not a string.
const cleanText = (raw) => {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text.length >= 1 && text.length <= MAX_TEXT ? text : null;
};
const badText = (res) =>
  res.status(400).json({ success: false, message: `Text must be 1–${MAX_TEXT} characters` });

// The validate middleware lets 'true' / 'false' through for booleans.
const toBool = (v) => v === true || v === 'true';

const listFor = (userId) => Todo.find({ userId }).sort({ order: 1, _id: 1 });

// Write order = position for every item whose order isn't already that.
const renumber = async (userId, todos) => {
  const ops = [];
  todos.forEach((todo, i) => {
    if (todo.order !== i) {
      ops.push({ updateOne: { filter: { _id: todo._id, userId }, update: { $set: { order: i } } } });
      todo.order = i;
    }
  });
  if (ops.length) await Todo.bulkWrite(ops);
  return todos;
};

// GET /api/todos — the signed-in user's list, in order.
const getTodos = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await listFor(req.user._id) });
  } catch (error) {
    console.error('GetTodos error:', error);
    serverError(res, 'Error fetching your to-do list', error);
  }
};

// POST /api/todos { text } — add an item at the end of the list.
const createTodo = async (req, res) => {
  try {
    const text = cleanText(req.body.text);
    if (text == null) return badText(res);

    const userId = req.user._id;
    if ((await Todo.countDocuments({ userId })) >= MAX_TODOS) return capReached(res);

    const last = await Todo.findOne({ userId }).sort({ order: -1 }).select('order');
    const todo = await Todo.create({ userId, text, order: last ? last.order + 1 : 0 });
    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    console.error('CreateTodo error:', error);
    serverError(res, 'Error adding the item', error);
  }
};

// PUT /api/todos/:id { text?, done? } — edit the text and/or tick it.
const updateTodo = async (req, res) => {
  try {
    // Unknown and foreign ids look the same (404), so ids can't be probed.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return notFound(res);

    const updates = {};
    if (req.body.text !== undefined) {
      const text = cleanText(req.body.text);
      if (text == null) return badText(res);
      updates.text = text;
    }
    if (req.body.done !== undefined) updates.done = toBool(req.body.done);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!todo) return notFound(res);
    res.status(200).json({ success: true, data: todo });
  } catch (error) {
    console.error('UpdateTodo error:', error);
    serverError(res, 'Error updating the item', error);
  }
};

// DELETE /api/todos/:id — remove one item (the others keep their order; the
// gap it leaves doesn't matter, only the relative order does).
const deleteTodo = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return notFound(res);
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!todo) return notFound(res);
    res.status(200).json({ success: true, data: { _id: todo._id } });
  } catch (error) {
    console.error('DeleteTodo error:', error);
    serverError(res, 'Error removing the item', error);
  }
};

// PUT /api/todos/reorder { ids } — the WHOLE list in its new order. Every one of
// the user's ids must appear exactly once: an id that isn't theirs (or doesn't
// exist) is a 404, a missing or repeated one a 400. Sending the full order
// rather than one item's new neighbours keeps the server free of gap /
// precision bookkeeping, and a reorder made on a list that changed elsewhere
// (another device added an item) is refused instead of half-applied.
const reorderTodos = async (req, res) => {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids must be an array of to-do ids' });
    }
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, message: 'ids must not repeat' });
    }

    const userId = req.user._id;
    const todos = await listFor(userId);
    const byId = new Map(todos.map((todo) => [String(todo._id), todo]));
    if (ids.some((id) => !byId.has(id))) return notFound(res);
    if (ids.length !== todos.length) {
      return res.status(400).json({ success: false, message: 'ids must list every item in your list' });
    }

    const ordered = await renumber(userId, ids.map((id) => byId.get(id)));
    res.status(200).json({ success: true, data: ordered });
  } catch (error) {
    console.error('ReorderTodos error:', error);
    serverError(res, 'Error reordering your list', error);
  }
};

// DELETE /api/todos/completed — remove every ticked item in one request. Replies
// with what is left and with what was removed (and where each one stood), so the
// client's Undo can put exactly those back in place.
const clearCompleted = async (req, res) => {
  try {
    const userId = req.user._id;
    const todos = await listFor(userId);
    const removed = [];
    const kept = [];
    todos.forEach((todo, index) => {
      if (todo.done) removed.push({ _id: todo._id, text: todo.text, done: true, index });
      else kept.push(todo);
    });
    if (removed.length) await Todo.deleteMany({ userId, _id: { $in: removed.map((r) => r._id) } });
    res.status(200).json({ success: true, data: kept, removed });
  } catch (error) {
    console.error('ClearCompleted error:', error);
    serverError(res, 'Error clearing completed items', error);
  }
};

// POST /api/todos/restore { items: [{ text, done?, index }] } — put removed items
// back (the Undo after a delete or a clear). Each lands at its `index` in the
// list; inserting them in ascending index order rebuilds the list as it was.
// They are new documents (new ids). Replies with the whole list and, in request
// order, the items it created.
const restoreTodos = async (req, res) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_TODOS) {
      return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
    }
    const clean = [];
    for (const item of items) {
      const text = cleanText(item.text);
      if (text == null) return badText(res);
      if (item.done !== undefined && typeof item.done !== 'boolean') {
        return res.status(400).json({ success: false, message: 'done must be a boolean' });
      }
      if (!Number.isInteger(item.index) || item.index < 0) {
        return res.status(400).json({ success: false, message: 'index must be a whole number ≥ 0' });
      }
      clean.push({ text, done: item.done === true, index: item.index });
    }

    const userId = req.user._id;
    const todos = await listFor(userId);
    if (todos.length + clean.length > MAX_TODOS) return capReached(res);

    const created = await Todo.insertMany(clean.map(({ text, done }) => ({ userId, text, done, order: 0 })));
    const list = [...todos];
    clean
      .map((item, i) => ({ index: item.index, doc: created[i] }))
      .sort((a, b) => a.index - b.index)
      .forEach(({ index, doc }) => list.splice(Math.min(index, list.length), 0, doc));
    // insertMany wrote order 0 on purpose: force the renumber to write each one.
    created.forEach((doc) => { doc.order = -1; });
    await renumber(userId, list);

    res.status(201).json({ success: true, data: list, created });
  } catch (error) {
    console.error('RestoreTodos error:', error);
    serverError(res, 'Error restoring the items', error);
  }
};

module.exports = {
  MAX_TODOS,
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  reorderTodos,
  clearCompleted,
  restoreTodos,
};
