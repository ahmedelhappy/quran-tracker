# Live Demo Walkthrough (for the presenter)

A page-by-page script to follow while the team watches the running site. Click what's
listed, say the 2-3 talking points out loud. Have a test account ready that already has
**some** pages memorized (a brand-new empty account makes the Dashboard/Progress screens
look bare).

---

## 1. Landing page (`/`)

**Click:** Open the home page (logged out).

**Say:**
- "This is a Quran memorization tracker — it builds you a daily plan of new pages to
  memorize plus pages to review, so nothing you've already memorized gets forgotten."
- "It's based on the forgetting curve and spaced repetition — review recent material
  often, older material less often."

---

## 2. Register / Login

**Click:** Go to Register, fill in name/email/password, submit. (Or just log in if the
account already exists.)

**Say:**
- "Passwords are hashed with bcrypt before they're ever saved — we literally cannot see
  anyone's plaintext password."
- "After login, the server gives the browser a signed token (JWT) that proves who you
  are on every request after that."

---

## 3. Onboarding (only shown to brand-new accounts)

**Click:** If prompted, select some Juz/pages you've "already memorized," then pick a
daily pace (e.g. 1 page/day), and finish.

**Say:**
- "This is a one-time setup: tell the app what you already know, and how many new pages
  a day you want to take on."
- "Anything you mark here gets backdated so it shows up as due for review right away,
  not treated as brand new today."

---

## 4. Dashboard (`/dashboard`)

**Click:** Land on the Dashboard after login. Point at the "new pages" column and the
"review" column. Tap a page to mark it complete, then show the Undo option.

**Say:**
- "This is the screen users open every day. Left side: new pages to memorize today, up
  to your daily goal. Right side: pages due for review."
- "Review pages come from two buckets behind the scenes — recently memorized pages
  (reviewed often) and older pages (rotated through on a cycle) — but we show them as one
  simple list so it's not confusing."
- "Marking something done updates instantly — no page reload — and you can undo it if you
  tap by mistake."
- Point at the **streak chip** and the **current-Juz ring**: "this tracks consecutive
  active days, and shows which Juz you're currently working through."

---

## 5. Progress (`/progress`)

**Click:** Open Progress. Show the 30-Juz map, then toggle to the detailed view. Scroll
to the activity calendar and the achievement badges.

**Say:**
- "This is the big-picture view — one tile per Juz, colored by how complete it is."
- "Below that is a GitHub-style calendar of daily activity, and badges for milestones
  like finishing a Juz or hitting 100 pages."
- "This page is read-only on purpose — if you want to *edit* what's memorized, there's a
  button that takes you straight to Settings."

---

## 6. Library (`/library`)

**Click:** Open Library, navigate to any page, tap play on the audio, open the tafsir
panel for a verse.

**Say:**
- "This is the actual Quran reader — all 604 pages, with full diacritics (tashkeel) so
  it reads correctly, audio from 5 different reciters, and commentary (tafsir) per verse."
- "We don't store any of the Quran text or audio ourselves — it's pulled live from public
  Quran APIs and cached so it loads instantly after the first time."

---

## 7. Memorize mode

**Click:** From a Library page, enter Memorize mode (the mode toggle/button). Turn on
"Test myself," tap a few blurred verses to reveal them, show the 7-step method checklist.

**Say:**
- "This is the same reader, just with a flag in the URL — so it keeps all the audio and
  tafsir features for free instead of being a separate page."
- "'Test myself' blurs the words instead of hiding them completely — you still see where
  on the page each word sits, which is closer to how real memorization recall works."
- "This is active recall — testing yourself, not just re-reading — which is the
  complement to the spaced-repetition scheduling on the Dashboard."

---

## 8. Settings (`/settings`)

**Click:** Open Settings. Show the daily-goal field, the review-intensity cards
(light/standard/strong), rest days, and the "edit memorized pages" tool.

**Say:**
- "Here's where you change your daily pace, how aggressive review is, and which days you
  take off — rest days don't break your streak."
- "You can also go back and edit exactly which pages are marked memorized, if you made a
  mistake during onboarding or want to add more."

---

## 9. (Optional) AI assistant

**Click:** Open the chatbot widget, ask something like "what should I memorize today?"

**Say:**
- "This isn't a generic chatbot — it's given a summary of your real progress (streak,
  pages left, today's tasks) before it answers, so the answer is actually about you."

---

## Wrap-up line

"Under the hood it's a React frontend talking to an Express/MongoDB backend over a REST
API, with JWT login and a scheduling engine that turns each user's memorization history
into a daily plan grounded in the Ebbinghaus forgetting curve and spaced repetition —
the same idea behind the traditional practice of Muraja'ah."
