// Smart support email, stage 2 - what happens to ONE stored email (spec sections 2, 3, 6, 8). Runtime-independent: the database, the
// model and the mail provider are injected, so vitest runs the whole decision table without a network.
//  1. Sort: automated -> BLACK; the fixed list -> RED; otherwise the model (unsure -> RED).
//  2. Store the decision ONCE (only a row still 'new' is claimed - a second run of the same email changes nothing).
//  3. Act:  BLACK nothing.  RED the fixed acknowledgement to the sender + an immediate email to the Owner.  YELLOW the fixed
//     "received" / "noted" text.  GREEN a draft from the product facts (no safe draft -> RED).  GREEN / YELLOW are SENT only when the
//     Owner switched sending on for that colour; otherwise they wait as drafts (the trial).
//  4. Guards on every send to a customer: the stop switch, never an automated sender, at most MAX_AUTO_PER_SENDER_PER_DAY a day.
//     The Owner's own email is never blocked by them.
import { keywordTriage, detectLanguage, newestPart, type Bin, type Triage } from './triage.ts';
import { fixedText, mailboxOf, replySubject, senderFor, type Lang } from './templates.ts';
import { modelTriage, draftReply, type ModelDeps } from './assistant.ts';
import { sendMail, type MailDeps } from './mail.ts';

export const MAX_AUTO_PER_SENDER_PER_DAY = 5;

export type Settings = { auto_send_green: boolean; auto_send_yellow: boolean; paused: boolean };
// unreadable settings = nothing is sent to customers (the drafts are kept)
export const FAIL_CLOSED_SETTINGS: Settings = { auto_send_green: false, auto_send_yellow: false, paused: true };

export type InquiryRow = {
  id: string; status: string; from_address: string; to_addresses: string[] | null; subject: string | null; text_body: string | null;
  attachments: unknown[] | null; message_id: string | null; is_automated?: boolean | null; bin?: Bin | null; reply_language?: Lang | null;
  mailbox?: 'support' | 'info' | null; summary?: string | null; bin_reason?: string | null; draft_reply?: string | null;
  ack_sent_at?: string | null; reply_sent_at?: string | null; reply_sent_by?: string | null; received_at?: string | null;
};

export type InquiryStore = {
  settings(): Promise<Settings | null>;
  /** rows of this sender stored since `sinceIso` (for the daily limit) */
  recentFromSender(address: string, sinceIso: string): Promise<Array<{ id: string; ack_sent_at: string | null; reply_sent_at: string | null; reply_sent_by: string | null }>>;
  /** update only when the row is in one of `fromStatuses`; true when a row changed */
  update(id: string, patch: Record<string, unknown>, fromStatuses?: string[]): Promise<boolean>;
};

export type ProcessDeps = { store: InquiryStore; model: ModelDeps; mail: MailDeps; ownerAddress: string; now: () => Date };

const REASON_HE: Record<string, string> = {
  instructions_in_email: 'יש במייל הוראות לעוזר', attachment: 'צורף קובץ', low_confidence: 'העוזר לא בטוח',
  model_unavailable: 'העוזר לא זמין', model_not_configured: 'העוזר לא מוגדר', model_unreadable: 'תשובת העוזר לא קריאה',
  model_unknown_bin: 'העוזר לא מיין', model_yellow_without_kind: 'העוזר לא מיין', no_safe_answer: 'אין לעוזר תשובה בטוחה',
  'model:red': 'נושא שדורש אותך', processing_failed: 'הטיפול האוטומטי נכשל',
};
export function reasonText(reason: string | null | undefined): string {
  const r = String(reason || '');
  if (r.startsWith('word:')) return `המילה "${r.slice(5)}"`;
  return REASON_HE[r] || r || '-';
}

export async function sortInquiry(row: InquiryRow, model: ModelDeps): Promise<Triage> {
  if (row.is_automated) return { bin: 'black', reason: 'automated', summary: null, kind: null };
  return keywordTriage(row.subject, row.text_body, row.attachments || []) ?? await modelTriage(model, row.subject, row.text_body);
}

async function senderAllowed(deps: ProcessDeps, row: InquiryRow): Promise<boolean> {
  if (row.is_automated) return false;
  const since = new Date(deps.now().getTime() - 24 * 3600 * 1000).toISOString();
  const recent = await deps.store.recentFromSender(row.from_address, since);
  const sent = recent.filter((r) => (r.ack_sent_at && r.ack_sent_at > since) || (r.reply_sent_by === 'assistant' && r.reply_sent_at && r.reply_sent_at > since)).length;
  return sent < MAX_AUTO_PER_SENDER_PER_DAY;
}

function customerMail(row: InquiryRow, lang: Lang, text: string, slot: string) {
  const { from, replyTo } = senderFor(row.mailbox ?? mailboxOf(row.to_addresses));
  return { from, replyTo, to: row.from_address, subject: replySubject(row.subject, lang), text, inReplyTo: row.message_id, idempotencyKey: `tekango-support/v1/${row.id}/${slot}` };
}

/** The Owner's immediate RED email (spec 6): the original text and one line of what the sender wants and why it is red. */
export function ownerAlert(row: InquiryRow, triage: Triage, ackSent: boolean) {
  const box = row.mailbox ?? mailboxOf(row.to_addresses);
  const lines = [
    'פנייה חדשה שצריכה אותך.',
    '',
    `מאת: ${row.from_address}`,
    `נשלח אל: ${box ? `${box}@tekango.com` : '-'}`,
    `למה אדום: ${reasonText(triage.reason)}`,
    `מה הלקוח רוצה: ${triage.summary || '-'}`,
    `השולח קיבל אישור קבלה: ${ackSent ? 'כן' : 'לא'}`,
    '',
    'המייל המקורי:',
    newestPart(row.text_body).slice(0, 3000) || '-',
    '',
    'לטיפול: ממשק הניהול, לשונית "פניות"',
    'https://www.tekango.com/dashboard',
  ];
  return {
    from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com',
    subject: `פנייה אדומה: ${String(row.subject || '(ללא נושא)').slice(0, 150)}`,
    text: lines.join('\n'), idempotencyKey: `tekango-support/v1/${row.id}/owner`,
  };
}

/** Runs once per stored email. Returns what was decided (for the webhook log); never throws on a provider failure. */
export async function processInquiry(row: InquiryRow, deps: ProcessDeps): Promise<{ bin: Bin; status: string; sent: string[] }> {
  const lang: Lang = detectLanguage(row.subject, row.text_body);
  const mailbox = mailboxOf(row.to_addresses);
  let triage = await sortInquiry(row, deps.model);
  let draft: string | null = null;
  if (triage.bin === 'green') {
    draft = await draftReply(deps.model, row.subject, row.text_body, lang);
    if (!draft) triage = { bin: 'red', reason: 'no_safe_answer', summary: triage.summary, kind: null };
  } else if (triage.bin === 'yellow') {
    draft = fixedText(triage.kind === 'bug' ? 'bug_received' : 'request_noted', lang);
  }
  const status = triage.bin === 'black' ? 'ignored' : triage.bin === 'red' ? 'waiting' : 'draft';
  const claimed = await deps.store.update(row.id, {
    bin: triage.bin, bin_reason: triage.reason.slice(0, 300), summary: triage.summary, reply_language: lang, mailbox,
    draft_reply: draft, status, processed_at: deps.now().toISOString(),
  }, ['new']);
  if (!claimed) return { bin: triage.bin, status: 'already_processed', sent: [] };

  const current: InquiryRow = { ...row, mailbox, reply_language: lang, bin: triage.bin, summary: triage.summary };
  const sent: string[] = [];
  if (triage.bin === 'black') return { bin: 'black', status, sent };

  const settings = (await deps.store.settings().catch(() => null)) ?? FAIL_CLOSED_SETTINGS;
  const mayWriteCustomer = !settings.paused && await senderAllowed(deps, current);

  if (triage.bin === 'red') {
    if (mayWriteCustomer) {
      const r = await sendMail(deps.mail, customerMail(current, lang, fixedText('red_ack', lang), 'ack'));
      if (r.ok && await deps.store.update(row.id, { ack_sent_at: deps.now().toISOString() })) sent.push('ack');
    }
    if (deps.ownerAddress) {
      const r = await sendMail(deps.mail, { ...ownerAlert(current, triage, sent.includes('ack')), to: deps.ownerAddress });
      if (r.ok && await deps.store.update(row.id, { owner_notified_at: deps.now().toISOString() })) sent.push('owner');
    }
    return { bin: 'red', status, sent };
  }

  const autoSend = triage.bin === 'green' ? settings.auto_send_green : settings.auto_send_yellow;
  if (draft && autoSend && mayWriteCustomer) {
    const r = await sendMail(deps.mail, customerMail(current, lang, draft, 'reply'));
    if (r.ok) {
      await deps.store.update(row.id, { reply_text: draft, reply_sent_at: deps.now().toISOString(), reply_sent_by: 'assistant', status: 'answered' }, ['draft']);
      sent.push('reply');
      return { bin: triage.bin, status: 'answered', sent };
    }
  }
  return { bin: triage.bin, status, sent };
}

/** The Owner's reply from the admin tab ("מאשר ושולח" / "מתקן ושולח" / a reply to a RED email). Claimed BEFORE the send, released
 *  when the provider refuses - a double click sends once. The stop switch and the daily limit do not apply to the Owner. */
export async function ownerSend(row: InquiryRow, text: string, deps: { store: InquiryStore; mail: MailDeps; now: () => Date }): Promise<'sent' | 'already_handled' | 'invalid' | 'provider_failure'> {
  const body = String(text || '').replace(/\r/g, '').trim();
  if (body.length < 2 || body.length > 20000) return 'invalid';
  if (!['waiting', 'draft', 'new'].includes(row.status)) return 'already_handled';
  const at = deps.now().toISOString();
  const claimed = await deps.store.update(row.id, { status: 'answered', reply_text: body, reply_sent_at: at, reply_sent_by: 'owner' }, ['waiting', 'draft', 'new']);
  if (!claimed) return 'already_handled';
  const lang: Lang = row.reply_language === 'en' || row.reply_language === 'he' ? row.reply_language : detectLanguage(row.subject, row.text_body);
  const slot = `owner-${Date.parse(at).toString(36)}`;
  const r = await sendMail(deps.mail, customerMail(row, lang, body, slot));
  if (r.ok) return 'sent';
  await deps.store.update(row.id, { status: row.status, reply_text: null, reply_sent_at: null, reply_sent_by: null }, ['answered']);
  return 'provider_failure';
}
