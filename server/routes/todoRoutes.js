const express = require('express');
const router = express.Router();
const {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  reorderTodos,
  clearCompleted,
  restoreTodos,
} = require('../controllers/todoController');
const { protect } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// All routes are protected (require login)
router.use(protect);

// Type gates — reject objects/arrays where scalars are expected, so a body like
// { text: { "$gt": "" } } never reaches a query. Lengths, ownership and the
// list cap are checked in the controller.
const createSchema = { text: 'string' };
const updateSchema = { text: 'string', done: 'boolean' };

// The user's list, in order
router.get('/', getTodos);

// Add an item at the end
router.post('/', validateBody(createSchema), createTodo);

// The whole list in a new order (before '/:id' so 'reorder' isn't read as an id)
router.put('/reorder', validateBody({ ids: 'stringArray' }), reorderTodos);

// Remove every ticked item (before '/:id')
router.delete('/completed', clearCompleted);

// Put removed items back in place — the Undo after a delete or a clear. Each
// element's fields are type-checked in the controller.
router.post('/restore', validateBody({ items: 'objectArray' }), restoreTodos);

// Edit the text / tick it (ownership-checked; :id validated in the controller)
router.put('/:id', validateBody(updateSchema), updateTodo);

// Remove one item (ownership-checked)
router.delete('/:id', deleteTodo);

module.exports = router;
