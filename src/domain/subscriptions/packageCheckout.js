// PayPlus stage 2 (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: כפתור לתשלום במסך המסלולים, ותיבת חכם פלוס שנוספת לאותו תשלום"):
// the plans-window "pay" action. It asks the server (subscription-authority checkout_intent) for a payment page of the server attempt -
// the amount, the currency and the SMART PACK line are the server's (create_package_checkout_intent + the price catalog), never a client
// value - and only then leaves for the PayPlus page. A redirect is NOT a subscription: the package opens only after a verified PayPlus
// payment. Shown only when the server billing phase is on ('prepared' TEST / 'enforced'); today it is 'off', so nothing is shown.

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

/** May this account open a payment page now? (server summary only; LIFETIME never; an active package only when limited) */
export function packageCheckoutAvailable(summary, isLifetime = false) {
  if (isLifetime === true || summary?.state !== 'ready') return false;
  if (!['prepared', 'enforced'].includes(summary.phase?.billing)) return false;
  if (summary.planId === 'all_inclusive' && summary.subscriptionStatus === 'active') return summary.billing?.limited === true;
  if (summary.planId !== 'free' && summary.planId !== 'all_inclusive') return false; // a legacy style plan pays for nothing
  return true;
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
    return isHebrew ? 'לחשבון הזה כבר יש חבילה פעילה. לא נפתח דף תשלום.' : 'This account already has an active package. No payment page was opened.';
  }
  if (code === 'payment_update_required') {
    return isHebrew ? 'החיוב האחרון לא עבר, והוא ינוסה שוב. לעדכון הכרטיס פנו אלינו במייל.' : 'The last charge did not go through and is being retried. To update the card, email us.';
  }
  return isHebrew ? 'לא ניתן לפתוח את דף התשלום כרגע. לא בוצע חיוב. נסו שוב בעוד רגע.' : 'The payment page cannot be opened right now. Nothing was charged. Try again in a moment.';
}
