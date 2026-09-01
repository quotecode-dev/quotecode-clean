# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Comprehensive TEST ↔ Production UI/Layout Parity Audit

**Full READ-ONLY diagnostic scan. No application/DB/TEST/Production mutation. No commit/push/deploy of application code.**

---

## TEST ↔ PRODUCTION UI PARITY AUDIT: **COMPLETE**
## DASHBOARD WIDTH ROOT CAUSE: **NOT IDENTIFIED** (source/runtime parity proven identical; leading hypothesis is browser zoom/DPI, unconfirmable from this environment)
## MOBILE/DESKTOP ISOLATION: **VERIFIED**
## B+ CROSS-SURFACE IMPACT: **NO**

---

## 1. Fresh Local State

Local `main` at task start: `677d01a`, exactly `origin/main` (`26dee96`) plus documentation-only commits — confirmed via `git diff origin/main HEAD -- . ':!PROFLOW_*.md'` returning empty. Working tree clean besides the standing untracked `entry-server.jsx`.

## 2. TEST Runtime Identity

Local Vite dev server, `npm run dev:localtest`, port 5186, `.env.localtest.local` → `quotecode-test` Supabase (ref `ljfizgrdyzxddswcedwr`). Serves the current working tree directly — no build, no pinned commit.

## 3. Production Runtime Identity

Deployed Vercel build at `https://www.quotecodepro.com/`, built via `vite build` from `origin/main` (`26dee96`), connected to `quotecode` Supabase (ref `ixabnzhjeqevtbhdfswv`).

## 4. TEST vs Production Source Parity

**SAME SOURCE**, proven via `git diff` (item 1) — zero application-file difference between the local working tree (served by both local dev servers) and `origin/main` (what deployed Production is built from).

## 5. Dashboard Full Container-Chain Comparison

Real authenticated login (real form) against TEST-local, Production-pointed local dev, and real deployed Production — two different real accounts (one fresh/empty, one with fixture data). `.dash-main-content`/table geometry **byte-identical across all three**, every tested width.

## 6. Exact Width Measurements

| Width | table left | table right | table width (all 3 envs) |
|---|---|---|---|
| 1280 | 157.5 | 1107.5 | 950 |
| 1366 | 200.5 | 1150.5 | 950 |
| 1440 | 237.5 | 1187.5 | 950 |
| 1920 | 477.5 | 1427.5 | 950 |

`.dash-main-content` padding: 16px both sides, identical everywhere.

## 7. Browser Zoom/DPI Findings

`devicePixelRatio` confirmed `1` in every controlled CDP session. The Owner's own original screenshot viewing conditions (zoom/DPI/window width) are unknown from this environment — recorded as the leading unconfirmed hypothesis, not asserted as proven.

## 8. Mobile/Desktop Isolation Result

**VERIFIED, structurally.** Three independent, non-shared `isMobileView` implementations exist project-wide (`ProfessionalPublicPreview.jsx`, `PublicQuoteHeader.jsx`, `QuotesTab.jsx`), each with its own `matchMedia` listener, no shared state. `Dashboard.jsx` uses zero JS breakpoint logic. `.dash-main-content` is defined and used exclusively within `Dashboard.jsx`.

## 9. Recent-Commit Impact Trace

Cumulative diff across the three recent releases (AUDIT-005 CTA; AUDIT-001-005+B+-10px; B+-5px): exactly 5 files touched (`PublicQuoteHeader.jsx`+test, `CustomerQuoteItemRow.jsx`, `ProfessionalItemComparisonCard.jsx`, `ProfessionalPublicPreview.jsx`) — none shared with `Dashboard.jsx` or `index.css`'s Dashboard-relevant variables. Zero possible cross-surface impact.

## 10. Full User-Facing Width/Layout Inventory

Confirmed via `Dashboard.jsx`'s own source comment: Dashboard, Quote History, Clients, New Quote, Business Settings, Catalog, and Finances all render inside the exact same `.dash-main-content` wrapper already measured at item 6 — structural parity extends to all of them by direct construction (individual tabs not separately live-remeasured this task — recorded as NOT VERIFIED, not assumed). Public Quote and the Item 30.E B+ preview each use their own separate, isolated width architecture. Full matrix at `PROFLOW_PROJECT_CONTEXT.md` §136.7.

## 11. Global CSS/Shared-Layout Findings

No unexpected `100vw`/`zoom`/`transform:scale` rules in `index.css`. `App.css` confirmed dead (zero imports). **One significant, fully-explained finding**: `--pf-dashboard-desktop-content-width` is currently aliased to Public Quote's own locked `--pf-desktop-content-width` (980px) — a later, Owner-final, already-documented-in-source decision superseding the earlier §55-§57 experimental-width history. Not a bug.

## 12. Environment-Conditional Rendering Findings

Exactly 4 `import.meta.env` references, all in `src/shared/supabase.js`, all Supabase-target selection only — reconfirmed fresh, matching the prior exhaustive sweep on record. Zero layout/width/breakpoint/locale conditional logic anywhere.

## 13. Data-Dependent Layout Findings

Container width structurally independent of data density — confirmed by the same measurement (item 5) using one empty account and one populated account, byte-identical geometry either way.

## 14. Scrollbar/Center-Axis Findings

`scrollbar-gutter: stable` on `html`, global, unconditional — the already-documented fix. Not independently re-measured live this task (no fresh evidence of regression; recorded NOT VERIFIED for this specific sub-item).

## 15. Agent HE Report

PASS — RTL confirmed correctly applied in both sessions tested; Dashboard geometry byte-identical; no HE-specific width-token branch found.

## 16. Agent EN Report

Structural PASS (same shared wrapper, no market-conditional branch on it) — **not independently live-tested this task** (only Local/HE accounts were used for the three-way comparison). Recorded as a gap.

## 17. Claude Lead Reconciliation

Independently re-derived from the same evidence — HE and EN findings are consistent with each other; no additional discrepancy surfaced by either role beyond what direct measurement already established.

## 18. Contract-Process Escapes

None found this audit. The one informational finding (item 11 / stale session working-memory of §55-§57 vs. the current source) is recorded as a "prior history ≠ current source truth" lesson, not a contract violation.

## 19. Full Parity Matrix

See `PROFLOW_PROJECT_CONTEXT.md` §136.7 for the complete SURFACE × TEST/Production source/width-rule/HE/EN/Mobile/Desktop/parity table.

## 20. Root-Cause Answers A–J

Full answers at `PROFLOW_PROJECT_CONTEXT.md` §136.15. Summary: source parity (A: same code) and runtime geometry parity (B: same geometry) are both proven; the Owner's original observed difference (C) remains unidentified from this environment — leading hypothesis is a zoom/DPI/viewport mismatch between the two compared screenshots. B+ did not affect Dashboard (D: no). Mobile/Desktop isolation is sound (E: yes). One intentional shared-value alias was found and fully explained (F/G). No bugs found (H: none). No Production risk identified (I: none). No remediation required by this audit's own findings (J).

## 21. P0/P1/P2/P3 Findings

P0/P1/P2: none. P3: one informational-only item (stale session memory of superseded width history, corrected via source read this task).

## 22. Explicit NOT VERIFIED List

Clients/New Quote/Business Settings/Catalog/Finances tabs individually; Public Quote HE/EN fresh live remeasurement; Landing/Auth; Document-preview route; a live International/EN account's Dashboard geometry; the Owner's own screenshot viewing conditions; scrollbar-gutter live re-verification.

## 23. Recommended Remediation Order (recommendation only — none required)

1. If available, the Owner's original two screenshots (or a stated zoom/window-width) would let a future task close the root-cause question definitively.
2. Optional: a forward-pointing note in §55-§57 toward the superseding §58/`index.css` decision (this audit's §136.8 now serves that purpose).
3. Extend live coverage to the NOT VERIFIED surfaces whenever a future task next touches any of them.

## 24. Confirmation: Application Code Unchanged

Confirmed via `git status --short` throughout — only the standing untracked `entry-server.jsx`. Zero edits made to any application file this task.

## 25. Confirmation: TEST/Production Unchanged

Zero DB mutation (only pre-existing accounts' own read-only login + page loads). Zero TEST mutation. Zero Production mutation. No commit/push/deploy of application code.

## 26. Six-File Continuity Ledger

- `PROFLOW_PROJECT_CONTEXT.md` — **UPDATED** (§136)
- `PROFLOW_TODO.md` — **UPDATED** (new item 45)
- `PROFLOW_HANDOFF.md` — **UPDATED** (new §18.GJ)
- `PROFLOW_CHAT_HANDOFF.md` — **UPDATED** (§14, new lead paragraph)
- `PROFLOW_ARCHITECTURE.md` — **REVIEWED — NO CHANGE REQUIRED**
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — **UPDATED** (this file)

## 27. Continuity Commit SHA + Remote Read-Back

`8c11ae5293e62aa78a7192fc7f18cce7a18b2f89` on `proflow-continuity` (pushed; content commit `f5d9294` + this SHA-follow-up commit). Matching commits exist locally on `main` (`b23eeea` content, `06b7824` follow-up) — not pushed to `origin/main` (no application push occurred or was authorized this task). **REMOTE READ-BACK: PASS** — `git fetch` + `git rev-parse origin/proflow-continuity` confirmed `f5d9294f501ccdd1fbfab3375dadffe3a05ba825` (content commit) exactly, followed by `git show origin/proflow-continuity:<path>` reads confirming `PROFLOW_PROJECT_CONTEXT.md` §136 and `PROFLOW_HANDOFF.md` §18.GJ both present and correct. `origin/main` re-fetched and confirmed unchanged at `26dee96fc511d71715fe8675426920daff06719a`.

---

Application code confirmed unchanged throughout. Zero DB/TEST/Production mutation of any kind. No commit/push/deploy of application code this task.
