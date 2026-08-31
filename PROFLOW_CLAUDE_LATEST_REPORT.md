# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: TEST vs Production Drift / Regression Root-Cause Audit

Continues directly from the Resumed Authenticated Smoke task (`PROFLOW_PROJECT_CONTEXT.md` §112). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §113, `PROFLOW_HANDOFF.md` §18.EZ.

**Strictly read-only. No code, CSS, DB, migration, commit, push, deploy, or mutation of any kind.**

---

## EFFORT: MAXIMUM

## AUDIT TYPE: TEST-vs-PRODUCTION DRIFT / ROOT CAUSE

## CODE CHANGES: NONE
## PRODUCTION MUTATIONS: NONE
## TEST MUTATIONS: NONE

## APPROVED TEST COMMIT: **N/A — no such artifact exists.** "TEST" is the local Vite dev server against `quotecode-test`, serving the live working tree (including uncommitted changes), not a pinned deployment.

## CURRENT ORIGIN/MAIN: `dd110155a927f708f00467e1017bd183582b42aa` (`dd11015`)

## CURRENT PRODUCTION COMMIT: `dd11015` (Vercel auto-deploys `origin/main`)

## TEST DEPLOYED COMMIT: **N/A** (no separate deployment; see above)

## DID APPROVED TEST CODE REACH PRODUCTION: **PARTIALLY**

Frontend/CSS code: **YES**, proven — every implicated file is byte-identical between local `HEAD` and `origin/main`. DB-schema-dependent behavior: **NO** — Item 17/18 migrations were never applied to Production, a long-standing, previously-disclosed, still-open gap.

---

## ROOT CAUSES

**QUOTE NUMBERING**: Production's `quote_number` defaults to `nextval('quotes_quote_number_seq')` — an unrelated, pre-existing global sequence. TEST's `quote_number` has no column default at all; it's populated exclusively by `allocate_quote_number()` (exists on TEST, absent on Production) writing into `business_quote_sequences` (exists on TEST, absent on Production). `formatQuoteNumber()` correctly displays whatever's in the column — the data source underneath, not the display code, differs. **Category G.**

**PUBLIC QUOTE GENERAL LAYOUT**: No single code defect found. The relevant CSS (`.pq-action-tile` etc.) is defined inline in the component's own `<style>` block, byte-identical to Production, with values that read as deliberate. The precise finding instead: `PROFLOW_TODO.md` item 14.A records 13 sequential implementation passes, and every one but one narrow sub-item carries `OWNER FINAL VISUAL ACCEPTANCE: PENDING`. No formally-approved reference state exists to diff the current live state against. **Category I/J.**

**MOBILE HE**: Two distinct causes. (1) "לידי:"/Attn missing — a direct, already-disclosed consequence of the Path B `get-public-quote` deploy, which excludes `attn_name`/`attn_role` because those columns don't exist on Production; affects every Production Public Quote, not Mobile/HE-specific. **Category G.** (2) "Call Me"/quote-number "moved back to header" — `PublicQuoteHeader.jsx`'s Desktop branch received an Owner-requested reorder (info box before CTA); the sibling Mobile branch in the same file never got the equivalent fix, and this is baked into the already-pushed source itself. **Category I.**

**PUBLIC QUOTE EN**: Independently verified, not inferred from HE — `PublicQuoteHeader.jsx` is confirmed the literal same component used by both `PublicQuote.jsx` and `PublicQuoteEn.jsx`. Both HE root causes above apply identically and with the same direct evidence.

**ADMIN**: All four Admin files are byte-identical between `HEAD` and `origin/main` — Production runs one single, fully-committed, fully-pushed version, not a mix of old and new code. The live version is the narrow "Finalize Admin UI redesign" pass (`4088c2c`); the larger "Admin V2" redesign was explicitly design-only, never authorized for implementation (§94.1's own conclusion). **Category I.**

**AI CHAT OVERLAP**: `AIChatWidget.jsx` byte-identical to Production, `position:fixed`/`zIndex:999999` styling traces to a much older base commit predating this entire engagement. No scroll-content padding was ever reserved to clear it. Identical code in both environments — not new drift. **Category H.**

---

## TEST/PROD CONFIG DIFFERENCES

No separate Vercel TEST project/deployment exists (`vercel.json` confirmed single, Production-only config). No environment-variable, hostname, or `NODE_ENV` conditional found in any implicated file. Build command/output unchanged (standard `vite build`, previously re-confirmed). Only proven difference: the two Supabase projects' schemas (documented above).

## LOST/UNPUSHED/OVERWRITTEN WORK

**None found for any file directly implicated in the Owner's reports** — every relevant `origin/main` vs `HEAD` diff is empty. One structural, not file-specific, nuance: because TEST reviews have always served the live working tree (including uncommitted state), a given past review session could have reflected code later superseded before anything was committed (the large `fde680b` bundle commit, which consolidated many previously-uncommitted threads at once, is the clearest precedent already on record). No specific instance of this was proven for the six items audited here.

---

## TEST TRUSTWORTHY AS RELEASE GATE: **PARTIALLY**

Reliable for pure frontend/CSS/component code — proven, no promotion-layer failure found anywhere audited. Not reliable for anything reading/writing real data through DB schema/RPCs — proven divergence (~12 migrations exist on TEST, not Production), and the failure mode is worse than a clean "missing feature": Production silently substitutes unrelated pre-existing data (old quote numbers) or silently omits a UI element (Attn card) rather than erroring, making the gap easy to miss without directly inspecting live data.

---

## ROOT-CAUSE MATRIX

| Item | Root cause | Category |
|---|---|---|
| A. Quote numbering | Item 17 migration/RPC never applied to Production | G |
| B. Public Quote general layout | No code defect; no formally-approved reference state exists | I/J |
| C. HE Mobile — Attn missing | Direct, disclosed Path B consequence | G |
| C. HE Mobile — CTA/number order | Desktop-only fix, Mobile branch never updated | I |
| D. EN Public Quote | Same as C, independently confirmed | G + I |
| E. Admin | Narrow redesign live and consistent; large redesign never built | I |
| F. AI Chat overlap | Long-standing, identical in both environments | H |

## GIT/PROMOTION TIMELINE (key items)

| Change | TEST commit | Main commit | Production status | Current status | Why different |
|---|---|---|---|---|---|
| Item 17 numbering scheme | N/A (DB-only, applied directly to TEST) | Display code in `ffc741d` | RPC/table never applied | Falls back to unrelated global sequence | DB migration never promoted (G) |
| Attn card display code | `ffc741d` | `ffc741d` | Code live; data source (columns) missing | Card never renders | DB migration never promoted (G) |
| PublicQuoteHeader Desktop CTA reorder | `ffc741d` | `ffc741d` (same commit) | Live exactly as committed | Desktop correct, Mobile not | Fix scoped to Desktop branch only at implementation time (I) |
| Admin narrow redesign | `4088c2c` | `4088c2c` | Live exactly as committed | Matches TEST exactly | No divergence — this one promoted cleanly |
| Admin V2 (large redesign) | Never implemented (design-only, §94.1) | N/A | N/A | N/A | Never authorized for build (I) |
| AI Chat widget | `ec0fa59`/older | same | Live exactly as committed | Matches TEST exactly (bug exists in both) | Not drift — pre-existing shared gap (H) |

## FILE-BY-FILE DRIFT LEDGER

| File | TEST vs `origin/main` | Classification |
|---|---|---|
| `PublicQuoteHeader.jsx` | Identical | SAME (bug present in both) |
| `AIChatWidget.jsx` | Identical | SAME (bug present in both) |
| `AdminUsersTab.jsx` / `UserDetailsModal.jsx` / `LifetimeConfirmModal.jsx` / `AILogs.jsx` | Identical | SAME |
| `get-public-quote` (Edge Function) | Different (TEST has `attn_name`/`attn_role`, Production's Path B build deliberately omits them) | ENVIRONMENT-DEPENDENT (by design) |
| `quotes.quote_number` generation | Different (RPC+table on TEST, plain sequence on Production) | ENVIRONMENT-DEPENDENT (schema divergence) |

---

## REMEDIATION PLAN — ORDERED, PLAN ONLY, NOTHING IMPLEMENTED

1. **Release/promotion integrity**: adopt a schema-parity pre-push check. Process only, no files, no risk.
2. **Quote numbering**: apply Item 17's full migration package to Production via the existing Mandatory Pre-LIVE Backup & Rollback Gate. Medium risk, already TEST-verified, HE+EN symmetric.
3. **Mobile CTA/number order**: swap the two children in `PublicQuoteHeader.jsx`'s Mobile branch to match the already-approved Desktop order. Low risk, one file, HE+EN symmetric.
4. **Attn card restoration**: revert Path B's field removal in `get-public-quote` once item 2's migration lands. Low risk, contingent on item 2.
5. **AI Chat overlap**: reserve bottom padding on Dashboard's scrollable Quote History container. Low risk, additive only.
6. **Public Quote general proportions**: requires a real Owner review session against current live state — no prior approved reference to diff against; should start with the Owner naming specific elements, not a blind re-pass.
7. **Admin UI**: no defect to fix; whether to pursue the larger Admin V2 redesign is a fresh product decision, not a bug fix.

---

## CONTINUITY

- `PROFLOW_PROJECT_CONTEXT.md` — new §113 (full audit: promotion chain, all 6 items, config audit, git history, root-cause matrix, blast radius, remediation plan).
- `PROFLOW_HANDOFF.md` — §18.EZ appended.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, §18.EY's paragraph demoted to HISTORICAL.
- `PROFLOW_ARCHITECTURE.md` — §1.A updated with the "TEST is not a deployed environment" structural finding.
- `PROFLOW_TODO.md` — continuity log extended with the full audit summary.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

Continuity commit to be pushed under the standing §17.K auto-sync authorization, verified live on GitHub before FINAL STOP.

---

## FINAL STOP

Every Owner-observed discrepancy was investigated with direct evidence — git diffs, schema queries on both Supabase projects, and direct source reading — not assumption or a prior report's own verdict. No lost, unpushed, reverted, or overwritten frontend code was found anywhere. The real drivers are two, both precisely evidenced: long-standing DB migrations never promoted to Production (with a previously-underappreciated visible consequence), and one genuine, narrowly-scoped implementation gap (Mobile CTA order) baked into already-committed source. TEST is reliable for frontend code, not reliable for DB-dependent behavior. A 7-item remediation plan is proposed. **Nothing was fixed.** Waiting for Owner review.

DO NOT FIX ANYTHING. WAIT FOR OWNER REVIEW.
