// customer-twin handler (Owner night task 2026-10-22): allowance first and fail closed, a stored answer is free, a failed AI call gives
// the check back, the market is the account's.
import { describe, it, expect, vi } from 'vitest';
import { customerTwinHandler, TWIN_MODEL, TWIN_FALLBACK_MODEL, type CustomerTwinDeps } from './lib.ts';

const quote = {
  version: 1, market: 'INTERNATIONAL', currency: 'ILS', subject: 'Kitchen',
  items: [{ description: 'Install kitchen cabinets, upper and lower', quantity: 6, unit: 'linear_meter', unitPrice: 2200 }],
  terms: '30% deposit', warranty: '12 months', validUntil: '2026-11-30', taxRate: 18, clientName: 'Levi', clientPhone: '050-1234567',
};
const answer = JSON.stringify({
  personas: [{ kind: 'price', state: 'hesitant', says: 'גבוה' }, { kind: 'quality', state: 'convinced', says: 'טוב' }, { kind: 'skeptic', state: 'may_stop', says: 'לא ברור' }],
  persuasive: ['ok'], blockers: [], strengthen: [], edits: [],
});
function deps(over: Partial<CustomerTwinDeps> = {}) {
  const d = {
    market: vi.fn(async () => 'IL' as const),
    claim: vi.fn(async () => ({ ok: true, cached: false, claimId: 'c1', source: 'monthly', status: { monthlyRemaining: 19 } }) as Record<string, unknown>),
    store: vi.fn(async () => ({ ok: true, status: { monthlyRemaining: 19 } })),
    refund: vi.fn(async () => ({ ok: true, status: { monthlyRemaining: 20 } })),
    complete: vi.fn(async () => answer),
    sha256: vi.fn(async () => 'a'.repeat(64)),
    today: () => '2026-10-23',
    ...over,
  };
  return d as typeof d & CustomerTwinDeps;
}

describe('customer-twin handler', () => {
  it('a check: the account market wins, only quote content reaches the model, the answer is stored', async () => {
    const d = deps();
    const r = await customerTwinHandler(d, { quote });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, cached: false, language: 'he', status: { monthlyRemaining: 19 } });
    expect((r.body.analysis as { personas: unknown[] }).personas).toHaveLength(3);
    const sent = ((d.complete.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0].messages).map((m) => m.content).join('\n');
    expect(sent).not.toMatch(/Levi|050-1234567/);
    expect(sent).toMatch(/"market":"IL"/);
    expect(d.store).toHaveBeenCalledWith('c1', expect.objectContaining({ schema: 'customer-twin/1' }), TWIN_MODEL);
    expect(d.refund).not.toHaveBeenCalled();
  });
  it('a stored answer of the same content: free, no model call', async () => {
    const stored = JSON.parse(answer);
    const d = deps({ claim: vi.fn(async () => ({ ok: true, cached: true, result: { schema: 'customer-twin/1', ...stored }, status: { monthlyRemaining: 5 } })) });
    const r = await customerTwinHandler(d, { quote });
    expect(r.body).toMatchObject({ ok: true, cached: true, status: { monthlyRemaining: 5 } });
    expect(d.complete).not.toHaveBeenCalled();
  });
  it('no allowance: refused with the checklist and the counters, no model call', async () => {
    for (const [code, status] of [['quota_exhausted', 429], ['smart_pack_required', 403], ['in_progress', 409]] as const) {
      const d = deps({ claim: vi.fn(async () => ({ ok: false, code, status: { monthlyRemaining: 0, purchasedRemaining: 0 } })) });
      const r = await customerTwinHandler(d, { quote });
      expect(r.status).toBe(status);
      expect(r.body).toMatchObject({ ok: false, code, status: { monthlyRemaining: 0 } });
      expect(Array.isArray(r.body.checklist)).toBe(true);
      expect(d.complete).not.toHaveBeenCalled();
    }
  });
  it('fails closed: the allowance cannot be read = no model call', async () => {
    const d = deps({ claim: vi.fn(async () => { throw new Error('db'); }) });
    expect((await customerTwinHandler(d, { quote })).body).toMatchObject({ ok: false, code: 'retry_later' });
    expect(d.complete).not.toHaveBeenCalled();
  });
  it('a failed or invalid AI answer gives the check back', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d1 = deps({ complete: vi.fn(async () => { throw new Error('provider_failure'); }) });
    expect((await customerTwinHandler(d1, { quote })).body).toMatchObject({ ok: false, code: 'provider_failure', status: { monthlyRemaining: 20 } });
    expect(d1.refund).toHaveBeenCalledWith('c1');
    const d2 = deps({ complete: vi.fn(async () => '{"personas":[]}') });
    expect((await customerTwinHandler(d2, { quote })).body).toMatchObject({ ok: false, code: 'malformed_provider_response' });
    expect(d2.refund).toHaveBeenCalledWith('c1');
    expect(d2.store).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('the cheap model first; an unavailable model falls back once', async () => {
    const d = deps({ complete: vi.fn(async ({ model }: { model: string }) => { if (model === TWIN_MODEL) throw new Error('model_unavailable'); return answer; }) });
    const r = await customerTwinHandler(d, { quote });
    expect(r.status).toBe(200);
    expect(d.store).toHaveBeenCalledWith('c1', expect.anything(), TWIN_FALLBACK_MODEL);
  });
  it('an unknown market or an empty quote is refused before anything is used', async () => {
    const d = deps({ market: vi.fn(async () => null) });
    expect((await customerTwinHandler(d, { quote })).body).toMatchObject({ code: 'market_unresolved' });
    const e = deps();
    expect((await customerTwinHandler(e, { quote: { ...quote, items: [] } })).body).toMatchObject({ code: 'nothing_to_check' });
    expect(e.claim).not.toHaveBeenCalled();
  });
});
