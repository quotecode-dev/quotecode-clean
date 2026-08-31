# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Wave 2 / Step 3 — Final Production Execution Manifest

Continues directly from Step 2A (`PROFLOW_PROJECT_CONTEXT.md` §115, PASS — no rename required). Full detail: §115's Step 3 addendum.

**Owner-authorized: manifest planning and final pre-execution verification only. NOT live authorization. No mutation of any kind performed in this task.**

---

## TASK: Wave 2 / Step 3 — Final Production Execution Manifest
## EFFORT: EXHAUSTIVE / MAXIMUM DEPTH
## STATUS: **READY FOR LIVE AUTHORIZATION**

---

## 1. FRESH LOCAL STATE

`HEAD = local main = 246fc014261a757483487251d14d3e086d1a2d6e`, `origin/main = dd110155a927f708f00467e1017bd183582b42aa` (fresh fetch), branch `main`, working tree: only the standing untracked `src/entry-server.jsx` (unchanged, inert, already investigated). Supabase CLI `2.116.0`. Linked project ref: `ixabnzhjeqevtbhdfswv`.

**Linked-project identity proven, not assumed**: `supabase projects list` confirms `ixabnzhjeqevtbhdfswv` = project name `quotecode`, `"linked": true` = **Production**; `ljfizgrdyzxddswcedwr` = `quotecode-test`, `"linked": false` = TEST. Every `--linked` query in this task therefore targeted Production, and only Production, read-only.

**Current migration files** (12 total): `20260827000000` (Item 17 allocator), `20260827000001` (Item 17 index), `202608270000015` (Item 17 constraint — current filename, empirically validated correct by Step 2A, unchanged), `20260827000002` (Item 17 immutability trigger), `20260827000003` (Item 17 drop-default), `20260828000000` (Item 18 attn columns), `20260830000000`-`20260830000003` (TEST-only base-schema/functions/RLS/storage capture — **explicitly labeled in their own headers "NOT a Production forward-migration path... NEVER apply to Production"**), `20260830000004` (Item 23 warranty, TEST-only per its own header, though the underlying change was separately applied to Production via a coordinated task per `PROFLOW_ARCHITECTURE.md` §14.B, confirmed still live below), `20260831000000` (Critical Signature Authorization Fix — already live on Production, confirmed below).

**Item 17 files**: `20260827000000_add_quote_number_sequence.sql`, `20260827000001_add_quote_number_unique_index.sql`, `202608270000015_attach_quote_number_unique_constraint.sql`, `20260827000002_protect_quote_number_immutability.sql`, `20260827000003_drop_quote_number_default.sql`, plus the manually-run (not auto-applied) `supabase/quote_number_counter_init.sql`.

**Item 18 file**: `20260828000000_add_quote_attn_contact.sql`.

**Relevant backend/Edge Function files**: `supabase/functions/get-public-quote/index.ts` (currently deployed v7, Path B — selects `quote_number`/`warranty`, deliberately omits `attn_name`/`attn_role`), `supabase/functions/send-quote-email/index.ts` (currently deployed v24, known stale relative to local source — Wave 3 item, untouched by this task).

---

## 2. RECONSTRUCTED REMAINING WAVE 2 SCOPE

Migration-filename rename is explicitly **excluded** (Step 2A: none required). The remaining scope is exactly the two DB-parity items:

### FILE / OBJECT: `20260827000000_add_quote_number_sequence.sql`
**PURPOSE**: creates `public.business_quote_sequences` (per-business counter table, RLS default-deny + one super-admin read policy) and `public.allocate_quote_number(uuid)` (SECURITY DEFINER, atomic `INSERT...ON CONFLICT...RETURNING` allocator).
**CURRENT TEST/INTENDED STATE**: live on `quotecode-test`, end-to-end verified (both markets, both Local/International accounts).
**CURRENT PRODUCTION STATE**: **absent** — `business_quote_sequences` table: false, `allocate_quote_number` function: false (confirmed fresh, §5 below).
**ACTION REQUIRED**: apply migration as-is.
**DEPENDENCY**: none (first in the package). Depends on `public.is_super_admin()`, confirmed present on Production.
**ROLLBACK**: `REVOKE EXECUTE ... ; DROP FUNCTION ...; DROP POLICY ...; DROP TABLE ...` (file's own rollback block) — safe only after `20260827000003`'s rollback has already restored the old DEFAULT first.
**POST-ACTION VERIFICATION**: table + function + RLS policy exist; table has 0 rows.

### FILE / OBJECT: `supabase/quote_number_counter_init.sql` (manual script, not an auto-applied migration)
**PURPOSE**: seeds each business's counter to `GREATEST(100699, MAX(historical quote_number))` so the allocator's first real call lands on exactly 100700 (or correctly above it for a business already past that point) — defense-in-depth, not currently required for correctness (see §3).
**CURRENT TEST/INTENDED STATE**: available, not yet run anywhere per its own header ("NOT EXECUTED BY THIS TASK, NOT EVER AUTO-APPLIED").
**CURRENT PRODUCTION STATE**: n/a — no `business_quote_sequences` rows exist yet (table itself absent).
**ACTION REQUIRED**: run manually, once, after `20260827000000` is live, as its own explicitly-authorized step.
**DEPENDENCY**: `business_quote_sequences` table must exist.
**ROLLBACK**: `DELETE FROM public.business_quote_sequences;` — safe only if run before any real `allocate_quote_number()` call has happened.
**POST-ACTION VERIFICATION**: one row per distinct `quotes.user_id`, every `next_number >= 100699`; `quotes.quote_number` values byte-identical to a pre-run snapshot (script must be a strict no-op on `quotes`).

### FILE / OBJECT: `20260827000001_add_quote_number_unique_index.sql`
**PURPOSE**: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS quotes_user_quote_number_unique_idx ON public.quotes (user_id, quote_number)`.
**CURRENT TEST/INTENDED STATE**: live on TEST.
**CURRENT PRODUCTION STATE**: **absent** (confirmed fresh).
**ACTION REQUIRED**: apply as-is. **Pre-flight duplicate check performed this task**: zero existing `(user_id, quote_number)` duplicate pairs on Production — the index will build successfully.
**DEPENDENCY**: none on other Item 17 files; requires `public.quotes` to exist (it does).
**ROLLBACK**: `DROP INDEX CONCURRENTLY IF EXISTS ...` (file's own block — note the file's own rollback comment still references the retired `20260827000001a` name from before Step 2/2A; a stale cross-reference only, not a functional issue, not corrected by this task since no file mutation is authorized here).
**POST-ACTION VERIFICATION**: index exists AND `pg_index.indisvalid = true` (a `CONCURRENTLY` build can finish "present but INVALID" if it errors partway — must be checked explicitly, not just existence).

### FILE / OBJECT: `202608270000015_attach_quote_number_unique_constraint.sql`
**PURPOSE**: `ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_quote_number_unique UNIQUE USING INDEX quotes_user_quote_number_unique_idx` (metadata-only, fast, transaction-safe).
**CURRENT TEST/INTENDED STATE**: live on TEST.
**CURRENT PRODUCTION STATE**: **absent** (confirmed fresh).
**ACTION REQUIRED**: apply as-is, filename unchanged (Step 2A: empirically proven correct order and recognition).
**DEPENDENCY**: hard dependency on `20260827000001`'s index existing and being valid.
**ROLLBACK**: `ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_quote_number_unique;`
**POST-ACTION VERIFICATION**: `quotes_user_quote_number_unique` present in `pg_constraint`.

### FILE / OBJECT: `20260827000002_protect_quote_number_immutability.sql`
**PURPOSE**: `BEFORE UPDATE` trigger blocking any change to an already-set `quote_number` (narrow `service_role` bypass reserved for a future forward-fix).
**CURRENT TEST/INTENDED STATE**: live on TEST.
**CURRENT PRODUCTION STATE**: **absent** (confirmed fresh) — this is the currently-open live gap noted in `PROFLOW_ARCHITECTURE.md` §14.A ("an authenticated owner can currently change their own quote's `quote_number`").
**ACTION REQUIRED**: apply as-is.
**DEPENDENCY**: none on other Item 17 files.
**ROLLBACK**: `DROP TRIGGER ...; DROP FUNCTION ...` (file's own block).
**POST-ACTION VERIFICATION**: trigger present on `public.quotes`; a real UPDATE attempt on `quote_number` is rejected (verification query only, not performed by this task).

### FILE / OBJECT: `20260827000003_drop_quote_number_default.sql`
**PURPOSE**: `ALTER TABLE public.quotes ALTER COLUMN quote_number DROP DEFAULT` + `REVOKE ALL ON SEQUENCE quotes_quote_number_seq FROM anon, authenticated` (retires the old global-sequence fallback; `quotes_quote_number_seq` itself is retained, not dropped).
**CURRENT TEST/INTENDED STATE**: live on TEST.
**CURRENT PRODUCTION STATE**: **absent** — `quote_number`'s DEFAULT is still `nextval('quotes_quote_number_seq'::regclass)` (confirmed fresh, unchanged from every prior audit).
**ACTION REQUIRED**: apply **last**, and only after real successful allocator activity has been observed (see §7's STOP condition on this step — this is the single highest-risk step in the whole package, since after it, any INSERT that doesn't supply `quote_number` explicitly will fail NOT NULL).
**DEPENDENCY**: the allocator (`20260827000000`) must already be live AND actually succeeding for real quote creation — this task's own evidence (§ below) shows this is already guaranteed structurally, not merely hoped for.
**ROLLBACK**: restore the DEFAULT + re-grant the old sequence (file's own block) — **the file's own header explicitly warns this is only a clean revert if no real A100700+ numbers have been issued yet; once they have, reconciliation replaces a simple rollback.**
**POST-ACTION VERIFICATION**: `column_default` is NULL for `quotes.quote_number`; a real subsequent quote creation still succeeds (via the already-live allocator path) and receives a `≥100700` number.

### FILE / OBJECT: `20260828000000_add_quote_attn_contact.sql`
**PURPOSE**: adds nullable `quotes.attn_name` / `quotes.attn_role` text columns, no default, no backfill, no new RLS (inherits the existing per-row policy).
**CURRENT TEST/INTENDED STATE**: live on TEST.
**CURRENT PRODUCTION STATE**: **absent** (confirmed fresh: both `false`).
**ACTION REQUIRED**: apply as-is.
**DEPENDENCY**: none — independent of every Item 17 file, no ordering constraint either way.
**ROLLBACK**: `DROP COLUMN IF EXISTS attn_name; DROP COLUMN IF EXISTS attn_role;` (file's own block).
**POST-ACTION VERIFICATION**: both columns present, nullable, no default; existing 28 rows unaffected (NULL by default, matching how the frontend already renders their absence today).

---

## 3. ITEM 17 — EXACT MIGRATION PACKAGE (re-verified, order, dependency, destructiveness)

| # | File | Version | Destructive? | Data Impact | Expected Production Result |
|---|---|---|---|---|---|
| 1 | `20260827000000` | `20260827000000` | No (CREATE TABLE/FUNCTION) | None — 0 rows created | Allocator ready, unused until called |
| 2 | *(manual)* `quote_number_counter_init.sql` | n/a | No (idempotent seed INSERT) | Writes 7 rows to the new table only; **zero writes to `quotes`** | Every business's counter seeded so its first real allocation lands correctly |
| 3 | `20260827000001` | `20260827000001` | No (`CONCURRENTLY`, non-locking) | None | Unique index built, valid |
| 4 | `202608270000015` | `202608270000015` | No (metadata-only) | None | Constraint attached |
| 5 | `20260827000002` | `20260827000002` | No | None | Immutability trigger active |
| 6 | `20260827000003` | `20260827000003` | **Behavioral, not data-destructive** — removes the old fallback path | None to existing rows; changes behavior of *future* inserts that don't supply `quote_number` | Old global-sequence DEFAULT retired; allocator becomes the sole path |

**Counter-init derivation, re-verified fresh this task (not assumed from the 2026-08-28 audit)**: current per-business max `quote_number` on Production, queried fresh: 95, 92, 89, 87, 81, 57, 46 across the 7 businesses (sum of counts = 28, matching the fresh row-count check exactly). All are far below the `100699` floor, so `GREATEST(100699, MAX(...))` resolves to exactly `100699` for every business today, and the allocator's first real call for each returns exactly `100700` — identical outcome to a business with zero history. **Counter-init is not strictly required for correctness today** (a business with no seeded row also lands correctly on `100700` via the allocator's direct-INSERT path), but running it removes any theoretical race between migration application and organic quote growth, and is recommended as a required step in the execution order out of caution, per this task's "zero-guessing" mandate — not because current evidence shows it's needed.

---

## 4. ITEM 18 — EXACT SCOPE

**Exact migration/file**: `supabase/migrations/20260828000000_add_quote_attn_contact.sql`.
**Exact new schema objects**: two nullable `text` columns on `public.quotes` — `attn_name`, `attn_role`. No new table, no new function, no new index, no new RLS policy (existing per-row `quotes` RLS covers them automatically).
**Existing Production absence/presence**: both confirmed **absent** (fresh query, §5).
**Effect on existing rows**: none — both columns simply read `NULL` on all 28 existing rows; the frontend (already live, see below) already renders `NULL`/absent Attn identically to how it renders quotes created before this feature existed.
**Defaults/nullability**: nullable, no default, explicitly by design (historical quotes never retroactively gain a fabricated Attn value).
**Compatibility with existing quotes**: full — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is non-locking-in-practice (fast metadata change on Postgres 11+, no table rewrite for a nullable column with no default) and additive-only.
**HE implications**: none market-specific — the columns are plain text, market-neutral; only display labels ("לידי") are Hebrew-side, unaffected by this migration.
**EN implications**: same — English-side label only, no separate schema.
**Rollback**: `DROP COLUMN IF EXISTS attn_name; DROP COLUMN IF EXISTS attn_role;` (file's own block) — clean and fully reversible at any time, since the columns carry no other object's dependency.

**Frontend already forward-compatible, confirmed fresh via `git diff origin/main HEAD -- src/pages/Dashboard.jsx` (0 lines — byte-identical, so this is true of the currently-live Production frontend, not just local code)**: `Dashboard.jsx`'s quote-save path already includes `attnFields = { attn_name, attn_role }` in every INSERT/UPDATE, with an `isMissingAttnColumnError` fallback that strips those fields and retries if the columns don't exist — which is exactly what happens today (silently dropped). **The moment this migration lands, the already-live Dashboard will start persisting real Attn data on save with zero frontend deploy required.** Public Quote display of Attn data is a separate, deliberately-deferred Wave 3 item (`get-public-quote` v7 does not select these fields by design — Path B) — see §8.

---

## 5. PRODUCTION READ-ONLY RECHECK (performed fresh this task, `--linked` = Production, confirmed above)

| Check | Result | Comparison to backup-gate baseline |
|---|---|---|
| `quotes` row count | **28** | Matches exactly (Step 1 backup: 28) |
| `quotes.quote_number` DEFAULT | `nextval('quotes_quote_number_seq'::regclass)` | Unchanged — old global sequence still active |
| `quotes.warranty` exists | **true** | Matches (§14.B: Item 23 already applied to Production) |
| `quotes.attn_name` / `attn_role` exist | **false / false** | Matches (Item 18 confirmed still absent) |
| `business_settings.default_warranty` exists | **true** | Matches (Item 23) |
| `business_quote_sequences` table exists | **false** | Matches (Item 17 confirmed still absent) |
| `allocate_quote_number` function exists | **false** | Matches |
| `is_super_admin` function exists | **true** | Pre-existing platform function, unrelated to Item 17, unaffected |
| `quotes_user_quote_number_unique` constraint exists | **false** | Matches |
| `quotes_user_quote_number_unique_idx` index exists | **false** | Matches |
| `quotes_protect_quote_number` trigger exists | **false** | Matches |
| `quotes_quote_number_seq` exists | **true** | Pre-existing, retained by design even after Item 17 |
| Migration ledger (`supabase_migrations.schema_migrations`) | exactly one row: `20260831000000` | Matches — the Critical Signature Authorization Fix, already live, unrelated to Item 17/18 |
| Duplicate `(user_id, quote_number)` pairs | **zero** | New check this task — confirms the future unique index will build cleanly |
| Per-business max `quote_number` | 95 / 92 / 89 / 87 / 81 / 57 / 46 (7 businesses) | New check this task — confirms counter-init's `100699` floor is safely above every real business today |

**Result: ZERO drift since the backup gate. STATUS is NOT BLOCKED.**

---

## 6. BACKUP / RESTORE GATE

**BACKUPS: PRESENT** — all 5 Step 1 artifacts re-verified via `sha256sum -c CHECKSUMS.sha256`, all `OK`.
**CHECKSUMS: MATCH**
**RESTORE READINESS: VERIFIED** (unaffected, unchanged since the Restore Proof task).
Wave 0 rollback tag `proflow-pre-recovery-2026-08-31` re-verified intact, resolves to `dd110155a927f708f00467e1017bd183582b42aa`.

---

## 7. EXACT FUTURE LIVE EXECUTION ORDER (not executed — plan only)

**STEP 1**
PRECONDITION: fresh Production read-only recheck (§5) still shows zero drift, immediately before this step begins.
EXACT ACTION: apply `20260827000000_add_quote_number_sequence.sql` to Production (`supabase db push --linked`, scoped explicitly to this one file — **never a blanket `--include-all` push**, given the TEST-only capture migrations in the same directory that must never touch Production).
EXPECTED RESULT: `business_quote_sequences` table + `allocate_quote_number` function + RLS policy created; 0 rows.
READ-ONLY VERIFICATION: re-run the existence checks from §5 for these two objects; confirm 0 rows in the new table.
STOP CONDITION: any error, or the table/function not appearing exactly as specified.
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: file's own rollback block (§2) — safe at this point since nothing downstream has run yet.

**STEP 2**
PRECONDITION: Step 1 verified successful.
EXACT ACTION: run `supabase/quote_number_counter_init.sql` manually against Production, as its own explicitly-authorized action (separate from any migration push).
EXPECTED RESULT: exactly 7 rows in `business_quote_sequences`, one per business with historical quotes, every `next_number` between 100699 and (business's own historical max, if higher — none are today).
READ-ONLY VERIFICATION: `SELECT user_id, next_number FROM business_quote_sequences ORDER BY next_number;` — 7 rows, all `>= 100699`; a fresh `SELECT id, user_id, quote_number FROM quotes ORDER BY id;` byte-identical to the pre-step snapshot (proves zero effect on `quotes`).
STOP CONDITION: row count ≠ 7, any `next_number < 100699`, or any change detected in the `quotes` snapshot.
ROLLBACK TRIGGER: STOP condition met, AND no real `allocate_quote_number()` call has happened yet (true immediately after this step).
ROLLBACK ACTION: `DELETE FROM public.business_quote_sequences;`

**STEP 3**
PRECONDITION: Step 2 verified.
EXACT ACTION: apply `20260827000001_add_quote_number_unique_index.sql` to Production (scoped push, this file only).
EXPECTED RESULT: `quotes_user_quote_number_unique_idx` created and valid.
READ-ONLY VERIFICATION: index exists AND `SELECT indisvalid FROM pg_index WHERE indexrelid = 'quotes_user_quote_number_unique_idx'::regclass;` returns `true`.
STOP CONDITION: index missing, or present but `indisvalid = false`.
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: `DROP INDEX CONCURRENTLY IF EXISTS quotes_user_quote_number_unique_idx;`

**STEP 4**
PRECONDITION: Step 3 verified (index valid).
EXACT ACTION: apply `202608270000015_attach_quote_number_unique_constraint.sql` to Production (scoped push, this file only, filename unchanged per Step 2A).
EXPECTED RESULT: `quotes_user_quote_number_unique` constraint attached.
READ-ONLY VERIFICATION: constraint present in `pg_constraint`.
STOP CONDITION: constraint missing or attach errors.
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: `ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_quote_number_unique;`

**STEP 5**
PRECONDITION: Step 4 verified.
EXACT ACTION: apply `20260827000002_protect_quote_number_immutability.sql` to Production (scoped push, this file only).
EXPECTED RESULT: `quotes_protect_quote_number` trigger active.
READ-ONLY VERIFICATION: trigger present in `pg_trigger` for `public.quotes`.
STOP CONDITION: trigger missing.
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: `DROP TRIGGER IF EXISTS quotes_protect_quote_number ON public.quotes; DROP FUNCTION IF EXISTS public.protect_quote_number_immutability();`

**STEP 6 — OBSERVATION WINDOW (no schema change; the highest-value safety checkpoint in this whole sequence)**
PRECONDITION: Steps 1-5 verified. At this point the already-live Production frontend (confirmed byte-identical to local HEAD) will, on the very next real quote creation by any real business, successfully call `allocate_quote_number()` (previously failing silently) and receive a real `≥100700` number — this happens automatically, with no deploy, as soon as Step 1 lands, and is independently confirmed correct by Steps 1-5.
EXACT ACTION: none (read-only observation only) — wait for and/or prompt at least one real quote creation, then read-query it.
EXPECTED RESULT: a newly-created quote's `quote_number` is `≥ 100700`, and `business_quote_sequences.next_number` for that business incremented accordingly.
READ-ONLY VERIFICATION: `SELECT quote_number FROM quotes WHERE id = <new id>;` — confirm `≥ 100700`.
STOP CONDITION: a new quote is created and its `quote_number` is NOT `≥100700` (i.e., it fell through to the old global sequence — meaning the allocator call failed silently for a reason not yet diagnosed).
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: none required yet (no destructive step has run) — halt and re-diagnose before proceeding to Step 7.

**STEP 7 — the single highest-risk step in this sequence**
PRECONDITION: Step 6 confirms at least one real successful `≥100700` allocation.
EXACT ACTION: apply `20260827000003_drop_quote_number_default.sql` to Production (scoped push, this file only).
EXPECTED RESULT: `quotes.quote_number`'s DEFAULT removed; `anon`/`authenticated` grants on `quotes_quote_number_seq` revoked (sequence itself retained).
READ-ONLY VERIFICATION: `column_default` is NULL; then **one further real quote creation** confirmed to still succeed and receive a `≥100700` number (proves the allocator, not the old default, is now the only path — and that it still works with the fallback gone).
STOP CONDITION: `column_default` still present after apply, OR the post-step real quote creation fails, OR it succeeds but somehow returns a number below 100700.
ROLLBACK TRIGGER: STOP condition met **and** no real `≥100700` number has yet been issued to a customer-visible quote that would need reconciling (per the file's own header caveat) — otherwise, STOP and escalate to Owner for a reconciliation plan rather than a blind rollback.
ROLLBACK ACTION (only if the above condition holds): `GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.quotes_quote_number_seq TO anon, authenticated; ALTER TABLE public.quotes ALTER COLUMN quote_number SET DEFAULT nextval('quotes_quote_number_seq'::regclass);`

**STEP 8**
PRECONDITION: Step 7 verified.
EXACT ACTION: apply `20260828000000_add_quote_attn_contact.sql` to Production (scoped push, this file only — independent of Item 17, could technically run at any point in this sequence, placed last here only to keep Item 17 as one uninterrupted block).
EXPECTED RESULT: `quotes.attn_name` / `quotes.attn_role` columns present, nullable, both NULL on all existing rows.
READ-ONLY VERIFICATION: both columns present; existing 28 rows' `attn_name`/`attn_role` are NULL; row count still 28 (no rows added/removed).
STOP CONDITION: columns missing after apply, or any existing row's other data changed.
ROLLBACK TRIGGER: STOP condition met.
ROLLBACK ACTION: `ALTER TABLE public.quotes DROP COLUMN IF EXISTS attn_name; ALTER TABLE public.quotes DROP COLUMN IF EXISTS attn_role;`

**Explicit non-combination note**: each step above is a single migration file (or, for Step 2, a single manual script and for Step 6, a pure observation checkpoint) — no step bundles more than one irreversible action, and read-only verification is required before every subsequent step, per this task's own instruction.

---

## 8. EDGE FUNCTIONS — BOUNDARY WITH WAVE 3

**WAVE 2 (this manifest) provides**: DB/schema parity only — `business_quote_sequences`, `allocate_quote_number()`, the unique index/constraint, the immutability trigger, the retired default, and the two `attn_*` columns. No Edge Function is touched.

**WAVE 3 (separate, not started, not authorized by this task) must provide**: `get-public-quote` updated to also select `attn_name`/`attn_role` (currently deliberately omitted, Path B) so the Public Quote page can display Attn data — confirmed currently deployed as v7. `send-quote-email` updated to match current local source (confirmed currently deployed as v24, already known-stale relative to local source per `PROFLOW_ARCHITECTURE.md` §14.A/Wave 2 Safety Gate finding) — needed for the email subject/body to reflect `quote_number` correctly and, if desired, Warranty/Attn content in the email itself (a separate design decision, not assumed in scope here).

**What Wave 2 must provide before Wave 3 can safely begin**: Item 17's DB objects live (so `send-quote-email`, once updated, can rely on `quote_number` actually being populated by the allocator rather than the old global sequence) and Item 18's columns live (so `get-public-quote`'s future update has real data to select). Wave 3 has no dependency going the other direction — Wave 2 does not require any Wave 3 action first.

---

## 9. NEW OWNER FINDINGS — RECORDED, NOT INVESTIGATED

Per explicit instruction: recorded only, no root cause, no fix, no code change, no reopening of the completed global Recovery audit, no action on the real LIFETIME customer's data/subscription/checkout state.

**A. Trial banner presentation differs between accounts/states** — recorded as an open, unassigned Recovery-adjacent finding. Not evidenced as caused by Item 17/18 DB parity (trial-banner logic reads plan/trial entitlement state, unrelated to `quotes.quote_number`/`attn_*`). Owned by a future, separately-scoped frontend/entitlement investigation — not Wave 2, not Wave 3 (both DB/Edge-parity-scoped).

**B. A known LIFETIME real customer is being shown an "Upgrade Plan" CTA/modal** — recorded as an open, unassigned finding, **flagged as a real-customer-impacting issue requiring careful, dedicated investigation** (entitlement/plan-resolution logic, not evidenced as related to Item 17/18). Real-customer protection (no code change, no data change, no subscription/checkout action) remains absolute and was not touched by this task. Not assigned to Wave 2 or Wave 3.

**C. Production dashboard scale/layout still differs from the approved TEST presentation** — recorded as an open, unassigned finding (frontend CSS/responsive parity, not evidenced as DB-related). Not assigned to Wave 2 or Wave 3.

**Explicit non-derailment check performed**: none of A/B/C are caused by, or require any change to, the Item 17/18 DB objects in this manifest — confirmed by direct inspection (trial banner and plan-entitlement logic do not read `quotes.quote_number`, `business_quote_sequences`, or `quotes.attn_*`; dashboard layout is pure CSS/component structure). This manifest's Wave 2 DB scope is unchanged by these findings.

---

## 10. HE / EN REVIEW

**Local/Israel (HE) implications**: none of Item 17 or Item 18's schema objects are market-keyed — `business_quote_sequences` keys on `user_id` only, `allocate_quote_number(uuid)` takes only a business id, `attn_name`/`attn_role` are plain per-quote text columns. The permanent market-separation rule (`PROFLOW_PROJECT_CONTEXT.md` §3) is unaffected — no market-specific fork is introduced by this manifest. HE-side quote-number display (`formatQuoteNumber`) and Attn label text ("לידי") are pure frontend concerns, already live, already forward-compatible (§2/§4), requiring no additional Wave 2 action for HE specifically.

**International (EN) implications**: identical reasoning — `formatQuoteNumber`/`PublicQuoteEn.jsx` already share the exact same underlying value and allocation logic as HE; only display-label text differs, unaffected by this manifest.

**Reconciliation (shared DB architecture)**: confirmed — no market-specific fork of the shared schema exists or is introduced. Both markets read/write the identical `quotes`/`business_quote_sequences` objects through the identical allocator, matching the already-established, TEST-verified cross-business isolation proof (`PROFLOW_ARCHITECTURE.md` §14.A: International's first-ever quote landed at exactly `A100700` independent of Local's counter).

---

## 11. RELEASE MANIFEST (Wave 2 portion)

APPLICATION SHA: `246fc014261a757483487251d14d3e086d1a2d6e` (local `main`, includes all continuity documentation through Step 3; **application/frontend code itself is already byte-identical to `origin/main` `dd11015` for every file relevant to this manifest** — no new frontend deploy is required for Wave 2)

DATABASE MIGRATIONS (exact order): `20260827000000` → *(manual)* `quote_number_counter_init.sql` → `20260827000001` → `202608270000015` → `20260827000002` → `20260827000003` → `20260828000000`

DATA/BACKFILL: `quote_number_counter_init.sql` only (writes to the new `business_quote_sequences` table exclusively; zero writes to `quotes` or any other existing table)

EDGE FUNCTIONS: DEFERRED TO WAVE 3

ENV CHANGES: NONE

BACKUP: VERIFIED

RESTORE: VERIFIED

HE: reviewed, no market-specific concern, no additional action required

EN: reviewed, no market-specific concern, no additional action required

OWNER LIVE AUTHORIZATION: NO

**This is not yet a release candidate** — no RC tag/SHA-binding action was taken by this task; per §17.L, that step is separate and requires its own explicit Owner authorization once LIVE execution itself is authorized.

---

## 12. ABSOLUTE NO-MUTATION BOUNDARY — CONFIRMED HELD

No Production SQL/migration/schema/data change. No TEST mutation. No Edge/Vercel deploy. No migration rename. No application code change. No main push. No LIVE action. No Wave 3 execution. Every command run in this task was either a local git/file read, a local disposable-scratch operation (none needed this task), or a `--linked`/read-only `supabase db query`/`functions list`/`projects list` call against Production, confirmed read-only by inspection of every query executed (all `SELECT`/existence checks, zero `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP` against Production).

---

## 13. SIX-FILE CONTINUITY LEDGER

| File | Status |
|---|---|
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED — Step 3 addendum appended to §115; three new Owner findings recorded in open-findings state |
| `PROFLOW_CHAT_HANDOFF.md` | UPDATED — §14 resume pointer rewritten for Step 3 |
| `PROFLOW_ARCHITECTURE.md` | UPDATED — §14.A cross-referenced with Step 3's Production recheck; no architectural change (none needed) |
| `PROFLOW_HANDOFF.md` | UPDATED — §18.FH appended |
| `PROFLOW_TODO.md` | UPDATED — continuity log extended; three new Owner findings added to backlog, explicitly unassigned/not-root-caused |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED — this file, fully rewritten |

## CONTINUITY COMMIT

`1e8bcdcc2a97060f17edb9841b114edc9159effc` on `proflow-continuity` (pushed to `origin/proflow-continuity`) — the substantive Step 3 documentation update (all six files). Matching commit exists locally on `main` (`58a3095`), **not pushed**, per `MAIN PUSH: NO`.

## REMOTE GITHUB READ-BACK

**PASS** — verified via GitHub API immediately after the `1e8bcdc` push: `GET /repos/quotecode-dev/quotecode-clean/git/refs/heads/proflow-continuity` returned `sha: 1e8bcdcc2a97060f17edb9841b114edc9159effc`, matching the local push exactly. All six canonical files return HTTP 200 at `ref=proflow-continuity`. Raw-content fetch of this file confirmed the Step 3 markers present and readable ("READY FOR LIVE AUTHORIZATION", the FINAL STOP line).

---

## RECOMMENDED NEXT STEP (ONE step only)

Owner + ChatGPT review this manifest and, if satisfied, grant explicit LIVE execution authorization for Steps 1-8 in §7 (with Step 6 and 7's observation/verification gates honored exactly as specified) — at which point a dedicated Wave 2 LIVE execution task (separately authorized, not this one) would carry it out.

---

## FINAL STOP

FINAL STOP. DO NOT EXECUTE WAVE 2 LIVE. DO NOT START WAVE 3. WAIT FOR OWNER + CHATGPT REVIEW.
