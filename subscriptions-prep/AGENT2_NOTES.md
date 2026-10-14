> HISTORICAL (night task, schema v1). Superseded by docs/subscriptions-prep-2026-10-07/PREP_FIX_REPORT_2026-10-07.md (Codex review fix, schema v2).

# Sub-agent 2 notes — content + illustration (HE/EN), 2026-10-07 night task

**PREPARATION ONLY — NOT CONNECTED — NOT ACTIVATED.** No commit, push, deploy, branch/HEAD change, TEST 5186 or
Production action. No file under `src/`, `public/`, `supabase/` was touched. Not accepted, not ready for live.

Identity: worktree `.cw/q`, branch `codex/quote-template-parity`, HEAD `209d5b8d1c6b8a3966a17afe63e441232f4d7799`
(unchanged at start and end). Locked blobs at HEAD = the Owner lock record (`LandingPage.jsx e2e0e4b3…`,
`landing.css d8083844…`, `LandingLocal.jsx c8e0263c…`, `LandingGlobal.jsx 53297c18…`); `git status` shows no
modification to them.

## Files

| File | Action | sha256 at end |
|---|---|---|
| `docs/subscriptions-classic-modern-visual-2026-10-07/USAGE_PACKAGES_SPEC_ADDENDUM.md` | edited: added "Owner decisions 2026-10-07 (night task)" block + 7 inline SUPERSEDED/OPEN markers; no original sentence rewritten | `7c9be9d6…6e5a` |
| `docs/subscriptions-plan-visualization-2026-10-07/PLAN_OPTIONS_OWNER_REVIEW.superseded-2026-10-07.html` | created by `cp` (historical copy) | `495af877…cd71` (= original) |
| `docs/subscriptions-plan-visualization-2026-10-07/PLAN_OPTIONS_OWNER_REVIEW.html` | updated (approved prices, 100 products + ₪5.00 expansions section, matrix, decision strip, examples, future section; 1 CSS line added) | `25a1f24c…c34b` |
| `subscriptions-prep/landing-preview/subscriptionsLandingPreview.js` | created | `ba74f4ca…e05e` |
| `subscriptions-prep/landing-preview/subscriptionsLandingPreview.prep-test.js` | created | `8870e245…c16a` |
| `docs/subscriptions-prep-2026-10-07/LANDING_CONTENT_CHANGE_MAP.md` | created | `845c974a…f4ff5` |
| `subscriptions-prep/AGENT2_NOTES.md` | this file | — |

Byte-identical (verified by sha256 before and after): `SUBSCRIPTIONS_CHANGE_SPEC_FOR_CLAUDE.md` `7b20956f…c14b`,
`SUBSCRIPTIONS_CURRENT_STATE_AUDIT.md` `d5704116…d778`.

## Commands and REAL exit codes

| Command | Exit | Result |
|---|---|---|
| `cp PLAN_OPTIONS_OWNER_REVIEW.html PLAN_OPTIONS_OWNER_REVIEW.superseded-2026-10-07.html && sha256sum … && cmp …` | 0 | both `495af87793ee82519798d85071a1c84e07b26430338b9d726d2b4cc80c45cd71`, 37389 bytes, `cmp` IDENTICAL |
| Addendum preservation check (node: remove the added block + the 7 inline markers, sha256) | 0 | `dd03029f…7c07` = the addendum's sha256 before editing → original text intact |
| `npx vitest run --config subscriptions-prep/vitest.config.mjs subscriptions-prep/landing-preview` | 0 | 1 file, 30/30 tests passed |
| `npx eslint subscriptions-prep/landing-preview` | 0 | no findings |
| HTML checks (grep: no `GB`, no `<a`/`<button`/`<form`/`<script`/`href=`; node tag-balance over `<body>`) | 0 | no links/buttons/scripts; every `₪` amount is whole with `.00`; tags balanced |

Not run: browser rendering of the review HTML (visual check NOT TESTED); product `npm test` / build (out of scope —
nothing in the product scope changed).

## What the preview proves (tests)

Marker on every object (frozen); HE has no Latin-script text (allowlist empty — Hebrew plan names קלאסיק/מודרן/ויזואל),
EN has no Hebrew; no 14-day/trial/"ניסיון"/"נסו" wording; no checkout/buy/pay-now claim and every card
`purchasable:false`; HE prices exactly `₪29.00`/`₪49.00`/`₪69.00`, VAT lines add up in whole shekels, every `₪` amount
`.00`; `₪5.00` per block; Visual 50 ⇒ `₪69.00`, 1,000 ⇒ 9 blocks ⇒ `₪114.00`; examples = 69 + 5 × minimal blocks;
EN has no currency symbol/code and paid prices are "Not decided yet"; HE/EN same plan ids, feature keys+statuses,
open-decision keys, table rows/statuses, examples; no GB/MB, credits or Small/Medium/Large; storage/AI/images never
approved and every image mention is "not decided"/"never unlocks"; nothing in `src/` imports the module; the live
landing pages do not contain the "10 free" line.

## Change requests raised (structural — not built)

CR-01 four cards in the 3-column `.tl-plan-grid`; CR-02 capability table (no slot; the TEST-only
`ProposedPresentationTiers` must not be repurposed — its copy states cumulative styles); CR-03 monthly/annual toggle
while annual is not approved; CR-04 neutral "not decided" feature row (only check/X exist); CR-05 separate expansions
block. Content-only fallbacks are listed in `LANDING_CONTENT_CHANGE_MAP.md` §4.

## Open items / notes for the coordinator

1. Open Owner decisions (unchanged): international + expansion prices in other currencies, annual billing, paid quote
   quotas, capability matrix (cumulative styles, images per plan), storage and AI (incl. per expansion), attachments,
   registration fields, existing-account transition and post-tenth-quote behavior, retention/grace/proration, revision
   policy, catalog-product counting rule (§4 stays PROPOSED), whether EN paid cards appear before international prices,
   Terms wording.
2. VAT line: the preview reuses the existing `LandingLocal.jsx` pattern (`* כולל מע"מ 18%: net + VAT`), giving
   29 = 25 + 4, 49 = 42 + 7, 69 = 58 + 11. "Including VAT where applicable" — the Owner did not change tax status; if the
   VAT breakdown should not be shown for the new plans, drop `vatNote` (content-only).
3. Product tests `src/landingTruth.static.test.js` (header: "14-DAY FREE TRIAL KEEP · ANNUAL PLAN KEEP") and
   `src/pages/landingTrialAndIconPolish.test.js` encode earlier Owner KEEP decisions; activation must update them under
   the new explicit Owner instruction.
4. `hero-phone-he/en.webp` are locked raster images; I did not inspect whether they show trial wording.
5. Observed but not mine: `scripts/db-test/run-db-tests.mjs` shows as modified in `git status` (Agent 1's ownership);
   I did not touch it.
