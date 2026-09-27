// NEGATIVE CONTROL for Codex Post-LIVE Wave 1 blocker 3 (disposable container only; never TEST / Production).
// 1. Runs the disposable DB harness with only 041 and --keep (real migration -> 041 must PASS).
// 2. In that kept container, replaces public.claim_trial_reminder with a naive check-then-act version (the shape of the
//    pre-remediation bug), resets the synthetic rows, and runs 041 again. 041 MUST now report FAIL (duplicate claims and
//    duplicate deliveries) - proving the concurrency test detects the bug class it guards against.
// 3. Stops (and thereby removes) the container.
//   node evidence/post-live-wave1-2026-09-27/codex-blocker-remediation/negative-control-naive-claim.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const harness = spawnSync(process.execPath, [path.join(ROOT, 'scripts/db-test/run-db-tests.mjs'), '--keep', '--only', '041'], { encoding: 'utf8' });
process.stdout.write(harness.stdout);
const container = /container kept: (tekango-dbtest-\d+)/.exec(harness.stdout)?.[1];
if (!container || harness.status !== 0) {
  console.error('real-implementation run did not PASS or no container was kept', harness.stderr);
  if (container) spawnSync('docker', ['stop', container]);
  process.exit(2);
}
try {
  const naive = `
TRUNCATE public.trial_reminder_deliveries;
UPDATE public.business_settings SET trial_reminder_3d_sent = false, trial_reminder_24h_sent = false WHERE user_id::text LIKE '00000000-0000-4000-900%';
CREATE OR REPLACE FUNCTION public.claim_trial_reminder(p_user_id uuid, p_stage text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE v uuid := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM public.trial_reminder_deliveries WHERE user_id = p_user_id AND stage = p_stage AND status <> 'failed') THEN RETURN NULL; END IF;
  PERFORM pg_sleep(0.05);
  INSERT INTO public.trial_reminder_deliveries (user_id, stage, status, claim_id, idempotency_key)
  VALUES (p_user_id, p_stage, 'claimed', v, 'naive/' || v)
  ON CONFLICT (user_id, stage) DO UPDATE SET claim_id = v, status = 'claimed', idempotency_key = 'naive/' || v;
  RETURN jsonb_build_object('claim_id', v, 'idempotency_key', 'naive/' || v, 'attempt', 1);
END $f$;`;
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '-'], { input: naive, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  const mod = await import(pathToFileURL(path.join(ROOT, 'scripts/db-test/tests/041_trial_reminder_concurrency.mjs')).href);
  const { assertions } = await mod.default({ container, root: ROOT });
  const fails = assertions.filter((a) => a.startsWith('FAIL'));
  console.log(`NEGATIVE CONTROL (naive check-then-act claim): ${fails.length} FAIL / ${assertions.length} assertions`);
  for (const a of fails) console.log(`  ${a.slice(0, 240)}`);
  console.log(`NEGATIVE CONTROL VERDICT: ${fails.length > 0 ? 'DETECTED (expected)' : 'NOT DETECTED (the test would miss the bug)'}`);
  process.exitCode = fails.length > 0 ? 0 : 1;
} finally {
  spawnSync('docker', ['stop', container]);
}
