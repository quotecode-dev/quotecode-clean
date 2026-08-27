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

1. **Owner-approved primary workstream: item 14 (Public Quote + User UI Visual Redesign)** — Business Owner Dashboard (14.B) has had seven implementation passes and Public Quote (14.A) has had a header-compaction plus a full-width-responsive correction; both Desktop and Mobile, Hebrew and English, are now implemented and bilaterally live-verified in the working tree (see 14.A/14.B for full detail — toolbar RTL/LTR fix, New Quote nav-group + cross-tab fix, Catalog Mobile reachability restored, Public Quote full-width responsive layout). A LAN-accessible TEST server is running for physical-phone inspection (see 14.B's "Physical-phone test readiness" note for the exact URL). **OWNER FINAL VISUAL ACCEPTANCE remains PENDING for both 14.A and 14.B** — implemented and live-verified in the working tree only, awaiting Owner + ChatGPT visual inspection. Super Admin (14.C) has implementation already in the working tree from an earlier pass, not yet owner-reviewed.
2. Once reviewed: further refinement per owner feedback, or move toward LIVE approval per Permanent Rule §36 once both 14.A and 14.B are finally accepted.
3. Separately, whenever authorized: owner review of the existing 14.A/14.C working-tree implementations (already done, not yet inspected), or further implementation on either as separately authorized.
4. Complete live visual verification of **Auth / Routing Localization Phase 1** (item 12, Findings A/D/E/H) and continue **Owner + ChatGPT Visual Acceptance** (item 13), as the owner directs.
5. Any fix for Finding C or Finding F (item 12) only after their own separate audit/authorization.
6. Then continue through the remaining open backlog items (3, 6, 7, 8, 9, 10, 11, 15, and the item-2 follow-up) one subject at a time, per the Working Rule below.

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

**Three permanent workflow rules govern this process for every item above**, in full detail in `PROFLOW_PROJECT_CONTEXT.md` §36/§37/§38: steps 5–10 above must never skip straight to LIVE/production merely because a TEST/dev pass (including any Claude/agent/lint/build/test verification) succeeded — explicit owner approval for LIVE remains a separate, later gate (§36); any UI/UX item touching both markets must implement Local and International in the same work pass, verified and reported separately (§37); and every task on any item above must open with an explicit `EFFORT LEVEL` declaration, chosen by the task's actual risk/scope/complexity — never by remaining usage — and never used to justify touching more than the task itself defines (§38).

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
- **HEADER COMPACTION CORRECTION** (owner-approved, this pass — see `PROFLOW_HANDOFF.md` §18.AW): the owner reviewed the purple header and found its vertical proportions too tall/heavy. `PublicQuoteHeader.jsx` (the single component shared by both `PublicQuote.jsx` and `PublicQuoteEn.jsx`, so this fix applies to both markets in one pass by construction) had its padding/margins/font-sizes/logo size reduced roughly 30-40% across the board (outer padding `22px 24px`→`14px 20px`, `marginBottom` `24px`→`14px`, column gap `20px`→`14px`, logo max-height `52px`→`38px`, business-name heading `1.5rem`→`1.25rem`, info-line `font-size`/`line-height` reduced, Call CTA and quote-info box padding reduced correspondingly). No information was removed — logo/business name, tax ID/phone/email/address, quote number, date, and the Call CTA are all still present, just less spaced.
  - **Local / Hebrew live verification**: real TEST_USER1 quote (`#c171cf5a`), header measured at **155px** tall (Desktop, 1920px viewport) with the business's phone/Call-CTA row present — visibly compact, RTL composition correct (business identity right-aligned, quote-info box on the visual left), business identity/quote number/contact all visible, quote content begins immediately below with only a 14px gap, totals/VAT (18%, ₪) unchanged and correct — **PASS**.
  - **International / English live verification**: a disposable TEST quote was created and deleted afterward (`nimrod1sinai+intl2@gmail.com`, confirmed International account, TEST-only, cleaned up post-verification per the disposable-TEST-account rule) specifically to obtain a genuine English quote to view, since `SmartPublicQuote`'s own market-consistency routing means an existing Local quote cannot be viewed through the English page (a real, deliberate architectural guard, not a bug). Header measured at **120px** tall on that quote (shorter than the Hebrew example only because this fresh TEST account has no phone number set, so the Call-CTA row does not render — a data difference, not a code/style difference); LTR composition correct (business identity left-aligned, quote-info box on the visual right), business identity/quote number visible, USD/$ currency correct, zero Hebrew characters found in a full-page regex scan — **PASS**.
- **FULL-WIDTH RESPONSIVE-DOCUMENT CORRECTION** (owner-approved, this pass — see `PROFLOW_HANDOFF.md` §18.AX): the owner reported the page still behaved like a narrow A4 sheet on Desktop (excessive side margins, poor use of browser width) and referenced an attached visual-reference image. **No image was actually received in this conversation turn** — flagged explicitly rather than silently assumed; implementation proceeded from the detailed written specification (Part B of the task), which was concrete and actionable on its own (full-width responsive, no fixed A4 dimensions, sensible max spacing, no clipped edges/overflow). Changes, identical in both `PublicQuote.jsx` and `PublicQuoteEn.jsx`: outer card `maxWidth` increased `800px`→`1100px` (still a bounded, readable document width — not literal edge-to-edge, which would hurt long-text readability — but ~37.5% wider, directly addressing the reported excess margin); totals-card `maxWidth` increased `320px`→`380px` proportionally. **Parity bug found and fixed while implementing this**: the English items table had no `overflowX:auto` wrapper at all (the Hebrew table already had one) — a genuine pre-existing gap risking horizontal page overflow on narrow screens; added the identical wrapper, with no forced `minWidth` (matching Hebrew's actual behavior of natural column shrinking/wrapping, not an artificially different fallback).
  - **Local / Hebrew live verification**: real TEST_USER1 quote, Desktop 1920px viewport — card now renders at **1100px** (was ~800px), no horizontal overflow, visibly better use of browser width, no A4-narrow feel — **PASS**. Mobile (390px viewport) — no horizontal overflow anywhere on the page (confirmed via `scrollWidth`/`clientWidth` equality), full usable screen width with small edge margins, header/recipient/items/attachments/totals/terms/signature all reachable by scrolling, single-signature model intact — **PASS**.
  - **International / English live verification**: a second disposable TEST quote was created and deleted afterward (same TEST-only account, same cleanup discipline) to genuinely exercise the English page. Desktop 1920px viewport — card renders at **1100px**, matching Hebrew exactly, no overflow — **PASS**. Mobile (390px viewport) — no page-level horizontal overflow; the items table (4 columns: Description/Qty/Unit Price/Total) needs a small internal horizontal scroll to reveal the Total column on the narrowest phones, safely contained within the table's own `overflowX:auto` box (an explicitly sanctioned "responsive table" pattern per the task's own Part B5, not a page-breaking defect) — **PASS**.
- **OWNER FINAL VISUAL ACCEPTANCE**: 🔴 PENDING — do not describe as complete. **Flagged for the owner**: since no reference image was actually received this turn, please confirm this implementation matches the intended visual reference, or attach the image again if the current result doesn't match.
- **COMMIT/PUSH/DEPLOY**: 🔴 NOT AUTHORIZED (Permanent Rule §36 — TEST/dev verification only, no LIVE change).
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
- **OWNER REVIEW OF FOURTH PASS**: the owner inspected the fourth-pass localhost result. Verdict: substantially closer to the approved visual reference, but NOT finally accepted — five additional UX changes were approved as the next direction (recorded below, historical).
- **FIFTH IMPLEMENTATION** (this pass — owner-approved UX correction, implementing the five changes approved after the fourth pass — see `PROFLOW_HANDOFF.md` §18.AU): 🟢 DONE — Desktop only:
  1. **Catalog moved out of the main Dashboard view entirely**, now its own top-navigation tab ("קטלוג", `Package` icon reused from the existing Catalog component). Clicking it renders the exact same `ServicesCatalog` component (Add/Edit/Delete, prices, persistence, search) unchanged — no second implementation, no DB/schema change.
  2. **Quote History is now full width** on the main Dashboard view — the two-column `dash-work-grid` wrapper and its RTL column-order CSS were removed entirely (dead code cleanup, since only one component remains in that area).
  3. **Duplicate New Quote CTA removed**: `QuotesTab.jsx`'s internal "צור הצעת מחיר חדשה" button (and its now-unused `handleCreateNewQuoteClick` prop) was deleted; only the standalone top-level "הצעת מחיר חדשה" button remains. CSV/Excel export button remains inside Quote History, unchanged.
  4. **Quote History row density reduced**: cell padding changed from `8px 6px` to `6px 8px` (25% less vertical padding per row, live-confirmed via computed style: 6px top/bottom). Client-name and description cells now have `maxWidth`/`overflow:hidden`/`text-overflow:ellipsis` with a `title` attribute carrying the full value (existing "View Quote" action also still exposes the full record) — long identifiers no longer inflate row height, live-confirmed.
  5. **Top navigation reordered to the approved sequence**: הצעת מחיר חדשה (standalone CTA), הגדרות עסק, לקוחות, פיננסים, קטלוג — live-confirmed by DOM order + RTL rendering screenshot.
- **LIVE VERIFICATION (fifth pass)**: Desktop **PASS**, TEST_USER1 (Local), localhost against the live Supabase backend. Confirmed via live click-through + JS assertions + screenshots: no Catalog panel on the main view; Quote History full width (table width 1250px inside the 1280px content column); exactly one "הצעת מחיר חדשה" CTA in the DOM; New Quote CTA opens the real Quote Form (tested from the main tab); CSV export button present and unchanged; row padding reduced 25% (8px→6px vertical, computed-style confirmed); truncation/ellipsis + title attributes present on client-name/description cells; "קטלוג" tab opens the real ServicesCatalog (heading, Add-to-Catalog form, existing items with Edit/Delete all present); Catalog search narrows results correctly (2 items → 1 on a specific term, mirroring the earlier documented test); Clients/Finances/Settings tabs all still load their real content when clicked; AI Chat widget still opens with its greeting; no ErrorBoundary/error overlay triggered at any point. ESLint clean (0 errors, 1 pre-existing unrelated warning), production build succeeds, full test suite 21/21 passing.
- **Mobile note (scope boundary, flagged for owner decision, still NOT resolved)**: this and the fifth pass were explicitly scoped Desktop-only and the mobile bottom nav was deliberately left untouched both times. Catalog still has no entry point on mobile (the mobile bottom nav still only has Quotes/Clients/Settings/Finances/New). Needs an explicit owner decision (e.g. add a matching Catalog entry to the mobile bottom nav, or accept the gap until the dedicated Mobile pass).
- **Header/business-identity rule preserved unchanged**: logo (if any) in a white/neutral container, `object-fit: contain`, aspect ratio preserved, visible regardless of logo color; business name as clean prominent text if no logo; ProFlow logo never used as this fallback.
- **OWNER REVIEW OF FIFTH PASS**: the owner visually reviewed the fifth pass in localhost and identified three targeted corrections (recorded and implemented below as the sixth pass) — this resolves the discrepancy flagged in `PROFLOW_HANDOFF.md` §18.AV, where this review had not yet been recorded in project documentation.
- **SIXTH IMPLEMENTATION** (this pass — owner-approved targeted corrections to the fifth pass, implemented under the two new permanent workflow rules §36/§37 of `PROFLOW_PROJECT_CONTEXT.md` — see `PROFLOW_HANDOFF.md` §18.AW): 🟢 DONE — Desktop, both Local/Hebrew/RTL and International/English/LTR in the same pass:
  1. **Quote History toolbar RTL/LTR composition corrected**: `QuotesTab.jsx`'s toolbar row had `flexDirection: isHebrew ? 'row-reverse' : 'row'` — the `row-reverse` for Hebrew was the bug itself. Removed entirely (now always plain `row`); the ambient `dir="rtl"`/`dir="ltr"` inherited from the Dashboard root now does the correct mirroring on its own: Hebrew renders title+Export on the RIGHT, Search+Status on the LEFT; English renders title+Export on the LEFT, Search+Status on the RIGHT (was already correct, unaffected by the fix). Live-confirmed both directions via element position measurement, not just code inspection.
  2. **New Quote CTA joined the navigation group**: the `flex:'1 1 auto'` spacer between the tab buttons and the CTA was removed; the CTA is now the first element in the same DOM row as the tab buttons (Hebrew: renders rightmost/leading via RTL's DOM-first-at-start behavior — הצעת מחיר חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג, exactly the owner-approved order; English: renders leftmost/leading via LTR's DOM-first-at-start behavior — New Quote, Business Settings, Clients, Finances, Catalog — an intentional mirror, not a translation). Live-confirmed via element position measurement in both languages: all buttons sit with a uniform ~8px gap, no separating spacer.
  3. **New Quote CTA now works from every tab**: `handleCreateNewQuoteClick` (`Dashboard.jsx`) now also calls `setActiveTab('main')` as its first action, reusing the existing quote-creation state/form path unchanged (no duplicated logic). Live-confirmed opening the real Quote Form from Quotes/main, Clients, Finances, Settings, and Catalog, in **both** Hebrew and English. This also incidentally fixes the same latent gap on the mobile bottom-nav "New" button, since it calls the same shared handler — not a mobile redesign, a shared-logic fix.
  4. **Public Quote header made substantially more compact** (14.A, recorded here for cross-reference — see 14.A below for the full entry): `PublicQuoteHeader.jsx` is the single component shared by both `PublicQuote.jsx` (Local) and `PublicQuoteEn.jsx` (International), so this one edit applies to both markets in this same pass by construction.
- **LIVE VERIFICATION (sixth pass)**: see the Local and International verification matrices below — both markets tested separately with real accounts, not inferred from shared code.
  - **Local / Hebrew (TEST_USER1)**: title+Export RIGHT / Search+Status LEFT — PASS; New Quote CTA integrated into nav group, no floating spacer — PASS; exactly one New Quote CTA exists — PASS; New Quote works from main/Clients/Finances/Settings/Catalog — PASS (all five tabs individually clicked and confirmed); Catalog tab/functionality intact (heading, search narrows 2→1, Add/Edit/Delete present) — PASS; Quote History functionality intact (search filters 6→2 and clears back to 6, sort click works, CSV export button present, Actions dropdown present) — PASS; AI Chat intact (button present, confirmed clickable in the fifth pass, not re-opened this pass to avoid redundant network calls) — PASS.
  - **International / English (`nimrod1sinai+intl2@gmail.com`, confirmed International account)**: LTR toolbar mirror (title+Export LEFT, Search+Status RIGHT) — PASS, confirmed by element position measurement, not inferred; New Quote/navigation composition correct in LTR (CTA leads on the left, tabs follow) — PASS; New Quote works from Clients/Finances/Settings/Catalog (all four individually tested; main already implicitly covered since the CTA always routes there) — PASS; no Hebrew leakage anywhere on the page (regex-scanned) — PASS; International currency/locale behavior correct ($ throughout, USD, no ₪) — PASS.
- **SEVENTH IMPLEMENTATION** (this pass — Mobile Catalog-reachability fix, required, not optional this time — plus full bilateral Desktop+Mobile re-verification of the sixth pass — see `PROFLOW_HANDOFF.md` §18.AX): 🟢 DONE:
  1. **Catalog restored to Mobile**: the mobile bottom-nav (`.mobile-bottom-nav`, previously untouched across the fifth/sixth passes) now has a 6th button — Catalog (`Package` icon, same visual pattern as every other button in that row, no new styling invented) — between Finances and the "New" action, so Catalog is reachable on Mobile again in both languages. This closes the gap flagged as open in every prior pass's documentation.
- **LIVE VERIFICATION (seventh pass, full bilateral Desktop+Mobile matrix)**:
  - **Local Hebrew Desktop** — re-confirmed unchanged from the sixth pass (all sixth-pass PASS items above still hold; no regression from the Mobile-only nav addition) — PASS.
  - **International English Desktop** — re-confirmed unchanged from the sixth pass — PASS.
  - **Local Hebrew Mobile** (TEST_USER1, 390×844 viewport): no page horizontal overflow (`scrollWidth===clientWidth===390`, confirmed); mobile bottom nav shows all 6 items (הצעות מחיר/לקוחות/הגדרות עסק/פיננסים/קטלוג/חדש); Catalog opens correctly from the bottom nav (heading confirmed); New Quote opens correctly from the bottom nav while on Catalog (confirms the sixth pass's cross-tab fix also reaches the mobile "New" button, since it's the same shared handler); no important action missing; screenshot taken — PASS.
  - **International English Mobile** (`nimrod1sinai+intl2@gmail.com`, 390×844 viewport): no page horizontal overflow; mobile bottom nav shows all 6 items in English (Quotes/Clients/Business Settings/Finances/Catalog/New); Catalog opens correctly from the bottom nav; New Quote opens correctly from Catalog via the bottom nav; no Hebrew leakage; screenshot taken — PASS.
- **COMMIT/PUSH/DEPLOY OF UI**: 🔴 NOT AUTHORIZED — working tree only, per Permanent Rule §36 and this task's explicit instruction. **OWNER FINAL VISUAL ACCEPTANCE: 🔴 PENDING** — do not describe as complete.
- Remaining recorded open sub-item (unchanged from prior passes): Clients/Finances/Settings were not rebuilt into mobile-card layouts (they remain the same desktop-derived layout on mobile as before — functional and non-overflowing, but not a purpose-built mobile-card redesign).
- **PHYSICAL-PHONE TEST READINESS** (applies to both 14.A and 14.B, this pass): a second local Vite dev server instance was started bound to the LAN (`npm run dev -- --host --port 5184 --strictPort`, run alongside the existing localhost-only `:5183` instance used for this session's own automated verification, without disrupting it) so the owner can inspect this exact working-tree result from a physical phone on the same Wi-Fi/LAN before any LIVE approval. Exact URL: `http://192.168.1.189:5184/` (append `/dashboard?lang=he` or `/dashboard?lang=en`, or just `/he`/`/en` for the public-facing landing). This is LAN-only — no port forwarding, no tunneling, not reachable from outside the local network. A one-time Windows Firewall prompt allowing Node/Vite on the private network may appear on first phone connection — a normal local-network permission, not an external exposure. The machine's LAN IP (`192.168.1.189`) may change if the router reassigns it — if the URL stops working, re-check the current IP via `ipconfig`.

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

## 16. Future Product/Growth Strategy — Reality Audit → Strategy Validation → Growth Plan

**Status: 🔴 FUTURE STRATEGY / DECISION FRAMEWORK — NOT AUTHORIZED FOR IMPLEMENTATION.**

**This section documents an owner-reviewed future sequence for how ProFlow's next phase should be approached. Recording it here is NOT authorization to implement any part of it — no Growth Engine, analytics stack, tracking/event pipeline, SEO work, paid acquisition, pricing change, or marketing feature may begin from this section alone. Each stage below requires its own separate, explicit owner authorization before any implementation work starts, exactly like every other item in this backlog (see the "Working Rule — ONE SUBJECT AT A TIME" and Permanent Rules §36/§37/§38 in `PROFLOW_PROJECT_CONTEXT.md`, all of which remain fully in force here.**

**Canonical strategy sequence (owner-approved order — do not skip or reorder stages)**:

`PRODUCT STABILITY → REALITY AUDIT → STRATEGY VALIDATION → GROWTH PLAN → IMPLEMENTATION`

**Stage 1 — Product Stability / Current Checkpoint (in progress, see item 14)**: finish and obtain owner approval for the current UI/product work, **including real-device Mobile verification in both Hebrew and English** — browser emulation alone does not satisfy this gate (see §37's dual-verification rule and item 14's own "OWNER FINAL VISUAL ACCEPTANCE" gates, still PENDING for 14.A/14.B as of this writing). Nothing in Stages 2–5 begins before this stage is owner-accepted.

**Stage 2 — Business & Product Reality Audit (READ-ONLY, evidence-based, not yet started)**: before any Growth Engine, SEO, paid acquisition, or pricing change work, a read-only audit of the real product/business state must establish, where reliable data exists:
- TEST vs LIVE users; Local vs International users; Free/Pro/Business plan distribution
- total real users; active users; users who created at least one quote; users who created 2/5/10+ quotes
- quote creation/use frequency; quote sent/viewed/approved/signed behavior where existing data supports it
- repeat usage/retention where measurable; most active users
- business/profession categories where reliable data exists; countries/markets where reliable data exists
- paying customers; actual MRR where reliable data exists
- funnel conversion points; funnel drop-off points
- the factual basis, if any, behind marketing claims such as "500+ businesses"

**Hard rule for this audit**: never invent a missing metric. Where current instrumentation cannot reliably answer a question, the correct audit result is exactly **`NOT CURRENTLY MEASURABLE`**, with the instrumentation gap documented alongside it — not a best-guess estimate presented as fact.

**Stage 3 — Existing Infrastructure Audit (before adding any new tooling)**: before recommending or implementing new systems (PostHog, GA4, Cloudflare Workers, D1, Queues, Resend, a new analytics/event pipeline, new email infrastructure, or other new Growth infrastructure), first inventory what ProFlow already has — Supabase, Vercel, any existing analytics, existing tracking/events, existing DB tables, Auth metadata, existing email infrastructure (Resend is already in use for quote delivery — see `PROFLOW_ARCHITECTURE.md` §12), scheduled jobs/cron, existing integrations, and any existing data that could already support growth analysis. Objective: avoid building duplicate infrastructure when an existing system may already cover part or all of the need.

**Stage 4 — Strategy Validation**: an external Growth/competitive/pricing report previously reviewed by the Owner + ChatGPT is to be treated as a **hypothesis framework, not established fact**. After Stage 2's Reality Audit, each major strategic recommendation from that report must be classified against actual evidence as **VERIFIED**, **PLAUSIBLE**, or **REJECTED** — never assumed true by default. That evidence-based classification, not the external report alone, should then drive decisions on: ICP/first target customer, Local vs International priority, positioning, pricing, acquisition channel, SEO, paid acquisition, outbound/outreach, the Growth roadmap itself, whether a Growth Engine is actually needed at all, and — only if approved — what it should contain.

**Stage 5 — Growth Plan / Implementation**: only begins after Stages 1–4 are complete and the owner has explicitly authorized moving forward — not implied by the mere existence of this section.

**Nothing in this item authorizes**: starting the Reality Audit itself, installing/configuring any new analytics or tracking tool, querying production data for growth-metric purposes, changing pricing, or beginning any SEO/acquisition/marketing work. Each requires its own future, separate, explicit owner authorization.

---

*This file must be updated whenever a backlog item's status materially changes. See `PROFLOW_PROJECT_CONTEXT.md`'s continuity protocol for the full 3-file responsibility split.*
