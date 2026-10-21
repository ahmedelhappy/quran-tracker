> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Audit notes: client components / context / hooks

Auditor scope: `client/src/components/*` (26 files), `client/src/context/*` (4), `client/src/hooks/*` (11), plus `utils/chatLinks.js` and `utils/returnTo.js`. Read-only. For context I also opened `App.jsx`, `main.jsx`, `services/api.js`, `services/recentPages.js`, part of `services/todoStore.js`, `i18n.js`, the Library keydown handler (`pages/Library.jsx:2137-2241`), and the react-router 7.13.0 history/resolvePath source in node_modules.

Reproduction: the only thing I ran was a Node script in the scratchpad (`rt.mjs`) that imports the real `safeReturnTo` / `safeAppPath` / `splitChatLinks` modules and feeds them bypass inputs. No repo file was changed.

## 1. Coverage manifest

| Path | Lines | Read in full | Note |
|---|---|---|---|
| components/BasmalaGlyph.jsx | 18 | YES (structure; path data not analysed) | Inline SVG, role=img, Arabic aria-label without `lang` |
| components/Chatbot.jsx | 221 | YES | Model output goes through whitelisted link and bold splitters, so no HTML sink. Accessibility gaps |
| components/ConfirmModal.jsx | 102 | YES | Good: alertdialog, focus trap, Escape, focus return, stopPropagation |
| components/ErrorBoundary.jsx | 56 | YES | Shows no error details. One top-level boundary only |
| components/Footer.jsx | 29 | YES | Personal mailto hard-coded |
| components/HowToMemorizeModal.jsx | 87 | YES | No focus trap, initial focus or return. Keys leak to the Library shortcuts |
| components/InfoHint.jsx | 89 | YES | Full-screen click catcher swallows the next click |
| components/LanguageToggle.jsx | 57 | YES | Unguarded localStorage writes. Swallowed profile save heals itself |
| components/Logo.jsx | 28 | YES | Fine |
| components/MushafDrawLayer.jsx | 369 | YES | aria-hidden on focusable note buttons, English labels, drag listener leak |
| components/MushafMarks.jsx | 142 | YES | Fine. Arabic labels intentional |
| components/MushafPage.jsx | 352 | YES | Solid a11y design (one button per verse plus SR text). Small issues |
| components/MushafZoomControl.jsx | 106 | YES | Good. Escape is captured |
| components/Navbar.jsx | 265 | YES | Menus lack aria-expanded and Escape. Duplicate links |
| components/PageScrubber.jsx | 94 | YES | Commit relies on pointerup landing on the input |
| components/ProtectedRoute.jsx | 29 | YES | Redirect drops returnTo |
| components/ReaderTools.jsx | 73 | YES | Tab pattern incomplete |
| components/RecentPagesRow.jsx | 48 | YES | Fine |
| components/ReciterPicker.jsx | 317 | YES | Very good combobox. Fold regex codepoints checked: U+0300-036F, U+064B-065F, U+0670, U+0640, all correct |
| components/SearchFindBar.jsx | 102 | YES | Fine |
| components/TimeTool.jsx | 523 | YES | Logic is sound. Renders are kept down by useSyncExternalStore primitives |
| components/TodoList.jsx | 400 | YES | Good: keyboard reorder, undo, the finished-ref guard on edit |
| components/Tooltip.jsx | 96 | YES | Can't be dismissed with Escape (WCAG 1.4.13) |
| components/VerseSearch.jsx | 464 | YES (2 chunks) | Dialog has no focus trap |
| components/dashboardTour.js | 111 | YES | driver.js uses innerHTML (static i18n strings). Helpers duplicated |
| components/libraryTour.js | 125 | YES | Same as above |
| context/AuthContext.jsx | 147 | YES | Logs the user out on any /me failure. No cross-tab sync |
| context/ThemeContext.jsx | 42 | YES | Unguarded localStorage read in the root provider. Theme applied after paint |
| context/TimerContext.jsx | 94 | YES | Good. Title-prefix handling is correct |
| context/ToastContext.jsx | 83 | YES | Context value not memoised. Toast pauses on hover and focus (good) |
| hooks/useAuth.js | 16 | YES | Fine |
| hooks/useDragSelect.js | 61 | YES | Fine. Listeners removed on up and cancel |
| hooks/useDraggable.js | 98 | YES | Offset not re-clamped on load. Storage write on every move, unguarded |
| hooks/useIdleHide.js | 150 | YES | Well reasoned. Ctrl+wheel left alone. Cleanup complete |
| hooks/useMushafZoom.js | 382 | YES | Careful. All listeners and rAFs cleaned up. Storage guarded |
| hooks/useRecentPageTracker.js | 112 | YES | Fine |
| hooks/useRecentPages.js | 49 | YES | Shared clock starts and stops with subscribers (good) |
| hooks/useTheme.js | 8 | YES | Fine |
| hooks/useTimer.js | 44 | YES | Fine |
| hooks/useToast.js | 10 | YES | Fine |
| hooks/useTodos.js | 25 | YES | Fine. No request before auth resolves |
| utils/chatLinks.js | 76 | YES | Safe whitelist (tested). A stray ")" can show in rare text (cosmetic) |
| utils/returnTo.js | 20 | YES | Can return "//host" (CONFIRMED). Not exploitable with RR 7.13 |

Count: 26 component files (the brief said 27, but the directory has 26: 24 .jsx + 2 tour .js), 4 context files, 11 hooks, 2 utils. All were read in full.

## 2. Findings

Summary by severity: Critical 0 · High 0 · Medium 5 · Low 17 · Info 6. Total 28.

### M1. Any failure of the start-up session check deletes the token and signs the user out
- **Severity:** Medium · **Category:** Reliability / UX · **Confidence:** LIKELY
- **Evidence:** `context/AuthContext.jsx:43-51`
  ```js
  try {
    const response = await authAPI.getMe();
    ...
  } catch (err) {
    console.log(err);
    localStorage.removeItem('token');
    setUser(null);
  }
  ```
  This catch does not look at `err.response?.status`, so it treats a network error, a timeout, a 5xx or a 502/503 from the host proxy (cold start or a deploy) exactly like a 401. Note that `services/api.js:29-32` already removes the token on a real 401.
- **Impact:** Opening the app while offline, during a backend redeploy, or on a free-tier cold start that returns 5xx permanently signs the user out. They lose the session and have to log in again. This is especially visible after a public launch.
- **Recommendation:** Remove the token only when `err.response?.status === 401`. For other errors, keep the token and either retry with backoff or show a "can't reach server, retry" state. Replace `console.log` with a proper error path.
- **Effort:** S

### M2. Tabs never learn that the session changed, so writes can land on a different account
- **Severity:** Medium · **Category:** Security (integrity) / Correctness · **Confidence:** LIKELY
- **Evidence:**
  - `context/AuthContext.jsx` has no `storage` listener. It reads the token once, at `:36`.
  - `logout` at `:103-106` only does `localStorage.removeItem('token'); setUser(null);`.
  - `services/api.js:10` reads the token fresh on every request: `const token = localStorage.getItem('token');`.
- **Impact:** Two scenarios:
  - **Account switch.** Tab A logs out and logs in as user B. Tab B still shows user A's dashboard and state, but every request now carries B's token. Ticking a page, editing settings or using the to-do list in tab B silently writes to account B.
  - **Logout in another tab.** Tab B keeps showing the protected UI. Its requests go out with no token and get 401s. Because there was no Authorization header, `api.js:33` (`hadToken`) does not redirect, so the tab just shows errors.
- **Recommendation:**
  - Listen for `storage` events on key `token` (or use a BroadcastChannel).
  - When the token changes or is removed, re-run `checkAuth()`, or force a reload or a redirect to /login.
  - Optionally stamp the userId on the request and reject a mismatch on the server.
- **Effort:** S

### M3. HowToMemorizeModal: no focus management, and keys reach the Library shortcuts behind it
- **Severity:** Medium · **Category:** Accessibility (WCAG 2.4.3, 2.1.2) / Correctness · **Confidence:** LIKELY
- **Evidence:**
  - `components/HowToMemorizeModal.jsx:20-25`: a window-level Escape listener with no `stopPropagation`, no initial focus, no focus trap and no focus return. `:33` declares `role="dialog" aria-modal="true"`.
  - The modal is mounted in Library (`pages/Library.jsx:6219`).
  - Library's window keydown handler (`Library.jsx:2144-2149`) returns early only for `tourActiveRef` and text fields: `if (tourActiveRef.current) return; ... if (tag === 'INPUT' || ...) return;`. There is no check for an open modal.
- **Impact:**
  - Keyboard and screen-reader users open the modal but focus stays on the trigger behind it, and Tab walks the page underneath.
  - In the Library, ArrowLeft and ArrowRight turn pages behind the modal, Ctrl+Z undoes annotations, and Escape both closes the modal and runs the reader's Escape peel-back.
- **Recommendation:** Reuse ConfirmModal's pattern:
  - focus the close button on open
  - trap Tab
  - handle Escape on the container with `stopPropagation`
  - restore focus on close

  Or extract one shared `<Dialog>` primitive and use it for ConfirmModal, HowToMemorize and VerseSearch.
- **Effort:** S

### M4. Chatbot is hard to use with a screen reader or keyboard
- **Severity:** Medium · **Category:** Accessibility (WCAG 4.1.3, 2.4.3) · **Confidence:** LIKELY
- **Evidence:**
  - `components/Chatbot.jsx:143`: the message list `<div className="flex-1 overflow-y-auto p-3 space-y-3">` has no `aria-live` or `role="log"`, so replies are never announced.
  - `:204`: `disabled={loading}` on the focused input. Disabling a focused element drops focus to `<body>`, so after every send keyboard users have to find the input again.
  - `:120-123`: the panel has no `role="dialog"` or label, focus does not move into it on open, and there is no Escape to close.
  - `:44`: `scrollIntoView({ behavior: 'smooth' })` ignores `prefers-reduced-motion`.
- **Impact:** Screen-reader users get no feedback that the assistant answered. Keyboard users lose their place after every message.
- **Recommendation:**
  - Add `role="log" aria-live="polite"` on the messages container.
  - Use `readOnly`/`aria-disabled` or keep the input enabled and just block `send()`.
  - Move focus to the input on open and return it to the launcher on close. Handle Escape.
  - Choose the scroll behaviour based on the reduced-motion media query.
- **Effort:** S

### M5. PageScrubber may get stuck in "scrubbing" when the pointer is released off the slim input
- **Severity:** Medium · **Category:** Correctness · **Confidence:** SUSPECTED (not reproduced in a browser)
- **Evidence:** `components/PageScrubber.jsx:85-87`
  ```jsx
  onPointerDown={startScrub}
  onPointerUp={commitScrub}
  onPointerCancel={commitScrub}
  ```
  There is no `setPointerCapture`, no `onLostPointerCapture`, and no window-level pointerup. While `dragPage !== null`, `handleChange` (`:45`) only updates the preview.
- **Impact:** A mouse drag released above or below the thin track would deliver pointerup to another element. The bubble would stay up, the page would not navigate, and `onScrubbingChange(true)` would keep the Library's neighbour prefetch on hold until the next press on the scrubber. Touch is likely fine because touch has implicit capture.
- **Recommendation:** In `startScrub`, call `e.currentTarget.setPointerCapture(e.pointerId)`, or add a one-shot `window` pointerup listener. Handle `onLostPointerCapture`. Verify in Chrome, Firefox and Safari.
- **Effort:** S

### L1. `safeReturnTo` can return a protocol-relative path ("//evil.com")
- **Severity:** Low (defence in depth; not exploitable today) · **Category:** Security · **Confidence:** CONFIRMED
- **Evidence:** `utils/returnTo.js:10-15`. The raw-input checks (`startsWith('//')`, `\\`) run before normalisation, but the function returns the normalised `url.pathname`.

  Reproduced with the real module:

  | Input | Returns |
  |---|---|
  | `"/.//evil.com"` | `"//evil.com"` |
  | `"/%2e//evil.com"` | `"//evil.com"` |
  | `"/a/..//evil.com"` | `"//evil.com"` |
  | `"/.//evil.com/path?x=1"` | `"//evil.com/path?x=1"` |

  Blocked as intended: `"//x"`, `"/\\x"`, `"/\t/x"`, `https:`, `javascript:` all return null.
- **Impact:**
  - **Today, harmless.** The consumers (`App.jsx:70` `<Navigate>` and `Login.jsx:32` `navigate()`) go through react-router 7.13's `resolvePath`, which collapses `//+` to `/` (node_modules/react-router/dist/development/chunk-JZWAC4HX.mjs:824). So the navigation becomes `/evil.com` and then hits the catch-all.
  - **Latent risk.** A future consumer that uses `window.location.href = safeReturnTo(...)` or `<a href>` would become an open redirect.
  - **Misleading comment.** The header comment ("no protocol-relative //host") overstates the guarantee.
- **Recommendation:** Validate the output, not just the input. For example `const out = url.pathname + url.search + url.hash; return out.startsWith('//') ? null : out;`. Add unit cases for `/.//`, `/%2e//`, `/..//`. Apply the same output check in `safeAppPath` (that one is already safe because of the exact pathname whitelist).
- **Effort:** S

### L2. ProtectedRoute redirects to /login without returnTo
- **Severity:** Low · **Category:** UX · **Confidence:** LIKELY
- **Evidence:** `components/ProtectedRoute.jsx:23`: `return <Navigate to="/login" replace />;`. By contrast, `utils/returnTo.js:19` `loginPathFor` and `services/api.js:35` do keep the destination.
- **Impact:** A signed-out visitor following a deep link (for example `/settings?tab=memorization` from a bookmark or email) lands on the dashboard after login, not on the page they asked for.
- **Recommendation:** `const location = useLocation(); return <Navigate to={loginPathFor(location)} replace />;`
- **Effort:** S

### L3. Unguarded localStorage in root providers can crash the whole app
- **Severity:** Low · **Category:** Reliability · **Confidence:** LIKELY
- **Evidence:**
  - `context/ThemeContext.jsx:5`: `useState(() => localStorage.getItem('theme') || 'light')`, which runs at the root.
  - `:34` setItem.
  - `context/AuthContext.jsx:23,30,36,70,90`.
  - `components/LanguageToggle.jsx:25-26`.
  - `hooks/useDraggable.js:88`: `if (storageKey) localStorage.setItem(...)` inside an effect. Here the getItem at `:33` is guarded but the setItem is not.

  Other modules (`useMushafZoom.js:65-73`, `ReciterPicker.jsx:35-40,180`, `recentPages.js:54-68`) do guard their storage calls, so the handling is inconsistent.
- **Impact:** When site data is blocked, `window.localStorage` access throws SecurityError. ThemeProvider then throws during render and the top-level ErrorBoundary replaces the entire app. A QuotaExceeded error in useDraggable's effect does the same.
- **Recommendation:** Add one tiny `safeStorage` helper (get/set/remove with try/catch) and use it everywhere.
- **Effort:** S

### L4. Context values are rebuilt on every render
- **Severity:** Low · **Category:** Performance · **Confidence:** LIKELY (not profiled)
- **Evidence:**
  - `context/ToastContext.jsx:72`: `value={{ showToast }}`. It changes on every add and dismiss, so every `useToast()` consumer re-renders twice per toast. Consumers include `pages/Library.jsx`, a component of more than 6,000 lines.
  - `context/AuthContext.jsx:130-141`: the value object and its functions are not memoised.
  - `context/ThemeContext.jsx:38`: `value={{ theme, setTheme }}`.
- **Impact:** Unnecessary full re-renders of the reader on every toast, including the undo toasts in TodoList and other code paths.
- **Recommendation:**
  - ToastContext: `useMemo(() => ({ showToast }), [showToast])`. Or split state and dispatch contexts.
  - AuthContext: `useCallback` the functions and `useMemo` the value.
  - ThemeContext: memoise the value.
- **Effort:** S

### L5. VerseSearch dialog has no focus trap
- **Severity:** Low · **Category:** Accessibility (2.4.3) · **Confidence:** LIKELY (focus trap) / SUSPECTED (focus return, which depends on Library)
- **Evidence:** `components/VerseSearch.jsx:243-250` declares `role="dialog" aria-modal="true"`. Its `onKeyDown` handles only Escape and the arrow keys. Tab from the "Esc" button or the example chips moves into the page behind the backdrop.
- **Impact:** Keyboard users can tab out of the dialog into hidden content.
- **Recommendation:** Trap Tab inside the dialog (shared Dialog primitive, see M3). Return focus to the opener on close.
- **Effort:** S

### L6. Navbar menus: missing ARIA state, no Escape, duplicate links
- **Severity:** Low · **Category:** Accessibility / UX · **Confidence:** LIKELY
- **Evidence:**
  - `components/Navbar.jsx:160-163`: the avatar button has no `aria-expanded` or `aria-haspopup`.
  - `:167-194`: the dropdown closes only by clicking the backdrop. There is no Escape and focus is not moved into it.
  - `:200-203`: the hamburger has no `aria-expanded` or `aria-controls`.
  - `:171-184`: "Profile" and "Settings" both go to `to="/settings"`, where the first presumably should be `?tab=profile`.
  - `:120-128`: the active link has no `aria-current="page"`.
- **Recommendation:** Add the ARIA state, Escape-to-close with focus return, `aria-current`, and fix the Profile link.
- **Effort:** S

### L7. Tooltip can't be dismissed without moving the pointer or focus (WCAG 1.4.13)
- **Severity:** Low · **Category:** Accessibility · **Confidence:** LIKELY
- **Evidence:** `components/Tooltip.jsx:64-72` shows on mouseenter or focus and hides on leave or blur only, with no Escape handler. `:79` is `pointer-events-none`, so the bubble itself can't be hovered.
- **Recommendation:** Add a document keydown Escape handler while open. Optionally keep it open while the pointer is over the bubble.
- **Effort:** S

### L8. MushafDrawLayer: focusable controls inside aria-hidden, and hard-coded English labels
- **Severity:** Low · **Category:** Accessibility / i18n · **Confidence:** LIKELY
- **Evidence:**
  - `components/MushafDrawLayer.jsx:307`: `<div className="mushaf-text-layer" aria-hidden={!active}>`. In read mode it still renders clickable, focusable note buttons (`:322-330`, `onClick={... onReadText?.(n)}`). This is the axe "aria-hidden-focus" violation, and screen-reader users can't find their text notes.
  - Hard-coded English: `:337` `aria-label="Delete note"`, `:361` `aria-label="Save note"`.
  - The editor `<input>` (`:350-360`) has only a placeholder, no aria-label.
- **Recommendation:** Drop the aria-hidden while note buttons are interactive, or make them `tabIndex={-1}` when hidden. Move the labels to `t()` and label the input.
- **Effort:** S

### L9. MushafDrawLayer: drag listeners leak on pointercancel, and the editor may commit twice
- **Severity:** Low · **Category:** Reliability · **Confidence:** LIKELY (leak) / SUSPECTED (double commit)
- **Evidence:**
  - `:266-274`: `onNoteDown` adds window `pointermove` and `pointerup` but no `pointercancel`. A cancelled touch drag leaves both listeners attached, and the next unrelated pointerup anywhere fires `onUpdateText` or `openEditor` for that note.
  - `:357-358`: `onKeyDown` Enter calls `commitEditor()` and `onBlur={commitEditor}` is also set. There is no "already finished" guard; compare `TodoList.jsx:359-364`, which has `finished` ref.
  - If the browser fires blur when the focused input is removed (Chrome has historically done this), `onCreateText` could run twice with the stale `editing` closure.
- **Recommendation:** Listen for `pointercancel` and clean up. Add a `committedRef` guard like TodoList's EditField.
- **Effort:** S

### L10. useDraggable: saved offset is not re-clamped, and storage is written on every move
- **Severity:** Low · **Category:** Correctness / Performance · **Confidence:** LIKELY
- **Evidence:**
  - `hooks/useDraggable.js:30-37`: the stored offset is restored without clamping. Clamping only happens during a drag (`:66-71`).
  - `:87-89`: localStorage is written in an effect on every `pos` change, which means on every pointermove.
- **Impact:** The chat launcher (`Chatbot.jsx:40`, key `chatbotPosY`) dragged up on a tall desktop window can restore off-screen on a shorter window or a rotated phone, leaving the chatbot unreachable. Repeated sync storage writes also happen during a drag.
- **Recommendation:** Re-clamp on mount and on `resize`. Persist only in `onUp`.
- **Effort:** S

### L11. Theme is applied after first paint (dark-mode flash)
- **Severity:** Low · **Category:** UX / Performance · **Confidence:** LIKELY
- **Evidence:** `context/ThemeContext.jsx:7-30` toggles `.dark` in `useEffect`. `client/index.html` has no inline pre-paint theme script (grep: only meta tags and the module script).
- **Recommendation:** Add a small inline script in index.html that reads `theme` (with try/catch) and sets `.dark` before React mounts.
- **Effort:** S

### L12. Chatbot: error text is sent to the model as history, and the welcome message keeps its first language
- **Severity:** Low · **Category:** Correctness / i18n · **Confidence:** LIKELY
- **Evidence:**
  - `components/Chatbot.jsx:80-83` appends `{ role: 'assistant', content: t(messageKey) }` for errors.
  - `:70` (`next.filter((m) => !m.isWelcome).slice(-6)`) then sends those error strings to the model as if the assistant had said them.
  - `:31-35` stores `t('chatbot.welcome')` in state once, so switching EN/AR leaves the welcome in the old language.
- **Recommendation:** Flag error messages (`isError: true`) and filter them out of history. Render the welcome with `t()` at render time instead of storing it.
- **Effort:** S

### L13. InfoHint's full-screen catcher swallows the next click
- **Severity:** Low · **Category:** UX · **Confidence:** LIKELY
- **Evidence:** `components/InfoHint.jsx:72`: `<div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />`. While a hint is open, the user's click on any other control only closes the hint.
- **Recommendation:** Use a capture-phase document `pointerdown` listener that does not block the click, as MushafZoomControl and ReciterPicker already do.
- **Effort:** S

### L14. Arabic accessible names lack `lang="ar"` (WCAG 3.1.2)
- **Severity:** Low · **Category:** Accessibility / i18n · **Confidence:** LIKELY
- **Evidence:**
  - `components/MushafPage.jsx:237`: ``aria-label={`سورة ${surahName(...)}`}``
  - `components/BasmalaGlyph.jsx:13`: `aria-label="بِسْمِ اللَّهِ ..."`
  - `components/MushafMarks.jsx:132`: the Arabic labels inside the button

  None of these elements carry `lang="ar"`. The SR text block at `MushafPage.jsx:224` does it right (`<p lang="ar">`).
- **Impact:** With the English UI, screen readers voice these Arabic names with an English voice.
- **Recommendation:** Add `lang="ar"` on those elements.
- **Effort:** S

### L15. One top-level ErrorBoundary with no reset
- **Severity:** Low · **Category:** Reliability · **Confidence:** LIKELY
- **Evidence:** `main.jsx` wraps `<App/>` in the single `ErrorBoundary`. `components/ErrorBoundary.jsx:23-24` has no reset path other than a full reload.
- **Impact:** A render error in an isolated widget (Chatbot, TimeTool, TodoList, a tafsir panel) takes down every route.
- **Recommendation:** Add route-level and widget-level boundaries, for example around `<Routes>` keyed on `location.pathname`, and around `PersistentChatbot`. Optionally report errors to the server.
- **Effort:** S–M

### L16. AuthContext: hard-coded English fallbacks and console logging
- **Severity:** Low · **Category:** i18n / Maintainability · **Confidence:** LIKELY
- **Evidence:**
  - `context/AuthContext.jsx:76`: `'Registration failed'`
  - `:96`: `'Login failed'`. These, and server messages, reach the Arabic UI in English.
  - `:49`: `console.log(err)` and `:122`: `console.log('Refresh user error:', err)` in production.
  - `:121-123`: `refreshUser` swallows errors, so callers can't tell that it failed.
- **Recommendation:** Return error codes and map them through `t()`. Remove the console noise or route it through a logger. Make `refreshUser` rethrow or return a status.
- **Effort:** S

### L17. ReaderTools tab pattern is incomplete
- **Severity:** Low · **Category:** Accessibility · **Confidence:** LIKELY
- **Evidence:** `components/ReaderTools.jsx:49-68`: `role="tablist"` and `role="tab"`, but no arrow-key roving focus, no `aria-controls` on the tabs, and the tabpanel has no `aria-labelledby`.
- **Recommendation:** Either complete the ARIA tabs pattern, or use plain toggle buttons with `aria-pressed`.
- **Effort:** S

### I1. driver.js renders tour title and description with innerHTML
- **Severity:** Info · **Category:** Security (latent) · **Confidence:** CONFIRMED (library source)
- **Evidence:** `node_modules/driver.js` 1.4.0 dist assigns `.innerHTML` for the popover title and description. `components/dashboardTour.js:81` and `libraryTour.js:62` pass `t(key)`. `i18n.js` sets `interpolation: { escapeValue: false }`.
- **Impact:** Safe today, because the strings are static locale text. If a tour string ever interpolates user data (a name, a surah search query), it becomes an XSS sink.
- **Recommendation:** Keep tour strings static. Add a comment at both call sites.

### I2. Tour helpers are duplicated
- **Severity:** Info · **Category:** Maintainability
- **Evidence:** `isVisible`, `centerTarget`, `refreshPopover` and the driver config are copy-pasted between `dashboardTour.js:9-36,89-107` and `libraryTour.js:27-92`.
- **Recommendation:** Have dashboardTour use libraryTour's `makeDriver` / `buildSteps` from a shared `tourCore.js`.
- **Effort:** S

### I3. The self-test hides verses visually but not from screen readers
- **Severity:** Info · **Category:** Accessibility / product
- **Evidence:** `components/MushafPage.jsx:222-226` always renders every verse's `textUthmani` in `.mushaf-sr-text`, whatever `concealMode` is.
- **Impact:** Screen-reader users can't use hide mode to test themselves. This is a product decision.

### I4. Personal email hard-coded in the footer
- **Severity:** Info · **Category:** Privacy / Maintainability
- **Evidence:** `components/Footer.jsx:13`: a `mailto:` to a personal Gmail address.
- **Recommendation:** Use a project alias, held in env or config, before the public launch.

### I5. chatLinks: a stray ")" in rare model text
- **Severity:** Info · **Category:** Correctness (cosmetic) · **Confidence:** CONFIRMED
- **Evidence:** `splitChatLinks('[y](javascript:alert(1)) and')` returns `[{text:"y"},{text:") and "}]`, because the target class `[^)\s]` stops at the first `)`. It is safe: no link is produced.

### I6. Some local data survives logout (by design)
- **Severity:** Info · **Category:** Privacy
- **Evidence:** `logout` (`AuthContext.jsx:103-106`) clears only `token`. `recentPages` (`services/recentPages.js:1-7`, documented as per-browser), `recentReciters`, the zoom level, `lastMushafPage` and the guest to-do list all stay.
- **Recommendation:** Acceptable. Mention it in a privacy note, or offer "clear this device's history" on logout for shared devices.

## 3. Catch-block classification

| file:line | Classification | Why |
|---|---|---|
| components/Chatbot.jsx:76 | INTENTIONAL | Maps 429 or another error to a user-visible message. The error itself is not logged |
| components/LanguageToggle.jsx:28 `.catch(() => {})` | INTENTIONAL (silent) | `langExplicit` stays set, so `AuthContext.syncLanguage` pushes it again on the next load. Self-healing. The user is not told |
| components/MushafPage.jsx:195 | INTENTIONAL | Font-loading API failure; it measures anyway |
| components/ReciterPicker.jsx:39 | INTENTIONAL | Malformed or blocked storage gives an empty recents list |
| components/ReciterPicker.jsx:180 | INTENTIONAL | Storage blocked; recents just don't persist (commented) |
| components/TimeTool.jsx:211 | INTENTIONAL | `requestPermission` throws, treated as denied. The UI shows a note |
| components/TodoList.jsx:70,73,86,95,105,113 `.catch(failed)` | INTENTIONAL | Error toast. The store rolls back the optimistic change |
| components/TodoList.jsx:83,93 (undo restore) `.catch(failed)` | INTENTIONAL | Error toast |
| components/TodoList.jsx:219 `store?.retry().catch(() => {})` | INTENTIONAL | Store `status` drives the error and Retry UI. The promise rejection is redundant |
| components/VerseSearch.jsx:56 | INTENTIONAL | Sets the `error` state, which shows Retry. Not logged |
| components/dashboardTour.js:35 | INTENTIONAL | `refresh` after the tour was torn down |
| components/libraryTour.js:54 | INTENTIONAL | Same as above |
| context/AuthContext.jsx:26 `.catch(() => {})` | INTENTIONAL (silent) | The language push is retried on the next load |
| context/AuthContext.jsx:48 | **SWALLOWED / over-broad** | Treats every error as a 401: drops the token and logs to the console only (finding M1) |
| context/AuthContext.jsx:75, :95 | INTENTIONAL | Returns `{success:false,message}` to the caller. English fallback (L16) |
| context/AuthContext.jsx:121 | **SWALLOWED** | `console.log` only. Callers can't tell the refresh failed (L16) |
| context/TimerContext.jsx:51 | INTENTIONAL | Notification constructor unsupported on some mobile browsers (commented) |
| hooks/useDraggable.js:35 | INTENTIONAL | Malformed stored position gives the default |
| hooks/useMushafZoom.js:69, :72 | INTENTIONAL | Storage unavailable |
| utils/chatLinks.js:29 | INTENTIONAL | Unparseable path is not a link |
| utils/returnTo.js:12 | INTENTIONAL | Unparseable path gives null |

Uncaught (no catch at all, see L3): the localStorage calls in ThemeContext:5,34, AuthContext:23,30,36,70,90, LanguageToggle:25-26 and useDraggable:88.

## 4. Strengths

- **Model output is rendered safely.**
  - The Chatbot never uses HTML.
  - `chatLinks.safeAppPath` checks an exact pathname whitelist, validates each query parameter, and rejects hashes, `//` and other origins. In my tests, `javascript:`, external URLs and lookalike paths all stayed plain text.
  - No `dangerouslySetInnerHTML` or `innerHTML` anywhere in `src/`. The one mention is a comment in `quranApi.js`.
- **ErrorBoundary** shows no stack or message, is bilingual, and falls back to English if i18n fails.
- **ConfirmModal** gets dialog semantics right: alertdialog, labelled and described, initial focus on Cancel, Tab trap, Escape, focus return, and keys don't leak out.
- **ReciterPicker and VerseSearch** are proper `aria-activedescendant` comboboxes with folding that handles Arabic diacritics and letter variants.
- **Timer architecture.** `useSyncExternalStore` with primitive selectors means re-renders happen once per displayed second, not per tick. The context value is the stable store. There is a cross-tab chime claim, and an assertive live region announces phase ends.
- **Zoom and idle-hide hooks** show careful engineering:
  - DOM-variable zoom avoids re-rendering the reader.
  - A gesture latch keeps one Ctrl+wheel gesture on the page.
  - Ctrl+wheel and Ctrl+/− are left to browser zoom, for accessibility.
  - Every listener, rAF and ResizeObserver is cleaned up.
- **TodoList** offers keyboard reorder (Alt+↑/↓ and the grip), pointer capture with `lostpointercapture` handling, undo toasts, a live-region announcement, and an edit field guarded against double commit.
- **MushafPage accessibility design.** One focusable button per verse rather than per word, plus a clipped real-text block with `lang="ar"`. This is a thoughtful answer to the private-use-codepoint glyph problem.
- **Toasts** pause on hover and focus, so action buttons never vanish under the user.
- **Comments** consistently explain why, not just what. Most hooks document their invariants.
