// account-summary/v1 end to end: the JSON produced by public.get_account_summary() (real SQL, disposable container) is fed to
// the ONE shared parser and decision rule (supabase/functions/_shared/subscriptionContract.ts, loaded by Node's TypeScript type
// stripping). Proves the SQL output is accepted by parseAccountSummary in every state, with no client-side adaptation.
// Everything runs in ONE psql session inside BEGIN ... ROLLBACK, so no state is left for later suites.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function psqlSession(container, sql) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-']);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`psql exit ${code}: ${err.trim().slice(0, 600)}`))));
    p.stdin.end(sql);
  });
}

const U = (n) => `ee100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asUser = (uid, label) => `
SELECT set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, false);
SET ROLE authenticated;
SELECT '${label}|' || public.get_account_summary()::text;
RESET ROLE;`;

export default async function run({ container, root }) {
  const assertions = [];
  const ok = (cond, label, got) => assertions.push(cond ? `PASS: ${label}` : `FAIL: ${label} (got ${JSON.stringify(got)})`);
  const contract = await import(pathToFileURL(path.join(root, 'supabase', 'functions', '_shared', 'subscriptionContract.ts')).href);
  const { parseAccountSummary, decideCapability, ACCOUNT_SUMMARY_SCHEMA } = contract;

  const sql = `
BEGIN;
SET LOCAL tekango.skip_signup_provisioning = 'on';  -- pre-A-1 fixture: entitlements seeded by hand (20261018100000 test device)
DELETE FROM public.style_media_capability_policy;  -- this parser test pins the NO-policy baseline (rolled back with the session)
INSERT INTO auth.users (id, email) VALUES ('${U(1)}', 'p1@synthetic.test'), ('${U(2)}', 'p2@synthetic.test'), ('${U(3)}', 'p3@synthetic.test');
INSERT INTO public.business_settings (user_id, email, business_name, country, currency) VALUES
  ('${U(1)}', 'p1@synthetic.test', 'Parser Free', 'Local', 'ILS'),
  ('${U(2)}', 'p2@synthetic.test', 'Parser Paid', 'International', 'USD'),
  ('${U(3)}', 'p3@synthetic.test', 'Parser Unprovisioned', 'Local', 'ILS');
INSERT INTO public.account_entitlements (user_id, account_mode) VALUES ('${U(1)}', 'free_10');
INSERT INTO public.account_entitlements (user_id, account_mode, style_plan_id, subscription_status, catalog_expansion_blocks)
  VALUES ('${U(2)}', 'paid', 'visual', 'active', 1);
INSERT INTO public.account_market (user_id, market, source) VALUES ('${U(1)}', 'IL', 'owner_mapping'), ('${U(2)}', 'INTERNATIONAL', 'owner_mapping');
INSERT INTO public.services (name, user_id) VALUES ('Parser product 1', '${U(2)}'), ('Parser product 2', '${U(2)}');
SELECT set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, false);
SET ROLE authenticated;
SELECT 'NOAUTH|' || public.get_account_summary()::text;
RESET ROLE;
${asUser(U(1), 'PREPARED')}
SELECT public.set_activation_phase('free_issue', 'shadow', 'TEST: parser shadow') IS NOT NULL AS shadow;
${asUser(U(3), 'UNPROV')}
${asUser(U(1), 'FREE')}
${asUser(U(2), 'PAID')}
UPDATE public.subscription_activation SET phase = 'enforced' WHERE component = 'free_issue';
INSERT INTO public.subscription_capability_policy (policy_version, account_mode, style_plan_id, capability_id, approval_ref)
  VALUES (1, 'paid', 'visual', 'catalog_product_image.upload', 'TEST-FIXTURE-NOT-COMMERCIAL');
${asUser(U(2), 'PAID_ENF')}
${asUser(U(1), 'FREE_ENF')}
ROLLBACK;
`;
  const out = await psqlSession(container, sql);
  const rows = Object.fromEntries(out.split('\n').filter((l) => /^[A-Z_]+\|/.test(l)).map((l) => {
    const i = l.indexOf('|');
    return [l.slice(0, i), JSON.parse(l.slice(i + 1))];
  }));
  const p = (k) => parseAccountSummary(rows[k]);

  ok(p('NOAUTH').state === 'unavailable' && p('NOAUTH').code === 'not_authenticated', 'P1 not_authenticated -> parser state unavailable', p('NOAUTH'));
  ok(p('PREPARED').state === 'not_activated', 'P2 phase prepared -> parser state not_activated', p('PREPARED'));
  ok(p('UNPROV').state === 'unprovisioned', 'P3 account_not_provisioned -> parser state unprovisioned', p('UNPROV'));
  const free = p('FREE');
  ok(rows.FREE?.schema === ACCOUNT_SUMMARY_SCHEMA && free.state === 'ready', 'P4 Free summary is accepted by the strict parser (ready)', free);
  ok(free.planId === 'free' && free.market === 'IL' && free.subscriptionStatus === 'none' && free.version === 1
     && JSON.stringify(free.free10) === JSON.stringify({ limit: 10, consumed: 0, reserved: 0, remaining: 10 })
     && JSON.stringify(free.catalog) === JSON.stringify({ active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false })
     && JSON.stringify([...free.capabilities].sort()) === JSON.stringify(['professional_quote.reuse', 'professional_quote.use', 'quote.edit_duplicate', 'quote.whatsapp_delete', 'quote_style.classic'].sort())
     && JSON.stringify(free.phase) === JSON.stringify({ output: 'shadow', catalog: 'prepared', billing: 'off' })
     && typeof free.priceCatalogVersion === 'string', 'P5 Free parsed values', free);
  const paid = p('PAID');
  ok(paid.state === 'ready' && paid.planId === 'visual' && paid.free10 === null && paid.market === 'INTERNATIONAL'
     && JSON.stringify(paid.catalog) === JSON.stringify({ active: 2, countDefinition: 'unset', limit: 200, blocks: 1, limitDecided: true })
     && paid.subscriptionStatus === 'active', 'P6 paid summary accepted: free10 null, catalog 100 + 100 x 1 = 200', paid);
  const shadowDecision = decideCapability(paid, 'catalog_product_image.upload', true);
  ok(shadowDecision.allowed === true && shadowDecision.source === 'legacy', 'P7 not enforced: the decision keeps the legacy entitlement', shadowDecision);
  const paidEnf = p('PAID_ENF');
  const dPaid = decideCapability(paidEnf, 'catalog_product_image.upload', false);
  ok(paidEnf.state === 'ready' && paidEnf.phase.output === 'enforced' && dPaid.allowed === true && dPaid.source === 'server',
     'P8 enforced + approved policy row: server capability list grants (decideCapability)', { paidEnf, dPaid });
  const freeEnf = p('FREE_ENF');
  const dFree = decideCapability(freeEnf, 'catalog_product_image.upload', true);
  ok(freeEnf.state === 'ready' && dFree.allowed === false && dFree.reason === 'free_not_eligible',
     'P9 enforced Free: catalog image upload denied free_not_eligible (OD-18), whatever the legacy record says', { freeEnf, dFree });
  const dModern = decideCapability(paidEnf, 'quote_style.modern', true);
  ok(dModern.allowed === false && dModern.reason === 'not_included', 'P10 enforced: a capability without a policy row is not included', dModern);
  return { assertions };
}
