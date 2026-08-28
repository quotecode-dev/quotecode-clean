# PROFLOW — PERSISTENT PROJECT CONTEXT

## ⚠️ NEW CHAT / SESSION: READ THIS ENTIRE FILE FIRST

**THEN READ `PROFLOW_CHAT_HANDOFF.md`** — the ChatGPT continuity snapshot (working relationship, accepted product/visual state, current resume point). It does **not** replace any canonical technical document below, and it does **not** by itself prove the current filesystem/git/runtime state — see §17.B.

**THEN READ `PROFLOW_ARCHITECTURE.md`.**

**THEN READ `PROFLOW_HANDOFF.md`.**

**THEN READ `PROFLOW_TODO.md`** — the authoritative living backlog; identify the current owner-approved priority before beginning any workstream.

**DO NOT PROPOSE OR EXECUTE PROJECT CHANGES UNTIL ALL FIVE ARE UNDERSTOOD AND THE LOCAL WORKING TREE HAS BEEN FRESHLY VERIFIED** (§17.B).

**RESUME FROM THE CURRENT EXACT CHECKPOINT (§28 below) — DO NOT RESTART FROM ZERO.**

**DO NOT ASK THE PROJECT OWNER TO RE-EXPLAIN INFORMATION ALREADY DOCUMENTED HERE OR IN `PROFLOW_HANDOFF.md`.**

This file is the project's **persistent operational memory across chat sessions** (originally written to survive a ChatGPT session boundary; it applies identically to any AI session working on this project, including Claude Code). It must NOT assume access to any previous conversation. Everything a new session needs to continue correctly must be findable here, in `PROFLOW_HANDOFF.md`, or in `PROFLOW_TODO.md` (for backlog/work-item status) — never only in a chat transcript that no longer exists.

This is now a **permanent ProFlow workflow requirement**, not a one-time migration. See §30 (Documentation Maintenance Rule) and the Continuity Protocol immediately below.

---

## MANDATORY CONTINUITY PROTOCOL

This protocol is not optional guidance — it is a standing operating rule for every session that touches this project.

### 1. Required Reading Order

Every new session must, before proposing or executing anything:
1. Read this entire file (`PROFLOW_PROJECT_CONTEXT.md`) — the Permanent Bootstrap Protocol itself.
2. Read `PROFLOW_CHAT_HANDOFF.md` — a ChatGPT continuity snapshot only; see §17.B for its role and limits before relying on it.
3. Read `PROFLOW_ARCHITECTURE.md` in full.
4. Read `PROFLOW_HANDOFF.md` in full.
5. Read `PROFLOW_TODO.md` in full — the authoritative living backlog (see §35).
6. Obtain a **FRESH** local/Claude working-tree check (`git status`, `git log`, current branch/HEAD vs. `origin`) and reconcile it against the documents above — see §17.B and §18. The documentation snapshot alone is never proof of current state.
7. Locate the **CURRENT EXACT CHECKPOINT** (§28 below).
8. Identify all **OPEN / PENDING** items (§24, and the full backlog in `PROFLOW_TODO.md`).
9. Identify the current **authorization state** for whatever work is in flight (§9 of this protocol).
10. Identify the **exact next proposed action** (§29 below) and the current **owner-approved priority** in `PROFLOW_TODO.md` — do not begin another backlog item merely because it is open.
11. Understand the **permanent product/safety rules** (§4, §18, §19, §36, §37, §38, and Part C-derived rules below) before proposing any change.
12. Continue maintaining this file, and `PROFLOW_HANDOFF.md`/`PROFLOW_ARCHITECTURE.md`/`PROFLOW_TODO.md` where appropriate, throughout its own session — see §0.A (Document Hierarchy) and §35 (Backlog Continuity Rule) below.

### 0.A Document Hierarchy & Conflict Resolution

Five permanent documents, each with a distinct role — do not blur them:

1. **`PROFLOW_PROJECT_CONTEXT.md`** (this file) — current operational truth: rules, owner decisions, current state, authorization state, open issues, the exact current checkpoint.
2. **`PROFLOW_CHAT_HANDOFF.md`** — a ChatGPT-conversation continuity snapshot: working relationship, accepted product/visual state, current resume point. It exists to orient a brand-new ChatGPT conversation quickly; it supplements documents 1/3/4/5 and never overrides them, and it is never proof of current filesystem/git/runtime state by itself (see §17.B).
3. **`PROFLOW_ARCHITECTURE.md`** — current technical/product architecture: how the system is built and intended to behave.
4. **`PROFLOW_HANDOFF.md`** — detailed engineering history: audits, incidents, migrations, fixes, verification evidence, chronology.
5. **`PROFLOW_TODO.md`** — the authoritative living work backlog/roadmap: every known work item, its status, dependencies, and verification requirements (see §35).

**If the five documents appear inconsistent**, resolve as follows:

- **A.** First determine whether the difference is *current state* vs. *historical record* — a lot of apparent conflict is just one document describing an earlier state that has since changed.
- **B.** For current authorization, current owner instructions, current workflow, the current checkpoint, and what is/isn't approved — **`PROFLOW_PROJECT_CONTEXT.md` is authoritative.**
- **C.** For current technical implementation claims — do **not** blindly trust either `PROFLOW_PROJECT_CONTEXT.md` or `PROFLOW_ARCHITECTURE.md` merely by precedence; verify against the repository or live evidence.
- **D.** `PROFLOW_HANDOFF.md` preserves historical evidence — it is never rewritten merely to make old sections match current architecture.
- **E.** If `PROFLOW_PROJECT_CONTEXT.md` and `PROFLOW_ARCHITECTURE.md` both claim current technical truth and genuinely conflict, repository/live evidence decides — not document priority.
- **F.** `PROFLOW_CHAT_HANDOFF.md` is never authoritative on its own for architecture, backlog status, or historical claims — documents 1/3/4/5 govern those. It is useful only as a fast orientation snapshot and must always be verified against a fresh local working-tree check before it informs any implementation decision (§17.B).

### 2. Resume — Do Not Restart

A new session is a **continuation** of the existing ProFlow project, not a fresh engagement. It must not:
- restart architecture analysis from scratch when a completed audit already exists;
- ask the owner to repeat documented history;
- redo a completed audit without a new, specific technical reason to doubt it;
- reopen a settled decision casually;
- propose work that is already completed;
- confuse a deliberately-preserved behavior (see §26, Owner Corrections) with a bug.

### 3. Continuity Owner

The session currently working with the project owner is the **CONTINUITY OWNER**. It is responsible for keeping this file synchronized with actual project state for the duration of its own conversation. This responsibility must never be placed on the project owner — the owner should never need to reconstruct what happened.

### 4. Self-Perpetuating Continuity Rule

This is not a one-time documentation migration. Every future session inherits responsibility for maintaining this same mechanism:

```
SESSION A → updates this file → SESSION B reads it → continues from exact
checkpoint → updates this file → SESSION C reads it → continues... (indefinitely,
unless the project owner explicitly changes this rule)
```

### 5. When This File Must Be Updated

After every meaningful: user instruction, product decision, architecture decision, correction from the project owner, audit result, discovered bug, disproven bug, verification result, implementation, manual Supabase operation, DB change, Auth change, test result, regression result, rollback, deployment, role/permission decision, domain decision, agent report, change in authorized scope, or change in project status/next-step —

ask: **"Would a completely new session need this information to continue correctly?"**

If YES, update this file before finishing the current task.

### 6. Coding-Agent (e.g. Claude) Documentation Responsibility

For future meaningful implementation/audit tasks, the coding agent should normally be given an explicit documentation-continuity instruction: *if the task changes project state, verified facts, decisions, implementation status, test results, open issues, authorization status, or next step, update `PROFLOW_PROJECT_CONTEXT.md` before finishing and update `PROFLOW_HANDOFF.md` where appropriate.*

However: the coding agent is the repository-writing tool. The human/orchestrating session working with the project owner remains responsible for **recognizing what must be preserved** and for **ensuring continuity is actually maintained**. Do not assume the coding agent alone will remember this rule across its own separate sessions — it must be reminded, and this file's own existence is the backstop if it isn't.

### 7. Project-Owner Corrections Are Important Knowledge

When the project owner corrects a prior understanding of intended behavior, business logic, historical context, architecture, workflow, UI requirements, or testing expectations — and that correction can affect future reasoning — it must be preserved (see §26). A future session must never repeat a misunderstanding that has already been corrected once.

### 8. Fact / Assumption / Design Separation

Every important statement in this file (and in `PROFLOW_HANDOFF.md`) must remain classifiable as one of:

- **LIVE VERIFIED FACT** — confirmed via a live database/Supabase/Auth check in the current or a recent session.
- **REPO VERIFIED FACT** — confirmed by directly reading the current repository source.
- **OWNER-OBSERVED FACT** — the project owner personally checked something (e.g., in Supabase Studio) and reported the result; not independently re-verified by an agent.
- **DOCUMENTED HISTORICAL FACT** — recorded in `PROFLOW_HANDOFF.md` from earlier work, not re-checked this session.
- **DESIGN DECISION** — an approved architectural choice, not yet implemented, or implemented and verified.
- **PROPOSED DESIGN** — a candidate approach under review, not yet approved.
- **ASSUMPTION** — believed true but not verified; must be labeled as such, never silently promoted.
- **UNKNOWN / REQUIRES VERIFICATION** — an open gap, explicitly named as such rather than guessed at.

**Never silently promote an assumption to a fact.**

### 9. Authorization Survives Chat Boundaries

Opening a new session does **not** reset authorization. Track work through these exact states, and a new session must inherit whatever state existed when the previous session ended — never re-ask for approval already given, and never assume approval that was never given:

`PROPOSED → AUDITED → APPROVED FOR PREPARATION → APPROVED FOR EXECUTION → EXECUTED → VERIFIED → DEPLOYED`

### 10. Current Exact Checkpoint (see §28 for the live instance)

This file must always contain a clearly visible checkpoint answering: what are we working on and why; what was the last action actually performed and its result; what did the coding agent last report; what did the project owner manually do; what is currently live vs. only proposed vs. approved vs. explicitly NOT approved; what is the exact next step and does it need owner approval; what must not happen yet; are there active STOP conditions. A new session should be able to answer: *"Where exactly were we five minutes before the previous session stopped?"*

### 11. Do Not Let This File Become Stale

This file represents **current operational truth**. When a state transitions (`OPEN → FIXED`, `PROPOSED → APPROVED`, `APPROVED → IMPLEMENTED`, `IMPLEMENTED → VERIFIED`), update it here. If an assumption is disproven, supersede it explicitly — never leave two contradictory statements without marking which one is current.

### 12. Do Not Simply Append Forever

This is a **clean current-state document**, not a chronological log. Detailed chronology and full audit trails belong in `PROFLOW_HANDOFF.md`. This file should preserve just enough history to avoid repeating past mistakes, while keeping current truth immediately understandable at a glance.

### 13. Manual Owner Actions

Record important manual actions the project owner personally performed: where it occurred, what changed, the resulting state, what was verified, and what was intentionally left unchanged. **Never attribute an owner's manual action to the coding agent, and vice versa** — see §27/§E for the current example (the Supabase URL Configuration change).

### 14. Test Accounts

Document purpose, market, role, relevant current state, and special reproduction states for every TEST account (§22). **Never store passwords, JWTs, service-role keys, tokens, or any other secret value here.** Environment variable *names* may be documented; secret *values* must never appear in this file.

### 15. Chat-Limit Emergency Rule

If a conversation appears likely to end or migrate to a new session, **updating this continuity documentation takes priority over starting another non-essential implementation step.** The project owner must never again be forced to reconstruct a long conversation from memory.

### 17. New-Session GitHub Bootstrap Path (added P0.3; corrected to five documents — see PROFLOW_HANDOFF.md's latest checkpoint)

**This protocol requires FIVE documents.** Earlier versions required first three, then four; each omission was a confirmed root cause of a real-world continuity failure (a fresh session resumed from a stale or incomplete checkpoint instead of current state). `PROFLOW_CHAT_HANDOFF.md` is the fifth — a ChatGPT continuity snapshot, not a replacement for any of the other four (see §17.B for its role and limits).

**IF** a GitHub connector/integration with read access to `quotecode-dev/quotecode-clean` is available to a new session:

1. Access the repository through that GitHub integration.
2. Read the **current default-branch** versions of, in **exactly** this order:
   1. `PROFLOW_PROJECT_CONTEXT.md`
   2. `PROFLOW_CHAT_HANDOFF.md`
   3. `PROFLOW_ARCHITECTURE.md`
   4. `PROFLOW_HANDOFF.md`
   5. `PROFLOW_TODO.md`
3. Locate the **CURRENT EXACT CHECKPOINT** in `PROFLOW_PROJECT_CONTEXT.md` (§28) — treat it as authoritative over any earlier/historical section that merely appears first in file order (see item 18a below).
4. Identify the **current owner-approved priority** from `PROFLOW_TODO.md`'s "Current Recommended Execution Order."
5. Identify the **current authorization state** — what is approved, what is working-tree-only, what is committed/pushed, what is explicitly NOT authorized — from the checkpoint itself.
6. Obtain a **fresh local/Claude working-tree check** and reconcile it against all five documents before proposing or executing anything (§17.B, §18).
7. Resume from that checkpoint. **Do not restart old work, and do not select an older historical section (e.g. an early P0.x architecture-audit entry) merely because it appears earlier in the document.**
8. Do not ask the project owner to reconstruct information already documented.
9. Treat the repository versions as **the source documents** — not an older uploaded copy, and not a chat-memory reconstruction.

**IF** GitHub connector access is not available: the project owner may provide/upload the five files manually. Use the identical reading order and steps 3-9 above.

### 17.A Magic Phrase Continuity Contract (added — emergency continuity repair)

The owner's standing trigger phrase for resuming this project in **any** AI session (ChatGPT, Claude, or otherwise) is exactly:

> **"ProFlow — תמשיך מהנקודה האחרונה"**

Any session that receives this phrase (or an unambiguous equivalent, e.g. "ProFlow — continue from where we left off") must, before doing anything else:

1. **Not** answer from chat memory alone, and **not** reconstruct the project from remembered conversation fragments.
2. If GitHub read access is available, immediately read the **current default branch** of `quotecode-dev/quotecode-clean`.
3. Read, in order: `PROFLOW_PROJECT_CONTEXT.md` → `PROFLOW_CHAT_HANDOFF.md` → `PROFLOW_ARCHITECTURE.md` → `PROFLOW_HANDOFF.md` → `PROFLOW_TODO.md` (item 17 above).
4. Locate the **CURRENT EXACT CHECKPOINT** (§28 of `PROFLOW_PROJECT_CONTEXT.md`) and the **current owner-approved priority** (`PROFLOW_TODO.md`'s execution order).
5. Prefer the newest explicit current-state section over any historical/earlier section — never select an old P0.x or similarly-numbered historical entry as "the current checkpoint" merely because it appears earlier in a file.
6. Distinguish **committed/pushed GitHub state** from any **newer uncommitted working-tree state** that may only be documented, not yet pushed (item 18 below), and treat `PROFLOW_CHAT_HANDOFF.md` as a snapshot that itself may already be behind the working tree (§17.B).
7. Return a **concise resume report** covering: exact current workstream; last completed action; current working-tree state if documented; current owner-approved priority; open/blocking questions; the exact next safe action; and what is explicitly **not** authorized.
8. **Do not execute or change anything** until the owner confirms the resume summary is correct.

This contract exists so the owner never has to type more than the magic phrase itself — the burden of doing this correctly belongs entirely to the AI session, not to a longer prompt the owner must remember.

### 17.B PROFLOW_CHAT_HANDOFF.md — Role and Limits (added — five-document bootstrap update)

`PROFLOW_CHAT_HANDOFF.md` is a dedicated ChatGPT continuity snapshot — working relationship, accepted product/visual state, and the current resume point — written so a brand-new ChatGPT conversation can orient itself quickly. It supplements, and never replaces, the four canonical technical documents (§0.A): it is not authoritative for architecture, backlog status, or detailed history — `PROFLOW_ARCHITECTURE.md`, `PROFLOW_TODO.md`, and `PROFLOW_HANDOFF.md` remain authoritative for those respectively.

**Golden rule 1 — CHAT HANDOFF ≠ FRESH LOCAL STATE.** It is a snapshot, not a live view. It must never be assumed to prove the current filesystem/git/runtime state — the local working tree may already contain newer uncommitted work than the latest documentation commit (this reinforces, and does not replace, the Working-Tree-vs-GitHub Freshness Rule in §18).

**Golden rule 2 — read it first, then verify against the fresh local working tree.** A new session should read `PROFLOW_CHAT_HANDOFF.md` early, right after this file (§1, §17) — it is a fast, high-value orientation. But it must still obtain a fresh local/Claude working-tree check (`git status`, `git log`) and reconcile any difference before proposing or executing any implementation action. Reading the chat handoff is never equivalent to confirming the current state.

### 18. Working-Tree-vs-GitHub Freshness Rule (added P0.3)

A session must distinguish between (A) repository **working-tree** state as reported by the coding agent (Claude) during a task, and (B) the latest **committed and pushed** GitHub state that a GitHub connector can actually read. **A GitHub connector reading a file does not prove that recently-discussed local changes are already in GitHub.** Never claim GitHub contains a documentation update until that update has actually been committed and pushed — confirmed by an explicit `git status`/push report, not assumed. When a coding-agent report says files are modified/untracked but not committed, a session with GitHub read access must understand that GitHub may still expose the **previous, older** version of that file, and a fetch returning a 404 for a brand-new not-yet-committed file (or stale content for a modified-but-uncommitted one) is **expected, correct connector behavior — not a connector failure.**

### 19. GitHub Connector Write-Authorization Restriction (added P0.3)

A GitHub read/write connector does **not** change this project's conservative safety model. Even if a connector technically exposes write-capable actions (file edits, commits, branches, merges, pushes), **do not use any of them** — do not modify repository files, create files, delete files, create commits, create branches, merge, push changes, or perform any other GitHub write operation — **unless the project owner separately and explicitly authorizes that specific action.** The current, owner-selected role for any ChatGPT-side GitHub connector is **READ FIRST** — the owner explicitly selected the connector's **"Allow read actions"** permission mode (described in that UI as *"can read without asking, but will ask before making changes"*), and this is intentional: the project does not require or want autonomous repository writes from that integration for continuity to work. Having read access is never, by itself, authorization to write.

### 20. Proactive Continuity Checkpoint (added P0.4)

**The active chat/AI session — not the project owner — is responsible for proactively deciding when a continuity checkpoint is needed.** This responsibility is permanent and self-perpetuating (see item 4) — every future session inherits it automatically. The project owner is explicitly **not** responsible for watching chat length, estimating context-window usage, remembering elapsed time since the last push, remembering to request documentation updates, warning that a session may soon end, or reconstructing work after a session boundary.

**Why this exists**: the GitHub continuity path (item 17) only persists state up to the **latest pushed** checkpoint — a GitHub connector reads committed/pushed state, never Claude's uncommitted working tree (item 18). A real gap was observed where roughly 11 hours of work passed between commits — if a session had ended unexpectedly during that window, a new session would have recovered a checkpoint many hours stale. **"Documentation updated locally" is not equivalent to "continuity safely persisted" — persistence requires an actual push, not just an edit.**

**Checkpoint triggers — consider/prepare a checkpoint when any of these occur** (these are triggers to *prepare*, never authorization to commit):
1. Roughly 2-3 hours of meaningful project work have accumulated without a documentation push.
2. A significant audit, investigation, implementation phase, verification, debugging phase, or architectural discussion reaches a stable checkpoint.
3. Multiple important owner decisions/corrections have accumulated since the last pushed checkpoint.
4. Current project state or the exact next action has materially changed.
5. Significant facts exist only in the active conversation or the coding agent's working tree and are not yet recoverable from GitHub.
6. The conversation has become unusually long or complex.
7. A deliberate switch to another session/tab is being considered.
8. There is any reasonable risk that losing the current conversation would force the project owner to explain important work again.

**What the active session must do when a trigger fires**:
1. Proactively recognize it — do not wait for the project owner to notice.
2. Determine whether meaningful state exists that isn't yet preserved in the last-pushed documentation.
3. If yes, tell the project owner a continuity checkpoint is recommended.
4. Ensure the coding agent updates the appropriate continuity documents with: current verified state, owner decisions/corrections, completed work, incomplete work, working-tree state where relevant, authorization state, open issues/STOP conditions, the CURRENT EXACT CHECKPOINT, and the exact next action.
5. Review the resulting documentation state.
6. Request explicit project-owner authorization for a documentation checkpoint commit/push.
7. Only after that explicit authorization may the coding agent commit/push the documentation checkpoint.

**Documentation checkpoint ≠ application commit.** A continuity checkpoint must never force unfinished application code to be committed. If application work is intentionally incomplete/uncommitted, continuity can still be preserved through a **documentation-only** checkpoint that accurately states application changes exist only in the working tree and are not yet committed/pushed — unfinished application work, accurate documentation of its state, and a documentation-only commit/push can coexist without ever falsely publishing unfinished code as complete.

**Critical authorization rule — this does not change anything about commit/push authorization**: the active session may proactively detect the need, recommend a checkpoint, prepare/update documentation, and request approval — but commit and push still require separate, explicit project-owner authorization, exactly as before. **Never interpret the 2-3 hour trigger, or any other trigger above, as permission to commit or push automatically.** Never interpret "Continuity Owner" responsibility (item 3) as Git authorization.

**Emergency priority**: if session-loss risk appears high, preserving the CURRENT EXACT CHECKPOINT takes priority over starting another non-essential task (this reaffirms and sharpens item 15). At minimum, an emergency checkpoint must let a completely new session answer: what were we working on and why; what was actually completed; what remains incomplete; what did the coding agent last do/report; what did the owner manually do/decide; what exists only in the working tree; what is already committed/pushed; what is authorized; what is NOT authorized; are there active STOP conditions; and what exact action comes next. The owner must never be required to reconstruct these answers themselves.

### 21. Success Criterion

This continuity system succeeds only if a brand-new session can understand what ProFlow is, its architecture, its product rules, its workflow/safety rules, its production constraints, what has happened, what is currently true, what is unresolved, what was just done, what is authorized, what is not authorized, and what happens next — **without asking the project owner to reconstruct previous conversations.**

---

## §1. Project Identity / Purpose

**ProFlow** — a cloud-based SaaS business-management and smart-quoting platform at `www.quotecodepro.com`. Business owners (freelancers/small businesses) manage clients, create and send professional price quotes (line items, discount, VAT, digital signature capture, WhatsApp/email delivery), track expenses/revenue, and export reports. The product is split into two **hard-separated regional experiences** — a Hebrew/Israel-local product and an English/International product. This separation is an "Iron Rule" enforced throughout the codebase, not a cosmetic choice.

## §2. Current Production Architecture

Stack: React (Vite) frontend, Supabase (Auth, Postgres/RLS, Edge Functions), Vercel (hosting), GitHub (version control). **Corrected (previously documented as "Cloud-only — no localhost workflow," no longer accurate)**: production remains cloud-hosted, and GitHub/Vercel remain the sole source of truth for deployed code — but a local Vite dev server is actively used as a development/live-verification environment (recent UI work has been repeatedly verified this way). Localhost verification never implies production deployment; commit, push, and deploy remain separate, independently controlled gates.

## §3. Canonical Domain / Deployment

- **Production domain**: `https://www.quotecodepro.com/` — DOCUMENTED HISTORICAL FACT, repeatedly confirmed via SEO metadata, sitemap, robots.txt, and prior audits.
- `quotecode.vercel.app` also currently serves ProFlow directly (no redirect between the two domains exists in application code or Vercel config as of the last audit — REPO VERIFIED FACT). This is a separately tracked, unrelated architectural question (canonical-domain cutover) — **not** part of any currently active workstream. Do not conflate with the signup/market work below.
- It remains in Supabase's Auth Redirect URL allow-list (`https://quotecode.vercel.app/`) — deliberately **not removed**; see §E.

## §4. Local / Israel Product Rules

- Hebrew UI, RTL layout, **₪ (ILS) only**, 18% VAT applied automatically to local clients.
- Entry bundle: `AppLocal.jsx` (mounted by `main.jsx` when the resolved language is Hebrew). Routes: `/`, `/he`, `/dashboard` (with `bundleIsHebrew={true}`), `/tools`, `/he/tools`, quote routes, `/terms`, `/privacy`, `/contact` (+ `/he/...` variants), catch-all → `LandingLocal`.

## §5. International Product Rules

- English UI, LTR layout, **foreign currencies only (USD/EUR/GBP)** — **₪ must never appear**, 0% VAT for international clients.
- **International/English must contain NO VAT reference whatsoever** — no "VAT" label, no "18%", no "מע"מ", no VAT/pre-VAT-breakdown row, ever, for any International quote regardless of its tax treatment. This is not merely "0% VAT" numerically — it is the total absence of any VAT-shaped UI element. Do not build English/International "parity" with Hebrew's tax rows by copying them; VAT absence in English is **required, correct product behavior**, not a missing field (owner correction, Baseline Closure Pass, 2026-08-28 — a prior task's own report once mischaracterized this as a parity gap; that characterization was wrong and has been corrected in `PROFLOW_TODO.md` item 19).
- Entry bundle: `AppGlobal.jsx`. Routes: `/`, `/en`, `/dashboard` (with `bundleIsHebrew={false}`), `/tools`→`PublicToolsEn`, quote routes, `/terms`/`/privacy`/`/contact` (+ `/en/...`), catch-all → `LandingGlobal`. **`AppGlobal.jsx` has no `/he` route at all.**

## §6. Market Source-of-Truth Rules

**PROPOSED DESIGN (GO WITH CONDITIONS, not yet implemented)** — see §D and §17 for full detail. Summary: three-tier authority —
1. `business_settings.country` — permanent authority once a profile row exists (unchanged forever after).
2. `auth.user_metadata.signup_market` — authoritative *only* for the one-time creation of a genuinely missing profile.
3. Fresh geo lookup / explicit user choice (today's existing mechanism) — fallback only when tier 2 is unavailable (e.g. legacy pre-fix accounts).

**Non-negotiable product rule (owner-stated)**: once a user has explicitly signed up under Local or International, that market must survive email confirmation, a different device/browser/language/IP, first authenticated session, and `business_settings` creation — it must never be silently re-inferred from whoever's browser/location happens to click the confirmation link. Pre-signup Geo/browser signals are a *suggestion for anonymous landing-page routing only*, never an account-market authority.

## §7. Language / RTL / LTR Rules

- `document.documentElement.lang`/`dir` are set once, centrally, by whichever bundle (`AppLocal`/`AppGlobal`) is mounted — REPO VERIFIED FACT (`AppGlobal.jsx` sets `lang='en'`/`dir='ltr'` in a dedicated `useEffect`).
- Public quote pages (`PublicQuote`/`PublicQuoteEn`) determine their own language independently, since they can display the opposite language from the bundle hosting them.
- `main.jsx`'s bundle-selection cascade (query `lang` param → `/en`/`/he` path prefix → `localStorage.proflow_lang` → `proflow_geo_country` cookie set by `middleware.ts` from Vercel's real geo header → browser language) governs **anonymous landing-page routing only** — explicitly documented in-code as never a reliable source for an account's legal/business region.

## §8. Currency Architecture

- Local accounts: currency is always `ILS`. International accounts: `USD`/`EUR`/`GBP`, changeable as the account's **active** currency at any time via business settings — this is **intentional** (see §C2/§C5 below), not a bug.
- `regionConfig.js`'s `REGION_RULES`/`getRegionBillingProfile` derive currency symbol and VAT rate deterministically from `country` — never from UI language, never independently settable.

## §9. Quote Currency / Historical Quote Rules

**OWNER-STATED RULE, REPO VERIFIED mechanism (§C2-C5 below, full detail):**
- Each quote **permanently preserves the currency it was created in**, even if the business's active currency changes later. One International account can legitimately have quote history spanning multiple currencies simultaneously — this is correct, not leakage.
- `handleEditClick` (Dashboard.jsx) preserves a quote's original `currency`/`tax_rate` on save, never recomputing from the account's current region — DOCUMENTED HISTORICAL FACT (§5 audit, referenced in `PROFLOW_HANDOFF.md`).
- **A historical quote showing ₪ inside an International account is not automatically a bug.** Owner correction: the reason such a quote cannot simply be "fixed" is not merely a soft policy against rewriting history — **the quote is signed/approved/paid and is therefore immutable** (§17.A in `PROFLOW_HANDOFF.md`: DB triggers + UI/handler guards independently block any edit to an approved/paid/signed quote). Future QA must distinguish a *currently occurring* currency leak from *valid, locked historical data*.
- Changing the selected country/market in business settings intentionally changes the account's active currency going forward — **do not "fix" or remove this** during any International-market work.

## §10. Auth / Signup / Email Confirmation

**Current known-broken state (REPO + LIVE VERIFIED, GO WITH CONDITIONS design proposed, NOT implemented — see §D/§17 for full audit)**:
- `supabase.auth.signUp({ email, password })` in `Dashboard.jsx` is called with **no `options` at all** — no `emailRedirectTo`, no metadata. This is shared code for both markets (not International-specific).
- Because of this, Supabase falls back to its Site URL; the confirmation link lands on the bare domain root, which renders a landing page with **zero session-awareness** (`LandingLocal`/`LandingGlobal` never call `getSession()`).
- The only code that creates a `business_settings` row (`fetchSettings`/`createNewBusinessSettings`, both inside `Dashboard.jsx`) only ever runs when `Dashboard.jsx` mounts — which the confirmation redirect currently never triggers.
- Net effect: a confirmed, valid Auth user can be left with **no `business_settings` row at all**, and — because `main.jsx`'s market-selection cascade re-resolves fresh from whoever's browser/geo opens the confirmation link — can land on the *wrong market's* landing page.
- **This affects Local and International equally** — it is the same shared code path, not an International-only defect.

## §11. `business_settings`

- Sole INSERT authority: `createNewBusinessSettings()` in `Dashboard.jsx` — the only place in the codebase authorized to create a new row.
- `UNIQUE(user_id)` — DOCUMENTED / PREVIOUSLY VERIFIED (§17.D in `PROFLOW_HANDOFF.md`; not re-checked via live catalog access in the most recent session).
- Default payload at creation: `role: 'user'`, `plan: 'pro'`, `trial_ends_at: now()+14d`, `country`/`currency` derived from whichever source is authoritative at that moment (§6).
- Existing-row branch of `fetchSettings()` **never** touches `trial_ends_at` or `country` on subsequent logins — REPO VERIFIED FACT, directly relevant to trial-safety guarantees (§17).

## §12. Supabase / RLS Security State

| Object | State | Verification class |
|---|---|---|
| `business_settings` RLS | Enabled, 7 policies (ownership, 2 restrictive INSERT, super-admin SELECT/UPDATE via `is_super_admin()`, 2 general owner policies) | DOCUMENTED (§18.M) |
| `authenticated` grant on `business_settings.role` | INSERT+SELECT only, **no UPDATE** — no client can self-promote | DOCUMENTED (§17.B), independently re-confirmed by the owner this session for the admin-role work |
| `public.is_super_admin()` | `SECURITY DEFINER`, `STABLE`, non-recursive, EXECUTE to `authenticated`/`service_role` only | LIVE VERIFIED (owner-supplied via SQL Editor) |
| `public.is_admin()` | Same pattern, checks `role = 'admin'` exactly | **LIVE VERIFIED, CREATED** — see §13/§14 |
| `chat_logs` RLS | **Was DISABLED with zero policies (ordinary users could read all logs directly — live-confirmed exploit)**; **now FIXED**: RLS enabled, exactly one SELECT policy (`is_super_admin()`-gated), `anon` grants revoked entirely, `authenticated` reduced to SELECT only, `service_role` unchanged | LIVE VERIFIED FIXED — see `PROFLOW_HANDOFF.md` §18.W |
| `business_settings.role` column schema | `text`, nullable, default `'user'`, **no CHECK constraint, no ENUM** — `'admin'` is already schema-valid without any migration | LIVE VERIFIED (owner-supplied via SQL Editor) |

## §13. Role Model: user / admin / super_admin

- `user` and `super_admin` are the only roles with any current live account. **`admin` is architecturally designed and partially prepared (helper function + RLS policy created) but has ZERO accounts using it yet — not implemented in application code.**
- **Critical, already-verified finding**: every one of the ~9 existing `role === 'super_admin'` checks in this codebase (4 frontend, 5 backend) is an **exact string-equality check**, never `!== 'user'` or a set-membership test. This means introducing `role='admin'` today, with zero code changes, grants that account **no capability beyond a plain user** — a favorable, confirmed architectural property, not an assumption.
- `admin-delete-user`'s target-protection guard only refuses `role === 'super_admin'` targets — an `admin`-role target would currently fall through as deletable by a `super_admin` caller (this matches the intended hierarchy: super_admin may delete admin).

## §14. Admin / Super Admin Work — Current State

**DB layer: DONE (owner-executed, LIVE VERIFIED).**
- `public.is_admin()` created — exact mirror of `is_super_admin()`'s proven pattern, `anon` explicitly revoked (the Supabase default-privilege auto-grant pitfall from §18.M was accounted for).
- One new additive policy on `business_settings`: `"Admins can view all business settings"`, `FOR SELECT TO authenticated USING (public.is_admin())` — does not touch any of the 7 pre-existing policies.
- Verification queries were drafted and provided to the owner for manual execution; **live confirmation of the exact ACL/policy-count results was reported by the owner as successful**, per the flow of this engagement (OWNER-OBSERVED FACT — not independently re-queried by an agent this session).

**Application layer: NOT STARTED.** No frontend `isAdmin`/`isAdminOrAbove` distinction exists yet. No `admin`-role account exists. `PROFLOW_TEST_ADMIN` provisioning remains **blocked** — **corrected**: `PROFLOW_TEST_ADMIN_EMAIL`/`PASSWORD` keys **are present** in `.env` (an earlier claim that they were absent was stale/incorrect), but the configured email (`shlomisiny22@gmail.com`) **does not currently exist in Supabase Auth**, per the owner's own manual check in Authentication → Users — so this credential set is **not currently usable** regardless of the `.env` keys' presence, and the stored password value is **not live-verified** and may be stale. The project owner must either provision that Auth user or supply new credential values before Phase 2 (signup) can proceed. **No password should ever be invented by an agent.**

**Approved capability model for ADMIN V1 (design only, not implemented)**: read-only — Admin area access, users list, platform KPIs, search/filter, permitted user/business details. Explicitly denied: delete user, reset data, extend trial, Lifetime, plan/subscription changes, role changes, admin creation/removal, diagnostic/test-email actions, destructive Edge Functions, **AI Support Logs / chat_logs access** (explicitly deferred, not granted).

## §15. Admin UI Requirements

- **The final Admin/Super Admin UI design is NOT yet approved** — the current dark/neon UI must not be treated as the final desired design (a light-theme redesign was separately audited/scoped but not implemented).
- **Firm, already-stated requirement for any future Admin UI**: the users-management table/list must **not** begin with email as the primary identity column. The primary/first identity shown should be the user/business human-readable name; email is secondary information. Preserve this in any future mockup/implementation.

## §16. AI / `chat_logs`

- Sole writer: `chat-ai` Edge Function, `INSERT` only, via `service_role` (legacy `SUPABASE_SERVICE_ROLE_KEY` — credential migration to `SUPABASE_SECRET_KEYS` remains a separate, still-open, unstarted track — §18.P).
- Sole legitimate reader: `AILogs.jsx`, `super_admin`-gated client-side, `select('*')`, full-table fetch, client-side search/filter, no pagination.
- **Security exposure found and fixed this engagement**: RLS was disabled with zero policies — any ordinary authenticated user could read the full table directly, bypassing the UI gate. **Now fixed** (§12 above / `PROFLOW_HANDOFF.md` §18.W).
- Not covered by any account-deletion path (by design — keyed by `user_email` text, not `user_id`) — an intentional, documented gap, not a bug.
- No UPDATE/DELETE/UPSERT code path exists anywhere against this table.

## §17. Trial / Plan Rules and Open Issues

- 14-day trial granted once, at `business_settings` creation, protected by `UNIQUE(user_id)` + RLS INSERT constraints (`plan='pro' AND trial_ends_at≈+14d` exactly, or the legitimate `plan='free' AND trial_ends_at IS NULL` self-cancel transition).
- `handleExtendTrial14Days` explicitly refuses to extend a trial that still has time remaining — this is **owner-confirmed intended behavior**, not a bug (only a since-fixed unrelated "Guard 1" plan-based check was the actual bug — see `PROFLOW_HANDOFF.md` §19.A history).
- **OPEN, separately tracked, NOT investigated/fixed in the signup-market work**: `PROFLOW_TEST_USER1`'s trial appeared to reset from ~11 days remaining back toward a fresh ~14-day window between sessions. Most plausible, code-grounded (not confirmed) explanation: the trial had already fully expired at some point, and the (correctly-functioning) Extend-Trial admin action was used again after expiry — its own guard only blocks extension *while time remains*, not after expiry. **Do not conflate this with the signup/market work** — different mechanism entirely.
- **OPEN**: no authoritative paid-subscriber source of truth exists yet; `billing-checkout-stub` is pure scaffolding; real billing infrastructure is a separate, larger, unstarted track (`PROFLOW_HANDOFF.md` §19.C).

## §18. Production Safety

- Production remains cloud-hosted; a local Vite dev server is used for development/live-verification only, never treated as deployed — localhost verification does not imply production deployment; commit, push, and deploy remain separate, independently controlled gates.
- Never mutate real/production/Lifetime customer data for testing — use explicit disposable TEST accounts only, and clean them up afterward (or explicitly, deliberately preserve a reproduction case, as with the current TEST International account — §D).
- Security-sensitive business rules must be enforced at the database layer (RLS + triggers), never frontend-only.
- Full file delivery (not fragments) when the owner requests manual copy/paste code.
- Git commands provided in a dedicated block at start/end of a code update, per owner convention.

## §19. David Aluminum Protection

**David Aluminum is a real, active, paying customer.** Absolute rule, restated here for permanence: never modify, log in as, use for testing, reset, delete anything belonging to, change plan/trial/role for, or send test communication to/from this account, under any circumstance, in any task. Every audit/QA task in this engagement has explicitly excluded this account and must continue to.

## §20. Claude/Coding-Agent Workflow Rules

**See §36 for the full permanent TEST-first / owner-gated LIVE release sequence — this section's points remain in force and are the commit/push-specific instance of that broader rule. See §38 for the permanent rule that every task must open with an explicit `EFFORT LEVEL` declaration — that rule governs how deeply Claude reasons/verifies, never how broad the scope is; scope is still set only by the task itself and by the rules in this section.**

- **Never** instruct a coding agent to modify code/database/production, commit, push, or deploy merely because an audit recommends a fix — project-owner approval is required before any implementation stage begins.
- Before commit/push: audit complete → alternatives/dependencies considered → implementation reviewed → verification performed → regression impact understood → **project owner explicitly approves**.
- Prefer technical instructions to the coding agent in English.
- A coding agent operating without live Postgres/Supabase catalog access (the standing case throughout this engagement — no `psql`, no MCP server, no Management API token available) must clearly distinguish LIVE VERIFIED from DOCUMENTED-ONLY claims, and must not fabricate live verification it did not perform.
- Outbound network calls carrying credentials (raw `curl` with tokens in the command line) have been observed to be blocked by this environment's own safety controls — the reliable pattern for any needed live check is through the already-authenticated QA browser session (Browser Harness), never raw shell credential-bearing requests.

## §21. Git / Commit / Push Rules

- Never commit or push without explicit, separate project-owner authorization — distinct from authorization to investigate or even to implement.
- Never skip hooks, never force-push, never amend a previously-pushed commit without explicit instruction.
- Track exact `HEAD`/`origin/main` state at the start of any session that might commit (see `PROFLOW_HANDOFF.md`'s own "NEXT SESSION START" checklist).

## §22. Test Accounts / QA Infrastructure

*(No secret values ever recorded here — env var names only.)*

| Account | Purpose | Market | Role | Current known state |
|---|---|---|---|---|
| `PROFLOW_TEST_USER1_EMAIL`/`PASSWORD` | General QA (Local/Israel account, Hebrew UI observed) | Local | user | Live, usable via normal login. **Trial-reset anomaly under separate, open investigation** (§17). |
| `PROFLOW_TEST_USER2_EMAIL`/`PASSWORD` | General QA | (not confirmed which market) | user | **Login currently fails with stored credentials** — OPEN, unrelated to any security work, needs owner attention (credential may be stale; not investigated further per explicit instruction). |
| `PROFLOW_TEST_INTL_EMAIL`/`PASSWORD` | International-market signup reproduction (legacy pre-fix account) | **Local** (post-Phase-1) | user | **State changed by authorized Phase 1 live test**: `business_settings` now exists with `country='Local'`, `currency='ILS'` — a correct, expected outcome of the pre-existing geo-fallback (this account has no `signup_market`, and this QA environment's live geo resolves to `IL`), not a defect. No longer in the original "Auth confirmed / profile missing" state. Left as-is, not repaired, pending owner review. |
| `<PROFLOW_TEST_INTL_EMAIL local-part>+intl2@gmail.com` | Fresh post-fix International new-signup test (Gmail plus-address alias of the same TEST mailbox, never previously registered) | **International (LIVE VERIFIED)** | user | **Core assertion proven**: `user_metadata.signup_market='International'`, `business_settings.country='International'`, `currency='USD'`, English UI, zero ₪/Hebrew — confirmed despite this QA environment's geo resolving to `IL`. Password reused from `PROFLOW_TEST_INTL_PASSWORD` (same mailbox owner, not a new secret). |
| `<PROFLOW_TEST_INTL_EMAIL local-part>+local2@gmail.com` | Fresh post-fix Local new-signup test (Gmail plus-address alias, never previously registered) | **Local (LIVE VERIFIED)** | user | **Bilateral verification completed**: verified via a clean auth context (no residual session) and the authoritative session/DB source (not UI text) — `session.user.email`/`id`/`user_metadata.signup_market='Local'` all confirmed, distinct `user_id` from the `+intl2` account (no cross-contamination), `business_settings.country='Local'`, `currency='ILS'`, `lang='he'`/`dir='rtl'`, `₪` present, zero `$`. Password reused from `PROFLOW_TEST_INTL_PASSWORD`. |
| `PROFLOW_TEST_ADMIN_EMAIL`/`PASSWORD` | Future restricted-admin-role QA | To be decided (Local recommended, per earlier audit) | admin (not yet provisioned) | **Corrected**: keys **are present** in `.env` (an earlier "does not exist yet / keys absent" claim here was stale/incorrect). The configured email is a TEST/QA configuration identity only. That email **does NOT currently exist in Supabase Auth**, per the owner's own manual verification in Authentication → Users — so this credential set is **NOT currently usable**. No signup has been performed for it and no role is assigned. The stored password value is **NOT live-verified** and may be stale. The presence of these `.env` keys must **not** be read as proof of a working Super Admin account — Super Admin authorization is determined exclusively by `business_settings.role = 'super_admin'` (§13/§14), never by this email address. Blocked pending either provisioning that Auth user or owner-chosen new credential values. |

## §23. Local + International Regression Requirement

**Standing, non-negotiable rule (owner-stated, restated for permanence — "Bilateral Regression Rule", §C1):** Local/Israel and International must be evaluated together whenever shared functionality changes. Never fix one market while silently breaking or leaving unaddressed the same defect in the other. The current signup/confirmation bug (§10/§D) is a clean example of correctly applying this: it was diagnosed as a **shared-code defect affecting both markets equally**, not an International-only issue, and any fix must be verified against both.

**See §37 for the permanent rule extending this specifically to UI/UX work**: every UI/UX change must be implemented in both language/direction experiences in the same work pass, with Local and International verified and reported separately — never treat this section's regression principle and §37's same-pass parity requirement as interchangeable; §37 is stricter (same pass, not just "eventually both fixed").

## §24. Known Open Issues

1. **International (and Local) signup → email confirmation → missing `business_settings`** — architecture fully diagnosed, design approved GO WITH CONDITIONS, **not implemented**. See §D/§17 (of this doc) for full detail. **This is the current active workstream.**
2. **`PROFLOW_TEST_USER1` trial-reset anomaly** — open, separately tracked, plausible-not-confirmed explanation on file, not to be fixed opportunistically.
3. **`PROFLOW_TEST_USER2` cannot log in** — open, credential/account issue, not investigated further per instruction.
4. **`PROFLOW_TEST_ADMIN` provisioning blocked** — `.env` keys are present (corrected from an earlier stale "absent" claim), but the configured email does not currently exist in Supabase Auth, per owner verification — not usable until the owner either provisions that Auth user or supplies new credential values (see §14/§22).
5. **Restricted `admin` role application-layer work** — DB prep done; frontend/UI work not started; blocked behind #4 for QA validation.
6. **AI Support Logs read/unread status indicator** — owner-requested, not designed in detail, not started (`PROFLOW_HANDOFF.md` §18.V).
7. **Real billing/payment infrastructure** — not designed, not started (`PROFLOW_HANDOFF.md` §19.C).
8. **`quotecode.vercel.app` → canonical-domain redirect** — separately scoped, not bundled into any active work; nothing in application code currently references this domain (confirmed by repo-wide grep).
9. **Local currency-symbol header leakage** — OPEN, not yet independently re-audited (`PROFLOW_HANDOFF.md`, historical §B note).
10. **Storage cleanup gap on account deletion** — no code path ever deletes actual Storage-bucket file objects on user deletion (only DB metadata rows); compounded by a documented, still-open gap that no owner DELETE policy exists on `storage.objects` for the `quote-files` bucket at all (`PROFLOW_HANDOFF.md` §18.J). Discovered during the deleted-user residue audit; not fixed.

## §25. Verified / Closed Issues — Do Not Reopen Without New Reason

- `chat_logs` RLS exposure — **FIXED + VERIFIED** (§12/§16 above, `PROFLOW_HANDOFF.md` §18.W). Do not re-audit without a new, specific technical reason.
- `business_settings` role-escalation surfaces (role/plan/trial_ends_at INSERT/UPDATE) — **CLOSED** (`PROFLOW_HANDOFF.md` §17.B-§17.E, §18.M).
- Quote immutability (approved/paid/signed) — **CLOSED**, DB triggers + UI guards both independently enforce it (`PROFLOW_HANDOFF.md` §17.A).
- Trial-Extension "Guard 1" bug (blocked legitimate extensions based on a stale plan check) — **FIXED, PRODUCTION VERIFIED**, owner-confirmed working live. Guard 2 (blocks extension while time remains) is **intended behavior, not a bug** — do not "fix" it again.
- Chat-AI four-context market isolation + HARD_QUESTION classification — **FIXED, VERIFIED, DEPLOYED** (`PROFLOW_HANDOFF.md` §18.U).
- Admin UI visual/exclusion redesign (Super Admin excluded from managed-user table/KPIs) — **owner-browser-approved** (`PROFLOW_HANDOFF.md` §19.A) — but see §15 above: the *overall final* Admin UI design is still open; this closed item is narrower than "Admin UI is done."

## §26. Owner Corrections / Important Non-Obvious Product Behavior

- A quote's currency/tax_rate is **frozen at creation** and never recomputed from the account's current region on edit — protects historical documents from silent corruption. Not a bug if a quote shows a currency different from the account's current active currency.
- A historical ₪-denominated quote inside an International account is not automatically a leakage bug — it may be a signed/locked, immutable historical record (§9/§C4).
- Changing an International account's active country/currency selection deliberately changes future quote defaults — this is intended, not something to "fix."
- `handleExtendTrial14Days`'s refusal to extend an active (non-expired) trial is **intended**, confirmed directly by the project owner — do not remove or "fix" this guard.
- Market (Local vs. International) must never be re-inferred post-signup from browser/geo signals — this was the central correction driving the entire signup/market architecture audit (§D/§17).
- The Admin users table must show name before email, not email-first — an explicit, standing UI requirement for any future Admin redesign (§15).

## §26.A ChatGPT ↔ GitHub Continuity Status (Verified P0.3)

- **GitHub repository**: `quotecode-dev/quotecode-clean`.
- **ChatGPT GitHub integration**: **CONNECTED AND LIVE-TESTED** (OWNER-OBSERVED, performed jointly by the project owner and a ChatGPT session).
- **Permission mode selected by the owner**: **"Allow read actions"** — described by the ChatGPT UI as *"ChatGPT can read without asking, but will ask before making changes."* Intentional — this project does not require autonomous ChatGPT repository writes for continuity (see Protocol item 19).
- **Live repository read test**: **PASS** — ChatGPT successfully fetched `PROFLOW_ARCHITECTURE.md` directly from the connected GitHub repository, proving the connector reads real repository state, not chat memory or an uploaded copy.
- **`PROFLOW_PROJECT_CONTEXT.md` fetch attempt (same test)**: returned **404 / NOT FOUND** — **this was expected and is not a connector failure.** At the time of this test, the P0.2 documentation work (including this file's own creation) existed only in the local working tree — `git status` showed `?? PROFLOW_PROJECT_CONTEXT.md` (untracked) and `M PROFLOW_ARCHITECTURE.md`/`M PROFLOW_HANDOFF.md` (modified, uncommitted) — nothing had been committed or pushed yet. GitHub therefore correctly did not yet contain this file at all, and still contained the **pre-P0.2** version of `PROFLOW_ARCHITECTURE.md`. This is strong, direct evidence the connector reads actual GitHub state (see Protocol item 18).
- **Write authorization**: none granted or exercised via the ChatGPT connector — the connector has read-only intended use per the owner's permission choice. The documentation-only commit/push itself (below) was performed by the coding agent (Claude), separately explicitly authorized by the project owner, not via the ChatGPT connector.
- **P0 documentation commit/push — UPDATE, now COMPLETE**: the project owner explicitly authorized, and the coding agent executed, a single documentation-only commit (`docs: establish persistent ProFlow continuity system`, commit `78aba82`) containing exactly the three documentation files, pushed to `origin/main` on `quotecode-dev/quotecode-clean`. Verified post-push via a live `git ls-remote` query against GitHub (not just local tracking state) — local `HEAD` and the remote `main` ref matched exactly.
- **ChatGPT post-push acceptance test**: **PASSED.** ChatGPT successfully read `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_ARCHITECTURE.md`, and `PROFLOW_HANDOFF.md` directly from GitHub after the push — GitHub is now a confirmed, working persistence path for future sessions.

## §26.B International/Local Signup-Market Fix — Implementation Phase 1 (IMPLEMENTED IN WORKING TREE / NOT COMMITTED / NOT DEPLOYED)

The previously-approved (GO WITH CONDITIONS) signup-market design was implemented in `src/pages/Dashboard.jsx` only. **Not committed, not pushed, not deployed.** Full detail in `PROFLOW_HANDOFF.md` §18.AD.

**Pre-edit safety verification finding (material, corrected before editing)**: the earlier audit's pseudocode used the local `isHebrew` variable for the new `signup_market` value. Direct re-reading of the current code found `isHebrew = isHebrewEnv(bizCountry, session)` — `bizCountry`'s own initial state is seeded from `localStorage.getItem('proflow_cached_country')`, and the code's own adjacent comment explicitly documents `isHebrew` as meant only for an *existing* account's display, never for a new account's region. Using it for `signup_market` would have silently reintroduced a cache/browser-derived signal — exactly what this fix exists to eliminate. **Corrected**: the implementation instead threads the already-passed-but-previously-unused `bundleIsHebrew` prop (set unambiguously by `AppLocal.jsx`/`AppGlobal.jsx` at the route level) into `Dashboard()`'s signature and uses it at the `signUp()` call site. This is a same-scope correction to an implementation detail, not a redesign — the three-tier approach and every other aspect of the approved design are unchanged. Flagged prominently here per the "verify before editing" instruction.

**Changes made** (`src/pages/Dashboard.jsx` only, 4 coordinated edits):
- `Dashboard()` now accepts `{ bundleIsHebrew }` (both real call sites already pass this prop; previously unused).
- `signUp()` now passes `options: { emailRedirectTo: 'https://www.quotecodepro.com/dashboard', data: { signup_market: bundleIsHebrew ? 'Local' : 'International' } }` — the canonical domain is hardcoded (not `window.location.origin`) so confirmation always returns to the canonical domain even if signup happened on `quotecode.vercel.app`.
- `loadData()`/`fetchSettings()` now thread a third `userMetadata` parameter (sourced from `session.user.user_metadata` / `newSession.user.user_metadata` at both existing call sites).
- `fetchSettings()`'s missing-profile branch now checks `userMetadata?.signup_market` (validated to be exactly `'Local'` or `'International'`) **before** the existing fresh-geo fallback, which is otherwise fully preserved unchanged.
- **Existing-row branch of `fetchSettings()` was not touched at all** — an account with a pre-existing `business_settings` row is structurally never routed through this code path, so Tier 1 (existing-profile authority) protection required no new guard; it was already guaranteed by the existing `if (data) {...} else {...}` structure.

**Verification performed**: full diff reviewed; `npx eslint src/pages/Dashboard.jsx` — 0 errors, 1 pre-existing warning (confirmed identical on the pre-edit file via `git stash`, not introduced by this change); `npm run build` — succeeded, only pre-existing unrelated warnings (chunk size); `npm run test` — 21/21 passing, matching the documented baseline; `git status --short` — only `src/pages/Dashboard.jsx` modified, no other file.

**Follow-up hardening (same phase, still working-tree only)**: a read-only call-site audit confirmed `bundleIsHebrew` is passed explicitly at both of the only two live-reachable `<Dashboard>` render sites (`AppLocal.jsx`→`true`, `AppGlobal.jsx`→`false`); the only caller omitting it, `src/App.jsx`, is confirmed dead code (zero imports anywhere in `src/`, never mounted by `main.jsx`). Since the `: isHebrew` fallback in `signupIsHebrew = typeof bundleIsHebrew === 'boolean' ? bundleIsHebrew : isHebrew` could therefore never execute on any live path but represented an avoidable future risk (a hypothetical future caller forgetting the prop would silently fall back to the cache/session-derived `isHebrew`, exactly the bug this fix removes), the fallback was removed and replaced with **fail-closed** behavior: if `bundleIsHebrew` is not a real boolean at signup time, `signUp()` is never called, no market is guessed, and a generic configuration-error message is shown via the existing `setAuthError` mechanism (the error message's own display language still uses `isHebrew` — that's cosmetic UI text, not a market-authority decision, and is not the same thing as deriving `signup_market` from it). Re-verified: ESLint 0 errors, 1 pre-existing warning; `npm run build` succeeds; `npm run test` 21/21 passing; only `src/pages/Dashboard.jsx` (plus the documentation files already in flight) shows as modified.

**Status (superseded by live testing below)**: code **COMMITTED + PUSHED** (`ee4b8a8`, `fix(auth): preserve signup market through confirmation`).

**Live Functional Verification — Phase 1 (legacy account, LIVE VERIFIED)**: logged into the previously-preserved International TEST reproduction account (`PROFLOW_TEST_INTL_EMAIL`, no `signup_market` metadata — it pre-dates this fix). Result: `business_settings` created with `country='Local'`, `currency='ILS'`. **This is not a defect in the new code** — this account has no `signup_market`, so `fetchSettings()` correctly fell through to the unchanged, pre-existing geo-fallback tier, and a live `/api/geo` lookup for this QA environment's network resolved to `IL`. This reveals the QA environment's own apparent geolocation, not a bug in the fix. **This account's state has permanently changed** from "Auth confirmed / `business_settings` missing" to "Auth confirmed / `business_settings` exists, `country='Local'`" — left exactly as-is, not repaired, pending owner review.

**Live Functional Verification — Phase 2 (new signup, LIVE VERIFIED — the core assertion)**: a brand-new International signup was performed end-to-end using a never-before-used Gmail plus-address alias (`<test-mailbox>+intl2@gmail.com`) of the same TEST mailbox, through the real `/en` signup UI. The project owner manually confirmed the email (clicked the real Verify Email link, confirmed to land on the canonical `quotecodepro.com` domain). Post-confirmation login was then performed live, and the results were read directly (self-authenticated, RLS-scoped, no other account touched):
- `user_metadata.signup_market`: **`"International"`** — correctly captured at signup time.
- `business_settings.country`: **`"International"`**
- `business_settings.currency`: **`"USD"`**
- `business_settings.email`/`user_id`: matched the signed-up account exactly.
- UI: confirmed English/LTR (`document.documentElement.lang='en'`, `dir='ltr'`), **zero Hebrew characters and zero `₪` symbols** anywhere on the page (both checked programmatically).
- Dashboard loaded successfully, no runtime/visible errors.

**This is the core assertion, proven**: despite this QA environment's live geo-lookup resolving to `IL` (demonstrated by Phase 1's own outcome on the very same network), the new `signup_market` metadata correctly overrode the geo fallback end-to-end — signup → email confirmation → canonical `/dashboard` redirect → missing-profile bootstrap → `signup_market` wins → `country='International'`.

**Live Functional Verification — Phase 3 (new Local signup, LIVE VERIFIED — bilateral verification complete)**: a fresh Local signup was performed (Gmail plus-address alias `+local2`, never previously registered) through the real `/he` UI, confirmed by the owner via the real email link. An initial post-confirmation check was contaminated by a stale browser session from the `+intl2` test (UI language alone is not reliable identity evidence) — this was correctly identified and re-done cleanly: a **clean auth context** (confirmed no residual session token) was used to explicitly log in as `+local2`, and the result was verified from the **authoritative session/DB source, not UI text**:
- `session.user.email`: `nimrod1sinai+local2@gmail.com` — exact match.
- `session.user.id`: distinct from the `+intl2` account's `user_id` — no cross-contamination.
- `session.user.user_metadata.signup_market`: **`"Local"`**
- `business_settings.country`: **`"Local"`**, `currency`: **`"ILS"`**, `user_id`/`email` both matching exactly.
- `document.documentElement.lang='he'`, `dir='rtl'`; `₪` present, **zero `$` anywhere**.

**Status: BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION — LIVE VERIFIED.** Both markets independently confirmed end-to-end (signup → real email confirmation → canonical `/dashboard` → missing-profile bootstrap → `signup_market` wins over geo → correct market), with no cross-contamination between the two new TEST identities.

**Separate, still-open localization observations (recorded only, NOT investigated or fixed in this work)**: (1) the International `+intl2` confirmation/post-login flow transiently showed Hebrew loading text ("טוען את המערכת...") before the English Dashboard rendered; (2) the International account also showed a Hebrew logout-confirmation dialog and a Hebrew login screen after logging out; (3) the Local `+local2` confirmation email itself arrived in English, and the Local signup success message displayed in English on the Hebrew signup page (traced to `isHebrew`/`bizCountry`'s cache-dependent default when `localStorage.proflow_cached_country` is empty — unrelated to and unaffected by the `signup_market` fix, since `signup_market` capture uses `bundleIsHebrew`, not `isHebrew`). These are pre-existing, cosmetic, `isHebrew`-driven quirks, independent of the signup-market fix's correctness — tracked as open items for a future, separately-authorized localization audit, not addressed here.

## §27. Current Workstream

**P0 persistent continuity/documentation infrastructure** (P0 → P0.1 → P0.2 → P0.3 → P0.4) — complete. The **International/Local signup → email confirmation → `business_settings` bootstrap** fix — implemented, committed, pushed, and bilaterally live-verified (§26.B). A dedicated **read-only production routing/locale-selection audit** has since been completed (§31/§32) to ground the next workstream, **Owner + ChatGPT Visual Acceptance testing**, in verified repo behavior rather than assumption. Visual Acceptance testing itself has **NOT** started.

**P0** — `PROFLOW_PROJECT_CONTEXT.md` created.

**P0.1** — `PROFLOW_ARCHITECTURE.md` audited. Classification: **MIXED**.

**P0.2** — Three-document documentation remediation completed.

**P0.3** — ChatGPT ↔ GitHub continuity verified **and pushed** (commit `78aba82`, `docs: establish persistent ProFlow continuity system`, on `origin/main` of `quotecode-dev/quotecode-clean`). **Post-push ChatGPT read test PASSED** for all three permanent documents (§26.A).

**P0.4** — Proactive Continuity Checkpoint rule documented (Protocol item 20) — every future session now owns detecting *when* a checkpoint is needed, without relying on the project owner to notice or ask.

## §28. CURRENT EXACT CHECKPOINT — 2026-08-27 (14.B Desktop: fourth pass reviewed, changes required; documentation-only checkpoint)

**THIS SECTION OVERRIDES ALL OLDER CHECKPOINT SECTIONS AND ALL HISTORICAL P0.x / EARLY-AUDIT ENTRIES FOR RESUME PURPOSES.** If any earlier-numbered section (in this file, in `PROFLOW_ARCHITECTURE.md`, or especially in `PROFLOW_HANDOFF.md`, which is append-only history) appears to describe "the current state" but conflicts with this section, **this section wins**. See `PROFLOW_HANDOFF.md`'s own "CURRENT RESUME STATE — READ FIRST" block (top of that file) for the matching pointer — that block must also be read fresh, not assumed from an earlier session's memory of it.

- **What are we working on, and why**: item 14 (Public Quote + User UI Visual Redesign) is the active workstream, with three tracked sub-items in `PROFLOW_TODO.md` — 14.A Public Quote, 14.B Business Owner Dashboard, 14.C Super Admin. **14.B Desktop is the current focus and this checkpoint's main subject.**
- **14.B Business Owner Dashboard — Desktop status, precisely**: there have now been **four** implementation passes. The first three (§18.AN/§18.AO light reskin; §18.AQ purple-header/pill-nav rework; §18.AR strict-visual-match rework) were all built from **text descriptions only** — Claude was never shown the actual mockup image. The **fourth pass** (§18.AS) was the **first** pass where the owner's actual approved mockup image was provided and used directly for comparison; it corrected three concrete discrepancies (nav-row style, KPI order/icon style, and a backwards two-column work-area orientation caused by RTL grid auto-placement mirroring DOM order). **The owner has now reviewed the fourth-pass result: "substantially closer to the approved visual reference, but not finally accepted."** 🔴 **Desktop OWNER FINAL VISUAL ACCEPTANCE: PENDING / CHANGES REQUIRED** — never describe it as complete.
- **Five further Desktop changes are now owner-approved as the *next* direction (NOT yet implemented — this checkpoint is documentation-only)**: (1) Catalog moves out of the main Dashboard view entirely, becoming its own top-nav tab ("קטלוג"), reusing all existing Catalog functionality unchanged, no DB/schema change; (2) Quote History becomes full width once Catalog is removed from the main view; (3) remove the duplicate New Quote CTA — keep only the top-level standalone button, remove the one currently duplicated inside the Quote History panel (CSV export stays); (4) reduce Quote History row density ~25–35% where safe, with truncation/ellipsis for long content rather than taller rows; (5) resulting target top nav: הצעת מחיר חדשה, הגדרות עסק, לקוחות, פיננסים, קטלוג. The header/business-identity rule (logo in a white/neutral container or business-name fallback, never the ProFlow logo) is preserved unchanged. **The provided mockup image remains the Desktop visual source of truth except where these five owner decisions explicitly supersede it.** Full detail: `PROFLOW_TODO.md` 14.B, `PROFLOW_HANDOFF.md` §18.AT (this checkpoint's own entry).
- **14.A Public Quote**: design approved in principle; implementation already done in the working tree (purple header, call CTA, recipient emphasis, always-visible attachments with empty-state message, purple totals/approve-CTA — see §18.AQ). Local Desktop+Mobile live-verified via a real quote; International not live-tested. **Not yet reviewed by the owner** — do not describe as accepted.
- **14.C Super Admin**: design approved (light direction only); implementation partial in the working tree (light theme + module title bar — see the overnight-pass report). Live browser verification remains **BLOCKED** by the harness's permission classifier denying the `PROFLOW_TEST_ADMIN` login attempt — not worked around. **Not yet reviewed by the owner** — do not describe as accepted.
- **Do not begin further implementation on 14.A or 14.C merely because working-tree changes already exist for them** — each next step on either requires its own separate explicit authorization, same as 14.B.
- **Agent Monitor**: POC performed once. The built-in `PushNotification` tool is confirmed callable, but a test notification returned "not sent" because the tool suppresses phone delivery whenever the terminal is actively watched — mobile delivery could not be confirmed or denied. Result remains **INCONCLUSIVE / TIMEBOX-BOUNDED**, not solved. No monitor implementation exists. Side tool, not the primary workstream — do not spend further time on it without a fresh explicit request.
- **Auth/Routing Localization Phase 1 status (unchanged)**: implemented (Findings A/D/E/H), **STATIC VERIFICATION PASSED**, **LIVE VISUAL VERIFICATION STILL PENDING**. Findings C and F remain OPEN. TODO item 12 remains 🟡, not complete.
- **Visual Acceptance evidence (unchanged)**: three Local-market anonymous-routing PASS results recorded (root `/` auto-selection; Landing→Login; Login→Signup, all Hebrew/RTL, Owner Desktop Browser/clean incognito). Nothing else covered. TODO item 13 remains 🟡, not complete.
- **Signup-market fix (unchanged, not reopened)**: **COMMITTED + PUSHED** (`ee4b8a8`). **LIVE VERIFIED.** See §26.B/§32.I.
- **Routing/locale audit (unchanged)**: **COMMITTED + PUSHED** (`d7f3408`).
- **Documentation-repair checkpoint (unchanged)**: **COMMITTED + PUSHED** (`1ca734d`).
- **What is currently live** (GitHub `main`, as of `1ca734d`): the signup-market fix, the routing/locale audit, the continuity-bootstrap repair (magic-phrase contract, four-file reading order, this checkpoint's own precedence marker), all P0-P0.4 docs, `chat_logs` RLS fix, `is_admin()`, Supabase Redirect URLs. **All application/UI code for 14.A/14.B/14.C, and this exact documentation checkpoint, are local-only as of this update — NOT committed/pushed** (this specific task is authorized to commit+push only the four documentation files, not the application code).
- **What is approved**: 14.A/14.B/14.C visual **direction** (owner-confirmed, and for 14.B specifically the five next-change items above); existing implementation work already in the working tree for all three (as a record of what was done, not as owner-accepted).
- **What is NOT approved**: starting implementation of 14.B's five next changes (direction approved, start not yet authorized); further 14.A or 14.C implementation; commit/push/deploy of any application/UI code; any fix for Finding C or F; repair of any TEST account.
- **What must NOT happen yet**: beginning the Catalog/Quote-History/duplicate-CTA/row-density implementation automatically after this checkpoint; committing/pushing/deploying any application code; fixing Finding C or F; TEST account repair; treating Finding C's cause as known (explicitly **UNKNOWN**); treating any localization observation as proof of device/browser dependency (explicitly **NOT PROVEN**); marking TODO item 12 or 13 complete; describing any of 14.A/14.B/14.C as owner-accepted.
- **Active STOP conditions**: none currently active for documentation; **implementation of 14.B's next five changes requires a fresh, separate, explicit authorization** — do not infer it from this checkpoint alone.

## §29. Next Action

1. **Immediate next action**: Owner + ChatGPT review of this documentation checkpoint itself, then a separate explicit authorization to begin implementing 14.B's five approved next changes (Catalog → own tab, Quote History full width, remove duplicate CTA, denser rows, updated nav).
2. **Once that authorization arrives**: implement the five changes, then return for another owner Desktop review before any commit/push.
3. **Separately, whenever the owner directs**: review of the existing 14.A/14.C working-tree implementations, or further work on either.
4. **In parallel, whenever directed**: live visual verification of Auth/Routing Localization Phase 1 (Findings A/D/E/H), and continuation of Owner + ChatGPT Visual Acceptance (item 13) beyond the three checks already recorded.
5. **Separately deferred, awaiting future authorization**: (a) any fix for Finding C (cause remains UNKNOWN) or Finding F (external Supabase email template); (b) any decision on repairing the three TEST accounts.
6. **No new workstream should be inferred or begun from this checkpoint alone.**
7. **Three permanent workflow rules now govern every future action item above and everything that follows them**: §36 (Test-First / Owner-Gated Live Release), §37 (Hebrew RTL / English LTR UI Parity), and §38 (Task Effort-Level Declaration) — read all three before implementing or deploying anything, on item 14 or any future item.

## §30. Documentation Maintenance Rule

See the full Mandatory Continuity Protocol at the top of this file (items 1-16). In short: this file must be updated whenever a new session would need the information to continue correctly, kept as a clean current-state document (not a chronological dump — that belongs in `PROFLOW_HANDOFF.md`), and every future session inherits responsibility for keeping it accurate. This rule does not expire and does not need to be re-requested by the project owner in future sessions.

## §31. Production Routing / Locale Selection Architecture — REPO VERIFIED

Established by a dedicated read-only audit (full trace in `PROFLOW_HANDOFF.md` §18.AG). Supersedes any prior informal description of routing/locale behavior.

**A. Actual React entry point**: `src/main.jsx` is the true, running entry point (loaded via `index.html` → Vite), and selects/mounts either `AppLocal` or `AppGlobal` at the React root. `src/App.jsx` remains legacy/dead code — zero imports anywhere in `src/`, never mounted — and is **not** the running root.

**B. Anonymous bundle-selection cascade** (`src/main.jsx`), exact priority order:
1. `?lang=en` / `?lang=he` (query param) — highest priority, always wins if present.
2. Pathname prefix `/en` or `/he`.
3. `localStorage.proflow_lang` — this browser's saved choice from a prior visit.
4. `proflow_geo_country` cookie — set by `middleware.ts` from Vercel's real geo header, root path (`/`) only.
5. `navigator.language` (browser language) — lowest priority, final fallback.
After the decision, `localStorage.proflow_lang` is unconditionally overwritten with the result — every anonymous visit rewrites this cache to match whatever was just decided.

**C. Critical behavior of root `/`**: opening `https://www.quotecodepro.com/` does **NOT** redirect the browser to `/he` or `/en`. `main.jsx` selects `AppLocal` or `AppGlobal` and mounts that bundle in place — the URL remains `/`. **This distinction is important for future QA**: never assume `/he`/`/en` appearing in the address bar is required, or that root routing produces one.

**D. Explicit routes**: `/he` → Local bundle (`AppLocal`), unless overridden by higher-priority `?lang=`. `/en` → International bundle (`AppGlobal`), unless overridden by higher-priority `?lang=`. These are explicit, user-selectable route tests — **not** evidence of automatic geo-routing. A passing `/he` or `/en` visual test proves only that the explicit route itself works, never that anonymous root routing selects the correct bundle for a real visitor.

**E. `/dashboard`**: does not itself encode Local or International. Initial bundle selection happens via the same anonymous cascade (B), **before** any Supabase/account state is known. After authentication and `business_settings` load, `Dashboard.jsx`'s own rendered account UI (`isHebrew = isHebrewEnv(bizCountry, session)`) uses `business_settings.country` as the source of truth. **INITIAL BUNDLE / AUTH-SHELL LANGUAGE and FINAL AUTHENTICATED ACCOUNT LANGUAGE/MARKET are related but NOT the same source of truth** — this distinction underlies Findings A/D/E/H in §32.

**F. Anonymous Geo vs. legacy bootstrap Geo — two distinct mechanisms, must not be conflated**:
1. *Anonymous routing geo*: `middleware.ts` → Vercel `geolocation()` → `proflow_geo_country` cookie (24h) → read by `main.jsx` at cascade priority 4. Purpose: anonymous landing-page bundle selection only.
2. *Legacy missing-profile bootstrap geo*: `Dashboard.jsx`'s `fetchSettings()` → `api/geo.js` → live `x-vercel-ip-country` request header (no cache, no cookie) → used **only** when an authenticated user has no `business_settings` row yet **and** no valid `signup_market` metadata is present. Purpose: one-time new-account `country` bootstrap for legacy (pre-signup-market-fix) accounts only.

**G. Logout**: handler is `Dashboard.jsx`'s `handleSignOut()` → `supabase.auth.signOut()` only. Does **NOT** navigate to `/`, `/he`, or `/en` — no `window.location`/router navigation occurs; remains on the existing URL (normally `/dashboard`). The `SIGNED_OUT` auth-state-change handler then renders `AuthScreen` in place once `session` becomes null. Clears `localStorage.proflow_cached_country`; resets `bizCountry` state to `'International'`. Does **NOT** clear `localStorage.proflow_lang` — this persists unchanged across logout, regardless of which account just logged out.

## §32. Auth / Routing Localization — Open Screen-Level Findings (A–H)

Produced by the same read-only audit as §31 (full narrative in `PROFLOW_HANDOFF.md` §18.AH). None of these findings reopen or affect the signup-market mechanism — see §32.I.

**Implementation Phase 1 (working tree only, not committed/pushed/deployed/live-verified — see `PROFLOW_HANDOFF.md` §18.AK)**: `src/components/AuthScreen.jsx` now accepts an explicit `bundleIsHebrew` boolean prop and prefers it over its previous independent pathname/`?lang=`/`localStorage.proflow_lang` guess (old cascade retained only as a fallback); `Dashboard.jsx`'s signup-success and login-success messages now use `bundleIsHebrew` instead of `isHebrew`. This targets Findings A, D, E, H below. Findings C and F were explicitly left untouched per the owner's scope.

| Finding | Account/Context | Exact Screen | Expected | Observed | Status | Evidence Classification | Device Dependency |
|---|---|---|---|---|---|---|---|
| A | International `+intl2` | Transient loading screen before final Dashboard | English | Hebrew (`"טוען את המערכת..."`) | 🟡 FIX IMPLEMENTED IN WORKING TREE — verification pending | mechanism REPO VERIFIED; occurrence OWNER-OBSERVED | NOT PROVEN |
| B | International `+intl2` | Fully loaded Dashboard | English / International / non-ILS | English / International / USD | **PASS — LIVE VERIFIED** | REPO VERIFIED + OWNER-OBSERVED | NOT INDICATED |
| C | International `+intl2` | Logout confirmation dialog (English Dashboard → Sign Out) | English | Hebrew | **OPEN — CAUSE UNKNOWN** (explicitly out of Phase 1 scope, `SignOutModal.jsx` untouched) | OWNER-OBSERVED; mechanism UNKNOWN | UNKNOWN |
| D | International `+intl2` | Post-logout login screen (English Dashboard → Sign Out → session null) | English | Hebrew | 🟡 FIX IMPLEMENTED IN WORKING TREE — verification pending | REPO VERIFIED | NOT PROVEN |
| E | Local `+local2` | Post-signup success message (before email confirmation/bootstrap) | Hebrew | English (`"Sign up successful! Initializing user profile with free trial..."`) | 🟡 FIX IMPLEMENTED IN WORKING TREE — verification pending | REPO VERIFIED | N/A |
| F | Local `+local2` | Actual confirmation email content | Hebrew | English | OPEN — not fixed (explicitly out of Phase 1 scope, Supabase not touched) | OWNER-OBSERVED (source outside this repo — Supabase Auth email template) | NOT INDICATED |
| G | Local `+local2` | Fully loaded Dashboard | Hebrew + RTL + ILS/₪ | Hebrew + RTL + ILS/₪ | **PASS — LIVE VERIFIED** | REPO VERIFIED + OWNER-OBSERVED | NOT INDICATED |
| H | Local `+local2`, **Agent desktop browser**, Phase-3 clean verification | Login-success toast, on an already-correct Hebrew Dashboard | Hebrew | English (`"Logged in successfully"`) | 🟡 FIX IMPLEMENTED IN WORKING TREE — verification pending | mechanism REPO VERIFIED; specific stale-cache trigger INFERENCE | NOT PROVEN |

Standing notes (must be preserved, not softened in future updates):
- **Finding C's cause is explicitly UNKNOWN.** Do not invent a root cause and do not mark it fixed until a controlled live reproduction with instrumentation identifies the actual mechanism.
- **No device/browser dependency is proven** for Findings A, D, E, or H — observations span multiple environments (owner mobile, owner desktop browser, Agent desktop browser) that must not be merged or conflated in future work (see §33).
- Finding H was captured specifically in the **Agent's own desktop browser** during the Phase-3 clean verification — explicitly **not** the owner's mobile browser.

**§32.I — Explicit non-reopening statement**: these findings concern transient/auth/email UI language selection only. They do **NOT** reopen, invalidate, or cast doubt on the signup-market preservation mechanism, which remains **BILATERAL LOCAL + INTERNATIONAL SIGNUP-MARKET PRESERVATION: LIVE VERIFIED** (§26.B) — International `+intl2`: `signup_market='International'`, `business_settings.country='International'`, `currency='USD'`, final Dashboard = English; Local `+local2`: `signup_market='Local'`, `business_settings.country='Local'`, `currency='ILS'`, final Dashboard = Hebrew/RTL/₪. Findings B and G above are the direct confirmation that the mechanism itself is unaffected — every finding concerns UI text/screens *adjacent* to it, never the `signup_market`/`country`/`currency` values themselves.

## §33. Visual Acceptance Test Precision Rule — PERMANENT REQUIREMENT

Before asking the owner to perform any visual test, every test step must explicitly identify:
1. **ENVIRONMENT** — Owner Mobile / Owner Desktop Browser / Agent Desktop Browser / other (must be named explicitly).
2. **EXACT ACCOUNT** — full email/alias when account-specific.
3. **STARTING SESSION STATE** — authenticated / unauthenticated / clean-incognito / required cache-localStorage state if relevant.
4. **EXACT STARTING URL**.
5. **EXACT ACTION**.
6. **EXACT SCREEN/STATE** being tested.
7. **EXPECTED RESULT**.
8. **WHAT THAT TEST PROVES**.
9. **WHAT THAT TEST DOES NOT PROVE**.

Ambiguous instructions ("open Local", "open the site", "log in again", "check the email") without specifying environment/account/context are **not** acceptable test steps.

Standing clarifications (derived from §31.D):
- Opening `/he` manually tests the explicit Local route only. It does **NOT** prove automatic production geo-routing.
- Opening `/en` manually tests the explicit International route only. It does **NOT** prove automatic production geo-routing.
- Testing automatic routing must begin from the exact root URL `https://www.quotecodepro.com/`, with the required browser/cache/session state explicitly defined beforehand (§31.B/C).

## §34. Documentation Continuity Workflow Rule — PERMANENT REQUIREMENT

A READ-ONLY audit must not modify documentation while the audit itself is running. When an audit produces material project conclusions, architecture findings, verified bugs, changed status, or important QA constraints, the following sequence applies:
1. Owner + ChatGPT review the audit findings.
2. After approval, run a separate, explicitly-authorized DOCUMENTATION-ONLY task.
3. Preserve the approved conclusions in `PROFLOW_PROJECT_CONTEXT.md` and/or `PROFLOW_HANDOFF.md`, per each file's role (§30).
4. Only after continuity documentation is reviewed may the project move to the next implementation/test workstream.

Purpose: avoid losing important project knowledge while preserving the strict read-only nature of audits. This rule does not expire and does not need to be re-requested by the project owner in future sessions.

## §35. PROFLOW_TODO.md — Backlog Continuity Rule — PERMANENT REQUIREMENT

`PROFLOW_TODO.md` is now formally recognized as the third primary continuity document alongside this file and `PROFLOW_HANDOFF.md` (see §0.A). Responsibility split:

- **`PROFLOW_PROJECT_CONTEXT.md`** (this file) = durable project truth — architecture, iron rules, verified findings, continuity protocol, high-level current state.
- **`PROFLOW_HANDOFF.md`** = exact operational checkpoint/resume state for the next session.
- **`PROFLOW_TODO.md`** = the authoritative living work backlog/roadmap — all known work items, their current status, dependencies, and verification requirements.

**Rule**: a material backlog/status change (an item completed, reopened, newly discovered, or reprioritized) must update `PROFLOW_TODO.md`. This file must **not** duplicate the full backlog — reference `PROFLOW_TODO.md` by item number instead of copying its content here. A future AI/session must read `PROFLOW_TODO.md` and identify the current owner-approved priority before beginning a new workstream — an item's presence in the backlog as OPEN is never, by itself, authorization to start it.

## §36. Test-First / Owner-Gated Live Release Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to ALL future ProFlow work — not an item-14-only instruction, does not expire, does not need to be re-requested.** Covers every change category without exception: UI/UX, frontend logic, backend logic, Auth, Routing, Billing, Supabase, DB/schema, RLS, Edge Functions, email flows/templates, API behavior, automation, configuration, and any other product/system change.

**Required sequence for every change:**
1. Implement in the TEST/development environment first (per §18, localhost/working-tree — never production-first).
2. Verify the change there (lint/build/tests/manual/browser-harness as applicable).
3. The project owner personally reviews the result where relevant.
4. The owner gives **explicit approval** for LIVE/production.
5. Only then may the change be moved/deployed to LIVE/production.
6. After deployment, perform an appropriate controlled production smoke check.

**TEST PASS does NOT equal PRODUCTION APPROVAL.** Code review, lint, build, automated tests, Claude's own verification, another agent's verification, or browser-harness verification **never** substitute for the owner's explicit LIVE approval (this extends, and does not relax, §20/§21's existing commit/push gating — those sections remain in force). No direct production-first implementation is permitted unless the owner explicitly authorizes a specific, named emergency exception.

**Unsaved-work / user-safety principle**: when a change can affect an active user session, the test and rollout design must consider preservation of unsaved user work. Never introduce forced refresh/reload/session behavior that can silently discard user input. This is consistent with, and does not duplicate, `PROFLOW_TODO.md` item 15 (New Version Available / Safe Refresh Notification) — that item's own critical safe-refresh requirement is the concrete instance of this general principle.

## §37. Hebrew RTL / English LTR UI Parity Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to ALL future UI/UX work that touches both markets — not an item-14-only instruction, does not expire.**

**Same-pass requirement**: every future UI/UX change applicable to both Local and International must be implemented in **both** language/direction experiences in the **same work pass**. Implementing Hebrew now and leaving English "for later" is not acceptable — English/International is never an optional follow-up, and vice versa.

- **Local / Hebrew**: Hebrew text, RTL direction, correct RTL composition, correct RTL element order, correct alignment, correct icon/control placement, Local market/currency behavior preserved (§4/§8/§9).
- **International / English**: English text, LTR direction, correctly mirrored/recomposed LTR layout, correct LTR element order, correct alignment, correct icon/control placement, International market/currency behavior preserved (§5/§8/§9).

**Direction is more than CSS.** `direction: rtl`/`ltr` alone does not prove parity — the actual visual composition must be checked. Example: if a Hebrew section has *title + Export control on the right* and *Search + Status filter on the left*, the English/LTR equivalent should intentionally mirror that structure — *title + Export control on the left*, *Search + Status filter on the right* — unless a specific UX reason requires otherwise. Applies to headers, nav, tables, forms, modals, cards, action bars, icons, breadcrumbs, toolbars, mobile layouts, Public Quote, Business Owner UI, Super Admin, and any future interface.

**Dual verification rule**: a UI change is **not** fully verified merely because the Hebrew version works. The final report for every relevant UI task must classify Local and International **separately** — Local Hebrew/RTL: PASS/FAIL/BLOCKED/NOT TESTABLE; International English/LTR: PASS/FAIL/BLOCKED/NOT TESTABLE. "Same code," "mirrored code," "shared component," or "should work" are **not** sufficient evidence for a PASS on either side. Verify both visually/at runtime where reasonably possible; if one side cannot be tested, state that explicitly rather than inferring a result.

**Market isolation remains strict — UI parity is not a license to merge market behavior.** This rule extends, and does not replace or weaken, §23 (Local + International Regression Requirement) and the Iron Rule market separation (§4/§5/§6/§8/§9): never contaminate currency, VAT/tax behavior, `signup_market`, `business_settings.country`, locale, or any other market-specific behavior in the name of visual/UX parity. Visual parity and market separation are both mandatory, simultaneously, never traded off against each other.

**Question/blocker rule preserved**: if stuck, or a genuine question/ambiguity arises on one sub-item, record it, document it, block **only** that sub-item, and continue immediately with the next independent, safe item (see `PROFLOW_TODO.md`'s "Permanent Question / Ambiguity Rule"). A full-task STOP applies only for genuine production/security/data/destructive risk — never for one isolated blocked sub-item.

## §38. Task Effort-Level Declaration Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future task given to Claude on this project — not a one-time instruction, does not expire.**

**A. Every task must begin with an explicit effort level**: `EFFORT LEVEL: LOW / MEDIUM / HIGH / MAXIMUM`, stated before execution begins. This applies to a task set by the owner and, equally, to any task a session sets for itself when self-directing follow-up work.

**B. The level is selected by risk, scope, complexity, and required depth — never by remaining Claude usage/quota.** See §E below — usage percentage must never drive the level chosen, in either direction (never inflated to "look thorough," never deflated to save quota).

**C. General guidance**:
- **LOW** — tiny, isolated, low-risk inspection/documentation task; a simple lookup or narrowly scoped verification; no architectural/security/data implications.
- **MEDIUM** — normal bounded implementation or investigation; a limited set of files/components; dependencies already understood; moderate verification required.
- **HIGH** — multi-file or multi-surface work; UI changes requiring Hebrew RTL + English LTR parity (§37); authentication/domain/session behavior; database-related analysis; production-sensitive behavior; significant regression risk; deep diagnostics; workflow/rule changes (including this file's own permanent sections).
- **MAXIMUM** — architecture/security/auth redesign; migrations or destructive/data-sensitive operations; production incidents; broad refactors; high-risk cross-system changes; any task where a mistake could materially affect LIVE users/data; exceptionally deep audits where exhaustive reasoning is warranted.

**D. Effort level never overrides any existing safety rule, and higher effort is never permission for broader scope.** In particular, regardless of the declared level: TEST-first remains mandatory (§36); owner approval remains mandatory before LIVE (§36); no commit/push/deploy without separate authorization under existing project rules (§21); the Hebrew RTL/English LTR same-pass rule remains mandatory wherever applicable (§37); market isolation remains mandatory (§4/§5/§6/§8/§9/§23/§37); and Claude must still stop and ask wherever an existing owner-gated rule requires it, regardless of how much effort was declared. A HIGH or MAXIMUM effort level authorizes deeper reasoning and verification for the task as scoped — it does not authorize touching more files, surfaces, or systems than the task itself defines.

**E. Usage percentage must never drive effort or scope.** Available weekly/session Claude usage must not cause artificial token burning (padding a LOW task into something that reads as MEDIUM/HIGH) or unnecessary corner-cutting (compressing a task that genuinely needs HIGH/MAXIMUM reasoning down to save quota). Use the effort the task genuinely requires, independent of how much usage remains.

**F. Discoverability**: a new/cold-start session must be able to discover this rule on its own, without being told about it again. It is indexed via the standard four-document reading order (§0.A, §1) — any session reading this file in full, as required, will reach this section.

## §39. Pre-Task Four-Document Read + TODO Reconciliation Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future task on this project — not a one-time instruction, does not expire.** Introduced during the Baseline Closure Pass (2026-08-28).

**A. Before any code change on a new task**, read all four project documents in full: `PROFLOW_PROJECT_CONTEXT.md` (this file), `PROFLOW_HANDOFF.md`, `PROJECT_CONTEXT.md` (if present as a separate file from this one in a given checkout), and `PROFLOW_TODO.md` — with **special emphasis on `PROFLOW_TODO.md`**, since it is the backlog most likely to contain overlapping, already-scoped, or already-answered work relevant to the new task.

**B. Identify overlapping TODO items** before starting implementation. If the new task substantially overlaps an existing OPEN/PARTIAL TODO item, fold the overlapping work in safely (implement it together, don't duplicate effort or create a second parallel description of the same gap) rather than treating the new task as if the backlog didn't already know about it.

**C. Never mark a TODO item complete merely because code was written.** An item may only be described as IMPLEMENTED/complete once it has been genuinely verified (live-verified where credentials/environment allow, code-verified with that fact stated honestly where they don't — see §37's dual-verification discipline for the UI-parity case specifically). Code existing in the working tree is not, by itself, evidence of correctness.

**D. After the task, re-read `PROFLOW_TODO.md` again** and reconcile: remove/close items that were genuinely implemented and verified this pass (recording the completion in `PROFLOW_HANDOFF.md`, not just deleting the TODO line silently); leave PARTIAL items open with the exact remaining work stated; leave BLOCKED items open with the exact blocker stated; correct any wording in the backlog that turns out to have been a misdiagnosis (e.g. describing required, intentional market-specific behavior as if it were a defect).

**E. If an overlapping TODO item requires LIVE/DB work** that the current task is not authorized to perform, **STOP and report** — do not silently expand the current task's scope to cover it, and do not silently skip mentioning the overlap either. Name the overlapping item, state why it's blocked, and let the owner decide whether to authorize it separately.

## §40. Mid-Task Requirement Capture Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future task on this project — not a one-time instruction, does not expire.** Introduced during the Baseline Closure Pass (2026-08-28).

Any requirement, correction, or decision the owner gives **mid-task** (a clarification, a scope change, a corrected assumption, a new constraint) must be recorded in `PROFLOW_TODO.md` and/or `PROFLOW_HANDOFF.md` if it is not implemented immediately in that same pass. The goal: a future session with no memory of this conversation must be able to recover the exact requirement from the documentation alone — an owner instruction that only ever existed in chat history is, for continuity purposes, lost. This applies regardless of how small the correction seems.

## §41. Browser QA Resource Discipline Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future browser-harness-based QA/verification task on this project — not a one-time instruction, does not expire.** Introduced during the Baseline Closure Pass (2026-08-28).

- Keep only the minimum necessary tabs/pages open for the verification actually in progress.
- Close a QA tab immediately once it has served its purpose — do not leave stale/completed tabs open "in case they're needed again."
- Do not accumulate dozens of tabs across a task; clean up continuously, not only at the very end.
- **Never close a tab the Owner created themselves** — only close tabs Claude itself opened for QA purposes. If uncertain whether a tab is Owner-created, leave it alone and ask rather than closing it.
- Close all Claude-created QA tabs at task completion (a small number of harness-internal tabs, e.g. the CDP `/json/version` inspector tab, are not real work tabs and do not need to be treated as QA clutter).

Rationale (owner's own framing): the Owner's workstation must not be unnecessarily consumed by browser QA activity.

## §42. Global Surface Consistency Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future change on this project — not a one-time instruction, does not expire.** Introduced after the Global Surface / Presentation / Consistency Audit (2026-08-28) found no equivalent rule existed anywhere in the four canonical documents, and separately found a live, deployed example of exactly the failure mode this rule exists to prevent (§44's money-formatter finding).

When a product requirement changes any of: data, formatting, label, direction, business logic, money, currency, tax behavior, quote number, address, recipient information, or responsive presentation — **implementation must not stop at the first visible component.**

Before implementation:
- identify every relevant consumer/surface;
- every language (Hebrew/English);
- every market (Local/International);
- every viewport (Mobile/Desktop);
- every output channel (in-app UI, email, WhatsApp/share text, CSV/export, PDF/print where applicable).

**Implementation is not DONE until every applicable surface has been handled and independently verified.** A PASS on one surface must never hide old/broken behavior on another surface — the money-formatter finding is the concrete cautionary example: a formatter fixed on the Public Quote page alone would have left the exact same defect live in the Dashboard KPI, Quote History, Quote Form, Catalog, Finances, CSV export, WhatsApp text, and the deployed email function.

This rule is the general principle behind, and does not duplicate, §37 (Hebrew RTL/English LTR UI Parity — the language/market instance of this same discipline) and §39 (Four-Document Pre-Read + TODO Reconciliation — the process instance). All three should be read together for any cross-surface change.

## §43. Owner Working Style & Implementation Decision Protocol — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every future task on this project — not a one-time instruction, does not expire.** Introduced 2026-08-28.

1. **Actual result overrides reported PASS.** For visual/product requirements: if Claude reports PASS but the Owner physically reviews the result and says it does not match the approved target, it is NOT accepted — the Owner's own review is the final word, not the automated report.
2. **Owner visual acceptance is a real gate.** Measurements, browser emulation, and screenshots are evidence, but do not replace Owner physical/visual acceptance where Owner approval is required.
3. **End-to-end, not partial.** If a requirement affects multiple surfaces, fixing only one surface is not completion (see §42).
4. **Audit before implementation when impact is unclear.** If it is unclear where a change propagates, map files/consumers/dependencies/surfaces before editing.
5. **Do not invent product decisions.** If product intent is missing or ambiguous, report BLOCKED / ASK OWNER — never invent parity, VAT behavior, currency behavior, labels, or workflows.
6. **Parity does not mean identical business rules.** Local/Hebrew and International/English should have equivalent product quality, but must preserve market-specific RTL/LTR, language, currency, tax, address conventions, and business rules (see §4/§5).
7. **Owner intent beats literal mechanical interpretation.** If the Owner's intended visual/business target is clear, do not mechanically satisfy only a numeric phrase (e.g. "reduce by 10%") and declare success while missing the intended result. If intent is ambiguous, ask/report before implementing — do not guess silently.
8. **Close safe work completely.** The Owner prefers a feature completed cleanly over small known fragments deliberately left for later, provided doing so does not materially increase production/security risk.
9. **Safety still overrides speed.** None of the above overrides TEST-first rules (§36), DB safety, LIVE safeguards, backup/rollback gates, or explicit approval requirements.
10. **Do not send an implementation pass while the Owner is still collecting feedback.** When the Owner is still sending screenshots/notes or explicitly says there is more, wait until requirement collection is finished before preparing the implementation pass.
11. **No automatic commit/push/deploy.** Implementation completion never implies authorization for staging/commit/push/deploy/LIVE (see §21/§36).
12. **Visual quality is a product requirement.** Width, alignment, hierarchy, responsive behavior, spacing, color, and composition are not "cosmetic extras" in ProFlow.

See `PROFLOW_HANDOFF.md`'s pointer to this section for the implementation pass that introduced it — the full text lives here only, not duplicated there.

## §44. Global Money Display & Numeric Alignment Rule — PERMANENT REQUIREMENT

**Owner decision, standing rule, applies to every money-displaying surface on this project — not a one-time instruction, does not expire.** Introduced after the Global Surface Audit found three divergent money-formatting implementations, two of which silently discarded cents (see `PROFLOW_HANDOFF.md`'s implementation-pass entry for the full before/after evidence).

**A. Formatting must never silently change the business value.** `1234.56` must format as `1,234.56`, never `1,235.00`. Formatting (textual presentation) and business rounding (an actual change to what number is being displayed) are separate responsibilities and must never be conflated inside a general-purpose formatter.

**B. Canonical formatter.** `src/utils/money.js`'s `formatMoney(value, locale)` is the single source of truth for frontend money-display formatting — preserves cents, no unconditional `Math.round()`. `Dashboard.jsx`'s and `PublicQuoteEn.jsx`'s own local `formatNum` now delegate to it (kept as thin same-signature wrappers rather than touched at every call site, to avoid unnecessary churn across the many components that receive `formatNum` as a prop). `send-quote-email/index.ts` (a Deno Edge Function, a separate runtime that cannot import from `src/`) keeps a deliberately synchronized inline equivalent — any future change to `formatMoney`'s rounding behavior must be manually mirrored there.

**C. The one deliberate exception: Local/ILS final-payable-total whole-shekel rule.** This is **not** implemented inside the general formatter — it lives exclusively in `PublicQuote.jsx` as three explicitly named values (`finalTotalRounded`, `netAmountDisplay`, `vatAmountDisplay`), computed once for the one display site that needs it (the customer-facing Hebrew Public Quote page). The displayed Net + VAT always sum to the displayed (rounded) Final Total exactly to the cent — never a display-only rounding that leaves the intermediate rows inconsistent. International retains full, unrounded cent precision everywhere, always — there is no whole-unit rounding rule for any currency other than this one named Local/ILS case.

**D. Global money numeric alignment.** A monetary amount is numeric LTR content in every language, including inside Hebrew RTL UI. The actual requirement is **physical place-value alignment across a column of amounts**: units under units, tens under tens, the decimal separator and decimal digits aligned — not merely a shared starting edge.

**Corrected (Owner visual rejection, second pass — do not repeat this mistake)**: `.pf-money` (`font-variant-numeric: tabular-nums` + `direction: ltr; unicode-bidi: isolate`) is **necessary but NOT sufficient** on its own. It only makes one amount's own digits equal-width and LTR-ordered — it does nothing to pin a shared right edge across sibling rows. The real mechanism requires **all three** together:
1. `.pf-money` itself (digit shape/order/bidi-isolation) — unchanged, still apply to every monetary amount span/div, only to the money-string element itself (currency symbol + digits), never to a container that also holds label text (or the label gets forced LTR too).
2. **Physical `text-align: 'right'`** on the money element — always, never conditional on `isHebrew`. Money always right-anchors regardless of language, because the ones-digit/decimal point is always the rightmost character of the string.
3. **A shared/consistent amount-column width across the sibling rows being aligned.** A native `<table>` column or a CSS Grid column (`grid-template-columns`) provides this automatically — all cells in that column share one computed width. **N independent flex rows using `justifyContent: 'space-between'` do NOT** — each row is its own formatting context with a shrink-to-fit amount box, and critically, under RTL the amount (as the flex "end" item) pins its **left** edge, not its right — the wrong edge for numeral alignment. This was the exact root cause of the second-pass rejection, live-measured before the fix (three totals rows sharing left=524.5px, right edges all different) and re-measured identical after converting to a shared CSS Grid (right edges matching within sub-pixel tolerance at every tested viewport). See `PublicQuote.jsx`'s totals card/item table and `QuoteForm.jsx`'s totals for the reference implementation, and `PROFLOW_HANDOFF.md`'s corresponding entry for the full measured evidence.

English/LTR surfaces using the same flex-row pattern are not automatically broken by this same mechanism — under LTR the flex "end" item pins the physical **right** edge, which happens to be the correct anchor already. Do not convert an English surface to the grid structure "for symmetry" without first confirming (by measurement) that it is actually broken.

**E. Coordinated quote-number release requirement.** When `quote_number` is eventually migrated to the live database, the DB migration and both dependent Edge Function deployments (`get-public-quote`, `send-quote-email`) must be treated as **one coordinated release step**, not sequenced — landing the migration before the Edge Functions are redeployed would let the Dashboard (direct table read) show the new friendly number while Public Quote (via the not-yet-redeployed Edge Function) kept showing the old fallback, reproducing exactly the cross-surface inconsistency this rule and §42 exist to prevent. See `PROFLOW_TODO.md` item 17 for the full migration package status.

## §45. Canonical Desktop Content Width — PERMANENT REQUIREMENT

**Owner decision, standing rule, does not expire.** The authenticated application and Public Quote (both languages) previously used two independently-chosen Desktop `max-width` values (1040px vs. 980px), rejected by the Owner as an inconsistency — a direct instance of exactly the failure mode §42 exists to prevent.

**Canonical value: `980px`**, shared by every Desktop content surface — the authenticated app's shared content wrapper (`Dashboard.jsx`) and Public Quote HE/EN (`PublicQuote.jsx`/`PublicQuoteEn.jsx`). Sourced from one CSS custom property, `--pf-desktop-content-width` (defined once in `src/index.css`), referenced via `var(--pf-desktop-content-width)` at every consumer instead of a locally-duplicated literal pixel value. Each consumer keeps its own pre-existing gating behavior (Public Quote's rule stays scoped to `@media (min-width:1024px)`; the authenticated app's wrapper stays unconditional, naturally inert below the value on real Mobile viewports) — only the number itself is single-sourced.

**CORRECTED (Owner + ChatGPT approved width-consistency audit, third pass) — the token means VISUAL CONTENT width, never outer-shell/wrapper width.** The first implementation of this rule applied the token directly to Public Quote's outer white document shell's own `max-width`, which made the *shell* 980px while the actual visible content inside it (purple header, recipient/Attn area, items table, attachments, terms/notes) was only 898px — the shell's own decorative `40px` padding + `1px` border (per side) ate 82px that the token never accounted for. Live-measured and Owner-confirmed as a real defect: Dashboard's purple banner at 980px vs. Public Quote's at 898px, an 82px/8.4% mismatch, constant at every Desktop breakpoint. **Fixed**: two additional CSS variables, `--pf-doc-shell-padding` (`40px`) and `--pf-doc-shell-border-width` (`1px`), also defined in `src/index.css`. Public Quote's shell `max-width` is now `calc(var(--pf-desktop-content-width) + (2 * var(--pf-doc-shell-padding)) + (2 * var(--pf-doc-shell-border-width)))` — i.e. the shell is deliberately *wider* than 980px by exactly its own decorative inset, so the content sections inside it (plain block children filling the shell's content box) land on exactly 980px automatically. `Dashboard.jsx` needed no change — its content wrapper has no equivalent padding layer between the wrapper and its visible content, so applying the raw token there was already correct from the start.

**Any future change to the padding or border of Public Quote's document shell must update `--pf-doc-shell-padding`/`--pf-doc-shell-border-width`, never be hand-edited as a bare literal** — every `calc()` that derives the shell's outer width from the content token stays correct automatically as long as these two variables reflect the shell's real decorative inset. If a future task finds a *fourth* surface that should share the canonical `980px`, add it against the *content* layer of that surface, not any padded wrapper around it.

**RESOLVED (Final Local Polish Pass) — the scrollbar-driven center-axis caveat above.** The two surfaces' horizontal center could differ by however many pixels a vertical scrollbar consumes, whenever one page's content was tall enough to trigger scrolling at a given viewport height and the other wasn't — Chromium reserves scrollbar width from the layout viewport asymmetrically (physical right only), shifting a centered flex container's midpoint left by half the scrollbar's width. Confirmed directly before the fix (Dashboard with short test-account content: no scrollbar, centered exactly on `viewport/2`; Public Quote's necessarily-longer document content: scrollbar present at every tested Desktop height, centered ~7.5px left of `viewport/2` at every breakpoint). **Fixed with `html { scrollbar-gutter: stable; }`** (`src/index.css`, global, root-level — confirmed via repo-wide search this app has no custom app-level scroll container, so `html` is the correct and only relevant scope) — this reserves the scrollbar gutter unconditionally, so the layout viewport (and every centered layout's midpoint) is now identical regardless of any given page's own content height. Live-verified: both surfaces now measure the exact same centerX at every Desktop breakpoint (675.5/712.5/952.5 at 1366/1440/1920), a 0px difference where there was previously a constant 7.5px gap. Deliberate, expected side effect: a short/non-scrolling page now always reserves a small blank gutter on its right where a scrollbar *would* go, rather than using that space for content — the documented tradeoff of the property, and the only way to make the center axis content-height-independent without a JS-measured/compensated layout. No measurable Mobile effect (overlay scrollbars there never consumed layout width in the first place; confirmed unchanged via live re-measurement).

Mobile is unaffected by either the width or the centering rule — no Mobile surface's width depends on these variables; Public Quote's own `@media (max-width:640px)` override continues to set its shell padding to a much smaller, independently-hardcoded `2px`; `scrollbar-gutter: stable` has no observable effect on Mobile browsers' overlay scrollbars.

## §46. Quote Number Presentation Consistency — PERMANENT REQUIREMENT

**Owner decision, standing rule, does not expire.** The Public Quote quote-number block (Hebrew: "מספר הצעה" / English: "Quote Number", two lines, value centered under the label) must use the **identical structure whether displaying a real `quote_number` or the pre-migration fallback identifier** — the label is never conditionally hidden just because a real number isn't available yet. This applies to `PublicQuoteHeader.jsx`'s Desktop and Mobile branches alike (a real gap found and fixed in the Final Local Polish Pass: the Mobile fallback branch previously showed a bare, uncentered hash with no label at all, while the Desktop fallback branch showed the hash centered but still without a label — neither matched the real-number branch's own composition).

**Canonical fallback source and length**: `src/utils/quoteNumber.js`'s `formatQuoteFallback(quote)` is the single source of truth for the pre-migration display value across the entire app — `formatQuoteNumber(quote.quote_number) || '#' + quote.id.slice(0, 8)`. Every consumer must call this function (or, for the one Deno Edge Function that can't import it, keep a manually-synchronized inline equivalent — see below) rather than constructing its own truncated-UUID string. **Do not introduce a third fallback length or casing convention** — a repo-wide sweep this pass found and unified three additional stray `.slice(0, 6)` instances (`Dashboard.jsx`'s delete-confirmation dialog and quote-update success message, `send-quote-email/index.ts`'s email-subject fallback, previously `.toUpperCase()`'d there specifically) that had drifted from the canonical 8-character, non-uppercased format.

**Known, currently-manifesting exception requiring separate future work**: `supabase/functions/get-public-quote/index.ts` already selects and returns `quote_number` locally, but has **never been deployed** with that change — so the live Public Quote page cannot show a real number today even where one exists in the database (see item 17's own urgent correction in `PROFLOW_TODO.md` for the full, surprising detail: a live `quote_number` mechanism independent of this repo's own unapplied migration was discovered this pass, already populating real values, with Dashboard and Public Quote consequently showing genuinely different identifiers for the same quote **right now**, live). Deploying that Edge Function is not authorized by this rule alone — it requires the same explicit, separate authorization as any other LIVE change, ideally as part of the coordinated release described in §44.E.
