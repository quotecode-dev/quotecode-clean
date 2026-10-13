import { describe, it, expect } from 'vitest';
import {
  EURO_AREA, displayCurrencyForCountry, geoCountryFromCookie, rateFromPayload, resolveVisitorCountry, loadLocalEstimate, loadUsdRate,
  RATE_SOURCE_URL, RATE_VALIDITY_MS,
} from './localPriceEstimate';
import { usdPackageAmount, estimateAnnualSaving } from '../../components/landing/landingPackageFacts';

const NOW = Date.parse('2026-10-13T12:00:00Z');
const payload = (over = {}) => ({ provider: 'https://www.exchangerate-api.com', base: 'USD', date: '2026-10-13', time_last_updated: Math.floor((NOW - 2 * 3600 * 1000) / 1000), rates: { USD: 1, GBP: 0.757, EUR: 0.895, ILS: 3.7 }, ...over });
const fakeFetch = (routes) => async (url) => {
  const r = routes[url];
  if (r === undefined) throw new Error(`unexpected ${url}`);
  if (r instanceof Error) throw r;
  return { ok: r.ok !== false, json: async () => r.body };
};

describe('display currency from the real geo country (OD-08: an estimate only)', () => {
  it('GB -> GBP, the euro area -> EUR, the US and every other country (and no country) -> USD', () => {
    expect(displayCurrencyForCountry('GB')).toBe('GBP');
    for (const c of ['DE', 'FR', 'IE', 'NL', 'ES', 'IT', 'AT', 'HR', 'BG']) expect(displayCurrencyForCountry(c)).toBe('EUR');
    for (const c of ['US', 'IL', 'CA', 'AU', null, '', 'xx1']) expect(displayCurrencyForCountry(c)).toBe('USD');
  });
  it('not all of Europe uses the euro: non-euro European countries stay USD', () => {
    for (const c of ['CH', 'NO', 'SE', 'DK', 'PL', 'CZ', 'HU', 'RO', 'IS']) expect(displayCurrencyForCountry(c)).toBe('USD');
    expect(EURO_AREA).toHaveLength(21);
  });
  it('the geo cookie is read only from its own well-formed value', () => {
    expect(geoCountryFromCookie('a=1; proflow_geo_country=gb; b=2')).toBe('GB');
    expect(geoCountryFromCookie('proflow_geo_country=GBR')).toBeNull();
    expect(geoCountryFromCookie('other_proflow_geo_country=DE')).toBeNull();
    expect(geoCountryFromCookie('')).toBeNull();
  });
  it('/api/geo (Vercel geo, per request) wins over the cookie; the cookie is only the fallback', async () => {
    expect(await resolveVisitorCountry({ fetchImpl: fakeFetch({ '/api/geo': { body: { country: 'DE' } } }), cookieString: 'proflow_geo_country=GB' })).toEqual({ country: 'DE', source: 'geo' });
    expect(await resolveVisitorCountry({ fetchImpl: fakeFetch({ '/api/geo': new Error('offline') }), cookieString: 'proflow_geo_country=GB' })).toEqual({ country: 'GB', source: 'cookie' });
    expect(await resolveVisitorCountry({ fetchImpl: fakeFetch({ '/api/geo': { body: { country: null } } }), cookieString: '' })).toEqual({ country: null, source: 'none' });
  });
});

describe('the rate record (source, as-of, validity, structure)', () => {
  it('a valid USD-based payload gives the record internationalDisplay() accepts', () => {
    expect(rateFromPayload(payload(), 'GBP')).toEqual({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date((NOW - 2 * 3600 * 1000) - ((NOW - 2 * 3600 * 1000) % 1000)).toISOString(), source: 'ExchangeRate-API' });
  });
  it('malformed / foreign-base / non-numeric / missing-time / unsupported or forbidden currency -> null', () => {
    expect(rateFromPayload(null, 'GBP')).toBeNull();
    expect(rateFromPayload(payload({ base: 'EUR' }), 'GBP')).toBeNull();
    expect(rateFromPayload(payload({ rates: { GBP: '0.75' } }), 'GBP')).toBeNull();
    expect(rateFromPayload(payload({ rates: { GBP: 0 } }), 'GBP')).toBeNull();
    expect(rateFromPayload(payload({ time_last_updated: undefined }), 'GBP')).toBeNull();
    expect(rateFromPayload(payload(), 'ILS')).toBeNull();
    expect(rateFromPayload(payload(), 'JPY')).toBeNull();
  });
  it('USD visitors never fetch a rate; GB visitors fetch exactly the existing public source', async () => {
    const usd = await loadLocalEstimate({ fetchImpl: fakeFetch({ '/api/geo': { body: { country: 'US' } } }) });
    expect(usd).toEqual({ currency: 'USD', rate: null, reason: null });
    const gb = await loadLocalEstimate({ fetchImpl: fakeFetch({ '/api/geo': { body: { country: 'GB' } }, [RATE_SOURCE_URL]: { body: payload() } }) });
    expect(gb.currency).toBe('GBP');
    expect(gb.rate.usdToCurrency).toBe(0.757);
    const down = await loadLocalEstimate({ fetchImpl: fakeFetch({ '/api/geo': { body: { country: 'FR' } }, [RATE_SOURCE_URL]: { ok: false, body: {} } }) });
    expect(down).toEqual({ currency: 'EUR', rate: null, reason: 'rate_unavailable' });
    expect(await loadUsdRate('EUR', { fetchImpl: fakeFetch({ [RATE_SOURCE_URL]: { body: payload() } }) })).toMatchObject({ currency: 'EUR', usdToCurrency: 0.895 });
    expect(await loadUsdRate('ILS', { fetchImpl: fakeFetch({}) })).toBeNull();
  });
});

describe('the package price as a labelled estimate (billing stays USD)', () => {
  const rate = (over = {}) => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(NOW - 2 * 3600 * 1000).toISOString(), source: 'ExchangeRate-API', ...over });
  it('a fresh rate converts the amount (never only the symbol) and keeps the billed USD amount', () => {
    const m = usdPackageAmount('month', rate(), { now: NOW });
    expect(m.text).toBe('$18.00');
    expect(m.estimateText).toBe('≈£13.63');
    expect(m.display).toMatchObject({ billingCurrency: 'USD', billingAmountMinor: 1800, displayCurrency: 'GBP', displayAmountMinor: 1363, estimate: true });
    const y = usdPackageAmount('year', rate({ currency: 'EUR', usdToCurrency: 0.895 }), { now: NOW });
    expect(y.estimateText).toBe('≈€164.68');
    expect(estimateAnnualSaving(y.display)).toBe('≈€28.64');
  });
  it('stale (older than the 26 h validity) / future / sourceless rate -> USD only, no estimate', () => {
    expect(usdPackageAmount('month', rate({ asOf: new Date(NOW - RATE_VALIDITY_MS - 60000).toISOString() }), { now: NOW }).estimateText).toBeNull();
    expect(usdPackageAmount('month', rate({ asOf: new Date(NOW + 3600 * 1000).toISOString() }), { now: NOW }).estimateText).toBeNull();
    expect(usdPackageAmount('month', rate({ source: '' }), { now: NOW }).estimateText).toBeNull();
    expect(usdPackageAmount('month', rate({ currency: 'ILS' }), { now: NOW }).estimateText).toBeNull();
    expect(usdPackageAmount('month', null, { now: NOW })).toMatchObject({ text: '$18.00', estimateText: null });
    expect(estimateAnnualSaving(usdPackageAmount('year', null).display)).toBeNull();
  });
});
