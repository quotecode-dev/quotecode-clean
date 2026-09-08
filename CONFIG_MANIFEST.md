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

**Orphan functions, no source in this repo**: `clever-processor` and
`send-welcome-email` are live on Production and require `RESEND_API_KEY`,
but their full requirements cannot be enumerated here since their source
was only recently recovered (`supabase/functions/clever-processor/index.ts`,
`supabase/functions/send-welcome-email/index.ts`) and their trigger wiring
is still unconfirmed — see those files' own header comments.

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
  `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`. Until an
  Owner provides these values, `chat-ai`, `resend-email-webhook`, and both
  expiration-email functions will fail if actually invoked against TEST,
  independent of any code/version drift. This is a standing, named gate —
  see `scripts/check-test-live-parity.js`'s `missing-configuration`
  classification for the live, always-current version of this check.

## Canonical domain / brand

Centralized for the **frontend bundle only** in `src/shared/brand.js`
(`CANONICAL_DOMAIN`, `CANONICAL_ORIGIN`, `SUPPORT_EMAIL_HE/EN`). Vercel Edge
Middleware has its own separate, already-correct constant
(`middleware.ts`'s `CANONICAL_ORIGIN`). Every Supabase Edge Function must
still define its own copy, since each is bundled and deployed independently
with no shared import path across them — `scripts/retired-domain-guard.test.js`
is the permanent mechanism that catches drift there instead.
