# Team Overview — Quran Memorization Tracker

**Who this is for:** any teammate who needs to understand the app well enough to talk
about it at the defense, even if you didn't write a single line of it.

---

## 1. What is this app, and what problem does it solve?

People memorizing the Quran (called **Hifz**) face a classic problem: it's easy to learn
a new page, but easy to *forget* an old one if you don't keep reviewing it. Doing this
well by hand means tracking, for every page you've ever memorized, when you last
reviewed it — and figuring out what's "due" today. Nobody does that with a notebook.

This app is a **personal Hifz coach**. Every day it tells you:
- which **new page(s)** to memorize today (based on a goal you set), and
- which **already-memorized pages** are due for **review** (Muraja'ah) so you don't forget them.

It also lets you read the Quran page-by-page, listen to recitation, read commentary
(tafsir), see your progress visually, and ask an AI assistant questions.

**The landing-page pitch, in one sentence:** "Set a daily pace, and the app builds your
memorization + review plan for you every day — so you make steady progress and never
forget what you've already memorized."

---

## 2. The core user journey

1. **Register / Login** — create an account with email + password.
2. **Onboarding** (first time only) — two questions:
   - "What have you already memorized?" (pick by Juz, Surah, or page range)
   - "How many new pages per day do you want to memorize?" (0.5 to 10 pages/day)
3. **Daily Dashboard** — shows two things every day:
   - **New pages** to memorize today (up to your daily goal)
   - **Review pages** that are due (some "recent," some older — see §4 below)
4. **Mark done** — tap a page as memorized or reviewed; it updates instantly (no page
   reload) and you can undo it.
5. **Track progress** — see your overall progress: a 30-Juz map, a per-Surah breakdown,
   a GitHub-style activity calendar, your streak, and earned badges.
6. **Library** — read any of the Quran's 604 pages, listen to recitation, read tafsir, or
   mark a page memorized straight from the reader.
7. **Memorize mode** — a special mode inside the Library that conceals the text so you can
   test yourself (active recall), with a step-by-step memorization method checklist.

---

## 3. The main pages, in one or two lines each

| Page | What it's for |
|---|---|
| **Dashboard** | Your "today" screen — new pages to memorize + reviews that are due, your streak, and quick stats. This is the page users open daily. |
| **Progress** | The "big picture" screen — 30-Juz map, per-Surah breakdown, activity calendar, and achievement badges. Read-only; editing happens on Settings. |
| **Library** | The Quran reader — browse any page, listen to recitation, read tafsir, and (via Memorize mode) actively test yourself on a page. |
| **Settings** | Update your name, daily page goal, review intensity (light/standard/strong), rest days, password, and which pages are marked memorized. |
| **Onboarding** | First-time setup only — declare what you've already memorized and pick your daily pace. |

---

## 4. How it's built (just enough to field a basic question)

- **Two separate apps that only talk over the network:**
  - **Frontend**: React (the UI you see in the browser) + Vite (build tool) + Tailwind
    (styling). Lives in `client/`.
  - **Backend**: Express (a Node.js web server) + MongoDB (the database, via the
    Mongoose library). Lives in `server/`.
  - They communicate with plain HTTP requests carrying JSON — the standard "REST API" pattern.

- **Login security**: passwords are hashed with **bcrypt** (a one-way scramble — even we
  can't reverse it back to the original password). After login, the server hands the
  browser a **JWT** (a signed token) which gets attached to every future request to prove
  who you are, without the server needing to remember a session.

- **The daily plan ("what should I do today")** is the most important piece of logic.
  It splits review into two buckets:
  - **Recent review** — pages you memorized in the last few days, reviewed *often* because
    they're freshest and easiest to forget.
  - **Cycle review** — everything older, rotated through over ~10 days (adjustable),
    oldest-reviewed page first — i.e. whichever page is closest to being forgotten comes
    up first.

- **External Quran content**: the app doesn't store any Quran text or audio itself. It
  fetches the Arabic page text, ayah-by-ayah audio (5 reciters), and tafsir (commentary)
  live from public Quran APIs, and caches them in memory so repeat visits are instant.

- **AI assistant**: a chatbot (in the corner of the app) that answers Hifz/Islamic
  questions. It's given a summary of *your real progress* (streak, pages left, today's
  tasks) so its answers are personalized instead of generic.

---

## 5. The science, in one line

The review schedule is based on the **Ebbinghaus forgetting curve** (memory fades fastest
right after learning something new) combined with **spaced repetition** (reviewing at the
right, growing intervals beats cramming) — which is the same principle behind the
centuries-old Islamic practice of **Muraja'ah** (systematic Quran revision): review new
material often, older material less often, so nothing is ever forgotten.
