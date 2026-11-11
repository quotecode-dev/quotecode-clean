// Owner console 2026-11-02 (typed: "מאשר בניית שלב 1: מסכי ימי החסד ומיילי החיוב שנכשל לפי ההחלטה מ-18/10, כולל שינוי ב-L-02, L-11, L-12, L-13 ו-L-15,
// עם ההמלצות בהחלטות 1, 2 ו-4, שחרור עד הלייב"); docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md; the notices: task-control failedRenewalPolicy20261018.
// Pure (tests run it under vitest): which email an account is due now, its words, and the batch. Failure day, day 2, day 3 "today the
// account is limited", at limitation, then once a week until a payment. Decision 1: the card is updated by writing to the service
// mailbox (the server refuses a second payment page during the grace days), so a reply to the email reaches it.

import { formatShortDate } from '../_shared/shortDate.js';

export type Kind = 'failed_day1' | 'failed_day2' | 'failed_day3' | 'limited' | 'limited_weekly';
export type LifeKind = 'welcome' | 'free_ending';
export type LifeFact = { account_id: string; email: string; market: Fact['market']; kind: LifeKind; episode_at: string; free_ends_at: string | null; remaining: number | null };
export type Fact = { account_id: string; email: string; market: 'IL' | 'INTERNATIONAL'; episode_at: string; grace_ends_at: string; limited: boolean;
  reason: 'payment_failed' | 'period_ended'; sent: Array<{ kind: string; seq: number }> };
export type Due = { kind: Kind; seq: number };
// Owner console 2026-11-05 (typed: "מאשר בניית 10 המיילים מהטבלה במשימת הלילה, שחרור עד הלייב כשהמיילים כבויים ללקוחות עד שאאשר את
// הנוסחים בבוקר"; migration 20261105100000): the customer's email on every billing change - its own switch (billing_phase)
export type BillingKind = 'renewal_resumed' | 'smart_pack_added' | 'renewal_stopped' | 'ended_early' | 'smart_pack_removed' | 'annual_reminder' | 'first_purchase';
export type BillingFact = { account_id: string; email: string; market: Fact['market']; kind: BillingKind; episode_at: string; details: Record<string, unknown> };
export type Outcome = { ok: boolean; status: number; id?: string | null; unknown?: boolean };
export type Deps = {
  facts(user?: string): Promise<Fact[]>;
  lifecycle(user?: string): Promise<LifeFact[]>;
  billing?(user?: string): Promise<BillingFact[]>;
  claim(user: string, kind: Kind | LifeKind | BillingKind, episode: string, seq: number, key: string): Promise<string | null>;
  complete(user: string, kind: Kind | LifeKind | BillingKind, episode: string, seq: number, key: string, outcome: 'sent' | 'failed' | 'unknown' | 'cancelled', providerId?: string | null): Promise<boolean>;
  send(mail: { from: string; replyTo: string; to: string; subject: string; text: string; idempotencyKey: string }): Promise<Outcome>;
  now(): Date;
  uuid(): string;
};

const HOUR = 3600000;
const WEEK = 7 * 24 * HOUR;
const FIRST_HOUR_IL = 8;
const LAST_HOUR_IL = 20; // 08:00 up to 21:00, Israel time
export const BATCH = 50;

/** the highest stage reached and not sent yet: an older stage is never sent after a newer one */
export function dueNotice(f: Fact, now: Date): Due | null {
  const t = now.getTime();
  const start = Date.parse(f.episode_at);
  const end = Date.parse(f.grace_ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || t < start) return null;
  let due: Due;
  if (f.limited) {
    const weeks = Math.floor((t - end) / WEEK);
    due = weeks >= 1 ? { kind: 'limited_weekly', seq: weeks } : { kind: 'limited', seq: 0 };
  } else {
    // counted back from the end the server states (it can be later than failure + 72 hours). A missing charge shows only after 24 of its
    // 72 hours (paid_grace_ends_at), so its first email is the opening one, and the next is the last day - never a "reminder" an hour later.
    const left = (end - t) / HOUR;
    const middle = f.reason === 'payment_failed' && left <= 48;
    due = { kind: left <= 24 ? 'failed_day3' : middle ? 'failed_day2' : 'failed_day1', seq: 0 };
  }
  return f.sent.some((s) => s.kind === due.kind && s.seq === due.seq) ? null : due;
}

export function israelHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false }).format(now)) % 24;
}

/** Israel: not at night. Abroad the time zone is not known, so no quiet hours. */
export const inSendingHours = (market: Fact['market'], now: Date) => market !== 'IL' || (israelHour(now) >= FIRST_HOUR_IL && israelHour(now) <= LAST_HOUR_IL);

function whenText(iso: string, market: Fact['market']): string {
  const d = new Date(iso);
  if (market === 'IL') {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} בשעה ${p.hour}:${p.minute}`;
  }
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)} UTC`;
}

const LINK = { IL: 'https://www.tekango.com/dashboard', INTERNATIONAL: 'https://www.tekango.com/dashboard?lang=en' } as const;
export const SENDER = {
  IL: { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com' },
  INTERNATIONAL: { from: 'TEKANGO <info@tekango.com>', replyTo: 'info@tekango.com' },
} as const;

export function noticeContent(kind: Kind, f: Pick<Fact, 'market' | 'grace_ends_at' | 'reason'>): { subject: string; text: string } {
  const failed = f.reason === 'payment_failed';
  const when = whenText(f.grace_ends_at, f.market);
  if (f.market === 'IL') {
    const what = failed ? 'החיוב האחרון של המנוי ב-TEKANGO לא עבר' : 'לא התקבל חיוב חדש על המנוי ב-TEKANGO';
    const card = 'אם הכרטיס הוחלף או שפג תוקפו, השיבו למייל הזה ונעזור לעדכן אותו.';
    const keep = 'שום דבר לא נמחק, וקישורים שכבר נשלחו ממשיכים לעבוד וניתן לחתום עליהם.';
    const whyLimited = failed ? 'התשלום לא עבר' : 'לא התקבל חיוב חדש על המנוי';
    const c: Record<Kind, { subject: string; lines: string[] }> = {
      failed_day1: { subject: failed ? 'החיוב של המנוי ב-TEKANGO לא עבר' : 'לא התקבל חיוב חדש על המנוי ב-TEKANGO', lines: [`${what}. אפשר להמשיך לעבוד כרגיל עד ${when}.${failed ? ' בינתיים ננסה לחייב שוב את הכרטיס השמור.' : ''}`, card, `אחרי התאריך הזה לא יהיה אפשר להוציא הצעות חדשות, עד שהתשלום יעבור. ${keep}`] },
      failed_day2: { subject: 'תזכורת: החיוב של המנוי עדיין לא עבר', lines: [`${what}. החשבון יוגבל ב-${when}.`, card, keep] },
      failed_day3: { subject: 'היום החשבון ב-TEKANGO יוגבל', lines: [`${what}, והיום החשבון יוגבל: ב-${when} לא יהיה אפשר עוד להוציא הצעות חדשות.`, card, keep] },
      limited: { subject: 'החשבון ב-TEKANGO הוגבל, וכך פותחים אותו', lines: [`החשבון ב-TEKANGO הוגבל כי ${whyLimited}. אפשר עדיין להיכנס, לראות, להוריד ולהדפיס הצעות קיימות.`, keep, 'תשלום פותח הכול מיד. אפשר לשלם מתוך החשבון, בחלון המסלולים.'] },
      limited_weekly: { subject: 'החשבון ב-TEKANGO עדיין מוגבל', lines: [`החשבון ב-TEKANGO עדיין מוגבל כי ${whyLimited}.`, keep, 'תשלום פותח הכול מיד. אפשר לשלם מתוך החשבון, בחלון המסלולים.'] },
    };
    return { subject: c[kind].subject, text: ['שלום,', '', ...c[kind].lines.flatMap((l) => [l, '']), `לכניסה לחשבון: ${LINK.IL}`, '', 'צוות TEKANGO'].join('\n') };
  }
  const what = failed ? 'The last charge for your TEKANGO subscription did not go through' : 'We did not receive a new charge for your TEKANGO subscription';
  const card = 'If your card was replaced or has expired, reply to this email and we will help you update it.';
  const keep = 'Nothing is deleted, and links you already sent keep working and can still be signed.';
  const whyLimited = failed ? 'the payment did not go through' : 'we did not receive a new charge for your subscription';
  const c: Record<Kind, { subject: string; lines: string[] }> = {
    failed_day1: { subject: failed ? 'Your TEKANGO payment did not go through' : 'We did not receive a new TEKANGO charge', lines: [`${what}. You can keep working as usual until ${when}.${failed ? ' We will try the saved card again.' : ''}`, card, `After that you will not be able to issue new quotes until the payment goes through. ${keep}`] },
    failed_day2: { subject: 'Reminder: your TEKANGO payment is still due', lines: [`${what}. Your account will be limited on ${when}.`, card, keep] },
    failed_day3: { subject: 'Your TEKANGO account will be limited today', lines: [`${what}, and your account will be limited today: from ${when} you will not be able to issue new quotes.`, card, keep] },
    limited: { subject: 'Your TEKANGO account is limited: how to reopen it', lines: [`Your TEKANGO account is limited because ${whyLimited}. You can still sign in, view, download and print existing quotes.`, keep, 'A payment reopens everything at once. You can pay from your account, in the plans window.'] },
    limited_weekly: { subject: 'Your TEKANGO account is still limited', lines: [`Your TEKANGO account is still limited because ${whyLimited}.`, keep, 'A payment reopens everything at once. You can pay from your account, in the plans window.'] },
  };
  return { subject: c[kind].subject, text: ['Hello,', '', ...c[kind].lines.flatMap((l) => [l, '']), `Sign in: ${LINK.INTERNATIONAL}`, '', 'The TEKANGO team'].join('\n') };
}

/** how this hour's run ends the day's window for the watcher (scheduled_health_record); the shared module stays untouched */
export function healthOf(body: { ok?: unknown; failed?: unknown; unknown?: unknown; code?: unknown } | null): { event: 'completed' | 'partial' | 'failed'; outcome: string } {
  if (!body || body.ok !== true) return { event: 'failed', outcome: typeof body?.code === 'string' && /^[a-z0-9_:-]{1,60}$/.test(body.code) ? body.code : 'failed' };
  return Number(body.failed) > 0 || Number(body.unknown) > 0 ? { event: 'partial', outcome: 'send_errors' } : { event: 'completed', outcome: 'ok' };
}

/** Owner console 2026-11-02 (typed on "מיילי שלב 2: ברוכים הבאים וסיום תקופת החינם": "מאשר אבל לא לעשות עכשיו, לשים בזכרון ותעשה אחרי כל מה שאציג בפנייך"). Service words only: no offer, no price, no link to the plans (the Owner's lawyer question stays open) */
export function lifeContent(f: Pick<LifeFact, 'kind' | 'market' | 'free_ends_at' | 'remaining'>, now: Date): { subject: string; text: string } {
  const endsSoon = !!f.free_ends_at && Date.parse(f.free_ends_at) <= now.getTime() + 24 * HOUR;
  const n = Number(f.remaining);
  if (f.market === 'IL') {
    const sign = [`לכניסה לחשבון: ${LINK.IL}`, '', 'צוות TEKANGO'];
    if (f.kind === 'welcome') {
      return { subject: 'ברוכים הבאים ל-TEKANGO', text: ['שלום,', '', 'החשבון מוכן. הצעד הראשון: בונים הצעת מחיר ראשונה ושולחים אותה בוואטסאפ או במייל, והלקוח חותם דיגיטלית.', '', 'במסלול החינם יש 10 הצעות או 7 ימים, המוקדם מביניהם.', '', 'שאלה? אפשר פשוט להשיב למייל הזה.', '', ...sign].join('\n') };
    }
    const what = endsSoon && f.free_ends_at ? `תקופת החינם מסתיימת ב-${whenText(f.free_ends_at, f.market)}.` : n === 1 ? 'נותרה הצעת חינם אחת.' : `נותרו ${n} הצעות חינם.`;
    return { subject: 'תקופת החינם ב-TEKANGO מסתיימת בקרוב', text: ['שלום,', '', what, '', 'אחרי הסיום אי אפשר יהיה להוציא הצעות חדשות, ומה שכבר נוצר נשאר זמין.', '', ...sign].join('\n') };
  }
  const sign = [`Sign in: ${LINK.INTERNATIONAL}`, '', 'The TEKANGO team'];
  if (f.kind === 'welcome') {
    return { subject: 'Welcome to TEKANGO', text: ['Hello,', '', 'Your account is ready. The first step: build your first quote and send it by WhatsApp or email, and your client signs digitally.', '', 'The free plan includes 10 quotes or 7 days, whichever comes first.', '', 'Questions? Just reply to this email.', '', ...sign].join('\n') };
  }
  const what = endsSoon && f.free_ends_at ? `Your free period ends on ${whenText(f.free_ends_at, f.market)}.` : n === 1 ? 'You have 1 free quote left.' : `You have ${n} free quotes left.`;
  return { subject: 'Your TEKANGO free period ends soon', text: ['Hello,', '', what, '', 'After that you will not be able to issue new quotes. Everything you already created stays available.', '', ...sign].join('\n') };
}

/** 2026-11-05: the words of a billing-change email (Hebrew in Israel, English abroad; the market's currency; the IRON-DATE-001 short
 *  date). null = the event lacks what its words need (never an email with a hole in it). No price of the plans beyond the account's own
 *  amounts, never "free". */
export function billingContent(f: Pick<BillingFact, 'kind' | 'market' | 'details'>): { subject: string; text: string } | null {
  const d = f.details || {};
  const he = f.market === 'IL';
  const cur = d.currency === 'USD' ? 'USD' : d.currency === 'ILS' ? 'ILS' : null;
  const money = (v: unknown) => (cur && Number.isInteger(v) ? `${cur === 'ILS' ? '₪' : '$'}${((v as number) / 100).toFixed(2)}` : null);
  const date = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? formatShortDate(v, he ? 'Local' : 'International') : null);
  const year = d.period === 'year';
  const every = he ? (year ? 'בכל שנה' : 'בכל חודש') : (year ? 'every year' : 'every month');
  const lines: string[] = [];
  let subject = '';
  switch (f.kind) {
    case 'renewal_resumed': {
      const amount = money(d.amountMinor); const first = date(d.firstChargeAt); const until = date(d.smartPackUntil);
      if (!amount || !first) return null;
      subject = he ? 'החיוב המתחדש של המנוי חודש' : 'Your renewing charge is back on';
      lines.push(he ? 'החיוב המתחדש של המנוי שלכם ב-TEKANGO חודש. היום לא בוצע חיוב.' : 'The renewing charge of your TEKANGO subscription is back on. Nothing was charged today.');
      lines.push(he ? `החיוב הבא: ${amount} בתאריך ${first}, ואחר כך ${every}${d.smartPack === true ? ', כולל חכם פלוס' : ''}.`
        : `Your next charge: ${amount} on ${first}, then ${every}${d.smartPack === true ? ', SMART PACK included' : ''}.`);
      if (until) lines.push(he ? `חכם פלוס נשאר פעיל עד ${until}, ולא יתחדש.` : `SMART PACK stays active until ${until} and will not renew.`);
      break;
    }
    case 'smart_pack_added': {
      const paid = money(d.amountMinor); const end = date(d.periodEnd); const total = money(d.totalMinor);
      if (!paid || !end || !total) return null;
      subject = he ? 'חכם פלוס פעיל בחשבון שלכם' : 'SMART PACK is active on your account';
      lines.push(he ? 'חכם פלוס פעיל בחשבון שלכם מעכשיו.' : 'SMART PACK is active on your account from now on.');
      lines.push(he ? `שולם היום ${paid}, על הימים עד ${end}.` : `Paid today: ${paid}, for the days until ${end}.`);
      lines.push(he ? `מ-${end} החיוב ${every} הוא ${total}, כולל חכם פלוס.` : `From ${end} your charge ${every} is ${total}, SMART PACK included.`);
      break;
    }
    case 'renewal_stopped': {
      const through = date(d.paidThrough);
      if (!through) return null;
      subject = he ? 'החידוש האוטומטי של המנוי הופסק' : 'Your automatic renewal is stopped';
      lines.push(he ? 'החידוש האוטומטי של המנוי שלכם ב-TEKANGO הופסק, ולא יבוצעו חיובים נוספים.' : 'The automatic renewal of your TEKANGO subscription is stopped, and no further charges will be made.');
      lines.push(he ? `המנוי פעיל עד ${through}.` : `Your subscription stays active until ${through}.`);
      lines.push(he ? 'אפשר לחדש בכל עת מחלון המסלולים, בלי חיוב עד סוף התקופה ששולמה.' : 'You can resume at any time from the plans window, with nothing charged until the paid period ends.');
      break;
    }
    case 'ended_early': {
      const end = date(d.effectiveEnd);
      if (!end) return null;
      const refund = Number.isInteger(d.refundMinor) && (d.refundMinor as number) > 0 ? money(d.refundMinor) : null;
      subject = he ? 'המנוי ב-TEKANGO הסתיים' : 'Your TEKANGO subscription has ended';
      lines.push(he ? `המנוי שלכם ב-TEKANGO הסתיים בתאריך ${end}, לפי בקשתכם.` : `Your TEKANGO subscription ended on ${end}, as you asked.`);
      if (refund) lines.push(he ? `החזר של ${refund} יועבר לכרטיס שבו שילמתם, לפי סעיף 6 בתנאי השימוש.` : `A refund of ${refund} goes back to the card you paid with, as set out in section 6 of the Terms.`);
      lines.push(he ? 'שום דבר לא נמחק, ומה שכבר נוצר נשאר זמין.' : 'Nothing is deleted, and everything you created stays available.');
      break;
    }
    case 'smart_pack_removed': {
      const at = date(d.effectiveAt);
      if (!at) return null;
      const refund = Number.isInteger(d.refundMinor) && (d.refundMinor as number) > 0 ? money(d.refundMinor) : null;
      subject = he ? 'חכם פלוס לא יתחדש' : 'SMART PACK will not renew';
      lines.push(he ? `חכם פלוס פעיל עד ${at} ולא יתחדש. מהחיוב הבא הסכום לא כולל את חכם פלוס.` : `SMART PACK stays active until ${at} and will not renew. From your next charge, the amount does not include SMART PACK.`);
      if (refund) lines.push(he ? `החזר יחסי של ${refund} יועבר לכרטיס, לפי סעיף 6 בתנאי השימוש.` : `A pro-rata refund of ${refund} goes back to your card, as set out in section 6 of the Terms.`);
      break;
    }
    case 'annual_reminder': {
      const amount = money(d.amountMinor); const at = date(d.renewsAt);
      if (!amount || !at) return null;
      subject = he ? 'תזכורת: החידוש השנתי בעוד שבוע' : 'Reminder: your annual renewal is in a week';
      lines.push(he ? `בתאריך ${at} יחויב החידוש השנתי של המנוי שלכם ב-TEKANGO, בסך ${amount}.` : `On ${at} the annual renewal of your TEKANGO subscription will be charged: ${amount}.`);
      lines.push(he ? 'אם אינכם רוצים לחדש, אפשר להפסיק את החידוש לפני כן: השיבו למייל הזה ונטפל בזה.' : 'If you do not want to renew, you can stop the renewal before then: reply to this email and we will take care of it.');
      break;
    }
    case 'first_purchase': {
      const amount = money(d.amountMinor); const through = date(d.paidThrough);
      if (!amount || !through) return null;
      subject = he ? 'המנוי שלכם ב-TEKANGO פעיל' : 'Your TEKANGO subscription is active';
      lines.push(he ? `תודה! המנוי ${year ? 'השנתי' : 'החודשי'} שלכם ב-TEKANGO פעיל${d.smartPack === true ? ', כולל חכם פלוס' : ''}.`
        : `Thank you! Your ${year ? 'annual' : 'monthly'} TEKANGO subscription is active${d.smartPack === true ? ', SMART PACK included' : ''}.`);
      lines.push(he ? `החיוב הבא: ${amount} בתאריך ${through}.` : `Your next charge: ${amount} on ${through}.`);
      lines.push(he ? 'הקבלה על התשלום נשלחת אליכם בנפרד מחברת הסליקה.' : 'The receipt for your payment is sent to you separately by the payment company.');
      break;
    }
    default: return null;
  }
  const sign = he ? [`לכניסה לחשבון: ${LINK.IL}`, '', 'צוות TEKANGO'] : [`Sign in: ${LINK.INTERNATIONAL}`, '', 'The TEKANGO team'];
  return { subject, text: [he ? 'שלום,' : 'Hello,', '', ...lines.flatMap((l) => [l, '']), ...sign].join('\n') };
}

export async function runNotices(d: Deps): Promise<{ ok: boolean; found: number; sent: number; failed: number; unknown: number; waiting: number }> {
  const now = d.now();
  const out = { ok: true, found: 0, sent: 0, failed: 0, unknown: 0, waiting: 0 };
  const facts = await d.facts();
  out.found = facts.length;
  let room = BATCH;
  for (const f of facts) {
    const due = dueNotice(f, now);
    if (!due) continue;
    if (!inSendingHours(f.market, now)) { out.waiting += 1; continue; }
    if (room <= 0) { out.waiting += 1; continue; }
    room -= 1;
    const key = await d.claim(f.account_id, due.kind, f.episode_at, due.seq, `customer-notice/${d.uuid()}`);
    if (!key) continue; // a concurrent run has it, or its outcome is not retryable
    // read again after the claim: a payment a moment ago ends the notices
    const fresh = (await d.facts(f.account_id))[0];
    const still = fresh && fresh.episode_at === f.episode_at ? dueNotice(fresh, now) : null;
    if (!still || still.kind !== due.kind || still.seq !== due.seq) {
      await d.complete(f.account_id, due.kind, f.episode_at, due.seq, key, 'cancelled');
      continue;
    }
    const { subject, text } = noticeContent(due.kind, fresh);
    const s = SENDER[f.market];
    const r = await d.send({ from: s.from, replyTo: s.replyTo, to: fresh.email, subject, text, idempotencyKey: key });
    const outcome = r.ok ? 'sent' : r.unknown ? 'unknown' : 'failed';
    const recorded = await d.complete(f.account_id, due.kind, f.episode_at, due.seq, key, outcome, r.id ?? null);
    if (outcome === 'sent') out.sent += 1;
    if (outcome === 'failed' || !recorded) out.failed += 1;
    if (outcome === 'unknown') out.unknown += 1;
  }
  const life = await d.lifecycle();
  out.found += life.length;
  for (const f of life) {
    if (!inSendingHours(f.market, now)) { out.waiting += 1; continue; }
    if (room <= 0) { out.waiting += 1; continue; }
    room -= 1;
    const key = await d.claim(f.account_id, f.kind, f.episode_at, 0, `customer-notice/${d.uuid()}`);
    if (!key) continue;
    const fresh = (await d.lifecycle(f.account_id)).find((x) => x.kind === f.kind);
    if (!fresh) { await d.complete(f.account_id, f.kind, f.episode_at, 0, key, 'cancelled'); continue; }
    const { subject, text } = lifeContent(fresh, now);
    const s = SENDER[f.market];
    const r = await d.send({ from: s.from, replyTo: s.replyTo, to: fresh.email, subject, text, idempotencyKey: key });
    const outcome = r.ok ? 'sent' : r.unknown ? 'unknown' : 'failed';
    const recorded = await d.complete(f.account_id, f.kind, f.episode_at, 0, key, outcome, r.id ?? null);
    if (outcome === 'sent') out.sent += 1;
    if (outcome === 'failed' || !recorded) out.failed += 1;
    if (outcome === 'unknown') out.unknown += 1;
  }
  // 2026-11-05: the billing-change emails (their own switch in SQL; the same claim / complete - one email per account, kind and event)
  const bill = typeof d.billing === 'function' ? await d.billing() : [];
  out.found += bill.length;
  for (const f of bill) {
    if (!inSendingHours(f.market, now)) { out.waiting += 1; continue; }
    if (room <= 0) { out.waiting += 1; continue; }
    const content = billingContent(f);
    if (!content) continue;
    room -= 1;
    const key = await d.claim(f.account_id, f.kind, f.episode_at, 0, `customer-notice/${d.uuid()}`);
    if (!key) continue;
    const s = SENDER[f.market];
    const r = await d.send({ from: s.from, replyTo: s.replyTo, to: f.email, subject: content.subject, text: content.text, idempotencyKey: key });
    const outcome = r.ok ? 'sent' : r.unknown ? 'unknown' : 'failed';
    const recorded = await d.complete(f.account_id, f.kind, f.episode_at, 0, key, outcome, r.id ?? null);
    if (outcome === 'sent') out.sent += 1;
    if (outcome === 'failed' || !recorded) out.failed += 1;
    if (outcome === 'unknown') out.unknown += 1;
  }
  return out;
}
