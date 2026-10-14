// Task 18 fail-closed proof: the migration 20261009180000 is re-run (its real bytes) on top of an INCOMPATIBLE pre-existing
// public.tasks and must refuse with TK_TASK18_INCOMPATIBLE - it never adopts, alters or drops a foreign object. Three variants:
// another column shape, the right columns without the named checks, and a non-table object. Each runs in ONE psql session inside
// BEGIN ... ROLLBACK (ON_ERROR_STOP), so nothing is left for later suites. The compatible re-run is proven by the runner's replay.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATION = path.join('supabase', 'migrations', '20261009180000_task18_durable_manual_tasks.sql');

function psqlSession(container, sql) {
  return new Promise((resolve) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, out, err }));
    p.stdin.end(sql);
  });
}

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const migration = fs.readFileSync(path.join(root, MIGRATION), 'utf8');
  const variants = [
    ['another column shape', 'CREATE TABLE public.tasks (id uuid PRIMARY KEY, title text, owner uuid);', /TK_TASK18_INCOMPATIBLE: public\.tasks exists with another column shape/],
    ['same columns without the named checks', 'CREATE TABLE public.tasks (LIKE public.tasks_t18_saved INCLUDING DEFAULTS); ALTER TABLE public.tasks DROP COLUMN IF EXISTS kind;' /* Task 28 added tasks.kind later; this variant is the Task 18 column set without its checks */, /TK_TASK18_INCOMPATIBLE: public\.tasks lacks the checks/],
    ['a view named public.tasks', 'CREATE VIEW public.tasks AS SELECT 1 AS id;', /TK_TASK18_INCOMPATIBLE: public\.tasks exists and is not an ordinary table/],
  ];
  for (const [label, setup, expected] of variants) {
    const r = await psqlSession(container, `BEGIN;\nALTER TABLE public.tasks RENAME TO tasks_t18_saved;\n${setup}\n${migration}\nROLLBACK;\n`);
    ok(r.code !== 0 && expected.test(r.err), `incompatible pre-existing object refused (${label})`, { code: r.code, err: r.err.slice(0, 200) });
  }
  // the real table is untouched afterwards (every variant rolled back)
  const after = await psqlSession(container, "SELECT (pg_catalog.to_regclass('public.tasks') IS NOT NULL)::text || '|' || (pg_catalog.to_regclass('public.tasks_t18_saved') IS NULL)::text;");
  ok(after.code === 0 && after.out.trim() === 'true|true', 'the real public.tasks is unchanged after the refused runs', after.out.trim());
  return { assertions };
}
