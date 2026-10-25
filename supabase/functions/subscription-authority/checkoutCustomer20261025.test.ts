// @vitest-environment node
// Owner 2026-10-25 (the first real charge came back as "General Customer" with no email - no invoice, no approval email): the payment
// page carries the paying account's own business name / email from its settings row. Mocks only - no key, no network, no DB.
import { describe, it, expect, vi } from 'vitest';
import { checkoutIntentHandler, cleanCheckoutCustomer, type BillingSql } from './billing';
import { buildGenerateLinkBody, createPayPlusProvider, PAYPLUS_API_BASES, type PayPlusConfig } from './payplus';

const U = '11111111-1111-4111-8111-111111111111';
const ATT = '22222222-2222-4222-8222-222222222222';
const PAGE = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-10-25T15:00:00Z');
const LINK = 'https://payments.payplus.co.il/c2b8a6f0-0000-4000-8000-000000000001';
const cfgUrls = { paymentPageUid: PAGE, callbackUrl: 'https://project.supabase.co/functions/v1/subscription-authority/provider-event',
  successUrl: 'https://www.tekango.com/dashboard?billing=processing', failureUrl: 'https://www.tekango.com/dashboard?billing=failed' };

describe('cleanCheckoutCustomer', () => {
  it('keeps a trimmed name (control characters removed, at most 100) and a valid lower-case email', () => {
    expect(cleanCheckoutCustomer({ name: '  שלומי\n ספרות  ', email: ' Biz@Example.COM ' })).toEqual({ name: 'שלומי ספרות', email: 'biz@example.com' });
    expect(cleanCheckoutCustomer({ name: 'א'.repeat(150), email: null })?.name).toHaveLength(100);
  });
  it('drops an invalid email, and returns null when nothing usable is left', () => {
    expect(cleanCheckoutCustomer({ name: 'עסק', email: 'not an email' })).toEqual({ name: 'עסק', email: null });
    expect(cleanCheckoutCustomer({ name: '   ', email: 'x@' })).toBeNull();
    expect(cleanCheckoutCustomer(null)).toBeNull();
  });
});

describe('the payment page body', () => {
  it('carries customer_name and email when known; nothing when not', () => {
    const b = buildGenerateLinkBody(cfgUrls, { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW, customer: { name: 'עסק לדוגמה', email: 'biz@example.com' } });
    expect(b.customer).toEqual({ customer_name: 'עסק לדוגמה', email: 'biz@example.com' });
    expect(buildGenerateLinkBody(cfgUrls, { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW })).not.toHaveProperty('customer');
    expect(buildGenerateLinkBody(cfgUrls, { attemptId: ATT, amountMinor: 3000, billingPeriod: 'month', nowMs: NOW, customer: { name: null, email: 'biz@example.com' } }).customer)
      .toEqual({ email: 'biz@example.com' });
  });
  it('the provider sends the cleaned customer to generateLink', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'success', code: 0 }, data: { page_request_uid: 'x', payment_page_link: LINK } }) }));
    const cfg: PayPlusConfig = { apiBase: PAYPLUS_API_BASES.staging, apiKey: 'synthetic-api-key', secretKey: 'synthetic-secret-not-a-real-key-0123', ...cfgUrls, fetch, now: () => NOW };
    await createPayPlusProvider(cfg).createCheckout({ attemptId: ATT, currency: 'ILS', amountMinor: 3000, billingPeriod: 'month', customer: { name: ' עסק ', email: 'BAD' } });
    const sent = JSON.parse((fetch.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.customer).toEqual({ customer_name: 'עסק' });
  });
});

describe('checkout intent: the customer comes from the account settings (never the body); a failed read never blocks the payment', () => {
  const sql = (checkoutCustomer: BillingSql['checkoutCustomer']) => ({
    createCheckoutIntent: vi.fn(),
    createPackageCheckoutIntent: vi.fn(async () => ({ ok: true, attemptId: ATT, market: 'IL', currency: 'ILS', amountMinor: 3000, state: 'pending' })),
    priceCatalog: vi.fn(async () => ({ ok: true, market: 'IL', prices: [
      { priceId: 'il_all_inclusive_month_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'month', amountMinor: 3000, taxMode: 'included', offer: 'current' },
      { priceId: 'il_all_inclusive_year_p1', planId: 'all_inclusive', currency: 'ILS', billingPeriod: 'year', amountMinor: 30600, taxMode: 'included', offer: 'current' }] })),
    recordVerifiedEvent: vi.fn(), applyVerifiedLineEvent: vi.fn(), recordCheckoutPage: vi.fn(async (_a: string, _u: string, url: string) => url),
    checkoutCustomer,
  }) as never as BillingSql;
  const provider = () => ({ name: 'mock', createCheckout: vi.fn(async () => ({ redirectUrl: LINK })), verifyWebhook: vi.fn() });
  const body = { planId: 'all_inclusive', billingPeriod: 'month', idempotencyKey: 'k'.repeat(20), customer: { name: 'from the body', email: 'evil@example.com' } };
  it('passes the settings-row customer to the provider; a customer in the request body is ignored', async () => {
    const p = provider();
    const r = await checkoutIntentHandler('enforced', { sql: sql(vi.fn(async () => ({ name: 'עסק', email: 'biz@example.com' }))), provider: p as never }, U, body);
    expect(r.status).toBe(200);
    expect((p.createCheckout.mock.calls[0] as unknown[])[0]).toMatchObject({ customer: { name: 'עסק', email: 'biz@example.com' } });
  });
  it('a failed customer read still opens the page, without a customer', async () => {
    const p = provider();
    const r = await checkoutIntentHandler('enforced', { sql: sql(vi.fn(async () => { throw new Error('down'); })), provider: p as never }, U, body);
    expect(r.status).toBe(200);
    expect((p.createCheckout.mock.calls[0] as unknown[])[0]).not.toHaveProperty('customer');
  });
});
