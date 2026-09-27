import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { cwd } from 'node:process';
import { verifyStandardWebhook, parseHookSecret, timingSafeEqual, WEBHOOK_TOLERANCE_SECONDS } from './webhookVerify.ts';

// Codex Post-LIVE Wave 1 blocker 2 - Standard Webhooks verification: timestamp tolerance, version handling, constant-time
// comparison. Expected signatures are computed here with node:crypto (an implementation independent of the one under test)
// and checked against the published Standard Webhooks / Svix example vector.

const SECRET_B64 = Buffer.from('synthetic-hook-secret-for-tests-only-0123456789').toString('base64');
const SUPABASE_SECRET = `v1,whsec_${SECRET_B64}`;
const NOW = 1_790_000_000; // seconds

const sign = (id, ts, body, secretB64 = SECRET_B64) =>
  createHmac('sha256', Buffer.from(secretB64, 'base64')).update(`${id}.${ts}.${body}`).digest('base64');

const verify = (over = {}) => {
  const body = over.rawBody ?? '{"a":1}';
  const id = 'id' in over ? over.id : 'msg_synthetic_1';
  const ts = 'timestamp' in over ? over.timestamp : String(NOW);
  const sig = 'signatureHeader' in over ? over.signatureHeader : `v1,${sign(id, ts, body)}`;
  return verifyStandardWebhook({
    id,
    timestamp: ts,
    signatureHeader: sig,
    rawBody: body,
    secret: over.secret ?? SUPABASE_SECRET,
    nowSeconds: over.nowSeconds ?? NOW,
  });
};

describe('Standard Webhooks verification (auth-send-email-hook)', () => {
  it('matches the published Standard Webhooks example vector', async () => {
    const res = await verifyStandardWebhook({
      id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
      timestamp: '1614265330',
      signatureHeader: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
      rawBody: '{"test": 2432232314}',
      secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
      nowSeconds: 1614265330,
    });
    expect(res).toEqual({ ok: true });
  });

  it('accepts a valid v1 signature with the Supabase "v1,whsec_" secret format', async () => {
    expect(await verify()).toEqual({ ok: true });
  });

  it('accepts when one of several space-delimited signatures is a valid v1 (key rotation)', async () => {
    const good = sign('msg_synthetic_1', String(NOW), '{"a":1}');
    const header = `v1,${Buffer.alloc(32, 7).toString('base64')} v1a,${good} v1,${good}`;
    expect(await verify({ signatureHeader: header })).toEqual({ ok: true });
  });

  describe('replay resistance: timestamp tolerance', () => {
    it('tolerance is 5 minutes (reference verifier value)', () => {
      expect(WEBHOOK_TOLERANCE_SECONDS).toBe(300);
    });

    it('rejects a correctly signed message older than the tolerance (replay)', async () => {
      const ts = String(NOW - 301);
      const body = '{"a":1}';
      const res = await verify({ timestamp: ts, signatureHeader: `v1,${sign('msg_synthetic_1', ts, body)}` });
      expect(res).toEqual({ ok: false, reason: 'timestamp_too_old' });
    });

    it('accepts exactly at the tolerance edge, rejects one second past it', async () => {
      const edge = String(NOW - 300);
      expect(await verify({ timestamp: edge, signatureHeader: `v1,${sign('msg_synthetic_1', edge, '{"a":1}')}` })).toEqual({ ok: true });
      const future = String(NOW + 301);
      expect(await verify({ timestamp: future, signatureHeader: `v1,${sign('msg_synthetic_1', future, '{"a":1}')}` }))
        .toEqual({ ok: false, reason: 'timestamp_too_new' });
    });

    it('a captured valid request replayed 6 minutes later is rejected', async () => {
      const captured = { timestamp: String(NOW), signatureHeader: `v1,${sign('msg_synthetic_1', String(NOW), '{"a":1}')}` };
      expect(await verify(captured)).toEqual({ ok: true });
      expect(await verify({ ...captured, nowSeconds: NOW + 360 })).toEqual({ ok: false, reason: 'timestamp_too_old' });
    });

    it('re-signing the old signature with a fresh timestamp does not verify (timestamp is inside the MAC)', async () => {
      const oldSig = sign('msg_synthetic_1', String(NOW - 3600), '{"a":1}');
      expect(await verify({ timestamp: String(NOW), signatureHeader: `v1,${oldSig}` }))
        .toEqual({ ok: false, reason: 'no_matching_v1_signature' });
    });
  });

  describe('malformed / missing headers', () => {
    for (const [name, over, reason] of [
      ['missing webhook-id', { id: null }, 'missing_headers'],
      ['missing webhook-timestamp', { timestamp: null }, 'missing_headers'],
      ['missing webhook-signature', { signatureHeader: null }, 'missing_headers'],
      ['empty webhook-id', { id: '' }, 'missing_headers'],
      ['webhook-id with whitespace', { id: 'msg 1' }, 'invalid_webhook_id'],
      ['non-numeric timestamp', { timestamp: 'abc' }, 'invalid_timestamp'],
      ['timestamp with trailing junk (parseInt would accept)', { timestamp: `${NOW}abc` }, 'invalid_timestamp'],
      ['negative timestamp', { timestamp: '-5' }, 'invalid_timestamp'],
      ['decimal timestamp', { timestamp: `${NOW}.5` }, 'invalid_timestamp'],
      ['millisecond timestamp (13 digits)', { timestamp: String(NOW * 1000) }, 'invalid_timestamp'],
      ['far-future seconds timestamp', { timestamp: String(NOW + 86400) }, 'timestamp_too_new'],
    ]) {
      it(`rejects: ${name}`, async () => {
        expect(await verify(over)).toEqual({ ok: false, reason });
      });
    }
  });

  describe('signature version / value', () => {
    const good = () => sign('msg_synthetic_1', String(NOW), '{"a":1}');
    it('rejects a correct HMAC presented under a non-v1 version (v2)', async () => {
      expect((await verify({ signatureHeader: `v2,${good()}` })).ok).toBe(false);
    });
    it('rejects a correct HMAC presented as v1a (asymmetric scheme, not used here)', async () => {
      expect((await verify({ signatureHeader: `v1a,${good()}` })).ok).toBe(false);
    });
    it('rejects a signature without a version prefix', async () => {
      expect((await verify({ signatureHeader: good() })).ok).toBe(false);
    });
    it('rejects a truncated / wrong-length signature', async () => {
      expect((await verify({ signatureHeader: `v1,${good().slice(0, 20)}` })).ok).toBe(false);
    });
    it('rejects a signature over a tampered body', async () => {
      // signature computed over the original body, delivered with a tampered body
      expect((await verify({ rawBody: '{"a":2}', signatureHeader: `v1,${good()}` })).ok).toBe(false);
    });
    it('rejects a signature made with another secret', async () => {
      const other = Buffer.from('another-secret').toString('base64');
      expect((await verify({ signatureHeader: `v1,${sign('msg_synthetic_1', String(NOW), '{"a":1}', other)}` })).ok).toBe(false);
    });
    it('rejects a signature for another webhook-id', async () => {
      expect((await verify({ signatureHeader: `v1,${sign('msg_other', String(NOW), '{"a":1}')}` })).ok).toBe(false);
    });
    it('rejects garbage signature entries', async () => {
      expect((await verify({ signatureHeader: 'v1, v1,,, ,v1 v1,%%%' })).ok).toBe(false);
    });
  });

  describe('secret format', () => {
    it('accepts "v1,whsec_<b64>" and "whsec_<b64>", rejects anything else', () => {
      expect(parseHookSecret(`v1,whsec_${SECRET_B64}`)).toBeInstanceOf(Uint8Array);
      expect(parseHookSecret(`whsec_${SECRET_B64}`)).toBeInstanceOf(Uint8Array);
      for (const bad of ['', SECRET_B64, 'v1,', 'whsec_', 'v2,whsec_abcd', 'whsec_not base64!', `v1,whsec_${SECRET_B64}x`]) {
        expect(parseHookSecret(bad)).toBeNull();
      }
    });
    it('a malformed configured secret is reported as a configuration error, never as a pass', async () => {
      expect(await verify({ secret: SECRET_B64 })).toEqual({ ok: false, reason: 'invalid_secret_format' });
    });
  });

  it('timingSafeEqual: equal only for identical bytes of identical length', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });

  it('source: no plain string equality on signatures, no parseInt timestamp parsing', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(cwd(), 'supabase/functions/auth-send-email-hook/webhookVerify.ts'), 'utf8');
    expect(src).not.toMatch(/===\s*expected|expected\s*===/);
    expect(src).not.toMatch(/parseInt\(/);
  });
});
