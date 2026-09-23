// PRODUCT TRUTH FINAL DELTA CLOSURE — item 7, PLAN/ROLE SERVER FACTS. Read-only: signs in as each
// synthetic TEST persona (their own password, from the Owner-authorized C:/tkrc-pt/.env.localtest.local,
// never printed) and reads back THEIR OWN business_settings row (RLS-scoped to themselves - no
// service-role bypass, no other persona's row is ever touched). Output is redacted: email/user id
// are hashed, never printed in the clear, so this script's own stdout/evidence output cannot leak a
// real identifier even though it is a synthetic TEST account.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ENV_PATH = 'C:/tkrc-pt/.env.localtest.local';
const envText = readFileSync(ENV_PATH, 'utf-8');
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!m) throw new Error(`missing env var ${name}`);
  return m[1].trim();
}
const SUPABASE_URL = envVar('VITE_SUPABASE_URL');
const ANON_KEY = envVar('VITE_SUPABASE_ANON_KEY');
const SHARED = 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD';
const PERSONAS = {
  LOCAL_PRO: { emailVar: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', passVar: SHARED, expectMarket: 'Local', expectPlan: 'pro' },
  LOCAL_BASIC: { emailVar: 'PROFLOW_TEST_LOCAL_BASIC_EMAIL', passVar: SHARED, expectMarket: 'Local', expectPlan: 'basic' },
  LOCAL_FREE: { emailVar: 'PROFLOW_TEST_LOCAL_FREE_EMAIL', passVar: SHARED, expectMarket: 'Local', expectPlan: 'free' },
  LOCAL_ADMIN: { emailVar: 'PROFLOW_TEST_LOCAL_ADMIN_EMAIL', passVar: 'PROFLOW_TEST_LOCAL_ADMIN_PASSWORD', expectMarket: 'Local', expectRole: 'super_admin' },
  INTL_PRO: { emailVar: 'PROFLOW_TEST_INTL_PRO_EMAIL', passVar: SHARED, expectMarket: 'International', expectPlan: 'pro' },
  INTL_BASIC: { emailVar: 'PROFLOW_TEST_INTL_BASIC_EMAIL', passVar: SHARED, expectMarket: 'International', expectPlan: 'basic' },
  INTL_FREE: { emailVar: 'PROFLOW_TEST_INTL_FREE_EMAIL', passVar: SHARED, expectMarket: 'International', expectPlan: 'free' },
  PERSONA_SUPER_ADMIN: { emailVar: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL', passVar: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD', expectMarket: 'Local', expectRole: 'super_admin' },
};

function redactedAlias(email) {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

async function verifyPersona(alias, def) {
  const email = envVar(def.emailVar);
  const password = envVar(def.passVar);
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const signInJson = await signInRes.json();
  if (!signInJson.access_token) {
    return { alias, redactedEmailHash: redactedAlias(email), signInOk: false, http: signInRes.status };
  }
  // The caller's own user id, from the JWT `sub` claim it was just issued (never the request body,
  // never trusted from elsewhere) - required because an admin-role persona's RLS policy may permit
  // seeing OTHER tenants' rows too (needed for the real Admin feature), so `rows[0]` of an unscoped
  // select is not reliably "this persona's own row" once role is admin - it must be explicitly
  // filtered to their own id, exactly like the product's own server code does (never inferred).
  const jwtPayload = JSON.parse(Buffer.from(signInJson.access_token.split('.')[1], 'base64url').toString('utf-8'));
  const ownUserId = jwtPayload.sub;
  const selectRes = await fetch(
    `${SUPABASE_URL}/rest/v1/business_settings?select=plan,is_lifetime,role,country,trial_ends_at&user_id=eq.${ownUserId}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${signInJson.access_token}` } },
  );
  const rows = await selectRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    alias,
    redactedEmailHash: redactedAlias(email),
    signInOk: true,
    http: selectRes.status,
    serverPlan: row?.plan ?? null,
    serverIsLifetime: row?.is_lifetime ?? null,
    serverRole: row?.role ?? null,
    serverCountry: row?.country ?? null,
    expectMarket: def.expectMarket,
    expectPlan: def.expectPlan ?? null,
    expectRole: def.expectRole ?? null,
  };
}

const results = [];
for (const [alias, def] of Object.entries(PERSONAS)) {
  const r = await verifyPersona(alias, def);
  results.push(r);
  console.log(`${alias}: http=${r.http} plan=${r.serverPlan} role=${r.serverRole} country=${r.serverCountry}`);
}

writeFileSync(
  'evidence/product-truth/2026-09-24-final-delta-closure-plan-role-server-facts.json',
  JSON.stringify({ capturedAtUtc: new Date().toISOString(), testProjectRef: 'ljfizgrdyzxddswcedwr', method: 'auth_signin_plus_rls_scoped_select_readonly', results }, null, 2) + '\n',
);
console.log('Wrote evidence/product-truth/2026-09-24-final-delta-closure-plan-role-server-facts.json');
