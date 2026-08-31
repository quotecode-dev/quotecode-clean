# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Wave 2 Pre-LIVE Safety Gate (GATE ONLY — not execution)

Continues directly from Wave 1 (`PROFLOW_PROJECT_CONTEXT.md` §115). Full detail: §115's Wave 2 addendum.

**Owner-authorized: preparation of the safety gate only. This is NOT authorization to execute Wave 2. Read/inspect/verify/plan only — zero mutation of any kind.**

---

## TASK: Wave 2 Pre-LIVE Safety Gate
## EFFORT: MAXIMUM / EXHAUSTIVE
## STATUS: **READY FOR OWNER REVIEW**

---

## FRESH LOCAL STATE

`HEAD = main = 071dad55f8cd6c742eb89aed053e68c59fc87cf8`. `origin/main` (fresh fetch) `= dd110155a927f708f00467e1017bd183582b42aa`. 1 ahead/0 behind (unchanged — Path B only). Working tree: six continuity docs + untracked `entry-server.jsx`, identical to every prior check. Every Item 17/18 file confirmed committed and part of `origin/main`'s ancestry (`731aa2a` for Item 17 + counter-init, `6fe9cd4` for Item 18) — nothing uncommitted, nothing local-only.

---

## WAVE 2 EXACT FILE MANIFEST

| # | File | Purpose | Depends on | Production state |
|---|---|---|---|---|
| 1 | `supabase/migrations/20260827000000_add_quote_number_sequence.sql` | `business_quote_sequences` table + `allocate_quote_number()` | None | **MISSING** |
| 2 | `supabase/migrations/202608270000015_attach_quote_number_unique_constraint.sql` (malformed — intended name `20260827000001a_...`) | Attaches UNIQUE constraint | File #3's index | **MISSING** |
| 3 | `supabase/migrations/20260827000001_add_quote_number_unique_index.sql` | Builds the unique index | None | **MISSING** |
| 4 | `supabase/migrations/20260827000002_protect_quote_number_immutability.sql` | New immutability trigger | None | **MISSING** |
| 5 | `supabase/migrations/20260827000003_drop_quote_number_default.sql` | Drops old global-sequence default | Hard release-order dependency on #1 + live frontend RPC path | Old default still present (unchanged) |
| 6 | `supabase/migrations/20260828000000_add_quote_attn_contact.sql` | `attn_name`/`attn_role` columns | None (independent of Item 17) | **MISSING** (both columns) |
| 7 | `supabase/quote_number_counter_init.sql` (not in `migrations/`, manual only) | Per-business counter seeding | After #1, before real allocations for historical businesses | Not run anywhere |

**New this task**: `send-quote-email` also references `quote_number` (added in `ffc741d`, 2026-08-28) but was last deployed 2026-08-25 — running stale, pre-quote_number code on Production. Same class of gap as `get-public-quote`'s already-known Attn gap. Wave 3 item.

---

## MIGRATION FILENAME ISSUE

Confirmed (again) via three independent methods this task and last: `202608270000015_...` sorts *before* its own dependency, `20260827000001_add_quote_number_unique_index.sql`. **The exact fix was independently re-verified this task**: renaming to `20260827000001a_attach_quote_number_unique_constraint.sql` produces correct ordering, confirmed via `LC_ALL=C sort` on the two candidate filenames. Not performed — renaming remains out of scope for this gate.

## PRODUCTION MIGRATION STATE

Direct query of `supabase_migrations.schema_migrations` (ground truth, not the CLI's summary): **exactly one row**, `20260831000000` (the already-applied, unrelated security fix). None of the 7 manifest items appear.

## PRODUCTION SCHEMA PARITY

Single comprehensive fresh query, 8 objects: `business_quote_sequences` MISSING, `allocate_quote_number` MISSING, unique index MISSING, unique constraint MISSING, immutability function MISSING, immutability trigger MISSING, `attn_name` MISSING, `attn_role` MISSING. `quote_number`'s column default is DIFFERENT from target (still the old global sequence). Zero collision with existing triggers (`guard_quote_immutability_delete_trigger`/`guard_quote_immutability_update` — different names, different functions). **Zero drift, zero partial application anywhere.**

## EDGE/BACKEND PARITY

`get-public-quote`: v7 (Path B), selects `quote_number` but not `attn_name`/`attn_role`, needs redeploy after Item 18 lands. `send-quote-email`: stale (last deployed 2026-08-25, before its own `quote_number` code was committed), needs redeploy for full Item 17 email parity. Neither deployed by this task.

---

## PRE-LIVE BACKUP PLAN

**Critical finding**: `supabase backups list` (read-only) → `pitr_enabled: false`, `backups: []`. No automated Production backup exists. Manual `supabase db dump --linked --schema public -f <path>` confirmed available and correctly scoped (via `--help`, not executed). Full table (schema dump, `quotes` data dump, deployed app SHA already tagged, Edge Function source download) with WHAT/HOW/WHERE/VERIFIED/RESTORE for each, recorded at `PROFLOW_PROJECT_CONTEXT.md` §115. **The backup itself is a required Wave 2 execution precondition, not a deliverable of this gate — not created here.**

## ROLLBACK PLAN

Full per-component table at §115. Six of seven components: no data-loss risk, fully reversible via inline rollback SQL already present in each file. One component (dropping the old `quote_number` default, file #5) is **explicitly flagged as effectively one-way after meaningful live use** — already documented in the file's own header, re-confirmed here, not hidden.

## SAFE EXECUTION ORDER

12 dependency-derived steps: backup → verify → rename file #2 → coordinated isolated push of files #1/#2/#3/#4/#6 → verify (8-object check) → run counter-init script → verify (its own documented queries) → apply file #5 (drop default) → verify (real allocation test) → redeploy `get-public-quote` → redeploy `send-quote-email` → Production smoke (HE+EN). Every step carries its own STOP condition and rollback trigger.

## HE IMPACT

Market-neutral by source (no `isHebrew`/currency/VAT branch in any Wave 2 object). Required post-execution verification: HE quote creation gets a real `A100700+` number; "לידי:" renders when Attn is entered; an existing HE quote remains unaffected.

## EN IMPACT

Same neutrality, independently confirmed via source (not inferred from HE). Required verification: EN numbering, "ATTN:" rendering, zero VAT/₪ leakage, an existing EN quote unaffected.

## RELEASE-GATE INTEGRATION

Wave 2's DB/backend changes are Production infrastructure actions with their own manifest — not a frontend `RC_SHA` in the §17.L sense. No new frontend commit is required (the RPC call and `quote.attn_name` rendering are already live in `dd11015`'s own descended source). Once Wave 2+3 are live and verified, the release manifest template from Wave 1 gets its `DATABASE MIGRATIONS`/`EDGE FUNCTIONS` fields populated with real values for the first time. **No final Recovery RC created by this task.**

## UNKNOWNS: NONE

Every question this gate needed to answer was answered with direct, fresh evidence.

## RISKS

File #5 (drop default)'s time-limited rollback window (already flagged). The release-candidate model from Wave 1 remains process-only, not tool-enforced (already flagged, unchanged). No automated Production backup exists until one is manually taken as Wave 2's own first execution step.

---

## FILES CHANGED: continuity documentation only

`PROFLOW_PROJECT_CONTEXT.md` (Wave 2 addendum to §115), `PROFLOW_HANDOFF.md` (§18.FC), `PROFLOW_CHAT_HANDOFF.md` (§14 resume pointer), `PROFLOW_ARCHITECTURE.md` (§1.A backup-infrastructure note), `PROFLOW_TODO.md` (continuity log), `PROFLOW_CLAUDE_LATEST_REPORT.md` (this file).

## APPLICATION CODE CHANGED: NO
## TEST MUTATED: NO
## PRODUCTION MUTATED: NO
## DB MUTATED: NO
## EDGE FUNCTIONS MUTATED: NO
## MAIN PUSH: NO
## PRODUCTION DEPLOY: NONE

---

## SIX-FILE RECONCILIATION

| File | Status |
|---|---|
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED — full Wave 2 gate appended to §115 |
| `PROFLOW_CHAT_HANDOFF.md` | UPDATED — §14 resume pointer, Wave 1 paragraph retained |
| `PROFLOW_ARCHITECTURE.md` | UPDATED — §1.A backup-infrastructure finding |
| `PROFLOW_HANDOFF.md` | UPDATED — §18.FC appended |
| `PROFLOW_TODO.md` | UPDATED — continuity log extended |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED — this file, fully rewritten |

---

## RECOMMENDED NEXT STEP (ONE step only)

Owner + ChatGPT review this gate; if approved, the next authorized action would be Wave 2 Step 1 specifically — the manual Production backup (`supabase db dump`) — as its own separately-authorized execution step, not bundled with anything else.

---

## FINAL STOP

Every Wave 2 readiness criterion is met with direct, fresh evidence: exact scope known (7-item manifest, every file read in full), migration ordering known (filename bug found and its fix verified), Production state known (comprehensive fresh check, zero drift), dependencies known (including two newly-found items this task), backup mechanism viable (though no automated backup currently exists — now a known precondition, not an unknown), rollback viable for every component with the one time-limited item flagged prominently, verification defined for both markets independently. **This is a readiness verdict on the plan, not execution authorization.**

DO NOT EXECUTE WAVE 2. DO NOT START WAVE 3. WAIT FOR OWNER + CHATGPT REVIEW.
