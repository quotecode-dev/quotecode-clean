// Reads synthetic TEST persona credentials from the local, gitignored
// .env.localtest.local file - never hardcoded in a committed spec file.
// See that file's own comments for the full persona roster/rationale
// (Systemic Closure task, Item A).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.localtest.local');

function loadEnv() {
  const text = readFileSync(ENV_PATH, 'utf-8');
  const map = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    map[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, '');
  }
  return map;
}

const env = loadEnv();

export const PERSONA_A = {
  userId: env.PROFLOW_TEST_PERSONA_A_USER_ID,
  email: env.PROFLOW_TEST_PERSONA_A_EMAIL,
  password: env.PROFLOW_TEST_PERSONA_A_PASSWORD,
};

export const PERSONA_SUPER_ADMIN = {
  userId: env.PROFLOW_TEST_PERSONA_SUPER_ADMIN_USER_ID,
  email: env.PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL,
  password: env.PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD,
};

// EN/International persona (Final Narrow Validation Closure task,
// 2026-09-09). Not a newly-created signup - a fresh, direct password-grant
// login check against the TEST project found this account (and its
// FREE/BASIC/EXPIRED siblings) already exists, confirmed, and working
// today (business_settings: country="International", currency="USD",
// created 2026-08-31) - it predates and is unrelated to the Supabase Auth
// TEST-project email-send rate limit disclosed in PROFLOW_TODO.md item 67.
// No new signup was attempted; this is the "safe existing-account
// alternative" path, not a rate-limit-cleared new persona. PRO tier is used
// (not FREE) so plan-gated UI (Catalog/quote limits) doesn't truncate the
// EN reachability/parity checks below. Has no userId because no test here
// mutates its tier the way PERSONA_A's does.
export const PERSONA_EN = {
  email: env.PROFLOW_TEST_INTL_PRO_EMAIL,
  password: env.PROFLOW_TEST_PLAN_PERSONAS_PASSWORD,
};

export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

for (const [name, p] of [['PERSONA_A', PERSONA_A], ['PERSONA_SUPER_ADMIN', PERSONA_SUPER_ADMIN], ['PERSONA_EN', PERSONA_EN]]) {
  if ((name !== 'PERSONA_EN' && !p.userId) || !p.email || !p.password) {
    throw new Error(`e2e/testPersonas.js: ${name} is missing from .env.localtest.local - critical-journey tests cannot run without it.`);
  }
}
