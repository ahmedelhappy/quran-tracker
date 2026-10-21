> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Audit notes: server tests, seed scripts, deploy config

Auditor scope: `server/tests/*`, `server/seed/*`, `server/package.json`, `server/.env.example`, `render.yaml`.
I opened routes, controllers, models, middleware and utils only as far as I needed to map tests to behaviour.
Read-only. I did not run the test suite, any seed script or `server.js`, and I did not open `.env`.
The only things I executed were two local read-only Node scripts in the scratchpad. One measured the integrity of `quranStructure.json`; the other read dependency `engines` from `package-lock.json`.

---

## 1. Coverage manifest

| Path | Lines | Read in full | Note |
|---|---|---|---|
| server/tests/helpers.js | 105 | YES | mongodb-memory-server per file, `JWT_SECRET` fallback `'test-secret'`, `NODE_ENV=test`, `clearDatabase` deletes every collection (keeps indexes), fake `seedMetadata` |
| server/tests/auth.test.js | 135 | YES | 8 tests: register/login/me, password-change token invalidation, NoSQL login. Short-password assertion is weak (`notEqual 201`) |
| server/tests/annotations.test.js | 723 | YES | Most thorough file: per-kind validation, IDOR, caps, drawings, batch atomicity with a simulated mid-batch failure |
| server/tests/bookmarks.test.js | 456 | YES | Thorough: CRUD, uniqueness, index migration, IDOR on PUT/DELETE, cap, NoSQL |
| server/tests/chat.test.js | 180 | YES | Groq stubbed through `require.cache`. Summary matches `/today`; system prompt contents; 401. No validation, 429 or 502 tests |
| server/tests/leaderboard.test.js | 204 | YES | Opt-in visibility, week/all, fractional pages, rank outside top 50, cache invalidation across writes |
| server/tests/progress.test.js | 664 | YES | Scheduling (cycle, recent, fromEnd, anchor, half-page), off-day, streak + undo. No validation or 401 tests except `/today` |
| server/tests/quranStructure.test.js | 76 | YES | Pure data checks on the committed JSON. Contiguity check is weaker than it looks (see F-15) |
| server/tests/todos.test.js | 248 | YES | 401 on all 7 routes, IDOR on all, validation, cap; account deletion checked for todos ONLY |
| server/tests/units.test.js | 262 | YES | Pure `segments.js` unit compilation + `/units` endpoint round trips, 401, 400 |
| server/seed/demoData.js | 126 | YES | Hard-coded public demo credentials (password [REDACTED]); writes to `MONGODB_URI` (prod) with no guard; wipes the demo user's UserProgress |
| server/seed/fetchQuranStructure.js | 132 | YES | quran.com v4 by_page; retries; writes JSON with NO self-validation |
| server/seed/fetchSearchIndex.js | 146 | YES | Cross-checks 2 endpoints + structure; fails closed. Strong |
| server/seed/quranData.js | 47 | YES | `deleteMany({})` then `insertMany`, not atomic, no env guard |
| server/seed/surahNames.js | 125 | YES | 114 names, EN + AR |
| server/seed/data/quranStructure.json | ~305 KB | NO (by instruction) | Read first 80 lines for shape. Measured: 604 pages, 6236 unique verse keys, 1:1 to 114:6, 240 rub boundaries, juz/hizb monotonic, max 30/60, 114 surahs |
| server/package.json | 37 | YES | `engines >=18` conflicts with mongoose 9 / mongodb 7 (`>=20.19.0`) and the `node --test` glob (Node 21+) |
| server/.env.example | 4 | YES | Missing `GROQ_API_KEY`, `GROQ_MODEL`, `NODE_ENV` |
| render.yaml | 16 | YES | No `GROQ_API_KEY`, no `healthCheckPath`, `npm install` rather than `npm ci` |
| Supporting (partial, as needed) | | | routes/*.js (all, full), app.js, server.js, middleware/{auth,validate,rateLimiters,chatRateLimit}.js (full), models/{User,UserProgress}.js (full), controllers/authController.js (full), chatController.js (full), leaderboardController.js (full), progressController.js (lines 1-112, 405-504, 600-929, 1110-1209), bookmarkController.js (grep for query scoping), utils/{errorResponse,leaderboardCache}.js (full), segments.js (pageFraction) |

---

## 2. Route × test matrix

Legend: Y = tested, N = not tested, N/A = not applicable. For routes with no `:id`, the resource is selected by the token, so classic IDOR does not apply. "X-user" then means "a test proves that two users' data stay separate".

| Route | (a) Happy | (b) IDOR / X-user | (c) Validation | (d) Unauth 401 | Flag |
|---|---|---|---|---|---|
| POST /api/auth/register | Y | N/A | weak (short password only, `notEqual 201`; masks a 500) | N/A public | dup-email, missing fields, rate limit untested |
| POST /api/auth/login | Y | N/A | Y (wrong password 401, NoSQL 400) | N/A public | missing fields, rate limit untested |
| GET /api/auth/me | Y | N/A | N/A | Y (+ stale token after password change) | bad-signature, expired, deleted-user tokens untested |
| PUT /api/auth/profile | Y (via progress/leaderboard tests) | N/A | partial (displayName < 3, opt-in without name) | **N** | dailyNewPages/offDays/enum ranges and NoSQL type gate untested |
| PUT /api/auth/password | Y | N/A | **N** (wrong current, short, same-as-old) | **N** | **no validation test** |
| DELETE /api/auth/account | Y (todos only) | N/A | N/A | **N** | **cascade untested for UserProgress/Bookmark/Annotation; it is in fact broken** |
| POST /api/progress/onboarding | **N** | N | **N** | **N** | **completely untested** |
| PUT /api/progress/memorized | Y | N | **N** | **N** | no validation test |
| PUT /api/progress/units | Y | N | Y | Y | |
| DELETE /api/progress/reset | indirect (leaderboard only; does not assert rows gone or streak reset) | N | N/A | **N** | weak |
| GET /api/progress/today | Y (many) | N | **N** (`ignoreOffDay`) | Y | |
| POST /api/progress/complete | Y | N | **N** (page range, type, segment) | **N** | **no validation test** |
| POST /api/progress/uncomplete | Y | N | **N** (not-today, bad type) | **N** | **no validation test** |
| GET /api/progress/all | Y | N | N/A | **N** | |
| GET /api/progress/juz | Y (1 assertion set) | N | N/A | **N** | |
| GET /api/progress/estimate | **N** | N | **N** | **N** | **completely untested** |
| GET /api/progress/week | Y | N | N/A | **N** | |
| GET /api/bookmarks | Y | Y | N/A | Y | |
| POST /api/bookmarks | Y | Y (labels per user) | Y | N | |
| PUT /api/bookmarks/:id | Y | Y | Y | Y | |
| DELETE /api/bookmarks/:id | Y | Y | Y (malformed → 404) | N | |
| GET /api/annotations | Y | Y | Y | Y | |
| POST /api/annotations | Y | N/A | Y | Y | |
| PUT /api/annotations/:id | Y | Y | Y | Y | |
| DELETE /api/annotations/:id | Y | Y | Y (404) | Y | |
| GET /api/annotations/summary | Y | Y | N/A | Y | |
| GET /api/annotations/verses | Y | Y | Y | Y | |
| PUT /api/annotations/drawing | Y | Y | Y | **N** | |
| POST /api/annotations/batch | Y | Y | Y | Y | |
| GET /api/todos | Y | Y | N/A | Y | |
| POST /api/todos | Y | N/A | Y | Y | |
| PUT /api/todos/reorder | Y | Y | Y | Y | |
| DELETE /api/todos/completed | Y | Y | N/A | Y | |
| POST /api/todos/restore | Y | N/A | Y | Y | |
| PUT /api/todos/:id | Y | Y | Y | Y | |
| DELETE /api/todos/:id | Y | Y | Y | Y | |
| GET /api/leaderboard | Y | Y (opt-out hidden) | **N** (period) | Y | response privacy contract (no email/name) not asserted |
| POST /api/chat | Y (mocked) | **N** | **N** (array size, role, length) | Y | 429 and 502 paths untested |
| GET /health, GET /, 404 catch-all | **N** | N/A | N/A | N/A | trivial, but the health check is what Render/UptimeRobot depend on |

**Routes with neither an IDOR/cross-user test nor a validation test:** `/auth/password`, `/auth/account`, `/progress/onboarding`, `/progress/memorized`, `/progress/reset`, `/progress/today` (validation), `/progress/complete`, `/progress/uncomplete`, `/progress/all`, `/progress/juz`, `/progress/estimate`, `/progress/week`, `/chat`, `/leaderboard` (validation).
**Untested 401:** 13 routes, mostly in progress and auth. All of them sit behind `router.use(protect)` or an explicit `protect`, so the risk is a future regression rather than a current bug.

---

## 3. Findings

### F-01. Account deletion leaves Bookmarks and Annotations (incl. personal note text) in the database; only Todos are tested
- **Severity:** High · **Category:** Privacy / data lifecycle · **Confidence:** LIKELY (certain from code; not executed)
- **Evidence:** `server/controllers/authController.js:438-446`
  ```js
  await UserProgress.deleteMany({ userId });
  await Todo.deleteMany({ userId });
  await User.findByIdAndDelete(userId);
  ```
  `Bookmark` (`models/Bookmark.js:8`) and `Annotation` (`models/Annotation.js:18`) both carry `userId`. `User.js` has no cascade hook. The only cascade test is `tests/todos.test.js:240-247`, and it checks `Todo` only. The route doc says "Delete current user account and all associated data".
  The handler also does not call `leaderboardCache.clear()`, so an opted-in deleted user stays on the public board for up to 5 minutes (`utils/leaderboardCache.js:13`).
- **Impact:** Notes, highlights, hard flags, drawings and bookmarks outlive the account. The note text is free-form personal content. This contradicts the delete promise in the UI and API. It is a GDPR-style erasure failure, and the orphaned data accumulates.
- **Recommendation:** Delete from every user-keyed collection. Use `Promise.all` or a transaction, and delete the User document last. Clear the leaderboard cache. Add one test that seeds rows in every collection for user A and user B, deletes A, and asserts A has 0 rows everywhere and B is untouched. Also consider a model-registry-driven assertion: every model with a `userId` path must be covered.
- **Effort:** S

### F-02. Public demo account (credentials shown on the Login page) has no server-side guard
- **Severity:** Medium · **Category:** Abuse / authz design · **Confidence:** SUSPECTED (depends on the demo being seeded in prod; the Login hint implies it is)
- **Evidence:** `server/seed/demoData.js:6-7`: `const DEMO_EMAIL = 'demo@qurantracker.com'; const DEMO_PASSWORD = '[REDACTED]';`. The same pair is rendered at `client/src/locales/en.json:54` / `ar.json:54` through `client/src/pages/Login.jsx:96`. A grep for `demo` in controllers and middleware finds no guard.
- **Impact:** Any visitor can:
  - change the demo password through `PUT /auth/password`, which logs everyone else out and locks the demo;
  - delete the demo account through `DELETE /auth/account`;
  - set a `displayName` and opt in to the leaderboard, which shows that name to every authenticated user;
  - leave notes and drawings that the next visitor sees;
  - exhaust the shared per-user chat quota (20 per 5 min) and Groq spend.
- **Recommendation:** Add an `isDemo` flag (or a check on the demo email) that rejects password change, account delete, leaderboard opt-in and displayName changes, and possibly chat. Reset demo data on a schedule or on login. Add tests for each rejected action.
- **Effort:** S-M

### F-03. No CI, and the declared Node engine is wrong for both runtime and tests
- **Severity:** Medium · **Category:** Build / deploy / test infrastructure · **Confidence:** CONFIRMED (measured from `package-lock.json`)
- **Evidence:** `server/package.json:15-17` declares `"engines": { "node": ">=18.0.0" }`. The lockfile says mongoose 9.1.5, mongodb 7.0.0 and mongodb-memory-server 11.2.0 each need `"node":">=20.19.0"`. `package.json:9` has `"test": "node --test \"tests/**/*.test.js\""`, and glob patterns for `node --test` only exist in Node 21+. On Node 20 the pattern is treated as a literal path. There is no `.github/` and no workflow file anywhere in the repo (`git ls-files`), so the suite only runs when someone remembers to run it.
- **Impact:** A host that honours `>=18` could pick an unsupported Node. Contributors on Node 20 LTS cannot run `npm test`. Nothing gates regressions before deploy.
- **Recommendation:** Set `engines` to `>=20.19.0` (or `>=22`) and add `.nvmrc`. Add a GitHub Actions job that runs `npm ci && npm test` (server) and `npm ci && npm run lint && npm run build` (client). Cache the mongodb-memory-server binary, because its first run downloads mongod.
- **Effort:** S

### F-04. Model validation errors become HTTP 500 (and leak the raw message outside production); the test masks it
- **Severity:** Medium · **Category:** Error handling / test quality · **Confidence:** LIKELY
- **Evidence:** `tests/auth.test.js:24-25`
  ```js
  // The model enforces minlength: 6, so registration must not succeed.
  assert.notEqual(res.status, 201);
  ```
  `authController.register` passes the Mongoose `ValidationError` to `serverError` (`authController.js:54-56`), which always sends `res.status(500)` and adds `body.error = error.message` when `NODE_ENV !== 'production'` (`utils/errorResponse.js:8-11`). The same path covers a missing name or email, an invalid email format, and the duplicate-email race (E11000 after the `findOne` check at line 23).
- **Impact:** Clients get "server error" for user mistakes, and monitoring counts user typos as 5xx. The test passes whether the response is 400 or 500.
- **Recommendation:** Map `ValidationError` to 400 and E11000 to 409, or validate in the controller. Change the test to `assert.equal(res.status, 400)` and add cases for missing fields and duplicate email.
- **Effort:** S

### F-05. Core write endpoints have no negative tests; onboarding and estimate have no tests at all
- **Severity:** Medium · **Category:** Test coverage · **Confidence:** CONFIRMED (grep of every route string across `tests/`)
- **Evidence:** In the route-reference grep, `/api/progress/onboarding` and `/api/progress/estimate` match 0 test files. `/complete`, `/uncomplete` and `/password` are only ever called with valid input. See the matrix.
- **Impact:** Onboarding is the first write every new user makes. It also has real validation holes (F-06) that tests would have caught.
- **Recommendation:** See §4, priority 1.
- **Effort:** S-M

### F-06. Page-number integrity: onboarding has no range or integer check; complete/memorized accept non-integers; a malformed `segment` silently marks the whole page
- **Severity:** Medium · **Category:** Input validation / data integrity · **Confidence:** LIKELY
- **Evidence:**
  - `progressController.js:423-445`: `memorizedPages.map(pageNumber => ({ updateOne: { filter: { userId, pageNumber }, ... upsert: true } }))`. The array is not range-checked, not checked for integers, and not size-capped. The type gate only checks `numberArray`. `bulkWrite`/`findOneAndUpdate` upserts do not run schema validators by default, so `min:1,max:604` in `models/UserProgress.js:12-13` does not apply.
  - `markPageComplete` (`:676`) checks `!pageNumber || pageNumber < 1 || pageNumber > 604`. That lets `1.5` through, and the non-segment path then upserts page 1.5.
  - `updateMemorized` (`:1124`) uses `.filter(n => n >= 1 && n <= 604)` and also keeps non-integers.
  - `:689`: `if (segment && typeof segment.fromVerseKey === 'string' && ...)`. Any other `segment` shape falls into the whole-page branch, so a half-page user's malformed request marks the full page. `segment` is not in `completeSchema` (`routes/progressRoutes.js:27`).
  - `pageFraction` returns 1 for unknown pages (`utils/segments.js:236`). Invalid rows therefore inflate `totalMemorized`, and can push it past 604, which in turn skews `isHafiz` and the leaderboard.
- **Impact:** Corrupt progress rows and wrong stats. A very large onboarding array becomes one huge `bulkWrite`.
- **Recommendation:** Require integers 1..604 everywhere, dedupe, and cap the array at 604. Reject a present-but-malformed `segment` with 400. Add `segment` to the type gate. Add tests.
- **Effort:** S

### F-07. Marking an already-memorized page "new" rewrites its history, and a same-day undo then deletes the record
- **Severity:** Medium · **Category:** Data loss · **Confidence:** LIKELY on the server path; SUSPECTED for real-world reach (the Library client guards it with `memorizedPages.has(page)`, `Library.jsx:3460`, but stale state, multiple tabs or direct API use bypass that)
- **Evidence:** `progressController.js:712-715` upserts `$set: { status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate, segments: [] }` without checking for an existing memorized row. `unmarkPageComplete` (`:795-799`) then runs `findOneAndDelete({ userId, pageNumber, memorizedDate: { $gte: todayStart, $lt: tomorrowStart } })`. The comment at `:785-789` already concedes the half-page variant of this loss.
- **Impact:** A page memorized months ago is erased by mark + undo. Its review count and memorized date are lost.
- **Recommendation:** Make the `new` path a no-op, or return 409, when a full memorized row already exists. Have undo restore a snapshot of the previous values instead of deleting. Test: old page → complete(new) → uncomplete(new) → row still exists with its original dates.
- **Effort:** M

### F-08. Streak and day logic is UTC-only and its edge cases are untested; a few tests are time-of-day dependent
- **Severity:** Medium · **Category:** Correctness / test flakiness · **Confidence:** LIKELY (logic); SUSPECTED (flake frequency is low)
- **Evidence:**
  - `isStreakContinued` (`progressController.js:56-69`) bridges gaps over off-days. No test covers a gap longer than one day: every streak test uses `daysAgo(1)` (`progress.test.js:397,415,442,464`).
  - Off-day uses `new Date().getUTCDay()` (`:477`, `:366`, `:929`). For the target audience (UTC+2/+3), a Friday rest day runs from 02:00/03:00 Friday to 02:00/03:00 Saturday local time, and pages done at 01:00 local count toward the previous day.
  - The streak ticks inside GET `/today` (off-day tick `:487-494`, view-only tick `:622-632`) are not covered by any test.
  - Flaky patterns:
    - `progress.test.js:301` computes `todayUtcDay` before the request.
    - `:356-357` compares `lastReviewedDate` with a `today` computed after the request.
    - The `daysAgo(1)` streak tests expect `newStreak === 6`; if the run crosses UTC midnight, "yesterday" becomes two days ago and the result is 1.
    - `leaderboard.test.js` `makeContender` uses `new Date()`.

    Each one fails only when a test straddles 00:00 UTC (a millisecond-scale window), so the risk is low but real in long CI runs.
- **Impact:** Users who keep a local schedule can lose streaks or see the rest day on the wrong local day. The undo/streak code has many branches and only the one-day path is protected.
- **Recommendation:**
  - Inject a clock. `planToday` already takes `now`; extend that to `isStreakContinued`, `getTodayTasks`, `markPageComplete` and `reconcileStreakAfterUndo`, or use `node:test`'s `mock.timers`.
  - Add table tests for: gap 2 with an off-day between (continues), gap 2 without one (resets), gap across two off-days, off-day GET tick then undo, and the view-only tick.
  - Separately, decide on a per-user timezone (`tz` field plus `Intl`-based day strings).
- **Effort:** M (tests) / L (timezone support)

### F-09. Concurrency (double submit) is untested; some read-then-write paths can lose updates
- **Severity:** Low · **Category:** Concurrency · **Confidence:** SUSPECTED
- **Evidence:**
  - `markPageComplete` review path: `$inc: { reviewCount: 1 }` (`:721`). A double-click counts two reviews.
  - The segment path does `findOne` (`:696`) and then `findOneAndUpdate` with the merged segments (`:703`). Two concurrent half-segment completions lose one.
  - The caps (annotations 2000, todos, bookmarks 100) are count-then-insert, so a burst can exceed them.
  - The streak read-modify-write (`:732-757`) is benign under a race, because both writers compute the same value.
  - Concurrent upserts on `{userId,pageNumber}` are safe: MongoDB 4.2+ retries a unique-key upsert collision.
- **Recommendation:** Use `Promise.all` double-submit tests for complete(review), complete(new + segment) and the caps. Fix with conditional updates, for example `lastReviewedDate: { $lt: todayStart }` in the review filter so a same-day repeat is a no-op.
- **Effort:** S-M

### F-10. Rate limiters are never exercised by tests
- **Severity:** Low · **Category:** Test coverage / security controls · **Confidence:** CONFIRMED (code)
- **Evidence:** `middleware/rateLimiters.js:7` sets `const isTest = process.env.NODE_ENV === 'test';` and makes `authLimiter` and `apiLimiter` pass-throughs. `chatLimiter` is real under test but nothing drives it to 429.
- **Recommendation:** Export a factory, or read the limit from env, so that one test can build the app with a tiny limit and assert 429 plus the JSON shape. Do this for the login limiter and the chat limiter (per-user key).
- **Effort:** S

### F-11. Chat endpoint: validation, upstream failure and cross-user isolation untested
- **Severity:** Low · **Category:** Test coverage · **Confidence:** CONFIRMED (code)
- **Evidence:** `chatController.js:107-133` has three 400 branches. `:157-159` maps every Groq error to 502. `tests/chat.test.js` covers none of them. The design itself is safe: the summary is built from `req.user` only (`:143`). The user's own `name` goes verbatim into the system prompt (`:53`), which is a self-only injection surface.
- **Recommendation:**
  - Add tests for `messages` that is not an array, has 0 items, or has 11; for `role: 'system'` (must be rejected); and for content longer than 2001 characters.
  - Make the fake throw and assert 502.
  - Create two users and assert the system prompt contains only the caller's data.
- **Effort:** S

### F-12. Seed scripts write to whatever `MONGODB_URI` is, which locally is the production Atlas DB, with no guard
- **Severity:** Low · **Category:** Operational safety · **Confidence:** LIKELY
- **Evidence:**
  - `seed/quranData.js:27-34`: `await mongoose.connect(process.env.MONGODB_URI); await QuranMetadata.deleteMany({}); ... await QuranMetadata.insertMany(pages);`. It has no `NODE_ENV` check, no confirmation flag and no transaction. If the insert fails, the collection is left empty. Running servers keep their in-memory metadata cache (`utils/quranMetadataCache`) and do not see the change.
  - `seed/demoData.js:16,62` connects to the same URI. It resets the demo password (which also sets `passwordChangedAt`) and runs `col.deleteMany({ userId: user._id })` on the raw collection, bypassing validation. It does not reset the demo's annotations, bookmarks, todos or leaderboard fields.
  - Both are idempotent in outcome. `quranData` writes identical static data.
  - `demoData` mixes local `setDate` with `setUTCHours` (`:21-27`), so the Friday-skip day depends on the machine's timezone.
- **Recommendation:**
  - Require an explicit `--target-uri` or a `SEED_ALLOW_PROD=1` flag, and print the masked host before writing.
  - For `quranData`, write to a temp collection and rename it, or upsert by `pageNumber` instead of delete+insert.
  - Make the demo seed also clear the demo's other collections and leaderboard fields.
- **Effort:** S

### F-13. Deploy config gaps (render.yaml / .env.example)
- **Severity:** Low · **Category:** Deploy config · **Confidence:** LIKELY (devDependencies point SUSPECTED)
- **Evidence:**
  - `render.yaml:8-16` lists `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` and `CLIENT_URL` only. `GROQ_API_KEY` and `GROQ_MODEL` are missing, so a fresh blueprint deploy has chat failing with 502. `.env.example` (4 lines) also lacks `GROQ_API_KEY`.
  - No `healthCheckPath: /health`, although `app.js:45` exists for exactly that.
  - `buildCommand: npm install` should be `npm ci` for lockfile-exact, reproducible builds.
  - With `NODE_ENV=production` visible at build time, `npm install` omits devDependencies, which is fine. Making it explicit (`npm ci --omit=dev`) removes the ambiguity.
  - No Node version pin (see F-03).
  - `server.js:10` treats only `MONGODB_URI` and `JWT_SECRET` as required. Logging a warning at boot when `GROQ_API_KEY` is absent would make the missing chat key visible.
- **Recommendation:** Add the missing env keys with `sync: false`, add `healthCheckPath: /health`, use `npm ci --omit=dev`, and pin `NODE_VERSION` or `engines`.
- **Effort:** S

### F-14. Test fixture fidelity: `seedMetadata` is fake while the real data is committed
- **Severity:** Low · **Category:** Test quality · **Confidence:** LIKELY
- **Evidence:** `tests/helpers.js:43-53` seeds `juzNumber: Math.min(30, Math.ceil(p / 21))` and `surahName: \`Surah ${p}\``, 30 pages by default. Meanwhile `seed/quranData.js:9-22` (`buildQuranPages`) builds the real 604 documents from the committed JSON. Tests that touch metadata-joined fields therefore check fakes, for example `annotations.test.js:170` `assert.equal(res.body.data[0].surahName, 'Surah 2')`. Scheduling tests for pages 562-604 run against unseeded metadata.
- **Recommendation:** Export `buildQuranPages` and use it in `seedMetadata`, after splitting the `seedQuranData()` auto-run into a `require.main === module` guard. 604 documents insert in milliseconds.
- **Effort:** S

### F-15. `quranStructure.test.js` invariants are weaker than they look; the generator writes without validating
- **Severity:** Low · **Category:** Data integrity (Quran structure) · **Confidence:** CONFIRMED (the data itself is measured correct today)
- **Evidence:**
  - `tests/quranStructure.test.js:18`: `return (ns === ps && na === pa + 1) || (ns === ps + 1 && na === 1);`. Any jump to the next surah's verse 1 passes, so a truncated surah tail (for example 2:285 followed by 3:1, with 2:286 missing) would not be caught.
  - The test has no total-verse-count (6236), uniqueness, rub-count (240), juz/hizb monotonicity or per-surah ayah-count checks.
  - `seed/fetchQuranStructure.js:121-122` writes the file straight over the committed one with none of those checks. It also requests `text_uthmani` (`:32`) and then discards it.
  - Measured today: 6236 unique keys, 1:1 to 114:6, 240 rubs, monotonic juz/hizb 1..30 / 1..60, 2:286 and 9:129 correct.
- **Recommendation:**
  - Add an `AYAH_COUNTS[114]` table (or derive it from the search index) and assert that each surah runs exactly 1..n across pages. Also assert the totals above.
  - Run the same validation inside the generator before `writeFileSync`, and write to a temp file then rename.
- **Effort:** S

### F-16. `fetchSearchIndex.js` relies on API ordering for the global ayah index; the committed `search-index.json` has no test
- **Severity:** Low / Info · **Category:** Data integrity (search) · **Confidence:** SUSPECTED
- **Evidence:** `seed/fetchSearchIndex.js:113-130` pushes verses in API return order and treats `verses[ord-1]` as global ordinal `ord`. A duplicated plus a missing verse inside one chapter would still pass the `out.length === 6236` count (`:133`), while every later index would be shifted. Nothing validates the committed `client/public/data/search-index.json` (6238 lines, 1.3 MB): the client has no tests and the server tests do not read it.
- **Recommendation:** Assert `v.verse_key === \`${s}:${i+1}\`` in the generator. Add a server test that loads the index and checks 6236 entries, non-empty words, and that each verse's word count is consistent with its sibling data where available.
- **Effort:** S

### F-17. Leaderboard response exposes other users' internal `userId`; the privacy contract is not asserted
- **Severity:** Low · **Category:** Privacy · **Confidence:** LIKELY
- **Evidence:** `leaderboardController.js:50-55` builds rows as `{ userId: String(u._id), displayName, pages, streak }` and returns `entries: board.slice(0, 50)`. The model comment says displayName is the ONLY public identity (`models/User.js:105-107`). No test asserts the absence of `email`, `name` or `userId`. In addition, `streak` is the stored `currentStreak`, which is not decayed for inactive users, so the board shows stale streaks.
- **Recommendation:** Strip `userId` from `entries`, compute `me` server-side, and return a `isMe` flag. Add a test: `Object.keys(entry)` equals the allowed set. Consider computing the effective streak with `isStreakContinued`.
- **Effort:** S

### F-18. Smaller untested behaviours
- **Severity:** Low · **Category:** Correctness · **Confidence:** LIKELY
- **Evidence:**
  - `getEstimate` uses `UserProgress.countDocuments({ userId, status: 'memorized' })` (`:852`), which counts partial pages as whole. That disagrees with the fractional totals used everywhere else.
  - Undoing a review sets `lastReviewedDate: yesterday` (`:808-815`) instead of restoring the prior value, so a page reviewed 30 days ago drops out of the cycle front after mark + undo.
  - `completeOnboarding` can be re-called at any time, and each call resets `planStartDate` (`:417-421`).
  - `/reset` tests do not assert that UserProgress is empty or that the streak fields are null.
- **Recommendation:** Add a test for each of the above.
- **Effort:** S

### F-19. Info items
- `tests/auth.test.js:90-121`: the token invalidation test is good. Note that `passwordChangedAt` is back-dated 1 s (`models/User.js:135`), so a token minted in the roughly 1-2 s before a change still passes the `iat` check. This is negligible.
- `tests/bookmarks.test.js:112-129` drops all Bookmark indexes in the shared per-file DB. If it fails before `syncIndexes()`, later tests in that file run against the old unique index and fail in a confusing cascade. Consider a dedicated connection or an `after` hook that calls `syncIndexes()`.
- `helpers.js:7`: `JWT_SECRET = process.env.JWT_SECRET || 'test-secret'`. If a developer's shell exports the real secret, tests sign with it. That is harmless, but forcing the test value is cleaner. Tests never read `MONGODB_URI` and never load dotenv, so production isolation is sound.
- `node --test` runs files in parallel, so up to about 10 mongod instances run at once. That is fine locally; in CI, consider `--test-concurrency`.
- `getTodayTasks` (a GET) mutates user state (the streak tick), which surprises caches and prefetchers. This is a design note.

### Counts
High 1 · Medium 7 (F-02 to F-08) · Low 10 (F-09 to F-18) · Info 1 group (F-19)

---

## 4. Proposed test strategy

### Server: what to add first (in order)
1. **Account deletion cascade (F-01).** One test: seed every user-keyed model for A and B, delete A, assert A has 0 rows in all of them and B is intact. Add a guard test that iterates `mongoose.modelNames()`, so any new model with a `userId` path must be in the cascade.
2. **Negative tests for core writes (F-05, F-06):**
   - `/onboarding` happy path, page range, non-integer, duplicates, oversize array, re-run;
   - `/complete` and `/uncomplete`: bad page, `1.5`, bad type, malformed segment, segment not on the page, review of an unmemorized page, uncomplete of a page not done today;
   - `/password`: wrong current, short, same as old;
   - `/estimate` happy path plus bounds.
3. **Streak/date table tests with an injected clock (F-08).** Use `mock.timers.enable({ apis: ['Date'], now })` from `node:test`, or pass `now` through. Cover gaps with and without off-days, the off-day GET tick then undo, the view-only tick, a request at 23:59:59.999Z then one at 00:00:00.000Z, and every weekday for a Friday off-day. This also removes the midnight flakiness.
4. **Data-loss regression (F-07):** old page → complete(new) → uncomplete(new) keeps the row.
5. **401 sweep:** one table-driven test that hits every route in the router stack without a token and expects 401. Derive the list from `app._router` or keep a static table, so new routes cannot ship unprotected.
6. **Status-code contract (F-04):** register with short password, missing field or duplicate email returns 400 or 409, never 500.
7. **Chat validation, 502 and isolation (F-11); a rate-limit 429 test (F-10); demo guard tests once F-02 is fixed.**
8. **Data files:** strengthen the structure invariants and add a search-index test (F-15, F-16). Run with `--experimental-test-coverage` (Node 22) or `c8` and set a floor in CI.

### Client: a realistic strategy (it has no tests today)
- **Tooling:** Vitest + @testing-library/react + jsdom + MSW (mock the axios API) for unit and component tests. Playwright for end-to-end runs against `vite preview` plus the Express app on mongodb-memory-server, with a seeded test user.
- **First, pure logic (cheapest, highest value, no DOM):** `utils/quranSearchQuery.js`, `services/quranSearch.js` (diacritic stripping and hit → glyph position mapping against the committed index), `utils/unitRanges.js`, `utils/selfTestCycle.js`, `utils/timerCore.js`, `utils/verseIndex.js`, `utils/returnTo.js`, `utils/chatLinks.js` (only internal paths allowed), `services/recentPages.js`, `services/todoStore.js`.
- **Second, components with RTL + MSW:**
  - `ProtectedRoute` (redirect when there is no token; onboarding redirect when `onboardingComplete === false`);
  - the `AuthContext` login/logout token lifecycle (a 401 clears the token);
  - Dashboard complete → undo optimistic update and rollback on API failure;
  - `TodoList` add/reorder/undo;
  - the i18n RTL switch (`dir="rtl"` for `ar`).
- **Third, Playwright flows (keep to about 5):**
  1. register → onboarding (pick Juz 30) → dashboard shows today's tasks;
  2. complete a review → streak chip updates → undo restores it;
  3. Library: open page 50, add a highlight and a note, reload, both persist; check they are hidden for another user;
  4. Settings: change rest days and daily goal → week plan reflects them;
  5. delete account → login fails, and the API shows no residual data.

  Run them on chromium and webkit (Safari is in NFR-02 scope) and at one mobile viewport (NFR-03). Add a Lighthouse or Playwright timing check for NFR-01 (<3 s) on Dashboard and Library.
- **Gate:** `npm run lint && vitest run && playwright test` in CI. Run Playwright on main only if run time matters.

---

## 5. Strengths
- **Real isolation.** Tests never touch Atlas: an in-memory mongod per file, no dotenv in the test path, `NODE_ENV=test` set before `app` is required, a wipe before each test, and the metadata cache reset with the seed.
- **IDOR coverage** for every `:id` route (bookmarks, annotations, todos) asserts both the 404 and that the victim's data survives.
- **The NoSQL-operator injection surface** is tested broadly (login, bookmarks, annotations batch, todos), backed by a central type gate (`middleware/validate.js`).
- **Batch atomicity is tested by fault injection**: `bulkWrite` is monkey-patched to fail part-way, and the test asserts an exact byte-for-byte rollback (`annotations.test.js:670-698`).
- **Password change revokes older tokens**, and a test covers it.
- **Scheduling tests are scenario-driven and well commented** (cycle wrap, fromEnd surah-forward order, half-page continuations, the 0.5 → 1 plan switch, hafiz requiring full pages, unit boundary pages shared between rubs and hizbs).
- **The leaderboard cache invalidation** is tested across every write path.
- **The chat test pins the contract** "assistant sees exactly what the dashboard shows" and stubs Groq so no test hits the network.
- **`fetchSearchIndex.js` fails closed**: it cross-checks two API endpoints against the committed structure, checking word positions, page membership, end-medallion position and the 6236 total.
- **The committed Quran structure data is correct by measurement** (6236/240/114/30/60), and the app never calls the external API at runtime.

## False-positive pass (done)
- IDOR on progress routes: none of them takes an id, and every query is scoped to `req.user._id`. I reclassified this as N/A rather than a finding.
- Chat cross-user leak: the summary uses `req.user` only, so this is a test gap only.
- Concurrent upsert E11000 → 500: MongoDB 4.2+ retries a unique-index upsert collision. I dropped it.
- Streak double-submit: both writers compute the same value. Only the `reviewCount` double increment remains (F-09).
- devDependencies in prod: Render exposes `NODE_ENV` at build time, so they are probably already omitted. Kept as SUSPECTED and Low.
- Demo account: I cannot verify it is seeded in prod. The Login-page hint suggests it is. Kept SUSPECTED.
- Data integrity of `quranStructure.json`: I measured the data as correct. Only the test and generator weakness is reported.
