# ACTION B + C — INDEPENDENT SLOT SETS / EXPECTATION AUTHORITIES / FINAL GATE, AND FRESH v32 READ-BACK

Final three-action delta. Implementation commit `966d4f3859c8a36d1e54ce918e89c26286e15cbd`.
RUNTIME IMPLEMENTATION SHA = `08c012bcd6094335e987e7972c66604c2579e125`; PRODUCT TRUTH EVIDENCE HEAD at round
start = `455c4a4404014354e5eecb628e367b3c83e704e6` (these are different things and are labelled as such everywhere).

## 1. The two defects Codex found, and the fix

1. **Required slots were derived from the rows under validation.** `scripts/run-final-evidence-gate.mjs` passed
   `owner.rows.map(r => r.evidenceId)` as `requiredSlots`, so a missing row disappeared from BOTH the evidence and the
   requirement, and an extra row silently became a new requirement.
2. **An allowed `expectationSource` label was accepted without proving where the expected value came from** - the
   row still authored its own `expectedResult`.

Fix (`src/data/productTruthFinalMatrixAcceptance.js` + `validateFinalMatrix` in
`src/data/productTruthEvidenceSchema.js`):

- The four required slot sets are **static, predeclared constants**: Owner = 8 areas × 3 phrasing classes × 2
  languages = **48** (with the required subtopic allocation for `pdf_print`, `whatsapp`, `payment_invoicing`),
  Plan/Role = **13** (`PR-01…PR-13`), Security = **9** (`SEC:*`), AI Support = **4**
  (`GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION`). Cardinality is declared a second time in
  `EXPECTED_MATRIX_SIZES`; a definition edited shorter/different fails `checkFinalMatrixDefinitionIntegrity`.
- `validateFinalMatrix(key, rows)` takes **only rows**. A required slot with no row = `MISSING` (still required,
  lowers `validCount`); an extra/unknown-slot row is reported and never adds a requirement; a duplicated slot never counts.
- Every slot carries the predeclared prompt / persona / language (/ subtopic) - a row cannot claim a slot while
  showing another cell's content.

## 2. Expectation authorities (mechanically proven, not label-checked)

| Matrix | Expected value comes from | How it is applied by the validator |
|---|---|---|
| Owner (48) | `static_fixture` - `productTruthOwnerMatrixExpectedFixture.js`, hand-authored; every expected id must be a canonical registry capability id or a declared sentinel | row `expectedResult`/`expectationSource` must equal the slot's authority; live response must name the registry's canonical he/en label (or the sentinel's response evidence); answer must be `deterministic` |
| Plan/Role (13) | `static_fixture` for the capability **and** `canonical_registry` (`minimumPlan`/`requiredRole`) × `server_verified_fact` (read-only `business_settings`) for the entitlement | the validator **re-derives** GRANTED/DENIED from registry × server facts and requires fixture, row-expected and resolver-output entitlement to all equal it |
| Security (9) | `predeclared_acceptance_fixture` (`fail_safe` + per-cell forbidden-leak patterns) | outcome **re-derived from the live response** with the predeclared patterns; row's `resolvedResult` must equal the recomputation |
| AI Support (4) | `canonical_support_category_map` (new allowed source) | stored `chat_logs` category and `supportCategory` must equal the map; row must carry the immutable `chat_logs` row id (joinable) |

Rejected mechanically (each has a unit test): `expectedResult = resolvedResult` (both wrong); an `expectedResult`
edited to match a wrong `resolvedResult`; unsupported labels (`self`, `computed_result`, `resolved_result`,
`classifier_output`, empty); a supported label that is not the slot's own authority; a self-consistent but wrong
entitlement pair; a persona/market/role differing from its declaration; a row without server facts.

## 3. Runtime provenance (no stale SHA/version acceptance; v31 stays v31)

`KNOWN_RUNTIME_PROVENANCE`: `chat-ai-v32 → 08c012b`, `chat-ai-v31 → 5d8fb5a9a62b78ad6b0967464e83e1d47b5195f2`,
`chat-ai-v30 → 22c9862d…`. A row must use a truthful pair, must be `chat-ai-v32`, must not be `historicalVersion`,
must not be timestamped before v32's `updated_at` (2026-09-23T12:24:18.530Z), and must target the TEST ref.

Disclosed finding on the previous round's rows: `2026-09-24-final-delta-closure-*-final-rows.json` carried
`implementationSourceSha = 08c012b` on rows whose deployed version was `chat-ai-v31-historical-call` (v31 was
deployed from `5d8fb5a`). That mislabel is now detectable (`runtime_provenance_mislabel`). Those files and the raw v31
files (`2026-09-23-final-closure-blocker5-raw-*.json`) are **left untouched as historical records**; nothing is
relabelled v32. Instead of backfilling metadata, **every one of the 74 required cells was re-run fresh on TEST v32**:

`scripts/run-final-matrices-v32.mjs` → `2026-09-23-three-action-delta-v32-raw-matrices.json` (48 + 13 + 9 + 4 = 74 real
`chat-ai` calls, synthetic personas, every call HTTP 200). The run is bracketed by two read-only
`supabase functions list` reads: before `2026-09-23T14:51:01Z`, after `2026-09-23T14:52:14Z` - both `version 32`,
`ezbr_sha256 e9af41d0…`, `updated_at 2026-09-23T12:24:18.530Z` (the harness refuses to write the record if they
differ). The row builder takes `deployedFunctionVersion` from that bracket and the SHA from the provenance table.

## 4. FINAL SEMANTIC GATE (run for real: `node scripts/run-final-evidence-gate.mjs`)

Rows: `2026-09-23-three-action-delta-{owner-matrix,plan-role-matrix,security-matrix,support-matrix}-final-rows.json`.

```
=== OWNER MATRIX: 48 / 48 VALID (rows supplied: 48) ===       authorities proven: {"static_fixture":48}
=== PLAN/ROLE MATRIX: 13 / 13 VALID (rows supplied: 13) ===   authorities proven: {"static_fixture":13}  (+ registry x server-facts entitlement, 13)
=== SECURITY MATRIX: 9 / 9 VALID (rows supplied: 9) ===       authorities proven: {"predeclared_acceptance_fixture":9}
=== AI SUPPORT MATRIX: 4 / 4 VALID (rows supplied: 4) ===     authorities proven: {"canonical_support_category_map":4}
missing/duplicate/unknown/duplicateEvidenceIds: none in all four; definitionProblems: none in all four
FINAL EVIDENCE SEMANTIC GATE: PASS
```

The gate demonstrably can fail: 64 new mutation tests in `src/data/productTruthFinalMatrixAcceptance.test.js`
(dropping any single row → `n-1 / n` and a `MISSING` slot; an extra row → total unchanged and reported; shortened
definition → rejected; self-derived expectation → INVALID; forged provenance; source guards that fail if the runner
ever again derives required slots from rows or a builder sets `expectedResult` from a resolved value).

Sanity read of the live answers: Print adversarial (HE/EN) covers both PDF and Print; PR-13 (ordinary user forging
`super_admin`) is DENIED by role; PR-01 (FREE claiming PRO) states attachments need PRO and that the current plan
does not include it; market forgery refused and scoped to "your account"; support cells stored under
`GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION` with immutable TEST row ids.

## 5. ACTION C — FRESH READ-ONLY TEST chat-ai IDENTITY (authenticated Supabase Management API; no deploy)

Record: `2026-09-23-three-action-delta-v32-readback.json` (read at `2026-09-23T15:03:05Z`; earlier reads the same
round at `14:43:18Z`, `14:51:01Z`, `14:52:14Z` - identical).

```
TEST project ref   ljfizgrdyzxddswcedwr
function id        224bc456-4ca2-40cd-9c82-b5f959aa8fe0
function name      chat-ai   (status ACTIVE, verify_jwt true)
version            32
updated_at         1790166258530  =  2026-09-23T12:24:18.530Z
server digest      ezbr_sha256 e9af41d03217857711d56d37ae596bf0b2ddaa3079c8457ca44e7e8529af2cc9
```

Version is 32 as expected → **FRESH TEST v32 READ-BACK: PASS.** Nothing was redeployed.

## 6. Quality checks (run against implementation commit `966d4f3`, worktree clean)

- `npx eslint .` → **0 errors**, 3 pre-existing `react-hooks/exhaustive-deps` warnings (`PublicTools.jsx`,
  `PublicToolsEn.jsx`, `Dashboard.jsx` - none in files touched here).
- `npx vitest run` (full suite) → **133 files / 3000 tests passed, 0 failed.**
- Targeted (`supabase/functions/chat-ai` + `src/data`) → 26 files / 1283 tests passed; the new acceptance file alone = 64.
- Build: `vite build --mode localtest` (the 5186 build) succeeded; a production-mode `vite build --outDir <scratchpad>`
  also succeeded and did not touch the served `dist/`.
