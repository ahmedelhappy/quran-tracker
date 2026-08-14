const mongoose = require('mongoose');

// A personal annotation anchored to the mushaf. Four kinds share one collection:
//   - 'highlight': a coloured tint on a verse (optionally a word span within it)
//   - 'note':      a free-text note attached to a verse (or the whole page)
//   - 'hard':      a "this is hard to memorize" flag on a verse or a whole page
//   - 'drawing':   free-form ink strokes over a page (one doc per user+page); its
//                  coordinates live in the page's FIXED 524×800 internal text-area
//                  space (the same space the 15-slot grid and margin marks use),
//                  never screen pixels, so strokes scale pixel-perfectly.
// Verse-anchored kinds anchor by verseKey (+ optional word positions), never by
// pixel/offset, so they survive re-layout — MushafPage renders each word keyed by
// verseKey + position for exactly this. verseKey === null means the annotation
// targets the whole page (always the case for a drawing). Distinct from Bookmark
// (navigation) and UserProgress (memorization).
const annotationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pageNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 604,
    },
    // The verse this anchors to, e.g. "2:255". null ⇒ the whole page (only valid
    // for 'note' and 'hard'; a highlight always targets a specific verse).
    verseKey: {
      type: String,
      default: null,
    },
    kind: {
      type: String,
      enum: ['highlight', 'note', 'hard', 'drawing', 'text'],
      required: true,
    },
    // Highlights use one of the first four; drawing/text ink may also be 'ink'.
    // Per-kind rules live in the controller (highlights still reject 'ink').
    color: {
      type: String,
      enum: ['yellow', 'green', 'blue', 'pink', 'ink'],
      default: undefined,
    },
    // Notes only — the note body, trimmed, capped at 2000 chars.
    text: {
      type: String,
      trim: true,
      maxlength: [2000, 'Note cannot exceed 2000 characters'],
      default: undefined,
    },
    // Highlights only — an optional word-position span within the verse (1-based,
    // inclusive) so a highlight can cover just part of a long verse. Both unset ⇒
    // the whole verse is tinted.
    wordFrom: {
      type: Number,
      min: 1,
      default: undefined,
    },
    wordTo: {
      type: Number,
      min: 1,
      default: undefined,
    },
    // Drawings only — the page's ink strokes. Each point is [x, y] in the fixed
    // internal space (extended to the margins). The controller fully validates/
    // clamps this (the generic type-gate middleware can't, since it rejects
    // nested arrays), so the schema stays permissive on the point tuples.
    strokes: {
      type: [{
        tool: { type: String, enum: ['pen', 'highlighter'] },
        color: { type: String },
        width: { type: Number },
        points: { type: [[Number]] },
        _id: false,
      }],
      default: undefined,
    },
    // Free-floating text notes ('text' kind) — a small label placed anywhere on
    // the page (or its margins) at [x, y] in the same internal coordinate space.
    x: { type: Number, default: undefined },
    y: { type: Number, default: undefined },
  },
  { timestamps: true }
);

// Primary read path: every annotation on a page for the reader.
annotationSchema.index({ userId: 1, pageNumber: 1 });
// The "hard verses & pages" list pulls by kind.
annotationSchema.index({ userId: 1, kind: 1 });

module.exports = mongoose.model('Annotation', annotationSchema);
