# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Complete Subscription Foundation Audit + Email Reminder Verification + Permanent Continuity Auto-Sync Rule

**EFFORT LEVEL: HIGH.** Full detail in `PROFLOW_PROJECT_CONTEXT.md` §92 (and §17.K for the new permanent continuity rule). Continues directly from §91/§18.EC — not restarted. Zero code touched this task.

---

**OWNER DECISIONS INCORPORATED:** PASS — BASIC sellable (₪0/₪49/₪99 unchanged), upgrade immediate on payment, downgrade deferred to `current_period_end`, cancellation = `CANCEL_AT_PERIOD_END`, expired-trial message finalized, Active Trial distinct from paid PRO (future `TRIAL` badge) — all incorporated into the architecture proposal only, zero implementation.

---

## EMAIL REMINDER AUDIT

**TRIAL FUNCTION:** `supabase/functions/send-trial-expiration-email/index.ts`

**TRIAL 3-DAY REMINDER:** BROKEN
**TRIAL 24H REMINDER:** BROKEN

Root cause, newly found this task, `index.ts:242`: `if ((biz.plan || 'free').toLowerCase() !== 'free') continue;` — skips any candidate whose raw `plan` isn't `'free'`. A genuine trial signup's raw `plan` is always `'pro'` (written at signup alongside `trial_ends_at`, never mutated mid-trial) — so this filter excludes essentially every real trial user, independent of the scheduler question below.

**SUBSCRIPTION FUNCTION:** `supabase/functions/send-subscription-expiration-email/index.ts`

**SUBSCRIPTION 3-DAY REMINDER:** BLOCKED
**SUBSCRIPTION 24H REMINDER:** BLOCKED

Re-confirmed from §91: `.select()` (line 230) queries `subscription_ends_at`, `subscription_reminder_3d_sent`, `subscription_reminder_24h_sent` — none exist in the live-production schema; this query would fail whenever the batch path executes. Even if fixed, no real BASIC/PRO subscription row with a populated `subscription_ends_at` can exist today (no billing integration writes it).

**SCHEDULER:** No Vercel `crons` entry in `vercel.json`; no `.github/` directory exists at all (no GitHub Actions). A `pg_cron` job or fully external scheduler could not be confirmed or ruled out from available read-only evidence — direct Postgres-level `cron.job` inspection was not attempted (out of proportion for this audit). **Reported as UNKNOWN, not guessed.**

**TEST DEPLOYMENT:** Neither function is deployed to the TEST project (`ljfizgrdyzxddswcedwr`) — verified via `supabase functions list`; only `get-public-quote`/`send-quote-email` exist there.

**PRODUCTION DEPLOYMENT:** Both functions are genuinely deployed and `ACTIVE` in Production (`ixabnzhjeqevtbhdfswv`) — `send-trial-expiration-email` v9, `send-subscription-expiration-email` v8, verified via `supabase functions list` (read-only, not inferred from repo presence).

**EMAIL PROVIDER CONFIG:** Production has `CRON_SECRET`, `RESEND_API_KEY`, and `RESEND_WEBHOOK_SECRET` all configured (verified via `supabase secrets list` — names/update-timestamps/digests only, no raw value ever displayed or logged). TEST has none of the three (only the standard Supabase-managed keys).

**HE TEMPLATE:** PASS
**EN TEMPLATE:** PASS

Both functions branch `isHebrew = (biz.country || 'Local') !== 'International'` — the account's own stored market, never locale/display text — with fully separate subject/HTML/plain-text and correct sender address per branch. No mixed-language fallback found.

**DUPLICATE PROTECTION:** Correct by design for sequential execution — per-stage boolean flags (`*_reminder_3d_sent`/`*_reminder_24h_sent`) set immediately after send, excluded from the next batch query once both are true. **Disclosed, unevidenced gap**: no row lock/idempotency key — two genuinely overlapping concurrent invocations of the same endpoint could theoretically double-send before either `.update()` completes. No evidence any overlapping-invocation mechanism actually exists.

**EMAIL STATE MATRIX:**

| State | Expected | Current |
|---|---|---|
| Active Trial, 4d left | none | PASS |
| Active Trial, 3d window | reminder once | **BROKEN** (plan-filter bug) |
| Active Trial, 24h window | reminder once | **BROKEN** (same) |
| Expired Trial | none | PASS (in-app expired message is separate, working, already-verified) |
| Paid BASIC/PRO, >3d left | none | true, but only because the pipeline can't function at all |
| Paid BASIC/PRO, 3d window | reminder once | **BLOCKED** (missing columns + no real subscriptions exist) |
| Paid BASIC/PRO, 24h window | reminder once | **BLOCKED** (same) |
| CANCEL_AT_PERIOD_END | analyzed | No concept exists today. **Genuine open decision, not invented**: should this state get the existing "renew now" copy (illogical) or distinct copy? |
| FREE | none | PASS — subscription function's plan filter correctly excludes FREE |

**SAFE TEST STRATEGY:** Both functions already support `mode:'test'` (super_admin-authenticated, or one of two hardcoded TEST-bypass emails — the real inboxes behind `PROFLOW_TEST_LOCAL`/`PROFLOW_TEST_INTL`) — sends one genuine email to a genuine TEST inbox without touching the batch/cron path or real customer rows/flags. **Not invoked this task** (zero emails sent, per explicit scope) — documented as the mechanism for a future, separately-authorized verification task.

**ADMIN FREE→LIFETIME BUG:** OPEN (unfixed, per explicit instruction — intended fix point is the future canonical resolver, not a targeted patch now).

---

## FUTURE PLAN EXTENSIBILITY

**Updated recommendation**: plan-catalog proposal from §91 reconfirmed, refined with a new **centralized/versionable pricing catalog** (per a mid-task Owner addendum) — plan **identity** (stable internal ID) fully decoupled from plan **pricing** (a separate catalog keyed by `{planId, currency, billingCycle}` → `{amount, providerPriceId, effectiveFrom, sellable, hidden}`). A price change, new currency, or sale/hidden price becomes a new price-catalog row, never an edit to entitlement/badge/plan-catalog logic; an existing subscriber's grandfathered price stays referenced by their specific historical price-catalog entry.

**CANONICAL TEST PERSONAS:** PRESERVED — same 8 personas (HE×4 + EN×4: Active Trial / Expired→FREE / Purchased BASIC / Purchased PRO), explicitly extensible to cancel-at-period-end/payment-failed/upgrade/downgrade/reconciliation states matching the now-closed timing decisions. The 4 BASIC/PRO-purchased personas remain unbuildable even for TEST purposes (same DB-level RLS restriction, unchanged since no schema/code was touched this task). **Zero TEST users created or mutated.**

---

## REMAINING OWNER DECISIONS

Re-evaluated in light of the now-closed items — only genuinely unresolved:
1. Payment-failed/past-due grace-period length before forced downgrade.
2. Whether admin-granted Lifetime PRO remains supported once real billing exists.
3. Who backfills the historical "genuine Lifetime grant vs. self-cancelled FREE" classification — the codebase cannot reconstruct this after the fact.
4. Whether/when to authorize a super_admin TEST-grant path for the 4 blocked BASIC/PRO TEST personas.
5. **New, surfaced this task**: the CANCEL_AT_PERIOD_END reminder-email copy question above.

---

## CONTINUITY AUTO-SYNC RULE: DOCUMENTED

New permanent rule at `PROFLOW_PROJECT_CONTEXT.md` §17.K: standing Owner authorization for Claude to auto-push documentation-only `proflow-continuity` commits without a fresh per-task push confirmation — strictly scoped to that branch/those six files. Does **not** extend to `main`, application code, TEST/DB/Supabase/Auth, or Production/deploy — all unchanged, still gated exactly as before. This task's own continuity commit uses that authorization for the first time.

## SIX-FILE CONTINUITY LEDGER

- `PROFLOW_PROJECT_CONTEXT.md` — §17.K (new permanent auto-sync rule) + §92 (this task's full findings) added.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, prior paragraph demoted to HISTORICAL.
- `PROFLOW_ARCHITECTURE.md` — §16 (Trial/Plans/Billing) extended with the closed decisions, canonical model pointer, and the three confirmed live bugs.
- `PROFLOW_HANDOFF.md` — §18.ED appended.
- `PROFLOW_TODO.md` — item 38 extended with this task's summary and remaining decisions.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

---

## APPLICATION CODE MUTATION: NONE
## DB MUTATION: NONE
## SUPABASE/AUTH MUTATION: NONE
## EMAIL SENT: NONE
## APPLICATION COMMIT: NONE
## APPLICATION PUSH: NONE
## MAIN: UNCHANGED
## PRODUCTION: UNCHANGED

`git rev-parse HEAD` = `5f658f3f5b59207933e4053d8b5484b4a27e41a7` (unchanged); `origin/main` = `e03001745859ae6b81f162a4af5bdca3c95cac5a` (unchanged). Full suite 111/111 (unchanged, zero source files touched this task).

---

## FINAL STOP

Six Owner decisions closed and incorporated into the architecture proposal. Email-reminder pipeline audited end-to-end, read-only — found one new high-impact bug (trial-reminder plan filter) plus re-confirmed one previously-found bug (subscription-reminder missing columns); zero emails sent. New permanent continuity auto-sync rule documented and exercised for the first time on this very commit. Returning to Owner + ChatGPT.
