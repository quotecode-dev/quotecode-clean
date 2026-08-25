ProFlow — Project Handoff & Continuity Document

Last pushed application baseline: 5737626 — "Fix locked quote tooltip hit area".
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

The Four AI Contexts: the AI/chat surface has four independently protected contexts that must never bleed into one another — (1) the Hebrew landing page, (2) the English/International landing page, (3) the authenticated Hebrew application, (4) the authenticated English/International application. The AI must answer in the language correct for the context it is running in, not merely the language of the visitor's message. Hebrew contexts: Hebrew only, Israeli context, ILS/₪ only wherever currency is relevant. English/International contexts: English only, international context, USD/EUR/GBP only wherever currency is relevant, and ILS/₪ must never appear as the applicable product/price currency. (Current implementation: src/AIChatWidget.jsx / supabase/functions/chat-ai/index.ts — see §18.N's chat-ai baseline entry for the presently-documented code state; this paragraph states the required behavior going forward, it is not a claim that all four contexts have been freshly live-tested against it.)

Admin AI Support Logs — protected existing capability: the Super Admin AI Support Logs viewer (src/pages/AILogs.jsx, reading the chat_logs table) is a capability the owner actively relies on to distinguish ordinary questions from important/exceptional conversations — cancellation requests, complaints, legal/lawsuit-type questions, difficult/hard questions, and feature requests. Any future AI/security/auth/credential change — including any further service_role migration work on chat-ai — must preserve, without silently breaking: display of logged conversations/questions and AI responses, timestamp/ordering, attribution as currently designed, free-text search, and category filtering across exactly GENERAL / CANCELLATION / FEATURE_REQUEST / HARD_QUESTION. If a change could plausibly affect this capability, that must be called out explicitly in that change's verification report, never assumed unaffected.

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

18.N API-key exposure incident — OPEN / SECURITY PRIORITY (discovered during Stage D1.1 preparation; remediation IN PROGRESS — 4 of 7 Edge Functions migrated and verified as of this update; do not describe as resolved)

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

Status: 4 of the 7 Edge Function dependencies are migrated and verified; api/cron.js (a Vercel function, not Supabase-managed) has not been touched yet. Legacy service_role is NOT yet disabled — it remains live and must be treated as compromised until every remaining dependency (see §18.P) is migrated, verified, and the owner explicitly authorizes disabling it. Stage D1.1 remains suspended pending both full remediation completion and a safe TEST-user authentication method — this was in fact resolved and used successfully during the migrations above (ordinary supabase.auth.signInWithPassword() using only the anon key, with TEST-account credentials the owner supplied via local .env variables, never via service_role/admin API) — but Stage D1.1 itself has not been resumed; that credential-auth capability was used only for the credential-migration verifications documented here. See §18.T for a persistent operational note on this TEST-authentication capability, so a future session does not need to rediscover it.

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

Repo-wide grep for SUPABASE_SERVICE_ROLE_KEY (excluding this document and .env.example) confirms exactly 5 runtime files remain on the legacy credential: get-public-quote/index.ts, admin-delete-user/index.ts, send-subscription-expiration-email/index.ts (see §18.Q — currently broken independent of this remediation), chat-ai/index.ts, and api/cron.js (Vercel, not Supabase-managed). A separate grep confirms exactly 4 files now read SUPABASE_SECRET_KEYS: send-trial-expiration-email/index.ts, resend-email-webhook/index.ts, billing-checkout-stub/index.ts, send-quote-email/index.ts — matching the four completed migrations above exactly, with no drift found.

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

NEXT SESSION START — read this before touching anything

1. Read this entire PROFLOW_HANDOFF.md first, especially §18.N–§18.T above, before taking any action.
2. Verify fresh: git status (expect clean), and HEAD == origin/main == 712df40c266f767d07dae14037b42e709797e644 (or whatever it has since become — do not assume this value is still current without checking).
3. Do NOT immediately modify, deploy, or migrate anything on arrival — confirm the state above matches this document before proceeding.
4. If resuming the service_role remediation: send-quote-email's migration is now complete (§18.N/§18.P). The next dependency must be selected from §18.P's remaining list (get-public-quote, admin-delete-user, send-subscription-expiration-email, chat-ai, api/cron.js) and audited one at a time under the same discipline used so far — do not pre-select or start one without a fresh, narrow read-only pre-flight and explicit owner authorization first. Note send-subscription-expiration-email (§18.Q) is separately confirmed broken and its credential migration would not fix that.
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

