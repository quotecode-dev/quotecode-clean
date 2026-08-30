# ProFlow — Current Technical & Product Architecture

**Document role**: this file describes how ProFlow is currently built and intended to behave — technical and product architecture only. It is one of **six** permanent project documents (see `PROFLOW_PROJECT_CONTEXT.md` §0.A/§0.B for the full, current, authoritative statement of this — the "four" this file previously said is superseded, not a live inconsistency):

1. **`PROFLOW_PROJECT_CONTEXT.md`** — current operational truth: rules, owner decisions, authorization state, open issues, the exact current checkpoint. **Authoritative for anything about current workflow, authorization, or what is/isn't approved.**
2. **`PROFLOW_CHAT_HANDOFF.md`** — a ChatGPT-conversation continuity snapshot: working relationship, accepted product/visual state, current resume point.
3. **`PROFLOW_ARCHITECTURE.md`** (this file) — current technical/product architecture.
4. **`PROFLOW_HANDOFF.md`** — detailed engineering history: audits, incidents, migrations, verification evidence, chronology. **Never rewritten to make old history match current architecture** — if this file and `PROFLOW_HANDOFF.md` disagree on a *current* technical claim, repository/live evidence decides, not document precedence.
5. **`PROFLOW_TODO.md`** — the authoritative living work backlog/roadmap. Current owner-approved priority comes from here, not from this file.
6. **`PROFLOW_CLAUDE_LATEST_REPORT.md`** — a report-transport bridge holding only the newest completed Claude task's Final Report.

**Reading order for a new session**: `PROFLOW_PROJECT_CONTEXT.md` → `PROFLOW_CHAT_HANDOFF.md` → this file → `PROFLOW_HANDOFF.md` → `PROFLOW_TODO.md` → `PROFLOW_CLAUDE_LATEST_REPORT.md` → locate the current checkpoint and current priority → resume. See `PROFLOW_PROJECT_CONTEXT.md`'s Mandatory Continuity Protocol (items 17, 17.A) and the Permanent Six-File Continuity Rule (§0.B) for the full rule, including the owner's magic-phrase continuity contract.

Every claim below is labeled: **LIVE VERIFIED** (confirmed via live DB/Supabase check), **REPO VERIFIED** (confirmed by directly reading current source), **OWNER-OBSERVED** (owner personally checked and reported), **DESIGN / NOT IMPLEMENTED** (approved architecture, no code exists yet), or **EXTERNAL / NOT REPO-VERIFIABLE** (operational setup outside this repository).

---

## 1. Project Identity & Stack

ProFlow — cloud-based SaaS business-management and quoting platform. Business owners manage clients, create/send price quotes (line items, discount, VAT, digital signature, WhatsApp/email delivery), track expenses/revenue, export reports. **REPO VERIFIED**: React (Vite) frontend, Supabase (Auth, Postgres/RLS, Edge Functions), Vercel hosting, GitHub version control. **Development workflow (REPO/HANDOFF VERIFIED, corrected — previously documented as "Cloud-only... no localhost dev environment used," which is no longer accurate)**: a local Vite dev server (`npm run dev`, typically `--port 5183 --strictPort`) is routinely used to live-test uncommitted working-tree changes against the live Supabase backend before they are committed; GitHub remains the sole persistent source of truth and Vercel the sole deployment target — no working-tree/localhost state is ever treated as live or deployed until committed, pushed, and built by Vercel. Modular component design (`Dashboard.jsx` composed of `AdminUsersTab.jsx`, `QuotesTab.jsx`, `SettingsTab.jsx`, `QuoteForm.jsx`, `UserDetailsModal.jsx`, `AILogs.jsx`, `AIChatWidget.jsx`, etc.).

No standalone version-number marker is maintained in this file — current project state is tracked via `PROFLOW_HANDOFF.md`'s own `HEAD == origin/main == <hash>` convention and `PROFLOW_PROJECT_CONTEXT.md`'s checkpoint, not a `vXX.X` label here.

## 1.A Supabase Environments (added 2026-08-28)

**REPO/CLI VERIFIED**: two Supabase projects exist, both in organization `smcrpeczwtpujpnhurwz`, region `eu-central-1` (Central EU/Frankfurt):

- **Production**: ref `ixabnzhjeqevtbhdfswv` (name `quotecode`), created 2026-07-27 — the real, deployed backend for the live application.
- **TEST**: ref `ljfizgrdyzxddswcedwr` (name `quotecode-test`), created 2026-08-27 — disposable/isolated, no GitHub repository connected, intended only for runtime migration/schema validation before a change is ever authorized against Production. **Updated 2026-08-30**: no longer schema-empty — now carries the Quote-Number/Attn migration chain (`20260827*`/`20260828*`) plus the **full** Phase-1 base-schema capture package (`20260830000000`-`20260830000003`, all four files including Storage), giving it the full 9-application-table Production-parity schema **plus** the `quote-files` Storage bucket and its 2 RLS policies (byte-for-byte parity with Production, verified before and after apply). See `PROFLOW_HANDOFF.md`'s Full Runtime TEST Environment Build entries (§18.CC onward) for the full history. Contains fictional test data only — never real customer data, never David Aluminum. **Updated 2026-08-30 (TEST Runtime Activation Audit, read-only)**: `quotecode-test` has **zero Edge Functions deployed** (confirmed via `supabase functions list`) and the application has never actually been pointed at it — both local Vite dev servers (5184/5186) still load the default `.env`, which points `VITE_SUPABASE_URL` at Production. No TEST Auth users exist beyond 5 DB-only `business_settings` fixture rows (no matching `auth.users`, cannot log in). A genuinely usable browser-testable TEST runtime is therefore still a future, separately-authorized activation effort — schema/Storage readiness alone does not make TEST usable. Full read-only audit, dependency map, and execution plan: `PROFLOW_CLAUDE_LATEST_REPORT.md`'s TEST Runtime Activation Audit; permanent findings also recorded in `PROFLOW_PROJECT_CONTEXT.md` §24 item 11 (hardcoded Production `emailRedirectTo`). **Updated 2026-08-30 (TEST Runtime Activation, Step A — implemented)**: port 5186 is now the dedicated TEST-pointed dev server (`npm run dev:localtest`, i.e. `vite --mode localtest --host --port 5186 --strictPort`), loading a new gitignored `.env.localtest.local` (`VITE_SUPABASE_URL=https://ljfizgrdyzxddswcedwr.supabase.co`, `VITE_PROFLOW_ENV=TEST`, `VITE_SUPABASE_ANON_KEY=` a placeholder pending the Owner pasting in TEST's real anon key) on top of the default `.env`. Port 5184 (`npm run dev`, plain, no mode) remains the Production-pointed default, byte-unchanged. `src/shared/supabase.js` now carries a fail-closed guard, active only when `import.meta.env.MODE === 'localtest'`: it requires `VITE_PROFLOW_ENV === 'TEST'`, parses the Supabase project ref out of `VITE_SUPABASE_URL`, and throws — before `createClient()` is ever called — if the ref is missing/malformed, equals Production's (`ixabnzhjeqevtbhdfswv`), or is anything other than TEST's (`ljfizgrdyzxddswcedwr`). Proven real (not just written) by temporarily pointing the TEST env at Production's ref and at a malformed URL, executing the actual served guard code, and confirming both throw correctly before restoring the correct config. Default/Production mode is untouched by this guard (code path never entered when `MODE !== 'localtest'`). No TEST Edge Function, Auth config, user, DB, or Storage state was touched by this step — see `PROFLOW_CLAUDE_LATEST_REPORT.md`'s Step A report for full detail.

**Edge Function secret pattern (found during the TEST Runtime Activation Audit, 2026-08-30)**: Production's 9 locally-tracked Edge Functions split across two distinct service-credential patterns — 6 read `Deno.env.get('SUPABASE_SECRET_KEYS')` (a JSON map, `['default']` extracted; the newer, migrated pattern per `PROFLOW_HANDOFF.md` §18.N/§18.P) — `get-public-quote`, `send-quote-email`, `admin-cleanup-user-quotes`, `billing-checkout-stub`, `resend-email-webhook`, `send-trial-expiration-email`; 3 still read the legacy `SUPABASE_SERVICE_ROLE_KEY` directly — `chat-ai`, `admin-delete-user`, `send-subscription-expiration-email` (this matches §18.P's own remaining-migration list). **Two Production-deployed functions have no local source tracked in this repository at all**: `clever-processor` (purpose unknown, not documented anywhere in the six continuity files) and `send-welcome-email` (previously confirmed by Agent EN not to be invoked by any signup flow). Neither is required for TEST activation; both represent undocumented drift the Owner should eventually clarify.

See `PROFLOW_PROJECT_CONTEXT.md` §17.D for the permanent TEST ≠ PRODUCTION target-guard rule governing any future use of the TEST project.

## 2. Domain / Deployment

**REPO VERIFIED / OWNER-OBSERVED**: canonical production domain is `https://www.quotecodepro.com/`. `https://quotecode.vercel.app/` also currently serves ProFlow directly — no redirect between the two domains exists in application code or Vercel configuration. Removal/redirection of the old Vercel domain is a **separate, independently-scoped issue**, not bundled into any current workstream. A repo-wide grep found **zero references to `vercel.app` anywhere in `src/` or `supabase/`** — nothing in application code depends on that domain.

**⚠️ OWNER-VERIFIED (2026-08-28, directly confirmed in the Vercel dashboard)**: this repository's Vercel project auto-deploys to Production on every push to `main` — application commits, documentation-only commits, and any other commit alike. Owner directly observed commit `ffc741d` (an application release-candidate commit) auto-deploy, and observed subsequent documentation-only commits also trigger new Production deployments. **`git push origin main` is therefore functionally equivalent to a Production frontend deployment authorization for this repository**, not a separate, lower-risk action — see `PROFLOW_PROJECT_CONTEXT.md` §17.E for the resulting permanent workflow rule (push-to-main now requires its own explicit authorization, distinct from documentation-commit authorization). This is a frontend-only deployment path — it does not touch the Supabase database, RLS, or Edge Functions, which remain on their own entirely separate, manually-triggered deployment paths (`supabase db push`, `supabase functions deploy`).

## 3. Market Architecture: Local (Israel) vs. International

### 3.1 Current product rules (LIVE VERIFIED)

| | Local / Israel | International |
|---|---|---|
| Language | Hebrew | English |
| Direction | RTL | LTR |
| Currency | ₪ (ILS) only | USD / EUR / GBP (switchable active currency) |
| VAT | 18%, automatic for local clients | 0% |
| Entry bundle | `AppLocal.jsx` | `AppGlobal.jsx` |
| Routes | `/`, `/he`, `/dashboard` (`bundleIsHebrew={true}`), `/tools`, `/he/tools`, `/terms`, `/privacy`, `/contact` (+`/he/...`) | `/`, `/en`, `/dashboard` (`bundleIsHebrew={false}`), `/tools`→`PublicToolsEn`, `/terms`, `/privacy`, `/contact` (+`/en/...`) — **no `/he` route exists in this bundle at all** |

`main.jsx` — not `App.jsx` — is the real top-level entry point; it renders `AppLocal`/`AppGlobal` directly. (`src/App.jsx` contains its own separate, unused signUp/routing logic and is **not part of the live bundle**.)

### 3.2 Pre-signup market discovery (LIVE VERIFIED — anonymous routing only)

`main.jsx`'s bundle-selection cascade, in priority order: `?lang=` query param → `/en`/`/he` path prefix → `localStorage.proflow_lang` (from a prior visit) → `proflow_geo_country` cookie (set by `middleware.ts` from Vercel's real geo header) → browser language. **This governs which landing page an anonymous visitor sees — it is explicitly never a source of truth for an existing account's market**, and is documented in-code as such.

### 3.3 Post-signup account market (LIVE VERIFIED — current, incomplete state)

Once `business_settings` exists for a user, `business_settings.country` is the account's market, set once at profile creation and never re-derived on subsequent logins (`fetchSettings()`'s existing-row branch never touches `country`). **This part is solid and correct today.**

**The gap (LIVE-REPRODUCED, see §6 below)**: the mechanism that determines `country` at the moment of *initial* profile creation currently depends on a fresh geo lookup or explicit user choice made at whatever moment the user's browser first reaches `Dashboard.jsx` with a session — which is not guaranteed to be the same moment, device, or location as the original signup. This has been reproduced as a live defect (§6).

### 3.4 Approved design — NOT YET IMPLEMENTED

**Status: DESIGN / GO WITH CONDITIONS. No code exists for this yet.** Three-tier authority for account market:

- **Tier 1**: `business_settings.country` — permanent authority once the row exists (already true today, §3.3).
- **Tier 2**: `auth.user_metadata.signup_market` — would become authoritative *only* for the one-time creation of a genuinely missing profile, captured at the exact moment `signUp()` is called from whichever bundle the user was actually using.
- **Tier 3**: fresh geo lookup / explicit user region-choice screen (today's existing mechanism) — demoted to a fallback used only when Tier 2 metadata is unavailable (e.g. a pre-fix legacy account).

**Do not treat Tier 2/3 as live behavior** — see §6 for the full audit and current implementation status.

## 4. Currency & VAT Architecture

**LIVE VERIFIED** (`regionConfig.js`): currency and VAT rate are derived deterministically from `business_settings.country` — Local → `ILS`/18%, International → `USD`/`EUR`/`GBP`/0% — never from UI language, never independently settable. An International account's *active* currency can be changed at any time via business settings; this is intentional product behavior and must not be "fixed" or removed.

## 5. Quote Currency / Historical Quote Preservation

**LIVE VERIFIED, owner-confirmed, must be preserved exactly**:
- Each quote **permanently freezes the currency it was created in** — changing the account's active currency only affects quotes created *after* the change; existing quotes are never retroactively rewritten.
- One International account can therefore legitimately have quote history spanning multiple currencies simultaneously. **This is correct behavior, not a leak.**
- `handleEditClick` (`Dashboard.jsx`) preserves a quote's original `currency`/`tax_rate` on save, never recomputing from the account's current region.
- **Important nuance**: a historical quote showing ₪ inside an International account is not automatically evidence of a current bug. A known example was created in ILS and is now signed/approved — the application's quote-immutability system (approved/paid/signed quotes are fully locked against edits, enforced independently at both the UI layer and via database triggers) means its currency cannot currently be changed through the normal application flow, regardless of any policy about historical data. **Future work must distinguish an actual currently-occurring currency leak from valid, locked historical data.**

## 6. Auth / Signup / Email Confirmation Architecture

### 6.1 Live-reproduced defect (LIVE VERIFIED this engagement)

A fresh International TEST signup was performed through the real signup UI to diagnose a suspected defect:

Auth signup succeeded → no active session immediately after (email confirmation is enabled) → English confirmation email received → owner clicked verify → confirmation succeeded (`auth.users.email_confirmed_at` populated, OWNER-OBSERVED) → **confirmation redirect landed on the Hebrew/Israel root landing page, not an International destination** → `business_settings` check: **zero rows** for this account.

This reproduction case is **deliberately preserved** — an Auth user that exists and is confirmed, with no `business_settings` row — and must not be repaired without separate explicit authorization.

### 6.2 Root cause (REPO VERIFIED)

The one shared `signUp()` call (`Dashboard.jsx`, used identically by both markets — this is **not** an International-only defect, Local signups have the exact same gap) is invoked with **no `options` object at all** — no `emailRedirectTo`, no metadata. Supabase therefore falls back to the project's Site URL, landing the confirmation click on the bare domain root. Neither `LandingLocal.jsx` nor `LandingGlobal.jsx` has any session-awareness (no `getSession()` call). The only code that creates `business_settings` (`fetchSettings()`/`createNewBusinessSettings()`, both inside `Dashboard.jsx`) only runs when `Dashboard.jsx` mounts — which the confirmation redirect currently never triggers. Separately, `main.jsx`'s pre-signup cascade (§3.2) then re-resolves market fresh at that bare-root URL, independent of the account's actual signup market — the direct mechanism behind the Hebrew-landing-page redirect.

### 6.3 Current live Supabase Auth URL Configuration (OWNER-OBSERVED)

- **Site URL**: `https://www.quotecodepro.com` (unchanged)
- **Redirect URLs**: `https://quotecode.vercel.app/`, `https://www.quotecodepro.com`, and `https://www.quotecodepro.com/dashboard` (the last one manually added by the project owner during this diagnosis; nothing removed). Whether the bare-origin entry already covered `/dashboard` before this addition is **UNKNOWN** — not verifiable from this environment.

### 6.4 Approved fix — DESIGN / NOT YET IMPLEMENTED

Add `options: { emailRedirectTo: window.location.origin + '/dashboard', data: { signup_market: isHebrew ? 'Local' : 'International' } }` to the one `signUp()` call; have `fetchSettings()`'s missing-profile branch prefer `session.user.user_metadata?.signup_market` before falling back to the existing fresh-geo lookup. **One file (`Dashboard.jsx`), two edits. No other file, database object, RLS policy, or Edge Function requires change.** `user_metadata` is user-writable (unlike `app_metadata`) — the design consumes it **only once**, at initial profile creation, and never re-reads it once a profile exists, so a user rewriting their own metadata later cannot migrate an existing account's market. **Status: GO WITH CONDITIONS. Not implemented. Requires separate explicit owner authorization before any code change.**

## 7. `business_settings`

**LIVE VERIFIED**: `role` column is `text`, nullable, default `'user'`, no CHECK constraint, no ENUM (`'admin'` is already schema-valid without migration). Sole INSERT authority: `createNewBusinessSettings()`. `UNIQUE(user_id)` constraint — **DOCUMENTED** (not re-checked via live catalog access this engagement). Default payload at creation: `role: 'user'`, `plan: 'pro'`, `trial_ends_at: now()+14d`. Existing-row branch of `fetchSettings()` never touches `trial_ends_at` or `country` on subsequent logins.

## 8. RLS / Security Architecture

### 8.1 `business_settings` (LIVE VERIFIED)

`authenticated` has INSERT+SELECT on the `role` column but **no UPDATE** — no client, including a `super_admin` acting through the normal app, can self-write `role`. 7 RLS policies exist: ownership (ALL), two restrictive INSERT policies (force `role='user'`; force safe free/legitimate-trial plan+trial shape), `super_admin` SELECT/UPDATE via `public.is_super_admin()`, and two general owner policies. `public.is_super_admin()`: `SECURITY DEFINER`, `STABLE`, non-recursive (built specifically to avoid a `42P17` self-referential recursion incident that was hit and fixed once during its own construction), EXECUTE granted to `authenticated`/`service_role` only, `anon` explicitly revoked.

### 8.2 `chat_logs` (LIVE VERIFIED — fixed this engagement)

**Prior state**: RLS was disabled, zero policies existed, `anon`/`authenticated`/`service_role` all held full table privileges. **Live-confirmed exploit**: an ordinary authenticated non-admin TEST account performed a minimal direct Data API SELECT and received `HTTP 200` with rows — the `/ai-logs` UI gate was the *only* thing standing in the way.

**Current state (fixed)**: RLS enabled; exactly one policy, `"Super admins can view all chat logs"`, `FOR SELECT TO authenticated USING (public.is_super_admin())`; `anon` has no table privileges at all; `authenticated` reduced to SELECT only; `service_role` unchanged (the sole writer, `chat-ai` Edge Function, uses `service_role` and is unaffected by RLS by design). Post-fix, the same TEST account's identical direct SELECT returned `HTTP 200` with `[]` — zero rows. **What was not re-tested**: a second TEST account's post-fix access (that account's login was separately broken and unrelated to this fix), and a full live re-run of every four-context AI Chat functional flow (their non-interaction with this RLS change is an architectural conclusion, not a fresh end-to-end test).

## 9. Role Model: `user` / `admin` / `super_admin`

Authorization roles are **completely separate** from subscription plans (§16) — `role='admin'` must never imply or grant a paid-plan entitlement.

**LIVE VERIFIED, confirmed favorable property**: every existing `role === 'super_admin'` check in this codebase (roughly 9 call sites: 4 frontend, 5 backend/Edge-Function) is an **exact string-equality check**, never `!== 'user'` or a set-membership test. Introducing `role='admin'` with zero code changes therefore grants that account no capability beyond a plain `user` — confirmed, not assumed.

**Current DB-layer preparation (LIVE VERIFIED, owner-executed)**: `public.is_admin()` created — exact structural mirror of `is_super_admin()`, checks `role = 'admin'` exactly, same non-recursive/EXECUTE-ACL discipline. One new additive `business_settings` SELECT policy: `"Admins can view all business settings"`, `FOR SELECT TO authenticated USING (public.is_admin())` — does not touch any of the 7 pre-existing policies.

**Application-layer state: NOT STARTED.** No `isAdmin`/`isAdminOrAbove` distinction exists in frontend code. No account with `role='admin'` exists. **Corrected** (an earlier claim here that these keys were absent was stale): `PROFLOW_TEST_ADMIN_EMAIL`/`PASSWORD` keys **are present** in `.env`, but the configured email does **not** currently exist in Supabase Auth (owner-verified via Authentication → Users) — the credential set is therefore not currently usable, and the stored password is not live-verified. Provisioning remains blocked pending either creating that Auth user or supplying new credential values (never invented by an agent). See `PROFLOW_PROJECT_CONTEXT.md` §14/§22/§24 for the full corrected detail — Super Admin authorization itself is governed exclusively by `business_settings.role = 'super_admin'`, never by this email.

**Approved ADMIN V1 capability model (design only)**: read-only — Admin area access, users list, platform KPIs, search/filter, permitted user/business details. Explicitly denied: delete user, reset data, extend trial, Lifetime, plan/subscription changes, role changes, admin creation/removal, diagnostic/test-email actions, destructive Edge Functions, **and AI Support Logs / `chat_logs` access — explicitly deferred, never automatically granted merely because a broader Admin area becomes visible.**

`admin-delete-user`'s target-protection guard refuses only `role === 'super_admin'` targets — an `admin`-role target would currently fall through as deletable by a `super_admin` caller, matching the intended hierarchy (super_admin may delete admin; admin cannot delete anyone in V1, since its caller-gate check on every destructive Edge Function already requires exact `role === 'super_admin'`).

## 10. Admin UI — Requirements & Status

**The final Admin/Super Admin UI visual design is NOT yet approved.** The current dark/neon UI must not be treated as final (a light-theme redesign was separately scoped, not implemented). **Firm, standing requirement regardless of final design**: the users-management table/list must begin with a human-readable user/business **name** as the primary identity — **not email**. Email is secondary information only.

## 11. AI Chat / `chat_logs` Architecture

**REPO VERIFIED**: `AIChatWidget.jsx` (shown on landing pages, contact page, and the authenticated dashboard) → `chat-ai` Edge Function (calls OpenAI `gpt-4o-mini`) → logs every exchange to `chat_logs` via `service_role` (legacy `SUPABASE_SERVICE_ROLE_KEY` — migration to the modern `SUPABASE_SECRET_KEYS` pattern remains a separate, open, unstarted track). Classification categories: `GENERAL`, `CANCELLATION`, `FEATURE_REQUEST`, `HARD_QUESTION` (keyword-based, market-isolated pricing block per §3). `AILogs.jsx` (`/ai-logs`) remains `super_admin`-only, now backed by real RLS (§8.2), not just a UI redirect. **A future restricted `admin` role does not automatically gain AI Support Logs access — this must be a separate, explicit, future decision, never a side effect of broader Admin-area access.**

## 12. Email Architecture

**REPO VERIFIED**: `send-quote-email` Edge Function sends via Resend's API, with dynamic Hebrew/English HTML templates driven by an `isHebrew` parameter, RTL/LTR-aware layout, and business-logo injection (`logoUrl`). An email-status indicator (green/red) exists in `QuotesTab.jsx`, updated via the `resend-email-webhook` function on bounce. **Open item**: `send-quote-email` still uses the legacy `SUPABASE_SERVICE_ROLE_KEY` — a tracked, unstarted credential-migration item.

**EXTERNAL / NOT REPO-VERIFIABLE**: sender domain verification with Resend, and the Namecheap-hosted `info@`/`support@quotecodepro.com` mailboxes with POP3 sync into Gmail — this is operational infrastructure outside the repository and cannot be confirmed by reading source code.

## 13. WhatsApp Integration

**REPO VERIFIED (existence)**: WhatsApp-related code (dynamic `wa.me` links, phone-number normalization) is present across `SettingsTab.jsx`, `QuoteForm.jsx`, `PublicQuote.jsx`, and other components. The exact current behavior of Israeli-business-specific phone normalization was not re-verified line-by-line in the most recent audit — treat as **DOCUMENTED**, re-confirm before relying on exact behavior in future work.

## 14. Public Quote / Storage Architecture

**REPO VERIFIED**: public quote pages are served via `SmartPublicQuote`/`PublicQuote`/`PublicQuoteEn`, resolved by ID through the `get-public-quote` Edge Function (fully anonymous — no role/auth check of any kind found in that function). Quote file attachments (`quote_attachments` table) reference objects in a Supabase Storage bucket (`quote-files`, paths prefixed by `user_id`). **Known, documented, still-open gaps** (not fixed, not to be fixed opportunistically): no owner DELETE/UPDATE policy currently exists on `storage.objects` for this bucket at all (a live test confirmed `403` on a normal authenticated delete attempt); no code path anywhere (including the user-deletion Edge Functions) ever deletes the underlying Storage file objects — only the database metadata row is removed, meaning deleted accounts likely leave orphaned Storage files behind if they ever uploaded attachments.

## 14.A Quote Number Architecture (Business/Display Identifier)

**LIVE VERIFIED (2026-08-28, direct schema/RLS/trigger introspection)**: `quotes.quote_number` already exists live as `integer NOT NULL DEFAULT nextval('quotes_quote_number_seq'::regclass)` — a single **global** sequence shared across every business (not per-business, not this repository's own design). No unique constraint, no allocation RPC, no quote_number-specific immutability trigger exists live. `quotes.id` (UUID) remains, and will always remain, the sole technical/routing/security identifier — `quote_number` is purely a customer-facing display value, never used for authorization or routing.

**Target architecture (DESIGN, local package prepared, NOT applied live)**: per-business allocation via a dedicated `business_quote_sequences` counter table (`user_id` PK, RLS default-deny, one super-admin read policy) plus a `SECURITY DEFINER` `allocate_quote_number(uuid)` function as the sole write path (atomic `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`, re-validates `auth.uid()`). First managed allocation per business = `100700`, displayed as `A100700`. A `UNIQUE (user_id, quote_number)` index (built `CONCURRENTLY`) and a dedicated immutability trigger (blocks any post-assignment change, narrow `service_role` bypass reserved for forward-fix) complete the target state. See `supabase/migrations/20260827000000`–`20260827000003` and `supabase/quote_number_counter_init.sql`.

**Historical Number Preservation (permanent design rule)**: quotes numbered under the pre-transition global sequence (e.g. `A11`, `A56`, `A90`) are never renumbered, reinterpreted, or reassigned once the per-business scheme goes live — they remain permanent historical identifiers. Only quotes created after the transition receive numbers from the new per-business `A100700+` sequence. It is intentional and expected for an older quote to show `A90` while a newer one from the same business shows `A100700` — no fake continuity is manufactured.

**Display**: canonical formatting lives in `src/utils/quoteNumber.js` (`formatQuoteNumber`/`formatQuoteFallback`) — market-neutral, consumed identically by both `PublicQuote.jsx` (Hebrew, "מספר הצעה") and `PublicQuoteEn.jsx`/`PublicQuoteHeader.jsx` (English, "Quote Number"); only the label text is market-conditional, never the underlying value or allocation logic. Full HE/EN cross-surface status: `PROFLOW_TODO.md` item 17.

**Known live gap (flagged, not yet fixed)**: because no quote_number-specific immutability trigger exists live yet, an authenticated owner can currently change their own quote's `quote_number` via a plain `UPDATE`, for any quote not yet approved/paid/signed. Closed by the prepared (not-yet-applied) `20260827000002` migration.

**Deployment desync (proven)**: local `get-public-quote`/`send-quote-email` Edge Function source already selects `quote_number`; the currently-deployed versions of both (last deployed 2026-08-25, per `supabase functions list`) predate that change and do not return it — this is why Dashboard can already show a real number (e.g. "A90") while the same quote's own Public Quote page and emailed subject line still show the fallback hash. Not deployed by any task to date; a coordinated future release is required (`PROFLOW_TODO.md` item 17).

## 15. SEO / Routing

**REPO VERIFIED (current, re-read directly)**: `public/sitemap.xml` currently lists 11 URLs — `/`, `/he`, `/en`, `/he/tools`, `/en/tools`, `/he/contact`, `/en/contact`, `/he/privacy`, `/en/privacy`, `/he/terms`, `/en/terms` — with `hreflang` alternates. `public/robots.txt` has **no `Disallow` rules at all**; private/system routes (`/dashboard`, `/ai-logs`) are simply absent from its `Allow` list, and are actually noindexed via `X-Robots-Tag` HTTP headers configured in `vercel.json` — a deliberate design choice (blocking via `robots.txt` was tried and reverted specifically so crawlers could still fetch and see the noindex directive), not a `robots.txt` Disallow mechanism.

## 16. Trial / Plans / Billing

**LIVE VERIFIED (paywall tiers, matches current `AdminUsersTab.jsx` quote-limit logic)**: Free (5 quotes/month), Basic (20 quotes/month), Pro (unlimited, logo, WhatsApp, deletion). New signups get a 14-day full-Pro trial (§7). `handleExtendTrial14Days` deliberately refuses to extend a trial that still has time remaining — **owner-confirmed intended behavior, not a bug**.

**Open, separately tracked, not addressed by any current work**: a TEST account's trial was observed resetting toward a fresh ~14-day window between sessions — plausible (not confirmed) explanation on file in `PROFLOW_HANDOFF.md`, not to be fixed opportunistically as part of unrelated work.

**No real billing/payment infrastructure exists.** `billing-checkout-stub` is pure scaffolding (no real Stripe call, no table writes, `checkoutUrl` always `null`). There is currently **no authoritative paid-subscriber source of truth** in the schema — `plan='pro'`/`'basic'` alone never proves actual payment, since every new trial signup also gets `plan='pro'` by default. Do not assume billing is implemented merely because plan tiers exist in the UI.

## 17. Settings / Business Profile (CRM)

**DOCUMENTED**: `SettingsTab.jsx` manages business profile fields — name, tax ID, phone, currency, and a pipe-delimited `street|city|state|zip` address format (parsed for display elsewhere, e.g. `UserDetailsModal.jsx`'s `formatAddressCity()`). Plan/trial management and subscription cancellation flows live here and in `PricingModal.jsx`.

## 18. Where Current Rules Live

This file describes architecture, not workflow. For current authorization state, owner-approved workflow, the coding-agent (Claude) rules, commit/push discipline, the Local+International bilateral-regression requirement, David Aluminum protection, and the exact current project checkpoint — **see `PROFLOW_PROJECT_CONTEXT.md`, which is authoritative for all of that.** For detailed historical evidence behind any claim above, see `PROFLOW_HANDOFF.md`.

## 19. Documentation Persistence / Repository Access

GitHub (`quotecode-dev/quotecode-clean`) is this project's persistent, version-controlled source of truth for all six canonical project documents (§0.A/§0.B of `PROFLOW_PROJECT_CONTEXT.md`) and all application code. A ChatGPT session has a **verified, read-only** connector to this repository (owner-selected "Allow read actions" permission mode) — see `PROFLOW_PROJECT_CONTEXT.md` §26.A for the verification details and Protocol items 17-19 for the exact reading/freshness/write-authorization rules governing its use. This file is not the place for connector operating instructions — it exists only to note that GitHub, not chat memory or an uploaded copy, is the intended shared source between coding-agent work and future ChatGPT sessions.
