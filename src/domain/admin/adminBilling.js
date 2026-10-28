// L-22 (Owner console 2026-10-28: the subscription & payment card, docs/ADMIN_BILLING_BUTTONS_PLAN_2026-10-22.md, typed "... - מאשר"):
// the client side of the admin-billing function (Terms section 6). Every amount comes from the server's preview; a protected action is
// the shared two-step flow - admin-reauth-verify mints a single-use proof bound to the SAME params the server claims (admin-billing/lib.ts):
//   stop_renewal / end_early: { reason, waiveFee, expectedRefundMinor }; resolve: { reason, actionId, stoppedAtPayPlus };
//   settle_refund: { reason, actionId }. The invoke function is injected ({ data, error } like supabase.functions.invoke).
import { QUOTE_CURRENCY_SYMBOLS, formatMoneyForCurrency } from '../../utils/money';

export const BILLING_PROOF_ACTIONS = Object.freeze({
  stop_renewal: 'billing_stop_renewal', end_early: 'billing_end_early', resolve: 'billing_resolve', settle_refund: 'billing_settle_refund',
  // Codex N03 (Owner 2026-10-28, decision 1): an owed SMART PACK removal refund made in PayPlus - the same proof kind as settle_refund
  settle_removal_refund: 'billing_settle_refund',
});

/** a function answer as { ok, ...body } - a non-2xx answer carries the server's own code in its body */
async function answer(r) {
  if (r && !r.error && r.data && typeof r.data === 'object') return r.data;
  const body = await r?.error?.context?.json?.().catch(() => null);
  return body && typeof body === 'object' ? { ok: false, ...body } : { ok: false, code: 'retry_later' };
}

export async function billingPreview(invoke, targetUserId, waiveFee = false) {
  try { return await answer(await invoke('admin-billing', { body: { action: 'preview', targetUserId, waiveFee } })); }
  catch { return { ok: false, code: 'retry_later' }; }
}

export function billingParams(action, { reason, waiveFee = false, expectedRefundMinor = 0, actionId = null, stoppedAtPayPlus = null, ...rest }) {
  const r = String(reason || '').trim();
  if (action === 'resolve') return { reason: r, actionId, stoppedAtPayPlus };
  if (action === 'settle_refund') return { reason: r, actionId };
  if (action === 'settle_removal_refund') return { reason: r, removalId: rest.removalId, refundRef: String(rest.refundRef || '').trim() };
  return { reason: r, waiveFee, expectedRefundMinor };
}

export async function runBillingAction(invoke, { action, targetUserId, password, ...rest }) {
  const params = billingParams(action, rest);
  let proofToken;
  try {
    const v = await invoke('admin-reauth-verify', { body: { action: BILLING_PROOF_ACTIONS[action], targetUserId, params, password } });
    proofToken = !v?.error && v?.data?.success ? v.data.proofToken : null;
  } catch { proofToken = null; }
  if (!proofToken) return { ok: false, code: 'reauth_failed' };
  try { return await answer(await invoke('admin-billing', { body: { action, targetUserId, proofToken, ...params } })); }
  catch { return { ok: false, code: 'retry_later' }; }
}

/** the card is shown for a paid package, an open action or a refund still owed - never for free / Lifetime / billing off */
export function billingCardVisible(p) {
  return !!p && (p.ok === true || !!p.unsettledRefund || !!p.openAction);
}

// IRON-ILS-001: every amount through the one money formatter (a shekel amount is shown in whole shekels)
export function billingMoney(minor, currency) {
  if (!Number.isInteger(minor) || !currency) return '—';
  return `${QUOTE_CURRENCY_SYMBOLS[currency] || `${currency} `}${formatMoneyForCurrency(minor / 100, currency)}`;
}
// L-22 (Owner 2026-10-28, "החזר בקירוב במסך" - "לכתוב על ההחזר 25 ש"ח בקירוב ולא לשנות את החוק"): a refund amount the whole-shekel
// display rounds says it is approximate (the server refunds the exact agorot); a whole amount stays as it is
export function billingRefundMoney(minor, currency, isHebrew) {
  const m = billingMoney(minor, currency);
  if (!Number.isInteger(minor) || currency !== 'ILS' || minor % 100 === 0) return m;
  return isHebrew ? `כ־${m} (בקירוב)` : `about ${m} (approximately)`;
}

export const BILLING_COPY = Object.freeze({
  title: { he: 'מנוי ותשלום', en: 'Subscription & payment' },
  plan: { he: 'מסלול', en: 'Plan' },
  month: { he: 'חודשי', en: 'Monthly' },
  year: { he: 'שנתי', en: 'Yearly' },
  paidThrough: { he: 'שולם עד', en: 'Paid through' },
  renewal: { he: 'חידוש', en: 'Renewal' },
  renewalActive: { he: 'פעיל', en: 'Active' },
  renewalStopped: { he: 'הופסק', en: 'Stopped' },
  noStandingOrder: { he: 'אין הוראת קבע', en: 'No standing order' },
  limitedOn: { he: 'החשבון יוגבל ב־{d}', en: 'The account is limited on {d}' },
  openRefund: { he: 'החזר פתוח', en: 'Open refund' },
  openAction: { he: 'פעולה שנקטעה', en: 'Interrupted action' },
  startedAt: { he: 'התחילה ב־{d}', en: 'Started {d}' },
  settleButton: { he: 'אישור שההחזר בוצע בפיי פלוס', en: 'Confirm the refund was made in PayPlus' },
  resolveButton: { he: 'סגירת הפעולה', en: 'Close the action' },
  stopButton: { he: 'הפסקת חידוש', en: 'Stop renewal' },
  endButton: { he: 'סיום מוקדם והחזר', en: 'End early & refund' },
  unavailable: { he: 'מצב המנוי והתשלום לא זמין כרגע.', en: 'The subscription & payment state is unavailable right now.' },
  paid: { he: 'שולם', en: 'Paid' },
  periodDays: { he: 'לתקופה של {n} ימים', en: 'for a {n}-day period' },
  unusedDays: { he: 'ימים שלא נוצלו (מסוף היום)', en: 'Unused days (from the end of today)' },
  prorated: { he: 'החלק היחסי', en: 'The prorated part' },
  fee: { he: 'דמי ביטול (5%)', en: 'Cancellation fee (5%)' },
  waiveFee: { he: 'בלי דמי ביטול', en: 'No cancellation fee' },
  refund: { he: 'יוחזר', en: 'Refunded' },
  stopBody: { he: 'הוראת הקבע בפיי פלוס תבוטל. המנוי ממשיך עד {d}, ובסוף התקופה החשבון עובר מיד למצב מוגבל. אין החזר.',
    en: 'The PayPlus standing order is cancelled. The subscription continues until {d}, then the account is limited at once. No refund.' },
  endBody: { he: 'הגישה נמשכת עד חצות הלילה. הוראת הקבע תבוטל, ורק אחרי שהשרת רושם את הסיום יישלח ההחזר.',
    en: 'Access continues until midnight. The standing order is cancelled, and the refund is sent only after the server records the end.' },
  endConfirm: { he: 'סיום והחזר {m}', en: 'End and refund {m}' },
  resolveBody: { he: 'הפעולה מ־{d} נקטעה באמצע. בדקו בממשק של פיי פלוס אם הוראת הקבע של הלקוח נעצרה.',
    en: 'The action from {d} was interrupted. Check in the PayPlus panel whether the customer\'s standing order was stopped.' },
  stoppedThere: { he: 'נעצרה בפיי פלוס', en: 'Stopped in PayPlus' },
  notStoppedThere: { he: 'לא נעצרה', en: 'Not stopped' },
  settleBody: { he: 'החזר של {m} פתוח. אשרו רק אחרי שראיתם בממשק של פיי פלוס שההחזר בוצע.',
    en: 'A refund of {m} is open. Confirm only after you saw in the PayPlus panel that the refund was made.' },
});

export const REFUND_STATE = Object.freeze({
  not_sent: { he: 'עוד לא נשלח', en: 'Not sent yet' },
  sending: { he: 'נשלח, ממתין לאישור', en: 'Sent, waiting for confirmation' },
  failed: { he: 'נכשל', en: 'Failed' },
  manual: { he: 'ידני', en: 'Manual' },
});

export const KIND_NAMES = Object.freeze({
  stop_renewal: { he: 'הפסקת חידוש', en: 'Stop renewal' },
  end_early: { he: 'סיום מוקדם והחזר', en: 'End early & refund' },
});

const CODE_TEXT = {
  reauth_failed: { he: 'סיסמת המנהל שגויה, או שהאימות נכשל. שום דבר לא השתנה.', en: 'Wrong admin password, or the verification failed. Nothing changed.' },
  reauth_required: { he: 'האימות פג או לא תאם. נסו שוב.', en: 'The verification expired or did not match. Try again.' },
  billing_off: { he: 'החיוב כבוי בשרת.', en: 'Billing is off on the server.' },
  lifetime_account: { he: 'לחשבון יש מנוי לכל החיים.', en: 'The account has a Lifetime subscription.' },
  no_live_package: { he: 'אין לחשבון מנוי ששולם.', en: 'The account has no paid subscription.' },
  already_stopped: { he: 'החידוש כבר הופסק.', en: 'The renewal is already stopped.' },
  already_ended: { he: 'המנוי כבר הסתיים.', en: 'The subscription has already ended.' },
  no_standing_order: { he: 'אין הוראת קבע לעצור.', en: 'There is no standing order to stop.' },
  action_in_progress: { he: 'יש פעולה פתוחה בחשבון. סגרו אותה קודם.', en: 'An action is open on this account. Close it first.' },
  already_finished: { he: 'הפעולה כבר נסגרה.', en: 'The action is already closed.' },
  too_early_to_resolve: { he: 'אפשר לסגור פעולה רק 5 דקות אחרי שהתחילה.', en: 'An action can be closed only 5 minutes after it began.' },
  no_open_action: { he: 'אין פעולה פתוחה.', en: 'There is no open action.' },
  no_unsettled_refund: { he: 'אין החזר פתוח.', en: 'There is no open refund.' },
  provider_unavailable: { he: 'החיבור לפיי פלוס לא מוגדר בשרת. שום דבר לא השתנה.', en: 'The PayPlus connection is not set on the server. Nothing changed.' },
  cancel_outcome_unknown: { he: 'פיי פלוס לא ענו. בדקו בממשק שלהם אם הוראת הקבע נעצרה, ואז סגרו את הפעולה.', en: 'PayPlus did not answer. Check in their panel whether the standing order stopped, then close the action.' },
  finish_not_recorded: { he: 'הסיום לא נרשם בשרת. בדקו בפיי פלוס וסגרו את הפעולה.', en: 'The end was not recorded on the server. Check PayPlus and close the action.' },
  forbidden: { he: 'אין הרשאה לפעולה הזו.', en: 'Not allowed.' },
  invalid_request: { he: 'הבקשה לא תקינה. שום דבר לא השתנה.', en: 'Invalid request. Nothing changed.' },
  // L-22 (Owner 2026-10-28, "הודעה ברורה כשהתקופה הבאה כבר שולמה")
  future_period_paid: { he: 'התקופה הבאה כבר שולמה. קודם מחזירים בממשק של פיי פלוס את החיוב של התקופה הבאה, ורק אחר כך מסיימים את המנוי. שום דבר לא השתנה.',
    en: 'The next period is already paid. First refund the next period\'s charge in the PayPlus panel, then end the subscription. Nothing changed.' },
};

/** a number / date / amount inside a sentence, isolated for bidi (LRI ... PDI) */
export const iso = (v) => `⁦${v}⁩`;
/** a template with one placeholder, the value isolated */
export const fill = (template, key, v) => template.replace(key, iso(v));

/** a reason the server accepts (3-500 characters after trimming) - checked BEFORE the password is sent */
export const reasonOk = (reason) => { const n = String(reason || '').trim().length; return n >= 3 && n <= 500; };

export function billingErrorText(r, isHebrew, currency = null) {
  if (r?.code === 'stale_preview') {
    const m = iso(billingRefundMoney(r.refundMinor, currency, isHebrew));
    return isHebrew ? `הסכום השתנה בינתיים. הסכום החדש: ${m}. אשרו שוב.` : `The amount changed meanwhile. The new amount: ${m}. Confirm again.`;
  }
  const c = CODE_TEXT[r?.code] || { he: 'הפעולה נכשלה. נסו שוב בעוד רגע.', en: 'The action failed. Try again in a moment.' };
  return isHebrew ? c.he : c.en;
}

/** the result of an answer the server accepted: { good, text } - "good" only when the server says it was applied */
export function billingResult(action, r, isHebrew, date) {
  const he = isHebrew;
  const notApplied = r.applied === false || ((action === 'stop_renewal' || action === 'end_early') && r.cancelStatus !== 'cancelled');
  if (action === 'stop_renewal') {
    if (notApplied) return { good: false, text: he ? 'החידוש לא הופסק: פיי פלוס סירבו לעצור את הוראת הקבע, או שהמנוי השתנה בינתיים. בדקו בממשק של פיי פלוס.' : 'The renewal was not stopped: PayPlus refused to stop the standing order, or the subscription changed meanwhile. Check the PayPlus panel.' };
    return { good: true, text: he ? `החידוש הופסק. החשבון יוגבל ב־${iso(date(r.paidThrough))}.` : `The renewal is stopped. The account is limited on ${iso(date(r.paidThrough))}.` };
  }
  if (action === 'end_early') {
    if (notApplied) return { good: false, text: he ? 'המנוי לא הסתיים ושום החזר לא נשלח: פיי פלוס סירבו לעצור את הוראת הקבע, או שהמנוי השתנה בינתיים. בדקו בממשק של פיי פלוס.' : 'The subscription did not end and no refund was sent: PayPlus refused to stop the standing order, or the subscription changed meanwhile. Check the PayPlus panel.' };
    const m = iso(billingRefundMoney(r.refundMinor, r.currency, he));
    if (r.refundStatus === 'refunded') return { good: true, text: he ? `המנוי הסתיים, וההחזר של ${m} נשלח.` : `The subscription ended, and the refund of ${m} was sent.` };
    if (r.refundStatus === 'failed' || r.refundStatus === 'manual') return { good: false, text: he ? 'המנוי הסתיים, וההחזר לא נשלח: יש להחזיר ידנית בפיי פלוס.' : 'The subscription ended, and the refund was not sent: refund it manually in PayPlus.' };
    return { good: true, text: he ? 'המנוי הסתיים.' : 'The subscription ended.' };
  }
  if (action === 'resolve') return { good: true, text: he ? 'הפעולה נסגרה.' : 'The action is closed.' };
  return { good: true, text: he ? 'ההחזר סומן כבוצע.' : 'The refund is marked as made.' };
}

/** a preview that failed for a reason other than "nothing to show" - the card says the state is unavailable */
export const previewUnavailable = (p) => !!p && p.ok !== true && !['no_live_package', 'lifetime_account', 'billing_off'].includes(p.code) && !p.unsettledRefund && !p.openAction;
