# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only. THIS VERSION IS LOCAL ONLY — NOT COMMITTED, NOT PUSHED**, per this task's own explicit instruction (audit + design only). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.**

---

## Task: PROFLOW — Safe Continuity Branch Design (Audit + Design Only, Nothing Created)

**Effort level**: MEDIUM. **Owner + ChatGPT approved.** AUDIT + DESIGN ONLY — no branch created, no commit, no push, no Vercel change, no Production change, no DB change, no deploy.

### 1. Fresh Git Baseline

`HEAD == origin/main == 17ac4d3a950d96f4167f9b320c82b4798382d621`, unchanged throughout. Working tree: `.gitignore` (modified) plus the six documentation files modified locally by the prior task (`PROFLOW_ARCHITECTURE.md`, `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_CLAUDE_LATEST_REPORT.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_TODO.md`), plus the untracked migration package — all preserved exactly, none touched by this task.

### 2. Existing Branches/Remotes

`git branch -a`: only `main` (local) and `remotes/origin/main` (`remotes/origin/HEAD -> origin/main`) exist. **No other branch exists anywhere, locally or on the remote — a `proflow-continuity` branch would be entirely new.** `git remote -v`: single remote, `origin` → `https://github.com/quotecode-dev/quotecode-clean.git` (fetch + push).

### 3. Current Vercel Evidence (read-only inspection only — no Vercel CLI available in this environment, no login/link/settings change attempted or possible)

- **`vercel.json`** (repo root): contains `rewrites` (SPA fallback), `headers` (security headers + `X-Robots-Tag` per-route), and `crons` (one daily cron). **Contains no `ignoreCommand`, no `git.deploymentEnabled` setting, and no branch-restriction configuration of any kind.** REPO-VERIFIED.
- **No `.vercelignore` file** found at repo root. REPO-VERIFIED.
- **No `.vercel/` directory** found locally (would normally hold a local CLI project link) — this working directory has never been `vercel link`-ed. REPO-VERIFIED.
- **Vercel CLI is not installed/available** in this environment — no dashboard/project-settings inspection was possible beyond what's committed to the repo itself. CONFIRMED ABSENCE, not a workaround attempted.
- **Owner-verified fact** (from the prior task, carried forward, not re-derived): `main` is Vercel's configured **Production branch**, and every push to it triggers a Production deployment.

### 4. Proven vs. Inferred vs. Unknown

- **PROVEN** (repo-level, direct inspection): `main` is the only branch that exists today; `vercel.json` contains zero branch-specific deployment logic; no local Vercel CLI link exists.
- **OWNER-VERIFIED** (prior task, not re-derived this task): push to `main` → Production deployment.
- **INFERRED, NOT PROVEN**: standard Vercel-GitHub integration behavior (general platform knowledge, not confirmed for *this* project's actual dashboard settings) is that pushing a **new, non-Production branch** to a connected GitHub repo typically triggers a **Preview** deployment (an isolated, non-Production build/URL) by default, unless the Vercel dashboard's Git settings have been configured to restrict which branches build at all. Nothing in this repo proves or disproves whether that restriction exists for this specific project.
- **UNKNOWN**: whether pushing a brand-new `proflow-continuity` branch (containing only Markdown files, no `package.json` changes) would (a) trigger no build at all, (b) trigger a Preview build that succeeds trivially (static docs, no app code to build against — though Vercel would still run `npm run build` unless told not to, which could even *fail* on a docs-only branch missing nothing relevant, or succeed harmlessly since the repo's existing `build` script doesn't care which branch it's on), or (c) trigger something else. **This cannot be proven from this environment.**

### 5. Recommended Continuity Architecture

**Conceptual model** (matches the Owner's own preferred model): Claude local → six ProFlow documents → dedicated `proflow-continuity` branch → GitHub → ChatGPT reads that branch directly via a GitHub URL/ref, never via `main`.

**Branch design**: `proflow-continuity` should be created as an **orphan branch** (`git checkout --orphan` / `git worktree add --orphan`) — i.e. a branch with **no shared history with `main` at all**, containing from its very first commit only the six documents and nothing else. This is a stronger isolation guarantee than branching off `main` and then deleting everything else: an orphan branch can never, even by accident, carry any application/source/migration file in its history, because it never had one to begin with.

### 6. Exact Isolation Mechanism

**Recommended: a dedicated `git worktree`, not a branch-switch in the existing working directory.**

- `git worktree add <path> proflow-continuity` creates a **second, independent working directory** (e.g. a sibling folder to the current repo, or under the scratchpad) checked out to `proflow-continuity`, while the current working directory stays exactly on `main` with all its uncommitted application/migration work completely undisturbed — no `git checkout`, no `git stash`, no risk of the local working tree's in-progress files ever touching the continuity branch.
- **Sync procedure per task**: (1) update/reconcile the six documents in the normal working directory as already done today; (2) **copy** (plain file copy, not a git operation) the current content of the six documents from the main working directory into the continuity worktree directory; (3) inside the continuity worktree only: secret/privacy scan, `git add` the six files explicitly (never `.`/`-A`), commit, push `proflow-continuity` only.
- This makes the data flow strictly **one-directional and explicit** (working directory → copy → continuity worktree → commit → push) — there is no git merge/rebase step that could pull anything unintended into continuity, and no risk to the primary working tree's own uncommitted state at any point.
- The worktree itself is a **one-time local setup step** (not yet performed) — after that, each future sync is just 6 file copies + a scoped commit + a scoped push, entirely mechanical and low-risk to repeat.

### 7. Six-Document Synchronization Procedure (future, once authorized)

1. Update/reconcile the six documents in the normal working directory (as already practiced).
2. Copy the current content of the six documents into the `proflow-continuity` worktree directory.
3. Secret/privacy scan the resulting diff in the continuity worktree.
4. Explicit staging of only the six changed files (never `git add .`/`-A`/`--all`) inside the continuity worktree.
5. Commit (continuity worktree only).
6. Push **only** `proflow-continuity` — never `main` — from the continuity worktree.
7. Verify `origin/proflow-continuity` matches the new local commit.
8. **`main` is never pushed automatically as part of this procedure**, under any circumstance.
9. Report the continuity commit SHA to the Owner.

Note: since the working directory documents and the continuity worktree's documents are two separate file locations reconciled only by explicit copy, the standing "documentation-only allowed file set" and "never `git add .`" rules from `PROFLOW_PROJECT_CONTEXT.md` §17.E apply identically inside the continuity worktree, with no exception.

### 8. Main/Continuity Divergence Handling

- **During normal (non-release) work**: `proflow-continuity` is the freshest, authoritative source for the six documents. `main`'s copies of those same six files become intentionally stale the moment continuity is updated ahead of it — this is expected and safe, since `main`'s own documents were never the ChatGPT-facing read path to begin with once this workflow is live.
- **At an explicitly-authorized main application release** (e.g. the next `ffc741d`-style commit): that same authorized event should **also** bring `main`'s copies of the six documents up to the freshest available version (from `proflow-continuity` or the current local working tree, whichever Claude Lead confirms is actually newest) — so `main` never permanently drifts arbitrarily far behind. This reconciliation is a deliberate, Claude-Lead-reviewed step at release time, not an automatic merge.
- **Conflict detection**: before any such reconciliation, diff the six files between `proflow-continuity`'s `HEAD` and `main`'s `HEAD` directly (`git diff main..proflow-continuity -- <six files>`). If both branches have independently changed the same file since their last common point, this must be **manually reconciled** by Claude Lead reading both versions and merging the actual content — never an automatic git merge for these files, since they are prose/structured Markdown where a naive merge could silently interleave contradictory statements (e.g. two different "CURRENT EXACT CHECKPOINT" blocks) without raising a real conflict marker in every case.
- **Why continuity must never blindly overwrite newer `main` content**: if `main` received a documentation update through some other explicitly-authorized path (e.g. a future task that intentionally updates and pushes `main` directly with Owner's specific sign-off), a routine continuity sync should never silently clobber that with older content — the sync procedure's step 2 (copy from the *current local working directory*, which itself should already reflect anything relevant from a recent `main` pull) is the mechanism that prevents this in normal operation, but Claude Lead should still spot-check `main`'s current state before a continuity sync if there's any reason to suspect `main` moved independently.

### 9. ChatGPT Direct-Read Procedure

Once this workflow is authorized and live, ChatGPT reads the six documents from `https://github.com/quotecode-dev/quotecode-clean` using `ref = proflow-continuity` (e.g. via the GitHub connector's branch/ref selection, or a raw URL of the form `.../refs/heads/proflow-continuity/<file>`), never via `main`'s default ref. The Owner's existing trigger phrases (magic phrase, "קלודי סיים — תקרא את הדוח האחרון") would need a small update to specify this ref explicitly once the workflow goes live — drafted in §12 below, not yet applied to any document.

### 10. Vercel Safety Analysis

Per §3–4: no repo-level evidence rules out a new branch triggering *some* Vercel build activity, and no repo-level evidence confirms it either. The task's own explicit standing rule (`PROFLOW_PROJECT_CONTEXT.md` §17.E, corrected in the immediately prior task) is that **any** push whose Vercel consequence is not confirmed must not be treated as automatically safe — this was exactly the mistake already made once this engagement with documentation-only pushes to `main`. Creating and pushing an entirely new branch is a different action with unconfirmed consequences of its own, not a proven-safe variant of the same mistake.

### 11. VERCEL SAFETY GATE VERDICT

**VERCEL VERIFICATION REQUIRED FIRST.**

Before any branch is created or pushed, recommend the Owner perform one simple, read-only check in the Vercel dashboard: **Project Settings → Git** — confirm (a) the configured Production Branch (already known: `main`), and (b) whether Preview Deployments are enabled for all branches or restricted to specific patterns. Two safe outcomes follow:

- If Preview Deployments are already restricted/disabled for arbitrary new branches, or can be restricted for this specific branch name via an **Ignored Build Step** (a simple bash condition checking the branch name, configurable without any project-linkage change) — this is the **recommended** configuration regardless of safety, since a documentation-only branch has no reason to ever consume a Vercel build at all, and Owner can set this up as a one-time, low-risk dashboard change (not something Claude can do — no Vercel CLI/dashboard access from this environment).
- If Preview Deployments are enabled platform-wide and Owner is comfortable accepting that `proflow-continuity` will produce ordinary, isolated Preview URLs (which do not affect `www.quotecodepro.com` or Production data in any way) as a known, accepted tradeoff, that is also an acceptable outcome — but it should be a **decision**, not a discovery, which is exactly why this task stopped short of creating anything.

### 12. Permanent Rule Draft (NOT applied to any document yet — proposal text only)

**Draft addition for `PROFLOW_PROJECT_CONTEXT.md` (new §17.J, proposed):**

> ### 17.J Continuity Branch (`proflow-continuity`) — Six-Document Transport Path (DRAFT, not yet active)
>
> A dedicated orphan branch, `proflow-continuity`, carries only the six canonical/report documents (`PROFLOW_ARCHITECTURE.md`, `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_CLAUDE_LATEST_REPORT.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_TODO.md`) via a dedicated `git worktree`, never the primary working directory. It exists specifically so routine documentation synchronization never requires a push to `main` (which triggers a Vercel Production deployment for this repository, confirmed §17.E). Application/source/migration files must never enter this branch's history under any circumstance. `main` remains the sole application/Production source-of-truth branch; a push to `main` still requires its own explicit Owner + ChatGPT authorization regardless of this branch's existence. `proflow-continuity` may hold newer document content than `main` during normal work — this must never be misread as application source state. At an explicitly-authorized `main` release, documentation is reconciled back into `main` as a deliberate, reviewed step, never an automatic merge.

**Draft addition for `PROFLOW_CHAT_HANDOFF.md` (new §15.B, proposed):**

> ## 15.B Reading the six documents from `proflow-continuity` (DRAFT, not yet active)
>
> Once activated, ChatGPT should read the six ProFlow documents from the `proflow-continuity` branch/ref on GitHub, not `main`'s default ref — `main` may lag behind on documentation between releases by design. This does not change the LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE rule (§15.A) — the continuity branch is a transport path, not proof of current filesystem/runtime state either.

Neither draft has been written to its target file. Both are presented here only for Owner + ChatGPT review before any future activation task.

### 13. Exact Next Setup Actions If Approved

1. Owner performs the Vercel dashboard check from §11 (and, if desired, configures an Ignored Build Step for `proflow-continuity`).
2. A future, separately-authorized task creates the orphan branch + worktree (§6), performs the first sync, and applies the two draft rules from §12 to their target documents.
3. The Owner's standing trigger phrases are updated to reference the new ref where relevant.

None of this was performed by this task.

### 14. Final `git status --short`

Recorded in the chat response following this report.

---

**NO BRANCH CREATED. NO COMMIT. NO PUSH. NO VERCEL CHANGE. NO PRODUCTION CHANGE. NO DB MUTATION. NO DEPLOY. NO LIVE CHANGE.**
