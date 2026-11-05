import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useBookmarks } from './useBookmarks';
import { bookmarksAPI } from '../services/api';
import { reportError } from '../utils/reportError';

vi.mock('../services/api', () => ({ bookmarksAPI: { list: vi.fn() } }));
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

  it('treats a reply that is not a list as a failed load', async () => {
    listReturns({ not: 'a list' });
    const { result } = renderHook(() => useBookmarks(props));
    await waitFor(() => expect(result.current.bookmarksFailed).toBe(true));
    expect(result.current.bookmarks).toEqual([]);
  });

  it('asks for nothing while signed out', () => {
    const { result } = renderHook(() => useBookmarks({ ...props, signedIn: false }));
    expect(bookmarksAPI.list).not.toHaveBeenCalled();
    expect(result.current.bookmarks).toEqual([]);
  });
});
