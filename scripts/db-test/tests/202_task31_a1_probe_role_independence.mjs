// Task 31 - the A1 postcondition probe must give the SAME answer whatever role executes it. On TEST the guarded read-only channel
// (/database/query/read-only) runs as supabase_read_only_user, while the harness captured the recognized states as postgres. A read-only
// role here = NOLOGIN, member of pg_read_all_data (as on Supabase), no other grant. Proves: (1) the current probe (grants from
// pg_class.relacl) is byte-identical as postgres and as the read-only role, and is recognized as the post-package state; (2) the Task 29
// probe text (grants from information_schema.role_table_grants) did NOT survive the role change - the finding this fix closes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const psql = (sql) => {
    const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], { input: sql, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr.slice(0, 400));
    return r.stdout.trim().split('\n').pop();
  };
  const base = root || process.cwd();
  const { loadPlan, classifyProbe } = await import(pathToFileURL(path.join(base, 'scripts', 'db-test', 'package', 'apply-test-package.mjs')).href);
  const { entries } = loadPlan(base);
  const a1 = entries.find((e) => e.reapply === 'postcondition');
  psql(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tk_read_only_probe') THEN CREATE ROLE tk_read_only_probe NOLOGIN; END IF; END $$;
GRANT pg_read_all_data TO tk_read_only_probe;`);
  const asRo = (sql) => psql(`SET ROLE tk_read_only_probe;\nSET default_transaction_read_only = on;\n${sql}`);
  const asPg = (sql) => psql(sql);

  const pg = asPg(a1.probe);
  const ro = asRo(a1.probe);
  ok(pg === ro, 'current probe: identical JSON as postgres and as a pg_read_all_data read-only role', { pg: pg.slice(0, 120), ro: ro.slice(0, 120) });
  const cls = classifyProbe(a1, ro);
  ok(cls.state === 'applied' && cls.recognized === 'a1_extended_by_a5', 'current probe as the read-only role: recognized as A1 extended by A5 (the full-chain state)', cls);
  ok(JSON.parse(ro).grants === a1.recognizedStates.find((s) => s.name === 'a1_extended_by_a5').expect.grants, 'grants string equals the captured recognized value', JSON.parse(ro).grants);

  const old = fs.readFileSync(path.join(base, 'evidence', 'task31', 'probe.before.sql'), 'utf8');
  const oldPg = JSON.parse(asPg(old)); const oldRo = JSON.parse(asRo(old));
  ok(oldPg.grants === JSON.parse(pg).grants, 'the Task 29 probe as postgres matches (the states were captured as postgres)', oldPg.grants);
  ok(oldRo.grants !== oldPg.grants, 'the Task 29 probe as the read-only role differs in grants (information_schema hides them) - the closed finding', { ro: oldRo.grants, pg: oldPg.grants });
  psql('REVOKE pg_read_all_data FROM tk_read_only_probe; DROP ROLE tk_read_only_probe;');
  return { assertions };
}
