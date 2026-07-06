# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit Messages

Write commit messages in first person as if the developer wrote the code. Never mention Claude, AI, or any assistant.

## Responses

End every response with a one-line **TL;DR:** summarizing the outcome and what's needed next.

## Project Overview

Full-stack Quran memorization tracker. Users register, select pages they've already memorized (onboarding), then receive a daily task list: new pages to memorize + spaced-repetition reviews. Tracks streaks and visualizes progress by Juz (30 parts of the Quran, ~20 pages each).

## Repository Structure

Two separate Node apps in one repo — run each independently:

```
quran-tracker/
├── client/   # React 19 + Vite + Tailwind frontend
└── server/   # Express 5 + MongoDB/Mongoose backend
```

## Commands

### Backend (`cd server`)
```bash
npm run dev       # nodemon hot-reload (development)
npm start         # node server.js (production)
npm test          # node --test (integration tests on an in-memory MongoDB)
npm run seed:demo # seed a demo account with sample progress
```

### Frontend (`cd client`)
```bash
npm run dev    # Vite dev server with HMR
npm run build  # Production build → dist/
npm run lint   # ESLint
npm run preview # Preview production build
```

The backend has an integration test suite (`server/tests/`, Node's built-in runner with `mongodb-memory-server` + `supertest`) — run it with `npm test`. The frontend has no automated tests.

## Environment

Backend requires `server/.env`:
```
PORT=5000
MONGODB_URI=<MongoDB Atlas connection string>
JWT_SECRET=<secret>
GROQ_API_KEY=<key>           # AI chatbot (Groq); chat is disabled without it
CLIENT_URL=<deployed origin> # added to the CORS allow-list in production
```

Frontend reads the backend URL from `VITE_API_URL` (`client/src/services/api.js`), falling back to `http://localhost:5000/api` in development.

## Architecture

### Backend

**Entry point**: `server/server.js` connects to MongoDB and starts the HTTP app defined in `server/app.js`. `app.js` applies middleware (morgan, a CORS allow-list, `express.json`, helmet, compression), exposes `GET /health` for uptime monitoring, and mounts three route groups:
- `/api/auth` → `routes/authRoutes.js`
- `/api/progress` → `routes/progressRoutes.js` (all protected by `middleware/auth.js`, JWT Bearer verification)
- `/api/chat` → `routes/chatRoutes.js` (Groq-powered assistant, rate-limited by `middleware/chatRateLimit.js`)

**Models**:
- `User` — credentials, `dailyNewPages` goal (0.5–10), `currentStreak`/`lastActiveDate`, `onboardingComplete`, plus scheduling/plan fields: `reviewIntensity`, `offDays`, `pauseNewMemorization`, `recentReviewCount`, `cycleReviewCount`, `cycleReviewStartPage`, `planStartDate`, `language`
- `UserProgress` — one document per (userId, pageNumber) pair; tracks `status`, `memorizedDate`, `lastReviewedDate`, `reviewCount`
- `QuranMetadata` — static lookup table (604 pages): per-page `juzNumber`/`hizbNumber`, the ordered `surahs` on the page (`{ number, name, nameArabic }`), the exact verse span (`firstVerseKey`/`lastVerseKey`/`verseKeys`), and `rubBoundaries`. Seeded once via `seed/quranData.js` from the committed `seed/data/quranStructure.json`

**Core business logic** lives in `controllers/progressController.js`:
- `getTodayTasks` — determines new pages + review pages; new pages fill up to `dailyNewPages`, reviews pull up to 3 oldest-reviewed memorized pages not yet reviewed today
- `completeTask` — marks a page memorized or reviewed; updates streak via `lastActiveDate` comparison in UTC
- `onboarding` — bulk-marks selected pages as memorized (with `memorizedDate` set to yesterday so they appear in today's review queue)

**Date handling**: all date comparisons use `YYYY-MM-DD` string format in UTC to avoid timezone edge cases.

### Frontend

**Entry point**: `client/src/main.jsx` → `App.jsx`

`App.jsx` defines all routes and wraps the app in `ThemeProvider` → `AuthProvider` → `ToastProvider`. Route layout:
- Public: `/`, `/about`, `/login`, `/register`
- Protected (via `ProtectedRoute`): `/dashboard`, `/onboarding`, `/progress`, `/library`, `/settings`

After login, if `user.onboardingComplete === false`, the app redirects to `/onboarding`.

**State management**: React Context — `context/AuthContext.jsx` holds the logged-in user and exposes `login`, `logout`, `updateUser` (token persisted in `localStorage` under key `'token'`); `ThemeContext.jsx` drives light/dark mode; `ToastContext.jsx` provides toasts. UI language (EN/AR) is handled by `react-i18next` (`src/i18n.js`, locales in `src/locales/`), which also sets `dir="rtl"` for Arabic.

**HTTP**: `services/api.js` — Axios instance with a request interceptor that automatically attaches `Authorization: Bearer <token>` from localStorage. `services/quranApi.js` fetches Quran content from external sources (page text, per-ayah audio, tafsir) with in-memory caching.

**Pages**:
- `Dashboard.jsx` — daily new memorization + review tasks; streak chip, motivational quote, card-based UI with completion tracking
- `Progress.jsx` — 30-Juz memorization map, per-page grid, Surah breakdown, charts, and milestone badges
- `Library.jsx` — full 604-page mushaf reader: per-ayah audio (multiple reciters), tafsir, and a guided "memorize mode" with active-recall self-testing
- `Onboarding.jsx` — Juz, Surah, or page-range selection to seed initial memorization state
- `Settings.jsx` — update display name, daily goal, review intensity, and rest days
- `About.jsx` — public project/about page

## Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Returns JWT |
| GET | `/api/auth/me` | Current user (protected) |
| PUT | `/api/auth/profile` | Update name, daily goal, and plan settings (protected) |
| PUT | `/api/auth/password` | Change password (protected) |
| DELETE | `/api/auth/account` | Delete account (protected) |
| POST | `/api/progress/onboarding` | Bulk-mark pages as memorized (protected) |
| PUT | `/api/progress/memorized` | Replace the set of memorized pages (protected) |
| DELETE | `/api/progress/reset` | Reset all progress (protected) |
| GET | `/api/progress/today` | Today's task list (protected) |
| POST | `/api/progress/complete` | Mark page done (protected) |
| POST | `/api/progress/uncomplete` | Undo a page completed today (protected) |
| GET | `/api/progress/all` | All memorized pages (protected) |
| GET | `/api/progress/juz` | Per-Juz progress summary (protected) |
| GET | `/api/progress/estimate` | Projected completion estimate (protected) |
| GET | `/api/progress/week` | This week's plan (protected) |
| POST | `/api/chat` | AI assistant chat (rate-limited) |

## Database Seeding

Run once to populate `QuranMetadata`:
```bash
cd server
node seed/quranData.js
```

`quranData.js` seeds straight from the committed `seed/data/quranStructure.json` — the
exact per-page mushaf structure (surahs, verse spans, juz/hizb, rub boundaries) for all
604 pages. That file is generated once from the quran.com API and committed; the app never
calls the external API at runtime. To regenerate it (rarely needed) run:
```bash
cd server
node seed/fetchQuranStructure.js   # needs network; rewrites seed/data/quranStructure.json
```

## Project Context (formerly a Graduation Project)

This started as a graduation project and **has been defended.** All proposal requirements — functional (FR-01–FR-13) and non-functional (NFR-01–NFR-07) — are implemented, and the app now goes beyond the original scope: a 604-page Quran reader/Library, per-ayah audio, tafsir, bilingual EN/AR i18n, dark mode, an AI chatbot, and richer scheduling. The full requirement→code mapping lives in [`docs/FEATURES.md`](docs/FEATURES.md).

The proposal is therefore a **historical reference, not a binding scope constraint.** Development now continues as ordinary product improvement — prioritize good UX and faithful Quranic rendering over proposal checkboxes.

### Non-Functional Requirements to Keep in Mind

- **Performance (NFR-01)**: All pages and core interactions must load within 3 seconds.
- **Browser support (NFR-02)**: Latest Chrome, Firefox, Safari, Edge.
- **Responsive design (NFR-03)**: Must work well on desktop, tablet, and mobile.
- **Arabic text (NFR-07)**: Arabic Quranic text must render with correct tashkeel (diacritics).

### Design Rationale

The smart review system is grounded in **Ebbinghaus's Forgetting Curve** and **spaced repetition** (Pimsleur 1967, Leitner System 1972): pages recently memorized are reviewed frequently; intervals grow as retention strengthens. The current implementation approximates this by pulling the oldest-reviewed pages first (up to 3/day). A more faithful spaced repetition algorithm (dynamic intervals per page based on review history) is a natural future enhancement.

The term **Muraja'ah** (مراجعة) refers to the Islamic tradition of systematic Quran revision — the "review" tasks in this app are the digital equivalent.
