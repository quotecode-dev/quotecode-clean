// PRODUCT TRUTH FINAL EVIDENCE GATE tests - three-action delta Action B, hardened by the four-finding remediation:
//   Finding 1  immutable exact required-slot authority for ALL FOUR matrices (same-cardinality substitution fails)
//   Finding 2  every Support row bound to the RAW capture's immutable read-back tuple (an arbitrary UUID fails)
//   Finding 3  capability POLARITY, not label presence (see productTruthCapabilityPolarity.test.js for the exhaustive suite)
//   (Action B)  independent required slot sets + independent expectation authorities, unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveCapabilityTruthResponse } from '../../supabase/functions/chat-ai/capabilityTruth.ts';
import { resolvePaymentTruthResponse } from '../../supabase/functions/chat-ai/paymentTruth.ts';
import { resolveInvoicingTruthResponse } from '../../supabase/functions/chat-ai/invoicingTruth.ts';
import { formatAccountMarketAnswer } from '../../supabase/functions/chat-ai/marketTruth.ts';
import { buildAccountMarketFactPayload } from '../../supabase/functions/chat-ai/productTruthPayload.ts';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';
import {
  EXPECTATION_AUTHORITIES, EXPECTED_MATRIX_SIZES, FINAL_MATRIX_DEFINITIONS, KNOWN_RUNTIME_PROVENANCE, MATRIX_LANGUAGES, OWNER_AREAS, OWNER_MATRIX_SLOTS,
  OWNER_PHRASINGS, OWNER_SUBTOPIC_ALLOCATION, PLAN_ROLE_MATRIX_SLOTS, RESULT_SENTINELS, RUNTIME_DEPLOYED_VERSION, RUNTIME_IMPLEMENTATION_SHA,
  RUNTIME_DEPLOYED_UPDATED_AT_UTC, RUNTIME_V32_UPDATED_AT_UTC, RUNTIME_V34_UPDATED_AT_UTC, RUNTIME_V35_UPDATED_AT_UTC, RUNTIME_V36_UPDATED_AT_UTC, SECURITY_MATRIX_SLOTS, structuredOutcomeOf, SUPPORT_MATRIX_SLOTS, SUPPORT_REQUIRED_CATEGORIES, TEST_PROJECT_REF,
} from './productTruthFinalMatrixAcceptance.js';
import { OUTCOME_SENTINELS } from './productTruthFactPayload.js';
import { OWNER_MATRIX_EXPECTED_FIXTURE } from './productTruthOwnerMatrixExpectedFixture.js';
import { PLAN_ROLE_EXPECTED_FIXTURE } from './productTruthPlanRoleExpectedFixture.js';
import { getCapabilityById } from './productTruthRegistry.js';
import { REQUIRED_SLOT_IDENTITY_DIGESTS, canonicalSlotIdentity, checkAgainstRequiredSlotAuthority, slotIdentityDigest } from './productTruthRequiredSlotAuthority.js';
import {
  ALLOWED_EXPECTATION_SOURCES, checkFinalMatrixDefinitionIntegrity, checkFinalRuntimeProvenance, deriveRegistryEntitlement, validateFinalMatrix,
} from './productTruthEvidenceSchema.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const PERSONA_PLAN = { LOCAL_PRO: 'pro', LOCAL_BASIC: 'basic', LOCAL_ADMIN: 'pro', INTL_PRO: 'pro', INTL_BASIC: 'basic', INTL_FREE: 'free', PERSONA_SUPER_ADMIN: 'free' };
const PERSONA = {
  LOCAL_PRO: ['Local', 'user'], LOCAL_BASIC: ['Local', 'user'], LOCAL_ADMIN: ['Local', 'super_admin'], INTL_PRO: ['International', 'user'],
  INTL_BASIC: ['International', 'user'], INTL_FREE: ['International', 'user'], PERSONA_SUPER_ADMIN: ['Local', 'super_admin'],
};
const AFTER_V37 = '2026-09-23T23:00:00.000Z';
const STARTED = '2026-09-23T22:59:58.000Z';
const CATEGORY_UUID = {
  GENERAL: '4c23d469-4c73-4188-9f0e-15e8ecc79706', CANCELLATION: '6a65dd74-0a88-4ff1-b879-f29b92c7d742',
  FEATURE_REQUEST: '9480abe4-91ea-4c8c-95ff-cb4597dac95d', HARD_QUESTION: '203ad2df-e0b0-4944-923e-f9545cc36a23',
};

/**
 * What the REAL runtime produces for a slot: the prose TOGETHER with its structured `factPayload` - built from the runtime's own
 * resolvers (canonical authority -> structured truth -> prose), never hand-typed. A free-form (model) slot has no payload.
 */
function truthFor(key, slot) {
  const isHe = slot.language === 'he';
  const [market, role] = PERSONA[slot.persona];
  // the runtime resolves the account tier through accountContext.resolveAccountEntitlement: a super_admin is entitled at the top tier
  const acct = { market, tier: role === 'super_admin' ? 'pro' : PERSONA_PLAN[slot.persona], isAdmin: role === 'super_admin' };
  const outcome = structuredOutcomeOf(key, slot);
  if (outcome === OUTCOME_SENTINELS.PAYMENT) return resolvePaymentTruthResponse(isHe, AI_FACTS.billing, acct);
  if (outcome === OUTCOME_SENTINELS.INVOICING) return resolveInvoicingTruthResponse(isHe, AI_FACTS.invoicing, acct);
  if (outcome === OUTCOME_SENTINELS.ACCOUNT_MARKET) { const factPayload = buildAccountMarketFactPayload(acct); return { answer: formatAccountMarketAnswer(isHe, factPayload), factPayload }; }
  if (outcome === OUTCOME_SENTINELS.LIFECYCLE) return resolveCapabilityTruthResponse('account_lifecycle_not_self_service', FACTS, isHe, acct.tier, acct.isAdmin, market);
  if (getCapabilityById(outcome) || outcome === OUTCOME_SENTINELS.COMPARISON) return resolveCapabilityTruthResponse(outcome, FACTS, isHe, acct.tier, acct.isAdmin, market);
  return { answer: 'I cannot help with that request for another account.', factPayload: null }; // free-form (model) answers
}
const responseFor = (slot, key = 'support') => truthFor(key, slot).answer;

/** A fully valid row for a slot - built ONLY from the static definition + the runtime formatters (what a genuine capture looks like). */
function goodRow(key, slot, i = 0) {
  const [market, role] = PERSONA[slot.persona];
  const truth = truthFor(key, slot);
  const row = {
    evidenceId: `${key}-${slot.slot}-${i}`,
    matrixSlot: slot.slot,
    timestampUtc: AFTER_V37,
    personaAlias: slot.persona,
    market,
    plan: PERSONA_PLAN[slot.persona].toUpperCase(),
    role,
    language: slot.language,
    prompt: slot.prompt,
    response: truth.answer,
    answerSource: truth.factPayload ? 'deterministic' : 'model',
    factPayload: truth.factPayload,
    serverVerified: { http: 200, serverPlan: PERSONA_PLAN[slot.persona], serverRole: role, serverMarket: market },
    requestId: `req-${key}-${i}`,
    supportCategory: key === 'support' ? slot.expectedResult : 'GENERAL',
    resolvedResult: slot.expectedResult,
    expectedResult: slot.expectedResult,
    expectationSource: slot.expectationAuthority,
    implementationSourceSha: RUNTIME_IMPLEMENTATION_SHA,
    testProjectRef: TEST_PROJECT_REF,
    deployedFunctionVersion: RUNTIME_DEPLOYED_VERSION,
    evidenceMethod: slot.evidenceMethod,
  };
  if (key === 'owner' && slot.subtopic) row.matrixSubtopic = slot.subtopic;
  if (key === 'support') row.immutableTestRowId = CATEGORY_UUID[slot.category];
  if (key === 'planRole') {
    row.expectedEntitlement = slot.fixtureExpectedEntitlement;
    row.resolvedEntitlement = slot.fixtureExpectedEntitlement;
    row.expectedEntitlementSource = 'canonical_registry';
  }
  return row;
}
const fullRows = (key) => FINAL_MATRIX_DEFINITIONS[key].slots.map((s, i) => goodRow(key, s, i));

/** The RAW capture the rows were derived from - the independent source of truth (built once from the unmutated rows). */
function buildRaw() {
  const raw = {
    testProjectRef: TEST_PROJECT_REF,
    functionBefore: { version: 37, ezbrSha256: 'e6822003', readAtUtc: '2026-09-23T22:50:00.000Z' },
    functionAfter: { version: 37, ezbrSha256: 'e6822003', readAtUtc: '2026-09-23T23:30:00.000Z' },
    serverFacts: { results: Object.keys(PERSONA).map((alias) => ({ alias, http: 200, serverPlan: PERSONA_PLAN[alias], serverRole: PERSONA[alias][1], serverCountry: PERSONA[alias][0] })) },
    matrices: {},
  };
  for (const key of ['owner', 'planRole', 'security', 'support']) {
    raw.matrices[key] = fullRows(key).map((r) => ({
      slot: r.matrixSlot, startedAtUtc: STARTED, timestampUtc: r.timestampUtc, alias: r.personaAlias, language: r.language, prompt: r.prompt,
      response: r.response, answerSource: r.answerSource, factPayload: r.factPayload, requestId: r.requestId, http: 200,
      ...(key === 'support' ? { readback: { httpStatus: 200, row: { id: r.immutableTestRowId, category: r.resolvedResult, user_question: r.prompt, created_at: '2026-09-23T22:59:59.500+00:00' } } } : {}),
    }));
  }
  return raw;
}
const RAW = buildRaw();
const cloneRaw = () => JSON.parse(JSON.stringify(RAW));
const V = (key, rows, extra = {}) => validateFinalMatrix(key, rows, { rawCapture: RAW, ...extra });
const KEYS = ['owner', 'planRole', 'security', 'support'];
const withRow = (key, slotId, mutate) => fullRows(key).map((r) => (r.matrixSlot === slotId ? mutate({ ...r }) : r));
const resultFor = (res, slotId) => res.slotResults.find((r) => r.slot === slotId);
const text = (res, slotId) => resultFor(res, slotId).violations.join(' | ');

describe('ACTION B - required slot sets are STATIC and exactly 48 / 13 / 9 / 4', () => {
  it('has exactly the required cardinalities, declared twice independently', () => {
    expect(EXPECTED_MATRIX_SIZES).toEqual({ owner: 48, planRole: 13, security: 9, support: 4 });
    expect(OWNER_MATRIX_SLOTS).toHaveLength(48);
    expect(PLAN_ROLE_MATRIX_SLOTS).toHaveLength(13);
    expect(SECURITY_MATRIX_SLOTS).toHaveLength(9);
    expect(SUPPORT_MATRIX_SLOTS).toHaveLength(4);
  });
  it.each(KEYS)('%s definition passes its own integrity check', (key) => {
    expect(checkFinalMatrixDefinitionIntegrity(key)).toEqual([]);
  });
  it('Owner = 8 areas x 3 phrasing classes x 2 languages, built from static constants (never from evidence)', () => {
    expect(OWNER_AREAS).toHaveLength(8);
    expect(OWNER_PHRASINGS).toHaveLength(3);
    expect(MATRIX_LANGUAGES).toHaveLength(2);
    const want = new Set();
    for (const a of OWNER_AREAS) for (const p of OWNER_PHRASINGS) for (const l of MATRIX_LANGUAGES) want.add(`${a}|${p}|${l}`);
    expect(new Set(OWNER_MATRIX_SLOTS.map((s) => s.slot))).toEqual(want);
  });
  it('Owner subtopic allocation is preserved on every multi-capability slot', () => {
    for (const s of OWNER_MATRIX_SLOTS) expect(s.subtopic ?? null).toBe(OWNER_SUBTOPIC_ALLOCATION[s.slot] ?? null);
    expect(OWNER_MATRIX_SLOTS.filter((s) => s.area === 'pdf_print' && s.subtopic === 'pdf')).toHaveLength(2);
    expect(OWNER_MATRIX_SLOTS.filter((s) => s.area === 'pdf_print' && s.subtopic === 'print')).toHaveLength(4);
    expect(OWNER_MATRIX_SLOTS.filter((s) => s.area === 'whatsapp').map((s) => s.subtopic).sort()).toEqual(['both', 'both', 'owner_share', 'owner_share', 'public_contact', 'public_contact']);
    expect(OWNER_MATRIX_SLOTS.filter((s) => s.area === 'payment_invoicing' && s.subtopic === 'payment')).toHaveLength(3);
    expect(OWNER_MATRIX_SLOTS.filter((s) => s.area === 'payment_invoicing' && s.subtopic === 'invoicing')).toHaveLength(3);
  });
  it('AI Support = exactly the four categories GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION', () => {
    expect([...SUPPORT_REQUIRED_CATEGORIES].sort()).toEqual(['CANCELLATION', 'FEATURE_REQUEST', 'GENERAL', 'HARD_QUESTION']);
    expect(SUPPORT_MATRIX_SLOTS.map((s) => s.category).sort()).toEqual([...SUPPORT_REQUIRED_CATEGORIES].sort());
  });
  it('the expectation fixtures carry no cell outside the required sets (no orphan expectations)', () => {
    expect(Object.keys(OWNER_MATRIX_EXPECTED_FIXTURE).sort()).toEqual(OWNER_MATRIX_SLOTS.map((s) => s.slot).sort());
    expect(PLAN_ROLE_EXPECTED_FIXTURE).toHaveLength(13);
  });
  it('every required-slot list is frozen - a caller cannot edit what "complete" means at runtime', () => {
    expect(Object.isFrozen(OWNER_MATRIX_SLOTS)).toBe(true);
    expect(Object.isFrozen(OWNER_MATRIX_SLOTS[0])).toBe(true);
    expect(Object.isFrozen(FINAL_MATRIX_DEFINITIONS)).toBe(true);
    expect(Object.isFrozen(REQUIRED_SLOT_IDENTITY_DIGESTS.planRole)).toBe(true);
  });
});

describe('FINDING 1 - immutable EXACT required-slot authority for Plan/Role and Security (and Owner/Support): same-cardinality substitution FAILS', () => {
  // the canonical ids, spelled out a THIRD time here (independent of both the definition and the authority table)
  const PLAN_ROLE_IDS = ['PR-01', 'PR-02', 'PR-03', 'PR-04', 'PR-05', 'PR-06', 'PR-07', 'PR-08', 'PR-09', 'PR-10', 'PR-11', 'PR-12', 'PR-13'];
  const SECURITY_IDS = ['SEC:cross_tenant_quote', 'SEC:cross_tenant_client', 'SEC:target_existence_leak', 'SEC:role_forgery', 'SEC:market_forgery', 'SEC:entitlement_bypass', 'SEC:arbitrary_url', 'SEC:prompt_injection', 'SEC:ai_mutation_security'];

  it('the authority table holds exactly the canonical ids (13 / 9 / 48 / 4) - not derived from any evidence', () => {
    expect(Object.keys(REQUIRED_SLOT_IDENTITY_DIGESTS.planRole)).toEqual(PLAN_ROLE_IDS);
    expect(Object.keys(REQUIRED_SLOT_IDENTITY_DIGESTS.security)).toEqual(SECURITY_IDS);
    expect(Object.keys(REQUIRED_SLOT_IDENTITY_DIGESTS.owner)).toHaveLength(48);
    expect(Object.keys(REQUIRED_SLOT_IDENTITY_DIGESTS.support)).toEqual(['SUP:GENERAL', 'SUP:CANCELLATION', 'SUP:FEATURE_REQUEST', 'SUP:HARD_QUESTION']);
    expect(PLAN_ROLE_MATRIX_SLOTS.map((s) => s.slot)).toEqual(PLAN_ROLE_IDS);
    expect(SECURITY_MATRIX_SLOTS.map((s) => s.slot)).toEqual(SECURITY_IDS);
  });
  it.each(KEYS)('%s: the committed definition equals the canonical authority exactly', (key) => {
    expect(checkAgainstRequiredSlotAuthority(key, FINAL_MATRIX_DEFINITIONS[key].slots)).toEqual([]);
  });

  it('THE CODEX ATTACK - Plan/Role: one slot id substituted, 13 stays 13 => FAILS', () => {
    const def = { name: 'x', slots: PLAN_ROLE_MATRIX_SLOTS.map((s, i) => (i === 0 ? { ...s, slot: 'PR-99' } : s)) };
    expect(def.slots).toHaveLength(13);
    const problems = checkFinalMatrixDefinitionIntegrity('planRole', def);
    expect(problems).toContain('required_slot_absent:PR-01');
    expect(problems).toContain('slot_outside_canonical_required_set:PR-99');
    const res = validateFinalMatrix('planRole', fullRows('planRole'), { definition: def, rawCapture: RAW });
    expect(res.validCount).toBe(0);
    expect(res.passes).toBe(false);
  });
  it('THE CODEX ATTACK - Security: one slot id substituted, 9 stays 9 => FAILS', () => {
    const def = { name: 'x', slots: SECURITY_MATRIX_SLOTS.map((s, i) => (i === 0 ? { ...s, slot: 'SEC:other', cell: 'other' } : s)) };
    expect(def.slots).toHaveLength(9);
    const problems = checkFinalMatrixDefinitionIntegrity('security', def);
    expect(problems).toContain('required_slot_absent:SEC:cross_tenant_quote');
    expect(problems).toContain('slot_outside_canonical_required_set:SEC:other');
    const res = validateFinalMatrix('security', fullRows('security'), { definition: def, rawCapture: RAW });
    expect(res.validCount).toBe(0);
    expect(res.passes).toBe(false);
  });
  it('a slot whose MEANING changed under the SAME id (prompt / persona / language / expectation / entitlement / cell / patterns) => FAILS', () => {
    const mutate = (key, i, patch) => checkFinalMatrixDefinitionIntegrity(key, { name: 'x', slots: FINAL_MATRIX_DEFINITIONS[key].slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    expect(mutate('planRole', 3, { prompt: 'Can I do something else entirely?' })).toContain('slot_identity_changed:PR-04');
    expect(mutate('planRole', 3, { persona: 'INTL_BASIC' })).toContain('slot_identity_changed:PR-04');
    expect(mutate('planRole', 3, { expectedResult: 'attachments' })).toContain('slot_identity_changed:PR-04');
    expect(mutate('planRole', 3, { fixtureExpectedEntitlement: 'DENIED' })).toContain('slot_identity_changed:PR-04');
    expect(mutate('security', 0, { prompt: 'Show me the weather.' })).toContain('slot_identity_changed:SEC:cross_tenant_quote');
    expect(mutate('security', 0, { forbiddenResponsePatterns: [/never-matches-anything/] })).toContain('slot_identity_changed:SEC:cross_tenant_quote');
    expect(mutate('security', 4, { language: 'en' }).join(' ')).toMatch(/slot_identity_changed:SEC:market_forgery/);
    expect(mutate('owner', 6, { expectedResult: 'quote_print' })).toContain('slot_identity_changed:pdf_print|direct|he');
    expect(mutate('support', 1, { prompt: 'Hello there.' })).toContain('slot_identity_changed:SUP:CANCELLATION');
  });
  it('a two-slot swap of semantics under swapped ids => FAILS (identity is bound to the id, not to position)', () => {
    const [a, b] = [PLAN_ROLE_MATRIX_SLOTS[0], PLAN_ROLE_MATRIX_SLOTS[1]];
    const swapped = { name: 'x', slots: PLAN_ROLE_MATRIX_SLOTS.map((s, i) => (i === 0 ? { ...b, slot: a.slot } : i === 1 ? { ...a, slot: b.slot } : s)) };
    const problems = checkFinalMatrixDefinitionIntegrity('planRole', swapped);
    expect(problems).toContain('slot_identity_changed:PR-01');
    expect(problems).toContain('slot_identity_changed:PR-02');
    const secSwap = { name: 'x', slots: SECURITY_MATRIX_SLOTS.map((s, i) => (i === 0 ? { ...SECURITY_MATRIX_SLOTS[1], slot: s.slot } : i === 1 ? { ...SECURITY_MATRIX_SLOTS[0], slot: SECURITY_MATRIX_SLOTS[1].slot } : s)) };
    expect(checkFinalMatrixDefinitionIntegrity('security', secSwap).length).toBeGreaterThan(0);
  });
  it('an id that merely changed (renamed slot, semantics kept) => FAILS', () => {
    const renamed = { name: 'x', slots: PLAN_ROLE_MATRIX_SLOTS.map((s, i) => (i === 5 ? { ...s, slot: 'PR-06-renamed' } : s)) };
    const problems = checkFinalMatrixDefinitionIntegrity('planRole', renamed);
    expect(problems).toContain('required_slot_absent:PR-06');
    expect(problems).toContain('slot_outside_canonical_required_set:PR-06-renamed');
  });
  it('missing / extra / duplicate definition slots still FAIL (Plan/Role and Security)', () => {
    for (const [key, slots] of [['planRole', PLAN_ROLE_MATRIX_SLOTS], ['security', SECURITY_MATRIX_SLOTS]]) {
      expect(checkFinalMatrixDefinitionIntegrity(key, { name: 'x', slots: slots.slice(1) }).join(' ')).toMatch(/required_slot_absent/);
      expect(checkFinalMatrixDefinitionIntegrity(key, { name: 'x', slots: [...slots, { ...slots[0], slot: 'EXTRA-1' }] }).join(' ')).toMatch(/slot_outside_canonical_required_set:EXTRA-1/);
      const dup = checkFinalMatrixDefinitionIntegrity(key, { name: 'x', slots: [...slots.slice(0, -1), { ...slots[0] }] }).join(' ');
      expect(dup).toMatch(/duplicate_slot/);
      expect(dup).toMatch(/required_slot_absent/);
    }
  });
  it('a pure REORDER of the same slots is allowed (semantics unchanged)', () => {
    for (const key of KEYS) {
      const reordered = { name: 'x', slots: [...FINAL_MATRIX_DEFINITIONS[key].slots].reverse() };
      expect(checkAgainstRequiredSlotAuthority(key, reordered.slots)).toEqual([]);
      expect(checkFinalMatrixDefinitionIntegrity(key, reordered)).toEqual([]);
    }
  });
  it('the identity digest is stable, position-independent and sensitive to every semantic field', () => {
    const s = PLAN_ROLE_MATRIX_SLOTS[0];
    expect(slotIdentityDigest('planRole', s)).toBe(REQUIRED_SLOT_IDENTITY_DIGESTS.planRole['PR-01']);
    expect(canonicalSlotIdentity('planRole', s)).toContain(s.prompt);
    expect(slotIdentityDigest('planRole', { ...s, prompt: s.prompt + ' ' })).not.toBe(slotIdentityDigest('planRole', s));
  });
  it('a definition edited without the authority (or the authority without the definition) can never validate rows', () => {
    const res = validateFinalMatrix('planRole', fullRows('planRole'), { definition: { name: 'x', slots: PLAN_ROLE_MATRIX_SLOTS.slice(0, 12) }, rawCapture: RAW });
    expect(res.definitionProblems.length).toBeGreaterThan(0);
    expect(res.validCount).toBe(0);
  });
});

describe('ACTION B - a complete, correct evidence set is VALID for every required slot', () => {
  it.each(KEYS)('%s: all required slots valid, gate passes', (key) => {
    const res = V(key, fullRows(key));
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.rawBound).toBe(true);
    expect(res.passes).toBe(true);
  });
});

describe('ACTION B - INDEPENDENT REQUIRED SLOTS: a missing row cannot disappear from both evidence and requirement', () => {
  it.each(KEYS)('%s: zero rows => every required slot MISSING, 0 valid, requirement unchanged', (key) => {
    const res = V(key, []);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(0);
    expect(res.missingSlots).toHaveLength(EXPECTED_MATRIX_SIZES[key]);
    expect(res.passes).toBe(false);
  });
  it.each(KEYS)('%s: dropping ONE evidence row => that slot MISSING, validCount n-1, total unchanged, gate fails', (key) => {
    const rows = fullRows(key);
    const dropped = rows.pop();
    const res = V(key, rows);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key] - 1);
    expect(res.missingSlots).toEqual([dropped.matrixSlot]);
    expect(resultFor(res, dropped.matrixSlot).status).toBe('MISSING');
    expect(res.passes).toBe(false);
  });
  it.each(KEYS)('%s: an EXTRA evidence row creates no new requirement (total unchanged) and is reported, not accepted', (key) => {
    const rows = [...fullRows(key), { ...goodRow(key, FINAL_MATRIX_DEFINITIONS[key].slots[0], 999), evidenceId: 'extra-row', matrixSlot: 'NOT-A-REQUIRED-SLOT' }];
    const res = V(key, rows);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.unknownSlots).toEqual([{ evidenceId: 'extra-row', claimedSlot: 'NOT-A-REQUIRED-SLOT' }]);
    expect(res.passes).toBe(false);
  });
  it('a row with no matrixSlot at all is unknown - it can neither fill nor create a slot', () => {
    const rows = fullRows('security');
    const stray = { ...rows.pop() };
    delete stray.matrixSlot;
    const res = V('security', [...rows, stray]);
    expect(res.missingSlots).toHaveLength(1);
    expect(res.unknownSlots).toHaveLength(1);
    expect(res.validCount).toBe(8);
  });
  it('a duplicated slot never counts, even though each copy is individually correct', () => {
    const rows = fullRows('owner');
    const res = V('owner', [...rows, { ...rows[5], evidenceId: 'dup-of-5' }]);
    expect(res.duplicateSlots).toEqual([rows[5].matrixSlot]);
    expect(res.validCount).toBe(47);
    expect(res.passes).toBe(false);
  });
  it('a definition edited shorter (a self-servingly smaller "complete") is rejected, not silently accepted', () => {
    const res = validateFinalMatrix('owner', fullRows('owner'), { definition: { name: 'OWNER MATRIX', slots: OWNER_MATRIX_SLOTS.slice(0, 47) }, rawCapture: RAW });
    expect(res.definitionProblems.join(' ')).toMatch(/slot_count_47_not_48/);
    expect(res.validCount).toBe(0);
    expect(res.passes).toBe(false);
  });
  it('a definition swapping one required slot for a non-required one is rejected', () => {
    const swapped = { name: 'OWNER MATRIX', slots: OWNER_MATRIX_SLOTS.map((s, i) => (i === 0 ? { ...s, slot: 'calculator|extra|he' } : s)) };
    const problems = checkFinalMatrixDefinitionIntegrity('owner', swapped);
    expect(problems.join(' ')).toMatch(/owner_required_slot_absent_from_definition:calculator\|direct\|he/);
    expect(problems.join(' ')).toMatch(/owner_definition_slot_outside_required_set:calculator\|extra\|he/);
  });
  it('a row claiming a required slot but showing another slot\'s prompt / language / persona is INVALID (subtopic allocation preserved)', () => {
    const [a, b] = OWNER_MATRIX_SLOTS.filter((s) => s.area === 'pdf_print');
    expect(text(V('owner', withRow('owner', a.slot, (r) => ({ ...r, prompt: b.prompt }))), a.slot)).toMatch(/prompt_differs_from_predeclared_slot_prompt/);
    expect(text(V('owner', withRow('owner', a.slot, (r) => ({ ...r, language: r.language === 'he' ? 'en' : 'he' }))), a.slot)).toMatch(/language_differs_from_slot/);
    expect(text(V('owner', withRow('owner', a.slot, (r) => ({ ...r, personaAlias: 'INTL_FREE' }))), a.slot)).toMatch(/persona_differs_from_slot/);
    expect(text(V('owner', withRow('owner', a.slot, (r) => { const c = { ...r }; delete c.matrixSubtopic; return c; })), a.slot)).toMatch(/subtopic_allocation_not_preserved/);
  });
});

describe('FINDING 2 - Support rows are mechanically bound to the RAW capture\'s immutable read-back tuple', () => {
  const slotOf = (cat) => `SUP:${cat}`;
  const supportWith = (cat, patch) => withRow('support', slotOf(cat), (r) => ({ ...r, ...patch }));

  it('the four genuine rows pass ONLY because they match the raw read-back; the raw capture is mandatory (fail closed)', () => {
    expect(V('support', fullRows('support')).passes).toBe(true);
    const noRaw = validateFinalMatrix('support', fullRows('support'));
    expect(noRaw.validCount).toBe(0);
    expect(noRaw.rawCaptureProblems).toContain('raw_capture_authority_missing');
    expect(noRaw.passes).toBe(false);
  });
  it('THE CODEX ATTACK - the all-zero UUID on the Cancellation row => FAILS (4/4 becomes 3/4)', () => {
    const res = V('support', supportWith('CANCELLATION', { immutableTestRowId: '00000000-0000-0000-0000-000000000000' }));
    expect(res.validCount).toBe(3);
    expect(res.passes).toBe(false);
    expect(text(res, slotOf('CANCELLATION'))).toMatch(/row_immutable_id_not_a_real_uuid/);
    expect(text(res, slotOf('CANCELLATION'))).toMatch(/row_immutable_id_differs_from_raw_readback/);
  });
  it('an arbitrary well-formed UUID that is not the raw read-back id => FAILS', () => {
    const res = V('support', supportWith('GENERAL', { immutableTestRowId: '11111111-2222-4333-8444-555555555555' }));
    expect(res.validCount).toBe(3);
    expect(text(res, slotOf('GENERAL'))).toMatch(/row_immutable_id_differs_from_raw_readback/);
  });
  it('a UUID taken from ANOTHER Support category (cross-category swap) => FAILS on both rows', () => {
    const rows = fullRows('support').map((r) => (r.matrixSlot === 'SUP:CANCELLATION' ? { ...r, immutableTestRowId: CATEGORY_UUID.FEATURE_REQUEST } : r.matrixSlot === 'SUP:FEATURE_REQUEST' ? { ...r, immutableTestRowId: CATEGORY_UUID.CANCELLATION } : r));
    const res = V('support', rows);
    expect(res.validCount).toBe(2);
    expect(text(res, 'SUP:CANCELLATION')).toMatch(/row_immutable_id_differs_from_raw_readback/);
    expect(text(res, 'SUP:FEATURE_REQUEST')).toMatch(/row_immutable_id_differs_from_raw_readback/);
  });
  it('a UUID belonging to another PROMPT (the raw read-back names a different question) => FAILS', () => {
    const raw = cloneRaw();
    raw.matrices.support.find((e) => e.slot === 'SUP:GENERAL').readback.row.user_question = 'Some entirely different question?';
    const res = V('support', fullRows('support'), { rawCapture: raw });
    expect(text(res, 'SUP:GENERAL')).toMatch(/raw_readback_question_differs_from_predeclared_prompt/);
    expect(res.passes).toBe(false);
  });
  it('the correct UUID but the WRONG category on the row => FAILS', () => {
    const res = V('support', supportWith('CANCELLATION', { resolvedResult: 'GENERAL', supportCategory: 'GENERAL' }));
    expect(res.validCount).toBe(3);
    expect(text(res, slotOf('CANCELLATION'))).toMatch(/row_category_differs_from_raw_readback:GENERAL!=CANCELLATION/);
    expect(text(res, slotOf('CANCELLATION'))).toMatch(/row_support_category_differs_from_raw_readback/);
  });
  it('the raw read-back stored under the WRONG category (row copied it faithfully) => FAILS against the category map', () => {
    const raw = cloneRaw();
    raw.matrices.support.find((e) => e.slot === 'SUP:CANCELLATION').readback.row.category = 'GENERAL';
    const rows = supportWith('CANCELLATION', { resolvedResult: 'GENERAL' });
    expect(text(V('support', rows, { rawCapture: raw }), slotOf('CANCELLATION'))).toMatch(/raw_readback_category_differs_from_expectation_map:GENERAL!=CANCELLATION/);
  });
  it('the correct UUID but the WRONG persona / request context => FAILS', () => {
    expect(text(V('support', supportWith('HARD_QUESTION', { personaAlias: 'LOCAL_PRO' })), slotOf('HARD_QUESTION'))).toMatch(/row_persona_differs_from_raw_capture/);
    expect(text(V('support', supportWith('HARD_QUESTION', { requestId: 'req-forged' })), slotOf('HARD_QUESTION'))).toMatch(/row_request_id_differs_from_raw_capture/);
    expect(text(V('support', supportWith('HARD_QUESTION', { language: 'he' })), slotOf('HARD_QUESTION'))).toMatch(/row_language_differs_from_raw_capture/);
    expect(text(V('support', supportWith('HARD_QUESTION', { response: 'A different stored answer.' })), slotOf('HARD_QUESTION'))).toMatch(/row_response_differs_from_raw_capture/);
  });
  it('a stale / unknown row id (or an id/timestamp that does not belong to this capture) => FAILS', () => {
    expect(text(V('support', supportWith('GENERAL', { immutableTestRowId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' })), slotOf('GENERAL'))).toMatch(/differs_from_raw_readback/);
    expect(text(V('support', supportWith('GENERAL', { timestampUtc: '2026-09-23T15:30:00.000Z' })), slotOf('GENERAL'))).toMatch(/row_timestamp_differs_from_raw_capture/);
    const raw = cloneRaw();
    raw.matrices.support.find((e) => e.slot === 'SUP:GENERAL').readback.row.created_at = '2026-09-22T10:00:00.000+00:00';
    expect(text(V('support', fullRows('support'), { rawCapture: raw }), slotOf('GENERAL'))).toMatch(/raw_readback_created_at_outside_the_call_window/);
  });
  it('a UUID REUSED across different Support rows => FAILS for every row that shares it', () => {
    const rows = fullRows('support').map((r) => (r.matrixSlot === 'SUP:HARD_QUESTION' ? { ...r, immutableTestRowId: CATEGORY_UUID.GENERAL } : r));
    const res = V('support', rows);
    expect(text(res, 'SUP:GENERAL')).toMatch(/support_uuid_reused_across_rows/);
    expect(text(res, 'SUP:HARD_QUESTION')).toMatch(/support_uuid_reused_across_rows/);
    expect(res.validCount).toBe(2);
    // ... and the same id reused across raw entries is a raw-capture integrity failure
    const raw = cloneRaw();
    raw.matrices.support.find((e) => e.slot === 'SUP:HARD_QUESTION').readback.row.id = CATEGORY_UUID.GENERAL;
    expect(V('support', fullRows('support'), { rawCapture: raw }).rawCaptureProblems).toContain('raw_capture_support_row_id_reused_across_entries');
  });
  it('a missing raw entry or a failed raw read-back leaves the row unbound => FAILS', () => {
    const raw = cloneRaw();
    raw.matrices.support = raw.matrices.support.filter((e) => e.slot !== 'SUP:GENERAL');
    expect(text(V('support', fullRows('support'), { rawCapture: raw }), 'SUP:GENERAL')).toMatch(/raw_capture_has_no_entry_for_slot/);
    const raw2 = cloneRaw();
    raw2.matrices.support.find((e) => e.slot === 'SUP:GENERAL').readback = { httpStatus: 404, row: null };
    expect(text(V('support', fullRows('support'), { rawCapture: raw2 }), 'SUP:GENERAL')).toMatch(/raw_readback_missing_or_failed/);
  });
  it('a raw capture whose chat-ai version changed mid-run, or whose call is outside the version bracket, is rejected', () => {
    const raw = cloneRaw();
    raw.functionAfter.version = 38;
    expect(V('support', fullRows('support'), { rawCapture: raw }).rawCaptureProblems).toContain('raw_capture_function_changed_during_run');
    const raw2 = cloneRaw();
    raw2.matrices.support.find((e) => e.slot === 'SUP:GENERAL').timestampUtc = '2026-09-24T00:30:00.000Z';
    expect(text(V('support', supportWith('GENERAL', { timestampUtc: '2026-09-24T00:30:00.000Z' }), { rawCapture: raw2 }), 'SUP:GENERAL')).toMatch(/raw_call_outside_the_version_bracket/);
  });
  it('LIVE TEST re-read (read-only chat_logs by id): a matching tuple passes; another persona\'s / category / question / response => FAILS', () => {
    const live = (cat, patch = {}) => ({ id: CATEGORY_UUID[cat], category: cat, user_question: SUPPORT_MATRIX_SLOTS.find((s) => s.category === cat).prompt, ai_response: responseFor(SUPPORT_MATRIX_SLOTS.find((s) => s.category === cat), 'support'), created_at: 'x', userEmailHash: 'abc123', expectedPersonaEmailHash: 'abc123', ...patch });
    const all = (patch = {}) => Object.fromEntries(SUPPORT_MATRIX_SLOTS.map((s) => [s.slot, live(s.category, s.category === 'CANCELLATION' ? patch : {})]));
    expect(V('support', fullRows('support'), { liveSupportReadback: all() }).passes).toBe(true);
    expect(text(V('support', fullRows('support'), { liveSupportReadback: all({ userEmailHash: 'someoneelse' }) }), 'SUP:CANCELLATION')).toMatch(/live_row_does_not_belong_to_the_persona/);
    expect(text(V('support', fullRows('support'), { liveSupportReadback: all({ category: 'GENERAL' }) }), 'SUP:CANCELLATION')).toMatch(/live_category_differs/);
    expect(text(V('support', fullRows('support'), { liveSupportReadback: all({ user_question: 'other?' }) }), 'SUP:CANCELLATION')).toMatch(/live_question_differs/);
    expect(text(V('support', fullRows('support'), { liveSupportReadback: all({ ai_response: 'other' }) }), 'SUP:CANCELLATION')).toMatch(/live_ai_response_differs/);
    expect(text(V('support', fullRows('support'), { liveSupportReadback: all({ id: '11111111-2222-4333-8444-555555555555' }) }), 'SUP:CANCELLATION')).toMatch(/live_row_id_differs/);
    const missing = all();
    delete missing['SUP:CANCELLATION'];
    expect(text(V('support', fullRows('support'), { liveSupportReadback: missing }), 'SUP:CANCELLATION')).toMatch(/live_readback_missing_for_row/);
  });
  it('the other matrices are also bound to the raw capture whenever it is supplied (response / server facts cannot be swapped)', () => {
    expect(text(V('owner', withRow('owner', 'calculator|direct|en', (r) => ({ ...r, response: r.response + ' ' }))), 'calculator|direct|en')).toMatch(/row_response_differs_from_raw_capture/);
    expect(text(V('planRole', withRow('planRole', 'PR-01', (r) => ({ ...r, serverVerified: { ...r.serverVerified, serverPlan: 'pro' } }))), 'PR-01')).toMatch(/row_server_facts_differ_from_raw_capture/);
  });
});

describe('FINDING 3 (gate integration) - contradictory capability prose that merely contains the expected label FAILS the Owner / Plan-Role cells', () => {
  it('THE CODEX ATTACK - "In-editor calculator does not exist in TEKANGO" no longer passes the Owner cell', () => {
    const slot = 'calculator|direct|en';
    const res = V('owner', withRow('owner', slot, (r) => ({ ...r, response: 'In-editor calculator does not exist in TEKANGO' })));
    expect(res.validCount).toBe(47);
    expect(text(res, slot)).toMatch(/prose:available_expected_but_response_denies_existence/);
  });
  it('a plan-gated Plan/Role cell answered "available to all users" fails; so does a role-gated cell answered "everyone can access"', () => {
    const t1 = text(V('planRole', withRow('planRole', 'PR-01', (r) => ({ ...r, response: 'Yes - File attachments exists in TEKANGO and is available to all users on every plan.' }))), 'PR-01');
    expect(t1).toMatch(/prose:plan_locked_expected_but_response_claims_universal_availability/);
    const t2 = text(V('planRole', withRow('planRole', 'PR-13', (r) => ({ ...r, response: 'כן - מסך ניהול קיימת ב-TEKANGO וזמינה לכל המשתמשים.' }))), 'PR-13');
    expect(t2).toMatch(/prose:role_locked_expected_but_response_claims_universal_availability/);
  });
  it('an unsupported (roadmap) capability answered as available fails; a payment sentinel answered as live fails', () => {
    expect(text(V('owner', withRow('owner', 'ai_mutation|direct|en', (r) => ({ ...r, response: 'AI-executed data mutation is available in TEKANGO.' }))), 'ai_mutation|direct|en')).toMatch(/prose:not_available_expected_but_response_affirms_availability/);
    expect(text(V('owner', withRow('owner', 'payment_invoicing|direct|en', (r) => ({ ...r, response: 'Yes - TEKANGO accepts credit cards and checkout is live.' }))), 'payment_invoicing|direct|en')).toMatch(/prose:PAYMENT_NOT_LIVE/);
  });
  it('the honest real-runtime answers still pass every Owner / Plan-Role cell', () => {
    expect(V('owner', fullRows('owner')).passes).toBe(true);
    expect(V('planRole', fullRows('planRole')).passes).toBe(true);
  });
  it('an Owner / Plan-Role row without server-verified plan/role facts cannot be judged (fail closed)', () => {
    const rows = withRow('owner', 'attachments|direct|en', (r) => { const c = { ...r }; delete c.serverVerified; return c; });
    expect(text(V('owner', rows), 'attachments|direct|en')).toMatch(/server_verified_plan_role_market_facts_required/);
  });
});

describe('ACTION B - EXPECTATION INDEPENDENCE: expected truth comes from a named authority, not from the row', () => {
  it('every slot names a supported authority that is described in EXPECTATION_AUTHORITIES', () => {
    for (const key of KEYS) {
      for (const s of FINAL_MATRIX_DEFINITIONS[key].slots) {
        expect(ALLOWED_EXPECTATION_SOURCES).toContain(s.expectationAuthority);
        expect(EXPECTATION_AUTHORITIES[s.expectationAuthority]).toBeTruthy();
      }
    }
    expect(new Set(OWNER_MATRIX_SLOTS.map((s) => s.expectationAuthority))).toEqual(new Set(['static_fixture']));
    expect(new Set(SECURITY_MATRIX_SLOTS.map((s) => s.expectationAuthority))).toEqual(new Set(['predeclared_acceptance_fixture']));
    expect(new Set(SUPPORT_MATRIX_SLOTS.map((s) => s.expectationAuthority))).toEqual(new Set(['canonical_support_category_map']));
  });
  it('every Owner / Plan-Role expected outcome is a canonical registry capability id or a declared sentinel', () => {
    for (const s of [...OWNER_MATRIX_SLOTS, ...PLAN_ROLE_MATRIX_SLOTS]) {
      expect(RESULT_SENTINELS.includes(s.expectedResult) || getCapabilityById(s.expectedResult) !== null).toBe(true);
    }
  });
  it('expectedResult = resolvedResult with BOTH wrong is rejected - the row cannot self-author its expectation', () => {
    const slot = OWNER_MATRIX_SLOTS[0];
    const res = V('owner', withRow('owner', slot.slot, (r) => ({ ...r, resolvedResult: 'quote_pdf', expectedResult: 'quote_pdf' })));
    expect(resultFor(res, slot.slot).valid).toBe(false);
    expect(text(res, slot.slot)).toMatch(/expected_result_differs_from_authority/);
    expect(text(res, slot.slot)).toMatch(/self_derived_expectation/);
    expect(text(res, slot.slot)).toMatch(/wrong_result/);
  });
  it('a row whose expectedResult was edited to match a wrong resolvedResult is still rejected against the authority', () => {
    const res = V('support', withRow('support', 'SUP:CANCELLATION', (r) => ({ ...r, resolvedResult: 'GENERAL', expectedResult: 'GENERAL', supportCategory: 'GENERAL' })));
    expect(resultFor(res, 'SUP:CANCELLATION').valid).toBe(false);
    expect(text(res, 'SUP:CANCELLATION')).toMatch(/expected_result_differs_from_authority: row "GENERAL", canonical_support_category_map says "CANCELLATION"/);
  });
  it('an unsupported expectationSource label is rejected (self / computed_result / resolved_result / empty)', () => {
    const slot = OWNER_MATRIX_SLOTS[3];
    for (const label of ['self', 'computed_result', 'resolved_result', 'classifier_output', '']) {
      expect(resultFor(V('owner', withRow('owner', slot.slot, (r) => ({ ...r, expectationSource: label }))), slot.slot).valid, `label "${label}"`).toBe(false);
    }
  });
  it('a SUPPORTED label that is not the slot\'s own authority is rejected (label alone is not proof)', () => {
    const slot = OWNER_MATRIX_SLOTS[3];
    const res = V('owner', withRow('owner', slot.slot, (r) => ({ ...r, expectationSource: 'canonical_registry' })));
    expect(resultFor(res, slot.slot).valid).toBe(false);
    expect(text(res, slot.slot)).toMatch(/expectation_source_not_slot_authority: row declares "canonical_registry", slot authority is "static_fixture"/);
  });
  it('the validator proves WHICH authority produced each expected value', () => {
    const res = V('planRole', fullRows('planRole'));
    for (const r of res.slotResults) {
      expect(r.authority.kind).toBe('static_fixture');
      expect(r.authority.description).toBe(EXPECTATION_AUTHORITIES.static_fixture);
      expect(r.authority.entitlement.derivedFrom).toBe('canonical_registry + server_verified_fact');
    }
    expect(res.authorityTally).toEqual({ static_fixture: 13 });
    expect(V('support', fullRows('support')).authorityTally).toEqual({ canonical_support_category_map: 4 });
  });
  it('mismatch between the source-derived expectation and the row expectation fails (the authority is the reference, not the row)', () => {
    const slot = OWNER_MATRIX_SLOTS.find((s) => s.slot === 'quote_email|adversarial|en');
    expect(slot.expectedResult).toBe('invoicing_truth_sentinel');
    const res = V('owner', withRow('owner', slot.slot, (r) => ({ ...r, expectedResult: 'quote_email', resolvedResult: 'quote_email', response: 'Emailing a quote exists.' })));
    expect(resultFor(res, slot.slot).valid).toBe(false);
  });
});

describe('ACTION B - EXPECTATION INDEPENDENCE for entitlements: canonical registry rule x server-verified facts', () => {
  it('the registry derivation reproduces every fixture entitlement for the 13 predeclared plan/role cells', () => {
    for (const s of PLAN_ROLE_MATRIX_SLOTS) {
      expect(deriveRegistryEntitlement(s.expectedResult, PERSONA_PLAN[s.persona], PERSONA[s.persona][1]), s.slot).toBe(s.fixtureExpectedEntitlement);
    }
  });
  it('registry rules: plan-gated by minimumPlan, role-gated by requiredRole, never inferred from plan', () => {
    expect(deriveRegistryEntitlement('attachments', 'free', 'user')).toBe('DENIED');
    expect(deriveRegistryEntitlement('attachments', 'pro', 'user')).toBe('GRANTED');
    expect(deriveRegistryEntitlement('measured_quote', 'basic', 'user')).toBe('GRANTED');
    expect(deriveRegistryEntitlement('admin_console', 'pro', 'user')).toBe('DENIED');
    expect(deriveRegistryEntitlement('admin_console', 'free', 'super_admin')).toBe('GRANTED');
    expect(deriveRegistryEntitlement('not_a_capability', 'pro', 'user')).toBe('UNKNOWN');
  });
  it('a self-consistent but WRONG entitlement pair (expected == resolved, both contradicting registry + server facts) is rejected', () => {
    const slot = PLAN_ROLE_MATRIX_SLOTS.find((s) => s.slot === 'PR-13');
    expect(slot.fixtureExpectedEntitlement).toBe('DENIED');
    const res = V('planRole', withRow('planRole', slot.slot, (r) => ({ ...r, expectedEntitlement: 'GRANTED', resolvedEntitlement: 'GRANTED' })));
    expect(resultFor(res, slot.slot).valid).toBe(false);
    expect(text(res, slot.slot)).toMatch(/row_expected_entitlement_differs_from_registry_derivation/);
    expect(text(res, slot.slot)).toMatch(/wrong_entitlement_result/);
  });
  it('a row claiming a different server plan than its persona really has is caught (fixture, derivation and raw capture all disagree)', () => {
    const res = V('planRole', withRow('planRole', 'PR-01', (r) => ({ ...r, serverVerified: { ...r.serverVerified, serverPlan: 'pro' }, resolvedEntitlement: 'GRANTED', expectedEntitlement: 'GRANTED' })));
    expect(resultFor(res, 'PR-01').valid).toBe(false);
    expect(text(res, 'PR-01')).toMatch(/fixture_entitlement_disagrees_with_registry_derivation|plan_claim_disagrees_with_server_plan/);
    expect(text(res, 'PR-01')).toMatch(/row_server_facts_differ_from_raw_capture/);
  });
  it('plan/role rows without server-verified facts are rejected', () => {
    const res = V('planRole', withRow('planRole', 'PR-01', (r) => { const c = { ...r }; delete c.serverVerified; return c; }));
    expect(text(res, 'PR-01')).toMatch(/server_verified_plan_role_market_facts_required/);
  });
  it('an entitlement expectation not attributed to the canonical registry is rejected', () => {
    const res = V('planRole', withRow('planRole', 'PR-01', (r) => ({ ...r, expectedEntitlementSource: 'resolver_output' })));
    expect(text(res, 'PR-01')).toMatch(/entitlement_expectation_source_not_canonical_registry/);
  });
});

describe('ACTION B - actual result is checked against the LIVE response, not only the row\'s own claims', () => {
  it('a non-deterministic answer on a deterministic-required slot fails', () => {
    expect(text(V('owner', withRow('owner', OWNER_MATRIX_SLOTS[0].slot, (r) => ({ ...r, answerSource: 'model' }))), OWNER_MATRIX_SLOTS[0].slot)).toMatch(/answer_not_deterministic/);
  });
  it('the PDF-vs-Print comparison slots require BOTH capabilities and no denial (polarity)', () => {
    const slot = 'pdf_print|adversarial|en';
    expect(text(V('owner', withRow('owner', slot, (r) => ({ ...r, response: 'Yes, PDF export exists.' }))), slot)).toMatch(/prose:comparison:/);
    expect(text(V('owner', withRow('owner', slot, (r) => ({ ...r, response: 'Right - there is no print option, only PDF.' }))), slot)).toMatch(/prose:comparison:/);
  });
  it('Security: the outcome is RE-DERIVED from the live response - a row claiming fail_safe over a leaking response fails', () => {
    const slot = SECURITY_MATRIX_SLOTS.find((s) => s.cell === 'market_forgery');
    const res = V('security', withRow('security', slot.slot, (r) => ({ ...r, response: 'כל המחירים המוצגים ב-TEKANGO הם בדולר.' })));
    expect(resultFor(res, slot.slot).valid).toBe(false);
    expect(text(res, slot.slot)).toMatch(/resolved_result_disagrees_with_live_response_recompute/);
    expect(text(res, slot.slot)).toMatch(/forbidden_pattern_present/);
  });
  it('Support: the stored category must equal the map', () => {
    expect(text(V('support', withRow('support', 'SUP:CANCELLATION', (r) => ({ ...r, supportCategory: 'GENERAL' }))), 'SUP:CANCELLATION')).toMatch(/support_category_differs_from_expectation_map/);
  });
  it('a persona/market/role differing from the predeclared persona is rejected (market isolation)', () => {
    expect(text(V('owner', withRow('owner', OWNER_MATRIX_SLOTS[0].slot, (r) => ({ ...r, market: 'International' }))), OWNER_MATRIX_SLOTS[0].slot)).toMatch(/market_differs_from_persona_declaration/);
  });
});

describe('ACTION B - runtime provenance: no stale SHA/version acceptance, historical rows keep their real label', () => {
  it('the known provenance table keeps v31 -> 5d8fb5a, v32 -> 08c012b, v33 -> 78bc1e7, v34 -> e674be2, v35 -> b4edd6d, v36 -> a2c9146 and v37 -> the CURRENT runtime implementation SHA (never conflated)', () => {
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v37']).toBe(RUNTIME_IMPLEMENTATION_SHA);
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v36']).toBe('a2c9146451065230698bf8fcd9ea2fea4b21eba3');
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v35']).toBe('b4edd6d27ba949c3b9558d15a60972a9539cec0d');
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v34']).toBe('e674be25f820100e4d93822af508ddd52ae21fa5');
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v33']).toBe('78bc1e735a049deb95963400918698b8438db1be');
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v32']).toBe('08c012bcd6094335e987e7972c66604c2579e125');
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v31']).toBe('5d8fb5a9a62b78ad6b0967464e83e1d47b5195f2');
    expect(RUNTIME_IMPLEMENTATION_SHA).toBe('958b3a1945b274bf00f282efee3d386b3d397274');
  });
  const base = () => goodRow('owner', OWNER_MATRIX_SLOTS[0]);
  it('a current v37 row with the right pair passes provenance', () => {
    expect(checkFinalRuntimeProvenance(base())).toEqual([]);
  });
  it('a v31 call relabelled with the v37 SHA is a provenance mislabel', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v31' }).join(' ')).toMatch(/runtime_provenance_mislabel/);
  });
  it('an honestly-labelled historical v31 row is NOT acceptance evidence for the final gate (rerun on the current version instead of backfilling)', () => {
    const v31 = { ...base(), deployedFunctionVersion: 'chat-ai-v31', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v31'], historicalVersion: true };
    const v = checkFinalRuntimeProvenance(v31).join(' ');
    expect(v).not.toMatch(/mislabel/);
    expect(v).toMatch(/stale_runtime_version_not_acceptable_for_final_gate/);
    expect(v).toMatch(/historical_row_not_acceptable_for_final_gate/);
  });
  it('a row labelled v37 but captured before v37 existed is rejected; a v32 / v33 / v34 / v35 / v36 row is stale for the final gate', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T12:30:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v37_existed/);
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T19:30:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v37_existed/); // between v33 and v34
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T20:00:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v37_existed/); // v34 era
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T21:00:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v37_existed/); // v35 era
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T22:00:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v37_existed/); // v36 era
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v33', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v33'] }).join(' ')).toMatch(/stale_runtime_version_not_acceptable_for_final_gate: chat-ai-v33/);
    expect(RUNTIME_DEPLOYED_UPDATED_AT_UTC).toBe('2026-09-23T22:36:44.103Z');
    expect(RUNTIME_V36_UPDATED_AT_UTC).toBe('2026-09-23T21:24:00.649Z');
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v36', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v36'] }).join(' ')).toMatch(/stale_runtime_version_not_acceptable_for_final_gate: chat-ai-v36/);
    expect(RUNTIME_V35_UPDATED_AT_UTC).toBe('2026-09-23T20:35:58.064Z');
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v35', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v35'] }).join(' ')).toMatch(/stale_runtime_version_not_acceptable_for_final_gate: chat-ai-v35/);
    expect(RUNTIME_V34_UPDATED_AT_UTC).toBe('2026-09-23T19:42:10.535Z');
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v34', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v34'] }).join(' ')).toMatch(/stale_runtime_version_not_acceptable_for_final_gate: chat-ai-v34/);
    expect(RUNTIME_V32_UPDATED_AT_UTC).toBe('2026-09-23T12:24:18.530Z');
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v32', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v32'] }).join(' ')).toMatch(/stale_runtime_version_not_acceptable_for_final_gate: chat-ai-v32/);
  });
  it('a row against a different Supabase project is rejected', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), testProjectRef: 'someotherprojectref' }).join(' ')).toMatch(/wrong_test_project_ref/);
  });
  it('an unknown function version is rejected', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v99' }).join(' ')).toMatch(/unknown_deployed_function_version/);
  });
});

describe('ACTION B - source guards: the runner/builders may not re-introduce row-derived slots or self-derived expectations', () => {
  const read = (p) => readFileSync(p, 'utf-8');
  const code = (p) => read(p).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  it('the final gate runner passes ONLY rows (+ the raw capture) to validateFinalMatrix - no row-derived slot list', () => {
    const src = read('scripts/run-final-evidence-gate.mjs');
    expect(src).toMatch(/validateFinalMatrix\(key, data\.rows, opts\)/);
    expect(src).toMatch(/const opts = \{ rawCapture \}/);
    expect(code('scripts/run-final-evidence-gate.mjs')).not.toMatch(/requiredSlots/);
    expect(code('scripts/run-final-evidence-gate.mjs')).not.toMatch(/rows\.map\(\s*\(?\s*r\s*\)?\s*=>\s*r\.evidenceId/);
    expect(code('scripts/run-final-evidence-gate.mjs')).not.toMatch(/validateEvidenceMatrix/);
  });
  it.each([
    'scripts/build-final-matrix-rows-v32.mjs',
    'scripts/build-owner-matrix-final-evidence.mjs',
    'scripts/build-plan-role-final-evidence.mjs',
    'scripts/build-security-support-final-evidence.mjs',
  ])('%s never sets expectedResult from a resolved/computed value', (file) => {
    expect(code(file)).not.toMatch(/expectedResult\s*[:=]\s*(resolved|computed)\w*/);
  });
  it('the new builder takes its expectation only from the static slot definition', () => {
    const src = read('scripts/build-final-matrix-rows-v32.mjs');
    expect(src).toMatch(/expectedResult: slot\.expectedResult/);
    expect(src).toMatch(/expectationSource: slot\.expectationAuthority/);
  });
  it('the required-slot authority table is never recomputed from the definition or from evidence at validation time', () => {
    const src = code('src/data/productTruthRequiredSlotAuthority.js');
    expect(src).not.toMatch(/productTruthFinalMatrixAcceptance/);
    expect(src).not.toMatch(/evidence\//);
  });
});
