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

    // Empty ⇒ clear the page's drawing.
    if (strokes.length === 0) {
      await Annotation.findOneAndDelete({ userId, pageNumber, kind: 'drawing' });
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

    const doc = await Annotation.findOneAndUpdate(
      { userId, pageNumber, kind: 'drawing' },
      { $set: { strokes }, $setOnInsert: { userId, pageNumber, kind: 'drawing', verseKey: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    console.error('UpsertDrawing error:', error);
    serverError(res, 'Error saving drawing', error);
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
};
