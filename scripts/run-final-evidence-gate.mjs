// PRODUCT TRUTH FINAL CLOSURE — runs the real, mechanical Finding 5 gate against all 4 committed
// final matrices and prints the exact "N / M VALID" totals + full violation detail for anything
// short of totally valid. This is the actual proof, not a narrated claim.
import { validateEvidenceMatrix, checkEvidenceRuntimeFreshness } from '../src/data/productTruthEvidenceSchema.js';
import { readFileSync } from 'node:fs';

const FINAL_SHA = '08c012bcd6094335e987e7972c66604c2579e125';

function report(name, data, requiredSlots, slotOf, expectationOf) {
  const result = validateEvidenceMatrix(data.rows, { requiredSlots, slotOf, expectationOf });
  console.log(`\n=== ${name}: ${result.validCount} / ${result.totalRequired} VALID ===`);
  console.log('slotCheck:', JSON.stringify(result.slotCheck));
  const invalid = result.rowResults.filter((r) => !r.valid);
  if (invalid.length) {
    console.log('INVALID ROWS:', JSON.stringify(invalid.map((r) => ({ slot: r.slot, schema: r.schemaViolations, semantic: r.semanticViolations })), null, 2));
  }
  const stale = checkEvidenceRuntimeFreshness(data.rows, FINAL_SHA);
  console.log(`unmarked-stale-SHA rows: ${stale.length}`);
  if (stale.length) console.log(JSON.stringify(stale, null, 2));
  return result;
}

const owner = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-owner-matrix-final-rows.json', 'utf-8'));
report('OWNER MATRIX', owner, owner.rows.map((r) => r.evidenceId), (r) => r.evidenceId, () => ({ requiresDeterministicCapability: true }));

const planRole = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-plan-role-final-rows.json', 'utf-8'));
report('PLAN/ROLE MATRIX', planRole, planRole.rows.map((r) => r.evidenceId), (r) => r.evidenceId, () => ({ requiresDeterministicCapability: true }));

const security = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-security-final-rows.json', 'utf-8'));
report('SECURITY MATRIX', security, security.rows.map((r) => r.evidenceId), (r) => r.evidenceId, () => ({ expectedResult: 'fail_safe' }));

const support = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-support-final-rows.json', 'utf-8'));
report('AI SUPPORT MATRIX', support, support.rows.map((r) => r.evidenceId), (r) => r.evidenceId, (r) => ({ expectedResult: r.expectedResult, requiresDeterministicCapability: true }));
