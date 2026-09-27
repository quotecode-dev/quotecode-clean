import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { runTrialReminderBatch, sendViaResendWithOutcome } from './reminderRun.ts';
import { resolveReminderMarket, MS_PER_DAY } from './eligibility.ts';

// Codex Post-LIVE Wave 1 blockers 3 + 5 - trial reminder batch: exact-market fail-closed, atomic claim before any send,
// verified completion, failure / retry behavior, duplicate/overlapping invocations. Synthetic data only; the transport is a
// local fake (no email is sent). The in-memory ledger below mirrors public.claim_trial_reminder / complete_trial_reminder
// (migration 20260927000000); the real SQL functions are proven separately in the disposable DB (scripts/db-test).

const NOW = Date.parse('2026-09-27T08:00:00.000Z');
const HEBREW = /[֐-׿]/;
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function candidate(n, over = {}) {
  return {
    user_id: uid(n),
    email: `tenant${n}@synthetic.test`,
    business_name: `Synthetic Business ${n}`,
    country: 'Local',
    role: 'user',
    plan: 'pro',
    is_lifetime: false,
    trial_ends_at: new Date(NOW + 2 * MS_PER_DAY).toISOString(), // 3d stage
    trial_reminder_3d_sent: false,
    trial_reminder_24h_sent: false,
    ...over,
  };
}

// JS mirror of the SQL ledger (single-threaded JS makes each call atomic, like the single SQL statement).
function makeLedger({ clock = () => NOW, leaseMs = 10 * 60_000, keyWindowMs = 23 * 3600_000 } = {}) {
  const rows = new Map();
  const flags = new Map();
  let seq = 0;
  const k = (u, s) => `${u}|${s}`;
  return {
    rows, flags,
    async claim(userId, stage) {
      await Promise.resolve();
      if (flags.get(k(userId, stage))) return null;
      const now = clock();
      const d = rows.get(k(userId, stage));
      const claimId = `claim-${++seq}`;
      if (!d) {
        const row = { status: 'claimed', claimId, key: `trial-reminder/${userId}/${stage}/1`, attempt: 1, keyAt: now, claimedAt: now };
        rows.set(k(userId, stage), row);
        return { claimId, idempotencyKey: row.key, attempt: 1 };
      }
      const reclaim = d.status === 'failed'
        || (d.status === 'unknown' && d.keyAt > now - keyWindowMs)
        || (d.status === 'claimed' && d.claimedAt < now - leaseMs && d.keyAt > now - keyWindowMs);
      if (!reclaim) return null;
      if (d.status === 'failed') { d.key = `trial-reminder/${userId}/${stage}/${d.attempt + 1}`; d.keyAt = now; }
      Object.assign(d, { status: 'claimed', claimId, claimedAt: now, attempt: d.attempt + 1 });
      return { claimId, idempotencyKey: d.key, attempt: d.attempt };
    },
    async complete(userId, stage, claimId, result) {
      await Promise.resolve();
      const d = rows.get(k(userId, stage));
      if (!d || d.claimId !== claimId || d.status !== 'claimed') return false;
      d.status = result.outcome;
      if (result.outcome === 'sent') flags.set(k(userId, stage), true);
      return true;
    },
  };
}

// Fake provider with Resend idempotency semantics: same key -> original response, no second delivery.
function makeProvider({ script = [] } = {}) {
  const delivered = [];
  const byKey = new Map();
  let call = 0;
  const transport = async (message, key) => {
    const i = call++;
    await new Promise((r) => setTimeout(r, (i * 7) % 5)); // interleave overlapping runs
    const forced = script[i];
    if (forced === 'throw') throw new Error('synthetic network error');
    if (forced === 'failed') return { outcome: 'failed', error: 'Resend 422: synthetic validation error' };
    if (forced === 'unknown-after-accept') { if (!byKey.has(key)) { byKey.set(key, message); delivered.push({ ...message, key }); } return { outcome: 'unknown', error: 'Resend 503' }; }
    if (byKey.has(key)) return { outcome: 'sent', messageId: 'dedup' };
    byKey.set(key, message);
    delivered.push({ ...message, key });
    return { outcome: 'sent', messageId: `msg_${delivered.length}` };
  };
  return { delivered, transport, calls: () => call };
}

describe('blocker 5 - exact market, fail closed', () => {
  it('resolveReminderMarket: only the exact canonical values', () => {
    expect(resolveReminderMarket('Local')).toBe('Local');
    expect(resolveReminderMarket('International')).toBe('International');
    for (const v of [null, undefined, '', 'Unknown', 'LCL', 'local', 'LOCAL', ' Local', 'Local ', 'international', 'Intl', 'IL', 'Israel', 'US', 0, {}, ['Local']]) {
      expect(resolveReminderMarket(v)).toBeNull();
    }
  });

  it('Local -> Hebrew / RTL / he-IL date / support@ sender / HE CTA; International -> English / LTR / info@ / ?lang=en', async () => {
    const ledger = makeLedger();
    const provider = makeProvider();
    await runTrialReminderBatch([candidate(1, { country: 'Local' }), candidate(2, { country: 'International' })], NOW, {
      claim: ledger.claim, complete: ledger.complete, transport: provider.transport,
    });
    const [he, en] = provider.delivered;
    expect(he.market).toBe('Local');
    expect(he.from).toBe('TEKANGO Support <support@tekango.com>');
    expect(he.html).toContain('dir="rtl"');
    expect(he.html).toContain('lang="he"');
    expect(he.subject).toMatch(HEBREW);
    expect(he.text).toContain('https://www.tekango.com/dashboard');
    expect(he.text).not.toContain('lang=en');
    expect(en.market).toBe('International');
    expect(en.from).toBe('TEKANGO <info@tekango.com>');
    expect(en.html).toContain('dir="ltr"');
    expect(`${en.subject}${en.html}${en.text}`).not.toMatch(HEBREW);
    expect(en.text).toContain('?lang=en');
  });

  for (const country of [null, 'Unknown', 'LCL', 'local', ' Local', 'Israel', 'IL', 'International ', '', 42]) {
    it(`country ${JSON.stringify(country)}: no claim, no email, no sent flag - never routed to Local`, async () => {
      const ledger = makeLedger();
      const provider = makeProvider();
      let claims = 0;
      const s = await runTrialReminderBatch([candidate(1, { country })], NOW, {
        claim: async (...a) => { claims++; return ledger.claim(...a); }, complete: ledger.complete, transport: provider.transport,
      });
      expect(claims).toBe(0);
      expect(provider.calls()).toBe(0);
      expect(ledger.flags.size).toBe(0);
      expect(s.skippedMarketUnresolved).toBe(1);
      expect(s.sent3d + s.sent24h).toBe(0);
    });
  }
});

describe('blocker 3 - claim before send, verified completion', () => {
  it('overlapping invocations (10 concurrent runs x 25 accounts): every account gets exactly one email', async () => {
    const ledger = makeLedger();
    const provider = makeProvider();
    const accounts = Array.from({ length: 25 }, (_, i) => candidate(i + 1, { country: i % 2 ? 'International' : 'Local' }));
    const runs = await Promise.all(Array.from({ length: 10 }, () =>
      runTrialReminderBatch(accounts.map((a) => ({ ...a })), NOW, { claim: ledger.claim, complete: ledger.complete, transport: provider.transport })));
    const perRecipient = new Map();
    for (const d of provider.delivered) perRecipient.set(d.to, (perRecipient.get(d.to) ?? 0) + 1);
    expect(perRecipient.size).toBe(25);
    expect([...perRecipient.values()].every((n) => n === 1)).toBe(true);
    expect(provider.calls()).toBe(25); // losers never even reached the transport
    expect(runs.reduce((n, r) => n + r.sent3d, 0)).toBe(25);
    expect(runs.reduce((n, r) => n + r.notClaimed, 0)).toBe(25 * 9);
  });

  it('a duplicate cron delivery after completion sends nothing', async () => {
    const ledger = makeLedger();
    const provider = makeProvider();
    const deps = { claim: ledger.claim, complete: ledger.complete, transport: provider.transport };
    await runTrialReminderBatch([candidate(1)], NOW, deps);
    const second = await runTrialReminderBatch([candidate(1)], NOW + 60_000, deps); // stale select: flag still false in the row
    expect(provider.delivered).toHaveLength(1);
    expect(second.notClaimed).toBe(1);
  });

  it('claim failure: no send, reported', async () => {
    const provider = makeProvider();
    const s = await runTrialReminderBatch([candidate(1)], NOW, {
      claim: async () => { throw new Error('db down'); }, complete: async () => true, transport: provider.transport,
    });
    expect(provider.calls()).toBe(0);
    expect(s.claimErrors).toBe(1);
    expect(s.errors[0]).toMatch(/claim failed - not sent/);
  });

  it('definite send failure: recorded as failed, not counted sent, no flag; next run retries with a NEW key', async () => {
    const ledger = makeLedger();
    const provider = makeProvider({ script: ['failed'] });
    const deps = { claim: ledger.claim, complete: ledger.complete, transport: provider.transport };
    const s1 = await runTrialReminderBatch([candidate(1)], NOW, deps);
    expect(s1.sendFailed).toBe(1);
    expect(s1.sent3d).toBe(0);
    expect(ledger.flags.size).toBe(0);
    expect(ledger.rows.get(`${uid(1)}|3d`).status).toBe('failed');
    const s2 = await runTrialReminderBatch([candidate(1)], NOW + MS_PER_DAY / 2, deps);
    expect(s2.sent3d).toBe(1);
    expect(provider.delivered).toHaveLength(1);
    expect(provider.delivered[0].key).toBe(`trial-reminder/${uid(1)}/3d/2`);
  });

  it('ambiguous outcome (provider accepted, then 503 / timeout): retry reuses the SAME key -> no second email', async () => {
    const ledger = makeLedger();
    const provider = makeProvider({ script: ['unknown-after-accept'] });
    const deps = { claim: ledger.claim, complete: ledger.complete, transport: provider.transport };
    const s1 = await runTrialReminderBatch([candidate(1)], NOW, deps);
    expect(s1.sendUnknown).toBe(1);
    expect(ledger.flags.size).toBe(0);
    const s2 = await runTrialReminderBatch([candidate(1)], NOW + 3600_000, deps);
    expect(s2.sent3d).toBe(1);
    expect(provider.delivered).toHaveLength(1); // the retry was deduplicated by the idempotency key
  });

  it('transport throws (network): treated as unknown, never as sent', async () => {
    const ledger = makeLedger();
    const provider = makeProvider({ script: ['throw'] });
    const s = await runTrialReminderBatch([candidate(1)], NOW, { claim: ledger.claim, complete: ledger.complete, transport: provider.transport });
    expect(s.sendUnknown).toBe(1);
    expect(s.sent3d).toBe(0);
    expect(ledger.rows.get(`${uid(1)}|3d`).status).toBe('unknown');
  });

  it('post-send persistence failure: counted sentUnrecorded (not sent3d); claim stays open; after the lease the retry reuses the key', async () => {
    let clock = NOW;
    const ledger = makeLedger({ clock: () => clock });
    const provider = makeProvider();
    let failCompletion = true;
    const deps = {
      claim: ledger.claim,
      transport: provider.transport,
      complete: async (...a) => { if (failCompletion) throw new Error('db write failed'); return ledger.complete(...a); },
    };
    const s1 = await runTrialReminderBatch([candidate(1)], clock, deps);
    expect(s1.sentUnrecorded).toBe(1);
    expect(s1.sent3d).toBe(0);
    expect(s1.completionErrors).toBe(1);
    expect(ledger.flags.size).toBe(0);
    failCompletion = false;
    clock = NOW + 5 * 60_000; // inside the lease: nobody may re-claim
    const s2 = await runTrialReminderBatch([candidate(1)], clock, deps);
    expect(s2.notClaimed).toBe(1);
    clock = NOW + 11 * 60_000; // lease expired: re-claim with the same key
    const s3 = await runTrialReminderBatch([candidate(1)], clock, deps);
    expect(s3.sent3d).toBe(1);
    expect(provider.delivered).toHaveLength(1);
    expect(ledger.flags.get(`${uid(1)}|3d`)).toBe(true);
  });

  it('completion refused (claim no longer held): reported, not counted as recorded', async () => {
    const provider = makeProvider();
    const s = await runTrialReminderBatch([candidate(1)], NOW, {
      claim: async () => ({ claimId: 'c1', idempotencyKey: 'k1', attempt: 1 }),
      complete: async () => false,
      transport: provider.transport,
    });
    expect(s.sentUnrecorded).toBe(1);
    expect(s.sent3d).toBe(0);
    expect(s.errors[0]).toMatch(/completion refused/);
  });

  it('ineligible accounts are never claimed (FREE plan, lifetime, super admin, outside window)', async () => {
    let claims = 0;
    await runTrialReminderBatch([
      candidate(1, { plan: 'free' }), candidate(2, { is_lifetime: true }), candidate(3, { role: 'super_admin' }),
      candidate(4, { trial_ends_at: new Date(NOW + 5 * MS_PER_DAY).toISOString() }),
    ], NOW, { claim: async () => { claims++; return null; }, complete: async () => true, transport: async () => ({ outcome: 'sent', messageId: 'x' }) });
    expect(claims).toBe(0);
  });
});

describe('Resend transport outcome classification', () => {
  const msg = { from: 'TEKANGO <info@tekango.com>', to: 'a@synthetic.test', subject: 's', html: 'h', text: 't' };
  const respond = (status, body = {}) => async (_url, init) => { respond.last = init; return new Response(JSON.stringify(body), { status }); };

  it('2xx -> sent (message id kept); request carries the Idempotency-Key and a timeout signal', async () => {
    const f = respond(200, { id: 'resend_123' });
    expect(await sendViaResendWithOutcome(f, 're_x', msg, 'trial-reminder/u/3d/1')).toEqual({ outcome: 'sent', messageId: 'resend_123' });
    expect(respond.last.headers['Idempotency-Key']).toBe('trial-reminder/u/3d/1');
    expect(respond.last.signal).toBeInstanceOf(AbortSignal);
  });
  for (const status of [400, 401, 403, 422, 429]) {
    it(`${status} -> failed (rejected, nothing sent)`, async () => {
      expect((await sendViaResendWithOutcome(respond(status, { message: 'x' }), 're_x', msg, 'k')).outcome).toBe('failed');
    });
  }
  for (const status of [409, 500, 502, 503]) {
    it(`${status} -> unknown (may have been accepted)`, async () => {
      expect((await sendViaResendWithOutcome(respond(status), 're_x', msg, 'k')).outcome).toBe('unknown');
    });
  }
  it('network error / timeout -> unknown', async () => {
    expect((await sendViaResendWithOutcome(async () => { throw new Error('timeout'); }, 're_x', msg, 'k')).outcome).toBe('unknown');
  });
});

describe('source guards', () => {
  const src = readFileSync(resolve(cwd(), 'supabase/functions/send-trial-expiration-email/index.ts'), 'utf8');
  it('no "anything but International is Local" routing remains', () => {
    expect(src).not.toMatch(/\|\|\s*'Local'/);
    expect(src).not.toMatch(/!==\s*'International'/);
  });
  it('the batch never writes sent flags directly; it goes through the atomic claim / completion RPCs', () => {
    expect(src).not.toMatch(/\.update\(\s*\{\s*trial_reminder_/);
    expect(src).toContain("rpc('claim_trial_reminder'");
    expect(src).toContain("rpc('complete_trial_reminder'");
  });
});
