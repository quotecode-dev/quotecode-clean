# FOUR-FINDING REMEDIATION — Codex "PRODUCT TRUTH FINAL THREE-ACTION DELTA REVIEW: FAIL"

Narrow, acceptance/validator-only remediation of exactly four Codex blockers. Worktree `C:\tkrc-pt`, branch
`tekango-rc-product-truth-2026-09-22`, TEST project `ljfizgrdyzxddswcedwr` only. **No chat-ai runtime file changed** (still
`08c012b`; TEST chat-ai read back at version 32 - see `...-v32-readback.json`, read 2026-09-23T15:51:11Z). No redeploy, no Production.

## Identity labels (never interchangeable)

| Label | Value |
|---|---|
| RUNTIME IMPLEMENTATION SHA (what TEST chat-ai v32 was deployed from) | `08c012bcd6094335e987e7972c66604c2579e125` |
| PRIOR PRODUCT TRUTH EVIDENCE BASELINE (pre-three-action-delta evidence state) | `455c4a4404014354e5eecb628e367b3c83e704e6` |
| Product Truth HEAD at the start of this remediation (the three-action delta's evidence commit) | `c38dc534522f2a5868e13330d75ba7c2c8715642` |
| Remediation implementation commit (also the commit 5186 was rebuilt from) | `a51d9149856203ab9a645c50ec60c9c78df3f158` |
| CURRENT PRODUCT TRUTH EVIDENCE HEAD | the terminal Product Truth commit of this task = the commit that adds this file (`git log -1 --format=%H -- evidence/product-truth/2026-09-23-four-finding-remediation-record.md`) |
| CONTINUITY HEAD | the commit on `main` that introduces the remediation block (`git log -1 --format=%H -- PROFLOW_CODEX_CHECKPOINT.md`) |

## Pre-fix baseline (reproduced at the start of this task, before any change)

Run against the validator at `c38dc53` with Codex's own attacks:

```
F1 planRole substitution problems: []          <- accepted
F1 security substitution problems: []          <- accepted
F1 planRole prompt substitution problems: []   <- accepted
F2 arbitrary UUID -> 4 / 4                     <- accepted
F3 contradictory prose -> 48 / 48              <- accepted
```

## Finding 1 — Plan/Role + Security required-set substitution

- **Root cause:** `checkFinalMatrixDefinitionIntegrity` compared Owner against a cross-product of constants and Support against the
  four category names, but for Plan/Role and Security it only checked *count*, *uniqueness* and per-slot field presence - so changing a
  slot id (or its prompt/persona/expectation) while keeping 13 / 9 entries returned no problem.
- **Fix / authority mechanism:** `src/data/productTruthRequiredSlotAuthority.js` - a separately committed **canonical identity table** for all
  four matrices: every required slot id -> SHA-256 of that slot's full meaning (id, persona, language, prompt, expected result,
  expectation authority + matrix-specific fields: Owner area/subtopic/phrasing, Plan/Role entitlement, Security cell + forbidden-leak
  patterns, Support category). The integrity check compares the definition it is handed with the table: missing slot, extra slot, renamed
  slot, same-cardinality substitution, or changed meaning under the same id all fail; a pure reorder is allowed. The table is generated
  once (`scripts/generate-required-slot-authority.mjs`) and committed as static text - never recomputed from the definition or evidence
  (a source-guard test enforces that). Changing the required set now needs a deliberate edit of the table *and* the definition.
- **Result:** attack A1 (Plan/Role id substituted, still 13) -> `0 / 13`, problems `required_slot_absent:PR-01`, `slot_outside_canonical_required_set:PR-99`;
  attack A2 (Security id substituted, still 9) -> `0 / 9`, problems `required_slot_absent:SEC:cross_tenant_quote`, `slot_outside_canonical_required_set:SEC:other`.
  Also tested: prompt / persona / expected / entitlement / cell / pattern change under the same id (`slot_identity_changed`), two-slot semantic swap,
  rename, missing / extra / duplicate, reorder allowed. **FINDING 1: PASS.**

## Finding 2 — Support UUID not bound to the raw read-back

- **Root cause:** `immutableTestRowId` was only checked to be a non-empty string (and `chat_logs_readback` rows to carry one).
- **Raw authority:** `2026-09-23-three-action-delta-v32-raw-matrices.json` (sha256 `4dac65c2…`) - the capture harness wrote it straight from the live
  HTTP responses and the read-only `chat_logs` read-back before any acceptance row existed; rows are only projections of it.
- **Tuple linkage** (`src/data/productTruthRawCaptureBinding.js`; raw capture **mandatory** for Support - the gate fails closed without it): row id == raw
  `readback.row.id` and is a real UUID (nil/zero UUID rejected); row category == raw read-back category == the category map; raw read-back
  question == the predeclared slot prompt; row persona / language / requestId / response / timestamp == the raw call; raw `created_at` inside the call
  window; the call inside the before/after chat-ai version bracket and the row's deployed version == the bracket's; one raw entry per slot; no id reused
  across raw entries or across Support rows. Owner / Plan-Role / Security rows are bound to the raw capture too whenever it is supplied (the runner always supplies it).
- **Live proof (read-only TEST, `--live-support-readback`):** each of the 4 ids re-read from TEST `chat_logs` by id (http 200, found, categories
  GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION) and compared for category, question, stored response and persona (SHA-256 prefix of the
  persona e-mail `c73eaf536cf3` - the e-mail itself is never recorded) - see `...-final-gate-output.txt`.
- **Mutation results:** A3 nil UUID -> `3 / 4`; A4 Cancellation<->Feature-request UUID swap -> `2 / 4`; A3b nil UUID forged consistently in BOTH row and raw -> `3 / 4`
  (`not_a_real_uuid`). Unit tests also cover arbitrary well-formed UUID, UUID from another prompt, correct UUID + wrong category / persona / request id / language / response,
  stale/unknown id, timestamp / `created_at` outside the window, reused UUID, missing raw entry, failed read-back, version change mid-run. **FINDING 2: PASS.**
- **Honest limit:** the offline validator cannot detect a coordinated forgery of *both* the raw file and the row with a well-formed UUID; that is what git
  immutability of the committed raw capture and the live read-only re-read above cover.

## Finding 3 — contradictory capability prose that contains the label

- **Root cause:** for Owner and Plan/Role capability answers the gate only checked `response.includes(<canonical label>)`.
- **Mechanism** (`src/data/productTruthCapabilityPolarity.js`): compare two structured objects. **Expected truth** is derived only from independent authorities - the
  canonical registry (state, market, `minimumPlan` / `requiredRole`), the structured `AI_FACTS.billing` / `AI_FACTS.invoicing` flags (payment / invoicing sentinels) and the
  persona's server-verified plan/role - into AVAILABLE / PLAN_LOCKED / ROLE_LOCKED / NOT_AVAILABLE / MARKET_UNAVAILABLE / PAYMENT_NOT_LIVE / INVOICING_NOT_ISSUED /
  COMPARISON_BOTH_AVAILABLE / CLARIFICATION (fails closed as UNDERIVABLE). **Claims made** are extracted per sentence (exists / does-not-exist, account lacks / has it, plan tier
  stated, role gate stated, "available to everyone", not-live, comparison distinction, clarification), with account-directed negation ("Your current plan does not include it")
  kept distinct from existence denial. The claims must be consistent with the truth kind; a wrong plan tier (e.g. PRO for a BASIC feature) fails too.
- **Why prose is still analysed:** the chat-ai envelope carries no structured answer state for capability answers (`factPayload: null`), so the deployed answer's polarity is only in its
  text. To keep that from being brittle regex-guessing the extractor is validated against the **real runtime formatter** (structured `CapabilityAnswerState` -> prose) for **every registry
  capability x plan tier x role x language = 486 answers (0 false rejections)** and a **564-pair cross-truth sweep** (a render correct for one truth must be rejected under every different
  truth: 0 leaks), plus explicit EN and HE adversarial and natural-paraphrase cases. The runtime formatter is unchanged.
- **Results:** A5 "In-editor calculator does not exist in TEKANGO" -> `47 / 48` (`polarity:available_expected_but_response_denies_existence`); A5b (same, forged consistently in row *and* raw so raw-binding
  cannot help) -> still `47 / 48` - polarity rejects on its own. Unit tests: supported + "does not exist" / "there is no" / "doesn't have" FAIL; unsupported + "is available" FAIL; plan-gated +
  "available to all users" / silent gate / "your plan includes it" FAIL; role-gated + "all users can access" FAIL; correct label inside a contradictory sentence FAIL; natural paraphrases PASS - EN and HE. **FINDING 3: PASS.**
- **Honest limit:** a prose classifier is heuristic; a phrasing far outside the tested EN/HE forms could be misjudged in either direction. Structure-first checks (truth from the registry, real-formatter sweep,
  cross-truth sweep, raw binding) bound that risk; the real 74 committed answers all pass.

## Finding 4 — Product Truth Evidence HEAD terminology

Corrected in all 8 active continuity files by the continuity commit (see the final report): `455c4a4` is the **prior evidence baseline**, `c38dc53` was the Product Truth HEAD at the start of this remediation,
and the CURRENT PRODUCT TRUTH EVIDENCE HEAD is defined *by rule* (the terminal Product Truth commit of the latest round) so it cannot go stale on the next commit.

## Final gate (real, `node scripts/run-final-evidence-gate.mjs --live-support-readback`)

`48 / 48` Owner, `13 / 13` Plan/Role, `9 / 9` Security, `4 / 4` AI Support VALID - FINAL EVIDENCE SEMANTIC GATE: PASS (rows: `2026-09-23-four-finding-remediation-*-final-rows.json`, all v32).
Attack proof (`node scripts/run-four-finding-attack-proof.mjs`): CONTROL 48/13/9/4 VALID and **all five Codex attacks (plus two coordinated-forgery variants) REJECTED** - `...-attack-proof.json`.

## 5186 rebound (build inputs changed)

The remediation added/changed non-test files under `src/` (build-input root), so the served digest of `966d4f3` no longer equalled HEAD's. Rebuilt `vite build --mode localtest` at the clean `a51d914` and
re-served on the canonical `http://192.168.1.189:5186/` (PID 1384): `mode localtest`, `dirty:false`, TEST ref `ljfizgrdyzxddswcedwr`, buildSha == HEAD == `a51d914`, buildInputDigest `02559178…` == worktree digest, all 34 served
assets re-hashed equal, only the TEST Supabase URL in the bundle. Fresh HE (`LOCAL_PRO`) + EN (`INTL_PRO`) authenticated browser smoke PASS through the real login form / AI Chat widget (`...-5186-he-en-smoke.json`).
Later commits touch only `evidence/`, `scripts/` and docs (not build inputs), so this digest stays equal to the branch tip's.

## Quality

ESLint 0 errors (3 pre-existing unrelated warnings); full suite 134 files / 3060 tests passing; `vite build --mode localtest` clean.
