# FINDING 3 — PRODUCT / LOCATION SCOPE IN CAPABILITY POLARITY (narrow remediation)

Codex "PRODUCT TRUTH FOUR-FINDING RE-REVIEW: FAIL" (Finding 3 only). Validator/test/evidence change only: **no chat-ai runtime file changed**
(`git diff 08c012b HEAD -- supabase/` = one test-only line); TEST chat-ai read back read-only at **version 32** (`updated_at` 2026-09-23T12:24:18.530Z,
digest `e9af41d0…`, read 2026-09-23T16:30:58Z) - no redeploy. Findings 1, 2 and 4 were not modified.

| Label | Value |
|---|---|
| RUNTIME IMPLEMENTATION SHA | `08c012bcd6094335e987e7972c66604c2579e125` |
| PRIOR PRODUCT TRUTH EVIDENCE BASELINE | `455c4a4404014354e5eecb628e367b3c83e704e6` |
| Product Truth HEAD at the start of this task (reviewed by Codex) | `b06587c254216d2eaab939586c974b3942d83bef` |
| Finding 3 scope implementation commit (also what 5186 was rebuilt from) | `e45844ac5dd2dd3aa7b7f3c337427d40b20663ae` |
| CURRENT PRODUCT TRUTH EVIDENCE HEAD | tip of `tekango-rc-product-truth-2026-09-22` in `C:\tkrc-pt` = the commit that adds this file |

## Root cause (precise)

`analyzeCapabilityProse` decided existence per SENTENCE from unscoped tokens: any affirm token (`available`, `זמין`, `exists`…) made the sentence "affirmed" unless a
denial pattern also matched, and a denial was accepted only when it used a specific existence-negation form. So "available **elsewhere**, but TEKANGO lacks it" was
"affirmed" (the positive token was about *elsewhere*, and "TEKANGO lacks it" matched no denial form), "available **only outside TEKANGO**" was "affirmed", and the HE
"זמין במוצרים אחרים, אבל **לא ב-TEKANGO**" was "affirmed" (the elided-verb TEKANGO negation matched nothing). Baseline run at the start of this task
(pre-fix module) against the requested cases: 10 of 17 mismatched - the three scoped contradictions and "available elsewhere" alone PASSED, and two valid scoped
positives ("unavailable elsewhere, but available in TEKANGO", HE "לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO") were wrongly REJECTED.

## Fix - how scope is now modelled (`src/data/productTruthCapabilityPolarity.js`)

A capability truth is availability **in TEKANGO**. Instead of phrase exceptions, every availability cue (affirm or deny) is attributed a **scope** by `cueScope()`:
- clauses are cut at commas / semicolons / contrast words (`but / though / although / whereas / while / yet`; HE `אבל / אך / אולם / אף ש / למרות ש / בעוד ש / ואילו`);
- scope phrases: **OTHER** (`elsewhere`, `outside TEKANGO`, `other than / except / apart from TEKANGO`, `other products/tools/apps/systems/platforms…`, competitors; HE `מוצרים אחרים`, `כלים אחרים`, `מחוץ ל-TEKANGO`, `מקום אחר`, `אצל מתחרים`, `חוץ/מלבד מ-TEKANGO`) and **TEKANGO**
  (the word TEKANGO not inside an "outside TEKANGO"-style phrase); the scope phrase AFTER the cue in its clause wins, else BEFORE it ("TEKANGO lacks it");
- result `tekango` / `both` / `implicit` counts for TEKANGO; a cue scoped only to `other` is **dropped** from TEKANGO's truth (so a positive token about elsewhere can never override a
  TEKANGO-specific denial, and a denial about elsewhere - "not available elsewhere" - is not a TEKANGO denial);
- **exclusivity** ("available only outside TEKANGO", "everywhere except TEKANGO", HE `רק/אך ורק מחוץ ל-TEKANGO`, `בכל מקום חוץ מ-TEKANGO`) is a TEKANGO denial (unless itself negated);
- new TEKANGO-scoped denial cues: `not/no in TEKANGO`, `TEKANGO lacks / has no / is missing`, `missing from`, HE `לא/אין ב-TEKANGO`, `חסר`; new positive cues for elided-copula / pronoun clauses
  ("but available in TEKANGO", "TEKANGO has it", "it is in TEKANGO", HE `כוללת אותו`, `יש`);
- "**Available elsewhere**" alone therefore yields **no claim about TEKANGO** and is rejected by the gate as *insufficient* (`available_expected_but_response_does_not_affirm_existence`, fail-closed);
  for a NOT_AVAILABLE truth it is likewise insufficient (no in-TEKANGO denial). The same scope filter also guards the payment/invoicing claim check.

## Tests (`src/data/productTruthCapabilityScope.test.js`, 38 tests) - grouped, not one string per example

EN groups (AVAILABLE truth, PRO account): *elsewhere + TEKANGO lacks it*; *only outside TEKANGO / everywhere except TEKANGO*; *other products + but not in TEKANGO*; *order reversal*; *elsewhere alone*; *valid scoped positives*; *plain in-TEKANGO*.
HE groups: *במוצרים אחרים + אבל לא ב-TEKANGO / חסר*; *רק/אך ורק מחוץ ל-TEKANGO / בכל מקום חוץ מ-TEKANGO*; *order reversal*; *valid scoped positives with masculine/feminine forms (קיים/קיימת, זמין/זמינה, נתמך/נתמכת)*; *plain + runtime forms*.

Requested EN cases - expected → actual: (1) "…available elsewhere, but TEKANGO lacks it." FAIL → FAIL; (2) "…available only outside TEKANGO." FAIL → FAIL; (3) "…exists in other products, but not in TEKANGO." FAIL → FAIL;
(4) "…unavailable elsewhere, but available in TEKANGO." PASS → PASS (was wrongly rejected); (5) "…available in other products and in TEKANGO." PASS → PASS; (6) "…not available outside TEKANGO, but TEKANGO supports it." PASS → PASS (was wrongly rejected);
(7) "…available elsewhere." alone: must not prove TEKANGO availability → FAIL (insufficient), documented above; (8) "In-editor calculator does not exist in TEKANGO" FAIL → FAIL; (9) natural positive paraphrases PASS → PASS.
Requested HE cases: (1) "מחשבון מובנה בעורך זמין במוצרים אחרים, אבל לא ב-TEKANGO." FAIL → FAIL; (2) "…זמין רק מחוץ ל-TEKANGO." FAIL → FAIL; (3) "…קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO." FAIL → FAIL;
(4) "…לא זמין במוצרים אחרים, אבל זמין ב-TEKANGO." PASS → PASS (was wrongly rejected); (5) "…זמין גם במוצרים אחרים וגם ב-TEKANGO." PASS → PASS; (6) masculine/feminine/common forms PASS → PASS; (7) natural positives PASS → PASS.
Also covered: the same model under NOT_AVAILABLE (AI mutation: "available elsewhere, but TEKANGO lacks it" is a CORRECT denial), PLAN_LOCKED, PAYMENT_NOT_LIVE truths; `cueScope` unit tests. A wider ad-hoc probe of 35 realistic phrasings (semicolons, "unlike other tools", "everywhere except TEKANGO", HE "אצל מתחרים", …) ended with 0 mismatches.
**Non-vacuity:** run against the pre-fix module (`git show HEAD:…` swapped in temporarily), **26 of the 38 tests fail**; with the fix, 38/38 pass.
Unchanged guarantees: all **486** real runtime-formatter answers (every capability × plan × role × language) still pass under their own truth (0 false rejections); the **564**-pair cross-truth sweep still has 0 leaks.

## Full-gate proof (`…-attack-proof.json`, `…-final-gate-output.txt`)

Control - the real committed rows + raw capture: **Owner 48/48, Plan/Role 13/13, Security 9/9, AI Support 4/4 VALID; FINAL EVIDENCE SEMANTIC GATE: PASS** (with the read-only live TEST `chat_logs` re-read of the 4 Support ids).
Each scoped contradiction injected into the Owner calculator cell (forged consistently in the row AND the raw capture, so only polarity can reject it) drops the matrix to **47 / 48**:
A5 "In-editor calculator does not exist in TEKANGO"; A6 "…available elsewhere, but TEKANGO lacks it."; A7 "…available only outside TEKANGO."; A8 "…exists in other products, but not in TEKANGO."; A9 "TEKANGO lacks it, though the in-editor calculator exists elsewhere.";
A10 "…available elsewhere."; A11 HE "…זמין במוצרים אחרים, אבל לא ב-TEKANGO."; A12 HE "…זמין רק מחוץ ל-TEKANGO."; A13 HE "…קיים במוצרים אחרים, אבל לא קיים ב-TEKANGO." (A13 was already rejected before this fix). All REJECTED; the prior Findings 1/2 attacks (A1-A4, A3b) remain rejected.
Valid scoped positives (EN ×3, HE ×2) injected the same way keep the Owner matrix at **48 / 48** (accepted).

## Regression / quality (fresh, this task)

ESLint **0 errors**, 3 pre-existing unrelated warnings; full suite **135 files / 3098 tests passing** (was 134 / 3060; +1 file, +38 tests); Findings 1 (required-set immutability), 2 (Support UUID/raw binding) test suites, Print delta, market-forgery delta, AI Help V4 and support-category semantics all inside that passing run.

## 5186

The polarity module is a build-input file, so canonical `http://192.168.1.189:5186/` was rebuilt (`vite build --mode localtest`) and rebound (PID 29380) at the clean `e45844a`: `mode localtest`, `dirty:false`, TEST ref `ljfizgrdyzxddswcedwr`, buildSha == HEAD at build time, digest `f2e0a358…` == worktree digest, 34 served assets re-hashed equal, only the TEST Supabase URL in the bundle.
Fresh HE (`LOCAL_PRO`) + EN (`INTL_PRO`) authenticated smoke PASS (`…-5186-he-en-smoke.json`). **Disclosed:** the first smoke run reported one HE FAIL - the captured "answer" was the widget's typing indicator ("מקליד תשובה...") because a slow model reply looked stable to my harness; a harness timing flake, not a product defect. The harness now ignores the indicator and the whole smoke was repeated from scratch (this record).

## Honest limits

The response envelope carries no structured answer state (`factPayload: null`), so scope is resolved from prose with a clause/scope model; it is a heuristic. It is validated against real runtime output, a cross-truth sweep and grouped EN/HE constructions, but a phrasing far outside those forms
(e.g. scope stated in a separate sentence: "It is available in other tools. TEKANGO lacks it." is handled because the TEKANGO denial is its own sentence, whereas scope carried only by a pronoun across sentences is not tracked) could be misjudged. The bare positive cue `available/supported/built-in` is broader than before; it is bounded by negation, scope, and the sweeps above.
