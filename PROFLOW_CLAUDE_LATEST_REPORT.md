# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Subscription/Billing/Entitlement System-Wide Audit + Two Owner-Approved Trial-Bar Corrections

**EFFORT LEVEL: VERY HIGH.** Full detail in `PROFLOW_PROJECT_CONTEXT.md` §91 (and §90 for the immediately-preceding Zero-Layout-Shift Fix + first-pass audit). No commit, no push, no Production, no DB/Supabase/Auth mutation.

---

## PART A

**TRIAL BAR VERTICAL ADJUSTMENT:** `top` offset changed from `calc(100% + 2px)` to `calc(100% - 6px)` (8px net upward shift, both bar variants) within the existing absolute-positioning track — no new mechanism, no document-flow height reintroduced.

**HE DESKTOP SHIFT:** 0px
**EN DESKTOP SHIFT:** 0px
**HE MOBILE SHIFT:** 0px
**EN MOBILE SHIFT:** 0px

(Re-verified visible → dismissed → visible-again, all 4 combinations, live-clicked — control-row/`<thead>`/first-row (desktop) and control-row/first-card (mobile) byte-identical across every state.)

**EXPIRED HE MESSAGE:** `תקופת הניסיון הסתיימה, הועברת למסלול FREE`
**EXPIRED EN MESSAGE:** `Your trial has ended — you've been moved to the FREE plan.`

No CTA added on either side (the old "אנא שדרג"/"Please upgrade." suffix removed entirely, per explicit Owner product decision). Only the `isTrialExpired` branch text changed — `isExpiringSoon` branch and all entitlement logic untouched. **Disclosed limitation**: no TEST account currently has a genuinely past `trial_ends_at` (creating one is out of scope), so verified via source/lint/111-tests only, not a live screenshot of the expired variant specifically.

**OWNER VISUAL APPROVAL:** PENDING

---

## PART B — SYSTEM-WIDE READ-ONLY AUDIT

**CURRENT ARCHITECTURE:** Two columns on one table (`business_settings.plan`, `business_settings.trial_ends_at`) drive everything, resolved through one shared pure function, `computeEffectivePlan()`. A DB trigger enforces who may write those two columns. No billing provider is connected. Two Admin surfaces re-derive plan/lifetime status with their own duplicated logic instead of calling the resolver — this is a live bug, not a theoretical risk (below).

**CURRENT SOURCE(S) OF TRUTH:** `business_settings.plan` (text, default `'free'`) + `business_settings.trial_ends_at` (nullable timestamptz, overloaded to also mean "Lifetime grant" when null). **No subscription/billing table or field exists anywhere** — confirmed against the live-production schema capture.

**ALL CURRENT WRITERS:** signup (`Dashboard.jsx:847`, RLS-restricted to exactly `free/null` or `pro/+14d±2h`), self-cancel (`PricingModal.jsx:74`, immediate/unconditional `free+null`), `handleToggleLifetime` (admin, `trial_ends_at` only), `handleExtendTrial14Days` (admin), a DB `BEFORE UPDATE` trigger (`guard_business_settings_plan_trial`) rejecting any other writer, `send-trial-expiration-email` (reminder-flags only, correctly wired), `send-subscription-expiration-email` (deployed but references 3 non-existent DB columns — **confirmed bug**). No other writer found in migrations/RPCs/functions.

**COMPLETE USER-LIFECYCLE MATRIX:** 29 states audited (signup through duplicate/out-of-order billing webhooks), each marked IMPLEMENTED/PARTIAL/AMBIGUOUS/NOT IMPLEMENTED against both current reality and the Owner's required future state. Headline results: Active Trial/Expired-to-FREE fully IMPLEMENTED; BASIC and non-trial-PRO marked AMBIGUOUS (entitlement math exists, state is DB-unreachable via any real purchase); all purchase/renewal/payment-failure/upgrade/downgrade/webhook states (9 of 29) marked NOT IMPLEMENTED — no billing provider exists; **cancel-with-entitlement-until-period-end marked NOT IMPLEMENTED** against the Owner's explicit requirement — current cancellation is immediate and unconditional. Full table in `PROFLOW_PROJECT_CONTEXT.md` §91.

**BILLING GAPS:** No payment provider connected anywhere. `billing-checkout-stub` is an explicit, self-documented scaffold (`checkoutUrl: null` always). No customer ID, subscription ID, price ID, payment-status field, webhook endpoint, or idempotency/reconciliation mechanism exists. **Bug found**: `send-subscription-expiration-email` queries `subscription_ends_at`/`subscription_reminder_3d_sent`/`subscription_reminder_24h_sent` — none exist in the live-production schema (confirmed by contrast with its correctly-wired sibling `send-trial-expiration-email`). Could not confirm from the repo whether it's actually invoked on a schedule (no Vercel `crons` entry; a `pg_cron` job wouldn't appear here).

**ADMIN CONSISTENCY RISKS:** **Live, reproducible bug, not hypothetical.** `UserDetailsModal.jsx:50` and `AdminUsersTab.jsx:302` both independently compute `isLifetime = isSuperAdminUser || trial_ends_at === null/undefined`, bypassing `computeEffectivePlan()` entirely. A self-cancelled FREE user (`plan:'free', trial_ends_at:null`) is correctly shown FREE by their own Dashboard but **"PRO (Lifetime)"** with a Crown badge on both Admin screens — `trial_ends_at IS NULL` is used as a Lifetime proxy but is also the self-cancel signature; the two states are indistinguishable from that one field alone. `AdminUsersTab.jsx` carries a comment showing the author was aware of `effectivePlan`'s expired-trial-to-FREE behavior but didn't anticipate self-cancel producing the identical shape.

**ENTITLEMENT MATRIX:**

| Feature | FREE | BASIC | PRO | ACTIVE TRIAL |
|---|---|---|---|---|
| Monthly quote limit | 5 | 20 | ∞ | ∞ (resolves as PRO) |
| Edit / Duplicate | ✗ | ✓ | ✓ | ✓ |
| WhatsApp / Delete | ✗ | ✗ | ✓ | ✓ |
| Attachments (30MB) | ✗ | ✗ | ✓ | ✓ |
| Digital signature | ✓ | ✓ | ✓ | ✓ (never gated anywhere) |
| Income/Revenue | ✓ | ✓ | ✓ | ✓ (never gated anywhere) |
| "Upgrade Plan" CTA | ✓ | ✓ | ✗ | ✗ |

ACTIVE TRIAL listed separately per Owner decision; its entitlement column is currently identical to PRO — the gap is representational (badge), not access-control. Quote limits are duplicated in two places already (`Dashboard.jsx:1729` display + `:2026` enforcement) — a latent drift risk even before any new plan is added.

**PACKAGE BADGE INPUT RECOMMENDATION:** Must consume a dedicated `badgeState` (`TRIAL|FREE|BASIC|PRO`) from the future canonical resolver exclusively — never locale, display text, trial-bar visibility, CSS state, or PricingModal selection.

**CANONICAL MODEL PROPOSAL:** Separate 4 currently-collapsed concepts — PLAN/TIER, TRIAL STATUS, SUBSCRIPTION STATUS (doesn't exist today), EFFECTIVE ENTITLEMENT (always derived, never stored). `business_settings.plan`/`trial_ends_at` should **remain** (works, DB-enforced) and be **extended** with a parallel subscription axis, not superseded.

**SINGLE RESOLVER RECOMMENDATION:** Keep `computeEffectivePlan()` exactly as-is (narrow, correct, DB-enforced) for the trial axis. Add a new thin wrapper (conceptually `resolveAccountEntitlement()`) composing it with the new subscription axis + a plan catalog, returning one structured object every consumer reads from — directly retires the Admin bug above without a big-bang rewrite.

**LEGACY/MIGRATION RISKS:** Existing active/expired trials migrate unchanged. **The FREE-vs-Lifetime classification risk is real**: a row with `plan:'free', trial_ends_at:null` cannot be safely auto-classified after the fact (self-cancel and admin-Lifetime produce the identical shape) — migration requires a manual Owner-supplied list of genuine Lifetime grants; everything else defaults to genuine self-cancel FREE. No data mutation performed or proposed.

**REQUIRED STATE-TRANSITION TEST MATRIX:** Cross {trial states} × {subscription states} × {tier} × {HE,EN} × {Desktop,Mobile} × {badge, Admin display, notice, feature-gate, quote-limit}. Highest-priority test: assert Dashboard-badge === Admin-display === feature-access agree for every one of the 29 lifecycle states — the exact class of bug already found live.

---

## FUTURE PLAN EXTENSIBILITY: FAIL

**NEW PLAN ADDITION REQUIRES:** multiple scattered code changes, not one centralized extension.

**HARDCODED PLAN COUPLING FOUND:** `planEntitlements.js:48-64`, `Dashboard.jsx:1729` (display limit) and `:2026` (enforcement limit, a second independent copy), `AdminUsersTab.jsx:708-717,954-960`, `UserDetailsModal.jsx:105` — 6+ call sites, each with its own `plan === 'x'` ternary/if-chain, none reading from a shared table. RLS INSERT policy is a 7th, unavoidable DB-level literal.

**RECOMMENDED PLAN CATALOG MODEL:** A single in-code `planCatalog.js` object keyed by stable internal plan ID (never display name), each entry carrying `{monthlyQuoteLimit, attachments, whatsappDelete, editDuplicate, sellable, hidden}`. Every current hand-written branch becomes `catalog[tier].<field>`. A new tier becomes one catalog entry.

**BACKWARD-COMPATIBILITY STRATEGY:** Existing `plan` values become catalog keys unchanged — zero migration for existing rows. `sellable:false`/`hidden:true` flags support future-reserved/grandfathered tiers without schema change. Resolver must fall back to `free` for any unknown/removed plan value rather than throwing.

---

## CANONICAL TEST PERSONA MATRIX

8 personas: LOCAL/HE and INTERNATIONAL/EN × {Active Trial, Trial Expired→FREE, Purchased BASIC, Purchased PRO}.

**HE/EN TEST COVERAGE:** Every state duplicated per market — `country` is fully orthogonal to subscription state, so a state bug could hide behind a market bug (or vice versa) if only tested once.

**HOW TEST STATES WILL BE CREATED SAFELY (proposal only):** Active Trial = normal TEST signup (as today). Expired = super_admin-authenticated `trial_ends_at` update to a past date — already permitted by the DB trigger, no new capability needed. **Purchased BASIC/PRO (4 of 8 personas) are currently unbuildable even for TEST purposes** — no path exists to set `plan:'basic'` for a non-super_admin caller by design (same RLS restriction found above) — blocked on real billing or an explicit Owner-authorized super_admin TEST-grant path.

**PRODUCTION CUSTOMER IMPACT:** NONE — proposal only, no TEST user created or mutated.

---

## FULL TESTS: 111/111 PASS (unchanged)
## LINT: PASS (0 errors, 1 pre-existing unrelated warning)
## BUILD: PASS

## DB MUTATION: NONE
## SUPABASE MUTATION: NONE
## AUTH MUTATION: NONE
## APPLICATION COMMIT: NONE
## APPLICATION PUSH: NONE
## PRODUCTION: UNCHANGED

`git rev-parse HEAD` = `5f658f3f5b59207933e4053d8b5484b4a27e41a7` (unchanged); `origin/main` = `e03001745859ae6b81f162a4af5bdca3c95cac5a` (unchanged).

---

## OWNER DECISIONS STILL REQUIRED

1. Upgrade/downgrade timing semantics — immediate vs. deferred-to-period-end, especially downgrades.
2. Length of the payment-failed/past-due grace period before forced downgrade.
3. Whether admin-granted Lifetime PRO remains supported once real billing exists.
4. Who backfills the manual "genuine Lifetime grant vs. self-cancelled FREE" classification list — the codebase cannot reconstruct this after the fact.
5. Whether/when to authorize a super_admin-only TEST-grant path so the 4 blocked BASIC/PRO TEST personas become buildable before real billing exists.

---

## FINAL STOP

Part A implemented and live-verified (0px shift maintained across all 4 combinations, expired message corrected). Part B is findings and a proposal only — no subscription architecture, billing, Admin, or package-badge implementation has begun. Returned to Owner + ChatGPT before any such implementation.
