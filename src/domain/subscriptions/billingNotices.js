// Owner console 2026-11-02 (typed: "מאשר בניית שלב 1: מסכי ימי החסד ומיילי החיוב שנכשל לפי ההחלטה מ-18/10, כולל שינוי ב-L-02, L-11, L-12, L-13 ו-L-15,
// עם ההמלצות בהחלטות 1, 2 ו-4, שחרור עד הלייב"); the notices: task-control failedRenewalPolicy20261018.noticesDecision. Display only, from the reason the
// SERVER states (summary billing): nothing is granted, limited or charged here. A stopped renewal gets none of this (Owner 21/10). Decision 1:
// during the grace days the card is updated by writing to the service mailbox (the server refuses a second payment page).
import { serviceMailbox } from './packageCheckout';

const SNOOZE_MS = 4 * 3600 * 1000;
const snoozeKey = (userId) => `tekango:billing-popup-snooze:${userId}`;

/** null, or what the account must be told: grace (reason failed / no_charge) or limited (the same reasons) */
export function billingNoticeModel(summary, isLifetime = false) {
  if (isLifetime || summary?.state !== 'ready' || summary.planId === 'free') return null;
  const b = summary.billing;
  if (!b || b.renewalStopped === true) return null;
  if (b.inGrace === true && b.graceEndsAt) {
    return { state: 'grace', reason: summary.subscriptionStatus === 'past_due' ? 'failed' : 'no_charge', endsAt: b.graceEndsAt, mailbox: serviceMailbox(summary) };
  }
  if (b.limited === true && (b.limitedReason === 'payment_failed' || b.limitedReason === 'period_ended')) {
    return { state: 'limited', reason: b.limitedReason === 'payment_failed' ? 'failed' : 'no_charge', endsAt: b.graceEndsAt, mailbox: serviceMailbox(summary) };
  }
  return null;
}

function heUnit(n, one, two, many) {
  if (n === 1) return one;
  return n === 2 ? two : `${n} ${many}`;
}

/** the time left, in natural words; the smallest unit is a minute */
export function timeLeftText(endsAt, nowMs, isHebrew) {
  const ms = Date.parse(endsAt) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return isHebrew ? 'כמה רגעים' : 'a few moments';
  const mins = Math.ceil(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rest = mins % 60;
  if (isHebrew) {
    const d = days ? heUnit(days, 'יום אחד', 'יומיים', 'ימים') : '';
    const h = hours ? heUnit(hours, 'שעה', 'שעתיים', 'שעות') : '';
    if (days) return h ? `${d} ו${/^\d/.test(h) ? '-' : ''}${h}` : d;
    if (hours) return h;
    return heUnit(rest, 'דקה', 'שתי דקות', 'דקות');
  }
  const en = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days) return hours ? `${en(days, 'day')} and ${en(hours, 'hour')}` : en(days, 'day');
  return hours ? en(hours, 'hour') : en(rest, 'minute');
}

const WHAT = {
  he: { failed: 'החיוב של המנוי לא עבר', no_charge: 'לא התקבל חיוב חדש על המנוי' },
  en: { failed: 'Your subscription charge did not go through', no_charge: 'We did not receive a new charge for your subscription' },
};

export function barText(model, nowMs, isHebrew) {
  const l = isHebrew ? 'he' : 'en';
  if (model.state === 'grace') {
    const left = timeLeftText(model.endsAt, nowMs, isHebrew);
    return isHebrew ? `${WHAT.he[model.reason]}. החשבון יוגבל בעוד ${left}.` : `${WHAT.en[model.reason]}. Your account will be limited in ${left}.`;
  }
  return isHebrew
    ? `החשבון מוגבל: ${WHAT[l][model.reason]}. אפשר לצפות בהצעות קיימות, אבל לא להוציא הצעות חדשות.`
    : `Your account is limited: ${WHAT[l][model.reason].replace(/^Your/, 'your').replace(/^We/, 'we')}. You can view existing quotes, but not issue new ones.`;
}

export const updateCardLabel = (isHebrew) => (isHebrew ? 'עדכון כרטיס' : 'Update card');
export const payLabel = (isHebrew) => (isHebrew ? 'לתשלום' : 'Pay now');

export function updateCardHref(model, isHebrew) {
  const subject = isHebrew ? 'עדכון כרטיס למנוי TEKANGO' : 'Update the card of my TEKANGO subscription';
  return `mailto:${model.mailbox}?subject=${encodeURIComponent(subject)}`;
}

export function popupText(model, nowMs, isHebrew) {
  const left = timeLeftText(model.endsAt, nowMs, isHebrew);
  return isHebrew
    ? `${WHAT.he[model.reason]}.\n\nהחשבון יוגבל בעוד ${left}. אחרי זה לא יהיה אפשר להוציא הצעות חדשות, עד שהתשלום יעבור.`
    : `${WHAT.en[model.reason]}.\n\nYour account will be limited in ${left}. After that you will not be able to issue new quotes until the payment goes through.`;
}

export const popupOptions = (isHebrew) => ({
  options: [{ value: 'update', label: isHebrew ? 'עדכון כרטיס עכשיו' : 'Update card now' }],
  cancel: isHebrew ? 'אזכיר לי אחר כך' : 'Remind me later',
});

export function sendReminderText(model, nowMs, isHebrew) {
  const left = timeLeftText(model.endsAt, nowMs, isHebrew);
  return isHebrew
    ? `תזכורת: ${WHAT.he[model.reason]}, והחשבון יוגבל בעוד ${left}. אפשר עדיין לשלוח את ההצעה.\n\nלהמשיך בשליחה?`
    : `Reminder: ${WHAT.en[model.reason].replace(/^Your/, 'your').replace(/^We/, 'we')}, and your account will be limited in ${left}. You can still send this quote.\n\nContinue sending?`;
}

/** "remind me later" hides the window for 4 hours only; storage that cannot be read never hides it */
export function popupSnoozed(userId, nowMs, storage) {
  try {
    const until = Number(storage.getItem(snoozeKey(userId)));
    return Number.isFinite(until) && until > nowMs;
  } catch { return false; }
}
export function snoozePopup(userId, nowMs, storage) {
  try { storage.setItem(snoozeKey(userId), String(nowMs + SNOOZE_MS)); } catch { /* the window simply opens again next time */ }
}

/** the bell item, until the payment succeeds: its key follows the episode, so a new failure is a new unread item */
export function billingBellItem(model) {
  if (!model) return null;
  const copy = (he) => {
    if (model.state === 'grace') {
      return he ? { title: WHAT.he[model.reason], body: 'החשבון יוגבל בקרוב. לעדכון הכרטיס כתבו לנו מחלון המסלולים.' }
        : { title: WHAT.en[model.reason], body: 'Your account will be limited soon. To update your card, write to us from the plans window.' };
    }
    return he ? { title: 'החשבון מוגבל', body: `${WHAT.he[model.reason]}. תשלום פותח הכול מיד.` }
      : { title: 'Your account is limited', body: `${WHAT.en[model.reason]}. A payment reopens everything at once.` };
  };
  return Object.freeze({
    key: `announce:billing-${model.state}:${String(model.endsAt).replace(/[^0-9]/g, '').slice(0, 12)}`,
    kind: 'announce',
    action: 'plans',
    pinned: true,
    sortAt: '9999-12-31T00:00',
    copy: Object.freeze({ he: Object.freeze(copy(true)), en: Object.freeze(copy(false)) }),
  });
}
