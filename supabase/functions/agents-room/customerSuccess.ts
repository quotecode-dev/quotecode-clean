// Codex release 9, topic 9 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ... ו-9 ... כולל שינוי ב-L-22, L-23, L-26, L-12, L-15
// ו-L-17 ..."; "מאשר את השמות מאיה ועומר לסוכנים החדשים"; decisions 15-16 and 21 as recommended): Maya, Customer Success.
//  - Once a day (and on "Run now") she reads the five signals of docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 9 from the database
//    (customer_success_signals - real accounts only, verified address, resolved market) and writes a help draft for an account ONLY when
//    its owner opted in to optional help emails and the address is not suppressed. At most 20 drafts a day; ONE case per account and
//    signal for the account's lifetime (the database key wins races; a rejected or unknown case never comes back).
//  - The drafts are the spec's fixed texts in the account's own language, with the server's numbers and dates - no AI call, no cost.
//  - Nothing reaches a customer from here. The Owner approves (or edits) that exact draft; then it is checked again (signal, consent,
//    suppression, recipient, market), claimed once and sent with a case-based provider key; a timeout is "unknown", never resent.
import { israelParts, type Finding, type Result } from './lib.ts';

export const DAILY_DRAFTS = 20;
export const SIGNALS = ['no_quote_onboarding', 'free_ending', 'quote_awaiting_response', 'renewal_failed_grace', 'paid_inactive'] as const;
export type Signal = typeof SIGNALS[number];
export type SignalRow = { account_id: string; signal_code: Signal; evidence: Record<string, unknown>; market: 'IL' | 'INTERNATIONAL'; email: string;
  consent: boolean; suppressed: boolean; has_case: boolean };
export type MailOut = { ok: boolean; status: number; id?: string | null; unknown?: boolean };

export interface CsDeps {
  now(): Date;
  csSignals(user?: string): Promise<SignalRow[]>;
  csCountSince(sinceIso: string): Promise<number>; // the cases opened since (today's drafts)
  csInsertCase(row: { user_id: string; signal_code: Signal; evidence: Record<string, unknown> }): Promise<string | null>; // null = it exists
  csUpdateCase(id: string, patch: Record<string, unknown>, whenStatus?: string): Promise<boolean>;
  // the send claim: consent + suppression + draft -> sending in ONE database statement (customer_success_claim; review 30/10)
  csClaim(caseId: string): Promise<boolean>;
  csIssueToken(user: string): Promise<string | null>;
  mailCustomer(m: { to: string; from: string; replyTo: string; subject: string; text: string; key: string }): Promise<MailOut>;
}

export const SIGNAL_LABEL: Record<Signal, { he: string; en: string }> = {
  no_quote_onboarding: { he: 'נרשמו ועוד לא יצרו הצעה ראשונה', en: 'Registered without a first quote' },
  free_ending: { he: 'מסלול החינם מסתיים', en: 'Free plan ending' },
  quote_awaiting_response: { he: 'הצעה שממתינה לתשובה', en: 'A quote awaiting a response' },
  renewal_failed_grace: { he: 'חיוב שלא הושלם, בתקופת חסד', en: 'Payment not completed, in the grace period' },
  paid_inactive: { he: 'מנוי פעיל שלא נכנס שבועיים', en: 'An active subscriber inactive for two weeks' },
};

// the source-defined senders (send-trial-expiration-email/reminderContent.ts): Local = support, International = info; replies come back there
export const SENDER = {
  IL: { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com' },
  INTERNATIONAL: { from: 'TEKANGO <info@tekango.com>', replyTo: 'info@tekango.com' },
} as const;
export const UNSUBSCRIBE_URL = { he: 'https://www.tekango.com/he/unsubscribe', en: 'https://www.tekango.com/en/unsubscribe' } as const;

const valid = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function when(iso: unknown, market: 'IL' | 'INTERNATIONAL', withTime: boolean): string {
  const d = new Date(String(iso));
  if (market === 'IL') {
    return new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}) }).format(d);
  }
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(d)}${withTime ? ' UTC' : ''}`;
}

/** The spec's fixed text for one signal, in the account's language, with the server's validated numbers and dates (null = a needed fact is
 *  missing - no draft rather than an invented one). */
export function draftText(row: Pick<SignalRow, 'signal_code' | 'evidence' | 'market'>): { lang: 'he' | 'en'; subject: string; text: string } | null {
  const he = row.market === 'IL';
  const e = row.evidence ?? {};
  let body: string;
  switch (row.signal_code) {
    case 'no_quote_onboarding':
      body = he ? 'אפשר לעזור לכם להכין הצעת מחיר ראשונה ב-TEKANGO? אפשר להשיב להודעה ולספר במה נתקעתם.'
        : 'Would help preparing your first TEKANGO quote be useful? Reply and tell us where you got stuck.';
      break;
    case 'free_ending': {
      const n = Number(e.remaining);
      if (!Number.isInteger(n) || n < 1 || !valid(e.asOf) || !valid(e.endsAt)) return null;
      body = he ? `לפי מצב החשבון שנבדק ב-${when(e.asOf, row.market, true)}, נותרו ${n} הצעות במסלול החינם, ותקופת החינם מסתיימת ב-${when(e.endsAt, row.market, false)}. אם צריך עזרה בשימוש במסלול, אפשר להשיב כאן.`
        : `As checked at ${when(e.asOf, row.market, true)}, your Free plan has ${n} quotes remaining and ends at ${when(e.endsAt, row.market, false)}. Reply if you need help using it.`;
      break;
    }
    case 'quote_awaiting_response':
      body = he ? 'יש בחשבון הצעה שעדיין ממתינה לאישור. אפשר לעזור לבדוק את אפשרויות המעקב במערכת?'
        : 'A quote in your account is still awaiting approval. Would help with the app’s follow-up options be useful?';
      break;
    case 'renewal_failed_grace':
      if (!valid(e.asOf) || !valid(e.graceEndsAt)) return null;
      body = he ? `נכון ל-${when(e.asOf, row.market, true)}, החיוב האחרון של המנוי לא הושלם. תקופת החסד מסתיימת ב-${when(e.graceEndsAt, row.market, false)}. אם כבר הסדרתם את התשלום, אפשר להתעלם; לתמיכה אפשר להשיב להודעה.`
        : `As of ${when(e.asOf, row.market, true)}, your last subscription payment had not completed. Your grace period ends at ${when(e.graceEndsAt, row.market, false)}. If already resolved, please disregard this message; reply if you need support.`;
      break;
    case 'paid_inactive':
      body = he ? 'אם משהו מקשה על העבודה ב-TEKANGO, נשמח לעזור. אפשר להשיב להודעה ולספר מה צריך.'
        : 'If anything is getting in the way of using TEKANGO, we can help. Reply and tell us what you need.';
      break;
    default:
      return null;
  }
  return he
    ? { lang: 'he', subject: 'עזרה בשימוש ב-TEKANGO', text: `שלום,\n\n${body}\n\nצוות TEKANGO` }
    : { lang: 'en', subject: 'Help with TEKANGO', text: `Hello,\n\n${body}\n\nThe TEKANGO team` };
}

/** The line every sent help email ends with (a fresh token per send; only its hash is stored). */
export function unsubscribeFooter(lang: 'he' | 'en', token: string): string {
  const link = `${UNSUBSCRIBE_URL[lang]}?t=${token}`;
  return lang === 'he'
    ? `\n\n---\nקיבלתם את ההודעה כי בחרתם לקבל הודעות עזרה יזומות בהגדרות החשבון. להפסקת ההודעות: ${link}`
    : `\n\n---\nYou received this because you chose optional help emails in your account settings. To stop them: ${link}`;
}

export const outreachAction = (key: string, row: SignalRow, caseId: string, draft: { lang: 'he' | 'en'; subject: string; text: string }) => ({
  run_key: key, source: 'customer_success' as const, kind: 'system' as const, action_type: 'outreach_draft' as const,
  // review 30/10: no address in the title - titles reach the manager's AI prompt; the recipient is shown from the payload only
  title_he: `הודעת עזרה ללקוח: ${SIGNAL_LABEL[row.signal_code].he}`, title_en: `A help email to a customer: ${SIGNAL_LABEL[row.signal_code].en}`,
  detail_he: draft.text, detail_en: draft.text,
  payload: { caseId, userId: row.account_id, signal: row.signal_code, market: row.market, lang: draft.lang, recipient: row.email, subject: draft.subject,
    text: draft.text, evidence: row.evidence },
  dedupe_key: `outreach:${row.account_id}:${row.signal_code}`,
});

export type CsRun = { result: Result; drafted: { row: SignalRow; caseId: string; draft: { lang: 'he' | 'en'; subject: string; text: string } }[] };

/** One scan: the signals, who may get a draft, and today's drafts (at most 20 a day). insertDraft stores the waiting action. */
export async function scanAndDraft(d: CsDeps, key: string, insertDraft: (a: ReturnType<typeof outreachAction>) => Promise<string | null>): Promise<CsRun> {
  const now = d.now();
  const rows = await d.csSignals();
  const p = israelParts(now);
  const dayStart = new Date(Date.parse(`${p.day}T00:00:00Z`) - 3 * 3_600_000); // Israel midnight, at most 1 hour early in winter
  let room = Math.max(0, DAILY_DRAFTS - await d.csCountSince(dayStart.toISOString()));
  const counts = Object.fromEntries(SIGNALS.map((s) => [s, { found: 0, noConsent: 0, suppressed: 0, already: 0, drafted: 0 } as Record<string, number>])) as Record<Signal, Record<string, number>>;
  const drafted: CsRun['drafted'] = [];
  let missingFacts = 0; let overLimit = 0;
  for (const row of rows) {
    const c = counts[row.signal_code];
    if (!c) continue;
    c.found += 1;
    if (row.has_case) { c.already += 1; continue; }
    if (row.suppressed) { c.suppressed += 1; continue; }
    if (!row.consent) { c.noConsent += 1; continue; }
    const draft = draftText(row);
    if (!draft) { missingFacts += 1; continue; }
    if (room <= 0) { overLimit += 1; continue; }
    const caseId = await d.csInsertCase({ user_id: row.account_id, signal_code: row.signal_code, evidence: row.evidence });
    if (!caseId) { c.already += 1; continue; } // a concurrent run took it - one case per account and signal, for ever
    const actionId = await insertDraft(outreachAction(key, row, caseId, draft));
    if (actionId) await d.csUpdateCase(caseId, { action_id: actionId });
    room -= 1; c.drafted += 1;
    drafted.push({ row, caseId, draft });
  }
  const total = (k: string) => SIGNALS.reduce((a, s) => a + counts[s][k], 0);
  const findings: Finding[] = SIGNALS.filter((s) => counts[s].found).map((s) => {
    const c = counts[s];
    return { level: c.drafted ? 'warn' as const : 'good' as const,
      he: `${SIGNAL_LABEL[s].he}: ${c.found} חשבונות. טיוטות חדשות: ${c.drafted}. בלי הסכמה לפניות יזומות: ${c.noConsent}. כבר טופלו בעבר: ${c.already}.`,
      en: `${SIGNAL_LABEL[s].en}: ${c.found} accounts. New drafts: ${c.drafted}. Without consent to optional help emails: ${c.noConsent}. Handled before: ${c.already}.` };
  });
  if (total('suppressed')) findings.push({ level: 'good', he: `${total('suppressed')} חשבונות ביקשו להפסיק את הודעות העזרה, ולכן לא נכתבה להם טיוטה.`, en: `${total('suppressed')} accounts asked to stop help emails, so no draft was written.` });
  if (overLimit) findings.push({ level: 'warn', he: `${overLimit} טיוטות יחכו למחר, כי הגענו למגבלה של ${DAILY_DRAFTS} טיוטות ביום.`, en: `${overLimit} drafts wait for tomorrow: the limit is ${DAILY_DRAFTS} drafts a day.` });
  if (missingFacts) findings.push({ level: 'warn', he: `${missingFacts} סימנים בלי כל הנתונים הנדרשים, ולכן לא נכתבה להם טיוטה.`, en: `${missingFacts} signals lack a needed fact, so no draft was written.` });
  const n = total('drafted');
  const summaryHe = !rows.length ? 'לא נמצא היום אף חשבון שצריך עזרה.'
    : n ? `נכתבו ${n} טיוטות של הודעות עזרה, והן מחכות לאישורכם אצל מנהלת הסוכנים. שום הודעה לא נשלחת בלי אישור.`
      : 'נמצאו חשבונות עם סימן לעזרה, אבל אין טיוטה חדשה: אין הסכמה לפניות יזומות, או שכבר טופלו בעבר.';
  const summaryEn = !rows.length ? 'No account needed help today.'
    : n ? `${n} help email drafts were written and wait for your approval at the agents manager. Nothing is sent without approval.`
      : 'Some accounts show a help signal, but there is no new draft: no consent to optional help emails, or they were handled before.';
  return { result: { summaryHe, summaryEn, findings, data: { counts, overLimit, missingFacts }, costUsd: 0, tokens: 0 }, drafted };
}

export type SendOutcome = { ok: boolean; status?: 'sent' | 'unknown' | 'failed'; code?: string };

/** The Owner approved this exact draft (text may be his edit): check again, claim once, send once with the case's own provider key. */
export async function sendApproved(d: CsDeps, p: { caseId: string; userId: string; signal: Signal; market: 'IL' | 'INTERNATIONAL'; lang: 'he' | 'en'; recipient: string; subject: string; text: string }): Promise<SendOutcome> {
  const rows = await d.csSignals(p.userId);
  const row = rows.find((r) => r.signal_code === p.signal);
  if (!row || !row.consent || row.suppressed || row.email !== p.recipient || row.market !== p.market) {
    await d.csUpdateCase(p.caseId, { status: 'stale', updated_at: d.now().toISOString() }, 'draft');
    return { ok: false, code: !row ? 'outreach_stale' : !row.consent || row.suppressed ? 'outreach_no_consent' : 'outreach_recipient_changed' };
  }
  if (!(await d.csClaim(p.caseId))) return { ok: false, code: 'not_pending' }; // also refused when the consent was withdrawn a moment ago
  const token = await d.csIssueToken(p.userId);
  if (!token) {
    await d.csUpdateCase(p.caseId, { status: 'failed', updated_at: d.now().toISOString() }, 'sending');
    return { ok: false, code: 'outreach_no_consent' };
  }
  const s = SENDER[p.market];
  const r = await d.mailCustomer({ to: p.recipient, from: s.from, replyTo: s.replyTo, subject: p.subject, text: `${p.text}${unsubscribeFooter(p.lang, token)}`, key: `tekango-outreach/v1/${p.caseId}` });
  const status = r.ok ? 'sent' : r.unknown ? 'unknown' : 'failed';
  await d.csUpdateCase(p.caseId, { status, updated_at: d.now().toISOString() }, 'sending');
  return { ok: true, status };
}
