# Required Configuration Manifest

Generated as part of the systemic remediation task (2026-09-09). This is the
single, discoverable, machine-checkable list of every configuration name
this application requires — names only, **never values**. Before this file,
no such consolidated manifest existed: `.env.example` was the closest
attempt and was missing `OPENAI_API_KEY`/`SUPABASE_SECRET_KEYS` entirely,
and `PROFLOW_HANDOFF.md`'s own config table was stale (referenced 7 Edge
Functions when there are 9).

Keep this file in sync by re-running `node scripts/check-test-live-parity.js`
after adding/removing any `Deno.env.get(...)` call in an Edge Function, or
any `import.meta.env.VITE_*` reference in the frontend.

## Frontend (`import.meta.env.VITE_*`)

| Variable | Purpose | Referenced in |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL the frontend connects to | `src/shared/supabase.js` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key | `src/shared/supabase.js` |
| `VITE_PROFLOW_ENV` | Fail-closed guard value (`'TEST'`) — throws before `createClient()` if `--mode localtest` is active but this doesn't say `TEST` | `src/shared/supabase.js` |

`.env` (default, points at **Production**) and `.env.localtest.local`
(gitignored, points at the isolated **TEST** project via `npm run
dev:localtest`) must both define all three. `.env.example` must be kept in
sync as the onboarding template — it previously omitted `VITE_PROFLOW_ENV`.

## Edge Functions (`Deno.env.get(...)`, per function)

| Function | Required secret names |
|---|---|
| `admin-cleanup-user-quotes` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEYS` |
| `admin-delete-user` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `billing-checkout-stub` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEYS` |
| `chat-ai` | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `get-public-quote` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEYS` |
| `resend-email-webhook` | `RESEND_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` |
| `send-quote-email` | `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_ANON_KEY` |
| `send-subscription-expiration-email` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SUPABASE_ANON_KEY`, `CRON_SECRET` |
| `send-trial-expiration-email` | `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `RESEND_API_KEY`, `SUPABASE_ANON_KEY`, `CRON_SECRET` |

**Known inconsistency, not yet resolved**: 6 of the above 9 functions read
the newer `SUPABASE_SECRET_KEYS` JSON blob (`['default']`); the other 3
(`admin-delete-user`, `chat-ai`, `send-subscription-expiration-email`) still
read the legacy flat `SUPABASE_SERVICE_ROLE_KEY`. Both secret names must
stay set on every project until this migration is finished project-wide —
do not remove either name from a project's secrets without checking every
function against the table above first.

**Orphan functions, source recovered, wiring CONFIRMED absent (Final Orphan
Wiring + TEST Secrets Closure task, 2026-09-09)**: `clever-processor` and
`send-welcome-email` (`supabase/functions/clever-processor/index.ts`,
`supabase/functions/send-welcome-email/index.ts`) are live on Production
(source now fully recovered into this repo) but have zero invocation path
on either Production or TEST — no code-level caller anywhere in this
repository, no Database Trigger/Event Trigger/Webhook referencing either
name (direct `pg_catalog`/`information_schema` query on both projects; the
`supabase_functions` webhooks schema does not exist on either), and no Auth
Hook configured on TEST (Owner-confirmed fresh Dashboard check; Production's
own Auth Hooks page was not independently re-checked this task — the one
narrow residual gap in an otherwise fully code+SQL-proven picture). Both
would need `RESEND_API_KEY` if ever wired and redeployed to TEST, but that
is not a current blocker for anything, since neither function is reachable
by any path today. See those files' own header comments and
`scripts/check-test-live-parity.js` (`CONFIRMED_UNWIRED_ORPHAN_FUNCTIONS`).

**Which missing-on-TEST secrets are genuinely blocking vs informational
only** (same task): `OPENAI_API_KEY` (blocks `chat-ai`, a real live AI Chat
feature) and `RESEND_API_KEY` (blocks `send-quote-email`, a real critical
customer journey, plus the Admin "send test email" feature) are genuine
blockers requiring an external-provider action. `CRON_SECRET` and
`RESEND_WEBHOOK_SECRET` are **not currently blocking for TEST** (though
each has a real, live, or plausible path on Production):
- `CRON_SECRET` gates the automated batch-send branch of
  `send-trial-expiration-email`/`send-subscription-expiration-email`. No
  database-level scheduler reaches it on either project (`pg_cron` is not
  installed on TEST or Production). **Production is genuinely wired to it**
  via a real Vercel Cron Job (`vercel.json`'s `crons` entry → `api/cron.js`,
  daily, `x-cron-secret` header) — whether that actually fires end-to-end
  also depends on Vercel's own `CRON_SECRET` environment variable (a
  Vercel-dashboard fact, not checked this task). `api/cron.js` reads its
  Supabase target from Vercel's own env and has no equivalent deployment
  pointed at TEST, so this stays not-blocking for TEST specifically. The
  real, testable Admin "send test email" path returns before this check is
  ever reached, needing `RESEND_API_KEY` only.
- `RESEND_WEBHOOK_SECRET` gates a passive receiver (`resend-email-webhook`)
  for Resend's own externally-configured outbound webhooks, which cannot
  receive real traffic on TEST without `RESEND_API_KEY` already being set
  (no emails sent means no bounce events) and a webhook subscription
  actually pointed at TEST's endpoint on Resend's own dashboard — neither
  exists today.

See `scripts/check-test-live-parity.js` (`SECRETS_NOT_CURRENTLY_BLOCKING`)
for the live, re-runnable version of this reasoning.

## Vercel

| Name | Purpose |
|---|---|
| `CRON_SECRET` | Also read by `api/cron.js` (Vercel Cron → `/api/cron`) to authorize the request |
| `SUPABASE_SERVICE_ROLE_KEY` / `VITE_SUPABASE_ANON_KEY` (fallback chain) | Used by `api/cron.js` |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` (fallback chain) | Used by `api/cron.js` |

**Known blind spot**: Vercel's own Preview-vs-Production environment-variable
scoping (which of the above are set for Preview deployments vs. Production)
is configured in the Vercel dashboard and is **not visible from this
repository at all**. No file in this repo captures it. Treat this as an
open question for any future Preview-deployment work, not a settled fact.

## Cross-project presence (names only, checked 2026-09-09)

Run `npx supabase secrets list --project-ref <ref>` for each project to
re-verify. As of this manifest's generation:

- **Production** (`ixabnzhjeqevtbhdfswv`): has all 11 names above.
- **TEST** (`ljfizgrdyzxddswcedwr`): is **missing** `CRON_SECRET`,
  `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Of these, only
  `OPENAI_API_KEY` (blocks `chat-ai`) and `RESEND_API_KEY` (blocks
  `send-quote-email` and the Admin "send test email" feature) are genuine
  blockers requiring an external-provider action — see "Which
  missing-on-TEST secrets are genuinely blocking" above for why
  `CRON_SECRET`/`RESEND_WEBHOOK_SECRET` currently are not. This is a
  standing, named gate — see `scripts/check-test-live-parity.js`'s
  `missing-configuration` (blocking) vs informational-only classification
  for the live, always-current version of this check.

## Canonical domain / brand

Centralized for the **frontend bundle only** in `src/shared/brand.js`
(`CANONICAL_DOMAIN`, `CANONICAL_ORIGIN`, `SUPPORT_EMAIL_HE/EN`). Vercel Edge
Middleware has its own separate, already-correct constant
(`middleware.ts`'s `CANONICAL_ORIGIN`). Every Supabase Edge Function must
still define its own copy, since each is bundled and deployed independently
with no shared import path across them — `scripts/retired-domain-guard.test.js`
is the permanent mechanism that catches drift there instead.
