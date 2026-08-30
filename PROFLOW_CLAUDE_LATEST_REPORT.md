# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Critical Signature Forensic Audit + Final Canonical Width Alignment + Quote History Density

**Effort level**: HIGH. Three scopes, priority-ordered: (1) CRITICAL — read-only forensic audit of customer-signature authorization (audit only, no remediation), (2) Final Canonical Desktop Width Alignment (Owner-final decision: use Public Quote's own existing 980px width, no new value), (3) Quote History Desktop density. Not authorized: Admin work, Item 28/30/31 implementation, Vercel routing change, application commit/push/deploy, Production mutation, signature remediation implementation, marking new width/density results as Owner-LOCKED.

## Part A — Signature Forensic Audit (read-only, TEST-reproduced)

Traced the full signing path: `PublicQuote.jsx`/`PublicQuoteEn.jsx` → `useSignaturePad.js` → `supabase.rpc('public_approve_quote', {...})` → Postgres `public.public_approve_quote(uuid,text)` (`SECURITY DEFINER`, `EXECUTE` granted to `anon`+`authenticated`). Read the RPC's full body directly from `supabase/migrations/20260830000001_capture_base_functions_triggers.sql` (captured verbatim from live Production 2026-08-30): it validates only the signature payload's shape/size and the quote's current status — **it contains no `auth.uid()` reference, no ownership check, no customer-only requirement anywhere.** The only protection is client-side: `get-public-quote`'s `is_owner_viewing` flag hides the signing UI when the caller's own session matches the quote's `user_id` — correct for that one case, but irrelevant to a direct RPC call and irrelevant to any *other* authenticated business account viewing a quote that isn't theirs.

**Live TEST reproduction (Owner-authorized, TEST/local mutation only)**: signed in as `PROFLOW_TEST_LOCAL_EMAIL`, selected one of that account's own unsigned `draft` quotes, and called `public_approve_quote` directly (bypassing the UI) using that session's own access token. Result: **HTTP 204**. Re-queried immediately: `status: "approved"`, `signature:` a valid 114-character PNG data URL, both persisted — a business user directly forged a customer-role approval on their own quote.

Checked git history: the original security-remediation commit (`1caaff6`, 2026-08-25) that created this RPC documented "live tests passed for anon, owner, different authenticated TEST user" for the *sibling* view-count RPC, but recorded **no equivalent owner/different-user test for `public_approve_quote` itself.** No evidence this RPC's identity check was ever present and later removed — the more accurate characterization is an unclosed gap since the RPC's creation, not a regression of something proven to have worked. Full findings, evidence, and a proposed (not implemented) minimal fix are in `PROFLOW_PROJECT_CONTEXT.md` §58, along with the new permanent Customer-Only-Actions product rule.

**No remediation implemented. No Production quote signed/approved/mutated. No existing signature modified.**

## Part B — Final Canonical Desktop Width Alignment

Per explicit Owner decision, all prior width experimentation (1440px flat, 1320px flat, `min(1320px,72vw)`, `min(1320px,85vw)`) is superseded — Public Quote's own existing, already-locked `--pf-desktop-content-width` (980px) is now the canonical value everywhere. `--pf-dashboard-desktop-content-width` (`src/index.css`) now reads `var(--pf-desktop-content-width)` directly instead of holding an independent number, while remaining a separate token (preserves the earlier risk-isolation intent — a future Dashboard-only change still can't indirectly touch Public Quote's CSS).

Per the Owner's explicit "table adapts to the product, not the reverse" rule, `QuotesTab.jsx`'s Quote History table was narrowed to genuinely fit inside 980px instead of the width being widened for the table: compact metadata columns (Client Type, Views, email indicator, Actions) trimmed to near their real minimum; Client Name/Description kept the larger share. Actions column kept a (smaller) explicit `minWidth` to avoid reintroducing the earlier EN Actions-clipping regression.

## Part C — Quote History Desktop Density

Root cause: generous cell padding (6px vertical), not a structural bug. Reduced: cell padding `6px 8px → 4px 6px`, status badge padding `3px 8px → 2px 7px`, Actions button padding `4px 10px → 3px 9px`. No information removed.

## Part D — Incidental Discovery: Mobile Width Side-Effect (found and fixed)

Re-measuring mobile before making any change revealed the *previous* task's `min(1320px, 85vw)` token had been unintentionally constraining Mobile card width too (85vw < any real phone viewport), producing 27-31px gutters — not the 15px previously reported. The new fixed 980px value never engages below 980px viewport, so this is resolved as a natural consequence: mobile gutter is now a clean 6px, matching the dedicated mobile CSS override.

## Preserved LOCKED Behavior (regression-checked)

Actions column fully visible, both markets, all four desktop widths. Trial notice unaffected (untouched code path, confirmed via screenshot). Client Type badge unaffected (untouched component). Amount typography hierarchy preserved exactly (row 500 / Total Revenue 600 — neither reopened). Trial Expiration → FREE: 70/70 tests still pass.

## Continuity Sync + Remote Read-Back

Synced through the existing §17.J mechanism — isolated worktree, secret/privacy scan, explicit filename staging, commit, push `proflow-continuity` only — followed by genuine remote GitHub read-back verification.

## Final Verdict

==========================================
**CRITICAL — SIGNATURE**
==========================================

**SIGNATURE REGRESSION: INCONCLUSIVE** (evidence supports an unclosed gap present since the RPC's original creation on 2026-08-25; no evidence found of a working owner-check that was later removed)

**BUSINESS USER CAN SEE CUSTOMER SIGNING UI: YES** — whenever `is_owner_viewing` is false for them (any quote that isn't their own exact account/session match), identical to what a genuine customer sees.

**BUSINESS USER CAN EXECUTE CUSTOMER SIGNING PATH: YES** — confirmed live.

**BUSINESS USER CAN PERSIST CUSTOMER SIGNATURE: YES** — confirmed live, TEST, HTTP 204, `status`/`signature` mutated exactly as a real approval would.

**SIGNING PATH**: `PublicQuote.jsx`/`PublicQuoteEn.jsx` → `useSignaturePad.js` → `supabase.rpc('public_approve_quote', {p_quote_id, p_signature_data_url})` → `public.public_approve_quote(uuid,text)` (Postgres, `SECURITY DEFINER`, `search_path` pinned, `EXECUTE` granted `anon`+`authenticated`, `PUBLIC` revoked) → one atomic conditional `UPDATE public.quotes SET status='approved', signature=... WHERE id=... AND status IN ('draft','sent') AND signature IS NULL/empty`.

**CURRENT AUTHORIZATION BOUNDARY**: UI-only (`quote.is_owner_viewing`, computed by the `get-public-quote` Edge Function from the caller's Authorization header, correctly hides the signing UI only for the exact quote-owner-in-same-session case). The RPC/persistence layer itself performs zero identity check of any kind.

**PREVIOUS PROTECTION**: the `is_owner_viewing` UI guard is real, present, unregressed, and correctly working for its one covered case. No evidence found (via git history of the original 2026-08-25 remediation commit) that the RPC itself ever had a stronger, since-removed check.

**ROOT CAUSE**: `public_approve_quote`'s body (read in full from `supabase/migrations/20260830000001_capture_base_functions_triggers.sql`) never references `auth.uid()` — by design it must accept anonymous customer calls, but it does not distinguish "anonymous customer" from "any authenticated ProFlow business session."

**HE IMPACT**: AFFECTED — `PublicQuote.jsx` calls the identical RPC with identical parameters.
**EN IMPACT**: AFFECTED — `PublicQuoteEn.jsx` calls the identical RPC with identical parameters. One shared signing path, no market-specific difference.

**PRODUCTION POTENTIALLY AFFECTED: YES** — read-only evidence: the capturing migration file's own header states its contents (this RPC included) were "captured EXACTLY as it is defined live on Production today" (2026-08-30). No Production quote was queried, signed, or mutated to reach this conclusion.

**HISTORICAL IMPACT**: what can be proven — the mutation path has no server-side identity check today and is TEST-confirmed exploitable by an authenticated business session. What cannot be proven — whether any specific existing signature on any real quote (TEST or Production) actually originated this way; the `quotes` table has no column recording who/what performed an approval, so there is no way to distinguish a genuine customer signature from a business-side one after the fact. No historical signature was classified as invalid or altered.

**RECOMMENDED MINIMAL SAFE FIX (proposal only, NOT implemented)**: inside `public_approve_quote`, reject the call whenever the caller is identifiable as any ProFlow business account at all (`auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM business_settings WHERE user_id = auth.uid())`) — not merely "equals this quote's owner," since that narrower check leaves the cross-account gap open. Anonymous/genuine-customer approval is unaffected.

**REQUIRED REGRESSION TESTS (for any future fix)**: anonymous approval still succeeds; the quote's own owner calling the RPC directly is rejected; a different authenticated business account calling it on someone else's quote is rejected; `is_owner_viewing` UI hide unchanged; `guard_quote_immutability` still blocks post-approval edits; both HE/EN re-verified; frontend's generic error-toast still degrades gracefully.

**NO SIGNATURE FIX IMPLEMENTED: PASS**

==========================================
**CANONICAL WIDTH**
==========================================

**PUBLIC QUOTE CANONICAL WIDTH SOURCE**: `--pf-desktop-content-width` (`src/index.css`), 980px, unchanged/LOCKED.

**PUBLIC QUOTE MUTATED**: NO.

**SEPARATE DASHBOARD WIDTH**: reconciled — `--pf-dashboard-desktop-content-width` now reads `var(--pf-desktop-content-width)` directly; kept as a distinct token only for risk-isolation, not as an independent value.

**PUBLIC QUOTE HE**: 980px content / 1062px shell (unchanged, not re-measured this task since untouched).
**PUBLIC QUOTE EN**: 980px, identical to HE (unchanged, not re-measured this task since untouched).
**DASHBOARD HE**: 980px at 1280/1366/1440/1920px (wrapper `left/right` gutters scale with viewport: 143/143, 186/185, 223/222, 463/462).
**DASHBOARD EN**: 980px, byte-identical to HE at every width above.
**QUOTE HISTORY HE/EN**: fits inside 980px with zero overflow at all four widths, both markets — table box exactly matches its wrapper's box everywhere; Actions column fully visible (HE left edge / EN right edge).
**NEW QUOTE / CLIENTS / BUSINESS SETTINGS / CATALOG / FINANCES HE/EN**: share the same `.dash-main-content` wrapper as Dashboard/Quote History — same 980px canonical width applies structurally; not individually re-measured this task (no code specific to those tabs was touched).

**CANONICAL WIDTH PARITY: PASS** (HE/EN byte-identical at every measured width).

==========================================
**QUOTE HISTORY DENSITY**
==========================================

**ROOT CAUSE**: generous, uniform cell padding (6px vertical) — not a structural/layout defect.

**ROW HEIGHT**: 51px → 47px (HE, row with before-VAT subline) / 38px → 34px (EN, no subline).
**VERTICAL PADDING**: 6px → 4px (per `<td>`/`<th>`, both edges).
**LINE HEIGHT**: unchanged (browser default for 0.8rem/0.7rem text; not explicitly set before or after).
**ACTIONS BUTTON**: 25px → 23px height (padding `4px 10px` → `3px 9px`).
**BADGE HEIGHT** (status pill): 23px → 21px (padding `3px 8px` → `2px 7px`; initial measurement attempt matched the wrong element — the fixed-size Client Type icon badge, also a rounded pill — corrected by matching on the actual status-label text).

**ROWS VISIBLE** (1000px-tall reference viewport, header/KPI cards included above the table): HE 12 → 13; EN 13 → 13 (this TEST account's EN quote list is shorter than one screen already, so it was fully visible before and after).

**TABLE FITS CANONICAL WIDTH: PASS**
**ACTIONS FULLY VISIBLE: PASS**
**DESKTOP HORIZONTAL OVERFLOW: PASS** (none, at any of the four widths, either market — `docScrollWidth` equals viewport width in every measurement)
**DESKTOP DENSITY: PASS**

==========================================
**MOBILE**
==========================================

**360 HE/EN**: gutter 6px (was 27px), card width 348px, zero overflow.
**390 HE/EN**: gutter 6px (was 29px), card width 378px, zero overflow.
**412 HE/EN**: gutter 6px (was 31px), card width 400px, zero overflow.

**MOBILE WIDTH PRESERVED: PASS** — actually corrected from a previously-unreported side-effect (see Part D above); now byte-identical HE/EN and tighter than the last reported state.
**MOBILE OVERFLOW: PASS**

==========================================
**LOCKED REGRESSION**
==========================================

**PUBLIC QUOTE: PASS** (file untouched, unchanged)
**AMOUNT TYPOGRAPHY: PASS** (row 500 / Total Revenue 600, neither reopened, code unchanged)
**TRIAL NOTICE: PASS** (unaffected, untouched code path, confirmed via screenshot both markets)
**CLIENT TYPE: PASS** (unaffected, untouched component)
**TRIAL EXPIRATION → FREE: PASS** (70/70 tests green)
**OTHER LOCKED REGRESSION: PASS**

==========================================
**QUALITY**
==========================================

**TESTS: PASS** (70/70)
**LINT: PASS** (0 errors, same 6 pre-existing warnings, unrelated files)
**BUILD: PASS**
**REMOTE CONTINUITY READ-BACK: PASS**

==========================================
**FRESH LOCAL STATE**
==========================================

**MAIN HEAD**: `17ac4d3a950d96f4167f9b320c82b4798382d621` (unchanged, local and remote).
**WORKING TREE**: uncommitted changes carried forward, plus this task's edits to `src/index.css`, `src/pages/Dashboard.jsx` (comment only), `src/components/QuotesTab.jsx`.
**TEST**: one real mutation performed, Owner-authorized, for forensic verification only — quote id `4204f54d-519c-48dd-8910-99f2514516a8` (a `PROFLOW_TEST_LOCAL` account's own throwaway draft quote) now shows `status: approved` with a forged signature, called directly via RPC to prove the authorization gap. Not reverted (the immutability trigger blocks reverting an approved/signed quote by design) — disclosed, not hidden. No other TEST mutation.
**PRODUCTION**: UNCHANGED.

**NO signature remediation implemented. NO Production signature test. NO Production mutation. NO real-customer signing. NO existing-signature modification. NO Admin work. NO Item 28/30/31 implementation. NO Vercel routing change. NO application commit/push. NO Production deploy. NO LIVE action. Did not invent another Desktop width. Did not widen ProFlow because a table didn't fit. Did not modify Public Quote's geometry.**

**Awaiting Owner + ChatGPT review.**
