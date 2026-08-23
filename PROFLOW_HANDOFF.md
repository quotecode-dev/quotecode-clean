# ProFlow — Project Handoff & Continuity Document

**Last verified baseline:** `2532f1b` (commit `2532f1b2261a218711e5974ce9832658cb7937eb`)
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
- **Current development status:** Production, live, actively maintained. This session's work (baseline `2532f1b`) was a full audit-and-hardening pass focused entirely on the Local/International separation invariant (see §5). No feature work was in progress at this baseline; the next planned investigation is documented in §13.

### Technology stack (verified against `package.json` at this baseline)

```json
"dependencies": {
  "@fontsource/rubik": "^5.3.0",
  "@supabase/supabase-js": "^2.39.0",
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

`src/main.jsx` decides which of two **entirely separate React app bundles** to mount, based on (in priority order): `?lang=` query param → `/en`/`/he` path prefix → `localStorage['proflow_lang']` → `navigator.language`. This decision only ever happens **before any Supabase session is checked** — it selects a bundle, nothing more. It writes its choice back to `localStorage['proflow_lang']`.

```js
const isEnglishEnv = ...; // see §4 for exact logic
createRoot(...).render(isEnglishEnv ? <AppGlobal /> : <AppLocal />)
```

### Two parallel app bundles

- **`src/local/AppLocal.jsx`** — the Hebrew/Israel-local bundle. Declares its own `<Routes>` tree (landing, dashboard, public quote, tools, legal pages), rendering `<Dashboard bundleIsHebrew={true} />`.
- **`src/global/AppGlobal.jsx`** — the English/International bundle. Same route shape, `<Dashboard bundleIsHebrew={false} />`.

Both mount the **same** `Dashboard.jsx` component — the actual authenticated-account language/region logic lives entirely inside `Dashboard.jsx` and `regionConfig.js`, not in which bundle happened to load (see §4).

### Dashboard architecture

`src/pages/Dashboard.jsx` is the large, central authenticated-app component (single file, several thousand lines). It owns:
- Auth session state (`session`, `isInitializing` — gates all rendering until both auth and `business_settings` have resolved; see §5 for the account-switch hardening).
- Business settings state (`bizCountry`, `bizName`, `bizPlan`, `bizRole`, `currency`, VAT rate, trial state).
- All Supabase data fetching (`fetchQuotes`, `fetchClients`, `fetchServices`, `fetchExpenses`, `fetchAllUserAttachments`, `fetchSettings` — all called sequentially from `loadData()`).
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

There are **three distinct, non-interchangeable concepts** in this codebase. Confusing them is the single most common source of Local/International bugs found during the §5 audit.

### A. Anonymous / pre-signup landing-page language selection

**Source of truth: query param → path prefix → `localStorage['proflow_lang']` → `navigator.language`.**

This is the **only** context where browser-language-derived signals are legitimate. It governs exactly one decision: which of the two static app bundles (`AppLocal`/`AppGlobal`) mounts, and therefore which landing page an anonymous visitor sees.

`src/main.jsx`:
```js
const isEnglishEnv = langParam === 'en' ? true
  : langParam === 'he' ? false
  : window.location.pathname.startsWith('/en') ? true
  : window.location.pathname.startsWith('/he') ? false
  : storedLang === 'en' ? true
  : storedLang === 'he' ? false
  : !browserLang.startsWith('he');
```
This value also seeds `bundleIsHebrew`, which `Dashboard.jsx` uses **only** as the default region/currency/terms for a **brand-new** account's first-ever `business_settings` row (never to override an existing account).

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

> This is **not** a complete authoritative schema. No SQL migrations or schema-definition files were found in this repository. The tables/columns below are only what is demonstrably referenced by application code (`.select()`/`.insert()`/`.update()`/`.eq()` calls) as of this baseline. Row Level Security (RLS) policy definitions were **not found** in the repository and cannot be verified from the code alone — confirm directly in the Supabase dashboard before relying on any access-control assumption.

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

### Very important workflow rule

- When the project owner requests code to manually copy/paste, provide the **complete** updated file from beginning to end, not fragments — unless he explicitly requests only a patch/diff.
- When an AI agent (e.g. Claude Code) is itself editing the repository directly, make minimal targeted edits and clearly report exactly which files were changed.

---

## 12. Git / Release State

- **Approved baseline:** `2532f1b` (full hash `2532f1b2261a218711e5974ce9832658cb7937eb`)
- **Branch:** `main`
- **Remote:** `origin` → `https://github.com/quotecode-dev/quotecode-clean.git`
- Working tree was clean and `main` was up to date with `origin/main` at the time this document was written.

This is the known approved baseline for this handoff document. **Do not assume no commits exist after this one** — verify with `git log` before relying on this as "current."

---

## 13. Known Open Item

**Next planned investigation (not yet started, not yet implemented):**

Landing-page geographic/locale behavior. It was observed that changing the location in Chrome DevTools' Sensors panel can affect currency/location-sensitive behavior on the landing pages. The exact signal/mechanism driving this observed behavior has not yet been verified — determining that is the next investigation, not a conclusion reached here.

The task is to inspect the **existing** mechanism used by the landing/global experience and determine whether it can safely be extended so that:
- A visitor physically in Israel sees the Hebrew Local landing page.
- A visitor outside Israel sees the English International landing page.

**Without weakening authenticated-account region enforcement (§3/§4/§5).**

**Do NOT implement this now.** This is logged only as an open investigation. Do not assume Chrome DevTools Sensors location changes prove real IP-based geolocation is implemented anywhere in this codebase — inspect the actual implementation (`src/main.jsx`, `LandingGlobal.jsx`, `LandingLocal.jsx`) before reaching any conclusion about what signal is actually driving the observed behavior.

---

## 14. Legacy / Dead / Risky Code

### Confirmed dead/unreferenced code

- **`src/App.jsx`** — confirmed via repo-wide grep that no file imports it (`main.jsx` only imports `AppLocal`/`AppGlobal`). It is **not reachable in production**. Notably, it reimplements a `SmartPublicQuote`-named function that decides Hebrew-vs-English purely from `URLSearchParams`, `localStorage.getItem('proflow_lang')`, and `pathname.startsWith('/en')` — i.e. the exact anti-pattern the rest of the codebase's Iron Rule forbids for authenticated/quote contexts, under an identically-named function to the real, safe `src/components/SmartPublicQuote.jsx`. It also independently declares routes for `/tools`, `/he/tools`, `/en/tools`, `/public-quote/:id`, etc., mirroring (imperfectly) the real routes in `AppLocal.jsx`/`AppGlobal.jsx`.
  - **Do not delete or modify without explicit instruction** — this handoff only documents its status. It is a landmine risk if ever accidentally re-imported by a future refactor; flag it early in any work that touches routing.
- **`jspdf` / `html2canvas`** (package.json dependencies) — no import found anywhere in `src/`. Likely vestigial from a removed or unfinished PDF-export feature. Confirm before removing (out of scope for this document to decide).

### Suspected legacy / worth re-verifying before relying on

- `app_settings` table (`exchange_rates`) — written by `api/cron.js`, but no confirmed reader was found in `src/`. May be unused, or may feed a feature not covered by this session's research.
- `PROFLOW_ARCHITECTURE.md` (repo root, pre-existing Hebrew doc) — describes the system at "v14.3" and predates this session's region-separation audit; in particular it states email language comes from a client-supplied `isHebrew` parameter, which is **no longer accurate** as of commit `2532f1b` (email language/currency are now resolved server-side only — see §6). Treat that document as a historical/product-feature reference, not as authoritative for the region-separation mechanics — this handoff document supersedes it on that topic.
- `INVOICING_INFRASTRUCTURE.md` (referenced in `.env.example` comments) — exists in the repo per that reference; not read in full during this session. Presumed to describe the planned (not active) Stripe/invoicing scaffolding.

### Active code

Everything else referenced in §2's directory map is active, reachable code as of this baseline.

---

## Final verification performed

- Every factual claim in this document was checked against the actual current repository content (direct file reads and targeted greps), not recalled from earlier conversation summaries.
- No secret values are present anywhere in this document — only environment variable **names**.
- The Local/International Iron Rule is documented prominently in §3 and cross-referenced from §4/§5.
- **No application, configuration, database, or Supabase function file was modified while producing this document.** Only `PROFLOW_HANDOFF.md` was created.
