# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Secure Permanent Tunnel Autostart — DPAPI / File-Secret Investigation + Implementation

**MODE: one focused attempt at a secure, permanent, low-maintenance tunnel autostart. Prefer the simplest secure supported solution; do not over-engineer; STOP rather than build a fragile workaround. NOT authorized: ProFlow application changes, TEST/Production changes, customer-data access, application commit/push, deploy, LIVE, Windows reboot, unrelated machine configuration, plaintext credential persistence, exposing any secret, weakening authentication.**

---

## Verdict

**Implemented and proven correct via a full dummy-credential round-trip — genuinely no plaintext secret ever touches disk.** `file:<path>` is confirmed supported by the installed tunnel-client itself, but a simpler, strictly better mechanism was used instead: DPAPI-encrypted storage at rest, decrypted only in-memory, handed to the managed runtime purely through normal OS process-environment inheritance (the same `env:CONTROL_PLANE_API_KEY` reference already proven to work, unchanged). One remaining gate: the Owner must run the one-time enrollment script themselves. Reached: `READY_FOR_SECURE_KEY_ENROLLMENT`.

## tunnel-client File-Secret Support: YES

## Exact Supported Mechanism

`--control-plane.api-key` (used by `run`, and the same reference format `runtimes connect`'s `--runtime-api-key` writes into the generated profile) documents, verbatim, in the installed binary's own `--help` output: *"Reference to environment variable or file containing the control-plane API key (format env:VARNAME or file:/path/to/secret)."* Cross-corroborated by `--admin-key` ("using env:NAME or file:/path"), `--control-plane.client-cert`/`-key`, and `init --control-plane-api-key-ref` (default `"env:CONTROL_PLANE_API_KEY"`) — a consistent reference convention across the whole tool. No documented read-once-vs-reload cadence exists anywhere in local help text (checked directly, not assumed).

**Design choice**: this mechanism was confirmed viable but deliberately **not used** for the final implementation. Its "how long must an ephemeral plaintext file exist before deletion is safe" question — which the task itself flagged as needing fresh proof this session could not fully obtain without the real daemon lifecycle — was avoided entirely by using `env:` (already proven, already the current profile's setting, unchanged) instead of `file:`. A `Start-Process`-spawned child inherits its own independent copy of the parent's environment at spawn time, persisting for its own full process lifetime regardless of the parent — so decrypting in-memory and setting the env var on the launcher process achieves "no plaintext temporary file at all" (the task's explicitly stated preference) with no lifecycle risk to reason about.

## DPAPI Solution Viable: YES

Implemented using PowerShell's built-in `ConvertTo-SecureString`/`ConvertFrom-SecureString` (no explicit key = Windows DPAPI, `CurrentUser` scope — the same primitive Windows Credential Manager itself uses). No third-party tooling, no custom encryption key to manage.

## Architecture Implemented

1. **`enroll-tunnel-credential.ps1`** (new, one-time, interactive, Owner-run only): `Read-Host -AsSecureString` prompts for `CONTROL_PLANE_API_KEY` with masked input (never echoed to screen) → `ConvertFrom-SecureString` (DPAPI CurrentUser) → written to `C:\Users\sales\proflow-mcp-bridge\.secrets\control-plane-api-key.dpapi` → immediately ACL-locked (`icacls /inheritance:r` then `/grant:r "<user>:(R,W)"`) → immediately round-trip-verified in-memory (decrypt and compare) before declaring success; deletes the file again if verification fails.
2. **`start-tunnel.ps1`** (existing file, extended — not replaced): new `Get-EnrolledCredential` function, tried only if `CONTROL_PLANE_API_KEY` is not already in the environment. Decrypts the enrolled file in-memory, sets the env var on this process only. Fails closed silently (logs only the exception type, never secret-derived content) if the file is absent or fails to decrypt. Everything downstream — the already-fixed console-detached `Start-Process ... runtimes connect` call from the prior task — is unchanged.
3. **`ProFlow-Tunnel.vbs`** (existing Startup-folder entry) — **unchanged, reused exactly as-is**. No duplicate Startup entry, Scheduled Task, or Service was created.

## Plaintext Secret Persisted Anywhere: NO

Not in the `.dpapi` file (ciphertext only), not in any script source, not in the profile YAML/JSON, not in any command-line argument, not in any log, not in this or any continuity document. During testing, only a fabricated dummy value (`DUMMY-TEST-...`, never the real key) ever touched disk, and all test artifacts were deleted afterward.

## Encrypted Credential Location (no secret value)

`C:\Users\sales\proflow-mcp-bridge\.secrets\control-plane-api-key.dpapi` — **does not currently exist**; the Owner has not yet run the enrollment script. This path is where it will be created.

## Credential ACL/Security

`icacls <file> /inheritance:r` (removes inherited permissions) then `/grant:r "<user>:(R,W)"` (grants read/write to the enrolling Windows account only, replacing all other grants). Directly verified during dummy testing: resulting ACL showed exactly `OFFICE\OFFICE:(R,W)` and nothing else. DPAPI CurrentUser-scope encryption additionally means the ciphertext is undecryptable by any other local account or on any other machine, independent of file permissions.

## Startup Mechanism Used

The existing per-user Startup-folder entry, `ProFlow-MCP-Bridge.vbs`'s sibling `ProFlow-Tunnel.vbs` (already installed in a prior task) → `start-tunnel.ps1` (now extended). Unprivileged, auditable (visible file), reversible (delete the file to disable).

## Duplicate Startup Mechanism Created: NO

## Manual Key Entry After Setup Required: NO

One-time enrollment only. After that, normal Windows logon requires no Owner action (contingent on the enrollment actually being completed — see below).

## PowerShell Dependency: NOT YET PROVEN (for the new credential path specifically)

The underlying console-detachment fix (§176, unchanged by this task) is believed correct by mechanism and consistent with the Bridge's proven pattern, but a true cold-logon test using the *enrolled* DPAPI credential has not occurred — no enrollment exists yet.

## Tunnel Healthy: YES

`runtime_state:"ready"`, `process_running:true`, `healthy:true` — currently running as PID 4616, up ~48 minutes at last check. **This instance was found already running at the start of this task** (very likely started by the Owner independently running the §176-fixed `connect-tunnel.ps1`) and was **left completely untouched** throughout, per explicit instruction not to unnecessarily disturb a working tunnel.

## Bridge Healthy: YES

Unchanged PID 28892 throughout; `initialize`/`tools/list` both correct, all 12 tools present.

## Exactly One Tunnel Instance: YES

`tunnel-client runtimes list` confirms exactly one alias (`proflow-bridge`); `tasklist` confirms exactly one `tunnel-client.exe` process.

## Logon Autostart: STRUCTURALLY CONFIGURED

`ProFlow-Tunnel.vbs` + the extended `start-tunnel.ps1` are installed and were proven, with dummy data, to correctly decrypt-and-inherit a credential to a spawned child process. Not yet proven with the real enrolled credential at a real logon, since no enrollment has occurred.

## Reboot Autostart: STRUCTURALLY CONFIGURED

Same mechanism applies at the first logon after any reboot. **Reboot actually tested: NO.** No reboot was performed or authorized.

## ChatGPT E2E: NOT READY (gate reached instead: `READY_FOR_SECURE_KEY_ENROLLMENT`)

Per the task's own explicit instruction, this session stops here rather than proceeding further, since the Owner must perform the key enrollment personally.

## Exact Remaining Owner Action

Run, once, in any PowerShell window (does **not** need to be the one with `CONTROL_PLANE_API_KEY` already set — this script prompts fresh):
```
powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\enroll-tunnel-credential.ps1
```
It will prompt for `CONTROL_PLANE_API_KEY` with masked (non-echoing) input, encrypt it with DPAPI, verify the round-trip, and confirm success — the key is never displayed, never sent anywhere, never pasted into ChatGPT or Claude.

**After that**, this session can independently continue verification itself (checking the encrypted file exists, its ACL, and that `start-tunnel.ps1` successfully retrieves it — never the secret value) without requiring the Owner to transport any diagnostic. The natural next real-world test is the Owner's *next* Windows logon (or closing all shells and manually running `start-tunnel.ps1` once to simulate it) — at that point local A+B verification (enrollment + autostart simulation, launcher closed + tunnel still healthy) can complete, and only then would `READY_FOR_CHATGPT_E2E` genuinely apply.

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
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§177) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HU) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (§20 already covers this mechanism generally) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `9918602`.

---

## FILE-SECRET SUPPORT: YES (file:/path/to/secret, confirmed from the installed binary's own help text)
## DESIGN USED INSTEAD: DPAPI + env-var-inheritance — ZERO PLAINTEXT EVER TOUCHES DISK
## PROVEN VIA FULL DUMMY-CREDENTIAL ROUND-TRIP (encrypt → ACL-lock → decrypt → child-process inheritance)
## REAL ENROLLMENT: NOT YET PERFORMED
## CURRENT TUNNEL: HEALTHY, PID 4616, UNTOUCHED BY THIS TASK
## BRIDGE: HEALTHY, UNTOUCHED
## EXACTLY ONE TUNNEL INSTANCE: YES
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## NO SECRET EXPOSED OR PERSISTED
## HE/EN: UNAFFECTED
## READY_FOR_SECURE_KEY_ENROLLMENT
