# Code Guide — A Plain-Language Walkthrough

**Who this is for:** you, the student developer, getting ready to explain and defend this
project to professors. It assumes you know JavaScript basics but want to confidently
explain *how the whole thing fits together* and *why* it was built this way.

This is a study guide, not marketing. Where something is an approximation or a known
trade-off, it says so honestly — those are exactly the places professors probe.

Paths are written relative to this file (it lives in `docs/`), so the links are
clickable. Frontend code is under [`../client/src/`](../client/src/), backend under
[`../server/`](../server/).

For the formal requirement-to-code mapping (FR/NFR table), see
[FEATURES.md](FEATURES.md). This guide is the *narrative* companion to that table.

---

## Table of contents

1. [The big picture: how the pieces talk](#1-the-big-picture-how-the-pieces-talk)
2. [The data models](#2-the-data-models)
3. [Authentication, end to end](#3-authentication-end-to-end)
4. [The core: how the daily plan is built](#4-the-core-how-the-daily-plan-is-built)
5. [Frontend structure](#5-frontend-structure)
6. [External integrations: Quran content & the AI assistant](#6-external-integrations)
7. [Likely professor questions & answers](#7-likely-professor-questions--answers)
8. [Glossary](#8-glossary)

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

In [app.js](../server/app.js) the three groups are mounted like this:

```js
app.use('/api/auth', require('./routes/authRoutes'));      // register, login, profile
app.use('/api/progress', require('./routes/progressRoutes')); // the memorization plan
app.use('/api/chat', require('./routes/chatRoutes'));       // the AI assistant
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
   (streak chip, daily review target, Juz ring, pages-to-Hifz), and the **Today / This Week**
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

---

## 6. External integrations

### Quran content — [../client/src/services/quranApi.js](../client/src/services/quranApi.js)

The app stores **no Quran text or audio itself**. It pulls them live from public sources,
all called from the browser:

- **Page text** — `fetchPageText(pageNumber)` hits `api.alquran.cloud` for the
  `quran-uthmani` edition (Uthmani script *with* full diacritics/tashkeel — that's the
  Arabic-rendering requirement, NFR-07).
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

## 7. Likely professor questions & answers

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

## 8. Glossary

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
