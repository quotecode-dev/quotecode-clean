// support-inbound helpers (Owner console 2026-10-19, smart support email stage 1 - docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md).
// Pure: no Deno / network, so they run identically under Deno and vitest.
//  - Only the plain text of a received email is kept: HTML is reduced to text here (scripts / styles / tags dropped, nothing
//    executable is ever stored or rendered); attachments are metadata only (never downloaded, never opened).
//  - A message is stored only when it was sent to one of the configured support / info addresses (SUPPORT_INBOUND_ADDRESSES).

import { isAutomatedMessage } from './triage.ts';
import { mailboxOf } from './templates.ts';

export const MAX_TEXT_CHARS = 100000;
export const MAX_ATTACHMENTS = 30;

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

/** "Name <a@b.c>" | "a@b.c" -> { address (lower case), name | null }; null when no address. */
export function parseAddress(value: unknown): { address: string; name: string | null } | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  const address = (m ? m[2] : s).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 320) return null;
  const name = m ? m[1].trim().replace(/^"(.*)"$/, '$1').trim() : '';
  return { address, name: name ? name.slice(0, 200) : null };
}

export function addressList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return list.map(parseAddress).filter((a): a is { address: string; name: string | null } => !!a).map((a) => a.address).slice(0, 50);
}

export function htmlToText(html: unknown): string {
  let s = String(html ?? '');
  s = s.replace(/<(script|style|head|title)[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/\s*(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n');
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (e) => ENTITIES[e] ?? e).replace(/&#(\d{1,6});/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)));
  return s.split('\n').map((l) => l.replace(/[ \t\f\v\r]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT_CHARS);
}

/** The configured support / info addresses (comma separated, lower case). Empty = not configured (the function refuses to run). */
export function parseAllowedAddresses(value: unknown): Set<string> {
  return new Set(String(value ?? '').split(',').map((a) => a.trim().toLowerCase()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)));
}

export function recipientAllowed(recipients: string[], allowed: Set<string>): boolean {
  return recipients.some((r) => allowed.has(r));
}

const header = (headers: unknown, name: string): string | null => {
  if (!headers || typeof headers !== 'object') return null;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (k.toLowerCase() === name) return typeof v === 'string' ? v.slice(0, 998) : null;
  }
  return null;
};
const authValue = (v: unknown) => (['pass', 'fail', 'gray', 'processing_failed', 'unknown'].includes(String(v)) ? String(v) : 'unknown');

// deno-lint-ignore no-explicit-any
export function buildInboundRow({ eventId, webhookData, email }: { eventId: string; webhookData: any; email: any }) {
  const from = parseAddress(email?.from ?? webhookData?.from);
  if (!from) return null;
  const text = typeof email?.text === 'string' && email.text.trim() ? email.text.trim().slice(0, MAX_TEXT_CHARS) : htmlToText(email?.html);
  const attachments = (Array.isArray(email?.attachments) ? email.attachments : (Array.isArray(webhookData?.attachments) ? webhookData.attachments : []))
    .slice(0, MAX_ATTACHMENTS)
    // deno-lint-ignore no-explicit-any
    .map((a: any) => ({ filename: String(a?.filename ?? '').slice(0, 255) || null, content_type: String(a?.content_type ?? '').slice(0, 120) || null, size: Number.isFinite(Number(a?.size)) ? Number(a.size) : null }));
  const auth = email?.authentication && typeof email.authentication === 'object'
    ? { spf: authValue(email.authentication.spf), dkim: authValue(email.authentication.dkim), dmarc: authValue(email.authentication.dmarc) }
    : null;
  const receivedAt = Date.parse(email?.created_at ?? webhookData?.created_at);
  return {
    provider: 'resend',
    provider_event_id: String(eventId).slice(0, 200),
    provider_email_id: String(email?.id ?? webhookData?.email_id).slice(0, 200),
    message_id: typeof (email?.message_id ?? webhookData?.message_id) === 'string' ? String(email?.message_id ?? webhookData?.message_id).slice(0, 998) : null,
    in_reply_to: header(email?.headers, 'in-reply-to'),
    from_address: from.address,
    from_name: from.name,
    to_addresses: addressList(email?.to ?? webhookData?.to),
    subject: typeof (email?.subject ?? webhookData?.subject) === 'string' ? String(email?.subject ?? webhookData?.subject).slice(0, 998) : null,
    text_body: text || null,
    attachments,
    auth_results: auth,
    received_at: new Date(Number.isFinite(receivedAt) ? receivedAt : Date.now()).toISOString(),
    // stage 2 (Owner console 2026-10-20): the mailbox the customer wrote to, and whether this is an automated message (never answered)
    mailbox: mailboxOf(addressList(email?.to ?? webhookData?.to)),
    is_automated: isAutomatedMessage(email?.headers, from.address, typeof (email?.subject ?? webhookData?.subject) === 'string' ? String(email?.subject ?? webhookData?.subject) : null),
  };
}
