// PRODUCT TRUTH FINAL THREE-ACTION DELTA - Action B tests (Codex "PRODUCT TRUTH FINAL RE-REVIEW: FAIL"):
//   INDEPENDENT REQUIRED SLOT SETS  - a missing evidence row must still leave its required slot standing (=> failure);
//                                     an extra evidence row must never create a new requirement.
//   EXPECTATION INDEPENDENCE        - the expected value is resolved from a named independent authority, never from the
//                                     evidence row; expectedResult = resolvedResult (or any self-derivation) fails;
//                                     unsupported / mismatching expectation-source labels fail.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EXPECTATION_AUTHORITIES, EXPECTED_MATRIX_SIZES, FINAL_MATRIX_DEFINITIONS, KNOWN_RUNTIME_PROVENANCE, MATRIX_LANGUAGES, OWNER_AREAS, OWNER_MATRIX_SLOTS,
  OWNER_PHRASINGS, OWNER_SUBTOPIC_ALLOCATION, PLAN_ROLE_MATRIX_SLOTS, RESULT_SENTINELS, RUNTIME_DEPLOYED_VERSION, RUNTIME_IMPLEMENTATION_SHA,
  RUNTIME_V32_UPDATED_AT_UTC, SECURITY_MATRIX_SLOTS, SUPPORT_MATRIX_SLOTS, SUPPORT_REQUIRED_CATEGORIES, TEST_PROJECT_REF,
} from './productTruthFinalMatrixAcceptance.js';
import { OWNER_MATRIX_EXPECTED_FIXTURE } from './productTruthOwnerMatrixExpectedFixture.js';
import { PLAN_ROLE_EXPECTED_FIXTURE } from './productTruthPlanRoleExpectedFixture.js';
import { getCapabilityById } from './productTruthRegistry.js';
import {
  ALLOWED_EXPECTATION_SOURCES, checkFinalMatrixDefinitionIntegrity, checkFinalRuntimeProvenance, deriveRegistryEntitlement, validateFinalMatrix,
} from './productTruthEvidenceSchema.js';

const PERSONA_PLAN = { LOCAL_PRO: 'pro', LOCAL_BASIC: 'basic', LOCAL_ADMIN: 'pro', INTL_PRO: 'pro', INTL_BASIC: 'basic', INTL_FREE: 'free', PERSONA_SUPER_ADMIN: 'free' };
const PERSONA = {
  LOCAL_PRO: ['Local', 'user'], LOCAL_BASIC: ['Local', 'user'], LOCAL_ADMIN: ['Local', 'super_admin'], INTL_PRO: ['International', 'user'],
  INTL_BASIC: ['International', 'user'], INTL_FREE: ['International', 'user'], PERSONA_SUPER_ADMIN: ['Local', 'super_admin'],
};
const SENTINEL_TEXT = {
  payment_truth_sentinel: { he: 'כרגע אין ב-TEKANGO סליקה או קבלת תשלומים אונליין.', en: 'Right now TEKANGO has no live checkout or payment.' },
  invoicing_truth_sentinel: { he: 'כרגע TEKANGO לא מפיקה חשבוניות.', en: 'Right now TEKANGO does not issue invoices.' },
  quote_pdf_vs_print_comparison: { he: 'PDF והדפסה הן שתי פעולות שונות.', en: 'PDF and print are two different actions.' },
};
const AFTER_V32 = '2026-09-23T15:00:00.000Z';

function responseFor(slot) {
  if (RESULT_SENTINELS.includes(slot.expectedResult)) return SENTINEL_TEXT[slot.expectedResult][slot.language];
  const cap = getCapabilityById(slot.expectedResult);
  if (cap) return `${slot.language === 'he' ? cap.heLabel : cap.enLabel} exists.`;
  return 'I cannot help with that request for another account.'; // security / support model answers
}

/** A fully valid row for a slot - built ONLY from the static definition (what a genuine capture would look like). */
function goodRow(key, slot, i = 0) {
  const [market, role] = PERSONA[slot.persona];
  const row = {
    evidenceId: `${key}-${slot.slot}-${i}`,
    matrixSlot: slot.slot,
    timestampUtc: AFTER_V32,
    personaAlias: slot.persona,
    market,
    plan: PERSONA_PLAN[slot.persona].toUpperCase(),
    role,
    language: slot.language,
    prompt: slot.prompt,
    response: responseFor(slot),
    answerSource: slot.requiresDeterministicAnswer ? 'deterministic' : 'model',
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
  if (key === 'support') row.immutableTestRowId = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  if (key === 'planRole') {
    row.expectedEntitlement = slot.fixtureExpectedEntitlement;
    row.resolvedEntitlement = slot.fixtureExpectedEntitlement;
    row.expectedEntitlementSource = 'canonical_registry';
    row.serverVerified = { http: 200, serverPlan: PERSONA_PLAN[slot.persona], serverRole: role, serverMarket: market };
  }
  return row;
}
const fullRows = (key) => FINAL_MATRIX_DEFINITIONS[key].slots.map((s, i) => goodRow(key, s, i));
const KEYS = ['owner', 'planRole', 'security', 'support'];
const withRow = (key, slotId, mutate) => fullRows(key).map((r) => (r.matrixSlot === slotId ? mutate({ ...r }) : r));
const resultFor = (res, slotId) => res.slotResults.find((r) => r.slot === slotId);

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
  });
});

describe('ACTION B - a complete, correct evidence set is VALID for every required slot', () => {
  it.each(KEYS)('%s: all required slots valid, gate passes', (key) => {
    const res = validateFinalMatrix(key, fullRows(key));
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.passes).toBe(true);
  });
});

describe('ACTION B - INDEPENDENT REQUIRED SLOTS: a missing row cannot disappear from both evidence and requirement', () => {
  it.each(KEYS)('%s: zero rows => every required slot MISSING, 0 valid, requirement unchanged', (key) => {
    const res = validateFinalMatrix(key, []);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(0);
    expect(res.missingSlots).toHaveLength(EXPECTED_MATRIX_SIZES[key]);
    expect(res.passes).toBe(false);
  });
  it.each(KEYS)('%s: dropping ONE evidence row => that slot MISSING, validCount n-1, total unchanged, gate fails', (key) => {
    const rows = fullRows(key);
    const dropped = rows.pop();
    const res = validateFinalMatrix(key, rows);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key] - 1);
    expect(res.missingSlots).toEqual([dropped.matrixSlot]);
    expect(resultFor(res, dropped.matrixSlot).status).toBe('MISSING');
    expect(res.passes).toBe(false);
  });
  it.each(KEYS)('%s: an EXTRA evidence row creates no new requirement (total unchanged) and is reported, not accepted', (key) => {
    const rows = [...fullRows(key), { ...goodRow(key, FINAL_MATRIX_DEFINITIONS[key].slots[0], 999), evidenceId: 'extra-row', matrixSlot: 'NOT-A-REQUIRED-SLOT' }];
    const res = validateFinalMatrix(key, rows);
    expect(res.totalRequired).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.validCount).toBe(EXPECTED_MATRIX_SIZES[key]);
    expect(res.unknownSlots).toEqual([{ evidenceId: 'extra-row', claimedSlot: 'NOT-A-REQUIRED-SLOT' }]);
    expect(res.passes).toBe(false);
  });
  it('a row with no matrixSlot at all is unknown - it can neither fill nor create a slot', () => {
    const rows = fullRows('security');
    const stray = { ...rows.pop() };
    delete stray.matrixSlot;
    const res = validateFinalMatrix('security', [...rows, stray]);
    expect(res.missingSlots).toHaveLength(1);
    expect(res.unknownSlots).toHaveLength(1);
    expect(res.validCount).toBe(8);
  });
  it('a duplicated slot never counts, even though each copy is individually correct', () => {
    const rows = fullRows('owner');
    const res = validateFinalMatrix('owner', [...rows, { ...rows[5], evidenceId: 'dup-of-5' }]);
    expect(res.duplicateSlots).toEqual([rows[5].matrixSlot]);
    expect(res.validCount).toBe(47);
    expect(res.passes).toBe(false);
  });
  it('a definition edited shorter (a self-servingly smaller "complete") is rejected, not silently accepted', () => {
    const shorter = { name: 'OWNER MATRIX', slots: OWNER_MATRIX_SLOTS.slice(0, 47) };
    const res = validateFinalMatrix('owner', fullRows('owner'), { definition: shorter });
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
    const stolen = withRow('owner', a.slot, (r) => ({ ...r, prompt: b.prompt }));
    expect(resultFor(validateFinalMatrix('owner', stolen), a.slot).violations.join(' ')).toMatch(/prompt_differs_from_predeclared_slot_prompt/);
    const wrongLang = withRow('owner', a.slot, (r) => ({ ...r, language: r.language === 'he' ? 'en' : 'he' }));
    expect(resultFor(validateFinalMatrix('owner', wrongLang), a.slot).violations.join(' ')).toMatch(/language_differs_from_slot/);
    const wrongPersona = withRow('owner', a.slot, (r) => ({ ...r, personaAlias: 'INTL_FREE' }));
    expect(resultFor(validateFinalMatrix('owner', wrongPersona), a.slot).violations.join(' ')).toMatch(/persona_differs_from_slot/);
    const noSub = withRow('owner', a.slot, (r) => { const c = { ...r }; delete c.matrixSubtopic; return c; });
    expect(resultFor(validateFinalMatrix('owner', noSub), a.slot).violations.join(' ')).toMatch(/subtopic_allocation_not_preserved/);
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
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, resolvedResult: 'quote_pdf', expectedResult: 'quote_pdf' }));
    const v = resultFor(validateFinalMatrix('owner', rows), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/expected_result_differs_from_authority/);
    expect(v.violations.join(' ')).toMatch(/self_derived_expectation/);
    expect(v.violations.join(' ')).toMatch(/wrong_result/);
  });
  it('a row whose expectedResult was edited to match a wrong resolvedResult is still rejected against the authority', () => {
    const slot = SUPPORT_MATRIX_SLOTS.find((s) => s.category === 'CANCELLATION');
    const rows = withRow('support', slot.slot, (r) => ({ ...r, resolvedResult: 'GENERAL', expectedResult: 'GENERAL', supportCategory: 'GENERAL' }));
    const v = resultFor(validateFinalMatrix('support', rows), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/expected_result_differs_from_authority: row "GENERAL", canonical_support_category_map says "CANCELLATION"/);
  });
  it('an unsupported expectationSource label is rejected (self / computed_result / resolved_result / empty)', () => {
    const slot = OWNER_MATRIX_SLOTS[3];
    for (const label of ['self', 'computed_result', 'resolved_result', 'classifier_output', '']) {
      const v = resultFor(validateFinalMatrix('owner', withRow('owner', slot.slot, (r) => ({ ...r, expectationSource: label }))), slot.slot);
      expect(v.valid, `label "${label}"`).toBe(false);
    }
  });
  it('a SUPPORTED label that is not the slot\'s own authority is rejected (label alone is not proof)', () => {
    const slot = OWNER_MATRIX_SLOTS[3];
    const v = resultFor(validateFinalMatrix('owner', withRow('owner', slot.slot, (r) => ({ ...r, expectationSource: 'canonical_registry' }))), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/expectation_source_not_slot_authority: row declares "canonical_registry", slot authority is "static_fixture"/);
  });
  it('the validator proves WHICH authority produced each expected value', () => {
    const res = validateFinalMatrix('planRole', fullRows('planRole'));
    for (const r of res.slotResults) {
      expect(r.authority.kind).toBe('static_fixture');
      expect(r.authority.description).toBe(EXPECTATION_AUTHORITIES.static_fixture);
      expect(r.authority.entitlement.derivedFrom).toBe('canonical_registry + server_verified_fact');
    }
    expect(res.authorityTally).toEqual({ static_fixture: 13 });
    expect(validateFinalMatrix('support', fullRows('support')).authorityTally).toEqual({ canonical_support_category_map: 4 });
  });
  it('mismatch between the source-derived expectation and the row expectation fails (the authority is the reference, not the row)', () => {
    const slot = OWNER_MATRIX_SLOTS.find((s) => s.slot === 'quote_email|adversarial|en');
    expect(slot.expectedResult).toBe('invoicing_truth_sentinel');
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, expectedResult: 'quote_email', resolvedResult: 'quote_email', response: 'Emailing a quote exists.' }));
    expect(resultFor(validateFinalMatrix('owner', rows), slot.slot).valid).toBe(false);
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
    const slot = PLAN_ROLE_MATRIX_SLOTS.find((s) => s.slot === 'PR-13'); // ordinary user forging super_admin -> DENIED
    expect(slot.fixtureExpectedEntitlement).toBe('DENIED');
    const rows = withRow('planRole', slot.slot, (r) => ({ ...r, expectedEntitlement: 'GRANTED', resolvedEntitlement: 'GRANTED' }));
    const v = resultFor(validateFinalMatrix('planRole', rows), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/row_expected_entitlement_differs_from_registry_derivation/);
    expect(v.violations.join(' ')).toMatch(/wrong_entitlement_result/);
  });
  it('a row claiming a different server plan than its persona really has is caught through the registry derivation', () => {
    const slot = PLAN_ROLE_MATRIX_SLOTS.find((s) => s.slot === 'PR-01'); // INTL_FREE + attachments -> DENIED
    const rows = withRow('planRole', slot.slot, (r) => ({ ...r, serverVerified: { ...r.serverVerified, serverPlan: 'pro' }, resolvedEntitlement: 'GRANTED', expectedEntitlement: 'GRANTED' }));
    const v = resultFor(validateFinalMatrix('planRole', rows), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/fixture_entitlement_disagrees_with_registry_derivation|plan_claim_disagrees_with_server_plan/);
  });
  it('plan/role rows without server-verified facts are rejected', () => {
    const slot = PLAN_ROLE_MATRIX_SLOTS[0];
    const rows = withRow('planRole', slot.slot, (r) => { const c = { ...r }; delete c.serverVerified; return c; });
    expect(resultFor(validateFinalMatrix('planRole', rows), slot.slot).violations.join(' ')).toMatch(/server_verified_plan_role_market_facts_required/);
  });
  it('an entitlement expectation not attributed to the canonical registry is rejected', () => {
    const slot = PLAN_ROLE_MATRIX_SLOTS[0];
    const rows = withRow('planRole', slot.slot, (r) => ({ ...r, expectedEntitlementSource: 'resolver_output' }));
    expect(resultFor(validateFinalMatrix('planRole', rows), slot.slot).violations.join(' ')).toMatch(/entitlement_expectation_source_not_canonical_registry/);
  });
});

describe('ACTION B - actual result is checked against the LIVE response, not only the row\'s own claims', () => {
  it('Owner/Plan-Role: a response that never names the expected capability fails even if the row claims the right result', () => {
    const slot = OWNER_MATRIX_SLOTS[0];
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, response: 'Sorry, I cannot help with that.' }));
    expect(resultFor(validateFinalMatrix('owner', rows), slot.slot).violations.join(' ')).toMatch(/live_response_does_not_name_expected_capability:editor_calculator/);
  });
  it('the PDF-vs-Print comparison slots require BOTH capabilities in the live answer', () => {
    const slot = OWNER_MATRIX_SLOTS.find((s) => s.slot === 'pdf_print|adversarial|en');
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, response: 'Yes, PDF export exists.' }));
    expect(resultFor(validateFinalMatrix('owner', rows), slot.slot).violations.join(' ')).toMatch(/live_response_missing_sentinel_evidence:quote_pdf_vs_print_comparison/);
  });
  it('a non-deterministic answer on a deterministic-required slot fails', () => {
    const slot = OWNER_MATRIX_SLOTS[0];
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, answerSource: 'model' }));
    expect(resultFor(validateFinalMatrix('owner', rows), slot.slot).violations.join(' ')).toMatch(/answer_not_deterministic/);
  });
  it('Security: the outcome is RE-DERIVED from the live response - a row claiming fail_safe over a leaking response fails', () => {
    const slot = SECURITY_MATRIX_SLOTS.find((s) => s.cell === 'market_forgery');
    const rows = withRow('security', slot.slot, (r) => ({ ...r, response: 'כל המחירים המוצגים ב-TEKANGO הם בדולר.' }));
    const v = resultFor(validateFinalMatrix('security', rows), slot.slot);
    expect(v.valid).toBe(false);
    expect(v.violations.join(' ')).toMatch(/resolved_result_disagrees_with_live_response_recompute/);
    expect(v.violations.join(' ')).toMatch(/forbidden_pattern_present/);
  });
  it('Support: the stored category must equal the map, and the row must be joinable to a real chat_logs row', () => {
    const slot = SUPPORT_MATRIX_SLOTS[1];
    const cat = resultFor(validateFinalMatrix('support', withRow('support', slot.slot, (r) => ({ ...r, supportCategory: 'GENERAL' }))), slot.slot);
    expect(cat.violations.join(' ')).toMatch(/support_category_differs_from_expectation_map/);
    const unjoinable = withRow('support', slot.slot, (r) => { const c = { ...r }; delete c.immutableTestRowId; return c; });
    expect(resultFor(validateFinalMatrix('support', unjoinable), slot.slot).violations.join(' ')).toMatch(/unjoinable_test_row_missing_immutable_id|support_row_not_joinable/);
  });
  it('a persona/market/role differing from the predeclared persona is rejected (market isolation)', () => {
    const slot = OWNER_MATRIX_SLOTS[0]; // LOCAL_PRO / he
    const rows = withRow('owner', slot.slot, (r) => ({ ...r, market: 'International' }));
    expect(resultFor(validateFinalMatrix('owner', rows), slot.slot).violations.join(' ')).toMatch(/market_differs_from_persona_declaration/);
  });
});

describe('ACTION B - runtime provenance: no stale SHA/version acceptance, historical rows keep their real label', () => {
  it('the known provenance table keeps v31 -> 5d8fb5a and v32 -> the runtime implementation SHA (never conflated)', () => {
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v32']).toBe(RUNTIME_IMPLEMENTATION_SHA);
    expect(KNOWN_RUNTIME_PROVENANCE['chat-ai-v31']).toBe('5d8fb5a9a62b78ad6b0967464e83e1d47b5195f2');
    expect(RUNTIME_IMPLEMENTATION_SHA).toBe('08c012bcd6094335e987e7972c66604c2579e125');
  });
  const base = () => goodRow('owner', OWNER_MATRIX_SLOTS[0]);
  it('a current v32 row with the right pair passes provenance', () => {
    expect(checkFinalRuntimeProvenance(base())).toEqual([]);
  });
  it('a v31 call relabelled with the v32 SHA is a provenance mislabel', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), deployedFunctionVersion: 'chat-ai-v31' }).join(' ')).toMatch(/runtime_provenance_mislabel/);
  });
  it('an honestly-labelled historical v31 row is NOT acceptance evidence for the final gate (rerun on v32 instead of backfilling)', () => {
    const v31 = { ...base(), deployedFunctionVersion: 'chat-ai-v31', implementationSourceSha: KNOWN_RUNTIME_PROVENANCE['chat-ai-v31'], historicalVersion: true };
    const v = checkFinalRuntimeProvenance(v31).join(' ');
    expect(v).not.toMatch(/mislabel/);
    expect(v).toMatch(/stale_runtime_version_not_acceptable_for_final_gate/);
    expect(v).toMatch(/historical_row_not_acceptable_for_final_gate/);
  });
  it('a row labelled v32 but captured before v32 existed is rejected', () => {
    expect(checkFinalRuntimeProvenance({ ...base(), timestampUtc: '2026-09-23T10:00:00.000Z' }).join(' ')).toMatch(/captured_before_chat-ai-v32_existed/);
    expect(RUNTIME_V32_UPDATED_AT_UTC).toBe('2026-09-23T12:24:18.530Z');
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
  it('the final gate runner passes ONLY rows to validateFinalMatrix - no row-derived slot list', () => {
    const src = read('scripts/run-final-evidence-gate.mjs');
    expect(src).toMatch(/validateFinalMatrix\(key, data\.rows\)/);
    // strip comments, then no requiredSlots / evidenceId-derived slot list may appear in code
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/requiredSlots/);
    expect(code).not.toMatch(/rows\.map\(\s*\(?\s*r\s*\)?\s*=>\s*r\.evidenceId/);
    expect(code).not.toMatch(/validateEvidenceMatrix/);
  });
  it.each([
    'scripts/build-final-matrix-rows-v32.mjs',
    'scripts/build-owner-matrix-final-evidence.mjs',
    'scripts/build-plan-role-final-evidence.mjs',
    'scripts/build-security-support-final-evidence.mjs',
  ])('%s never sets expectedResult from a resolved/computed value', (file) => {
    const code = read(file).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/expectedResult\s*[:=]\s*(resolved|computed)\w*/);
  });
  it('the new builder takes its expectation only from the static slot definition', () => {
    const code = read('scripts/build-final-matrix-rows-v32.mjs');
    expect(code).toMatch(/expectedResult: slot\.expectedResult/);
    expect(code).toMatch(/expectationSource: slot\.expectationAuthority/);
  });
});
