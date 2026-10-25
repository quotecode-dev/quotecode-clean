// PayPlus stage 2 (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: כפתור לתשלום במסך המסלולים, ותיבת חכם פלוס שנוספת לאותו תשלום"):
// the plans-window "pay" action. It asks the server (subscription-authority checkout_intent) for a payment page of the server attempt -
// the amount, the currency and the SMART PACK line are the server's (create_package_checkout_intent + the price catalog), never a client
// value - and only then leaves for the PayPlus page. A redirect is NOT a subscription: the package opens only after a verified PayPlus
// payment. Shown only when the server billing phase is on ('prepared' TEST / 'enforced') and the account is Israeli (2026-10-25: Israel only).

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** May this account open a payment page now? (server summary only; LIFETIME never; an active package only when limited)
 *  Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22 וב-L-01: מסך החזרה מהתשלום בחלון המסלולים, ותיקון הנוסח, הכפתור והשוק בחלון
 *  המסלולים"): Israel only - the payment connector charges ILS only, so an international account never gets a button that cannot work. */
export function packageCheckoutAvailable(summary, isLifetime = false) {
  if (isLifetime === true || summary?.state !== 'ready') return false;
  if (!['prepared', 'enforced'].includes(summary.phase?.billing)) return false;
  if (summary.market !== 'IL') return false;
  if (summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active') return summary.billing?.limited === true;
  if (summary.planId !== 'free' && summary.planId !== 'all_inclusive') return false; // a legacy style plan pays for nothing
  return true;
}

/** Owner 2026-10-25 ("לא להשאיר זנבות"): is purchasing open for this account's market (Israel, billing on)? Then no "cannot be
 *  purchased yet" line is ever shown to it - even to an account that has nothing to buy (Lifetime, a legacy plan). */
export function israelPurchaseOpen(summary) {
  return summary?.state === 'ready' && ['prepared', 'enforced'].includes(summary.phase?.billing) && summary.market === 'IL';
}

/** one idempotency key per click: 32 random characters of the server's [A-Za-z0-9_-] alphabet */
export function newCheckoutKey(random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(32);
  return `pkg_${Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join('')}`;
}

/** -> { ok: true, redirectUrl } | { ok: false, code } */
export async function startPackageCheckout({ billingPeriod, smartPack = false, invoke, key = newCheckoutKey() }) {
  if (!['month', 'year'].includes(billingPeriod) || typeof smartPack !== 'boolean' || typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  let res;
  try {
    res = await invoke('subscription-authority', { body: { action: 'checkout_intent', planId: 'all_inclusive', billingPeriod, smartPack, blocks: 0, idempotencyKey: key } });
  } catch {
    return { ok: false, code: 'checkout_unavailable' };
  }
  const d = res?.data;
  if (d && d.ok === true && typeof d.redirectUrl === 'string' && /^https:\/\//.test(d.redirectUrl)) return { ok: true, redirectUrl: d.redirectUrl };
  let code = d && typeof d.code === 'string' ? d.code : null;
  if (!code) {
    try {
      const ctx = res?.error?.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await (typeof ctx.clone === 'function' ? ctx.clone() : ctx).json();
        if (body && typeof body.code === 'string') code = body.code;
      }
    } catch { /* unreadable body */ }
  }
  return { ok: false, code: code || 'checkout_unavailable' };
}

export function checkoutErrorMessage(code, isHebrew) {
  if (code === 'already_subscribed') {
    return isHebrew ? 'בחשבון הזה כבר יש מנוי פעיל. דף התשלום לא נפתח.' : 'This account already has an active package. No payment page was opened.';
  }
  if (code === 'market_not_open') {
    return isHebrew ? 'הרכישה עדיין לא פתוחה בחשבונות בחו"ל. לא בוצע חיוב.' : 'Purchasing is not open yet for accounts outside Israel. Nothing was charged.';
  }
  if (code === 'payment_update_required') {
    return isHebrew ? 'החיוב האחרון לא עבר. יתבצע ניסיון חיוב נוסף. לעדכון הכרטיס פנו אלינו במייל.' : 'The last charge did not go through and is being retried. To update the card, email us.';
  }
  return isHebrew ? 'לא ניתן לפתוח את דף התשלום כרגע. לא בוצע חיוב. נסו שוב בעוד רגע.' : 'The payment page cannot be opened right now. Nothing was charged. Try again in a moment.';
}

// ---------------------------------------------------------------------------------------------- back from the payment page
// Owner console 2026-10-21 (same typed L-22 / L-01 approval): the payment page returns to /dashboard?billing=processing | failed |
// cancelled (subscription-authority payplus.ts PAYPLUS_RETURN_PATHS). The address only picks the words while waiting; "active" comes
// ONLY from the server account summary (a verified payment), which also wins over a failed / cancelled address.
export const BILLING_RETURN_KINDS = Object.freeze(['processing', 'failed', 'cancelled']);
export const BILLING_RETURN_POLL_MS = 3000;
export const BILLING_RETURN_WAIT_MS = 90000;

/** the return kind in a location search string, or null (a provider that appends '?x=…' to our value is tolerated) */
export function billingReturnFromSearch(search) {
  try {
    const v = String(new URLSearchParams(String(search || '')).get('billing') || '').split('?')[0];
    return BILLING_RETURN_KINDS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** the address after a return: only the app's own ?lang= stays (the payment page's parameters never reach history) */
export function searchWithoutBillingReturn(search) {
  let lang;
  try { lang = new URLSearchParams(String(search || '')).get('lang'); } catch { lang = null; }
  return lang === 'he' || lang === 'en' ? `?lang=${lang}` : '';
}

/** 'confirmed' | 'waiting' | 'timeout' | 'failed' | 'cancelled' | null (plans system off / not ready: nothing to show) */
export function billingReturnState(kind, summary, elapsedMs) {
  if (!BILLING_RETURN_KINDS.includes(kind) || summary?.state !== 'ready') return null;
  if (!['prepared', 'enforced'].includes(summary.phase?.billing)) return null;
  const active = summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active' && summary.billing?.limited !== true;
  if (active) return 'confirmed'; // the server wins over the address
  if (kind === 'failed' || kind === 'cancelled') return kind;
  return elapsedMs >= BILLING_RETURN_WAIT_MS ? 'timeout' : 'waiting';
}

/** the words of a return state (HE / EN); smartPack = the server SMART PACK state (the plan itself is on the line below) */
export function billingReturnText(state, isHebrew, { smartPack = false } = {}) {
  switch (state) {
    case 'waiting':
      return isHebrew ? 'מאמתים את התשלום… המסלול יופעל רק אחרי שהתשלום יאושר.' : 'Confirming your payment… Your package opens only after the payment is confirmed.';
    case 'confirmed':
      return (isHebrew ? 'התשלום אושר.' : 'Payment confirmed.') + (smartPack ? (isHebrew ? ' חכם פלוס פעיל.' : ' SMART PACK is active.') : '');
    case 'timeout':
      // Owner console 2026-10-25 (typed L-22 ...): no promise the system cannot keep - check again, or write to us
      return isHebrew ? 'האישור על התשלום עדיין לא הגיע. אפשר לבדוק שוב בעוד רגע. אם בוצע חיוב והמסלול לא נפתח, כתבו לנו ונטפל בזה.' : 'The payment confirmation has not arrived yet. You can check again in a moment. If you were charged and your package did not open, write to us and we will fix it.';
    case 'failed':
      return isHebrew ? 'התשלום לא הושלם והמסלול לא הופעל. אפשר לנסות שוב.' : 'The payment was not completed, and no package was opened. You can try again.';
    case 'cancelled':
      return isHebrew ? 'התשלום בוטל. לא בוצע חיוב.' : 'The payment was cancelled. Nothing was charged.';
    default:
      return '';
  }
}
