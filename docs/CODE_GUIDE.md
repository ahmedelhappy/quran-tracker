# Code Guide — A Plain-Language Walkthrough

**Who this is for:** you, the developer — originally written for the graduation defense
(now passed ✅), this guide's job today is different: it's your **study companion for
learning full-stack development through this codebase**, and later, interview prep. It
assumes JavaScript basics and explains *how the whole thing fits together* and *why* it
was built this way.

Start with [§0 — How to study this codebase](#0-how-to-study-this-codebase-a-5-day-path)
if you're here to learn.

This is a study guide, not marketing. Where something is an approximation or a known
trade-off, it says so honestly — those are exactly the places interviewers (and
professors) probe.

Paths are written relative to this file (it lives in `docs/`), so the links are
clickable. Frontend code is under [`../client/src/`](../client/src/), backend under
[`../server/`](../server/).

For the formal requirement-to-code mapping (FR/NFR table), see
[FEATURES.md](FEATURES.md). This guide is the *narrative* companion to that table.

---

## Table of contents

0. [How to study this codebase (a 5-day path)](#0-how-to-study-this-codebase-a-5-day-path)
1. [The big picture: how the pieces talk](#1-the-big-picture-how-the-pieces-talk)
2. [The data models](#2-the-data-models)
3. [Authentication, end to end](#3-authentication-end-to-end)
4. [The core: how the daily plan is built](#4-the-core-how-the-daily-plan-is-built)
5. [Frontend structure](#5-frontend-structure)
6. [The Library reader](#6-the-library-reader)
7. [Onboarding & in-app guidance](#7-onboarding--in-app-guidance)
8. [The Progress and Settings pages](#8-the-progress-and-settings-pages)
9. [External integrations: Quran content & the AI assistant](#9-external-integrations)
10. [Likely professor questions & answers](#10-likely-professor-questions--answers)
11. [Glossary](#11-glossary)

---

## 0. How to study this codebase (a 5-day path)

You know ~70% of React frontend and have backend clues; the goal is a working high-level
mental model of a real MERN app in under a week, as the launchpad for a full-stack learning
track. This codebase is a genuinely good syllabus: it has auth, a non-trivial scheduling
algorithm, indexes, tests, i18n/RTL, and external API integration — all small enough to
actually read.

**Method (matters more than the schedule):**
- **Predict, then verify.** Before opening a file, write one sentence guessing what it does
  and how. Being wrong is the useful part.
- **Read tests as documentation.** `server/tests/*.test.js` shows exactly how every endpoint
  is *supposed* to behave — often clearer than the controller itself. Run `npm test` early.
- **Replay history.** `git log --oneline` is the project's story. Pick a feature commit and
  read its diff — you'll see how a feature actually lands across files.
- **AI as explainer, not writer.** During the study week, ask AI to explain code you've
  already tried to read — don't let it write anything. The point is building your model.
- Keep a `questions.md` scratch file; most questions answer themselves by day 3 — the rest
  are gold.

**Day 1 — Run it, then trace ONE request end-to-end.** Start both apps (`server`: `npm run
dev`, `client`: `npm run dev`). Then trace *login* through every layer, in this order:
[Login.jsx](../client/src/pages/Login.jsx) → [AuthContext.jsx](../client/src/context/AuthContext.jsx)
→ [api.js](../client/src/services/api.js) (interceptor) → [authRoutes.js](../server/routes/authRoutes.js)
→ [authController.js](../server/controllers/authController.js) → [User.js](../server/models/User.js)
(hash hook) → back. Watch the request in DevTools' Network tab. If you can narrate this
round-trip cold, you understand "full stack" as an architecture.

**Day 2 — Backend day.** Read the three data models (§2), then [middleware/auth.js](../server/middleware/auth.js),
then [progressController.js](../server/controllers/progressController.js) with §4 of this
guide open beside it — `getTodayTasks` is the hardest and most valuable read in the repo.
Then read `server/tests/progress.test.js` and run the suite. Finish by breaking something on
purpose (rename a field, watch which test fails) — nothing teaches structure faster.

**Day 3 — React day.** [main.jsx](../client/src/main.jsx) → [App.jsx](../client/src/App.jsx)
(providers + routes) → the three contexts (§5) → one simple page ([Progress.jsx](../client/src/pages/Progress.jsx))
→ then [Dashboard.jsx](../client/src/pages/Dashboard.jsx) (the canonical fetch→state→render
page, §5). Exercise: find one real usage each of `useState`, `useEffect`, `useMemo`,
`useCallback`, `useRef` in the codebase and explain to yourself why *that* hook and not
another.

**Day 4 — The hard file + the presentation layer.** [Library.jsx](../client/src/pages/Library.jsx)
with [mushafApi.js](../client/src/services/mushafApi.js) and
[MushafPage.jsx](../client/src/components/MushafPage.jsx) (§6). Read the IMPROVEMENT_PLAN
progress log first so you know how it evolved. Then skim [i18n.js](../client/src/i18n.js) +
a locale file, and the Tailwind setup in [index.css](../client/src/index.css).

**Day 5 — Prove it.** Build one tiny feature end-to-end *yourself* (AI allowed only for
explanations): e.g. bookmark colors, or a `GET /api/progress/reviewed-this-week` endpoint +
a small stat card. Touch model → route → controller → test → api.js → component. Write at
least one backend test for it. If this takes you a full day, that's normal and it's the
single highest-value day of the five.

After that, continue improving the app via [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) — each
stage you review and accept is itself a lesson.

---

## 1. The big picture: how the pieces talk

The app is **two independent Node programs** in one repository:

- **`client/`** — a React 19 single-page app, built/served by Vite, styled with Tailwind.
  It runs in the user's browser.
- **`server/`** — an Express 5 REST API backed by MongoDB (via the Mongoose library).
  It runs on a server.

They never share memory or code. They talk **only** over HTTP, exchanging JSON. That
separation is the single most important architectural fact to be able to state.

```
   BROWSER (the user's machine)                      SERVER (Node process)
 ┌───────────────────────────────┐                ┌──────────────────────────────┐
 │  React app (client/)          │                │  Express API (server/)       │
 │                               │   HTTP + JSON  │                              │
 │  Pages (Dashboard, Progress…) │  ───────────▶  │  Routes  →  Controllers      │
 │      │                        │   GET/POST/…   │     │            │           │
 │      ▼                        │                │     ▼            ▼           │
 │  services/api.js (axios)      │  ◀───────────  │  middleware   Mongoose models│
 │  attaches "Bearer <token>"    │   JSON reply   │  (auth, etc.)      │         │
 └───────────────────────────────┘                └────────────────────┼─────────┘
                                                                        ▼
                                                              ┌──────────────────┐
                                                              │  MongoDB Atlas   │
                                                              │  (cloud database)│
                                                              │  users,          │
                                                              │  userprogresses, │
                                                              │  quranmetadatas  │
                                                              └──────────────────┘
```

**Where each piece lives:**

| Concern | File | What it does |
|---|---|---|
| Server bootstrap | [../server/server.js](../server/server.js) | Connects to MongoDB, then starts listening on `PORT` (default 5000). |
| Express app config | [../server/app.js](../server/app.js) | Wires up middleware (CORS, JSON parsing, `helmet`, `compression`, request logging) and mounts the three route groups. Kept separate from `server.js` so tests can import the app without opening a real DB connection or a network port. |
| Route groups | [../server/routes/](../server/routes/) | `/api/auth`, `/api/progress`, `/api/chat`. |
| Business logic | [../server/controllers/](../server/controllers/) | The actual work for each endpoint. |
| Data shapes | [../server/models/](../server/models/) | Mongoose schemas: `User`, `UserProgress`, `QuranMetadata`. |
| Frontend HTTP layer | [../client/src/services/api.js](../client/src/services/api.js) | One axios instance that every page calls through. |

**The request lifecycle**, in one sentence: a React page calls a function in `api.js` →
axios sends an HTTP request with the user's token attached → Express matches it to a
route → middleware checks the token → a controller runs the logic and queries MongoDB
through Mongoose → the controller sends JSON back → the page updates its state and
re-renders.

In [app.js](../server/app.js) the route groups are mounted like this:

```js
app.use('/api/auth', require('./routes/authRoutes'));      // register, login, profile
app.use('/api/progress', require('./routes/progressRoutes')); // the memorization plan
app.use('/api/chat', require('./routes/chatRoutes'));       // the AI assistant
app.use('/api/bookmarks', require('./routes/bookmarkRoutes')); // saved page bookmarks
```

There's also a `GET /health` endpoint returning `{ status: 'ok' }` — that's not for users,
it's for an uptime monitor (UptimeRobot) to ping.

---

## 2. The data models

All three models live in [../server/models/](../server/models/). A Mongoose *schema*
describes the shape of a document; a *model* is the thing you query. MongoDB stores
documents (JSON-like records) in *collections* (like tables, but schema-flexible).

### User — [../server/models/User.js](../server/models/User.js)

One document per registered person. The fields worth knowing:

| Field | Meaning |
|---|---|
| `name`, `email`, `password` | Credentials. `email` is `unique` + lowercased; `password` has `select: false` so it's **never returned by a query unless explicitly asked for** (more on that in §3). |
| `dailyNewPages` | The user's goal: how many new pages to memorize per day. Range **0.5–10**, default 1. The 0.5 case (a page every *other* day) is handled specially — see §4. |
| `currentStreak` | Consecutive active days. |
| `lastActiveDate` | The last day the user did something. This single field is what the streak math compares against. |
| `onboardingComplete` | Has the user finished the initial "what do you already know" setup? Controls redirects on the frontend. |
| `planStartDate` | The day the user's *plan* began (set at onboarding). Crucial: it's the cutoff that separates "pages I already knew" from "pages I memorized through the app." |
| `reviewIntensity` | `'light' | 'standard' | 'strong'` — how aggressively to schedule reviews. |
| `offDays` | An array of weekday numbers (0 = Sunday … 6 = Saturday) the user takes off. |
| `pauseNewMemorization` | Pause new pages but keep reviewing. |
| `recentReviewCount`, `cycleReviewCount` | Optional manual overrides for the two review buckets. `null` means "use the automatic formula." |
| `cycleReviewStartPage` | Optional: where in the mushaf the cycle review should start from. |
| `language` | `'en'` or `'ar'`. |
| `pausedFromOnboarding` | Set when a user finished onboarding already knowing pages but chose to pause new memorization first — drives the "first cycle complete" celebration. |
| `prevStreak`, `prevActiveDate` | A snapshot of the streak state taken at the day's *first* streak-affecting action. Exists so that undoing the day's only completion can honestly restore the streak — the old `lastActiveDate` isn't reconstructible once overwritten. |

`timestamps: true` auto-adds `createdAt` / `updatedAt`.

**Two methods matter for auth:**
- A `pre('save')` hook hashes the password with **bcryptjs** before every save (only when
  the password actually changed).
- `matchPassword(entered)` compares a plaintext attempt against the stored hash.

### UserProgress — [../server/models/UserProgress.js](../server/models/UserProgress.js)

This is the heart of the data design: **one document per (user, page) pair.** With 604
pages in the Quran, a user who has memorized 200 pages has 200 of these documents.

| Field | Meaning |
|---|---|
| `userId` | Reference to the owning `User`. |
| `pageNumber` | 1–604. |
| `status` | `'not_started'` or `'memorized'`. In practice a document only gets created once a page becomes memorized. |
| `memorizedDate` | When the page was first memorized. |
| `lastReviewedDate` | When it was last revised. **This field drives review scheduling** — the oldest one is the most "due." |
| `reviewCount` | How many times it has been reviewed. |

Three indexes make the common queries fast:
- `{ userId, pageNumber }` is **unique** — the database itself guarantees you can't have
  two records for the same page for the same user.
- `{ userId, status }` — for "give me all this user's memorized pages."
- `{ userId, lastReviewedDate }` — for "sort this user's pages by how stale their review is."

**Why one doc per page instead of one array on the User?** Covered in §7, but the short
version: per-page history (dates, counts) is exactly what spaced repetition needs, and
indexed per-page queries scale better than rewriting one giant array on every action.

### QuranMetadata — [../server/models/QuranMetadata.js](../server/models/QuranMetadata.js)

A static lookup table: 604 documents, one per page, describing **what is on that page** —
its `juzNumber`, `surahName` / `surahNameArabic`, and a `surahs` array (a page can span
more than one surah). This never changes per user; it's reference data.

It's seeded once with [../server/seed/quranData.js](../server/seed/quranData.js)
(`node seed/quranData.js`). Controllers join against it only to *label* pages for display
— it holds no Quran text. The actual Arabic text and audio come from an external API (§6).

### Bookmark — [../server/models/Bookmark.js](../server/models/Bookmark.js)

The newest model: one document per saved page bookmark — `{ userId, pageNumber, label? }`,
capped at 100 per user. Uniqueness is enforced by the database itself: a **unique**
`{ userId, pageNumber }` index means one bookmark per page per user, and non-empty labels
are checked unique per user case-insensitively (a Mongo *collation* query — worth reading in
[bookmarkController.js](../server/controllers/bookmarkController.js) as a small, complete
example of model + controller + routes + tests done end-to-end).

### How they relate

```
User (1) ───────< UserProgress (many)        QuranMetadata (reference, not user-specific)
  _id            userId → User._id              pageNumber ◀── joined by page number
                 pageNumber ───────────────────────────────┘
```

A user owns many progress records; each progress record points back to its user and is
*labeled* by joining its `pageNumber` to a `QuranMetadata` row.

---

## 3. Authentication, end to end

Goal: only logged-in users can touch their data, and we never store or transmit a
password in readable form.

### Step 1 — Register issues a token
[../server/controllers/authController.js](../server/controllers/authController.js) → `register`:
1. Reject if the email already exists.
2. `User.create({ name, email, password })`. The model's `pre('save')` hook hashes the
   password here automatically.
3. `generateToken(user._id)` signs a **JWT** (JSON Web Token) containing just the user id,
   using `process.env.JWT_SECRET`, valid for 30 days.
4. Return the token + safe user fields (never the password).

### Step 2 — Login verifies and re-issues
`login` in the same file:
1. `User.findOne({ email }).select('+password')` — the `+password` explicitly overrides
   the schema's `select: false` so we can read the hash *just here*.
2. `user.matchPassword(password)` runs `bcrypt.compare`, which re-hashes the attempt with
   the stored salt and checks for a match. We never decrypt anything — bcrypt is a one-way
   hash.
3. On success, sign and return a fresh JWT. Note the deliberately vague "Invalid email or
   password" message for both wrong-email and wrong-password — that avoids leaking which
   accounts exist.

### Step 3 — The browser stores and attaches the token
On the client, [../client/src/context/AuthContext.jsx](../client/src/context/AuthContext.jsx)
saves the token to `localStorage` under the key `'token'`. Then the axios instance in
[../client/src/services/api.js](../client/src/services/api.js) attaches it to **every**
outgoing request via a request interceptor:

```js
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

There's also a *response* interceptor: if any call comes back `401 Unauthorized`, it wipes
the token and bounces the user to `/login`. That's how an expired session self-heals.

### Step 4 — The server verifies it on protected routes
[../server/middleware/auth.js](../server/middleware/auth.js) exports `protect`:
1. Read the `Authorization` header, confirm it starts with `Bearer`, split out the token.
2. `jwt.verify(token, JWT_SECRET)` — this both checks the signature (proves we issued it)
   and that it hasn't expired. If either fails it throws, and we return `401`.
3. `User.findById(decoded.id)` and attach the result to `req.user`, so every downstream
   controller knows who's calling.

How routes opt in: in [../server/routes/progressRoutes.js](../server/routes/progressRoutes.js)
the line `router.use(protect)` applies the guard to *all* progress routes. In
[../server/routes/authRoutes.js](../server/routes/authRoutes.js) it's applied per-route, so
`register` and `login` stay public while `/me`, `/profile`, etc. are protected.

### Password storage in one breath
Passwords are hashed with **bcryptjs** at salt strength 10 (`bcrypt.genSalt(10)`), stored
only as the hash, marked `select: false` so they never come back in normal queries, and
compared with `bcrypt.compare`. We could not reveal a user's password even if asked — we
don't have it.

---

## 4. The core: how the daily plan is built

This is the most important function to understand and the one most worth defending. It is
`getTodayTasks` in
[../server/controllers/progressController.js](../server/controllers/progressController.js).
Every time the dashboard loads, it calls this to get "what should I do today?"

The answer has two parts: **new pages to memorize** and **review pages (Muraja'ah)**.

### The science it implements (be ready to explain WHY)

- **Ebbinghaus's forgetting curve (1885):** memory of newly learned material decays
  roughly exponentially over time *unless* it's reinforced. The freshest material is the
  most fragile.
- **Spaced repetition (Pimsleur 1967, Leitner 1972):** if you review material at the right
  moments — frequently at first, then at growing intervals — each review "resets" the
  forgetting curve and flattens it, so retention lasts longer with less total effort.

This app turns that theory into two review "buckets":

1. **Recent review** — pages memorized in the last few active days. These are the most
   fragile (steepest part of the forgetting curve), so they're reviewed *often*.
2. **Cycle review** — everything older, revisited on a rotation. The whole memorized set
   gets cycled through over a window of days. Within the cycle, pages are taken
   **oldest-reviewed-first**, i.e. whichever page is closest to being forgotten is offered
   first. That's the practical proxy for "review it right before you'd lose it."

The honest caveat (state it before a professor does): this is an *approximation* of true
per-item spaced repetition (like SM-2/Anki, where each item carries its own growing
interval). Here intervals are governed by set-wide rotation speed and a recent-window
heuristic rather than a per-page schedule. It's faithful to the *principle* and is a
deliberate, defensible simplification — a per-page interval algorithm is the natural next
step.

### Walking through `getTodayTasks`

**Date handling first (it underpins everything).** A tiny helper converts any date to a
`YYYY-MM-DD` string in **UTC**:
```js
const getDateString = (date) => new Date(date).toISOString().split('T')[0];
```
All "is this today?" comparisons compare these strings. Using UTC consistently avoids
timezone bugs where "today" shifts depending on the server's locale (see §7).

**A) Off days.** If today's weekday is in the user's `offDays` (and they didn't explicitly
override with `?ignoreOffDay=true`), the function returns empty task lists with
`isOffDay: true`. Importantly it still *preserves the streak*: if the streak is alive, it
bumps `lastActiveDate` to today so a scheduled rest day doesn't break the chain.

**B) Load the raw material.** It fetches all of the user's memorized pages, sorted by
`lastReviewedDate` ascending then `pageNumber`:
```js
const allMemorizedPages = await UserProgress.find({ userId, status: 'memorized' })
  .sort({ lastReviewedDate: 1, pageNumber: 1 });
```
That sort is the engine of "oldest-reviewed-first": the most stale pages are already at the
front of the list.

**C) How many *new* pages today?** `computeNewPageTargetForDate(dailyNewPages, planStart, today)`
figures out the quota. The clever bit is fractional goals. For 0.5 pages/day it computes the
cumulative pages that *should* have been assigned by yesterday vs. by today and returns the
difference:
```js
const assignedToday     = Math.ceil(dailyNewPages * (daysPassed + 1));
const assignedYesterday = Math.ceil(dailyNewPages * daysPassed);
return Math.max(0, assignedToday - assignedYesterday);
```
So at 0.5/day you get one page one day, zero the next — exactly "a page every other day."
New pages are then chosen by walking 1→604 and taking the first not-yet-memorized pages
(Quran order). New pages are skipped entirely for a `pauseNewMemorization` user or a
**Hafiz** (someone who's memorized all 604 — nothing new left, review only).

On a "zero new pages" day (the off-cycle half of a 0.5/day plan), it surfaces a
**continuation page** — the most recently memorized page — so the user keeps consolidating
instead of seeing an empty column.

**D) How many *reviews* today?** `computeDailyReviewTarget(totalMemorized, reviewIntensity)`
sets the cycle size:
- 0 if nothing is memorized.
- For a full Hafiz (604): a fixed daily load (`standard` = 60 pages/day; `strong` finishes
  the whole Quran in 7 days, ≈87/day).
- Otherwise the memorized set is divided across a *cycle length* in days — `light` = 14,
  `standard` = 10, `strong` = 7 — capped at 40/day:
  ```js
  return Math.min(Math.ceil(totalMemorized / cycleDays), 40);
  ```
  So at `standard`, the whole memorized portion is reviewed about every 10 days. A manual
  `cycleReviewCount` on the user overrides the formula.

**E) Splitting recent vs. cycle so no page appears twice.** The function computes the last
**three active days** (days the user actually memorized or reviewed, on/after
`planStartDate` — which is why onboarding pages, dated "yesterday" before the plan started,
are excluded). Pages memorized within that recent window are owned by the **recent review**
bucket; the **cycle** bucket explicitly excludes them so a page is never shown in both
sections at once.

- *Recent review pages*: the recent-window pages not yet reviewed today, capped by
  `recentReviewCount` or the formula `max(3, min(ceil(dailyNewPages*3), 6))`.
- *Cycle review pages*: everything else memorized (minus today's new pages), already sorted
  oldest-reviewed-first, sliced to the remaining daily target. The next few beyond the
  target become `extraReviewPages` for the dashboard's "Want more?" section.

**F) Labeling.** All the chosen page numbers are looked up in `QuranMetadata` in a single
batched query (`getMetadataMap`) — not one query per page — then mapped into display DTOs
with surah names and juz numbers.

**G) Stats & a "view-only" streak tick.** It returns totals, percentage, completion flags,
and an estimated finish date. If the day is already complete and the streak is still alive,
it bumps `lastActiveDate` even though the user marked nothing — so simply *finishing* (or
having nothing due) keeps the streak honest.

### Completing a task and the streak rule

`markPageComplete` (same file) handles the POST when a user taps "mark complete":
- **type `'new'`** → upsert the page as `memorized` with `memorizedDate = now`, increment
  `reviewCount`. The "I already know this" button instead back-dates `memorizedDate` to
  yesterday so the page doesn't eat today's new quota — freeing the slot for the next page.
- **type `'review'`** → set `lastReviewedDate = now`, increment `reviewCount`.

Then the **streak update**, which is the part to memorize:
```
no lastActiveDate yet      → streak = 1   (first ever activity)
lastActiveDate is today    → unchanged    (already counted today)
isStreakContinued(...)     → streak + 1   (consecutive day, or only off-days in the gap)
otherwise                  → streak = 1   (a real day was missed → reset)
```
`isStreakContinued` is what makes rest days not break the chain: if the gap since
`lastActiveDate` is more than one day, it checks every in-between day and only breaks the
streak if one of those days was **not** an off day.

The same logic is also exposed read-only as `buildProgressSummary`, which the AI assistant
reuses to answer "what should I memorize today?" from the user's real numbers (§6).

---

## 5. Frontend structure

### Routing — [../client/src/App.jsx](../client/src/App.jsx)

`App` nests the global providers and the router:

```
<ThemeProvider>          // dark/light/system theme
  <AuthProvider>         // who is logged in
    <ToastProvider>      // pop-up notifications
      <Router> … <Routes> … </Router>
```

Routes fall into two kinds:
- **Public** (`/`, `/about`, `/login`, `/register`) — wrapped in `PublicRoute`, which
  *redirects logged-in users away* to the dashboard.
- **Protected** (`/dashboard`, `/onboarding`, `/settings`, `/progress`, `/library`) —
  wrapped in [`ProtectedRoute`](../client/src/components/ProtectedRoute.jsx), which shows a
  spinner while auth is being checked and redirects to `/login` if there's no user.

Two small wrappers enforce the onboarding flow: `DashboardWrapper` sends users to
`/onboarding` if `onboardingComplete` is false, and `OnboardingWrapper` sends already-set-up
users to `/dashboard`. A `useEffect` also sets `document.dir` to `rtl` when the language is
Arabic — that's what makes the whole UI mirror for Arabic.

### Auth state — [../client/src/context/AuthContext.jsx](../client/src/context/AuthContext.jsx)

A React Context is the app-wide store for "the current user." It exposes `user`, `loading`,
and the actions `login`, `register`, `logout`, `updateUser`, `refreshUser`. On first mount
it runs `checkAuth()`: if there's a token in `localStorage`, it calls `GET /api/auth/me` to
rehydrate the user (so a refresh keeps you logged in). `login`/`register` store the token
and set the user; `logout` clears both. Any component calls `useAuth()` to read or change
this.

### One page in detail — [../client/src/pages/Dashboard.jsx](../client/src/pages/Dashboard.jsx)

This is the canonical "fetch then render" pattern:

1. **Fetch on mount.** A `useEffect` runs once and fires two requests in parallel:
   ```js
   const [taskRes, juzRes] = await Promise.all([
     progressAPI.getTodayTasks(),
     progressAPI.getJuzProgress(),
   ]);
   setData(taskRes.data.data);
   setJuzData(juzRes.data.data);
   ```
   `Promise.all` means both load together rather than one-after-the-other (faster — relevant
   to the < 3s performance requirement). While `loading` is true the page shows skeleton
   placeholders (the `Sk` component); on failure it shows a toast.

2. **Render from state.** The returned `data` drives everything: the stats "bento" cards
   (streak chip, **current-Juz ring**, memorized-pages stat), and the **Today / This Week**
   tabs. New pages and review pages render as `TaskCard`s; recent-review pages get a "recent"
   badge.

3. **Acting on a task — optimistic UI.** When the user taps "mark complete":
   ```js
   await progressAPI.markComplete({ pageNumber, type });
   setCompletedKeys(prev => new Set(prev).add(`${type}-${pageNumber}`));
   ```
   Instead of re-fetching the whole list, the page records the completed key locally and the
   card immediately flips to a "Done" state with an **Undo** option (which calls the
   `/uncomplete` endpoint). This keeps the UI feeling instant. `markingKeys` disables a
   button mid-request so a double-tap can't double-submit.

Every page follows this rhythm: call a function from
[../client/src/services/api.js](../client/src/services/api.js), store the JSON in state,
render from state, and mutate through small POST/PUT calls.

**Two stat-card details worth knowing, since they changed from a simpler first version:**

- **Current-Juz ring**, not a 30-Juz fraction. `Dashboard.jsx` finds the first incomplete
  Juz from `juzData` (`juzData.find(j => !j.isComplete)`) and shows *that* Juz's own
  completion ring + number, with a tooltip naming it (`dashboard.currentJuzTooltip`). When
  all 30 are done it shows `30 / 30`. This reads more usefully day-to-day than a single
  blended "X% of the Quran" ring, which told the user little about *what to work on next*.
- **Memorized-pages stat** (`stats.totalMemorized / 604`) is labeled plainly as "Memorized
  pages" rather than an ambiguous "Pages to Hifz" — a small wording fix after user-testing
  found the original label was read as a countdown rather than a running total.

**The review column is a single unified list.** Recent-review and cycle-review pages are
merged into one `allReviewPages` array (recent pages tagged `isRecent: true`) and rendered
as one scrollable list with a small "Recent" badge distinguishing the two — there is no
separate recent/cycle split in the UI, even though the server still computes them as two
buckets (§4). This was a deliberate simplification: two visually separate review sections
asked new users to understand the recent/cycle distinction before they'd done a single
review.

**The dashboard also drives the first-run tour and the memorize-method modal** — covered in
[§7](#7-onboarding--in-app-guidance) rather than here, since the same pattern (driver.js +
a localStorage flag) is shared with the Library page.

---

## 6. The Library reader

There is exactly **one reading mode** — an earlier version had a separate "memorize mode"
toggled by `?mode=memorize`, but the self-test and method checklist it gated are useful on
every visit, not just a dedicated session, so they were merged into the normal reader's
sidebar. If you land on an old bookmarked `?mode=memorize` link, it still works: nothing in
the code reads that param anymore, and `goToPage` rebuilds the URL's `page` param from
scratch on the very next navigation, so the stale `mode` value quietly disappears.

### How the exact mushaf rendering works

The real 604-page mushaf can't be reproduced by flowing text — line breaks are baked into
the print. [mushafApi.js](../client/src/services/mushafApi.js) does it the way quran.com
does: **one tiny font per page** ("QCF" glyph fonts, self-hosted under
`client/public/fonts/qcf/`, loaded on demand via the FontFace API) plus word data from the
quran.com API saying which glyph sits on which of the page's **15 lines**.
[MushafPage.jsx](../client/src/components/MushafPage.jsx) renders those 15 lines as a fixed
CSS grid (`repeat(15, minmax(0,1fr))`) inside a fixed-size frame that is uniformly scaled to
its column — so a line can never overflow at any screen size. Every word is a `<span>` keyed
by `verseKey` (`"surah:ayah"`) + word `position`, which is the stable anchor that selection,
audio, self-test, and (future) annotations all share.

[../client/src/pages/Library.jsx](../client/src/pages/Library.jsx) is the mushaf reader
(§9 covers where the Arabic text comes from). Its sidebar is a single flat sequence, in
on-screen order: page navigation, self-test, the method checklist, jump to Juz, jump to
Surah, bookmarks, then the pages-memorized stat. Nothing in it is conditional on a mode.

### The self-test (active recall)

A three-way segmented control sets `selfTest` to `'off' | 'hide' | 'cover'`, always visible
in the sidebar (`data-tour="lib-test"`) — `'hide'` blurs everything and reveals a verse only
when tapped; `'cover'` keeps the text visible but blurs a small window under the
cursor/finger as you hover, so you can drill a page without ever fully hiding it. The active
style derives the page's conceal behaviour:
```js
const concealMode = selfTest !== 'off' ? selfTest : null;
```
Concealment itself is **not** a simple boolean per word — it's a reading-order "watermark"
per visible page: `watermarks[page]` holds the index (top line to bottom, right→left within
a line) of the last word considered revealed, and a word is shown iff its index is `<=` that
number. Tapping a verse (`revealVerse`) advances the watermark to the verse's last word;
tapping an already-revealed verse a second time (`hideVerse`) winds the watermark back to
just before it, hiding it and everything after. Dragging across words in `'cover'` mode
calls `revealThrough` continuously, advancing the watermark to the furthest word the
peek-window has touched — so releasing mid-drag never re-hides what was just shown. "Reveal
all" / "Hide all" (`revealAllVisible` / `hideAllVerses`) push every visible page's watermark
to its last word or reset it to `-1` in one step. Concealed words are **blurred, not
hidden** — the line shape stays visible as a positional memory cue, which is closer to how a
real Hifz self-test works (you recognize *where* a word sits on the page) than blanking the
page entirely. This is **active recall** — research shows testing yourself on material
(forcing retrieval) cements memory far better than passively re-reading it, which is the
cognitive-science complement to the spaced-repetition scheduling in §4.

### The method checklist

Collapsed by default (`methodOpen` starts `false`), this is a collapsible list of the same 7
memorization steps used in `HowToMemorizeModal` (§7), reused here as
`t('howTo.steps', { returnObjects: true })` so the two surfaces never drift out of sync.
Checking a step (`toggleStep`) just toggles an index into a local `checkedSteps` `Set` — it
is **ephemeral, not persisted**: there's no server field for "did the user follow step 3." It
exists purely to give the user something to tick off page by page, not as data the app
tracks or scores. A "full guide" link reopens `HowToMemorizeModal` for the complete text.

### Marking a page memorized

The **only** memorized indicator is a small tick button in each page card's footer
(`data-tour="lib-mark"`) — there's no separate badge or banner elsewhere on the page. It
calls `markPageMemorized`/`unmarkPageMemorized`, which optimistically flip a local
`memorizedPages` Set, then call `progressAPI.markComplete` (adding) or
`progressAPI.updateMemorized` (removing — `/uncomplete` only undoes pages memorized *today*
and would 400 on an older page), rolling back on failure. In two-page view each half of the
spread has its own tick, so either page can be marked independently.

### Focus mode, two-page view, and navigation

**Focus mode** (`focusMode`, persisted to `localStorage['mushafFocus']`) hides the sidebar
and page chrome for a distraction-free read; **view** (`single`/`double`, persisted to
`localStorage['mushafView']`) switches to a two-page spread on wide screens
(`twoPage = view === 'double' && isWide`), snapping to an odd anchor page so the spread
always pairs correctly. Every page-change path funnels through one function, `goToPage`,
which clamps to `1..604` and re-snaps for two-page view — so all of the following stay
consistent with each other by construction: the prev/next pager buttons, the page-number
input, `ArrowLeft`/`ArrowRight`/`PageDown`/`PageUp` keys (RTL book: left = forward), the
floating edge-arrows (`mushaf-edge-zone--next`/`--prev`), touch swipe
(`onTouchStart`/`onTouchEnd`), jump-to-Juz/Surah, bookmarks, and the page scrubber below.

The **page scrubber** ([PageScrubber.jsx](../client/src/components/PageScrubber.jsx)) is a
full-width `<input type="range">` above the audio bar for jumping around without typing. The
mushaf is a right-to-left book regardless of UI language, so the track always reads page 1 at
the right end and 604 at the left; rather than fight the browser's own RTL mirroring of a
range input's native sides, the component pins `dir="ltr"` on the input and inverts the
*value* mapping instead (`page = 605 - sliderValue`), so the visual orientation is identical
in both UI languages. Small ticks mark the 30 Juz start pages. Dragging only updates a local
preview and a floating bubble (page number + Juz, Arabic-Indic digits in AR) — the mushaf
itself doesn't navigate, and so doesn't reload, until release (`onPointerUp`/
`onPointerCancel`), at which point `goToPage` is called once, which already handles the
two-page snap.

### Bookmarks

Account-saved, multiple per user, backed by the `Bookmark` model (§2) via
[bookmarksAPI](../client/src/services/api.js) — add/remove/list against the current page,
each with an optional label, listed in the sidebar for one-tap navigation.

---

## 7. Onboarding & in-app guidance

New users don't read documentation — they need *contextual* nudges at the moment a feature
becomes relevant. This app layers three guidance mechanisms on top of the existing pages
rather than a separate "tutorial mode": guided **tours** (driver.js), an instructional
**modal** (the 7-step method), and lightweight **tooltips/hints**. All three are gated so
they show *once*.

### The tours — driver.js

[driver.js](https://driverjs.com) is a small library that draws a dimmed overlay with a
cut-out "spotlight" around one DOM element at a time, plus a popover with title/body text
and Next/Back/Close buttons — i.e. it does the overlay math, scroll-into-view, Esc-to-close,
and click-outside-to-skip for you, so the app only supplies *which elements* and *what text*.

Two tour builders, both following the same shape:

- [dashboardTour.js](../client/src/components/dashboardTour.js) — `startDashboardTour({ t, onDone })`
  walks 5 dashboard regions (new-memorization column, listen button, review column, streak
  chip, settings link), each targeted by a stable `data-tour="…"` attribute, e.g.
  `[data-tour="new-mem"]` on [Dashboard.jsx:838](../client/src/pages/Dashboard.jsx). Steps
  whose target isn't currently in the DOM (the new-memorization column doesn't exist for a
  Hafiz; the Settings link is desktop-only) are filtered out *before* the tour starts, so it
  never spotlights an empty space.
- [libraryTour.js](../client/src/components/libraryTour.js) — two entry points for the
  Library page: `startLibraryTour` (first visit to the reader, 5 steps covering navigation,
  self-test, listening, tapping a verse, and the per-page mark tick — there's no separate
  mode to tour anymore) and `startVerseActionsCoachmark` (a single one-time highlight on the
  verse popover's Play/Tafsir buttons — `showButtons: ['next', 'close']`, no Back, since it's
  a hint, not a walkthrough). Steps additionally check the target is *laid out*
  (`el.getClientRects().length > 0`), so a control hidden at the current viewport width
  (e.g. a mobile-collapsed control) is skipped too.

Both builders read the current theme (`document.documentElement.classList.contains('dark')`)
to pick a more opaque overlay in dark mode, and apply a shared `.qt-tour` CSS class
(in [index.css](../client/src/index.css)) so the popover matches the app's emerald palette
and mirrors correctly under `dir="rtl"`.

### The gating: each tour fires once, ever

Every tour is gated by its own `localStorage` flag, checked before launching and set in the
`onDone` callback:

| Flag | Set when | Triggers |
|---|---|---|
| `seenDashboardTour` | dashboard tour finishes/closes | first dashboard visit, or `?tour=1` to force it |
| `seenMemorizeGuide` | the How-To modal auto-opens once | chained right after the dashboard tour (or immediately if there's nothing to spotlight) |
| `seenLibraryTour` | library reader tour finishes | first visit to `/library` |
| `seenVerseActionsHint` | the coachmark is shown/dismissed | first time the verse popover appears, only if no tour is currently running |

On [Dashboard.jsx:344–386](../client/src/pages/Dashboard.jsx), this chaining is explicit: the
dashboard tour's `onDone` calls `showGuideOnce()`, which only opens
`HowToMemorizeModal` if `seenMemorizeGuide` isn't set yet — so a brand-new user sees the tour,
then (once) the how-to guide, in sequence, while a returning user sees neither. A
`tourTimeoutRef` delays the check by 350ms so the tour doesn't fight the dashboard's own
data-loading skeleton state. A ref-guarded effect destroys an in-flight tour only on real
unmount (navigating away), not on every re-render.

### `HowToMemorizeModal` — the 7-step method

[HowToMemorizeModal.jsx](../client/src/components/HowToMemorizeModal.jsx) is a portal-rendered
modal (`createPortal(..., document.body)`) teaching a recommended 7-step method for
memorizing one page (read the steps from `t('howTo.steps')` so they stay bilingual). It's
reused in three places: the one-time auto-open after the dashboard tour, an opt-in "Full
guide" link from the Library's method checklist (§6), and presumably a help trigger
elsewhere on Settings — one component, three entry points, so the method text only has to be
written once.

### Tooltip & InfoHint — the lightweight layer

Two small always-available components round out the guidance, used throughout (not gated by
localStorage — they're on-demand, not one-time):
- [Tooltip.jsx](../client/src/components/Tooltip.jsx) — wraps an icon-only button and always
  applies an `aria-label`, so icon buttons (listen, undo, mark-all) are both visually
  labeled on hover *and* properly named for screen readers.
- [InfoHint.jsx](../client/src/components/InfoHint.jsx) — a small "ⓘ" that reveals a
  short explanation of a domain term (e.g. what "Juz" or "streak" means) inline, for users
  who don't recognize the vocabulary yet.

---

## 8. The Progress and Settings pages

### Progress: compact vs. detailed map

[Progress.jsx](../client/src/pages/Progress.jsx) shows the 30-Juz "Memorization Map" in two
densities, toggled by a single boolean:
```js
const [showDetailedMap, setShowDetailedMap] = useState(false);
```
**Compact** (the default) is a dense `grid-cols-5 sm:grid-cols-10` of small numbered tiles —
one per Juz, colored by completion, with a `title` tooltip giving the exact count/percentage.
**Detailed** expands to a `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` of larger cards, each
showing the Juz's full "count/total · pct%" inline and (per a later fix) fitting each Juz's
page range on one line instead of wrapping. Defaulting to compact was a deliberate
declutter: the detailed view repeats information already visible elsewhere (Juz number,
page count) at a cost in vertical space that most users don't need on every visit.

### The GitHub-style contribution graph

`buildContributionWeeks(createdAt, byDate, fullHistory)` turns the `memorizedByDate` map
(returned by `GET /api/progress/all`, §4) into the week-column / weekday-row grid GitHub
made familiar:
```js
function buildContributionWeeks(createdAt, byDate = {}, fullHistory = false) {
  // builds Sunday-aligned week columns of {date, count, level} cells, in UTC,
  // either ~26 weeks back or all the way to account creation (fullHistory)
}
```
By default it shows roughly the last 26 weeks; a "View full history" toggle
(`showFullHistory`, gated behind `canViewFullHistory` — only offered once the account is
actually older than that 26-week window, since showing the toggle to a brand-new account
would reveal an empty button) extends the start date back to `user.createdAt`. All date math
is done in UTC (`toUTCMidnight`, `toISODate`) so the grid's day keys line up exactly with the
server's `YYYY-MM-DD` date strings from §4 — the same UTC discipline as the backend.

### The "Edit my pages" button

A single CTA at the bottom of the Memorization Map (`FiEdit2` icon) routes to
`/settings?tab=memorization&edit=1`, landing the user directly on Settings' memorized-pages
editor instead of making them hunt for it — Progress is read-mostly (it visualizes state),
so editing intentionally lives one click away on Settings rather than being duplicated here.

### Settings: a simplified review-intensity selector

The review-settings group in [Settings.jsx](../client/src/pages/Settings.jsx) presents four
equal-weight cards in one row — `light` / `standard` / `strong` (the same three
`reviewIntensity` presets `computeDailyReviewTarget` understands, §4) plus a fourth
**"Fixed number"** card:
```js
const [reviewMode, setReviewMode] = useState(
  (user?.recentReviewCount != null || user?.cycleReviewCount != null) ? 'fixed' : 'intensity'
);
```
Picking a preset card sends `reviewIntensity` and clears both override fields
(`recentReviewCount: null, cycleReviewCount: null`) so the server formula takes over again;
picking "Fixed number" instead sends explicit `cycleReviewCount` (and, in Advanced,
`recentReviewCount`) so the user pins an exact daily review count. Each preset card also
shows a live estimate (`estimateReviewPages`) of how many pages that intensity would assign
*today*, computed from the user's current memorized total — turning an abstract setting into
a concrete number before they commit to it.

### The Advanced section

Three settings that most users never need to touch are tucked behind a collapsed
`showAdvanced` toggle rather than shown by default: **pause new memorization** (review-only
mode), the **recent-review count** override (only relevant in Fixed-number mode), and the
**review-cycle start point** (`cycleReviewStartPage` — lets a user pick where in the mushaf
the cycle-review rotation should resume from, e.g. after a long break). Burying these behind
one disclosure toggle keeps the main Settings screen approachable for a first-time user while
still giving power users full control — the same "advanced options collapsed by default"
pattern as the compact/detailed map toggle above.

---

## 9. External integrations

### Quran content — [../client/src/services/quranApi.js](../client/src/services/quranApi.js)

The app stores **no Quran text or audio itself** (the QCF page *fonts* are self-hosted, but
they're glyph shapes, not text). Content comes from public sources, all called from the
browser:

- **Page text/layout** — now comes from the **quran.com API v4** via
  [mushafApi.js](../client/src/services/mushafApi.js) (per-word glyph codes + line numbers —
  the exact-mushaf pipeline described in §6, satisfying the tashkeel requirement NFR-07).
  `quranApi.js`'s older `fetchPageText` (alquran.cloud `quran-uthmani`) remains only as a
  text utility; the reader no longer renders from it.
- **Audio** — `getAyahAudioUrl(reciterId, ayahNumber)` builds a URL on the
  `cdn.islamic.network` audio CDN. Five reciters are listed in `RECITERS`; the comment notes
  one reciter was dropped because the CDN returned 403 for it (a real, verified detail worth
  mentioning — it shows the integrations were actually tested).
- **Tafsir (commentary)** — four editions in `TAFSIR_EDITIONS`. Some come per-page from
  alquran.cloud, others per-ayah from a separate jsDelivr-hosted CDN.

Two engineering details to point out:
- **In-memory caching.** `pageTextCache`, `tafsirPageCache`, and `tafsirAyahCache` are
  `Map`s that memoize responses, so revisiting a page is instant and doesn't re-hit the
  network — directly supporting the < 3s performance target.
- **Text cleanup.** `splitBasmala` separates the Basmala onto its own centered line (except
  where it's genuinely ayah 1, like Al-Fatiha), `toArabicDigits` converts ayah numbers to
  Arabic-Indic numerals, and there's a guard that strips a stray BOM character the API
  sometimes prepends. These are small touches that make the mushaf render correctly.

### The AI assistant — [../server/controllers/chatController.js](../server/controllers/chatController.js)

A chatbot that answers Hifz/Islamic questions, powered by **Groq** running the
`llama-3.3-70b-versatile` model. What makes it more than a generic chatbot:

- **It knows the user's real progress.** Before calling the model, `sendMessage` calls
  `buildProgressSummary(req.user)` (reused from the progress controller) and injects a
  system message containing the user's streak, pages memorized, pages left, and today's
  tasks — instructing the model to answer from *that* data and never invent numbers. So
  "what should I memorize today?" gets a real answer.
- **It fails safe.** If the progress lookup throws, it's caught and the chat continues
  *without* the context block — a data hiccup never breaks the conversation.
- **It's guarded.** Input validation requires a 1–10 message array, each message a non-empty
  string ≤ 2000 chars. And [../server/middleware/chatRateLimit.js](../server/middleware/chatRateLimit.js)
  caps each user at **20 requests / 5 minutes** so nobody can spam the endpoint and run up
  external API cost. The limiter is mounted *after* `protect` so it can key the limit on the
  authenticated user id.

---

## 10. Likely professor questions & answers

**Q: Why MongoDB (a document database) instead of a SQL database?**
The data is naturally document-shaped and the access patterns are user-scoped. The dominant
operation is "load everything for *this* user" (their progress, their settings), which maps
cleanly to documents and indexed per-user queries. The schema also evolved a lot during
development (off-days, pause modes, review overrides were all added later) — MongoDB's
flexible schema made that iteration cheap. We don't lean on multi-table joins or
transactions that would favor SQL. Mongoose still gives us schema validation, types, and
indexes on top.

**Q: How does the review scheduling actually work?**
Two buckets. *Recent review* = pages memorized in the last few active days, reviewed
frequently because they're freshest and most fragile. *Cycle review* = everything older,
rotated through over a window (≈10 days at `standard` intensity), taken
**oldest-reviewed-first** so the page nearest to being forgotten comes up first. The daily
counts come from `computeDailyReviewTarget`; the selection and de-duplication happen in
`getTodayTasks`. (Files: [progressController.js](../server/controllers/progressController.js).)

**Q: How does that map to the Ebbinghaus forgetting curve?**
Ebbinghaus showed memory decays fastest right after learning, then more slowly. So the
schedule front-loads effort onto the freshest pages (the recent bucket, reviewed often) and
spaces out the older, more-stable pages (the cycle bucket). "Oldest-reviewed-first" is the
practical stand-in for "review each item just before it would be forgotten," which is the
point at which a review most strengthens long-term retention. Spaced repetition (Pimsleur,
Leitner) is the formalization of repeating at growing intervals; our cycle length is that
interval, made longer for `light` and shorter for `strong`.

**Q: Isn't this "real" spaced repetition like Anki/SM-2?**
Be honest: not exactly. SM-2 keeps a per-item interval that grows with each successful
recall. Here the intervals are governed by a set-wide rotation speed plus a recent-window
heuristic, not a per-page schedule. It's faithful to the *principle* and is a reasonable,
defensible approximation; we already store `reviewCount` and `lastReviewedDate` per page,
which is exactly the data a true per-page interval algorithm would need as a next step.

**Q: How are passwords stored?**
Hashed with **bcryptjs** at salt strength 10, via a `pre('save')` hook on the User model.
We store only the hash, never the plaintext; the field is `select: false` so it's excluded
from queries by default; login verifies with `bcrypt.compare`. bcrypt is one-way and salted,
so identical passwords produce different hashes and the originals can't be recovered.

**Q: How is session security handled?**
JWTs. On login/register the server signs a token (carrying just the user id) with a server
secret, valid 30 days. The browser stores it and the axios interceptor attaches it as a
`Bearer` token on every request. The `protect` middleware verifies the signature and expiry
on protected routes. It's hardened with `helmet` (security headers), a CORS allow-list, and
rate-limiting on the chat endpoint.

**Q: How are timezones handled?**
Every date comparison is reduced to a `YYYY-MM-DD` string in **UTC** (`getDateString` calls
`toISOString`). "Today," "memorized today," "reviewed today," and streak gaps are all
compared as UTC date strings. This keeps behavior consistent regardless of where the server
or user is, and avoids the classic bug where "today" flips at the wrong local midnight. The
honest trade-off: a user far from UTC sees the day roll over at UTC midnight rather than
their own — acceptable for this app, and fixable later by storing a per-user timezone.

**Q: Why one `UserProgress` document per page instead of an array of pages on the User?**
Because the scheduling needs *per-page* history — `memorizedDate`, `lastReviewedDate`,
`reviewCount` — and needs to sort/filter by those. Per-page documents let MongoDB index and
sort them (e.g. by `lastReviewedDate`) efficiently, and marking one page updates one small
document. An array on the User would mean rewriting a 600-element array on every single tap
and would make "sort pages by staleness" awkward. The unique `{userId, pageNumber}` index
also lets the database guarantee no duplicates.

**Q: How would you scale it?**
Several honest levers: (1) the per-user queries are already indexed, which is the main thing
that matters as users grow; (2) the API is stateless (JWT, no server session), so it scales
horizontally behind a load balancer; (3) `QuranMetadata` is tiny and static, so it could be
cached in memory or even shipped as a constant; (4) the heavy Quran text/audio is served by
external CDNs, not us, and is cached client-side; (5) future steps would be adding
pagination/projection to the few list endpoints and route-level code-splitting on the
frontend to cut the initial JS bundle (a known follow-up noted in
[FEATURES.md](FEATURES.md) §5).

**Q: How do rest days and the streak interact?**
`offDays` are weekdays the user excused. On those days `getTodayTasks` returns no tasks but
still advances `lastActiveDate` so the chain survives. The streak only resets when a *real*
(non-off) day passes with no activity — `isStreakContinued` checks each in-between day for
exactly that.

**Q: What happens when someone finishes the whole Quran (Hafiz)?**
`getTodayTasks` detects `totalMemorized === 604`, stops assigning new pages, and switches the
review target to a Hafiz-specific schedule (e.g. `standard` reviews 60 pages/day; `strong`
covers all 604 in a week). The dashboard shows a congratulations banner instead of a "new
memorization" column.

**Q: How does the onboarding tour work, and why driver.js instead of building it yourself?**
[driver.js](https://driverjs.com) draws the dimmed-overlay-with-a-spotlight effect and
handles scroll-into-view, Esc-to-close, and step navigation — all fiddly DOM/positioning
work that would be its own small project to get right. The app only supplies *which*
elements to highlight (via stable `data-tour="…"` attributes) and the title/body text per
step (see [dashboardTour.js](../client/src/components/dashboardTour.js) and
[libraryTour.js](../client/src/components/libraryTour.js)). Each tour filters its step list
down to elements that actually exist *and* are laid out before launching, so it never
spotlights empty space for a user missing that feature (e.g. a Hafiz has no "new
memorization" column). Each tour is gated by its own one-time `localStorage` flag
(`seenDashboardTour`, `seenLibraryTour`, …) so it never replays — except via the `?tour=1`
escape hatch used for demoing it again.

**Q: Why does the self-test live inside the normal Library page instead of a separate
memorize screen?**
An earlier version did split them — a `?mode=memorize` URL flag swapped the sidebar between
"reading controls" and "memorize controls" on the same page. In practice the self-test and
method checklist turned out to be useful on every visit, not just a dedicated session, so
they were merged into one always-available sidebar (§6) rather than kept behind a mode
switch. The one-reader design was kept either way: self-test, the method checklist, and the
mark-done flow all share the existing page's audio playback, verse selection, tafsir panel,
and RTL layout, instead of re-implementing them in a second component — avoiding two
near-identical readers that would drift apart over time.

**Q: Where would I point to prove a given requirement is met?**
Use [FEATURES.md](FEATURES.md) — it maps every FR-01–13 and NFR-01–07 to a specific file and
function. This guide explains the *how* and *why* behind those mappings.

---

### A 60-second verbal summary (for the defense)

> "It's a React frontend and an Express/MongoDB backend that talk over a REST API with JWT
> auth — passwords bcrypt-hashed, tokens attached by an axios interceptor and verified by a
> `protect` middleware. The data model is one document per user-page, which records when each
> page was memorized and last reviewed. The core engine, `getTodayTasks`, turns that history
> into a daily plan: new pages up to the user's goal, plus two review buckets — recent pages
> reviewed often, older pages cycled oldest-first — which operationalizes the Ebbinghaus
> forgetting curve and spaced repetition. All dates are compared in UTC to stay
> timezone-safe, rest days preserve the streak, and Quran text/audio plus an AI assistant
> that's aware of the user's real progress round out the experience."

---

## 11. Glossary

Quick plain-language definitions of the terms used throughout this guide.

### Domain terms (the subject matter)

- **Quran** — the Islamic scripture. In the standard printed layout it is exactly **604
  pages**, which is why page numbers in this app run 1–604.
- **Mushaf** — a physical (or here, digital) copy of the Quran laid out in pages. The
  Library reader in this app shows the mushaf page by page. The CSS class for the Quranic
  text is even named `.mushaf-text`.
- **Surah** — a chapter of the Quran. There are 114, of very different lengths, so a single
  page can contain the end of one surah and the start of another (that's why
  `QuranMetadata` stores a `surahs` *array* per page).
- **Ayah** — a verse (a single numbered sentence/unit within a surah). Audio and per-verse
  tafsir are addressed at the ayah level.
- **Juz** — one of the **30** roughly equal parts the Quran is traditionally divided into
  (each ≈ 20 pages). The Progress page visualizes memorization as a 30-Juz grid.
- **Muraja'ah** (مراجعة) — systematic *revision/review* of already-memorized Quran. The
  "review" tasks in this app are exactly this: keeping memorized pages fresh.
- **Hafiz** — someone who has memorized the *entire* Quran. In code this is the
  `totalMemorized === 604` state: no new pages remain, so the app switches to review-only
  and shows a congratulations banner.
- **Tashkeel** — the diacritical marks (short-vowel and pronunciation signs) written above
  and below Arabic letters. Correct tashkeel is essential for reciting the Quran accurately,
  which is why the app pulls the `quran-uthmani` edition (full diacritics) and uses
  dedicated Quranic fonts to render it.

### Technical terms (the engineering)

- **REST** — a convention for building web APIs where the client acts on *resources* using
  standard HTTP verbs (GET to read, POST to create, PUT to update, DELETE to remove) and
  exchanges JSON. This app's whole `client ↔ server` boundary is REST, e.g.
  `GET /api/progress/today`.
- **JWT (JSON Web Token)** — a small, digitally *signed* token the server hands out at
  login. It carries a little data (here, the user id) and an expiry, and the signature lets
  the server later confirm it issued the token without storing any session on its side. The
  browser sends it on every request as a `Bearer` token.
- **bcrypt** — a deliberately slow, one-way *password hashing* algorithm with a built-in
  random *salt*. "One-way" means you can't reverse a hash back to the password; you can only
  hash a login attempt and compare. The slowness and salt make large-scale guessing attacks
  impractical. (This project uses the `bcryptjs` implementation.)
- **Optimistic UI** — updating the interface *immediately* as if an action succeeded,
  instead of waiting for the server's reply, then quietly reconciling (or offering Undo) if
  needed. The dashboard does this when you mark a page complete — the card flips to "Done"
  at once, so the app feels instant.
- **Spaced repetition** — a learning technique where you review material at *increasing*
  intervals over time rather than cramming. Each well-timed review strengthens long-term
  memory, so you retain more with less total effort. It's the principle behind this app's
  review scheduling (formalized historically by Pimsleur 1967 and the Leitner system 1972).
- **Ebbinghaus forgetting curve** — Hermann Ebbinghaus's finding (1885) that memory of newly
  learned material decays roughly exponentially over time *unless* it's reinforced — fastest
  right after learning, then more slowly. It's the *why* behind spaced repetition: review
  freshly learned pages often (steepest decay) and older, more-stable pages less often.
