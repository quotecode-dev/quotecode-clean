// Owner console 2026-11-02 (typed: "מאשר בניית שלב 1: מסכי ימי החסד ומיילי החיוב שנכשל לפי ההחלטה מ-18/10, כולל שינוי ב-L-02, L-11, L-12, L-13 ו-L-15,
// עם ההמלצות בהחלטות 1, 2 ו-4, שחרור עד הלייב"); docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md; the notices: task-control failedRenewalPolicy20261018.
// Pure (tests run it under vitest): which email an account is due now, its words, and the batch. Failure day, day 2, day 3 "today the
// account is limited", at limitation, then once a week until a payment. Decision 1: the card is updated by writing to the service
// mailbox (the server refuses a second payment page during the grace days), so a reply to the email reaches it.

export type Kind = 'failed_day1' | 'failed_day2' | 'failed_day3' | 'limited' | 'limited_weekly';
export type Fact = { account_id: string; email: string; market: 'IL' | 'INTERNATIONAL'; episode_at: string; grace_ends_at: string; limited: boolean;
  reason: 'payment_failed' | 'period_ended'; sent: Array<{ kind: string; seq: number }> };
export type Due = { kind: Kind; seq: number };
export type Outcome = { ok: boolean; status: number; id?: string | null; unknown?: boolean };
export type Deps = {
  facts(user?: string): Promise<Fact[]>;
  claim(user: string, kind: Kind, episode: string, seq: number, key: string): Promise<string | null>;
  complete(user: string, kind: Kind, episode: string, seq: number, key: string, outcome: 'sent' | 'failed' | 'unknown' | 'cancelled', providerId?: string | null): Promise<boolean>;
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
  return out;
}
