// Isolated SQL mutants against the CANONICAL runner (scripts/db-test/run-db-tests.mjs, canonical contract, all migrations,
// canonical + prep tests). Each mutant = exactly ONE textual change in a temporary copy of the prepared SQL.
//   node subscriptions-prep/gate-controls/run-db-mutants.mjs --out-dir <evidence dir> [--only lock|boundary|customer]
// Per mutant the verdict artifact records: original + mutant sha256, the single mutation, command, exit, intended assertion,
// first failing assertion, whether the intended assertion caught it, and that the test file did not abort early.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const opt = (n) => { const i = process.argv.indexOf(n); return i === -1 ? null : process.argv[i + 1]; };
const OUT_DIR = opt('--out-dir') ? path.resolve(opt('--out-dir')) : null;
if (!OUT_DIR) { console.error('--out-dir <dir> required'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
const SQL = path.join(ROOT, 'subscriptions-prep', 'sql', 'PREPARED_20261007000000_free10_issue_ledger.sql');
const RUNNER = path.join(ROOT, 'scripts', 'db-test', 'run-db-tests.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');

const MUTANTS = {
  lock: {
    from: "SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id FOR UPDATE;\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');\n  END IF;\n\n  -- (3) quote",
    to: "SELECT * INTO v_ent FROM public.account_entitlements e WHERE e.user_id = p_user_id;\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'account_not_provisioned');\n  END IF;\n\n  -- (3) quote",
    intended: /^FAIL: A1 \[race on credit 10\]/, file: '101_free10_concurrency.mjs', note: 'prepare: the entitlement row lock removed' },
  boundary: {
    from: 'IF v_ent.free_issues_consumed + v_reserved >= v_ent.free_issue_limit THEN',
    to: 'IF v_ent.free_issues_consumed + v_reserved > v_ent.free_issue_limit THEN',
    intended: /^FAIL: F3 \[boundary\]/, file: '100_free10_issue_ledger.sql', note: 'prepare: quota boundary >= -> > (first occurrence = prepare)' },
  customer: {
    from: "IF coalesce(v_q.client_id::text, 'none') <> v_a.customer_binding THEN",
    to: 'IF false THEN',
    intended: /^FAIL: I5 \[customer check\]/, file: '100_free10_issue_ledger.sql', note: 'finalize: customer-binding check disabled' },
};
const selected = opt('--only') ? [opt('--only')] : Object.keys(MUTANTS);
const original = fs.readFileSync(SQL, 'utf8').replace(/\r\n/g, '\n');
const verdicts = [];
for (const name of selected) {
  const m = MUTANTS[name];
  if (!m) { console.error(`unknown mutant ${name}`); process.exit(2); }
  const count = original.split(m.from).length - 1;
  if (count < 1) { console.error(`mutant ${name}: pattern not found`); process.exit(2); }
  const mutant = original.replace(m.from, m.to);   // first occurrence only: exactly one change
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tekango-mutant-${name}-`));
  fs.writeFileSync(path.join(dir, path.basename(SQL)), mutant);
  const out = path.join(OUT_DIR, `mutant-${name}.result.json`);
  const args = [RUNNER, '--extra-migrations', dir, '--extra-tests-dir', path.join(ROOT, 'subscriptions-prep', 'db-tests'), '--out', out];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(OUT_DIR, `mutant-${name}.log`), `cmd: node ${args.map((a) => path.relative(ROOT, a) || a).join(' ')}\nexit: ${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`);
  fs.rmSync(dir, { recursive: true, force: true });
  let res = null; try { res = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { /* no result */ }
  const t = res?.tests.find((x) => x.file === m.file) ?? null;
  const firstFail = t?.assertions.find((a) => a.startsWith('FAIL')) ?? null;
  const verdict = {
    mutant: name, note: m.note, mutation: { from: m.from.split('\n')[0], to: m.to.split('\n')[0], occurrencesInOriginal: count, applied: 'first occurrence only' },
    originalSha256: sha(original), mutantSha256: sha(mutant), command: `node scripts/db-test/run-db-tests.mjs --extra-migrations <tmp mutant dir> --extra-tests-dir subscriptions-prep/db-tests`,
    exit: r.status, runVerdict: res?.verdict ?? null, testFile: m.file, intendedAssertion: String(m.intended), firstFailingAssertion: firstFail,
    caughtByIntendedFirst: Boolean(firstFail && m.intended.test(firstFail)), noEarlyAbort: Boolean(t) && !t.error,
    allMigrationsApplied: Boolean(res) && res.migrations.every((x) => x.ok), cleanup: res?.cleanup ?? null,
  };
  verdict.asIntended = verdict.exit === 1 && verdict.caughtByIntendedFirst && verdict.noEarlyAbort && verdict.allMigrationsApplied;
  fs.writeFileSync(path.join(OUT_DIR, `mutant-${name}.verdict.json`), `${JSON.stringify(verdict, null, 2)}\n`);
  console.log(`MUTANT ${name}: ${verdict.asIntended ? 'CAUGHT by the intended first assertion' : 'NOT as intended'} (first FAIL: ${firstFail})`);
  verdicts.push(verdict);
}
process.exit(verdicts.every((v) => v.asIntended) ? 0 : 1);
