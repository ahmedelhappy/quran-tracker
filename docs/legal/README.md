# Legal drafts — privacy policy and terms (H-05)

> **DRAFT — not published, not legal advice; review before use.**
> Nothing in this folder is linked from the app, and the footer links are unchanged.

## What is here

| File | What it is |
|---|---|
| `privacy-policy.en.draft.md` | Privacy policy, English |
| `privacy-policy.ar.draft.md` | Privacy policy, Arabic (Modern Standard Arabic translation of the English draft) |
| `terms.en.draft.md` | Terms of use, English |
| `terms.ar.draft.md` | Terms of use, Arabic |

These are working drafts written from what the code actually does on 2026-11-02 (the
inventory below), for the owner and a reviewer to correct and complete. Every value
the owner has to supply is in `[BRACKETS]`. The English text is the reference; the
Arabic follows it section for section, so a change to one must be made to the other.

They answer audit finding **H-05** (no privacy policy or terms; undisclosed third-party
processing). The code side of H-05 that needed no decision is done in the same phase:
the assistant's prompt no longer carries the user's name or any date (see
"What goes to Groq" below).

## Processor and data-flow inventory (evidence)

"Visitor" means anyone who opens the site, signed in or not. A request the **browser**
makes directly to a third party exposes the visitor's **IP address**, **User-Agent** and,
under the site's `Referrer-Policy: strict-origin-when-cross-origin`
(`client/vercel.json:11`), only the **origin** (`https://<site>`) as Referer — not the
page path. A request the **API server** makes (Groq) shows the provider the server's
address, not the visitor's.

| # | Recipient | Role | What reaches it | Who calls it | Evidence |
|---|---|---|---|---|---|
| 1 | **Vercel** | Hosts the web client (HTML, JS, CSS, the self-hosted fonts, the verse-search index) | Every visitor's IP, User-Agent, requested URL, request headers (Vercel's own request logs) | Browser | `client/vercel.json:1-16` (rewrites, headers, CSP); fonts in `client/public/fonts/`; index fetched from `/data/search-index.json` (`client/src/services/quranSearch.js:26`) |
| 2 | **Render** | Hosts the API (`quran-tracker-api.onrender.com`) | Every API request: IP, User-Agent, method + path, the JWT, request bodies (account data, progress, notes, chat messages) in transit. App logs: method, path, status, time, size (`morgan('dev')`, no IP, no body) | Browser | `render.yaml:5-16`; CSP `connect-src` `client/vercel.json:16`; `server/app.js:23` |
| 3 | **MongoDB Atlas** | Database for all account data | Everything in "What is stored" below | API | `server/server.js:33` (`MONGODB_URI`; Atlas per `CLAUDE.md` → Environment) |
| 4 | **Groq** (US) | Answers the in-app assistant | The fixed system prompt + app guide; the plan summary; the conversation (see below). Not the name, email, account id, display name, IP or any date | API | `server/controllers/chatController.js:56` (context), `:250` (client), `:264` (call); `server/package.json:29` |
| 5 | **api.quran.com** (Quran Foundation, v4) | Mushaf page data (word glyph codes, lines, verse text) | Visitor IP, User-Agent, origin; which page is opened | Browser | `client/src/services/mushafApi.js:20`, `:247` |
| 6 | **api.alquran.cloud** (Islamic Network) | Daily verse; tafsir al-Muyassar / al-Jalalayn per page; page text | Visitor IP, User-Agent, origin; which page/verse | Browser | `client/src/services/quranApi.js:5`, `:256`; `client/src/services/dailyVerse.js:19`, `:88` |
| 7 | **cdn.islamic.network** (Islamic Network) | Per-ayah recitation audio (and HEAD warm-ups) | Visitor IP, User-Agent, origin; which reciter and ayah | Browser (`<audio>` + fetch) | `client/src/services/quranApi.js:6`, `:163`, `:178` |
| 8 | **everyayah.com** | Per-ayah recitation audio; audio edges read via CORS | Visitor IP, User-Agent, origin; which reciter and ayah | Browser | `client/src/services/quranApi.js:7`, `:143`, `:170` |
| 9 | **cdn.jsdelivr.net** (jsDelivr, serving GitHub repo `spa5k/tafsir_api`) | Per-ayah tafsir (Ibn Kathir, as-Sa'di, al-Baghawi, al-Qurtubi, at-Tabari, I'rab, Aysar fallback) | Visitor IP, User-Agent, origin; which tafsir and ayah | Browser | `client/src/services/quranApi.js:8`, `:320` |
| 10 | **newapi.hefzmoyaser.net** (Hefz Moyaser) | Aysar at-Tafasir per ayah | Visitor IP, User-Agent, origin; which ayah | Browser | `client/src/services/quranApi.js:15`, `:335` |
| — | **Fonts** | **Self-hosted** on Vercel since phase 5 (M-09): UI fonts and the Quran fonts. No font host is contacted; Google Fonts is no longer used | Nothing beyond row 1 | — | `client/src/fonts.css:1-3`; `client/public/fonts/`; CSP `font-src 'self'` (`client/vercel.json:16`) |
| — | **GitHub** | Source hosting and CI (GitHub Actions) only. CI runs on an in-memory database with no secrets; no user data | None | — | `.github/workflows/ci.yml:13` (read-only permissions), `:37` |
| — | **Analytics / error tracking** | **None.** No analytics, tag manager, Sentry or similar is loaded; `reportError.js` only logs to the console | None | — | grep for analytics/gtag/sentry/posthog/plausible finds only the comment at `client/src/utils/reportError.js:8-11` |
| — | **Email** | **None yet.** Password reset is built but off; the only transports are `none` and a development-only `console` | None | — | `server/utils/mailer.js:3`, `:36-42` |

The CSP's `connect-src`/`media-src` (`client/vercel.json:16`) lists exactly rows 2 and
5–10 besides `'self'`; `client/src/vercelConfig.test.js` fails if the code calls a host
the policy doesn't list. Nothing else is contacted.

### What goes to Groq (after this phase)

Built per request in `server/controllers/chatController.js` from
`buildProgressSummary` (`server/controllers/progressController.js`):

- the fixed instructions and the app guide (`server/chat/appGuide.md`) — the same for everyone;
- the plan: daily goal, review intensity, app language (EN/AR), pages memorized / left /
  percentage, current streak (a number), whether today is a rest day or new memorization
  is paused, today's new page or verse range, today's review page numbers, the suggested
  extra page;
- the conversation: the client sends at most the last 6 turns
  (`client/src/components/Chatbot.jsx:82-85`), the server accepts at most 10, each
  rebuilt as `{role, content}`, user turns ≤ 2,000 characters.

**Not sent:** name, email, account id, display name, password or its hash, IP address,
any calendar date (the context says "as of today"). Asserted by
`server/tests/chat.test.js` → "the payload carries the plan but not the name, email,
id, display name or dates". **User-typed text goes to Groq exactly as typed** — the app
does not rewrite or filter it, so anything a user writes in the chat (including
personal details) reaches Groq.

Before this phase the context began
`THE USER'S CURRENT DATA (authoritative and live, as of 2026-11-02 UTC):` followed by
`- Name: <the account name>`; that is how the assistant greeted users by name.

### What is stored, and where

**MongoDB Atlas** (`server/models/`):

| Collection | Fields that matter for privacy | Evidence |
|---|---|---|
| `users` | name, email, password (bcrypt hash), daily goal, streak + last active date (and the previous pair for undo), plan settings (review intensity, rest days, pause, recent/cycle counts, start pages, direction, plan start date), language, onboarding flag, `passwordChangedAt`, a pending reset token **hash** + expiry, leaderboard opt-in + display name, `createdAt`/`updatedAt` | `server/models/User.js:23-145` |
| `userprogresses` | per user + page: status, memorized date, last reviewed date, review count, memorized verse segments, undo snapshots, timestamps | `server/models/UserProgress.js:24-77` |
| `annotations` | per user + page: highlights, verse notes (free text ≤ 2,000), "hard" flags, text notes with position, **drawings** (ink strokes), timestamps | `server/models/Annotation.js:18-86` |
| `bookmarks` | per user: page + optional label, timestamps | `server/models/Bookmark.js:8-26` |
| `todos` | per user: to-do text, done, order, timestamps | `server/models/Todo.js:12-33` |
| `quranmetadatas` | static Quran structure — no personal data | `server/models/QuranMetadata.js` |

Chat conversations are **not stored** on the server; they live only in the open chat
widget and are gone when it remounts (`client/src/utils/safeStorage.js:100-101`).

**API process memory** (lost on restart, never written to the database):
chat daily-budget counter keyed by user id, cleared at the UTC day change
(`server/utils/chatBudget.js:11`); sign-in throttle keyed by email (`server/utils/loginThrottle.js:39`);
rate-limit counters keyed by IP, user id (chat, 5 min) or email (password-reset requests, 1 h)
(`server/middleware/chatRateLimit.js:11`, `server/middleware/rateLimiters.js:59-80`);
the leaderboard cache (display names, 5 min).

**Browser localStorage** (registry: `client/src/utils/safeStorage.js:72-102`):
- cleared on sign-out and account deletion: `token` (the JWT, valid 30 days —
  `server/controllers/authController.js:25`), `lastMushafPage`, `recentPages`;
- kept as device settings: `theme`, `lang`, `langExplicit`, `reciter`, `recentReciters`,
  `playbackRate`, `versePause`, `tafsirEdition`, `tafsirPanelWidth`, `mushafView`,
  `mushafSidebar`, `mushafAnnoVisible`, `mushafZoom`, `readerTools`, `readerToolsTab`,
  `chatbotPosY`, `singleKeyShortcuts`, the `seen…` first-run hints, `timerState`,
  `timerSettings`, `guestTodos` (the signed-out to-do list), `dailyVerse:<day>:<lang>`.
- No cookies are set by the app (no `res.cookie`, no `document.cookie`), no
  sessionStorage, no IndexedDB, no service worker.

### Retention and deletion

- **Account deletion** (`DELETE /api/auth/account`, `server/controllers/authController.js:450`)
  deletes every document in every collection with a `userId` path, then the user
  (`server/utils/userData.js:30-40`), clears the leaderboard cache, the chat budget and
  the sign-in throttle for that account. Verified this phase on the isolated harness: a
  user with User 1 / UserProgress 3 / Annotation 1 / Bookmark 1 / Todo 1 went to 0 in
  every collection; `server/tests/accountDeletion.test.js` seeds every user-keyed model
  and fails if anything is left. **No deletion gap was found.**
- Intentionally not cleared on deletion: the short-lived rate-limit counters (≤ 1 h,
  memory only). Clearing the per-address password-reset counter would let someone
  delete and re-register to send more emails to one inbox.
- **Reset progress** (`DELETE /api/progress/reset`) removes progress but keeps the account.
- **Owner notes (not code):** Atlas backups/snapshots keep deleted data until they
  expire (retention depends on the Atlas tier and settings); Render and Vercel keep
  request logs for their own retention periods; Groq keeps inference data per its
  policy (up to 30 days for abuse monitoring unless Zero Data Retention is on). Server
  error logs can contain a user id on rare failure paths (e.g.
  `server/controllers/progressController.js:579`), never chat content (phase 10 removed
  the one place that could log Groq's echo of a conversation).

### User rights — what exists today

| Right | Today |
|---|---|
| Access | In-app: profile, progress, notes, bookmarks, to-dos are all visible to the user |
| Rectification | Settings → profile (name, plan, language, display name), progress editor |
| Erasure | Settings → delete account (full cascade, above); reset progress |
| Export / portability | **Not available.** No export endpoint exists |
| Objection / restriction | The assistant is optional (nothing is sent to Groq unless the user writes to it); the leaderboard is opt-in |
| Withdraw consent | Stop using the assistant; leave the leaderboard; delete the account |

## Open owner decisions

1. **Publishing** — whether and when to publish these (and the `/privacy` + `/terms`
   routes, in both languages). Not done here.
2. **Footer links** — `client/src/pages/Landing.jsx:465-468` still point to `#`. Not changed.
3. **Groq Zero Data Retention** — switch on in Groq Console → Data Controls, then make
   the policy say so (the draft has a bracketed choice).
4. **Contact address** — a project address instead of the personal Gmail in
   `client/src/components/Footer.jsx:13` and `client/src/pages/About.jsx:89` (L-16).
5. **H-04 licensing** — the Quran content sources and fonts are referenced in the
   Terms as "[pending licence review — H-04]"; nothing about their licences is asserted.
6. **Email provider** — when password reset is turned on, the provider becomes a
   processor and must be added to the policy.
7. **Controller identity, governing law, minimum age** — who operates the service,
   which law applies, and the age policy (Groq requires its customer to be 18+; a Quran
   memorization app will be used by minors).
8. **Atlas backups** — the retention period to state.
9. **Hosting regions** — the Render, Vercel and Atlas regions to state in
   "international transfers".

## Checklist for publishing later

- [ ] A reviewer (ideally a lawyer for the target jurisdictions) has read both languages.
- [ ] Every `[BRACKET]` is filled or the sentence removed; search for `[` before publishing.
- [ ] The processor list still matches the code: re-run the grep for external hosts and
      compare with the CSP in `client/vercel.json`.
- [ ] Groq ZDR decided and the sentence updated; Groq region confirmed.
- [ ] Email provider (if any) added as a processor.
- [ ] H-04 licence answers reflected in the Terms' content section.
- [ ] Add `/privacy` and `/terms` routes (EN/AR, RTL), wire the footer links, add a
      link at registration ("By creating an account you agree to …").
- [ ] Set the "last updated" date and keep a changelog of versions.
- [ ] Remove the DRAFT banner only on the published copies.
