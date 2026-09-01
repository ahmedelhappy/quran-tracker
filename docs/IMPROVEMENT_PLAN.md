# Improvement Plan — Production Readiness + Feature Roadmap

> Written 2026-07-02 after a full audit of client + server. Each stage below ends with a
> **ready-to-paste prompt** for Claude Code. Stages are ordered by dependency — later stages
> assume earlier ones are merged.

---

## Chat sessions

Work is split across Claude Code sessions with two roles: one long-lived **planning
session**, and per-stage **implementation chats named after their stage** (the user's
convention). Implementation prompts are self-contained, so any stage can run in a brand-new
chat — the only cross-chat state is uncommitted work in the shared working tree, and each
prompt's step 0 handles that explicitly.

| Session | Role | Notes |
|---------|------|-------|
| **Planning session #1** — "wanna make some improvements to site…" (2026-07-02 → 2026-07-13) | Audit, roadmap, architecture decisions, all stage prompts through review-fixes round 2 | Retired 2026-07-13 (context full). Handed off via a handoff prompt + this doc + the shared memory directory |
| **Planning session #2** (from 2026-07-13) | Same role: plans, writes prompts, reviews reports, maintains this doc + CODE_GUIDE.md; never implements | Active |
| Implementation chats (named by stage) | One or more stages each | History: Stages 0–1.8a in one chat (commits `153dd3b`…`3d0457d`); 1.8b–2b in a second (`641d086`…`3cc1775`); Stage 3 → 5 in a third; Stage 6 onward in per-stage chats. Every implementation chat must hold commits until user acceptance and NEVER push while a review is pending |

Workflow: the planning session writes a prompt → paste it into the active implementation
session → paste its final report back into the planning session → it updates this doc and
writes the next prompt. Commits happen only after visual acceptance.

---

## Progress log

> ✅ **PUSHED 2026-08-04:** the user accepted and everything through Stage 8b is now
> on `origin/main` (`3cc1775..59eb241`, 24 commits — Stage 3 direction → hardening →
> segments → annotations/ink/draw → interactive Progress → leaderboard → 6e tafsir
> editions → the 8b fix round). Verified before the push: **118/118** server tests,
> a clean client build, and lint carrying only the 5 pre-existing issues (3
> react-refresh errors in the context files, 2 hook-dep warnings) — none new. Commit
> messages audited: no AI/assistant mentions. Working tree clean at push time.
>
> ⏳ **STILL AWAITING USER TESTING:** Stages 7, 8, 8b and 6e shipped but were only
> ever code/lint/build/test verified — **NOT browser-verified**. The user is testing
> them live and will report feedback. Stage 8c (five tafsir/annotation items) is
> prompted and queued.

| Date | Stage | Commit | Notes |
|------|-------|--------|-------|
| 2026-07-03 | Stage 0 — housekeeping | `20e90db` | `page106.json` → `docs/samples/`; full mushaf feature committed; no LFS (Vercel serves 48 MB of static fonts fine) |
| 2026-07-03 | Stage 1 — mushaf rendering | `d882f63` | 15-row grid (`repeat(15, minmax(0,1fr))` + `overflow:hidden`), blank lines preserved with `gridRow` pinning, one-slot surah plates/basmala, multi-surah running head, per-word hover reveal. Verified by lint + build; **visual browser pass still pending** (covered by Stage 1.5's manual checklist) |
| 2026-07-03 | Stage 1.5 — reader UX | (uncommitted) | Implemented: spread in memorize mode, keyboard/edge/swipe page turns, LTR-pinned pager (forward = left in both languages), focus mode. Commit deferred — bundled with the Stage 1.6 feedback round |
| 2026-07-03 | Stage 1.6 — reader UX feedback round | (uncommitted) | Implemented: focus-exit fix, interactive per-page ticks, per-page mark buttons in memorize spread, page-turn animation, self-test segmented control (Off / Hide all / Cover cursor) with word-level hover window |
| 2026-07-03 | Stage 1.7 — reader UX round 3 + bookmarks | (uncommitted) | Implemented: cover-cursor covers the NEXT words, hide-all 3-state click cycle + drag-to-reveal, focus-exit on start side, per-page buttons in normal spread, floating edge arrows, /api/bookmarks + sidebar UI (25/25 server tests), drag-tooltip suppression, hint declutter |
| 2026-07-03 | Stage 1.7b — acceptance fixes | (uncommitted) | Implemented + **accepted**: per-page reveal watermark, active-page bookmark targeting, bookmark uniqueness (unique page index + case-insensitive label rule, 29/29 server tests) |
| 2026-07-03 | Commit checkpoint | `9f50ed7` | Stages 1.5 → 1.7b pushed as 2 commits (bookmarks backend; Library reader overhaul) — the 8 suggested boundaries were inseparable at Library.jsx level. Note: older commits 20e90db/d882f63 carry a Co-Authored-By trailer that violates CLAUDE.md; optional history rewrite queued in the 1.7d prompt |
| 2026-07-03 | Stage 1.7c — small fixes round | (uncommitted) | Implemented, awaiting acceptance: single-word peek, onboarding language persistence (AuthContext syncLanguage + langExplicit flag) + LanguageToggle on onboarding, /library defaults to first unmemorized page (fallback lastMushafPage → 1; explicit ?page wins) |
| 2026-07-03 | Stage 1.7c — committed | pushed | Round 5 pushed as 2 commits (language fix; peek/default-page). History rewrite done: 20e90db/d882f63 → 153dd3b/2053338 (Co-Authored-By trailer stripped, tree hashes verified identical, --force-with-lease, local backup tag kept) |
| 2026-07-03 | Stage 1.7d — streak integrity + sidebar cleanup | (uncommitted) | Implemented, awaiting acceptance: prevStreak/prevActiveDate snapshot + reconcileStreakAfterUndo (34/34 tests; Dashboard undo now wires currentStreak from the response — it was NOT refetching); all sidebar mark buttons removed, footer tick is the only mark control. Two-commit split proposed |
| 2026-07-03 | Stage 1.8a — unified reader | `76ec4fd`, `3d0457d` | **Pushed.** Mode merge + badge cleanup + tour merge + CODE_GUIDE §6 rewrite (76ec4fd); page scrubber (3d0457d). 34/34 server tests, lint/build clean. (The "missing" method checklist was a stale-HMR ghost.) Roadmap doc committed separately as `b52e3f8`. **Reader arc complete — implementation session #1 retired** |
| 2026-07-03 | Stage 1.8b — mushaf margin ornaments | (uncommitted) | Implemented by session #2: juz/hizb/quarter + sajda marks from verse-level API fields, 15-slot positioning, boundary continuity verified for rubs 2–24. Fixes round 1 (parity side in single view; marks outside the frame via MushafMarks.jsx sibling layer + 9% gutter) and round 2 (~17% bigger ornaments, hizb-numbered quarter/half labels e.g. نصف الحزب ١١) done and **accepted** — pushed as `641d086` |
| 2026-07-03 | **Stage 2 — real Quran structure data** | `52d247e` (branch) | Implemented on branch `exact-quran-page-metadata`: fetchQuranStructure.js generator → committed quranStructure.json (604 pages, 51 multi-surah), QuranMetadata extended (hizbNumber, first/lastVerseKey, verseKeys, rubBoundaries, surah numbers), seed rewritten, DTOs + Dashboard verse spans ("starts at 2:187"), 42/42 tests. Page 50 and page 106 verified correct end-to-end. **Merged to main + pushed (fast-forward 641d086 → 52d247e); 42/42 on main.** ⚠ Resolved 2026-07-06: the Atlas DB had never actually been reseeded (the implementation session's "end-to-end verification" ran against its in-memory test Mongo, not the real DB — page 50 still had 2 surahs and no firstVerseKey). Ran `node seed/quranData.js` against cluster0.0bmkrkk/quran-tracker and verified directly: p50 = Aal-Imran (3:1–3:9), p49 ends 2:286, p106 = An-Nisa·Al-Ma'idah. If the deployed site still shows the bug after this, Render uses a different DB and needs its own reseed. Lesson: DB-affecting stages must prove themselves with a direct read of the real database, not test infra. Also: CLAUDE.md + .claude/ un-gitignored and docs/ committed 2026-07-06 as `4337723`. **User confirmed working on production AND local — Stage 2 closed** |
| 2026-07-06 | Stage 2b — verse-label display rules | `ea9d9f9`, `3cc1775` | **Pushed.** Verse-number-only ranges on partial surahs (bidi-isolated digits, singular "verse 176" form), complete surahs bare, review/recent/continuation cards names-only, ayahs counts derived from quranStructure.json (ea9d9f9); month-label collision fix (3cc1775). Verified in-browser EN/AR incl. page 106 |
| 2026-07-07 | **Stage 3 — memorization direction** | (uncommitted) | Implemented: memorizationDirection fromStart/fromEnd + newMemorizationStartPage anchor with wrap-around; single nextUnmemorizedPages helper replaced all 3 inline loops; direction-aware continuation tie-break; onboarding "Where do you want to start?" step + Settings control; EN/AR locales. Session #3 verified: 45/45 server tests (3 new direction tests), lint/build clean of new issues; working tree confirmed scoped to exactly the 8 task files. Design fix done (user caught it): fromEnd is now surah-backward / pages-forward via FROM_END_ORDER precomputed from quranStructure.json — Al-Mulk emits 562 then 563; 46/46 tests. **Workflow adjustment 2026-07-08: user will review later — Stage 3 commits LOCALLY (no push); Stage 4 proceeds on top; nothing pushes until the user's deferred review of both** |
| 2026-07-08 | Stage 4 — production hardening | (uncommitted) | Implemented by session #3: auth+API rate limiters (test no-ops, trust proxy), hand-rolled type-gate validation on all auth/progress/bookmark routes (NoSQL-operator surface closed, tested), serverError() helper across all 18 500-sites, boot asserts + await-Mongo, passwordChangedAt token invalidation, QuranMetadata in-memory cache, React.lazy route splitting (recharts isolated), ErrorBoundary, font cache headers. 48/48 tests. Explicitly deferred: password-reset emails, Sentry, refresh tokens. **Stage 3 committed locally (c12666b, 23727f7 — NOT pushed); Stage 4 held uncommitted; user review of 2b/3/4 still pending** |
| 2026-07-08 | Stage 4 — committed locally | `602ff9f` `39bad64` `bea9944` `022dded` | Rate limits + validation; error responses + boot asserts + metadata cache; token hygiene; client splitting/boundary/font headers. NOT pushed |
| 2026-07-08 | Stage 5 — verse segments | (uncommitted) | Implemented: UserProgress.segments, server/utils/segments.js unit-compile engine (reads quranStructure.json), PUT /api/progress/units, fractional stats + **isHafiz bug fix** (was "604 touched", now "604 fully memorized"), real half-page plan (continuationPage now paused-users-only), week-tab half-page simulation, Onboarding/Settings Hizb+¼-Hizb tabs (rounded to whole pages), Library mark-verses flow + amber ½-memorized tick, dashboard half labels. 64/64 tests (16 new), live-verified against real Atlas DB. Known limitation (documented): undoing a half-page day-2 completion may discard day-1's segment when both land on the same calendar day. **Uncommitted — step 0 of Stage 6 commits it; user review of 2b/3/4/5 still pending** |
| 2026-07-08 | Stage 6 — annotations | — | Prompt prepared (chat version supersedes the doc's original: step-0 local commit of Stage 5, hard-flag beside the footer tick instead of the removed sidebar badge, unified sidebar wording, Stage 4 validation on the new routes, metadata-cache enrichment). ⚠ After Stage 6: user review REQUIRED before queueing more — 4 unreviewed layers by then |
| 2026-07-09 | Stage 5 — committed locally | `f20a0fa` `22d2b2b` | Backend (segments engine/endpoint/stats/half-page, interleaved hunks → one server commit) + client. NOT pushed |
| 2026-07-09 | Stage 6 — annotations | (uncommitted) | Implemented: Annotation model/routes/controller (per-kind validation, verseKey validated against real structure, 2000 cap), popover swatches/note/hard, page-hard flag beside the 3-state tick, hard list + dashboard chip, layout-neutral word-tint rendering. 88/88 tests (+24). Accepted limitations: whole-verse highlights only in UI (wordFrom/wordTo supported underneath), straddling verses annotate on their selection page only, small medallion indicators |
| 2026-07-08 | **Review checkpoint** | — | Consolidated 13-point checklist delivered (planning chat) covering 2b/3/4/5/6. On acceptance: push ALL local commits (Stage 3 → 6b); no prod reseed needed (data files unchanged). Stage 7 (interactive Progress + projected-completion card, segments-aware rewrite) gets its prompt only after acceptance |
| 2026-07-09 | Stage 6b — free ink + annotation navigation | (uncommitted) | Implemented (MushafDrawLayer SVG overlay in the fixed 524×800 space, PUT /annotations/drawing w/ strict stroke validator, annotate-mode input isolation, /annotations/summary + navigator sidebar + arrival pulse; 98/98 tests). **Crash found on user's first load: `<FiEdit2 />` used at Library.jsx:1317 but never imported → mount ReferenceError → error boundary. Fixed directly by the planning session (import added). Root cause of the blind spot: no eslint-plugin-react → core no-undef ignores JSX identifiers; follow-up dispatched to add react/jsx-no-undef. Also: the 6b "browser checklist" was evidently not executed against a running app — mount itself crashed** |
| 2026-07-09 | Lint-gap + browser-verify round | (uncommitted) | eslint-plugin-react added with react/jsx-no-undef only (proven: fails on the removed import, 0 new noise). Full 6b click-through on an ISOLATED stack (in-memory Mongo :5099 + Vite :5174, CDP real pointer input, screenshots; Atlas untouched) — 20/20 checks: draw/erase/undo/persist/pixel-perfect scaling/navigator/pulse. Found + fixed a real setState-during-render bug in MushafDrawLayer (stroke commit moved out of the setLive updater into the event handler). This isolated-stack CDP approach is the new verification bar. Minor carry-item: word-tap isolation in draw mode confirmed only indirectly — fold an explicit assertion into 6c's verification |
| 2026-07-09 | Stage 6c — draw UX + audio merge | (uncommitted) | Implemented + browser-verified on the isolated stack (25/25 feature + 6/6 regression checks, 0 console errors): undo/redo stacks + keys, Shift straight-line w/ angle snap, eye visibility toggle, draggable/collapsible toolbar, 'text' annotation kind (Arabic verified; eraser-safe), margin-extended overlay (x ∈ [-52,576]) + widened validators, audio-bar→popover merge with near-selection placement. 104/104 server tests. Cosmetic gap: navigator list lacks a text-kind icon. **REVIEW CHECKPOINT ACTIVE: 19-point consolidated checklist delivered; on acceptance commit 6/6b/6c and push Stage 3 → 6c; no reseed needed** |
| 2026-07-13 | Review fixes round 1 (6d) — done | (uncommitted) | Root cause confirmed: memorizedSet treated any-progress pages as done → replaced with segment-aware nextNewItems (partial pages serve their remainder FIRST; want-more offers the next half). Plan-switch day = "remainder only" (documented choice). Partial pages render amber-fractional on the detailed map; drag-select via useDragSelect; audio round (bar visible + popover, speed, verse/range repeat, seamless cross-page playback w/ preload, tafsir play-toggle); tints lightened, pause clears playing tint + resume from position. 106/106 tests, 13/13 isolated-browser checks. Scoped: buildProgressSummary (chatbot) still whole-page |
| 2026-07-13 | Review fixes round 2 — UPDATED prompt | — | Supersedes the earlier round-2 prompt; now ALSO includes: the page-top surah-start bug (plate + basmala belong on the previous page's trailing blanks — An-Nisa p76/77; general fix + all-114 sweep), dashboard rule change (multi-surah task pages show PAGE NUMBER ONLY — no names/ranges; half labels stay), selected-verse indicator becomes non-fill (outline/ring, not a tint), plus the original three (anchored pencil dropdown, icon-only text notes, language-aware motivational verse) |
| 2026-07-10 | Stage 6e — tafsir expansion | — | Planned with ready prompt (below): add أيسر التفاسير + other worthwhile editions + إعراب الآيات, with mandatory verify-200-first discovery against spa5k CDN / quran.com resources / alquran.cloud; honest rejection if no reliable i'rab source exists |
| 2026-07-10 | Review fixes round 1 (Stage 6d) | — | User's review findings dispatched: half-page "want more" ignores new memorization; half-memorized pages render fully green on the detailed map AND the walker skips the remaining half after a 0.5→1 plan switch (partial pages must count as pending); drag-to-multi-select pulled forward from Stage 9; audio-bar hiding REVERTED (bar + popover coexist); new audio features (speed, verse/range repeat, continuous cross-page playback); tafsir play button must toggle pause; selected/playing tints lightened; pause clears the playing tint but resume continues from position |
| 2026-07-28 | **Stage 7 — interactive Progress page** | (uncommitted) | Implemented by the PLANNING session directly (user asked to "just start implementing, I'll review later"). In-place edit mode on `Progress.jsx`: an "Edit progress" toggle in the Memorization Map header opens a draft; detailed map toggles single pages, compact map toggles a whole Juz, surah cards toggle their page span; draft `Set` + Save/Cancel + "{{count}} changed" hint bar + pending-change rings + `aria-pressed`; Save calls `updateMemorized` then reloads. **Segments-aware fix** (the doc's original Stage-7 prompt predated segments): `updateMemorized` now sets `segments: []` only in `$setOnInsert`, so a ½-memorized page that stays in the set is NEVER silently flattened to a full page on save — also fixes the Settings "edit my pages" editor; +1 server test (**107/107**). New **Projected completion** card from `GET /api/progress/estimate` (time-to-finish + projected Gregorian date via `ar-u-ca-gregory-nu-arab`, reuses `formatEstimate`/`onboarding.time*`). Settings "Edit my pages" kept as a secondary link. EN/AR locales added. Verified: 107/107 server tests (in-memory Mongo, Atlas untouched), client build clean, lint clean of NEW issues (the 3 react-refresh context errors + the `chartData` hooks-dep warning are pre-existing, in files not touched here). ⚠ **NOT browser-verified on the isolated CDP stack yet** — user will review. Files: `progressController.js` (updateMemorized), `progress.test.js` (+1), `Progress.jsx`, `en/ar.json`. Held UNCOMMITTED atop the in-flight Stage 6 tree (no collision — Stage 7 lives in Progress.jsx / progressController, not the in-flight Library.jsx); nothing committed or pushed. |
| 2026-07-28 | **Stage 8 — leaderboard (opt-in)** | (uncommitted) | Implemented by the PLANNING session directly. Backend: `User` gains `leaderboardOptIn` + `displayName` (3–30 chars — the ONLY public identity, never email/real name); `updateProfile` validates both and requires a name to opt in; all three auth payloads (login/getMe/updateProfile) return them; `UserProgress` gains a `{ memorizedDate: 1 }` index. New `GET /api/leaderboard?period=week|all` (protected, type-gated): opted-in users only, **segment-aware fractional page counts**, week = last 7 UTC days, sorted by pages desc (streak tie-break), returns top 50 + the caller's own rank when outside it, behind a 5-minute in-memory per-period cache (single-instance; Redis noted for scale). New `leaderboardController` (+`_clearCache` test hook) and `leaderboardRoutes` mounted in `app.js`. **+9 tests** (opt-in filtering, ranking, week vs all-time, fractional counting, own-rank-outside-top-50 via 51 users, opt-in-requires-name, short-name reject) → **116/116**. Frontend: lazy `/leaderboard` route + Navbar link (FiAward); new `Leaderboard.jsx` (This Week / All Time tabs, medals for the top 3, own-row highlight, a "your rank" card when outside the visible top, a join/opt-in card, loading/error/empty states); a Settings **Community** card (`CommunityCard`, self-contained opt-in toggle + display-name save, mirrors `ChangePasswordCard`); EN/AR locales (`nav.leaderboard`, `leaderboard.*`, `settings.community.*`). Verified: **116/116** server tests (in-memory Mongo, Atlas untouched), client lint clean on all changed files, build clean (Leaderboard chunk ~6.4 KB, lazy). ⚠ **NOT browser-verified yet** — awaiting user testing. No collision with the in-flight Library.jsx (all new files + Settings/Navbar/App/api). Held UNCOMMITTED; nothing pushed. Files: `User.js`, `UserProgress.js`, `authController.js`, `authRoutes.js`, `app.js`, `leaderboardController.js` (new), `leaderboardRoutes.js` (new), `leaderboard.test.js` (new), `api.js`, `App.jsx`, `Navbar.jsx`, `Leaderboard.jsx` (new), `Settings.jsx`, `en/ar.json`. |
| 2026-07-28 | **Stage 8b — user fix round** | — | Four user-reported items dispatched as a fresh-session prompt (below), bundled with Stage 6e. Root causes confirmed in code by the planning session: (1) **leaderboard staleness** — the 5-min board cache is invalidated ONLY on leaderboard-settings changes, never on progress writes, so pages/rank lag up to 5 minutes (my Stage 8 bug); (2) **range repeat is page-bound** — `rangeStart`/`rangeEnd` are indices into `verses`, which only ever holds the visible page(s), so a range can't span pages; needs global verse addressing + cross-page fetch; (3) **inter-verse gap** — one `<audio>` whose `src` is reassigned per verse (Library.jsx ~558-568) pays a fetch+decode per verse; the existing preload covers page data + font only, not audio → needs double-buffered audio elements; (4) **landing page** — `lastMushafPage` is only a fallback behind "first unmemorized page"; user wants last-opened to win, which **reverses the Stage 1.7c decision** (explicit `?page` still wins). ⚠ Item 2's "end verse: the end of the current verse" read as a typo → default chosen: **end of the current page** (flagged in the prompt for user confirmation). |
| 2026-08-04 | **Stage 8c — tafsir UX + annotation ergonomics** | — | Five user-reported items dispatched as a fresh-session prompt (below). Grounded in code by the planning session: (1) the panel prev/next buttons move `tafsirIndex` only and never touch `selectedVerseKey`, and selecting a verse while the panel is open never moves `tafsirIndex` → needs TWO-WAY sync; (2) the draw toolbar renders whenever `drawPage != null` (a dropdown anchored under the pencil) so it cannot be collapsed while drawing, and there are no tool shortcuts; (3) the panel opens ONLY via `openTafsir(index)` from the verse popover → add a persistent VS-Code-style toggle on the panel side, keeping the popover path; (4) **grouped tafsir** — classical editions (esp. أيسر التفاسير) comment on a PASSAGE, and the spa5k CDN returns that same block for every ayah in the run, so this is very likely SOURCE DATA, not a fetch bug (note `fetchPageTafsir` already selects per-ayah for page-source editions); the prompt requires verifying by diffing adjacent ayahs before any rewiring, and evaluating hefzmoyaser.net/hafs **with CORS as the gating question**; (5) the panel is `fixed … z-50 md:end-0 md:w-[420px]` so it OVERLAYS the mushaf → make it reflow side-by-side (the uniform-scale frame invariant means a narrower column just scales the page down) and auto-collapse the sidebar, reusing the existing `focused`-mode precedent. Deliberately NOT bundled with another stage: all five interlock in Library.jsx, and 8.5/9 touch different files. |

---

## Part 1 — Audit findings

### 1.1 Security (must fix before real users)

| # | Finding | Where | Severity |
|---|---------|-------|----------|
| S1 | **No rate limiting on auth endpoints.** Only `/api/chat` is throttled. `/api/auth/login` and `/register` accept unlimited attempts → brute-force and account-stuffing. | `server/app.js`, `routes/authRoutes.js` | High |
| S2 | **No input type validation → NoSQL-operator injection surface.** `User.findOne({ email })` receives `req.body.email` unchecked; an object payload like `{"$gt":""}` reaches the query. Same pattern across controllers. | `authController.js` and others | High |
| S3 | **Internal error leakage.** Every `catch` returns `error: error.message` to the client — leaks stack/driver details in production. | all controllers | Medium |
| S4 | **No boot-time env assertion.** Server starts fine with `JWT_SECRET` missing and fails confusingly per-request. | `server/server.js` | Medium |
| S5 | **No password reset / email verification.** Users who forget a password permanently lose the account. #1 missing account feature for go-live. | — | High (product) |
| S6 | **Token lifecycle.** 30-day JWT in localStorage, never revocable; changing password doesn't invalidate existing tokens. Acceptable at this scale, but add a `passwordChangedAt` check cheaply. | `middleware/auth.js` | Low-Medium |

### 1.2 Architecture / scalability

| # | Finding | Notes |
|---|---------|-------|
| A1 | `QuranMetadata` is a **static 604-row table queried on every dashboard request**. Load it into an in-memory map at boot — removes a DB round-trip from the hottest path. |
| A2 | `express-rate-limit` uses in-memory store — fine for one instance; document that multi-instance needs a shared store. |
| A3 | Backend is otherwise stateless and indexes are correct (`userId+pageNumber` unique, `userId+status`, `userId+lastReviewedDate`). Horizontal scaling is safe. |
| A4 | **Frontend has no route code-splitting** — recharts, driver.js, all pages ship in one bundle (hurts NFR-01 “3s load”). Add `React.lazy` per route. |
| A5 | **No React error boundary** — one render error blanks the whole app. |
| A6 | The 604 QCF fonts (48 MB total, ~80 KB each, versioned under `/fonts/qcf/v1/`) should be served with `Cache-Control: immutable` (vercel.json headers). Loaded lazily per page — good design already. |
| A7 | No error monitoring. Add Sentry (client + server) before go-live. |
| A8 | Server `app.listen()` runs before Mongo connects; requests in that window 500. Minor: await connection first. |

### 1.3 Correctness bugs found

| # | Bug | Root cause |
|---|-----|-----------|
| B1 | **“Page 50 — Al-Baqarah · Aal-Imran”** on dashboard (and every similar page). | `getSurahsForPage()` in `server/seed/quranData.js` guesses that any multi-page surah bleeds into the page where the next surah starts. False for Al-Baqarah: it ends on page 49; Aal-Imran starts clean at the top of 50. Start-pages alone cannot distinguish the two cases — needs real per-page verse data. |
| B2 | **Mushaf top bar shows only one surah name** on multi-surah pages. | `Library.jsx renderPageCard` reads `pd.verses[0].surahNumber` only. The full surah list is already in `pd.verses` — derive unique surah numbers and join names. |
| B3 | **Mushaf text overflows the page frame.** | Vertical budget mismatch, *not* frame width. Inner text box is ~524×800 px, but 15 lines × (32 px × 1.55 line-height) + 14 × 6 px gaps ≈ **828 px > 800 px**. Pages with surah plates + basmala lines (which are taller than a text line) overflow much worse — worst at the end of the mushaf (p. 587, 591, 595–604 have 2–3 surah headers). Increasing the frame only hides it for some pages; the real fix is a **fixed 15-slot line grid** (see Stage 1). |
| B4 | Blank lines are dropped in `buildLines()` and flex `space-between` redistributes — so vertical word positions drift from the print. Rendering all 15 slots fixes both this and B3. |

### 1.4 Answer to “is it just the frame size?”

No. The frame *width* is right (QCF v1 line ≈ 16 × font-size ≈ 512 px inside 524 px). The overflow
is **vertical**: line-height × 15 + gaps exceeds the 800 px text box, and surah-name plates /
basmala rows are taller than one text line. The print model is: a page = exactly 15 equal-height
slots; every row (text, plate, basmala, blank) occupies whole slots. Implement that as a CSS grid
`repeat(15, 1fr)` with rows placed at their true `lineNumber`, and size plates/basmala to fit
inside one slot. Then nothing can ever overflow, at any viewport, on any page.

---

## Part 2 — Architecture decision: verse-level memorization

**Short version: the VERSE becomes the atom of what is memorized. The page stays the unit the
daily schedule deals in — and the "shelf" the verse data is stored on.** This is NOT
"keep page tracking and bolt verses on top": after this change, what the system knows is
*which verses you have memorized*. Pages, juz, hizb, percentages are all *derived* from that.

What is stored — still one `UserProgress` document per (user, page), but the document now means
"here are the memorized verse ranges of this page":

```js
{ userId, pageNumber: 29,
  segments: [{ from: "2:187", to: "2:190" }],      // ← memorized verse ranges (the real data)
  memorizedDate, lastReviewedDate, reviewCount }    // ← review scheduling, unchanged
```

- `segments` absent/empty ⇒ the whole page (so every existing document stays valid — no migration).
- Stats become verse-derived: a page with half its verses memorized contributes 0.5 pages to
  the total; percentage can be shown by pages (traditional) and/or raw verse count.
- Dashboard tasks become verse-labeled: **"Page 29 · starts at 2:187"** on a normal day,
  **"Page 29 · first half (2:187–2:189)"** on a half-page day. (Full-page labels only need
  Stage 2's per-page verse metadata; `segments` matter once *progress* can be partial.)
- Every selectable unit — Juz, Hizb, ¼ Hizb, Surah, page, verse-range — compiles to a
  **verse-key range**, which maps to a set of pages (full + up to two partial).

### Why not one document per verse (UserProgress × 6236)?

1. **Review scheduling is per portion, not per verse.** Nobody reviews verse 2:187 as an
   independent item with its own review date — you review a page (or a quarter). A per-verse
   model forces you to re-group verses into portions anyway; the page row *is* that grouping,
   and it already carries the review metadata (`lastReviewedDate`, `reviewCount`).
2. **Ranges carry the same information at a tenth of the weight.** Memorization is contiguous;
   `{from, to}` ranges are lossless (multiple segments cover gaps). Per-verse rows would turn a
   hafiz into 6,236 documents instead of 604 and 10× every hot query, for zero extra
   expressiveness.
3. **Zero migration and zero rewrite** of the scheduling engine — `getTodayTasks`, cycle review,
   streaks, week plan all keep working.

Everything requested falls out of this model: verse add/remove, ¼-Hizb boundaries landing
mid-page, honest half-page daily plans (split the page's verse list at its midpoint), and
"starting from verse X" task labels.

Data source: quran.com API v4 already returns `hizb_number`, `rub_el_hizb_number`, `ruku_number`
per verse (verified — see `page106.json` sample). One script pulls all 604 pages once and bakes a
static structure file; no runtime dependency on the external API for scheduling.

This is Stage 2 (data + task labels) + Stage 5 (segments feature) below.

### Plan direction: memorize from the start, the end, or a custom point

New-page selection currently always walks pages 1→604. Add a plan setting:

- **From the beginning** — Al-Baqarah onward (today's behaviour, default).
- **From the end** — the classic beginner path: **surah-by-surah backward, pages within each
  surah forward** (An-Nas → Al-Falaq → … ; Al-Mulk gets page 562 then 563). Precomputed once
  from quranStructure.json; NOT a raw 604→1 page walk, which would memorize multi-page
  surahs backwards (design fix, 2026-07-07).
- **Custom start point** — "start from Juz 29 / Surah Al-Kahf / page N": begin there and wrap
  around at the end so the skipped part is scheduled last (fromStart-only). This mirrors the
  `cycleReviewStartPage` concept the review cycle already has.

This is Stage 3 — small, independent of segments, high value.

---

## Part 3 — Stages

Recommended order. Stages 1–4 are “fix + go-live”; stages 5–9 are features.

| Stage | Theme | Size |
|-------|-------|------|
| 0 | Commit current mushaf work, clean strays | tiny |
| 1 | Mushaf rendering: 15-slot grid, overflow fix, multi-surah header, hover-reveal | M |
| 1.5 | Reader UX: spread in memorize mode, keyboard/edge/swipe page turns, EN pager direction, focus mode | S–M |
| 1.6 | Reader UX feedback round: RTL fixes, interactive ticks, page-turn animation, self-test rework | S |
| 1.7 | Reader UX round 3: self-test refinements (drag-reveal, 3-state click, cover-next), page bookmarks, chevrons, declutter | M |
| 1.7b | Acceptance fixes: reveal-watermark model, active-page bookmarks, bookmark uniqueness | S |
| 1.7c | Small fixes: single-word peek, onboarding language fix + toggle, library default page | S |
| 1.7d | Streak integrity: undoing the day's only completion restores the streak | S |
| 1.8a | Unified reader: merge memorize mode into the normal reader; page scrubber; badge cleanup | M |
| 1.8b | Mushaf margin ornaments: juz / hizb / quarter / sajda marks like the print | S |
| 1.8 | Library UX redesign: mobile pass, minimal sidebar polish, context menu | M — prompt after user's UX simulation |
| 1.9 | Public Library: browse without an account | S |
| 2 | Real Quran structure data + verse labels on tasks (fixes B1 everywhere; foundation for units) | M |
| 2b | Verse-label display rules (verse numbers only, complete-surah handling) + graph label fix | S |
| 3 | Memorization direction: from start / from end / custom start point | S |
| 4 | Production hardening (security + performance + monitoring) | M |
| 5 | Verse-level segments: sub-page units + proper half-page plan | L |
| 6 | Annotations: highlights, notes, mark-hard | L |
| 6b | Free ink annotations (pen / highlighter / eraser) + prev-next annotation navigation | M |
| 6c | Draw UX round: undo/redo keys, shift-line, visibility toggle, draggable toolbar, floating text notes, annotatable margins, audio-bar/popover merge | M |
| 6e | Tafsir expansion: أيسر التفاسير + more editions + إعراب الآيات (verify sources first) | S |
| 7 | Interactive Progress page (edit progress in place) | M |
| 8 | Leaderboard (opt-in) | M |
| 8b | Fix round: leaderboard freshness, cross-page audio range, gapless playback, library landing page | M |
| 8c | Tafsir UX round: panel sync/toggle/side-by-side layout, grouped-tafsir labelling, annotation toolbar collapse + shortcuts | M |
| 8.5 | Product-aware chatbot: feature help, how-tos, deep links | S–M |
| 9 | UX polish pass | M |

---

### Stage 0 — Housekeeping (do it yourself, no prompt needed)

- Commit the uncommitted mushaf work (fonts, `MushafPage.jsx`, `mushafApi.js`, CSS, locales).
  Consider Git LFS or confirming the host is fine with 48 MB of static fonts (Vercel is).
- Move `page106.json` from the repo root into `docs/samples/` (it documents the API shape) or
  delete it.

---

### Stage 1 — Mushaf rendering correctness

**Goal:** page never overflows its frame; all 15 lines sit exactly where the print puts them;
multi-surah pages show all surah names in the running head; memorize-mode hover-reveal.

**Prompt for Claude Code:**

```
Fix the mushaf page rendering in the Library so it can never overflow its frame, and match
the printed Madinah mushaf's line placement exactly.

Context: client/src/components/MushafPage.jsx renders 15 lines of QCF per-page glyphs inside a
fixed 576×852 canvas (.mushaf-canvas / .mushaf-frame / .mushaf-page in client/src/index.css)
that is uniformly scaled to its column. Today the page body is a flex column with
justify-content: space-between; 15 lines × (32px font × 1.55 line-height) plus gaps exceeds the
~800px inner text box, and surah-name plates (.mushaf-surah-frame) and basmala rows are taller
than a text line, so pages overflow vertically — worst on multi-surah pages like 587, 591,
595–604. Also, buildLines() in client/src/services/mushafApi.js drops genuinely blank lines, so
vertical positions drift from the print.

Required changes:
1. Replace the flex layout of .mushaf-page with a CSS grid of exactly 15 equal-height rows
   (repeat(15, 1fr)). Render every line at its true lineNumber row (grid-row), including
   genuinely blank lines as empty slots — stop dropping them in buildLines(). Keep the
   ornamental centring behaviour for pages 1–2.
2. Make every row type fit within one slot: text lines get line-height = slot height (no gap
   sizing tricks); surah-name plates and the basmala must be sized (font-size/padding/max-height)
   to fit a single slot without growing it. 1fr rows must not stretch from content —
   use minmax(0, 1fr) and overflow handling so a too-tall row is impossible by construction.
3. Keep the existing per-line width auto-shrink in MushafPage.jsx (the useLayoutEffect) — it
   handles the rare over-wide line (e.g. p443). Verify it still works with the grid.
4. Multi-surah running head: in client/src/pages/Library.jsx, renderPageCard currently shows
   only the first verse's surah (pd.verses[0].surahNumber). Derive the unique ordered list of
   surah numbers actually on the page from pd.verses and show all names joined with ' · '
   (respect the Arabic/English toggle via surahLabelFor). Same for currentSurahName in the page
   info bar under the mushaf.
5. Memorize-mode hover reveal: while self-testing (verses blurred via .mushaf-concealed),
   hovering a word should un-blur ONLY that word (pure CSS: .mushaf-word:hover >
   .mushaf-concealed { filter: none; opacity: 1 }, with a fast transition). Clicking still
   reveals the whole verse (already implemented via onRevealVerse). Update the i18n hint strings
   (library.memorize.tapToReveal in client/src/locales/en.json and ar.json) to mention hover on
   desktop.

Verify by running the client (cd client && npm run dev) and checking pages 1, 2, 50, 106, 443,
587, 596, 602, 603, 604 in both single and two-page view, light and dark mode: no vertical or
horizontal overflow anywhere, surah plates and basmala each occupy exactly one line slot, and
the running head on page 587 lists all its surahs. Run npm run lint before finishing.
```

---

### Stage 1.5 — Reader UX: page-turn ergonomics + focus mode

**Goal:** the reader feels like handling a physical mushaf: spread available while memorizing,
pages turn from the keyboard / page edges / swipe, "forward" always means leftward (it's an RTL
book — in both UI languages), and a distraction-free focus mode centers the page.

**Design decisions baked in:** ArrowLeft/left-edge/right-swipe = NEXT page regardless of UI
language (the book's direction is fixed; only the English pager buttons are wrong today).
Focus mode is for the normal reader only — memorize mode is already its own focused experience
and needs its sidebar controls.

**Prompt for Claude Code** (continue in the Stage 1 session — same files):

```
Improve the Library reader's navigation ergonomics. Client-only changes
(client/src/pages/Library.jsx, client/src/index.css, client/src/locales/en.json + ar.json;
touch MushafPage.jsx only if unavoidable).

1. Two-page spread in memorize mode: remove the !memorizeMode restriction from the twoPage
   condition and show the single/double view toggle in memorize mode too (large screens only,
   as now). Make memorize mode spread-aware:
   - Self-test conceal/reveal is verseKey-based and should already cover both pages — verify.
   - The sidebar "mark this page" CTA becomes "mark these pages" when two pages are visible:
     it marks every visible unmemorized page (one optimistic update, rolled back together on
     failure). The memorized badge/undo handle both pages, and each page card's footer shows a
     small per-page memorized tick next to the page number so the user sees which half is done.
   - "Next page" in memorize mode advances by the spread step (2), like the normal pager.
2. Keyboard page turning: ArrowLeft = NEXT page, ArrowRight = PREVIOUS page — the mushaf is an
   RTL book, forward is always leftward, in BOTH UI languages. PageDown/PageUp as aliases.
   Escape closes the tafsir panel / verse popover. Ignore key events when an
   input/select/textarea is focused or a driver.js tour is active. Mention the shortcut in the
   pager button tooltips.
3. Edge-click page turning: two slim vertical hot-zones flanking the page card(s) (~40px wide,
   full card height, outside the text frame): clicking the LEFT zone goes forward, the RIGHT
   zone goes back. Affordance: a chevron that fades in on hover. Hide them on touch devices
   (media (pointer: coarse)) and make sure they never intercept word taps.
4. Touch swipe on the page card: a horizontal swipe ≥ ~60px turns the page like a physical RTL
   book — swipe right = NEXT page, swipe left = previous. Only trigger when horizontal
   displacement clearly dominates vertical (don't break scrolling), and not while a tour runs.
5. Fix the English pager direction: the sidebar prev/next buttons follow UI direction today, so
   in English the left-pointing button means "previous" — backwards for this book. Rework the
   pager so the left-side button ALWAYS advances (next page) and the right-side goes back, in
   both languages, with icons and tooltips matching. Arabic already behaves correctly — do not
   change its behaviour. Apply the same to the memorize-mode "next page" arrow icon.
6. Focus mode (normal reader only, not memorize mode): a toggle button next to the
   single/double view toggle (FiMaximize2 / FiMinimize2) hides the sidebar + page header and
   centers the mushaf column at a comfortable max width. Exit via the same floating button
   (top corner), Escape, or the 'f' key. Persist in localStorage ('mushafFocus'); never
   auto-enter while a tour is running. The audio bar and tafsir panel must remain fully usable
   in focus mode.
7. All new strings in both locales; verify RTL layout and dark mode for every new control.

Run npm run lint and npm run build in client/. Then start the dev server and manually verify
(this also covers the pending Stage 1 visual pass): pages 1, 2, 50, 106, 443, 587, 596,
602–604 render inside their frames in single + double view, light + dark; keyboard arrows in
EN and AR; edge clicks; spread in memorize mode with self-test on; marking a spread
memorized; focus mode with audio playing and tafsir open.
```

---

### Stage 1.6 — Reader UX feedback round

**Goal:** fixes and refinements after the first hands-on pass of Stage 1.5: RTL positioning bug
in focus mode, per-page interactive ticks (replacing the combined spread CTA), page-turn
animation, and a reworked self-test with two styles (hide-all with a multi-word peek window +
a new cover-cursor mode).

**Prompt for Claude Code** (same session as Stages 1/1.5; do not commit until the user accepts):

```
Feedback round on the reader UX changes — fixes + refinements. Client-only again
(Library.jsx, MushafPage.jsx, index.css, en.json + ar.json).

1. Focus-mode bug: the floating "exit focus" button appears on the wrong side, and its
   tooltip opens in the wrong direction. Position the button with logical properties
   (Tailwind end-* / inset-inline-end) so it sits at the top-end corner in both languages,
   and make its Tooltip open toward the page center in both EN and AR. Re-test both.

2. Interactive per-page tick: the FiCheckCircle tick in each page card's footer becomes a
   toggle — clicking marks/unmarks THAT page as memorized (same optimistic update, rollback
   and toasts as the sidebar action; disabled while a save is in flight). Show an unmemorized
   state too (hollow circle) so it's discoverable, with a tooltip ("Mark page N as memorized"
   / "Remove page N"). Works in normal AND memorize mode, single and double view.

3. Replace "mark these pages" in the memorize-mode spread: show one button per visible page,
   labelled with its page number ("Mark page 3" / "Mark page 4"), each with its own
   done-state and undo. The single-page layout stays exactly as it is. Keep "Next page"
   advancing by the spread step.

4. Page-turn animation: animate page changes for ALL navigation methods (pager buttons,
   arrows, edge clicks, swipe, juz/surah jumps): outgoing content slides ~24px and fades out
   in the direction of travel, incoming slides in from the opposite side (~180ms ease-out).
   Direction-aware for an RTL book: forward = content exits toward the right, back = toward
   the left. No animation on initial mount, none when prefers-reduced-motion is set, and the
   frame/card must not move — animate the page content only. Loading skeletons must not
   double-animate.

5. Self-test rework — two testing styles behind a small segmented control in the self-test
   card (replacing the single "Test yourself" toggle):
   - "Hide all" (existing, improved): everything blurred; hovering reveals a WINDOW — the
     hovered word plus 2 neighbours on each side within the same physical line (line-scoped,
     crossing verse boundaries, like sliding a finger along the line). Clicking still reveals
     the whole verse permanently; the Reveal all / Hide all buttons stay.
   - "Cover cursor" (new): text fully visible; hovering blurs that same 5-word window under
     the cursor, transiently — moving the cursor away restores it, nothing stays hidden.
     Clicking behaves like normal verse selection. Touch devices (no hover): tapping a verse
     in this mode blurs that verse for ~2 seconds, then restores.
   Implementation note: this needs word-level hover state (line number + word index within
   the line) in MushafPage.jsx instead of the current verse-level hoverVerse — compute the
   affected word set there. Update the memorize-mode hint strings (en/ar) to describe both
   styles briefly.

6. All new strings in both locales; verify RTL and dark mode for every change.

Run npm run lint and npm run build. Leave the dev server running and list exactly what I
should check in the browser. DO NOT commit yet — once I confirm everything looks right,
commit this round together with the uncommitted Stage 1.5 work and push. Commit messages in
first person, never mentioning AI or assistants (per CLAUDE.md); split into logical commits
if that reads better.
```

---

### Stage 1.7 — Reader UX round 3 + page bookmarks

**Goal:** self-test refinements from hands-on testing (cover-the-*next*-words, 3-state click
cycle, drag-to-reveal), remaining placement fixes, and the first account-saved reader feature:
page bookmarks.

**Design notes:** cover-cursor now hides the words *ahead* of the pointer (visually left — the
upcoming words in RTL reading) so the user points at the word they're reciting; that turns it
into a genuine recall drill. Bookmarks are account-backed (they must sync across devices) via a
slim dedicated `Bookmark` model — Stage 6's `Annotation` model stays separate.

**Prompt for Claude Code** (same session; do not commit until the user accepts):

```
Third feedback round + one small feature. Mostly client (Library.jsx, MushafPage.jsx,
index.css, en.json + ar.json) plus a small backend addition for bookmarks.

1. Cover-cursor direction (self-test): don't blur the window centred under the cursor. The
   hovered word — and everything already read, i.e. to its RIGHT on the line — stays VISIBLE,
   so the user can point at the word they are reciting. Blur the NEXT 4–5 words in reading
   order (visually to the LEFT of the hovered word, same line). Still transient — moving the
   cursor away restores everything.

2. Hide-all mode, two changes:
   a. Clicking a hidden verse cycles 3 states: 1st click reveals the verse; 2nd click selects
      it (opens the verse-action popover for listen/tafsir); 3rd click hides it again and
      deselects. Clicking a different verse starts that verse's own cycle (selection moves as
      usual).
   b. Drag-to-reveal: pressing the mouse button on hidden text and dragging across words
      permanently reveals exactly the words passed over (word-level, not whole verses). A
      plain click (< a few px of movement) does behaviour (a) instead. Needs a word-level
      revealed set (verseKey + position) alongside the verse-level one; "Hide all" clears
      both; page change resets both. Desktop pointer only — it must NOT trigger or fight the
      touch swipe page-turn (keep the swipe touch-only / check the event source).
   Do NOT implement auto-revealing the lines above the current line — deliberately deferred.

3. Focus mode: move the floating exit button to the SAME side the sidebar occupies (the start
   side — left in EN, right in AR): inset-inline-start positioning, tooltip opening toward the
   page centre.

4. Normal (non-memorize) two-page view: the sidebar still shows the combined "mark these
   pages" button — replace it with the same per-page "Mark page N" buttons used in the
   memorize spread (each with its own done-state and undo).

5. Edge-turn chevrons: relocate them OUTSIDE the page frame — floating at the outer edges of
   the page card(s) like carousel arrows, vertically centred, with a subtle circular backdrop
   so they read clearly on any background. In the 2-page spread they flank the whole spread
   (they currently sit on the frame border and are invisible there). Fade in on column hover;
   still absent on touch devices.

6. Page bookmarks (account-saved, multiple per user):
   Backend — new model server/models/Bookmark.js: { userId, pageNumber (1–604, required),
   label (optional, trimmed, ≤50 chars), timestamps }, index { userId: 1, pageNumber: 1 };
   cap 100 bookmarks per user (400 with a clear message beyond that). New routes
   /api/bookmarks (all behind middleware/auth.js protect, in the style of
   routes/progressRoutes.js): GET / (the user's list sorted by pageNumber), POST /
   { pageNumber, label? }, DELETE /:id (ownership-checked). Register in server/app.js.
   Integration tests in server/tests/bookmarks.test.js: CRUD, ownership isolation, the cap,
   validation.
   Client — add bookmarksAPI to services/api.js. Library sidebar (normal mode): a "Bookmarks"
   section with an "add bookmark for this page" action (optional label input) and the saved
   list (label or "Page N") with jump-to-page and delete. Show a small bookmark-ribbon icon
   on a page card's header when that page is bookmarked.

7. Small fixes:
   a. The verse-popover "drag to move" tooltip keeps showing WHILE dragging — suppress it
      from pointerdown until pointerup.
   b. Declutter the Library's always-visible helper texts: move the sidebar explainer
      paragraphs (the memorize "focused, guided session…" hint, the test-self hint, the
      enter-memorize hint) into the existing InfoHint icon component beside their control;
      the "tap a verse" cue above the mushaf shows only until the user first selects a verse
      (persist a localStorage flag) — except the memorize-mode tap-to-reveal variant, which
      stays while self-testing.

8. All new strings in both locales; RTL + dark mode checks for every change.

Run client npm run lint + npm run build AND cd server && npm test (bookmark tests must pass).
Leave the dev server running and list exactly what I should check. DO NOT commit — after I
accept visually, commit everything pending (Stages 1.5 + 1.6 + this round) as logical
first-person commits (never mentioning AI, per CLAUDE.md) and push.
```

---

### Stage 1.7b — Acceptance fixes: reveal watermark + bookmark rules

**Goal:** the hide-all self-test reveals as a clean reading-order *prefix* (revealing a point
reveals everything before it), drag-reveal never loses the last words, spread bookmarks target
the page the user actually touched last, and bookmarks get uniqueness rules.

**Prompt for Claude Code** (same session; still no commits until acceptance):

```
Acceptance-round fixes (round 4). Client plus a small bookmarks backend change.

1. Hide-all self-test → replace the independent revealed sets with a READING-POSITION
   WATERMARK per visible page. Reading order on a page: top line to bottom, right→left
   within a line. A word is revealed iff its page-order index ≤ that page's watermark (the
   transient hover peek stays layered on top).
   - Revealing a verse (1st click of the cycle) advances the watermark to that verse's last
     word — so all earlier lines AND the earlier part of its own line reveal too (reciting
     from the top of the page).
   - Drag-to-reveal advances the watermark to the FURTHEST word that became visible during
     the drag, including the words shown by the peek window at the moment of release. (Today
     the last 1–2 words visible ahead of the cursor re-hide on release — confusing.) With the
     watermark, nothing that was visible during the drag disappears.
   - 3rd click (hide) moves the watermark back to just before that verse's first word — that
     verse and everything after it re-hides. The revealed region is ALWAYS a clean prefix of
     the page; that's the invariant.
   - "Reveal all" = watermark at page end; "Hide all" and page changes reset to 0. In the
     two-page spread each page keeps its own watermark (revealing on the left page doesn't
     touch the right page); a verse straddling the spread advances the watermark on each page
     it has words on.
   Delete the now-redundant verse-level and word-level revealed sets and their plumbing.

2. Bookmarks target the ACTIVE page in the spread: track the last page the user interacted
   with (clicked a word, a footer tick, or anywhere on a page card); default to the right
   page. The add-bookmark control targets that page and says so ("Bookmark page N").
   Single-page view unchanged.

3. Bookmark uniqueness (backend + client + tests):
   - One bookmark per page per user: make the { userId: 1, pageNumber: 1 } index UNIQUE;
     POST for an already-bookmarked page → 409 with a clear message.
   - Non-empty labels unique per user (trimmed, case-insensitive) → 409 "you already have a
     bookmark with this name". Empty labels may repeat (they display as "Page N", already
     unique via the page rule).
   - Client: when the active page is already bookmarked, swap the add control for that
     bookmark's state ("Bookmarked — remove"), and surface the 409 messages as toasts.
   - Extend server/tests/bookmarks.test.js to cover both rules.

4. Locales for changed strings; RTL + dark mode as usual.

Run client npm run lint + npm run build and cd server && npm test. Still DO NOT commit —
after I accept this round, commit ALL pending work (Stages 1.5 through this round) as logical
first-person commits (no AI mentions, per CLAUDE.md) and push.
```

---

### Stage 1.7c — Commit checkpoint + small fixes round

**Goal:** land Stages 1.5 → 1.7b as clean per-feature commits, then three small fixes: the
hide-all peek reveals only the word under the cursor, the onboarding language choice survives a
refresh (plus a language toggle on the onboarding page), and `/library` opens at the user's next
new-memorization page.

**Prompt for Claude Code** (same session):

```
You're accepted. First commit, then a small round 5.

0. COMMIT + PUSH all pending stage work now (Stages 1.5 → 1.7b). Split into logical
   first-person commits per feature — suggested boundaries (merge where files overlap too
   much to split cleanly):
   - reader navigation: spread in memorize mode, keyboard/edge/swipe turns, pager direction
   - focus mode
   - page-turn animation
   - per-page mark ticks + per-page mark buttons (normal + memorize, single + spread)
   - self-test rework (segmented control, cover-cursor direction, reveal watermark)
   - bookmarks backend (model + routes + tests)
   - bookmarks UI (sidebar section, ribbon, active-page targeting)
   - declutter + tooltip fixes
   Rules: first person, never mention AI/assistants (CLAUDE.md). Do NOT include unrelated
   docs/ files (IMPROVEMENT_PLAN.md, MEETING_WALKTHROUGH.md, PRESENTATION_SPEAKER_NOTES.md,
   PROJECT_FACTS.md, STUDY_SESSIONS.html, TEAM_OVERVIEW.md, CODE_GUIDE.md) or any other
   out-of-scope changes. Push when done and report the commit list.

Then round 5 — implement, verify, but do NOT commit until I accept:

1. Hide-all peek = single word only: the hover peek must reveal ONLY the word directly under
   the cursor — not its neighbours (revealing the following words by accident spoils exactly
   the words the user should recall themselves). Drag-to-reveal consequently advances the
   watermark to the word under the cursor. Cover-cursor mode stays as is.

2. Onboarding language bug: selecting Arabic and refreshing during onboarding reverts the UI
   to English, with no way to switch back on that page. Investigate why the choice is lost —
   likely the authenticated user's user.language (default 'en') overriding the i18next
   detection on reload. Fix so an explicit language choice survives refresh: persist it
   (localStorage) and, when authenticated, also save it via the existing
   PUT /api/auth/profile { language }. Then add the existing LanguageToggle component to the
   Onboarding page (top corner, RTL-aware) so the language can be changed there.

3. Library default page: when /library is opened WITHOUT a ?page param, open at the user's
   next new-memorization page — the first page not in the memorized set, computed from the
   getAllProgress data the Library already fetches on mount (no extra API call). Fallbacks:
   if everything is memorized or progress fails to load, use the last-opened page (persist
   'lastMushafPage' in localStorage on every page change), else page 1. An explicit ?page in
   the URL must always win (dashboard links, bookmarks, deep links unaffected). Resolve with
   replace-style navigation so a refresh keeps the resolved page.

4. Housekeeping: two dev servers appear to be running (5173 and 5174) — stop the stray one if
   it belongs to this session.

5. Locales for any new strings; RTL + dark mode. Run client npm run lint + npm run build
   (and server npm test if anything server-side changed). Report what I should check in the
   browser. Don't commit round 5 until I accept it.
```

---

### Stage 1.7d — Streak integrity on undo

**Goal:** undoing the day's only completion restores the streak to its pre-completion state;
streaks stop being farmable via mark + undo.

**Design:** snapshot & restore. `unmarkPageComplete` can't reconstruct the old
`lastActiveDate` after it's overwritten (off-day/view-only ticks make it non-derivable from
progress docs), so the day's *first* streak-affecting action saves the prior
`currentStreak`/`lastActiveDate` into `prevStreak`/`prevActiveDate`; an undo that leaves zero
completions today restores both. Two marks + one undo correctly keeps the streak.

**Prompt for Claude Code** (same session, after round-5 acceptance):

```
Round 5 is accepted. Do these in order:

0. Commit + push round 5 (single first-person commit or two if language-fix/default-page split
   cleanly; no AI mentions, per CLAUDE.md).

0b. OPTIONAL — history cleanup: rewrite commits 20e90db and d882f63 to remove the
   "Co-Authored-By: Claude Opus 4.8" trailer (message-only rewrite, e.g. scripted
   filter-branch/rebase with --exec amend), then push with --force-with-lease. Verify the
   rewritten history builds and the working tree is untouched before pushing.

Then: fix streak integrity on undo (server + tests + a small client touch).

Problem: markPageComplete bumps currentStreak/lastActiveDate, but unmarkPageComplete never
reverts them — marking a page and undoing it keeps the streak, which makes streaks farmable.

Fix — snapshot & restore:
1. User model (server/models/User.js): add prevStreak (Number, default null) and
   prevActiveDate (Date, default null).
2. markPageComplete: when this is the first streak-affecting action of the day
   (lastActiveDate is null or a different UTC day than now), save the CURRENT
   currentStreak/lastActiveDate into prevStreak/prevActiveDate before overwriting them.
   Do the same snapshot in the two getTodayTasks places that bump lastActiveDate (the
   off-day tick and the view-only-complete tick) so the fields are always coherent.
3. unmarkPageComplete (both 'new' and 'review' paths): after reverting the page, check
   whether ANY completion remains today for this user — any UserProgress with memorizedDate
   today OR lastReviewedDate today (UTC). If none remains AND lastActiveDate is today,
   restore currentStreak = prevStreak and lastActiveDate = prevActiveDate (null is a valid
   restored value). Include the updated streak in the response body.
4. Client: after an undo, make sure the visible streak (dashboard stats chip) reflects the
   restored value — Dashboard refetches today's tasks after undo; verify that's enough and
   wire the response value through if it isn't.
5. Tests (server/tests/progress.test.js style):
   - fresh user: mark (streak 0→1) then undo → streak 0, lastActiveDate null again.
   - continuing user: streak 5, mark → 6, undo → 5 and lastActiveDate restored to the
     prior day.
   - two completions today: undo one → streak unchanged; undo the second → restored.
   - re-mark after a full undo on the same day → streak increments again correctly.

6. Library UI simplification: remove the sidebar "mark as memorized" action buttons in BOTH
   normal and memorize mode, single and spread view — the "Mark memorized"/"Undo memorized"
   button, the per-page "Mark page N" buttons, and the memorize-mode mark CTA with its undo
   link. The interactive check button at the bottom of each page card becomes the ONLY
   mark/unmark control. Keep the passive "memorized" badge and the memorize-mode "Next page"
   button (navigation, not marking). Remove locale strings that become unused.

Run cd server && npm test and client npm run lint + npm run build. Report results; commit the
streak fix separately after I check it.
```

---

### Stage 1.8a — Unified reader: mode merge + page scrubber

**Goal:** one reader, one sidebar (the memorize/normal split is gone — decision made by the
user after hands-on use), the last passive memorized badges removed, and a fast page scrubber
at the bottom.

**Prompt for Claude Code** (same session; step 0 commits the pending 1.7d work first):

```
Big round: merge memorize mode into the normal reader, plus cleanup and a page scrubber.

0. FIRST: the pending streak-fix + Library-simplification work is accepted — commit and push
   it now as the two commits you proposed (first person, no AI mentions).

1. Remove the remaining passive memorized indicators from the sidebar: the "Memorized" badge
   (both modes, single + spread) and the memorize-mode "✓ This page is memorized" row. The
   page-card footer tick is now the ONLY memorized indicator and control. Drop unused locale
   keys.

2. MERGE memorize mode into the normal reader — one mode, one sidebar:
   - Single sidebar, sections in this order: page navigation (pager, page input, view +
     focus toggles), Self-test (the Off / Hide-all / Cover-cursor segmented control with its
     InfoHint), Memorization method checklist (collapsible, COLLAPSED by default; keep the
     "full guide" modal link), Jump to Juz, Jump to Surah, Bookmarks, the pages-memorized
     stat.
   - Delete the mode concept: no ?mode=memorize handling, no enter/exit memorize buttons, no
     memorize header chip, and no memorize-only "Next page" button (pager, keys, edges,
     swipe and the new scrubber cover navigation). Legacy URLs containing mode=memorize must
     still work — strip/ignore the param.
   - Self-test works exactly as it did in memorize mode, available always (including
     two-page view and focus mode). Move testSelf/watermark state and hint strings out from
     behind the memorizeMode flag.
   - Update Dashboard: task-card links currently point to /library?page=N&mode=memorize →
     /library?page=N, with a sensible label ("Memorize in Library" is fine).
   - Merge the tours: fold the memorize tour's still-relevant steps (self-test control,
     footer tick) into the main library tour; delete the separate memorize tour and its
     seenMemorizeModeTour flag. The merged tour must pass with the new DOM.
   - Sweep ALL related code: memorizeMode conditionals in Library.jsx and props into
     MushafPage, libraryTour.js, dashboardTour.js if it references memorize, locale keys
     (delete dead ones, rename where "memorize.enter" no longer fits), and code comments
     that describe the old two-mode design.

3. Page scrubber: a slim horizontal scrubber at the bottom of the mushaf column (above the
   audio bar) for fast page navigation without typing:
   - Full-width range control 1–604, RTL like the book (page 1 at the RIGHT end, 604 at the
     left), with small tick marks at the 30 juz start pages.
   - While dragging, a floating bubble shows the target page number + juz (Arabic-Indic
     digits in AR); the mushaf does NOT reload during the drag — navigate on release
     (mouse and touch). Clicking anywhere on the track jumps there.
   - Keyboard accessible (native range semantics or a proper ARIA slider); styled for
     light/dark and both directions. In two-page view, releasing snaps to the spread's odd
     anchor page exactly like goToPage does.

4. Refresh docs/CODE_GUIDE.md §6 to describe the unified reader you just built (one mode,
   self-test styles + watermark, focus mode, bookmarks, navigation incl. the scrubber) —
   keep the guide's plain-language teaching style, and remove the "mid-evolution" warning
   note at the top of §6 since the section will now be current.

5. Locales (en + ar) for every new/renamed string; RTL + dark mode + light mode checks.

Run cd server && npm test (should stay green — untouched) and client npm run lint +
npm run build. Leave the dev server up and list what to check. Don't commit this round until
I accept it; then commit in logical chunks (badge cleanup can ride with the merge commit;
the scrubber separate; the CODE_GUIDE refresh with the merge).
```

---

### Stage 1.8b — Mushaf margin ornaments (juz / hizb / quarter / sajda marks)

**Goal:** the reader shows the printed mushaf's margin landmarks — an ornament where each
juz, hizb, and quarter-hizb begins, and the sajda mark (۩) beside each of the 15
prostration verses, like the Madinah print.

**Deliberately NOT included** (know why): waqf pause signs, saktah marks, and the overline
on a sajda word are already part of the QCF glyphs themselves — nothing to add. Ruku' (ع)
marks belong to Indo-Pak prints, not the Madinah mushaf these fonts reproduce. Manzil
divisions are skipped as clutter.

**Prompt for Claude Code** (self-contained — runs fine in a fresh session):

```
Add the printed mushaf's margin marks to the Library reader: juz/hizb/quarter-hizb
boundary ornaments and sajda (prostration) marks. Client-only.

Data: the quran.com verses/by_page response already carries verse-level juz_number,
hizb_number, rub_el_hizb_number and sajdah_number (see docs/samples/page106.json for the
shape) — extend the verse-level `fields` requested in client/src/services/mushafApi.js as
needed and keep them on the shaped verse objects (the in-session page cache will hold the
new shape automatically; just confirm nothing else depends on the old shape).

Rendering (client/src/components/MushafPage.jsx + index.css):
1. Per rendered page, find the verses where rub_el_hizb_number increases relative to the
   previous verse ON THAT PAGE — and also mark the page's first verse when a new quarter
   begins exactly there. For each boundary, take the line number of the verse's first word
   on this page.
2. Draw a margin ornament at that line's height on the page's OUTER edge (right edge of the
   right/odd page, left edge of the left/even page in a spread; right edge in single view).
   Position it with the fixed 15-slot geometry — top ≈ (lineNumber − 0.5) / 15 of the text
   area — no DOM measurement needed; it scales with the frame.
3. Style like the Madinah print: a rub-el-hizb star medallion (۞, U+06DE). Quarter starts
   get the small medallion labelled ربع الحزب / نصف الحزب / ثلاثة أرباع الحزب as
   appropriate; a whole-hizb start reads الحزب N; a JUZ start gets a slightly larger
   ornament labelled الجزء N. Labels stay Arabic in BOTH UI languages (it's the mushaf,
   like the print); add a translated Tooltip on hover. Use the existing theme golds/inks
   (--mushaf-mark / --mushaf-ink), light + dark variants.
4. Sajda marks: for each verse on the page with a non-null sajdah_number, draw the sajda
   ornament ۩ (U+06E9) in the same outer margin, aligned to the line containing the sajda
   word (use the verse's LAST word's line on this page — the sajda word is at/near the
   verse end; the word itself already carries the print's overline in its glyph). Slightly
   smaller than the hizb medallion, same gold, tooltip "سجدة / Sajdah".
5. Keep all marks subtle and non-interactive (tooltips aside), and make sure they don't
   collide with the edge-turn hover arrows (ornaments hug the frame; the arrows float
   further out). If a sajda and a hizb mark land on the same line, stack them vertically
   with a small gap.
6. Locale strings only for the tooltips. RTL + dark mode checks.

Verify against a real mushaf on pages with known boundaries (juz 2 starts on page 22; the
quarters of juz 1 fall around pages 6/11/16) and known sajdas (7:206 on page 176, 32:15 on
page 416, 96:19 on page 597) plus a two-page spread. npm run lint + npm run build.
```

---

### Stage 1.8 — Library UX redesign (mobile + sidebar polish)

**Goal:** a design-led pass over the whole Library experience. Deliberately **not prompted yet**
— the user is first simulating the UX themselves step by step (memorize flow, tafsir, reciters,
…). The memorize/normal merge originally scoped here was decided and pulled forward into
Stage 1.8a. Remaining scope for when the prompt is written:

- **Mobile-first Library pass** — the page is desktop-shaped today: sidebar becomes a bottom
  drawer/sheet on small screens, bigger touch targets, audio bar ergonomics, spread correctly
  unavailable, popover vs. small screens.
- **Minimal sidebar** — collapse the sidebar into fewer, collapsible sections; audit every
  always-visible element against "does a reader need this right now?".
- **Right-click context menu on verses (evaluate)** — desktop power-user shortcut duplicating
  the popover actions (play, tafsir, highlight, hard, bookmark). Never the only path: no
  right-click on touch, and discoverability is poor — primary interaction stays tap/click.
- Extend the Stage 1.7 hint-declutter pattern site-wide (Dashboard, Settings, Onboarding).

---

### Stage 1.9 — Public Library (browse without an account)

**Goal:** anyone can read the mushaf, listen, and open tafsir without signing up; account-only
actions degrade to a sign-in nudge.

**Prompt for Claude Code:**

```
Make the Library public — usable without an account.

1. Routing: move /library out of ProtectedRoute in client/src/App.jsx. The page must render
   fully logged-out: mushaf pages, navigation, audio, tafsir all work (they only use public
   external APIs + static fonts).
2. Auth-gated features degrade gracefully when logged out: skip the progress and bookmarks
   API calls entirely (no 401 toasts), and replace the mark-memorized footer ticks and the
   bookmarks section with one compact "Sign in to track your progress" affordance linking
   to /login with a returnTo that restores the current page after login (support returnTo
   in the login flow).
3. Navbar on /library when logged out: show the public navbar state (Login / Register), like
   the landing page.
4. Landing page: add a "Browse the Mushaf" link to /library so visitors can try the reader
   before signing up.
5. Verify logged out: deep link /library?page=291 works (self-test is client-only — only
   marking/bookmarks need auth), EN/AR, light/dark, mobile width, and that logging in from
   the nudge returns to the same page.

Run npm run lint and npm run build in client/.
```

---

### Stage 2 — Real Quran structure data (kills the page-50 bug class)

**Goal:** replace the guessed per-page surah metadata with exact data derived from the quran.com
API, and store verse/hizb structure that Stage 5 needs.

**Prompt for Claude Code:**

```
Replace the heuristic Quran page metadata with exact per-page structure data.

Context: server/seed/quranData.js builds QuranMetadata (server/models/QuranMetadata.js) for all
604 pages by guessing which surahs appear on a page from surah start-pages
(getSurahsForPage). The heuristic is wrong: it assumes any multi-page surah bleeds into the
page where the next surah starts. Real example: the dashboard shows "Page 50 — Al-Baqarah ·
Aal-Imran" but Al-Baqarah ends on page 49. The quran.com API v4
(https://api.quran.com/api/v4/verses/by_page/{page}?fields=text_uthmani&per_page=50) returns,
per verse: verse_key, juz_number, hizb_number, rub_el_hizb_number, ruku_number — see the sample
saved at docs/samples/page106.json (or page106.json in the repo root) for the exact shape.

Required changes:
1. Write a one-time generator script server/seed/fetchQuranStructure.js that iterates pages
   1..604 against the quran.com API (throttle ~5 req/s, retry on failure) and writes a static
   JSON file server/seed/data/quranStructure.json with, per page: pageNumber, juzNumber,
   hizbNumber (of first verse), firstVerseKey, lastVerseKey, verseKeys (ordered array),
   rubBoundaries (verse keys on this page where rub_el_hizb_number changes), and surahs — the
   ordered list of surahs with at least one verse on the page as
   { number, name, nameArabic } (reuse English/Arabic names from the existing surahData array).
   The script is run manually once and the JSON is committed; the app must never call the
   external API at runtime for this.
2. Extend the QuranMetadata schema with firstVerseKey, lastVerseKey, verseKeys, hizbNumber,
   rubBoundaries (keep existing fields; surahs/surahName now come from real data).
3. Rewrite server/seed/quranData.js to seed straight from quranStructure.json (keep the
   "clear and re-insert" behaviour and the summary log).
4. Run the generator, commit the JSON, and re-run the seed instructions in the README/CLAUDE.md
   stay accurate (update the seeding section of CLAUDE.md if the command changes).
5. Add a Node test (server/tests/quranStructure.test.js, using the committed JSON, no network)
   asserting: 604 pages; page 50 lists ONLY Aal-Imran; page 49 ends with Al-Baqarah; page 1 is
   Al-Fatiha only; page 604 lists Al-Ikhlas, Al-Falaq, An-Nas; every page's verseKeys are
   non-empty and contiguous with the next page's firstVerseKey.
6. Verse labels on daily tasks: extend the task DTOs in
   server/controllers/progressController.js (toNewPageDto / toReviewPageDto, and the week-plan
   page info objects) with firstVerseKey and lastVerseKey from the new metadata. In
   client/src/pages/Dashboard.jsx, show the span under the surah names on task cards — for a
   new-page task: "starts at 2:187"; for review cards: "2:187–2:196". Localize both
   (client/src/locales/en.json and ar.json), using Arabic-Indic digits in Arabic via
   toArabicDigits from client/src/services/quranApi.js.
7. Check the client for places that display page→surah info and confirm they render multi-surah
   lists correctly with the fixed data (client/src/utils/surahDisplay.js already joins
   page.surahs with ' · '; the bug was only the data).

Run the backend test suite (cd server && npm test) and make sure everything passes.
```

> After merging: run `node seed/quranData.js` against the production database once.

---

### Stage 3 — Memorization direction & start point

**Goal:** the user chooses where new memorization proceeds from: start of the mushaf (default),
end of the mushaf (short surahs of Juz ʿAmma first), or a custom anchor with wrap-around.

**Prompt for Claude Code:**

```
Add a "memorization direction" plan setting.

Context: new-page selection currently walks pages 1→604 and picks the first unmemorized ones.
That loop is duplicated in three places in server/controllers/progressController.js:
getTodayTasks (newPageNums + extraNewPageNums), buildProgressSummary, and getWeekPlan
(unmemorizedPages). The review cycle already supports a custom start anchor
(cycleReviewStartPage) — mirror that pattern for new memorization.

Backend:
1. User model (server/models/User.js): add memorizationDirection: 'fromStart' | 'fromEnd'
   (default 'fromStart') and newMemorizationStartPage: Number 1–604, nullable (custom anchor).
   Extend PUT /api/auth/profile validation in server/controllers/authController.js and include
   both fields in the login / getMe / updateProfile response payloads like the existing plan
   fields.
2. Create ONE helper, nextUnmemorizedPages(user, memorizedSet, count): fromStart walks 1→604;
   fromEnd follows a precomputed surah-backward/pages-forward order derived from
   quranStructure.json (see the design fix note in Part 2 — NOT a raw 604→1 walk); when
   newMemorizationStartPage is set (fromStart-only), start there and wrap around so the
   skipped pages are scheduled last. Replace all three inline loops with it, including the
   continuation-page pick for 0.5-page days (the "most recently memorized page" logic stays,
   only ordering-sensitive code changes).
3. getWeekPlan must project future days with the same ordering. getEstimate only depends on
   counts — verify and leave alone.
4. Tests (follow server/tests/progress.test.js patterns): a fresh fromEnd user is assigned page
   604 first; custom anchor at Juz 29 (page 562) wraps to cover pages 1–561 last; switching
   direction mid-plan picks the correct next page without touching existing progress.

Frontend:
5. Onboarding (client/src/pages/Onboarding.jsx): after the daily-goal step, add a "Where do you
   want to start?" choice — From the beginning (Al-Baqarah onward) / From the end (the short
   surahs of Juz 'Amma first — recommended for beginners) / Custom (pick a Juz or Surah, which
   maps to newMemorizationStartPage). Send the fields with the existing profile/onboarding
   calls.
6. Settings (client/src/pages/Settings.jsx): the same control in the plan section so it can be
   changed later; changing it takes effect from tomorrow's tasks naturally (no data rewrite).
7. Dashboard needs no structural change — tasks simply arrive in the new order. Verify the
   week-plan tab reflects the direction.
8. Both locales (client/src/locales/en.json, ar.json), including a one-line hint explaining
   the from-the-end option. RTL + dark mode as usual.

Run cd server && npm test and cd client && npm run lint && npm run build.
```

---

### Stage 4 — Production hardening

**Goal:** safe to put in front of strangers: rate limits, input validation, no internals leakage,
fast first load, monitoring hooks.

**Prompt for Claude Code:**

```
Harden the app for production. Backend (Express 5, server/) and frontend (React 19 + Vite,
client/) changes:

Backend:
1. Rate limiting: using the existing express-rate-limit dependency, add (a) a strict limiter on
   POST /api/auth/login and /register — e.g. 10 attempts per 15 min per IP, and (b) a general
   API limiter (e.g. 300 req/15 min per IP) mounted on /api. Keep the existing chat limiter.
   Follow the style of server/middleware/chatRateLimit.js. Make limiters no-ops under
   NODE_ENV=test so the existing test suite is unaffected.
2. Input validation: add a small validation middleware (hand-rolled, no new heavy deps) that
   asserts expected primitive types on every route's body/query inputs — reject objects/arrays
   where strings/numbers are expected (this closes the NoSQL-operator injection surface, e.g.
   login accepting {"$gt":""} as email). Apply to all auth and progress routes. Return 400 with
   a clear message.
3. Error responses: create a helper so 500 responses never include error.message in production
   (keep it in development). Update all controllers (they currently return
   { error: error.message } everywhere). Keep the console.error server-side logging.
4. Boot assertions: in server/server.js, fail fast at startup with a clear message if
   MONGODB_URI or JWT_SECRET is missing. Await the Mongo connection before app.listen.
5. Token hygiene: add passwordChangedAt to the User model, set it in the changePassword flow,
   and reject JWTs issued before it in middleware/auth.js (compare iat). Add a test.
6. Static-data cache: QuranMetadata is a static 604-row table. Load it once into an in-memory
   Map at first use and serve getMetadataMap/getJuzProgress lookups from memory (invalidate
   nothing — it only changes via reseed+restart). Keep the tests green (they seed metadata in
   memory-mongo, so lazy-load the cache per process and add a test hook to reset it).

Frontend:
7. Route-level code splitting: convert page imports in client/src/App.jsx to React.lazy +
   Suspense with the existing spinner as fallback. Recharts (Progress) and driver.js tours must
   no longer be in the initial bundle. Verify with npm run build output.
8. Error boundary: add a top-level React error boundary with a friendly bilingual "something
   went wrong — reload" screen (use the i18n keys pattern from client/src/locales/).
9. Font caching: in client/vercel.json add headers so /fonts/(.*) is served with
   Cache-Control: public, max-age=31536000, immutable (the QCF fonts are content-versioned
   under /v1/).

Finish by running cd server && npm test and cd client && npm run build && npm run lint — all
must pass. List anything you intentionally did NOT do (e.g. password reset emails, Sentry DSN
wiring) at the end.
```

> Not in this prompt (needs product decisions from you): password reset + email verification
> (requires choosing an email provider — Resend is the easy pick), and Sentry (requires creating
> a project/DSN). Ask for these separately once you've picked providers.

---

### Stage 5 — Verse-level segments: sub-page units + real half-page plan

**Goal:** users can add/remove memorization by verse range, ¼ Hizb, Hizb (plus existing
Juz/Surah/page); 0.5-page daily plans assign actual half pages.

**Prompt for Claude Code:**

```
Add sub-page memorization tracking. Architecture decision (already made): the PAGE stays the
scheduling atom (daily tasks, reviews, streaks — getTodayTasks logic unchanged in spirit); the
AYAH becomes the tracking atom underneath. Stage 2 already added per-page verseKeys,
hizbNumber and rubBoundaries to QuranMetadata (seeded from server/seed/data/quranStructure.json).

Backend:
1. Extend server/models/UserProgress.js with an optional segments array:
   [{ from: "surah:ayah", to: "surah:ayah" }]. Absent/empty ⇒ whole page memorized (all
   existing documents remain valid — no migration). Present ⇒ only those verse ranges of the
   page are memorized. Add a virtual/helper fraction(page) that computes the memorized fraction
   of a page from segments and the page's verseKeys.
2. New endpoint PUT /api/progress/units — body { action: 'add'|'remove', unit:
   'juz'|'hizb'|'rub'|'surah'|'page'|'verses', ref } where ref identifies the unit (juz number,
   hizb number, rub index, surah number, page number, or { from, to } verse keys). The server
   compiles the unit to a verse-key range using QuranMetadata, then upserts/updates
   UserProgress per affected page: full-cover pages get plain memorized rows (segments unset),
   partial pages get segments (merge/subtract against existing segments). Removing works the
   same in reverse (a full page minus a verse range becomes a segments row; a page with all
   segments removed is deleted). Validate everything; reuse the response envelope style of
   progressController.js.
3. Stats: getAllProgress, getJuzProgress and the dashboard percentage should count partial
   pages fractionally (e.g. totalMemorized becomes a float like 213.5; keep an integer
   fullPages count too). Review scheduling continues to treat any page with progress as one
   reviewable page (do NOT change review-queue mechanics).
4. Half-page plan: in getTodayTasks, when the user's dailyNewPages is fractional (0.5 allowed
   range today), assign the actual half of the next page: first active day gets segments
   covering the first half of the page's verseKeys (split at the midpoint verse), next day the
   remainder. The task DTO gains an optional segment { fromVerseKey, toVerseKey, half: 1|2 } so
   the dashboard can label it "Page 106 · first half (4:176–5:2)". markPageComplete with a
   segment payload records/merges segments instead of the whole page; the existing
   whole-page flow must keep working unchanged. Remove/retire the continuationPage hack for
   0.5 plans if it becomes redundant.
5. Tests in server/tests/: unit-compile correctness (a rub that starts mid-page produces a
   partial first page and full middle pages), add/remove round-trip, fractional stats, and the
   half-page task split.

Frontend:
6. Onboarding (client/src/pages/Onboarding.jsx) and the Settings "edit my pages" flow: add
   Hizb and ¼-Hizb tabs alongside Juz/Surah/Range (they compile client-side to the same
   selectedPages set for full-page cover; ¼-Hizb selections that end mid-page call the new
   units endpoint after onboarding completes — keep this simple: onboarding may round to whole
   pages, but the Library/Progress editing flows must be verse-exact).
7. Library: in the sidebar (normal mode), under "mark page memorized", add "mark verses…"
   which lets the user tap two words on the mushaf (start + end, using the existing
   verseKey-anchored selection in MushafPage.jsx) and calls the units endpoint with
   unit:'verses'. Show partially memorized state on the page badge ("½ memorized").
8. Dashboard task cards: render the segment label when present ("first half · 4:176–5:2"),
   both locales (client/src/locales/en.json, ar.json).

Run cd server && npm test and cd client && npm run lint && npm run build. Manually verify the
half-page flow with a 0.5 pages/day account (server/seed/demoData.js can help).
```

---

### Stage 6 — Annotations: highlights, notes, mark-hard

**Goal:** users can highlight words/verses in colors, attach notes, and mark verses or pages as
“hard”, all saved to their account; hard items are reviewable from a list.

**Prompt for Claude Code:**

```
Add account-saved annotations to the mushaf reader.

Design: annotations anchor to verse keys and word positions — MushafPage.jsx already renders
every word as a span keyed by verseKey + position exactly for this purpose (see the component
header comment). Do NOT anchor to pixel positions or text offsets.

Backend:
1. New model server/models/Annotation.js:
   { userId, pageNumber (1–604), verseKey (nullable — null means the whole page),
     kind: 'highlight' | 'note' | 'hard', color (enum: yellow|green|blue|pink, only for
     highlight), text (only for note, max 2000 chars, trimmed), wordFrom/wordTo (optional int
     positions within the verse, only for highlight), timestamps }.
   Indexes: { userId, pageNumber } and { userId, kind }.
2. Routes /api/annotations (all behind middleware/auth.js protect, following
   routes/progressRoutes.js conventions):
   GET ?page=N (all annotations for a page), GET ?kind=hard (the user's hard list, joined with
   page metadata for display), POST (create, validated per kind), PUT /:id (edit note text /
   highlight color), DELETE /:id. Ownership-check every mutation (userId must match). Cap the
   total per user (e.g. 2000) with a clear 400 when exceeded.
3. Tests: CRUD + ownership isolation (user A cannot read/delete user B's annotations) + kind
   validation, in server/tests/annotations.test.js.

Frontend:
4. client/src/services/api.js: add annotationsAPI.
5. Library reader: when a verse is selected, extend the existing verse-action popover
   (Library.jsx, the draggable pill) with: highlight (color swatches), add/edit note, and
   "mark hard" toggle. Highlights render as a background tint on the word spans of that verse
   (respecting wordFrom/wordTo when set) — add the CSS next to the existing
   .mushaf-word.is-selected rules in index.css, with dark-mode variants that keep the glyphs
   legible. Notes show a small indicator at the verse's end-medallion; clicking it opens the
   note in a small panel (reuse the tafsir bottom-sheet/side-panel pattern).
6. Page-level "mark hard": add a small flag button next to the memorized badge in the sidebar.
7. Hard-review list: new collapsible "Hard verses & pages" section in the Library sidebar
   (normal mode) listing the user's hard items with jump-to-page links; also surface a count
   chip on the Dashboard that links to the library at the first hard page.
8. Load annotations per visible page alongside fetchMushafPage (cache per page in state;
   invalidate on mutation). Both locales for all new strings.

Run cd server && npm test, cd client && npm run lint && npm run build. Verify on a multi-surah
page and in the two-page spread (annotations must land on the correct half).
```

---

### Stage 6e — Tafsir expansion: more editions + إعراب الآيات

**Goal:** richer tafsir picker — أيسر التفاسير (Abu Bakr al-Jazairi) and other worthwhile
editions, plus verse-by-verse grammatical analysis (إعراب) — with sources verified before
anything is wired.

**Prompt for Claude Code:**

```
Expand the Library's tafsir editions and add i'rab (إعراب الآيات). Client-only unless a
proxy is genuinely required.

1. DISCOVER before wiring — the project convention (see the verified-200 comments in
   client/src/services/quranApi.js): enumerate what actually exists on the current
   sources — the spa5k tafsir CDN edition list, api.quran.com/api/v4/resources/tafsirs,
   and alquran.cloud's edition list — looking for:
   - أيسر التفاسير (Aysar al-Tafasir, Abu Bakr al-Jazairi) — the user's priority;
   - other well-known Arabic tafsirs worth adding (e.g. الطبري، البغوي، القرطبي) — pick
     2–3 solid ones, not everything;
   - إعراب الآيات — verse-by-verse grammatical analysis (search for i'rab datasets/APIs,
     e.g. Quran i'rab JSON repos, with per-ayah addressing).
   VERIFY each candidate returns 200 with sane content for several sample ayahs (short
   surah, long ayah 2:282, first/last pages). If no reliable i'rab source exists, REPORT
   that honestly instead of wiring a broken one.
2. Add the verified editions to TAFSIR_EDITIONS with proper Arabic + English display
   names, following the existing source patterns (page-based vs ayah-based) and caching.
   إعراب appears as its own entry in the same edition picker.
3. Error handling + caching per the existing per-edition patterns; locales en + ar; RTL.
4. Verify in-browser: switch between all editions on several ayahs including a very long
   one; report exactly which sources were added and which were rejected and why.
```

---

### Stage 7 — Interactive Progress page

**Goal:** change progress directly from the Progress page: toggle pages in the detailed map,
toggle whole Juz, edit from the surah breakdown.

**Prompt for Claude Code:**

```
Make the Progress page (client/src/pages/Progress.jsx) editable in place.

Today it is read-only; editing requires navigating to /settings?tab=memorization&edit=1. The
backend already has everything needed: PUT /api/progress/memorized replaces the full memorized
set (see updateMemorized in server/controllers/progressController.js) and GET /api/progress/all
returns it.

Required UX (explicit edit mode — no accidental changes):
1. Add an "Edit progress" toggle button in the Memorization Map card header. Entering edit mode
   switches BOTH map views into editable state with a visible hint bar ("tap pages to toggle —
   N changed") and Save / Cancel buttons. Exiting without saving discards.
2. In edit mode, detailed map: clicking a page square toggles it. Compact Juz map: clicking a
   Juz tile toggles the WHOLE Juz (all memorized ⇒ clear it, otherwise fill it) — with the
   tile showing a pending-change outline. Surah breakdown: while in edit mode each surah card
   gets the same toggle-all behaviour for its page span (s.start..s.end from
   client/src/data/surahPages.js).
3. Changes accumulate locally in a draft Set; Save calls progressAPI.updateMemorized with the
   full page array, then reloads the page data (reuse the load() callback) and shows a success
   toast; Cancel restores. Disable Save while in flight. Keyboard/AT: squares become buttons
   with aria-pressed in edit mode.
4. Keep the existing "Edit my pages" settings link as a secondary option.
5. New "Projected completion" card: the estimated time to finish the whole Quran, using the
   existing GET /api/progress/estimate endpoint — estimated days/months/years plus the
   projected calendar date (today + estimatedDays; the endpoint already accounts for off
   days). Localized date formatting for EN/AR; place it near the Overall Completion card.
6. Both locales for the new strings (client/src/locales/en.json, ar.json). Respect dark mode
   and RTL (the maps are inside dir-sensitive layout).

Caveat to handle: updateMemorized back-dates newly added pages to yesterday and deletes removed
ones — after saving, the dashboard's today-tasks change; that is expected behaviour, mirror the
Settings flow. Run npm run lint and npm run build in client/.
```

---

### Stage 8 — Leaderboard (opt-in)

**Goal:** a leaderboard page: weekly pages memorized, total memorized, longest streak — privacy
opt-in with a display name.

**Prompt for Claude Code:**

```
Add an opt-in leaderboard.

Backend (server/):
1. User model: add leaderboardOptIn (Boolean, default false) and displayName (String, 3–30
   chars, trimmed; used ONLY on the leaderboard — never expose email or real name). Extend
   PUT /api/auth/profile validation to accept both (displayName required when opting in).
2. New endpoint GET /api/leaderboard?period=week|all (protected):
   - week: aggregate UserProgress documents with status 'memorized' and memorizedDate within
     the last 7 UTC days, grouped by userId, count pages.
   - all: totalMemorized count per user + currentStreak from User.
   Join only opted-in users, sort desc, limit 50, and include the requesting user's own rank
   even if outside the top 50 ("you are #123"). Support the fractional page counts introduced
   by segments if present (sum fractions). Cache the computed board in memory for 5 minutes
   per period (single-instance cache is fine; note it in a comment).
   Add an index on { memorizedDate: 1 } (or a compound that the aggregation can use) to
   UserProgress.
3. Tests: opt-in filtering (non-opted-in users never appear), ranking order, own-rank for a
   user outside the top, in server/tests/leaderboard.test.js.

Frontend (client/):
4. New route /leaderboard (protected, lazy-loaded like the other routes in App.jsx) with a
   Navbar link. Tabs: This Week / All Time. Show rank, display name, pages (and streak on the
   all-time tab); highlight the signed-in user's row; a footer card shows "your rank" when
   outside the list.
5. Opt-in flow: if the user hasn't opted in, the page shows an explainer card with a display
   name input and an "Join the leaderboard" button (PUT profile). Settings gets the same
   toggle + display name field under a new "Community" section, including opting back out.
6. Empty/loading/error states in the established style (skeletons + retry button). Both
   locales; RTL + dark mode.

Run cd server && npm test and cd client && npm run lint && npm run build.
```

---

### Stage 8b — User fix round (leaderboard freshness, audio, landing page) + Stage 6e

**Goal:** four user-reported fixes after hands-on use of Stages 7/8, bundled with the
independent, already-planned Stage 6e (tafsir expansion) since both work in the same
Library/audio area and would otherwise edit the same files twice.

**Root causes already confirmed by the planning session** (don't re-derive):
1. `leaderboardController.js` caches the board 5 minutes and is invalidated ONLY by
   leaderboard-settings changes — never by progress writes.
2. `rangeStart`/`rangeEnd` are indices into `verses`, which holds only the visible
   page(s) — so a repeat range can never span pages.
3. One `<audio>` element gets a new `src` per verse → a fetch+decode gap every verse.
   The existing preload covers page data + font only, not audio.
4. The library landing default is "first unmemorized page"; `lastMushafPage` is only a
   fallback. Item 4 **reverses that Stage 1.7c decision**.

The ready-to-paste prompt lives in the chat handoff; its content is reproduced in the
planning session's message of 2026-07-28. Key decisions baked in: the repeat-range
picker becomes globally addressed by verse key (not page-local index); default range =
selected verse (else page start) → end of the current page; gapless playback via a
double-buffered pair of `<audio>` elements; `?page` still always wins over the
last-opened page.

---

### Stage 8c — Tafsir UX + annotation ergonomics

**Goal:** five user-reported items after hands-on use of the reader: two-way tafsir/verse
sync, a collapsible annotation toolbar with tool shortcuts, a persistent tafsir toggle,
honest handling of grouped (multi-verse) tafsir text, and a side-by-side panel layout
that stops covering the mushaf.

**Root causes already confirmed by the planning session** (do not re-derive):
1. Panel prev/next set `tafsirIndex` only; `selectedVerseKey` is independent. Sync both ways.
2. The draw toolbar renders whenever `drawPage != null`; no collapse, no shortcuts.
   **Refined 2026-09-02 by the user — the pen icon is a THREE-STATE CYCLE:**
   click 1 = annotating ON + panel shown; click 2 = panel hidden but STILL
   annotating; click 3 = stop annotating. Then it repeats. Open question flagged to
   the user: after a click-OUTSIDE collapse (which also hides the panel while
   annotating), the next pen click lands on "stop annotating" under a strict cycle —
   confirm that is wanted, or make click-outside leave the icon re-showing the panel.
3. The panel is reachable only through `openTafsir(index)` from the verse popover.
4. Grouped tafsir is almost certainly the EDITION’s own structure (a passage commentary
   repeated per ayah), not a fetch bug — verify by diffing adjacent ayahs first.
5. The panel is `fixed … z-50` and overlays the reader; the mushaf column never shrinks.

The ready-to-paste prompt lives in the chat handoff (planning session, 2026-08-04).

---

### Stage 8.5 — Product-aware chatbot

**Goal:** turn the Groq assistant from a generic chat into an in-app guide: it knows every
feature, answers "how do I…" questions, and can point users at the right page.

**Prompt for Claude Code:**

```
Make the AI assistant product-aware.

Context: POST /api/chat (server/controllers/chatController.js, Groq-powered, rate-limited by
middleware/chatRateLimit.js) already injects a per-user progress summary
(buildProgressSummary in progressController.js). The client widget is
client/src/components/Chatbot.jsx.

1. Knowledge base: create server/chat/appGuide.md — a concise, maintained guide to the app:
   what each page does (Dashboard, Progress, Library reader + self-test styles +
   bookmarks + focus mode, Settings, Onboarding), how the daily plan works (new pages,
   cycle review, recent review, off days, intensities, half pages), streaks, and the exact
   steps for common tasks ("change my daily goal", "mark an old page memorized", "start
   from Juz 30", "listen to a reciter", "read tafsir", "reset progress", "delete account").
   Load it at boot and inject it into the system prompt alongside the existing progress
   summary. Keep the system prompt within a sensible token budget — the guide must stay
   under ~1500 tokens; tighten wording rather than truncating mid-topic.
2. Deep links: allow the assistant to include app paths (e.g. /library?page=291,
   /settings?tab=memorization) in answers; render them in Chatbot.jsx as internal links
   (react-router navigation, not full reloads), styled like the existing chat UI. Whitelist
   internal paths only — never render external URLs as links.
3. Guardrails: extend the system prompt so the assistant answers app/how-to questions from
   the guide, uses the progress summary for personal questions, and politely declines
   unrelated topics (keep the existing tone/language behaviour — reply in the user's
   language).
4. Suggested prompts: add 3–4 tappable starter chips in the chat widget ("What should I do
   today?", "How does review work?", "How do I use memorize mode?") driven by i18n strings.
5. Tests: a server test asserting the system prompt includes the guide and the progress
   summary for an authenticated call (mock the Groq client; no external calls in tests).
6. Locales for new UI strings; RTL + dark mode.

Run cd server && npm test and cd client && npm run lint && npm run build.
```

---

### Stage 9 — UX polish pass

**Goal:** the “feels professional” details.

**Prompt for Claude Code:**

```
UX polish pass across the client (no backend changes). Work through this checklist; keep each
item small and consistent with existing patterns:

1. Library: prefetch the next/previous mushaf page's data AND its QCF font (fetchMushafPage +
   ensurePageFont from client/src/services/mushafApi.js) when a page finishes loading, so page
   turns feel instant. Also add keyboard navigation: ArrowLeft/ArrowRight turn pages (RTL-aware
   — in the mushaf, "next" is visually leftward), Escape closes the tafsir panel/popover. Ignore
   keystrokes when an input is focused.
2. Library: keep audio playing across a page turn when the next verse is on the new page
   (currently stopAudio() fires on every page change — allow the continue case when the
   playing verse's page equals a newly visible page or playback rolled naturally onto it).
   If that turns out too entangled, at minimum resume-from-verse: after a page turn, the play
   button starts at the first verse of the new page rather than silently resetting.
3. Dashboard: the task list can shift after data loads — add stable min-heights to card
   sections to prevent layout jump; verify with slow network throttling.
4. Global: add a scroll-to-top on route change; add focus-visible outlines consistent with the
   brand color for keyboard users; make the mushaf words reachable via screen readers (each
   word span gets role="button" and an aria-label of "surah X ayah Y" — coarse per-verse labels
   are fine).
5. Landing/About: add proper meta description, OpenGraph tags and a favicon set via
   client/index.html.
6. i18n sweep: run through every page in Arabic and fix any strings that render in English or
   overflow when translated (check the Settings and Onboarding tabs particularly).
7. Verify NFR-01: npm run build, then npm run preview, and check Lighthouse performance on
   / (landing), /dashboard and /library. Report the scores before/after in your summary.
8. Drag to multi-select in the Onboarding and Settings memorized-pages editors: pressing and
   dragging across Juz / Surah / page tiles toggles the whole swept range (same semantics as
   clicking each tile once), with pointer events so it works for mouse AND touch, and no
   interference with normal scrolling (only trigger once horizontal/tile-to-tile intent is
   clear). Visual feedback while sweeping (tiles highlight as the drag passes them).

Run npm run lint and npm run build when done and list every file touched grouped by item.
```

---

## Part 4 — Still open (needs your decisions, not code)

1. **Password reset + email verification** — pick an email provider (Resend / SES / Postmark),
   then ask for the feature; it's a half-day of work once the provider exists.
2. **Sentry (or similar)** — create the two DSNs (client, server) and ask for wiring.
3. **Hosting for scale** — current shape (Vercel static client + single Node instance + Atlas)
   comfortably serves thousands of users. When you outgrow one instance: move the rate limiter
   to a shared store and put the leaderboard cache in Redis. Nothing else in the codebase blocks
   horizontal scaling.
4. **Backups** — enable Atlas continuous backup before real users arrive.
