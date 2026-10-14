// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { outputNoticeRoute } from './noticeRoute';
import { routeAuthorityRequest, type AuthorityDeps } from './router';
import { UNAVAILABLE_PROVIDER } from './billing';

const U = '11111111-1111-4111-8111-111111111111';
const OTHER = '66666666-6666-4666-8666-666666666666';
const Q = '22222222-2222-4222-8222-222222222222';
const D = 'd'.repeat(64);
const answer = (o: Record<string, unknown> = {}) => ({ ok: true, contentDigest: D, alreadyFinalized: false, wouldConsume: true, remaining: 7, accountMode: 'free_10', internal: 'x', ...o });

describe('output_notice: read-only pre-consumption notice', () => {
  it('allowlisted answer; accountMode / internals never leave the server', async () => {
    const outputNotice = vi.fn(async () => answer());
    expect(await outputNoticeRoute({ outputNotice }, U, { quoteId: Q })).toEqual({ status: 200, body: { ok: true, quoteId: Q, contentDigest: D, alreadyFinalized: false, wouldConsume: true, remaining: 7 } });
    expect(outputNotice).toHaveBeenCalledWith(U, Q);
  });
  it('a forged body userId / remaining / wouldConsume is ignored: the RPC gets the JWT user, the answer comes from SQL', async () => {
    const outputNotice = vi.fn(async () => answer({ wouldConsume: false, alreadyFinalized: true, remaining: 3 }));
    const r = await outputNoticeRoute({ outputNotice }, U, { quoteId: Q, userId: OTHER, remaining: 10, wouldConsume: false, plan: 'visual' });
    expect(outputNotice).toHaveBeenCalledWith(U, Q);
    expect(r.body).toEqual({ ok: true, quoteId: Q, contentDigest: D, alreadyFinalized: true, wouldConsume: false, remaining: 3 });
  });
  it('paid account: remaining null passes through', async () => {
    expect((await outputNoticeRoute({ outputNotice: async () => answer({ remaining: null, wouldConsume: false, accountMode: 'paid' }) }, U, { quoteId: Q })).body.remaining).toBeNull();
  });
  it.each([
    [{ ok: false, code: 'not_activated' }, 409, 'not_activated'], [{ ok: false, code: 'account_not_provisioned' }, 409, 'account_not_provisioned'],
    [{ ok: false, code: 'quote_not_found' }, 404, 'quote_not_found'], [{ ok: false, code: 'secret_internal' }, 503, 'output_unavailable'],
    [answer({ contentDigest: 'X' }), 503, 'output_unavailable'], [answer({ remaining: -1 }), 503, 'output_unavailable'],
    [answer({ remaining: 11 }), 503, 'output_unavailable'], [answer({ wouldConsume: 'yes' }), 503, 'output_unavailable'],
    [answer({ alreadyFinalized: true, wouldConsume: true }), 503, 'output_unavailable'], [null, 503, 'output_unavailable'],
  ])('SQL %j -> %s %s', async (raw, status, code) => {
    expect(await outputNoticeRoute({ outputNotice: async () => raw }, U, { quoteId: Q })).toEqual({ status, body: { ok: false, code } });
  });
  it('bad quote id -> 400 before SQL; RPC outage -> 503; no user -> 401', async () => {
    const outputNotice = vi.fn(async () => { throw new Error('down'); });
    expect((await outputNoticeRoute({ outputNotice }, U, { quoteId: 'x' })).status).toBe(400);
    expect(outputNotice).not.toHaveBeenCalled();
    expect(await outputNoticeRoute({ outputNotice }, U, { quoteId: Q })).toEqual({ status: 503, body: { ok: false, code: 'output_unavailable' } });
    expect((await outputNoticeRoute({ outputNotice }, 'nope', { quoteId: Q })).status).toBe(401);
  });
  it('router: output_notice requires the JWT and is the only RPC called (no reservation / orchestrator)', async () => {
    const outputNotice = vi.fn(async () => answer());
    const output = vi.fn();
    const d = {
      verifyJwt: async (t: string) => (t === 'good.jwt.x' ? { sub: U } : null), notice: { outputNotice },
      output: { readFreeIssuePhase: vi.fn(), readMarketInputs: vi.fn(), orchestrator: { output }, mintCapability: vi.fn(), issueGrant: vi.fn() },
      billing: { phase: 'off', sql: {} as never, provider: UNAVAILABLE_PROVIDER, now: () => 0 },
      logo: {} as never,
    } as unknown as AuthorityDeps;
    const raw = new TextEncoder().encode(JSON.stringify({ action: 'output_notice', quoteId: Q, userId: OTHER }));
    const get = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
    expect((await routeAuthorityRequest(d, { method: 'POST', path: '/functions/v1/subscription-authority', headers: get({}), rawBody: raw })).status).toBe(401);
    const r = await routeAuthorityRequest(d, { method: 'POST', path: '/functions/v1/subscription-authority', headers: get({ authorization: 'Bearer good.jwt.x' }), rawBody: raw });
    expect(r.status).toBe(200);
    expect(outputNotice).toHaveBeenCalledWith(U, Q);
    expect(output).not.toHaveBeenCalled();
    expect(d.output.mintCapability).not.toHaveBeenCalled();
  });
});
