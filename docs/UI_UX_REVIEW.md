# UI / UX design review — 2026-11-24

Read-only review of every page and shared component in `client/src`, done before the
declutter commits on `ui/declutter-review`. Evidence:

- **Screenshots:** 13 routes × 1440 / 768 / 390 px × light / dark × EN / AR (156 shots),
  plus Pixel 7 viewport shots of the reader, dashboard, menu and settings. Taken on the
  e2e stack (real API on an in-memory MongoDB, the production client build), with the
  tours marked as seen. They are not committed (≈40 MB); the PR carries the before/after
  pairs that matter.
- **Contrast:** axe-core 4.10 `color-contrast` on 9 routes, light + dark, 1440 px.
- **Controls:** a DOM sweep for every visible button/link with no text, and its name.

Tags: **[DECLUTTER]** = decision-free, done in Part B of this branch (each moved string
stays reachable by hover, tap and keyboard focus). **[PROPOSAL]** = needs the owner's taste
or a product decision; nothing in code. Mockups of the top proposals:
[`docs/features/ui-review-mockups.html`](features/ui-review-mockups.html).

---

## 1. Verdict and the highest-impact changes

**Verdict: the app is feature-rich and visually coherent, but it talks too much and the
phone view is a desktop layout stacked into one column.** Every page opens with a subtitle
that restates the page name, most settings carry a full sentence under the label, and the
reader puts a dozen labelled sections above the mushaf on a phone. Accessibility is
close: one unnamed control and 217 contrast failures, almost all from five grey/teal values.

Ranked by impact (effort in brackets):

1. **Phone reader: the mushaf first, tools in a bottom sheet** [PROPOSAL, M]. At 390 px the
   sidebar (page, juz/surah, bookmarks, tools, self-test, annotations, hard pages) fills the
   first two screens; the page itself starts below the fold and the audio dock floats over
   its top lines. The two edge tabs overlap the sidebar's "PAGE" label and Search button.
2. **One hint pattern everywhere; explanations behind it** [DECLUTTER, done]. ~45 helper
   sentences move into the `InfoHint` toggletip, which now opens on hover, tap and keyboard
   focus. Settings loses about a third of its visible text.
3. **Fix the five colours behind M-11** [PROPOSAL, S]. Exact replacements in §2.3; they clear
   ~190 of the 217 failing nodes with no visible change of style.
4. **Dashboard: one summary strip instead of four stat cards + a greeting card** [PROPOSAL, M].
   The greeting card is 300 px of mostly empty space; Daily review / Current Juz / Memorized
   repeat what the task lists and Progress already show.
5. **Dashboard: timer and to-do out of the first screen** [PROPOSAL, S]. On a phone the plan
   (the page's purpose) starts after ~1.5 screens of stats, timer and to-do.
6. **Settings: one "Display name"** [PROPOSAL, S]. Profile shows the account name as
   "Display name" and Community has a second "Display name" (the public one). Rename the
   second "Public name" or merge.
7. **Progress: one edit button, a real heatmap** [PROPOSAL, S]. "Edit progress" (map header)
   and "Edit in Settings" (map footer) do the same job; the Activity heatmap renders one
   column for a new account and looks broken.
8. **Landing: say each thing once** [PROPOSAL, S]. "Arabic & English" and "light & dark"
   appear four times each (hero ticks, feature card, chips, "Why our platform"); Privacy and
   Terms in its footer are `href="#"` dead links (`Landing.jsx:465-466`).
9. **Tooltips on touch** [DECLUTTER, done]. `Tooltip` opened on focus, so a tap on a phone
   left a "Close menu" bubble stuck over the drawer. It now ignores touch-started focus.
10. **Stale footer year** [DECLUTTER, done]. "© 2025" is hard-coded in both locales; it is now
    the current year.

---

## 2. Proposed design direction

### 2.1 Type scale (Inter / Noto, 1.25 ratio)

| Token | Size / line | Use | Today |
|---|---|---|---|
| display | 32/40 semibold | page title (one per page) | 30–36 px, extrabold on Progress, semibold elsewhere |
| title | 20/28 semibold | card / section title | 18–24 px mixed |
| body | 15/24 regular | text, inputs | 14–18 px mixed (Settings subtitle is 18 px) |
| label | 12/16 semibold, +0.04em, sentence case | field labels | 10–12 px UPPERCASE, +0.15em tracking |
| caption | 12/16 regular | meta, counts | 10–12 px |

The UPPERCASE wide-tracked labels ("SELF-TEST STYLE", "JUMP TO JUZ", "MEMORIZED PAGES")
are the main source of visual noise; sentence case at 12 px reads calmer and translates
better (Arabic has no case, so the AR UI already looks like the proposal).

### 2.2 Spacing and density

- 4-pt grid; card padding 20 (phone 16), gap between cards 16, between sections 32.
- One card style: white, 1 px `#e3e8f4` border, radius 16, no shadow at rest. Today cards mix
  shadow, border-left accents (orange/green), and coloured fills.
- Max one primary (filled) button per card. Dashboard review cards each carry a filled
  "MARK AS COMPLETE" — five filled buttons in a column; propose an outline check button with
  the label in a tooltip on desktop and a full-width "Mark all" at the end of the list.

### 2.3 Colour and contrast (M-11, measured)

axe-core, 1440 px: **217 failing nodes** (light 117 · dark 100 across 9 routes; Progress 110,
Library 38, Dashboard 21, Settings 19, Leaderboard 15, Login 6, Register 4, Landing 4, About 0).
Grouped by the colour pair, five values cause ~87 %:

| Now | On | Ratio | Proposed | Ratio | Where |
|---|---|---|---|---|---|
| `#707974` (muted text, light) | white / `#faf9f6` / `#f0f3ff` / `#e7eefe` | 4.49 / 4.26 / 4.05 / 3.86 | **`#646c67`** | 5.41 / 5.14 / 4.89 / 4.65 | labels app-wide, InfoHint text |
| `gray-400 #99a1af` (light) | `gray-100` / white | 2.36 / 2.60 | **`#646f80`** | 4.62 / 5.09 | Progress juz tiles "0%", empty states |
| `gray-500 #6a7282` (dark) | `#2a3546` / `gray-800` / `gray-900` | 2.56 / 3.03 / 3.66 | **`gray-400 #99a1af`** (or `#989eab`) | 4.6–6.6 | dark muted text everywhere |
| `#5ca08f`, `#5fb4a0` (teal, light) | white | 3.05 / 2.46 | **`#487e71`**, **`#3c8070`** | 4.67 / 4.65 | nav links, footer links, small accents |
| `#586070` (dark) | `gray-900` | 2.80 | **`#798396`** | 4.65 | Library dark captions |

Smaller ones: amber `#e17100` on `#fef3c6` → `#ab5600`; ribbon gold `#b38866` on `#f7f0da` →
`#8a6345`; error red `#ba1a1a` on dark → `#ea6767`; `#bfc9c3` avatar hint (1.69) → `#646c67`.
**Recommendation:** define them once as CSS tokens (`--text-muted`, `--text-subtle`,
`--accent-link`) in `index.css` and replace the hex classes; a single owner "yes" covers it.

### 2.4 Icons

Keep Feather (`react-icons/fi`) as the only set; today Dashboard mixes Feather with
`react-icons/md`-style filled shapes in the stat cards. 20 px in toolbars, 16 px inline,
1.75 stroke. Every icon-only control gets `Tooltip` + `aria-label` (all have names now except
the leaderboard switch, fixed in Part B).

### 2.5 Motion

150 ms opacity/transform for popovers and tooltips (already), 200 ms for sheets; nothing
on page load. Respect `prefers-reduced-motion` (the tours and the toast slide do not yet).

### 2.6 One tooltip / hint pattern (implemented)

| Need | Component | Opens on | Notes |
|---|---|---|---|
| Name an icon button | `Tooltip` | hover, keyboard focus (not touch focus) | the trigger always gets `aria-label` |
| Explain a concept or a setting | `InfoHint` (ⓘ toggletip) | hover (mouse), keyboard focus, tap/click | `aria-expanded` + `aria-describedby` while open; Escape and outside tap close; tap pins it open |
| Keyboard shortcuts | `InfoHint` with a list | same | shortcuts are listed in a hint next to the control, not in running text |

Rule of thumb: if the user needs the text to *act* (button text, field label, error, a
destructive warning in a confirm dialog), it stays visible; if it *explains*, it goes in
the hint.

### 2.7 Empty / loading / error states

Already good and consistent (`ErrorNotice` with Retry; skeletons on Dashboard). Proposals:
one empty-state shape (icon 32 px, one line, one action) — today "No bookmarks yet.",
"Your activity will appear here as you progress" and the to-do empty text all differ in
size and colour; and make the Progress heatmap show an empty 12-week grid instead of a
single column.

---

## 3. Per page

### Global chrome — Navbar, Footer, Chatbot, toasts, modals

- [DECLUTTER] `Tooltip` stays open after a tap on touch screens (seen on the phone drawer's
  "Close menu"). Show it on keyboard focus only (`:focus-visible`), not on tap.
- [DECLUTTER] Footer "© 2025 Quran Tracker…" (`footer.copyright` in both locales) → current year.
- [PROPOSAL] Nav links are teal `#5ca08f` on white (3.05:1) — see §2.3.
- [PROPOSAL] Phone drawer has no backdrop; the page under it stays visible and tappable-looking.
  Add a dim backdrop and close on tap outside.
- [PROPOSAL] The chat bubble (56 px, bottom-right) covers content on every page at 390 px
  (the annotations "Next" button in the reader, the stat card on the dashboard). Move it into
  the navbar on phones, or hide it on `/library` where the audio dock lives.
- [PROPOSAL] "AR" text button and the globe item: use one language control (the globe + "العربية"
  label in the drawer is clearer than a bare "AR").
- Toasts and modals: fine (one `useDialog`, focus handled). No change.

### Landing (`pages/Landing.jsx`)

- [PROPOSAL] Repetition: "100% free · Arabic & English · Light & dark mode" ticks, the
  "Arabic & English, Light & Dark" card, its four chips, and "Why our platform" say the same
  thing. Keep the ticks, drop the card and the section.
- [PROPOSAL] Privacy / Terms are dead `#` links (`:465-466`) — publish the drafts in
  `docs/legal/` or remove the links (owner decision already on the TODO list).
- [PROPOSAL] Three hero buttons ("Start Memorizing Free", "See How It Works", "Browse the Mushaf");
  two is the usual maximum. Keep Start + Browse; "How it works" is in the nav.
- [PROPOSAL] "Spiritual Productivity Reimagined" badge and "Smart Review — Spaced repetition
  algorithms ensure you review right before you forget… Retention Strength 92%" overclaim: the
  scheduler is a recent bucket + cycle, not per-page SRS, and 92 % is invented. Reword.

### About (`pages/About.jsx`)
- Passes contrast; fine. [PROPOSAL] Personal Gmail as contact (L-16, already on TODO).

### Login / Register / Forgot / Reset

- Text is already minimal; password rules stay visible (needed to act).
- [PROPOSAL] Password show/hide targets are 40×40 but only the icon is visible; fine. Contrast:
  6 nodes on Login (placeholder grey) — covered by §2.3.

### Onboarding (`pages/Onboarding.jsx`)

- [DECLUTTER] Move into hints: `onboarding.alreadyMemorizedHint` (:204) "Select the Juz you've
  fully memorized and/or add specific page ranges or Surahs.", `onboarding.tabGuideCombine`
  (:214) "You can combine tabs — selections from all three add up.", `onboarding.dailyGoalDesc`
  (:241), `onboarding.directionDesc` (:276), `onboarding.directionEndHint` (:303),
  `onboarding.directionCustomHint` (:376), `onboarding.customizeDesc` (:436),
  `onboarding.reviewIntensityDesc` (:441), `onboarding.restDaysDesc` (:504).
- Keep visible: the option-card descriptions ("Start with the short surahs of Juz 'Amma…") —
  they are what the user chooses between.
- [PROPOSAL] Welcome screen: the 🎉 emoji and "Find tranquility in discipline…" (:182) are a
  whole step for one button. Fold the welcome line into step 1's header.
- [PROPOSAL] The welcome screen has only "AR" in the corner — no theme toggle, no sign-out
  (a user who registered by mistake cannot leave without finishing).

### Dashboard (`pages/Dashboard.jsx`)

- [DECLUTTER] `dashboard.subtitle` (:791) "Here's your plan for today — new pages to memorize
  and reviews to keep them strong." → hint next to the greeting.
- [DECLUTTER] `dashboard.restSubtitle` (:1032) — a 40-word paragraph on rest days → hint next
  to the rest-day title.
- [DECLUTTER] `dashboard.pausedGoalNote` (:1146) "Your goal of N pages/day is saved — resume in
  Settings when you're ready." → hint next to the paused label.
- [DECLUTTER] `dashboard.continueHint` (:1174) "No new page today — focus on perfecting
  yesterday's page." → folded into the continuation hint already there (:1168).
- [PROPOSAL] Merge greeting + 3 stat cards into one strip (mockup A): "Assalamu Alaikum, Ahmed ·
  🔥 0 · Review 9 · Juz 3 95 % · 83/604". Saves ~350 px.
- [PROPOSAL] Order on phone: Today's plan → Week → timer/to-do (collapsed). Today the plan
  starts at ~1,300 px on a 390 px screen.
- [PROPOSAL] "How to memorize" appears twice (tab bar link + "How to memorize this page" on
  every new-page card). Keep the per-card one.
- [PROPOSAL] "Already Know" (underlined link) next to "MARK AS COMPLETE": unclear difference.
  Rename "I know it already" and move it into a ⋯ menu on the card.
- [PROPOSAL] Review cards: 5 filled lavender buttons in a column (see §2.2). Use a round check
  button (tooltip "Mark as reviewed") — mockup A.
- [PROPOSAL] "Tip of the Day" (collapsed card) + the quote below are two inspirational blocks;
  keep the quote only.
- [PROPOSAL] The `REVIEW` badge on phone review cards repeats the section title "Review".

### Progress (`pages/Progress.jsx`)

- [DECLUTTER] `progress.subtitle` (:421) "Track your spiritual journey and memorization
  milestones." → removed from the header band; reachable as a hint by the title.
- [PROPOSAL] Two edit buttons: "Edit progress" (:578) and "Edit in Settings" (:768). Keep the first.
- [PROPOSAL] Juz tiles show "0%" on 26 of 30 tiles in `gray-400` (the page's 110 contrast
  failures). Show nothing for 0 %, and darken per §2.3.
- [PROPOSAL] Activity heatmap with little data is a single column of three squares; always draw
  12 weeks.
- [PROPOSAL] The green header band is the only page with one; drop it for the common page header.
- [PROPOSAL] Chart "Pages Memorized Over Time" with one point is noise; show it after ≥ 2 days.

### Settings (`pages/Settings.jsx`)

- [DECLUTTER] Into hints: `settings.subtitle` (:835), `settings.avatarHint` (:899),
  `settings.emailHint`, `settings.community.desc` (:442), `community.displayNameHint`
  (:472), `community.optInHint` (:478), `settings.dailyTargetDesc` (:1036),
  `memDirectionDesc` (:1109), `memDirectionEndHint` (:1139), `memStartWrapHint` (:1225),
  `reviewSettingsDesc` (:1242), `modeIntensityDesc` (:1298), `restDaysDesc` (:1316),
  `pauseMemDesc` + `pauseMemSwitchBack` (:1367-1369), `cycleStartDesc` (:1416),
  `helpDesc` (:1607), `showGuideDesc` (:1614), `replayTourDesc` (:1628),
  `replayLibraryTourDesc` (:1642), `resetProgressDesc` (:955), `deleteAccountDesc` (:964)
  (the confirm dialogs still say "This cannot be undone").
- [DECLUTTER] `settings.singleKeysDesc` (:359) is a shortcut list in running text ("/ to search,
  S for the sidebar, P, H, E, T and 1-4…") → hint next to the switch.
- [DECLUTTER] The leaderboard opt-in switch (:482) has no accessible name (axe `button-name`,
  critical) → `aria-labelledby` its visible label.
- [DECLUTTER] `MemorizedUnitPicker`: `settings.juzGridNote` (:265) "Orange = partially memorized…
  Click to select all → click again to mark for removal (red) → click once more to restore."
  and `settings.rangeTabHint` (:387) → hints (shared with Onboarding).
- [PROPOSAL] Two "Display name" fields (Profile + Community) — rename the public one "Public
  name" (mockup C).
- [PROPOSAL] Section rail "Profile / Memorization / Theme / Help": "Theme" holds only the theme
  switch and the shortcuts toggle — merge Theme + Help into "Preferences".
- [PROPOSAL] Danger zone: "Reset Data" vs "Reset Progress" label mismatch; use one word.
- [PROPOSAL] Split Settings.jsx (already on TODO §5) before any layout redesign.

### Leaderboard (`pages/Leaderboard.jsx`)

- [DECLUTTER] `leaderboard.joinBody` (:125) and `leaderboard.displayNameHint` (:145) → hints;
  the "join" card keeps its title, field and button.
- [PROPOSAL] Empty leaderboard for a new deployment: show a friendly one-liner instead of an
  empty table.

### Library (`pages/Library.jsx` + reader components)

- [DECLUTTER] `ReciterPicker` `library.reciters.hafsNote` (:309) "Every recitation here is Hafs
  ‘an ‘Asim…" → hint in the picker header.
- [DECLUTTER] `VerseSearch` key legend (:465-468, ↑ ↓ Enter Del Esc) → one "Keyboard" hint in
  the footer; the legend is useless on touch, so the row disappears there.
- [DECLUTTER] `TodoList` `todo.moveHint` (:362) and `todo.localNote` (:360) → hints.
- [DECLUTTER] `TafsirPanel` `library.tafsirCovers` (:376) "This commentary covers verses 5–7
  together — the book explains the whole passage at once…" → short visible "Verses 5–7" + hint.
- Already right: self-test (`InfoHint` at :5264), draw tools (`hints.drawTools`), zoom.
- [PROPOSAL] **Phone layout** (mockup B): mushaf first; page nav as a compact top bar
  (‹ 50 / 604 ›, surah · juz); sidebar content in a bottom sheet opened from a single "Tools"
  button; audio dock collapses to play + reciter, docked at the bottom, never over the page.
- [PROPOSAL] Sidebar order (desktop): Page / Juz / Surah → Bookmarks → Self-test → Annotations
  → Hard pages → Tools. "MARK VERSES" is a section with a single link; fold it into the
  page footer next to the memorized tick.
- [PROPOSAL] The page number input under "50 / 604" duplicates the counter; make the counter
  itself editable.
- [PROPOSAL] Edge tabs (‹ on both sides at 390 px) overlap sidebar content; hide them while the
  sidebar is the page's content on phones.
- [PROPOSAL] Audio dock shows "Listen to the recitation" as a label next to the play button;
  the play button's tooltip already says it.

### Guided tours (`dashboardTour.js`, `libraryTour.js`), HowToMemorizeModal

- [PROPOSAL] The library tour is 6 steps with 30–40-word bodies (`libraryTour.verseBody`
  :106 is 34 words). Cut each to ≤ 15 words, 4 steps.
- [PROPOSAL] HowToMemorizeModal: 7 numbered steps + an intro paragraph; fine as a modal, but the
  intro (`howTo.intro`, :56) repeats the dashboard tour's "Listen" step.

---

## 4. Feature suggestions

| Feature | Effort | Why |
|---|---|---|
| Phone reader layout (bottom sheet tools, docked audio) | M | The reader is the flagship and unusable one-handed today |
| "Continue where I left off" card on the Dashboard (last read page + resume audio) | S | Recent pages exist (`useRecentPages`) but only inside the reader |
| One-tap "Mark all reviewed" at the end of the review list | S | Today "MARK ALL" is a 10 px outlined label at the top |
| Per-page review quality (Easy / OK / Hard) on the review card | M | The documented next step toward real spaced repetition; data the hard-flag already hints at |
| Install as an app (PWA manifest + offline shell) | M | Phone use is the main use case; home-screen icon, full-screen reader |
| Reminder notification at a chosen time | M | The timer already asks for notification permission; a daily nudge supports the streak |
| Quiet mode / focus reading (hide all chrome in the reader) | S | Was removed as "focus mode"; a single toggle that hides sidebar + dock is still the most requested reader feature in apps of this kind |
| Weekly summary on Progress ("this week: 7 new, 63 reviewed") | S | Replaces the one-point chart with something meaningful early |

---

## 5. Phone view (390 px, Pixel 7)

Measured in Chromium with touch emulation; AR mirrored correctly in every shot.

1. **Reader:** the sidebar is the first ~1,700 px of the page; the mushaf follows, with the
   audio dock (≈180 px) drawn over its first lines. Edge tabs overlap "PAGE" and "Search".
   [PROPOSAL, mockup B]
2. **Dashboard:** greeting card, two stat cards, the memorized card, timer and to-do come
   before "Today" (~1,300 px). The chat bubble covers the Memorized card's corner. [PROPOSAL]
3. **Tooltips stuck after taps** (menu button, icon buttons). [DECLUTTER, fixed]
4. **InfoHint popovers** were tap-only and 260 px wide; they now open on tap and stay inside
   the viewport (8 px margins) in both directions. [DECLUTTER]
5. **Drawer:** no backdrop; Logout sits beside the email with no separation; tap targets are
   fine (44 px rows). [PROPOSAL]
6. **Settings:** the section rail becomes a vertical list above the content, so "Memorization"
   is ~2 screens away from the top. Use a horizontal scrollable tab row on phones. [PROPOSAL]
7. **Review cards:** the button wraps under the title (fine), but five full-width-ish buttons
   make the list long; see Dashboard proposals. [PROPOSAL]
8. **Progress juz grid:** 5 columns at 390 px, readable; the detailed page grid is 604 tiny
   tiles — needs a pinch/zoom or a per-juz drill-down on phones. [PROPOSAL]
9. **VerseSearch:** the keyboard legend row is shown on touch screens. [DECLUTTER, moved into
   a hint]
10. **Safe areas:** the chat bubble and audio dock ignore `env(safe-area-inset-bottom)`;
    on iPhones they sit under the home indicator. [PROPOSAL, S]
