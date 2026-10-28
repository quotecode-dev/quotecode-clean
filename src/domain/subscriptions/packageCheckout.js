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
  // Owner console 2026-10-25 (typed findings 1-13 approval): a failed renewal still being retried is paid on its standing order - the
  // server refuses a new page (payment_update_required), so no pay button is offered for it (pastDueLine says what to do)
  if (summary.subscriptionStatus === 'past_due' && summary.billing?.limited !== true) return false;
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

// ---------------------------------------------------------------------------------------------- SMART PACK for an active subscriber
// Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; 20261025300000): the pro-rata amount and the payment page come from the server
// (subscription-authority smart_pack_add_on_quote / smart_pack_add_on_intent); the browser never sends an amount.

/** may this account add SMART PACK now? (server summary only: Israel, billing on, a live package without SMART PACK; LIFETIME never) */
export function smartPackAddOnAvailable(summary, isLifetime = false) {
  if (isLifetime === true || summary?.state !== 'ready') return false;
  if (!['prepared', 'enforced'].includes(summary.phase?.billing) || summary.market !== 'IL') return false;
  return summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active' && summary.billing?.limited !== true
    && summary.billing?.renewalStopped !== true && summary.smartPack?.active !== true;
}

/** Owner console 2026-10-25 (typed findings 1-13 approval): the service mailbox of the account's market (the same as the cancellation
 *  request) - IL support@, otherwise info@ */
export function serviceMailbox(summary) {
  return summary?.state === 'ready' && summary.market === 'IL' ? 'support@tekango.com' : 'info@tekango.com';
}

/** the plans-window availability line when the account cannot buy here (Owner console 2026-10-25, findings 1-13): loading / not readable
 *  (with a retry) / a market where purchasing is not open yet / the plan system's billing off - or null (the window shows its own) */
export function plansAvailabilityLine(summary, isHebrew) {
  const s = summary?.state;
  if (s === 'loading') return { kind: 'loading', text: isHebrew ? 'טוען את פרטי החשבון…' : 'Loading your account details…' };
  if (s === 'unprovisioned') {
    return { kind: 'error', text: isHebrew ? 'החשבון עדיין לא שויך למסלול, ולכן אי אפשר לרכוש כרגע. אפשר לנסות שוב, או לכתוב לנו.' : 'Your account is not assigned to a plan yet, so nothing can be bought right now. You can try again, or write to us.' };
  }
  if (s === 'unavailable' || s === 'invalid') {
    return { kind: 'error', text: isHebrew ? 'לא הצלחנו לטעון את פרטי החשבון. אפשר לנסות שוב.' : 'We could not load your account details. You can try again.' };
  }
  if (s === 'ready' && ['prepared', 'enforced'].includes(summary.phase?.billing) && summary.market === 'INTERNATIONAL') {
    return { kind: 'closed_abroad', text: isHebrew ? 'הרכישה עדיין לא פתוחה בחשבונות מחוץ לישראל, ולא מתבצע חיוב.' : 'Purchasing is not open yet for accounts outside Israel, and nothing is charged.' };
  }
  return null;
}

/** the account's SMART PACK line under its plan (findings 1-13): active and how long - or null (none / LIFETIME has its own block) */
export function smartPackStatusLine(summary, isHebrew, formatDate) {
  if (summary?.state !== 'ready' || summary.smartPack?.active !== true) return null;
  const { source, until } = summary.smartPack;
  const date = until && typeof formatDate === 'function' ? formatDate(until) : null;
  if (source === 'free_window') {
    // the tip only where the pay button with the SMART PACK box exists (Israel, purchasing on)
    const tip = packageCheckoutAvailable(summary) ? (isHebrew ? ' כדי להמשיך איתו אחרי רכישת מנוי, סמנו את חכם פלוס בתשלום.' : ' To keep it after you subscribe, tick SMART PACK when you pay.') : '';
    return isHebrew
      ? `חכם פלוס כלול בימי החינם${date ? ` עד ${date}` : ''}.${tip}`
      : `SMART PACK is included in your free days${date ? ` until ${date}` : ''}.${tip}`;
  }
  if (source === 'add_on') {
    if (date) return isHebrew ? `חכם פלוס פעיל עד ${date}` : `SMART PACK is active until ${date}`;
    return isHebrew ? 'חכם פלוס פעיל, ומתחדש יחד עם המנוי' : 'SMART PACK is active and renews with your plan';
  }
  return null;
}

/** a failed renewal being retried (past_due, not limited yet): whom to write to (the status line above already says what happened) - or null */
export function pastDueLine(summary, isHebrew) {
  if (summary?.state !== 'ready' || summary.subscriptionStatus !== 'past_due' || summary.billing?.limited === true) return null;
  return {
    text: isHebrew ? 'לעדכון הכרטיס של המנוי כתבו לנו:' : 'To update the card of your subscription, write to us:',
    mail: serviceMailbox(summary),
  };
}

async function addOnCall(invoke, body) {
  let res;
  try { res = await invoke('subscription-authority', { body }); } catch { return { ok: false, code: 'checkout_unavailable' }; }
  const d = res?.data;
  if (d && d.ok === true) return d;
  let code = d && typeof d.code === 'string' ? d.code : null;
  if (!code) {
    try {
      const ctx = res?.error?.context;
      if (ctx && typeof ctx.json === 'function') {
        const b = await (typeof ctx.clone === 'function' ? ctx.clone() : ctx).json();
        if (b && typeof b.code === 'string') code = b.code;
      }
    } catch { /* unreadable body */ }
  }
  return { ok: false, code: code || 'checkout_unavailable' };
}

// ---------------------------------------------------------------------------------------------- SMART PACK removal
// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6 ..."): the date
// and the refund come from the server (subscription-authority smart_pack_removal_quote / smart_pack_removal_request).

/** may the window offer the removal? (server summary: Israel, an active package whose SMART PACK is a paid add-on; LIFETIME never) */
export function smartPackRemovalAvailable(summary, isLifetime = false) {
  if (isLifetime === true || summary?.state !== 'ready') return false;
  if (!['prepared', 'enforced'].includes(summary.phase?.billing) || summary.market !== 'IL') return false;
  return summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active' && summary.smartPack?.active === true && summary.smartPack.source === 'add_on';
}

/** -> { ok: true, period, effectiveAt, refundMinor } | { ok: false, code, effectiveAt? } */
export async function loadSmartPackRemovalQuote({ invoke }) {
  if (typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  const d = await addOnCall(invoke, { action: 'smart_pack_removal_quote' });
  if (d.ok !== true) return d;
  if (!['month', 'year'].includes(d.period) || typeof d.effectiveAt !== 'string' || !Number.isInteger(d.refundMinor) || d.refundMinor < 0) return { ok: false, code: 'checkout_unavailable' };
  return { ok: true, period: d.period, effectiveAt: d.effectiveAt, refundMinor: d.refundMinor };
}

/** -> { ok: true, state: 'removed' | 'pending' | 'refused', effectiveAt, refundMinor } | { ok: false, code } */
export async function removeSmartPack({ invoke, key = newCheckoutKey() }) {
  if (typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  const d = await addOnCall(invoke, { action: 'smart_pack_removal_request', idempotencyKey: key });
  if (d.ok === true && ['removed', 'pending', 'refused'].includes(d.state)) return { ok: true, state: d.state, effectiveAt: d.effectiveAt, refundMinor: Number.isInteger(d.refundMinor) ? d.refundMinor : 0 };
  return { ok: false, code: d.ok === true ? 'checkout_unavailable' : d.code };
}

export function smartPackRemovalErrorMessage(code, isHebrew) {
  if (code === 'pending') return isHebrew ? 'ההסרה בטיפול. נסו לפתוח שוב את חלון המסלולים בעוד כמה דקות.' : 'The removal is being processed. Open the plans window again in a few minutes.';
  if (code === 'refused') return isHebrew ? 'לא הצלחנו להסיר את חכם פלוס כרגע, והוא נשאר במנוי. כתבו לנו ונטפל בזה: support@tekango.com' : 'We could not remove SMART PACK right now, and it stays on your plan. Write to us and we will take care of it: support@tekango.com';
  if (code === 'retry_later') return isHebrew ? 'פעולה קודמת בחשבון עדיין בטיפול. נסו שוב בעוד כמה דקות.' : 'An earlier action on your account is still being processed. Try again in a few minutes.';
  return isHebrew ? 'לא ניתן להסיר את חכם פלוס כרגע. נסו שוב בעוד רגע.' : 'SMART PACK cannot be removed right now. Try again in a moment.';
}

/** -> { ok: true, amountMinor, recurringMinor, period, periodEnd } | { ok: false, code } */
export async function loadSmartPackAddOnQuote({ invoke }) {
  if (typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  const d = await addOnCall(invoke, { action: 'smart_pack_add_on_quote' });
  if (d.ok !== true) return d;
  if (d.currency !== 'ILS' || !Number.isInteger(d.amountMinor) || d.amountMinor <= 0 || !Number.isInteger(d.recurringMinor)
      || !['month', 'year'].includes(d.period) || typeof d.periodEnd !== 'string') return { ok: false, code: 'checkout_unavailable' };
  return { ok: true, amountMinor: d.amountMinor, recurringMinor: d.recurringMinor, period: d.period, periodEnd: d.periodEnd };
}

/** -> { ok: true, redirectUrl } | { ok: false, code } */
export async function startSmartPackAddOn({ invoke, key = newCheckoutKey() }) {
  if (typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  const d = await addOnCall(invoke, { action: 'smart_pack_add_on_intent', idempotencyKey: key });
  if (d.ok === true && typeof d.redirectUrl === 'string' && /^https:\/\//.test(d.redirectUrl)) return { ok: true, redirectUrl: d.redirectUrl };
  return { ok: false, code: d.ok === true ? 'checkout_unavailable' : d.code };
}

export function smartPackAddOnErrorMessage(code, isHebrew) {
  if (code === 'already_included') return isHebrew ? 'חכם פלוס כבר פעיל בחשבון. לא בוצע חיוב.' : 'SMART PACK is already active on this account. Nothing was charged.';
  if (code === 'not_eligible') return isHebrew ? 'אפשר להוסיף חכם פלוס רק למנוי פעיל. לא בוצע חיוב.' : 'SMART PACK can be added only to an active package. Nothing was charged.';
  return checkoutErrorMessage(code, isHebrew);
}

export function checkoutErrorMessage(code, isHebrew) {
  if (code === 'already_subscribed') {
    return isHebrew ? 'בחשבון הזה כבר יש מנוי פעיל. דף התשלום לא נפתח.' : 'This account already has an active package. No payment page was opened.';
  }
  if (code === 'market_not_open') {
    return isHebrew ? 'הרכישה עדיין לא פתוחה בחשבונות בחו"ל. לא בוצע חיוב.' : 'Purchasing is not open yet for accounts outside Israel. Nothing was charged.';
  }
  if (code === 'payment_update_required') {
    return isHebrew ? 'החיוב האחרון לא עבר. יתבצע ניסיון חיוב נוסף. לעדכון הכרטיס כתבו לנו: support@tekango.com' : 'The last charge did not go through and is being retried. To update the card, write to us: support@tekango.com';
  }
  return isHebrew ? 'לא ניתן לפתוח את דף התשלום כרגע. לא בוצע חיוב. נסו שוב בעוד רגע.' : 'The payment page cannot be opened right now. Nothing was charged. Try again in a moment.';
}

// ---------------------------------------------------------------------------------------------- back from the payment page
// Owner console 2026-10-21 (same typed L-22 / L-01 approval): the payment page returns to /dashboard?billing=processing | failed |
// cancelled (subscription-authority payplus.ts PAYPLUS_RETURN_PATHS). The address only picks the words while waiting; "active" comes
// ONLY from the server account summary (a verified payment), which also wins over a failed / cancelled address.
// 20261025300000: + back from a SMART PACK add-on page (payplus.ts PAYPLUS_RETURN_PATHS addOnSuccess / addOnFailure / addOnCancel)
export const BILLING_RETURN_KINDS = Object.freeze(['processing', 'failed', 'cancelled', 'smart_pack', 'smart_pack_failed', 'smart_pack_cancelled']);
export const isAddOnReturn = (kind) => kind === 'smart_pack' || kind === 'smart_pack_failed' || kind === 'smart_pack_cancelled';
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
  // a SMART PACK add-on: 'confirmed' only when the server says SMART PACK is active (the package was active already)
  if (isAddOnReturn(kind)) {
    if (summary.smartPack?.active === true) return 'confirmed';
    if (kind === 'smart_pack_failed') return 'failed';
    if (kind === 'smart_pack_cancelled') return 'cancelled';
    return elapsedMs >= BILLING_RETURN_WAIT_MS ? 'timeout' : 'waiting';
  }
  const active = summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active' && summary.billing?.limited !== true;
  if (active) return 'confirmed'; // the server wins over the address
  if (kind === 'failed' || kind === 'cancelled') return kind;
  return elapsedMs >= BILLING_RETURN_WAIT_MS ? 'timeout' : 'waiting';
}

/** the words of a return state (HE / EN); smartPack = the server SMART PACK state (the plan itself is on the line below);
 *  addOn = back from a SMART PACK add-on page (20261025300000) */
export function billingReturnText(state, isHebrew, { smartPack = false, addOn = false } = {}) {
  if (addOn) {
    switch (state) {
      case 'waiting': return isHebrew ? 'מאמתים את התשלום… חכם פלוס ייפתח רק אחרי שהתשלום יאושר.' : 'Confirming your payment… SMART PACK opens only after the payment is confirmed.';
      case 'confirmed': return isHebrew ? 'התשלום אושר. חכם פלוס פעיל.' : 'Payment confirmed. SMART PACK is active.';
      case 'timeout': return isHebrew ? 'האישור על התשלום עדיין לא הגיע. אפשר לבדוק שוב בעוד רגע. אם בוצע חיוב וחכם פלוס לא נפתח, כתבו לנו ונטפל בזה.' : 'The payment confirmation has not arrived yet. You can check again in a moment. If you were charged and SMART PACK did not open, write to us and we will fix it.';
      case 'failed': return isHebrew ? 'התשלום לא הושלם וחכם פלוס לא נוסף. אפשר לנסות שוב.' : 'The payment was not completed, and SMART PACK was not added. You can try again.';
      case 'cancelled': return isHebrew ? 'התשלום בוטל. לא בוצע חיוב.' : 'The payment was cancelled. Nothing was charged.';
      default: return '';
    }
  }
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
