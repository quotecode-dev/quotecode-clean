// TEKANGO subscriptions - commercial model. PREPARATION / NOT ACTIVATED (2026-10-07 night task).
// Pure ESM, no imports, not imported by any product code. Nothing here is wired to the live product.
//
// Owner-approved inputs encoded here (and ONLY these):
//   - 10 free quotes in total, no expiry, consumed once per quote identity at its first client-facing output.
//   - ILS monthly gross consumer prices: Classic 29, Modern 49, Visual 69 (tax status unchanged; no charging exists).
//   - Every PAID plan includes 100 catalog products; each explicitly purchased block adds 100 for 5 ILS/month.
//     price = base + 5 x blocks; capacity = 100 + 100 x blocks. Expansion never opens a style or image capability.
// Everything else is an OPEN decision (see OPEN_DECISIONS) and is deliberately NOT modelled.
// Money: integer ILS amounts only; no rounding, no conversion, no change to product money code.

export const PREPARATION_STATUS = 'PREPARATION / NOT ACTIVATED';

export const FREE_ISSUE_ALLOWANCE = Object.freeze({
  total: 10,
  expires: false,
  consumedAt: 'first_client_output',
  outputChannels: Object.freeze(['send', 'public_share', 'final_pdf', 'final_print']),
});

export const STYLE_PLAN_IDS = Object.freeze(['classic', 'modern', 'visual']);

export const ILS_MONTHLY_GROSS = Object.freeze({ classic: 29, modern: 49, visual: 69 });

export const CATALOG_CAPACITY = Object.freeze({ includedProducts: 100, blockSize: 100, blockMonthlyIls: 5 });

// The single value every not-yet-decided capability resolves to. It is never truthy-looking and never depends on blocks.
export const NOT_DECIDED = 'not_decided';

export const OPEN_DECISIONS = Object.freeze([
  'usage packages (Small/Medium/Large) - not approved',
  'stored-byte capacity (1/5/20 GB or any other) - not approved',
  'AI axis (separate from style plans): consumption unit, allowances and prices - direction only, nothing approved (50/250/1000 not approved)',
  'storage per catalog expansion block - not approved',
  'international (USD/EUR/GBP) and annual prices',
  'tax treatment / VAT display of the approved ILS prices (no VAT rate or breakdown is approved)',
  'paid quote quotas (paid output is fail-closed: paid_quote_policy_pending)',
  'full commercial capability matrix, including whether any plan gets images and whether styles are cumulative',
  'Free plan catalog limit',
  'what counts as a catalog product (archive / variant definition, addendum section 4)',
  'registration fields and business prerequisites before first output',
  'existing-user migration (Trial / Free / Basic / Pro / Lifetime)',
  'retention / account deletion / artifact restore, grace, downgrade and proration (access to already-issued documents after the 10th is DECIDED: kept)',
  'material post-issue revision policy',
  'legacy issued-quote transition policy',
]);
// Engineering requirements (NOT Owner decisions) - CLAUDE_NEXT_STEP_SPEC.md section 10: snapshot/ledger ordering and recovery,
// the common output state, idempotency and lock order. Implemented in subscriptions-prep/sql + server; never listed above.

// AI is a separate commercial axis. It is never part of a style plan price or capability, and nothing about it is approved.
export const AI_AXIS = Object.freeze({ axis: 'ai', separateFromStylePlan: true, unit: NOT_DECIDED, allowance: NOT_DECIDED, price: NOT_DECIDED });

export class CommercialModelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CommercialModelError';
    this.code = code;
  }
}

const isNonNegativeSafeInteger = (n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** Non-negative safe integer only; rejects negatives, fractions, NaN, Infinity, strings, null. Returns the value (-0 -> 0). */
export function assertExpansionBlocks(blocks) {
  if (!isNonNegativeSafeInteger(blocks)) {
    throw new CommercialModelError('invalid_expansion_blocks', `expansion blocks must be a non-negative integer (got ${String(blocks)})`);
  }
  const n = blocks + 0;
  const capacity = CATALOG_CAPACITY.includedProducts + CATALOG_CAPACITY.blockSize * n;
  if (!Number.isSafeInteger(capacity)) {
    throw new CommercialModelError('invalid_expansion_blocks', 'expansion blocks out of range');
  }
  return n;
}

/** Catalog product capacity of a PAID plan: 100 + 100 x blocks. */
export function catalogCapacity(blocks) {
  const n = assertExpansionBlocks(blocks);
  return CATALOG_CAPACITY.includedProducts + CATALOG_CAPACITY.blockSize * n;
}

/** Smallest number of blocks whose capacity holds `productCount` products (0..100 -> 0, 101 -> 1, 1000 -> 9). */
export function minimumBlocksForProducts(productCount) {
  if (!isNonNegativeSafeInteger(productCount)) {
    throw new CommercialModelError('invalid_product_count', `product count must be a non-negative integer (got ${String(productCount)})`);
  }
  if (productCount <= CATALOG_CAPACITY.includedProducts) return 0;
  return Math.ceil((productCount - CATALOG_CAPACITY.includedProducts) / CATALOG_CAPACITY.blockSize);
}

function assertStylePlan(stylePlanId) {
  if (typeof stylePlanId !== 'string' || !STYLE_PLAN_IDS.includes(stylePlanId)) {
    throw new CommercialModelError('unknown_style_plan', `unknown style plan ${JSON.stringify(stylePlanId)}`);
  }
  return stylePlanId;
}

/**
 * Monthly gross price in whole ILS. Only market 'ILS' is decided; every other market/currency throws price_not_decided
 * (never a converted or guessed amount).
 */
export function monthlyPrice({ market, stylePlanId, expansionBlocks = 0 } = {}) {
  if (market !== 'ILS') {
    throw new CommercialModelError('price_not_decided', `no approved price for market ${JSON.stringify(market)}`);
  }
  const style = assertStylePlan(stylePlanId);
  const n = assertExpansionBlocks(expansionBlocks);
  return ILS_MONTHLY_GROSS[style] + CATALOG_CAPACITY.blockMonthlyIls * n;
}

/** Cheapest ILS configuration of one style for a catalog of `productCount` products. */
export function planForCatalog({ stylePlanId, productCount } = {}) {
  const expansionBlocks = minimumBlocksForProducts(productCount);
  return {
    expansionBlocks,
    catalogCapacity: catalogCapacity(expansionBlocks),
    monthlyIls: monthlyPrice({ market: 'ILS', stylePlanId, expansionBlocks }),
  };
}

const SUBSCRIPTION_STATUSES = Object.freeze(['none', 'pending', 'active', 'past_due', 'failed', 'cancelled']);

function notDecidedCapabilities() {
  return Object.freeze({
    styleSelection: NOT_DECIDED,
    catalogImages: NOT_DECIDED,
    quoteImages: NOT_DECIDED,
    heroGallery: NOT_DECIDED,
    attachments: NOT_DECIDED,
  });
}

/**
 * Normalize a SERVER account_entitlements row (snake_case, as returned by the database) into a read-only view.
 * Reads ONLY the server columns listed below; any client/payload field (plan, style, usagePackageId, allowedStyles,
 * canUploadImages, ...) is never read. A missing record is "not provisioned"; a malformed record throws (fail closed).
 * Capabilities are NOT_DECIDED regardless of plan or blocks: expansion never opens a style or images.
 */
export function resolveCommercialEntitlement(serverRecord) {
  if (serverRecord === null || serverRecord === undefined) {
    return Object.freeze({
      status: PREPARATION_STATUS,
      provisioned: false,
      accountMode: null,
      stylePlanId: null,
      subscriptionStatus: null,
      paidActive: false,
      paidQuotePolicy: null,
      freeIssues: null,
      catalog: Object.freeze({ expansionBlocks: null, limit: null, limitDecided: false }),
      capabilities: notDecidedCapabilities(),
      version: null,
    });
  }
  if (typeof serverRecord !== 'object') {
    throw new CommercialModelError('invalid_entitlement_record', 'entitlement record must be an object');
  }
  const mode = serverRecord.account_mode;
  const style = serverRecord.style_plan_id;
  const subscription = serverRecord.subscription_status;
  const blocks = serverRecord.catalog_expansion_blocks;
  const limit = serverRecord.free_issue_limit;
  const consumed = serverRecord.free_issues_consumed;
  const version = serverRecord.entitlement_version;

  const bad = (why) => { throw new CommercialModelError('invalid_entitlement_record', why); };
  if (mode !== 'free_10' && mode !== 'paid') bad('unknown account_mode');
  if (!SUBSCRIPTION_STATUSES.includes(subscription)) bad('unknown subscription_status');
  if (!isNonNegativeSafeInteger(blocks)) bad('invalid catalog_expansion_blocks');
  if (limit !== FREE_ISSUE_ALLOWANCE.total) bad('free_issue_limit must be 10');
  if (!isNonNegativeSafeInteger(consumed) || consumed > limit) bad('invalid free_issues_consumed');
  if (!Number.isSafeInteger(version) || version < 1) bad('invalid entitlement_version');
  if (mode === 'free_10' && (style !== null || blocks !== 0)) bad('free_10 has no style plan and no expansion blocks');
  if (mode === 'paid') assertStylePlan(style);

  const paid = mode === 'paid';
  return Object.freeze({
    status: PREPARATION_STATUS,
    provisioned: true,
    accountMode: mode,
    stylePlanId: paid ? style : null,
    subscriptionStatus: subscription,
    paidActive: paid && subscription === 'active',
    paidQuotePolicy: paid ? NOT_DECIDED : null, // paid output stays fail-closed until a versioned paid policy is approved
    freeIssues: paid ? null : Object.freeze({ limit, consumed, remaining: limit - consumed }),
    catalog: Object.freeze({
      expansionBlocks: blocks,
      limit: paid ? catalogCapacity(blocks) : null, // Free catalog limit NOT decided
      limitDecided: paid,
    }),
    capabilities: notDecidedCapabilities(),
    version,
  });
}
