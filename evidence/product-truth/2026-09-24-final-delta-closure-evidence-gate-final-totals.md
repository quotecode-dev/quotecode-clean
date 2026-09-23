# FINAL SEMANTIC EVIDENCE GATE — FINAL TOTALS (Finding 5, applied)

Applies `productTruthEvidenceSchema.js`'s `validateEvidenceMatrix` (schema completeness + semantic
correctness + matrix-slot integrity, never a bare row count) to the 4 required terminal matrices,
after Finding 6's TEST redeploy (chat-ai v32, implementation SHA `08c012bcd6094335e987e7972c66604c2579e125`).

## Method

- **Owner Sample Terminal Matrix (48 cells):** historical prompt/answer
  (`2026-09-23-final-closure-blocker5-raw-owner-planrole.json`) enriched with a fresh deterministic
  `resolvedResult` from the CURRENT classifiers (`classifyCapabilityIntent` / `classifyPaymentIntent`
  / `classifyInvoicingIntent`) - zero null results. The 2 Print adversarial cells (OM-11 HE, OM-12
  EN) are **replaced**, not backfilled, with this round's fresh live rerun against v32.
  Script: `scripts/build-owner-matrix-final-evidence.mjs`. Output:
  `2026-09-24-final-delta-closure-owner-matrix-final-rows.json`.
- **Plan/Role Terminal Matrix (13 cells):** same historical-prompt enrichment, plus real server-side
  plan/market/role facts (item 8, `scripts/verify-plan-role-server-facts.mjs`) bound to every row -
  none of the 13 rows use the one persona (`LOCAL_FREE`) whose credentials could not sign in this
  round, so all 13 have real server verification, not just 7/8. Script:
  `scripts/build-plan-role-final-evidence.mjs`. Output: `2026-09-24-final-delta-closure-plan-role-final-rows.json`.
- **Security Matrix (9 cells):** `resolvedResult` is a fail-safe sentinel (`fail_safe` /
  `unsafe_leak_detected`), mechanically derived from a per-cell forbidden-leak pattern check against
  the real response text (never a subjective read). The `market_forgery` cell is **replaced** with
  this round's fresh v32 rerun (the fix). Script: `scripts/build-security-support-final-evidence.mjs`.
  Output: `2026-09-24-final-delta-closure-security-final-rows.json`.
- **AI Support Category Matrix (4 cells):** `resolvedResult` is the REAL `chat_logs.category` value
  from the row's own `readback.row.category` (the original live read-back), with the row's real
  `chat_logs` primary key bound as `immutableTestRowId`. Output:
  `2026-09-24-final-delta-closure-support-final-rows.json`.
- Rows captured against the pre-delta deploy (all except the 3 replaced cells) are honestly marked
  `historicalVersion: true` per task §11 - the gate's stale-SHA check (`checkEvidenceRuntimeFreshness`)
  would otherwise flag them, and correctly does not since they self-disclose.

## Result (real, mechanically computed via `validateEvidenceMatrix`, not narrated)

| Matrix | Required | Valid | Missing | Duplicate | Unknown |
|---|---|---|---|---|---|
| Owner Sample Terminal | 48 | **48** | 0 | 0 | 0 |
| Plan/Role | 13 | **13** | 0 | 0 | 0 |
| Security | 9 | **9** | 0 | 0 | 0 |
| AI Support Category | 4 | **4** | 0 | 0 | 0 |

**48 / 48 VALID OWNER CELLS. 13 / 13 VALID PLAN/ROLE CELLS. 9 / 9 VALID SECURITY CELLS. 4 / 4 VALID
AI SUPPORT CATEGORY CELLS.**

**FINAL EVIDENCE SEMANTIC GATE: PASS.**
