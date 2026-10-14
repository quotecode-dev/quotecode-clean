// PREPARATION / NOT ACTIVATED - prep schema version 2 (2026-10-07 Codex review fix). Disposable postgres:17 harness ONLY.
// Real overlapping sessions (separate psql processes via docker exec) released together by an advisory-lock barrier (same
// technique as scripts/db-test/tests/041). Uses the tst.* helpers created by 100_free10_issue_ledger.sql (same container).
//   A. 9 counted + N parallel reservations on N distinct quotes  -> exactly one reservation, then 10 final, never 11
//   B. one quote, M parallel prepares with DIFFERENT keys         -> one attempt row, every racer gets the same attempt
//   C. one quote, K parallel prepares with the SAME key           -> one attempt row
//   D. TTL expiry vs finalize                                     -> the expired reservation never finalizes; the slot is reusable
//   E. mixed finalize / abort / prepare / owner content edit       -> no deadlock (40P01), no lock timeout, counter == finals
//   F. paid catalog at 99/100, P parallel inserts (forced phase)  -> exactly one insert succeeds
import { spawn } from 'node:child_process';

function psqlAsync(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = '';
    let err = '';
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
const lastLine = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
async function race(q, container, lockKey, bodies, assertions) {
  const barrier = holdBarrier(container, lockKey);
  await barrier.ready;
  const workers = bodies.map((body) => q(`SET lock_timeout = '20s';\nSELECT pg_advisory_lock_shared(${lockKey});\n${body}`)
    .then((out) => ({ ok: true, out: lastLine(out) }), (e) => ({ ok: false, out: String(e.message) })));
  let waiting = 0;
  for (let i = 0; i < 120 && waiting < bodies.length; i++) {
    waiting = Number(await q(`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lockKey};`));
    if (waiting < bodies.length) await new Promise((r) => setTimeout(r, 250));
  }
  assertions.push(waiting === bodies.length ? `PASS: barrier ${lockKey}: all ${bodies.length} sessions blocked before release`
    : `FAIL: barrier ${lockKey}: only ${waiting}/${bodies.length} sessions blocked before release`);
  await barrier.release();
  return Promise.all(workers);
}
const json = (r) => { try { return r.ok ? JSON.parse(r.out) : null; } catch { return null; } };
const noDeadlock = (rs) => rs.every((r) => r.ok || !/deadlock|40P01|lock timeout|55P03/i.test(r.out));

export default async function run({ container }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const q = (sql) => psqlAsync(container, sql);
  const one = async (sql) => lastLine(await q(sql));
  const U = (n) => `tst.u(${n})`;
  const Q = (a, n) => `tst.q(${a}, ${n})`;

  // ---------------- fixtures: accounts 21..25, phase shadow (100 left it at 'prepared' after its rollback test)
  await q(`
    SELECT public.set_activation_phase('free_issue', 'shadow', 'TEST 101: shadow');
    INSERT INTO auth.users (id, email) SELECT tst.u(i), format('prep-race-%s@synthetic.test', i) FROM generate_series(21, 25) i ON CONFLICT DO NOTHING;
    INSERT INTO public.business_settings (user_id, email, business_name, country, currency)
      SELECT tst.u(i), format('prep-race-%s@synthetic.test', i), format('Synthetic Race %s', i), 'Local', 'ILS' FROM generate_series(21, 25) i
      ON CONFLICT (user_id) DO NOTHING;
    SELECT tst.svc();
    SELECT public.provision_free_10(tst.u(i)) FROM generate_series(21, 24) i;
    SELECT tst.logout();
    INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, subscription_status) VALUES (tst.u(25), 'paid', 'classic', 'active')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.clients (id, company_name, email, user_id) SELECT tst.c(i, 'a'), format('Race customer %s', i), format('race-%s@synthetic.test', i), tst.u(i)
      FROM generate_series(21, 24) i ON CONFLICT DO NOTHING;
    INSERT INTO public.quotes (id, user_id, quote_number, status, client_id, notes)
      SELECT tst.q(a, n), tst.u(a), 1000 * a + n, 'draft', tst.c(a, 'a'), 'v1' FROM generate_series(21, 24) a, generate_series(1, 20) n
      ON CONFLICT DO NOTHING;`);

  // ---------------- A. the last credit
  await q(`SELECT tst.out(tst.u(21), tst.q(21, n), 'final_pdf', format('ra-key-%s', lpad(n::text, 4, '0'))) FROM generate_series(1, 9) n;`);
  ok(Number(await one(`SELECT tst.consumed(${U(21)});`)) === 9, 'A0 account at 9 counted outputs', null);
  const N = 8;
  const rA = await race(q, container, 910101, Array.from({ length: N }, (_, i) =>
    `SELECT tst.prep(${U(21)}, ${Q(21, 10 + i)}, 'send', 'ra-race-${String(i).padStart(4, '0')}');`), assertions);
  const statesA = rA.map((r) => json(r)?.state ?? json(r)?.code ?? r.out);
  ok(statesA.filter((s) => s === 'preparing').length === 1 && statesA.filter((s) => s === 'free_issue_limit_reached').length === N - 1,
    `A1 [race on credit 10] ${N} parallel reservations: exactly one, ${N - 1} free_issue_limit_reached`, statesA);
  const winner = rA.map(json).find((j) => j?.state === 'preparing');
  if (winner) {
    await q(`SELECT tst.put('${winner.snapshotPath}');`);
    const fin = JSON.parse(await one(`SELECT tst.fin(${U(21)}, '${winner.attemptId}', '${winner.snapshotPath}');`));
    ok(fin.state === 'finalized', 'A2 the winner finalizes', fin);
  }
  ok(Number(await one(`SELECT tst.consumed(${U(21)});`)) === 10 && Number(await one(`SELECT count(*) FROM public.quote_issue_ledger WHERE user_id = ${U(21)};`)) === 10,
    'A3 10 and never 11: counter 10, ledger 10', null);
  ok(noDeadlock(rA), 'A4 no deadlock / lock timeout', rA.filter((r) => !r.ok).map((r) => r.out));

  // ---------------- B. same quote, different keys
  const M = 8;
  const rB = await race(q, container, 910102, Array.from({ length: M }, (_, i) =>
    `SELECT tst.prep(${U(22)}, ${Q(22, 1)}, '${['send', 'public_share', 'final_pdf', 'final_print'][i % 4]}', 'rb-key-${String(i).padStart(4, '0')}');`), assertions);
  const idsB = new Set(rB.map(json).map((j) => j?.attemptId));
  ok(rB.every((r) => json(r)?.state === 'preparing') && idsB.size === 1, `B1 ${M} keys on one quote: every racer gets the same attempt`, [...idsB]);
  ok(Number(await one(`SELECT count(*) FROM public.quote_output_attempts WHERE quote_id = ${Q(22, 1)};`)) === 1, 'B2 one attempt row for the quote', null);

  // ---------------- C. same key retries
  const K = 6;
  const rC = await race(q, container, 910103, Array.from({ length: K }, () => `SELECT tst.prep(${U(22)}, ${Q(22, 2)}, 'send', 'rc-key-0001');`), assertions);
  const idsC = new Set(rC.map(json).map((j) => j?.attemptId));
  ok(idsC.size === 1 && !idsC.has(undefined), `C1 ${K} parallel retries of one key: one attempt`, [...idsC]);
  ok(Number(await one(`SELECT count(*) FROM public.quote_output_attempts WHERE quote_id = ${Q(22, 2)};`)) === 1, 'C2 one attempt row', null);
  ok(noDeadlock([...rB, ...rC]), 'C3 no deadlock / lock timeout', null);

  // ---------------- D. TTL expiry vs finalize
  const d1 = JSON.parse(await one(`SELECT tst.prep(${U(23)}, ${Q(23, 1)}, 'send', 'rd-key-0001');`));
  await q(`SELECT tst.put('${d1.snapshotPath}');
           SET session_replication_role = replica;
           UPDATE public.quote_output_attempts SET expires_at = now() - interval '1 second' WHERE attempt_id = '${d1.attemptId}';
           SET session_replication_role = origin;`);
  const rD = await race(q, container, 910104, [
    `SELECT tst.fin(${U(23)}, '${d1.attemptId}', '${d1.snapshotPath}');`,
    `SELECT tst.prep(${U(23)}, ${Q(23, 2)}, 'send', 'rd-key-0002');`,
  ], assertions);
  ok(json(rD[0])?.code === 'attempt_expired' && json(rD[1])?.state === 'preparing', 'D1 expired reservation never finalizes; another quote reserves', rD.map((r) => r.out.slice(0, 120)));
  ok(Number(await one(`SELECT tst.consumed(${U(23)});`)) === 0, 'D2 nothing consumed by the expired reservation', null);
  ok(noDeadlock(rD), 'D3 no deadlock / lock timeout', null);

  // ---------------- E. mixed load on one account: lock order
  const preps = [];
  for (let n = 1; n <= 4; n++) {
    const p = JSON.parse(await one(`SELECT tst.prep(${U(24)}, ${Q(24, n)}, 'send', 're-key-000${n}');`));
    await q(`SELECT tst.put('${p.snapshotPath}');`);
    preps.push(p);
  }
  const rE = await race(q, container, 910105, [
    `SELECT tst.fin(${U(24)}, '${preps[0].attemptId}', '${preps[0].snapshotPath}');`,
    `SELECT tst.fin(${U(24)}, '${preps[1].attemptId}', '${preps[1].snapshotPath}');`,
    `SELECT tst.svc(); SELECT public.abort_quote_output(${U(24)}, '${preps[2].attemptId}', 'storage_write_failed');`,
    `SELECT tst.fin(${U(24)}, '${preps[3].attemptId}', '${preps[3].snapshotPath}');`,
    `SELECT tst.login(${U(24)}); UPDATE public.quotes SET notes = 'edited during finalize' WHERE id = ${Q(24, 4)}; SELECT 'edited';`,
    `SELECT tst.prep(${U(24)}, ${Q(24, 5)}, 'final_print', 're-key-0005');`,
    `SELECT tst.prep(${U(24)}, ${Q(24, 6)}, 'public_share', 're-key-0006');`,
  ], assertions);
  ok(rE.every((r) => r.ok), 'E1 [lock order] all 7 mixed sessions complete: no deadlock (40P01), no lock timeout', rE.filter((r) => !r.ok).map((r) => r.out));
  const finals = Number(await one(`SELECT count(*) FROM public.quote_output_attempts WHERE user_id = ${U(24)} AND state = 'finalized';`));
  ok(Number(await one(`SELECT tst.consumed(${U(24)});`)) === finals && finals >= 2, 'E2 counter equals FINALIZED attempts', finals);
  const q4 = json(rE[3]);
  const q4Edited = await one(`SELECT notes FROM public.quotes WHERE id = ${Q(24, 4)};`);
  ok((q4?.state === 'finalized') || (q4?.code === 'quote_changed' && q4Edited === 'edited during finalize'),
    'E3 the concurrent edit either lands after the commit or aborts the finalize (quote_changed) - never a stale final', [q4?.state ?? q4?.code, q4Edited]);
  ok(await one(`SELECT state FROM public.quote_output_attempts WHERE attempt_id = '${preps[2].attemptId}';`) === 'aborted', 'E4 the aborted attempt stays aborted', null);

  // ---------------- F. catalog race at 99/100 (catalog enforced is refused by set_activation_phase; forced by the DB owner here)
  await q(`INSERT INTO public.services (name, user_id) SELECT format('Race product %s', n), ${U(25)} FROM generate_series(1, 99) n;
           UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'catalog_capacity';`);
  const P = 6;
  const rF = await race(q, container, 910106, Array.from({ length: P }, (_, i) =>
    `SELECT tst.login(${U(25)}); INSERT INTO public.services (name, user_id) VALUES ('Race product extra ${i}', auth.uid()) RETURNING 'inserted';`), assertions);
  await q(`UPDATE public.subscription_activation SET phase = 'prepared' WHERE component = 'catalog_capacity';`);
  ok(rF.filter((r) => r.ok).length === 1 && rF.filter((r) => !r.ok).every((r) => /catalog_capacity_reached/.test(r.out)),
    `F1 ${P} parallel inserts at 99/100: exactly one succeeds, the rest catalog_capacity_reached`, rF.map((r) => (r.ok ? 'ok' : r.out.slice(0, 80))));
  ok(Number(await one(`SELECT count(*) FROM public.services WHERE user_id = ${U(25)};`)) === 100, 'F2 exactly 100 products', null);

  await q(`SELECT public.set_activation_phase('free_issue', 'prepared', 'TEST 101: rollback');`);
  return { assertions };
}
