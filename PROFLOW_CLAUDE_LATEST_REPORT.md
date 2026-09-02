# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Professional Quotes — Final Owner Product Decisions + Technical Implementation Blueprint

**MODE: Product-decision recording + READ-ONLY technical/schema audit + implementation blueprint design. NOT authorized: DB/schema mutation, migration execution, application implementation, TEST/Production/customer-data mutation, commit/push/deploy/LIVE action.**

---

## 1. Fresh Local State

Local `main` HEAD `91aaf29` (unchanged from end of §154). `origin/main` unchanged at `26dee96`. Working tree: only the standing untracked `src/entry-server.jsx`. `origin/proflow-continuity`=`2bfa84e`, confirmed via fresh fetch.

## 2. Canonical state before reconciliation

§154's blocker stood: item 30 explicitly `🔴 OPEN/NOT DESIGNED`; §147.3 recorded plan-access as UNKNOWN; a real structural conflict existed between the (blocked) prior task's assumed "per quote/business" item-mode shape and the existing design record's own "per item" recommendation.

## 3. Exact Owner decisions now recorded as FINAL

Recorded verbatim at `PROFLOW_PROJECT_CONTEXT.md` §155.1 (11 numbered decisions): additive architecture (Option 1); per-item mixed modes (resolves §154's conflict in favor of the existing recommendation); simplicity-first/progressive-disclosure permanent principle; initial units (unit/m²/linear meter/kg/hour/day, data-driven not schema-enum); Public Quote detail collapsed-by-default; PDF/Print FULL/COMPACT preserved, unimplemented; Catalog Templates deferred, "duplicate professional item" V1 reuse; plan access (FREE=no, FREE-TRIAL/BASIC/PRO/LIFETIME=yes to Core); BASIC differentiation (Core, not PRO-only); first PRO differentiator (`professionalQuoteReuse`, Advanced); permanent Visible-but-Locked UX pattern.

## 4. Item 30 status after reconciliation

Updated from `🔴 OPEN / NOT DESIGNED / NOT STARTED` to `🟢 PRODUCT DECISIONS LOCKED, TECHNICAL BLUEPRINT COMPLETE — IMPLEMENTATION NOT YET AUTHORIZED`. All five of the item's own "DECISIONS REFINED FOR FINAL OWNER APPROVAL" are now marked approved, superseding their "awaiting final approval" language.

## 5. Recommended V1 user experience, plain language

`PROFLOW_PROJECT_CONTEXT.md` §155.3 — Simple items work exactly as today; any item can optionally gain professional detail via an unobtrusive "+ Add measurements" expansion; the commercial price line works identically regardless of quantity source; Public Quote shows a clean line with an optional "Show details" reveal; BASIC gets all of this today; PRO additionally gets one-click professional-item reuse.

## 6. Recommended Business Settings behavior

§155.4 — a single, optional, always-overridable default ("new items default to Simple / ask me each time") plus a read-only Professional-Quotes-availability line. Never a restriction. Genuinely optional for V1 (Stage G, may be dropped entirely).

## 7. Recommended New Quote behavior

§155.5 — the standalone "structure selector" step is recommended **retired**. New Quote keeps Private/Business, then goes straight to the item editor; per-item progressive disclosure is the only "structure" decision that needs to exist, and it falls out naturally from which items carry professional data.

## 8. Mixed-item UX

§155.6 — Add Item → Simple by default → optional per-item "+ Add measurements/professional details" → unit picker → optional dimensions (auto-computed, hand-editable) → optional specification text → small visual indicator once collapsed back.

## 9. Initial unit model

§155.7 — `unit`/`m²`/`linear meter`/`kg`/`hour`/`day`, HE/EN label pairs, a plain data array (mirroring `PLAN_CATALOG`'s own pattern) — deliberately not a Postgres enum, so a future unit never requires a schema migration.

## 10. Calculation-semantics assessment

§155.8 — full 8-item table against the existing item-30 proposal. **All 8: APPROVE-AS-DESIGNED.** One concrete technical clarification (not a rule change): `quote_items.quantity` is confirmed `integer NOT NULL`; the proposed decimal `calculated_quantity` gets its own new `numeric` column rather than retyping the existing, populated, immutability-guarded column. A second clarification: the new measurement table needs its own denormalized `quote_id` so the existing `guard_quote_child_immutability()` trigger reuses with zero rewrite. Zero "OWNER DECISION STILL REQUIRED" items.

## 11. Exact proposed schema

§155.9 — full column-by-column tables for `quote_items` (4 new nullable columns), the new `quote_item_measurements` table (9 columns, denormalized `quote_id`, cascading FKs), and one optional `business_settings.default_item_mode` column. Every field's type/nullability/default/FK/constraint/RLS/immutability/migration/HE-EN/TEST/Production-risk implication is documented. **No migration file created or executed.**

## 12. Existing/historical quote safety analysis

§155.10 — every new column/table is nullable/additive, zero backfill, zero existing-row behavior change. No reinterpretation of historical quantities. `default_item_mode` only affects the Add-Item panel's default for *new* items.

## 13. RLS/immutability analysis

§155.11 — `quote_items`/`quote_item_measurements` both carry zero `anon` grant (confirmed fresh); public reads go through the `get-public-quote` Edge Function (service-role, confirmed via source read), which will need its own nested-select/DTO update in a later stage — a well-understood, additive touch point, not a design gap. Immutability: exact existing trigger reused verbatim.

## 14. Entitlement matrix

§155.12 — `professionalQuotes` (Core): FREE=NO, FREE-TRIAL=YES(temp), BASIC=YES, PRO=YES, LIFETIME=YES. `professionalQuoteReuse` (Advanced): FREE=NO, FREE-TRIAL=YES(temp), BASIC=NO, PRO=YES, LIFETIME=YES. Both implemented via the already-completed, zero-new-code `getEntitlementSet()` mechanism (§150/§151) — FREE(TRIAL)/LIFETIME inherit automatically by construction.

## 15. BASIC experience

§155.13 — full Core (create, measure, calculate, save/send), zero upgrade friction; reuse affordance Visible-but-Locked.

## 16. PRO experience

Everything BASIC has, plus one-click professional-item reuse, fully unlocked.

## 17. FREE experience

No Professional Quotes access; exact locked/absent presentation left to implementation time, not decided this task.

## 18. FREE(TRIAL) experience

Full Core + Advanced, temporary, automatic via the existing trial mechanism — identity stays `FREE_TRIAL`, never a false PRO claim.

## 19. LIFETIME experience

Identical to PRO, identity stays `LIFETIME`, non-expiring, zero special-case code — same automatic-inheritance mechanism proven twice already this session.

## 20. Visible-but-Locked UX

§155.14 — documented component-level pattern: always-discoverable locked affordance with a plan-badge chip; click-triggered (never page-load) benefit-first explanation panel; "Upgrade" / "Not now" actions; HE/EN natural copy, not literal translation.

## 21. Professional reuse V1 recommendation

"Duplicate professional item" — reuses the exact existing quote-duplication code path (`handleDuplicateQuote`, confirmed via fresh source read to be a client-side state-repopulation + fresh INSERT, not a DB-level copy) — no new Catalog schema needed for V1.

## 22. Future Templates compatibility

§155.1.7/§155.9 — the `specification jsonb` bag and unit-as-data design are explicitly chosen to allow a future Catalog Template layer to be added without a schema rewrite.

## 23. Public Quote behavior

§155.15 — professional detail collapsed by default under each item that carries it, matching the already-proven 30.F Concept B UX language. Recommend one shared, presentation-agnostic professional-detail data shape for future reuse across surfaces.

## 24. PDF/Print future compatibility

§155.15/§155.1.6 — preserved as a stated future requirement (FULL/COMPACT), not implemented; this blueprint's own data shape is designed not to make that requirement harder.

## 25. HE/EN design

Designed together throughout — units, specification labels, Visible-but-Locked copy, all explicitly requiring HE/EN pairs from day one, no market-specific schema.

## 26. Desktop/Mobile design

§155.6/§19 of the authorization — progressive disclosure keeps the mobile experience identical in spirit to the already-refined mobile concept (30.E); no separate mobile-only design needed, the same per-item expansion pattern works at both widths.

## 27. TEST↔Production structural-parity implications

§155.16 — zero environment-conditional design anywhere in this blueprint; consistent with the permanent Iron Rule (§150.16).

## 28. David Aluminum status

§155.17 — zero mutation, zero special-case code proposed. His real quote #46 used only as already-documented, already-approved read-only product evidence, per this task's own explicit §21 permission.

## 29. A100700 status

Remains deferred, untouched, unscheduled.

## 30. Item 51 status

Remains open, untouched, not conflated with this schema — `professionalQuotes`/`professionalQuoteReuse` key off the exact same, already-documented, still-open PRO-subscription-expiry dependency (§150.8) every other PRO capability already has, not a new dependency.

## 31. SINOQ status

Preserved as a candidate parent/business-brand name only, no branding applied.

## 32. Exact phased implementation blueprint

§155.18 — full table, 8 stages (B/A/C/D/E/F/G, H retired), each with dependencies/DB requirement/HE-EN/Desktop-Mobile/TEST verification/authorization-gate columns. Stage B (entitlement flags, zero DB) recommended as the safest first authorization.

## 33. DB/schema authorization required for next stage

Stage A (the additive migration) requires its own separate DB-change authorization per the project's standing §36 gate — not granted by this task.

## 34. Exact application authorization required for next stage

Any of Stages B-G individually requires its own separate application-implementation authorization — not granted by this task. Stage B specifically requires no DB authorization at all and could be authorized independently.

## 35. Continuity files updated

`PROFLOW_PROJECT_CONTEXT.md` (new §155, 20 subsections), `PROFLOW_TODO.md` (item 30's five decisions marked locked, status header updated, "still awaiting" line superseded), `PROFLOW_HANDOFF.md` (new §18.HA), `PROFLOW_CHAT_HANDOFF.md` (§14 new lead paragraph), `PROFLOW_ARCHITECTURE.md` (§14.C status updated + blueprint summary), this file.

## 36. Continuity commit SHA/read-back

Recorded below, post-push.

## 37. Application files modified

**NONE.**

## 38. DB/schema mutation

**NONE.** No migration file created or executed.

## 39. TEST/Production/customer-data mutation

**NONE.**

## 40. Commit/push/deploy/LIVE status

No application commit (none exists). No push of application code. No deploy. No LIVE action.

## 41. Exact recommended next Owner authorization

Either: (a) authorize Stage B alone (entitlement flags, zero DB, zero UI) as a genuinely independent, lowest-risk first step; or (b) authorize the Stage A additive migration (TEST-applied) so Stages C-F can follow in sequence; or (c) request further design detail on any specific blueprint item before authorizing implementation. This task does not recommend one over the others beyond noting Stage B's uniquely low risk.

---

## Continuity commit SHA + remote read-back

`cb77fad` on `proflow-continuity` (pushed; content commit). Matching content commit exists locally on `main` (`19455c0`) — not pushed to `origin/main` (documentation only). `origin/main` unchanged at `26dee96`. No application code exists to commit or push this task.

---

PROFESSIONAL QUOTES PRODUCT DECISIONS: LOCKED

PROFESSIONAL QUOTES TECHNICAL BLUEPRINT: PASS

DB/SCHEMA MUTATION: NOT AUTHORIZED
APPLICATION IMPLEMENTATION: NOT AUTHORIZED
APPLICATION PUSH: NOT AUTHORIZED
PRODUCTION DEPLOY: NOT AUTHORIZED
LIVE ACTION: NOT AUTHORIZED
WAITING FOR OWNER + CHATGPT REVIEW
