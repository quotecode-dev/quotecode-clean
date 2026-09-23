// FOUR-FINDING REMEDIATION - explicit rejection proof. Runs the five attacks Codex demonstrated (all of which PASSED the
// pre-remediation gate) against the REAL committed final rows + raw capture + definitions, and prints an explicit
// PASS/FAIL rejection verdict per attack, plus the unmodified control (must still be 48/13/9/4).
//   usage: node scripts/run-four-finding-attack-proof.mjs [rowsPrefix] [rawCapturePath] > evidence/....json
import { readFileSync } from 'node:fs';
import { validateFinalMatrix, checkFinalMatrixDefinitionIntegrity } from '../src/data/productTruthEvidenceSchema.js';
import { FINAL_MATRIX_DEFINITIONS } from '../src/data/productTruthFinalMatrixAcceptance.js';

const PREFIX = process.argv[2] || 'evidence/product-truth/2026-09-23-four-finding-remediation';
const RAW_PATH = process.argv[3] || 'evidence/product-truth/2026-09-23-three-action-delta-v32-raw-matrices.json';
const FILES = { owner: 'owner-matrix', planRole: 'plan-role-matrix', security: 'security-matrix', support: 'support-matrix' };
const raw = JSON.parse(readFileSync(RAW_PATH, 'utf-8'));
const rows = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, JSON.parse(readFileSync(`${PREFIX}-${f}-final-rows.json`, 'utf-8')).rows]));
const clone = (x) => JSON.parse(JSON.stringify(x));
const run = (key, r, extra = {}) => validateFinalMatrix(key, r, { rawCapture: raw, ...extra });
const results = [];
const record = (id, attack, before, res, detail) => {
  const rejected = !res.passes;
  results.push({ id, attack, preRemediationResult: before, nowResult: `${res.validCount} / ${res.totalRequired} VALID, gate ${res.passes ? 'PASS' : 'FAIL'}`, rejected, verdict: rejected ? 'PASS (attack rejected)' : 'FAIL (attack still passes)', detail });
};

// control
const control = Object.fromEntries(Object.keys(FILES).map((k) => [k, run(k, rows[k])]));
const controlOk = Object.values(control).every((r) => r.passes);

// 1. Plan/Role same-cardinality slot substitution
{
  const def = { name: 'x', slots: FINAL_MATRIX_DEFINITIONS.planRole.slots.map((s, i) => (i === 0 ? { ...s, slot: 'PR-99' } : s)) };
  record('A1', 'Plan/Role: one required slot id substituted, cardinality still 13', 'definitionProblems: [] (accepted)', run('planRole', rows.planRole, { definition: def }), checkFinalMatrixDefinitionIntegrity('planRole', def));
}
// 2. Security same-cardinality slot substitution
{
  const def = { name: 'x', slots: FINAL_MATRIX_DEFINITIONS.security.slots.map((s, i) => (i === 0 ? { ...s, slot: 'SEC:other', cell: 'other' } : s)) };
  record('A2', 'Security: one required slot id substituted, cardinality still 9', 'definitionProblems: [] (accepted)', run('security', rows.security, { definition: def }), checkFinalMatrixDefinitionIntegrity('security', def));
}
// 3. arbitrary Support UUID
{
  const r = clone(rows.support);
  r.find((x) => x.matrixSlot === 'SUP:CANCELLATION').immutableTestRowId = '00000000-0000-0000-0000-000000000000';
  const res = run('support', r);
  record('A3', 'Support: Cancellation row UUID replaced by 00000000-0000-0000-0000-000000000000', '4 / 4 VALID (accepted)', res, res.slotResults.find((x) => x.slot === 'SUP:CANCELLATION').violations);
}
// 4. cross-category Support UUID swap
{
  const r = clone(rows.support);
  const c = r.find((x) => x.matrixSlot === 'SUP:CANCELLATION');
  const f = r.find((x) => x.matrixSlot === 'SUP:FEATURE_REQUEST');
  [c.immutableTestRowId, f.immutableTestRowId] = [f.immutableTestRowId, c.immutableTestRowId];
  const res = run('support', r);
  record('A4', 'Support: Cancellation and Feature-request row UUIDs swapped', '4 / 4 VALID (accepted)', res, { cancellation: res.slotResults.find((x) => x.slot === 'SUP:CANCELLATION').violations, featureRequest: res.slotResults.find((x) => x.slot === 'SUP:FEATURE_REQUEST').violations });
}
// 5. contradictory capability prose containing the correct label
{
  const r = clone(rows.owner);
  r.find((x) => x.matrixSlot === 'calculator|direct|en').response = 'In-editor calculator does not exist in TEKANGO';
  const res = run('owner', r);
  record('A5', 'Owner: calculator answer replaced by "In-editor calculator does not exist in TEKANGO" (contains the expected label)', '48 / 48 VALID (accepted)', res, res.slotResults.find((x) => x.slot === 'calculator|direct|en').violations);
}

// 3b / 5b. COORDINATED forgery - the attacker edits the raw capture consistently with the row, so raw-binding alone cannot catch it
{
  const r = clone(rows.support);
  const forged = clone(raw);
  r.find((x) => x.matrixSlot === 'SUP:CANCELLATION').immutableTestRowId = '00000000-0000-0000-0000-000000000000';
  forged.matrices.support.find((e) => e.slot === 'SUP:CANCELLATION').readback.row.id = '00000000-0000-0000-0000-000000000000';
  const res = run('support', r, { rawCapture: forged });
  record('A3b', 'Support: nil UUID forged consistently in BOTH the row and the raw capture', '4 / 4 VALID (accepted)', res, res.slotResults.find((x) => x.slot === 'SUP:CANCELLATION').violations);
}
{
  const r = clone(rows.owner);
  const forged = clone(raw);
  const text = 'In-editor calculator does not exist in TEKANGO';
  r.find((x) => x.matrixSlot === 'calculator|direct|en').response = text;
  forged.matrices.owner.find((e) => e.slot === 'calculator|direct|en').response = text;
  const res = run('owner', r, { rawCapture: forged });
  record('A5b', 'Owner: contradictory prose forged consistently in BOTH the row and the raw capture (polarity must reject on its own)', '48 / 48 VALID (accepted)', res, res.slotResults.find((x) => x.slot === 'calculator|direct|en').violations);
}

const allRejected = results.every((r) => r.rejected);
console.log(JSON.stringify({
  capturedAtUtc: new Date().toISOString(), rowsPrefix: PREFIX, rawCapture: RAW_PATH,
  control: Object.fromEntries(Object.entries(control).map(([k, v]) => [k, `${v.validCount} / ${v.totalRequired}`])), controlOk,
  attacks: results, allFiveAttacksRejected: allRejected,
  summary: controlOk && allRejected ? 'CONTROL 48/13/9/4 VALID; ALL FIVE CODEX ATTACKS REJECTED' : 'PROOF FAILED',
}, null, 2));
process.exit(controlOk && allRejected ? 0 : 1);
