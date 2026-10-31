// Codex SEC-EF-02 / SEC-LOG-01 / SEC-LOG-02 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ממצאי האבטחה ..."): one durable
// record per quote email (migration 20261030700000, quote_email_reserve / quote_email_settle), reserved BEFORE the provider call and
// sent with its own provider Idempotency-Key. Pure helpers (vitest and Deno alike).
//  - in flight / just sent / over a daily limit = a refusal with a stable code prefix (classified on the screen);
//  - a network failure, a timeout, a 5xx or 408 = UNKNOWN: kept, and the next attempt reuses the same key (never a blind second email);
//  - the provider's own text never goes back to the browser, and no body / address is logged.
// Codex review 2026-10-31 F02 / F03 (Owner-typed: "מאשר את שש הקבוצות של קודקס ... החלטות א-ח ... כמומלץ", migration 20261031200000):
//  - every send carries a FINGERPRINT of the email (sha256, never the email): a retry of an unconfirmed send whose content changed is
//    refused ('changed', decision b); an unconfirmed send older than 23 hours is refused ('unresolved', decision a); both - and a
//    provider 409 on a retry ('received') - are answered only by the user's explicit "send anyway" (newSend), never automatically;
//  - a 409 is never a success, and a 2xx without a provider id is unknown (no proof the email was accepted).

export type Reservation =
  | { ok: true; id: string; send_key: string; retry: boolean }
  | { ok: false; code: 'in_progress' | 'cooldown' | 'recipient_limit' | 'daily_limit' | 'unresolved' | 'changed' };

export const REFUSALS: Record<string, string> = {
  in_progress: 'QUOTE_EMAIL_IN_PROGRESS: this quote is being sent right now.',
  cooldown: 'QUOTE_EMAIL_COOLDOWN: this quote was just sent to this address.',
  recipient_limit: 'QUOTE_EMAIL_LIMIT: the daily limit for this recipient was reached.',
  daily_limit: 'QUOTE_EMAIL_LIMIT: the daily sending limit was reached.',
  unresolved: 'QUOTE_EMAIL_UNRESOLVED: an earlier send of this quote was never confirmed.',
  changed: 'QUOTE_EMAIL_CHANGED: the quote changed since an earlier send that was never confirmed.',
};
// a retry answered 409: the email service already holds that send (it may have been delivered) - never counted as sent
export const RECEIVED = 'QUOTE_EMAIL_RECEIVED: the email service already received an earlier send of this quote.';
export const UNVERIFIED = 'QUOTE_EMAIL_UNVERIFIED: the send could not be recorded - nothing was sent.';
export const UNKNOWN = 'QUOTE_EMAIL_UNKNOWN: the email service did not confirm the send.';
// Codex release 9, L-13 (Owner 2026-10-30): a registered LIVE-check test account emails a quote only to its own test mailbox
export const TEST_RECIPIENT = 'QUOTE_EMAIL_TEST_RECIPIENT: a test account sends quotes only to its registered test address.';
export const PROVIDER_REFUSED = 'Failed to send email via Resend';

/** The reservation answer of the database -> a typed reservation; anything else = null (the caller refuses, fail closed). */
export function readReservation(raw: unknown): Reservation | null {
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  if (r?.ok === true && typeof r.id === 'string' && typeof r.send_key === 'string') return { ok: true, id: r.id, send_key: r.send_key, retry: r.retry === true };
  if (r?.ok === false && typeof r.code === 'string' && r.code in REFUSALS) return { ok: false, code: r.code };
  return null;
}

/** What the provider answer means for the record. */
export function outcomeOf(status: number | null, providerId: unknown = ''): 'sent' | 'failed' | 'unknown' {
  if (status === null) return 'unknown';
  if (status >= 200 && status < 300) return typeof providerId === 'string' && providerId !== '' ? 'sent' : 'unknown';
  if (status >= 500 || status === 408 || status === 409) return 'unknown';
  return 'failed';
}

/** The fingerprint of the provider request body (decision b): sha256 hex; the capability token (a new one per attempt) is normalized. */
export async function emailFingerprint(bodyText: string, capabilityToken: unknown): Promise<string> {
  const stable = typeof capabilityToken === 'string' && capabilityToken.length >= 16 ? bodyText.split(capabilityToken).join('<capability>') : bodyText;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
