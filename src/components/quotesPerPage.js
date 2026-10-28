// Owner console 2026-10-29 (L-29, typed: "...תיקון הריצוד ברשימת ההצעות..."): the rows-per-page measure must settle. On the Owner's screen
// the measure answered 5 with 4 rows shown and 4 with 5 rows shown, so the fifth row appeared and vanished on every frame. A value that
// comes back after a different one, at the same window size, is an oscillation: the page keeps the smaller of the two (the list never
// scrolls - L-29 "as many rows as fit") until the window size or the list itself changes (a new effect run starts a new memo).
export function createPerPageMemo() {
  return { key: '', history: [], lock: null };
}

export function settlePerPage(memo, key, n) {
  if (memo.key !== key) { memo.key = key; memo.history = []; memo.lock = null; }
  if (memo.lock !== null) return Math.min(n, memo.lock);
  const h = memo.history;
  if (h.length >= 2 && h[h.length - 2] === n && h[h.length - 1] !== n) {
    memo.lock = Math.min(n, h[h.length - 1]);
    return memo.lock;
  }
  if (h[h.length - 1] !== n) h.push(n);
  if (h.length > 8) h.shift();
  return n;
}
