// Shared subscriptions contract (supabase/functions/_shared/subscriptionContract.ts): canonical names, strict
// account-summary/v1 parser (fail closed) and the single capability decision rule.
import { describe, it, expect } from 'vitest';
import {
  PLAN_NAMES, planName, parseAccountSummary, decideCapability, CAPABILITIES, CAPABILITY_IDS, outputPhaseOf, decideFree10Action, decideSmartPack,
} from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { accountStatusModel, fetchAccountSummary, isMissingRpcError } from './accountSummaryClient';

const free = (over = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' },
  market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 }, catalog: { active: 4, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
  priceCatalogVersion: '2026-10-07.1', ...over,
});
const paid = (over = {}) => free({ plan: { id: 'modern' }, subscriptionStatus: 'active', free10: null,
  catalog: { active: 120, countDefinition: 'unset', limit: 200, blocks: 1, limitDecided: true }, ...over });

describe('canonical plan names (OD-16)', () => {
  // Task 27: 'all_inclusive' is the current paid plan (§249); classic / modern / visual remain only as legacy plan identities.
  it('HE/EN names are exactly the approved ones', () => {
    expect(PLAN_NAMES.he).toEqual({ free: 'חינם', all_inclusive: 'הכול כלול', classic: 'קלאסיק', modern: 'מודרן', visual: 'ויזואל' });
    expect(PLAN_NAMES.en).toEqual({ free: 'Free', all_inclusive: 'All-inclusive', classic: 'Classic', modern: 'Modern', visual: 'Visual' });
  });
  it('legacy ids have no display name', () => {
    for (const legacy of ['basic', 'pro', 'trial', 'lifetime', 'FREE', 'PRO']) expect(planName(legacy, 'he')).toBeNull();
  });
  it('no capability metadata names a legacy plan, a trial, unlimited or a number of quotes', () => {
    const text = JSON.stringify(CAPABILITIES);
    expect(text).not.toMatch(/\b(Basic|Pro|BASIC|PRO|trial|unlimited)\b|ניסיון|ללא הגבלה|בסיסי/);
    for (const id of CAPABILITY_IDS) expect(CAPABILITIES[id].eligiblePlans).toBeNull();
    expect(CAPABILITIES['catalog_product_image.upload'].freeEligible).toBe(false);
  });
});

describe('parseAccountSummary (strict, fail closed)', () => {
  it('accepts a valid Free and a valid paid summary', () => {
    expect(parseAccountSummary(free())).toMatchObject({ state: 'ready', planId: 'free', free10: { remaining: 7 } });
    expect(parseAccountSummary(paid())).toMatchObject({ state: 'ready', planId: 'modern', free10: null, catalog: { limit: 200 } });
  });
  it('maps server failure codes to neutral / fail-closed states', () => {
    expect(parseAccountSummary({ ok: false, code: 'not_activated' }).state).toBe('not_activated');
    expect(parseAccountSummary({ ok: false, code: 'account_not_provisioned' }).state).toBe('unprovisioned');
    expect(parseAccountSummary({ ok: false, code: 'something_else' }).state).toBe('invalid');
  });
  it.each([
    ['legacy plan id', free({ plan: { id: 'pro' } })],
    ['wrong schema', free({ schema: 'account-summary/v0' })],
    ['unknown capability', free({ capabilities: ['everything'] })],
    ['Free with catalog image upload', free({ capabilities: ['catalog_product_image.upload'] })],
    ['fake balance arithmetic', free({ free10: { limit: 10, consumed: 3, reserved: 0, remaining: 10 } })],
    ['0/5 monthly shape', free({ free10: { limit: 5, consumed: 0, reserved: 0, remaining: 5 } })],
    ['unlimited paid balance', paid({ free10: { limit: Infinity, consumed: 0, reserved: 0, remaining: Infinity } })],
    ['an ended period without its end', free({ free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: null, periodEnded: true } })],
    ['a window end that is not a date', free({ free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: 'soon', periodEnded: false } })],
    ['a period flag that is not a boolean', free({ free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: null, periodEnded: 'yes' } })],
    ['market from a weak signal', free({ market: 'he' })],
    ['catalog limit without decision', free({ catalog: { active: 1, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: false } })],
    ['unknown eligible plan', free({ eligiblePlans: { 'quote_style.modern': ['pro'] } })],
    ['not an object', null],
  ])('rejects %s', (_name, raw) => {
    expect(parseAccountSummary(raw).state).toBe('invalid');
  });
});

describe('decideCapability (one rule for every gate)', () => {
  const cap = 'quote.edit_duplicate';
  it('enforced: the server list decides; forged legacy flag is ignored', () => {
    expect(decideCapability(parseAccountSummary(free()), cap, true)).toMatchObject({ allowed: false, source: 'server' });
    expect(decideCapability(parseAccountSummary(free({ capabilities: ['quote_style.classic', cap] })), cap, false))
      .toMatchObject({ allowed: true, source: 'server' });
  });
  it('Free is denied catalog product images in the enforced phase (OD-18), even with a forged capability list or legacy flag', () => {
    const s = parseAccountSummary(free());
    expect(decideCapability(s, 'catalog_product_image.upload', true)).toMatchObject({ allowed: false, reason: 'free_not_eligible' });
  });
  it('shadow observes only: client and server keep the legacy behavior (no enforcement claim in shadow)', () => {
    const s = parseAccountSummary(free({ phase: { output: 'shadow', catalog: 'prepared', billing: 'off' } }));
    expect(decideCapability(s, 'catalog_product_image.upload', true)).toMatchObject({ allowed: true, source: 'legacy' });
    expect(decideCapability(s, 'quote.edit_duplicate', false)).toMatchObject({ allowed: false, source: 'legacy' });
  });
  it('OPEN-03: the catalog count definition must be stated; anything else fails closed', () => {
    expect(parseAccountSummary(free()).catalog.countDefinition).toBe('unset');
    expect(parseAccountSummary(free({ catalog: { active: 4, limit: null, blocks: 0, limitDecided: false } })).state).toBe('invalid');
    expect(parseAccountSummary(free({ catalog: { active: 4, countDefinition: 'all_rows', limit: null, blocks: 0, limitDecided: false } })).state).toBe('invalid');
  });
  it('capability sources: only OD-18 is a Free denial; expansion for Free is not decided; legacy gates are not plan-gated', () => {
    expect(CAPABILITIES['catalog_capacity.expand'].freeEligible).toBeNull();
    for (const id of ['quote.edit_duplicate', 'quote.whatsapp_delete', 'professional_quote.use', 'professional_quote.reuse']) {
      expect(CAPABILITIES[id].decision).toMatch(/not plan-gated/);
    }
    expect(CAPABILITIES['quote_style.classic'].decision).toMatch(/technical baseline/);
  });
  it('unprovisioned / invalid fail closed', () => {
    expect(decideCapability({ state: 'unprovisioned' }, cap, true).allowed).toBe(false);
    expect(decideCapability({ state: 'invalid' }, cap, true).allowed).toBe(false);
  });
  it('system not active keeps the existing entitlement unchanged (explicit boolean only)', () => {
    for (const state of ['not_activated', 'not_deployed', 'unavailable', 'loading']) {
      expect(decideCapability({ state }, cap, true)).toMatchObject({ allowed: true, source: 'legacy' });
      expect(decideCapability({ state }, cap, false).allowed).toBe(false);
      expect(decideCapability({ state }, cap, 'yes').allowed).toBe(false);
    }
  });
  it('unknown capability ids are denied', () => {
    expect(decideCapability(parseAccountSummary(paid()), 'admin.everything', true).allowed).toBe(false);
  });
  it('output phase is off unless the server says otherwise', () => {
    expect(outputPhaseOf({ state: 'not_deployed' })).toBe('off');
    expect(outputPhaseOf(parseAccountSummary(free()))).toBe('enforced');
  });
});

describe('account status model (badge/settings)', () => {
  it('Free shows the server balance; paid shows the canonical name; nothing shows 0/5 or a trial', () => {
    expect(accountStatusModel(parseAccountSummary(free()), 'he')).toMatchObject({ label: 'חינם', detail: 'נותרו 7 מתוך 10 הצעות' });
    expect(accountStatusModel(parseAccountSummary(paid()), 'en')).toMatchObject({ label: 'Modern', detail: null });
    for (const state of ['loading', 'not_activated', 'not_deployed', 'unprovisioned', 'unavailable', 'invalid']) {
      for (const lang of ['he', 'en']) {
        const m = accountStatusModel({ state }, lang);
        expect(`${m.label} ${m.detail ?? ''}`).not.toMatch(/\d+\s*\/\s*\d+|trial|ניסיון|Pro|Basic|Free|חינם/);
      }
    }
  });
});

describe('fetchAccountSummary', () => {
  it('classifies a missing RPC as not deployed, other errors as unavailable, data through the parser', async () => {
    expect(await fetchAccountSummary({ rpc: async () => ({ error: { code: 'PGRST202' } }) })).toMatchObject({ state: 'not_deployed' });
    expect(await fetchAccountSummary({ rpc: async () => ({ error: { code: '500' } }) })).toMatchObject({ state: 'unavailable' });
    expect(await fetchAccountSummary({ rpc: async () => { throw new Error('offline'); } })).toMatchObject({ state: 'unavailable' });
    expect(await fetchAccountSummary({ rpc: async () => ({ data: free() }) })).toMatchObject({ state: 'ready', planId: 'free' });
    expect(await fetchAccountSummary({ rpc: async () => ({ data: { ok: true, plan: { id: 'pro' } } }) })).toMatchObject({ state: 'invalid' });
    expect(isMissingRpcError({ status: 404 })).toBe(true);
  });
  it('the RPC is called without any argument (the request cannot name an account)', async () => {
    const calls = [];
    await fetchAccountSummary({ rpc: async (...args) => { calls.push(args); return { data: free() }; } });
    expect(calls).toEqual([['get_account_summary']]);
  });
});

// Task 27 (Owner decision 2026-10-11, §253): the Free-10 action decision - enforced only when the server says so.
describe('decideFree10Action (attempted paid action after Free-10)', () => {
  const exhausted = (over = {}) => parseAccountSummary(free({ free10: { limit: 10, consumed: 10, reserved: 0, remaining: 0 }, ...over }));
  it('blocks only an exhausted Free-10 account in the enforced phase', () => {
    expect(decideFree10Action(exhausted())).toMatchObject({ allowed: false, reason: 'free_issue_limit_reached', free10: { consumed: 10, remaining: 0 } });
    expect(decideFree10Action(parseAccountSummary(free()))).toMatchObject({ allowed: true, reason: 'within_free10' });
    // reservations in flight count against the remaining balance (the server computes remaining = 10 - consumed - reserved)
    expect(decideFree10Action(parseAccountSummary(free({ free10: { limit: 10, consumed: 9, reserved: 1, remaining: 0 } }))).allowed).toBe(false);
  });
  it('never adds a restriction while activation is off / prepared / shadow, while loading or when the system is not deployed', () => {
    for (const output of ['off', 'prepared', 'shadow']) {
      expect(decideFree10Action(exhausted({ phase: { output, catalog: 'prepared', billing: 'off' } }))).toEqual({ allowed: true, reason: 'not_enforced' });
    }
    for (const st of [{ state: 'loading' }, { state: 'not_activated' }, { state: 'not_deployed' }, null, undefined]) {
      expect(decideFree10Action(st).allowed).toBe(true);
    }
  });
  it('Owner 2026-10-20: the 7 free days ended before the 10 quotes -> blocked with its own reason; an open window is within Free-10', () => {
    const window = (periodEnded) => parseAccountSummary(free({ free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: '2026-10-28T10:00:00.000Z', periodEnded } }));
    expect(window(true)).toMatchObject({ state: 'ready', free10: { remaining: 7, endsAt: '2026-10-28T10:00:00.000Z', periodEnded: true } });
    expect(decideFree10Action(window(true))).toMatchObject({ allowed: false, reason: 'free_period_ended', free10: { consumed: 3, remaining: 7 } });
    expect(decideFree10Action(window(false))).toMatchObject({ allowed: true, reason: 'within_free10' });
    // an older server without the window fields: no window (never a false block)
    expect(parseAccountSummary(free())).toMatchObject({ free10: { endsAt: null, periodEnded: false } });
    // not enforced: an ended window adds no restriction either
    const shadow = parseAccountSummary(free({ phase: { output: 'shadow', catalog: 'prepared', billing: 'off' },
      free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: '2026-10-28T10:00:00.000Z', periodEnded: true } }));
    expect(decideFree10Action(shadow)).toEqual({ allowed: true, reason: 'not_enforced' });
  });
  it('Owner 2026-10-18: the billing block - a paid account in limited mode is blocked; in grace it is not; malformed = invalid', () => {
    const bill = (over) => ({ paidThrough: '2026-11-20T10:00:00.000Z', graceEndsAt: '2026-11-23T10:00:00.000Z', inGrace: false, limited: false, ...over });
    const pkg = (b) => parseAccountSummary(paid({ plan: { id: 'all_inclusive' }, billing: b }));
    expect(decideFree10Action(pkg(bill({ limited: true })))).toEqual({ allowed: false, reason: 'subscription_limited' });
    expect(decideFree10Action(pkg(bill({ inGrace: true })))).toEqual({ allowed: true, reason: 'paid_plan' });
    expect(pkg(bill({ inGrace: true }))).toMatchObject({ state: 'ready', billing: { inGrace: true, limited: false } });
    // an older server without the block: no grace, never a false block
    expect(parseAccountSummary(paid())).toMatchObject({ billing: { paidThrough: null, graceEndsAt: null, inGrace: false, limited: false } });
    for (const b of [bill({ limited: true, graceEndsAt: null }), bill({ inGrace: true, limited: true }), bill({ paidThrough: 'soon' }), bill({ limited: 'yes' }), 'x']) {
      expect(pkg(b).state).toBe('invalid');
    }
  });
  it('Owner 2026-10-20: SMART PACK - decided only when enforced; malformed = invalid; absent = not active', () => {
    const sp = (smartPack, over = {}) => parseAccountSummary(free({ smartPack, ...over }));
    expect(decideSmartPack(sp({ active: true, source: 'free_window', until: '2026-10-28T10:00:00.000Z' }))).toEqual({ allowed: true, reason: 'included' });
    expect(decideSmartPack(sp({ active: false, source: null, until: null }))).toEqual({ allowed: false, reason: 'smart_pack_required' });
    expect(decideSmartPack(parseAccountSummary(paid({ plan: { id: 'all_inclusive' }, smartPack: { active: true, source: 'add_on', until: null } })))).toEqual({ allowed: true, reason: 'included' });
    // not enforced / not ready: nothing changes for anyone (L-05)
    expect(decideSmartPack(sp({ active: false, source: null, until: null }, { phase: { output: 'shadow', catalog: 'prepared', billing: 'off' } }))).toEqual({ allowed: true, reason: 'not_enforced' });
    for (const st of [{ state: 'loading' }, { state: 'not_activated' }, null, undefined]) expect(decideSmartPack(st).allowed).toBe(true);
    // an older server without the block: not active
    expect(parseAccountSummary(free())).toMatchObject({ smartPack: { active: false, source: null, until: null } });
    for (const bad of [{ active: true, source: null, until: null }, { active: false, source: 'lifetime', until: null }, { active: true, source: 'gift', until: null },
      { active: 'yes', source: null, until: null }, { active: true, source: 'add_on', until: 'soon' }, 'x']) {
      expect(sp(bad).state).toBe('invalid');
    }
  });
  it('a paid account (the package or a legacy plan) is never blocked', () => {
    expect(decideFree10Action(parseAccountSummary(paid({ plan: { id: 'all_inclusive' } })))).toEqual({ allowed: true, reason: 'paid_plan' });
    expect(decideFree10Action(parseAccountSummary(paid()))).toEqual({ allowed: true, reason: 'paid_plan' });
  });
  it('the package summary parses with the canonical package name', () => {
    expect(parseAccountSummary(paid({ plan: { id: 'all_inclusive' } }))).toMatchObject({ state: 'ready', planId: 'all_inclusive' });
    expect(planName('all_inclusive', 'he')).toBe('הכול כלול');
    expect(planName('all_inclusive', 'en')).toBe('All-inclusive');
  });
});
