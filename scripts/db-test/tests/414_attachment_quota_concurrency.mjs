// Codex review 2026-10-23 R-03 (Owner: "מאשר לך לעשות כל מה שאתה מוצא לנכון לתקן על פי הדוח שלו") - the business attachment limit under
// CONCURRENT saves, against a REAL Postgres (disposable container only). One business holds 28.3 MB; two sessions, released at the same
// instant by an advisory-lock barrier, each add a 2 MB file to a DIFFERENT quote and hold their transaction open for a moment. Without the
// per-business lock both would see 28.3 MB and both commit (32.3 MB). With it exactly one is stored and the other is refused.
import { spawn } from 'node:child_process';

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}: ${err.trim().slice(0, 400)}`))));
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

const OWNER = '00000000-0000-4000-9414-000000000001';
const QA = '00000000-0000-4000-9414-0000000000a1';
const QB = '00000000-0000-4000-9414-0000000000b1';
const FULL = 3145728;

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const fill = Array.from({ length: 9 }, (_, i) => `('quote-files', 'q414/fill_${i}.pdf', NULL, '{"size": ${FULL}}'::jsonb)`).join(', ');
  const rows = Array.from({ length: 9 }, (_, i) => `('${QA}', 'f${i}.pdf', 'q414/fill_${i}.pdf', ${FULL}, 'q414/fill_${i}.pdf')`).join(', ');
  await q(`INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'quota-race@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.quotes (id, user_id, quote_number, status, currency, total) VALUES ('${QA}', '${OWNER}', 941401, 'draft', 'ILS', 10), ('${QB}', '${OWNER}', 941402, 'draft', 'ILS', 10) ON CONFLICT DO NOTHING;
INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ${fill}, ('quote-files', 'q414/race_a.pdf', NULL, '{"size": 2000000}'::jsonb), ('quote-files', 'q414/race_b.pdf', NULL, '{"size": 2000000}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path) VALUES ${rows};`);
  const before = Number(await q(`SELECT sum(file_size) FROM public.quote_attachments a JOIN public.quotes q ON q.id = a.quote_id WHERE q.user_id = '${OWNER}';`));
  ok(before === 9 * FULL, 'RACE setup: the business holds 28.3 MB (room for one 2 MB file, not two)', before);

  const LOCK = 7_414_001;
  const barrier = holdBarrier(container, LOCK);
  await barrier.ready;
  const save = (quote, path) => q(`SELECT pg_advisory_lock_shared(${LOCK});
BEGIN;
INSERT INTO public.quote_attachments (quote_id, file_name, file_url, file_size, storage_path) VALUES ('${quote}', 'race.pdf', '${path}', 2000000, '${path}');
SELECT pg_sleep(1.5);
COMMIT;
SELECT 'stored';`).then(() => 'stored', (e) => (/attachment_total_exceeded/.test(String(e.message)) ? 'refused' : `error: ${String(e.message).slice(0, 200)}`));
  const workers = [save(QA, 'q414/race_a.pdf'), save(QB, 'q414/race_b.pdf')];
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < 2; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${LOCK};`));
    if (waiting < 2) await new Promise((r) => setTimeout(r, 250));
  }
  ok(waiting === 2, 'RACE: both sessions blocked on the barrier before release', waiting);
  await barrier.release();
  const results = await Promise.all(workers);
  ok(results.filter((r) => r === 'stored').length === 1 && results.filter((r) => r === 'refused').length === 1,
    'RACE: two simultaneous 2 MB saves of one business -> exactly one stored, the other refused (attachment_total_exceeded)', results);
  const after = Number(await q(`SELECT sum(file_size) FROM public.quote_attachments a JOIN public.quotes q ON q.id = a.quote_id WHERE q.user_id = '${OWNER}';`));
  ok(after <= 31457280, 'RACE: the business stays within 30 MB', after);
  return { assertions };
}
