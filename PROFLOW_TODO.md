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

1. **Owner-approved primary workstream: item 14 (Public Quote + User UI Visual Redesign)** — Business Owner Dashboard (14.B) Desktop has had four implementation passes; the owner has reviewed the fourth (image-corrected) pass and requires five further specific changes (Catalog → own tab, Quote History full width, remove duplicate New Quote CTA, denser rows, updated nav set — see 14.B for the exact list) before Desktop final acceptance. **That next implementation is approved-in-direction but NOT yet authorized to start** — a separate task must explicitly authorize it. Public Quote (14.A) and Super Admin (14.C) each have implementation already in the working tree from earlier passes, neither owner-reviewed yet.
2. Once a future task explicitly authorizes it: implement the five owner-approved Desktop changes for 14.B, then return for owner review again.
3. Separately, whenever authorized: owner review of the existing 14.A/14.C working-tree implementations (already done, not yet inspected), or further implementation on either as separately authorized.
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
- **IMPLEMENTATION**: 🟢 DONE (overnight pass — see `PROFLOW_HANDOFF.md` §18.AQ). `PublicQuoteHeader.jsx` (shared by Local + International) now has a strong purple gradient header band, sender logo on a white plate, and a `"חייג/י אליי"`/`"Call me"` CTA button (`tel:` link, number not shown on the button). `PublicQuote.jsx` (Local) and `PublicQuoteEn.jsx` (International) both updated: recipient info in a purple-accented callout card, attachments section now **always visible** (explicit `"אין קובץ מצורף להצעה זו"` / `"No attachment included with this quote."` when empty), totals emphasized in purple, approve/sign CTA switched from flat green to the purple gradient (pre-approval — post-approval confirmation stays semantic green, unchanged), mobile-responsive padding added. Signature area unchanged structurally (already matched spec: one signature area, pad, clear control, approve button) — only its color/prominence changed.
- **LIVE VERIFICATION**: Desktop + Mobile **PASS** for the Local page (real quote, real screenshots — see §18.AQ). International page verified by code mirroring only, **not live-tested** (time budget). Signing/attachment-link interaction **not exercised** (would irreversibly lock a real TEST quote — deliberately not tested, same reasoning as Phase 2).
- **OWNER FINAL VISUAL ACCEPTANCE**: 🟡 PENDING.
- **COMMIT/PUSH/DEPLOY**: 🔴 NOT AUTHORIZED.
- Recorded minor item: on narrow mobile widths the item table's columns wrap text more than ideal (data still correct, not a functional defect) — not addressed this pass.

### 14.B Business Owner Dashboard — Desktop + Mobile

- **DESIGN**: 🟢 APPROVED IN PRINCIPLE (owner + ChatGPT). The actual mockup **image** was shown to Claude for the first time in the fourth pass below — all three earlier passes were implemented from text descriptions only.
- **FIRST IMPLEMENTATION** (Phase 1+2): light reskin — **OWNER VISUAL REVIEW REJECTED** (see §18.AN/§18.AO — preserved as historical record).
- **SECOND IMPLEMENTATION** (overnight pass, §18.AQ): purple header band, segmented pill nav, unified KPI/hot-quote row — **OWNER VISUAL REVIEW REJECTED** ("colors/header changed, but the page still retained too much of the old Dashboard composition") — preserved as historical record.
- **THIRD IMPLEMENTATION** (§18.AR, strict-visual-match text instruction, still no image shown): standalone New Quote CTA, two-column work area, business-identity header — implemented from text description only, not yet reviewed by the owner before the fourth pass superseded it — preserved as historical record.
- **FOURTH IMPLEMENTATION** (this pass — the owner's real approved mockup **image** was provided for the first time — see `PROFLOW_HANDOFF.md` §18.AS): 🟢 DONE — Desktop only, corrected against the actual image, not a text description:
  - **Nav row rebuilt to match the image exactly**: individual white bordered buttons (Finances/Clients/Settings, + Admin if Super Admin) instead of a shared pill-track container; the current tab is not shown as a nav item (matches the image, which shows no "Quotes" button while already on the Quotes page); purple "New Quote" CTA at the row's end.
  - **KPI card order and style corrected to match the image**: visual left-to-right order is now Revenue → Quotes count → Hot Quote (previously wrong order); icon badges changed from filled-tint circles to white-background/colored-border squares, matching the image.
  - **Two-column work area corrected — this was backwards before**: the image shows Quote History wide on the **left** and Catalog narrow on the **right**. Under this app's RTL layout, naive grid column definitions do the opposite by default; this was fixed with matching DOM-order + column-width flips (documented inline in the code) rather than overriding `direction`, so neither component's own internal RTL logic was touched. Live-verified: now renders exactly as the image shows.
  - Header identity (logo-container/business-name fallback) and standalone New Quote CTA from the third pass carried forward unchanged — both already matched the image.
  - Every handler/prop/state preserved — confirmed by diff review and live re-testing: New Quote CTA opens the real form, Clients-tab switch loads real data, catalog search still filters correctly (typed "20" → 1 of 2 items) after the DOM reorder.
- **LIVE VERIFICATION (fourth pass)**: Desktop **PASS**, compared directly against the provided mockup image (Local TEST_USER1, screenshots + functional re-tests as above). Mobile only sanity-checked (loads, doesn't break) — not a full Mobile pass, per explicit Desktop-only scope. International not re-tested this pass.
- **OWNER REVIEW OF FOURTH PASS (current state)**: the owner has inspected the fourth-pass localhost result. Verdict: **substantially closer to the approved visual reference, but NOT finally accepted** — additional UX changes are required before Desktop acceptance. **Desktop OWNER FINAL VISUAL ACCEPTANCE: 🔴 PENDING / CHANGES REQUIRED** — do not describe it as complete.
- **NEXT OWNER-AUTHORIZED DESKTOP CHANGES (not yet implemented — this is a documentation checkpoint only)**:
  1. **Catalog moves out of the main Dashboard view entirely**, becoming its own top-navigation tab ("קטלוג") — reuse all existing Catalog functionality (Add/Edit/Delete, prices/data, persistence, search) unchanged; no DB/schema change.
  2. **Quote History becomes full width** once Catalog is removed from the main view — improves readability/spacing/column widths.
  3. **Remove the duplicate New Quote CTA**: keep only the top-level standalone "הצעת מחיר חדשה" button; remove the second "צור הצעת מחיר חדשה" button that currently also appears inside the Quote History panel itself. CSV/Excel export stays inside Quote History.
  4. **Reduce Quote History row density** — target ~25–35% less vertical row padding/height where safe; long identifiers/customer content should not force extra row height — safe truncation/ellipsis may be used.
  5. **Target top navigation after this next change**: הצעת מחיר חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג.
  - **Header/business-identity rule preserved unchanged**: logo (if any) in a white/neutral container, `object-fit: contain`, aspect ratio preserved, visible regardless of logo color; business name as clean prominent text if no logo; ProFlow logo never used as this fallback.
  - **Visual-reference precedence**: the provided mockup image remains the Desktop visual source of truth **except** where the five owner decisions above explicitly supersede it (i.e. the image's original single-column-with-side-catalog composition is now superseded for the Catalog/Quote-History-width/duplicate-CTA/row-density points specifically).
- **COMMIT/PUSH/DEPLOY OF UI**: 🔴 NOT AUTHORIZED. **Implementation of the five changes above is NOT authorized by this checkpoint** — this entry only records what the owner has approved as the *next* direction; a separate task must explicitly authorize starting that implementation.
- Remaining recorded open sub-item (unchanged from prior passes): Clients/Finances/Settings were not rebuilt into mobile-card layouts. Minor recorded item: the narrower Catalog column (fourth pass) wrapped its "Add to Catalog" form fields onto more lines than the image showed — moot once Catalog becomes its own full-width tab per change #1 above.

### 14.C Super Admin — Light Redesign

- **DESIGN**: 🟢 APPROVED (owner + ChatGPT) — light visual direction. Visual/design approval only.
- **IMPLEMENTATION**: 🟡 PARTIAL — `AdminUsersTab.jsx` switched to the light theme (same alias technique) and given a module title bar (icon + "User & Business Management" heading) above its existing KPI-card row (which already used an icon-badge pattern, now light-themed). Given the file's size/complexity (1049 lines, "complex administrative tool") and remaining time, this pass did **not** attempt a full structural rework of its table/filters/mobile-accordion layout the way 14.B's shell was reworked — it is a real visual pass (not a no-op), but less structurally transformed than 14.A/14.B.
- **LIVE VERIFICATION**: 🔴 **BLOCKED** — the browser-harness login attempt for the `PROFLOW_TEST_ADMIN` account was denied by the Claude Code auto-mode permission classifier (same denial as the earlier Phase 2 attempt). Per the harness's own explicit instruction, this was not worked around or retried. Verified at the code level only: ESLint clean, build succeeds, no helper-function theme mismatch found (confirmed no `neonGhostButtonStyle`-style dark-bound helpers are used in this file).
- **OWNER FINAL VISUAL ACCEPTANCE**: 🟡 PENDING.
- **COMMIT/PUSH/DEPLOY**: 🔴 NOT AUTHORIZED.
- **Owner question**: is a further, deeper structural redesign of Super Admin (matching 14.B's level of compositional rework) wanted in a follow-up pass, and can the classifier-blocked admin-login testing path be explicitly authorized/unblocked for a future live-verification attempt?

## 15. New Version Available / Safe Refresh Notification

**Status: 🔴 OPEN / NOT IMPLEMENTED**

**This is a FUTURE TODO item. It must not interrupt or replace the currently approved item 14.B Dashboard Desktop work, and is not part of any current implementation pass.**

**Requirement**: ProFlow should provide a clear in-app notification when a newer application version becomes available while a user is already using the system, to prevent users from unknowingly continuing to work on an outdated frontend bundle after a new version has been released. The notification should provide a clear user action to refresh/reload ProFlow and load the current version.

**Important**: a screenshot/example was previously discussed as **conceptual reference only** — its wording must not be copied. The final ProFlow notification text, visual design, placement, and interaction must be separately reviewed and approved by the Owner before implementation.

**Critical safe-refresh requirement**: a refresh must **not** blindly destroy unsaved user work. Before any automatic or user-triggered refresh mechanism is implemented, the design must account for situations where the user is currently editing unsaved data — including forms such as the Quote Form or other editable business data — and must safely protect against accidental loss of unsaved changes. Exact UX/technical behavior is **not decided yet** and must be designed/reviewed before implementation.

**Do NOT infer authorization for**: automatic forced refresh; automatic reload timers; discarding unsaved changes; background deployment behavior; service-worker changes; PWA changes.

---

*This file must be updated whenever a backlog item's status materially changes. See `PROFLOW_PROJECT_CONTEXT.md`'s continuity protocol for the full 3-file responsibility split.*
