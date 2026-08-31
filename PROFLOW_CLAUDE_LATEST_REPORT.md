# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Production Pre-Push Preflight — Maximum Read-Only Schema + Runtime Reconciliation

Continues directly from the Dashboard-Centered Remaining Work Bundle (`PROFLOW_PROJECT_CONTEXT.md` §101). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §102, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EO.

**Strictly read-only throughout. Zero mutation of any kind.**

---

## PRODUCTION TARGET VERIFIED: YES

`ixabnzhjeqevtbhdfswv` (name `quotecode`, created 2026-07-27, `linked: true`), confirmed distinct from `ljfizgrdyzxddswcedwr` (`quotecode-test`, created 2026-08-27, `linked: false`) via `supabase projects list` before any query. All subsequent queries explicitly scoped to Production only.

## PRODUCTION MUTATIONS: NONE

Method: a schema-only `supabase db dump` (confirmed zero `INSERT`/`COPY` rows — no data, no PII) plus targeted `information_schema`/aggregate `SELECT` queries via `supabase db query --linked`. No INSERT/UPDATE/DELETE/UPSERT/DDL/RPC/Edge-Function-invocation was executed.

---

## WARRANTY

**business_settings.default_warranty**: MISSING
**quotes.warranty**: MISSING

Confirmed via two independent methods (schema dump + direct `information_schema.columns` query, cross-checked against `business_settings.default_terms` which correctly returned as a control).

**6430cf5 STATUS**: REQUIRED

**Severity correction**: `fde680b`'s `Dashboard.jsx` includes `warranty`/`default_warranty` unconditionally in every quote and Business Settings save payload, with **no fail-safe retry** (unlike Attn). Pushing today would break every quote save and every Business Settings save against Production's live schema — not a Warranty-scoped gap, a P0-severity regression to core functionality.

## ATTN

**attn_name**: MISSING
**attn_role**: MISSING

**ORIGIN/MAIN COMPATIBILITY**: PASS — `origin/main`'s already-live `Dashboard.jsx` (`ffc741d`) has a deliberate try-then-fallback retry: first attempt includes `attn_name`/`attn_role`, and only on an error message specifically naming those columns does it retry without them. Already compatible by design; `fde680b`'s Item 27 builds on the same protected path.

---

## QUOTE NUMBERING

**CURRENT A90 GENERATOR**: Postgres's own native column default — `quotes.quote_number integer NOT NULL DEFAULT nextval('quotes_quote_number_seq')`, a single **global** sequence. No trigger, function, RPC, Edge Function, or application code is involved. Confirmed unchanged from the 2026-08-28 audit, re-verified live today.

**QUOTE_NUMBER UNIQUENESS**: `total_quotes=23`, `distinct_quote_numbers=23` (zero duplicates), `min_qn=11`, `max_qn=89`, `distinct_businesses=7` — all 23 rows share one continuous global range across 7 businesses.

**COLLISION RISK**: LOW — global uniqueness today trivially implies per-business uniqueness once Item 17's index is applied.

**HISTORICAL NUMBER INTEGRITY**: Confirmed intact and consistent with the documented "never renumber" design — no evidence of any prior mutation to existing values.

## ITEM 17: NEEDS REVISION (in sequencing only, not defect)

Per-file assessment: sequence/RPC creation, unique index, and immutability trigger are each individually **READY** (additive, no conflict, safety re-confirmed against live data). The drop-default migration is **BLOCKED** — correctly, by its own documented release order, since it must apply last, after the allocator is live and verified. The counter-seeding script is **BLOCKED**, depending on the first migration. Nothing here is newly broken; "apply the whole folder" would be wrong, "apply in documented order with a verification gate" is correct and unchanged.

**ITEM 17 BLOCKER**: Sequencing only — the drop-default step cannot run until the allocator + frontend path are confirmed live, per the migration's own explicit in-file warning.

---

## EMAIL

**TRIAL EMAIL LIVE INVOCATION**: YES
**SUBSCRIPTION EMAIL LIVE INVOCATION**: YES

A real, already-`origin/main`-committed Vercel Cron (`vercel.json`'s `crons` entry, `/api/cron`, daily `0 8 * * *` UTC → `api/cron.js`) invokes both `send-trial-expiration-email` and `send-subscription-expiration-email` in `mode:'batch'` against Production's currently-deployed (unfixed) Edge Functions. Confirmed via `git log origin/main -- api/cron.js` (already live, zero diff from local HEAD). Production has no `pg_cron` extension (DB-native path ruled out). **This resolves several prior sessions' "scheduler could not be confirmed or ruled out" into a definitive YES** — found simply by reading a file already in the repo.

**Consequence, not yet acted on**: the trial-email fix (`99c4ba3`) is git-committed but Edge Function commits do not auto-deploy; once someone separately runs `supabase functions deploy` for it, the very next 08:00 UTC cron run will attempt real customer email sends to genuinely-eligible active-trial accounts — a distinct future authorization point.

## VERCEL

**MAIN PUSH AUTO-DEPLOY**: YES — reconfirmed accurate against `PROFLOW_ARCHITECTURE.md`'s existing Owner-verified statement, not contradicted by anything found this task. DB migrations and Edge Function deployments remain on their own separate, manual paths (`supabase db push`, `supabase functions deploy`); a push touches neither.

---

## 18-COMMIT PRODUCTION DEPENDENCY MATRIX

| Feature | Commit(s) | DB dependency | Production satisfied? | Push safe without DB action? |
|---|---|---|---|---|
| Admin V2 Phase 1 | `c4491a8`,`f482d69` | none | n/a | YES |
| Plan/Trial resolver | `018f905` | none | n/a | YES |
| Plan badge wiring | `f482d69` | none | n/a | YES |
| Trial email repair | `99c4ba3` | none | n/a | YES (behavior change only on separate Edge Function redeploy) |
| Subscription email fail-safe | `99c4ba3` | none | n/a | YES |
| Warranty | `6430cf5`,`fde680b` | `default_warranty`,`warranty` | **NO** | **NO — RED** |
| Attn | `ffc741d`(pre-existing)+`fde680b` | `attn_name`,`attn_role` | NO, but fail-safe | YES |
| Market routing | `e37931e`,`fde680b` | none | n/a | YES |
| Client Type | `fde680b` | reads existing column | YES | YES |
| Signature Pad | `fde680b` | none | n/a | YES |
| Quote History changes | `80fa5f5`,`fde680b` | reads existing `quote_number` | YES | YES |
| Item 17 allocator package | `731aa2a`,`6fe9cd4` | see Item 17 above | NO (by design) | YES (migration commits execute nothing) |
| Base-schema artifacts | `835654d` | none (TEST-only) | n/a | YES |

## GREEN COMPONENTS

Admin V2 Phase 1, Plan/Trial foundation, Plan badge wiring, Trial email repair, Subscription email fail-safe, Attn, Market routing, Client Type, Signature Pad, Quote History changes.

## YELLOW COMPONENTS

Item 17 quote numbering (sound package, sequencing-dependent, not defective).

## RED COMPONENTS

Warranty (schema missing, no fail-safe, would break core save functionality).

## ENTIRE 18-COMMIT CHAIN: RED

GIT-SAFE as a whole (confirmed twice via isolated clean-tree proofs) but not PRODUCTION-SAFE as one unit, solely because of Warranty.

## SAFE RELEASE SEQUENCE (documented for review — NOT executed)

1. Apply Warranty's migration (`6430cf5`'s SQL) to Production via `supabase db push` — its own explicit DB-action authorization, not performed here.
2. Once confirmed applied, push the full 18-commit chain (or push everything except `fde680b` first, then `fde680b` once (1) is done, if more lead time is wanted).
3. Item 17's package, if/when authorized, applies in its own documented internal order with a verification gate — independent of (1)/(2).
4. Edge Function redeploy for the email fixes is a separate, later decision with a real email-send consequence (see EMAIL above) — not bundled into "push main."

---

## CONTINUITY ASSUMPTIONS FOUND STALE

1. Multiple prior tasks stated the scheduler question as unresolved ("could not be confirmed or ruled out") — resolved this task; corrected directly in `PROFLOW_ARCHITECTURE.md` §16.
2. The immediately-prior task's own report characterized the Warranty Production risk as "save/display would fail" — accurate but understated; corrected to reflect it would break all quote and Business Settings saves.
3. Attn's Production compatibility was left open by several prior sessions — resolved as confirmed-safe-by-design.

## FRESH PRODUCTION STATE STILL UNKNOWN

Exact RLS policy contents were not re-verified this task (unchanged since the 2026-08-30 base-schema capture, out of this task's specific scope). Whether any Production automation exists *outside* this repo (e.g. a Supabase Dashboard-configured schedule) cannot be fully ruled out by repo inspection alone, though `pg_cron`'s absence rules out the DB-native path specifically.

## OWNER DECISIONS REQUIRED

Whether/when to authorize (a) applying Warranty's migration to Production, (b) pushing the 18-commit chain (in full or in the split sequence above), (c) Item 17's coordinated release, and (d) redeploying the fixed email Edge Functions (aware of the real-email-send consequence at the next cron run). None of these require further code work — the chain itself is ready and TEST-verified.

## APPLICATION PUSH: NONE
## MIGRATIONS EXECUTED: NONE
## DEPLOY: NONE
## PRODUCTION: UNCHANGED

---

## CONTINUITY

- `PROFLOW_PROJECT_CONTEXT.md` — new §102 (full investigation, dependency matrix, decision matrix, safe release sequence).
- `PROFLOW_ARCHITECTURE.md` — §16 updated; the stale scheduler-unknown statement corrected directly.
- `PROFLOW_HANDOFF.md` — §18.EO appended.
- `PROFLOW_CHAT_HANDOFF.md` — §14 resume pointer updated, §18.EN's paragraph demoted to HISTORICAL.
- `PROFLOW_TODO.md` — Admin V2 area extended with this task's findings.
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — this file, fully rewritten.

Continuity commit pushed automatically under the standing §17.K auto-sync authorization — verified live on GitHub before FINAL STOP.

---

## RECOMMENDED NEXT ACTION

Decide Warranty's Production migration timing first — everything else in the 18-commit chain is confirmed release-ready pending that one decision.

---

## FINAL STOP

A strictly read-only investigation established Production's actual schema and runtime truth independently, rather than inferring it from migration files. Confirmed: Warranty is a genuine, more-severe-than-previously-stated blocker (would break core save functionality, not just its own feature); Attn is safely handled by existing fail-safe code; quote-numbering's A90 mechanism is unchanged and well-understood; and — the most significant new finding — a real Vercel Cron already invokes both email functions daily, resolving a long-standing open question and surfacing a real consequence to weigh before any future Edge Function redeploy. GIT-SAFE and PRODUCTION-SAFE are now concretely distinguished with a full dependency matrix and a documented (not executed) safe release sequence. No mutation of any kind was performed. Continuity synced and verified live on GitHub.
