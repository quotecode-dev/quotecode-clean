# ProFlow ChatGPT Handoff

This file is a dedicated continuity snapshot so a **new** ChatGPT conversation
can resume this project safely even if the current conversation reaches its
limit. It complements, but does **not** replace, the six canonical project
documents (see `PROFLOW_PROJECT_CONTEXT.md` §0.A/§0.B for the current,
authoritative statement — earlier wording here saying "four" is superseded,
not a live inconsistency):

- `PROFLOW_ARCHITECTURE.md`
- `PROFLOW_CHAT_HANDOFF.md` (this file)
- `PROFLOW_CLAUDE_LATEST_REPORT.md`
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
- Before material changes, reconcile all six canonical project documents
  (see `PROFLOW_PROJECT_CONTEXT.md` §0.A/§0.B), especially TODO.
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
- **Full Runtime TEST Environment Build (added 2026-08-30, see §10.J below)**
  — a separate, later workstream from the Quote Number/HE-EN release
  candidate above. Four base-schema capture migrations exist locally,
  retimestamped and dry-run-verified against `quotecode-test`, but **not yet
  applied anywhere**. Do not conflate this with the Quote Number migration
  package described in §8 above — they are different files, different
  target environments at this stage, and different authorization states.

## 10.J Full Runtime TEST Environment Build — Phase 1/Phase 2/Retimestamp (added 2026-08-30)

A separate workstream from the Quote Number/HE-EN release candidate (§8):
building a second Supabase project, `quotecode-test`
(`ljfizgrdyzxddswcedwr`), into a genuinely functional runtime TEST
environment — starting from the discovery that almost ProFlow's entire base
schema exists only on Production, never captured in any tracked migration.

**Sequence** (full detail: `PROFLOW_HANDOFF.md` §18.CC–§18.CQ):
1. Production DB backup/restore verification retry — PASS (Docker installed).
2. Release Order Step 3 (Attn migration) pre-flight audit + TEST rehearsal —
   GO WITH CONDITIONS / PASS WITH CONDITIONS. Step 3 itself still NOT
   executed against Production.
3. A full 10-phase Build Plan produced (plan only).
4. **Phase 1 executed**: four new local-only migration files authored,
   capturing Production's entire previously-untracked base schema (tables,
   functions/triggers, RLS/grants, storage), Docker-validated.
5. **Deep Review** found 3 real bugs in the draft package (identity-column
   generation mode, missing `business_settings` column-level grants, a
   missing `AS RESTRICTIVE` keyword that would have silently defeated the
   signup guard) — also resolved an earlier misdiagnosed "anomaly" and
   corrected an earlier "RLS bypassable" misread.
6. **All 3 fixes applied and re-validated** (two Docker apply passes plus a
   7-test targeted permission/RLS proof, both Agent HE and Agent EN PASS) —
   **MIGRATION PACKAGE: PASS, READY FOR PHASE 2 REVIEW.**
7. **Phase 2 (apply to `quotecode-test`) attempted and BLOCKED**: the CLI's
   own migration-history-order check (`LegacyDbPushMissingRemoteError`)
   required `--include-all` to proceed, since the four capture files are
   timestamped earlier than the already-applied Quote-Number/Attn chain on
   `quotecode-test`. Per the task's own "do not improvise" rule, this
   stopped cleanly — **zero mutation occurred.**
8. A read-only audit recommended **retimestamping** the four files (rather
   than using `--include-all`) as the safest resolution, plus several
   documentation-only TODO corrections (see §10.K below).
9. **The retimestamp was executed**: `20260826000000-3` → `20260830000000-3`
   (content byte-identical, SHA-256-verified, headers strengthened into an
   explicit "TEST/BOOTSTRAP — NOT A PRODUCTION FORWARD-MIGRATION PATH"
   warning), and a non-mutating dry-run confirmed the ordering blocker is
   now resolved (no `--include-all` required, existing chain migrations
   correctly not re-proposed). **RETIMESTAMP + DRY-RUN: PASS — PHASE 2
   ORDER BLOCKER RESOLVED.**

**🟢 UPDATED 2026-08-30 — Phase 2 has since been applied.** Owner + ChatGPT explicitly authorized Files 00/01/02 only; the apply succeeded cleanly (zero errors), followed by deep post-apply verification (migration history, full schema/constraint/sequence/function/trigger/RLS/policy/grant inventory, a 7-point permission/RLS proof re-run directly against the live TEST database, Quote-Number and Attn regression checks, and a pre/post data-integrity comparison — all PASS). **`quotecode-test` now carries the full 9-application-table Production-parity schema** (business_settings, chat_logs, clients, expenses, quote_attachments, quote_items, quotecode_documents, quotes, services), with `quotes` RLS correctly enabled for the first time (closing the previously-documented `anon`-full-access drift) and the known `is_super_admin()` parity drift corrected to match Production. **File 03 (Storage) was NOT applied** — confirmed via migration history (`remote:""`), zero storage bucket, zero storage policy. Zero data loss: all 9 pre-existing quotes, all 5 `business_quote_sequences` rows, the quote-number range/sequence, and the existing Attn columns all confirmed unchanged. Production was never linked or queried for anything but metadata this entire task. Full detail: `PROFLOW_HANDOFF.md` §18.CR. **Phase 2 (Files 00/01/02) is now DONE.** Storage, Edge Functions, Auth configuration, TEST user creation, local Vite rewiring, and any Production action all remain separately unauthorized future steps — this apply did not authorize any of them.

## 10.K TODO Backlog Corrections (added 2026-08-30, same task as §10.J item 8)

Documentation-only additions to `PROFLOW_TODO.md`, unrelated in content to
the migration work above but authorized in the same task: (1) item 1
(Super Admin) retitled/clarified to cover only the backend
security/permissions layer, explicitly not the full Admin UI (see the new
item 22 below); (2) new item 22, "Full Admin Functional Audit" — OPEN, not
started, full inventory of every Admin UI control/state, with an explicit
note that recording it does not pre-authorize any destructive/Production
action; (3) a new OPEN follow-up under item 14.A for three Public Quote
bottom action buttons (HE: "הורד כ-PDF" / "**חייג/י אליי**" (Owner's exact
wording, preserved verbatim) / "הדפס מסמך"; EN: full functional parity),
not implemented; (4) a new "Future Product Ideas — Owner Decision Required"
section recording 16 product ideas, explicitly marked as ideas only, not
authorized, not queued for implementation.

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

## 10.E Two confirmed audit findings implemented + File-by-File Ledger rule (added 2026-08-28)

Both MEDIUM findings from the cross-market audit (§10.D) were implemented and
independently regression-verified by Agent HE + Agent EN with zero regressions
found on either side: (1) `PublicQuote.jsx` now imports the canonical
`formatMoney` instead of a private duplicate; (2) `addressFormat.js`'s Hebrew
branch now includes the State/Province field instead of silently dropping it.
**Source changes remain LOCAL/UNCOMMITTED** - Owner + ChatGPT review requested
before any application commit. New permanent reporting rule: for cross-market
work, every report requires a file-by-file HE/EN counterpart ledger, not just a
summary matrix - full rule `PROFLOW_PROJECT_CONTEXT.md` §17.I. Full ledger for
this pass: `PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.F Pre-commit release-candidate audit — NOT COMMIT READY (added 2026-08-28)

Full audit of the entire accumulated release candidate before considering an
application commit. Verdict: **NOT APPLICATION COMMIT READY.** One new,
independently-confirmed HIGH defect: `Dashboard.jsx`'s delete-confirmation
dialog double-prefixes the quote number on every deletion, both markets
(`"#A123"`/`"##abcd1234"` instead of `"A123"`/`"#abcd1234"`) - a side effect of
an earlier fix within this same release candidate. Trivial fix (remove one
hardcoded `#`), not applied - read-only audit. Everything else: READY, zero
VAT/₪/Hebrew leakage. Full ledger + release-order plan:
`PROFLOW_CLAUDE_LATEST_REPORT.md`. Recommend a small fix-and-reverify pass
before requesting commit authorization.

## 10.G HIGH-1 fixed, commit-readiness upgraded to READY (added 2026-08-28)

The one HIGH defect from §10.F (delete-confirmation double-prefix) is fixed
(removed a hardcoded `#` in `Dashboard.jsx`) and independently re-verified
clean by both Agent HE and Agent EN - real numbers now show `A123` exactly
once, fallback shows `#abcd1234` exactly once, both markets, RTL/LTR/
deletion/modal all confirmed unaffected. Repo-wide search found no other
instance of the pattern. **Commit-readiness verdict upgraded to APPLICATION
COMMIT READY** for the full accumulated release candidate. **Source remains
LOCAL/UNCOMMITTED** - this verdict is not itself commit authorization; a
separate explicit Owner + ChatGPT go-ahead is still required before any
`git add`/`commit`/`push` of application source. Full detail:
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.H FIRST APPLICATION COMMIT of this engagement (added 2026-08-28)

Owner + ChatGPT explicitly authorized, and Claude executed, the first
application-source commit+push of this entire multi-task Quote-Number/HE-EN
engagement: `ffc741d19ee4c66b88697c717bb536758dd3b33a`, 14 files (canonical
money/quote-number/address utilities, Attn fields, Hebrew address
State/Province fix, the delete-confirmation double-prefix fix, shared
desktop-width token). Passed a full gate chain: fresh-state check, inventory
reconfirmation, QA, a final Agent HE + Agent EN release-gate PASS, secret
scan, explicit staging. **The DB migration package and `.gitignore` remain
separately local/uncommitted** - a source commit is not a DB/LIVE action.

**⚠️ Flagged, not resolved**: whether this repo's Vercel project auto-deploys
on push to `main` (the common default for a GitHub-connected Vercel project)
could not be checked from the Claude environment - Owner should check the
Vercel dashboard directly. Full reasoning: `PROFLOW_HANDOFF.md` §18.BW.

## 10.I Vercel auto-deploy CONFIRMED + push-authorization rule corrected (added 2026-08-28, LOCAL ONLY as of writing)

Owner directly verified in the Vercel dashboard: **every push to `main`
triggers a Production deployment**, documentation-only commits included.
Confirmed by observing `ffc741d` and subsequent doc-only commits both
auto-deploy. **Permanent rule correction**: push-to-`main` now requires its
own separate explicit Owner + ChatGPT authorization, distinct from routine
documentation-commit authorization - "documentation push != LIVE" is no
longer a safe assumption for this repo. Full rule: `PROFLOW_PROJECT_CONTEXT.md`
§17.E; fact recorded: `PROFLOW_ARCHITECTURE.md` §2.

**Mixed-version Production audit** (frontend already live via `ffc741d`'s
auto-deploy, DB/Edge Functions still old): Agent HE = SAFE, Agent EN =
DEGRADED BUT SAFE, Claude Lead's reconciled verdict = DEGRADED BUT SAFE (a
silent, unannounced Attn/Role data-loss caveat applies to both markets, not
EN-specific). No CRITICAL/BROKEN/DATA-RISK found. Urgency: SHOULD COMPLETE
RELEASE SOON, not URGENT. Full ledger + rebuilt Release Order:
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

**⚠️ This section and its sibling documentation edits were LOCAL ONLY at the
time of writing** - per this task's own instruction, nothing was committed or
pushed. A future session must verify via fresh git evidence whether they have
since been committed/pushed under a separately-authorized pass.

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

Canonical technical/project documents (six total — see `PROFLOW_PROJECT_CONTEXT.md` §0.A/§0.B):

- `PROFLOW_ARCHITECTURE.md`
- `PROFLOW_CHAT_HANDOFF.md` (this file)
- `PROFLOW_CLAUDE_LATEST_REPORT.md`
- `PROFLOW_HANDOFF.md`
- `PROFLOW_PROJECT_CONTEXT.md`
- `PROFLOW_TODO.md`

A documentation-only commit was already pushed:

`3561b0eab1a88bd2648877ca800cc1ab9323d685`

Message: `docs: update ProFlow implementation state and permanent workflow rules`

All application/source changes remain LOCAL and UNCOMMITTED after that
commit.

## 14. Current resume point

**🟢 UPDATED 2026-08-30 — read this paragraph first, then the rest of this section for the still-accurate older Quote-Number/HE-EN release-candidate state below.** The most recent workstream is the Full Runtime TEST Environment Build (§10.J) — currently at: retimestamp of the four Phase-1 capture migrations executed and dry-run-verified (PASS — PHASE 2 ORDER BLOCKER RESOLVED), nothing applied to `quotecode-test` or Production yet, Phase 2 apply itself still unauthorized. `main` HEAD unchanged at `17ac4d3a...` throughout this entire workstream — everything synced via `proflow-continuity` only. Separately, several TODO backlog corrections were made (§10.K) — documentation only, nothing implemented. **NEXT ACTION**: awaiting Owner + ChatGPT review of the retimestamp result before Phase 2 (or Storage/Auth/Edge/user-creation work) may proceed. This does not change or reopen anything below about the Quote-Number/HE-EN release candidate, which remains its own separate, still-accurate state as of its own last update:

- Hebrew money alignment: Owner visually accepted.
- 980px visual content architecture: Owner + ChatGPT accepted.
- Scrollbar center-axis issue: implemented and measured resolved.
- Mobile Quote Number label/surface consistency: implemented locally.
- English live visual QA: unavailable.
- Quote Number: LIVE architecture audited (read-only), local package redesigned, then **runtime-validated in an isolated disposable Supabase project** (`quotecode-test`) - two real defects found and fixed through that testing (§8, §10.A). Still nothing applied to Production.
- Application code: **first commit pushed** (`ffc741d`, §10.H) — 14 files, the HE/EN Quote Number release candidate. The DB migration package and `.gitignore` remain separately uncommitted; no DB migration, Edge Function deploy, or LIVE action has occurred.
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

## 15.B Reading the six documents from `proflow-continuity` (ACTIVE/VERIFIED, added 2026-08-28)

ChatGPT should read the six ProFlow documents from the **`proflow-continuity`
branch/ref** on GitHub, not `main`'s default ref - `main` may lag behind on
documentation between releases by design (§17.J). **Verified safe** (Owner
confirmed after the first controlled push): pushing this branch produces no
Vercel Preview/Production deployment (an Ignored Build Step is configured
specifically for it) - `main` remains the only branch whose push carries a
deployment consequence. This does not change the golden rule from §15.A:
CONTINUITY DOCUMENTS ≠ FRESH LOCAL WORKING TREE, and LATEST CLAUDE REPORT ≠
FRESH LOCAL STATE either way - the continuity branch is a transport path, not
proof of current filesystem/runtime state.

**Note on the Owner's separate NEW CHAT Bootstrap/Introduction document** (an external, ChatGPT-maintained document, not part of this repository's six-file set): that document previously described `proflow-continuity` as PENDING VERIFICATION, written before the first controlled push was manually confirmed safe. That wording is now superseded - the next revision of that external document should show `proflow-continuity` as ACTIVE/VERIFIED. This repository does not contain that file and this task did not create or modify it - recorded here only so a future session knows to expect that external document to eventually reflect this status, and does not need to re-verify continuity safety from scratch if it already does.

## 15. New-chat startup instruction

When a new ChatGPT conversation begins, the recommended Owner message is:

> "ProFlow — continue from the latest state. Read `PROFLOW_CHAT_HANDOFF.md`
> and reconcile it with `PROFLOW_HANDOFF.md`, `PROFLOW_PROJECT_CONTEXT.md`,
> `PROFLOW_TODO.md` and `PROFLOW_ARCHITECTURE.md`. Do not propose
> implementation changes until you understand the current state and open
> blockers."

Separately, "קלודי סיים - תקרא את הדוח האחרון" is a distinct, narrower
trigger for retrieving Claude's newest task report specifically — see §15.A.
