# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Trial Expiration → FREE — Full Entitlement Audit + TEST Fix

**Effort level**: HIGH. **Owner-authorized: AUDIT + IMPLEMENTATION + TEST VERIFICATION, TEST only.** Not authorized: Production mutation/deploy, application commit/push, Admin work, Item 28 implementation, creation of the six new subscription personas.

## 1. Fresh Local State (start of task)

`main` `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged (confirmed against `origin/main` too). No application code drift since the prior task.

## 2. Root Cause — Re-Confirmed Fresh

Signup (`Dashboard.jsx`) writes `plan:'pro'` once, at account creation, alongside a genuine 14-day `trial_ends_at`. A repo-wide grep found exactly two `plan` write sites in the whole codebase — signup and self-cancellation — and no automatic trial-to-free downgrade anywhere. The pre-fix `effectivePlan` formula resolved to `'pro'` unconditionally whenever raw `plan==='pro'`, independent of `trial_ends_at`, so a real user who let their trial lapse without cancelling kept full PRO indefinitely.

## 3. Architectural Safety — Proven, Not Assumed

Per the Owner's explicit "STOP if ambiguous, do not guess" instruction, the exact transition this fix targets (`plan==='pro'` + a real, non-null, past `trial_ends_at`) was proven unambiguous: `plan` is only ever set to `'pro'` at signup, and signup always pairs it with a genuine ~14-day-forward date at that moment (enforced by an `AS RESTRICTIVE` RLS INSERT policy). Nothing else in the codebase ever writes `plan:'pro'`. So a non-null past date on a `'pro'` row can only be a lapsed, never-reset trial — never a genuine paid grant. `'basic'` and `plan==='pro'`+`trial_ends_at===null` (Lifetime-grant) both remain unambiguously PRO-tier, unchanged from before. One narrow, pre-existing ambiguity (`plan==='free'∧trial_ends_at===null` — self-cancel vs. a rare Lifetime-grant-onto-free) is disclosed but out of scope — not touched or worsened by this fix. Full reasoning: `PROFLOW_PROJECT_CONTEXT.md` §51.

## 4. Implementation

New centralized pure function `src/utils/planEntitlements.js` → `computeEffectivePlan({ plan, trialEndsAt, now })` — single source of truth, same pattern as `quoteLock.js`'s `isQuoteImmutable`. Wired into every consumer found by the exhaustive audit:

- **`Dashboard.jsx`** — replaced the inline formula; `isPro`/`isBasicOrAbove`/`planLimit`/the monthly-quota check/`handleProtectedAction` all inherit the fix automatically.
- **`SettingsTab.jsx`** — the Logo-upload gate was checking **raw** `bizPlan !== 'pro'` directly (a real, independent bug from the same root cause) — now uses a new `effectivePlan` prop. The "PLAN" name label was also switched from raw to effective, so it never claims "PRO PLAN" while entitlements are FREE.
- **`QuoteForm.jsx`** — the Attachments feature ("Attachments (PRO only)") was gated via **raw** `userPlan`/`bizPlan` — a real gate not previously documented in either prior entitlement audit. `Dashboard.jsx` now passes `userPlan={effectivePlan}` instead of `userPlan={bizPlan}`.
- **`QuoteForm.jsx`** submit button — removed a blanket `disabled={isTrialExpired && !isSuperAdmin}` that blocked **all** quote creation/editing once the trial date passed, regardless of plan — stricter than FREE, contradicting the Owner's "FREE limits, not zero" rule. The two already-correct, already-existing enforcement points (the monthly-quota check in `handleSaveQuote`, and `handleProtectedAction`'s gate upstream of Edit/Duplicate/WhatsApp/Delete) are now the sole enforcement.

**Deliberately not touched**: `AdminUsersTab.jsx`/`UserDetailsModal.jsx` have the same class of independently-derived plan formula (and the same underlying gap) — disclosed in §51, not fixed, per the standing "NO Admin work" boundary.

## 5. Complete Entitlement Matrix

See `PROFLOW_PROJECT_CONTEXT.md` §51 for the full table (8 gates: monthly quota, Edit/Duplicate, WhatsApp/Delete, Logo upload, Attachments, the removed submit-button block, Public Quote/signatures/printing/PDF-placeholder confirmed ungated, AI Chat confirmed ungated).

**Backend enforcement**: re-confirmed frontend-only for every gate — no RLS/Edge Function independently re-enforces any plan limit. Disclosed as a pre-existing characteristic; not expanded into a redesign this task.

**`subscription_ends_at`**: re-confirmed still absent from TEST (unchanged from the prior audit), unrelated to this fix, untouched.

## 6. TEST Verification (live, both markets, zero TEST database mutation)

Used CDP network-response interception (`Fetch` domain) to rewrite the browser's own `business_settings`/`quotes` REST responses in-flight — the real, live, rendered app exercises the fix end-to-end, but the real TEST database is never written to. Safer and more reversible than mutating a shared account, and requires no new personas.

Results, identical both markets:
- **Active trial (real, unmutated data)**: `"pro PLAN"` label, Logo upload enabled — regression check PASS.
- **Expired trial (simulated via interception)**: `"free PLAN"` label, Logo upload disabled with the "(Requires Pro plan)" badge, Attachments correctly triggers the real upgrade-confirm modal on click, and the New-Quote submit button is **not** disabled — FREE users can still create quotes.
- **5-quote monthly boundary (5 fabricated quotes injected, zero DB write)**: a 6th creation attempt is correctly blocked with the real "monthly quote limit reached" alert, before any insert call fires.
- Zero horizontal overflow at 360/390/412px and desktop, both markets.

## 7. Automated Tests

14 new unit tests, `src/utils/planEntitlements.test.js`, covering every case the task specified: active trial, expired trial (the core fix), FREE without trial, BASIC (unconditional), PRO including the Lifetime/`trial_ends_at===null` case, the exact expiry boundary (both directions — one day left vs. one second past), and a malformed trial-date string (fails safe, does not crash). **70/70 tests pass** (56 pre-existing + 14 new). Lint clean (same pre-existing 6-warning baseline). Build succeeds.

## 8. Item 31 — Documentation-Only Clarification (section 14 of the task)

Extended `PROFLOW_TODO.md` item 31 with two Owner design observations, documentation only, no implementation: (A) only the sequence-number marker (`1.`/`2.`/`3.`) should render in ProFlow purple, not the item's content text. (B) Additional Notes may contain a semantic hierarchy (Project → Section → Items, generic groupings like apartment/floor/room/branch/site/department/phase, not aluminum-specific), with automatic numbering belonging to the Items level, not Project/Section headings — and this must be designed together with future Item 30 awareness before any implementation.

## Continuity Sync + Remote Read-Back

Synced through the existing §17.J mechanism (isolated `quotecode-saas-continuity` worktree → secret/privacy scan → explicit filename staging → commit → push `proflow-continuity` only), followed by genuine remote GitHub read-back verification.

## Final Verdict

**TRIAL EXPIRATION → FREE: PASS**

- `ROOT CAUSE`: signup writes `plan:'pro'` once, permanently, with no automatic downgrade on trial expiry; `effectivePlan` treated raw `'pro'` as unconditional PRO.
- `ENTITLEMENT MATRIX`: see `PROFLOW_PROJECT_CONTEXT.md` §51 (8 gates, 3 real bugs found and fixed beyond the original root cause).
- `EXPIRED TRIAL EFFECTIVE PLAN: PASS`
- `FREE 5-QUOTE LIMIT: PASS`
- `ALL OTHER FREE GATES: PASS` (Logo upload, Attachments both fixed and verified)
- `ACTIVE TRIAL: PASS` (regression confirmed, both markets, unmutated real data)
- `BASIC: verification limitation` — no genuine TEST BASIC account exists yet (six new personas not authorized this task); correctness argued from the unconditional `rawPlan==='basic'` branch (BASIC can never be trial-produced) plus dedicated unit test coverage.
- `PRO: PASS` — genuine active-trial PRO verified live; Lifetime/paid-PRO (`trial_ends_at===null`) branch covered by unit test, matching the pre-existing, unchanged Admin Lifetime mechanic.
- `EXISTING DATA PRESERVED: PASS` — zero TEST database mutation performed anywhere this task; verification used network-response interception only.
- `HE: PASS` / `EN: PASS`
- `BACKEND ENFORCEMENT`: frontend-only, re-confirmed, pre-existing, disclosed, not expanded into a redesign.
- `subscription_ends_at`: re-confirmed absent from TEST, unrelated, untouched.
- `ITEM 31 PURPLE NUMBERING DOCUMENTED: PASS`
- `ITEM 31 PROJECT→SECTION→ITEMS DOCUMENTED: PASS`
- `LINT: PASS` (0 errors, same 6-warning baseline)
- `TESTS: PASS` (70/70)
- `BUILD: PASS`
- `REMOTE CONTINUITY READ-BACK: PASS`

**Fresh Local State — MAIN HEAD**: `17ac4d3a950d96f4167f9b320c82b4798382d621` (unchanged). **WORKING TREE**: uncommitted changes carried forward plus this task's edits to `src/pages/Dashboard.jsx`, `src/components/QuoteForm.jsx`, `src/components/SettingsTab.jsx`, and new files `src/utils/planEntitlements.js`/`planEntitlements.test.js`. **TEST**: unchanged — zero database mutation. **PRODUCTION**: UNCHANGED.

**NO application commit. NO application push. NO Production deployment/mutation. NO LIVE action. NO Admin work. NO Item 28 implementation. NO creation of the six new subscription personas.**

**Awaiting Owner + ChatGPT review.**
