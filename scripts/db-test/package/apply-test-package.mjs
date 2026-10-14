// Task 29 - the verified apply / re-apply route of the TEST package (LOCAL, reviewable tooling; it never connects to TEST by itself).
//
// The real replay contract (scripts/db-test/run-db-tests.mjs + migration-contract.json): replay=required means a migration re-run
// IMMEDIATELY on its own post-state is idempotent - NOT that it may be re-run after the whole package. Measured on the full post-package
// state (Task 29, DB harness): 16 of the 17 package migrations re-run cleanly; A1 (20261009180000) refuses by design, because its
// fail-closed guard accepts only its exact column shape and A5 (20261011120000) later adds tasks.kind. No migration byte, pin or guard is
// changed for this. Instead, every plan entry declares HOW it is (re)applied:
//   reapply: "rerun"         -> always executed (exact pinned bytes, its contract mode); its own guards still protect it; failure = STOP
//   reapply: "postcondition" -> a READ-ONLY probe first: absent -> apply, then the probe must recognize the applied state; a recognized
//                               state (A1 alone, or A1 extended by A5) -> verified skip; anything else (foreign / corrupted / partial)
//                               -> STOP. Never "ignore errors", never a weakened guard.
// Every file is checked against BOTH the plan sha256 and the harness contract sha256 before anything runs (fail closed).
// Execution is injected (exec(sql, { transaction }) -> { ok, out, err }), so the same decision logic runs in the disposable harness
// (docker psql) and could later drive the guarded TEST channel - which needs separately authorized pinned bundles (not done here).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const sameState = (actual, expected) => Object.entries(expected).every(([k, v]) => actual?.[k] === v);

export function loadPlan(root) {
  const planPath = path.join(root, 'scripts', 'db-test', 'package', 'test-package-plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'db-test', 'migration-contract.json'), 'utf8')).migrations;
  const problems = [];
  const entries = plan.migrations.map((m) => {
    const text = fs.readFileSync(path.join(root, 'supabase', 'migrations', m.file), 'utf8');
    const d = sha(text);
    if (d !== m.sha256) problems.push(`${m.file}: file sha256 ${d} != plan ${m.sha256}`);
    if (contract[m.file]?.sha256 !== m.sha256) problems.push(`${m.file}: plan sha256 != harness contract ${contract[m.file]?.sha256 ?? 'missing'}`);
    if (contract[m.file]?.mode !== 'transaction') problems.push(`${m.file}: only transaction-mode migrations are packaged (got ${contract[m.file]?.mode})`);
    if (!['rerun', 'postcondition'].includes(m.reapply)) problems.push(`${m.file}: unknown reapply ${m.reapply}`);
    let probe = null;
    if (m.reapply === 'postcondition') {
      probe = fs.readFileSync(path.join(root, 'scripts', 'db-test', 'package', m.probe), 'utf8');
      if (sha(probe) !== m.probeSha256) problems.push(`${m.file}: probe sha256 ${sha(probe)} != plan ${m.probeSha256}`);
      if (!Array.isArray(m.recognizedStates) || m.recognizedStates.length === 0) problems.push(`${m.file}: no recognized states`);
    }
    return { ...m, text, probe };
  });
  const sorted = [...plan.migrations].map((m) => m.file).sort();
  if (JSON.stringify(sorted) !== JSON.stringify(plan.migrations.map((m) => m.file))) problems.push('plan is not in filename (apply) order');
  return { plan, entries, problems };
}

export function classifyProbe(entry, raw) {
  let p;
  try { p = JSON.parse(String(raw).trim().split('\n').pop()); } catch { return { state: 'invalid', reason: 'probe output unreadable' }; }
  if (p.exists === false) return { state: 'absent', probe: p };
  for (const s of entry.recognizedStates) if (sameState(p, s.expect)) return { state: 'applied', recognized: s.name, probe: p };
  const near = entry.recognizedStates.map((s) => ({ name: s.name, differs: Object.keys(s.expect).filter((k) => p[k] !== s.expect[k]) }));
  return { state: 'invalid', reason: `not a recognized state: ${near.map((n) => `${n.name} differs in ${n.differs.join('|')}`).join('; ')}`, probe: p };
}

// groups: e.g. ['A'] or ['A', 'B']; the order is always the plan (filename) order of the selected groups.
export async function applyPackage({ root, exec, groups = ['A', 'B'], only = null }) {
  const { entries, problems } = loadPlan(root);
  const report = { ok: false, problems, steps: [] };
  if (problems.length) return report;
  for (const e of entries.filter((x) => groups.includes(x.group) && (!only || only.includes(x.file)))) {
    if (e.reapply === 'rerun') {
      const r = await exec(e.text, { transaction: true });
      report.steps.push({ file: e.file, action: 'applied', ok: r.ok, error: r.ok ? undefined : r.err.split('\n').find((l) => /ERROR/.test(l)) || r.err.slice(0, 300) });
      if (!r.ok) return report;
      continue;
    }
    const before = classifyProbe(e, (await exec(e.probe, { transaction: true })).out);
    if (before.state === 'invalid') { report.steps.push({ file: e.file, action: 'refused', ok: false, error: before.reason }); return report; }
    if (before.state === 'applied') { report.steps.push({ file: e.file, action: 'verified-already-applied', recognized: before.recognized, ok: true }); continue; }
    const r = await exec(e.text, { transaction: true });
    if (!r.ok) { report.steps.push({ file: e.file, action: 'applied', ok: false, error: r.err.split('\n').find((l) => /ERROR/.test(l)) || r.err.slice(0, 300) }); return report; }
    const after = classifyProbe(e, (await exec(e.probe, { transaction: true })).out);
    const ok = after.state === 'applied';
    report.steps.push({ file: e.file, action: 'applied', ok, recognized: after.recognized, error: ok ? undefined : `postcondition after apply: ${after.reason || after.state}` });
    if (!ok) return report;
  }
  report.ok = true;
  return report;
}

// LOCAL CLI (disposable container only): node scripts/db-test/package/apply-test-package.mjs --container <tekango-dbtest-*> --db <db> [--groups A,B]
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const container = arg('--container'); const db = arg('--db') || 'postgres';
  if (!container || !/^tekango-dbtest-\d+$/.test(container)) { console.error('local use only: --container must be a disposable tekango-dbtest-* harness container'); process.exit(2); }
  const { spawnSync } = await import('node:child_process');
  const exec = async (sql, { transaction }) => {
    const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', ...(transaction ? ['--single-transaction'] : []), '-f', '-'], { input: sql, encoding: 'utf8' });
    return { ok: r.status === 0, out: r.stdout, err: r.stderr };
  };
  const r = await applyPackage({ root: process.cwd(), exec, groups: (arg('--groups') || 'A,B').split(',') });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
