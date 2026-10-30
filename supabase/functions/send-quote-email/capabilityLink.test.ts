// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { decideEmailLink, legacyQuoteLink, loggableBody } from './capabilityLink';
import { canonicalSnapshotPath, mintToken, tokenHash } from '../_shared/capabilityToken';

const ORIGIN = 'https://www.tekango.com';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '66666666-6666-4666-8666-666666666666';
const QA = '22222222-2222-4222-8222-222222222222';
const QB = '55555555-5555-4555-8555-555555555555';
const ATT = '33333333-3333-4333-8333-333333333333';
const res = (userId: string, quoteId: string) => ({ ok: true, capabilityId: '44444444-4444-4444-8444-444444444444', userId, quoteId, attemptId: ATT,
  snapshotPath: canonicalSnapshotPath(userId, quoteId, ATT), snapshotSha256: 'a'.repeat(64), ops: ['view', 'approve'] });

describe('not enforced: byte-identical id link, capabilityToken ignored', () => {
  it.each(['absent', 'prepared', 'shadow'] as const)('%s', async (phase) => {
    const resolve = vi.fn();
    const he = await decideEmailLink({ phase, origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: true, capabilityToken: mintToken(), resolve });
    const en = await decideEmailLink({ phase, origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: false, capabilityToken: undefined, resolve });
    expect(he).toEqual({ ok: true, mode: 'legacy', link: `${ORIGIN}/public-quote/${QA}` });
    expect(en).toEqual({ ok: true, mode: 'legacy', link: `${ORIGIN}/en/public-quote/${QA}?lang=en` });
    expect(resolve).not.toHaveBeenCalled();
  });
  it('the legacy link builder is the exact former expression', () => {
    expect(legacyQuoteLink(ORIGIN, QA, true)).toBe(`${ORIGIN}/public-quote/${QA}`);
    expect(legacyQuoteLink(ORIGIN, QA, false)).toBe(`${ORIGIN}/en/public-quote/${QA}?lang=en`);
  });
});

describe('enforced: capability link verified against quote AND caller', () => {
  it('same quote + same owner -> token link (HE / EN), built from the fixed origin', async () => {
    const t = mintToken(); const hash = await tokenHash(t);
    const resolve = vi.fn(async (h: string) => (h === hash ? res(OWNER, QA) : { ok: false, code: 'not_found' }));
    expect(await decideEmailLink({ phase: 'enforced', origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: true, capabilityToken: t, resolve }))
      .toEqual({ ok: true, mode: 'capability', link: `${ORIGIN}/public-quote/c/${t}` });
    expect(await decideEmailLink({ phase: 'enforced', origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: false, capabilityToken: t, resolve }))
      .toEqual({ ok: true, mode: 'capability', link: `${ORIGIN}/en/public-quote/c/${t}` });
    expect(resolve).toHaveBeenCalledWith(hash);
  });
  it.each([
    ['missing token', undefined, res(OWNER, QA)], ['malformed token', 'abc', res(OWNER, QA)],
    ['token of another quote (swap)', 'T', res(OWNER, QB)], ['token of another owner', 'T', res(OTHER, QA)],
    ['revoked / unknown', 'T', { ok: false, code: 'not_found' }],
  ])('%s -> 403 capability_mismatch, no link', async (_n, tok, answer) => {
    const t = tok === 'T' ? mintToken() : tok;
    const resolve = vi.fn(async () => answer);
    expect(await decideEmailLink({ phase: 'enforced', origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: true, capabilityToken: t, resolve }))
      .toEqual({ ok: false, status: 403, body: { error: 'capability_mismatch' } });
    if (tok !== 'T') expect(resolve).not.toHaveBeenCalled();
  });
  it('phase read error or resolver outage -> 503, no email', async () => {
    expect(await decideEmailLink({ phase: 'error', origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: true, capabilityToken: mintToken(), resolve: vi.fn() }))
      .toMatchObject({ ok: false, status: 503 });
    expect(await decideEmailLink({ phase: 'enforced', origin: ORIGIN, quoteId: QA, callerUserId: OWNER, hebrew: true, capabilityToken: mintToken(), resolve: async () => { throw new Error('x'); } }))
      .toMatchObject({ ok: false, status: 503 });
  });
});

describe('index.ts wiring', () => {
  const src = readFileSync(join(cwd(), 'supabase/functions/send-quote-email/index.ts'), 'utf8');
  it('the link decision runs after the JWT owner check and before any send; the token is never logged', () => {
    expect(src.indexOf('quoteRow.user_id !== callerUser.id')).toBeLessThan(src.indexOf('decideEmailLink('));
    expect(src.indexOf('const canonicalQuoteLink = linkDecision.link;')).toBeGreaterThan(src.indexOf('if (!linkDecision.ok)'));
    expect(src).toContain('JSON.stringify(loggableBody(body))');
    expect(src).toMatch(/const PROD_ORIGIN = 'https:\/\/www\.tekango\.com';/);
  });
  it('loggableBody redacts only the token; a body without it logs identically', () => {
    const b = { quoteId: QA, isHebrew: true };
    expect(JSON.stringify(loggableBody(b))).toBe(JSON.stringify(b));
    expect(loggableBody({ ...b, capabilityToken: 'secret' })).toEqual({ ...b, capabilityToken: '[redacted]' });
  });
});
