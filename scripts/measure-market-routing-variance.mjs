// MARKET / CURRENCY ROUTING VARIANCE (routing micro-closure): N IDENTICAL calls of ONE prompt by ONE synthetic persona (LOCAL_PRO - Local / ILS / HE, or
// INTL_PRO - International / EN) against the currently deployed TEST chat-ai. Records, SEPARATELY:
//   - STRUCTURED TRUTH: every call must be deterministic and return a valid ACCOUNT_MARKET payload equal to the canonical authority's derivation for the
//     persona's SERVER-verified market, account-scoped, with the market's own currency scope, never a product-wide claim;
//   - PROSE: the distinct answer texts (a deterministic route returns exactly one), their consistency with the payload, and any product-wide / cross-market claim.
// Credentials come only from the Owner-authorized, gitignored C:/tkrc-pt/.env.localtest.local and are never printed.
//   usage: node scripts/measure-market-routing-variance.mjs <LOCAL|INTL> <n> <outJson> "<prompt>"
import { readFileSync, writeFileSync } from 'node:fs';
import { checkFactPayloadAgainstCanonical, checkProseAgainstPayload, findProductWideCurrencyClaims } from '../src/data/productTruthFactPayload.js';

const [WHO, NRAW, OUT, PROMPT] = [process.argv[2], process.argv[3], process.argv[4], process.argv[5]];
if (!['LOCAL', 'INTL'].includes(WHO) || !OUT || !PROMPT) throw new Error('usage: <LOCAL|INTL> <n> <outJson> "<prompt>"');
const N = Number(NRAW || 20);
const envText = readFileSync('C:/tkrc-pt/.env.localtest.local', 'utf-8');
const envVar = (n) => { const m = envText.match(new RegExp(`^${n}=(.*)$`, 'm')); if (!m) throw new Error(`missing env var ${n}`); return m[1].trim(); };
const URL_ = envVar('VITE_SUPABASE_URL');
if (!URL_.includes('ljfizgrdyzxddswcedwr')) throw new Error('REFUSING: not the TEST project');
const ANON = envVar('VITE_SUPABASE_ANON_KEY');
const PASS = envVar('PROFLOW_TEST_PLAN_PERSONAS_PASSWORD');
const P = WHO === 'LOCAL'
  ? { alias: 'LOCAL_PRO', emailVar: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', lang: 'he', market: 'LOCAL', currency: 'ILS', serverMarket: 'Local' }
  : { alias: 'INTL_PRO', emailVar: 'PROFLOW_TEST_INTL_PRO_EMAIL', lang: 'en', market: 'INTERNATIONAL', currency: 'MULTI', serverMarket: 'International' };

const token = (await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON }, body: JSON.stringify({ email: envVar(P.emailVar), password: PASS }) })).json()).access_token;
const uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
const r0 = await (await fetch(`${URL_}/rest/v1/business_settings?select=plan,role,country&user_id=eq.${uid}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })).json();
const facts = { serverPlan: r0[0]?.plan ?? null, serverRole: r0[0]?.role ?? null, serverMarket: r0[0]?.country ?? null };
if (facts.serverMarket !== P.serverMarket) throw new Error(`persona ${P.alias} server market is ${facts.serverMarket}, expected ${P.serverMarket}`);
const ask = async () => {
  const res = await fetch(`${URL_}/functions/v1/chat-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: PROMPT }], isHebrew: P.lang === 'he', isDashboard: true }) });
  const j = await res.json().catch(() => ({}));
  return { http: res.status, answerSource: j.answerSource ?? null, answer: String(j.answer ?? ''), factPayload: j.factPayload ?? null };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
for (let i = 0; i < N; i += 1) {
  const c = await ask();
  const structured = c.factPayload ? checkFactPayloadAgainstCanonical(c.factPayload, 'account_market_sentinel', facts) : ['route:no_structured_payload_(free_form)'];
  const prose = c.factPayload ? checkProseAgainstPayload(c.factPayload, c.answer, P.lang) : ['prose:no_payload_to_check_against'];
  rows.push({ i: i + 1, ...c, structuredViolations: structured, proseViolations: prose, productWideCurrencyClaims: findProductWideCurrencyClaims(c.answer) });
  await sleep(300);
}
const distinctAnswers = [...new Set(rows.map((r) => r.answer))];
const distinctPayloads = [...new Set(rows.map((r) => JSON.stringify(r.factPayload)))];
const summary = {
  capturedAtUtc: new Date().toISOString(), persona: `${P.alias} (synthetic)`, serverFacts: facts, prompt: PROMPT, calls: N,
  structuredTruth: {
    allDeterministic: rows.every((r) => r.answerSource === 'deterministic'),
    allPayloadsPresent: rows.every((r) => r.factPayload !== null),
    allEqualToCanonicalAccountMarketPayload: rows.every((r) => r.structuredViolations.length === 0),
    allAccountScoped: rows.every((r) => r.factPayload?.claimScope === 'ACCOUNT' && r.factPayload?.marketScope === 'ACCOUNT'),
    allVerifiedMarketAndCurrency: rows.every((r) => r.factPayload?.accountMarket === P.market && r.factPayload?.currencyScope === P.currency),
    anyProductWidePayload: rows.some((r) => r.factPayload?.claimScope === 'PRODUCT'),
    distinctPayloads: distinctPayloads.length,
  },
  proseVariance: {
    distinctAnswerTexts: distinctAnswers.length,
    consistentWithPayload: rows.filter((r) => r.proseViolations.length === 0).length,
    contradictingThePayload: rows.filter((r) => r.proseViolations.length > 0).length,
    productWideCurrencyClaimsInProse: rows.filter((r) => r.productWideCurrencyClaims.length > 0).length,
    crossMarketCurrencyInProse: rows.filter((r) => (P.market === 'LOCAL' ? /USD|EUR|GBP|\$|€|£|דולר|יורו/.test(r.answer) : /₪|ILS|shekel|NIS|שקל/i.test(r.answer))).length,
  },
};
const s = summary;
s.gate = s.structuredTruth.allDeterministic && s.structuredTruth.allPayloadsPresent && s.structuredTruth.allEqualToCanonicalAccountMarketPayload && s.structuredTruth.allAccountScoped
  && s.structuredTruth.allVerifiedMarketAndCurrency && !s.structuredTruth.anyProductWidePayload && s.structuredTruth.distinctPayloads === 1
  && s.proseVariance.contradictingThePayload === 0 && s.proseVariance.productWideCurrencyClaimsInProse === 0 && s.proseVariance.crossMarketCurrencyInProse === 0 ? 'PASS' : 'FAIL';
writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
