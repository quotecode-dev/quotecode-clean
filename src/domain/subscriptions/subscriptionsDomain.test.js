// Subscription domain (prepared / off): the approved price catalog (Owner decisions 2026-10-07, OD-03..OD-08) and the OD-08
// display-estimate adapter. Pure unit tests; nothing here touches a network, a DB or an entitlement.
import { describe, it, expect } from 'vitest';
import { PRICE_VERSIONS, approvedPrice, BILLING_CURRENCY, PAID_PLAN_IDS, FREE_QUOTES_TOTAL, CATALOG_PRODUCTS_INCLUDED, CATALOG_BLOCK_PRODUCTS } from './priceCatalog';
import { internationalDisplay, ESTIMATE_MAX_AGE_MS } from './displayEstimate';

describe('approved price catalog (OD-03..OD-08)', () => {
  it('IL monthly 29/49/69 ILS and +100 for 5 ILS, all tax_mode=included (OD-03/04/05)', () => {
    expect(PAID_PLAN_IDS.map((id) => approvedPrice('IL', id)).map((p) => [p.currency, p.amountMinor, p.taxMode, p.billingPeriod])).toEqual([
      ['ILS', 2900, 'included', 'month'], ['ILS', 4900, 'included', 'month'], ['ILS', 6900, 'included', 'month'],
    ]);
    expect(approvedPrice('IL', 'catalog_block_100')).toMatchObject({ currency: 'ILS', amountMinor: 500, taxMode: 'included' });
  });
  it('INTERNATIONAL monthly 18/28/38 USD and +100 for 3 USD - never 6 (OD-06/07)', () => {
    expect(PAID_PLAN_IDS.map((id) => approvedPrice('INTERNATIONAL', id).amountMinor)).toEqual([1800, 2800, 3800]);
    expect(approvedPrice('INTERNATIONAL', 'catalog_block_100')).toMatchObject({ currency: 'USD', amountMinor: 300 });
    expect(PRICE_VERSIONS.some((p) => p.market === 'INTERNATIONAL' && p.amountMinor === 600)).toBe(false);
  });
  it('one billing currency per market; no ILS row outside IL, no USD row in IL; monthly only (OPEN-10)', () => {
    expect(BILLING_CURRENCY).toEqual({ IL: 'ILS', INTERNATIONAL: 'USD' });
    for (const p of PRICE_VERSIONS) expect(p.currency).toBe(BILLING_CURRENCY[p.market]);
    expect(PRICE_VERSIONS.every((p) => p.billingPeriod === 'month')).toBe(true);
    expect(new Set(PRICE_VERSIONS.map((p) => p.priceId)).size).toBe(PRICE_VERSIONS.length);
    for (const p of PRICE_VERSIONS) expect(p.approvedRef).toMatch(/^OD-0\d(,OD-0\d)*$/);
  });
  it('fixed approved quantities (OD-01/04)', () => {
    expect([FREE_QUOTES_TOTAL, CATALOG_PRODUCTS_INCLUDED, CATALOG_BLOCK_PRODUCTS]).toEqual([10, 100, 100]);
  });
  it('anything not approved throws (no invented price / annual / Free price / unknown market)', () => {
    expect(() => approvedPrice('IL', 'free10')).toThrow();
    expect(() => approvedPrice('IL', 'pro')).toThrow();
    expect(() => approvedPrice('US', 'classic')).toThrow();
    expect(() => approvedPrice('INTERNATIONAL', 'classic_annual')).toThrow();
  });
  it('the catalog rows are frozen (no client-side mutation)', () => {
    expect(Object.isFrozen(PRICE_VERSIONS)).toBe(true);
    expect(() => { 'use strict'; PRICE_VERSIONS[0].amountMinor = 1; }).toThrow();
  });
});

describe('OD-08 display estimate: billing is always USD; fallback to USD', () => {
  const row = approvedPrice('INTERNATIONAL', 'modern');
  const now = Date.parse('2026-10-07T12:00:00Z');
  const fresh = { currency: 'EUR', usdToCurrency: 0.9, asOf: '2026-10-07T08:00:00Z', source: 'ECB reference rate' };
  const opts = { now, supportedCurrencies: ['EUR', 'GBP'] };

  it('no rate source -> USD display, billing unchanged (today: no verified source is wired)', () => {
    expect(internationalDisplay(row, null, opts)).toMatchObject({ billingCurrency: 'USD', billingAmountMinor: 2800, displayCurrency: 'USD', displayAmountMinor: 2800, estimate: false, fallbackReason: 'no_rate_source' });
  });
  it('a valid, fresh, supported rate with provenance -> labelled estimate; billing still USD 2800', () => {
    expect(internationalDisplay(row, fresh, opts)).toMatchObject({ billingCurrency: 'USD', billingAmountMinor: 2800, displayCurrency: 'EUR', displayAmountMinor: 2520, estimate: true, rateSource: 'ECB reference rate', rateAsOf: '2026-10-07T08:00:00.000Z' });
  });
  it.each([
    ['ILS is forbidden on International (OD-11)', { ...fresh, currency: 'ILS' }, 'forbidden_currency'],
    ['NIS is forbidden on International', { ...fresh, currency: 'nis' }, 'forbidden_currency'],
    ['unsupported currency', { ...fresh, currency: 'JPY' }, 'unsupported_currency'],
    ['stale rate', { ...fresh, asOf: new Date(now - ESTIMATE_MAX_AGE_MS - 1).toISOString() }, 'stale_rate'],
    ['future as-of', { ...fresh, asOf: '2026-10-08T12:00:00Z' }, 'invalid_as_of'],
    ['missing as-of', { ...fresh, asOf: undefined }, 'invalid_as_of'],
    ['zero rate', { ...fresh, usdToCurrency: 0 }, 'invalid_rate'],
    ['NaN rate', { ...fresh, usdToCurrency: Number.NaN }, 'invalid_rate'],
    ['string rate', { ...fresh, usdToCurrency: '0.9' }, 'invalid_rate'],
    ['no provenance', { ...fresh, source: ' ' }, 'no_provenance'],
    ['malformed currency', { ...fresh, currency: 'EURO' }, 'invalid_currency'],
  ])('%s -> USD display (%s)', (_n, rate, reason) => {
    const d = internationalDisplay(row, rate, opts);
    expect(d).toMatchObject({ billingCurrency: 'USD', billingAmountMinor: 2800, displayCurrency: 'USD', displayAmountMinor: 2800, estimate: false, fallbackReason: reason });
  });
  it('a spoofed rate can never change the billed amount or currency', () => {
    const d = internationalDisplay(row, { ...fresh, usdToCurrency: 0.0001 }, opts);
    expect([d.billingCurrency, d.billingAmountMinor]).toEqual(['USD', 2800]);
  });
  it('refuses a non-International or non-USD row (an IL price can never be "converted" for EN)', () => {
    expect(() => internationalDisplay(approvedPrice('IL', 'modern'), null, opts)).toThrow();
    expect(() => internationalDisplay({ ...row, currency: 'ILS' }, null, opts)).toThrow();
  });
});
