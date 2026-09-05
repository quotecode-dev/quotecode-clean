# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: New Focused Task — Faded Business Logo in Direct PDF Download

**MODE: TEST/local-only. NOT authorized: application commit, application push, deployment, Production change, database change, LIVE action, payment/email/message trigger.**

This is an independent, narrowly-scoped correction, separate from the prior "Recover Browser QA / Smart Quote UX" task (already reported complete separately — not reopened or rewritten here). Its own report remains valid and untouched.

**This task IS complete and PDF-visually-verified.** The real defect was root-caused with live browser evidence, fixed, and the fix was confirmed by inspecting genuine downloaded PDF files (not a simulation).

---

## Owner-observed defect

In a real PDF downloaded from the Hebrew public quote's "Download PDF" (the direct html2canvas+jsPDF path, not `window.print()`), the business logo in the header rendered extremely pale/washed-out while the rest of the document was readable.

## The task's own starting hypothesis — investigated and disproven

The task suspected a missing `crossOrigin="anonymous"` on the logo `<img>` was causing `html2canvas` (`useCORS: true`) to taint the canvas for a cross-origin `logo_url`, "possibly Supabase Storage."

**Both parts of that premise were checked against real code/live evidence and corrected:**

1. **No Supabase Storage bucket exists for logos at all.** Grep-confirmed the only bucket (`quote-files`, in `Dashboard.jsx`) is for quote attachments. `SettingsTab.jsx`'s logo control either embeds an uploaded file as an inline base64 data URI (`FileReader.readAsDataURL` — same-origin, never CORS-relevant) or accepts a business-typed plain external URL of any host. The genuine cross-origin case only exists for the latter.
2. **Reproduced live** with a real external test image (`dummyimage.com`, real `Access-Control-Allow-Origin: *`), uploaded through the actual Business-Settings-save flow on the Local/Hebrew Basic TEST persona (not simulated). Confirmed the original `<img>` (no `crossOrigin`) genuinely taints a canvas (`SecurityError` on `toDataURL`) — the hypothesis was plausible. But after adding `crossOrigin="anonymous"` and confirming the canvas was then truly non-tainted, a byte-for-byte identical `html2canvas` capture of the logo region proved the attribute had **zero effect** on the actual pale output. `useCORS: true` already handles this internally for this defect's purposes. The attribute was kept anyway as legitimate, harmless canvas-safety hygiene (with an `onError` fallback to plain loading, so a genuinely non-CORS host can never break on-screen display) — it just was not the fix.

## The real root cause — proven by live pixel-value evidence

The logo sits inside a wrapper `<div style="background: rgba(255,255,255,0.92); ...">` (the white "chip" against the dark on-screen header). **`html2canvas` paints this parent's translucent background-color OVER its child `<img>` instead of behind it** — a paint-order bug in the library for this exact structure, unrelated to CORS or timing.

Proof, in order, all live-measured in the real browser:
1. Wrapper background forced fully **transparent** → captured logo pixel read back as the exact true source color `rgb(30,90,210)` (`#1e5ad2`) — perfect.
2. Wrapper background forced fully **opaque white** → same pixel read back as pure `rgb(255,255,255)` — logo completely hidden.
3. The real, unmodified **92%-opacity** wrapper background → same pixel read back as `rgb(237,242,251)` — the exact mathematical blend of 92% white over the true blue (predicted `237.0, 241.8, 251.4`). This proves the image renders correctly first and the chip's background is then incorrectly painted on top of it, at whatever opacity it happens to have.

Also disproven as contributing causes: the `.pq-pdf-capturing .pq-header-box` text-contrast rule (defect reproduces identically with that class entirely absent) and the existing fixed 80ms capture delay (image was already `complete:true` with correct dimensions well before capture in every test; a live `Network.enable` trace showed zero re-fetch to the logo host during capture).

## The fix

- Added a `pq-logo-chip` class to the wrapper `<div>` in both branches (Mobile/Desktop) of the shared `PublicQuoteHeader.jsx`.
- Added `.pq-pdf-capturing .pq-logo-chip { background: transparent !important; }` to both `PublicQuote.jsx` and `PublicQuoteEn.jsx` (identical rule, both languages, since the header component is shared).
- Safe specifically because the pre-existing `.pq-pdf-capturing .pq-header-box` rule directly above it already forces the whole header background to opaque white at the exact moment of capture — the chip's own background is provably 100% redundant at that instant. Removing it only during capture eliminates the bug's opportunity without any artificial opacity/brightness/filter/recoloring on the logo, without touching the uploaded logo file, and without changing normal on-screen appearance.
- Kept `crossOrigin="anonymous"` + `onError` fallback on the logo `<img>` (canvas-safety hygiene, not the fix itself) and added `waitForImagesReady()` to `generateQuotePdf.js` (awaits `img.decode()` with a safe fallback and bounded timeout, before calling `html2canvas`) — addressing a related risk the task correctly flagged (a fresh CORS-mode fetch racing a short delay), even though it wasn't the cause of this particular defect.

## BROWSER/PDF-VISUALLY-VERIFIED (real files, not simulated)

Extracted the actual embedded JPEG image directly from each downloaded PDF's own byte stream and viewed it:

1. **Hebrew, Compact mode, real cross-origin logo** — BEFORE: logo barely visible (pale near-white haze). AFTER: crisp, fully opaque, exact correct blue, correctly proportioned. Same quote, same session, only the fix differs.
2. **English (genuine International/USD persona), Expanded mode** — logo crisp/correct/left-positioned; full measurement sub-table renders correctly. Confirms symmetry across languages.
3. **No-logo fallback** (logo URL cleared, confirmed zero `<img>` elements present) — PDF correctly shows the bold business name instead. No regression.
4. **Compact and Expanded modes** both exercised (Hebrew/Compact, English/Expanded).
5. **Native print path** confirmed unaffected: `.pq-logo-chip`'s computed background under real `Emulation.setEmulatedMedia('print')` stayed at the original 92%-opacity white, since `.pq-pdf-capturing` is a JS-toggled class native print never sets — the fix cannot leak into printing by construction.
6. **Normal on-screen rendering** at a real emulated mobile viewport (390×844) confirmed unchanged.

## SOURCE-VERIFIED

`crossOrigin`/`onError` fallback in `PublicQuoteHeader.jsx`; `waitForImagesReady()` in `generateQuotePdf.js`, exported and covered by 5 new unit tests (already-complete fast-path, awaiting `decode()`, a rejected `decode()` not crashing, the load/error-listener fallback, and the timeout bound).

## Regression coverage

6 new tests in `PublicQuoteHeader.test.jsx` (crossOrigin + `.pq-logo-chip` presence in both Desktop/Mobile × both languages, the onError fallback, no-logo path never renders an `<img>`); 5 new tests in `generateQuotePdf.test.js`. `npx vitest run`: **441/441 passing, 30 files** (+12 from this task; was 429/429 at the close of the prior task). `npx eslint` clean (0 errors) on every touched file. `npx vite build` succeeds (same pre-existing chunk-size advisory, unrelated). Full-diff secret scan clean.

## Files changed this task

`src/components/PublicQuoteHeader.jsx`, `src/components/PublicQuoteHeader.test.jsx`, `src/utils/generateQuotePdf.js`, `src/utils/generateQuotePdf.test.js`, `src/pages/PublicQuote.jsx`, `src/pages/PublicQuoteEn.jsx` — all additive edits on top of the pre-existing dirty working tree; no unrelated file touched, no file created or deleted (`git status` count unchanged at 72).

## Explicit statements

- **PRODUCTION/LIVE TOUCHED?** NO
- **DEPLOYMENT PERFORMED?** NO
- **APPLICATION COMMIT/PUSH PERFORMED?** NO (`HEAD` unchanged: `main`, `f3b59d0`)
- **DATABASE/SCHEMA CHANGED?** NO (TEST personas' `logo_url` changed only through the app's own normal Save Business Settings action — ordinary TEST-data use, not a schema change)
- **PAYMENT OR REAL EMAIL/MESSAGE/WHATSAPP/SIGNATURE TRIGGERED?** NO
- **OWNER FINAL VISUAL ACCEPTANCE:** PENDING (real PDF files were generated and visually inspected by Claude this session; Owner has not yet independently reviewed the fix)

**Recovery instruction for the next session**: this task is closed — no further work is required on the logo defect itself. The unrelated prior task (Smart Quote UX, Item E / English-mobile pass / FREE-tier-lock live walkthrough) remains open exactly as previously reported and is unaffected by this task.
