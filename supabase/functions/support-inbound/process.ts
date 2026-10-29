// Smart support email, stage 2 - what happens to ONE stored email (spec sections 2, 3, 6, 8). Runtime-independent: the database, the
// model and the mail provider are injected, so vitest runs the whole decision table without a network.
//  1. Sort: automated -> BLACK; the fixed list -> RED; otherwise the model (unsure -> RED).
//  2. Store the decision ONCE (only a row still 'new' is claimed - a second run of the same email changes nothing).
//  3. Act:  BLACK nothing.  RED the fixed acknowledgement to the sender + an immediate email to the Owner.  YELLOW the fixed
//     "received" / "noted" text.  GREEN a draft from the product facts (no safe draft -> RED).  GREEN / YELLOW are SENT only when the
//     Owner switched sending on for that colour; otherwise they wait as drafts (the trial).
//  4. Guards on every send to a customer: the stop switch, never an automated sender, at most MAX_AUTO_PER_SENDER_PER_DAY a day.
//     The Owner's own email is never blocked by them.
//  Codex release 5 (Owner console 2026-10-29 night, decisions 7 + 8):
//  5. The stored automation verdict decides first: confirmed automatic -> BLACK; possibly automatic -> GREY (waiting, ONE Owner alert,
//     no acknowledgement, no AI, no draft, no reply). reply_allowed=false is enforced here, in ownerSend, in support-admin redraft
//     and once more in sendMail - a browser can never override it.
//  6. Conversations (when the store has them): the email is placed by its RFC references; ONE generic acknowledgement per conversation
//     (an atomic claim); a substantive green / yellow follow-up may still get its own guarded answer; a thanks-only follow-up gets
//     none. Every customer email is recorded as an outbound message (sent / failed / unknown).
import { keywordTriage, detectLanguage, newestPart, classificationView, acknowledgementOnly, subjectNorm, type Bin, type Triage } from './triage.ts';
import { fixedText, mailboxOf, replySubject, senderFor, type Lang } from './templates.ts';
import { modelTriage, draftReply, type ModelDeps } from './assistant.ts';
import { sendMail, type MailDeps, type MailResult } from './mail.ts';

export const MAX_AUTO_PER_SENDER_PER_DAY = 5;

export type Settings = { auto_send_green: boolean; auto_send_yellow: boolean; paused: boolean };
// unreadable settings = nothing is sent to customers (the drafts are kept)
export const FAIL_CLOSED_SETTINGS: Settings = { auto_send_green: false, auto_send_yellow: false, paused: true };

export type InquiryRow = {
  id: string; status: string; from_address: string; to_addresses: string[] | null; subject: string | null; text_body: string | null;
  attachments: unknown[] | null; message_id: string | null; is_automated?: boolean | null; bin?: Bin | null; reply_language?: Lang | null;
  mailbox?: 'support' | 'info' | null; summary?: string | null; bin_reason?: string | null; draft_reply?: string | null;
  ack_sent_at?: string | null; reply_sent_at?: string | null; reply_sent_by?: string | null; received_at?: string | null;
  automation_class?: 'human' | 'confirmed_automatic' | 'possible_automatic' | null; reply_allowed?: boolean | null;
  automation_evidence?: string | null; reference_ids?: string[] | null; conversation_id?: string | null; owner_notified_at?: string | null;
  auth_results?: { spf?: string; dkim?: string; dmarc?: string } | null;
};

export type Association = 'reference' | 'new' | 'suggested' | 'ambiguous';
export type OutboundRecord = {
  conversation_id: string; inbound_id: string; kind: 'ack' | 'assistant' | 'owner'; actor: 'assistant' | 'owner' | 'system';
  to_address: string; mailbox: string | null; body_text: string; state: 'sent' | 'failed' | 'unknown'; send_key: string; provider_id: string | null;
};
export type ConversationStore = {
  /** the conversations of earlier received emails / our recorded sent emails whose RFC Message-ID is one of `ids` */
  byReferences(ids: string[], selfId: string): Promise<Array<{ conversation_id: string; participant: string; mailbox: string | null }>>;
  /** the newest conversation of this sender + mailbox with this subject active since `sinceIso` - a SUGGESTION only */
  bySubject(participant: string, mailbox: string | null, subject: string, sinceIso: string): Promise<string | null>;
  assign(inboundId: string, parent: string | null, suggested: string | null, association: Association, subject: string | null): Promise<string>;
  claimAck(conversationId: string, claim: string): Promise<boolean>;
  releaseAck(conversationId: string, claim: string): Promise<void>;
  recordOutbound(rec: OutboundRecord): Promise<void>;
};

export type InquiryStore = {
  settings(): Promise<Settings | null>;
  /** rows of this sender stored since `sinceIso` (for the daily limit) */
  recentFromSender(address: string, sinceIso: string): Promise<Array<{ id: string; ack_sent_at: string | null; reply_sent_at: string | null; reply_sent_by: string | null }>>;
  /** update only when the row is in one of `fromStatuses`; true when a row changed */
  update(id: string, patch: Record<string, unknown>, fromStatuses?: string[]): Promise<boolean>;
  conversations?: ConversationStore;
};

export type ProcessDeps = { store: InquiryStore; model: ModelDeps; mail: MailDeps; ownerAddress: string; now: () => Date };

const REASON_HE: Record<string, string> = {
  instructions_in_email: 'יש במייל הוראות לעוזר', attachment: 'צורף קובץ', low_confidence: 'העוזר לא בטוח',
  model_unavailable: 'העוזר לא זמין', model_not_configured: 'העוזר לא מוגדר', model_unreadable: 'תשובת העוזר לא קריאה',
  model_unknown_bin: 'העוזר לא מיין', model_yellow_without_kind: 'העוזר לא מיין', no_safe_answer: 'אין לעוזר תשובה בטוחה',
  'model:red': 'נושא שדורש אותך', processing_failed: 'הטיפול האוטומטי נכשל', possible_automatic: 'ייתכן שזו הודעה אוטומטית',
};
export function reasonText(reason: string | null | undefined): string {
  const r = String(reason || '');
  if (r.startsWith('word:')) return `המילה "${r.slice(5)}"`;
  return REASON_HE[r] || r || '-';
}

/** Decision 7: may anything be sent to this sender at all? The persisted ban wins over every other signal. */
export function replyAllowed(row: InquiryRow): boolean {
  return row.reply_allowed !== false && !row.is_automated && (row.automation_class ?? 'human') === 'human' && row.bin !== 'grey' && row.bin !== 'black';
}

/** The stored automation verdict, before any word list or model: confirmed -> BLACK, possible (or a reply ban) -> GREY. */
export function automationTriage(row: InquiryRow): Triage | null {
  if (row.automation_class === 'confirmed_automatic' || (row.is_automated && !row.automation_class)) return { bin: 'black', reason: 'automated', summary: null, kind: null };
  if (row.automation_class === 'possible_automatic' || row.reply_allowed === false) return { bin: 'grey', reason: 'possible_automatic', summary: null, kind: null };
  return null;
}

export async function sortInquiry(row: InquiryRow, model: ModelDeps): Promise<Triage> {
  return automationTriage(row)
    ?? keywordTriage(row.subject, classificationView(row.text_body), row.attachments || [])
    ?? await modelTriage(model, row.subject, row.text_body);
}

async function senderAllowed(deps: ProcessDeps, row: InquiryRow): Promise<boolean> {
  if (!replyAllowed(row)) return false;
  const since = new Date(deps.now().getTime() - 24 * 3600 * 1000).toISOString();
  const recent = await deps.store.recentFromSender(row.from_address, since);
  const sent = recent.filter((r) => (r.ack_sent_at && r.ack_sent_at > since) || (r.reply_sent_by === 'assistant' && r.reply_sent_at && r.reply_sent_at > since)).length;
  return sent < MAX_AUTO_PER_SENDER_PER_DAY;
}

function customerMail(row: InquiryRow, lang: Lang, text: string, slot: string, automatic: boolean) {
  const { from, replyTo } = senderFor(row.mailbox ?? mailboxOf(row.to_addresses));
  return {
    from, replyTo, to: row.from_address, subject: replySubject(row.subject, lang), text, inReplyTo: row.message_id,
    idempotencyKey: `tekango-support/v1/${row.id}/${slot}`, customer: { replyAllowed: replyAllowed(row), automatic },
  };
}

const deliveryState = (r: MailResult): OutboundRecord['state'] => (r.ok ? 'sent' : r.unknown ? 'unknown' : 'failed');

async function recordOutbound(store: InquiryStore, conversationId: string | null | undefined, row: InquiryRow, kind: OutboundRecord['kind'], text: string, sendKey: string, r: MailResult) {
  if (!store.conversations || !conversationId) return;
  await store.conversations.recordOutbound({
    conversation_id: conversationId, inbound_id: row.id, kind, actor: kind === 'ack' ? 'system' : kind, to_address: row.from_address,
    mailbox: row.mailbox ?? null, body_text: text.slice(0, 20000), state: deliveryState(r), send_key: sendKey, provider_id: r.id ?? null,
  }).catch((e) => console.error('support: the sent email was not recorded', sendKey, e instanceof Error ? e.message : e));
}

/** Decision 8: places the email in a conversation by its RFC references only (one compatible conversation = a reference; any other
 *  match = ambiguous, never merged); a same sender + mailbox + subject conversation is only a suggestion. */
export async function placeInConversation(row: InquiryRow, conv: ConversationStore, now: Date): Promise<{ id: string; association: Association }> {
  const me = String(row.from_address || '').toLowerCase();
  const box = row.mailbox ?? mailboxOf(row.to_addresses);
  const refs = (row.reference_ids ?? []).filter((x) => /^<[^<>\s",()]{3,248}>$/.test(x)).slice(0, 20);
  // a From address is written by the sender: when the provider says it failed both DKIM and DMARC, a reference proves nothing
  const forged = !!row.auth_results && row.auth_results.dkim === 'fail' && row.auth_results.dmarc === 'fail';
  let parent: string | null = null;
  let association: Association = 'new';
  if (refs.length) {
    const found = await conv.byReferences(refs, row.id);
    const same = (f: { participant: string; mailbox: string | null }) => String(f.participant || '').toLowerCase() === me && (f.mailbox ?? null) === box;
    const compatible = new Set(found.filter(same).map((f) => f.conversation_id));
    if (compatible.size === 1 && found.every(same) && !forged) { parent = [...compatible][0]; association = 'reference'; } else if (found.length) association = 'ambiguous';
  }
  const subject = subjectNorm(row.subject);
  let suggested: string | null = null;
  if (association === 'new' && subject) {
    suggested = await conv.bySubject(me, box, subject, new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString());
    if (suggested) association = 'suggested';
  }
  return { id: await conv.assign(row.id, parent, suggested, association, subject), association };
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

/** Decision 7: the Owner's ONE alert for a GREY email (Hebrew, a safe reason, the same inquiry slot - a replay never alerts twice). */
export function greyAlert(row: InquiryRow) {
  const box = row.mailbox ?? mailboxOf(row.to_addresses);
  const lines = [
    'ייתכן שזו הודעה אוטומטית. היא נשמרה לבדיקה ולא נשלחה תשובה לשולח.',
    '',
    `מאת: ${row.from_address}`,
    `נשלח אל: ${box ? `${box}@tekango.com` : '-'}`,
    `נושא: ${String(row.subject || '(ללא נושא)').slice(0, 200)}`,
    '',
    'המייל המקורי:',
    newestPart(row.text_body).slice(0, 3000) || '-',
    '',
    'לבדיקה: ממשק הניהול, לשונית "פניות"',
    'https://www.tekango.com/dashboard',
  ];
  return {
    from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com',
    subject: `ייתכן שזו הודעה אוטומטית: ${String(row.subject || '(ללא נושא)').slice(0, 150)}`,
    text: lines.join('\n'), idempotencyKey: `tekango-support/v1/${row.id}/owner`,
  };
}

/** The conversation's ONE generic acknowledgement (claimed atomically; released only when the provider surely refused it). */
async function acknowledge(deps: ProcessDeps, row: InquiryRow, lang: Lang, conversationId: string | null): Promise<boolean> {
  const text = fixedText('red_ack', lang);
  const mail = customerMail(row, lang, text, 'ack', true);
  const conv = deps.store.conversations;
  const claim = `ack:${row.id}`;
  if (conv && conversationId && !(await conv.claimAck(conversationId, claim).catch(() => false))) return false;
  const r = await sendMail(deps.mail, mail);
  await recordOutbound(deps.store, conversationId, row, 'ack', text, mail.idempotencyKey, r);
  if (conv && conversationId && !r.ok && !r.unknown) await conv.releaseAck(conversationId, claim).catch(() => undefined);
  return r.ok && await deps.store.update(row.id, { ack_sent_at: deps.now().toISOString() });
}

/** Runs once per stored email. Returns what was decided (for the webhook log); never throws on a provider failure. */
export async function processInquiry(row: InquiryRow, deps: ProcessDeps): Promise<{ bin: Bin; status: string; sent: string[] }> {
  const lang: Lang = detectLanguage(row.subject, row.text_body);
  const mailbox = mailboxOf(row.to_addresses);
  const conv = deps.store.conversations;
  // placing is idempotent (an already placed email keeps its conversation); unavailable = handled as before, one email alone
  const placed = conv ? await placeInConversation({ ...row, mailbox: row.mailbox ?? mailbox }, conv, deps.now()).catch(() => null) : null;
  const thanksOnly = placed?.association === 'reference' && !automationTriage(row) && !(row.attachments || []).length && acknowledgementOnly(row.text_body);
  let triage: Triage = thanksOnly ? { bin: 'green', reason: 'thanks_only', summary: null, kind: null } : await sortInquiry(row, deps.model);
  let draft: string | null = null;
  if (triage.bin === 'green' && !thanksOnly) {
    draft = await draftReply(deps.model, row.subject, row.text_body, lang);
    if (!draft) triage = { bin: 'red', reason: 'no_safe_answer', summary: triage.summary, kind: null };
  } else if (triage.bin === 'yellow') {
    draft = fixedText(triage.kind === 'bug' ? 'bug_received' : 'request_noted', lang);
  }
  const status = triage.bin === 'black' || thanksOnly ? 'ignored' : triage.bin === 'red' || triage.bin === 'grey' ? 'waiting' : 'draft';
  const claimed = await deps.store.update(row.id, {
    bin: triage.bin, bin_reason: triage.reason.slice(0, 300), summary: triage.summary, reply_language: lang, mailbox,
    draft_reply: draft, status, processed_at: deps.now().toISOString(),
  }, ['new']);
  if (!claimed) return { bin: triage.bin, status: 'already_processed', sent: [] };

  const current: InquiryRow = { ...row, mailbox, reply_language: lang, bin: triage.bin, summary: triage.summary, conversation_id: placed?.id ?? row.conversation_id ?? null };
  const sent: string[] = [];
  if (status === 'ignored') return { bin: triage.bin, status, sent };

  if (triage.bin === 'grey') {
    if (deps.ownerAddress) {
      const r = await sendMail(deps.mail, { ...greyAlert(current), to: deps.ownerAddress });
      if (r.ok && await deps.store.update(row.id, { owner_notified_at: deps.now().toISOString() })) sent.push('owner');
    }
    return { bin: 'grey', status, sent };
  }

  const settings = (await deps.store.settings().catch(() => null)) ?? FAIL_CLOSED_SETTINGS;
  const mayWriteCustomer = !settings.paused && await senderAllowed(deps, current);

  if (triage.bin === 'red') {
    if (mayWriteCustomer && await acknowledge(deps, current, lang, current.conversation_id ?? null)) sent.push('ack');
    if (deps.ownerAddress) {
      const r = await sendMail(deps.mail, { ...ownerAlert(current, triage, sent.includes('ack')), to: deps.ownerAddress });
      if (r.ok && await deps.store.update(row.id, { owner_notified_at: deps.now().toISOString() })) sent.push('owner');
    }
    return { bin: 'red', status, sent };
  }

  const autoSend = triage.bin === 'green' ? settings.auto_send_green : settings.auto_send_yellow;
  if (draft && autoSend && mayWriteCustomer) {
    const mail = customerMail(current, lang, draft, 'reply', true);
    const r = await sendMail(deps.mail, mail);
    await recordOutbound(deps.store, current.conversation_id, current, 'assistant', draft, mail.idempotencyKey, r);
    if (r.ok) {
      await deps.store.update(row.id, { reply_text: draft, reply_sent_at: deps.now().toISOString(), reply_sent_by: 'assistant', status: 'answered' }, ['draft']);
      sent.push('reply');
      return { bin: triage.bin, status: 'answered', sent };
    }
  }
  return { bin: triage.bin, status, sent };
}

/** Decision 7: an Owner alert (red / grey) whose delivery failed is retried later with the SAME slot - never a second alert. */
export async function retryOwnerAlert(row: InquiryRow, deps: { store: InquiryStore; mail: MailDeps; ownerAddress: string; now: () => Date }): Promise<boolean> {
  if (!deps.ownerAddress || row.owner_notified_at || row.status !== 'waiting' || (row.bin !== 'red' && row.bin !== 'grey')) return false;
  const alert = row.bin === 'grey' ? greyAlert(row) : ownerAlert(row, { bin: 'red', reason: row.bin_reason || '', summary: row.summary ?? null, kind: null }, !!row.ack_sent_at);
  const r = await sendMail(deps.mail, { ...alert, to: deps.ownerAddress });
  return r.ok && await deps.store.update(row.id, { owner_notified_at: deps.now().toISOString() });
}

/** The Owner's reply from the admin tab ("מאשר ושולח" / "מתקן ושולח" / a reply to a RED email). Claimed BEFORE the send, released
 *  when the provider refuses - a double click sends once. The stop switch and the daily limit do not apply to the Owner; the
 *  persisted reply ban (decision 7) does. */
export async function ownerSend(row: InquiryRow, text: string, deps: { store: InquiryStore; mail: MailDeps; now: () => Date }): Promise<'sent' | 'already_handled' | 'invalid' | 'provider_failure' | 'reply_not_allowed'> {
  const body = String(text || '').replace(/\r/g, '').trim();
  if (!replyAllowed(row)) return 'reply_not_allowed';
  if (body.length < 2 || body.length > 20000) return 'invalid';
  if (!['waiting', 'draft', 'new'].includes(row.status)) return 'already_handled';
  const at = deps.now().toISOString();
  const claimed = await deps.store.update(row.id, { status: 'answered', reply_text: body, reply_sent_at: at, reply_sent_by: 'owner' }, ['waiting', 'draft', 'new']);
  if (!claimed) return 'already_handled';
  const lang: Lang = row.reply_language === 'en' || row.reply_language === 'he' ? row.reply_language : detectLanguage(row.subject, row.text_body);
  const slot = `owner-${Date.parse(at).toString(36)}`;
  const mail = customerMail(row, lang, body, slot, false);
  const r = await sendMail(deps.mail, mail);
  await recordOutbound(deps.store, row.conversation_id, row, 'owner', body, mail.idempotencyKey, r);
  if (r.ok) return 'sent';
  await deps.store.update(row.id, { status: row.status, reply_text: null, reply_sent_at: null, reply_sent_by: null }, ['answered']);
  return 'provider_failure';
}
