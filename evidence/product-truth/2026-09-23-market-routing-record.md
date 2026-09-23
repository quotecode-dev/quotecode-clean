# Product Truth - MARKET / CURRENCY ROUTING CLOSURE (2026-09-23)

Scope: ONE narrow runtime-classifier closure. Structured Truth (contract, authority flow, payload validation) is unchanged and already passed Codex review. Answers "CODEX PRODUCT TRUTH FINAL STRUCTURED-TRUTH ACCEPTANCE: FAIL - FREE-FORM MARKET PARAPHRASE: BLOCKING ROUTING GAP".

## Start gate (fresh, before any mutation)
main HEAD `1608841129763cb67eaa7b02411709f8b101d1a6`; Product Truth worktree `C:\tkrc-pt`, branch `tekango-rc-product-truth-2026-09-22`, HEAD `cdf563bfd9db0083d1091c22af4cc2870407fef2`, clean (0 dirty); TEST chat-ai **v34** (`updated_at` 2026-09-23T19:42:10.535Z, `ezbr_sha256` `645cd56f...`); runtime implementation SHA `e674be2` (`git diff e674be2 HEAD -- supabase` empty); 5186 identity `buildSha c04f41f`, `dirty:false`, localtest, TEST ref. Everything matched the expected state.

## Root cause
`marketTruth.ts` recognised account market / currency intents through a UNION of phrase-shaped regexes keyed to specific verb x noun x currency combinations (an assertion + "customer|account", an instruction verb + a price noun + a currency, ...). A wish ("I want prices in USD", HE "אני רוצה ..."), a possibility question ("Can my account work in USD?", HE "אפשר ..."), and market instructions/simulations without a market NOUN ("... כאילו הוא בינלאומי", "Treat my account as Local") matched none of them, so the request reached the free-form model: `answerSource: model`, `factPayload: null`, no structured truth.

## Generalized routing fix (runtime, `supabase/functions/chat-ai/marketTruth.ts`)
Semantic layer, not a phrase list: a message is an account market / currency intent when it pairs a TARGET (a currency the ACCOUNT would display / work in, or a market the ACCOUNT would belong to) with a speech-act FRAME (desire, possibility, instruction, simulation, identity assertion) and none of the GUARDS. Normalized kinds: `ACCOUNT_MARKET_QUERY`, `ACCOUNT_CURRENCY_QUERY`, `ACCOUNT_MARKET_OVERRIDE_REQUEST`, `ACCOUNT_CURRENCY_OVERRIDE_REQUEST`, `ACCOUNT_MARKET_IDENTITY_ASSERTION` (`classifyAccountMarketIntentKind`; `classifyAccountMarketIntent` = "kind !== null"). ALL kinds resolve to the SAME single route: verified server account facts -> `ACCOUNT_MARKET` payload -> prose (no per-phrase response logic). The original patterns remain as a UNION (nothing that routed before can stop routing).
Guards (keep unrelated mentions out): generic currency knowledge (rate, symbol, what does X stand for, how to write, history, weight units), digits / calculations, real pricing questions (how much, price of, plan names), quote-content document creation ("create a quote in USD" keeps its own route), banking / money-movement context.
Unchanged: `index.ts` (route position, verified-account condition, payload built from server facts only), prose renderer, payload builder, contract, acceptance derivation.

## Deployment (TEST only; Production not touched)
Implementation commit `b4edd6d27ba949c3b9558d15a60972a9539cec0d`. Deployed from `C:\tkrc-pt-deploy-scratch` (existing scratch, byte-verified against the worktree, 41 files, manifest `...-v35-deploy-input-manifest.txt` sha256 `1117b81d...`), `supabase functions deploy chat-ai --project-ref ljfizgrdyzxddswcedwr`. Previous **v34** -> new **v35**: `updated_at` 2026-09-23T20:35:58.064Z, function id `224bc456-4ca2-40cd-9c82-b5f959aa8fe0`, `ezbr_sha256` `4e1ccd2fa6b8a4de489de79069599aae666423e7274533c7a22f7b70394cd06c`. Fresh read-back `...-v35-readback.json`; per-module source/runtime equivalence **18 / 18** (`...-v35-module-equivalence.json`, allMatch true); `git diff b4edd6d HEAD -- supabase` empty (no runtime change after the deployed SHA). The version was bracketed unchanged across every capture.

## Routing matrix (live TEST, `...-live-matrix.json`, `scripts/run-market-routing-matrix.mjs`)
Locked data: `src/data/productTruthMarketRoutingMatrix.js`. **38 / 38** prompts route deterministically with a valid structured payload (HE Local 18/18, EN International 20/20; desire 10, possibility 8, instruction 7, assertion 7, simulation 6); **FREE-FORM LEAK COUNT 0**. Builder self break-test (35 unseen paraphrases): **35 / 35**. Negative controls: **0 / 63 over-routed** (live route agrees with the classifier on all 63). Every routed row: `kind product_truth`, `truthStatus ACCOUNT_MARKET`, `claimScope ACCOUNT`, `marketScope ACCOUNT`, `accountMarket` LOCAL (`currencyScope ILS`) / INTERNATIONAL (`MULTI`) equal to the SERVER-verified market, canonical-derivation equality, prose consistent, no product-wide claim, no cross-market currency in the prose. All Codex-proven bypasses are in the matrix.

## 20-call variance (LOCAL_PRO, Local)
- original deterministic prompt: 20/20 deterministic, 1 distinct payload (ACCOUNT / LOCAL / ILS), 1 distinct prose, 20/20 consistent, 0 product-wide claims - PASS.
- formerly free-form prompt ("אני רוצה לראות מחירים בדולר"): identical results - PASS.
- supplementary 14 paraphrases / questions: **14 / 14** deterministic (was 13 / 14 on v34).

## Final matrices (fresh 74-call v35 capture + live read-only Support re-read)
**Owner 48/48, Plan/Role 13/13, Security 9/9 (incl. market_forgery), AI Support 4/4 - FINAL EVIDENCE SEMANTIC GATE: PASS** (`...-final-gate-output.txt`, raw `...-v35-raw-matrices.json`). Earlier attacks (Findings 1 / 2 / scoped 3) still rejected, valid scoped positives accepted (`...-earlier-attack-proof.json`).

## 5186 / real-browser HE + EN terminal
5186 rebuilt and rebound at acceptance commit `e4e7880a81e2ac11544ada663584f8aa3b5c2ddc` (`--mode localtest`, `dirty:false`, TEST ref, build-input digest `88dcdaa9...` == worktree, served assets == dist). Real Playwright browser, real login form, real widget, answers read from the DOM, payload read from the same chat-ai HTTP response: HE Local (LOCAL_PRO): RTL, shekel only, **6 / 6 PASS** including a foreign-currency wish and a foreign-currency possibility question -> deterministic ACCOUNT_MARKET / LOCAL / ILS. EN International (INTL_PRO): LTR, no shekel, **6 / 6 PASS** including "Treat my account as Local" and "Can my account work in USD?" -> deterministic ACCOUNT_MARKET / INTERNATIONAL / MULTI. 0 structured violations. `...-5186-he-en-smoke.json` + screenshots.

## Quality (fresh)
Full suite **140 files / 3611 tests passing** (was 138 / 3409); `supabase` **25 files / 948**; `src/data` **15 files / 1007**; new: `marketRouting.test.js` **188** tests, `productTruthMarketRoutingEvidence.test.js` **14**. ESLint **0 errors** (3 pre-existing warnings). `vite build --mode localtest` OK. Unrelated paths untouched (Smart Quote, quote-save, public signing, pricing / payment, SEO, video).

## Honest limits
The classifier is a conservative rule model, not a language model: an unmodelled phrasing can still fall through (the free-form model then answers under the account-context block, exactly as before - never a payload-less "deterministic" claim). The Builder self break-test found 3 misses out of 35 unseen positives before two general rules were widened (Hebrew bare "חשבון" anchor, a longer wish sentence); it is a regression set, not a completeness proof. "Can I create a quote in USD?" is deliberately NOT an account-market intent (quote-content question, own route).

## Labels
RUNTIME IMPLEMENTATION SHA `b4edd6d27ba949c3b9558d15a60972a9539cec0d` (TEST chat-ai v35); acceptance / 5186 build source `e4e7880a81e2ac11544ada663584f8aa3b5c2ddc`; START Product Truth HEAD `cdf563bfd9db0083d1091c22af4cc2870407fef2`; CURRENT PRODUCT TRUTH EVIDENCE HEAD = tip of `tekango-rc-product-truth-2026-09-22` in `C:\tkrc-pt` (verify with `git rev-parse HEAD`).
