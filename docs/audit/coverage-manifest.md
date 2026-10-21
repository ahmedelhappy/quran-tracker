# Appendix A — Coverage manifest

Generated from `git ls-files` at `fcb6d4e` (792 tracked files). "Read in full" means every line was read by the lead auditor or by an area auditor whose file-level notes were merged; Library.jsx was read twice, in two overlapping halves (1–3200, 3150–6245).

**By class:** config 13 · docs 14 · design mockup 8 · binary (image) 15 · application code 119 · lockfile 2 · generated data 3 · binary (font) 606 · i18n data 2 · tests 10

**Application code:** 119 files, all read in full (YES). Nothing in the application-code class was skipped.

**Not read line by line, by design:** the 606 font binaries, images, the two lockfiles, the three generated JSON datasets (shape, generator and validation audited instead), the two tracked AI-session transcripts (secret / PII scan only), the Stitch design mockups (not deployed), and the long tail of docs/ (read for claims that contradict code).

| File | Class | Bytes | Lines | Read in full | Note |
|---|---|---|---|---|---|
| `.gitignore` | config | 313 | 24 | YES | .env ignored; .env.* variants are not |
| `2026-04-25-011528-command-messageinitcommand-message.txt` | docs | 36,165 | 522 | secret/PII scan only | Tracked AI-session transcript (contains the owner's email); scanned for secrets — none |
| `2026-04-25-083227-command-messageinitcommand-message.txt` | docs | 760,452 | 11341 | secret/PII scan only | Tracked AI-session transcript, 760 KB; scanned for secrets — none |
| `CLAUDE.md` | docs | 9,969 | 170 | YES | Read in full; several statements stale (3 route groups, "3 oldest-reviewed pages") |
| `README.md` | docs | 640 | 35 | YES |  |
| `client/.env.example` | config | 39 | 2 | YES | VITE_API_URL only |
| `client/.gitignore` | config | 253 | 25 | YES |  |
| `client/README.md` | docs | 1,157 | 17 | YES |  |
| `client/design/stitch_quran_memorization_tracker/dashboard_off_day_v4/code.html` | design mockup | 17,644 | 248 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/dashboard_off_day_v4/screen.png` | binary (image) | 245,610 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/dashboard_v3_patterned_background/code.html` | design mockup | 20,181 | 293 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/dashboard_v3_patterned_background/screen.png` | binary (image) | 247,507 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/landing_page_v4_patterned_background/code.html` | design mockup | 14,796 | 244 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/landing_page_v4_patterned_background/screen.png` | binary (image) | 610,970 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/login_page_v3_patterned_background/code.html` | design mockup | 10,458 | 176 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/login_page_v3_patterned_background/screen.png` | binary (image) | 105,704 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/onboarding_step_2_v3_patterned_background/code.html` | design mockup | 19,474 | 240 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/onboarding_step_2_v3_patterned_background/screen.png` | binary (image) | 241,490 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/quran_tracker_design_system/DESIGN.md` | design mockup | 8,316 | 192 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/register_page_v3_patterned_background/code.html` | design mockup | 12,767 | 198 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/register_page_v3_patterned_background/screen.png` | binary (image) | 362,838 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/settings_v4_plan_adjustment/code.html` | design mockup | 19,924 | 325 | skimmed — not deployed (outside public/); loads cdn.tailwindcss.com | Stitch design export |
| `client/design/stitch_quran_memorization_tracker/settings_v4_plan_adjustment/screen.png` | binary (image) | 630,706 | — | n/a (binary) — generation, serving, size and licence audited | Stitch design export |
| `client/eslint.config.js` | config | 1,314 | 39 | YES |  |
| `client/index.html` | application code | 2,686 | 42 | YES | No CSP; hard-coded og:url origin |
| `client/package-lock.json` | lockfile | 221,259 | 6232 | n/a — npm audit / npm outdated run against it |  |
| `client/package.json` | config | 1,055 | 41 | YES | Deps current-ish; 20 audit advisories (mostly dev-only) |
| `client/postcss.config.js` | config | 72 | 5 | YES |  |
| `client/public/apple-touch-icon.png` | binary (image) | 1,384 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/data/search-index.json` | generated data | 1,325,009 | 6239 | no (by design) — shape, generator and validation audited | 1.3 MB full-text derived dataset from quran.com; licensing risk; no test |
| `client/public/favicon-32.png` | binary (image) | 371 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/favicon.svg` | binary (image) | 487 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/fonts/qcf/v1/p1.woff2` | binary (font) | 15,328 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p10.woff2` | binary (font) | 78,420 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p100.woff2` | binary (font) | 85,088 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p101.woff2` | binary (font) | 82,316 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p102.woff2` | binary (font) | 82,488 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p103.woff2` | binary (font) | 84,548 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p104.woff2` | binary (font) | 80,356 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p105.woff2` | binary (font) | 79,424 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p106.woff2` | binary (font) | 76,516 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p107.woff2` | binary (font) | 87,084 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p108.woff2` | binary (font) | 78,332 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p109.woff2` | binary (font) | 75,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p11.woff2` | binary (font) | 80,692 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p110.woff2` | binary (font) | 70,396 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p111.woff2` | binary (font) | 81,808 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p112.woff2` | binary (font) | 80,048 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p113.woff2` | binary (font) | 76,312 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p114.woff2` | binary (font) | 78,292 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p115.woff2` | binary (font) | 77,796 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p116.woff2` | binary (font) | 83,056 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p117.woff2` | binary (font) | 91,032 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p118.woff2` | binary (font) | 88,608 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p119.woff2` | binary (font) | 81,744 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p12.woff2` | binary (font) | 75,224 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p120.woff2` | binary (font) | 66,488 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p121.woff2` | binary (font) | 72,232 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p122.woff2` | binary (font) | 82,612 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p123.woff2` | binary (font) | 88,104 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p124.woff2` | binary (font) | 82,696 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p125.woff2` | binary (font) | 84,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p126.woff2` | binary (font) | 79,868 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p127.woff2` | binary (font) | 86,040 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p128.woff2` | binary (font) | 73,740 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p129.woff2` | binary (font) | 78,268 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p13.woff2` | binary (font) | 77,880 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p130.woff2` | binary (font) | 90,900 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p131.woff2` | binary (font) | 85,624 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p132.woff2` | binary (font) | 84,988 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p133.woff2` | binary (font) | 83,208 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p134.woff2` | binary (font) | 82,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p135.woff2` | binary (font) | 86,492 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p136.woff2` | binary (font) | 79,416 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p137.woff2` | binary (font) | 80,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p138.woff2` | binary (font) | 81,832 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p139.woff2` | binary (font) | 87,184 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p14.woff2` | binary (font) | 74,740 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p140.woff2` | binary (font) | 85,472 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p141.woff2` | binary (font) | 84,188 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p142.woff2` | binary (font) | 84,036 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p143.woff2` | binary (font) | 81,288 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p144.woff2` | binary (font) | 82,324 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p145.woff2` | binary (font) | 70,184 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p146.woff2` | binary (font) | 78,696 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p147.woff2` | binary (font) | 78,636 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p148.woff2` | binary (font) | 80,332 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p149.woff2` | binary (font) | 81,196 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p15.woff2` | binary (font) | 74,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p150.woff2` | binary (font) | 87,520 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p151.woff2` | binary (font) | 71,796 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p152.woff2` | binary (font) | 85,348 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p153.woff2` | binary (font) | 84,388 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p154.woff2` | binary (font) | 88,024 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p155.woff2` | binary (font) | 82,532 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p156.woff2` | binary (font) | 84,056 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p157.woff2` | binary (font) | 82,644 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p158.woff2` | binary (font) | 82,016 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p159.woff2` | binary (font) | 77,912 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p16.woff2` | binary (font) | 74,280 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p160.woff2` | binary (font) | 74,960 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p161.woff2` | binary (font) | 75,376 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p162.woff2` | binary (font) | 84,180 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p163.woff2` | binary (font) | 78,816 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p164.woff2` | binary (font) | 79,832 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p165.woff2` | binary (font) | 81,120 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p166.woff2` | binary (font) | 79,044 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p167.woff2` | binary (font) | 78,484 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p168.woff2` | binary (font) | 79,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p169.woff2` | binary (font) | 82,944 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p17.woff2` | binary (font) | 76,388 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p170.woff2` | binary (font) | 79,276 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p171.woff2` | binary (font) | 74,176 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p172.woff2` | binary (font) | 83,628 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p173.woff2` | binary (font) | 84,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p174.woff2` | binary (font) | 87,772 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p175.woff2` | binary (font) | 78,684 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p176.woff2` | binary (font) | 82,160 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p177.woff2` | binary (font) | 73,404 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p178.woff2` | binary (font) | 81,144 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p179.woff2` | binary (font) | 80,152 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p18.woff2` | binary (font) | 78,576 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p180.woff2` | binary (font) | 80,236 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p181.woff2` | binary (font) | 77,128 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p182.woff2` | binary (font) | 79,692 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p183.woff2` | binary (font) | 78,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p184.woff2` | binary (font) | 81,660 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p185.woff2` | binary (font) | 83,356 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p186.woff2` | binary (font) | 85,404 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p187.woff2` | binary (font) | 80,964 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p188.woff2` | binary (font) | 77,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p189.woff2` | binary (font) | 81,848 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p19.woff2` | binary (font) | 82,864 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p190.woff2` | binary (font) | 78,972 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p191.woff2` | binary (font) | 74,864 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p192.woff2` | binary (font) | 77,900 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p193.woff2` | binary (font) | 75,968 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p194.woff2` | binary (font) | 78,560 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p195.woff2` | binary (font) | 75,720 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p196.woff2` | binary (font) | 83,284 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p197.woff2` | binary (font) | 78,020 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p198.woff2` | binary (font) | 81,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p199.woff2` | binary (font) | 80,108 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p2.woff2` | binary (font) | 29,920 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p20.woff2` | binary (font) | 78,436 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p200.woff2` | binary (font) | 84,220 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p201.woff2` | binary (font) | 79,772 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p202.woff2` | binary (font) | 80,756 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p203.woff2` | binary (font) | 82,908 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p204.woff2` | binary (font) | 79,212 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p205.woff2` | binary (font) | 76,360 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p206.woff2` | binary (font) | 80,840 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p207.woff2` | binary (font) | 72,972 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p208.woff2` | binary (font) | 76,120 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p209.woff2` | binary (font) | 80,376 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p21.woff2` | binary (font) | 77,224 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p210.woff2` | binary (font) | 79,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p211.woff2` | binary (font) | 85,380 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p212.woff2` | binary (font) | 88,564 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p213.woff2` | binary (font) | 88,452 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p214.woff2` | binary (font) | 85,664 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p215.woff2` | binary (font) | 82,788 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p216.woff2` | binary (font) | 76,356 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p217.woff2` | binary (font) | 85,184 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p218.woff2` | binary (font) | 82,736 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p219.woff2` | binary (font) | 81,268 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p22.woff2` | binary (font) | 78,872 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p220.woff2` | binary (font) | 82,772 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p221.woff2` | binary (font) | 76,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p222.woff2` | binary (font) | 81,180 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p223.woff2` | binary (font) | 82,196 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p224.woff2` | binary (font) | 81,808 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p225.woff2` | binary (font) | 83,916 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p226.woff2` | binary (font) | 80,540 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p227.woff2` | binary (font) | 81,148 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p228.woff2` | binary (font) | 88,448 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p229.woff2` | binary (font) | 78,908 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p23.woff2` | binary (font) | 78,704 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p230.woff2` | binary (font) | 86,276 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p231.woff2` | binary (font) | 77,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p232.woff2` | binary (font) | 79,524 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p233.woff2` | binary (font) | 83,080 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p234.woff2` | binary (font) | 81,296 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p235.woff2` | binary (font) | 73,000 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p236.woff2` | binary (font) | 81,936 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p237.woff2` | binary (font) | 79,228 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p238.woff2` | binary (font) | 78,628 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p239.woff2` | binary (font) | 87,432 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p24.woff2` | binary (font) | 78,408 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p240.woff2` | binary (font) | 80,940 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p241.woff2` | binary (font) | 83,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p242.woff2` | binary (font) | 83,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p243.woff2` | binary (font) | 81,340 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p244.woff2` | binary (font) | 80,724 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p245.woff2` | binary (font) | 79,208 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p246.woff2` | binary (font) | 78,260 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p247.woff2` | binary (font) | 82,588 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p248.woff2` | binary (font) | 81,996 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p249.woff2` | binary (font) | 76,368 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p25.woff2` | binary (font) | 74,764 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p250.woff2` | binary (font) | 80,828 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p251.woff2` | binary (font) | 91,520 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p252.woff2` | binary (font) | 90,688 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p253.woff2` | binary (font) | 87,260 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p254.woff2` | binary (font) | 86,348 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p255.woff2` | binary (font) | 67,140 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p256.woff2` | binary (font) | 80,836 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p257.woff2` | binary (font) | 78,440 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p258.woff2` | binary (font) | 80,340 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p259.woff2` | binary (font) | 80,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p26.woff2` | binary (font) | 76,664 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p260.woff2` | binary (font) | 80,808 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p261.woff2` | binary (font) | 79,796 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p262.woff2` | binary (font) | 72,332 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p263.woff2` | binary (font) | 80,772 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p264.woff2` | binary (font) | 78,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p265.woff2` | binary (font) | 79,964 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p266.woff2` | binary (font) | 80,348 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p267.woff2` | binary (font) | 71,512 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p268.woff2` | binary (font) | 77,812 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p269.woff2` | binary (font) | 80,168 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p27.woff2` | binary (font) | 82,660 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p270.woff2` | binary (font) | 85,252 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p271.woff2` | binary (font) | 81,400 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p272.woff2` | binary (font) | 87,644 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p273.woff2` | binary (font) | 86,292 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p274.woff2` | binary (font) | 86,392 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p275.woff2` | binary (font) | 81,356 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p276.woff2` | binary (font) | 78,916 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p277.woff2` | binary (font) | 78,412 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p278.woff2` | binary (font) | 78,516 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p279.woff2` | binary (font) | 75,504 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p28.woff2` | binary (font) | 74,252 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p280.woff2` | binary (font) | 80,048 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p281.woff2` | binary (font) | 80,160 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p282.woff2` | binary (font) | 69,596 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p283.woff2` | binary (font) | 85,344 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p284.woff2` | binary (font) | 82,900 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p285.woff2` | binary (font) | 86,568 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p286.woff2` | binary (font) | 88,484 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p287.woff2` | binary (font) | 84,284 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p288.woff2` | binary (font) | 81,960 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p289.woff2` | binary (font) | 80,276 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p29.woff2` | binary (font) | 79,252 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p290.woff2` | binary (font) | 79,864 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p291.woff2` | binary (font) | 80,868 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p292.woff2` | binary (font) | 85,996 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p293.woff2` | binary (font) | 77,512 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p294.woff2` | binary (font) | 78,404 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p295.woff2` | binary (font) | 80,752 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p296.woff2` | binary (font) | 80,988 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p297.woff2` | binary (font) | 84,032 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p298.woff2` | binary (font) | 84,724 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p299.woff2` | binary (font) | 82,696 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p3.woff2` | binary (font) | 76,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p30.woff2` | binary (font) | 89,528 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p300.woff2` | binary (font) | 83,472 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p301.woff2` | binary (font) | 76,260 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p302.woff2` | binary (font) | 78,024 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p303.woff2` | binary (font) | 81,392 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p304.woff2` | binary (font) | 84,760 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p305.woff2` | binary (font) | 62,092 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p306.woff2` | binary (font) | 72,608 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p307.woff2` | binary (font) | 73,832 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p308.woff2` | binary (font) | 78,392 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p309.woff2` | binary (font) | 80,512 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p31.woff2` | binary (font) | 70,424 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p310.woff2` | binary (font) | 78,416 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p311.woff2` | binary (font) | 74,940 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p312.woff2` | binary (font) | 66,864 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p313.woff2` | binary (font) | 74,288 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p314.woff2` | binary (font) | 81,828 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p315.woff2` | binary (font) | 77,824 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p316.woff2` | binary (font) | 81,448 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p317.woff2` | binary (font) | 80,580 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p318.woff2` | binary (font) | 79,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p319.woff2` | binary (font) | 82,816 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p32.woff2` | binary (font) | 75,548 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p320.woff2` | binary (font) | 79,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p321.woff2` | binary (font) | 85,064 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p322.woff2` | binary (font) | 69,720 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p323.woff2` | binary (font) | 82,504 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p324.woff2` | binary (font) | 81,036 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p325.woff2` | binary (font) | 75,244 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p326.woff2` | binary (font) | 79,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p327.woff2` | binary (font) | 78,728 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p328.woff2` | binary (font) | 78,760 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p329.woff2` | binary (font) | 73,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p33.woff2` | binary (font) | 82,644 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p330.woff2` | binary (font) | 72,364 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p331.woff2` | binary (font) | 71,888 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p332.woff2` | binary (font) | 75,816 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p333.woff2` | binary (font) | 82,956 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p334.woff2` | binary (font) | 80,720 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p335.woff2` | binary (font) | 77,252 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p336.woff2` | binary (font) | 85,848 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p337.woff2` | binary (font) | 81,556 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p338.woff2` | binary (font) | 83,064 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p339.woff2` | binary (font) | 77,384 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p34.woff2` | binary (font) | 77,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p340.woff2` | binary (font) | 81,136 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p341.woff2` | binary (font) | 76,752 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p342.woff2` | binary (font) | 74,832 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p343.woff2` | binary (font) | 84,916 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p344.woff2` | binary (font) | 85,852 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p345.woff2` | binary (font) | 84,596 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p346.woff2` | binary (font) | 85,224 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p347.woff2` | binary (font) | 79,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p348.woff2` | binary (font) | 80,456 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p349.woff2` | binary (font) | 77,656 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p35.woff2` | binary (font) | 84,200 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p350.woff2` | binary (font) | 84,340 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p351.woff2` | binary (font) | 87,532 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p352.woff2` | binary (font) | 87,964 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p353.woff2` | binary (font) | 83,728 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p354.woff2` | binary (font) | 88,056 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p355.woff2` | binary (font) | 87,172 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p356.woff2` | binary (font) | 79,744 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p357.woff2` | binary (font) | 85,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p358.woff2` | binary (font) | 75,856 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p359.woff2` | binary (font) | 74,476 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p36.woff2` | binary (font) | 85,616 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p360.woff2` | binary (font) | 79,332 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p361.woff2` | binary (font) | 76,836 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p362.woff2` | binary (font) | 82,056 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p363.woff2` | binary (font) | 78,744 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p364.woff2` | binary (font) | 81,976 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p365.woff2` | binary (font) | 79,132 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p366.woff2` | binary (font) | 71,468 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p367.woff2` | binary (font) | 76,608 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p368.woff2` | binary (font) | 81,276 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p369.woff2` | binary (font) | 85,280 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p37.woff2` | binary (font) | 85,832 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p370.woff2` | binary (font) | 80,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p371.woff2` | binary (font) | 82,860 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p372.woff2` | binary (font) | 83,412 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p373.woff2` | binary (font) | 82,844 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p374.woff2` | binary (font) | 85,976 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p375.woff2` | binary (font) | 82,032 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p376.woff2` | binary (font) | 76,600 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p377.woff2` | binary (font) | 81,924 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p378.woff2` | binary (font) | 80,828 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p379.woff2` | binary (font) | 84,556 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p38.woff2` | binary (font) | 81,620 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p380.woff2` | binary (font) | 87,424 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p381.woff2` | binary (font) | 76,752 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p382.woff2` | binary (font) | 78,536 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p383.woff2` | binary (font) | 82,052 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p384.woff2` | binary (font) | 84,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p385.woff2` | binary (font) | 71,636 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p386.woff2` | binary (font) | 77,596 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p387.woff2` | binary (font) | 84,964 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p388.woff2` | binary (font) | 78,676 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p389.woff2` | binary (font) | 78,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p39.woff2` | binary (font) | 74,172 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p390.woff2` | binary (font) | 78,000 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p391.woff2` | binary (font) | 79,068 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p392.woff2` | binary (font) | 81,372 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p393.woff2` | binary (font) | 82,936 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p394.woff2` | binary (font) | 79,732 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p395.woff2` | binary (font) | 80,876 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p396.woff2` | binary (font) | 72,396 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p397.woff2` | binary (font) | 79,976 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p398.woff2` | binary (font) | 79,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p399.woff2` | binary (font) | 76,616 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p4.woff2` | binary (font) | 79,444 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p40.woff2` | binary (font) | 73,660 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p400.woff2` | binary (font) | 74,412 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p401.woff2` | binary (font) | 74,956 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p402.woff2` | binary (font) | 77,960 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p403.woff2` | binary (font) | 84,664 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p404.woff2` | binary (font) | 70,076 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p405.woff2` | binary (font) | 81,912 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p406.woff2` | binary (font) | 77,468 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p407.woff2` | binary (font) | 79,712 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p408.woff2` | binary (font) | 85,624 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p409.woff2` | binary (font) | 83,900 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p41.woff2` | binary (font) | 70,812 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p410.woff2` | binary (font) | 81,528 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p411.woff2` | binary (font) | 71,752 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p412.woff2` | binary (font) | 83,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p413.woff2` | binary (font) | 84,096 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p414.woff2` | binary (font) | 79,424 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p415.woff2` | binary (font) | 77,028 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p416.woff2` | binary (font) | 80,876 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p417.woff2` | binary (font) | 76,480 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p418.woff2` | binary (font) | 78,088 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p419.woff2` | binary (font) | 84,992 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p42.woff2` | binary (font) | 83,616 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p420.woff2` | binary (font) | 86,872 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p421.woff2` | binary (font) | 83,368 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p422.woff2` | binary (font) | 79,852 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p423.woff2` | binary (font) | 85,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p424.woff2` | binary (font) | 80,620 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p425.woff2` | binary (font) | 83,176 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p426.woff2` | binary (font) | 84,516 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p427.woff2` | binary (font) | 84,416 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p428.woff2` | binary (font) | 72,380 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p429.woff2` | binary (font) | 83,652 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p43.woff2` | binary (font) | 76,516 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p430.woff2` | binary (font) | 81,676 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p431.woff2` | binary (font) | 81,448 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p432.woff2` | binary (font) | 82,436 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p433.woff2` | binary (font) | 86,228 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p434.woff2` | binary (font) | 73,844 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p435.woff2` | binary (font) | 90,324 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p436.woff2` | binary (font) | 81,976 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p437.woff2` | binary (font) | 81,716 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p438.woff2` | binary (font) | 79,632 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p439.woff2` | binary (font) | 87,616 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p44.woff2` | binary (font) | 80,596 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p440.woff2` | binary (font) | 69,824 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p441.woff2` | binary (font) | 80,428 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p442.woff2` | binary (font) | 80,784 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p443.woff2` | binary (font) | 82,920 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p444.woff2` | binary (font) | 79,328 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p445.woff2` | binary (font) | 74,384 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p446.woff2` | binary (font) | 79,904 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p447.woff2` | binary (font) | 83,528 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p448.woff2` | binary (font) | 80,760 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p449.woff2` | binary (font) | 81,776 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p45.woff2` | binary (font) | 78,032 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p450.woff2` | binary (font) | 76,576 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p451.woff2` | binary (font) | 80,792 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p452.woff2` | binary (font) | 78,768 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p453.woff2` | binary (font) | 79,620 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p454.woff2` | binary (font) | 86,268 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p455.woff2` | binary (font) | 85,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p456.woff2` | binary (font) | 83,056 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p457.woff2` | binary (font) | 85,460 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p458.woff2` | binary (font) | 72,192 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p459.woff2` | binary (font) | 86,480 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p46.woff2` | binary (font) | 71,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p460.woff2` | binary (font) | 87,704 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p461.woff2` | binary (font) | 83,220 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p462.woff2` | binary (font) | 78,500 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p463.woff2` | binary (font) | 79,332 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p464.woff2` | binary (font) | 80,744 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p465.woff2` | binary (font) | 77,928 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p466.woff2` | binary (font) | 80,660 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p467.woff2` | binary (font) | 72,160 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p468.woff2` | binary (font) | 80,012 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p469.woff2` | binary (font) | 80,772 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p47.woff2` | binary (font) | 80,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p470.woff2` | binary (font) | 81,172 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p471.woff2` | binary (font) | 77,568 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p472.woff2` | binary (font) | 77,740 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p473.woff2` | binary (font) | 75,588 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p474.woff2` | binary (font) | 75,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p475.woff2` | binary (font) | 80,756 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p476.woff2` | binary (font) | 78,564 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p477.woff2` | binary (font) | 74,624 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p478.woff2` | binary (font) | 85,536 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p479.woff2` | binary (font) | 85,016 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p48.woff2` | binary (font) | 81,320 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p480.woff2` | binary (font) | 80,564 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p481.woff2` | binary (font) | 84,580 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p482.woff2` | binary (font) | 82,068 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p483.woff2` | binary (font) | 74,564 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p484.woff2` | binary (font) | 84,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p485.woff2` | binary (font) | 79,376 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p486.woff2` | binary (font) | 85,320 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p487.woff2` | binary (font) | 86,952 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p488.woff2` | binary (font) | 81,688 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p489.woff2` | binary (font) | 68,280 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p49.woff2` | binary (font) | 80,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p490.woff2` | binary (font) | 81,508 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p491.woff2` | binary (font) | 85,620 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p492.woff2` | binary (font) | 81,844 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p493.woff2` | binary (font) | 80,336 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p494.woff2` | binary (font) | 81,212 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p495.woff2` | binary (font) | 83,008 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p496.woff2` | binary (font) | 71,956 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p497.woff2` | binary (font) | 82,760 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p498.woff2` | binary (font) | 69,308 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p499.woff2` | binary (font) | 81,872 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p5.woff2` | binary (font) | 74,064 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p50.woff2` | binary (font) | 75,380 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p500.woff2` | binary (font) | 81,500 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p501.woff2` | binary (font) | 90,168 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p502.woff2` | binary (font) | 73,820 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p503.woff2` | binary (font) | 85,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p504.woff2` | binary (font) | 87,168 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p505.woff2` | binary (font) | 84,076 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p506.woff2` | binary (font) | 79,448 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p507.woff2` | binary (font) | 84,680 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p508.woff2` | binary (font) | 90,704 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p509.woff2` | binary (font) | 81,508 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p51.woff2` | binary (font) | 78,408 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p510.woff2` | binary (font) | 85,828 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p511.woff2` | binary (font) | 72,144 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p512.woff2` | binary (font) | 82,584 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p513.woff2` | binary (font) | 82,680 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p514.woff2` | binary (font) | 81,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p515.woff2` | binary (font) | 76,992 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p516.woff2` | binary (font) | 89,000 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p517.woff2` | binary (font) | 86,700 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p518.woff2` | binary (font) | 74,476 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p519.woff2` | binary (font) | 85,764 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p52.woff2` | binary (font) | 77,408 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p520.woff2` | binary (font) | 71,228 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p521.woff2` | binary (font) | 84,852 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p522.woff2` | binary (font) | 84,668 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p523.woff2` | binary (font) | 71,248 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p524.woff2` | binary (font) | 83,956 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p525.woff2` | binary (font) | 81,136 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p526.woff2` | binary (font) | 77,304 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p527.woff2` | binary (font) | 85,896 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p528.woff2` | binary (font) | 73,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p529.woff2` | binary (font) | 82,944 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p53.woff2` | binary (font) | 81,120 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p530.woff2` | binary (font) | 84,848 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p531.woff2` | binary (font) | 64,564 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p532.woff2` | binary (font) | 84,028 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p533.woff2` | binary (font) | 81,236 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p534.woff2` | binary (font) | 71,792 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p535.woff2` | binary (font) | 81,148 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p536.woff2` | binary (font) | 84,440 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p537.woff2` | binary (font) | 72,504 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p538.woff2` | binary (font) | 86,328 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p539.woff2` | binary (font) | 89,144 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p54.woff2` | binary (font) | 83,460 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p540.woff2` | binary (font) | 85,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p541.woff2` | binary (font) | 82,148 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p542.woff2` | binary (font) | 75,592 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p543.woff2` | binary (font) | 88,072 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p544.woff2` | binary (font) | 90,964 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p545.woff2` | binary (font) | 74,248 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p546.woff2` | binary (font) | 84,640 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p547.woff2` | binary (font) | 83,004 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p548.woff2` | binary (font) | 77,132 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p549.woff2` | binary (font) | 84,696 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p55.woff2` | binary (font) | 79,464 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p550.woff2` | binary (font) | 92,924 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p551.woff2` | binary (font) | 74,316 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p552.woff2` | binary (font) | 94,784 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p553.woff2` | binary (font) | 73,976 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p554.woff2` | binary (font) | 78,012 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p555.woff2` | binary (font) | 77,924 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p556.woff2` | binary (font) | 85,096 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p557.woff2` | binary (font) | 75,088 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p558.woff2` | binary (font) | 82,272 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p559.woff2` | binary (font) | 90,532 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p56.woff2` | binary (font) | 79,124 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p560.woff2` | binary (font) | 74,496 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p561.woff2` | binary (font) | 74,644 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p562.woff2` | binary (font) | 74,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p563.woff2` | binary (font) | 82,740 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p564.woff2` | binary (font) | 66,584 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p565.woff2` | binary (font) | 71,604 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p566.woff2` | binary (font) | 71,716 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p567.woff2` | binary (font) | 80,092 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p568.woff2` | binary (font) | 70,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p569.woff2` | binary (font) | 81,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p57.woff2` | binary (font) | 78,836 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p570.woff2` | binary (font) | 74,276 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p571.woff2` | binary (font) | 79,328 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p572.woff2` | binary (font) | 71,700 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p573.woff2` | binary (font) | 78,400 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p574.woff2` | binary (font) | 71,824 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p575.woff2` | binary (font) | 75,740 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p576.woff2` | binary (font) | 83,036 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p577.woff2` | binary (font) | 72,320 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p578.woff2` | binary (font) | 72,076 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p579.woff2` | binary (font) | 84,096 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p58.woff2` | binary (font) | 80,720 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p580.woff2` | binary (font) | 68,428 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p581.woff2` | binary (font) | 79,264 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p582.woff2` | binary (font) | 65,084 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p583.woff2` | binary (font) | 70,176 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p584.woff2` | binary (font) | 78,216 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p585.woff2` | binary (font) | 78,008 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p586.woff2` | binary (font) | 63,000 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p587.woff2` | binary (font) | 65,076 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p588.woff2` | binary (font) | 81,544 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p589.woff2` | binary (font) | 69,108 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p59.woff2` | binary (font) | 83,352 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p590.woff2` | binary (font) | 64,712 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p591.woff2` | binary (font) | 68,096 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p592.woff2` | binary (font) | 68,036 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p593.woff2` | binary (font) | 66,232 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p594.woff2` | binary (font) | 64,028 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p595.woff2` | binary (font) | 62,812 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p596.woff2` | binary (font) | 58,084 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p597.woff2` | binary (font) | 62,524 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p598.woff2` | binary (font) | 62,300 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p599.woff2` | binary (font) | 57,468 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p6.woff2` | binary (font) | 80,856 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p60.woff2` | binary (font) | 78,004 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p600.woff2` | binary (font) | 51,188 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p601.woff2` | binary (font) | 48,136 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p602.woff2` | binary (font) | 41,872 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p603.woff2` | binary (font) | 44,244 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p604.woff2` | binary (font) | 38,204 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p61.woff2` | binary (font) | 78,992 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p62.woff2` | binary (font) | 81,692 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p63.woff2` | binary (font) | 84,908 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p64.woff2` | binary (font) | 80,324 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p65.woff2` | binary (font) | 83,388 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p66.woff2` | binary (font) | 84,116 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p67.woff2` | binary (font) | 79,368 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p68.woff2` | binary (font) | 80,540 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p69.woff2` | binary (font) | 71,180 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p7.woff2` | binary (font) | 81,032 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p70.woff2` | binary (font) | 84,844 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p71.woff2` | binary (font) | 82,304 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p72.woff2` | binary (font) | 84,136 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p73.woff2` | binary (font) | 86,440 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p74.woff2` | binary (font) | 78,428 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p75.woff2` | binary (font) | 80,568 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p76.woff2` | binary (font) | 75,328 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p77.woff2` | binary (font) | 86,500 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p78.woff2` | binary (font) | 82,828 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p79.woff2` | binary (font) | 71,776 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p8.woff2` | binary (font) | 78,200 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p80.woff2` | binary (font) | 78,364 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p81.woff2` | binary (font) | 71,932 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p82.woff2` | binary (font) | 76,988 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p83.woff2` | binary (font) | 73,996 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p84.woff2` | binary (font) | 75,368 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p85.woff2` | binary (font) | 81,496 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p86.woff2` | binary (font) | 82,552 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p87.woff2` | binary (font) | 85,224 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p88.woff2` | binary (font) | 77,084 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p89.woff2` | binary (font) | 80,396 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p9.woff2` | binary (font) | 74,920 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p90.woff2` | binary (font) | 89,108 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p91.woff2` | binary (font) | 83,196 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p92.woff2` | binary (font) | 86,708 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p93.woff2` | binary (font) | 74,812 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p94.woff2` | binary (font) | 86,400 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p95.woff2` | binary (font) | 80,472 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p96.woff2` | binary (font) | 77,164 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p97.woff2` | binary (font) | 76,068 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p98.woff2` | binary (font) | 76,448 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/qcf/v1/p99.woff2` | binary (font) | 78,520 | — | n/a (binary) — generation, serving, size and licence audited | QCF v1 page font (KFGQPC); immutable cache; committed to a public repo |
| `client/public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2` | binary (font) | 87,760 | — | n/a (binary) — generation, serving, size and licence audited | Quran UI font; licence notes in the report |
| `client/public/fonts/quran/surah-names/v1/sura_names.woff2` | binary (font) | 88,560 | — | n/a (binary) — generation, serving, size and licence audited | Quran UI font; licence notes in the report |
| `client/public/icon-192.png` | binary (image) | 1,489 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/icon-512.png` | binary (image) | 8,162 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/mushaf-frame.svg` | binary (image) | 1,906 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/og-image.png` | binary (image) | 153,027 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/public/robots.txt` | config | 23 | 3 | YES |  |
| `client/public/site.webmanifest` | config | 619 | 28 | YES |  |
| `client/public/vite.svg` | binary (image) | 1,497 | — | n/a (binary) — generation, serving, size and licence audited |  |
| `client/src/App.jsx` | application code | 5,516 | 123 | YES | All routes lazy; onboarding gate only on /dashboard |
| `client/src/components/BasmalaGlyph.jsx` | application code | 18,301 | 19 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/Chatbot.jsx` | application code | 8,969 | 222 | YES | Safe rendering; no live region / dialog semantics |
| `client/src/components/ConfirmModal.jsx` | application code | 4,385 | 103 | YES | Exemplary accessible dialog |
| `client/src/components/ErrorBoundary.jsx` | application code | 2,288 | 57 | YES | No details leaked; no reset |
| `client/src/components/Footer.jsx` | application code | 1,186 | 30 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/HowToMemorizeModal.jsx` | application code | 4,092 | 88 | YES | No focus management; keys leak to the reader |
| `client/src/components/InfoHint.jsx` | application code | 3,556 | 90 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/LanguageToggle.jsx` | application code | 2,161 | 58 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/Logo.jsx` | application code | 1,445 | 29 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/MushafDrawLayer.jsx` | application code | 16,658 | 370 | YES | aria-hidden over focusable notes; English labels |
| `client/src/components/MushafMarks.jsx` | application code | 6,724 | 143 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/MushafPage.jsx` | application code | 18,159 | 353 | YES | Strong SR design (one button per verse + Arabic SR text); not memoised |
| `client/src/components/MushafZoomControl.jsx` | application code | 5,169 | 107 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/Navbar.jsx` | application code | 12,459 | 266 | YES | Menus lack aria-expanded/Escape |
| `client/src/components/PageScrubber.jsx` | application code | 4,521 | 95 | YES | No pointer capture (suspected stuck drag) |
| `client/src/components/ProtectedRoute.jsx` | application code | 956 | 30 | YES | Drops returnTo |
| `client/src/components/ReaderTools.jsx` | application code | 3,561 | 74 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/RecentPagesRow.jsx` | application code | 2,162 | 49 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/ReciterPicker.jsx` | application code | 15,168 | 318 | YES | Good combobox |
| `client/src/components/SearchFindBar.jsx` | application code | 5,098 | 103 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/TimeTool.jsx` | application code | 25,450 | 524 | YES | Sound logic |
| `client/src/components/TodoList.jsx` | application code | 17,998 | 401 | YES | Keyboard reorder, undo |
| `client/src/components/Tooltip.jsx` | application code | 3,838 | 97 | YES | Names icon buttons; no Escape dismiss |
| `client/src/components/VerseSearch.jsx` | application code | 25,615 | 465 | YES | Combobox; no focus trap |
| `client/src/components/dashboardTour.js` | application code | 5,967 | 112 | YES | Read in full (components auditor); no finding of note |
| `client/src/components/libraryTour.js` | application code | 6,686 | 126 | YES | Read in full (components auditor); no finding of note |
| `client/src/context/AuthContext.jsx` | application code | 4,269 | 148 | YES | Drops the token on ANY /auth/me failure (reproduced); no cross-tab sync |
| `client/src/context/ThemeContext.jsx` | application code | 1,103 | 43 | YES | Unguarded storage read at root; theme after paint |
| `client/src/context/TimerContext.jsx` | application code | 4,203 | 95 | YES | Stable store value |
| `client/src/context/ToastContext.jsx` | application code | 3,350 | 84 | YES | Value not memoised (re-renders Library per toast) |
| `client/src/data/hizbRanges.js` | application code | 15,695 | 10 | YES | Generated table, matches structure data; no generator committed |
| `client/src/data/juzRanges.js` | application code | 852 | 13 | YES | Read in full (services auditor); no finding of note |
| `client/src/data/pageAyahStarts.js` | application code | 4,237 | 54 | YES | Read in full (services auditor); no finding of note |
| `client/src/data/rubBoundaries.js` | application code | 2,849 | 45 | YES | Read in full (services auditor); no finding of note |
| `client/src/data/surahPages.js` | application code | 12,790 | 131 | YES | `end` one page short for 46 surahs (script-confirmed) |
| `client/src/hooks/useAuth.js` | application code | 653 | 17 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useDragSelect.js` | application code | 2,651 | 62 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useDraggable.js` | application code | 3,560 | 99 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useIdleHide.js` | application code | 7,144 | 151 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useMushafZoom.js` | application code | 18,750 | 383 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useRecentPageTracker.js` | application code | 5,040 | 113 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useRecentPages.js` | application code | 2,038 | 50 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useTheme.js` | application code | 322 | 9 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useTimer.js` | application code | 2,007 | 45 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useToast.js` | application code | 473 | 11 | YES | Read in full (components auditor); no finding of note |
| `client/src/hooks/useTodos.js` | application code | 1,289 | 26 | YES | Read in full (components auditor); no finding of note |
| `client/src/i18n.js` | application code | 550 | 24 | YES | Both locales imported eagerly into the entry chunk |
| `client/src/index.css` | application code | 51,483 | 1111 | YES | Google Fonts @import (render-blocking, third-party); small dead CSS |
| `client/src/locales/ar.json` | i18n data | 79,016 | 1267 | script — key diff, unused keys, plurals (all keys) | 1077 EN / 1121 AR keys; 0 missing; 52 unused; 28 count strings without plurals |
| `client/src/locales/en.json` | i18n data | 59,673 | 1223 | script — key diff, unused keys, plurals (all keys) | 1077 EN / 1121 AR keys; 0 missing; 52 unused; 28 count strings without plurals |
| `client/src/main.jsx` | application code | 367 | 15 | YES | StrictMode + single top-level ErrorBoundary |
| `client/src/pages/About.jsx` | application code | 5,377 | 114 | YES | Static; personal email |
| `client/src/pages/Dashboard.jsx` | application code | 67,237 | 1214 | YES | Mark All / extras drop the half-page segment; misleading empty state on API failure |
| `client/src/pages/Landing.jsx` | application code | 27,949 | 470 | YES | Dead Privacy/Terms/Contact links |
| `client/src/pages/Leaderboard.jsx` | application code | 9,101 | 214 | YES | Pre-fills public name with real name; text rendering is safe |
| `client/src/pages/Library.jsx` | application code | 336,868 | 6246 | YES | 6,245-line god component; progress-wipe and ink-overwrite chains; many swallowed loader errors (read in full by two auditors, 1–3200 and 3150–6245) |
| `client/src/pages/Login.jsx` | application code | 5,901 | 118 | YES | returnTo via safeReturnTo (safe, tested in browser); public demo hint |
| `client/src/pages/Onboarding.jsx` | application code | 52,025 | 923 | YES | Non-atomic 3-phase submit; colour-only tiles; artificial 2.5 s wait |
| `client/src/pages/Progress.jsx` | application code | 52,012 | 905 | YES | Good error/retry; recharts chunk 381 KB; 57 contrast failures |
| `client/src/pages/Register.jsx` | application code | 7,779 | 131 | YES | Client 6-char check mirrors server |
| `client/src/pages/Settings.jsx` | application code | 106,303 | 1888 | YES | 1,887 lines; swallowed load + replace-save can wipe progress; unlabeled inputs (axe critical) |
| `client/src/services/api.js` | application code | 5,307 | 121 | YES | Token from localStorage; careful 401 interceptor; no timeout; localhost fallback |
| `client/src/services/chime.js` | application code | 2,675 | 62 | YES | Web Audio bell |
| `client/src/services/dailyVerse.js` | application code | 3,861 | 91 | YES | UTC-keyed cache, local-day pick; keys never purged |
| `client/src/services/mushafApi.js` | application code | 22,713 | 466 | YES | Runtime dependency on unauthenticated api.quran.com; LRU caps (good); no timeout |
| `client/src/services/pagePrefetch.js` | application code | 6,803 | 165 | YES | Respects Save-Data/2g; bounded parallelism |
| `client/src/services/quranApi.js` | application code | 30,323 | 397 | YES | 34 reciters, 9 tafsir editions; spa5k@main unpinned; unbounded caches; HTML→text (safe) |
| `client/src/services/quranSearch.js` | application code | 5,426 | 121 | YES | Lazy 1.3 MB index; chunked build |
| `client/src/services/recentPages.js` | application code | 4,170 | 113 | YES | Guarded storage, sanitised input |
| `client/src/services/timerStore.js` | application code | 14,311 | 353 | YES | Cross-tab timer with Web Locks |
| `client/src/services/todoBackends.js` | application code | 7,081 | 172 | YES | Server + local backends |
| `client/src/services/todoStore.js` | application code | 7,790 | 218 | YES | Optimistic queue with exact rollback |
| `client/src/services/verseEdges.js` | application code | 10,438 | 221 | YES | MP3 edge decode; bounded cache |
| `client/src/utils/chatLinks.js` | application code | 3,160 | 77 | YES | Strict allow-list; one quadratic regex |
| `client/src/utils/formatNumber.js` | application code | 754 | 15 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/quranSearchQuery.js` | application code | 10,761 | 203 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/recentPageLabels.js` | application code | 2,183 | 50 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/returnTo.js` | application code | 894 | 21 | YES | Can emit //host after normalisation; not exploitable with RR 7.13 (browser-verified) |
| `client/src/utils/selfTestCycle.js` | application code | 1,176 | 20 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/shortcutKeys.js` | application code | 3,167 | 65 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/surahDisplay.js` | application code | 5,260 | 114 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/timerCore.js` | application code | 5,513 | 117 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/unitRanges.js` | application code | 5,895 | 139 | YES | Read in full (services auditor); no finding of note |
| `client/src/utils/verseIndex.js` | application code | 2,764 | 67 | YES | Read in full (services auditor); no finding of note |
| `client/vercel.json` | config | 266 | 14 | YES | SPA rewrite + font cache only; no security headers |
| `client/vite.config.js` | config | 161 | 8 | YES | Default config |
| `docs/CODE_GUIDE.md` | docs | 81,270 | 1311 | YES | Read in full; many stale statements listed in §5 of the report |
| `docs/FEATURES.md` | docs | 12,104 | 87 | YES | Read in full; stale counts (13 tests, 5 reciters, 4 tafsir, single 976 KB chunk) |
| `docs/IMPROVEMENT_PLAN.md` | docs | 269,030 | 1824 | YES | Read after the independent pass: status, open queue, Part 1/4, every row matching audit topics (lines are very long) |
| `docs/MEETING_WALKTHROUGH.md` | docs | 5,234 | 137 | skimmed for claims and secrets |  |
| `docs/PRESENTATION_SPEAKER_NOTES.md` | docs | 12,021 | 207 | skimmed for claims and secrets |  |
| `docs/PROJECT_FACTS.md` | docs | 8,034 | 154 | skimmed for claims and secrets |  |
| `docs/STUDY_SESSIONS.html` | docs | 39,712 | 723 | skimmed for claims and secrets |  |
| `docs/TEAM_OVERVIEW.md` | docs | 5,367 | 99 | skimmed for claims and secrets |  |
| `docs/samples/page106.json` | generated data | 45,900 | 2 | no (by design) — shape, generator and validation audited | Sample API response kept for reference |
| `render.yaml` | config | 347 | 17 | YES | No GROQ_API_KEY, no healthCheckPath, npm install not npm ci |
| `server/.env.example` | config | 126 | 5 | YES | Missing GROQ_API_KEY / GROQ_MODEL / NODE_ENV |
| `server/app.js` | application code | 2,609 | 71 | YES | Middleware order, CORS allow-list, trust proxy (prod only), no JSON error handler (malformed JSON → HTML 400) |
| `server/chat/appGuide.md` | docs | 5,723 | 45 | YES | Prompt content for the assistant (read in full) |
| `server/controllers/annotationController.js` | application code | 28,263 | 631 | YES | Strong: field whitelisting, ownership scoping, all-or-nothing batch with rollback |
| `server/controllers/authController.js` | application code | 14,897 | 451 | YES | deleteAccount leaves Bookmark+Annotation; validation errors → 500; Boolean("false") → true; no new token after password change |
| `server/controllers/bookmarkController.js` | application code | 8,122 | 188 | YES | Ownership-scoped; restore-on-failure swallowed |
| `server/controllers/chatController.js` | application code | 7,736 | 162 | YES | Summary built from req.user only; forwards raw client message objects; no max_tokens / timeout |
| `server/controllers/leaderboardController.js` | application code | 3,328 | 96 | YES | Exposes other users' userId; O(users × pages) build; stale streaks |
| `server/controllers/progressController.js` | application code | 61,356 | 1396 | YES | Core scheduler; page numbers not integer/range-checked on onboarding/complete/memorized; replace-semantics updateMemorized |
| `server/controllers/todoController.js` | application code | 8,843 | 226 | YES | Ownership-scoped; restore whitelists fields |
| `server/middleware/auth.js` | application code | 1,643 | 58 | YES | JWT verify + passwordChangedAt check; logs every bad token with console.error |
| `server/middleware/chatRateLimit.js` | application code | 777 | 21 | YES | 20 req / 5 min keyed per user |
| `server/middleware/rateLimiters.js` | application code | 1,786 | 42 | YES | auth 10/15 min, api 300/15 min per IP; no-op under test |
| `server/middleware/validate.js` | application code | 3,649 | 76 | YES | Type gate (closes NoSQL-operator injection); accepts "true"/"false" strings for booleans |
| `server/models/Annotation.js` | application code | 3,670 | 95 | YES | Five kinds, indexes userId+pageNumber / userId+kind |
| `server/models/Bookmark.js` | application code | 1,272 | 40 | YES | Partial unique index (one unnamed per page) |
| `server/models/QuranMetadata.js` | application code | 1,250 | 48 | YES | Static 604-row table |
| `server/models/Todo.js` | application code | 1,143 | 40 | YES | userId+order index |
| `server/models/User.js` | application code | 4,545 | 145 | YES | Email regex is exponential (ReDoS, CRITICAL) and rejects valid emails; bcrypt cost 10; no length caps |
| `server/models/UserProgress.js` | application code | 1,711 | 59 | YES | min/max on pageNumber not enforced by upserts |
| `server/package-lock.json` | lockfile | 87,301 | 2488 | n/a — npm audit / npm outdated run against it |  |
| `server/package.json` | config | 819 | 38 | YES | engines >=18 conflicts with mongoose 9 (>=20.19) |
| `server/routes/annotationRoutes.js` | application code | 2,633 | 66 | YES | All protected + type-gated |
| `server/routes/authRoutes.js` | application code | 1,890 | 42 | YES | register/login limited; /password and /account have no extra limiter |
| `server/routes/bookmarkRoutes.js` | application code | 1,123 | 33 | YES | All protected + type-gated |
| `server/routes/chatRoutes.js` | application code | 404 | 11 | YES | protect → chatLimiter; no body type gate |
| `server/routes/leaderboardRoutes.js` | application code | 489 | 14 | YES | Protected |
| `server/routes/progressRoutes.js` | application code | 2,351 | 68 | YES | All protected; `segment` and `ref` not type-gated (validated in controller) |
| `server/routes/todoRoutes.js` | application code | 1,556 | 47 | YES | All protected + type-gated |
| `server/seed/data/quranStructure.json` | generated data | 305,441 | 17277 | no (by design) — shape, generator and validation audited | Generated; measured correct (6236 verses, 240 rubs, 114 surahs) |
| `server/seed/demoData.js` | application code | 3,714 | 127 | YES | Hard-coded public demo credentials (REDACTED); writes to MONGODB_URI with no guard |
| `server/seed/fetchQuranStructure.js` | application code | 4,714 | 133 | YES | Writes structure JSON without self-validation |
| `server/seed/fetchSearchIndex.js` | application code | 7,394 | 147 | YES | Fails closed on any position mismatch (strong) |
| `server/seed/quranData.js` | application code | 1,668 | 48 | YES | deleteMany then insertMany, no env guard, auto-runs on require |
| `server/seed/surahNames.js` | application code | 7,878 | 126 | YES | 114 EN/AR names |
| `server/server.js` | application code | 1,752 | 45 | YES | Boot: env assert (MONGODB_URI, JWT_SECRET), connect-then-listen, Bookmark.syncIndexes; no graceful shutdown |
| `server/tests/annotations.test.js` | tests | 40,192 | 724 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/auth.test.js` | tests | 5,227 | 136 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/bookmarks.test.js` | tests | 20,638 | 457 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/chat.test.js` | tests | 8,158 | 181 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/helpers.js` | tests | 3,454 | 106 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/leaderboard.test.js` | tests | 9,706 | 205 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/progress.test.js` | tests | 32,192 | 665 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/quranStructure.test.js` | tests | 3,200 | 77 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/todos.test.js` | tests | 12,488 | 249 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/tests/units.test.js` | tests | 12,804 | 263 | YES | Read in full (tests auditor); see Appendix B route × test matrix |
| `server/utils/errorResponse.js` | application code | 662 | 15 | YES | Hides error.message only when NODE_ENV=production |
| `server/utils/leaderboardCache.js` | application code | 1,442 | 41 | YES | Single-instance cache; not cleared on account deletion |
| `server/utils/quranMetadataCache.js` | application code | 1,871 | 52 | YES | Shared in-flight promise, retry on failure |
| `server/utils/segments.js` | application code | 10,911 | 257 | YES | Pure verse-range maths; pageFraction returns 1 for unknown pages |
