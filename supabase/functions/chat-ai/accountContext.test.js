import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  accountPlanFromSummary, buildVerifiedAccountContext, fetchServerAccountSummary, isHebrewFromMarket, NO_ACCOUNT_PLAN,
} from './accountContext.ts';
import { parseAccountSummary } from '../_shared/subscriptionContract.ts';

// Subscriptions cutover (OD-16/OD-20, CROSSCUT_CONTRACT §2.1): the account's plan facts come ONLY from the server account
// summary (public.get_account_summary(), account-summary/v1), fetched with the user's own JWT and parsed by the one strict
// parser. The legacy tier / trial / Lifetime port is gone: no plan, trial or monthly limit is ever derived from
// business_settings, and nothing in the request body can name a plan.

const READY_FREE = {
  ok: true, schema: 'account-summary/v1', version: 3, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' }, market: 'IL',
  plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 }, catalog: { active: 4, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false }, priceCatalogVersion: '2026-10-07.1',
};
const READY_VISUAL = {
  ...READY_FREE, market: 'INTERNATIONAL', plan: { id: 'visual' }, subscriptionStatus: 'active', free10: null,
  catalog: { active: 120, countDefinition: 'unset', limit: 200, blocks: 1, limitDecided: true },
};

describe('accountPlanFromSummary - plan facts only from a READY server summary', () => {
  it('a ready Free summary yields the canonical plan id and the Free-10 balance', () => {
    expect(accountPlanFromSummary(parseAccountSummary(READY_FREE))).toEqual({
      summaryState: 'ready', planId: 'free', free10Remaining: 7, subscriptionStatus: 'none', outputPhase: 'enforced',
    });
  });
  it('a ready paid summary yields the plan and no Free balance', () => {
    expect(accountPlanFromSummary(parseAccountSummary(READY_VISUAL))).toMatchObject({ summaryState: 'ready', planId: 'visual', free10Remaining: null, subscriptionStatus: 'active' });
  });
  it.each([
    [{ ok: false, code: 'not_activated' }, 'not_activated'],
    [{ ok: false, code: 'account_not_provisioned' }, 'unprovisioned'],
    [{ ok: false, code: 'not_authenticated' }, 'unavailable'],
    [{ ok: true, schema: 'account-summary/v1', plan: { id: 'pro' } }, 'invalid'], // a legacy tier can never parse
    [{ ...READY_FREE, plan: { id: 'basic' } }, 'invalid'],
    ['garbage', 'invalid'],
  ])('summary %j -> state %s, and NO plan / balance at all', (raw, state) => {
    const a = accountPlanFromSummary(parseAccountSummary(raw));
    expect(a).toEqual({ summaryState: state, planId: null, free10Remaining: null, subscriptionStatus: null, outputPhase: 'off' });
  });
  it('no summary at all -> unavailable, no plan', () => {
    expect(accountPlanFromSummary(null)).toEqual(NO_ACCOUNT_PLAN);
    expect(NO_ACCOUNT_PLAN.planId).toBeNull();
  });
});

describe('fetchServerAccountSummary - the user-JWT RPC, never the request body', () => {
  const rpcOf = (res) => { const calls = []; const fn = (name, ...rest) => { calls.push([name, ...rest]); return Promise.resolve(res); }; fn.calls = calls; return fn; };
  it('calls get_account_summary with NO argument (identity = auth.uid() server-side) and parses the result', async () => {
    const rpc = rpcOf({ data: READY_FREE, error: null, status: 200 });
    const s = await fetchServerAccountSummary(rpc);
    expect(rpc.calls).toEqual([['get_account_summary']]);
    expect(s.state).toBe('ready');
  });
  it('function not deployed (PGRST202 / 404) -> not_deployed; any other error -> unavailable; a throw -> unavailable', async () => {
    expect((await fetchServerAccountSummary(rpcOf({ data: null, error: { code: 'PGRST202' }, status: 404 }))).state).toBe('not_deployed');
    expect((await fetchServerAccountSummary(rpcOf({ data: null, error: { code: 'XX000' }, status: 500 }))).state).toBe('unavailable');
    expect((await fetchServerAccountSummary(() => { throw new Error('network'); })).state).toBe('unavailable');
  });
  it('the phase-off answer of the real RPC (not_activated) is preserved', async () => {
    expect((await fetchServerAccountSummary(rpcOf({ data: { ok: false, code: 'not_activated' }, error: null, status: 200 }))).state).toBe('not_activated');
  });
});

describe('buildVerifiedAccountContext - minimal safe field allowlist', () => {
  it('derives market from country exactly, and resolves an unknown/missing value to the explicit "Unknown" state (never silently International)', () => {
    expect(buildVerifiedAccountContext({ country: 'Local' }, null).market).toBe('Local');
    expect(buildVerifiedAccountContext({ country: 'International' }, null).market).toBe('International');
    expect(buildVerifiedAccountContext({ country: 'Israel' }, null).market).toBe('Unknown');
    expect(buildVerifiedAccountContext(null, null).market).toBe('Unknown');
  });
  it('a ready summary market wins over the business_settings country', () => {
    expect(buildVerifiedAccountContext({ country: 'Local' }, null, parseAccountSummary(READY_VISUAL)).market).toBe('International');
    expect(buildVerifiedAccountContext({ country: 'International' }, null, parseAccountSummary({ ok: false, code: 'not_activated' })).market).toBe('International');
  });
  it('legacy plan / trial / Lifetime columns are IGNORED - no plan is ever derived from business_settings', () => {
    const ctx = buildVerifiedAccountContext({ plan: 'pro', trial_ends_at: '2099-01-01T00:00:00Z', is_lifetime: true, country: 'Local' }, null);
    expect(ctx.account).toEqual(NO_ACCOUNT_PLAN);
    expect(JSON.stringify(ctx)).not.toMatch(/pro|basic|trial|lifetime/i);
  });
  it('never includes role, business name, tax id, address, phone, or any other non-allowlisted field on the returned object', () => {
    const ctx = buildVerifiedAccountContext({ role: 'super_admin', country: 'Local', business_name: 'X', tax_id: '1', phone: '2' }, 'main');
    expect(Object.keys(ctx).sort()).toEqual(['account', 'currentArea', 'market']);
    expect(Object.keys(ctx.account).sort()).toEqual(['free10Remaining', 'outputPhase', 'planId', 'subscriptionStatus', 'summaryState']);
  });
  it('carries the allowlisted currentArea through unchanged', () => {
    expect(buildVerifiedAccountContext({ country: 'Local' }, 'catalog').currentArea).toBe('catalog');
  });
  it('the module no longer reads or ports any legacy entitlement source', () => {
    const src = readFileSync('supabase/functions/chat-ai/accountContext.ts', 'utf-8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    expect(src).not.toMatch(/trial_ends_at|is_lifetime|computeEffectivePlan|resolveAccountEntitlement|'basic'|'pro'/);
  });
});

describe('isHebrewFromMarket - server-derived language policy for authenticated requests', () => {
  it('Local market locks Hebrew', () => {
    expect(isHebrewFromMarket('Local', false)).toBe(true);
  });
  it('International market locks English', () => {
    expect(isHebrewFromMarket('International', true)).toBe(false);
  });
  it('Unknown market uses the caller-supplied fallback for reply LANGUAGE only (never asserts a commercial market)', () => {
    expect(isHebrewFromMarket('Unknown', true)).toBe(true);
    expect(isHebrewFromMarket('Unknown', false)).toBe(false);
  });
  it('Unknown market with no fallback argument defaults safely to false (English), never throws', () => {
    expect(isHebrewFromMarket('Unknown')).toBe(false);
  });
});
