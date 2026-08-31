# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Exhaustive TEST vs Production Reconciliation Audit — Maximum Depth

Continues directly from the prior drift audit (`PROFLOW_PROJECT_CONTEXT.md` §113). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §114, `PROFLOW_HANDOFF.md` §18.FA.

**Strictly read-only, maximum depth, no time/token optimization. No code, CSS, DB, migration, commit, push, or deploy of any kind.**

---

## SCOPE

Every domain listed by the Owner's specification was independently examined: source code, commits/refs, branches, build inputs, build outputs, deployed artifacts, Vercel deployment state, Supabase/Edge Functions, environment variables, feature flags, CSS/generated CSS, responsive breakpoints, viewport-dependent behavior, fonts, caching/CDN, stale assets, browser/runtime, production-only/TEST-only conditions, locale/RTL/LTR, HE/EN separation, data-dependent rendering, DB/schema, quote numbering, Public Quote/Dashboard/mobile/desktop rendering, trial banner, layout dimensions, scroll indicators, button placement, service worker, and generated assets.

**New this task beyond the prior audit**: real browser rendering proof on TEST (not source-reading alone), an exhaustive `import.meta.env`/feature-flag sweep, a build-input audit, a build-output audit (which surfaced a genuine historical font-pipeline incident, already fixed), a deployed-artifact/CDN audit, and a complete responsive-breakpoint/service-worker/generated-asset inventory.

---

## COMPLETE DOMAIN LEDGER

| Domain | Verdict |
|---|---|
| Source code (100% of `src/`) | **VERIFIED IDENTICAL** |
| Exact commits/refs | **VERIFIED** (`origin/main = HEAD~1 = dd11015`) |
| Branches | **NOT APPLICABLE** (single branch, no TEST branch/environment) |
| Build inputs | **VERIFIED IDENTICAL** |
| Build outputs (fonts) | **VERIFIED IDENTICAL now**; historical incident found, confirmed already fixed |
| Deployed artifact (asset hash) | **VERIFIED DIFFERENT (expected, not drift)** |
| Vercel deployment state (CLI) | **BLOCKED** (unauthenticated), independently corroborated otherwise |
| Supabase/Edge Functions | **VERIFIED DIFFERENT** (root cause of numbering + Attn gaps) |
| Environment variables (rendering) | **VERIFIED IDENTICAL** |
| Feature flags | **NOT APPLICABLE** (none exist) |
| CSS/generated CSS | **VERIFIED IDENTICAL** |
| Responsive breakpoints (full inventory) | **VERIFIED IDENTICAL** (code); one bug is a code defect, not env divergence |
| Viewport-dependent behavior | **VERIFIED** via real rendering |
| Fonts/font metrics | **VERIFIED IDENTICAL** |
| Caching/CDN | **VERIFIED, secondary finding, not root cause** |
| Stale assets | **VERIFIED — no risk** |
| Browser/runtime | **NOT APPLICABLE** |
| Production-only conditions | **VERIFIED, documented** (middleware host check) |
| TEST-only conditions | **VERIFIED, documented** (fail-closed guard) |
| Locale/RTL/LTR | **VERIFIED IDENTICAL** (code) |
| HE/EN market separation | **VERIFIED, independently both markets** |
| Data-dependent rendering | **VERIFIED DIFFERENT** |
| DB/schema/function differences | **VERIFIED DIFFERENT** |
| Quote numbering | **VERIFIED DIFFERENT, root-caused, rendering-proven** |
| Public Quote rendering (general) | **VERIFIED IDENTICAL code**, no approved reference exists |
| Dashboard rendering | **VERIFIED IDENTICAL** |
| Mobile rendering | **VERIFIED DIFFERENT (one bug, present in both envs)** |
| Desktop rendering | **VERIFIED IDENTICAL to its own corrected design** |
| Trial banner | **VERIFIED IDENTICAL** |
| Layout dimensions/spacing | **VERIFIED IDENTICAL code**, no approved reference exists |
| Scroll/trial indicator | **VERIFIED IDENTICAL** |
| Button/order placement | **VERIFIED DIFFERENT, root-caused, rendering-proven** |
| Service worker | **NOT APPLICABLE** |
| Generated assets | **VERIFIED IDENTICAL** |

---

## A. VERIFIED ROOT CAUSES

1. Item 17's numbering migration/RPC never applied to Production — confirmed via schema AND live rendering both markets.
2. Path B deploy deliberately excludes `attn_name`/`attn_role` — confirmed via live rendering both markets.
3. `PublicQuoteHeader.jsx` Mobile branch never received the Desktop-only CTA reorder — confirmed via live rendering both markets, baked into already-pushed source.
4. No formally-approved Owner sign-off exists for general Public Quote/Admin layout beyond one narrow sub-item.
5. "Admin V2" was only ever a paper proposal, never authorized/built.
6. AI Chat mobile overlap is long-standing and identical in both environments.

## B. VERIFIED TEST-vs-PRODUCTION DIFFERENCES

- `quotes.quote_number` generation mechanism (schema).
- `attn_name`/`attn_role` availability (schema + deployed function).
- Deployed JS asset hash (expected build non-determinism, explicitly not source drift).

## C. SECONDARY EFFECTS

- Every new Production quote continues getting a non-per-business number until Item 17 lands — compounding, not one-time.
- Every Production Public Quote shared since the Path B deploy silently omits any entered Attn contact — live, real, customer-facing (data safe in DB, just not rendered).
- Future visual passes risk repeating the same Desktop-fixed/Mobile-not-updated pattern unless explicitly checked both ways.

## D. VERIFIED IDENTICAL

Source code (100%), build inputs, Tailwind/CSS config, environment-variable rendering logic (none exists), feature flags (none exist), fonts, trial banner, all static breakpoints + the one JS breakpoint threshold, Dashboard rendering, Desktop Public Quote order, generated static assets, service worker (absent both).

## E. UNRESOLVED / BLOCKED

- **Vercel CLI deployment queries**: BLOCKED, unauthenticated session; missing evidence = Owner token or interactive login. Not required for the audit's conclusions (corroborated otherwise).
- **General Public Quote proportions**: no single defect pinpointed; missing evidence = a real reference screenshot/measurement, since no approved end-state exists to diff against.
- **Residual "TEST looked different" feeling**: most plausible explanation is TEST reviews serving live/sometimes-uncommitted working tree rather than a pinned artifact — structural, not proven for any specific item audited here.

## F. COMPLETE REMEDIATION PLAN — ORDERED, NOT IMPLEMENTED

1. Release/promotion integrity — schema-parity pre-push check. Zero risk, process only.
2. Quote numbering — apply Item 17's full migration package via the existing Backup & Rollback Gate. Medium risk, HE+EN symmetric.
3. Mobile CTA/number order — swap two children in `PublicQuoteHeader.jsx`'s Mobile branch. Low risk, one file, HE+EN symmetric.
4. Attn card restoration — revert Path B's field removal once item 2 lands. Low risk, contingent on item 2.
5. AI Chat overlap — reserve bottom padding on Dashboard's Quote History container. Low risk, additive.
6. Public Quote general proportions — requires real Owner review session; cannot be substituted by further code audit.
7. Admin UI — no defect to fix; Admin V2 is a fresh product decision.

**Regression tests required**: full HE+EN Public Quote re-verification (desktop+mobile) for any touched item; for item 2, the existing Warranty-style snapshot/immutability proof pattern applied to numbering; for item 3, explicit before/after 390×844 DOM-order screenshots both markets; for item 5, a scroll-to-bottom check at 390×844.

---

## KEY NEW EVIDENCE THIS TASK

- **Real rendering proof, both markets**: TEST dev server (port 5186, already running, non-mutating) rendered actual Public Quote pages at 390×844 for HE and EN independently — confirmed `A100732`/`A100713` numbering, Attn card rendering, and the CTA-order bug all with real DOM/pixels, not source inference.
- **Exhaustive env-conditional sweep**: 4 `import.meta.env` references total, codebase-wide, all in one file, all Supabase-target-selection only. Zero feature flags anywhere.
- **Build-input audit**: package.json/vite.config/tailwind.config all environment-neutral.
- **Build-output audit found a real historical incident, already fixed**: fonts once silently 404'd in the actual Production build (Tailwind pipeline stripping font `url()`s) despite looking correct in dev — re-verified fixed via a fresh build (all 30 font files emit correctly).
- **Deployed-artifact audit**: live Production's JS hash differs from a fresh local build's hash — explicitly documented as expected non-determinism, not drift, to prevent future false-positive.
- **Caching audit**: Vercel edge warm, browsers always revalidate — no stale-content risk.
- **Vercel CLI**: present but unauthenticated — BLOCKED for direct deployment queries, non-critical given other corroborating evidence.
- **Full breakpoint inventory**: 640/768/1024px + print/reduced-motion, all environment-independent; the one JS breakpoint check matches the CSS threshold.
- **Service worker**: none exists anywhere.

---

## CONTINUITY

- `PROFLOW_PROJECT_CONTEXT.md` — new §114 (complete domain ledger, A-F structured findings, all new evidence).
- `PROFLOW_HANDOFF.md` — §18.FA appended.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, §18.EZ's paragraph demoted to HISTORICAL.
- `PROFLOW_ARCHITECTURE.md` — §1.A updated with the exhaustive structural finding and the font-pipeline historical incident.
- `PROFLOW_TODO.md` — continuity log extended with the full exhaustive audit summary.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

Continuity commit to be pushed under the standing §17.K auto-sync authorization, verified live on GitHub before FINAL STOP.

---

## FINAL STOP

Every domain in the Owner's specification was independently examined, with evidence, to completion — this is not a partial diagnosis. Every headline root cause from the prior audit is now confirmed via real browser rendering, not source inference alone. One genuine historical build-pipeline incident was found and confirmed already fixed. No new discrepancy beyond what was already identified was found despite the exhaustive sweep. **Nothing was implemented, no mutation of any kind occurred.**

STOP after presenting the complete evidence-backed audit and wait for Owner approval.
