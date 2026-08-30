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
