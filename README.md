# Quran Tracker

A full-stack web app for memorizing the Quran. It builds a daily plan of new pages and spaced-repetition reviews (*muraja'ah*), tracks streaks and progress, and includes a page-exact Madinah mushaf reader with recitation and tafsir.

[![CI](https://github.com/ahmedelhappy/quran-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmedelhappy/quran-tracker/actions/workflows/ci.yml)

**Live app:** [quran-tracker-gilt.vercel.app](https://quran-tracker-gilt.vercel.app/)

---

## Features

### Memorization plan
- **Onboarding.** Mark what you already know by Juz, Hizb, quarter-Hizb, Surah or page range. Your plan starts from there. Partial pages can be marked verse by verse in the reader.
- **Daily tasks.** You get new pages at your own pace (half a page to 10 pages a day) plus reviews. Recently memorized pages come up often, and everything older rotates through a review cycle, oldest first.
- **Verse-level precision.** The verse is the unit of what you know; the page is the unit of scheduling. Half-page plans split a page at the verse boundary.
- **Flexible schedule.** Memorize from Al-Fatiha forward or from Juz 'Amma backward, start from any page, choose a review intensity, set rest days, or pause new memorization.
- **Streaks and an opt-in leaderboard.** The leaderboard shows only a display name you choose.

### Mushaf reader (Library)
- **The real page.** All 604 pages of the 15-line Madinah mushaf, drawn with the page-specific QCF glyph fonts, so every page matches the printed copy line for line.
- **Recitation.** Per-verse audio from several reciters, with speed control, verse and range repeat, and continuous playback across pages.
- **Tafsir.** Several editions in a resizable side panel that follows the selected or playing verse.
- **Study tools.** Highlights, notes, hard-verse flags, freehand ink, bookmarks, verse search, recently read pages, and an active-recall self-test that hides the text.
- **Public reading.** The reader, recitation and tafsir work without an account.

### Progress and tools
- A 30-Juz map, a per-page grid, a Surah breakdown, charts, milestones and a projected completion date.
- A shared timer and a personal to-do list in the reader and on the dashboard.
- An AI study assistant (Groq) that knows your plan and progress.
- English and Arabic UI with full right-to-left layout, plus light and dark themes.

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, React Router, react-i18next, Recharts |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| Auth & security | JWT, bcrypt, Helmet, CORS allow-list, rate limiting, input validation |
| Testing | Node test runner + supertest + mongodb-memory-server, Vitest + Testing Library, Playwright |
| CI / hosting | GitHub Actions, Vercel (client), Render (API) |

## Project structure

```
quran-tracker/
├── client/            React app (Vite)
│   ├── src/pages/     Dashboard, Library, Progress, Onboarding, Settings, Leaderboard…
│   ├── src/services/  API client, Quran content, audio and tafsir sources
│   ├── src/locales/   English and Arabic strings
│   └── e2e/           Playwright end-to-end flows
├── server/            Express API
│   ├── controllers/   Request handlers and scheduling logic
│   ├── models/        Mongoose schemas
│   ├── routes/        /api/auth, /api/progress, /api/annotations, /api/chat…
│   ├── seed/          Quran structure data and seeding scripts
│   └── tests/         API integration tests
└── docs/              Architecture guide, feature map, roadmap and audit
```

## Getting started

### Prerequisites
- **Node.js 22.22+ or 24.15+** (the repo pins 24.19.0 in `.nvmrc`)
- A **MongoDB** connection string (a free MongoDB Atlas cluster works)
- Optionally, a **Groq API key** for the AI assistant

### 1. Configure the API
```bash
cd server
npm install
cp .env.example .env
```
Fill in `server/.env`. `MONGODB_URI` and `JWT_SECRET` are required. Every other variable is documented in [`server/.env.example`](server/.env.example).

### 2. Seed the Quran structure (once per database)
```bash
node seed/quranData.js --uri "<your MONGODB_URI>"
```
This loads the per-page structure of all 604 pages from the committed `seed/data/quranStructure.json`. The seed scripts only run against a database you name explicitly. To add a demo account with sample progress, run `npm run seed:demo -- --uri "<your MONGODB_URI>"`.

### 3. Run both apps
```bash
# Terminal 1: API on http://localhost:5000
cd server && npm run dev

# Terminal 2: client on http://localhost:5173
cd client && npm install && npm run dev
```
In development the client calls `http://localhost:5000/api`. Production builds require `VITE_API_URL` to be set.

## Testing

| Command | Runs |
|---|---|
| `cd server && npm test` | API integration tests on an in-memory MongoDB |
| `cd client && npm test` | Unit tests for the client's helpers (Vitest) |
| `cd client && npm run lint` | ESLint |
| `cd client && npm run test:e2e` | End-to-end browser flows (Playwright) on an isolated stack |

The tests never touch a real database. GitHub Actions runs all four on every push and pull request to `main`.

## Deployment

- **Client:** Vercel, with `client/` as the root and `VITE_API_URL` set to the API's `/api` URL. Security headers and caching rules live in [`client/vercel.json`](client/vercel.json).
- **API:** Render, defined by the blueprint in [`render.yaml`](render.yaml). Secrets (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `GROQ_API_KEY`) are set in the Render dashboard. `GET /health` serves as the health check.

## Documentation

| Document | Contents |
|---|---|
| [`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md) | How the code fits together, with a guided reading path |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Every requirement mapped to the code that implements it |
| [`docs/IMPROVEMENT_PLAN.md`](docs/IMPROVEMENT_PLAN.md) | Roadmap and a dated log of every change |
| [`docs/AUDIT_2026-10.md`](docs/AUDIT_2026-10.md) | Pre-launch security, reliability and quality audit |

## Background

Quran Tracker began as a graduation project and has since grown well beyond its original scope. The review scheduler follows the spaced-repetition principle (Ebbinghaus's forgetting curve; Pimsleur; Leitner): new material is reviewed often, and the intervals grow as it settles.

## Acknowledgements

Quranic content is loaded from these public sources, which remain the property of their respective owners:

- [Quran.com API](https://api-docs.quran.com/): page layout, verse data and the QCF mushaf fonts
- [Al Quran Cloud](https://alquran.cloud/) and the Islamic Network CDN: verse text and recitations
- [EveryAyah](https://everyayah.com/): recitations
- [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) and the Hefz Moyaser API: tafsir editions

## License

No open-source license has been chosen yet, so all rights are reserved for now. Quranic text, fonts, recitations and tafsir belong to their respective owners.
