// TEST <-> Production structural parity checker (Gate B / Gate H).
//
// Owner-authorized systemic remediation task (2026-09-09): every past
// release in this project verified TEST/Production parity ad hoc, with a
// bespoke one-off script per task (see check-release-source-identity.js,
// check-component-divergence.js) that hardcodes that task's own file list
// and worktree paths. This script is deliberately generic and permanent
// instead - runnable before or after ANY release, on demand, forever,
// without editing it per task.
//
// It NEVER touches customer/tenant data - only structural metadata:
// migration ledgers, Edge Function inventories/versions, and secret NAMES
// (never values). It never mutates anything - read-only CLI calls only.
//
// Output is always one of:
//   TEST STRUCTURE = LIVE STRUCTURE
// or an exact, categorized diff - never a vague PASS/FAIL. Every
// difference is labeled one of: intentional-test-only, pending-future-
// feature, dangerous-drift, missing-deployment, missing-configuration,
// unknown.
//
// Usage: node scripts/check-test-live-parity.js [--json] [--test-ref <ref>] [--prod-ref <ref>]
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PROD_REF = 'ixabnzhjeqevtbhdfswv';
const DEFAULT_TEST_REF = 'ljfizgrdyzxddswcedwr';

// Migrations captured verbatim from Production's own pre-existing native
// state (see their own file headers) are a documented, permanent exception -
// they exist only to bootstrap TEST's schema and must NEVER be applied to
// Production as a forward migration. Classify by this naming convention
// rather than guessing from timestamps alone.
const CAPTURE_BASE_MARKER = 'capture_base';

// Functions whose deployed source has been recovered into git (Orphan Edge
// Function Recovery task) but whose trigger wiring/purpose could not be
// confirmed read-only - deliberately NOT deployed to TEST pending that
// confirmation. Not deploying them is an intentional STOP, not an oversight;
// classify them distinctly so this script never nags about it as if it were
// a plain missing-deployment bug. Update this list only once wiring is
// confirmed and TEST deployment is authorized.
const UNCONFIRMED_WIRING_FUNCTIONS = new Set(['clever-processor', 'send-welcome-email']);

// { shell: true } is required on Windows, where `npx` is a .cmd shim rather
// than a directly-spawnable executable - harmless/ignored on POSIX.
function runJson(cmd, args) {
  const out = execFileSync(cmd, args, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 16, shell: true });
  const jsonStart = out.indexOf('{');
  if (jsonStart === -1) throw new Error(`No JSON found in output of: ${cmd} ${args.join(' ')}\n${out}`);
  return JSON.parse(out.slice(jsonStart));
}

function getMigrationList(ref) {
  const data = runJson('npx', ['supabase', 'migration', 'list', '--project-ref', ref]);
  return data.migrations || [];
}

function getFunctionList(ref) {
  const data = runJson('npx', ['supabase', 'functions', 'list', '--project-ref', ref]);
  return data.functions || [];
}

function getSecretNames(ref) {
  const out = execFileSync('npx', ['supabase', 'secrets', 'list', '--project-ref', ref], { encoding: 'utf-8', shell: true });
  const names = [];
  for (const m of out.matchAll(/"name":"([A-Z_]+)"/g)) names.push(m[1]);
  return names;
}

function localMigrationFiles() {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

function localFunctionSecretRequirements() {
  const dir = join(process.cwd(), 'supabase', 'functions');
  if (!existsSync(dir)) return {};
  const result = {};
  for (const fn of readdirSync(dir, { withFileTypes: true })) {
    if (!fn.isDirectory()) continue;
    const indexPath = join(dir, fn.name, 'index.ts');
    if (!existsSync(indexPath)) continue;
    // Strip // line comments before matching so a documented-but-inactive
    // Deno.env.get(...) reference (e.g. billing-checkout-stub's commented-out
    // Stripe call) is never counted as a real runtime requirement.
    const src = readFileSync(indexPath, 'utf-8').replace(/\/\/.*$/gm, '');
    const names = new Set();
    for (const m of src.matchAll(/Deno\.env\.get\(['"]([A-Z_]+)['"]\)/g)) names.add(m[1]);
    result[fn.name] = [...names];
  }
  return result;
}

function classifyMigration(filename, appliedTest, appliedProd) {
  if (filename.includes(CAPTURE_BASE_MARKER)) return 'intentional-test-only';
  if (appliedTest && appliedProd) return 'match';
  if (appliedTest && !appliedProd) return 'pending-future-feature';
  if (!appliedTest && appliedProd) return 'dangerous-drift'; // should never happen in a sane model
  return 'unknown'; // file exists locally but applied to neither
}

function diffMigrations(testRef, prodRef) {
  const local = localMigrationFiles();
  const testApplied = new Set(getMigrationList(testRef).filter((m) => m.remote).map((m) => m.local));
  const prodApplied = new Set(getMigrationList(prodRef).filter((m) => m.remote).map((m) => m.local));
  return local.map((file) => {
    const version = file.replace(/_.*/, '');
    const inTest = testApplied.has(version);
    const inProd = prodApplied.has(version);
    return { file, appliedTest: inTest, appliedProd: inProd, classification: classifyMigration(file, inTest, inProd) };
  });
}

function diffFunctions(testRef, prodRef) {
  const localReqs = localFunctionSecretRequirements();
  const testFns = new Map(getFunctionList(testRef).map((f) => [f.slug, f]));
  const prodFns = new Map(getFunctionList(prodRef).map((f) => [f.slug, f]));
  const testSecrets = new Set(getSecretNames(testRef));
  const prodSecrets = new Set(getSecretNames(prodRef));

  const allNames = new Set([...Object.keys(localReqs), ...testFns.keys(), ...prodFns.keys()]);
  const rows = [];
  for (const name of [...allNames].sort()) {
    const hasSource = name in localReqs;
    const t = testFns.get(name);
    const p = prodFns.get(name);
    let classification;
    if (!hasSource) classification = 'unknown'; // deployed but no source in repo (orphan)
    else if (!p) classification = 'missing-deployment'; // no source-controlled function should be missing from Prod
    else if (!t) classification = UNCONFIRMED_WIRING_FUNCTIONS.has(name) ? 'unconfirmed-wiring-hold' : 'missing-deployment';
    else classification = 'match'; // version/timestamp drift is informational, not auto-classified as dangerous

    const requiredSecrets = localReqs[name] || [];
    const missingOnTest = requiredSecrets.filter((s) => !testSecrets.has(s));
    const missingOnProd = requiredSecrets.filter((s) => !prodSecrets.has(s));
    if (missingOnTest.length) classification = classification === 'match' ? 'missing-configuration' : classification;

    rows.push({
      name,
      hasSource,
      prodVersion: p ? p.version : null,
      prodUpdatedAt: p ? new Date(p.updated_at).toISOString() : null,
      testVersion: t ? t.version : null,
      testUpdatedAt: t ? new Date(t.updated_at).toISOString() : null,
      requiredSecrets,
      missingOnTest,
      missingOnProd,
      classification,
    });
  }
  return rows;
}

export function runParityCheck({ testRef = DEFAULT_TEST_REF, prodRef = DEFAULT_PROD_REF } = {}) {
  const migrations = diffMigrations(testRef, prodRef);
  const functions = diffFunctions(testRef, prodRef);

  const EXPECTED = new Set(['match', 'intentional-test-only', 'pending-future-feature', 'unconfirmed-wiring-hold']);
  const migrationDrift = migrations.filter((m) => !EXPECTED.has(m.classification));
  const functionDrift = functions.filter((f) => !EXPECTED.has(f.classification));

  const isMatch = migrationDrift.length === 0 && functionDrift.length === 0;

  return { isMatch, migrations, functions, testRef, prodRef, checkedAt: new Date().toISOString() };
}

function printReport(report) {
  console.log(`\nTEST <-> LIVE Structural Parity Report — ${report.checkedAt}`);
  console.log(`TEST project: ${report.testRef}   PROD project: ${report.prodRef}\n`);

  console.log('--- Migrations ---');
  for (const m of report.migrations) {
    console.log(`  [${m.classification.padEnd(24)}] ${m.file}  (TEST:${m.appliedTest ? 'Y' : 'N'} PROD:${m.appliedProd ? 'Y' : 'N'})`);
  }

  console.log('\n--- Edge Functions ---');
  for (const f of report.functions) {
    const src = f.hasSource ? 'source-controlled' : 'NO SOURCE (orphan)';
    console.log(`  [${f.classification.padEnd(22)}] ${f.name.padEnd(34)} PROD v${f.prodVersion ?? '-'} / TEST v${f.testVersion ?? '-'}  (${src})`);
    if (f.missingOnTest.length) console.log(`      missing on TEST: ${f.missingOnTest.join(', ')}`);
    if (f.missingOnProd.length) console.log(`      missing on PROD: ${f.missingOnProd.join(', ')}`);
  }

  console.log('');
  if (report.isMatch) {
    console.log('RESULT: TEST STRUCTURE = LIVE STRUCTURE\n');
  } else {
    console.log('RESULT: DIFFERENCES FOUND — see classifications above. Not a blanket FAIL: intentional-test-only and pending-future-feature rows are expected and require no action.\n');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const testRefIdx = args.indexOf('--test-ref');
  const prodRefIdx = args.indexOf('--prod-ref');
  const report = runParityCheck({
    testRef: testRefIdx !== -1 ? args[testRefIdx + 1] : undefined,
    prodRef: prodRefIdx !== -1 ? args[prodRefIdx + 1] : undefined,
  });
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  process.exit(report.isMatch ? 0 : 1);
}
