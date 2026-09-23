# FINAL v32 DEPLOYMENT ATTESTATION — COMPLETE (Codex final independent review, item 3)

**Status: PASS.** Corrects the prior round's attestation, which Codex found omitted the effective
`supabase/config.toml` from the deploy-input manifest. This file supersedes
`2026-09-24-final-delta-closure-deployment-attestation-v32.md` for manifest completeness; that
file's deploy-command/CLI-response/remote-read-back record from the actual deploy moment remains
the historical record of the deploy event itself and is not rewritten.

## 1. Identity

- **Implementation source commit:** `08c012bcd6094335e987e7972c66604c2579e125` (unchanged - no
  application/runtime code has changed since the v32 deploy; only test/evidence/script files this
  round, none of which are part of chat-ai's own runtime-reachable module graph).
- **TEST project ref:** `ljfizgrdyzxddswcedwr`. Production never targeted.
- **Function name:** `chat-ai`.

## 2. Complete deploy-input manifest (37 entries, including `supabase/config.toml`)

Every file actually present in `/c/tkrc-pt-deploy-scratch` at deploy time - the exact directory the
`supabase functions deploy` command read from - individually SHA-256 hashed directly from THAT
location (not the tracked worktree, which uses CRLF line endings on this Windows checkout and would
produce different, non-representative hashes for the same logical content). Committed verbatim as
`evidence/product-truth/2026-09-24-final-closure-v32-deploy-input-manifest.txt`.

**Inclusion reasons:**
- `supabase/config.toml` (1 file) - the effective, isolated-scratch config actually read by the
  deploy command (`project_id`, `[functions.chat-ai]` block with `verify_jwt`/`import_map`) -
  **previously omitted from the manifest; this is the fix for Codex's finding**.
- `supabase/functions/chat-ai/*` (30 files) - chat-ai's own source, tests, `.npmrc`, `deno.json`
  (import map).
- `supabase/functions/_shared/*` (6 files) - the shared modules chat-ai's own dependents import
  (`aiChatContract.ts`, `aiHelpContract.js`, `shortDate.js`) plus `adminReauth.ts`/`.test.js` (an
  unrelated function's own module, present in `_shared` but not imported by chat-ai - confirmed by
  the import-graph trace in §3 below; included for completeness since it physically exists in the
  directory the deploy reads, not because chat-ai reaches it).

**Full-manifest-file hash (SHA-256 of the manifest file itself):**
`40f8c426a95d6f82d48be97cf1d1e04c3e6d5f644b243e85b553ee665e58f376`

**37 files, 2 directories** (was 36/2 before adding `config.toml`) - now genuinely covers every
actual deploy input, not a source-only subset.

## 3. Fresh remote v32 read-back (this round, not reused from the deploy moment)

```
2026-09-23T13:49:48Z: npx supabase functions list --project-ref ljfizgrdyzxddswcedwr
```

```json
{"id":"224bc456-4ca2-40cd-9c82-b5f959aa8fe0","slug":"chat-ai","name":"chat-ai","status":"ACTIVE",
 "version":32,"updated_at":1790166258530,
 "ezbr_sha256":"e9af41d03217857711d56d37ae596bf0b2ddaa3079c8457ca44e7e8529af2cc9"}
```

- **Function ID:** `224bc456-4ca2-40cd-9c82-b5f959aa8fe0` (unchanged).
- **Exact current version:** **32** (confirmed fresh, not cached from the deploy-moment record).
- **UTC updated/deploy timestamp:** `2026-09-23T12:24:18.530Z` (unchanged since the deploy - no
  redeploy occurred or was needed this round, confirmed unchanged rather than assumed).
- **Server-side deployed-bundle digest:** `e9af41d03217857711d56d37ae596bf0b2ddaa3079c8457ca44e7e8529af2cc9`.

## 4. v32 deployed equivalence — freshly re-downloaded and re-checked THIS round

A brand-new `supabase functions download chat-ai --project-ref ljfizgrdyzxddswcedwr` (into a fresh
scratch directory, `/c/tkrc-pt-download-scratch2`, not reusing the prior round's downloaded copy)
followed by a fresh run of `scripts/check-chat-ai-deployed-equivalence.mjs` against it:

**Result: 15 / 15 runtime-reachable modules match**, including both files this delta's Findings 2/4
changed (`capabilityTruth.ts`: 18138 normalized chars, match; `validation.ts`: 24740 normalized
chars, match). Full result committed as
`evidence/product-truth/2026-09-24-final-closure-v32-module-equivalence-fresh.json`.

This is tied to the CURRENT v32 deployment (downloaded fresh this round, immediately after the
fresh remote read-back in §3, both confirming version 32 and the same `ezbr_sha256`), not a reused
record from the original deploy moment.

**Explicit exclusions (unchanged, still correct):** test files (never deployed - confirmed absent
from the downloaded bundle), `claimCodes.ts` (tree-shaken, only imported by its own test),
`deno.json`/`.npmrc`/`config.toml` (config, not runtime-reachable module source),
`capabilityTruthGuardFinal.test.js` (this delta's own new test file - also never deployed).

**Byte-identity is NOT claimed** - the eszip download strips TypeScript types/comments at the
platform level (disclosed tool limitation). Normalized-content equivalence is the real proof used.

## Result

**FINAL v32 DEPLOYMENT ATTESTATION: PASS.** The manifest now covers every actual deploy input
(including `supabase/config.toml`), a fresh remote read-back confirms version 32 unchanged, and a
freshly re-downloaded bundle re-confirms 15/15 module equivalence tied to that exact current
deployment.
