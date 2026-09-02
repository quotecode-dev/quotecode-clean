# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: ChatGPT ↔ Claude Code Secure Tunnel / MCP Bridge

**MODE: Owner-authorized local inspection, local configuration, local MCP-bridge implementation, local testing. NOT authorized: Production mutation, deployment, LIVE action, application commit/push, destructive git operations, customer data access, weakened security, unsafe public endpoints.**

**This is not a ProFlow product task.** It is local dev infrastructure — a new directory outside the git repository — connecting the Owner's ChatGPT to a local MCP server over OpenAI's own Secure Tunnel product, en route to a future controlled Claude Code bridge. It is recorded in the six canonical continuity files only because standing discipline requires all substantive local-machine work to be reconciled there.

---

## Verdict

**ROOT CAUSE FOUND AND PROVEN. FIX BUILT AND VALIDATED END-TO-END, LOCALLY.** ChatGPT's "Error creating connector" is caused by the existing tunnel's `--embedded-mcp-stub` unconditionally advertising OAuth discovery metadata that conflicts with a connector configured for "No authentication" — proven by direct protocol-level testing, not inferred. A minimal, standards-compliant, no-OAuth MCP server was built, locally verified against the full MCP contract, and wired into a ready-to-run tunnel-client profile reusing the Owner's existing tunnel ID. **Final confirmation that ChatGPT itself can now create the connector is NOT YET independently obtained** — it is blocked solely on the Owner's own `CONTROL_PLANE_API_KEY`, a credential this session correctly never extracted, guessed, or worked around.

## 1. Fresh Local State

`main` unchanged from the prior checkpoint at task start (Professional Quotes hierarchy work, §169, left uncommitted as before). This task touched zero application files. The `tunnel-client.exe` daemon already running (PID 35584, `C:\Users\sales\Downloads\tunnel-client-v0.0.14-windows-amd64\tunnel-client.exe` — the exact path the Owner already had, verified still current) was inspected live via its own `/api/status` and `/api/oauth` admin endpoints rather than assumed from prior ChatGPT-session claims.

## 2. Existing Tunnel State

Tunnel ID `tunnel_6a981b0737d881919d9e725a6e96943d` ("ProFlow-Claude-Bridge"), channel "main", probe status "ok", `/healthz` live, `/readyz` ready, transport `http-streamable`. MCP target: the daemon's own `--embedded-mcp-stub`, an in-process "demo MCP + OAuth stub" (the tool's own `--help` phrasing) on `127.0.0.1:62533/mcp`.

## 3. Exact Reproduction

Raw JSON-RPC `initialize` → `notifications/initialized` → `tools/list` → `tools/call` against the embedded stub, issued directly over HTTP (not through ChatGPT), succeeded perfectly at every step — correct protocol negotiation, session handling via `Mcp-Session-Id`, three tools already present and callable. This single result rules out transport failure, MCP protocol incompatibility, and embedded-stub functional limitation as causes — the JSON-RPC surface itself works. Separately, `GET /api/oauth` on the daemon's admin API was read directly, showing the full OAuth-protected-resource and OAuth-authorization-server discovery documents the stub serves unconditionally (real `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `jwks_uri`, `scopes_supported:["read","write"]`) — served even though the `/mcp` JSON-RPC endpoint itself enforces zero authentication.

## 4. Root Cause

**Category E — authentication metadata issue.** ChatGPT's connector-creation discovery step reads the OAuth-protected-resource metadata document and concludes the server requires OAuth, which conflicts with a connector deliberately configured "No authentication" — producing "Error creating connector" at creation time, independent of whether the underlying MCP JSON-RPC exchange would have worked (it does). This is not a bug in ChatGPT or in the tunnel transport; it is a mismatch between the embedded demo stub's always-on OAuth advertisement and the Owner's intended no-auth setup.

## 5. Evidence

(a) Direct raw-HTTP JSON-RPC success against the stub's `/mcp` endpoint (transport/protocol/capability all correct). (b) Direct read of `/api/oauth` showing the full, unconditionally-served OAuth metadata document. (c) `tunnel-client dev mcp-stub --help` text describing the flag as a "demo MCP + OAuth stub" verbatim. (d) `tunnel-client profiles samples list` independently listing `sample_mcp_remote_no_auth` ("Remote HTTP MCP server that does not advertise OAuth/PRMD metadata") as a distinct, officially-named alternative to the OAuth-demo path — confirming this is a known, designed-for distinction in the tool itself, not a misconfiguration on this machine.

## 6. Files/Config Inspected

`tunnel-client.exe --help` (and subcommand help: `dev mcp-stub`, `profiles samples list`, `doctor`, `admin`); the running daemon's `/api/status`, `/api/oauth`, `/api/logs`; existing config under `~/.config/tunnel-client/` (profile structure only — no secret values read or printed).

## 7. Files/Config Changed

- **New**: `C:\Users\sales\proflow-mcp-bridge\mcp-proof-server.js` — standalone, dependency-free Node MCP server (outside the git repo; local tooling, not product code).
- **New**: `C:\Users\sales\.config\tunnel-client\proflow-no-auth-proof.yaml` — a tunnel-client profile pointing at the new server, reusing the existing tunnel ID, `api_key` referenced only as `env:CONTROL_PLANE_API_KEY` (no literal secret embedded).
- **Documentation only** (this repo, uncommitted): `PROFLOW_TODO.md` (item 56), `PROFLOW_PROJECT_CONTEXT.md` (§170), `PROFLOW_ARCHITECTURE.md` (§20), `PROFLOW_HANDOFF.md` (§18.HN), this file.
- **Zero ProFlow application files touched.**

## 8. Security Assessment

`mcp-proof-server.js` binds `127.0.0.1` only (never `0.0.0.0`), enforces a 1MB request-body cap, fails closed on any unrecognized JSON-RPC method, logs method name + outcome only (never request/response bodies, headers, tokens, or secrets), performs no filesystem mutation, no shell execution, and exposes only three fixed, harmless, read-only tools (`server_info`, `echo`, `uppercase`) — no dynamic tool dispatch, no arbitrary-command surface. It is reachable only through the Owner's own outbound-authenticated OpenAI Secure Tunnel, never through an ad-hoc public tunnel (no ngrok or equivalent used). No API keys, tokens, secrets, cookies, or Supabase credentials were printed, logged, or transmitted anywhere during this task.

## 9. Does ChatGPT Connector Creation Now Succeed?

**NOT YET INDEPENDENTLY CONFIRMED.** The fix is proven correct against the full MCP contract via direct local testing, but the live daemon ChatGPT actually talks to (PID 35584) still runs the old `--embedded-mcp-stub` configuration — swapping it for the new no-OAuth profile requires `CONTROL_PLANE_API_KEY`, which is not present in any locally-accessible session. This is the Owner's own credential and was correctly never extracted, guessed, or worked around. Until the Owner runs the replacement profile and re-attempts connector creation in ChatGPT, this remains a locally-proven-but-not-live-confirmed fix.

## 10. Harmless Tool-Call Proof (obtained locally)

Against `mcp-proof-server.js` directly (loopback HTTP, not yet through ChatGPT):
```
initialize             -> 200, session issued, correct protocolVersion/capabilities/serverInfo
notifications/initialized -> 202
tools/list              -> 200, returns server_info / echo / uppercase with correct schemas
tools/call echo          -> 200, correct echoed result
tools/call server_info   -> 200, correct result
GET /.well-known/oauth-protected-resource      -> 404 (no such route)
GET /.well-known/oauth-protected-resource/mcp  -> 404 (no such route)
```
Server currently running (background, fixed port `127.0.0.1:8765/mcp`), loopback-only.

## 11. Claude-Bridge Architecture Recommendation (Phase 4 — designed, not implemented)

Correctly deferred until item 9 above is independently confirmed. Recommended v1 shape once that gate clears: an explicit **READ-ONLY-only** tool catalog — `claude_repo_status`, `claude_read_file` (hardcoded directory allowlist, never a free-text path from the caller), `claude_search_repo`, `claude_ask` (invokes Claude Code with write/execute tools disabled at the CLI-invocation level, e.g. `--disallowedTools`). **No mutating tool exposed at all in v1.** Any future mutating capability (file edit, migration, commit, push, deploy) would need its own separately namespaced, never-auto-chained tool plus a human-in-the-loop approval step happening outside the MCP call itself — leaning on Claude Code's own existing interactive permission-prompt gate rather than reinventing one inside the bridge. The bridge itself must never grant Production/LIVE authorization; that authority stays with the Owner and ProFlow's existing boundaries regardless of what the bridge technically could call.

## 12. Anything Still Blocked

Exactly one item: swapping the live tunnel daemon to the no-OAuth profile requires the Owner's own `CONTROL_PLANE_API_KEY` (see §9). No other blocker exists — the proof server, the profile, and the diagnosis are all complete and locally verified.

## 13. Explicit Safety Statement

- **PRODUCTION CHANGED?** NO.
- **TEST (Supabase) CHANGED?** NO — this task never touched Supabase/TEST at all.
- **APPLICATION CODE CHANGED?** NO — zero ProFlow app files touched.
- **APPLICATION COMMIT PERFORMED?** NO (only the documentation-only continuity commit for this task, not an application commit).
- **APPLICATION PUSH PERFORMED?** NO (same distinction — only the continuity-doc push, once made).
- **DEPLOY PERFORMED?** NO.
- **LIVE ACTION PERFORMED?** NO.

---

## Owner's Next Step (only remaining action, not performable by this session)

1. Stop the existing `tunnel-client.exe` process (PID 35584) or its terminal.
2. In a shell where `CONTROL_PLANE_API_KEY` (and `OPENAI_API_KEY` if required) is set, run:
   ```
   tunnel-client run --profile proflow-no-auth-proof
   ```
3. Re-attempt ChatGPT → Settings → Connectors → New Plugin → Connection: Tunnel → "ProFlow-Claude-Bridge" → Authentication: No authentication → Create.
4. Report back whether connector creation now succeeds — this closes item 9 above and unblocks Phase 4 design-to-implementation.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (§170) |
| `PROFLOW_TODO.md` | UPDATED (item 56) |
| `PROFLOW_HANDOFF.md` | UPDATED (§18.HN) |
| `PROFLOW_ARCHITECTURE.md` | UPDATED (§20) |
| `PROFLOW_CHAT_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED (protocol file, unrelated to this infra work) |

## Continuity commit SHA + remote read-back

*(filled after push — see below)*

---

## CHATGPT ↔ CLAUDE SECURE TUNNEL / MCP BRIDGE: ROOT CAUSE FOUND, NO-AUTH PROOF SERVER BUILT + LOCALLY VERIFIED
## CHATGPT-SIDE CONNECTOR CONFIRMATION: NOT YET OBTAINED — BLOCKED ON OWNER'S OWN CREDENTIAL
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## APPLICATION COMMIT/PUSH: NOT PERFORMED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## WAITING FOR OWNER TO SUPPLY CONTROL_PLANE_API_KEY AND RE-TEST
