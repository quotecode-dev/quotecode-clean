// Disposable database test harness (LOCAL ONLY). Starts a throwaway postgres:17 container (--rm), applies the Supabase
// platform stubs + EVERY repo migration in version order + the SQL test files under scripts/db-test/tests, and writes a
// machine-readable result. It never connects to TEST or Production and needs no credentials.
//   node scripts/db-test/run-db-tests.mjs [--out result.json] [--keep] [--only <test-file-substring>]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const OUT = opt('--out');
const ONLY = opt('--only');
const KEEP = args.includes('--keep');
const NAME = `tekango-dbtest-${Date.now()}`;
const IMAGE = 'postgres:17';

const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n')).digest('hex');
const docker = (...a) => execFileSync('docker', a, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
function psql(sql, { label }) {
  const r = spawnSync('docker', ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', '-'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { label, ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}
// version prefixes are compared right-padded to 16 digits so "202608270000015_x" sorts as 2026082700000150 (between 000001 and 000002)
const versionKey = (f) => (f.match(/^(\d+)_/)?.[1] ?? '').padEnd(16, '0');

const result = { harness: 'tekango disposable DB (postgres:17, --rm)', at: new Date().toISOString(), image: IMAGE, migrations: [], tests: [], verdict: 'FAIL' };
let exitCode = 1;
try {
  docker('run', '-d', '--rm', '--name', NAME, '-e', 'POSTGRES_PASSWORD=disposable', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE);
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

  const migDir = path.join(ROOT, 'supabase', 'migrations');
  // The *_capture_base_* files reconstruct the pre-existing platform schema (captured from the live project); every other
  // migration was authored against that base, so a fresh database applies the captures first, then the rest in version order.
  const isBase = (f) => /_capture_base_/.test(f);
  const byVersion = (a, b) => versionKey(a).localeCompare(versionKey(b)) || a.localeCompare(b);
  const all = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const migs = [...all.filter(isBase).sort(byVersion), ...all.filter((f) => !isBase(f)).sort(byVersion)];
  for (const f of migs) {
    const text = fs.readFileSync(path.join(migDir, f), 'utf8');
    const r = psql(text, { label: f });
    result.migrations.push({ file: f, sha256: sha(text), ok: r.ok, error: r.ok ? undefined : r.stderr.trim().split('\n').slice(0, 6).join(' | ') });
    if (!r.ok) throw new Error(`migration ${f} failed:\n${r.stderr}`);
  }
  // idempotency: every migration re-applied on top of itself must also succeed
  for (const f of migs) {
    const r = psql(fs.readFileSync(path.join(migDir, f), 'utf8'), { label: `${f} (re-run)` });
    const m = result.migrations.find((x) => x.file === f);
    m.rerunOk = r.ok;
    if (!r.ok) m.rerunError = r.stderr.trim().split('\n').slice(0, 4).join(' | ');
  }

  const helpers = fs.readFileSync(path.join(HERE, 'helpers.sql'), 'utf8');
  const h = psql(helpers, { label: 'helpers.sql' });
  if (!h.ok) throw new Error(`helpers failed:\n${h.stderr}`);

  const testDir = path.join(HERE, 'tests');
  for (const f of fs.readdirSync(testDir).filter((x) => x.endsWith('.sql') && (!ONLY || x.includes(ONLY))).sort()) {
    const text = fs.readFileSync(path.join(testDir, f), 'utf8');
    const r = psql(text, { label: f });
    const notices = `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.replace(/^.*?NOTICE:\s*/, '')).filter((l) => /^(PASS|FAIL)\b/.test(l));
    const failed = !r.ok || notices.some((n) => n.startsWith('FAIL'));
    result.tests.push({ file: f, sha256: sha(text), status: failed ? 'FAIL' : 'PASS', assertions: notices, error: r.ok ? undefined : r.stderr.trim().split('\n').filter((l) => /ERROR|CONTEXT/.test(l)).slice(0, 6).join(' | ') });
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
    result.tests.push({ file: f, sha256: sha(text), status: failed ? 'FAIL' : 'PASS', assertions, error });
    console.log(`${failed ? 'FAIL' : 'PASS'}  ${f}  (${assertions.filter((n) => n.startsWith('PASS')).length} assertions)`);
    if (failed) for (const n of assertions.filter((x) => x.startsWith('FAIL'))) console.log(`      ${n}`);
    if (error) console.log(`      ${error}`);
  }
  // Re-run idempotency is MANDATORY for migrations prepared by the current closure (version >= 20260922000000); legacy files
  // that were already applied long ago are reported but do not gate (e.g. 20260827000000 is not re-runnable by design).
  const isNew = (f) => versionKey(f) >= '2026092200000000';
  for (const m of result.migrations) m.idempotencyRequired = isNew(m.file);
  const allMigOk = result.migrations.every((m) => m.ok && (m.rerunOk || !m.idempotencyRequired));
  const allTestsOk = result.tests.length > 0 && result.tests.every((t) => t.status === 'PASS');
  result.verdict = allMigOk && allTestsOk ? 'PASS' : 'FAIL';
  const bad = result.migrations.filter((m) => !m.rerunOk);
  if (bad.length) console.log(`re-run (idempotency) failures: ${bad.map((m) => `${m.file}${m.idempotencyRequired ? ' [REQUIRED]' : ' [legacy, informational]'}`).join(', ')}`);
  exitCode = result.verdict === 'PASS' ? 0 : 1;
} catch (e) {
  result.error = String(e.message).slice(0, 4000);
  console.error(result.error);
} finally {
  if (!KEEP) spawnSync('docker', ['stop', NAME], { encoding: 'utf8' });
  else console.log(`container kept: ${NAME}`);
}
console.log(`DISPOSABLE DB GATE: ${result.verdict} (${result.migrations.length} migrations, ${result.tests.filter((t) => t.status === 'PASS').length}/${result.tests.length} test files PASS)`);
if (OUT) fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
process.exit(exitCode);
