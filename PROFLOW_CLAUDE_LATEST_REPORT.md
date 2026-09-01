# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Forensic Follow-Up — Observed LIVE State Transition + David Aluminum Public Quote Width

**MODE: READ-ONLY FORENSIC INVESTIGATION. NO application/DB/TEST/Production mutation.**

---

## Issue A — Observed LIVE state transition

**Earlier observed state**: LIVE Dashboard visibly narrower than TEST/LOCAL Dashboard.
**Current observed state**: LIVE and TEST now match, under matched browser conditions.

**Forensic timeline, built from real evidence** (`git reflog`, `vercel ls --prod`, `vercel inspect --logs`):
- `origin/main` = `26dee96` continuously across both Owner observations — confirmed via `git rev-parse`, checked at the start of every task this session, never moved.
- The current live Production deployment (`dpl_4tXyySB1...`) was built from commit `26dee96`, confirmed directly from its build log (`Cloning ... Commit: 26dee96`, `✓ built in 11.82s`), went `● Ready` at `2026-09-01 19:50:54 UTC`.
- `vercel ls --prod` confirms **zero Production deployments since** — this is the same deployment currently serving LIVE.
- A live `/dashboard` response header (`Last-Modified: 19:51:35 UTC`) initially appeared to predate this deployment by ~3 hours; reconciled as a timezone-representation artifact (Vercel's own "created" field displays Israel local time, GMT+3, while the HTTP header is UTC) — the two actually match, no real staleness found.
- Real, controlled-viewport re-measurement of the live domain this task reproduced the prior task's own result: byte-identical `980px` Dashboard geometry to TEST.

**Current TEST-LIVE Dashboard geometry parity**: **PASS**.

| Question | Answer |
|---|---|
| Application source change proven? | **NO** — proven not to have occurred |
| Commit proven? | **NO** |
| Push proven? | **NO** |
| Deployment proven? | **NO** — same deployment served both observations |
| Browser/runtime/environment cause proven? | **NO** — plausible (window width, zoom, or a local cache that later refreshed), not provable from server-side evidence |

**OBSERVED STATE TRANSITION: UNEXPLAINED** — with server-side/deployment causes affirmatively ruled out by evidence, not left ambiguous; the remaining plausible explanation (a client-side viewing-condition difference between the Owner's two sessions) could not be proven and is not converted into a PASS.

## Issue B — David Aluminum Public Quote: two different pages, only one is actually narrow

Real, live, read-only measurement of both candidate pages David's Dashboard can reach, using his actual real quote data:

| Surface | Viewport | Primary visible width | Left/right whitespace | Utilization | Inner content | Outer shell | Scale/transform | Canonical source | Exception authorized | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| LIVE Dashboard HE | 1440 | 980 | 222.5 / 237.5 | 68.1% | 980 | n/a (no shell) | none | `--pf-dashboard-desktop-content-width` | n/a | reference |
| LIVE real Public Quote HE (`/public-quote/:id`) | 1440 | 1062 (shell) | 181.5 / 196.5 | **73.8% — wider than Dashboard** | 980 | 1062 | none | `--pf-desktop-content-width` (calc()) | YES — documented shell, §10.AH/AI | PASS (content matches Dashboard exactly) |
| TEST real Public Quote HE equivalent | 1440 | 1062 (shell) | same | same | 980 | 1062 | none | same token | same | PASS — identical to LIVE (§141/§142) |
| LIVE Item 30.E preview HE (`/public-quote/:id/preview`) | 1440 | **620** | 402.5 / 417.5 | **43.1% — genuinely narrow** | n/a — single box, no separate inner/shell split | 620 | **none confirmed** (full ancestor chain checked, no `transform`) | own hardcoded literal, not the shared token | **PARTIAL** — qualitative B+ concept approved; the specific `620px` number never separately reviewed/locked | geometry PASS (as-implemented), Owner numeric acceptance NOT obtained |
| LIVE Dashboard EN | — | — | — | — | — | — | — | same architecture | — | structural PASS (zero locale-conditional width logic, established §143) |
| LIVE Public Quote EN | — | — | — | — | — | — | — | same architecture | — | structural PASS (identical `.pq-card-desktop-width` class/token confirmed via source) |
| Item 30.E preview EN | — | — | — | — | — | — | — | **no route exists** | n/a | **NOT APPLICABLE** — `AppGlobal.jsx` has zero route for this page |

**Correction to the prior forensic report's own framing**: the real, customer-facing Public Quote page is **not the narrow surface** — it is measurably *wider* than Dashboard. **The genuinely narrow surface is the Item 30.E comparison-concept preview** (`ProfessionalPublicPreview.jsx`), confirmed this task with a direct, unscaled `max-width:620px` and David's own real live data (upgrading the prior proxy-based measurement, §141.6/§142.6, to real-route evidence).

## Final questions, answered explicitly

1. **What changed between the earlier and current LIVE Dashboard observations?** Nothing provable on the server/deployment side — ruled out with evidence (git history, Vercel build logs).
2. **If nothing in the application changed, what caused the observed visual transition?** Not provable. Most plausible remaining explanation: a client-side viewing-condition difference between the two observation sessions.
3. **What exact element creates the visible width of David Aluminum Public Quote?** Depends which page: `.pq-card` (real Public Quote, 1062px shell/980px content) or a plain `max-width:620px` div (Item 30.E preview).
4. **Why does it visually appear substantially narrower than Dashboard?** Only true for the Item 30.E preview (43.1% utilization vs. 68.1%) — a direct, deliberate cap. The real Public Quote page is not narrower.
5. **Is that difference intentional per an explicit product requirement, or merely existing implementation?** The qualitative Concept B+ direction is Owner-approved (§123-§126); the specific `620px` number was never independently put to the Owner and never locked (unlike Mobile's `5px`, §138).
6. **Does the same cause exist in EN?** No EN route exists for the Item 30.E preview at all — not applicable. The real Public Quote's shell/content architecture is identical HE/EN.
7. **Does the same cause affect any other surfaces?** No — isolated to this one file, per the exhaustive §143 system-wide discovery.
8. **Smallest safe correction if the Owner later authorizes it?** Reference the shared canonical token instead of the hardcoded `620px`, the same technique already used for `ProfessionalQuotePreview.jsx` (§141) — not implemented, not authorized.
9. **What previously approved/LOCKED behavior could it endanger?** Not the Mobile B+ Lock (§138, structurally independent) — but it would materially risk reopening the Concept B+ density/document-character decision itself (§125), which is a design conversation, not a mechanical fix.
10. **Required TEST regression matrix before any future implementation?** HE Desktop re-verification at the new width; zero Mobile change (already structurally guaranteed); item-card/expand-interaction re-verification; zero overflow/console errors; and explicit fresh Owner visual review of the specific new width — not just geometry-matching, since this reopens an approved qualitative decision.

## Six-file reconciliation

- `PROFLOW_PROJECT_CONTEXT.md` — **UPDATED** (new §145, 5 subsections)
- `PROFLOW_TODO.md` — **UPDATED** (item 47, new cross-referencing update)
- `PROFLOW_HANDOFF.md` — **UPDATED** (new §18.GQ)
- `PROFLOW_CHAT_HANDOFF.md` — **UPDATED** (§14, new lead paragraph)
- `PROFLOW_ARCHITECTURE.md` — **REVIEWED — NO CHANGE REQUIRED**
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — **UPDATED** (this file)

## Continuity commit SHA + remote read-back

*Filled in by the SHA-follow-up commit, per this project's standing two-commit convention.*

---

FOLLOW-UP FORENSIC AUDIT: PASS
OBSERVED LIVE STATE TRANSITION: UNEXPLAINED
CURRENT TEST-LIVE DASHBOARD PARITY: PASS
DAVID PUBLIC QUOTE VISUAL GEOMETRY ROOT CAUSE: PROVEN
DAVID PUBLIC QUOTE OWNER ACCEPTANCE: PENDING
HE/EN PUBLIC QUOTE PARITY: PASS (real Public Quote); N/A (Item 30.E preview has no EN route)
CROSS-SURFACE IMPACT: IDENTIFIED — isolated to one file, no other surface affected
APPLICATION CHANGES: NONE
DOCUMENTATION CHANGES: SIX-FILE CONTINUITY CHECKPOINT (this record, explicitly requested by the Owner after this task's own findings were delivered in-chat; the investigation itself made zero documentation edits at the time it ran)
DATABASE CHANGES: NONE
TEST MUTATIONS: NONE
PRODUCTION MUTATIONS: NONE
COMMIT: NONE (application code)
PUSH: NONE (application code)
DEPLOY: NONE
LIVE ACTION: NONE
WAITING FOR OWNER + CHATGPT REVIEW
