// PREPARATION / NOT ACTIVATED - prep-only tests for subscriptions-prep/src/commercialModel.js.
// Expected numbers are written out literally from the Owner decision (29/49/69 ILS, 100 included, +100 per 5 ILS block);
// they are NOT recomputed from the module's own constants.
import { describe, expect, it } from 'vitest';
import {
  AI_AXIS,
  CATALOG_CAPACITY,
  CommercialModelError,
  FREE_ISSUE_ALLOWANCE,
  ILS_MONTHLY_GROSS,
  NOT_DECIDED,
  OPEN_DECISIONS,
  PREPARATION_STATUS,
  STYLE_PLAN_IDS,
  assertExpansionBlocks,
  catalogCapacity,
  minimumBlocksForProducts,
  monthlyPrice,
  planForCatalog,
  resolveCommercialEntitlement,
} from './commercialModel.js';

const codeOf = (fn) => {
  try { fn(); } catch (e) { return e instanceof CommercialModelError ? e.code : `untyped:${e?.message}`; }
  return 'did_not_throw';
};

const serverRow = (over = {}) => ({
  user_id: '00000000-0000-4000-8000-000000000001',
  account_mode: 'paid',
  style_plan_id: 'classic',
  subscription_status: 'active',
  catalog_expansion_blocks: 0,
  free_issue_limit: 10,
  free_issues_consumed: 0,
  entitlement_version: 1,
  created_at: '2026-10-07T00:00:00Z',
  updated_at: '2026-10-07T00:00:00Z',
  ...over,
});

describe('status and constants', () => {
  it('is marked preparation / not activated', () => {
    expect(PREPARATION_STATUS).toBe('PREPARATION / NOT ACTIVATED');
  });
  it('free allowance is 10 in total and never expires', () => {
    expect(FREE_ISSUE_ALLOWANCE.total).toBe(10);
    expect(FREE_ISSUE_ALLOWANCE.expires).toBe(false);
    expect([...FREE_ISSUE_ALLOWANCE.outputChannels].sort()).toEqual(['final_pdf', 'final_print', 'public_share', 'send']);
  });
  it('approved ILS prices and catalog terms only', () => {
    expect(ILS_MONTHLY_GROSS).toEqual({ classic: 29, modern: 49, visual: 69 });
    expect(CATALOG_CAPACITY).toEqual({ includedProducts: 100, blockSize: 100, blockMonthlyIls: 5 });
    expect([...STYLE_PLAN_IDS]).toEqual(['classic', 'modern', 'visual']);
  });
  it('constants are frozen (cannot be patched at runtime)', () => {
    expect(Object.isFrozen(ILS_MONTHLY_GROSS)).toBe(true);
    expect(Object.isFrozen(CATALOG_CAPACITY)).toBe(true);
    expect(Object.isFrozen(FREE_ISSUE_ALLOWANCE)).toBe(true);
    expect(Object.isFrozen(OPEN_DECISIONS)).toBe(true);
  });
  it('lists the non-approved items as open decisions', () => {
    const text = OPEN_DECISIONS.join(' | ');
    for (const needle of ['usage packages', 'GB', 'AI axis', 'international', 'paid quote quotas', 'images', 'Free plan catalog limit',
      'registration', 'migration', 'retention', 'revision', 'archive / variant']) {
      expect(text).toContain(needle);
    }
  });
});

describe('catalog capacity and blocks', () => {
  it('0 / 1 / 9 blocks -> 100 / 200 / 1000 products', () => {
    expect(catalogCapacity(0)).toBe(100);
    expect(catalogCapacity(1)).toBe(200);
    expect(catalogCapacity(9)).toBe(1000);
  });
  it('100 / 101 / 1000 products -> 0 / 1 / 9 blocks (and boundaries)', () => {
    expect(minimumBlocksForProducts(0)).toBe(0);
    expect(minimumBlocksForProducts(50)).toBe(0);
    expect(minimumBlocksForProducts(100)).toBe(0);
    expect(minimumBlocksForProducts(101)).toBe(1);
    expect(minimumBlocksForProducts(200)).toBe(1);
    expect(minimumBlocksForProducts(201)).toBe(2);
    expect(minimumBlocksForProducts(1000)).toBe(9);
    expect(minimumBlocksForProducts(1001)).toBe(10);
  });
  it('the chosen block count always fits the catalog, and one block fewer never does', () => {
    for (let count = 0; count <= 2500; count += 1) {
      const blocks = minimumBlocksForProducts(count);
      expect(catalogCapacity(blocks)).toBeGreaterThanOrEqual(count);
      if (blocks > 0) expect(catalogCapacity(blocks - 1)).toBeLessThan(count);
    }
  });
  it.each([-1, -0.5, 0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '1', '0', null, undefined, true, {}, [], 2 ** 53])(
    'rejects invalid block value %p', (bad) => {
      expect(codeOf(() => assertExpansionBlocks(bad))).toBe('invalid_expansion_blocks');
      expect(codeOf(() => catalogCapacity(bad))).toBe('invalid_expansion_blocks');
      expect(codeOf(() => monthlyPrice({ market: 'ILS', stylePlanId: 'visual', expansionBlocks: bad }))).toBe(
        bad === undefined ? 'did_not_throw' : 'invalid_expansion_blocks');
    });
  it('rejects a capacity beyond safe integers instead of overflowing', () => {
    expect(codeOf(() => catalogCapacity(Number.MAX_SAFE_INTEGER))).toBe('invalid_expansion_blocks');
  });
  it.each([-1, 1.5, Number.NaN, '100', null])('rejects invalid product count %p', (bad) => {
    expect(codeOf(() => minimumBlocksForProducts(bad))).toBe('invalid_product_count');
  });
});

describe('monthly ILS price', () => {
  it('Visual: 0 / 1 / 9 blocks -> 69 / 74 / 114', () => {
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'visual', expansionBlocks: 0 })).toBe(69);
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'visual', expansionBlocks: 1 })).toBe(74);
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'visual', expansionBlocks: 9 })).toBe(114);
  });
  it('Classic and Modern at 0 and 9 blocks', () => {
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'classic', expansionBlocks: 0 })).toBe(29);
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'classic', expansionBlocks: 9 })).toBe(74);
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'modern', expansionBlocks: 0 })).toBe(49);
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'modern', expansionBlocks: 9 })).toBe(94);
  });
  it('blocks default to 0 (no automatic expansion)', () => {
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'modern' })).toBe(49);
  });
  it.each(['USD', 'EUR', 'GBP', 'International', 'Local', 'ils', '', null, undefined, { currency: 'ILS' }])(
    'market %p has no decided price -> price_not_decided', (market) => {
      expect(codeOf(() => monthlyPrice({ market, stylePlanId: 'visual', expansionBlocks: 0 }))).toBe('price_not_decided');
    });
  it('no argument at all -> price_not_decided (never a default market)', () => {
    expect(codeOf(() => monthlyPrice())).toBe('price_not_decided');
  });
  it.each(['premium', 'Visual', 'free', 'free_10', 'toString', '__proto__', '', null, undefined])('unknown style %p throws', (stylePlanId) => {
    expect(codeOf(() => monthlyPrice({ market: 'ILS', stylePlanId, expansionBlocks: 0 }))).toBe('unknown_style_plan');
  });
  it('prices are integers', () => {
    for (const s of ['classic', 'modern', 'visual']) {
      for (let b = 0; b <= 20; b += 1) expect(Number.isInteger(monthlyPrice({ market: 'ILS', stylePlanId: s, expansionBlocks: b }))).toBe(true);
    }
  });
});

describe('planForCatalog', () => {
  it('Visual for 50 products = 69 ILS, 0 blocks, capacity 100', () => {
    expect(planForCatalog({ stylePlanId: 'visual', productCount: 50 })).toEqual({ expansionBlocks: 0, catalogCapacity: 100, monthlyIls: 69 });
  });
  it('Visual for 1000 products = 114 ILS, 9 blocks, capacity 1000', () => {
    expect(planForCatalog({ stylePlanId: 'visual', productCount: 1000 })).toEqual({ expansionBlocks: 9, catalogCapacity: 1000, monthlyIls: 114 });
  });
  it('Classic for 101 products = 34 ILS, 1 block, capacity 200', () => {
    expect(planForCatalog({ stylePlanId: 'classic', productCount: 101 })).toEqual({ expansionBlocks: 1, catalogCapacity: 200, monthlyIls: 34 });
  });
  it('rejects bad input', () => {
    expect(codeOf(() => planForCatalog({ stylePlanId: 'visual', productCount: -5 }))).toBe('invalid_product_count');
    expect(codeOf(() => planForCatalog({ stylePlanId: 'gold', productCount: 5 }))).toBe('unknown_style_plan');
  });
});

describe('resolveCommercialEntitlement (server record only)', () => {
  it('missing record -> not provisioned, nothing granted', () => {
    const e = resolveCommercialEntitlement(null);
    expect(e.provisioned).toBe(false);
    expect(e.accountMode).toBe(null);
    expect(e.paidActive).toBe(false);
    expect(e.freeIssues).toBe(null);
    expect(e.catalog.limit).toBe(null);
    expect(Object.values(e.capabilities).every((v) => v === NOT_DECIDED)).toBe(true);
  });
  it('free_10 row -> balance from the server counter, Free catalog limit not decided', () => {
    const e = resolveCommercialEntitlement(serverRow({ account_mode: 'free_10', style_plan_id: null, subscription_status: 'none', free_issues_consumed: 3 }));
    expect(e.accountMode).toBe('free_10');
    expect(e.freeIssues).toEqual({ limit: 10, consumed: 3, remaining: 7 });
    expect(e.catalog).toEqual({ expansionBlocks: 0, limit: null, limitDecided: false });
    expect(e.stylePlanId).toBe(null);
    expect(e.status).toBe('PREPARATION / NOT ACTIVATED');
  });
  it('paid rows -> capacity 100 / 200 / 1000 for 0 / 1 / 9 blocks', () => {
    expect(resolveCommercialEntitlement(serverRow({ catalog_expansion_blocks: 0 })).catalog.limit).toBe(100);
    expect(resolveCommercialEntitlement(serverRow({ catalog_expansion_blocks: 1 })).catalog.limit).toBe(200);
    expect(resolveCommercialEntitlement(serverRow({ catalog_expansion_blocks: 9 })).catalog.limit).toBe(1000);
  });
  it('paid but not active is not paidActive', () => {
    for (const s of ['none', 'pending', 'past_due', 'failed', 'cancelled']) {
      expect(resolveCommercialEntitlement(serverRow({ subscription_status: s })).paidActive).toBe(false);
    }
    expect(resolveCommercialEntitlement(serverRow()).paidActive).toBe(true);
  });
  it('a forged payload cannot change anything: plan/style/package/capability fields are ignored', () => {
    const forged = {
      ...serverRow({ account_mode: 'free_10', style_plan_id: null, subscription_status: 'none', free_issues_consumed: 10 }),
      plan: 'visual', style: 'visual', stylePlanId: 'visual', accountMode: 'paid', usagePackageId: 'large', usage_package_id: 'large',
      allowedStyles: ['classic', 'modern', 'visual'], canUploadImages: true, canUploadCatalogImages: true, catalogProductLimit: 1e9,
      freeIssues: { limit: 1000, consumed: 0, remaining: 1000 }, capabilities: { catalogImages: true }, paidActive: true,
    };
    const e = resolveCommercialEntitlement(forged);
    expect(e.accountMode).toBe('free_10');
    expect(e.stylePlanId).toBe(null);
    expect(e.paidActive).toBe(false);
    expect(e.freeIssues).toEqual({ limit: 10, consumed: 10, remaining: 0 });
    expect(e.catalog.limit).toBe(null);
    expect(e.capabilities.catalogImages).toBe(NOT_DECIDED);
    expect(JSON.stringify(e)).not.toMatch(/large|usagePackage|allowedStyles|canUpload/);
  });
  it('never even reads payload-only fields (property access is recorded)', () => {
    const reads = new Set();
    const target = { ...serverRow({ catalog_expansion_blocks: 2 }), plan: 'visual', style: 'visual', usagePackageId: 'large', allowedStyles: ['visual'], canUploadImages: true };
    const proxy = new Proxy(target, { get(t, k) { reads.add(String(k)); return t[k]; } });
    resolveCommercialEntitlement(proxy);
    for (const forbidden of ['plan', 'style', 'usagePackageId', 'allowedStyles', 'canUploadImages', 'stylePlanId', 'accountMode']) {
      expect(reads.has(forbidden)).toBe(false);
    }
  });
  it('image / style capability is the same NOT_DECIDED value for 0 and 50 blocks (expansion never opens images)', () => {
    const at0 = resolveCommercialEntitlement(serverRow({ style_plan_id: 'classic', catalog_expansion_blocks: 0 }));
    const at50 = resolveCommercialEntitlement(serverRow({ style_plan_id: 'classic', catalog_expansion_blocks: 50 }));
    expect(at0.capabilities).toEqual(at50.capabilities);
    expect(at50.capabilities.catalogImages).toBe('not_decided');
    expect(at50.capabilities.quoteImages).toBe('not_decided');
    expect(at50.capabilities.styleSelection).toBe('not_decided');
    expect(at50.stylePlanId).toBe('classic');
    expect(at50.catalog.limit).toBe(5100);
  });
  it('even Visual does not resolve to an approved image entitlement', () => {
    const v = resolveCommercialEntitlement(serverRow({ style_plan_id: 'visual' }));
    expect(Object.values(v.capabilities).every((x) => x === NOT_DECIDED)).toBe(true);
  });
  it.each([
    ['unknown mode', { account_mode: 'pro' }],
    ['trial mode', { account_mode: 'trial' }],
    ['free with style', { account_mode: 'free_10', style_plan_id: 'visual', subscription_status: 'none' }],
    ['free with blocks', { account_mode: 'free_10', style_plan_id: null, catalog_expansion_blocks: 1 }],
    ['paid without style', { style_plan_id: null }],
    ['paid with unknown style', { style_plan_id: 'premium' }],
    ['limit not 10', { free_issue_limit: 20 }],
    ['consumed above limit', { free_issues_consumed: 11 }],
    ['negative consumed', { free_issues_consumed: -1 }],
    ['fractional blocks', { catalog_expansion_blocks: 1.5 }],
    ['negative blocks', { catalog_expansion_blocks: -1 }],
    ['string blocks', { catalog_expansion_blocks: '9' }],
    ['unknown status', { subscription_status: 'trialing' }],
    ['bad version', { entitlement_version: 0 }],
  ])('malformed server record fails closed: %s', (_label, over) => {
    expect(codeOf(() => resolveCommercialEntitlement(serverRow(over)))).toMatch(/invalid_entitlement_record|unknown_style_plan/);
  });
  it('non-object record fails closed', () => {
    expect(codeOf(() => resolveCommercialEntitlement('paid'))).toBe('invalid_entitlement_record');
  });
});

describe('Codex review fix: AI axis, paid quote policy, open decisions', () => {
  it('AI is a separate axis with nothing decided, independent of style plan and expansion blocks', () => {
    expect(AI_AXIS).toEqual({ axis: 'ai', separateFromStylePlan: true, unit: NOT_DECIDED, allowance: NOT_DECIDED, price: NOT_DECIDED });
    expect(Object.isFrozen(AI_AXIS)).toBe(true);
    // a style price never carries an AI component: Visual 69 + 9 blocks = 114 exactly
    expect(monthlyPrice({ market: 'ILS', stylePlanId: 'visual', expansionBlocks: 9 })).toBe(114);
  });
  it('paid quote policy is pending (never an implicit unlimited); free accounts have none', () => {
    const base = { style_plan_id: 'visual', subscription_status: 'active', catalog_expansion_blocks: 50, free_issue_limit: 10, free_issues_consumed: 0, entitlement_version: 1 };
    expect(resolveCommercialEntitlement({ ...base, account_mode: 'paid' }).paidQuotePolicy).toBe(NOT_DECIDED);
    expect(resolveCommercialEntitlement({ ...base, account_mode: 'free_10', style_plan_id: null, catalog_expansion_blocks: 0 }).paidQuotePolicy).toBe(null);
    expect(resolveCommercialEntitlement(null).paidQuotePolicy).toBe(null);
  });
  it('open decisions name tax treatment and AI; engineering items (snapshot/ledger, status effect) are not Owner decisions', () => {
    const text = OPEN_DECISIONS.join(' | ');
    expect(text).toMatch(/tax treatment/);
    expect(text).toMatch(/AI axis/);
    expect(text).not.toMatch(/status effect|snapshot|ledger/i);
    expect(text).not.toMatch(/18 ?%/);
  });
});
