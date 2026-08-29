# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence — see below). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** CONTINUITY DOCUMENTS ≠ FRESH LOCAL WORKING TREE either. See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

**No secrets appear in this file** — no passwords, no anon/service-role keys.

---

## Task: PROFLOW — Local→TEST Supabase Separation + Live-International Visual Identification Audit (Read-Only)

### 1. Effort Level + Reason

**HIGH.** Owner + ChatGPT explicit authorization for a READ-ONLY architecture/safety audit covering two subjects: (A) how to make local dev use `quotecode-test` instead of Production safely, and (B) how to make the real live International account visually unmistakable in the Admin panel without touching its Auth identity. No implementation authorized.

### 2. Fresh Git/Local State

`main`: `HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged. `git status --short` identical to every prior task's baseline, before and after. Continuity: `HEAD == origin/proflow-continuity == 33bd9e70071d0f2f4237336d5ee229cf99cd0e37`, clean. Dev processes confirmed still running (PID 21028/5184, PID 17520/5186), untouched. Env files present: `.env` and `.env.example` only — no `.env.local`/`.env.[mode]` files exist yet. `.gitignore` already covers `.env`, `.env.local`, `.env.*.local` (confirmed, lines 30-32) — Vite's standard local-override mechanism is already safely gitignored and unused. CLI link state: Production before this task, briefly switched to TEST (confirmed via `projects list` before any query) for the read-only readiness audit, then restored to Production and freshly re-confirmed at task end.

### 3. Current Supabase Backend Used by 5184/5186

`.env`'s `VITE_SUPABASE_URL` = `https://ixabnzhjeqevtbhdfswv.supabase.co` — **Production**. Both 5184 and 5186 run `npm run dev` from the identical working directory with no mode flag, so both load the same `.env` and both currently point at Production — confirmed identical.

### 4. Current HE/EN Selection Mechanism

Unrelated to the Supabase backend entirely. `src/main.jsx` picks `<AppGlobal/>` vs `<AppLocal/>` per-visit via `?lang=` → URL path → per-origin `localStorage` → `navigator.language` (established in the prior 5186 diagnostic, §18.CH — not re-derived here). Both agents this task independently confirmed: switching the Supabase target has zero interaction with this logic.

### 5. Current Env Precedence

Vite's standard, unmodified precedence applies (nothing in this repo overrides it): for a given `--mode` (default `development`), Vite loads `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`, later files overriding earlier ones. `.env.local` and `.env.[mode].local` are already gitignored; `.env.[mode]` (without `.local`) is **not** currently covered by `.gitignore` and should never be used for secrets.

### 6. Current Production-vs-TEST Credential Mapping

All four named `.env` test-credential pairs (`PROFLOW_TEST_USER1_*`, `PROFLOW_TEST_USER2_*`, `PROFLOW_TEST_ADMIN_*`, `PROFLOW_TEST_INTL_*`) are **Production-backed** — confirmed directly against `auth.users`/`business_settings` in an earlier task this session. None exist in `quotecode-test` (confirmed this task: `auth.users` in `quotecode-test` contains only 5 synthetic `fixture-business-{a..e}@example.invalid` rows, unrelated to any named credential). No passwords reproduced here, per this task's own instruction.

### 7. Local→TEST Architecture Options

**Option A — Dedicated Vite mode + local-only env file.** `npm run dev -- --mode localtest --host --port 5186 --strictPort` (note: avoid naming the mode `test` — Vite/Vitest reserve special meaning for mode `test`, and this repo's own `vite.config.js` already configures Vitest; a collision would be confusing) with a new, local-only `.env.localtest.local` containing `quotecode-test`'s URL/anon key. File: local-only, already covered by the existing `.env.*.local` gitignore pattern — zero risk of accidental commit. Risk of LIVE pointing at TEST: none — Vercel Production builds pull env vars from Vercel's own dashboard config, never from this local file. Risk of LOCAL reverting to Production: only if the `--mode` flag is omitted, which is exactly today's status quo — not a new risk. Impact on 5184/5186: can be applied **asymmetrically** — keep 5184 (Hebrew, already firewall-approved, already Owner-phone-verified) on Production unchanged, point only 5186 (International) at TEST — directly targets the account this whole audit is about, without touching what already works. Impact on HE/EN: none (confirmed by both agents). Impact on Auth: entirely separate Auth user pool — none of the four existing `.env` credentials would work against TEST; a genuinely TEST-native Auth user would need to be created there separately (out of this task's scope). Impact on Edge Functions: `quotecode-test` has **zero** deployed Edge Functions (confirmed this task) — any feature depending on `get-public-quote`/`send-quote-email`/`chat-ai`/etc. would fail until those are deployed there too. Impact on password reset/email confirmation and Supabase redirects: **UNKNOWN/REQUIRES VERIFICATION** — Auth-service-level settings (email confirmation toggle, redirect-URL allowlist) are not readable via this CLI session without Dashboard access; almost certainly not yet configured for local LAN URLs, since `quotecode-test` was built only for DB-migration rehearsal. Impact on RLS/data visibility: **real gap found** — RLS is currently disabled on `quotecode-test`'s `quotes` table and `anon` holds full grants; low real-world risk today (only synthetic fixture data, no real customers), but must be fixed before genuine interactive testing, since the anon key ships client-side and is effectively public. Rollback: trivial — delete the local file or omit `--mode`. Vite restart: **required** (env vars are read once at server startup). Code changes: **none**.

**Option B — Plain `.env.local` (unconditional, no mode).** Same mechanism, but applies to every `npm run dev` invocation regardless of port/mode — would point 5184 (Hebrew) at TEST too, unless combined with a mode override to selectively revert it, which is more moving parts for a worse default. Less flexible than Option A for no benefit; not recommended as primary.

**Option C — Named npm script wrapper** (e.g. `"dev:test": "vite --mode localtest --host --port 5186 --strictPort"`). Same underlying mechanism as Option A, wrapped for convenience — but requires editing the tracked `package.json`, which this task's own absolute prohibitions forbid ("NO package/script change"). Worth adopting later as a pure convenience layer over Option A, with its own separate authorization.

**Option D — Other repo-supported mechanism.** None found; Vite's own env-mode system (Option A) is already the standard, idiomatic, zero-new-dependency mechanism.

### 8. Recommended Architecture

**Option A, applied asymmetrically**: keep 5184 on Production (unchanged, already working), point only 5186 at `quotecode-test` via `--mode localtest` + a new local-only `.env.localtest.local`. Zero code change, zero risk to the committed config, trivially reversible. **Conditioned** on the TEST-environment buildout in item 9 below before it would produce a genuinely usable app.

### 9. TEST Runtime Readiness Matrix

| Dependency | Status | Evidence |
|---|---|---|
| Auth configuration (email confirmation, redirect allowlist) | **UNKNOWN / REQUIRES VERIFICATION** | Not readable via CLI without Dashboard access |
| `business_settings` schema | **MISSING** | Table does not exist in `quotecode-test` |
| `quotes` schema | **PARTIAL** | Table exists but only 9 of Production's 23 columns (the item-17/18 additions only — no `client_id`, `currency`, `subtotal`, `total`, `terms`, etc.) |
| `clients` schema | **MISSING** | Table does not exist |
| Other core tables (`services`, `expenses`, `quote_items`, `quote_attachments`, `chat_logs`, `quotecode_documents`) | **MISSING** | None exist — confirmed via `pg_tables`, only `business_quote_sequences` + `quotes` present |
| RLS policies | **MISSING / DISABLED** | RLS explicitly `false` on `quotes`; `pg_policies` empty |
| Helper functions | **PARTIAL** | Only `allocate_quote_number`, `is_super_admin`, `protect_quote_number_immutability` exist (3 of ~12) — `is_admin`, `guard_quote_immutability`(`_delete`), `approve_quote_public`, `public_approve_quote`, `increment_quote_views`, `public_increment_quote_view`, `handle_user_migration` all absent |
| Triggers | **PARTIAL** | Only the quote-number-immutability trigger exists; the general content-immutability trigger (pre-existing on Production, never captured in any tracked migration) is absent |
| Edge Functions | **MISSING** | `supabase functions list --project-ref ljfizgrdyzxddswcedwr` returns zero functions |
| Storage dependencies | **MISSING** | `storage.buckets` is empty — no `quote-files` bucket |
| Required migrations (this repo's own 6 tracked files) | **READY** | All 6 confirmed applied via `migration list` |
| Seed/test fixtures | **PARTIAL** | 5 synthetic `fixture-business-*` accounts exist, but none configured for interactive Auth-based testing (no matching real login credentials) |
| Public/anon grants | **PARTIAL, NEEDS HARDENING** | `anon` holds full table-level grants on `quotes` — appropriate for the original disposable-migration-only use case, not for interactive multi-user testing |
| Email-confirmation behavior | **UNKNOWN / REQUIRES VERIFICATION** | Not inspectable via CLI |
| Redirect configuration | **UNKNOWN / REQUIRES VERIFICATION** | Not inspectable via CLI |

**Bottom line**: `quotecode-test` was purpose-built solely for isolated DB-migration rehearsal (Steps 2/3 of the Production release). It is **far** from a full app-runtime TEST environment — this task's own explicit warning not to assume otherwise is confirmed accurate.

### 10. Auth/Redirect Implications

Covered in item 9 — both classified `UNKNOWN / REQUIRES VERIFICATION`, since Supabase Auth-service settings are not queryable via SQL and this CLI session has no read path to the Dashboard-level config for a remote project. Would need direct Dashboard inspection (by the Owner, or a future session with different access) before relying on Auth flows (signup confirmation, password reset) against `quotecode-test`.

### 11. Edge Function Implications

Zero Edge Functions deployed to `quotecode-test` (confirmed via `supabase functions list`). Any feature depending on one (Public Quote page rendering, quote-email sending, AI chat, admin actions) would fail entirely if the frontend pointed there without first deploying equivalents — a real, non-trivial prerequisite, separate from the DB-schema gap.

### 12. HE Agent Verdict

No Hebrew/RTL-specific concern found. The Supabase-target switch is confirmed purely a backend concern, orthogonal to language logic — nothing in `AppLocal.jsx`/`main.jsx` assumes a specific project. The `business_settings` auto-init failure mode (missing table) would break Local and International signups identically, not differently. `business_quote_sequences`/`allocate_quote_number` is confirmed market-neutral (applies to all businesses, not an Israel-only mechanism).

### 13. EN Agent Verdict

Confirms the same architectural neutrality from the English/International side — `AppGlobal.jsx`/`LandingGlobal.jsx` have no Supabase-project dependency. Confirmed the bare `quotecode-test` schema would block signup universally (both markets) via the same fail-closed error path in `Dashboard.jsx` — not International-specific, and no VAT-leakage risk since the failure happens before any row (or VAT logic) executes. Independently confirmed Claude Lead's assessment that no existing Admin-UI field can double as a "genuinely real vs. test" signal. Pinpointed the exact leakage-risk files to check before any future admin-only field is added: `supabase/functions/get-public-quote/index.ts:97-98` and `send-quote-email/index.ts:153-154` (both already use narrow explicit `select()` allowlists — good precedent, a new field wouldn't leak unless someone later changes these to `select('*')`), plus `PublicQuoteEn.jsx`, `PublicQuote.jsx`, `PublicQuoteHeader.jsx` as the customer-facing renderers that must never read such a field.

### 14. Claude Lead Reconciliation

No disagreement between agents — both confirm the Supabase-target-switch design is language-neutral, and both independently validated the TEST-readiness gaps affect Local and International equally, not asymmetrically. Combined verdict below.

### 15. International TEST-Account Recommendation

**Compared**: (A) dedicated International account in a real TEST Supabase runtime — the correct long-term destination, but blocked today on the extensive readiness gaps in item 9; not creatable meaningfully until those are addressed. (B) dedicated synthetic International account inside Production — technically simpler right now (Production already has full schema/functions/Edge Functions/Auth config working), but directly conflicts with the entire point of this audit (minimizing Production testing) and was already the subject of the immediately preceding task's BLOCKED verdict for exactly this reason. (C) no other safer mechanism identified. **Recommendation**: pursue (A) as the target end-state — implement Option A's local→TEST pointing mechanism, then separately and explicitly address the readiness matrix (schema, RLS, functions, Edge Functions, Auth config) as its own authorized body of work, then create one dedicated International TEST Auth user natively in `quotecode-test`. No account created by this task.

### 16. Admin-Only LIVE-International Visual-Identification Options

1. **Admin-only display label from existing data** — **already exists today, zero risk, zero change**: `AdminUsersTab.jsx` and `UserDetailsModal.jsx` both already render `business_name` + `country` (with an "Intl"/"LCL" tag), confirmed by direct read and by Agent EN. This alone shows "International" but cannot express "definitely real, not test," since no field currently carries that intent.
2. **Business-name change in data** — **NOT SAFE, rejected**: `business_name` is customer-facing (appears in quotes, Public Quote pages, and emails sent to real clients) — embedding an internal label there would leak into real customer-facing output.
3. **New admin-only alias/nickname field** (e.g. a small `business_settings` boolean/text column, rendered only in Admin UI) — **safe in principle**, small and additive, zero Auth/customer-facing impact if the leakage-risk files named in item 13 are respected — but is a schema change, requiring its own separate future authorization; not created by this task.
4. **UI-only visual badge based on known account/market state** — two variants: (a) built on option 3's new field (robust, needs the schema change) or (b) a purely client-side hardcoded email match with zero DB change (technically zero-risk to data, but architecturally fragile/a magic-constant anti-pattern, not recommended as a lasting solution, acceptable only as a stopgap if option 3 is rejected).
5. **Email alias / Auth identity change** — **NOT appropriate, explicitly rejected**: this is the Owner's real login credential for his real account; changing it would disrupt his actual real-world usage, risks breaking anything tied to that email, and doesn't even solve the stated problem — Auth login identity is orthogonal to Admin-panel visual identification. Do not conflate the two.

### 17. Explicit Recommendation Regarding Email/Auth Aliasing

**Do not pursue.** As explained above, it solves the wrong layer of the problem (login credential, not admin display) while introducing real risk to the Owner's actual working account.

### 18. Safest Next Implementation Step — PLAN ONLY, NOT EXECUTED

If Owner + ChatGPT approve: (1) create the local-only `.env.localtest.local` (Option A) pointing 5186 at `quotecode-test`, restart that one dev process — zero code change, immediately reversible; (2) separately authorize the TEST-readiness buildout (schema/RLS/functions/Edge Functions/Auth config) as its own scoped body of work before relying on it for interactive testing; (3) once ready, create one dedicated International TEST Auth user natively in `quotecode-test`; (4) separately, if desired, authorize a small additive `business_settings` admin-only field (option 16.3) for the Admin-panel visual label, respecting the leakage-risk files named above.

### 19. Exact STOP Conditions

None triggered this task — this was a complete, evidence-based audit with no ambiguous target identity, no unexpected mutation risk encountered, and no point requiring an unplanned halt.

### 20. Confirmation No Files/Config/Env/Accounts/DB Were Changed

Confirmed. `.env`/`.env.local`/`vite.config.js`/`package.json` were read-only inspected, never written. No Auth user created, no password reset, no TEST or Production DB mutation (every query issued was read-only `SELECT`/`count`/metadata). CLI link state fully restored to its pre-task value (Production), freshly re-confirmed.

### 21. Exact Documentation Files Changed

`PROFLOW_TODO.md`, `PROFLOW_HANDOFF.md` (new entry), `PROFLOW_CLAUDE_LATEST_REPORT.md` (this report). `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_ARCHITECTURE.md`, `PROFLOW_CHAT_HANDOFF.md` — reviewed, genuinely not required this task.

### 22. File-by-File HE/EN Ledger

| FILE | WHAT CHANGED | HE IMPACT | EN IMPACT | STATUS |
|---|---|---|---|---|
| `PROFLOW_TODO.md` | New section recording this audit's findings and recommendation | None — architecture-only | None — architecture-only | DONE |
| `PROFLOW_HANDOFF.md` | New §18.CJ entry — full audit record | None | None | DONE |
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | This file | None | None | DONE |
| Any application file (`src/**`, `supabase/functions/**`) | **None changed** | N/A | N/A | ZERO MODIFIED — confirmed via `git status --short` identical before/after |

### 23. Secret/Privacy Scan Result

No password, access token, API key, service-role key, or anon key value appears anywhere in this report or the two documentation entries. Project refs (`ixabnzhjeqevtbhdfswv`, `ljfizgrdyzxddswcedwr`) are non-secret identifiers already used throughout prior documentation. **PASSED.**

### 24. Fresh Git State at Task End

Recorded in the chat response following this report.

### 25. Confirmation Production Remained Unmodified

Confirmed. All Production interaction this task was limited to the identity-preserving `supabase link`/`projects list` calls (to switch to TEST and back) — zero queries were issued against Production this task (the relevant Production facts were already established in the immediately preceding task and were not re-queried here).

---

## Primary Verdicts

**LOCAL→TEST SEPARATION: READY WITH CONDITIONS**

The pointing mechanism itself (Option A) is fully designed, low-risk, and ready to implement on its own explicit authorization. It is conditioned on a substantial, separately-scoped TEST-environment buildout (missing schema/RLS/functions/Edge Functions/Auth config, per the readiness matrix) before it would support genuinely meaningful interactive testing.

**LIVE INTERNATIONAL IDENTIFICATION: SAFE ADMIN-ONLY OPTION EXISTS**

Today, with zero change: the Admin UI already displays `business_name` + `country`. For a genuine "LIVE, not TEST" distinction, a small additive admin-only field (option 16.3) is the safe path, pending its own separate authorization — email/Auth aliasing is explicitly not appropriate.

NO IMPLEMENTATION PERFORMED
NO `.ENV` MODIFICATION
NO `.ENV.LOCAL` CREATION
NO VITE CONFIG CHANGE
NO PACKAGE/SCRIPT CHANGE
NO CODE CHANGE
NO AUTH USER CREATION
NO PASSWORD RESET/CHANGE
NO TEST DB MUTATION
NO PRODUCTION DB MUTATION
NO MIGRATION
NO EDGE FUNCTION DEPLOY
NO SUPABASE REDIRECT/CONFIG CHANGE
NO FIREWALL CHANGE
NO STEP 3
NO GIT ADD
NO COMMIT
NO MAIN PUSH
NO VERCEL ACTION
NO REAL-CUSTOMER TESTING
