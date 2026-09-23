// PRODUCT TRUTH FINAL THREE-ACTION DELTA - Action B: the FINAL committed semantic gate over the four final matrices.
//
// The required slot sets (48 / 13 / 9 / 4) and every expected value are resolved INSIDE validateFinalMatrix from the
// static acceptance definitions (src/data/productTruthFinalMatrixAcceptance.js) + the canonical registry. This runner
// hands the validator ONLY the evidence rows - it derives no slot list and no expectation from them (the previous
// version passed `owner.rows.map(r => r.evidenceId)` as the required slots, which is exactly the defect Codex found).
//   usage: node scripts/run-final-evidence-gate.mjs [rowsPrefix]
import { validateFinalMatrix } from '../src/data/productTruthEvidenceSchema.js';
import { readFileSync } from 'node:fs';

const PREFIX = process.argv[2] || 'evidence/product-truth/2026-09-23-three-action-delta';
const FILES = { owner: 'owner-matrix', planRole: 'plan-role-matrix', security: 'security-matrix', support: 'support-matrix' };

let allPass = true;
const totals = {};
for (const [key, file] of Object.entries(FILES)) {
  const data = JSON.parse(readFileSync(`${PREFIX}-${file}-final-rows.json`, 'utf-8'));
  const result = validateFinalMatrix(key, data.rows);
  totals[key] = `${result.validCount} / ${result.totalRequired}`;
  console.log(`\n=== ${result.name}: ${result.validCount} / ${result.totalRequired} VALID (rows supplied: ${data.rows.length}) ===`);
  console.log('definitionProblems:', JSON.stringify(result.definitionProblems));
  console.log('missing:', JSON.stringify(result.missingSlots), '| duplicate:', JSON.stringify(result.duplicateSlots), '| unknown:', JSON.stringify(result.unknownSlots), '| duplicateEvidenceIds:', JSON.stringify(result.duplicateEvidenceIds));
  console.log('expectation authorities proven for VALID cells:', JSON.stringify(result.authorityTally));
  for (const r of result.slotResults.filter((x) => !x.valid)) console.log(`  ${r.status} ${r.slot}:`, JSON.stringify(r.violations));
  if (!result.passes) allPass = false;
}
console.log('\nTOTALS', JSON.stringify(totals));
console.log(allPass ? 'FINAL EVIDENCE SEMANTIC GATE: PASS' : 'FINAL EVIDENCE SEMANTIC GATE: FAIL');
process.exit(allPass ? 0 : 1);
