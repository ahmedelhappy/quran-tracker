# Quran Tracker — how the app works

Link to pages with these exact paths (nothing else is a real page):
/dashboard · /progress · /library?page=N (N = 1–604) · /leaderboard · /settings?tab=profile · /settings?tab=memorization · /settings?tab=memorization&edit=1 · /settings?tab=appearance

## Pages
- **/dashboard** — today's plan. "Today": new-memorization cards and review cards (newest pages carry a "Recent" badge). "Mark as Complete" when done (Undo appears); "Already Know" on a new page counts it without using today's goal; "Want more?" offers extra pages. "This Week" previews the coming days. Shows the streak, the current Juz ring and pages memorized.
- **/library** — the Quran reader: the exact 604-page Madinah mushaf. Details below.
- **/progress** — 30-Juz memorization map, surah breakdown, charts, milestones and a projected completion date. "Edit progress" in the map's header: tick pages, a whole Juz or a surah, then Save.
- **/settings?tab=profile** — name, language, password, Community (leaderboard), and the Danger Zone (reset progress, delete account).
- **/settings?tab=memorization** — the daily plan (below) and "Edit Progress" for pages already memorized.
- **/settings?tab=appearance** — light, dark or auto theme.
- **/leaderboard** — opt-in ranking (This Week / All Time). Only a chosen display name is shown.

## The daily plan
- **New pages**: a daily goal of 0.5–10 pages. 0.5 means half a page a day (the page splits at its middle verse). A partly memorized page's remaining verses always come first.
- **Direction**: from the beginning (Al-Baqarah onward), from the end (the short surahs of Juz 'Amma first, surah by surah, each from its beginning), or a custom start (a chosen Juz or Surah).
- **Review (Muraja'ah)**: *recent* review repeats your newest pages often; *cycle* review rotates through everything older, oldest-reviewed first. Intensity: Relaxed (~14-day cycle), Balanced (~10, default), Serious (~7), or a fixed number per day.
- **Available days**: untick a weekday to make it a rest day — no tasks, and the streak survives it.
- **Advanced**: pause new memorization (review only), recent-review count, and where the cycle starts.
- **Streak**: consecutive active days; rest days never break it.

## The Library reader
- **Turning pages**: ← or PageDown = next page (the mushaf reads right to left), → or PageUp = previous; the arrows at the page edges; swipe on touch; the page slider; Jump to Juz / Surah or type a page number in the sidebar; "1 page / 2 pages". S shows or hides the sidebar.
- **Verses**: tap a verse to select it (the tafsir follows the selection). Right-click, or press and hold on touch, for its actions: play from here, previous/next verse, tafsir, highlight colours, note, mark as hard.
- **Listening** (bottom bar): play/pause, previous/next verse, speed 0.75–2×, five reciters (Alafasy, Husary, Minshawi, Hudhaify, Muhammad Ayyoub). Recitation flows on across verses and pages. **Repeat**: one verse ×2/×3/×5/∞, or a range with a count per verse and a count for the whole range. Drag across verses on the page to pick a range, then choose counts and "Play range".
- **Tafsir**: from a verse's actions (book icon) or the tab on the page's edge. Editions: Al-Muyassar, Aysar at-Tafasir, Ibn Kathir, As-Sa'di, Al-Jalalayn, Al-Baghawi, Al-Qurtubi, At-Tabari, and I'rab (grammar). On wide screens it docks beside the page; drag its edge to resize.
- **Self-test** (sidebar "Self-test style"): *Hide all* blurs the text — hover to peek at a word, click a verse to reveal it, drag to reveal in order; *Cover cursor* keeps the text but blurs the words under the pointer.
- **Memorized marks**: the circle under each page toggles it (green = memorized, amber = part). "Mark verses…" in the sidebar: tap the first verse, then the last, to mark exactly that range.
- **Annotations**: highlights, notes and "hard" flags from a verse's actions; the flag under a page marks the whole page hard. The pencil at the top of a page draws: pen, highlighter, text, eraser (keys P/H/T/E, Ctrl+Z to undo), across both pages of a spread. The eye hides or shows annotations. The sidebar lists hard verses and steps between annotated pages.
- **Bookmarks**: sidebar — add one with an optional label; tap to jump back.
- **Zoom**: hold Ctrl and scroll (or pinch) over the page, or use the magnifier in the bottom bar (−, +, fit). Move around a zoomed page by scrolling, or hold Space and drag.
- **Memorization steps**: a 7-step method checklist in the sidebar, with a full guide.

## Common tasks
- Change the daily goal: /settings?tab=memorization → Daily Target → Save.
- Record pages already memorized: /progress → Edit progress, or /settings?tab=memorization&edit=1.
- Start from Juz 'Amma: /settings?tab=memorization → Memorization Direction → From the end.
- Rest one day a week: /settings?tab=memorization → Available Days → untick it.
- Review only for a while: /settings?tab=memorization → Advanced → pause new memorization.
- Listen to a page: /library?page=N → play in the bottom bar.
- Read a verse's tafsir: select it in /library, open Tafsir.
- Join the leaderboard: /settings?tab=profile → Community → display name → switch it on.
- Reset progress or delete the account: /settings?tab=profile → Danger Zone.
