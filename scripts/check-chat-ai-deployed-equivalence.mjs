// Blocker 6 (Product Truth final closure, 2026-09-23) — reproducible per-module deployed-
// equivalence check. Compares every RUNTIME-REACHABLE chat-ai module's committed source against a
// freshly-downloaded deployed bundle, after a real, documented normalization: strip TypeScript
// types (@babel/preset-typescript - the same class of transform Deno's own deploy pipeline applies
// conceptually), strip comments, collapse whitespace. This proves genuine per-module content
// equivalence - not a marker-count heuristic, and not a false claim of byte identity (type-erasure/
// comment-stripping/reformatting make literal byte equality unachievable through the Supabase CLI's
// download path, which is a disclosed, understood platform limitation, not a gap in this check).
//
// Usage: after `supabase functions download chat-ai --project-ref <ref>` into some directory,
// run: node scripts/check-chat-ai-deployed-equivalence.mjs <path-to-downloaded-bundle-root>
import { readFileSync, existsSync } from 'node:fs';
import { transformSync } from '@babel/core';

const COMMITTED_ROOT = process.cwd();
const DOWNLOADED_ROOT = process.argv[2];
if (!DOWNLOADED_ROOT) {
  console.error('Usage: node scripts/check-chat-ai-deployed-equivalence.mjs <downloaded-bundle-root>');
  process.exit(2);
}

// Exactly the runtime-reachable module graph, traced by hand from real import statements in
// index.ts and its transitive dependents, and independently confirmed against the downloaded
// bundle's own file list (the tree-shaking bundler agrees on the same set - test files and
// claimCodes.ts, which is only imported by its own test, are correctly absent from both).
const MODULES = [
  'supabase/functions/chat-ai/index.ts',
  'supabase/functions/chat-ai/validation.ts',
  'supabase/functions/chat-ai/accountContext.ts',
  'supabase/functions/chat-ai/quoteContext.ts',
  'supabase/functions/chat-ai/navigation.ts',
  'supabase/functions/chat-ai/directFacts.ts',
  'supabase/functions/chat-ai/paymentTruth.ts',
  'supabase/functions/chat-ai/aiFacts.generated.ts',
  'supabase/functions/chat-ai/invoicingTruth.ts',
  'supabase/functions/chat-ai/capabilityTruth.ts',
  'supabase/functions/chat-ai/capabilityAnswerState.ts',
  'supabase/functions/chat-ai/helpContext.ts',
  // structured-truth closure (chat-ai v33 -> v34): the payload builders, the account-market route and the shared contract
  'supabase/functions/chat-ai/productTruthPayload.ts',
  'supabase/functions/chat-ai/marketTruth.ts',
  // intent grammar normalization closure (chat-ai v36 -> v37): the deterministic account market / currency intent grammar behind marketTruth.ts
  'supabase/functions/chat-ai/marketIntentGrammar.ts',
  'supabase/functions/_shared/productTruthContract.ts',
  'supabase/functions/_shared/aiChatContract.ts',
  'supabase/functions/_shared/aiHelpContract.js',
  'supabase/functions/_shared/shortDate.js',
];

function normalize(source, isTypeScript) {
  const { code } = transformSync(source, {
    presets: isTypeScript ? [['@babel/preset-typescript', { onlyRemoveTypeImports: false }]] : [],
    filename: isTypeScript ? 'file.ts' : 'file.js',
    comments: false,
    compact: false,
    babelrc: false,
    configFile: false,
  });
  return code.replace(/\s+/g, ' ').trim();
}

let allMatch = true;
const rows = [];
for (const relPath of MODULES) {
  const committedPath = `${COMMITTED_ROOT}/${relPath}`;
  const downloadedPath = `${DOWNLOADED_ROOT}/${relPath}`;
  const isTs = relPath.endsWith('.ts');
  if (!existsSync(committedPath) || !existsSync(downloadedPath)) {
    rows.push({ module: relPath, match: false, reason: 'MISSING_FILE' });
    allMatch = false;
    continue;
  }
  const committedSrc = readFileSync(committedPath, 'utf-8');
  const downloadedSrc = readFileSync(downloadedPath, 'utf-8');
  let committedNorm, downloadedNorm;
  try {
    committedNorm = normalize(committedSrc, isTs);
    downloadedNorm = normalize(downloadedSrc, isTs);
  } catch (e) {
    rows.push({ module: relPath, match: false, reason: `TRANSFORM_ERROR: ${e.message}` });
    allMatch = false;
    continue;
  }
  const match = committedNorm === downloadedNorm;
  if (!match) allMatch = false;
  rows.push({ module: relPath, match, committedNormLen: committedNorm.length, downloadedNormLen: downloadedNorm.length });
}

console.log(JSON.stringify({ allMatch, rows }, null, 2));
process.exit(allMatch ? 0 : 1);
