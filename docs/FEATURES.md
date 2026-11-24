# Feature & Requirement Map

This document maps each requirement from the graduation-project proposal to **where it
is implemented in the code** (file + short note). It is the reference for the project
defense: every functional requirement (FR), non-functional requirement (NFR), and the
required Arabic rendering is traced to concrete source — followed by a section on
features built **beyond** the original proposal.

> **Requirement IDs.** The titles below are the **exact wording from the approved
> proposal** (Chapter 3, Tables 3.1 and 3.2): 13 functional requirements (FR-01–FR-13)
> and 7 non-functional requirements (NFR-01–NFR-07). The file→feature traceability has
> been verified against the current code.

Paths are relative to this file (`docs/`). Frontend lives in
[`../client/src/`](../client/src/), backend in [`../server/`](../server/).

---

## 1. Functional Requirements (FR-01–FR-13)

| ID | Requirement | Status | Primary implementation | Notes |
|----|-------------|--------|------------------------|-------|
| **FR-01** | User Registration | ✅ Done | [authController.js](../server/controllers/authController.js) `register` · [Register.jsx](../client/src/pages/Register.jsx) | Email/password sign-up; password hashed with bcryptjs in [User.js](../server/models/User.js) `pre('save')`; returns a JWT. |
| **FR-02** | User Login | ✅ Done | [authController.js](../server/controllers/authController.js) `login` · [Login.jsx](../client/src/pages/Login.jsx) · [AuthContext.jsx](../client/src/context/AuthContext.jsx) | Verifies credentials, issues a JWT stored in `localStorage` and attached by the Axios interceptor in [api.js](../client/src/services/api.js). |
| **FR-03** | User Logout | ✅ Done | [AuthContext.jsx](../client/src/context/AuthContext.jsx) `logout` · [Navbar.jsx](../client/src/components/Navbar.jsx) | Clears the JWT from `localStorage` and resets auth state, ending the session. |
| **FR-04** | Onboarding – Current Knowledge | ✅ Done | [Onboarding.jsx](../client/src/pages/Onboarding.jsx) · [progressController.js](../server/controllers/progressController.js) `completeOnboarding` | New users mark what they already know — by Juz, Hizb, quarter-Hizb, Surah or page range ([MemorizedUnitPicker.jsx](../client/src/components/MemorizedUnitPicker.jsx), verse-exact, so a Surah or Hizb that ends mid-page is saved as verse ranges). One all-or-nothing request saves the pages, the verse ranges and the plan; seeded pages are dated yesterday so they enter the review queue. |
| **FR-05** | Onboarding – Daily Capacity | ✅ Done | [Onboarding.jsx](../client/src/pages/Onboarding.jsx) · [User.js](../server/models/User.js) `dailyNewPages` | User sets pages/day (0.5–10) via presets or a custom value; 0.5 is half a page every active day. |
| **FR-06** | Plan Generation | ✅ Done | [progressController.js](../server/controllers/progressController.js) `getTodayTasks`, `computeNewPageTargetForDate`, `computeDailyReviewTarget` | Generates the personalized daily plan: new pages up to the goal + spaced-repetition reviews (the newest pages in a recent bucket, the rest in a cycle paced by the review intensity, oldest-reviewed first). Grounded in Ebbinghaus / Leitner (see [CLAUDE.md](../CLAUDE.md) "Design Rationale"). Honors rest days, pause, and Hafiz states. |
| **FR-07** | Display Daily Tasks | ✅ Done | [Dashboard.jsx](../client/src/pages/Dashboard.jsx) · [progressController.js](../server/controllers/progressController.js) `getTodayTasks` | "Today" tab shows the day's new memorization and review pages. |
| **FR-08** | Mark Page Complete | ✅ Done | [progressController.js](../server/controllers/progressController.js) `markPageComplete`, `unmarkPageComplete` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) | Mark new pages memorized and review pages completed; optimistic UI with toast feedback and undo. |
| **FR-09** | Progress Tracking | ✅ Done | [UserProgress.js](../server/models/UserProgress.js) (`memorizedDate`, `lastReviewedDate`, `reviewCount`) · [progressController.js](../server/controllers/progressController.js) `getAllProgress` | One record per (user, page) persists memorization dates and review history in MongoDB. |
| **FR-10** | Progress Dashboard | ✅ Done | [Progress.jsx](../client/src/pages/Progress.jsx) · [progressController.js](../server/controllers/progressController.js) `getJuzProgress`, `getAllProgress` | Visual statistics: 30-Juz memorization map, per-page grid, Surah breakdown, cumulative line chart, and activity heatmap. |
| **FR-11** | Streak Tracking | ✅ Done | [streak.js](../server/utils/streak.js) `isStreakContinued` · [progressController.js](../server/controllers/progressController.js) `checkIn` · [User.js](../server/models/User.js) `currentStreak`/`lastActiveDate` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) streak chip | Tracks consecutive active days; surfaced as the dashboard streak chip, a Progress stat, streak-milestone badges, and rest-day-aware continuation. |
| **FR-12** | Motivational Quotes | ✅ Done | [Dashboard.jsx](../client/src/pages/Dashboard.jsx) (`dashboard.quotes`, `dashboard.tips`) · [en.json](../client/src/locales/en.json) / [ar.json](../client/src/locales/ar.json) | Day-of-year–rotated Quran/Hadith quote + "Tip of the Day", fully bilingual. |
| **FR-13** | Edit Plan Settings | ✅ Done | [Settings.jsx](../client/src/pages/Settings.jsx) · [authController.js](../server/controllers/authController.js) `updateProfile` · [progressController.js](../server/controllers/progressController.js) `changeMemorized`, `updateUnits` | Modify daily capacity, review intensity, and rest days after onboarding; the `EditProgressModal` (the same [MemorizedUnitPicker](../client/src/components/MemorizedUnitPicker.jsx) as onboarding) edits memorized pages by Juz/Hizb/quarter/Surah/range and saves only what changed. |

---

## 2. Non-Functional Requirements (NFR-01–NFR-07)

| ID | Requirement | Status | Where addressed | Notes |
|----|-------------|--------|-----------------|-------|
| **NFR-01** | Response Time — load < 3 s | ✅ Done | [quranApi.js](../client/src/services/quranApi.js) / [mushafApi.js](../client/src/services/mushafApi.js) caches; [App.jsx](../client/src/App.jsx) lazy routes; [vite.config.js](../client/vite.config.js); [app.js](../server/app.js) `compression` | Quran content memoized in size-capped LRU caches → instant revisits; every page its own chunk (entry ~430 kB / ~139 kB gzip), recharts and the search index loaded on demand, the active language's strings preloaded. The Library avoids re-rendering on pointer moves and scrolls ([CODE_GUIDE §6](CODE_GUIDE.md), "Keeping the reader fast"). Caveat: the API's free hosting tier sleeps, so a first request can take far longer than 3 s. |
| **NFR-02** | Browser Compatibility — latest Chrome/Firefox/Safari/Edge | ✅ Done | Vite + Tailwind build ([vite.config.js](../client/vite.config.js)) | Standard ES + autoprefixed CSS; logical properties (`ms`/`me`, `start`/`end`) for cross-browser RTL. |
| **NFR-03** | Responsive Design — desktop / tablet / mobile | ✅ Done | Responsive Tailwind grids on all pages; mobile drawer in [Navbar.jsx](../client/src/components/Navbar.jsx) | Library tafsir = bottom-sheet (mobile) / side-panel (desktop); Settings = sidebar (desktop) / tab row (mobile). |
| **NFR-04** | Password Encryption — strong one-way hash (bcrypt) | ✅ Done | [User.js](../server/models/User.js) `pre('save')` + `matchPassword` | Passwords hashed with **bcryptjs** (salt rounds = 10); never returned (`select: false`). |
| **NFR-05** | Session Security — JWT | ✅ Done | [auth.js](../server/middleware/auth.js) · [authController.js](../server/controllers/authController.js) · [api.js](../client/src/services/api.js) | JWT bearer auth; protected routes verified by middleware; a password change or reset ends every older session. Hardened further with `helmet`, a CORS allow-list, per-IP limiters and a per-account sign-in backoff ([rateLimiters.js](../server/middleware/rateLimiters.js), [loginThrottle.js](../server/utils/loginThrottle.js)), chat limits ([chatRateLimit.js](../server/middleware/chatRateLimit.js)), input type checks ([validate.js](../server/middleware/validate.js)), and security headers with a report-only CSP on the client ([vercel.json](../client/vercel.json)). |
| **NFR-06** | Availability — 99%+ | ✅ Addressed | `GET /health` in [app.js](../server/app.js) · [render.yaml](../render.yaml) | Health endpoint used by Render's health check and an uptime monitor; graceful shutdown on deploys ([shutdown.js](../server/utils/shutdown.js)). **Honest note:** the 99% figure is a property of the hosting platform's uptime, not something enforced in code. Graceful failure supports perceived reliability: every load failure shows an error with Retry ([reportError.js](../client/src/utils/reportError.js)), error boundaries keep a crash inside its region, requests are bounded by timeouts. |
| **NFR-07** | Arabic Text Support — correct tashkeel (diacritics) | ✅ Done | [mushafApi.js](../client/src/services/mushafApi.js) · [MushafPage.jsx](../client/src/components/MushafPage.jsx) · [index.css](../client/src/index.css) `.mushaf-text` | The reader draws each page with the printed mushaf's own per-page QCF glyph fonts (from quran.com), word by word on the 15-line grid, so every diacritic sits exactly as printed; verse text elsewhere (tafsir preview, search) uses Uthmani text in Amiri Quran / Scheherazade New. Arabic-Indic ayah numerals throughout. |

---

## 3. Additional features beyond the original proposal

These were designed and built on top of the proposal's scope as added value — they do
not occupy FR slots.

| Feature | Implementation | Notes |
|---------|----------------|-------|
| **Quran Library** — mushaf reader | [Library.jsx](../client/src/pages/Library.jsx) · [mushafApi.js](../client/src/services/mushafApi.js) · [MushafPage.jsx](../client/src/components/MushafPage.jsx) | All 604 pages as printed (fixed 576×852 frame, 15-line grid), single page or two-page spread, zoom; jump by page/Juz/Surah, scrubber, swipe and keys (an RTL book); readable without an account; mark-as-memorized inline. |
| **Audio recitation** | [Library.jsx](../client/src/pages/Library.jsx) · [quranApi.js](../client/src/services/quranApi.js) `getAyahAudioUrl`, `RECITERS` | 34 reciters, per-ayah playback with gapless handover, speed, pause length, repeat per verse and per range (drag across verses to pick one), a second source for reciters whose CDN files can fail. |
| **Tafsir (commentary)** | [TafsirPanel.jsx](../client/src/components/TafsirPanel.jsx) · [quranApi.js](../client/src/services/quranApi.js) `fetchPageTafsir`, `fetchEditionAyahTafsir`, `TAFSIR_EDITIONS` | 9 editions (incl. i'rab) in a resizable docked column / side panel / bottom sheet, per-verse navigation, a note when a book comments on a whole passage. |
| **Annotations, bookmarks, search** | [Library.jsx](../client/src/pages/Library.jsx) · [useBookmarks.js](../client/src/hooks/useBookmarks.js) · [annotationController.js](../server/controllers/annotationController.js) · [VerseSearch.jsx](../client/src/components/VerseSearch.jsx) | Verse-anchored highlights, notes and hard flags, free ink per page, with undo; named bookmarks; a local verse search that lands on the exact words. |
| **Leaderboard** | [Leaderboard.jsx](../client/src/pages/Leaderboard.jsx) · [leaderboardController.js](../server/controllers/leaderboardController.js) | Opt-in, by a public display name only. |
| **AI assistant chatbot** | [Chatbot.jsx](../client/src/components/Chatbot.jsx) · [chatController.js](../server/controllers/chatController.js) | Answers Hifz/Islamic questions; **aware of the user's live progress** (streak, pages left, today's tasks) via `buildProgressSummary`. Rate-limited + length-bounded. |
| **Achievements / badges** | [Progress.jsx](../client/src/pages/Progress.jsx) `ACHIEVEMENTS` | Badges for memorization, Juz, and streak milestones, earned/locked computed live. **Design note:** Surah completion is tracked & visualized via the Progress "Surah breakdown" (per-Surah %) — a dedicated Surah *badge* was intentionally **not** added; the breakdown serves that purpose. |
| **Estimated completion & weekly plan preview** | [progressController.js](../server/controllers/progressController.js) `getEstimate`, `getWeekPlan` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) "This Week" tab | Projected finish date from goal + rest days; 7-day forward plan preview. |
| **Account management** | [Settings.jsx](../client/src/pages/Settings.jsx) · [authController.js](../server/controllers/authController.js) `changePassword`, `deleteAccount` | Change password, delete the account and all its data, and a password reset built in (off until an email provider is configured). |
| **Dark / light / system theme** | [ThemeContext.jsx](../client/src/context/ThemeContext.jsx) · [index.css](../client/src/index.css) class-based `dark` variant | Persisted in `localStorage`; auto mode follows OS preference. |
| **Rest days & pause modes** | [Settings.jsx](../client/src/pages/Settings.jsx) · [User.js](../server/models/User.js) `offDays`, `pauseNewMemorization` · [progressController.js](../server/controllers/progressController.js) | Schedule weekly rest days; pause new memorization while keeping reviews; streak preserved across rest days. |
| **Full bilingual Arabic/English RTL interface** | [i18n.js](../client/src/i18n.js) · [en.json](../client/src/locales/en.json) / [ar.json](../client/src/locales/ar.json) · `document.dir` in [App.jsx](../client/src/App.jsx) | Complete UI translation (**1,184** English keys; Arabic has every one of them plus Arabic's extra plural forms — verified), lazily loaded per language, document-level RTL, logical CSS properties, self-hosted UI fonts. Distinct from NFR-07, which covers only Quranic-text tashkeel. |

---

## 4. Testing, Accessibility & Ops

- **Tests** — 425 server integration tests on an in-memory MongoDB ([server/tests/](../server/tests/), `npm test`); 297 client unit/component tests (Vitest + React Testing Library, `client/src/**/*.test.*`); 14 Playwright end-to-end flows on Chromium, WebKit and a phone viewport ([client/e2e/](../client/e2e/), `npm run test:e2e`). CI: [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Accessibility** — every modal and sheet traps and returns focus and closes on Escape ([useDialog.js](../client/src/hooks/useDialog.js)); single-key shortcuts can be turned off (WCAG 2.1.4); a skip link, named controls ([Tooltip.jsx](../client/src/components/Tooltip.jsx) applies the `aria-label`), `aria-pressed` on selection tiles, chat replies announced, errors in alert regions; contextual [InfoHint.jsx](../client/src/components/InfoHint.jsx) explains domain terms. Colour contrast (M-11) is still open.
- **Reliability** — load failures reported and retryable ([reportError.js](../client/src/utils/reportError.js)), error boundaries per region, request timeouts, graceful server shutdown.
- **Health check** — `GET /health` in [app.js](../server/app.js) (Render's health check, an uptime monitor).
- **Deploy** — [render.yaml](../render.yaml) (API) and [client/vercel.json](../client/vercel.json) (client headers).
- **Privacy** — what each outside service receives is inventoried in [legal/README.md](legal/README.md), with draft (unpublished) privacy policy and terms.

---

## 5. Known follow-ups (not blocking)

- **NFR-01 / cold starts** — route-level code-splitting and lazy recharts are done
  (entry ~430 kB / ~139 kB gzip). What remains is the API's free hosting tier, which
  sleeps when idle: the first request after a quiet spell can take far longer than 3 s.
- **Accessibility / colour contrast** (audit M-11) and the screen-reader side of the self-test (I-02: the hidden verse is still in the screen-reader text — a product decision).
- **Library render cost** — pointer moves and scrolls no longer re-render the reader;
  a memoised page card would cut the cost of the renders that remain (page turns,
  selection).
