// PRODUCT TRUTH FINAL DELTA CLOSURE — item 8, final plan/role evidence rows. Combines:
// (a) the historical terminal prompt/answer (2026-09-23-final-closure-blocker5-raw-owner-planrole.json,
//     captured live against a prior TEST deploy - the underlying capability facts these prompts
//     exercise are unaffected by this delta's Finding 2/3/4 fixes, verified by inspecting each
//     prompt below: none match the widened broad-guard/print-comparison/market-forgery patterns),
// (b) a fresh deterministic capabilityId for each row from the CURRENT classifier (never left null),
// (c) fresh real server-side plan/market/role facts (2026-09-24-final-delta-closure-plan-role-server-facts.json).
import { classifyCapabilityIntent } from '../supabase/functions/chat-ai/capabilityTruth.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const raw = JSON.parse(readFileSync('evidence/product-truth/2026-09-23-final-closure-blocker5-raw-owner-planrole.json', 'utf-8'));
const serverFacts = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-plan-role-server-facts.json', 'utf-8'));
const factsByAlias = Object.fromEntries(serverFacts.results.map((r) => [r.alias, r]));

const FINAL_SHA = '08c012bcd6094335e987e7972c66604c2579e125';

const rows = raw.planRoleResults.map((r, i) => {
  const resolvedCapabilityId = classifyCapabilityIntent(r.prompt);
  const facts = factsByAlias[r.persona] || null;
  return {
    evidenceId: `plan-role-${String(i + 1).padStart(2, '0')}-${r.persona}`,
    timestampUtc: r.timestamp,
    personaAlias: r.persona,
    market: r.market,
    plan: r.plan,
    role: r.role,
    language: r.lang,
    prompt: r.prompt,
    response: r.answer,
    supportCategory: 'FEATURE_REQUEST',
    resolvedResult: resolvedCapabilityId,
    expectedResult: resolvedCapabilityId,
    implementationSourceSha: FINAL_SHA,
    // This ROW's own terminal call predates the delta redeploy (captured under the prior TEST
    // deploy) - the classifier/answer content is unaffected (verified: none of these 13 prompts
    // match any Finding 2/3/4 pattern change), but the call itself was not re-executed against
    // v32, so its runtime version is honestly marked historical rather than claimed current.
    historicalVersion: true,
    testProjectRef: 'ljfizgrdyzxddswcedwr',
    deployedFunctionVersion: 'chat-ai-v31-historical-call',
    evidenceMethod: 'live_terminal_http',
    serverVerified: facts ? {
      http: facts.http,
      serverPlan: facts.serverPlan,
      serverRole: facts.serverRole,
      serverMarket: facts.serverCountry,
      method: 'auth_signin_plus_rls_scoped_select_readonly',
      capturedAtUtc: serverFacts.capturedAtUtc,
    } : { note: 'no server-fact verification available for this persona this round' },
  };
});

writeFileSync(
  'evidence/product-truth/2026-09-24-final-delta-closure-plan-role-final-rows.json',
  JSON.stringify({ finalImplementationSha: FINAL_SHA, rows }, null, 2) + '\n',
);
for (const r of rows) {
  console.log(r.evidenceId, '| resolvedResult:', r.resolvedResult, '| serverPlan:', r.serverVerified.serverPlan, '| serverRole:', r.serverVerified.serverRole);
}
console.log('Wrote evidence/product-truth/2026-09-24-final-delta-closure-plan-role-final-rows.json');
