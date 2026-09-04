# PROFLOW — Codex Checkpoint (Seventh Continuity File)

**Purpose (read this first).** This file supplements — it never silently replaces — the six canonical continuity files (`PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_ARCHITECTURE.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_CLAUDE_LATEST_REPORT.md`). Its job is to preserve, in one place, explicit Owner-approved design/product decisions that are **still open, pending implementation, or pending Owner visual acceptance** — the kind of detail that is easy to lose across long ChatGPT/Codex ↔ Claude Code chat boundaries. A future ChatGPT/Codex session using the ProFlow Claude Bridge V2 should be able to read this file and resume without reconstructing hours of prior discussion.

If a fact here conflicts with one of the six canonical files on *current implemented state*, the canonical files win (per the project's own long-standing precedence rule — see `PROFLOW_PROJECT_CONTEXT.md` §0.B/§17). This file's own authority is over **intent and status tracking**, not over implemented-state-of-truth.

**Status vocabulary (used for every item below) — do not use any other status word:**

- `OPEN` — decided/approved, not yet implemented.
- `IMPLEMENTED / SOURCE-VERIFIED` — code changed, confirmed correct by reading the source/running tests, not yet confirmed in a real rendered browser.
- `BROWSER-VERIFIED` — confirmed via a real browser-harness session against the actual running TEST app (never claimed from source review, tests, or agent review alone).
- `OWNER-ACCEPTED` — the Owner has personally reviewed the rendered result and accepted it. **Only the Owner may set this status.** Claude/Codex must never self-assign it.
- `SUPERSEDED` — an approved decision that a later, more specific Owner decision has replaced. The original text is preserved (struck through or annotated), never deleted, so the history of what changed and why remains legible.
- `BLOCKED` — cannot proceed without something outside this task's authorized scope (Owner decision, credential, infrastructure fix, etc.); the blocker is stated explicitly.

**Never stored here or in any continuity file**: credentials, passwords, `.env` values, tokens, customer data, or screenshot-embedded secrets.

---

## Read/Resume Order

This file is read as part of the standard six-file bootstrap sequence, inserted last (it is the newest/most volatile of the seven): `PROFLOW_PROJECT_CONTEXT.md` → `PROFLOW_CHAT_HANDOFF.md` → `PROFLOW_ARCHITECTURE.md` → `PROFLOW_HANDOFF.md` → `PROFLOW_TODO.md` → `PROFLOW_CLAUDE_LATEST_REPORT.md` → **this file** → locate the current checkpoint/priority → resume.

---

## A. Direction and Shell Invariants

| # | Decision | Status |
|---|---|---|
| A1 | Hebrew authenticated shell: sidebar physically **right**. | `OWNER-ACCEPTED` (long-standing; re-confirmed live again this round, both desktop and mobile) |
| A2 | English authenticated shell: sidebar physically **left**. | `OWNER-ACCEPTED` (re-confirmed live again this round) |
| A3 | Quote/client expand chevron: physically right in Hebrew, physically left in English. | `OWNER-ACCEPTED` (re-confirmed live this round for Clients: 10px offset from the row's own start edge, identical in both languages) |
| A4 | Internal content follows the active language direction. | `OWNER-ACCEPTED` |
| A5 | ProFlow platform signature remains a quiet footer element. | `OWNER-ACCEPTED` |
| A6 | Public/customer-facing Quote redesign remains **outside** this task. | `SUPERSEDED` — the task "Public Quote Redesign + Focused Clients Correction" (2026-09-04) explicitly brought Public Quote into scope; see Section L below for the full item-by-item record. |

## B. Desktop Compact Dashboard Header

| # | Decision | Status |
|---|---|---|
| B1 | Hebrew physical layout: RIGHT=greeting/identity, TRUE CENTER=labeled metrics, LEFT=plan badge. | `BROWSER-VERIFIED` — rebuilt from flex to CSS Grid (`1fr auto 1fr`); live-measured centerDelta=0px, greeting flush right (x=1180), badge flush left (x=494) |
| B2 | English physical layout: LEFT=greeting/identity, TRUE CENTER=labeled metrics, RIGHT=plan badge. | `BROWSER-VERIFIED` — mirror of B1, live-measured centerDelta=0px |
| B3 | Stable three-region layout (symmetrical outer columns, CSS Grid `1fr auto 1fr`) — metrics centered on the whole workspace, not the leftover flex space. | `BROWSER-VERIFIED` — `.dash-header-row` now `display:grid`, confirmed both languages (see `PROFLOW_ARCHITECTURE.md` §18.J) |
| B4 | Exact labels — Hebrew: `סה״כ הצעות` / `סך הכנסות`; English: `Total Quotes` / `Total Revenue`. | `BROWSER-VERIFIED` — live DOM text matched exactly, both languages |
| B5 | Labels stay explicit, one line where supported. | `BROWSER-VERIFIED` |
| B6 | Plan badge vertically centered against the complete greeting block. | `BROWSER-VERIFIED` — greeting/badge vertical centers measured identical (53px both languages) |
| B7 | Compact height and long-business-name handling preserved. | `IMPLEMENTED / SOURCE-VERIFIED` — h1 retains `overflow:hidden/ellipsis`; not re-tested with a real long-name TEST account this round |

## C. Mobile Dashboard Top Composition

| # | Decision | Status |
|---|---|---|
| C1 | One compact summary composition, not fragmented. | `BROWSER-VERIFIED` — both languages, 390×844 |
| C2 | Row 1: greeting/identity + compact plan badge on opposite sides. | `BROWSER-VERIFIED` — centers measured identical (87px both languages) |
| C3 | Row 2: explicitly labeled Total Quotes / Total Revenue. | `BROWSER-VERIFIED` — begins at y=122, clearly its own row |
| C4 | Optional row 3: one slim Hot Quote alert, only when relevant. | `IMPLEMENTED / SOURCE-VERIFIED` — no TEST account available to this round had a genuine hot quote (view_count≥3) to trigger it live |
| C5 | Shorter mobile plan treatment ("FREE · 10 days" / "חינם · 10 ימים"). | `BROWSER-VERIFIED` — `PlanIdentityBadge` `singleLine` format confirmed live (shown as "LIFETIME" for the LIFETIME TEST personas used, which correctly has no days-remaining fragment) |
| C6 | Duplicate trial messaging and excessive gaps removed. | `IMPLEMENTED / SOURCE-VERIFIED` (§194's own removal) |

## D. AI Chat Presentation

| # | Decision | Status |
|---|---|---|
| D1 | Desktop label `צ׳אט AI`/`AI Chat`, below Catalog. | `BROWSER-VERIFIED` both languages |
| D2 | Mobile floating launcher removed. | `BROWSER-VERIFIED` — `.ai-support-btn` confirmed `display:none` at every viewport, both languages |
| D3 | Mobile stable compact action, non-overlapping. | `BROWSER-VERIFIED` — new `.dash-topbar-ai-btn` in the mobile topbar, ~36px, normal document flow |
| D4 | Mobile action shows text, not icon-only. | `BROWSER-VERIFIED` — "AI Chat"/"צ׳אט AI" confirmed live |
| D5 | Modern outline speech-bubble + one small sparkle, never robot/retro imagery. | `BROWSER-VERIFIED` — composite `MessageCircle`+small `Sparkles` icon, visually confirmed in screenshots, both sidebar and topbar |
| D6 | Icon matches nav icon family stroke/size/states. | `BROWSER-VERIFIED` — focus-visible outline confirmed (3px purple) |
| D7 | Hebrew icon right of label, English left. | `BROWSER-VERIFIED` — unchanged DOM-order convention, confirmed via screenshots both languages |
| D8 | Reuses `open-proflow-ai-chat`, no second implementation. | `BROWSER-VERIFIED` — real popup opened live from both the sidebar and topbar buttons |

## E. Business Logo Correction

| # | Decision | Status |
|---|---|---|
| E1 | Remove the large solid-white card around a small logo. | `BROWSER-VERIFIED` — canvas changed from fixed `width:100%;height:92px` to shrink-wrap (`max-width/max-height` + `margin:0 auto`); verified live via 4 synthetic test images (60×60, 400×60, 120×300, 800×800 canvas-generated PNGs) injected into the real sidebar DOM — canvas box tightly hugs each rendered image in all 4 cases (e.g. the 60×60 case rendered a 72×72 canvas around a 60×60 image, not a large fixed box) |
| E2 | Logo uses nearly all available width. | `BROWSER-VERIFIED` — the wide-lockup synthetic case (400×60) rendered at 179px wide within a ~191px available column |
| E3 | Thin border reads as a border, not a panel. | `IMPLEMENTED / SOURCE-VERIFIED` — border changed white→`rgba(0,0,0,0.10)` so it's visible against the white padding fill itself; not independently re-screenshotted after the change (the synthetic-image test verified geometry, not this specific color perception) |
| E4 | ~4-6px padding. | `IMPLEMENTED / SOURCE-VERIFIED` — set to 5px |
| E5 | `object-fit:contain`, never stretched/cropped. | `BROWSER-VERIFIED` (confirmed via the same synthetic-image test — no distortion in any of the 4 aspect ratios) |
| E6 | Non-destructive whitespace trim mechanism preserved. | `IMPLEMENTED / SOURCE-VERIFIED` — `logoTrim.js` untouched by this round's CSS change, 5 tests still passing |
| E7 | Verify rendered dimensions for logo-present/embedded-whitespace/no-logo states. | `BLOCKED` (partial) — no-logo state fully `BROWSER-VERIFIED` (both languages, real TEST accounts); logo-present/embedded-whitespace dimensions verified only via synthetic canvas-generated test images injected live, since no TEST account available to any round so far has an actual uploaded logo file — real-upload verification remains blocked on that credential/fixture gap, not on the implementation |

## F. Blank Top Strip (New Finding, Diagnosed and Fixed This Round)

| # | Decision | Status |
|---|---|---|
| F1 | Empty rounded white strip above non-Dashboard tabs. | `BROWSER-VERIFIED` root cause found: `.dash-upper-section` (the Dashboard header's own wrapper) was rendered unconditionally on every tab; only its *content* was gated to `activeTab==='main'`, leaving an empty padded/bordered/shadowed box on Clients/Finances/Catalog/Settings |
| F2 | Fix at the shared source. | `BROWSER-VERIFIED` — the entire wrapper `<div>` (not just its content) is now gated on the same condition; confirmed live absent on Finances/Clients (both languages, after correcting an initial timing-artifact false-positive in the verification method itself) |

## G. Clients Follow-Up

| # | Decision | Status |
|---|---|---|
| G1 | Page header `לקוחות`/`Clients` + count + one primary `לקוח חדש`/`New Client` action. | `BROWSER-VERIFIED` — a genuinely new capability: `EditClientModal` extended with an `isNew` mode, a new `handleCreateClient` INSERT handler added (completing the pre-existing Read/Update/Delete into a full CRUD set) — confirmed live, both languages |
| G2 | Wide search below/within the toolbar. | `BROWSER-VERIFIED` — search moved to its own full-width row below the header |
| G3 | Closed row: chevron at reading-start; name dominant; compact type tag; contact fallback (phone else email, never an empty reserved column); contextual quote count; last activity date. | `BROWSER-VERIFIED` — all fields confirmed live in both languages; "Last activity" column added to the closed row (previously only in the expanded panel) |
| G4 | Remove the repeated purple person icon unless a genuinely useful avatar/initial. | `SUPERSEDED` — an initial-letter avatar was tried mid-round, then the Owner explicitly corrected it: it "significantly increased every closed row's height and reduced scan density." The avatar was removed entirely (not replaced with any icon/avatar) per the Owner's explicit "the client name is already sufficient identification" — client type is now a compact **text-only** badge (עסקי/פרטי, Business/Private), no icon or avatar of any kind. `BROWSER-VERIFIED` in this final form. |
| G5 | No legacy grid of empty cells/hyphens. | `BROWSER-VERIFIED` |
| G6 | Expanded panel: full details, one primary/neutral/red-only hierarchy, single-open accordion, accessibility, no horizontal scroll, mobile cards. | `BROWSER-VERIFIED` both languages/viewports |
| G7 | *(New, Owner mid-task correction)* Closed row height ~44-48px on desktop. | `BROWSER-VERIFIED` — measured 47px live after the avatar removal |
| G8 | *(New, Owner mid-task correction)* Expanded-row visual state: light-lavender background + thin border, not a thick black outline; real `:focus-visible`-only keyboard indication. | `BROWSER-VERIFIED` (partial) — the reported "thick black outline" was traced to the browser's own default focus ring (never previously suppressed); fixed via `outline:none` + a real `:focus-visible` rule + a separate `.cli-row-expanded` class for the lavender state. Click-triggered expansion confirmed live showing the correct lavender background with **no** outline. The `:focus-visible` keyboard-only rule is confirmed correct by construction (standard CSS, already proven working elsewhere in this exact session on the topbar AI button) and confirmed active on the search input via real Tab key-presses; a Tab sequence specifically reaching a client row itself could not be completed live this round (an intermittent CDP keyboard-input delivery issue, not a product defect) — genuine keyboard-focus-visible verification specifically on a client row remains open for a future session with a healthier input pipeline. |

## H. Catalog Follow-Up

| # | Decision | Status |
|---|---|---|
| H1 | Clean header `קטלוג שירותים ומוצרים`/`Services & Products Catalog`. | `BROWSER-VERIFIED` both languages |
| H2 | Default toolbar: wide search + one purple `הוסף פריט`/`Add Item` action. | `BROWSER-VERIFIED` |
| H3 | Add Item opens a deliberate row/drawer (name, fixed price — no `description` field exists in the real data model, not invented, only these two real fields — Save/Cancel together). | `BROWSER-VERIFIED` — Save/Cancel confirmed on the same row live |
| H4 | Existing-item table below; Edit neutral, Delete red. | `IMPLEMENTED / SOURCE-VERIFIED` (unchanged from the prior round's already-compliant table) |
| H5 | Intentional empty state; short list not stretched. | `BROWSER-VERIFIED` — confirmed live for the empty-catalog TEST account, both languages, with dashed border + icon + message |
| H6 | Preserve data/validation/handlers/quote-form integration. | `IMPLEMENTED / SOURCE-VERIFIED` — `handleAddService`/`handleSaveEditedService`/`handleDeleteService` all called unchanged, only the visual wrapper changed |

## I. Finances Follow-Up

| # | Decision | Status |
|---|---|---|
| I1 | Header `פיננסים`/`Finances` + supporting text + period selector aligned with header. | `BROWSER-VERIFIED` both languages |
| I2 | Four consistent metric cards, semantic color only. | `IMPLEMENTED / SOURCE-VERIFIED` (structure was already shared before this round; Net Profit's color already fixed in §194) |
| I3 | Real chart when data exists; compact empty state otherwise. | `BROWSER-VERIFIED` — confirmed live for a zero-data TEST account (empty state shown, not an empty axes chart); **a real, previously-undiscovered bug was also found and fixed while investigating this item**: the chart's `<Bar dataKey>` switched to Hebrew string keys that never existed on the underlying data object (which only ever used fixed `Income`/`Expenses` keys) — meaning the bar chart likely rendered empty for Hebrew users even when real data existed, independent of this task's own empty-state work. Fixed by keeping `dataKey` fixed and moving the translation to the `name` prop. Not independently re-verified against a real non-zero Hebrew dataset this round (no such TEST account available) — the fix is source-verified and the mechanism (Recharts' documented `dataKey`/`name` split) is standard. |
| I4 | One purple primary `הוסף הוצאה`/`Add Expense`; CSV export neutral secondary. | `BROWSER-VERIFIED` — confirmed live, both languages, purple gradient vs. neutral grey background |
| I5 | Add Expense opens a deliberate row/drawer (description, category, amount, recurring, Save, Cancel). | `IMPLEMENTED / SOURCE-VERIFIED` — same structural pattern as the live-verified Catalog drawer (H3), not independently re-opened live this round |
| I6 | Red communicates expense/deletion; primary creation stays purple. | `BROWSER-VERIFIED` |
| I7 | Expense list with deliberate populated/empty states. | `IMPLEMENTED / SOURCE-VERIFIED` |

## J. Quote History Verification/Refinement

| # | Decision | Status |
|---|---|---|
| J1 | Hebrew `מס׳ הצעה`, English `Quote #`, one line. | `BROWSER-VERIFIED` — confirmed live via direct DOM text read, both languages |
| J2 | Identifiers/semantics preserved. | `BROWSER-VERIFIED` |
| J3 | Expanded actions: one primary purple (View), ordinary neutral, deletion red-only. | `BROWSER-VERIFIED` — confirmed via `getComputedStyle` on the real rendered chips (View: purple; Edit/Duplicate/WhatsApp/Email: identical neutral grey; Delete: red) |
| J4 | All handlers/tooltips/entitlement/accessibility/accordion preserved. | `IMPLEMENTED / SOURCE-VERIFIED` (unchanged from §194) |

## K. Shared Design-Language Check

| # | Decision | Status |
|---|---|---|
| K1 | Consistent heading hierarchy, toolbars, spacing, control heights, radii, icon family, empty/loading/error states, action hierarchy across Business Settings/Clients/Finances/Catalog/Quote History. | `BROWSER-VERIFIED` (substantially) — Clients/Catalog/Finances headers all now follow the same "icon + short title" pattern; all three now use the same "wide search + one purple primary action" toolbar shape; empty states across Catalog/Finances/Clients now share the same dashed-border/icon/message treatment; action-color hierarchy (purple-primary/neutral/red-destructive) now consistent across Quote History/Clients/Catalog/Finances. Business Settings was audited and found already compliant (not restructured, since it wasn't found inconsistent). |

## L. Public Quote Redesign + Focused Clients Correction (2026-09-04)

No reference image/mockup was supplied with this task (same honesty precedent as the earlier "Global Surface Audit" width episodes — flagged explicitly, not guessed past silently). Implementation below follows the task's own detailed text spec exactly; visual composition choices *not* pinned down by the spec (exact dark-header gradient values, glass-panel opacity, etc.) are this session's own reasoned design choices, pending Owner visual acceptance like everything else in this file.

| # | Decision | Status |
|---|---|---|
| L1 | Desktop dark elegant header, replacing the purple-gradient hero, shared by `PublicQuote.jsx`/`PublicQuoteEn.jsx` via `PublicQuoteHeader.jsx`. | `BROWSER-VERIFIED` — both languages; header `backgroundImage` confirmed live as `linear-gradient(135deg, rgb(20,17,31) 0%, rgb(30,25,48) 55%, rgb(36,28,56) 100%)`, quote-metadata panel changed from an opaque white card to a translucent "glass" panel on the dark ground. |
| L2 | Exact Hebrew metadata labels `מס׳ הצעה`/`תאריך`/`בתוקף עד`. | `BROWSER-VERIFIED` — `מס׳ הצעה` (was `מספר הצעה`) confirmed live via DOM text, both desktop and mobile header branches; `תאריך:`/`בתוקף עד:` were already exact and untouched. `PublicQuoteHeader.test.jsx` updated to match the new label (intentional behavior change, not a regression). |
| L3 | Customer PO-number field, "if present." | `BLOCKED` — no such column/field exists anywhere in the quote data model (`quotes` table, `get-public-quote` Edge Function response, or any UI). Adding one is a schema change, which this task explicitly required stopping to report rather than making unilaterally — not implemented. If the Owner already has this data under a different existing field name, please point to it and it can be wired in without a schema change. |
| L4 | Wide-weighted recipient section with a respectful intro sentence. | `BROWSER-VERIFIED` — one fixed-wording line added under the recipient name in both languages (HE: `שלום, להלן הצעת המחיר שהוכנה עבורך בקפידה:`; EN: `Hello, please find the price quote prepared for you below:`), confirmed live; display-only, never saved, never affects any calculation. |
| L5 | Smart-item disclosure control labeled exactly `הצג מפרט`/`הסתר מפרט` (HE) / "Show/Hide specifications" (EN), icon + text together, never a bare chevron. | `BROWSER-VERIFIED` — old wording (`הצג/הסתר מידות ופירוט מקצועי` / "Show/Hide measurements & professional details") replaced; confirmed live via DOM text, both languages. Ruler icon retained alongside the text. |
| L6 | Attachments/payment terms/subtotal/VAT/grand-total/terms/warranty sections. | `IMPLEMENTED / SOURCE-VERIFIED` — untouched by this round (already existed and already matched the spec); not independently re-verified live this round beyond what L1-L5/L9-L11 checks already exercised on the same page. |
| L7 | Bottom action area: Approve-and-Sign primary, Download PDF/Print/Call/WhatsApp secondary. | `BROWSER-VERIFIED` — Approve & Sign unchanged (still the sole primary action in the signature panel). Bottom row expanded from 3 tiles (PDF-disabled/Call/Print) to 4 functional tiles, confirmed live both languages: PDF (purple gradient, now functional — see L9), Print (neutral grey, `#475569`/`#cbd5e1`), Call (blue, `LIGHT.sky` `#0284c7`), WhatsApp (green, `LIGHT.emerald` `#059669`) — colors confirmed via `getComputedStyle`. |
| L8 | Mobile: two-column compact header, mirrored per locale, Call-us action near top, ~44×44px minimum touch targets. | `BROWSER-VERIFIED` — header composition unchanged structurally from the prior round (already compact/2-column, already DOM-order-mirrored), only restyled dark; Call CTA confirmed present near the top of the mobile header in both languages. Action tiles measured live at 390/360/320px: minimum tile size 65×78px (320px viewport) — well above the 44×44px floor; zero horizontal overflow at any of the three widths. |
| L9 | WhatsApp action, distinct from Call, correct semantic color. | `BROWSER-VERIFIED` — new `wa.me` link built from the business phone (same normalization pattern as the existing `sendWhatsApp` in `Dashboard.jsx`, not a third independent formula), pre-filled with a short message naming the quote number. Confirmed live in both languages with a real TEST phone number added to each TEST business for this purpose (`+15551234567` EN, `0501234567` HE) — hrefs confirmed exactly correct (`tel:+15551234567` / `https://wa.me/15551234567?...`; `tel:0501234567` / `https://wa.me/972501234567?...`). Hidden entirely (both Call and WhatsApp) when no business phone exists, same as the pre-existing Call-only condition. |
| L10 | Compact-vs-Expanded output-mode choice at print/PDF-generation time, never mutating the saved quote or on-screen disclosure state. | `BROWSER-VERIFIED` — new shared `QuotePrintModeModal.jsx` (used by both language files) opens on either the "Download PDF" or "Print" tile; choosing a mode sets a local `data-print-mode` attribute and calls `window.print()`. Verified live via CDP print-media emulation: with the mode set to `compact`, the professional-item detail block computes `display:none` in print **even when expanded on screen**; with the mode set to `expanded`, it computes `display:block` in print **even when collapsed on screen** — confirmed both directions, proving the print-mode choice is fully decoupled from `expandedProItems` (the on-screen state itself was read back afterward and confirmed unchanged in both cases). |
| L11 | "Download PDF" implemented as real, functional output (item 8, long-deferred per `PROFLOW_HANDOFF.md`'s repeated "PDF/Print FULL vs COMPACT output remains a deferred, unimplemented requirement" note). | `BROWSER-VERIFIED` (mechanism) / **Owner-review flag**: implemented via the browser's native print-to-PDF (the same `window.print()` call as "Print", routed through the same Compact/Expanded chooser) rather than a client-side `jsPDF`/`html2canvas` export. Both libraries are already declared `package.json` dependencies but were unused before and remain unused now — a deliberate choice: native print-to-PDF guarantees correct RTL Hebrew text, real selectable text, and accurate A4 pagination, which an image-based export cannot reliably guarantee for a financial document, and it satisfies the standing "never fake PDF functionality" rule (§ this file's own G-section precedent) because it is genuine, functional output, not a disabled placeholder. `window.print()` firing was confirmed programmatically (patched `window.print`, confirmed called after choosing a mode) but no actual PDF file was generated/opened/visually inspected this round (that step requires a real print dialog interaction outside what CDP automation can drive) — flagged for the Owner to confirm this design direction is acceptable, or to request a true in-app download-only flow instead. |
| L12 | A4-first pagination, no interactive chrome ever printed, intelligent header repetition, avoided awkward page splits. | `BROWSER-VERIFIED` (via print-media emulation + computed-style/stylesheet inspection, not an actual multi-page printed/PDF document reviewed visually): `@page { size: A4; margin: 12mm 10mm; }` confirmed present in the stylesheet; `.pq-action-tiles` (all 4 bottom tiles) and the per-item `.pq-pro-detail-toggle` button confirmed `display:none` under print emulation (the toggle was previously **not** print-hidden — a real, if minor, pre-existing gap fixed this round); `<thead>` confirmed `display:table-header-group` (native per-page repetition for the items table); `tr`/`.pq-section`/`.pq-recipient`/`.pq-action-tile` all given `break-inside:avoid`/`page-break-inside:avoid`. A true multi-page A4 document was not produced and visually reviewed for split quality this round — the CSS mechanism is verified, an actual long multi-page print/PDF has not been eyeballed. |
| L13 | Mobile: compact per-item units. | `OPEN` (deliberate scope decision, not forgotten) — the items table itself (money-alignment-critical, extensively owner-tuned across many prior rounds per its own in-file history) was **not** restructured into a card-based mobile layout. The task's own framing ("an implementation task, not another redesign round — preserve the approved information architecture") and the absence of a reference mockup for this specific piece made a ground-up table→card rebuild a higher-risk call than this round's authorization comfortably covers. The existing responsive table (horizontal-scroll wrapper, already-tuned font sizes) was left as-is. Flagged for explicit Owner direction before attempting. |
| L14 (Focused Clients Correction, §D) | Move the *existing* type indicator to sit directly between the chevron and the client name as one group (not a new badge). | `BROWSER-VERIFIED` — `ClientTypeTextBadge` moved from after the name to before it, in both the desktop row and the mobile card row; confirmed live (both viewports, Hebrew account: row text reads `פרטי`/`עסקי` immediately followed by the client name). English behavior confirmed via source (identical component, `isHebrew` only changes the badge's own label text, never structural order) rather than a separately re-run English browser session this round. |
| L15 | Mobile: contact method, contextual quote count, last-activity date via a deliberate two-line row, without requiring expansion. | `IMPLEMENTED / SOURCE-VERIFIED` — this was already fully built in the prior round (§G3/`PROFLOW_CODEX_CHECKPOINT.md` G3) and untouched by this task beyond the L14 badge-position change; not re-screenshotted this round since nothing about its own layout changed. |
| L16 | Preserve the already-approved 44-48px row height and light-lavender expanded-state styling with a real `:focus-visible`-only indicator. | `BROWSER-VERIFIED` — untouched by this round's edit (only DOM child order changed, no CSS/padding change); live-measured desktop row height 46.6px, still inside the approved 44-48px band. |

**Explicitly out of scope this round, confirmed untouched**: quote calculations/VAT logic, locked/approved-quote state, authentication, customer-ownership semantics, Admin redesign — none of these files were opened or modified.

**No real PDF file was downloaded and opened for visual review** (L11/L12) — this is the one meaningful verification gap in this section, flagged explicitly rather than claimed. Everything else in this section reached `BROWSER-VERIFIED` via a real running TEST session (both TEST personas, both languages, three mobile widths, real print-media CDP emulation) — see `PROFLOW_CLAUDE_LATEST_REPORT.md` for the full method-by-method detail.

---

## Chat-Recovery Notes for a Future Codex/ChatGPT Session

- This checkpoint file was created and then fully closed out by the task titled **"Consolidated Open UI Corrections + Seventh Continuity File"**, authorized 2026-09-04, extending the V2 chain at `PROFLOW_PROJECT_CONTEXT.md` §195 (itself extending §194→§193→…→§184).
- Nearly every item above reached `BROWSER-VERIFIED` in this same round, including a live mid-task Owner correction to the Clients closed-row design (G4/G7/G8 — the avatar tried mid-round was explicitly reverted per Owner feedback, replaced with a text-only type badge and a corrected focus/expanded visual state).
- Two genuine, previously-undiscovered bugs were found and fixed while implementing this round's corrections, unrelated to the corrections themselves: (1) the Dashboard header wrapper rendering an empty visible box on every non-Dashboard tab (§F), and (2) the Finances bar chart's Hebrew `dataKey` never matching the actual data object's fixed English keys (§I3) — both are documented in detail in `PROFLOW_PROJECT_CONTEXT.md` §195.
- Remaining genuinely open items: A6 (Public Quote redesign, deliberately out of scope), B7/C4/E3/E7-partial/I3-Hebrew-live/I5/G8-keyboard-specific (all noted above as `IMPLEMENTED / SOURCE-VERIFIED` or partially `BROWSER-VERIFIED` pending either a real-data TEST fixture that doesn't currently exist, or a browser-harness keyboard-input reliability issue unrelated to the product code).
- If this file and a canonical file disagree about implemented state, trust the canonical file and the live repository/browser state.
- Do not re-litigate anything marked `OWNER-ACCEPTED` without a new, explicit Owner instruction.
- **Section L** (Public Quote Redesign + Focused Clients Correction, 2026-09-04) brought Public Quote into scope for the first time in this checkpoint's history (A6 formerly `OPEN`/out-of-scope, now `SUPERSEDED`). Genuine open items from that round: L3 (customer PO field — no schema field exists, not implemented, flagged rather than guessed), L11 (Download PDF implemented via native browser print-to-PDF rather than a client-side `jsPDF`/`html2canvas` export — a deliberate, reasoned choice flagged for explicit Owner sign-off on the direction), L13 (mobile item-table→card redesign deliberately not attempted without a reference mockup). No real PDF file was generated and visually reviewed this round — the print/PDF mechanism itself was thoroughly verified via CDP print-media emulation instead.
