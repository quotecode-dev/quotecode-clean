# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Fix Credential Sanitization + Read-Only Real-Reboot Startup Audit

**MODE: Part A authorized mutation, narrowly scoped to `enroll-tunnel-credential.ps1` only. Part B strictly read-only — no Startup entries, VBS files, services, Scheduled Tasks, registry, Bridge/Tunnel launch configuration, or Windows configuration modified.**

---

## Part A — Credential Fix

**Exact root cause addressed**: a real enrollment (before this task) captured a trailing 0x1A (Ctrl+Z/SUB) control character along with the API key. DPAPI round-tripped it faithfully; tunnel-client's own HTTP client correctly refused to send it as an `Authorization` header value, so `runtimes connect` failed every time.

**File changed**: `C:\Users\sales\proflow-mcp-bridge\enroll-tunnel-credential.ps1` only.

**Exact validation performed**: the captured input is extracted briefly in-memory, leading/trailing control characters (code < 0x20, or 0x7F) are trimmed — the exact observed contamination pattern, safe because it only touches the edges. If any control character remains **inside** the value after trimming, the entire enrollment is **rejected, fail-closed** — nothing is stored, since silently altering the interior of a credential is not safe to automate. An empty result after trimming is also rejected (this sits alongside the pre-existing guard for a truly empty `Read-Host` response). The round-trip verification step now compares the re-decrypted value against the *sanitized* value actually stored, and additionally re-checks that no control character remains in the final result before declaring success — a second safety net.

**Dummy tests: PASS** (all six scenarios, none touching the real file):
| Scenario | Expected | Result |
|---|---|---|
| Clean key | Accepted unchanged | PASS |
| Trailing 0x1A (reproduces the real bug) | Accepted, trimmed | PASS |
| Leading+trailing CR/LF | Accepted, trimmed | PASS |
| Interior control character | Rejected (fail-closed) | PASS |
| Empty input | Rejected (pre-existing guard) | PASS |
| All-control-character input | Rejected (empty after trim) | PASS |

Additionally, a full encrypt → ACL-lock → decrypt → verify round-trip was run end-to-end (disposable test file path, not the real one) for both the clean-key and trailing-0x1A cases — both produced a final stored-and-redecrypted value with **zero control characters** and an exact match to the intended sanitized content.

**Real Owner credential touched: NO.** The real `.secrets\control-plane-api-key.dpapi` (still holding the old, contaminated enrollment) was independently confirmed unchanged — same size (1100 bytes), same original timestamp — after all testing completed.

**Exact Owner re-enrollment command**:
```
powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\enroll-tunnel-credential.ps1
```

---

## Part B — Real-Reboot Startup Audit (read-only)

**ProFlow-Tunnel.vbs exists: YES** — `C:\Users\sales\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\ProFlow-Tunnel.vbs`.
**ProFlow-MCP-Bridge.vbs exists: YES** — same folder, `ProFlow-MCP-Bridge.vbs`.

**Actual Startup location (the real finding)**: `[Environment]::GetFolderPath('Startup')` and, critically, a **direct read of `HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders\Startup`** (and the mirrored `Shell Folders` key) — the actual registry value Windows Explorer itself consults at logon — both report **`C:\ProgramData\ef202d2f98\`**. This is **not** the conventional path where both VBS files were placed in earlier tasks. This user's Startup folder has been redirected to a non-standard location.

**Evidence each launcher executed after reboot: NO — not "not proven," genuinely NO**, cross-corroborated three independent ways:
1. The redirected folder (`C:\ProgramData\ef202d2f98\`) genuinely exists on disk and already contains a real, unrelated, pre-existing startup item (`rween.exe`, dated 2023) — this is an actively-used folder, not a stale/broken registry artifact.
2. `HKCU:\...\Explorer\StartupApproved\StartupFolder` — the registry key Explorer populates only for items it has actually enumerated from its real Startup folder — contains **exactly one entry, `rween.exe`**. Neither ProFlow VBS file appears at all, proving Explorer's Startup processing has never even seen them.
3. Neither `tunnel-autostart.log` nor `bridge.log` contains any entry near the reboot's own timestamp. Both scripts log unconditionally as their very first action (even the "no credential available" fail-closed path logs something) — a genuine automatic run, even one that failed immediately, would have left a trace. None exists in that window.

**Exact root cause established**: both `ProFlow-Tunnel.vbs` and `ProFlow-MCP-Bridge.vbs` were placed in the conventional default Startup path in earlier tasks, but this specific user account's Startup folder has been redirected (via the registry keys above) to `C:\ProgramData\ef202d2f98\`. Windows' real logon-time Startup processing was never going to scan the folder the files were actually placed in — entirely independent of the reboot itself, of VBS/wscript functionality (both files are syntactically correct and were separately proven to execute correctly when manually invoked in earlier tasks), of any antivirus interference, and of any path/quoting issue inside the VBS files themselves (re-inspected fresh this task — both correctly quoted, absolute paths, no current-directory dependency).

**Common failure mechanism: YES** — a single misplacement (wrong folder) affecting both launchers identically, fully explaining why both failed the same way at the same time.

**Classification: A — SMALL, CLEAR FIX.**

**Proposed fix** (not implemented, per explicit read-only instruction): copy both `ProFlow-Tunnel.vbs` and `ProFlow-MCP-Bridge.vbs` into `C:\ProgramData\ef202d2f98\`. No change to VBS content, script logic, DPAPI design, or credential handling is needed. The existing copies in the conventional location can be left in place (harmless — Windows simply never scans them there) or removed once the correct copies are confirmed working.

**Honest caveat**: this exact tool environment has shown filesystem/API virtualization quirks before (documented in §172's `[Environment]::GetFolderPath` finding). While this Part B finding rests on a *direct registry read* rather than that same convenience API — and is independently cross-corroborated three ways above — the Owner is recommended to independently confirm, from their own real interactive session (Win+R → `shell:startup`), that the folder which actually opens matches `C:\ProgramData\ef202d2f98\`, before treating this as fully closed.

**NO Startup mutation performed** — no Startup entries, VBS files, services, Scheduled Tasks, registry, or Windows configuration were modified during Part B. Read-only throughout.

---

## Exact Remaining Owner Actions, in Order

1. Re-run enrollment with the fixed script (Part A) to replace the contaminated credential:
   ```
   powershell -ExecutionPolicy Bypass -File C:\Users\sales\proflow-mcp-bridge\enroll-tunnel-credential.ps1
   ```
2. Independently confirm the real Startup folder via `shell:startup` (Win+R) — should show `C:\ProgramData\ef202d2f98\`.
3. Authorize copying `ProFlow-Tunnel.vbs` and `ProFlow-MCP-Bridge.vbs` into that folder (or perform it themselves) before the next reboot test — this is a separate, small, explicit authorization this session did not assume.

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST CHANGED?** NO.
- **APPLICATION CODE CHANGED?** NO.
- **CUSTOMER DATA ACCESSED?** NO.
- **DEPLOY?** NO.
- **LIVE ACTION?** NO.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§178) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HV) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (§20 already covers this mechanism generally) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

*(filled after push — see below)*

---

## CREDENTIAL SANITIZATION: FIXED AND PROVEN (6 DUMMY SCENARIOS + 2 FULL ROUND-TRIPS) — REAL FILE UNTOUCHED
## STARTUP FAILURE ROOT CAUSE: REGISTRY-CONFIRMED — STARTUP FOLDER REDIRECTED TO C:\ProgramData\ef202d2f98\, BOTH LAUNCHERS IN WRONG FOLDER
## CLASSIFICATION: A — SMALL, CLEAR FIX (copy 2 VBS files) — NOT YET IMPLEMENTED, AWAITING AUTHORIZATION
## NO STARTUP/REGISTRY/SERVICE/SCHEDULED-TASK MUTATION PERFORMED
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## CUSTOMER DATA: NOT ACCESSED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## HE/EN: UNAFFECTED
## OWNER: RE-ENROLL, THEN AUTHORIZE THE VBS-COPY FIX
