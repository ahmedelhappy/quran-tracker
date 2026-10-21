> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Library.jsx audit — part 1 (lines 1–3200)

Repo HEAD at audit time: `fcb6d4e`. Read-only; no repo files modified.

## 1. Coverage

**Library.jsx read in full, in chunks of 400 lines or fewer:** 1–400, 400–799, 800–1199, 1200–1599, 1600–1999, 2000–2399, 2400–2799, 2800–3199, 3199–3228. That covers the whole of 1–3200, plus a small overlap at the end.

**Lines outside my range, opened only to judge findings inside it:** 3384–3408 (the drawing flush when the page turns, and the flush on unmount), 3463–3511 (mark/unmark memorized, the consumer of the state set at line 904), 4310–4329 (where `<Flip>` is used). I also grepped the whole file for catch blocks, XSS sinks, `localStorage` (34 uses), `eslint-disable` (8 in my range) and `onTimeUpdate`.

**Other files opened:**
- `client/src/services/api.js`: whole file (401 interceptor, no axios timeout)
- `client/src/services/mushafApi.js`: whole file
- `client/src/utils/verseIndex.js`: whole file
- `client/src/hooks/useRecentPageTracker.js`: whole file
- `client/src/hooks/useTimer.js`: `useTimerEvent`
- `client/src/hooks/useMushafZoom.js`: lines 20–49, plus a grep for its keyboard handling
- `client/src/services/quranApi.js`: the audio URL, reciter and fallback helpers (lines 134–202)
- `client/src/services/recentPages.js`: grep for localStorage and try/catch
- `client/src/components/ConfirmModal.jsx`: whole file
- `client/src/components/HowToMemorizeModal.jsx`: lines 1–40
- `client/src/components/MushafPage.jsx`: lines 270–309, plus a grep for `onContextMenu`
- `client/src/index.css`: the `mushaf-flip` and reduced-motion rules
- `server/controllers/progressController.js`: lines 1095–1169 (`updateMemorized`)
- `server/controllers/annotationController.js`: grep for the drawing upsert (`$set: { strokes }`)
- `server/controllers/authController.js`: grep for JWT `expiresIn`
- `client/src/pages/Settings.jsx`: grep for `tour=1`

## 2. Responsibility map (Library.jsx)

| Lines | Responsibility |
|---|---|
| 1–63 | Imports: about 40 icons, 17 components, 4 services, 6 hooks, utils |
| 65–190 | Module constants and helpers: lazy `VerseSearch`, `JUZ_START_PAGES` (also duplicated in `utils/quranSearchQuery.js:149`), `clampPage`, the `KEEPS_VERSE_SELECTION` selector, `READER_EDGE_TAB`, `wordAtPoint`, repeat counts, range-drag tuning, audio-handover tuning, annotation and draw colours, `DRAW_TOOLS`, `toolForKey`, `verseText` |
| 192–259 | Sub-components `RepeatCountRow` and `VerseRangePicker` |
| 261–283 | `buildPageOrder`: word reading-order index used by the self-test watermark |
| 285–328 | `Flip`: page-turn animation wrapper |
| 330–357 | `Library()` start: i18n, `fmtNum`, auth (`signedIn`/`signedInRef`), `?page` from the URL, go-to-page field adjusted during render |
| 359–431 | Landing-page refs, self-test state, single/double view, sidebar and tools persistence, reduced motion |
| 433–530 | Page data, memorized/partial pages, mark-verses, bookmark, annotation, note, drawing (annotate mode), annotation visibility and navigator state, first-use cues |
| 532–693 | Audio: reciter, `playingOrd`, A/B double-buffer refs, retry budgets and fallback, live-value refs, speed, verse pause, repeat state (verse, nested range), follow-along/reader-led/selection refs |
| 695–758 | Verse selection, tafsir panel state (edition, width, text, run, loading), the draggable popover, range selection |
| 760–783 | Verse search state; driver.js tour state |
| 785–824 | Derived values: `visiblePages`, `verses`, `pageOrders`, `activePage`, `bookmarkTargetPage` |
| 826–854 | Persisting the view; the toggle-sidebar ref; tafsir docking that hides the sidebar; `matchMedia` breakpoint |
| 856–921 | Resolving the landing page (URL, then last page opened, then first unmemorized page); fetching progress; persisting the last page; fetching bookmarks |
| 923–933 | Popover-grip drag tooltip suppression |
| 935–997 | Page arrival: synchronous draw during render when the page is cached, otherwise a fetch effect (with a stale-response guard); warming the previous page for margin ornaments |
| 999–1174 | Audio buffer plumbing: `applyRate`, `loadBuf`, `releaseBuf`, `markBufReady`, `failBuf` (retry, backoff, fallback), `playEl`, `cancelPreStart`, `resumeActive` |
| 1176–1253 | Blind no-cors warm-up of the audio CDN edge; `stopAudio` |
| 1255–1333 | On page change, clear the selection or take the "reader is steering" flag; recent-pages tracker; selection follows the recitation; landing a pending selection |
| 1335–1396 | Self-test reset on page change; first-visit tour; verse-actions coachmark |
| 1398–1496 | Reciter-change reset; effect that drives the active `<audio>`; applying speed; resetting repeat counters; range-picker defaults |
| 1498–1599 | Playback controls: `nextOrdAfter`, `playOrd`, `replayCurrent`, `advanceOrd`, `stepVerse`, `togglePlayPause`, timer-event auto-pause, `toggleVerseAudio` |
| 1601–1652 | `handleEnded` (the repeat state machine), `handleAudioError` |
| 1654–1708 | Preload the next verse, warm 3 verses ahead, stall watchdog (1 s interval) |
| 1710–1938 | Gapless-handover scheduler: an rAF loop every frame while playing, clock projection, latency probe, 'tight' trimming; `handleAudioPause` (fallback for platforms that can't play two elements at once) |
| 1940–2016 | Navigation: `goToPage`/`goNext`/`goPrev` with refs that keep fast key presses from being lost; follow-the-recitation page turns; preparing the next verse's page; prefetch focus |
| 2018–2135 | Verse search integration: open/close/focus restore, landing on an occurrence, stepping, jumps, recent pages, per-word hit lookup |
| 2137–2241 | Global `keydown` shortcuts: page turns, `/` and Ctrl+K, F3, undo/redo, tool keys, S/F, Escape ladder |
| 2243–2279 | Touch swipe to turn the page; `setViewMode` |
| 2281–2332 | Self-test watermark operations (`revealVerse`, `hideVerse`, `revealThrough`) |
| 2334–2621 | Drag across verses to pick a range: zoom hook wiring (2362–2370), band, `setRange`, edge-dwell page turns, touch hold, auto-scroll while zoomed, window pointer listeners, extend on turn, blocking touchmove |
| 2623–2779 | Verse selection ladder; mark-verses (units API); `showVerseActions` (right-click/long-press); right-click through the ink layer; `startMarkVerses` |
| 2781–3075 | Annotations: page/hard/summary loaders; `commitAnnoOps` (batch); one undo/redo timeline; popover actions (highlight, hard, note); span actions and span state; closing the note sheet on page change |
| 3077–3200 | Drawing: `flushDrawing` (debounced save), `scheduleDrawSave`, `applyStrokes`, seeding the working copy per page, `enterDraw`/`exitDraw`/`toggleDraw`, `startDrawWithTool` |

Size in 1–3200 alone: about 94 `useState`, 80 `useRef`, 60 `useEffect`/`useLayoutEffect`, 68 `useCallback`, and 8 `eslint-disable react-hooks/exhaustive-deps`.

## 3. Findings

### F1. Progress-load failure is silently swallowed and leads to a full memorized-progress wipe
- **Suggested severity:** High
- **Category:** Reliability / data integrity
- **Confidence:** LIKELY. The chain is clear in client and server code; not reproduced.
- **Evidence:**
  - `Library.jsx:895-906`. A failed load leaves `memorizedPages` as an empty `Set`. Nothing marks the state as unknown and the user isn't told:
    ```js
    progressAPI.getAllProgress().then(res => {
      ...
    }).catch(() => {
      landOn(1);
    });
    ```
    `Library.jsx:440` sets the initial value: `const [memorizedPages, setMemorizedPages] = useState(new Set());`
  - The consumer, outside my range, at `Library.jsx:3491-3502`. Unmarking sends the client's whole set as the replacement:
    ```js
    const nextPages = new Set(prevPages);
    nextPages.delete(page);
    ...
    await progressAPI.updateMemorized({ memorizedPages: Array.from(nextPages) });
    ```
  - The server replaces the set (`server/controllers/progressController.js:1126-1130`):
    ```js
    await UserProgress.deleteMany({
      userId,
      status: 'memorized',
      pageNumber: { $nin: Array.from(newPageSet) },
    });
    ```
- **Impact / scenario:** A signed-in user on a flaky mobile connection opens /library and `GET /progress/all` fails. Every page now looks unmemorized. They tick page X, which calls `markComplete` and is safe on its own. Then they untick it. The PUT sends `memorizedPages: []`, and the server deletes every memorized page with its review history (`reviewCount`, `lastReviewedDate`). There is no undo. The same thing happens, with less damage, whenever the client's set is stale: `refreshMemorizedPages` failing silently at 2637, another tab or device adding pages, or a mark+unmark before the initial fetch resolves.
- **Recommendation:**
  1. Track `progressLoaded`/`progressError`. Disable the mark/unmark controls, or show a retry, until the load succeeds.
  2. Change unmark to a per-page delete (for example `updateUnits({ action: 'remove', unit: 'page' })` or a `DELETE /progress/page/:n`) instead of replace-set. Keep `PUT /progress/memorized` for the bulk editor only.
- **Effort:** S for the guard; M for the per-page endpoint.

### F2. Annotate mode can overwrite a page's saved ink with only the new strokes
- **Suggested severity:** High
- **Category:** Reliability / data integrity / race
- **Confidence:** LIKELY. The code paths and the server's full-replace upsert are clear; not reproduced.
- **Evidence:**
  - Seeding at `Library.jsx:3136-3146`. A page whose annotations haven't arrived, or failed, is seeded with `[]`. Once that page is dirty it is never reseeded:
    ```js
    for (const page of visiblePages) {
      if (drawDirtyRef.current.has(page)) continue;
      const saved = (annotationsByPage.get(page) ?? []).find((a) => a.kind === 'drawing')?.strokes ?? [];
      const have = next[page];
      if (have === undefined || (have.length === 0 && saved.length > 0)) {
        next[page] = saved;
    ```
  - A load failure is turned into "this page has no annotations" at `Library.jsx:2787-2789`:
    ```js
    annotationsAPI.listForPage(p)
      .then((r) => [p, r.data?.data ?? []])
      .catch(() => [p, []])
    ```
  - The save sends the whole working copy (`Library.jsx:3087-3088`):
    ```js
    annotationsAPI.saveDrawing({ pageNumber: page, strokes: drawStrokesRef.current[page] ?? [] })
    ```
  - The server replaces the stored strokes (`annotationController.js:364`): `{ $set: { strokes }, $setOnInsert: { ... kind: 'drawing' ... } }`.
  - Aggravating factor: `loadAnnotationsForPages` (2783-2798) has no request sequencing, so an older reply can land after a newer one. The span loader does have sequencing (`spanAnnsReqRef`, 3013-3015).
- **Impact / scenario:**
  - (a) Race. In annotate mode the reader turns to a page not yet in `annotationsByPage`. Turns are allowed while annotating (2156-2159, 3387-3389). They draw before `GET /annotations?page=` returns, which on mobile can take 300 ms to 1 s or more. The page is dirty, so the late reply is ignored. About 1.5 s later the PUT replaces the server's ink with only the new strokes.
  - (b) A transient GET failure seeds `[]` and the first stroke wipes the page's ink.
  - In both cases the user's earlier drawings on that page are permanently lost, and nothing tells them. The code comment at 3127-3131 names this exact risk ("the next stroke would then save over what was there") but only guards the case where the doc arrives before the first stroke.
- **Recommendation:**
  - Keep a per-page "loaded" flag. Block drawing on a page, or queue its strokes, until its annotations have actually loaded.
  - On a load error, keep the old cache entry (or mark it as an error) instead of `[]`.
  - Better still, make the save merge-safe: an append/erase op log, or a version/ETag precondition so the server rejects a write based on stale data.
  - Add a request-id guard to `loadAnnotationsForPages`.
- **Effort:** M

### F3. Typed note draft is discarded on any page change, including turns the recitation makes
- **Suggested severity:** Medium
- **Category:** Correctness / UX data loss
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:3074-3075`:
    ```js
    // Close the note sheet when the reader turns the page.
    useEffect(() => { setNotePanel(null); }, [currentPage]);
    ```
  - The page also turns without any reader input when the page follows the recitation (`Library.jsx:1990-1993`):
    ```js
    const page = pageOfOrd(playingOrd);
    if (!page || visiblePages.includes(page)) return;
    followTurnRef.current = true;
    if (!goToPage(page)) followTurnRef.current = false;
    ```
  - Reopening the note resets the draft from the saved note (`openNote`, 2954): `setNoteDraft(existing?.text ?? '');`
- **Impact / scenario:** A user listens in continuous mode and writes a reflection on a verse. When the recitation crosses a page break, the note sheet closes and the text is gone with no warning. The same happens with a swipe, the scrubber, or a jump.
- **Recommendation:**
  - Don't close the note sheet on turns the app makes (check `followTurnRef`/`turnByAudioRef`). Or keep the panel open: it is anchored by verseKey and page, not by what's on screen.
  - Or keep a draft per verse in state or sessionStorage, and confirm before discarding non-empty unsaved text.
- **Effort:** S

### F4. A failed drawing save is not retried, and its strokes are discarded on exit
- **Suggested severity:** Medium
- **Category:** Reliability / swallowed failure
- **Confidence:** LIKELY
- **Evidence:** `Library.jsx:3082-3096`. The dirty set is cleared before the request. The catch shows a toast but never marks the pages dirty again:
  ```js
  const pages = [...drawDirtyRef.current];
  if (!pages.length) return;
  drawDirtyRef.current = new Set();
  try {
    await Promise.all(pages.map((page) =>
      annotationsAPI.saveDrawing({ pageNumber: page, strokes: drawStrokesRef.current[page] ?? [] })));
    ...
  } catch (e) {
    showToast(e.response?.data?.message || t('common.error'), 'error');
  }
  ```
  `exitDraw` (3171-3181) then calls `flushDrawing`, which finds nothing dirty, and reloads server state. The unmount flush at 3400-3404 only iterates `drawDirtyRef`. The 413-style "drawing too large" response (`annotationController.js:345`) also comes through this path.
- **Impact / scenario:** The network drops for one save. The user sees an error toast but the ink still shows on screen. They leave annotate mode or the Library, and the ink disappears, because nothing retries it. A JWT expiry (30-day tokens) during a save goes further: the api.js 401 handler does `window.location.href = '/login…'` and the in-memory strokes are lost.
- **Recommendation:** In the catch, add the failed pages back to `drawDirtyRef` (unless the error is a 4xx validation error) and retry with backoff. Show a persistent "unsaved ink" indicator, and block `exitDraw` (or confirm it) while saves are failing.
- **Effort:** S

### F5. Single-character global shortcuts can't be turned off or remapped (WCAG 2.1.4, Level A)
- **Suggested severity:** Medium
- **Category:** Accessibility
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:2163`: `if ((!mod && !e.altKey && isShortcutKey(e, '/')) || ...) { e.preventDefault(); openSearch(); return; }`
  - `Library.jsx:2208-2215`:
    ```js
    if (drawPage == null && !mod && !e.altKey) {
      const tool = toolForKey(e);
      if (tool) { e.preventDefault(); if (!e.repeat) startDrawRef.current?.(tool); return; }
      if (isShortcutKey(e, 's') || isShortcutKey(e, 'f')) {
        e.preventDefault(); toggleSidebarRef.current?.(); return;
      }
    }
    ```
  - `DRAW_TOOLS` keys are p/h/e/t and 1–4 (174-179). The handler is attached to `window` (2239) and only skips input, select, textarea and contentEditable targets.
- **Impact / scenario:** Speech-input and keyboard-only users trigger annotate mode, hide the sidebar, or open search by accident while focus is on any button or link. WCAG 2.1.4 requires single-key shortcuts to be either turn-off-able, remappable, or active only while the relevant component has focus.
- **Recommendation:** Add a "Keyboard shortcuts" toggle in Settings (or on the reader tools row) that disables the letter and digit shortcuts. Or require a modifier, or scope them to when focus is inside the reader region.
- **Effort:** S

### F6. Page-level shortcuts fire behind the "How to memorize" dialog, which has no focus management
- **Suggested severity:** Medium
- **Category:** Accessibility (WCAG 2.4.3, 2.1.2) / correctness
- **Confidence:** LIKELY
- **Evidence:**
  - The Library key handler gates only on tours and form fields (`Library.jsx:2146-2149`). It never checks `howToOpen` (386):
    ```js
    if (tourActiveRef.current) return;
    const el = e.target;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
    ```
  - `HowToMemorizeModal.jsx:20-25, 33` declares `role="dialog" aria-modal="true"`. It only adds a window Escape listener: there's no initial focus, no Tab trap, no focus restore, and no `stopPropagation`.
  - Compare `ConfirmModal.jsx:39-41`, which stops propagation for exactly this reason ("the Library turns pages on the arrow keys, which must not fire behind a dialog").
- **Impact / scenario:** With the modal open:
  - ArrowLeft/Right turn the mushaf page behind it.
  - `p` enters annotate mode.
  - Escape closes the modal and also runs the Library's Escape ladder (ending the find bar, closing the tafsir panel or deselecting) in one keypress.
  - Screen-reader and keyboard focus stays behind the modal.
- **Recommendation:** Give `HowToMemorizeModal` the same treatment as `ConfirmModal` (focus on open, trap, restore, `stopPropagation`). Also add `howToOpen` (and any other open-modal flag) to the Library handler's early return.
- **Effort:** S

### F7. Range drag re-renders the whole Library (and the unmemoized MushafPage) on every pointermove
- **Suggested severity:** Medium
- **Category:** Performance
- **Confidence:** LIKELY that it re-renders on every move; the jank itself is SUSPECTED (not measured).
- **Evidence:**
  - `Library.jsx:2480-2489`. Every move creates a new object, so React never bails out:
    ```js
    const paint = (d) => {
      setSelectedVerseKey(null);
      setDragRange({
        startOrd: Math.min(d.startOrd, d.lastOrd),
        endOrd: Math.max(d.startOrd, d.lastOrd),
      });
    };
    ```
  - It is called from every `pointermove` (2556) and from every auto-scroll frame (2535).
  - `MushafPage`, `MushafDrawLayer` and `MushafMarks` are plain function components, not `memo` (grep: `export default function MushafPage(`). `inRange` (2386) changes identity whenever the band changes.
- **Impact / scenario:** A 6,245-line component, with one or two 15-line glyph pages under it, re-renders 60–120 times a second while the user drags out a range, even when the pointer stays on the same verse. On mid-range phones (the touch-hold drag path) this risks dropped frames and the 3-second NFR-01 interaction target.
- **Recommendation:** Only `setDragRange` when start or end actually change (compare with the ref). Wrap `MushafPage` in `React.memo` with stable callbacks. Longer term, keep the band in a ref plus a CSS class toggle, or a small store.
- **Effort:** S for the bail-out; M for memo hygiene.

### F8. God component: about 300 hooks in the first half, with correctness resting on refs and disabled exhaustive-deps
- **Suggested severity:** Medium
- **Category:** Maintainability
- **Confidence:** CONFIRMED (counted)
- **Evidence:**
  - In lines 1–3200: about 94 `useState`, 80 `useRef`, 60 effects, 68 `useCallback`.
  - 8 `eslint-disable-next-line react-hooks/exhaustive-deps`, at 309, 881, 1372, 1395, 1464, 1670, 1707 and 1919.
  - Helpers that aren't memoized (`applyRate` 1006, `loadBuf` 1015, `markBufReady` 1044, `failBuf` 1069, `playEl` 1126, `cancelPreStart` 1147, `resumeActive` 1161) are recreated on every render. Effects with disabled deps capture them, and they work only because every live value goes through refs mirrored during render (636-639).
  - Constants are declared inside the component and recreated every render: `AUDIO_RETRIES_*` (566-576), `STALL_MS` (608), `SPEEDS` (623), `TAFSIR_MIN_W/MAX_W` (714-715), `WARM_*` (1209-1211).
- **Impact / scenario:** Any change to the audio or annotation logic risks stale-closure regressions that the linter can't catch. There are no frontend tests. Review cost is very high.
- **Recommendation:** Extract by responsibility, following the map in section 2:
  1. `useReciterPlayer` (lines 532–693, 999–1253, 1398–1938). This is a self-contained state machine that is mostly refs already.
  2. `usePageArrival` (935–997).
  3. `useVerseRangeDrag` (2334–2621).
  4. `useAnnotations` + `useUndoHistory` (2781–3075).
  5. `useDrawingSession` (3077 onward).
  6. `useReaderShortcuts` (2137–2241).
  7. `useVerseSearch` (2018–2135).

  Move the constants to module scope. Add unit tests around `handleEnded`, `ordAfterEnd` and `failBuf` once they are extracted.
- **Effort:** L

### F9. Verse-repeat tally resets when the reader turns the page or selects another verse mid-repeat
- **Suggested severity:** Low
- **Category:** Correctness
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:1477-1481`, the reset is keyed on the range ends even in verse mode:
    ```js
    useEffect(() => {
      setRepeatsDone(0);
      setRangePasses(0);
    }, [repeatMode, rangeStartOrd, rangeEndOrd, rangeRepeat, rangeVerseRepeat, verseRepeat,
        reciter, setRepeatsDone, setRangePasses]);
    ```
  - `Library.jsx:1487-1495` rewrites the range ends whenever `verses` or the selection change, as long as mode isn't 'range':
    ```js
    if (repeatMode === 'range') return;
    const startOrd = ordOfKey(selectedVerseKey) ?? ordOfKey(verses[0]?.verseKey);
    ...
    setRangeStartOrd(startOrd);
    ```
  - `handleEnded` reads `repeatsDoneRef` (1607).
- **Impact / scenario:** In verse-repeat ×3, during repeat 2, the reader turns the page to glance ahead. Recitation continues by design (1259-1263), but the counter goes back to 0, so the verse plays 4–5 times and the bar's "2 of 3" jumps back. Selecting a different verse while it plays has the same effect.
- **Recommendation:** Reset on `rangeStartOrd`/`rangeEndOrd` only when `repeatMode === 'range'`. Split the effect, or use a guard inside it.
- **Effort:** S

### F10. "Replay tour" (`/library?tour=1`) drops the page param, lands on page 1 and overwrites the last page opened
- **Suggested severity:** Low
- **Category:** Correctness (stale closure)
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:1344-1358`. This is a mount-only effect, and 350 ms later it rebuilds the URL from the mount-time `searchParams`:
    ```js
    const id = setTimeout(() => {
      ...
      if (forceTour) {
        const next = new URLSearchParams(searchParams);
        next.delete('tour');
        setSearchParams(next, { replace: true });
      }
    ```
  - Meanwhile `landOn` (870-875, called at mount on line 878) has already set `?page=<lastOpened>`.
  - `Settings.jsx:1812` does `navigate('/library?tour=1')`.
- **Impact / scenario:** Replaying the tour wipes `page`. `currentPage` falls back to 1 (349), and the effect at 912-914 then writes `lastMushafPage = 1`, so the reader's saved position is lost.
- **Recommendation:** Use the functional form: `setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('tour'); return n; }, { replace: true })`.
- **Effort:** S

### F11. Account-data loaders swallow errors and show misleading empty states
- **Suggested severity:** Low
- **Category:** Reliability / UX
- **Confidence:** LIKELY
- **Evidence:**
  - 920: `bookmarksAPI.list().then(res => setBookmarks(res.data?.data ?? [])).catch(() => {});`
  - 2802-2804: `annotationsAPI.listByKind('hard') ... .catch(() => {});`
  - 2811-2813: `annotationsAPI.getSummary() ... .catch(() => {});`
  - 2633-2637: `refreshMemorizedPages ... .catch(() => {});`
  - 3014-3016: `annotationsAPI.listVerseRange(spanFrom, spanTo) ... .catch(() => {});`. When this fails, `spanState` stays `null`, so `setSpanHighlight` and `toggleSpanHard` return early (3055, 3065) and the span's buttons do nothing silently.
- **Impact / scenario:** On a network blip the user sees "no bookmarks" or an empty hard list and may create duplicates, or the span action buttons appear dead. None of this is critical, but it hides failures from the user and from monitoring.
- **Recommendation:** Keep an error state per loader with a small retry affordance. At minimum, log to whatever client error reporting you adopt. Disable the span buttons with a "couldn't load" hint.
- **Effort:** S

### F12. No timeout or abort on the page-data fetch path
- **Suggested severity:** Low
- **Category:** Reliability / performance
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:962-967`: `Promise.all(visiblePages.map(async (p) => { const [data] = await Promise.all([fetchMushafPage(p), ensurePageFont(p)]); ...`
  - That leads to `mushafApi.js:248`: `const res = await fetch(\`${base}&per_page=50&page=${p}\`);` with no `signal` and no timeout.
  - `api.js:4-6`, `axios.create({ baseURL: ... })` has no `timeout`.
  - The effect only sets a `cancelled` flag (959, 979), so requests from turns the reader has already left keep running.
- **Impact / scenario:** A request that hangs (captive portal, stalled TCP) leaves the spinner up with no error or retry button until the browser gives up, which can take minutes. Scrubbing quickly through cold pages fires one or two quran.com requests per page, none of them cancelled. Note: `computeNextSpill` (`mushafApi.js:414`) also fetches page+1, and a failure there fails page N.
- **Recommendation:** Wrap `fetch` with an `AbortSignal.timeout(10000)`, or a controller combined with the effect's cleanup. Set an axios `timeout`. In `computeNextSpill`, treat a failed page+1 as "no spill" instead of failing page N.
- **Effort:** S

### F13. localStorage is accessed without try/catch (34 places), so the public reader can crash where storage is blocked
- **Suggested severity:** Low
- **Category:** Reliability
- **Confidence:** LIKELY. The SecurityError behaviour depends on the browser and its settings.
- **Evidence:**
  - Reads inside `useState` initialisers run during render, for example 371 `Number(localStorage.getItem('lastMushafPage'))`, 390, 402, 420, 423, 519, 529, 535, 625, 631, 708, 717.
  - Writes in handlers and effects, for example 413, 421, 424, 520, 626 (`seenVerseTapCue`), 913, 1404, 1471.
  - `services/recentPages.js:55,65` already wraps its access in try.
- **Impact / scenario:** With site data/cookies blocked (Chrome's "block all cookies", some embedded webviews), reading `window.localStorage` throws SecurityError. Library then crashes into the ErrorBoundary on first render. A `QuotaExceededError` on setItem would throw inside a handler.
- **Recommendation:** Add a tiny `safeStorage` util (get/set/remove inside try) and use it everywhere. `api.js` and AuthContext need it too.
- **Effort:** S

### F14. Raw server error messages, in English, are shown in toasts
- **Suggested severity:** Low
- **Category:** i18n
- **Confidence:** LIKELY
- **Evidence:**
  - 2662: `showToast(e.response?.data?.message || t('common.error'), 'error');`
  - The same pattern at 2924 and 3095.
  - A server example (`annotationController.js:345`): `` message: `This page's drawing is too large (...KB, max ...KB). Erase some strokes.` ``
- **Impact / scenario:** Arabic-UI users get English error text in an otherwise RTL Arabic interface.
- **Recommendation:** Have the server return stable error `code`s and map them through `t()`. Fall back to `t('common.error')`.
- **Effort:** S–M

### F15. A zoomed page can't be panned horizontally from the keyboard
- **Suggested severity:** Low
- **Category:** Accessibility (WCAG 2.1.1)
- **Confidence:** LIKELY
- **Evidence:**
  - `Library.jsx:2217-2223`:
    ```js
    case 'ArrowLeft':
    case 'PageDown':
      e.preventDefault(); goNext(); break;
    case 'ArrowRight':
    case 'PageUp':
      e.preventDefault(); goPrev(); break;
    ```
  - `useMushafZoom.js:33-35` documents that the reader keeps ←/→ for turning; horizontal pan is wheel, Shift+wheel, touch or Space+drag.
- **Impact / scenario:** At 2–3× zoom a printed line is about 1000 px wide (the zoom hook's own note). A keyboard-only user can scroll vertically but can't reach the part of a line that's off screen.
- **Recommendation:** When the page is zoomed and the scroller can still scroll in that direction, let ←/→ (or Shift+←/→) pan first and turn the page only at the edge, mirroring what the swipe does (2261-2265).
- **Effort:** S

### F16. Verse actions are reachable from the keyboard only through the context-menu key
- **Suggested severity:** Info
- **Category:** Accessibility
- **Confidence:** SUSPECTED. The render half (other auditor) may provide another path.
- **Evidence:**
  - `Library.jsx:2673-2676`: "A plain click SELECTS AND NOTHING ELSE ... The actions are on the secondary gesture instead (see showVerseActions)."
  - `MushafPage.jsx:289-293`: Enter/Space on the verse anchor calls `handleWordClick`, which selects. Actions are opened only via `onContextMenu` (`MushafPage.jsx:322-324`).
- **Impact / scenario:** Keyboard users must know Shift+F10 or the Menu key to reach Play, Tafsir, Highlight or Note for a verse. That is poorly discoverable.
- **Recommendation:** Let Enter on an already-selected verse open its actions (or bind a documented key), and say so in the selection hint.
- **Effort:** S

### F17. The page-turn animation mounts a second copy of the outgoing page's subtree on every turn
- **Suggested severity:** Info
- **Category:** Performance
- **Confidence:** LIKELY
- **Evidence:** `Library.jsx:305, 320-323`:
  ```js
  setExiting({ id: `${flipKey}-${Date.now()}`, node: fromNode, dir });
  ...
  {exiting && (
    <div className={`mushaf-flip-layer mushaf-flip-exit ${exitCls}`} aria-hidden="true">
      {exiting.node}
  ```
  `fromNode` is the previous `<MushafPage …>` element (used at 4319-4320). It mounts fresh in a new slot, with all its glyph spans and effects, for 220 ms.
- **Impact / scenario:** Each turn costs one extra full page mount. With reduced motion it is skipped (304). Not a launch blocker, but worth knowing when profiling turns.
- **Recommendation:** Snapshot the DOM instead (`cloneNode` the old layer) or use the View Transitions API where available.
- **Effort:** M

### F18. Smaller items (Info)
- **Dead migration code.** 732: `useEffect(() => { localStorage.removeItem('versePopoverPos'); }, []);` can be removed once enough time has passed.
- **`setSearchParams` with an object wipes every other query param.** 873 `setSearchParams({ page: String(target) }, { replace: true })`, 1964 and 2277. Any future param (utm, tab and so on) is silently dropped. Prefer the functional merge.
- **Extra commit on every page turn.** 821 `useEffect(() => { setActivePage(visiblePages[0]); }, [visiblePages]);`. Use the during-render adjustment already used at 353-357.
- **Range-drag edge timer survives unmount.** The listener effect's cleanup (2588-2593) doesn't call `endRangeDrag()`. If the component unmounts mid-drag with the pointer parked at an edge, `turn()` (2429-2437) still calls `goNextRef.current()`, which calls `setSearchParams` after unmount. SUSPECTED; the timing makes it very unlikely.
- **The handover runs an rAF loop every frame while audio plays** (1907-1917), including sorts in `endsAt` and `startLatency`. It is bounded and cleaned up (1918). It pauses in background tabs. It's a battery consideration on mobile, not a bug.
- **`reduceMotion` is read once at mount** (429-431) and never follows OS changes. The CSS `@media (prefers-reduced-motion)` guard (`index.css:355-357`) covers this.
- **`JUZ_START_PAGES` is duplicated** in `utils/quranSearchQuery.js:149` (`JUZ_START`). Move it to `data/`.
- **The ∞ repeat button's accessible name is just "∞"** (210). Add an `aria-label` through `t()` ("unlimited").

## 4. Catch-block classification (lines 1–3200)

| Line | Class | Why |
|---|---|---|
| 904 | SWALLOWED | Progress load failure leaves an empty `memorizedPages` with no error state or toast. It only lands on page 1. This is the root of F1. |
| 920 | SWALLOWED | Bookmarks load failure looks like "no bookmarks" (F11). |
| 974 | Handled | Sets `pageError` and clears loading; the error UI and retry key are in the render half. |
| 995 | INTENTIONAL | Commented: the previous-page warm-up only drives a top-of-page ornament. |
| 1137 | Handled / INTENTIONAL | `play()` rejection is classified: AbortError ignored (documented 1120-1125), NotAllowedError resets state, anything else goes to `failBuf` retry. |
| 1154 | INTENTIONAL | Commented: setting `currentTime` on a not-yet-seekable element. |
| 1219 | INTENTIONAL | Commented: blind no-cors CDN warm-up. |
| 1428 | INTENTIONAL | Commented, same `currentTime` case. |
| 1458 | INTENTIONAL | Commented, same `currentTime` case. |
| 2003 | INTENTIONAL (uncommented) | Best-effort next-page prefetch; the real arrival retries. A comment would help. |
| 2637 | SWALLOWED | `refreshMemorizedPages` failure leaves stale ticks after a mark-verses success, which feeds F1. |
| 2661 | Handled | Toast; `finally` resets the mode. |
| 2789 | SWALLOWED (harmful) | Turns a failed per-page annotations GET into `[]` and replaces the cached list. Enables the ink overwrite in F2. |
| 2804 | SWALLOWED | Hard list (F11). |
| 2813 | SWALLOWED | Annotation summary and navigator (F11). |
| 2923 | Handled | Toast; busy flags reset in `finally`. |
| 3016 | SWALLOWED | Span annotations; the span action buttons silently do nothing (F11). |
| 3094 | Handled but lossy | Toast shown, but the dirty pages are dropped, so there's no retry (F4). |

Also noted, not a catch: `replayCurrent` at 1528 sets `el.currentTime = 0` without the try that its siblings (1154/1428/1458) use. It's harmless on a ready element (this path runs after `ended`), but inconsistent.

## 5. Strengths
- **Public-reader gating is careful.** Every account request is behind `signedIn` or `signedInRef` (889, 919, 2632, 2784, 2801, 2810, 2818-2819, 3012, 3159, 3203). Together with api.js skipping the redirect for token-less 401s (api.js:30-35), a visitor can't trigger the login bounce from the Library.
- **No XSS sinks in this range.** There is no `dangerouslySetInnerHTML`, `innerHTML` or `window.open`. Audio URLs come only from whitelisted reciter ids (`resolveReciterId`, 535) and numeric ordinals. `?page` is clamped (75, 349). Only `tour=1` is otherwise read from the URL.
- **localStorage values are validated on read:** speed whitelist (626), edition whitelist (709), width clamp (718), page range (372), reciter resolve (535). Nothing sensitive is stored by this range.
- **Stale responses are handled for page arrival** (`cancelled` + `arrivalKey`, 957-980) and for span annotations (request counter, 3013-3015). Navigation keeps fast key presses from being lost by stepping from a request ref (1940-1978).
- **The audio pipeline is unusually robust:** per-buffer status machine (583-599), separate retry budgets with backoff and a verified fallback source (559-576, 1069-1118), a stall watchdog, cleanup of intervals, rAF and timers, and refs that avoid stale closures in timers. Retry timers become no-ops after unmount because element refs go null.
- **Memory is bounded:** warmed-set cap (1225), LRU page caches and font-face caps in mushafApi, undo history cap (`HISTORY_CAP`), and batch size matched to the server (`MAX_SPAN_OPS`).
- **i18n and RTL:** every toast and label in this range goes through `t()`. Digits go through `fmtNum`/`toArabicDigits`. Edge tabs use logical properties (92-98). Mushaf direction is deliberately independent of UI language.
- **Accessibility positives:** dragging a range has a non-drag alternative in the surah/ayah pickers (WCAG 2.5.7). Repeat buttons use `aria-pressed` and `role="group"`. The exit layer of the turn animation is `aria-hidden` and `pointer-events:none`. Search restores focus. ConfirmModal is a good model for focus handling. Reduced motion is honoured for the page turn.
- **Comments are thorough** and explain measured behaviour, which will make the refactor in F8 much safer.
