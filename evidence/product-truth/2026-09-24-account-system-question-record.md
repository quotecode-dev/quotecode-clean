# Product Truth - ACCOUNT / SYSTEM-SUBJECT CURRENCY QUESTION FRAME (micro-delta)

Answers "PRODUCT TRUTH v38 FINAL CODEX RE-REVIEW: PARTIAL": the in-domain yes/no currency questions whose SUBJECT is the user's own account or the system (`האם החשבון שלי משתמש בדולר?`, `האם המערכת עובדת ביורו?`, `Does my account use dollars?`, `Does the system work in euros?`) fell through to free-form prose. Scope: only this one grammar frame. Nothing else changed.

## Start state
Runtime SHA `39e7af3a...`, TEST chat-ai v38, acceptance/5186 source `aa1845e`, evidence HEAD `4a8d7d25...`, continuity HEAD `917122f5...` (main).

## Root cause (verified before any edit)
Tokenizing all four questions: every token is tagged correctly (Q / ENTITY|SURFACE / POSS / VERB|PERSON / CUR). The grammar had currency-question frames only for a wh-question ("what currency ..."), a price-word yes/no ("are the prices in USD?") and a TEKANGO-brand subject. A yes/no question whose SUBJECT is the user's account or the system matched no frame. The lexicon lacked nothing but the Hebrew preposition `עם` (found by a paraphrase).

## Fix (runtime commit `9fb2b23d1f18a15fe619fc324d3a926e87b4d6df`, one file: `marketIntentGrammar.ts`)
- `readAccountSystemSubject`: my/our/the/this + account|system|app|dashboard, TEKANGO; Hebrew החשבון (שלי/שלנו), המערכת, האפליקציה, הדשבורד, TEKANGO.
- `matchAccountSubjectCurrencyQuestion`: question form -> subject -> optional predicate (use / work / support / is in / is using / set to; Hebrew person-noun-vs-verb ambiguity resolved by the account subject) -> only prepositions / determiners / adverbs -> currency -> end. Yields the normalized intent `{subject: ACCOUNT, relation: CURRENCY_QUERY, modality: QUESTION}` which reuses the single ACCOUNT_MARKET route and structured factPayload.
- A possibility token keeps its own CURRENCY_CAPABILITY reading. `האם אפשר לעבוד ב-£?` (impersonal, no self/account/system target) stays OUT of scope - unchanged.
- Hebrew preposition `עם` added to the lexicon. No phrase list, no regex in `marketTruth.ts`, user text never becomes account truth.

## Tests
`marketAccountSystemQuestion.test.js` (56): root-cause tags; four Codex questions; 756 EN + 232 HE generated positives (0 leaks); 8 paraphrases; 27 negatives incl. the out-of-scope case; six Codex negatives; generated third-party negatives; SELF positives (220); symbol-prefix class (168); previous findings; anti-patch guard. Full suite 148 files / 3975 tests pass; `eslint` 0 errors (3 pre-existing warnings).

## TEST deploy (project ref `ljfizgrdyzxddswcedwr` only)
chat-ai v39, updated `2026-09-24T00:10:46.581Z`, ezbr `f036044f...`, byte-verified scratch tree, per-module equivalence 19/19. Production ref `ixabnzhjeqevtbhdfswv` untouched.

## Live evidence (v39 unchanged across the run)
Four questions -> deterministic structured ACCOUNT_MARKET (free-form leak 0); frame sampled per sub-class; 0/237 negatives over-routed; impersonal out-of-scope case asked 5 more times: 0/5 routed. Final gate on v39: OWNER 48/48, PLAN/ROLE 13/13, SECURITY 9/9, AI SUPPORT 4/4, semantic gate PASS; earlier-attack proof control 48/13/9/4, all Codex attacks rejected.

## 5186 browser verification (acceptance commit `0734ce34ddd17f4a278dcf14e51b657efa6049b1`)
5186 rebuilt (`vite build --mode localtest`) and rebound; `/version.json`: buildSha `0734ce34...`, `dirty:false`, mode localtest, TEST ref; 34 served assets == dist (0 mismatch). Playwright HE (LOCAL_PRO) and EN (INTL_PRO), real login, real widget, rendered answers read from the DOM; HE 12+2, EN 12+2 answers all PASS:
- HE `האם החשבון שלי משתמש בדולר?` (2026-09-24T00:27:10Z) and `האם המערכת עובדת ביורו?` (00:27:13Z): "החשבון שלך מאומת בשוק המקומי (Local), ולכן המחירים וההצעות בחשבון שלך מוצגים בשקלים (₪). ..."
- EN `Does my account use dollars?` (00:28:10Z) and `Does the system work in euros?` (00:28:14Z): "Your account is verified as International, so prices and quotes in your account are shown in your account's currency (USD, EUR or GBP). ..."
Artifacts: `2026-09-24-account-system-question-5186-he-en-browser-terminal.json`, `...-browser-he.png`, `...-browser-en.png`.

## Boundary
No Production, push, merge, tag, re-freeze, LIVE, PRE-LIVE snapshot, migration, SEO, video, payment/billing work, or real customer data. Independent Codex re-review NOT started.
