# ProFlow — Master TODO / Work Backlog

This is the **authoritative living backlog / roadmap** for ProFlow. It is one of the project's three permanent continuity documents:

- `PROFLOW_PROJECT_CONTEXT.md` = durable project truth (architecture, iron rules, verified findings, continuity protocol).
- `PROFLOW_HANDOFF.md` = exact operational checkpoint / resume state for the next session.
- `PROFLOW_TODO.md` (this file) = the living backlog: every known work item, its status, dependencies, and verification requirements.

Do not duplicate architecture or checkpoint detail here — reference `PROFLOW_PROJECT_CONTEXT.md` / `PROFLOW_HANDOFF.md` sections instead of copying their content.

## Status Legend

- 🟢 COMPLETE / VERIFIED
- 🟡 AUDIT / DECISION / VERIFICATION REQUIRED
- 🔴 OPEN / NOT IMPLEMENTED
- ⚪ DEFERRED / FUTURE

Statuses below reflect only what has actually been verified elsewhere in the continuity documents — no completion state is invented in this file.

## Current Recommended Execution Order

1. **Owner-approved next primary workstream: Public Quote + User UI Visual Redesign, Desktop + Mobile (item 14)** — design-first: visual examples/mockups reviewed and explicitly approved by the owner before any implementation begins.
2. Complete live visual verification of **Auth / Routing Localization Phase 1** (item 12, Findings A/D/E/H) and continue **Owner + ChatGPT Visual Acceptance** (item 13) alongside/after item 14's design phase, as the owner directs.
3. Any fix for Finding C or Finding F (item 12) only after their own separate audit/authorization.
4. Then continue through the remaining open backlog items (3, 6, 7, 8, 9, 10, 11, and the item-2 follow-up) one subject at a time, per the Working Rule below.

This ordering is a recommendation, not a permanent override — the owner may reprioritize at any time.

## Working Rule — ONE SUBJECT AT A TIME

For each open backlog subject, the established project workflow is:

1. READ-ONLY AUDIT.
2. Claude reports current implementation and dependencies.
3. Owner + ChatGPT review findings.
4. Explicit owner approval before any modification.
5. Minimal/safe implementation.
6. Focused verification.
7. Owner verification where appropriate.
8. Documentation checkpoint.
9. Explicit owner approval before commit/push.
10. Commit/push only after approval.

All project iron rules (Local/International market separation, David Aluminum protection, TEST-account-only QA, etc. — see `PROFLOW_PROJECT_CONTEXT.md`) apply throughout every item below. No item in this backlog implies automatic permission to modify code or to commit/push — each remains its own explicit-authorization gate.

---

## 1. Super Admin UI and Permissions

**Status: 🟢 COMPLETE / VERIFIED**

Substantial Admin UI, permission hardening, and security work has already been completed and verified. Do not reopen this area without a defined reason. Future changes anywhere in the app must preserve the verified permission/security mechanisms already in place (role model, RLS, `is_admin()`/`is_super_admin()` helpers — see `PROFLOW_PROJECT_CONTEXT.md` §13–§15).

## 2. AI Chat — Local / International / Four Contexts

**Status: 🟢 MAIN WORK COMPLETE / VERIFIED — one OPEN follow-up**

Verified market separation, preserved as-is:
- **Local/Israel**: Hebrew landing, Hebrew user UI, ILS/₪ only.
- **International**: English landing, English user UI, allowed currencies USD/EUR/GBP, ₪ prohibited.

Verified message classifications, preserved as-is: `GENERAL`, `CANCELLATION`, `FEATURE_REQUEST`, `HARD_QUESTION`. AI Support Logs functionality preserved.

**OPEN follow-up (NOT complete)**: Admin indicator beside AI Support Logs —
- green when no new exceptional messages exist;
- red + counter when new `CANCELLATION` or `HARD_QUESTION` messages exist;
- `FEATURE_REQUEST` does not trigger the alert;
- after Admin reviews exceptional messages, counter resets and indicator returns green.

Do not mark this follow-up complete until implemented and verified.

## 3. Real Billing + Invoicing

**Status: 🔴 OPEN / NOT IMPLEMENTED**

Preserve the iron market separation:
- **Local**: Hebrew + ILS/₪ + applicable Israeli VAT rules.
- **International**: English + USD/EUR/GBP only + no ₪ + applicable international tax/VAT policy.

Required chain: Pricing → Plan selection → Checkout → Payment → Subscription → Invoice/Receipt → Email.

**Important**: do not begin Billing integration before a read-only audit of current subscription state and an explicit decision on the source of truth for paid subscriptions.

## 4. Approved Quote — User Deletion Protection

**Status: 🟢 COMPLETE**

After approval, a quote cannot be deleted by the user. Protection is not UI-only — the existing system/DB-level protection must be preserved. No separate Super Admin delete mechanism is currently required unless a future business requirement defines one.

## 5. SEO / Google Indexing

**Status: 🟡 CODE FIX COMPLETED / GOOGLE-SIDE VERIFICATION REQUIRED**

Canonical/hreflang and Local/International SEO separation were already addressed in code. The next step is **not** another blind code change — it requires inspecting Google-side state: Search Console, sitemap, indexing status, a re-index request if needed, and confirmation of which Local/International pages are actually indexed. Goal: confirm Google correctly understands and indexes both variants before making further SEO code changes.

## 6. New-User Password Recommendation

**Status: 🔴 OPEN**

Signup should display a strength **recommendation** only (e.g. recommend letters, numbers, special characters, and at least one uppercase letter). Do **not** convert this into an additional hard signup requirement, and do not block signup beyond the existing minimum password rules.

## 7. Support / Info Email System

**Status: 🔴 OPEN — PREVIOUSLY WORKED / REQUIRES AUDIT + RESTORATION**

Official addresses: `support@quotecodepro.com` → Local/Hebrew; `info@quotecodepro.com` → International/English.

Restore previously-working behavior:
- **Auto-reply**: `support` → Hebrew acknowledgement; `info` → English acknowledgement.
- **Central Gmail**: both inboxes forwarded/centralized into the main Gmail inbox.
- **Correct reply-from**: Support correspondence replies as `support@...`; International correspondence replies as `info@...` — never from the private Gmail address.

Before changing anything, audit: private email, forwarding, auto-reply, Gmail "Send mail as", and reply-from behavior. Goal: restore what worked — do not build a new mail architecture unless necessary.

## 8. Application Session Timeout

**Status: 🟡 AUDIT + DECISION REQUIRED**

Audit current behavior: session lifetime, refresh-token/session behavior, inactivity behavior, whether users can remain logged in indefinitely, and confirm multi-device behavior remains supported. After the audit, decide whether an inactivity timeout is desirable — 30 minutes is an **example only**, not an approved requirement. If a timeout is eventually implemented: never disconnect an actively-working user unexpectedly, and never cause loss of unsaved quote/work.

## 9. Email CTA for Renewal / Plan Selection

**Status: 🔴 VERIFIED ISSUE / OPEN**

Observed: the trial-ending/renewal email CTA leads to Login instead of the subscription/plan-selection area. Desired: CTA → plan/subscription selection directly, without requiring Login merely to view renewal options. If authentication becomes necessary later for payment/account association, perform it at the appropriate stage while preserving the user's selected plan and purchase intent. Preserve market separation: Local = Hebrew + ₪; International = English + USD/EUR/GBP, no ₪.

## 10. Address Display — Remove Technical "|"

**Status: 🔴 OPEN**

Replace user-visible address formatting such as `Herzl 10 | Tel Aviv | 6123456` with natural display formatting such as `Herzl 10, Tel Aviv, 6123456`. Audit every relevant display location: application UI, quotes, Public Quote, PDF/print, emails, and any other customer-visible output.

**Important**: treat this initially as a **display-only** requirement. Do not change DB storage format/schema until dependencies are understood.

## 11. Order Email Optional — Preserve Validation + Bounce

**Status: 🔴 OPEN**

Customer/order email must not be mandatory. If no email is entered, order creation continues normally without blocking. If an email **is** entered, existing validation remains mandatory and the email must be syntactically valid.

**Critical**: preserve the existing Email Bounce mechanism — if an email is sent and a bounce/invalid-address result is received, preserve the existing user warning (red indicator + message explaining the email was not delivered because the address is invalid/unavailable).

Required pre-change audit: UI, validation, DB/schema, mail sending, bounce handling. Find exactly where "required" is currently enforced and remove **only** that requirement.

## 12. Auth / Routing Localization Consistency

**Status: 🟡 IMPLEMENTED IN WORKING TREE — STATIC VERIFICATION PASSED / LIVE VISUAL VERIFICATION STILL PENDING** (Implementation Phase 1 — known-root-cause UI fixes only; ESLint/build/test all passed; not yet live/visually verified)

**Phase 1 scope**: `src/components/AuthScreen.jsx` now accepts an explicit `bundleIsHebrew` boolean prop (passed from `Dashboard.jsx`, which already receives it from `AppLocal`/`AppGlobal`) and prefers it over the previous independent pathname/`?lang=`/`localStorage.proflow_lang` guess for the pre-auth loading screen, login form, signup form, and post-logout login screen (the old cascade is retained only as a fallback for the case the component is ever rendered without a real boolean). `Dashboard.jsx`'s signup-success message (Fix 2) and login-success message (Fix 3) now use `bundleIsHebrew` instead of `isHebrew`. This targets Findings **A, D, E, H** below. Findings **C** (cause UNKNOWN, `SignOutModal.jsx` untouched) and **F** (external Supabase email template) remain explicitly untouched and OPEN. No signup_market, `business_settings`, or currency/quote logic was changed.

**Important**: this item is separate from signup-market preservation, which remains:

**BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION: 🟢 LIVE VERIFIED** — do not reopen that completed fix.

This item concerns inconsistent transient/Auth/email UI language around the otherwise-correct Local/International account state. Full source-of-truth detail: `PROFLOW_PROJECT_CONTEXT.md` §31–§34, `PROFLOW_HANDOFF.md` §18.AG–§18.AI.

Screen-level findings summary (see those sections for full mechanism/file detail):

| # | Finding | Expected | Observed | Status |
|---|---|---|---|---|
| A | International transient loading screen | English | Hebrew | 🟡 Fix implemented in working tree — static verification passed, live visual verification pending |
| B | International final Dashboard | English/International/USD | English/International/USD | **PASS** |
| C | International logout confirmation | English | Hebrew | OPEN — **CAUSE UNKNOWN** (explicitly out of Phase 1 scope) |
| D | International post-logout login screen | English | Hebrew | 🟡 Fix implemented in working tree — static verification passed, live visual verification pending |
| E | Local post-signup success message | Hebrew | English | 🟡 Fix implemented in working tree — static verification passed, live visual verification pending |
| F | Local confirmation email | Hebrew | English | OPEN — OWNER-OBSERVED, template/config source outside this repo (explicitly out of Phase 1 scope) |
| G | Local final Dashboard | Hebrew/RTL/ILS/₪ | Hebrew/RTL/ILS/₪ | **PASS** |
| H | Local login-success notification | Hebrew | English ("Logged in successfully") | 🟡 Fix implemented in working tree — static verification passed, live visual verification pending |

**DEVICE DEPENDENCY: NOT PROVEN.** Do not claim device/browser is the cause of any of the above. Finding C's cause remains explicitly UNKNOWN — do not invent a root cause or mark it fixed until a controlled live reproduction identifies the actual mechanism.

## 13. Owner + ChatGPT Visual Acceptance — Local vs International

**Status: 🟡 IN PROGRESS — partial anonymous-routing evidence recorded / NOT YET COMPLETED**

Purpose: visually verify, screen by screen, that the real production user experience preserves — Local: Hebrew, RTL, ILS/₪; International: English, LTR, USD/EUR/GBP as applicable, no ₪. This is an eyes-on acceptance pass, not merely DB/code verification.

**Evidence recorded so far** (Owner Desktop Browser, clean incognito session, Local market only):
1. Root `https://www.quotecodepro.com/` automatic Local selection — **PASS**.
2. Local Landing → Login screen — Hebrew/RTL — **PASS**.
3. Local Login → Signup screen — Hebrew/RTL — **PASS**.

These three checks cover only anonymous, unauthenticated Local-market routing/landing/login/signup screens on one environment. **Not yet covered / do not claim complete**: authenticated Local Dashboard visual acceptance; any International-market check, including automatic International routing; Owner Mobile or Agent Desktop Browser environments; and every other surface listed below. Do not mark any untested surface PASS.

Relevant real-user surfaces to include: automatic anonymous entry/routing, Landing, Login, Signup, Auth/loading messages, Dashboard, customers, quote creation/editing, totals/tax/currency presentation, Public Quote, PDF/print where applicable, emails where applicable, Settings, subscription/pricing surfaces where currently accessible, Logout/post-logout behavior.

Use the precision rule documented in `PROFLOW_PROJECT_CONTEXT.md` §33. Every visual test instruction must specify: environment, exact account, session state, exact starting URL, exact action, exact screen/state, expected result, what the test proves, and what it does not prove.

**Important**: manual `/he` does not prove automatic Local routing; manual `/en` does not prove automatic International routing. Automatic routing must be tested independently from the exact root `https://www.quotecodepro.com/`, with a specifically-defined clean starting state — see `PROFLOW_PROJECT_CONTEXT.md` §31.C/D.

## 14. Public Quote + User UI Visual Redesign — Desktop + Mobile

**Status: 🟡 DESIGN-FIRST / NOT STARTED — awaiting visual mockups and owner approval**

**This is the owner's NEXT PRIMARY WORKSTREAM** after the checkpoint that established this item is committed.

Purpose: a visual/UX redesign review covering two related but distinct customer/user-facing surfaces:

**A. Public Quote / Customer-Facing Quote Experience** — Desktop + Mobile. Visual redesign/review of the quote that the end customer receives/sees (Public Quote pages, PDF/print presentation where applicable).

**B. Authenticated User Application UI** — Desktop + Mobile. Visual review/redesign of the working interface used by the ProFlow business user (the authenticated Dashboard and its tabs/screens).

**Important scope boundary**: this is a **visual/UX workstream only**. It does not authorize any change to business logic, quote calculations, database schema, currency rules, permissions, or production behavior — those remain governed by their own separate, explicitly-authorized workstreams (e.g. item 3 Billing, the currency/VAT iron rules in `PROFLOW_PROJECT_CONTEXT.md`).

**MANDATORY DESIGN-FIRST RULE — no UI implementation may begin until:**
1. Current relevant screens are visually reviewed.
2. Desktop and Mobile are considered separately.
3. Proposed visual examples/mockups are shown to the owner.
4. Owner explicitly approves the desired visual direction.
5. Only then may a separately-authorized implementation task begin.

The owner must **see** the proposed design before any code change — mockups/examples first, implementation only after explicit approval.

**Preserve throughout** (applies to any future implementation phase, not to the design phase itself): strict Local/International separation (Local = Hebrew/RTL/ILS/₪; International = English/LTR/supported international currencies, no accidental ₪ contamination); existing quote calculations/business logic must not be altered merely for a visual redesign; existing live production behavior must be protected; **David Aluminum's live production usage must not be disrupted or placed at risk**; prefer conservative, isolated visual changes after approval.

No Public Quote or authenticated-UI code has been modified as part of establishing this item — design phase has not started.

---

*This file must be updated whenever a backlog item's status materially changes. See `PROFLOW_PROJECT_CONTEXT.md`'s continuity protocol for the full 3-file responsibility split.*
