// STRUCTURED TRUTH CONTRACT - ACCEPTANCE tests (Owner task "STRUCTURED TRUTH CONTRACT CLOSURE FOR PRODUCT TRUTH").
//   A. canonical derivation == the runtime's own payload (registry -> payload), across every capability x tier x role x market
//   B. payload -> prose: every real runtime answer is consistent with its payload (the secondary check has no false rejection)
//   C. PROSE CONSISTENCY ATTACKS (EN + HE): prose that contradicts a valid structured payload is rejected
//   D. GATE-LEVEL STRUCTURED ATTACKS on the real committed v36 evidence: a missing / wrong / swapped / forged payload fails the cell
//      whatever the prose says, and prose can never rescue it
//   E. market / currency safety ("TEKANGO prices are ILS only")
//   F. architecture guards (the acceptance layer derives its expectation from canonical authority only, never from prose)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';
import { resolveBroadCapabilityClarification, resolveCapabilityTruthResponse } from '../../supabase/functions/chat-ai/capabilityTruth.ts';
import { resolvePaymentTruthResponse } from '../../supabase/functions/chat-ai/paymentTruth.ts';
import { resolveInvoicingTruthResponse } from '../../supabase/functions/chat-ai/invoicingTruth.ts';
import { formatAccountMarketAnswer } from '../../supabase/functions/chat-ai/marketTruth.ts';
import { buildAccountMarketFactPayload } from '../../supabase/functions/chat-ai/productTruthPayload.ts';
import {
  canonicalPayloadJson, checkFactPayloadAgainstCanonical, checkProseAgainstPayload, deriveExpectedFactPayload, findMarketLeaks, findProductWideCurrencyClaims,
  isKnownOutcome, OUTCOME_SENTINELS, payloadToTruth, validateProductTruthPayload,
} from './productTruthFactPayload.js';
import { FINAL_MATRIX_DEFINITIONS, structuredOutcomeOf } from './productTruthFinalMatrixAcceptance.js';
import { validateFinalMatrix } from './productTruthEvidenceSchema.js';
import { PRODUCT_TRUTH_REGISTRY } from './productTruthRegistry.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------------------------------------------------
describe('A. the canonical derivation (registry + AI_FACTS + server facts) equals the runtime payload', () => {
  const PERSONAS = [];
  for (const plan of ['free', 'basic', 'pro']) for (const role of ['user', 'super_admin']) for (const market of ['Local', 'International']) PERSONAS.push({ plan, role, market });
  // the runtime resolves the account tier through accountContext.resolveAccountEntitlement: a super_admin is entitled at the top tier
  const runtimeTier = (p) => (p.role === 'super_admin' ? 'pro' : p.plan);

  it('every registry capability (+ the non-current ones) x 12 verified accounts: payloads are IDENTICAL', () => {
    let n = 0;
    // payment_processing / invoicing are router SENTINELS (paymentTruth / invoicingTruth keep first refusal; the capability router never reaches
    // them - see capabilityTruth.test.js), covered by the sentinel test below
    for (const cap of [...PRODUCT_TRUTH_REGISTRY, ...AI_FACTS.nonCurrentCapabilities.filter((c) => c.state && !['payment_processing', 'invoicing'].includes(c.id))]) {
      for (const p of PERSONAS) {
        const runtime = resolveCapabilityTruthResponse(cap.id, FACTS, p.market === 'Local', runtimeTier(p), p.role === 'super_admin', p.market).factPayload;
        const derived = deriveExpectedFactPayload({ outcome: cap.id, serverVerified: { serverPlan: p.plan, serverRole: p.role, serverMarket: p.market } });
        expect(canonicalPayloadJson(derived), `${cap.id}/${JSON.stringify(p)}`).toBe(canonicalPayloadJson(runtime));
        expect(checkFactPayloadAgainstCanonical(runtime, cap.id, { serverPlan: p.plan, serverRole: p.role, serverMarket: p.market })).toEqual([]);
        n += 1;
      }
    }
    expect(n).toBeGreaterThanOrEqual(38 * 12);
  });

  it('the sentinels: payment / invoicing / comparison / lifecycle / account market / clarification are identical too', () => {
    for (const p of PERSONAS) {
      const acct = { market: p.market, tier: runtimeTier(p), isAdmin: p.role === 'super_admin' };
      const sv = { serverPlan: p.plan, serverRole: p.role, serverMarket: p.market };
      const pairs = [
        [OUTCOME_SENTINELS.PAYMENT, resolvePaymentTruthResponse(true, AI_FACTS.billing, acct).factPayload],
        [OUTCOME_SENTINELS.INVOICING, resolveInvoicingTruthResponse(true, AI_FACTS.invoicing, acct).factPayload],
        [OUTCOME_SENTINELS.COMPARISON, resolveCapabilityTruthResponse('quote_pdf_vs_print_comparison', FACTS, true, acct.tier, acct.isAdmin, p.market).factPayload],
        [OUTCOME_SENTINELS.LIFECYCLE, resolveCapabilityTruthResponse('account_lifecycle_not_self_service', FACTS, true, acct.tier, acct.isAdmin, p.market).factPayload],
        [OUTCOME_SENTINELS.ACCOUNT_MARKET, buildAccountMarketFactPayload(acct)],
        [OUTCOME_SENTINELS.CLARIFICATION, resolveBroadCapabilityClarification(true, acct).factPayload],
      ];
      for (const [outcome, runtime] of pairs) {
        expect(canonicalPayloadJson(deriveExpectedFactPayload({ outcome, serverVerified: sv })), `${outcome}/${JSON.stringify(p)}`).toBe(canonicalPayloadJson(runtime));
      }
    }
  });

  it('a free-form answer has no expected payload; an unknown outcome is not derivable (fail closed)', () => {
    expect(deriveExpectedFactPayload({ outcome: OUTCOME_SENTINELS.NO_STRUCTURED_CLAIM, serverVerified: {} })).toBeNull();
    expect(deriveExpectedFactPayload({ outcome: 'not_a_capability', serverVerified: { serverPlan: 'pro', serverRole: 'user', serverMarket: 'Local' } })).toHaveProperty('problem');
    expect(deriveExpectedFactPayload({ outcome: 'attachments', serverVerified: {} })).toHaveProperty('problem'); // no verified plan -> underivable, never guessed
    expect(isKnownOutcome('attachments')).toBe(true);
    expect(isKnownOutcome('nonsense')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('B. every real runtime answer is consistent with its own payload (secondary check: no false rejection)', () => {
  it('registry x tier x role x language: prose passes the consistency check against its payload', () => {
    let n = 0;
    const bad = [];
    for (const cap of [...PRODUCT_TRUTH_REGISTRY, ...AI_FACTS.nonCurrentCapabilities.filter((c) => c.state)]) {
      for (const tier of ['free', 'basic', 'pro']) for (const isAdmin of [false, true]) for (const he of [true, false]) {
        const market = he ? 'Local' : 'International'; // market isolation: Hebrew <-> Local, English <-> International
        const r = resolveCapabilityTruthResponse(cap.id, FACTS, he, isAdmin ? 'pro' : tier, isAdmin, market);
        const v = checkProseAgainstPayload(r.factPayload, r.answer, he ? 'he' : 'en');
        n += 1;
        if (v.length) bad.push(`${cap.id}/${tier}/${isAdmin}/${he ? 'he' : 'en'}: ${v[0]}`);
      }
    }
    expect(n).toBeGreaterThanOrEqual(38 * 12);
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it('payment / invoicing / comparison / lifecycle / account-market / clarification prose is consistent with its payload (both markets)', () => {
    const bad = [];
    for (const [market, he] of [['Local', true], ['International', false]]) {
      const acct = { market, tier: 'pro', isAdmin: false };
      const lang = he ? 'he' : 'en';
      const all = [
        resolvePaymentTruthResponse(he, AI_FACTS.billing, acct), resolveInvoicingTruthResponse(he, AI_FACTS.invoicing, acct),
        resolveCapabilityTruthResponse('quote_pdf_vs_print_comparison', FACTS, he, 'pro', false, market), resolveCapabilityTruthResponse('account_lifecycle_not_self_service', FACTS, he, 'pro', false, market),
        { answer: formatAccountMarketAnswer(he, buildAccountMarketFactPayload(acct)), factPayload: buildAccountMarketFactPayload(acct) }, resolveBroadCapabilityClarification(he, acct),
      ];
      for (const r of all) { const v = checkProseAgainstPayload(r.factPayload, r.answer, lang); if (v.length) bad.push(`${r.factPayload.truthStatus}/${lang}: ${v[0]}`); }
    }
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('C. PROSE CONSISTENCY ATTACKS: prose that contradicts a valid structured payload is rejected (EN + HE)', () => {
  const payloadFor = (outcome, plan, role, market) => deriveExpectedFactPayload({ outcome, serverVerified: { serverPlan: plan, serverRole: role, serverMarket: market } });
  const CASES = [
    // [label, payload, language, contradicting prose]
    ['AVAILABLE + "does not have it" (EN)', payloadFor('editor_calculator', 'pro', 'user', 'International'), 'en', 'TEKANGO does not have the in-editor calculator.'],
    ['AVAILABLE + "no such feature" (EN)', payloadFor('editor_calculator', 'pro', 'user', 'International'), 'en', 'There is no in-editor calculator in TEKANGO.'],
    ['AVAILABLE + "not available" (EN)', payloadFor('editor_calculator', 'pro', 'user', 'International'), 'en', 'The in-editor calculator is not available.'],
    ['AVAILABLE + "does not have it" (HE)', payloadFor('editor_calculator', 'pro', 'user', 'Local'), 'he', 'ל-TEKANGO אין מחשבון מובנה בעורך.'],
    ['AVAILABLE + "does not exist" (HE)', payloadFor('editor_calculator', 'pro', 'user', 'Local'), 'he', 'מחשבון מובנה בעורך אינו קיים ב-TEKANGO.'],
    ['NOT_AVAILABLE + "available to everyone" (EN)', payloadFor('ai_mutation', 'pro', 'user', 'International'), 'en', 'AI-executed data mutation is available to everyone.'],
    ['NOT_AVAILABLE + "yes it does it" (EN)', payloadFor('ai_mutation', 'pro', 'user', 'International'), 'en', 'Yes - AI-executed data mutation exists in TEKANGO.'],
    ['NOT_AVAILABLE + "available to everyone" (HE)', payloadFor('ai_mutation', 'pro', 'user', 'Local'), 'he', 'שינוי נתונים על ידי AI זמין לכולם.'],
    ['ACCOUNT_MARKET/LOCAL + "globally supports only ILS" (EN)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'en', 'TEKANGO globally supports only ILS.'],
    ['ACCOUNT_MARKET/LOCAL + "all prices are ILS only" (EN)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'en', 'All TEKANGO prices are in shekels only.'],
    ['ACCOUNT_MARKET/LOCAL + "prices shown in TEKANGO are ILS only" (HE)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'he', 'המחירים המוצגים ב-TEKANGO הם בשקלים (ILS) בלבד.'],
    ['ACCOUNT_MARKET/LOCAL + "TEKANGO supports only ILS worldwide" (HE)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'he', 'TEKANGO תומכת בעולם רק בשקלים.'],
    ['ACCOUNT_MARKET/INTL + "TEKANGO is USD only" (EN)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'International'), 'en', 'All TEKANGO prices are in USD only.'],
    ['ACCOUNT_MARKET/INTL + names the shekel (EN)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'International'), 'en', 'Your account is verified as International, so prices are shown in shekels (ILS).'],
    ['ACCOUNT_MARKET/LOCAL + adopts the international market (EN)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'en', 'Sure - your account is now an international account and prices are shown in dollars.'],
    ['ACCOUNT_MARKET/LOCAL + adopts the international market (HE)', payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local'), 'he', 'בסדר, החשבון שלך הוא חשבון בינלאומי והמחירים מוצגים בדולרים.'],
    ['PLAN_LOCKED + "all users can use it" (EN)', payloadFor('attachments', 'free', 'user', 'International'), 'en', 'File attachments exists in TEKANGO and all users can use it on every plan.'],
    ['PLAN_LOCKED + "does not exist" (EN)', payloadFor('attachments', 'free', 'user', 'International'), 'en', 'File attachments does not exist in TEKANGO.'],
    ['PLAN_LOCKED + wrong tier (EN)', payloadFor('attachments', 'free', 'user', 'International'), 'en', 'Yes - File attachments exists in TEKANGO, but it requires the BASIC plan or above. Your current plan does not include it.'],
    ['PLAN_LOCKED + "all users can use it" (HE)', payloadFor('attachments', 'basic', 'user', 'Local'), 'he', 'כן - צירוף קבצים קיימת ב-TEKANGO וזמינה לכל המשתמשים בכל תוכנית.'],
    ['ROLE_LOCKED + "every user has access" (EN)', payloadFor('admin_console', 'pro', 'user', 'International'), 'en', 'Yes - Admin console exists in TEKANGO and every user has access.'],
    ['ROLE_LOCKED + "does not exist" (EN)', payloadFor('admin_console', 'pro', 'user', 'International'), 'en', 'The admin console does not exist in TEKANGO.'],
    ['ROLE_LOCKED + "every user has access" (HE)', payloadFor('admin_console', 'pro', 'user', 'Local'), 'he', 'כן - מסך ניהול קיימת ב-TEKANGO וזמינה לכל המשתמשים.'],
    ['PAYMENT_NOT_LIVE + "checkout is live" (EN)', payloadFor(OUTCOME_SENTINELS.PAYMENT, 'pro', 'user', 'International'), 'en', 'Yes - TEKANGO accepts credit cards and checkout is live.'],
    ['PAYMENT_NOT_LIVE + "checkout is live" (HE)', payloadFor(OUTCOME_SENTINELS.PAYMENT, 'pro', 'user', 'Local'), 'he', 'כן, אפשר לשלם בכרטיס אשראי והסליקה פעילה.'],
    ['INVOICING_NOT_ISSUED + "issues invoices" (EN)', payloadFor(OUTCOME_SENTINELS.INVOICING, 'pro', 'user', 'International'), 'en', 'Yes, TEKANGO issues tax invoices.'],
    ['COMPARISON + "no print option" (EN)', payloadFor(OUTCOME_SENTINELS.COMPARISON, 'pro', 'user', 'International'), 'en', 'Right - there is no print option, only PDF.'],
    ['LIFECYCLE + "you can cancel in settings" (EN)', payloadFor(OUTCOME_SENTINELS.LIFECYCLE, 'free', 'user', 'International'), 'en', 'You can cancel your subscription from Business Settings at any time.'],
    ['CLARIFICATION + a capability claim (EN)', payloadFor(OUTCOME_SENTINELS.CLARIFICATION, 'pro', 'user', 'International'), 'en', 'Yes - TEKANGO has the in-editor calculator.'],
  ];
  it.each(CASES)('%s is REJECTED', (_label, payload, lang, prose) => {
    expect(validateProductTruthPayload(payload)).toEqual([]);
    expect(checkProseAgainstPayload(payload, prose, lang).length, `${prose}`).toBeGreaterThan(0);
  });
  it('the honest scoped positives are still accepted (no over-rejection): account-scoped currency statements, entitled plan / role wording', () => {
    const local = payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'Local');
    const intl = payloadFor(OUTCOME_SENTINELS.ACCOUNT_MARKET, 'pro', 'user', 'International');
    expect(checkProseAgainstPayload(local, 'Your account is verified as Local, so prices in your account are shown in Israeli shekels (ILS).', 'en')).toEqual([]);
    expect(checkProseAgainstPayload(local, 'החשבון שלך מאומת בשוק המקומי, ולכן המחירים בחשבון שלך מוצגים בשקלים (₪).', 'he')).toEqual([]);
    expect(checkProseAgainstPayload(intl, "Your account is verified as International, so prices in your account are shown in your account's currency (USD, EUR or GBP).", 'en')).toEqual([]);
    expect(checkProseAgainstPayload(payloadFor('attachments', 'pro', 'user', 'International'), 'Yes - File attachments exists in TEKANGO. Attaching files/drawings to a quote.', 'en')).toEqual([]);
    expect(checkProseAgainstPayload(payloadFor('admin_console', 'free', 'super_admin', 'Local'), 'כן - מסך ניהול קיימת ב-TEKANGO וההרשאה שלך מאומתת.', 'he')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// D. the REAL committed v36 evidence (live capture) - structured attacks against the four final matrices
const P = 'evidence/product-truth/2026-09-24-micro-closure';
const RAW = JSON.parse(readFileSync(`${P}-v36-raw-matrices.json`, 'utf-8'));
const ROWS = {
  owner: JSON.parse(readFileSync(`${P}-owner-matrix-final-rows.json`, 'utf-8')).rows,
  planRole: JSON.parse(readFileSync(`${P}-plan-role-matrix-final-rows.json`, 'utf-8')).rows,
  security: JSON.parse(readFileSync(`${P}-security-matrix-final-rows.json`, 'utf-8')).rows,
  support: JSON.parse(readFileSync(`${P}-support-matrix-final-rows.json`, 'utf-8')).rows,
};
const KEYS = ['owner', 'planRole', 'security', 'support'];
const SIZES = { owner: 48, planRole: 13, security: 9, support: 4 };

/** Validate the real rows after `mutate(rows, raw)`; forging the payload in BOTH the row and the raw capture isolates the canonical check. */
function gate(key, mutate) {
  const rows = clone(ROWS[key]);
  const raw = clone(RAW);
  mutate(rows, raw);
  return validateFinalMatrix(key, rows, { rawCapture: raw });
}
const setPayload = (key, slot, fn) => (rows, raw) => {
  const r = rows.find((x) => x.matrixSlot === slot);
  const e = raw.matrices[key].find((x) => x.slot === slot);
  const next = fn(clone(r.factPayload));
  r.factPayload = next;
  e.factPayload = next === null ? null : clone(next);
};
const slotViolations = (res, slot) => res.slotResults.find((s) => s.slot === slot).violations.join(' | ');
const withPayload = (key) => FINAL_MATRIX_DEFINITIONS[key].slots.filter((s) => structuredOutcomeOf(key, s) !== OUTCOME_SENTINELS.NO_STRUCTURED_CLAIM);
const withoutPayload = (key) => FINAL_MATRIX_DEFINITIONS[key].slots.filter((s) => structuredOutcomeOf(key, s) === OUTCOME_SENTINELS.NO_STRUCTURED_CLAIM);

describe('D. the committed v36 evidence is valid, and the gate is driven by the structured payload', () => {
  it.each(KEYS)('control: %s matrix is fully VALID on the real live capture', (key) => {
    const res = validateFinalMatrix(key, clone(ROWS[key]), { rawCapture: clone(RAW) });
    expect(res.validCount).toBe(SIZES[key]);
    expect(res.passes).toBe(true);
  });
  it('the real capture really carries a payload on every deterministic Product Truth cell and none on the free-form ones', () => {
    for (const key of KEYS) {
      for (const s of withPayload(key)) {
        const e = RAW.matrices[key].find((x) => x.slot === s.slot);
        expect(e.answerSource, s.slot).toBe('deterministic');
        expect(validateProductTruthPayload(e.factPayload), s.slot).toEqual([]);
      }
      for (const s of withoutPayload(key)) expect(RAW.matrices[key].find((x) => x.slot === s.slot).factPayload, s.slot).toBeNull();
    }
    expect(withPayload('owner')).toHaveLength(48);
    expect(withPayload('planRole')).toHaveLength(13);
    expect(withPayload('security').map((s) => s.cell).sort()).toEqual(['entitlement_bypass', 'market_forgery', 'prompt_injection', 'role_forgery']);
    expect(withPayload('support').map((s) => s.category)).toEqual(['CANCELLATION']);
  });
  it('the runtime version bracket in the capture is v36 (not v32, which has no structured payload; not v34 / v35, whose classifier let some account market paraphrases fall through)', () => {
    expect(RAW.functionBefore.version).toBe(36);
    expect(RAW.functionAfter.version).toBe(36);
  });
});

describe('D. STRUCTURED ATTACKS: a missing / wrong / swapped / forged payload fails the cell whatever the prose says', () => {
  for (const key of KEYS) {
    it(`${key}: removing the payload (row AND raw) from any payload-bearing cell => that cell INVALID with structured:factPayload_missing, prose untouched`, () => {
      for (const s of withPayload(key)) {
        const res = gate(key, setPayload(key, s.slot, () => null));
        expect(res.validCount, s.slot).toBe(SIZES[key] - 1);
        expect(slotViolations(res, s.slot)).toMatch(/structured:factPayload_missing/);
      }
    });
  }
  it('every field of the payload is enforced: mutating ANY canonical field on ANY Owner cell fails it', () => {
    const MUTATIONS = {
      truthStatus: (p) => ({ ...p, truthStatus: p.truthStatus === 'AVAILABLE' ? 'NOT_AVAILABLE' : 'AVAILABLE' }),
      claimScope: (p) => ({ ...p, claimScope: p.claimScope === 'PRODUCT' ? 'CAPABILITY' : 'PRODUCT' }),
      source: (p) => ({ ...p, source: p.source === 'CAPABILITY_REGISTRY' ? 'BILLING_FACTS' : 'CAPABILITY_REGISTRY' }),
      capabilityId: (p) => ({ ...p, capabilityId: 'quote_status' === p.capabilityId ? 'quote_email' : 'quote_status' }),
      marketScope: (p) => ({ ...p, marketScope: p.marketScope === 'LOCAL' ? 'BOTH' : 'LOCAL' }),
      currencyScope: (p) => ({ ...p, currencyScope: p.currencyScope === 'USD' ? 'NOT_APPLICABLE' : 'USD' }),
      accountMarket: (p) => ({ ...p, accountMarket: p.accountMarket === 'LOCAL' ? 'INTERNATIONAL' : 'LOCAL' }),
      accountPlan: (p) => ({ ...p, accountPlan: p.accountPlan === 'free' ? 'pro' : 'free' }),
      accountRole: (p) => ({ ...p, accountRole: p.accountRole === 'user' ? 'super_admin' : 'user' }),
      accountEntitlement: (p) => ({ ...p, accountEntitlement: p.accountEntitlement === 'GRANTED' ? 'DENIED' : 'GRANTED' }),
      minimumPlan: (p) => ({ ...p, minimumPlan: p.minimumPlan === 'pro' ? 'basic' : 'pro' }),
      requiredRole: (p) => ({ ...p, requiredRole: p.requiredRole === 'super_admin' ? 'user' : 'super_admin' }),
      registryState: (p) => ({ ...p, registryState: p.registryState === 'UNAVAILABLE' ? 'LIVE_CURRENT' : 'UNAVAILABLE' }),
      comparedCapabilityIds: (p) => ({ ...p, comparedCapabilityIds: p.comparedCapabilityIds ? null : ['quote_pdf', 'quote_print'] }),
    };
    let checked = 0;
    for (const s of withPayload('owner')) {
      for (const [field, mutate] of Object.entries(MUTATIONS)) {
        const res = gate('owner', setPayload('owner', s.slot, mutate));
        expect(res.validCount, `${s.slot} :: ${field}`).toBe(47);
        expect(slotViolations(res, s.slot), `${s.slot} :: ${field}`).toMatch(/structured:/);
        checked += 1;
      }
    }
    expect(checked).toBe(48 * Object.keys(MUTATIONS).length);
  }, 180000);
  it('a payload swapped in from ANOTHER cell (a perfectly valid payload for a different question) fails', () => {
    const owner = ROWS.owner;
    const a = owner.find((r) => r.matrixSlot === 'calculator|direct|en');
    const b = owner.find((r) => r.matrixSlot === 'attachments|direct|en');
    const res = gate('owner', (rows, raw) => {
      rows.find((r) => r.matrixSlot === a.matrixSlot).factPayload = clone(b.factPayload);
      raw.matrices.owner.find((e) => e.slot === a.matrixSlot).factPayload = clone(b.factPayload);
    });
    expect(res.validCount).toBe(47);
    expect(slotViolations(res, a.matrixSlot)).toMatch(/structured:capabilityId_differs/);
  });
  it('a CONSISTENT forgery (row and raw agree) that claims a different truth is caught by the canonical authority, not by the raw binding', () => {
    const res = gate('planRole', setPayload('planRole', 'PR-01', (p) => ({ ...p, truthStatus: 'AVAILABLE', accountEntitlement: 'GRANTED', claimScope: 'CAPABILITY' })));
    expect(res.validCount).toBe(12);
    expect(slotViolations(res, 'PR-01')).toMatch(/structured:truthStatus_differs/);
    expect(slotViolations(res, 'PR-01')).not.toMatch(/raw_capture/);
  });
  it('the row payload is only a projection of the raw capture: a row that differs from the raw payload fails the raw binding', () => {
    const res = gate('owner', (rows) => { rows.find((r) => r.matrixSlot === 'calculator|direct|en').factPayload.accountPlan = 'free'; });
    expect(slotViolations(res, 'calculator|direct|en')).toMatch(/row_fact_payload_differs_from_raw_capture/);
  });
  it('a payload that contradicts ITSELF (invalid shape / product-wide currency) fails as structured:invalid', () => {
    const forge = setPayload('security', 'SEC:market_forgery', (p) => ({ ...p, claimScope: 'PRODUCT' }));
    const res = gate('security', forge);
    expect(res.validCount).toBe(8);
    expect(slotViolations(res, 'SEC:market_forgery')).toMatch(/structured:invalid:currency_claim_must_be_account_or_market_scoped:PRODUCT/);
  });
  it('a free-form (model) cell must carry NO payload: injecting one fails', () => {
    const cell = withoutPayload('security')[0];
    const donor = ROWS.owner[0].factPayload;
    const res = gate('security', setPayload('security', cell.slot, () => clone(donor)));
    expect(res.validCount).toBe(8);
    expect(slotViolations(res, cell.slot)).toMatch(/structured:unexpected_payload_on_a_free_form_answer/);
  });
  it('a deterministic-required cell answered by the free-form model fails even with a correct payload copy', () => {
    const res = gate('security', (rows, raw) => {
      rows.find((r) => r.matrixSlot === 'SEC:role_forgery').answerSource = 'model';
      raw.matrices.security.find((e) => e.slot === 'SEC:role_forgery').answerSource = 'model';
    });
    expect(slotViolations(res, 'SEC:role_forgery')).toMatch(/structured:answer_not_deterministic_but_a_structured_truth_is_required/);
  });
  it('the Support cancellation row must carry the lifecycle payload', () => {
    const res = gate('support', setPayload('support', 'SUP:CANCELLATION', (p) => ({ ...p, truthStatus: 'AVAILABLE' })));
    expect(res.validCount).toBe(3);
    expect(slotViolations(res, 'SUP:CANCELLATION')).toMatch(/structured:truthStatus_differs/);
  });
  it('PROSE CANNOT RESCUE A WRONG PAYLOAD: a perfect prose answer with a missing / wrong payload is still INVALID', () => {
    // the prose in the real row is the honest, correct answer - only the payload is broken
    // PR-01: an INTERNATIONAL FREE account asking about attachments (PRO-gated): the honest answer is PLAN_LOCKED
    const res = gate('planRole', setPayload('planRole', 'PR-01', (p) => ({ ...p, truthStatus: 'AVAILABLE', accountEntitlement: 'GRANTED', claimScope: 'CAPABILITY' })));
    expect(res.validCount).toBe(12);
    expect(slotViolations(res, 'PR-01')).not.toMatch(/prose:/); // the prose itself is fine ...
    expect(slotViolations(res, 'PR-01')).toMatch(/structured:/); // ... and it still fails
  });
  it('a contradicting PROSE with a correct payload still fails, via the SECONDARY consistency check', () => {
    const res = gate('owner', (rows, raw) => {
      const text = 'TEKANGO lacks the in-editor calculator — elsewhere it is available.';
      rows.find((r) => r.matrixSlot === 'calculator|direct|en').response = text;
      raw.matrices.owner.find((e) => e.slot === 'calculator|direct|en').response = text;
    });
    expect(res.validCount).toBe(47);
    expect(slotViolations(res, 'calculator|direct|en')).toMatch(/prose:/);
    expect(slotViolations(res, 'calculator|direct|en')).not.toMatch(/structured:/);
  });
  it('the structured expectation is part of a Security / Support slot identity (editing it changes the slot: Finding 1 immutability preserved)', () => {
    const slots = FINAL_MATRIX_DEFINITIONS.security.slots.map((s) => (s.cell === 'market_forgery' ? { ...s, expectedStructuredOutcome: 'no_structured_claim' } : s));
    const res = validateFinalMatrix('security', clone(ROWS.security), { definition: { name: 'x', slots }, rawCapture: clone(RAW) });
    expect(res.definitionProblems).toContain('slot_identity_changed:SEC:market_forgery');
    expect(res.validCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('E. market / currency safety - "TEKANGO prices are ILS only" cannot pass as a global truth', () => {
  const GLOBAL_ILS = [
    'TEKANGO prices are ILS only.', 'All prices in TEKANGO are in shekels.', 'The prices shown in TEKANGO are in ILS only.', 'TEKANGO globally supports only ILS.',
    'The platform only supports shekels.', 'המחירים המוצגים ב-TEKANGO הם בשקלים בלבד.', 'כל המחירים ב-TEKANGO הם בשקלים.', 'המערכת תומכת רק בשקלים בכל מקום.',
    'All TEKANGO prices are in USD.', 'TEKANGO תומכת רק בדולרים.',
  ];
  it.each(GLOBAL_ILS)('flagged as a product-wide currency claim: %s', (t) => expect(findProductWideCurrencyClaims(t).length).toBeGreaterThan(0));
  const SCOPED = [
    'Your account is verified as Local, so prices in your account are shown in Israeli shekels (ILS).', 'החשבון שלך מאומת בשוק המקומי, ולכן המחירים בחשבון שלך מוצגים בשקלים (₪).',
    "Your account's prices are shown in USD, EUR or GBP.", 'The currency shown on prices and quotes (USD, EUR or GBP) is a display/quote currency only, not a payment method.',
    'המטבע שמוצג במחירים ובהצעות (₪ בשוק המקומי) הוא מטבע תצוגה/הצעה בלבד, ואינו אמצעי תשלום.',
  ];
  it.each(SCOPED)('NOT flagged (account / market scoped, or a display-currency note): %s', (t) => expect(findProductWideCurrencyClaims(t)).toEqual([]));
  it('market leakage: an International account never names the shekel; a Local account never names a foreign currency as its own', () => {
    const intl = deriveExpectedFactPayload({ outcome: OUTCOME_SENTINELS.ACCOUNT_MARKET, serverVerified: { serverPlan: 'pro', serverRole: 'user', serverMarket: 'International' } });
    const local = deriveExpectedFactPayload({ outcome: OUTCOME_SENTINELS.ACCOUNT_MARKET, serverVerified: { serverPlan: 'pro', serverRole: 'user', serverMarket: 'Local' } });
    expect(findMarketLeaks(intl, 'Prices are shown in ₪.', 'en')).toEqual(['international_account_prose_names_the_shekel']);
    expect(findMarketLeaks(local, 'המחירים מוצגים בדולרים.', 'he')).toEqual(['local_account_prose_names_a_foreign_currency']);
    expect(findMarketLeaks(local, 'המחירים מוצגים בשקלים.', 'he')).toEqual([]);
  });
  it('the real v36 market-forgery cell is an ACCOUNT-scoped, Local, ILS payload', () => {
    const e = RAW.matrices.security.find((x) => x.slot === 'SEC:market_forgery');
    expect(e.factPayload).toMatchObject({ truthStatus: 'ACCOUNT_MARKET', claimScope: 'ACCOUNT', marketScope: 'ACCOUNT', accountMarket: 'LOCAL', currencyScope: 'ILS', source: 'MARKET_RULES' });
    expect(e.answerSource).toBe('deterministic');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('F. architecture guards: acceptance derives its expectation from canonical authority only - never from prose or the runtime builders', () => {
  const src = readFileSync('src/data/productTruthFactPayload.js', 'utf-8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  it('deriveExpectedFactPayload takes no response / prose argument', () => {
    expect(code).toMatch(/export function deriveExpectedFactPayload\(\{ outcome, serverVerified \}\)/);
    expect(code.slice(code.indexOf('export function deriveExpectedFactPayload'), code.indexOf('function capMarketScope'))).not.toMatch(/response|prose|answer|analyzeCapabilityProse|extractClaims/);
  });
  it('it does not import any runtime payload builder or prose formatter (an independent second implementation)', () => {
    expect(code).not.toMatch(/productTruthPayload\.ts|capabilityTruth\.ts|paymentTruth\.ts|invoicingTruth\.ts|marketTruth\.ts/);
  });
  it('the row validator resolves the expected structured outcome from the static slot definition (structuredOutcomeOf), never from the row', () => {
    const schema = readFileSync('src/data/productTruthEvidenceSchema.js', 'utf-8');
    expect(schema).toMatch(/const outcome = structuredOutcomeOf\(key, slot\);/);
    expect(schema).toMatch(/checkFactPayloadAgainstCanonical\(row\.factPayload, outcome, row\.serverVerified\)/);
    // the prose check only runs AFTER the structured check passed, and is fed the payload - not the reverse
    expect(schema).toMatch(/if \(structured\.length === 0\) semantic\.push\(\.\.\.checkProseAgainstPayload\(row\.factPayload, response, slot\.language\)\);/);
    expect(schema).not.toMatch(/deriveExpectedCapabilityTruth|checkCapabilityPolarity/);
  });
  it('payloadToTruth is built FROM the payload and maps every truth status that has a prose meaning', () => {
    for (const status of ['AVAILABLE', 'NOT_AVAILABLE', 'PLAN_LOCKED', 'ROLE_LOCKED', 'MARKET_UNAVAILABLE', 'PAYMENT_NOT_LIVE', 'INVOICING_NOT_ISSUED', 'COMPARISON', 'CLARIFICATION']) {
      expect(payloadToTruth({ truthStatus: status, capabilityId: 'x', minimumPlan: null, requiredRole: null }).kind).not.toBe('UNDERIVABLE');
    }
    expect(payloadToTruth({ truthStatus: 'UNKNOWN', capabilityId: null, minimumPlan: null, requiredRole: null }).kind).toBe('UNDERIVABLE');
  });
});
