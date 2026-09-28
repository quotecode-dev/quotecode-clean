# Codex delta review package — Auth market identity gap F1, Option C

**Audience:** the independent Codex reviewer.
**Status:** implemented locally. **Codex review: NOT RUN** (required). TEST re-proof: NOT RUN (required, separate task). Production: untouched.

## 1. Identity
- **Worktree / branch:** `C:\tkpl-wave1`, branch `tekango-post-live-wave1-2026-09-27`. Not pushed.
- **Code commit under review:** `56bca555df73ce9a7c60d74a11e3c0618c22b419`.
  - Parent `8e5ac5871d502c401bb653066a5304bf15d76b75` = the previous candidate: Codex blocker re-review PASS (Owner / ChatGPT-supplied); preserved as history.
  - LIVE base `e2090a407cf450b92335ad21791ca5fca6c78974` is an ancestor.
- **The candidate** = the evidence-only commit on top of `56bca55` that adds this folder (see the continuity for its SHA).
- **Review scope:** `git diff 8e5ac58 56bca55`. Exactly 10 files: 9 under `supabase/functions/auth-send-email-hook/` + `src/data/productTruthInteractiveBaseline.json`, which gains +2 entries for the new files (interactive 0 / markers 0) and nothing else.
- **Untouched** (`01-identity.txt`): `supabase/migrations` (Stage 1 bytes `97d2017e…`), `send-trial-expiration-email` (Stage 2), `api`, app config, package files, `supabase/config.toml`, every other `src` file (Stage 4).

## 2. Design being implemented (Owner-approved)
`evidence/wave1-production-release-plan-2026-09-27/AUTH_MARKET_IDENTITY_DESIGN.md` (main repository).
- **Canonical first:**
  - `business_settings.country` by the verified `user.id`: `Local` / `LCL` → Local; `International` → International.
  - Any other row value → International, with the metadata NOT consulted.
- **Bootstrap:** `signup_market` (exact values) only when the lookup succeeded with **0 rows**.
- **Fail closed:** timeout (1500 ms), error, >1 row, invalid id, or not configured → International. The email is still sent.
- **No heuristic:** no language / IP / currency / domain input. No new secret, no migration, no backfill.

## 3. What to verify (review checklist)
1. **Trust boundary (`handler.ts`).** The lookup runs only after `verifyStandardWebhook` succeeds AND `planAuthEmails` returns a sendable plan. The id passed is `payload.user.id` from the verified body. Non-UUID ids never reach the database (`runMarketLookupWithTimeout`).
2. **Narrow service-role read (`marketLookup.ts`).**
   - `JSON.parse(SUPABASE_SECRET_KEYS).default` (the same pattern as LIVE send-quote-email / get-public-quote / trial reminders);
   - `from('business_settings').select('country').eq('user_id', id).limit(2).abortSignal(signal)`;
   - only `country` is returned;
   - thrown errors carry no key, id or database text.
3. **Resolver semantics (`marketResolver.ts`).** Precedence, the LCL alias (row only — never metadata), unresolved rows ignoring metadata, bootstrap only at 0 rows, every failure → International. Classifications are the only thing logged.
4. **Bounded time.** A hard deadline via `Promise.race` + `AbortController`. A never-settling lookup cannot hang the hook.
5. **Idempotency / redelivery (`handler.ts`).**
   - The Idempotency-Key is unchanged (`auth-hook/<webhook-id>/<slot>`).
   - A Resend 409 (`invalid_idempotent_request` / `concurrent_idempotent_requests`, per Resend's docs) → non-2xx. It is never retried under another key, and it is **not** treated as success: Resend does not document whether a failed original stores the key.
   - Result: a redelivery that resolves a different market cannot produce a second email.
   - Accepted residual: the Auth call is then reported as failed even when the first attempt's email went out; a user retry gets a new webhook-id.
6. **Unchanged guards.** `webhookVerify.ts`, `webhookVerify.test.js` and `emailPlan.ts` are unchanged vs `8e5ac58` (`git diff --quiet 8e5ac58 56bca55 -- …` → no diff). Signature, timestamp tolerance, v1-only and constant-time comparison are untouched; the replay tests are still green.
7. **Removed API.** `emailContent.ts` no longer exports `isHebrewMarket`. There are no other callers (grep).

## 4. Evidence (this folder, bound to `56bca55`)
- `01-identity.txt` — SHAs, the changed-file list, untouched-stage proof, migration bytes, hook deploy-input hashes (7 runtime `.ts`).
- `02-targeted-tests.txt` — hook suite **247 / 247** (5 files: handler incl. the Option C matrix, marketResolver, marketLookup, emailContent, webhookVerify) + Product Truth completeness 13 / 13 + baseline `--check` up to date.
- `03-full-suite.txt` — the full project suite.
- `04-eslint.txt` — 0 errors (3 pre-existing warnings, none in changed files).
- `05-build.txt` — `vite build` OK (outDir outside the worktree).
- `06-negative-control.txt` — mutation: the resolver forced to "no row" (= the old metadata-only behavior) → **42 handler tests FAIL**; bytes restored identically.
- `07-deno-check.txt` — **NOT RUN** (Docker not authorized; no tsc). An open item for the TEST task.
- `SHA256SUMS.txt`.

## 5. Test matrix covered (handler-level, through the real handler)
- **Flows:** signup · recovery · secure email change (2 messages) · reauthentication · `password_changed_notification`.
- **For each flow:**
  - DB Local / LCL / International with missing metadata;
  - DB Local vs md International (DB wins); DB International vs md Local (DB wins);
  - DB Unknown / NULL / `"local "` with md Local → EN (md ignored);
  - bootstrap: no row + md Local / International / missing / null / `local` / `LCL`.
- **Failures:** timeout, error, multiple rows, lookup not wired → EN, email sent. No secret / id / address / DB message in logs or the response.
- **Trust:** invalid signature / unsupported action → no lookup; a non-UUID id → no lookup, EN.
- **Idempotency:**
  - timeout → EN sent, then a redelivery resolving Local → 409, one accepted email, same key;
  - same resolution → dedup;
  - secure change with a changed market → no extra email;
  - concurrent 409 → failure.

## 6. Known limits (explicit)
- No static type check; `index.ts` is not executed in tests (`07-deno-check.txt`).
- Real Supabase payload / PostgREST behavior and the `SUPABASE_SECRET_KEYS` presence in the hook's runtime are proven only by the TEST re-proof, which has not been done yet.
- **Decisive TEST cell:** existing synthetic Local persona without `signup_market` → recovery in HE from `support@`, with the terminal link verified through the inbox (Owner access).
- Pre-existing, out of scope: trial reminders skip `LCL` (unchanged); `country` is owner-updatable via the column grant (hardening backlog).

## 7. Requested verdict format
`CODEX OPTION C DELTA REVIEW: PASS / FAIL`, blockers with file:line, and "NEW BLOCKING FINDINGS: <n>".
