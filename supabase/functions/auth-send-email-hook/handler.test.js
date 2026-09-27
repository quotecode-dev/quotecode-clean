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

async function run(payload, { env = ENV, resend = fakeResend(), nowMs = NOW_MS, req } = {}) {
  const logs = [];
  const res = await handleSendEmailHook(req ?? signedRequest(payload), {
    env: (k) => env[k],
    fetch: resend.fetch,
    nowMs: () => nowMs,
    log: (...a) => logs.push(a.join(' ')),
  });
  return { res, status: res.status, json: await res.json(), calls: resend.calls, logs };
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

describe('auth-send-email-hook handler - market separation', () => {
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
