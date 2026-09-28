import { describe, it, expect } from 'vitest';
import { MARKET_LOOKUP_TIMEOUT_MS, resolveAuthEmailMarket, runMarketLookupWithTimeout } from './marketResolver.ts';

// Auth market identity gap F1 - Option C (2026-09-28). Pure resolver + bounded lookup runner. Synthetic values only.
const rows = (...countries) => ({ ok: true, rows: countries.map((country) => ({ country })) });
const md = (signup_market) => (signup_market === undefined ? {} : { signup_market });
const USER_ID = '11111111-2222-4333-8444-555555555555';

describe('resolveAuthEmailMarket - canonical row first', () => {
  const cases = [
    ['DB Local + missing metadata', rows('Local'), {}, 'Local', 'canonical_row', 'row_local'],
    ['DB LCL + missing metadata (app-wide legacy Local alias)', rows('LCL'), {}, 'Local', 'canonical_row', 'row_lcl_alias'],
    ['DB International + missing metadata', rows('International'), {}, 'International', 'canonical_row', 'row_international'],
    ['DB Local + conflicting International metadata -> DB wins', rows('Local'), md('International'), 'Local', 'canonical_row', 'row_local'],
    ['DB International + conflicting Local metadata -> DB wins', rows('International'), md('Local'), 'International', 'canonical_row', 'row_international'],
    ['DB LCL + conflicting International metadata -> DB wins', rows('LCL'), md('International'), 'Local', 'canonical_row', 'row_lcl_alias'],
  ];
  for (const [name, lookup, meta, market, source, classification] of cases) {
    it(name, () => expect(resolveAuthEmailMarket(lookup, meta)).toEqual({ market, source, classification }));
  }

  for (const country of ['Unknown', null, undefined, '', 'local', ' Local', 'Local ', 'LOCAL', 'lcl', 'IL', 'Israel', 'international', 'Intl', 42, true, {}, ['Local']]) {
    it(`DB ${JSON.stringify(country)} + Local metadata -> International fail-closed; metadata ignored`, () => {
      expect(resolveAuthEmailMarket(rows(country), md('Local'))).toEqual({ market: 'International', source: 'fail_closed', classification: 'row_unresolved' });
    });
  }
});

describe('resolveAuthEmailMarket - bootstrap only when NO row exists', () => {
  it('no row + metadata Local -> Local', () => expect(resolveAuthEmailMarket(rows(), md('Local'))).toEqual({ market: 'Local', source: 'signup_bootstrap', classification: 'bootstrap_local' }));
  it('no row + metadata International -> International', () => expect(resolveAuthEmailMarket(rows(), md('International'))).toEqual({ market: 'International', source: 'signup_bootstrap', classification: 'bootstrap_international' }));
  for (const meta of [{}, null, undefined, md(''), md('local'), md(' Local'), md('LCL'), md('Unknown'), md('IL'), md(1), { signup_market: ['Local'] }, { country: 'Local' }, 'Local']) {
    it(`no row + metadata ${JSON.stringify(meta)} -> International fail-closed`, () => {
      expect(resolveAuthEmailMarket(rows(), meta)).toEqual({ market: 'International', source: 'fail_closed', classification: 'bootstrap_missing_or_malformed' });
    });
  }
});

describe('resolveAuthEmailMarket - lookup failures fail closed (metadata never consulted)', () => {
  for (const [lookup, classification] of [
    [{ ok: false, reason: 'timeout' }, 'lookup_timeout'],
    [{ ok: false, reason: 'error' }, 'lookup_error'],
    [{ ok: false, reason: 'invalid_user_id' }, 'lookup_invalid_user_id'],
    [{ ok: false, reason: 'not_configured' }, 'lookup_not_configured'],
    [rows('Local', 'Local'), 'lookup_multiple_rows'],
    [rows('Local', 'International'), 'lookup_multiple_rows'],
    [{ ok: true, rows: null }, 'lookup_error'],
    [null, 'lookup_error'],
    [undefined, 'lookup_error'],
  ]) {
    it(`${JSON.stringify(lookup)} + Local metadata -> International (${classification})`, () => {
      expect(resolveAuthEmailMarket(lookup, md('Local'))).toEqual({ market: 'International', source: 'fail_closed', classification });
    });
  }
});

describe('runMarketLookupWithTimeout - bounded, never throws, never hangs', () => {
  it('default timeout is 1500 ms', () => expect(MARKET_LOOKUP_TIMEOUT_MS).toBe(1500));

  it('passes the exact id and an AbortSignal, returns the rows', async () => {
    const seen = [];
    const r = await runMarketLookupWithTimeout(async (id, signal) => { seen.push([id, signal instanceof AbortSignal]); return [{ country: 'Local' }]; }, USER_ID, 50);
    expect(r).toEqual({ ok: true, rows: [{ country: 'Local' }] });
    expect(seen).toEqual([[USER_ID, true]]);
  });

  it('a lookup that never settles -> timeout at the deadline and the signal is aborted', async () => {
    let signalRef;
    const started = Date.now();
    const r = await runMarketLookupWithTimeout((_, signal) => { signalRef = signal; return new Promise(() => {}); }, USER_ID, 30);
    expect(r).toEqual({ ok: false, reason: 'timeout' });
    expect(signalRef.aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('a rejection -> error; a synchronous throw -> error; a non-array result -> error', async () => {
    expect(await runMarketLookupWithTimeout(async () => { throw new Error('db down: secret sb_secret_xyz'); }, USER_ID, 50)).toEqual({ ok: false, reason: 'error' });
    expect(await runMarketLookupWithTimeout(() => { throw new Error('sync'); }, USER_ID, 50)).toEqual({ ok: false, reason: 'error' });
    expect(await runMarketLookupWithTimeout(async () => 'not rows', USER_ID, 50)).toEqual({ ok: false, reason: 'error' });
  });

  it('not configured (missing lookup or not_configured error) and a non-UUID id never reach the database', async () => {
    expect(await runMarketLookupWithTimeout(undefined, USER_ID, 50)).toEqual({ ok: false, reason: 'not_configured' });
    expect(await runMarketLookupWithTimeout(async () => { throw Object.assign(new Error('x'), { code: 'not_configured' }); }, USER_ID, 50)).toEqual({ ok: false, reason: 'not_configured' });
    let calls = 0;
    const counting = async () => { calls += 1; return []; };
    for (const id of [undefined, null, '', 'not-a-uuid', `${USER_ID}' or 1=1`, `${USER_ID},x`, 42]) {
      expect(await runMarketLookupWithTimeout(counting, id, 50)).toEqual({ ok: false, reason: 'invalid_user_id' });
    }
    expect(calls).toBe(0);
  });
});
