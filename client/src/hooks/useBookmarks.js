import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FiBookmark, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { bookmarksAPI } from '../services/api';
import { reportError, reportLoadFailure } from '../utils/reportError';
import { apiErrorMessage } from '../utils/apiError';

// List order, matching the server's: by page, then by name (unnamed first) —
// a page can hold several bookmarks with different names.
const byBookmarkOrder = (a, c) => a.pageNumber - c.pageNumber || (a.label < c.label ? -1 : a.label > c.label ? 1 : 0);

// Wrap a user's label in Unicode isolates (FSI…PDI) before putting it in a
// sentence, so an English name inside Arabic text (or the reverse) can't drag
// the quotes and brackets around it into the wrong order.
const isolate = (s) => `⁨${s}⁩`;

// A bookmark the reader can draw: anything else in the server's list would
// crash the list, its sort or the page ribbon, which are drawn above any error
// boundary of their own. Kept out at the door instead (and reported).
const isUsableBookmark = (b) => b != null && typeof b === 'object'
  && typeof b._id === 'string'
  && Number.isInteger(b.pageNumber) && b.pageNumber >= 1 && b.pageNumber <= 604
  && (b.label == null || typeof b.label === 'string');

// The bookmark in a reply to an add, rename or move, held to the same rule: a
// reply without one throws, so the caller's catch rolls back and says so
// rather than putting `undefined` into the list.
const bookmarkFrom = (res) => {
  const b = res.data?.data;
  if (!isUsableBookmark(b)) throw new Error('Unexpected bookmark reply');
  return b;
};

// The Library's account-saved bookmarks (several per user, several per page as
// long as their names differ): the list and its load, adding, renaming inline,
// moving to the page being read, removing — each optimistic, rolled back on
// failure, with Restore in the toast that follows — and the one confirm dialog
// that a move, a replace or a removal goes through.
//
// `targetPage` is the page an add or a move acts on (the active page of a
// spread). Returns state and handlers for the sidebar's list, the set of
// bookmarked pages for the page ribbon, and `confirmProps` for a ConfirmModal.
export function useBookmarks({ signedIn, targetPage, noteRead, showToast, t, fmtNum }) {
  const [bookmarks, setBookmarks] = useState([]);
  // The last read failed. It used to swallow the failure and show "none yet",
  // which reads as "you have none" (M-14); now the list says so, with Retry.
  const [bookmarksFailed, setBookmarksFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [savingBookmark, setSavingBookmark] = useState(false);
  // Per-row actions: which row is being renamed inline (and its draft), and the
  // pending move/replace/remove confirm.
  const [renamingBookmarkId, setRenamingBookmarkId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [bookmarkConfirm, setBookmarkConfirm] = useState(null); // { kind: 'move' | 'replace' | 'remove', bookmark, conflict?, page? }
  const renameSettledRef = useRef(false);  // Enter/Escape and the blur that follows must settle a rename once
  const bookmarkRowRefs = useRef(new Map()); // bookmark id → its <li>, to put focus back on one of its buttons

  // An account feature, so nothing is asked for while signed out.
  useEffect(() => {
    if (!signedIn) { setBookmarks([]); setBookmarksFailed(false); return; }
    let cancelled = false;
    bookmarksAPI.list()
      .then(res => {
        // No list at all (an HTML page from a misrouted request, say) is a
        // failed load too, not "no bookmarks".
        const list = res.data?.data;
        if (!Array.isArray(list)) throw new Error('Unexpected bookmarks payload');
        const usable = list.filter(isUsableBookmark);
        if (usable.length !== list.length) {
          reportError(new Error('Bookmarks the reader cannot show were left out'), {
            source: 'load', what: 'bookmarks', dropped: list.length - usable.length,
          });
        }
        if (!cancelled) { setBookmarks(usable); setBookmarksFailed(false); }
      })
      .catch((err) => { reportLoadFailure(err, 'bookmarks'); if (!cancelled) setBookmarksFailed(true); });
    return () => { cancelled = true; };
  }, [signedIn, reloadKey]);

  // Read the list again. `clear` empties it at once (the sidebar's crash Retry:
  // drawing the same list again would only crash again).
  const reloadBookmarks = useCallback(({ clear = false } = {}) => {
    if (clear) setBookmarks([]);
    setReloadKey((k) => k + 1);
  }, []);

  const bookmarkedPages = useMemo(() => new Set(bookmarks.map(b => b.pageNumber)), [bookmarks]);

  const addBookmark = async () => {
    if (savingBookmark) return;
    noteRead();
    setSavingBookmark(true);
    const label = bookmarkLabel.trim();
    try {
      const res = await bookmarksAPI.add({ pageNumber: targetPage, ...(label ? { label } : {}) });
      const added = bookmarkFrom(res);
      setBookmarks(prev => [...prev, added].sort(byBookmarkOrder));
      setBookmarkLabel('');
      showToast(t('library.bookmarks.added', { n: fmtNum(targetPage) }), 'success');
    } catch (e) {
      // 409: an unnamed bookmark already sits on this page, or the name is taken.
      const msg = e.response?.status === 409
        ? (label ? t('library.bookmarks.duplicateName') : t('library.bookmarks.unnamedTaken', { n: fmtNum(targetPage) }))
        : apiErrorMessage(e, t);
      showToast(msg, 'error');
    } finally {
      setSavingBookmark(false);
    }
  };

  // Re-create a removed bookmark (same page and name; it gets a new id). Returns
  // the new bookmark, or null if it couldn't be restored (e.g. the name has
  // since been reused).
  const restoreBookmark = async ({ pageNumber, label }) => {
    try {
      const res = await bookmarksAPI.add({ pageNumber, ...(label ? { label } : {}) });
      const back = bookmarkFrom(res);
      setBookmarks(list => [...list, back].sort(byBookmarkOrder));
      return back;
    } catch {
      return null;
    }
  };

  // Removal (after its confirm) is optimistic; the toast that follows offers
  // Restore, which re-creates it.
  const removeBookmark = async (b) => {
    setBookmarks(list => list.filter(x => x._id !== b._id));
    try {
      await bookmarksAPI.remove(b._id);
      showToast(t('library.bookmarks.removed'), 'success', {
        action: {
          label: t('library.bookmarks.restore'),
          onClick: async () => {
            const back = await restoreBookmark(b);
            showToast(t(back ? 'library.bookmarks.restored' : 'library.bookmarks.restoreFailed'), back ? 'success' : 'error');
          },
        },
      });
    } catch {
      setBookmarks(list => [...list, b].sort(byBookmarkOrder)); // roll back
      showToast(t('common.error'), 'error');
    }
  };

  // Every removal asks first.
  const requestRemoveBookmark = (b) => setBookmarkConfirm({ kind: 'remove', bookmark: b });

  // Put focus back on one of a row's action buttons once the list has
  // re-rendered — after a rename, a move that re-sorted the row, or a confirm.
  // Falls back to Rename if that button is missing; a no-op once the row is gone.
  const focusBookmarkAction = (id, action) => requestAnimationFrame(() => {
    const row = bookmarkRowRefs.current.get(id);
    (row?.querySelector(`[data-bm-action="${action}"]`) ?? row?.querySelector('[data-bm-action="rename"]'))?.focus();
  });

  const startRenameBookmark = (b) => {
    renameSettledRef.current = false;
    setRenameDraft(b.label);
    setRenamingBookmarkId(b._id);
  };

  // Enter and blur save, Escape cancels. Optimistic, rolled back on failure.
  const finishRenameBookmark = async (b, save, { refocus = false } = {}) => {
    if (renameSettledRef.current) return;
    renameSettledRef.current = true;
    setRenamingBookmarkId(null);
    if (refocus) focusBookmarkAction(b._id, 'rename');
    const label = renameDraft.trim();
    if (!save || label === b.label) return;
    setBookmarks(list => list.map(x => (x._id === b._id ? { ...x, label } : x)));
    try {
      const res = await bookmarksAPI.update(b._id, { label });
      const saved = bookmarkFrom(res);
      setBookmarks(list => list.map(x => (x._id === b._id ? saved : x)));
    } catch (e) {
      setBookmarks(list => list.map(x => (x._id === b._id ? { ...x, label: b.label } : x)));
      // 409: the name is taken — or, when clearing it, this page already has
      // an unnamed bookmark (two would both read "Page N").
      const msg = e.response?.status !== 409 ? t('common.error')
        : label ? t('library.bookmarks.duplicateName')
        : t('library.bookmarks.unnamedTaken', { n: fmtNum(b.pageNumber) });
      showToast(msg, 'error');
    }
  };

  // Changing a bookmark to `page` (the active page) always asks first. Pages hold
  // any number of differently-named bookmarks, so usually that is a plain
  // "Change … to page N?". The one clash is an UNNAMED bookmark landing where an
  // unnamed one already is (both would read "Page N"): then the same single
  // dialog asks to replace it instead, and Replace sends replace:true so the
  // server swaps them in one request.
  const requestMoveBookmark = (b, page) => {
    if (b.pageNumber === page) return;
    const occupant = b.label ? null : bookmarks.find(x => x.pageNumber === page && !x.label && x._id !== b._id);
    setBookmarkConfirm(occupant
      ? { kind: 'replace', bookmark: b, conflict: occupant, page }
      : { kind: 'move', bookmark: b, page });
  };

  // Undo a change: move the bookmark back to the page it came from and, if it
  // had replaced an unnamed bookmark, re-create that one (after the move back,
  // so the page's one unnamed slot is free again).
  const undoMoveBookmark = async (b, replaced) => {
    try {
      const res = await bookmarksAPI.update(b._id, { pageNumber: b.pageNumber });
      const saved = bookmarkFrom(res);
      setBookmarks(list => list.map(x => (x._id === b._id ? saved : x)).sort(byBookmarkOrder));
      const back = replaced ? await restoreBookmark(replaced) : true;
      showToast(t(back ? 'library.bookmarks.restored' : 'library.bookmarks.restoreFailed'), back ? 'success' : 'error');
    } catch {
      showToast(t('library.bookmarks.restoreFailed'), 'error');
    }
  };

  // Runs once the change is confirmed. Optimistic; the toast that follows offers
  // Restore. A server 409 (another device added an unnamed bookmark there since
  // the list loaded) rolls back and opens the replace dialog.
  const moveBookmark = async (b, page, replace = false) => {
    if (b.pageNumber === page) return;
    const occupant = replace ? bookmarks.find(x => x.pageNumber === page && !x.label && x._id !== b._id) : null;
    setBookmarks(list => list
      .filter(x => x._id !== occupant?._id)
      .map(x => (x._id === b._id ? { ...x, pageNumber: page } : x))
      .sort(byBookmarkOrder));
    focusBookmarkAction(b._id, 'move');
    try {
      const res = await bookmarksAPI.update(b._id, { pageNumber: page, ...(replace ? { replace: true } : {}) });
      const saved = bookmarkFrom(res);
      const replacedId = res.data.replaced?._id;
      setBookmarks(list => list
        .filter(x => x._id !== replacedId)
        .map(x => (x._id === b._id ? saved : x))
        .sort(byBookmarkOrder));
      showToast(t('library.bookmarks.moved', { n: fmtNum(page) }), 'success', {
        action: { label: t('library.bookmarks.restore'), onClick: () => undoMoveBookmark(b, res.data.replaced) },
      });
    } catch (e) {
      // Undo only this move — put the bookmark back and the occupant it
      // replaced — on the list as it is NOW: a rename or removal that finished
      // meanwhile has already reached the server and must not be rolled back.
      setBookmarks(list => {
        const next = list.map(x => (x._id === b._id ? b : x));
        if (occupant && !next.some(x => x._id === occupant._id)) next.push(occupant);
        return next.sort(byBookmarkOrder);
      });
      const conflict = e.response?.status === 409 ? e.response.data?.conflict : null;
      if (conflict) setBookmarkConfirm({ kind: 'replace', bookmark: b, conflict, page });
      else showToast(e.response?.status === 409 ? t('library.bookmarks.unnamedTaken', { n: fmtNum(page) }) : t('common.error'), 'error');
    }
  };

  // What the confirm dialog says, by kind: change the page, replace an unnamed
  // bookmark (an unnamed one landing on another), or remove.
  const dialogText = (() => {
    const c = bookmarkConfirm;
    if (!c) return {};
    const b = c.bookmark;
    const from = fmtNum(b.pageNumber);
    if (c.kind === 'move') return {
      icon: FiMapPin,
      title: t('library.bookmarks.changeTitle'),
      message: b.label
        ? t('library.bookmarks.changeMessage', { label: isolate(b.label), from, to: fmtNum(c.page) })
        : t('library.bookmarks.changeMessageUnnamed', { from, to: fmtNum(c.page) }),
      confirmText: t('library.bookmarks.change'),
      isDanger: false,
    };
    if (c.kind === 'replace') return {
      icon: FiBookmark,
      title: t('library.bookmarks.replaceTitle'),
      message: t('library.bookmarks.replaceMessageUnnamed', { n: fmtNum(c.page) }),
      confirmText: t('library.bookmarks.replace'),
      isDanger: true,
    };
    return {
      icon: FiTrash2,
      title: t('library.bookmarks.removeTitle'),
      message: b.label
        ? t('library.bookmarks.removeMessage', { n: from, label: isolate(b.label) })
        : t('library.bookmarks.removeMessageUnnamed', { n: from }),
      confirmText: t('library.bookmarks.remove'),
      isDanger: true,
    };
  })();

  const confirmProps = {
    isOpen: !!bookmarkConfirm,
    onClose: () => {
      // Back to the button that asked (Remove, or Move) — its row may have
      // re-sorted or re-rendered meanwhile, so find it afresh.
      if (bookmarkConfirm) focusBookmarkAction(bookmarkConfirm.bookmark._id, bookmarkConfirm.kind === 'remove' ? 'remove' : 'move');
      setBookmarkConfirm(null);
    },
    onConfirm: () => {
      const c = bookmarkConfirm;
      if (c.kind === 'move') moveBookmark(c.bookmark, c.page);
      else if (c.kind === 'replace') moveBookmark(c.bookmark, c.page, true);
      else removeBookmark(c.bookmark);
    },
    ...dialogText,
  };

  return {
    bookmarks,
    bookmarksFailed,
    reloadBookmarks,
    bookmarkedPages,
    bookmarkLabel,
    setBookmarkLabel,
    savingBookmark,
    addBookmark,
    renamingBookmarkId,
    renameDraft,
    setRenameDraft,
    startRenameBookmark,
    finishRenameBookmark,
    requestMoveBookmark,
    requestRemoveBookmark,
    bookmarkRowRefs,
    confirmProps,
  };
}
