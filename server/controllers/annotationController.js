const mongoose = require('mongoose');
const Annotation = require('../models/Annotation');
const { getMetadataForPages } = require('../utils/quranMetadataCache');
const { PAGE_BY_NUMBER } = require('../utils/segments');
const { serverError } = require('../utils/errorResponse');

// A generous per-user ceiling so the collection can't be abused into unbounded
// growth. A hard cap surfaced as a 400 with a clear message.
const MAX_ANNOTATIONS = 2000;

const KINDS = ['highlight', 'note', 'hard', 'drawing', 'text'];
const COLORS = ['yellow', 'green', 'blue', 'pink'];
const VERSE_KEY_RE = /^\d+:\d+$/;

// Drawing (free-form ink) + free-floating text constants. Coordinates live in the
// page's fixed internal text-area space — the same the 15-slot grid uses — never
// screen pixels. The drawable area is EXTENDED past the 524×800 text box into the
// surrounding margins (so users can annotate the gutter): x ∈ [-MARGIN_X,
// 524+MARGIN_X], y ∈ [-MARGIN_TOP, 800+MARGIN_BOTTOM]. Those margins mirror the
// frame geometry the client's overlay uses (see MushafDrawLayer) — keep in sync.
const DRAW_TOOLS = ['pen', 'highlighter'];
const STROKE_COLORS = [...COLORS, 'ink']; // the highlight enum plus a dark-ink pen
const TEXT_COLORS = [...COLORS, 'ink'];   // free-floating text notes share the ink palette
const CANVAS_W = 524;
const CANVAS_H = 800;
const MARGIN_X = 52;       // horizontal gutter each side (internal units)
const MARGIN_TOP = 34;
const MARGIN_BOTTOM = 34;
const X_MIN = -MARGIN_X;
const X_MAX = CANVAS_W + MARGIN_X;
const Y_MIN = -MARGIN_TOP;
const Y_MAX = CANVAS_H + MARGIN_BOTTOM;
const MAX_TEXT_LEN = 300;
const MAX_DRAW_BYTES = 64 * 1024;  // serialized strokes cap per page
const MAX_STROKES = 4000;          // sane structural bounds so validation is O(n)
const MAX_POINTS_PER_STROKE = 8000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

// A verseKey is valid for a page only if it's actually one of that page's verses
// (segments.js already loads the mushaf structure into PAGE_BY_NUMBER). Guarding
// here keeps highlights/notes from anchoring to a verse that isn't on the page.
const verseOnPage = (pageNumber, verseKey) => {
  const meta = PAGE_BY_NUMBER.get(pageNumber);
  return !!meta && meta.verseKeys.includes(verseKey);
};

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

// GET /api/annotations?page=N        → every annotation on that page
// GET /api/annotations?kind=hard     → the user's hard list, enriched with page
//                                      surah labels for the sidebar/jump links
const getAnnotations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, kind } = req.query;

    // --- By page: the reader loads all annotations for the visible page(s). ---
    if (page !== undefined) {
      const pageNumber = Number(page);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
        return res.status(400).json({ success: false, message: 'page must be an integer between 1 and 604' });
      }
      const annotations = await Annotation.find({ userId, pageNumber }).sort({ createdAt: 1 });
      return res.status(200).json({ success: true, data: annotations });
    }

    // --- By kind: a flat list (the "hard verses & pages" section uses kind=hard). ---
    if (kind !== undefined) {
      if (!KINDS.includes(kind)) {
        return res.status(400).json({ success: false, message: `kind must be one of ${KINDS.join(', ')}` });
      }
      const annotations = await Annotation.find({ userId, kind }).sort({ pageNumber: 1, createdAt: 1 });

      // Enrich each with its page's surah label(s) so the client can render
      // "Page 255 · Al-Baqarah" jump links without its own metadata lookup.
      const pageNumbers = [...new Set(annotations.map((a) => a.pageNumber))];
      const metaMap = await getMetadataForPages(pageNumbers);
      const enriched = annotations.map((a) => {
        const meta = metaMap[a.pageNumber];
        return {
          ...a.toObject(),
          juzNumber: meta?.juzNumber ?? null,
          surahName: meta?.surahName ?? null,
          surahNameArabic: meta?.surahNameArabic ?? null,
          surahs: meta?.surahs ?? null,
        };
      });
      return res.status(200).json({ success: true, data: enriched });
    }

    return res.status(400).json({ success: false, message: 'Provide a page or kind query parameter' });
  } catch (error) {
    console.error('GetAnnotations error:', error);
    serverError(res, 'Error fetching annotations', error);
  }
};

// Validates the per-kind field rules and returns a normalized document body, or
// { error } with a 400 message. Shared by create so both paths stay consistent.
const buildAnnotationBody = (kind, body) => {
  const pageNumber = Number(body.pageNumber);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    return { error: 'pageNumber must be an integer between 1 and 604' };
  }

  // verseKey: null/absent means "whole page". When present it must be a real
  // verse on this page.
  const rawVerseKey = body.verseKey;
  const hasVerseKey = rawVerseKey !== undefined && rawVerseKey !== null && rawVerseKey !== '';
  if (hasVerseKey) {
    if (typeof rawVerseKey !== 'string' || !VERSE_KEY_RE.test(rawVerseKey)) {
      return { error: 'verseKey must be a "surah:ayah" string' };
    }
    if (!verseOnPage(pageNumber, rawVerseKey)) {
      return { error: `verseKey ${rawVerseKey} is not on page ${pageNumber}` };
    }
  }
  const verseKey = hasVerseKey ? rawVerseKey : null;

  const doc = { pageNumber, verseKey, kind };

  if (kind === 'highlight') {
    // A highlight is a coloured tint on a specific verse — it needs a verseKey
    // and a colour, and may narrow to a word span.
    if (!verseKey) return { error: 'A highlight must target a verse (verseKey)' };
    if (!COLORS.includes(body.color)) {
      return { error: `color must be one of ${COLORS.join(', ')}` };
    }
    doc.color = body.color;

    const { wordFrom, wordTo } = body;
    const hasFrom = wordFrom !== undefined && wordFrom !== null;
    const hasTo = wordTo !== undefined && wordTo !== null;
    if (hasFrom !== hasTo) {
      return { error: 'wordFrom and wordTo must be provided together' };
    }
    if (hasFrom) {
      const from = Number(wordFrom);
      const to = Number(wordTo);
      if (!isInt(from) || !isInt(to) || from < 1 || to < 1 || from > to) {
        return { error: 'wordFrom/wordTo must be positive integers with wordFrom <= wordTo' };
      }
      doc.wordFrom = from;
      doc.wordTo = to;
    }
    return { doc };
  }

  if (kind === 'note') {
    // A note carries text and may anchor to a verse or the whole page.
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return { error: 'A note must have text' };
    if (text.length > 2000) return { error: 'Note cannot exceed 2000 characters' };
    doc.text = text;
    return { doc };
  }

  if (kind === 'text') {
    // A free-floating text label at [x, y] (internal coords, extended to margins).
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return { error: 'A text note must have text' };
    if (text.length > MAX_TEXT_LEN) return { error: `Text note cannot exceed ${MAX_TEXT_LEN} characters` };
    if (!TEXT_COLORS.includes(body.color)) return { error: `color must be one of ${TEXT_COLORS.join(', ')}` };
    const x = Number(body.x);
    const y = Number(body.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'x and y must be numbers' };
    doc.verseKey = null; // free-floating, not verse-anchored
    doc.text = text;
    doc.color = body.color;
    doc.x = round1(clamp(x, X_MIN, X_MAX));
    doc.y = round1(clamp(y, Y_MIN, Y_MAX));
    return { doc };
  }

  // kind === 'hard': just a flag on a verse or the whole page — no extra fields.
  return { doc };
};

// POST /api/annotations — create an annotation (validated per kind).
const createAnnotation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { kind } = req.body;
    if (!KINDS.includes(kind)) {
      return res.status(400).json({ success: false, message: `kind must be one of ${KINDS.join(', ')}` });
    }

    const { doc, error } = buildAnnotationBody(kind, req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const count = await Annotation.countDocuments({ userId });
    if (count >= MAX_ANNOTATIONS) {
      return res.status(400).json({
        success: false,
        message: `You've reached the ${MAX_ANNOTATIONS}-annotation limit. Remove some to add more.`,
      });
    }

    const annotation = await Annotation.create({ userId, ...doc });
    res.status(201).json({ success: true, data: annotation });
  } catch (error) {
    console.error('CreateAnnotation error:', error);
    serverError(res, 'Error creating annotation', error);
  }
};

// PUT /api/annotations/:id — edit a note's text or a highlight's colour. Ownership
// is enforced by scoping the lookup to the signed-in user.
const updateAnnotation = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Annotation not found' });
    }

    const annotation = await Annotation.findOne({ _id: req.params.id, userId });
    if (!annotation) {
      return res.status(404).json({ success: false, message: 'Annotation not found' });
    }

    if (annotation.kind === 'note') {
      if (req.body.text === undefined) {
        return res.status(400).json({ success: false, message: 'A note update must include text' });
      }
      const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
      if (!text) return res.status(400).json({ success: false, message: 'A note must have text' });
      if (text.length > 2000) return res.status(400).json({ success: false, message: 'Note cannot exceed 2000 characters' });
      annotation.text = text;
    } else if (annotation.kind === 'highlight') {
      if (!COLORS.includes(req.body.color)) {
        return res.status(400).json({ success: false, message: `color must be one of ${COLORS.join(', ')}` });
      }
      annotation.color = req.body.color;
    } else if (annotation.kind === 'text') {
      // A text note can be edited (text/colour) and moved (x/y) — all optional.
      if (req.body.text !== undefined) {
        const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
        if (!text) return res.status(400).json({ success: false, message: 'A text note must have text' });
        if (text.length > MAX_TEXT_LEN) return res.status(400).json({ success: false, message: `Text note cannot exceed ${MAX_TEXT_LEN} characters` });
        annotation.text = text;
      }
      if (req.body.color !== undefined) {
        if (!TEXT_COLORS.includes(req.body.color)) {
          return res.status(400).json({ success: false, message: `color must be one of ${TEXT_COLORS.join(', ')}` });
        }
        annotation.color = req.body.color;
      }
      if (req.body.x !== undefined || req.body.y !== undefined) {
        const x = Number(req.body.x);
        const y = Number(req.body.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return res.status(400).json({ success: false, message: 'x and y must be numbers' });
        }
        annotation.x = round1(clamp(x, X_MIN, X_MAX));
        annotation.y = round1(clamp(y, Y_MIN, Y_MAX));
      }
    } else {
      // 'hard' has nothing editable — it's a bare flag (toggle by delete/create).
      return res.status(400).json({ success: false, message: 'A hard flag has nothing to edit' });
    }

    await annotation.save();
    res.status(200).json({ success: true, data: annotation });
  } catch (error) {
    console.error('UpdateAnnotation error:', error);
    serverError(res, 'Error updating annotation', error);
  }
};

// DELETE /api/annotations/:id — remove one of the user's own annotations.
const deleteAnnotation = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Annotation not found' });
    }
    // Scope to the owner so one user can never delete another's.
    const annotation = await Annotation.findOneAndDelete({ _id: req.params.id, userId });
    if (!annotation) {
      return res.status(404).json({ success: false, message: 'Annotation not found' });
    }
    res.status(200).json({ success: true, message: 'Annotation removed' });
  } catch (error) {
    console.error('DeleteAnnotation error:', error);
    serverError(res, 'Error removing annotation', error);
  }
};

// Strict validator for a drawing's strokes — this route can't use the generic
// type-gate middleware (it rejects the nested point arrays), so validation lives
// here: tool/color from the enums, width sane, every point a 2-number pair,
// coordinates clamped into the canvas and rounded to 1 decimal (keeps payloads
// small). Returns { strokes } (normalized) or { error } for a 400.
const validateStrokes = (raw) => {
  if (!Array.isArray(raw)) return { error: 'strokes must be an array' };
  if (raw.length > MAX_STROKES) return { error: `too many strokes (max ${MAX_STROKES})` };
  const strokes = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { error: 'each stroke must be an object' };
    if (!DRAW_TOOLS.includes(s.tool)) return { error: `stroke.tool must be one of ${DRAW_TOOLS.join(', ')}` };
    if (!STROKE_COLORS.includes(s.color)) return { error: `stroke.color must be one of ${STROKE_COLORS.join(', ')}` };
    const width = Number(s.width);
    if (!Number.isFinite(width) || width <= 0 || width > 100) return { error: 'stroke.width must be a number between 0 and 100' };
    if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > MAX_POINTS_PER_STROKE) {
      return { error: 'stroke.points must be a non-empty array' };
    }
    const points = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2) return { error: 'each point must be a [x, y] pair' };
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'point coordinates must be numbers' };
      points.push([round1(clamp(x, X_MIN, X_MAX)), round1(clamp(y, Y_MIN, Y_MAX))]);
    }
    strokes.push({ tool: s.tool, color: s.color, width: round1(width), points });
  }
  return { strokes };
};

// PUT /api/annotations/drawing { pageNumber, strokes } — upsert the page's single
// drawing doc (one per user+page). Empty strokes deletes it.
const upsertDrawing = async (req, res) => {
  try {
    const userId = req.user._id;
    const pageNumber = Number(req.body.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({ success: false, message: 'pageNumber must be an integer between 1 and 604' });
    }

    const { strokes, error } = validateStrokes(req.body.strokes);
    if (error) return res.status(400).json({ success: false, message: error });

    // Optional precondition: the drawing the client's strokes were BASED on —
    // the updatedAt of the doc it loaded, or null when it loaded "no drawing".
    // A save replaces the page's whole ink, so one built on a stale or failed
    // read erased strokes saved since (another device, an earlier save of this
    // page whose reply was lost) or everything (a failed read taken as empty —
    // H-02). With a base that no longer matches, nothing is written: the answer
    // is a 409 carrying the current doc, for the client to merge and save again.
    // Without the field, the old unconditional replace (older clients).
    const preconditioned = Object.prototype.hasOwnProperty.call(req.body, 'baseUpdatedAt');
    let base = null;
    if (preconditioned && req.body.baseUpdatedAt !== null) {
      base = new Date(req.body.baseUpdatedAt);
      if (typeof req.body.baseUpdatedAt !== 'string' || Number.isNaN(base.getTime())) {
        return res.status(400).json({ success: false, message: 'baseUpdatedAt must be an ISO date string or null' });
      }
    }
    const changed = async () => {
      const current = await Annotation.findOne({ userId, pageNumber, kind: 'drawing' });
      return res.status(409).json({
        success: false,
        code: 'DRAWING_CHANGED',
        message: "This page's drawing changed since it was loaded",
        data: current,
      });
    };
    // The doc this write may touch: exactly the one the client saw.
    const target = { userId, pageNumber, kind: 'drawing', ...(base ? { updatedAt: base } : {}) };
    if (preconditioned && base === null && await Annotation.exists({ userId, pageNumber, kind: 'drawing' })) {
      return changed();
    }

    // Empty ⇒ clear the page's drawing.
    if (strokes.length === 0) {
      const removed = await Annotation.findOneAndDelete(target);
      if (base && !removed) return changed();
      return res.status(200).json({ success: true, data: null });
    }

    const bytes = Buffer.byteLength(JSON.stringify(strokes), 'utf8');
    if (bytes > MAX_DRAW_BYTES) {
      return res.status(400).json({
        success: false,
        message: `This page's drawing is too large (${Math.round(bytes / 1024)}KB, max ${MAX_DRAW_BYTES / 1024}KB). Erase some strokes.`,
      });
    }

    // The per-user cap only gates a brand-new document (updating an existing
    // page's drawing never grows the collection).
    const existing = await Annotation.findOne({ userId, pageNumber, kind: 'drawing' }, { _id: 1 });
    if (!existing) {
      const count = await Annotation.countDocuments({ userId });
      if (count >= MAX_ANNOTATIONS) {
        return res.status(400).json({
          success: false,
          message: `You've reached the ${MAX_ANNOTATIONS}-annotation limit. Remove some to add more.`,
        });
      }
    }

    // With a base, update only that exact doc (no upsert): if it changed in the
    // meantime nothing matches and the client gets the 409 instead.
    //
    // "No drawing yet" as the base is insert-only. The exists() check above is
    // only a fast path: two first saves of one page at once both passed it, and
    // the second upsert replaced the first's ink (or the two made two docs).
    // The unique per-page index (models/Annotation.js) lets exactly one insert
    // through; the other's duplicate-key error is the same 409.
    if (preconditioned && base === null) {
      try {
        const doc = await Annotation.create({ userId, pageNumber, kind: 'drawing', verseKey: null, strokes });
        return res.status(200).json({ success: true, data: doc });
      } catch (error) {
        if (error.code === 11000) return changed();
        throw error;
      }
    }
    const doc = base
      ? await Annotation.findOneAndUpdate(target, { $set: { strokes } }, { new: true })
      : await Annotation.findOneAndUpdate(
        target,
        { $set: { strokes }, $setOnInsert: { userId, pageNumber, kind: 'drawing', verseKey: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    if (!doc) return changed();
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error('UpsertDrawing error:', error);
    serverError(res, 'Error saving drawing', error);
  }
};

// ── Batch: set the state of many verse annotations in one request ────────────
// A span action (highlight 6 verses, flag them hard) and its undo are ONE request
// here instead of N, so a few span highlights can't trip the general API limiter.
//
// Ops are keyed by (pageNumber, verseKey, kind), never by annotation _id: an undo
// that re-creates a highlight gives it a new id, and a later redo must still find
// it. Each op names the STATE that key should end up in:
//   { kind: 'highlight', pageNumber, verseKey, value: 'yellow' | … | null }
//   { kind: 'hard',      pageNumber, verseKey | null, value: true | false }
//   { kind: 'note',      pageNumber, verseKey | null, value: 'text' | null }
// and the response reports each key's state before and after, which is what the
// client's undo history stores. Setting a state twice is a no-op, so an undo or a
// redo replayed after a network error can't double-apply.
//
// All-or-nothing: every op is validated and the cap checked BEFORE anything is
// written. The writes then go out as one ordered bulkWrite; if it fails part-way,
// the touched keys are put back from a snapshot of their documents taken before
// the write (same _ids, same timestamps), and the request fails with a 500
// (utils/errorResponse.js never reads a part-done bulk write as the client's
// mistake). A failed rollback, which may leave keys half-written, is a 500 too.
const MAX_BATCH_OPS = 300;
const BATCH_KINDS = ['highlight', 'hard', 'note'];
const batchKeyOf = (op) => `${op.pageNumber}|${op.verseKey ?? ''}|${op.kind}`;

// Validates one raw op and returns a normalized { op } or { error }. Strict on
// types: the generic middleware can only see that `ops` is an array of objects,
// so a nested operator object ({ $gt: '' }) is rejected here, field by field.
const parseBatchOp = (raw, i) => {
  const at = `ops[${i}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: `${at} must be an object` };
  const { kind, pageNumber, verseKey, value } = raw;
  if (typeof kind !== 'string' || !BATCH_KINDS.includes(kind)) {
    return { error: `${at}.kind must be one of ${BATCH_KINDS.join(', ')}` };
  }
  if (!isInt(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    return { error: `${at}.pageNumber must be an integer between 1 and 604` };
  }
  if (verseKey !== null && verseKey !== undefined) {
    if (typeof verseKey !== 'string' || !VERSE_KEY_RE.test(verseKey)) {
      return { error: `${at}.verseKey must be a "surah:ayah" string or null` };
    }
    if (!verseOnPage(pageNumber, verseKey)) {
      return { error: `${at}: verseKey ${verseKey} is not on page ${pageNumber}` };
    }
  }
  const key = verseKey ?? null;

  if (kind === 'highlight') {
    if (!key) return { error: `${at}: a highlight must target a verse (verseKey)` };
    if (value !== null && !(typeof value === 'string' && COLORS.includes(value))) {
      return { error: `${at}.value must be one of ${COLORS.join(', ')} or null` };
    }
  } else if (kind === 'hard') {
    if (typeof value !== 'boolean') return { error: `${at}.value must be true or false` };
  } else if (value !== null) {
    // note
    if (typeof value !== 'string') return { error: `${at}.value must be the note text or null` };
    const text = value.trim();
    if (!text) return { error: `${at}: a note must have text (send null to remove it)` };
    if (text.length > 2000) return { error: `${at}: note cannot exceed 2000 characters` };
    return { op: { kind, pageNumber, verseKey: key, value: text } };
  }
  return { op: { kind, pageNumber, verseKey: key, value } };
};

// A key's current state, read off its documents (oldest first). The UI keeps one
// highlight / note per verse; if the API was used to stack several, the oldest
// one is what the reader sees as "the" state.
const stateOf = (kind, docs) => {
  if (kind === 'hard') return docs.length > 0;
  if (!docs.length) return null;
  return kind === 'highlight' ? docs[0].color : docs[0].text;
};

// Puts every touched key back exactly as the snapshot had it. Raw driver calls,
// so the restored documents keep their original _id, createdAt and updatedAt.
const restoreSnapshot = async (userId, keys, snapshot) => {
  await Annotation.collection.deleteMany({
    userId,
    $or: keys.map(({ pageNumber, verseKey, kind }) => ({ pageNumber, verseKey, kind })),
  });
  if (snapshot.length) await Annotation.collection.insertMany(snapshot);
};

// POST /api/annotations/batch { ops: [...] }
const batchAnnotations = async (req, res) => {
  try {
    const userId = req.user._id;
    const rawOps = req.body.ops;
    if (!Array.isArray(rawOps) || rawOps.length === 0) {
      return res.status(400).json({ success: false, message: 'ops must be a non-empty array' });
    }
    if (rawOps.length > MAX_BATCH_OPS) {
      return res.status(400).json({ success: false, message: `A batch can hold at most ${MAX_BATCH_OPS} changes` });
    }

    const ops = [];
    const seen = new Set();
    for (let i = 0; i < rawOps.length; i++) {
      const { op, error } = parseBatchOp(rawOps[i], i);
      if (error) return res.status(400).json({ success: false, message: error });
      const k = batchKeyOf(op);
      if (seen.has(k)) {
        return res.status(400).json({ success: false, message: `ops[${i}] repeats a verse already in this batch` });
      }
      seen.add(k);
      ops.push(op);
    }

    // Every document the batch could touch, in one indexed read (userId+pageNumber).
    const pages = [...new Set(ops.map((o) => o.pageNumber))];
    const kinds = [...new Set(ops.map((o) => o.kind))];
    const existing = await Annotation.find(
      { userId, pageNumber: { $in: pages }, kind: { $in: kinds } }
    ).sort({ createdAt: 1, _id: 1 }).lean();
    const docsByKey = new Map();
    for (const d of existing) {
      const k = batchKeyOf(d);
      if (!seen.has(k)) continue;
      if (!docsByKey.has(k)) docsByKey.set(k, []);
      docsByKey.get(k).push(d);
    }

    const writes = [];
    const touched = [];
    let created = 0;
    let removed = 0;
    const results = ops.map((op) => {
      const docs = docsByKey.get(batchKeyOf(op)) ?? [];
      const before = stateOf(op.kind, docs);
      const after = op.value;
      const ids = docs.map((d) => d._id);
      const base = { userId, pageNumber: op.pageNumber, verseKey: op.verseKey, kind: op.kind };
      const start = writes.length;

      if (op.kind === 'hard') {
        if (after && !docs.length) { writes.push({ insertOne: { document: base } }); created++; }
        if (!after && docs.length) { writes.push({ deleteMany: { filter: { _id: { $in: ids }, userId } } }); removed += docs.length; }
      } else if (after === null) {
        if (docs.length) { writes.push({ deleteMany: { filter: { _id: { $in: ids }, userId } } }); removed += docs.length; }
      } else if (!docs.length) {
        const field = op.kind === 'highlight' ? 'color' : 'text';
        writes.push({ insertOne: { document: { ...base, [field]: after } } });
        created++;
      } else if (op.kind === 'highlight') {
        // Recolour every highlight on the verse (word spans keep their span).
        if (docs.some((d) => d.color !== after)) {
          writes.push({ updateMany: { filter: { _id: { $in: ids }, userId }, update: { $set: { color: after } } } });
        }
      } else if (docs[0].text !== after) {
        writes.push({ updateOne: { filter: { _id: docs[0]._id, userId }, update: { $set: { text: after } } } });
      }

      if (writes.length > start) touched.push(op);
      return { kind: op.kind, pageNumber: op.pageNumber, verseKey: op.verseKey, before, after };
    });

    if (created > 0) {
      const count = await Annotation.countDocuments({ userId });
      if (count - removed + created > MAX_ANNOTATIONS) {
        return res.status(400).json({
          success: false,
          message: `You've reached the ${MAX_ANNOTATIONS}-annotation limit. Remove some to add more.`,
        });
      }
    }

    if (writes.length) {
      const snapshot = touched.flatMap((op) => docsByKey.get(batchKeyOf(op)) ?? []);
      try {
        await Annotation.bulkWrite(writes, { ordered: true });
      } catch (writeError) {
        try {
          await restoreSnapshot(userId, touched, snapshot);
        } catch (restoreError) {
          // Never let serverError read this as a client mistake (a 400 or 409):
          // the data may now be half-written, which is entirely ours.
          console.error('BatchAnnotations write failed:', writeError);
          console.error('BatchAnnotations rollback failed:', restoreError);
          return res.status(500).json({ success: false, message: 'Error saving annotations' });
        }
        throw writeError;
      }
    }

    res.status(200).json({ success: true, data: { results } });
  } catch (error) {
    console.error('BatchAnnotations error:', error);
    serverError(res, 'Error saving annotations', error);
  }
};

// GET /api/annotations/verses?from=P&to=Q — the verse-anchored annotations
// (highlights, notes, hard flags) on pages P..Q in one request. A span of verses
// can reach across many pages; the popover needs their state to show which
// swatches are fully / partly applied, and one read beats one per page. Drawings
// are left out (they can be large and a span never needs them).
const getVerseAnnotations = async (req, res) => {
  try {
    const userId = req.user._id;
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 604 || from > to) {
      return res.status(400).json({ success: false, message: 'from/to must be page numbers with 1 <= from <= to <= 604' });
    }
    const annotations = await Annotation.find(
      { userId, pageNumber: { $gte: from, $lte: to }, kind: { $in: BATCH_KINDS } }
    ).sort({ pageNumber: 1, createdAt: 1 });
    res.status(200).json({ success: true, data: annotations });
  } catch (error) {
    console.error('GetVerseAnnotations error:', error);
    serverError(res, 'Error fetching annotations', error);
  }
};

// GET /api/annotations/summary — per-page kind counts (+ a note excerpt), ordered
// by page. Powers the "Annotations" navigator (prev/next jump + list).
const getSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const rows = await Annotation.aggregate([
      { $match: { userId } },
      { $group: { _id: { pageNumber: '$pageNumber', kind: '$kind' }, count: { $sum: 1 } } },
    ]);

    const byPage = new Map();
    for (const r of rows) {
      const pn = r._id.pageNumber;
      const entry = byPage.get(pn) ?? { pageNumber: pn, counts: { highlight: 0, note: 0, hard: 0, drawing: 0, text: 0 } };
      entry.counts[r._id.kind] = r.count;
      byPage.set(pn, entry);
    }

    // A short excerpt from each page's first note, for the navigator list.
    const notes = await Annotation.find({ userId, kind: 'note' }, { pageNumber: 1, text: 1 })
      .sort({ pageNumber: 1, createdAt: 1 });
    const excerptByPage = new Map();
    for (const n of notes) {
      if (!excerptByPage.has(n.pageNumber)) excerptByPage.set(n.pageNumber, (n.text || '').slice(0, 80));
    }

    const data = [...byPage.values()]
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((e) => ({ ...e, noteExcerpt: excerptByPage.get(e.pageNumber) ?? null }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('GetAnnotationSummary error:', error);
    serverError(res, 'Error fetching annotation summary', error);
  }
};

module.exports = {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  upsertDrawing,
  getSummary,
  batchAnnotations,
  getVerseAnnotations,
  MAX_BATCH_OPS,
};
