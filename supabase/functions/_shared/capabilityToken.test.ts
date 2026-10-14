// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import {
  base64UrlEncode, canonicalSnapshotPath, decodeToken, isValidToken, mintToken, parseCapabilityResolution, parseGrantRedemption,
  publicPathFor, readVerifiedSnapshot, resolveServerMarket, tokenHash, TOKEN_LENGTH,
} from './capabilityToken';

const U = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const A = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444';
const H = 'a'.repeat(64);

describe('token format: 32 random bytes, canonical base64url, 43 chars', () => {
  it('mints 43-char tokens that round-trip to exactly 32 bytes and match Node base64url', () => {
    for (let i = 0; i < 200; i++) {
      const t = mintToken();
      expect(t).toHaveLength(TOKEN_LENGTH);
      const b = decodeToken(t)!;
      expect(b).toHaveLength(32);
      expect(Buffer.from(b).toString('base64url')).toBe(t);
      expect(base64UrlEncode(b)).toBe(t);
    }
  });
  it('uses the injected random source (deterministic for tests) and refuses a failing source', () => {
    const fixed = randomBytes(32);
    expect(mintToken((buf) => { buf.set(fixed); return buf; })).toBe(fixed.toString('base64url'));
    expect(() => mintToken(() => new Uint8Array(3))).toThrow();
  });
  it.each([
    ['empty', ''], ['42 chars', 'A'.repeat(42)], ['44 chars', 'A'.repeat(44)], ['padding', `${'A'.repeat(42)}=`],
    ['std base64 char +', `${'A'.repeat(42)}+`], ['slash', `${'A'.repeat(41)}/A`], ['space', ` ${'A'.repeat(42)}`],
    ['non-canonical last char (padding bits set)', `${'A'.repeat(42)}B`], ['number', 12345], ['null', null], ['object', {}],
    ['uuid', '22222222-2222-4222-8222-222222222222'],
  ])('rejects %s', async (_n, v) => {
    expect(isValidToken(v)).toBe(false);
    expect(await tokenHash(v)).toBeNull();
  });
  it('token_hash = lowercase sha256 hex of the UTF-8 token string', async () => {
    const t = mintToken();
    expect(await tokenHash(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'));
  });
});

describe('public path language comes only from the server market', () => {
  const t = mintToken();
  it('IL -> Hebrew route, INTERNATIONAL -> English route', () => {
    expect(publicPathFor(t, 'IL')).toBe(`/public-quote/c/${t}`);
    expect(publicPathFor(t, 'INTERNATIONAL')).toBe(`/en/public-quote/c/${t}`);
    expect(() => publicPathFor('bad', 'IL')).toThrow();
  });
  it.each([
    [{ accountMarket: 'IL', businessCountry: 'Local' }, 'IL'],
    [{ accountMarket: 'INTERNATIONAL', businessCountry: 'International' }, 'INTERNATIONAL'],
    [{ accountMarket: undefined, businessCountry: 'LCL' }, 'IL'],
    [{ accountMarket: null, businessCountry: 'International' }, 'INTERNATIONAL'],
    [{ accountMarket: 'IL', businessCountry: null }, 'IL'],
    [{ accountMarket: 'IL', businessCountry: 'International' }, null],   // contradiction fails closed
    [{ accountMarket: 'US', businessCountry: 'Local' }, null],            // unknown value fails closed
    [{ accountMarket: undefined, businessCountry: 'Israel' }, null],
    [{ accountMarket: undefined, businessCountry: undefined }, null],
  ])('%j -> %s', (input, want) => { expect(resolveServerMarket(input)).toBe(want); });
});

describe('strict SQL answer parsers (uniform not-found on anything else)', () => {
  const good = { ok: true, capabilityId: C, userId: U, quoteId: Q, attemptId: A, snapshotPath: canonicalSnapshotPath(U, Q, A), snapshotSha256: H, ops: ['view', 'approve'] };
  it('accepts the documented success shape', () => {
    expect(parseCapabilityResolution(good, 'view')).toMatchObject({ userId: U, quoteId: Q, attemptId: A });
    expect(parseCapabilityResolution(good, 'approve')).not.toBeNull();
  });
  it.each([
    ['ok false', { ...good, ok: false }], ['not_found', { ok: false, code: 'not_found' }],
    ['op not allowed', { ...good, ops: ['approve'] }], ['unknown op', { ...good, ops: ['view', 'admin'] }],
    ['path of another quote', { ...good, snapshotPath: canonicalSnapshotPath(U, A, A) }],
    ['path of another owner', { ...good, snapshotPath: canonicalSnapshotPath(C, Q, A) }],
    ['bad hash', { ...good, snapshotSha256: 'A'.repeat(64) }], ['uppercase uuid', { ...good, capabilityId: 'ABCDEF01-4444-4444-8444-444444444444' }],
    ['no capability id', { ...good, capabilityId: undefined }], ['array', [good]], ['null', null],
  ])('%s -> null', (_n, raw) => { expect(parseCapabilityResolution(raw, 'view')).toBeNull(); });
  it('grant redemption: channel must match when echoed', () => {
    const g = { ok: true, userId: U, quoteId: Q, attemptId: A, snapshotPath: canonicalSnapshotPath(U, Q, A), snapshotSha256: H };
    expect(parseGrantRedemption(g, 'final_pdf')).not.toBeNull();
    expect(parseGrantRedemption({ ...g, channel: 'final_print' }, 'final_pdf')).toBeNull();
    expect(parseGrantRedemption({ ok: false, code: 'not_found' }, 'final_pdf')).toBeNull();
  });
});

describe('readVerifiedSnapshot: bytes hash + identity header', () => {
  const snap = { kind: 'tekango-issued-quote-document', schemaVersion: 1, attemptId: A, ownerId: U, quoteId: Q };
  const bytes = new TextEncoder().encode(JSON.stringify(snap));
  const sha = createHash('sha256').update(bytes).digest('hex');
  const bound = { userId: U, quoteId: Q, attemptId: A, snapshotPath: canonicalSnapshotPath(U, Q, A), snapshotSha256: sha };
  it('ok for the bound bytes', async () => {
    expect((await readVerifiedSnapshot(bound, async () => bytes)).ok).toBe(true);
  });
  it.each([
    ['missing', async () => null, 'snapshot_missing'],
    ['tampered bytes', async () => new TextEncoder().encode(JSON.stringify({ ...snap, total: 1 })), 'snapshot_hash_mismatch'],
    ['storage error', async () => { throw new Error('x'); }, 'storage_unavailable'],
  ])('%s', async (_n, read, reason) => {
    expect(await readVerifiedSnapshot(bound, read as never)).toEqual({ ok: false, reason });
  });
  it('identity header must equal the bound identities', async () => {
    const other = new TextEncoder().encode(JSON.stringify({ ...snap, quoteId: C }));
    const r = await readVerifiedSnapshot({ ...bound, snapshotSha256: createHash('sha256').update(other).digest('hex') }, async () => other);
    expect(r).toEqual({ ok: false, reason: 'snapshot_identity_mismatch' });
  });
});
