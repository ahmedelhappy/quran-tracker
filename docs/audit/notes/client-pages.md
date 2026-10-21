> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Audit notes: client pages (App, main, About, Dashboard, Landing, Leaderboard, Login, Onboarding, Progress, Register, Settings)

Auditor scope: client route shell and every page except Library. Read-only. Supporting files opened to judge
correctness: `utils/returnTo.js`, `services/api.js`, `context/AuthContext.jsx`, `components/ProtectedRoute.jsx`,
`components/ConfirmModal.jsx`, `components/Navbar.jsx` (logout), `components/LanguageToggle.jsx`, `i18n.js`,
`utils/unitRanges.js` (coverage helpers), `data/juzRanges.js`, `context/ToastContext.jsx` (live region),
react-router 7.13.0 dist (`node_modules/react-router/dist/development/chunk-JZWAC4HX.mjs`), and on the server
`controllers/progressController.js` (completeTask, onboarding, getAllProgress, nextNewItems),
`controllers/authController.js` (changePassword, deleteAccount, displayName), `middleware/auth.js`,
`models/User.js`, `middleware/rateLimiters.js`, `controllers/leaderboardController.js` (payload shape).

## 1. Coverage manifest

| Path | Lines | Read in full | Note |
|---|---|---|---|
| client/src/App.jsx | 122 | YES | All pages lazy() + one Suspense; PublicRoute honours `returnTo`; onboarding gate only on /dashboard |
| client/src/main.jsx | 14 | YES | StrictMode + top-level ErrorBoundary |
| client/src/pages/About.jsx | 113 | YES | Static; personal email in mailto; own nav/footer (no Navbar) |
| client/src/pages/Dashboard.jsx | 1213 | YES (4 chunks) | Half-page "Mark all"/extras bug; misleading empty state on API failure |
| client/src/pages/Landing.jsx | 469 | YES | Dead Privacy/Terms/Contact links; FAQ without aria-expanded |
| client/src/pages/Leaderboard.jsx | 213 | YES | displayName rendered as text (safe); prefills real name; unlabeled input |
| client/src/pages/Login.jsx | 117 | YES | returnTo via safeReturnTo; public demo credentials hint |
| client/src/pages/Onboarding.jsx | 922 | YES (2 chunks) | Non-atomic 3-phase submit; color-only tiles; fake 2.5 s delay |
| client/src/pages/Progress.jsx | 904 | YES (2 chunks) | Good error+retry; aria-pressed in edit mode; recharts chunk |
| client/src/pages/Register.jsx | 130 | YES | Client-side 6-char check mirrors server; no returnTo |
| client/src/pages/Settings.jsx | 1887 | YES (5 chunks) | Swallowed load error + replace-save; stale partialPages; reset not reflected; password change kills session |
| client/src/utils/returnTo.js | 20 | YES | Normalisation can emit `//host`; neutralised by router today |
| client/src/services/api.js | 121 | YES | 401 interceptor; token in localStorage |
| client/src/context/AuthContext.jsx | 148 | YES | checkAuth logs out on ANY error; logout clears only `token` |
| client/src/components/ProtectedRoute.jsx | 30 | YES | Redirects to /login without returnTo |
| client/src/components/ConfirmModal.jsx | 98 | YES | Exemplary dialog (alertdialog, focus trap, Escape, focus return) |

## 2. Findings

Severity counts: High 3 · Medium 12 · Low 16 · Info 2 (total 33).

---

### CP-01 Half-page plan: "Mark all" and "Want more" cards credit the WHOLE page memorized
- Severity: High · Category: Data integrity · Confidence: LIKELY (traced client to server) · Effort: S
- Evidence:
  - `client/src/pages/Dashboard.jsx:157` the single card passes the segment: `onClick={() => onComplete(page.pageNumber, type, page.segment)}`
  - `Dashboard.jsx:587` Mark all drops it: `const markAllNew = () => newPending.forEach(p => markComplete(p.pageNumber, 'new'));`
  - `Dashboard.jsx:218` ExtraTaskCard drops it: `onClick={() => onComplete(pageNumber, type)}`
  - `server/controllers/progressController.js:689` segment path only when `segment && typeof segment.fromVerseKey === 'string' ...`; otherwise `:714` `{ $set: { status: 'memorized', ..., segments: [] } }` = full page.
  - Server extras are segment-aware (`progressController.js:253-260`, `nextNewItems` `:168-201`): on a 0.5/day plan the extras are e.g. [p10 second half, p11 first half, p11 second half].
  - Completion state is keyed by page, not by segment: `Dashboard.jsx:468` `const key = \`${type}-${pageNumber}\`;`, `:963` `done={completedKeys.has(\`new-${page.pageNumber}\`)}`; extras list key `:962` `key={\`extra-new-${page.pageNumber}\`}` duplicates when both halves of one page are listed.
- Impact: a 0.5 page/day user who taps "Mark all" (shown whenever `newPending.length > 0`) or completes any "Want more" card gets the full page recorded as memorized. Their review queue, progress %, estimate and leaderboard are silently inflated. After finishing today's half, the extra card for the same page's second half already shows "Done" (key collision) and cannot be completed; React logs duplicate-key warnings.
- Recommendation: pass `p.segment` in `markAllNew` and in `ExtraTaskCard`; key completion by `${type}-${pageNumber}-${segment?.half ?? 'full'}` (or by fromVerseKey); de-duplicate React keys the same way.

### CP-02 Settings: a failed progress load plus replace-semantics save can wipe all memorized progress
- Severity: High · Category: Data integrity / Reliability (swallowed error) · Confidence: LIKELY · Effort: S
- Evidence:
  - `Settings.jsx:840-847` load errors swallowed, state stays `[]`: `.then(([juzRes, allRes]) => { ... setMemorizedPageNums(allRes.data.data.memorizedPages ?? []); ... }).catch(() => {});`
  - `Settings.jsx:852-857` `?edit=1` (from Progress CTA, `Progress.jsx:699`) opens the editor on mount, before the fetch resolves.
  - `Settings.jsx:150` editor seeds from that state: `setCoverage(coverageFromProgress(memorizedPageNums, partialPages));`
  - `Settings.jsx:240-247` save is a full REPLACE: `await progressAPI.updateMemorized({ memorizedPages: fullPages });`
  - The "Edit progress" button (`Settings.jsx:1190`) is enabled regardless of load state.
- Impact: on a flaky mobile connection, `GET /progress/all` fails silently; the editor shows nothing memorized; the user selects (say) the Juz they just finished and saves; every other memorized page is deleted. There is no undo. If the fetch merely arrives late, the effect at `:148-158` re-seeds and silently discards whatever the user already selected.
- Recommendation: track `loadState` ('loading' | 'error' | 'ready'); disable Edit progress and block the `?edit=1` auto-open until 'ready'; show an inline error + retry; optionally have the server reject a replace that removes more than N pages without an explicit `confirmRemoval` flag.

### CP-03 Settings editor: `partialPages` is not refreshed after save, so a second save corrupts partial/full pages
- Severity: Medium · Category: Data integrity · Confidence: LIKELY · Effort: S
- Evidence: `Settings.jsx:1854-1860`
  ```js
  onSave={() => Promise.all([ progressAPI.getJuzProgress(), progressAPI.getAllProgress() ])
    .then(([juzRes, allRes]) => { setMemorizedJuz(juzRes.data.data); setMemorizedPageNums(allRes.data.data.memorizedPages ?? []); })
    .catch(() => {})}
  ```
  (no `setPartialPages`). `utils/unitRanges.js:125-137` `coverageFromProgress` seeds a page from its OLD segments whenever `partialByPage` has it, overriding the whole page.
- Impact: in one Settings session, (a) completing a half page to full and saving, then reopening and saving anything, downgrades that page back to the old half; (b) adding a Hizb that ends mid-page (creating a partial) and saving, then reopening and saving, upgrades it to a full page. Silent.
- Recommendation: also `setPartialPages(allRes.data.data.partialPages ?? [])` in `onSave`; better, extract one `reloadProgress()` used by mount, onSave and reset.

### CP-04 Settings "Reset progress" does not refresh local progress state; the editor can restore the reset
- Severity: Medium · Category: Data integrity / UX · Confidence: LIKELY · Effort: S
- Evidence: `Settings.jsx:1012-1016`
  ```js
  await progressAPI.resetProgress();
  await refreshUser();
  showToast(t('settings.progressReset'), 'success');
  ```
  `memorizedPageNums`, `partialPages` and `memorizedJuz` keep their pre-reset values.
- Impact: "Currently tracking" (`:1199-1207`) still lists the Juz that were just reset. Opening Edit progress shows the old pages selected; saving (even after an unrelated tweak) writes them all back, undoing the reset the user just confirmed.
- Recommendation: call the shared `reloadProgress()` (see CP-03) after reset.

### CP-05 Multi-request saves are non-atomic (Onboarding submit, Settings progress editor)
- Severity: Medium · Category: Data integrity / Reliability · Confidence: LIKELY · Effort: M (server batch endpoint)
- Evidence:
  - `Onboarding.jsx:266-279` three phases: `completeOnboarding(...)`, then a sequential loop of `updateUnits(...)`, then `authAPI.updateProfile({ offDays, memorizationDirection, ... })`, then `refreshUser()`.
  - Server sets `onboardingComplete: true` in phase 1 (`progressController.js:416-420`).
  - `Settings.jsx:246-250` replace, then N `updateUnits` adds.
- Impact: if any later request fails (network or 300/15-min rate limit), Onboarding shows a generic error toast but the account is already "onboarded" with default rest days, direction and intensity. A reload sends the user to the dashboard with the wrong plan and no hint. In Settings, a failure after the replace drops the Hizb/quarter remainders that were selected.
- Recommendation: a single server endpoint that accepts `{ fullPages, verseRanges, profile }` in one transaction (or at least set `onboardingComplete` last). On the client, retry the failed tail and report exactly what was saved.

### CP-06 Changing the password silently ends the current session
- Severity: Medium · Category: Security UX / Auth flow · Confidence: LIKELY (code-traced; not executed) · Effort: S
- Evidence:
  - `server/models/User.js:134-135` `this.passwordChangedAt = new Date(Date.now() - 1000);`
  - `server/middleware/auth.js:37-44` rejects any token with `decoded.iat < changedAtSec`, which includes the token of the tab that made the change.
  - `server/controllers/authController.js:428` returns no new token: `res.status(200).json({ success: true, message: 'Password changed successfully' });`
  - `client/src/pages/Settings.jsx:584-586` shows success and keeps the old (now dead) token.
- Impact: the user sees "Password updated", then their next click 401s. `api.js:32-35` deletes the token and hard-redirects to /login with no explanation. This reads as a bug or a hack. The security intent (revoke other sessions) is right.
- Recommendation: the server issues a fresh JWT in the change-password response; the client stores it (`localStorage.setItem('token', ...)`) and tells the user that other devices were signed out.

### CP-07 Account deletion leaves bookmarks and annotations (notes, highlights, drawings) behind
- Severity: High · Category: Privacy / Compliance (right to erasure) · Confidence: CONFIRMED (static: grep shows no `Annotation.deleteMany` or `Bookmark.deleteMany` anywhere in server, and no cascade hook in `models/User.js`) · Effort: S
- Evidence: `server/controllers/authController.js:442-444`
  ```js
  await UserProgress.deleteMany({ userId });
  await Todo.deleteMany({ userId });
  await User.findByIdAndDelete(userId);
  ```
  `server/models/` contains `Annotation.js` and `Bookmark.js`. Client copy promises more: `client/src/locales/en.json:351` "This will permanently delete your account and all associated data."
- Impact: personal free-text notes on verses, highlights, hard flags and drawings stay in the database after the user was told they were deleted. This is a GDPR-style erasure failure and a trust problem at public launch.
- Recommendation: delete Annotation and Bookmark documents too (ideally in one transaction or a `pre('findOneAndDelete')` cascade); add an integration test asserting that zero docs remain in every per-user collection. Cross-check owner: server auditor.

### CP-08 Public demo account credentials on the login page; no server-side guard on the account
- Severity: Medium · Category: Security / Abuse · Confidence: LIKELY · Effort: M
- Evidence: `Login.jsx:95-97` renders `t('auth.demoHint')`; `client/src/locales/en.json:54` contains the demo email and password in plain text (value REDACTED here). Grep for "demo" in server (excluding `seed/`) returns nothing, so the account has no special handling.
- Impact: once launched, anyone can sign in as demo, change its password (locking everyone else out; see CP-06), delete the account, rename it, opt it into the public leaderboard under an offensive display name, write notes, or burn the shared rate-limit budget.
- Recommendation: make the demo read-only server-side (block password, profile, delete, leaderboard and annotation writes, or reset it nightly), or replace it with a "try without account" path (the Library is already public).

### CP-09 API-down behaviour: misleading empty state on Dashboard; transient errors log the user out
- Severity: Medium · Category: Reliability · Confidence: LIKELY · Effort: S
- Evidence:
  - `Dashboard.jsx:376-377` on failure only a toast: `if (alive) showToast(appI18n.t('dashboard.failedTasks'), 'error');` and `data` stays null.
  - The render then falls through to `:1055-1056` `<p ...>{t('dashboard.noNewToday')}</p>`, i.e. "no new pages today", with no retry. The stat cards show `— / 604`.
  - `context/AuthContext.jsx:48-51` any `getMe` failure (network, 500, CORS) does `localStorage.removeItem('token'); setUser(null);`.
- Impact: during a server outage or cold start, users are signed out (they must log in again later) or see "nothing to do today", which is wrong information about their daily obligation. Progress and Leaderboard do this correctly with an error banner and Retry.
- Recommendation: Dashboard gets an error state with Retry like `Progress.jsx:376-386`. AuthContext removes the token only on 401/403 and keeps the session (with an offline banner) on network or 5xx errors.

### CP-10 "Today" is the UTC day for every user
- Severity: Medium · Category: Data integrity / Product (date logic) · Confidence: LIKELY (by design, documented) · Effort: L
- Evidence: `Dashboard.jsx:344` `const todayDateString = new Date().toISOString().split('T')[0];`; `:533-539` missed-day banner with `setUTCHours(0,0,0,0)`; server getDateString is UTC (CLAUDE.md "Date handling").
- Impact: for Indonesia and Malaysia (UTC+7 to +9) the day rolls over at 7 to 9 AM local, so the very common after-Fajr session counts toward "yesterday". For the Americas it rolls at 4 to 8 PM. Streaks, "done today", undo windows and rest days all shift. This is a large share of the target audience.
- Recommendation: store an IANA timezone per user (captured from `Intl.DateTimeFormat().resolvedOptions().timeZone`), compute day keys server-side in that zone, and send it on register/login.

### CP-11 Selection tiles convey their state by color only (no aria-pressed or checked state)
- Severity: Medium · Category: Accessibility (WCAG 1.4.1, 4.1.2) · Confidence: LIKELY · Effort: S-M
- Evidence: `Onboarding.jsx:371-383` Juz tiles are `<button ... className={isCovered(...) ? 'bg-[#003527] text-white' : ...}>` with no `aria-pressed`. Same for Hizb `:401-415`, quarter `:429-443`, Surah `:465-482`, daily goal `:560-576`, direction `:593-606`, custom start `:638-649`, `:658-669`. In Settings: editor tiles `:319-340`, `:362-383`, `:403-418`, `:447-473`; daily options `:1225-1235`; direction `:1302-1317`; intensity cards `:1431-1450` (a "●/○" glyph is the only cue). Partial (amber) and removed (red) states are color-only. Counter-example done right: `Progress.jsx:615`, `:668`, `:773` use `aria-pressed`.
- Impact: screen-reader users cannot tell which Juz or Surah is selected during onboarding (the core first-run task) or in the progress editor. Color-blind users cannot tell "partial" from "removed".
- Recommendation: `aria-pressed={state==='full'}` (and `aria-label` with "partially selected" or "will be removed"); single-choice groups become `role="radiogroup"` / `role="radio"` + `aria-checked`. Add a non-color marker (icon or pattern) for partial and removed.

### CP-12 Settings "Edit progress" modal is not an accessible dialog
- Severity: Medium · Category: Accessibility (WCAG 2.1.2, 2.4.3, 4.1.2) · Confidence: LIKELY · Effort: S
- Evidence: `Settings.jsx:263-266` `<div className="fixed inset-0 z-50 ..."><div className="absolute inset-0 bg-black/40 ..." onClick={onClose} /><div className="relative bg-white ...">`. It has no `role="dialog"`, no `aria-modal`, no labelled title, no initial focus, no Tab trap, no Escape and no focus return. The close button (`:270`) is an icon-only button whose only name comes from Tooltip.
- Impact: keyboard and screen-reader users tab behind the modal into the page; Escape does nothing. `ConfirmModal.jsx` already implements all of this correctly and could be reused.
- Recommendation: extract the ConfirmModal focus and keyboard logic into a `<Dialog>` primitive and use it for EditProgressModal (and HowToMemorizeModal, if it lacks the same behaviour).

### CP-13 Form fields without programmatic labels; errors are toast-only
- Severity: Medium · Category: Accessibility (WCAG 1.3.1, 3.3.1, 4.1.2) · Confidence: LIKELY · Effort: S
- Evidence:
  - `Settings.jsx:609-617` ChangePassword `<label className=...>{label}</label>` + `<input type=...>` with no `htmlFor`/`id`, so all three password fields are unnamed.
  - Same pattern in `Settings.jsx:1108-1117` (display name), `:1121-1128` (email), `:700-711` (CommunityCard display name).
  - `Leaderboard.jsx:121-128` input has only a placeholder.
  - `Onboarding.jsx:454-460` (surah search), `:502-516` (range inputs), `:796` (fixed review); `Settings.jsx:1483`, `:1576`, `:1694` are number inputs with no label.
  - `Settings.jsx:729-738` `role="switch"` without `aria-label`/`aria-labelledby`.
  - Validation (Register `:26-27`, ChangePassword `:577-580`, Leaderboard `:82`) is reported only via toast (`ToastContext.jsx:74` is polite `role="status"`). No `aria-invalid`/`aria-describedby`; Onboarding and Settings range errors are red text not linked to the input.
- Recommendation: add `id`/`htmlFor` (or wrap the input in its label); `aria-label` on the switch; put inline error text next to fields with `aria-describedby` + `aria-invalid`, and keep toasts as secondary.

### CP-14 Tab bars and disclosure toggles lack ARIA semantics
- Severity: Low · Category: Accessibility · Confidence: LIKELY · Effort: S
- Evidence: Dashboard tabs `:825-845`, Progress tabs `:389-405`, Leaderboard period `:141-157`, Settings sidebar and mobile tabs `:1051-1081`: plain buttons, no `role="tablist"`/`tab`/`aria-selected`, active state shown only by style. Disclosures with no `aria-expanded`: Landing FAQ `:433-441`, Dashboard "Want more" `:940-949`, tip of the day `:1159-1168`. (Progress `:714` and Settings `:1514` do set it.)
- Recommendation: `aria-selected` / `aria-pressed` on the active tab button (or full tab pattern); `aria-expanded` + `aria-controls` on toggles.

### CP-15 Settings re-seeds the whole plan form on ANY user update, discarding unsaved edits
- Severity: Low · Category: UX / State · Confidence: LIKELY · Effort: S
- Evidence: `Settings.jsx:819-837` `useEffect(() => { if (user) { setDailyPages(...); setOffDays(...); ... } }, [user]);`. Same-tab actions that call `updateUser` without saving the plan: `togglePause` `:906`, `saveCycleStart` `:920`, `clearCycleStart` `:934`, `CommunityCard.persist` `:659`.
- Impact: change the daily goal (save bar appears), then flip "Pause new memorization" in Advanced, and the unsaved daily-goal edit silently reverts.
- Recommendation: re-seed only when the relevant fields change or when not dirty; or derive "saved" values and keep the draft separate.

### CP-16 Whole-set replace saves overwrite concurrent changes (two tabs or devices)
- Severity: Low · Category: Data integrity (last write wins) · Confidence: LIKELY · Effort: M
- Evidence: `Progress.jsx:260` `await progressAPI.updateMemorized({ memorizedPages: Array.from(draft) });` with draft snapshotted at `:232`; `Settings.jsx:247` same.
- Impact: Progress page open in edit mode on a laptop while the user marks a new page memorized on a phone; saving the laptop draft removes the phone's page.
- Recommendation: send a diff (`add: [...]`, `remove: [...]`) instead of the full set, or include a version or `updatedAt` precondition.

### CP-17 Leaderboard pre-fills the PUBLIC display name with the user's real account name
- Severity: Low · Category: Privacy · Confidence: LIKELY · Effort: S
- Evidence: `Leaderboard.jsx:60` `const [name, setName] = useState(user?.displayName || user?.name || '');` versus `server/models/User.js:105-106` "displayName is the ONLY identity shown publicly on the leaderboard, never the email or real name."
- Impact: a one-click "Join" publishes the user's real full name, contradicting the stated privacy design.
- Recommendation: start empty (or suggest a pseudonym) and explain that the name is public.

### CP-18 Landing footer: Privacy Policy, Terms and Contact are dead links
- Severity: Medium · Category: Launch readiness / Compliance · Confidence: CONFIRMED (static) · Effort: S (code) + content
- Evidence: `Landing.jsx:458-461` `<a href="#" ...>{t('landing.footer.privacy')}</a>` (same for terms and contact).
- Impact: the app collects email, password, behavioural data and sends chat content to a third-party LLM (Groq). A public launch without a privacy policy is a legal and app-store blocker, and dead links look unfinished.
- Recommendation: add /privacy and /terms routes (static, i18n), link Contact to /about#contact or a mailto, and disclose the Groq chat processing.

### CP-19 No per-route document titles
- Severity: Low · Category: SEO / Accessibility (WCAG 2.4.2) · Confidence: CONFIRMED (grep: only `index.html:7` and `TimerContext.jsx:16-20` touch the title) · Effort: S
- Impact: every route, including the public /library and /about, has the same title. Screen-reader users get no page-change announcement, and tabs and history are indistinguishable.
- Recommendation: a tiny `usePageTitle(t('...'))` hook per page, composed with the timer prefix.

### CP-20 `safeReturnTo` can output a protocol-relative path (defence-in-depth)
- Severity: Low · Category: Security (open redirect) · Confidence: CONFIRMED (executed `safeReturnTo` in Node) / not exploitable today · Effort: S
- Evidence: `utils/returnTo.js:10-15` checks the raw string for a leading `//`, then returns the NORMALISED `url.pathname + url.search + url.hash`. Measured outputs:
  - `"/.//evil.com"` → `"//evil.com"`
  - `"/a/..//evil.com"` → `"//evil.com"`
  - `"/%2e//evil.com"` → `"//evil.com"`
  - Correctly rejected (null): `//evil.com`, `/\evil.com`, `/\t/evil.com`, `javascript:...`, `https://...`. `/%2F%2Fevil.com` stays a same-origin path.
- Sinks: `Login.jsx:32` `navigate(afterLogin)` and `App.jsx:70` `<Navigate to={safeReturnTo(...)}>`. react-router 7.13.0 `resolvePath` collapses repeated slashes (`chunk-JZWAC4HX.mjs:825` `toPathname = toPathname.replace(/\/\/+/g, "/")`), so navigation lands on same-origin `/evil.com`. Without that, BrowserHistory `push` would fall back to `window.location.assign(url)` when `pushState` throws on a cross-origin URL (`:285-291`), which is a real open redirect.
- Impact: none today. It becomes an open redirect if the router is changed or downgraded, or if anyone feeds the helper's output to `window.location`, `<a href>` or a server redirect.
- Recommendation: after normalising, `if (url.pathname.startsWith('//')) return null;` (or collapse slashes); add unit tests for the payloads above.

### CP-21 Both locale files are bundled eagerly into the entry chunk
- Severity: Low · Category: Performance · Confidence: CONFIRMED (measured on `client/dist` built 2026-10-21; may not be exactly HEAD) · Effort: M
- Evidence: `i18n.js:4-5` `import en from './locales/en.json'; import ar from './locales/ar.json';`, 59.7 KB + 79.0 KB raw (18.4 + 21.0 KB gzip). Entry chunk `index-CAOUGUlA.js` = 498,631 B raw / 160,503 B gzip.
- Impact: every visitor downloads the language they are not using; it adds to time-to-interactive on slow mobile (NFR-01).
- Recommendation: `i18next-resources-to-backend` with dynamic `import(\`./locales/${lng}.json\`)`, or split per namespace (dashboard, settings, library).

### CP-22 Progress route chunk is 381 KB / 112 KB gzip, mostly for one line chart
- Severity: Info · Category: Performance · Confidence: CONFIRMED (measured, `Progress-Cis2AlO3.js`) · Effort: M
- Evidence: `Progress.jsx:11` recharts `LineChart`. The route is already lazy (`App.jsx:22`), so the landing and dashboard cost is unaffected.
- Recommendation: optional. A ~60-line inline SVG sparkline would cut ~100 KB gzip from the route, or lazy-load the chart card below the fold.

### CP-23 Logout clears only the token; reading history stays on shared devices; no cross-tab logout
- Severity: Low · Category: Privacy / Session · Confidence: LIKELY · Effort: S
- Evidence: `AuthContext.jsx:103-106` `localStorage.removeItem('token'); setUser(null);`. Remaining keys found by grep: `recentPages` (services/recentPages.js:20), `lastMushafPage` (Library.jsx:913), `timerState`/`timerSettings` (timerStore.js:16-17), `dailyVerse` cache, reciter recents, tour flags. Account deletion (`Settings.jsx:1024-1026`) uses the same `logout()`. No `storage` event listener, so another open tab stays "signed in" until a request fails (and `api.js:30-33` will not redirect there because no token is sent).
- Recommendation: on logout and delete, clear user-scoped keys (keep theme and lang); listen for `storage` events on `token` to log out other tabs.

### CP-24 i18n: English-only pluralisation, concatenated strings, inconsistent Arabic locale tags
- Severity: Low · Category: i18n · Confidence: LIKELY (calendar point SUSPECTED) · Effort: S-M
- Evidence:
  - Plurals: `Dashboard.jsx:715` `t(streak === 1 ? 'dashboard.streakDay' : 'dashboard.streakDays')`; `Onboarding.jsx:62-75` and `Progress.jsx:26-33` `formatEstimate` pick singular/plural by `=== 1`; `Onboarding.jsx:876` `dailyPages !== 1 ? 'pagesPerDay' : 'pagePerDay'`. Arabic needs zero/one/two/few/many/other (i18next `count` handles this).
  - Concatenation: `Progress.jsx:651-652` `` `${t('progress.juz')} ${juz} — ...` ``; `Settings.jsx:1202` `{t('progress.juz')} {j.juzNumber}`; `Dashboard.jsx:93` `{t('dashboard.page')} {page.pageNumber}`; `Onboarding.jsx:875` `` `${approxJuz} ${t('progress.juz')}` ``.
  - `Dashboard.jsx:696` `toLocaleDateString()` uses the browser locale, not the app language.
  - Mixed locale tags: `Dashboard.jsx:47` and `Progress.jsx:323`, `:447` use `'ar-SA'`; `Progress.jsx:291` uses `'ar-u-ca-gregory-nu-arab'`. Node ICU 78 resolves ar-SA to the Gregorian calendar; some engines and versions have defaulted ar-SA to islamic-umalqura, which would render Hijri dates in the week plan. SUSPECTED, not reproduced in a browser.
  - `Onboarding.jsx:844` joins Arabic day names with `', '` (Dashboard uses `'، '`).
- Recommendation: one `formatDate(lang, opts)` helper with an explicit `-u-ca-gregory`; i18next count plurals; interpolate numbers inside translation strings.

### CP-25 Onboarding adds an artificial 2.5 s "building your plan" wait
- Severity: Low · Category: Performance / UX · Confidence: CONFIRMED (static) · Effort: S
- Evidence: `Onboarding.jsx:829-832` `setGeneratingPlan(true); setTimeout(() => { setGeneratingPlan(false); setStep(4); }, 2500);`. No request happens; the timer is not cleared on unmount.
- Recommendation: drop the delay or cut it to under 600 ms; clear the timeout in cleanup.

### CP-26 Dashboard smaller correctness issues
- Severity: Low · Category: Reliability / UX · Confidence: LIKELY · Effort: S
- Evidence:
  - `Dashboard.jsx:601-602` first-cycle resume failure shows `t('dashboard.failedMark')` ("failed to mark page"). Also, if `updateProfile` succeeded and the refetch failed, the user is told it failed.
  - `Dashboard.jsx:505-511` alreadyKnow: if `markComplete` succeeds but the refetch fails, the toast says "failed to mark" although it was saved.
  - `Dashboard.jsx:484-499` undo has no in-flight guard, so a double tap sends two `uncomplete` calls.
  - `Dashboard.jsx:533-540` missed-day banner and `Progress.jsx:355` streak achievements read `user.lastActiveDate`/`currentStreak` from auth context, which is never updated after `markComplete`. The banner stays and achievements lag until reload.
- Recommendation: specific messages; a guard on undo; `updateUser({ currentStreak: res.data.data.newStreak, lastActiveDate: new Date() })` after a completion.

### CP-27 Complexity and duplication hotspots (Settings 1887 lines, Onboarding and Settings editors duplicated)
- Severity: Medium · Category: Maintainability · Confidence: CONFIRMED (static) · Effort: L
- Evidence:
  - `JUZ_RANGES` is hard-coded in `Onboarding.jsx:36-47` and `Settings.jsx:42-53` although `data/juzRanges.js` exports the same table (used by `Progress.jsx:14`).
  - `toPageRanges`, `rangesToPages`, `validateRanges` are copied verbatim (`Onboarding.jsx:20-112` vs `Settings.jsx:55-100`); `INTENSITY_OPTIONS` + `estimateReviewPages` exist in both; `formatEstimate` is in `Onboarding.jsx:62` and `Progress.jsx:26`.
  - The five-tab unit selector (Juz/Hizb/Rub/Surah/Range) is implemented twice (`Onboarding.jsx:339-544`, `Settings.jsx:276-547`) and has already drifted (Settings has "removed" red state, delete-confirm and restore; Onboarding does not).
  - `Settings.jsx:40` `autoRecentPages` mirrors a server formula by hand.
  - `Settings.jsx:945-949` is a second language switch that bypasses `LanguageToggle` (whose header says it is "The app's single language-switching code path") and does not set `langExplicit`.
  - `Settings()` holds ~40 `useState` hooks with hand-maintained dirty and discard logic (`:866-879`, `:994-1010`) that must list every field three times.
  - Every CP-02/03/04/15 bug lives in this tangle.
- Recommendation: extract a `<MemorizedUnitPicker coverage onChange>` used by both; move constants and helpers to `data/` and `utils/`; split Settings into section components with one `usePlanDraft(user)` reducer; reuse LanguageToggle's handler.

### CP-28 "Mark all" sends N parallel requests against a shared per-IP limit
- Severity: Low · Category: Performance / Reliability · Confidence: LIKELY · Effort: M
- Evidence: `Dashboard.jsx:587-588` `revPending.forEach(p => markComplete(p.pageNumber, 'review'))` (fixed review allows up to 40, `Settings.jsx:1483`). Server general limiter `server/middleware/rateLimiters.js:34-35` `windowMs: 15*60*1000, limit: 300` per IP.
- Impact: a class or mosque sharing one NAT IP (a core use case) can exhaust 300 requests in 15 minutes; failures show up as per-card error toasts. (Streak concurrency was checked: the server computes an absolute value, so parallel calls do not double-increment. Not a bug.)
- Recommendation: `POST /progress/complete-batch`; key the limiter on user id for authenticated routes.

### CP-29 Route-guard and returnTo gaps
- Severity: Low · Category: UX / Routing · Confidence: LIKELY · Effort: S
- Evidence:
  - Onboarding gate only on `/dashboard` (`App.jsx:36-40`), so a not-yet-onboarded user reaching `/settings`, `/progress` or `/leaderboard` (for example via `/login?returnTo=/progress`) skips onboarding.
  - `ProtectedRoute.jsx:23` `<Navigate to="/login" replace />` drops the requested path; deep links to /progress land on /dashboard after login.
  - `Login.jsx:104` "Sign up" link drops `returnTo`; Register ignores it (`Register.jsx:31`).
- Recommendation: move the onboarding check into ProtectedRoute; use `loginPathFor(location)` there; carry `returnTo` across the login and register links.

### CP-30 Range editor edge cases and number inputs that cannot be cleared
- Severity: Low · Category: UX / Validation · Confidence: LIKELY · Effort: S
- Evidence:
  - Overlap check `r.start < other.end && r.end > other.start` (`Onboarding.jsx:106-108`, `Settings.jsx:94-96`) misses ranges sharing an endpoint ([1,5],[5,10]). Harmless because the result is a set union.
  - Invalid or half-filled rows are silently ignored by `rangesToPages`.
  - Controlled number inputs reject the empty intermediate value, so the user cannot clear "5" to type "12" (they must select all first): `Onboarding.jsx:797`, `Settings.jsx:1484`, `:1577`.
- Recommendation: keep the raw text in state and validate on blur or save (as the custom-daily input `Settings.jsx:1269-1278` already does).

### CP-31 Leaderboard period switch race
- Severity: Low · Category: Reliability · Confidence: SUSPECTED · Effort: S
- Evidence: `Leaderboard.jsx:65-78` `load` has no abort or alive guard; a fast week→all→week switch can render the response of the earlier request last.
- Recommendation: AbortController or a request id check.

### CP-32 Heatmap, read-only page map and Juz map expose data only via `title` and color
- Severity: Low · Category: Accessibility · Confidence: LIKELY · Effort: S-M
- Evidence: `Progress.jsx:122-127` heatmap cells `<div title=... className={HEAT_COLORS[...]}>`; `:623-626` and `:673-676` read-only tiles are `<div title=...>`. They are not focusable, have no text alternative, and the levels are color-only. In edit mode the detailed map renders up to 604 tab stops (`:611-620`) with no roving tabindex or grid navigation.
- Recommendation: an `sr-only` table or summary per Juz; `role="img"` + `aria-label` on the heatmap with totals; roving tabindex (arrow keys) for the 604-tile editor.

### CP-33 About page publishes the developer's personal email
- Severity: Info · Category: Privacy / Launch hygiene · Confidence: CONFIRMED · Effort: S
- Evidence: `About.jsx:88-89` a `mailto:` link to the developer's personal address.
- Recommendation: use a project alias or contact form before a public launch (spam and harvesting).

### False-positive pass (checked and dismissed)
- XSS via Leaderboard display names: `Leaderboard.jsx:31` renders `{entry.displayName}` as a React text node; there is no `dangerouslySetInnerHTML` in scoped pages. Server also bounds it to 3-30 chars (`authController.js:303-313`). Not an issue.
- Double-submit on task buttons: the per-key `markingKeys` guard plus `disabled={marking}` and React's synchronous flushing for discrete click events make a duplicate request unlikely. Server-side, repeat completion is idempotent apart from `reviewCount` `$inc`. Not reported beyond the undo note.
- Parallel "Mark all" streak double-increment: the server sets an absolute `currentStreak` computed from the pre-read value (`progressController.js:740-756`). No double increment.
- Route-level code splitting: present and correct (`App.jsx:16-25`). driver.js lives only in Dashboard and Library chunks (grep count 0 in the entry chunk). react-icons are per-family named imports (tree-shaken).
- Client-only validation: password length 6 (Register, ChangePassword), daily goal 0.5-10, display name 3-30 and page 1-604 are all enforced server-side too (`authController.js:412-416`, `progressController.js:413`, `:676`).
- Raw `localStorage.getItem` without try/catch in Dashboard (`:408`, `:435`): modern browsers do not throw on reads in private mode. Not reported.

## 3. Catch-block classification (all catches in scoped files; AuthContext added for context)

| Location | What fails | Handling | Class |
|---|---|---|---|
| Dashboard.jsx:355 | daily verse API | falls back to curated quote | INTENTIONAL |
| Dashboard.jsx:376 | today's tasks + juz | toast only; UI falls to "no new pages today" (CP-09) | HANDLED-POORLY |
| Dashboard.jsx:392 | hard-annotations summary | `.catch(() => {})`; chip just hidden | INTENTIONAL (non-critical) |
| Dashboard.jsx:460 | week plan | toast + inline `weekPlanError` text | HANDLED |
| Dashboard.jsx:477 | markComplete | toast; state not changed | HANDLED |
| Dashboard.jsx:496 | undo | toast | HANDLED |
| Dashboard.jsx:510 | alreadyKnow + refetch | toast; misleading if only refetch failed (CP-26) | HANDLED-POORLY |
| Dashboard.jsx:601 | first-cycle resume | wrong message key (CP-26) | HANDLED-POORLY |
| Dashboard.jsx:918 | "memorize anyway" refetch | toast; `isOverrideDay` stays true over stale data | HANDLED |
| Leaderboard.jsx:71 | board load | error state + Retry | HANDLED |
| Leaderboard.jsx:89 | join | server message toast | HANDLED |
| Onboarding.jsx:281 | 3-phase submit | generic toast; partial server state kept (CP-05) | HANDLED-POORLY |
| Progress.jsx:200 | 3 loads | error banner + Retry | HANDLED |
| Progress.jsx:264 | save edits | toast; stays in edit mode | HANDLED |
| Settings.jsx:254 | editor save (multi-request) | toast; partial state (CP-05) | HANDLED-POORLY |
| Settings.jsx:587 | change password | server message toast | HANDLED |
| Settings.jsx:661 | community persist | toast + rollback | HANDLED |
| Settings.jsx:847 | progress + juz load | `.catch(() => {})`, empty state feeds destructive editor (CP-02) | SWALLOWED |
| Settings.jsx:848 | today stats | `.catch(() => {})`; intensity estimates and fixed default missing | SWALLOWED (minor) |
| Settings.jsx:908 | pause toggle | toast + rollback | HANDLED |
| Settings.jsx:923 | cycle start save | toast | HANDLED |
| Settings.jsx:938 | cycle start clear | toast | HANDLED |
| Settings.jsx:948 | language to profile | `.catch(() => {})`, preference silently not synced | INTENTIONAL (best-effort), but no langExplicit fallback |
| Settings.jsx:958 | profile save | toast | HANDLED |
| Settings.jsx:982 | plan save | toast | HANDLED |
| Settings.jsx:1017 | reset progress | toast | HANDLED |
| Settings.jsx:1027 | delete account | toast | HANDLED |
| Settings.jsx:1860 | refetch after editor save | `.catch(() => {})`, stale view (CP-03) | SWALLOWED |
| utils/returnTo.js:12 | URL parse | return null | INTENTIONAL |
| AuthContext.jsx:26 | language push | `.catch(() => {})` | INTENTIONAL (best-effort) |
| AuthContext.jsx:48 | session check | logs out on ANY error (CP-09) | HANDLED-POORLY |
| AuthContext.jsx:121 | refreshUser | `console.log` only; callers (Onboarding, Settings) proceed as if refreshed | SWALLOWED (minor) |

## 4. Strengths
- Every route is `lazy()` with a shared Suspense fallback (`App.jsx:16-33`); recharts and driver.js stay out of the entry chunk (verified by grep on the built entry chunk).
- `safeReturnTo` is a deliberate allow-list design (string guards, origin check, auth-page loop guard). Only the post-normalisation gap remains (CP-20).
- The 401 interceptor is careful: visitors without a token on public pages are not bounced, and the startup session check is exempt (`api.js:17-40`).
- `ConfirmModal.jsx` is an exemplary accessible dialog (alertdialog, labelled, focus on safe choice, Tab trap, Escape, focus return, key isolation).
- Progress page has proper loading skeletons, an error banner with Retry, empty states, `aria-pressed` on editable tiles, and `aria-expanded` on the Surah disclosure.
- Verse-exact coverage model for Hizb and quarter-Hizb selection (`utils/unitRanges.js`) is a thoughtful fix for mid-page unit boundaries, with clear comments explaining why.
- Dashboard layout-shift care: skeletons match final shapes and min-heights (`Dashboard.jsx:735-736`, `:857-866`), with an `alive` guard against setState after unmount (`:365-383`).
- RTL handled with logical properties (`ps-`/`pe-`/`start-`/`end-`, `rtl:rotate-180`) throughout; `dir` and `lang` set on `<html>` (`App.jsx:77-80`); toast region is a polite live region.
- No `dangerouslySetInnerHTML` in any scoped page; user-supplied names are rendered as text.
- Server mirrors the client-side validations (password length, goal bounds, display name, page range). The password-change token revocation is the right security instinct (CP-06 is only about the UX of it).
