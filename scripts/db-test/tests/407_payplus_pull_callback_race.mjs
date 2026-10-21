// PayPlus server pull vs. the first charge's callback in REAL parallel sessions (migration 20261022200000; disposable container only).
// Session A pulls the payment and keeps its transaction open; session B delivers the first charge's callback (with a provider clock
// a minute ahead of ours) while A has not committed yet. B must wait for A and then see the pull: the same payment, recorded 'stale',
// the paid month NOT doubled. Then the opposite order: the callback holds its transaction, the pull waits and changes nothing.
// The billing phase is forced to enforced for this file and restored afterwards.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USERS = ['00000000-0000-4000-9407-000000000001', '00000000-0000-4000-9407-000000000002'];
const REQS = ['00000000-0000-4000-9407-0000000000a1', '00000000-0000-4000-9407-0000000000a2'];

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const last = (out) => out.split('\n').filter(Boolean).pop();
  const prev = JSON.parse(await q(`SELECT jsonb_build_object('phase', phase, 'reason', reason)::text FROM public.billing_activation WHERE id;`));
  await q(`UPDATE public.billing_activation SET phase = 'enforced', reason = 'TEST device: 407 race' WHERE id;`);
  try {
    const attempts = [];
    for (let i = 0; i < USERS.length; i++) {
      const u = USERS[i];
      await q(`INSERT INTO auth.users (id, email) VALUES ('${u}', 'p407-${i}@synthetic.test') ON CONFLICT DO NOTHING;
INSERT INTO public.business_settings (user_id, email, business_name, country, currency, plan, role, is_lifetime)
  VALUES ('${u}', 'p407-${i}@synthetic.test', 'Synthetic race ${i}', 'Local', 'ILS', 'free', 'user', false) ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.account_market (user_id, market, source) VALUES ('${u}', 'IL', 'business_settings_country') ON CONFLICT DO NOTHING;
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id) VALUES ('${u}', 'free_10', NULL) ON CONFLICT DO NOTHING;`);
      const a = last(await q(`SELECT public.create_package_checkout_intent('${u}', 'month', 'payplus-race-407-user-${i}', false) ->> 'attemptId';`));
      await q(`SELECT public.record_checkout_attempt_page_and_request('${a}', '${u}', 'https://payments.payplus.co.il/race${i}', '${REQS[i]}');`);
      attempts.push(a);
    }
    // one paid month from the ONE event that opened the package (never a second month)
    const oneMonth = async (u, eventId) => last(await q(`SELECT (e.paid_through = public.billing_period_end(s.provider_event_time, 'month'))::text
  FROM public.account_entitlements e, public.subscription_events s WHERE e.user_id = '${u}' AND s.provider_event_id = '${eventId}';`)) === 'true';
    // wait until a session sleeping with its transaction open is active, then until another session waits on an advisory lock
    const waitFor = async (sql, label) => {
      for (let i = 0; i < 80; i++) { if (Number(last(await q(sql))) > 0) return true; await sleep(100); }
      ok(false, label, 'timeout');
      return false;
    };
    const holding = (tag) => `SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%pg_sleep(2.5)%${tag}%' AND pid <> pg_backend_pid();`;
    const blocked = `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted;`;

    // 1. pull first (transaction open) - the callback arrives meanwhile, its provider time a minute AFTER the pull
    {
      const [u, a] = [USERS[0], attempts[0]];
      const A = q(`BEGIN;
SELECT public.record_checkout_pull('${a}', '${u}', '${a}', 'rec-407-1', 3000, 'ILS', repeat('d', 64))::text;
SELECT pg_sleep(2.5) /* race-407-pull */;
COMMIT;`);
      await waitFor(holding('race-407-pull'), 'R1 setup: the pull holds its transaction');
      const B = q(`SELECT public.record_verified_provider_event('payplus', 'tx-407-1', 'payment_confirmed', '${a}', 'rec-407-1', 'term-407',
  now() + interval '1 minute', repeat('e', 64), 3000, 'ILS')::text;`);
      await waitFor(blocked, 'R1 setup: the callback waits for the pull');
      const ra = JSON.parse(last(await A).replace(/^COMMIT$/, '') || '{}');
      const rb = JSON.parse(last(await B));
      ok(ra.activated === true && ra.pulled === true, 'R1 the pull opened the package', ra);
      ok(rb.code === 'first_charge_pulled' && rb.outcome === 'stale', 'R1b the callback that waited for the pull is the same payment (stale)', rb);
      ok(await oneMonth(u, `pull:${a}`), 'R1c the paid month is not doubled (one month from the pull)', null);
    }

    // 2. callback first (transaction open) - the pull arrives meanwhile and changes nothing
    {
      const [u, a] = [USERS[1], attempts[1]];
      const B = q(`BEGIN;
SELECT public.record_verified_provider_event('payplus', 'tx-407-2', 'payment_confirmed', '${a}', 'rec-407-2', 'term-407',
  now() - interval '1 minute', repeat('e', 64), 3000, 'ILS')::text;
SELECT pg_sleep(2.5) /* race-407-callback */;
COMMIT;`);
      await waitFor(holding('race-407-callback'), 'R2 setup: the callback holds its transaction');
      const A = q(`SELECT public.record_checkout_pull('${a}', '${u}', '${a}', 'rec-407-2', 3000, 'ILS', repeat('d', 64))::text;`);
      await waitFor(blocked, 'R2 setup: the pull waits for the callback');
      const rb = JSON.parse(last(await B));
      const ra = JSON.parse(last(await A));
      ok(rb.activated === true, 'R2 the callback opened the package', rb);
      ok(ra.pulled === false && ra.state === 'confirmed', 'R2b the pull that waited for the callback changes nothing', ra);
      ok(await oneMonth(u, 'tx-407-2'), 'R2c the paid month is not doubled (one month from the callback)', null);
      const events = Number(last(await q(`SELECT count(*) FROM public.subscription_events WHERE attempt_id = '${a}';`)));
      ok(events === 1, 'R2d exactly one recorded event (the callback)', events);
    }
  } finally {
    const reason = prev.reason === null ? 'NULL' : `'${String(prev.reason).replace(/'/g, "''")}'`;
    await q(`UPDATE public.billing_activation SET phase = '${prev.phase}', reason = ${reason} WHERE id;`);
  }
  return { assertions };
}
