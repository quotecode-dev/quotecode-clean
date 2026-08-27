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

1. **Owner-approved primary workstream: item 14 (Public Quote + User UI Visual Redesign)** — Business Owner Dashboard (14.B) has had eight implementation passes and Public Quote (14.A) has had header-compaction, full-width-responsive, and Mobile-compact-header corrections; both Desktop and Mobile, Hebrew and English, are now implemented and bilaterally live-verified in the working tree (see 14.A/14.B for full detail — toolbar RTL/LTR fix, New Quote nav-group + cross-tab fix, Catalog Mobile reachability restored, Public Quote full-width responsive layout, the eighth pass's Mobile Quote-History/KPI density correction + AI Chat overlap fix, and 14.A's own Mobile compact-header pass — all owner-requested after his own physical-phone tests). A LAN-accessible TEST server is running for physical-phone inspection (see 14.B's "Physical-phone test readiness" note for the exact URL). **OWNER FINAL VISUAL ACCEPTANCE remains PENDING for both 14.A and 14.B** — implemented and live-verified in the working tree only, awaiting the owner's own physical-phone review (Claude/browser-emulation verification does not substitute for it). Super Admin (14.C) has implementation already in the working tree from an earlier pass, not yet owner-reviewed.
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

**Important (owner-clarified)**: TEST-account QA inconsistencies (e.g. the `PROFLOW_TEST_ADMIN` browser-harness login/action classifier behavior documented across `PROFLOW_HANDOFF.md` §18.AO/§18.AQ/§18.BB) are a TEST-tooling/QA-process observation only — they do NOT reopen this completed Super Admin project itself.

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

**Future Currency Expansion Audit (owner-recorded, not authorized work)**: do **not** add new currencies merely because a country is supported for address formatting (see item 10) — address formatting and currency support are independent decisions. Future data/business demand may eventually justify additional currencies (e.g. CAD/AUD/NZD/etc.), but that would require its own separate audit and authorization. Currently supported currencies remain exactly: Local/Israel = ILS only; International = USD/EUR/GBP only.

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

**Note**: keep this product-level session-timeout question separate from the unrelated 5184/5186 dual-origin local QA/TEST infrastructure (see Part E of the Current QA/Release Track, below the Master TODO) — the latter is a developer testing convenience, not an application session-lifetime policy.

## 9. Email CTA for Renewal / Plan Selection

**Status: 🔴 VERIFIED ISSUE / OPEN**

Observed: the trial-ending/renewal email CTA leads to Login instead of the subscription/plan-selection area. Desired: CTA → plan/subscription selection directly, without requiring Login merely to view renewal options. If authentication becomes necessary later for payment/account association, perform it at the appropriate stage while preserving the user's selected plan and purchase intent. Preserve market separation: Local = Hebrew + ₪; International = English + USD/EUR/GBP, no ₪.

## 10. Address Display — Country-Aware Formatting

**Status: 🔴 OPEN**

Remove technical `|` separators from user/customer-facing address display. **Critical**: this is **display/presentation only** initially — do not modify DB storage/data structure before an audit establishes why the existing structure exists and what depends on it.

**Local/Israel example**: stored/logical components may currently produce `רחוב הרצל 10 | תל אביב | 6123456`; desired display `רחוב הרצל 10, תל אביב 6123456` — comma between street and city, space between city and postal code, no technical `|`.

**International — country-aware, not one universal English format (owner-clarified, important)**: English UI does **not** mean one universal English address format. Formatting must be country-aware. Do **not** hardcode an American formatter for all English users. Examples of the target per-country conventions:
- United Kingdom: `10 Downing Street, London SW1A 2AA`
- United States: `350 Fifth Avenue, New York, NY 10118`
- Canada: `Street, City, Province Postal Code`
- Australia: `Street, Suburb/City State Postcode`
- New Zealand: `Street, Suburb/City Postcode`
- Ireland: appropriate locality/county/Eircode structure based on available fields
- Singapore: appropriate Singapore postal structure
- South Africa: appropriate suburb/city/province/postal structure
- Other supported International countries: use that country's appropriate presentation convention.

**Required pre-implementation audit**: map every actually-available field (street, city, postal code, state, province, region, country, any existing combined/free-text address field) — do **not** invent state/province/region data that does not exist; a safe fallback is required for countries without a dedicated formatter. Then map **every** address consumer that must use the resulting format consistently: Business UI, Clients UI, Quote Form, Dashboard (where applicable), Public Quote, PDF, Print, Emails, Admin views (where customer-facing formatting applies), and any other customer-visible output. If the architecture supports it safely, prefer a single shared **country-aware display formatter** over duplicating formatting logic across components.

**Currency independence (owner-clarified)**: currency remains entirely independent from address formatting — a business may have a correctly formatted Australian/Canadian/UK/etc. address while ProFlow International still supports only USD/EUR/GBP (see item 3's Future Currency Expansion Audit note — do not treat address-formatting support for a country as implying currency support for it).

## 11. Order Email Optional — Preserve Validation + Bounce

**Status: 🔴 OPEN**

Customer/order email must not be mandatory. If no email is entered, order creation continues normally without blocking. If an email **is** entered, existing validation remains mandatory and the email must be syntactically valid.

**Critical**: preserve the existing Email Bounce mechanism — if an email is sent and a bounce/invalid-address result is received, preserve the existing user warning (red indicator + message explaining the email was not delivered because the address is invalid/unavailable).

Required pre-change audit: UI, validation, DB/schema, mail sending, bounce handling. Find exactly where "required" is currently enforced and remove **only** that requirement.

---

## Current QA / Release Track

**This section is deliberately kept separate from the Master Product TODO above (items 1–11) — it tracks the currently-accumulated UI/QA working-tree state, not product roadmap items.** Full technical detail for B/C/D lives in item 14 below and in `PROFLOW_HANDOFF.md` §18.AN–§18.BC; this section is a pointer/summary, not a duplicate.

**A. Working tree**: the accumulated application UI/QA changes (Dashboard, Public Quote, LIGHT-theme component migration) remain **uncommitted** in the working tree as of this checkpoint — see item 14 and `PROFLOW_HANDOFF.md` for the full pass-by-pass history.

**B. Owner Mobile/Public Quote visual acceptance status**: **PENDING** — no owner approval has been recorded for the current Mobile Public Quote or Dashboard state. Do not describe any surface in item 14 as owner-accepted; only Claude/browser-emulation live verification has occurred so far.

**C. Public Quote current Mobile work** (full detail: item 14.A, `PROFLOW_HANDOFF.md` §18.BC): near-full-width correction (two remaining width limiters found and fixed across two passes — outer `.pq-page` gutter, then `.pq-card`'s own internal padding), compact shared header, quote number/date moved beneath the Call CTA on Mobile, Hebrew RTL + English LTR parity (English implemented, code-symmetric, live-verification pending real International credentials — see F below).

**D. Dashboard Mobile work** (full detail: item 14.B, `PROFLOW_HANDOFF.md` §18.BB/§18.BC): compact Trial banner, 2-column Total Quotes/Revenue KPI row, temporary login-success overlay/toast (auto-dismissing), compact Hot Quote wording with real `view_count`, purple emphasis on client name + view count, compact mobile Quote History.

**E. Dual local TEST origins**:
- `5184` = Local/Hebrew TEST — running, functional, unaffected by 5186's setup.
- `5186` = International/English TEST infrastructure — Vite instance running; PC `localhost`/LAN HTTP both return 200; session isolation between the two origins live-verified (independent `localStorage`/Supabase sessions, confirmed not just theorized); phone/LAN access still **pending** a Windows Firewall inbound rule for TCP 5186 (exact rule recorded in `PROFLOW_HANDOFF.md` §18.BC — this session's execution context lacks the elevation to create it) and possibly a matching AVG Firewall rule (undetermined from this context); International login on 5186 itself **pending** owner-provided International TEST credentials.

**F. English independent verification**: remains required and currently **blocked** wherever noted above (Public Quote Mobile width/header, Hot Quote purple emphasis, Dashboard login-toast/Trial/KPI) — no confirmed non-admin International TEST account credentials have been available in the sessions that did this work. Code is structurally symmetric (shared components, parallel `isHebrew` ternaries, the same DOM-order RTL/LTR mirroring technique used throughout the project) but this is explicitly **not** treated as a substitute for live English verification, per Permanent Rule §37.

**G. Owner Final Visual Acceptance**: 🔴 **PENDING** for all of the above — Claude/browser-emulation verification does not substitute for the owner's own review, per Permanent Rule §36 and every individual pass's own recorded status.

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
- **MOBILE COMPACT HEADER CORRECTION** (owner physically reviewed on a real phone, this pass — see `PROFLOW_HANDOFF.md` §18.BA): the owner reported the Mobile purple header/recipient block still consumed too much of the first screen before items appeared, and specifically flagged the quote-number/date white card wrapping to a large separate block on narrow widths. Root cause measured before changing anything: `PublicQuoteHeader.jsx`'s desktop `flex-wrap` layout caused the quote-info white card to drop below the business-info column on mobile, roughly doubling header height. Fix: `PublicQuoteHeader.jsx` gained a genuine JS-conditional `isMobileView` split (same proven pattern as `QuotesTab.jsx`'s mobile cards) — Desktop's JSX is 100% untouched (still gated as the default/else branch); Mobile gets a new, distinct composition: business name/logo + a compact Call CTA on one line, contact details below, then quote number/date integrated as one small metadata line (no separate white card at all). `PublicQuote.jsx`/`PublicQuoteEn.jsx` also compacted the recipient block on Mobile only via a `pq-recipient`/`pq-recipient-name`/`pq-recipient-detail` className + `@media (max-width:640px)` rule (padding/margins/font-size reduced), Desktop's inline styles left completely untouched.
  - **Local / Hebrew live verification** (real TEST_USER1 quote `#c171cf5a`, 390px): header **261px → 126px** (52% reduction); recipient card **130px → 88px** (32% reduction); items table start position **Y=469px → Y=273px** on an 844px-tall viewport — items (and even totals) now visible on the first screen without scrolling. RTL composition correct (name+contact right-aligned, Call CTA and quote-metadata read naturally right-to-left). No overflow at 360/390/430px — **PASS** at all three.
  - **International / English live verification**: two disposable TEST quotes were created and deleted afterward (confirmed International account, TEST-only, cleaned up per the disposable-TEST-account rule) — one for Mobile verification, one for the Desktop regression re-check. Mobile (390px): header 94px, recipient 57px (both shorter than Hebrew purely because this fresh account has no phone/email/address data — not a code difference), items table starts at Y=209px (25% down an 844px viewport) — full page essentially fits on one screen. Intentional LTR mirror confirmed (business name left-aligned, quote #/date metadata reads left-to-right). Zero Hebrew leakage (regex-scanned). No overflow at 360/390/430px — **PASS** at all three.
  - **Desktop regression, both markets** (1920px, re-verified after the Mobile change): Hebrew header re-measured **155px** — byte-identical to the pre-existing baseline; English header re-measured **120px** — same; recipient card's computed `padding` re-confirmed still the original `16px 20px` (the mobile override never applies above 640px) — **PASS**, no regression, in both languages.
  - **Items-table mobile presentation** (pre-existing, not part of this pass's scope, verified unaffected): the table already had its own `overflowX:auto` containment (Hebrew from originally, English fixed in the full-width-correction pass above) — a small internal horizontal scroll on the narrowest phones remains, contained within the table's own box, never causing page-level overflow; unchanged by this pass.
  - **One deliberate, disclosed recomposition, not a data removal**: the "הצעת מחיר"/"Price Quote" decorative label was dropped from the Mobile header specifically (Desktop keeps it, unchanged) — judged to be page-context chrome, not data, since the page itself already establishes it's a price quote; the actual data point (quote number) was kept and made more prominent, not hidden.
- **OWNER FINAL VISUAL ACCEPTANCE**: 🔴 PENDING — do not describe as complete. Claude/browser-emulation verification does not substitute for the owner's own physical-phone review, per this task's own explicit instruction. **The image-reference discrepancy flagged in the full-width-correction entry above remains separately open** — this Mobile pass did not resolve or touch that flag.
- **COMMIT/PUSH/DEPLOY**: 🔴 NOT AUTHORIZED (Permanent Rule §36 — TEST/dev verification only, no LIVE change).
- Recorded minor item: on narrow mobile widths the item table's columns still need a small internal horizontal scroll for the Total column (data intact, page itself never overflows) — not addressed this pass, explicitly out of scope (header/recipient compaction only).
- **SIXTH IMPLEMENTATION — genuine mobile full-width, second remaining limiter found + header composition refinement** (owner still reported an A4-like feel on the physical phone after the prior gutter fix — see `PROFLOW_HANDOFF.md` §18.BC): 🟢 DONE:
  1. **Root cause, precisely diagnosed rather than re-guessed**: the outer `.pq-page`→`.pq-card` gutter fix (§18.BB) was correct and confirmed still working (card spans 378px/390px, 6px gutter, inside the owner's 4-8px target) — but `.pq-card`'s own internal padding was still `18px` per side (an older value, never revisited when the outer gutter was fixed), meaning the actual content only started at **340px/390px (87.2%)** — a page-with-margins feel despite the outer boundary already being correct. Reduced to `12px`: content width now **352px/390px (90.3%)**, **322px/360px (89.4%)**, **392px/430px (91.2%)** — all measured live, no overflow at any width. Desktop's base `padding: 40px` rule (outside the media query) untouched.
  2. **Mobile header composition**: quote number/date moved from their own full-width metadata row (with a border-top) into the header's existing secondary column, directly under the Call CTA — no separate row at all now. Measured header height **126px → 110.125px** (a further ~12.7% reduction) at all of 360/390/430px, no overlap between columns at 360px (10px gap maintained), CTA remains a comfortable 84.65×24.8px touch target, no old white metadata card reintroduced.
- **LIVE VERIFICATION (sixth pass)**: Hebrew — **PASS** on all measurements above (disposable TEST quote, temporarily given full contact data via Settings for an apples-to-apples comparison against the §18.BA full-data baseline, then reverted). English — **NOT LIVE-VERIFIED** (same credentials gap as the ninth Dashboard pass below). Desktop — re-confirmed unaffected (`PublicQuoteHeader.jsx`'s Desktop `return` block read byte-for-byte identical before/after; `.pq-card`'s `12px` change fully scoped inside the pre-existing `@media (max-width: 640px)` block).
- **OWNER FINAL VISUAL ACCEPTANCE**: 🔴 PENDING.

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
- **PHYSICAL-PHONE TEST READINESS** (applies to both 14.A and 14.B, this pass): a second local Vite dev server instance was started bound to the LAN (`npm run dev -- --host --port 5184 --strictPort`, run alongside the existing localhost-only `:5183` instance used for this session's own automated verification, without disrupting it) so the owner can inspect this exact working-tree result from a physical phone on the same Wi-Fi/LAN before any LIVE approval. Exact URL: `http://192.168.1.189:5184/` (append `/dashboard?lang=he` or `/dashboard?lang=en`, or just `/he`/`/en` for the public-facing landing). This is LAN-only — no port forwarding, no tunneling, not reachable from outside the local network. A one-time Windows Firewall prompt allowing Node/Vite on the private network may appear on first phone connection — a normal local-network permission, not an external exposure. The machine's LAN IP (`192.168.1.189`) may change if the router reassigns it — if the URL stops working, re-check the current IP via `ipconfig`.
- **EIGHTH IMPLEMENTATION — Mobile Responsive/Density pass** (owner physically tested on a real phone, this pass — see `PROFLOW_HANDOFF.md` §18.AZ): 🟢 DONE, Mobile only, Desktop explicitly protected/regression-checked, Hebrew + English in the same pass:
  1. **Quote History mobile card density** (`QuotesTab.jsx`): the mobile card was rebuilt from three stacked rows (name+status / amount+date / views+actions, **measured 141px** per card) into two compact rows (row 1: client name, truncated with ellipsis + `title` tooltip if long, and amount; row 2: a secondary meta cluster — quote #, date, status badge — plus an actions cluster — view count, email-status dot, Actions button). **Measured 72px per card after** (a 49% reduction), squarely inside the owner's ~60-75px target. Same DOM order drives both languages — the card's existing `dir` attribute makes the first DOM child land at each language's natural "start" side, so Hebrew and English get correctly mirrored composition from one shared structure, not a duplicated implementation. No data or functionality removed: description was already mobile-card-omitted before this pass (unchanged); view count now only renders when non-zero (a display-only change, not a removal — it was always conditionally near-invisible at `0`).
  2. **KPI / Hot Quote mobile density** (`Dashboard.jsx`): added `dash-kpi-grid`/`dash-kpi-card`/`dash-kpi-icon`/`dash-kpi-label`/`dash-kpi-value`/`dash-kpi-sub` classNames (previously plain inline styles, which cannot carry media queries) and a new `@media (max-width: 768px)` block reducing card padding (16px→10px), icon size (40px→32px), gap, and value/label font sizes by roughly 30% — mirroring the task's "~25-35% less vertical space" target — while leaving every value/label/calculation untouched. **Desktop is completely unaffected**: the media query only fires below 768px, and desktop's own inline `16px` padding/`40px` icon values were never changed in the source — confirmed by direct measurement (see verification below).
  3. **AI Chat mobile overlap fixed** (`Dashboard.jsx`): measured the actual conflict directly before fixing — the fixed-position AI Chat button occupies screen band y≈712-759px on a 844px-tall viewport (already correctly lifted above the 58px-tall fixed bottom-nav by the widget's own pre-existing `bottom: 85px` mobile rule), but nothing previously guaranteed the scrollable content could clear that band — the tallest/last visible row could get stuck permanently underneath it. Added a `dash-footer` className to the page's existing footer element and a `@media (max-width: 768px) { .dash-footer { padding-bottom: 100px } }` rule, applying to every tab (not just Quote History), so the true end of any tab's scrollable content can always scroll clear of both fixed overlays. Live-verified via `document.elementFromPoint()` at the last row's Actions-button center — confirmed the button itself, not the AI overlay, receives clicks there.
  4. **Mobile width/container**: measured before making any change — the existing outer mobile gutter was already 10px each side (370px/390px ≈ 95% width utilization), already within the owner's own stated 6-10px target range. No container-width change was needed or made; verified this holds at 360/390/430px via direct DOM measurement, not assumed.
- **LIVE VERIFICATION (eighth pass, full viewport + bilateral matrix)** — see `PROFLOW_HANDOFF.md` §18.AZ for the complete measured evidence; summary: Hebrew Mobile 360/390/430px — PASS (no overflow, 72px cards, Catalog/New Quote/Search/Status/CSV/nav all functional, AI Chat non-blocking); English Mobile 360/390/430px — PASS (same, plus zero Hebrew-leakage confirmed, long client name safely truncated, large amount ($15,000.00) displayed without squishing, both via a disposable TEST quote created and deleted afterward per the disposable-TEST-account rule); Hebrew Desktop — PASS, re-confirmed unchanged (KPI card padding measured still 16px); English Desktop — PASS, re-confirmed unchanged (identical measurement).
- **COMMIT/PUSH/DEPLOY OF UI**: 🔴 NOT AUTHORIZED — working tree only. **OWNER FINAL VISUAL ACCEPTANCE: 🔴 PENDING** — Claude/browser-emulation verification does not substitute for the owner's own physical-phone review, per this task's own explicit instruction.
- Remaining recorded open sub-item (unchanged from prior passes): Clients/Finances/Settings were not rebuilt into mobile-card layouts (they remain the same desktop-derived layout on mobile as before — functional and non-overflowing, but not a purpose-built mobile-card redesign). This was explicitly out of this pass's scope (Quote History + KPI + AI Chat + width only).
- **NINTH IMPLEMENTATION — Dashboard top-density correction + login-toast/Hot-Quote corrections** (owner physically tested on a real phone; two passes, the first interrupted mid-verification and completed/re-verified as part of the second — see `PROFLOW_HANDOFF.md` §18.BB): 🟢 DONE, Hebrew live-verified, English code-symmetric but not live-verified (no confirmed-International non-admin TEST credentials available this session):
  1. **Trial-notification single-row compaction**: the banner wrapped to 2 lines at ~390px (67px tall) because the full copy didn't fit one row even with `flex-wrap: wrap`. Added parallel `dash-trial-full`/`dash-trial-compact` spans (full copy hidden, shortened copy — "תקופת ניסיון פעילה" / "Trial active" + "נותרו X ימים" / "X days left" — shown) plus a `@media (max-width: 768px)` rule forcing `flex-wrap: nowrap`. Measured: **67px → 34.4px, single row, at all of 360/375/390/412/430px**.
  2. **Total Quotes + Total Revenue side-by-side on mobile**: the desktop `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` collapsed to a single column below ~410px (2×200px+gap exceeds the ~370px available), stacking all three KPI cards vertically. Added a `dash-kpi-hot` className (`grid-column: 1 / -1` under the same mobile breakpoint, so Hot Quote still spans the full row when present, per spec) and forced `grid-template-columns: repeat(2, 1fr)` on mobile. Measured: both cards share an identical `top` coordinate (confirmed side-by-side, not stacked) at all of 360/375/390/412/430px, card width scaling 166px→201px across that range.
  3. **Login-success message converted from a permanent in-flow block to an auto-dismissing overlay**: previously pushed all Dashboard content down and had no auto-clear at all (persisted until some unrelated action overwrote the shared `statusMsg` state). Added one `useEffect` auto-clearing `statusMsg` 2700ms after it's set, and moved its render into the purple header bar as a `position: absolute` pill hanging off the header's bottom edge — occupies zero document-flow height, doesn't cover the logo/business-name or Sign Out (measured, no overlap). Live-verified: header height byte-identical with the toast visible vs. after it clears (no layout shift); real login-triggered "התחברת בהצלחה" observed and auto-dismissed without further interaction (actual dismiss time under real post-login data-load was ~5s wall-clock, later than the coded 2700ms due to concurrent Supabase fetches busying the main thread — the timer itself fires and clears correctly, reported honestly rather than rounded).
  4. **Hot Quote copy corrected — duplicate title removed, real view count shown**: the body text previously repeated "הצעה חמה!"/"Hot Quote!" (already shown once in the card heading) and used the vague "צפה בהצעה מספר פעמים" placeholder. `t.hotQuoteAlert` now takes `(name, viewCount)`, drops the repeated title, and renders the account's real `quotes.view_count` with correct singular/plural grammar ("פעם אחת"/"once" vs "X פעמים"/"X times" — the singular branch is currently unreachable given the existing `view_count >= 3` business-logic threshold, implemented anyway per the correctness requirement; business logic itself untouched). Live-verified end-to-end on an ordinary non-admin account (`PROFLOW_TEST_INTL`): a disposable TEST quote was created, viewed 3 times anonymously (owner's own authenticated views are deliberately excluded by the `public_increment_quote_view` RPC, confirmed live) to genuinely earn `view_count = 3`, then the KPI row correctly rendered "הצעה חמה!" once, followed by "ProFlow QA Client צפה בהצעה 3 פעמים ועדיין לא חתם." — matching the owner's target style exactly; quote deleted immediately afterward, cleanup confirmed.
  5. **Diagnostic finding, not a code change**: mid-session, `PROFLOW_TEST_ADMIN` was observed rendering in English despite being a confirmed Local/Hebrew account — root-caused to stale `localStorage['proflow_lang']` from earlier same-origin English-bundle testing in the same browser (this key drives which of `AppLocal`/`AppGlobal` mounts on a bare `/dashboard` URL, and is written on every load) — not an account/session bug. This also directly informed a **two-port (5184 Local / 5186 International) feasibility read** requested this pass: classified **CONDITIONALLY SAFE** — session/localStorage isolation between two ports is native browser behavior and would eliminate exactly this contamination — conditional only on a not-yet-created Windows Firewall/AVG rule for 5186 and (only if a *new* signup/email-confirmation flow is ever exercised there) a possible Supabase Redirect-URL allow-list addition. Port 5186 was **not** started this pass, per explicit instruction.
- **LIVE VERIFICATION (ninth pass)**: Hebrew — VISUAL + FUNCTIONAL PASS as detailed above, on both `PROFLOW_TEST_ADMIN` (super_admin, login-toast only — Trial/KPI/Hot-Quote are `!isSuperAdmin`-gated and not visible to this account) and `PROFLOW_TEST_INTL`/nimrod1sinai@gmail.com (ordinary account, confirmed **Local** market despite its name — used for Trial/KPI/Hot-Quote verification). English — **NOT LIVE-VERIFIED**: no confirmed-International non-admin TEST account credentials were available this session (the documented `nimrod1sinai+intl2@gmail.com` alias is a separate Auth identity with its own password, not stored anywhere accessible). Recorded as BLOCKED/NOT TESTED per Permanent Rule §37, not assumed from the shared component. Desktop regression (both languages, KPI grid/Trial banner) re-confirmed unaffected (desktop `grid-template-columns` and full-length Trial copy unchanged, media queries only fire below their respective breakpoints).
- **COMMIT/PUSH/DEPLOY OF UI**: 🔴 NOT AUTHORIZED — working tree only. **OWNER FINAL VISUAL ACCEPTANCE: 🔴 PENDING**.
- **Owner question carried forward**: can genuinely-International non-admin TEST credentials be provided (or the `+intl2` alias's password shared) so a future pass can close the English live-verification gap for this and prior Dashboard/Public-Quote passes, without resorting to creating a new account (blocked this session by the email-confirmation requirement, which this project's own safety rules correctly refused to bypass)?
- **TENTH IMPLEMENTATION — Hot Quote purple data emphasis** (owner-approved visual refinement — see `PROFLOW_HANDOFF.md` §18.BC): 🟢 DONE, Hebrew live-verified, English code-symmetric but not live-verified:
  1. `t.hotQuoteAlert` changed from a plain string to JSX: only the client name and the bare view-count number are wrapped in `<span style={{color: NEON.violet, fontWeight:'800'}}>` (`#7c3aed`, the exact token driving the header's purple gradient — "the same purple family" per the owner's instruction) — the rest of the sentence stays the card's normal dark text color, not the whole sentence purple. Hot Quote business logic, selection logic, and `view_count` source untouched — display formatting only.
  2. Live-verified end-to-end on an ordinary non-admin account: a disposable quote for client "Eden Davud" (matching the owner's own example) was created, viewed 3 times anonymously to genuinely earn `view_count = 3`, then inspected via computed style — both the name span and the "3" span resolved to `rgb(124, 58, 237)`/`font-weight: 800`; surrounding text unstyled (inherits normal color). Rendered: "Eden Davud צפה בהצעה 3 פעמים ועדיין לא חתם." — exact match to the owner's target example. Quote deleted immediately afterward, cleanup confirmed.
- **LIVE VERIFICATION (tenth pass)**: Hebrew — **PASS**. English — **NOT LIVE-VERIFIED** (same credentials gap).
- **OWNER FINAL VISUAL ACCEPTANCE**: 🔴 PENDING.
- **TEST infrastructure note — second LOCAL TEST origin (5186) now READY**: a second Vite dev-server instance was started on port 5186 (`npm run dev -- --host --port 5186 --strictPort`), mirroring the existing 5184 instance's exact flags, without touching/restarting 5184. Purpose: let the Owner keep an independent Local (5184) and International (5186) browser session logged in simultaneously on the physical phone, without repeated Sign Out/Sign In — pure LOCAL TEST infrastructure, no language switcher, no market-detection code change. Session isolation between the two origins was live-verified (not just theorized): logging into `PROFLOW_TEST_ADMIN` on 5186 left 5184's own independent session/localStorage state completely untouched, and vice versa. **5186 is reachable from this PC** (`localhost:5186` and `192.168.1.189:5186` both return HTTP 200) **but is NOT yet reachable from the Owner's phone** — no Windows Firewall rule for inbound TCP 5186 exists yet, and this session's execution context lacks the elevation to create one. Exact rule needed (mirrors the existing 5184 rule precisely): `netsh advfirewall firewall add rule name="Vite Dev Server 5186" dir=in action=allow protocol=TCP localport=5186 profile=private`. AVG Firewall (a separate running service on this machine) may also need a matching rule — could not be determined from this session whether its existing configuration already covers 5186. **International login on 5186 itself is separately blocked** on the credentials gap above — recorded per this task's own explicitly-sanctioned acceptable result: **5186 READY — INTERNATIONAL LOGIN PENDING OWNER-PROVIDED CREDENTIALS.**

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
