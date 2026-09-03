# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Execute Verified Startup-Folder Fix Only

**MODE: Owner-authorized, exact, narrow mutation only — copy two named VBS files to the Owner-confirmed real Startup folder. Nothing else authorized.**

---

## Verdict

**Executed exactly as scoped, and fully verified.** Both VBS launchers now exist, byte-identical to their originals, in the correct registry-defined Startup folder. `rween.exe` was never touched. Nothing else was modified. Timestamp evidence (credential value never accessed) strongly suggests the Owner has already re-enrolled with the fixed script.

## Copy Operation

`Copy-Item` (content-preserving, no modification) of:
- `ProFlow-Tunnel.vbs`
- `ProFlow-MCP-Bridge.vbs`

from `C:\Users\sales\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\` to `C:\ProgramData\ef202d2f98\`.

## Verification

**Both destination files exist: YES.**

**Source and destination hashes match (SHA-256, computed independently before and after):**
| File | Hash |
|---|---|
| `ProFlow-Tunnel.vbs` (source, pre-copy) | `3D7F2215427A491B4527BF5A7B5C313C9BFE5E5DB7775743DBE0A48987D4D82D` |
| `ProFlow-Tunnel.vbs` (destination, post-copy) | `3D7F2215427A491B4527BF5A7B5C313C9BFE5E5DB7775743DBE0A48987D4D82D` — **match** |
| `ProFlow-MCP-Bridge.vbs` (source, pre-copy) | `CF6E5D108A4D9F9F4EF2172B141BDD5F3DA7B3BF1FEC09A9843E5F2FB17101B0` |
| `ProFlow-MCP-Bridge.vbs` (destination, post-copy) | `CF6E5D108A4D9F9F4EF2172B141BDD5F3DA7B3BF1FEC09A9843E5F2FB17101B0` — **match** |

**`rween.exe` remains untouched: YES.** SHA-256 hash captured before the copy (`7B178AA78120530724F481B6AA7E6268FC49BB8AB49575E22C29A862310163D7`) and re-verified identical afterward. Size (3,927,138 bytes) and `LastWriteTime` (2023-05-02 18:26:24) also independently reconfirmed unchanged. It was never opened, executed, renamed, or otherwise interacted with.

**Destination folder contains the expected items: YES.**
- Before: `desktop.ini`, `rween.exe` (2 items).
- After: `desktop.ini`, `rween.exe`, `ProFlow-Tunnel.vbs`, `ProFlow-MCP-Bridge.vbs` (4 items) — exactly the pre-existing two plus the two newly-copied launchers. No unexpected files were created.

**Source (conventional-location) copies**: independently reconfirmed still present and unchanged — nothing was deleted, per instruction.

## DPAPI Credential Re-Enrollment Status

Checked **via timestamps only** — the credential value was never accessed, displayed, decrypted, or modified for this check, per explicit instruction.

- `enroll-tunnel-credential.ps1` (the fixed, sanitizing script from the prior task): last modified `2026-09-03 02:50`.
- `.secrets\control-plane-api-key.dpapi`: `LastWriteTime` is now `2026-09-03 03:03` — **changed** from its original enrollment timestamp of `02:23`.

Since the file was rewritten *after* the sanitization fix was already in place, this is strong (though not certainty-grade, since content was correctly never inspected) evidence that **the Owner has already independently re-enrolled using the fixed script**. This is **not yet corroborated by an actual successful connection** — `tunnel-autostart.log`'s most recent entry is still the original pre-fix failure at `02:39:51`; no fresh `runtimes connect` attempt has been logged since the re-enrollment, because re-enrollment alone does not trigger one (that only happens when `start-tunnel.ps1` actually runs, which it has not since). Neither `tunnel-client.exe` nor the Bridge `node.exe` is currently running — expected, and this session correctly did not start either proactively, per this task's explicit "STOP after verification and report" scope.

## What Remains

The real test — a genuine Windows logon triggering both launchers automatically from their new, correct location — has not yet been observed. That requires either the Owner's next real logon, or an explicit separate authorization to simulate/test it now.

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
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§179) |
| `PROFLOW_TODO.md` | UPDATED (item 56 status line) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HW) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `5bf5037`.

---

## STARTUP-FOLDER FIX: EXECUTED EXACTLY AS SCOPED, HASH-VERIFIED
## rween.exe: CONFIRMED UNTOUCHED (HASH/SIZE/TIMESTAMP MATCH)
## DESTINATION FOLDER: EXPECTED 4 ITEMS, NO SURPRISES
## SOURCE COPIES: LEFT IN PLACE, UNCHANGED
## DPAPI CREDENTIAL: LIKELY ALREADY RE-ENROLLED (TIMESTAMP EVIDENCE ONLY, VALUE NEVER ACCESSED)
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## CUSTOMER DATA: NOT ACCESSED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## HE/EN: UNAFFECTED
## NEXT REAL TEST: A GENUINE LOGON, NOT YET OBSERVED
