# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Fix connect-tunnel.ps1 Alias-First-Run Failure

**MODE: continuation of the already-authorized local Bridge/Tunnel persistence task. Scope: inspect and fix only `connect-tunnel.ps1` and directly related local tunnel-client config if genuinely required; read-only diagnostics; safe local verification; continuity updates. NOT authorized: ProFlow application changes, TEST/Production changes, customer-data access, application commit/push, deploy, LIVE, Windows reboot, unrelated machine configuration, insecure credential persistence, exposing/logging `CONTROL_PLANE_API_KEY`.**

---

## Verdict

**Root cause found and fixed, proven correct by direct reproduction — without needing the Owner's credential.** The Owner's real attempt hit a genuine PowerShell 5.1 bug in the script (not a tunnel-client problem): an expected "alias doesn't exist yet" condition on first run was being treated as a fatal script crash. The fix was written, and the exact failing code path was reproduced and re-tested in isolation to prove the fix works, all without ever needing `CONTROL_PLANE_API_KEY`. Running the corrected script is still the Owner's one remaining action.

## Root Cause of the First-Run Failure

The original script set `$ErrorActionPreference = 'Stop'` globally, then checked for the managed-runtime alias via `& $tcExe runtimes status $alias 2>&1`. In Windows PowerShell 5.1, redirecting **any** stream of a native executable's stderr (`2>&1`, `2>$null`, and `*>` were all tested and all reproduce it) wraps each stderr line in a `NativeCommandError` `ErrorRecord` — and under `EAP='Stop'`, that **throws immediately**, before the script's own `if ($LASTEXITCODE -eq 0)` logic is ever reached. tunnel-client's own "alias ... is not known; run create or connect first" message on a nonexistent alias is completely normal and expected on first run — the script was crashing on its own error-handling setup, not on anything wrong with tunnel-client or the Owner's environment.

**Directly reproduced, not assumed**: this was verified twice in isolation, using a genuinely nonexistent test alias (a read-only `runtimes status` query needs no credential) — first reproducing the exact crash with the original code pattern, then confirming a corrected pattern no longer throws and reaches the intended branch.

## Exact Script Change

`connect-tunnel.ps1` was rewritten (full file, same location):

- The alias-existence check now temporarily sets `$ErrorActionPreference = 'Continue'` around **only** that one native call, restores `'Stop'` immediately after, and captures the combined output as plain text.
- Branching now uses **both** `$LASTEXITCODE` and a `-match 'is not known'` check on the captured message, distinguishing three outcomes instead of two:
  - **CASE A** — alias exists. Previously this just printed "nothing to do" and exited. Now it additionally health-checks the existing alias against the live `/api/status` admin endpoint (`main` channel `probe_status:"ok"` and the MCP URL matching `http://127.0.0.1:8765/mcp`) — if healthy, exits cleanly; if registered but unhealthy, falls through to the same safe `runtimes connect` call CASE B uses (tunnel-client's own docs describe this as "create or reuse," non-destructive of an existing alias).
  - **CASE B** — alias does not exist yet (the expected first-run state). Proceeds to stop any old foreground process and run `runtimes connect` to create it.
  - **Anything else** (an exit code that is neither 0 nor the known "not known" case) — treated as a genuine, unexpected failure: printed in full, script exits 1, **no changes are made**. Genuine tunnel-client errors are never silently swallowed.
- `Show-TunnelHealth`/`Test-TunnelHealthy` helper functions added, both wrapped in `try/catch` (cmdlet failures, unlike native-exe stderr redirection, are safely catchable under `EAP='Stop'` without the same bug) — used for both the CASE A health check and the final post-migration verification.
- Preserved unchanged: profile `proflow-no-auth-proof`, MCP target `http://127.0.0.1:8765/mcp`, tunnel ID, alias name `proflow-bridge`, the targeted (never blanket) old-process stop logic, and the rollback instructions on failure.
- `CONTROL_PLANE_API_KEY` is still never read into a variable, printed, logged, or written anywhere — the script only relies on it being present in the environment for the native `tunnel-client.exe` call to consume directly, exactly as before.

## Verification (all performed without the Owner's credential)

- Extracted and re-ran the exact fixed alias-check block in isolation against a real, genuinely nonexistent test alias (`proflow-bridge-repro-test`) — confirmed it no longer throws and correctly classifies the result as CASE B.
- Exercised `Test-TunnelHealthy` against the **actual current down state** (tunnel-client is not running right now — see below) — confirmed it returns `$false` cleanly, no throw.
- Re-parsed the full corrected script with `[System.Management.Automation.Language.Parser]::ParseFile` — zero syntax errors.
- Freshly re-confirmed: `tunnel-client runtimes list` still shows the alias absent; `CONTROL_PLANE_API_KEY`/`OPENAI_API_KEY` still absent from this session (length-only check, value never read).
- Freshly re-confirmed the Bridge (port 8765) is completely unaffected by this task — unchanged PID, still responds correctly to `initialize`/`tools/list`.

## Current State

- **Alias `proflow-bridge` currently exists?** **NO** — `runtimes list` confirmed empty.
- **Was a managed runtime actually created?** **NO** — this task fixed the script but did not (and could not, without the credential) execute it.
- **Is the tunnel currently UP or DOWN?** **DOWN** — `tunnel-client.exe` is not running at all (the Owner's own Ctrl+C stopped the old foreground process, and the failed script attempt never started a replacement). This is expected local-dev-infra downtime, not a Production outage, and no unrelated recovery mechanism was started.
- **Bridge (port 8765)**: unaffected, still healthy.

## Must the Owner Run the Script Once More?

**Yes — exactly one command**, in the same still-open PowerShell session where `CONTROL_PLANE_API_KEY` was previously confirmed present:
```
powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\connect-tunnel.ps1
```
With the alias currently absent, this will now correctly take the CASE B path (proven by reproduction above): find no old foreground process to stop (already stopped), run `runtimes connect` to create the `proflow-bridge` managed runtime, and verify health.

## Credential Handling

`CONTROL_PLANE_API_KEY` was **never** printed, logged, embedded in the script, copied into documentation, or persisted anywhere by this task. This session's own environment was re-confirmed not to have it (length-only check). No `NEEDS_OWNER_AUTHORIZATION` credential-storage decision was reached this task — the bug was purely a script logic defect, not a credential-handling question.

## Rollback Status

Unchanged and still valid: `connect-tunnel.ps1` itself prints an explicit rollback (`tunnel-client runtimes stop proflow-bridge` then the original `tunnel-client run --profile proflow-no-auth-proof`) if the migration fails. `mcp-proof-server.js` remains untouched on disk as the Bridge's own separate rollback path (unaffected by this task in any case).

## Safe to Close Any PowerShell Window Yet?

**No new window can be closed as a result of this task alone.** The tunnel is currently down, so there is nothing tunnel-related running to depend on right now. Once the Owner runs the corrected script and it succeeds, the window it's run from can be closed (the managed runtime will no longer depend on it) — but not before.

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
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§174) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HR) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (§20 already covers this mechanism generally; a script bugfix doesn't change the architecture) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

*(filled after push — see below)*

---

## connect-tunnel.ps1 FIRST-RUN BUG: ROOT-CAUSED, FIXED, PROVEN BY REPRODUCTION
## TUNNEL: CURRENTLY DOWN (EXPECTED — OWNER'S OWN CTRL+C, NOT A PRODUCTION OUTAGE)
## ALIAS proflow-bridge: NOT YET CREATED
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## CONTROL_PLANE_API_KEY: NEVER EXPOSED, NEVER PERSISTED
## HE/EN: UNAFFECTED
## WAITING FOR OWNER TO RE-RUN connect-tunnel.ps1 (SAME SHELL, SAME COMMAND AS BEFORE)
