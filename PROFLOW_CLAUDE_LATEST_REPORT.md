# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Document Large Canonical File Read Limitation for Future ChatGPT Sessions

**MODE: documentation/continuity only. No application code, Bridge, tunnel-client, Startup, Windows, DPAPI, TEST, Production, database, deployment, or LIVE state was touched.**

---

## Verdict

**Rule documented, placed so it is encountered before a bootstrap can falsely fail.** The primary, guaranteed-to-be-read copy lives in `PROFLOW_CHAT_HANDOFF.md` §0 — a small file, unaffected by the size problem itself, and already read early (step 2) in the mandated bootstrap order. Short pointers to that rule were also added at the very top of both affected large files (`PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_HANDOFF.md`), so whichever of the two *does* read successfully still carries the warning forward for the other.

## Placement Reasoning

The failure mode is specifically: a connector read of one of the two large files returns empty `content`. A warning placed *only inside* those same two files would not help in that exact scenario — the session would never see it. `PROFLOW_CHAT_HANDOFF.md` is part of the same six-file set, is well under any practical size limit, and is already read as step 2 of the existing mandatory bootstrap order (`PROFLOW_PROJECT_CONTEXT.md`'s own "Required Reading Order") — making it the reliable, guaranteed-to-land home for the rule. Short pointers were additionally placed at the very top of both large files as defense-in-depth, in case a partial/ranged read of just the beginning succeeds even when a full-content read does not.

## Rule Content (summary — full text in `PROFLOW_CHAT_HANDOFF.md` §0)

1. Names both files explicitly (`PROFLOW_PROJECT_CONTEXT.md`, `PROFLOW_HANDOFF.md`) as known large files exceeding some connectors' practical content-return limit.
2. States plainly that empty `content` with valid metadata/SHA is a tool limitation, never evidence of an empty/corrupt/missing file or broken continuity.
3. Preserves the six-file fresh-read-and-reconcile requirement unchanged — this rule does not relax it.
4. Requires trying a reasonable read-only alternative (ranged/partial read, raw/blob read, GitHub API blob endpoint, targeted search + section retrieval, or any other available read-only mechanism) before concluding anything.
5. States metadata/SHA/existence alone is not a successful read — actual content must come back through some working method.
6. Explicitly forbids asking the Owner to paste either file merely because one connector method hit its size limit.
7. Explicitly forbids substituting chat memory, history, a Claude report summary, or another of the six files for the actual fresh read.
8. Only after genuinely exhausting available read-only alternatives may a session fail closed with exactly `CONTINUITY BOOTSTRAP INCOMPLETE`.

## Files Changed

- `PROFLOW_CHAT_HANDOFF.md` — new §0, placed before the existing §1, containing the full rule.
- `PROFLOW_PROJECT_CONTEXT.md` — short pointer added to the existing top "NEW CHAT / SESSION" banner.
- `PROFLOW_HANDOFF.md` — short pointer added to the existing top "CURRENT RESUME STATE" banner.
- `PROFLOW_TODO.md`, `PROFLOW_ARCHITECTURE.md` — reviewed; the rule does not belong in either (not part of the size-affected files or the bootstrap-read-order chain in the same way) — no change made.

## Explicit Safety Report

- **PRODUCTION CHANGED?** NO.
- **TEST CHANGED?** NO.
- **APPLICATION CODE CHANGED?** NO.
- **BRIDGE/TUNNEL CHANGED?** NO.
- **DEPLOY?** NO.
- **LIVE ACTION?** NO.

---

## Six-File Continuity Ledger

| File | Status |
|---|---|
| `PROFLOW_CLAUDE_LATEST_REPORT.md` | UPDATED (this file, full rewrite) |
| `PROFLOW_PROJECT_CONTEXT.md` | UPDATED (top-banner pointer added) |
| `PROFLOW_TODO.md` | REVIEWED — NO CHANGE REQUIRED (rule doesn't belong here) |
| `PROFLOW_HANDOFF.md` | UPDATED (top-banner pointer added) |
| `PROFLOW_ARCHITECTURE.md` | REVIEWED — NO CHANGE REQUIRED (rule doesn't belong here) |
| `PROFLOW_CHAT_HANDOFF.md` | UPDATED (new §0 — the primary, reliable home for this rule) |

## Continuity commit SHA + remote read-back

Content commit pushed to `origin/proflow-continuity`: `a1280f6`.

---

## LARGE-FILE READ LIMITATION: DOCUMENTED, PLACED IN THE RELIABLY-READ FILE (PROFLOW_CHAT_HANDOFF.md §0)
## FILES NAMED EXPLICITLY: YES (PROFLOW_PROJECT_CONTEXT.md, PROFLOW_HANDOFF.md)
## FALSE-FAILURE / EMPTY-CONTENT WARNING: RECORDED
## ALTERNATIVE READ-PATH REQUIREMENT: RECORDED
## OWNER-NOT-DATA-TRANSPORT RULE: RECORDED
## SIX-FILE BOOTSTRAP REQUIREMENT: PRESERVED, NOT RELAXED
## PRODUCTION: UNCHANGED
## TEST: UNCHANGED
## APPLICATION CODE: UNCHANGED
## BRIDGE/TUNNEL: UNCHANGED
## DEPLOY / LIVE ACTION: NOT PERFORMED
## HE/EN: UNAFFECTED
