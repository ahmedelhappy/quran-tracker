import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useBookmarks } from './useBookmarks';
import { bookmarksAPI } from '../services/api';
import { reportError, reportLoadFailure } from '../utils/reportError';
import { act } from '@testing-library/react';

vi.mock('../services/api', () => ({ bookmarksAPI: { list: vi.fn(), add: vi.fn() } }));
vi.mock('../utils/reportError', () => ({ reportError: vi.fn(), reportLoadFailure: vi.fn() }));

const props = { signedIn: true, targetPage: 50, noteRead: () => {}, showToast: vi.fn(), t: (k) => k, fmtNum: String };
const listReturns = (data) => bookmarksAPI.list.mockResolvedValueOnce({ data: { success: true, data } });

describe('useBookmarks: the list is checked as it arrives', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it('keeps the bookmarks it can draw and reports the rest', async () => {
    listReturns([
      { _id: 'a', pageNumber: 50, label: 'ok' },
      null,
      { _id: 5, pageNumber: 'nine' },
      { _id: 'b', pageNumber: 700 },
      { _id: 'c', pageNumber: 2 },
    ]);
    const { result } = renderHook(() => useBookmarks(props));
    await waitFor(() => expect(result.current.bookmarks).toHaveLength(2));
    expect(result.current.bookmarks.map((b) => b._id)).toEqual(['a', 'c']);
    expect([...result.current.bookmarkedPages]).toEqual([50, 2]);
    expect(result.current.bookmarksFailed).toBe(false);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ what: 'bookmarks', dropped: 3 }));
  });

  it('treats a reply that is not a list, or holds no list at all, as a failed load', async () => {
    for (const body of [{ success: true, data: { not: 'a list' } }, { success: true }, '<!doctype html>']) {
      vi.clearAllMocks();
      bookmarksAPI.list.mockResolvedValueOnce({ data: body });
      const { result, unmount } = renderHook(() => useBookmarks(props));
      await waitFor(() => expect(result.current.bookmarksFailed).toBe(true));
      expect(reportLoadFailure).toHaveBeenCalledWith(expect.any(Error), 'bookmarks');
      unmount();
    }
  });

  it('an add whose reply holds no bookmark changes nothing and says so', async () => {
    listReturns([{ _id: 'a', pageNumber: 50, label: '' }]);
    bookmarksAPI.add.mockResolvedValueOnce({ data: { success: true } });
    const showToast = vi.fn();
    const { result } = renderHook(() => useBookmarks({ ...props, showToast }));
    await waitFor(() => expect(result.current.bookmarks).toHaveLength(1));
    await act(() => result.current.addBookmark());
    expect(result.current.bookmarks.map((b) => b._id)).toEqual(['a']);
    expect(showToast).toHaveBeenLastCalledWith(expect.anything(), 'error');
  });

  it('asks for nothing while signed out', () => {
    const { result } = renderHook(() => useBookmarks({ ...props, signedIn: false }));
    expect(bookmarksAPI.list).not.toHaveBeenCalled();
    expect(result.current.bookmarks).toEqual([]);
  });
});
