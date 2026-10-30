// Continuous work 30/10 (migration 20261030800000, Codex release 6) - against a REAL Postgres (disposable container only): two scans
// store the same supplier document (two mailboxes) at the same instant -> exactly one canonical row, the other stored as a linked copy.
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
  const lock = 7_445_001;
  const barrier = holdBarrier(container, lock);
  await barrier.ready;
  const one = (mailbox, msg) => q(`SELECT pg_advisory_lock_shared(${lock});
BEGIN;
INSERT INTO public.expense_invoices (mailbox, message_id, supplier_name, supplier_vat_id, doc_type, doc_number, amount, currency, status)
VALUES ('${mailbox}', '${msg}', 'Race Supplier', '514445001', 'tax_invoice', 'R-445', 10, 'ILS', 'pending');
SELECT pg_sleep(1.5);
COMMIT;`).then(() => 'ok', (e) => `error ${String(e.message).slice(0, 160)}`);
  const workers = [one('quotecodedev@gmail.com', 'race-445-a'), one('info@tekango.com', 'race-445-b')];
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < 2; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
    if (waiting < 2) await new Promise((r) => setTimeout(r, 250));
  }
  await barrier.release();
  const results = await Promise.all(workers);
  ok(waiting === 2, 'RACE: both sessions blocked on the barrier before release', waiting);
  ok(results.every((r) => r === 'ok'), 'RACE: both scans stored their row (no error, no lost evidence)', results);
  const rows = (await q(`SELECT coalesce(string_agg((duplicate_of IS NULL)::text || ':' || status, ',' ORDER BY (duplicate_of IS NULL) DESC), '') FROM public.expense_invoices WHERE supplier_vat_id = '514445001';`)).split(',');
  ok(rows.length === 2 && rows[0] === 'true:pending' && rows[1] === 'false:excluded', 'RACE: exactly one canonical row; the other is a linked, excluded copy', rows);
  return { assertions };
}
