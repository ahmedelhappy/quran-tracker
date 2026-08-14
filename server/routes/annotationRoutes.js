const express = require('express');
const router = express.Router();
const {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  upsertDrawing,
  getSummary,
} = require('../controllers/annotationController');
const { protect } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../middleware/validate');

// All routes are protected (require login)
router.use(protect);

// Type gates — reject objects/arrays where a scalar is expected (NoSQL-injection
// surface). The controller still enforces per-kind rules, ranges, and enums.
// `verseKey` is nullable (null ⇒ whole page); `page`/`kind` are the two query modes.
const listSchema = { page: 'number', kind: 'string' };
const createSchema = {
  pageNumber: 'number',
  verseKey: { type: 'string', nullable: true },
  kind: 'string',
  color: 'string',
  text: 'string',
  wordFrom: 'number',
  wordTo: 'number',
  x: 'number', // free-floating text notes
  y: 'number',
};
const updateSchema = { text: 'string', color: 'string', x: 'number', y: 'number' };

// Per-page kind-count summary for the annotation navigator (before '/:id').
router.get('/summary', getSummary);

// List by page (reader) or by kind (hard list)
router.get('/', validateQuery(listSchema), getAnnotations);

// Create an annotation (validated per kind in the controller)
router.post('/', validateBody(createSchema), createAnnotation);

// Upsert a page's free-form drawing (before '/:id' so 'drawing' isn't read as an
// id). Only pageNumber is type-gated here; the controller strictly validates the
// nested `strokes` the generic middleware can't.
router.put('/drawing', validateBody({ pageNumber: 'number' }), upsertDrawing);

// Edit a note's text / a highlight's colour (ownership-checked; :id validated in the controller)
router.put('/:id', validateBody(updateSchema), updateAnnotation);

// Remove an annotation (ownership-checked)
router.delete('/:id', deleteAnnotation);

module.exports = router;
