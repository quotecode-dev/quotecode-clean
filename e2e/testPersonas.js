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

export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

for (const [name, p] of [['PERSONA_A', PERSONA_A], ['PERSONA_SUPER_ADMIN', PERSONA_SUPER_ADMIN]]) {
  if (!p.userId || !p.email || !p.password) {
    throw new Error(`e2e/testPersonas.js: ${name} is missing from .env.localtest.local - critical-journey tests cannot run without it.`);
  }
}
