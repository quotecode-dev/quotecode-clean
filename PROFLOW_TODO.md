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

1. **Owner-approved primary workstream: item 14 (Public Quote + User UI Visual Redesign)** — Business Owner Dashboard (14.B) is implemented in the working tree and awaiting the owner's final visual acceptance; Public Quote (14.A) and Super Admin (14.C) have approved visual direction but implementation has not started for either.
2. Once the owner reviews 14.B's implemented result: either approve for a separately-authorized commit/push, or request adjustments (minor refinements were pre-approved as expected).
3. Implement 14.A (Public Quote) and/or 14.C (Super Admin) as separately authorized, each on its own approved direction (see item 14 above).
4. Complete live visual verification of **Auth / Routing Localization Phase 1** (item 12, Findings A/D/E/H) and continue **Owner + ChatGPT Visual Acceptance** (item 13), as the owner directs.
5. Any fix for Finding C or Finding F (item 12) only after their own separate audit/authorization.
6. Then continue through the remaining open backlog items (3, 6, 7, 8, 9, 10, 11, and the item-2 follow-up) one subject at a time, per the Working Rule below.

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

## Permanent Question / Ambiguity Rule

Within any single authorized task, if Claude gets stuck, hits a genuine question, or finds a real ambiguity on one specific sub-item:

1. Document the exact question/problem.
2. Block **only** that sub-item.
3. Continue immediately with the next independent, safe item.

Do **not** stop an entire task/workstream because of one isolated question — record it and keep moving through everything else that is safe and independent of it. The only exception: stop completely if continuing could risk production, security, real customer data, or any other destructive/unrecoverable change — those always warrant a full stop, not just a blocked sub-item.

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

**Status: 🟡 IN PROGRESS — see three sub-items below, each with its own design/implementation/acceptance status**

Purpose: a visual/UX redesign covering three related but distinct surfaces. Owner + ChatGPT approved visual direction for all three in a separate conversation (owner-confirmed, not independently re-derived by Claude); each is tracked below with its own precise status — design approval, implementation, and owner final visual acceptance are three separate gates, never conflated.

**Important scope boundary (applies to all three)**: this is a **visual/UX workstream only**. It does not authorize any change to business logic, quote calculations, database schema, currency rules, permissions, or production behavior — those remain governed by their own separate, explicitly-authorized workstreams (e.g. item 3 Billing, the currency/VAT iron rules in `PROFLOW_PROJECT_CONTEXT.md`). Preserve throughout: strict Local/International separation (Local = Hebrew/RTL/ILS/₪; International = English/LTR/supported international currencies, no accidental ₪ contamination); existing calculations/business logic must not be altered merely for a visual redesign; existing live production behavior must be protected; **David Aluminum's live production usage must not be disrupted or placed at risk**; conservative, isolated visual changes; minor visual refinements remain expected/allowed after the owner sees an implementation.

### 14.A Public Quote — Desktop + Mobile

- **DESIGN**: 🟢 APPROVED IN PRINCIPLE (owner + ChatGPT).
- **IMPLEMENTATION**: 🔴 NOT STARTED. **Not authorized in the Business Owner Dashboard implementation task** — explicitly excluded from that task's scope; to be implemented separately.
- **OWNER FINAL VISUAL ACCEPTANCE**: N/A — nothing implemented yet.
- Approved direction (for the future implementation task): light/white content, strong ProFlow purple header/hierarchy (not black), sender logo in header, recipient/business/address emphasized, call CTA text `"חייג/י אליי"` without displaying the phone number on the button, exactly ONE customer signature area (`"חתימת לקוח לאישור ההצעה:"` label, signature pad, `"נקה חתימה"` control, approval/sign action), attachments area always visible (list attachments if present, else show `"אין קובץ מצורף להצעה זו"` or equivalent), existing attachment/signature functionality fully preserved.
- **Do not describe this as implemented merely because the design is approved.**

### 14.B Business Owner Dashboard — Desktop + Mobile

- **DESIGN**: 🟢 APPROVED IN PRINCIPLE (owner + ChatGPT).
- **FIRST IMPLEMENTATION**: 🟢 COMPLETED / LIVE VERIFIED (Desktop + Mobile, Local + International, per Phase 1 + Phase 2 — see `PROFLOW_HANDOFF.md` §18.AN/§18.AO) — **BUT OWNER VISUAL REVIEW REJECTED IT.** The owner inspected this first implementation and rejected it for final visual acceptance because it was primarily a **light reskin of the old layout**, not the approved redesign.
- **CURRENT RESULT**: 🔴 **CHANGES REQUIRED** — do not describe this first implementation as owner-approved anywhere in these documents.
- **NEXT IMPLEMENTATION**: 🟡 AUTHORIZED — a further implementation pass is authorized once concrete direction on what "changes required" means is available; do not restart from scratch without that direction, and do not silently reinterpret it.
- **OWNER FINAL VISUAL ACCEPTANCE**: 🟡 PENDING (still pending — the rejected pass does not count toward it).
- **COMMIT/PUSH/DEPLOY OF UI**: 🔴 NOT AUTHORIZED.
- Delivered: light theme (near-white background, white cards, sharp borders, ProFlow purple primary, semantic green/red) across the Dashboard shell, KPI cards, hot-quote card (now a compact attention card, not a full-width banner), Quote History (light table + a genuine JS-driven mobile card layout, not a shrunk table), Clients/Finances/Settings/QuoteForm (color pass only), and `DeleteConfirmModal.jsx` (fixed during Phase 2, see below). Catalog search field added beside "Add to Catalog" (client-side, filters on `name` — the catalog data model has no `description` field, recorded as a finding, not blocking) — **live-tested**: filters immediately while typing, clears correctly, non-matching search shows a distinct "no results" message, Hebrew text works. Super Admin (`AdminUsersTab.jsx`) and every Public Quote file remain **not** touched.
- **Two real issues found and fixed during Phase 2 live QA** (per the record→continue rule, neither stopped the overall verification): (1) the mobile/desktop Quote History switch relied on a `matchMedia` `change` listener that did not reliably fire on a CDP/automated viewport change even though a fresh `matchMedia` query correctly reflected the new width — fixed by adding a redundant native `window resize` listener that re-evaluates the query; re-verified both directions work without a reload. (2) `DeleteConfirmModal.jsx` (used for deleting quotes/catalog items) was still calling a dark-theme-bound helper function (`neonGhostButtonStyle`, which reads the real dark `NEON` internally regardless of the caller's own theme import) — fixed by aliasing its import and inlining an equivalent light-themed button style.
- **Correction to the prior "modals remain dark" finding**: only `DeleteConfirmModal.jsx` (now fixed above) and `UserDetailsModal.jsx` (correctly out of scope — Super Admin) actually import the dark `NEON` theme. `SignOutModal.jsx`, `EditClientModal.jsx`, `EditExpenseModal.jsx`, `EmailConfirmModal.jsx`, `LifetimeConfirmModal.jsx`, `PricingModal.jsx`, and `AccessibilityModal.jsx` never used `NEON` tokens at all (hardcoded white/light already) — confirmed live for `SignOutModal.jsx` by screenshot. The earlier report over-stated this as a broader open item than it actually is.
- Remaining recorded open sub-item: Clients/Finances/Settings were not rebuilt into mobile-card layouts (only Quote History had an explicit mobile-card spec) — unchanged from the prior report, not addressed in Phase 2.

### 14.C Super Admin — Visual Direction Only

- **DESIGN**: 🟢 APPROVED (owner + ChatGPT) — the LIGHT Super Admin visual direction. **Visual/design approval only — does not imply approval of any unrelated functional change.**
- **IMPLEMENTATION**: 🔴 NOT STARTED — explicitly out of scope for the Business Owner Dashboard implementation task; `AdminUsersTab.jsx` was not modified.
- **OWNER FINAL VISUAL ACCEPTANCE**: N/A — nothing implemented yet.
- Regression verification only was performed on Super Admin this round (code-level: confirmed zero changes, so nothing to regress) — this is not the same as implementing its approved light direction.

---

*This file must be updated whenever a backlog item's status materially changes. See `PROFLOW_PROJECT_CONTEXT.md`'s continuity protocol for the full 3-file responsibility split.*
