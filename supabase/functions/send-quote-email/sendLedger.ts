// Codex SEC-EF-02 / SEC-LOG-01 / SEC-LOG-02 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ממצאי האבטחה ..."): one durable
// record per quote email (migration 20261030700000, quote_email_reserve / quote_email_settle), reserved BEFORE the provider call and
// sent with its own provider Idempotency-Key. Pure helpers (vitest and Deno alike).
//  - in flight / just sent / over a daily limit = a refusal with a stable code prefix (classified on the screen);
//  - a network failure, a timeout, a 5xx or 408 = UNKNOWN: kept, and the next attempt reuses the same key (never a blind second email);
//  - the provider's own text never goes back to the browser, and no body / address is logged.

export type Reservation =
  | { ok: true; id: string; send_key: string; retry: boolean }
  | { ok: false; code: 'in_progress' | 'cooldown' | 'recipient_limit' | 'daily_limit' };

export const REFUSALS: Record<string, string> = {
  in_progress: 'QUOTE_EMAIL_IN_PROGRESS: this quote is being sent right now.',
  cooldown: 'QUOTE_EMAIL_COOLDOWN: this quote was just sent to this address.',
  recipient_limit: 'QUOTE_EMAIL_LIMIT: the daily limit for this recipient was reached.',
  daily_limit: 'QUOTE_EMAIL_LIMIT: the daily sending limit was reached.',
};
export const UNVERIFIED = 'QUOTE_EMAIL_UNVERIFIED: the send could not be recorded - nothing was sent.';
export const UNKNOWN = 'QUOTE_EMAIL_UNKNOWN: the email service did not confirm the send.';
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
export function outcomeOf(status: number | null): 'sent' | 'failed' | 'unknown' {
  if (status === null) return 'unknown';
  if (status >= 200 && status < 300) return 'sent';
  if (status >= 500 || status === 408) return 'unknown';
  return 'failed';
}
