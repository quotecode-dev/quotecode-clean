# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence — see below). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** CONTINUITY DOCUMENTS ≠ FRESH LOCAL WORKING TREE either. See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

**No secrets appear in this file.**

---

## Task: PROFLOW — Full Runtime TEST Environment Build Plan (PLAN ONLY, NO IMPLEMENTATION)

**Effort level**: HIGH. Owner + ChatGPT explicit authorization to produce the exact implementation plan to turn `quotecode-test` into a safe, functional, full-runtime ProFlow TEST environment. **Nothing implemented.**

**FINAL VERDICT: FULL RUNTIME TEST BUILD: READY WITH BLOCKERS**

---

### 1. Fresh State

- **Documented state**: matched all six continuity documents exactly, no drift, at task start and end.
- **Current local repository state**: `main` `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged throughout. `git status --short` identical to every prior task's baseline.
- **Production state**: read-only inspected fresh this task (full inventory below) — genuinely current, not assumed from prior tasks.
- **`quotecode-test` state**: read-only re-inspected fresh this task, confirmed identical to the immediately preceding audit (§18.CJ) — no drift, no mutation occurred between tasks.
- **Facts verified fresh in this task**: the entire Production inventory in §2 below, plus a fresh re-check of TEST's 2-table/3-function/0-storage-bucket state.
- Target guard: explicit `supabase link --project-ref ljfizgrdyzxddswcedwr` + fresh `projects list` confirmation before every TEST query; CLI relinked to Production and freshly confirmed restored at task end.

### 2. Production vs TEST Inventory

**Production (`ixabnzhjeqevtbhdfswv`) — full inventory, freshly queried:**

- **9 tables**: `business_settings`, `chat_logs`, `clients`, `expenses`, `quote_attachments`, `quote_items`, `quotecode_documents`, `quotes`, `services` — full column/type/nullable/default list captured for every table.
- **Constraints**: 9 primary keys, 6 foreign keys (`business_settings.user_id`→`auth.users`, `clients.user_id`→`auth.users`, `expenses.user_id`→`auth.users` `ON DELETE CASCADE`, `quote_attachments.quote_id`→`quotes` `ON DELETE CASCADE`, `quote_items.quote_id`→`quotes` `ON DELETE CASCADE`, `quotes.client_id`→`clients` `ON DELETE CASCADE`, `quotes.user_id`→`auth.users`), 1 unique constraint (`business_settings.user_id`). **No unique constraint on `quotes(user_id, quote_number)` exists yet** — confirms the Quote-Number migration chain (canonical Step 4) has not been applied to Production, consistent with everything already documented.
- **RLS**: enabled on **all 9 tables**. 24 policies total across the 9 tables, full list captured (notably: `quotecode_documents` and parts of `expenses` intentionally allow broad/public access by design — pre-existing Production behavior, not a gap).
- **Grants**: `anon` holds full table-level grants on `expenses`, `quotecode_documents`, `services` (pre-existing, RLS-gated); no `anon` grant on `business_settings`/`chat_logs`/`clients`/`quote_attachments`/`quote_items`/`quotes`.
- **Functions (12, all `SECURITY DEFINER`)**: `approve_quote_public` (2 overloads, legacy — confirmed via Agent HE **not called by any current frontend code**), `guard_business_settings_plan_trial`, `guard_quote_child_immutability`, `guard_quote_immutability`, `guard_quote_immutability_delete`, `handle_user_migration`, `increment_quote_views`, `is_admin`, `is_super_admin`, `public_approve_quote` (the one actually called by `PublicQuote.jsx`/`PublicQuoteEn.jsx`), `public_increment_quote_view`. Four functions (`approve_quote_public` both overloads, `handle_user_migration`, `increment_quote_views`) have **no explicit `search_path` set** — a pre-existing Production characteristic to replicate faithfully, not "fix" in TEST (would create drift).
- **Triggers**: `guard_business_settings_plan_trial_update`, `guard_quote_attachments_immutability`, `guard_quote_items_immutability`, `guard_quote_immutability_delete_trigger`, `guard_quote_immutability_update`, and critically **`on_auth_user_created_migration`** on `auth.users` (AFTER INSERT OR UPDATE, calls `handle_user_migration()`) — a legacy safety-net that re-links business data to a new `user_id` if a matching `business_settings.email` exists under an old `user_id`; confirmed by Agent HE as **not exercised by normal fresh signups**, present-but-inert for TEST purposes.
- **Sequences**: `business_settings_id_seq`, `quotes_quote_number_seq` (last_value 90 — the live global sequence powering `quotes.quote_number`'s `DEFAULT`), `services_id_seq`.
- **Storage**: 1 bucket `quote-files` (public), 2 object policies (`authenticated` INSERT, `public` SELECT).
- **Edge Functions (11 deployed)**: `clever-processor`, `send-welcome-email`, `send-quote-email`, `chat-ai`, `admin-delete-user`, `send-trial-expiration-email`, `send-subscription-expiration-email`, `resend-email-webhook`, `billing-checkout-stub`, `get-public-quote`, `admin-cleanup-user-quotes`.

**`quotecode-test` (`ljfizgrdyzxddswcedwr`) — full inventory, freshly re-queried, unchanged from the prior audit:**

- **2 tables only**: `business_quote_sequences`, `quotes` (9 columns — just the item-17/18 additions, missing 14 of Production's 23 `quotes` columns and all 7 other tables entirely).
- **RLS**: enabled on `business_quote_sequences`, **disabled** on `quotes`.
- **Grants**: `anon` holds full grants on `quotes` (no RLS to gate it).
- **3 functions**: `allocate_quote_number`, `is_super_admin` (**`SECURITY DEFINER = false`** — drifted from Production's `true`), `protect_quote_number_immutability`.
- **Storage**: 0 buckets.
- **Edge Functions**: 0 deployed.
- **Auth users**: 5 synthetic `fixture-business-{a..e}@example.invalid` accounts only.

### 3. Authoritative-Source Matrix

| Object | Category | Notes |
|---|---|---|
| Entire base schema (8 of 9 tables, `quotes`' original 23 columns, all RLS policies except the quote-number ones, all 9 non-quote-number functions, `on_auth_user_created_migration` trigger, storage bucket+policies) | **B — Production only** | Not represented in any tracked `supabase/migrations/*.sql` file. This predates the repo's own migration history entirely. |
| `quotes_quote_number_seq` + `quotes.quote_number`'s live `DEFAULT nextval(...)` | **B — Production only** | The repo's own `20260827000000_add_quote_number_sequence.sql` explicitly does not touch this column (confirmed by its own header comment) — Agent EN independently confirmed this is a genuine untracked dependency needed by both `get-public-quote` and `send-quote-email`. |
| The 6 tracked quote-number/attn migrations (`20260827000000`→`20260827000003`, `202608270000015`, `20260828000000`) | **C — both, and identical (on TEST only)** | Confirmed applied to `quotecode-test`; confirmed **not** applied to Production (canonical Steps 3–4 remain unexecuted, per `PROFLOW_TODO.md`). |
| `is_super_admin` function | **D — both, but drifted** | Exists on both, but `SECURITY DEFINER` is `true` on Production, `false` on `quotecode-test`. |
| `get-public-quote`, `send-quote-email`, `chat-ai`, `admin-delete-user`, `admin-cleanup-user-quotes`, `billing-checkout-stub`, `send-trial-expiration-email`, `send-subscription-expiration-email`, `resend-email-webhook` (9 Edge Functions) | **C on repo/Production, D vs. `quotecode-test`** | Source tracked in `supabase/functions/`; deployed to Production (some versions stale relative to local source — `get-public-quote`/`send-quote-email` confirmed last deployed 2026-08-25, predating local quote_number/Attn changes); **zero deployed to `quotecode-test`**. |
| `clever-processor`, `send-welcome-email` (2 Edge Functions) | **B — Production only** | Deployed via a different, untracked mechanism (their `entrypoint_path` doesn't match the repo's `supabase/functions/` structure like the other 9 do) — no local source exists at all. Agent EN confirmed `send-welcome-email` is not invoked by any signup flow in tracked code — orphaned, not a flow blocker, but its own definition is unrecoverable from Git. |
| Auth-service settings (email confirmation, redirect-URL allowlist, SMTP behavior) | **E — unknown** | Not queryable via SQL or this CLI session for either project; would need direct Dashboard comparison. |

**Conclusion**: TEST **cannot** currently be built reproducibly from Git alone — the overwhelming majority of required objects are category B (Production-only, undocumented). This is the central, first-order finding driving the phase ordering below.

### 4. Schema Drift

Beyond the wholesale absence covered above, the one direct like-for-like drift found: `is_super_admin`'s `SECURITY DEFINER` flag (Production `true`, TEST `false`) — see §3.

### 5. Security/RLS Gaps (TEST)

RLS disabled on `quotes` in TEST with `anon` holding full grants — the exact opposite of Production's posture (RLS enabled, no `anon` grant) for that table. Must be corrected as part of the schema-capture work, not left as-is merely because TEST data is synthetic (per the task's own explicit instruction).

### 6. Storage Gaps (TEST)

Zero buckets exist. `quote-files` (public, with its 2 policies) must be created for any attachment-related or Public-Quote-attachment testing to function.

### 7. Edge Function Matrix

| Function | Classification | Tracked source? | Side-effect risk |
|---|---|---|---|
| `get-public-quote` | **REQUIRED FOR BASIC TEST** | Yes | None — pure read |
| `send-quote-email` | **REQUIRED FOR BASIC TEST** | Yes | **Sends a real email via Resend** (`RESEND_API_KEY`) — must be restricted to Owner-controlled test addresses or a Resend test/sandbox key before use |
| `chat-ai` | REQUIRED FOR FULL TEST (only if AI chat itself is being tested) | Yes | Real AI-API billing/cost per call — use sparingly |
| `admin-delete-user`, `admin-cleanup-user-quotes` | REQUIRED FOR FULL TEST (only for Admin-panel testing) | Yes | Destructive by design (delete operations) — inherently safe in TEST since all data there is synthetic |
| `billing-checkout-stub`, `send-trial-expiration-email`, `send-subscription-expiration-email`, `resend-email-webhook` | NOT REQUIRED for core application-flow testing | Yes | `send-*-email` functions carry the same real-email caveat as `send-quote-email` if ever exercised |
| `clever-processor`, `send-welcome-email` | NOT REQUIRED (confirmed unused in tracked signup flow) | **No — untracked** | Unknown; not invoked by any current code path |

**Deployment-version decision needed**: the currently-*deployed* versions of `get-public-quote`/`send-quote-email` on Production predate the local quote-number/Attn work — recommend deploying the current **local tracked source** to `quotecode-test` (not a copy of Production's stale deployed version), since testing the newer code is the actual purpose.

### 8. Auth Requirements

Cannot be verified or configured via this CLI session. **Owner Dashboard checklist for `quotecode-test`** (future, not performed here):
- Confirm email/password Auth provider is enabled.
- Configure the Auth redirect-URL allowlist to include local LAN test URLs — at minimum `http://192.168.1.189:5186/*` (and `5184` if ever dual-purposed), matching the exact pattern already configured for Production per `PROFLOW_HANDOFF.md`'s existing redirect documentation.
- Decide/confirm email-confirmation-required behavior (recommend: disabled or auto-confirmed for TEST, to avoid needing real inbox access for synthetic test accounts) — Owner decision, not Claude's to set.
- Confirm password-reset email behavior (will use Supabase's default sender unless custom SMTP is configured for this project — likely not yet configured).

### 9. Synthetic-Data Policy

**No real Auth users, emails, passwords, customers, businesses, quotes, attachments, chat history, expenses, documents, sessions, tokens, or secrets may ever be copied into TEST.** Structure only. Three future synthetic accounts specified (none created by this task):
- **Local/HE TEST user** — fictional Hebrew business, `country='Local'`, `currency='ILS'`.
- **International/EN TEST user** — fictional business, `country='International'`, `currency` one of USD/EUR/GBP.
- **TEST Admin** (if Admin-panel testing is desired) — `role='super_admin'` equivalent, fictional identity.

Per Agent HE's finding: any manually-inserted `business_settings` row for these accounts (if not created via the normal app signup flow) must satisfy the RLS INSERT policy's exact condition — `plan='pro'` with `trial_ends_at` within ~14 days of insert time (the actual, only payload shape `Dashboard.jsx`'s real signup flow produces for both markets).

### 10. HE Requirements (Agent HE, full findings)

Confirmed exact `business_settings` INSERT payload for Local signup (`user_id`, `email`, `business_name`, `country='Local'`, `currency='ILS'`, `plan='pro'`, `role='user'`, `default_terms`, `trial_ends_at`, `last_sign_in`). VAT correctness depends only on `quotes.client_type` and `quotes.tax_rate` (both plain columns, no separate config table — VAT rate 18% is a hardcoded frontend constant). Confirmed the frontend calls only `public_approve_quote(p_quote_id, p_signature_data_url)` — the legacy `approve_quote_public` overloads are dead code from the frontend's perspective and are **not required** for TEST to support the real approval flow. `on_auth_user_created_migration` confirmed inert for fresh TEST signups.

### 11. EN Requirements (Agent EN, full findings)

Confirmed the International signup payload differs from Local only in `currency`/`default_terms` — the RLS-relevant `plan`/`trial_ends_at` shape is identical, so no International-specific RLS gap exists. Confirmed no exchange-rate/currency-config table exists anywhere — currency handling is entirely `business_settings.currency`+hardcoded symbol maps. **Identified the `quotes_quote_number_seq` untracked-dependency finding** (§3) via direct read of both Edge Functions' own audit comments. Confirmed `send-welcome-email` is not invoked in any signup path (Local or International) — its untracked source is a footnote, not a blocker. Confirmed the International-must-never-show-VAT invariant is purely frontend-conditional (`QuoteForm.jsx`), with no backend/DB enforcement — TEST needs no special backend safeguard for it.

### 12. Recommended Build Strategy

**Hybrid, closest to Option B+A**: (1) schema-only extraction from Production via `supabase db dump --linked --schema-only` targeting **only the objects genuinely needed** (not a blind full dump — filtered/reviewed against this task's own inventory), (2) manually reviewed and converted into new, clean, idempotent tracked migration files (mirroring the same style/discipline already used for the 6 existing quote-number/attn migrations — `IF NOT EXISTS` guards, explicit rollback comments, no data), (3) applied to `quotecode-test` via `supabase db push`, never to Production (Production already has this schema natively — reapplying would be redundant and risky). This directly answers §6's own question: after this work, TEST **would** become reproducible from Git, closing the current category-B gap. Rejected: a blind `pg_dump`-and-restore of Production's full schema, since that would import undocumented objects wholesale without the review/reconciliation step this task's own §6 explicitly requires, and would risk carrying over Production-specific artifacts inappropriate for a disposable TEST project.

### 13. Ordered Implementation Phases

Building on the Owner's own suggested skeleton, adjusted per fresh evidence (a schema-capture phase must precede the TEST build, since almost nothing is currently reproducible from Git):

**Phase 1 — Capture/reconcile schema into new tracked migrations.** Scope: author new migration file(s) for the base schema (8 missing tables, `quotes`' remaining 14 columns, all RLS policies, functions, triggers, storage bucket+policies, `quotes_quote_number_seq`+its DEFAULT), reviewed against this task's own inventory and the `is_super_admin` drift. Environment: local file authoring only, informed by read-only Production queries (already done this task). Expected mutation: **new local files only, zero DB mutation anywhere.** Validation: `supabase db push --project-ref ljfizgrdyzxddswcedwr --dry-run` shows exactly the expected new objects. HE check: schema includes everything Agent HE's flow needs (§10). EN check: schema includes everything Agent EN's flow needs (§11), including `quotes_quote_number_seq`. Rollback: delete the new files, nothing was ever applied. STOP condition: any Production object that can't be faithfully expressed in SQL (none currently expected, but must be confirmed during authoring). **Owner authorization required**: yes — this task authorizes planning only, not file authoring.

**Phase 2 — Apply captured schema to `quotecode-test` only.** Environment: `quotecode-test`, via `supabase db push --project-ref ljfizgrdyzxddswcedwr` (never `--linked` while linked to Production; explicit target-guard confirmation required as established in every prior task). Expected mutation: TEST gains the full 9-table schema, structure only, zero data. Validation: re-run this task's own inventory queries against TEST, diff against Production's captured inventory (§2). Rollback: TEST is disposable — a targeted `DROP`/re-migrate or, in the worst case, project-level reset is acceptable (low stakes, no real data). STOP condition: any migration failure — investigate before continuing. **Owner authorization required**: yes, separate and explicit.

**Phase 3 — TEST security/RLS verification.** Scope: confirm RLS is enabled on all 9 tables post-Phase-2 with policies matching Production, confirm `anon` grants match Production's exact per-table pattern (full on `expenses`/`quotecode_documents`/`services` only, none elsewhere). Validation: re-run the RLS/grants queries from §2, diff against Production. HE/EN checks: N/A yet (no data). Rollback: adjust policies/grants via a follow-up migration. STOP condition: any table ends up more permissive than intended. **Owner authorization required**: likely covered by Phase 1's migration content itself if RLS/grants are included there — confirm during Phase 1 review.

**Phase 4 — Storage.** Scope: create the `quote-files` bucket (public) + 2 object policies in TEST, matching Production exactly. Likely folded into Phase 1's migration (storage.buckets is a regular table, insertable via SQL) — called out as its own explicit validation gate per the Owner's requested phase skeleton. Rollback: drop the bucket. STOP condition: bucket creation via SQL insert into `storage.buckets` behaves unexpectedly (Supabase sometimes has platform-level bucket provisioning quirks — verify). **Owner authorization required**: yes, if not already covered by Phase 1's authorization.

**Phase 5 — Edge Functions.** Scope: deploy `get-public-quote` and `send-quote-email` (current local tracked source, not Production's stale deployed version) to `quotecode-test` first (REQUIRED FOR BASIC TEST); `chat-ai`/admin functions only if/when Full Test is desired. Environment/secrets by name only (no values): `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` (or equivalent service-role secret), `SUPABASE_ANON_KEY`, `RESEND_API_KEY` for `send-quote-email`. Real-world side-effect mitigation: restrict `send-quote-email` testing to Owner-controlled inboxes, or obtain a Resend sandbox/test key before deploying. Validation: invoke each deployed function against a synthetic TEST quote once Phase 7's accounts exist. Rollback: `supabase functions delete` (not exercised by this task). STOP condition: any function deploy requires a secret this task cannot name without exposing a value — none currently expected, since all four secrets above are already known-by-name from the existing Production deployment. **Owner authorization required**: yes, separate and explicit (this is the first Edge Function deploy of this engagement to any project).

**Phase 6 — Auth configuration (manual, Dashboard-only).** Scope: the Owner personally completes the checklist in §8 directly in the `quotecode-test` Supabase Dashboard — not automatable from this CLI session. Validation: attempt a test signup once Phase 8 connects local dev to TEST. STOP condition: redirect URLs misconfigured causing Auth email links to fail — diagnosable only after Phase 8. **Owner authorization**: this phase IS the Owner's own action, no Claude authorization needed, but should be sequenced here.

**Phase 7 — Synthetic TEST accounts.** Scope: create the three accounts named in §9, natively in `quotecode-test`'s own Auth (never reusing Production credentials). Validation: each account's `business_settings` row satisfies the RLS INSERT policy (§9). Rollback: delete the Auth users (trivial, synthetic data only). STOP condition: RLS policy rejects the insert — revisit Phase 1's captured policy definition. **Owner authorization required**: yes — explicit "create these 3 accounts in TEST" authorization, separate from everything above.

**Phase 8 — Local Vite → TEST connection.** Scope: create the local-only `.env.localtest.local` (per the prior task's §18.CJ Option A design) and start 5186 with `--mode localtest`, pointing only that port at TEST — 5184 stays on Production. Validation: app loads without the "missing table" errors seen in earlier diagnostics. Rollback: delete the file, restart without `--mode`. STOP condition: any unexpected Production-pointing behavior (verify `VITE_SUPABASE_URL` resolved correctly before testing). **Owner authorization required**: yes, separate — this is the actual runtime-target change.

**Phase 9 — HE smoke test.** Scope: log in as the Local/HE TEST account, create a quote, verify ILS/VAT display correctness, verify Public Quote page loads (via the now-deployed `get-public-quote`), verify the approval/signature flow (`public_approve_quote`), verify `send-quote-email` behavior stays within the side-effect mitigation from Phase 5. Agent HE re-engaged at execution time to independently verify. Rollback: delete the synthetic test quote/data. STOP condition: any VAT/RTL/ILS-market-isolation violation. **Owner authorization required**: yes, to execute this smoke test itself.

**Phase 10 — EN smoke test.** Scope: same as Phase 9 for the International/EN TEST account — explicit negative checks for VAT/₪ leakage, correct USD/EUR/GBP display. Agent EN re-engaged at execution time. Rollback/STOP: same pattern as Phase 9. **Owner authorization required**: yes.

### 14. Validation Gates

Each phase above carries its own explicit validation step (re-query and diff against the Production inventory captured this task, or a functional smoke check) — no phase is considered complete without its stated validation passing.

### 15. Rollback Strategy

Summarized per-phase above; general principle: Phases 1 (file authoring) and 8 (env file) are trivially reversible (delete a file); Phases 2–5 and 7 operate exclusively against the disposable, isolated `quotecode-test` project, where a full project-level reset is an acceptable last-resort rollback (unlike Production, where this class of action would never be acceptable); Phase 6 is a manual Dashboard action with its own undo via the same UI.

### 16. Exact Owner Approval Gates

Every phase above is marked with its own required authorization — **none of Phases 1–10 may proceed without a separate, explicit Owner + ChatGPT authorization naming that exact phase**, consistent with this task's own instruction that this is plan-only.

### 17. Production Protection Confirmation

Confirmed throughout: Production was accessed exclusively read-only this task (all queries were `SELECT`/metadata calls); `minhatshay@gmail.com` and David Aluminum were not touched, queried, or referenced beyond their already-documented protected status; no Production secret value was ever printed or written; no plan phase above targets Production for any mutation — Phase 1's captured migrations are explicitly scoped to apply to `quotecode-test` only (§12).

### 18. Admin-Badge Deferred-Item Confirmation

Recorded as its own, separate, deferred future item (per §18.CJ) — **not** implemented or mixed into this TEST-build plan. Current recommendation stands unchanged: do not change `minhatshay@gmail.com`'s Auth identity, do not alter customer-facing `business_name`; the preferred future solution remains an Admin-only visual marker with no customer-facing exposure, its own future authorization.

### 19. File-by-File Ledger

| FILE | WHAT CHANGED | HE IMPACT | EN IMPACT | STATUS |
|---|---|---|---|---|
| `PROFLOW_TODO.md` | New entry recording this build plan and its verdict | None — plan document | None — plan document | DONE |
| `PROFLOW_HANDOFF.md` | New §18.CK entry — full plan record | None | None | DONE |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | This file | None | None | DONE |
| Any application/migration/config file | **None changed** | N/A | N/A | ZERO MODIFIED — confirmed via `git status --short` identical before/after |

### 20. Secret/Privacy Scan

No password, access token, API key, service-role key, or anon key value appears anywhere in this report or the documentation entries. Edge Function secrets are named by variable name only (`SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`), never values. Project refs are non-secret identifiers already used throughout. **PASSED.**

### 21. Final Git State

Recorded in the chat response following this report.

### 22. Final Verdict

**FULL RUNTIME TEST BUILD: READY WITH BLOCKERS**

**Every blocker, explicitly**:
1. The base application schema (8 of 9 tables, most of `quotes`, all RLS/functions/triggers except quote-number-specific ones, storage bucket) exists **only** in Production, undocumented in Git — must be captured into new tracked migrations (Phase 1) before anything else can proceed reproducibly.
2. `quotes_quote_number_seq` and `quotes.quote_number`'s live `DEFAULT` are likewise untracked and required by both public-facing Edge Functions.
3. `is_super_admin`'s `SECURITY DEFINER` flag is drifted between Production and TEST — must be corrected during capture.
4. `quotecode-test`'s current RLS/grants posture on `quotes` is unsafe relative to Production's pattern — must be hardened, not left as-is.
5. Zero Edge Functions and zero storage buckets exist in `quotecode-test` — both must be built.
6. Auth-service configuration (redirects, email confirmation) is unverifiable from this CLI session — requires manual Owner Dashboard action.
7. `clever-processor` and `send-welcome-email` have no recoverable source at all — confirmed non-blocking (unused in tracked flows) but permanently unreproducible from Git as-is.

None of these blockers are unsolvable — each has a named phase and owner in the plan above — but every one requires its own separate, explicit future authorization before this environment becomes usable.

---

**PLAN COMPLETE. NOTHING IMPLEMENTED.**

NO PRODUCTION MUTATION
NO TEST MUTATION
NO SCHEMA CHANGES
NO MIGRATIONS APPLIED
NO AUTH CHANGES
NO USER CREATION
NO STORAGE CHANGES
NO EDGE FUNCTION DEPLOYMENT
NO `.ENV` CHANGES
NO VITE CHANGES
NO APPLICATION-CODE CHANGES
NO COMMIT/PUSH TO MAIN
NO VERCEL ACTION
NO STEP 3
NO QUOTE NUMBER PRODUCTION MIGRATION
NO REAL-CUSTOMER TESTING
