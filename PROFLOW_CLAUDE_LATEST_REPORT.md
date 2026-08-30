# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Restore Safe Browser-Harness Environment — Diagnosis + Owner Setup Instructions Only

**EFFORT LEVEL: MAXIMUM.** Diagnosis and exact Owner setup instructions only — not the browser QA itself, and nothing was started, stopped, or configured this task.

---

## INSTALLED TOOLING

**BROWSER-HARNESS VERSION**: `0.1.10` (confirmed via `browser-harness --version`), installed via `uv tool` at `AppData/Roaming/uv/tools/browser-harness/Lib/site-packages/browser_harness/`.

**SKILL**: `~/.claude/skills/browser-harness/SKILL.md` (read in full).

**DAEMON START COMMAND**: There is no separate literal "daemon start" subcommand. The daemon (`python -m browser_harness.daemon`) auto-spawns as a side effect of any *normal* script invocation — `browser-harness <<'PY' ...` (or, on Windows, piping a script into `browser-harness`) — run from a shell where `BH_REQUIRE_EXISTING_DAEMON` is **not** `"1"`. Confirmed by reading `admin.py`'s `ensure_daemon()`, which literally calls `subprocess.Popen([sys.executable, "-m", "browser_harness.daemon"], ...)`.

**DAEMON STATUS COMMAND**: `browser-harness --doctor` (human-readable) or `browser-harness doctor --json [--require-existing-daemon]` (machine-readable) — both confirmed working this task, both read-only.

**DAEMON STOP COMMAND**: `browser-harness --reload` — documented in `--help` as *"stop the daemon so next call picks up code changes."* Confirmed via `admin.py`'s own code comment on `stop_remote_daemon()`: *"`restart_daemon` is misnamed — it only stops the daemon... a follow-up `browser-harness` call would auto-spawn a fresh one via `ensure_daemon()`."*

---

## DEDICATED CHROME

**CHROME PATH**: `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe` (confirmed present via `Test-Path` → `True`).

**DEDICATED PROFILE PATH**: `C:\Users\sales\ProFlow-BrowserHarness-Profile` (confirmed does **not** already exist via `Test-Path` → `False` — free to use, no collision).

**EXACT OWNER LAUNCH COMMAND**:
```powershell
& "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir="C:\Users\sales\ProFlow-BrowserHarness-Profile" --no-first-run --no-default-browser-check
```

**REMOTE DEBUGGING BIND**: `127.0.0.1` only (loopback), made explicit via `--remote-debugging-address=127.0.0.1` — this is Chrome's own default when the flag is omitted; it is included for defense-in-depth clarity, not because omitting it would expose the port externally. No `0.0.0.0`, no LAN IP, no tunnel, no port-forward, no firewall change is recommended or needed.

**PERSONAL CHROME AFFECTED: NO** — a distinct `--user-data-dir` produces a fully independent Chrome process/profile by Chrome's own standard, documented design (separate cookies, history, extensions, process tree). It does not read, lock, or interfere with the Owner's `Default`/`Profile 1` directories. Multiple concurrent Chrome instances under different `--user-data-dir` values is a standard Chrome-supported configuration, confirmed consistent with how `browser-harness`'s own source (`PROFILES`-based multi-profile detection in `daemon.py`) already expects Chrome to be used.

---

## HOW THIS WAS DETERMINED (no command guessed)

Read `daemon.py`'s `get_ws_url()` directly: when `BU_CDP_URL` is set (it is — `http://127.0.0.1:9222`), the function **only polls that URL for 30 seconds and never launches Chrome under any circumstance**. Its own built-in timeout error message (line 251) is: *"is the dedicated automation Chrome running? Launch it with `--remote-debugging-port=<port> --user-data-dir=<dedicated dir>`"* — this is the tool's own authoritative instruction, not an inference.

Read `admin.py`'s `ensure_daemon()`: all of its Chrome-launching behavior (`_launch_browser()`, opening `chrome://inspect`, handling the macOS "Allow" popup) is explicitly gated behind `if local and ...` where `local = _is_local_chrome_mode(env)` — none of it applies when `BU_CDP_URL` is set, confirming Chrome is connected to, never launched, in this environment.

Read `admin.py`'s `require_existing_daemon()` (the function this session's `BH_REQUIRE_EXISTING_DAEMON=1` routes to): its own docstring states *"Require a healthy existing daemon without spawning or reconnecting. Trusted orchestrators use this after they provision a scoped CDP transport. Failing closed prevents a later CLI call from silently discovering a different local Chrome when that orchestrator-owned daemon dies."* It never spawns anything, confirmed by its body (two checks only: `daemon_alive()` and one CDP health-check call).

Checked whether `BH_REQUIRE_EXISTING_DAEMON=1` is a persistent Windows setting or specific to this session: `[Environment]::GetEnvironmentVariable('BH_REQUIRE_EXISTING_DAEMON','User')` and `'Machine'` both returned empty; only `'Process'` returned `1`. **This confirms the restriction is scoped only to this Claude Code session's own process tree** — a separately-opened PowerShell/CMD window the Owner runs themselves does not inherit it and runs `browser-harness` in normal, self-healing mode.

Inspected `~/.config/browser-harness/runtime/` (read-only): `bu-default.pid` contained `5244`, confirmed stale (`Get-Process -Id 5244` returned nothing). `bu-default.log`'s earliest surviving lines show a genuinely working prior session: `connecting to ws://127.0.0.1:9222` → `listening on 127.0.0.1:49881 (name=default, remote=local)`, with later entries attached both to `127.0.0.1:9222/json/version` and a local ProFlow dev server (`localhost:5184/dashboard`) — confirming this exact architecture worked before, and containing zero evidence the daemon ever spawned Chrome itself.

---

## OWNER PROCEDURE

**STEP 1** — Open a normal PowerShell or Command Prompt window (a fresh one the Owner opens themselves — not this Claude Code session's terminal).

Run:
```powershell
& "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir="C:\Users\sales\ProFlow-BrowserHarness-Profile" --no-first-run --no-default-browser-check
```

**EXPECTED**: A new, separate Chrome window opens — visibly a brand-new empty profile (no bookmarks, extensions, or history from the Owner's normal browsing), distinct from the Owner's regular Chrome window, which remains untouched and can stay open the whole time.

**STEP 2** — In any browser (including the new dedicated Chrome), open:
```
http://127.0.0.1:9222/json/version
```

**EXPECTED**: A JSON response containing `"Browser": "Chrome/..."` and a `"webSocketDebuggerUrl"` field — confirms the dedicated Chrome's remote-debugging port is up and reachable.

**STEP 3** — In the **same** PowerShell/CMD window from Step 1 (or any other fresh window — just not this Claude Code session), run:
```powershell
"print(page_info())" | browser-harness
```

**EXPECTED**: Printed page info (URL/title of the dedicated Chrome's current tab, e.g. a blank new-tab page) — confirms the browser-harness daemon started and successfully attached to the dedicated Chrome.

**STEP 4** — Run:
```
browser-harness --doctor
```

**EXPECTED**: `chrome running` ok, `daemon alive` ok, `active browser connections` ≥ 1 — the healthy state, in contrast to the `FAIL`/`0` state observed throughout the prior two tasks.

Once Step 4 shows healthy, this Claude Code session's own `browser-harness --doctor --require-existing-daemon` should also report healthy on the next attempt, since it will find the now-alive, now-reachable daemon and reuse it (per `require_existing_daemon()`'s own documented "health-check and reuse" behavior).

---

## RESPONSIBILITY

**OWNER-REQUIRED STEPS**:
- **Step 1** (launch the dedicated Chrome) — recommended Owner-executed for this first restoration, so the Owner can see and trust the isolated window appear. Technically within Claude's tool capability once explicitly authorized for routine future restarts, but not attempted this task.
- **Step 3** (bootstrap the daemon from an unrestricted shell) — **Owner-required, and NOT Claude-executable even with future authorization.** Performing this from within this session's own Bash tool would require stripping or overriding the `BH_REQUIRE_EXISTING_DAEMON=1` flag the orchestrator deliberately set on this session's process tree specifically to prevent it from self-provisioning a daemon. That is a bypass of the fail-closed design regardless of how it's phrased or authorized, and is treated as permanently out of bounds for this session — not merely deferred to a later task.

**CLAUDE-CAN-EXECUTE-LATER**:
- **Step 2** (verify `127.0.0.1:9222/json/version`) — a read-only GET request with zero side effects, the same class of check already used throughout this session's diagnostics.
- **Step 4** (re-run `browser-harness --doctor`) — a read-only diagnostic, already used repeatedly this session.

---

## PERSISTENCE RECOMMENDATION

**RECOMMENDED: YES**

**METHOD**: a single Owner-facing `.bat`/`.ps1` launcher (e.g., double-click "Start ProFlow Review Browser") that (a) launches the dedicated Chrome with the exact flags above if not already running, (b) polls `127.0.0.1:9222/json/version` until reachable, (c) pipes one bootstrap script into `browser-harness` from that same unrestricted shell, (d) prints the final `--doctor` status.

**WHY**: eliminates copy-paste risk across the 4 manual steps above and makes this fully repeatable every session, **without weakening fail-closed behavior in any way** — `BH_REQUIRE_EXISTING_DAEMON=1` remains scoped only to this Claude Code session's own process tree (confirmed process-local, not User/Machine-persisted) regardless of whether such a launcher exists elsewhere on the machine. **Not created this task**, per explicit instruction — evaluation only.

---

## SAFETY

**PERSONAL CHROME MODIFIED: NO**
**PROCESS STARTED: NO**
**PROCESS STOPPED: NO**
**ENVIRONMENT CHANGED: NO**
**PROJECT FILES CHANGED: NO**
**TEST MUTATED: NO**
**PRODUCTION MUTATED: NO**
**COMMIT: NO**
**PUSH: NO**
**DEPLOY: NO**

---

## CURRENT STATUS

**BROWSER ENVIRONMENT: STILL BLOCKED** — exactly as it was at the end of the prior (Real-Browser QA Completion) task. This task performed diagnosis and produced a verified setup procedure only; it does not claim or imply the environment has been restored.

**NEXT ACTION**: Owner reviews the procedure above and, if approved, executes Steps 1 and 3 from their own PowerShell/CMD window (outside this Claude Code session). Once the Owner confirms Step 4 shows healthy, a follow-up task can complete the still-outstanding real-browser Landing Prerender QA (§70).

**Preserved open items, unchanged, not acted on this task**: Landing prerender real-browser QA — BLOCKED pending Browser Harness restoration. Landing Phase 4 Preview — NOT AUTHORIZED. Hot Quote fixed geometry — OPEN. Desktop HE/EN Client Type + Views mirroring — OPEN. Vercel legacy root 308 — OPEN. Approved Status Color — TODO. P1 / Session Timeout — OPEN.

**CONTINUITY READ-BACK: PASS** (this sync — see below)

---

## FINAL STOP

**DO NOT restore/start anything yet.** Nothing was started, stopped, or configured this task. This verified setup procedure is returned to Owner + ChatGPT for review.
