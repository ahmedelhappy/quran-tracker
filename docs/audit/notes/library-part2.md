> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Library.jsx audit — part 2 (lines 3150–6245)

## 1. Coverage

**Library.jsx lines I read in full** (chunks of 400 lines or fewer): 3150–3549, 3550–3949, 3950–4349, 4350–4749, 4750–5149, 5150–5549, 5550–5899, 5900–6245. That covers all of 3150–6245.

**Context read outside the range (owned by the part-1 auditor):**
- 1–67 (imports)
- the hook/state declarations listed by grep
- 330–365, 425–432, 705–722, 784–828, 886–935
- 1499–1603 (playOrd / stepVerse / togglePlayPause / toggleVerseAudio)
- 1940–1983 (goToPage)
- 2144–2253 (keyboard handler, Escape ladder)
- 2626–2645, 2783–3149 (annotation loaders, commitAnnoOps, history, span state, flushDrawing, applyStrokes, ink seeding effect)

**Other files I opened:**
- `client/src/services/api.js` (whole file, including the 401 interceptor)
- `client/src/services/quranApi.js` 230–397 (TAFSIR_EDITIONS, fetchPageTafsir, htmlFragmentToText, fetchAyahTafsir, fetchHefzAyahTafsir, fetchEditionAyahTafsir, findTafsirRun)
- `client/src/services/mushafApi.js` 335–360 (shapeVerses: `id`, `textUthmani`)
- `client/src/utils/verseIndex.js` 1–65
- `client/src/components/Tooltip.jsx` 1–80
- `client/src/components/ConfirmModal.jsx` (whole file)
- `client/src/components/MushafPage.jsx` 1–140, plus a memo grep of MushafPage, MushafDrawLayer, MushafMarks and the other children
- `client/src/hooks/useDraggable.js` (whole file)
- `client/src/index.css` (the prefers-reduced-motion blocks)
- `client/src/locales/en.json` and `ar.json` (selected keys)
- `server/controllers/progressController.js` 1095–1175 (updateMemorized) and 1288–1300 (updateUnits)
- `server/utils/segments.js` UNIT_TYPES (grep)

## 2. Responsibility map (3150–6245)

| Lines | Responsibility |
|---|---|
| 3150–3156 | Tail of the ink working-copy seeding effect (drops off-screen clean pages) |
| 3158–3230 | Annotate-mode lifecycle: enterDraw, exitDraw, toggleDraw (3-state pencil), startDrawWithTool, selectTool, selectColor |
| 3232–3272 | Draw toolbar: outside-click collapse, viewport positioning (scroll/resize listeners) |
| 3274–3358 | Unified undo/redo timeline: moveInk, stepHistory, serialized runHistory promise queue, clearDrawing |
| 3360–3383 | Free-floating text notes CRUD (create/update/delete via annotationsAPI) |
| 3385–3404 | Annotate mode follows page turns (flush + re-anchor); unmount flush of dirty ink |
| 3406–3429 | Annotation navigator: jump, prev/next annotated page (wrap), arrival pulse timer |
| 3431–3452 | Self-test helpers (hide/reveal all, mode switch, method ticks), go-to-page input handlers |
| 3454–3511 | Mark/unmark a page memorized (optimistic + rollback) |
| 3513–3673 | Bookmarks: add, restore, remove, rename, request/confirm move, replace, undo-move |
| 3675–3740 | Derived data: tafsir edition, juz, surah labels, verse aria label, selected/playing index, range-repeat progress text |
| 3742–3791 | Zoom follow for the playing/selected verse; scroll the current search hit into view |
| 3793–3822 | stepSelection: whole-Quran verse stepping with a cross-page turn |
| 3824–3948 | Tafsir: panel verse resolution and fallback memory, fetch effect, resize (pointer and keyboard), paragraphs, openTafsir |
| 3950–4017 | Span popover helpers (range label, span tafsir, span audio), toggleTafsir |
| 4019–4095 | Popover placement layout effect; capture-phase outside-click dismissal (popover, repeat menu) |
| 4097–4180 | Selected-verse annotation state, labels, hard-list labels, bookmark dialog copy, method steps, select classes, tafsir skeleton |
| 4182–4423 | renderPageCard: per-page annotation index, conceal predicate, MushafPage + MushafDrawLayer + MushafMarks, running head, footer memorized/hard toggles |
| 4425–4435 | skeletonCard |
| 4437–4552 | Root JSX: auto-hide Navbar, SearchFindBar, sidebar/tafsir edge tabs, timer edge indicator |
| 4554–5143 | Sidebar (about 590 lines): page nav, search button, page input, recent pages, view toggle, juz/surah selects, signed-out nudge, bookmarks list, ReaderTools (timer/todo), method checklist, self-test, mark verses, annotation navigator, hard list, stats |
| 5145–5269 | Mushaf column: hint, zoom scroller, viewport (pointer/touch capture), edge zones, error/skeleton/pages, PageScrubber, page info |
| 5271–5529 | Verse/span action popover (transport, tafsir, highlight swatches, note, hard, collapse, close) |
| 5531–5766 | Sticky audio bar (transport, status, zoom, speed, verse pause, repeat menu, reciter) and the two `<audio>` ping-pong elements |
| 5769–5964 | Tafsir panel (sheet / overlay / docked column, resize separator, header, verse, edition, text) |
| 5969–6039 | Note editor sheet |
| 6041–6076 | Read-only text-note sheet |
| 6078–6186 | Draw toolbar (tools, colours, undo/redo/clear/done) |
| 6188–6219 | Confirm modals (bookmark, clear ink), HowToMemorizeModal |
| 6221–6242 | Lazy VerseSearch in Suspense; Footer |

The JSX return alone runs about 1,800 lines (4437–6244). Natural extraction seams:
- `<LibrarySidebar>` (4554–5143)
- `<VerseActionPopover>` (5271–5529)
- `<AudioBar>` (5531–5766), with the audio engine in a `useRecitation` hook
- `<TafsirPanel>` plus a `useTafsir` hook (3824–3948, 5769–5964)
- `<NoteSheet>` / `<TextNoteSheet>` (5969–6076)
- `<DrawToolbar>` plus a `useAnnotateMode` hook (3158–3404, 6078–6186)
- `useBookmarks` (3513–3673, 4709–4833)
- `<PageCard>` (4186–4423)

## 3. Findings

### F1. Un-marking one page sends the whole client-side set, so the server deletes every page this tab didn't know about
- **Severity:** High
- **Category:** Correctness / data integrity
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:3502`: `await progressAPI.updateMemorized({ memorizedPages: Array.from(nextPages) });`, where `nextPages` is the local `memorizedPages` Set minus one page (3490–3493).
  - The server replaces the set: `server/controllers/progressController.js:1126-1130`: `await UserProgress.deleteMany({ userId, status: 'memorized', pageNumber: { $nin: Array.from(newPageSet) } });`
  - The local set is loaded once on mount (`Library.jsx:895-905`), and a failed load is silent: `.catch(() => { landOn(1);` with `memorizedPages` left at `new Set()`.
- **Impact:**
  - (a) Stale tab. The Library is open, and in another tab or device the user completes today's new page on the Dashboard. Back in the Library they un-mark page 10. The server deletes the new page's progress record, including its review history.
  - (b) Failed initial load (for example a cold-start timeout). Every tick shows empty. The user ticks a page they really have memorized, then un-ticks it. The request becomes `updateMemorized({memorizedPages: []})`, and the server deletes all of the user's memorized pages. The only signal is a "Page N unmarked" success toast.
- **Recommendation:**
  - Use a per-page delta. The server already supports `PUT /progress/units` with `{action:'remove', unit:'page', ref: page}` (`server/utils/segments.js:80`, UNIT_TYPES includes `'page'`), or add a `DELETE /progress/page/:n`.
  - Separately, surface the initial-load failure and disable the ticks until state is known.
- **Effort:** S

### F2. A failed ink save is never retried, and the strokes are then dropped from the working copy
- **Severity:** Medium
- **Category:** Reliability / data loss
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:3082-3084` (boundary, part 1): `const pages = [...drawDirtyRef.current]; ... drawDirtyRef.current = new Set();`. The dirty set is cleared before `await annotationsAPI.saveDrawing(...)`.
  - The catch at 3094–3095 only toasts.
  - Then `Library.jsx:3150` (in range): `if (!visiblePages.includes(page) && !drawDirtyRef.current.has(page)) { delete next[key]; ...`
  - exitDraw (3171–3180) reloads annotations from the server after the flush.
  - The unmount flush (3400–3404) swallows errors with `.catch(() => {})`.
  - There is no `pagehide`/`beforeunload` flush anywhere (grep found none in client/src). Strokes from the last 1.5 s debounce are lost on tab close, and on the 401 interceptor's hard `window.location.href` redirect.
- **Impact:**
  - On a flaky connection, a reader marks up page 12, the save fails once, and they turn the page or press Done. The ink disappears permanently; the only trace is a generic error toast.
  - With an expired token, the 401 redirect also discards any un-flushed strokes.
- **Recommendation:**
  - Clear a page's dirty flag only after its save succeeds. Re-add failed pages and retry with backoff.
  - Flush on `visibilitychange: hidden` / `pagehide` (fetch `keepalive`).
  - Show a persistent "unsaved ink" state instead of a transient toast.
- **Effort:** M

### F3. Whole-Library re-render on every pointermove/scroll while resizing tafsir, dragging the popover, or annotating
- **Severity:** Medium
- **Category:** Performance
- **Confidence:** LIKELY (not profiled)
- **Evidence:**
  - Tafsir resize, `3906-3910`: `const onMove = (ev) => { ... setTafsirWidth(clampTafsirWidth(startW + delta)); };`, a state update per pointermove on the 6,000-line component.
  - Popover drag: `useDraggable.js` calls `setPos` per pointermove; the hook lives in Library (`Library.jsx:731`).
  - Annotate mode, `3265-3272`: `window.addEventListener('scroll', reposition, true)`, and `positionDrawMenu` always calls `setDrawMenuPos({ top, left })`, a new object even when unchanged (3263). This stays active whenever `drawPage != null`, even with the menu collapsed, so every scroll event in annotate mode re-renders everything.
  - The children are not memoized: `MushafPage.jsx:27 export default function MushafPage(` (no `memo`), same for MushafDrawLayer and MushafMarks.
  - renderPageCard passes fresh closures every render (`isConcealedHere` 4193, `highlightFor` 4229, `onOpenNote` 4334, `onStrokesChange` 4352 …), so `memo` alone would not help.
- **Impact:** Two full mushaf pages (hundreds of word spans each), the sidebar (114-option surah select, bookmark/summary/hard lists) and the audio bar reconcile per input event. This can cause jank on mid/low-end phones and tablets (NFR-01 / NFR-03).
- **Recommendation:**
  - Keep drag/resize positions in refs and write `style` directly (or rAF-throttle), committing state on pointerup.
  - Bail out of `setDrawMenuPos` when nothing changed, and only listen while the menu is open.
  - Extract `<PageCard>` and `memo` it with stable callbacks (`useCallback` / per-page memoized lookups).
- **Effort:** M

### F4. "Next annotated page" gets stuck in two-page view when the spread's left page is annotated
- **Severity:** Low
- **Category:** Correctness
- **Confidence:** LIKELY
- **Evidence:**
  - `3417`: `const after = annotatedPages.filter((p) => (dir > 0 ? p > currentPage : p < currentPage));`. In the spread `currentPage` is the right (odd) page, so `after[0]` can be the left page already on screen.
  - `goToPage` (1959–1961) anchors an even page to `page - 1` and returns `false` because it is already there.
- **Impact:** On spread 5–6 with annotations on 6 and 20, pressing "next" pulses page 6 forever and never reaches 20.
- **Recommendation:** For `dir > 0` compare against `Math.max(...visiblePages)`; for `dir < 0` compare against `Math.min(...visiblePages)`.
- **Effort:** S

### F5. Stepping the selection while audio is paused restarts the recitation
- **Severity:** Low
- **Category:** Correctness / UX
- **Confidence:** LIKELY (intent ambiguous)
- **Evidence:**
  - `3807`: `const following = isPlaying || playingOrd != null;`
  - Then `if (following) playOrd(next);` (3810 / 3815).
  - `playOrd` (1510–1520) does `setIsPlaying(true)` for a new ord.
- **Impact:** A reader who paused the recitation and uses the popover or tafsir prev/next arrows to read the next verse's tafsir has playback start again unexpectedly. The comment says "Audio comes along if it was already going", but paused isn't going.
- **Recommendation:** Use `following = isPlaying`. When paused, just retarget the loaded verse without playing.
- **Effort:** S

### F6. Double-press of next/prev verse across a page boundary drops the pending selection
- **Severity:** Low
- **Category:** Correctness (race)
- **Confidence:** SUSPECTED
- **Evidence:**
  - `3813-3821`: the second press, made before the new page's `verses` arrive, recomputes the same `next`.
  - `goToPage` returns `false` because that page is already requested or shown (1960–1961). The branch then clears `pendingSelectRef`, `selectTurnRef` and `followTurnRef`, which the first, still-pending turn needed.
- **Impact:** The page turns but no verse is selected; with audio following, the follow flag is lost.
- **Recommendation:** Compute `from` from `pendingSelectRef.current` when a select-turn is pending, and only clear the flags when no turn is pending.
- **Effort:** S

### F7. Go-to-page input accepts decimals and turns Enter-on-empty into a jump to page 1
- **Severity:** Low
- **Category:** Correctness / validation
- **Confidence:** LIKELY
- **Evidence:**
  - `3447`: `if (e.key === 'Enter') goToPage(pageInput);`
  - `goToPage` uses `clampPage = (n) => Math.max(1, Math.min(604, Number(n) || 1))` (line 75), with no rounding.
  - `"12.5"` flows into `setSearchParams({page:'12.5'})`, and `currentPage = clampPage(...)` (349) becomes 12.5, which then reaches `fetchMushafPage(12.5)`.
  - `""` + Enter jumps to page 1 (blur instead resets the field, 3448–3451).
- **Impact:** The reader can land in an error state from a typo, and the same applies to a deep link like `?page=12.5`.
- **Recommendation:** Use `Math.round` / `Math.trunc` in clampPage, and make Enter use the same validation as blur.
- **Effort:** S

### F8. The note draft is silently discarded when the page turns under it (including audio-driven turns)
- **Severity:** Medium
- **Category:** UX / data loss
- **Confidence:** LIKELY
- **Evidence:**
  - `3075` (boundary): `useEffect(() => { setNotePanel(null); }, [currentPage]);`
  - Reopening calls `openNote`, which does `setNoteDraft(existing?.text ?? '')` (2954) and overwrites the draft.
  - The note sheet is rendered at 5970–6039.
  - Recitation that crosses a page break turns the page through goToPage.
- **Impact:** A user writing a long reflection while recitation plays loses it the moment the audio crosses to the next page. There is no save prompt.
- **Recommendation:** Keep the panel open across turns (it is anchored by verseKey and pageNumber, not by the view), or auto-save/ask before closing a dirty draft.
- **Effort:** S

### F9. Side sheets (tafsir on mobile, note editor, read-text note) are modal-looking but not accessible dialogs
- **Severity:** Medium
- **Category:** Accessibility (WCAG 2.4.3, 4.1.2, 2.1.2)
- **Confidence:** LIKELY
- **Evidence:**
  - `5778-5781` and `5972-5975`: a full-screen backdrop on mobile; `6045-6048` a backdrop at all widths.
  - The panels (5782, 5976, 6049) have no `role="dialog"`, no `aria-modal`, no `aria-labelledby` to their `<h3>`, no initial focus (the note `<textarea>` at 6006 has no autoFocus), no focus trap, and no focus return to the opener.
  - These are rendered after `</main>`, so keyboard users must tab through the whole page to reach them.
  - Escape for the note sheet is ignored while focus is in the textarea, because the global handler returns early for TEXTAREA (2149).
  - Contrast: ConfirmModal does all of this correctly.
- **Impact:** Screen-reader and keyboard users can't tell a sheet opened, and they read or tab content hidden behind the backdrop.
- **Recommendation:** Use one shared `<Sheet>` component with ConfirmModal's focus logic: role=dialog (modal only below md), focus the first field, trap, return focus, and handle Escape locally.
- **Effort:** M

### F10. Smaller accessibility gaps in my range
- **Severity:** Low
- **Category:** Accessibility (WCAG 1.3.1, 3.3.2, 4.1.2, 2.5.7)
- **Confidence:** LIKELY
- **Evidence:**
  - Page input `4613-4623` and bookmark label input `4718-4725` have only a placeholder, no label or aria-label. The note textarea at 6006 is the same.
  - The single/double view toggle buttons `4631-4646` have no `aria-pressed`.
  - The method toggle `4866` has no `aria-expanded`.
  - The repeat menu `5625-5739`: the button uses `aria-pressed` for mode but has no `aria-expanded`/`aria-haspopup`. The menu has no Escape close (absent from the Escape ladder at 2224–2235), and focus isn't moved into it.
  - The popover drag grip `5283-5290` is a `<span>` with aria-label but no role, not focusable, and has no keyboard or single-pointer alternative.
  - Tafsir resize keys `3927-3928`: ArrowLeft always widens. In RTL the handle sits on the panel's right edge, so ArrowLeft moves it right (inverted); the pointer path handles `rtl` (3908) but the key path doesn't.
  - Partial vs full memorized (4388–4392) differ only by colour (amber vs green, same icon) for sighted users.
- **Note:** Icon buttons wrapped in `<Tooltip>` are fine; `Tooltip.jsx` injects `aria-label` (checked, so this is not a finding).
- **Recommendation:** Add the labels and ARIA states; add Escape for the repeat menu; mirror the arrow keys in RTL; give the partial state a distinct glyph (for example a half-filled icon).
- **Effort:** S

### F11. Tafsir requests have no timeout or abort; the skeleton can spin forever and probes keep running after the reader moves on
- **Severity:** Low
- **Category:** Reliability / performance
- **Confidence:** LIKELY
- **Evidence:**
  - Effect `3853-3881` guards state with `cancelled` (good) but cannot abort.
  - `quranApi.js:251` `fetch(\`${ALQURAN_API}/page/...\`)`, `:304`, `:320`: plain `fetch` with no `signal` or timeout.
  - `findTafsirRun` (`quranApi.js:359-378`) sequentially fetches up to 24 neighbouring ayah texts for grouped editions, and keeps going after the panel has moved on.
  - The caches (`tafsirAyahCache`, `hefzCache`, `tafsirPageCache`) are unbounded Maps for the session.
  - The effect depends on the `tafsirVerse` object, not its key (3881). A new `verses` identity for the same verse refetches and flashes the skeleton (`setTafsirText('')`, 3859).
- **Impact:** On a stalled CDN, the panel shows a skeleton with no Retry for minutes. Fast stepping wastes mobile data.
- **Recommendation:**
  - Use an AbortController with a timeout (for example 10 s) leading to the error/Retry state, and abort in the cleanup.
  - Pass the signal into findTafsirRun.
  - Key the effect on `tafsirVerse?.verseKey`, and cap the caches (LRU).
- **Effort:** S–M

### F12. The span-tafsir fallback verse has no Quran text, so the panel shows an empty verse box
- **Severity:** Low
- **Category:** Correctness (Quranic rendering)
- **Confidence:** LIKELY
- **Evidence:**
  - `3973`: `lastTafsirVerseRef.current = { verseKey, id: ord, surahNumber: v.surahNumber, ayahNumber: v.ayahNumber, page: pageOfOrd(ord) };`. There is no `textUthmani`, and `verseOfOrd` (verseIndex.js:40–47) only returns numbers.
  - The panel renders `{verseText(tafsirVerse)}` (5881), where `verseText = (verse) => verse.textUthmani ?? ''` (190).
- **Impact:** The panel opens for a span whose first verse is on a page turned away from, and the mushaf-styled box shows only `﴿n﴾`.
- **Recommendation:** Fetch or peek the verse text (`peekMushafPage(page)?.verses`) or the committed search-index text, or hide the box until it is available.
- **Effort:** S

### F13. A failure loading the lazy VerseSearch chunk crashes the whole app to the root ErrorBoundary
- **Severity:** Medium
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:**
  - `67`: `const VerseSearch = lazy(() => import('../components/VerseSearch'));`
  - `6223-6239`: `<Suspense fallback={null}>` with no local error boundary.
  - The only ErrorBoundary is in `main.jsx:10`.
- **Impact:** After a deploy (old hashed chunk is 404) or offline, pressing `/` or the Search button replaces the entire reader with the global error screen, and any playback state is lost.
- **Recommendation:**
  - Wrap it in a local error boundary that shows "Search unavailable — retry".
  - Retry the import once, and reload on a chunk-load error after a deploy.
- **Effort:** S

### F14. Server error messages shown verbatim; one stat skips digit localisation
- **Severity:** Low
- **Category:** i18n
- **Confidence:** LIKELY
- **Evidence:**
  - `3367/3375/3382`: `showToast(e.response?.data?.message || t('common.error'), 'error')`.
  - `3536`: `e.response?.data?.message || t('common.error')`.
  - The server sends English messages, so Arabic users see English toasts.
  - `5137`: `t('library.pagesMemorizedStat', { count: memorizedCount })`, and `ar.json:896 "{{count}} / 604 صفحة محفوظة"`. Western digits and a literal 604 appear in an otherwise Arabic-Indic UI (the rest of the sidebar uses `fmtNum`).
- **Recommendation:** Map server error codes to i18n keys (or always use the localized fallback), and pass `n: fmtNum(count)` / `total: fmtNum(604)`.
- **Effort:** S

### F15. Tafsir width isn't re-clamped on viewport resize
- **Severity:** Low
- **Category:** Responsive / UX
- **Confidence:** LIKELY
- **Evidence:**
  - The initial value accepts 300–720 regardless of viewport (`716-719`).
  - `clampTafsirWidth` (3888–3891) with its `innerWidth * 0.55` cap is only applied during drag or keyboard resize (grep shows no resize listener for it).
- **Impact:** A 720 px width saved on a large monitor, reopened on a 1100 px laptop with the sidebar open, squeezes the mushaf column to roughly 90 px.
- **Recommendation:** Clamp on render, using `Math.min(tafsirWidth, innerWidth * 0.55)` from a resize-aware value.
- **Effort:** S

### F16. Un-marking a page has no confirm or undo, and it destroys review history
- **Severity:** Low
- **Category:** UX / data
- **Confidence:** LIKELY
- **Evidence:**
  - `4381`: `onClick={() => (done ? unmarkPageMemorized(pd.page) : markPageMemorized(pd.page))}`.
  - The success toast (3503) carries no action, unlike bookmarks and annotations.
  - The server `deleteMany` removes reviewCount and dates. Re-marking creates a fresh record with `memorizedDate` set to yesterday (progressController.js:1148–1155).
- **Impact:** A mis-tap on a small 16 px tick in the page footer silently resets that page's spaced-repetition history.
- **Recommendation:** Add an Undo toast (re-create with the old dates via a server restore) or a confirm. Consider enlarging the touch target: it is about 20 px (`p-0.5` plus a 16 px icon). It likely still passes WCAG 2.5.8 through the spacing exception (6 px gap to the flag button), but it is small for a destructive toggle on a phone.
- **Effort:** S–M

### F17. Unmount flush doesn't cancel the debounce timer (duplicate save after unmount)
- **Severity:** Info
- **Category:** Reliability / leak
- **Confidence:** LIKELY
- **Evidence:**
  - `3400-3404` saves the dirty pages but neither clears `drawSaveTimerRef` nor resets `drawDirtyRef`.
  - `drawSaveTimerRef` is only cleared inside flushDrawing (3081) and reset in scheduleDrawSave (3101).
- **Impact:** About 1.5 s after leaving the Library, the timer fires flushDrawing. It PUTs the same strokes again and calls loaders and setState on the unmounted tree. The save is idempotent, so the effect is wasted requests.
- **Recommendation:** `clearTimeout(drawSaveTimerRef.current)` in the unmount cleanup, and route it through one flush.
- **Effort:** S

### F18. The history queue's `.catch(() => {})` hides programming errors
- **Severity:** Info
- **Category:** Maintainability / observability
- **Confidence:** LIKELY
- **Evidence:** `3345-3347`: `historyQueueRef.current = historyQueueRef.current.then(...).catch(() => {});`
- **Impact:** The catch is needed to keep the serial queue alive. However, any thrown bug in stepHistory or moveInk (outside the network try) vanishes with no log and no toast: an undo press just does nothing.
- **Recommendation:** `.catch((err) => { console.error(err); showToast(t('common.error'), 'error'); })`.
- **Effort:** S

### F19. God-component maintainability
- **Severity:** Medium
- **Category:** Maintainability
- **Confidence:** CONFIRMED (measured: `wc -l` = 6245 lines; the JSX return alone is about 1,800 lines, 4437–6244)
- **Evidence:**
  - The responsibility map above.
  - Several patterns are copy-pasted:
    - the bottom-sheet/side-panel shell at 5782–5791, 5976–5978 and 6049–6051
    - the identical capture-phase outside-click effects at 3236–3247, 4047–4080 and 4087–4095
    - optimistic-rollback boilerplate repeated across bookmarks (3558–3673)
    - IIFEs in JSX (4368, 4399, 5314, 5479, 5891, 5998)
    - render-time IIFEs (`spanRangeLabel` 3955, `bookmarkDialog` 4130)
  - Strings are composed by hand, e.g. `t('library.verseLabel', { n: '' }).trim()` (5679) used to get a bare "Verse" label.
  - There are inconsistent whitespace/indent artefacts at 4835, 4997, 5076, 5133 and 5142, suggesting merge leftovers.
- **Recommendation:** Extract components and hooks along the seams in section 2, starting with the self-contained `TafsirPanel` + `useTafsir`, `useBookmarks`, `DrawToolbar` + `useAnnotateMode`, and a shared `<Sheet>` and `useOutsideClick`. This also unlocks memoization (F3).
- **Effort:** L

## 4. Catch-block classification (3150–6245)

| Line | Class | Why |
|---|---|---|
| 3313 | Intentional | Undo/redo network failure: bumps the generation to drop queued presses, error toast with Retry; the step stays for retry |
| 3347 | Intentional, but silent | Keeps the serial history promise chain alive; uncommented and hides real bugs (F18) |
| 3367 | Intentional (handled) | Text-note create: toast; error text is raw server message (F14) |
| 3375 | Intentional (handled) | Text-note update: toast |
| 3382 | Intentional (handled) | Text-note delete: toast |
| 3392 (`.finally`) | n/a | flushDrawing never rejects (its own catch at 3094); finally re-anchors |
| 3402 | Swallowed | Unmount ink save failure is dropped with no log or retry; ink lost (F2) |
| 3478 | Intentional (handled) | Mark memorized: rollback both sets and toast |
| 3504 | Intentional (handled) | Unmark: rollback and toast. The success path is the dangerous one (F1) |
| 3532 | Intentional (handled) | Add bookmark: 409-specific messages, else toast |
| 3551 | Intentional | restoreBookmark returns null; callers show "restoreFailed" |
| 3571 | Intentional (handled) | Remove bookmark: rollback and toast |
| 3606 | Intentional (handled) | Rename: rollback label; 409-aware toast |
| 3640 | Intentional (handled) | Undo-move: "restoreFailed" toast. List state isn't rolled back, but the update didn't apply, so it stays consistent |
| 3667 | Intentional (handled) | Move: rollback to `before`; 409 conflict opens the replace dialog. Rolling back to a closure snapshot can clobber a concurrent rename (minor) |
| 3876 | Intentional (commented) | "the label is a nicety — never fail the read over it" |
| 3878 | Intentional (handled) | Tafsir load: error state with a Retry button (guarded by `cancelled`) |

Related catches just outside the range that the range depends on: 2789 `.catch(() => [p, []])`, 2804, 2813, 3016, and 2637 `.catch(() => {})`. These are silent loader failures. Combined with 905 (initial progress load: silent, leaves an empty set), they feed F1. The part-1 auditor owns them.

## 5. Strengths
- **No XSS sinks in range.** I found no `dangerouslySetInnerHTML`, `innerHTML` or `window.open` (grep of Library, MushafPage, MushafDrawLayer, SearchFindBar, RecentPagesRow). Third-party tafsir HTML is converted to text (`quranApi.js:285-297`) and rendered as `<p>{para}</p>` (5955). User notes, text notes and note excerpts render as text nodes with `dir="auto"`. Bookmark labels are wrapped in Unicode isolates (3520) for bidi safety.
- **Visitors can't trigger the 401 redirect from this range.** Every account action in 3150–6245 is gated by `signedIn` / `signedInRef` (3159, 3203, UI gates at 4275, 4290, 4368, 4399, 4709, 4961, 4997, 5076, 5133, 5373, 5429). Tafsir and audio use plain `fetch`, not the axios instance.
- **Stale-response guards.** The tafsir effect uses a `cancelled` flag (3855, 3880), the span state uses a request counter (3013–3015), and the history runner is a serialized queue with generation drop (3341–3348).
- **Optimistic updates almost everywhere roll back on failure** (bookmarks, memorized). The bookmark 409 conflict flow reopens the replace dialog with server data (3669–3670).
- **ConfirmModal is exemplary:** initial focus, trap, Escape, focus return. Focus is restored to bookmark row actions after re-sorts (3583–3586).
- **Tooltip auto-names icon buttons** (`Tooltip.jsx:55-59`). The ARIA states are used well on the swatches, including `aria-pressed="mixed"` for partial span coverage (5441, 5488), and on the resize separator (role, valuenow/min/max, keyboard support).
- **i18n:** no hard-coded English JSX text in range (grep); digits go through `fmtNum`; RTL handled with logical properties (`ps/pe/ms/start/end`, `rtl:rotate-180`); the deliberate Western digits on keycaps are documented (6094–6101).
- **Reduced motion is respected:** the page-turn Flip (4319), search scroll behaviour (3777), and CSS guards for panels, pulses and navbar (`index.css:355, 529, 547, 564, 716`).
- **Comments are thorough** and explain the intent behind non-obvious interaction ladders.
