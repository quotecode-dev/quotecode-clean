# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Subscription Email Policy Correction + Trial Countdown Audit + Sandbox Billing Requirement

Full detail in `PROFLOW_PROJECT_CONTEXT.md` §93. No application commit, no push, no DB/Auth/Production mutation.

---

**PAID AUTO-RENEW EXPIRATION EMAIL:** DISABLED BY PRODUCT POLICY — auto-renewing BASIC/PRO must never receive a "subscription ending" reminder at a normal monthly `current_period_end`; that boundary is a renewal, not an expiration.

**CANCEL_AT_PERIOD_END REMINDERS:** REQUIRED — 3-day and 24-hour reminders are appropriate here specifically, since entitlement is genuinely ending. Exact copy not finalized this task (none was pre-approved) — remains open.

**TRIAL 3-DAY REMINDER:** REQUIRED
**TRIAL 24H REMINDER:** REQUIRED

Unchanged and fully mandatory. The plan-filter bug in `send-trial-expiration-email` (found last task) **remains open, deliberately not fixed** per instruction.

**PAYMENT-FAILURE EMAIL:** SEPARATE FLOW — not an expiration-reminder mechanism; tied to the still-open grace-period-length decision.

**OLD CONTRADICTORY EMAIL REQUIREMENT:** RECONCILED — `PROFLOW_PROJECT_CONTEXT.md` §92's Email State Matrix now carries an explicit superseding note pointing to §93, rather than being silently rewritten (preserves the historical record while making the current policy unambiguous).

---

## TRIAL COUNTDOWN AUDIT (read-only, zero mutation)

Real `PROFLOW_TEST_LOCAL` account data, read via its own authenticated session (own-row RLS query, no admin/service-role access used):

**TRIAL CREATED_AT:** `2026-08-30T10:24:52.812Z`
**TRIAL_ENDS_AT:** `2026-09-13T10:24:52.934Z`
**ACTUAL REMAINING** (at audit time, `now = 2026-08-31T07:47:49.293Z`): `13.1091` days = **13 days, 2 hours**

**DASHBOARD COUNTDOWN FORMULA:** `src/utils/planEntitlements.js:42` — `trialDaysLeft = Math.ceil(diffTime / (1000*60*60*24))` → `Math.ceil(13.1091)` = **14**, exactly matching what the Owner observed.

**ADMIN COUNTDOWN FORMULA:** `src/components/AdminUsersTab.jsx:276` (`getRemainingTimeFormatted`) — `days = Math.floor(diffMs/msPerDay)`, `hours = Math.floor(remainder/msPerHour)` → **13 days, 2 hours**, exactly matching the Owner's cited Admin-precision example.

**TRIAL RESET:** NO — `trial_ends_at − created_at` = exactly `14.0000` days, the standard untouched signup grant.

**ROUNDING ISSUE:** YES — pure display-formula discrepancy (`Math.ceil` whole-day vs. `Math.floor`+hours precision). Does not affect entitlement correctness: `isTrialExpired`/`isExpiringSoon` gating logic is unaffected by the ceiling (sign-preserving). This is a display-precision gap only, distinct in kind from the entitlement-affecting bugs found in prior tasks.

**SHARED COUNTDOWN HELPER RECOMMENDATION:** Extract Admin's existing, already-correct day+hour formula into a shared display helper (natural home: alongside `computeEffectivePlan()` in `planEntitlements.js`, e.g. `formatTrialRemaining(trialEndsAt, now)` → `{days, hours}`) that both Dashboard's and Admin's display text call. **Do not touch `computeEffectivePlan()`'s own internal `trialDaysLeft`** — it correctly drives gating logic today; the new helper is for display only, layered alongside it. Not implemented — proposal only, pending separate authorization.

---

## BILLING SANDBOX REQUIREMENT: DOCUMENTED

Permanent requirement recorded in `PROFLOW_PROJECT_CONTEXT.md` §93 and `PROFLOW_ARCHITECTURE.md` §16: full end-to-end TEST simulation at real configured plan prices (never a hidden Production ₪0 plan) covering purchase/renewal/failure/cancellation/upgrade/downgrade/webhook-replay/idempotency/reconciliation — exercising the complete Checkout→webhook→canonical state→resolver→badge→Admin→limits→reminders chain, matching the canonical-resolver architecture already proposed.

---

## SIX-FILE CONTINUITY LEDGER

- `PROFLOW_PROJECT_CONTEXT.md` — §92's Email State Matrix marked superseded; new §93 added (policy correction, countdown audit, sandbox requirement).
- `PROFLOW_ARCHITECTURE.md` — §16 extended: the old unconfirmed "trial resetting" open item **resolved** with the definitive rounding-not-reset finding; email policy correction and Sandbox requirement added.
- `PROFLOW_HANDOFF.md` — §18.EE appended.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, prior paragraph demoted to HISTORICAL (its non-email-policy findings still stand).
- `PROFLOW_TODO.md` — item 38 extended.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

Continuity commit pushed automatically under the standing §17.K auto-sync authorization — no fresh confirmation requested, per explicit instruction.

---

## APPLICATION CODE MUTATION: NONE
## DB MUTATION: NONE
## EMAIL SENT: NONE
## MAIN: UNCHANGED
## PRODUCTION: UNCHANGED

`git rev-parse HEAD` = `5f658f3f5b59207933e4053d8b5484b4a27e41a7` (unchanged); `origin/main` = `e03001745859ae6b81f162a4af5bdca3c95cac5a` (unchanged). Zero application code touched this task — nothing to re-test (tests/lint/build unchanged from last verified state).

---

## FINAL STOP

Email policy corrected and reconciled — auto-renewal is never an expiration event; only CANCEL_AT_PERIOD_END warrants a reminder, copy still pending. Trial countdown discrepancy fully explained: no reset, pure Math.ceil-vs-Math.floor display gap. Billing Sandbox requirement documented as permanent. Continuity synced under the new standing authorization. Returning to Owner.
