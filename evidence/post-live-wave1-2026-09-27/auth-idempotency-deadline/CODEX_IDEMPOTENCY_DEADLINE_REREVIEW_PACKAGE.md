# Codex re-review package — Auth hook idempotency identity (blocker A) + one invocation deadline (blocker B)

**Audience:** the independent Codex reviewer.
**Status:** Builder fix done locally. **Codex re-review: NOT RUN** (required). TEST re-proof: NOT RUN. Production untouched. Not pushed.

## 1. Identity
- **Code commit under review:** `9bef6652671a1c182e3a2797f3e97ab0aa06d286`.
  - Parent `1e4bd0b9f9161985807b6637ecd832ceb381a79f` = the candidate that FAILED your Auth 409 delta re-review (blockers A + B). It is preserved.
- **New candidate:** the evidence-only commit on top of `9bef665`. SHA in the continuity.
- **Review scope:** `git diff 1e4bd0b 9bef665` — 4 files: `auth-send-email-hook/{handler.ts, resendSend.ts, handler.test.js, resendSend.test.js}`.
- **Unchanged vs `1e4bd0b`:** marketResolver, marketLookup, webhookVerify (+ test), emailPlan, emailContent, index.ts, all of `src/`, migrations, trial function, api, package / config.
- **Stages 1 / 2 / 4:** unchanged vs `8e5ac58` (`01-identity.txt`).

## 2. Verified contracts (`00-external-contracts.txt`: source line numbers + sha256 of the sources read)
- **supabase/auth `hookshttp.go`:**
  - `json.Marshal(input)` happens before the retry loop, so the body is identical on every attempt;
  - `msgID := uuid.Must(uuid.NewV4())` happens inside the loop, so there is a NEW webhook-id per attempt (your finding, confirmed);
  - one `context.WithTimeout(ctx, 5s)` spans all attempts;
  - 429 / 503 are retried only with `retry-after`, immediately; network errors are retried after 2 s.
- **`v0hooks.go`:** `SendEmailInput.metadata.uuid = uuid.NewV4()` is created once per logical event.
- **`mail.go`:** a fresh OTP + token hash for every legitimate token-bearing send.
- **Resend:** idempotency semantics, the 409 names, the `{ message, statusCode, name }` error body, keys kept 24 h.
- **Caveat:** these are master sources. The hosted Auth version must be re-confirmed in TEST; the hook logs `metadata.uuid present / absent`.

## 3. Design
- **Blocker A — logical-event key:** `tekango-auth/v1/<slot>/<b64url HMAC-SHA256(decoded hook secret, "tekango-auth-email-idempotency/v1\n<slot>\n<verified raw body>")>`.
  - Stable across Supabase retries (same body) and across changed-market redeliveries (market is not an input).
  - Distinct per legitimate event (metadata.uuid / token hash / user state) and per slot.
  - No PII or secret in the key; 1–256 characters; no webhook-id.
  - Invalid inputs → explicit error.
- **Blocker B — one deadline:** `INVOCATION_BUDGET_MS = 3500` from handler entry, which leaves at least 1.5 s under the Supabase 5 s limit for transit / cold start / response.
  - The market lookup gets `min(1500, remaining − 600 − 100)`.
  - Every provider request AND its error-body read are raced + aborted at the SAME deadline.
  - No request starts with less than 600 ms left.
  - Concurrent-conflict sleeps / retries are gated by the remaining budget.
  - Slots `current` → `new` share the deadline (no fresh budget).
- **No platform retry requested:** no 429 / 503 / Retry-After. A re-invocation would run inside the same 5 s context with little budget left, and duplicate prevention never depends on it.
- **Outcomes:** every non-completed outcome is an explicit 500 — `not_started`, `ambiguous` (request failed / aborted; the provider may have accepted it), `concurrent_unresolved`, `conflict_unknown`, provider error.
  - **Lifecycle consequence:** Auth reports failure. A user retry is a NEW logical event (new tokens → new key) — a legitimate new email with a new link; the older link is superseded by the new token.
- **409 by error `name`:** `invalid_idempotent_request` → already consumed (acknowledged); `concurrent_idempotent_requests` → bounded same-key / same-body retries; other → 500.
  - Documented residual: Resend is silent on keys of rejected originals.

## 4. Please verify
1. The body-digest identity really is stable across hosted Supabase retries and distinct across events. Is metadata-uuid absence acceptable? (The digest does not require it.)
2. Deadline accounting has no path that exceeds the invocation budget. Check the stalled body; the second slot; the lookup cap with jitter slack.
3. No hidden reliance on a platform retry.
4. Slot isolation under the shared deadline.
5. Option C / signature / replay / email-change contract untouched.

## 5. Evidence (bound to `9bef665`)
- `00-external-contracts.txt`
- `01-identity.txt`
- `02-targeted-tests.txt` — hook suite 6 files / 292 tests + Product Truth 13 / 13.
- `03-full-suite.txt` — 160 files / 4449 tests.
- `04-eslint.txt` — 0 errors.
- `05-build.txt`
- `06-negative-controls.txt`:
  - M1 webhook-id-only key → 24 FAIL;
  - M2 unbounded initial request → 8 FAIL;
  - M3 fresh per-slot deadline → 5 FAIL;
  - bytes restored after each.
- `07-deno-check.txt` — NOT RUN: TEST prerequisite.
- `SHA256SUMS.txt`

## 6. Requested verdict format
`CODEX AUTH IDEMPOTENCY/DEADLINE RE-REVIEW: PASS / FAIL`, blockers with file:line, "NEW BLOCKING FINDINGS: <n>".
