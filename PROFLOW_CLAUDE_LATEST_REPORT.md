# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Forensic TEST-vs-LIVE Desktop Geometry Audit

**MODE: READ-ONLY FORENSIC INVESTIGATION. Zero application/DB/TEST/Production mutation. No commit of application code. No push. No deploy. No LIVE action.**

---

## 0. Fresh Local State

`git fetch` confirmed `origin/proflow-continuity`=`3416a98`, `origin/main`=`26dee96` (unchanged). Local `main` at `99688c8`. Working tree clean besides the standing untracked `entry-server.jsx`. **Zero application file touched by this task** — `git diff --stat` empty before and after. TEST (5186) serves the current working tree directly, no build, no pinned commit (its own already-documented nature). Production serves `origin/main`@`26dee96`, re-confirmed unchanged.

## Six canonical files — read and reconciled

All six read fresh from `proflow-continuity` this session's own most recent state (this session authored the current tip); no material contradiction found between documented state and freshly-measured evidence — the investigation's own findings (below) *refine* prior evidence (upgrading proxy evidence to real evidence) rather than contradicting it.

## Primary observation — proven with real evidence, not assumed

Real, controlled, same-viewport measurement of the **actual deployed** `quotecodepro.com` (a genuine real Production account, read-only, zero mutation) at 1366/1440/1920px viewport widths: **LIVE Dashboard = TEST Dashboard, byte-identical, `980px` width, matching centerX, `0px` delta at every width tested.** Full table: `PROFLOW_PROJECT_CONTEXT.md` §144.3.

**This is not screenshot-derived.** No width was calculated from the two attached images; both images were treated as evidence of *what the Owner observed*, not as a source of numeric truth — exactly per this task's own explicit instruction. The numeric result above comes entirely from live `getBoundingClientRect()`/`getComputedStyle()` reads of the real, running application.

## A. Exact root cause(s)

1. **Primary observation (Image 1 vs Image 2)**: no code/build/deployment cause exists. Proven, not assumed — real, controlled, same-viewport measurement shows zero delta between TEST and LIVE at every width tested. The visual difference between the two screenshots is most plausibly explained by the two images not having been captured at matched actual browser viewport/window widths.
2. **Second symptom (David's Public Quote "narrower")**: a real, deliberate, already-Owner-reviewed architectural characteristic — a decorative document shell (`1062px` outer) wrapping a `980px` inner content box that matches Dashboard exactly. Not a bug.

## B. First divergence point(s)

**Between TEST and LIVE**: none — byte-identical throughout, at every level checked (source, resolved CSS custom properties, rendered geometry).

**Between Dashboard and Public Quote**: at the content-box wrapper itself — Dashboard has no decorative shell (its own div IS the visible content); Public Quote's `.pq-card` is a decorative shell with its own padding/border budget.

## C. TEST-vs-LIVE source/geometry equivalence

**YES, proven equivalent.** Same source (`git diff origin/main HEAD`, empty for all non-documentation files). Same resolved CSS custom-property values, read live from the real running browser. Same rendered geometry, at every viewport tested.

## D. One canonical geometry system today?

**YES**, for every surface measured. One shared CSS custom property (`--pf-desktop-content-width` / its Dashboard-side alias), correctly consumed everywhere checked. One already-fixed-but-not-yet-released bypass on record (`ProfessionalQuotePreview.jsx`, §141). One newly-found, currently-**inert** legacy literal (below).

## E. Complete list of bypasses/exceptions discovered

- `ProfessionalQuotePreview.jsx`'s former `760px` — fixed at §141, TEST/local only, not yet released to `origin/main`.
- A dead inline `maxWidth:'1100px'` literal inside both `PublicQuote.jsx` and `PublicQuoteEn.jsx`'s own card — **confirmed inert** this task via a real LIVE Mobile-viewport read (it only becomes the "active" resolved value at Mobile widths, where nothing else constrains the card below it anyway — harmless, never the operative Desktop rule). Flagged for future cleanup, not touched (touches two LOCKED files).
- Item 30.E's own `620px` (`ProfessionalPublicPreview.jsx`) — explicit, Owner-approved documented exception, §123-§126.

## F. Why the current permanent rule failed to prevent this

It didn't fail to prevent a code defect — none was found. It failed to prevent the Owner's own *perception* of a defect, because no release step currently produces a controlled, same-viewport, side-by-side TEST-vs-LIVE comparison artifact for Owner review before/after a release is treated as accepted.

## G. Smallest architectural correction that would make recurrence structurally difficult

1. A controlled, same-viewport TEST-and-LIVE screenshot/measurement pair as part of any future Desktop-geometry-relevant release's own documentation (process change, zero code risk).
2. The already-recommended automated lint guard against a future hardcoded Desktop width (`PROFLOW_TODO.md` item 49) — new tooling, zero runtime-behavior risk by construction.
3. *Optional*: remove the now-confirmed-dead `1100px` inline literal from `PublicQuote.jsx`/`PublicQuoteEn.jsx` — pure dead-code cleanup, zero behavior change.

**None of these are implemented this task.** All require separate Owner authorization.

## H. Blast radius of that correction

(1) documentation-process only. (2) new tooling only, cannot itself change runtime output. (3) touches two LOCKED, extensively-verified files — even though the literal is confirmed inert, §54's stop condition applies to any edit of a LOCKED file's geometry-relevant code, so this specifically would need explicit Owner authorization naming the exact edit before being attempted.

## I. Previously approved/locked behavior that could be endangered

**None, by this task** (read-only). The Mobile B+ Lock (§138) and Public Quote's own 980px LOCK (§10.AI) are both untouched and are not implicated by any of the three G-recommendations — (3) was specifically sized to avoid touching either.

## J. Required regression matrix before any implementation could be accepted

HE/EN Dashboard geometry (all standard breakpoints), HE/EN Public Quote geometry (content box AND shell), Mobile B+ geometry, money/totals/CTA geometry (unrelated files, confirm zero incidental touch), zero new lint errors, zero new console errors, zero TEST/Production data mutation.

## K. TODO items affected

Item 47 — this task adds real LIVE confirmation, not a new implementation (updated in the same checkpoint). Item 49 — this task's finding (E, second bullet) is additional supporting evidence, not a new item.

## L. Continuity files requiring updates after an authorized implementation

Same six-file discipline as every task this session: `PROFLOW_PROJECT_CONTEXT.md` (a new dated section for the specific authorized change), `PROFLOW_TODO.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_CHAT_HANDOFF.md` — no different requirement introduced by this finding.

## Six-file reconciliation

- `PROFLOW_PROJECT_CONTEXT.md` — **UPDATED** (new §144, 10 subsections)
- `PROFLOW_TODO.md` — **UPDATED** (item 47, new cross-referencing update)
- `PROFLOW_HANDOFF.md` — **UPDATED** (new §18.GP)
- `PROFLOW_CHAT_HANDOFF.md` — **UPDATED** (§14, new lead paragraph)
- `PROFLOW_ARCHITECTURE.md` — **REVIEWED — NO CHANGE REQUIRED**
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — **UPDATED** (this file)

## Continuity commit SHA + remote read-back

*Filled in by the SHA-follow-up commit, per this project's standing two-commit convention.*

---

FORENSIC DESKTOP GEOMETRY AUDIT: PASS
TEST-vs-LIVE ROOT CAUSE: PROVEN — no code/build/deployment divergence; TEST and LIVE Dashboard geometry byte-identical at every controlled viewport tested (1366/1440/1920px)
CANONICAL GEOMETRY CONTRACT: PRESENT
CROSS-SURFACE PARITY: PASS — Dashboard/Public Quote content-box geometry identical; Public Quote's document shell is a documented, non-defect exception
HE/EN GEOMETRY GOVERNANCE: PASS (HE real-verified this task; EN structural, per zero locale-conditional width logic, not independently re-verified live this task — no real LIVE International account credentials available)
APPROVED MOBILE WORK TOUCHED: NO
APPLICATION CHANGES: NONE
DATABASE CHANGES: NONE
TEST MUTATIONS: NONE
PRODUCTION MUTATIONS: NONE
COMMIT: NONE (documentation only)
PUSH: NONE (application code)
DEPLOY: NONE
LIVE ACTION: NONE
WAITING FOR OWNER + CHATGPT REVIEW
