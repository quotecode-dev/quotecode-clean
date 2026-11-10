// @vitest-environment node
// Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, L-06, L-07, L-11, L-12, L-14, L-17, L-22"):
// abroad the package and SMART PACK are bought in USD - the one-time SMART PACK page in USD (English, VAT-exempt, the English line name, the
// receipt and the emails), the quote / intent answer the account's own currency, and a market whose currency is not its own is refused.
// Mocks only - no key, no network, no DB.
import { describe, it, expect, vi } from 'vitest';
import { smartPackAddOnIntentHandler, smartPackAddOnQuoteHandler, MARKET_CURRENCY, OPEN_MARKETS, type BillingSql } from './billing';
import { buildAddOnLinkBody, PAYPLUS_SMART_PACK_ITEM_NAMES_EN } from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const ADD = '44444444-4444-4444-8444-444444444444';
const PAGE = '33333333-3333-4333-8333-333333333333';
const PRQ = '1a2aee2e-0000-4000-8000-000000000005';
const LINK = 'https://payments.payplus.co.il/c2b8a6f0-0000-4000-8000-000000000001';
const urls = { paymentPageUid: PAGE, callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
  successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed' };

describe('both markets are open, each in its own currency', () => {
  it('IL = ILS, INTERNATIONAL = USD', () => {
    expect([...OPEN_MARKETS]).toEqual(['IL', 'INTERNATIONAL']);
    expect(MARKET_CURRENCY).toEqual({ IL: 'ILS', INTERNATIONAL: 'USD' });
  });
});

describe('the one-time SMART PACK page abroad', () => {
  it('USD, English, VAT-exempt, the English line name, no Israeli ID / instalments field, the receipt and the emails', () => {
    const b = buildAddOnLinkBody(urls, { addOnId: ADD, amountMinor: 419, billingPeriod: 'month', currency: 'USD', customer: { name: 'Biz', email: 'biz@example.com' } });
    expect(b).toMatchObject({ charge_method: 1, amount: 4.19, currency_code: 'USD', language_code: 'en', paying_vat: false, hide_identification_id: true,
      hide_payments_field: true, more_info: `sp_${ADD}`, sendEmailApproval: true, sendEmailFailure: true, initial_invoice: true,
      items: [{ name: PAYPLUS_SMART_PACK_ITEM_NAMES_EN.month, quantity: 1, price: 4.19, vat_type: 2 }] });
  });
  it('the Israeli page is unchanged (ILS, Hebrew line, VAT included)', () => {
    const b = buildAddOnLinkBody(urls, { addOnId: ADD, amountMinor: 700, billingPeriod: 'year' });
    expect(b.currency_code).toBe('ILS');
    expect(b).not.toHaveProperty('language_code');
    expect((b.items as Array<{ vat_type: number }>)[0].vat_type).toBe(0);
  });
});

describe('quote and intent abroad (server amount and currency only)', () => {
  const quote = { ok: true, market: 'INTERNATIONAL', currency: 'USD', amountMinor: 419, recurringMinor: 500, period: 'month', periodEnd: '2026-11-27T10:00:00.000Z', daysLeft: 26 };
  it('the quote answers USD; a market whose currency is not its own is refused', async () => {
    expect((await smartPackAddOnQuoteHandler('enforced', { sql: { smartPackAddOnQuote: async () => quote } as never }, U)).body)
      .toEqual({ ok: true, currency: 'USD', amountMinor: 419, recurringMinor: 500, period: 'month', periodEnd: quote.periodEnd, daysLeft: 26 });
    expect((await smartPackAddOnQuoteHandler('enforced', { sql: { smartPackAddOnQuote: async () => ({ ...quote, currency: 'ILS' }) } as never }, U)).status).toBe(503);
  });
  it('the intent opens the USD page of the server row', async () => {
    const createAddOnCheckout = vi.fn(async () => ({ redirectUrl: LINK, pageRequestUid: PRQ }));
    const sql = { createSmartPackAddOnIntent: vi.fn(async () => ({ ok: true, addOnId: ADD, market: 'INTERNATIONAL', currency: 'USD', amountMinor: 419, period: 'month', state: 'pending' })),
      smartPackAddOnPage: vi.fn(async () => null), recordSmartPackAddOnPage: vi.fn(async (_a: string, _u: string, url: string) => url),
      checkoutCustomer: async () => ({ name: 'Biz', email: 'biz@example.com' }) } as never as BillingSql;
    const r = await smartPackAddOnIntentHandler('enforced', { sql, provider: { name: 'payplus', createAddOnCheckout } as never }, U, { idempotencyKey: 'k'.repeat(24) });
    expect(r).toEqual({ status: 200, body: { ok: true, addOnId: ADD, currency: 'USD', amountMinor: 419, redirectUrl: LINK, state: 'pending' } });
    expect(createAddOnCheckout).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD', amountMinor: 419 }));
  });
});
