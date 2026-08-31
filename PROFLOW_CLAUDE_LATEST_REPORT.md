# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Document New High-Priority Product Initiative — Professional / Industry-Aware Quote Item Model

**Documentation only. No application code, database, TEST, Production, Edge Function, or Vercel change of any kind. Does not affect Wave 3's own state (Function 1/Function 2 remain exactly as reported previously — Wave 3 IN PROGRESS, end-to-end send test still pending).**

---

## TASK: Document New High-Priority Product Initiative
## EFFORT: EXHAUSTIVE / PRODUCT-DESIGN DOCUMENTATION
## STATUS: **PASS**

---

## WHAT THIS TASK RECORDS

The Owner reviewed a real existing David Aluminum quote and identified a major product opportunity: its commercial price rows (`8 units × ₪1,250 = ₪10,000`) are fully disconnected from the actual professional work specification (apartment/location, screen/window type, and many real dimension pairs — `265×161`, `226×89`, `214×100`, `211.5×99`, `106×69.5`, `114×69.5`, `112.5×68`, `90×49.5`, others) currently trapped in free-text Additional Notes. **Core insight: much of what sits in Additional Notes today is not actually a note — it is structured work-specification data with no other home.**

**Critical new distinction**: `PRICING UNIT ≠ SPECIFICATION DATA`. The reviewed item is priced strictly per-unit — dimensions have zero effect on the commercial calculation — yet the customer still needs to see dimensions, location, and type. Dimensions must never automatically imply "price by area."

**Three proposed item behavior classes**: Simple (`quantity × unit price`, must stay effortless), Dimensional (quantity derived from dimensions, e.g. `width × height → m² → price`), Professional/Calculated (profession-dependent formulas — linear meter, kg, hour, etc.; advanced calculation not required in a first version, but the architecture must not block it later).

**Business Profile + Industry Template**: profession selection suggests relevant units/fields/behavior without permanently locking the business to them — avoids showing irrelevant units (an electrician shouldn't normally see "ton"). An exploratory, non-final industry/unit matrix was recorded across 15 industry categories.

**Other recorded concepts**: repeating measurement/sub-item rows as a concrete UI idea (design only, not approved); Catalog integration (catalog items defining pricing-unit/specification defaults); manual vs. calculated quantity as an explicit future distinction; a future AI opportunity (parsing pasted/dictated dimension text into structured items) explicitly preserved, not implemented; customer-facing presentation principles; full HE/EN and Local/International market-separation compliance (per the existing permanent rule); backward compatibility with existing simple quote items and David Aluminum's real historical data; an explicit anti-overengineering commitment (`"Service — 2 × ₪500"` must remain trivially easy).

**Priority decision, the most operationally important fact recorded**: after the current Recovery program is safely stabilized/closed, this becomes the Owner's designated **first major product-design/workstream — explicitly ahead of Admin UI redesign/further Admin interface work.** Order: (1) finish/stabilize Recovery; (2) confirm Recovery closure/stable baseline; (3) begin detailed, Owner-approved design for this item (design-first, no coding before approval); (4) only then return to lower-priority Admin UI work.

**Status: PRODUCT REQUIREMENT / DESIGN BACKLOG, HIGH PRIORITY, OWNER-APPROVED FOR DOCUMENTATION, NOT APPROVED FOR IMPLEMENTATION, NOT STARTED.**

---

## WHERE THIS WAS RECORDED (mapped onto existing architecture, not duplicated from scratch)

This initiative extends a substantial pre-existing backlog item — `PROFLOW_TODO.md` item 30 ("Structured Quote Items / Industry / Measurement / Pricing Engine") already had sub-items 30.A (AI Chat awareness), 30.B (mixed pricing / "industry is not pricing model"), 30.C (Project→Section→Items hierarchy), and 30.D (Admin V2 compatibility), plus an architectural home at `PROFLOW_ARCHITECTURE.md` §14.C and a reconciliation record at `PROFLOW_PROJECT_CONTEXT.md` §95. This task **extends** that existing foundation with the new real-world evidence, the new `PRICING UNIT ≠ SPECIFICATION DATA` distinction, the three item classes, the Business Profile/Industry Template concept, the exploratory unit matrix, and — critically — the new sequencing-priority decision. **No existing architecture, principle, or prior decision was altered or contradicted** — the override hierarchy, mixed-pricing capability, snapshot-immutability discipline, extensibility constraint, and market-separation rules already recorded all remain accurate and unchanged; this work adds concrete grounding and a new priority, nothing more.

---

## SIX-FILE CONTINUITY LEDGER

**PROFLOW_PROJECT_CONTEXT.md**
STATUS: **UPDATED**
REASON: §95 extended with an addendum recording the real David Aluminum evidence, the new `PRICING UNIT ≠ SPECIFICATION DATA` distinction, and the new sequencing-priority decision, cross-referencing `PROFLOW_TODO.md` item 30.E as the detailed record.

**PROFLOW_CHAT_HANDOFF.md**
STATUS: **UPDATED**
REASON: New §14.Z added (a forward-looking priority note, distinct from and not replacing §14's current Wave 3 resume pointer) so the next session sees this priority decision clearly without it being lost among Recovery-specific resume detail.

**PROFLOW_ARCHITECTURE.md**
STATUS: **UPDATED**
REASON: §14.C's header and status extended with the new sequencing-priority declaration and a pointer to 30.E's real-world grounding; the section's own existing architecture (override hierarchy, snapshot integrity, market separation, extensibility, Admin compatibility) is unchanged.

**PROFLOW_HANDOFF.md**
STATUS: **UPDATED**
REASON: New §18.FM appended as a concise engineering-history cross-reference, consistent with this file's established pattern for major decisions; the substantive record lives in the three files above.

**PROFLOW_TODO.md**
STATUS: **UPDATED**
REASON: Item 30's header/status extended with the new sequencing-priority declaration; new sub-item 30.E added with the complete new detail (real evidence, critical distinction, item classes, industry/unit matrix, repeating-rows concept, Catalog integration, manual-vs-calculated quantity, AI opportunity, design-first checklist, backward compatibility, anti-overengineering commitment) — this is the primary, most detailed home for this initiative, consistent with item 30's existing role as "the one authoritative, detailed definition."

**PROFLOW_CLAUDE_LATEST_REPORT.md**
STATUS: **UPDATED**
REASON: This file, fully rewritten to carry this task's outcome.

No file was silently skipped. No seventh canonical file was created.

---

## STRICT BOUNDARY CONFIRMED HELD

No application source changes. No DB changes. No TEST mutation. No Production mutation. No Edge Function deployment. No Vercel deployment. No `main` push. No LIVE action. This task did not touch, reference, or alter anything related to Wave 3's own state (Function 1/Function 2 deployment status, unaffected).

---

## CONTINUITY COMMIT

`3b9415a0e264d1fd1b6b8e541cdfc83defcde683` on `proflow-continuity` (pushed to `origin/proflow-continuity`) — the substantive product-initiative documentation update (all six files). Matching commit exists locally on `main` (`9b84f8d`), **not pushed**, per the documentation-only boundary.

## PROFLOW-CONTINUITY PUSH: **PASS**

## REMOTE GITHUB READ-BACK: **PASS**

`git fetch` + `git rev-parse origin/proflow-continuity` confirmed `3b9415a0e264d1fd1b6b8e541cdfc83defcde683` exactly. **Note**: the GitHub REST Contents API hit its unauthenticated rate limit (60/hour, exhausted by this session's cumulative verification calls) partway through — `PROFLOW_TODO.md` and `PROFLOW_CLAUDE_LATEST_REPORT.md` returned HTTP 403. Rather than wait ~21 minutes for reset, both were independently verified via a genuine git-protocol read (`git show origin/proflow-continuity:<path>`, reading GitHub's actual stored objects directly, not local disk state or push output) — confirmed present and correct. The four files fetched successfully via REST before the limit hit (`PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_ARCHITECTURE.md`, `PROFLOW_HANDOFF.md`) were decoded and content-verified; `PROFLOW_HANDOFF.md`'s decode showed a false negative purely because it exceeds the Contents API's 1MB inline-content limit (`encoding: "none"`), immediately cross-verified true via the same git-object method. **All six files independently confirmed present and correct at the real remote ref**, using REST where available and a direct git-protocol read where REST was rate-limited — no file was accepted on local write or push output alone.

---

## NEXT SAFE STEP

Continue and complete the current Recovery program. Once Recovery is stabilized/closed and the Owner confirms, begin the Owner-approved design phase for this initiative (design-first, per the checklist at item 30.E) — ahead of Admin UI work, per the recorded priority.

---

## FINAL STOP

FINAL STOP. DOCUMENTATION ONLY — NOT STARTED. WAIT FOR OWNER + CHATGPT REVIEW.
