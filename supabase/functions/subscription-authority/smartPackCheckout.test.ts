// Owner 2026-10-20 (decisions20261020c: "באותו דף תשלום"): SMART PACK is a second line of the SAME package payment page / standing
// order, at its own server price of the same market and cycle (20261021400000). The amount charged = the server attempt total.
import { describe, it, expect, vi } from 'vitest';
import { parseCatalog, computeCheckoutAmount, checkoutIntentHandler, type BillingSql, type BillingProvider } from './billing.ts';
import { buildGenerateLinkBody, PAYPLUS_ITEM_NAMES, PAYPLUS_SMART_PACK_ITEM_NAMES } from './payplus.ts';

const U = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const KEY = 'smart-pack-checkout-key-0001';
const row = (priceId: string, planId: string, billingPeriod: string, amountMinor: number, offer = 'current') =>
  ({ priceId, planId, currency: 'ILS', billingPeriod, amountMinor, taxMode: 'included', offer });
const IL = { ok: true, market: 'IL', prices: [
  row('il_classic_month_v1', 'classic', 'month', 2900, 'legacy'),
  row('il_all_inclusive_month_p1', 'all_inclusive', 'month', 3000), row('il_all_inclusive_year_p1', 'all_inclusive', 'year', 30600),
  row('il_smart_pack_month_p1', 'smart_pack', 'month', 1000), row('il_smart_pack_year_p1', 'smart_pack', 'year', 10200)] };
const okProvider = (): BillingProvider & { createCheckout: ReturnType<typeof vi.fn> } => ({ name: 'mock',
  createCheckout: vi.fn(async () => ({ redirectUrl: 'https://provider.example/pay/abc' })), verifyWebhook: vi.fn() } as never);
const sqlFor = (addOnPriceId: string | null, amountMinor: number) => ({
  createCheckoutIntent: vi.fn(),
  createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor, state: 'pending', addOnPriceId })),
  priceCatalog: vi.fn(async () => IL), recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(),
}) as never as BillingSql & Record<string, ReturnType<typeof vi.fn>>;

describe('SMART PACK on the package payment (server catalog)', () => {
  it('the catalog accepts the SMART PACK rows (current, month + year); the amounts are package + add-on of the same cycle', () => {
    const il = parseCatalog(IL, 'IL');
    expect(il).not.toBeNull();
    expect(computeCheckoutAmount(il, 'all_inclusive', 0, 'month', true)).toEqual({ currency: 'ILS', amountMinor: 4000, planPriceId: 'il_all_inclusive_month_p1',
      blockPriceId: null, addOnPriceId: 'il_smart_pack_month_p1', packageAmountMinor: 3000, addOnAmountMinor: 1000 });
    expect(computeCheckoutAmount(il, 'all_inclusive', 0, 'year', true)).toMatchObject({ amountMinor: 40800, addOnPriceId: 'il_smart_pack_year_p1', addOnAmountMinor: 10200 });
    expect(computeCheckoutAmount(il, 'classic', 0, 'month', true)).toBeNull(); // SMART PACK rides only on the package
    expect(computeCheckoutAmount(il, 'all_inclusive', 0, 'month', 'yes')).toBeNull();
    // a SMART PACK row marked legacy is a catalog error (fail closed)
    expect(parseCatalog({ ...IL, prices: IL.prices.map((p) => (p.planId === 'smart_pack' ? { ...p, offer: 'legacy' } : p)) }, 'IL')).toBeNull();
  });
  it('the handler: the box reaches SQL; the SQL attempt must carry the same add-on line; PayPlus gets the total and the add-on amount', async () => {
    const sql = sqlFor('il_smart_pack_month_p1', 4000);
    const provider = okProvider();
    const r = await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY, smartPack: true, amountMinor: 1 });
    expect(r).toEqual({ status: 200, body: { ok: true, attemptId: ATT, currency: 'ILS', amountMinor: 4000, redirectUrl: 'https://provider.example/pay/abc', state: 'pending', smartPack: true } });
    expect(sql.createPackageCheckoutIntent).toHaveBeenCalledWith(U, 'month', KEY, true);
    expect(provider.createCheckout).toHaveBeenCalledWith({ attemptId: ATT, currency: 'ILS', amountMinor: 4000, billingPeriod: 'month', addOnAmountMinor: 1000 });
    // the SQL attempt without the add-on line while the box was ticked (or the other way round) never reaches the provider
    const p2 = okProvider();
    expect((await checkoutIntentHandler('prepared', { sql: sqlFor(null, 4000), provider: p2 }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY, smartPack: true })).body)
      .toMatchObject({ ok: false, code: 'checkout_unavailable' });
    expect((await checkoutIntentHandler('prepared', { sql: sqlFor('il_smart_pack_month_p1', 3000), provider: p2 }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY })).body)
      .toMatchObject({ ok: false, code: 'checkout_unavailable' });
    expect(p2.createCheckout).not.toHaveBeenCalled();
    // the box is a boolean and only for the package
    expect((await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: KEY, smartPack: 'yes' })).status).toBe(400);
    expect((await checkoutIntentHandler('prepared', { sql, provider }, U, { planId: 'classic', idempotencyKey: KEY, smartPack: true })).status).toBe(400);
  });
  it('the payment page has two lines that sum to the total; without the box one line (unchanged)', () => {
    const cfg = { paymentPageUid: 'uid', callbackUrl: 'https://x/cb', successUrl: 'https://x/ok', failureUrl: 'https://x/no' };
    const two = buildGenerateLinkBody(cfg, { attemptId: ATT, amountMinor: 40800, billingPeriod: 'year', nowMs: Date.UTC(2026, 9, 20), addOnAmountMinor: 10200 });
    expect(two.amount).toBe(408);
    expect(two.items).toEqual([{ name: PAYPLUS_ITEM_NAMES.year, quantity: 1, price: 306, vat_type: 0 },
      { name: PAYPLUS_SMART_PACK_ITEM_NAMES.year, quantity: 1, price: 102, vat_type: 0 }]);
    const one = buildGenerateLinkBody(cfg, { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: Date.UTC(2026, 9, 20) });
    expect(one.items).toEqual([{ name: PAYPLUS_ITEM_NAMES.month, quantity: 1, price: 30, vat_type: 0 }]);
  });
});
