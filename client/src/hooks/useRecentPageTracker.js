import { useCallback, useEffect, useRef } from 'react';
import { recordRecentPage } from '../services/recentPages';

// How long a page has to stay in front of the reader to count as read.
export const DWELL_MS = 8000;
// A burst of clicks on one page writes the list once, not once per click.
const INTERACTION_REFRESH_MS = 15000;

// Visible time spent on an arrival so far.
const accrued = (a) => a.accrued + (a.since != null ? performance.now() - a.since : 0);
const record = (a) => {
  a.recordedAt = performance.now();
  recordRecentPage(a.pages, a.page);
};

// Decides which pages go into the recent-pages list (services/recentPages.js).
//
// A page counts as READ when the reader actually spent time on it:
//   - it stayed on screen DWELL_MS — VISIBLE time only (a background tab isn't
//     being read), so flipping, the scrubber and a quick look don't count; or
//   - they did something on it — selected a verse, annotated, bookmarked, ticked
//     it, revealed a verse in the self-test. The Library calls `noteInteraction`
//     from those handlers (only from the reader's own input, never from a
//     selection the app makes itself, such as the recitation's follow-along).
//
// The recitation is the exception. While it plays and the page follows it, the
// pages it turns to are passed through, not read: none of them counts by time.
// The page where listening STOPS is what's recorded — whatever paused or ended it.
// If the reader takes the wheel instead (turns the page by hand while it plays),
// the page they leave counts if they were on it long enough, and from then on the
// pages are theirs again and count normally.
//
// What is on screen is ONE arrival: a single page or a spread (one entry for
// both). `pages` is that set, `page` the page the reader is on; `active` holds
// everything until the Library has settled on its landing page.
export function useRecentPageTracker({ pages, page, active, isPlaying, isFollowingAudio, turnByAudioRef }) {
  const key = pages.join('-');
  const arrivalRef = useRef(null);   // { key, pages, page, accrued, since, recordedAt }
  const timerRef = useRef(null);
  const followingRef = useRef(isFollowingAudio);
  useEffect(() => { followingRef.current = isFollowingAudio; });

  // Count time only while it can be read; when the dwell is reached, record —
  // unless the recitation is carrying the reader along (then the stop decides).
  const arm = useCallback(() => {
    clearTimeout(timerRef.current);
    const a = arrivalRef.current;
    if (!a || a.recordedAt != null || a.since == null) return;
    timerRef.current = setTimeout(() => {
      if (arrivalRef.current !== a || a.recordedAt != null) return;
      if (followingRef.current()) return;
      record(a);
    }, Math.max(0, DWELL_MS - accrued(a)));
  }, []);

  // A new arrival. The one before is settled first: a page the reader leaves by
  // their own turn counts if its time was up (it can only be unrecorded then if
  // the recitation was playing on it); one the recitation turned away from doesn't.
  useEffect(() => {
    if (!active) return;
    const prev = arrivalRef.current;
    if (prev?.key === key) {
      prev.page = page;   // the same spread, entered from its other half
      return;
    }
    if (prev && prev.recordedAt == null && !turnByAudioRef.current && accrued(prev) >= DWELL_MS) record(prev);
    const visible = document.visibilityState === 'visible';
    arrivalRef.current = { key, pages, page, accrued: 0, since: visible ? performance.now() : null, recordedAt: null };
    arm();
    // `pages` is read through `key`; `page` only changes with it or within a spread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, page, arm]);

  // Hidden: bank the time and stop counting. Shown again: carry on.
  useEffect(() => {
    const onVisibility = () => {
      const a = arrivalRef.current;
      if (!a) return;
      if (document.visibilityState === 'visible') {
        if (a.since == null) a.since = performance.now();
      } else if (a.since != null) {
        a.accrued += performance.now() - a.since;
        a.since = null;
      }
      arm();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timerRef.current);
    };
  }, [arm]);

  // Listening stopped (pause, the end of a range, an error): this page counts.
  const wasPlayingRef = useRef(isPlaying);
  useEffect(() => {
    const was = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;
    if (!was || isPlaying || !active) return;
    const a = arrivalRef.current;
    if (a) record(a);
  }, [isPlaying, active]);

  // The reader did something on the page(s) on screen.
  return useCallback(() => {
    const a = arrivalRef.current;
    if (!a) return;
    if (a.recordedAt != null && performance.now() - a.recordedAt < INTERACTION_REFRESH_MS) return;
    clearTimeout(timerRef.current);
    record(a);
  }, []);
}
