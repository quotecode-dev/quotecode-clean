# CURRENT RESUME STATE — READ FIRST

**THIS BLOCK OVERRIDES ALL HISTORICAL SECTIONS BELOW FOR RESUME PURPOSES.** Everything after this block — including the original opening paragraph immediately following it (baseline commit `5737626`, "Fix locked quote tooltip hit area") and every numbered/lettered historical section — is **evidence and history**, not the current checkpoint. A new session must **never** select an older section (a P0.x entry, an early architecture audit, an old baseline paragraph) as "the current state" merely because it appears earlier in this file. If this block ever conflicts with something below it, this block wins; if this block appears stale relative to `PROFLOW_PROJECT_CONTEXT.md` §28, **§28 is authoritative** — this block is a pointer into that checkpoint, not a replacement for reading it.

**Read order for any new session**: `PROFLOW_PROJECT_CONTEXT.md` → `PROFLOW_ARCHITECTURE.md` → `PROFLOW_HANDOFF.md` (this file, in full) → `PROFLOW_TODO.md`. Current owner-approved priority comes from `PROFLOW_TODO.md`'s "Current Recommended Execution Order" — not from any status line in this file.

**Latest committed/pushed GitHub state**: commit `7c5d7fa` — `docs: add future TODO item for safe refresh / new version notification` — on `origin/main` (documentation-only commits; no application code has been committed/pushed this engagement — this will be superseded once this task's own permanent-rules commit is pushed; see this session's final report for that exact SHA). The **current checkpoint** is `PROFLOW_PROJECT_CONTEXT.md` §28 (CURRENT EXACT CHECKPOINT, Item 14 status unchanged by this task) plus the new permanent §36/§37, together with `PROFLOW_HANDOFF.md`'s most recent detailed entry below (§18.AV) and `PROFLOW_TODO.md` items 14 and 15.

**Current material state, at a glance** (each fact's classification preserved — do not silently upgrade any of these):
- **Two new PERMANENT workflow rules now govern all future work, on item 14 and every future item alike** (owner decision, does not expire — see §18.AV below and `PROFLOW_PROJECT_CONTEXT.md` §36/§37 for full text): (1) **Test-First / Owner-Gated Live** — every change of any category must be implemented and verified in TEST/dev first, then explicitly approved by the owner before LIVE/production, with a post-deploy smoke check; a Claude/agent/lint/build/test PASS never substitutes for that explicit owner approval; (2) **Hebrew RTL / English LTR UI Parity** — every future UI/UX change touching both markets must be implemented in both language/direction experiences in the same work pass (not sequentially), with the actual mirrored visual composition checked (not just `dir` CSS), Local and International verified/reported separately, and strict market isolation (currency/VAT/`signup_market`/`business_settings.country`) preserved throughout.
- **Bilateral Local + International signup-market preservation**: 🟢 **LIVE VERIFIED**, committed/pushed (`ee4b8a8`). Do not reopen without a new specific reason.
- **Production routing / locale-selection architecture**: audited and documented (§31 of `PROFLOW_PROJECT_CONTEXT.md`), committed/pushed (`d7f3408`).
- **Continuity bootstrap repair** (magic-phrase contract, four-file reading order, this checkpoint's own historical-precedence marker): committed/pushed (`1ca734d`).
- **Auth / Routing Localization Phase 1** (Findings A/D/E/H): implemented, **statically verified** (ESLint 0 errors, build succeeds, 21/21 tests pass) — **live/visual verification is still PENDING.** Finding C remains OPEN/CAUSE UNKNOWN. Finding F remains OPEN/external. TODO item 12 is **not** complete.
- **Owner + ChatGPT Visual Acceptance**: three anonymous-routing checks recorded PASS (Local market only, root `/` auto-selection; Landing→Login; Login→Signup, all Hebrew/RTL). Nothing else visually verified. TODO item 13 is **not** complete.
- **TODO item 14 (Public Quote + User UI Visual Redesign) — current state of each sub-item**:
  - **14.A Public Quote**: design approved in principle; implementation done in the working tree (purple header/call-CTA/recipient emphasis/always-visible attachments/purple totals — Local Desktop+Mobile live-verified, International not live-tested). **Not yet reviewed by the owner.**
  - **14.B Business Owner Dashboard — Desktop**: design approved in principle. **Five implementation passes so far** — the first three (light reskin; purple-header/pill-nav rework; strict-visual-match rework) were built from **text descriptions only**. The **fourth pass** was the first time the actual approved mockup image was provided and used for direct comparison. The owner reviewed the fourth pass ("substantially closer... but not finally accepted") and approved five specific next changes. The **fifth pass** (this checkpoint — see §18.AU) implements all five: Catalog moved to its own top-nav tab ("קטלוג", reusing the existing `ServicesCatalog` component unchanged); Quote History now full width (the two-column `dash-work-grid` removed); the duplicate "New Quote" button removed from inside `QuotesTab.jsx` (only the standalone top-level CTA remains); Quote History row padding reduced 25% with safe truncation/ellipsis + `title` attributes on long client-name/description content; top nav reordered to the owner's exact approved sequence. Live-verified Desktop-only against TEST_USER1 (Local) on localhost — see §18.AU for the full verification list. **Desktop OWNER FINAL VISUAL ACCEPTANCE: still PENDING** — this pass is implemented/verified in the working tree only, not yet inspected by the owner. Two items flagged (not fixed, out of this pass's scope): a pre-existing (not newly introduced) limitation where the standalone New Quote CTA only opens the form from the `main` tab; and a new Mobile reachability gap for Catalog (previously reachable via the stacked layout, now has no mobile-nav entry) — flagged for an explicit owner decision. Mobile redesign itself not begun (deferred).
  - **14.C Super Admin**: light visual direction approved only; implementation partial in the working tree (theme + module title bar). Live browser verification **BLOCKED** by the harness's permission classifier denying the admin-account login attempt — not worked around. **Not yet reviewed by the owner.**
  - **Provenance**: all three surfaces' visual-direction approvals were owner-confirmed (after an earlier flagged-discrepancy episode) as genuine decisions made in a separate owner/ChatGPT conversation — not independently re-derived by Claude. Design approval, implementation, and owner final visual acceptance remain three distinct gates for every surface, never conflated.
- **Agent Monitor**: a Phase 0 read-only audit plus a bounded 10-minute POC were completed. The built-in `PushNotification` tool is confirmed callable, but a test notification returned "not sent" because the tool suppresses phone delivery whenever the terminal is actively watched — mobile delivery could not be confirmed or denied. Result remains **INCONCLUSIVE / TIMEBOX-BOUNDED**, not solved. No monitor implementation exists. Side tool, not the primary workstream.
- **Working tree**: NOT clean — contains all of 14.A/14.B/14.C's application-code implementation work (`src/pages/Dashboard.jsx`, `src/pages/PublicQuote.jsx`, `src/pages/PublicQuoteEn.jsx`, `src/components/PublicQuoteHeader.jsx`, `src/components/AdminUsersTab.jsx`, `src/components/QuotesTab.jsx`, `src/components/ServicesCatalog.jsx`, `src/components/ClientsTab.jsx`, `src/components/FinancesTab.jsx`, `src/components/SettingsTab.jsx`, `src/components/QuoteForm.jsx`, `src/components/DeleteConfirmModal.jsx`, `src/theme/neonTheme.js`) plus this exact continuity-documentation checkpoint (`PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`). This checkpoint's four documentation files are authorized for commit+push by the task that produced them; the application code is not.
- **Not authorized**: further 14.A or 14.C implementation; committing/pushing/deploying any application/UI code; any fix for Finding C or F; any Mobile redesign work (including a fix for the newly flagged Catalog mobile-nav gap, which requires an explicit owner decision first).

---

ProFlow — Project Handoff & Continuity Document

Last pushed application baseline: 5737626 — "Fix locked quote tooltip hit area". **(HISTORICAL — see the CURRENT RESUME STATE block above for the actual current baseline; this line and the paragraph below it describe a state from long before the signup-market fix, the routing/localization audit, and the TODO system existed. Do not resume from this paragraph.)**
Current verified working-tree/security state is newer than that pushed baseline and is NOT yet committed/pushed: Public Quote Security Remediation Phases 1–4 plus DB/Storage cutover Stages A/B/C/D1 have been implemented and live-verified. See §12 for the exact Git state and §18 for the current security architecture and remaining D2 blocker.
Production: https://www.quotecodepro.com/

Before making architectural changes, verify this document against the current repository because the codebase may have advanced since this handoff was last updated.

This document is written for a senior AI/software engineer entering a new session with no prior context. It documents only what is verifiably present in the repository as of the baseline commit above. Where something could not be confirmed from the code, it is explicitly marked as such rather than assumed.

Project Overview

Project name: ProFlow

Production domain: https://www.quotecodepro.com/

What it does: A SaaS business-management and quoting platform. Business owners (freelancers/small businesses) manage clients, create and send professional price quotes (with line items, discount, VAT, digital signature capture, WhatsApp/email delivery), track expenses and revenue, and export reports. The product is split into two hard-separated regional experiences — a Hebrew/Israel-local product and an English/International product (see §3, the Iron Rule).

Main user flows (confirmed in code):

Sign up / sign in (email+password via Supabase Auth) → dashboard.

Create a business profile (business_settings, auto-initialized on first login if missing). New rows are initialized with plan: 'pro' and trial_ends_at set to approximately 14 days ahead (Dashboard.jsx auto-init payload). The actual Pro/Basic/Free access lifecycle is governed by the effectivePlan/isPro/isBasicOrAbove logic and admin plan overrides in Dashboard.jsx (see §7) — it should not be inferred solely from trial_ends_at.

Manage clients (ClientsTab.jsx), services catalog (ServicesCatalog.jsx), expenses (FinancesTab.jsx).

Create/edit/duplicate quotes (QuoteForm.jsx, orchestrated by Dashboard.jsx), attach files, send via email (Resend) and/or WhatsApp (a prefilled https://api.whatsapp.com/send link).

Client opens a public quote link, views it, digitally signs (canvas-based signature pad), and the quote is marked approved.

Export quotes to a formatted .xlsx report and expenses to CSV.

Built-in AI chat widget for user support (OpenAI-backed), and a super-admin-only AI conversation log viewer (AILogs.jsx).

Super Admin panel (AdminUsersTab.jsx) for managing all accounts, plans, and trial/lifetime status.

Public, unauthenticated marketing/tool pages (PublicTools.jsx / PublicToolsEn.jsx — currency/unit/metal/crypto calculators) and legal pages (Terms/Privacy/Contact), each in a language-locked bundle.

Current development status: Production, live, actively maintained. Commit 2532f1b (pushed) was a full audit-and-hardening pass focused entirely on the Local/International separation invariant (see §5). Since then, the open investigation from §13 (geo-based landing routing and first-signup region resolution) has been implemented but is not yet committed or pushed — see §4.D, §5b, §12, and the updated §13 for the full design and its current (pending-approval) status.

Technology stack (verified against package.json at this baseline)

"dependencies": {
"@fontsource/rubik": "^5.3.0",
"@supabase/supabase-js": "^2.39.0",
"@vercel/functions": "^3.9.5",
"exceljs": "^4.4.0",
"html2canvas": "^1.4.1",
"jspdf": "^4.2.1",
"lucide-react": "^1.28.0",
"react": "^18.3.1",
"react-dom": "^18.3.1",
"react-router-dom": "^7.18.2",
"recharts": "^3.10.1"
},
"devDependencies": {
"@eslint/js": "^10.0.1",
"@tailwindcss/postcss": "^4.0.0",
"@types/react": "^18.3.3",
"@types/react-dom": "^18.3.0",
"@vitejs/plugin-react": "^4.3.0",
"eslint": "^10.9.0",
"eslint-plugin-react-hooks": "^7.1.1",
"eslint-plugin-react-refresh": "^0.5.4",
"globals": "^17.11.0",
"tailwindcss": "^4.0.0",
"vite": "^5.3.1"
}

Note: jspdf and html2canvas are declared dependencies but no import of either was found anywhere in src/ at this baseline. They appear to be unused/vestigial (possibly from a removed or never-completed PDF-export feature). Do not assume a PDF export feature exists — the confirmed export is the XLSX quote report (§8) and a CSV expense export.

Backend: Supabase (Auth, Postgres Database, Edge Functions — Deno runtime), Resend (transactional email), OpenAI (gpt-4o-mini, for the AI chat widget only).

Hosting: Vercel (confirmed via vercel.json — SPA rewrites, security headers, and a daily cron job; see §12).

Version control: GitHub, remote origin → https://github.com/quotecode-dev/quotecode-clean.git.

Architecture

Application bootstrap

src/main.jsx decides which of two entirely separate React app bundles to mount, based on (in priority order): ?lang= query param → /en//he path prefix → localStorage['proflow_lang'] → an anonymous-UI-only geo cookie (proflow_geo_country, written by middleware.ts — see §4.D) → navigator.language. This decision only ever happens before any Supabase session is checked — it selects a bundle, nothing more. It writes its choice back to localStorage['proflow_lang'].

const isEnglishEnv = ...; // see §4 for exact logic (now includes the geo-cookie tier)
createRoot(...).render(isEnglishEnv ? <AppGlobal /> : <AppLocal />)

⚠ Pending/uncommitted as of this update: the geo-cookie tier and middleware.ts are implemented in the working tree but not yet committed/pushed — see §12.

Two parallel app bundles

src/local/AppLocal.jsx — the Hebrew/Israel-local bundle. Declares its own <Routes> tree (landing, dashboard, public quote, tools, legal pages), rendering <Dashboard />.

src/global/AppGlobal.jsx — the English/International bundle. Same route shape, <Dashboard />.

Both mount the same Dashboard.jsx component — the actual authenticated-account language/region logic lives entirely inside Dashboard.jsx and regionConfig.js, not in which bundle happened to load (see §4). As of the pending geo work, Dashboard.jsx no longer accepts or reads a bundleIsHebrew prop at all — both AppLocal.jsx and AppGlobal.jsx still pass bundleIsHebrew={true}/{false} in their JSX, but it is now inert/ignored (React does not error on an unused prop). See §14 for this leftover.

Dashboard architecture

src/pages/Dashboard.jsx is the large, central authenticated-app component (single file, several thousand lines). It owns:

Auth session state (session, isInitializing — gates all rendering until both auth and business_settings have resolved; see §5 for the account-switch hardening).

Business settings state (bizCountry, bizName, bizPlan, bizRole, currency, VAT rate, trial state).

All Supabase data fetching (fetchQuotes, fetchClients, fetchServices, fetchExpenses, fetchAllUserAttachments, fetchSettings — all called sequentially from loadData()).

First-time business-region resolution for a brand-new account (no business_settings row yet): fetchSettings calls fetchFreshGeoCountry() (fetches /api/geo) and, on success, calls createNewBusinessSettings(userId, userEmail, country) — the single code path in the file (and, per a repo-wide grep, in the whole repository) allowed to INSERT a new business_settings row. If fresh geo is unavailable, the user is shown a minimal explicit "Israel / International" choice screen (needsRegionChoice state) instead of any guess. See §4.D for full detail — pending/uncommitted, see §12.

Quote CRUD (handleSaveQuote, handleEditClick, handleDuplicateQuote, handleCancelEdit, delete).

Email sending orchestration (executeEmailSend, calls the send-quote-email edge function).

WhatsApp link generation (sendWhatsApp).

XLSX quote export (handleExportQuotes) and CSV expense export (handleExportExpenses/exportToCSV).

Tab-based UI: quotes, clients, finances, services catalog, settings, admin (super-admin only) — rendered via child components (QuotesTab, ClientsTab, FinancesTab, ServicesCatalog, SettingsTab, AdminUsersTab).

Plan/trial gating (effectivePlan, isPro, isBasicOrAbove, isSuperAdmin — see §7 subscriptions).

Quote creation/editing

QuoteForm.jsx is a controlled, presentational form component — nearly all its state lives in and is passed down from Dashboard.jsx (client fields, items, currency, discount, terms, notes, computed subtotal/tax/total). Currency is rendered as a disabled <select> inside the form — it cannot be changed from within QuoteForm.jsx; it is fixed by the account's region at the Dashboard.jsx level. Submission calls Dashboard.jsx's handleSaveQuote via the form's onSubmit.

Public quote rendering — CURRENT / VERIFIED (post Phase 4)

SmartPublicQuote.jsx is now the sole public-quote data loader/router for /public-quote/, /quote/, and (via AppGlobal.jsx) /en/public-quote/. It invokes the live Supabase Edge Function get-public-quote exactly once per intended page load, then invokes public_increment_quote_view via RPC exactly once. It routes to PublicQuote.jsx (Hebrew) or PublicQuoteEn.jsx (English) from the quote's own persisted tax_rate/currency — never from the viewer's browser.

PublicQuote.jsx and PublicQuoteEn.jsx are now presentational/action components receiving the minimized DTO from SmartPublicQuote. They no longer perform direct public reads from quotes/clients/quote_items/quote_attachments/business_settings, and they no longer write quote approval directly. Approval goes only through public_approve_quote(uuid,text).

The get-public-quote Edge Function uses service_role server-side, returns an explicit minimized DTO, computes is_owner_viewing without exposing user_id, validates attachment storage_path against the trusted quote owner/id pattern, and returns 300-second signed URLs. The quote-files bucket is still public pending the D2 compatibility phase; see §18.

React 18 StrictMode behavior was browser-tested locally. SmartPublicQuote uses a processedIdRef/stale-response guard so the dev-mode effect stress test does not duplicate get-public-quote or public_increment_quote_view calls and does not leave the UI stuck in Loading.

Browser verification completed on localhost against the live Supabase backend: Hebrew and English public quotes render correctly; owner/non-owner signing UI is correct; /en/public-quote with a Local quote routes to Hebrew correctly; Network showed exactly one get-public-quote (200) and one public_increment_quote_view (204) per intended load; signed attachment links open successfully.

Authentication

Supabase Auth (email/password). AuthScreen.jsx renders the login/signup/password-recovery UI (shown whenever Dashboard.jsx's isInitializing/isPasswordRecoveryMode/no-session gate is active). Dashboard.jsx subscribes to supabase.auth.onAuthStateChange for SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, PASSWORD_RECOVERY events.

Business settings

Table business_settings, one row per user (user_id foreign key to the Supabase Auth user). Auto-created on first dashboard load if missing (see §1, §5). Holds the account's legal region (country), currency, plan, role, trial/subscription dates, and business profile fields (name, tax ID, address, logo, default terms). See §9 for the full observed column list.

Database interaction

Direct Supabase client calls from React components (src/shared/supabase.js exports the client, built from VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) — there is no separate API layer between the frontend and Postgres; RLS (Row Level Security) is presumed to be the access-control boundary, though RLS policies themselves are not present in this repository (not verifiable from the code alone — see §9).

Email sending

supabase/functions/send-quote-email/index.ts — Deno edge function, calls the Resend API directly. See §6 for full detail; this is the function that was most heavily hardened in the §5 audit.

Resend webhook handling

supabase/functions/resend-email-webhook/index.ts — receives Resend delivery-failure webhooks, verifies Svix signatures, and marks the corresponding quotes row as bounced. See §6.

AI functionality

src/AIChatWidget.jsx (client widget, shown on landing pages, contact page, and dashboard) → supabase/functions/chat-ai/index.ts (edge function, calls OpenAI gpt-4o-mini) → logs every exchange to the chat_logs table.

src/pages/AILogs.jsx — a super-admin-only viewer of the chat_logs table.

Public tools

src/components/PublicTools.jsx (Hebrew) / PublicToolsEn.jsx (English) — standalone, unauthenticated calculator pages (currency converter, unit converter, precious-metals value calculator, crypto converter). No Supabase calls; they call public external APIs (open.er-api.com for FX rates, api.coingecko.com for crypto prices) directly from the browser, with a 10-minute localStorage cache.

Subscriptions / trial functionality

Present, but billing itself is a stub — no real Stripe integration is wired up (supabase/functions/billing-checkout-stub/index.ts explicitly does not call the Stripe API). Plan gating (Free/Basic/Pro, quote-count limits, feature gating) is fully implemented and enforced client-side in Dashboard.jsx. See §7 for detail.

Deployment structure

Vercel hosts the Vite-built SPA. vercel.json (present) configures: a catch-all rewrite to index.html (client-side routing), security headers, correct Content-Types for sitemap.xml/robots.txt, and one cron job: path: "/api/cron", schedule "0 8 * * *" (daily 08:00).

api/cron.js — a Vercel serverless function (Node, not a Supabase edge function) that runs daily: (1) marks quotes expiring "today" and flags expiration_reminder_sent, (2) fetches live FX rates from open.er-api.com and upserts them into an app_settings table (key: 'exchange_rates'), (3) invokes the two Supabase expiration-reminder edge functions in batch mode via x-cron-secret. Auth: requires Authorization: Bearer <CRON_SECRET>.

api/geo.js (new, pending/uncommitted — see §12) — a second Vercel serverless function, same Node convention as api/cron.js. Returns { country } read fresh from the request's x-vercel-ip-country header (uppercased, Cache-Control: no-store so it's never CDN-cached). Never reads a client-supplied country value. Called only by Dashboard.jsx at first-account-creation time — see §4.D.

middleware.ts (new, pending/uncommitted — see §12) — Vercel Routing Middleware (project root, matches only /). Reads the visitor's geo country via the @vercel/functions geolocation() helper and, if available, sets a proflow_geo_country cookie for anonymous landing-page UI routing only (consumed by main.jsx, see above). Never redirects, never writes to any database, and is explicitly disconnected from legal-region creation (§4.D). Requires an actual Vercel deployment to see real geo data — the geo headers are not populated under local vercel dev.

Supabase hosts the Postgres database, Auth, and 8 Edge Functions declared in supabase/config.toml: chat-ai, admin-delete-user, send-trial-expiration-email, send-subscription-expiration-email, send-quote-email, resend-email-webhook, billing-checkout-stub, and get-public-quote. get-public-quote is intentionally public at the gateway level (verify_jwt = false) because quote viewing is anonymous by design; its own code is the security boundary (see §18).

Important shared components/utilities

src/shared/supabase.js — the singleton Supabase client (client-side).

src/shared/useSignaturePad.js — canvas-based digital signature hook, used by both public quote pages.

src/shared/wipeUserData.js — deletes all of a user's data across tables (used by account-cancellation flow).

src/utils/regionConfig.js — the region/currency/date-formatting source-of-truth helpers (REGION_RULES, isHebrewEnv, getCurrencySym, getRegionTaxRate, getRegionBillingProfile, formatDateLocal, formatNumberLocal). Central to §3/§4.

src/utils/seoMeta.js — SEO metadata helper (not deeply audited this session).

src/theme/neonTheme.js — shared color/font theme constants (NEON, FONT_HE, FONT_EN).

Directory map (verified, one level deep)

src/
├── main.jsx                    # bundle selector (AppLocal vs AppGlobal)
├── App.jsx                     # ⚠ CONFIRMED DEAD CODE — see §14
├── AIChatWidget.jsx
├── local/AppLocal.jsx          # Hebrew bundle router
├── global/AppGlobal.jsx        # English/International bundle router
├── pages/
│   ├── Dashboard.jsx           # central authenticated app
│   ├── LandingLocal.jsx
│   ├── LandingGlobal.jsx
│   ├── PublicQuote.jsx         # Hebrew public quote
│   ├── PublicQuoteEn.jsx       # English public quote
│   ├── Contact.jsx / Privacy.jsx / Terms.jsx
│   └── AILogs.jsx              # super-admin only
├── components/
│   ├── SmartPublicQuote.jsx    # trusted public-quote language/currency router
│   ├── QuoteForm.jsx / QuotesTab.jsx
│   ├── ClientsTab.jsx / FinancesTab.jsx / ServicesCatalog.jsx / SettingsTab.jsx
│   ├── AdminUsersTab.jsx / UserDetailsModal.jsx
│   ├── PricingModal.jsx
│   ├── PublicTools.jsx / PublicToolsEn.jsx
│   ├── AuthScreen.jsx
│   ├── PublicQuoteHeader.jsx
│   └── (various modals: EditClientModal, EditExpenseModal, EmailConfirmModal, LifetimeConfirmModal, SignOutModal, AccessibilityModal, DraggableCalculator)
├── shared/
│   ├── supabase.js / useSignaturePad.js / wipeUserData.js
├── utils/
│   ├── regionConfig.js / seoMeta.js
└── theme/neonTheme.js

supabase/functions/
├── send-quote-email/index.ts
├── resend-email-webhook/index.ts
├── chat-ai/index.ts
├── admin-delete-user/index.ts
├── billing-checkout-stub/index.ts
├── send-trial-expiration-email/index.ts
├── send-subscription-expiration-email/index.ts
└── get-public-quote/index.ts          # NEW/current working tree; deployed and live-verified, not yet committed/pushed

api/cron.js                     # Vercel daily cron (not a Supabase function)
api/geo.js                      # ⚠ pending/uncommitted — fresh geo lookup for first-signup region (§4.D)
middleware.ts                   # ⚠ pending/uncommitted — Vercel Routing Middleware, anonymous UI-only geo cookie (§4.D)
vercel.json / vite.config.js / index.html

CRITICAL IRON RULE — LOCAL / INTERNATIONAL SEPARATION

This is one of the most important architectural and business rules in ProFlow. Language and currency separation is a SYSTEM-WIDE invariant.

LOCAL / ISRAEL

UI must be Hebrew.

RTL.

Currency must be ILS / ₪ only.

VAT = 18%.

Local customer-facing communication (email, WhatsApp) must be Hebrew.

Local public quote presentation must be Hebrew.

INTERNATIONAL

UI must be English only.

LTR.

Allowed currencies only: USD ($), EUR (€), GBP (£).

ILS / ₪ must NEVER appear.

VAT = 0%.

International customer-facing communication (email, WhatsApp) must be English only.

International public quote presentation must be English.

No future developer or AI should weaken this separation merely for convenience.

Authenticated account behavior must ultimately be determined by trusted account/quote data (business_settings.country, or a quote's own persisted currency/tax_rate) — not browser language, URL tricks, or stale localStorage.

Public quote language/currency must follow trusted persisted quote/account data — never the viewer's browser.

A full audit against this rule was completed and pushed at commit 2532f1b — see §5.

GOVERNING PROJECT-WIDE RULES — MARKET / LANGUAGE / CURRENCY + PROCESS (owner-issued standing directive, added 2026-08-25; this block STRENGTHENS/CONSOLIDATES the Iron Rule above — it does not replace it, and does not contradict it. A fresh agent must read this block before making any implementation decision, not only before market/language/currency-specific work.)

Global scope: the Iron Rule above applies to the entire product and ALL future work. This explicitly includes — not merely "for example" — the Hebrew landing page, the English/International landing page, the authenticated Hebrew application, the authenticated English/International application, Dashboard, AI/chat, AI prompts and responses, pricing and plans, subscription/payment displays, quotes and quote items/totals, Public Quote, emails, trial/subscription reminders, CTA flows, server-generated routes/deep links, templates, notifications, validation/error/success messages, and any future feature. If a new surface is user-facing, this rule applies to it by default — the list is illustrative, not exhaustive.

Currency isolation is symmetric and absolute in both directions. Under no circumstances may USD, EUR, GBP, or any other foreign currency appear as the applicable product/price currency in the Israeli/Hebrew flow, and under no circumstances may ILS/₪ appear as the applicable product/price currency in the International/English flow — in either direction — unless the owner explicitly designs and authorizes a specific exception. Cross-contamination (wrong-language content, wrong-currency pricing, Israeli pricing on the international landing page, international pricing on the Israeli landing page, the AI answering in the wrong language for its context, a server-generated URL sending a user into the wrong market/language flow, etc.) is a PRODUCT-INTEGRITY REGRESSION, not a cosmetic issue.

Do not infer or change market/language/currency resolution logic from a single weak signal (browser language, one client-supplied boolean, URL alone, email address, one arbitrary frontend value). Before proposing any change to resolution logic, read and audit the current authoritative source(s) already used by ProFlow (business_settings.country, a quote's own persisted currency/tax_rate, route/context — see the Region Architecture section immediately below for the full A/B/C/D breakdown) first, and obtain explicit owner approval before changing that logic.

The Four AI Contexts: the AI/chat surface has four independently protected contexts that must never bleed into one another — (1) the Hebrew landing page, (2) the English/International landing page, (3) the authenticated Hebrew application, (4) the authenticated English/International application. The AI must answer in the language correct for the context it is running in, not merely the language of the visitor's message. Hebrew contexts: Hebrew only, Israeli context, ILS/₪ only wherever currency is relevant. English/International contexts: English only, international context, USD/EUR/GBP only wherever currency is relevant, and ILS/₪ must never appear as the applicable product/price currency. (Current implementation: src/AIChatWidget.jsx / supabase/functions/chat-ai/index.ts.) UPDATE (2026-08-25): this requirement is now CURRENT / VERIFIED, not merely stated. A currency cross-contamination defect was found live in all four contexts (the AI offering ₪ figures in English contexts and $ figures in Hebrew contexts, traced to a single unbranched pricing block in chat-ai's system prompt), fixed via a market-specific pricingBlock branched on the existing trusted isHebrew value, deployed, and live-tested across all four contexts with all rows PASS — see §18.U for the full verified scope, commit, and matrix. Do not re-describe this as merely a stated requirement never tested.

Admin AI Support Logs — protected existing capability: the Super Admin AI Support Logs viewer (src/pages/AILogs.jsx, reading the chat_logs table) is a capability the owner actively relies on to distinguish ordinary questions from important/exceptional conversations — cancellation requests, complaints, legal/lawsuit-type questions, difficult/hard questions, and feature requests. Any future AI/security/auth/credential/alerting/UI change — including any further service_role migration work on chat-ai and the OPEN AI Support Logs status-indicator follow-up (§18.V) — must preserve, without silently breaking, unless the owner explicitly authorizes a redesign: display of logged conversations/questions and AI responses, timestamp/ordering, attribution as currently designed, free-text search, and category filtering across exactly GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION. If a change could plausibly affect this capability, that must be called out explicitly in that change's verification report, never assumed unaffected. UPDATE (2026-08-25): this capability was freshly re-verified, in production, by the owner directly (not merely by an automated session) after the §18.U chat-ai classification fix — see §18.U for exactly what was confirmed.

Mandatory bilingual/market regression matrix: any change capable of affecting shared or user-facing market behavior must explicitly verify both market families and report each row as PASS / FAIL / NOT TESTED — no applicable row may be silently omitted, and a change must never be classified as FULLY VERIFIED while an applicable row is NOT TESTED. Minimum required rows:

ISRAEL / HEBREW — Hebrew content: PASS/FAIL/NOT TESTED. ILS/₪ behavior: PASS/FAIL/NOT TESTED. Israeli route/context: PASS/FAIL/NOT TESTED.

INTERNATIONAL / ENGLISH — English content: PASS/FAIL/NOT TESTED. ILS/₪ ABSENT: PASS/FAIL/NOT TESTED. USD/EUR/GBP behavior: PASS/FAIL/NOT TESTED. International route/context: PASS/FAIL/NOT TESTED.

Preserve-working-behavior discipline (applies equally to security fixes, migrations, refactors, and cleanups): none of these may break existing working product behavior. Audit callers/dependencies first. A side finding discovered mid-task must be reported, never fixed opportunistically inside the same change. Required sequence: AUDIT → REPORT → OWNER REVIEW → EXPLICIT OWNER AUTHORIZATION → SMALLEST SAFE CHANGE → TARGETED VERIFICATION → OWNER REVIEW → COMMIT/PUSH ONLY AFTER APPROVAL. (This generalizes, and does not contradict, the detailed ChatGPT+Claude collaboration workflow already specified in §11A.)

Owner-driven work order: the owner's checklist/requests determine work priority at the start of every session — not automatic continuation of whatever multi-stage initiative was last in progress. The service_role credential remediation (§18.N–§18.T) remains OPEN, but no further dependency in that sequence may be started merely because a fresh session begins or because §18.P still lists remaining items — it starts only when the owner explicitly asks to resume that specific work. The same principle applies to any other open multi-stage initiative documented in this file.

Region Architecture

There are four distinct, non-interchangeable concepts in this codebase. Confusing them is the single most common source of Local/International bugs found during the §5 audit (and the reason concept D below exists at all — see its history).

A. Anonymous / pre-signup landing-page language selection

Source of truth: query param → path prefix → localStorage['proflow_lang'] → geo UI cookie (pending, see D) → navigator.language.

This is the only context where browser-language-derived (and, as of the pending work, geo-derived) signals are legitimate for display purposes. It governs exactly one decision: which of the two static app bundles (AppLocal/AppGlobal) mounts, and therefore which landing page an anonymous visitor sees.

src/main.jsx:

const isEnglishEnv = langParam === 'en' ? true
: langParam === 'he' ? false
: window.location.pathname.startsWith('/en') ? true
: window.location.pathname.startsWith('/he') ? false
: storedLang === 'en' ? true
: storedLang === 'he' ? false
: geoCountryCookie ? geoCountryCookie !== 'IL'   // ⚠ pending/uncommitted — see D
: !browserLang.startsWith('he');

This bundle choice is UI-display-only. As of the pending work (§D), it no longer seeds any account-creation default by itself — see D for why that distinction now matters and how it's enforced.

B. Authenticated account region

Source of truth: business_settings.country, exposed in Dashboard.jsx as bizCountry, with isLocalIsraeliBusiness = bizCountry === 'Local' || bizCountry === 'LCL'.

bizCountry is unconditionally re-synced from business_settings.country on every settings fetch — never gated by ?lang=.

Dashboard.jsx's isHebrew (drives dir, font, and every UI string in the authenticated app) is computed via isHebrewEnv(bizCountry, session) in src/utils/regionConfig.js — as of the §5 audit, this no longer accepts a ?lang=/path override for an authenticated session (previously it did — this was violation #1, fixed).

isHebrewEnv() itself checks bizCountry before any localStorage cache — cache is only a fallback for when the true country isn't yet known (previously the order was reversed — violation #2, fixed).

Currency and VAT rate are derived solely from isLocalIsraeliBusiness / getRegionTaxRate(bizCountry), never from isHebrew or any display-language signal.

C. Persisted quote region/currency/tax behavior

Source of truth: the individual quote's own currency and tax_rate columns, set at creation time and preserved historically.

A quote, once created, keeps its own currency/tax_rate even if the owning account's region is later corrected/changed — this is intentional (see comments in Dashboard.jsx and QuotesTab.jsx) so that a historical document doesn't retroactively change. isLocalQuote = Number(quote.tax_rate) > 0 || quote.currency === 'ILS' is the pattern used (duplicated in SmartPublicQuote.jsx, Dashboard.jsx, QuotesTab.jsx) to decide a specific quote's own presentation language — this governs the public quote link route, the WhatsApp message text/link, and (as a secondary fallback only, see §6) the outbound email.

Do not confuse B and C: an account's current region (B) governs new quotes, VAT calculation on save, and the authenticated dashboard UI. A specific quote's persisted data (C) governs how that one document (public page, WhatsApp text, email) is presented, independent of what the account's region has since become.

D. First-time business legal-region resolution (new-account creation) — ⚠ pending/uncommitted, see §12

Source of truth: a fresh, server-side Vercel geo lookup made at the exact moment of account creation (/api/geo) — or, if that's unavailable, an explicit one-time choice from the authenticated user. Never a cookie, never localStorage, never the anonymous UI bundle (A).

This concept exists because of a real bug found and fixed mid-session: an earlier version of this mechanism (mirroring the pre-existing bundleIsHebrew design) let the anonymous UI bundle (concept A — itself derived from ?lang=/path/navigator.language) silently become the permanent business_settings.country for a brand-new account. That meant a UI-language override (e.g. ?lang=he used purely to preview the Hebrew UI from outside Israel) could, if it happened to coincide with a signup, permanently misclassify a business's legal region with no error and no indication to the user. This was corrected by fully decoupling "what language is shown" (A) from "what legal region gets created" (D).

Mechanism, in src/pages/Dashboard.jsx's fetchSettings, only in the branch where no business_settings row exists yet for the user:

fetchFreshGeoCountry() calls GET /api/geo (a live, uncached request — not a stored value) and normalizes the response to uppercase.

If it returns a usable country: createNewBusinessSettings(userId, userEmail, country === 'IL' ? 'Local' : 'International') is called immediately. IL → country: 'Local', currency: 'ILS', Hebrew default terms; anything else → country: 'International', currency: 'USD', English default terms. This is the only place VAT-relevant defaults are set for a new account, and it flows into the existing, unchanged §3/§B rules from there.

If fresh geo is unavailable (network failure, non-200, no header — e.g. local dev, or a proxy in front of the deployment): no row is created. Instead needsRegionChoice (React state) is set true and the authenticated user is shown a minimal, two-button "Israel / International" screen (rendered before the rest of the dashboard, in the same gate position as the AuthScreen loading screen) inside Dashboard.jsx itself. Its text follows the currently-displayed UI language (isHebrew) — that's cosmetic only; the value saved is exactly whichever button was clicked, mapped identically to step 2's rules.

createNewBusinessSettings(userId, userEmail, country) is the single code path — verified via a repository-wide grep for business_settings + .insert( — allowed to INSERT a new business_settings row anywhere in this codebase. It:

Rejects (no insert) any country value other than exactly 'Local' or 'International'.

Guards against double-submission with a synchronous useRef flag (isCreatingBusinessSettingsRef, checked/set before any await, immune to React state-batching timing) in addition to a useState flag that disables both buttons in the UI while a creation attempt is in flight.

On failure (Supabase error, or no row returned): does not clear needsRegionChoice or the pending user/email — the user stays on the same explicit-choice screen (even if this attempt was the automatic geo-success path from step 2, not a manual click), sees a localized error, and can retry. There is no code path that renders the full dashboard with a partially-initialized business identity.

On success: populates all biz* component state from the inserted row, clears needsRegionChoice/the error/the pending-account marker, and only then does the full dashboard render.

handleSaveSettings (the manual Settings-tab save form) no longer contains a fallback INSERT. It previously had one (if (settingId) UPDATE else INSERT) that independently bypassed this whole contract if settingId was ever unexpectedly null. That branch now fails safely instead — shows a localized "please reload and try again" error, logs a diagnostic to console, inserts nothing, and leaves existing state untouched.

What this does not touch: business_settings.country for an account that already has a row (concept B) is completely unaffected — the if (data) branch of fetchSettings (see B above) has no reference to geo, needsRegionChoice, or anything from this section, and was last modified in the pushed 2532f1b audit.

Current Approved Region Audit

A system-wide Local/International separation audit was completed and pushed at:

Commit: 2532f1b — "Enforce strict Local and International separation"

Files included in that commit:

src/pages/Dashboard.jsx

src/pages/PublicQuoteEn.jsx

src/utils/regionConfig.js

supabase/functions/send-quote-email/index.ts

The following protections were verified present in the code at this baseline:

Protection

Verified location

Dashboard language (isHebrew) tied solely to isHebrewEnv(bizCountry, session), no ?lang=/path override

Dashboard.jsx ~line 91

Wrong-region first paint prevented during login/account-switch: onAuthStateChange's SIGNED_IN/TOKEN_REFRESHED handler now sets isInitializing(true) → awaits loadData() → isInitializing(false) for a genuine user-id change, instead of firing loadData unawaited with no render gate

Dashboard.jsx, inside the onAuthStateChange subscription

WhatsApp message text keyed on the quote's own isLocalQuote, not the spoofable display-language flag

Dashboard.jsx, sendWhatsApp

PublicQuoteEn.jsx self-verifies the fetched quote's currency/tax_rate; renders <PublicQuote /> (Hebrew) instead if it's actually a Local/ILS quote; currency-symbol resolution whitelists USD/EUR/GBP only

src/pages/PublicQuoteEn.jsx

Quote tax_rate preserved (not silently rewritten to the account's current region) when editing an existing Draft/Sent quote

Dashboard.jsx, editingOriginalQuote/taxRate computation

International currency whitelist enforced when duplicating a quote (a stale 'ILS' value can no longer be copied into a new quote for an International account)

Dashboard.jsx, handleDuplicateQuote

isHebrewEnv() prioritizes the trustworthy country argument over localStorage cache (previously reversed); also recognizes legacy 'LCL'

src/utils/regionConfig.js

Settings-load currency also whitelists USD/EUR/GBP for International instead of trusting business_settings.currency verbatim

Dashboard.jsx, fetchSettings

Server-side email region/currency resolution unified into a single function (resolveEmailRegion) so language and currency symbol can never disagree

supabase/functions/send-quote-email/index.ts

Email sending fails safely (throws → 400 response, email not sent) if a trustworthy region/currency cannot be established from either business_settings or internally-consistent quote data

same file

An unknown/unrecognized business_settings.country value (not Local/LCL/International) is not silently treated as International

same file, resolveEmailRegion

International email can never produce ₪ (currency symbol whitelisted to USD/EUR/GBP, with a safe $ default)

same file

Local email can never produce $/€/£ (Local branch hard-returns ₪ regardless of the quote's stored currency)

same file

All of the above were verified against the actual current file contents while writing this document (not merely recalled from prior conversation).

5b. Pending follow-on hardening — geo-based landing routing & first-signup region resolution (⚠ NOT yet committed/pushed)

Built in the same working tree, on top of 2532f1b, resolving the investigation opened in §13:

Protection

Verified location

Anonymous landing bundle choice (concept A) may now be influenced by a fresh Vercel geo lookup, ranked below ?lang=/path/localStorage and above navigator.language — never overriding an explicit or previously-stored preference

src/main.jsx, middleware.ts

The geo signal used for anonymous UI routing (a cookie) is architecturally incapable of setting a new account's legal region — a completely separate, fresh server call is used for that (see next rows)

middleware.ts (writes UI-only cookie), Dashboard.jsx (never reads that cookie for region purposes)

New-account legal region comes from a fresh, uncached, server-side geo lookup made at account-creation time, not any cached/client-controlled value

api/geo.js (Cache-Control: no-store, reads only x-vercel-ip-country, never a client-supplied parameter), Dashboard.jsx fetchFreshGeoCountry()

If fresh geo is unavailable, the account region is never guessed from UI language/bundle/browser signals — the user is required to make an explicit choice before any row is created

Dashboard.jsx, needsRegionChoice gate + explicit "Israel/International" screen

Exactly one code path in the entire repository can INSERT a new business_settings row (verified by repo-wide grep)

Dashboard.jsx, createNewBusinessSettings()

Double-submit / concurrent-insert protection via a synchronous useRef guard, independent of React state-batching timing

Dashboard.jsx, createNewBusinessSettings()

Insert failure (automatic or manual) never renders a partially-initialized dashboard — always routes back to the explicit-choice screen with a localized, non-raw error

Dashboard.jsx, createNewBusinessSettings()

The Settings-tab manual save form's own former fallback INSERT (a second, independent account-creation path that bypassed this whole contract) was removed and now fails safely instead

Dashboard.jsx, handleSaveSettings

International landing-page marketing currency no longer has an A$/AUD branch — falls back to $ like any other unmatched locale

src/pages/LandingGlobal.jsx

Existing-account behavior (concept B) is provably untouched by any of the above — no reference to geo/needsRegionChoice anywhere in fetchSettings's existing-row branch

Dashboard.jsx, fetchSettings

See §4.D for the full mechanism and §12 for exact commit/push status.

Email Architecture

supabase/functions/send-quote-email/index.ts

Resend integration: Sends via POST https://api.resend.com/emails, Authorization: Bearer ${RESEND_API_KEY}, from: 'ProFlow info@quotecodepro.com'.

Region/currency resolution: A single function, resolveEmailRegion(bizCountry, bizCurrency, quoteCurrency, quoteTaxRate), returns { hebrew: boolean, symbol: string } | null:

If business_settings.country is 'Local'/'LCL' → { hebrew: true, symbol: '₪' } unconditionally (never influenced by the quote's own currency).

If it's exactly 'International' → English, symbol from the quote's own currency if it's USD/EUR/GBP, else the account's business_settings.currency if valid, else a hard '$' default — never ₪.

If business_settings.country is any other non-empty value → returns null (fails safely — does not assume International).

If business_settings (or its user_id link) is missing entirely → falls back to the quote's own persisted currency+tax_rate, accepted only if internally consistent (ILS + tax_rate > 0 → Hebrew; USD/EUR/GBP + tax_rate === 0 → English). Any other/contradictory combination → null.

If resolveEmailRegion returns null, or quoteId/Supabase env vars/the quote row itself are missing, the function throws and the outer catch returns a 400 JSON error — the email is not sent.

quoteId tagging: Every send attaches tags: [{ name: 'quote_id', value: String(quoteId) }] to the Resend API call, so bounce webhooks can be matched back to the quote (see below).

Client input is never trusted for region/language: the payload's isHebrew/any client-provided flag is ignored; language/currency come only from the server-side DB lookups described above.

supabase/functions/resend-email-webhook/index.ts

Svix signature verification: Reads svix-id, svix-timestamp, svix-signature headers; computes HMAC-SHA256 over ${svixId}.${svixTimestamp}.${rawBody} using RESEND_WEBHOOK_SECRET (its whsec_ prefix stripped, then base64-decoded) and compares against the signature(s) in svix-signature. Missing headers → 401; invalid signature → 401; missing secret env var → 500.

Event types handled: Only email.bounced and email.failed. Other Resend event types (e.g. email.delivered, email.opened) are acknowledged with 200 but otherwise ignored.

quote_id tag matching: Extracts the quote_id tag from event.data.tags (supports both array-of-{name,value} and plain-object tag shapes).

Database update on bounce/failure (table quotes, by id):

.update({
email_bounced: true,
email_bounce_reason: bounceReason,   // event.data.bounce.message || event.data.bounce.type || eventType
email_bounced_at: new Date().toISOString(),
})

There is no "delivered" success write-back in this webhook file — clearing email_bounced/email_bounce_reason/email_bounced_at back to false/null happens client-side in Dashboard.jsx's executeEmailSend, on the next successful resend.

Quote Architecture

Creation: Dashboard.jsx's handleCreateNewQuoteClick resets the form state and forces currency to 'ILS' (Local) or the account's current international currency. handleSaveQuote inserts into quotes with currency/tax_rate derived from the account's live region for a genuinely new quote.

Customer email is optional (P1, business-priority fix) — CURRENT / VERIFIED, COMMITTED, DEPLOYED: mandatory-email behavior had blocked a real production user from completing the normal quote workflow. Root cause, found via read-only audit: a single HTML `required` attribute on the client-email `<input>` in src/components/QuoteForm.jsx was the sole enforcement point in the entire app — Dashboard.jsx's handleSaveQuote and EditClientModal.jsx already saved `email: clientEmail ? clientEmail.trim() : ''` (empty string, never a fabricated placeholder) and already validated format only when a value was present, requiring no change in either file. Fix: removed only that one `required` attribute; `type="email"`, value/onChange, styling, and label were preserved unchanged. Committed and pushed: b64fae4b6ce9dc370609be01c407a34f430482ed ("Allow quotes without customer email") — 1 file changed (src/components/QuoteForm.jsx only).

Live TEST verification (disposable TEST rows, both designated TEST accounts, no real customer data): a client+quote was created successfully with the email field left completely blank in both the Local/Israel TEST account (clients.email persisted as '', quote currency ILS, tax_rate 0.18 — Iron Rule intact) and the International TEST account (clients.email persisted as '', quote currency USD, tax_rate 0, no ILS/₪ regression) — no database constraint error occurred in either case. A parallel valid-email TEST case on the Local account confirmed populated-email behavior is unchanged. Note on rigor: the live schema definition for clients.email itself was not conclusively read via anon-key introspection (the project's PostgREST schema endpoint requires a secret-class key, correctly not used for this) — compatibility was proven empirically through these authorized TEST writes, not through a schema read; do not describe the schema as having been directly inspected.

Preserved, unchanged, confirmed by code trace: existing email-format validation (a malformed address, if entered, is still rejected by the same regex in both Dashboard.jsx and EditClientModal.jsx); executeEmailSend continues to fail safely (no crash, no network send, no fabricated address) when a quote's client has no email; sendWhatsApp remains entirely independent of client email (phone-only); the resend-email-webhook bounce mechanism and QuotesTab.jsx's red bounce indicator were not modified in any way by this change. Scope boundary, stated honestly: live bounce behavior was NOT re-tested as part of this P1 round — not needed, since the diff (a single line in QuoteForm.jsx) provably does not touch any bounce-related file; do not describe live bounce as having been re-verified here.

TEST data note: three disposable P1 TEST rows (one Local empty-email client+quote, one International empty-email client+quote, one Local valid-email regression client+quote) remain in the live database as of this update, clearly tagged (company_name prefixed "P1-TEST-"), under the two designated TEST accounts only. Not cleaned up as part of this documentation round — treat cleanup as separately-authorized work; do not assume it has occurred.

Status: P1 checklist item — COMPLETED + VERIFIED. Business rule now in effect: customer email is optional for quote creation; if left blank, the normal quote/customer workflow continues with no fabricated placeholder; if provided, existing format validation remains mandatory exactly as before. The existing bounce/red-indicator mechanism remains a protected invariant, unaffected by and independent of this change.

Editing: handleEditClick loads an existing quote's fields into the form. Editing is blocked entirely if the quote is approved/paid/signed. On save, currency and (as of the §5 audit) tax_rate are preserved from the original row, not recomputed from the account's current region — protecting historical documents from silent corruption.

Duplication: handleDuplicateQuote clones a quote into a new Draft. Currency is now whitelisted against USD/EUR/GBP for International accounts (a stale 'ILS' value on the source quote can no longer leak into the duplicate).

Currency: Locked at the QuoteForm.jsx UI level (disabled <select>); actual value is controlled by Dashboard.jsx state per the rules above.

VAT/tax_rate: taxRate is computed at render time from getRegionTaxRate(bizCountry) for new/duplicated quotes, or preserved from editingOriginalQuote.tax_rate when editing.

Public link — CURRENT / VERIFIED: SmartPublicQuote.jsx is the single fetch/router for /public-quote/, /quote/, and /en/public-quote/. It loads the minimized public DTO through get-public-quote and selects Hebrew/English from the quote's own persisted tax_rate/currency. No public page performs direct table reads.

Signature/approval — CURRENT / VERIFIED: Both public quote pages use src/shared/useSignaturePad.js (canvas-based). On approval, the client must have drawn a signature (hasSigned); the app calls:

supabase.rpc('public_approve_quote', {
p_quote_id: quote.id,
p_signature_data_url: getSignatureDataUrl(),
})

public_approve_quote is a SECURITY DEFINER RPC owned by postgres with EXECUTE granted to anon/authenticated and PUBLIC revoked. It validates the PNG data URL and performs one atomic conditional UPDATE only when the quote is draft/sent and unsigned. Re-approval/signature overwrite is rejected generically. signature remains stored as a base64 PNG data-URL. Once a quote is approved/paid/signed, the existing immutability triggers and UI/handler guards remain the independent enforcement layers.

Status/history: Statuses are draft/sent/approved/paid, rendered as colored badges in QuotesTab.jsx. A view_count column tracks public-link opens; quotes with view_count >= 3 and not yet approved/paid are surfaced as "hot" leads in the dashboard.

WhatsApp/email (confirmed): QuotesTab.jsx row actions include "Send WhatsApp" (sendWhatsApp in Dashboard.jsx, opens a prefilled https://api.whatsapp.com/send link) and "Send Email" (executeEmailSend, invokes the send-quote-email edge function). Both are gated behind plan checks (isBasicOrAbove/isPro) via handleProtectedAction.

Excel export (confirmed): QuotesTab.jsx's export button invokes the handleExportQuotes prop, implemented in Dashboard.jsx. See §8.

Excel Quotes Export

Dashboard.jsx's handleExportQuotes builds a real .xlsx workbook (via the exceljs package) from filteredQuotes (respects the current search/status filter — does not export all quotes unconditionally).

Local account:

Hebrew, worksheet rightToLeft: true.

All amounts forced to ₪ (regardless of the quote's own stored currency — the account's region is authoritative for this report).

Hebrew column headers and Hebrew status labels (טיוטה/נשלח/אושר/שולם).

Title: <Business Name> – דוח הצעות מחיר.

International account:

English, LTR.

Currency resolved per-quote, restricted to USD/EUR/GBP (an ILS/invalid quote currency falls back to the account's currency or USD).

English column headers and English status labels (Draft/Sent/Approved/Paid).

Title: <Business Name> – Quotes Report.

The export-date metadata row's date formatting uses the account's valid International currency (USD/EUR/GBP) for locale selection, with USD as the safe fallback if the account currency isn't one of those three.

Quote numbers are exported in the same short, user-facing format shown in QuotesTab.jsx (#${quote.id.slice(0, 6)}), not the raw UUID.

Expenses export remains separate and unchanged: Dashboard.jsx's handleExportExpenses still uses the original exportToCSV helper (plain CSV, not XLSX) — it was explicitly not touched by the Excel-export or region-audit work.

Database Model — Observed Database Contract From Application Code

This is not a complete authoritative schema. No SQL migrations or schema-definition files were found in this repository. The tables/columns below originated from application-code observation, but the Public Quote security track later added direct live-schema/RLS/GRANT verification for business_settings, clients, quotes, quote_items, quote_attachments, storage.objects, and the quote-files bucket. For those objects, §18 is authoritative for the current verified access-control state and should override older assumptions in this section.

Important live-schema corrections discovered during §18: quote_items has unit_price (not price); quotes has no vat column and no client_name column; quote_attachments now has storage_path; live business_settings does contain emailjs_service_id/emailjs_template_id/emailjs_public_key; live production did NOT have the subscription_ends_at field that older application code assumed. Verify the live schema again before billing/subscription work.

Table

Observed columns

quotes

id, user_id, client_id, client_type, currency, tax_rate, subtotal, total, status, valid_until, discount, terms, notes, subject, quote_subject, view_count, signature, email_bounced, email_bounce_reason, email_bounced_at, expiration_reminder_sent, created_at (+ embedded relations clients(...), quote_items(...))

clients

id, user_id, company_name, email, phone, client_type, tax_id, address, terms, notes, created_at

services

id, user_id, name, price, created_at

expenses

id, user_id, description, amount, category, is_recurring, expense_date

quote_items

id (implicit), quote_id, description, quantity, unit_price, total_price

quote_attachments

id, quote_id, file_name, file_url, file_size, storage_path

business_settings

id, user_id, email, business_name, tax_id, phone, address, logo_url, plan, role, country, currency, default_terms, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, subscription_ends_at, subscription_reminder_3d_sent, subscription_reminder_24h_sent, last_sign_in, created_at

chat_logs

id (implicit), user_email, user_question, ai_response, category, created_at

app_settings

key, value, updated_at (single confirmed use: api/cron.js upserts key: 'exchange_rates'; no confirmed reader of this table was found in src/)

Supabase Storage: one bucket reference confirmed — supabase.storage.from('quote-files') (upload/getPublicUrl) in Dashboard.jsx, used for quote attachment files (adjacent to quote_attachments.file_url).

Role values observed: business_settings.role includes at least 'user' and 'super_admin' (used for admin panel and AILogs.jsx access gating).

Plan values observed: business_settings.plan includes 'free', 'basic', 'pro' (see §7 subscriptions).

Country values observed: 'Local', 'LCL' (legacy alias for Local), 'International'.

⚠ Pending/uncommitted invariant (see §4.D, §12): as of the working-tree state described in this update, business_settings INSERT (as opposed to UPDATE) is intended to happen from exactly one place in the codebase — createNewBusinessSettings() in Dashboard.jsx. Verify this still holds with a fresh grep for business_settings + .insert( before relying on it, especially if this section is read after further changes.

business_settings.user_id is now UNIQUE and NOT NULL (added as part of the §17.D security remediation — was neither previously). This makes the "one row per user" invariant stated earlier in this section structurally enforced, not merely conventional.

Environment Variables / Secrets

Never include actual secret values in code, chat, or documentation — names only.

Client-safe (bundled into the browser, VITE_* prefix)

Variable

Used in

VITE_SUPABASE_URL

src/shared/supabase.js

VITE_SUPABASE_ANON_KEY

src/shared/supabase.js (public by design — protected by Supabase RLS, not secrecy)

Server-only secrets — must never be exposed client-side

Variable

Used in

SUPABASE_URL

All 7 edge functions

SUPABASE_ANON_KEY

Several edge functions (used to build a caller-scoped client from the incoming JWT)

SUPABASE_SERVICE_ROLE_KEY

All 7 edge functions — full-privilege key

RESEND_API_KEY

send-quote-email, send-trial-expiration-email, send-subscription-expiration-email

RESEND_WEBHOOK_SECRET

resend-email-webhook (Svix signature verification)

CRON_SECRET

send-trial-expiration-email, send-subscription-expiration-email, api/cron.js (shared secret between Vercel Cron and Supabase edge functions)

OPENAI_API_KEY

chat-ai edge function — note: this variable is used in code but is not listed in .env.example; verify it is actually set in the Supabase Edge Function secrets before assuming the AI widget works in any given environment

Declared for future use, not currently wired into active code

STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, INVOICE_API_KEY — present in .env.example with explicit "scaffolding only" comments. billing-checkout-stub/index.ts contains a commented-out real Stripe call referencing STRIPE_SECRET_KEY; it is not active.

.env.example exists at the repo root and documents all of the above (no values). .env is gitignored.

Development Rules for Future AI/Developers

Do not redesign working architecture without justification.

Prefer minimal, targeted fixes.

Preserve existing functionality.

Never invent files, APIs, DB columns, routes, or environment variables — verify against the current repository first.

Read affected files before modifying them.

Preserve existing conventions (this codebase has heavy inline Hebrew comments explaining non-obvious "iron rule" invariants — read them, they usually document a past bug).

Do not add dependencies unnecessarily.

Treat the project as production software.

Check security implications of any change.

Check Local/International separation (§3) on every relevant change.

Check mobile/responsive behavior for UI changes.

Run npm run build after code changes.

Run lint where appropriate (npm run lint).

Do not commit/push without explicit approval from the project owner.

Security-critical rules (added following the §17 remediation)

Approved/paid/signed quotes are immutable. This must never be re-weakened at the UI layer (QuotesTab.jsx/Dashboard.jsx) without the equivalent DB-trigger enforcement (§17.A) remaining in place — the UI lock and the DB triggers are two independent layers, and removing either without the other reopens a real, previously-exploited regression.

Security-sensitive business rules must be enforced at the database layer (RLS + triggers), never as a frontend-only check. Client-side gating (a hidden button, a disabled UI state, a role check in React) is a UX convenience, not a security boundary — see §17.B/§17.C for the concrete case where relying on this distinction mattered.

Never mutate real production or Lifetime customer data for testing. Any mutation-based verification (UPDATE/DELETE/INSERT attack simulation, trigger testing, etc.) must run against an explicit, disposable TEST account only.

Use explicit disposable TEST accounts for mutation tests, and remove/restore them afterward. See §17.F for the pattern followed in this remediation (one account restored to a clean state and kept, one account fully deleted with residue verified absent).

Very important workflow rule

When the project owner requests code to manually copy/paste, provide the complete updated file from beginning to end, not fragments — unless he explicitly requests only a patch/diff.

When an AI agent (e.g. Claude Code) is itself editing the repository directly, make minimal targeted edits and clearly report exactly which files were changed.

11A. ChatGPT + Claude Collaboration Workflow — MANDATORY

ProFlow is developed with a deliberate two-agent workflow: ChatGPT acts as the planning/review/safety layer, and Claude/Claude Code may be used as the repository inspection and implementation agent. This workflow is intentional and must be preserved across sessions.

Roles

Project Owner: final authority. Only the project owner may approve moving from investigation/design into implementation, and only the project owner may approve a commit/push.

ChatGPT: maintains project continuity, reasons about product/architecture/security implications, reviews evidence, prepares precise technical instructions for Claude, challenges assumptions, and keeps this HANDOFF aligned with verified state.

Claude / Claude Code: may inspect the repository, trace code paths, run read-only searches/greps/tests, report evidence, and — only after explicit authorization — make the narrowly approved changes.

Mandatory default: READ-ONLY

Every new Claude task must default to investigation only unless the project owner has explicitly approved implementation.

When asking Claude to investigate, the instruction must explicitly say:

DO NOT modify any files. DO NOT modify the database or production data. DO NOT commit. DO NOT push. Inspect and report only. STOP after reporting the findings.

Claude must not infer permission to implement merely because the root cause appears obvious, a fix seems small, ChatGPT described a solution, an audit suggests remediation, or a previous task included implementation permission. Authorization is task-specific, not persistent.

Required workflow before any change

Establish current state first. Read this HANDOFF; inspect current git status and relevant history when repository access is available; read every affected file/function; for DB/security work inspect the actual live schema/RLS/GRANT/trigger/function state rather than trusting historical documentation.

Investigate end-to-end. Trace callers, consumers, duplicate logic, Local/International variants, desktop/mobile render paths, DB dependencies, Edge Functions/server actions, scheduled jobs, and security boundaries. Search repository-wide for alternate implementations and distinguish observed facts from assumptions.

Report evidence before implementation. State root cause, exact files/functions/DB objects, dependencies/regression risks, and reasonable alternatives. During audit-only work explicitly report Files modified: NO, Database modified: NO, Commit/push: NO.

Wait for explicit owner approval. No implementation until the project owner approves the direction. If new evidence materially changes the approved design, STOP and return for approval.

Implement minimally after approval. Change only the approved scope; preserve existing architecture and working behavior; no opportunistic cleanup/refactors or unrelated schema/dependency/UI changes; re-check Local/International separation, responsive behavior, and security implications where relevant.

Verify before proposing commit. Review the diff; run appropriate build/tests/lint and targeted functional checks. For security/DB work verify resulting live state with read-only queries after the approved mutation. Never mutate real customer/Lifetime data for testing; use explicit disposable TEST accounts/data only. Report exactly what changed and what was verified.

Commit/push is a separate approval gate. Successful implementation/testing does not imply permission to commit. Claude must STOP after verification and wait for explicit project-owner approval before git commit or git push, unless the owner explicitly granted both implementation and commit/push permission.

Communication rules for Claude

Technical instructions sent to Claude should be written in English for clarity and consistency.

Evidence reports should be concrete: exact file paths, functions, relevant line ranges where practical, DB object names, and observed values.

Never present a planned design as already implemented.

If repository state conflicts with this HANDOFF, report the discrepancy and treat current verified repository/live DB state as authoritative; do not silently rewrite history.

For production data, authentication, RLS, GRANTs, triggers, billing/entitlements, account deletion, email automation, or Local/International separation, apply an especially conservative review.

HANDOFF maintenance

After an approved work item is completed and verified, update PROFLOW_HANDOFF.md so a new session can distinguish:

CURRENT / VERIFIED — confirmed present now.

PLANNED / APPROVED — agreed design not yet implemented.

OPEN / INVESTIGATION — unresolved or not yet audited.

HISTORICAL / SUPERSEDED — retained only when useful for context.

Never claim a commit, deployment, database object, schema field, feature, or fix is current unless it has actually been verified.

Proactive HANDOFF maintenance — standing rule (owner-issued, added 2026-08-25): PROFLOW_HANDOFF.md is the project's authoritative continuity document. Claude/future coding agents must proactively keep it current whenever a materially relevant project change occurs — do not rely on the owner remembering to request documentation. HANDOFF maintenance must be considered whenever work changes, discovers, or verifies any of: architecture, security posture, authentication/authorization, RLS/grants/policies/triggers, Edge Functions/backend behavior, Storage behavior, market/language/currency behavior, AI/chat behavior, email behavior, Public Quote behavior, routes/deep links, production-verified behavior, migrations, deployment state, open-vs-completed items, newly discovered risks/gaps, TEST workflows/verification methods, governing Iron Rules, important Git commits/checkpoints, recovery tags, or next-session starting state. At the end of any materially relevant completed or verified task, actively evaluate: "Does PROFLOW_HANDOFF.md now require an update?" If yes: identify exactly which section(s) became stale/incomplete, propose the smallest accurate update, preserve every unresolved item as OPEN, distinguish current state from historical/superseded state (per the CURRENT/VERIFIED, PLANNED/APPROVED, OPEN/INVESTIGATION, HISTORICAL/SUPERSEDED labels above), and never claim completion without verification.

Critical approval boundary — this proactive rule does NOT authorize scope creep: proactive HANDOFF maintenance does not authorize silently broadening the scope of an active task. Do not automatically edit HANDOFF during an unrelated narrowly-scoped task, modify source code while documenting, stage files, commit, push, deploy, modify backend state, or modify DB/RLS/Storage/credentials — unless that specific action is within the current explicit owner authorization. If a relevant HANDOFF update is required but is outside the currently authorized scope, finish/stop at the authorized boundary and clearly report "HANDOFF UPDATE REQUIRED", state exactly what should be documented, and wait for owner authorization before making it.

HANDOFF accuracy rule: HANDOFF must represent the VERIFIED CURRENT STATE, not stale assumptions carried forward merely because they already exist in the document. Before documenting a technical current-state claim, verify it using the appropriate available evidence for that claim (current repository state, committed Git history, deployment evidence, production verification, completed test evidence). Historical information may remain when useful, but stale statements must be clearly labeled HISTORICAL, SUPERSEDED, or otherwise unmistakably distinguished from current state — never silently rewritten in a way that loses important incident, security, rollback, or remediation context.

GitHub Backup / Recovery Checkpoint Policy — MANDATORY

Use Git/GitHub checkpoints at verified milestones, not as ad-hoc backups in the middle of unfinished work.

A checkpoint is appropriate only after the approved implementation has passed its required build/lint/tests and targeted functional/live verification.

The normal checkpoint sequence is:

update PROFLOW_HANDOFF.md to the newly verified state;

review git diff/status and confirm only intended changes are included;

obtain explicit project-owner approval for commit/push;

create one clean descriptive commit;

push to the approved branch/remote;

create a consistent Git tag for the verified milestone and push the tag.

Do not create a tag for a partially-tested or known-broken working tree. Do not mix unrelated unfinished work into a security/recovery checkpoint. Prefer consistent chronological tags from this point forward; old historical tag naming does not need to be rewritten.

Database-only Supabase changes are not automatically represented by a Git commit. For milestones containing live DB/RLS/GRANT/Storage changes, the HANDOFF must record the exact verified live end state and rollback/remaining blockers before the Git checkpoint is considered complete.

Git / Release State

Approved & pushed baseline (historical, superseded — kept for continuity): 5737626 — "Fix locked quote tooltip hit area". Current verified pushed baseline is newer: commit 1caaff6f47d911d8114c8eaedd1c3a20ec73c2fd ("Implement Public Quote security remediation: Edge Function + RPC cutover, RLS/GRANT hardening, Storage upload lockdown (Phases 1-4, Stages A-D1)"), tagged public-quote-security-2026-08-25 — both confirmed live-verified as ancestors of origin/main. Three further commits (4088c2c, 5a7d958, 3ada41a — Admin UI/Trial Extension work, see the Second, independent working-tree item entry below) are pushed on top of that. Do not treat 5737626 as the current baseline for any purpose.

CORRECTED — these files are COMMITTED AND PUSHED, not a pending working tree (this list previously said "not yet committed/pushed"; that status is superseded — see the baseline line above):

src/components/SmartPublicQuote.jsx — Phase 4 secure public-quote loader/router

src/global/AppGlobal.jsx — /en/public-quote/ now routes through SmartPublicQuote

src/pages/PublicQuote.jsx — DTO/RPC-based public flow

src/pages/PublicQuoteEn.jsx — DTO/RPC-based public flow; no self-routing fetch loop

supabase/config.toml — get-public-quote block with verify_jwt=false

supabase/functions/get-public-quote/index.ts — deployed Edge Function

All of the above were committed and pushed as 1caaff6f47d911d8114c8eaedd1c3a20ec73c2fd, tagged public-quote-security-2026-08-25 (both live-verified this update).

Current live Supabase state is also newer than the pushed baseline: §18 Phases 1–4 and Stages A/B/C/D1 are implemented and verified. Stage D2 is deliberately NOT started.

Branch: main

Remote: origin → https://github.com/quotecode-dev/quotecode-clean.git

Recent history (newest first, confirmed via git log at time of this update): 5737626 "Fix locked quote tooltip hit area" → 7e96b83 "Restore approved/signed quote immutability (UI lock + handler guards + tests)" (both §17.A) → 0843736 "Replace native dialogs with ProFlow UX" → 71cd378 "Fix localized SEO canonical and hreflang architecture" (this is SEO Phase 2 — see below, it is now committed, correcting this document's prior "pending" status) → aad3a7a (SEO Phase 1) → 9c8cb06 "Add safe geo routing and first-signup region resolution" → 60e5d2c "Add ProFlow project handoff document" → 2532f1b "Enforce strict Local and International separation" → 6d7a1ac and earlier. The geo/first-signup work described in §4.D and §5b, previously pending, is now committed and pushed as of 9c8cb06 — that section's "pending" language is superseded; §4.D/§5b remain accurate as an architecture description, just no longer uncommitted.

SEO Phase 2 (canonical/hreflang consolidation, §15) is now committed and pushed as 71cd378. This document previously (as of the aad3a7a checkpoint) described it as implemented-but-uncommitted — that status is now superseded. §15's design description remains accurate; only its commit status changed.

Security remediation (§17) — application code committed and pushed; DB objects live in Supabase (no in-repo migration file, consistent with this section's existing no-migrations caveat):

Quote immutability UI/handler code: 7e96b83, 5737626 (both pushed).

business_settings privilege-escalation fixes (role/plan/trial_ends_at UPDATE and INSERT hardening, UNIQUE+NOT NULL on user_id): DB-only — no application code changes were required, executed and live-verified directly in Supabase. See §17.B–§17.E for exact objects/policies.

Second, independent working-tree item — Admin UI redesign + Super Admin business_settings RLS/authority + Trial Extension fix — COMMITTED AND PUSHED (this section previously described these files as uncommitted; that status is now superseded, do not rely on the older wording):

The three frontend files previously tracked here as uncommitted (src/components/AdminUsersTab.jsx, src/components/UserDetailsModal.jsx, src/pages/Dashboard.jsx) are now committed and pushed to origin/main, across three commits, newest first:

3ada41a — "Fix trial extension eligibility logic" — src/pages/Dashboard.jsx only. See the Trial Extension entry in §19.A for full detail; production-verified by the owner (owner's own words: "עובד והכל תקין" / "works and everything is fine").

5a7d958 — "Document Super Admin UPDATE policy hardening" — PROFLOW_HANDOFF.md only, documenting the already-live §18.M backend work.

4088c2c — "Finalize Admin UI redesign and Super Admin visibility" — Super Admin exclusion from the managed-user list/KPIs, dead-code removal, User Details modal visual cleanup (see §19.A).

The Super Admin RLS/authority backend work described in §18.M was, and remains, independent of this frontend work's commit status — it was live in Supabase before, during, and after all three commits above; its own hardening (the UPDATE-policy migration to public.is_super_admin()) is a separate, already-documented, already-pushed-via-5a7d958 item.

If you are reading this in a future session: run git status/git log first — further work may already be committed on top of 3ada41a, or new pending changes may exist. Do not assume either state from this document alone.

Known Open Item — RESOLVED (committed/pushed; historical wording below may mention earlier pending state)

Original item (kept for history): landing-page geographic/locale behavior — it was observed that changing the location in Chrome DevTools' Sensors panel could affect currency/location-sensitive behavior on the landing pages. Investigation traced this to LandingGlobal.jsx's marketing-pricing navigator.language/Intl.DateTimeFormat timezone heuristic (unrelated to true geolocation — no navigator.geolocation or IP-geolocation API was ever used anywhere in this codebase).

Resolution implemented: a real Vercel-geo-based mechanism (middleware.ts + api/geo.js, see §4.D and §5b) now exists, with a hard architectural separation enforced between:

Visitor physically in Israel → Hebrew Local landing page (anonymous UI routing, concept A) — implemented.

Visitor outside Israel → English International landing page — implemented.

New-account legal region (business_settings.country) → resolved from a fresh, server-side geo lookup made at account-creation time, with an explicit user-choice fallback if that's unavailable — never guessed from the anonymous UI bundle — implemented.

Authenticated-account region enforcement (§3/§4.B/§5) — unweakened; the if (data) branch of fetchSettings was not touched by any of this work.

Status: implemented, committed and pushed as 9c8cb06. Any older 'pending/uncommitted' wording in §4.D/§5b is historical and superseded by §12. A new open item worth tracking going forward: AppLocal.jsx/AppGlobal.jsx still pass an inert bundleIsHebrew prop that Dashboard.jsx no longer reads (see §14) — harmless, but a minor cleanup opportunity if anyone later touches those two files for an unrelated reason.

Legacy / Dead / Risky Code

Confirmed dead/unreferenced code

src/App.jsx — confirmed via repo-wide grep that no file imports it (main.jsx only imports AppLocal/AppGlobal). It is not reachable in production. Notably, it reimplements a SmartPublicQuote-named function that decides Hebrew-vs-English purely from URLSearchParams, localStorage.getItem('proflow_lang'), and pathname.startsWith('/en') — i.e. the exact anti-pattern the rest of the codebase's Iron Rule forbids for authenticated/quote contexts, under an identically-named function to the real, safe src/components/SmartPublicQuote.jsx. It also independently declares routes for /tools, /he/tools, /en/tools, /public-quote/, etc., mirroring (imperfectly) the real routes in AppLocal.jsx/AppGlobal.jsx.

Do not delete or modify without explicit instruction — this handoff only documents its status. It is a landmine risk if ever accidentally re-imported by a future refactor; flag it early in any work that touches routing.

jspdf / html2canvas (package.json dependencies) — no import found anywhere in src/. Likely vestigial from a removed or unfinished PDF-export feature. Confirm before removing (out of scope for this document to decide).

bundleIsHebrew prop (⚠ new as of the pending §4.D work) — AppLocal.jsx/AppGlobal.jsx still pass bundleIsHebrew={true}/{false} to <Dashboard />, but Dashboard.jsx no longer destructures or reads it anywhere (confirmed — its only prior use, the new-account default fallback, was replaced by the geo/explicit-choice mechanism). React silently ignores unused props, so this is harmless but genuinely dead as of this update. Left in place deliberately (removing it would mean touching AppLocal.jsx/AppGlobal.jsx, which was out of scope for that change) — safe to clean up in a future unrelated pass.

Suspected legacy / worth re-verifying before relying on

app_settings table (exchange_rates) — written by api/cron.js, but no confirmed reader was found in src/. May be unused, or may feed a feature not covered by this session's research.

PROFLOW_ARCHITECTURE.md (repo root, pre-existing Hebrew doc) — describes the system at "v14.3" and predates this session's region-separation audit; in particular it states email language comes from a client-supplied isHebrew parameter, which is no longer accurate as of commit 2532f1b (email language/currency are now resolved server-side only — see §6). Treat that document as a historical/product-feature reference, not as authoritative for the region-separation mechanics — this handoff document supersedes it on that topic.

INVOICING_INFRASTRUCTURE.md (referenced in .env.example comments) — exists in the repo per that reference; not read in full during this session. Presumed to describe the planned (not active) Stripe/invoicing scaffolding.

Active code

Everything else referenced in §2's directory map is active, reachable code as of this baseline.

SEO Architecture — Phase 1 + Phase 2 LIVE / pushed

Phase 1 — LIVE, committed and pushed at aad3a7a

Public quote noindex (defense in depth): src/pages/PublicQuote.jsx and src/pages/PublicQuoteEn.jsx each set <meta name="robots" content="noindex, nofollow"> client-side in their existing mount useEffect. vercel.json additionally sends X-Robots-Tag: noindex, nofollow at the HTTP level for /quote/, /public-quote/, /en/public-quote/, /dashboard, and /ai-logs — the HTTP header is the primary guarantee (works even if a crawler doesn't execute JS); the meta tag is the secondary/client-side layer.

robots.txt intentionally has no Disallow rules at all — private/noindex routes are protected via X-Robots-Tag instead, specifically so crawlers are not blocked from fetching (and therefore seeing) the noindex directive. Blocking via robots.txt was tried and deliberately reverted for this exact reason during Phase 1 review.

<html lang>/<html dir> are now set at runtime, at the two central bundle-level locations: src/local/AppLocal.jsx (lang='he', dir='rtl') and src/global/AppGlobal.jsx (lang='en', dir='ltr'), each in their own mount useEffect. PublicQuote.jsx/PublicQuoteEn.jsx additionally set their own lang/dir on mount (justified exception — a quote's actual language can differ from the hosting bundle, e.g. a Local/Hebrew quote opened via /en/public-quote/:id, which PublicQuoteEn.jsx detects and hands off to PublicQuote.jsx; the nested component's mount-effect correctly fires after and overrides the parent's).

public/sitemap.xml at this baseline still included the bare unprefixed page URLs (/, /contact, /privacy, /terms, /tools) alongside the prefixed ones — this was superseded by Phase 2 (below), which is not yet committed.

Phase 2 — LIVE, committed and pushed at 71cd378

10 files modified (see §12 for the exact list). Summary of the final approved design:

Canonical consolidation through src/utils/seoMeta.js: this helper already existed pre-Phase-2 (used by Contact/Privacy/Terms/Tools) and has been extended with a hreflang array parameter (renders reciprocal <link rel="alternate" hreflang> tags via the same find-or-create DOM pattern already used for canonical/meta tags) and an updateSocial flag (default true, preserves existing Open Graph/Twitter behavior for its existing callers; explicitly false for the two landing pages so this consolidation does not start touching OG/Twitter for them — that remains out of scope until a later phase).

Root / canonical strategy — FINAL, approved (Option B): bare / is a stable, self-canonical, x-default entry point. LandingLocal.jsx/LandingGlobal.jsx compute their canonical from both a valid explicit ?lang= override and the clean pathname — never from geo/localStorage/navigator.language:

const langParam = new URLSearchParams(window.location.search).get('lang');
const explicitLang = langParam === 'he' || langParam === 'en' ? langParam : null;
// LandingLocal:
const canonicalPath = explicitLang ? '/he' : window.location.pathname === '/he' ? '/he' : '/';
// LandingGlobal:
const canonicalPath = explicitLang ? '/en' : window.location.pathname === '/en' ? '/en' : '/';

Only ?lang=he/?lang=en (the two values main.jsx itself recognizes) count as an explicit override; any other/invalid ?lang= value (e.g. ?lang=fr) is treated as absent and falls back to the clean-pathname rule. Bare / with no (valid) ?lang= always self-canonicalizes to /, regardless of which bundle (AppLocal/AppGlobal) actually rendered it for a given visitor — geo/browser/stored-preference signals may decide what renders, never what the canonical says. Real /he//en visits, and valid crossed ?lang= cases (e.g. /he?lang=en → English UI → canonical /en), still self-canonicalize to the language actually rendered.

Contact/Privacy/Terms/Tools — bare /contact//privacy//terms//tools are compatibility aliases only, FINAL: these are the same shared-route-in-both-bundles shape root / had, but unlike root they carry no x-default/homepage role, so the resolution differs from Option B: bare aliases are not kept self-canonical and are not treated as indexable pages at all.

Canonical localized pages are /he/<page> and /en/<page> only — never the bare alias. (This was already fixed in the prior Phase 2 pass and is unchanged.)

Internal navigation no longer generates bare-alias traffic: the footers in LandingLocal.jsx/LandingGlobal.jsx now navigate() directly to /he/contact//en/contact etc. (previously /contact etc.) — confirmed via a repo-wide grep that zero internal links to the bare aliases remain anywhere in src/.

Client-side compatibility redirect: Contact.jsx, Privacy.jsx, Terms.jsx, PublicTools.jsx (Hebrew), PublicToolsEn.jsx (English) each check, in their existing mount useEffect, whether window.location.pathname is exactly the bare alias (e.g. === '/contact') and if so call navigate(<resolved localized path>, { replace: true }) — using the isHebrew prop (Contact/Privacy/Terms) or the component's own fixed language (PublicTools/PublicToolsEn) that main.jsx already resolved before these components ever mounted, so no new geo/cookie/language-guessing logic was introduced. The condition only ever matches the bare path, so a direct visit to /he/contact or /en/contact never redirects (no loop possible).

HTTP X-Robots-Tag: noindex, follow added in vercel.json for exactly /contact, /privacy, /terms, /tools (new entries, alongside the existing Phase 1 noindex, nofollow rules for /quote/ etc. — those are untouched). follow (not nofollow) is used deliberately so crawlers can still traverse to/consolidate toward the localized canonical pages. robots.txt was not touched — no new Disallow rules, consistent with the existing Phase 1 rationale (crawlers must be able to fetch the response and see the noindex header).

hreflang — final: landing pages declare the 3-way cluster he→/he, en→/en, x-default→/; Contact/Privacy/Terms/Tools declare the 2-way he→/he/<page>, en→/en/<page> (no x-default for these, and the bare aliases are never an hreflang target — matches the pre-existing pattern).

public/sitemap.xml — final, 11 URLs: /, /he, /en, /he/tools, /en/tools, /he/contact, /en/contact, /he/privacy, /en/privacy, /he/terms, /en/terms. Bare / is its own <url> entry (matching its stable self-canonical status under Option B) with the same 3-way hreflang cluster as /he//en. The 4 bare aliases for Contact/Privacy/Terms/Tools are excluded from the sitemap (they are not canonical, not indexable).

index.html and robots.txt were NOT touched in Phase 2 — the static HTML's existing generic defaults and hreflang cluster (en→/en, he→/he, x-default→/) already matched the new architecture and needed no change; no SSR/SSG was introduced (deliberately ruled out as unnecessary). vercel.json was touched (see above — 4 new header entries only; every existing Phase 1 header/rewrite/cron entry is unchanged).

Known Open Items (Next Session)

A. Root / SEO canonical strategy — RESOLVED, approved (Option B)

Decision: bare / is a stable, self-canonical, x-default entry point. It always declares canonical = /, regardless of which bundle (AppLocal/AppGlobal) actually renders it for a given visitor. /he and /en remain the two fixed localized canonical pages, each self-canonical to itself.

Why, grounded in current official Google Search Central documentation:

Google explicitly names self-referential canonicals as the default best practice, and states JS should not override an original HTML canonical to a different value — the prior dynamic-per-render approach (/ → /he or /en depending on render) violated both: it made a single URL emit different canonical targets across crawls, and contradicted index.html's own static self-referential / canonical.

A hard geo-based redirect from / (an earlier candidate, "C") was rejected: Google's multi-regional/multilingual guidance explicitly says "avoid automatically redirecting users... don't redirect based on what you think the user's language may be," warning it can prevent Google from crawling all locale variants. A later refinement of that idea (a redirect gated by a new middleware-readable language-preference cookie, "C2") was evaluated in detail and rejected for the same reason — it's still the exact auto-redirect-on-guessed-language pattern Google's docs warn against, and would have needed a new cookie, new middleware.ts logic, and a dependency on the Accept-Language header that Googlebot itself doesn't send.

Google's own x-default guidance names "auto-redirecting homepages" and "language selector pages" as valid patterns, but a self-canonical, locale-adaptive homepage that never redirects (Option B) avoids the documented auto-redirect risk entirely while still satisfying x-default's purpose.

Final canonical logic (implemented in LandingLocal.jsx/LandingGlobal.jsx, see §15 for the exact code and the full verified 12-case matrix, including the 3 invalid-?lang= cases): canonical is derived from a valid explicit ?lang=he/?lang=en override first, then the clean pathname — never from geo/localStorage/navigator.language, and never from an unrecognized ?lang= value.

Contact/Privacy/Terms/Tools resolved separately, NOT via Option B: these four families had the identical bare-route-in-both-bundles shape root / did, but — unlike root — carry no x-default/homepage role, so they were resolved as compatibility aliases instead (client-side replace redirect to /he/<page>//en/<page> + HTTP X-Robots-Tag: noindex, follow, internal navigation updated to stop generating bare-alias traffic). See §15 for the full final design. This item is now fully resolved, not just root.

B. Local currency header leakage — quote table column header (OPEN, not yet audited)

Observed (reported by the project owner, not yet independently verified in code):

For a Local/Israeli test account, quote-history rows correctly display ₪ amounts, but the Hebrew "הסכום" (Amount) column header visibly shows a green $ icon/symbol.

The Super Admin view shows a different, not-yet-identified green symbol in the equivalent header position.

Iron Rule implication: a Local account's UI must never expose a foreign-currency indicator anywhere, including incidentally via a hardcoded icon — this would be a (likely cosmetic/icon-level, not data-level) violation of the same Local/International separation principle enforced everywhere else in this codebase.

Next session must audit before changing anything:

Search for DollarSign, Banknote, or a literal $ character used as an icon/decoration (as opposed to actual currency-symbol formatting) in src/components/QuotesTab.jsx and any other quote-table render path (Dashboard.jsx's own quote-list rendering, AdminUsersTab.jsx's admin-facing quote/revenue tables if applicable).

Determine whether this is a hardcoded decorative icon (e.g. a lucide-react DollarSign used as a generic "money" glyph in the column header, never swapped per-region) versus an actual currency-formatting bug that could indicate a deeper data issue.

Fix only after confirming root cause — do not guess.

Security Remediation — Quote Immutability & business_settings Privilege Hardening (CLOSED)

A multi-stage security remediation was completed this session, covering two previously-open issues: approved/paid/signed quote immutability (a regressed business rule), and business_settings privilege-escalation surfaces (role, plan, trial_ends_at). Both are now CLOSED — see the closed-scope list at the end of this section, and the follow-ups after it for what is deliberately not included.

17.A Quote immutability — CLOSED

Restores and hardens a rule that had silently regressed and been re-fixed across prior commits (9f37c95 → 38be268 → 3f6cd27, found via git log -S pickaxe search during this remediation).

Rule: once a quote's status is approved/paid (case-insensitive) or it has a non-empty signature, it is fully immutable — no edit, no delete, no mutation of its quote_items/quote_attachments — identically in the Local/Hebrew and International/English bundles.

Layer

Protection

Location

Single source of truth

isQuoteImmutable(quote) helper

src/utils/quoteLock.js

UI

Edit/Delete: native disabled={isLocked} + defensive if (isLocked) return inside onClick, tooltip owned by a wrapper <span title=...> around the button rather than the button itself (native disabled buttons don't reliably deliver hover events), sized to cover the full row so the tooltip hit area matches the visible locked row; exact HE/EN tooltip strings; button labels unchanged

src/components/QuotesTab.jsx

App handler guards

handleEditClick, the quote-save path, requestDeleteQuote, executeDeleteQuote all call isQuoteImmutable(...) before any Supabase write

src/pages/Dashboard.jsx

DB — UPDATE

guard_quote_immutability() / trigger guard_quote_immutability_update (BEFORE UPDATE on quotes) — allows the legitimate pending→approved/paid transition (incl. public approval, since both PublicQuote.jsx/PublicQuoteEn.jsx write status+signature in one combined UPDATE); once already immutable, only 5 named bookkeeping fields may still change (view_count non-decreasing/non-NULL, expiration_reminder_sent one-way false→true, email_bounced/email_bounce_reason/email_bounced_at bidirectional — a resend can legitimately clear a prior bounce); anything else raises 42501

Live in Supabase (no in-repo migration file — see §9's existing no-migrations caveat)

DB — DELETE

guard_quote_immutability_delete() / trigger guard_quote_immutability_delete_trigger (BEFORE DELETE on quotes) — blocks deleting an immutable quote; only bypass is auth.role() = 'service_role', required for the admin-delete-user account-deletion cascade

Live in Supabase

DB — children

guard_quote_child_immutability() / triggers guard_quote_items_immutability, guard_quote_attachments_immutability (BEFORE INSERT OR UPDATE OR DELETE on quote_items/quote_attachments) — checks both the OLD and NEW quote_id's parent-quote immutability, so a row cannot be moved into or out of a locked quote; service_role bypass narrowed to DELETE only (the admin-delete-user cascade) — even service_role cannot INSERT/UPDATE child rows on a locked quote

Live in Supabase

Regression tests

src/utils/quoteLock.test.js (11 cases: pending/draft→false, approved/paid incl. case variations→true, signature-with-unrelated-status→true, empty/null→false), src/components/QuotesTab.test.jsx (locked/unlocked UI state × HE/EN, exact tooltip text, click-on-locked-button never reaches the handler) — Vitest + Testing Library, newly added to this repo (package.json, vite.config.js, src/test/setup.js; no test framework previously existed)

npm run test — 21/21 passing at close

Committed & pushed: 7e96b83 "Restore approved/signed quote immutability (UI lock + handler guards + tests)", 5737626 "Fix locked quote tooltip hit area".

Full TEST-only functional matrix (19 scenarios — pending-quote CRUD both languages, locked-quote UI/tooltip both languages, paid/signed-with-other-status locking, direct authenticated UPDATE/DELETE attack on an approved TEST quote, quote_items/quote_attachments mutation blocking, moving a child into/out of a locked quote, public approval succeeding both languages, view_count/email_bounced/expiration_reminder_sent bookkeeping still working, admin-delete-user cascade still succeeding) was executed against TEST accounts/quotes only. Real Lifetime production data was read-only verified (Edit/Delete render disabled, status/signature/currency inspected) and never mutated.

17.B business_settings — role privilege escalation — CLOSED

Finding: business_settings.role is the sole source of super_admin authority everywhere in the app (Dashboard.jsx, AILogs.jsx, admin-delete-user), and had no protection beyond ownership RLS — an ordinary authenticated user could potentially set their own role to 'super_admin' via a raw UPDATE or INSERT, which every downstream admin check would then trust.

Closed by:

authenticated no longer has UPDATE privilege on the role column (confirmed via live GRANT inspection).

The pre-existing RESTRICTIVE INSERT policy "Restrict business_settings insert to role=user" (WITH CHECK (role = 'user')) blocks any INSERT attempting a non-'user' role.

Live-tested: a fresh authenticated attack inserting role='super_admin' was rejected with PostgreSQL 42501; no row was created.

17.C business_settings — plan/trial_ends_at UPDATE escalation — CLOSED

Finding: an ordinary authenticated owner's standard ownership RLS UPDATE policy permitted freely rewriting their own plan/trial_ends_at (self-upgrade to a paid plan, self-grant unlimited/Lifetime trial) — no trigger previously existed on business_settings.

Closed by: guard_business_settings_plan_trial() / trigger guard_business_settings_plan_trial_update (BEFORE UPDATE on business_settings):

If neither plan nor trial_ends_at changes, the update passes through untouched (covers ordinary Settings saves and login bookkeeping — neither writes those columns).

An ordinary owner may perform only the exact legitimate self-cancellation transition: plan='free' AND trial_ends_at IS NULL.

A caller whose own business_settings.role = 'super_admin' may change plan/trial_ends_at on any account without restriction (covers Super Admin plan change, trial extension, and Lifetime grant/revoke — the latter, handleToggleLifetime in Dashboard.jsx, only ever touches trial_ends_at, never plan).

No service_role bypass — the writer inventory confirmed no service_role/cron process currently touches either column (the two reminder-email edge functions only ever write their own reminder_sent bookkeeping flags, despite their email copy — see follow-ups below).

Live-tested with a disposable TEST account (tahshitishi@gmail.com, left restored to plan: free, trial_ends_at: null, role: user after testing): ordinary-user plan-upgrade attempt rejected 42501; arbitrary trial extension rejected 42501; legitimate self-cancellation to free/null succeeded; Super Admin (shlomisiny@gmail.com, role: super_admin) plan change and trial change on the TEST account succeeded; after Super Admin set plan=pro, the TEST user's own attempt to change its own plan was rejected, with plan/trial_ends_at/role unchanged.

17.D business_settings — structural hardening — CLOSED

UNIQUE (user_id) added — live-confirmed zero duplicate user_id rows existed before installation.

user_id changed to NOT NULL — live-confirmed zero NULL rows existed before installation. Needed because a bare UNIQUE constraint does not by itself prevent multiple NULL-user_id rows in standard SQL; NOT NULL closes that residual gap, making every "one row per user" lookup in the app — including the §17.C trigger's own caller-role lookup — structurally guaranteed rather than merely conventionally true.

17.E business_settings — plan/trial_ends_at INSERT escalation — CLOSED

Finding: createNewBusinessSettings() (src/pages/Dashboard.jsx — still the sole in-repo INSERT path, unchanged) always inserts plan:'pro', trial_ends_at: now+14d at signup; no legitimate flow ever inserts plan:'free'/trial_ends_at. But authenticated has column-level INSERT privilege on plan/trial_ends_at/role, so a raw REST INSERT bypassing the app's JS could previously set any plan/trial_ends_at value on a brand-new row.

Closed by: new RESTRICTIVE INSERT policy "Restrict business_settings insert to safe free or legitimate trial", ANDed automatically (RESTRICTIVE policies always AND) with the pre-existing role='user' restrictive policy and the ownership policy:

(plan = 'free' AND trial_ends_at IS NULL)
OR (plan = 'pro' AND trial_ends_at within ±2 hours of now() + 14 days)

Live-tested with a second disposable TEST account: duplicate business_settings INSERT for an existing user rejected (unique-violation, §17.D); fresh-user INSERT with role='super_admin' rejected 42501; fresh-user INSERT with a Pro plan and a +365-day trial rejected 42501; a legitimate Pro +14-day trial INSERT succeeded with the expected resulting row state.

17.F TEST cleanup — confirmed

Two disposable TEST accounts were used across this remediation, never any real/production/Lifetime account:

tahshitishi@gmail.com — used for the UPDATE-path (plan/trial) tests; restored to a clean plan: free / trial_ends_at: null / role: user state and left in place at the close of this §17 remediation. (⚠ Stale as a claim about the account's CURRENT state — this disposable TEST account has since been reused for later, separately-authorized regression testing, e.g. the Admin UI's Trial Extension feature and the §18.M UPDATE-policy hardening verification. Its live-verified state as of the §18.M update is plan: free, trial_ends_at: 2026-09-04 01:09:59.816+00 — NOT null. This is expected, authorized disposable-TEST-account churn, not a real customer subscription/payment state, and not evidence of any bug — do not reinterpret it as such. Its exact state may change again during future authorized regression testing; re-verify live before relying on any specific value.)

proflow.security.test2@gmail.com — used for the INSERT-path (duplicate row / role-injection / trial-length) tests; completely removed afterward — final SQL verification returned no residue in either auth.users or business_settings.

Temporary local test scripts and temporary credential environment variables were removed after use; git status --short was clean at each cleanup checkpoint.

Closed scope (this remediation)

Quote immutability (UI + handler + DB, both languages).

business_settings.role self-escalation.

business_settings.plan/trial_ends_at UPDATE self-escalation.

business_settings.plan/trial_ends_at INSERT self-escalation.

business_settings duplicate/NULL user_id rows.

Follow-ups (not started — tracked here for the next session, do not fold into unrelated work)

Admin UI was the next major work area at the time this paragraph was written; a first redesign/security pass has since happened — see §18.M (Super Admin RLS/authority) and §19.A (Admin UI current implemented state) for the verified current state. Some of the reconciliation this paragraph called for has happened as part of that work; re-verify against the live schema again before further Admin/billing work.

subscription_* column assumptions need review. send-subscription-expiration-email (Edge Function) references subscription_ends_at/subscription_reminder_3d_sent/subscription_reminder_24h_sent columns sourced from §9's non-authoritative "observed columns" list — these may not actually exist in the live schema, which would mean that feature is silently broken in production. This remains open and untouched — NOT resolved. (AdminUsersTab.jsx's former handleSetSubscriptionEndDate function and its subscription_ends_at date-picker / "Paid - Active" UI, which previously also referenced this column, were removed entirely during the Admin UI redesign — see §19.A's dead-code list — but that removal is a frontend cleanup only and does not verify or resolve whether the column exists live; the Edge Function side still needs that verification before any subscription/billing work.)

Reminder-email copy vs. actual behavior. send-trial-expiration-email and send-subscription-expiration-email both send copy stating the account "moves automatically to the Free plan" after expiry, but neither function — nor anything else found in this codebase — actually writes plan/trial_ends_at; they only update their own reminder_sent bookkeeping flags. There is currently no automatic downgrade mechanism at all. Review during Admin/Billing work — either implement the described downgrade or correct the email copy.

Stripe billing remains a stub (billing-checkout-stub/index.ts, no real Stripe call). Any future billing writer that inserts/updates business_settings.plan/trial_ends_at must satisfy the RESTRICTIVE INSERT policy (§17.E) and the UPDATE trigger (§17.C) — most naturally by running through the account's own legitimate transition or a super_admin-equivalent path, not by bypassing them.

Final verification performed

Every factual claim in this document was checked against the actual current repository content (direct file reads and targeted greps), not recalled from earlier conversation summaries.

No secret values are present anywhere in this document — only environment variable names.

The Local/International Iron Rule is documented prominently in §3 and cross-referenced from §4/§5.

Historical checkpoint note: at the checkpoint documented by the original handoff author, no application, configuration, database, or Supabase function file was modified; only PROFLOW_HANDOFF.md was edited in that repository pass. The present collaboration-workflow update was prepared from the supplied HANDOFF copy and must be verified against the current repository before it is adopted as the repository version.

This is a checkpoint update (session-limit driven): it corrects the baseline from the now-committed 2532f1b/9c8cb06 state to the current pushed aad3a7a, and records the SEO Phase 2 work (§15) that exists only in the working tree, plus two open items for the next session (§16: the root / canonical-strategy investigation, and the local-currency-header-leakage UI bug). No SEO Phase 2 code

Public Quote Security Remediation — CURRENT / VERIFIED (Phases 1–4 + Cutover A/B/C/D1)

Status at this HANDOFF update

Public Quote remediation is functionally complete through the DB/RLS/GRANT public-access cutover and Storage INSERT hardening. The remaining Storage-private cutover (D2) is intentionally blocked until authenticated Dashboard attachment handling is made private-bucket compatible.

CORRECTED (was previously stale): the Phase 3/4 application/config changes described below (SmartPublicQuote.jsx, PublicQuote.jsx/PublicQuoteEn.jsx, AppGlobal.jsx, supabase/config.toml, get-public-quote/index.ts) ARE committed and pushed — commit 1caaff6f47d911d8114c8eaedd1c3a20ec73c2fd, tag public-quote-security-2026-08-25, both confirmed live as ancestors of origin/main. The live Supabase DB/Storage changes described below were already applied and verified independently of that commit, consistent with this document's no-in-repo-migrations convention.

18.A Phase 1 — durable attachment storage_path — COMPLETE

Live schema change:
public.quote_attachments.storage_path text NULL

The then-existing 3/3 attachment rows were backfilled from the legacy public file_url path using the validated quote-files URL extraction rule. file_url values were not rewritten/deleted.

Post-change verification at execution time:

total attachments: 3

storage_path non-null: 3

storage_path null: 0

all extracted paths matched the real application path shape.

The real path convention was later confirmed from application upload code:
<user_id>/<quote_id>_<timestamp>.<ext>

18.B Phase 2 — public SECURITY DEFINER RPCs — COMPLETE + VERIFIED

public.public_increment_quote_view(uuid)

SECURITY DEFINER

owner: postgres

search_path: public, pg_temp

PUBLIC EXECUTE revoked

EXECUTE granted to anon, authenticated

one atomic UPDATE; owner views are server-side no-ops, anon/different authenticated users increment.

Live tests passed for anon, owner, different authenticated TEST user.

public.public_approve_quote(uuid,text)

SECURITY DEFINER

owner: postgres

search_path: public, pg_temp

PUBLIC EXECUTE revoked

EXECUTE granted to anon, authenticated

validates quote id and signature data URL, including PNG/base64 format and payload-size cap.

approval is one atomic conditional UPDATE requiring existing status draft/sent and empty signature.

re-approval/signature overwrite, paid/nonexistent/non-approvable states return the same generic rejection behavior.

Existing quote immutability trigger remains an independent lower-layer guard.

18.C Phase 3 — get-public-quote Edge Function — COMPLETE + VERIFIED

New live/deployed file:
supabase/functions/get-public-quote/index.ts

supabase/config.toml:
[functions.get-public-quote]
enabled = true
verify_jwt = false
entrypoint = "./functions/get-public-quote/index.ts"

verify_jwt=false is intentional: the endpoint is publicly readable by design. The Supabase gateway must not reject a public quote because an optional Authorization token is absent/invalid; optional owner detection is handled inside the function.

Security boundary:

accepts quote_id only;

validates UUID;

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required and fail closed if absent;

service-role secret is never returned/logged;

SUPABASE_ANON_KEY is best-effort only for optional auth.getUser() owner detection;

explicit DB select allowlists and minimized DTO;

raw quote.user_id not returned; only computed quote.is_owner_viewing;

no plan/role/trial/account-state fields returned;

live legacy emailjs_service_id/emailjs_template_id/emailjs_public_key are not selected or returned;

storage bucket name is hardcoded quote-files;

attachment storage_path is not caller supplied and is validated before signing:
first folder segment must equal the trusted quote.user_id and filename prefix must match the trusted quote id;

invalid/malformed/null storage paths are skipped, never signed;

raw storage_path and legacy file_url are never returned publicly;

signed attachment URLs expire after 300 seconds.

Verified public DTO:
top-level: quote, business, client, items, attachments

quote:
id, created_at, valid_until, tax_rate, subtotal, total, discount, terms, notes, subject, status, signature, currency, is_owner_viewing

business:
business_name, logo_url, tax_id, email, phone, address, currency

client:
company_name, email, phone, address

items[]:
description, quantity, price, total_price
(note: DTO.price is sourced from the live DB column quote_items.unit_price; live DB has no quote_items.price)

attachments[]:
file_name, url

Live-schema corrections discovered during Phase 3:

quote_items.price does NOT exist;

quotes.vat does NOT exist;

quotes.client_name does NOT exist.
The Edge Function was corrected to the real live schema before Phase 3 was marked PASS.

Optional-auth matrix live-verified:

no Authorization → 200, is_owner_viewing=false

anonymous/publishable context → 200, false

valid owner TEST JWT → 200, true

valid different TEST user JWT → 200, false

invalid/garbage JWT → 200, false

18.D Phase 4 — public frontend cutover — COMPLETE + BROWSER VERIFIED

Changed working-tree files:

src/components/SmartPublicQuote.jsx

src/pages/PublicQuote.jsx

src/pages/PublicQuoteEn.jsx

src/global/AppGlobal.jsx

AppLocal.jsx correctly required no change: /public-quote/ and /quote/ already routed to SmartPublicQuote. The only routing bypass was AppGlobal.jsx's /en/public-quote/ → PublicQuoteEn direct route; Phase 4 changed that route to SmartPublicQuote.

Current flow:
all public quote routes
→ SmartPublicQuote
→ one get-public-quote invoke
→ one public_increment_quote_view RPC after successful load
→ route HE/EN from quote.tax_rate/currency
→ render PublicQuote/PublicQuoteEn with quoteData DTO.

PublicQuote/PublicQuoteEn:

no direct .from('quotes'/'clients'/'quote_items'/'quote_attachments'/'business_settings') access remains;

approval only via public_approve_quote RPC;

owner UI uses quote.is_owner_viewing;

attachments use signed att.url only;

no raw file_url/storage_path/getPublicUrl in public quote flow;

Hebrew VAT behavior remains subtotal * tax_rate; no nonexistent quote.vat;

client name uses linked client.company_name; no nonexistent quote.client_name.

React 18 StrictMode issue found by real browser testing and fixed before verification:
the first implementation combined processedIdRef with a per-effect cancelled closure, causing the single successful get-public-quote response to be discarded during the dev StrictMode setup/cleanup/setup stress test, leaving Loading forever. The corrected implementation removes that cancelled flag and uses processedIdRef itself as the stale-response guard (processedIdRef.current !== id), preserving single-call semantics and safe id-change races.

Browser verification performed on localhost against the live Supabase backend:

Hebrew Local quote renders correctly;

International quote renders English/LTR with correct currency;

/en/public-quote/ with a Local quote still renders Hebrew based on quote data;

anonymous visitor sees client signature UI;

authenticated owner is detected and sees owner/admin preview instead of signing UI;

Network shows exactly one get-public-quote (200) and one public_increment_quote_view (204) per intended load, including the /en route;

signed attachment link opens successfully.
Build/lint/tests after implementation/fix:

npm run build: PASS

npm run lint: 0 errors (only pre-existing warnings in unrelated files)

npm run test: 21/21 PASS.

18.E Stage A — four-table RLS cutover — COMPLETE + LIVE VERIFIED

Tables:
public.clients
public.quotes
public.quote_items
public.quote_attachments

Dangerous/redundant public and auth.role()='authenticated' policies were removed.

Final live RLS target:

clients: "Owners can manage clients" — ALL, auth.uid() = user_id

quotes: "Owners can manage quotes" — ALL, auth.uid() = user_id

quote_items: "Owners can manage quote items" — parent quote ownership via quotes.user_id = auth.uid()

quote_attachments: "Owners can manage quote attachments" — TO authenticated, parent quote ownership via quotes.user_id = auth.uid()

Zero remaining USING(true)/WITH CHECK(true) policies on these four tables.
Zero remaining auth.role()='authenticated' shortcut policies.

Live smoke tests passed:

anon direct table access denied by RLS at Stage A;

authenticated owner access to own data works;

cross-user TEST access returns no rows;

get-public-quote and both Phase 2 RPCs remain functional;

quote immutability triggers remain enabled and unchanged.

18.F Stage B — table privilege cutover — COMPLETE + LIVE VERIFIED

For clients/quotes/quote_items/quote_attachments:

anon:
ZERO table privileges.

authenticated:
exactly SELECT, INSERT, UPDATE, DELETE.

authenticated no longer has TRUNCATE, TRIGGER, REFERENCES.

postgres/service_role grants were not changed.

After Stage B, anon direct SELECT/UPDATE fails at the privilege level (42501), not merely through RLS. Authenticated owner CRUD and cross-user isolation remained correct. get-public-quote and the Phase 2 RPCs continued to pass regression tests.

18.G Stage C — business_settings public-read closure — COMPLETE + LIVE VERIFIED

Before Stage C live baseline:

anon: SELECT only

authenticated: SELECT only

8 RLS policies total.

Stage C:

dropped "Public can view business settings";

dropped "Public can view business settings for public quotes";

revoked SELECT on public.business_settings from anon.

Final verified state:

anon: ZERO table grants on business_settings;

authenticated: SELECT remains;

six non-public/account-state policies remain unchanged, including ownership, the two RESTRICTIVE signup policies, Super Admin UPDATE policy, and current application-dependency insert/update policies. (This was the count at this Stage C baseline. A 7th policy — a Super Admin SELECT policy — was added afterward, in a separate later work item; see §18.M for the current full 7-policy state and its verification. Do not treat "six" as the current count.)

authenticated TEST owner can read their own row;

anon direct SELECT returns permission denied;

get-public-quote still returns the approved public business DTO.

18.H Stage D1 — quote-files anonymous upload closure — COMPLETE + LIVE VERIFIED

Bucket remains:
quote-files public=true

The public SELECT policy remains unchanged:
"Public Access to Quote Files" — SELECT, PUBLIC, bucket_id='quote-files'

The old misleading/unrestricted INSERT policy was replaced with:

"Authenticated owners upload quote files"
FOR INSERT
TO authenticated
WITH CHECK (
bucket_id='quote-files'
AND (storage.foldername(name))[1] = auth.uid()::text
)

The parentheses around storage.foldername(name) are required by the SQL execution path used during this cutover; the first unparenthesized attempt failed with SQLSTATE 42601 before any mutation and was safely retried after confirming zero drift.

Live D1 tests:

anonymous upload denied 403/RLS;

authenticated TEST-owner upload under <auth.uid()>/<quote_id>_<timestamp>.<ext> succeeded;

raw public read still works (expected because D2 not done);

get-public-quote signed URL still works.

18.I OPEN — Stage D2 private-bucket compatibility blocker

DO NOT make quote-files private yet.

Current Dashboard/QuoteForm owner attachment flows still depend on legacy public URLs:

Dashboard upload calls getPublicUrl(filePath) and stores file_url;

owner list/edit/open paths consume stored file_url;

QuoteForm renders file.file_url;

current Dashboard has no createSignedUrl usage for owner attachment reads.

If quote-files is changed to private now, legitimate owner attachment viewing breaks.

Required intermediate phase before D2:

audit current Dashboard/QuoteForm attachment upload/list/edit/open/delete flows fresh;

migrate authenticated owner reads to storage_path + signed/private-compatible URLs;

verify old and new attachment rows;

add minimum owner-scoped Storage SELECT/DELETE/UPDATE policies only where actually required;

browser-test owner upload/open/delete;

only then reconsider public=false and removal of "Public Access to Quote Files".

18.J OPEN — Storage DELETE/UPDATE policy gap discovered during D1

There is currently no owner DELETE (or UPDATE) policy on storage.objects for quote-files.

Evidence: the authenticated TEST user successfully uploaded a D1 disposable object but could not delete that same object through the proper Storage API (403 Access denied).

Do not "fix" this ad hoc. It belongs in the D2/intermediate attachment-compatibility audit so the exact Dashboard product requirements can determine whether DELETE and/or UPDATE are needed and how ownership should be enforced.

Disposable TEST object left intentionally because proper API cleanup was not authorized/possible:

quote-files/67ef489f-8d54-490b-a1b7-a52c905b6ad0/a1c8f5f8-6311-4076-a9d5-2fd2821073f5_1787621897465.txt

Contents: only a harmless disposable test marker string. Clean it up later through a proper authorized Storage path; do not raw-delete only the storage.objects catalog row.

18.K Current cutover completion status

COMPLETE + VERIFIED:

Phase 1 storage_path

Phase 2 SECURITY DEFINER RPCs

Phase 3 get-public-quote

Phase 4 frontend cutover

Stage A RLS ownership cutover

Stage B four-table GRANT cutover

Stage C business_settings anonymous-read closure

Stage D1 Storage anonymous-upload closure

NOT STARTED / BLOCKED:

Stage D2 quote-files private bucket — blocked on owner attachment compatibility

owner Storage DELETE/UPDATE policy design — fold into the D2 prerequisite audit

Public Quote security should NOT be described as fully private-storage complete until D2 is explicitly implemented and verified. The principal direct-table/public-write exposures addressed by A/B/C/D1 are closed.

18.L Required checkpoint after this milestone

Before starting unrelated Admin/Billing/Payment work:

update this HANDOFF to the verified state (this section);

review git status/diff carefully;

obtain explicit owner approval;

commit/push the current verified application/config changes;

create and push a consistent Git tag for this security milestone.

Do not include unfinished D2 work in that checkpoint.

18.M Super Admin business_settings RLS/authority — CURRENT / VERIFIED (live in Supabase now; database-only, no in-repo migration file, not represented by any Git commit — consistent with this document's existing no-migrations convention)

Built after 18.A–18.L, in response to a real regression the owner found while browser-testing the Admin UI: once Stage C (18.G) correctly closed anonymous SELECT on business_settings, the Admin panel's own authenticated Super Admin session could no longer see any account other than its own. Root-caused: the pre-Stage-C "Super Admin sees everyone" behavior had never been a genuine Super Admin RLS policy — it was an accidental side effect of the two anonymous-readable USING(true) policies Stage C correctly removed. There had never been a real "Super Admin can read all rows" policy until this item.

public.is_super_admin() — SECURITY DEFINER helper, live-verified:

no arguments; returns boolean

SECURITY DEFINER; owner postgres

STABLE

SET search_path = public, pg_temp

EXECUTE: authenticated granted; anon revoked; PUBLIC revoked; service_role retains its normal platform-level privilege

Verified directly against the live pg_proc.proacl catalog column (information_schema alone was found unreliable for this check mid-implementation, due to a Supabase project-level default-privileges rule that grants EXECUTE on new public-schema functions directly to anon/authenticated/service_role, independent of any REVOKE ... FROM PUBLIC): {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres} — no anon, no bare PUBLIC.

business_settings SELECT policy, live-verified:

"Super admins can view all business settings"
FOR SELECT TO authenticated
USING (public.is_super_admin())

Verified live visibility (read-only BEGIN/SET LOCAL ROLE/ROLLBACK simulations — no persisted changes made for this verification):

ordinary authenticated TEST user (tahshitishi@gmail.com): sees exactly 1 row (own only).

Super Admin (real account): sees all 6 business_settings rows.

anon: SELECT denied — permission denied for table business_settings (PostgreSQL 42501), i.e. denied at the table-privilege level (anon has zero table grants on business_settings, per 18.G), not merely by RLS.

42P17 recursion incident — documented in full, not omitted:

The first attempted Super Admin SELECT policy used a direct self-referential subquery against business_settings itself — EXISTS (SELECT 1 FROM business_settings WHERE user_id=auth.uid() AND role='super_admin') — to decide SELECT visibility on business_settings. Because that policy needed to resolve its own table's SELECT-visibility via itself, it caused PostgreSQL error 42P17 (infinite recursion) for every authenticated SELECT on business_settings — a real, live production regression affecting every real user's dashboard load, not only the Admin panel. It was caught immediately via the mandated post-execution verification step (not left running) and rolled back within the same session: DROP POLICY IF EXISTS "Super admins can view all business settings" ON public.business_settings;. Authenticated SELECT was confirmed fully restored afterward. No data corruption occurred — the incident was RLS-policy-only; no rows were read, written, or lost at any point.

The subsequent redesign replaced the self-referential subquery with the non-recursive public.is_super_admin() SECURITY DEFINER helper documented above. This works because a SECURITY DEFINER function executes with its owner's privileges (postgres, the table owner, with no FORCE ROW LEVEL SECURITY set on business_settings) — which bypasses business_settings' own RLS for the helper's internal lookup, breaking the recursion by construction rather than by coincidence. The helper and the final SELECT policy were each implemented and live-verified as separate, explicitly-authorized stages before being combined into the policy above.

UPDATE policy hardening — COMPLETED / HARDENED (was previously an OPEN follow-up; migrated in a separate, later, explicitly-authorized stage on top of the SELECT-policy work above):

"Super admins can update all business settings" previously used the same class of self-referential EXISTS subquery pattern as the original (failed) SELECT-policy attempt:

EXISTS (SELECT 1 FROM business_settings business_settings_1 WHERE business_settings_1.user_id = auth.uid() AND business_settings_1.role = 'super_admin')

This was re-verified live before the migration and confirmed NOT to recurse in that form — UPDATE policies do not face the same SELECT-resolves-itself dependency that caused 42P17 for the SELECT case above, so it was never broken. It was nonetheless flagged as structurally fragile (a hidden coupling to whichever SELECT-permissive policies happen to exist on business_settings at any given time), and has now been migrated to remove that fragility. Current live definition:

"Super admins can update all business settings"
FOR UPDATE TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin())

Do not describe this policy as still using the old self-referential EXISTS subquery — that pattern is no longer live. public.is_super_admin() is byte-for-byte the same predicate (confirmed via pg_get_functiondef against the live function body before migrating), wrapped in the SECURITY DEFINER helper from above, so the row-level semantics are unchanged — only the recursion-fragility is removed, by construction (the helper bypasses business_settings' own RLS for its internal lookup rather than depending on whatever SELECT-permissive policies happen to be live).

Migration verification, all live-tested this stage (BEGIN/SET LOCAL ROLE/ROLLBACK — no data persisted, nothing committed):

no 42P17 occurred, before or after the migration;

ordinary TEST user's own-row UPDATE still succeeds (1 row affected, no-op business_name write);

ordinary TEST user's cross-user UPDATE attempt remains denied (0 rows affected);

Super Admin's cross-user UPDATE succeeds (1 row affected, no-op trial_ends_at write on a different TEST user's row);

WITH CHECK was proven against a real value change, not just a no-op: Super Admin session updated a TEST user's trial_ends_at by +1 minute inside the same transaction, the change was confirmed to have taken effect (before/after values captured), and the transaction was then rolled back;

post-rollback, the TEST user's trial_ends_at read back to its exact pre-test value — confirming nothing was committed;

SELECT visibility (ordinary=1 row, Super Admin=6 rows, anon=denied), the helper function's ACL, all other business_settings policies, all column-level grants, and the guard_business_settings_plan_trial trigger were all re-verified byte-identical before and after — this migration touched exactly the one UPDATE policy and nothing else;

a get-public-quote smoke call against a known TEST quote returned 200 (expected — that function uses service_role and never depends on this policy).

business_settings policy count — current verified total: 7 (was 6 at the Stage C baseline described in §18.G, before the SELECT policy was added; the UPDATE policy hardening above replaced an existing policy in place and did not change the count):

"Owners can manage business settings" (ALL, ownership — pre-existing)

"Restrict business_settings insert to role=user" (§17.B)

"Restrict business_settings insert to safe free or legitimate trial" (§17.E)

"Super admins can update all business settings" (hardened to public.is_super_admin() — see above; no longer the old self-referential subquery)

"Super admins can view all business settings" (added in this §18.M work item)

"Users can insert own settings" (ownership — pre-existing)

"Users can update own settings" (ownership — pre-existing)

New OPEN item surfaced during the UPDATE-policy hardening audit — Account-State column-write surface (NOT fixed, NOT in scope of the RLS-predicate migration above, tracked here for a future, separately-scoped task):

The RLS predicate migration above changes only which caller/row combinations are authorized to attempt an UPDATE — it says nothing about which columns may be written once authorized. Separately, authenticated's column-level UPDATE grants on business_settings were inspected and found to include: address, business_name, country, currency, default_terms, email, last_sign_in, logo_url, phone, plan, tax_id, trial_ends_at, user_id. role is confirmed NOT in this list (consistent with §17.B — role remains non-updatable by authenticated at the grant level, independent of any RLS policy).

The existing guard_business_settings_plan_trial trigger (§17.C) inspects and restricts only plan and trial_ends_at changes. It provides no equivalent DB-level protection for the other writable columns — notably country (backs the Local/International Iron Rule, §3), email, and business_name. Today, an owner can freely change these on their own row (via "Users can update own settings"), and a Super Admin can freely change these on any row (via the now-hardened UPDATE policy above), with no trigger-level guard — enforcement for these fields exists only at the application layer (Dashboard.jsx), not the database layer.

This is identical regardless of whether the UPDATE policy's predicate is the old self-referential subquery or public.is_super_admin() — the migration above neither introduces nor fixes this gap; it is orthogonal to it. Do NOT mark this fixed. It remains OPEN, tracked as a future, separately-scoped Account-State hardening topic — do not implement a fix without a new, explicitly authorized task.

Status: LIVE in the backend now, fully independent of the frontend Admin UI redesign described in §19.A — the backend objects above do not depend on that frontend work, and the frontend work does not depend on any further backend change. Do not describe this backend item as "pending" — it is live and verified; its only distinguishing property is (per this document's no-in-repo-migrations convention) having no Git artifact of its own. (Note: the frontend Admin UI/Trial Extension work in §19.A is itself now committed and pushed — see the Git / Release State section — this note previously described it as uncommitted; that status is superseded.)

18.N API-key exposure incident — OPEN / SECURITY PRIORITY (discovered during Stage D1.1 preparation; remediation IN PROGRESS — 5 of 7 Edge Functions migrated and verified as of this update; do not describe as resolved)

What happened, verified facts only: while preparing Stage D1.1 (Storage owner DELETE policy work), the command npx supabase projects api-keys --output json was run to check whether a service-role credential could be safely obtained for testing. That command unexpectedly printed the project's full legacy API-key values directly into the working conversation, without requiring the CLI's own --reveal flag. Both the legacy anon key and the legacy service_role key were printed in full.

Severity distinction: the legacy anon key is designed for public/client use (already bundled into every browser session by design, protected by RLS, not secrecy) and is not equivalent in sensitivity to service_role. The legacy service_role key bypasses RLS entirely and grants full database/storage access — it must be treated as COMPROMISED.

The exposed value itself is not reproduced here, in source, in logs, in commands, or in any report, and must never be — this document records only that the exposure occurred and which key type was affected.

Immediate response, verified: Stage D1.1 was suspended immediately upon detection. No CREATE POLICY was executed as part of that stage. No Storage API operation (upload/delete) was executed. The disposable D1 TEST object (quote-files/67ef489f-8d54-490b-a1b7-a52c905b6ad0/a1c8f5f8-6311-4076-a9d5-2fd2821073f5_1787621897465.txt) remains untouched, exactly as it was before the incident. No further use of the exposed service_role value occurred after detection — confirmed via a fresh, secret-safe read-only audit immediately following (git status/policy/bucket/object state all re-verified unchanged).

A separate read-only audit also found (unrelated to the incident itself, discovered while investigating remediation options) that a .env file was committed to this repository's history at commit 6f72ea8 ("fresh-start") and later deleted at commit 54bf766 — both confirmed ancestors of origin/main, so that historical content is permanently recoverable from GitHub history. Inspected safely (key names and value lengths only, values never displayed): that historical file contained only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY — both client-safe-by-design values, not secrets. No SUPABASE_SERVICE_ROLE_KEY or any other secret was ever found in tracked history. This is a separate, low-severity historical-hygiene note, not part of the service_role compromise.

Remediation design — verified READ-ONLY, then implemented incrementally, one dependency at a time:

A modern sb_secret_* key already exists for this project (provisioned) — confirmed via safe metadata inspection only (name/type/existence), value never inspected or displayed.

Remediation path, per current official Supabase documentation, confirmed working in practice across three completed migrations: migrate each server-side location that reads SUPABASE_SERVICE_ROLE_KEY to instead read JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'], verify each individually against real TEST traffic before moving to the next, and only once every dependency is migrated and verified, disable (not "rotate" — legacy keys cannot be rotated in place) the legacy service_role key via the Supabase Dashboard.

JWT-secret regeneration is NOT currently planned — it has a much broader blast radius (invalidates all legacy-key-based connections at once, and its effect on already-issued user sessions depends on this project's JWT-Signing-Keys migration status, which was not confirmed) and is not required by the path above.

verify_jwt (the Edge Function gateway's caller-authentication check, per-function in supabase/config.toml) is UNCHANGED by this credential migration itself — confirmed via current Supabase documentation and via direct inspection of every function's actual caller-auth code that verify_jwt governs the caller's own presented credential, not the function's internal admin-client credential. (send-quote-email's own verify_jwt was separately changed to true, but that was part of a distinct, separately-authorized authorization-hardening task — see §18.O below — not part of the credential-migration pattern itself.)

Migrations completed and verified so far (newest first):

send-trial-expiration-email — migrated to SUPABASE_SECRET_KEYS['default'], deployed, fully verified: a caller-authenticated-but-non-super-admin test call correctly reached and exercised the migrated adminClient (403, proving the SELECT succeeded under the new credential), both Hebrew and English test-mode sends succeeded, the unauthenticated path remained correctly rejected, and business_settings reminder flags/trial state were confirmed byte-identical before and after. Commit ea541123963d0581f26afd663a0aa9cfbdd4a6fd.

resend-email-webhook — migrated to SUPABASE_SECRET_KEYS['default'], deployed, fully verified via a genuine end-to-end test: a real quote email was sent to Resend's official bounced@resend.dev test address through ProFlow's own send-quote-email flow, Resend's real signed bounce webhook was received and its Svix signature verified, and the migrated adminClient successfully performed the real quotes UPDATE (email_bounced/email_bounce_reason/email_bounced_at) — observed directly via a read-only re-check of the TEST quote, with no other row affected. Commit f79eef667bf45a6da147e1f9b85d1b13a9705d7c.

billing-checkout-stub — migrated to SUPABASE_SECRET_KEYS['default'], deployed, fully verified: an authenticated TEST-user call to its own userId succeeded (200, stub:true, checkoutUrl:null, correct billingProfile), a cross-user call correctly returned 403 (which also proved the migrated adminClient's SELECT succeeded), and the invoice_line_item action succeeded with correct VAT math. Commit b80169bf46bf7bd9a2cefe8fb11180e1824d99b0.

send-quote-email — migrated to SUPABASE_SECRET_KEYS['default'], deployed, fully verified: TEST User1 sending their own TEST quote succeeded (200, real Resend send id returned); the same TEST User1 session targeting a TEST User2-owned quote was rejected (403) before any Resend call — this also proves the migrated adminClient's quotes SELECT succeeded under the new credential even on the rejection path, exactly as with the three migrations above; a request with no Authorization header was rejected (401) directly by the gateway, confirming verify_jwt=true remained active on the redeployed function; TEST User1's own quotes row and business_settings row were confirmed unchanged (hash-compared) before and after both calls. Its pre-existing authorization/data-trust hardening (§18.O) was not re-touched — only the credential source changed, per the diff in that commit. Commit 712df40c266f767d07dae14037b42e709797e644.

get-public-quote — migrated to SUPABASE_SECRET_KEYS['default'], deployed, fully verified, including the first Storage-admin operation exercised under the modern key in this remediation: an anonymous request for a known TEST public quote succeeded (200) with the documented DTO allowlist intact (no user_id/storage_path/file_url exposed); the migrated adminClient's Storage.createSignedUrl() call succeeded under the new credential — proven by fetching the returned signed attachment URL directly (200); a nonexistent-but-valid UUID returned 404, a malformed quote_id returned 400; an authenticated owning TEST user correctly received is_owner_viewing:true and a different TEST user correctly received false; the TEST quote/business_settings/quote_attachments rows were confirmed unchanged (hash-compared) before and after. verify_jwt remained false throughout (unchanged, correct for this intentionally-public endpoint). Commit f359958b4f2bc8aca70873d288c19eef5244a418. (CORRECTED — this migration was previously completed and verified but not yet recorded in this list or in the Status line below; that gap is closed as of this update, per the HANDOFF accuracy rule.)

Status: 5 of the 7 Edge Function dependencies are migrated and verified; api/cron.js (a Vercel function, not Supabase-managed) has not been touched yet. Legacy service_role is NOT yet disabled — it remains live and must be treated as compromised until every remaining dependency (see §18.P) is migrated, verified, and the owner explicitly authorizes disabling it. Stage D1.1 remains suspended pending both full remediation completion and a safe TEST-user authentication method — this was in fact resolved and used successfully during the migrations above (ordinary supabase.auth.signInWithPassword() using only the anon key, with TEST-account credentials the owner supplied via local .env variables, never via service_role/admin API) — but Stage D1.1 itself has not been resumed; that credential-auth capability was used only for the credential-migration verifications documented here. See §18.T for a persistent operational note on this TEST-authentication capability, so a future session does not need to rediscover it.

18.O send-quote-email — authorization/data-trust security hardening — COMPLETED + DEPLOYED + VERIFIED (a separate, distinct security task from the credential migration above; found during Stage 5A's migration pre-flight for this function, fixed before migrating its credential)

During the read-only pre-flight for send-quote-email's credential migration, a genuine, pre-existing authorization gap was discovered: unlike every other Edge Function audited in this remediation, send-quote-email had no caller authentication or quote-ownership check at all — any caller who knew or guessed a quoteId could trigger a real send "from" ProFlow's trusted address, to an arbitrary caller-supplied recipient, with caller-supplied (unverified) total/clientName/quoteLink/businessName content. This was fixed and verified, separately from and before the credential migration, per commit d49a35f827493cc905a32c104c6b417a539fc491:

authenticated caller identity is now required — Authorization header read, a caller-scoped client built from SUPABASE_URL + SUPABASE_ANON_KEY validates it via auth.getUser(); missing/invalid session is rejected (401) before any privileged work occurs.

verify_jwt = true for this function only (config.toml) — this function has exactly one legitimate caller type (an authenticated Dashboard user, who already sends a JWT automatically via supabase.functions.invoke()), unlike the mixed-caller functions elsewhere in this remediation, so gateway-level enforcement is the correct fit here. The in-function auth.getUser() check remains as an independent second layer.

ownership is now enforced: quotes.user_id must equal the caller's own id, or the request is rejected (403) before any Resend call. No super_admin cross-user exception exists — confirmed, by exhaustive repo search, that no product behavior anywhere requires one.

recipient email, client name, quote total, business name, and the canonical public-quote URL are now all derived server-side from the authorized quote's own database records (clients.email/company_name, quotes.total, business_settings.business_name, and a server-constructed link from a hardcoded production origin + quoteId + server-resolved region) — the request body's to/clientName/total/quoteLink/businessName fields are no longer read anywhere in the function.

Live-verified: an unauthenticated call was rejected (401); an invalid-JWT call was rejected by the platform gateway itself (401, confirming verify_jwt=true is genuinely active); a cross-user call against a different TEST user's quote was rejected (403) before reaching Resend; a legitimate TEST User1 own-quote send succeeded; the same call repeated with deliberately spoofed to/clientName/total/quoteLink/businessName values (including a syntactically-invalid "to" address that Resend would have rejected had it actually been used) still succeeded normally, empirically proving the spoofed values were discarded and the real authoritative data was used instead; the two TEST quotes involved were confirmed byte-identical in the database before and after every test.

SUPERSEDED (kept for history): the paragraph below previously said send-quote-email's credential migration "was deliberately NOT performed" as part of this hardening task. That migration has since been completed, deployed, verified, committed and pushed as commit 712df40c266f767d07dae14037b42e709797e644 — see the "send-quote-email" entry in §18.N's migrations-completed list above. Do not treat send-quote-email as still on the legacy credential.

Original paragraph (historical): "IMPORTANT: send-quote-email still uses the legacy SUPABASE_SERVICE_ROLE_KEY for its own internal adminClient. Its modern-key migration is the natural next credential-remediation step (see §18.P) but was deliberately NOT performed as part of this hardening task, and must not be assumed complete."

18.P Remaining legacy service_role dependencies — freshly re-verified this update, not copied from memory

Repo-wide grep for SUPABASE_SERVICE_ROLE_KEY (excluding this document and .env.example) confirms exactly 4 runtime files remain on the legacy credential: admin-delete-user/index.ts, send-subscription-expiration-email/index.ts (see §18.Q — currently broken independent of this remediation), chat-ai/index.ts (its market-isolation/classification prompt logic was separately fixed per §18.U — its internal admin-client credential itself was NOT touched by that fix and remains legacy), and api/cron.js (Vercel, not Supabase-managed). A separate grep confirms exactly 5 files now read SUPABASE_SECRET_KEYS: send-trial-expiration-email/index.ts, resend-email-webhook/index.ts, billing-checkout-stub/index.ts, send-quote-email/index.ts, get-public-quote/index.ts — matching the five completed migrations above exactly, with no drift found.

18.Q send-subscription-expiration-email — CONFIRMED BROKEN, unrelated to and unaffected by this remediation — do not repair as part of a credential migration

Preserved finding from an earlier session in this remediation: this function references subscription_ends_at, subscription_reminder_3d_sent, and subscription_reminder_24h_sent columns on business_settings that do not exist in the live schema. Any live invocation of its batch-mode query would fail at the database level. This is independent of the service_role/SUPABASE_SECRET_KEYS work — migrating its credential would not fix it, and should not be attempted as a side effect of that migration. Billing/payment infrastructure remains NOT COMPLETE (§19.C) and this function's actual repair requires its own separate audit/design decision, not a narrow credential swap.

18.R Open security/product follow-ups from this remediation — preserved, none fixed

A. TEST_BYPASS_EMAILS in send-trial-expiration-email (tahshitishi@gmail.com, minhatshay@gmail.com) still permits fully unauthenticated test-mode email sends to those two specific addresses. OPEN. Low severity (no data exposure/mutation results from it), not fixed.

B. send-quote-email's business logo field remains caller-supplied (body.logoUrl/businessLogo/logo/etc., with pre-existing partial validation — must be an http URL, non-SVG). Confirmed trivial to derive server-side instead (business_settings.logo_url exists and the function already queries that same row for business_name), but deliberately left unchanged in the §18.O hardening since it carries materially lower risk than the fields that were fixed and was not part of that task's authorized scope. Lower-priority follow-up, not fixed.

C. Stage D1.1 (Storage owner DELETE policy) remains suspended, pending both full service_role remediation completion (§18.N/§18.P) and, separately, being explicitly resumed by the owner — the TEST-authentication method needed for it has been proven to work (used successfully for the credential-migration verifications in §18.N) but Stage D1.1 itself has not been restarted.

D. All previously-documented Storage/D2/Account-State/billing open items (§18.I, §18.J, §19.A's Account-State track, §19.C) remain OPEN and are not implied complete by anything in this update.

18.S New follow-ups identified this session — both OPEN, neither fixed, both need their own read-only audit before implementation

Business address display formatting: business/client addresses can still appear in quote/email/public-quote presentation using the raw stored pipe-delimited form (e.g. street|city) instead of the desired human-readable street, city — this is the same underlying business_settings.address / clients.address storage convention already documented in §19.A's UserDetailsModal address-parsing work (formatAddressCity()), but that fix was scoped only to the Admin UserDetailsModal, not to every place an address is displayed. Do NOT change the stored DB format. A future task should trace every place an address is rendered (quote emails, the public quote page, anywhere else) and apply display-only normalization consistently, mirroring the existing UserDetailsModal parser rather than reinventing it. Read-only audit required first; not started.

Trial-expiration email CTA destination: the "Upgrade Now" CTA in send-trial-expiration-email's reminder emails currently links to /dashboard, which lands an unauthenticated recipient on the Login screen rather than reliably continuing them into plan/subscription selection after they authenticate. Desired future behavior: CTA → plan selection directly if already logged in, or CTA → Login → preserve the upgrade intent → automatically continue to PricingModal/plan selection after successful login if not. OPEN. Read-only audit of the actual login/redirect flow is required before any implementation — not started, not designed yet.

18.T Safe TEST authentication capability — operational note, so a future session does not report a capability gap that does not exist

A working, safe method for obtaining a real authenticated TEST-user session already exists and has been used successfully across all four completed service_role migrations (§18.N): ordinary Supabase Auth `signInWithPassword()` (or equivalent) against the normal client-safe anon/publishable key — never `service_role`, never `auth.admin`, never manual token minting.

Two designated TEST accounts' credentials already exist locally in this project's `.env` file, under these environment-variable NAMES only (values are never recorded here and must never be printed/echoed/logged/displayed, and the `.env` file itself must never be cat'd or displayed):

PROFLOW_TEST_USER1_EMAIL
PROFLOW_TEST_USER1_PASSWORD
PROFLOW_TEST_USER2_EMAIL
PROFLOW_TEST_USER2_PASSWORD

Usage pattern: load these programmatically from the local environment only (e.g. read `.env` in a throwaway script, never in a way that prints its contents), sign in each TEST user via the normal anon-key client, and use the resulting session token(s) to exercise a caller-authenticated Edge Function or an RLS-scoped table read — exactly as done for the send-quote-email verification (own-quote 200, cross-user 403, no-Authorization 401, before/after row-hash regression check, all reported as booleans/status codes only, never as raw data). This is also the TEST-authentication method Stage D1.1 (§18.J/§18.R.C) is waiting to be resumed with, once explicitly reauthorized — it does not need to be rediscovered or re-designed.

Do not use these two accounts for anything beyond controlled, disposable verification, and do not assume they represent real customer state — see §17.F for their known reuse history.

18.U chat-ai — market isolation + critical-message classification fix — CURRENT / VERIFIED, COMMITTED, DEPLOYED (a separate, distinct product/security task from the service_role credential migration track above; chat-ai's own SUPABASE_SERVICE_ROLE_KEY credential was NOT touched by this fix — it remains legacy, see §18.P)

Found during a dedicated Chat AI four-context audit (owner priority task, read-only first): chat-ai's system prompt contained a single static Pricing block listing both ₪/NIS and $ figures together, unconditionally, regardless of the caller's isHebrew context — unlike languageInstruction/supportEmail in the same file, which were already correctly branched. Live-tested across all four protected AI contexts (Hebrew landing, English/International landing, Hebrew authenticated app, English/International authenticated app): every pricing-related test surfaced the wrong-market currency (e.g. "Israeli customers can pay in shekels or dollars" in a Hebrew response; "we support pricing in USD and NIS" in an English response) — a live, reproducible violation of the Iron Rule/§3 above, not merely a theoretical risk. Separately, the category classifier's HARD_QUESTION branch (keyword-matching on the caller's last message) had no complaint/legal/lawsuit terms in either language, so messages like "אני רוצה להגיש תלונה או תביעה" or "I want to file a complaint or legal claim" fell through to GENERAL — confirmed live in both languages, a real gap against the owner's stated reliance on this category to surface exceptional conversations.

Fix, designed read-only first and only implemented after explicit owner authorization, confined to supabase/functions/chat-ai/index.ts only:

Pricing: the static block was replaced with a pricingBlock const, branched on the existing trusted isHebrew value exactly like languageInstruction/supportEmail — the Hebrew branch states ₪0/₪39/₪79 only with an explicit instruction never to mention $/USD/EUR/GBP; the English branch states $0/$12/$23 only with an explicit instruction never to mention NIS/ILS/₪, plus one true, already-authoritative clarification distinguishing the subscription's own USD pricing from a customer's own outgoing quote currency (USD/EUR/GBP, per §3/regionConfig.js — no EUR/GBP subscription price was fabricated, since none exists anywhere in the codebase).

Classification: the HARD_QUESTION branch's keyword list was extended (additively only — CANCELLATION and FEATURE_REQUEST branches, and their priority order, were not touched) with תלונה / תביעה / משפטי / עורך דין / עו"ד / לתבוע / תובע / בית משפט / לבית משפט (Hebrew) and complaint / legal / lawsuit / lawyer / attorney / suing (English). Deliberately excluded, with reasons recorded: bare Hebrew משפט (too broad — also means grammatical "sentence"), bare English "sue" (collides with the ordinary word "issue"), bare English "claim" (collides with ordinary phrasing like "claim my free trial"). No new category was introduced — GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION remain exactly the four existing values.

Static verification: build PASS, lint 0 errors (only the same pre-existing unrelated warnings already documented elsewhere in this file), tests 21/21 PASS. Deployed: chat-ai only, no other function, config.toml untouched.

Live verification (11 authorized functional test calls against the deployed function, using the designated TEST accounts per §18.T — no real customer data): all four contexts' pricing questions now return only their own market's currency with zero cross-mention (Hebrew: ₪ only; English: $ only, with EUR/GBP correctly described only as a customer's own quote-currency option, never as a subscription price); all four contexts' legal/complaint test messages correctly triggered HARD_QUESTION; GENERAL, CANCELLATION, and FEATURE_REQUEST regression tests (one plain question each) all classified exactly as before, confirming no regression from the additive keyword change. Full PASS/FAIL/NOT TESTED matrix run per the §3 mandatory regression rule — no row omitted, no row left NOT TESTED for the code paths actually exercised.

Owner production verification (the one item this session's own TEST credentials could not close, since no TEST account has role=super_admin and chat_logs has no ownership-based RLS reachable by an ordinary account): the owner personally opened the live Super Admin AI Support Logs screen after deployment and visually confirmed — HARD_QUESTION rows exist for both the new Hebrew and the new English legal/complaint tests; GENERAL, CANCELLATION, and FEATURE_REQUEST remain present, distinct, and functioning as separate categories; AI Support Logs display, free-text search, and category filtering all remain operational; no existing logging/admin-monitoring behavior was broken. This closes the previously-open manual verification item — chat_logs row-content verification = PASS.

Committed and pushed: 7329efbd77ccbf5312e54e681aaedb1f283edf81 ("Fix Chat AI market isolation and critical-message classification") — 1 file changed (supabase/functions/chat-ai/index.ts only).

Scope note, so this is never conflated with the credential-migration track: this fix did NOT touch chat-ai's SUPABASE_SERVICE_ROLE_KEY usage, AIChatWidget.jsx, AILogs.jsx, chat_logs schema, Admin filtering/search UI, userEmail attribution, authentication, verify_jwt, or any other Edge Function. chat-ai remains on the legacy service_role credential per §18.P — its eventual credential migration is a separate, still-open, still-unstarted item.

Known remaining gap, disclosed not silently dropped: bare Hebrew משפט (court, no suffix — e.g. "לבית משפט" is covered, but a message using only the root משפט without either of the two added explicit phrases would not be) is intentionally not covered by the added keywords, per the owner's own explicit exclusion list. Not tracked as a defect; a candidate for a future, separately-scoped classifier pass if ever wanted.

18.V AI Support Logs status indicator (green/red + unread-exception counter) — OWNER-REQUESTED FOLLOW-UP, OPEN / NOT STARTED (design and implementation not authorized by this entry)

Owner-requested product behavior, not yet designed in detail and NOT implemented: a status indicator next to the "AI Support Logs" button/entry point. Normal state: GREEN — no new exceptional messages requiring owner review. Alert state: RED, with a numeric unread/new-exception counter, whenever new exceptional messages exist. For this purpose, "exceptional" currently means CANCELLATION and HARD_QUESTION only — FEATURE_REQUEST must remain visible and filterable in AI Support Logs exactly as today, but must NOT trigger the red alert/counter. Read/reset behavior: after the owner opens/reviews the relevant exceptional messages, the counter should reset and the indicator should return to GREEN; future new exceptional messages should turn it RED again and start a new count.

Critical preservation rule for this feature, whenever it is eventually built: it must NOT delete chat_logs, mutate historical chat content, change existing categories, change classifier behavior as a side effect, break search, break filtering, break ordering, remove historical messages, alter AI answers, or alter the Four AI Context market/language rules (§3 above).

Mandatory next step, NOT done here: before any implementation, a separate READ-ONLY audit must determine the smallest safe unread/read-state mechanism. That audit must specifically inspect whether an existing state mechanism (e.g. a timestamp comparison against the Super Admin's last-viewed time, a client-side marker, or similar) can be reused before proposing any DB/schema change — do not assume a new DB column/table is necessary; that must be a conclusion of the audit, not a starting assumption. This entry documents the requirement and constraints only; it is not authorization to begin that audit or any implementation, and does not change the owner-driven work-order rule (§3 above) — this remains OPEN until the owner explicitly asks to start it.

18.W chat_logs — RLS/table-privilege security hardening — FIXED + VERIFIED (applied manually live in Supabase by the project owner; database-only, no in-repo migration file, consistent with this document's existing no-migrations convention)

Finding, live-confirmed before the fix: public.chat_logs had RLS DISABLED with no policies at all, and anon/authenticated/service_role all held the full table-privilege set (DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE). Live-tested exploit confirmation: an ordinary authenticated TEST account (PROFLOW_TEST_USER1, role='user', not an admin) performed a minimal direct Data API request (`select=id&limit=5`, no sensitive columns fetched) against public.chat_logs and received HTTP 200 with 5 rows — the intended super_admin-only /ai-logs UI guard (AILogs.jsx) was confirmed to be the only thing standing in the way, i.e. no server-side enforcement existed at all.

Read-only repository dependency audit performed before the fix (unchanged, re-confirmed at fix time): sole writer is supabase/functions/chat-ai/index.ts (INSERT only, via the legacy SUPABASE_SERVICE_ROLE_KEY — service_role bypasses RLS unconditionally regardless of any policy state); sole legitimate reader is src/pages/AILogs.jsx (SELECT via the authenticated user's own JWT, full-table `select('*')`, client-side search/filter, no pagination); no legitimate UPDATE/DELETE/UPSERT path exists anywhere in the repository against this table; no legitimate anon access path exists anywhere. AIChatWidget.jsx never queries this table directly.

Fix applied, live in Supabase (no application file touched):

RLS ENABLED on public.chat_logs.

Exactly one policy created: "Super admins can view all chat logs" — FOR SELECT TO authenticated USING (public.is_super_admin()). Reuses the existing SECURITY DEFINER helper already live-verified non-recursive for business_settings (§18.M) — no new database function was created. No INSERT/UPDATE/DELETE policy exists on this table.

Grants: anon reduced to NONE (no table privileges at all). authenticated reduced to SELECT only (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER revoked). service_role left unchanged, retaining DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE (never client-reachable, so this carries no public exposure risk; narrowing it was not required by the writer's actual needs and was not attempted).

Verification evidence, live-tested:

Post-fix, PROFLOW_TEST_USER1's direct Data API SELECT (`select=id&limit=5`) returned HTTP 200 with `[]` — zero rows, the expected result given the new policy and USER1's non-admin role.

Super Admin AI Support Logs was manually verified by the project owner post-fix: historical logs remained visible; search was manually verified working; categories remained visible/filterable, including GENERAL, FEATURE_REQUEST and HARD_QUESTION explicitly confirmed.

No evidence that any historical chat_logs row was altered or deleted by this fix.

No application source code was changed for this fix — chat-ai/index.ts, AILogs.jsx, AIChatWidget.jsx, and Dashboard.jsx were all re-confirmed unchanged, consistent with the pre-fix dependency audit's conclusion that the existing reader/writer code paths are already compatible with this exact RLS design.

chat-ai's service_role credential/architecture was not touched by this fix — it remains on the legacy SUPABASE_SERVICE_ROLE_KEY per §18.P; that migration track is fully independent of and unaffected by this table-level RLS change (service_role bypasses RLS under either the legacy or the modern SUPABASE_SECRET_KEYS credential form).

Local/International AI market-separation behavior (§3/§18.U) was not changed and is architecturally independent of this fix — the chat_logs INSERT is a post-response side-effect that runs via service_role regardless of the RLS/policy state on the table.

What was NOT verified as part of this fix, stated explicitly so this is never overclaimed: CANCELLATION category visibility was not separately named as re-confirmed (only GENERAL/FEATURE_REQUEST/HARD_QUESTION were). The four-context AI Chat functional flows (Hebrew/International × landing/authenticated) were not independently re-run as live functional tests against this specific fix — their non-interaction with chat_logs RLS is an architectural conclusion from the dependency audit (the INSERT path uses service_role, unaffected by RLS), not a claim that all four were freshly live-tested here. A later same-session attempt to re-confirm PROFLOW_TEST_USER2's direct SELECT against this table could not be completed because USER2 could not be authenticated at all (see §18.X below) — this is a gap in verification coverage, not evidence of any problem with the fix itself.

Status: 🟢 FIXED + VERIFIED (the chat_logs anon/ordinary-authenticated exposure itself). Do not describe every possible regression scenario as completed — see the explicit NOT-verified list immediately above.

18.X TEST account auth / QA reliability — OPEN, unrelated to and must NOT be described as a chat_logs regression

Observed: PROFLOW_TEST_USER2 could not authenticate using the credentials currently stored in .env, even though the project owner states USER2's password was not changed during the earlier password-reset-request test (that test only requested a reset email and never consumed/completed it, consistent with the owner's statement that the password itself should be unchanged).

Observed: later PROFLOW_TEST_USER1 browser re-login attempts in the same QA session were inconsistent — most attempts did not even trigger a network auth request at all (consistent with a known browser-automation pitfall: bypassing a React-controlled input's change events leaves the form's internal state stale even though the visible DOM value looks correct), and one attempt did reach the server and returned a generic credential-rejection response.

Explicitly NOT done, and must not be assumed done: no password was reset, .env was not modified, Supabase Auth was not modified, and the root cause (stale credentials vs. QA browser-automation reliability vs. something else) was not investigated or fixed.

Status: OPEN — requires its own separate, controlled, read-only audit before any action is taken. This is a TEST-account/QA-tooling reliability question, not a security finding, and must never be conflated with or cited as evidence against the chat_logs fix above, which was independently confirmed via a session that was successfully authenticated at the time of that specific check.

18.Y International (and Local) signup / email-confirmation / market-bootstrap — ARCHITECTURE AUDIT COMPLETE, GO WITH CONDITIONS, NOT IMPLEMENTED

Trigger: a fresh, explicitly-approved International TEST signup (PROFLOW_TEST_INTL_EMAIL, credentials only in .env, values never recorded here) was performed through the real International signup UI specifically to reproduce and diagnose a suspected signup/confirmation defect.

Reproduction, live-verified this session:

Auth signup succeeded through the real International UI. No active Supabase session was created immediately after signUp() (email confirmation is enabled on this project). The English confirmation email was received from info@quotecodepro.com and manually clicked by the project owner. Verification succeeded. Live auth.users check afterward (owner-performed): the row exists, email_confirmed_at is populated, last_sign_in_at is populated. The confirmation redirect landed on the Hebrew/Israel root landing page, not an International destination. Live business_settings check afterward (owner-performed): ZERO rows for this email.

Resulting state, deliberately preserved as a reproduction case — do NOT repair, delete, recreate, or manually insert business_settings for this account without explicit separate authorization:

Auth: EXISTS + CONFIRMED. business_settings: MISSING.

Root cause, fully traced by re-reading the actual live entry point (src/main.jsx renders AppLocal.jsx/AppGlobal.jsx directly — src/App.jsx, which has its own separate signUp/routing logic, is NOT the live entry point and is not part of this trace):

(1) The one shared signUp() call, used identically by both markets (Dashboard.jsx, inside the auth form handler), is invoked with no options object at all — no emailRedirectTo, no metadata. This is not International-specific; Local signups have the exact same code and the exact same gap.

(2) With no emailRedirectTo, Supabase falls back to the project's Site URL, landing the confirmation click on the bare domain root.

(3) Neither LandingLocal.jsx nor LandingGlobal.jsx contains any session-awareness at all (confirmed by direct grep — zero getSession/onAuthStateChange references) — a valid, confirmed session sitting in localStorage after confirmation is never detected or acted on there.

(4) The only code that creates a business_settings row (fetchSettings()/createNewBusinessSettings(), both defined inside Dashboard.jsx, triggered only by Dashboard.jsx's own mount effect and its onAuthStateChange SIGNED_IN handler) therefore never runs, because Dashboard.jsx never mounts at the landing-page URL the confirmation redirect actually reaches.

(5) Separately, main.jsx's bundle-selection cascade (query lang param -> /en//he path prefix -> localStorage.proflow_lang -> proflow_geo_country cookie -> browser language) re-resolves market completely fresh at that bare-root URL, independent of which market the user actually signed up under -> this is the direct, confirmed mechanism behind the Hebrew-landing-page redirect.

Architecture decision, resolved this session (explicitly correcting an earlier ambiguity in the first pass of this audit, which left createNewBusinessSettings() still leaning on fresh geo for creation-time market even after proposing signup_market metadata):

Authoritative market source of truth, three tiers, strictly narrowing, never re-widening:

Tier 1: business_settings.country - permanent authority once a profile row exists, unchanged forever after (already true today, unaffected by this fix).

Tier 2: auth.user_metadata.signup_market - authoritative ONLY for the one-time creation of a genuinely missing profile. Captured at the exact instant signUp() is called, from whichever bundle (isHebrew) the user was actually viewing.

Tier 3: fresh geo lookup / explicit user region-choice screen (today's existing mechanism, unchanged) - fallback ONLY when tier 2 is unavailable (e.g. a pre-fix legacy account, like the current TEST International reproduction case, whose metadata was never populated).

user_metadata trust-boundary conclusion (Task 6 of the architecture audit): an authenticated user CAN freely rewrite their own user_metadata at any time via auth.updateUser() - this is standard Supabase behavior, unlike app_metadata which only a service_role call can write. Therefore signup_market must be consumed ONLY inside the one existing branch that already gates all profile creation (fetchSettings's "no row found" branch) and must NEVER be re-read once business_settings exists for that account - this is already guaranteed for free, since that branch is already permanently unreachable once a row exists (unchanged, pre-existing fact). app_metadata would be the stricter choice but requires new server-side signup-hook infrastructure not currently justified by the actual risk (self-selecting one's own brand-new, still-empty account's market is not a privilege-escalation risk in the sense this project's other role/RLS protections guard against).

Recommended architecture (Option C of the compared alternatives - reuse the existing, already-idempotent Dashboard.jsx bootstrap logic; no new route/component): confirmation redirect points at https://www.quotecodepro.com/dashboard (no market needs to be encoded in the URL at all, since metadata now carries it); Dashboard.jsx's existing mount effect/onAuthStateChange handler is left otherwise unchanged and simply gets the chance to run because the user actually lands there.

Live Supabase Auth URL Configuration, current state (owner manually verified and then owner manually changed, this session - see below):

Site URL: https://www.quotecodepro.com (unchanged).

Redirect URLs, before the owner's manual addition: https://quotecode.vercel.app/ and https://www.quotecodepro.com only - confirmed by the owner via Supabase Dashboard -> Authentication -> URL Configuration.

Manual owner action, live, this session: the project owner added https://www.quotecodepro.com/dashboard to the Redirect URLs allow-list. Nothing was removed. Site URL was not changed. The old Vercel URL was intentionally left in place.

Current live Redirect URLs, as a result: https://quotecode.vercel.app/, https://www.quotecodepro.com, https://www.quotecodepro.com/dashboard.

Whether the pre-existing bare-origin entry already covered /dashboard before this addition is unverified (Supabase's own redirect-URL matcher semantics for a bare-origin vs. a specific subpath were not testable from any session in this engagement) - the addition was made out of caution regardless; live behavioral confirmation (does a fresh signup/confirmation now actually land on /dashboard) remains an outstanding Phase-0 verification step, not yet performed.

quotecode.vercel.app reference audit (repo-wide, this session): zero references to vercel.app anywhere in src/ or supabase/ - confirmed by direct grep. Nothing in current application code generates, checks, or depends on that domain for any auth redirect or otherwise. Its presence in the Redirect URL allow-list is inert from the codebase's perspective. Removal or redirection of the old Vercel domain remains a fully separate, independently-scoped issue (see the earlier canonical-domain-cutover audit in this document's history) and must not be bundled into this signup fix.

Multi-currency / quote-history product rules, owner-restated and cross-referenced against already-documented mechanisms (no new mechanism, clarifying an existing one): International intentionally supports changing the account's active currency between USD/EUR/GBP at any time - this only affects NEW quotes going forward and must never retroactively rewrite existing quotes (mechanism already documented: handleEditClick preserves a quote's original currency/tax_rate on save, per the existing §5 audit note above in this document). One International account can therefore legitimately have quote history spanning multiple currencies simultaneously - this is correct, not leakage. Important owner correction: a historical quote displayed with ₪ inside an International account is not automatically current currency-leakage - a known example exists where the quote was originally created in ILS and cannot simply be changed, and the reason is not merely a soft policy against rewriting history - the quote is signed/approved and therefore immutable under the existing §17.A immutability system (DB triggers + UI/handler guards). Future QA must distinguish CURRENT incorrect ₪ leakage from VALID, locked historical quote data. Separately, the owner demonstrated that changing the selected country/market in business settings intentionally changes the active currency going forward as designed - this is not something to "fix" during International work.

Bilateral regression rule (owner-stated, standing requirement, not new but formally restated here): Local/Israel and International must be evaluated together whenever shared functionality changes. This signup/confirmation defect is a clean example of correct application - it was diagnosed as a shared-code defect affecting both markets equally (Local's signUp() call has the exact same missing emailRedirectTo gap), not an International-only issue, and any future fix must be verified against both markets, not just the one that happened to surface the bug first.

Admin UI standing requirement (restated for permanence, not new): the final Admin/Super Admin UI design remains NOT approved - the current dark/neon UI must not be treated as final. One firm rule already fixed regardless of final design: the users-management table/list must not begin with email as the primary identity column - the primary/first identity shown must be the user/business human-readable name, with email as secondary information. Any future Admin mockup/implementation must preserve this.

Exact minimal implementation plan (design only, NOT implemented, NOT authorized in this entry):

File: src/pages/Dashboard.jsx only. (a) At the existing signUp() call: add options: { emailRedirectTo: window.location.origin + '/dashboard', data: { signup_market: isHebrew ? 'Local' : 'International' } }. (b) Inside fetchSettings()'s missing-profile branch: read session.user.user_metadata?.signup_market first (mapped to 'Local'/'International'), before falling back to the existing fetchFreshGeoCountry() call. No other file, no database object, no RLS policy, no Edge Function requires any change for this fix.

Phased rollout (design only): Phase 0 (live verify whether the new Redirect URL entry actually resolves the confirmation redirect to /dashboard correctly - not yet performed) -> Phase 1 (code change, both edits above, one file) -> Phase 2 (full bilateral Local+International regression matrix, including the specific "confirm from a different-language device/location" test) -> Phase 3 (validate using the existing preserved TEST International account for the bootstrap-path half, plus one fresh post-fix signup for the full metadata-preservation half, per the audit's own Section 16/Task 8 findings).

STOP conditions: do not proceed past Phase 0 without confirming the redirect actually lands on /dashboard. Any regression-matrix failure for either market is a hard stop - this fix must never be considered complete on an International-only pass. Do not bundle this work with the separately-tracked chat_logs work (§18.W, already closed), the TEST-account credential/trial-reset issues (§18.X, this document's trial-reset note above), the restricted-admin-role work, or the old Vercel-domain cutover question.

Status: DESIGN COMPLETE, GO WITH CONDITIONS. Implementation NOT started, NOT authorized by this entry. Next action requires a separate, explicit project-owner authorization.

18.Z P0 — Persistent project continuity system — CREATED, PERMANENT REQUIREMENT

The project owner identified loss of AI-session context as a critical project risk after a prior long conversation reached its limit and significant time was lost re-explaining history, rules, decisions, and current state to a new session.

A new, permanent file was created this session: PROFLOW_PROJECT_CONTEXT.md (repository root, alongside this file). It is the project's persistent operational memory across sessions - not merely a summary. It begins with an explicit "read this first" instruction, contains a full mandatory continuity protocol (required reading order; resume-not-restart discipline; a standing "continuity owner" responsibility on whichever session is currently active; a self-perpetuating rule that every future session inherits responsibility for maintaining it; an explicit list of triggers requiring an update; fact/assumption/design-decision labeling discipline; authorization-state tracking that survives session boundaries; a live "current exact checkpoint" section; anti-staleness and anti-append-forever discipline; manual-owner-action attribution rules; TEST-account documentation rules with an absolute no-secrets constraint; a chat-limit emergency priority rule; and an explicit success criterion), followed by ~30 knowledge sections covering project identity, architecture, both markets' product rules, market source-of-truth rules, currency/quote-history rules, Auth/signup state, business_settings, Supabase/RLS state, the role model, Admin work and UI requirements, chat_logs/AI state, trial/plan rules, production safety, David Aluminum protection, workflow/git rules, TEST-account inventory (no secrets), the bilateral-regression requirement, open issues, closed issues not to be reopened without reason, owner corrections, the current workstream, the current exact checkpoint, the next action, and this maintenance rule itself.

This is a PERMANENT ProFlow workflow requirement, not a one-time migration. Every future session - starting with the very next one - must read PROFLOW_PROJECT_CONTEXT.md first, then PROFLOW_ARCHITECTURE.md, then this file, then resume from the checkpoint recorded in PROFLOW_PROJECT_CONTEXT.md, and must keep all three documents synchronized with actual project state as work proceeds, per the protocol documented in PROFLOW_PROJECT_CONTEXT.md itself.

18.AA P0.1/P0.2 — Architecture documentation audit and remediation - COMPLETE

18.AA.1 P0.1 - Architecture Documentation Audit (read-only)

PROFLOW_ARCHITECTURE.md was read-only audited section-by-section against PROFLOW_PROJECT_CONTEXT.md, this file, and current repository code. Overall classification: MIXED. Findings, summarized (full section-by-section table produced and reviewed by the project owner, not duplicated here):

Remained accurate: project/stack/domain description; VAT rules (18% Local / 0% International); multi-currency/quote-currency-preservation architecture (quote.currency frozen at creation, never renormalized); paywall tiers (Free 5 / Basic 20 / Pro unlimited quotes/month), matching current AdminUsersTab.jsx logic exactly.

Stale/incorrect: the sitemap/robots.txt SEO claims did not match the live files (live sitemap has 11 URLs, not the 6 the document listed; robots.txt has no Disallow rules at all - noindexing of /dashboard and /ai-logs is actually enforced via X-Robots-Tag headers in vercel.json, a deliberate documented choice, not by robots.txt).

Dangerously incomplete: the document contained zero mention of the chat_logs RLS exposure/fix, zero mention of the admin role work, and zero mention of the Auth/signup architecture work - a future session relying on it alone would have no idea any of that had happened.

Dangerous if followed literally: the localization claim ("browser settings + timezone determine language and default currency") describes a far simpler and less safe mechanism than what is actually implemented (see §18.Y above and the rewritten PROFLOW_ARCHITECTURE.md §3 for the real three-layer pre-signup/post-signup distinction). The document's final unnumbered block was a literal, syntactically executable git add . ; commit ; tag ; push sequence with no framing marking it as historical-only - flagged as the single highest-priority remediation item, since a future session instructed to "follow the architecture document" could otherwise interpret it as a standing instruction to auto-commit/push, directly contradicting the explicit no-automatic-commit/push rule this project has followed throughout every task in this engagement.

Remediation strategy selected by the project owner: Option B - substantially rewrite while preserving verified content. (Option A, minimal patch, was judged insufficient given the size of the gaps; Option C, archive as historical and start fresh, was judged wasteful given how much content was still correct.)

18.AA.2 P0.2 - Documentation Remediation (executed, documentation-only)

PROFLOW_ARCHITECTURE.md was substantially rewritten per the Option B strategy above. Preserved near-verbatim: stack/domain, VAT rules, multi-currency/quote-currency-preservation architecture (including the owner's signed-quote-immutability nuance for the historical-ILS-quote example), paywall tiers. Rewritten: the localization/market section, now explicitly separating LIVE current behavior (pre-signup anonymous routing cascade in main.jsx; post-signup business_settings.country permanence) from DESIGN/NOT-YET-IMPLEMENTED behavior (the three-tier signup_market authority from §18.Y), with an explicit warning not to treat the design tier as live. Corrected: the SEO/sitemap/robots.txt section, now matching the live files exactly. Added: full Auth/signup architecture section (§18.Y's findings), a full RLS/security section (business_settings and chat_logs current state, §18.M/§18.W), a role-model/Admin section (current live vs. designed vs. not-started state, plus the Admin-UI name-before-email requirement), a Public Quote/Storage section (including the documented, still-open Storage-cleanup/DELETE-policy gap from §18.J), and an email/WhatsApp section clearly distinguishing repo-verifiable architecture from external, not-repo-verifiable operational setup (Namecheap/Gmail). Removed entirely: the old numbered "Iron Rules" section (replaced with a pointer to PROFLOW_PROJECT_CONTEXT.md as the authority for current workflow/authorization rules) and the executable git command block (deleted outright, not merely commented out).

PROFLOW_PROJECT_CONTEXT.md was updated: a new "Document Hierarchy & Conflict Resolution" section was added (the three-document role split, and the five-part conflict-resolution rule - current-vs-historical first, PROJECT_CONTEXT authoritative for operational/authorization matters, repo/live evidence decisive for technical claims, HANDOFF never rewritten to match current architecture, repo evidence resolves any PROJECT_CONTEXT/ARCHITECTURE technical disagreement); the required reading order was extended to include PROFLOW_ARCHITECTURE.md between this file and PROFLOW_HANDOFF.md; the CURRENT EXACT CHECKPOINT was updated to reflect P0/P0.1/P0.2 completion, with the signup-fix work correctly preserved as the next workstream, not implemented, not authorized by the documentation update itself.

This entry in PROFLOW_HANDOFF.md. No other section of this file was rewritten - existing historical content (§1-§18.Z) was left untouched, per the standing rule that this file preserves historical evidence and is never rewritten merely to match current architecture.

Verification performed before considering this complete: git status confirmed only the three documentation files were modified/untracked (no application file, no .env, no other file); a secret scan of all new/changed documentation content confirmed no password, JWT, service-role key, API key, or token value was introduced anywhere - only environment-variable NAMES are referenced, consistent with the standing no-secrets-in-documentation rule.

Status: COMPLETE. Documentation-only. No code, database, Supabase, Auth, RLS, or TEST-account change was made across P0, P0.1, or P0.2. No commit, push, or deploy occurred - these remain separately gated by explicit project-owner authorization, unaffected by this documentation work.

18.AB P0.3 — ChatGPT <-> GitHub Continuity Verification - COMPLETE, DOCUMENTATION + VERIFICATION ONLY

The project owner connected ChatGPT's official GitHub plugin/connector (discovered in ChatGPT Plugins) to the GitHub account with access to quotecode-dev/quotecode-clean. Permission mode was explicitly set by the owner to "Allow read actions" - described by the ChatGPT UI as "ChatGPT can read without asking, but will ask before making changes." This choice is intentional: the project does not require or want autonomous ChatGPT repository writes for continuity to work.

Live connectivity test performed jointly by the project owner and a ChatGPT session, repository quotecode-dev/quotecode-clean:

ChatGPT successfully fetched PROFLOW_ARCHITECTURE.md directly from the connected GitHub repository - result PASS. This proves the connector reads real, current repository state rather than relying on chat memory or an uploaded copy.

ChatGPT then attempted to fetch PROFLOW_PROJECT_CONTEXT.md - result 404 / NOT FOUND. This was expected and is explicitly NOT a connector failure: at the time of this test, per the P0.2 report, git status showed PROFLOW_ARCHITECTURE.md and PROFLOW_HANDOFF.md as modified-but-uncommitted and PROFLOW_PROJECT_CONTEXT.md as untracked - none of the P0.2 documentation work had been committed or pushed. GitHub therefore correctly did not yet contain PROFLOW_PROJECT_CONTEXT.md at all, and still exposed the pre-P0.2 committed version of PROFLOW_ARCHITECTURE.md. This 404 is itself further, independent confirmation that the connector reads actual GitHub state rather than fabricating a plausible-sounding read.

Documentation updated this session (P0.3, documentation-only, all three files):

PROFLOW_PROJECT_CONTEXT.md: new section recording the verified GitHub-continuity status (repository, connector state, permission mode, both test results, explicit no-write-authorization note); three new Mandatory Continuity Protocol items - a new-session GitHub bootstrap path (read PROJECT_CONTEXT -> ARCHITECTURE -> HANDOFF from the current default branch, in that order, when connector access exists; manual-upload fallback retained, same reading order, when it does not), a working-tree-vs-GitHub freshness rule (a connector read never proves uncommitted local changes are already in GitHub; a 404 or stale content for a known-uncommitted file is expected, correct behavior, not a failure), and an explicit GitHub-connector write-authorization restriction (read access is never, by itself, authorization to write - every GitHub write action remains gated on separate, explicit, per-instance project-owner authorization, identical to the existing commit/push discipline); CURRENT EXACT CHECKPOINT updated to reflect P0.3 completion, the still-not-committed status of the P0 documentation set, and the exact post-approval commit/push/re-test/acceptance-test sequence.

PROFLOW_ARCHITECTURE.md: one small addition only (not a rewrite - P0.2 already completed that work) noting GitHub as the project's persistent version-controlled source and pointing to PROFLOW_PROJECT_CONTEXT.md for the connector's operating rules; the architecture file is explicitly not turned into a connector/ChatGPT manual.

PROFLOW_HANDOFF.md: this entry.

Verified before considering this complete: git status confirmed only the three documentation files were modified/untracked - no application file, no .env, no other file. A secret scan of all new/changed content confirmed no password, JWT, service-role key, API key, OAuth token, or database credential value was introduced anywhere - only the repository name, environment-variable NAMES, and non-secret architectural identifiers appear.

Status: COMPLETE. Documentation + verification only. No GitHub write operation was performed (no commit, no push, no branch, no file edit through the connector or otherwise). No application code, database, Supabase, Auth, or RLS change was made. The three documentation files remain uncommitted in the local working tree, awaiting separate explicit project-owner authorization to commit and push - not granted by this entry.

18.AC P0.4 — Proactive Continuity Checkpoint Protocol - DOCUMENTED, NOT YET COMMITTED/PUSHED

Background: P0.3 (§18.AB) completed a successful ChatGPT <-> GitHub post-push acceptance test - ChatGPT correctly read all three permanent documents directly from GitHub after the P0.3 commit (78aba82) was pushed. This confirmed GitHub as a working persistence path, but also surfaced a practical gap during real project work: approximately 11 hours passed between commits on one real working day. ChatGPT's GitHub connector reads committed/pushed state only - it cannot see Claude's uncommitted working tree. Therefore a session ending unexpectedly in the middle of such a gap would leave a new session recovering a checkpoint many hours stale, with no mechanism forcing anyone to notice.

The project owner explicitly rejected being responsible for tracking this - not for watching chat length, not for estimating context-window usage, not for remembering elapsed time since the last push, not for remembering to ask for a documentation update. This responsibility was assigned instead to whichever chat/AI session is currently active, as a new, permanent, self-perpetuating item in PROFLOW_PROJECT_CONTEXT.md's Mandatory Continuity Protocol (new item 20, "Proactive Continuity Checkpoint" - items renumbered accordingly, Success Criterion is now item 21).

Key points of the new rule, recorded in full in PROFLOW_PROJECT_CONTEXT.md itself, summarized here: eight checkpoint triggers (roughly 2-3 hours of meaningful work without a push; a significant audit/implementation/verification/debugging/architecture-discussion phase reaching a stable point; multiple accumulated owner decisions/corrections; material change to current state or next action; significant facts existing only in the conversation/working tree; unusually long/complex conversation; a deliberate session/tab switch being considered; any reasonable risk of the owner having to re-explain work) are triggers to consider and prepare a checkpoint, never automatic authorization to commit. The 2-3 hour figure is explicitly a guideline, not an automatic commit schedule. Documentation-only checkpoints are an explicitly permitted, encouraged pattern: unfinished application work can coexist with accurate documentation stating it exists only in the working tree, committed/pushed as documentation alone, without ever falsely publishing incomplete code as done. Explicit project-owner authorization remains mandatory before any commit or push, exactly as under every prior P0.x rule - the new rule changes who notices the need for a checkpoint, never who authorizes writing it to GitHub. The rule is explicitly tied to the existing Working-Tree-vs-GitHub Freshness Rule (protocol item 18, from P0.3): "documentation updated locally" is not equivalent to "continuity safely persisted" - persistence requires an actual push.

Verified before considering this complete: git status confirmed changes limited to PROFLOW_PROJECT_CONTEXT.md and this file - PROFLOW_ARCHITECTURE.md required no change (no contradiction was created by this rule, as expected) and no application/Supabase/Auth/Database file was touched. A secret scan of the new content found nothing - only the repository name, protocol item numbers, and a plain elapsed-time figure (approximately 11 hours) appear, no credential of any kind.

Status: DOCUMENTED, NOT YET COMMITTED/PUSHED as of this entry - awaiting the same explicit project-owner review-then-authorize sequence used for every prior P0.x documentation change. No application code, database, Supabase, Auth, or RLS change occurred during P0.4.

18.AD International/Local signup-market preservation fix - Implementation Phase 1 - IMPLEMENTED IN WORKING TREE / NOT COMMITTED / NOT DEPLOYED / NOT LIVE-TESTED

The project owner explicitly authorized implementation of the previously audited and approved (GO WITH CONDITIONS) three-tier signup-market design (§18.Y). This entry records the implementation itself - not a new investigation, not a redesign.

Pre-edit safety verification (mandatory per the authorization) found one material discrepancy from the earlier audit's own pseudocode, corrected before writing any code: the audit's illustrative snippet used the file's local isHebrew variable for the new signup_market value. Direct re-reading of the current Dashboard.jsx this session found isHebrew = isHebrewEnv(bizCountry, session) - and bizCountry's own useState initializer reads from localStorage.getItem('proflow_cached_country'), defaulting to 'International' if nothing is cached. The code's own adjacent comment (line ~111-114) explicitly documents isHebrew as derived only from an *existing* account's real legal region for display purposes, never as a signal for a *new* account's region. Using it for signup_market would have silently reintroduced exactly the browser/cache-derived-market bug this fix exists to eliminate. Corrected: the implementation instead threads the bundleIsHebrew prop - already passed unconditionally by both AppLocal.jsx (true) and AppGlobal.jsx (false) at the route level, but previously never read inside Dashboard.jsx - into the component's own signature, and uses that at the signUp() call site instead. This is judged a same-scope correction to an implementation detail (which variable correctly represents "the bundle the user is actually signing up through"), not a redesign of the approved three-tier approach - flagged here explicitly per the safety-verification instruction rather than silently substituted.

Exact changes made, src/pages/Dashboard.jsx only, four coordinated edits:

1. Dashboard() signature changed from no-arg to accepting { bundleIsHebrew } (default {} for safety) - purely additive, both real callers already pass this prop.

2. The signUp() call (inside handleAuth) now passes options: { emailRedirectTo: 'https://www.quotecodepro.com/dashboard', data: { signup_market: bundleIsHebrew ? 'Local' : 'International' } }. emailRedirectTo is hardcoded to the literal canonical-domain string, deliberately not window.location.origin, so confirmation always returns to www.quotecodepro.com even if a signup happens to occur while the app is being served from quotecode.vercel.app.

3. loadData() and fetchSettings() both gained a third userMetadata parameter, threaded from the two existing call sites (initAuth's session.user.user_metadata; the onAuthStateChange SIGNED_IN handler's newSession.user.user_metadata) - no new call sites, no other function signature changed.

4. fetchSettings()'s existing missing-profile branch now checks userMetadata?.signup_market first (validated to be exactly 'Local' or 'International', rejecting any other value) and calls createNewBusinessSettings() with it directly; only when that value is absent/invalid does it fall through to the existing, completely unmodified fresh-geo-then-explicit-choice fallback chain.

Explicitly NOT changed: createNewBusinessSettings() itself (zero edits - country/currency/plan/trial logic identical to before); the existing-row branch of fetchSettings() (an account with a pre-existing business_settings row is structurally never routed through the branch that was edited, so Tier-1 existing-profile authority required no new guard - it was already guaranteed by the pre-existing if (data) {...} else {...} structure, unchanged); AppLocal.jsx/AppGlobal.jsx (both already passed bundleIsHebrew; nothing needed to change there); every other file named as not-authorized in this task (Edge Functions, middleware.ts, LandingLocal/LandingGlobal, public quote components, Admin UI, RLS, Supabase configuration, .env).

Verification performed, all this session: full diff of src/pages/Dashboard.jsx read and reviewed line-by-line. npx eslint src/pages/Dashboard.jsx - 0 errors, 1 warning (react-hooks/exhaustive-deps on an unrelated useEffect) - confirmed via git stash/pop to be byte-identical to the pre-edit file's own eslint output, i.e. pre-existing, not introduced by this change. npm run build - succeeded, only pre-existing unrelated warnings (chunk size, a dynamic-vs-static import note for shared/supabase.js, neither related to this change). npm run test - 21/21 passing, matching the documented baseline exactly. git status --short after implementation - exactly M src/pages/Dashboard.jsx, no other file.

Bilateral regression reasoning (not live-tested, reasoned from the code as changed):

Case A, Local signup: bundleIsHebrew=true at signup -> signup_market='Local' in metadata -> confirmation redirects to /dashboard -> on first session with no existing row, fetchSettings reads signup_market='Local' -> createNewBusinessSettings(..., 'Local') -> unchanged existing logic produces country='Local', currency='ILS', Hebrew default terms, exactly as before this fix for a working Local signup.

Case B, International signup: symmetric, bundleIsHebrew=false -> signup_market='International' -> country='International', currency='USD' (unchanged existing default - createNewBusinessSettings itself was not touched, so its existing International default-currency behavior is unchanged).

Case C/D, existing Local/International accounts: the entire signup_market-consuming code path is inside the else branch of if (data) {...} else {...} in fetchSettings - an account with an existing row always takes the if (data) branch, which was not edited at all in this change. No overwrite path exists.

Case E, legacy account with no signup_market and no business_settings (e.g. the preserved TEST International reproduction account itself, whose Auth user was created before this fix existed): userMetadata?.signup_market is undefined for such an account, so the new check is skipped entirely and the pre-existing fresh-geo-then-explicit-choice fallback runs exactly as it did before this change - fully preserved, not removed, not altered.

Currency/quote-history architecture: not touched in any way. createNewBusinessSettings(), quote.currency handling, handleEditClick's currency-preservation logic, and the quote-immutability system (§17.A) were not read for modification and were not edited - confirmed by the diff containing zero lines outside the four locations listed above.

Explicitly deferred, not performed in this task: no live signup was attempted; the preserved International TEST reproduction account (Auth confirmed, business_settings missing) was not touched, read from, or repaired; no commit, push, or deploy occurred.

Follow-up hardening, same phase, working-tree only: a dedicated read-only audit enumerated every <Dashboard ...> render site in the repository - exactly three: AppLocal.jsx (bundleIsHebrew={true}), AppGlobal.jsx (bundleIsHebrew={false}), and App.jsx (no prop at all). App.jsx was confirmed dead code - a repo-wide grep found zero imports of it anywhere, and main.jsx (the real React root) only ever renders AppLocal/AppGlobal, never App. Since both live-reachable call sites always supply a real boolean, the isHebrew fallback in the signUp() market selection could never execute on any live path today, but represented an avoidable latent risk for any future caller that forgot to pass bundleIsHebrew. The fallback was removed and replaced with fail-closed behavior: if bundleIsHebrew is not a boolean at signup time, signUp() is never invoked, no market is guessed from isHebrew/bizCountry/localStorage/URL/browser-language/geo, and a generic configuration-error message is shown via the existing setAuthError mechanism instead (that message's own display language still reads isHebrew, which is purely cosmetic UI-text selection, not a signup_market derivation - the two are not the same thing). Re-verified after this change: eslint 0 errors/1 pre-existing warning, npm run build success, npm run test 21/21 passing, git status showing only Dashboard.jsx as an application-file change.

Status: IMPLEMENTED IN WORKING TREE / NOT COMMITTED / NOT DEPLOYED / NOT LIVE-TESTED. This must not be described as live, deployed, or verified-in-production until each of those steps is separately performed and separately authorized.

18.AE Signup-market fix - Live functional verification Phases 1 and 2 - INTERNATIONAL NEW-SIGNUP PATH LIVE VERIFIED; LOCAL NOT YET TESTED

Following the authorized commit/push of the signup-market fix (ee4b8a8) and its fail-closed hardening follow-up, two live verification phases were performed this session, using only pre-existing TEST accounts/aliases and read-only/self-authenticated checks - no code, database, Supabase, Auth, or RLS change was made in either phase.

Phase 1 - legacy account (no signup_market), result: country=Local, currency=ILS - explained, not a defect:

The previously-preserved International TEST reproduction account (Auth confirmed, business_settings missing, documented across §18.Y-§18.AD) was logged into normally. Because this account was created before signup_market existed, fetchSettings() correctly found no metadata to consult and fell through to the unchanged, pre-existing geo-fallback tier (fetchFreshGeoCountry() -> /api/geo). That live lookup, for this QA environment's actual network path to Vercel's edge, returned IL. The resulting business_settings row was created with country=Local, currency=ILS, business_name defaulted to the Hebrew "עסק חדש" - confirmed via a safe, self-authenticated RLS-scoped read of the account's own row (never any other account). This is explicitly NOT a signup_market defect - that code path never activated for this account at all, since it has no metadata; it is the exact same fallback behavior this project already had before the fix, now simply observed to resolve to IL because of this QA environment's own apparent geolocation. This account's business_settings row now exists permanently in this state and was left untouched, not repaired, per explicit instruction.

Phase 2 - fresh new signup (has signup_market), result: country=International, currency=USD - the core assertion, proven:

A brand-new Gmail plus-address alias of the same TEST mailbox (never previously registered in ProFlow/Supabase) was used to perform one complete, real International signup through the actual /en UI: International bundle confirmed (lang=en, dir=ltr) before signup: Sign Up submitted, Auth user created, "Sign up successful" shown, no premature session (email confirmation required, as expected). The project owner then manually received and clicked the real Verify Email link from Gmail, confirming it landed on the canonical quotecodepro.com domain (not quotecode.vercel.app). A normal login was then performed live through the QA browser, triggering the real first-authenticated-session bootstrap.

Read directly, self-authenticated, RLS-scoped, no other account touched:

auth session's own user_metadata.signup_market = "International" (read from the session's own JWT payload - confirms the value was correctly captured and persisted at signUp() time, exactly as designed).

business_settings row created by the application: country="International", currency="USD", email and user_id both matching the signed-up account exactly, plan="pro", trial_ends_at ~14 days out, business_name="New Business" (the English default, consistent with country=International), role="user".

UI confirmed English/LTR (document.documentElement.lang='en', dir='ltr'); confirmed zero Hebrew characters and zero ₪ symbols anywhere on the rendered page (both checked programmatically, not just visually). Dashboard loaded successfully - "Logged in successfully" banner, normal empty-account UI (0 quotes, $0.00), no runtime or visible errors.

This directly and completely proves the core assertion this fix exists for: International bundle -> signup_market=International captured at signup -> real email confirmation -> canonical /dashboard redirect -> missing-profile bootstrap -> signup_market wins over Geo -> country=International - even though this exact QA environment's live Geo independently resolves to IL, as directly demonstrated by Phase 1 on the identical network.

Status: INTERNATIONAL NEW-SIGNUP PATH - LIVE FUNCTIONALLY VERIFIED. LOCAL NEW-SIGNUP PATH - NOT YET TESTED. Do not describe the complete bilateral Local+International fix as fully verified until a fresh Local new-signup live test is separately performed and separately authorized - explicitly not done in this entry.

No repair, deletion, or recreation was performed on either TEST account. No other account/production data was accessed or modified. No commit, push, or deploy occurred in either phase - both were read/verify-only against already-committed, already-pushed code.

18.AF Signup-market fix - Live functional verification Phase 3 (Local) - BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION LIVE VERIFIED

Following Phase 2 (§18.AE, International path LIVE VERIFIED), a third live verification phase was performed to test the Local path and complete bilateral verification. As with Phase 2, no code, database, Supabase, Auth, or RLS change was made - read/verify only, against already-committed, already-pushed code (ee4b8a8).

A fresh Gmail plus-address alias of the same TEST mailbox (nimrod1sinai+local2@gmail.com, never previously registered) was used to perform one complete, real Local signup through the actual /he UI: Hebrew/RTL confirmed (document.documentElement.lang='he', dir='rtl') before signup; Sign Up submitted, Auth user created, no premature session (email confirmation required, as expected, matching Phase 2's pattern exactly). The project owner received the real confirmation email at 18:10, addressed exactly to nimrod1sinai+local2@gmail.com, and clicked it once.

Test-contamination correction, recorded explicitly: the browser used for that first confirmation click already had a prior +intl2 (International) session active, so the screen shown immediately after that click was correctly identified as unreliable evidence of which account was actually authenticated - UI language alone must never be used as account identity evidence, since a stale session or cached state can render either language regardless of which account is truly active. This was explicitly not treated as a failure; it was re-verified cleanly instead.

Clean re-verification, performed this session: confirmed no residual Supabase session token existed in the browser (a genuinely clean auth context, not merely a different-looking screen) before signing in explicitly with the +local2 email and its already-established password. After login, identity was verified from the authoritative session/DB source, never from UI text:

session.user.email = "nimrod1sinai+local2@gmail.com" (exact match).

session.user.id = a UUID distinct from the +intl2 account's own user_id, confirming no cross-contamination between the two new TEST identities.

session.user.user_metadata.signup_market = "Local".

business_settings row (read via a safe, self-authenticated, RLS-scoped fetch under this exact session): country="Local", currency="ILS", user_id and email both matching the authenticated session exactly, business_name="עסק חדש" (Hebrew default, consistent with country=Local), plan="pro", trial_ends_at ~14 days out.

document.documentElement.lang='he', dir='rtl'; confirmed programmatically zero "$" characters and the "₪" symbol present on the page.

This completes bilateral verification of the core assertion: Local bundle -> signup_market=Local captured at signup -> real email confirmation -> canonical /dashboard -> missing-profile bootstrap -> signup_market wins -> country=Local, currency=ILS, Hebrew/RTL - verified independently and cleanly, with no contamination from the separately-verified International path.

Status: LOCAL NEW-SIGNUP PATH - LIVE VERIFIED. INTERNATIONAL NEW-SIGNUP PATH - LIVE VERIFIED (§18.AE). BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION - LIVE VERIFIED. This is the completion of the live-verification work for this fix.

Separate, still-open localization findings, recorded only, explicitly NOT investigated or fixed as part of this work (a future, separately-authorized localization audit is the appropriate venue):

International (+intl2): the post-confirmation/login flow transiently displayed Hebrew loading text ("טוען את המערכת...") before the final English Dashboard rendered; the logout-confirmation dialog and the subsequent login screen after logout were also observed in Hebrew for this International account.

Local (+local2): the confirmation email itself arrived in English; the post-signup success message ("Sign up successful! Initializing user profile with free trial...") displayed in English on the Hebrew signup page. Root cause traced (read-only, not fixed): both are driven by the file's local isHebrew variable (isHebrewEnv(bizCountry, session)), whose bizCountry input falls back to a hardcoded 'International' default whenever localStorage.proflow_cached_country is empty - independent of which bundle (/he vs /en) is actually active. This is unrelated to and unaffected by the signup_market fix itself, which captures market via the separate, reliable bundleIsHebrew route prop, not this isHebrew variable - confirmed by the fact that both Phase 2 and Phase 3's actual signup_market/country/currency results were correct despite these cosmetic language glitches occurring alongside them.

No repair, deletion, or recreation was performed on any TEST account (the Phase-1 legacy account, the Phase-2 +intl2 account, or the Phase-3 +local2 account). No other account/production data was accessed or modified. No commit, push, or deploy occurred in this phase.

18.AG Production routing / locale-selection audit — READ-ONLY, COMPLETE

Purpose: before building the next Owner + ChatGPT Visual Acceptance test, a dedicated read-only audit was run to establish an exact, repo-grounded map of how production actually decides Local vs International / Hebrew vs English / RTL vs LTR / bundle mounting, rather than assuming that manually opening /he or /en represents the real anonymous user entry flow. No code was modified, no browser actions were performed, no TEST account was touched, no Supabase/Auth/DB/config was modified. Full conclusions now live in PROFLOW_PROJECT_CONTEXT.md §31 (durable architecture reference) — summarized here for the operational record:

Entry point: src/main.jsx is the true, running React entry (via index.html -> Vite), selecting and mounting either AppLocal or AppGlobal at the root. src/App.jsx remains confirmed dead code (zero imports anywhere in src/, never mounted) - not the running root.

Anonymous bundle-selection cascade in src/main.jsx, exact priority order confirmed by direct code read (lines 21-41): (1) ?lang=en / ?lang=he query param - highest priority; (2) pathname prefix /en or /he; (3) localStorage.proflow_lang, this browser's saved choice from a prior visit; (4) proflow_geo_country cookie, set by middleware.ts from Vercel's real geo header, root path only; (5) navigator.language, lowest priority fallback. After the decision, localStorage.proflow_lang is unconditionally overwritten with the result on every anonymous visit (main.jsx:44).

Root "/" does NOT redirect to /he or /en. main.jsx mounts AppLocal or AppGlobal in place; the URL stays exactly "/". Both AppLocal.jsx and AppGlobal.jsx also separately register "/" as a route to their own landing page. Confirmed identical logic in main.jsx regardless of prod/dev; the only environment difference is that middleware.ts's Vercel geolocation() only returns real country data in production/edge deployment - in local dev it resolves empty and the cascade falls through to browser language (signal 5).

/he and /en are explicit, intended routes (forced at cascade priority 2, overridable only by priority-1 ?lang=) - not automatic geo-routing evidence. AppLocal.jsx:196-197/214 and AppGlobal.jsx:201-202/222 confirm both the explicit route and the "*" catch-all resolve to the matching bundle's own landing page, no redirect.

/dashboard does not itself encode market. Initial bundle selection uses the identical anonymous cascade as root "/", before any Supabase/account state is known - so a Local-market account can land on /dashboard while the English/LTR AppGlobal shell is briefly mounted (or vice versa), purely based on this browser's cache/geo/language history, independent of the account. Once authenticated and business_settings loads, Dashboard.jsx's own isHebrew = isHebrewEnv(bizCountry, session) (Dashboard.jsx:115) takes over for the account's actual rendered UI - business_settings.country (via fetchSettings, Dashboard.jsx:566) is the sole source of truth there, and currency is derived strictly from country, never from isHebrew (Dashboard.jsx:594-596). The authenticated dashboard body itself is gated behind isInitializing (Dashboard.jsx:2255) so it reliably shows the correct language once rendered; the pre-render loading screen and the bundle's document-level lang/dir (set once at mount, AppLocal.jsx:31-32 / AppGlobal.jsx:36-37) are not corrected the same way - this is the structural basis for Findings A/D/E/H below.

Two distinct Geo mechanisms exist and must never be conflated: (1) anonymous routing geo - middleware.ts, Vercel geolocation(), proflow_geo_country cookie (24h), read by main.jsx at cascade priority 4, for anonymous landing-page bundle selection only; (2) legacy missing-profile bootstrap geo - Dashboard.jsx's fetchSettings() calling api/geo.js, which reads the live x-vercel-ip-country request header directly with no cache/cookie (api/geo.js:10-12, Cache-Control: no-store), used only when an authenticated user has no business_settings row yet AND no valid signup_market metadata is present - a one-time new-account country bootstrap for legacy (pre-signup-market-fix) accounts only, unrelated in code to mechanism (1).

Logout: handleSignOut (Dashboard.jsx:1291-1293) calls only supabase.auth.signOut() - no window.location or router navigation. The user remains on the existing URL (normally /dashboard); once the SIGNED_OUT event fires, session becomes null and Dashboard.jsx's !session branch (line 2255) renders AuthScreen in place, still at /dashboard - never a navigation to /, /he, or /en. The SIGNED_OUT handler (Dashboard.jsx:282-292) clears localStorage.proflow_cached_country and resets bizCountry state to 'International', but does NOT touch localStorage.proflow_lang, which persists unchanged regardless of which account just logged out.

Status: AUDIT COMPLETE, READ-ONLY, NO CODE/DB/CONFIG CHANGE. Conclusions preserved permanently in PROFLOW_PROJECT_CONTEXT.md §31.

18.AH Auth / routing localization — screen-level open findings A-H — OPEN, NOT FIXED

Produced by the same audit as §18.AG. Full condensed table lives in PROFLOW_PROJECT_CONTEXT.md §32; full per-finding narrative preserved here for the operational record. None of these findings reopen or affect the signup-market mechanism (§18.AF) - see the closing note below.

Finding A - International +intl2, transient loading screen shown while isInitializing===true, before the final Dashboard renders. Expected English; observed Hebrew ("טוען את המערכת..."). Mechanism: AuthScreen.jsx computes its own internal isHebrew (lines 34-46) from pathname / ?lang= / localStorage.proflow_lang only - it does not receive isHebrew, bizCountry, session, or bundleIsHebrew as a prop, and never references business_settings.country. Status: OPEN, mechanism identified, not fixed. Evidence: mechanism REPO VERIFIED, occurrence OWNER-OBSERVED. Device dependency: NOT PROVEN (depends on this browser's cache/history, not device identity).

Finding B - International +intl2, fully loaded Dashboard. Expected English/International/non-ILS; observed English/International/USD. Status: PASS, LIVE VERIFIED (part of the already-complete signup-market verification, §18.AE/§18.AF). Must remain distinguished from Finding A - a transient-screen FAIL does not indicate a final-Dashboard FAIL.

Finding C - International +intl2, English Dashboard -> click Sign Out -> SignOutModal confirmation dialog. Expected English; owner observed Hebrew confirmation text. Mechanism: SignOutModal receives isHebrew as a prop from Dashboard.jsx (Dashboard.jsx:2427-2434) - the same bizCountry-derived variable that correctly drives the already-English main Dashboard body, and this modal can only render after isInitializing is false (i.e. after bizCountry is already settled for this account). No repo mechanism was found that explains how this modal's language could diverge from the already-correct dashboard-body language at the point it becomes reachable. Status: OPEN, CAUSE UNKNOWN - requires a future controlled live reproduction with instrumentation (e.g. logging isHebrew at render time). Do NOT invent a root cause. Do NOT mark this fixed. Evidence: OWNER-OBSERVED; mechanism UNKNOWN. Device dependency: UNKNOWN (cannot be assessed without knowing the mechanism).

Finding D - International +intl2, English Dashboard -> Sign Out confirmed -> SIGNED_OUT event -> session null -> AuthScreen renders in place at /dashboard (confirmed no URL navigation, §18.AG). Expected English; observed Hebrew login screen. Mechanism: identical to Finding A - AuthScreen's independent isHebrew (pathname/?lang=/localStorage.proflow_lang) is never reset on logout; Dashboard.jsx's SIGNED_OUT handler clears proflow_cached_country and bizCountry but confirmed NOT to touch proflow_lang. A browser whose proflow_lang is 'he' (e.g. from an earlier /he visit or an IL geo-cookie in that same browser) will show a Hebrew login screen after ANY account logs out, Local or International - fully independent of which account was actually used. Status: OPEN, root mechanism identified via full code trace, not fixed. Evidence: REPO VERIFIED. Device dependency: NOT PROVEN - depends on this specific browser's proflow_lang cache history, not device/OS identity.

Finding E - Local +local2, signup through /he -> immediately after successful signup, before email confirmation/bootstrap. Expected Hebrew; observed English ("Sign up successful! Initializing user profile with free trial..."). Mechanism: Dashboard.jsx:1241 uses isHebrew (bizCountry/session-derived, meant for an existing account's display) instead of bundleIsHebrew (the route prop already established as the sole correct source for signup_market itself two lines earlier, Dashboard.jsx:1232). At signup time no business_settings row exists yet, so bizCountry is either the hard default 'International' (Dashboard.jsx:100-105) or a leftover value cached from a different account previously used in the same browser - independent of which bundle (/he vs /en) is actually being used to sign up. Status: OPEN, root mechanism identified, not fixed. Evidence: REPO VERIFIED.

Finding F - Local +local2, actual ProFlow confirmation email received by the owner at nimrod1sinai+local2@gmail.com. Expected Hebrew; observed English. Source: Supabase Auth's "Confirm signup" email template, confirmed via repo-wide search to NOT exist anywhere in this repository (only unrelated app-level notification edge functions exist: send-quote-email, send-trial-expiration-email, send-subscription-expiration-email, resend-email-webhook) - this template is configured entirely in the Supabase Dashboard (Auth -> Email Templates), outside this codebase. Status: OPEN, not fixed. Evidence: OWNER-OBSERVED - repository cannot independently verify or attribute a source file for the email content itself. Device dependency: NOT INDICATED (server-side email content, unrelated to any client device/browser).

Finding G - Local +local2, fully loaded Dashboard after clean re-authentication. Expected Hebrew + RTL + ILS/₪; observed Hebrew + RTL + ILS/₪. Status: PASS, LIVE VERIFIED (§18.AF). Direct confirmation the signup-market mechanism itself is unaffected by Findings A-F/H.

Finding H - Local +local2, AGENT DESKTOP BROWSER, during the clean Phase-3 verification (explicitly NOT the owner's mobile browser - do not attribute this observation to the owner's device). Immediately after successful login, on an already Hebrew/RTL/₪ Dashboard, the login-success toast/banner read "Logged in successfully" (English) where Hebrew ("התחברת בהצלחה") was expected. Mechanism: Dashboard.jsx:1249 uses isHebrew (bizCountry-derived), evaluated in the same render as the pre-login form - i.e. reflecting bizCountry's value BEFORE this specific login's own fetchSettings call corrects it (Dashboard.jsx:100-105 seeds bizCountry from whatever this browser's proflow_cached_country cache already held, or the hard default 'International', and this is only corrected afterward at Dashboard.jsx:576). Status: OPEN, mechanism identified via code trace (REPO VERIFIED) - the specific claim that proflow_cached_country held a stale non-Local value at that exact historical instant is INFERENCE, not directly proven, because the Phase-3 "clean auth context" check verified only the absence of a residual session token, not this separate localStorage key. Evidence: mechanism REPO VERIFIED, specific trigger INFERENCE. Device dependency: NOT PROVEN - the mechanism is browser-cache-history-dependent, not device-type-dependent.

Closing note for §18.AH: none of Findings A-H reopen, invalidate, or cast doubt on the signup-market preservation mechanism. It remains BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION: LIVE VERIFIED (§18.AF) - International +intl2: signup_market='International', business_settings.country='International', currency='USD', final Dashboard English; Local +local2: signup_market='Local', business_settings.country='Local', currency='ILS', final Dashboard Hebrew/RTL/₪. Findings B and G above are the direct confirmation of this. Every finding above concerns UI text/screens adjacent to the mechanism (loading screens, success toasts, a logout dialog, a confirmation email, a post-logout login screen) - never the signup_market/country/currency values themselves.

18.AI Documentation-only checkpoint for the routing/locale audit — this entry, COMPLETE

This entry itself: a strictly documentation-only task, authorized separately from and after the read-only audit in §18.AG/§18.AH, preserving that audit's already-established, already-classified conclusions into PROFLOW_PROJECT_CONTEXT.md (new §31 Production Routing/Locale Selection Architecture, §32 Auth/Routing Localization Open Screen-Level Findings A-H, §33 Visual Acceptance Test Precision Rule, §34 Documentation Continuity Workflow Rule; §27/§28/§29 updated to reflect current status) and this file (§18.AG-§18.AI). No fact classification was upgraded in the process - REPO VERIFIED / OWNER-OBSERVED / INFERENCE / UNKNOWN labels from the original audit are preserved exactly, Finding C's cause remains explicitly UNKNOWN, and no device dependency is claimed as proven anywhere it wasn't already. No application code was modified. No browser action was performed. No TEST account was touched. No Supabase/Auth/DB/RLS/Vercel/config was modified. No commit, push, or deploy occurred as part of this entry itself - see the session's own commit/push report for the exact authorized persistence step, performed separately.

Also newly recorded as permanent, durable project rules (PROFLOW_PROJECT_CONTEXT.md §33/§34): (1) every future Owner + ChatGPT visual test step must explicitly state its environment (Owner Mobile / Owner Desktop Browser / Agent Desktop Browser / other), exact account, starting session state, starting URL, exact action, exact screen, expected result, what it proves, and what it does not prove - ambiguous instructions like "open Local" or "log in again" are no longer acceptable test steps; (2) a read-only audit must not modify documentation while running, but its material conclusions must be preserved via a separate, explicitly-authorized documentation-only task (like this one) before the project moves to the next implementation/test workstream.

18.AJ PROFLOW_TODO.md established — third primary continuity document, DOCUMENTATION-ONLY, WORKING TREE ONLY / NOT COMMITTED

PROFLOW_TODO.md was created as the project's authoritative living work backlog, completing the permanent 3-file continuity model (PROFLOW_PROJECT_CONTEXT.md = durable truth, PROFLOW_HANDOFF.md = operational checkpoint, PROFLOW_TODO.md = backlog/roadmap) alongside the pre-existing PROFLOW_ARCHITECTURE.md (technical architecture reference). PROFLOW_PROJECT_CONTEXT.md's continuity protocol, document hierarchy (§0.A), and reading order were updated to formally recognize it, and a new §35 (Backlog Continuity Rule) documents the responsibility split and the rule that material backlog/status changes must update PROFLOW_TODO.md rather than duplicating it elsewhere.

The TODO preserves the owner's original 11 work areas with their already-established statuses (item 1 Super Admin UI/Permissions and item 4 Approved-Quote deletion protection - COMPLETE; item 2 AI Chat - main work complete with one open Admin-indicator follow-up; item 5 SEO - code fix complete, Google-side verification required; items 3, 6, 7, 8, 9, 10, 11 - OPEN, each with its required pre-work audit scope preserved exactly as specified), and adds two new items: item 12, Auth/Routing Localization Consistency (OPEN, screen-level Findings A-H referenced from PROFLOW_PROJECT_CONTEXT.md §31-§34 / this file's §18.AG-§18.AI, Finding C's cause explicitly still UNKNOWN, device dependency explicitly still NOT PROVEN, bilateral signup-market preservation explicitly preserved as LIVE VERIFIED and not reopened); and item 13, Owner + ChatGPT Visual Acceptance - Local vs International (READY TO BEGIN / NOT YET COMPLETED, per the §33 precision rule). A recommended execution order and the "ONE SUBJECT AT A TIME" working rule (read-only audit -> owner+ChatGPT review -> explicit approval -> minimal implementation -> verification -> documentation checkpoint -> explicit approval -> commit/push) are recorded in the TODO itself.

Cross-document consistency was verified after all three files were edited: signup-market preservation reads LIVE VERIFIED identically in PROFLOW_PROJECT_CONTEXT.md §26.B/§32.I and PROFLOW_TODO.md item 12; Auth/Localization reads OPEN identically in both; Visual Acceptance reads NOT YET COMPLETED identically in both; Finding C's cause reads UNKNOWN in both; device dependency reads NOT PROVEN in both; no previously-completed TODO item (1, 4) was reopened; no previously-open TODO item was marked complete; PROFLOW_TODO.md contains no architecture content duplicated from PROJECT_CONTEXT, and PROJECT_CONTEXT/HANDOFF contain no duplicated backlog list, only references by item number.

Status: PROFLOW_TODO.md created, PROFLOW_PROJECT_CONTEXT.md and this file updated to integrate it - all three changes exist **only in the working tree as of this entry, NOT committed, NOT pushed**. No application code, Supabase/Auth/DB/RLS, or Vercel/config was touched. No browser action was performed. No TEST account was touched. Current checkpoint: the routing/locale audit (§18.AG-§18.AI) is already committed and pushed (commit d7f3408, verified on origin/main); bilateral signup-market preservation remains LIVE VERIFIED (§18.AF, committed/pushed in ee4b8a8); the TODO system itself is the only uncommitted change as of this entry; Owner + ChatGPT Visual Acceptance (TODO item 13) is the recommended next controlled QA step and has explicitly **not** started under this new formal test plan.

18.AK Auth / Routing Localization — Implementation Phase 1 (known-root-cause UI fixes only) — IMPLEMENTED IN WORKING TREE / NOT COMMITTED / NOT PUSHED / NOT DEPLOYED / NOT LIVE-VERIFIED

Owner-authorized implementation of three known-root-cause UI localization fixes from PROFLOW_PROJECT_CONTEXT.md §32 / this file's §18.AH - explicitly NOT a new architecture audit, and explicitly NOT a reopening of signup-market preservation (§18.AF, unchanged, still BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION: LIVE VERIFIED). Authorized files: src/components/AuthScreen.jsx, src/pages/Dashboard.jsx, plus continuity documentation.

Pre-edit safety check: git status --short showed exactly the two documentation files already in flight from §18.AJ (M PROFLOW_HANDOFF.md, M PROFLOW_PROJECT_CONTEXT.md) plus the untracked PROFLOW_TODO.md - no other application file was already modified, so implementation proceeded.

Fix 1 (AuthScreen language source, targets Findings A and D): AuthScreen.jsx now destructures a new bundleIsHebrew prop. Its isHebrew computation changed from the unconditional independent guess (isHebURL || (!isEnglishEnv && isHebURL), derived from pathname/?lang=/localStorage.proflow_lang only) to typeof bundleIsHebrew === 'boolean' ? bundleIsHebrew : (the same old cascade, preserved only as a fallback for the theoretical case this component is rendered without a real boolean - no live reachable path currently does this, since AuthScreen has exactly one call site, Dashboard.jsx:2257/2258, and Dashboard's own two live call sites, AppLocal.jsx and AppGlobal.jsx, always pass bundleIsHebrew as a real boolean). Dashboard.jsx's <AuthScreen> render was updated to pass bundleIsHebrew={bundleIsHebrew} (Dashboard.jsx:2257-2258). This is the same bundleIsHebrew route-prop already established and live-verified as the sole correct source for signup_market - no new market-selection mechanism was created, and main.jsx's routing cascade was not touched.

Fix 2 (Local post-signup success message, targets Finding E): Dashboard.jsx:1241 changed setAuthSuccess(isHebrew ? ... : 'Sign up successful...') to use bundleIsHebrew instead of isHebrew. This line is only reached after the existing fail-closed check at Dashboard.jsx:1220-1225 already guarantees bundleIsHebrew is a real boolean for a signup to even proceed, so no additional fallback was needed here.

Fix 3 (login-success notification, targets Finding H): Dashboard.jsx:1249 changed setStatusMsg({ text: isHebrew ? 'התחברת בהצלחה' : 'Logged in successfully', ... }) to use bundleIsHebrew instead of isHebrew. No additional fallback needed - the ternary already defaults gracefully to the English branch if bundleIsHebrew were ever undefined (not currently reachable live).

Explicitly out of scope, confirmed untouched: SignOutModal.jsx (Finding C, cause remains UNKNOWN - not guessed at); no Supabase configuration/email-template change (Finding F, external to this repo); no change to main.jsx routing cascade, signup_market capture, business_settings logic, or currency/quote logic; no other AuthScreen.jsx text (e.g. the pre-existing isHebrew-gated error messages at Dashboard.jsx:1192/1204/1221-1223/1236/1239/1247, none of which were in the authorized scope) was touched.

Verification performed: complete diff reviewed for both files (2 files changed - AuthScreen.jsx +7/-1, Dashboard.jsx +3/-2 lines); confirmed AuthScreen.jsx has exactly one call site (Dashboard.jsx) and it now passes bundleIsHebrew explicitly; confirmed AppLocal.jsx passes bundleIsHebrew={true} and AppGlobal.jsx passes bundleIsHebrew={false} to <Dashboard> unchanged; confirmed no signup_market/business_settings/currency/quote logic lines appear in the diff. npx eslint src/components/AuthScreen.jsx src/pages/Dashboard.jsx: 0 errors, 1 pre-existing unrelated warning (react-hooks/exhaustive-deps on an unrelated useEffect, present before this change). npm run build: succeeded (pre-existing bundle-size/dynamic-import warnings only, unrelated). npm run test: 21/21 passing.

Status: IMPLEMENTED IN WORKING TREE ONLY. No git add, no commit, no push, no deploy. No browser action performed - no live/visual verification of this fix has occurred yet. Findings A, D, E, H now read "FIX IMPLEMENTED IN WORKING TREE - verification pending" in PROFLOW_PROJECT_CONTEXT.md §32 and PROFLOW_TODO.md item 12; Findings B and G remain PASS/LIVE VERIFIED, unaffected; Finding C remains OPEN/CAUSE UNKNOWN; Finding F remains OPEN/external to this repo. TODO item 12's top-level status was changed to IMPLEMENTED IN WORKING TREE / VERIFICATION PENDING - explicitly NOT marked complete. Owner + ChatGPT Visual Acceptance (TODO item 13) remains NOT YET COMPLETED and has not started.

18.AL Checkpoint consolidation — TODO priority update + commit/push of approved Auth-Localization Phase 1 + TODO system - COMMITTED + PUSHED

This entry: the owner authorized (1) a documentation-only PROFLOW_TODO.md priority update establishing item 14 (Public Quote + User UI Visual Redesign - Desktop + Mobile, design-first, NOT STARTED), (2) final verification of, and (3) commit + push of, the exact working-tree checkpoint that had accumulated across §18.AG-§18.AK: the routing/locale audit's continuity integration, PROFLOW_TODO.md's creation and integration (§18.AJ), and Auth/Routing Localization Phase 1 (§18.AK).

PROFLOW_TODO.md changes: item 12's status line reworded to STATIC VERIFICATION PASSED / LIVE VISUAL VERIFICATION STILL PENDING (previously a more generic VERIFICATION PENDING) and its A/D/E/H rows reworded to match; item 13 updated from READY TO BEGIN to IN PROGRESS, recording the three Owner-Desktop/clean-incognito/Local-market anonymous-routing PASS results (root "/" auto Local selection; Local Landing->Login Hebrew/RTL; Local Login->Signup Hebrew/RTL) while explicitly stating authenticated Local and any International check remain not covered; new item 14 added (Public Quote + User UI Visual Redesign, sections A Public Quote Desktop+Mobile and B Authenticated User UI Desktop+Mobile, the five-step mandatory design-first rule, and the preserved safety rules - Local/International separation, no business-logic/calculation/schema/currency/permission changes implied, David Aluminum production protection, conservative isolated changes after approval); Current Recommended Execution Order updated to put item 14's design phase first. PROFLOW_PROJECT_CONTEXT.md §28/§29 rewritten to describe the checkpoint being published by this exact commit (Auth-Localization Phase 1 static-verified/live-pending, the three Local anonymous PASS results, item 14 as next primary workstream, design-first requirement, explicit non-authorization of any Public Quote/authenticated-UI code change).

Final application diff review (src/components/AuthScreen.jsx, src/pages/Dashboard.jsx) re-confirmed unchanged from §18.AK: bundleIsHebrew passed to AuthScreen and preferred over the old cascade; signup-success and login-success messages use bundleIsHebrew; signup_market/business_settings/country/currency/quote logic untouched; SignOutModal.jsx untouched; no unrelated application change present. Re-ran npx eslint src/components/AuthScreen.jsx src/pages/Dashboard.jsx (0 errors, 1 pre-existing unrelated warning), npm run build (success), npm run test (21/21 passing) - no new failure. Secret scan of the complete diff across all five files: no passwords/JWTs/API keys/service-role keys/webhook-secret values/private credentials found (the sole pre-existing whsec_ naming-convention reference elsewhere in this file remains outside every diff staged here).

Staged explicitly, one file at a time (git add PROFLOW_HANDOFF.md / PROFLOW_PROJECT_CONTEXT.md / PROFLOW_TODO.md / src/components/AuthScreen.jsx / src/pages/Dashboard.jsx - never git add . / -A / --all), verified exactly five files staged, committed as fix(ui): align auth localization and establish todo, verified the commit's file list matched exactly those five files, pushed to origin/main (no force, no tag, no release, no manual deploy), and verified local HEAD == live origin/main via a live git ls-remote query. Exact resulting commit SHA and remote-verification detail are in this session's own final report - not duplicated here to avoid drift between this file and that report.

Status: CHECKPOINT COMMITTED + PUSHED. No Public Quote or authenticated-UI code was modified. No browser/VPN/TEST-account action was performed. TODO item 12 remains not-complete (static-verified only); item 13 remains not-complete (partial evidence only); item 14 has not started implementation - design-first mockups/approval must come before any code change. Per explicit owner instruction, this session stops after this checkpoint - the next workstream (item 14 design phase) is handled separately by owner + ChatGPT.

18.AM Agent Monitor 10-minute POC + emergency new-chat continuity repair - WORKING TREE ONLY / NOT COMMITTED / NOT PUSHED

Same session as 18.AL, after commit a64fc35. Two further, unrelated things happened, both documentation-only or read-only - no application file was touched by either.

Agent Monitor POC (bounded to 10 minutes, per explicit owner authorization): ListAgents was called (read-only) to check for any visible Remote-Control/session indicator - none directly exposed. One PushNotification call was made with the exact authorized test text ("PROFlow Agent Monitor - test successful"); result was "Not sent - this terminal is active, so your output here already reaches the user; a separate notification would be redundant." This is the tool's own documented dedup behavior, not an error - it means mobile delivery could not be confirmed OR denied from an interactive foreground session, only from a genuinely idle/away state, which could not be simulated here. Per the owner's own instruction not to troubleshoot further within the timebox, this was reported as TIMEBOX-BOUNDED / INCONCLUSIVE and the attempt was stopped - no minimum-viable monitor was built, since delivery itself was unconfirmed.

Immediately after, the same message that authorized returning to "the approved UI work" also asserted, as already-decided fact, detailed visual specifications for a light Super Admin panel, a Public Quote redesign (purple header family, sender logo, single customer signature, always-visible attachments area, etc.), and a Business Owner Dashboard redesign (light visual direction, catalog search field) - describing implementation as "authorized." This was checked against actual evidence before acting: git status --short was clean (no application file modified since a64fc35), and no mockup, design reference, or approval step exists anywhere in this repository's history or this session's own record - the immediately preceding turn had explicitly asked the owner to provide such mockups because none existed, and the owner's own reply ("Approval happened elsewhere - I'll provide it now") had not yet been followed by any actual content when this message arrived. Rather than encode the asserted specifications as verified current state (which would have corrupted exactly the continuity mechanism this repair task itself was about to fix) or silently begin unspecified UI implementation against no real design reference, this was flagged directly to the project owner via AskUserQuestion, and no application code was touched.

Immediately following that, the owner sent the emergency continuity-repair task documented here. Root cause confirmed by direct inspection: PROFLOW_PROJECT_CONTEXT.md's protocol item 17 ("New-Session GitHub Bootstrap Path") listed only three documents (PROJECT_CONTEXT, ARCHITECTURE, HANDOFF) in its read order, omitting PROFLOW_TODO.md entirely - confirmed exactly matching the reported real-world failure (a brand-new AI session, given only the owner's trigger phrase, resumed from a stale historical checkpoint). Separately confirmed: this file's own opening paragraph still read "Last pushed application baseline: 5737626..." with no dominant current-state marker above it, describing a state from long before the signup-market fix, the routing/localization audit, or the TODO system existed.

Fixes applied (working tree only): PROFLOW_PROJECT_CONTEXT.md item 17 rewritten to require all four documents in order (PROJECT_CONTEXT -> ARCHITECTURE -> HANDOFF -> TODO), plus explicit steps to locate the checkpoint, identify the current owner-approved priority, identify the current authorization state, and resume without restarting old work; a new item 17.A documents the exact "ProFlow - תמשיך מהנקודה האחרונה" magic-phrase contract end to end (do not answer from memory, read GitHub in the four-file order, locate checkpoint + priority, prefer newest current state, distinguish committed from uncommitted, return a concise resume report, do not act until the owner confirms). PROFLOW_PROJECT_CONTEXT.md §28's header was strengthened with an explicit date-stamped "OVERRIDES ALL OLDER CHECKPOINT SECTIONS" marker and updated to record the monitor POC result and the flagged mockup/approval discrepancy above, without resolving that discrepancy in either direction. PROFLOW_HANDOFF.md received a new "CURRENT RESUME STATE - READ FIRST" block at the very top of the file (before the old 5737626-baseline opening paragraph, which is now explicitly labeled HISTORICAL in place) summarizing the same current-state facts with each item's evidence classification preserved (signup-market LIVE VERIFIED; routing audit committed; Auth/Localization Phase 1 static-verified/live-pending; the three recorded Visual Acceptance PASS results and nothing beyond them; item 14 explicitly still awaiting mockups; the Agent Monitor POC result; working tree clean before this repair).

Cold-start simulation performed before reporting, using only the resulting four documents as a hypothetical brand-new session would read them: current primary workstream = item 14 design-first visual work is next once its mockup gate is satisfied, alongside completing live verification of the already-implemented Auth/Localization Phase 1 and the rest of Visual Acceptance; most recent owner approval = the signup-market fix and the routing/locale audit (both live-verified/committed) - the Super Admin/Public Quote/Dashboard visual direction is explicitly NOT confirmed-approved; nothing is currently mid-implementation (working tree was clean before this repair, and this repair itself is documentation-only); open side issues = Finding C (cause unknown), Finding F (external email template), the flagged mockup/approval discrepancy, and the Agent Monitor's unconfirmed mobile-delivery path; TODO priority = item 14 pending its design-first gate; exact next safe action = owner + ChatGPT review this repair, then resolve the flagged discrepancy with real mockups if the direction is genuine; not authorized = any UI implementation, any Finding C/F fix, any commit/push of this repair without separate authorization. Given all of this, a cold-start session reading these four documents would not select the old P0.1/Architecture-audit checkpoint as current - the answer to that specific test question is NO, as required.

Status: DOCUMENTATION-ONLY EMERGENCY REPAIR, WORKING TREE ONLY. No application file was modified by the monitor POC, the flagged-discrepancy handling, or this repair. No commit, no push, no deploy. Awaiting owner + ChatGPT review before any commit/push authorization for this repair specifically.

18.AN Business Owner Dashboard visual redesign implemented (14.B) + owner confirmation resolves the flagged mockup/approval discrepancy - WORKING TREE ONLY / NOT COMMITTED / OWNER FINAL VISUAL ACCEPTANCE PENDING

Two sequential events, recorded together for an accurate history since the first was not documented at the time it happened.

Event 1 - Business Owner Dashboard implementation (immediately after §18.AM, undocumented until now): the owner sent a detailed, explicit visual specification for the Business Owner Dashboard only (light interface, near-white background, white cards, sharp/crisp borders, ProFlow purple primary with semantic-only green/red, Quote History as the main working area with a specific field list, a prominent Create New Price Quote CTA, cleaner KPI cards, a more compact hot-quote presentation, a catalog search field beside "Add to Catalog", and a genuinely responsive - not shrunk - mobile Quote History), explicitly excluding Super Admin (regression-verify only, do not redesign) and Public Quote (do not redesign, separate future task) from this specific implementation task, and stating the direction was owner-approved with ChatGPT outside this session. Given this message provided real, substantive spec content (not merely a claim that approval happened, which is what had been correctly declined twice before in §18.AM), implementation proceeded.

Implementation technique: a new additive LIGHT token set (plus a no-glow lightHeadingTextStyle) was added to theme/neonTheme.js - the existing dark NEON export is completely untouched. Each in-scope file's own import was aliased (import { LIGHT as NEON, ... }), a one-line change per file that reskins every existing NEON.xxx reference in that file with zero risk to any handler/state/logic line, verified by diff review showing single-line-only changes for ClientsTab.jsx/FinancesTab.jsx/SettingsTab.jsx/QuoteForm.jsx. Dashboard.jsx itself received the same import alias plus two additional structural style changes (hot-quote card rebuilt from a full-width red banner into a compact left-accented attention card; mobile-bottom-nav background changed from hardcoded black to the light theme) - confirmed by diff review to contain zero handler/state/logic changes. QuotesTab.jsx (Quote History) was rewritten more substantially: light theme plus a genuine mobile card layout, initially implemented as a dual-render-with-CSS-display-toggle (both desktop table and mobile cards always in the DOM, hidden via @media CSS) - this broke QuotesTab.test.jsx (10 of 21 tests failed, getByText ambiguous-match errors) because CSS display:none does not remove elements from the DOM, so every interactive element existed twice. Root-caused and fixed by switching to genuine JS-conditional rendering (window.matchMedia('(max-width: 768px)') state, only one structure ever mounted) - re-ran the full suite, 21/21 passing again. ServicesCatalog.jsx received the same theme alias plus a new client-side catalog search field; audited first and found the catalog data model has only name/price, no description field (the table's "Description" column header is a mislabeled/reused translation string, not a real column) - search implemented against name only, recorded as a finding rather than blocking.

Verification performed: ESLint on all touched files (0 errors, 1 pre-existing unrelated warning), npm run build (succeeds), npm run test (21/21, after the fix above), and full diff review confirming zero application-code changes to AdminUsersTab.jsx (Super Admin) or any Public Quote file (PublicQuote.jsx/PublicQuoteEn.jsx/SmartPublicQuote.jsx/PublicQuoteHeader.jsx) - both confirmed via git status as genuinely untouched, which stands as their functional-regression evidence (unmodified code cannot have regressed). No live/browser interactive testing was performed for any surface - TEST-account/browser use was not re-authorized in that task, and this was stated explicitly rather than implied as complete. No commit, no push, no deploy.

Event 2 - owner confirmation (this task, PROFLOW - CONTINUITY REPAIR - OWNER EVIDENCE CORRECTION): after Event 1's report was returned, the owner + ChatGPT reviewed it and the owner explicitly confirmed that the visual-direction approvals for Super Admin (light direction), Public Quote (Desktop + Mobile), and the Business Owner Dashboard did genuinely occur in a separate owner/ChatGPT conversation and are authoritative owner decisions - explicitly validating the decision made in §18.AM/§18.AL not to have invented or encoded those approvals without evidence at the time. This is a genuine, explicit, post-review owner confirmation - materially different from the earlier unverifiable assertion that was correctly declined - and is now the basis for updating the continuity documents. Corrected per this confirmation: PROFLOW_TODO.md item 14 split into three sub-items (14.A Public Quote - design approved in principle, implementation not started; 14.B Business Owner Dashboard - design approved in principle, implementation done in working tree per Event 1, owner final visual acceptance pending; 14.C Super Admin - light direction approved, implementation not started, regression-verified only) with its Current Recommended Execution Order updated to match. PROFLOW_PROJECT_CONTEXT.md §28/§29 rewritten to replace the now-resolved "flagged discrepancy, do not resolve in either direction" language with the owner's actual confirmation and Event 1's real implementation status, keeping design approval, implementation, and owner final visual acceptance as three explicitly distinct gates per surface (never conflated - 14.B's design+implementation status must never be read as also covering 14.A/14.C, and 14.B's implementation being done must never be read as owner final visual acceptance being complete). PROFLOW_HANDOFF.md's top "CURRENT RESUME STATE" block updated to match (item 14 status, working tree now non-clean with the real file list, not-authorized list corrected to name only what remains genuinely unauthorized).

Cold-start simulation performed before reporting, using only the resulting four documents: (1) current primary workstream = item 14, specifically owner review of the already-implemented 14.B Business Owner Dashboard; (2) visual directions with owner approval = all three (14.A/14.B/14.C), each explicitly a design-only approval, never implying functional/business-logic authorization; (3) UI implementation currently authorized/done = 14.B only, in the working tree, not committed; (4) pending owner final visual acceptance = 14.B's already-implemented result; 14.A and 14.C have nothing implemented yet to accept; (5) Agent Monitor status unchanged from §18.AM - POC inconclusive, no implementation; (6) an implementation question is recorded, blocks only that sub-item, and work continues on the next independent item (demonstrated twice in Event 1: the missing description field, and the initial dual-render test failure - both fixed/recorded without stopping the rest of the work); (7) not authorized = 14.A/14.C implementation, commit/push/deploy of 14.B, any fix for Finding C/F, any Super Admin/Public Quote code change; (8) the old P0.1/Architecture-audit checkpoint would not be selected as current - NO; (9) a cold-start session would not ask the owner to recreate the already-approved Business Owner Dashboard mockup/design, since the documents now record that approval as an owner-confirmed fact, not an open question - NO.

Status: DOCUMENTATION CORRECTION COMPLETE. Application files are unchanged by this correction task itself (Event 2) - they still hold exactly Event 1's implementation, unmodified. No commit, no push, no deploy of anything in this entry.

18.AO Business Owner Dashboard - Phase 2 live visual + functional regression verification - LIVE VERIFIED (Desktop+Mobile, Local+International) / Super Admin BLOCKED / two real issues found and fixed

Live QA performed against the local Vite dev server (npm run dev --port 5183 --strictPort) serving the exact uncommitted working-tree code from Event 1 (§18.AN) - production/quotecode.vercel.app were never touched, since those still run the old committed code and would not reflect any of this work. Browser-harness used throughout; CDP Emulation.setDeviceMetricsOverride used for viewport/mobile simulation.

Business Owner Dashboard - Local (PROFLOW_TEST_USER1): logged in live, real account with 6 existing quotes and a 2-item catalog. Desktop screenshot-verified: header, nav tabs, KPI cards (green/purple accents), hot-quote compact card, Create New Quote CTA, Quote History table (purple quote numbers, semantic status badges, before-VAT secondary line), catalog with search field visible beside Add to Catalog, floating AI Chat button - all light-themed correctly, Hebrew/RTL, login-success message correctly Hebrew ("התחברת בהצלחה", confirming the Phase 1 Auth-Localization fix live). Interactively verified: search filter (typed client name substring, row count changed correctly), sort-by-amount (ascending order confirmed against real values), status filter dropdown (approved filter returned exactly the one approved quote), actions dropdown menu (opened via real click, screenshot-confirmed all six actions present with correct semantic colors: view/edit/duplicate/whatsapp/email/delete), View Quote (opened the real public-quote link, used to also verify Public Quote regression - see below), catalog Edit-then-Cancel (inline edit mode activated with 2 inputs + Save/Cancel buttons, cancelled safely, data confirmed unchanged - no destructive test performed).

Catalog search - live-tested directly: typing "20" immediately filtered a 2-item catalog to the 1 matching item (real-time, no submit needed); clearing the field restored both items; a deliberately non-matching term produced the distinct "No catalog items match your search" message (not the generic empty-catalog message); Hebrew item names ("מסך 20 אינץ'" etc.) matched correctly. Confirms the catalog data model genuinely has no description field (audited in Event 1, re-confirmed live) - search remains name-only by design, not a shortcut.

Mobile responsiveness - matchMedia bug found and fixed: fresh page load at 390x844 (mobile) correctly rendered Quote History as cards (table count dropped from 2 to 1, screenshot-confirmed: header/nav/KPIs/hot-quote/history all reflow correctly, bottom nav bar correctly light instead of the old hardcoded black). However, resizing an already-loaded page from mobile to desktop and back via CDP viewport override did NOT correctly switch structures even though a freshly-evaluated window.matchMedia('(max-width: 768px)').matches correctly reflected the new width - the existing MediaQueryList 'change' event listener was not firing reliably for this trigger path. Root-caused and fixed with the smallest safe method per the task's own explicit authorization: added a redundant native window 'resize' event listener in QuotesTab.jsx that re-evaluates the same matchMedia query (both listeners call the same recompute function; cleanup on unmount preserved). Re-verified after the fix: mobile-to-desktop and desktop-to-mobile both now switch structure correctly without a page reload. No unrelated UI was touched to make this fix.

Business Owner Dashboard - International (nimrod1sinai+intl2@gmail.com, the alias account already live-verified as genuinely International market in the original signup-market work): fully English/LTR, "$0.00", all labels/headers/buttons/empty-states in English, zero Hebrew, zero ₪ - screenshot-confirmed. Separately, logging into the BASE PROFLOW_TEST_INTL account itself initially showed an all-Hebrew dashboard body despite lang=en/dir=ltr being correct - investigated via a self-authenticated RLS-scoped REST read of business_settings (own account only) and confirmed country='Local'/currency='ILS' is genuinely what is stored for that specific account. This is not a new bug: it is the exact same Phase-1 legacy geo-fallback data state already documented in §26.B/§18.AE of this file months earlier (this account predates signup_market and its business_settings was created by the old geo-fallback, which resolved to IL on this network) - explained, not repaired, exactly as previously instructed, and unrelated to today's Dashboard visual work (isHebrew's bizCountry-driven computation was not touched by the redesign, only its color-token consumption was).

Public Quote regression - verified via the real "View Quote" link from a live quote (window.open captured and navigated to directly): quote loaded correctly, sender info (business name/phone/email/address) correct, recipient info correct, item rows correct, discount/subtotal/VAT(18%)/total all correct and internally consistent, currency (₪) correct, terms and conditions section correct, additional notes correct. An "Admin view: signature area shown to customer only" placeholder was shown instead of the real signature pad, because the viewer (business owner, still logged in) is the quote's own owner - existing, correct, unchanged behavior. Attachments section: NOT TESTED - this specific quote has none, and no attachment-bearing quote was identified within the time available; NOT a failure, simply not exercised. Actual sign/approve action: NOT TESTED, deliberately - signing a quote is an irreversible one-way state change (locks the quote per the immutability protection, §17.A) and the task explicitly said not to modify data merely to test; recorded as BLOCKED (by design, to avoid an unwanted destructive side effect on real TEST-account history) rather than skipped silently. No Public Quote source file was touched - this stands as additional live confirmation alongside the code-level "untouched" evidence from Event 1.

Super Admin - BLOCKED, no live verification performed: the browser-harness command to fill and submit the PROFLOW_TEST_ADMIN login form was denied by the Claude Code auto-mode permission classifier (reason given: "Blocked by classifier"). Per the harness's own explicit instruction not to attempt to work around a denial, no retry, rephrasing, or alternate-tool attempt was made. This is recorded as BLOCKED, not as a PASS, not as "untouched code = safe," and not silently dropped - per the task's own explicit correction that "file was not modified" is not equivalent to "functional regression PASS." AdminUsersTab.jsx remains confirmed unmodified (code-level evidence only, no live functional exercise of Super Admin in this round).

Modal visual-consistency correction: the prior report's "several Dashboard modals remain dark" finding was broader than reality. Checked which modal files actually import the dark NEON theme: only UserDetailsModal.jsx (Super Admin scope, correctly untouched) and DeleteConfirmModal.jsx did. SignOutModal.jsx, EditClientModal.jsx, EditExpenseModal.jsx, EmailConfirmModal.jsx, LifetimeConfirmModal.jsx, PricingModal.jsx, and AccessibilityModal.jsx never used NEON tokens at all - they were already hardcoded white/light, confirmed live by screenshot for SignOutModal.jsx (shown during the live logout flow). DeleteConfirmModal.jsx was fixed: its import aliased to LIGHT, and its one dark-bound helper-function button (neonGhostButtonStyle, which reads the real dark NEON internally regardless of the caller's own aliased import) replaced with an equivalent inline light-styled button.

Verification after live QA: npx eslint on all touched files (0 errors, 1 pre-existing unrelated warning), npm run build (succeeds), npm run test (21/21 passing). Dev server stopped after testing completed.

Files additionally modified during Phase 2 (beyond Event 1's list): src/components/QuotesTab.jsx (resize-reactivity fix), src/components/DeleteConfirmModal.jsx (theme fix).

Status: LIVE VERIFICATION COMPLETE for Business Owner Dashboard (Desktop+Mobile, Local+International) and Public Quote regression (partial - core rendering verified, attachments/signing not exercised, both explicitly recorded rather than assumed). Super Admin regression remains BLOCKED, not yet performed. No commit, no push, no deploy. TODO item 14.B's implementation is now LIVE VERIFIED in addition to statically verified, but OWNER FINAL VISUAL ACCEPTANCE remains pending - Claude's own live verification does not substitute for the owner's sign-off.

18.AP Business Owner Dashboard first implementation - OWNER VISUAL REVIEW REJECTED - documentation-only correction + commit/push checkpoint

The owner reviewed the first 14.B implementation (§18.AN/§18.AO - completed, statically verified, and live-verified by Claude against a local dev server) and rejected it for final visual acceptance: it was primarily a light reskin of the old layout rather than the approved redesign. This is a genuine owner rejection, not a Claude-side finding - recorded exactly as stated, without reinterpreting what "changes required" means until the owner/ChatGPT provide concrete direction.

Corrected per this rejection: PROFLOW_TODO.md item 14.B's status fields split explicitly into FIRST IMPLEMENTATION (completed/live-verified - true, unchanged) vs CURRENT RESULT (CHANGES REQUIRED - new) vs NEXT IMPLEMENTATION (authorized, pending concrete direction) vs OWNER FINAL VISUAL ACCEPTANCE (still pending - the rejected pass does not count toward it) vs COMMIT/PUSH/DEPLOY OF UI (explicitly NOT authorized). PROFLOW_PROJECT_CONTEXT.md's §28 checkpoint updated to match, with an explicit instruction not to describe the first implementation as owner-approved anywhere in these documents. The technical detail of what was built and live-tested in the first pass (theme infrastructure, files touched, the two real bugs found and fixed during Phase 2 live QA, the modal-consistency correction, Super Admin live testing remaining BLOCKED) is preserved as historical/technical record - none of that detail is false, only its acceptance status changed.

This entry itself is documentation-only, authorized for commit + push separately from the application/UI code, which remains uncommitted in the working tree exactly as the first implementation left it (§18.AN/§18.AO) - explicitly NOT reverted, reset, stashed, or touched by this correction, since the owner has not withdrawn authorization for a next implementation pass, only rejected the first one's visual result. Per explicit owner instruction, this checkpoint's commit/push is scoped to exactly PROFLOW_ARCHITECTURE.md/PROFLOW_HANDOFF.md/PROFLOW_PROJECT_CONTEXT.md/PROFLOW_TODO.md - no src/ file is part of this commit. Exact commit SHA and push verification are in this session's own final report, not duplicated here to avoid drift.

Status: DOCUMENTATION CORRECTION COMPLETE, COMMIT+PUSH AUTHORIZED FOR THIS ENTRY'S FOUR FILES ONLY. Application/UI working tree deliberately left exactly as-is. Per explicit owner instruction, do NOT begin a next UI implementation pass until the owner + ChatGPT provide concrete "changes required" direction after this report.

18.AQ Overnight owner-authorized UI implementation — 14.B reworked (genuine redesign, not reskin), 14.A implemented, 14.C partial — WORKING TREE ONLY, Super Admin live testing BLOCKED

Owner rejected the first 14.B implementation (§18.AN/§18.AO) as "primarily a light reskin of the old layout" and explicitly authorized continuing autonomously overnight on all three approved UI surfaces (14.A Public Quote, 14.B Business Owner Dashboard, 14.C Super Admin), with an explicit instruction that composition/hierarchy/spacing/grouping may and should be restructured, not merely recolored, and a separate mid-task clarification that Super Admin (14.C) is not optional and must not be deprioritized even under time pressure.

14.B rework (src/pages/Dashboard.jsx): the header changed from a white bordered bar to a full-bleed purple gradient band (LIGHT.gradient), with the ProFlowLogo's default white "Pro" text now correctly contrasting against it (previously low-contrast on the white header - confirmed via ProFlowLogo.jsx's darkText prop, default false = white "Pro", which only makes sense on a colored/dark background) and action/profile controls restyled to translucent white-on-purple. The tab row was converted from five individually-bordered buttons into a single segmented pill-track container (data-driven map over {key, icon, label}, active tab a filled purple pill) - genuine compositional change, and incidentally a cleaner implementation (no behavior change: same setActiveTab/setIsCreatingQuote/setEditingQuoteId calls, confirmed by diff and by live re-test of Clients/Settings tab switching after the refactor). KPI cards and the hot-quote alert were unified from a separate 2-card grid plus a detached alert strip into one icon-badge card row (circular icon chips in a shared visual language) - hot-quote card no longer looks like an unrelated warning banner. Live-verified: Desktop and Mobile screenshots taken (Local TEST_USER1 account, real data - 6 quotes, real KPI figures); tab-switch functional re-test passed.

14.A implementation (src/pages/PublicQuote.jsx, src/pages/PublicQuoteEn.jsx, src/components/PublicQuoteHeader.jsx - the header component is shared by both markets, so editing it once covered both): header rebuilt as a purple gradient band with the sender logo on a white plate and a new "חייג/י אליי"/"Call me" CTA (tel: link; the phone number itself is never rendered as the button's own label text, only used as the href target - it is still shown separately as informational text below, unchanged from before). Recipient/client info card given a purple left-accent border and a person icon for genuine emphasis. Attachments section changed from conditionally-hidden-when-empty to always-rendered, with an explicit empty-state message in each market's own language ("אין קובץ מצורף להצעה זו" / "No attachment included with this quote.") - this was a real, deliberate gap closed, not cosmetic. Totals strengthened (larger, purple total figure). The pre-approval "Approve & Sign" button changed from flat green to the purple gradient (green is now reserved for the post-approval confirmed state only, matching the "green = semantic success only" rule) - the already-approved green confirmation banner itself was left unchanged, since that IS the correct semantic-success case. Mobile padding made responsive via a small @media block. Live-verified: Desktop and Mobile screenshots taken for the Local page via a real existing quote's public link (same quote used in Phase 2's regression check) - confirmed the header, call CTA, recipient card, item table, empty-attachments message, and totals all render correctly in both viewports. The English/International page received the equivalent changes by direct code mirroring (same structure, translated strings) but was not itself live-clicked-through in the browser this session - recorded as not live-tested, not claimed as verified. Signing a real quote and attachment-link clicking were deliberately not exercised, to avoid an irreversible lock on TEST data, consistent with the same reasoning used in the Phase 2 report.

14.C partial (src/components/AdminUsersTab.jsx): theme aliased to LIGHT (same technique as every other file this project has touched today; confirmed no dark-theme-bound helper functions like neonGhostButtonStyle are used in this file, so the alias alone is sufficient for full-file color correctness); a module title bar (icon + "User & Business Management"/"ניהול משתמשים ועסקים" heading) added above the existing KPI-card row, which already used an icon-badge pattern before today and now simply renders in the light palette. Given the file's size (1049 lines) and the explicit instruction to preserve all existing complexity/functionality of "the complex Super Admin interface," this pass deliberately did not attempt the same depth of structural rework applied to 14.B's shell (e.g. the management table and its existing CSS-only desktop-table/mobile-accordion split, which already existed before today and was left untouched rather than risked). This is recorded honestly as a partial pass, not claimed as equivalent to 14.A/14.B's depth of redesign.

Super Admin live verification - BLOCKED, not worked around: the browser-harness command to fill and submit the PROFLOW_TEST_ADMIN login form was denied again by the Claude Code auto-mode permission classifier, identically to the Phase 2 attempt (§18.AO). Per the harness's own explicit instruction not to attempt to work around a denial, no retry, rephrasing, or alternate-tool attempt was made, even though the owner's own instruction this session explicitly said Super Admin must not be deprioritized - the two instructions do not actually conflict: "do not deprioritize" was honored (14.C received real implementation work and is recorded as PARTIAL, not skipped), while the classifier denial is a hard tool-level block on the specific live-login verification step, not a scope decision Claude made. AdminUsersTab.jsx's changes are therefore verified at the code level only (ESLint clean, build succeeds) - not live-verified in a browser this session.

Verification after this pass: npx eslint across all 13 touched files (0 errors, 1 pre-existing unrelated warning in Dashboard.jsx), npm run build (succeeds), npm run test (21/21 passing).

Files touched this session (all working-tree only, none committed): src/pages/Dashboard.jsx, src/pages/PublicQuote.jsx, src/pages/PublicQuoteEn.jsx, src/components/PublicQuoteHeader.jsx, src/components/AdminUsersTab.jsx, plus the already-light-themed src/components/QuotesTab.jsx, ServicesCatalog.jsx, ClientsTab.jsx, FinancesTab.jsx, SettingsTab.jsx, QuoteForm.jsx, DeleteConfirmModal.jsx, src/theme/neonTheme.js carried over unchanged from Phase 1/2.

Status: WORKING TREE ONLY. No commit, no push, no deploy. No Supabase/Auth/DB/RLS/email-template change. No production touched - all verification was against the local dev server (uncommitted code) using existing TEST accounts; no real customer/production data was modified (no quote was actually signed, no attachment link was actually exercised, no admin destructive action was attempted). TODO item 14's three sub-items (14.A/14.B/14.C) updated with the truthful current state of this pass, including 14.C's explicit BLOCKED live-verification status and the two consolidated owner questions (deeper Super Admin redesign scope; whether to unblock the classifier for a future admin-login verification attempt). Owner + ChatGPT final visual acceptance remains pending for all three surfaces.

18.AR Business Owner Dashboard - THIRD implementation pass (strict visual-match instruction), Desktop only - second pass OWNER-REJECTED, this pass not yet reviewed

Between §18.AQ and this entry, the owner reviewed the second-pass Dashboard implementation and rejected it again: "colors/header changed, but the page still retained too much of the old Dashboard composition." The owner then gave a much more detailed structural specification (header/logo-container/status-strip/nav/KPI/hot-quote/quote-history/catalog composition) and explicitly authorized a third pass, scoped to Desktop only this time - Mobile redesign explicitly deferred to a later pass, Public Quote and Super Admin explicitly out of scope for this task.

Important limitation stated up front to the owner before implementing, and repeated here for the record: Claude has still never been shown the actual approved mockup image in any of the three passes - only increasingly detailed textual descriptions. This pass was implemented in good faith against that text description, with real structural effort, but "does localhost match the mockup" can only actually be judged by the owner comparing localhost against the real mockup image directly - Claude explicitly cannot self-certify that comparison and did not claim to.

Changes made (src/pages/Dashboard.jsx only, Desktop-scoped per the task's own instruction):

Header identity: the ProFlow brand logo was removed from the Dashboard header entirely and replaced with the business's own identity, per explicit owner requirement ("this Dashboard belongs visually to the business using it"). bizLogoUrl (already loaded from business_settings.logo_url but previously never displayed in the header - only used for the Settings-tab upload UI and quote-generation payloads) is now shown, when present, inside a white/neutral rounded container with internal padding, object-fit: contain (preserves aspect ratio, never crops, supports wide/square/tall logos) - never placed directly on the purple background, exactly per the owner's explicit anti-requirement. When no logo exists, the business name (bizName state, already loaded) is shown as clean bold white text instead - the ProFlow logo is never used as this fallback. Live-verified with TEST_USER1 (no logo on file): the header correctly displays the business name "תכשיט אישי" instead of any ProFlow branding.

Primary action separated from navigation: "New Quote" (using the existing, unmodified handleCreateNewQuoteClick) is now a standalone CTA button rendered beside the section-navigation pill track, not blended into it as just another tab - directly addressing "primary action(s), especially New Quote, should have clear visual priority" and "not like the old Dashboard tab-strip appearance." Live-verified: clicking it opens the real quote-creation form (confirmed via its actual field labels appearing - client name/type, email, phone, tax ID, subject, etc.).

Two-column desktop work area: Quote History and the Services Catalog were wrapped in a new CSS grid (.dash-work-grid, single column by default, 2fr/1fr at @media (min-width: 1100px)) so they sit side by side as two distinct working panels on desktop, rather than stacked vertically one after the other - a genuine compositional change addressing "create a clear working area rather than simply stacking the old sections vertically." Below 1100px width and on mobile, it collapses back to a single column automatically via pure CSS (no JS state, no risk of the matchMedia-listener class of bug fixed earlier in QuotesTab.jsx) - sanity-checked at 390px mobile width: loads correctly, single column, nothing visibly broken, catalog search still present and functional.

Container width increased from max-width 1000px to 1280px to give the new two-column layout genuine room rather than feeling cramped - a low-risk value change, not a structural risk.

Functional re-verification performed live (TEST_USER1, Local, Desktop): logged in successfully (Hebrew login-success message confirmed, consistent with the Phase 1 Auth-Localization fix still working); business-name header fallback confirmed; standalone New Quote CTA opens the real form; Clients tab switch still loads real data ("ניהול ספר לקוחות (CRM)... סה"כ 4 לקוחות"); catalog search still filters correctly in its new two-column position (typed "20", filtered 2 items down to 1, matching the exact behavior verified in the earlier Phase 2 pass). Mobile was reloaded and screenshotted only as a sanity check (not a full Mobile acceptance pass, per this task's explicit Desktop-only scope) - loads correctly, grid correctly collapses to one column, new CTA button appears, nothing visibly regressed.

Verification: npx eslint src/pages/Dashboard.jsx (0 errors, 1 pre-existing unrelated warning), npm run build (succeeds), npm run test (21/21 passing).

No BLOCKED or NOT TESTABLE items this pass - CSV export, Quote actions dropdown (view/edit/duplicate/WhatsApp/email/delete), Finances/Settings tab navigation, and AI Chat availability were not individually re-clicked this pass (already verified working in earlier passes and structurally untouched by this pass's changes - only their container's grid position changed, not their own internals) - recorded as not re-exercised rather than silently assumed, consistent with this project's evidence discipline.

Files modified this pass: src/pages/Dashboard.jsx only (128 insertions, 117 deletions per git diff --stat). No other application file touched. No Supabase/Auth/DB/RLS/production change. No commit, no push, no deploy - working tree only, per explicit instruction not to touch the already-pushed documentation checkpoint or publish anything.

Status: THIRD DESKTOP IMPLEMENTATION PASS COMPLETE, WORKING TREE ONLY, OWNER FINAL VISUAL ACCEPTANCE PENDING. Per explicit instruction: do not proceed to Mobile, Public Quote, or Super Admin work until the owner has visually inspected and accepted this Desktop structure in localhost.

18.AS Business Owner Dashboard - FOURTH implementation pass, first time corrected against the ACTUAL mockup image (not a text description) - Desktop only

After §18.AR (third pass, implemented from an unusually detailed text description but still no actual image), the owner provided the real approved Desktop mockup as an image attached directly to the message, with one explicit intentional exception called out (ProFlow branding in the mockup's header must be replaced with business identity, not reproduced literally). This is the first time in this entire workstream that Claude was shown the actual visual reference rather than a textual description of it - every earlier rejection (§18.AN, §18.AO, and implicitly the still-unreviewed §18.AR) happened without Claude ever having seen the real target.

Comparing the third pass's live implementation against the provided image identified three genuine, specific discrepancies (not vague dissatisfaction - concrete, describable differences):

1. Navigation row: the third pass used a shared "pill-track" container (single card background housing all nav buttons). The image shows individual separately-bordered white buttons with no shared background, arranged in a flat row, ending in the purple New Quote CTA. Fixed: removed the shared track container; each nav button (Finances/Clients/Settings, + Admin if Super Admin) now renders as its own bordered card-colored button. Additionally confirmed from the image that the current tab is not shown as a nav item at all (no "Quotes" button visible while already viewing Quotes) - implemented as filtering the current activeTab out of the rendered list, so the user can always navigate back to Quotes from any other tab (functionality preserved) but the button for the current page does not clutter the row (matching the image).

2. KPI card order and icon style: the image shows, left to right, Revenue -> Quotes count -> Hot Quote, with icon badges as white-background/colored-border squares. The third pass had Hot Quote first (leftmost) and used filled colored-tint circular badges. Root cause understood precisely: this app's KPI row is a CSS Grid inside an RTL-directioned container, and RTL grid auto-placement fills the row starting from the physically-rightmost column - so DOM order and screen order are mirrored, not identical. Fixed by reordering the JSX (Hot Quote now last in DOM, Quotes-count second, Revenue first) to produce the correct left-to-right screen order under RTL, and by restyling all three icon badges to bordered-square white boxes instead of filled-tint circles. No KPI calculation or hot-quote logic was touched - purely DOM order and CSS.

3. Two-column work-area orientation - the most significant fix: the image shows Quote History occupying the wider left column and the Catalog occupying the narrower right column. The third pass's implementation, verified by screenshot at the time, actually rendered the opposite (Catalog left, Quote History right), because of the same RTL-grid-mirrors-DOM-order behavior described in point 2, applied to a 2-column grid: with DOM order [QuotesTab, ServicesCatalog] and grid-template-columns: 2fr 1fr, the first-defined (2fr) column sits at the RTL container's inline-start, which is the physical right side - so QuotesTab (first DOM child, 2fr) landed on the right and ServicesCatalog (second child, 1fr) landed on the left, exactly backwards from the image. Fixed by simultaneously (a) swapping DOM order to [ServicesCatalog, QuotesTab] and (b) flipping the column-width definition to 1fr 2fr - under RTL, column 1 (now 1fr, narrow) still sits on the physical right and now correctly receives ServicesCatalog (narrow+right), while column 2 (now 2fr, wide) sits on the physical left and correctly receives QuotesTab (wide+left) - reproducing the image exactly. Deliberately did NOT fix this by overriding the grid wrapper's CSS direction to ltr, which would have been simpler but risked silently altering the internal RTL text-alignment/flex-direction behavior of both QuotesTab.jsx and ServicesCatalog.jsx (neither of which sets its own explicit dir attribute in most of its markup, so they inherit the ambient direction) - the DOM-order-plus-column-width-flip approach achieves the same visual result with zero risk to either component's own already-verified RTL correctness.

Everything else from the third pass (business-identity header with white logo-container/business-name fallback, standalone New Quote CTA button) was already confirmed matching the image and was carried forward unchanged.

Live verification performed against the local dev server (TEST_USER1, Local, Desktop, 1920x1080): screenshot taken and visually compared side-by-side against the provided mockup image - composition, section order, nav-row style, KPI order/style, and the two-column work-area orientation all now match. Functional re-verification after the DOM reorder: New Quote CTA opens the real quote-creation form (confirmed via its actual field labels); catalog search still filters correctly in its new position (typed "20" against a 2-item catalog, correctly filtered to 1 - confirmed by querying the table via its relationship to the search input itself, after an initial test-script mistake queried the wrong table following the DOM reorder, corrected and re-verified). Mobile was reloaded and screenshotted only as a sanity check (not a full Mobile pass, per this task's explicit Desktop-only scope) - loads correctly, nothing visibly broken.

Verification: npx eslint src/pages/Dashboard.jsx (0 errors, 1 pre-existing unrelated warning), npm run build (succeeds), npm run test (21/21 passing).

Recorded, not fixed this pass: the Catalog column, now correctly narrower per the image, causes ServicesCatalog's own internal "Add to Catalog" form (name + price inputs + button) to wrap onto more lines than the image shows, since that component's internal layout was not itself resized for this narrower context - a minor, cosmetic, non-blocking difference, not a functional defect (search field and add-service action both remain fully present and working).

Files modified this pass: src/pages/Dashboard.jsx only. No other application file touched. No Supabase/Auth/DB/RLS/production change. No commit, no push, no deploy - working tree only.

Status: FOURTH DESKTOP IMPLEMENTATION PASS COMPLETE, WORKING TREE ONLY, first pass corrected against the real approved image rather than a text description, OWNER FINAL VISUAL ACCEPTANCE still PENDING - Claude's own side-by-side comparison against the provided image is not a substitute for the owner's sign-off. Per standing instruction: do not proceed to Mobile, Public Quote, or Super Admin work until the owner has visually inspected and accepted this Desktop structure in localhost.

18.AT Current-state documentation checkpoint - 14.B fourth-pass owner review recorded, five next changes documented as approved-but-not-authorized - COMMIT+PUSH AUTHORIZED FOR DOCUMENTATION ONLY

After §18.AS (fourth 14.B pass, first time corrected against the real mockup image), the owner reviewed that pass's localhost result directly. Verdict, recorded verbatim in intent: substantially closer to the approved visual reference, but not finally accepted - five further specific Desktop changes were identified and approved as the next direction, not yet authorized to implement.

This entry is documentation-only, authorized for commit+push separately from any application code, which remains exactly as the fourth pass left it - not touched by this task.

The five owner-approved next changes for 14.B Desktop, recorded precisely for a future implementation task to execute without re-deriving them from a live conversation: (1) Catalog moves out of the main Dashboard view entirely, becoming its own top-navigation tab labeled קטלוג - reusing all existing Catalog functionality (Add/Edit/Delete, prices/data, persistence, search) unchanged, no DB/schema change; (2) Quote History becomes full width once Catalog is removed from the main view, to improve readability/spacing/column widths; (3) remove the duplicate New Quote CTA - keep only the top-level standalone "הצעת מחיר חדשה" button, remove the second "צור הצעת מחיר חדשה" button currently also present inside the Quote History panel itself (CSV/Excel export stays inside Quote History); (4) reduce Quote History row density by roughly 25-35% where safe - less vertical padding/height per row, with safe truncation/ellipsis for long identifiers/customer content rather than letting them force extra row height; (5) resulting target top navigation after this next change: הצעת מחיר חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג. The already-approved header/business-identity rule (logo in a white/neutral container with object-fit:contain and preserved aspect ratio, or business-name text if no logo, ProFlow logo never used as the fallback) is explicitly preserved unchanged - not affected by these five items.

Visual-reference precedence clarified and recorded: the actual mockup image provided before the fourth pass remains the Desktop visual source of truth, except specifically where these five owner decisions supersede it (the image's original single-column-with-narrow-side-Catalog composition is now superseded for the Catalog-placement/Quote-History-width/duplicate-CTA/row-density points - nothing else about the image is superseded).

PROFLOW_PROJECT_CONTEXT.md's §28 checkpoint was substantially rewritten (it had gone stale, still describing the second pass as "not yet reviewed" when in fact a fourth pass had since been implemented and reviewed) - now accurately dated 2026-08-27, correctly distinguishes the four 14.B passes, records the owner's fourth-pass verdict and the five next-change items, and explicitly states 14.A/14.C also remain unreviewed by the owner despite existing working-tree implementation. This file's own top "CURRENT RESUME STATE" block (top of this file) was similarly corrected - it had gone stale referencing commit a64fc35 as the latest pushed state, when 1ca734d (the continuity-bootstrap repair) had since been pushed; now correctly reflects the four-pass 14.B history, the fourth-pass owner verdict, and the five pending next-change items, without re-authorizing anything.

PROFLOW_TODO.md's 14.B section was similarly corrected: the former "third implementation" entry was relabeled precisely as the third of four passes, a new fourth-pass entry was added distinguishing it explicitly as the first pass with real image access, and a new explicit block records the five owner-approved next changes with clear language that implementation of them is not authorized by this checkpoint. The "Current Recommended Execution Order" section was updated to match. 14.A and 14.C sections were verified accurate and left untouched, per explicit instruction not to falsely mark either owner-accepted or to implement/modify them in this task.

Pre-commit safety verified: git status --short before any edit showed exactly the three documentation files already modified from prior tasks (PROFLOW_HANDOFF.md/PROFLOW_PROJECT_CONTEXT.md/PROFLOW_TODO.md) plus the full, unchanged set of application files from the four 14.B passes and the 14.A/14.C work - none of the application files were touched by this task. Secret scan of the complete documentation diff: no passwords, JWTs, API keys, service-role keys, or other credentials found.

Cold-start simulation performed: a fresh session reading only the four continuity documents would conclude - current workstream is item 14 visual redesign; immediate focus is 14.B Desktop; the fourth 14.B pass has been owner-reviewed and found substantially closer but not finally accepted; the exact next authorized-in-direction (not yet authorized-to-start) change is the five-item list above; Mobile redesign has not begun and should not begin yet; 14.A/14.C should not be continued merely because working-tree changes already exist for them, since neither has been owner-reviewed; owner final visual acceptance remains pending for all three surfaces; and all application/UI code remains uncommitted/unpushed/undeployed while this documentation checkpoint itself is being committed and pushed.

Status: DOCUMENTATION CHECKPOINT COMPLETE. Exact commit SHA, push verification, and final git status are in this session's own final report - not duplicated here to avoid drift. Application code untouched by this task. Per explicit owner instruction, implementation of the five 14.B next-change items does NOT begin automatically after this checkpoint - a separate explicit authorization is required first.

18.AU Business Owner Dashboard — 14.B fifth Desktop implementation pass: owner-approved UX correction implementing the five items from §18.AT (Catalog → own tab, Quote History full width, remove duplicate CTA, denser rows, updated nav order) — IMPLEMENTED + LIVE VERIFIED, WORKING TREE ONLY, OWNER FINAL VISUAL ACCEPTANCE PENDING

After §18.AT recorded the owner's five approved next changes (not yet authorized to implement), a separate task explicitly authorized implementing exactly those five, and only those five, on Desktop: (1) move Catalog out of the main Dashboard view into its own top-nav tab; (2) make Quote History full width; (3) remove the duplicate New Quote CTA; (4) reduce Quote History row density ~25-35%; (5) reorder top navigation to הצעת מחיר חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג. No other redesign was attempted this pass, per explicit instruction.

Implementation, by file:

`src/pages/Dashboard.jsx` — added a `catalogNav` translation string and imported the `Package` icon (the same icon `ServicesCatalog.jsx` already uses for its own heading, reused rather than inventing a new one). The desktop nav-button array was reordered from `[main, finances, clients, settings, ...admin]` to `[main, settings, clients, finances, catalog, ...admin]` so that, filtered to exclude whichever tab is active, the remaining buttons render in the RTL container in exactly the owner's approved right-to-left reading order (settings, clients, finances, catalog when on `main`). The two-column `dash-work-grid` wrapper around `ServicesCatalog`+`QuotesTab` was removed entirely (along with its now-dead `.dash-work-grid`/`@media (min-width:1100px)` CSS rule and the RTL-column-order comment explaining the old 1fr/2fr split) — `QuotesTab` now renders alone and takes the full content-column width. A new `{activeTab === 'catalog' && <ServicesCatalog .../>}` block was added (placed after the `finances` block, before the `admin_clients` block), passing through the exact same props `ServicesCatalog` already received in the old two-column layout — it is the same component instance/functionality, not a second implementation. The now-unused `handleCreateNewQuoteClick` prop was removed from the `<QuotesTab .../>` invocation (QuotesTab no longer uses it after its own internal CTA was deleted — see below).

`src/components/QuotesTab.jsx` — removed the internal "צור הצעת מחיר חדשה"/"Create New Quote" button (and its now-unused `handleCreateNewQuoteClick` prop and `Plus` icon import); the CSV/Excel export button was left untouched in the same location. Table density: every table cell's padding (18 occurrences, header `th` and body `td`, desktop table only — the separate mobile card layout was not touched, out of this pass's explicit Desktop-only scope) changed from `8px 6px` to `6px 8px` — a 25% reduction in vertical padding, computed-style-confirmed live (6px top/bottom, was 8px). The client-name and description `td`s additionally received `maxWidth` (200px/260px respectively), `overflow:hidden`, `textOverflow:ellipsis`, `whiteSpace:nowrap`, and a `title` attribute carrying the untruncated value — long content is now visually truncated without being hidden from the user (hover reveals the full value via the native title tooltip, and the existing "View Quote" action in the row's dropdown menu already exposes the full record regardless).

Live verification performed against the local Vite dev server (TEST_USER1, Local, Desktop 1920x953 viewport, browser-harness against the live Supabase backend, session already authenticated from a prior task): confirmed via direct JS assertions plus two screenshots (main Dashboard view, Catalog tab view) — no Catalog panel or heading present anywhere on the main Dashboard view; Quote History table renders at 1250px inside the 1280px main content column (full width); exactly one occurrence of "הצעת מחיר חדשה" in the page and zero occurrences of "צור הצעת מחיר חדשה" (duplicate CTA genuinely gone); clicking the standalone CTA while already on the `main` tab correctly opens the real Quote Form ("יצירת הצעת מחיר חדשה" heading confirmed), and Cancel correctly returns to Quote History; CSV export button still present and unchanged inside Quote History; computed cell padding confirmed 6px/8px (was 8px/6px); client-name/description truncation CSS and `title` attributes confirmed present via computed style; clicking "קטלוג" renders the real `ServicesCatalog` (heading, Add-to-Catalog form, existing 2 items with working Edit/Delete buttons all present) at full 1250px width; Catalog search narrows correctly (typed a specific term, 2 items → 1, mirroring the same test documented in §18.AS); Clients/Finances/Settings tabs were each clicked in turn and each rendered its real content (client list with 4 real/TEST rows; finance totals; business-settings form fields); the AI Chat widget still opens and shows its normal greeting; no `ErrorBoundary`/"Component Loading Error" text appeared at any point across all of the above. Static verification: `npx eslint` on the three changed files — 0 errors, 1 pre-existing unrelated warning (`loadData` missing dependency, present before this pass, not touched); `npm run build` succeeds; `npx vitest run` — 21/21 tests passing (including `QuotesTab.test.jsx`, unaffected by the padding/truncation/CTA-removal changes).

Two items discovered and explicitly NOT fixed this pass, both flagged rather than silently left undocumented:

1. **Pre-existing New-Quote-CTA tab-scoping gap, not introduced by this pass**: the standalone CTA's `onClick={handleCreateNewQuoteClick}` sets `isCreatingQuote` but never calls `setActiveTab('main')`, and the Quote Form only renders under `activeTab === 'main' && showQuoteForm` — so clicking the CTA while on Clients/Finances/Settings/Catalog sets internal state but renders nothing visible. Confirmed via diff review that this exact `onClick` line was unchanged by this pass — the same gap already existed identically for Clients/Finances/Settings in every prior pass, before Catalog existed as a tab at all. This pass only extends an already-existing limitation to a fourth tab; it was not introduced here, and fixing it was not part of the five authorized items, so it was not attempted.
2. **New Mobile-reachability gap for Catalog, a direct side effect of the approved Desktop change, flagged for an explicit owner decision, not resolved**: before this pass, the two-column `dash-work-grid` collapsed to a single stacked column below 1100px width, so Catalog was already visible (just stacked below/above Quote History) on narrow/mobile screens. After this pass, Catalog only renders behind `activeTab === 'catalog'`, and the mobile bottom-nav button row (`.mobile-bottom-nav`, unchanged, untouched this pass) still only has Quotes/Clients/Settings/Finances/New — no Catalog entry. Mobile users currently have no path to Catalog at all. This was left untouched deliberately, per this task's explicit "do NOT touch: Mobile redesign" scope boundary, rather than silently deciding to extend the mobile nav on my own judgment — needs an explicit owner decision (most likely fix: add one more button to the existing mobile bottom-nav array, mirroring the existing Clients/Finances/Settings pattern; alternative: accept the gap until the dedicated 14.B Mobile pass).

Files modified this pass: `src/pages/Dashboard.jsx`, `src/components/QuotesTab.jsx` only. No other application file touched. No Public Quote, Super Admin, Auth, Supabase, DB/schema, RLS, or Local/International business-logic/currency/VAT change of any kind. No commit, no push, no deploy — working tree only, per explicit instruction.

Status: FIFTH DESKTOP IMPLEMENTATION PASS COMPLETE, WORKING TREE ONLY, all five owner-approved items from §18.AT implemented and live-verified, OWNER FINAL VISUAL ACCEPTANCE still PENDING. Per standing instruction: do not proceed further (Mobile, Public Quote, Super Admin, or a sixth Desktop pass) until the owner has visually inspected and accepted this result in localhost.

18.AV Two new PERMANENT ProFlow workflow rules codified — Test-First / Owner-Gated Live Release, and Hebrew RTL / English LTR UI Parity — DOCUMENTATION ONLY, COMMIT+PUSH AUTHORIZED

The owner established two new standing workflow rules that apply to all future ProFlow work, not merely item 14, and do not expire or need to be re-requested. This task was documentation-only - no application code was read, modified, staged, or committed.

Permanent Rule 1 - Test-First / Owner-Gated Live Release: every future change, in any category (UI/UX, frontend logic, backend logic, Auth, Routing, Billing, Supabase, DB/schema, RLS, Edge Functions, email flows/templates, API behavior, automation, configuration, or any other product/system change), must follow: (1) implement in TEST/development first; (2) verify it there; (3) owner personally reviews where relevant; (4) owner gives explicit approval for LIVE; (5) only then may it move/deploy to LIVE/production; (6) after deployment, perform a controlled production smoke check. A TEST pass is explicitly NOT a production approval - code review, lint, build, automated tests, Claude's own verification, another agent's verification, and browser-harness verification all fail to substitute for the owner's explicit LIVE approval. No production-first implementation is permitted without an owner-authorized named emergency exception. A linked unsaved-work/user-safety principle was also recorded: any change able to affect an active user session must consider preservation of unsaved user input in its test/rollout design, and must never introduce forced refresh/reload/session behavior that can silently discard it - explicitly linked to (not a duplicate of) PROFLOW_TODO.md item 15 (Safe Refresh / New Version Notification).

Permanent Rule 2 - Hebrew RTL / English LTR UI Parity: every future UI/UX change applicable to both Local and International must be implemented in both language/direction experiences in the same work pass - Hebrew now / English later is explicitly disallowed, in either direction. Direction is more than CSS: dir=rtl/ltr alone does not prove parity: the actual mirrored visual composition (element order, alignment, icon/control placement - headers, nav, tables, forms, modals, cards, action bars, toolbars, mobile layouts, Public Quote, Business Owner UI, Super Admin, future interfaces) must be checked. A dual-verification rule was also recorded: every relevant UI task's final report must classify Local Hebrew/RTL and International English/LTR separately (PASS/FAIL/BLOCKED/NOT TESTABLE each) - "same code"/"shared component"/"should work" is never sufficient evidence for a PASS on either side; if one side cannot be tested, that must be stated explicitly rather than inferred. Market isolation remains strict throughout: UI parity must never merge or contaminate currency/VAT/signup_market/business_settings.country/locale/market-specific behavior - visual parity and market separation are both mandatory, simultaneously.

Both rules were recorded as new permanent sections in PROFLOW_PROJECT_CONTEXT.md - §36 (Test-First / Owner-Gated Live Release Rule) and §37 (Hebrew RTL / English LTR UI Parity Rule) - following the exact §33-§35 "PERMANENT REQUIREMENT" pattern already established in that file. Minimal, genuine cross-reference pointers (not full-text duplication) were added at §20 (Claude/Coding-Agent Workflow Rules, pointing to §36 as the broader release-lifecycle rule that §20's commit/push-specific points remain a part of), §23 (Local + International Regression Requirement, pointing to §37 as the UI/UX-specific same-pass extension of that section's general bilateral-regression principle), §29 (Next Action, a new numbered item 7 noting both new sections must be read before implementing or deploying anything, without altering any of §29's existing numbered items or their status language), and the Continuity Protocol's "Required Reading Order" item 9 (added §36/§37 to the existing list of permanent-rule sections a new session must understand). This file's own top "CURRENT RESUME STATE" block gained one new bullet, placed first in the "Current material state, at a glance" list, summarizing both rules - no other bullet in that block, including the 14.B narrative, was altered.

PROFLOW_ARCHITECTURE.md was reviewed and found to need no change: it already states its own purpose is technical/product architecture only, and already defers all workflow/authorization/approval questions to PROFLOW_PROJECT_CONTEXT.md (its own four-document hierarchy description, unchanged since an earlier correction this engagement, already says PROFLOW_PROJECT_CONTEXT.md is "Authoritative for anything about current workflow, authorization, or what is/isn't approved") - adding the new rules there would duplicate, not clarify. PROFLOW_TODO.md received one minimal, genuine addition: a short pointer sentence in its "Working Rule - ONE SUBJECT AT A TIME" section, noting that its existing numbered process (READ-ONLY AUDIT -> owner approval -> implementation -> verification -> owner approval -> commit/push) is now also governed by PROFLOW_PROJECT_CONTEXT.md §36/§37 for every backlog item - the existing numbered steps themselves were not rewritten, since they already substantially describe the same sequence and rewriting them would have been an artificial diff.

Explicit discrepancy flagged, not silently resolved: this task's own instructions described the "exact current 14.B Desktop checkpoint to preserve" as including "fifth Desktop pass implemented and reviewed" with three new next-corrections already identified (Quote History header-controls RTL arrangement; New Quote CTA joining the top navigation; Public Quote header compacting). That description goes beyond what is actually recorded in this file's own §18.AU (immediately above) and in PROFLOW_TODO.md's 14.B section as of this task's start, both of which still say the fifth pass was implemented/live-verified in the working tree but NOT yet owner-reviewed. Per this task's own explicit instruction not to change or reopen Item 14 status except to reference the two new permanent rules, this discrepancy was NOT resolved by silently rewriting §18.AU, the top resume block's 14.B bullet, or PROFLOW_TODO.md's 14.B section to add the "reviewed + three corrections" narrative - doing so would itself have been an unauthorized Item 14 status change in a task explicitly scoped to permanent-rules documentation only. The three next-correction items named in this task's own text (Quote History header-controls RTL arrangement, New Quote CTA joining the top navigation, Public Quote header compacting) are recorded here, in this paragraph, purely as a pointer for whichever future task the owner authorizes to perform the actual 14.B checkpoint update - they are not yet reflected as current status anywhere else in any of the four documents. A dedicated checkpoint task should reconcile this explicitly.

Pre-task git safety verified: git status --short before any edit showed exactly the same state as the end of the immediately preceding task - PROFLOW_HANDOFF.md and PROFLOW_TODO.md already modified (from the prior 14.B fifth-pass implementation task, never committed per that task's own explicit "NO commit" instruction) plus the unchanged set of thirteen application files. No application file was read, modified, staged, or committed by this task. Secret scan of the complete documentation diff: no passwords, JWTs, API keys, service-role keys, or other credentials found.

Cold-start simulation performed, per this task's own required questions: (1) can any future change go directly to LIVE after Claude says PASS - answer NO, a TEST pass is never a production approval; (2) required release sequence - TEST/DEV implementation -> verification -> owner review -> explicit owner approval -> LIVE, then a post-deploy smoke check; (3) can Hebrew UI be implemented without matching English UI in the same relevant work pass - answer NO, English/International is never an optional follow-up; (4) does English merely inherit RTL layout with translated text - answer NO, LTR composition must be intentionally verified, direction is more than CSS; (5) does visual parity allow mixing Local/International currencies or market rules - answer NO, market isolation remains strict and mandatory alongside visual parity; (6) who gives final authorization for LIVE - answer: the project owner, exclusively. A fresh session reading PROFLOW_PROJECT_CONTEXT.md §36/§37 in full would answer all six correctly without needing this paragraph restated to it.

Status: PERMANENT RULES CODIFICATION COMPLETE. Exact commit SHA, push verification, and final git status are in this session's own final report - not duplicated here to avoid drift. No application code was read, modified, staged, or committed by this task. The flagged 14.B checkpoint discrepancy above remains open and requires a separate, dedicated checkpoint task - do not silently resolve it by inference in a future session.

NEXT SESSION START — read this before touching anything

0. FIRST read PROFLOW_PROJECT_CONTEXT.md in full (see §18.Z above) - it is the project's persistent operational memory and contains the current exact checkpoint (§28, marked with an explicit "OVERRIDES ALL OLDER CHECKPOINT SECTIONS" header - never select an earlier P0.x/architecture-audit section as current). THEN read PROFLOW_ARCHITECTURE.md in full (see §18.AA above for its current, remediated state) - it is the current technical/product architecture reference. THEN read this entire PROFLOW_HANDOFF.md, starting from the "CURRENT RESUME STATE - READ FIRST" block at the very top of the file, not from the old baseline paragraph that follows it. THEN read PROFLOW_TODO.md in full (see §18.AJ above, current status/priority in §18.AN and item 14's three sub-items 14.A/14.B/14.C) - it is the authoritative living backlog; identify the current owner-approved priority before beginning any workstream, and do NOT begin another TODO item merely because it is open - in particular, do NOT begin 14.A (Public Quote) or 14.C (Super Admin) implementation, and do NOT commit/push/deploy 14.B (Business Owner Dashboard), without a fresh explicit authorization for that exact action (14.B's design is owner-approved and its implementation is already done in the working tree per §18.AN - owner final visual acceptance of that implementation is still pending). THEN resume from the CURRENT EXACT CHECKPOINT recorded in PROFLOW_PROJECT_CONTEXT.md - do not restart analysis from scratch, and do not ask the project owner to re-explain anything already documented in any of the four files.

1. Read this entire PROFLOW_HANDOFF.md first, especially §18.N–§18.AV above, before taking any action.
2. Verify fresh: git status (expect clean), and HEAD == origin/main == 7329efbd77ccbf5312e54e681aaedb1f283edf81 (or whatever it has since become — do not assume this value is still current without checking).
3. Do NOT immediately modify, deploy, or migrate anything on arrival — confirm the state above matches this document before proceeding.
4. If resuming the service_role remediation: send-quote-email's and get-public-quote's migrations are now both complete (§18.N/§18.P). The next dependency must be selected from §18.P's remaining list (admin-delete-user, send-subscription-expiration-email, chat-ai, api/cron.js) and audited one at a time under the same discipline used so far — do not pre-select or start one without a fresh, narrow read-only pre-flight and explicit owner authorization first. Note send-subscription-expiration-email (§18.Q) is separately confirmed broken and its credential migration would not fix that; note chat-ai's prompt/classification behavior is separately already fixed (§18.U) — only its credential remains on the legacy key. Per the owner-driven work-order rule (§3 above), do not auto-resume this track merely because it is open — start only when the owner explicitly asks.
5. Continue one dependency at a time: read-only audit → owner approval → implementation → deployment → TEST verification → owner review → separate commit/push checkpoint. Do not bundle multiple dependencies or multiple concerns (e.g. a credential migration and a behavior change) into one change.
6. Never print, echo, log, or otherwise expose any secret/credential/access-token value, under any circumstance.
7. Never run npx supabase projects api-keys or any equivalent command known to reveal legacy API-key values in full — this is exactly how the original incident (§18.N) occurred. supabase secrets list (names + one-way digests only) has been confirmed safe and was used successfully; the api-keys command has not been re-run since the incident and should continue to be avoided.
8. Keep the legacy service_role key enabled until every dependency in §18.P's remaining list has been migrated and verified, and the owner has explicitly authorized disabling it specifically — do not disable it as a side effect of finishing the last migration without that separate, explicit authorization.

Near-Term Product/Security Work Queue — VERIFIED DECISIONS / OPEN WORK

19.A Admin UI / Account-State redesign — PARTIALLY IMPLEMENTED (visual/exclusion redesign done and owner-approved; Account-State track itself remains OPEN, see below)

Do not infer Lifetime from trial_ends_at=NULL as a general Account-State design principle. Lifetime is an explicit Super Admin grant chosen intentionally for selected users (e.g. non-paying permanent access) and requires a durable distinct state in the future Account-State design. (Note: the current frontend derivation, unchanged by this redesign, still treats trial_ends_at=NULL as Lifetime for every account, Super Admin included — see AdminUsersTab.jsx's/UserDetailsModal.jsx's getAccountDerived()/isLifetime logic. This pre-existing gap was not in scope for and was not touched by the redesign below; it remains open for the future Account-State work.)

Current implemented and owner-browser-approved state (AdminUsersTab.jsx, UserDetailsModal.jsx, Dashboard.jsx — uncommitted, see Git/Release State):

Super Admin account is excluded entirely from the managed-user table and mobile cards (AdminUsersTab.jsx's managedAccounts/activeAccountsList, filtered on role !== 'super_admin').

Super Admin is excluded from every managed-user KPI (Total Users, Local, International, Active-recent, New Users list/count) — all now derive from the same managedAccounts array, not the raw fetched account list.

Super Admin's own authentication/authorization is completely unchanged by this exclusion — it is a client-side rendering/aggregation filter only, applied after the existing fetchAllAccounts() query; it does not touch auth, the DB, RLS, or the is_super_admin()/RLS work in §18.M.

Owner-verified visible managed-user count: 5 ordinary users (consistent with the live is_super_admin() backend-visibility count of 6 total rows minus 1 excluded Super Admin — see §18.M).

The obsolete "Super Admin should always sort/pin to the top" product-intent bullet from an earlier version of this section is corrected here: that pinning logic was implemented in an earlier pass and has since been removed as conclusively dead code, once Super Admin was excluded from the list entirely (a row that never renders cannot be usefully pinned). Do not re-implement Super Admin pinning; the approved, current behavior is exclusion, not pinning.

Diagnostics/email-test controls (the live Resend test-send capability) were moved into a single collapsed-by-default "Diagnostics" panel, separated from the primary user-management flow — the capability itself (calling the trial/subscription-expiration Edge Functions in test mode) is unchanged, only its position/visibility changed.

The former per-row email-test buttons (one set of Send-Hebrew/Send-English buttons per user row) were removed; the single Diagnostics-panel form (free-text recipient email) replaced them.

The former subscription_ends_at Admin date-picker and "Paid - Active" subscription UI were removed entirely (see the dead-code list below in this section) — this UI could not be trusted since the underlying subscription_ends_at live-schema existence was never actually confirmed (see the subscription_* follow-up above) and there is still no real billing/payment backend (§19.C).

Trial expiration date remains visible for every non-Lifetime managed user (table + mobile cards).

Remaining trial time/status text (getRemainingTimeFormatted()) remains visible, unchanged.

Trial Extension (the 14-day extend button, handleExtendTrial14Days) — COMPLETED + PRODUCTION VERIFIED (bug found and fixed after this redesign; not part of the redesign itself, tracked here for continuity):

Bug found (pre-existing, predates this redesign by several days per git blame — not introduced by it): the old handleExtendTrial14Days contained two guards. Guard 1 blocked whenever business_settings.plan was 'basic' or 'pro', with an "Cannot extend trial for paying subscriber!" message. Guard 2 blocked whenever trial_ends_at was still in the future, with a "Cannot extend! User has N active days remaining." message. Guard 1 was stale/incorrect: createNewBusinessSettings() gives every brand-new signup plan:'pro' as its 14-day trial default (see §1/§17.E), so a real trial user's plan being 'pro' proves nothing about payment — Guard 1 was blocking the exact population (fresh trial users) the button exists to serve. Guard 2, taken together with Guard 1, meant almost no real trial user could ever be extended by this button as originally written.

Final, owner-confirmed product rule (do not describe Guard 2 as a bug — the owner explicitly confirmed blocking extension during an active trial is the correct, intended behavior; only Guard 1 was wrong):

Ordinary user with an ACTIVE trial: the Trial Extension control may be shown, but clicking it is blocked while trial_ends_at is still in the future, and the UI reports the exact number of active trial days remaining. This is intentional, not a defect.

Ordinary user with an EXPIRED trial: Super Admin may grant a fresh 14-day trial. The new trial_ends_at is set to NOW + 14 days (click time), never old trial_ends_at + 14 days.

Lifetime user: the Trial Extension control is not shown at all (existing, unchanged AdminUsersTab.jsx button-visibility logic).

Super Admin: not applicable — already excluded from the managed-user list entirely (§19.A above).

VERIFIED paying subscriber: the intended future behavior is that Trial Extension should not be shown for one. However, per the paid-subscriber source-of-truth audit below, no such verified state currently exists — current code correctly does NOT infer "paid" from plan='pro'/'basic', and must not until a real one exists.

Fix implemented (src/pages/Dashboard.jsx only, two commits): Guard 1 (the plan-based "paying subscriber" check) was permanently removed. Guard 2 (the active-trial check) was, in the same work item, also removed and then deliberately restored once the owner confirmed its blocking behavior was the intended product rule, not a bug — so the net final state keeps Guard 2 exactly as it originally was, with Guard 1 gone for good. The NOW + 14 days success-path logic was never changed throughout. Committed as 3ada41a "Fix trial extension eligibility logic" (src/pages/Dashboard.jsx only). Verified before commit: build PASS; lint 0 errors (only the same pre-existing unrelated warnings already documented elsewhere in this file); tests 21/21 PASS; git diff confirmed only src/pages/Dashboard.jsx changed; HEAD == origin/main after push; working tree clean after push.

Owner production verification: after deployment, the owner tested the live Trial Extension behavior on the production site and explicitly confirmed it working ("עובד והכל תקין"). Status: COMPLETED + PRODUCTION VERIFIED — do not reopen without new evidence.

Paid-subscriber source of truth — audited, CONFIRMED ABSENT (read-only audit, separate from the fix above; billing implementation remains OPEN, not designed or implemented here):

"ProFlow currently has no authoritative paid-subscriber source of truth." Verified live, this audit: the public schema has exactly 9 tables (business_settings, chat_logs, clients, expenses, quote_attachments, quote_items, quotecode_documents, quotes, services) — no subscription/billing/payment table exists. business_settings has no payment-status field. plan='pro' cannot prove payment (see Bug found above). subscription_ends_at, subscription_reminder_3d_sent, and subscription_reminder_24h_sent do NOT exist in the live business_settings schema (live column list re-verified this audit) — send-subscription-expiration-email's query against these nonexistent columns would fail if invoked, meaning that function is not a valid production source of subscription state today, not merely "non-authoritative." billing-checkout-stub remains a pure scaffold (checkoutUrl always null, no real Stripe API call, no table writes — confirmed by reading the full file this audit). Future paid status should come from a provider-backed, signature-verified billing/webhook source of truth (mirroring the existing Svix-verified pattern already used in resend-email-webhook), never inferred from plan. This remains OPEN — see §19.C; not designed or implemented in this update.

Ordinary-user Plan/Region/Role/Lifetime/Trial display remains fully data-driven from acc.role/acc.plan/acc.trial_ends_at/acc.country via getAccountDerived() — unchanged by the redesign, no hardcoded values introduced.

The Actions column itself (Eye/Reset/Delete buttons, their icons and layout) was not redesigned or touched in this pass; visual alignment became consistent purely as a side effect of the Super Admin row (with different action buttons than ordinary rows) being excluded from the table.

User Details modal (UserDetailsModal.jsx) — visual cleanup, owner-approved, uncommitted:

Restyled to the dark/neon ProFlow theme (consistent with the rest of the redesigned Admin UI).

Horizontal separator lines between info rows were removed (the shared row() helper's borderBottom style dropped; row spacing/padding otherwise unchanged).

Business address is now displayed as street, city (comma + one space, no pipe, no parentheses) instead of the raw stored value. The underlying stored data is unchanged — business_settings.address is still saved as the same pipe-delimited street|city|state|zip string (see SettingsTab.jsx); this is a display-only parse (formatAddressCity()) done at render time. Missing values are handled safely: only street shown if city is absent (no trailing comma), only city shown if street is absent (no leading comma), and the pre-existing "Not provided"/"לא הוזנה" fallback text is preserved if both are absent or the address predates the pipe-delimited format's 4-part shape.

No account-state logic (isSuperAdminUser/isLifetime/displayPlan/isTrialActive derivation) was changed in this cleanup.

Confirmed dead/removed from src/ during this Admin UI redesign (verified via repository-wide grep — zero remaining references):

handleUpdatePlanOnly

handleAdminPlanChange

handleSetSubscriptionEndDate (see the corrected subscription_* follow-up above)

isPaidSubscriber

TEST_EMAIL_ALLOWLIST

the obsolete aIsSuperAdmin/bIsSuperAdmin pinning comparator in Dashboard.jsx's sort logic

Product intent (original, retained for context — not all of it has been acted on yet):

new user receives a 14-day full PRO trial across PRO features;

on trial expiry, user becomes FREE;

FREE is intentionally minimal to encourage subscription;

BASIC is differentiated to encourage upgrade to PRO;

Admin "package" indicators must clearly represent all real states;

Admin package/status icons should be vertically aligned/cleanly presented — DONE, owner-verified in browser as a side effect of the Super Admin exclusion above.

Account-State work remains a separate, still-OPEN controlled track — NOT addressed by the redesign above. Ordinary authenticated users must ultimately have zero direct write authority over plan/entitlement/trial/subscription/role state; legitimate transitions should route through protected server/RPC/webhook/job mechanisms. Do not implement this merely from the summary here — re-audit the current live schema/code before any change.

19.B Email automation requirements — OPEN / product requirement

Transactional/subscription-related emails must be locale-aware:

Local/Israel users: Hebrew

International users: English

Required/expected classes discussed:

new-user Welcome email;

trial-expiration reminders: 3 days before and 24 hours before;

paid-subscription expiration reminder only where relevant to the eventual billing model (automatic recurring monthly/annual billing may make a generic "expiry" reminder unnecessary).

Existing reminder infrastructure/copy must be reconciled against real Account-State behavior before billing launch; older code/email copy was previously found to claim automatic downgrade without an actual downgrade writer.

19.C Billing / payment infrastructure — NOT COMPLETE

See §19.A's "Paid-subscriber source of truth — audited, CONFIRMED ABSENT" entry for the full, live-verified evidence trail (schema/table inspection, billing-checkout-stub/send-subscription-expiration-email inspection) behind the statement that no authoritative paid-subscriber signal exists today. Not duplicated here.

billing-checkout-stub remains scaffolding only; there is no completed real payment-provider subscription lifecycle.

Before real billing launch, the project still needs an audited design/implementation for:

real checkout/payment-provider integration;

webhook verification and trusted billing event handling;

monthly/annual recurring subscription lifecycle as chosen by product;

success/failure/cancellation/refund states as applicable;

durable paid-vs-trial-vs-Lifetime entitlement source;

safe Account-State synchronization;

Admin display and package indicators;

locale-aware billing emails.

For testing before real payment integration, it is reasonable to create a controlled TEST paid/Pro subscriber state only after the current Account-State model is re-audited and a legitimate protected transition is defined. Do not simulate payment by arbitrarily editing only plan='pro'.

