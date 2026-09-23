// PRODUCT TRUTH FINAL EVIDENCE GATE over the four final matrices (three-action delta Action B, hardened by the
// four-finding remediation).
//
// The required slot sets (48 / 13 / 9 / 4) and every expected value are resolved INSIDE validateFinalMatrix from the
// static acceptance definitions (src/data/productTruthFinalMatrixAcceptance.js), the separately committed canonical
// required-slot identity table (productTruthRequiredSlotAuthority.js) and the canonical registry. This runner hands the
// validator ONLY the evidence rows plus the RAW committed capture they must be bound to - it derives no slot list and
// no expectation from the rows (the pre-delta runner passed `owner.rows.map(r => r.evidenceId)` as the required slots).
//   usage: node scripts/run-final-evidence-gate.mjs [rowsPrefix] [rawCapturePath] [--live-support-readback]
//   --live-support-readback : additionally re-reads each Support row id LIVE, READ-ONLY, from TEST `chat_logs`
//                             (super-admin persona, RLS-scoped select) and compares category / question / response /
//                             persona (e-mail hash only - the e-mail itself is never printed or recorded).
import { validateFinalMatrix } from '../src/data/productTruthEvidenceSchema.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const LIVE = process.argv.includes('--live-support-readback');
const PREFIX = args[0] || 'evidence/product-truth/2026-09-24-intent-grammar';
const RAW_PATH = args[1] || 'evidence/product-truth/2026-09-24-intent-grammar-v37-raw-matrices.json';
const FILES = { owner: 'owner-matrix', planRole: 'plan-role-matrix', security: 'security-matrix', support: 'support-matrix' };

const rawText = readFileSync(RAW_PATH, 'utf-8');
const rawCapture = JSON.parse(rawText);
console.log(`raw capture: ${RAW_PATH}  sha256=${createHash('sha256').update(rawText).digest('hex')}`);

async function liveSupportReadback(supportRows) {
  const envText = readFileSync('C:/tkrc-pt/.env.localtest.local', 'utf-8');
  const envVar = (n) => { const m = envText.match(new RegExp(`^${n}=(.*)$`, 'm')); if (!m) throw new Error(`missing env var ${n}`); return m[1].trim(); };
  const url = envVar('VITE_SUPABASE_URL');
  if (!url.includes('ljfizgrdyzxddswcedwr')) throw new Error('REFUSING: not the TEST project');
  const anon = envVar('VITE_SUPABASE_ANON_KEY');
  const s = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email: envVar('PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL'), password: envVar('PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD') }) })).json();
  const personaEmail = { INTL_FREE: envVar('PROFLOW_TEST_INTL_FREE_EMAIL') };
  const h = (e) => createHash('sha256').update(e).digest('hex').slice(0, 12);
  const out = {};
  for (const row of supportRows) {
    const id = row.immutableTestRowId;
    const res = await fetch(`${url}/rest/v1/chat_logs?select=id,category,user_question,ai_response,created_at,user_email&id=eq.${encodeURIComponent(String(id))}`, { headers: { apikey: anon, Authorization: `Bearer ${s.access_token}` } });
    const j = await res.json().catch(() => null);
    const r = Array.isArray(j) ? j[0] : null;
    out[row.matrixSlot] = r ? { id: r.id, category: r.category, user_question: r.user_question, ai_response: r.ai_response, created_at: r.created_at, userEmailHash: h(r.user_email ?? ''), expectedPersonaEmailHash: h(personaEmail[row.personaAlias] ?? '') } : undefined;
    console.log(`  live chat_logs id=${id}: http=${res.status} found=${!!r} category=${r?.category ?? '-'} personaEmailHash=${r ? h(r.user_email ?? '') : '-'}`);
  }
  return out;
}

let allPass = true;
const totals = {};
for (const [key, file] of Object.entries(FILES)) {
  const data = JSON.parse(readFileSync(`${PREFIX}-${file}-final-rows.json`, 'utf-8'));
  const opts = { rawCapture };
  if (LIVE && key === 'support') opts.liveSupportReadback = await liveSupportReadback(data.rows);
  const result = validateFinalMatrix(key, data.rows, opts);
  totals[key] = `${result.validCount} / ${result.totalRequired}`;
  console.log(`\n=== ${result.name}: ${result.validCount} / ${result.totalRequired} VALID (rows supplied: ${data.rows.length}) ===`);
  console.log('definitionProblems:', JSON.stringify(result.definitionProblems), '| rawBound:', result.rawBound, '| rawCaptureProblems:', JSON.stringify(result.rawCaptureProblems), key === 'support' ? `| liveReadbackChecked: ${result.liveReadbackChecked}` : '');
  console.log('missing:', JSON.stringify(result.missingSlots), '| duplicate:', JSON.stringify(result.duplicateSlots), '| unknown:', JSON.stringify(result.unknownSlots), '| duplicateEvidenceIds:', JSON.stringify(result.duplicateEvidenceIds));
  console.log('expectation authorities proven for VALID cells:', JSON.stringify(result.authorityTally));
  for (const r of result.slotResults.filter((x) => !x.valid)) console.log(`  ${r.status} ${r.slot}:`, JSON.stringify(r.violations));
  if (!result.passes) allPass = false;
}
console.log('\nTOTALS', JSON.stringify(totals));
console.log(allPass ? 'FINAL EVIDENCE SEMANTIC GATE: PASS' : 'FINAL EVIDENCE SEMANTIC GATE: FAIL');
process.exit(allPass ? 0 : 1);
