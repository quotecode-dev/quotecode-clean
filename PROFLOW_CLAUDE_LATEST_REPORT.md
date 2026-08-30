# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: TEST Subscription Personas — Audit + Safe Creation Plan Only

**Effort level**: HIGH. **Owner-authorized, AUDIT + PLAN ONLY.** Not authorized: TEST user creation, TEST subscription mutation, any application-code change, Item 28 implementation, Admin work, Production action.

## 1. Fresh Local State

`main` `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged throughout — this task made zero application-code changes. Supabase CLI remained linked to Production (`ixabnzhjeqevtbhdfswv`, safe default) for the entire task; the one TEST-specific check performed (see §4 below) was a direct read-only REST call using TEST's own anon key, not a CLI relink.

## 2. Plan / Trial / Subscription — Source of Truth

- **Plan**: `business_settings.plan` (`text DEFAULT 'free'`); observed values `'free'`/`'basic'`/`'pro'` only.
- **Trial**: `business_settings.trial_ends_at` (`timestamptz`, nullable) — the only trial field; `trial_reminder_sent`/`trial_reminder_3d_sent`/`trial_reminder_24h_sent` are one-shot email-dedup flags, not state.
- **Subscription status**: **no column exists.** No billing-provider identifier of any kind exists anywhere in the schema. `PricingModal.jsx`'s own code comment confirms real Stripe checkout is "not yet connected" — its `handleSelectPlan` only shows an informational modal, never mutates `plan`.

## 3. Plan Write Sites — Exhaustive

A repo-wide grep for `plan:\s*'` across `src/` and `supabase/` found **exactly two** write sites for `business_settings.plan` in the entire codebase:
1. Signup (`Dashboard.jsx` ~line 852): `plan: 'pro'`, `trial_ends_at: now + 14 days`.
2. Self-cancellation (`PricingModal.jsx` ~line 77): `plan: 'free'`, `trial_ends_at: null`.

**No automatic trial-to-free downgrade exists anywhere** — no cron, scheduled Edge Function, or DB trigger ever changes `plan` back to `'free'` when `trial_ends_at` passes. `send-trial-expiration-email` only sends reminder emails; it never mutates `plan`.

## 4. Real, Disclosed Findings (High-Risk Area, As Instructed)

### 4.1 Trial-expiration does not currently demote access

`Dashboard.jsx`'s `effectivePlan` formula:
```js
const effectivePlan = (rawPlan === 'pro' || rawPlan === 'basic')
  ? rawPlan
  : (trialEndsAt && !isTrialExpired ? 'pro' : 'free');
```
resolves to `'pro'` unconditionally whenever the raw `plan` is `'pro'` — **regardless of `isTrialExpired`.** Since every real signup writes `plan:'pro'` and nothing ever reverts it, a real user who lets their 14-day trial lapse **without** explicitly cancelling keeps full PRO access indefinitely under the current live code. This contradicts: the Dashboard's own trial-expired banner ("moved to the FREE tier"), the trial-reminder email's copy ("moves automatically to the Free plan"), and an existing code comment in `AdminUsersTab.jsx` asserting `effectivePlan` already treats an expired trial as free. The formula's own comment reveals the intended design (plan should stay `'free'` during a trial, with `trial_ends_at` alone granting temporary PRO) was never matched by the actual signup code. **Not fixed — disclosed only, per this audit-only task's scope.**

### 4.2 `subscription_ends_at` does not exist

`send-subscription-expiration-email` references `business_settings.subscription_ends_at` in its batch query. A live read-only REST check against `quotecode-test` —
```
GET .../rest/v1/business_settings?select=subscription_ends_at&limit=0
→ HTTP 400: {"code":"42703","message":"column business_settings.subscription_ends_at does not exist"}
```
confirms this column does not exist (consistent with its absence from the Phase-1 base-schema capture, taken directly from live Production). **This function would error if ever invoked in batch mode.** Flagged, not fixed.

### 4.3 DB-level mutation guards (confirmed via migration + trigger source)

- An `AS RESTRICTIVE` RLS INSERT policy on `business_settings` permits a normal signup row **only** as `plan='free'∧trial_ends_at IS NULL` or `plan='pro'∧trial_ends_at` within ±2h of "now+14 days" — `'basic'` can never be created at signup.
- A `BEFORE UPDATE` trigger `guard_business_settings_plan_trial()` blocks any `plan`/`trial_ends_at` change unless the **calling user's own** `role='super_admin'`, or the new values are exactly the self-cancel pair. This fires regardless of RLS bypass — a service-role call carries no `auth.uid()`, so it is **also** blocked unless it matches the self-cancel exception.
- **Conclusion**: any TEST persona needing `'basic'`, a custom/past `trial_ends_at`, or non-fresh `'pro'` requires either a genuine `super_admin`-authenticated UPDATE, or a Postgres-superuser session with a temporary trigger bypass for that single transaction.

## 5. Feature Entitlements

`handleProtectedAction` (`Dashboard.jsx`) gates: Edit/Duplicate require `isBasicOrAbove`; WhatsApp-send/Delete require `isPro`; a 5/20/∞ monthly quote-creation limit applies for FREE/BASIC/PRO. **All frontend-only** — no RLS policy or Edge Function found that independently re-enforces any of this. Active-trial users receive the full PRO feature set (`effectivePlan` resolves to `'pro'` during an active trial).

## 6. Market Isolation

`business_settings.country` is fully independent from `plan`/`trial_ends_at` — neither the RLS INSERT policy nor the UPDATE trigger references `country`. Plan/trial state cannot alter market identity.

## 7. Recommended Persona Model

A **hybrid**, not pure account-switching: reaching 6 of the 8 target states already requires a privileged UPDATE regardless of account count, so sharing one switched account buys no safety and repeats this project's own previously-disclosed Trial-reset regression risk. Recommendation:
- **Reuse unchanged**: the two existing TEST accounts already are, by construction, "FREE + Active Trial" for each market.
- **Create, once separately authorized**: six new accounts (3 additional states × 2 markets), each set to its final state exactly once (genuine signup, then — where needed — one super_admin-authenticated UPDATE), never toggled back and forth.

Full persona list, per-persona mutation plan, the Trial-Ended persona's specific honest representation, the BASIC/PRO billing-state finding, and the ENV-naming recommendation are all recorded in full detail in `PROFLOW_PROJECT_CONTEXT.md` §50 (not duplicated here to avoid drift between the two documents).

## 8. Item 28 Readiness

The future Plan-Identity UI can safely consume `effectivePlan` (or its two raw inputs) to distinguish FREE+Trial-Active / FREE+Trial-Ended(self-cancelled) / BASIC / PRO **without inventing a new plan value** — fully consistent with the standing Plan/Trial-State-separation decision. The §4.1 gap (naturally-lapsed trials don't currently demote) is a disclosed pre-existing product question for the Owner, not something Item 28's UI work is expected to silently resolve.

## 9. New Documentation-Only TODO Items

- `PROFLOW_TODO.md` item 30 — Industry/Measurement/Pricing Engine (presets as recommendations not locks, Metric/Imperial/Mixed units never tied to language/market/currency, explicit snapshot/conversion architecture, full design/audit required before implementation) + §30.A — AI Chat awareness of the same future profile (must never invent units/formulas/business rules).
- `PROFLOW_TODO.md` item 31 — Additional Notes future 3-column desktop display with automatic numbering, single-column-safe mobile, backward compatible with today's single unstructured text block (confirmed via audit: `quote.notes`, `white-space: pre-wrap`, no existing structured list).

Both are documentation-only; no design or implementation work was performed or authorized.

## Continuity Sync + Remote Read-Back

This task's six-file updates were synced through the existing §17.J mechanism (isolated `quotecode-saas-continuity` worktree → secret/privacy scan → explicit filename staging, never `git add -A` → commit → push `proflow-continuity` only), followed by genuine remote GitHub read-back verification via the `api.github.com` Contents API.

## Final Verdict

**TEST SUBSCRIPTION PERSONAS AUDIT: PASS**

- `PLAN SOURCE OF TRUTH`: `business_settings.plan` (text, `'free'`/`'basic'`/`'pro'`), two write sites only (signup, self-cancel).
- `TRIAL SOURCE OF TRUTH`: `business_settings.trial_ends_at` (timestamptz, nullable), no separate trial-start field.
- `SUBSCRIPTION STATUS SOURCE OF TRUTH`: does not exist — no column, no billing-provider integration; `subscription_ends_at` referenced by an Edge Function but confirmed absent from the live schema.
- `FEATURE ENTITLEMENTS`: real but frontend-only (`isBasicOrAbove`/`isPro` gates, 5/20/∞ quote limits); no backend/RLS re-enforcement found.
- `TRIAL RESET RISK`: confirmed real, disclosed gap — a naturally-lapsed, never-cancelled trial currently keeps full PRO access indefinitely (`effectivePlan` never naturally reaches `'free'`); not fixed, audit-only.
- `RECOMMENDED PERSONA MODEL`: hybrid — reuse the 2 existing accounts unchanged for Active-Trial, create 6 new accounts for the remaining states, each set once (no toggling).
- `LOCAL PERSONAS`: reuse existing (Active Trial), + 3 new (Trial-Ended/self-cancelled, BASIC, PRO-paid).
- `INTERNATIONAL PERSONAS`: identical 4-state set, mirrored.
- `SAFE CREATION PLAN`: genuine signup via Admin API + the app's own real UI (region selection, cancel-subscription) for every reachable state; a super_admin-authenticated UPDATE (or documented Postgres trigger-bypass) only for BASIC/PRO/custom-trial states — no execution this task.
- `ENV STRATEGY`: extend `PROFLOW_TEST_<MARKET>_<FIELD>` with a persona-state suffix (e.g. `PROFLOW_TEST_LOCAL_BASIC_EMAIL`/`_PASSWORD`) — names only, nothing added this task.
- `ITEM 28 READINESS: PASS` — `effectivePlan` is a safe, sufficient source of truth; no new plan value needed.
- `INDUSTRY/MEASUREMENT TODO DOCUMENTED: PASS` — `PROFLOW_TODO.md` item 30.
- `AI CHAT AWARENESS DOCUMENTED: PASS` — `PROFLOW_TODO.md` item 30.A.
- `ADDITIONAL NOTES 3-COLUMN REQUIREMENT DOCUMENTED: PASS` — `PROFLOW_TODO.md` item 31.
- `REMOTE CONTINUITY READ-BACK: PASS`.

**NO TEST user creation. NO TEST subscription mutation. NO application-code changes. NO Item 28 implementation. NO Admin work. NO Production mutation. NO application commit/push/deploy. NO LIVE action.**

**Awaiting Owner + ChatGPT review.**
