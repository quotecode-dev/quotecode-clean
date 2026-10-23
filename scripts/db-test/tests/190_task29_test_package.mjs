// Task 29 - the TEST package apply / re-apply route, proven on DISPOSABLE databases inside the harness container (never TEST):
//   P1 fresh install of the whole package (A + B) on a database that has only the pre-package base -> every step ok; A1 recognized
//   P2 whole-package RE-APPLY after A5 (with data): A1 = verified skip, 16 others re-run; data and the catalog fingerprint unchanged
//   P3 partial install (up to A1) + resume -> completes; the catalog equals the fresh install
//   P4 refusals: a corrupted A1 constraint, a foreign tasks table, a changed guard function -> STOP at A1, nothing after it runs
//   P5 follow-up concurrency on the re-applied database: 8 simultaneous sessions -> one row
// TK_CAPTURE_PROBE=<file>: writes the two recognized A1 states observed on the fresh install (to build the plan; never a gate).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const versionKey = (f) => (f.match(/^(\d+)_/)?.[1] ?? '').padEnd(16, '0');
const byVersion = (a, b) => versionKey(a).localeCompare(versionKey(b)) || a.localeCompare(b);
const isBase = (f) => /_capture_base_/.test(f);

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${String(JSON.stringify(got)).slice(0, 600)})`);
  const { applyPackage, loadPlan, classifyProbe } = await import(pathToFileURL(path.join(root, 'scripts', 'db-test', 'package', 'apply-test-package.mjs')).href);
  const psqlDb = (db, sql, { transaction = false } = {}) => {
    const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A',
      ...(transaction ? ['--single-transaction'] : []), '-f', '-'], { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { ok: r.status === 0, out: r.stdout, err: r.stderr };
  };
  const execFor = (db) => async (sql, o) => psqlDb(db, sql, o);
  const { plan, entries, problems } = loadPlan(root);
  ok(problems.length === 0, 'PLAN: every file matches the plan sha256, the harness contract and the transaction mode', problems);
  const pkg = new Set(plan.migrations.map((m) => m.file));
  const contractPath = path.join(root, 'scripts', 'db-test', 'migration-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8')).migrations;
  const migDir = path.join(root, 'supabase', 'migrations');
  const all = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  // Task 37: a migration AFTER the package is applied to TEST by its own sealed route once the package is in place - it is never part of
  // the base this test builds (it would run before the package and be overwritten). Only an explicitly listed one is allowed; any other
  // later migration still fails closed.
  // + night task 2026-10-16 (A-5): its own Owner-run route after the package, like task35
  // + admin release 2026-10-16 (Owner): the re-issued admin re-auth proofs + audit log, its own Owner-run route after the package
  const POST_PACKAGE_OWN_ROUTE = new Set(['20261012120000_task35_quote_items_price_missing.sql', '20261016000000_account_erasure_contact_stops.sql', '20261016000200_admin_reauth_proofs_and_audit_log_reissue.sql', '20261016100000_admin_redesign_part_a.sql', '20261017000000_admin_followup_counter_and_nulls.sql', '20261018000000_quote_expiry_country_alias.sql', '20261018100000_free10_activation_rules.sql', '20261019120000_quote_signed_at.sql', '20261019150000_chat_ai_daily_usage.sql', '20261019180000_voice_ai_daily_usage.sql', '20261019200000_support_inbound_messages.sql', '20261020100000_support_inbound_stage2.sql', '20261020200000_admin_supervisor_permissions.sql', '20261021000000_payplus_phase1_verified_package_activation.sql', '20261021100000_free10_save_count_and_seven_days.sql', '20261021200000_billing_period_grace_limited.sql', '20261021300000_explicit_grants_direct_api_tables.sql', '20261021400000_smart_pack_entitlement.sql', '20261022000000_payplus_standing_order_link.sql', '20261022100000_payplus_audit_fixes.sql', '20261022200000_payplus_checkout_pull.sql', '20261022300000_billing_admin_stop_and_refund.sql', '20261023000000_customer_twin.sql', '20261023100000_expense_invoices.sql']);
  const ordered = [...all.filter(isBase).sort(byVersion), ...all.filter((f) => !isBase(f)).sort(byVersion)].filter((f) => !pkg.has(f));
  const baseOrder = ordered.filter((f) => !POST_PACKAGE_OWN_ROUTE.has(f));
  ok(baseOrder.every((f) => f < '20261007150000'), 'PLAN: every non-package migration precedes the package (the package is the tail of the chain; listed own-route migrations follow it)', baseOrder.filter((f) => f >= '20261007150000'));
  ok([...POST_PACKAGE_OWN_ROUTE].every((f) => !all.includes(f) || f > plan.migrations.map((m) => m.file).sort(byVersion).at(-1)), 'PLAN: every own-route migration follows the whole package', [...POST_PACKAGE_OWN_ROUTE]);

  const bootstrap = (db) => {
    psqlDb('postgres', `DROP DATABASE IF EXISTS ${db};`); psqlDb('postgres', `CREATE DATABASE ${db};`);
    const s = psqlDb(db, fs.readFileSync(path.join(root, 'scripts', 'db-test', 'stubs.sql'), 'utf8'));
    if (!s.ok) throw new Error(`stubs on ${db}: ${s.err}`);
    for (const f of baseOrder) {
      const c = contract[f];
      if (c.preFixture) { const fx = psqlDb(db, fs.readFileSync(path.resolve(path.dirname(contractPath), c.preFixture), 'utf8'), { transaction: true }); if (!fx.ok) throw new Error(`fixture ${f}: ${fx.err}`); }
      const r = psqlDb(db, fs.readFileSync(path.join(migDir, f), 'utf8'), { transaction: c.mode === 'transaction' });
      if (!r.ok) throw new Error(`base ${f} on ${db}: ${r.err.slice(0, 400)}`);
    }
  };
  const a1 = entries.find((e) => e.reapply === 'postcondition');
  const probe = (db) => classifyProbe(a1, psqlDb(db, a1.probe).out);
  // catalog fingerprint of every package-owned public object + RLS flags (constraints, indexes, policies, triggers, function bodies)
  const CATALOG = `SELECT md5(string_agg(x, E'\\n' ORDER BY x)) FROM (
      SELECT 'con ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) AS x FROM pg_constraint WHERE connamespace = 'public'::regnamespace
      UNION ALL SELECT 'idx ' || indexrelid::regclass || ' ' || pg_get_indexdef(indexrelid) FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace
      UNION ALL SELECT 'pol ' || polrelid::regclass || ' ' || polname || ' ' || polcmd::text || ' ' || coalesce(pg_get_expr(polqual, polrelid), '') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid), '') FROM pg_policy
      UNION ALL SELECT 'trg ' || tgrelid::regclass || ' ' || tgname || ' ' || tgenabled::text FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace)
      UNION ALL SELECT 'fn ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || p.prosecdef FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      UNION ALL SELECT 'rls ' || c.oid::regclass || ' ' || c.relrowsecurity || ' ' || c.relforcerowsecurity FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
      UNION ALL SELECT 'col ' || a.attrelid::regclass || ' ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' ' || a.attnotnull FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ) s;`;
  const DATA = `SELECT md5(coalesce((SELECT string_agg(t::text, '|' ORDER BY t.id) FROM public.tasks t), '') || '#' || coalesce((SELECT string_agg(q::text, '|' ORDER BY q.id) FROM public.quote_templates q), '')
    || '#' || coalesce((SELECT string_agg(b::text, '|' ORDER BY b.user_id) FROM public.business_share_defaults b), '') || '#' || coalesce((SELECT string_agg(s::text, '|' ORDER BY s.quote_id) FROM public.quote_service_schedule s), '')
    || '#' || coalesce((SELECT string_agg(p::text, '|' ORDER BY p.price_id) FROM public.price_versions p), '') || '#' || coalesce((SELECT string_agg(a::text, '|' ORDER BY a.component) FROM public.subscription_activation a), ''));`;
  const one = (db, sql) => psqlDb(db, sql).out.trim().split('\n').pop();

  // ---------------- P1 fresh install
  bootstrap('pkg_fresh');
  ok(probe('pkg_fresh').state === 'absent', 'P1: before the package, A1 is absent on the base-only database', probe('pkg_fresh'));
  const r1 = await applyPackage({ root, exec: execFor('pkg_fresh'), groups: ['A', 'B'] });
  const N = plan.migrations.length; // Task 30: 18 (B13 = 20261011130000 joined group B); was 17 in Task 29
  ok(r1.ok && r1.steps.length === N && r1.steps.every((s) => s.ok && s.action === 'applied'), `P1: fresh install - all ${N} steps applied, in plan order`, r1.steps);
  ok(r1.steps.find((s) => s.file === a1.file)?.recognized === 'a1_only', 'P1: right after A1 its postcondition is the plain A1 state', r1.steps.find((s) => s.file === a1.file));
  const fresh = probe('pkg_fresh');
  ok(fresh.state === 'applied' && fresh.recognized === 'a1_extended_by_a5', 'P1: after the whole package A1 is recognized as extended by A5', fresh);
  if (process.env.TK_CAPTURE_PROBE) {
    // capture both states from a REAL install, applying the exact package bytes directly in plan order (independent of the plan's states;
    // never a gate): the probe right after A1, and the probe after the whole package
    bootstrap('pkg_capture');
    const pick = () => {
      const r = psqlDb('pkg_capture', a1.probe);
      if (!r.ok || !r.out.trim()) throw new Error(`capture probe: ${r.err.slice(0, 400)}`);
      return JSON.parse(r.out.trim().split('\n').pop());
    };
    let afterA1 = null;
    for (const e of entries) {
      const r = psqlDb('pkg_capture', e.text, { transaction: true });
      if (!r.ok) throw new Error(`capture install ${e.file}: ${r.err.slice(0, 300)}`);
      if (e.file === a1.file) afterA1 = pick();
    }
    fs.writeFileSync(process.env.TK_CAPTURE_PROBE, JSON.stringify([
      { name: 'a1_only', expect: afterA1 },
      { name: 'a1_extended_by_a5', expect: pick() },
    ], null, 2));
  }
  const freshCatalog = one('pkg_fresh', CATALOG);

  // ---------------- P2 re-apply after A5, with data
  const seed = psqlDb('pkg_fresh', `
    INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-9290-000000000001', 'pkg@synthetic.test');
    INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES ('00000000-0000-4000-9290-000000000001', 'pkg@synthetic.test', 'Synthetic Pkg', 'Local', 'ILS');
    INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES ('00000000-0000-4000-9290-0000000000f1', '00000000-0000-4000-9290-000000000001', 99290, 'sent');
    SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9290-000000000001","role":"authenticated"}', false);
    SET ROLE authenticated;
    INSERT INTO public.tasks (title, quote_id) VALUES ('Ordinary', '00000000-0000-4000-9290-0000000000f1');
    SELECT public.create_follow_up_task('00000000-0000-4000-9290-00000000aa01', '00000000-0000-4000-9290-0000000000f1', 'Follow up 99290');
    INSERT INTO public.quote_templates (name, content) VALUES ('Synthetic', '{"schema":"quote-template/v1","items":[]}');
    INSERT INTO public.business_share_defaults (share_text) VALUES ('Hi {customer}');
    INSERT INTO public.quote_service_schedule (quote_id, service_date) VALUES ('00000000-0000-4000-9290-0000000000f1', DATE '2026-11-02');
    RESET ROLE;`);
  ok(seed.ok, 'P2: synthetic data seeded (ordinary task, follow-up via RPC, template, share defaults, work date)', seed.err);
  const dataBefore = one('pkg_fresh', DATA);
  const r2 = await applyPackage({ root, exec: execFor('pkg_fresh'), groups: ['A', 'B'] });
  ok(r2.ok, 'P2: the whole package re-applies on its own post-state (after A5)', r2.steps.filter((s) => !s.ok));
  ok(r2.steps.find((s) => s.file === a1.file)?.action === 'verified-already-applied', 'P2: A1 is a VERIFIED skip (its old guard is not re-run on the extended table)', r2.steps.find((s) => s.file === a1.file));
  ok(r2.steps.filter((s) => s.action === 'applied').length === N - 1, `P2: the ${N - 1} idempotent migrations re-ran`, r2.steps.map((s) => s.action));
  ok(one('pkg_fresh', DATA) === dataBefore, 'P2: data unchanged by the re-apply', { before: dataBefore });
  ok(one('pkg_fresh', CATALOG) === freshCatalog, 'P2: constraints / indexes / policies / triggers / functions / RLS / columns unchanged', null);
  const r2b = await applyPackage({ root, exec: execFor('pkg_fresh'), groups: ['A'] });
  ok(r2b.ok && one('pkg_fresh', CATALOG) === freshCatalog, 'P2: re-applying group A alone is also stable', r2b.steps.filter((s) => !s.ok));

  // ---------------- P5 follow-up concurrency on the re-applied database
  const lock = 7_290_005;
  const holder = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'pkg_fresh', '-X', '-q', '-t', '-A']);
  let hout = ''; const held = new Promise((res) => { holder.stdout.on('data', (d) => { hout += d; if (hout.includes('HELD')) res(); }); });
  holder.stdin.write(`SELECT pg_advisory_lock(${lock});\n\\echo HELD\n`); await held;
  const QU = '00000000-0000-4000-9290-0000000000f2';
  psqlDb('pkg_fresh', `INSERT INTO public.quotes (id, user_id, quote_number, status) VALUES ('${QU}', '00000000-0000-4000-9290-000000000001', 99291, 'sent');`);
  const workers = Array.from({ length: 8 }, (_, n) => new Promise((resolve) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'pkg_fresh', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let o = ''; p.stdout.on('data', (d) => { o += d; }); p.on('close', () => resolve(o.trim().split('\n').pop()));
    p.stdin.end(`SELECT pg_advisory_lock_shared(${lock});\nSELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9290-000000000001","role":"authenticated"}', false);\nSET ROLE authenticated;\nSELECT (public.create_follow_up_task('00000000-0000-4000-9290-0000000bb${String(n).padStart(3, '0')}', '${QU}', 'Race'))::text;\n`);
  }));
  for (let i = 0; i < 80; i++) { if (Number(one('pkg_fresh', `SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ${lock};`)) >= 8) break; await new Promise((r) => setTimeout(r, 250)); }
  await new Promise((res) => { holder.on('close', res); holder.stdin.end(`SELECT pg_advisory_unlock(${lock});\n\\q\n`); });
  const res = (await Promise.all(workers)).map((x) => { try { return JSON.parse(x); } catch { return { raw: x }; } });
  ok(res.filter((r) => r.created === true).length === 1 && new Set(res.map((r) => r.task?.id)).size === 1, 'P5: 8 simultaneous follow-up requests after the re-apply -> one created, all got the same task', res.map((r) => r.reason || r.raw));
  ok(Number(one('pkg_fresh', `SELECT count(*) FROM public.tasks WHERE quote_id = '${QU}' AND kind = 'follow_up';`)) === 1, 'P5: exactly one follow-up row', null);

  // ---------------- P3 partial install + resume
  bootstrap('pkg_partial');
  const upToA1 = plan.migrations.map((m) => m.file).filter((f) => f <= a1.file);
  const r3a = await applyPackage({ root, exec: execFor('pkg_partial'), groups: ['A', 'B'], only: upToA1 });
  ok(r3a.ok && r3a.steps.length === upToA1.length, `P3: partial install of the first ${upToA1.length} files (up to A1)`, r3a.steps.filter((s) => !s.ok));
  const r3 = await applyPackage({ root, exec: execFor('pkg_partial'), groups: ['A', 'B'] });
  ok(r3.ok && r3.steps.find((s) => s.file === a1.file)?.action === 'verified-already-applied', 'P3: resume completes; A1 verified (plain state), the rest applied / re-run', r3.steps.filter((s) => !s.ok));
  ok(one('pkg_partial', CATALOG) === freshCatalog, 'P3: the resumed database has the same catalog as the fresh install', null);

  // ---------------- P4 refusals (nothing after A1 may run)
  const stopsAtA1 = (r) => !r.ok && r.steps.at(-1)?.file === a1.file && r.steps.at(-1)?.action === 'refused' && r.steps.every((s) => s.file <= a1.file);
  // corrupted constraint (dropped named check)
  psqlDb('pkg_partial', 'ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;');
  const r4a = await applyPackage({ root, exec: execFor('pkg_partial'), groups: ['A', 'B'] });
  ok(stopsAtA1(r4a) && /constraint/.test(r4a.steps.at(-1).error), 'P4a: a missing A1 constraint -> refused at A1, nothing after it ran', r4a.steps.at(-1));
  // a weaker constraint under the SAME name
  psqlDb('pkg_partial', "ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('open', 'completed', 'archived'));");
  const r4b = await applyPackage({ root, exec: execFor('pkg_partial'), groups: ['A', 'B'] });
  ok(stopsAtA1(r4b), 'P4b: a same-named but different constraint -> refused at A1', r4b.steps.at(-1));
  // changed guard function body
  bootstrap('pkg_guard');
  await applyPackage({ root, exec: execFor('pkg_guard'), groups: ['A', 'B'] });
  psqlDb('pkg_guard', 'CREATE OR REPLACE FUNCTION public.tasks_guard_row() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RETURN NEW; END $f$;');
  const r4c = await applyPackage({ root, exec: execFor('pkg_guard'), groups: ['A', 'B'] });
  ok(stopsAtA1(r4c) && /guard_fn/.test(r4c.steps.at(-1).error), 'P4c: a replaced (weakened) guard function -> refused at A1', r4c.steps.at(-1));
  // foreign pre-existing tasks table
  bootstrap('pkg_foreign');
  psqlDb('pkg_foreign', 'CREATE TABLE public.tasks (id uuid PRIMARY KEY, title text, owner uuid);');
  const r4d = await applyPackage({ root, exec: execFor('pkg_foreign'), groups: ['A'] });
  ok(!r4d.ok && r4d.steps.length === 1 && r4d.steps[0].file === a1.file && r4d.steps[0].action === 'refused', 'P4d: a foreign tasks table -> refused at A1 (never adopted), nothing else ran', r4d.steps);
  ok(one('pkg_foreign', "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks';") === '3', 'P4d: the foreign table is untouched', null);
  // a plan / file mismatch fails before anything runs
  const tampered = await applyPackage({ root: path.join(root, '__no_such_root__'), exec: execFor('pkg_foreign') }).catch((e) => ({ thrown: String(e.message || e).slice(0, 120) }));
  ok(Boolean(tampered.thrown) || (tampered.problems?.length > 0 && tampered.steps.length === 0), 'P4e: a missing / different file set fails closed before any SQL', tampered);

  for (const db of ['pkg_fresh', 'pkg_partial', 'pkg_guard', 'pkg_foreign', 'pkg_capture']) psqlDb('postgres', `DROP DATABASE IF EXISTS ${db};`);
  return { assertions };
}
