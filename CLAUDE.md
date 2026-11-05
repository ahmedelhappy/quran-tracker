# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit Messages

Write commit messages in first person as if the developer wrote the code. Never mention Claude, AI, or any assistant.

## Responses

End every response with a one-line **TL;DR:** summarizing the outcome and what's needed next.

## Project Overview

Full-stack Quran memorization tracker. Users register, select what they've already memorized (onboarding), then receive a daily task list: new pages to memorize + spaced-repetition reviews. Tracks streaks and visualizes progress by Juz (30 parts of the Quran, ~20 pages each). It also has a 604-page mushaf reader (the Library) with recitation, tafsir, annotations and bookmarks, an AI assistant, a leaderboard, and EN/AR with dark mode.

## Repository Structure

Two separate Node apps in one repo — run each independently:

```
quran-tracker/
├── client/   # React 19 + Vite + Tailwind 4 frontend (Vercel)
├── server/   # Express 5 + MongoDB/Mongoose backend (Render, render.yaml)
└── docs/     # audit, plan, code guide, feature map, legal drafts (docs/legal/)
```

Node is pinned to 24.19.0 (`.nvmrc`, and Volta in both package.json files); `engines` accepts `^22.22.2 || ^24.15.0`. CI (`.github/workflows/ci.yml`) runs the server tests, lint, Vitest, a production build and the Playwright flows.

## Commands

### Backend (`cd server`)
```bash
npm run dev       # nodemon hot-reload (development)
npm start         # node server.js (production; needs MONGODB_URI and JWT_SECRET)
npm test          # node --test: integration tests on an in-memory MongoDB (mongodb-memory-server)
npm run seed:demo -- --uri <mongodb-uri>   # seed a demo account with sample progress
```
`npm test` downloads a mongod binary on first run (or set `MONGOMS_SYSTEM_BINARY` to a local one). It never reads `MONGODB_URI`.

### Frontend (`cd client`)
```bash
npm run dev       # Vite dev server with HMR (falls back to http://localhost:5000/api)
npm run build     # production build → dist/ (fails unless VITE_API_URL is set)
npm run lint      # ESLint
npm test          # Vitest + React Testing Library (jsdom)
npm run test:e2e  # Playwright: builds the client, starts the real API on an in-memory MongoDB, runs e2e/
npm run preview   # serve the production build
```
`npx playwright install chromium webkit` once before the e2e flows. They run on three projects (Chromium, WebKit, a Pixel 7 phone); `e2e/support/` holds the stack (`api-server.cjs`, `web-server.js`) and the shared fixtures (`test.js`).

## Environment

Backend (`server/.env`, documented in `server/.env.example`; on Render see `render.yaml`):
```
PORT=5000
MONGODB_URI=<MongoDB Atlas connection string>   # required
JWT_SECRET=<secret>                             # required
CLIENT_URL=<deployed client origin>             # CORS allow-list in production; also the password-reset link's origin
GROQ_API_KEY=<key>            # AI assistant; chat answers 503 without it
GROQ_MODEL=<model id>         # optional; defaults to openai/gpt-oss-120b
TRUST_PROXY=<hops|true|false|subnets>  # optional; client IP for the rate limiters (default 1 in production)
CHAT_MAX_TOKENS=2048          # optional chat budget; whole numbers above 0
CHAT_TIMEOUT_MS=20000
CHAT_DAILY_LIMIT=50           # messages per user per UTC day, counted in memory
PASSWORD_RESET_ENABLED=false  # reset is on only with "true" + a delivering EMAIL_TRANSPORT + a usable CLIENT_URL
EMAIL_TRANSPORT=none          # none | console (development only); no real provider is wired yet
```
`server.js` refuses to start without `MONGODB_URI` and `JWT_SECRET`. `NODE_ENV=production` turns on the production CORS list, trust-proxy default and the reset checks.

Frontend (`client/.env`, see `client/.env.example`): `VITE_API_URL` is the API base (`services/api.js`) and is **mandatory for a production build** (`vite.config.js` stops the build without it; dev falls back to `http://localhost:5000/api`). `VITE_SITE_URL` (optional) is the site's own origin: with it the build emits `sitemap.xml`, a Sitemap line in `robots.txt`, canonical links and absolute share-card URLs (`siteMeta.js`).

End-to-end (all optional): `PW_CHROME_PATH` (use an installed Chrome instead of Playwright's Chromium; leave unset on Linux/CI), `E2E_API_PORT` / `E2E_ADMIN_PORT` / `E2E_WEB_PORT` (default 5140/5141/5142), `E2E_REUSE_SERVERS=1` (reuse stacks you started yourself; never in CI).

## Architecture

### Backend

**Entry point**: `server/server.js` checks the required env, connects to MongoDB and starts the app from `server/app.js`; `utils/shutdown.js` closes the HTTP server and Mongo on SIGTERM/SIGINT (Render deploys). `app.js` applies an error-code guard, morgan (not in tests), a CORS allow-list, `express.json`, helmet, compression and the trust-proxy setting (`utils/trustProxy.js`); exposes `GET /health` (no database); applies a general `/api` rate limiter; and mounts seven route groups:
- `/api/auth` → `routes/authRoutes.js` (register, login, config, forgot/reset password, me, profile, password, account)
- `/api/progress` → `routes/progressRoutes.js` (all protected by `middleware/auth.js`, JWT Bearer)
- `/api/bookmarks`, `/api/annotations`, `/api/todos`, `/api/leaderboard` → their route files (protected)
- `/api/chat` → `routes/chatRoutes.js` (Groq assistant; per-user daily limit in `middleware/chatRateLimit.js` / `utils/chatBudget.js`)

Unknown routes answer a JSON 404. **Every API error carries a stable `code`** (`middleware/errorCode.js`, `utils/errorResponse.js` `serverError`/`logError`, `middleware/errorHandler.js`); the client turns codes into messages in `client/src/utils/apiError.js`. `logError` keeps refused values (E11000, validation, cast errors) out of the logs. Request bodies and queries are type-checked by `middleware/validate.js`. Rate limiters (`middleware/rateLimiters.js`) and the per-account login backoff (`utils/loginThrottle.js`) are in process memory.

**Models**:
- `User` — credentials, `dailyNewPages` (0.5–10), streak (`currentStreak`/`lastActiveDate`, plus `prevStreak`/`prevActiveDate` for undo), `onboardingComplete`, plan fields (`reviewIntensity`, `offDays`, `pauseNewMemorization`, `pausedFromOnboarding`, `recentReviewCount`, `cycleReviewCount`, `cycleReviewStartPage`, `memorizationDirection`, `newMemorizationStartPage`, `planStartDate`), `language`, leaderboard (`displayName`, `leaderboardOptIn`), and the auth bookkeeping `passwordChangedAt`, `passwordResetTokenHash`, `passwordResetExpires` (both `select: false`)
- `UserProgress` — one document per (userId, pageNumber): `status`, `memorizedDate`, `lastReviewedDate`, `reviewCount`, verse `segments` for a partly memorized page, and the undo snapshots
- `Bookmark` — several per user and per page; only one *unnamed* bookmark per page
- `Annotation` — verse-anchored highlights, notes and hard flags (verseKey + word positions), plus one free-ink drawing per page (`one_drawing_per_page` index)
- `Todo` — the reader's to-do list
- `QuranMetadata` — static lookup (604 pages): `juzNumber`/`hizbNumber`, the ordered `surahs` on the page, the verse span (`firstVerseKey`/`lastVerseKey`/`verseKeys`) and `rubBoundaries`. Seeded from the committed `seed/data/quranStructure.json`

Deleting an account removes every collection's data for that user (a test checks every model that references `User`).

**Core business logic** lives in `controllers/progressController.js`:
- `getTodayTasks` — new pages up to `dailyNewPages` counted from `planStartDate` (a 0.5 plan is half a page every active day), skipped on rest days or while paused; reviews are a *recent* bucket (the newest pages since the plan started) plus a *cycle* through everything memorized, whose size comes from `reviewIntensity` (pages / 14, 10 or 7 days, up to 40 a day; Hafiz 40–87) or a fixed `cycleReviewCount`. A GET writes nothing
- `checkIn` — the streak check-in the dashboard sends after showing the plan
- `markPageComplete` / `unmarkPageComplete` — mark a page (or half-page segment) memorized or reviewed and update the streak (UTC dates); undo restores it
- `completeOnboarding` — one all-or-nothing request: whole pages, sub-page verse ranges and the plan. If it cannot put its rows back after a failure it answers `ONBOARDING_PARTIAL`; a deleted account gets 401
- `updateMemorized` (PUT, replace — removals need `confirmRemoval`, else 409 `CONFIRM_REMOVAL`), `changeMemorized` (PATCH, add/remove named pages), `updateUnits` (PUT, by Juz/Hizb/¼-Hizb/Surah/page/verse range)

**Auth**: JWTs carry a millisecond `iatMs`; changing or resetting the password stamps `passwordChangedAt`, which ends every older session. Password reset is built but **off by default** (`utils/passwordReset.js`, `utils/mailer.js`); `GET /api/auth/config` tells the client whether to offer it.

**Date handling**: all date comparisons use `YYYY-MM-DD` strings in UTC (`utils/clock.js` lets tests move "today").

### Frontend

**Entry point**: `client/src/main.jsx` → `App.jsx`, wrapped in a root `ErrorBoundary`.

`App.jsx` defines all routes (each page lazy-loaded) inside `ThemeProvider` → `AuthProvider` → `ToastProvider` → `TimerProvider` → `AccountScope` (remounts the tree when the signed-in account changes). Route layout:
- Public: `/`, `/about`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/library` (the mushaf reads without an account; anything that saves to one is hidden behind a sign-in nudge)
- Protected (via `ProtectedRoute`): `/dashboard`, `/onboarding`, `/progress`, `/settings`, `/leaderboard`

After login, if `user.onboardingComplete === false`, the app redirects to `/onboarding`.

**State management**: React Context — `context/AuthContext.jsx` (user, `login`, `logout`, `updateUser`; token in `localStorage` under `'token'`), `ThemeContext.jsx`, `ToastContext.jsx` (toasts at the top of the screen, in an alert/status region), `TimerContext.jsx`. The context files export only their providers; the hooks (`useAuth`, `useTheme`, `useToast`) live in `hooks/` so Fast Refresh works. UI language (EN/AR) is `react-i18next` (`src/i18n.js`): each locale is a lazily fetched JSON file (`src/locales/`), preloaded by a small script `vite.config.js` adds to `index.html`; Arabic sets `dir="rtl"`. Every user-visible string goes in both `en.json` and `ar.json`.

**HTTP and errors**: `services/api.js` — Axios with the Bearer token, 20 s timeouts for reads and 60 s for writes. `services/quranApi.js` and `services/mushafApi.js` fetch Quran content from outside hosts through `utils/fetchWithTimeout.js` (`NetworkError`, `RequestTimeoutError`). Every load failure goes through `utils/reportError.js` (`reportLoadFailure`; `reportError` is the one hook for an error service) and shows an error with Retry, never an empty "none yet". `components/ErrorBoundary.jsx` wraps regions; its function-children form keeps throws in that region's render inside the boundary.

**Shared pieces worth knowing**: `utils/safeStorage.js` (every localStorage key goes through its registry), `hooks/useDialog.js` (focus, trap, Escape, inert background for every modal and sheet), `utils/shortcutKeys.js` (shortcut matching by `e.code` or `e.key`, and the switch that turns single-key shortcuts off), `hooks/usePageTitle.js` + `client/siteMeta.js` (titles and share cards), self-hosted UI fonts (`src/fonts.css`), recharts loaded only with the charts, security headers and a report-only CSP in `client/vercel.json`.

**Pages**:
- `Dashboard.jsx` — daily new memorization + review tasks, streak, week plan, timer and to-do
- `Progress.jsx` — 30-Juz map, per-page grid, Surah breakdown, charts and milestone badges
- `Library.jsx` — the 604-page mushaf reader: per-ayah audio (many reciters, repeat), tafsir (`components/TafsirPanel.jsx`), bookmarks (`hooks/useBookmarks.js`), highlights/notes/hard flags/free ink, verse search, a guided memorize mode with self-tests
- `Onboarding.jsx` — choose what is memorized (`components/MemorizedUnitPicker.jsx`, shared with the Settings progress editor) and the plan
- `Settings.jsx` — profile, plan (goal, review intensity, rest days), memorized progress, password, community, shortcuts
- `Leaderboard.jsx`, `About.jsx`, `Landing.jsx`, `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/config` | What the client should offer (e.g. `passwordReset`) |
| POST | `/api/auth/forgot-password` | Email a reset link (same reply for every address; 404 `RESET_DISABLED` while off) |
| POST | `/api/auth/reset-password` | Set a new password from the link's token |
| GET | `/api/auth/me` | Current user (protected) |
| PUT | `/api/auth/profile` | Update name, daily goal, plan and leaderboard settings (protected) |
| PUT | `/api/auth/password` | Change password; returns a fresh JWT (protected) |
| DELETE | `/api/auth/account` | Delete the account and all its data (protected) |
| POST | `/api/progress/onboarding` | All-or-nothing onboarding: pages, verse ranges, plan (protected) |
| PUT | `/api/progress/memorized` | Replace the memorized set; removals need `confirmRemoval` (protected) |
| PATCH | `/api/progress/memorized` | Add/remove named pages (protected) |
| PUT | `/api/progress/units` | Add/remove by Juz, Hizb, ¼-Hizb, Surah, page or verse range (protected) |
| DELETE | `/api/progress/reset` | Reset all progress (protected) |
| GET | `/api/progress/today` | Today's task list; writes nothing (protected) |
| POST | `/api/progress/checkin` | Streak check-in after the plan is shown (protected) |
| POST | `/api/progress/complete` | Mark a page or segment done (protected) |
| POST | `/api/progress/uncomplete` | Undo a completion made today (protected) |
| GET | `/api/progress/all` | All memorized pages (protected) |
| GET | `/api/progress/juz` | Per-Juz progress summary (protected) |
| GET | `/api/progress/estimate` | Projected completion estimate (protected) |
| GET | `/api/progress/week` | This week's plan (protected) |
| * | `/api/bookmarks`, `/api/annotations`, `/api/todos` | CRUD for the reader's bookmarks, annotations (incl. `/summary`, `/drawing`, `/batch`) and to-do (protected) |
| GET | `/api/leaderboard` | Opted-in readers by pages memorized (protected) |
| POST | `/api/chat` | AI assistant chat (rate-limited) |

## Database Seeding and Maintenance

Every script takes the database explicitly with `--uri`; none reads `MONGODB_URI`. Run once to populate `QuranMetadata`:
```bash
cd server
node seed/quranData.js --uri <mongodb-uri>
```

`quranData.js` seeds straight from the committed `seed/data/quranStructure.json` — the
exact per-page mushaf structure (surahs, verse spans, juz/hizb, rub boundaries) for all
604 pages. That file is generated once from the quran.com API and committed; the app never
calls the external API at runtime. To regenerate it (rarely needed) run:
```bash
cd server
node seed/fetchQuranStructure.js   # needs network; rewrites seed/data/quranStructure.json
```

The Library's verse search reads a second committed file, `client/public/data/search-index.json`
(every verse's words in word-position order, so hits map to the rendered glyphs). It is
not seeded into the database — the client lazy-loads it. To regenerate it (rarely needed):
```bash
cd server
node seed/fetchSearchIndex.js      # needs network; checks positions against the reader's data
```

One-off cleanups (dry run by default; `--apply` deletes): `node scripts/cleanupOrphans.js --uri <uri>` (data left by deleted accounts) and `node scripts/cleanupInvalidPages.js --uri <uri>` (progress rows outside pages 1–604). Back the database up first.

## Project Context (formerly a Graduation Project)

This started as a graduation project and **has been defended.** All proposal requirements — functional (FR-01–FR-13) and non-functional (NFR-01–NFR-07) — are implemented, and the app now goes beyond the original scope: a 604-page Quran reader/Library, per-ayah audio, tafsir, bilingual EN/AR i18n, dark mode, an AI chatbot, and richer scheduling. The full requirement→code mapping lives in [`docs/FEATURES.md`](docs/FEATURES.md).

The proposal is therefore a **historical reference, not a binding scope constraint.** Development now continues as ordinary product improvement — prioritize good UX and faithful Quranic rendering over proposal checkboxes.

### Non-Functional Requirements to Keep in Mind

- **Performance (NFR-01)**: All pages and core interactions must load within 3 seconds.
- **Browser support (NFR-02)**: Latest Chrome, Firefox, Safari, Edge.
- **Responsive design (NFR-03)**: Must work well on desktop, tablet, and mobile.
- **Arabic text (NFR-07)**: Arabic Quranic text must render with correct tashkeel (diacritics).

### Design Rationale

The smart review system is grounded in **Ebbinghaus's Forgetting Curve** and **spaced repetition** (Pimsleur 1967, Leitner System 1972): pages recently memorized are reviewed frequently; intervals grow as retention strengthens. The current implementation approximates this with a recent bucket (the newest pages, reviewed daily) and a cycle through everything memorized at a pace set by the review intensity. A more faithful spaced repetition algorithm (dynamic intervals per page based on review history) is a natural future enhancement.

The term **Muraja'ah** (مراجعة) refers to the Islamic tradition of systematic Quran revision — the "review" tasks in this app are the digital equivalent.
