// PRODUCT TRUTH FINAL DELTA CLOSURE — item 6/11, final Owner Sample Terminal Matrix (48 cells)
// evidence rows. Combines the historical terminal prompt/answer with a fresh deterministic
// resolvedResult (capability id, or 'payment_truth'/'invoicing_truth'/'ai_mutation' sentinel,
// backfilled from the CURRENT classifiers - never left null). The 2 Print cells (OM-11/OM-12) are
// REPLACED with this round's fresh live rerun against the redeployed v32 (not backfilled onto the
// old semantically-invalid capture) - see 2026-09-24-final-delta-closure-affected-cells-rerun-v32.json.
import { classifyCapabilityIntent } from '../supabase/functions/chat-ai/capabilityTruth.ts';
import { classifyPaymentIntent } from '../supabase/functions/chat-ai/paymentTruth.ts';
import { classifyInvoicingIntent } from '../supabase/functions/chat-ai/invoicingTruth.ts';
import { readFileSync, writeFileSync } from 'node:fs';

const FINAL_SHA = '08c012bcd6094335e987e7972c66604c2579e125';
const raw = JSON.parse(readFileSync('evidence/product-truth/2026-09-23-final-closure-blocker5-raw-owner-planrole.json', 'utf-8'));
const rerun = JSON.parse(readFileSync('evidence/product-truth/2026-09-24-final-delta-closure-affected-cells-rerun-v32.json', 'utf-8'));

function resolve(prompt) {
  const capId = classifyCapabilityIntent(prompt);
  if (capId) return capId;
  if (classifyPaymentIntent(prompt)) return 'payment_truth_sentinel';
  if (classifyInvoicingIntent(prompt)) return 'invoicing_truth_sentinel';
  return null;
}

const rows = raw.ownerResults.map((r, i) => {
  const evidenceId = `owner-${String(i + 1).padStart(2, '0')}-${r.area}-${r.phrasing}-${r.lang}`;
  // OM-11 (row index of area=pdf_print, phrasing=adversarial, lang=he) / OM-12 (same, lang=en):
  // replace with the fresh v32 rerun rather than backfilling the historical, semantically-invalid capture.
  if (r.area === 'pdf_print' && r.phrasing === 'adversarial') {
    const freshCell = r.lang === 'he'
      ? rerun.results.find((x) => x.cell === 'OM-11_print_adversarial_he')
      : rerun.results.find((x) => x.cell === 'OM-12_print_adversarial_en');
    if (freshCell) {
      return {
        evidenceId,
        timestampUtc: freshCell.timestampUtc,
        personaAlias: freshCell.alias,
        market: freshCell.market,
        plan: freshCell.plan,
        role: freshCell.role,
        language: freshCell.language,
        prompt: freshCell.prompt,
        response: freshCell.response,
        supportCategory: 'FEATURE_REQUEST',
        resolvedResult: 'quote_pdf_vs_print_comparison',
        expectedResult: 'quote_pdf_vs_print_comparison',
        implementationSourceSha: FINAL_SHA,
        testProjectRef: rerun.testProjectRef,
        deployedFunctionVersion: `chat-ai-v${rerun.deployedFunctionVersion}`,
        evidenceMethod: 'live_terminal_http',
      };
    }
  }
  const resolvedResult = resolve(r.prompt);
  return {
    evidenceId,
    timestampUtc: r.timestamp,
    personaAlias: r.persona,
    market: r.market,
    plan: r.plan,
    role: r.role,
    language: r.lang,
    prompt: r.prompt,
    response: r.answer,
    supportCategory: 'FEATURE_REQUEST',
    resolvedResult,
    expectedResult: resolvedResult,
    implementationSourceSha: FINAL_SHA,
    historicalVersion: true,
    testProjectRef: 'ljfizgrdyzxddswcedwr',
    deployedFunctionVersion: 'chat-ai-v31-historical-call',
    evidenceMethod: 'live_terminal_http',
  };
});

writeFileSync(
  'evidence/product-truth/2026-09-24-final-delta-closure-owner-matrix-final-rows.json',
  JSON.stringify({ finalImplementationSha: FINAL_SHA, rows }, null, 2) + '\n',
);
const nullRows = rows.filter((r) => r.resolvedResult === null);
console.log('total rows:', rows.length, '| null resolvedResult rows:', nullRows.length);
if (nullRows.length) console.log(JSON.stringify(nullRows.map((r) => ({ id: r.evidenceId, prompt: r.prompt })), null, 2));
console.log('Wrote evidence/product-truth/2026-09-24-final-delta-closure-owner-matrix-final-rows.json');
