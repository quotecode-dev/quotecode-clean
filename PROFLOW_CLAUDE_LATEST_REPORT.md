# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence — see below). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** CONTINUITY DOCUMENTS ≠ FRESH LOCAL WORKING TREE either. See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

---

## Task: PROFLOW — Retry Canonical Release Order Step 2 (Production DB Backup + Restore Verification)

**Effort level**: HIGH. **Owner + ChatGPT explicit authorization — STEP 2 ONLY.** No other release step authorized or executed.

**Result: STEP 2: PASS.**

### 1. Fresh Local State at Task Start

`main`: `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged. `git status --short`: `.gitignore` + six `PROFLOW_*.md` modified, three untracked migration-package items — identical to every prior task's baseline. Continuity worktree: `HEAD == origin/proflow-continuity == eafd08ad864abc5a95cd2143a4b44532d36a26d2` (the prior §18.CB FAIL record), clean. Both freshly re-verified, matching the continuity documents with no conflict — bootstrap reconciliation confirmed clean before any technical work began.

### 2. Confirmed Production Project Identity (sanitized)

`ixabnzhjeqevtbhdfswv` — name `quotecode`, region `eu-central-1`, Postgres `17.6.1.147`, `linked: true`, freshly re-verified via `supabase projects list`. The only linked project; `quotecode-test` (`ljfizgrdyzxddswcedwr`) confirmed `linked: false` and never targeted.

### 3. Docker Availability / Result

`docker version` returned real Client (29.7.2) and Server (Docker Desktop 4.88.1, Engine 29.7.2) information — daemon reachable and working. This resolves the exact blocker recorded in the prior Step 2 attempt (§18.CB).

### 4. Exact Backup Mechanism Used

Real (non-dry-run) `supabase db dump --linked` for schema, then `supabase db dump --linked --data-only --use-copy` for data. **`--dry-run` was never used**, per the permanent lesson recorded after the prior attempt's credential-exposure incident. Docker pulled `public.ecr.aws/supabase/postgres:17.6.1.147` (matching Production's own engine version) to execute both dumps.

### 5. Backup Start/End Time

Start (filename timestamp, immediately before first dump): `2026-08-29T19:33:44Z`. Schema dump file completion: `2026-08-29T19:34:56Z`. Data dump file completion: `2026-08-29T19:35:14Z` (end).

### 6. Backup Path

Both outside the repository, in the session scratchpad directory:
- `.../scratchpad/proflow-backups/proflow-production-schema-20260829-193344Z.sql`
- `.../scratchpad/proflow-backups/proflow-production-data-20260829-193344Z.sql`

### 7. Backup Format/Type

Plain-text SQL (`pg_dump` default format) — schema-only DDL dump and a separate data-only dump using `COPY` statements (`--use-copy`), scoped to the `public` schema (internal Supabase platform schemas excluded by the CLI's own standard exclusion list).

### 8. Backup File Size

Schema: 34,242 bytes. Data: 1,568,848 bytes.

### 9. Backup SHA-256

Schema: `b8defc86b3731c598ac5a465d8a109e6ad1b38414a5396ff2b4e5afb05bfdcd9`
Data: `d9aaef0a715e2407f8d45ae9010f9f350295c7f41bba350427cfb25691a74ff5`
Both independently re-verified byte-identical inside the restore container after `docker cp`.

### 10. Confirmation Backup Is Outside Git and Not Staged

`git status --short` before and after this task is identical (no new entries). `git check-ignore -v` on the backup file path returned "outside repository" — confirmed by Git itself, not by path inspection alone.

### 11. Exact Isolated Restore Target

A disposable, throwaway local Docker container (`postgres:17`, name `proflow-restore-verify`, `--rm`, no persistent volume). Confirmed empty (0 tables in `public`) before any restore activity. Never Production, never `quotecode-test`.

### 12. Restore Method

Backup files copied into the container via `docker cp` (checksum-verified post-copy); schema loaded via `psql -f /tmp/schema.sql`, then data via `psql -f /tmp/data.sql`, both executed inside the container against its own local database only.

### 13. Restore Result

**Successful for all application content.** 9 tables, 3 sequences, 12 functions, 5 triggers created; all 9 `COPY` data-loads for the 9 application tables completed (row counts below). 123 (schema) + 30 (data) non-fatal errors occurred, and every single one was independently confirmed to be a Supabase-platform-only object unavailable in a bare Postgres image (`anon`/`authenticated`/`service_role` roles; `auth`/`extensions`/`storage` schemas; `supabase_realtime` publication; `pgjwt`/`pg_net`/`supabase_vault` extensions) — zero errors touched any `public`-schema table, data row, function, or trigger.

### 14. Structural/Schema Verification Performed

- Table list (`pg_tables`): `business_settings`, `chat_logs`, `clients`, `expenses`, `quote_attachments`, `quote_items`, `quotecode_documents`, `quotes`, `services` — matches the documented live schema exactly.
- Sequences: `business_settings_id_seq`, `quotes_quote_number_seq`, `services_id_seq`.
- Functions (12): includes `approve_quote_public`, `guard_quote_immutability`/`_delete`, `is_admin`, `is_super_admin`, `handle_user_migration`, etc. — no `allocate_quote_number` present, consistent with the documented "not yet migrated" live state.
- Triggers (5): immutability guards on `quotes`, `quote_items`, `quote_attachments`, `business_settings`.
- `quotes` table structure (`\d quotes`): `quote_number integer NOT NULL DEFAULT nextval('quotes_quote_number_seq')` confirmed present exactly as documented in the original LIVE audit (§18.BN).
- All 24 `CREATE POLICY` statements confirmed present in the backup file content itself (direct grep), even though most could not structurally apply in this bare-Postgres target (they reference `auth.uid()`/`authenticated`, platform-provided objects) — the backup **captures** RLS policy definitions; a bare-Postgres restore target simply cannot **apply** them without the Supabase Auth layer. This is stated explicitly per the authorizing task's own requirement not to overstate what a plain PostgreSQL dump captures vs. Supabase platform components.

### 15. Additional Consistency Checks Performed

Row counts per table (`business_settings` 12, `chat_logs` 77, `clients` 24, `expenses` 1, `quote_attachments` 3, `quotecode_documents` 6, `quote_items` 32, `quotes` 23, `services` 12). Aggregate-only cross-check on `quotes`: 7 distinct `user_id`s, `quote_number` range 11–89, `quotes_quote_number_seq.last_value = 90` — an **exact independent match** to the original live-audit finding recorded in `PROFLOW_HANDOFF.md` §18.BN ("23 historical quotes across 7 distinct user_ids... last_value=90"), now reproduced via a completely different method (full dump+restore rather than a direct `SELECT`). This is strong evidence the backup genuinely reflects live Production state. No customer names/emails/addresses/quote content were displayed in any command output — aggregate counts and metadata only, per the task's explicit requirement.

### 16. Warnings/Errors Encountered

123 + 30 = 153 total restore-time errors, all explained and attributed to Supabase-platform-only objects (see item 13). Zero unexplained errors. Zero errors touching application data or schema.

### 17. Final Verdict

**STEP 2: PASS**

### 18. Confirmation STEP 3 Was NOT Executed

Confirmed. No Attn migration, no Quote Number migration, no counter initialization, no DEFAULT removal, no RPC/RLS/grants change on Production, no Edge Function deploy, no application change of any kind.

### 19. Confirmation Production Was Not Mutated

Production access this task was limited to exactly three read/export operations: `supabase projects list` (identity check), `supabase db dump --linked` (schema export), `supabase db dump --linked --data-only --use-copy` (data export). All are read-only export operations against Production — no `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP`/`db push` was ever issued against Production.

### 20. Documentation Files Changed

`PROFLOW_TODO.md` (canonical Step 2 line updated FAIL → PASS with full result summary), `PROFLOW_HANDOFF.md` (new §18.CC entry — full restore-verification record), `PROFLOW_CLAUDE_LATEST_REPORT.md` (this report). `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_ARCHITECTURE.md`, `PROFLOW_CHAT_HANDOFF.md` — reviewed, genuinely not required this task.

### 21. Secret/Privacy Scan Result

No credential was printed to terminal output this task (the prior attempt's `--dry-run` mistake was not repeated). Standard pre-sync diff scan on the three changed documentation files (password/API-key/service-role-key/token/JWT/private-key/connection-string patterns) found only narrative/conceptual matches (rule names, checksum values, migration/table names) — no actual secret value present in any file being committed. **PASSED.**

### 22. Fresh Git State at Task End

Recorded in the chat response following this report.

### 23. Confirmation Application/`main` Remained Untouched

`main` HEAD/`origin/main` unchanged (`17ac4d3`) throughout; all git operations this task targeted the separate `proflow-continuity` worktree exclusively. No application source file was read, edited, staged, committed, or pushed.

---

## Per-Changed-File Table

| FILE | WHAT CHANGED | WHY | SOURCE/EVIDENCE | STATUS |
|---|---|---|---|---|
| `PROFLOW_TODO.md` | Canonical Step 2 line updated from 🔴 FAIL to ✅ PASS, with backup/restore result summary | Step 2 is no longer the release blocker — record the genuine, verified result | This task's own `supabase db dump`/Docker restore commands and output | DONE |
| `PROFLOW_HANDOFF.md` | New §18.CC entry — full backup creation, restore, and verification record, including the independent cross-validation against §18.BN's original A90 finding | Standing chronological-record pattern; the cross-validation is a genuinely significant new fact worth preserving | This task's own command outputs (`docker`, `psql`, `supabase` CLI) | DONE |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | This file — full Final Report for this task | Standing rule | — | DONE |
| `PROFLOW_PROJECT_CONTEXT.md` | Nothing this task | Reviewed — no backup-mechanism content, genuinely not required | Grep, no match | REVIEWED, NOT CHANGED |
| `PROFLOW_ARCHITECTURE.md` | Nothing this task | Reviewed — no backup-mechanism content, genuinely not required | Grep, no match | REVIEWED, NOT CHANGED |
| `PROFLOW_CHAT_HANDOFF.md` | Nothing this task | Reviewed — no backup-mechanism content, genuinely not required | Grep, no match | REVIEWED, NOT CHANGED |

---

**STEP 2: PASS — Production database backup created and genuinely restore-verified.** This step is no longer the release blocker. The next canonical step (Step 3: Attn-columns migration) requires its own separate, explicit Owner + ChatGPT authorization — **not granted or executed by this task.**

NO ATTN MIGRATION
NO QUOTE NUMBER MIGRATION
NO PRODUCTION DB MUTATION
NO PRODUCTION RESTORE
NO EDGE FUNCTION DEPLOY
NO APPLICATION CHANGE
NO APPLICATION COMMIT
NO MAIN COMMIT
NO MAIN PUSH
NO VERCEL CHANGE
NO STEP 3
