# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Phase 4 — Controlled ChatGPT ↔ Claude Code Bridge

**MODE: Owner-authorized local bridge implementation, local MCP implementation/configuration, integration with Claude Code, local process/runtime management, read-only Fresh Local State tooling, task submission/status/report workflow, safe persistence/restart design, local end-to-end testing, continuation of the already-proven tunnel path, continuity updates. NOT authorized: Production mutation/deployment/LIVE action, application commit/push, destructive git operations, customer-data access, unrestricted shell exposure, unsafe public endpoint, weakened authorization gates.**

**This is not a ProFlow product task.** It is the same local dev infrastructure line as §170 (item 56), extended.

---

## Verdict

**PHASE 4 IMPLEMENTED AND PROVEN END-TO-END, LOCALLY.** The Owner independently confirmed the Phase 3 no-auth proof through ChatGPT itself before this task began. Building on that confirmed checkpoint, a read-only Claude Code bridge was built as a strict superset of the proven proof server, swapped onto the live tunnel-target port with zero tunnel-client restart, and every task-lifecycle outcome (COMPLETED, NEEDS_OWNER_AUTHORIZATION with a real Owner notification, WAITING_FOR_CHATGPT → continue → COMPLETED) was directly proven through the real MCP `tools/call` interface. A literal ChatGPT-UI click-through of the new tools was not performed by this session (it cannot drive ChatGPT's browser) and is reported as the Owner's own remaining step, not claimed as done.

## 1. Fresh Local State

`main` HEAD unchanged (`f3b59d0`); `origin/main` at `26dee96`; `origin/proflow-continuity` at `783d864` (the §170 push). All prior uncommitted Professional Quotes hierarchy work confirmed present and untouched via a fresh `git status --short` (15 modified + 6 untracked files, identical set to §170's snapshot). Zero ProFlow application files touched by this task. Running processes independently re-inspected: `tunnel-client.exe` found as **PID 8836** (a different PID than §170's 35584 — proof the Owner had already restarted it onto the no-auth profile themselves), `node.exe` proof server as **PID 23360** on port 8765; ports 8080 (tunnel-client admin) and 8765 (MCP target) both confirmed listening before any change was made.

## 2. Existing Bridge/Tunnel State

`tunnel-client`'s own `/api/status` confirmed: `mcp_server_url: "http://127.0.0.1:8765/mcp"`, channel `"main"` `probe_status: "ok"`, tunnel `tunnel_6a981b0737d881919d9e725a6e96943d` ("ProFlow-Claude-Bridge"). This is the no-auth profile from §170, already live. The Owner had independently confirmed a real ChatGPT tool call (`echo("hello from ChatGPT")` → `"hello from ChatGPT"`) against this exact endpoint before this task began — the Phase 3 proof is Owner-confirmed, not merely locally proven.

## 3. Architecture Implemented

`C:\Users\sales\proflow-mcp-bridge\mcp-bridge-server.js` — a strict superset of the untouched `mcp-proof-server.js` (kept on disk as a rollback path). Same `serverInfo.name` (`proflow-mcp-proof`), same port (8765), version bumped `0.1.0` → `0.2.0`. Chosen deliberately so activating it requires **no ChatGPT-side reconfiguration and no tunnel-client restart** — proven: after the live swap, `tunnel-client`'s own channel probe stayed `"ok"` with zero restart of the tunnel-client process itself.

## 4. Exact Tools Exposed

`server_info`, `echo`, `uppercase` (unchanged, legacy/rollback-proof tools) plus: `claude_bridge_info` (bridge self-description), `claude_repo_status` (live `git branch`/`log -1`/`status --short`/`diff --stat`), `claude_read_file` (single-file read, hardcoded repo-root allowlist), `claude_search_repo` (`git grep --fixed-strings`, literal-text only), `claude_ask` (bounded-wait Q&A convenience wrapper), `claude_task_start`/`claude_task_status`/`claude_task_report`/`claude_task_continue` (the durable task lifecycle). **No `run_shell`/arbitrary-command tool, and no mutating tool of any kind, is exposed anywhere in this server.**

## 5. Claude Invocation Mechanism

The real native binary (`...\@anthropic-ai\claude-code\bin\claude.exe`, found by reading through the `claude.cmd` npm shim) is spawned via `child_process.execFile` with `shell:false` — the argv array is passed directly to Windows `CreateProcess`, so a ChatGPT-supplied question string can never reach a shell interpreter (no shell-metacharacter injection surface). Flags: `-p "<question>" --output-format json --allowedTools Read Grep Glob --strict-mcp-config --safe-mode --permission-mode plan [--resume <session_id>] --append-system-prompt "<marker-protocol instructions>"`. Learned and validated by direct, standalone CLI invocation before being wired into the server: `session_id`, `result`, `is_error`, and `permission_denials` are all present in the CLI's own JSON output and were used exactly as documented.

## 6. Safety Enforcement Mechanism

**Structural, not prompt-level, for the actual mutation boundary**: `--allowedTools Read Grep Glob` is a hard allowlist enforced by the Claude Code CLI's own process boundary — Read/Grep/Glob are the only tools that can physically execute inside the invocation, regardless of what the prompt asks. `--strict-mcp-config` and `--safe-mode` remove additional attack surface (no external MCP servers, no CLAUDE.md/skills/plugins/hooks/custom-commands/agents). The subprocess environment is rebuilt from a fixed allowlist (`PATH`, `SystemRoot`, `USERPROFILE`, ...) — `CONTROL_PLANE_API_KEY`/`OPENAI_API_KEY`/any Supabase credential is never forwarded even if present in the bridge's own process env. File-access tools use a separate structural gate: `resolveSafePath()` rejects absolute/UNC paths, then requires `path.relative(REPO_ROOT, resolved)` not to start with `..`, and separately blocks `node_modules`, `.git`, `.env*`. **The `NEEDS_OWNER_AUTHORIZATION`/`WAITING_FOR_CHATGPT` classification is a separate, semantic (prompt-level) layer on top of this — it is Claude self-reporting via a system-prompt-requested marker, not itself the safety boundary.** This distinction is deliberate and disclosed, not conflated.

## 7. Task Lifecycle Implementation

Each task is an in-memory + disk-persisted JSON record (`proflow-mcp-bridge\tasks\<task_id>.json`), reloaded on process restart — **directly proven**: the live port-8765 swap reloaded "4 persisted task(s) from disk" from the pre-swap scratch-port test run. States: `QUEUED` → `RUNNING` → one of `COMPLETED` / `FAILED` / `WAITING_FOR_CHATGPT` / `NEEDS_OWNER_AUTHORIZATION`. `claude_task_continue` moves a `WAITING_FOR_CHATGPT` task back to `QUEUED` and resumes the exact same Claude session via `--resume`.

## 8. WAITING_FOR_CHATGPT Behavior

When Claude's response begins with the exact marker `WAITING_FOR_CHATGPT: `, the task is set to that status and the question is surfaced via `claude_task_status`/`claude_task_report`. **Proven live**: a deliberately unanswerable prompt ("no way to determine the quote number from the repository") produced `waiting_question: "Which quote number should I look at?"`; `claude_task_continue` with an answer correctly resumed the same `claude_session_id` and reached `COMPLETED` with a correct, grounded final answer. **Disclosed limitation**: on a moderately-ambiguous (not maximally-unambiguous) prompt, Claude instead answered directly with an inline clarifying question rather than using the strict marker — the classification is best-effort, not guaranteed-deterministic.

## 9. NEEDS_OWNER_AUTHORIZATION Behavior

Triggered by the `NEEDS_OWNER_AUTHORIZATION: ` marker. **Proven live**: a prompt asking Claude to "commit and push the current uncommitted changes... right now" correctly returned `authorization_reason: "Git commit and push access (write/execute capability) to run git add, git commit, and git push to origin/main. This invocation only has read-only Read/Grep/Glob tools available — no shell execution or git mutation capability is present regardless of plan-mode status."` — and, separately, a real Windows toast notification (raw WinRT `ToastNotificationManager`, tested standalone first, then proven again through the live pipeline — `bridge.log` shows `owner-notify sent for task ...`) was fired to the Owner. Routine `WAITING_FOR_CHATGPT` questions deliberately do **not** fire this notification, so ordinary technical Q&A never interrupts the Owner.

## 10. Wake-Up/Event Investigation

**A. What works today**: request/response MCP tool calls only — ChatGPT (or a future ChatGPT turn) must call `claude_task_status`/`claude_task_report` to learn of a state change; nothing pushes into ChatGPT. **B. What was implemented locally**: durable disk-persisted task state (survives bridge restarts) + a local Windows toast to the **Owner** (not ChatGPT) specifically on `NEEDS_OWNER_AUTHORIZATION` only. **C. What requires ChatGPT/platform support**: no documented API exposes server-initiated push into an idle ChatGPT conversation to third-party MCP tunnel connectors today. **D. What cannot currently be done**: waking a specific idle ChatGPT conversation on its own without the Owner (or an OpenAI-side scheduled-task feature the Owner would have to configure themselves, unverified from this session) revisiting it. No push/event-driven ChatGPT wake-up was invented or claimed.

## 11. Persistence/Restart Implementation/Status

Audited first: `tunnel-client runtimes connect/status/stop` is the tool's own documented managed-runtime supervision mechanism ("use this command instead of nohup or disown"); `runtimes list` confirmed no alias is currently registered (the live daemon was started as a plain foreground `run` by the Owner). **Deliberately not converted this task** — would require stopping the just-Owner-confirmed-working daemon, contrary to "do not restart a proven checkpoint without evidence requiring it." Documented instead as the recommended path for the Owner's *next* restart, with the exact command written into `start-bridge.ps1`'s own comments. For the credential-free Node bridge process, a new idempotent `start-bridge.ps1` was implemented — checks port 8765 before starting anything, safe to re-run or register at Windows logon, no destructive action on a repeat run. **What remains manual by design**: `CONTROL_PLANE_API_KEY` was never captured, stored, or scripted — unattended tunnel-client auto-start would require the Owner to persist that credential at the OS level themselves, a decision this session correctly leaves to them.

## 12. Multi-Chat Behavior

Architecturally, an OpenAI connector is account-level, not conversation-scoped — any ChatGPT conversation with the connector enabled should reach the same local bridge once it is healthy, independent of "Project" membership (Project context and bridge connectivity are separate concerns). **Honestly disclosed**: this session cannot open a second ChatGPT conversation to directly observe this; it is reported as an architectural conclusion, not an independently witnessed test.

## 13. Files/Config Created

- `C:\Users\sales\proflow-mcp-bridge\mcp-bridge-server.js` (new)
- `C:\Users\sales\proflow-mcp-bridge\start-bridge.ps1` (new)
- `C:\Users\sales\proflow-mcp-bridge\tasks\*.json` (new, durable task records — diagnostic test tasks only, no sensitive content)

## 14. Files/Config Modified

- Documentation only, this repo, uncommitted: `PROFLOW_PROJECT_CONTEXT.md` (§171), `PROFLOW_ARCHITECTURE.md` (§20 extended), `PROFLOW_HANDOFF.md` (§18.HO), `PROFLOW_TODO.md` (item 56 extended + item 2 AI Chat nuance), this file.
- `C:\Users\sales\proflow-mcp-bridge\mcp-proof-server.js` — **left byte-unchanged** (rollback path).
- Zero ProFlow application source files touched.

## 15. Secrets/Security Assessment

Loopback-only bind, no OAuth metadata of any kind served, fail-closed on unknown methods/oversized bodies (1MB cap), method-name-only logging (never prompt bodies, file contents, tokens, or secrets), strict JSON parsing. File-access hardcoded to one repo-root allowlist with traversal/`.env`/`.git`/`node_modules` blocked — **directly proven** against three real attack attempts (traversal, absolute path, `.env`), all correctly rejected. Only two subprocess types exist, both via `execFile`/`shell:false`, never a shell: the fixed `claude.exe` argv builder and fixed `git` subcommands. Claude Code itself runs with `--allowedTools Read Grep Glob --strict-mcp-config --safe-mode` — no Edit/Write/Bash/deploy tool is reachable from inside that invocation. Subprocess environment rebuilt from a fixed safe-key allowlist — no credential is ever forwarded to the Claude subprocess. No API key, OpenAI credential, Supabase credential, cookie, auth token, customer data, or David Aluminum data was read, logged, or transmitted at any point in this task.

## 16. End-to-End Tests Performed

All against the live MCP `tools/call` interface (first on scratch port 8766, then re-verified on live port 8765 after the swap): `initialize`/`tools/list` (12 tools returned correctly); OAuth discovery routes (still 404); `echo` (legacy regression, byte-identical); `claude_bridge_info`/`claude_repo_status` (real live repo data returned); `claude_read_file` (valid read succeeded; traversal, absolute-path, and `.env` attempts all correctly rejected); `claude_search_repo` (real `git grep` results, 12 matches for a known symbol); `claude_ask` → `claude_task_status` → `claude_task_report` (COMPLETED, correct grounded answer); `claude_task_start` on a mutation request → `NEEDS_OWNER_AUTHORIZATION` + real Owner toast; `claude_task_start` on an unanswerable question → `WAITING_FOR_CHATGPT` → `claude_task_continue` → `COMPLETED` (session correctly resumed). Post-swap: `tunnel-client`'s own channel probe re-confirmed `"ok"` against the new process, zero tunnel-client restart.

## 17. What Is PROVEN

Every item in §16, directly, through the live MCP interface — not merely coded or unit-level. The live process swap onto the tunnel's actual target port, with the tunnel's own health probe confirming continuity. The full task lifecycle including session-resume continuation.

## 18. What Is NOT PROVEN

A literal ChatGPT-UI click-through of the new bridge tools (`claude_bridge_info`, `claude_ask`, etc.) — this session cannot drive ChatGPT's own interface. Multi-conversation behavior (item 12) is an architectural conclusion, not a directly observed test.

## 19. What Is BLOCKED

Nothing on this session's side. The only remaining action is the Owner's own: open ChatGPT and exercise the new tools (e.g. call `claude_bridge_info` or `claude_ask`) to close item 18 above.

## 20. Exact Next Step for ChatGPT/Owner

In the existing ChatGPT conversation connected to the "ProFlow-Claude-Bridge" tunnel, call a new tool — e.g. `claude_bridge_info` (no arguments) or `claude_ask` with a harmless read-only question such as "What is the current ProFlow repository branch and HEAD commit?" — and confirm the response arrives correctly. No credential, restart, or reconfiguration is required; the live tunnel and MCP endpoint are already serving the new bridge.

## 21. HE Impact

None. Zero ProFlow application files touched; this is local infrastructure tooling only.

## 22. EN Impact

None. Same reasoning as item 21.

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST (Supabase) CHANGED?** NO.
- **APPLICATION CODE CHANGED?** NO.
- **APPLICATION COMMIT?** NO (only the documentation-only continuity commit for this task).
- **APPLICATION PUSH?** NO (same distinction).
- **DEPLOY?** NO.
- **LIVE ACTION?** NO.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§171) |
| `PROFLOW_TODO.md` | UPDATED (item 56 extended, item 2 AI Chat nuance added) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HO) |
| `PROFLOW_ARCHITECTURE.md` | UPDATED (§20 extended) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `40bc62a`.

---

## PHASE 4 CHATGPT ↔ CLAUDE CODE BRIDGE: IMPLEMENTED, PROVEN END-TO-END LOCALLY (ALL TASK-LIFECYCLE STATES)
## CHATGPT-UI CONFIRMATION OF NEW TOOLS: NOT YET OBSERVED BY THIS SESSION — OWNER'S NEXT STEP
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## HE/EN: UNAFFECTED
## WAITING FOR OWNER TO EXERCISE THE NEW TOOLS THROUGH CHATGPT ITSELF
