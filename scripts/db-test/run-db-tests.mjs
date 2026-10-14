// Disposable database test harness (LOCAL ONLY). Starts a throwaway postgres:17 container (--rm), applies the Supabase
// platform stubs + EVERY repo migration in version order under an explicit EXECUTION CONTRACT + the SQL test files under
// scripts/db-test/tests, and writes a machine-readable result. It never connects to TEST or Production and needs no credentials.
//   node scripts/db-test/run-db-tests.mjs [--out result.json] [--keep] [--only <test-file-substring>]
//     [--extra-migrations <dir>]  opt-in: *.sql files in <dir> applied AFTER the repo migrations; each must declare its own
//                                 contract in a header line `-- tekango-migration-contract: mode=<transaction|autocommit>
//                                 replay=<required|not-declared>`.
//     [--extra-tests-dir <dir>]   opt-in: run the *.sql / *.mjs tests of <dir> IN ADDITION to (after) scripts/db-test/tests;
//                                 the canonical tests always run.
//     [--contract <file>]         CONTROL ONLY: use another execution contract (negative controls). Never a gate.
//   Execution contract (scripts/db-test/migration-contract.json, every repo migration pinned by filename + sha256):
//     mode=transaction  -> the file runs inside ONE transaction (psql --single-transaction), as its header requires
//     mode=autocommit   -> statement by statement (required for CREATE INDEX CONCURRENTLY; legacy default otherwise)
//     preFixture        -> a pinned platform fixture applied immediately before the migration (path + sha256 in the result)
//     replay=required   -> re-applied IMMEDIATELY on its own post-state under the same mode (idempotency); never after
//                          re-running the whole chain. replay=not-declared -> not replayed (reported).
//   An unclassified migration, a hash mismatch or a fixture hash mismatch fails closed before anything is applied.
//   --only produces a FOCUSED run and --contract a CONTROL run: their verdict is never PASS (exit 3 when otherwise green).
//   Arguments are parsed strictly: an unknown flag or a flag without its value exits 2 before any container is started.
//   The result carries the execution mode of every migration, fixture hashes, replay base, test manifests and cleanup.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
// strict parsing: every flag is known; a value flag needs a value that is not itself a flag
const VALUE_FLAGS = new Set(['--out', '--only', '--extra-migrations', '--extra-tests-dir', '--contract']);
const BOOL_FLAGS = new Set(['--keep']);
const parsed = {};
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (BOOL_FLAGS.has(a)) { parsed[a] = true; continue; }
  if (VALUE_FLAGS.has(a)) {
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) { console.error(`${a} requires a value`); process.exit(2); }
    parsed[a] = v;
    i += 1;
    continue;
  }
  console.error(`unknown argument ${JSON.stringify(a)}`);
  process.exit(2);
}
const OUT = parsed['--out'] ?? null;
const ONLY = parsed['--only'] ?? null;
const KEEP = parsed['--keep'] === true;
// opt-in directories; a flag given without a usable directory fails closed before any container is started
const dirOpt = (n) => {
  if (!(n in parsed)) return null;
  const v = parsed[n];
  if (!fs.existsSync(v) || !fs.statSync(v).isDirectory()) {
    console.error(`${n} requires an existing directory (got ${JSON.stringify(v)})`);
    process.exit(2);
  }
  return path.resolve(v);
};
const EXTRA_MIG_DIR = dirOpt('--extra-migrations');
const EXTRA_TESTS_DIR = dirOpt('--extra-tests-dir');
const CANONICAL_CONTRACT = path.join(HERE, 'migration-contract.json');
const CONTRACT_PATH = parsed['--contract'] ? path.resolve(parsed['--contract']) : CANONICAL_CONTRACT;
if (!fs.existsSync(CONTRACT_PATH) || !fs.statSync(CONTRACT_PATH).isFile()) {
  console.error(`--contract requires an existing file (got ${JSON.stringify(parsed['--contract'] ?? CONTRACT_PATH)})`);
  process.exit(2);
}
const RUN_KIND = parsed['--contract'] ? 'CONTROL' : ONLY ? 'FOCUSED' : 'GATE';
const NAME = `tekango-dbtest-${Date.now()}`;
const IMAGE = 'postgres:17';

const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const docker = (...a) => execFileSync('docker', a, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
function psql(sql, { label, transaction = false }) {
  const r = spawnSync('docker', ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q',
    ...(transaction ? ['--single-transaction'] : []), '-f', '-'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { label, ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}
const firstLines = (s, n) => s.trim().split('\n').slice(0, n).join(' | ');
// version prefixes are compared right-padded to 16 digits so "202608270000015_x" sorts as 2026082700000150 (between 000001 and 000002)
const versionKey = (f) => (f.match(/^(\d+)_/)?.[1] ?? '').padEnd(16, '0');

const contractText = fs.readFileSync(CONTRACT_PATH, 'utf8');
const result = {
  harness: 'tekango disposable DB (postgres:17, --rm)', at: new Date().toISOString(), image: IMAGE, runKind: RUN_KIND,
  contract: { path: path.relative(ROOT, CONTRACT_PATH).split(path.sep).join('/'), sha256: sha(contractText), canonical: CONTRACT_PATH === CANONICAL_CONTRACT },
  only: ONLY, migrations: [], tests: [], verdict: 'FAIL',
};
let exitCode = 1;
let started = false;

// ---------------------------------------------------------------- execution plan (validated BEFORE any container starts)
function planOrExit() {
  let contract;
  try { contract = JSON.parse(contractText); } catch (e) { console.error(`contract is not JSON: ${e.message}`); process.exit(2); }
  const migDir = path.join(ROOT, 'supabase', 'migrations');
  // The *_capture_base_* files reconstruct the pre-existing platform schema (captured from the live project); every other
  // migration was authored against that base, so a fresh database applies the captures first, then the rest in version order.
  const isBase = (f) => /_capture_base_/.test(f);
  const byVersion = (a, b) => versionKey(a).localeCompare(versionKey(b)) || a.localeCompare(b);
  const all = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const order = [...all.filter(isBase).sort(byVersion), ...all.filter((f) => !isBase(f)).sort(byVersion)];
  const problems = [];
  const plan = [];
  for (const f of order) {
    const text = fs.readFileSync(path.join(migDir, f), 'utf8');
    const c = contract.migrations?.[f];
    if (!c) { problems.push(`${f}: no execution contract (unclassified migrations fail closed)`); continue; }
    if (c.sha256 !== sha(text)) problems.push(`${f}: sha256 ${sha(text)} != pinned ${c.sha256}`);
    if (!['transaction', 'autocommit'].includes(c.mode)) problems.push(`${f}: invalid mode ${c.mode}`);
    if (!['required', 'not-declared'].includes(c.replay)) problems.push(`${f}: invalid replay ${c.replay}`);
    let fixture = null;
    if (c.preFixture) {
      const fp = path.resolve(path.dirname(CONTRACT_PATH), c.preFixture);
      if (!fs.existsSync(fp)) problems.push(`${f}: fixture ${c.preFixture} missing`);
      else {
        const ft = fs.readFileSync(fp, 'utf8');
        if (sha(ft) !== c.preFixtureSha256) problems.push(`${f}: fixture sha256 ${sha(ft)} != pinned ${c.preFixtureSha256}`);
        fixture = { path: path.relative(ROOT, fp).split(path.sep).join('/'), sha256: sha(ft), text: ft };
      }
    }
    const prelude = (c.replayPrelude ?? []).map((p) => ({ file: p, text: fs.readFileSync(path.join(migDir, p), 'utf8') }));
    plan.push({ file: f, extra: false, text, mode: c.mode, replay: c.replay, basis: c.basis ?? null, fixture, prelude });
  }
  for (const f of Object.keys(contract.migrations ?? {})) if (!all.includes(f)) problems.push(`${f}: in the contract but not in supabase/migrations`);
  if (EXTRA_MIG_DIR) {
    const extras = fs.readdirSync(EXTRA_MIG_DIR).filter((f) => f.endsWith('.sql')).sort(byVersion);
    if (!extras.length) problems.push(`--extra-migrations ${EXTRA_MIG_DIR} contains no .sql file`);
    for (const f of extras) {
      const text = fs.readFileSync(path.join(EXTRA_MIG_DIR, f), 'utf8');
      const m = text.match(/^-- tekango-migration-contract: mode=(transaction|autocommit) replay=(required|not-declared)\s*$/m);
      if (!m) { problems.push(`extra ${f}: no '-- tekango-migration-contract:' header (fails closed)`); continue; }
      plan.push({ file: f, extra: true, dir: EXTRA_MIG_DIR, text, mode: m[1], replay: m[2], basis: 'file header', fixture: null, prelude: [] });
    }
  }
  if (problems.length) { console.error(`EXECUTION CONTRACT REFUSED:\n  ${problems.join('\n  ')}`); process.exit(2); }
  return plan;
}
const PLAN = planOrExit();

try {
  docker('run', '-d', '--rm', '--name', NAME, '-e', 'POSTGRES_PASSWORD=disposable', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE);
  started = true;
  for (let i = 0; i < 60; i += 1) {
    const r = spawnSync('docker', ['exec', NAME, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' });
    if (r.status === 0) {
      // the entrypoint restarts postgres once after init; require a real query to succeed
      const q = spawnSync('docker', ['exec', NAME, 'psql', '-U', 'postgres', '-tAc', 'select 1'], { encoding: 'utf8' });
      if (q.status === 0 && q.stdout.trim() === '1') break;
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  const stubs = fs.readFileSync(path.join(HERE, 'stubs.sql'), 'utf8');
  const s = psql(stubs, { label: 'stubs.sql' });
  if (!s.ok) throw new Error(`stubs failed:\n${s.stderr}`);

  for (const p of PLAN) {
    const transaction = p.mode === 'transaction';
    const row = { file: p.file, ...(p.extra ? { extra: true } : {}), sha256: sha(p.text), executionMode: p.mode, contractBasis: p.basis };
    result.migrations.push(row);
    if (p.fixture) {
      const fx = psql(p.fixture.text, { label: `fixture:${p.fixture.path}`, transaction: true });
      row.preFixture = { path: p.fixture.path, sha256: p.fixture.sha256, ok: fx.ok, error: fx.ok ? undefined : firstLines(fx.stderr, 4) };
      if (!fx.ok) throw new Error(`fixture ${p.fixture.path} failed:\n${fx.stderr}`);
    }
    const r = psql(p.text, { label: p.file, transaction });
    row.ok = r.ok;
    if (!r.ok) { row.error = firstLines(r.stderr, 6); throw new Error(`${p.extra ? 'extra ' : ''}migration ${p.file} failed:\n${r.stderr}`); }
    // idempotency: replay IMMEDIATELY on this migration's own post-state, under the same mode
    if (p.replay === 'required') {
      for (const pre of p.prelude) psql(pre.text, { label: `prelude:${pre.file}` });
      const rr = psql(p.text, { label: `${p.file} (replay)`, transaction });
      row.replay = { required: true, base: p.prelude.length ? `after re-applying ${p.prelude.map((x) => x.file).join(', ')}` : 'immediate-post-state',
        ok: rr.ok, error: rr.ok ? undefined : firstLines(rr.stderr, 4),
        ...(p.prelude.length ? { status: 'FIXTURE_INVALID_NOT_IDEMPOTENCY' } : {}) };
    } else {
      row.replay = { required: false, status: 'not-declared' };
    }
  }

  const helpers = fs.readFileSync(path.join(HERE, 'helpers.sql'), 'utf8');
  const h = psql(helpers, { label: 'helpers.sql' });
  if (!h.ok) throw new Error(`helpers failed:\n${h.stderr}`);

  // canonical tests first (always), then the opt-in extra tests; each suite runs its SQL files, then its multi-session .mjs
  const suites = [{ suite: 'canonical', dir: path.join(HERE, 'tests') }, ...(EXTRA_TESTS_DIR ? [{ suite: 'extra', dir: EXTRA_TESTS_DIR }] : [])];
  if (EXTRA_TESTS_DIR) result.extraTestsDir = EXTRA_TESTS_DIR;
  for (const { suite, dir: testDir } of suites) {
  for (const f of fs.readdirSync(testDir).filter((x) => x.endsWith('.sql') && (!ONLY || x.includes(ONLY))).sort()) {
    const text = fs.readFileSync(path.join(testDir, f), 'utf8');
    const r = psql(text, { label: f });
    const notices = `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.replace(/^.*?NOTICE:\s*/, '')).filter((l) => /^(PASS|FAIL)\b/.test(l));
    const failed = !r.ok || notices.some((n) => n.startsWith('FAIL'));
    result.tests.push({ file: f, ...(suite === 'extra' ? { suite } : {}), sha256: sha(text), status: failed ? 'FAIL' : 'PASS', assertions: notices, error: r.ok ? undefined : r.stderr.trim().split('\n').filter((l) => /ERROR|CONTEXT/.test(l)).slice(0, 6).join(' | ') });
    console.log(`${failed ? 'FAIL' : 'PASS'}  ${f}  (${notices.filter((n) => n.startsWith('PASS')).length} assertions)`);
    if (failed) for (const n of notices.filter((x) => x.startsWith('FAIL'))) console.log(`      ${n}`);
    if (!r.ok) console.log(`      ${result.tests.at(-1).error}`);
  }
  // Multi-session tests (e.g. overlapping claims): tests/*.mjs export default async ({ container, psql, root }) and return
  // { assertions: ['PASS: ...' | 'FAIL: ...'] }. They run after the SQL files, against the same disposable container.
  for (const f of fs.readdirSync(testDir).filter((x) => x.endsWith('.mjs') && (!ONLY || x.includes(ONLY))).sort()) {
    const text = fs.readFileSync(path.join(testDir, f), 'utf8');
    let assertions = [];
    let error;
    try {
      const mod = await import(pathToFileURL(path.join(testDir, f)).href);
      assertions = (await mod.default({ container: NAME, psql, root: ROOT })).assertions ?? [];
    } catch (e) {
      error = String(e?.stack ?? e).slice(0, 1500);
    }
    const failed = Boolean(error) || assertions.length === 0 || assertions.some((n) => n.startsWith('FAIL'));
    result.tests.push({ file: f, ...(suite === 'extra' ? { suite } : {}), sha256: sha(text), status: failed ? 'FAIL' : 'PASS', assertions, error });
    console.log(`${failed ? 'FAIL' : 'PASS'}  ${f}  (${assertions.filter((n) => n.startsWith('PASS')).length} assertions)`);
    if (failed) for (const n of assertions.filter((x) => x.startsWith('FAIL'))) console.log(`      ${n}`);
    if (error) console.log(`      ${error}`);
  }
  }
  const allMigOk = result.migrations.every((m) => m.ok && (!m.replay?.required || (m.replay.ok && !m.replay.status)));
  const allTestsOk = result.tests.length > 0 && result.tests.every((t) => t.status === 'PASS');
  const green = allMigOk && allTestsOk;
  result.verdict = !green ? 'FAIL' : RUN_KIND === 'GATE' ? 'PASS' : `${RUN_KIND}_NOT_A_GATE`;
  const bad = result.migrations.filter((m) => m.replay?.required && (!m.replay.ok || m.replay.status));
  if (bad.length) console.log(`replay (idempotency) failures: ${bad.map((m) => `${m.file} [${m.replay.status ?? 'REQUIRED'}]`).join(', ')}`);
  exitCode = !green ? 1 : RUN_KIND === 'GATE' ? 0 : 3;
} catch (e) {
  result.error = String(e.message).slice(0, 4000);
  console.error(result.error);
} finally {
  // cleanup: only the container THIS run created (by exact name); nothing else is touched
  if (!started) result.cleanup = { container: NAME, created: false };
  else if (KEEP) { result.cleanup = { container: NAME, kept: true }; console.log(`container kept: ${NAME}`); }
  else {
    const st = spawnSync('docker', ['stop', NAME], { encoding: 'utf8' });
    const left = spawnSync('docker', ['ps', '-a', '--filter', `name=^${NAME}$`, '--format', '{{.Names}}'], { encoding: 'utf8' });
    result.cleanup = { container: NAME, stopExit: st.status, removed: st.status === 0 && left.status === 0 && left.stdout.trim() === '' };
  }
}
// manifest of what was actually executed (also on failure), in execution order
result.manifest = {
  migrationsApplied: result.migrations.map((m) => ({ file: m.extra ? `extra:${m.file}` : m.file, mode: m.executionMode,
    replay: m.replay ? (m.replay.required ? `${m.replay.base}:${m.replay.ok ? 'ok' : 'FAIL'}${m.replay.status ? `:${m.replay.status}` : ''}` : 'not-declared') : null,
    fixture: m.preFixture ? `${m.preFixture.path}@${m.preFixture.sha256}` : null })),
  canonicalTests: result.tests.filter((t) => !t.suite).map((t) => t.file),
  extraTests: result.tests.filter((t) => t.suite === 'extra').map((t) => t.file),
};
console.log(`DISPOSABLE DB ${RUN_KIND}: ${result.verdict} (${result.migrations.length} migrations, ${result.tests.filter((t) => t.status === 'PASS').length}/${result.tests.length} test files PASS)`);
if (OUT) fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
process.exit(exitCode);
