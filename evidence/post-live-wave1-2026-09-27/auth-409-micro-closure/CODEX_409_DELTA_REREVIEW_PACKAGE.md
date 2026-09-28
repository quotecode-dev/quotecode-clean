# Codex delta RE-review package — Option C blocker P1 (Resend 409 idempotency lifecycle)

**Audience:** the independent Codex reviewer.
**Status:** Builder fix done locally. **Codex re-review: NOT RUN** (required). TEST re-proof: NOT RUN. Production untouched. Not pushed.

## 1. Identity
- **Code commit under review:** `e4c81b98ecdac80782fe06496a0882560aced4ad`.
- **Parent:** `2648e3ed803d137d2e0a7a5f10a934b5d1b73903` — the Option C candidate that **FAILED** your delta review (one blocker, P1). It is preserved.
- **Chain:** `8e5ac58` → `56bca55` (Option C code) → `2648e3e` (Option C evidence) → `e4c81b9` (this fix) → the evidence-only commit adding this folder = the **new candidate** (SHA in the continuity).
- **Review scope:** `git diff 2648e3e e4c81b9`. 5 files: `auth-send-email-hook/{handler.ts, handler.test.js, resendSend.ts (new), resendSend.test.js (new)}` + the Product Truth baseline (+1 zero-gap entry for `resendSend.ts`).
- **Unchanged vs `2648e3e`** (`01-identity.txt`): marketResolver, marketLookup, webhookVerify, emailPlan, emailContent, index.ts, migrations, trial function, api, package files, config.
- **Stages 1 / 2 / 4:** unchanged vs `8e5ac58`.

## 2. The blocker and the fix
- **P1 (yours):** every Resend 409 became a hook 500. Scenario: attempt 1 accepted, response lost; the redelivery resolves a different market (different body, same stable key); Resend replies `invalid_idempotent_request`; the Auth lifecycle was falsely failed.
- **Fix — `resendSend.ts` `sendWithIdempotency`.** It decides by the provider's documented error `name`, never by status alone:

| Provider response | Outcome | Hook result |
|---|---|---|
| 2xx | sent | continue with the next slot |
| 409 `invalid_idempotent_request` | already_consumed: key used earlier by this webhook-id / slot | acknowledged → continue (200 if all slots OK); nothing re-sent; no other key |
| 409 `concurrent_idempotent_requests` | bounded retries: same key, byte-identical body; delays 250 / 500 ms; a retry starts only if `elapsed + delay + 700 ms ≤ 4000 ms` from hook start; each retry request is aborted at the 4000 ms deadline | resolved → sent / consumed; unresolved or aborted → **503** (retry-able) |
| 409, other or unparseable `name` | conflict_unknown | **500** "unrecognized idempotency conflict"; not "sent", not retried |
| non-409 error | provider_error | **500** "Failed to send email via Resend" (unchanged); logs status + name only |
| first request throws | — | unchanged (outer catch → 500) |

## 3. Provider / platform semantics relied on (verified 2026-09-28; not invented)
- **Resend idempotency docs:**
  - same key + same body → "the same response, without actually sending the email again";
  - `invalid_idempotent_request` = "already been used on a request that had a different payload";
  - `concurrent_idempotent_requests` = "in progress ... safe to retry this request later";
  - keys are kept 24 h.
- **Resend errors reference:** both are 409.
- **resend-node `src/interfaces.ts`:** `ErrorResponse = { message, statusCode, name }`; both names are in `RESEND_ERROR_CODE_KEY`.
- **Supabase Auth hooks docs:**
  - "HTTP Hooks should complete in 5 seconds";
  - "On a retry-able error, such as an error with a 429 or 503 status code, HTTP Hooks will attempt up to three retries with a back-off of two seconds";
  - retries reuse the same webhook-id.
- **Documented residual (not hidden):** the Resend docs do not say whether a key is kept when the ORIGINAL request was rejected. Case A follows the Owner-accepted stable-key policy — the key was consumed by an earlier attempt. If Resend kept keys of rejected originals, an acknowledged Case A could mask that rejection.

## 4. Please verify
1. The discriminator parsing (`providerErrorName`): only `name`, regex-bounded; malformed / empty / non-JSON → unknown → fail.
2. Case B never changes the key or the body (identical `rawBody`), and never exceeds the budget. See the real-clock tests: worst case < 1 s with an immediate provider; a hanging retry is aborted by 4000 ms after hook start.
3. Secure email change slot isolation:
   - a consumed `current` does not skip `new`;
   - an unresolved `current` stops before `new` (503 → redelivery handles both with their own keys);
   - `new` concurrent-then-resolved → exactly one email per slot.
4. Nothing else changed: the Option C market matrix, signature / replay, the email-change contract, reauthentication and notifications — all still green, unchanged files.
5. `503` for an unresolved concurrent conflict is the right retry-able signal (vs `429`).

## 5. Evidence (this folder, bound to `e4c81b9`)
- `01-identity.txt`
- `02-targeted-tests.txt` — hook suite 6 files / 272 tests + Product Truth 13 / 13 + baseline check.
- `03-full-suite.txt`
- `04-eslint.txt` — 0 errors.
- `05-build.txt`
- `06-negative-controls.txt` — mutations: Case A reverted to failure; Case B treated as "already sent"; unknown 409 treated as sent. Each is detected by failing tests; the bytes are restored.
- `07-deno-check.txt` — NOT RUN: TEST prerequisite.
- `SHA256SUMS.txt`

## 6. Requested verdict format
`CODEX 409 DELTA RE-REVIEW: PASS / FAIL`, blockers with file:line, "NEW BLOCKING FINDINGS: <n>".
