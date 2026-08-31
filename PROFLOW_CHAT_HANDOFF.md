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
- Claude session rotation timing is governed by `PROFLOW_PROJECT_CONTEXT.md`
  §48 (permanent) — normally rotate after 1–3 significant workstreams/several
  working days/a major clean checkpoint, never mid-task.

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

**🟢 UPDATED 2026-08-30 — Phase 3 (Storage) has since been applied too.** After a deep read-only preflight (`PROFLOW_HANDOFF.md` §18.CV — byte-for-byte parity with Production confirmed, GO WITH CONDITIONS), Owner + ChatGPT explicitly authorized applying File 03 to `quotecode-test`. Applied cleanly (zero errors); deep post-apply verification confirmed the `quote-files` bucket and both RLS policies match Production exactly, and a full 7-point security/RLS proof (owner upload succeeds, cross-user upload fails, anonymous upload fails, public read succeeds, UPDATE unavailable, DELETE unavailable — even blocked by a previously-undiscovered `protect_delete()` trigger — no cross-user write) all passed exactly as predicted, using only a synthetic disposable object that was fully cleaned up afterward. Zero data regression (all 9 quotes, 5 `business_quote_sequences` rows, Attn columns, and the quote-number sequence confirmed unchanged). Two documentation-only backlog items were also recorded this same task: a "Business Settings — Warranty Section" product requirement (item 23) and the pre-existing, cross-market-symmetric `storage_path` persistence bug (item 24, not fixed, not caused by this migration). Full detail: `PROFLOW_HANDOFF.md` §18.CW. **`quotecode-test` now carries the complete Full Runtime TEST Environment Build base package — Files 00 through 03, all applied and verified.** Edge Functions, Auth configuration, TEST user creation, local Vite rewiring, the `storage_path` fix, the Warranty implementation, and any Production action all remain separately unauthorized future steps.

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

## 10.L TEST Runtime Activation Audit — READ-ONLY / PLAN ONLY (added 2026-08-30)

A complete read-only audit of what's still missing to turn `quotecode-test`
(schema/Storage already Phase-2/Phase-3-complete, re-confirmed with zero
drift this task) into a genuinely browser-usable TEST runtime. **Central new
finding**: `Dashboard.jsx`'s real signup call hardcodes `emailRedirectTo` to
Production's own domain — deliberate, pre-existing, affects HE/EN
identically — recorded permanently as `PROFLOW_PROJECT_CONTEXT.md` §24 item
11. This blocks testing the real signup-through-UI-with-email-confirmation
flow specifically, but is **entirely sidestepped** by the recommended path
of creating TEST users via the Supabase Admin API (pre-confirmed, no email
round-trip needed — `business_settings` auto-creates correctly from
`user_metadata.signup_market` on first login regardless).

Edge Function inventory: 9 tracked locally, 11 actually deployed on
Production (`clever-processor` and `send-welcome-email` have **no local
source anywhere in this repo** — undocumented drift, purposes unclarified),
**0 on TEST**. `get-public-quote` is the sole data source for the entire
Public Quote page (not just attachments) — the single most important
function for a first visible milestone.

**Agent HE: PASS WITH CONDITIONS. Agent EN: BLOCKED** (citing the
long-documented absence of any non-Owner International identity). **Claude
Lead reconciliation**: both verdicts describe the *same* underlying
technical gaps (zero Edge Functions, zero TEST users, the email-redirect
hardcode) affecting both markets identically — the disagreement is framing,
not substance. Local does not activate meaningfully before International;
both need the identical three prerequisites (env-split, one Edge Function,
one Admin-API-created user), and the Admin-API path is exactly as available
and exactly as safe for a fresh International identity (created inside the
fully isolated `quotecode-test` project, zero collision with the Owner's
real account) as it is for Local. The one real asymmetry is procedural —
International TEST-identity naming needs extra discipline given that
history — not technical. EN's conditions were folded into the plan, not
overridden.

A Minimum Visible Milestone (env-split + `get-public-quote` deployed + one
Local TEST user) and a separate, larger Full Functional Milestone were
defined. A 6-step execution order (A: `.env.localtest.local`/Vite mode — B:
deploy `get-public-quote` to TEST — C: Local TEST user — D: International
TEST user — E: Owner review — F: Full Functional items) was produced, each
step individually risk-rated with its own rollback/verification plan.
**Verdict: TEST RUNTIME ACTIVATION AUDIT: GO WITH CONDITIONS. None of the
six steps are authorized by this audit** — recommended next Owner decision
is Step A only (zero-risk, local-file-only, fully reversible). Full detail:
`PROFLOW_HANDOFF.md` §18.CZ, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Zero mutation of any kind this task** — no code, DB, Auth, Storage, Edge
Function, `.env`, or Production change.

## 10.M TEST Runtime Activation, Step A — implemented (added 2026-08-30)

Owner + ChatGPT authorized **Step A only** from §10.L's execution plan: the
frontend/runtime separation needed for a dedicated local TEST mode. Port
**5186** is now `npm run dev:localtest` (`vite --mode localtest --host
--port 5186 --strictPort`), loading a new gitignored `.env.localtest.local`
that points `VITE_SUPABASE_URL` at `quotecode-test` — `VITE_SUPABASE_ANON_KEY`
is left as an explicit placeholder, since retrieving the real value would
require `supabase projects api-keys`, the exact command this project's
continuity history permanently bans (§18.N — it returns `service_role` in
the same response). The Owner needs to paste the real TEST anon key in
manually (Supabase Dashboard → that project → API settings) before real
Supabase calls will work in this mode.

`src/shared/supabase.js` gained a **fail-closed guard**, active only under
`--mode localtest`: it throws — before any Supabase client is created — if
the resolved project ref is missing, malformed, equals Production's, or is
anything other than TEST's known ref. This was **proven real**, not just
written: the TEST config was temporarily pointed at Production's ref and at
a malformed URL, the actual served guard code was executed with those exact
values, and both threw correctly before restoring the correct config and
reconfirming normal startup with no throw. Port **5184** (the original
Production-pointed default) was left untouched and reconfirmed unchanged.
42/42 tests + lint pass.

**Agent HE: PASS. Agent EN: PASS.** Neither found any way TEST mode could
silently fall back to Production, and the guard has zero market-conditional
logic — fully symmetric. **Verdict: TEST RUNTIME STEP A: PASS.** Full
detail: `PROFLOW_HANDOFF.md` §18.DA, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Explicitly not done**: no Edge Function deployed (`get-public-quote`
remains the separately-authorized Step B), no Auth configuration change, no
TEST user created, no DB/Storage mutation, no Production action, no
commit/push/deploy.

## 10.N TEST Runtime Activation, Step A.1 — real anon key NOT obtained,
Chrome-closure incident disclosed (added 2026-08-30)

Attempted to complete real TEST connectivity for the Step A route (port
5186). **The real `quotecode-test` anon key could not be obtained** —
`supabase projects api-keys` (even without `--reveal`) was blocked by this
environment's own safety classifier before it ran; nothing was exposed, no
workaround was attempted. `.env.localtest.local`'s anon key remains the
Step A placeholder. Substituted a no-credential proof instead: both TEST's
and Production's Supabase hosts return valid, distinct 401 responses
(proving each is live and reachable), plus an architectural proof that the
app's one shared Supabase client is provably TEST-configured under
`--mode localtest`, so any auto-fired call can only ever reach TEST.

Browser Harness remained unavailable — a daemon-level failure (Chrome
itself was running fine; a safe, isolated headless-Chrome recovery attempt
with live CDP confirmed the daemon still wouldn't connect, ruling out a
browser-availability cause).

**🔴 Incident, disclosed immediately when it happened**: while cleaning up
that isolated recovery-attempt Chrome instance, an overbroad `taskkill`
filter (`/FI "MEMUSAGE gt 1"`) killed **every** Chrome process on the
machine, not just the intended one. Confirmed to have touched no ProFlow
file, DB, TEST/Production data, or the running dev servers — a real but
contained process-hygiene mistake, outside this task's authorized scope. If
the Owner had a real Chrome window open, it was closed without
authorization.

**Agent HE: PASS WITH CONDITION. Agent EN: PASS WITH CONDITION** — both
citing the Chrome incident as the condition; both independently re-verified
the guard/env/port isolation itself is clean and correct. **Verdict: TEST
RUNTIME STEP A.1: PASS WITH CONDITIONS.** Full detail:
`PROFLOW_HANDOFF.md` §18.DB, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Explicitly not done**: no Edge Function deployed, no Auth configuration
change, no TEST user created, no DB/Storage mutation, no Production action,
no commit/push/deploy. The TEST route remains safely non-functional for
real Supabase calls until the Owner manually pastes in the real anon key.

## 10.O TEST Runtime Activation, Step A.1 Final — real authenticated
connectivity achieved (added 2026-08-30)

The Owner supplied `quotecode-test`'s real publishable API key directly and
it was installed into `.env.localtest.local` — never displayed, echoed, or
logged anywhere. Port **5186** was restarted with the real key loaded;
**5184 was never touched**. A genuine read-only authenticated REST request
(`GET .../rest/v1/business_quote_sequences?select=*&limit=0`) against
`quotecode-test` returned **HTTP 200** with a real PostgREST `Content-Range`
header and zero rows (RLS correctly restricting an anonymous session) —
this workstream's first successful, fully-authenticated Supabase
connectivity proof, confirmed reaching only TEST's hostname, never
Production's.

Both Agent HE and Agent EN independently re-verified the guard/env/port
isolation is correct. Agent HE self-disclosed a minor, immediately-fixed
incident: one of its own overly-broad grep patterns briefly captured a
short fragment of the real key in its own tool output during verification
— caught immediately, the temp file deleted, never shown to the Owner (the
key is a publishable, non-secret-class key by design). Agent EN returned a
clean PASS with no incident.

**Verdict: TEST RUNTIME STEP A.1 FINAL: PASS WITH CONDITIONS.** Full
detail: `PROFLOW_HANDOFF.md` §18.DC, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Explicitly not done**: no Edge Function deployed, no Auth configuration
change, no TEST user created, no signup/login, no DB/Storage mutation, no
Production action, no commit/push/deploy. **The TEST frontend route is now
genuinely, authenticatedly connected to `quotecode-test`** — the remaining
gap to a browser-visible milestone is `get-public-quote` (still not
deployed to TEST) and at least one TEST user (still not created), both
separately unauthorized.

## 10.P TEST Login / Market Routing Audit — a real, narrow gap found
(added 2026-08-30)

Read-only code trace answering: can a Local and an International TEST user
both start from the same normal entry point and automatically land in the
correct market UI, without manually typing `/en`/`/he`? **Answer: no.**

`main.jsx` picks the `AppLocal`/`AppGlobal` bundle (which fixes
`document.dir`/`lang` once, at mount) entirely from anonymous pre-login
signals — before any Auth/session check exists — and never re-evaluates it
after login. Dashboard's actual **content** (text, currency, VAT) is
separately, robustly derived from the authenticated account's real
`business_settings.country` — confirmed genuinely correct by both agents,
not a data/security gap. But nothing reloads or redirects the bundle itself
once that real market is known. Net effect: an account can log in correctly
while trapped in the wrong-direction bundle — fully correct English content
inside a right-to-left page, or the mirror image. `App.jsx` has dead
market-redirect code that would fix exactly this, but it's never imported.

Recorded permanently: `PROFLOW_TODO.md` item 25, `PROFLOW_PROJECT_CONTEXT.md`
§24 item 12, `PROFLOW_ARCHITECTURE.md` §3.2 addendum.

**Agent HE: FAIL. Agent EN: FAIL** — both independently confirmed, no
disagreement, no market asymmetry (same shared mechanism, same defect class
either direction). **Testability: B — TESTABLE BUT MANUAL /en-/he DEPENDENCY
REMAINS** — account isolation/content/currency/VAT are safe to test today;
only automatic landing is absent. **Verdict: TEST ACCOUNT MARKET ROUTING:
GAP FOUND.** Full detail: `PROFLOW_HANDOFF.md` §18.DD,
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Recommended next step (NOT AUTHORIZED)**: create TEST users now and test
via explicit `/he`/`/en` routes — the gap doesn't need to block functional
validation, but should be tracked as its own separate fix. Zero mutation
this task — no code, Auth, DB, Storage, or Production action.

## 10.Q Item 25 — Automatic Post-Login Market Routing Fix implemented
(added 2026-08-30, local working tree only)

The minimal shared fix for §10.P's gap. A new pure function
`getMarketRoutingCorrection` (`src/utils/regionConfig.js`) plus one new
`useEffect` in `Dashboard.jsx` now redirect a logged-in account to
`/dashboard?lang=he`/`?lang=en` (the project's own existing top-priority
routing mechanism, not a new route) exactly once, only after the real
`business_settings.country` is genuinely known — never a guess, no redirect
loop by construction, one identical shared code path for both markets (no
HE/EN-specific duplicate). `App.jsx`'s old dead redirect logic was
deliberately not reused — it reads market from `user_metadata`, an outdated
source inconsistent with the current `business_settings.country`-only
architecture — fresh minimal code was written instead.

14 new unit tests cover all 10 required scenarios (both markets correct/
mismatched, refresh-after-correction, anonymous users, missing/unknown
country, no loop, currency/VAT untouched) — all pass, alongside the full
pre-existing 42-test suite (56/56 total). Lint clean (one pre-existing,
unrelated warning). Build succeeds. Verified on TEST-mode port 5186 via HMR
+ structural HTTP checks — the fail-closed guard and TEST project ref both
confirmed untouched and intact; port 5184 was only read-only PID-inspected,
never restarted.

**Agent HE: PASS. Agent EN: PASS** — both independently traced their
market's full redirect path in code end to end, no disagreement, no
asymmetry. **Verdict: ITEM 25 AUTOMATIC MARKET ROUTING: PASS.** Full detail:
`PROFLOW_HANDOFF.md` §18.DE, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Not yet demonstrated**: a real authenticated browser login, since no TEST
users exist yet. **Recommended next step (NOT AUTHORIZED)**: create exactly
two fictional TEST Auth users (one Local, one International) and verify
both from the same normal 5186 entry URL. No TEST user created, no Auth/
DB/Storage/Edge/Production action, no commit/push/deploy this task.

## 10.R Item 25 End-to-End TEST User Verification — real login succeeded,
correction unobservable, BLOCKED (not an Item 25 defect) (added 2026-08-30)

Using the Owner's two new fictional TEST Auth users (`quotecode-test`),
the first real browser login test of Item 25 was performed. Browser
Harness's daemon remained unavailable, so verification used an isolated,
separate-profile headless Chrome driven directly over raw CDP (Node's
built-in `WebSocket`, no new dependency) — cleaned up each time via
`taskkill /PID <exact> /T /F`, the precise PID that instance itself
launched, never a broad filter (corrected from the earlier §18.DB
incident; confirmed zero orphaned instances afterward, the Owner's own
real Chrome untouched throughout).

**Genuinely confirmed live, both accounts**: sign-in succeeded; starting on
each account's own matching bundle produced a stable state with no
unnecessary redirect; session correctly persisted across two consecutive
refreshes each; sign-out completed cleanly.

**Blocked, root cause diagnosed (read-only)**: starting each account on the
*mismatched* bundle — the actual Item 25 correction scenario — produced no
redirect. A read-only diagnostic found **both accounts have zero
`business_settings` rows and no `signup_market`** in `user_metadata`.
`Dashboard.jsx`'s own pre-existing, unmodified `fetchSettings` logic
correctly routes this into the existing `needsRegionChoice` fail-safe state
(since local TEST can't reach the Vercel-only geo-detection endpoint
either) — and `getMarketRoutingCorrection` correctly, by design, refuses to
guess a market with no real data. **This is not a defect in Item 25** — its
logic, the fail-safe gate, and session persistence were all genuinely
confirmed correct live; only the correction redirect itself remains
unobserved, blocked by a test-data precondition outside Item 25's scope.

**Agent HE: LOCAL TEST USER: BLOCKED. Agent EN: INTERNATIONAL TEST USER:
BLOCKED** — both independently reproduced the identical, symmetric result,
no asymmetry, no evidence implicating Item 25's code. **Verdict: ITEM 25
END-TO-END: BLOCKED.** Full detail: `PROFLOW_HANDOFF.md` §18.DF,
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

**To unblock (NOT AUTHORIZED)**: give each TEST account a real
`business_settings` row with `country` set (e.g. completing the existing
region-choice UI flow once per account) — a database write requiring its
own separate authorization. No code change, no DB write, no Auth/Storage/
Edge/Production action, no commit/push/deploy this task.

## 10.S Item 25 E2E Unblock + Final Verification — PASS for both markets
(added 2026-08-30)

The Owner authorized the narrow TEST-only mutation needed to unblock §10.R:
completing ProFlow's own existing region-selection UI once per TEST
account — a real click on the real rendered screen, no SQL, no Table
Editor — letting the application's own logic create the `business_settings`
row. Local TEST user clicked "Israel" → exactly one row
(`country: "Local"`, `currency: "ILS"`). International TEST user clicked
"International" → exactly one row (`country: "International"`,
`currency: "USD"`). Both confirmed unchanged at task end (no duplicates, no
drift, Auth metadata untouched).

**Genuine methodology finding along the way**: a bare `signInWithPassword()`
API call (the sign-in method §10.R's tooling used) does not reliably
trigger `Dashboard.jsx`'s own post-login `loadData()` sequence — confirmed
via live network-request tracing showing zero `business_settings`/`quotes`/
etc. queries fired that way. Driving the **real rendered login form**
instead (real DOM inputs, real submit) fires the complete, correct sequence
every time. §10.R's BLOCKED verdict remains fully valid for what it
diagnosed (both accounts genuinely had zero rows) — the verification
tooling itself needed this correction to observe the correction path once
real data existed.

With both accounts genuinely initialized and real-form-signed-in, Item 25's
correction was observed **live, for real, both markets**: **Local**,
starting on the mismatched International bundle, corrected to `dir=rtl`/
`lang=he` with `₪0.00` shown and no `$`. **International**, starting on the
mismatched Local bundle, corrected to `dir=ltr`/`lang=en` with `$0.00`
shown and zero `₪` leakage. Both stable across two refreshes each, no
redirect loop, session persisted throughout. Both markets' own-bundle
baselines produced no unnecessary correction.

**Agent HE: LOCAL TEST USER INITIALIZATION: PASS, LOCAL ITEM 25 E2E: PASS.
Agent EN: INTERNATIONAL TEST USER INITIALIZATION: PASS, INTERNATIONAL
ITEM 25 E2E: PASS** — both independently reran every scenario on fresh
isolated Chrome instances and reproduced identical, symmetric results, no
asymmetry. **Verdict: ITEM 25 END-TO-END: PASS.** Full detail:
`PROFLOW_HANDOFF.md` §18.DG, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**Mutation accounting**: exactly the two authorized `business_settings`
rows, created entirely through the application's own existing UI logic —
no SQL, no manual DB editing, no code change, no Auth/Storage/Edge change,
no additional users, no commit/push/deploy, no Production action.

## 10.T Item 17 Quote Numbering — Root-Cause + Release Readiness Audit,
READ-ONLY (added 2026-08-30)

A full, dedicated read-only audit of Item 17 (per-business sequential
quote numbering) — no code, DB, migration, Edge Function, Auth, Storage,
commit, push, or Production mutation of any kind. Every prior claim was
independently re-verified against the actual files/CLI output, not
assumed: the 5-file migration package (`business_quote_sequences` +
`allocate_quote_number(uuid)` + unique constraint + immutability trigger +
old-DEFAULT drop) remains fully applied and migration-history-matched on
`quotecode-test`, still unapplied on Production, where the original global
`quotes_quote_number_seq` DEFAULT (the "A90" root cause) remains live and
unchanged.

**New findings this pass**: fresh `supabase functions list` on both
projects showed `get-public-quote`/`send-quote-email` were last deployed
to Production on 2026-08-25 — before the 2026-08-28 code change that added
`quote_number` to their local sources — and are not deployed to TEST at
all, so Public Quote/email pages cannot show a real number on either
project today even though the local source is already correct. The RPC
allocation path has never been empirically exercised on TEST (no quote
created there since the migration landed) — still a code-derived
inference. `QuoteForm.jsx`'s internal "Editing Quote #{id}" header
(raw UUID, a disclosed prior-task scope exclusion) remains the only open
cosmetic gap; no other inconsistent formatting found anywhere in the
repository.

**Agent HE: PASS. Agent EN: PASS.** Both independently re-read the full
migration package, the `Dashboard.jsx` creation/edit/duplicate paths, and
both Edge Functions' local sources, and independently re-ran
`supabase migration list`/`functions list` against both projects
(Production link restored and reconfirmed at the end of each). Neither
found any market-specific branch, VAT/currency coupling, or
language-conditional logic anywhere in `allocate_quote_number(uuid)`, the
`business_quote_sequences` schema, or any frontend call site —
**numbering is confirmed one single, shared, market-neutral
architecture.**

**Verdict: RELEASE READINESS = B. READY WITH CONDITIONS** (DB design
complete and TEST-verified; the two Edge Functions need coordinated
redeployment and the RPC path needs a real empirical test before this
becomes A). A 10-gate implementation/release plan was proposed, not
executed: TEST empirical proof → TEST Edge Function deploy → TEST full
HE/EN verification → (optional) QuoteForm.jsx gap fix → commit → push to
`main` → Production DB migration → Production Edge Function deploy → LIVE
verification, each its own separate Owner authorization. Full detail:
`PROFLOW_CLAUDE_LATEST_REPORT.md`, `PROFLOW_HANDOFF.md` §18.DH,
`PROFLOW_TODO.md` item 17.

**Mutation accounting**: zero. Two read-only `supabase functions list`
metadata calls were made against Production (disclosed explicitly in the
report, not a data-content read) to obtain Edge Function `updated_at`
timestamps; no table read, no write, no migration, no deploy, no
commit/push anywhere.

## 10.U Item 17 TEST Implementation + Coordinated TEST Verification —
ITEM 17 TEST IMPLEMENTATION: PASS (added 2026-08-30)

The Owner authorized the smallest safe TEST-only step from §10.T's proposed
plan (gates 1-3, plus the optional QuoteForm.jsx gap fix). **Implemented**:
`src/components/QuoteForm.jsx` gained a new `editingQuoteNumber` prop —
the internal "Editing Quote #{id}" header now calls the existing canonical
`formatQuoteFallback` instead of a raw UUID slice, closing the one
remaining disclosed gap (no new formatter invented). `src/pages/
Dashboard.jsx` passes `editingQuoteNumber={editingOriginalQuote?.
quote_number ?? null}`, reusing an already-existing lookup. Lint clean,
56/56 tests pass (including all of Item 25's own tests, confirmed
unaffected), build succeeds. **Not committed** — working tree only, per
explicit instruction.

**Deployed**: `get-public-quote` and `send-quote-email` to `quotecode-test`
ONLY, each individually by name, target-guard-confirmed before each call.
Post-deploy `functions list` confirmed exactly these 2 functions ACTIVE,
`verify_jwt` matching Production's own config — no unintended function
touched.

**Verified end-to-end, real application flow only**: a new CDP automation
script drives the REAL rendered UI (real login form, real "New Quote"/
"Duplicate"/"Edit"/"Delete" buttons, real form fills/submits — zero manual
SQL, zero direct RPC call). Claude Lead validated the tooling first,
finding and fixing two real bugs (a row-mistargeting bug, and a
Mobile-viewport issue requiring a forced Desktop viewport override), then
handed off to both agents for independent runs.

**Agent HE (Local, re-run): PASS.** Sequential allocation, duplicate/
edit/delete-immutability all confirmed, edit header showed the real number
live (`"עריכת הצעה A100712"`), Public Quote page showed the real number.

**Agent EN (International, first-ever run on this account): PASS.** First
quote allocated **exactly A100700** despite Local's counter already
sitting past A100710 at that exact moment — **the definitive cross-business
isolation proof, in both directions**. Same full battery confirmed:
sequential allocation, duplicate/edit/delete-immutability, real number on
the edit header and Public Quote page, English label/LTR/`$`, zero ₪
leakage, zero VAT-shaped element anywhere.

**One disclosed, non-numbering finding**: "Send Email" fails identically
on both markets — root-caused to a missing `RESEND_API_KEY` secret on
TEST (Production has one, confirmed via a read-only `secrets list`
names/digests-only comparison). `send-quote-email`'s local source was
already confirmed to compute the number-bearing subject correctly before
the failing Resend call — a TEST-environment gap, not an Item 17 defect.
No secret was added to TEST (not authorized by this task).

**Verdict: `ITEM 17 TEST IMPLEMENTATION: PASS`** (`LOCAL QUOTE NUMBERING:
PASS`, `INTERNATIONAL QUOTE NUMBERING: PASS`, `PER-BUSINESS ISOLATION:
PASS`, `PUBLIC QUOTE NUMBER CONSISTENCY: PASS`, `EMAIL NUMBER
CONSISTENCY: BLOCKED` — TEST secret gap). Full detail: `PROFLOW_HANDOFF.md`
§18.DI, `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**TODO/continuity discipline**: `PROFLOW_TODO.md` item 17 updated to
`🟢 COMPLETE / VERIFIED — TEST ONLY`, explicitly stating Production/LIVE
remains fully pending. New permanent rule `PROFLOW_PROJECT_CONTEXT.md`
§47 recorded ("never delete a completed TODO item" — did not already
exist). Three Owner product decisions recorded as documentation only,
nothing implemented: item 21's Trial-notification/System-Notification-
Slider refinements (with a cross-reference note added to item 20, since
the Owner referred to this as "Item 20" while item 21 is the file's actual
existing home for the concept — flagged for Owner/ChatGPT to confirm),
and item 23's Warranty sharpened requirements (snapshot-at-creation,
immutable once locked, editable while draft, must cover Public Quote/PDF).

**Mutation accounting**: the app-code fix (uncommitted), 2 Edge Function
deploys to TEST only, disposable TEST quote create/edit/duplicate/delete
via real application flow on both accounts, documentation updates. No
Production mutation, no migration applied, no function deployed to
Production, no commit, no push, no Vercel deploy, no secret added, no
Item 20/21/23 implementation.

## 10.V TEST Acceptance Readiness — audit then large multi-feature
Package 1 implementation, iterated through many live Owner corrections
(added 2026-08-30)

A large TEST-only workstream in two parts. **Part 1 (audit only)**: a
comprehensive readiness audit across Warranty, Trial notification, Public
Quote actions, CSV button color, Attachments, TEST email config, and
session-rotation documentation — verdict `TEST ACCEPTANCE READINESS AUDIT:
PASS`, nothing implemented. **Part 2 (Owner-authorized implementation,
"Package 1")**: implemented and TEST-verified everything the audit
recommended, then iterated live through numerous Owner design corrections
mid-task (all addressed, not deferred) — most notably the Trial
notification's visual language changed four times (colored slide-bar →
purple card → text-only ticker → final "slide-center-stop" motion) and the
Public Quote bottom actions were redesigned twice more from an abstract
two-button description into the Owner's exact reference screenshot
(three equal tiles, a custom hand-built `PdfFileIcon.jsx` since lucide-react
has no icon with literal "PDF" text).

**Shipped, TEST-only, all lint/test/build-clean, none committed**: Item 24
Attachments fix (one-line `storage_path` fix); Export CSV button recolored
to charcoal, scoped correctly; a newly-discovered Default Terms bug fixed
("New Quote" was discarding the business's saved default); Item 23
Warranty fully implemented (new TEST migration, full snapshot/lock/
duplicate architecture, both Public Quote pages, `get-public-quote`
redeployed); Public Quote bottom actions (Call Me/Print fully functional,
PDF an honest non-functional "Coming Soon" placeholder); a real mobile
signature-pad scroll-blocking bug fixed (found from a real-device Owner
report, verified with genuine CDP touch events); a real mobile horizontal-
overflow bug root-caused and fixed (`isMobileView` defaulting to desktop on
first render — not band-aided with `overflow-x:hidden`, which the Owner
explicitly forbade).

Both Agent HE and Agent EN independently verified the full feature set live
(real login, real fictional data, real anonymous client-side signing for
the lock proof) — **PASS across every sub-item**. Claude Lead independently
re-verified the later mid-task corrections via isolated CDP sessions with
screenshots and DOM measurement, since those landed after the agents were
briefed.

**Regression scare, investigated and resolved**: the Owner reported the
"לידי"/Attn fields had disappeared from the New Quote form. Live,
empirical, both-market/both-viewport testing found the fields fully intact
and correctly rendered — **no code regression exists**; most likely a
stale Vite HMR state on the Owner's own browser tab after this session's
very large number of live file edits. Recorded transparently, not silently
dismissed.

New permanent rule `PROFLOW_PROJECT_CONTEXT.md` §48 (Claude Session
Rotation Rule) recorded — identified as missing during this session's own
bootstrap.

**Not committed, not pushed, not deployed.** Full detail: `PROFLOW_TODO.md`
items 21/23/24/14.A, `PROFLOW_HANDOFF.md` §18 (CURRENT RESUME STATE step
33), `PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.W Client Type Badge — audit + TEST implementation (added 2026-08-30)

A focused, Owner-authorized TEST-only task. Audit confirmed `clients.client_type`
(`'business'`/`'private'`, explicit column, already required in two existing
forms, already driving real Tax-ID-required logic) as the authoritative
source — no schema change needed. Implemented a small compact badge (icon +
label) next to the client name in Quote History (desktop table + mobile
card), reading the live joined client record rather than the quotes table's
own snapshot column, consistent with how the client name itself is already
shown live. Both markets verified with real fictional TEST data, including
confirming the badge updates immediately when an existing client's type is
edited. Zero new horizontal overflow at 360/390/412px. Verdict
`CLIENT TYPE BADGE: PASS`. Two previously-undocumented future requirements
(Attn/לידי empty-fallback, Persistent Plan Identity) recorded as new TODO
items 27/28 rather than left as a passing mention. TEST-only, not committed/
pushed/deployed. Full detail: `PROFLOW_TODO.md` item 26,
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.X Continuity Sync Failure Audit + Recovery (added 2026-08-30)

ChatGPT's independent read of `ref=proflow-continuity` on GitHub found it
stale — missing the §10.W report and TODO items 27/28 — despite repeated
same-session claims that all six docs were updated. Root cause: those
updates only ever landed in the main working tree; the existing §17.J
transport step (isolated worktree → secret scan → explicit staging →
commit → push `proflow-continuity` only) was never actually executed,
from conflating "NO commit/push" (correctly scoped to `main`/application
code) with the separate, standing documentation-sync obligation. Fixed by
running the existing mechanism exactly as documented — no redesign — then
performing genuine **remote GitHub read-back verification** (`api.github.com`
Contents API, base64-decoded, since `raw.githubusercontent.com` was blocked
and `gh`/`python3` were unavailable) confirming the new HEAD sha and actual
decoded file content, not just a successful local push. An Incident Record
addendum was added to `PROFLOW_PROJECT_CONTEXT.md` — not a new rule, §17.J
already covered this. `main` HEAD confirmed unchanged throughout. Verdict
**CONTINUITY SYNC FAILURE AUDIT + RECOVERY: PASS**. Full detail:
`PROFLOW_HANDOFF.md` §18 step (35), `PROFLOW_PROJECT_CONTEXT.md` Incident
Record section.

## 10.Y Item 26 Final UI Refinement — Client Type icon-only + column + tooltip (added 2026-08-30)

Owner reviewed §10.W's icon+text pill badge and requested a final redesign:
icon-only display (`Building2`/`User`, no permanent text), fixed 24×24px
circular slot so Business/Private render at identical container size, a new
dedicated compact desktop column "סוג לקוח"/"Client Type" (badge moved out
of the name cell into its own centered `<td>`), and accessibility carried by
`role="img"` + `aria-label` + native `title` (not hover-only, not a new
keyboard tab-stop). New permanent rule recorded per explicit Owner request —
`PROFLOW_PROJECT_CONTEXT.md` §49, "UI Width Consistency Rule": equivalent UI
alternatives sharing one visual slot must reserve stable size based on the
widest legitimate alternative. Live-verified both markets via isolated CDP
(header text, tooltip text, exactly one distinct badge size, zero overflow
at 360/390/412px + desktop). Full regression clean. Two Owner-mentioned
future items recorded as deferred-only (`PROFLOW_TODO.md` item 29 — Admin
"Permission/הרשאה" column removal + a deferred plan-icon idea; explicitly
**NOT implemented, WE ARE NOT WORKING ON ADMIN YET**). Verdict
**ITEM 26 FINAL UI REFINEMENT: PASS**. TEST-only, not committed/pushed/
deployed. Full detail: `PROFLOW_HANDOFF.md` §18 step (36),
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.Z Item 26 Owner QA Micro-Fix — sortable Client Type + solid-purple badge (added 2026-08-30)

Owner reviewed §10.Y's icon-only column and requested two more refinements.
**Sorting**: the "Client Type" column header now sorts the same way every
other Quote History column already does (`handleQuoteSort`, `▲`/`▼`
indicator), strictly on the raw `clients.client_type` value — never the
icon, tooltip, or translated text — verified to group identically in both
markets. **Badge visual**: background changed from a pale translucent tint
to a solid `NEON.violet` (`#7c3aed`, the existing ProFlow-purple token, not
a new color) with a white icon; no gradient, no shadow. `24×24` fixed
footprint, §49 (UI Width Consistency Rule), tooltip/accessibility, desktop
column, mobile behavior, and HE/EN parity all reconfirmed unaffected. Full
regression clean. Admin (item 29) and Item 28 untouched. Verdict
**ITEM 26 OWNER QA MICRO-FIX: PASS**. TEST-only, not committed/pushed/
deployed. Full detail: `PROFLOW_HANDOFF.md` §18 step (37),
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.AA Item 27 — Attn/"לידי" Client-Name Fallback + Current Workstream Continuity Correction (added 2026-08-30)

**Part A**: audited the existing Attn architecture first — `attn_name`/
`attn_role` are real per-quote snapshot columns on `quotes`, written at save
time, already covered by the unmodified `guard_quote_immutability()`
whole-row lock (same trigger already protecting `terms`/`warranty`/`notes`).
Implemented the fallback inside `handleSaveQuote`'s existing `attnFields`
construction (`Dashboard.jsx`) — an empty/whitespace-only Attn falls back to
the same client name being saved for that quote, written as a genuine,
historically-stable snapshot (not a render-time computation), with zero
DB/trigger change. Explicit Attn always preserved verbatim. Live-verified
both markets via isolated CDP: fallback correct for empty/whitespace Attn
(confirmed on the real Public Quote page too, fetched through the app's own
"View Quote" action), explicit Attn preserved, duplication copies the
persisted snapshot verbatim (unmodified architecture), locking verified by
architecture + regression. Zero new overflow, full regression clean. Verdict
**ITEM 27 ATTN/לידי CLIENT-NAME FALLBACK: PASS**.

**Part B**: corrected the stale "Full Runtime TEST Environment Build"
current-workstream framing (in `PROFLOW_TODO.md`'s "Current Recommended
Execution Order" and this file's own resume-pointer, see below) to the
Owner-directed **USER-FACING COMPLETION / OWNER QA** workstream. The
infrastructure work itself is fully preserved as history, not deleted or
downgraded — only the "what is current" framing changed. Admin remains
explicitly deferred (`PROFLOW_TODO.md` item 29); Item 28's Plan/Trial-State
decision reconfirmed documented, not implemented. TEST-only, not committed/
pushed/deployed. Full detail: `PROFLOW_HANDOFF.md` §18 step (38),
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.AB TEST Subscription Personas — Audit + Safe Creation Plan Only (added 2026-08-30)

Read-only architecture audit ahead of Item 28. Confirmed by repo-wide grep:
exactly two code paths ever write `business_settings.plan` (signup →
`'pro'`+14d trial; self-cancel → `'free'`+null) and **no automatic
trial-to-free downgrade exists anywhere**. **Real, disclosed gap**:
`effectivePlan` resolves to `'pro'` unconditionally once the raw `plan` is
`'pro'`, regardless of trial expiry — a real user who lets a trial lapse
without cancelling keeps full PRO indefinitely today, contradicting the
Dashboard's own "moved to FREE tier" messaging. A live read-only REST check
confirmed `send-subscription-expiration-email` references a
`subscription_ends_at` column that **does not exist** on TEST (`PGRST
42703`) — flagged, not fixed. Confirmed via migration/trigger source: 'basic'
can never be created at signup (RLS), and any plan/trial UPDATE beyond
signup/self-cancel requires a `super_admin`-role caller (blocks even
service-role calls). Feature gates (`isBasicOrAbove`/`isPro`, monthly quote
limits) confirmed frontend-only, no backend re-enforcement. Recommended a
hybrid persona model: reuse the two existing TEST accounts unchanged as
"FREE + Active Trial," create six new accounts for the remaining states
(once separately authorized), each set once via signup + a single
super_admin UPDATE — never toggled, to avoid repeating the project's own
prior Trial-reset regression risk. Full findings: `PROFLOW_PROJECT_CONTEXT.md`
§50. Two new documentation-only future-product TODO items recorded:
`PROFLOW_TODO.md` item 30 (Industry/Measurement/Pricing Engine + §30.A AI
Chat awareness) and item 31 (Additional Notes 3-column display). Verdict
**TEST SUBSCRIPTION PERSONAS AUDIT: PASS**. Zero mutation — no TEST user
created/modified, no application code changed, no Item 28/Admin/Production
action. Full detail: `PROFLOW_HANDOFF.md` §18 step (39),
`PROFLOW_CLAUDE_LATEST_REPORT.md`.

## 10.AC Documentation-Only Product Direction Update — Invoice Readiness + Item 30 Mixed Pricing (added 2026-08-30)

Pure documentation task, zero code/DB/mutation. **`PROFLOW_TODO.md` §30.B**
extends item 30 with "Industry Is Not Pricing Model" — Industry/Business-Type
only supplies recommended defaults, never determines pricing method; the
individual quote item always has final say, and one quote may legitimately
mix pricing methods (Owner's carpentry example: length×rate, fixed-price,
quantity×unit-price, all on one quote). Records the future hierarchy
(`Business/Industry preset → business defaults → catalog/item defaults →
per-quote-item pricing method → user override`) and possible future per-item
pricing methods. **`PROFLOW_TODO.md` item 32** records, as an explicitly
NOT-authorized future direction, a possible future commercial-document flow
(`Client → Quote → Approval/Signature → Work/Order → Billing →
Invoice/Receipt → Payment → Follow-up`) and the architectural-readiness
concepts today's design work (chiefly item 30) should stay reasonably
compatible with — explicitly without adding any accounting complexity to
current features now. Verdict: `FUTURE INVOICE READINESS DOCUMENTED: PASS`,
`ITEM 30 MIXED PRICING CLARIFICATION: PASS`, `INDUSTRY ≠ PRICING MODEL
RULE: PASS`. Full detail: `PROFLOW_HANDOFF.md` §18 step (40).

## 10.AD Trial Expiration → FREE — Full Entitlement Audit + TEST Fix (added 2026-08-30)

Owner final product decision, implemented and TEST-verified: an expired
Trial without a valid paid subscription must become effectively FREE, not
just visually. Re-confirmed the root cause (signup writes `plan:'pro'` once,
never reverted; `effectivePlan` stayed `'pro'` forever regardless of trial
expiry) and proved, from the RLS/trigger audit, that this specific
transition is safely distinguishable from a genuine paid grant — no schema
invention needed. New centralized `src/utils/planEntitlements.js`
(`computeEffectivePlan`) is now the single source of truth. **Found and
fixed three real, independently-duplicated formula bugs**: `Dashboard.jsx`'s
own `effectivePlan` (root cause), `SettingsTab.jsx`'s Logo-upload gate (was
raw `bizPlan`), and `QuoteForm.jsx`'s Attachments gate (was raw
`userPlan`/`bizPlan`, newly found, not previously documented). Also removed
`QuoteForm.jsx`'s submit-button blanket `isTrialExpired` disable, which
blocked ALL quote creation once trial expired — stricter than FREE,
contradicting the Owner's rule; the existing quota/edit gates now correctly
enforce FREE limits instead. `AdminUsersTab.jsx`/`UserDetailsModal.jsx` have
the same bug class — disclosed, not touched, per the standing "NO Admin
work" boundary. Backend enforcement re-confirmed frontend-only (unchanged,
disclosed, not expanded into a redesign). TEST-verified live, both markets,
via CDP network-response interception — **zero TEST database mutation**:
active-trial regression PASS, expired-trial correctly resolves to FREE
(Logo/Attachments blocked, submit button not blanket-disabled), 5-quote
monthly limit correctly blocks a 6th attempt. 14 new unit tests
(`planEntitlements.test.js`), 70/70 total pass, lint clean, build succeeds.
Full matrix: `PROFLOW_PROJECT_CONTEXT.md` §51. Item 31 also extended
(documentation only) with purple-numbering and Project→Section→Items
clarifications. Verdict **TRIAL EXPIRATION → FREE: PASS**. Full detail:
`PROFLOW_HANDOFF.md` §18 step (41).

## 10.AE Structured Quote Architecture Correction + Six TEST Personas + Landing Page Access Audit (added 2026-08-30)

Three-part task. **Part A (documentation correction, complete)**: the previous
Item 31 "Project → Section → Items" hierarchy was corrected — Owner +
ChatGPT determined it belongs in the main quote body / future structured-
quote engine, not Additional Notes. Removed from item 31 (now genuinely
supplemental free text only, 3-column layout no longer a mandate),
relocated/expanded as new item 30.C with a full generic
`QUOTE→Project→Section→Items→pricing/calc→totals` hierarchy (Project/Section
explicitly optional), plus explicit financial-correctness test-case and
snapshot/backward-compatibility requirements.

**Part B (six new TEST personas, BLOCKED, evidenced)**: re-confirmed Fresh
Local State first (Trial fix intact, existing active-trial accounts still
correctly PRO, 70/70 tests). Creation itself is blocked: no TEST service-role
key stored anywhere in this repo, and a live raw-API check confirmed
self-service signup requires email confirmation with TEST's email sending
currently rate-limited (`HTTP 429`). Nothing created or mutated to work
around it. Three resolution paths recorded for the Owner
(`PROFLOW_PROJECT_CONTEXT.md` §52).

**Part C (landing page access audit, read-only, complete)**: confirmed
`/he`/`/en` are one SPA bundle, never separate deployments; found and
verified (byte-identical HTML + matching video sizes) that
`quotecode.vercel.app` safely serves the same current build — a candidate
alternate URL for ChatGPT. Demo video confirmed to be a plain public static
file, no secrets. Captured a full-page HE/EN Desktop+Mobile screenshot
fallback package from the real live pages (read-only) in case SPA rendering
blocks a non-JS fetcher. Zero landing mutation, zero secrets exposed.

Verdict: `STRUCTURED QUOTE ARCHITECTURE CORRECTION: PASS`,
`SIX TEST PERSONAS: BLOCKED`, `LANDING PAGE ACCESS AUDIT: PASS`. Full
detail: `PROFLOW_HANDOFF.md` §18 step (42), `PROFLOW_PROJECT_CONTEXT.md`
§52/§53.

## 10.AF Owner-Locked Regression Rule + User UI QA Fixes + Vercel Domain Redirect Audit (added 2026-08-30)

Four parts, all complete. **Part A**: new Permanent Requirement,
`PROFLOW_PROJECT_CONTEXT.md` §54 — once implemented, TEST-verified, and
Owner-reviewed, a behavior/design/feature is Owner-Approved/LOCKED and must
not change without explicit reauthorization, even indirectly via
refactoring/cleanup/"improvement." Ties enforcement to existing status
markers (TODO's 🟢 COMPLETE/VERIFIED, HANDOFF's PASS steps, the File-by-File
Ledger) rather than a new tracking document.

**Part B**: four Owner-observed UI issues, audited first then fixed
narrowly, live-verified both markets: (1) Quote History row-amount weight
`800→600`, totals elsewhere untouched. (2) EN Actions-column clipping —
root-caused to a missing explicit column width; fixed with `minWidth:110px`
+ more available width; confirmed fully on-screen both markets. (3) Desktop
width utilization — audited the shared 980px content token first, found it
also governs the separately-locked Public Quote surface (not in this task's
scope) — **decoupled** rather than widened in place, per the new §54 rule:
a new dedicated `--pf-dashboard-desktop-content-width:1440px` for the
authenticated app only; Public Quote's own token confirmed still exactly
980px. (4) Trial notice collision — fixed by conditionally growing the
header's bottom margin only while a notice is visible; the notice's own
LOCKED text/motion/design untouched. All four verified together, both
markets, desktop+mobile, zero overflow, zero regression.

**Part C**: re-audited `quotecode.vercel.app` redirect behavior without
auto-following — confirmed (not corrected) no redirect exists; added the
missing context that a redirect to the canonical domain is the intended
eventual architecture and simply isn't configured yet (disclosed gap, no
routing change made).

Verdict: `OWNER-APPROVED LOCKED RULE: PASS`, `UI QA: PASS`,
`VERCEL REDIRECT AUDIT: PASS`. 70/70 tests, lint clean, build succeeds. Full
detail: `PROFLOW_HANDOFF.md` §18 step (43), `PROFLOW_PROJECT_CONTEXT.md`
§54/§55.

## 10.AG Owner Visual QA Correction — Global Width Contract + Mobile Width + Amount Hierarchy (added 2026-08-30)

Owner corrected an earlier report: no HE/EN Desktop width discrepancy exists
— confirmed independently via fresh, controlled, same-condition
remeasurement (byte-identical at 1280/1366/1440/1920px, both markets). The
real issue: the shared width itself was too wide (prior flat `1440px` gave
almost no constraint below 1440px viewports). New Permanent Requirement
§56, **ProFlow Global Surface Width Contract** — one canonical width
strategy should eventually govern all equivalent full-page surfaces;
RTL/LTR/language/market are explicitly not functional-reason exceptions.

Desktop width corrected to `min(1320px, 85vw)` (`src/index.css`) — a first
`72vw` candidate aimed at the Owner's loose ~70-75% reference was live-tested
and found to **regress the earlier Actions-clipping fix** at 1280px
(confirmed via screenshot); widened to 85vw, re-verified with zero clipping,
both markets. Mobile Quote History width fixed: a compounded ~30px gutter
(panel's uniform 14px padding + main-content's mobile 6px + card's own
padding) reduced to a clean 15px total via a narrow, `isMobileView`-driven
fix (reusing the component's own existing state, no new mechanism) — 91.7%
card-width utilization at 360px, zero overflow. Amount typography refined
again: row amount `600→500`, Total Revenue `800→600` (confirmed via a real
distinct Rubik weight file and precise DOM inspection) — clear intentional
hierarchy achieved.

Full Global Width Surface Matrix recorded. Public Quote (980px, separately
Owner-locked) confirmed **UNCHANGED** — future alignment explicitly
disclosed as requiring separate Owner approval, not performed now. 70/70
tests pass. Verdict **OWNER QA CORRECTION: PASS**. All new values recorded
as IMPLEMENTED/TEST-VERIFIED/AWAITING OWNER VISUAL APPROVAL, explicitly not
LOCKED, per §54/§56. Full detail: `PROFLOW_HANDOFF.md` §18 step (44),
`PROFLOW_PROJECT_CONTEXT.md` §56/§57.

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

**🟢 UPDATED 2026-08-31 (Owner-Authorized Path B Production Deploy task, §18.EX, read this paragraph first — get-public-quote deployed v6→v7, Warranty now genuinely live on Production Public Quote for both markets, real smoke PASS, no rollback needed).** Continues directly from §18.EW below. The Owner authorized exactly one action — `supabase functions deploy get-public-quote --project-ref ixabnzhjeqevtbhdfswv` — nothing else. Pre-deploy re-verification confirmed the local source was byte-identical to the reviewed/tested `071dad5` and Production hadn't drifted from its known v6 baseline. Deployed successfully: **v6 → v7**. Immediate real smoke against existing Production data only (nothing new created): HE quote #91 (the §109 TEST quote, warranty present) — 200, warranty correctly rendering for the first time; HE quote #67 (a real complex pre-existing quote, no warranty) — 200, zero regression on any field; EN quote #64 (USD, no warranty) — 200, zero ₪/VAT leakage. All three HTTP 200, clean, no errors. **Rollback not needed.** One disclosed gap: no EN quote with a warranty value exists yet on real Production, so that exact combination isn't directly re-proven live there (the mechanism was already proven correct via the HE Production check plus TEST's own HE/EN checks in §110) — not a defect, just the one remaining live-coverage gap. Item 18 untouched, `attn_name`/`attn_role` still absent from Production by design. No DB migration, no application push (`origin/main` still `dd11015`), no Vercel deploy, no real-customer data touched. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §111, `PROFLOW_ARCHITECTURE.md` §14.B, `PROFLOW_HANDOFF.md` §18.EX.

**🟢 HISTORICAL, superseded by the paragraph above (Path B — Narrow get-public-quote Warranty-Only Fix task, §18.EW).** Continues directly from §18.EV below. The Owner chose Path B over §18.EV's two proposed paths: fix `get-public-quote` alone, explicitly deferring item 18's `attn_name`/`attn_role` migration - no Production migration this task. Fresh local state re-verified first (`HEAD==origin/main==dd11015`); Production's schema contract re-confirmed unchanged via a fresh byte-level re-download of the live function (still v6, still zero references to `warranty`/`quote_number`/`attn_name`/`attn_role`). A field-level diff matrix proved the narrowest possible change: only `attn_name`/`attn_role` differ from committed HEAD (REMOVED), everything else UNCHANGED. Implemented in exactly one file (`supabase/functions/get-public-quote/index.ts`, 13 insertions/13 deletions) - `attn_name`/`attn_role` removed from the select and response, `warranty`/`quote_number` kept since both are confirmed present on Production. Committed locally, not pushed. **Verified without disturbing TEST's own certified state**: deployed under a temporary, distinctly-named slug on `quotecode-test` only, hit with 4 real HTTP requests (HE/EN x with/without warranty, all correct), then deleted immediately - TEST's real `get-public-quote` (which still carries item 18's fields for its own separate certification) was never overwritten. 173/173 tests, lint 0 errors, build PASS. Client code (`PublicQuote.jsx`/`PublicQuoteEn.jsx`) re-confirmed already correct - no frontend change made. Deployable as a single function with zero migration required; rollback plan prepared (redeploy the freshly-archived pre-Path-B source) but not executed - nothing was deployed to Production. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §110, `PROFLOW_ARCHITECTURE.md` §14.B, `PROFLOW_HANDOFF.md` §18.EW.

**🟢 HISTORICAL, superseded by the paragraph above (Authenticated Production Release Certification + get-public-quote Pre-Deploy Audit task, §18.EV).** Continues directly from §18.EU below, using the password the Owner supplied directly in-conversation with an explicit non-disclosure requirement — held strictly in-memory throughout, never written to any file, `.env`, commit, log, screenshot, or continuity document (confirmed absent from all six files). Real authenticated smoke against `tahshitishi@gmail.com` (HE) on live Production: login, session, session-persistence, plan/trial, Warranty save-in-Settings, Warranty snapshot-into-new-quote-form, and quote creation/save all **PASS** — DB-confirmed (quote #91, correct `warranty` snapshot, Item 17 still inactive). **Blocked, root-caused, not a Warranty defect**: the new quote's Public Quote page showed no Warranty section despite the DB snapshot being correct, because `get-public-quote` (the Edge Function serving that page) was last deployed 2026-08-25, before the Warranty field (and two other features — Item 17 `quote_number`, Item 18 `attn_name`/`attn_role`) were ever added to its source. The Owner redirected from "deploy the fix" to a strictly read-only pre-deploy audit. **The audit found deploying the currently-committed source is unsafe**: a byte-level download-and-diff of the actual live function (not timestamp inference) confirmed it predates all three features; a direct schema query confirmed `attn_name`/`attn_role` genuinely don't exist on Production, so deploying as-is would make every Public Quote request fail (PostgREST rejects the unknown-column select) — a full outage of the feature, not a partial gap. Zero test coverage exists for this function. Both markets' client code is already correct and ready — only the Edge Function is the blocker. Two safe forward paths identified, neither chosen: (A) apply item 18's migration to Production first, then deploy as-is (fixes three features together); (B) write/review/commit a narrower warranty-only variant, then deploy just that. Rollback trivial — nothing was deployed; the exact prior source is already archived from this audit. **Task paused at this checkpoint by explicit Owner direction** — remaining HE steps (historical-integrity D/E, Signature Pad, Quote History), the entire EN side, responsive smoke, and Admin (expected `PENDING TEST ADMIN`) not yet attempted. No Edge Function deploy, no application push, no DB mutation beyond the two Owner-authorized in-app writes (Warranty Settings save, one TEST quote), no other Production mutation. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §109, `PROFLOW_ARCHITECTURE.md` §14.B, `PROFLOW_HANDOFF.md` §18.EV.

**🟢 HISTORICAL, superseded by the paragraph above (Production TEST Identity Discovery task, §18.EU).** Continues directly from §18.ET below. Strictly read-only, zero mutation — no user created, no password reset, no session destroyed, no data changed. Checked all open browser tabs for an existing authenticated Production session via `Target.getTargets` and a `localStorage` scan (no navigation/mutation) — **none found**, nothing was logged out or cleared as a result. **Root-caused the two prior login failures precisely, not just re-confirmed as failing**: a boolean equality check (never printing the actual `.env` values) confirmed `PROFLOW_TEST_LOCAL_EMAIL`/`PROFLOW_TEST_INTL_EMAIL` are both plus-aliased addresses — Supabase Auth treats a plus-alias as a completely separate account, and these specific aliases were only ever created on `quotecode-test`'s own fixture work this session, never on Production. **Found the Owner's actual, real, established Production TEST accounts**: `tahshitishi@gmail.com` (business "תכשיט אישי", Local/HE market) and `minhatshay@gmail.com` (business "Minhat Shay (London)", International/EN market) — both matching the exact bare inbox names already hardcoded as `TEST_BYPASS_EMAILS` in the email Edge Functions themselves (an already-established convention throughout this engagement, not a new guess). Both independently confirmed genuine in `auth.users` (email-confirmed, not banned, created 2026-07-31 — a full month before this session began, conclusively unrelated to any of this engagement's own work) with `last_sign_in_at` in the last 1-2 days — **this precisely matches the Owner's own description of "approximately two accounts used successfully through the Production domain for several days."** Both are currently in an active trial (raw `plan:free` with a still-future `trial_ends_at`, resolving to effective PRO). A third account, "PENTEST LEGIT TRIAL", was found but is explicitly scoped for the separate, already-documented pentest-review purpose — not recommended for general smoke, to avoid conflating purposes. **No clearly-labeled TEST admin identity exists on Production** (unlike `quotecode-test`'s own deliberate `shlomisiny+proflow-test-admin@gmail.com` pattern) — Production's two `super_admin` accounts both read as real personal accounts, one matching this session's own known Owner identity (`quotecodedev@gmail.com`), so neither is treated as a safe TEST-admin candidate. **Minimum gap, precisely determined (outcome C)**: the correct HE and EN TEST accounts are now identified with full confidence — **the only missing piece is the actual password**, which this task correctly does not have and should not guess at or reset without explicit authorization. A separate, smaller gap (outcome E) remains for Admin-tier smoke specifically. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §108, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EU.

**🟢 HISTORICAL, superseded by the paragraph above (Production Release task, §18.ET — pushed and deployed, canonical redirect LIVE, authenticated smoke blocked on a TEST-identity gap).** Continues directly from §18.ES below. **The certified 19-commit release is now live**: `git push origin main` succeeded (`e030017..dd11015`), remote `main` verified to resolve exactly to `dd11015`, and Vercel Production auto-deployed — confirmed via the single most decisive signal available: `quotecode.vercel.app/`, which independently served the app before this push, now returns a real `308` redirect to `www.quotecodepro.com/` (this exact fix exists only in `dd11015`, so its live presence is itself conclusive deployment proof). **Canonical domain live gate: PASS** — confirmed via both curl (1 redirect, no loop, path+query preserved on `/dashboard?lang=he`) and independent Browser Harness navigation (browser genuinely ends on the canonical host, real page renders) — **this closes the exact gap this entire engagement has been tracing since §102, now proven live, not just code-ready.** Canonical Production health confirmed PASS in both HE (RTL) and EN (LTR), desktop and mobile, zero console errors. **DB and Edge Functions confirmed untouched by this deployment**, via actual evidence not assumption: both email functions' `updated_at` timestamps (via `supabase functions list`) predate this push by 6-8 days; a fresh DB check found `pg_proc` has **zero** rows for `allocate_quote_number` — Item 17's allocator does not exist in Production, full stop, conclusively **INACTIVE**. **A genuine gap was found and handled honestly, not worked around**: neither established Production TEST identity (`PROFLOW_TEST_LOCAL_EMAIL`/`PASSWORD`, `PROFLOW_TEST_INTL_EMAIL`/`PASSWORD`, both read from the Production-pointed `.env`) authenticates against the real Production Supabase project — both attempts returned a proper "Login error: check your credentials" message, meaning the login mechanism itself works correctly (form, submission, graceful error handling, no crash, canonical host maintained throughout) — this is a **TEST-identity provisioning gap, not a deployment defect**. Per the task's own explicit prohibitions (never the real Production Admin, never a real customer, only *established* identities — not newly created ones), no workaround was attempted. **Consequence**: the login-dependent smoke sections (Auth full session flow, Admin, plan personas, Warranty live smoke, quote creation with Item-17-watch, HE/EN Public Quote via TEST quotes, Signature Pad, Quote History/Dashboard, authenticated responsive checks) **could not be completed — genuinely not attempted, not failed.** Per the task's own explicit rule against declaring GREEN on partial completion, **FINAL PRODUCTION STATUS is precisely NOT unconditional GREEN** — but this is explicitly **not** a rollback-triggering condition: zero defect was found in anything actually checkable, and the deployment (including the hardest-won fix of this whole engagement) is proven healthy and live. **A genuine Owner decision is now required**: confirm/provide a valid Production TEST identity, explicitly authorize creating a new one, or accept the current unauthenticated-only verification as sufficient for now. No unauthorized Production mutation, no migration, no Edge Function deployment, no real-customer data touched, no secret exposed. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §107, `PROFLOW_ARCHITECTURE.md` §1.A/§16, `PROFLOW_HANDOFF.md` §18.ET.

**🟢 HISTORICAL, superseded by the paragraph above (Final 19-Commit Production Release Audit task, §18.ES — RELEASE GREEN, pre-push).** Continues directly from §18.ER below. Read-only release certification, no push/deploy/mutation. Fresh state matched the documented checkpoint exactly. All 19 commits between `origin/main` and `dd11015` individually reviewed via actual diffs, not commit messages. **The critical, most carefully-traced finding**: `Dashboard.jsx`'s `handleSaveQuote` does call `supabase.rpc('allocate_quote_number', ...)` (Item 17's allocator) — but this exact code block is **byte-identical to `origin/main`** (`git diff origin/main HEAD` on that region: zero output). This call has already been part of the live, deployed Production frontend since `ffc741d` (2026-08-28), already wrapped in a proven-safe `try/catch` that falls through to the pre-existing global-sequence column `DEFAULT` on failure — exactly the already-documented "A90" mechanism. **This release introduces zero new call to it and zero new dependency on it — the behavior is 100% carried-forward from what's already live, not newly introduced.** ITEM 17 PREMATURE ACTIVATION: NO, proven not assumed. Confirmed, not assumed, that Vercel's build cannot auto-execute any migration or auto-deploy any Edge Function: no `.github/workflows` directory exists, and `vercel.json` has no `buildCommand` override — the build is Vercel's standard `vite build`, which never touches Supabase; both migrations and Edge Function deploys require a separate, explicit manual command. A full static secrets scan of the entire diff found zero matches for credential patterns, hardcoded passwords, debug bypasses, or accidental `.env` commits. Warranty reconfirmed satisfied (both columns EXIST live). Admin V2's `super_admin` gating, HE/EN parity across every shared feature (Warranty, Signature Pad, Quote History, entitlement, Client Type, Public Quote, market routing), and auth/session code were all confirmed untouched by any of the 19 commits. Canonical redirect correctly held at code-GREEN/live-PENDING-DEPLOYMENT, not falsely closed. A final isolated clean-head certification re-ran identically to the prior task's own result: 152/152 tests, lint 0 errors, build PASS. **Full 13-feature release matrix: 12 GREEN, canonical redirect YELLOW (by design, pending deployment). OVERALL VERDICT: RELEASE GREEN.** A 14-step post-deploy smoke plan and explicit stop/rollback conditions were prepared for Owner review — not executed; every data-mutating smoke step is scoped to the already-established authorized TEST identities only, never a real customer account. No push, no deploy, no migration execution, no Edge Function deployment, no Production mutation of any kind occurred in this task. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §106, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.ES.

**🟢 HISTORICAL, superseded by the paragraph above (Vercel Canonical Root Redirect Repair task, §18.ER).** Continues directly from §18.EQ below. Narrow code fix, no push, no deploy, no Production mutation. `middleware.ts` now checks the request host explicitly — before its existing geolocation-cookie logic — via a new pure, exported, unit-tested function `resolveCanonicalRedirect(host, pathname, search)`, and returns a real `Response.redirect(target, 308)` when the host is exactly `quotecode.vercel.app`. **Confirmed the only reliable design**: `@vercel/functions`'s middleware module exports only `next`/`rewrite`, no dedicated redirect helper (confirming the standard Web `Response.redirect()` is correct here), and Vercel's Edge Middleware fully owns its response once it returns anything other than falling through — exactly why the pre-fix middleware's unconditional `next()` on the root path prevented `vercel.json`'s already-correct host-conditional redirect rule from ever being reached for `/`. Every other host — the canonical domain itself, `localhost`, TEST, preview deployments — falls through completely unchanged, confirmed **structurally**, not just by inspection: `middleware.ts` is not part of the Vite bundle at all (zero imports anywhere in `src/`, byte-identical production-build output hashes before and after this change), and Vercel Edge Middleware cannot execute outside an actual Vercel deployment, so local/TEST dev is provably unaffected. 11 new unit tests (`middleware.test.ts`) cover: canonical-host non-redirect, Vercel-host redirect at root and with a path, query-string preservation, case-insensitive host matching, local/TEST/preview-host non-redirect, and the structural impossibility of a redirect loop (`CANONICAL_ORIGIN` can never equal `VERCEL_APP_HOST`). Full suite **173/173 PASS**, lint 0 errors, build unchanged. Committed locally as **`dd11015`**, diff reviewed as exactly the two intended files — **not pushed**. Clean committed-tree proof re-run and re-confirmed (152/152 tests, build PASS, `entry-server.jsx` still correctly absent). **19 commits now ahead of `origin/main`** (18 from before + this one). Warranty's Production schema prerequisite remains satisfied (§104, unaffected by this task). **CANONICAL DOMAIN CODE READINESS: GREEN. CANONICAL DOMAIN LIVE GATE: PENDING DEPLOYMENT** — deliberately kept distinct: only an actual deployed HTTP + browser check can prove `quotecode.vercel.app/` really redirects live; local/unit-test passing is not treated as sufficient to close that gate. Item 17 and the email Edge Function redeploy remain entirely untouched and separately authorized-only. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §105, `PROFLOW_ARCHITECTURE.md` §1.A, `PROFLOW_HANDOFF.md` §18.ER.

**🟢 HISTORICAL, superseded by the paragraph above (Warranty Production Migration — Owner-Authorized Applied task, §18.EQ).** Continues directly from §18.EP below. **The one real Production DB mutation performed this session, explicitly Owner-authorized and scoped to exactly one file.** Re-verified target (`ixabnzhjeqevtbhdfswv`, confirmed via fresh `supabase projects list`), migration file (byte-identical to the reviewed version, zero diff since `6430cf5`), and both columns (fresh check: still MISSING) immediately before mutation — zero discrepancy from the prior preflight. `supabase migration list --linked` confirmed 12 local migrations unapplied to Production (all of Item 17/18/base-schema/Warranty) — a plain `db push` would have attempted all of them, so applied instead via `supabase db query --linked -f <the one file>`, executing only that file's SQL with zero interaction with any other migration file. **Result: SUCCESS.** Immediate read-only verification confirmed both `business_settings.default_warranty` and `quotes.warranty` now EXIST live in Production — `text`, nullable, no unintended default/constraint, correct grants (`authenticated` has exactly INSERT/SELECT/UPDATE on `default_warranty`, SELECT inherited from the table's pre-existing grant), RLS unchanged (`relrowsecurity=true` on both tables, unchanged), and full column lists on both tables byte-for-byte identical to the pre-migration baseline plus exactly the one new column each — conclusive proof nothing unrelated changed. Existing-data integrity confirmed: identical row counts (12 `business_settings`, 23 `quotes`), all new-column values NULL as expected on every existing row, and quote-numbering stats (`min=11, max=89, distinct=23`) unchanged — zero interaction with `quote_number`. Pre-push Production smoke PASS: `www.quotecodepro.com` loads correctly via both HTTP (200) and live browser navigation (real landing page renders, no login, no mutation). **Application push, Vercel deploy, Item 17, and the email Edge Functions all remain untouched, exactly as scoped** — this task retires the 18-commit chain's sole RED blocker (Warranty schema) but does not itself authorize pushing that chain. The Vercel root-redirect gap (§103) remains open, deliberately not addressed this task. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §104, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EQ.

**🟢 HISTORICAL, superseded by the paragraph above (Warranty Production Release Preflight + Vercel Canonical Redirect Verification task, §18.EP).** Continues directly from §18.EO below. Strictly read-only, zero mutation. Read `6430cf5`'s Warranty migration SQL in full: exactly two additive `ADD COLUMN IF NOT EXISTS ... text` statements (nullable, no default), two column-scoped grants matching the table's own already-established least-privilege pattern, two pure-metadata comments — **classified MINIMAL**, nothing unrelated. Read-only Production checks confirmed no naming collision, no dependent views, small sanitized row counts (12/23), and that `ADD COLUMN` with no default is a Postgres 11+ metadata-only operation (low lock risk, no table rewrite). A five-scenario failure/rollback analysis found every path forward-safe, no destructive SQL needed. **WARRANTY MIGRATION READY FOR OWNER AUTHORIZATION: YES** — not yet applied; if authorized, the next concrete action is a single `supabase db push` of this one migration file, followed by the prepared (not-yet-run) smoke checklist. **Separately, a real, pre-existing, precisely root-caused Production gap was found**: `quotecode.vercel.app`'s literal root path (only) serves the app directly instead of redirecting — confirmed via both direct HTTP checks (200 OK, real cached content, not a cache artifact) and live browser navigation (browser genuinely stays on the Vercel domain, full page renders). Root cause: `middleware.ts`'s `matcher: ['/']` is root-only and **not host-aware** — it runs identically on every host (including `quotecode.vercel.app`) and always calls `next()` by its own explicit "never redirects" design, so `vercel.json`'s host-conditional redirect rule never gets applied to the literal root. Every other path (`/en`, `/he`, `/dashboard`, query string preserved) correctly redirects, confirmed via both curl and browser. This `vercel.json`/`middleware.ts` pair is confirmed unmodified and already live on `origin/main` — a pre-existing gap, unrelated to and independent of the 18-commit chain and the Warranty decision (confirmed: `6430cf5` touches exactly two files, zero overlap with Vercel config, Item 17, Attn, Admin V2, the entitlement resolver, or the email functions). **VERCEL CANONICAL REDIRECT: RED** — needs its own small, separate fix, not performed this task. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §103, `PROFLOW_ARCHITECTURE.md` §16/§1.A, `PROFLOW_HANDOFF.md` §18.EP.

**🟢 HISTORICAL, superseded by the paragraph above (Production Pre-Push Preflight task, §18.EO).** Continues directly from §18.EN below. Strictly read-only: target verified as Production (`ixabnzhjeqevtbhdfswv`, distinct from `quotecode-test`) before any query, via `supabase projects list`. A schema-only Production dump (confirmed zero data rows, zero PII) plus targeted `information_schema`/aggregate SQL — no INSERT/UPDATE/DELETE/DDL/RPC/Edge-Function-invocation at any point. **Warranty**: `business_settings.default_warranty`/`quotes.warranty` confirmed genuinely MISSING via two independent methods. **Sharper finding than the prior task's own report**: `fde680b`'s Warranty code has no fail-safe retry (unlike Attn), so pushing today would break *every* quote save and *every* Business Settings save against Production's live schema — not a Warranty-scoped gap, a P0-severity regression to core functionality. **Attn**: `attn_name`/`attn_role` also confirmed MISSING, but already-live `origin/main` code (`ffc741d`) has a deliberate try-then-fallback retry already handling this gracefully — PASS, closing a question several prior sessions left open. **Quote numbering**: A90's mechanism reconfirmed unchanged — Postgres's own native `quote_number DEFAULT nextval('quotes_quote_number_seq')`, a single global sequence, zero application code; re-verified live (23 quotes, 23 distinct numbers, zero collisions, 7 businesses sharing one global range) 3 days after the original audit. Item 17's migration package assessed file-by-file: the sequence/index/immutability-trigger pieces are READY; the drop-default piece is correctly BLOCKED by its own documented release order (must come last, after the allocator is verified live), not defective. **Major finding, corrects several prior sessions**: a real, already-`origin/main`-committed Vercel Cron (`vercel.json`+`api/cron.js`, daily 08:00 UTC) already invokes both `send-trial-expiration-email` and `send-subscription-expiration-email` in batch mode against Production's currently-deployed (unfixed) functions — resolving the long-standing "scheduler could not be confirmed or ruled out" into a definitive YES, simply by reading a file that was always in the repo. Production confirmed to have no `pg_cron` extension. Vercel's push-to-main-equals-auto-deploy behavior reconfirmed accurate. Full 18-commit Production dependency matrix and a GREEN/YELLOW/RED decision matrix recorded — only Warranty and (as a process caveat, not a defect) Item 17's release order are non-green; everything else in the chain is confirmed push-safe without any DB action. A documented, NOT-executed safe release sequence was produced for Owner review. Zero mutation of any kind. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §102, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EO.

**🟢 HISTORICAL, superseded by the paragraph above (Dashboard-Centered Remaining Work Bundle task, §18.EN).** Continues directly from §18.EM below. Full line-by-line reconstruction of Dashboard.jsx's 814-line diff, tracing every prop into its actual consumer (not guessing) — confirmed genuine, real cross-file runtime dependencies to all 7 remaining files (e.g. SettingsTab.jsx's Warranty textarea calls a setDefaultWarranty prop only Dashboard.jsx supplies; useSignaturePad.js's new default-off gate would silently break the already-pushed PublicQuote.jsx/PublicQuoteEn.jsx signature pad without their matching consumer changes). All 8 files committed together as one atomic commit, **`fde680b`** — closes the customer-facing twin of the Admin entitlement bug (Dashboard/Settings/QuoteForm now use the corrected effectivePlan resolver), wires Warranty end-to-end (Settings → Dashboard snapshot-at-creation → Public Quote display, historical quotes keep their own snapshot), fixes the signature pad's tap-to-activate lifecycle on both markets, implements zero-layout-shift trial-bar placement, and adds Item 25 (market-routing)/26 (Client Type Badge)/a newly-named Item 27 (Attn/recipient fallback to the client's own name — already TEST-verified per pre-existing test data discovered in-account). Intermediate-head safety verified before and after the commit, plus a dedicated isolated clean-tree proof (build PASS, 141/141 tests PASS). **TEST Browser QA used real simulated interaction, not just rendering**: the signature pad's activate/draw/clear/deactivate cycle was verified via genuine canvas ink (`toDataURL()` byte-length change, confirmed only after adding real timing gaps between synthetic mouse events since `isDrawing` is React state) across HE Active Trial (full flow: Warranty save → snapshot → Public Quote display → Attn-fallback → signature), HE Expired Trial→FREE (FREE PLAN correctly shown, not stuck PRO — the exact bug this whole engagement has targeted, now live-verified on customer-facing surfaces), and EN Basic (parity). **Pre-push audit (read-only, no push)**: of the 18-commit chain now ahead of `origin/main`, everything is GIT-SAFE (build/test clean, confirmed twice in isolation) but **Warranty specifically is not yet PRODUCTION-SAFE** — `fde680b` is the first commit whose live code path actually reads/writes `default_warranty`/`warranty`, and that migration (`6430cf5`) is committed but not applied to Production; pushing without applying it first would break Warranty save/display against Production's live schema. Everything else (Attn, quote-number, market-routing, entitlement resolver, Admin V2, email fixes) was confirmed pushable without any DB action. Still no push, no deploy, no migration execution, no Production/DB mutation. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §101, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EN.

**🟢 HISTORICAL, superseded by the paragraph above (Local Workstream Consolidation — Maximum Safe Commit Discipline task, §18.EM).** Continues directly from §18.EL below. Processed §99's 8 uncommitted threads one at a time against 10 eligibility criteria, using careful hunk-level discipline (including a safe, fully-reversed temporary manual edit to isolate two unrelated changes git's own diff grouped into one `package.json` hunk). **12 new local commits** (`835654d` through `02ad374`, none pushed): the Item 17 quote-numbering SQL package and a newly-found Item 18 Attn-contact migration gap (the same class of dependency issue as §18.EL's fix, at the DB-schema layer — already-committed-and-pushed `ffc741d` references `attn_name`/`attn_role` columns only this migration creates), the base-schema-capture package, the pentest-review `.gitignore` entry, `dev:localtest` + its TEST fail-closed guard, the Order-Number-sorting fix, the Item 25 market-routing function, Item 23 Warranty's DB+API backend slice only, variable-font infrastructure, the global print rule, and `PdfFileIcon.jsx`. **Deliberately NOT committed, each with a concrete evidence-based reason**: `Dashboard.jsx` (the entangled linchpin of the remaining threads, 549 diff lines), `QuoteForm.jsx` (its trial-gate removal genuinely depends on Dashboard.jsx's uncommitted quota fix — committing alone risked letting an expired-trial account create unlimited quotes with no gate), `QuotesTab.jsx`/`.test.jsx` (further entangled sub-threads of its own across 622 diff lines), `SettingsTab.jsx` (new props only Dashboard.jsx would supply — one path a genuine crash risk), `PublicQuote.jsx`/`PublicQuoteEn.jsx` (≥3 interleaved threads in adjacent hunks), and `useSignaturePad.js` (confirmed: its new default-off signing-activation gate would silently break the *already-committed-and-pushed* `PublicQuote.jsx`/`PublicQuoteEn.jsx`'s signature pad if committed alone). `entry-server.jsx` stays uncommitted per its own explicit §68/§69 documentation. Final clean committed-tree proof (`git archive`, isolated): build PASS, 108/108 tests PASS, lint 0 errors. Working directory: 162/162 tests, lint 0 errors, build PASS. `main` HEAD is now `02ad374` (12 commits ahead of `origin/main`, unchanged at `e030017`) — confirmed self-contained and technically push-safe, not itself a push authorization. Still no push. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §100, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EM.

**🟢 HISTORICAL, superseded by the paragraph above (Fresh Local State Reconciliation + Plan-Entitlements Dependency Repair task, §18.EL).** Continues directly from §18.EK below. A read-only investigation classified the working tree's large uncommitted diff into 8 already-documented threads (quote-number DB migration package/item 17, further cross-market work, the §51 entitlement audit, the Quote History/Dashboard-separation/trial-bar polish chain, the Warranty feature/item 23, a signature-pad fix, an item-25 market-routing correction, an unrelated pentest-source-review export) — nothing unknown or abandoned. It then found a real, previously-undetected defect: Round 2's committed `accountEntitlement.js` (`c4491a8`) imports `computeEffectivePlan` from `src/utils/planEntitlements.js`, which had never itself been committed on any ref — proven via an isolated `git archive HEAD` export (no working-tree access) run through a real `vite build`, which failed with `Could not resolve "./planEntitlements"`. This meant the committed HEAD would have broken Vercel's build entirely if pushed as-is. Owner authorized a narrow repair: committed `planEntitlements.js`/`planEntitlements.test.js` exactly as already TEST-verified, no code change (`018f905`). Re-ran the same isolated-export proof afterward — build PASS, 88/88 tests PASS in the clean snapshot. **Round 2's committed tree is now self-contained and technically buildable independent of the rest of the uncommitted worktree** (not itself a push authorization — still not pushed). No other uncommitted thread was touched, staged, or altered. `main` HEAD is now `018f905` (5 commits ahead of `origin/main`, unchanged at `e030017`). Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §99, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EL.

**🟢 HISTORICAL, superseded by the paragraph above (Overnight Round 2 — Maximum TEST Validation + Plan Identity + P0 Email Repair task, §18.EK).** Continues directly from §18.EJ below. Committed Phase 1 (`c4491a8`) after re-verifying all quality gates. Wired Admin's two plan-badge render sites (desktop table + mobile card, `AdminUsersTab.jsx`) to `planCatalog.js` via a new `getPlanBadgeVisual()` helper — zero visual change, committed (`f482d69`). Built all 8 missing TEST personas on `quotecode-test` (Expired-Trial + genuine-FREE + BASIC, both markets), completing the 10-persona matrix started in §18.EJ. **Closed the one open verification gap from §18.EJ**: live Admin-UI DOM extraction (desktop + mobile) now proves — through the real UI, not just unit tests — that every FREE-tier row (both expired-trial and genuine-FREE, both markets) renders with FREE's own gray styling, never PRO/Lifetime's violet+Crown. Live Dashboard logins confirmed the exact approved expired-trial message in HE (`"תקופת הניסיון הסתיימה, הועברת למסלול FREE"`) and EN (`"Your trial has ended — you've been moved to the FREE plan."`), and confirmed it never leaks to genuine-FREE users. **New forward-looking nuance found, not a bug**: a Lifetime-granted BASIC account also resolves `isLifetime:true` today — correct, since only the admin's own Toggle-Lifetime action can produce that shape currently, but it will need its own distinct field once real billing gives ordinary paid subscribers the same `trial_ends_at:null` shape. **Both named P0 email bugs fixed and committed (`99c4ba3`)**: `send-trial-expiration-email`'s plan filter required `plan==='free'` but active-trial accounts always have `plan==='pro'` — fixed, with the eligibility decision extracted into a tested, dependency-free `eligibility.ts` (14 new tests). `send-subscription-expiration-email` queried 3 `business_settings` columns that don't exist anywhere in the live schema (confirmed against the Production-captured base-schema migration) — no migration performed; per the Owner's explicit rule against emailing healthy auto-renewing subscribers, it now returns a tested, explicit safe no-op (3 new tests) instead of throwing. 162/162 full suite, lint 0 errors, build succeeds. **All three commits remain local-only** — `main` HEAD is `99c4ba3`, `origin/main` unchanged (`e030017`); neither email fix has been deployed to Production Edge Functions, a separate step not authorized or performed this task. One benign discrepancy resolved during Fresh-Local-State verification: the working tree also carries a large, unrelated, already-in-progress quote-number/release-candidate diff, confirmed via `git reflog` to be safely committed further back in `main`'s own history — not touched by this task. Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §98, `PROFLOW_ARCHITECTURE.md` §16, `PROFLOW_HANDOFF.md` §18.EK.

**🟢 HISTORICAL, superseded by the paragraph above (Overnight Maximum Safe Work Package — Admin V2 Foundation Phase 1 task, §18.EJ).** Implemented (locally, not committed) the canonical Plan/Trial entitlement foundation authorized from the completed Maximum Admin Audit. Two new files: `src/utils/planCatalog.js` (FREE/BASIC/PRO metadata — HE/EN labels, badge tokens, the already-approved 5/20/∞ limits; TRIAL deliberately not a catalog entry, it's a lifecycle overlay) and `src/utils/accountEntitlement.js` (`resolveAccountEntitlement()`, composing the existing, completely unchanged `computeEffectivePlan()`). **Fixes the confirmed Admin bug**: Lifetime now requires `trial_ends_at===null AND rawPlan!=='free'` — never the null check alone, which was also the self-cancel signature — a broader, more complete fix than the narrow case, since Admin now displays the already-correctly-resolved `tier` instead of raw plan in every case, not just the null-specific one. `UserDetailsModal.jsx`/`AdminUsersTab.jsx` refactored internally with the exact same returned shape — **zero JSX changes needed**. Diff narrowly scoped: +22/-5 and +27/-8 lines respectively, verified via `git diff --stat`. 34 new tests (2 explicit regression tests locking the exact bug scenario), full suite 145/145 PASS, lint 0 errors, build succeeds. Live browser QA via the dedicated TEST admin identity against `quotecode-test` (never Production): login PASS, Admin table + detail modal re-verified with the fix live, zero regression on both existing (active-trial) TEST personas, Desktop + Mobile both checked. **Honestly disclosed**: the exact bug scenario (self-cancelled-FREE persona) wasn't independently live-browser-verified — no such persona exists, creating/mutating one wasn't clearly covered by standing authorization, flagged NOT YET LIVE-VERIFIED per the task's own anti-blocking instruction rather than fabricated or blocking further work. EN locale similarly not live-verified (no EN-market admin persona exists) but the touched files' `isHebrew` branching was untouched. **Design-only additions**: refined the TEST persona matrix to 10 (distinguishing genuine FREE from Expired-Trial-FREE — which also names the exact persona needed to close the one verification gap); a full Admin UI KEEP/CHANGE/REMOVE/ADD classification. Everything else requested (subscription lifecycle, billing architecture, audit log, HE/EN, responsive, regression strategy, phasing, P0–P3) was already produced by the completed Admin Audit (§94.1), unchanged, not restated. **No application commit** — Phase 1 is fully green but commit authorization was ambiguous, so the task stopped before committing, exactly as its own instructions required. `main` HEAD unchanged (`5f658f3`). Continuity auto-pushed under the standing §17.K authorization. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §97, `PROFLOW_ARCHITECTURE.md` §16.

**🟢 HISTORICAL, superseded by the paragraph above (unrelated topic — this doesn't contradict it) — Overnight Admin QA Readiness Check + Dedicated TEST Super Admin Creation task, §18.EI.** Two phases. **Phase 1 (read-only diagnosis)**: `PROFLOW_TEST_ADMIN_EMAIL/PASSWORD` (plain `.env`) verified genuinely valid, but only against `ixabnzhjeqevtbhdfswv` — already established across prior audits as **Production**, not the `quotecode-test` project the local dev server actually connects to. A minimal role-only read (no PII) independently confirmed genuine `super_admin` status. No browser login attempted with it — using it would mean pointing a live session at Production, a boundary held all session. **Phase 2 (Owner-authorized creation)**: created `shlomisiny+proflow-test-admin@gmail.com` — a Gmail plus-alias of the real Production admin's own address, a technically distinct Auth account, never touching the real `shlomisiny@gmail.com` — exclusively on `quotecode-test`, via that project's own `service_role` key (obtained through the authenticated Supabase CLI, piped shell-to-Node, never echoed to visible output) and the Admin Auth API; set `role:'super_admin'` on its `business_settings` row. **No secret value was ever printed, logged, or written to any document.** Credentials stored as `PROFLOW_TEST_LOCAL_ADMIN_EMAIL`/`PASSWORD` in `.env.localtest.local` (confirmed `git`-ignored before and after). **Verification, all real, all read-only**: backend re-login + RLS-breadth confirmed genuine super_admin; a real browser-harness login against the actual dev server succeeded — Dashboard correctly showed the `SUPER ADMIN` badge, "AI Support Logs," business name "ProFlow TEST Admin," correctly omitted "New Quote"; the Users Admin tab rendered the real table (2 managed accounts, super_admin row correctly excluded, live trial-countdown matching the documented Admin formula). Screenshot captured. **No admin action button was clicked** — observation only. **Closes the exact "no confirmed-working super_admin TEST persona" gap §94.1 had flagged** (superseding note added there and at §18.T). `PROFLOW_TEST_ADMIN_EMAIL`/`PASSWORD` (Production) remains untouched, must not be used for future QA. Quality: zero application code touched. **Zero Production mutation of any kind** (every mutating call targeted `quotecode-test` exclusively, confirmed by direct review). `main` HEAD unchanged (`5f658f3`). Continuity auto-pushed under the standing §17.K authorization, no confirmation requested. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §96, `PROFLOW_HANDOFF.md` §18.EI/§18.T addendum.

**🟢 HISTORICAL, superseded by the paragraph above (unrelated topic — this doesn't contradict it) — P1 Modular Business/Quote Pricing Architecture — Continuity Reconciliation task, §18.EH.** Documentation/continuity only — zero code/DB/TEST/Auth change. **Key finding**: the requested "Modular Business/Quote Measurement + Pricing" architecture was **not missing** — already thoroughly documented at `PROFLOW_TODO.md` items 30/30.A/30.B/30.C (industry≠pricing-model principle, override hierarchy, mixed-pricing capability with the Owner's own carpentry example, detailed historical-snapshot integrity). **The actual gap**: neither `PROFLOW_PROJECT_CONTEXT.md` (one terse pointer sentence, buried in an unrelated entry) nor `PROFLOW_ARCHITECTURE.md` (zero mentions, confirmed by direct search) gave it any real presence outside `PROFLOW_TODO.md` — almost certainly why a canonical-continuity search centered on those files missed it. **Fixed by cross-referencing, not duplicating**: item 30 remains the one authoritative definition; added a genuine substantive summary at new `PROFLOW_PROJECT_CONTEXT.md` §95 and new `PROFLOW_ARCHITECTURE.md` §14.C, both pointing back to it. **New this task, added directly to item 30**: an explicit **P1/Full-LIVE-readiness-gate priority declaration** (architecture required before LIVE; specific future pricing methods may follow after); an extensibility anti-pattern warning (no `if businessType===X` chains); a "five independent dimensions" generalization of the existing market-separation language; and new sub-item **30.D (Admin V2 Compatibility)** — reviewed the just-completed Maximum Admin Audit against item 30 and found **no conflict**, the two are separate concerns, the Admin audit's own recommended next step remains independently actionable. **Bonus, not in explicit scope but found along the way**: the Admin audit's Role-column and Badge/Icon findings (§94.1) independently reinforce two pre-existing items (29.A, 29.B) — cross-referenced, neither reopened. Quality: zero application code touched. **Zero DB/Supabase/Auth/TEST mutation, zero commit/push, zero deploy.** `main` HEAD unchanged (`5f658f3`). Continuity auto-pushed under the standing §17.K authorization, no confirmation requested. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §95, `PROFLOW_ARCHITECTURE.md` §14.C, `PROFLOW_TODO.md` item 30 (30.A–30.D).

**🟢 HISTORICAL, superseded by the paragraph above (unrelated topic — this doesn't contradict it, just isn't the current resume point) — Maximum Admin Audit COMPLETE task, §18.EG.** Continuation and completion of §18.EF below — all 17 previously-outstanding sections of the 24-section Maximum Super Admin / Admin V2 audit finished; nothing already-done in §18.EF was restarted; zero implementation throughout, exactly as scoped. **New evidence found completing it**: a full 10-row Admin Action Safety Matrix (confirming impersonation/market-change/role-change/billing-override are all genuinely absent by deliberate design, not oversights) surfaced two new asymmetries — Lifetime grant has a confirm modal but revoke is instant with none, and "Extend Trial" has no confirmed action-specific server-side re-verification unlike every other mutating action. `created_at` exists but isn't shown anywhere in the Admin detail modal. **The customer Dashboard shows no plan/tier badge at all today** — so the badge problem isn't "Admin vs. Dashboard disagree," it's "Admin has 3 independent hardcoded badge implementations and Dashboard has none yet." **Admin has zero automated test coverage**, confirmed by search. Full deliverables: User Table column classification (Role column is structurally zero-information, given the table already excludes every non-`'user'` row), a 13-section User Detail View model, a Plan/Trial/Subscription Admin representation model (Lifetime as an override tag on the tier, not conflated into it), a Badge/Icon model tied to the plan-catalog proposal, a Pricing Admin model (append-only price versioning, never edit a price already in active use), a Billing Visibility classification, a TEST Persona proposal (email-pattern chip first, zero schema change), an Admin Audit Log schema proposal, a full HE/EN/Market writeup (`AILogs.jsx` the sole 100%-Hebrew-only exception among 4 surfaces), a Responsive/UX writeup (no pagination exists at any scale), a Visual Design proposal (consolidate onto `AdminUsersTab.jsx`'s already-correct LIGHT theme — not a new design language, 3 of 4 surfaces are already light-ish), a Keep/Lock list, a P0–P3 gap map, a complete Admin V2 IA (8 areas, each tagged for current buildability), a 9-phase safe implementation sequence (correctness strictly before visual redesign), a regression-strategy proposal centered on a new "Admin-vs-Dashboard canonical agreement" test class, and a final narrowed Owner-decisions list (3 newly open plus 5 carried forward unaffected). **Recommended single next step**: build the canonical resolver + plan catalog and repoint Admin's plan derivation at it — retires the one confirmed-live bug found across two separate audits, touches nothing else not yet decided. Quality: zero application code touched throughout either §18.EF or this completion. **Zero DB/Supabase/Auth/TEST mutation, zero commit/push, zero deploy.** `main` HEAD unchanged (`5f658f3`). Continuity auto-pushed under the standing §17.K authorization, no confirmation requested. **This closes the Maximum Admin Audit task in full — nothing outstanding remains.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §94.1.

**🟡 HISTORICAL, superseded by the paragraph above (its findings still stand — this completes rather than contradicts it) — Maximum Super Admin / Admin V2 System Audit task, §18.EF — IN PROGRESS / CHECKPOINTED.** A 24-section MAXIMUM-effort read-only Admin audit, checkpointed mid-task at explicit Owner request (continuity sync requested before the full proposal was written up). **What's genuinely done, evidence-backed**: complete Admin surface inventory (`AdminUsersTab.jsx`, `UserDetailsModal.jsx`, `LifetimeConfirmModal.jsx`, `AILogs.jsx`, `admin-cleanup-user-quotes`/`admin-delete-user` Edge Functions — all traced from the live entry point, none orphaned), a full data-flow audit, and a fresh re-trace of the known FREE→"PRO (Lifetime)" Admin bug (confirmed unchanged, still open, not fixed). **New findings this task**: (1) **four independent, uncoordinated visual systems already exist across Admin** — `AdminUsersTab.jsx` already correctly uses the shared LIGHT theme; `UserDetailsModal.jsx` uses the shared **dark** theme (the one genuine holdout); `LifetimeConfirmModal.jsx`/`AILogs.jsx` both use independent hardcoded hex, matching neither shared theme nor each other — reframing the Owner's "go light" ask as mostly consolidation, not a wholesale rewrite. (2) `AILogs.jsx` is hardcoded Hebrew/RTL-only with zero English branch — unique among Admin surfaces. (3) Quote usage/limits are shown nowhere in Admin. (4) `business_settings.currency` exists but Admin never displays it. (5) The Owner's known "email must not be first column" gap already has a working reference pattern in the *same file*'s own mobile card layout (business name primary, email secondary) — just not yet applied to the desktop table. (6) Two existing safety patterns confirmed solid, recommended KEEP/LOCK: re-auth-before-destructive-action and verified (not just error-free) deletion. Security confirmed PASS/UNCHANGED, no bypass found. A live browser-harness visual pass was attempted but blocked — no super_admin-role TEST credential is confirmed working against the dev server's actual connected Supabase project, itself a real TEST-persona gap. **Explicitly NOT yet done, listed in full in `PROFLOW_PROJECT_CONTEXT.md` §94, not silently dropped**: User Table formal classification, User Detail View spec, Plan/Trial/Subscription Admin Model, Badge/Icon Model, Pricing Admin Model, Billing Visibility Model, TEST Persona Admin Support proposal, formal Admin Action Safety Matrix, Admin Audit Log proposal, full HE/EN/Market writeup, full Responsive/UX writeup, Visual Design proposal, Keep/Lock list, P0–P3 Gap Map, Admin V2 Information Architecture, Implementation Phasing, Regression Strategy, Open Owner Decisions. Quality: zero application code touched. **Zero DB/Supabase/Auth/TEST mutation, zero commit/push, zero deploy.** `main` HEAD unchanged (`5f658f3`). Continuity auto-pushed under the standing §17.K authorization, no confirmation requested. **Next step: continue this same audit task to complete the outstanding sections** — this is not a finished deliverable. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §94.

**🟢 HISTORICAL, superseded by the paragraph above — Subscription Email Policy Correction + Trial Countdown Audit + Sandbox Billing Requirement task, §18.EE.** Corrected §18.ED's email-policy framing by explicit Owner decision: auto-renewing BASIC/PRO must **never** get a "subscription ending" reminder at a normal monthly `current_period_end` (that's a renewal, not an expiration) — the 3-day/24-hour reminder pattern is scoped **only** to `CANCEL_AT_PERIOD_END` (copy not yet finalized, remains open); payment-failure and successful-renewal are explicit separate flows, never conflated with expiration reminders. Trial reminders remain fully mandatory and unchanged; the §18.ED plan-filter bug in `send-trial-expiration-email` stays deliberately OPEN, not fixed. §18.ED's Email State Matrix in `PROFLOW_PROJECT_CONTEXT.md` §92 marked with a superseding pointer to §93 rather than silently rewritten. **Trial countdown discrepancy fully root-caused, read-only**, using real `PROFLOW_TEST_LOCAL` account data (own-row RLS-scoped query, anon key + password grant, zero mutation): `trial_ends_at` is exactly `created_at + 14.0000` days — **no reset/extension** — and the Owner's observed "still 14 days" report is explained precisely by a display-rounding gap: Dashboard's `Math.ceil()` formula (`planEntitlements.js:42`) turns the real `13.1091` days remaining into `14`, while the legacy Admin's `Math.floor()`+hours formula (`AdminUsersTab.jsx:276`) correctly shows `13 days, 2 hours` for the identical timestamp — confirmed as pure display precision, not an entitlement/gating bug (the `Math.ceil` rounding doesn't affect `isTrialExpired`/`isExpiringSoon` correctness). Recommended (not implemented) extracting Admin's existing day+hour formula into a shared display helper both surfaces call. **Documented a new permanent Billing Sandbox requirement**: full end-to-end simulation at real configured prices (never a hidden Production ₪0 plan), exercising Checkout→webhook→canonical state→resolver→badge→Admin→limits→reminders end-to-end, matching the canonical-resolver architecture already proposed. Quality: zero application code touched this task — nothing to re-test. **Zero DB/Supabase/Auth/trial-date mutation, zero email sent, zero application commit/push.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval on §18.EC's Part A remains PENDING** — unaffected, unrelated to this task. Continuity auto-pushed under the new §17.K standing authorization, no confirmation prompt requested. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §93.

**🟡 HISTORICAL, superseded by the paragraph above (specifically its email-policy framing — the rest of its findings stand unchanged) — Complete Subscription Foundation Audit + Email Reminder Verification + Permanent Continuity Auto-Sync Rule task, §18.ED.** Continued directly from §18.EC below without restarting it. The Owner closed six previously-open product decisions: BASIC is a real sellable paid plan (₪0/₪49/₪99 pricing unchanged), upgrade takes effect immediately on successful payment, downgrade preserves paid entitlement until `current_period_end`, cancellation is `CANCEL_AT_PERIOD_END` (never immediate), the expired-trial message is finalized as already implemented in §18.EC, and Active Trial must eventually badge as `TRIAL` not `PRO` — all incorporated into the architecture proposal only, zero code implementation this task. **Read-only email-reminder audit** (Supabase CLI — `secrets list`/`functions list`/`projects list`, names/digests/deployment-metadata only, never raw secret values, zero emails sent) found a **new, high-impact bug**: `send-trial-expiration-email`'s own candidate filter (`plan !== 'free' → skip`) blocks essentially every genuine trial user from ever receiving a reminder, since a real trial user's raw `plan` is always `'pro'` throughout their trial — independent of any scheduler question. Re-confirmed `send-subscription-expiration-email`'s missing-DB-columns bug. **New concrete evidence**: both email functions are genuinely deployed/ACTIVE in Production but **not deployed at all to TEST**; Production has the RESEND/CRON secrets configured, TEST has none; no scheduler (Vercel cron, GitHub Actions) exists anywhere in-repo, and a `pg_cron`/external scheduler could not be confirmed or ruled out from available evidence — reported as genuinely UNKNOWN. Full 12-state Email Matrix produced; CANCEL_AT_PERIOD_END reminder-copy flagged as a genuine new open product decision, not invented. Admin FREE→"PRO (Lifetime)" bug re-confirmed, deliberately kept OPEN per instruction. Plan-catalog proposal refined with a centralized/versionable pricing-catalog concept (plan identity decoupled from price) per a mid-task Owner addendum. 8-persona TEST matrix reconfirmed unchanged. **New permanent rule**: `PROFLOW_PROJECT_CONTEXT.md` §17.K now documents a standing Owner authorization for Claude to auto-push documentation-only `proflow-continuity` commits without a fresh per-task confirmation — strictly scoped to that branch, never extending to `main`/code/TEST/DB/Production. This task's own continuity commit was pushed under that new authorization for the first time. Quality: 111/111 (unchanged, zero source files touched). **Zero application-code mutation, zero DB/Supabase/Auth mutation, zero email sent, zero TEST user created/mutated.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval on §18.EC's Part A remains PENDING** — unaffected, this task touched no application code. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §92 (and §17.K for the new permanent rule).

**🟡 HISTORICAL, superseded by the paragraph above — Subscription/Billing/Entitlement System-Wide Audit + Two Trial-Bar Corrections task, §18.EC — PART A IMPLEMENTED/VERIFIED, PART B PROPOSAL-ONLY.** Two strictly separated parts. **Part A** (small, Owner-approved UI corrections): trial bar nudged 8px further up within its existing `position:absolute` track (`calc(100% + 2px)` → `calc(100% - 6px)`) — re-verified 0px document-flow shift across all 4 required combinations (HE/EN × Desktop/Mobile), each measured visible→dismissed→visible-again, identical methodology to §18.EB just below. Expired-trial message corrected per explicit Owner product decision — the old "...אנא שדרג"/"...Please upgrade." CTA suffix removed entirely, no replacement CTA: HE now `תקופת הניסיון הסתיימה, הועברת למסלול FREE`; EN now `Your trial has ended — you've been moved to the FREE plan.` Only the `isTrialExpired` branch text changed; disclosed limitation — no TEST account currently has a genuinely past `trial_ends_at`, so verified via source/lint/111-tests only, not a live screenshot of that specific variant. **Part B** (read-only audit + architecture proposal, explicitly zero implementation): found a **live, reproducible bug** — `UserDetailsModal.jsx` and `AdminUsersTab.jsx` both independently derive "Lifetime" from `trial_ends_at IS NULL` (bypassing the canonical `computeEffectivePlan()` resolver entirely), so a self-cancelled FREE user correctly shows FREE on their own Dashboard but **"PRO (Lifetime)"** on both Admin screens — the field is also the self-cancel signature and the two states are indistinguishable from it alone. Confirmed via a live-production DB trigger + two stacked RLS policies that `plan='basic'` is structurally unreachable at the database level (not just missing app code) — no real purchase path exists anywhere (`billing-checkout-stub` is an explicit scaffold). Found a second bug: `send-subscription-expiration-email` queries 3 DB columns that don't exist in the live schema. Delivered a full 29-state lifecycle matrix, entitlement matrix, an extensibility assessment (marked FAIL — 6+ hardcoded plan-literal call sites), a proposed zero-migration in-code plan-catalog model, a 4-axis canonical resolver proposal, and an 8-persona HE/EN canonical TEST matrix (4 of 8 personas explicitly flagged as currently unbuildable even for TEST purposes, by the same DB restriction). Quality: 111/111 (unchanged), lint 0 errors, build PASS. **Zero DB/Supabase/Auth/.env/trial-date/subscription mutation** — Part B read-only throughout, exactly as scoped. **No commit, no push, no Production.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval on Part A remains PENDING.** Five genuine architecture decisions recorded as open (see §91) before any Part B implementation begins. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §91 (and §90 for the immediately-preceding zero-layout-shift fix + first-pass audit that led to this task).

**🟡 HISTORICAL, superseded by the paragraph above — Trial Bar Zero-Layout-Shift Fix + Read-Only Trial/Subscription State Audit task, §18.EB.** Fixed a genuine ~44px layout shift (control row moving between `293.39px`/`337.39px`) by making the trial bar `position:'absolute'` inside Frame A (removed from document flow entirely) — proven 0px shift across all 4 combinations. First-pass read-only audit established: trial source of truth = `trial_ends_at`, plan source of truth = `plan`, no subscription source of truth exists at all, single resolver = `computeEffectivePlan()`. This audit directly led the Owner to commission the deeper system-wide audit in the paragraph above. `main` HEAD unchanged (`5f658f3`) throughout. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §90.

**🟡 HISTORICAL, superseded by the paragraph above — Trial Bar Owner-Reference Correction task, §18.EA — IMPLEMENTED/LIVE-VERIFIED BOTH MARKETS.** A follow-up written instruction ("Slider Location Correction") had led to merging the pre-existing Trial Notice into the Quote History control-row's own gap (documented below, now itself superseded); before that was even fully written up, the Owner sent an **explicit authoritative visual reference image**, stating it overrides any prior written instruction and is not to be reinterpreted. The image shows: Frame A → a separate narrow "track" the trial bar lives and slides within (not merged into the control row, not its own oversized row) → the control row → Frame B (table header only) → data rows. Reverted the control-row merge in `QuotesTab.jsx` and re-implemented the trial bar in `Dashboard.jsx` as a normal-flow block element between Frame A and the Quote History card — zero footprint when hidden, real content-driven height when active, naturally pushing the control row/Frame B down. Text/animations/dismiss behavior unchanged from the pre-existing component. **Live-verified using the actual dedicated HE/Local and EN/International TEST accounts** (not a page-level language toggle — confirmed this app's rendered market is tied to the account's own configuration, per the standing Market Isolation Verification Discipline): geometry byte-identical between markets (Frame A `16/262.39`, trial track `278.39/306.39`, matching Frame A's own width exactly), screenshots visually match the Owner's reference in both locales, dismiss-button proof shows the control row reclaiming exactly the trial bar's own height+margin, search remains functional, zero horizontal overflow across the full responsive matrix. Along the way, diagnosed (read-only, at the Owner's explicit request) why the documented `PROFLOW_TEST_USER1/USER2` credentials were rejected: the dev server on port 5186 (`--mode localtest`) loads `.env.localtest.local` on top of `.env`, pointing at a **different** Supabase project than those two accounts belong to — not a rate-limit or stale password. The correct pair for this dev server is `PROFLOW_TEST_LOCAL_EMAIL/PASSWORD` (HE) / `PROFLOW_TEST_INTL_EMAIL/PASSWORD` (EN), both already in `.env`; §18.T updated with this addendum. Quality: lint 0 errors, 111/111 tests (unchanged), build PASS. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval remains PENDING** — not claimed. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §89 (supersedes §88 below).

**🟡 HISTORICAL, superseded by the paragraph above — Slider Location Correction — Exact Owner Target task (the control-row-merge approach here was itself replaced within the same day once an authoritative visual reference arrived — see the paragraph above).** Critical realization: "the slider" the Owner had referenced across several prior tasks was not an undefined element requiring invention — it was the pre-existing Trial Notice component already built in `Dashboard.jsx` ("נותרו לך X ימים בתקופת הניסיון"), previously rendered inside `dash-header-bar` with a conditional `marginBottom` reserving space for it, which read visually as its own standalone row between Frame A and Frame B. The (now-superseded) fix relocated it into the Quote History control-row's own flex gap as a third conditionally-rendered child between the title+export group and the search+status group, removing the old conditional margin so Frame B moved up naturally. Live-verified at the time (ticker vertically inside the control row's own bounding box, both locales; search/export/status functional; full regression PASS). The invented toggle-switch from the task before this one was removed entirely, having been a genuine misunderstanding of which element "the slider" referred to — that specific correction (identifying the real component) remained valid; only its *target location* was subsequently overridden by the Owner's image. `main` HEAD unchanged (`5f658f3`) throughout. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §88.

**🟡 HISTORICAL, superseded by the paragraph above — Owner Visual Correction — Frame B Rounded Corners + Slider Built task.** The Owner inspected §86's result closely and found Frame B's corners rendering sharp/square despite computed style reporting `12px` — a genuine earlier measurement error, root-caused to a known CSS limitation: `border-radius` on table cells silently fails to render under `border-collapse:'collapse'`, even though the property value is still faithfully reported by `getComputedStyle`, exactly what misled the prior verification. Fixed by switching the table to `borderCollapse:'separate'` + `borderSpacing:0` — safety-tested first via a reverted DOM simulation (9 of 10 header columns byte-identical, the 10th shifted by an expected/unavoidable `0.5px` inherent to the border-model change itself, not a real geometry regression) before touching source. This time verified via actual **zoomed, cropped screenshots of all 4 corners** (not computed-style inspection alone) — confirmed visibly rounded in both locales, correctly mirrored. Separately, a real accessible toggle-switch (`role="switch"`) was **built** and placed in the control-row's gap — `position:'absolute'`-anchored so it is structurally incapable of displacing surrounding controls or creating an extra row; knob position `isHebrew`-mirrored. Real-browser OFF→ON→OFF proof (both locales): 5 independent position measurements byte-identical across all three states. **The control's function remains intentionally unwired** — its only historically-implied purpose (Expanded/Collapsed dashboard state) was explicitly abandoned by the Owner earlier, so nothing was invented in its place; disclosed transparently. Full regression re-run after both fixes, both locales, all PASS: all-column geometry, Amount place-value, Views geometry, Order ASC, typography `500/400/500`, full 8-point responsive matrix. Quality: 111/111 tests (unchanged), lint clean, build PASS. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval remains PENDING** — not claimed. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §87.

**🟡 HISTORICAL, superseded by the paragraph above — Owner New Final Dashboard Structure task — TWO STATIC FRAMES + GAP (corners were later found not to actually render rounded despite passing computed-style checks — see §87 above).** An in-progress attempt to relocate the Quote History control row into a two-state Expanded/Collapsed Option B was interrupted mid-edit and **safely reverted** (all 3 hunks in `QuotesTab.jsx` restored to the exact pre-attempt state, verified via lint/111 tests/build/live browser). The Owner then replaced that abandoned concept with a new, final, static structure: **Frame A** (`.dash-upper-section`, unchanged — already matched spec exactly: header+nav+KPI, ends after KPI) and **Frame B** (new — wraps *only* the Quote History table's `<thead>` row, identical `#E9D5FF`/`1px`/`12px` spec as Frame A so the pair reads as matched), with the Quote History controls (title/Export/search/filter) living in the gap between the two frames — confirmed in `QuotesTab.jsx`'s own existing outer card, sitting in the DOM between them, not inside either frame. Frame B built via a cross-browser-reliable per-cell border technique (each of the 10 header `<th>` cells gets its own top/bottom border that collapses into one continuous line; only the two DOM-edge cells get a border+radius on their own outer physical side, `isHebrew`-mirrored) rather than an unreliable `<tr>`-level rounded border. **Real-browser proof included an actual captured screenshot, visually reviewed in both locales** (not just computed-style inspection): Frame A `16–262`, gap `79px`, `<thead>` `341–384`, first data row flush at `384` — identical in HE and EN. Full regression re-run, both locales, all PASS: all-column geometry (Date `0px`), Amount place-value, Views geometry, Order ASC/DESC, typography `500/400/500`, full 8-point responsive matrix (Mobile/Tablet-Portrait unaffected — no `<thead>` in the card layout there). **The slider/toggle control itself was not built** — no visual/behavioral spec has been supplied in any task so far (same missing screenshot flagged earlier in this session); only its layout rule (use the gap, zero shift when toggled) is known — the gap itself is confirmed empty, stable, and ready for it. Quality: 111/111 tests (unchanged), lint clean, build PASS, browser console clean. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval remains PENDING** — not claimed. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §86.

**🟡 HISTORICAL, superseded by the paragraph above — Owner-Approved Option B Spec Correction task — CORRECTED/LIVE-VERIFIED (the Expanded/Collapsed concept that followed this was itself abandoned by the Owner — see §86 above for the final structure).** The Owner recovered the original Owner-approved Option B visual reference and found the prior task's implementation used an **unauthorized substitution** (`NEON.border`/`#e4e1ee` theme token, `14px` radius — not the Owner's actual selected values). Corrected `.dash-upper-section` to the exact authoritative spec with **no reinterpretation**: `border: 1px solid #E9D5FF` (hex-literal, not a theme token), `border-radius: 12px`, `background: #FFFFFF`, no shadow, plus a `200ms` height transition for smooth row-drop adaptation. Live-verified exact match via `getComputedStyle` in both locales. Both layout states re-verified with the new styling — State A (single-row KPI) `246px`, State B (the genuine `≤768px` KPI-grid row-drop) `300px`, Mobile `351px` — identical to the pre-correction measurements, confirming the styling-only change didn't disturb the structural height-adaptation; zero clipping/overlap/overflow throughout. Per explicit instruction not to touch the table absent an actual regression, the mandatory table re-check found **none**: HE/EN all-column geometry PASS (Date 0-0.01px, all CENTER/SPECIAL columns 0-0.01px), Amount place-value PASS, Views geometry PASS, Order ASC re-confirmed both locales, typography `500/400/500` preserved exactly — `QuotesTab.jsx` was not touched this task, only `Dashboard.jsx`'s wrapper style. Full 8-point responsive matrix re-verified, zero overflow. Quality: 111/111 tests (unchanged), lint clean, build PASS, browser console clean. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval remains PENDING** — the corrected result has not yet been shown to/approved by the Owner. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §85.

**🟢 HISTORICAL, superseded by the paragraph above — Quote History All-Column Geometry Gate + Dashboard Option B Full Verification task — DATE FIXED/LIVE-VERIFIED, OPTION B FULLY VERIFIED (Option B's styling was later found not to match the Owner's actual approved reference — see §85 above).** The Owner found a new column-geometry regression (HE "תאריך"/Date header not centered) and required it be generalized into a permanent **PROFLOW Table Column Geometry Contract** covering every visible column. Classified all 10 Desktop Quote History columns (CENTER: Client Type/Views/Order/Date/Status/Email/Actions; START: Client Name/Description — intentionally edge-aligned free text under a centered label header, a pre-existing convention, not a bug; SPECIAL: Amount, outer-box-centered/inner-place-value-anchored) and built a complete real-browser ledger for every column, both locales, *before* touching code. Found Date's body `<td>` was still edge-aligned (`isHebrew?'right':'left'`) under an already-centered header — the same mismatch class previously fixed for Order/Amount/Actions — measured `1.62px` offset in HE (over the strict ≤1px tolerance). Fixed identically (simple whole-string centering; dates are fixed-character-length, no numeric place-value complexity needed). Re-ran the full ledger after the fix: all CENTER/SPECIAL columns ≤1px (mostly exactly 0px), both locales, consistent across 5 sampled rows. Added a structural regression test (2 new tests, 111 total suite) protecting CENTER-vs-START classification going forward. Confirmed the full hard gate (all-column audit, Date, Amount place-value, Views geometry, Order ASC/DESC, typography 500/400/500) PASS before proceeding to Option B. **Option B** (already implemented from the prior task) received its outstanding full verification: found that within the Desktop-table range (>768px) neither the nav row nor the KPI grid actually wraps (980px content width has room throughout) — the genuine "row-drop" transition is the existing `≤768px` KPI-grid media query; verified the wrapper's content-driven height correctly adapts across it (`246px→300px→351px`) with zero clipping/overlap/dead-space/overflow, identically in both locales, across the full 8-point responsive matrix. Re-ran the entire column ledger once more after Option B verification — byte-identical, confirming zero collateral effect on Quote History. Quality: 111/111 tests, lint clean, build PASS, browser console clean. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). **Owner visual approval remains PENDING on both the typography TEST values and Option B.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §84 (also see §83 for the intervening exact-typography-TEST-values + emergency-stop-resolution task).

**🟡 HISTORICAL, superseded by the paragraph above — Owner Visual QA Correction — Amount Numeric Place-Value Alignment + Exact Typography Standard task — AMOUNT FIXED/LIVE-VERIFIED, TYPOGRAPHY BLOCKED (typography requirement itself later superseded by new Owner TEST values, see §83).** The Owner did **not** grant visual acceptance of the prior task and issued two concrete corrections. (1) **Amount place-value alignment — FIXED**: the prior §79 Amount-centering fix had inadvertently centered the *complete formatted currency string* as one unit, causing the cents/ones-place to drift depending on string length (`$10.00` vs `$5,625.00`) — same bug class as the Views icon-shift issue. Fixed via the identical pattern: fixed-width (`92px` Desktop) right-aligned inner box, centered within the header-centered `<td>`; Mobile's `isHebrew`-conditional alignment (which anchored the *wrong* end in HE) corrected to unconditional right-align. Real-browser proof across all 7 Owner-specified values + a stress case, both locales, Desktop+Mobile: text right-edge identical across every value, header/body-center offset ~0.01px, zero overflow. The Tabular Numeric Geometry Contract (`PROFLOW_PROJECT_CONTEXT.md` §81 Part D) was rewritten to remove the now-incorrect "Amount is an exception" line and add a mandatory verification trigger for future Amount/Views touches. (2) **Exact 50% typography reduction — BLOCKED**: computed the Owner's exact-50% targets (Client Name/KPI `600→300`, Amount `500→250`) and confirmed via direct read of `src/fonts.css` that Rubik is self-hosted with discrete per-weight files **only** at 400/500/600/700/800/900 — no 300, and 250 isn't a valid step at all. An unavailable weight would silently substitute to the nearest loaded face (likely 400), not a true 50% reduction. Per the Owner's own explicit instruction, stopped and reported rather than silently substituting — **no weight was changed**, recorded as `PROFLOW_TODO.md` item 37 pending an Owner decision among 4 disclosed options. HE/EN parity confirmed structurally intact (no locale branch on any of the four values). Regression re-verified PASS: Views geometry, Order sort (live-reclicked), email indicator, HE before-VAT tooltip, Market Separation, responsive. Option B (Soft/Light dashboard-separation mockup) recorded as the Owner's selected next direction, documented only (`PROFLOW_TODO.md` item 38), not implemented. Quality: full suite 109/109 (unchanged), lint clean, build PASS. **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §82.

**🟢 HISTORICAL, superseded by the paragraph above — Quote History Final Polish + Permanent UI Contracts + Fail-Closed Regression Framework task — IMPLEMENTED/TEST-VERIFIED/LIVE-VERIFIED (Parts A/B/C), PERMANENT POLICY (Parts D-P).** (A) Typography — audited actual weights first; Total Quotes KPI 800→600 (now matches sibling Total Revenue KPI at 600); Client Name and Order Number 700→600 (Desktop+Mobile, both locales, structurally identical, no `isHebrew` branch); Amount's weight (already 500, reduced twice in a prior/parallel round and marked "PRESERVED" in-file — evidence a sibling Agent HE/EN thread has been touching this same file outside this session's own visible history) deliberately left untouched, not reopened on a guess. (B) Views Numeric Geometry — root-caused the Owner's reported icon-shift-with-digit-count bug to `justifyContent:'center'` centering a variable-width `[number,icon]` group; fixed via a fixed-width right-aligned `tabular-nums` number sub-box + fixed-size icon; real-browser proof across all 9 required boundary values (0,1,9,10,19,99,100,637,999) in both locales shows byte-identical icon/number positions and zero movement of adjacent columns; found and fixed a genuine testing-methodology gap mid-task (CDP viewport override doesn't reliably fire the app's resize listener — was silently measuring the desktop table's own scroll wrapper instead of the true mobile card layout until an explicit `resize` dispatch was added). (C) Order Number Sorting — root-caused to `Dashboard.jsx` sorting by the row's internal UUID (`id`) instead of the real `quote_number`; fixed via a new pure, tested `getQuoteOrderSortKey()` in `src/utils/quoteNumber.js`; live-verified correct ASC then exact-reverse DESC on 30 real TEST quotes. (D-P) Formalized four new **permanent canonical contracts/process rules** in `PROFLOW_PROJECT_CONTEXT.md` §81: Tabular Numeric Geometry, ProFlow Typography Hierarchy, the consolidated 10-point Quote History Table contract, and two process rules (Component Contract Trigger, UI Definition of Done) — discoverable by every future agent/task. Quality: `QuotesTab.test.jsx` 30→57 tests, new `quoteNumber.test.js` 6 tests, full suite 109/109, lint clean, build PASS. Reused the existing §80 browser QA launchers (did not recreate them). **No commit, no push, no Production/DNS/Supabase/customer-data mutation.** `main` HEAD unchanged (`5f658f3`). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §81.

**🟡 HISTORICAL, superseded by the paragraph above — Final Quote-History Polish + Local VAT Display Density + Market-Separation Iron Rule + Browser QA Launchers task — IMPLEMENTED/TEST-VERIFIED (Parts A/B/D), PERMANENT POLICY (Part C), OPEN/DOCUMENTED-ONLY (Part E).** (A) Fixed the Quote History Desktop `#Order` header's body-cell misalignment (same header-vs-body-centering root cause as §79's Amount/Actions; ~5–6px EN / ~4–5px HE offset → effectively 0px). (B) HE/Local-only: the permanent "לפני מע"מ" line under the Amount cell is now a `title` tooltip instead of a visible line (~13px/~28% shorter row); same unchanged calculation, same unchanged HE-only guard; International/VAT/PDF/billing fully unchanged; 2 new regression tests (HE tooltip-present, EN title fully absent from DOM). (C) Wrote a new **permanent canonical Market-Separation Fail-Closed Iron Rule** — Local (HE/RTL/ILS/Israeli VAT) vs. International (EN/LTR/USD-EUR-GBP only, never ₪, never automatic Israeli tax semantics) are separate markets; HE/EN parity = mirroring UX, not translating Local business semantics into English; every agent (Owner, ChatGPT, Claude Lead, Agent HE, Agent EN, future agents) must fail closed and report "MARKET-SEPARATION CONFLICT" on any instruction that appears to cross this boundary — see `PROFLOW_PROJECT_CONTEXT.md` §80 Part C, cross-referenced `PROFLOW_TODO.md` item 34. (D) Built and fully tested two safe Windows launcher pairs at `C:\Users\sales\Desktop\ProFlow Browser QA\` (outside the repo, never committed) for starting/stopping the dedicated automation Chrome — idempotent Start, narrowly-targeted Stop verified to leave the Owner's personal Chrome (same PID/start-time) untouched across a real stop→verify→restart cycle; two real bugs found and fixed (stderr-redirect script crash; PowerShell 5.1 BOM injection into `browser-harness`'s stdin, worked around via `cmd /c echo|`). (E) Documented the Subscription/Plan Status Badge as a new open, unimplemented item (`PROFLOW_TODO.md` item 35). Quality: 30/30 `QuotesTab` tests, 82/82 suite, lint clean, build PASS. **No commit, no push, no Production/DNS/Supabase action.** `main` HEAD unchanged (`5f658f3`). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §80.

**🟢 HISTORICAL, superseded by the paragraph above — DEDICATED AUTOMATION CHROME RESTORED (2026-08-31) — see `PROFLOW_PROJECT_CONTEXT.md` §79.** Reconnection confirmed; the tab-hygiene "never close the last tab" refinement was applied and validated (1 keep-alive tab left, daemon confirmed healthy after).

**🔴 HISTORICAL, now resolved (as of 2026-08-31) — see `PROFLOW_PROJECT_CONTEXT.md` §78.** `127.0.0.1:9222` unreachable, no process carries `--remote-debugging-port`. Root cause: end-of-task cleanup closed the last tab, and a fully tab-less dedicated Chrome apparently self-terminates. **Tab-hygiene rule refinement**: never close the dedicated Chrome's very last tab — leave one idle tab as keep-alive. Owner needs to restart via the §71 procedure before further Browser Harness QA.

**🔴 PERMANENT RULE (added 2026-08-31): Browser Harness Tab Hygiene — see `PROFLOW_PROJECT_CONTEXT.md` §76.** Minimum QA tabs, reuse across locale/viewport/route, close ALL Claude-created QA tabs at end of every task (never Owner tabs) — part of task completion. Also: same-origin tabs share one Supabase session — always fresh-login before trusting a reused tab's account state.

**🟢 UPDATED 2026-08-31 (Resume Quote History Live QA task, §10.BA — LIVE-VERIFIED, LOCAL/UNCOMMITTED, read this paragraph first).** Browser Harness reconnected after Owner restarted the dedicated Chrome. Confirmed all §18.EB changes render correctly on real TEST data, both locales, full responsive matrix, zero overflow. **Found and fixed the Owner's Amount/Actions centering complaint**: `textAlign:'center'` on a header only centers the header text within the column box, not the body content — measured live an 11.76px (Amount) / 9.78px (Actions) real offset on EN, from pre-existing edge-aligned body cells. Fix: centered only those two body cells (confirmed safe first — dropdown menu positioning computes live from click position, not a fixed edge). Result: exact 0px alignment on EN, ~0px on HE, re-verified on Desktop and Tablet Landscape both locales. No other header touched. 28/28 QuotesTab tests, 80/80 suite, lint clean, build PASS. Tab-hygiene refinement validated: 1 keep-alive tab left, daemon confirmed healthy after. No commit, no push. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §79.

**🟡 UPDATED 2026-08-31 (Quote History Desktop Final Layout Pass task, §10.AZ — IMPLEMENTED/LOCAL-UNCOMMITTED, LIVE QA BLOCKED, read this paragraph first).** Continuing on the still-uncommitted tree after the prior isolated-commit attempt was correctly blocked (Client Type column doesn't exist in HEAD). **Hit the dedicated-Chrome-down blocker immediately** — completed all source-level work, but no live visual/pixel QA was possible. Implemented in `QuotesTab.jsx`: all text headers centered; 6 decorative header icons removed (functional ones — Eye, Mail, ClientTypeBadge's own icon — kept); Views header now icon-only with `aria-label` added; Email header narrowed (semantics fully audited: RED = bounced or failed-send, GREEN = sent successfully, BLANK = not yet sent — untouched); #Order compacted with a `whiteSpace:nowrap` safety net; Description widened as the primary space beneficiary. All widths are source-declared, not live-measured — reported honestly, not fabricated. 4 tests updated/added, 80/80 suite passes, lint clean, build PASS. No commit, no push. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §78.

**🟡 UPDATED 2026-08-31 (Quote History Desktop HE/EN Mirroring + Currency Invariant Documentation task, §10.AY — IMPLEMENTED/TEST-VERIFIED, LOCAL/UNCOMMITTED, read this paragraph first).** Fixed Desktop Quote History: `Client Type` + `Views` are now the first two columns from each locale's inline-start edge (right HE/left EN), contiguous — matches the Owner's explicit contract, same DOM-reorder + existing `dir` mirroring methodology as the Mobile §63 fix. **Verified via real `getBoundingClientRect()`** on real TEST data both accounts: HE outermost-right / EN outermost-left, `Views` pixel-contiguous to `ClientType` in both, confirmed twice after catching and fixing a same-origin session-contamination testing artifact. Full 8-combination responsive regression PASS (Mobile/Tablet-Portrait untouched, Tablet-Landscape correctly mirrored, zero overflow). Views=0 and long-name truncation both preserved (untouched pre-existing code). 4 new DOM-order regression tests added. 76/76 tests, lint clean, build PASS. Documented (not implemented) a new permanent invariant — International Quote Currency Immutability (`PROFLOW_TODO.md` item 33) — plus a future TEST audit item, not yet authorized. **No commit, no push** — local/uncommitted on top of the still-unpushed Hot Quote commit (`5f658f3`). All other open items preserved. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §77.

**🟢 UPDATED 2026-08-31 (Hot Quote Isolated Commit Only task, §10.AX — COMMITTED, NOT PUSHED, read this paragraph first).** Committed the already-verified Hot Quote fix to local `main`, isolated from `Dashboard.jsx`'s substantial unrelated pre-existing uncommitted work (347/-76 lines, left untouched) via selective hunk staging (`git apply --cached` on a hand-extracted single-hunk patch, not `git add`/`git add -A`) — verified via `git diff --cached` before commit to contain only the Hot Quote CSS change. **Commit `5f658f3f5b59207933e4053d8b5484b4a27e41a7`** — 2 files, `Dashboard.jsx` +13/-3 and new `Dashboard.hotquote.test.js` +37. Post-commit confirmed: remaining unstaged `Dashboard.jsx` diff reverted to exactly the original 347/-76 (nothing lost/nothing extra swept in), every other pre-existing file unchanged. **Push NOT performed** — local `main` now 1 commit ahead of unchanged `origin/main` (`e030017`). Production unchanged. Desktop Quote History HE/EN mirroring explicitly not begun. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §75.

**🟡 UPDATED 2026-08-31 (Hot Quote Fixed Geometry / No Layout Shift task, §10.AW — IMPLEMENTED/TEST-VERIFIED, LOCAL/UNCOMMITTED, read this paragraph first).** Fixed the Hot Quote card's 4-second rotation causing Dashboard layout jumps — root cause: no reserved height + no line-clamp on the message text, so varying-length real client company names changed the KPI-row height every rotation. Fix (`src/pages/Dashboard.jsx`): `minHeight: 52px` on the text column + 2-line `WebkitLineClamp` on the message — card height now fully content-independent, long text truncates instead of pushing layout. **Verified via real DOM geometry measurement** on real TEST data (both `PROFLOW_TEST_LOCAL_*`/HE and `PROFLOW_TEST_INTL_*`/EN accounts, existing TEST-only credentials read from the gitignored `.env`, never printed): card/grid bounding-box **byte-identical** before/after extreme long/short text injection, across all **8 combinations** (HE/EN × Desktop/Mobile/Tablet-Portrait/Tablet-Landscape), zero overflow anywhere. Added a narrow source-level regression test (`Dashboard.hotquote.test.js`, 2 tests — full-mount judged disproportionate for this monolithic component). 72/72 tests, lint clean, build PASS, no regression observed elsewhere. Documented (not implemented) a new Guided AI Support Entry follow-up in `PROFLOW_TODO.md` §2. All other open items preserved. **No commit, no push, no Production action — local/uncommitted, awaiting Owner+ChatGPT review.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §74.

**🟢 UPDATED 2026-08-31 (Landing Prerender Phase 4 Isolated Preview Deployment task, §10.AV — PREVIEW LIVE, READY FOR CHATGPT ACCESS TEST, read this paragraph first).** Deployed the already-QA-verified Landing prerender PoC as a fully isolated, anonymous Vercel "temporary" deployment — zero repo commit/push (built a `.vercel/output/` Build Output API v3 directory from the already-tested PoC files, entirely in the scratchpad, and ran `vercel deploy --prebuilt --temporary --non-interactive`), zero login, zero relation to the real `quotecode` Vercel project (separate `anonymous/...` project). **Preview URL: `https://temporary-snappy-apogee-mcmc26p.vercel.app`** (expires 60 min after creation — redeploy same command for a fresh window if needed). Raw HTML **PASS** on the live URL via plain cookie-less curl (byte-identical to local PoC, real content, **no Vercel login/SSO wall** — genuine anonymous public access, no Production security weakened). New Tablet QA (768×1024 portrait, 1024×768 landscape, HE+EN) plus the full HE/EN×Desktop/Mobile/Tablet smoke — all 8 combinations **PASS** on the live Preview (zero exceptions, zero overflow, CTA navigation confirmed). Root `/` still HE (unchanged placeholder, permanent decision OPEN); static title/meta/hreflang still OPEN. All Owner open items preserved. Zero repo files changed, no commit/push, no Production/DNS/Supabase change. **Status: READY FOR CHATGPT ACCESS TEST — only ChatGPT's own independent fetch can confirm that result.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §73.

**🟢 UPDATED 2026-08-31 (Resume Landing Prerender Real-Browser QA task, §10.AU — QA COMPLETE, PASS, read this paragraph first).** Owner restored the dedicated automation Chrome per §10.AT's procedure; `browser-harness --doctor` confirmed healthy. Performed genuine real-browser QA (not jsdom): HE/EN × Desktop/Mobile all **PASS** via real screenshots and real click-driven checks — FAQ accordion, billing toggle (real price changes both locales), accessibility modal, and Hero CTA (real navigation to `/dashboard?signup=true&lang=he/en`) all confirmed genuinely functional. RTL/LTR correctly mirrored. Flicker/layout-jump/duplicate-content/blank-interval: **NONE**, now real-browser-corroborated. Console/network clean except one unrelated pre-existing GA beacon abort. Video markup/attributes/src all correct both locales; actual playback verification blocked by this one dedicated Chrome instance's media pipeline (isolated via a control test — not a code/prerender defect). One pre-existing, unrelated visual overlap noted (AI-chat button over scrolling text on EN mobile), not caused by this PoC. 70/70 tests, both builds, and lint all PASS. Zero repo files changed, no commit/push/deploy. All open items preserved. **Phase 4 still NOT authorized.** Full detail: `PROFLOW_PROJECT_CONTEXT.md` §72.

**🟡 UPDATED 2026-08-31 (Restore Safe Browser-Harness Environment task, §10.AT — DIAGNOSIS ONLY, read this paragraph first, then the paragraph below for the still-accurate BLOCKED QA result this explains).** Read the installed `browser-harness` v0.1.10 source directly to determine why real-browser QA is blocked and produce an exact Owner fix procedure. **Confirmed from source, not guessed**: with `BU_CDP_URL=http://127.0.0.1:9222` set, the tool never launches Chrome itself under any path — its own error message says so verbatim, pointing to launching a dedicated Chrome with `--remote-debugging-port=<port> --user-data-dir=<dedicated dir>`. This session's `BH_REQUIRE_EXISTING_DAEMON=1` was confirmed process-local (not a persisted Windows env var), so a separately-opened PowerShell window the Owner runs themselves would run browser-harness in normal self-healing mode. Historical daemon logs confirm this exact `127.0.0.1:9222` setup worked before. Produced a verified 4-step Owner procedure: launch dedicated Chrome (exact command, confirmed Chrome path, confirmed free dedicated profile dir) → verify `:9222/json/version` reachable → bootstrap the daemon from an unrestricted shell → re-run `--doctor`. Classified responsibility per step: bootstrapping the daemon is **Owner-required, not Claude-executable even later** (would require overriding the orchestrator's fail-closed flag). A future double-click launcher script was evaluated as worthwhile but not created. **Nothing started/stopped/configured** — environment remains exactly as BLOCKED as before. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §71.

**🔴 UPDATED 2026-08-31 (Landing Prerender PoC Real-Browser QA Completion task, §10.AS — BLOCKED, read this paragraph first, then the paragraph below for the still-accurate PoC this task tried to finish verifying).** Attempted to close the one gap from §10.AR (no literal screenshots) with real browser automation. **BLOCKED, not bypassed**: no `browser-harness` daemon was available (`BH_REQUIRE_EXISTING_DAEMON=1` set by the environment); confirmed `BU_CDP_URL=127.0.0.1:9222` unreachable and the only running Chrome is the user's ordinary personal browser window (no remote-debugging flag) via read-only process inspection. Correctly did not relaunch/reconfigure the user's Chrome and did not substitute jsdom again, per explicit instruction — reported BLOCKED honestly instead of a false PASS. Quality regression re-confirmed: 70/70 tests, normal build PASS, prerender build PASS, lint clean (source). **New Owner open-item checkpoint recorded, must persist**: (A) Hot Quote needs a fixed reserved geometry slot — message rotation must never move the page/dashboard layout, truncate/clamp instead; (B) Desktop Quote History needs the same HE/EN Client-Type+Views left/right mirroring already established for Mobile (§63). Both OPEN, neither implemented. Also still open: Vercel legacy root 308, Approved Status Color TODO, P1/Session Timeout. No code fix, no commit, no push, no deploy. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §70.

**🟡 UPDATED 2026-08-31 (Landing-Page Prerender Local PoC task, §10.AR — Phases 1-3 ONLY, Owner+ChatGPT authorized; read this paragraph first, then the paragraph below for the audit that recommended this architecture).** Implemented and verified, locally and uncommitted only, the first 3 phases of the §68-recommended plan. New file `src/entry-server.jsx` (imports only existing unmodified `LandingLocal.jsx`/`LandingGlobal.jsx`; uses already-installed `react-router-dom`'s `StaticRouter` + `react-dom/server`'s `renderToString` — zero new dependencies) built via `vite build --ssr`. **Raw HTML PASS**: plain non-JS file reads of the assembled static output confirmed real HE/EN marketing content (hero/pricing/FAQ headings, correct per-locale demo-video source) for `/`, `/he`, `/en` — JS execution required for marketing text: NO. **Visual regression PARTIAL**: this session's browser-automation daemon was unavailable (no pre-provisioned daemon, fail-closed) so no literal screenshots were captured; instead ran the real built client bundle against the prerendered output via `jsdom` and found the client's fresh render is **byte-identical** to the prerendered markup for both locales — the strongest available evidence against flicker/layout-jump/duplicate content — plus correct RTL/LTR, correct video sources, zero JS errors. Pixel screenshots, video playback, mobile viewport, and interactive click-testing remain unverified (tooling gap, disclosed). Disclosed refinement needed before real implementation: `<title>`/meta-description aren't yet locale-specific in the static output. 70/70 tests PASS, lint clean (source), normal build PASS, zero existing files modified (SPA isolation confirmed). `main` HEAD unchanged (`e030017`, local+remote). **No commit, no push, no deploy, no Preview/TEST/Production/Vercel/DNS/Supabase mutation.** Architecture remains recommended; Phase 4 not authorized/not attempted. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §69 / `PROFLOW_CLAUDE_LATEST_REPORT.md`.

**🟡 UPDATED 2026-08-31 (Landing-Page Prerender/SSR Feasibility Audit task, §10.AQ — AUDIT ONLY).** Determined the narrowest safe Landing-only architecture (`/`, `/he`, `/en` only) to let ChatGPT/non-JS clients read real Landing Page content in raw HTML instead of an empty `<div id="root">`. Confirmed `main.jsx` uses `createRoot` (not `hydrateRoot`) — so a prerendered snapshot in `#root` carries zero hydration-mismatch risk. Confirmed `LandingLocal.jsx`/`LandingGlobal.jsx` are already SSR-safe as written (all browser-API usage inside `useEffect`, no data-fetching). **Disqualified** React Router's native Pre-Rendering feature for this codebase (Framework-Mode-only; this app is Declarative Mode) and the archived `prerender-spa-plugin`. **Recommended**: a small additive build step per Vite's own official SSR guide — a Node entry-server script (`renderToString` + `StaticRouter`) rendering only the Landing components for the three in-scope paths, built via `vite build --ssr`, merged into existing `dist/` output. No new dependency, no change to any authenticated route, no change to real-browser behavior. Full option matrix + unexecuted 6-phase implementation plan: `PROFLOW_PROJECT_CONTEXT.md` §68 / `PROFLOW_CLAUDE_LATEST_REPORT.md`. **Zero code/config change, zero commit, zero deploy — audit only, Owner+ChatGPT approval required before implementation.**

**🟡 UPDATED 2026-08-31 (Vercel Root Redirect Final Read-Only Verification task, same day follow-up to §10.AP — root path re-checked fresh, still stale; read this paragraph first).** Pure read-only re-check, no mutation of any kind: `quotecode.vercel.app/he` and `/en` still correctly redirect (308); canonical root still healthy. `quotecode.vercel.app/` itself still serves the same stale cached `200` (identical `Etag`, `Age` past 650s and climbing) — confirmed fresh, no cache purge/redeploy/config change attempted, per explicit instruction. **Domain consolidation: partially verified, not yet closed** — root path pending natural cache expiry or an Owner-initiated Vercel Dashboard action. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §67.

**🟢 UPDATED 2026-08-31 (Production Vercel Alias Redirect task, §10.AP — implemented, live, mostly verified) — historical for the implementation itself, which remains accurate; read the paragraph above for the current root-path status.** `quotecode.vercel.app` now permanently (308) redirects to `www.quotecodepro.com`, path+query preserved — implemented via a host-matched `vercel.json` redirect rule (genuine platform/edge-level mechanism; no authenticated Vercel Dashboard access this session, so this was the available equivalent, not an application-level React redirect). Isolated single-file commit `e030017` on `main`, deployed, confirmed via GitHub commit-status polling. Live-verified PASS on `/he`, `/en`, `/public-quote/<id>`, `/en/public-quote/<id>?lang=en`, `/dashboard` — correct 308, correct final canonical URL, path+query intact. **One disclosed anomaly**: the bare root path served a stale cached response for several minutes post-deploy (CDN propagation delay, not a rule defect — the rule itself proven correct by every other path) — expected to self-resolve, or the Owner can force a Vercel cache purge. `quotecode.vercel.app` **not** removed — redirect only. No Supabase change, no application-code change, no unrelated Vercel setting touched. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §67.

**🟢 UPDATED 2026-08-31 (Live Interactive ChatGPT Review Access task, §10.AO) — historical for the architecture-audit/key-finding itself, which remains fully accurate and relevant (the SPA-rendering finding is unaffected by the redirect); read the paragraph above first for the current pointer.** **Key finding, directly reproduced**: ProFlow's Landing Page is a pure client-rendered React SPA, zero SSR/SSG — raw HTML is just an empty `<div id="root">` + minimal `<noscript>` fallback. This session's own AI web-fetch tool, pointed at `www.quotecodepro.com/en`, reproduced the same "empty shell" symptom the Owner described for ChatGPT (saw only the page title, no real content). robots.txt/WAF/UA-blocking all checked and ruled out — clean. **This root cause is orthogonal to which Vercel domain serves the page** — `www.quotecodepro.com`, `quotecode.vercel.app`, and any new preview/review domain would all likely fail the same way, since they'd all serve the identical client-rendered bundle. Researched current Vercel Deployment Protection bypass mechanisms (Shareable Links, Protection Bypass tokens, Deployment Protection Exceptions — the last requires Enterprise/Pro-add-on, not confirmed available on this project's plan). Recommendation: use the already-prepared static review package (from §10.AN) for immediate working access; treat genuine live interactivity as needing a separate future SSR/prerendering audit, not a domain change. Full option matrix: `PROFLOW_PROJECT_CONTEXT.md` §66. **No Vercel/DNS/Deployment-Protection/code change, no deploy.**

**🟢 UPDATED 2026-08-31 (ChatGPT Landing-Page Access Resolution task, §10.AN) — historical for the deployment-URL-discovery work itself, which remains accurate; read the paragraph above first for the current pointer.** ChatGPT reported it could not access `www.quotecodepro.com` from its own browsing environment. Found the exact current Production deployment-specific URL via GitHub's Deployments API (no Vercel login needed, Vercel posts this itself): `https://quotecode-adp6tay5v-quote-code.vercel.app` — live-tested and found **blocked by Vercel Deployment Protection/SSO**, reported honestly as a failed candidate, no protection setting touched. Fallback: `quotecode.vercel.app` (the project's own existing public alias, re-confirmed byte-identical to canonical) offered as the best currently-available zero-config public URL. A full local review package (HE/EN Desktop+Mobile full-page screenshots + both genuine current demo-video files) was also prepared as a guaranteed-to-work alternative regardless of browsing-environment quirks. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §65. **No Production routing change, no Vercel/DNS/Supabase-Auth change, no commit/push/deploy.**

**🟢 UPDATED 2026-08-31 (Canonical Domain Consolidation + ChatGPT Landing-Page Access task, §10.AM) — historical for the domain-consolidation audit itself, which remains fully accurate and unimplemented; read the paragraph above first for the current ChatGPT-access pointer.** Live-verified `quotecode.vercel.app` currently serves the app directly (200 OK, no redirect at `/`, `/he`, `/en`) and is byte-identical to canonical Production (matching Vite content-hash filenames — proof, not appearance). Found two real, code-confirmed dependencies on the browser's current origin (password-reset redirect, 4 call sites; business-user Public Quote share-link generation, 3 call sites) that would break under immediate hard removal but would gracefully survive a proper redirect — the concrete basis for the recommendation: **staged redirect, then later removal** (not implemented). Every other domain reference (SEO tags, sitemap, transactional emails, signup confirmation) is already hardcoded to canonical, zero risk. Vercel CLI unauthenticated this session — actual Vercel Domains config could not be verified directly, disclosed as a limitation. ChatGPT landing-page access recommended via the canonical Production URLs directly (same-deployment, proven) plus the two public demo-video URLs (both live-verified). Full detail: `PROFLOW_PROJECT_CONTEXT.md` §64. **No Vercel/DNS/Supabase-Auth/`vercel.json` change, no commit/push/deploy.**

**🟢 UPDATED 2026-08-31 (Mobile-Only HE/EN Directional Mirroring Fix task, §10.AL) — historical for that Mobile-specific fix; read the paragraph above first for the current pointer.** The Owner found EN Mobile Quote History's metadata order ("Client Name → Views → Client Type" from the left) was a literal sequence-reversal of HE's order, not a true mirror. Fixed: both languages now show the identical semantic sequence (Client Type → Views → Client Name) from their own inline-start edge, via a single non-language-conditional DOM order + the existing `dir` attribute. Verified with a direction-aware script comparing HE/EN inline-start positions directly (not raw coordinates): 6/6 width×language combinations identical, zero mismatches, varied name lengths and view counts. Desktop confirmed untouched (edits isolated to the pre-existing Mobile code block; live re-measurement unchanged). **New permanent rule** (`PROFLOW_PROJECT_CONTEXT.md` §63): HE/EN Directional Symmetry — semantic order preserved from each language's inline-start, never reversed between languages; independent per-language PASS is insufficient without direct cross-locale position comparison. Root cause: an earlier task's own explicit Owner instruction specified the reversed-sequence version, followed exactly as written — not a verification failure. 70/70 tests pass, lint clean, build succeeds. **No commit/push/deploy/mutation, no Desktop change.**

**🟢 UPDATED 2026-08-31 (P1 Full Reconciliation + Session Timeout Forensic Audit task, §10.AK) — historical for that audit specifically; read the paragraph above first for the current pointer.** Key finding: **no ProFlow application-level session timeout exists anywhere in the codebase** — the Supabase client uses pure library defaults, `signOut()` has exactly one caller (the explicit Sign Out button), and no timer/idle-detection code touches auth state anywhere in `src/`. TODO item 8 remains accurately "audit + decision required," matching the Owner's own recollection that it was never authorized. Root cause of the Owner-observed timeout-like behavior is genuinely UNKNOWN from code alone (candidates: a normal failed Supabase token refresh, or a Supabase-project-level Auth session policy configured outside this repo — neither confirmable without further explicit authorization). A full P1 item ledger and uncommitted-application-file inventory were produced (see `PROFLOW_PROJECT_CONTEXT.md` §62 and this task's Claude report). Behavioral-lock rules (§54 addendum, §61) confirmed present and coherent. **No application/DB change, no TEST/Production mutation, no commit/push/deploy, no P1 item implemented.**

**🔴 UPDATED 2026-08-31 (Critical Signature Security Production Promotion task, §10.AJ, P0/CRITICAL) — historical for the signature-deployment task specifically; read the paragraph above first for the current pointer.** The §10.AI signature-authorization fix is now **DEPLOYED to Production**, isolated from every other carried-forward change: Fresh Local State established first (`main` at `17ac4d3a...` before this task); the security property re-confirmed fresh on TEST immediately before promotion; a pre-change Production schema dump confirmed the known vulnerable baseline; the migration applied in isolation (11 other pending local migrations temporarily moved out of the migrations folder, `--dry-run`-confirmed to exactly one file, applied, then restored); ground-truth verified via a direct migration-ledger read (exactly one row) and a full before/after Production schema diff (isolated to the one function). Isolated application commit `b5583e59d4dab0b2c7741df8fdc1110f32b4d972` on `main` — exactly one file, +93/-0 — pushed to `origin/main`, confirmed via the GitHub API. Triggers a Vercel rebuild (disclosed, §17.E) but the deployed site is functionally unchanged. **No real Production customer signature was created for verification.** No unrelated work (Mobile/UI/width/Trial-Notice/Email-column/P1/Session-Timeout/Landing-Page/Vercel-routing/Admin) was included. New permanent process addendum carried forward: OWNER-APPROVED/LOCKED protects observable behavior, not merely a file — see `PROFLOW_PROJECT_CONTEXT.md`'s new §54 addendum. Full detail: §60/§61 there.

**🟡 UPDATED 2026-08-31 (Signature Fix + Mobile Cleanup + Email Audit + Lock Final Width task, §10.AI) — historical for its TEST-only signature framing specifically (superseded by §10.AJ directly above; its width/Mobile/Email findings remain current, unaffected by the Production promotion); read the paragraph above first for the current pointer.** Four scopes, all Owner + ChatGPT authorized: **(A) Signature fix implemented on TEST** — `public_approve_quote` now rejects any authenticated ProFlow business account (reused `business_settings.user_id`, not a new identity table), applied via a new migration while the CLI was linked to `quotecode-test` only (relinked to Production immediately after). Full regression matrix live-verified: anonymous customer signing still works end-to-end (real UI, both markets); the quote's own owner and a different business account are both rejected via direct RPC; malformed-payload/already-approved/post-approval-immutability all unaffected. No Production action. **(B) Desktop width LOCKED** — the Owner visually approved §10.AH's `980px` canonical width ("DO NOT CHANGE IT"); moved from TEST-VERIFIED to OWNER-APPROVED/LOCKED, no code change needed. **(C) Mobile metadata rebuilt as a fixed CSS Grid** — the Owner rejected an initial flex-based reorder on live visual review (long Client Names shifted Client Type/Views position between cards); the grid version is live-verified fully stable (identical X-position per field across 8 varied-length rows, all 3 widths, both markets), with long names truncating via ellipsis instead of wrapping. **(D) Mobile Sort control added** (Owner mid-task addition, new permanent rule: responsive transformations must preserve functional capability, not merely visible content) — reuses Desktop's exact `handleQuoteSort` state, live-verified correct ascending/descending resort, both markets. **(E) Email column audited** — confirmed real function (persisted bounce state + ephemeral session-only send-success indicator), preserved, not removed. Full detail: `PROFLOW_PROJECT_CONTEXT.md` §60/§61. No application commit/push, no Production mutation, no Vercel deploy, no Admin work.

**🟡 UPDATED 2026-08-30 (Critical Signature Forensic Audit + Final Canonical Width Alignment + Quote History Density task, §10.AH) — historical for its audit-only signature framing and its width framing specifically (both superseded by §10.AI directly above); read the paragraph above first for the current pointer.** Two scopes: **(A) CRITICAL, audit-only** — a read-only forensic trace of customer-signature authorization found a real, TEST-reproduced gap: `public_approve_quote` (the RPC both PublicQuote.jsx/PublicQuoteEn.jsx call to persist a customer signature) has no caller-identity check at all — only the frontend's `is_owner_viewing` flag hides the button, which does not stop a direct RPC call. Live-reproduced on TEST (Owner-authorized): called the RPC directly as an authenticated business user against their own quote — succeeded (HTTP 204), `status`/`signature` persisted. Documentary evidence (the "captured live from Production" migration file) indicates Production carries the identical unprotected definition. No fix implemented — audit only, findings recorded in `PROFLOW_PROJECT_CONTEXT.md` §58. **(B) Width/density** — the Owner rejected all prior width experimentation (1440px/1320px/72vw/85vw) and decreed the authenticated app must use Public Quote's own existing 980px canonical width exactly, with the table adapting to fit rather than the width expanding for the table. Implemented: `--pf-dashboard-desktop-content-width` now equals `--pf-desktop-content-width` (980px) directly; Quote History table columns/padding narrowed to fit with zero overflow, Actions fully visible, both markets, all four breakpoints; Desktop row density reduced (row height 51px→47px HE / 38px→34px EN); an incidental Mobile-width side-effect from the prior task's `vw`-based token (27-31px gutter instead of the claimed 15px) was discovered and corrected as a consequence (now a clean 6px). Full detail in `PROFLOW_PROJECT_CONTEXT.md` §59. Per §54, none of the new width/density values are Owner-LOCKED. Verdicts: signature audit findings recorded (not a fix); width/density `IMPLEMENTED, TEST-VERIFIED, AWAITING OWNER VISUAL APPROVAL`. No application commit/push, no Production mutation, no Vercel deploy, no Admin work.

**🟡 UPDATED 2026-08-30 (Owner Visual QA Correction task, §10.AG) — historical for that task's own width framing specifically (its `min(1320px,85vw)` desktop-width value and its Mobile-gutter measurement were both superseded by §10.AH directly above); read the paragraph above first for the current pointer.** The most recent workstream is §10.AG: the Owner corrected the earlier HE/EN width-discrepancy report (no code-level difference exists, confirmed independently) and clarified the real issue is that the shared Desktop width itself is too wide. New Permanent Requirement §56, **ProFlow Global Surface Width Contract** — one canonical width strategy should eventually govern all equivalent full-page surfaces (RTL/LTR/language/market are not functional-reason exceptions). Desktop width corrected to a viewport-relative `min(1320px, 85vw)` after a narrower `72vw` candidate was live-tested and found to regress the earlier Actions-clipping fix. Mobile Quote History width utilization fixed (compounded ~30px gutter → 15px). Amount typography refined again (row `600→500`, Total Revenue `800→600`). Public Quote confirmed **UNCHANGED** — future alignment to the same contract explicitly deferred, requiring separate Owner approval. All new values recorded as IMPLEMENTED/TEST-VERIFIED/AWAITING OWNER VISUAL APPROVAL, explicitly not LOCKED. Verdict `OWNER QA CORRECTION: PASS`. Preceded by §10.AF (Owner-Locked Regression Rule + UI QA + Vercel Redirect Audit), §10.AE (Structured Quote Architecture Correction + Six TEST Personas [BLOCKED, unresolved] + Landing Page Access Audit), §10.AD (Trial Expiration → FREE), §10.AC (Invoice Readiness + Mixed Pricing docs), §10.AB (TEST Subscription Personas Audit), §10.AA (Item 27), §10.Z (Item 26 Owner QA Micro-Fix), §10.Y (Item 26 Final UI Refinement), §10.X (Continuity Sync Failure Audit + Recovery). **NEXT ACTION**: the §17.J documentation sync for §10.AG itself, plus remote GitHub read-back verification, is the pending action at the end of this same task — see `PROFLOW_HANDOFF.md` §18 step (44). Otherwise awaiting Owner visual review/approval of the new geometry and typography, plus the still-unresolved six-TEST-persona creation blocker from §10.AE; nothing has been committed/pushed/deployed across any of these tasks. See §10.X/§10.Y/§10.Z/§10.AA/§10.AB/§10.AC/§10.AD/§10.AE/§10.AF/§10.AG for full detail.

**🟢 UPDATED 2026-08-30 (TEST Acceptance Readiness Package 1 task) — historical for Package 1 specifically, read the paragraph above first for the current pointer.** The most recent workstream is §10.V, "TEST Acceptance Readiness — audit then large multi-feature Package 1 implementation." Current state: a large TEST-only feature set (Attachments fix, CSV button color, Default Terms bug fix, Item 23 Warranty, Public Quote bottom actions, Trial notification redesign, mobile signature-pad scroll fix, mobile horizontal-overflow fix) is implemented and TEST-verified by both Agent HE and Agent EN independently plus Claude Lead, all lint/test/build-clean, **none of it committed/pushed/deployed**. `main` HEAD unchanged throughout. A real-device Owner report of the "לידי"/Attn fields disappearing was investigated live and found to be **not a code regression** (fields fully intact and correctly rendered, both markets, both viewports) — most likely a stale browser HMR state. **NEXT ACTION**: awaiting Owner + ChatGPT review of the full Package 1 result before any commit/push/Production step. See §10.V for full detail. The paragraph immediately below (Fix Stale Phase 3 Status) is now HISTORICAL for the earlier Full Runtime TEST Environment Build workstream specifically: The most recent workstream is the Full Runtime TEST Environment Build (§10.J) — currently at: **both Phase 2 (Files 00/01/02) and Phase 3 (File 03/Storage) applied and verified PASS on `quotecode-test`** — see §10.J's two "UPDATED 2026-08-30" paragraphs for full detail. `quotecode-test` now carries the complete base package (Files 00-03, all applied and verified). `main` HEAD unchanged at `17ac4d3a...` throughout this entire workstream — everything synced via `proflow-continuity` only. Two documentation-only backlog items were also recorded: item 23 (Warranty section requirement) and item 24 (`storage_path` bug, pre-existing, not fixed). **NEXT ACTION**: the next infrastructure phase (if any) is currently **undefined** — no name/number for one exists in any of the six files — so there is nothing further to await review of yet; Owner + ChatGPT review remains the standing gate before any Edge Function deployment, Auth configuration, TEST user creation, Vite rewiring, the `storage_path` fix, the Warranty implementation, or any Production action. This does not change or reopen anything below about the Quote-Number/HE-EN release candidate, which remains its own separate, still-accurate state as of its own last update (the paragraph immediately below is now HISTORICAL — accurate as of the retimestamp stage, superseded by this paragraph for "what is current right now"):

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

## 15. New-chat startup instruction (corrected 2026-08-30 — Final One-Line Bootstrap Documentation Cleanup task; supersedes the long five-document prompt previously recommended here, which predates and is now superseded by the Permanent One-Line Bootstrap Contract, `PROFLOW_PROJECT_CONTEXT.md` §0.D)

When a new ProFlow chat begins (ChatGPT, Claude, or otherwise), the Owner
does **not** need to paste a long bootstrap prompt. The recommended, normal
Owner action is simply the permanent one-line trigger:

> **"המשך פרויקט ProFlow"**

This single phrase invokes the full Permanent One-Line Bootstrap Contract
(`PROFLOW_PROJECT_CONTEXT.md` §0.D) — concisely, the receiving session must:

1. Read all **six** canonical files — `PROFLOW_ARCHITECTURE.md`,
   `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_CLAUDE_LATEST_REPORT.md`,
   `PROFLOW_HANDOFF.md`, `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_TODO.md` —
   **directly from `ref = proflow-continuity`** on GitHub
   (`quotecode-dev/quotecode-clean`), never from `main`, a stale upload, or
   memory.
2. **Independently reconcile** them — cross-check actual current content,
   never trust a prior session's own PASS/ledger blindly (§0.E).
3. If any of the six cannot be read, **STOP** immediately and report exactly
   `CONTINUITY BOOTSTRAP INCOMPLETE` (§0.C) — no guessing, no partial resume.
4. If reconciliation surfaces a material contradiction that prevents reliable
   continuation, report `BLOCKED` rather than proceeding on an assumption.
5. Only then report current project state to the Owner and continue — no
   implementation change proposed until the state is actually understood.

This one-line trigger is recognized identically to the pre-existing Hebrew
magic phrase ("ProFlow — תמשיך מהנקודה האחרונה") and any unambiguous English
equivalent — none of the three is deprecated; all invoke the same contract.
The older long prompt this section previously recommended is no longer
necessary and should not be pasted going forward — the one-line trigger
above is the correct normal Owner action for any new ProFlow chat.

Separately, "קלודי סיים - תקרא את הדוח האחרון" remains a distinct, narrower
trigger for retrieving Claude's newest task report specifically — see §15.A.
