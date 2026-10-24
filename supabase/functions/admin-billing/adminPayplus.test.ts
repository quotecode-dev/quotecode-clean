// Owner 2026-10-24 (Codex spec PAY-01 / PAY-02): stopping a standing order and refunding go through the fixed-IP relay; without a usable
// relay there is no PayPlus connection at all (the handler answers provider_unavailable before anything is begun or sent).
import { describe, it, expect, vi } from 'vitest';
import { adminPayplus } from './adminPayplus.ts';
import { payplusEgress, requiredPayplusEgress } from '../_shared/payplusEgress.ts';
import { adminBillingHandler, type AdminBillingDeps } from './lib.ts';

const TERMINAL = '11111111-2222-4333-8444-555555555555';
const SECRETS: Record<string, string> = {
  PAYPLUS_API_KEY: 'k', PAYPLUS_SECRET_KEY: 's', PAYPLUS_ENVIRONMENT: 'staging', PAYPLUS_TERMINAL_UID: TERMINAL,
  PAYPLUS_PROXY_URL: 'http://u:p@relay.example.com:80',
};
const getter = (over: Record<string, string | undefined> = {}) => (n: string) => ({ ...SECRETS, ...over } as Record<string, string | undefined>)[n];

describe('admin-billing: the PayPlus connection needs the relay', () => {
  it('no relay secret, or a bad one: no PayPlus connection (nothing can be sent)', () => {
    expect(adminPayplus(getter({ PAYPLUS_PROXY_URL: undefined })).payplus).toBe(null);
    expect(adminPayplus(getter({ PAYPLUS_PROXY_URL: '' })).payplus).toBe(null);
    expect(adminPayplus(getter({ PAYPLUS_PROXY_URL: 'relay.example.com' })).payplus).toBe(null);
  });

  it('missing keys: no connection (as before)', () => {
    expect(adminPayplus(getter({ PAYPLUS_API_KEY: '' })).payplus).toBe(null);
    expect(adminPayplus(getter({ PAYPLUS_TERMINAL_UID: 'not-a-uuid' })).payplus).toBe(null);
    expect(adminPayplus(getter({ PAYPLUS_ENVIRONMENT: 'test' })).payplus).toBe(null);
  });

  it('with the relay: stop and refund are sent through the relay client to PayPlus, and close() closes it', async () => {
    const client = { close: vi.fn() };
    const base = vi.fn(async () => new Response(JSON.stringify({ results: { status: 'success' } })));
    const r = adminPayplus(getter(), (s) => requiredPayplusEgress(s, () => client, base));
    expect(r.payplus?.terminalUid).toBe(TERMINAL);
    expect(await r.payplus!.cancel('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', TERMINAL)).toBe('cancelled');
    const [url, init] = base.mock.calls[0] as unknown as [string, { client?: unknown }];
    expect(url).toBe('https://restapidev.payplus.co.il/api/v1.0/RecurringPayments/DeleteRecurring/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    expect(init.client).toBe(client);
    r.close();
    expect(client.close).toHaveBeenCalled();
  });

  it('a direct (not relayed) egress is never accepted', () => {
    expect(adminPayplus(getter(), () => payplusEgress(undefined)).payplus).toBe(null);
  });

  it('the handler: without the relay a stop answers provider_unavailable and begins nothing', async () => {
    const begin = vi.fn();
    const deps = {
      isSuperAdmin: async () => true, claimProof: async () => true, preview: vi.fn(), begin, openAction: vi.fn(), finish: vi.fn(),
      refundSending: vi.fn(), recordRefund: vi.fn(), unsettledRefund: vi.fn(async () => null), settleRefund: vi.fn(), audit: vi.fn(async () => {}),
      payplus: adminPayplus(getter({ PAYPLUS_PROXY_URL: undefined })).payplus,
    } as unknown as AdminBillingDeps;
    const r = await adminBillingHandler(deps, 'a0000000-0000-4000-8000-000000000001',
      { action: 'stop_renewal', targetUserId: 'b0000000-0000-4000-8000-000000000002', expectedRefundMinor: 0, reason: 'test', proofToken: 'x', waiveFee: false });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('provider_unavailable');
    expect(begin).not.toHaveBeenCalled();
  });
});
