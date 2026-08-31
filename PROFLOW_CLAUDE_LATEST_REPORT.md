# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Approved TEST State → Production Recovery — Master Preflight

Continues directly from the exhaustive drift audit (`PROFLOW_PROJECT_CONTEXT.md` §114). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §115, `PROFLOW_HANDOFF.md` §18.FB.

**Preflight only. No code, CSS, DB, migration, TEST mutation, Production mutation, Edge Function deployment, Vercel deployment, or commit to application branches. Ends with an execution-ready recovery plan, not a change.**

---

## MODE: RECOVERY PREFLIGHT · IMPLEMENTATION: NONE · TEST MUTATION: NONE · PRODUCTION MUTATION: NONE

## APPROVED WORK PRESERVED: YES

Fresh state confirms nothing exists only in the working tree, only in local commits, or only untracked. Every piece of approved work is either already an ancestor of `origin/main`/Production, or precisely characterized as a schema/migration gap — never a lost-code gap.

## APPROVED BASELINE: `HEAD = 071dad5` (Path B, Edge-Function-only, unpushed) · `origin/main = dd11015` · `1 ahead / 0 behind` · Production frontend commit = `dd11015`

---

## KEY NEW RECONCILIATIONS THIS TASK (neither requires recovery action)

1. **Critical Signature Authorization Fix** (`PROFLOW_PROJECT_CONTEXT.md` §58/§60): a real vulnerability — any authenticated business account could forge a customer's approval/signature on a quote by calling `public_approve_quote` directly, bypassing the UI. Already fixed, full TEST regression matrix passed, already promoted to Production (commit `b5583e5`). Forensically confirmed this task: `b5583e5` **is a genuine ancestor of both `origin/main` and local `HEAD`**, zero divergence, zero lost work. Fully preserved, fully live, no action needed.
2. **Mobile Quote History metadata grid + Sort control** (§61): its own continuity status still reads "AWAITING OWNER VISUAL APPROVAL." Direct source verification this task proves the feature (the "מיון:"/"Sort:" control, the 4-column mobile grid) is **already live on Production**, swept into the `fde680b` consolidation commit. A documentation-lag finding, not a code gap.

## NEW MIGRATION-SAFETY FINDING

Item 17's numbering package has a real filename bug: `202608270000015_attach_quote_number_unique_constraint.sql` (malformed 15-digit timestamp) sorts **before** its own dependency, `20260827000001_add_quote_number_unique_index.sql` — confirmed three independent ways, including the Supabase CLI's own `migration list`. **A plain `supabase db push` of this package as committed today would fail.** Must be renamed (no SQL change) before Wave 2.

## TRIAL BANNER — FULLY RESOLVED, NOT A DEFECT

Exact condition (`Dashboard.jsx:496-497`): `isExpiringSoon = trialDaysLeft <= 5 && trialDaysLeft > 0`. Above 5 days remaining → thin transparent "ticker" (purple text, self-dismissing). At 5 or fewer days remaining → fuller purple "slidebar" (white text, stays until dismissed). Both are the same already-approved, identical-in-both-environments code — the Owner's two observations were two different, both-correct states of one already-correct feature.

---

## PARITY REQUIRED vs INTENTIONAL DIFFERENCE

**Required**: application release SHA, numbering + Attn schema contract, Edge Function behavior once schema lands, functional behavior, HE/EN architecture, responsive behavior.
**Intentional, never a recovery item**: Supabase project identity, domain, credentials, customer/test data (David Aluminum protected per §19), already-assigned historical quote numbers (never renumbered), trial-days-driven banner variant.

## PROVEN RECOVERY ITEMS

| Item | Root cause | Recovery |
|---|---|---|
| A. Quote Numbering | Item 17 migration never applied to Production; malformed filename would also block a naive push | Rename file, apply 5-file package as one coordinated window |
| B. Attn/"לידי" | Item 18 migration never applied; Path B deliberately omits the fields as a result | Apply migration, then redeploy `get-public-quote` |
| C. Mobile CTA/header order | Desktop got the Owner-requested reorder; Mobile branch of the same file never did | Swap two children in `PublicQuoteHeader.jsx`'s Mobile branch |
| D. AI Chat mobile overlap | No scroll-content padding reserved to clear the fixed widget | Add bottom padding/scroll-margin to Dashboard's Quote History container |

**Admin (E)**: no defect, zero dependency on A-D, excluded from every wave. **Trial Banner (F)**: not a recovery item.

---

## MIGRATION SAFETY — FULL TABLE (7 files)

All additive or metadata-only; **none rewrite existing quote numbers or existing rows**. One file (`20260827000003_drop_quote_number_default.sql`) carries a real *operational* risk if applied out of its documented release-order window (would fail every new-quote INSERT) — this is already explicitly flagged in the file's own header, and the recovery plan honors it by treating the 4-file Item 17 package as one coordinated application. Full per-file breakdown (objects, operations, destructive?, data changed?, lock risk, rollback, TEST evidence, HE/EN impact) recorded in full at `PROFLOW_PROJECT_CONTEXT.md` §115.7.

## PRODUCTION CUSTOMER SAFETY — ALL YES/NO, NONE UNCERTAIN

Existing users: unaffected. Existing Public Quote links: unaffected. Existing signed/finalized quotes: unaffected (immutability trigger untouched). Currencies: unaffected. Market separation: unaffected. Auth/session risk: none. Data-loss risk: none (zero DROP/DELETE/UPDATE against existing data anywhere in the package). **No STOP GATE triggered by this section's own test** — a fresh safety re-check is still required immediately before actual execution.

---

## DEPENDENCY GRAPH (proven, not assumed)

`[Rename malformed migration file] → [Item 18 migration, independent of Item 17] → [Item 17's 4-file package, one coordinated window] → [get-public-quote redeploy] → [Mobile CTA fix + AI Chat spacing fix, independently timeable] → [TEST certification of the exact tagged candidate] → [Owner gate] → [same SHA promoted] → [Production smoke]`. Items C and D have zero backend dependency and zero dependency on each other. Admin and Trial Banner appear nowhere in the graph.

## RECOVERY WAVES (9, adapted from the suggested 8 — merged the schema waves since A/B have no ordering dependency on each other)

0. Tag current `dd11015` as an immutable rollback point.
1. Adopt the tag-and-verify promotion discipline (process only).
2. Fix the migration filename; apply Item 17 (4 files, one window) + Item 18 (1 file, independent) to Production.
3. Redeploy `get-public-quote` with Attn restored.
4. Fix Mobile CTA order + AI Chat overlap (frontend only).
5. TEST-certify the exact tagged candidate.
6. Owner approval gate against that SHA.
7. Promote the same SHA to Production.
8. Production smoke + rollback go/no-go.

## MUST RE-TEST vs NO FULL RE-TEST REQUIRED

**Must re-test**: quote creation/numbering both markets, Public Quote load both markets/breakpoints, Attn display both markets, AI Chat/scroll interaction mobile both markets.
**No full re-test required**: Warranty (already certified, untouched), Signature/approval flow (already live, unaffected), Admin (zero dependency), Auth/session (untouched), Desktop width/density (Owner-locked, untouched), Trial Banner (confirmed data-driven), currency/VAT/market-routing (untouched).

## OWNER RE-APPROVAL REQUIRED — only where genuinely necessary

Wave 6's gate against the new candidate. **Not** a re-approval of Desktop/Mobile width (already on record as approved) or anything else in the "APPROVED — PRESERVE" ledger.

---

## ROLLBACK PLAN — PER LAYER

Frontend: `git revert`, fully reversible. DB (Item 17): inline rollback SQL provided, safe only before real per-business numbers accumulate — flagged as effectively one-way after meaningful live use. DB (Item 18/Attn): fully reversible (`DROP COLUMN`). Edge Function: redeploy the archived pre-change source, fully reversible. Full table at §115.13.

## OWNER GATES — 4, never combined

A: TEST/local implementation. B: Production DB migration. C: Production Edge Function deploy. D: Production frontend promotion. A commit ≠ a push ≠ a deploy ≠ LIVE authorization.

---

## WHAT'S PRESERVED FROM THE LAST FOUR DAYS

Desktop/Mobile Public Quote width (Owner-locked), the Critical Signature Fix (already live), the Mobile Quote History grid+sort (already live), Warranty (fully certified), Admin's current redesign (correct as-is), Trial Banner (correct as-is).

## WHAT ACTUALLY NEEDS NEW WORK

Nothing requires genuinely new design. Numbering and Attn need only promotion/backend parity (already fully designed and TEST-verified). Mobile CTA order and AI Chat overlap need small, precisely-scoped, already-fully-specified fixes. The one item requiring actual new Owner input (not new code) is a fresh look at general Public Quote proportions, since no formally-approved reference state exists to diff against — not a request to redo prior work, a request for the one piece of feedback never actually captured.

## RECOMMENDED FIRST EXECUTION WAVE

**Wave 0**: tag `dd11015` as the immutable pre-recovery checkpoint. Zero risk, zero code change, establishes the rollback anchor before anything else begins.

---

## CONTINUITY

- `PROFLOW_PROJECT_CONTEXT.md` — new §115 (complete recovery plan: baseline ledger, root causes, parity tables, release-gate design, dependency graph, migration safety, customer safety, HE/EN invariants, execution waves, retest scoping, change manifest, rollback plan, Owner gates, preserved-vs-new summary).
- `PROFLOW_HANDOFF.md` — §18.FB appended.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, §18.FA's paragraph demoted to HISTORICAL.
- `PROFLOW_ARCHITECTURE.md` — §14.A updated with the migration filename bug.
- `PROFLOW_TODO.md` — continuity log extended with the full preflight summary.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

Continuity commit to be pushed under the standing §17.K auto-sync authorization, verified live on GitHub before FINAL STOP.

---

## FINAL STOP

An execution-ready recovery plan is complete: nothing approved was reopened, nothing lost was found, two items previously thought incomplete are confirmed already live, one previously-undiscovered migration-package bug was found and precisely characterized, and the Trial Banner concern is fully resolved as correct existing behavior. Every proposed action is traced to a proven dependency, a named risk, a named rollback, and an explicit Owner gate. **Nothing was implemented.**

DO NOT IMPLEMENT. WAIT FOR OWNER + CHATGPT REVIEW.
