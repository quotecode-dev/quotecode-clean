# TEKANGO Post-LIVE Wave 1 — Codex-ready review package (2026-09-27)

Audience: the independent Codex reviewer, plus the Owner for the decision block. Codex was NOT invoked in this Wave.

## 1. Baseline (fresh, read-only, 2026-09-27 ~08:20Z)
| Check | Result |
|---|---|
| `origin/main` | `e2090a407cf450b92335ad21791ca5fca6c78974` |
| `www.tekango.com/version.json`, `tekango.com/version.json` | `e2090a4…`, `dirty:false`, digest `f065a6f6…` (= accepted) |
| Vercel `www.tekango.com` | `dpl_ebjcu8wPvv1cTYfAdcp2YuANTWGx` READY; no newer Production deployment |
| Edge (Production `ixabnzhjeqevtbhdfswv`) | `get-public-quote` v15, `send-quote-email` v30, `chat-ai` v17; no function updated after 2026-09-26 |
| Migration ledger | NOT re-read (Management API token not locally readable; see §4) — no migration tool was run by anyone in this Wave |
| **Drift** | **NONE observed** |

Work branch: `tekango-post-live-wave1-2026-09-27` (worktree `C:\tkpl-wave1`), based on LIVE `e2090a4`. Not pushed.

## 2. Files changed (why each exists)
| File | Track | Why |
|---|---|---|
| `src/components/QuoteForm.jsx` | C1/C2/C6 | HE client-name placeholder was English (`e.g. Acme Corp`) → Hebrew example in HE; EN attention/project placeholders were Israeli (`Simon Levy`, `Holon Project`) → `John Smith`, `Downtown Office Renovation`; icon-only attachment remove button gets `aria-label` (`הסרת הקובץ <name>` / `Remove attachment <name>`). No visual change. |
| `src/components/AddItemWizard.jsx` | C3 | Review step showed raw `cm`/`m²`/`m` in Hebrew. Now reuses the wizard's existing `t.calcPreviewArea/Linear` and one display-only `measureUnitWord`. EN output byte-identical; stored item (meters, `pricing_unit`, quantities) unchanged; quote math unchanged. |
| `src/utils/draftAttachments.js` | C5 | `isBlobReadable` probe at restore: a restored blob that cannot be read is reported as missing (existing "please select again" notice) instead of surfacing later as a failed save. Defense-in-depth — see §5. |
| `src/pages/Dashboard.jsx` | C5 | Upload-stage save failure message now also says: if it keeps failing, remove the file and attach it again. Fail-closed save unchanged. |
| `supabase/functions/auth-send-email-hook/emailContent.ts` (new) | A | Pure content module extracted from the hook (subject/HTML/text/sender, HE/EN by `signup_market === 'Local'`, fail-closed EN). Only behavior delta: the recipient address and CTA URL are HTML-escaped. |
| `supabase/functions/auth-send-email-hook/index.ts` | A | Imports the module; handler logic unchanged. NOT deployed anywhere. |
| `src/data/productTruthInteractiveBaseline.json` | A | The hook's pre-existing unmarked email CTA (`<a href>`, gap 1) moved from `index.ts` to `emailContent.ts`; the gap is carried over unchanged, not widened. |
| Tests: `QuoteForm.test.jsx`, `AddItemWizard.test.jsx`, `draftAttachments.test.js`, `auth-send-email-hook/emailContent.test.js` (new) | F | See §3. |

## 3. Tests
- Focused: QuoteForm (+3), AddItemWizard (+2 HE review units: area + length, stored item asserted), draftAttachments (+2), auth hook content (12: every action type × HE/EN, TEKANGO present, no ProFlow / quotecode / TEST ref / localhost / 127.0.0.1 / LAN / :5186, HE = rtl/he, EN has zero Hebrew, sender per market, verify URL on the Auth API base, email escaping, no duplicated template in `index.ts`).
- Full suite: **153 files / 4122 tests passing** (first run surfaced 3 Product Truth interactive-baseline failures from the moved CTA → baseline entry carried over, re-run 25/25, then full green). ESLint: **0 errors**, 3 pre-existing warnings (PublicTools, PublicToolsEn, Dashboard:734). `vite build --mode production` (scratch outDir): OK.

## 4. Focused browser matrix (local dev server `--mode localtest` on 127.0.0.1:5195 → TEST backend; synthetic TEST personas LOCAL_PRO / INTL_PRO; no save, no TEST DB write; drafts discarded and session cleared after)
| Cell | HE / RTL / ILS | EN / LTR / USD |
|---|---|---|
| Quote form placeholders — desktop | PASS (`לדוגמה: כהן בנייה בע"מ`, `שמעון לוי`, `פרויקט חולון`; no `e.g.`) | PASS (`Acme Corp`, `John Smith`, `Downtown Office Renovation`; no Hebrew, no Holon/Simon) |
| Quote form placeholders — 390px | PASS (scrollWidth 390) | PASS (scrollWidth 390) |
| Attachment remove accessible name (AX tree) | PASS `הסרת הקובץ wave1-qa-plan.pdf` | PASS `Remove attachment wave1-qa-plan-en.pdf`; click removes the file |
| Attachment remove visual | PASS (390px screenshot, unchanged) | NOT CAPTURED (desktop DOM only) |
| Item wizard Review units — 390px | PASS `80 × 100 ס"מ = 0.80 מ"ר`, total `2.00 מ"ר`, preview `2 מידות · 2.00 מ"ר`, ₪, no raw cm/m² | PASS unchanged `cm`/`m²`, `$`, no Hebrew/₪ |
| Item wizard Review units — desktop | PASS | PASS |
| Draft restore after the source file was deleted on disk | file restored readable (Chrome copies the blob into IndexedDB) — the First-LIVE failure was NOT reproduced; client field restored; no false "missing" | NOT RUN |
| Trial identity display | NOT CHANGED (Owner decision OD-4); unit tests unchanged | NOT CHANGED |
| Auth email content | static/unit only (hook not deployed) | static/unit only |
| Quote email status | NOT CHANGED (canonical, §6) | NOT CHANGED |

Screenshots (session scratchpad, non-durable; sha256): `qa-he-390-attachment.png` 5d8e14be…, `qa-he-390-client.png` d2add59b…, `qa-he-390-wizard-review.png` 1753943e…, `qa-he-desktop-wizard-review.png` c979f45e…, `qa-en-390-wizard-review.png` b7cc18eb…. Read-only probe script `wave1-readonly-probe.mjs` 7195f083… (GET-only; found no locally readable Management API token, so it made no request).

## 5. Track conclusions
- **A (Auth/Resend).** Production still uses the built-in mailer (hosted templates, observed ProFlow-branded in First-LIVE). The repo already carries a TEST-proven Send Email Hook (`auth-send-email-hook`, enabled on TEST since 2026-09-16; absent on Production; `SEND_EMAIL_HOOK_SECRET` absent on Production). It is the only mechanism that gives HE/EN + per-market sender without duplicating Auth's token logic. Proposed content is proven TEKANGO-only / market-separated by `emailContent.test.js`. Hosted Auth config (templates, SMTP sender, redirect list) was NOT freshly readable (token in OS keyring); last evidence: Site URL `https://www.tekango.com`, redirects honored (Preflight 2026-09-25). **Resend warning:** inherent to the current design — every Auth link (built-in or hook) points at `https://ixabnzhjeqevtbhdfswv.supabase.co/auth/v1/verify` while mail is sent from `tekango.com`. Only a custom Auth domain or `token_hash` links to `www.tekango.com` + a frontend `verifyOtp` route change the link host (OD-2). Additional finding: Production signup `emailRedirectTo` is `https://www.tekango.com/dashboard` without `?lang=` (recovery carries it) — deferred, needs redirect allow-list verification first.
- **B (Cron).** Runtime proof: Vercel cron called `/api/cron` at 2026-09-27T08:02Z → **401** (fail-closed; this happens daily). Vercel Production env still has only `GOOGLE_INDEXING_CREDENTIALS`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Supabase Edge `CRON_SECRET` present (digest `1f14d18a…`, set 2026-08-23; value not recoverable). No local approved source holds `CRON_SECRET` or the service-role key. `SUPABASE_URL` is optional (`api/cron.js` falls back to `VITE_SUPABASE_URL`). Residual: `api/cron.js` ignores errors of the quote-flag update and the rates upsert (would log success falsely) — fix before or with enabling.
- **C (UX).** C1, C2, C3, C6 closed and browser-verified. C4 → OD-4. C5 PARTIAL: UX guidance improved + restore probe; the original First-LIVE failure was not reproduced (root cause unknown).
- **D (quote email status).** Canonical: Product Truth `quote_status` (LIVE_CURRENT) = "a manual label"; `send-quote-email` and `executeEmailSend` never write `status`; public signing accepts `draft` and `sent`. Current behavior is the product truth; the First-LIVE matrix expectation was a spec mismatch. No change.
- **E (housekeeping).** See the checkpoint block (KEEP / SAFE / OWNER). No deletion performed. `quotecode-quote-code.vercel.app` is already back on LIVE (resolved by the promotion).

## 6. Production mutations NOT performed
No deploy (frontend or Edge), no Vercel env/alias/deployment change, no Supabase secret/Auth config/hook change, no migration, no DB access, no push, no Resend change, no compensation. Real customer data used: NO.

## 7. Deferred Post-LIVE residuals
Quote-row first-item preview order; EN phone placeholder `502345678` (Israeli format in EN form, not a recorded finding); signup `emailRedirectTo` without `?lang=`; `api/cron.js` unchecked write errors; executor TLS `verify-full`; Supabase logs endpoint "Backend error"; tooling evidence not committed in `C:\tkrtool-iron`; C5 root cause.

## 8. Independent Codex review of `cfdaf9e` — FAIL (history, preserved) and blocker remediation (2026-09-27)

### 8.1 Codex result (as relayed by the Owner; not rewritten)
- **CODEX POST-LIVE WAVE 1 REVIEW: FAIL.** Candidate identity PASS; worktree clean YES; review package candidate-bound YES. Independent reproduction: 153/153 test files, 4122/4122 tests, ESLint 0 errors / 3 warnings.
- **Five BLOCKING findings:** (1) the Auth Send Email Hook modelled non-contract action names (`email_change_current` / `email_change_new`), selected the wrong hash and always mailed `user.email` (ignored `user.new_email`); (2) hook verification did not enforce timestamp age, ignored the signature version and compared with ordinary string equality; (3) trial reminders were selected before being claimed, sent before any durable claim, and the state-write result was ignored → duplicate emails under overlapping cron runs; (4) `api/cron.js` set `quotes.expiration_reminder_sent = true` with no quote-reminder delivery at all; (5) the trial-reminder path treated every `country` other than exact `International` as Local (the schema default is `Unknown`).
- **Non-blocking (preserved, not re-scoped):** the Auth link domain is the Supabase technical verify host (Owner decision OD-2; unchanged — links are still built on `SUPABASE_URL`, not made worse); the draft-restore synthetic mitigation passed but the real-browser incident was not reproduced (C5 PARTIAL stands, untouched); earlier browser screenshots were not durable (not reconstructed; this remediation changes no UI, so it produced no browser evidence).
- `cfdaf9e` remains the reviewed predecessor that FAILED Codex. It is not amended or rewritten; the remediation is a new commit on top of it.

### 8.2 Blocker 1 — Auth email-change contract (CLOSED locally)
**Contract verified before coding (2026-09-27):**
- Supabase docs, *Send Email Hook* (`supabase.com/docs/guides/auth/auth-hooks/send-email-hook` and its source `apps/docs/content/guides/auth/auth-hooks/send-email-hook.mdx`): `email_action_type` ∈ {`signup`, `invite`, `magiclink`, `recovery`, `email_change`, `email`, `reauthentication`, `password_changed_notification`, `email_changed_notification`, `phone_changed_notification`, `identity_linked_notification`, `identity_unlinked_notification`, `mfa_factor_enrolled_notification`, `mfa_factor_unenrolled_notification`}. For `email_change`: "The token hash field names are reversed due to backward compatibility" — `token_hash_new` → CURRENT address (`user.email`) with `token`; `token_hash` → NEW address (`user.new_email`) with `token_new`. Secure Email Change enabled → two emails; disabled → one email, to the new address. Success = empty 200; error shape `{ error: { http_code, message } }`.
- `supabase/auth` source (master, read 2026-09-27): `internal/api/mail.go` `sendEmailChange` + the hook `EmailData` builder (`TokenHash = EmailChangeTokenNew` always; `TokenNew` / `TokenHashNew = EmailChangeTokenCurrent` only when `SecureEmailChangeEnabled && u.GetEmail() != ""`; otherwise `Token = otpNew`); `internal/mailer/mailer.go` constants (`email_change_current` / `email_change_new` exist only as the built-in mailer's internal link names, NOT hook action types); `internal/mailer/templatemailer/templatemailer.go` (`/verify?token=<hash>&type=email_change` for both addresses; `email_changed_notification` goes to the OLD address, other notifications to `user.email`; `reauthentication` = code only); `internal/models/user.go` (`EmailChange` serialized as `new_email`).

**Fix:** `emailPlan.ts` (new) maps a payload to messages exactly per the contract: link actions → one email to `user.email`, `type=<action>`; `email_change` → if `token_hash_new` is present, the current address gets `token_hash_new` and the new address gets `token_hash` (two messages, `type=email_change`); otherwise one email to `user.new_email` with `token_hash`; never falls back to `user.email`; missing `new_email` / hash → refused (non-2xx, nothing sent). `reauthentication` → code-only email (no link). The 7 notification actions → information-only emails (no link, no CTA; `email_changed_notification` → `old_email`). `email` (listed, but its message semantics are not documented for the hook) and unknown types → refused, nothing sent (the old generic "Continue" CTA is gone). `emailContent.ts` is keyed by message kind; `handler.ts` (new) is the runtime-independent request handler; `index.ts` only wires Deno.

**Tests:** `handler.test.js` (new; realistic signed payloads with every `email_data` field serialized as the Go struct does): the exact documented action set; each link action; the secure two-message flow (recipient ↔ hash mapping, distinct idempotency keys); the non-secure single message to the new address only; a phone-only user; missing `new_email` / current address / hash refused; partial failure of the two-message flow; reauthentication code without a link; all 7 notifications without links and with the correct recipient; `email`, `email_change_current`, `email_change_new`, unknown and empty → refused; market separation. `emailContent.test.js` was rewritten per message kind (the tests that encoded the invented action names were replaced).

### 8.3 Blocker 2 — Auth-hook replay resistance (CLOSED locally)
**Contract verified:** Standard Webhooks spec (`standard-webhooks/spec/standard-webhooks.md`): signed content `id.timestamp.body`; space-delimited `version,signature` list, symmetric = `v1`; verify the timestamp within a tolerance; constant-time comparison; use `webhook-id` as an idempotency key. Reference verifier (`libraries/javascript/src/index.ts`): tolerance 5 minutes in both directions, `v1` only, `timingSafeEqual`.

**Fix:** `webhookVerify.ts` (new; Web Crypto only). The documented `esm.sh/standardwebhooks` import is not used, so the verifier is unit-testable and does not depend on a remote module at deploy time; behavior is equivalent to the reference verifier and stricter on parsing: headers required; `webhook-id` printable ASCII ≤ 200 chars; timestamp digits only (no `parseInt` leniency), rejected if older than 300 s or more than 300 s in the future; secret must be `v1,whsec_<base64>` or `whsec_<base64>` (anything else = configuration error, 500); only `v1` entries are considered; byte-wise constant-time comparison over every entry.

**Duplicate delivery / webhook-id dedup:** no in-memory "seen ids" set (it would not survive isolates). Each Resend request carries `Idempotency-Key: auth-hook/<webhook-id>/<slot>`; Resend keeps keys for 24 h (longer than the 5-minute acceptance window) and returns the original response for the same key and payload, so a replay or redelivery of a verified hook call inside the window cannot produce a second email. Residual, stated precisely: (a) this dedup is provider-side, not a TEKANGO table; (b) whether Supabase Auth itself ever redelivers a hook call, and whether it reuses the id, is NOT verified from Supabase documentation (the Standard Webhooks spec recommends the id as the idempotency key); (c) a durable TEKANGO-side dedup would need a new table written on the Auth critical path — not added.

**Tests:** `webhookVerify.test.js` (new): the published Standard Webhooks / Svix example vector; valid v1; a rotation list; tolerance edges (±300 s accepted, 301 s rejected); a captured request replayed 6 minutes later rejected; a re-timestamped old signature rejected; missing / empty / malformed id and timestamp (junk suffix, negative, decimal, 13-digit ms); v2 / v1a / unversioned / truncated / tampered body / other secret / other id / garbage; secret formats; the constant-time helper; a source guard (no `===` signature comparison, no `parseInt`). Handler level (`handler.test.js`): invalid signature, stale and future timestamps, missing headers → 401 and nothing sent; the same webhook-id inside the window → identical Idempotency-Key and body; missing / malformed secret → 500.

### 8.4 Blocker 3 — Trial-reminder concurrency / idempotency (CLOSED locally; migration NOT applied anywhere)
**Mechanism:** migration `supabase/migrations/20260927000000_trial_reminder_delivery_claims.sql` (additive, re-runnable): table `public.trial_reminder_deliveries` (PK `(user_id, stage)`, FK `auth.users` ON DELETE CASCADE, RLS on, no anon / authenticated privileges) + `public.claim_trial_reminder(user, stage) → jsonb | NULL` (one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE`) + `public.complete_trial_reminder(user, stage, claim_id, outcome, message_id, error) → boolean`; EXECUTE for `service_role` only. `reminderRun.ts` (new, pure) orchestrates: exact market → claim → idempotency-keyed send → verified completion. `index.ts` wires supabase-js RPC + Resend.

| Situation | Behavior |
|---|---|
| Duplicate / overlapping invocation | Only the claim winner sends; every other caller gets NULL and never reaches the transport. A stage already flagged sent is never claimed. |
| Claim failure (RPC error / unexpected shape) | No send; counted `claimErrors`, reported. |
| Send rejected by the provider (4xx except 409) | Ledger `failed`, no flag; the next run may re-claim with a NEW key (nothing was sent). |
| Send outcome ambiguous (5xx, 409, timeout, network) | Ledger `unknown`; re-claimed only while the SAME key is inside Resend's 24 h retention (23 h window) → the provider dedups, no second email. After the window: NOT re-sent automatically (visible for review). |
| Post-send persistence failure | Completion raises / RPC error → the ledger update is rolled back and the claim stays open; counted `sentUnrecorded` (never `sent3d` / `sent24h`); after the 10-minute lease it is re-claimed with the SAME key. |
| Stale worker completes late | Refused (`claim_id` mismatch) → `false`, reported. |
| `sent` completion | Ledger `sent` + `business_settings.trial_reminder_<stage>_sent = true` in one transaction; the account-row update count is verified (≠ 1 → raise → rollback). |

**Proof:** disposable Postgres 17 (`scripts/db-test`, local container, `--rm`): `040_trial_reminder_claims.sql` (single-session semantics, privileges, cascade, rollback on persistence failure) and `041_trial_reminder_concurrency.mjs` (A: 80 real psql sessions blocked on an advisory-lock barrier and released at once — exactly one claim per (account, stage); B: 6 overlapping runs of the real `reminderRun.ts` over the real SQL functions — each eligible account delivered exactly once, no email and no ledger row for `Unknown`, NULL, `LCL`, `local`; a later duplicate run sends nothing). **Negative control:** the same 041 run against a naive check-then-act claim function reports 13 FAIL (up to 8 of 8 sessions win; 24 deliveries for 10 accounts), so the test detects the original bug class. The harness gained `tests/*.mjs` support for multi-session tests. Vitest: `reminderRun.test.js` (new) mirrors the ledger for deterministic failure / retry / overlap cases. No shared TEST or Production database was touched.

### 8.5 Blocker 4 — Quote reminder false-sent (CLOSED locally)
**Scope decision:** no quote-reminder delivery exists in the product; the only canonical mention is a backlog line (`PROFLOW_TODO.md`: "Quote expiration / validity date + reminders / extension"), which is not Wave 1 scope and defines no recipient, content or market. Smallest correct behavior: the quote step is REMOVED from `api/cron.js` (no quotes read, no `expiration_reminder_sent` write). Implementing quote reminders is a separate Owner product decision.

**Also:** the exchange-rates upsert result is now checked; trial-reminder hard errors (claim / completion errors, unrecorded sends, failed / unknown sends) and subscription errors make the run report `success: false` with HTTP 500 instead of "executed successfully" (a deliberate behavior change required by "verify all database update results"; the Production cron currently returns 401 anyway — OD-3). Market-unresolved skips are logged, not failures.

**Tests:** `api/cron.test.js` (new): a full run never touches `quotes` (runtime fake + source guard); an upsert error, a rates outage, a trial function error and every hard-error counter → failure; market skips → not a failure; no `CRON_SECRET` → reminders skipped; an unauthorized request is rejected. Existing quote-level protections are unchanged (`guard_quote_immutability` still forbids resetting the flag).

### 8.6 Blocker 5 — Exact market, fail closed (CLOSED locally)
`eligibility.ts` `resolveReminderMarket`: exact `'Local'` → Local (Hebrew, RTL, `he-IL` date, HE CTA, `support@tekango.com`); exact `'International'` → International (English, LTR, `en-US`, `?lang=en`, `info@tekango.com`); anything else — NULL, `Unknown` (the schema default), `LCL`, `local`, whitespace variants, `IL`, `Israel`, non-strings — → **not sent**: no claim, no email, no flag; counted `skippedMarketUnresolved` and re-evaluated on the next run. The content moved unchanged in wording to `reminderContent.ts` and is keyed only by that market (the `isHebrew` guess at the call sites is gone). No user text / language heuristic is used. The reminder emails carry no currency.
- **Disclosed decision:** `LCL` is a documented legacy alias of Local in the UI / quote-validity code. This send path accepts exact canonical values only, so an `LCL` account is skipped and reported, never mis-routed. Accepting `LCL` here would be a one-line, Owner-approved change.
- **Auth hook market (unchanged, accepted in `cfdaf9e`):** an Auth email cannot be withheld, so a non-`Local` `signup_market` fails closed to English / `info@` (International) — never to Local. Tests cover `Unknown`, `LCL`, `local`, ` Local`, missing and null.

**Tests:** `reminderRun.test.js` (Local, International and 10 non-canonical values incl. null / Unknown / malformed / legacy) + the DB end-to-end run (above) + `handler.test.js` / `emailContent.test.js` for the hook.

### 8.7 Governance guards carried over (not widened)
- `src/data/productTruthInteractiveBaseline.json` regenerated with `scripts/generate-product-truth-interactive-baseline.js`: the trial reminder's pre-existing unmarked `<a href>` CTA (gap 1) moved from `send-trial-expiration-email/index.ts` to `reminderContent.ts`; every new module has gap 0; `auth-send-email-hook/emailContent.ts` unchanged at 1.
- `src/utils/shortDate.test.js` IRON-DATE-001: the long-form exception moved with the same `toLocaleDateString(…, { month: 'long' })` line from the trial `index.ts` to `reminderContent.ts`.

### 8.8 Changed files (remediation commit vs `cfdaf9e`)
| File | Blocker |
|---|---|
| `supabase/functions/auth-send-email-hook/emailPlan.ts` (new) | 1 |
| `supabase/functions/auth-send-email-hook/handler.ts` (new) | 1, 2 |
| `supabase/functions/auth-send-email-hook/webhookVerify.ts` (new) | 2 |
| `supabase/functions/auth-send-email-hook/emailContent.ts` | 1 |
| `supabase/functions/auth-send-email-hook/index.ts` | 1, 2 (Deno wiring only) |
| `supabase/functions/auth-send-email-hook/handler.test.js` (new), `webhookVerify.test.js` (new), `emailContent.test.js` | 1, 2 |
| `supabase/migrations/20260927000000_trial_reminder_delivery_claims.sql` (new) | 3 |
| `supabase/functions/send-trial-expiration-email/reminderRun.ts` (new), `reminderContent.ts` (new), `eligibility.ts`, `index.ts` | 3, 5 |
| `supabase/functions/send-trial-expiration-email/reminderRun.test.js` (new) | 3, 5 |
| `scripts/db-test/run-db-tests.mjs`, `scripts/db-test/tests/040_trial_reminder_claims.sql` (new), `scripts/db-test/tests/041_trial_reminder_concurrency.mjs` (new) | 3 (disposable DB proof) |
| `api/cron.js`, `api/cron.test.js` (new) | 4 |
| `src/data/productTruthInteractiveBaseline.json`, `src/utils/shortDate.test.js` | guard carry-over (§8.7) |
| `evidence/post-live-wave1-2026-09-27/POST_LIVE_WAVE1_REVIEW_PACKAGE.md` | this section |

### 8.9 Verification bound to the remediation commit
Recorded by the evidence-reconciliation commit that follows the remediation commit (clean worktree, `HEAD` = the remediation commit): §8.11 and `codex-blocker-remediation/`.

### 8.10 Limitations / NOT RUN (explicit)
- **NOT RUN — shared environments:** no TEST or Production deploy, no hook enablement, no migration applied outside the disposable container, no Supabase Auth config change, no secret use, no push. Shared TEST mutation: NOT PERFORMED.
- **NOT RUN — real delivery:** no real Resend call (the Idempotency-Key behavior is taken from Resend's documentation, not exercised live); no real Supabase Auth → hook call (handler-level tests with realistic signed payloads only). Real-user terminal proof of the hook and of trial reminders requires an Owner-authorized TEST activation (OD-1 / OD-3) and is NOT claimed.
- **Deno type-check:** the 7 pure modules pass `deno check` (Deno 2.1.4 in Docker). The two `index.ts` files pass `deno check` only in a scratch copy where the two remote imports (`deno.land/std` serve, `esm.sh/@supabase/supabase-js`) were replaced by local stubs — the real remote imports could not be fetched on this host (TLS `UnknownIssuer`).
- **Deploy order constraint:** `send-trial-expiration-email` depends on migration `20260927000000`; deploying the function first would make every claim fail (fail-closed: nothing sent).
- **Ambiguous sends past the 23 h key window** stay `unknown` / `claimed` and are never re-sent automatically; there is no alerting beyond the cron logs.
- **Browser:** not applicable (no UI change in this remediation); no browser evidence produced.
- **Minor handler changes:** the hook now answers non-POST requests (incl. OPTIONS) with 405 — Auth never sends a preflight — and uses the documented error shape.

### 8.11 Verification bound to remediation commit `89f38414bd9a2e9a5f3837061f47db4759b223df` (evidence-reconciliation commit)
Identity: remediation commit `89f38414bd9a2e9a5f3837061f47db4759b223df` (tree `dd563dcc0a6e9caee1d553dd68ac10f4d5dd2882`), parent = reviewed predecessor `cfdaf9efdd15398cdaf8756b353a24ad5ee6d0ef`, base = LIVE `e2090a407cf450b92335ad21791ca5fca6c78974`, branch `tekango-post-live-wave1-2026-09-27`, worktree `C:\tkpl-wave1`. Every run below started and ended with 0 `git status` lines at `HEAD` = `89f3841`. The only later file is this commit's own evidence (the negative-control script ran from the untracked evidence folder). The reconciliation commit that adds this section changes only `evidence/post-live-wave1-2026-09-27/**`; verify with `git diff --stat 89f3841 HEAD`.

| Check | Command | Result | Artifact |
|---|---|---|---|
| Identity + changed files | `git rev-parse` / `git diff --name-status cfdaf9e 89f3841` | 22 files (12 new) | `codex-blocker-remediation/01-identity.txt` |
| Targeted blocker tests | `npx vitest run api/cron.test.js supabase/functions/auth-send-email-hook supabase/functions/send-trial-expiration-email src/utils/shortDate.test.js src/data/productTruthInteractiveCompleteness.test.js` | **8 files / 197 tests PASS** | `02-targeted-tests.txt` |
| Full suite | `npx vitest run` | **157 files / 4266 tests PASS** (was 153 / 4122 at `cfdaf9e`) | `03-full-suite.txt` |
| Lint | `npx eslint .` | **0 errors**, 3 warnings (the same pre-existing PublicTools / PublicToolsEn / Dashboard:734) | `04-eslint.txt` |
| Build | `npx vite build --mode production` (scratch outDir) | **OK** | `05-build.txt` |
| Disposable DB gate | `node scripts/db-test/run-db-tests.mjs` (postgres:17, `--rm`) | **PASS** — 21 migrations (new `20260927000000` applied AND re-run OK), 6/6 test files: 000 (3), 010 (26), 020 (18), 030 (30), **040 (40)**, **041 (24)**; the only re-run note is the legacy, informational `20260827000000` | `06-disposable-db-gate.txt/.json` |
| Negative control (blocker 3) | `node evidence/…/codex-blocker-remediation/negative-control-naive-claim.mjs` | real implementation 041 PASS; naive check-then-act claim → **13 FAIL / 24** (5–8 of 8 sessions win per target; 20 deliveries for 10 accounts) → **DETECTED** | `07-negative-control.txt` |
| Deno type-check | `deno check` (Deno 2.1.4, Docker) | 7 pure modules exit 0; both `index.ts` (from `git show HEAD`, remote imports stubbed) exit 0 | `08-deno-check.txt` |

SHA-256 of every artifact: `codex-blocker-remediation/SHA256SUMS.txt`.

**Blocker closure (local):** 1 CLOSED · 2 CLOSED · 3 CLOSED · 4 CLOSED · 5 CLOSED — each by code + tests at `89f3841`; blocker 3 also by the disposable-DB proof and the negative control. **Not claimed:** any TEST / Production / browser / real-email terminal behavior (§8.10). Next step: independent Codex re-review of this branch head. Production remains NOT authorized; push NOT performed.
