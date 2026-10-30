// Codex SEC-EF-02 / SEC-LOG-01 / SEC-LOG-02 (Owner 2026-10-30): the send record of a quote email - reserved before the provider,
// one idempotency key per send, an unknown outcome kept, no body or provider text logged / returned.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { readReservation, outcomeOf, REFUSALS, UNKNOWN, UNVERIFIED, PROVIDER_REFUSED } from './sendLedger';

describe('the send record', () => {
  it('reads only well-formed reservations; anything else is refused (fail closed)', () => {
    expect(readReservation({ ok: true, id: 'a', send_key: 'quote-email/v1/a', retry: false })).toEqual({ ok: true, id: 'a', send_key: 'quote-email/v1/a', retry: false });
    expect(readReservation({ ok: false, code: 'cooldown' })).toEqual({ ok: false, code: 'cooldown' });
    expect(readReservation({ ok: false, code: 'whatever' })).toBeNull();
    expect(readReservation(null)).toBeNull();
    expect(readReservation({ ok: true })).toBeNull();
  });
  it('a 2xx is sent, a 4xx is failed, a 5xx / 408 / no answer is unknown', () => {
    expect(outcomeOf(200)).toBe('sent');
    expect(outcomeOf(422)).toBe('failed');
    expect(outcomeOf(429)).toBe('failed');
    expect(outcomeOf(408)).toBe('unknown');
    expect(outcomeOf(503)).toBe('unknown');
    expect(outcomeOf(null)).toBe('unknown');
  });
  it('every refusal carries a stable code prefix the screen classifies', () => {
    for (const m of [...Object.values(REFUSALS), UNKNOWN, UNVERIFIED]) expect(m).toMatch(/^QUOTE_EMAIL_[A-Z_]+:/);
    expect(PROVIDER_REFUSED).toBe('Failed to send email via Resend');
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
  });
  it('no request body, provider answer or provider message is logged or returned', () => {
    expect(src).not.toMatch(/console\.log\([^)]*body/i);
    expect(src).not.toContain('JSON.stringify(data)');
    expect(src).not.toContain('data.message');
    expect(src).toContain("JSON.stringify({ id: typeof data?.id === 'string' ? data.id : null })");
  });
});
