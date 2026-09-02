# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Fix True Tunnel Persistence After PowerShell-Close Failure

**MODE: continuation of the already-authorized local Bridge/Tunnel persistence task. Scope: inspect/fix local tunnel-client persistence, Windows process/session behavior, supported tunnel-client mechanisms, a secure Windows persistence mechanism if required, local process start/stop/restart as required, safe verification, controlled PowerShell-close verification, continuity updates. NOT authorized: ProFlow application changes, TEST/Production changes, customer-data access, application commit/push, deploy, LIVE, Windows reboot, unrelated machine configuration, insecure credential storage, exposing any secret.**

**§175's "safe to close PowerShell now: YES" is INVALIDATED by this task's evidence — superseded below.**

---

## Verdict

**Real root cause found and fixed; validated as far as possible without the Owner's credential.** The prior "orphaned process, therefore independent" conclusion measured the wrong thing — process parentage is not the same as Windows console attachment. The managed runtime's own log proves it received a graceful shutdown (the same sequence as Ctrl+C) the instant the Owner's PowerShell window closed, because it was still attached to that window's console regardless of its parent PID having already exited. The fix launches the managed runtime into a separate, hidden console — the exact pattern already proven, without exception, to keep the Bridge alive across every PowerShell-close test in this entire task chain. This session cannot itself hold the credential needed to run the fixed script, nor literally close the Owner's window, so the fix is reported as **implemented and locally validated**, not as a proven PASS.

## 1. Root Cause of Tunnel Termination

Not a hard kill from Windows tearing down an orphaned process tree. The managed runtime's own log (`C:\Users\sales\.local\state\tunnel-client\logs\proflow-bridge.log`) shows a clean, ordered sequence of `"OnStop hook executed"` entries across every subsystem, ending `"poller stopped"` / `"reason":"context canceled"` — a **graceful shutdown**, identical to what Ctrl+C would trigger. On Windows, closing a console window sends `CTRL_CLOSE_EVENT` to every process still **attached to that console** — a distinct concept from process parentage. A process can have an already-exited `ParentProcessId` while remaining attached to the *original* console it was spawned into (the Windows default, unless a new/hidden console was explicitly created for it). `connect-tunnel.ps1` invoked `tunnel-client runtimes connect` in-line, directly attached to the Owner's own interactive PowerShell console; the daemon it spawned inherited that console and was torn down with it the moment the window closed. §175's ParentProcessId-based orphan check could not detect this — it was never the right signal.

## 2. Tunnel Persistence Mechanism Now Used

`tunnel-client runtimes connect` (unchanged — still the tool's own supported managed-runtime mechanism), but now **launched via `Start-Process -WindowStyle Hidden -Wait -PassThru`** with redirected output, instead of invoked in-line. This creates the connect invocation — and therefore whatever daemon it spawns — in a new console with no relationship to the Owner's interactive window, so closing that window can never deliver it a `CTRL_CLOSE_EVENT`. This is the exact same pattern `start-bridge.ps1` already uses for the Bridge's `node.exe`, which has survived every single PowerShell-close test in this task chain without exception.

## 3. Windows Service: NO

Freshly re-attempted this task (`New-Service`) — Access Denied again, same non-elevated session, reconfirmed via `WindowsPrincipal.IsInRole(Administrator) = False`.

## 4. Scheduled Task: NO

Freshly re-attempted this task (`Register-ScheduledTask`) — Access Denied again, same constraint.

## 5. Other Persistence Mechanism: Exact Description

Two parts, both unprivileged:
- **Console-detachment fix** (the actual fix for the proven failure) inside `connect-tunnel.ps1` itself, as described in item 2.
- **Companion logon-autostart launcher**: `start-tunnel.ps1` + `ProFlow-Tunnel.vbs` (per-user Startup folder), mirroring the Bridge's already-proven `ProFlow-MCP-Bridge.vbs`/`start-bridge.ps1` pattern exactly. Idempotent (skips if the managed runtime is already healthy) and **fail-closed**: if `CONTROL_PLANE_API_KEY` is absent from that logon session's environment (the expected case today, since it is never persisted), it logs that fact and does nothing — never storing, prompting for, or inventing a credential.

## 6. Alias `proflow-bridge`: State

Exists, `runtime_state:"stopped"` (freshly confirmed) — this task did not, and could not, start it (no credential held). Running the corrected `connect-tunnel.ps1` is the Owner's action to bring it back up under the fixed, console-detached invocation.

## 7. Credential Source/Mechanism

`CONTROL_PLANE_API_KEY` — reconciled from the tool's own official documentation (`tunnel-client help quickstart`, quoted, not inferred): "this is the key the daemon uses for `tunnel-client doctor` and `tunnel-client run`." Referenced in the existing profile as `env:CONTROL_PLANE_API_KEY`, unchanged. `OPENAI_ADMIN_KEY` is a **separate**, more-privileged credential the same docs explicitly say must never be given to the daemon ("only for `tunnel-client admin tunnels list|create|update|delete`. Do not give the admin key to the long-lived daemon.") — its absence in the status JSON (`remote_skipped_reason`) is the correct, secure, intended state, not a defect, and it was correctly never requested or stored.

## 8. Secret Persisted: NO

Neither credential was written to any script, log, command-line argument, Scheduled Task, Startup file, or continuity document. `start-tunnel.ps1` only ever *reads* an already-present environment variable and fails closed if it is absent — the exact same pattern as `connect-tunnel.ps1` and `start-bridge.ps1` before it.

## 9. Depends on PowerShell: 

- **Before this fix**: YES (proven by the Owner's real test — this is precisely the bug being fixed).
- **After this fix**: expected NO, by mechanism (matching the Bridge's proven pattern exactly), but **NOT YET PROVEN** — see item 10.

## 10. Post-PowerShell-Close Test: NOT YET PERFORMED (genuine, disclosed limitation)

This session cannot hold `CONTROL_PLANE_API_KEY` (by design, never will) and cannot literally close the Owner's interactive PowerShell window. The credentialed `runtimes connect` call and the real post-close survival test have **not been executed** by this session. What *was* validated, without the credential: the `Start-Process -WindowStyle Hidden -Wait -PassThru` invocation mechanics (tested in isolation against a real credential-free status call — correct exit code, full output captured); the full pre-connect alias-check-and-classify logic (re-run against the real current "stopped" alias state — correctly classified, correctly skips the old-cleanup step that only applies on a genuine first run); both scripts re-parsed with zero syntax errors. This is **implemented and locally validated as far as possible**, not a proven PASS.

## 11. Bridge Post-Close: PASS (already proven in §172/§173/§175, reconfirmed unaffected this task)

Unchanged PID 28892 throughout this entire task; `initialize`/`tools/list` both correct, all 12 tools present. This task touched only tunnel-client files.

## 12. Tunnel Post-Close: NOT YET TESTED (see item 10)

## 13. Exactly One Tunnel Process: N/A right now (tunnel-client is not currently running — 0, not 2). Once the Owner runs the corrected script, `runtimes list`/`runtimes status` should be used to confirm exactly one.

## 14. Survives User Logoff: NOT PROVEN / NOT CONFIGURED (unattended, from a cold logon)

The console-detachment fix addresses "survives closing the *current* PowerShell window" specifically — it does not by itself make the *already-running* process survive a full logoff (which tears down the whole user session, not just one console). The companion `start-tunnel.ps1`/`ProFlow-Tunnel.vbs` would attempt to reconnect at the *next* logon, but only if `CONTROL_PLANE_API_KEY` happens to be present in that fresh session's environment — which it will not be, unless the Owner separately chooses to persist it. Today: **NOT CONFIGURED** for true logoff-survival of a running instance; **structurally present** for a fresh reconnect attempt at next logon, contingent on that separate credential decision.

## 15. Starts After Logon: STRUCTURALLY CONFIGURED (contingent on Owner's own credential decision), NOT PROVEN

`ProFlow-Tunnel.vbs` is installed and was tested to fire correctly and fail closed exactly as designed (no credential today). If the Owner separately decides to persist `CONTROL_PLANE_API_KEY` at the OS level (a distinct decision this session did not make), this launcher would then actually reconnect at next logon — untested since no such persisted credential exists to test against.

## 16. Survives Windows Reboot: NOT CONFIGURED / NOT PROVEN

No reboot was performed or authorized. Same logon-launcher mechanism as item 15 applies after a reboot's first logon, with the same credential caveat.

## 17. ChatGPT E2E: READY_FOR_CHATGPT_E2E — but only after the Owner's own local post-close test passes first

This task cannot itself drive ChatGPT's UI, and per item 10, the real post-close test has not yet been performed by anyone. The correct sequence is: (a) Owner runs the corrected `connect-tunnel.ps1`, (b) Owner performs a genuine close of that PowerShell window (not Ctrl+C — an actual window close), (c) from a **new, independent** shell, freshly verify: tunnel-client process exists, `runtimes status proflow-bridge` shows `ready`, Bridge still healthy, exactly one tunnel-client process. Only once (a)-(c) are green does `READY_FOR_CHATGPT_E2E` genuinely apply — at which point ChatGPT should retry `echo hello` then `claude_bridge_info` through ProFlow Claude Bridge V2. This report does **not** claim "fully verified" before that sequence completes, per explicit instruction.

## Exact Remaining Owner Action

1. In a PowerShell window with `CONTROL_PLANE_API_KEY` set, run: `powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\connect-tunnel.ps1`
2. Confirm it reports success and shows `runtime_state=ready`.
3. **Genuinely close that PowerShell window** (not Ctrl+C).
4. Open a **new** PowerShell window and run: `tunnel-client runtimes status proflow-bridge --json` — confirm `process_running:true`, `runtime_state:"ready"`, `healthy:true`.
5. If that passes, ask ChatGPT (via ProFlow Claude Bridge V2) to retry `echo` with `hello`, then `claude_bridge_info`.

## Rollback Procedure

Unchanged in spirit from prior tasks, now also covering the new launcher: delete `C:\Users\sales\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\ProFlow-Tunnel.vbs` to remove the tunnel logon-autostart (the Bridge's own `ProFlow-MCP-Bridge.vbs` is separate and untouched). If the corrected `connect-tunnel.ps1` fails, it prints its own rollback (`tunnel-client runtimes stop proflow-bridge` then the original `tunnel-client run --profile proflow-no-auth-proof`) — unchanged. No working configuration/profile was deleted or altered by this task.

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
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§176, invalidates §175's "safe to close" conclusion) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HT) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (§20 already covers the mechanism generally) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `cd576dd`.

---

## §175 "SAFE TO CLOSE POWERSHELL: YES" — INVALIDATED BY REAL OWNER TEST
## REAL ROOT CAUSE: CONSOLE ATTACHMENT (CTRL_CLOSE_EVENT), NOT PROCESS PARENTAGE — EVIDENCED VIA GRACEFUL-SHUTDOWN LOG
## FIX: connect-tunnel.ps1 NOW LAUNCHES runtimes connect INTO A SEPARATE HIDDEN CONSOLE (SAME PATTERN ALREADY PROVEN FOR THE BRIDGE)
## STATUS: IMPLEMENTED AND LOCALLY VALIDATED AS FAR AS POSSIBLE — NOT YET A PROVEN PASS
## POST-CLOSE TEST: NOT YET PERFORMED (REQUIRES THE OWNER'S OWN CREDENTIAL AND A REAL WINDOW CLOSE)
## BRIDGE: UNCHANGED, STILL HEALTHY, UNAFFECTED BY THIS TASK
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## NO SECRET EXPOSED OR PERSISTED
## HE/EN: UNAFFECTED
## READY_FOR_OWNER_SHELL_CLOSE_TEST, THEN READY_FOR_CHATGPT_E2E
