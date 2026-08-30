# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Canonical Domain Consolidation + ChatGPT Landing-Page Access

**EFFORT LEVEL: MAXIMUM.** Audit / analysis / read-only verification / ChatGPT-access discovery only. No Production domain mutation is authorized or performed by this task.

## Methodology and a Disclosed Limitation

This session's Vercel CLI is not authenticated (`vercel whoami` → "Logged out"), so the actual Vercel project Domains configuration could not be read directly via API/CLI. Everything below is instead evidence gathered from: (1) live HTTP requests against both domains with redirects disabled, (2) direct comparison of response bodies and content-hashed asset filenames, (3) a full source-code search for domain references, and (4) reading `vercel.json`. Where Vercel-Dashboard-only configuration would be needed to fully answer a question (e.g., whether the default `.vercel.app` alias can technically be de-provisioned), this is stated plainly as unverified, not guessed.

========================================
**CURRENT DOMAIN STATE**
========================================

**VERCEL ROOT** (`https://quotecode.vercel.app/`): initial status **200 OK**, no `Location` header, 0 redirects, final URL = same, final hostname = `quotecode.vercel.app`.
**VERCEL /he**: 200 OK, no redirect.
**VERCEL /en**: 200 OK, no redirect.

**CANONICAL ROOT** (`https://www.quotecodepro.com/`): 200 OK, no redirect.
**CANONICAL /he**: 200 OK, no redirect.
**CANONICAL /en**: 200 OK, no redirect.

**Neither domain redirects to the other today — both are live, independent, directly content-serving origins.**

**VERCEL HOSTNAME TYPE**: could not be definitively classified via authenticated evidence (CLI not logged in). Behaviorally, it functions exactly like a standard Vercel-project automatic production alias (serves the current Production deployment directly, `Server: Vercel`, edge-cached). Confirmed to be the **byte-identical build** as canonical:
- Response body length: 3615 bytes, both domains, identical.
- Content-hashed asset filenames (Vite build hashes — `index-CFcq8ykq.js`, `index-vQXPyooC.css`): **identical on both domains.** Since these hashes are derived from file content, this is cryptographic-strength proof of "same exact build," not a visual/appearance-based inference.
- Both already serve `<link rel="canonical" href="https://www.quotecodepro.com/" />` even from the `.vercel.app` origin.

========================================
**REMOVAL AUDIT**
========================================

**CAN `quotecode.vercel.app` BE REMOVED**: **UNKNOWN** (disclosed limitation — no authenticated Vercel access this session).

**WHAT "REMOVE" WOULD MEAN**: unassigning/de-provisioning the `.vercel.app` hostname as a public alias for this project's Production deployment, as distinct from deleting any Vercel-generated deployment-specific technical URLs (which are not required to be touched).

**VERCEL HOSTING AFTER REMOVAL**: unaffected in principle — Vercel would continue hosting and serving `www.quotecodepro.com` normally; this is purely a domain/alias-layer question, not a hosting-capability question.

**DEPLOYMENT-SPECIFIC URLS AFTER REMOVAL**: not required to change; Vercel's internal per-deployment URLs are a separate mechanism from the project-level public alias.

**OLD LINK CONSEQUENCE**: **real, code-confirmed.** Password-reset emails and business-user-shared Public Quote links generated while a user was browsing via `quotecode.vercel.app` embed that exact origin (see Auth/Session section below) — immediate removal would break these for any user/link currently in flight.

**SEO CONSEQUENCE**: low. The app's own canonical tags, hreflang, sitemap, and robots.txt are already 100% clean of `vercel.app` references — no code-level SEO dependency exists. The only unverifiable residual risk is whether Google has independently indexed any `quotecode.vercel.app` URL outside the sitemap (not checked — would require Search Console access, the same standing gap as the still-open Item 5 SEO TODO).

**AUTH CONSEQUENCE**: real for password-reset specifically (see below); zero for signup confirmation and all transactional emails (already hardcoded to canonical).

========================================
**REDIRECT OPTION**
========================================

**REDIRECT SUPPORTED**: YES (standard Vercel capability — either a project-level Domain redirect rule or a `vercel.json` `redirects` entry; the current `vercel.json` has no `redirects` block today, confirming no redirect exists yet at the application-config layer).

**BEST REDIRECT LAYER**: the Vercel project Domain configuration (redirecting at the platform edge, before any request reaches the application) is preferable to an application-level redirect, since it works even before React/the SPA loads.

**STATUS CODE**: a permanent redirect (301 or Vercel's edge-native 308) is appropriate for a deliberate, permanent domain consolidation — not a temporary 302/307.

**PATH PRESERVATION**: achievable with a wildcard rule (`/(.*)` → `https://www.quotecodepro.com/$1`) — required, since Public Quote links (`/public-quote/:id`) and Dashboard-relative paths must resolve correctly after the redirect.

**QUERY PRESERVATION**: achievable — Vercel redirect rules preserve query strings by default when the destination doesn't already define its own. Necessary for `?lang=en` and any Supabase auth callback query parameters.

**Note on URL fragments** (`#access_token=...` style Supabase flows, if used): browsers natively preserve the original request's URL fragment across an HTTP redirect when the `Location` header does not specify its own fragment — this is standard browser behavior, not something the redirect rule needs to explicitly handle.

========================================
**RECOMMENDATION**
========================================

**RECOMMENDED FINAL ARCHITECTURE: C — STAGED REDIRECT, THEN LATER REMOVAL.**

**WHY**: Live evidence proves `quotecode.vercel.app` is a fully independent, currently-content-serving second origin — exactly the Owner's concern, and it should stop being one. However, immediate hard removal was found to carry a **real, code-confirmed risk**, not a hypothetical one: password-reset links and business-user-generated Public Quote share links both embed whatever origin the browser was on at the time (`window.location.origin`), with **no fallback to canonical**. A user mid-password-reset, or a customer holding a quote link shared by a business owner who happened to be on `quotecode.vercel.app`, would hit a dead domain under immediate removal. A redirect (path+query preserved) gracefully forwards all such links to canonical instead — fully satisfying the Owner's goal (the domain stops operating as an independent second application origin) while breaking nothing already in circulation. Once the Owner is satisfied that legacy-link dependence has faded (a time-boxed period, or direct evidence such as Vercel access-log volume on the old domain dropping to near-zero), project-level removal can be revisited as a separate, later, explicitly-authorized step — at which point the "UNKNOWN — can it even be removed" question from the Removal Audit above would also need a definitive answer via authenticated Vercel access.

========================================
**AUTH / SESSION**
========================================

**SUPABASE SITE URL**: unavailable this session (no authenticated read path — Supabase CLI has no config-read subcommand for Auth settings, and a raw Management API call was not attempted, consistent with this session's established practice of not improvising credential-bearing platform calls without explicit precedent).

**REDIRECT ALLOW-LIST**: unavailable, same reason.

**LOGIN IMPACT**: none — the standard email/password login flow (`supabase.auth.signInWithPassword`) does not involve a redirect URL at all; unaffected by domain consolidation either way.

**RESET IMPACT**: **real** — `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + ... })` appears at four call sites (`App.jsx`, `AppLocal.jsx`, `AppGlobal.jsx`, `Dashboard.jsx`), all dynamically using the browser's current origin, none hardcoded to canonical. A reset requested from `quotecode.vercel.app` produces a reset-completion link pointing back to that exact origin.

**SIGNUP CONFIRMATION IMPACT**: none — `Dashboard.jsx`'s `supabase.auth.signUp` call already hardcodes `emailRedirectTo: 'https://www.quotecodepro.com/dashboard'`, with an existing code comment explicitly stating this is deliberate so confirmation always returns to canonical "even if signup was done via quotecode.vercel.app."

**PUBLIC QUOTE IMPACT**: mixed. Server-generated links (the actual "Send Email" quote-delivery flow, `send-quote-email` Edge Function) are hardcoded to canonical (`PROD_ORIGIN = 'https://www.quotecodepro.com'`, with its own explicit anti-phishing-appearance rationale comment) — zero risk. But the **frontend "Copy Link" and "Send WhatsApp" buttons** (`Dashboard.jsx` ×2, `QuotesTab.jsx` ×1) build the link from `window.location.origin` dynamically — a business owner sharing a quote while browsing via `quotecode.vercel.app` embeds that origin in the link they hand to their own customer.

**SIGNATURE IMPACT**: none beyond the Public Quote link-origin issue above — the signature flow itself (`public_approve_quote` RPC, the P0 security fix from an earlier task this session) operates on whatever page the link resolves to; it has no domain-specific logic of its own.

**MULTI-DEVICE SESSION IMPACT**: none. Supabase sessions are stored per-browser-origin by design; this was already true before any consolidation work and is unrelated to it. A user switching from `quotecode.vercel.app` to `www.quotecodepro.com` would need to sign in again on the "new" origin exactly as they would after any bookmark/URL change — this is not a regression introduced by redirect or removal, it is inherent, pre-existing browser-storage behavior. Independent multi-device sessions (the standing product requirement) are fully preserved either way.

**HARDCODED VERCEL REFERENCES — full ledger**:
- `Dashboard.jsx` signup `emailRedirectTo` → AUTH, already hardcoded-safe.
- `send-trial-expiration-email`, `send-subscription-expiration-email` CTA links → AUTH/EMAIL CTA, already hardcoded-safe.
- `send-quote-email`'s `PROD_ORIGIN` → PUBLIC QUOTE, already hardcoded-safe.
- `resetPasswordForEmail` × 4 call sites → AUTH, **origin-dependent, real risk**.
- Public Quote "Copy Link"/WhatsApp builders × 3 call sites → PUBLIC QUOTE, **origin-dependent, real risk**.
- `index.html` canonical/hreflang/OG/Twitter tags → SEO, already hardcoded-safe.
- `sitemap.xml` (36 refs), `robots.txt` (1 ref) → SEO, already hardcoded-safe, zero vercel.app exposure.
- `support@`/`info@quotecodepro.com` email addresses → OTHER, unaffected by hosting/domain changes.
- One code comment in `Dashboard.jsx` naming `quotecode.vercel.app` → DOCUMENTATION only.
- Demo-video relative paths → ASSET, resolve correctly under either domain today.

**No STALE or LEGACY reference was found anywhere in the repository.**

========================================
**CHATGPT ACCESS**
========================================

**HE LANDING ACCESS**: the canonical Production Hebrew Landing Page URL directly.
**EN LANDING ACCESS**: the canonical Production English Landing Page URL directly.

**RELATION TO PRODUCTION**: **SAME EXACT PRODUCTION DEPLOYMENT** — this is the canonical domain itself (not an alias, not a preview, not older), and is additionally proven byte-identical to `quotecode.vercel.app`'s current build via matching content-hashed asset filenames. This is the simplest possible access method: no new infrastructure, no `.vercel.app` dependency, no TEST exposure, no tunnel.

**INTERACTIVE**: YES — it is the live, fully interactive Production site.

**HE VIDEO**: the HE demo video's public static URL, served directly from the canonical domain.
**EN VIDEO**: the EN demo video's public static URL, served directly from the canonical domain.
Both live-verified this task via an HTTP range request: `206 Partial Content`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`, no authentication challenge, no expiring token.

**NO SECRET REQUIRED: PASS** — every recommended URL is a plain public HTTPS URL.

**Caveat disclosed**: these URLs reflect whatever is live at the moment they're visited. Since no authenticated Vercel access was available this session, a permanently version-pinned historical-deployment URL could not be discovered as an alternative — if this matters (e.g., ChatGPT's review must be pinned to today's exact build even after a future deploy), that would require a separate, explicitly-authorized Vercel-access task.

========================================
**PRODUCTION CHANGE**
========================================

**PRODUCTION DOMAIN MUTATION PERFORMED: NO**

**OWNER AUTHORIZATION REQUIRED FOR NEXT STEP: YES**

**EXACT PROPOSED NEXT CHANGE** (not performed, awaiting authorization): configure a permanent (301/308) redirect at the Vercel project Domain layer from `quotecode.vercel.app/*` to `https://www.quotecodepro.com/*`, preserving path and query string. This does not require any Supabase Auth Site URL / redirect allow-list change (those already list `www.quotecodepro.com`-based URLs as the primary/hardcoded targets for every flow that matters, per the ledger above) and does not require any application code change.

========================================
**LOCKED REGRESSION**
========================================

**APPLICATION UI MUTATED: NO**
**SIGNATURE SECURITY: UNCHANGED**
**CANONICAL WIDTH: UNCHANGED**
**MOBILE HE/EN ORDER: UNCHANGED**
**TRIAL NOTICE: UNCHANGED**

(No application file was touched this task — audit and documentation only.)

========================================
**CONTINUITY**
========================================

**REMOTE CONTINUITY READ-BACK: PASS** (see sync confirmation in this task's delivery).

========================================
**FRESH LOCAL STATE**
========================================

**MAIN HEAD**: `b5583e59d4dab0b2c7741df8fdc1110f32b4d972`
**REMOTE MAIN**: `b5583e59d4dab0b2c7741df8fdc1110f32b4d972` (confirmed matching)
**WORKING TREE**: unchanged from before this task — the same pre-existing uncommitted application/migration files, plus the four continuity docs now further updated by this task's own audit findings.
**PRODUCTION: UNCHANGED.**

**No `quotecode.vercel.app` removal performed. No redirect added. No Supabase URL changed. No DNS changed. No deploy. No Landing Page redesign begun.**

**Awaiting Owner + ChatGPT decision.**
