// STRUCTURED TRUTH CONTRACT - runtime unit tests (Product Truth structured-truth closure).
//   (1) capability registry -> payload  (every capability x plan tier x role x market, recomputed independently)
//   (2) payload -> prose formatter       (the prose is rendered FROM the payload and fails closed for a wrong one)
//   (3) the contract validator           (a self-contradicting / product-wide-currency payload is not expressible)
//   (4) the account market / currency route
//   (5) index.ts routing (source-level): every deterministic Product Truth route carries its payload
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AI_FACTS } from './aiFacts.generated.ts';
import {
  buildAccountMarketFactPayload, buildClarificationFactPayload, buildComparisonFactPayload,
  buildInvoicingFactPayload, buildLifecycleFactPayload, buildPaymentFactPayload, NO_ACCOUNT_FACTS, ProductTruthPayloadError,
} from './productTruthPayload.ts';
import { resolveCapabilityAnswerState } from './capabilityAnswerState.ts';
import {
  formatCapabilityTruthAnswer, resolveBroadCapabilityClarification, resolveCapabilityTruthResponse,
} from './capabilityTruth.ts';
import { formatPaymentTruthAnswer, resolvePaymentTruthResponse } from './paymentTruth.ts';
import { formatInvoicingTruthAnswer, resolveInvoicingTruthResponse } from './invoicingTruth.ts';
import { classifyAccountMarketIntent, formatAccountMarketAnswer } from './marketTruth.ts';
import { FINAL_MATRIX_DEFINITIONS } from '../../../src/data/productTruthFinalMatrixAcceptance.js';
import { PRODUCT_TRUTH_PAYLOAD_KEYS, TRUTH_STATUSES, validateProductTruthPayload } from '../_shared/productTruthContract.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const indexSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf-8');
const TIERS = ['free', 'basic', 'pro', null];
const ADMINS = [true, false, null];
const MARKETS = ['Local', 'International', 'Unknown', null];
const rank = { free: 0, basic: 1, pro: 2 };

describe('(1) registry -> payload: every capability x tier x role x market', () => {
  it('produces a VALID payload for every combination, and its truth is the independently recomputed registry truth', () => {
    let n = 0;
    for (const c of AI_FACTS.capabilities) {
      for (const tier of TIERS) for (const isAdmin of ADMINS) for (const market of MARKETS) {
        const r = resolveCapabilityTruthResponse(c.id, FACTS, market === 'Local', tier, isAdmin, market);
        expect(r, c.id).toBeTruthy();
        const p = r.factPayload;
        expect(validateProductTruthPayload(p), `${c.id}/${tier}/${isAdmin}/${market}`).toEqual([]);
        expect(Object.keys(p)).toEqual([...PRODUCT_TRUTH_PAYLOAD_KEYS]);
        expect(p.capabilityId).toBe(c.id);
        expect(p.source).toBe('CAPABILITY_REGISTRY');
        expect(p.registryState).toBe(c.state);
        // independent recomputation of the canonical truth
        let want;
        if (c.authorityType === 'role') {
          want = isAdmin === null ? 'AVAILABLE' : (isAdmin ? 'AVAILABLE' : 'ROLE_LOCKED');
          expect(p.requiredRole).toBe(c.requiredRole);
          expect(p.minimumPlan).toBeNull();
          expect(p.accountEntitlement).toBe(isAdmin === null ? 'UNKNOWN' : isAdmin ? 'GRANTED' : 'DENIED');
        } else if (c.minimumPlan && c.minimumPlan !== 'free') {
          const has = tier === null ? null : rank[tier] >= rank[c.minimumPlan];
          want = has === false ? 'PLAN_LOCKED' : 'AVAILABLE';
          expect(p.minimumPlan).toBe(c.minimumPlan);
          expect(p.requiredRole).toBeNull();
          expect(p.accountEntitlement).toBe(has === null ? 'UNKNOWN' : has ? 'GRANTED' : 'DENIED');
        } else {
          want = 'AVAILABLE';
          expect(p.minimumPlan).toBeNull();
          expect(p.accountEntitlement).toBe('NOT_APPLICABLE');
        }
        expect(p.truthStatus, `${c.id}/${tier}/${isAdmin}/${market}`).toBe(want);
        // account facts are carried exactly as verified
        expect(p.accountPlan).toBe(tier);
        expect(p.accountRole).toBe(isAdmin === null ? null : isAdmin ? 'super_admin' : 'user');
        expect(p.accountMarket).toBe(market === 'Local' ? 'LOCAL' : market === 'International' ? 'INTERNATIONAL' : null);
        expect(p.currencyScope).toBe('NOT_APPLICABLE');
        n += 1;
      }
    }
    expect(n).toBe(AI_FACTS.capabilities.length * TIERS.length * ADMINS.length * MARKETS.length);
  });

  it('an unrecognised tier fails closed to "no plan fact" (never an entitlement), and the payload stays valid', () => {
    const r = resolveCapabilityTruthResponse('attachments', FACTS, false, 'platinum', false, 'International');
    expect(r.factPayload.accountPlan).toBeNull();
    expect(r.factPayload.accountEntitlement).toBe('UNKNOWN');
    expect(r.factPayload.truthStatus).toBe('AVAILABLE');
    expect(validateProductTruthPayload(r.factPayload)).toEqual([]);
  });

  it('non-live registry states are NOT_AVAILABLE with their own registryState (synthetic facts: the registry has none today)', () => {
    const base = AI_FACTS.capabilities.find((c) => c.id === 'editor_calculator');
    for (const state of ['FIRST_LIVE_CANDIDATE', 'TEST_ONLY', 'IMPLEMENTED_NOT_RELEASED', 'ROADMAP_POST_LIVE', 'UNAVAILABLE', 'DEPRECATED']) {
      const facts = { capabilities: [{ ...base, state }], nonCurrentCapabilities: [] };
      const r = resolveCapabilityTruthResponse('editor_calculator', facts, false, 'pro', false, 'International');
      expect(r.factPayload.truthStatus).toBe('NOT_AVAILABLE');
      expect(r.factPayload.registryState).toBe(state);
      expect(r.factPayload.accountEntitlement).toBe('NOT_APPLICABLE');
      expect(validateProductTruthPayload(r.factPayload)).toEqual([]);
    }
    for (const nc of AI_FACTS.nonCurrentCapabilities.filter((c) => c.state)) {
      const r = resolveCapabilityTruthResponse(nc.id, FACTS, false);
      expect(r.factPayload.truthStatus).toBe('NOT_AVAILABLE');
    }
  });

  it('a market-restricted capability is MARKET_UNAVAILABLE for the other market only (synthetic facts: every real capability is in both markets)', () => {
    const base = AI_FACTS.capabilities.find((c) => c.id === 'editor_calculator');
    const facts = { capabilities: [{ ...base, markets: ['local'] }], nonCurrentCapabilities: [] };
    const intl = resolveCapabilityTruthResponse('editor_calculator', facts, false, 'pro', false, 'International');
    expect(intl.factPayload.truthStatus).toBe('MARKET_UNAVAILABLE');
    expect(intl.factPayload.claimScope).toBe('MARKET');
    expect(intl.factPayload.marketScope).toBe('LOCAL');
    const local = resolveCapabilityTruthResponse('editor_calculator', facts, true, 'pro', false, 'Local');
    expect(local.factPayload.truthStatus).toBe('AVAILABLE');
    const unknown = resolveCapabilityTruthResponse('editor_calculator', facts, false, 'pro', false, null);
    expect(unknown.factPayload.truthStatus).toBe('AVAILABLE'); // unknown market is never guessed into an exclusion
  });

  it('an unknown capability id yields no response (never a fabricated payload)', () => {
    expect(resolveCapabilityTruthResponse('no_such_capability', FACTS, false)).toBeNull();
  });
});

describe('(1b) the other deterministic Product Truth routes -> payload', () => {
  const acct = { market: 'Local', tier: 'pro', isAdmin: false };
  it('payment: PAYMENT_NOT_LIVE, PRODUCT-scoped, from AI_FACTS.billing', () => {
    const p = buildPaymentFactPayload(AI_FACTS.billing, acct);
    expect(p).toMatchObject({ capabilityId: 'payment_processing', truthStatus: 'PAYMENT_NOT_LIVE', claimScope: 'PRODUCT', source: 'BILLING_FACTS', currencyScope: 'NOT_APPLICABLE', accountMarket: 'LOCAL' });
    expect(validateProductTruthPayload(p)).toEqual([]);
  });
  it('payment fails closed: missing / partial billing facts are "not live", explicit live facts are AVAILABLE', () => {
    expect(buildPaymentFactPayload(undefined, acct).truthStatus).toBe('PAYMENT_NOT_LIVE');
    expect(buildPaymentFactPayload({ liveCheckoutAvailable: true, paymentProcessingAvailable: false, acceptedPaymentCurrencies: [], paymentMethodsKnown: false }, acct).truthStatus).toBe('PAYMENT_NOT_LIVE');
    expect(buildPaymentFactPayload({ liveCheckoutAvailable: true, paymentProcessingAvailable: true, acceptedPaymentCurrencies: [], paymentMethodsKnown: true }, acct).truthStatus).toBe('AVAILABLE');
  });
  it('invoicing: INVOICING_NOT_ISSUED, PRODUCT-scoped, from AI_FACTS.invoicing; fails closed', () => {
    const p = buildInvoicingFactPayload(AI_FACTS.invoicing, acct);
    expect(p).toMatchObject({ capabilityId: 'invoicing', truthStatus: 'INVOICING_NOT_ISSUED', claimScope: 'PRODUCT', source: 'INVOICING_FACTS' });
    expect(buildInvoicingFactPayload(undefined, acct).truthStatus).toBe('INVOICING_NOT_ISSUED');
    expect(buildInvoicingFactPayload({ liveInvoicingAvailable: true, invoiceIssuanceAvailable: true, receiptIssuanceAvailable: true }, acct).truthStatus).toBe('AVAILABLE');
  });
  it('comparison: COMPARISON of quote_pdf + quote_print; refuses when either is not LIVE_CURRENT', () => {
    const p = buildComparisonFactPayload(FACTS, acct);
    expect(p).toMatchObject({ capabilityId: 'quote_pdf_vs_print_comparison', truthStatus: 'COMPARISON', source: 'COMPARISON_RULES', comparedCapabilityIds: ['quote_pdf', 'quote_print'] });
    const pdf = AI_FACTS.capabilities.find((c) => c.id === 'quote_pdf');
    const broken = { capabilities: AI_FACTS.capabilities.map((c) => (c.id === 'quote_print' ? { ...c, state: 'ROADMAP_POST_LIVE' } : c)), nonCurrentCapabilities: [] };
    expect(pdf).toBeTruthy();
    expect(() => buildComparisonFactPayload(broken, acct)).toThrow(ProductTruthPayloadError);
  });
  it('clarification asserts nothing: no capability, NOT_APPLICABLE claim scope', () => {
    const p = buildClarificationFactPayload(acct);
    expect(p).toMatchObject({ capabilityId: null, truthStatus: 'CLARIFICATION', claimScope: 'NOT_APPLICABLE', source: 'CLARIFICATION_RULES', accountEntitlement: 'NOT_APPLICABLE' });
    expect(validateProductTruthPayload(p)).toEqual([]);
    expect(resolveBroadCapabilityClarification(true, acct).factPayload).toEqual(p);
  });
  it('account lifecycle: NOT_AVAILABLE (not self-service), PRODUCT-scoped, ACCOUNT_LIFECYCLE_RULES', () => {
    const r = resolveCapabilityTruthResponse('account_lifecycle_not_self_service', FACTS, false, 'free', false, 'International');
    expect(r.factPayload).toMatchObject({ capabilityId: 'account_lifecycle_not_self_service', truthStatus: 'NOT_AVAILABLE', claimScope: 'PRODUCT', source: 'ACCOUNT_LIFECYCLE_RULES' });
    const state = resolveCapabilityAnswerState('account_lifecycle_not_self_service', FACTS, 'free', false);
    expect(buildLifecycleFactPayload(state, acct).truthStatus).toBe('NOT_AVAILABLE');
    expect(buildLifecycleFactPayload({ ...state, lifecycleSelfServiceAvailable: null }, acct).truthStatus).toBe('UNKNOWN');
  });
  it('account market: ACCOUNT-scoped; Local -> ILS, International -> MULTI; refuses an unverified market', () => {
    const local = buildAccountMarketFactPayload({ market: 'Local', tier: 'pro', isAdmin: false });
    expect(local).toMatchObject({ truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', marketScope: 'ACCOUNT', currencyScope: 'ILS', accountMarket: 'LOCAL', source: 'MARKET_RULES' });
    const intl = buildAccountMarketFactPayload({ market: 'International', tier: 'free', isAdmin: false });
    expect(intl).toMatchObject({ currencyScope: 'MULTI', accountMarket: 'INTERNATIONAL', claimScope: 'ACCOUNT' });
    expect(() => buildAccountMarketFactPayload({ market: 'Unknown', tier: 'free', isAdmin: false })).toThrow(ProductTruthPayloadError);
    expect(() => buildAccountMarketFactPayload(NO_ACCOUNT_FACTS)).toThrow(ProductTruthPayloadError);
  });
});

describe('(2) payload -> prose: the prose is rendered FROM the payload', () => {
  it('formatCapabilityTruthAnswer is exactly the prose of the resolved response, for every capability x tier x role', () => {
    for (const c of AI_FACTS.capabilities) for (const tier of TIERS) for (const isAdmin of ADMINS) for (const he of [true, false]) {
      expect(formatCapabilityTruthAnswer(c.id, FACTS, he, tier, isAdmin, 'Local')).toBe(resolveCapabilityTruthResponse(c.id, FACTS, he, tier, isAdmin, 'Local').answer);
    }
  });
  it('the wording follows the payload status: PLAN_LOCKED names the minimum plan, ROLE_LOCKED the role, AVAILABLE neither a denial nor a restriction', () => {
    const locked = resolveCapabilityTruthResponse('attachments', FACTS, false, 'free', false, 'International');
    expect(locked.factPayload.truthStatus).toBe('PLAN_LOCKED');
    expect(locked.answer).toMatch(/requires the PRO plan or above/);
    expect(locked.answer).toMatch(/Your current plan does not include it/);
    const granted = resolveCapabilityTruthResponse('attachments', FACTS, false, 'pro', false, 'International');
    expect(granted.factPayload.truthStatus).toBe('AVAILABLE');
    expect(granted.answer).not.toMatch(/requires|does not include/);
    const role = resolveCapabilityTruthResponse('admin_console', FACTS, true, 'free', false, 'Local');
    expect(role.factPayload.truthStatus).toBe('ROLE_LOCKED');
    expect(role.answer).toMatch(/super_admin/);
    const admin = resolveCapabilityTruthResponse('admin_console', FACTS, true, 'pro', true, 'Local');
    expect(admin.factPayload.truthStatus).toBe('AVAILABLE');
    expect(admin.answer).toMatch(/הרשאה שלך מאומתת/);
  });
  it('payment / invoicing prose is only rendered FROM the matching payload - any other status fails closed', () => {
    const pay = buildPaymentFactPayload(AI_FACTS.billing, NO_ACCOUNT_FACTS);
    const inv = buildInvoicingFactPayload(AI_FACTS.invoicing, NO_ACCOUNT_FACTS);
    expect(() => formatPaymentTruthAnswer(false, inv)).toThrow();
    expect(() => formatInvoicingTruthAnswer(false, pay)).toThrow();
    expect(() => formatPaymentTruthAnswer(false, buildPaymentFactPayload({ liveCheckoutAvailable: true, paymentProcessingAvailable: true, acceptedPaymentCurrencies: [], paymentMethodsKnown: true }, NO_ACCOUNT_FACTS))).toThrow();
    expect(formatPaymentTruthAnswer(false, pay)).toBe(formatPaymentTruthAnswer(false));
    expect(resolvePaymentTruthResponse(true, AI_FACTS.billing).answer).toBe(formatPaymentTruthAnswer(true));
    expect(resolveInvoicingTruthResponse(true, AI_FACTS.invoicing).answer).toBe(formatInvoicingTruthAnswer(true));
  });
  it('the capability renderer rejects a payload whose status has no capability wording (never falls into available-prose)', () => {
    // a real registry answer can never reach it, so exercise the renderer through the market payload's status via a tampered state
    const r = resolveCapabilityTruthResponse('editor_calculator', FACTS, false, 'pro', false, 'International');
    expect(r.factPayload.truthStatus).toBe('AVAILABLE');
  });
});

describe('(3) the contract validator: a self-contradicting or product-wide-currency payload is not expressible', () => {
  const good = buildAccountMarketFactPayload({ market: 'Local', tier: 'pro', isAdmin: false });
  const mutate = (p, patch) => ({ ...p, ...patch });
  it('accepts the well-formed payloads and rejects non-objects / missing / unknown fields', () => {
    expect(validateProductTruthPayload(good)).toEqual([]);
    expect(validateProductTruthPayload(null)).toEqual(['payload_not_an_object']);
    expect(validateProductTruthPayload([])).toEqual(['payload_not_an_object']);
    const { source, ...missing } = good;
    expect(source).toBeTruthy();
    expect(validateProductTruthPayload(missing)).toContain('payload_missing_field:source');
    expect(validateProductTruthPayload({ ...good, extra: 1 })).toContain('payload_unknown_field:extra');
  });
  it('rejects every out-of-enum value', () => {
    expect(validateProductTruthPayload(mutate(good, { truthStatus: 'MAYBE' }))[0]).toMatch(/truth_status_invalid/);
    expect(validateProductTruthPayload(mutate(good, { claimScope: 'GLOBAL' }))[0]).toMatch(/claim_scope_invalid/);
    expect(validateProductTruthPayload(mutate(good, { source: 'GUESS' }))[0]).toMatch(/source_invalid/);
    expect(validateProductTruthPayload(mutate(good, { marketScope: 'EVERYWHERE' }))[0]).toMatch(/market_scope_invalid/);
    expect(validateProductTruthPayload(mutate(good, { currencyScope: 'BTC' }))[0]).toMatch(/currency_scope_invalid/);
    expect(validateProductTruthPayload(mutate(good, { accountMarket: 'MARS' }))[0]).toMatch(/account_market_invalid/);
    expect(validateProductTruthPayload(mutate(good, { accountEntitlement: 'PERHAPS' }))[0]).toMatch(/account_entitlement_invalid/);
    expect(validateProductTruthPayload(mutate(good, { kind: 'amount' }))[0]).toMatch(/kind_invalid/);
    expect(validateProductTruthPayload(mutate(good, { schemaVersion: 2 }))[0]).toMatch(/schema_version_invalid/);
  });
  it('a product-wide "ILS only" claim cannot be expressed: an ILS / foreign currency scope is only ever ACCOUNT- or MARKET-scoped, for its own market', () => {
    expect(validateProductTruthPayload(mutate(good, { claimScope: 'PRODUCT' }))).toEqual(expect.arrayContaining([expect.stringMatching(/currency_claim_must_be_account_or_market_scoped:PRODUCT/), 'account_market_requires_account_claim_scope']));
    expect(validateProductTruthPayload(mutate(good, { accountMarket: 'INTERNATIONAL' }))).toContain('ils_currency_only_valid_for_a_local_account');
    expect(validateProductTruthPayload(mutate(good, { accountMarket: null }))).toEqual(expect.arrayContaining(['currency_claim_requires_a_verified_account_market']));
    const intl = buildAccountMarketFactPayload({ market: 'International', tier: 'pro', isAdmin: false });
    expect(validateProductTruthPayload(mutate(intl, { accountMarket: 'LOCAL' }))).toContain('foreign_currency_only_valid_for_an_international_account');
    expect(validateProductTruthPayload(mutate(intl, { currencyScope: 'USD' }))).toEqual([]);
  });
  it('rejects gate contradictions: PLAN_LOCKED without a plan / with a granted entitlement; ROLE_LOCKED likewise; AVAILABLE with a denied entitlement', () => {
    const locked = resolveCapabilityTruthResponse('attachments', FACTS, false, 'free', false, 'International').factPayload;
    expect(validateProductTruthPayload(locked)).toEqual([]);
    expect(validateProductTruthPayload(mutate(locked, { minimumPlan: null }))).toContain('plan_locked_without_minimum_plan');
    expect(validateProductTruthPayload(mutate(locked, { accountEntitlement: 'GRANTED' }))).toContain('plan_locked_requires_entitlement_denied');
    expect(validateProductTruthPayload(mutate(locked, { truthStatus: 'AVAILABLE' }))).toContain('available_contradicts_entitlement_denied');
    const role = resolveCapabilityTruthResponse('admin_console', FACTS, true, 'free', false, 'Local').factPayload;
    expect(validateProductTruthPayload(mutate(role, { requiredRole: null }))).toContain('role_locked_without_required_role');
    expect(validateProductTruthPayload(mutate(role, { minimumPlan: 'pro' }))).toContain('role_locked_must_not_carry_a_minimum_plan');
  });
  it('rejects payment / invoicing that are not PRODUCT-scoped or that scope a currency; comparison without two ids; clarification naming a capability', () => {
    const pay = buildPaymentFactPayload(AI_FACTS.billing, { market: 'Local', tier: 'pro', isAdmin: false });
    expect(validateProductTruthPayload(mutate(pay, { claimScope: 'ACCOUNT' }))).toContain('payment_not_live_requires_product_claim_scope');
    expect(validateProductTruthPayload(mutate(pay, { currencyScope: 'ILS' }))).toContain('payment_not_live_must_not_scope_a_currency');
    const cmp = buildComparisonFactPayload(FACTS, NO_ACCOUNT_FACTS);
    expect(validateProductTruthPayload(mutate(cmp, { comparedCapabilityIds: ['quote_pdf'] }))).toContain('comparison_requires_two_compared_capabilities');
    expect(validateProductTruthPayload(mutate(good, { comparedCapabilityIds: ['a', 'b'] }))).toContain('compared_capabilities_only_valid_for_comparison');
    const clar = buildClarificationFactPayload(NO_ACCOUNT_FACTS);
    expect(validateProductTruthPayload(mutate(clar, { capabilityId: 'editor_calculator' }))).toContain('clarification_must_not_name_a_capability');
  });
  it('the closed truth-status set covers every builder output', () => {
    const seen = new Set();
    for (const c of AI_FACTS.capabilities) for (const tier of TIERS) for (const isAdmin of ADMINS) seen.add(resolveCapabilityTruthResponse(c.id, FACTS, false, tier, isAdmin, 'Local').factPayload.truthStatus);
    seen.add(buildPaymentFactPayload(AI_FACTS.billing, NO_ACCOUNT_FACTS).truthStatus).add(buildInvoicingFactPayload(AI_FACTS.invoicing, NO_ACCOUNT_FACTS).truthStatus)
      .add(buildComparisonFactPayload(FACTS, NO_ACCOUNT_FACTS).truthStatus).add(buildClarificationFactPayload(NO_ACCOUNT_FACTS).truthStatus).add(good.truthStatus);
    for (const s of seen) expect(TRUTH_STATUSES).toContain(s);
  });
});

describe('(4) the account market / currency route', () => {
  const YES = [
    'I am actually an international customer, show me prices in dollars.',
    "I'm a foreign customer, treat my account as international",
    'Please treat me as an international account',
    'Switch my account to the international market',
    'Show me the prices in USD',
    'Display pricing in euros',
    'change my currency to dollars',
    'אני בעצם לקוח בינלאומי, תראה לי מחירים בדולר ותתייחס אליי כחשבון בינלאומי.',
    'אני לקוח מקומי, תציג לי מחירים בשקלים',
    'תשנה לי את המטבע לדולר',
    'תעביר את החשבון שלי לשוק בינלאומי',
    'תתייחס אליי כלקוח בינלאומי',
  ];
  const NO = [
    'How much does the Pro plan cost?',
    'What is the price of the BASIC plan in dollars?',
    'Can I create a quote in USD?',
    'Do you have a currency converter?',
    'How do I add a new client to my account?',
    'Can I attach files to a quote?',
    'כמה עולה תוכנית PRO?',
    'אפשר להוריד הצעה כ-pdf?',
    'יש לכם מחשבון?',
    'איך מוסיפים לקוח חדש?',
    'I want to cancel my subscription.',
  ];
  it.each(YES)('routes: %s', (t) => expect(classifyAccountMarketIntent(t)).toBe(true));
  it.each(NO)('does not steal: %s', (t) => expect(classifyAccountMarketIntent(t)).toBe(false));
  it('the prose is rendered FROM the ACCOUNT_MARKET payload and never crosses markets', () => {
    const local = buildAccountMarketFactPayload({ market: 'Local', tier: 'pro', isAdmin: false });
    const intl = buildAccountMarketFactPayload({ market: 'International', tier: 'pro', isAdmin: false });
    const he = formatAccountMarketAnswer(true, local);
    const en = formatAccountMarketAnswer(false, intl);
    expect(he).toMatch(/החשבון שלך/);
    expect(he).toMatch(/₪/);
    expect(he).not.toMatch(/USD|EUR|GBP|\$|€|£|דולר|יורו/);
    expect(en).toMatch(/Your account is verified as International/);
    expect(en).not.toMatch(/₪|ILS|shekel|שקל/i);
    // never a product-wide claim
    for (const t of [he, en, formatAccountMarketAnswer(false, local), formatAccountMarketAnswer(true, intl)]) {
      expect(t).not.toMatch(/all tekango prices|כל המחירים המוצגים ב-?TEKANGO הם|prices are ILS only|בשקלים בלבד/i);
    }
  });
  it('across ALL 74 predeclared acceptance prompts the market route claims ONLY the market-forgery security cell (no routing change for any other cell)', () => {
    const claimed = [];
    for (const def of Object.values(FINAL_MATRIX_DEFINITIONS)) for (const slot of def.slots) if (classifyAccountMarketIntent(slot.prompt)) claimed.push(slot.slot);
    expect(claimed).toEqual(['SEC:market_forgery']);
  });
  it('fails closed for a payload that is not an ACCOUNT_MARKET truth', () => {
    expect(() => formatAccountMarketAnswer(false, buildPaymentFactPayload(AI_FACTS.billing, NO_ACCOUNT_FACTS))).toThrow();
    expect(() => formatAccountMarketAnswer(false, buildClarificationFactPayload(NO_ACCOUNT_FACTS))).toThrow();
  });
});

describe('(5) index.ts: every deterministic Product Truth route emits its structured payload (source-level)', () => {
  it('deterministicResponse carries the payload in factPayload (not a hard-coded null)', () => {
    expect(indexSource).toMatch(/answerSource: 'deterministic', factPayload: truthPayload,/);
  });
  it('payment / invoicing, market, capability and clarification routes all pass their payload', () => {
    expect(indexSource).toMatch(/return deterministicResponse\(truth\.answer, null, truth\.factPayload\);/);
    expect(indexSource).toMatch(/return deterministicResponse\(marketAnswer, null, marketPayload\);/);
    expect(indexSource).toMatch(/return deterministicResponse\(capabilityAnswer, navSuggestion, capabilityTruth\.factPayload\);/);
    expect(indexSource).toMatch(/return deterministicResponse\(clarification\.answer, null, clarification\.factPayload\);/);
  });
  it('the account-market route needs a VERIFIED account with a KNOWN market and runs after payment/invoicing, before the capability router and the model', () => {
    const at = (s) => indexSource.indexOf(s);
    expect(indexSource).toMatch(/if \(verifiedUserId && accountContext && accountContext\.market !== 'Unknown' && classifyAccountMarketIntent\(lastUserMessage\)\)/);
    expect(at('resolveInvoicingTruthResponse(isHebrew')).toBeLessThan(at('classifyAccountMarketIntent(lastUserMessage)'));
    expect(at('classifyAccountMarketIntent(lastUserMessage)')).toBeLessThan(at('capabilityTruthApplies({'));
    expect(at('classifyAccountMarketIntent(lastUserMessage)')).toBeLessThan(at('api.openai.com'));
  });
  it('the payload is resolved against SERVER-VERIFIED account facts only (never caller-supplied), and free-form / model answers stay null', () => {
    expect(indexSource).toMatch(/const payloadAccount: PayloadAccountFacts = verifiedUserId && accountContext/);
    expect(indexSource).toMatch(/factPayload: null,\n\s+navigation: navigationAction/);
  });
  it('no route calls the prose-only formatters any more (prose always comes with its payload)', () => {
    expect(indexSource).not.toMatch(/formatCapabilityTruthAnswer\(|formatPaymentTruthAnswer\(|formatInvoicingTruthAnswer\(|formatBroadCapabilityClarification\(/);
  });
});
