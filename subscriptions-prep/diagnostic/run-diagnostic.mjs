// DIAGNOSTIC / NOT CANONICAL (prep, 2026-10-07). The canonical gate is `node scripts/db-test/run-db-tests.mjs` UNCHANGED; it
// currently FAILS at the repo migration 20260929000000 (before any prep file) - see the fix report. This runner exists only to
// obtain engineering evidence for the prepared SQL against ALL repo migrations in order (none omitted, 20260930000000 included):
//   * it derives a temporary copy of the harness (make-diag-fidelity.cjs) that runs the files declaring a top-level SET LOCAL
//     inside one transaction, adds the Supabase platform default publication `supabase_realtime`, and seeds - immediately before
//     20260930000000 - the SOURCE ACL state that this migration itself declares (diag-pre-20260930-acl-seed.sql);
//   * it then runs canonical + prep tests, or one isolated SQL mutant at a time (--mutant lock|boundary|customer).
// Usage: node subscriptions-prep/diagnostic/run-diagnostic.mjs --out <result.json> [--mutant lock|boundary|customer]
// Exit: the harness exit code (mutant mode: 0 only if the intended assertion - and no earlier abort - caused the failure).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const OUT = opt('--out');
const MUTANT = opt('--mutant');
if (!OUT) { console.error('--out <file> required'); process.exit(2); }

const SQL = path.join(ROOT, 'subscriptions-prep', 'sql', 'PREPARED_20261007000000_free10_issue_ledger.sql');
// each mutant: exactly one textual change (first occurrence) + the assertion that must catch it
const MUTANTS = {
  lock: { from: 'SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object(\'ok\', false, \'code\', \'account_not_provisioned\');\n  END IF;\n\n  -- (3) quote',
          to: 'SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object(\'ok\', false, \'code\', \'account_not_provisioned\');\n  END IF;\n\n  -- (3) quote',
          expect: /^FAIL: A1 \[race on credit 10\]/, file: '101_free10_concurrency.mjs' },
  boundary: { from: 'IF v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN',
              to: 'IF v_ent.free_issues_consumed + v_reserved > v_ent.free_issue_limit THEN',
              expect: /^FAIL: F3 \[boundary\]/, file: '100_free10_issue_ledger.sql' },
  customer: { from: "IF coalesce(v_q.client_id::text, 'none') <> v_a.customer_binding THEN",
              to: 'IF false THEN',
              expect: /^FAIL: I5 \[customer check\]/, file: '100_free10_issue_ledger.sql' },
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tekango-prep-diag-'));
const harness = path.join(ROOT, 'scripts', 'db-test', `.diag-fidelity-${process.pid}.tmp.mjs`);
let migDir = path.join(ROOT, 'subscriptions-prep', 'sql');
try {
  const mk = spawnSync(process.execPath, [path.join(HERE, 'make-diag-fidelity.cjs'), path.join(ROOT, 'scripts', 'db-test', 'run-db-tests.mjs'), harness], { encoding: 'utf8' });
  if (mk.status !== 0) throw new Error(`make-diag-fidelity failed: ${mk.stderr}`);
  if (MUTANT) {
    const m = MUTANTS[MUTANT];
    if (!m) throw new Error(`unknown mutant ${MUTANT}`);
    const src = fs.readFileSync(SQL, 'utf8').replace(/\r\n/g, '\n');
    if (!src.includes(m.from)) throw new Error(`mutant ${MUTANT}: pattern not found`);
    migDir = path.join(tmp, 'sql');
    fs.mkdirSync(migDir);
    fs.writeFileSync(path.join(migDir, path.basename(SQL)), src.replace(m.from, m.to));
  }
  const run = spawnSync(process.execPath, [harness, '--extra-migrations', migDir, '--extra-tests-dir', path.join(ROOT, 'subscriptions-prep', 'db-tests'), '--out', OUT],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(run.stdout); process.stderr.write(run.stderr);
  if (!MUTANT) process.exitCode = run.status ?? 1;
  else {
    const r = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const m = MUTANTS[MUTANT];
    const t = r.tests.find((x) => x.file === m.file);
    const firstFail = t?.assertions.find((a) => a.startsWith('FAIL')) ?? null;
    const caught = Boolean(t) && t.status === 'FAIL' && !t.error && t.assertions.some((a) => m.expect.test(a));
    const verdict = { mutant: MUTANT, change: { from: m.from.split('\n')[0], to: m.to.split('\n')[0] }, testFile: m.file,
      intendedAssertion: String(m.expect), caughtByIntended: caught, firstFailingAssertion: firstFail,
      abortedEarly: Boolean(t?.error), fileError: t?.error ?? null, allMigrationsApplied: r.migrations.every((x) => x.ok) };
    fs.writeFileSync(OUT.replace(/\.json$/, '.verdict.json'), `${JSON.stringify(verdict, null, 2)}\n`);
    console.log(`MUTANT ${MUTANT}: ${caught ? 'CAUGHT by the intended assertion' : 'NOT caught as intended'} (first FAIL: ${firstFail})`);
    process.exitCode = caught ? 0 : 1;
  }
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exitCode = 1;
} finally {
  fs.rmSync(harness, { force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
}
