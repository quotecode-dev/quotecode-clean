# ProFlow ChatGPT Handoff

This file is a dedicated continuity snapshot so a **new** ChatGPT conversation
can resume this project safely even if the current conversation reaches its
limit. It complements, but does **not** replace, the four canonical project
documents:

- `PROFLOW_ARCHITECTURE.md`
- `PROFLOW_HANDOFF.md`
- `PROFLOW_PROJECT_CONTEXT.md`
- `PROFLOW_TODO.md`

Its job is narrow: teach a new ChatGPT conversation how Owner + ChatGPT +
Claude work together, the permanent safety rules, the product invariants, the
current accepted visual/product state, the current known blockers, what must
never be assumed, and the exact current resume point — without duplicating
the huge technical histories already stored in `PROFLOW_HANDOFF.md`.

## 1. Roles and decision authority

**Owner**: final authority for product, visual acceptance, LIVE, migrations,
commits/pushes when explicitly scoped, and material changes.

**ChatGPT**: Owner's review/decision partner. Analyzes Claude's findings and
reports; challenges assumptions; tracks cross-surface/product implications;
prepares implementation instructions only after Owner approval when changes
are involved.

**Claude**: coding/audit/QA agent. Must not independently expand scope or make
unauthorized production changes.

**Default workflow**:

```
AUDIT
  → Owner + ChatGPT review
  → explicit GO
  → implementation
  → measured verification
  → Owner physical/visual acceptance where applicable
```

## 2. Owner Working Style

- Owner is highly visual and frequently detects inconsistencies before code
  inspection explains them.
- A screenshot/video/physical observation from Owner is meaningful evidence.
- "Implemented" is not "Owner Accepted."
- "Code verified" is not a substitute for visual/live verification when such
  verification is available.
- If Owner says something looks wrong, investigate the root cause rather than
  arguing that the CSS/code is technically correct.
- Prefer root-cause/global architecture fixes over local patches.
- When fixing a representation or behavior, inspect every relevant surface.
- Desktop/Mobile and HE/EN must not silently diverge.
- Do not make Owner repeatedly restate decisions already made.
- Capture new requirements during the task and reconcile documentation.
- Keep tasks focused; do not unnecessarily reopen accepted work.
- Be conservative around LIVE, DB, auth, migrations, deployment and customer
  data.
- ChatGPT should disagree with Owner/Claude when evidence indicates a proposal
  is unsafe or technically wrong.
- Owner prefers concise progress toward a decision, but expects deep technical
  checking underneath it.

## 3. Permanent safety rules

- Preserve pre-existing uncommitted work.
- Never reset/restore/stash/clean/discard without explicit authorization.
- No production DB/migration/deploy change without explicit Owner approval.
- No application commit/push unless explicitly authorized for that scope.
- David Aluminum must remain protected from regression/disruption.
- Before material changes, reconcile the four canonical project documents,
  especially TODO.
- Surface Consistency Rule is permanent.
- Mid-task requirement capture is permanent.
- Browser resource discipline is permanent.

## 4. Market invariants

**LOCAL / HEBREW**:
- RTL presentation.
- Local currency rules.
- VAT belongs only to the Local product logic where specified.

**INTERNATIONAL / ENGLISH**:
- LTR presentation.
- International currency/account rules.
- ABSOLUTELY NO VAT reference.
- NO ₪ leakage.
- Language, locale, market and currency are separate concepts and must remain
  correctly separated.

## 5. Money display invariant

- Money is numeric LTR content in every language.
- Use tabular numerals/bidi isolation.
- `tabular-nums` alone is insufficient for multi-row alignment.
- Shared monetary rows must physically right-anchor the numeric values.
- Units under units, tens under tens, hundreds under hundreds, decimals aligned.
- Shared amount-column architecture is required where applicable.
- Do not introduce formatter rounding accidentally.
- Local final-total rounding is a deliberate business exception.

**CURRENT OWNER STATUS**: the latest Hebrew money alignment was physically
reviewed by Owner and described as visually excellent.

## 6. Desktop visual grid

Canonical visual content width: **980px**.

- Authenticated application visual content = 980px.
- Public Quote visual content = 980px.
- Public Quote white document shell is intentionally wider/decorative and
  currently derives its size from: content width + document padding + border.
- Do not reinterpret 980px as Public Quote outer-shell width.

Owner + ChatGPT have accepted this architecture.

Scrollbar center-axis stabilization was implemented using:

```css
html { scrollbar-gutter: stable; }
```

Latest measured result: Dashboard and Public Quote centerX now match exactly
at 1366 / 1440 / 1920.

## 7. Public Quote accepted HE visual state

Preserve unless Owner explicitly reopens:

- Desktop totals card on LEFT.
- Quote-info box in approved position.
- Call CTA BELOW quote-info box and horizontally centered with it.
- 980px visual content architecture.
- Decorative wider white document shell.
- Global money alignment.
- Mobile near-full-width behavior.
- Hebrew recipient hierarchy/address behavior already accepted.

## 8. Quote Number architecture and CRITICAL current discovery

Intended architecture:
- Technical identifier remains UUID.
- Business/display identifier is `quote_number`.
- Displayed as `A<number>`.
- Per-business sequence.
- Uniqueness per business.
- Assigned number immutable.
- Deletion never reuses a number.
- Duplicate gets a fresh number.

**Status as of 2026-08-28 (updated, supersedes every earlier version of this
section)**: what started as a surprise ("A90" appearing in Dashboard for a
disposable TEST quote, with the local migration package still unapplied) has
since gone through a full read-only LIVE audit, a local redesign, and a real
runtime validation in an isolated disposable Supabase project. Sequence of
events:

1. A newly-created LIVE TEST quote unexpectedly displayed **A90** in
   Dashboard, proving a real `quote_number` mechanism already existed in
   LIVE, independent of this repo's own (then-unapplied) migration package.
2. A dedicated **read-only** audit proved the mechanism: `quotes.quote_number`
   already exists live as `integer NOT NULL DEFAULT nextval(quotes_quote_number_seq)`
   - one **global** sequence shared by every business, not per-business, not
   this repo's design.
3. The local migration package was **redesigned** against those confirmed
   facts (still local only, nothing applied live).
4. That redesigned package was then **runtime-validated** against a
   disposable Supabase project (`quotecode-test`, see §10.A) using fictional
   data. Two genuine defects were found and fixed through this testing (not
   caught by static review alone): (a) a per-business counter-seeding
   off-by-one that would have made every business with historical quotes
   skip A100700 and start at A100701; (b) `anon` unexpectedly retaining
   `EXECUTE` on the allocator RPC due to a Supabase platform default that a
   plain `REVOKE ... FROM PUBLIC` doesn't reach. Both fixed and re-verified.

**Current state**: the transition package is **runtime-validated in
isolation** - a meaningfully stronger status than "designed" or
"static-reviewed." **Nothing has been applied to LIVE.** The known,
still-open cross-surface split remains: the currently-deployed
`get-public-quote`/`send-quote-email` Edge Functions still don't return
`quote_number` (their local source does; neither has been redeployed).

**DO NOT**:
- apply the migration package to Production without a separate, explicit
  Owner authorization for that exact action;
- assume the disposable-environment validation alone is sufficient
  authorization for a LIVE migration;
- attempt to "fix" A90 (historical numbers are permanently preserved, never
  renumbered);
- deploy either Edge Function outside the coordinated release order
  documented in `PROFLOW_TODO.md` item 17.

## 9. Quote Number UI state

Public Quote HE now structurally displays:

```
מספר הצעה
<number>
```

for both real-number and fallback cases.

Public Quote EN structurally displays:

```
Quote Number
<number>
```

Fallback is standardized through `formatQuoteFallback()`.

The UI is ready to display real `quote_number` automatically once the
correct backend source is established.

**English**: CODE-VERIFIED / LIVE-NOT-AVAILABLE. Do not claim genuine English
live verification without an International user.

## 10. Pending migrations/features

Still open and must not be falsely closed:

- Quote Number migration/reconciliation — now requires urgent LIVE
  architecture audit because A90 already exists.
- Attn/לידי LIVE migration.
- Moving/announcement banner content/admin-source decision.
- Genuine International live visual QA when an appropriate user becomes
  available.

## 10.A Disposable TEST Supabase environment (added 2026-08-28)

A second Supabase project now exists for isolated runtime validation: `quotecode-test`
(ref `ljfizgrdyzxddswcedwr`, Central EU/Frankfurt, created 2026-08-27) - separate from
Production (`quotecode`, ref `ixabnzhjeqevtbhdfswv`). Used to runtime-validate the
Quote Number transition package with fictional data only (never real customers, never
David Aluminum). Two genuine defects were found and fixed via this testing that static
review alone had missed - see `PROFLOW_HANDOFF.md`'s Disposable Supabase Runtime
Migration Validation entry. Full permanent rule: `PROFLOW_PROJECT_CONTEXT.md` §17.D.

## 10.B Claude Lead + parallel sub-agents (added 2026-08-28)

Claude may operate as **Lead**, optionally delegating to up to **two** parallel
sub-agents for genuinely independent read/audit/analysis workstreams (e.g. a
DB/RLS audit split from an application-consumer/HE+EN audit). Sub-agents never
gain more authority than Claude Lead - every ProFlow restriction in force
(NO LIVE, NO COMMIT, TEST-only, etc.) applies to them identically. Mutating
work (DB changes, migrations, deploy, commit, push, Production config)
remains serial under Claude Lead's direct control, not parallelized. Claude
Lead alone reconciles agent findings, verifies high-risk claims, and owns
Final Report accuracy - an agent's conclusion is evidence, never automatic
truth. Full rule: `PROFLOW_PROJECT_CONTEXT.md` §17.F.

## 10.C HE/EN parallel agent split (added 2026-08-28, extends §10.B)

For a task genuinely affecting both markets, Claude may split verification into
**Agent HE** (Local/Hebrew/RTL) and **Agent EN** (International/English/LTR,
always including the no-₪/no-VAT/no-Hebrew-leakage invariants) - within the
same max-2-agent limit from §10.B. Shared core (DB/RLS/RPCs/auth/quote-number
allocation/shared utilities) stays single-source always; Claude Lead alone
decides any shared-core implementation and coordinates shared-file edits
serially. An HE-only or EN-only pass is never "task complete" for a
cross-market task - Claude Lead reconciles both into one result before
declaring completion. Full rule: `PROFLOW_PROJECT_CONTEXT.md` §17.G.

## 10.D Full HE/EN cross-market regression audit (added 2026-08-28)

First real use of the Agent HE/Agent EN split (§10.C): audited every accumulated
uncommitted application/Edge-Function file. Result: no CRITICAL/HIGH findings,
no VAT/₪/Hebrew leakage in either direction. Two real MEDIUM findings recorded
(both independently re-verified by Claude Lead, not just copied from an agent):
(1) Hebrew address formatting silently drops a State/Province field that both
markets collect; (2) `PublicQuote.jsx` duplicates the canonical money formatter
instead of importing it. Neither fixed - read-only audit, owner decision
pending. One agent-reported finding was checked and rejected as a misread. New
permanent rule: `PROFLOW_PROJECT_CONTEXT.md` §17.H (Cross-Market Parity Gate).
Full file-by-file ledger: `PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 11. Security review

Owner's son is performing an authorized defensive security review using
GPT + Kali Linux.

A sanitized pentest source package was created.

No obvious active credentials/secrets or production customer data were found
in the reviewed export.

Security report may arrive later.

Do not automatically fix findings. Each finding must be validated and
reviewed before implementation.

The security report is not automatically blocking current work unless a
Critical/High actionable issue is discovered.

## 12. LIVE strategy

Owner wants to reach LIVE as soon as safely possible.

Do not wait unnecessarily for unrelated work.

But before LIVE:
- close known blockers;
- audit the unexpected existing LIVE quote_number/A90 architecture;
- review pending migrations;
- verify build/tests;
- review accumulated source diff;
- verify production domain/auth/session implications;
- establish rollback plan;
- obtain explicit Owner GO.

Canonical intended production domain: `www.quotecodepro.com`

`quotecode.vercel.app` remains relevant to the canonical-domain/redirect and
Supabase session/origin review.

## 13. Documentation state

Canonical technical/project documents:

- `PROFLOW_ARCHITECTURE.md`
- `PROFLOW_HANDOFF.md`
- `PROFLOW_PROJECT_CONTEXT.md`
- `PROFLOW_TODO.md`

A documentation-only commit was already pushed:

`3561b0eab1a88bd2648877ca800cc1ab9323d685`

Message: `docs: update ProFlow implementation state and permanent workflow rules`

All application/source changes remain LOCAL and UNCOMMITTED after that
commit.

## 14. Current resume point

As of this snapshot:

- Hebrew money alignment: Owner visually accepted.
- 980px visual content architecture: Owner + ChatGPT accepted.
- Scrollbar center-axis issue: implemented and measured resolved.
- Mobile Quote Number label/surface consistency: implemented locally.
- English live visual QA: unavailable.
- Quote Number: LIVE architecture audited (read-only), local package redesigned, then **runtime-validated in an isolated disposable Supabase project** (`quotecode-test`) - two real defects found and fixed through that testing (§8, §10.A). Still nothing applied to Production.
- Application code: still uncommitted/unpushed.
- No application deployment.
- No DB migration.
- No LIVE release.

**NEXT PRIORITY**: Owner decision on whether to authorize applying the
now runtime-validated Quote Number transition package to Production (per
the coordinated Release Order in `PROFLOW_TODO.md` item 17 - backup first,
DB migration, then frontend fail-closed change, then both Edge Function
redeployments, in that order, with HE+EN verification at each stage).

After that, continue toward the Pre-LIVE Gate.

## 15.A Claude Latest Report Workflow (added 2026-08-28)

`PROFLOW_CLAUDE_LATEST_REPORT.md` (repository root) holds only the newest
completed Claude task's Final Report, so ChatGPT can read it straight from
GitHub instead of the Owner copy/pasting it. When the Owner says "קלודי סיים
- תקרא את הדוח האחרון" (or an unambiguous equivalent), retrieve and review
that file.

**Golden rule — LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** Same limitation
as this file itself (§0 above): a report is a snapshot of the task that
produced it, never proof of current filesystem/git/runtime state. Reconcile
it against `PROFLOW_HANDOFF.md`/`PROFLOW_TODO.md`/`PROFLOW_PROJECT_CONTEXT.md`
/`PROFLOW_ARCHITECTURE.md` and, when current state matters, fresh Claude/
local working-tree evidence — never treat the report alone as sufficient.
Full detail: `PROFLOW_PROJECT_CONTEXT.md` §17.C.

## 15. New-chat startup instruction

When a new ChatGPT conversation begins, the recommended Owner message is:

> "ProFlow — continue from the latest state. Read `PROFLOW_CHAT_HANDOFF.md`
> and reconcile it with `PROFLOW_HANDOFF.md`, `PROFLOW_PROJECT_CONTEXT.md`,
> `PROFLOW_TODO.md` and `PROFLOW_ARCHITECTURE.md`. Do not propose
> implementation changes until you understand the current state and open
> blockers."

Separately, "קלודי סיים - תקרא את הדוח האחרון" is a distinct, narrower
trigger for retrieving Claude's newest task report specifically — see §15.A.
