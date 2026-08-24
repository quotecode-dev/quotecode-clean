# ProFlow — Project Handoff & Continuity Document

**Last verified baseline:** `5737626` — *"Fix locked quote tooltip hit area"* (see §12 for full commit history and current pending-work status; see §17 for the security remediation included up to this baseline)
**Production:** https://www.quotecodepro.com/

> Before making architectural changes, verify this document against the current repository because the codebase may have advanced since this handoff was last updated.

This document is written for a senior AI/software engineer entering a **new session with no prior context**. It documents only what is verifiably present in the repository as of the baseline commit above. Where something could not be confirmed from the code, it is explicitly marked as such rather than assumed.

---

## 1. Project Overview

- **Project name:** ProFlow
- **Production domain:** https://www.quotecodepro.com/
- **What it does:** A SaaS business-management and quoting platform. Business owners (freelancers/small businesses) manage clients, create and send professional price quotes (with line items, discount, VAT, digital signature capture, WhatsApp/email delivery), track expenses and revenue, and export reports. The product is split into two hard-separated regional experiences — a Hebrew/Israel-local product and an English/International product (see §3, the Iron Rule).
- **Main user flows (confirmed in code):**
  - Sign up / sign in (email+password via Supabase Auth) → dashboard.
  - Create a business profile (`business_settings`, auto-initialized on first login if missing). New rows are initialized with `plan: 'pro'` and `trial_ends_at` set to approximately 14 days ahead (`Dashboard.jsx` auto-init payload). The actual Pro/Basic/Free access lifecycle is governed by the `effectivePlan`/`isPro`/`isBasicOrAbove` logic and admin plan overrides in `Dashboard.jsx` (see §7) — it should not be inferred solely from `trial_ends_at`.
  - Manage clients (`ClientsTab.jsx`), services catalog (`ServicesCatalog.jsx`), expenses (`FinancesTab.jsx`).
  - Create/edit/duplicate quotes (`QuoteForm.jsx`, orchestrated by `Dashboard.jsx`), attach files, send via email (Resend) and/or WhatsApp (a prefilled `https://api.whatsapp.com/send` link).
  - Client opens a public quote link, views it, digitally signs (canvas-based signature pad), and the quote is marked `approved`.
  - Export quotes to a formatted `.xlsx` report and expenses to CSV.
  - Built-in AI chat widget for user support (OpenAI-backed), and a super-admin-only AI conversation log viewer (`AILogs.jsx`).
  - Super Admin panel (`AdminUsersTab.jsx`) for managing all accounts, plans, and trial/lifetime status.
  - Public, unauthenticated marketing/tool pages (`PublicTools.jsx` / `PublicToolsEn.jsx` — currency/unit/metal/crypto calculators) and legal pages (Terms/Privacy/Contact), each in a language-locked bundle.
- **Current development status:** Production, live, actively maintained. Commit `2532f1b` (pushed) was a full audit-and-hardening pass focused entirely on the Local/International separation invariant (see §5). Since then, the open investigation from §13 (geo-based landing routing and first-signup region resolution) has been **implemented but is not yet committed or pushed** — see §4.D, §5b, §12, and the updated §13 for the full design and its current (pending-approval) status.

### Technology stack (verified against `package.json` at this baseline)

```json
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
```

- **Note:** `jspdf` and `html2canvas` are declared dependencies but **no import of either was found anywhere in `src/`** at this baseline. They appear to be unused/vestigial (possibly from a removed or never-completed PDF-export feature). Do not assume a PDF export feature exists — the confirmed export is the XLSX quote report (§8) and a CSV expense export.
- Backend: Supabase (Auth, Postgres Database, Edge Functions — Deno runtime), Resend (transactional email), OpenAI (`gpt-4o-mini`, for the AI chat widget only).
- Hosting: Vercel (confirmed via `vercel.json` — SPA rewrites, security headers, and a daily cron job; see §12).
- Version control: GitHub, remote `origin` → `https://github.com/quotecode-dev/quotecode-clean.git`.

---

## 2. Architecture

### Application bootstrap

`src/main.jsx` decides which of two **entirely separate React app bundles** to mount, based on (in priority order): `?lang=` query param → `/en`/`/he` path prefix → `localStorage['proflow_lang']` → an anonymous-UI-only geo cookie (`proflow_geo_country`, written by `middleware.ts` — see §4.D) → `navigator.language`. This decision only ever happens **before any Supabase session is checked** — it selects a bundle, nothing more. It writes its choice back to `localStorage['proflow_lang']`.

```js
const isEnglishEnv = ...; // see §4 for exact logic (now includes the geo-cookie tier)
createRoot(...).render(isEnglishEnv ? <AppGlobal /> : <AppLocal />)
```

**⚠ Pending/uncommitted as of this update:** the geo-cookie tier and `middleware.ts` are implemented in the working tree but not yet committed/pushed — see §12.

### Two parallel app bundles

- **`src/local/AppLocal.jsx`** — the Hebrew/Israel-local bundle. Declares its own `<Routes>` tree (landing, dashboard, public quote, tools, legal pages), rendering `<Dashboard />`.
- **`src/global/AppGlobal.jsx`** — the English/International bundle. Same route shape, `<Dashboard />`.

Both mount the **same** `Dashboard.jsx` component — the actual authenticated-account language/region logic lives entirely inside `Dashboard.jsx` and `regionConfig.js`, not in which bundle happened to load (see §4). **As of the pending geo work**, `Dashboard.jsx` no longer accepts or reads a `bundleIsHebrew` prop at all — both `AppLocal.jsx` and `AppGlobal.jsx` still pass `bundleIsHebrew={true}`/`{false}` in their JSX, but it is now inert/ignored (React does not error on an unused prop). See §14 for this leftover.

### Dashboard architecture

`src/pages/Dashboard.jsx` is the large, central authenticated-app component (single file, several thousand lines). It owns:
- Auth session state (`session`, `isInitializing` — gates all rendering until both auth and `business_settings` have resolved; see §5 for the account-switch hardening).
- Business settings state (`bizCountry`, `bizName`, `bizPlan`, `bizRole`, `currency`, VAT rate, trial state).
- All Supabase data fetching (`fetchQuotes`, `fetchClients`, `fetchServices`, `fetchExpenses`, `fetchAllUserAttachments`, `fetchSettings` — all called sequentially from `loadData()`).
- **First-time business-region resolution** for a brand-new account (no `business_settings` row yet): `fetchSettings` calls `fetchFreshGeoCountry()` (fetches `/api/geo`) and, on success, calls `createNewBusinessSettings(userId, userEmail, country)` — the **single** code path in the file (and, per a repo-wide grep, in the whole repository) allowed to `INSERT` a new `business_settings` row. If fresh geo is unavailable, the user is shown a minimal explicit "Israel / International" choice screen (`needsRegionChoice` state) instead of any guess. See §4.D for full detail — **pending/uncommitted, see §12**.
- Quote CRUD (`handleSaveQuote`, `handleEditClick`, `handleDuplicateQuote`, `handleCancelEdit`, delete).
- Email sending orchestration (`executeEmailSend`, calls the `send-quote-email` edge function).
- WhatsApp link generation (`sendWhatsApp`).
- XLSX quote export (`handleExportQuotes`) and CSV expense export (`handleExportExpenses`/`exportToCSV`).
- Tab-based UI: quotes, clients, finances, services catalog, settings, admin (super-admin only) — rendered via child components (`QuotesTab`, `ClientsTab`, `FinancesTab`, `ServicesCatalog`, `SettingsTab`, `AdminUsersTab`).
- Plan/trial gating (`effectivePlan`, `isPro`, `isBasicOrAbove`, `isSuperAdmin` — see §7 subscriptions).

### Quote creation/editing

`QuoteForm.jsx` is a controlled, presentational form component — nearly all its state lives in and is passed down from `Dashboard.jsx` (client fields, items, currency, discount, terms, notes, computed subtotal/tax/total). Currency is rendered as a **disabled** `<select>` inside the form — it cannot be changed from within `QuoteForm.jsx`; it is fixed by the account's region at the `Dashboard.jsx` level. Submission calls `Dashboard.jsx`'s `handleSaveQuote` via the form's `onSubmit`.

### Public quote rendering

`SmartPublicQuote.jsx` is the trusted router for `/public-quote/:id` and `/quote/:id`: it fetches the quote's own `currency`/`tax_rate` from the database and renders either `PublicQuote.jsx` (Hebrew) or `PublicQuoteEn.jsx` (English) based on that — never based on the viewer's browser. A second, direct route `/en/public-quote/:id` → `PublicQuoteEn.jsx` also exists (used for links the app itself generates to genuinely International quotes); as of this baseline `PublicQuoteEn.jsx` self-verifies the fetched quote and redirects to `PublicQuote.jsx` if it turns out to actually be a Local/ILS quote (see §5). Both public pages support live digital-signature capture and approval (§7).

### Authentication

Supabase Auth (email/password). `AuthScreen.jsx` renders the login/signup/password-recovery UI (shown whenever `Dashboard.jsx`'s `isInitializing`/`isPasswordRecoveryMode`/no-`session` gate is active). `Dashboard.jsx` subscribes to `supabase.auth.onAuthStateChange` for `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`, `PASSWORD_RECOVERY` events.

### Business settings

Table `business_settings`, one row per user (`user_id` foreign key to the Supabase Auth user). Auto-created on first dashboard load if missing (see §1, §5). Holds the account's legal region (`country`), currency, plan, role, trial/subscription dates, and business profile fields (name, tax ID, address, logo, default terms). See §9 for the full observed column list.

### Database interaction

Direct Supabase client calls from React components (`src/shared/supabase.js` exports the client, built from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) — there is no separate API layer between the frontend and Postgres; RLS (Row Level Security) is presumed to be the access-control boundary, though **RLS policies themselves are not present in this repository** (not verifiable from the code alone — see §9).

### Email sending

`supabase/functions/send-quote-email/index.ts` — Deno edge function, calls the Resend API directly. See §6 for full detail; this is the function that was most heavily hardened in the §5 audit.

### Resend webhook handling

`supabase/functions/resend-email-webhook/index.ts` — receives Resend delivery-failure webhooks, verifies Svix signatures, and marks the corresponding `quotes` row as bounced. See §6.

### AI functionality

- `src/AIChatWidget.jsx` (client widget, shown on landing pages, contact page, and dashboard) → `supabase/functions/chat-ai/index.ts` (edge function, calls OpenAI `gpt-4o-mini`) → logs every exchange to the `chat_logs` table.
- `src/pages/AILogs.jsx` — a super-admin-only viewer of the `chat_logs` table.

### Public tools

`src/components/PublicTools.jsx` (Hebrew) / `PublicToolsEn.jsx` (English) — standalone, unauthenticated calculator pages (currency converter, unit converter, precious-metals value calculator, crypto converter). No Supabase calls; they call public external APIs (`open.er-api.com` for FX rates, `api.coingecko.com` for crypto prices) directly from the browser, with a 10-minute `localStorage` cache.

### Subscriptions / trial functionality

Present, but **billing itself is a stub** — no real Stripe integration is wired up (`supabase/functions/billing-checkout-stub/index.ts` explicitly does not call the Stripe API). Plan gating (Free/Basic/Pro, quote-count limits, feature gating) is fully implemented and enforced client-side in `Dashboard.jsx`. See §7 for detail.

### Deployment structure

- **Vercel** hosts the Vite-built SPA. `vercel.json` (present) configures: a catch-all rewrite to `index.html` (client-side routing), security headers, correct `Content-Type`s for `sitemap.xml`/`robots.txt`, and **one cron job**: `path: "/api/cron"`, schedule `"0 8 * * *"` (daily 08:00).
- `api/cron.js` — a Vercel serverless function (Node, not a Supabase edge function) that runs daily: (1) marks quotes expiring "today" and flags `expiration_reminder_sent`, (2) fetches live FX rates from `open.er-api.com` and upserts them into an `app_settings` table (`key: 'exchange_rates'`), (3) invokes the two Supabase expiration-reminder edge functions in `batch` mode via `x-cron-secret`. Auth: requires `Authorization: Bearer <CRON_SECRET>`.
- **`api/geo.js`** *(new, pending/uncommitted — see §12)* — a second Vercel serverless function, same Node convention as `api/cron.js`. Returns `{ country }` read fresh from the request's `x-vercel-ip-country` header (uppercased, `Cache-Control: no-store` so it's never CDN-cached). Never reads a client-supplied country value. Called only by `Dashboard.jsx` at first-account-creation time — see §4.D.
- **`middleware.ts`** *(new, pending/uncommitted — see §12)* — Vercel Routing Middleware (project root, matches only `/`). Reads the visitor's geo country via the `@vercel/functions` `geolocation()` helper and, if available, sets a `proflow_geo_country` cookie for **anonymous landing-page UI routing only** (consumed by `main.jsx`, see above). Never redirects, never writes to any database, and is explicitly disconnected from legal-region creation (§4.D). Requires an actual Vercel deployment to see real geo data — the geo headers are not populated under local `vercel dev`.
- **Supabase** hosts the Postgres database, Auth, and 7 Edge Functions (declared in `supabase/config.toml`): `chat-ai`, `admin-delete-user`, `send-trial-expiration-email`, `send-subscription-expiration-email`, `send-quote-email`, `resend-email-webhook`, `billing-checkout-stub`.

### Important shared components/utilities

- `src/shared/supabase.js` — the singleton Supabase client (client-side).
- `src/shared/useSignaturePad.js` — canvas-based digital signature hook, used by both public quote pages.
- `src/shared/wipeUserData.js` — deletes all of a user's data across tables (used by account-cancellation flow).
- `src/utils/regionConfig.js` — the region/currency/date-formatting source-of-truth helpers (`REGION_RULES`, `isHebrewEnv`, `getCurrencySym`, `getRegionTaxRate`, `getRegionBillingProfile`, `formatDateLocal`, `formatNumberLocal`). Central to §3/§4.
- `src/utils/seoMeta.js` — SEO metadata helper (not deeply audited this session).
- `src/theme/neonTheme.js` — shared color/font theme constants (`NEON`, `FONT_HE`, `FONT_EN`).

### Directory map (verified, one level deep)

```
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
└── send-subscription-expiration-email/index.ts

api/cron.js                     # Vercel daily cron (not a Supabase function)
api/geo.js                      # ⚠ pending/uncommitted — fresh geo lookup for first-signup region (§4.D)
middleware.ts                   # ⚠ pending/uncommitted — Vercel Routing Middleware, anonymous UI-only geo cookie (§4.D)
vercel.json / vite.config.js / index.html
```

---

## 3. CRITICAL IRON RULE — LOCAL / INTERNATIONAL SEPARATION

**This is one of the most important architectural and business rules in ProFlow. Language and currency separation is a SYSTEM-WIDE invariant.**

### LOCAL / ISRAEL

- UI must be **Hebrew**.
- **RTL**.
- Currency must be **ILS / ₪ only**.
- **VAT = 18%**.
- Local customer-facing communication (email, WhatsApp) must be **Hebrew**.
- Local public quote presentation must be **Hebrew**.

### INTERNATIONAL

- UI must be **English only**.
- **LTR**.
- Allowed currencies only: **USD ($), EUR (€), GBP (£)**.
- **ILS / ₪ must NEVER appear.**
- **VAT = 0%**.
- International customer-facing communication (email, WhatsApp) must be **English only**.
- International public quote presentation must be **English**.

> **No future developer or AI should weaken this separation merely for convenience.**
>
> Authenticated account behavior must ultimately be determined by trusted account/quote data (`business_settings.country`, or a quote's own persisted `currency`/`tax_rate`) — **not** browser language, URL tricks, or stale `localStorage`.
>
> Public quote language/currency must follow trusted persisted quote/account data — never the viewer's browser.

A full audit against this rule was completed and pushed at commit `2532f1b` — see §5.

---

## 4. Region Architecture

There are **four distinct, non-interchangeable concepts** in this codebase. Confusing them is the single most common source of Local/International bugs found during the §5 audit (and the reason concept D below exists at all — see its history).

### A. Anonymous / pre-signup landing-page language selection

**Source of truth: query param → path prefix → `localStorage['proflow_lang']` → geo UI cookie (pending, see D) → `navigator.language`.**

This is the **only** context where browser-language-derived (and, as of the pending work, geo-derived) signals are legitimate for *display* purposes. It governs exactly one decision: which of the two static app bundles (`AppLocal`/`AppGlobal`) mounts, and therefore which landing page an anonymous visitor sees.

`src/main.jsx`:
```js
const isEnglishEnv = langParam === 'en' ? true
  : langParam === 'he' ? false
  : window.location.pathname.startsWith('/en') ? true
  : window.location.pathname.startsWith('/he') ? false
  : storedLang === 'en' ? true
  : storedLang === 'he' ? false
  : geoCountryCookie ? geoCountryCookie !== 'IL'   // ⚠ pending/uncommitted — see D
  : !browserLang.startsWith('he');
```
**This bundle choice is UI-display-only.** As of the pending work (§D), it no longer seeds any account-creation default by itself — see D for why that distinction now matters and how it's enforced.

### B. Authenticated account region

**Source of truth: `business_settings.country`, exposed in `Dashboard.jsx` as `bizCountry`, with `isLocalIsraeliBusiness = bizCountry === 'Local' || bizCountry === 'LCL'`.**

- `bizCountry` is unconditionally re-synced from `business_settings.country` on every settings fetch — never gated by `?lang=`.
- `Dashboard.jsx`'s `isHebrew` (drives `dir`, font, and every UI string in the authenticated app) is computed via `isHebrewEnv(bizCountry, session)` in `src/utils/regionConfig.js` — as of the §5 audit, this **no longer** accepts a `?lang=`/path override for an authenticated session (previously it did — this was violation #1, fixed).
- `isHebrewEnv()` itself checks `bizCountry` **before** any `localStorage` cache — cache is only a fallback for when the true country isn't yet known (previously the order was reversed — violation #2, fixed).
- Currency and VAT rate are derived solely from `isLocalIsraeliBusiness` / `getRegionTaxRate(bizCountry)`, never from `isHebrew` or any display-language signal.

### C. Persisted quote region/currency/tax behavior

**Source of truth: the individual quote's own `currency` and `tax_rate` columns, set at creation time and preserved historically.**

A quote, once created, keeps its own currency/tax_rate **even if the owning account's region is later corrected/changed** — this is intentional (see comments in `Dashboard.jsx` and `QuotesTab.jsx`) so that a historical document doesn't retroactively change. `isLocalQuote = Number(quote.tax_rate) > 0 || quote.currency === 'ILS'` is the pattern used (duplicated in `SmartPublicQuote.jsx`, `Dashboard.jsx`, `QuotesTab.jsx`) to decide a specific quote's own presentation language — this governs the public quote link route, the WhatsApp message text/link, and (as a secondary fallback only, see §6) the outbound email.

**Do not confuse B and C**: an account's *current* region (B) governs new quotes, VAT calculation on save, and the authenticated dashboard UI. A *specific quote's* persisted data (C) governs how that one document (public page, WhatsApp text, email) is presented, independent of what the account's region has since become.

### D. First-time business legal-region resolution (new-account creation) — ⚠ pending/uncommitted, see §12

**Source of truth: a fresh, server-side Vercel geo lookup made at the exact moment of account creation (`/api/geo`) — or, if that's unavailable, an explicit one-time choice from the authenticated user. Never a cookie, never `localStorage`, never the anonymous UI bundle (A).**

This concept exists because of a real bug found and fixed mid-session: an earlier version of this mechanism (mirroring the pre-existing `bundleIsHebrew` design) let the *anonymous UI bundle* (concept A — itself derived from `?lang=`/path/`navigator.language`) silently become the permanent `business_settings.country` for a brand-new account. That meant a UI-language override (e.g. `?lang=he` used purely to preview the Hebrew UI from outside Israel) could, if it happened to coincide with a signup, permanently misclassify a business's legal region with no error and no indication to the user. This was corrected by fully decoupling "what language is shown" (A) from "what legal region gets created" (D).

**Mechanism, in `src/pages/Dashboard.jsx`'s `fetchSettings`, only in the branch where no `business_settings` row exists yet for the user:**

1. `fetchFreshGeoCountry()` calls `GET /api/geo` (a live, uncached request — not a stored value) and normalizes the response to uppercase.
2. **If it returns a usable country:** `createNewBusinessSettings(userId, userEmail, country === 'IL' ? 'Local' : 'International')` is called immediately. `IL` → `country: 'Local'`, `currency: 'ILS'`, Hebrew default terms; anything else → `country: 'International'`, `currency: 'USD'`, English default terms. This is the only place VAT-relevant defaults are set for a new account, and it flows into the existing, unchanged §3/§B rules from there.
3. **If fresh geo is unavailable** (network failure, non-200, no header — e.g. local dev, or a proxy in front of the deployment): **no row is created.** Instead `needsRegionChoice` (React state) is set `true` and the authenticated user is shown a minimal, two-button "Israel / International" screen (rendered *before* the rest of the dashboard, in the same gate position as the `AuthScreen` loading screen) inside `Dashboard.jsx` itself. Its text follows the currently-displayed UI language (`isHebrew`) — that's cosmetic only; the *value* saved is exactly whichever button was clicked, mapped identically to step 2's rules.

**`createNewBusinessSettings(userId, userEmail, country)` is the single code path — verified via a repository-wide grep for `business_settings` + `.insert(` — allowed to `INSERT` a new `business_settings` row anywhere in this codebase.** It:
- Rejects (no insert) any `country` value other than exactly `'Local'` or `'International'`.
- Guards against double-submission with a synchronous `useRef` flag (`isCreatingBusinessSettingsRef`, checked/set before any `await`, immune to React state-batching timing) in addition to a `useState` flag that disables both buttons in the UI while a creation attempt is in flight.
- **On failure** (Supabase error, or no row returned): does **not** clear `needsRegionChoice` or the pending user/email — the user stays on the same explicit-choice screen (even if this attempt was the automatic geo-success path from step 2, not a manual click), sees a localized error, and can retry. There is no code path that renders the full dashboard with a partially-initialized business identity.
- **On success:** populates all `biz*` component state from the inserted row, clears `needsRegionChoice`/the error/the pending-account marker, and only then does the full dashboard render.

**`handleSaveSettings` (the manual Settings-tab save form) no longer contains a fallback INSERT.** It previously had one (`if (settingId) UPDATE else INSERT`) that independently bypassed this whole contract if `settingId` was ever unexpectedly null. That branch now fails safely instead — shows a localized "please reload and try again" error, logs a diagnostic to console, inserts nothing, and leaves existing state untouched.

**What this does *not* touch:** `business_settings.country` for an account that already has a row (concept B) is completely unaffected — the `if (data)` branch of `fetchSettings` (see B above) has no reference to geo, `needsRegionChoice`, or anything from this section, and was last modified in the pushed `2532f1b` audit.

---

## 5. Current Approved Region Audit

A system-wide Local/International separation audit was completed and pushed at:

**Commit: `2532f1b`** — *"Enforce strict Local and International separation"*

Files included in that commit:
- `src/pages/Dashboard.jsx`
- `src/pages/PublicQuoteEn.jsx`
- `src/utils/regionConfig.js`
- `supabase/functions/send-quote-email/index.ts`

The following protections were verified present in the code at this baseline:

| Protection | Verified location |
|---|---|
| Dashboard language (`isHebrew`) tied solely to `isHebrewEnv(bizCountry, session)`, no `?lang=`/path override | `Dashboard.jsx` ~line 91 |
| Wrong-region first paint prevented during login/account-switch: `onAuthStateChange`'s `SIGNED_IN`/`TOKEN_REFRESHED` handler now sets `isInitializing(true)` → awaits `loadData()` → `isInitializing(false)` for a genuine user-id change, instead of firing `loadData` unawaited with no render gate | `Dashboard.jsx`, inside the `onAuthStateChange` subscription |
| WhatsApp message **text** keyed on the quote's own `isLocalQuote`, not the spoofable display-language flag | `Dashboard.jsx`, `sendWhatsApp` |
| `PublicQuoteEn.jsx` self-verifies the fetched quote's `currency`/`tax_rate`; renders `<PublicQuote />` (Hebrew) instead if it's actually a Local/ILS quote; currency-symbol resolution whitelists `USD/EUR/GBP` only | `src/pages/PublicQuoteEn.jsx` |
| Quote `tax_rate` preserved (not silently rewritten to the account's current region) when editing an existing Draft/Sent quote | `Dashboard.jsx`, `editingOriginalQuote`/`taxRate` computation |
| International currency whitelist enforced when duplicating a quote (a stale `'ILS'` value can no longer be copied into a new quote for an International account) | `Dashboard.jsx`, `handleDuplicateQuote` |
| `isHebrewEnv()` prioritizes the trustworthy `country` argument over `localStorage` cache (previously reversed); also recognizes legacy `'LCL'` | `src/utils/regionConfig.js` |
| Settings-load currency also whitelists `USD/EUR/GBP` for International instead of trusting `business_settings.currency` verbatim | `Dashboard.jsx`, `fetchSettings` |
| Server-side email region/currency resolution unified into a single function (`resolveEmailRegion`) so language and currency symbol can never disagree | `supabase/functions/send-quote-email/index.ts` |
| Email sending fails safely (throws → 400 response, email not sent) if a trustworthy region/currency cannot be established from either `business_settings` or internally-consistent quote data | same file |
| An unknown/unrecognized `business_settings.country` value (not `Local`/`LCL`/`International`) is **not** silently treated as International | same file, `resolveEmailRegion` |
| International email can never produce `₪` (currency symbol whitelisted to `USD/EUR/GBP`, with a safe `$` default) | same file |
| Local email can never produce `$`/`€`/`£` (Local branch hard-returns `₪` regardless of the quote's stored currency) | same file |

All of the above were verified against the actual current file contents while writing this document (not merely recalled from prior conversation).

### 5b. Pending follow-on hardening — geo-based landing routing & first-signup region resolution (⚠ NOT yet committed/pushed)

Built in the same working tree, on top of `2532f1b`, resolving the investigation opened in §13:

| Protection | Verified location |
|---|---|
| Anonymous landing bundle choice (concept A) may now be influenced by a fresh Vercel geo lookup, ranked *below* `?lang=`/path/`localStorage` and *above* `navigator.language` — never overriding an explicit or previously-stored preference | `src/main.jsx`, `middleware.ts` |
| The geo signal used for anonymous UI routing (a cookie) is architecturally incapable of setting a new account's legal region — a completely separate, fresh server call is used for that (see next rows) | `middleware.ts` (writes UI-only cookie), `Dashboard.jsx` (never reads that cookie for region purposes) |
| New-account legal region comes from a **fresh, uncached, server-side** geo lookup made at account-creation time, not any cached/client-controlled value | `api/geo.js` (`Cache-Control: no-store`, reads only `x-vercel-ip-country`, never a client-supplied parameter), `Dashboard.jsx` `fetchFreshGeoCountry()` |
| If fresh geo is unavailable, the account region is **never guessed** from UI language/bundle/browser signals — the user is required to make an explicit choice before any row is created | `Dashboard.jsx`, `needsRegionChoice` gate + explicit "Israel/International" screen |
| Exactly one code path in the entire repository can `INSERT` a new `business_settings` row (verified by repo-wide grep) | `Dashboard.jsx`, `createNewBusinessSettings()` |
| Double-submit / concurrent-insert protection via a synchronous `useRef` guard, independent of React state-batching timing | `Dashboard.jsx`, `createNewBusinessSettings()` |
| Insert failure (automatic or manual) never renders a partially-initialized dashboard — always routes back to the explicit-choice screen with a localized, non-raw error | `Dashboard.jsx`, `createNewBusinessSettings()` |
| The Settings-tab manual save form's own former fallback INSERT (a second, independent account-creation path that bypassed this whole contract) was removed and now fails safely instead | `Dashboard.jsx`, `handleSaveSettings` |
| International landing-page marketing currency no longer has an `A$`/AUD branch — falls back to `$` like any other unmatched locale | `src/pages/LandingGlobal.jsx` |
| Existing-account behavior (concept B) is provably untouched by any of the above — no reference to geo/`needsRegionChoice` anywhere in `fetchSettings`'s existing-row branch | `Dashboard.jsx`, `fetchSettings` |

See §4.D for the full mechanism and §12 for exact commit/push status.

---

## 6. Email Architecture

### `supabase/functions/send-quote-email/index.ts`

- **Resend integration:** Sends via `POST https://api.resend.com/emails`, `Authorization: Bearer ${RESEND_API_KEY}`, `from: 'ProFlow <info@quotecodepro.com>'`.
- **Region/currency resolution:** A single function, `resolveEmailRegion(bizCountry, bizCurrency, quoteCurrency, quoteTaxRate)`, returns `{ hebrew: boolean, symbol: string } | null`:
  1. If `business_settings.country` is `'Local'`/`'LCL'` → `{ hebrew: true, symbol: '₪' }` unconditionally (never influenced by the quote's own currency).
  2. If it's exactly `'International'` → English, symbol from the quote's own currency if it's `USD/EUR/GBP`, else the account's `business_settings.currency` if valid, else a hard `'$'` default — never `₪`.
  3. If `business_settings.country` is any other non-empty value → returns `null` (fails safely — does not assume International).
  4. If `business_settings` (or its `user_id` link) is missing entirely → falls back to the **quote's own persisted** `currency`+`tax_rate`, accepted **only** if internally consistent (`ILS` + `tax_rate > 0` → Hebrew; `USD/EUR/GBP` + `tax_rate === 0` → English). Any other/contradictory combination → `null`.
  - If `resolveEmailRegion` returns `null`, or `quoteId`/Supabase env vars/the quote row itself are missing, the function `throw`s and the outer `catch` returns a `400` JSON error — **the email is not sent**.
- **`quoteId` tagging:** Every send attaches `tags: [{ name: 'quote_id', value: String(quoteId) }]` to the Resend API call, so bounce webhooks can be matched back to the quote (see below).
- **Client input is never trusted for region/language:** the payload's `isHebrew`/any client-provided flag is ignored; language/currency come only from the server-side DB lookups described above.

### `supabase/functions/resend-email-webhook/index.ts`

- **Svix signature verification:** Reads `svix-id`, `svix-timestamp`, `svix-signature` headers; computes HMAC-SHA256 over `${svixId}.${svixTimestamp}.${rawBody}` using `RESEND_WEBHOOK_SECRET` (its `whsec_` prefix stripped, then base64-decoded) and compares against the signature(s) in `svix-signature`. Missing headers → `401`; invalid signature → `401`; missing secret env var → `500`.
- **Event types handled:** Only `email.bounced` and `email.failed`. Other Resend event types (e.g. `email.delivered`, `email.opened`) are acknowledged with `200` but otherwise ignored.
- **`quote_id` tag matching:** Extracts the `quote_id` tag from `event.data.tags` (supports both array-of-`{name,value}` and plain-object tag shapes).
- **Database update on bounce/failure** (table `quotes`, by `id`):
  ```
  .update({
    email_bounced: true,
    email_bounce_reason: bounceReason,   // event.data.bounce.message || event.data.bounce.type || eventType
    email_bounced_at: new Date().toISOString(),
  })
  ```
- There is **no** "delivered" success write-back in this webhook file — clearing `email_bounced`/`email_bounce_reason`/`email_bounced_at` back to `false`/`null` happens client-side in `Dashboard.jsx`'s `executeEmailSend`, on the next successful resend.

---

## 7. Quote Architecture

- **Creation:** `Dashboard.jsx`'s `handleCreateNewQuoteClick` resets the form state and forces `currency` to `'ILS'` (Local) or the account's current international currency. `handleSaveQuote` inserts into `quotes` with `currency`/`tax_rate` derived from the account's live region for a genuinely new quote.
- **Editing:** `handleEditClick` loads an existing quote's fields into the form. Editing is blocked entirely if the quote is `approved`/`paid`/signed. On save, `currency` and (as of the §5 audit) `tax_rate` are **preserved from the original row**, not recomputed from the account's current region — protecting historical documents from silent corruption.
- **Duplication:** `handleDuplicateQuote` clones a quote into a new Draft. Currency is now whitelisted against `USD/EUR/GBP` for International accounts (a stale `'ILS'` value on the source quote can no longer leak into the duplicate).
- **Currency:** Locked at the `QuoteForm.jsx` UI level (disabled `<select>`); actual value is controlled by `Dashboard.jsx` state per the rules above.
- **VAT/tax_rate:** `taxRate` is computed at render time from `getRegionTaxRate(bizCountry)` for new/duplicated quotes, or preserved from `editingOriginalQuote.tax_rate` when editing.
- **Public link:** `SmartPublicQuote.jsx` (`/public-quote/:id`, `/quote/:id`) fetches the quote's own `currency`/`tax_rate` and routes to `PublicQuote.jsx` (Hebrew) or `PublicQuoteEn.jsx` (English) accordingly. A direct `/en/public-quote/:id` route also exists (self-verifying as of §5).
- **Signature/approval (confirmed):** Both public quote pages use `src/shared/useSignaturePad.js` (canvas-based). On approval, the client must have drawn a signature (`hasSigned`); the app then runs:
  ```
  supabase.from('quotes').update({ status: 'approved', signature: getSignatureDataUrl() }).eq('id', id)
  ```
  `signature` is stored as a base64 PNG data-URL. Once a quote has `status === 'approved'/'paid'` or a non-empty `signature`, `Dashboard.jsx` blocks further editing and blocks deleting the associated client.
- **Status/history:** Statuses are `draft`/`sent`/`approved`/`paid`, rendered as colored badges in `QuotesTab.jsx`. A `view_count` column tracks public-link opens; quotes with `view_count >= 3` and not yet approved/paid are surfaced as "hot" leads in the dashboard.
- **WhatsApp/email (confirmed):** `QuotesTab.jsx` row actions include "Send WhatsApp" (`sendWhatsApp` in `Dashboard.jsx`, opens a prefilled `https://api.whatsapp.com/send` link) and "Send Email" (`executeEmailSend`, invokes the `send-quote-email` edge function). Both are gated behind plan checks (`isBasicOrAbove`/`isPro`) via `handleProtectedAction`.
- **Excel export (confirmed):** `QuotesTab.jsx`'s export button invokes the `handleExportQuotes` prop, implemented in `Dashboard.jsx`. See §8.

---

## 8. Excel Quotes Export

`Dashboard.jsx`'s `handleExportQuotes` builds a real `.xlsx` workbook (via the `exceljs` package) from `filteredQuotes` (respects the current search/status filter — does not export all quotes unconditionally).

**Local account:**
- Hebrew, worksheet `rightToLeft: true`.
- All amounts forced to `₪` (regardless of the quote's own stored currency — the account's region is authoritative for this report).
- Hebrew column headers and Hebrew status labels (טיוטה/נשלח/אושר/שולם).
- Title: `<Business Name> – דוח הצעות מחיר`.

**International account:**
- English, LTR.
- Currency resolved per-quote, restricted to `USD/EUR/GBP` (an `ILS`/invalid quote currency falls back to the account's currency or `USD`).
- English column headers and English status labels (Draft/Sent/Approved/Paid).
- Title: `<Business Name> – Quotes Report`.
- The **export-date** metadata row's date formatting uses the account's valid International currency (`USD/EUR/GBP`) for locale selection, with `USD` as the safe fallback if the account currency isn't one of those three.

Quote numbers are exported in the same short, user-facing format shown in `QuotesTab.jsx` (`#${quote.id.slice(0, 6)}`), not the raw UUID.

**Expenses export remains separate and unchanged:** `Dashboard.jsx`'s `handleExportExpenses` still uses the original `exportToCSV` helper (plain CSV, not XLSX) — it was explicitly not touched by the Excel-export or region-audit work.

---

## 9. Database Model — Observed Database Contract From Application Code

> This is **not** a complete authoritative schema. No SQL migrations or schema-definition files were found in this repository. The tables/columns below are only what is demonstrably referenced by application code (`.select()`/`.insert()`/`.update()`/`.eq()` calls) as of this baseline. Row Level Security (RLS) policy definitions were **not found** in the repository and cannot be verified from the code alone — confirm directly in the Supabase dashboard before relying on any access-control assumption. **Exception:** the RLS/trigger/GRANT state for `quotes`/`quote_items`/`quote_attachments` and `business_settings` specifically has been live-verified as part of a security remediation — see §17. This does not extend to any other table.

| Table | Observed columns |
|---|---|
| `quotes` | `id`, `user_id`, `client_id`, `client_type`, `currency`, `tax_rate`, `subtotal`, `total`, `status`, `valid_until`, `discount`, `terms`, `notes`, `subject`, `quote_subject`, `view_count`, `signature`, `email_bounced`, `email_bounce_reason`, `email_bounced_at`, `expiration_reminder_sent`, `created_at` (+ embedded relations `clients(...)`, `quote_items(...)`) |
| `clients` | `id`, `user_id`, `company_name`, `email`, `phone`, `client_type`, `tax_id`, `address`, `terms`, `notes`, `created_at` |
| `services` | `id`, `user_id`, `name`, `price`, `created_at` |
| `expenses` | `id`, `user_id`, `description`, `amount`, `category`, `is_recurring`, `expense_date` |
| `quote_items` | `id` (implicit), `quote_id`, `description`, `quantity`, `unit_price`, `total_price` |
| `quote_attachments` | `id`, `quote_id`, `file_name`, `file_url`, `file_size` |
| `business_settings` | `id`, `user_id`, `email`, `business_name`, `tax_id`, `phone`, `address`, `logo_url`, `plan`, `role`, `country`, `currency`, `default_terms`, `trial_ends_at`, `trial_reminder_3d_sent`, `trial_reminder_24h_sent`, `subscription_ends_at`, `subscription_reminder_3d_sent`, `subscription_reminder_24h_sent`, `last_sign_in`, `created_at` |
| `chat_logs` | `id` (implicit), `user_email`, `user_question`, `ai_response`, `category`, `created_at` |
| `app_settings` | `key`, `value`, `updated_at` (single confirmed use: `api/cron.js` upserts `key: 'exchange_rates'`; no confirmed reader of this table was found in `src/`) |

**Supabase Storage:** one bucket reference confirmed — `supabase.storage.from('quote-files')` (upload/`getPublicUrl`) in `Dashboard.jsx`, used for quote attachment files (adjacent to `quote_attachments.file_url`).

**Role values observed:** `business_settings.role` includes at least `'user'` and `'super_admin'` (used for admin panel and `AILogs.jsx` access gating).

**Plan values observed:** `business_settings.plan` includes `'free'`, `'basic'`, `'pro'` (see §7 subscriptions).

**Country values observed:** `'Local'`, `'LCL'` (legacy alias for Local), `'International'`.

**⚠ Pending/uncommitted invariant (see §4.D, §12):** as of the working-tree state described in this update, `business_settings` INSERT (as opposed to UPDATE) is intended to happen from exactly one place in the codebase — `createNewBusinessSettings()` in `Dashboard.jsx`. Verify this still holds with a fresh grep for `business_settings` + `.insert(` before relying on it, especially if this section is read after further changes.

**`business_settings.user_id` is now `UNIQUE` and `NOT NULL`** (added as part of the §17.D security remediation — was neither previously). This makes the "one row per user" invariant stated earlier in this section structurally enforced, not merely conventional.

---

## 10. Environment Variables / Secrets

**Never include actual secret values in code, chat, or documentation — names only.**

### Client-safe (bundled into the browser, `VITE_*` prefix)

| Variable | Used in |
|---|---|
| `VITE_SUPABASE_URL` | `src/shared/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | `src/shared/supabase.js` (public by design — protected by Supabase RLS, not secrecy) |

### Server-only secrets — **must never be exposed client-side**

| Variable | Used in |
|---|---|
| `SUPABASE_URL` | All 7 edge functions |
| `SUPABASE_ANON_KEY` | Several edge functions (used to build a caller-scoped client from the incoming JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | All 7 edge functions — full-privilege key |
| `RESEND_API_KEY` | `send-quote-email`, `send-trial-expiration-email`, `send-subscription-expiration-email` |
| `RESEND_WEBHOOK_SECRET` | `resend-email-webhook` (Svix signature verification) |
| `CRON_SECRET` | `send-trial-expiration-email`, `send-subscription-expiration-email`, `api/cron.js` (shared secret between Vercel Cron and Supabase edge functions) |
| `OPENAI_API_KEY` | `chat-ai` edge function — **note:** this variable is used in code but is **not listed in `.env.example`**; verify it is actually set in the Supabase Edge Function secrets before assuming the AI widget works in any given environment |

### Declared for future use, not currently wired into active code

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INVOICE_API_KEY` — present in `.env.example` with explicit "scaffolding only" comments. `billing-checkout-stub/index.ts` contains a *commented-out* real Stripe call referencing `STRIPE_SECRET_KEY`; it is not active.

`.env.example` exists at the repo root and documents all of the above (no values). `.env` is gitignored.

---

## 11. Development Rules for Future AI/Developers

1. Do not redesign working architecture without justification.
2. Prefer minimal, targeted fixes.
3. Preserve existing functionality.
4. Never invent files, APIs, DB columns, routes, or environment variables — verify against the current repository first.
5. Read affected files before modifying them.
6. Preserve existing conventions (this codebase has heavy inline Hebrew comments explaining non-obvious "iron rule" invariants — read them, they usually document a past bug).
7. Do not add dependencies unnecessarily.
8. Treat the project as production software.
9. Check security implications of any change.
10. **Check Local/International separation (§3) on every relevant change.**
11. Check mobile/responsive behavior for UI changes.
12. Run `npm run build` after code changes.
13. Run lint where appropriate (`npm run lint`).
14. Do not commit/push without explicit approval from the project owner.

### Security-critical rules (added following the §17 remediation)

15. **Approved/paid/signed quotes are immutable.** This must never be re-weakened at the UI layer (`QuotesTab.jsx`/`Dashboard.jsx`) without the equivalent DB-trigger enforcement (§17.A) remaining in place — the UI lock and the DB triggers are two independent layers, and removing either without the other reopens a real, previously-exploited regression.
16. **Security-sensitive business rules must be enforced at the database layer (RLS + triggers), never as a frontend-only check.** Client-side gating (a hidden button, a disabled UI state, a role check in React) is a UX convenience, not a security boundary — see §17.B/§17.C for the concrete case where relying on this distinction mattered.
17. **Never mutate real production or Lifetime customer data for testing.** Any mutation-based verification (UPDATE/DELETE/INSERT attack simulation, trigger testing, etc.) must run against an explicit, disposable TEST account only.
18. **Use explicit disposable TEST accounts for mutation tests, and remove/restore them afterward.** See §17.F for the pattern followed in this remediation (one account restored to a clean state and kept, one account fully deleted with residue verified absent).

### Very important workflow rule

- When the project owner requests code to manually copy/paste, provide the **complete** updated file from beginning to end, not fragments — unless he explicitly requests only a patch/diff.
- When an AI agent (e.g. Claude Code) is itself editing the repository directly, make minimal targeted edits and clearly report exactly which files were changed.

---

## 12. Git / Release State

- **Approved & pushed baseline:** `5737626` — *"Fix locked quote tooltip hit area"*
- **Branch:** `main`
- **Remote:** `origin` → `https://github.com/quotecode-dev/quotecode-clean.git`
- Recent history (newest first, confirmed via `git log` at time of this update): `5737626` *"Fix locked quote tooltip hit area"* → `7e96b83` *"Restore approved/signed quote immutability (UI lock + handler guards + tests)"* (both §17.A) → `0843736` *"Replace native dialogs with ProFlow UX"* → `71cd378` *"Fix localized SEO canonical and hreflang architecture"* (this is SEO Phase 2 — see below, it is **now committed**, correcting this document's prior "pending" status) → `aad3a7a` (SEO Phase 1) → `9c8cb06` *"Add safe geo routing and first-signup region resolution"* → `60e5d2c` *"Add ProFlow project handoff document"* → `2532f1b` *"Enforce strict Local and International separation"* → `6d7a1ac` and earlier. The geo/first-signup work described in §4.D and §5b, previously pending, **is now committed and pushed** as of `9c8cb06` — that section's "pending" language is superseded; §4.D/§5b remain accurate as an architecture description, just no longer uncommitted.

**SEO Phase 2 (canonical/hreflang consolidation, §15) is now committed and pushed as `71cd378`.** This document previously (as of the `aad3a7a` checkpoint) described it as implemented-but-uncommitted — that status is now superseded. §15's design description remains accurate; only its commit status changed.

**Security remediation (§17) — application code committed and pushed; DB objects live in Supabase (no in-repo migration file, consistent with this section's existing no-migrations caveat):**
- Quote immutability UI/handler code: `7e96b83`, `5737626` (both pushed).
- `business_settings` privilege-escalation fixes (role/plan/trial_ends_at UPDATE and INSERT hardening, `UNIQUE`+`NOT NULL` on `user_id`): DB-only — no application code changes were required, executed and live-verified directly in Supabase. See §17.B–§17.E for exact objects/policies.

If you are reading this in a future session: run `git status`/`git log` first — further work may already be committed on top of `5737626`, or new pending changes may exist. Do not assume either state from this document alone.

---

## 13. Known Open Item — RESOLVED (implementation pending commit, see §12)

**Original item (kept for history):** landing-page geographic/locale behavior — it was observed that changing the location in Chrome DevTools' Sensors panel could affect currency/location-sensitive behavior on the landing pages. Investigation traced this to `LandingGlobal.jsx`'s marketing-pricing `navigator.language`/`Intl.DateTimeFormat` timezone heuristic (unrelated to true geolocation — no `navigator.geolocation` or IP-geolocation API was ever used anywhere in this codebase).

**Resolution implemented:** a real Vercel-geo-based mechanism (`middleware.ts` + `api/geo.js`, see §4.D and §5b) now exists, with a hard architectural separation enforced between:
- Visitor physically in Israel → Hebrew Local landing page (anonymous UI routing, concept A) — **implemented**.
- Visitor outside Israel → English International landing page — **implemented**.
- New-account legal region (`business_settings.country`) → resolved from a *fresh, server-side* geo lookup made at account-creation time, with an explicit user-choice fallback if that's unavailable — **never** guessed from the anonymous UI bundle — **implemented**.
- Authenticated-account region enforcement (§3/§4.B/§5) — **unweakened**; the `if (data)` branch of `fetchSettings` was not touched by any of this work.

**Status:** implemented and approved in review, **not yet committed or pushed** — see §12 for exact pending-file list. A new open item worth tracking going forward: `AppLocal.jsx`/`AppGlobal.jsx` still pass an inert `bundleIsHebrew` prop that `Dashboard.jsx` no longer reads (see §14) — harmless, but a minor cleanup opportunity if anyone later touches those two files for an unrelated reason.

---

## 14. Legacy / Dead / Risky Code

### Confirmed dead/unreferenced code

- **`src/App.jsx`** — confirmed via repo-wide grep that no file imports it (`main.jsx` only imports `AppLocal`/`AppGlobal`). It is **not reachable in production**. Notably, it reimplements a `SmartPublicQuote`-named function that decides Hebrew-vs-English purely from `URLSearchParams`, `localStorage.getItem('proflow_lang')`, and `pathname.startsWith('/en')` — i.e. the exact anti-pattern the rest of the codebase's Iron Rule forbids for authenticated/quote contexts, under an identically-named function to the real, safe `src/components/SmartPublicQuote.jsx`. It also independently declares routes for `/tools`, `/he/tools`, `/en/tools`, `/public-quote/:id`, etc., mirroring (imperfectly) the real routes in `AppLocal.jsx`/`AppGlobal.jsx`.
  - **Do not delete or modify without explicit instruction** — this handoff only documents its status. It is a landmine risk if ever accidentally re-imported by a future refactor; flag it early in any work that touches routing.
- **`jspdf` / `html2canvas`** (package.json dependencies) — no import found anywhere in `src/`. Likely vestigial from a removed or unfinished PDF-export feature. Confirm before removing (out of scope for this document to decide).
- **`bundleIsHebrew` prop** (⚠ new as of the pending §4.D work) — `AppLocal.jsx`/`AppGlobal.jsx` still pass `bundleIsHebrew={true}`/`{false}` to `<Dashboard />`, but `Dashboard.jsx` no longer destructures or reads it anywhere (confirmed — its only prior use, the new-account default fallback, was replaced by the geo/explicit-choice mechanism). React silently ignores unused props, so this is harmless but genuinely dead as of this update. Left in place deliberately (removing it would mean touching `AppLocal.jsx`/`AppGlobal.jsx`, which was out of scope for that change) — safe to clean up in a future unrelated pass.

### Suspected legacy / worth re-verifying before relying on

- `app_settings` table (`exchange_rates`) — written by `api/cron.js`, but no confirmed reader was found in `src/`. May be unused, or may feed a feature not covered by this session's research.
- `PROFLOW_ARCHITECTURE.md` (repo root, pre-existing Hebrew doc) — describes the system at "v14.3" and predates this session's region-separation audit; in particular it states email language comes from a client-supplied `isHebrew` parameter, which is **no longer accurate** as of commit `2532f1b` (email language/currency are now resolved server-side only — see §6). Treat that document as a historical/product-feature reference, not as authoritative for the region-separation mechanics — this handoff document supersedes it on that topic.
- `INVOICING_INFRASTRUCTURE.md` (referenced in `.env.example` comments) — exists in the repo per that reference; not read in full during this session. Presumed to describe the planned (not active) Stripe/invoicing scaffolding.

### Active code

Everything else referenced in §2's directory map is active, reachable code as of this baseline.

---

## 15. SEO Architecture — Phase 1 (Live) / Phase 2 (Approved, Pending Commit)

### Phase 1 — LIVE, committed and pushed at `aad3a7a`

- **Public quote noindex (defense in depth):** `src/pages/PublicQuote.jsx` and `src/pages/PublicQuoteEn.jsx` each set `<meta name="robots" content="noindex, nofollow">` client-side in their existing mount `useEffect`. `vercel.json` additionally sends `X-Robots-Tag: noindex, nofollow` at the HTTP level for `/quote/:id`, `/public-quote/:id`, `/en/public-quote/:id`, `/dashboard`, and `/ai-logs` — the HTTP header is the primary guarantee (works even if a crawler doesn't execute JS); the meta tag is the secondary/client-side layer.
- **`robots.txt` intentionally has no `Disallow` rules at all** — private/noindex routes are protected via `X-Robots-Tag` instead, specifically so crawlers are *not* blocked from fetching (and therefore seeing) the noindex directive. Blocking via `robots.txt` was tried and deliberately reverted for this exact reason during Phase 1 review.
- **`<html lang>`/`<html dir>` are now set at runtime**, at the two central bundle-level locations: `src/local/AppLocal.jsx` (`lang='he'`, `dir='rtl'`) and `src/global/AppGlobal.jsx` (`lang='en'`, `dir='ltr'`), each in their own mount `useEffect`. `PublicQuote.jsx`/`PublicQuoteEn.jsx` additionally set their own `lang`/`dir` on mount (justified exception — a quote's actual language can differ from the hosting bundle, e.g. a Local/Hebrew quote opened via `/en/public-quote/:id`, which `PublicQuoteEn.jsx` detects and hands off to `PublicQuote.jsx`; the nested component's mount-effect correctly fires after and overrides the parent's).
- `public/sitemap.xml` at this baseline still included the *bare* unprefixed page URLs (`/`, `/contact`, `/privacy`, `/terms`, `/tools`) alongside the prefixed ones — this was superseded by Phase 2 (below), which is not yet committed.

### Phase 2 — IMPLEMENTED IN THE WORKING TREE, ARCHITECTURE APPROVED, NOT yet committed/pushed

10 files modified (see §12 for the exact list). Summary of the final approved design:

- **Canonical consolidation through `src/utils/seoMeta.js`:** this helper already existed pre-Phase-2 (used by Contact/Privacy/Terms/Tools) and has been extended with a `hreflang` array parameter (renders reciprocal `<link rel="alternate" hreflang>` tags via the same find-or-create DOM pattern already used for canonical/meta tags) and an `updateSocial` flag (default `true`, preserves existing Open Graph/Twitter behavior for its existing callers; explicitly `false` for the two landing pages so this consolidation does not start touching OG/Twitter for them — that remains out of scope until a later phase).
- **Root `/` canonical strategy — FINAL, approved (Option B):** bare `/` is a stable, self-canonical, x-default entry point. `LandingLocal.jsx`/`LandingGlobal.jsx` compute their canonical from **both** a valid explicit `?lang=` override and the clean pathname — never from geo/`localStorage`/`navigator.language`:
  ```js
  const langParam = new URLSearchParams(window.location.search).get('lang');
  const explicitLang = langParam === 'he' || langParam === 'en' ? langParam : null;
  // LandingLocal:
  const canonicalPath = explicitLang ? '/he' : window.location.pathname === '/he' ? '/he' : '/';
  // LandingGlobal:
  const canonicalPath = explicitLang ? '/en' : window.location.pathname === '/en' ? '/en' : '/';
  ```
  Only `?lang=he`/`?lang=en` (the two values `main.jsx` itself recognizes) count as an explicit override; any other/invalid `?lang=` value (e.g. `?lang=fr`) is treated as absent and falls back to the clean-pathname rule. Bare `/` with no (valid) `?lang=` **always** self-canonicalizes to `/`, regardless of which bundle (`AppLocal`/`AppGlobal`) actually rendered it for a given visitor — geo/browser/stored-preference signals may decide *what renders*, never *what the canonical says*. Real `/he`/`/en` visits, and valid crossed `?lang=` cases (e.g. `/he?lang=en` → English UI → canonical `/en`), still self-canonicalize to the language actually rendered.
- **Contact/Privacy/Terms/Tools — bare `/contact`/`/privacy`/`/terms`/`/tools` are compatibility aliases only, FINAL:** these are the same shared-route-in-both-bundles shape root `/` had, but unlike root they carry no `x-default`/homepage role, so the resolution differs from Option B: bare aliases are **not** kept self-canonical and are **not** treated as indexable pages at all.
  - **Canonical localized pages** are `/he/<page>` and `/en/<page>` only — never the bare alias. (This was already fixed in the prior Phase 2 pass and is unchanged.)
  - **Internal navigation no longer generates bare-alias traffic:** the footers in `LandingLocal.jsx`/`LandingGlobal.jsx` now `navigate()` directly to `/he/contact`/`/en/contact` etc. (previously `/contact` etc.) — confirmed via a repo-wide grep that zero internal links to the bare aliases remain anywhere in `src/`.
  - **Client-side compatibility redirect:** `Contact.jsx`, `Privacy.jsx`, `Terms.jsx`, `PublicTools.jsx` (Hebrew), `PublicToolsEn.jsx` (English) each check, in their existing mount `useEffect`, whether `window.location.pathname` is *exactly* the bare alias (e.g. `=== '/contact'`) and if so call `navigate(<resolved localized path>, { replace: true })` — using the `isHebrew` prop (Contact/Privacy/Terms) or the component's own fixed language (PublicTools/PublicToolsEn) that `main.jsx` already resolved before these components ever mounted, so no new geo/cookie/language-guessing logic was introduced. The condition only ever matches the bare path, so a direct visit to `/he/contact` or `/en/contact` never redirects (no loop possible).
  - **HTTP `X-Robots-Tag: noindex, follow`** added in `vercel.json` for exactly `/contact`, `/privacy`, `/terms`, `/tools` (new entries, alongside the existing Phase 1 `noindex, nofollow` rules for `/quote/:id` etc. — those are untouched). `follow` (not `nofollow`) is used deliberately so crawlers can still traverse to/consolidate toward the localized canonical pages. `robots.txt` was **not** touched — no new `Disallow` rules, consistent with the existing Phase 1 rationale (crawlers must be able to fetch the response and see the noindex header).
- **hreflang — final:** landing pages declare the 3-way cluster `he→/he`, `en→/en`, `x-default→/`; Contact/Privacy/Terms/Tools declare the 2-way `he→/he/<page>`, `en→/en/<page>` (no `x-default` for these, and the bare aliases are never an hreflang target — matches the pre-existing pattern).
- **`public/sitemap.xml` — final, 11 URLs:** `/`, `/he`, `/en`, `/he/tools`, `/en/tools`, `/he/contact`, `/en/contact`, `/he/privacy`, `/en/privacy`, `/he/terms`, `/en/terms`. Bare `/` is its own `<url>` entry (matching its stable self-canonical status under Option B) with the same 3-way hreflang cluster as `/he`/`/en`. The 4 bare aliases for Contact/Privacy/Terms/Tools are excluded from the sitemap (they are not canonical, not indexable).
- **`index.html` and `robots.txt` were NOT touched in Phase 2** — the static HTML's existing generic defaults and hreflang cluster (`en→/en`, `he→/he`, `x-default→/`) already matched the new architecture and needed no change; no SSR/SSG was introduced (deliberately ruled out as unnecessary). **`vercel.json` was touched** (see above — 4 new header entries only; every existing Phase 1 header/rewrite/cron entry is unchanged).

---

## 16. Known Open Items (Next Session)

### A. Root `/` SEO canonical strategy — RESOLVED, approved (Option B)

**Decision:** bare `/` is a stable, self-canonical, x-default entry point. It always declares `canonical = /`, regardless of which bundle (`AppLocal`/`AppGlobal`) actually renders it for a given visitor. `/he` and `/en` remain the two fixed localized canonical pages, each self-canonical to itself.

**Why, grounded in current official Google Search Central documentation:**
- Google explicitly names self-referential canonicals as the default best practice, and states JS should not override an original HTML canonical to a *different* value — the prior dynamic-per-render approach (`/` → `/he` or `/en` depending on render) violated both: it made a single URL emit *different* canonical targets across crawls, and contradicted `index.html`'s own static self-referential `/` canonical.
- A hard geo-based redirect from `/` (an earlier candidate, "C") was rejected: Google's multi-regional/multilingual guidance explicitly says *"avoid automatically redirecting users... don't redirect based on what you think the user's language may be,"* warning it can prevent Google from crawling all locale variants. A later refinement of that idea (a redirect gated by a new middleware-readable language-preference cookie, "C2") was evaluated in detail and rejected for the same reason — it's still the exact auto-redirect-on-guessed-language pattern Google's docs warn against, and would have needed a new cookie, new `middleware.ts` logic, and a dependency on the `Accept-Language` header that Googlebot itself doesn't send.
- Google's own `x-default` guidance names "auto-redirecting homepages" *and* "language selector pages" as valid patterns, but a self-canonical, locale-adaptive homepage that never redirects (Option B) avoids the documented auto-redirect risk entirely while still satisfying `x-default`'s purpose.

**Final canonical logic** (implemented in `LandingLocal.jsx`/`LandingGlobal.jsx`, see §15 for the exact code and the full verified 12-case matrix, including the 3 invalid-`?lang=` cases): canonical is derived from a *valid* explicit `?lang=he`/`?lang=en` override first, then the clean pathname — never from geo/`localStorage`/`navigator.language`, and never from an unrecognized `?lang=` value.

**Contact/Privacy/Terms/Tools resolved separately, NOT via Option B:** these four families had the identical bare-route-in-both-bundles shape root `/` did, but — unlike root — carry no `x-default`/homepage role, so they were resolved as compatibility aliases instead (client-side `replace` redirect to `/he/<page>`/`/en/<page>` + HTTP `X-Robots-Tag: noindex, follow`, internal navigation updated to stop generating bare-alias traffic). See §15 for the full final design. This item is now fully resolved, not just root.

### B. Local currency header leakage — quote table column header (OPEN, not yet audited)

**Observed (reported by the project owner, not yet independently verified in code):**
- For a Local/Israeli test account, quote-history rows correctly display `₪` amounts, but the Hebrew "הסכום" (Amount) column **header** visibly shows a green `$` icon/symbol.
- The Super Admin view shows a different, not-yet-identified green symbol in the equivalent header position.

**Iron Rule implication:** a Local account's UI must never expose a foreign-currency indicator anywhere, including incidentally via a hardcoded icon — this would be a (likely cosmetic/icon-level, not data-level) violation of the same Local/International separation principle enforced everywhere else in this codebase.

**Next session must audit before changing anything:**
- Search for `DollarSign`, `Banknote`, or a literal `$` character used as an icon/decoration (as opposed to actual currency-symbol formatting) in `src/components/QuotesTab.jsx` and any other quote-table render path (`Dashboard.jsx`'s own quote-list rendering, `AdminUsersTab.jsx`'s admin-facing quote/revenue tables if applicable).
- Determine whether this is a **hardcoded decorative icon** (e.g. a `lucide-react` `DollarSign` used as a generic "money" glyph in the column header, never swapped per-region) versus an actual currency-formatting bug that could indicate a deeper data issue.
- Fix only after confirming root cause — do not guess.

---

## 17. Security Remediation — Quote Immutability & business_settings Privilege Hardening (CLOSED)

A multi-stage security remediation was completed this session, covering two previously-open issues: approved/paid/signed quote immutability (a regressed business rule), and `business_settings` privilege-escalation surfaces (`role`, `plan`, `trial_ends_at`). Both are now **CLOSED** — see the closed-scope list at the end of this section, and the follow-ups after it for what is deliberately *not* included.

### 17.A Quote immutability — CLOSED

Restores and hardens a rule that had silently regressed and been re-fixed across prior commits (`9f37c95` → `38be268` → `3f6cd27`, found via `git log -S` pickaxe search during this remediation).

**Rule:** once a quote's `status` is `approved`/`paid` (case-insensitive) or it has a non-empty `signature`, it is fully immutable — no edit, no delete, no mutation of its `quote_items`/`quote_attachments` — identically in the Local/Hebrew and International/English bundles.

| Layer | Protection | Location |
|---|---|---|
| Single source of truth | `isQuoteImmutable(quote)` helper | `src/utils/quoteLock.js` |
| UI | Edit/Delete: native `disabled={isLocked}` + defensive `if (isLocked) return` inside `onClick`, tooltip owned by a wrapper `<span title=...>` around the button rather than the button itself (native disabled buttons don't reliably deliver hover events), sized to cover the full row so the tooltip hit area matches the visible locked row; exact HE/EN tooltip strings; button labels unchanged | `src/components/QuotesTab.jsx` |
| App handler guards | `handleEditClick`, the quote-save path, `requestDeleteQuote`, `executeDeleteQuote` all call `isQuoteImmutable(...)` before any Supabase write | `src/pages/Dashboard.jsx` |
| DB — UPDATE | `guard_quote_immutability()` / trigger `guard_quote_immutability_update` (BEFORE UPDATE on `quotes`) — allows the legitimate pending→approved/paid transition (incl. public approval, since both `PublicQuote.jsx`/`PublicQuoteEn.jsx` write `status`+`signature` in one combined UPDATE); once already immutable, only 5 named bookkeeping fields may still change (`view_count` non-decreasing/non-NULL, `expiration_reminder_sent` one-way false→true, `email_bounced`/`email_bounce_reason`/`email_bounced_at` bidirectional — a resend can legitimately clear a prior bounce); anything else raises `42501` | Live in Supabase (no in-repo migration file — see §9's existing no-migrations caveat) |
| DB — DELETE | `guard_quote_immutability_delete()` / trigger `guard_quote_immutability_delete_trigger` (BEFORE DELETE on `quotes`) — blocks deleting an immutable quote; only bypass is `auth.role() = 'service_role'`, required for the `admin-delete-user` account-deletion cascade | Live in Supabase |
| DB — children | `guard_quote_child_immutability()` / triggers `guard_quote_items_immutability`, `guard_quote_attachments_immutability` (BEFORE INSERT OR UPDATE OR DELETE on `quote_items`/`quote_attachments`) — checks **both** the OLD and NEW `quote_id`'s parent-quote immutability, so a row cannot be moved into or out of a locked quote; `service_role` bypass narrowed to `DELETE` only (the admin-delete-user cascade) — even `service_role` cannot INSERT/UPDATE child rows on a locked quote | Live in Supabase |
| Regression tests | `src/utils/quoteLock.test.js` (11 cases: pending/draft→false, approved/paid incl. case variations→true, signature-with-unrelated-status→true, empty/null→false), `src/components/QuotesTab.test.jsx` (locked/unlocked UI state × HE/EN, exact tooltip text, click-on-locked-button never reaches the handler) — Vitest + Testing Library, newly added to this repo (`package.json`, `vite.config.js`, `src/test/setup.js`; no test framework previously existed) | `npm run test` — 21/21 passing at close |

**Committed & pushed:** `7e96b83` *"Restore approved/signed quote immutability (UI lock + handler guards + tests)"*, `5737626` *"Fix locked quote tooltip hit area"*.

**Full TEST-only functional matrix** (19 scenarios — pending-quote CRUD both languages, locked-quote UI/tooltip both languages, paid/signed-with-other-status locking, direct authenticated UPDATE/DELETE attack on an approved TEST quote, `quote_items`/`quote_attachments` mutation blocking, moving a child into/out of a locked quote, public approval succeeding both languages, `view_count`/`email_bounced`/`expiration_reminder_sent` bookkeeping still working, `admin-delete-user` cascade still succeeding) was executed against TEST accounts/quotes only. Real Lifetime production data was read-only verified (Edit/Delete render disabled, status/signature/currency inspected) and never mutated.

### 17.B business_settings — `role` privilege escalation — CLOSED

**Finding:** `business_settings.role` is the sole source of `super_admin` authority everywhere in the app (`Dashboard.jsx`, `AILogs.jsx`, `admin-delete-user`), and had no protection beyond ownership RLS — an ordinary authenticated user could potentially set their own `role` to `'super_admin'` via a raw UPDATE or INSERT, which every downstream admin check would then trust.

**Closed by:**
- `authenticated` no longer has UPDATE privilege on the `role` column (confirmed via live GRANT inspection).
- The pre-existing RESTRICTIVE INSERT policy `"Restrict business_settings insert to role=user"` (`WITH CHECK (role = 'user')`) blocks any INSERT attempting a non-`'user'` role.
- **Live-tested:** a fresh authenticated attack inserting `role='super_admin'` was rejected with PostgreSQL `42501`; no row was created.

### 17.C business_settings — `plan`/`trial_ends_at` UPDATE escalation — CLOSED

**Finding:** an ordinary authenticated owner's standard ownership RLS UPDATE policy permitted freely rewriting their own `plan`/`trial_ends_at` (self-upgrade to a paid plan, self-grant unlimited/Lifetime trial) — no trigger previously existed on `business_settings`.

**Closed by:** `guard_business_settings_plan_trial()` / trigger `guard_business_settings_plan_trial_update` (BEFORE UPDATE on `business_settings`):
- If neither `plan` nor `trial_ends_at` changes, the update passes through untouched (covers ordinary Settings saves and login bookkeeping — neither writes those columns).
- An ordinary owner may perform *only* the exact legitimate self-cancellation transition: `plan='free' AND trial_ends_at IS NULL`.
- A caller whose own `business_settings.role = 'super_admin'` may change `plan`/`trial_ends_at` on any account without restriction (covers Super Admin plan change, trial extension, and Lifetime grant/revoke — the latter, `handleToggleLifetime` in `Dashboard.jsx`, only ever touches `trial_ends_at`, never `plan`).
- No `service_role` bypass — the writer inventory confirmed no service_role/cron process currently touches either column (the two reminder-email edge functions only ever write their own `*_reminder_*_sent` bookkeeping flags, despite their email copy — see follow-ups below).

**Live-tested** with a disposable TEST account (`tahshitishi@gmail.com`, left restored to `plan: free`, `trial_ends_at: null`, `role: user` after testing): ordinary-user plan-upgrade attempt rejected `42501`; arbitrary trial extension rejected `42501`; legitimate self-cancellation to free/null succeeded; Super Admin (`shlomisiny@gmail.com`, `role: super_admin`) plan change and trial change on the TEST account succeeded; after Super Admin set `plan=pro`, the TEST user's own attempt to change its own plan was rejected, with `plan`/`trial_ends_at`/`role` unchanged.

### 17.D business_settings — structural hardening — CLOSED

- `UNIQUE (user_id)` added — live-confirmed zero duplicate `user_id` rows existed before installation.
- `user_id` changed to `NOT NULL` — live-confirmed zero NULL rows existed before installation. Needed because a bare `UNIQUE` constraint does not by itself prevent multiple `NULL`-`user_id` rows in standard SQL; `NOT NULL` closes that residual gap, making every "one row per user" lookup in the app — including the §17.C trigger's own caller-role lookup — structurally guaranteed rather than merely conventionally true.

### 17.E business_settings — `plan`/`trial_ends_at` INSERT escalation — CLOSED

**Finding:** `createNewBusinessSettings()` (`src/pages/Dashboard.jsx` — still the sole in-repo INSERT path, unchanged) always inserts `plan:'pro'`, `trial_ends_at: now+14d` at signup; no legitimate flow ever inserts `plan:'free'`/`trial_ends_at:null`. But `authenticated` has column-level INSERT privilege on `plan`/`trial_ends_at`/`role`, so a raw REST INSERT bypassing the app's JS could previously set any `plan`/`trial_ends_at` value on a brand-new row.

**Closed by:** new RESTRICTIVE INSERT policy `"Restrict business_settings insert to safe free or legitimate trial"`, ANDed automatically (RESTRICTIVE policies always AND) with the pre-existing `role='user'` restrictive policy and the ownership policy:
```
(plan = 'free' AND trial_ends_at IS NULL)
OR (plan = 'pro' AND trial_ends_at within ±2 hours of now() + 14 days)
```
**Live-tested** with a second disposable TEST account: duplicate `business_settings` INSERT for an existing user rejected (unique-violation, §17.D); fresh-user INSERT with `role='super_admin'` rejected `42501`; fresh-user INSERT with a Pro plan and a +365-day trial rejected `42501`; a legitimate Pro +14-day trial INSERT succeeded with the expected resulting row state.

### 17.F TEST cleanup — confirmed

Two disposable TEST accounts were used across this remediation, never any real/production/Lifetime account:
- `tahshitishi@gmail.com` — used for the UPDATE-path (plan/trial) tests; restored to a clean `plan: free / trial_ends_at: null / role: user` state and left in place.
- `proflow.security.test2@gmail.com` — used for the INSERT-path (duplicate row / role-injection / trial-length) tests; **completely removed** afterward — final SQL verification returned no residue in either `auth.users` or `business_settings`.

Temporary local test scripts and temporary credential environment variables were removed after use; `git status --short` was clean at each cleanup checkpoint.

### Closed scope (this remediation)

- Quote immutability (UI + handler + DB, both languages).
- `business_settings.role` self-escalation.
- `business_settings.plan`/`trial_ends_at` UPDATE self-escalation.
- `business_settings.plan`/`trial_ends_at` INSERT self-escalation.
- `business_settings` duplicate/NULL `user_id` rows.

### Follow-ups (not started — tracked here for the next session, do not fold into unrelated work)

- **Admin UI is the next major work area.** Before changing anything there, reconcile `AdminUsersTab.jsx`/`UserDetailsModal.jsx` against the actual current production DB schema — do not assume §9's "observed columns" list is authoritative (see next point for a concrete example of why).
- **`subscription_*` column assumptions need review.** `AdminUsersTab.jsx`'s `handleSetSubscriptionEndDate` and `send-subscription-expiration-email` reference `subscription_ends_at`/`subscription_reminder_3d_sent`/`subscription_reminder_24h_sent` columns sourced from §9's non-authoritative "observed columns" list — these may not actually exist in the live schema, which would mean that feature is silently broken in production. Not fixed as part of this remediation (out of scope); verify before touching billing/subscription code.
- **Reminder-email copy vs. actual behavior.** `send-trial-expiration-email` and `send-subscription-expiration-email` both send copy stating the account "moves automatically to the Free plan" after expiry, but neither function — nor anything else found in this codebase — actually writes `plan`/`trial_ends_at`; they only update their own `*_reminder_*_sent` bookkeeping flags. There is currently no automatic downgrade mechanism at all. Review during Admin/Billing work — either implement the described downgrade or correct the email copy.
- **Stripe billing remains a stub** (`billing-checkout-stub/index.ts`, no real Stripe call). Any future billing writer that inserts/updates `business_settings.plan`/`trial_ends_at` must satisfy the RESTRICTIVE INSERT policy (§17.E) and the UPDATE trigger (§17.C) — most naturally by running through the account's own legitimate transition or a `super_admin`-equivalent path, not by bypassing them.

---

## Final verification performed

- Every factual claim in this document was checked against the actual current repository content (direct file reads and targeted greps), not recalled from earlier conversation summaries.
- No secret values are present anywhere in this document — only environment variable **names**.
- The Local/International Iron Rule is documented prominently in §3 and cross-referenced from §4/§5.
- **No application, configuration, database, or Supabase function file was modified while producing this document update.** Only `PROFLOW_HANDOFF.md` was edited in this pass — confirmed via `git status --short` immediately after, which showed the same 9 SEO Phase 2 files as before this checkpoint and nothing else added.
- This is a **checkpoint update** (session-limit driven): it corrects the baseline from the now-committed `2532f1b`/`9c8cb06` state to the current pushed `aad3a7a`, and records the SEO Phase 2 work (§15) that exists only in the working tree, plus two open items for the next session (§16: the root `/` canonical-strategy investigation, and the local-currency-header-leakage UI bug). No SEO Phase 2 code was committed, pushed, or reverted during this checkpoint — only this document changed.
