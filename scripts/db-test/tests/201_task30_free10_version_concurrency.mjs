// Task 30 - Free-10 per VERSION under REAL parallel sessions (disposable container only). Independent psql sessions of the same owner
// are released at the same instant (advisory-lock barrier); each runs a full output (prepare -> snapshot -> finalize) of the SAME
// quote version on its own channel / key (= separate windows + channels + retries). Exactly ONE count may result. A second wave
// after a content change: again exactly one more count. The phase is forced to enforced for this file and restored afterwards.
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

const OWNER = '00000000-0000-4000-9201-000000000001';
const CLIENT = '00000000-0000-4000-9201-0000000000c1';
const QUOTE = '00000000-0000-4000-9201-0000000000f1';
const CHANNELS = ['send', 'public_share', 'final_pdf', 'final_print'];

// one full output in ONE session (autocommit statements, like the orchestrator: prepare, then finalize in a separate transaction)
const outputSql = (channel, keySuffix) => `SELECT pg_advisory_lock_shared(LOCKKEY);
CREATE TEMP TABLE o (d text, p jsonb, f jsonb);
GRANT ALL ON o TO service_role;
INSERT INTO o (d) SELECT public.quote_output_digest(public.quote_output_deal_document('${OWNER}', '${QUOTE}'));
SELECT set_config('role', 'service_role', false);
UPDATE o SET p = public.prepare_quote_output('${OWNER}', '${QUOTE}', '${channel}', format('out:%s:%s:%s', '${QUOTE}', '${channel}', d) || '${keySuffix}',
  d, 'classic', 0, 1, repeat('c', 64));
SELECT set_config('role', 'none', false);
INSERT INTO storage.objects (bucket_id, name, metadata) SELECT 'quote-files', p ->> 'snapshotPath', jsonb_build_object('size', 100) FROM o
  WHERE p ->> 'state' = 'preparing' ON CONFLICT (bucket_id, name) DO NOTHING;
SELECT set_config('role', 'service_role', false);
UPDATE o SET f = CASE WHEN p ->> 'state' = 'preparing'
  THEN public.finalize_quote_output('${OWNER}', (p ->> 'attemptId')::uuid, p ->> 'snapshotPath', repeat('a', 64), 100, 1, repeat('c', 64)) ELSE p END;
SELECT set_config('role', 'none', false);
SELECT jsonb_build_object('prep', p ->> 'state', 'code', coalesce(f ->> 'code', p ->> 'code'), 'final', f ->> 'state', 'already', f ->> 'alreadyFinalized')::text FROM o;`;

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const used = async () => Number(await q(`SELECT free_issues_consumed FROM public.account_entitlements WHERE user_id = '${OWNER}';`));
  const prevPhase = await q(`SELECT phase FROM public.subscription_activation WHERE component = 'free_issue';`);
  await q(`INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'v30-race@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES ('${OWNER}', 'v30-race@synthetic.test', 'Synthetic V30 Race', 'Local', 'ILS') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES ('${OWNER}', 'free_10') ON CONFLICT DO NOTHING;
INSERT INTO public.clients (id, company_name, email, user_id) VALUES ('${CLIENT}', 'Synthetic Race Customer', 'v30-race-c@synthetic.test', '${OWNER}') ON CONFLICT DO NOTHING;
INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes) VALUES ('${QUOTE}', '${OWNER}', 99201, 'draft', '${CLIENT}', 'race v1') ON CONFLICT DO NOTHING;
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';`);
  try {
    const wave = async (lock, sessions) => {
      const barrier = holdBarrier(container, lock);
      await barrier.ready;
      const workers = sessions.map(([ch, suffix]) => q(outputSql(ch, suffix).replace('LOCKKEY', String(lock))).then((out) => JSON.parse(out.split('\n').pop())));
      let waiting = 0;
      for (let i = 0; i < 120 && waiting < sessions.length; i++) {
        waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`));
        if (waiting < sessions.length) await new Promise((r) => setTimeout(r, 250));
      }
      ok(waiting === sessions.length, `CONC: all ${sessions.length} sessions blocked on the barrier before release`, waiting);
      await barrier.release();
      return Promise.all(workers);
    };
    // wave 1: 12 sessions = 4 channels x 3 (same key twice = retry, plus a different window key)
    const s1 = CHANNELS.flatMap((ch) => [[ch, ''], [ch, ''], [ch, ':w2']]);
    const r1 = await wave(7_201_001, s1);
    ok(await used() === 1, 'CONC1: 12 simultaneous outputs of ONE version on 4 channels (with retries) -> exactly 1 counted', await used());
    ok(r1.every((r) => r.final === 'finalized' || r.code === 'output_in_progress' || r.code === 'attempt_finalized' || r.already === 'true'),
      'CONC1: every session got the finalized version, a retryable in-progress answer or the durable result (no failure, no second count)', r1);
    const rows1 = Number(await q(`SELECT count(*) FROM public.quote_issue_ledger WHERE quote_id = '${QUOTE}';`));
    ok(rows1 === 1, 'CONC1: exactly one ledger row', rows1);
    // wave 2: the content changes, then again 8 simultaneous outputs of the NEW version
    await q(`UPDATE public.quotes SET notes = 'race v2' WHERE id = '${QUOTE}';`);
    const r2 = await wave(7_201_002, CHANNELS.flatMap((ch) => [[ch, ''], [ch, ':w3']]));
    ok(await used() === 2, 'CONC2: 8 simultaneous outputs of the CHANGED version -> exactly one more count (2)', await used());
    ok(r2.every((r) => !r.code || ['output_in_progress', 'attempt_finalized'].includes(r.code)), 'CONC2: no unexpected refusal', r2);
    const counter = Number(await q(`SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = '${OWNER}' AND counted_against_free;`));
    ok(counter === await used(), 'CONC: the counter equals the counted ledger rows', counter);
  } finally {
    await q(`UPDATE public.subscription_activation SET phase = '${prevPhase}' WHERE component = 'free_issue';`);
  }
  return { assertions };
}
