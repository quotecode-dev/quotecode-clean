// Continuous work 30/10 (migration 20261030700000, Codex SEC-EF-02) - against a REAL Postgres (disposable container only): two
// sessions reserve the same quote's email at the same instant (a double click / two tabs) -> exactly one reservation; the other is
// told the send is in progress. Released together by an advisory-lock barrier, each holding its transaction open.
import { spawn } from 'node:child_process';

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}: ${err.trim().slice(-400)}`))));
    p.stdin.end(`${sql}\n`);
  });
}
function holdBarrier(container, lockKey) {
  const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A']);
  let out = '';
  const ready = new Promise((resolve) => { p.stdout.on('data', (d) => { out += d; if (out.includes('BARRIER_HELD')) resolve(); }); });
  p.stdin.write(`SELECT pg_advisory_lock(${lockKey});\n\\echo BARRIER_HELD\n`);
  return { ready, release: () => new Promise((resolve) => { p.on('close', resolve); p.stdin.end(`SELECT pg_advisory_unlock(${lockKey});\n\\q\n`); }) };
}

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const lock = 7_443_001;
  const barrier = holdBarrier(container, lock);
  await barrier.ready;
  const one = () => q(`SELECT pg_advisory_lock_shared(${lock});
BEGIN;
SELECT public.quote_email_reserve('a4430000-0000-4000-8000-000000000001', 'a4430000-0000-4000-8000-0000000000aa', 'race@customer.test');
SELECT pg_sleep(1.5);
COMMIT;`).then((o) => { const l = o.split('\n').find((x) => x.trim().startsWith('{')); return l ? JSON.parse(l) : null; }, (e) => ({ error: String(e.message).slice(0, 200) }));
  const workers = [one(), one()];
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < 2; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
    if (waiting < 2) await new Promise((r) => setTimeout(r, 250));
  }
  await barrier.release();
  const results = await Promise.all(workers);
  ok(waiting === 2, 'RACE: both sessions blocked on the barrier before release', waiting);
  ok(results.filter((r) => r?.ok === true).length === 1 && results.filter((r) => r?.code === 'in_progress').length === 1,
    'RACE: two sends of the same quote at once -> exactly one reservation, the other is in progress', results);
  const rows = Number(await q(`SELECT count(*) FROM public.quote_email_sends WHERE quote_id = 'a4430000-0000-4000-8000-000000000001';`));
  ok(rows === 1, 'RACE: one send record', rows);
  return { assertions };
}
