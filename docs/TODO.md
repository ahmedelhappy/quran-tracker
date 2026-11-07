# To-do

The owner's running list after the audit fixes (docs/AUDIT_2026-10.md). Tick items
off and add new ones here; the full reasoning is in each phase's row of
docs/IMPROVEMENT_PLAN.md.

_Last updated: 2026-11-07_

## 1. Merge
- [ ] Review the Phase 7–12 commits on `audit-fixes` (Phases 1–6 are already on `main`)
- [ ] Open one pull request `audit-fixes` → `main`; on a conflict over
      `docs/PROJECT_FACTS.md`, keep `main`'s deletion
- [ ] Watch CI: it is the first WebKit e2e run since Phase 9

## 2. Before deploying
- [ ] Back up the Atlas database
- [ ] Check production for duplicate drawings before the `one_drawing_per_page` index builds:
      `db.annotations.aggregate([{$match:{kind:'drawing'}},{$group:{_id:{u:'$userId',p:'$pageNumber'},n:{$sum:1}}},{$match:{n:{$gt:1}}}])`
- [ ] `cd server && node scripts/cleanupOrphans.js --uri "<atlas-uri>"`, read the counts, then again with `--apply`
- [ ] `node scripts/cleanupInvalidPages.js --uri "<atlas-uri>"`, read the counts, then again with `--apply`
- [ ] Deploy the server first, then the client

## 3. Settings to confirm
- [ ] Render: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (https client origin), `GROQ_API_KEY`
- [ ] Render: check that `TRUST_PROXY` makes `req.ip` the real client address
- [ ] Vercel: `VITE_API_URL` is set (the build fails without it)
- [ ] Vercel: `VITE_SITE_URL` only if the site gets its own domain
- [ ] CSP in `client/vercel.json`: confirm the API host, add a report-to endpoint, watch, then enforce

## 4. Decisions only the owner can make
- [ ] Groq Zero Data Retention (recommended: turn it on)
- [ ] Contact address instead of the personal Gmail in Footer.jsx and About.jsx (L-16)
- [ ] Age policy (recommended: 18+; Groq's terms require it)
- [ ] Fill the legal placeholders in `docs/legal/` (operator, governing law, regions, retention)
- [ ] Publish the privacy policy and terms; add footer links
- [ ] Email provider for password reset (recommended: Resend or Postmark)
- [ ] Licensing review (H-04): repository visibility, fonts, permission emails, LICENSE
- [ ] Demo account policy (M-07)
- [ ] Sentry DSN, wired into `client/src/utils/reportError.js`
- [ ] Render cold starts (recommended: a paid instance or a keep-warm ping)
- [ ] Colour contrast (M-11), with the UI/UX work
- [ ] Remove the unused `PUT /api/progress/memorized` after one release

## 5. Next code work
- [ ] Memoised page card in the Library (faster page turns and verse selection)
- [ ] Remaining Library extractions: useRecitation, useAnnotateMode, LibrarySidebar
- [ ] Split Settings.jsx into sections
- [ ] Move the rate limiters to Mongo or Redis before running a second server instance

## Planned features
- [ ] **Bookmark from the page ribbon** (design agreed 2026-11-07; mockup: https://claude.ai/artifact/FB61YHeMqfmHGmHBGbJqVm)
  - Outline ribbon on every page header, filled when the page holds a bookmark
  - A tap always opens a menu (bottom sheet on phones): this page's bookmarks (click
    the name to rename, Remove with Undo), "Move a bookmark here" (the top bookmark of
    the user's order first), "New bookmark" (name optional)
  - Sidebar list as on `main`: click a bookmark to go to its page; a pencil renames it
  - Later, maybe: a quicker way to move the main bookmark (one tap / a second button)
  - Reorder the bookmarks list by dragging a grip (tooltip on hover; Alt+↑/↓ on the keyboard)
  - Server: a saved order for bookmarks (an `order` field and a reorder endpoint)
  - Toasts in the top bar, never over the page

## Future
- [ ] Rework the UI/UX as a whole: less text on screen, calmer layouts
- [ ] Design and test the phone view and its UX properly (barely tried so far)

## Done
- [x] Audit fixes Phases 1–12, logged in docs/IMPROVEMENT_PLAN.md (2026-11-05)
