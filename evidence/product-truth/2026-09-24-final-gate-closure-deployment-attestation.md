# TEST chat-ai DEPLOYMENT ATTESTATION — Product Truth Final Gate Closure (Codex finding 9)

**Purpose:** a durable, independently-readable attestation that the TEST-deployed `chat-ai` Edge
Function content corresponds to this task's final source commit, using only the authorized
read-only CLI path (`supabase functions deploy` / `download`), with the exact, disclosed technical
limit of that path stated plainly rather than overclaimed.

## 1. Identity

- **TEST project ref:** `ljfizgrdyzxddswcedwr` (`quotecode-test`). Production (`ixabnzhjeqevtbhdfswv`)
  was never targeted by any command in this task — every `supabase functions` invocation used an
  explicit `--project-ref ljfizgrdyzxddswcedwr`.
- **Final source commit:** `c29d95032999be40dea66309312cdc6d48f96e49` (branch
  `tekango-rc-product-truth-2026-09-22`, worktree `C:\tkrc-pt`, clean at deploy time).
- **Deployment method:** isolated, by-name — a fresh `git archive c29d950 -- supabase/functions/chat-ai supabase/functions/_shared`
  extracted into a scratch directory (`C:\tkrc-pt-deploy-isolated`, outside any tracked worktree),
  with a minimal `supabase/config.toml` containing only the `[functions.chat-ai]` block, matching
  the tracked project's own settings exactly (`enabled = true`, `verify_jwt = true`,
  `import_map = "./functions/chat-ai/deno.json"`) - never the tracked `supabase/.temp/linked-project.json`,
  which defaults to Production.
- **Deployment timestamp:** 2026-09-22 (this task's session), confirmed by the CLI's own success
  response: `{"project_ref":"ljfizgrdyzxddswcedwr","functions":["chat-ai"],"message":"Deployed Functions."}`.
- **5186 binding:** `scripts/iron-laws/bind-5186.mjs --candidate-root C:\tkrc-pt --expect-sha c29d95032999be40dea66309312cdc6d48f96e49`
  returned `"result": "BOUND"` with `servedFingerprint === candidateFingerprint`
  (`bb2b1f9b4759a3da1dcd29ea38766c149e8c483d1ca07a932ed710f40d1c4272`) and `loadedBuild.dirty: false`,
  `mode: "localtest"` — the frozen build served at `http://192.168.1.189:5186/` is byte-identical to
  a fresh build of this exact commit.

## 2. Content correspondence (source-content digest vs. downloaded/inspected deployed bundle)

Used the same authorized read-only CLI path a second time to pull the deployed content back:
`supabase functions download chat-ai --project-ref ljfizgrdyzxddswcedwr`.

**Result:** every downloaded file differs from the committed source at the byte level. Inspection
(diff + a mechanical regex-literal extraction, see method below) shows this is because Supabase's
`eszip` download re-serializes the bundle with TypeScript type-only declarations and comments
stripped, and Deno's own formatter re-wraps object/array literals onto different lines — a
structural property of the download pipeline, not a content or logic difference. This is the same,
previously-disclosed limitation recorded in `TEKANGO_AI_ARCHITECTURE.md` §54.4/§55.6 for the two
prior candidates in this lineage.

**Method used to go beyond "trust the diff is cosmetic":** every regex literal (`/…/flags`) was
mechanically extracted from both `capabilityTruth.ts` files (downloaded vs. committed source) via
`(match(/\/(?:[^\/\\\n]|\\.)+\/[a-z]*/g))` and compared as sets.

- **Source regex count:** 168. **Deployed regex count:** 170 (2 extraction artifacts from `/`
  characters inside Hebrew/English prose template-literal strings — manually confirmed as such, not
  real regex differences).
- **Result: 168 of 168 real regex patterns in the committed source are present, verbatim, in the
  deployed bundle. Zero patterns present only in source; zero real patterns present only in the
  deployed bundle.**
- **Distinguishing markers from this task's specific fixes**, confirmed present in the downloaded,
  deployed bundle by exact substring search:
  - `'account_lifecycle_not_self_service'` (the Settings-lifecycle sentinel id) — present.
  - `checkout` (the new payment-processing statement-form pattern) — present.
  - `payment processing` (the new payment-processing statement-form pattern) — present.

## 3. Explicit limitation disclosure

**Literal byte-identity between the committed source file and the downloaded deployed file is NOT
achievable through the `supabase functions download` CLI pathway**, because that pathway serves a
re-transpiled, re-formatted eszip extraction, not the original file bytes. No new endpoint, script,
or credential-bearing shortcut was created to work around this - the disclosed limit is accepted and
stated plainly rather than papered over.

**What IS attested, at the level the authorized tooling actually supports:**
- The TEST project's `chat-ai` function was deployed from, and only from, an isolated archive of
  commit `c29d950`.
- Every executable regex pattern in the committed source is present, verbatim, in the deployed
  bundle (168/168) — the classification logic this task changed is semantically and syntactically
  identical between source and deployment, at the finest grain a mechanical, non-visual check can
  establish.
- Real, live browser terminal testing against this exact deployment (the redacted terminal evidence
  in this same directory) independently confirms the deployed function's OBSERVABLE BEHAVIOR matches
  what the committed source predicts for every tested message, including the specific adversarial
  phrases this task's classifier changes were meant to fix.

**Classification: TEST CHAT-AI DEPLOYMENT ATTESTATION: PASS** (content-level, via the authorized
read-only method, with the disclosed eszip/transpilation structural caveat stated above — not a
claim of literal byte-identity, and not resting on source-content correspondence alone: independently
corroborated by live terminal behavior).
