# Appendix B — Tool outputs

All dynamic results come from the isolated stack described in the report's §9: the real
`server/app.js` on `mongodb-memory-server` (random JWT secret, no dotenv, no `MONGODB_URI`,
no Groq key), bound to 127.0.0.1; the client built into a scratch folder with
`VITE_API_URL` pointing at it; headless Chrome driven by Playwright-core. Harness files
lived in the session scratch folder and are not part of the repo. Secrets: none were found;
the demo password is shown as REDACTED wherever it would appear.

---

## fp-check verdicts

The Trail of Bits `fp-check` standard verification was applied to every High/Critical
candidate with a security or integrity claim (licensing H-04, privacy-policy H-05 and the
product gap H-06 are not code vulnerabilities and were reviewed on documentary evidence).

| # | Finding | Verdict | Decisive evidence | Severity check |
|---|---|---|---|---|
| 1 | C-01 ReDoS in `User.js:18` | **TRUE POSITIVE** | Reachable unauthenticated (type gate + `findOne` only before `User.create`); no length cap; V8 regexes are not interruptible; measured 4.7 s event-loop stall at 33 chars over HTTP, ×4 per 2 chars | Critical justified: single unauthenticated request → whole-API outage; 10 requests / 15 min / IP sustains it |
| 2 | H-01 deletion leftovers | **TRUE POSITIVE** | Collection counts before/after `DELETE /api/auth/account`: Bookmark 1→1, Annotation 3→3 | High kept: retention, not exposure (orphans unreachable, ObjectIds unique) — but an explicit UI promise and an erasure obligation |
| 3 | H-02 progress wipe | **TRUE POSITIVE** | Browser repro: 40 → 0 memorized pages after one 500 on `/progress/all` + tick/untick | High kept: irreversible loss of the core asset; also reachable with no failure via a stale tab |
| 4 | H-03 half-page Mark All | **TRUE POSITIVE** | Browser repro: task 2:17–2:20 (first half of p. 4) became a full page after "Mark All" | High kept: silent corruption in a normal flow of a supported plan; recoverable only manually if noticed |

0 false positives among the gated candidates. Candidates dismissed during the passes (not
in the report): concurrent upsert E11000 (MongoDB retries unique upserts), streak
double-increment under parallel completes (absolute value written), leaderboard display-name
XSS (rendered as text — browser-verified), open redirect (blocked — browser-verified),
token-less 401 redirect from the public Library (none — browser-verified).

---

## IDOR results

User B's token against user A's resources (A created one of each first). All `:id`
routes answer 404 for foreign ids; no list endpoint leaked A's data; A's data was intact
afterwards.

| Request (B's token) | Status | Message |
|---|---|---|
| `PUT /api/bookmarks/:A_id` | 404 | Bookmark not found |
| `DELETE /api/bookmarks/:A_id` | 404 | Bookmark not found |
| `PUT /api/annotations/:A_note` | 404 | Annotation not found |
| `DELETE /api/annotations/:A_note` | 404 | Annotation not found |
| `PUT /api/annotations/:A_highlight` | 404 | Annotation not found |
| `DELETE /api/annotations/:A_highlight` | 404 | Annotation not found |
| `PUT /api/todos/:A_id` | 404 | To-do not found |
| `DELETE /api/todos/:A_id` | 404 | To-do not found |
| `PUT /api/todos/reorder` with A's ids | 404 | To-do not found |
| `GET /api/bookmarks`, `/annotations?page=1`, `/annotations?kind=note`, `/annotations/summary`, `/annotations/verses?from=1&to=5`, `/todos`, `/progress/all`, `/progress/today` | 200 | B's own (empty) data only — no A strings present |
| `POST /api/todos/restore` with A's `userId`/`_id` in the items | 201 | Created for B; A's list unchanged |
| `POST /api/annotations/batch` with A's `userId` in an op | 200 | Applied to B only (field ignored) |
| `GET /api/leaderboard` (no token) | 401 | — |

Routes without an id (progress, auth) are scoped by the token; there is nothing to IDOR.

## Injection and type-confusion probes

| Probe | Status | Result |
|---|---|---|
| `POST /auth/login {email:{$gt:""}}` | 400 | email must be a valid string |
| `POST /auth/login {password:{$ne:"x"}}` | 400 | password must be a valid string |
| `POST /auth/register {email:{$ne:null}}` | 400 | email must be a valid string |
| `GET /annotations?page[$gt]=0` | 400 | rejected |
| `GET /annotations?kind[$ne]=x` | 400 | rejected |
| `PUT /auth/profile {name:{$set:"x"}}` | 400 | name must be a valid string |
| `PUT /auth/profile {email, onboardingComplete:false, currentStreak:999, passwordChangedAt:null}` | 200 | **ignored** — email/streak/onboarding unchanged (whitelisted fields) |
| `POST /todos {text:{$gt:""}}` | 400 | rejected |
| `POST /annotations/batch` op with `pageNumber:{$gt:0}` | 400 | pageNumber must be an integer |
| `PUT /auth/profile {pauseNewMemorization:"false", leaderboardOptIn:"false"}` (user with a display name) | 200 | **both set to true** (L-01) |

## Page-number integrity (M-01)

| Probe | Status | Stored |
|---|---|---|
| `POST /progress/onboarding {memorizedPages:[99999,-5,0,1.5,700,2.25]}` | 200 | `memorizedCount: 6` — all six rows |
| `POST /progress/complete {pageNumber: 1.5 / 2.5 / 3.5 / "4.5", type:"new"}` | 200 ×4 | four fractional pages |
| `POST /progress/complete {pageNumber: 604.4}` | 400 | — |
| `PUT /progress/memorized {memorizedPages:[10.1,10.2,10.3,10.4]}` | 200 | 4 "pages", `totalMemorized: 4` |
| `POST /progress/onboarding` with 2,000 pages 1000–2999 | 200 in 473 ms | 2,000 rows |
| `GET /leaderboard?period=all` afterwards | 200 | `Carol: 2004` ranked #1 |

## Error handling

| Probe | Response |
|---|---|
| Malformed JSON body (test mode) | 400 `text/html` Express page with `SyntaxError` stack |
| Malformed JSON body (production mode) | 400 `text/html` "Bad Request" |
| 200 KB body | 413 `text/html` "PayloadTooLargeError" |
| Register, missing name (test mode) | 500 `{message:"Server error during registration", error:"User validation failed: name: …"}` |
| Register, missing name (production mode) | 500 `{message:"Server error during registration"}` |
| Register, password "123" | 500 (validation error) |
| Register `first+tag@gmail.com` / `me@example.info` | 500 — "Please provide a valid email" |
| Register `ALICE@example.com` when `alice@example.com` exists | 400 "User already exists" (case-insensitive, correct) |
| Login `Alice@Example.com` | 200 (query lower-cased by the schema setter, correct) |
| Register 73-char password, login with a different 73rd+ char | 201, then **200** (bcrypt 72-byte truncation) |

## ReDoS timings (C-01)

Pure regex, one input per process (`aaaa…!`):

| local-part length | 10 | 14 | 18 | 20 | 22 | 24 | 26 |
|---|---|---|---|---|---|---|---|
| ms | 0.7 | 0.3 | 4.5 | 11.3 | 46.3 | 185.5 | 771.9 |

| `a@` + domain length | 10 | 14 | 18 | 20 | 22 | 24 |
|---|---|---|---|---|---|---|
| ms | 0.2 | 0.7 | 9.6 | 37.7 | 146.8 | 583.4 |

Valid addresses rejected by the same regex: `a+b@x.com`, `x@y.info`.

Over HTTP, `POST /api/auth/register` with a concurrent `GET /health`:

| email chars | register | /health waited |
|---|---|---|
| 21 | 15 ms | 3 ms |
| 25 | 28 ms | 1 ms |
| 27 | 78 ms | 27 ms |
| 29 | 294 ms | 244 ms |
| 31 | 1,161 ms | 1,130 ms |
| 33 | 4,666 ms | 4,636 ms |

## Account deletion (H-01)

| Collection | Before | After `DELETE /api/auth/account` |
|---|---|---|
| User | 1 | 0 |
| UserProgress | 4 | 0 |
| Todo | 1 | 0 |
| **Bookmark** | 1 | **1** |
| **Annotation** | 3 | **3** |

`GET /api/leaderboard` immediately afterwards still listed the deleted user's display name.

## Password change (M-04)

`PUT /auth/password` → 200, body keys `success, message` (no token). The same token (2.5 s
old) on the next request → 401 "Session expired, please log in again". (A token minted < ~1 s
before the change still passes — the deliberate 1 s back-date.)

## Rate limiting (production mode, no proxy in front)

| Sequence | Statuses |
|---|---|
| 12 wrong logins, one client | 401 ×10, 429 ×2 |
| 12 wrong logins, rotating `X-Forwarded-For` | 401 ×12 (bypass) |
| Register right after the login limit was hit | 429 (shared bucket) |
| CORS `Origin: http://localhost:5173` in production | no ACAO (correct) |
| CORS `Origin: CLIENT_URL` | echoed (correct) |

## API response headers (helmet)

`content-security-policy: default-src 'self'; … frame-ancestors 'self'; object-src 'none';
script-src 'self'`, `cross-origin-opener-policy: same-origin`, `cross-origin-resource-policy:
same-origin`, `referrer-policy: no-referrer`, `strict-transport-security: max-age=31536000;
includeSubDomains`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`. No
ACAO for unknown origins in production. (The *client* host sets none of these — M-05.)

## Mongo `explain()` on hot queries

| Query | Winning plan | Notes |
|---|---|---|
| `/today`: `UserProgress.find({userId,status}).sort({lastReviewedDate,pageNumber})` | IXSCAN → FETCH → SORT | in-memory sort of ≤ 604 docs, fine |
| leaderboard week: `{userId:{$in}, status, memorizedDate:{$gte}}` | IXSCAN → FETCH | fine |
| annotations for a page: `{userId, pageNumber}.sort({createdAt})` | IXSCAN → FETCH → SORT | fine |
| leaderboard opt-in: `User.find({leaderboardOptIn:true})` | **COLLSCAN** | add an index (M-22) |

## Browser checks

**Open redirect** (login form, then the signed-in `PublicRoute`):

| `returnTo` | after login | already signed in |
|---|---|---|
| `https://evil.example/x` | /dashboard | /dashboard |
| `//evil.example/x` | /dashboard | /dashboard |
| `/\evil.example/x` | /dashboard | /dashboard |
| `/.//evil.example/x` | /dashboard | /dashboard |
| `/%2e//evil.example/x` | /dashboard | /dashboard |
| `/a/..//evil.example/x` | /dashboard | /dashboard |
| `%2F%2Fevil.example` | /dashboard | /dashboard |
| `/%2F%2Fevil.example` | /dashboard | /dashboard |
| `javascript:alert(1)` | /dashboard | /dashboard |
| `/\t/evil.example` | /dashboard | /dashboard |
| `/%5Cevil.example` | /dashboard | /dashboard |
| `/progress` (control) | /progress | /progress |

**Stored XSS** — payload `<img src=x onerror=…>` (and `<b onmouseover=…>` as display name,
`[click](javascript:…)` in a note) stored in the account name, a bookmark label, a note, a
free text note, a to-do and the display name:

| Page | Executed | Injected `<img>` | Shown as text |
|---|---|---|---|
| /dashboard | 0 | 0 | yes |
| /library?page=1 | 0 | 0 | yes |
| /leaderboard | 0 | 0 | yes (display name) |
| /settings?tab=profile | 0 | 0 | yes |
| /progress | 0 | 0 | n/a |

**Logged-out `/library?page=50`:** final URL unchanged; **0** API requests; hosts contacted:
the app origin (22 requests), `fonts.googleapis.com` (2), `fonts.gstatic.com` (1),
`api.quran.com` (6). A stale token is dropped without redirecting the visitor.

**Transient `/auth/me` failure (M-03):** one 503 → redirected to `/login`, token removed.

**localStorage after logout (L-06):** `lang, versePause, chatbotPosY, mushafView,
dailyVerse:2026-10-21:en, reciter, readerToolsTab, mushafAnnoVisible, lastMushafPage,
mushafSidebar, playbackRate, tafsirEdition, readerTools` remain.

**Data-loss reproductions:**
- H-02(a): `memorized before=40; GET /progress/all failed once (500, swallowed); clicked "Mark page 100 as memorized" then "Remove page 100 from memorized"; memorized after=0 []`
- H-03: `today newPages: [{page:4, segment:{fromVerseKey:"2:17", toVerseKey:"2:20", half:1}}]` → after "Mark All": `{memorizedPages:[1,2,3,4], partialPages:[], totalMemorized:4}`

## Lighthouse 12.3 (simulated throttling; median of 3; Vercel-like host: gzip, `vercel.json` font headers, Vercel's default `max-age=0, must-revalidate` elsewhere; HTTP cache cleared before every run)

| Form | Auth | Route | Perf | FCP | LCP | TBT | CLS | A11y | BP | SEO | Bytes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mobile | signed out | / | 91 | 2.38 s | 2.77 s | 65 ms | 0.084 | 95 | 100 | 100 | 367 KB |
| desktop | signed out | / | 98 | 0.61 s | 0.67 s | 0 ms | 0.073 | 95 | 100 | 100 | 367 KB |
| mobile | signed out | /about | 93 | 2.27 s | 2.83 s | 109 ms | 0.000 | 100 | 100 | 100 | 238 KB |
| desktop | signed out | /about | 100 | 0.58 s | 0.66 s | 0 ms | 0.000 | 100 | 100 | 100 | 238 KB |
| mobile | signed out | /login | 93 | 2.32 s | 2.78 s | 30 ms | 0.000 | 91 | 100 | 100 | 239 KB |
| desktop | signed out | /login | 100 | 0.60 s | 0.64 s | 0 ms | 0.000 | 91 | 100 | 100 | 239 KB |
| mobile | signed out | /library?page=50 | 68 | 2.77 s | 4.26 s | 399 ms | 0.001 | 96 | 100 | 100 | 842 KB |
| desktop | signed out | /library?page=50 | 99 | 0.69 s | 0.88 s | 0 ms | 0.011 | 96 | 100 | 100 | 842 KB |
| mobile | signed in | /library?page=50 | 46* | 2.99 s | 5.07 s | 1844 ms* | 0.000 | 96 | 100 | 100 | 849 KB |
| desktop | signed in | /library?page=50 | 93 | 0.76 s | 1.34 s | 97 ms | 0.010 | 96 | 100 | 100 | 849 KB |
| mobile | signed in | /dashboard | 82 | 2.14 s | 4.03 s | 163 ms | 0.000 | 93 | 100 | 100 | 287 KB |
| desktop | signed in | /dashboard | 98 | 0.60 s | 1.08 s | 0 ms | 0.000 | 93 | 100 | 100 | 287 KB |
| mobile | signed in | /progress | 62 | 2.19 s | 4.62 s | 793 ms | 0.028 | 95 | 100 | 100 | 359 KB |
| desktop | signed in | /progress | 94 | 0.68 s | 1.21 s | 150 ms | 0.015 | 95 | 100 | 100 | 359 KB |
| mobile | signed in | /settings | 70 | 2.26 s | 4.02 s | 549 ms | 0.000 | 84 | 100 | 100 | 273 KB |
| desktop | signed in | /settings | 97 | 0.66 s | 1.10 s | 5 ms | 0.000 | 84 | 100 | 100 | 273 KB |
| mobile | signed in | /leaderboard | 74 | 2.21 s | 3.66 s | 572 ms | 0.028 | 95 | 100 | 100 | 246 KB |
| desktop | signed in | /leaderboard | 99 | 0.63 s | 0.95 s | 6 ms | 0.007 | 95 | 100 | 100 | 246 KB |

\* This row overlapped another browser job on the same machine; see the isolated re-measure
below.

### `/library` isolated re-measure (mobile, median of 5)

Run alone, after the matrix, HTTP cache cleared before each run.

| | Perf | FCP | LCP | TBT |
|---|---|---|---|---|
| signed out | 56 | 2.98 s | 4.49 s | 787 ms |
| signed in | 54 | 2.80 s | 4.59 s | 1,349 ms |

Main-thread breakdown (median-LCP run), signed out / signed in: script evaluation 1,805 /
2,073 ms, style & layout 1,689 / 1,440 ms, other 1,159 / 1,152 ms, rendering 231 / 294 ms.
Boot-up: `assets/index-*.js` 1,515 / 1,830 ms of scripting (React/react-dom executing the
reader), `assets/Library-*.js` 81 / 91 ms.

Requests finishing last (signed out; ms from navigation start): `api.quran.com …/by_page/48`
2,292 · `…/by_page/47` 2,197 · `fonts/qcf/v1/p48.woff2` 2,008 · `p52.woff2` 1,984 ·
`…/by_page/52` 1,949 · `…/by_page/51` 1,885 · `p49.woff2` 1,691 · `p51.woff2` 1,680 — the
±2-turn prefetch is running inside the load window. Lighthouse 12.3's LCP-element audit
returned no element snippet in this configuration, so the LCP subject is inferred (the
mushaf page's glyph text).

## axe-core 4.10 (WCAG 2.0/2.1/2.2 A+AA + best-practice; tours suppressed; 1280×900)

| Theme | Auth | Route | Rules | Critical | Serious | Moderate | Violations |
|---|---|---|---|---|---|---|---|
| light | out | / | 3 | 0 | 1 | 38 | color-contrast(1), landmark-one-main(1), region(37) |
| light | out | /about | 0 | 0 | 0 | 0 | — |
| light | out | /login | 3 | 0 | 4 | 1 | color-contrast(3), page-has-heading-one(1), target-size(1) |
| light | out | /register | 2 | 0 | 4 | 0 | color-contrast(2), target-size(2) |
| light | out | /library?page=50 | 2 | 0 | 13 | 1 | color-contrast(13), page-has-heading-one(1) |
| light | in | /library?page=50 | 2 | 0 | 18 | 1 | color-contrast(18), page-has-heading-one(1) |
| light | in | /dashboard | 2 | 0 | 13 | 1 | color-contrast(13), heading-order(1) |
| light | in | /progress | 2 | 0 | 57 | 1 | color-contrast(57), region(1) |
| light | in | /settings?tab=profile | 4 | 5 | 11 | 1 | button-name(1), color-contrast(11), label(4), landmark-unique(1) |
| light | in | /leaderboard | 2 | 0 | 13 | 1 | color-contrast(13), region(1) |
| dark | out | / | 3 | 0 | 3 | 38 | color-contrast(3), landmark-one-main(1), region(37) |
| dark | out | /about | 0 | 0 | 0 | 0 | — |
| dark | out | /login | 3 | 0 | 4 | 1 | color-contrast(3), page-has-heading-one(1), target-size(1) |
| dark | out | /register | 2 | 0 | 4 | 0 | color-contrast(2), target-size(2) |
| dark | out | /library?page=50 | 2 | 0 | 11 | 1 | color-contrast(11), page-has-heading-one(1) |
| dark | in | /library?page=50 | 2 | 0 | 17 | 1 | color-contrast(17), page-has-heading-one(1) |
| dark | in | /dashboard | 2 | 0 | 8 | 1 | color-contrast(8), heading-order(1) |
| dark | in | /progress | 2 | 0 | 55 | 1 | color-contrast(55), region(1) |
| dark | in | /settings?tab=profile | 4 | 5 | 8 | 1 | button-name(1), color-contrast(8), label(4), landmark-unique(1) |
| dark | in | /leaderboard | 2 | 0 | 6 | 1 | color-contrast(6), region(1) |

With the first-visit tours running (default for new users), Dashboard and Library add one
critical `aria-allowed-attr` and one `heading-order` from the driver.js overlay
(`.driver-active-element`). `/onboarding` redirected to `/dashboard` (user already onboarded).
Sample contrast targets: `text-emerald-800/60` nav links, `#707974` / `#bfc9c3` labels,
`text-[10px] uppercase` sidebar captions, the register page's mailto link.

## Bundle breakdown (production build, sourcemap attribution of minified bytes)

| Chunk | Size | Top contributors |
|---|---|---|
| `index-*.js` (entry) | 465 KB minified (498.7 KB file, 160.9 KB gz) | react-dom 177.6 KB · **en+ar locales ~99 KB** (attributed to i18next-browser-languagedetector by the map; verified by string probe: 18/18 EN and 158/158 AR sample strings present) · i18next 42.3 · axios 35.6 · react-router 35.3 · react-icons 26.3 · react 8.0 |
| `Progress-*.js` | 372 KB (381 KB file, 112 KB gz) | recharts 207.8 · Progress.jsx 27.7 · es-toolkit 21.0 · @reduxjs/toolkit 19.9 · d3-scale 14.6 · d3-shape 13.5 · decimal.js-light 12.7 |
| `Library-*.js` | 189.5 KB (194 KB file, 60.7 KB gz) | Library.jsx 115.4 · BasmalaGlyph.jsx 17.4 (inline SVG) · ReciterPicker 7.6 · MushafDrawLayer 6.9 · useMushafZoom 6.5 |
| `quranApi-*.js` (shared) | 62 KB | driver.js 20.3 · TimeTool 14.2 · quranApi 9.9 · TodoList 8.9 |
| CSS | 124.7 KB (22 KB gz) | Tailwind + mushaf styles |
| Static | fonts 48 MB (606 files, lazy per page), search index 1.3 MB (lazy, ~263 KB gz) | |

## Page turns at 4× CPU, signed in, 80 consecutive turns (pages 100 → 180)

Each turn: ArrowLeft, wait for the URL to change, then 1.5 s settle (includes the idle-time
prefetch/priming the reader schedules after a turn).

| Metric | Median | p90 | Max |
|---|---|---|---|
| Long-task time per turn | 1,007 ms | 1,586 ms | 2,765 ms |
| Longest single task per turn | 581 ms | 921 ms | 2,018 ms |

Turns with at least one long task: 80 / 80.

| After turn | JS heap (after GC) | DOM nodes | Listeners | `document.fonts` |
|---|---|---|---|---|
| 0 | 4.9 MB | 2,607 | 418 | 85 |
| 20 | 7.9 MB | 2,563 | 419 | 94 |
| 40 | 9.2 MB | 2,670 | 429 | 94 |
| 60 | 10.0 MB | 2,544 | 410 | 94 |
| 80 | 10.8 MB | 2,565 | 417 | 94 |

DOM, listeners and registered faces are flat (the caps work); the heap still grows ~0.8 MB
per 20 turns after the 40-page data cache should be full — worth a heap snapshot (SUSPECTED
slow growth, Low).

## Server test coverage (`node --test --experimental-test-coverage`, Node 24.19)

166 tests, 23 suites, **166 pass**, 0 fail, 39.5 s.

| File | Line % | Branch % | Func % |
|---|---|---|---|
| app.js | 85.71 | 33.33 | 25.00 |
| controllers/annotationController.js | 93.33 | 86.96 | 100.00 |
| controllers/authController.js | **73.61** | 61.76 | 87.50 |
| controllers/bookmarkController.js | 87.17 | 91.94 | 80.00 |
| controllers/chatController.js | 80.75 | **25.00** | 100.00 |
| controllers/leaderboardController.js | 96.84 | 85.19 | 100.00 |
| controllers/progressController.js | 87.67 | 71.81 | 90.70 (onboarding 411–461 uncovered) |
| controllers/todoController.js | 89.78 | 89.41 | 100.00 |
| middleware/auth.js | 81.03 | 83.33 | 100.00 |
| middleware/chatRateLimit.js | 80.00 | 66.67 | 50.00 |
| middleware/rateLimiters.js | 73.17 | 50.00 | 50.00 |
| middleware/validate.js | 97.33 | 97.06 | 100.00 |
| models/* | 98.6–100 | 85.7–100 | 100 |
| routes/* | 100 | 100 | 100 |
| utils/* | 87.5–100 | 80–100 | 83–100 |
| **all files** | **89.91** | **79.81** | **93.25** |

## npm audit (2026-10-21)

**server:** 15 vulnerabilities (1 low, 2 moderate, 11 high, 1 critical) — body-parser 2.0–2.2.2,
brace-expansion ≤ 1.1.20, braces (via chokidar/nodemon, dev), compression < 1.8.2,
follow-redirects 1.16.0, ip-address ≤ 10.7.0, minimatch ≤ 3.1.3 (dev), mongoose 9.0–9.7.1,
morgan ≤ 1.12.0, path-to-regexp 8.0–8.3.0, picomatch ≤ 2.3.1 (dev), proxy-addr 1.1–2.0.7
(critical), qs 2.2.5–6.15.3. All fixable by `npm audit fix` except nodemon (`--force`).

**client:** 20 vulnerabilities (1 low, 4 moderate, 15 high) — @babel/core, @humanfs/node, ajv,
**axios 1.0–1.19**, baseline-browser-mapping, brace-expansion, browserslist, flatted,
follow-redirects, form-data, js-yaml, minimatch, nanoid, picomatch, postcss, **react-router
6.0–7.18.1** (+ react-router-dom), rollup, source-map-js, vite 7.0–7.3.6. All fixable by
`npm audit fix`.

**Reachability triage:** see report M-17. Runtime-reachable: compression (server), react-router
and axios (browser), morgan (log forging). Everything else is either dev/build-time only or
needs a configuration the app does not use.

**npm outdated:** server 11 packages behind (mongoose 9.1.5 → 9.11.2, express 5.2.1 → 5.3.0,
groq-sdk 1.1.2 → 1.6.0 …); client 22 (react 19.2.3 → 19.3.1, react-router-dom 7.13.0 → 7.18.4,
vite 7.3.1 → 7.3.7 / 8.3.5, axios 1.13.4 → 1.20.0 …).

## Secret scan

gitleaks/trufflehog were not installed; equivalent targeted patterns (Mongo URIs with
credentials, `gsk_`/`sk-`/`AKIA`/`ghp_`/`xox?-`/`AIza` keys, private keys, JWTs,
`JWT_SECRET=`/`GROQ_API_KEY=` assignments) over the working tree and the full history of
all 343 commits (`git log --all -p -G`), with values redacted in output:

| Location | Type | Verdict |
|---|---|---|
| `server/tests/helpers.js:7` (and its commit `768b320`) | test-only JWT secret literal | not a credential |
| `server/seed/demoData.js:7` | demo account password (REDACTED), also displayed on the login page | public by design — see M-07 |
| `.env` files in history | none (only `.env.example` ever committed) | clean |
| `2026-04-25-*.txt` transcripts | no keys / URIs; contain the owner's personal email | L-16 |

`server/.env` exists locally, is git-ignored, and was not opened.

## i18n script

EN 1,077 keys / AR 1,121 (extra = Arabic plural forms); 0 missing either way; 0 type
mismatches; 0 empty values; 11 plural bases, all Arabic sets complete; **28** `{{count}}`
strings without plural forms; **52** keys never referenced (list in
`notes/client-services.md` §4); 12 dynamic key patterns accounted for; 0 `t()` literals
missing from `en.json`.

## Lint

`npm run lint` in `client/` → exit 0, 0 problems.
