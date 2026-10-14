// Task 28 - concurrent follow-up creation against a REAL Postgres (disposable container only). Many independent psql sessions of the
// same owner are released at the same instant (advisory-lock barrier) and each calls public.create_follow_up_task for the SAME quote
// with its OWN request id (= separate windows). Exactly one row may be written, and every session must get that same task back.
// A second wave retries with already-used request ids (= network retries) and must not write anything either.
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

const OWNER = '00000000-0000-4000-9181-000000000001';
const QUOTE = '00000000-0000-4000-9181-0000000000f1';
const req = (n) => `00000000-0000-4000-9181-${String(1000 + n).padStart(12, '0')}`;
const asOwner = (sql) => `SELECT set_config('request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false);\nSET ROLE authenticated;\n${sql}`;

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  await q(`INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'fu-race@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES ('${OWNER}', 'fu-race@synthetic.test', 'Synthetic FU Race', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES ('${QUOTE}', '${OWNER}', 98181, 'sent') ON CONFLICT DO NOTHING;`);

  const SESSIONS = 12;
  const wave = async (ids, lock) => {
    const barrier = holdBarrier(container, lock);
    await barrier.ready;
    const workers = ids.map((id) => q(asOwner(`SELECT pg_advisory_lock_shared(${lock});
SELECT (public.create_follow_up_task('${id}', '${QUOTE}', 'Follow up 98181'))::text;`)).then((out) => JSON.parse(out.split('\n').pop())));
    let waiting = 0;
    for (let i = 0; i < 120 && waiting < ids.length; i++) {
      waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
      if (waiting < ids.length) await new Promise((r) => setTimeout(r, 250));
    }
    ok(waiting === ids.length, `CONC: all ${ids.length} sessions blocked on the barrier before release`, waiting);
    await barrier.release();
    return Promise.all(workers);
  };

  const first = await wave(Array.from({ length: SESSIONS }, (_, i) => req(i)), 7_181_001);
  const created = first.filter((r) => r.created === true);
  const taskIds = new Set(first.map((r) => r.task?.id));
  ok(created.length === 1, `CONC: ${SESSIONS} simultaneous windows -> exactly 1 created`, created.length);
  ok(taskIds.size === 1, 'CONC: every session got the SAME task back', [...taskIds]);
  ok(first.filter((r) => !r.created).every((r) => r.reason === 'existing_open_follow_up'), 'CONC: the others were told an open follow-up exists', first.map((r) => r.reason));

  // retries of already-used request ids (the winner's and the losers') -> still one row, same task
  const retry = await wave([req(0), req(1), req(2), req(3), [...first].find((r) => r.created).task.id], 7_181_002);
  ok(retry.every((r) => !r.created && r.task.id === [...taskIds][0]), 'RETRY: retries return the same task and create nothing', retry.map((r) => [r.created, r.reason]));
  const rows = Number(await q(`SELECT count(*) FROM public.tasks WHERE quote_id = '${QUOTE}' AND kind = 'follow_up';`));
  ok(rows === 1, 'CONC: exactly one follow-up row in the table', rows);
  return { assertions };
}
