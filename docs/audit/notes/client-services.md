> Working notes from one area review of the October 2026 audit, kept for traceability.
> **Severities here are the reviewer's suggestions; the final, calibrated severities and IDs are in [../../AUDIT_2026-10.md](../../AUDIT_2026-10.md).**
> Scratch-folder paths mentioned below referred to the auditor's temporary workspace and no longer exist.

# Client services / utils / data / i18n / config: audit notes

Repo HEAD `fcb6d4e`, working tree clean before and after (`git status --porcelain` was empty both times). Read-only. Helper scripts were run from `scratchpad\svc-scripts\` against copies of the repo files, then deleted.

## 1. Coverage manifest

| Path | Lines | Read in full | Note |
|---|---|---|---|
| client/src/services/api.js | 120 | YES | Axios instance, token attach, 401 interceptor. No timeout. `localhost` fallback baseURL |
| client/src/services/chime.js | 61 | YES | Web Audio bell; autoplay unlock is correct |
| client/src/services/dailyVerse.js | 90 | YES | alquran.cloud; cache key uses the UTC date but the verse pick uses the local day; cache keys never purged |
| client/src/services/mushafApi.js | 465 | YES | quran.com words + self-hosted QCF fonts; LRU caps on page data and font faces; no fetch timeout |
| client/src/services/pagePrefetch.js | 164 | YES | 2 turns each way, honours saveData and 2g, failures back off for 30 s. Sound |
| client/src/services/quranApi.js | 396 | YES | Reciters, tafsir, HTML-to-text. 4 unbounded caches; spa5k tafsir pinned to `@main` |
| client/src/services/quranSearch.js | 120 | YES | Lazy 1.3 MB index; build is chunked |
| client/src/services/recentPages.js | 112 | YES | localStorage reads and writes wrapped, input sanitised, capped at 12. Sound |
| client/src/services/timerStore.js | 352 | YES | Cross-tab timer: Web Locks, `storage` event, input sanitised. Sound |
| client/src/services/todoBackends.js | 171 | YES | Server and local backends behind one interface; local writes throw `STORAGE` |
| client/src/services/todoStore.js | 217 | YES | Optimistic queue with exact rollback and coalesced reorders. Sound |
| client/src/services/verseEdges.js | 220 | YES | MP3 header parse + edge decode; cache bounded at 64; failures become null |
| client/src/utils/chatLinks.js | 76 | YES | Allow-list of app paths. Safe, but one regex is quadratic |
| client/src/utils/formatNumber.js | 14 | YES | Trivial |
| client/src/utils/quranSearchQuery.js | 202 | YES | Normalisation and jump parsing. No user-built RegExp. Pasting Uthmani text often fails to match |
| client/src/utils/recentPageLabels.js | 49 | YES | Fine |
| client/src/utils/returnTo.js | 20 | YES | Open-redirect safe (tested) |
| client/src/utils/selfTestCycle.js | 19 | YES | Fine |
| client/src/utils/shortcutKeys.js | 64 | YES | `shortcutValue` is a dead export |
| client/src/utils/surahDisplay.js | 113 | YES | Fine; uses LRI/PDI bidi isolation |
| client/src/utils/timerCore.js | 116 | YES | Wall-clock maths; `planTotal` is dead |
| client/src/utils/unitRanges.js | 138 | YES | Verse-exact ranges; `unitOrdRange` is dead |
| client/src/utils/verseIndex.js | 66 | YES | `clampOrd` is dead |
| client/src/data/hizbRanges.js | 9 | YES | Two one-line JSON tables (HIZB_RANGES 60 rows, RUB_RANGES 240 rows). No generator script in the repo. Validated against the structure data |
| client/src/data/juzRanges.js | 12 | YES | Validated. The same data is copied in Settings.jsx:42, Onboarding.jsx:36 and quranSearchQuery.js:149 |
| client/src/data/pageAyahStarts.js | 53 | YES | Validated: 604 entries, strictly increasing, 0 mismatches |
| client/src/data/rubBoundaries.js | 44 | YES | Validated: identical to the structure data's rubBoundaries |
| client/src/data/surahPages.js | 130 | YES | `end` understates the last page for 46 surahs (CONFIRMED) |
| client/src/i18n.js | 23 | YES | localStorage detection; escapeValue false (React escapes) |
| client/index.html | 41 | YES | No CSP; og:url hard-coded |
| client/vite.config.js | 7 | YES | Default config |
| client/eslint.config.js | 38 | YES | Fine |
| client/postcss.config.js | 4 | YES | Fine |
| client/vercel.json | 13 | YES | SPA rewrite + font cache header only; no security headers |
| client/.env.example | 1 | YES | Only VITE_API_URL |
| client/.gitignore | 24 | YES | `.env` is ignored at the repo root; `.env.production` is not ignored |
| client/public/robots.txt | 2 | YES | Allow all; no sitemap |
| client/public/site.webmanifest | 27 | YES | Fine |
| client/public/mushaf-frame.svg | 46 | YES | Static vector, no scripts |
| client/src/index.css | 1110 | YES (3 chunks) | Google Fonts loaded by @import; a little dead CSS |
| client/src/locales/en.json / ar.json | 1222 / 1266 | Script | i18n-audit.cjs; output confirmed identical at HEAD |

## 2. Findings

Counts: Critical 0 · High 0 · Medium 5 · Low 14 · Info 7 (26 total).

### M1. No security headers on the deployed client
- **Severity:** Medium
- **Category:** Security / config
- **Confidence:** LIKELY
- **Evidence:** `client/vercel.json:5-12` has a single header block, `"source": "/fonts/(.*)"` → `Cache-Control`. There is no CSP, no `frame-ancestors` or X-Frame-Options, no Referrer-Policy, no Permissions-Policy and no X-Content-Type-Options. `index.html` has no CSP meta tag either.
- **Impact:** Clickjacking is possible on pages with destructive actions (delete account, reset progress). The JWT lives in localStorage (`api.js:10`), so any XSS (for example through a dependency) can read it, and there is no CSP to limit the damage. Vercel adds HSTS by default on its domains; check this on the custom domain.
- **Recommendation:** Add a `headers` block for `/(.*)` with:
  - `Content-Security-Policy`:
    - `default-src 'self'`
    - `script-src 'self'`
    - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
    - `font-src 'self' https://fonts.gstatic.com`
    - `connect-src 'self' <API origin> https://api.quran.com https://api.alquran.cloud https://cdn.jsdelivr.net https://newapi.hefzmoyaser.net https://everyayah.com https://cdn.islamic.network`
    - `media-src https://everyayah.com https://cdn.islamic.network`
    - `img-src 'self' data:`
    - `frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

  Run it as `Content-Security-Policy-Report-Only` first.
- **Effort:** S

### M2. SURAH_PAGES `end` misses the last page of 46 surahs
- **Severity:** Medium
- **Category:** Correctness
- **Confidence:** CONFIRMED (validate.mjs against `server/seed/data/quranStructure.json`)
- **Evidence:**
  - `surahPages.js:126`: `end: i + 1 < _raw.length ? Math.max(s.startPage, _raw[i + 1].startPage - 1) : 604`
  - Script output: `END surah 4 An-Nisa: SURAH_PAGES.end=105 actual last page=106`, and the same for surahs 10, 11, 13, 15, 17, 19, 24, 27 … 92 (46 surahs).
  - Consumers:
    - `Onboarding.jsx:197` and `Settings.jsx:168` (`toggleRange(s.start, s.end)`)
    - `Onboarding.jsx:177` and `Settings.jsx:233` (the "surah complete" counts)
    - `Progress.jsx:293` (surahStats)
    - `Library.jsx:4116` (hard-list surah labels)
- **Impact:** Selecting a surah in onboarding or settings never marks its final verses, which sit on the page shared with the next surah. Those verses then never enter review. Progress can call a surah complete when its ending is not memorised, and the hard list labels a shared page with only the second surah. This may be meant as a "shared page belongs to the next surah" rule, but hizb ranges use the opposite rule (they include shared pages at both ends). So the behaviour is inconsistent either way.
- **Recommendation:** Store the true last page (`lastPage`) separately from a "selection end". Use the verse-exact units endpoint for surah boundaries, as hizb and rub already do.
- **Effort:** M

### M3. Google Fonts loaded through a CSS @import chain
- **Severity:** Medium
- **Category:** Performance / Privacy
- **Confidence:** LIKELY
- **Evidence:** `index.css:1-2`: `@import url('https://fonts.googleapis.com/css2?family=Amiri…&family=Inter…')` and a second @import for Amiri Quran, Scheherazade New and Noto Sans Arabic (5 weights).
- **Impact:** The download chain becomes bundle CSS → Google CSS → gstatic fonts, which blocks rendering and puts the 3 s target (NFR-01) at risk on mobile. Every visitor's IP and user agent go to Google on every page. A German court ruled in 2022 (LG München) that this needs consent under GDPR.
- **Recommendation:** Self-host the fonts (as the QCF fonts already are), subset them, keep only the weights actually used, and preload the UI font.
- **Effort:** M

### M4. Tafsir CDN pinned to a moving branch of a third-party repo
- **Severity:** Medium
- **Category:** Supply chain / content integrity
- **Confidence:** LIKELY
- **Evidence:** `quranApi.js:6`: `const TAFSIR_CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';`
- **Impact:** Anyone who can push to spa5k/tafsir_api can change the religious commentary shown for 7 of the 9 editions, or break it by renaming or deleting files. The text is rendered as text, so this is not an XSS risk; it is an integrity and availability risk.
- **Recommendation:** Pin to a commit SHA (`@<sha>`), or mirror the editions you use into your own storage.
- **Effort:** S

### M5. (Outside my scope, found while tracing the 401 flow) AuthContext logs the user out on any `/auth/me` failure
- **Severity:** Medium
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:** `context/AuthContext.jsx:47-50`: `} catch (err) { console.log(err); localStorage.removeItem('token'); setUser(null);`
- **Impact:** A network error, a 5xx or a slow cold start of the backend deletes a valid session. The api.js interceptor already removes the token on a real 401.
- **Recommendation:** Remove the token only when `err.response?.status === 401`; otherwise keep it and show a retry.
- **Effort:** S

### L1. No timeout or abort on any fetch or axios call
- **Severity:** Low
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:**
  - fetch calls with no `AbortSignal`: `mushafApi.js:248`, `quranApi.js:251`, `quranApi.js:304`, `quranApi.js:320`, `dailyVerse.js:79`, `verseEdges.js:131`, `verseEdges.js:143`
  - `api.js:4` `axios.create({ baseURL })` has no timeout.
  - The deduplication maps keep the promise: `mushafApi.js:394`, `mushafApi.js:445`.
- **Impact:** If a host stalls, the page spins until the browser's own timeout. Every later request for the same page shares the hung promise, so it never retries in the meantime.
- **Recommendation:** Use `AbortSignal.timeout(10–15 s)` on fetch, set an axios `timeout`, and give the user a retry.
- **Effort:** S

### L2. Pasting Uthmani text into search often finds nothing, contrary to the module's comment
- **Severity:** Low
- **Category:** Correctness / UX
- **Confidence:** CONFIRMED
- **Evidence:** `quranSearchQuery.js:5-7` says a query "pasted from a mushaf" meets the text on the same letters. Script results (occurrences found):

  | Query | Tokens | Hits |
  |---|---|---|
  | `يَٰٓأَيُّهَا` | يايها | 0 |
  | `يا أيها` | | 142 |
  | `إِبْرَٰهِـۧمَ` | | 0 |
  | `ابراهيم` | | 62 |
  | `الْقُرْءَانُ` | | 0 |
  | `القرآن` | | 43 |
  | `مَسْـُٔولًا` | مسولا | 0 |
  | `مسؤولا` | | 4 |

  The index uses imla'i spelling. MARKS (`:38`, U+064B–065F) removes the hamza that sits on a tatweel, although the comment says the hamza is never dropped.
- **Impact:** Text copied from Uthmani sources, including the app's own tafsir preview (`text_uthmani`), often finds nothing.
- **Recommendation:** Map hamza-on-tatweel (ـٔ) to ء before stripping marks, map dagger alef to ا inside words (رحمٰن-type cases need care), and split the vocative يٰٓ prefix. Alternatively, index a second Uthmani-normalised token stream. Fix the comment.
- **Effort:** M

### L3. Quadratic regex in `splitChatLinks`
- **Severity:** Low
- **Category:** Performance / DoS (affects only the user's own browser)
- **Confidence:** CONFIRMED
- **Evidence:** `chatLinks.js:47`: `/\*\*(\[[^\]\n]+\]\([^)\s]+\))\*\*/g`. Time to run on `'**['` repeated: 4 KB 6 ms, 16 KB 83 ms, 64 KB 1.28 s, 300 KB 19.9 s. The server sets no `max_tokens` on chat replies.
- **Impact:** A long or adversarial model reply freezes the tab.
- **Recommendation:** Bound the label, `{1,80}` like LINK_RE, and the target, `{1,200}`.
- **Effort:** S

### L4. Unbounded in-memory caches
- **Severity:** Low
- **Category:** Performance
- **Confidence:** LIKELY
- **Evidence:** `quranApi.js:258` pageTextCache, `quranApi.js:267` tafsirPageCache, `quranApi.js:299` tafsirAyahCache, `quranApi.js:311` hefzCache are plain Maps with no cap. Single tafsir entries reach 20–32 K characters (the module's own notes), and `findTafsirRun` probes up to 24 neighbours per ayah.
- **Impact:** Memory grows through a long study session.
- **Recommendation:** Reuse the `lruSet` helper from mushafApi, with a cap of roughly 300 entries.
- **Effort:** S

### L5. `fetchAyahTafsir` caches `undefined`
- **Severity:** Low
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:** `quranApi.js:307`: `tafsirAyahCache.set(key, data.text);` with no check that `data.text` is a string.
- **Impact:** An unexpected payload pins an empty panel for that ayah for the whole session.
- **Recommendation:** Throw on a non-string value, as the hefz path does at `:324`.
- **Effort:** S

### L6. A neighbour-page failure fails the current page
- **Severity:** Low
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:** `mushafApi.js:440` `const nextSpill = await computeNextSpill(page, verses);` awaits `fetchVersesCached(page + 1)` (`:414`) with no try/catch.
- **Impact:** On pages followed by a surah opening, the reader cannot show a page it already has when page+1 fails to load.
- **Recommendation:** Catch the failure, fall back to `null` (no spill), and do not cache the shaped page so it is rebuilt later.
- **Effort:** S

### L7. Production build silently falls back to localhost
- **Severity:** Low
- **Category:** Config
- **Confidence:** LIKELY
- **Evidence:** `api.js:5`: `baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'`
- **Impact:** If the variable is missing on Vercel, the deployed app calls the visitor's own localhost. That is mixed content, triggers Private Network Access prompts and breaks login.
- **Recommendation:** Use the fallback only when `import.meta.env.DEV`. Fail the build in vite.config when the variable is unset in production mode.
- **Effort:** S

### L8. Daily verse cache issues
- **Severity:** Low
- **Category:** Correctness / storage
- **Confidence:** LIKELY
- **Evidence:** `dailyVerse.js:47` picks the verse by the local day of year, but `:50` keys the cache by the UTC date (`toISOString().split('T')[0]`). The `dailyVerse:<date>:<lang>` keys are never removed.
- **Impact:** The verse changes at UTC midnight instead of local midnight; for a UTC+3 user that is 03:00 local time. localStorage grows by about 2 entries a day, forever.
- **Recommendation:** Use one local-date helper for both, and delete older `dailyVerse:` keys on write.
- **Effort:** S

### L9. 28 count strings have no plural forms
- **Severity:** Low
- **Category:** i18n
- **Confidence:** CONFIRMED (script)
- **Evidence:** `dashboard.reviewCount` is `"{{count}} pages"` in English and `"{{count}} صفحة"` in Arabic, with no `_one` or `_other` variants. Full list in section 4.
- **Impact:** English shows "1 pages". Arabic is wrong for 3–10 (it should be صفحات) and for the dual.
- **Recommendation:** Add `_one`/`_other` in English and `_zero/_one/_two/_few/_many/_other` in Arabic, as the 11 plural bases that already exist do.
- **Effort:** M

### L10. localStorage access in the auth path is not guarded
- **Severity:** Low
- **Category:** Reliability
- **Confidence:** LIKELY
- **Evidence:** `api.js:10` `localStorage.getItem('token')` and `api.js:32` `removeItem`; `AuthContext.jsx:23,36` are unguarded too. Every service in scope does wrap its storage access.
- **Impact:** When site data is blocked, `localStorage` throws a SecurityError, so every API call rejects before it is sent.
- **Recommendation:** Add a small `safeStorage` helper.
- **Effort:** S

### L11. `htmlFragmentToText` drops text and runs in quadratic time
- **Severity:** Low
- **Category:** Robustness
- **Confidence:** CONFIRMED
- **Evidence:** `quranApi.js:293` uses `/<[^>]*>/g`.
  - `"1 <2 and 3> 4"` becomes `"1  4"`, so text between a stray `<` and `>` is deleted.
  - 32 000 `<` characters take 812 ms; 100 000 take 9.3 s.
  - Numeric entities such as `&#1575;` are not decoded.
- **Impact:** Only occurs if upstream content is hostile or malformed. Rendering stays text-only, so it is safe from XSS.
- **Recommendation:** Use `DOMParser` (`parseFromString(html,'text/html').body`) with explicit handling of `br` and `p`.
- **Effort:** S

### L12. Generated data tables have no generator script or drift check, and juz data is copied 3 more times
- **Severity:** Low
- **Category:** Maintainability
- **Confidence:** CONFIRMED
- **Evidence:**
  - Headers say "Generated once from server/seed/data/quranStructure.json", but no script exists. A grep of server/ for pageAyahStarts, hizbRanges, surahPages and rubBoundaries finds nothing.
  - The juz table is defined again at `Settings.jsx:42` and `Onboarding.jsx:36`, and as JUZ_START at `quranSearchQuery.js:149`.
  - The server re-derives the same data at runtime (`server/utils/segments.js:33`).
- **Impact:** All tables match today (validated), but regenerating the structure file would not update the client tables, and nothing would catch the drift.
- **Recommendation:** Commit a generator script and add a server `node --test` case that imports the client tables and compares them with the structure data. Import JUZ_RANGES everywhere instead of copying it.
- **Effort:** M

### L13. SPA rewrite plus the font cache header can cache HTML as a font
- **Severity:** Low
- **Category:** Config / caching
- **Confidence:** SUSPECTED
- **Evidence:** In `vercel.json`, the catch-all `/(.*)` rewrite to `/index.html` combines with the `/fonts/(.*)` `immutable, max-age=31536000` header. A missing font path returns 200 with index.html, under a one-year immutable cache. A stale `/assets/*.js` chunk after a deploy also gets HTML.
- **Impact:** A single bad font URL would serve HTML for a year from the cache, and stale chunks fail with confusing MIME errors.
- **Recommendation:** Limit the rewrite to non-file paths (for example `"/((?!assets/|fonts/|data/).*)"`).
- **Effort:** S

### L14. Hard-coded English accessibility labels
- **Severity:** Low
- **Category:** i18n / a11y
- **Confidence:** CONFIRMED
- **Evidence:** `MushafDrawLayer.jsx:337` `aria-label="Delete note"` and `:361` `aria-label="Save note"`; `AuthContext.jsx:76,96` fallbacks `'Registration failed'` and `'Login failed'`.
- **Recommendation:** Route these through `t()`.
- **Effort:** S

### I1. Dead exports
- **Severity:** Info
- **Category:** Maintainability
- **Confidence:** CONFIRMED (grep)
- **Evidence:** Never used anywhere, including their own file: `quranApi.fetchPageText` (and its pageTextCache), `quranApi.splitBasmala`, `shortcutKeys.shortcutValue`, `timerCore.planTotal`, `unitRanges.unitOrdRange`, `verseIndex.clampOrd`. A further 20 exports are used only inside their own file (for example DEFAULT_RECITER, buildSearchEngine, createTodoStore, safeAppPath).
- **Recommendation:** Delete the six, or keep them only if frontend tests will use them.
- **Effort:** S

### I2. Dead CSS
- **Severity:** Info
- **Category:** Maintainability
- **Confidence:** CONFIRMED
- **Evidence:** `.mushaf-surah-name` (`index.css:96`) and `.mushaf-basmala` (`:89`) are unused; MushafPage uses `mushaf-basmala-glyph`. Every other selector is used, some through classes built at runtime (`is-hl-${c}`, `mushaf-stroke--${c}`) or by driver.js.
- **Effort:** S

### I3. `.env.production` is not ignored
- **Severity:** Info
- **Category:** Config
- **Evidence:** The root `.gitignore` lists only `.env` and `.env.local`, and `git check-ignore client/.env.production` matches nothing. VITE_ variables are public anyway.
- **Recommendation:** Add `.env.*` with an exception `!.env.example`.

### I4. Timer edge cases
- **Severity:** Info
- **Category:** Correctness
- **Evidence:**
  - Wall-clock maths (`timerCore.js:14`): a system clock change shifts elapsed time.
  - Without Web Locks (`timerStore.js:119`), every tab claims the chime, so older Safari can chime twice. The stored `announced` count reduces this.
- **Impact:** Acceptable and documented in the code.

### I5. A guest's to-do list is never moved into the account
- **Severity:** Info
- **Category:** UX
- **Evidence:** `todoBackends.js:15-17` says a local list "can later be imported", but `useTodos.js:21` just switches backends. The guest list stays in localStorage and reappears after sign-out.
- **Recommendation:** Offer an import when the user signs in.

### I6. Hard-coded production origin in index.html
- **Severity:** Info
- **Evidence:** `index.html:25-35` hard-codes `quran-tracker-gilt.vercel.app` in og:url and the images. `robots.txt` has no sitemap.

### I7. Cache headers for /assets and the search index are not set explicitly
- **Severity:** Info
- **Confidence:** SUSPECTED
- **Evidence:** `vercel.json` sets no header for `/assets/*` (hashed, should be immutable) or `/data/search-index.json` (1.3 MB, about 260 KB compressed). Behaviour depends on Vercel's defaults.
- **Recommendation:** Set `/assets/(.*)` to immutable and the index to `max-age=86400, stale-while-revalidate`.

### Checked and found sound (not findings)
- **returnTo.js:** open-redirect safe. Results from the script:

  | Input | safeReturnTo | safeAppPath |
  |---|---|---|
  | `https://evil.com` | null | null |
  | `//evil.com` | null | null |
  | `/\evil.com` (real backslash) | null | null |
  | `\\evil.com` | null | null |
  | `/%2F%2Fevil.com` | `/%2F%2Fevil.com` | null |
  | `javascript:alert(1)` | null | null |
  | `  //evil.com` | null | null |
  | `/\t/evil.com` | null | null |
  | `/\n/evil.com` | null | null |
  | `/./login`, `/x/../login`, `/%2e%2e/login` | null | null |
  | `/dashboard` | `/dashboard` | `/dashboard` |

  `/%2F%2Fevil.com` is still same-origin: it resolves to `https://<origin>/%2F%2Fevil.com`, a 404 route. `/LOGIN` is accepted but harmless.
- **chatLinks.js:** `[x](javascript:alert(1))` renders as plain text, `//evil.com` is dropped, `/library?page=9999` stays text and query parameters are allow-listed. A cosmetic stray ")" is left behind.
- **No HTML injection:** there is no `dangerouslySetInnerHTML` or `innerHTML` anywhere in client/src.
- **401 interceptor:** it does not redirect a visitor with no token, and the startup `/auth/me` check never redirects. Logged-out visitors on public pages cannot trigger it. A wrong current password returns 400 from the server, so it never logs the user out.
- **Search query parsing:** there is no RegExp built from user input. Worst case is about 117 ms on 200 K-character input, which is linear. Search engine build takes 137 ms in Node (77 800 tokens, 14 634 vocabulary words), and each search takes 0.4–5 ms.
- **Data tables:** PAGE_FIRST_AYAH, RUB_BOUNDARIES, HIZB_RANGES, RUB_RANGES, JUZ_RANGES and the ayah counts (6236 total) all match the structure JSON exactly.

## 3. Catch-block classification

| Site | Class | Note |
|---|---|---|
| chime.js:22 `new AC()` | INTENTIONAL | No audio support; returns null |
| chime.js:24, 51 `resume().catch(()=>{})` | INTENTIONAL | Autoplay refusal; `playChime` reports via its return value |
| dailyVerse.js:56, 64 | INTENTIONAL | Storage optional; the fetch error still propagates to the caller's fallback |
| mushafApi.js:83 `.catch(()=>false)` | INTENTIONAL | The caller checks the boolean. The fallback font then shows PUA "tofu" |
| mushafApi.js:395 | INTENTIONAL | Evicts the failed promise so the next request retries |
| pagePrefetch.js:98 | INTENTIONAL | 30 s back-off |
| quranApi.js:335 (hefz → spa5k) | INTENTIONAL | Fallback source |
| quranApi.js:365 (sameAs) | INTENTIONAL | Stops the run probe |
| quranSearch.js:117 | INTENTIONAL | Resets state, rethrows |
| recentPages.js:56, 68 | INTENTIONAL | Documented |
| timerStore.js:46, 49, 52 | INTENTIONAL | Documented |
| timerStore.js:123 (locks) | INTENTIONAL | Fails open (claims); the stored count is the guard |
| todoBackends.js:56 | INTENTIONAL | Rethrows with `code` |
| todoBackends.js:80 | INTENTIONAL | Corrupt storage becomes an empty list. The bad value is overwritten on the next write, which loses it |
| todoBackends.js:87 | INTENTIONAL | Turned into a `STORAGE` error |
| todoStore.js:63 | INTENTIONAL | Rejects waiters, rolls back |
| todoStore.js:74, 132, 134 `sync().catch(()=>{})` | SWALLOWED (benign) | Only the first load sets status `error`; later refresh failures are silent and leave stale data |
| verseEdges.js:202 | INTENTIONAL | null means "unknown edge" |
| chatLinks.js:29, returnTo.js:12 | INTENTIONAL | Invalid URL becomes null |
| Outside scope: AuthContext.jsx:47 | SWALLOWED (harmful) | See M5 |
| Outside scope: AuthContext.jsx:26 `updateProfile(...).catch(()=>{})` | SWALLOWED (benign) | Language sync |

## 4. i18n report

Script `i18n-audit.cjs`. Its output (`i18n-out.txt`) was re-run at HEAD and is byte-identical.
- **Key counts:** EN 1077 keys, AR 1121 (the extra are Arabic plural forms).
- **Key diff:** nothing missing in either file once plural forms are accounted for; no type mismatches; no empty values.
- **Arabic identical to English (5):** `auth.emailPlaceholder`, `library.search.esc`, `library.search.verseRef`, `library.recent.chip`, `timer.notifyTitle`. All acceptable.
- **Interpolation differences (6):** `_one` forms in Arabic omit `{{n}}`: `library.search.occurrences_one`, `inVerses_one`, `inThisVerse_one`, `showMore_one`, `library.span.verses_one`, `timer.presetLabel_one`. This is correct Arabic, not a bug.
- **Plurals:** 11 plural bases. All Arabic plural sets are complete (zero/one/two/few/many/other).
- **`{{count}}` without plural forms (28):**
  - dashboard: hardChip, showAll, reviewCount, pagesCount, pagesCountPlural
  - progress: pagesCount, pagesRemaining, achievementsEarned, juzComplete, dayStreak, earnedSection, lockedSection, partialCount, editHint, atPace, atPaceDays
  - settings: intensityEstimate, juzSelected, pagesSelected, preservedNote
  - onboarding: juzSelected, totalSelected, totalSelectedWithJuz, surahsSelected, hizbSelected, quarterHizbSelected
  - library.pagesMemorizedStat
  - landing.features.planAyahs
- **Dynamic key patterns (12):** `chatbot.suggestions.${key}`, `library.history.what.${step.what}`, `library.marks.${m.tip.k}`, `library.recent.ago.${unit}`, `library.reciters.style.${style}`, `library.selfTest.hint.${concealMode|selfTest}`, `library.selfTest.mode.${m}`, `onboarding.dayName${d}`, `timer.indicator.${which}`, `timer.mode.${m}`, `timer.phase.${kind}`. There are also variable keys: `t(link.labelKey)`, `t(titleKey)`/`t(bodyKey)` in the tours, `t(messageKey)`. Their values are quoted literals, so the literal scan covers them.
- **Unused keys (52):** no quoted literal and no matching dynamic prefix.
  - nav: language
  - dashboard: noTasks, restDayLabel, reviewLabel, pagesCount, pagesCountPlural, listenToPage, fmtPageRange
  - progress: activity, loading, surahProgress, editMyPages
  - settings: dailyGoal, memorizationPlan, reviewIntensity, reviewIntensityDesc, selectByJuz, addPageRanges, optional, reviewLimitsTitle, reviewLimitsDesc, cycleReviewAutoHint, autoLabel, customLabel, basedOnDailyPages, basedOnIntensity, modeIntensity, orDivider, clearSelection, selectAll, preservedNote, cycleStartSurah, healthLegendTitle, healthFresh, healthGood, healthDue, healthOverdue, healthNotMem, syncTabNote
  - onboarding: selectByJuz, totalSelected, totalSelectedWithJuz, estimateText
  - tooltips: prevPage, nextPage
  - library: subtitle, draw.showTools, play, prevAyah, nextAyah, playFromHere, sidebar.label
- **Keys used in `t('…')` but missing from en.json:** 0.
- **Hard-coded user-visible strings:**
  - `Logo.jsx:23` "Quran Tracker": brand name, acceptable
  - `MushafDrawLayer.jsx:337` aria-label "Delete note" and `:361` "Save note": should be translated
  - `VerseSearch.jsx:458-459` "Del"/"Esc": key-cap labels, acceptable
  - `AuthContext.jsx:76,96` English error fallbacks: should be translated

## 5. Lint result

`npm run lint` (`eslint .`) in client/ exited 0 with no warnings or errors, and the working tree was unchanged afterwards.

## 6. External hosts (browser)

| Host | When | What it learns |
|---|---|---|
| fonts.googleapis.com / fonts.gstatic.com | Every page load (index.css @import) | IP address, user agent; that the user visited the site |
| api.quran.com | Each mushaf page read or prefetched (data for ±2 turns) | IP, origin (Referer under the default policy), exact pages read |
| api.alquran.cloud | Dashboard daily verse; page-based tafsir (muyassar, jalalayn) | IP, UI language, page being studied |
| cdn.islamic.network | Recitation audio (`<audio>` + HEAD warm-up) | IP, reciter, every ayah listened to |
| everyayah.com | Recitation for 20 reciters, fallback audio, and the verseEdges Range/HEAD probes (about 28 KB per verse) | IP, reciter, ayahs listened to |
| cdn.jsdelivr.net (gh/spa5k/tafsir_api@main) | Ayah tafsir, plus up to 24 neighbour probes | IP, tafsir edition, ayah being studied |
| newapi.hefzmoyaser.net | Aysar tafsir (rate limit 180 requests/min) | IP, ayah being studied |
| VITE_API_URL backend | Signed-in calls; the bearer token is sent only to this host | Account data |
| (Groq) | Called by the server only, never by the browser | — |

None of these is disclosed in a privacy notice. I did not see one in scope; worth checking.

## 7. Strengths

- No `innerHTML` or `dangerouslySetInnerHTML` anywhere. Third-party HTML is converted to text, and chat links pass a strict allow-list.
- `returnTo` and `chatLinks` resist every open-redirect payload I tried.
- Every service validates what it reads from localStorage (recentPages, timerStore, todoBackends) and wraps storage access. The 401 interceptor is designed so public pages stay public.
- The prefetcher respects data limits: it does nothing with saveData, prefetches one turn on 2g, runs at most 2 parallel tasks (1 while audio plays) and backs off failed tasks. mushafApi has LRU caps on page data and font faces, including document.fonts.
- The timer is correct across tabs: Web Locks, a stored claim count, wall-clock maths and lifecycle wake handlers.
- The to-do store uses an optimistic queue with exact rollback, temporary-id mapping, coalesced reorders and stable React keys.
- The data tables match the server's structure data exactly, except for the semantics of SURAH_PAGES.end. Unusually detailed comments explain why each choice was made.
- Lint is clean.

## False-positive pass

- M2 may be an intended "shared page goes to the later surah" rule. It stays Medium because it is inconsistent with hizb/rub handling and leaves surah endings out of memorisation.
- M1: Vercel already adds HSTS on its domains, so I did not claim it was missing.
- L3 and L11 need hostile input (from the model or the upstream site) and affect only the user's own tab, so they are Low.
- L13 and I7 depend on Vercel's runtime defaults, so they are SUSPECTED.
- I dropped "token in localStorage" as a separate finding (it is folded into M1) and the Arabic `_one` interpolation differences (correct Arabic).
