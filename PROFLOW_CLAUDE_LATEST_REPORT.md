# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Phase B — Item 30.E Audit + Product-Design (READ-ONLY, no implementation)

**AUDIT + DESIGN ONLY. Zero application code, schema, migration, DB, TEST, Production, Edge Function, or Vercel mutation. No implementation. No `main` push.**

---

## PROFLOW RECOVERY: **CLOSED** (Phase A, prior task this session)
## ITEM 30.E IMPLEMENTATION: **NOT AUTHORIZED**

---

## CURRENT-ARCHITECTURE AUDIT

Traced from real schema (`supabase/migrations/20260830000000_capture_base_schema_tables.sql`, the authoritative captured-from-Production schema) and real code (`QuoteForm.jsx`, `Dashboard.jsx`, `ServicesCatalog.jsx`):

- **`quotes`** (parent): no item data — `quote_number`, `attn_*`, `warranty`, `tax_rate`/`currency` snapshot, etc.
- **`quote_items`** (real FK child table): exactly `id, quote_id, description, quantity, unit_price, total_price` — the **entire** current item model. Zero specification/measurement columns exist anywhere today.
- **`services`** (Catalog): exactly `id, name, price, user_id` — flat, no units/categories/spec fields.
- **Reusable asset found**: `guard_quote_child_immutability()` already locks `quote_items` on approved/paid/signed quotes — directly reusable by any new 30.E child table.
- **Market isolation**: `tax_rate`/`currency` are per-quote snapshots derived at creation, never from viewer session — must be preserved.

## FILE-BY-FILE LEDGER

| File | Role | 30.E touches? |
|---|---|---|
| `src/components/QuoteForm.jsx` | Item-entry UI | **Yes — core** |
| `src/pages/Dashboard.jsx` (item state + `handleSaveQuote`) | Item state + persistence | **Yes — core** |
| `src/components/ServicesCatalog.jsx` | Catalog CRUD | Only if Option 3 (templates) pursued |
| `src/pages/PublicQuote.jsx` / `PublicQuoteEn.jsx` | Customer-facing item rendering | Optional, additive |
| `supabase/functions/get-public-quote/index.ts` | Public Quote data API | Only if new columns reach the public page |
| `supabase/migrations/20260830000000...` / `...000001...` | Authoritative schema / immutability functions | Reference + reuse, not modified |

## THREE ARCHITECTURE OPTIONS

1. **Generic Specification Bag** (additive JSONB `specification` + `quote_item_measurements` table) — smallest diff, fully additive, weak native SQL reportability. **Recommended first.**
2. **Structured Relational Model** (typed measurement columns + EAV specification table) — stronger reportability for measurements, ~2x migration surface, still needs a JSONB escape hatch for the long tail.
3. **Catalog-Template-Driven Model** (Catalog carries a declared field/pricing schema a quote item copies from) — best long-term mobile UX and AI-readiness, needs template UI before any professional item unless an ad hoc path ships alongside it.

**Recommendation**: Option 1 first, explicitly sequenced so Option 3 is a pure future addition, never a rewrite — matches 30.E's own anti-overengineering principle, uses only additive migrations.

## HE / EN / RECONCILIATION

One shared data model confirmed sufficient for both markets — Hebrew (מ״ר/מטר רץ/ק״ג/שעה) and English (m²/linear meter/kg/hour) unit vocabulary both read naturally with zero separate architecture. Currency/VAT untouched, remain the existing per-quote snapshot.

## BACKWARD COMPATIBILITY / DAVID ALUMINUM / SIMPLE BUSINESS

All proposed columns/tables additive and nullable — zero backfill, zero behavior change for existing quotes. David Aluminum's historical quotes stay byte-identical; a future measured item could preserve their real per-unit pricing while giving dimensions a structured home — no experiment performed on their real account. Simple businesses see zero change.

## MOBILE UX / AI-READINESS

Mobile concept: single-column stacked fields, one-tap add-measurement, visual `calc`-vs-`manual` badge. Simple path entirely unaffected on mobile. Proposed JSONB shape is directly AI-parse-consumable later, without any schema change — not implemented now, just not blocked.

## VISUAL CONCEPT MOCKUPS

Six static HTML/CSS concepts built in the session scratchpad (`quote_engine_concepts.html`), styled with ProFlow's real design tokens (Rubik typeface, `#7c3aed` violet, `#e9d5ff` border) — **not built by modifying the real application**. An initial `claude.ai` artifact publish returned "Page not found" for the Owner; per explicit instruction, no second artifact link was created — the same local file was opened directly in Chrome for in-person review instead. **The scratchpad HTML file is the sole authoritative copy** — no hosted URL should be assumed live for this content.

## OWNER DECISIONS REQUIRED

1. Which architecture option to approve — *Rec: Option 1 first, Option 3 later.*
2. Simple/Measured per item, or per quote/business — *Rec: per item.*
3. Day-one unit list — *Rec: unit, m², linear m, kg, hour.*
4. Show specification detail on Public Quote page — *Rec: yes, collapsed by default.*
5. Build Catalog templates now or defer — *Rec: defer.*

## RECOMMENDED (NOT AUTHORIZED) IMPLEMENTATION SEQUENCE

Owner approves architecture + 5 decisions → finalize schema design → additive TEST migration → `QuoteForm.jsx`/`Dashboard.jsx` UI + persistence (desktop then mobile) → optional Public Quote display → HE+EN/Desktop+Mobile TEST verification → separate Owner authorization for Production migration + deploy, same Preflight→backup→apply→verify gates as Recovery.

## MUTATION BOUNDARY

Zero application/DB/TEST/Production/Edge Function/Vercel mutation. No implementation performed or authorized.

---

## CONTINUITY COMMIT

`507d8a266a3d3dfb50695c8522a3af8bf80e29e6` on `proflow-continuity` (pushed to `origin/proflow-continuity`). Matching commit exists locally on `main` (`80b28e3`), **not pushed**.

## PROFLOW-CONTINUITY PUSH: **PASS**

## REMOTE GITHUB READ-BACK: **PASS**

`git fetch` + `git rev-parse origin/proflow-continuity` confirmed `507d8a266a3d3dfb50695c8522a3af8bf80e29e6` exactly, followed by `git show origin/proflow-continuity:<path>` reads confirming `PROFLOW_PROJECT_CONTEXT.md` §121 and `PROFLOW_TODO.md`'s 30.E audit addendum both present and correct. `origin/main` re-fetched, confirmed unaffected (`83e677a488a6a17b9a195c5a360726307398f445`).

---

## SIX-FILE CONTINUITY LEDGER (Phase B)

- `PROFLOW_PROJECT_CONTEXT.md` — **UPDATED** (§121)
- `PROFLOW_TODO.md` — **UPDATED** (item 30.E — full audit/design findings)
- `PROFLOW_HANDOFF.md` — **UPDATED** (new §18.FV)
- `PROFLOW_CHAT_HANDOFF.md` — **UPDATED** (§14, new lead paragraph)
- `PROFLOW_ARCHITECTURE.md` — **REVIEWED — NO CHANGE REQUIRED** (no architecture implemented)
- `PROFLOW_CLAUDE_LATEST_REPORT.md` — **UPDATED** (this file)

**Mutation boundary**: audit/design only. Zero application/DB/TEST/Production/Edge/Vercel mutation. No implementation. No `main` push.
