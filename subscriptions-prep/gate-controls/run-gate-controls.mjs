// Negative controls for the canonical disposable-DB gate (CLAUDE_PREP_CLOSURE_SPEC.md section 4). LOCAL ONLY.
// Each control runs the REAL runner (scripts/db-test/run-db-tests.mjs) with a temporary contract and/or fixture (the CONTROL
// run kind, never a gate) and must fail exactly as intended. Nothing in supabase/migrations is changed.
//   node subscriptions-prep/gate-controls/run-gate-controls.mjs --out-dir <evidence dir>
// Exit 0 only if every control behaved as intended.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = (() => { const i = process.argv.indexOf('--out-dir'); return i === -1 ? null : path.resolve(process.argv[i + 1]); })();
if (!OUT_DIR) { console.error('--out-dir <dir> required'); process.exit(2); }
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUNNER = path.join(ROOT, 'scripts', 'db-test', 'run-db-tests.mjs');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'db-test', 'migration-contract.json'), 'utf8'));
const FIXTURE_REL = CONTRACT.migrations['20260930000000_converge_mirror_runtime_contract.sql'].preFixture;
const FIXTURE_ABS = path.join(ROOT, 'scripts', 'db-test', FIXTURE_REL);
const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tekango-gate-controls-'));
const M0929 = '20260929000000_drop_legacy_approve_quote_public.sql';
const M0930 = '20260930000000_converge_mirror_runtime_contract.sql';
const MIDX = '20260827000001_add_quote_number_unique_index.sql';

function contractWith(name, mutate) {
  const c = structuredClone(CONTRACT);
  for (const e of Object.values(c.migrations)) if (e.preFixture) e.preFixture = path.resolve(path.dirname(path.join(ROOT, 'scripts', 'db-test', 'x')), e.preFixture);
  mutate(c);
  const p = path.join(tmp, `${name}.contract.json`);
  fs.writeFileSync(p, `${JSON.stringify(c, null, 2)}\n`);
  return p;
}
function fixtureVariant(name, transform) {
  const text = transform(fs.readFileSync(FIXTURE_ABS, 'utf8').replace(/\r\n/g, '\n'));
  const p = path.join(tmp, `${name}.fixture.sql`);
  fs.writeFileSync(p, text);
  return { path: p, sha256: sha(text) };
}
function run(name, args) {
  const out = path.join(OUT_DIR, `control-${name}.json`);
  const r = spawnSync(process.execPath, [RUNNER, ...args, '--out', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(OUT_DIR, `control-${name}.log`), `cmd: node ${path.relative(ROOT, RUNNER)} ${[...args, '--out', out].join(' ')}\nexit: ${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`);
  let res = null;
  try { res = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { /* exit-2 controls write no result */ }
  return { exit: r.status, res, stderr: r.stderr, stdout: r.stdout };
}
const failingMigration = (res) => res?.migrations.find((m) => m.ok === false) ?? null;
const controls = [];
const record = (name, intended, ok, observed) => { controls.push({ name, intended, ok, observed }); console.log(`${ok ? 'PASS' : 'FAIL'}  control ${name}: ${intended}`); };

// sentinel: a container this run did NOT start for the gate; cleanup must never touch it
const SENTINEL = `tekango-gatectl-sentinel-${Date.now()}`;
spawnSync('docker', ['run', '-d', '--rm', '--name', SENTINEL, '-e', 'POSTGRES_PASSWORD=sentinel', 'postgres:17'], { encoding: 'utf8' });
try {
  // C1: 0929 without its transaction -> TKA00 TK_AQP_SEARCH_PATH at 0929
  {
    const c = contractWith('c1', (k) => { k.migrations[M0929].mode = 'autocommit'; });
    const r = run('C1-0929-autocommit', ['--contract', c]);
    const fm = failingMigration(r.res);
    record('C1-0929-autocommit', '0929 run outside a transaction is refused by its own TKA00 / TK_AQP_SEARCH_PATH check',
      r.exit === 1 && fm?.file === M0929 && /TK_AQP_SEARCH_PATH/.test(fm?.error ?? '') && r.res?.runKind === 'CONTROL' && r.res?.verdict === 'FAIL',
      { exit: r.exit, failing: fm?.file ?? null, error: fm?.error ?? null, cleanup: r.res?.cleanup ?? null });
  }
  // C2: the CONCURRENTLY migration misclassified as transactional -> refused
  {
    const c = contractWith('c2', (k) => { k.migrations[MIDX].mode = 'transaction'; });
    const r = run('C2-concurrent-index-in-transaction', ['--contract', c]);
    const fm = failingMigration(r.res);
    record('C2-concurrent-index-in-transaction', 'CREATE INDEX CONCURRENTLY classified as transactional fails',
      r.exit === 1 && fm?.file === MIDX && /CONCURRENTLY cannot run inside a transaction block/.test(fm?.error ?? ''),
      { exit: r.exit, failing: fm?.file ?? null, error: fm?.error ?? null, cleanup: r.res?.cleanup ?? null });
  }
  // C3: platform fixture without the publication -> 0930 TKM11
  {
    const fx = fixtureVariant('c3-no-publication', (t) => t.replace(/DO \$p\$ BEGIN[\s\S]*?END \$p\$;\n/, ''));
    const c = contractWith('c3', (k) => { k.migrations[M0930].preFixture = fx.path; k.migrations[M0930].preFixtureSha256 = fx.sha256; });
    const r = run('C3-missing-publication', ['--contract', c]);
    const fm = failingMigration(r.res);
    record('C3-missing-publication', '0930 refuses with TK_M1_PUBLICATION_MISSING (TKM11) when supabase_realtime is absent',
      r.exit === 1 && fm?.file === M0930 && /TK_M1_PUBLICATION_MISSING/.test(fm?.error ?? ''),
      { exit: r.exit, failing: fm?.file ?? null, error: fm?.error ?? null, fixtureSha256: fx.sha256 });
  }
  // C4: drifted ACL source (the column grant missing) -> 0930 TKM13
  {
    const fx = fixtureVariant('c4-acl-drift', (t) => t.replace(/GRANT INSERT \(professional_domain\), UPDATE \(professional_domain\) ON public\.business_settings TO authenticated;\n/g, ''));
    const c = contractWith('c4', (k) => { k.migrations[M0930].preFixture = fx.path; k.migrations[M0930].preFixtureSha256 = fx.sha256; });
    const r = run('C4-acl-drift', ['--contract', c]);
    const fm = failingMigration(r.res);
    record('C4-acl-drift', '0930 refuses with TK_M1_ACL_STATE (TKM13) when a governed ACL is neither source nor target',
      r.exit === 1 && fm?.file === M0930 && /TK_M1_ACL_STATE/.test(fm?.error ?? ''),
      { exit: r.exit, failing: fm?.file ?? null, error: fm?.error ?? null, fixtureSha256: fx.sha256 });
  }
  // C5: re-applying capture-base before the 0930 replay is NOT idempotency: reported FIXTURE_INVALID, never green
  {
    const c = contractWith('c5', (k) => { k.migrations[M0930].replayPrelude = ['20260830000002_capture_base_rls_grants.sql']; });
    const r = run('C5-replay-after-capture-base', ['--contract', c, '--only', 'zz-no-tests']);
    const m = r.res?.migrations.find((x) => x.file === M0930);
    record('C5-replay-after-capture-base', 'a replay preceded by re-applying capture-base is reported FIXTURE_INVALID_NOT_IDEMPOTENCY and never passes',
      r.exit !== 0 && m?.replay?.status === 'FIXTURE_INVALID_NOT_IDEMPOTENCY' && r.res?.verdict !== 'PASS',
      { exit: r.exit, replay: m?.replay ?? null, verdict: r.res?.verdict ?? null });
  }
  // C6: --extra-tests-dir + --only 100 is FOCUSED, never a canonical PASS
  {
    const r = run('C6-focused-only', ['--extra-migrations', 'subscriptions-prep/sql', '--extra-tests-dir', 'subscriptions-prep/db-tests', '--only', '100']);
    record('C6-focused-only', '--only produces FOCUSED_NOT_A_GATE (exit 3), never PASS; canonical tests filtered out are visible in the manifest',
      r.exit === 3 && r.res?.runKind === 'FOCUSED' && r.res?.verdict === 'FOCUSED_NOT_A_GATE',
      { exit: r.exit, verdict: r.res?.verdict ?? null, canonicalTests: r.res?.manifest?.canonicalTests ?? null, extraTests: r.res?.manifest?.extraTests ?? null });
  }
  // C7: strict flags exit 2 before Docker; an unclassified / changed migration fails closed before Docker
  {
    const cases = [['--bogus'], ['--out'], ['--extra-tests-dir'], ['--extra-tests-dir', 'does-not-exist'], ['--contract', 'does-not-exist.json'], ['--tests-dir', 'x']];
    const exits = cases.map((a) => spawnSync(process.execPath, [RUNNER, ...a], { cwd: ROOT, encoding: 'utf8' }).status);
    const unclassified = contractWith('c7-unclassified', (k) => { delete k.migrations[M0929]; });
    const changed = contractWith('c7-changed', (k) => { k.migrations[M0930].sha256 = '0'.repeat(64); });
    const u = spawnSync(process.execPath, [RUNNER, '--contract', unclassified], { cwd: ROOT, encoding: 'utf8' });
    const h = spawnSync(process.execPath, [RUNNER, '--contract', changed], { cwd: ROOT, encoding: 'utf8' });
    fs.writeFileSync(path.join(OUT_DIR, 'control-C7-flags.log'), JSON.stringify({ cases, exits, unclassified: { exit: u.status, stderr: u.stderr }, changed: { exit: h.status, stderr: h.stderr } }, null, 2));
    record('C7-flags-and-contract', 'bad flags exit 2; an unclassified or hash-changed migration is refused (exit 2) before any container starts',
      exits.every((e) => e === 2) && u.status === 2 && /no execution contract/.test(u.stderr) && h.status === 2 && /!= pinned/.test(h.stderr),
      { exits, unclassifiedExit: u.status, changedExit: h.status });
  }
  // C8: cleanup removed only the runs' own containers; the sentinel survived
  {
    const own = controls.map((c) => c.observed?.cleanup).filter(Boolean);
    const sentinelAlive = spawnSync('docker', ['ps', '--filter', `name=^${SENTINEL}$`, '--format', '{{.Names}}'], { encoding: 'utf8' }).stdout.trim() === SENTINEL;
    const leftovers = spawnSync('docker', ['ps', '-a', '--filter', 'name=tekango-dbtest-', '--format', '{{.Names}}'], { encoding: 'utf8' }).stdout.trim();
    record('C8-cleanup', 'failed runs remove only their own container (by exact name); an unrelated container is untouched',
      own.length >= 2 && own.every((c) => c.removed === true) && sentinelAlive && leftovers === '',
      { ownCleanups: own, sentinel: SENTINEL, sentinelAlive, leftovers });
  }
} finally {
  spawnSync('docker', ['stop', SENTINEL], { encoding: 'utf8' });   // created by this script only
  fs.rmSync(tmp, { recursive: true, force: true });
}
const allOk = controls.every((c) => c.ok);
fs.writeFileSync(path.join(OUT_DIR, 'gate-controls-summary.json'), `${JSON.stringify({ at: new Date().toISOString(), allOk, controls }, null, 2)}\n`);
console.log(`GATE CONTROLS: ${allOk ? 'ALL AS INTENDED' : 'NOT AS INTENDED'} (${controls.filter((c) => c.ok).length}/${controls.length})`);
process.exit(allOk ? 0 : 1);
