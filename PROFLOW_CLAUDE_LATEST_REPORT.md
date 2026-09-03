# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Permanent Hebrew / RTL Owner-Communication Rule

**MODE: documentation/continuity only. No application code, Bridge, tunnel-client, Startup, Windows, credentials, TEST, Production, database, deployment, or LIVE state was touched.**

---

## Verdict

**Rule recorded, placed for guaranteed early encounter.** The authoritative full rule lives in `PROFLOW_CHAT_HANDOFF.md` §0.1 — a small, reliably-read file, immediately following the existing large-file-limitation rule at §0, both encountered early in the mandatory bootstrap. A concise cross-reference was added to `PROFLOW_PROJECT_CONTEXT.md`'s own top banner (the very first thing a new session reads), matching the pattern already established for the large-file rule.

## Placement Reasoning

Same reasoning as the prior large-file-limitation task: a rule meant to govern *communication itself* must be visible before much communication has happened, and must not depend on a large, potentially-truncated file. `PROFLOW_CHAT_HANDOFF.md` is read as step 2 of the existing mandatory reading order and is well under any practical size limit, so it is the reliable authoritative home. A one-line pointer was added to `PROFLOW_PROJECT_CONTEXT.md` (read as step 1) so the rule is flagged even before `PROFLOW_CHAT_HANDOFF.md` is reached. No duplication was added to `PROFLOW_HANDOFF.md`, `PROFLOW_ARCHITECTURE.md`, or `PROFLOW_TODO.md` — this rule isn't tied to file size the way the prior one was, and the two-location coverage already guarantees early encounter without unnecessary repetition.

## Rule Content (summary — full text in `PROFLOW_CHAT_HANDOFF.md` §0.1)

1. Owner-facing communication is in Hebrew by default, unless the Owner explicitly requests another language.
2. Hebrew prose must always read naturally in RTL — never visually reversed, scrambled, or broken.
3. Avoid excessive inline mixing of Hebrew with English technical text inside one sentence.
4. Technical LTR material (commands, paths, filenames, branch names, commit SHAs, identifiers, function names, exact error strings, code) goes in inline-code formatting or its own line/block whenever that improves RTL/BiDi stability.
5. Prefer rewriting the surrounding Hebrew sentence naturally over leaving Hebrew/English interleaved in a way that may render incorrectly.
6. Governs Owner-facing ChatGPT communication only — Claude/coding-agent prompts, source code, and exact technical literals stay in English when technically preferable.
7. Permanent — survives every future chat transition and the mandatory six-file bootstrap.

## Files Changed

- `PROFLOW_CHAT_HANDOFF.md` — new §0.1, placed immediately after the existing §0 (large-file rule), before §1.
- `PROFLOW_PROJECT_CONTEXT.md` — one-line cross-reference added to the existing top "NEW CHAT / SESSION" banner.
- `PROFLOW_HANDOFF.md`, `PROFLOW_ARCHITECTURE.md`, `PROFLOW_TODO.md` — reviewed; no change (avoiding unnecessary duplication, per instruction — early-encounter coverage is already guaranteed by the two locations above).

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST CHANGED?** NO.
- **APPLICATION CODE CHANGED?** NO.
- **BRIDGE/TUNNEL CHANGED?** NO.
- **WINDOWS/STARTUP/DPAPI CHANGED?** NO.
- **DEPLOY?** NO.
- **LIVE ACTION?** NO.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (top-banner cross-reference added) |
| `PROFLOW_TODO.md` | REVIEWED — NO CHANGE REQUIRED |
| `PROFLOW_HANDOFF.md` | REVIEWED — NO CHANGE REQUIRED |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED |
| `PROFLOW_CHAT_HANDOFF.md` | UPDATED (new §0.1 — the authoritative rule) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `f501036`.

---

## PERMANENT HEBREW-DEFAULT RULE: RECORDED
## RTL/BiDi READABILITY RULE: RECORDED
## TECHNICAL LTR ISOLATION RULE: RECORDED
## FUTURE-BOOTSTRAP INHERITANCE: GUARANTEED (PROFLOW_CHAT_HANDOFF.md §0.1, read early; cross-referenced from PROFLOW_PROJECT_CONTEXT.md's own top banner)
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## BRIDGE/TUNNEL: UNCHANGED
## WINDOWS/STARTUP/DPAPI: UNCHANGED
## DEPLOY / LIVE ACTION: NOT PERFORMED
