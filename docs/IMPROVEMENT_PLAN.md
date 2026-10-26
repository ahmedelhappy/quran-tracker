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
| **Planning session #2** (from 2026-07-13) | Same role: plans, writes prompts, reviews reports, verifies claims independently, maintains this doc + CODE_GUIDE.md | Active. Implemented Stages 7 and 8 directly at the user’s explicit request (2026-07-28); otherwise plans and reviews |
| Implementation chats (named by stage) | One or more stages each | History: Stages 0–1.8a in one chat (commits `153dd3b`…`3d0457d`); 1.8b–2b in a second (`641d086`…`3cc1775`); Stage 3 → 5 in a third; Stage 6 onward in per-stage chats; 8b → 8d and the reader polish rounds ran as a sequence of rounds (2026-08 → 2026-09-09); the recitation-stalling fix in its own round (2026-09-12). Every implementation chat commits locally only and NEVER pushes — the user pushes after review |

Workflow: the planning session writes a prompt → paste it into the active implementation
session → paste its final report back into the planning session → it updates this doc and
writes the next prompt. Commits happen only after visual acceptance.

---

## Progress log

> **How to read this log.** Each table row is one event — a stage delivered, a bug
> found, a decision made — in chronological order, oldest first. **New entries are
> APPENDED at the bottom; existing rows are history and are never rewritten.** Only
> the two blocks directly below ("Current status" and "Open queue") are edited in
> place, to stay current.

### Current status — as of 2026-09-23

- **Local commits, NOT pushed:** the 2026-09-22 intensive session commits phase by
  phase on top of `origin/main` (`feaf1b8`); its rows are at the bottom of the log.
  The user reviews and pushes.
- **Health:** 126/126 server tests · client build clean · `npm run lint` 0 problems ·
  core reader flows pass in Chrome 153, Firefox 155 and WebKit 26.6 (desktop and
  phone) · Lighthouse mobile Perf 98–100 on `/`, `/dashboard`, `/library`.
- **Shipped and user-tested:** Stages 0–8d, 6e, the 8b/8c fix rounds, the reader
  polish rounds, and the recitation-stalling fix.
- **Settled decisions — don’t re-litigate:** the page fits the window by default
  (Option D measured and rejected, 2026-09-08) · shortcuts match `e.code` OR `e.key`
  · أيسر التفاسير reads per-ayah via hefzmoyaser, while at-Tabari and Ibn Kathir stay
  on spa5k (hefzmoyaser truncates / abridges them) · a two-page spread shares ONE
  undo stack · focus mode removed · the range band paints only for a live drag or
  an explicit span selection, never while merely reading.
- **Accepted limitations still standing:** a same-calendar-day undo of a half-page
  day-2 completion can discard day-1’s segment · a verse straddling two pages
  annotates on its selection page only.

### Open queue — priority order

- [x] **1 · Stage 8e — mushaf zoom**, including the live Ctrl+wheel hijack in `useIdleHide` — done 2026-09-22 (`a5e840a` `d443f84` `9051c9e`)
- [x] **2 · Audio fallback source** — done 2026-09-22 (`6dde9a3` `7bcfc41`; everyayah, byte-identical) — cdn.islamic.network has files it cannot serve
  (global ayahs 5944 / 5953 / 5954 stayed 502 across 10 attempts)
- [x] **3 · Stage 8.5 — product-aware chatbot**, including a segment-aware `buildProgressSummary` — done 2026-09-22 (`8fd625e` … `fc31d78`; also fixed the retired Groq model)
- [x] **4 · Stage 1.9 — public Library** (browse without an account) — done 2026-09-22 (`cb87b08` … `b21b840`)
- [x] **5 · Stage 9 — UX polish** (refreshed against the app on 2026-09-22) — done 2026-09-23 (`640db96` … `95ff14f`)
- [x] **6 · Lint cleanup** — `npm run lint` exits non-zero at HEAD — done 2026-09-23 (`ce6d295` … `c3690ac`; lint 0 problems)
- [x] **7 · Cross-browser smoke** — Firefox / WebKit (NFR-02) — done 2026-09-23 (`46179e7` `01acfbc`; fixed a Firefox page-scaling bug + WebKit dark selects)
- [ ] **8 · Stage 1.8 — Library mobile redesign** — waits on the user’s UX notes
  (seen on the way: at 390px the sidebar's edge tabs overlap its page-number buttons)
- **Found by the 2026-09-22/23 session — not yet prioritized (user to order):**
  colour contrast of the small grey labels (`#707974` / `#40916C` on light
  backgrounds) and one out-of-order `h4` on the dashboard keep Lighthouse A11y at
  92–96 · a check on REAL Safari (macOS/iOS) and Firefox for Android — Playwright's
  Windows WebKit and touch-emulated desktop Firefox are close, not identical ·
  `og:url` / `og:image` hardcode the Vercel origin
- **User-owned, no code:** email provider for password reset · Sentry DSNs · Atlas backups

Items 1–7 are one prepared prompt — see **Intensive session — 2026-09-22** in Part 3.

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
| 2026-07-08 | **Review checkpoint** | — | Consolidated 13-point checklist delivered (planning chat) covering 2b/3/4/5/6. On acceptance: push ALL local commits (Stage 3 → 6b); no prod reseed needed (data files unchanged). Stage 7 (interactive Progress + projected-completion card, segments-aware rewrite) gets its prompt only after acceptance |
| 2026-07-09 | Stage 5 — committed locally | `f20a0fa` `22d2b2b` | Backend (segments engine/endpoint/stats/half-page, interleaved hunks → one server commit) + client. NOT pushed |
| 2026-07-09 | Stage 6 — annotations | (uncommitted) | Implemented: Annotation model/routes/controller (per-kind validation, verseKey validated against real structure, 2000 cap), popover swatches/note/hard, page-hard flag beside the 3-state tick, hard list + dashboard chip, layout-neutral word-tint rendering. 88/88 tests (+24). Accepted limitations: whole-verse highlights only in UI (wordFrom/wordTo supported underneath), straddling verses annotate on their selection page only, small medallion indicators |
| 2026-07-09 | Stage 6b — free ink + annotation navigation | (uncommitted) | Implemented (MushafDrawLayer SVG overlay in the fixed 524×800 space, PUT /annotations/drawing w/ strict stroke validator, annotate-mode input isolation, /annotations/summary + navigator sidebar + arrival pulse; 98/98 tests). **Crash found on user's first load: `<FiEdit2 />` used at Library.jsx:1317 but never imported → mount ReferenceError → error boundary. Fixed directly by the planning session (import added). Root cause of the blind spot: no eslint-plugin-react → core no-undef ignores JSX identifiers; follow-up dispatched to add react/jsx-no-undef. Also: the 6b "browser checklist" was evidently not executed against a running app — mount itself crashed** |
| 2026-07-09 | Lint-gap + browser-verify round | (uncommitted) | eslint-plugin-react added with react/jsx-no-undef only (proven: fails on the removed import, 0 new noise). Full 6b click-through on an ISOLATED stack (in-memory Mongo :5099 + Vite :5174, CDP real pointer input, screenshots; Atlas untouched) — 20/20 checks: draw/erase/undo/persist/pixel-perfect scaling/navigator/pulse. Found + fixed a real setState-during-render bug in MushafDrawLayer (stroke commit moved out of the setLive updater into the event handler). This isolated-stack CDP approach is the new verification bar. Minor carry-item: word-tap isolation in draw mode confirmed only indirectly — fold an explicit assertion into 6c's verification |
| 2026-07-09 | Stage 6c — draw UX + audio merge | (uncommitted) | Implemented + browser-verified on the isolated stack (25/25 feature + 6/6 regression checks, 0 console errors): undo/redo stacks + keys, Shift straight-line w/ angle snap, eye visibility toggle, draggable/collapsible toolbar, 'text' annotation kind (Arabic verified; eraser-safe), margin-extended overlay (x ∈ [-52,576]) + widened validators, audio-bar→popover merge with near-selection placement. 104/104 server tests. Cosmetic gap: navigator list lacks a text-kind icon. **REVIEW CHECKPOINT ACTIVE: 19-point consolidated checklist delivered; on acceptance commit 6/6b/6c and push Stage 3 → 6c; no reseed needed** |
| 2026-07-10 | Stage 6e — tafsir expansion | — | Planned with ready prompt (below): add أيسر التفاسير + other worthwhile editions + إعراب الآيات, with mandatory verify-200-first discovery against spa5k CDN / quran.com resources / alquran.cloud; honest rejection if no reliable i'rab source exists |
| 2026-07-10 | Review fixes round 1 (Stage 6d) | — | User's review findings dispatched: half-page "want more" ignores new memorization; half-memorized pages render fully green on the detailed map AND the walker skips the remaining half after a 0.5→1 plan switch (partial pages must count as pending); drag-to-multi-select pulled forward from Stage 9; audio-bar hiding REVERTED (bar + popover coexist); new audio features (speed, verse/range repeat, continuous cross-page playback); tafsir play button must toggle pause; selected/playing tints lightened; pause clears the playing tint but resume continues from position |
| 2026-07-13 | Review fixes round 1 (6d) — done | (uncommitted) | Root cause confirmed: memorizedSet treated any-progress pages as done → replaced with segment-aware nextNewItems (partial pages serve their remainder FIRST; want-more offers the next half). Plan-switch day = "remainder only" (documented choice). Partial pages render amber-fractional on the detailed map; drag-select via useDragSelect; audio round (bar visible + popover, speed, verse/range repeat, seamless cross-page playback w/ preload, tafsir play-toggle); tints lightened, pause clears playing tint + resume from position. 106/106 tests, 13/13 isolated-browser checks. Scoped: buildProgressSummary (chatbot) still whole-page |
| 2026-07-13 | Review fixes round 2 — UPDATED prompt | — | Supersedes the earlier round-2 prompt; now ALSO includes: the page-top surah-start bug (plate + basmala belong on the previous page's trailing blanks — An-Nisa p76/77; general fix + all-114 sweep), dashboard rule change (multi-surah task pages show PAGE NUMBER ONLY — no names/ranges; half labels stay), selected-verse indicator becomes non-fill (outline/ring, not a tint), plus the original three (anchored pencil dropdown, icon-only text notes, language-aware motivational verse) |
| 2026-07-28 | **Stage 7 — interactive Progress page** | (uncommitted) | Implemented by the PLANNING session directly (user asked to "just start implementing, I'll review later"). In-place edit mode on `Progress.jsx`: an "Edit progress" toggle in the Memorization Map header opens a draft; detailed map toggles single pages, compact map toggles a whole Juz, surah cards toggle their page span; draft `Set` + Save/Cancel + "{{count}} changed" hint bar + pending-change rings + `aria-pressed`; Save calls `updateMemorized` then reloads. **Segments-aware fix** (the doc's original Stage-7 prompt predated segments): `updateMemorized` now sets `segments: []` only in `$setOnInsert`, so a ½-memorized page that stays in the set is NEVER silently flattened to a full page on save — also fixes the Settings "edit my pages" editor; +1 server test (**107/107**). New **Projected completion** card from `GET /api/progress/estimate` (time-to-finish + projected Gregorian date via `ar-u-ca-gregory-nu-arab`, reuses `formatEstimate`/`onboarding.time*`). Settings "Edit my pages" kept as a secondary link. EN/AR locales added. Verified: 107/107 server tests (in-memory Mongo, Atlas untouched), client build clean, lint clean of NEW issues (the 3 react-refresh context errors + the `chartData` hooks-dep warning are pre-existing, in files not touched here). ⚠ **NOT browser-verified on the isolated CDP stack yet** — user will review. Files: `progressController.js` (updateMemorized), `progress.test.js` (+1), `Progress.jsx`, `en/ar.json`. Held UNCOMMITTED atop the in-flight Stage 6 tree (no collision — Stage 7 lives in Progress.jsx / progressController, not the in-flight Library.jsx); nothing committed or pushed. |
| 2026-07-28 | **Stage 8 — leaderboard (opt-in)** | (uncommitted) | Implemented by the PLANNING session directly. Backend: `User` gains `leaderboardOptIn` + `displayName` (3–30 chars — the ONLY public identity, never email/real name); `updateProfile` validates both and requires a name to opt in; all three auth payloads (login/getMe/updateProfile) return them; `UserProgress` gains a `{ memorizedDate: 1 }` index. New `GET /api/leaderboard?period=week|all` (protected, type-gated): opted-in users only, **segment-aware fractional page counts**, week = last 7 UTC days, sorted by pages desc (streak tie-break), returns top 50 + the caller's own rank when outside it, behind a 5-minute in-memory per-period cache (single-instance; Redis noted for scale). New `leaderboardController` (+`_clearCache` test hook) and `leaderboardRoutes` mounted in `app.js`. **+9 tests** (opt-in filtering, ranking, week vs all-time, fractional counting, own-rank-outside-top-50 via 51 users, opt-in-requires-name, short-name reject) → **116/116**. Frontend: lazy `/leaderboard` route + Navbar link (FiAward); new `Leaderboard.jsx` (This Week / All Time tabs, medals for the top 3, own-row highlight, a "your rank" card when outside the visible top, a join/opt-in card, loading/error/empty states); a Settings **Community** card (`CommunityCard`, self-contained opt-in toggle + display-name save, mirrors `ChangePasswordCard`); EN/AR locales (`nav.leaderboard`, `leaderboard.*`, `settings.community.*`). Verified: **116/116** server tests (in-memory Mongo, Atlas untouched), client lint clean on all changed files, build clean (Leaderboard chunk ~6.4 KB, lazy). ⚠ **NOT browser-verified yet** — awaiting user testing. No collision with the in-flight Library.jsx (all new files + Settings/Navbar/App/api). Held UNCOMMITTED; nothing pushed. Files: `User.js`, `UserProgress.js`, `authController.js`, `authRoutes.js`, `app.js`, `leaderboardController.js` (new), `leaderboardRoutes.js` (new), `leaderboard.test.js` (new), `api.js`, `App.jsx`, `Navbar.jsx`, `Leaderboard.jsx` (new), `Settings.jsx`, `en/ar.json`. |
| 2026-07-28 | **Stage 8b — user fix round** | — | Four user-reported items dispatched as a fresh-session prompt (below), bundled with Stage 6e. Root causes confirmed in code by the planning session: (1) **leaderboard staleness** — the 5-min board cache is invalidated ONLY on leaderboard-settings changes, never on progress writes, so pages/rank lag up to 5 minutes (my Stage 8 bug); (2) **range repeat is page-bound** — `rangeStart`/`rangeEnd` are indices into `verses`, which only ever holds the visible page(s), so a range can't span pages; needs global verse addressing + cross-page fetch; (3) **inter-verse gap** — one `<audio>` whose `src` is reassigned per verse (Library.jsx ~558-568) pays a fetch+decode per verse; the existing preload covers page data + font only, not audio → needs double-buffered audio elements; (4) **landing page** — `lastMushafPage` is only a fallback behind "first unmemorized page"; user wants last-opened to win, which **reverses the Stage 1.7c decision** (explicit `?page` still wins). ⚠ Item 2's "end verse: the end of the current verse" read as a typo → default chosen: **end of the current page** (flagged in the prompt for user confirmation). |
| 2026-08-04 | **Stage 8c — tafsir UX + annotation ergonomics** | — | Five user-reported items dispatched as a fresh-session prompt (below). Grounded in code by the planning session: (1) the panel prev/next buttons move `tafsirIndex` only and never touch `selectedVerseKey`, and selecting a verse while the panel is open never moves `tafsirIndex` → needs TWO-WAY sync; (2) the draw toolbar renders whenever `drawPage != null` (a dropdown anchored under the pencil) so it cannot be collapsed while drawing, and there are no tool shortcuts; (3) the panel opens ONLY via `openTafsir(index)` from the verse popover → add a persistent VS-Code-style toggle on the panel side, keeping the popover path; (4) **grouped tafsir** — classical editions (esp. أيسر التفاسير) comment on a PASSAGE, and the spa5k CDN returns that same block for every ayah in the run, so this is very likely SOURCE DATA, not a fetch bug (note `fetchPageTafsir` already selects per-ayah for page-source editions); the prompt requires verifying by diffing adjacent ayahs before any rewiring, and evaluating hefzmoyaser.net/hafs **with CORS as the gating question**; (5) the panel is `fixed … z-50 md:end-0 md:w-[420px]` so it OVERLAYS the mushaf → make it reflow side-by-side (the uniform-scale frame invariant means a narrower column just scales the page down) and auto-collapse the sidebar, reusing the existing `focused`-mode precedent. Deliberately NOT bundled with another stage: all five interlock in Library.jsx, and 8.5/9 touch different files. |
| 2026-09-02 | **Stage 8d — per-ayah tafsir + reader interaction** | — | Six user-reported items dispatched as a fresh-session prompt. **RESEARCH DONE BY THE PLANNING SESSION (not a hypothesis — measured with curl):** (a) the grouped-tafsir bug from 8c item 4 is **CONFIRMED source data** — spa5k `abu-bakr-jabir-al-jazairi` returns BYTE-IDENTICAL text (md5 `cc6deed4`, 2636 chars) for 36:41–36:46, while 36:40 and 36:47 differ, exactly matching the report; (b) **api.quran.com `/api/v4/tafsirs/{id}/by_ayah/{verse_key}` is genuinely PER-AYAH** — 6/6 distinct texts for 36:41–46 on ibnkathir(14), tabari(15), muyassar(16), qurtubi(90), saadi(91), wasit(93), baghawi(94); (c) it sends **`access-control-allow-origin: *`** so the browser can call it directly with NO proxy; (d) its text carries HTML markup (e.g. `<span class="blue">`) unlike the current plain-text sources, so rendering must handle/sanitise it; (e) **أيسر التفاسير is NOT on quran.com** and the book itself is passage-structured, so it can never be made per-ayah — keep it on spa5k and label the covered range. ⚠ **CONFLICT FLAGGED:** 8c item 1 made `selectedVerseKey` the single source of truth for the panel, but 8d item 3 needs the tafsir to SURVIVE deselection (`enterDraw` calls `setSelectedVerseKey(null)`); resolution specced = the panel keeps its own verse key that FOLLOWS selection but never clears with it. Item 4 is architectural: `drawPage` is a single page by design ("Only one page is annotated at a time") and must become per-page stroke buffers for a spread. |
| 2026-09-02 | **Stage 8c — DONE, browser-verified** | (uncommitted) | All five items implemented and verified on the isolated CDP stack (:5099 in-memory Mongo, :5199 Vite, CDP :9333, real pointer input, 30 screenshots, 118/118 server tests, clean lint/build, zero console errors). Item 1: `tafsirIndex` deleted — `selectedVerseKey` is the single source of truth, one `stepSelection(dir)` helper backs both popover and panel, crossing pages via `pendingSelectRef`. Item 2: `drawMenuOpen` split from `drawPage`; P/H/T/E shortcuts; capture-phase outside-collapse that still draws. Item 3: `tafsir-toggle` pill at `top-24 end-6`. Item 4: run-detection banner. Item 5: panel docked in-flow at lg (340/400px), `showSidebar = !focused && !(tafsirOpen && isWide)`. **Grouping CONFIRMED byte-identically** (Aysar 36:41–46, sha 6727a660ac, 2653 chars). Per-edition audit: السعدي + الإعراب + الميسّر + الجلالين are per-ayah; أيسر/البغوي/القرطبي/الطبري/ابن كثير are grouped. **Later turns (user-requested):** the pencil became a plain annotate on/off (verified a post-off drag adds no stroke); then a collapsible verse popover (folds to a pill, keeps the selection) and the selection following the recitation. ⚠ Session-flagged trade-offs awaiting the user: the docked panel makes the sidebar controls unreachable until it is closed; the popover prev/next now cross pages (a behaviour change); docking is at lg not md. |
| 2026-09-02 | **أيسر التفاسير — per-ayah source FOUND** | — | The user asked to keep hunting for an API that returns a single verse; the 8c session already found and verified one. `newapi.hefzmoyaser.net/api/tafsir/show?chapter=&verse=&book_id=11&riwaya=1` returns **genuinely per-ayah أيسر التفاسير** — 8/8 distinct across 36:40–47 and 6/6 across 18:60–65; its 36:41 entry is **725 chars covering only 36:41** vs spa5k’s 2653-char 41–46 block. **CORS passes**: `access-control-allow-origin: *` on both GET and the OPTIONS preflight. Carries 18 books incl. المختصر/الوسيط/أضواء البيان. Gotchas: `riwaya` must be integer `1`; without `Accept: application/json` Laravel 302s to HTML instead of 422; rate limit 180; text contains `<br />` only → convert to newlines, never `dangerouslySetInnerHTML`. NOT wired — awaiting the user’s go-ahead, since it changes which text a reader sees for a specific religious book and adds a third-party runtime dependency. Recommended shape: switch أيسر to it with automatic fallback to the spa5k copy, keep the range banner for editions it does not carry. |
| 2026-09-02 | **User decisions + 8c feedback round 2** | — | **Decided:** (1) hefzmoyaser per-ayah source APPROVED for wiring — and the audit must cover EVERY edition, not just أيسر, switching any grouped edition it carries per-ayah; (2) 8d item 4 undo/redo across a spread = **UNIFIED stack** (one timeline, Ctrl+Z undoes the genuinely last stroke); (3) popover prev/next crossing pages = keep (recommended); (4) panel docks at lg not md = keep (recommended). **New feedback on the uncommitted 8c work:** (a) the pencil goes BACK to a THREE-state cycle — menu+annotating → menu collapsed but STILL annotating → off (this reverses the plain on/off turn, at the user’s request); (b) the verse popover should HIDE COMPLETELY rather than fold to a pill, keeping the verse selected; (c) tool shortcuts must work while annotate mode is OFF (pressing P enables annotating AND selects pen); (d) restyle the tafsir toggle to match the exit-focus pill, and turn the exit-focus slot into a PERSISTENT VS-Code-style SIDEBAR toggle — opening the tafsir hides the sidebar by default, but the user can re-show it and have BOTH docked; (e) reclaim vertical space for a bigger mushaf, starting with the page header (“مكتبة القرآن” + subtitle). Planning note: the page is a 576×852 portrait frame scaled uniformly, so for the SINGLE-page view HEIGHT is usually the binding constraint (navbar pt-28, header, audio bar) while WIDTH binds the two-page spread once the panel docks — measure before optimising. |
| 2026-09-02 | **Keyboard shortcuts must be LAYOUT-INDEPENDENT** | — | User-reported: shortcuts must work on ANY keyboard language, not just English. Confirmed in code — every letter shortcut binds to `e.key`, which carries the LAYOUT-PRODUCED CHARACTER, so on an Arabic (or Russian/Hebrew/Greek) layout the physical P key emits `ح` and the shortcut silently dies. Affected: **P/H/T/E** tool select (Library.jsx ~978, `DRAW_TOOL_KEYS[e.key.toLowerCase()]`), **Ctrl+Z / Ctrl+Shift+Z / Ctrl+Alt+Z** undo and **Ctrl+Y** redo (~971-974), and **F** focus-mode (~997). NOT affected: Escape, ArrowLeft/Right, PageUp/PageDown — those `e.key` values are layout-independent already. **Fix:** match on `e.code` (physical position: `KeyP`/`KeyH`/`KeyT`/`KeyE`/`KeyZ`/`KeyY`/`KeyF`) OR `e.key`, accepting EITHER — `e.code` rescues non-Latin layouts, while keeping `e.key` preserves the printed letter for AZERTY/Dvorak users and covers IMEs/virtual keyboards where `e.code` is empty. Applies to any shortcut added later (8d nested-repeat etc.), so it belongs in CODE_GUIDE as a standing convention. |
| 2026-09-02 | **BUG: Hizb / ¼-Hizb selection over-covers its neighbours** | — | User-reported and **root-caused with the data**: selecting quarter 32.2 turns 32.2 green but 32.1 and 32.3 yellow; hizb 27 covers ~10% of hizb 28. `HIZB_RANGES`/`RUB_RANGES` in `client/src/data/hizbRanges.js` are PAGE ranges, and `toggleHizb`/`toggleRub` (Settings.jsx ~141-142) call `toggleRange(start,end)`, adding WHOLE pages to `selectedPages`, saved via the whole-page `updateMemorized`. Boundary pages are SHARED between adjacent units — rub 125 (32.1)=312-315, rub 126 (32.2)=315-317, rub 127 (32.3)=317-319, so 32.2 claims all of 315 and 317 and bleeds into both neighbours; hizb 27=262-272 and hizb 28=272-281 share page 272. The file header already documents this rounding as a deliberate Stage 5 shortcut — **now rejected by the user**. Fix: the Hizb and ¼-Hizb tabs (in BOTH Settings and Onboarding) must compile to a VERSE range and go through the existing verse-exact `PUT /api/progress/units` (`unit: 'hizb' | 'rub'`) instead of folding into the whole-page set; tile selected-state must then be judged on verse coverage, not `countIn(...) === pageCount`. Juz/Surah/Range tabs are unaffected (they are genuinely page-aligned). |
| 2026-09-02 | **BUG: unrounded fractional page total on the dashboard** | — | Shows `75.57142857142857 / 604`. `Dashboard.jsx:517` interpolates `stats.totalMemorized` raw; it became a FLOAT when segments landed in Stage 5. Fix: round to one decimal (Progress.jsx already has the `round1` helper — `Math.round(n*10)/10`, which also drops a trailing `.0` so whole numbers stay clean). Only occurrence found in the client; the percentage is already `toFixed(1)` server-side. |
| 2026-09-02 | **8c feedback round — DELIVERED, browser-verified** | (uncommitted) | All 8 items done on the isolated CDP stack. Planning session INDEPENDENTLY VERIFIED: **120/120** server tests (re-ran), focus mode genuinely removed from the JSX, `formatNumber.js`/`shortcutKeys.js`/`unitRanges.js` present. Pencil 3-state cycle (session found + fixed its own inverted-cycle bug: the click-outside handler collapsed the menu on pointerdown before `toggleDraw` ran); popover now fully hides with the verse still selected (fixed its own bug where re-tapping deselected instead of restoring); tool keys arm annotate mode from cold; sidebar + tafsir share one mirrored `READER_CHIP`, auto-hide is a DEFAULT the user can override (both dock together); shortcuts layout-independent via `isShortcutKey(e, letter)` matching `e.code` OR `e.key`, proven by dispatching `key:'ح' code:'KeyP'` and `Ctrl+key:'ئ' code:'KeyZ'` — convention added to CODE_GUIDE; Hizb/¼-Hizb now verse-exact (editor model became verse ranges with `selectedPages` derived; server returns `segments` on `partialPages` so the editor seeds exactly and does not round existing progress back up) — 32.2 leaves 32.1/32.3 untouched, +2 tests; fractional totals rounded via a shared `round1` (badge thresholds and chart points left RAW on purpose so rounding cannot wrongly award a badge — good call). **Mushaf sizing measured, not assumed:** 548px fixed → 728px at 1300px tall (+33% width / +73% area), but **476px at 1440×900 — SMALLER than before** because the old fixed `max-w-[700px]` overflowed the fold (bottom 938 > 900). Fixed-frame invariant proven: ink fx/fy/fw identical to 3 decimals across every size, locale and theme. **hefzmoyaser audit over 39 ayahs:** أيسر switched (36:41 now 678 chars for that ayah alone vs the old 2653-char 41–46 block); **at-Tabari REFUSED — truncates at exactly 32767 chars (2¹⁵−1) mid-word**; **Ibn Kathir REFUSED — a different abridged recension (~60% length)**. Planning session ENDORSES both refusals: serving truncated or silently-substituted tafsir is worse than serving grouped tafsir. ⚠ **Flagged for the user:** (a) **focus mode was DELETED** — not requested; defensible since the header is now hidden for everyone and the sidebar is toggleable, so focus mode collapsed into the S toggle, but it is a user-facing feature removal; (b) the mushaf is SMALLER on a 1440×900 laptop, which is the opposite of the stated goal on the most common screen height; (c) orphaned `library.focus.*` keys remain in both locale files. |
| 2026-09-02 | **Reader polish rounds — 15 local commits, NOT pushed** | 15 commits | Planning session verified independently: **120/120** tests, clean build, lint at the same 5 pre-existing problems, clean tree. Delivered: verse highlight as one continuous band per line (per-word ring gone; hover lightened to 0.055 alpha vs selected 0.19); Hizb/¼-Hizb verse-exact; rounded page totals; layout-independent shortcuts; أيسر per-ayah via hefzmoyaser; navbar idle-hide + **scroll-capture** (first ~60px of wheel spent hiding/showing the bar); panels docked flush to the window edges with handles riding each panel’s inner edge; tafsir panel resizable 300–720px, persisted; sidebar regrouped (pager → Juz/Surah side-by-side → bookmarks | divider | steps → self-test → mark-verses → annotations → hard); only EMPTY space deselects a verse (panels/controls keep it, via a `KEEPS_VERSE_SELECTION` selector list); popover pushed 34px below / 54px above the cursor; tafsir typography fixed (real paragraphs, leading 2 → 1.75, justified; الطبري 5344 → 3716px) after finding a converter bug where `<br />
| 2026-09-08 | **A3 resolved — Option D REJECTED on evidence; stay on A** | 19 local commits | The session measured Option D (size the mushaf for the navbar-hidden viewport, navbar overlays the top margin) and found TWO independent failures, so it did NOT implement it: (1) below ~720px viewport height the revealed navbar lands ON the first line of glyphs — clearance goes +18 (1300px) → +6 (900px) → 0 (720px) → −1 at 700px, covering 10 glyphs; a 1366×768 laptop sits at ~650–680 of real viewport, inside the failing band; (2) at every size the page card’s own controls become unclickable — the running head lands at y16–40, inside both the navbar band and the 60px reveal zone, so reaching for the pencil summons the bar that covers it (proved via elementsFromPoint → A/NAV/DIV and a dead click). Gain would have been only +55px at 1440×900 and +41px at 1920×1300 (the 920px box cap binds). A safe `pt-48` variant exists worth **+22px** if ever wanted. **Decision: stay on A (page fits the window).** Also landed: reading column re-capped at `max-w-[1620px]` (panels stay full-bleed; verified no h-scroll at 2560px, LTR + RTL); the tour now genuinely holds the navbar open (the flag lived only in a ref, so the bar faded out mid-walkthrough — mirrored into state); scroll-capture documented as deliberately wheel-only (touch never hides the bar at all via the `hover: hover` gate, so there is no gesture to spend; hybrids keep the idle timer and top-zone tap; trackpad momentum measured 1:1 with no stall). 120/120, clean build, lint unchanged. |
| 2026-09-08 | **Stage 8d remainder — queued for a NEW session** | — | Planning session verified what is actually left of 8d: items 1 (empty state), 2 (per-ayah tafsir) and 4 (both-page annotation) are DONE. Still open: **item 3** tafsir must survive deselection — `tafsirVerse = tafsirOpen ? selectedVerse : null` (Library.jsx ~1886) and `enterDraw` still calls `setSelectedVerseKey(null)` (~1494), so starting to annotate empties the panel; **item 5** drag-select a verse range on the mushaf (no drag-select exists in Library.jsx); **item 6** nested repeat — `repeatMode` is still `off|verse|range`, mutually exclusive, so per-verse and whole-range counts cannot run together. Note the range plumbing is already GLOBAL (`rangeStartOrd`/`rangeEndOrd` + `ordOfKey`) from 8b, so item 5 should produce ordinals and item 6 build on the existing counters. ⚠ 19 commits still unpushed — a single-machine risk. |
| 2026-09-09 | **Stage 8d COMPLETE — items 3, 5, 6 delivered** | `1f64318` `9441f2b` `ab8061f` | Planning session verified independently: **120/120** tests, clean build, only the 5 known lint problems, harness cleaned up, tree clean. **Item 3:** new `tafsirVerseKey`; panel renders `panelVerseKey = tafsirOpen ? (selectedVerseKey ?? tafsirVerseKey) : null` — derived during render so no empty frame flashes; `lastTafsirVerseRef` keeps the verse object when its page unmounts; `toggleTafsir` now opens on the empty state instead of doing nothing. **Item 5:** drag-select via `rangeDragDown`/`armEdgeTurn`/`endRangeDrag` + window pointermove/up/cancel and a non-passive touchmove guard; edge-dwell turn (550ms first, 900ms repeat) EXTENDS rather than restarts; conflicts explicitly tested — plain tap still selects, drag while annotating draws (0 range), drag in self-test advances the watermark (0 range); touch needs a 650ms hold first so quick swipes still turn pages. **Item 6:** `rangeVerseRepeat` nests inside `rangeRepeat`; progress readout stepped all 8 states in exact order then stopped with counters cleared; **gapless handover measured — 0–1ms at a verse repeat, 52ms at a verse change AND at the range wrap, i.e. the wrap costs nothing beyond a normal advance**. Fixed-frame invariant re-proved: band bbox as a fraction of the page identical at canvas widths 298/317/379/625 (left .0553 · right .9494 · top .4006 · bottom .6014, aspect 0.655). **Planning session rulings on the six flagged decisions: APPROVED 1 (×1 in RANGE_VERSE_COUNTS — without it a range cannot be played straight through), 2 (separate `rangeVerseRepeat` defaulting to 1), 3 (reuse the repeat popover rather than a bespoke bubble), 5 (edge-turn dwell timings), 6 (toggleTafsir opening the empty state — a button that did nothing was a bug). REVISE 4** — tinting the mushaf unprompted whenever repeat mode is Range is the one to reconsider: this is sacred text and a persistent tint while merely reading is noise; show the band while the repeat popover is open or during playback of that range, then fade. ⚠ Known gap: verified in headless Chrome only — **NFR-02 requires Firefox, Safari and Edge too**, and this round added non-passive touchmove and pointer-capture handling, which is exactly where engines differ. 23 commits still unpushed (single-machine risk). |
| 2026-09-09 | **Stage 8e — mushaf zoom (queued)** | — | User request: Ctrl+wheel/pinch with the pointer OVER the mushaf zooms the MUSHAF (scrolling allowed); with the pointer outside it, the browser zooms the whole site as normal. Plus a zoom affordance. Motivation: the mushaf reads small on small screens. Planning-session grounding: (a) sizing today is `--mushaf-chrome` → `--mushaf-avail-h` → the `.mushaf-page-cap` / `.mushaf-spread-cap` **max-width** caps (index.css ~137-147, capped 920px single / 1560px spread), so **zoom must be a multiplier on that same cap** (a `--mushaf-zoom` factor) and NOT a `transform: scale()` wrapper — going through the cap keeps layout real so word taps, drawing and drag-select hit-test natively, and keeps the fixed 524×800 overlay invariant true for free; (b) **LIVE BUG FOUND: `useIdleHide`’s wheel handler never checks `e.ctrlKey` (useIdleHide.js ~81-95) and preventDefaults every downward wheel, so Ctrl+wheel browser zoom is ALREADY hijacked inside the Library reader** — it hides the navbar instead of zooming; must be fixed regardless of this feature; (c) `.mushaf-viewport` has no overflow rule, so a zoomed page needs a real scroll/pan container; (d) this does NOT contradict the 2026-09-08 decision A (page fits the window) — fit stays the DEFAULT and zoom is the deliberate opt-in escape from it; (e) recommend NOT intercepting native touch pinch (fragile, and native browser pinch already works) — give explicit +/− controls on touch instead, and leave keyboard Ctrl +/−/0 as browser-level so accessibility zoom is never trapped. |
| 2026-09-12 | **Recitation stalling — root-caused and fixed** | `2bffb25` `e9921a3` | The reader's recitation stopped partway through a page and never resumed, while the bar kept showing the pause button and the verse counter — no error, no spinner, just silence. **Three compounding defects, all in `Library.jsx`:** (1) the preloader recorded which verse an element had been TOLD to load, never whether the load succeeded — intent, not arrival; (2) `handleAudioError` returned early unless the failing element was the ACTIVE one, so the PREFETCH — by definition always the cold request, since the playing verse was fetched a verse ago and its edge is warm — was the one request never retried; (3) the handover swapped into that dead element on the strength of the recorded intent, and `el.play().catch(() => {})` threw the rejection away. **Fixed:** per-buffer `{ord, status}` (`loading` → `ready` on canplay/loadeddata/canplaythrough, `failed` on error); a swap is allowed ONLY into a `ready` buffer, otherwise the ACTIVE element takes the verse over with the retry behind it (a late start, not silence); BOTH elements now report failures and are retried, the active one owning the spinner/error line and the prefetch failing silently; split budgets (6 active / 3 prefetch); `play()` rejections routed by name (AbortError ignored, NotAllowedError drops out of playing, anything else retried); a 2.5s stall watchdog for requests that hang without ever firing `error`; and a blind no-cors fetch warming the edge 3 verses ahead. **Verified on an isolated stack** (in-memory Mongo + server on 5321 + Vite on 5322) driven over CDP with real pointer input, forcing failures with `Fetch.fulfillRequest` rather than waiting for them — **30/30 checks across 6 scenarios**. Before/after on the identical forced 502: BEFORE 3/8 with a **14.9s terminal silence**, one request never repeated, bar still saying "Pause"; AFTER 8/8, retry fired 6.6s BEFORE verse N ended (so it is genuinely the prefetch path). Live 7-8 min continuous runs, no injection: BEFORE 2 verses then **465s of SILENT stall**; AFTER 0 silent stalls, the one silence correctly reported as an error. Same-region pair: before skipped a verse entirely (`ended 5952` → `loadstart 5954`) and sat silent 264s; after played it and ended honestly errored. **Gapless unchanged:** verse repeat re-issues `play()` at +0.1ms, verse change at +57ms — identical to three figures before and after (the ~53ms to audible is Chrome's pipeline resume, not app code). **CDN measurements taken this round** (worth keeping): cdn.islamic.network sends **no `access-control-allow-origin`**; Resource Timing `responseStatus` is **0** for opaque cross-origin entries (200 same-origin), so warm reads cannot see a 502 and must be blind; a cold file needs **2–8 requests** to warm, not 2; repeat touches of a warm file are **disk-cache hits (~1ms, max-age 70 days)**; Chrome **strips `Range` from a no-cors fetch**, so the warm-up is a whole-file GET costing ~1 extra download per ayah (`WARM_AHEAD` is the dial). **Still true and NOT fixable client-side:** some files are unservable right now (5944/5953/5954 stayed 502 over 10 touches) — those correctly end at the visible error within ~16s, and one press of play gives a fresh budget and recovers (verified). 120/120 server tests, clean build, lint at the 5 pre-existing problems. |
| 2026-09-22 | **Everything pushed; carry-over audit** | — | Observed by the planning session: the user had pushed the whole local stack — `origin/main` at `d5b4f79`, tree clean, 0 unpushed — so the long-running "push before the stack grows" item is closed. Audit of what was still carried as open: **8d decision #4 is RESOLVED** in code — the band now paints only for a live drag (`dragRange`) or an explicit span (`rangeSelection`), and the pickers’ defaults deliberately never light up the mushaf (Library.jsx ~1640-1655), so a page is no longer tinted while merely reading; **the Ctrl+wheel hijack is STILL LIVE** — `useIdleHide`’s wheel handler has no `ctrlKey`/`metaKey` check, so browser zoom is swallowed inside the reader; `buildProgressSummary` (progressController.js ~261) still walks whole pages while `getTodayTasks` is segment-aware, so the chatbot can name a different next page than the dashboard; the Axios 401 interceptor hard-redirects to `/login` and clears the token, which makes any ungated request a trap for the public Library. **Stage 9 audit:** keyboard turns, audio across page turns and tile drag-select are DONE; scroll-to-top on route change is missing; `client/index.html` has one relevant meta tag and no OpenGraph; focus-visible and screen-reader labels are partial; manual page turns don’t prefetch (only playback does). |
| 2026-09-22 | **Log restructured; intensive session prepared** | — | At the user’s request this file now reads as a strict history: the Progress-log rows were stable-sorted by date (7 rows had been out of order, in the 2026-07-08…13 stretch), new entries are appended at the bottom, and the stale "pushed through 8b / 8c queued" callout was replaced by a live **Current status** and a priority-ordered **Open queue**. Queue items 1–7 — zoom (8e) with the Ctrl+wheel fix, an audio fallback source, the product-aware chatbot (8.5) with a segment-aware summary, the public Library (1.9) with the 401-redirect trap called out, a refreshed UX polish pass (9), a lint cleanup that makes `npm run lint` exit 0 (including a real stale-language bug in the Progress chart memo), and a Firefox/WebKit smoke — were written up as ONE phased prompt (Part 3, *Intensive session — 2026-09-22*). Implementation sessions append their own row after each phase. |
| 2026-09-22 | **Intensive session · Phase 1 — Stage 8e mushaf zoom** | `a5e840a` `d443f84` `9051c9e` | **Ctrl+wheel hijack FIXED first (`a5e840a`):** `useIdleHide` now ignores any wheel event carrying Ctrl/Cmd. Measured on the isolated stack (API :5321 on in-memory Mongo, Vite :5322, headless Chrome :9333 over CDP): BEFORE, 4/4 Ctrl+wheel events inside the reader ended `defaultPrevented` and toggled the navbar; AFTER, 0/4, navbar untouched. Caveat stated plainly: neither headless nor a headful Chrome applies browser zoom to CDP-injected Ctrl+wheel (devicePixelRatio never moved, even on a page with no handler), so an actual browser-zoom step could not be observed through CDP — the proof is that nothing in the page cancels the event any more, which is the only way a page can block it. **Zoom (`d443f84`):** zoom MULTIPLIES the existing cap (`--mushaf-fit-w` × `--mushaf-zoom`, with the card padding and spread gap kept out of the multiplication so 150% means the text is exactly 1.500×) — no transform wrapper, so hit-testing stays native. New `useMushafZoom` hook writes the level straight to the DOM (a pinch never re-renders the reader) with a tiny store for the control; `.mushaf-scroller` becomes a scroll box exactly as tall as the fitted card only when zoomed. Pointer-scoped Ctrl+wheel/pinch (mouse notch = one preset, pinch continuous, 400ms gesture latch), bounds fit…300%, presets 100/125/150/175/200/250/300, persisted in `localStorage.mushafZoom`. Pan = wheel/trackpad/Shift+wheel/scrollbars, native one-finger touch pan (a swipe that panned no longer turns; a swipe against the page edge still does), browser arrow keys after clicking the page, and **hold Space + drag** (captured on the window before anything else, so a pan can never start a range or a stroke). Turn keeps the level and opens the page at its top-RIGHT; the recited/stepped-to verse is kept in view; a range drag held at the box edge auto-scrolls; window/tafsir/sidebar resizes keep the view centre; edge arrows tuck into the page margin when zoomed. Control = a magnifier in the audio bar that opens −/level/+/fit OVER the bar's own controls — measured first: a full −/%/+ group wrapped the bar to two rows (70→114px) at every desktop width and covered the footer tick, so it was rejected; on phones it leads the bar's first row because the chat launcher sits over that row's end. EN/AR strings, RTL-mirrored, dark mode. **Verified — 73/73 checks, 0 console errors, 0 exceptions:** fit is untouched (canvas and audio-bar rects identical to HEAD at 9 sizes from 360px phones to 1440×900 + tafsir + sidebar); Ctrl+wheel over the page zooms it and over the sidebar / column gutter / audio bar / window edge is left to the browser; Ctrl +/−/0 never prevented; zoom-to-cursor anchoring ≤0.5px (the scroll-offset snap) on both axes in a pinch across a spread; overlay invariant — ink bbox AND selected-verse band as canvas fractions identical to 3 dp at 100/150/200/300%; a stroke drawn at 200% (scrolled) lands 0.06px from the pointer, and after a full reload the zoom is restored and the ink is in the same place to 3 dp; small viewport 1366×768: 150% takes glyphs from ~18.2px to 27.3px; phone 390/375/360 touch: tap-zoom, pan without turning, edge swipe turns, a finger stroke lands under the finger; rapid pinch: 0 network requests (no QCF font refetch), 0 long tasks, p95 frame 7.1ms; reduced motion: verse-follow jumps without animation (zoom has no easing at all). Screenshots in the session scratchpad. 120/120 server tests, build clean, lint at the 5 known problems. **Open / for the user:** the chat launcher (fixed, draggable) floats over a zoomed page's bottom corner on desktop, and over the audio bar's first row on phones (pre-existing); the page scrubber sits behind the audio bar at 1440×900 — PRE-EXISTING, identical rects at HEAD; on touch, a zoomed page cannot be finger-panned WHILE annotating (the ink layer owns touch) — pan outside annotate mode; Space tapped over a zoomed page no longer page-scrolls it (it is the hand tool there). |
| 2026-09-22 | **Intensive session · Phase 2 — audio fallback source** | `6dde9a3` `7bcfc41` | **Discovered and verified before wiring.** Today the primary actually served all three previously-stuck ayahs (global 5944/5953/5954 = 86:13, 87:5, 87:6 — 206 for all five reciters), so the 2026-09-12 502s had healed at this edge; the fallback is for the next time. **everyayah.com** covers all five reciters, serves `audio/mpeg` over https with range requests, and an `<audio>` element plays it cross-origin (no CORS needed, same as the primary). **Same recording, proven by bytes:** for 19 ayahs (1:1, 2:255, 16:99, the three stuck ones, 114:6 and 12 random ones) × 5 reciters = **95/95 MPEG audio frames byte-identical** to the primary's — only the ID3 tags differ; cdn.islamic.network is effectively a re-tagged mirror of everyayah. Mapping: `Alafasy_128kbps`, `Husary_128kbps`, `Minshawy_Murattal_128kbps`, `Hudhaify_128kbps`, and **`Muhammad_Ayyoub_64kbps`** — the primary's "128" folder serves Ayyoub's 64 kbps / 22.05 kHz MPEG-2 encode, which matches that folder exactly (everyayah's `_128kbps` Ayyoub is a different encode, so rejected). **quran.com rejected:** only 3 of 5 reciters (no Hudhaify, no Ayyoub), Husary at 64 kbps vs the primary's 128, and an API call per verse to learn a file's address. **Wired minimally:** `RECITERS[].fallback` + `getFallbackAyahAudioUrl(reciter, verseKey)` in quranApi.js (zero-padded SSSAAA); in Library.jsx the per-buffer retry record gains a `fallback` flag, `loadBuf` picks the URL from it, and `failBuf` — where the ACTIVE budget runs out — switches the verse to the second source with its own budget (`AUDIO_RETRIES_FALLBACK = 2`, first ask immediate) before the visible error. The primary stays first for every load, the prefetch never falls back, and pressing play after an error starts on the primary again. Gapless ping-pong, readiness, split budgets, watchdog and warm-up untouched; the primary path's delays are byte-for-byte as before. **Proved with Fetch interception (forced 502s), 11/11:** primary 502 on 86:13 → 7 primary attempts, then 86:13 plays from `E:Alafasy_128kbps/086013.mp3` to its end and 86:14/86:15 carry on from the primary, no error shown; the cost is the primary's budget — **~8.7–9.1s of spinner** before the fallback sounds; Ayyoub → `Muhammad_Ayyoub_64kbps` plays; both sources 502 → "Could not play the recitation" **10.0s** after the verse was due, spinner gone, 3 fallback attempts; then with the primary healed, one press of play loads `P:…/5944.mp3` first and plays. **Gapless unchanged (HEAD vs change, median):** ended→play() 0.2 vs 0.2ms at a verse repeat and 59.4 vs 60.7ms at a verse change; ended→playing 60.4 vs 61.8ms and 200.6 vs 204.9ms — within run-to-run noise. 120/120 server tests, build clean, lint at the 5 known problems. **Open / for the user:** if the primary goes down WHOLESALE, every verse still waits out its ~9s primary budget before the fallback — a "sticky" fallback (stay on the second source for the rest of the session after N consecutive fallbacks) would fix that, but it bends the "primary first for every request" rule, so it is your call. |
| 2026-09-22 | **Intensive session · Phase 3 — Stage 8.5 product-aware chatbot** | `8fd625e` `20ad8f4` `4391c9e` `29dec36` `fc31d78` | **3a — summary fixed at the root:** the day's plan (targets, segment-aware new items, recent + cycle review, continuation page) was lifted verbatim out of `getTodayTasks` into one pure `planToday(user, pages, now)`; both `getTodayTasks` and `buildProgressSummary` call it, and the unused whole-page walker is gone. Measured on the OLD code: with page 5 half-memorized the summary named **page 6** while the dashboard served page 5's remainder; the new tests fail 4/6 on the old controllers and pass 6/6 on the new. The summary now carries each new item's verse range and the review page numbers. **Production bug found and fixed (`20ad8f4`):** Groq no longer serves `llama-3.3-70b-versatile` — every chat returned 404 `model_not_found`, surfaced as "AI service unavailable", so the assistant had silently stopped working. Listed the models this key can use (gpt-oss-120b/20b, qwen3.8-27b, allam-2-7b with a 4k context, speech models) and switched to **`openai/gpt-oss-120b`**, overridable by a new optional `GROQ_MODEL` env var (CLAUDE.md updated). **3b — knowledge base:** `server/chat/appGuide.md` (847 words / 5.3 KB ≈ 1.2–1.4k tokens by the 4-chars-per-token rule; no offline Llama tokenizer to count exactly) covering the pages and their paths, the daily plan, the unified reader (self-test styles, tafsir editions, annotations incl. free ink across a spread, verse selection, drag-select, nested repeat, gapless audio, bookmarks, docked panels, zoom), the leaderboard, editing progress, and step-by-step common tasks — every claim checked against code or locales; read once at boot, sent in the system prompt. **3c** `client/src/utils/chatLinks.js`: markdown links and bare app paths become react-router links ONLY for whitelisted pages + parameters (`/library?page=1..604`, `/settings?tab=profile|memorization|appearance[&edit=1]`, dashboard/progress/leaderboard/about); external URLs, `javascript:`, `//host`, `#hash`, unknown paths or params stay text; `**bold**` renders as `<strong>` (never HTML); bubbles are `dir=auto`. **3d** guardrails in the system prompt (guide for how-to, summary for personal, own knowledge for the Quran, one-line decline otherwise, reply in the user's language, in-app links only, plain text). **3e** four chips in EN/AR: what to do today, how review works, how to repeat a few verses, how to read a verse's tafsir. **3f** `tests/chat.test.js` swaps `groq-sdk` in `require.cache` (no external calls, no test hook in prod code): summary ≡ /today for a half-page plan, a partly memorized page and a second-half day; the prompt carries the whole guide AND the summary; guide < 6,000 chars; 401 without a token. **Verified:** 126/126 server tests (+6), build clean, lint at the 5 known problems; widget on the isolated stack with canned replies via Fetch interception — **9/9** (chips EN/AR, chip sends its text, exactly the two in-app links render and the evil ones stay text, the link opens `/library?page=291` in-app with no reload, Arabic reply RTL, dark mode); **live model (8 calls total, the user's key read from .env, nothing else loaded):** "what should I do today?" named exactly the dashboard's first half of page 5 (2:25–2:27) and page-1 review with working links, in EN and in AR; the tafsir and daily-goal how-tos followed the guide with correct paths; weather politely declined; an external-link request declined with no URL. **Open / for the user:** confirm the model choice (gpt-oss-120b vs the others above); the guide must be kept current as features change — it is the assistant's only source for how-to answers; a small inaccuracy seen live (the Arabic tafsir answer said the commentary shows "under the verse" rather than in the panel) — the model's paraphrase, not the guide. |
| 2026-09-22 | **Intensive session · Phase 4 — Stage 1.9 public Library** | `cb87b08` `ffe19ad` `9e2a0bf` `11a4246` `b21b840` | **4a — the 401 trap closed at BOTH ends.** The interceptor now redirects only when the failed request actually carried a token, and never for the startup `/auth/me` check, so a stale token is dropped quietly instead of throwing a visitor off a public page; the redirect carries `returnTo`. On top of that the Library asks for nothing account-shaped while signed out: `refreshMemorizedPages`, `loadAnnotationsForPages`, `loadHardList` and `loadSummary` return early, the mount effects wait for auth to be KNOWN (`authLoading`), and the P/H/T/E shortcuts no longer start annotate mode. **4b** `/library` moved out of `ProtectedRoute`. **4c** hidden while signed out: the memorized tick, the page hard flag, the pencil, the annotations eye, the popover's highlight/note/hard group, and the sidebar's bookmarks, mark-verses, annotation navigator, hard list and pages-memorized stat — replaced by ONE "Sign in to track your progress" nudge linking to `/login?returnTo=<this page>`; `returnTo` is honoured by the login form AND by `PublicRoute` (so the two cannot race), accepting only in-app paths and never the auth pages. Client-only features untouched: navigation, audio, tafsir, self-test, drag-select, repeat, zoom, the memorization-steps checklist. **4d** the shared navbar gained a signed-out state (logo · language · theme · Log in · Get started, mirroring the landing page); the chatbot stays logged-in only. **4e** "Browse the Mushaf" added to the landing hero. **Verified logged out on the isolated stack — 23/23, 0 console errors:** `/library?page=291` opens with no bounce, and across a full session — page turns, zoom, self-test, right-click verse actions, tafsir (784 chars loaded), recitation playing, pressing P and H — the network shows **ZERO** requests to any protected endpoint (only api.quran.com page fetches); every account control absent (sidebar headings reduced to Page · Jump to Juz · Jump to Surah · Memorization steps · Self-test style) with exactly one nudge; the navbar public with a returnTo login link; Arabic + dark and a 390px phone both clean; a STALE token is dropped and the visitor stays put; nudge → login → back to `/library?page=291` with the account controls now present; the landing link opens the reader on page 1. **Bug found and fixed mid-phase:** the new landing-page resolution called `landOn(1)` for visitors even when the URL named a page, so `?page=291` became `?page=1` — a deep link is now marked resolved at mount. 126/126 server tests, build clean, lint at the 5 known problems. **Open / for the user:** registering from the nudge still goes through onboarding and lands on the dashboard (only sign-in returns to the page); a visitor with no history lands on page 1 (Al-Fatiha) rather than a "start here" pick. |
| 2026-09-23 | **Intensive session · Phase 5 — Stage 9 UX polish** | `640db96` `7ba24bc` `84d80d4` `9d2f44e` `9372b59` `aa54c10` `8d0a1d5` `97d75ea` `95ff14f` `2c5eaf5` | **5a** `ScrollToTop` in the router resets the window on a PATH change only, so a new page opens at its top while Library page turns (`?page=`) keep the reader's scroll. **5b** real `<head>`: description, theme colour, Open Graph + Twitter card with a 1200×630 `og-image.png`, PNG favicon/apple-touch-icon/192/512 icons and `site.webmanifest`; plus a `robots.txt` (the SPA fallback had been answering it with HTML). **5c** one `:where(…):focus-visible` brand ring (emerald in dark), zero specificity, keyboard-only. **5d** the glyph page is exposed to screen readers one VERSE at a time: the first word of each verse is a focusable button labelled "Surah …, ayah …" (Enter/Space selects), glyphs are `aria-hidden`, and a clipped `.mushaf-sr-text` block carries the Uthmani text — outside the 15-row grid, overlay untouched. Lighthouse then found unnamed controls, fixed too: the dashboard's icon-only How-to button and the Library's Juz/Surah/tafsir selects. **5e** dashboard skeleton reshaped to the real two-column layout + a min-height under the task area + floors on the stat cards: under 600 kbps/400 ms the Tip of the Day section moved **63px → 0px**, CLS **0.027 → 0**. **5f** after a page settles, its neighbours (forward first) are fetched in idle time with their fonts pulled into the HTTP cache by the new `warmPageFont` (cache only — a first version that REGISTERED the faces pushed /library TBT 230 → 510ms and was reworked); a prefetched turn lands in 47–89ms with 0 refetches. **5g** Arabic sweep of every page at 1440 and 390px: one hardcoded string ("5 Ayahs" on the landing plan preview) → `landing.features.planAyahs`; the remaining Latin is legitimate (brand, the user's name/email, "English (الإنجليزية)", demo credentials). **5h NFR-01** — CDP cold-cache, 1.6 Mbps/150 ms, prod preview, LCP before → after: landing 1544 → 1608ms, /library signed-out 2436 → 2504ms (transfer 426 → 599 KB: the prefetch), /dashboard 1808 → 1872ms, /library signed-in 1768 → 1840ms — all under 3 s both times. Lighthouse 12 mobile (Perf/A11y/BP/SEO), before → after: `/` 94/94/100/91 → **100/94/100/100**; `/dashboard` 99/84/100/91 → **100/92/100/100** (CLS .024 → 0); `/library` 94/91/100/91 → **98/96/100/100** (TBT 230 → 96ms). Runs on `/` vary by several points run to run. Verified on the isolated stack with real input: 13/13 + 4/4 checks, 0 console errors. 126/126 server tests, build clean, lint at the 5 known problems. **Open:** colour contrast (small grey `#707974`/`#40916C` labels on light backgrounds — a palette decision) and one `h4` out of heading order on the dashboard keep A11y below 100; the landing's pre-existing 0.084 CLS appears in some runs; `og:url`/`og:image` hardcode the Vercel origin. |
| 2026-09-23 | **Intensive session · Phase 6 — lint cleanup** | `ce6d295` `f122967` `b281a73` `ce8f95a` `c3690ac` | **`npm run lint`: 5 problems → 0 (exit 0).** **6a** the three `react-refresh/only-export-components` errors: `useAuth`/`useTheme`/`useToast` and their context objects moved to `hooks/useAuth.js`, `hooks/useTheme.js`, `hooks/useToast.js`; the `context/*.jsx` files export only their providers; all 17 import sites updated. Measured: appending a line to `ThemeContext.jsx` in the running dev server now hot-updates it with NO full page reload (a window marker survives). **6b** Progress: the chart's `useMemo` formatted dates with `i18n.language` and "Now" with `t` but listed neither — the real stale-language bug, reproduced first with a real click on the language toggle (axis still read "Sep 22" in Arabic), fixed by listing both (now "٢٢ سبتمبر" immediately). Dashboard: the mount-only plan fetch used `showToast` and `t` unlisted. **Found while verifying:** my first fix listed the hook's `i18n` — but react-i18next v17 returns a NEW `i18n` wrapper (and a new `t`) on every language change, so each switch refetched `/progress/today` + `/progress/juz`; the smoke caught it (1 refetch per switch). Final: the toast message comes from the app's i18next instance (`appI18n.t`), deps are `[showToast]` only, plus an `alive` guard — 0 refetches on switching, and exactly one toast (in the current language, EN and AR) when the plan fails to load (forced with Fetch interception, 500). **6c** the annotation navigator now shows free-floating text notes (Text-tool icon + count); a page with only text notes used to show nothing beside it. **6d** CODE_GUIDE + CLAUDE.md say providers come from `context/`, hooks from `hooks/`, and why; the guide notes the i18next identity trap. **Browser smoke (dev server, real input) 7/7 + chart 1/1, 0 console errors:** login by typing (wrong password → one error toast; right password → dashboard), theme toggle dark and back (persisted), language switch without refetch, failed-load toast EN + AR, navigator text-note row, Fast Refresh in place. 126/126 server tests, build clean. **Open:** none from this phase. |
| 2026-09-23 | **Intensive session · Phase 7 — cross-browser smoke (NFR-02)** | `46179e7` `01acfbc` | **Set-up:** Playwright 1.63.0 installed in the session's scratch directory (NOT a project dependency), with its bundled **Firefox 155.0** and **WebKit 26.6**; Chrome 153 was covered by every earlier phase. A 12-check smoke of the core reader flows, all through Playwright mouse/keyboard/touch input on the isolated stack: landing; the public mushaf logged out (QCF font loaded, 15 rows, every word laid out, frame fills its canvas, one nudge, zero account requests); a page turn; selecting a verse; the recitation actually playing (an `<audio>` advancing); zoom drawing the page larger; the tafsir loading; sign-in by typing → dashboard tasks; Arabic + dark (RTL, mushaf intact, account controls back); dark-mode select legibility (pixel luminance); zero console errors. Run in 4 variants — Firefox 1440, WebKit 1440, WebKit 390 (touch, isMobile), Firefox 390 (touch). **Found and fixed — a real, long-standing Firefox bug:** the page frame was scaled with `scale(calc(100cqw / 576px))`; dividing a length by a length (typed arithmetic) is unsupported in Firefox, which dropped the declaration, so the 576×852 frame drew at natural size in a 416px canvas (274px on a phone) — overflowing its card on the right — and zoom enlarged the card but not the page. Now `scale(tan(atan2(100cqw, 576px)))`: Firefox fits exactly (dev AND production build — the minifier keeps the expression), Chrome/WebKit compute the identical scale as before (0.723063 / 0.475532), and the Phase 1 zoom suites still pass in Chrome (18/18, 22/22). It was the only length÷length in the codebase. **Found and fixed — WebKit:** in dark mode every `<select>` was a blank white box (native light surface under light text); `html.dark { color-scheme: dark }` — pixel diffs of 5 dark pages show 0 changed pixels in Chrome and Firefox, and only the selects + scrollbar in WebKit. **Harness errors caught on the way (not app bugs):** a tap aimed at a word that sat under the sticky audio bar (WebKit had "passed" only through its fat-finger correction) — the smoke now scrolls each target to centre and refuses to press anything covered. **Final: 12/12 in all four variants, 0 console errors**; 126/126 server tests, lint 0, build clean. **Side effect to know:** Playwright's installer deleted the orphaned `chromium-1228` + headless-shell builds from `%LOCALAPPDATA%\ms-playwright` (no live install referenced them); a tool that needs them re-downloads with `npx playwright install chromium`. **Open:** real Safari on macOS/iOS and Firefox for Android are still untested (Playwright's Windows WebKit and touch-emulated desktop Firefox are close, not identical); on a 390px phone the sidebar's edge tabs overlap its page-number buttons (belongs to Stage 1.8). |
| 2026-09-30 | **Queued: right-click self-test while annotating** | — | User request: with annotate mode AND the hide-all self-test both on, LEFT click keeps annotating and RIGHT click runs the verse reveal cycle (reveal → select → hide). Grounding: while active the draw layer is an SVG over the whole page with `pointer-events: auto`, so it swallows every click — which is why the self-test is unreachable while annotating today. It already ignores button 2 (MushafDrawLayer.jsx ~129) and preventDefaults `contextmenu` (~230), so right-click is an unused slot, and words carry `data-verse-key` (added for drag-select) so a right-click can be hit-tested through the SVG. Edge cases specified in the prompt: macOS Ctrl+click reports button 0 and must not draw a dot; `contextmenu` fires on mousedown on macOS/Linux but mouseup on Windows, so drive it from `pointerdown` button 2; touch has no right button. 39 local commits (queue items 1–7) are still unpushed awaiting review, so this row is committed locally only. |
| 2026-09-30 | **Queued: edit and move bookmarks** | — | User request: each bookmark gets four actions — jump to it (exists), rename it, MOVE it to the page being read, remove it (exists). Grounding: the API has only GET / POST / DELETE (`bookmarkRoutes.js`), so rename and move need a new ownership-checked `PUT /api/bookmarks/:id`. It must keep the Stage 1.7b rules: ONE bookmark per page per user (unique index `{userId, pageNumber}`, today a 409) and case-insensitive unique non-empty labels (409, excluding the bookmark itself). Real edge case: moving onto a page that already has a bookmark — specced as a 409 by default plus an explicit `replace` flag that removes the other bookmark and moves this one in ONE request, behind a confirm. In a two-page spread "the current page" is the ACTIVE page (last interacted with, the 1.7b rule), not always the right page. Prompt written 2026-09-30; committed locally only (unpushed review stack). |
` produced a double newline. Also beyond brief: **both-page annotation across a spread (8d item 4)**, eraser cursor, and a mushaf line-placement fix. **A3 STILL OPEN** — while measuring, the session found the sticky audio bar was covering 9 words of the last line and fixed it by counting the bar in the height budget, which shrank the single page to **416px at 1440×900** (vs 548 originally). Options given: A=416 fits / B=548 with 33px scroll / C=728 with 300px scroll (+ non-sticky bar). ⚠ Planning-session concerns to raise: scroll-capture uses a non-passive `wheel` + `preventDefault`, so **touch devices get none of it** (no wheel events) and trackpad momentum may feel sticky; and `max-w-[1600px]` was dropped from `main`, leaving the reading column unbounded on ultrawide screens. |
| 2026-09-30 | **Right-click self-test while annotating — DONE, browser-verified** | `7fe2426` | With annotate mode AND hide-all both on: LEFT input annotates exactly as before; RIGHT-click on a verse runs the existing reveal → select → hide cycle. **How:** `MushafDrawLayer` takes an optional `onSecondaryPress`, passed ONLY in the combined mode; a secondary press hands its screen point to `cycleVerseAtPoint` in Library.jsx, which walks `document.elementsFromPoint` to the first `.mushaf-word[data-verse-key]` under the layer (words now also carry `data-word-position`), reads that word's concealed state from ITS page's watermark, and calls the same `revealVerse` / `hideVerse` / `handleWordSelect`. The ladder lives once in `utils/selfTestCycle.js` (`hideModeStep`), now used by MushafPage's click path too. Driven from `pointerdown` (`button === 2`), never `contextmenu`. **Decisions (for the user to confirm):** (1) **"Select" is kept and stays quiet** — the verse is banded and the tafsir follows it, but NO popover opens (a plain click already selects without one), so nothing covers the ink and annotate mode is never left; in this mode a stroke or a press on the ink layer no longer drops the selection (otherwise the R3 "hide" became another "select"). (2) **Ctrl+click = secondary press everywhere** (button 0 + ctrlKey, mouse only) in the combined mode — it runs the cycle, never a dot; Cmd+click is untouched. In annotate-ONLY mode a macOS Ctrl+click still draws a dot exactly as before (kept by the "nothing changes" rule — a one-line change if wanted). (3) **Cover-cursor + annotate: right-click stays inert** (no `onSecondaryPress`; unchanged). (4) **Touch: pointer/mouse-only**, no long-press added. (5) A right-click on a text-note icon in combined mode reaches through to the verse instead of opening the note editor. (6) Also: a stroke whose LEFT button is released while the right is still held (a chord) now ends where the left let go, in every mode — before, it kept following the right button. **Discoverability:** new `library.selfTest.hint.hideDrawing` (EN/AR) replaces the cue line above the mushaf only while both modes are on, and is appended to the hide-all InfoHint for signed-in readers. A first draft appended it to `hint.hide` itself — that wrapped the cue to TWO lines for every hide-all user and would have shrunk the height-fitted page, so it was reworked; measured after: cue 16px (one line) and page frame top 156 / width 416 at 1440×900, identical to HEAD, in EN and AR, hide-only and combined. **Verified on an isolated stack** — `server/app.js` on in-memory Mongo :5341 (fresh DB per run; Atlas untouched), Vite :5342 (new) and a `git archive HEAD` copy on Vite :5343 (baseline), headless Chrome 154 over CDP :9343, real `Input.dispatchMouseEvent` incl. `button:'right'` and Ctrl modifiers: **33/33** combined-mode checks — left drag = +1 stroke, 0 reveals; right-click walks reveal → select (no popover, still annotating) → hide+deselect with 0 strokes; margin right-click changes nothing and the `contextmenu` arrives `defaultPrevented`; Ctrl+click adds no dot and runs the cycle; right-click AND right-drag with pen/highlighter/eraser (on an existing stroke)/text leave strokes unchanged and open no editor; Ctrl+Z after a reveal removes one stroke and keeps the reveal; chord stroke ends at the left release (x 921 vs 821 for the right release); spread 49/50 runs the full cycle on each half without touching the other page's watermark, and a left drag on the left page draws there; at 200% zoom (words 49.6px vs ~24px, scroller scrolled 400px) the right-click revealed through exactly the verse under the pointer (3:7, 3:8 still hidden). **A/B vs HEAD, 10/10 identical** with only one mode on (hide-only, annotate-only, neither): right-click verse / outside the mushaf (browser menu still SHOWN outside), left click, Ctrl+click, left drag. **Straddling verse: not testable because none exists** — a scan of pages 3–603 on the quran.com words endpoint the reader uses found no verse with words on two pages, so the spread case reduces to per-page (revealVerse/hideVerse already iterate every visible page). Console: 0 app errors; the only entries were `401 /auth/me` on the first navigation after each DB restart (the previous DB's token — reproduced: 0 errors when the token matches). Screenshots taken of each step. `npm test` 126/126, lint 0 problems, build clean. Harness lived in the session scratch dir and was removed. ⚠ A parallel session was editing `bookmarkController.js` / `bookmarkRoutes.js` in the same tree during this round — those files were left untouched and uncommitted. |
| 2026-10-01 | **Edit and move bookmarks — DONE, browser-verified** | `9b2d86b` `7ffbcb1` `6bc7371` | **Backend:** `PUT /api/bookmarks/:id` `{ label?, pageNumber?, replace? }` — protected, type-gated like POST (plus `replace: 'boolean'`), 404 for a missing, foreign or malformed id. Everything is validated before anything is written, so label + page in one request apply both or neither. Label uniqueness stays case-insensitive but skips the bookmark itself AND the occupant being replaced (a replace may take over the replaced bookmark's name). Own page → no-op 200. Occupied page → 409 `Page N is already bookmarked` with `conflict: { _id, pageNumber, label }`. `replace: true` deletes the occupant first (the unique `{userId, pageNumber}` index holds throughout), then moves this one, and re-inserts the occupant if the move fails — no transaction, since the code shouldn't assume a replica set. The response carries `replaced`. **+13 tests:** rename/trim/clear; duplicate → 409; own label in another case → 200; >50 chars → 400; free move; own page no-op; occupied → 409 with details and NOTHING applied even with a rename in the same body; replace; replace taking over the occupant's label; a duplicate label blocks a replace without removing the occupant; ownership 404 for rename AND move; malformed id / no token; out-of-range pages and 5 non-scalar bodies → 400. **Client:** each row's trash icon became a ⋮ button (always visible, Tab-reachable, `aria-expanded`) that opens an inline action strip under the row — Rename · Move to page N · Remove. A strip, not a dropdown, because the list scrolls (`max-h-56 overflow-y-auto`) and would clip one. Tapping the row still jumps. Rename is inline (Enter or blur saves, Escape cancels, ≤50, empty → "Page N"), optimistic with rollback, and a 409 shows a localized toast. Move targets `bookmarkTargetPage` (the active page of a spread) and is hidden when the bookmark is already there. An occupied target is caught from the local list before any request and opens a confirm ("Page N already has a bookmark ('label'). Replace it?", plus an unnamed variant); a server 409 (stale list — another device) rolls back and opens the same confirm with the server's occupant; Replace re-sends with `replace: true`. **Decision: Remove confirms only for a NAMED bookmark** — an unnamed one is a single tap to re-add from its page; the active-page "Bookmarked — remove" strip follows the same rule. **`ConfirmModal` upgraded** (shared with Settings and clear-ink): focus lands on Cancel, Tab is trapped, Escape cancels, focus is restored, keys no longer reach the Library's window shortcuts (ArrowLeft used to turn the page BEHIND an open dialog), `alertdialog` role, and dark mode (it was a white box in dark). Labels in the confirm text are wrapped in FSI/PDI isolates — measured: without them an English label ending in punctuation ("Juz 30.") renders as ".Juz 30" inside the Arabic sentence. 14 new keys in EN + AR. **Verified on an isolated stack** — `server/app.js` on in-memory Mongo :5099 (real `quranStructure.json` seeded; no dotenv, so Atlas is unreachable), Vite :5199, system Chrome 154 headless via playwright-core in the scratch dir, real mouse/keyboard/touch input: **89/89** plus **4/4** touch-only at 390px. Covered: rename via Enter/blur/Escape/clear; duplicate-name 409 toast + rollback; move to the current page with the ribbon appearing at once and the list re-sorted; occupied → Cancel (no request sent) / Replace (one PUT with `replace: true`, one bookmark left on the page); stale-list server 409 → confirm → Replace; spreads 49/50 and 51/52 targeting the CLICKED page, including the unnamed-occupant message and the old and new ribbons flipping in one move; keyboard-only end to end (Tab to ⋮, strip, rename, move, named-remove confirm with focus on Cancel, Tab trap, ArrowLeft inert behind the dialog, Escape restoring focus, unnamed remove with no dialog); AR + dark, AR + light, EN + dark (RTL, Arabic digits, localized confirm and toast, dark dialog); logged out — no ⋮, no strip, and zero requests to the API at all. Console: 0 app errors (the only entries were Chrome's own "Failed to load resource: 409" lines for the deliberately triggered 409s). **Harness note:** the first full run tripped the real 300-per-15-min API limiter (429s); the harness then ran `app.js` with `NODE_ENV=test`, as `npm test` does. `npm test` **139/139**, lint 0, build clean. Harness removed. ⚠ This round paused mid-way when a parallel session started editing `Library.jsx` in the same tree, and resumed after that session committed (`7fe2426`). |
| 2026-10-13 | **Bookmark actions as inline icons** | `1ff8917` | User follow-up: rename / delete / move should be icons on the bookmark's own line, not behind the ⋮ menu, for quicker UX. **Done:** each row is now jump-button · ✎ Rename · 📍 Move here · 🗑 Remove — always visible (no hover), 28px targets, one tap each; the ⋮ button and the expanding action strip are gone. Move still targets the ACTIVE page and its tooltip says so ("Move to page N"); when the bookmark already sits on that page the move icon is replaced by an empty 28px slot so the three icon columns stay aligned down the list. Accessible names carry the bookmark ("Rename Women", "Move Women to page 20", "Remove Women" — new `renameFor` / `moveFor` / `removeFor` keys in EN + AR; the now-unused `actions` / `actionsFor` keys removed). Focus returns to the row's own button after each action (Rename after a rename; Move, falling back to Rename once Move is gone, after a move; Remove or Move after a confirm closes), found afresh by `data-bm-action` because a move re-sorts the row. Rename edit replaces the row's icons with the input while it is open. Unchanged: the backend, the replace/remove confirms, the remove-confirms-only-named-bookmarks rule. **Verified on an isolated stack** (in-memory Mongo :5099 with `NODE_ENV=test`, Vite :5199, system Chrome 154 headless via playwright-core in the scratch dir; Atlas unreachable): **84/84** — rename via Enter/blur/Escape/clear and the duplicate-409 rollback; move with the ribbon appearing at once, the list re-sorting and the empty slot kept; occupied page → Cancel (no request, focus back on Move) / Replace (one PUT, one bookmark left); stale-list server 409 → confirm; spreads 49/50 and 51/52 where clicking the left page retargets EVERY move icon and old + new ribbons flip in one move; keyboard-only end to end (Tab skips the empty slot); AR + dark, AR + light, EN + dark; a 50-char name truncating with the icons on the label's line at 1440px and at 390px with touch taps; logged out — no icons and zero requests to the API. Layout asserted from geometry, not just screenshots: every icon's vertical centre within 1px of its label's, all inside the list, no horizontal overflow. 0 app console errors. Lint 0, build clean; no server change (139/139 at `9b2d86b`). Harness removed. Note: the first attempt at this commit was cut off when the session ended; on resume the uncommitted diff was confirmed identical (+83/−96) before committing. |
| 2026-10-13 | **Bookmarks: several per page, green "on this page" pin, confirm every delete, site-styled dialog** | `eac2e6f` `a5b4561` `6f8d225` | Four user follow-ups in one round. **(1) Rule change — several bookmarks per page** (reverses the Stage 1.7b one-per-page rule at the user's request): any number of NAMED bookmarks may share a page; names stay unique per user, case-insensitive. An unnamed bookmark reads "Page N", so a page still holds at most ONE unnamed — enforced by a partial unique index `one_unnamed_per_page` (`{userId, pageNumber, label}` where `label === ''`), which also covers races; the old unique `{userId, pageNumber}` index became a plain lookup index. POST refuses only a second unnamed on a page (409 "Page N already has a bookmark without a name"). PUT: a named bookmark changes onto any page with no conflict; the 409 + `conflict` + `replace: true` flow now applies only when a bookmark would END UP unnamed on a page that already has an unnamed one (by a move, by clearing its name, or both). List order: page, then name (unnamed first), server and client. **Production migration:** `server.js` runs `Bookmark.syncIndexes()` after connecting — idempotent, bookmarks collection only, logged, non-fatal — because Mongoose never alters an existing index, so without it Atlas would keep the old UNIQUE index and still refuse a second bookmark on a page. **The first deploy drops `userId_1_pageNumber_1` (unique) on Atlas and recreates it non-unique, plus creates `one_unnamed_per_page`.** A migration test recreates the old unique index, proves it refuses a 2nd bookmark, runs `syncIndexes()`, and checks the result. Tests: 30 bookmark tests (old one-per-page tests rewritten to the new rule; new: several named + one unnamed on a page, 2nd unnamed → 409, the DB index itself refusing a 2nd unnamed, the migration, a named bookmark joining an occupied page, unnamed-onto-unnamed 409, clearing a name where an unnamed exists → 409, naming an unnamed one as it moves avoids the clash); `npm test` **144/144**. **(2) Green pin:** the change-page icon stays on every row; on a bookmark already on the active page it turns green (`#004f35` / emerald-400 in dark, tinted background), `aria-disabled`, still focusable, tooltip "Bookmark is on this page", accessible name "<name> is on this page", and does nothing on click or Enter. The "Bookmarked — remove" panel is gone and the add row is ALWAYS shown (a second unnamed on a page gets "…without a name. Give this one a name to keep both."). **(3) Wording:** "Move to page N" read like navigation — now "Change bookmark to page N" (AR "تغيير العلامة إلى الصفحة N"); toast "Bookmark changed to page N". **(4) Confirm every delete, in the site's design:** removal asks first whether or not the bookmark has a name (supersedes the earlier named-only rule). `ConfirmModal` restyled to the site's modal card (white / gray-800, `#dce2f3` border, `rounded-2xl`, `sacred-shadow`, `#003527` title, `#404944` body), a round icon badge (red for destructive, green otherwise; default warning sign; trash for bookmark removal, bookmark for replace), a secondary Cancel and the site's `#ba1a1a` red (the colour the Settings danger buttons already use). Shared, so the clear-ink and Settings reset/delete dialogs match too. Labels in dialog text now go through an `isolate()` helper (`\u2068…\u2069` escapes) instead of invisible literal characters. The assistant's guide (`appGuide.md`, 5.5 KB) now describes the three icons, the confirm, and the several-per-page rule. **Verified on an isolated stack** (in-memory Mongo :5099 with `NODE_ENV=test`, Vite :5199, system Chrome 154 headless via playwright-core in the scratch dir; Atlas unreachable): **108/108** — adding 2 named + 1 unnamed to one page with all three pins green, a 2nd unnamed refused with the localized message, a duplicate name refused, order page→name, a named bookmark changed onto an occupied page with no confirm; the green pin staying put, focus kept on it, a raw mouse press and Enter on it sending nothing; unnamed AND named deletes both confirming (focus on Cancel, Cancel/Escape keep it, focus back on the Remove icon, ArrowLeft inert behind the dialog); unnamed-onto-unnamed replace (caught locally, one PUT `replace: true`); clearing a name where an unnamed exists rolled back with the toast; spreads where the green pin and the add row follow the clicked page; keyboard Tab order Rename → green pin → Remove; AR + dark, AR + light, EN + dark (localized strings, RTL dialog mirrored, colours); dialog style asserted from computed styles (surface, `#dce2f3` border, 16px radius, shadow, `#003527` title, `rgb(186, 26, 26)` button, red badge) in the bookmark AND Settings delete-account dialogs, light and dark (opened, then cancelled — no account touched); 390px touch; logged out (no icons, no add row, zero API requests). 0 app console errors. Lint 0, build clean. Harness slips caught and fixed on the way (not app bugs): Playwright refuses `.click()` on `aria-disabled` elements (switched to a raw mouse press); an Arabic unnamed bookmark is "صفحة ٥٠", not "Page 50"; an option-name typo sent the Settings check to the Library. Harness removed. |
| 2026-10-13 | **Public Library v2 — guest mode (design under discussion)** | — | Already shipped by the intensive session: `/library` is public, account features hide behind a sign-in nudge, login honours `returnTo`. Gaps found by the planning session: **`Register.jsx:31` always `navigate('/onboarding')`**, so a sign-up started from the Library loses the page and forces onboarding; and nothing persists for a guest. Proposal put to the user: keep ONE app, ONE origin, ONE account (localStorage and IndexedDB are per-origin, so a separate subdomain or site could never hand a guest’s data to the main app); a guest store behind a storage adapter so Library code never branches on auth (IndexedDB for annotations/ink, localStorage for small prefs); merge-on-signup; onboarding offered only when the user first opens the tracker, never forced from the Library. Awaiting the user’s decisions before a prompt is written. |
| 2026-10-13 | **Queued: many more reciters** | — | Today: 5 reciters, primary `cdn.islamic.network/quran/audio/128/{edition}/{global}.mp3` (alquran.cloud edition ids) with an everyayah.com folder per reciter as the verified fallback. Prompt written: discover the verse-by-verse audio editions on both sources, verify per reciter (200s, same qari, same riwaya — the mushaf is HAFS, so Warsh/other riwayat must be excluded or clearly labelled — murattal vs mujawwad vs muallim labelled, real bitrate per source since some are not on the /128/ path), restructure RECITERS to carry bitrate/style/fallback, and make the picker scale (search, grouping, recently used). |
| 2026-10-13 | **Queued: faster page turns** | — | Existing prefetch (intensive phase 5f, Library.jsx ~1514-1565): ONE turn each way, started 1.2s (2.5s while playing) after the page settles, idle-time, one page at a time, cancelled and restarted on every turn — so a fast reader never benefits; fonts are only warmed into the HTTP cache, not registered (registering them in the prefetch had pushed /library TBT 230 → 510ms). On arrival (~823-835) `setPageLoading(true)` fires unconditionally and the turn awaits `fetchMushafPage` + `ensurePageFont` (FontFace registration) even on a cache hit — the likely source of the perceptible delay. Prompt written: measure first, two turns each way, a synchronous cache-hit render path with no loading flash, idle registration of the next turn’s font within a TBT budget, bounded memory, data-saver awareness. |
| 2026-10-13 | **Bookmarks: confirm page changes + Restore after changes and removals** | `e298522` `692bc72` `83d21db` | User follow-up: confirm before changing a bookmark too, and after confirming show a message with a Restore button to revert it; the same after deleting. **Toasts (`e298522`):** `showToast(message, type, { action: { label, onClick }, duration })`. A toast with an action stays 7 s (plain toasts keep 4 s) and its timer PAUSES while hovered or focused, so the button never vanishes under the pointer or the keyboard. The stack is now a polite live region (`role="status"`); the close button got a translated label. Placement unchanged — bottom END of the screen (bottom-left in Arabic, bottom-right in English), following reading direction. **Bookmarks (`692bc72`):** the pin now always asks first — "Change bookmark?" / "Change 'Women' from page 106 to page 20?" (unnamed: "Change the bookmark on page 106 to page 20?") in the site's NON-destructive variant (pin badge, `#003527` button). When an unnamed bookmark would land on another unnamed one, the SAME single dialog is the replace one instead (no double prompt). After a change: "Bookmark changed to page N" + **Restore** → PUT back to the old page, then (if it had replaced one) re-create the replaced unnamed bookmark — in that order, so the page's single unnamed slot is free. After a removal: "Bookmark removed" + **Restore** → re-created on the same page with the same name (new id). If restoring is no longer possible (e.g. the name was reused from another device meanwhile) → "Couldn't restore the bookmark", nothing duplicated. The dialog's per-kind text moved into one `bookmarkDialog` value. The assistant's guide mentions the confirm + Restore. No server change (Restore reuses POST / PUT). **Verified on an isolated stack** (in-memory Mongo :5099 with `NODE_ENV=test`, Vite :5199, system Chrome 154 headless via playwright-core in the scratch dir; Atlas unreachable): **61/61** — the change dialog in EN light, AR dark and EN dark (text naming both pages, green button + badge measured, nothing sent before confirming, Cancel sends nothing); Change → toast with Restore at the reading-direction end (measured: bottom-right EN, bottom-left AR) → Restore puts it back (DB, ribbon, pin grey again) with a "Bookmark restored" toast; replace → Restore brings BOTH back; delete → Restore re-creates named AND unnamed bookmarks (EN, AR); a restore made impossible meanwhile says so; timing — hovered 8.5 s still up, gone after the pointer leaves, un-hovered still up at 4.5 s and gone by 8 s, a FOCUSED Restore keeps it up and Enter restores; keyboard change flow (Enter on pin → focus on Cancel → Tab → Change → focus back on the now-green pin); rename unaffected; logged out unaffected. 0 app console errors. Lint 0, build clean, chat tests 6/6 (guide 5.7 KB < 6 KB). Harness removed. **Observation for the user:** the toast stack overlaps the right end of the recitation bar (the reciter picker in EN; bottom-left in AR) — that is the existing global toast placement, now more noticeable because action toasts stay 7 s; left unchanged pending the user's call. |
| 2026-10-13 | **Restore toasts: 10 s** | `7d66737` | User: the toast position over the recitation bar is fine; make Restore toasts last 10 s instead of 7. `ACTION_DURATION` 7000 → 10000 in `ToastContext.jsx` (hover/focus pause unchanged; plain toasts keep 4 s). Verified on the isolated stack with a real delete: Restore toast still up at 9 s, gone by 11 s; a plain "Bookmarked page 20" toast still up at 3 s, gone by 5 s; 0 console errors. Lint 0, build clean. Harness removed. |
| 2026-10-13 | **Many more reciters — 5 → 34, all verified; searchable picker** | `41c268d` `a8ad098` | **Discovery:** alquran.cloud lists 32 verse-by-verse audio editions (≈22 Arabic) plus three it files as "translation" that the CDN still hosts (`ar.abdulbasitmurattal` at /64/ + /192/ — it only 403s at /128/ — `ar.minshawi`, `ar.minshawimujawwad`); everyayah.com has 79 folders. Each Arabic CDN edition was probed at /32 /48 /64 /128 /192/. **Verification (real GETs, MPEG frames parsed for duration + real bitrate, frames hashed with ID3 stripped):** 115 sources × 31 ayahs (1:1, 2:255, 2:282, 18:1, 36:1, 55:1, 112:1, 114:6, globals 5944/5953/5954 — all 200 first try today — and 20 seeded-random). Full coverage: everyayah’s per-folder `000_checksum.md5` manifests, plus a HEAD sweep of all 6236 ayahs where a folder publishes none (Ghamadi 40, Basfar 192, Hudhaify 128, Sowaid 64 — all 6236/6236) and for the CDN-only entries (Shuraym /64/ 6236/6236). **Added (34; all Hafs, per both sources’ labelling — non-Hafs is labelled explicitly by both):** CDN primary + byte-identical everyayah fallback — Afasy, Husary, Minshawi, Abdul Basit (192), Hudhaify, Ayyoub (real 64 kbps), Sudais (192), Maher (/64/; 30/31 identical, only 1:1 differs by 0.2s), Shatri, Basfar (192), Rifai (192), Jibreel (real 64), Akhdar (32 mono), Ayman Suwayd; CDN only — Shuraym (/64/ path holds 128 kbps; everyayah is a different encode with a different 1:1, so not attached), Husary Mujawwad; everyayah only (primary, no fallback) — Ajmi (ketaballah folder, byte-identical to the CDN edition, which is served as octet-stream), Ghamdi, Dosari, Qatami, Budair, Juhany, Abdul Muhsin al-Qasim, Qahtani, Matrood, Bukhatir, Ali Jaber, Fares Abbad, Tablawi, al-Banna, Nuaina, Abdul Basit Mujawwad, Minshawi Mujawwad, Husary Muallim. Style labels backed by tempo over the same sample: murattal 375–917s, muallim 1116s, mujawwad 1211–1342s. **Rejected:** `ar.minshawimujawwad` is MISLABELLED — byte-identical (31/31) to Minshawi’s MURATTAL; CDN Ajamy/AbdulSamad served as application/octet-stream (one x-dosexec); AbdulSamad (QuranExplorer) not the Abdul Basit mujawwad recording and its style is unestablished; the `-2` editions are duplicates; everyayah Mustafa Ismail (4220 files missing), Menshawi 32 (303 missing), Akhdar 64 (empty), Tunaiji (its 001001.mp3 IS Minshawi’s file), Parhizgar (some files 18 kbps/11 kHz), a second Ajmi folder (a different recording); surah-by-surah editions (not verse-addressable). Passed but held back as less widely known (one line each to add): Ali Hajjaj Souissi, Sahl Yassin, Akram al-Alaqimy, Aziz Alili, Yaser Salamah, Muhammad AbdulKareem, Karim Mansoori. **Found by the full sweep:** Husary Mujawwad under /128/ answers **416 for 45:25–45:32** — recitation would die there; moved to /64/ (same recording: all 31 sampled ayahs within 0.1s, 6236/6236 answer 200). One residual quirk on both paths: 43:69 is served as application/octet-stream — valid MP3 bytes, Chrome plays it (21.9s); **Safari not checked**. **Code:** `RECITERS` entries carry `style`, `riwaya`, `cdn` (path segment or null), `everyayah` (fallback when `cdn` is set, primary when it is null), `kbps` (measured), `aka`; `getAyahAudioUrl` builds the everyayah URL from the global ayah via `keyOfOrd`, `getFallbackAyahAudioUrl` returns null unless the CDN is primary; `resolveReciterId` keeps every old saved id and sends unknown ones to the default. Library.jsx’s player is untouched — everything flows through the two existing URL helpers (everyayah is behind BunnyCDN with max-age≈300 days and ACAO *, so the warm-up needed no change). New `ReciterPicker.jsx` replaces the `<select>`: search over EN + AR names, aliases and style words (tashkeel/hamza/space/hyphen-folded), grouped murattal / mujawwad / teaching, last 4 used on top, combobox + listbox with aria-activedescendant, Escape/Enter/arrows, portalled above the bar and clamped to the viewport, no forced soft keyboard on touch, RTL, dark; a multi-style qari always shows his style. EN/AR strings added. **Verified on the isolated stack** (server/app.js on mongodb-memory-server :5391, Vite :5392, headless Chrome over CDP via puppeteer-core in the scratch dir, real mouse/keyboard/touch): **54/54** — Ghamdi, Abdul Basit, Minshawi Mujawwad, Shuraym, Husary Muallim and Husary Mujawwad each play verse 1 of p603 and carry on across the turn to p604 with a 58–85ms ended→playing handover; switching Qatami → Sudais mid-recitation resumes the same verse with neither buffer left on the old reciter and zero old-reciter events after the switch; a forced 502 on the CDN (Fetch.fulfillRequest) falls through to everyayah for Abdul Basit in 9.3s, and ends at the visible error with the button back on Play for Shuraym (8.7s) and for everyayah-primary Dosari (8.8s); saved `ar.hudhaify` / `ar.muhammadayyoub` load and play, `ar.bogus-retired` falls back to Afasy; 12 EN-UI + 3 AR-UI searches (incl. "عبدالباسط", "مجوّد", "al-husary"), keyboard flow never turned the page, recents order, 390px phone EN + AR. 144/144 server tests, lint 0, build clean. Harness lived in the scratch dir only. **Usage terms:** alquran.cloud/islamic.network — recitations "licensed … for free, non-commercial redistribution at the bitrates we publish"; streaming/embedding for personal and educational use is allowed; a commercial product may bundle them but "copyrights lie with the reciters and they may ask you to remove the content"; cache aggressively. everyayah.com publishes no terms on its pages. |
| 2026-10-13 | **Queued: smoother verse-to-verse handover** | — | User hears a slight cut between verses during recitation and asked for a fade. Planning-session findings: the handover is the double-buffered swap on `ended`, measured earlier at ~57ms to audible, plus whatever MP3 encoder delay/padding each file carries, plus room tone that stops abruptly. **An overlapping crossfade is ruled out on content grounds** — it would blend two verses and fade over the final letter (madd, ghunna, qalqala) and erase the reciter’s natural waqf pause; fades may only ever act on SILENCE, never on speech. **Measured CORS today:** `cdn.islamic.network` (primary) sends NO `Access-Control-Allow-Origin`, so Web Audio cannot decode it and a `MediaElementAudioSourceNode` on it would output silence; `everyayah.com` (the verified fallback, same recordings) sends `Access-Control-Allow-Origin: *`, so a Web Audio path is feasible only from there. Further Web Audio traps: `AudioBufferSourceNode.playbackRate` shifts PITCH (breaks the 0.75–2x speed control, which media elements handle with preservesPitch), and iOS suspends Web Audio when the page is backgrounded or the screen locks, while a media element keeps playing; `HTMLMediaElement.volume` is read-only on iOS, so element fades degrade to none there. Prompt: measure first, tier 1 = precise early start of the next element plus silence-only micro-fades (works everywhere), tier 2 = Web Audio only if measurement still shows an audible gap, gated to speed 1x + page visible + everyayah source with automatic fallback. Must run AFTER the page-turn session currently uncommitted in the tree (both edit Library.jsx). |
| 2026-10-13 | **Handover follow-up: early start + "pause between verses" setting** | — | The handover session improved things but a slight pause remains; the user proposed starting N+1 a few ms before N ends. Planning-session ruling: YES to starting early to absorb the player’s start-up latency, but the lead must be PER BOUNDARY — `lead = min(start-up latency, N’s measured trailing silence)` — so it may overlap N’s trailing silence but never N’s speech (a fixed lead would mask the final letter on files with little trailing silence); it must scale with playbackRate, and `duration` is only an estimate on some MP3s, so `ended` stays the safety net. Any pause left after that is most likely the reciter’s natural waqf pause IN the recording — a product choice, not a bug — so a setting was specced: **Pause between verses — Natural (default) / Tight** (trim edge silence to ~150ms, never touching speech). Follow-up sent to the running session. |
| 2026-10-13 | **Two implementation sessions running in parallel in one folder** | — | The page-turn prefetch session and the verse-handover session are both editing `client/src/pages/Library.jsx` in the same working tree at the same time. Risks flagged to the user: a whole-file `git add` would commit the other session’s half-done hunks under the wrong message; a whole-file rewrite would silently clobber the other’s edits; and the page-turn session’s before/after timing matrix builds the live tree, so mid-run edits could contaminate its numbers. Both sessions were told to stage hunk-by-hunk (`git add -p`), edit surgically, report which tree state they measured, and append their plan rows with `core.autocrlf=false`. Recommended for future parallel work: one `git worktree` per session. |
| 2026-10-13 | **Faster page turns — two turns each way, instant warm turns, no lost presses** | `b7814e1` `d2f6e0e` | **Measured first** (isolated stack: server/app.js on mongodb-memory-server, prod build on vite preview with vercel.json's immutable font header, headless Chrome 154 over CDP, real key input; latency = keydown → the new page's glyphs painted with its font loaded; the 180ms turn animation is design and not counted). Findings: (1) the old warm-up never took the font off a turn — the bytes `warmPageFont` put in the HTTP cache were not reused by the FontFace url() load, so every "prefetched" turn re-downloaded the font (Slow 4G: 630–800ms); (2) on a 4x-slow CPU the biggest cost was the FIRST layout with a new face — 188ms for a new page vs 35ms for one seen before; (3) quick presses were LOST under load (router renders in a transition + a handler bound in an older render: 5 presses at 4x CPU landed 1–4 pages short). **`b7814e1`:** new `services/pagePrefetch.js` — one persistent queue, re-ranked each turn, ±2 turns (±4 pages in a spread), nearest + forward first, data then font; starts in idle time once the page has painted, holds while a page loads or the scrubber is dragged, 1 step at a time with a 2.5s head start while reciting, depth 1 on 2g and 0 on Save-Data. `mushafApi.js` — fonts fetched as bytes and DECODED ahead (`decodePageFont`), registered only when drawn (`registerPageFont`, synchronous) except the next forward page (then back), which is PRIMED (`primePageFont`: registered and its lines laid out off-screen, 3 lines per idle step, ~35–40ms each at 4x CPU); in-flight fetches shared; LRU caps 40 shaped pages / 16 decoded / 12 registered faces, farthest evicted, never the visible or just-left pages. `Library.jsx` — a page whose data + font are in memory is drawn in the SAME render that turned to it (`takeReadyPages`, adjusted during render: no loading state, no await, no extra commit); a real load dims only after 150ms (`delay-150`); the go-to field follows the page during render; the playback follower decodes instead of registering. `PageScrubber.jsx` — `onScrubbingChange`. **`d2f6e0e`:** turns step from refs (page last asked for, else the page shown, mirrored in a layout effect) — 5 presses at 4x now land 405/405 410/410 411/411 421/421 (before 404/405 407/409 407/411 415/417). **Before → after, median turn ms (interleaved runs, 5–10 turns each):** unthrottled single warm 89→31, quick (400ms after the last turn) 120→25, fast (5 turns in 1s) 141→31; spread warm 163→148, quick 295→123; Slow 4G single warm 798→137, spread warm 716→47, quick 1255→748 / 1623→1404 (a turn every 400ms outruns a 562ms-RTT link), fast landing 2098→170 / 4012→76 with 6/10 intermediate pages painted vs 2/10; 4x CPU single warm 558→218, quick 515→139, spread warm 672→256, quick 886→600. Cold jumps unchanged within the external API's noise (interleaved re-run 119–164 vs 137–163ms). Warm turns: 0 frames in the loading state (before: 1–3 per turn, dim down to 0.60 on Slow 4G). Lighthouse 12 mobile /library TBT median of 5: 48 → 37ms (no-priming build 46); Perf/LCP equal across builds (~70 / ~5.1s today, the quran.com API being slow under simulation). Checks on the isolated stack: frame 576x852 / text box 524x800 in both views, ArrowLeft = forward (RTL) with the forward animation, ArrowRight back, follow-along recitation turned 100→101 with no silent sample (25ms sampling), nothing fetched while scrubbing and 451–456 warmed after releasing on 454, Save-Data fetches only the page (+ its margin neighbour), registered faces stay at 12 after 30 turns, 0 console errors. 144/144 server tests, lint 0, build clean. Committed with only my hunks: the verse-handover session's uncommitted Library.jsx / quranApi.js / locales / verseEdges.js edits left in the tree untouched, and none of the measured builds contained them. **Open:** fast flipping still outruns the queue in a spread unthrottled (5/10 painted) and at 4x CPU (landing 0.5–1.5s); a turn BACK is not primed until forward work is done. |
| 2026-10-13 | **Planning review: page turns + handover in progress** | — | **Page turns (b7814e1, d2f6e0e, 9b3a592) ACCEPTED on the evidence:** prefetched single-page turn 89 → 31 ms median, Slow 4G 798 → 137 ms, 4x CPU 558 → 218 ms, fast-flip landing on Slow 4G 2098 → 170 ms, 0 loading-flash frames (was 1–3), /library Lighthouse TBT 48 → 37 ms, quick presses at 4x CPU now land exactly (were 1–4 pages short). Root cause worth remembering: the old prefetch’s HTTP-cache font warm-up was never reused, so every "prefetched" turn re-downloaded its font. With `git add -p` unavailable, the session staged a HEAD copy plus only its hunks and built/linted the committed tree on its own — the other session’s files were never included. Carried forward, low priority: two-page fast flipping still outruns the queue (5/10 in-between pages painted); at 4x CPU landing after a fast flip still takes 0.5–1.5 s; backward turns are primed only after forward work. **New follow-up:** Lighthouse mobile shows Perf ~70 and **LCP ~5.1 s on /library for BOTH builds** — above NFR-01’s 3 s; the session attributes it to the runtime quran.com page request under simulation. Worth investigating serving page word data from our own origin (the structure is already self-hosted). **Handover (in progress, uncommitted):** per-boundary early start working (Abdul Basit 1x player gap 151 → −3 ms, Husary 0.75x 94 → −26 ms, inside encoder zeros), a pre-existing bug where truncated (gzip) files CLIPPED speech is fixed (Hani al-Rifai 3 → 0 clipped); the session caught its own flaw — some files open with 500–800 ms of exact digital zeros that are the recording’s own edited pause, which the lead was treating as padding, breaking "Natural = as recorded" — fix: cap leading zeros counted as padding at 100 ms. Planning note: Akhdar’s measured codec delay is 146 ms, so the cap should be per-reciter (measured) rather than one global 100 ms. |
| 2026-10-13 | **Verse handover: truncation fixed, early start, "Pause between verses"** | `27b04e6` `09e4280` | **What the cut was (measured, Chrome 154, isolated stack: server/app.js on mongodb-memory-server :5431, Vite :5432 vs a `git archive` copy of `b27c48c` on :5433, headless Chrome over CDP, real clicks; after-runs on the tree with the page-turn prefetch live):** (1) **verse endings cut off** — the 09-12 warm-up GETs a verse; cdn.islamic.network answers gzip (`Content-Encoding: gzip`, weak ETag, `Vary: Accept-Encoding`), and the `<audio>` element later revalidated that cached copy (304) and stopped at the COMPRESSED length: 0.7–24% of a file never played (Hani ar-Rifai 112:1 lost 0.84 s incl. words; Husary 4/6 verses short in one run). In production since `e9921a3`; (2) **player dead air** 92–221 ms per verse change (`ended` → render → `play()` → start-up); (3) **encoder zeros** 15–146 ms at the head of untagged files (LAME-tagged files: 0, Chrome trims them). Natural room tone/waqf sits on both sides and is the rest. **Fix 1 (`27b04e6`):** warm-up sends HEAD to the CDN (warms the edge identically: cold HEAD → MISS, next GET → HIT, 5/5; no body to poison); CDN URLs end in a bare `?` (same edge object, verified both ways; new browser-cache key, so listeners' existing poisoned copies — 70-day max-age, renewed on each 304 — are never used again). everyayah doesn't compress, keeps GET. **Fix 2 (`09e4280`):** per-frame clock model (fresh `currentTime` readings only — it freezes 17–30 ms near file ends — median projection, reset on a backwards jump) fires `play()` on the READY next buffer by wall clock; start-up latency measured per device from ready `play()` calls at steady state (early readings run ahead: 3–19 ms vs a real 59–76 ms); `ended` still commits, so repeats/range/highlight unchanged and it is the fallback. Lead capped PER BOUNDARY = N's measured trailing silence (−30 ms guard) + N+1's exact leading zeros (encoder delay only: ≤ reciter floor+50, ≤100 ms — Hani opens some files with 500–800 ms of EDITED zero silence, which Natural keeps); edges measured by new `verseEdges.js` (12 KB head + HEAD + 16 KB tail from everyayah's CORS copy, ~28 KB/verse), trusted only if its length matches the element's (rejects Maher 1:1, a different encode); validated vs full decodes on 140 files/10 reciters. End anchored to the measured frame length (duration counts the ID3v1 tag). A platform that pauses one element when another starts disables early start for the session. **Setting** Pause between verses — Natural (default) / Tight (edge silence trimmed to ~150 ms, never within 30 ms of a word), EN+AR, localStorage `versePause`, in the assistant guide (which also said "five reciters" — now 34). **Results (before → after, player gap median, Chrome's audible clock + measured edges):** 1×: Husary 128 → −21 ms (negative = inside N+1's own zeros), Afasy 120 → 10, Ghamdi 120 → 17, Abdul Basit 151 → −3, Rifai 146 → 32; 0.75/1.5/2×: Husary 94/114/119 → −26/−32/−19, Ghamdi 97/112/157 → 20/15/23; verse repeat: changes 153 → 8, replays 68 → 79 (same untouched path); range wrap 108 → 44. Remaining pause split per boundary: Husary (a) player ≤26 + (b) zeros ≤39 + (c) RECORDED 0.90–1.35 s; Afasy (c) 110–290 ms — what is left is the recitation's own pause. Tight: Husary 0.94–1.39 s → 148–213 ms heard, Afasy 154–204, Ghamdi already short. **Safety, every run:** 0 speech clipped (before: Rifai 3), 0 speech overlap (N+1's first non-zero sample always ≥54 ms after N's last speech), longest two-element overlap ≤180 ms of silence. Caught and fixed on the way: a stale clock model that started the next verse over a verse REPEAT (two verses for 5 s) — guarded by reset + live-clock agreement. Edge cases passed: pause/resume, pause landing inside an early start (both stop, N+1 rewound), speed change, page turn by hand, reciter switch mid-verse, last ayah (stops cleanly), forced 502s: transient (absorbed by warm-up), primary down (prefetch fails silently, no early start into it, fallback plays after ~8.4 s), both down ("Could not play"). 144/144 server tests, lint 0, build clean; each commit's staged tree linted/built on its own. **Not measured / open:** acoustic output on real hardware (headless Chrome's clock is Chrome's definition of audible; a loopback capture was tried and dropped — it would record the machine's other audio), Safari/Firefox (zeros lead is Chromium-only; iOS concurrent-play guard untested on a device); CDN-only reciters (Shuraym, Husary Mujawwad) get no measured edges, so only the zeros floor; Tight applies between different verses, not to a verse repeat. Harness deleted. |
| 2026-10-14 | **Fix: speed control ignored after the first verse** | `8281044` | User report: at 2x (Mishary), some verses played at 1x and some at 2x. **Cause (a regression from `09e4280`, plus an older gap):** `loadBuf` set `playbackRate` and then called `load()`, which resets it to `defaultPlaybackRate` (1) per the media-element spec — so every preloaded verse came up at 1x. The old swap path re-applied the speed after the swap; the new early handover adopts the next verse as it is, so only the first verse ran fast. Retried / fallback loads (`failBuf` → `loadBuf` → `playEl`) never re-applied it either. The handover round's speed tests read the rate from the trace instead of measuring the clock, so they missed it. **Fix:** one `applyRate(el)` setting both `defaultPlaybackRate` (survives `load()`) and `playbackRate`, used in `loadBuf` (before and after `load()`), in `playEl` (every start: early handover, swap, repeat, retry, resume), in the playback effect and in the speed-change effect. **Verified on the isolated stack** (in-memory Mongo :5431, Vite :5432, headless Chrome 154, real click on Play), measuring each verse's REAL speed from its media clock against the wall clock: BEFORE Mishary 2x 1/9 verses fast (8 at 1.00x, attribute 1); AFTER 2x Mishary 14/15, Husary 12/12, Ghamdi 14/15; 1.5x 12/12; 0.75x 8/8; 1x→2x mid-recitation every later verse 2.0x; forced 502 on 112:3's primary → the everyayah fallback verse at 2.01x; Tight pause at 2x 12/12. The one non-match each time is the cold FIRST verse (still downloading, one `waiting` stall): over its stall-free stretch it measures 1.94–1.98x. Lint 0, build clean (client-only change). Harness deleted. |
| 2026-10-14 | **Queued: span actions, annotation undo, right-click in annotate mode** | — | Three user requests, grounded: (1) right-clicking inside a dragged range acts on ONE verse because `showVerseActions` clears `rangeSelection` (Library.jsx ~2455) and every popover action (`setVerseHighlight`, `toggleHard`, …) takes a single `verseKey`; rule specced: right-click INSIDE the span acts on the whole span, OUTSIDE it replaces the span; a span highlight is N API calls today against the 300 req / 15 min general limiter, so a validated, ownership-checked, cap-aware BATCH annotations endpoint is specced; (2) Ctrl+Z exists only in annotate mode and only undoes ink (`undoRef = undoStroke`, ~1942-1951) — highlights sit on no history; specced: a session-local annotation history (keyed by page+verseKey+kind, since ids change on re-create), Ctrl+Z / Ctrl+Y outside annotate mode, ONE interleaved timeline with ink inside it, an Undo button on the toast for touch, self-test reveals never recorded; (3) right-click while annotating was built in `7fe2426` only for annotate + hide-all self-test (`selfTestWhileDrawing`, ~2480) — annotate-only right-click is a dead slot; planning interpretation: right-click should mean the same thing annotating or not (select + actions popover when self-test is off; the reveal cycle when hide-all is on), pending the user’s confirmation. |
| 2026-10-14 | **Queued: number-key shortcuts for the annotation tools** | — | User request: 1 = pen, 2 = highlighter, 3 = eraser, 4 = text, alongside the existing P/H/E/T. Grounding: `isShortcutKey(e, letter)` (utils/shortcutKeys.js) matches `e.code === `Key${letter}`` OR `e.key`, so a digit would test the non-existent code `Key1` and fall back to `e.key` alone — which breaks on AZERTY (unshifted number row types `& é " '`) and on the macOS Arabic layout (number row types Arabic-Indic `١ ٢ ٣ ٤`). Specced: a digit branch matching `Digit1..4` and `Numpad1..4` OR `e.key` in both Western and Arabic-Indic digits; no Ctrl/Alt/Meta (Ctrl+digit switches browser tabs); same ladder as the letters (arms annotate mode from off, pressing the active tool again puts the tools away, then stops); number badges in the toolbar. `DRAW_TOOLS` order is pen, highlighter, text, eraser while the requested numbers put eraser at 3 — reordering the toolbar so position matches the number is offered as a user decision. No digit shortcuts existed in the reader before. Must run after the span/undo session currently uncommitted in the tree. |
| 2026-10-14 | **Span actions, annotation undo, right-click while annotating** | `0aa43a5` `1d78272` | **Backend (`0aa43a5`):** `POST /api/annotations/batch` — up to 300 ops `{ kind: highlight / hard / note, pageNumber, verseKey, value }`, each naming the STATE its key should end in (colour or null, true/false, text or null), keyed by page + verseKey + kind (never `_id`); the reply gives every key's `before` / `after`. Protected; `validateBody({ ops: 'objectArray' })` (new type in validate.js) plus strict per-field checks in the controller (operator objects, arrays and numeric strings rejected); verseKeys checked against the committed structure; duplicate keys rejected; the 2000 cap checked net of what the batch removes. **All-or-nothing:** every op validated and the cap checked before any write, then one ordered `bulkWrite`; if it fails part-way, the touched keys are restored from a pre-write snapshot with raw driver calls (same `_id`s and timestamps) and the request 500s. That is compensation, not a Mongo transaction: a crash between the failed write and the restore could still leave a partial batch (Atlas would support a real transaction if wanted). `GET /api/annotations/verses?from=&to=` reads a page range's highlights / notes / hard flags in one request (span state). 12 new tests: happy path across 3 pages, undo replay, hard + note set / no-op / clear, ownership isolation, invalid verseKey (nothing written), bad kinds / values / duplicates, 10 non-scalar payloads, empty + 301-op batch, cap, partial-failure rollback (confirmed to FAIL with the restore disabled). **Client (`1d78272`):** right-click / long-press INSIDE a span opens the span's actions (`rangeSelection.actions`), OUTSIDE replaces it with that verse; label "Ya-Sin 38–43 · 6 verses" / "يس ٣٦–٣٩، ٤ آيات" (Arabic comma: a middle dot beside Arabic-Indic digits reads as ٠). Colour and hard flag toggle all-or-none, with a dashed-ring `aria-pressed="mixed"` swatch and a remove-all-highlights button; Play = the range repeat over the span (pause / resume); Tafsir opens on the first verse without dropping the span (an off-screen first verse is resolved from its global ordinal); prev/next hidden; Note disabled (aria-disabled + tooltip). Every verse-annotation write (single verse, span, note save / delete, page hard flag, hard-list remove) now goes through the batch; refresh = affected visible pages (off-screen cached copies dropped), hard list, summary, span state. **History:** one session timeline, cap 50, steps `{anno: ops with before/after}` or `{ink: page}` (ink snapshots stay in the per-page stacks), presses run strictly in order; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y in and out of annotate mode (input / textarea / contenteditable and tour guards unchanged); a toast's Undo / Redo acts only on its own step while that step is the latest (else a hint); a failed undo keeps its step and offers Retry; ink steps are dropped when a page's snapshots reset or annotate mode ends; the draw toolbar's Undo / Redo use the same timeline. **Annotate mode:** `onSecondaryPress` = open actions (self-test off) / the 7fe2426 reveal cycle (hide-all) / none (cover). **Verified** (isolated stack: server/app.js on mongodb-memory-server :5439, real Vite :5440, headless Chrome 155 over CDP, real mouse incl. button 'right' and Ctrl+click, real keys, screenshots; 108 checks, all passing on the final code): drag 36:38 → page turn → 36:43, right-click inside → "6 verses", yellow → ONE request carrying 6 ops, each verse on its own page (442 ×3, 443 ×3); Ctrl+Z → all 6 cleared in one request, Ctrl+Y → back; mixed swatches, toggling sets all, undo restores the exact mixed state; span hard flag + Ctrl+Z; right-click outside → single verse; colour change + Ctrl+Z → the OLD colour; hard toggle undo; toast Undo by click; note save → Ctrl+Z → Ctrl+Y (same text); Ctrl+Z in the note textarea → 0 requests; Ctrl+Z after a hide-all reveal keeps the reveal (135 → 127 → 127 concealed words) and undoes the last annotation instead; annotate mode: stroke, highlight, stroke → three Ctrl+Z undo them in reverse, Ctrl+Y ×2 forward; right-click draws nothing and stays in annotate mode, popover 34 px clear of the pressed line; Ctrl+click no dot; blank margin nothing; span through the ink; hide-all cycle reveal → select → hide unchanged, no ink; cover inert; spread right (441) and left (442) pages; zoomed 1.5×; EN light + AR dark (RTL), Ctrl+Z as `key:'ئ' code:'KeyZ'`; batch blocked → error + Retry → succeeds. 156/156 server tests (one run during the browser checks showed 18 failures I couldn't capture; three reruns clean), lint 0, build clean. Harness deleted. **Found:** with the real limiter on, the harness hit 429 after ~5 full runs, and `AuthContext` treats a 429 on `/auth/me` as a bad token and signs the reader out (pre-existing, not fixed). **For the user to confirm:** right-click while annotating means the same as outside (the planning interpretation); notes disabled for spans; note save / delete ARE undoable (the text is known); a toast's Undo is refused with a hint once newer changes exist. |
| 2026-10-14 | **Number-key shortcuts for the annotation tools (1 pen, 2 highlighter, 3 eraser, 4 text)** | `8d54961` | **Matching:** `isShortcutKey` (utils/shortcutKeys.js) gained a digit rule — `e.code` `DigitN` (the number-row key whatever it types: AZERTY `& é " '`, Mac Arabic `١ ٢ ٣ ٤`), OR `e.key` as the digit in Western / Arabic-Indic / Eastern Arabic-Indic (`1` `١` `۱`), OR `NumpadN` **only while it types a character** — with NumLock off Numpad2/3/4 are ArrowDown/PageDown/ArrowLeft and must keep turning pages (matching the bare code would have hijacked them). Letters unchanged. **Wiring:** `DRAW_TOOLS` carries `num` beside `key`; `toolForKey` tries both through the same helper, so digits get the identical ladder (arm from off + select → active number again → tools away → again → stop). Ctrl/Alt/Meta + digit untouched and un-prevented; Shift allowed. `e.repeat` is swallowed for every tool key — **letters included**, a deliberate change: holding P used to cycle the ladder at key-repeat rate (one-word revert if unwanted). **Order (user decision taken as recommended):** toolbar reordered pen, highlighter, eraser, text so position = number; restoring the old order is swapping two lines in `DRAW_TOOLS`. **Discoverability:** small number badge at each button's logical end corner (RTL-correct; reads 1→4 in the reading direction in both locales), tooltips/aria-label "Pen — 1 or P" / "قلم — 1 أو P" via new `library.draw.toolKeys`, `aria-keyshortcuts`, and both keys in the `hints.drawTools` InfoHint (EN/AR). Badges use Western digits in Arabic too, deliberately not `fmtNum`: they label a keycap like the Latin letter beside them, and Western digits are on every Arabic keyboard's number row while Arabic-Indic ones are only on some. Convention documented at the end of CODE_GUIDE.md. **Verified** (isolated: server/app.js on mongodb-memory-server :5461, Vite :5462, headless Chrome 155 over CDP, `Input.dispatchKeyEvent` with key + code): 50/50 — 1–4 from off and on; ladder 2,2,2; AZERTY `&`/`é`/Shift+1, Mac Arabic `١`/`٣`, Persian `۴`, Numpad3, US `!`; NumLock-off `ArrowLeft`/Numpad4 turns the page; Ctrl/Alt/Meta+1 off and on → nothing and not prevented; holding 1 / P (8 repeats) → one step; P/H/E/T plus `ح`/`ا` on KeyP/KeyH, letter ladder, 1-then-P same ladder; Escape peel; ArrowLeft while annotating; stroke → Ctrl+Z → Ctrl+Y; right-click while annotating opens verse actions; "123" into the page input (off and on) and "123١" into a text note insert and switch nothing. Toolbar screenshots EN/AR × light/dark checked. Lint 0, build OK, server 156/156. Not pushed. |
| 2026-10-14 | **Planning review: number shortcuts accepted; highlighter icon in progress** | — | 1–4 tool shortcuts (8d54961, bdb9794) ACCEPTED: 50/50 real key-event checks, 156/156 server tests, lint 0. Best catch of the round: with NumLock off, Numpad4 reports as ArrowLeft and Numpad3 as PageDown, so matching the numpad key code alone would have stolen two page-turn keys — the numpad only counts when it types a digit. All four session decisions endorsed: toolbar reordered pen/highlighter/eraser/text so position = number; `e.repeat` now ignored for P/H/E/T too (holding a key used to cycle the on/away/off ladder at key-repeat speed — effectively a bug); Arabic badges use Western digits because they label a physical key; the long active-tool tooltip is acceptable. Follow-up requested by the user: give the highlighter its own icon (it shared a pen-like glyph, `FiEdit3`, with the pen). The implementation session is doing it now (uncommitted at review time): `LuHighlighter` — Lucide is a Feather fork, so its stroke style matches `FiPenTool` and `FiType`. |
| 2026-10-20 | **Queued: timer, to-do list, verse search, recent pages** | — | Four prompts written, to run ONE AT A TIME (all edit Library.jsx), in the order timer → to-do (shares the timer’s spot) and search → recent pages (recent pages live in the search box’s empty state). Grounding: no guest storage exists yet (Public Library v2 undecided) and the Library is public, so client-only features (timer, search, recent) must work logged out, and the to-do list is account-synced with a localStorage store for guests; no local Quran TEXT exists (only structure + runtime per-page glyph data), so search needs a generated, committed, lazy-loaded index built from the same per-word data the mushaf renders, so a hit maps to exact word positions; the Dashboard already calls the daily plan "tasks", so the to-do list must be named distinctly; and the fit-to-window decision means no new widget may shrink the mushaf (measure before/after). Timer specced on wall-clock timestamps (background tabs throttle intervals), one shared state across Library and Dashboard surviving reloads, chime unlocked by the start click, notification permission only when its advanced option is enabled. Search specced with Arabic normalisation (tashkeel, alef/ya/ta-marbuta forms), reference and surah-name queries, an occurrence bar with next/previous across pages and a Done button. Recent pages specced with a dwell threshold so flipping, the scrubber and recitation auto-turns don’t flood the list. |
| 2026-10-20 | **Shared timer — stopwatch, countdown, clock (Library sidebar + Dashboard)** | `8054629` | **State:** ONE store outside React (`services/timerStore.js`; `context/TimerContext.jsx` exports only `TimerProvider`, mounted above the router; hooks in `hooks/useTimer.js`), persisted in localStorage (`timerState`, `timerSettings` — works logged out) and kept identical across tabs via the `storage` event. All maths wall-clock (`utils/timerCore.js`: a run is `{startedAt, accumulated}`, a countdown is a plan of focus/break phases), never tick counting; displays use `useSyncExternalStore` and re-render only when their text changes, so the Library never re-renders for the clock. **Phase end:** every tab reacts (aria-live, optional recitation pause); exactly ONE chimes — a Web Lock claim (`navigator.locks`, `ifAvailable`, held 60 s); a hidden tab waits 1.2 s so a visible one wins; an end found >30 s late (frozen / closed) is marked seen silently; one non-chained `setTimeout` aims at the boundary; `visibilitychange` / `resume` / `pageshow` refresh at once. **Chime:** Web Audio bell (`services/chime.js`; 3 strikes = end, 2 = phase), AudioContext created by the Start click and re-unlocked by the first click/key after a reload; separate from the recitation's `<audio>`. **UI** (`components/TimeTool.jsx`): mode switch, readout (`role=timer`; durations LTR, clock in locale order, Arabic-Indic digits in AR), Start/Pause/Resume/Reset; presets 5·10·15·25 + custom min:sec (any digit script; a half-typed 0:00 is held, not committed); end = amber pulsing 00:00 + “Time's up” + Dismiss / Restart, and the view switches to the timer. Advanced (open/closed persisted): chime on/off + volume + Test, intervals (focus → break × rounds; locked while a run exists), notification when the tab is hidden (permission requested ONLY when the option is turned on; a refusal leaves it off and says why), pause the recitation at the end of each focus period (Library only), 12/24 h, seconds, time in the tab title. **Library:** collapsible “Timer” row first in the memorization group (`components/ReaderTools.jsx` takes a LIST of tools — the to-do list becomes a tab, no new row; open state `readerTools`), collapsed = one line with the live time. **Indicator** (sidebar hidden + a running or just-ended timer/stopwatch): a 24 px tab hung 8 px under the sidebar handle, time turned sideways (IDE edge-stripe style, bottom-up on the left in EN, top-down on the right in AR); pressing it reopens the sidebar with the row open. Why there: the handle's strip is room already given to chrome beside the page, so it cannot reach a glyph at any width; it sits at the top, clear of the audio bar + zoom (bottom) and the edge arrows (mid-height). **Dashboard:** full-width card closing the stats bento; reads localStorage on first render (no request), so it lands at its final size. `toArabicDigits` moved to `utils/formatNumber.js` (re-exported by quranApi) so the provider doesn't hoist quranApi into the main chunk (main +15 KB / +5.6 KB gz: strings + store). **Verified** (isolated: server/app.js on mongodb-memory-server :5471, `vite build` + `vite preview` of this tree :5472 and of HEAD~ in a scratch worktree :5473, headless Chrome 155 over CDP, real mouse/keys, screenshots; 139/139 on the final build): mushaf canvas rects IDENTICAL before/after in 16 variants (1440×900 + 1920×1080 × single/spread × signed out/in; row collapsed / open / open + advanced, sidebar 1451 px tall; sidebar hidden with the indicator up); indicator 0 glyph hits, 24–517 px from the nearest glyph and no collision with handles / audio bar / edge arrows at 7 sizes (1024×768 spread to 390×844 touch) × EN/AR × 01:05 / 1:02:03, also scrolled to the bottom. Stopwatch started in the Library → navbar link → Dashboard shows the same run (00:03 = wall clock) → reload still correct; frozen 60 s (`Page.setWebLifecycleState`) → 01:06 vs 66 s 50 ms after resume; hidden behind another tab 60 s (a 250 ms interval ran 7×) → 02:07 vs 127 s 50 ms after coming back; typed 0:10 countdown with the recitation playing ended at 9.94 s: 00:00 pulsing + “Time's up” + aria-live, chime logged (6 oscillator starts, AudioContext `running`), recitation kept playing (5.9 → 7.4 s); with the option on it paused + toast; hidden at the end → notification 11.12 s after Start + chime from the background tab; visible → no notification; permission requested 0× on load / other toggles, 1× on enabling; two tabs: mode, duration, start, pause (in B → A paused at the same second), title prefix, ONE chime in total (A 6 / B 0), dismiss in B clears A; intervals 0:05 / 1 min × 2: phase chimes at 5.0 s and 65.0 s, end at 70.3 s, focus end paused the recitation; logged out: on /library, survives reload, indicator press reopens sidebar + row; Space / Enter on the buttons; “12” typed into the minutes field picks no annotation tool, “٣” parses as 3; Dashboard card first paint = final size, no layout shift touches it; EN/AR × light/dark × 1440 / 390 screenshots, no horizontal overflow, no console errors. Server 156/156, lint 0, build OK. **Fixed during verification:** a 0:00 half-typed in the custom field was dropped (made “0:10” into 10:10); a resumed-but-still-hidden page waited for its throttled tick; “Stopwatch” was cut short in the sidebar and the card. **Known limits:** a hidden tab's own DOM / tab title can lag while its timers are throttled (correct the moment it is shown); after a reload the chime needs one click or key press first (autoplay policy). **For the user to confirm:** default mode = countdown, 10 min; the view jumps to the timer when it ends; “pause the recitation” fires at the end of every focus period, not only the last; intervals use the countdown's duration as the focus length, breaks in whole minutes (1–120), no break after the last round; the Dashboard card sits in the stats block above the tasks (~110 px); the option to pause recitation is hidden on the Dashboard; indicator spot. Not pushed. |
| 2026-10-20 | **Personal to-do list — “My to-do” / “قائمتي” (Library tools tab + Dashboard card)** | `5dfe489` | **Naming:** never “tasks” (the Dashboard’s daily plan); its card sits in the stats block, apart from the plan’s tabs. **Server:** `models/Todo.js` { userId, text (trimmed 1–200), done, order, timestamps }, index { userId, order }; `routes/todoRoutes.js` (protected, `validate` type gates; new `stringArray` type) → `controllers/todoController.js`: GET, POST (appends at max+1), PUT /:id (text/done), DELETE /:id, PUT /reorder (the WHOLE list: unknown / foreign / malformed id → 404, missing or repeated → 400), plus two routes beyond the brief: DELETE /completed (one request, replies with what it removed and each one’s index) and POST /restore ({ text, done, index }[] — the Undo of a delete or a clear, inserted by ascending index, so the list comes back exactly). Cap 200 → 400 with `code: TODO_LIMIT`. 404 never 403; `serverError` helper. Account deletion also deletes the list. **Ordering decision:** full-list reorder, not fractional orders — ≤200 ids is a tiny payload, the server needs no gap/precision/renumber bookkeeping, and a reorder made on a list that changed on another device is refused whole (the client then re-reads) instead of half-applied; inserts by `/restore` renumber 0..n-1, deletes leave harmless gaps. **Client:** `services/todoBackends.js` — ONE interface, two backends: `serverBackend` (todosAPI) and `localBackend` (localStorage `guestTodos`, same shape, ObjectId-shaped stable ids, same 1–200 / cap rules; a restored item keeps its id). `hooks/useTodos.js` is the only code that looks at the session (no store at all until /auth/me settles, so a visitor never requests /api/todos). `services/todoStore.js` — one store per owner outside React (useSyncExternalStore), so Library and Dashboard share it and a revisit paints at once; optimistic with exact rollback: the confirmed list + a queue of pending changes replayed on top, sent one at a time; a failed change is dropped (only it rolls back), a toast shows and the list is re-read; temp ids map to real ones, rows keep a lifelong `key` (no remount / focus loss); queued reorders coalesce (4 × Alt+↓ → 2 requests). Re-reads on tab visibility (signed in) / the `storage` event (guest). **UI** (`components/TodoList.jsx`): Enter adds (blank does nothing), real checkbox, double-click or pencil to edit (Enter saves, Escape cancels, blur saves; focus returns to the pencil), × deletes with an Undo toast (bookmark Restore pattern), “Clear completed” + Undo, “N left”. Reorder: pointer drag on a grip (pointer capture; `touch-action: none` on the grip only, so the row still scrolls the page; rows slide to make room; Escape / pointercancel puts it back) + keyboard (↑/↓ on the grip, Alt+↑/↓ anywhere in the row, focus kept, aria-live “Moved to position 3 of 5”). Ticked items STAY PUT (the order is the reader’s; a jump would move the row from under the pointer; “Clear completed” tidies). Item text is `dir=auto` aligned to the UI side (an Arabic item in the EN UI orders right). Touch targets 32 px on coarse pointers. Guest note: “Saved in this browser only. Sign in…”. **Library:** a second tab in the timer’s row (`ReaderTools` now controlled: `readerToolsTab` persisted by Library); with the list showing, a running / just-ended timer stays on the row’s header line (`TimerSummary onlyLive`); the edge indicator and a countdown’s end switch back to the timer tab (not while typing in the list). **Dashboard:** the timer row splits 3/5 timer + 2/5 “My to-do” at lg+, stacked below; the card’s contents are absolutely placed, so its size never depends on them (lg: the row height, min 208 px; stacked: 240 px) and the list scrolls inside. **Verified** (isolated: server/app.js on mongodb-memory-server :5471 with the rate limiters in their test pass-through, `vite build` + `vite preview` :5472, HEAD build from `git archive` :5473, headless Chrome 155 over CDP, real mouse / touch (`Input.dispatchTouchEvent`, pointerType touch) / keys, screenshots; 72/72 checks): typing “sp1” + ArrowLeft in the field reaches no shortcut (control: “s” outside it hides the sidebar); 5 added by Enter; mouse drag 1→3, Escape mid-drag cancels, touch drag 5→1 with no scroll, a touch swipe on the text does not reorder; ↓ on the grip, Alt+↑ from the checkbox, 4× Alt+↓ (focus kept, announced); tick / untick; double-click edit + Enter, pencil + Escape (the reader ignored that Escape); delete + Undo back in place; clear 2 completed + Undo back in place and ticked — every step checked in the UI AND via GET /api/todos; navbar → Dashboard shows the same list, reload too; a second browser context (same user) sees it, its tick shows in the first after reload. Logged out: add / drag / keys / tick / delete + Undo (same id) / reload / a second tab follows; 0 /api/todos requests in the browser network log AND 0 lines in the server log; never sent to /login. Dashboard card: one size from first paint through a loading state held 1.5 s to loaded, never moves, no layout shift touches it or the timer. Mushaf `.mushaf-page` rects IDENTICAL to the HEAD build in 24 variants (1440×900 + 1920×1080 × single/spread × signed out/in × row collapsed / timer / to-do with 5 items). EN/AR × light/dark × 1440/390: no horizontal overflow, RTL mirrored; no console errors. Server 166/166 (+10), lint 0, build OK (main chunk +2.7 KB, the strings; the list rides in the chunk Library and Dashboard already share). **Fixed during verification:** the grip’s `preventDefault` also cancelled a mouse click’s focus, so ↑/↓ after grabbing did nothing (now focused by hand). **Not built (as asked):** guest → account import — Public Library v2 owns it; the local list is importable as-is (same fields, stable ObjectId-shaped ids, `order`). **Found, not fixed:** account deletion leaves the user’s Bookmarks and Annotations behind (pre-existing; Todos are now deleted). **For the user to confirm:** ticked items stay put; the Dashboard’s timer is now 3/5 wide beside the list at lg+ (the bento row grew from ~120 to 208 px); the two extra routes (/completed, /restore); a countdown’s end switches the row back to the timer tab. Not pushed. |
| 2026-10-21 | **Verse search — words, phrases, references + an occurrence bar (Library)** | `b9ea8ec` index, `624abb9` UI | **Data:** `server/seed/fetchSearchIndex.js` (one-time, like fetchQuranStructure) writes `client/public/data/search-index.json` — `verses[ord − 1]` = the verse's words joined by a pipe, from the word-level `text_imlaei` (modern spelling WITH tashkeel; `text_imlaei_simple` rejected: it spells the dagger alef out, "الرحمان"), `char_type word` only (medallions excluded), so word i is the glyph tagged `data-word-position` i + 1. **Alignment checked, not assumed:** the generator reads /verses/by_page with the reader's exact word fields for all 604 pages plus /by_chapter for the text and fails unless every verse's positions agree, run 1..n with the medallion at n + 1, no verse straddles and the page matches quranStructure.json — 6236 verses / 77,429 words, 0 mismatches. In the browser: 25 pages (1, 2, 3, 16, 50, 106, 282, 312, 440, 443 [the line-corrected word], 453, 467, 518, 564, 577, 582, 600, 603, 604 + 6 random; 331 verses / 2,746 words) DOM words = index words; muqatta'at land on their glyph (الم → 2:1 word 1, عسق → 42:2 word 1); "يا أيها" is ONE Uthmani word (2:104 position 1), so a phrase can start or end inside a word and the whole word is tinted. Size 1,325,009 B raw, 263 KB gzip as served, 176 KB brotli; fetched only when search first opens (VerseSearch chunk 16.9 KB / 6.7 KB gz, lazy; main +6 KB = the strings). **Matching** (`utils/quranSearchQuery.js`, `services/quranSearch.js`), the SAME normalisation on index and query: NFC; strip U+064B–065F tashkeel (incl. the combining hamza), U+0670 dagger alef, U+0610–061A, U+06D6–06ED (waqf signs, small letters, ۞, ۩), U+08D3–08FF, tatweel, zero-width / bidi marks; أ إ آ ٱ ٲ ٳ → ا; ؤ ئ ء → ء (seat variants meet: مسؤول = مَسْئُولًا); ى ی → ي; ة → ه; ک → ك; Uthmani وٰ → ا (never occurs in the index, so a pasted ٱلصَّلَوٰة finds الصلاة); a free hamza is KEPT (dropping it would make ماء = ما). Consecutive words inside ONE verse (never across ayahs), whole words except the LAST, which matches as a prefix while typing (so "الم" also finds المستقيم, "شيء" includes شيئا); one-letter queries are refused. **Counts are occurrences** (a verse matching twice = 2): header "45 occurrences in 45 verses", ×2 badge on a row. Timing: index build 150–300 ms, async in 250-verse steps (scheduler.yield) → 0 long tasks in 8 fresh-profile runs (load + build and typing phases); a keystroke's search 0.1–1.6 ms in Node, 2.4–5 ms on the first run in Chrome → no Web Worker. **Jumps:** 2:255 / 2.255 / "2 255" / Arabic-Indic digits; name + ayah either way round ("البقرة 255", "Al-Baqarah 255", "سورة البقرة آية 255"); surah names in Arabic (with or without ال) or Latin, squashed (o→u, e→i, q→k, aw→au, doubled letters, final h, the article) plus an alias list (Yaseen, Taubah, Ali Imran, Bani Israil, Mariam, اللهب…; aliases match whole only, so "الله" doesn't suggest Al-Masad); page / صفحة / ص / p50, juz / جزء, hizb / حزب; a bare number offers page N and surah N; "ص 50" offers page 50 and 38:50. **UI** (`components/VerseSearch.jsx`): a combobox dialog opened by a Search button in the sidebar's page-navigation heading (negative margin, so the row keeps its height), "/" (the physical Slash key too — it types ظ on the Arabic layout; `shortcutKeys.js` gained punctuation) or Ctrl+K, never while typing. Groups "Go to" (jumps) and "Verses" (surah ayah · p. N, a Scheherazade snippet with tashkeel, a phrase marked as one run, ±6 words around the hits in a long verse). Default suggestion = the first VERSE when there is one (so الرحمن opens on 1:1; the surah jump is one ↑ away), else the first jump; ↑/↓ wrap, Enter, Escape; 30 rows + "show more"; 120 ms debounce; rows below the fold use `content-visibility: auto`. With nothing typed the box shows an empty-state block (`data-search-empty`, `emptyState` prop) — the slot for Recent pages. **Landing:** a quiet select (popover folded) through the existing pendingSelect / selectTurn hand-over; the spread snaps to the page's pair. **Hit tint:** orange, the one hue nothing else uses (greens = selection / recitation, indigo = range, yellow / green / blue / pink = highlights, red = hard): every hit light, the current one deeper with a dark inset rule, a phrase one run; never saved. **Occurrence bar** (`components/SearchFindBar.jsx`) takes over the NAVBAR'S BAND while it is up (fixed, 72 px, over the navbar): the one strip the fit-to-window budget already reserves, so it can't cover a glyph the navbar wouldn't and can't move or shrink the page, and it is nowhere near the audio bar, zoom, edge arrows or timer indicator. Query chip (reopens the box), then [‹ next] n / N [prev ›] in book order (dir=ltr: LEFT = next in EN and AR, like the pager), then Done. The bar takes focus on a pick: Enter / Shift+Enter; F3 / Shift+F3 work from anywhere while it is up; Escape (first in the reader's Escape ladder) = Done → tints cleared, the verse stays selected. Wraps at both ends. The current hit is scrolled into view between the bar and the audio bar (the window when fitted — on a phone the page sits under the sidebar; the page's scroller when zoomed). **Verified** (isolated: server/app.js on mongodb-memory-server :5471, `vite build` + `vite preview` :5472, HEAD build :5473, headless Chrome 155 over CDP, real keys / mouse / touch, screenshots; 109/109 on the final build): "/" → الرحمن → 45 occurrences in 45 verses → Enter → p. 1, 1:1 word 3 tinted, bar focused at 1 / 45 → Enter ×3 crosses p. 1 → 24 → 293 → Shift+Enter → 3 / 45; يا أيها الذين آمنوا 89 / 89 → 2:104 words 1–3 as one run; with tashkeel, without, and an Uthmani paste all equal; 2:255, البقرة 255, Al-Baqarah 255, ٢:٢٥٥ → p. 42 with 2:255 selected; Al-Kahf, kahf → p. 293, 18:1; page 50, صفحة 50, juz 30, جزء 30; no results (Latin and Arabic), the one-letter hint; الله 2162 occurrences in 1573 verses, show more +30; keyboard only: Ctrl+K ↓↓ Enter, F3, Shift+F3, F3 with focus elsewhere, Escape; "/" in the page field just types; wrap 1 → 45; mouse arrows; the chip reopens the box with the query and closing it returns focus to the bar; zoomed, the hit is panned clear of the audio bar; 0 requests to the API, the index fetched once per page load. Mushaf `.mushaf-page` rects IDENTICAL to the HEAD build with the bar up in 8 variants (1440×900 / 1920×1080 × single / spread × signed out / in); the bar over 0 glyphs. EN / AR × light / dark at 1440 and 390×844 touch: RTL, "٣ / ٤٥" in Arabic-Indic digits, left arrow = next, a tapped result scrolls its hit between the bar and the audio bar, no horizontal overflow, no console errors. Server 166/166, lint 0, build OK. **Fixed during verification:** zoomed, the reveal could leave the hit under the audio bar; alias prefixes suggested Al-Masad for "الله"; a cold first render of the results was one 52 ms task (content-visibility). **Known limits:** no clitic stripping ("رحمة" doesn't find "برحمة"); a typed "الرحمان" (spelled-out alef) or the Uthmani "يٰأيها" doesn't match; phrases never cross verses. **For the user to confirm:** the bar replaces the navbar while it is up (find-in-page style) rather than floating over the reading area; last-word prefix matching (counts include longer words); the default suggestion is the first verse even when a surah has that name; next / previous wrap around; Escape ends the search before it closes the tafsir. Not pushed. |
| 2026-10-21 | **Recent pages — what the reader actually read (search box + sidebar chips)** | `e71c270` | **What counts** (`hooks/useRecentPageTracker.js`): a page — or a spread, as ONE entry — is read after 8 s of VISIBLE time (hidden-tab time is banked, not counted), or at once on an interaction from the reader's own input: a word click / right-click / long press, a range pick, a self-test reveal, the popover's verse stepping, any annotation (highlight / hard / note / ink / text note), a bookmark, the memorized tick. Never from a selection the app makes itself (recitation follow-along, search landing). **Recitation:** while it plays AND the page follows it, nothing counts by time — start page included; the page where listening STOPS is recorded (any isPlaying true→false: pause, range end, error, the timer's pause). A hand turn while it plays hands the pages back: the page left counts if its time was up, and the new pages count by dwell as normal. **Store** (`services/recentPages.js`): localStorage `recentPages` = `[{ pages, page, at }]`, newest first, cap 12; a new entry replaces every older entry sharing a page (single 22 then spread 21–22 → one entry; reading 22 alone again replaces the spread); every write re-reads storage first so two tabs don't undo each other; sanitised on read; `storage` event → every tab live. Works signed out and signed in with 0 API requests; cross-device sync out of scope (would need the account). **`lastMushafPage` decision:** unchanged — it still follows EVERY turn (the Library reopens where the reader was, as before); recent[0] equals it whenever the page on screen has counted as read, and a page only flipped to moves `lastMushafPage` but never the list. **UI:** search box empty state = “Recent pages” group (page, top-of-page surah, relative time, ×), options of the same combobox: nothing picked until ↓ (newest) / ↑ (oldest), Enter opens, Delete removes the picked row, “Clear history” + an Undo toast, “Kept in this browser.” caption, `Del remove` key hint; the box now opens EMPTY unless an occurrence bar is up (the chip still reopens on its query), so “/ ↓ Enter” = back to the last page read. Sidebar: one 28 px row under the go-to field — clock icon, the last 4 as chips (3 when one is a spread, so it stays one line), “More” = the box opened empty; hidden when there is nothing recent. Chips have no × (mis-tap risk at that size; removal lives in the full list). The current page/spread is excluded from both. Relative time: just now / min / hours / days / weeks, then a short date; Arabic via i18next plural forms (منذ دقيقتين, منذ ٣ دقائق, منذ ١١ دقيقة, منذ ساعتين, منذ يوم…) with Arabic-Indic digits, date via `ar-u-nu-arab`. The 30 s clock lives in the list components (`hooks/useRecentPages.js`), so the Library never re-renders for it. **Verified** (isolated: server/app.js on mongodb-memory-server :5471 with the limiters in test pass-through, `vite build` + `vite preview` of this tree :5472 and of HEAD (`git archive`) :5473, headless Chrome over CDP, real keys / mouse / touch, screenshots; 99 checks passed — 3 more failed on the first run because the script's two-tab step expected the wrong list head and its ArrowLeft didn't reach the backgrounded tab; that step was redone as its own run, 7/7): 10 ArrowLeft flips in 3.8 s → 0 entries, `lastMushafPage` = 110; 7 s on 110 → none, 8.5 s → [110], recent[0] = lastMushafPage; 8.5 s on 111 → 111,110; 2 s on 112 → none, a word click → 112 at once; chips exclude the current page, a chip opens its page, revisiting 110 → top; 13 click-reads → capped at 12, newest first, timestamps descending; box lists 11 (current excluded), row “Page 122 · Al-Ma'idah · just now”; “/” ↓ Enter → page 122; ↑ from nothing → oldest; Delete and × each remove one (focus stays in the box); Clear → empty + tips, Undo → exact list back; reload keeps it and opens on lastMushafPage; two tabs: each sees the other's reads, removals and Clear history live, each excludes its own page. Recitation: started on 602 with the bar's ◀ (last verse, no selection) → auto-turns 602 → 603 (101 s on screen while playing) → 604, 0 entries throughout and 3 s into 604; pause → exactly [604]; resume, ArrowRight by hand to 603 while it plays → sound continues, 603 recorded by dwell. Spread: single 22, then 2 pages → one “21-22” entry replacing 22; chip “21–22”, row capped at 3 chips, one line; box row “Pages 21–22”, Enter → the pair. Mushaf `.mushaf-page` rects IDENTICAL to HEAD with the chips showing in 8 variants (1440×900 / 1920×1080 × single / spread × signed out / in — signed-in state confirmed); at 390×844 touch the page SIZE is identical and it sits 36 px lower (the sidebar is stacked above it there). EN / AR × light / dark at 1440 and 390: RTL, chips ٥٠ · ١١ · ٢٩١ · ٦٠٤, “الصفحتان ٤٤٠–٤٤١”, one-line row, no horizontal overflow; tap a chip / tap More on a phone; signed in: recorded with 0 API requests; no console errors. Server 166/166, lint 0, build OK (main chunk +2.4 KB, the strings). **Found, not fixed (pre-existing on HEAD):** at 390 px in Arabic the sidebar's edge tabs overlap the “صفحة” label and the Search button. **For the user to confirm:** 8 s threshold; start-of-playback page not recorded unless listening stops there; the box opening empty (not on the last query) when no occurrence bar is up; chips without ×; no confirm on Clear history (Undo toast instead); “1 day ago” rather than “yesterday”. Not pushed. |
| 2026-10-21 | **Planning review: timer, to-do, search, recent pages — ACCEPTED** | `8054629` `5dfe489` `b9ea8ec` `624abb9` `e71c270` (+ log rows) | All four rounds committed locally by their sessions (10 commits, tree clean, no stray harness files). Planning session verified independently: **166/166** server tests (was 156), client lint **0**, build clean (main chunk 499 KB / 161 KB gzip, Library chunk 194 KB / 61 KB gzip), commit messages clean of AI mentions, the new `/api/todos` routes protected and type-gated, the search index lazy-loaded from `client/public/data/search-index.json` (1.3 MB raw). The user reports all four work but **need a lot of UI/UX edits — a dedicated whole-project UI/UX session is planned** (to come after the expert audit). |
| 2026-10-21 | **BUG: account deletion leaves personal data behind** | — | Found by the planning session’s spot-check: `deleteAccount` (authController.js ~442-444) deletes UserProgress, Todo and the User, but **NOT Bookmark or Annotation** — every highlight, note, hard flag and free-ink drawing survives the account, orphaned in the database. A privacy / data-lifecycle defect that predates the latest rounds (bookmarks Stage 1.7, annotations Stage 6). Also: the leaderboard cache can show a deleted user for up to its TTL. Left for the expert audit to find and rank independently, then fix. |
| 2026-10-21 | **Queued: full expert audit (read-only)** | — | A deep, read-only audit prompt was written: every file reviewed (with a coverage manifest proving it), an independent first pass before reading this log, then reconciliation against settled decisions; security (authN/authZ/IDOR on every route, injection, XSS from third-party tafsir and chatbot output, open redirect via `returnTo`, CSP, secrets incl. git history, dependencies and supply chain), privacy and data lifecycle, performance (bundle, Library.jsx render cost, LCP ~5.1 s, Mongo query plans), reliability and the six external content/audio vendors, data integrity, maintainability, testing, accessibility (WCAG 2.2 AA), i18n, SEO, DevOps (CI, deploys, backups, monitoring), and licensing of fonts/audio/tafsir. Output: `docs/AUDIT_2026-10.md` with severity-ranked, evidence-cited findings and a roadmap; dynamic checks only on an isolated stack. Verified-to-exist skills recommended: Trail of Bits `trailofbits/skills` (audit-context-building, insecure-defaults, sharp-edges, static-analysis, supply-chain-risk-auditor, fp-check, variant-analysis), Anthropic `webapp-testing`, and the claude-code `pr-review-toolkit` (silent-failure-hunter) — no public accessibility or performance skill was found, so those use Lighthouse and axe-core. |
| 2026-10-21 | **Audit plugins installed (local scope)** | — | At the user’s request the planning session installed, via `claude plugin install --scope local` (stored in the git-ignored `.claude/settings.local.json`, so nothing enters the repo or other projects): Trail of Bits `audit-context-building`, `insecure-defaults`, `sharp-edges`, `static-analysis`, `supply-chain-risk-auditor`, `variant-analysis`, `fp-check`; Anthropic official `pr-review-toolkit` and `claude-security`. Every plugin’s contents were inspected first: only two carry hooks — `claude-security` (narrow: its own menu banner, local usage counts after its own scripts, a tip after `git push`; Python stdlib only, no network) and `fp-check` (an LLM prompt hook on EVERY Stop/SubagentStop in the project), so **fp-check is installed DISABLED** — enable it only for the audit session (`claude plugin enable fp-check@trailofbits --scope local`) and disable it after. `webapp-testing` was skipped (it only ships inside `example-skills` with 11 unrelated skills). Neither Semgrep nor CodeQL is installed, so `static-analysis` will fall back to manual review unless the user adds one. |
| 2026-10-21 | **Expert audit delivered (read-only) — `docs/AUDIT_2026-10.md`** | `64451b1` | **Verdict: not launch-ready yet; the gap is specific.** 53 grouped findings — 1 Critical · 6 High · 22 Medium · 18 Low · 6 Info — every High/Critical through the fp-check gate. **C-01 (Critical):** the User model's email regex backtracks exponentially; on the isolated stack one 33-character email froze the whole API for 4.7 s (×4 per 2 more characters), unauthenticated. **High:** H-01 account deletion leaves Annotations + Bookmarks and the cached leaderboard row (confirmed, as logged above); H-02 a failed `/progress/all` then tick + untick wiped 40 → 0 memorized pages (whole-set replace on stale state; Settings-editor and ink variants); H-03 half-page "Mark All" / "Want more" record the whole page; H-04 fonts + search index in a public repo with no licence or attribution, unpermissioned runtime APIs; H-05 no privacy policy or terms; H-06 no password reset. Confirmed clean: IDOR sweep of every `:id` route, NoSQL-injection gate, no XSS sinks, `returnTo` in a real browser, public Library makes no API calls. Measured: 166/166 server tests, 89.9 % line coverage; Lighthouse mobile 91–93 on public pages, 54–82 on app pages (`/library` 54–56, LCP ~4.5 s); axe contrast failures on every app page. Roadmap (Now / Next / Later + quick wins) and 8 work packages (WP-1 auth hardening … WP-8 accessibility + refactor) in the report; coverage manifest, tool outputs and area notes in `docs/audit/`. Isolated stack only, harness deleted; the claude-security scan pipeline (no Workflow tool), Semgrep and CodeQL were unavailable, so the security pass was manual. |
| 2026-10-26 | **Queued: implement every decision-free audit finding** | — | Planning session triaged docs/AUDIT_2026-10.md (1 Critical, 6 High, 22 Medium, 18 Low) into DO NOW (no owner decision) and NEEDS THE OWNER. Do now, in 12 committed and logged phases: auth & abuse hardening (C-01 ReDoS, M-02, M-04, L-01–L-05, chat max_tokens/timeout and an env-configurable budget, configurable trust proxy + per-account login backoff); server data lifecycle (H-01 cascade + leaderboard cache + a model-registry test, M-01 with a cleanup script that is WRITTEN BUT NEVER RUN against Atlas, a precondition on PUT /progress/memorized, H-03 server side, L-10, L-11 bug parts, L-13 seed guard, M-22); client data safety (H-02 a–e, H-03 client, M-03, M-08, L-06, L-07); tests & CI (GitHub Actions, deletion-cascade / 401 / negative-path / clock-injected streak tests, Vitest + RTL, Playwright flows); edge & delivery (M-05 headers + CSP Report-Only, L-12, non-breaking M-17, M-21 code parts, M-09 locale splitting / recharts / Google-Fonts self-hosting); reliability (M-14 minus Sentry, L-15); correctness & content (M-13, L-14, L-17, L-18 atomicity, L-08, L-09); functional accessibility (M-12); password reset PRE-BUILT provider-agnostic and DISABLED until an email provider is configured; privacy prep (the user’s name out of the Groq prompt, DRAFT policy/terms for review, not published); Library render cost + limited extractions (M-10, M-20) last; docs-vs-code corrections. NEEDS THE OWNER (not touched): H-04 licensing (repo visibility, fonts, permission emails, LICENSE), publishing the H-05 policy/terms + Groq ZDR, H-06 provider choice and whether to require email verification, M-07 demo account, M-11 colour contrast (moved to the UI/UX session), M-16 time zones, M-18 glyph precompute, M-19 storage budgets, L-16 transcripts + personal email, I-02, Sentry DSN, Atlas backups/alerts, verifying req.ip in production, running any cleanup on real data, the onboarding 2.5 s wait, a breached-password check, the chat budget numbers. Parallel work allowed only in isolated git worktrees, merged back with full re-verification. fp-check disabled again after the audit. |

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
| 8d | Per-ayah tafsir source swap, tafsir persistence, both-page annotation, drag-select verse ranges, nested repeat | M |
| 8e | Mushaf zoom: pointer-scoped Ctrl+wheel zoom, zoom affordance, scroll/pan when zoomed | M |
| 8f | Audio fallback source for files the primary CDN cannot serve | S–M |
| 9b | Lint cleanup (split context hooks, real hook-dep fixes) + Firefox/WebKit smoke | S |
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

> **Superseded 2026-09-22** — this stage is Phase 4 of the *Intensive session — 2026-09-22* prompt, which refreshes it for the app as it is now. The original prompt below is kept as history.

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

### Intensive session — 2026-09-22 (Open queue items 1–7)

**Goal:** clear the prepared queue in one long session, phase by phase in priority
order, each phase committed and logged before the next begins: zoom (8e) → audio
fallback (8f) → product-aware chatbot (8.5) → public Library (1.9) → UX polish (9,
refreshed) → lint cleanup (9b) → cross-browser smoke.

**Prompt for Claude Code:**

```
You are an implementation session on the Quran Tracker project — a MERN Quran
memorization app (a defended graduation project, now in active product
development). This is a LONG, MULTI-PHASE session. Before anything else read
docs/IMPROVEMENT_PLAN.md — the "Current status" and "Open queue" blocks at the top
of the Progress log are the authoritative state, and the table under them is the
project's history — then docs/CODE_GUIDE.md and CLAUDE.md.

================================================================================
HOW THIS SESSION IS ORGANISED
================================================================================
Seven phases, in PRIORITY order. For EACH phase: implement -> verify -> commit ->
log -> report, and only then start the next. Stop only at a phase boundary: every
finished phase must stand on its own if the session ends there, so never leave a
phase half-done in the tree. If a phase hits a real blocker (a source that does not
exist, a call only the user can make), write it up, move on to the next phase, and
list it in the final report — don't stall the whole session on one item.

================================================================================
HARD RULES — NON-NEGOTIABLE
================================================================================
1. NEVER PUSH. Commit locally as each phase finishes; the user reviews and pushes.
   No force-push, no rebase, no squashing existing history.
2. STEP 0: run `git status` and `git log origin/main..HEAD`. The tree should be
   clean with 0 unpushed commits. If anything is uncommitted, STOP and report it
   rather than guessing whose work it is.
3. COMMIT MESSAGES: first person, as if the developer wrote the code. NEVER mention
   Claude, AI or any assistant, and NEVER add a Co-Authored-By or any other AI
   attribution trailer. This is a hard rule in the tracked CLAUDE.md, and history
   was rewritten once specifically to strip such a trailer — if a tool or a default
   tells you to add one, the project rule wins. One idea per commit.
4. THE PLAN DOC IS A LOG. After each phase, APPEND one row to the Progress-log table
   at the BOTTOM of docs/IMPROVEMENT_PLAN.md — date, phase, commit hashes, what
   changed, what you measured, what is left open — and tick that item in the
   "Open queue" block. Never edit or reorder existing rows; they are history.
   Commit the doc on its own, separately from code.
5. VERIFICATION BAR — introduced after two incidents where sessions overstated
   their verification. "Verified in the browser" counts as UNVERIFIED unless you
   describe the run concretely. UI work needs an ISOLATED stack: require
   server/app.js directly against mongodb-memory-server on a spare port, a real Vite
   dev server pointed at it (VITE_API_URL), headless Chrome over CDP, every
   interaction a real Input.dispatchMouseEvent / dispatchKeyEvent /
   dispatchTouchEvent, and screenshots. Force failures with Fetch interception
   instead of waiting for them. PRODUCTION ATLAS MUST NEVER BE TOUCHED — never
   require server.js, the only file that reads MONGODB_URI. Delete harness files
   before committing.
6. CHECKS, every phase: `cd server && npm test` (120/120 today — keep it green, and
   add tests for new server behaviour) and `cd client && npm run lint && npm run
   build`. Lint currently reports 5 KNOWN problems (3 react-refresh errors in
   AuthContext/ThemeContext/ToastContext, 2 hook-dep warnings in Dashboard and
   Progress). Phase 6 removes them; until then just don't add any. Lint includes
   react/jsx-no-undef.

================================================================================
PROJECT FACTS YOU MUST NOT BREAK
================================================================================
- The mushaf is ALWAYS an RTL book: forward/next = LEFTWARD, in both UI languages.
- It is the exact Madinah mushaf, rendered with per-page QCF glyph fonts. Each page
  is a fixed 576x852 frame with a 524x800 text area on a 15-slot grid, scaled
  UNIFORMLY. Every overlay (free ink, margin ornaments, text notes, highlight
  bands) stores its coordinates in that fixed space. That invariant is what makes
  everything scale — PROTECT IT, and prove it by measuring an overlay's bounding
  box as a FRACTION of the canvas at several sizes (identical to three decimals).
- The page FITS THE WINDOW by default. Settled 2026-09-08 after "Option D" was
  measured and rejected — it covered glyphs below ~720px of viewport and made the
  page card's own controls unclickable. Zoom (Phase 1) is an opt-in escape from
  that rule, never a new default.
- The verse is the atom of what is memorized (UserProgress.segments); the page is
  the scheduling atom. Annotations anchor to verseKey + word position, never pixels.
- Keyboard shortcuts match the PHYSICAL key through the helper in
  client/src/utils/shortcutKeys.js (e.code OR e.key). A bare e.key === 'x' dies on
  an Arabic keyboard layout. The convention is written at the end of CODE_GUIDE.md.
- Every new string goes in BOTH client/src/locales/en.json and ar.json. Check RTL
  and dark mode on everything you touch.

================================================================================
PHASE 1 — MUSHAF ZOOM  (Stage 8e, highest priority)
================================================================================
Why: the mushaf reads too small on small screens.
Goal: Ctrl+wheel — and trackpad pinch, which browsers deliver as a wheel event with
ctrlKey set — while the POINTER IS OVER THE MUSHAF zooms the MUSHAF ONLY (bigger
than the window is fine; the user then scrolls/pans). The same gesture ANYWHERE
ELSE zooms the whole site exactly as the browser does today. Plus a discoverable
zoom control on the page.

1a. FIX THIS FIRST — a live bug sitting in the way. client/src/hooks/useIdleHide.js
    (~lines 81-95) calls preventDefault on every downward wheel event and never
    checks ctrlKey or metaKey. So inside the Library reader, Ctrl+wheel browser
    zoom is hijacked TODAY: it hides the navbar instead of zooming. Make that handler
    ignore any wheel event carrying ctrlKey or metaKey. It is a real bug on its own —
    fix it and say so.

1b. HOW TO SCALE — read this before coding. The page's size comes from a
    height-derived max-width cap in client/src/index.css (~lines 137-147):
      --mushaf-avail-h: calc(100vh - var(--mushaf-chrome));
      .mushaf-page-cap   { max-width: min(920px,  calc(var(--mushaf-avail-h) * 0.8245 + 32px)); }
      .mushaf-spread-cap { max-width: min(1560px, calc((var(--mushaf-avail-h) * 0.8245 + 32px) * 2 + 12px)); }
    Implement zoom as a MULTIPLIER ON THAT CAP — for example a --mushaf-zoom custom
    property folded into those calc()s. Do NOT wrap the reader in transform: scale().
    Word taps, annotate-mode drawing, drag-select verse ranges and edge-click page
    turns all hit-test against real element geometry, and a transform wrapper forces
    you to un-transform pointer coordinates in every one of those paths. Going
    through the cap keeps layout real, keeps hit-testing native, and keeps the
    524x800 overlay space true for free.

1c. BEHAVIOUR
    - Scope strictly by pointer position. Never install a global zoom trap.
    - Zoom TO THE CURSOR: the point under the pointer stays under it while the page
      scales (adjust the scroll offsets by the scale delta, the way a map does).
    - .mushaf-viewport has no overflow rule today — give it a real scroll/pan
      container. Panning must not collide with drag-select or annotate drawing;
      choose a scheme (scrollbars, wheel-scroll, space-drag, …) and justify it.
    - Bounds: minimum = fit (smaller has no purpose); maximum around 300% (justify
      the number). One obvious reset-to-fit. Persist the level in localStorage.
    - A small zoom control on or near the page (a magnifier revealing +/- and
      reset, or similar). It must not crowd the pencil, the eye or the footer tick,
      and must never cover glyphs. Tooltip + aria-label in both locales, RTL-correct.

1d. EDGE CASES — handle each, and report on each:
    - Two-page spread: both pages scale together, pan horizontally, RTL order intact.
    - Page turn while zoomed: keep the zoom level; state what happens to the scroll
      position (top of the new page is the sane default).
    - Tafsir panel docked, sidebar open, and RESIZING the tafsir panel while zoomed.
    - Annotate mode: strokes land exactly under the pointer at every zoom level, and
      saved ink reloads in place after a zoom change AND after a full reload.
    - Drag-select ranges, self-test drag-to-reveal, edge-click turns, swipe turns:
      none may break or trigger by accident while zoomed or panning.
    - Window resize while zoomed: re-clamp so the user can never be stranded.
    - TOUCH: do NOT intercept native pinch — it is fragile across engines and native
      pinch already works on phones. Give touch users the +/- controls instead.
    - KEYBOARD: leave Ctrl +/-/0 as browser zoom, site-wide. Never trap it — people
      rely on browser zoom for accessibility.
    - prefers-reduced-motion: no animated zoom easing.
    - Performance: the per-page QCF fonts are large; zooming must not refetch them
      or cause visible jank, and rapid wheel zooming must stay smooth.

1e. PROVE: the ctrlKey bug is fixed (browser zoom works again outside the mushaf);
    pointer-scoped zoom works both ways; zoom-to-cursor anchoring holds; the overlay
    invariant, measured as canvas fractions, across at least three zoom levels; a
    stroke drawn while zoomed lands under the pointer and survives a reload; and the
    behaviour at a SMALL viewport — that is the whole reason for this feature.

================================================================================
PHASE 2 — AUDIO FALLBACK SOURCE
================================================================================
Background (measured 2026-09-12 — read that Progress-log row): the
recitation-stalling bug is FIXED. There is per-buffer {ord, status}, a swap happens
only into a 'ready' buffer, both elements are retried, a 2.5s stall watchdog runs,
and a blind no-cors fetch warms the CDN edge 3 verses ahead. What is NOT fixable
client-side: cdn.islamic.network has files it cannot serve at all right now —
global ayahs 5944, 5953 and 5954 stayed 502 across 10 attempts. Today those end,
correctly, at the visible error. Give them a way to play.

2a. Add a SECONDARY audio source, used ONLY once the primary has exhausted its
    active retry budget for a verse. The primary stays first for every request.
2b. DISCOVER AND VERIFY BEFORE WIRING — the project's "verified 200 first"
    convention (see the comments above TAFSIR_EDITIONS in quranApi.js). Candidates
    to test, not assume: everyayah.com per-ayah MP3s, and quran.com's recitation
    audio via api.quran.com. For each one: does it cover all five reciters in
    RECITERS (ar.alafasy, ar.husary, ar.minshawi, ar.hudhaify, ar.muhammadayyoub)?
    Is it the SAME recitation — same qari, same riwaya, comparable bitrate — rather
    than a different recording passed off as the same one? Does an <audio> element
    play it cross-origin? Test the three stuck ayahs above AND several ordinary ones.
2c. Addressing differs by source: the primary uses the GLOBAL ayah number, while
    everyayah uses a zero-padded surah+ayah file name (SSSAAA) under per-reciter
    folder names. Build an explicit per-reciter mapping. A reciter with no verified
    fallback simply keeps today's behaviour.
2d. Keep everything the stall fix established — the gapless ping-pong swap,
    readiness tracking, the split retry budgets, the watchdog, the warm-up. The
    fallback plugs in where the active budget runs out; do not restructure the
    playback engine.
2e. PROVE it with forced failures (Fetch interception returning 502 for the primary):
    playback falls through to the fallback and keeps going; the gapless handover is
    unchanged when nothing fails (baseline: +0.1ms at a verse repeat, ~57ms at a
    verse change); and a verse that fails on BOTH sources still ends at the visible
    error, never an infinite spinner. If no fallback is trustworthy for a reciter,
    say so plainly instead of wiring a doubtful one.

================================================================================
PHASE 3 — PRODUCT-AWARE CHATBOT  (Stage 8.5)
================================================================================
POST /api/chat (server/controllers/chatController.js, Groq-powered, rate-limited by
middleware/chatRateLimit.js) already injects a per-user summary built by
buildProgressSummary. The widget is client/src/components/Chatbot.jsx.

3a. FIX THE SUMMARY FIRST. It is an accepted limitation that turns into a visible
    bug the moment someone asks the bot "what should I do today?":
    buildProgressSummary (progressController.js ~line 261) still picks new pages
    with the WHOLE-PAGE nextUnmemorizedPages walker, while getTodayTasks uses the
    SEGMENT-AWARE nextNewItems (a partly memorized page serves its remainder first).
    So the bot can name a different next page than the dashboard shows. Make it use
    the same segment-aware logic, and add a server test proving the summary and
    GET /api/progress/today agree — for a half-page plan and for a partly memorized
    page.
3b. Knowledge base: server/chat/appGuide.md — concise, and ACCURATE TO THE APP AS IT
    IS NOW, which has changed a great deal since this stage was first planned: the
    unified Library reader (there has been no separate "memorize mode" since Stage
    1.8a), the self-test styles, the tafsir panel and its editions, annotations
    (highlights, notes, hard flags, free ink across a two-page spread), verse
    selection, drag-to-select a verse range, nested repeat, gapless audio,
    bookmarks, the docked panels and their edge handles, zoom (if Phase 1 landed),
    the leaderboard, editing progress on the Progress page, and the daily plan (new
    pages, cycle + recent review, off days, intensities, half-page plans,
    memorization direction). Include step-by-step answers for the common tasks.
    Keep it under ~1500 tokens — tighten the wording rather than truncating a topic.
    Load it at boot and inject it into the system prompt next to the summary.
3c. Deep links: the assistant may return internal app paths (/library?page=291,
    /settings?tab=memorization, …) and Chatbot.jsx renders them as react-router
    links, not full reloads. WHITELIST internal paths — never render an external
    URL as a link.
3d. Guardrails: app and how-to questions answered from the guide, personal
    questions from the summary, unrelated topics politely declined, and replies in
    the user's language (keep today's tone).
3e. 3-4 tappable starter chips driven by i18n strings in both locales. Note: the
    original plan listed "How do I use memorize mode?" — that mode no longer exists.
    Write chips for the app as it is.
3f. A server test that mocks the Groq client (no external calls) and asserts the
    system prompt contains BOTH the guide and the progress summary for an
    authenticated call.

================================================================================
PHASE 4 — PUBLIC LIBRARY  (Stage 1.9)
================================================================================
Anyone can read the mushaf, listen and open tafsir without an account; account
features degrade to a sign-in nudge.

4a. CRITICAL GOTCHA — read first. The Axios response interceptor in
    client/src/services/api.js CLEARS the token and HARD-REDIRECTS to /login on ANY
    401. So a single ungated protected request from a logged-out /library bounces
    the visitor straight to the login page. The gating must be airtight. Prove it
    by watching the network: ZERO requests to protected endpoints while logged out.
4b. Move /library out of ProtectedRoute in client/src/App.jsx.
4c. Many account features were added after this stage was first planned, so audit
    ALL of them, not just the original list: progress ticks, mark-verses, bookmarks,
    annotations (highlights, notes, hard flags, free ink, the annotation
    navigator), the hard-verses list, and anything that reads the user. Skip their
    API calls entirely when logged out, and replace the controls with ONE compact
    "Sign in to track your progress" nudge linking to /login with a returnTo that
    restores the exact page after login (add returnTo support to the login flow).
    Client-only features must keep working logged out: navigation, audio, tafsir,
    self-test, drag-select range playback, repeat, and zoom.
4d. The navbar on /library shows its public state (Login / Register) when logged
    out, like the landing page. The chatbot stays logged-in only (already true).
4e. Landing page: add a "Browse the Mushaf" link to /library.
4f. PROVE it logged out: the deep link /library?page=291 works; EN and AR; light and
    dark; mobile width; zero protected requests; and logging in from the nudge
    returns to the same page.

================================================================================
PHASE 5 — UX POLISH  (Stage 9, refreshed)
================================================================================
ALREADY DONE — do not redo: keyboard page turns, audio continuing across page
turns, drag-to-multi-select in Onboarding/Settings. The planning session audited
the rest on 2026-09-22; these are what remain:
5a. Scroll-to-top on route change — MISSING (nothing in the client does it today).
5b. Landing/About: a proper meta description, OpenGraph tags and a favicon set in
    client/index.html — only one relevant tag exists today.
5c. Focus-visible outlines in the brand colour for keyboard users — partially
    present; make it consistent across the whole app.
5d. Mushaf words reachable by screen readers — a coarse per-verse label ("surah X,
    ayah Y") is fine. It must not change glyph layout or disturb the 524x800
    overlay space.
5e. Dashboard: stable min-heights so the task list doesn't jump when the data
    arrives — check it under network throttling.
5f. Prefetch the next and previous page's data AND QCF font when a page finishes
    loading (today only playback triggers a page prefetch), so manual page turns
    feel instant. Mind the audio warm-up — don't let the two fight for bandwidth.
5g. Arabic i18n sweep: walk every page in Arabic and fix anything rendering in
    English or overflowing its box — Settings and Onboarding especially.
5h. NFR-01 (every page under 3s): npm run build, npm run preview, then Lighthouse on
    /, /dashboard and /library — report the scores BEFORE and AFTER this phase.

================================================================================
PHASE 6 — LINT CLEANUP  (make `npm run lint` exit 0)
================================================================================
6a. The 3 react-refresh/only-export-components ERRORS (AuthContext, ThemeContext,
    ToastContext) mean `npm run lint` exits non-zero at HEAD. Split each context
    file so it exports only components — move the hooks (useAuth / useTheme /
    useToast) into their own modules — and update every import. Mechanical but
    wide, so afterwards run the build and a browser smoke of login, the theme
    toggle and a toast.
6b. The 2 hook-dep WARNINGS: Dashboard (~line 369, missing showToast and t) and
    Progress. The Progress one is a REAL BUG, not noise: the chartData memo reads
    i18n.language for its date labels but doesn't list it as a dependency, so
    switching language leaves the chart in the old language until the data
    reloads. Fix both properly — don't silence them.
6c. The annotation navigator list has no icon for the text-note kind (a known
    cosmetic gap) — fold it in here.
6d. Goal: `npm run lint` reports 0 problems. Update CODE_GUIDE.md if any hook import
    paths change.

================================================================================
PHASE 7 — CROSS-BROWSER SMOKE  (NFR-02, optional)
================================================================================
Nothing has ever been tested outside Chrome, and the reader leans on exactly the
APIs where engines differ: pointer capture, non-passive wheel and touchmove
handlers, media-element events, CSS dvh units. Run a smoke pass of the core reader
flows in Firefox and in WebKit (Safari's engine) — Playwright's bundled browsers
are the practical route — covering page turns, verse selection, drag-select,
annotate-then-reload, audio play and advance, the tafsir panel, and zoom. Edge is
Chromium and low-risk. If those browsers can't be installed here, say so plainly;
never claim a pass you did not run.

================================================================================
FINAL REPORT
================================================================================
For each phase: what changed, file by file; commit hashes; test, lint and build
results; and the concrete browser verification (ports, what you clicked,
screenshots, console errors). Then: every decision you want the user to confirm,
anything you skipped and why, and the new "Open queue" state.
Local commits only — DO NOT PUSH.
```

---

### Stage 8.5 — Product-aware chatbot

> **Superseded 2026-09-22** — this stage is Phase 3 of the *Intensive session — 2026-09-22* prompt above, which refreshes it for the app as it is now (the original asked for a "memorize mode" chip; that mode no longer exists). The original prompt below is kept as history.

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

> **Superseded 2026-09-22** — this stage is Phase 5 of the *Intensive session — 2026-09-22* prompt, which refreshes it for the app as it is now. The original prompt below is kept as history.

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
