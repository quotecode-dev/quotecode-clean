# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Verify Managed Tunnel Runtime Health After First Successful Connect

**MODE: continuation of the already-authorized local Bridge/Tunnel persistence task. Scope: read-only inspection of the managed tunnel runtime, local diagnostics, safe local verification, minimal fix only if strictly required. NOT authorized: ProFlow application changes, TEST/Production changes, customer-data access, application commit/push, deploy, LIVE, Windows reboot, unrelated machine configuration, insecure credential exposure/persistence.**

---

## Verdict

**The managed tunnel runtime is genuinely healthy.** `runtime_state:"ready"` was not a superficial or misleading signal — `process_running`, `healthy`, live `healthz`/`readyz` probes, and a real successful MCP handshake in the tunnel-client's own log all independently confirm it. The script's final health check failed only because it still assumed a fixed `127.0.0.1:8080` admin port; managed "process mode" allocates a fresh **ephemeral** port per run instead. That assumption has been corrected and proven against the real live runtime — without needing to reconnect or disturb anything already working.

## 1. Alias `proflow-bridge`

**EXISTS.** `tunnel-client runtimes list` confirms it, freshly checked.

## 2. process_running

**TRUE.**

## 3. runtime_state

**`"ready"`**.

## 4. tunnelx.running

The field in the actual JSON output is `tmux.running` (both top-level and under `local`) — not literally `tunnelx.running`; this is very likely a transcription of that field name. Value: **`false`**.

## 5. Exact Meaning of `tmux.running` in This Mode/Version

The status JSON carries two alternative session-supervision backend objects: a populated `process` object (`"mode":"process"`, real PID 26852, real command line — the backend actually in use here) and a `tmux` object (`running:false`, an unused `session_name`) representing an alternative tmux-based supervision backend relevant on Unix/WSL systems where tmux is a natural persistent-session primitive. This install is a native Windows binary with no tmux available, so that backend is simply never engaged — `tmux.running:false` is the expected, correct value, not a failure indicator. No `--mode` flag or prose documentation of this exists in `tunnel-client --help`/`runtimes connect --help` (checked directly, not found) — this reading is a direct, well-corroborated inference from the tool's own JSON self-report (`"mode":"process"` stated explicitly) plus platform context, disclosed honestly as an inference rather than quoted documentation. **It is unrelated to health.**

## 6. Correct Runtime Health Endpoint/Method

**Not a fixed URL.** The authoritative source is `tunnel-client runtimes status <alias> --json`'s `health_url` field (in this run: `http://127.0.0.1:58396/healthz`, confirmed independently via the companion file `C:\Users\sales\.local\state\tunnel-client\health\proflow-bridge.url`), always read fresh — managed "process mode" allocates a new ephemeral admin/health port per run (to allow multiple aliases to coexist without collision) rather than honoring the profile YAML's fixed `health.listen_addr: 127.0.0.1:8080`, which only applies to a plain foreground `run`. The old hardcoded `127.0.0.1:8080` was independently confirmed **unreachable** (connection refused) — the tunnel was never actually down; the script was just asking the wrong port.

## 7. Bridge Healthy: YES

Direct `initialize` and `tools/list` calls against `http://127.0.0.1:8765/mcp` both succeeded, all 12 tools present. Independently corroborated by the tunnel-client's own log: `"mcp session initialized"`, `"server_name":"proflow-mcp-proof"`, `"server_version":"0.2.0"`.

## 8. Managed Tunnel Healthy: YES

`process_running:true`, `runtime_state:"ready"`, `healthy:true`, `error:""`, live `healthz`→`"live"` (200), `readyz`→`"ready"` (200), `/api/status` at the correct ephemeral port shows channel `"main"` `probe_status:"ok"` and `mcp_server_url` matching exactly.

## 9. ChatGPT-Facing Tunnel Path Expected Healthy: YES (locally proven up to the tunnel-client/control-plane boundary)

The tunnel-client's own log shows a real, successful startup against OpenAI's control plane (`"tunnel metadata fetched"`, `"🟢 tunnel-client started"`, `tunnel_url: https://api.openai.com/v1/tunnel/tunnel_...`) and a real successful MCP handshake with the local Bridge. A literal ChatGPT-UI click-through was not performed by this session (cannot drive ChatGPT's browser) and is not claimed as observed — consistent with every prior report in this task chain.

## 10. Dependent on Current PowerShell Window: NO — PROVEN

`Get-CimInstance Win32_Process -Filter "ProcessId=26852"` (the managed tunnel-client process) showed a `ParentProcessId` whose own process **no longer exists** — fully orphaned. This was directly observed, not inferred. All of the Owner's currently-open PowerShell windows (independently enumerated: PIDs 34080, 29312, 10972) are unrelated to this process's actual parentage.

## 11. Safe to Close the Current PowerShell Window Now: YES

Both components (Bridge and managed tunnel-client) are independently proven detached from any interactive shell.

## 12. Did `connect-tunnel.ps1` Require Another Fix? YES

**Exact fix**: `Test-TunnelHealthy`/`Show-TunnelHealth` (hardcoded `127.0.0.1:8080/api/status`) were replaced with `Get-ManagedRuntimeStatus`/`Test-ManagedRuntimeHealthy`/`Show-ManagedRuntimeHealth`, which always read the current health endpoint and readiness fresh from `tunnel-client runtimes status <alias> --json` via a new `Invoke-TC` helper. `Invoke-TC` also generalizes §174's `$ErrorActionPreference` fix (temporarily relax to `'Continue'` around any native status call, so a stderr line never becomes a terminating exception) to every status query in the script, not only the one that originally broke.

**A third, latent bug was found and fixed in the same pass**, before it could cause harm: the old-foreground-process cleanup step matched on `tunnel-client.exe` command lines containing the profile name — but the *managed* process has the identical command-line shape (`tunnel-client.exe run --profile-dir ... --profile ...`), so this heuristic could not safely tell a stale interactive process apart from the currently-healthy managed instance. Fixed by scoping that cleanup step to the genuine first-run path (alias did not exist) only; a reconnect of an existing-but-unhealthy alias now relies on `runtimes connect`'s own documented "create or reuse" semantics instead of a manual pre-kill — directly serving the "do not reconnect/recreate a healthy runtime unnecessarily" requirement.

**Directly proven, not merely reasoned about**: the fixed `Test-ManagedRuntimeHealthy`/`Show-ManagedRuntimeHealth` functions were extracted and run in isolation against the real, live `proflow-bridge` alias — returned `True` and the full correct health detail (matching the direct JSON/curl checks above exactly). This proves that if the Owner runs the corrected script again right now, it will correctly take the "already healthy, nothing to do" fast path rather than unnecessarily reconnecting. The full script was re-parsed (`[System.Management.Automation.Language.Parser]::ParseFile`) — zero syntax errors. `runtimes list` and process/port state were re-checked immediately after all testing — still exactly one alias, one tunnel-client process (unchanged PID 26852), one Bridge process (unchanged PID 28892) — nothing was disturbed.

## 13. Was the Repair Command Used? NO

`repair_actions`/`repair_command` were present in the status JSON only as generic informational "next steps" the tool always includes — not an indication anything needed repairing. Since the runtime is genuinely healthy, using them was correctly judged unnecessary and outside strictly read-only verification.

## 14. CONTROL_PLANE_API_KEY Exposed/Persisted: NO

Never read, printed, logged, embedded, or written anywhere by this task.

## 15. Exact Remaining Owner Action

**None required for current health** — the tunnel is genuinely healthy right now and independent of any PowerShell window. If the Owner wants to re-run `connect-tunnel.ps1` anyway (e.g., to see the corrected health output), it is now safe to do so: it will detect the alias is already healthy and exit cleanly without reconnecting.

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST CHANGED?** NO.
- **APPLICATION CODE CHANGED?** NO.
- **APPLICATION COMMIT?** NO.
- **APPLICATION PUSH?** NO.
- **DEPLOY?** NO.
- **LIVE ACTION?** NO.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§175) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HS) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (§20 already covers the mechanism generally; a health-check bugfix doesn't change the architecture) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

*(filled after push — see below)*

---

## MANAGED TUNNEL RUNTIME: GENUINELY HEALTHY, DIRECTLY PROVEN
## BRIDGE: HEALTHY, DIRECTLY PROVEN
## BOTH COMPONENTS: PROVEN INDEPENDENT OF ANY POWERSHELL WINDOW
## SAFE TO CLOSE EXISTING POWERSHELL WINDOWS: YES
## connect-tunnel.ps1: SECOND BUG (HARDCODED HEALTH PORT) FOUND AND FIXED, PROVEN CORRECT
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## CONTROL_PLANE_API_KEY: NEVER EXPOSED, NEVER PERSISTED
## HE/EN: UNAFFECTED
## NO FURTHER OWNER ACTION REQUIRED FOR CURRENT HEALTH
