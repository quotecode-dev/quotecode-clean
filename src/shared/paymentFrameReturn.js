// Owner console 2026-11-10 (the PayPlus payment page in a window above the app, components/PaymentFrame.jsx): the payment page returns
// to /dashboard?billing=<kind> INSIDE that window. That page must not start a second copy of the app inside the window: it hands the
// return kind to the app behind it (same origin only) and shows one short line until the window closes.
const KINDS = ['processing', 'failed', 'cancelled', 'smart_pack', 'smart_pack_failed', 'smart_pack_cancelled'];
export const PAYMENT_FRAME_RETURN = 'tekango:billing-return';
export const PAYMENT_FRAME_LOAD_MS = 20000;
// set on the app window while the payment window is open (read by a page of this site that loads inside it)
export const PAYMENT_WINDOW_OPEN = '__tekangoPaymentWindowOpen';
// only the PayPlus payment pages open in the window; anything else keeps the full-page departure
export const framedPaymentUrl = (url) => typeof url === 'string' && /^https:\/\/payments\.payplus\.co\.il\//.test(url);

/** -> true when this page is the payment return inside the payment window (handled here; the app must not start) */
export function handOffBillingReturnInFrame(win = window) {
  const framed = (() => { try { return win.self !== win.top; } catch { return true; } })();
  if (!framed) return false;
  const kind = (() => { try { return String(new URLSearchParams(win.location.search).get('billing') || '').split('?')[0]; } catch { return null; } })();
  // any other page of this site inside the payment window ("Back to website" on the payment page): close the window, start nothing
  const inPaymentWindow = (() => { try { return win.parent[PAYMENT_WINDOW_OPEN] === true; } catch { return false; } })();
  if (!KINDS.includes(kind)) {
    if (!inPaymentWindow) return false;
    try { win.parent.postMessage({ type: PAYMENT_FRAME_RETURN, close: true }, win.location.origin); } catch { /* the window keeps its X */ }
    return true;
  }
  try { win.parent.postMessage({ type: PAYMENT_FRAME_RETURN, kind }, win.location.origin); } catch { /* the window stays; "Open as a full page" remains */ }
  try {
    const he = (win.document.documentElement.lang || '') !== 'en' && !/[?&]lang=en\b/.test(win.location.search);
    const root = win.document.getElementById('root') || win.document.body;
    root.textContent = he ? 'חוזרים לאפליקציה...' : 'Returning to the app...';
  } catch { /* nothing to show */ }
  return true;
}
