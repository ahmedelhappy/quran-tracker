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
| **FR-04** | Onboarding – Current Knowledge | ✅ Done | [Onboarding.jsx](../client/src/pages/Onboarding.jsx) · [progressController.js](../server/controllers/progressController.js) `completeOnboarding` | New users mark pages already memorized — by Juz, Surah, or page range; seeded pages are dated yesterday so they enter the review queue. |
| **FR-05** | Onboarding – Daily Capacity | ✅ Done | [Onboarding.jsx](../client/src/pages/Onboarding.jsx) · [User.js](../server/models/User.js) `dailyNewPages` | User sets pages/day (0.5–10) via presets or a custom value. |
| **FR-06** | Plan Generation | ✅ Done | [progressController.js](../server/controllers/progressController.js) `getTodayTasks`, `computeNewPageTargetForDate`, `computeDailyReviewTarget` | Generates the personalized daily plan: new pages up to the goal + spaced-repetition reviews (recent pages frequently, cycle reviews oldest-first). Grounded in Ebbinghaus / Leitner (see [CLAUDE.md](../CLAUDE.md) "Design Rationale"). Honors rest days, pause, and Hafiz states. |
| **FR-07** | Display Daily Tasks | ✅ Done | [Dashboard.jsx](../client/src/pages/Dashboard.jsx) · [progressController.js](../server/controllers/progressController.js) `getTodayTasks` | "Today" tab shows the day's new memorization and review pages. |
| **FR-08** | Mark Page Complete | ✅ Done | [progressController.js](../server/controllers/progressController.js) `markPageComplete`, `unmarkPageComplete` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) | Mark new pages memorized and review pages completed; optimistic UI with toast feedback and undo. |
| **FR-09** | Progress Tracking | ✅ Done | [UserProgress.js](../server/models/UserProgress.js) (`memorizedDate`, `lastReviewedDate`, `reviewCount`) · [progressController.js](../server/controllers/progressController.js) `getAllProgress` | One record per (user, page) persists memorization dates and review history in MongoDB. |
| **FR-10** | Progress Dashboard | ✅ Done | [Progress.jsx](../client/src/pages/Progress.jsx) · [progressController.js](../server/controllers/progressController.js) `getJuzProgress`, `getAllProgress` | Visual statistics: 30-Juz memorization map, per-page grid, Surah breakdown, cumulative line chart, and activity heatmap. |
| **FR-11** | Streak Tracking | ✅ Done | [progressController.js](../server/controllers/progressController.js) `isStreakContinued` · [User.js](../server/models/User.js) `currentStreak`/`lastActiveDate` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) streak chip | Tracks consecutive active days; surfaced as the dashboard streak chip, a Progress stat, streak-milestone badges, and rest-day-aware continuation. |
| **FR-12** | Motivational Quotes | ✅ Done | [Dashboard.jsx](../client/src/pages/Dashboard.jsx) (`dashboard.quotes`, `dashboard.tips`) · [en.json](../client/src/locales/en.json) / [ar.json](../client/src/locales/ar.json) | Day-of-year–rotated Quran/Hadith quote + "Tip of the Day", fully bilingual. |
| **FR-13** | Edit Plan Settings | ✅ Done | [Settings.jsx](../client/src/pages/Settings.jsx) · [authController.js](../server/controllers/authController.js) `updateProfile` · [progressController.js](../server/controllers/progressController.js) `updateMemorized` | Modify daily capacity, review intensity, and rest days after onboarding; the `EditProgressModal` also edits memorized pages by Juz/Surah/range. |

---

## 2. Non-Functional Requirements (NFR-01–NFR-07)

| ID | Requirement | Status | Where addressed | Notes |
|----|-------------|--------|-----------------|-------|
| **NFR-01** | Response Time — load < 3 s | ✅ Done | [quranApi.js](../client/src/services/quranApi.js) in-memory caches; [app.js](../server/app.js) `compression` | Page text, page-tafsir, and ayah-tafsir memoized (`Map`) → instant revisits. Parallel `Promise.all` loads, skeleton loaders. ⚠️ See §5 re: JS bundle size. |
| **NFR-02** | Browser Compatibility — latest Chrome/Firefox/Safari/Edge | ✅ Done | Vite + Tailwind build ([vite.config.js](../client/vite.config.js)) | Standard ES + autoprefixed CSS; logical properties (`ms`/`me`, `start`/`end`) for cross-browser RTL. |
| **NFR-03** | Responsive Design — desktop / tablet / mobile | ✅ Done | Responsive Tailwind grids on all pages; mobile drawer in [Navbar.jsx](../client/src/components/Navbar.jsx) | Library tafsir = bottom-sheet (mobile) / side-panel (desktop); Settings = sidebar (desktop) / tab row (mobile). |
| **NFR-04** | Password Encryption — strong one-way hash (bcrypt) | ✅ Done | [User.js](../server/models/User.js) `pre('save')` + `matchPassword` | Passwords hashed with **bcryptjs** (salt rounds = 10); never returned (`select: false`). |
| **NFR-05** | Session Security — JWT | ✅ Done | [auth.js](../server/middleware/auth.js) · [authController.js](../server/controllers/authController.js) · [api.js](../client/src/services/api.js) | JWT bearer auth; protected routes verified by middleware. Hardened further with `helmet`, a CORS allow-list, and chat rate-limiting ([chatRateLimit.js](../server/middleware/chatRateLimit.js)). |
| **NFR-06** | Availability — 99%+ | ✅ Addressed | `GET /health` in [app.js](../server/app.js) · [render.yaml](../render.yaml) | Health endpoint for uptime monitoring (UptimeRobot); deployed on Render. **Honest note:** the 99% figure is a property of the hosting platform's uptime, not something enforced in code. Graceful failure (loading/error/empty states on every fetch, chat fallback) supports perceived reliability. |
| **NFR-07** | Arabic Text Support — correct tashkeel (diacritics) | ✅ Done | [index.css](../client/src/index.css) `.mushaf-text` (Amiri Quran / Scheherazade New) · [quranApi.js](../client/src/services/quranApi.js) `quran-uthmani`, `splitBasmala`, `toArabicDigits` | Uthmani text with full diacritics, dedicated Quranic fonts, RTL justification, Arabic-Indic ayah numerals, Basmala on its own centered line. |

---

## 3. Additional features beyond the original proposal

These were designed and built on top of the proposal's scope as added value — they do
not occupy FR slots.

| Feature | Implementation | Notes |
|---------|----------------|-------|
| **Quran Library** — mushaf reader | [Library.jsx](../client/src/pages/Library.jsx) · [quranApi.js](../client/src/services/quranApi.js) `fetchPageText` | All 604 pages in Uthmani script; jump by page/Juz/Surah; mark-as-memorized inline from the reader. |
| **Audio recitation** | [Library.jsx](../client/src/pages/Library.jsx) · [quranApi.js](../client/src/services/quranApi.js) `getAyahAudioUrl`, `RECITERS` | 5 reciters, per-ayah playback with auto-advance, buffering/error handling. |
| **Tafsir (commentary)** | [Library.jsx](../client/src/pages/Library.jsx) · [quranApi.js](../client/src/services/quranApi.js) `fetchPageTafsir`, `fetchAyahTafsir`, `TAFSIR_EDITIONS` | 4 editions in a side-panel / bottom-sheet, per-verse navigation. |
| **AI assistant chatbot** | [Chatbot.jsx](../client/src/components/Chatbot.jsx) · [chatController.js](../server/controllers/chatController.js) | Answers Hifz/Islamic questions; **aware of the user's live progress** (streak, pages left, today's tasks) via `buildProgressSummary`. Rate-limited + length-bounded. |
| **Achievements / badges** | [Progress.jsx](../client/src/pages/Progress.jsx) `ACHIEVEMENTS` | Badges for memorization, Juz, and streak milestones, earned/locked computed live. **Design note:** Surah completion is tracked & visualized via the Progress "Surah breakdown" (per-Surah %) — a dedicated Surah *badge* was intentionally **not** added; the breakdown serves that purpose. |
| **Estimated completion & weekly plan preview** | [progressController.js](../server/controllers/progressController.js) `getEstimate`, `getWeekPlan` · [Dashboard.jsx](../client/src/pages/Dashboard.jsx) "This Week" tab | Projected finish date from goal + rest days; 7-day forward plan preview. |
| **Account management** | [Settings.jsx](../client/src/pages/Settings.jsx) · [authController.js](../server/controllers/authController.js) `changePassword`, `deleteAccount` | Change password and delete account (beyond the proposal's auth requirements). |
| **Dark / light / system theme** | [ThemeContext.jsx](../client/src/context/ThemeContext.jsx) · [index.css](../client/src/index.css) class-based `dark` variant | Persisted in `localStorage`; auto mode follows OS preference. |
| **Rest days & pause modes** | [Settings.jsx](../client/src/pages/Settings.jsx) · [User.js](../server/models/User.js) `offDays`, `pauseNewMemorization` · [progressController.js](../server/controllers/progressController.js) | Schedule weekly rest days; pause new memorization while keeping reviews; streak preserved across rest days. |
| **Full bilingual Arabic/English RTL interface** | [i18n.js](../client/src/i18n.js) · [en.json](../client/src/locales/en.json) / [ar.json](../client/src/locales/ar.json) · `document.dir` in [App.jsx](../client/src/App.jsx) | Complete UI translation (**599 keys each, identical sets — verified**), document-level RTL, logical CSS properties, Arabic UI font. Distinct from NFR-07, which covers only Quranic-text tashkeel. |

---

## 4. Testing, Accessibility & Ops

- **Backend tests** — 13 tests covering auth + spaced-repetition logic, run against an in-memory MongoDB ([server/tests/](../server/tests/), `npm test`).
- **Accessibility** — [Tooltip.jsx](../client/src/components/Tooltip.jsx) always applies an `aria-label` to the icon button it wraps, so audio/navigation/verse controls are named for screen readers and touch users; form inputs have visible focus rings; contextual [InfoHint.jsx](../client/src/components/InfoHint.jsx) explains domain terms.
- **Health check** — `GET /health` in [app.js](../server/app.js) (for UptimeRobot).
- **Deploy** — [render.yaml](../render.yaml).

---

## 5. Known follow-ups (not blocking)

- **NFR-01 / bundle size** — production JS is ~976 kB (≈284 kB gzip) in a single chunk.
  Within budget for the < 3 s target on broadband, but route-level `React.lazy`
  code-splitting (especially the chart/`recharts` dependency) would cut first-load size.
