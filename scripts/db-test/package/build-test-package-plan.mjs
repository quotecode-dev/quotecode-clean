// Task 29 - writes scripts/db-test/package/test-package-plan.json: the ordered TEST package (filename order = apply order), each file's
// sha256 (must equal the harness contract), its group (A capabilities / B subscription schema, inert) and its re-apply mode. The recognized
// A1 states are CAPTURED from a real fresh install by the DB harness (tests/190_task29_test_package.mjs with TK_CAPTURE_PROBE=<file>) and
// read from --states; nothing here is hand-typed fingerprint data. Re-running keeps the plan deterministic.
//   node scripts/db-test/package/build-test-package-plan.mjs [--states <captured.json>]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const PLAN = path.join(ROOT, 'scripts', 'db-test', 'package', 'test-package-plan.json');
const PROBE = 'probes/20261009180000_task18_durable_manual_tasks.postcondition.sql';
const A = ['20261009180000_task18_durable_manual_tasks.sql', '20261009200000_task20_reminders_automation.sql', '20261011000000_task24_business_cards.sql',
  '20261011110000_task27_p2_schedule_templates_sharing.sql', '20261011120000_task28_follow_up_task_uniqueness.sql'];
const B = ['20261007150000_subscriptions_free10_issue_ledger.sql', '20261007150100_subscriptions_billing_assets.sql', '20261007150200_subscriptions_account_summary.sql',
  '20261007150300_subscriptions_public_capabilities.sql', '20261007150400_subscriptions_provisioning_cohort.sql', '20261007150500_subscriptions_retire_pro_trial_signup.sql',
  '20261007150600_subscriptions_capability_approval.sql', '20261007150700_subscriptions_output_notice.sql', '20261007150800_subscriptions_issuer_logo_binding.sql',
  '20261007150900_subscriptions_capability_defaults_reconciliation.sql', '20261007151000_subscriptions_capability_scoped_rollback_safety.sql',
  '20261011100000_task27_all_inclusive_package_and_free10_create_guard.sql',
  // Task 30: Free-10 per quote version + customer (forward migration on top of B1 / B8; LOCAL ONLY - its TEST application needs its own authorization)
  '20261011130000_task30_free10_version_recipient_count.sql'];
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'db-test', 'migration-contract.json'), 'utf8')).migrations;
const i = process.argv.indexOf('--states');
const previous = fs.existsSync(PLAN) ? JSON.parse(fs.readFileSync(PLAN, 'utf8')) : null;
const states = i > 0 ? JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8'))
  : previous?.migrations.find((m) => m.reapply === 'postcondition')?.recognizedStates ?? [];
const probeText = fs.readFileSync(path.join(ROOT, 'scripts', 'db-test', 'package', PROBE), 'utf8');
const migrations = [...A, ...B].sort().map((file) => {
  const d = sha(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', file), 'utf8'));
  if (contract[file]?.sha256 !== d) throw new Error(`${file}: working-tree sha256 ${d} != harness contract ${contract[file]?.sha256}`);
  const base = { file, sha256: d, group: A.includes(file) ? 'A' : 'B', contractReplay: contract[file].replay };
  if (file === '20261009180000_task18_durable_manual_tasks.sql') {
    return { ...base, reapply: 'postcondition', probe: PROBE, probeSha256: sha(probeText), recognizedStates: states,
      why: 'its exact-shape guard (fail-closed) refuses a re-run once A5 added tasks.kind; measured: the only package migration that refuses a re-run on the full post-package state' };
  }
  return { ...base, reapply: 'rerun', why: 'measured idempotent on the full post-package state (DB harness, Task 29)' };
});
const plan = {
  schema: 'tekango-test-package-plan/1',
  note: 'Apply order = this order (filename order) over the selected groups. replay=required (harness) = immediate idempotency only; the '
    + 're-apply mode below is what a WHOLE-package re-run does. Execute only through scripts/db-test/package/apply-test-package.mjs semantics.',
  postgresMajorOfFingerprints: 17,
  migrations,
};
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 2) + '\n');
console.log(`plan: ${migrations.length} migrations, A1 recognized states: ${states.length}`);
