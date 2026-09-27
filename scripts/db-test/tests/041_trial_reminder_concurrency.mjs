// Codex Post-LIVE Wave 1 blocker 3 - overlapping invocations against a REAL Postgres (disposable container only).
//   A. Raw race: many independent psql sessions are released at the same instant (advisory-lock barrier) and all call
//      public.claim_trial_reminder for the same (account, stage). Exactly one session may win per (account, stage).
//   B. End to end: several concurrent runs of the real orchestrator (supabase/functions/send-trial-expiration-email/
//      reminderRun.ts, loaded by Node's TypeScript type stripping) use the real SQL claim / completion functions through
//      separate psql sessions, with a local fake provider (no email is sent). Every eligible account must be delivered
//      exactly once; accounts whose market is not exactly Local / International must get nothing and no ledger row.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MS_PER_DAY = 86_400_000;

function psqlAsync(container, sql, { role } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(`psql exit ${code}: ${err.trim().slice(0, 400)}`))));
    p.stdin.end(`${role ? `SET ROLE ${role};\n` : ''}${sql}\n`);
  });
}

function holdBarrier(container, lockKey) {
  const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-t', '-A']);
  let out = '';
  const ready = new Promise((resolve) => {
    p.stdout.on('data', (d) => { out += d; if (out.includes('BARRIER_HELD')) resolve(); });
  });
  p.stdin.write(`SELECT pg_advisory_lock(${lockKey});\n\\echo BARRIER_HELD\n`);
  return {
    ready,
    release: () => new Promise((resolve) => { p.on('close', resolve); p.stdin.end(`SELECT pg_advisory_unlock(${lockKey});\n\\q\n`); }),
  };
}

const uid = (group, n) => `00000000-0000-4000-9${String(group).padStart(3, '0')}-${String(n).padStart(12, '0')}`;

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql, opts) => psqlAsync(container, sql, opts);

  // ---------------- A. raw race ----------------
  const RACE_ACCOUNTS = 5;
  const SESSIONS_PER_TARGET = 8; // per (account, stage)
  const seedA = [];
  for (let n = 1; n <= RACE_ACCOUNTS; n++) {
    seedA.push(`INSERT INTO auth.users (id, email) VALUES ('${uid(1, n)}', 'race${n}@synthetic.test') ON CONFLICT DO NOTHING;`);
    seedA.push(`INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, trial_ends_at)
                VALUES ('${uid(1, n)}', 'race${n}@synthetic.test', 'Synthetic Race ${n}', 'Local', 'ILS', 'pro', now() + interval '2 days')
                ON CONFLICT (user_id) DO NOTHING;`);
  }
  await q(seedA.join('\n'));

  const LOCK = 7_314_159;
  const barrier = holdBarrier(container, LOCK);
  await barrier.ready;
  const workers = [];
  for (let n = 1; n <= RACE_ACCOUNTS; n++) {
    for (const stage of ['3d', '24h']) {
      for (let s = 0; s < SESSIONS_PER_TARGET; s++) {
        workers.push(q(`SELECT pg_advisory_lock_shared(${LOCK});
SET ROLE service_role;
SELECT coalesce(public.claim_trial_reminder('${uid(1, n)}', '${stage}')::text, 'NO_CLAIM');`)
          .then((out) => ({ n, stage, out: out.split('\n').pop() })));
      }
    }
  }
  // wait until every worker session is actually blocked on the barrier, then release them all at once
  const expectedWaiting = RACE_ACCOUNTS * 2 * SESSIONS_PER_TARGET;
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < expectedWaiting; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${LOCK};`));
    if (waiting < expectedWaiting) await new Promise((r) => setTimeout(r, 250));
  }
  ok(waiting === expectedWaiting, `RACE: all ${expectedWaiting} sessions were blocked on the barrier before release`, waiting);
  await barrier.release();
  const results = await Promise.all(workers);

  for (let n = 1; n <= RACE_ACCOUNTS; n++) {
    for (const stage of ['3d', '24h']) {
      const mine = results.filter((r) => r.n === n && r.stage === stage);
      const winners = mine.filter((r) => r.out !== 'NO_CLAIM');
      ok(mine.length === SESSIONS_PER_TARGET && winners.length === 1,
        `RACE: account ${n} stage ${stage}: ${SESSIONS_PER_TARGET} simultaneous sessions -> exactly 1 claim`, winners.length);
    }
  }
  const ledgerA = await q(`SELECT count(*) FROM public.trial_reminder_deliveries WHERE user_id::text LIKE '00000000-0000-4000-9001-%';`);
  ok(Number(ledgerA) === RACE_ACCOUNTS * 2, 'RACE: exactly one ledger row per (account, stage)', ledgerA);

  // ---------------- B. end to end with the real orchestrator ----------------
  const { runTrialReminderBatch } = await import(pathToFileURL(path.join(root, 'supabase/functions/send-trial-expiration-email/reminderRun.ts')).href);
  const accounts = [
    ...Array.from({ length: 10 }, (_, i) => ({ n: i + 1, country: i % 2 ? 'International' : 'Local' })),
    { n: 11, country: 'Unknown' },
    { n: 12, country: null },
    { n: 13, country: 'LCL' },
    { n: 14, country: 'local' },
  ];
  const seedB = [];
  for (const a of accounts) {
    seedB.push(`INSERT INTO auth.users (id, email) VALUES ('${uid(2, a.n)}', 'e2e${a.n}@synthetic.test') ON CONFLICT DO NOTHING;`);
    seedB.push(`INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, trial_ends_at)
                VALUES ('${uid(2, a.n)}', 'e2e${a.n}@synthetic.test', 'Synthetic E2E ${a.n}', ${a.country === null ? 'NULL' : `'${a.country}'`},
                        'USD', 'pro', now() + interval '2 days') ON CONFLICT (user_id) DO NOTHING;`);
  }
  await q(seedB.join('\n'));

  const delivered = [];
  const keys = new Map();
  const transport = async (message, key) => {
    await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 20)));
    if (keys.has(key)) return { outcome: 'sent', messageId: 'dedup' };
    keys.set(key, true);
    delivered.push({ to: message.to, from: message.from, market: message.market, key });
    return { outcome: 'sent', messageId: `msg_${delivered.length}` };
  };
  const deps = {
    claim: async (userId, stage) => {
      const out = await q(`SELECT coalesce(public.claim_trial_reminder('${userId}', '${stage}')::text, 'NO_CLAIM');`, { role: 'service_role' });
      if (out === 'NO_CLAIM') return null;
      const j = JSON.parse(out);
      return { claimId: j.claim_id, idempotencyKey: j.idempotency_key, attempt: j.attempt };
    },
    complete: async (userId, stage, claimId, result) => {
      const msgId = result.outcome === 'sent' && result.messageId ? `'${result.messageId}'` : 'NULL';
      const out = await q(`SELECT public.complete_trial_reminder('${userId}', '${stage}', '${claimId}', '${result.outcome}', ${msgId}, NULL);`, { role: 'service_role' });
      return out === 't';
    },
    transport,
  };
  // the same candidate read the Edge Function performs (a stale snapshot shared by all overlapping runs)
  const snapshot = JSON.parse(await q(`SELECT coalesce(json_agg(b), '[]') FROM (
      SELECT user_id, email, business_name, country, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, role, plan, is_lifetime
        FROM public.business_settings WHERE user_id::text LIKE '00000000-0000-4000-9002-%') b;`));
  ok(snapshot.length === accounts.length, 'E2E: synthetic candidate snapshot read', snapshot.length);

  const RUNS = 6;
  const summaries = await Promise.all(Array.from({ length: RUNS }, () => runTrialReminderBatch(snapshot.map((r) => ({ ...r })), Date.now(), deps)));

  const perRecipient = new Map();
  for (const d of delivered) perRecipient.set(d.to, (perRecipient.get(d.to) ?? 0) + 1);
  const eligible = accounts.filter((a) => a.country === 'Local' || a.country === 'International');
  ok(eligible.every((a) => perRecipient.get(`e2e${a.n}@synthetic.test`) === 1),
    `E2E: ${RUNS} overlapping runs -> each of the ${eligible.length} eligible accounts received exactly one email`, Object.fromEntries(perRecipient));
  ok(delivered.length === eligible.length, 'E2E: total provider deliveries == eligible accounts', delivered.length);
  ok(summaries.reduce((n, s) => n + s.sent3d, 0) === eligible.length, 'E2E: recorded sends across runs == eligible accounts',
    summaries.map((s) => s.sent3d));
  ok(delivered.every((d) => (d.market === 'Local') === (d.from === 'TEKANGO Support <support@tekango.com>')),
    'E2E: sender follows the exact market (Local -> support@, International -> info@)', delivered.map((d) => [d.market, d.from]));
  for (const a of accounts.filter((x) => !eligible.includes(x))) {
    ok(!perRecipient.has(`e2e${a.n}@synthetic.test`), `E2E: country ${JSON.stringify(a.country)} -> no email`, perRecipient.get(`e2e${a.n}@synthetic.test`));
  }
  const flags = await q(`SELECT count(*) FILTER (WHERE trial_reminder_3d_sent) || '/' || count(*) FROM public.business_settings WHERE user_id::text LIKE '00000000-0000-4000-9002-%';`);
  ok(flags === `${eligible.length}/${accounts.length}`, 'E2E: sent flag set exactly for the delivered accounts', flags);
  const ledgerB = await q(`SELECT count(*) FILTER (WHERE status = 'sent') || '/' || count(*) FROM public.trial_reminder_deliveries WHERE user_id::text LIKE '00000000-0000-4000-9002-%';`);
  ok(ledgerB === `${eligible.length}/${eligible.length}`, 'E2E: ledger has one sent row per delivered account and none for unresolved markets', ledgerB);

  // a late duplicate cron invocation (fresh read) sends nothing more
  const again = await runTrialReminderBatch(snapshot.map((r) => ({ ...r })), Date.now(), deps);
  ok(again.sent3d === 0 && delivered.length === eligible.length, 'E2E: a duplicate invocation after completion sends nothing', again);

  return { assertions };
}
