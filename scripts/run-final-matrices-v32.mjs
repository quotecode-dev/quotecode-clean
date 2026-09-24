// PRODUCT TRUTH FINAL THREE-ACTION DELTA - Action B evidence capture. Runs EVERY required slot of the four final
// acceptance matrices (48 Owner / 13 Plan-Role / 9 Security / 4 AI Support = 74 real TEST calls) FRESH against the
// currently deployed TEST chat-ai, so no final row has to lean on a historical (v31) capture or on relabelled
// metadata. The slots - prompt, persona, language - come from the STATIC acceptance definitions
// (src/data/productTruthFinalMatrixAcceptance.js), never from an earlier evidence file.
//
// Real synthetic TEST personas only (credentials read from the Owner-authorized, gitignored
// C:/tkrc-pt/.env.localtest.local, never printed); sign-in via the Supabase Auth REST API (never the service-role
// key); chat-ai is called exactly like the real dashboard widget does. The chat-ai version is bracketed with
// read-only `supabase functions list` reads before AND after the run, and the run is refused if it changed mid-run.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FINAL_MATRIX_DEFINITIONS, TEST_PROJECT_REF } from '../src/data/productTruthFinalMatrixAcceptance.js';

// version-agnostic (the name is historical): captures whichever chat-ai version is deployed and records it in the before/after bracket.
const OUT = process.argv[2] || 'evidence/product-truth/2026-09-24-account-system-question-v39-raw-matrices.json';
const envText = readFileSync('C:/tkrc-pt/.env.localtest.local', 'utf-8');
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!m) throw new Error(`missing env var ${name}`);
  return m[1].trim();
}
const SUPABASE_URL = envVar('VITE_SUPABASE_URL');
const ANON_KEY = envVar('VITE_SUPABASE_ANON_KEY');
if (!SUPABASE_URL.includes(TEST_PROJECT_REF)) throw new Error(`REFUSING: VITE_SUPABASE_URL is not the TEST project ${TEST_PROJECT_REF}`);

const SHARED = 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD';
const PERSONAS = {
  LOCAL_PRO: { emailVar: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', passVar: SHARED, market: 'Local', plan: 'PRO (lifetime)', role: 'user' },
  LOCAL_BASIC: { emailVar: 'PROFLOW_TEST_LOCAL_BASIC_EMAIL', passVar: SHARED, market: 'Local', plan: 'BASIC (lifetime)', role: 'user' },
  LOCAL_ADMIN: { emailVar: 'PROFLOW_TEST_LOCAL_ADMIN_EMAIL', passVar: 'PROFLOW_TEST_LOCAL_ADMIN_PASSWORD', market: 'Local', plan: 'PRO', role: 'super_admin' },
  INTL_PRO: { emailVar: 'PROFLOW_TEST_INTL_PRO_EMAIL', passVar: SHARED, market: 'International', plan: 'PRO (lifetime)', role: 'user' },
  INTL_BASIC: { emailVar: 'PROFLOW_TEST_INTL_BASIC_EMAIL', passVar: SHARED, market: 'International', plan: 'BASIC (lifetime)', role: 'user' },
  INTL_FREE: { emailVar: 'PROFLOW_TEST_INTL_FREE_EMAIL', passVar: SHARED, market: 'International', plan: 'FREE', role: 'user' },
  PERSONA_SUPER_ADMIN: { emailVar: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_EMAIL', passVar: 'PROFLOW_TEST_PERSONA_SUPER_ADMIN_PASSWORD', market: 'Local', plan: 'FREE', role: 'super_admin' },
};

function chatAiIdentity() {
  const out = execFileSync('npx', ['--no-install', 'supabase', 'functions', 'list', '--project-ref', TEST_PROJECT_REF], { encoding: 'utf-8', shell: true, cwd: 'C:/tkrc-pt' });
  const fn = JSON.parse(out).functions.find((f) => f.slug === 'chat-ai');
  if (!fn) throw new Error('chat-ai not found in functions list');
  return { readAtUtc: new Date().toISOString(), id: fn.id, name: fn.name, version: fn.version, updatedAtEpochMs: fn.updated_at, updatedAtUtc: new Date(fn.updated_at).toISOString(), ezbrSha256: fn.ezbr_sha256, status: fn.status };
}

const tokens = new Map();
async function signIn(alias) {
  if (tokens.has(alias)) return tokens.get(alias);
  const p = PERSONAS[alias];
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email: envVar(p.emailVar), password: envVar(p.passVar) }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`sign-in failed for ${alias} (http ${res.status})`);
  const jwt = JSON.parse(Buffer.from(json.access_token.split('.')[1], 'base64url').toString('utf-8'));
  const t = { accessToken: json.access_token, userId: jwt.sub };
  tokens.set(alias, t);
  return t;
}

async function askChat(alias, prompt, isHebrew) {
  const auth = await signIn(alias);
  const startedAtUtc = new Date().toISOString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], isHebrew: !!isHebrew, isDashboard: true }),
  });
  const json = await res.json().catch(() => ({}));
  const p = PERSONAS[alias];
  return {
    startedAtUtc, timestampUtc: new Date().toISOString(), alias, market: p.market, plan: p.plan, role: p.role,
    language: isHebrew ? 'he' : 'en', prompt, response: json.answer ?? json.message ?? null, answerSource: json.answerSource ?? null,
    // STRUCTURED TRUTH: the runtime's own `factPayload`, exactly as the HTTP response carried it (null for a free-form model answer)
    factPayload: json.factPayload ?? null, contractVersion: json.contractVersion ?? null,
    requestId: json.requestId ?? null, http: res.status,
  };
}

// The harness and the server run on different clocks (the acceptance binding tolerates 5 s of skew), so the read-back window opens 5 s
// BEFORE the call started - otherwise a row stamped a few hundred ms earlier by the server clock is silently missed.
const READBACK_SKEW_MS = 5000;
async function readBackChatLog(userQuestion, callStartedIso) {
  const sinceIso = new Date(Date.parse(callStartedIso) - READBACK_SKEW_MS).toISOString();
  const auth = await signIn('PERSONA_SUPER_ADMIN');
  const url = `${SUPABASE_URL}/rest/v1/chat_logs?select=id,category,user_question,created_at&user_question=eq.${encodeURIComponent(userQuestion)}&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=1`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.accessToken}` } });
  const json = await res.json().catch(() => null);
  return { httpStatus: res.status, row: Array.isArray(json) ? (json[0] ?? null) : null };
}

async function readServerFacts() {
  const out = [];
  for (const alias of Object.keys(PERSONAS)) {
    const t = await signIn(alias);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/business_settings?select=plan,is_lifetime,role,country&user_id=eq.${t.userId}`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${t.accessToken}` } });
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    out.push({ alias, http: res.status, serverPlan: row?.plan ?? null, serverIsLifetime: row?.is_lifetime ?? null, serverRole: row?.role ?? null, serverCountry: row?.country ?? null, userIdHash: createHash('sha256').update(t.userId).digest('hex').slice(0, 12) });
  }
  return { capturedAtUtc: new Date().toISOString(), method: 'auth_signin_plus_rls_scoped_select_readonly', results: out };
}

const before = chatAiIdentity();
console.log('chat-ai BEFORE:', JSON.stringify(before));
const raw = { testProjectRef: TEST_PROJECT_REF, functionBefore: before, matrices: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [key, def] of Object.entries(FINAL_MATRIX_DEFINITIONS)) {
  raw.matrices[key] = [];
  for (const slot of def.slots) {
    const call = await askChat(slot.persona, slot.prompt, slot.language === 'he');
    const entry = { slot: slot.slot, ...call };
    if (key === 'support') {
      await sleep(600);
      entry.readback = await readBackChatLog(slot.prompt, call.startedAtUtc);
    }
    raw.matrices[key].push(entry);
    console.log(`${key} ${slot.slot}: http=${call.http} answerSource=${call.answerSource}`);
    await sleep(250);
  }
}
raw.serverFacts = await readServerFacts();
const after = chatAiIdentity();
console.log('chat-ai AFTER:', JSON.stringify(after));
raw.functionAfter = after;
if (before.version !== after.version || before.ezbrSha256 !== after.ezbrSha256) throw new Error('chat-ai changed during the capture run - evidence is not attributable to one version');
raw.capturedAtUtc = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(raw, null, 2) + '\n');
console.log('Wrote', OUT);
