// Sets a synthetic TEST persona's business_settings entitlement-tier state
// (TEST project only) - the real product flows for reaching BASIC/PRO/
// LIFETIME/EXPIRED_TRIAL require Stripe payment or an Owner-only Admin
// action that cannot safely be exercised against a synthetic account, so
// this script is the sanctioned, TEST-only substitute (systemic closure
// task, Item A).
//
// business_settings has a BEFORE UPDATE guard trigger
// (guard_business_settings_plan_trial) that only permits a plan/
// trial_ends_at/is_lifetime change when the CALLER is an authenticated
// super_admin (or the change is a self-cancel to the free plan) - this is
// exactly the real product's own anti-self-escalation control, and it
// applies even to a direct database connection with no JWT. So this script
// authenticates as the canonical TEST Super Admin persona and performs the
// update via PostgREST (the same path the real Admin UI would use), never
// a raw `db query` bypass.
//
// Usage: node scripts/set-test-persona-tier.js <target_user_id> <tier>
//   tier one of: free | active_trial | expired_trial | basic | pro | lifetime
// Requires (from .env.localtest.local, never printed): VITE_SUPABASE_URL,
// VITE_SUPABASE_ANON_KEY, and the canonical TEST Super Admin's own email/
// password, passed via TEST_SUPER_ADMIN_EMAIL / TEST_SUPER_ADMIN_PASSWORD
// env vars (kept out of this script's own source).
import { readFileSync } from 'node:fs';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// `role` is deliberately excluded from every tier here: it has no UPDATE
// column-grant at all on business_settings (INSERT-only, by design - a
// user can never be promoted to/demoted from super_admin via any UPDATE
// path, PostgREST or otherwise, only at row-creation time). The one
// canonical TEST Super Admin persona's role was set via INSERT once and is
// permanent; this script only ever moves the plan/trial/lifetime axis.
const TIERS = {
  free: { plan: 'free', trial_ends_at: null, is_lifetime: false },
  active_trial: { plan: 'pro', trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(), is_lifetime: false },
  expired_trial: { plan: 'pro', trial_ends_at: new Date(Date.now() - 3 * 86400000).toISOString(), is_lifetime: false },
  basic: { plan: 'basic', trial_ends_at: null, is_lifetime: false },
  pro: { plan: 'pro', trial_ends_at: null, is_lifetime: false },
  lifetime: { plan: 'pro', trial_ends_at: null, is_lifetime: true },
};

function readEnvVar(name) {
  const text = readFileSync(new URL('../.env.localtest.local', import.meta.url), 'utf-8');
  const line = text.split('\n').find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}

// Exported so e2e/testPersonas.js (Playwright critical-journey suite) can
// flip a persona's tier as a test setup step without shelling out to a
// separate node process per call.
export async function setPersonaTier({ targetUserId, tierName, supabaseUrl, anonKey, adminEmail, adminPassword }) {
  if (!TIERS[tierName] || !UUID_RE.test(targetUserId)) {
    throw new Error(`Invalid targetUserId/tierName. Valid tiers: ${Object.keys(TIERS).join(', ')}`);
  }
  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const authData = await authRes.json();
  if (!authRes.ok || !authData.access_token) {
    throw new Error(`Super Admin auth failed: ${JSON.stringify(authData)}`);
  }
  const t = TIERS[tierName];
  const patchRes = await fetch(`${supabaseUrl}/rest/v1/business_settings?user_id=eq.${targetUserId}`, {
    method: 'PATCH',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ plan: t.plan, trial_ends_at: t.trial_ends_at, is_lifetime: t.is_lifetime }),
  });
  const patchData = await patchRes.json();
  if (!patchRes.ok) {
    throw new Error(`PATCH failed (HTTP ${patchRes.status}): ${JSON.stringify(patchData)}`);
  }
  return patchData;
}

async function runAsCli() {
  const [targetUserId, tierName] = process.argv.slice(2);
  if (!targetUserId || !tierName || !TIERS[tierName] || !UUID_RE.test(targetUserId)) {
    console.error(`Usage: node scripts/set-test-persona-tier.js <target_user_id> <tier>\n<target_user_id> must be a UUID.\nValid tiers: ${Object.keys(TIERS).join(', ')}`);
    process.exit(1);
  }
  const supabaseUrl = readEnvVar('VITE_SUPABASE_URL');
  const anonKey = readEnvVar('VITE_SUPABASE_ANON_KEY');
  const adminEmail = process.env.TEST_SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.TEST_SUPER_ADMIN_PASSWORD;
  if (!supabaseUrl || !anonKey || !adminEmail || !adminPassword) {
    console.error('Missing config: VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY (from .env.localtest.local) and TEST_SUPER_ADMIN_EMAIL/TEST_SUPER_ADMIN_PASSWORD (env vars) are all required.');
    process.exit(1);
  }
  try {
    const result = await setPersonaTier({ targetUserId, tierName, supabaseUrl, anonKey, adminEmail, adminPassword });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runAsCli();
}
