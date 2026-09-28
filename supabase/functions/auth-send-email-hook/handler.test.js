import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { handleSendEmailHook } from './handler.ts';
import { DOCUMENTED_ACTION_TYPES, NOTIFICATION_ACTION_TYPES } from './emailPlan.ts';

// Codex Post-LIVE Wave 1 blockers 1 + 2 - handler-level tests with realistic, signed Send Email Hook payloads.
// Payload shape follows the documented hook input and supabase/auth's EmailData (every email_data field is serialized,
// absent values are empty strings). All data is synthetic; Resend is a local fake - no email is sent.

const SECRET_B64 = Buffer.from('synthetic-hook-secret-for-tests-only-0123456789').toString('base64');
const ENV = {
  SEND_EMAIL_HOOK_SECRET: `v1,whsec_${SECRET_B64}`,
  RESEND_API_KEY: 're_synthetic_test_key',
  SUPABASE_URL: 'https://ixabnzhjeqevtbhdfswv.supabase.co',
};
const NOW_MS = 1_790_000_000_000;
const REDIRECT = 'https://www.tekango.com/dashboard?lang=he';
const HEBREW = /[֐-׿]/;

function makeUser(over = {}) {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'current.owner@example.test',
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { signup_market: 'Local', email_verified: true },
    identities: [],
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-27T10:00:00Z',
    is_anonymous: false,
    ...over,
  };
}

function makeEmailData(over = {}) {
  return {
    token: '',
    token_hash: '',
    redirect_to: REDIRECT,
    email_action_type: 'signup',
    site_url: 'https://www.tekango.com',
    token_new: '',
    token_hash_new: '',
    old_email: '',
    old_phone: '',
    provider: '',
    factor_type: '',
    ...over,
  };
}

function signedRequest(payload, { id = 'msg_synthetic_0001', tsSeconds = Math.floor(NOW_MS / 1000), method = 'POST', signature } = {}) {
  const body = JSON.stringify(payload);
  const sig = signature ?? `v1,${createHmac('sha256', Buffer.from(SECRET_B64, 'base64')).update(`${id}.${tsSeconds}.${body}`).digest('base64')}`;
  return new Request('https://example.test/functions/v1/auth-send-email-hook', {
    method,
    headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(tsSeconds), 'webhook-signature': sig },
    body: method === 'POST' ? body : undefined,
  });
}

function fakeResend({ failOnCall } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (failOnCall === calls.length) return new Response(JSON.stringify({ message: 'synthetic failure' }), { status: 500 });
    return new Response(JSON.stringify({ id: `resend_${calls.length}` }), { status: 200 });
  };
  return { calls, fetch };
}

// Canonical market lookup fake (Option C). Default: no business_settings row -> signup_market bootstrap, which keeps every
// pre-Option-C test's metadata semantics. `lookupCalls` records exactly what the handler asked for.
const rowsLookup = (...countries) => async () => countries.map((country) => ({ country }));

async function run(payload, { env = ENV, resend = fakeResend(), nowMs = NOW_MS, req, lookup = rowsLookup(), lookupTimeoutMs = 50 } = {}) {
  const logs = [];
  const lookupCalls = [];
  const res = await handleSendEmailHook(req ?? signedRequest(payload), {
    env: (k) => env[k],
    fetch: resend.fetch,
    nowMs: () => nowMs,
    log: (...a) => logs.push(a.join(' ')),
    lookupMarketRows: lookup === null ? undefined : async (id, signal) => { lookupCalls.push(id); return lookup(id, signal); },
    marketLookupTimeoutMs: lookupTimeoutMs,
  });
  return { res, status: res.status, json: await res.json(), calls: resend.calls, logs, lookupCalls };
}

const linkOf = (call) => {
  const m = /href="([^"]+)"/.exec(call.body.html);
  return m ? new URL(m[1].replace(/&amp;/g, '&')) : null;
};

describe('auth-send-email-hook handler - documented action contract', () => {
  it('the documented email_action_type set is modelled exactly (no invented action names)', () => {
    expect([...DOCUMENTED_ACTION_TYPES].sort()).toEqual([
      'email', 'email_change', 'email_changed_notification', 'identity_linked_notification', 'identity_unlinked_notification',
      'invite', 'magiclink', 'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification',
      'password_changed_notification', 'phone_changed_notification', 'reauthentication', 'recovery', 'signup',
    ]);
    expect(DOCUMENTED_ACTION_TYPES).not.toContain('email_change_current');
    expect(DOCUMENTED_ACTION_TYPES).not.toContain('email_change_new');
  });

  for (const action of ['signup', 'recovery', 'magiclink', 'invite']) {
    it(`${action}: one email to user.email, verify link = token_hash + type=${action}, success is an empty 200`, async () => {
      const { status, json, calls } = await run({
        user: makeUser(),
        email_data: makeEmailData({ email_action_type: action, token: '123456', token_hash: `pkce_hash_${action}` }),
      });
      expect(status).toBe(200);
      expect(json).toEqual({});
      expect(calls).toHaveLength(1);
      expect(calls[0].body.to).toEqual(['current.owner@example.test']);
      const link = linkOf(calls[0]);
      expect(link.origin).toBe(ENV.SUPABASE_URL);
      expect(link.pathname).toBe('/auth/v1/verify');
      expect(link.searchParams.get('token')).toBe(`pkce_hash_${action}`);
      expect(link.searchParams.get('type')).toBe(action);
      expect(link.searchParams.get('redirect_to')).toBe(REDIRECT);
      expect(calls[0].headers['Idempotency-Key']).toBe('auth-hook/msg_synthetic_0001/primary');
    });
  }

  describe('email_change', () => {
    // supabase/auth sendEmailChange with Secure Email Change ON: token = OTP of the CURRENT address,
    // token_hash = hash of the NEW address, token_new = OTP of the NEW address, token_hash_new = hash of the CURRENT address.
    const securePayload = (over = {}) => ({
      user: makeUser({ new_email: 'new.address@example.test', ...over.user }),
      email_data: makeEmailData({
        email_action_type: 'email_change',
        token: '111111',
        token_hash: 'hash_for_NEW_address',
        token_new: '222222',
        token_hash_new: 'hash_for_CURRENT_address',
        ...over.email_data,
      }),
    });

    it('secure: two emails - current address gets token_hash_new, new address gets token_hash (reversed naming)', async () => {
      const { status, calls } = await run(securePayload());
      expect(status).toBe(200);
      expect(calls).toHaveLength(2);
      const [toCurrent, toNew] = calls;
      expect(toCurrent.body.to).toEqual(['current.owner@example.test']);
      expect(linkOf(toCurrent).searchParams.get('token')).toBe('hash_for_CURRENT_address');
      expect(linkOf(toCurrent).searchParams.get('type')).toBe('email_change');
      expect(toNew.body.to).toEqual(['new.address@example.test']);
      expect(linkOf(toNew).searchParams.get('token')).toBe('hash_for_NEW_address');
      expect(linkOf(toNew).searchParams.get('type')).toBe('email_change');
      // distinct idempotency keys per message, both bound to the webhook-id
      expect(toCurrent.headers['Idempotency-Key']).toBe('auth-hook/msg_synthetic_0001/current');
      expect(toNew.headers['Idempotency-Key']).toBe('auth-hook/msg_synthetic_0001/new');
      // the current-address email names the requested new address; the two messages are different
      expect(toCurrent.body.html).toContain('new.address@example.test');
      expect(toCurrent.body.subject).not.toBe(toNew.body.subject);
    });

    it('non-secure: exactly one email, to the NEW address, using token_hash - never to user.email', async () => {
      const { status, calls } = await run({
        user: makeUser({ new_email: 'new.address@example.test' }),
        email_data: makeEmailData({ email_action_type: 'email_change', token: '222222', token_hash: 'hash_for_NEW_address' }),
      });
      expect(status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(calls[0].body.to).toEqual(['new.address@example.test']);
      expect(linkOf(calls[0]).searchParams.get('token')).toBe('hash_for_NEW_address');
      expect(calls.flatMap((c) => c.body.to)).not.toContain('current.owner@example.test');
    });

    it('phone-only user (no current email) linking an email: one email to the new address', async () => {
      const { status, calls } = await run({
        user: makeUser({ email: '', phone: '972500000000', new_email: 'new.address@example.test' }),
        email_data: makeEmailData({ email_action_type: 'email_change', token: '222222', token_hash: 'hash_for_NEW_address' }),
      });
      expect(status).toBe(200);
      expect(calls.map((c) => c.body.to[0])).toEqual(['new.address@example.test']);
    });

    it('missing user.new_email: refused, nothing sent (never falls back to user.email)', async () => {
      const { status, json, calls } = await run(securePayload({ user: { new_email: '' } }));
      expect(status).toBe(400);
      expect(json.error.http_code).toBe(400);
      expect(calls).toHaveLength(0);
    });

    it('secure payload without a current address: refused, nothing sent', async () => {
      const { status, calls } = await run(securePayload({ user: { email: '' } }));
      expect(status).toBe(400);
      expect(calls).toHaveLength(0);
    });

    it('missing token_hash: refused, nothing sent', async () => {
      const { status, calls } = await run(securePayload({ email_data: { token_hash: '' } }));
      expect(status).toBe(400);
      expect(calls).toHaveLength(0);
    });

    it('secure: second send fails -> hook fails (Auth reports failure); a redelivery reuses both idempotency keys', async () => {
      const first = await run(securePayload(), { resend: fakeResend({ failOnCall: 2 }) });
      expect(first.status).toBe(500);
      expect(first.json.error.http_code).toBe(500);
      const retry = await run(securePayload());
      expect(retry.status).toBe(200);
      expect(retry.calls.map((c) => c.headers['Idempotency-Key'])).toEqual(first.calls.map((c) => c.headers['Idempotency-Key']));
      expect(retry.calls[0].body).toEqual(first.calls[0].body); // same key + same payload -> Resend returns the original, no 2nd email
    });
  });

  it('reauthentication: sends the one-time code to user.email with no link / CTA', async () => {
    const { status, calls } = await run({ user: makeUser(), email_data: makeEmailData({ email_action_type: 'reauthentication', token: '482913' }) });
    expect(status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].body.to).toEqual(['current.owner@example.test']);
    expect(calls[0].body.html).toContain('482913');
    expect(calls[0].body.text).toContain('482913');
    expect(calls[0].body.html).not.toMatch(/<a\s/i);
    expect(`${calls[0].body.html}${calls[0].body.text}`).not.toContain('/auth/v1/verify');
  });

  it('reauthentication without a code: refused, nothing sent', async () => {
    const { status, calls } = await run({ user: makeUser(), email_data: makeEmailData({ email_action_type: 'reauthentication' }) });
    expect(status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  describe('notification actions: information only, never a verification CTA', () => {
    for (const action of NOTIFICATION_ACTION_TYPES) {
      it(`${action}: no link, no button, no verify URL; correct recipient`, async () => {
        const { status, calls } = await run({
          user: makeUser({ email: 'current.owner@example.test' }),
          email_data: makeEmailData({
            email_action_type: action,
            old_email: action === 'email_changed_notification' ? 'previous.owner@example.test' : '',
            provider: action.startsWith('identity_') ? 'google' : '',
            factor_type: action.startsWith('mfa_') ? 'totp' : '',
          }),
        });
        expect(status).toBe(200);
        expect(calls).toHaveLength(1);
        const all = `${calls[0].body.html}\n${calls[0].body.text}`;
        expect(all).not.toMatch(/<a\s/i);
        expect(all).not.toMatch(/https?:\/\//);
        expect(all).not.toContain('/auth/v1/verify');
        expect(calls[0].body.to).toEqual([
          action === 'email_changed_notification' ? 'previous.owner@example.test' : 'current.owner@example.test',
        ]);
      });
    }

    it('email_changed_notification without old_email: refused, nothing sent', async () => {
      const { status, calls } = await run({ user: makeUser(), email_data: makeEmailData({ email_action_type: 'email_changed_notification' }) });
      expect(status).toBe(400);
      expect(calls).toHaveLength(0);
    });
  });

  for (const action of ['email', 'email_change_current', 'email_change_new', 'something_new', '']) {
    it(`unsupported / undocumented action "${action}": refused with non-2xx, nothing sent, no generic CTA`, async () => {
      const { status, json, calls } = await run({ user: makeUser(), email_data: makeEmailData({ email_action_type: action, token_hash: 'h' }) });
      expect(status).toBe(400);
      expect(json.error.http_code).toBe(400);
      expect(calls).toHaveLength(0);
    });
  }
});

describe('auth-send-email-hook handler - market separation, bootstrap (no business_settings row yet)', () => {
  const recovery = (md) => ({ user: makeUser({ user_metadata: md }), email_data: makeEmailData({ email_action_type: 'recovery', token_hash: 'h1' }) });

  it('Local -> Hebrew RTL, support@ sender', async () => {
    const { calls } = await run(recovery({ signup_market: 'Local' }));
    expect(calls[0].body.from).toBe('TEKANGO Support <support@tekango.com>');
    expect(calls[0].body.html).toContain('dir="rtl"');
    expect(calls[0].body.subject).toMatch(HEBREW);
  });

  for (const md of [{ signup_market: 'International' }, {}, null, { signup_market: 'Unknown' }, { signup_market: 'local' }, { signup_market: 'LCL' }, { signup_market: ' Local' }]) {
    it(`${JSON.stringify(md)} -> English LTR, info@ sender (never Local)`, async () => {
      const { calls } = await run(recovery(md));
      expect(calls[0].body.from).toBe('TEKANGO <info@tekango.com>');
      expect(calls[0].body.html).toContain('dir="ltr"');
      expect(`${calls[0].body.subject}${calls[0].body.html}${calls[0].body.text}`).not.toMatch(HEBREW);
    });
  }

  it('secure email change: both messages are in the same (account) market', async () => {
    const { calls } = await run({
      user: makeUser({ new_email: 'new.address@example.test', user_metadata: { signup_market: 'International' } }),
      email_data: makeEmailData({ email_action_type: 'email_change', token: '1', token_hash: 'a', token_new: '2', token_hash_new: 'b' }),
    });
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.body.from).toBe('TEKANGO <info@tekango.com>');
      expect(`${c.body.subject}${c.body.html}`).not.toMatch(HEBREW);
    }
  });
});

describe('auth-send-email-hook handler - authentication and replay', () => {
  const payload = { user: makeUser(), email_data: makeEmailData({ email_action_type: 'signup', token_hash: 'h' }) };

  it('invalid signature -> 401, nothing sent', async () => {
    const { status, calls } = await run(payload, { req: signedRequest(payload, { signature: `v1,${Buffer.alloc(32).toString('base64')}` }) });
    expect(status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('stale timestamp (captured request replayed 10 minutes later) -> 401, nothing sent', async () => {
    const req = signedRequest(payload, { tsSeconds: Math.floor(NOW_MS / 1000) - 600 });
    const { status, calls } = await run(payload, { req });
    expect(status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('future timestamp beyond tolerance -> 401, nothing sent', async () => {
    const req = signedRequest(payload, { tsSeconds: Math.floor(NOW_MS / 1000) + 600 });
    const { status, calls } = await run(payload, { req });
    expect(status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('missing signature headers -> 401, nothing sent', async () => {
    const req = new Request('https://example.test/fn', { method: 'POST', body: JSON.stringify(payload) });
    const { status, calls } = await run(payload, { req });
    expect(status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('replay inside the tolerance window: same webhook-id -> same Idempotency-Key and identical body (provider dedup)', async () => {
    const a = await run(payload);
    const b = await run(payload, { nowMs: NOW_MS + 120_000 });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.calls[0].headers['Idempotency-Key']).toBe(a.calls[0].headers['Idempotency-Key']);
    expect(b.calls[0].body).toEqual(a.calls[0].body);
  });

  it('missing SEND_EMAIL_HOOK_SECRET -> 500, nothing sent', async () => {
    const { status, calls } = await run(payload, { env: { ...ENV, SEND_EMAIL_HOOK_SECRET: '' } });
    expect(status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it('malformed configured secret -> 500 configuration error, nothing sent', async () => {
    const { status, calls } = await run(payload, { env: { ...ENV, SEND_EMAIL_HOOK_SECRET: SECRET_B64 } });
    expect(status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it('non-POST -> 405', async () => {
    const { status, calls } = await run(payload, { req: signedRequest(payload, { method: 'GET' }) });
    expect(status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it('Resend failure -> documented error shape, non-2xx', async () => {
    const { status, json } = await run(payload, { resend: fakeResend({ failOnCall: 1 }) });
    expect(status).toBe(500);
    expect(json).toEqual({ error: { http_code: 500, message: 'Failed to send email via Resend' } });
  });
});

// ============================================================================================================================
// Auth market identity gap F1 - Option C (Owner-approved 2026-09-28): canonical business_settings.country first, signup
// metadata only while no row exists, fail closed to International; integrated through the real handler for every flow.
// ============================================================================================================================
const LOCAL_FROM = 'TEKANGO Support <support@tekango.com>';
const INTL_FROM = 'TEKANGO <info@tekango.com>';
const expectLocal = (c) => {
  expect(c.body.from).toBe(LOCAL_FROM);
  expect(c.body.html).toContain('dir="rtl"');
  expect(c.body.subject).toMatch(HEBREW);
};
const expectIntl = (c) => {
  expect(c.body.from).toBe(INTL_FROM);
  expect(c.body.html).toContain('dir="ltr"');
  expect(`${c.body.subject}${c.body.html}${c.body.text}`).not.toMatch(HEBREW);
};
const hangingLookup = () => new Promise(() => {});
const VERIFIED_ID = '11111111-2222-4333-8444-555555555555';

const FLOWS = {
  signup: (md) => ({ user: makeUser({ user_metadata: md }), email_data: makeEmailData({ email_action_type: 'signup', token_hash: 'h_signup' }) }),
  recovery: (md) => ({ user: makeUser({ user_metadata: md }), email_data: makeEmailData({ email_action_type: 'recovery', token_hash: 'h_recovery' }) }),
  secure_email_change: (md) => ({
    user: makeUser({ user_metadata: md, new_email: 'new.address@example.test' }),
    email_data: makeEmailData({ email_action_type: 'email_change', token: '111111', token_hash: 'h_new', token_new: '222222', token_hash_new: 'h_current' }),
  }),
  reauthentication: (md) => ({ user: makeUser({ user_metadata: md }), email_data: makeEmailData({ email_action_type: 'reauthentication', token: '482913' }) }),
  password_changed_notification: (md) => ({ user: makeUser({ user_metadata: md }), email_data: makeEmailData({ email_action_type: 'password_changed_notification' }) }),
};
const EXPECTED_MESSAGES = { signup: 1, recovery: 1, secure_email_change: 2, reauthentication: 1, password_changed_notification: 1 };

describe('Option C - existing users: the canonical business_settings row decides, for every flow', () => {
  const CASES = [
    ['DB Local + missing metadata', ['Local'], {}, 'Local'],
    ['DB LCL + missing metadata', ['LCL'], {}, 'Local'],
    ['DB International + missing metadata', ['International'], {}, 'International'],
    ['DB Local + conflicting International metadata (DB wins)', ['Local'], { signup_market: 'International' }, 'Local'],
    ['DB International + conflicting Local metadata (DB wins)', ['International'], { signup_market: 'Local' }, 'International'],
    ['DB Unknown + Local metadata (metadata ignored)', ['Unknown'], { signup_market: 'Local' }, 'International'],
    ['DB null + Local metadata (metadata ignored)', [null], { signup_market: 'Local' }, 'International'],
    ['DB malformed "local " + Local metadata (metadata ignored)', ['local '], { signup_market: 'Local' }, 'International'],
  ];
  for (const [flow, build] of Object.entries(FLOWS)) {
    for (const [name, countries, md, market] of CASES) {
      it(`${flow}: ${name} -> ${market === 'Local' ? 'HE / RTL / support@' : 'EN / LTR / info@'}`, async () => {
        const { status, calls, lookupCalls } = await run(build(md), { lookup: rowsLookup(...countries) });
        expect(status).toBe(200);
        expect(calls).toHaveLength(EXPECTED_MESSAGES[flow]);
        for (const c of calls) (market === 'Local' ? expectLocal : expectIntl)(c);
        expect(lookupCalls).toEqual([VERIFIED_ID]);
      });
    }
  }
});

describe('Option C - bootstrap: signup metadata ONLY when no business row exists', () => {
  for (const [flow, build] of Object.entries(FLOWS)) {
    for (const [md, market] of [
      [{ signup_market: 'Local' }, 'Local'],
      [{ signup_market: 'International' }, 'International'],
      [{}, 'International'],
      [null, 'International'],
      [{ signup_market: 'local' }, 'International'],
      [{ signup_market: 'LCL' }, 'International'], // the LCL alias applies to the canonical row only, never to metadata
    ]) {
      it(`${flow}: no row + ${JSON.stringify(md)} -> ${market}`, async () => {
        const { status, calls } = await run(build(md), { lookup: rowsLookup() });
        expect(status).toBe(200);
        expect(calls).toHaveLength(EXPECTED_MESSAGES[flow]);
        for (const c of calls) (market === 'Local' ? expectLocal : expectIntl)(c);
      });
    }
  }
});

describe('Option C - failures fail closed to International and the Auth email is still sent', () => {
  const recovery = FLOWS.recovery({ signup_market: 'Local' });
  it('DB timeout + Local metadata -> EN, sent (bounded by the deadline)', async () => {
    const started = Date.now();
    const { status, calls, logs } = await run(recovery, { lookup: hangingLookup, lookupTimeoutMs: 30 });
    expect(status).toBe(200);
    expect(calls).toHaveLength(1);
    expectIntl(calls[0]);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(logs.join('\n')).toContain('market fail-closed to International (lookup_timeout)');
  });
  it('DB error + Local metadata -> EN, sent', async () => {
    const { status, calls, logs } = await run(recovery, { lookup: async () => { throw new Error('connection refused'); } });
    expect(status).toBe(200);
    expectIntl(calls[0]);
    expect(logs.join('\n')).toContain('(lookup_error)');
  });
  it('multiple rows + Local metadata -> EN, sent, anomaly logged', async () => {
    const { status, calls, logs } = await run(recovery, { lookup: rowsLookup('Local', 'Local') });
    expect(status).toBe(200);
    expectIntl(calls[0]);
    expect(logs.join('\n')).toContain('(lookup_multiple_rows)');
  });
  it('lookup not wired (misconfiguration) + Local metadata -> EN, sent', async () => {
    const { status, calls, logs } = await run(recovery, { lookup: null });
    expect(status).toBe(200);
    expectIntl(calls[0]);
    expect(logs.join('\n')).toContain('(lookup_not_configured)');
  });
  it('a failing lookup leaks no secret, id, address or database message into logs or the response', async () => {
    const SECRET = 'sb_secret_SYNTHETIC_ONLY';
    const { status, json, logs } = await run(recovery, { lookup: async () => { throw new Error(`boom ${SECRET} ${VERIFIED_ID} current.owner@example.test`); } });
    expect(status).toBe(200);
    const all = `${logs.join('\n')}\n${JSON.stringify(json)}`;
    for (const s of [SECRET, VERIFIED_ID, 'current.owner@example.test', 'boom']) expect(all).not.toContain(s);
  });
});

describe('Option C - trust boundary: the lookup uses only the verified payload user.id, and only for a sendable request', () => {
  const payload = FLOWS.recovery({ signup_market: 'Local' });
  it('invalid signature -> 401, no lookup, nothing sent', async () => {
    const { status, calls, lookupCalls } = await run(payload, { req: signedRequest(payload, { signature: `v1,${Buffer.alloc(32).toString('base64')}` }), lookup: rowsLookup('Local') });
    expect(status).toBe(401);
    expect(calls).toHaveLength(0);
    expect(lookupCalls).toHaveLength(0);
  });
  it('unsupported action -> 400, no lookup', async () => {
    const { status, lookupCalls } = await run({ user: makeUser(), email_data: makeEmailData({ email_action_type: 'email', token_hash: 'h' }) }, { lookup: rowsLookup('Local') });
    expect(status).toBe(400);
    expect(lookupCalls).toHaveLength(0);
  });
  it('a non-UUID user.id is never sent to the database -> EN fail-closed', async () => {
    const { status, calls, lookupCalls } = await run({ ...payload, user: { ...payload.user, id: 'x-or-1-eq-1' } }, { lookup: rowsLookup('Local') });
    expect(status).toBe(200);
    expect(lookupCalls).toHaveLength(0);
    expectIntl(calls[0]);
  });
});

describe('Option C - redelivery with a different market resolution never produces a second email', () => {
  // Resend idempotency (documented): same key + same body -> original response, no new email; same key + different body ->
  // 409 invalid_idempotent_request; concurrent same key -> 409 concurrent_idempotent_requests.
  function idempotentResend({ concurrentOnKey } = {}) {
    const store = new Map();
    const accepted = [];
    const calls = [];
    const fetch = async (url, init) => {
      const key = init.headers['Idempotency-Key'];
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      if (concurrentOnKey === key) return new Response(JSON.stringify({ name: 'concurrent_idempotent_requests' }), { status: 409 });
      if (store.has(key)) {
        return store.get(key).body === init.body
          ? new Response(JSON.stringify({ id: store.get(key).id }), { status: 200 })
          : new Response(JSON.stringify({ name: 'invalid_idempotent_request', message: 'different payload' }), { status: 409 });
      }
      const id = `resend_${store.size + 1}`;
      store.set(key, { body: init.body, id });
      accepted.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id }), { status: 200 });
    };
    return { fetch, calls, accepted };
  }
  const payload = FLOWS.recovery({ signup_market: 'Local' });

  it('attempt 1 lookup timeout (EN sent); redelivery resolves Local (HE) -> 409, hook fails, still exactly ONE accepted email, same key', async () => {
    const resend = idempotentResend();
    const first = await run(payload, { resend, lookup: hangingLookup, lookupTimeoutMs: 20 });
    expect(first.status).toBe(200);
    const second = await run(payload, { resend, lookup: rowsLookup('Local'), nowMs: NOW_MS + 60_000 });
    expect(second.status).toBe(500);
    expect(second.json.error.message).toBe('Email not sent: idempotency conflict for this request');
    expect(resend.accepted).toHaveLength(1);
    expect(resend.accepted[0].from).toBe(INTL_FROM);
    expect(new Set(resend.calls.map((c) => c.headers['Idempotency-Key']))).toEqual(new Set(['auth-hook/msg_synthetic_0001/primary']));
    expect(second.logs.join('\n')).toContain('Resend idempotency conflict (invalid_idempotent_request); not re-sent.');
  });

  it('redelivery with the same resolution -> 200, provider dedup, still one accepted email', async () => {
    const resend = idempotentResend();
    await run(payload, { resend, lookup: rowsLookup('Local') });
    const again = await run(payload, { resend, lookup: rowsLookup('Local'), nowMs: NOW_MS + 60_000 });
    expect(again.status).toBe(200);
    expect(resend.accepted).toHaveLength(1);
    expect(resend.accepted[0].from).toBe(LOCAL_FROM);
  });

  it('secure email change redelivery with a changed market: conflict on the first slot, no new key, no extra email', async () => {
    const resend = idempotentResend();
    const change = FLOWS.secure_email_change({});
    expect((await run(change, { resend, lookup: rowsLookup('International') })).status).toBe(200);
    const again = await run(change, { resend, lookup: rowsLookup('Local') });
    expect(again.status).toBe(500);
    expect(resend.accepted).toHaveLength(2);
    for (const c of resend.calls) expect(['auth-hook/msg_synthetic_0001/current', 'auth-hook/msg_synthetic_0001/new']).toContain(c.headers['Idempotency-Key']);
  });

  it('concurrent same-key request -> 409 concurrent_idempotent_requests -> hook fails, nothing new accepted', async () => {
    const resend = idempotentResend({ concurrentOnKey: 'auth-hook/msg_synthetic_0001/primary' });
    const r = await run(payload, { resend, lookup: rowsLookup('Local') });
    expect(r.status).toBe(500);
    expect(resend.accepted).toHaveLength(0);
    expect(r.logs.join('\n')).toContain('(concurrent_idempotent_requests)');
  });
});
