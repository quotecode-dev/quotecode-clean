# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Bridge/Tunnel Persistence

**MODE: Owner-authorized ProFlow local MCP Bridge runtime persistence, OpenAI tunnel-client managed-runtime persistence, local process stop/start/restart where genuinely required to migrate, Windows local persistence configuration, read-only inspection, local end-to-end verification, continuity updates. NOT authorized: ProFlow application changes, TEST/Production changes, customer-data access, application commit/push, deploy, LIVE, unrelated machine configuration, weakened credential handling.**

**This is not a ProFlow product task.** Same local dev infrastructure line as §170/§171 (item 56), extended.

---

## Verdict

**Bridge persistence: DONE and directly proven.** The Node MCP bridge now autostarts at Windows logon via the per-user Startup folder and was proven, through a real stop/relaunch test, to be genuinely independent of any interactive shell. **Tunnel-client persistence: mechanism identified, migration script prepared and validated as far as possible, but NOT executed** — it requires the Owner's own `CONTROL_PLANE_API_KEY`, which this session correctly never has and never worked around. This is now exactly one command for the Owner to run themselves.

## 1. Bridge Persistence Mechanism

Per-user Windows **Startup folder** (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ProFlow-MCP-Bridge.vbs`) — a silent, no-secrets launcher that delegates entirely to the existing idempotent `start-bridge.ps1`. A Windows Scheduled Task was attempted first (would have added a 5-minute self-healing repetition trigger) but this session's shell lacks the elevation Task Scheduler registration requires (`Register-ScheduledTask` and `schtasks.exe` both failed with Access Denied — tested directly, not assumed). The Startup folder is the standard, fully-supported, unprivileged fallback and fully satisfies "starts automatically after logon" and "survives closing the launching window."

## 2. Tunnel Persistence Mechanism

`tunnel-client runtimes connect` — the tool's own documented managed-runtime supervision mechanism (its own help text: "For a long-lived local runtime managed by Codex, use this command instead of nohup or disown"). **Prepared, not executed.** A ready-to-run script, `connect-tunnel.ps1`, performs the full migration (stop the old targeted foreground process → `runtimes connect` with the exact existing tunnel/profile/MCP-target → verify → rollback instructions on failure), but requires `CONTROL_PLANE_API_KEY` in the invoking shell — confirmed absent from this session (length-only check). Not executed, per the task's own explicit instruction not to work around this boundary.

## 3. Managed Runtime Alias

`proflow-bridge` — the alias name `connect-tunnel.ps1` will register once the Owner runs it. **Not yet created** (`tunnel-client runtimes list` confirmed empty; `runtimes status proflow-bridge` independently confirmed the expected "alias not known" failure before migration).

## 4. Windows Service: NO

Not used, not attempted — `tunnel-client`'s own supported mechanism (`runtimes connect`) is a managed background-runtime, not a Windows Service, and is the tool-recommended path.

## 5. Scheduled Task: NO

Attempted for the Bridge, blocked by lack of elevation in this session (see item 1). Not attempted for tunnel-client (its own `runtimes connect` mechanism is the correct, tool-native path instead).

## 6. Credential Persistence: NO

`CONTROL_PLANE_API_KEY` was not stored, embedded, or persisted anywhere by this task — not in `start-bridge.ps1`, not in `ProFlow-MCP-Bridge.vbs`, not in `connect-tunnel.ps1` (which only *reads* an already-set environment variable and fails closed if it is absent). **A separate, larger decision is explicitly flagged `NEEDS_OWNER_AUTHORIZATION` below** for full unattended reboot-survival, which would require file-based credential persistence — not implemented, not decided unilaterally.

## 7. Dependent on Open PowerShell Windows

- **Bridge (`mcp-bridge-server.js`)**: **NO** — directly proven independent (see item 16).
- **Tunnel-client (`tunnel-client.exe`, current PID 8836)**: **YES, still** — unchanged, still a direct child of an interactive PowerShell window (confirmed via process ancestry this task). Migration to independence is prepared but not yet executed (see item 2).

## 8. Safe to Close the Existing PowerShell Windows Now: PARTIAL

- The PowerShell window that was launching the **Bridge** (or this session's own shell, if it launched the bridge process) can be closed safely now — the Bridge no longer depends on it.
- The PowerShell window currently running `tunnel-client run --profile proflow-no-auth-proof` (PID 8836) **should NOT be closed yet** — doing so would kill the tunnel until the Owner runs `connect-tunnel.ps1` (or otherwise restarts it). Close it only **after** running the migration script successfully.

## 9. Survives Windows Logoff

- **Bridge**: **NOT PROVEN** (a real logoff/logon cycle was not performed — not safe or practical to attempt from this session). **Structurally configured correctly** — the Startup folder mechanism is Windows' standard per-user logon-autostart path, and the launcher was proven independent of any specific shell process, which is the property that makes logoff-survival plausible; it is reported as configured, not as observed.
- **Tunnel-client**: **NOT CONFIGURED YET** — migration not executed.

## 10. Survives Windows Restart

- **Bridge**: **STRUCTURALLY CONFIGURED** (Startup-folder items run at every interactive logon, including post-reboot logon) — **NOT PROVEN** (no reboot was performed or authorized this task).
- **Tunnel-client**: **NOT CONFIGURED** — migration not executed; even after migration, `runtimes connect` alone gives supervised/restart-recoverable *process* persistence while running, not automatic *credentialed* restart after a full reboot, since `CONTROL_PLANE_API_KEY` would still need to be supplied at that next start unless the Owner separately authorizes file-based credential persistence (item 6).

No Windows reboot was performed, attempted, or is authorized by this task.

## 11. Rollback Procedure

- **Bridge**: delete `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ProFlow-MCP-Bridge.vbs` to disable autostart; stop the running process with `Stop-Process` on the PID listening on 8765 if needed. `mcp-proof-server.js` remains untouched on disk as a full functional rollback if the bridge server itself needs reverting.
- **Tunnel-client** (only relevant once the Owner runs the migration): `connect-tunnel.ps1` prints an explicit rollback on any failure (`tunnel-client runtimes stop proflow-bridge` then `tunnel-client run --profile proflow-no-auth-proof`) — the exact original foreground command, unchanged.

## 12. Exact Tests Performed

- Fresh state: process list, ports, `/api/status`, `runtimes list`, `admin-profiles list`, process ancestry (`Get-CimInstance Win32_Process`) for both `tunnel-client.exe` and the bridge `node.exe`, Windows Services/Scheduled Tasks search (none pre-existing), current `start-bridge.ps1` content re-read fresh.
- `Register-ScheduledTask` attempted → Access Denied. `schtasks.exe /Create` attempted → Access Denied (confirmed non-elevated token: Administrators group present "for deny only").
- Real Startup-folder path independently verified via `$env:APPDATA` after `[Environment]::GetFolderPath('Startup')` returned a sandbox-virtualized path.
- `ProFlow-MCP-Bridge.vbs` fired manually while the bridge was already running → same PID, no duplicate listener (idempotency proven).
- Bridge process (PID 31416) deliberately stopped; launcher fired again (simulating logon) → new PID (28892) came up; its process ancestry inspected → intermediate parent already exited, node.exe fully orphaned (terminal-independence proven).
- Post-relaunch: `initialize` JSON-RPC call succeeded against the new process; `tunnel-client`'s own `/api/status` channel probe self-recovered to `"ok"`; `netstat` confirmed exactly one listener on port 8765; `bridge.log` content re-inspected — safe metadata only.
- `connect-tunnel.ps1` parsed with `[System.Management.Automation.Language.Parser]::ParseFile` → zero syntax errors.
- `tunnel-client runtimes status proflow-bridge` (read-only, no credential needed) → confirmed expected "alias not known" failure, matching the script's own idempotency-check assumption.
- `CONTROL_PLANE_API_KEY`/`OPENAI_API_KEY` re-confirmed absent from this session (length-only check, value never read or printed).

## 13. Exact Remaining Owner Action

1. In the PowerShell window where `CONTROL_PLANE_API_KEY` is already set (the one currently running `tunnel-client run --profile proflow-no-auth-proof`), run:
   ```
   powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\connect-tunnel.ps1
   ```
   This stops the old foreground process and starts the managed, terminal-independent `runtimes connect` supervision — no new credential storage, no change to the tunnel/profile/MCP target.
2. Confirm the script's own printed verification (`runtimes status proflow-bridge`, channel `probe_status: ok`) looks correct.
3. Only then is it safe to close that PowerShell window.
4. **Separate decision, not required to close the window today**: if the Owner wants tunnel-client to also survive a full Windows reboot/logoff with zero manual restart, decide whether to accept persisting `CONTROL_PLANE_API_KEY` to an NTFS-ACL-restricted file (`file:C:\...` reference) — the only credential-persistence option this tool version supports (no Credential-Manager/DPAPI-backed reference exists). This session did not create that file or make that choice; say the word and it can be built with the exact ACL restricting it to the Owner's own Windows account only.

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST CHANGED?** NO.
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
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§172) |
| `PROFLOW_TODO.md` | UPDATED (item 56 extended) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HP) |
| `PROFLOW_ARCHITECTURE.md` | UPDATED (§20 extended) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

*(filled after push — see below)*

---

## BRIDGE PERSISTENCE: DONE, PROVEN INDEPENDENT OF ANY INTERACTIVE SHELL
## TUNNEL-CLIENT PERSISTENCE: SCRIPT PREPARED — NEEDS_OWNER_AUTHORIZATION (CREDENTIAL REQUIRED TO EXECUTE)
## REBOOT/LOGOFF SURVIVAL: STRUCTURALLY CONFIGURED FOR BRIDGE, NOT PROVEN; NOT CONFIGURED FOR TUNNEL-CLIENT
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## HE/EN: UNAFFECTED
## WAITING FOR OWNER TO RUN connect-tunnel.ps1 (AND OPTIONALLY DECIDE ON CREDENTIAL-FILE PERSISTENCE)
