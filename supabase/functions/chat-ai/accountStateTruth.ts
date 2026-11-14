// 2026-11-13 (Owner console, typed: "כן מאשר את שלושת החלקים, כולל שינוי ב-L-12 וב-L-14"; the chat knowledge scan of 12/11, section א items
// 1-2): two questions about THIS account answered from the server - never from a claim of the browser:
//   - "how much SMART PACK is left" -> the same percent the SMART PACK windows show (public.smart_pack_usage_status), not the price list;
//   - "my payment did not go through" -> the account's real billing state (get_account_summary billing), the same words as the red bar.
import type { SmartPackUsage } from "./accountContext.ts";

const SMART_PACK_RE = /חכם\s*פלוס|smart\s*pack/i;
const USAGE_HE = /(נשאר|נותר|נשארו|נותרו|ניצלתי|השתמשתי|ניצול|שימוש|אחוז)/;
const USAGE_EN = /\b(left|remaining|remain|used|usage|percent|%)\b/i;
const COST_RE = /(עולה|מחיר|לקנות|לרכוש|ביטול|לבטל|להסיר|cost|price|buy|purchase|cancel|remove)/i;

/** a question about how much of the month's SMART PACK usage is left (never a price / purchase / cancel question) */
export function asksSmartPackUsage(message: unknown): boolean {
  const m = String(message ?? '');
  if (!SMART_PACK_RE.test(m) || COST_RE.test(m)) return false;
  return USAGE_HE.test(m) || USAGE_EN.test(m);
}

/** the answer from the server meter; null when the account has no SMART PACK reading (then the plan answer applies) */
export function smartPackUsageAnswer(usage: SmartPackUsage | null | undefined, isHebrew: boolean): string | null {
  if (!usage) return null;
  if (usage.unlimited) return isHebrew ? 'בחשבון שלכם חכם פלוס פתוח בלי הגבלת שימוש.' : 'SMART PACK is open on your account with no usage limit.';
  const p = usage.percentLeft;
  return isHebrew
    ? `נשארו לכם ${p}% משימוש חכם פלוס החודש. אותו אחוז מופיע גם בחלון הצ׳אט ובחלון ההצעה החכמה.`
    : `You have ${p}% of your SMART PACK usage left this month. The same percent shows in the chat window and in the smart quote window.`;
}

const BILLING_HE = /(תשלום|חיוב|מנוי|כרטיס|אשראי)[^.?!]*(לא\s*עבר|נכשל|נדחה|לא\s*התקבל|בעיה)|(לא\s*עבר|נכשל|נדחה)[^.?!]*(תשלום|חיוב|מנוי|כרטיס)|חשבון\s*מוגבל|ימי\s*(ה)?חסד|עדכון\s*כרטיס/;
const BILLING_EN = /(payment|charge|card|subscription|billing)[^.?!]*(fail|declin|did\s*not\s*go|didn'?t\s*go|bounced|problem)|account\s*(is\s*)?limited|grace\s*(days|period)|update\s*(my\s*)?card/i;

/** "my subscription payment failed / my account is limited / how do I update my card" */
export function asksBillingProblem(message: unknown): boolean {
  const m = String(message ?? '');
  return BILLING_HE.test(m) || BILLING_EN.test(m);
}

type SummaryLike = { state?: string; planId?: string; subscriptionStatus?: string | null;
  billing?: { inGrace?: boolean; limited?: boolean; limitedReason?: string | null; graceEndsAt?: string | null; renewalStopped?: boolean } | null } | null | undefined;

function leftText(endsAt: string | null | undefined, nowMs: number, isHebrew: boolean): string {
  const ms = Date.parse(String(endsAt || '')) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return isHebrew ? 'כמה רגעים' : 'a few moments';
  const hours = Math.ceil(ms / 3600000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (isHebrew) {
    const d = days === 1 ? 'יום אחד' : days === 2 ? 'יומיים' : `${days} ימים`;
    const h = rest === 1 ? 'שעה' : rest === 2 ? 'שעתיים' : `${rest} שעות`;
    // as the red bar writes it: "יומיים ושעתיים", "3 ימים ו-5 שעות" (a hyphen only before a digit)
    return days ? (rest ? `${d} ו${/^\d/.test(h) ? '-' : ''}${h}` : d) : h;
  }
  const en = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return days ? (rest ? `${en(days, 'day')} and ${en(rest, 'hour')}` : en(days, 'day')) : en(rest, 'hour');
}

/** the account's billing state in the words of the red bar (src/domain/subscriptions/billingNotices.js), or how it works when all is fine */
export function billingProblemAnswer(summary: SummaryLike, marketIL: boolean, isHebrew: boolean, nowMs: number = Date.now()): string | null {
  void marketIL; // the market decides the mailbox the red bar's button opens (never written into the sentence - bidi)
  // 2026-11-14 (Owner approved): an account that could not be read is never told "no payment failed" - no answer here (null)
  if (!summary || summary.state !== 'ready') return null;
  const b = summary.planId !== 'free' ? summary.billing : null;
  const reasonFailed = summary?.subscriptionStatus === 'past_due' || b?.limitedReason === 'payment_failed';
  const what = isHebrew
    ? (reasonFailed ? 'החיוב של המנוי לא עבר' : 'לא התקבל חיוב חדש על המנוי')
    : (reasonFailed ? 'Your subscription charge did not go through' : 'We did not receive a new charge for your subscription');
  if (b && b.renewalStopped !== true && b.inGrace === true && b.graceEndsAt) {
    const left = leftText(b.graceEndsAt, nowMs, isHebrew);
    return isHebrew
      ? `${what}. החשבון יוגבל בעוד ${left}. כדי לעדכן כרטיס לוחצים "עדכון כרטיס" בפס האדום שבראש המסך, ונפתח מייל לשירות הלקוחות. אחרי שהתשלום עובר, החשבון ממשיך כרגיל.`
      : `${what}. Your account will be limited in ${left}. To update your card click "Update card" in the red bar at the top of the screen, and an email to customer service opens. Once the payment goes through, the account continues as usual.`;
  }
  if (b && b.renewalStopped !== true && b.limited === true && (b.limitedReason === 'payment_failed' || b.limitedReason === 'period_ended')) {
    return isHebrew
      ? `החשבון מוגבל: ${what}. אפשר לצפות בהצעות קיימות, אבל לא להוציא הצעות חדשות. כדי לשלם לוחצים "לתשלום" בפס האדום שבראש המסך.`
      : `Your account is limited: ${what.replace(/^Your/, 'your').replace(/^We/, 'we')}. You can view existing quotes, but not issue new ones. To pay click "Pay now" in the red bar at the top of the screen.`;
  }
  return isHebrew
    ? `לפי החשבון שלכם בשרת, אין כרגע תשלום שנכשל. כשחיוב של המנוי לא עובר, מופיע פס אדום בראש המסך עם ספירה לאחור של ימי החסד, ובו "עדכון כרטיס", שפותח מייל לשירות הלקוחות. אחרי ימי החסד החשבון מוגבל: אפשר לצפות בהצעות, אבל לא להוציא חדשות עד שמשלמים ב"לתשלום".`
    : `According to your account on the server, no payment has failed right now. When a subscription charge does not go through, a red bar appears at the top of the screen with a countdown of the grace days and an "Update card" button that opens an email to customer service. After the grace days the account is limited: you can view quotes, but not issue new ones until you pay with "Pay now".`;
}
