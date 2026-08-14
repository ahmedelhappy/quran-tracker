const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  connect, disconnect, clearDatabase, seedMetadata,
  createUser, tokenFor,
} = require('./helpers');
const app = require('../app');
const Annotation = require('../models/Annotation');

// Verse-on-page validation reads the committed mushaf structure (segments.js), not
// the seeded test metadata — so real verse keys work regardless of seedMetadata.
// Page 1 is Al-Fatiha (1:1..1:7); page 2 is 2:1..2:5.

const authFor = (user) => `Bearer ${tokenFor(user._id)}`;
const post = (auth, body) => request(app).post('/api/annotations').set('Authorization', auth).send(body);

describe('Annotations API', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('protected: every route rejects requests without a token', async () => {
    assert.equal((await request(app).get('/api/annotations?page=1')).status, 401);
    assert.equal((await request(app).post('/api/annotations').send({ kind: 'hard', pageNumber: 1 })).status, 401);
    assert.equal((await request(app).put('/api/annotations/507f1f77bcf86cd799439011').send({ text: 'x' })).status, 401);
    assert.equal((await request(app).delete('/api/annotations/507f1f77bcf86cd799439011')).status, 401);
  });

  // ── Create, per kind ──────────────────────────────────────────────
  describe('POST — create per kind', () => {
    test('creates a highlight on a verse with a colour', async () => {
      const user = await createUser();
      const res = await post(authFor(user), { pageNumber: 1, verseKey: '1:1', kind: 'highlight', color: 'yellow' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.kind, 'highlight');
      assert.equal(res.body.data.color, 'yellow');
      assert.equal(res.body.data.verseKey, '1:1');
      assert.equal(res.body.data.text, undefined);
    });

    test('creates a highlight narrowed to a word span', async () => {
      const user = await createUser();
      const res = await post(authFor(user), { pageNumber: 1, verseKey: '1:2', kind: 'highlight', color: 'green', wordFrom: 2, wordTo: 4 });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.wordFrom, 2);
      assert.equal(res.body.data.wordTo, 4);
    });

    test('creates a note on a verse, trimming the text', async () => {
      const user = await createUser();
      const res = await post(authFor(user), { pageNumber: 1, verseKey: '1:1', kind: 'note', text: '  remember the makhraj  ' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.text, 'remember the makhraj');
      assert.equal(res.body.data.color, undefined);
    });

    test('creates a whole-page note (verseKey null)', async () => {
      const user = await createUser();
      const res = await post(authFor(user), { pageNumber: 3, verseKey: null, kind: 'note', text: 'tricky page' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.verseKey, null);
    });

    test('creates a hard flag on a verse and on a whole page', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const verse = await post(auth, { pageNumber: 2, verseKey: '2:1', kind: 'hard' });
      assert.equal(verse.status, 201);
      assert.equal(verse.body.data.verseKey, '2:1');

      const wholePage = await post(auth, { pageNumber: 5, kind: 'hard' });
      assert.equal(wholePage.status, 201);
      assert.equal(wholePage.body.data.verseKey, null);
    });
  });

  // ── Per-kind field validation ─────────────────────────────────────
  describe('POST — per-kind validation', () => {
    test('highlight requires a colour and a verse', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'highlight' })).status, 400); // no colour
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'highlight', color: 'teal' })).status, 400); // bad colour
      assert.equal((await post(auth, { pageNumber: 1, verseKey: null, kind: 'highlight', color: 'yellow' })).status, 400); // no verse
    });

    test('highlight rejects a reversed / partial word span', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:2', kind: 'highlight', color: 'blue', wordFrom: 5, wordTo: 2 })).status, 400);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:2', kind: 'highlight', color: 'blue', wordFrom: 2 })).status, 400); // only one bound
    });

    test('note requires non-empty text and rejects text over 2000 chars', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: '   ' })).status, 400);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'x'.repeat(2001) })).status, 400);
    });

    test('a note ignores a stray colour, a highlight ignores stray text (field separation)', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const note = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'hi', color: 'yellow' });
      assert.equal(note.status, 201);
      assert.equal(note.body.data.color, undefined); // colour only lives on highlights

      const highlight = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'highlight', color: 'pink', text: 'ignored' });
      assert.equal(highlight.status, 201);
      assert.equal(highlight.body.data.text, undefined); // text only lives on notes
    });

    test('rejects a verseKey that is not on the given page, and a malformed one', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '2:1', kind: 'hard' })).status, 400); // 2:1 is on page 2
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:8', kind: 'hard' })).status, 400); // Al-Fatiha ends at 1:7
      assert.equal((await post(auth, { pageNumber: 1, verseKey: 'not-a-key', kind: 'hard' })).status, 400);
    });

    test('rejects an unknown kind and an out-of-range page', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'scribble' })).status, 400);
      assert.equal((await post(auth, { pageNumber: 700, verseKey: '1:1', kind: 'hard' })).status, 400);
    });

    test('rejects a NoSQL-operator object where a scalar is expected', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const res = await post(auth, { pageNumber: 1, verseKey: { $gt: '' }, kind: 'hard' });
      assert.equal(res.status, 400);
    });
  });

  // ── Read ──────────────────────────────────────────────────────────
  describe('GET', () => {
    test('?page=N returns only that page\'s annotations for this user', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'highlight', color: 'yellow' });
      await post(auth, { pageNumber: 1, verseKey: '1:2', kind: 'note', text: 'a' });
      await post(auth, { pageNumber: 2, verseKey: '2:1', kind: 'hard' });

      const res = await request(app).get('/api/annotations?page=1').set('Authorization', auth);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.ok(res.body.data.every((a) => a.pageNumber === 1));
    });

    test('?kind=hard returns the hard list enriched with page surah labels', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await post(auth, { pageNumber: 2, verseKey: '2:1', kind: 'hard' });
      await post(auth, { pageNumber: 5, kind: 'hard' });
      await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'not hard' });

      const res = await request(app).get('/api/annotations?kind=hard').set('Authorization', auth);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 2);
      assert.ok(res.body.data.every((a) => a.kind === 'hard'));
      // sorted by page, enriched with the seeded "Surah N" label
      assert.deepEqual(res.body.data.map((a) => a.pageNumber), [2, 5]);
      assert.equal(res.body.data[0].surahName, 'Surah 2');
    });

    test('rejects a bad page and a request with no page/kind', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await request(app).get('/api/annotations?page=700').set('Authorization', auth)).status, 400);
      assert.equal((await request(app).get('/api/annotations').set('Authorization', auth)).status, 400);
    });
  });

  // ── Update ────────────────────────────────────────────────────────
  describe('PUT /:id', () => {
    test('edits a note\'s text', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const created = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'first' });
      const res = await request(app).put(`/api/annotations/${created.body.data._id}`).set('Authorization', auth).send({ text: '  second  ' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.text, 'second');
    });

    test('changes a highlight\'s colour', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const created = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'highlight', color: 'yellow' });
      const res = await request(app).put(`/api/annotations/${created.body.data._id}`).set('Authorization', auth).send({ color: 'blue' });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.color, 'blue');

      const bad = await request(app).put(`/api/annotations/${created.body.data._id}`).set('Authorization', auth).send({ color: 'teal' });
      assert.equal(bad.status, 400);
    });

    test('a hard flag has nothing to edit', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const created = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'hard' });
      const res = await request(app).put(`/api/annotations/${created.body.data._id}`).set('Authorization', auth).send({ text: 'x' });
      assert.equal(res.status, 400);
    });

    test('404 for a missing or malformed id', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await request(app).put('/api/annotations/507f1f77bcf86cd799439011').set('Authorization', auth).send({ text: 'x' })).status, 404);
      assert.equal((await request(app).put('/api/annotations/not-an-id').set('Authorization', auth).send({ text: 'x' })).status, 404);
    });
  });

  // ── Delete ────────────────────────────────────────────────────────
  describe('DELETE /:id', () => {
    test('removes the user\'s own annotation', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const created = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'hard' });
      const res = await request(app).delete(`/api/annotations/${created.body.data._id}`).set('Authorization', auth);
      assert.equal(res.status, 200);
      assert.equal(await Annotation.countDocuments({ userId: user._id }), 0);
    });

    test('404 for a missing id', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await request(app).delete('/api/annotations/507f1f77bcf86cd799439011').set('Authorization', auth)).status, 404);
    });
  });

  // ── Ownership isolation ───────────────────────────────────────────
  describe('ownership isolation', () => {
    test('one user cannot read, edit, or delete another\'s annotations', async () => {
      const alice = await createUser({ email: `alice${Date.now()}@x.com` });
      const bob = await createUser({ email: `bob${Date.now()}@x.com` });
      const aliceAuth = authFor(alice);
      const bobAuth = authFor(bob);

      const created = await post(aliceAuth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'alice only' });
      const id = created.body.data._id;

      // Bob's page read never sees Alice's note.
      const bobPage = await request(app).get('/api/annotations?page=1').set('Authorization', bobAuth);
      assert.equal(bobPage.body.data.length, 0);

      // Bob cannot edit or delete it (scoped lookup → 404), and it survives.
      assert.equal((await request(app).put(`/api/annotations/${id}`).set('Authorization', bobAuth).send({ text: 'hacked' })).status, 404);
      assert.equal((await request(app).delete(`/api/annotations/${id}`).set('Authorization', bobAuth)).status, 404);
      assert.equal(await Annotation.countDocuments({ _id: id }), 1);
    });
  });

  // ── Per-user cap ──────────────────────────────────────────────────
  describe('cap', () => {
    test('rejects a create once the user is at the 2000-annotation cap', async () => {
      const user = await createUser();
      const auth = authFor(user);
      // Seed exactly 2000 directly (fast) so the next create trips the cap.
      const docs = Array.from({ length: 2000 }, () => ({ userId: user._id, pageNumber: 1, verseKey: null, kind: 'hard' }));
      await Annotation.insertMany(docs);

      const res = await post(auth, { pageNumber: 1, verseKey: '1:1', kind: 'note', text: 'one too many' });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /2000-annotation limit/);
    });
  });

  // ── Free-form drawings ────────────────────────────────────────────
  describe('PUT /drawing', () => {
    const stroke = (over = {}) => ({ tool: 'pen', color: 'ink', width: 3, points: [[10, 20], [30, 40]], ...over });
    const putDrawing = (auth, body) => request(app).put('/api/annotations/drawing').set('Authorization', auth).send(body);

    test('upserts one drawing doc per page, then replaces it', async () => {
      const user = await createUser();
      const auth = authFor(user);

      const create = await putDrawing(auth, { pageNumber: 3, strokes: [stroke()] });
      assert.equal(create.status, 200);
      assert.equal(create.body.data.kind, 'drawing');
      assert.equal(create.body.data.verseKey, null);
      assert.equal(create.body.data.strokes.length, 1);

      // A second PUT replaces (not appends) — still exactly one doc for the page.
      const replace = await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ tool: 'highlighter', color: 'yellow', width: 20 }), stroke()] });
      assert.equal(replace.status, 200);
      assert.equal(replace.body.data.strokes.length, 2);
      assert.equal(await Annotation.countDocuments({ userId: user._id, pageNumber: 3, kind: 'drawing' }), 1);
    });

    test('empty strokes deletes the page drawing', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await putDrawing(auth, { pageNumber: 3, strokes: [stroke()] });
      const del = await putDrawing(auth, { pageNumber: 3, strokes: [] });
      assert.equal(del.status, 200);
      assert.equal(del.body.data, null);
      assert.equal(await Annotation.countDocuments({ userId: user._id, pageNumber: 3, kind: 'drawing' }), 0);
    });

    test('the drawing comes back with the page in GET ?page=N', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await putDrawing(auth, { pageNumber: 3, strokes: [stroke()] });
      const page = await request(app).get('/api/annotations?page=3').set('Authorization', auth);
      const drawing = page.body.data.find((a) => a.kind === 'drawing');
      assert.ok(drawing);
      assert.deepEqual(drawing.strokes[0].points, [[10, 20], [30, 40]]);
    });

    test('clamps coordinates into the margin-extended bounds (x -52..576, y -34..834)', async () => {
      const user = await createUser();
      const auth = authFor(user);
      // -50 / 20 stay (within the extended margins); 999 clamps to the extended max.
      const res = await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ points: [[-50, 20], [999, 999]] })] });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.strokes[0].points, [[-50, 20], [576, 834]]);
      // Values past the margin clamp to the extended edge, not to 0/524/800.
      const res2 = await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ points: [[-500, -500]] })] });
      assert.deepEqual(res2.body.data.strokes[0].points, [[-52, -34]]);
    });

    test('rejects bad tool, colour, width, and malformed points', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ tool: 'brush' })] })).status, 400);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ color: 'teal' })] })).status, 400);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ width: 0 })] })).status, 400);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ points: [[1, 2, 3]] })] })).status, 400);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ points: [['a', 'b']] })] })).status, 400);
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: 'notarray' })).status, 400);
      // 'ink' is a valid drawing colour even though it isn't a highlight colour.
      assert.equal((await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ color: 'ink' })] })).status, 200);
    });

    test('rejects a drawing over the 64KB serialized cap', async () => {
      const user = await createUser();
      const auth = authFor(user);
      // ~9000 points × ~10 bytes each ≫ 64KB in one stroke.
      const points = Array.from({ length: 8000 }, (_, i) => [i % 524, (i * 2) % 800]);
      const res = await putDrawing(auth, { pageNumber: 3, strokes: [stroke({ points })] });
      assert.equal(res.status, 400);
      assert.match(res.body.message, /too large/i);
    });

    test('drawings are per-user: one user cannot read or overwrite another\'s', async () => {
      const alice = await createUser({ email: `a${Date.now()}@x.com` });
      const bob = await createUser({ email: `b${Date.now()}@x.com` });
      await putDrawing(authFor(alice), { pageNumber: 3, strokes: [stroke({ color: 'blue' })] });
      await putDrawing(authFor(bob), { pageNumber: 3, strokes: [stroke({ color: 'pink' })] });

      const alicePage = await request(app).get('/api/annotations?page=3').set('Authorization', authFor(alice));
      const aliceDraw = alicePage.body.data.find((a) => a.kind === 'drawing');
      assert.equal(aliceDraw.strokes[0].color, 'blue'); // untouched by Bob
      assert.equal(await Annotation.countDocuments({ kind: 'drawing', pageNumber: 3 }), 2); // one each
    });
  });

  // ── Free-floating text notes ──────────────────────────────────────
  describe('text notes (kind: text)', () => {
    const mkText = (auth, over = {}) => post(auth, { pageNumber: 3, kind: 'text', x: 100, y: 200, text: 'note here', color: 'ink', ...over });

    test('creates a free-floating text note at x,y (verseKey null)', async () => {
      const user = await createUser();
      const res = await mkText(authFor(user));
      assert.equal(res.status, 201);
      assert.equal(res.body.data.kind, 'text');
      assert.equal(res.body.data.verseKey, null);
      assert.equal(res.body.data.x, 100);
      assert.equal(res.body.data.y, 200);
      assert.equal(res.body.data.text, 'note here');
      assert.equal(res.body.data.color, 'ink');
    });

    test('supports multiple text notes per page (each counts as an annotation)', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await mkText(auth, { x: 10, y: 10 });
      await mkText(auth, { x: 20, y: 20, color: 'yellow' });
      const page = await request(app).get('/api/annotations?page=3').set('Authorization', auth);
      assert.equal(page.body.data.filter((a) => a.kind === 'text').length, 2);
    });

    test('clamps x,y into the margin-extended bounds and trims text', async () => {
      const user = await createUser();
      const res = await mkText(authFor(user), { x: -999, y: 999, text: '  spaced  ' });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.x, -52);
      assert.equal(res.body.data.y, 834);
      assert.equal(res.body.data.text, 'spaced');
    });

    test('validates: empty text, >300 chars, bad colour, non-number coords', async () => {
      const user = await createUser();
      const auth = authFor(user);
      assert.equal((await mkText(auth, { text: '   ' })).status, 400);
      assert.equal((await mkText(auth, { text: 'x'.repeat(301) })).status, 400);
      assert.equal((await mkText(auth, { color: 'teal' })).status, 400);
      assert.equal((await mkText(auth, { x: 'nope' })).status, 400);
      // 'ink' and the four highlight colours are all valid for text.
      assert.equal((await mkText(auth, { color: 'green' })).status, 201);
    });

    test('edits text/colour and moves (x,y) via PUT /:id', async () => {
      const user = await createUser();
      const auth = authFor(user);
      const created = await mkText(auth);
      const id = created.body.data._id;

      const edited = await request(app).put(`/api/annotations/${id}`).set('Authorization', auth).send({ text: 'edited', color: 'pink' });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.data.text, 'edited');
      assert.equal(edited.body.data.color, 'pink');

      const moved = await request(app).put(`/api/annotations/${id}`).set('Authorization', auth).send({ x: 300, y: 400 });
      assert.equal(moved.status, 200);
      assert.equal(moved.body.data.x, 300);
      assert.equal(moved.body.data.y, 400);
      assert.equal(moved.body.data.text, 'edited'); // unchanged
    });

    test('a text note and a drawing coexist on a page (eraser never touches text)', async () => {
      const user = await createUser();
      const auth = authFor(user);
      await mkText(auth, { x: 5, y: 5 });
      await request(app).put('/api/annotations/drawing').set('Authorization', auth)
        .send({ pageNumber: 3, strokes: [{ tool: 'pen', color: 'ink', width: 3, points: [[1, 1], [2, 2]] }] });
      // Clearing the drawing (empty strokes) leaves the text note intact.
      await request(app).put('/api/annotations/drawing').set('Authorization', auth).send({ pageNumber: 3, strokes: [] });
      const page = await request(app).get('/api/annotations?page=3').set('Authorization', auth);
      assert.equal(page.body.data.filter((a) => a.kind === 'drawing').length, 0);
      assert.equal(page.body.data.filter((a) => a.kind === 'text').length, 1);
    });
  });

  // ── Summary aggregate ─────────────────────────────────────────────
  describe('GET /summary', () => {
    test('returns per-page kind counts ordered by page, with a note excerpt', async () => {
      const user = await createUser();
      const auth = authFor(user);

      await post(auth, { pageNumber: 5, verseKey: '2:26', kind: 'highlight', color: 'yellow' });
      await post(auth, { pageNumber: 5, verseKey: '2:27', kind: 'hard' });
      await post(auth, { pageNumber: 2, verseKey: '2:1', kind: 'note', text: 'first note here' });
      await request(app).put('/api/annotations/drawing').set('Authorization', auth)
        .send({ pageNumber: 2, strokes: [{ tool: 'pen', color: 'ink', width: 3, points: [[1, 1], [2, 2]] }] });

      const res = await request(app).get('/api/annotations/summary').set('Authorization', auth);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.map((p) => p.pageNumber), [2, 5]); // ordered

      const page2 = res.body.data.find((p) => p.pageNumber === 2);
      assert.deepEqual(page2.counts, { highlight: 0, note: 1, hard: 0, drawing: 1, text: 0 });
      assert.equal(page2.noteExcerpt, 'first note here');

      const page5 = res.body.data.find((p) => p.pageNumber === 5);
      assert.deepEqual(page5.counts, { highlight: 1, note: 0, hard: 1, drawing: 0, text: 0 });
      assert.equal(page5.noteExcerpt, null);
    });

    test('is per-user and empty for a user with no annotations', async () => {
      const alice = await createUser({ email: `a2${Date.now()}@x.com` });
      const bob = await createUser({ email: `b2${Date.now()}@x.com` });
      await post(authFor(alice), { pageNumber: 1, verseKey: '1:1', kind: 'hard' });

      const bobSummary = await request(app).get('/api/annotations/summary').set('Authorization', authFor(bob));
      assert.equal(bobSummary.status, 200);
      assert.deepEqual(bobSummary.body.data, []);
    });

    test('protected', async () => {
      assert.equal((await request(app).get('/api/annotations/summary')).status, 401);
    });
  });
});
