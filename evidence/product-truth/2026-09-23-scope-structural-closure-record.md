# Product Truth - Scope/Polarity STRUCTURAL closure (record, 2026-09-23)

Status: Builder self-verification only. NOT Codex re-review, NOT Owner acceptance, NOT PRE-LIVE PASS, NOT First-LIVE PASS.
PRE-LIVE Snapshot: NOT STARTED. POST-FIRST-LIVE TOOLING EVALUATION: still deferred (no install/config/purchase).

## Identities
- START HEAD (Product Truth branch `tekango-rc-product-truth-2026-09-22`): `fe844f47fa7d46fc85138d319b7164496978c9b7`
- Implementation commits: `c9cb28417292e840bc461ca8bcb09ed5ecd849d5` (structural model), `009669a3034a3465b2c4ebaf29371525c29b0bff` (composition + time/modality)
- RUNTIME IMPLEMENTATION SHA: `08c012bcd6094335e987e7972c66604c2579e125` - TEST chat-ai v32 (ref `ljfizgrdyzxddswcedwr`), NOT redeployed; `git diff 08c012b HEAD -- supabase/` is one test-only line
- 5186 (`http://192.168.1.189:5186/`): rebound to `009669a` localtest, dirty:false, all served assets re-hashed = worktree digest `606da551...`, TEST ref only.

## Root cause
The previous scoping worked on per-cue token windows over an incomplete clause list. Punctuation (em/en dash, colon), clause order and Hebrew exclusivity (`מלבד`, `חוץ מ-`) moved a cue out of its window, so a TEKANGO-negative claim and an external-positive claim were mixed at sentence level.

## Structural fix (`src/data/productTruthScopeClaims.js`)
1. Clause segmentation by boundary CATEGORY (punctuation, contrast words EN+HE, soft coordinators only when both sides carry a cue, exception spans protected).
2. Explicit claim objects `{clauseIndex, span, text, polarity, scope, qualifiers}`; scope = tekango | external | both | implicit-tekango.
3. Exclusivity as a construct (EN except/other than/apart from/everywhere-but/only outside/only elsewhere; HE מלבד/חוץ מ-/פרט ל-/למעט/רק מחוץ ל-/רק במוצרים אחרים), yielding an external claim AND the opposite TEKANGO claim.
4. Order-independent resolution: a set operation over TEKANGO-scoped claims; external claims never prove TEKANGO availability.
5. Composition + time + modality: negation operators and retraction invert; future/past/planned = not available now; hedges assert nothing.
6. External phrases are generic (other/competing/... + ANY noun; HE noun + אחרים/אחרות) with a TEKANGO-internal noun exclusion list.

## Anti-patch audit
1. Exact exceptions for the Codex sentences? NO (source-guard test greps the non-test modules for those literals and capability words).
2. Generalized syntax/scope handling? YES (categories above).
3. Unseen nouns / punctuation combos? YES - property run with nouns the model has never seen: 117,296 cases, 0 leaks, 0 false rejections.
4. TEKANGO and external scopes separate? YES - separate claim scopes; resolution reads only TEKANGO-scoped claims.
5. Clause order irrelevant? YES - resolution ignores clause index/span; order-independence tests plus generator families with both orders.

## Nine Codex failures - direct regressions
All 9 (EN 4: 2 reject + 2 accept; HE 5: 3 reject + 2 accept) are locked as tests in `productTruthScopeClaims.test.js` and re-run in the closure proof (22 direct cases OK): each reject case is rejected and each accept case is accepted, through the real polarity check and injected into the Owner matrix.

## Property model (proof JSON `2026-09-23-scope-structural-closure-proof.json`)
- Seen nouns: 133,682 generated, 0 leaks, 0 false rejections.
- Unseen nouns: 117,296 generated, 0 leaks, 0 false rejections.
- Previous model (`fe844f4`) on the same generated set: 12,381 leaks and 22,027 false rejections.
- Real Owner gate: 39,433 injected contradictions ALL rejected (Owner < 48); 36,968 valid positives ALL accepted (48/48).
- Families: pair, tek-only, ext-only, except-positive, except-negative, only-outside, only-tekango, special, composition, temporal.

## Gate and regressions
- Baseline final gate (with read-only live Support read-back): Owner 48/48, Plan/Role 13/13, Security 9/9, Support 4/4 - FINAL EVIDENCE SEMANTIC GATE: PASS.
- Earlier Codex attacks (Findings 1/2/4 + earlier scope attacks): all rejected; valid scoped positives accepted.
- Runtime corpus: 486 real answers, 0 false rejections. Cross-truth sweep: 564 pairs, 0 leaks.
- Vitest: 136 files / 3258 tests pass. ESLint: 0 errors, 3 pre-existing warnings.

## Self break-test findings closed in this task (found by Builder, before Codex)
"Some say X exists in TEKANGO, but that is wrong" accepted; "will have / used to have" accepted; "may/might have" accepted; "It is not true that TEKANGO lacks it" and "No other X has it except TEKANGO" falsely rejected. All closed structurally (composition, time, modality).

## Browser smoke (5186, HE + EN) - disclosed flake
- Run 1 (`...-5186-he-en-smoke-run1-HE-FAIL.json`): HE FAIL on `market_forgery_corrected` - required regex `/החשבון שלך/` was absent; the answer was a correct, non-forging refusal in different wording. The harness was NOT loosened.
- Run 2 (`...-5186-he-en-smoke.json`): HE PASS (3/3), EN PASS (2/2).
- Variance measurement (`...-market-forgery-variance.json`, 20 identical calls, LOCAL_PRO): 20/20 refuse, 0/20 adopt the international market, 16/20 scope the statement to the account, 2/20 contain a product-wide currency phrase; 1/20 (#8: "המחירים המוצגים ב-TEKANGO הם בשקלים (ILS) בלבד") states ILS-only as a PRODUCT-wide fact without account scoping, which is inaccurate for a product that also supports USD/EUR/GBP. This is chat-ai runtime model non-determinism, outside this task's allowed scope (no unrelated runtime change, no redeploy); it is reported as an OPEN OBSERVATION for Codex/Owner, not fixed here.

## Honest limits
Prose is still analysed heuristically because `factPayload` is null; unmodelled constructions remain possible - hence the request for an independent Codex structural break-test.

## Authorization boundary
No Production access, no push, no merge, no LIVE, no PRE-LIVE Snapshot, no new worktree/project directory, no runtime redeploy, no Smart Quote/pricing/payment/SEO/video changes, no real customer data. TEST-only synthetic personas.
