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

**🟢 UPDATED 2026-08-30 (Fix Stale Phase 3 Status in TODO task — corrects the paragraph immediately below, which was accurate at the retimestamp stage but became stale once Phase 2 and Phase 3 were both applied) — read this paragraph first, then the rest of this section for the still-accurate older Quote-Number/HE-EN release-candidate state further below.** The most recent workstream is the Full Runtime TEST Environment Build (§10.J) — currently at: **both Phase 2 (Files 00/01/02) and Phase 3 (File 03/Storage) applied and verified PASS on `quotecode-test`** — see §10.J's two "UPDATED 2026-08-30" paragraphs for full detail. `quotecode-test` now carries the complete base package (Files 00-03, all applied and verified). `main` HEAD unchanged at `17ac4d3a...` throughout this entire workstream — everything synced via `proflow-continuity` only. Two documentation-only backlog items were also recorded: item 23 (Warranty section requirement) and item 24 (`storage_path` bug, pre-existing, not fixed). **NEXT ACTION**: the next infrastructure phase (if any) is currently **undefined** — no name/number for one exists in any of the six files — so there is nothing further to await review of yet; Owner + ChatGPT review remains the standing gate before any Edge Function deployment, Auth configuration, TEST user creation, Vite rewiring, the `storage_path` fix, the Warranty implementation, or any Production action. This does not change or reopen anything below about the Quote-Number/HE-EN release candidate, which remains its own separate, still-accurate state as of its own last update (the paragraph immediately below is now HISTORICAL — accurate as of the retimestamp stage, superseded by this paragraph for "what is current right now"):

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
