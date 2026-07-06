# Presentation Speaker Notes — Who Says What

Built from `Quran_Tracker_Graduation_Documentation_v3.docx`. Each team member gets the
section that matches their role on the project (Table 1.1), with the facts/numbers they
should actually say out loud — not just a topic name. Keep slides light; the talking
points below are what carries the room.

Order below = suggested speaking order (intro → design → backend → frontend → AI →
testing → wrap-up). Adjust to however many slides each section gets.

---

## 1. Ahmed El-Saeed Abdel-Bary Kotb — Team Lead & System Analyst
**Section: Introduction, Problem, Objectives, Scope**

Say:
- "In its standard printed layout the Quran has 604 pages, 30 Juz, 114 Surahs. Memorizing
  it — Hifz — takes years of daily discipline. The hard part isn't learning new pages,
  it's *retaining* the ones you already know. Traditional Islamic education even treats
  systematic revision, Muraja'ah, as harder than the initial memorization."
- "Most digital Quran apps focus on reading and recitation. None of them manage the
  long-term memorization process itself — there's no personalized plan, no schedule for
  what to review and when, and no visible progress to stay motivated."
- "Our objectives were six things: personalized daily planning, evidence-based spaced
  repetition, visible progress, motivation through streaks and achievements, full
  accessibility as a free responsive web app, and authentic Quran content built in —
  audio, tafsir, a self-test mode."
- "Scope-wise: this is a web app, not a native mobile app. We deliberately left out
  voice-based recitation correction, social leaderboards, and line-level tracking — page
  level was the right unit for v1."
- "We were an eight-person team over a 20-week, five-phase plan: planning, design,
  implementation, testing, then documentation and delivery."

---

## 2. Hatem Hossam El-Husseiny Shehab — UI/UX Designer
**Section: Onboarding, User Manual walkthrough, Bilingual/RTL & theming**

Say:
- "Onboarding is the user's starting point: they tell us what they've already
  memorized — by whole Juz, by Surah, or by an exact page range — and how many pages a
  day they want to take on, from half a page up to a custom number. That's what
  generates their very first personalized plan."
- "From day one we designed for two languages and two text directions — Arabic and
  English, RTL and LTR — not bolted on afterward. Switching to Arabic mirrors the *entire*
  layout, not just the text. There's also light, dark, and system theming everywhere."
- "We also built a first-run guidance layer — interactive tours on the dashboard and
  library, a coachmark on the very first verse, and a step-by-step 'how to memorize a
  page' guide — each shown once, and replayable later."
- "Every screen follows the same visual rhythm: load → show a skeleton loader → render →
  let the user act with instant feedback and an undo option. That consistency is what
  makes the app feel fast even though it's talking to a server."

---

## 3. Ammar Mostafa Mostafa El-Agawy — Back-End Developer
**Section: Architecture, Database design, Smart Review Algorithm**

Say:
- "We built a three-tier system: a React single-page app for presentation, an Express
  REST API for application logic, and MongoDB via Mongoose for data. Client and server
  share zero code — they only ever talk over HTTP with JSON — so each side can be built,
  tested, and deployed independently."
- "The database has three collections. The key design decision: `UserProgress` is one
  document *per page per user*, not one array field on the user. That's what lets us
  index and sort efficiently — like 'give me this user's oldest-reviewed page first' — and
  update a single page without touching the rest."
- "The core of the whole system is one function: `getTodayTasks` — it answers 'what
  should I do today?' every time the dashboard loads. It splits review into two disjoint
  buckets: a *recent* bucket for pages memorized in the last few days, reviewed often
  because they're on the steepest part of the forgetting curve, and a *cycle* bucket for
  everything older, rotated oldest-reviewed-first so whatever's closest to being forgotten
  comes up first."
- "Review volume isn't fixed — it scales with how much you've memorized and which
  intensity preset you picked: Relaxed is a 14-day cycle, Balanced is 10 days, Serious is
  7 days, plus a manual fixed-number override. A Hafiz — someone who's memorized all 604
  pages — automatically switches into a maintenance-only schedule."
- "Every date comparison in the system uses UTC `YYYY-MM-DD` strings specifically to
  avoid timezone bugs. We're upfront in the report that this is an *approximation* of true
  per-item spaced repetition like SM-2/Anki — but since we already store `reviewCount` and
  `lastReviewedDate` per page, evolving to a true per-page schedule is a clear next step."

---

## 4. Ali Mohamed Ali El-Gendy — Full-Stack Developer
**Section: Authentication & API, Security, Testing**

Say:
- "Authentication is fully stateless. On login or registration the server signs a 30-day
  JWT with the user's id; the browser stores it, and every request automatically attaches
  it as a Bearer token. The server's `protect` middleware verifies the signature and
  expiry on every protected call."
- "Passwords are hashed with bcrypt — salt round 10 — and excluded from query results by
  default. They're never sent back to the client, never logged, never stored in plain
  text."
- "Beyond that: Helmet for security headers, a CORS allow-list, and a rate limiter on the
  AI chat endpoint specifically — 20 requests per 5 minutes per user — so that one endpoint
  can't be abused."
- "On testing: we have an automated backend suite — 13 tests on Node's native test
  runner with Supertest and an in-memory MongoDB. Six cover authentication, seven cover
  the progress and spaced-repetition logic. All 13 pass, and they run with one command,
  `npm test`. On top of that we did manual testing across every user flow, real
  memorization scenarios with volunteers, and cross-browser/cross-device checks in both
  LTR and RTL."
- "One honest caveat we call out directly in the report: our '99% availability' NFR is
  *addressed*, not *measured* — we expose a health endpoint and monitor it externally with
  UptimeRobot, but that uptime number is a property of the hosting platform, not something
  our code guarantees by itself."

---

## 5. Hossam Hassan Abdullah El-Banouby — Front-End Developer
**Section: Dashboard & Progress visualization**

Say:
- "The Dashboard is the screen people open every single day. The 'Today' tab shows new
  pages plus one unified review list, with 'mark all' and 'show all' actions. Summary
  cards surface the streak, the current Juz, a 'memorized pages — X out of 604' stat, and
  today's review target."
- "Marking a page complete updates the UI instantly with an undo option — there's no
  page reload, no waiting on the network before you see the result."
- "There's also a 'This Week' tab that previews the next seven days, including any
  scheduled rest days, so the plan doesn't feel like a black box."
- "The Progress page is the big-picture view: it opens on a compact per-Juz percentage
  map that toggles into a detailed page-by-page map. Below that: a GitHub-style activity
  contribution graph, a cumulative progress chart, and achievement badges for milestones
  like finishing a Juz or hitting 100 pages."
- "Progress is intentionally read-only — if you want to *edit* what's marked memorized,
  there's a clear button that sends you to Settings instead of letting you edit two
  different places."

---

## 6. Tarek Hesham Ibrahim Ghanem — Front-End Developer
**Section: Mushaf Library & Memorize mode**

Say:
- "The Library is a full in-app Quran reader — all 604 pages, in Uthmani script with
  complete diacritics, navigable by page, Juz, or Surah. It plays per-ayah audio from
  multiple reciters with auto-advance, and opens tafsir — commentary — for a page or a
  single verse, with four different tafsir editions available."
- "Important architectural point: we don't store any Quran text or audio ourselves. It's
  all fetched live from public Quran content services and cached in memory client-side, so
  repeat visits are instant without us hosting gigabytes of audio."
- "Memorize mode is reached straight from the reader — no separate page, so it keeps all
  the audio and tafsir features for free. It blurs the page for active-recall self-testing:
  you try to recall the page from memory, then reveal verses one at a time or all at once
  to check yourself, follow a short method checklist, and mark the page memorized without
  ever leaving the reader."
- "One real detail worth mentioning: during integration testing we actually removed one
  reciter because its audio CDN started returning HTTP 403 — proof these integrations were
  tested against the live services, not just assumed to work."

---

## 7. Shehab Yasser Abdel-Rahman Ibrahim — AI Engineer
**Section: AI Assistant**

Say:
- "The AI assistant is a floating chat widget that answers Hifz and general Islamic
  questions — but it's not a generic chatbot. Before it answers, the backend builds a
  system prompt from the user's *actual* progress: their streak, pages left, today's
  tasks. So when it gives guidance, it's actually about you, not a canned response."
- "It runs on Groq, using the `llama-3.3-70b-versatile` model, and it only runs
  server-side — so the progress data and the API key never reach the browser."
- "It's deliberately constrained for safety and cost: messages are capped at 1 to 10
  items per request, each message limited to 2000 characters, and the endpoint is
  rate-limited to 20 requests per 5 minutes per user."
- "It also fails safe — if building that progress-context lookup throws an error for any
  reason, the assistant just continues without the extra context instead of breaking the
  whole chat."

---

## 8. Mohamed El-Sayed Abdullah El-Banouby — Front-End Developer
**Section: Settings, Conclusion, Future Work**

Say:
- "Settings is where the plan gets adjusted after onboarding: daily capacity, the
  review-intensity preset — Relaxed, Balanced, Serious, or a fixed number — weekly rest
  days, editing which pages are marked memorized, switching language and theme, and
  account management."
- "Rest days and pause mode matter for real life: you can take a weekly day off, or pause
  new memorization entirely and only get reviews, and your streak survives both — it's not
  punished for planned rest."
- "To wrap up: this project set out to fill a real gap — a free, web-based platform that
  manages the *long-term process* of memorizing the Quran, not just reading it. We
  implemented all thirteen functional requirements and all seven non-functional
  requirements from the original proposal, and went further — the Mushaf Library, the AI
  assistant, the guidance tours, and full bilingual RTL support were not in the original
  scope."
- "We're upfront about the boundaries: page-level tracking rather than line-level, an
  approximate rather than a true per-item spaced-repetition schedule, and monitored rather
  than code-guaranteed uptime. Every one of those is a deliberate, documented decision —
  and every one of them is a concrete item on our future-work list, alongside things like
  per-item spaced repetition, a Red Marker for hard lines in Memorize mode, push
  notifications, and a native/PWA build."

---

## Closing line (whoever wraps up)

"Under the hood: a React 19 frontend talking to an Express 5 / MongoDB backend over a
REST API, secured with JWT and bcrypt, validated by an automated test suite, and built
around one core idea — turning the forgetting curve and spaced repetition into a concrete
daily plan. That's the digital version of Muraja'ah."
