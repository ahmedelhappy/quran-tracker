# Bookmark from the page ribbon — design

Status: **agreed, not built** (decided 2026-11-07). Branch: `feat/ribbon-bookmarks`.
Clickable mockup: [ribbon-bookmarks-mockup.html](ribbon-bookmarks-mockup.html) (open it in a
browser; also published at https://claude.ai/artifact/FB61YHeMqfmHGmHBGbJqVm).

## The problem

Updating a bookmark to the page being read takes a trip to the sidebar list and a confirm
dialog. The reader should be able to do it from the page itself, where they already look.

## The design

**Ribbon on every page header.** An outline ribbon in each page card's running head (each
page of a two-page spread has its own); filled when the page holds a bookmark, and a
stacked double ribbon when it holds more than one. It is a real button: "Bookmark page 50" /
"Page 50 is bookmarked. Open its bookmarks" / "Page 50 has 2 bookmarks. Open them".

**A tap always opens a small menu** (a popover beside the ribbon; a bottom sheet on phones):

| Part | What it does |
|---|---|
| Header | "Page 50" and a close button |
| This page's bookmarks | Click the name to rename it in place (Enter or clicking away saves, Escape cancels); bin icon removes it, with Undo |
| Your other bookmarks | One tap moves that bookmark to this page, with Undo. Each row's icon is a bookmark dropping onto a page, and its tooltip says "Move to page 50". In the user's own order, so the top bookmark is first. Each shows its current page number |
| New bookmark | One field ("New bookmark, name optional") and a + button. The name is optional, also for the very first bookmark; an unnamed one shows as "Page N" |

**Calm, not wordy.** No section titles or hint lines in the menu: icons carry the meaning
and say it in a tooltip (hover or keyboard focus, short delay) and in their accessible name.
Text stays only where it is content: the bookmark names.

**The bookmarks list in the sidebar** works as it does on `main`: click a bookmark to go to
its page; a pencil icon renames it. New: drag the grip (⋮⋮) to reorder, with a tooltip
"Drag to reorder" on hover instead of a hint line. The row moves only up and down and never
leaves the list; the others glide into place. Keyboard: focus the grip, Alt + ↑/↓. The order
is saved (Undo in the toast).

**Messages** ("Bookmarked page 50", "Review moved to page 50", with Undo) appear in the top
bar like every other toast, never over the page or the ribbon.

## Rules kept from today

- A page holds any number of named bookmarks but only one unnamed one. Moving an unnamed
  bookmark onto a page that has one replaces it; that row shows a ! with the tooltip
  "Move to page 50, replacing the unnamed bookmark there".
- **No two bookmarks may have the same name.** Names are compared as the reader sees them,
  ignoring case and extra spaces, so a name can't copy another bookmark's name or an unnamed
  bookmark's "Page N" label (in either language). A clash is refused with an inline message
  (adding) or a toast (renaming). The server must enforce the same rule, not only the client.
- Signed-out readers see no ribbon (or it opens the existing sign-in nudge).

## Decided, and why

| Question | Decision | Why |
|---|---|---|
| With exactly one bookmark, should a tap move it at once? | No: a tap always opens the menu | Moving at once left no way to create a second bookmark from the ribbon. Maybe later: a quicker way to move the main bookmark |
| Two ribbon buttons (move / new)? | No, one ribbon | Two icons on every page header add clutter; the menu puts the top bookmark first, so moving it is two taps |
| Right-click to move, left-click for the menu? | No | Phones have no right-click, and it is undiscoverable |
| Remove in the menu? | Yes, with Undo | Undo covers mistakes; no confirm dialog |
| Name required for the first bookmark? | No, optional everywhere | Fewer steps; an unnamed bookmark reads as its page |
| Rename | Click the name (menu); pencil (sidebar) | Clicking a name in the sidebar keeps going to its page, as on `main` |
| Reorder | Drag the grip, kept inside the list; tooltip instead of a hint line | Less text on screen |
| Several bookmarks on one page | A stacked double-ribbon icon | The reader sees there is more than one before opening the menu |
| Move icon in the menu | A bookmark dropping onto a page, tooltip "Move to page N" | An arrow alone didn't say where the bookmark goes |
| Duplicate names | Never allowed, compared as shown (incl. "Page N") | Two bookmarks that read the same can't be told apart |

## Building it

- **Client:** a `PageRibbon` button in the page card's running head; a `BookmarkMenu`
  (popover / sheet, built on `useDialog`); drag-to-reorder in the sidebar list. Everything else
  is already in `hooks/useBookmarks.js` (add, rename, move with the unnamed-replace case,
  remove, Restore).
- **Server:** a saved order: an `order` number on `Bookmark`, the list sorted by it, and a
  reorder endpoint (e.g. `PUT /api/bookmarks/order` with the ids in order), validated and
  scoped to the user.
- **Strings:** EN and AR for every label, tooltip and toast; check RTL and dark mode.
- **Tests:** server (order endpoint, ownership), Vitest (menu, ribbon state, reorder by
  keyboard), one Playwright flow (bookmark a page from the ribbon, move one here, Undo,
  reorder).
- **Phones:** the menu is a bottom sheet; dragging starts after a short press-and-hold on the
  grip so it does not fight scrolling.
- **When:** after `audit-fixes` is merged into `main` (the branch starts from `audit-fixes`,
  which holds `useBookmarks`).
