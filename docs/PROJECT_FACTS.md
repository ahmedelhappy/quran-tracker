# Project Facts & Figures — Quran Memorization Tracker

A single quick-reference of every hard number, limit, constraint, and boundary in
the project — for fielding panel questions during the defense. Figures verified
against the codebase and the graduation documentation (v3). Where the two disagree,
the **code** is treated as authoritative and the conflict is flagged in §16.

---

## 1. Quran domain numbers
- **604** pages (standard Madani Mushaf layout)
- **30** Juz (~20 pages each; average 20.13 pages/Juz)
- **114** Surahs
- A page may span **two** Surahs (handled by `surahs[]` in QuranMetadata)

## 2. Daily pace (new memorization)
- **`dailyNewPages`**: min **0.5**, max **10**, default **1**
- Onboarding presets offered: **0.5, 1, 2, 5** pages/day
- Fractional goal handling: 0.5/day → one page every other day (compares
  cumulative pages due by yesterday vs. today)

## 3. Review engine — intensity → cycle length
| Settings preset | Engine intensity | Cycle | Daily review pages |
|---|---|---|---|
| Relaxed | light | 14 days | ceil(memorized / 14), capped **40** |
| Balanced (default) | standard | 10 days | ceil(memorized / 10), capped **40** |
| Serious | strong | 7 days | ceil(memorized / 7), capped **40** |
| Fixed number | manual override | — | exact count set by user |
| Hafiz (all 604) | standard / strong | — | **60** / **~87** pages per day |

- Daily review **cap: 40 pages** (all scaled presets)
- Two disjoint buckets every day: **Recent** (last few active days, reviewed often)
  + **Cycle** (everything older, oldest-reviewed-first); recent pages excluded from
  cycle so none appears twice
- **`recentReviewCount`**: default null, min 0, max **20**
- **`cycleReviewCount`**: default null, min 0, max **40**
- **`cycleReviewStartPage`**: 1–604 (default null)

## 4. Rest days, pause, streak
- **`offDays`**: array of weekday numbers **0–6** (0 = Sunday … 6 = Saturday)
- Max **6** off days (must keep at least **1** active day/week)
- Rest day → returns empty task list but **preserves the streak**
- Paused user (`pauseNewMemorization`) → receives **reviews only**, no new pages
- **`currentStreak`**: default 0; counts consecutive active days
- All date comparisons use **UTC `YYYY-MM-DD` strings** (timezone-safe)

## 5. Account / input limits
- **Password**: minimum **6** characters (hashed, never returned)
- **Name**: maximum **50** characters
- **Email**: unique, lowercased, regex-validated
- **`language`**: enum `en` / `ar`, default `en`

## 6. Security & auth
- Passwords hashed with **bcrypt**, salt rounds = **10**
- **JWT** expiry = **30 days**, carries user id; verified by `protect` middleware
- Password excluded from queries by default (`select: false`)
- Client logs out automatically on any **401**
- **Chat rate limit**: **20 requests / 5 minutes** per user
- **Chat message validation**: **1–10** messages per request, each ≤ **2000** chars
- Server middleware: Helmet headers, CORS allow-list, gzip compression, morgan logging
- Chat fails safe: if the progress-context lookup throws, the assistant continues
  without context rather than breaking

## 7. Data model — 3 collections
- **User** — one document per user
- **UserProgress** — **one document per (user, page) pair**
  - `pageNumber` 1–604; `status` enum `not_started` | `memorized` (default not_started)
  - `reviewCount` default 0, min 0; `memorizedDate`, `lastReviewedDate`
  - Indexes: **unique** `{userId, pageNumber}`; `{userId, status}`; `{userId, lastReviewedDate}`
- **QuranMetadata** — **604** static reference rows
  - `pageNumber` 1–604 (unique); `juzNumber` 1–30; `surahName`, `surahNameArabic`, `surahs[]`

## 8. Requirements coverage
- **13 / 13** functional requirements (FR-01 – FR-13) — all implemented
- **7 / 7** non-functional requirements (NFR-01 – NFR-07) — all met
  - NFR-01: pages/core interactions load within **3 seconds**
  - NFR-02: latest **Chrome, Firefox, Safari, Edge**
  - NFR-03: responsive — desktop, tablet, mobile
  - NFR-04: bcrypt one-way hashing
  - NFR-05: JWT sessions
  - NFR-06: **99%+** availability — *addressed, hosting-dependent* (health endpoint +
    external uptime monitor; not a code guarantee)
  - NFR-07: Arabic text with correct tashkeel (diacritics)

## 9. Technology stack & versions
- **Frontend**: React **19** (Vite **7**), Tailwind CSS **4**, React Router **7**, Axios
- **Localization**: i18next / react-i18next
- **Visualization**: Recharts, React Icons
- **Guidance**: driver.js
- **Backend**: Node.js, Express **5**
- **Database / ODM**: MongoDB Atlas, Mongoose **9**
- **Auth & security**: jsonwebtoken, bcryptjs, Helmet, CORS, express-rate-limit,
  compression, morgan
- **AI**: groq-sdk, model **`llama-3.3-70b-versatile`** (server-side only)
- **Testing**: node:test, Supertest, mongodb-memory-server
- **Deploy**: Render (hosting) + UptimeRobot (monitoring)

## 10. Testing
- **17** automated backend tests (run via `npm test`, all passing)
  - **6** authentication tests (`auth.test.js`)
  - **11** progress / spaced-repetition tests (`progress.test.js`)
- In-memory MongoDB (mongodb-memory-server) — isolated, no live DB or network port
- Plus manual testing, user-acceptance testing, and cross-browser / cross-device
  checks in both LTR and RTL

## 11. External integrations (no Quran content stored locally)
- **Page text**: alquran.cloud (quran-uthmani) — Uthmani script, full diacritics (NFR-07)
- **Audio**: cdn.islamic.network audio CDN — per-ayah, **5 reciters**, auto-advance
  - (One reciter was **removed** after its CDN returned **HTTP 403** — tested live)
- **Tafsir**: alquran.cloud + jsDelivr CDN — **4 editions**, per page and per ayah
- **AI**: Groq (`llama-3.3-70b-versatile`)
- All Quran content is **cached in memory client-side** for instant revisits

## 12. Internationalization & theming
- **2** languages: English + Arabic, **599** translation keys per language
- Document-level **RTL** switch for Arabic (whole layout mirrors, not just text)
- **3** theme modes: light, dark, system

## 13. Performance facts
- Target: all pages/interactions < **3 s** (NFR-01)
- Techniques: gzip, client-side memoization of Quran content, parallel dashboard
  fetches, skeleton loaders, optimistic updates with undo
- Production JS bundle: single chunk **~976 kB** (**~284 kB** gzipped) — route-level
  code-splitting is noted as future work

## 14. Project meta
- Team: **8** members; Supervisor: Dr. Waleed Abd El-Khalik
- Institution: Tanta University — Faculty of Computers and Information, CS Dept.
- Academic year: **2025 – 2026**
- Timeline: **20 weeks**, **5** phases (Initiation/Planning, Design, Implementation,
  Testing, Documentation/Delivery)
- Repo: two independent Node apps — `client/` (React) and `server/` (Express)
- Live deployment: https://quran-tracker-gilt.vercel.app/

## 15. Scope boundaries (current release)
**In scope:** account management; onboarding by Juz/Surah/page-range; daily plan with
spaced-repetition reviews, rest days, pause, Hafiz maintenance; progress visualization,
streaks, achievements; Mushaf Library (text + audio + tafsir + Memorize self-test);
guidance tours; progress-aware AI assistant; bilingual Arabic/English RTL; light/dark/system.

**Out of scope (deferred):**
- Native mobile apps (responsive web only)
- Voice-based recitation assessment / automatic mistake detection
- Social / competitive features (public leaderboards)
- Sub-page (line / half-page) tracking granularity

## 16. Known discrepancies to reconcile
- **Backend test count**: code has **17** (6 + 11) — the documentation Chapter 6 says
  **13** (6 + 7) and Table 6.1 lists only **TC-01–TC-13**. The **deck (17) is correct**;
  update the documentation's Chapter 6 text and test-case table to match the code.
- Earlier project notes (CLAUDE.md) mention "reviews pull up to 3 oldest-reviewed
  pages/day" — that is the *original* simple rule; the **current** engine uses the
  intensity-scaled two-bucket model in §3. Cite §3.
