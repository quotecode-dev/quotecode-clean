// customer-twin handler (Owner night task 2026-10-22; Codex review fixes 2026-10-23): allowance first and fail closed, a stored answer is
// free, every failure says honestly whether the check was given back, the market is the account's (product rule), usage is kept.
import { describe, it, expect, vi } from 'vitest';
import { customerTwinHandler, TWIN_MODEL, TWIN_FALLBACK_MODEL, type CustomerTwinDeps } from './lib.ts';

const quote = {
  version: 1, market: 'INTERNATIONAL', currency: 'ILS', subject: 'Kitchen',
  items: [{ ref: 1, description: 'Install kitchen cabinets, upper and lower', quantity: 6, unit: 'linear_meter', unitPrice: 2200 }],
  terms: '30% deposit, call (03) 1234567', warranty: '12 months', validUntil: '2026-11-30', validity: 'ok', taxRate: 0.18, clientName: 'Levi', clientPhone: '050-1234567',
};
const answer = JSON.stringify({
  personas: [{ kind: 'price', state: 'hesitant', says: 'גבוה' }, { kind: 'quality', state: 'convinced', says: 'טוב' }, { kind: 'skeptic', state: 'may_stop', says: 'לא ברור' }],
  persuasive: ['ok'], blockers: [], strengthen: [], edits: [],
});
function deps(over: Partial<CustomerTwinDeps> = {}) {
  let t = 1000;
  const d = {
    country: vi.fn(async () => 'Israel' as string | null),
    claim: vi.fn(async () => ({ ok: true, cached: false, claimId: 'c1', source: 'monthly', status: { monthlyRemaining: 19 } }) as Record<string, unknown>),
    store: vi.fn(async () => ({ ok: true, status: { monthlyRemaining: 19 } }) as Record<string, unknown>),
    refund: vi.fn(async () => ({ ok: true, status: { monthlyRemaining: 20 } }) as Record<string, unknown>),
    complete: vi.fn(async () => ({ content: answer, promptTokens: 900, completionTokens: 300 })),
    sha256: vi.fn(async () => 'a'.repeat(64)),
    today: () => '2026-10-23',
    now: () => (t += 250),
    ...over,
  };
  return d as typeof d & CustomerTwinDeps;
}

describe('customer-twin handler', () => {
  it('a check: the account market (Israel = IL), only quote content reaches the model, the answer and its usage are stored', async () => {
    const d = deps();
    const r = await customerTwinHandler(d, { quote });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, cached: false, saved: true, language: 'he', status: { monthlyRemaining: 19 } });
    const sent = ((d.complete.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0].messages).map((m) => m.content).join('\n');
    expect(sent).not.toMatch(/Levi|050-1234567|1234567/);
    expect(sent).toMatch(/"market":"IL"/);
    expect(d.store).toHaveBeenCalledWith('c1', expect.objectContaining({ schema: 'customer-twin/1' }), { model: TWIN_MODEL, promptTokens: 900, completionTokens: 300, providerMs: 250 });
    expect(d.refund).not.toHaveBeenCalled();
  });
  it('CT-06: any known country is a market; only an empty one is refused', async () => {
    expect((await customerTwinHandler(deps({ country: vi.fn(async () => 'US') }), { quote })).body).toMatchObject({ ok: true, language: 'en' });
    expect((await customerTwinHandler(deps({ country: vi.fn(async () => 'LCL') }), { quote })).body).toMatchObject({ ok: true, language: 'he' });
    const d = deps({ country: vi.fn(async () => null) });
    expect((await customerTwinHandler(d, { quote })).body).toMatchObject({ code: 'market_unresolved' });
    expect(d.claim).not.toHaveBeenCalled();
  });
  it('a stored answer of the same content: free, no model call, with the date it was made', async () => {
    const stored = JSON.parse(answer);
    const d = deps({ claim: vi.fn(async () => ({ ok: true, cached: true, createdAt: '2026-10-20T08:00:00Z', result: { schema: 'customer-twin/1', ...stored }, status: { monthlyRemaining: 5 } })) });
    const r = await customerTwinHandler(d, { quote });
    expect(r.body).toMatchObject({ ok: true, cached: true, analyzedAt: '2026-10-20T08:00:00Z', status: { monthlyRemaining: 5 } });
    expect(d.complete).not.toHaveBeenCalled();
  });
  it('no allowance: refused with the checklist and the counters, no model call', async () => {
    for (const [code, status] of [['quota_exhausted', 429], ['smart_pack_required', 403], ['in_progress', 409], ['too_many_failures', 429]] as const) {
      const d = deps({ claim: vi.fn(async () => ({ ok: false, code, status: { monthlyRemaining: 0, purchasedRemaining: 0 } })) });
      const r = await customerTwinHandler(d, { quote });
      expect(r.status).toBe(status);
      expect(r.body).toMatchObject({ ok: false, code, status: { monthlyRemaining: 0 } });
      expect(d.complete).not.toHaveBeenCalled();
    }
  });
  it('fails closed: the allowance cannot be read = no model call', async () => {
    const d = deps({ claim: vi.fn(async () => { throw new Error('db'); }) });
    expect((await customerTwinHandler(d, { quote })).body).toMatchObject({ ok: false, code: 'retry_later' });
    expect(d.complete).not.toHaveBeenCalled();
  });
  it('CT-05: a failed / invalid AI answer gives the check back and says so only when SQL confirmed it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d1 = deps({ complete: vi.fn(async () => { throw new Error('provider_failure'); }) });
    expect((await customerTwinHandler(d1, { quote })).body).toMatchObject({ ok: false, code: 'provider_failure', refunded: true, status: { monthlyRemaining: 20 } });
    expect(d1.refund).toHaveBeenCalledWith('c1', expect.objectContaining({ model: TWIN_MODEL, promptTokens: null }));
    const d2 = deps({ complete: vi.fn(async () => ({ content: '{"personas":[]}', promptTokens: 1, completionTokens: 1 })) });
    expect((await customerTwinHandler(d2, { quote })).body).toMatchObject({ ok: false, code: 'provider_failure', refunded: true });
    expect(d2.store).not.toHaveBeenCalled();
    for (const refund of [vi.fn(async () => { throw new Error('db'); }), vi.fn(async () => ({ ok: false, code: 'already_finished' }))]) {
      const d3 = deps({ complete: vi.fn(async () => { throw new Error('x'); }), refund: refund as never });
      expect((await customerTwinHandler(d3, { quote })).body).toMatchObject({ ok: false, code: 'provider_failure', refunded: false });
    }
    log.mockRestore();
  });
  it('CT-05: an answer that could not be stored is shown, never reported as a normal success, and its check is given back', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const store of [vi.fn(async () => { throw new Error('db'); }), vi.fn(async () => ({ ok: false, code: 'already_finished' }))]) {
      const d = deps({ store: store as never });
      const r = await customerTwinHandler(d, { quote });
      expect(r.body).toMatchObject({ ok: true, saved: false, refunded: true, status: { monthlyRemaining: 20 } });
      expect(d.refund).toHaveBeenCalledWith('c1', expect.anything());
    }
    log.mockRestore();
  });
  it('the cheap model first; an unavailable model falls back once', async () => {
    const d = deps({ complete: vi.fn(async ({ model }: { model: string }) => { if (model === TWIN_MODEL) throw new Error('model_unavailable'); return { content: answer, promptTokens: 1, completionTokens: 2 }; }) });
    expect((await customerTwinHandler(d, { quote })).status).toBe(200);
    expect(d.store).toHaveBeenCalledWith('c1', expect.anything(), expect.objectContaining({ model: TWIN_FALLBACK_MODEL }));
  });
  it('CT-10: a too-long quote and an empty quote are refused before anything is used', async () => {
    const d = deps();
    expect((await customerTwinHandler(d, { quote: { ...quote, items: Array.from({ length: 41 }, (_, i) => ({ description: `item ${i}` })) } })).body).toMatchObject({ code: 'quote_too_long' });
    expect((await customerTwinHandler(d, { quote: { ...quote, items: [] } })).body).toMatchObject({ code: 'nothing_to_check' });
    expect(d.claim).not.toHaveBeenCalled();
  });
});
