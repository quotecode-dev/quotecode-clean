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
// Function Recovery task) and are now CONFIRMED unwired, not merely
// unconfirmed (Final Orphan Wiring + TEST Secrets Closure task, 2026-09-09):
// zero code-level callers anywhere in this repository; zero Database
// Triggers/Event Triggers/Webhooks referencing either name on TEST or
// Production (direct pg_catalog query - the `supabase_functions` webhooks
// schema doesn't even exist on either project); Owner-confirmed fresh TEST
// Dashboard evidence of no Auth Hooks and no matching DB triggers. Kept
// undeployed to TEST as a deliberate, still-standing decision (a future
// task would need separate authorization to redeploy/wire either one), but
// the classification below no longer hedges with "unconfirmed."
const CONFIRMED_UNWIRED_ORPHAN_FUNCTIONS = new Set(['clever-processor', 'send-welcome-email']);

// Secret names whose ONLY current consumer code path is itself unreachable
// on both TEST and Production (Final Orphan Wiring + TEST Secrets Closure
// task, 2026-09-09) - missing does not block any currently-defined critical
// journey, so it must not drive a row's classification to
// 'missing-configuration' (a real blocker) the way OPENAI_API_KEY/
// RESEND_API_KEY genuinely do for chat-ai/send-quote-email. Still reported
// (nothing is hidden), just not counted as blocking:
//  - CRON_SECRET: checked only in send-subscription-expiration-email's and
//    send-trial-expiration-email's automated BATCH-send branch. No
//    DATABASE-level scheduler reaches it on either project (pg_cron is not
//    installed on TEST or Production - direct pg_catalog query - and no
//    supabase/config.toml schedule exists). Production IS genuinely wired
//    to this path via a real, source-controlled Vercel Cron Job instead
//    (vercel.json's `crons` entry -> api/cron.js, daily, calling both
//    functions in `mode: 'batch'` with an `x-cron-secret` header) - whether
//    that path actually fires end-to-end also depends on Vercel's OWN
//    CRON_SECRET environment variable matching (a Vercel-dashboard fact,
//    not a Supabase one, and not independently confirmed by this check).
//    Either way this has NO TEST equivalent: api/cron.js reads its Supabase
//    target from Vercel's own env (VITE_SUPABASE_URL/SUPABASE_URL), and
//    there is no separate Vercel deployment pointed at the isolated TEST
//    project - so for TEST specifically this remains not-blocking. The
//    already-real, testable Admin "send test email" path also returns
//    before this check is ever reached, needing RESEND_API_KEY only.
//  - RESEND_WEBHOOK_SECRET: resend-email-webhook is a passive receiver for
//    Resend's own outbound webhook calls (configured externally on
//    resend.com, outside this repo/Supabase project entirely). It cannot
//    receive real traffic on TEST without RESEND_API_KEY already being set
//    (no emails are ever sent, so no bounce/complaint events can ever
//    occur) AND a webhook subscription actually pointed at TEST's specific
//    endpoint URL on Resend's own dashboard - neither currently exists.
const SECRETS_NOT_CURRENTLY_BLOCKING = new Set(['CRON_SECRET', 'RESEND_WEBHOOK_SECRET']);

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
    else if (!t) classification = CONFIRMED_UNWIRED_ORPHAN_FUNCTIONS.has(name) ? 'confirmed-unwired-orphan' : 'missing-deployment';
    else classification = 'match'; // version/timestamp drift is informational, not auto-classified as dangerous

    const requiredSecrets = localReqs[name] || [];
    const missingOnTest = requiredSecrets.filter((s) => !testSecrets.has(s));
    const missingOnProd = requiredSecrets.filter((s) => !prodSecrets.has(s));
    // A secret missing on TEST only actually blocks this row's status when
    // at least one of the missing names isn't in SECRETS_NOT_CURRENTLY_
    // BLOCKING - see that set's own header for the per-secret reasoning.
    // Every missing name is still reported in full below either way.
    const blockingMissingOnTest = missingOnTest.filter((s) => !SECRETS_NOT_CURRENTLY_BLOCKING.has(s));
    if (blockingMissingOnTest.length) classification = classification === 'match' ? 'missing-configuration' : classification;

    rows.push({
      name,
      hasSource,
      prodVersion: p ? p.version : null,
      prodUpdatedAt: p ? new Date(p.updated_at).toISOString() : null,
      testVersion: t ? t.version : null,
      testUpdatedAt: t ? new Date(t.updated_at).toISOString() : null,
      requiredSecrets,
      missingOnTest,
      blockingMissingOnTest,
      missingOnProd,
      classification,
    });
  }
  return rows;
}

export function runParityCheck({ testRef = DEFAULT_TEST_REF, prodRef = DEFAULT_PROD_REF } = {}) {
  const migrations = diffMigrations(testRef, prodRef);
  const functions = diffFunctions(testRef, prodRef);

  const EXPECTED = new Set(['match', 'intentional-test-only', 'pending-future-feature', 'confirmed-unwired-orphan']);
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
    if (f.blockingMissingOnTest.length) console.log(`      missing on TEST (blocking): ${f.blockingMissingOnTest.join(', ')}`);
    const infoOnly = f.missingOnTest.filter((s) => !f.blockingMissingOnTest.includes(s));
    if (infoOnly.length) console.log(`      missing on TEST (not currently blocking - see SECRETS_NOT_CURRENTLY_BLOCKING): ${infoOnly.join(', ')}`);
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
