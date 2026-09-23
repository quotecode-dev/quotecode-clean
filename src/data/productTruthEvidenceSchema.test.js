// PRODUCT TRUTH FINAL DELTA CLOSURE — Finding 5 (2026-09-2X) required mutation tests (task §6's
// required gate assertion list): wrong capability/result, missing expected capability/result, null
// capabilityId where a deterministic capability must exist, wrong entitlement result, missing
// required row metadata, wrong matrix slot, duplicate slot, missing subtopic, invalid semantic
// result, row tied to stale runtime version/SHA.
import { describe, it, expect } from 'vitest';
import {
  REQUIRED_EVIDENCE_ROW_FIELDS,
  checkEvidenceRowSchema,
  checkEvidenceRowSemantics,
  checkEvidenceMatrixSlots,
  validateEvidenceRow,
  validateEvidenceMatrix,
  checkEvidenceRuntimeFreshness,
} from './productTruthEvidenceSchema.js';

function goodRow(overrides = {}) {
  return {
    evidenceId: 'ev-owner-001',
    timestampUtc: '2026-09-24T10:00:00.000Z',
    personaAlias: 'LOCAL_PRO',
    market: 'Local',
    plan: 'PRO (lifetime)',
    role: 'user',
    language: 'he',
    prompt: 'יש לכם מחשבון?',
    response: 'כן - מחשבון קיים בעורך.',
    supportCategory: 'GENERAL',
    resolvedResult: 'editor_calculator',
    expectedResult: 'editor_calculator',
    implementationSourceSha: 'abc1234',
    testProjectRef: 'ljfizgrdyzxddswcedwr',
    deployedFunctionVersion: 'chat-ai-v31',
    evidenceMethod: 'live_terminal_http',
    ...overrides,
  };
}

describe('FINDING 5 §6 — schema completeness: missing required row metadata', () => {
  it('a fully complete row passes with zero schema violations', () => {
    expect(checkEvidenceRowSchema(goodRow())).toEqual([]);
  });

  it.each(REQUIRED_EVIDENCE_ROW_FIELDS)('a row missing "%s" fails schema validation', (field) => {
    const row = goodRow();
    delete row[field];
    const violations = checkEvidenceRowSchema(row);
    expect(violations).toContain(`missing_field:${field}`);
  });

  it.each(REQUIRED_EVIDENCE_ROW_FIELDS)('a row with "%s" present but blank/empty fails schema validation', (field) => {
    const row = goodRow({ [field]: '' });
    const violations = checkEvidenceRowSchema(row);
    expect(violations.some((v) => v.startsWith(`empty_or_invalid_field:${field}`) || v.startsWith(`missing_field:${field}`))).toBe(true);
  });

  it('a malformed (non-UTC-ISO8601) timestamp fails', () => {
    expect(checkEvidenceRowSchema(goodRow({ timestampUtc: '09/24/2026 10:00am' }))).toContain('malformed_timestamp_not_utc_iso8601');
  });

  it('a malformed implementation source SHA fails', () => {
    expect(checkEvidenceRowSchema(goodRow({ implementationSourceSha: 'not-a-real-sha!!' }))).toContain('malformed_implementation_source_sha');
  });

  it('an invalid language value fails', () => {
    expect(checkEvidenceRowSchema(goodRow({ language: 'fr' }))).toContain('invalid_language_value');
  });

  it('an invalid market value fails', () => {
    expect(checkEvidenceRowSchema(goodRow({ market: 'Mars' }))).toContain('invalid_market_value');
  });
});

describe('FINDING 5 §6 — semantic validation: wrong capability/result', () => {
  it('a row whose resolvedResult does not match the cell\'s own expectedResult fails (self-inconsistent)', () => {
    const row = goodRow({ resolvedResult: 'quote_pdf', expectedResult: 'editor_calculator' });
    const violations = checkEvidenceRowSemantics(row);
    expect(violations.some((v) => v.startsWith('self_inconsistent_row'))).toBe(true);
  });

  it('a row whose resolvedResult does not match the MATRIX-DEFINITION expected result (not just its own claim) fails', () => {
    const row = goodRow({ resolvedResult: 'quote_pdf', expectedResult: 'quote_pdf' }); // internally consistent...
    const violations = checkEvidenceRowSemantics(row, { expectedResult: 'editor_calculator' }); // ...but wrong per the real cell definition
    expect(violations.some((v) => v.startsWith('wrong_result'))).toBe(true);
  });
});

describe('FINDING 5 §6 — missing expected capability/result', () => {
  it('a row with resolvedResult null where the matrix definition requires a determinstic capability fails', () => {
    const row = goodRow({ resolvedResult: null, expectedResult: null });
    const violations = checkEvidenceRowSemantics(row, { requiresDeterministicCapability: true });
    expect(violations).toContain('null_capability_where_deterministic_required');
  });
});

describe('FINDING 5 §6 — null capabilityId where a deterministic capability must exist', () => {
  it('resolvedResult undefined (never resolved at all) also fails when determinism is required', () => {
    const row = goodRow();
    delete row.resolvedResult;
    const violations = checkEvidenceRowSemantics(row, { requiresDeterministicCapability: true });
    expect(violations).toContain('null_capability_where_deterministic_required');
  });

  it('a deterministic-required row backed by a non-mechanical evidence method (narration, not a real call/read-back) fails', () => {
    const row = goodRow({ evidenceMethod: 'manual_narration' });
    const violations = checkEvidenceRowSemantics(row, { requiresDeterministicCapability: true });
    expect(violations).toContain('non_mechanical_evidence_method_for_deterministic_row');
  });
});

describe('FINDING 5 §6 — wrong entitlement result (plan/role gated cells)', () => {
  it('an admin_console row wrongly claiming access granted when the expectation says denied fails', () => {
    const row = goodRow({ resolvedResult: 'GRANTED', expectedResult: 'GRANTED', response: 'Yes, admin console is accessible.' });
    const violations = checkEvidenceRowSemantics(row, { expectedResult: 'DENIED' });
    expect(violations.some((v) => v.startsWith('wrong_result'))).toBe(true);
  });
});

describe('FINDING 5 §6 — invalid semantic result: forbidden / required response-content patterns', () => {
  it('a response containing a forbidden overclaim pattern fails even with the right resolvedResult', () => {
    const row = goodRow({ response: 'Yes, calculator exists. All TEKANGO prices are in ILS only.' });
    const violations = checkEvidenceRowSemantics(row, { forbiddenResponsePatterns: [/all tekango prices are in/i] });
    expect(violations.some((v) => v.startsWith('forbidden_pattern_present'))).toBe(true);
  });

  it('a response missing a required truth-preserving pattern fails (e.g. a Print-comparison answer that never mentions Print)', () => {
    const row = goodRow({ response: 'Yes, PDF export exists in TEKANGO.' });
    const violations = checkEvidenceRowSemantics(row, { requiredResponsePatterns: [/print/i] });
    expect(violations.some((v) => v.startsWith('required_pattern_missing'))).toBe(true);
  });

  it('a fully correct row (right result, no forbidden pattern, required pattern present) passes semantics cleanly', () => {
    const row = goodRow({ response: 'No, PDF and Print are two different actions...', resolvedResult: 'quote_pdf_vs_print_comparison', expectedResult: 'quote_pdf_vs_print_comparison' });
    const violations = checkEvidenceRowSemantics(row, { expectedResult: 'quote_pdf_vs_print_comparison', requiredResponsePatterns: [/print/i, /pdf/i], forbiddenResponsePatterns: [/no print option/i] });
    expect(violations).toEqual([]);
  });
});

describe('FINDING 5 §6 — matrix slot integrity: wrong slot, duplicate slot, missing subtopic', () => {
  const requiredSlots = ['owner|calculator|direct|he', 'owner|calculator|direct|en', 'owner|print|adversarial|he'];
  const slotOf = (row) => row.slot;

  it('a required slot with no row at all is reported missing', () => {
    const rows = [{ slot: 'owner|calculator|direct|he' }, { slot: 'owner|calculator|direct|en' }];
    const { missingSlots } = checkEvidenceMatrixSlots(rows, requiredSlots, slotOf);
    expect(missingSlots).toEqual(['owner|print|adversarial|he']);
  });

  it('a slot appearing twice (duplicate) is reported, never silently overwriting the earlier row', () => {
    const rows = [
      { slot: 'owner|calculator|direct|he' },
      { slot: 'owner|calculator|direct|he' },
      { slot: 'owner|calculator|direct|en' },
      { slot: 'owner|print|adversarial|he' },
    ];
    const { duplicateSlots } = checkEvidenceMatrixSlots(rows, requiredSlots, slotOf);
    expect(duplicateSlots).toEqual(['owner|calculator|direct|he']);
  });

  it('a row claiming a slot the matrix definition never declared (wrong matrix slot / missing subtopic - e.g. a mistyped subtopic) is reported unknown, not silently accepted', () => {
    const rows = [{ slot: 'owner|calculator|direct|he' }, { slot: 'owner|calculator|direct|en' }, { slot: 'owner|printing|adversarial|he' }]; // "printing" typo, not the real "print" subtopic
    const { missingSlots, unknownSlots } = checkEvidenceMatrixSlots(rows, requiredSlots, slotOf);
    expect(unknownSlots).toContain('owner|printing|adversarial|he');
    expect(missingSlots).toContain('owner|print|adversarial|he'); // the REAL required slot is still unfilled
  });

  it('a complete, correct, non-duplicated matrix reports no missing/duplicate/unknown slots', () => {
    const rows = requiredSlots.map((slot) => ({ slot }));
    const result = checkEvidenceMatrixSlots(rows, requiredSlots, slotOf);
    expect(result).toEqual({ missingSlots: [], duplicateSlots: [], unknownSlots: [] });
  });
});

describe('FINDING 5 §6 — row tied to stale runtime version/SHA', () => {
  it('a row whose implementationSourceSha is not the final SHA and is NOT marked historical is flagged', () => {
    const rows = [goodRow({ evidenceId: 'ev-1', implementationSourceSha: 'oldsha1' })];
    const stale = checkEvidenceRuntimeFreshness(rows, 'finalsha9');
    expect(stale).toEqual([{ evidenceId: 'ev-1', sha: 'oldsha1' }]);
  });

  it('a row explicitly marked historicalVersion:true is NOT flagged even with an old SHA (honest historical record, task §11)', () => {
    const rows = [goodRow({ evidenceId: 'ev-2', implementationSourceSha: 'oldsha1', historicalVersion: true })];
    expect(checkEvidenceRuntimeFreshness(rows, 'finalsha9')).toEqual([]);
  });

  it('a row already at the final SHA is never flagged', () => {
    const rows = [goodRow({ evidenceId: 'ev-3', implementationSourceSha: 'finalsha9' })];
    expect(checkEvidenceRuntimeFreshness(rows, 'finalsha9')).toEqual([]);
  });
});

describe('FINDING 5 — full per-row gate (validateEvidenceRow): schema failure short-circuits before semantics are even checked', () => {
  it('an incomplete row is invalid regardless of correct semantic content', () => {
    const row = goodRow();
    delete row.evidenceId;
    const result = validateEvidenceRow(row, { expectedResult: 'editor_calculator' });
    expect(result.valid).toBe(false);
    expect(result.schemaViolations.length).toBeGreaterThan(0);
    expect(result.semanticViolations).toEqual([]); // never even reached
  });

  it('a complete row with correct semantics is valid', () => {
    const result = validateEvidenceRow(goodRow(), { expectedResult: 'editor_calculator' });
    expect(result.valid).toBe(true);
  });
});

describe('FINDING 5 — validateEvidenceMatrix: exact "N / M VALID" counting, never a bare row-count', () => {
  it('48/48-shaped example: a fully valid 3-slot matrix reports validCount === totalRequired', () => {
    const requiredSlots = ['a', 'b', 'c'];
    const rows = requiredSlots.map((s) => goodRow({ evidenceId: `ev-${s}`, slot: s }));
    const result = validateEvidenceMatrix(rows, { requiredSlots, slotOf: (r) => r.slot, expectationOf: () => ({ expectedResult: 'editor_calculator' }) });
    expect(result.validCount).toBe(3);
    expect(result.totalRequired).toBe(3);
  });

  it('one semantically-wrong row lowers validCount below totalRequired, never masked by the other valid rows', () => {
    const requiredSlots = ['a', 'b', 'c'];
    const rows = [
      goodRow({ evidenceId: 'ev-a', slot: 'a' }),
      goodRow({ evidenceId: 'ev-b', slot: 'b', resolvedResult: 'WRONG_RESULT' }),
      goodRow({ evidenceId: 'ev-c', slot: 'c' }),
    ];
    const result = validateEvidenceMatrix(rows, { requiredSlots, slotOf: (r) => r.slot, expectationOf: () => ({ expectedResult: 'editor_calculator' }) });
    expect(result.validCount).toBe(2);
    expect(result.totalRequired).toBe(3);
  });

  it('a duplicated slot never counts toward validCount even if both copies are individually schema/semantically valid', () => {
    const requiredSlots = ['a', 'b'];
    const rows = [
      goodRow({ evidenceId: 'ev-a1', slot: 'a' }),
      goodRow({ evidenceId: 'ev-a2', slot: 'a' }),
      goodRow({ evidenceId: 'ev-b', slot: 'b' }),
    ];
    const result = validateEvidenceMatrix(rows, { requiredSlots, slotOf: (r) => r.slot, expectationOf: () => ({ expectedResult: 'editor_calculator' }) });
    expect(result.validCount).toBe(1); // only 'b' counts; 'a' is duplicated and excluded
    expect(result.slotCheck.duplicateSlots).toEqual(['a']);
  });
});
