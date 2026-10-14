// Task 20 - the FIRST VIEW OF THE QUOTE LINK ("צפייה בקישור ההצעה" / "Quote link viewed"): an indication that the link was opened, never a
// certain identification of the customer (a signed-out owner or an unknown scanner could also open it). The public quote page asks the
// server to record it only after the
// document was actually VISIBLE on screen for MIN_VISIBLE_MS in total (a background tab, a prerender or a link scanner that never shows
// the page does not count). The server (public.public_record_quote_first_view) decides the rest: never the issuing tenant, never a
// known bot / scanner user agent, written once and never reset. An email open is never used for this.
export const MIN_VISIBLE_MS = 5000;

// PRODUCT_TRUTH_CAPABILITY: quote_link_view
// Starts the visibility-aware wait; returns a cancel function. `record()` is called at most once.
export function scheduleFirstViewRecord({ record, doc = typeof document !== 'undefined' ? document : null, minVisibleMs = MIN_VISIBLE_MS, setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() }) {
  if (!doc || typeof record !== 'function') return () => {};
  let visibleSince = null;
  let accumulated = 0;
  let timer = null;
  let done = false;
  const fire = () => { if (done) return; done = true; cleanup(); try { record(); } catch { /* fire-and-forget */ } };
  const arm = () => { timer = setTimer(() => { accumulated += now() - visibleSince; visibleSince = now(); if (accumulated >= minVisibleMs) fire(); else arm(); }, Math.max(0, minVisibleMs - accumulated)); };
  const onVisibility = () => {
    if (done) return;
    if (doc.visibilityState === 'visible') {
      if (visibleSince === null) { visibleSince = now(); arm(); }
    } else if (visibleSince !== null) {
      accumulated += now() - visibleSince;
      visibleSince = null;
      if (timer !== null) { clearTimer(timer); timer = null; }
    }
  };
  function cleanup() { if (timer !== null) clearTimer(timer); timer = null; doc.removeEventListener?.('visibilitychange', onVisibility); }
  doc.addEventListener?.('visibilitychange', onVisibility);
  onVisibility();
  return () => { done = true; cleanup(); };
}
