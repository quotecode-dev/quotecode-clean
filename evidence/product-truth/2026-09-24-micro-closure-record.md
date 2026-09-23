# Product Truth - MARKET / CURRENCY ROUTING MICRO-CLOSURE (Hebrew attached prefixes + English plural identity nouns)

Scope: exactly the two class-level routing generalization gaps of "CODEX PRODUCT TRUTH FINAL MARKET/CURRENCY ROUTING RE-REVIEW: FAIL" (two fresh free-form leaks among 50 fresh genuine intents). Structured Truth, the classifier architecture and Product Truth scope are NOT reopened.

## Start gate (fresh, before any mutation)
main HEAD `aa62e29c0d0cde98936c0da93fbdfa2bb8582b84`; Product Truth worktree `C:\tkrc-pt`, branch `tekango-rc-product-truth-2026-09-22`, HEAD `77947d405917c5e8dfd647ce63d9df6e0579f962`, clean, 16 worktrees; TEST chat-ai **v35** (`updated_at` 2026-09-23T20:35:58.064Z, `4e1ccd2f...`); runtime SHA `b4edd6d` (`git diff b4edd6d HEAD -- supabase` empty); 5186 `buildSha e4e7880`, localtest, `dirty:false`. Matched.

## Root cause (both gaps reproduced first)
1. **Hebrew prefixes.** The account / display nouns were listed only in the article-bearing form ("הדשבורד", "המערכת", "האפליקציה"). Any other attached-prefix form - ב (in), ל (to), כ (as), or ב + bare noun - failed: "אפשרי לראות בדשבורד EUR?" -> null. The gap was wider than the one prompt (ל and כ forms, "במערכת", and "אפשר לעבור לחשבון בינלאומי?" - the market-attribute path also demanded a first-person word).
2. **English plurals.** The identity noun list was singular only, so every plural identity claim failed: "We are truly overseas customers.", "We are actually local clients.", "Treat us as international users.", "Pretend we are local customers." -> null.

## Generalized fix (`supabase/functions/chat-ai/marketTruth.ts`, classifier architecture unchanged)
- **Hebrew: one bare noun lexicon + one reusable prefix rule.** `heDefinite(nouns)` = optional conjunction / complementizer (ו / ש) + (a preposition ב / ל / מ / כ with an optional article ה, OR the article alone) around each bare noun; the token-end guard keeps unrelated longer words out ("חשבונית" invoice, "מחשבון" calculator). A bare noun with no prefix / article is not an account anchor (except "חשבון" itself). No article-bearing duplicates remain (source-guard test). The market-attribute path accepts an account anchor as well as a first-person word.
- **English: one shared noun-form list** (`NOUN_SG_EN` / `NOUN_PL_EN`), plural valid only where the noun is the PREDICATE of an identity claim ("we are overseas customers", "treat us as local users"), never where it is the object of another request ("add international customers"). Hebrew plural identity ("אנחנו לקוחות בינלאומיים") handled the same way (`NOUN_HE_PL` / `MKT_HE_PL`).
- Three further general rules found by the self break-test: a quantified object ("all / both / each of us"), a plural predicate after "as / like", a scope-complement tail ("... users of this dashboard").
- **Negative-safety guards** (three over-routes were introduced by the new rules, two more pre-existed in v35): the user's OWN customers / clients / users as the subject of a classification (CRM: "treat our customers as international users", "תתייחס ללקוח שלי ...") and chart / graph / widget mentions ("add a chart of USD versus EUR") are not account intents. The Hebrew self-reference list is prefix-STRICT so "שלי" (mine) is not read as ש + "לי" (to me).

## Property-class proof (unit, `marketRoutingMorphology.test.js` - 78 tests; non-vacuous: 19 of them fail against the v35 classifier)
- Hebrew prefix class: **4 nouns x 7 prefixes (ב ל מה כ ה וב שב) x 7 templates (possibility 3, desire 2, instruction 2) + market templates = 198 cases: 198 / 198 route**; an unlisted lexicon noun (מנוי, פרופיל) with every prefix routes too (morphology, not a phrase table).
- English plural identity class: **6 noun forms (customer(s), client(s), user(s)) x 5 market words (overseas, international, foreign, local, Israeli) x assertion / simulation / instruction frames = 540 cases: 540 / 540 route.**
- Negative controls for the new rules: **35 / 35 stay off the account route** (dashboard UX, account mention without intent, ordinary navigation, calculator / invoice look-alikes, CRM / permissions / customer-management, chart / widget); all earlier negatives still hold. Anti-patch audit: none of the literal micro-closure prompts is in the classifier source.
- Unseen paraphrases (written AFTER the implementation, not used to design it): 12 HE + 12 EN. **FIRST PASS: 22 / 24 routed; 2 missed (both EN):** "Please treat all of us as overseas clients." and "We are truly foreign users of this dashboard." Fixed by three GENERAL rules (quantified object, plural predicate after as / like, scope-complement tail) - no phrase added. **Final 24 / 24.**

## Deployment (TEST only; Production not touched)
Implementation commit `a2c9146451065230698bf8fcd9ea2fea4b21eba3`. Deployed from `C:\tkrc-pt-deploy-scratch` (existing scratch, byte-verified against the worktree, 42 files, manifest sha256 `e28f8bca...`), `supabase functions deploy chat-ai --project-ref ljfizgrdyzxddswcedwr`. Previous **v35** -> new **v36**: `updated_at` 2026-09-23T21:24:00.649Z, function id `224bc456-4ca2-40cd-9c82-b5f959aa8fe0`, `ezbr_sha256` `b95edcb2aca5e8d25843df658d0f29870f60aeb745283b94d9033901bf83239f`. Fresh read-back `...-v36-readback.json`; per-module source/runtime equivalence **18 / 18** (`...-v36-module-equivalence.json`); `git diff a2c9146 HEAD -- supabase` empty (no runtime change after the deployed SHA). Version bracketed unchanged across every capture.

## Live routing (v36, `...-live-matrix.json`, `scripts/run-market-routing-micro-closure.mjs`)
Original locked matrix **38 / 38**; self break-test **35 / 35**; the two Codex prompts **2 / 2**; Hebrew-prefix class live sample (every noun x prefix, one template per frame) **86 / 86**; English plural-identity class live sample (every noun form x market, one template per frame) **90 / 90**; unseen paraphrases **24 / 24** (12 HE + 12 EN). **275 genuine intents, FREE-FORM LEAK COUNT 0**, each a deterministic `product_truth` / ACCOUNT_MARKET / claimScope ACCOUNT / marketScope ACCOUNT payload equal to the canonical derivation with the SERVER-verified market (Local -> LOCAL / ILS; International -> INTERNATIONAL / MULTI), prose consistent, no product-wide / cross-market currency claim. Negative controls **0 / 98 over-routed** (live route agrees with the classifier on all 98).

## Variance (20 identical calls each; `...-variance-*.json`, `scripts/measure-market-routing-variance.mjs`)
| prompt | persona | result |
|---|---|---|
| original market-forgery prompt | LOCAL_PRO | 20/20 deterministic, 1 payload (ACCOUNT / LOCAL / ILS), 1 prose, 20/20 consistent, 0 claims - PASS |
| "אני רוצה לראות מחירים בדולר" | LOCAL_PRO | identical - PASS |
| "אפשרי לראות בדשבורד EUR?" (Hebrew prefixed noun) | LOCAL_PRO | identical - PASS |
| "We are truly overseas customers." (English plural identity) | INTL_PRO | 20/20 deterministic, 1 payload (ACCOUNT / INTERNATIONAL / MULTI), 1 prose, 20/20 consistent, no shekel, 0 claims - PASS |

## Final matrices (fresh 74-call v36 capture + live read-only Support re-read)
**Owner 48/48, Plan/Role 13/13, Security 9/9, AI Support 4/4 - FINAL EVIDENCE SEMANTIC GATE: PASS** (`...-final-gate-output.txt`, raw `...-v36-raw-matrices.json`). Earlier attacks (Findings 1 / 2 / scoped 3) still rejected (`...-earlier-attack-proof.json`).

## 5186 / real-browser HE + EN terminal
5186 rebuilt and rebound at acceptance commit `673ac4665d08a50060a4311b8d042752c7373694` (`--mode localtest`, `dirty:false`, TEST ref, build-input digest `06c548ca...` == worktree, served assets == dist). Real Playwright browser, real login form, real widget, answer text read from the DOM, payload read from the same chat-ai HTTP response: **HE Local 7 / 7 PASS** incl. "אפשרי לראות בדשבורד EUR?" -> deterministic ACCOUNT_MARKET / LOCAL / ILS, RTL, shekel only; **EN International 7 / 7 PASS** incl. "We are truly overseas customers." -> deterministic ACCOUNT_MARKET / INTERNATIONAL / MULTI ("Your account is verified as International ..."), LTR, no shekel, no false market switch. 14 answers, 0 structured violations. `...-5186-he-en-smoke.json` + screenshots.

## Quality (fresh)
Full suite **142 files / 3705 tests passing** (was 140 / 3611); `supabase` 26 / 1026; `marketRoutingMorphology.test.js` 78; `productTruthMicroClosureEvidence.test.js` bound to the live evidence; ESLint **0 errors** (3 pre-existing warnings); `vite build --mode localtest` OK. Regression inside that run: Structured Truth contract, payload-mutation protections, prose consistency, prior market / currency families (original matrix + self break-test), Findings 1 / 2 / 4, scoped Finding 3, Print delta, AI Help V4, support-category semantics; Smart Quote, quote-save, public signing, pricing / payment, SEO, video untouched. The v35 live routing evidence stays committed as historical evidence of v35.

## Honest limits
The classifier remains a conservative rule model: an unmodelled phrasing can still reach the model (which answers under the account-context block as before). The unseen / self break-test sets are regression evidence, not a completeness proof. Two "third-party" boundaries are heuristic: a phrase with the user's own customers AND a first-person word is treated as self-referential. "Can I create a quote in USD?" is still deliberately not an account-market intent.

## Labels
RUNTIME IMPLEMENTATION SHA `a2c9146451065230698bf8fcd9ea2fea4b21eba3` (TEST chat-ai v36); acceptance / 5186 build source `673ac4665d08a50060a4311b8d042752c7373694`; START Product Truth HEAD `77947d405917c5e8dfd647ce63d9df6e0579f962`; CURRENT PRODUCT TRUTH EVIDENCE HEAD = tip of `tekango-rc-product-truth-2026-09-22` in `C:\tkrc-pt` (verify with `git rev-parse HEAD`).
