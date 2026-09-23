# TEST chat-ai DEPLOYMENT ATTESTATION — Final Delta Closure Round, SUCCEEDED (Finding 6, v32)

**Status: PASS.** Supersedes `2026-09-24-final-delta-closure-deployment-attestation.md` (the prior
PARTIAL record of the denied attempt), which is kept for the honest history of the denial - not
deleted or silently overwritten. The Owner explicitly authorized this exact command in the
continuation task; the deploy succeeded.

## 1. Identity

- **Implementation source commit (the code this deploy ships):**
  `08c012bcd6094335e987e7972c66604c2579e125` (branch `tekango-rc-product-truth-2026-09-22`, worktree
  `C:\tkrc-pt`). The worktree's `supabase/functions/chat-ai`/`supabase/functions/_shared` trees are
  byte-identical to this commit at deploy time (`git diff --stat 08c012b HEAD -- supabase/functions/chat-ai
  supabase/functions/_shared` was empty; HEAD was `f106344`, a docs-only evidence commit that never
  touched these directories).
- **Evidence-only HEAD (this attestation's own commit, different from the implementation SHA
  above):** recorded separately once committed - see the final report's LOCAL COMMITS section.
- **TEST project ref:** `ljfizgrdyzxddswcedwr` (`quotecode-test`). Production
  (`ixabnzhjeqevtbhdfswv`) was never targeted, referenced, or touched.
- **Function name:** `chat-ai`.

## 2. Deploy-input manifest (unchanged from the prepared PARTIAL attempt, re-verified fresh)

The manifest prepared for the denied attempt (`2026-09-24-final-delta-closure-deploy-input-manifest.txt`,
36 files, SHA-256 each, full-manifest-file hash `99f0240c11369cd25bb0539c3600f2d13f31066bc6948370509cfe300171d6f3`)
was re-verified byte-identical against both the current worktree (`git diff` empty) and the
`/c/tkrc-pt-deploy-scratch` directory (every file's SHA-256 matched the manifest) immediately before
this deploy - no re-archival was needed or performed.

## 3. Exact command and completion

```
cd /c/tkrc-pt-deploy-scratch && npx --no-install supabase functions deploy chat-ai --project-ref ljfizgrdyzxddswcedwr
```

- **Supabase CLI version:** `2.117.0`.
- **Deploy start:** `2026-09-23T12:24:04Z`. **Deploy command completed:** `2026-09-23T12:24:20Z`
  (both `date -u +"%Y-%m-%dT%H:%M:%SZ"`, run immediately before/after).
- **Verbatim CLI response:** `Bundling Function: chat-ai` / `Deploying Function: chat-ai (script
  size: 186 kB)` / `{"project_ref":"ljfizgrdyzxddswcedwr","functions":["chat-ai"],"dashboard_url":
  "https://supabase.com/dashboard/project/ljfizgrdyzxddswcedwr/functions","message":"Deployed
  Functions."}`

## 4. Fresh authenticated remote read-back

A fresh `npx --no-install supabase functions list --project-ref ljfizgrdyzxddswcedwr`, run
immediately after the deploy, returned (verbatim `chat-ai` entry):

```json
{"id":"224bc456-4ca2-40cd-9c82-b5f959aa8fe0","slug":"chat-ai","name":"chat-ai","status":"ACTIVE",
 "version":32,"created_at":1788908125156,"updated_at":1790166258530,"verify_jwt":true,
 "import_map":true,
 "entrypoint_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/index.ts",
 "import_map_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/deno.json",
 "ezbr_sha256":"e9af41d03217857711d56d37ae596bf0b2ddaa3079c8457ca44e7e8529af2cc9"}
```

- **Function ID:** `224bc456-4ca2-40cd-9c82-b5f959aa8fe0` (unchanged identity across versions).
- **Version:** **32** (was 31 before this deploy - a genuinely new, incremented version).
- **UTC updated/deploy timestamp:** `2026-09-23T12:24:18.530Z` (epoch ms `1790166258530`), 2 seconds
  before the deploy command's own recorded completion timestamp (§3) - consistent with normal
  clock/latency variance between the local shell clock and the API's own timestamp, not a
  contradiction (the API timestamp is authoritative).
- **Server-side deployed-bundle digest (`ezbr_sha256`):** `e9af41d03217857711d56d37ae596bf0b2ddaa3079c8457ca44e7e8529af2cc9`
  - a fresh value, different from v31's `457445b5f6f2d5e58915e3552f4e50db9fe5b626e40100e45ef044b5d2cbad6d`.

## 5. Per-module deployed-equivalence check (real normalization, not marker-count)

**Method (reproducible, `scripts/check-chat-ai-deployed-equivalence.mjs`, unchanged from the prior
round):** `supabase functions download chat-ai --project-ref ljfizgrdyzxddswcedwr` into an isolated
scratch directory (`/c/tkrc-pt-download-scratch`), then for every one of the 15 modules actually
reachable from `index.ts`'s real import graph, strip TypeScript types
(`@babel/preset-typescript`)/comments/collapse whitespace on BOTH the committed and the downloaded
source, and compare the normalized text exactly.

**Result: 15 / 15 modules match, including both files this delta round actually changed**
(`capabilityTruth.ts`: 18138 normalized chars, match; `validation.ts`: 24740 normalized chars,
match). Full result: `2026-09-24-final-delta-closure-module-equivalence.json` (committed).

**Explicit exclusions (unchanged from the prior round's own documented scope, still correct):** test
files (`*.test.js`, never deployed - correctly absent from the downloaded bundle), `claimCodes.ts`
(tree-shaken - only imported by its own test), `deno.json`/`.npmrc` (config, not runtime-reachable
source), `capabilityTruthGuardFinal.test.js` (this round's new test file - also never deployed,
correctly absent).

**Byte-identity is NOT claimed** - the eszip download strips TypeScript types/comments at the
platform level, a disclosed tool limitation, not left unexamined. Normalized-content equivalence
(§5 above) is the real, reproducible proof used instead.

## 6. Result

**FINAL TEST DEPLOYMENT ATTESTATION: PASS.** The deployed TEST `chat-ai` v32 genuinely runs the
final implementation SHA `08c012b`'s code, including this round's Finding 2 (capability-question
guard) and Finding 4 (market-forgery system-prompt rule) fixes, verified by real per-module content
equivalence against the actual downloaded bundle - not narrated, not assumed from a version number.
