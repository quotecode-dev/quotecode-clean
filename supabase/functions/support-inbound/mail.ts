// Smart support email, stage 2 - every email the assistant or the Owner sends goes through this ONE gate (spec 3.10: "כל שליחה עוברת
// דרך שער קבוע מחוץ למודל"). Runtime-independent (fetch injected).
//  - One Idempotency-Key per inquiry + slot: a retried webhook / a double click never sends the same email twice (the provider
//    answers the second request with the first result).
//  - The reply threads under the customer's message (In-Reply-To / References) and comes back to the same mailbox (Reply-To).
//  - Never to ourselves, never to an automated sender (the loop guard is decided before; this is the last check).

//  - Codex release 5 (Owner console 2026-10-29 night, decisions 7-8): a mail to a CUSTOMER carries its persisted reply permission and is
//    refused here when it is not allowed or the address is a no-reply one (the last server-side check); an automatic send carries
//    Auto-Submitted / X-Auto-Response-Suppress (no auto-reply loops); the provider's send id is returned when it answered one (an
//    optional field - every older caller keeps reading ok / status); a network failure / timeout is "unknown", not "failed".
import { isNoReplyAddress } from './triage.ts';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;
export type MailDeps = { fetch: FetchLike; apiKey: string; timeoutMs?: number };
export type OutgoingMail = {
  from: string; replyTo: string; to: string; subject: string; text: string;
  inReplyTo?: string | null; idempotencyKey: string;
  customer?: { replyAllowed: boolean; automatic: boolean };
};
export type MailResult = { ok: boolean; status: number; id?: string | null; unknown?: boolean };

const OWN = /@(.+\.)?(tekango\.com|resend\.app|resend\.dev)$/i;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The HTML part of every email: each line decides its own direction (dir="auto") inside a Hebrew right-to-left / English
 *  left-to-right body - a Hebrew line with an address or a number in it is never reversed (Owner 2026-10-20: "זה לא הוצג נכון ...
 *  בגלל ה RTL"). The plain text part stays as the fallback. */
export function textToHtml(text: string): string {
  const rtl = /[֐-׿]/.test(text.split('\n').find((l) => /[֐-׿A-Za-z]/.test(l)) || '');
  const body = text.split('\n').map((l) => (l.trim() ? `<div dir="auto">${esc(l)}</div>` : '<br>')).join('\n');
  return `<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}"><body style="margin:0;padding:16px;font-family:Rubik,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;"><div dir="${rtl ? 'rtl' : 'ltr'}" style="text-align:${rtl ? 'right' : 'left'};">\n${body}\n</div></body></html>`;
}

export async function sendMail(deps: MailDeps, mail: OutgoingMail): Promise<MailResult> {
  if (!deps.apiKey) return { ok: false, status: 0 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to) || OWN.test(mail.to)) return { ok: false, status: 0 };
  if (!/^[A-Za-z0-9/_:.-]{8,250}$/.test(mail.idempotencyKey)) return { ok: false, status: 0 };
  if (mail.customer && (mail.customer.replyAllowed !== true || isNoReplyAddress(mail.to))) return { ok: false, status: 0 };
  const headers: Record<string, string> = {};
  if (mail.inReplyTo && /^<[^<>\s]{3,990}>$/.test(mail.inReplyTo)) {
    headers['In-Reply-To'] = mail.inReplyTo;
    headers['References'] = mail.inReplyTo;
  }
  if (mail.customer?.automatic) {
    headers['Auto-Submitted'] = 'auto-replied';
    headers['X-Auto-Response-Suppress'] = 'All';
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? 15000);
  try {
    const res = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': mail.idempotencyKey },
      body: JSON.stringify({ from: mail.from, to: [mail.to], reply_to: mail.replyTo, subject: mail.subject, text: mail.text, html: textToHtml(mail.text), headers }),
      signal: abort.signal,
    });
    let id: string | null = null;
    if (res.ok && typeof res.json === 'function') {
      try { const b = await res.json() as { id?: unknown }; id = typeof b?.id === 'string' ? b.id.slice(0, 200) : null; } catch { id = null; }
    }
    // a 5xx / 408 answer may still have been accepted - the outcome is not known
    return { ok: res.ok, status: res.status, id, unknown: !res.ok && (res.status >= 500 || res.status === 408) ? true : undefined };
  } catch {
    return { ok: false, status: 0, unknown: true };
  } finally {
    clearTimeout(timer);
  }
}
