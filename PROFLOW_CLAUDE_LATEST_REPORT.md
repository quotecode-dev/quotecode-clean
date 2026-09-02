# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Plan Identity & Entitlements Architecture — Investigation + Proposal

**DOCUMENTATION / ARCHITECTURE PLANNING ONLY. No application code edit, no DB/schema change, no migration, no TEST/Production mutation, no customer/account/subscription/trial data touched, no commit/push/deploy of application code, no LIVE action.**

---

## 1. Continuity / Fresh Local State

`origin/main`=`26dee96` (unchanged throughout). Local `main` carries one still-unpushed, unrelated application commit from the immediately preceding task (`ProfessionalPublicPreview.jsx`, §146) — confirmed via `git diff --stat` before and after this task that it remains exactly as it was, untouched. Working tree clean besides the standing untracked `entry-server.jsx`. No unrelated work was modified.

## 2. Current implementation (read fresh from source this task)

- **Plan identity today**: `business_settings.plan` (`free`/`basic`/`pro`) + `business_settings.trial_ends_at` (nullable timestamp) + `role`. No explicit Lifetime field exists.
- **Trial today**: `computeEffectivePlan()` (`src/utils/planEntitlements.js`) is the single formula — `plan==='pro'` + a real, still-future `trial_ends_at` → `effectivePlan:'pro'` (active trial); the same shape but past → `effectivePlan:'free'` (expired, the already-fixed regression case); `trial_ends_at===null` → `effectivePlan:'pro'` unconditionally (Lifetime-grant or explicit super_admin assignment, never re-evaluated as a trial).
- **Entitlements today**: `PLAN_CATALOG` (`src/utils/planCatalog.js`) — `free`/`basic`/`pro` only, each carrying `monthlyQuoteLimit`/`editDuplicate`/`whatsappDelete`/`attachments`. TRIAL is explicitly modeled as a **badge-state overlay**, never a catalog entry — already matches the Owner's own required conceptual model.
- **`resolveAccountEntitlement()`** (`src/utils/accountEntitlement.js`) composes the above into `{tier, rawPlan, isLifetime, trialStatus, badgeState, entitlement}` — `isLifetime` is **inferred** (`trial_ends_at IS NULL && plan!=='free'`), not stored.
- **Admin**: `AdminUsersTab.jsx`/`UserDetailsModal.jsx` both call `resolveAccountEntitlement()` — the more-complete side of the current gap.
- **User-facing UI**: `Dashboard.jsx` calls `computeEffectivePlan()` directly (not the higher-level resolver), deriving its own local `isPro`/`isBasicOrAbove` — never computes `isLifetime` or `badgeState`. `SettingsTab.jsx` receives `effectivePlan` as a prop and renders `{effectivePlan} PLAN` literally.
- **Lifetime today**: an admin-only toggle (`handleToggleLifetime`, in both `AdminUsersTab.jsx` and `Dashboard.jsx`) that only ever writes `trial_ends_at` (`null` = lifetime, `+14d` = restore trial) — never touches `plan`.
- **Upgrade CTA today**: `Dashboard.jsx:3011` — correctly gated (`!isPro && !isSuperAdmin`), hides for PRO/Lifetime/active-trial alike. `SettingsTab.jsx:308-311` — **unconditional**, shown to every account including Lifetime and ordinary PRO. Two different rules for the same concept, found fresh this task, not previously documented this precisely.

## 3. Gap analysis (FREE / FREE (TRIAL) / BASIC / PRO / LIFETIME, identity vs. entitlement)

Full table: `PROFLOW_PROJECT_CONTEXT.md` §147.2. Summary: FREE and BASIC are already clean, unambiguous identities. PRO's entitlement is clean but has no user-facing distinction from Lifetime. **FREE (TRIAL)**'s identity/entitlement separation already exists conceptually inside `resolveAccountEntitlement()` — the gap is that `Dashboard.jsx` never reaches that function. **LIFETIME is the core gap** — no stored identity anywhere, inferred from an overloaded field, with one already-source-documented ambiguity (`plan='free'+trial_ends_at=null` cannot currently distinguish self-cancel from a rare Lifetime-onto-FREE grant).

## 4. Professional Quotes impact + David Aluminum / A100700

Professional Quotes (`professionalPreviewAllowlist.js`) has **zero connection** to the plan system today — a pure hardcoded user-id gate. Trial-to-PRO capability inheritance, and its automatic withdrawal on expiry, would require **zero new trial-specific code** if a future `professionalQuotes` flag is added to `PLAN_CATALOG` — the existing `computeEffectivePlan()` mechanism already handles this transparently for every existing capability flag. Preserving historical/already-created quote content against a later entitlement change is flagged as a **new, currently-unaddressed risk surface**, with a recommendation (not a decision) to mirror the existing Quote Currency Freeze principle — snapshot at creation, never re-gate display against current entitlement. David Aluminum remains the intended real target for the finished feature, migrated on once the numbering (`A100700`+) and the architecture are both ready and Owner-approved — **not authorized to begin now, and not touched this task.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §147.3.

## 5. Proposed architecture (smallest safe extension — not implemented)

1. Explicit, durable Lifetime schema field, replacing the current inference.
2. `Dashboard.jsx` migrated to `resolveAccountEntitlement()`.
3. One centralized HE/EN label-resolution helper for all five identities, replacing ad hoc string interpolation.
4. Reconcile the two inconsistent Upgrade CTAs onto one shared visibility rule; reconsider "Cancel Subscription" wording for Lifetime.
5. `professionalQuotes` capability flag added to `PLAN_CATALOG` (tier assignment pending Owner decision), reusing the existing flag pattern.
6. David Aluminum migrated onto the real feature only after 1-5 ship and are Owner-approved.

Full detail: `PROFLOW_PROJECT_CONTEXT.md` §147.4. None of the above implemented, scheduled, or authorized by this report.

## 6. File-by-File Ledger (future implementation — not touched this task)

Full 10-row table at `PROFLOW_PROJECT_CONTEXT.md` §147.5, covering: `business_settings` (DB), `guard_business_settings_plan_trial` (trigger), `planEntitlements.js`, `accountEntitlement.js`, `planCatalog.js`, `Dashboard.jsx`, `SettingsTab.jsx`, `PricingModal.jsx`, `AdminUsersTab.jsx`/`UserDetailsModal.jsx`, `professionalPreviewAllowlist.js` + the two Item 30.E preview routes — each with HE/EN classification, current responsibility, why a change would eventually be needed, regression risk, and TEST/Production implications. No file in this list was modified this task.

## 7. Risks

Trial reset/extension regression (zero trial mutation performed this task, consistent with the standing safety-sensitive treatment); existing paid/Lifetime users (any future schema field must backfill from exactly the current, already-correct inference, proven to reclassify zero accounts); the already-disclosed `free`+`null` ambiguity (a rare case requiring manual audit before any future backfill); historical/finalized/signed quotes (new principle recommended, not yet enforced anywhere); HE/EN symmetry (both `Dashboard.jsx`/`SettingsTab.jsx` are shared `BOTH`-classified components — any label helper must supply all five identities in both languages from day one); Local/International separation (plan identity is explicitly orthogonal to market, per the Iron Rule); Production/customer impact (any DB-field step is the highest-risk single step, requiring its own separate, explicit Owner DB-change authorization independent of this task's own read-only one). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §147.6.

## 8. Implementation plan (staged proposal only — not executed)

Stage 0 (already done): existing centralization. Stage 1 (lowest risk, no schema change): `Dashboard.jsx` migration + label helper + CTA reconciliation. Stage 2 (highest risk, schema change): explicit Lifetime field, backfilled and TEST-first migrated. Stage 3: `professionalQuotes` flag + real (non-David) entry point. Stage 4: David Aluminum migration. Each stage requires its own separate Owner authorization to begin — none granted by this report. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §147.7.

## 9. Test plan

Six-persona (FREE / FREE-TRIAL-active / FREE-TRIAL-expired / BASIC / PRO / LIFETIME) × HE/EN × Professional Quotes × Admin display × user-facing display × entitlement checks × Upgrade CTA matrix recorded at `PROFLOW_PROJECT_CONTEXT.md` §147.8 — **not executed**, for whichever stage is eventually authorized.

## 10. Continuity update — exactly what was written

- `PROFLOW_PROJECT_CONTEXT.md` — **UPDATED**: new §147 (10 subsections — fresh state, current implementation, gap analysis, Professional Quotes impact, proposed architecture, File-by-File Ledger, risks, staged plan, test matrix, release boundary).
- `PROFLOW_TODO.md` — **UPDATED**: item 28 expanded from its narrow original scope ("small plan label") into this full architecture record, preserving the original requirement; item 30's own entry given a short cross-reference addendum recording the Professional Quotes ↔ plan-identity relationship.
- `PROFLOW_HANDOFF.md` — **UPDATED**: new §18.GS entry.
- `PROFLOW_CHAT_HANDOFF.md` — **UPDATED**: §14, new lead paragraph.
- `PROFLOW_ARCHITECTURE.md` — **UPDATED**: a short forward-pointer added at the end of its existing §16 (Trial/Plans/Billing) section.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — **UPDATED**: this file.

All six committed to local `main` and pushed to `proflow-continuity` only (see SHA/read-back below) — **not** pushed to `origin/main`, since none of this task's changes are application code.

## 11. Next authorization required

Any of the following would each require its own **separate, explicit** Owner authorization before Claude may begin:
- **Stage 1** (`Dashboard.jsx` → canonical resolver, label helper, CTA reconciliation) — application code, no schema change, lowest risk.
- **Stage 2** (explicit Lifetime schema field + backfill + migration) — DB/schema change, highest risk, requires its own dedicated TEST-first migration authorization per the standing DB-safety rules, fully separate from Stage 1.
- **Stage 3** (`professionalQuotes` capability flag + real entry point) — requires an Owner decision on exactly which plan tiers receive Professional Quotes, which this report explicitly did not guess.
- **Stage 4** (David Aluminum migration) — requires Stages 1-3 live and Owner-approved, plus the separate, already-existing quote-numbering (`A100700`+) migration work to be ready for his account.

**None of the above is authorized by this task.** This task's own scope ends at investigation, proposal, and continuity recording.

---

## Continuity commit SHA + remote read-back

*Filled in by the SHA-follow-up commit, per this project's standing two-commit convention.*

---

INVESTIGATION: COMPLETE (read-only)
GAP ANALYSIS: COMPLETE
PROPOSED ARCHITECTURE: RECORDED, NOT IMPLEMENTED
FILE-BY-FILE LEDGER: COMPLETE (future scope, nothing touched)
RISKS: DOCUMENTED
IMPLEMENTATION PLAN: STAGED PROPOSAL ONLY, NOT EXECUTED
TEST PLAN: RECORDED, NOT EXECUTED
DAVID ALUMINUM: UNTOUCHED — ZERO DB/PRODUCTION/CUSTOMER-DATA ACTION
APPLICATION CODE: UNCHANGED THIS TASK
DATABASE: UNCHANGED
TEST: UNCHANGED
PRODUCTION: UNCHANGED
COMMIT: DOCUMENTATION ONLY (application code untouched this task)
PUSH: proflow-continuity ONLY
DEPLOY: NONE
LIVE ACTION: NONE
NEXT AUTHORIZATION REQUIRED: Stage 1 (app code) / Stage 2 (DB schema) / Stage 3 (Owner tier decision) / Stage 4 (David migration) — each separate
WAITING FOR OWNER + CHATGPT REVIEW
