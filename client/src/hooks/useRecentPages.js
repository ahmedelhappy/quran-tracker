import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeRecentPages, getRecentPages } from '../services/recentPages';
import { describeRecent } from '../utils/recentPageLabels';
import { toArabicDigits } from '../utils/formatNumber';

// The recently read pages (services/recentPages.js), live: a change in this tab or
// another re-renders whoever shows them.
export const useRecentPages = () => useSyncExternalStore(subscribeRecentPages, getRecentPages);

// "Now" for the "5 min ago" labels: refreshed every 30 s while a list that shows
// them is up (`on`), and no clock runs while none is. It is read fresh the moment
// a list comes up (useSyncExternalStore re-reads the snapshot after subscribing).
// Only the lists subscribe — never the Library itself, which must not re-render
// for a clock.
const CLOCK_MS = 30000;
let clockNow = Date.now();
let clockId = null;
const clockSubs = new Set();
const subscribeClock = (fn) => {
  clockSubs.add(fn);
  if (clockId == null) {
    clockNow = Date.now();
    clockId = setInterval(() => {
      clockNow = Date.now();
      clockSubs.forEach((f) => f());
    }, CLOCK_MS);
  }
  return () => {
    clockSubs.delete(fn);
    if (!clockSubs.size) { clearInterval(clockId); clockId = null; }
  };
};
const noSubscribe = () => () => {};
const getClock = () => clockNow;
export const useNow = (on = true) => useSyncExternalStore(on ? subscribeClock : noSubscribe, getClock);

// The list as the lists show it: newest first, without the page(s) on screen
// (`exclude`), each entry described for the interface's language.
export const useRecentRows = (exclude, on = true) => {
  const { t, i18n } = useTranslation();
  const list = useRecentPages();
  const now = useNow(on);
  const isArabic = i18n.language === 'ar';
  const fmtNum = (n) => (isArabic ? toArabicDigits(n) : String(n));
  return list
    .filter((e) => !e.pages.some((p) => exclude.includes(p)))
    .map((e) => describeRecent(e, now, { t, fmtNum, isArabic }));
};
