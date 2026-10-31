// Codex SEC-EF-02 / SEC-LOG-01 / SEC-LOG-02 (Owner 2026-10-30): the send record of a quote email - reserved before the provider,
// one idempotency key per send, an unknown outcome kept, no body or provider text logged / returned.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { readReservation, outcomeOf, REFUSALS, UNKNOWN, UNVERIFIED, RECEIVED, PROVIDER_REFUSED, emailFingerprint } from './sendLedger';

describe('the send record', () => {
  it('reads only well-formed reservations; anything else is refused (fail closed)', () => {
    expect(readReservation({ ok: true, id: 'a', send_key: 'quote-email/v1/a', retry: false })).toEqual({ ok: true, id: 'a', send_key: 'quote-email/v1/a', retry: false });
    expect(readReservation({ ok: false, code: 'cooldown' })).toEqual({ ok: false, code: 'cooldown' });
    expect(readReservation({ ok: false, code: 'whatever' })).toBeNull();
    expect(readReservation({ ok: false, code: 'unresolved' })).toEqual({ ok: false, code: 'unresolved' });
    expect(readReservation({ ok: false, code: 'changed' })).toEqual({ ok: false, code: 'changed' });
    expect(readReservation(null)).toBeNull();
    expect(readReservation({ ok: true })).toBeNull();
  });
  // Codex review 2026-10-31 F02 (Owner-typed, the 30/10 lock named): a 409 and a 2xx without a provider id are UNKNOWN, never sent
  it('a 2xx with a provider id is sent, a 4xx is failed, a 5xx / 408 / 409 / no answer / a 2xx without an id is unknown', () => {
    expect(outcomeOf(200, 'em_1')).toBe('sent');
    expect(outcomeOf(200)).toBe('unknown');
    expect(outcomeOf(200, null)).toBe('unknown');
    expect(outcomeOf(409, 'em_1')).toBe('unknown');
    expect(outcomeOf(422)).toBe('failed');
    expect(outcomeOf(429)).toBe('failed');
    expect(outcomeOf(408)).toBe('unknown');
    expect(outcomeOf(503)).toBe('unknown');
    expect(outcomeOf(null)).toBe('unknown');
  });
  it('every refusal carries a stable code prefix the screen classifies', () => {
    for (const m of [...Object.values(REFUSALS), UNKNOWN, UNVERIFIED, RECEIVED]) expect(m).toMatch(/^QUOTE_EMAIL_[A-Z_]+:/);
    expect(PROVIDER_REFUSED).toBe('Failed to send email via Resend');
  });
});

describe('the email fingerprint (Codex review F02, decision b)', () => {
  const token = 'T'.repeat(43);
  it('is sha256 hex, the same for the same email, different for a changed one', async () => {
    const a = await emailFingerprint('{"html":"total 100"}', null);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await emailFingerprint('{"html":"total 100"}', null)).toBe(a);
    expect(await emailFingerprint('{"html":"total 120"}', null)).not.toBe(a);
  });
  it('normalizes the capability token (a new one per attempt) so the same email keeps its fingerprint', async () => {
    const one = await emailFingerprint(`{"html":"/c/${token}"}`, token);
    const other = 'U'.repeat(43);
    expect(await emailFingerprint(`{"html":"/c/${other}"}`, other)).toBe(one);
    expect(await emailFingerprint(`{"html":"/c/${token} total 120"}`, token)).not.toBe(one);
  });
});

describe('index.ts wiring (SEC-EF-02 / SEC-LOG-01 / SEC-LOG-02)', () => {
  const src = readFileSync(join(cwd(), 'supabase/functions/send-quote-email/index.ts'), 'utf8');
  it('the reservation happens after the owner / price / recipient checks and before the provider call, with its own idempotency key', () => {
    const reserve = src.indexOf("rpc('quote_email_reserve'");
    expect(reserve).toBeGreaterThan(src.indexOf('quoteRow.user_id !== callerUser.id'));
    expect(reserve).toBeGreaterThan(src.indexOf('if (!priceGate.ok)'));
    expect(reserve).toBeGreaterThan(src.indexOf('if (!clientEmail)'));
    expect(reserve).toBeLessThan(src.indexOf("fetch('https://api.resend.com/emails'"));
    expect(src).toContain("'Idempotency-Key': reservation.send_key");
    expect(src).toContain("await settle('unknown', null)");
    // Codex review F02 / F03: the reservation carries the fingerprint of the exact body that is posted, and newSend only from the request
    expect(src).toContain('p_fingerprint: fingerprint, p_new_send: body.newSend === true');
    expect(src).toContain('body: providerBody,');
    expect(src.indexOf('const fingerprint = await emailFingerprint(providerBody')).toBeLessThan(reserve);
    expect(src).not.toMatch(/409s*&&s*reservation.retrys*?s*'sent'/);
    expect(src).toContain('const state = outcomeOf(res.status, data?.id)');
  });
  it('no request body, provider answer or provider message is logged or returned', () => {
    expect(src).not.toMatch(/console\.log\([^)]*body/i);
    expect(src).not.toContain('JSON.stringify(data)');
    expect(src).not.toContain('data.message');
    expect(src).toContain("JSON.stringify({ id: typeof data?.id === 'string' ? data.id : null })");
  });
});
