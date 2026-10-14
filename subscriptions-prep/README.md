# Subscriptions preparation — PREPARATION / NOT ACTIVATED / NOT WIRED (prep schema v3, 2026-10-07 closure round)

Nothing in this folder is connected to the product, applied to any shared database, deployed, or imported by `src/`,
`supabase/` or `api/`. The existing product output channels are not connected to the orchestrator.

**Where it lives:**
- outside `BUILD_INPUT_ROOTS`, so the locked digest is unchanged;
- outside `supabase/migrations`;
- tests use the `*.prep-test.*` suffix, so the product `npm test` does not pick them up.

**Contract:**
- Reservation → immutable full-document snapshot → SQL finalization, the only commit point.
- The attempt binds three digests:
  - document (`quote-document/v1`);
  - issuer (`issuer/v1`);
  - presentation (`presentation/v1`: style, styleVersion, branding, ordered media manifest verified against owned objects).
- Outputs with attachments fail closed.
- **Success response:** every success path is checked by one parser (`parseFinal`). The three paths are reuse,
  a fresh finalize and reveal.
  - Required and cross-checked: ids, the requested quote, channel, booleans, a valid timestamp, and the canonical
    `issued-documents/<user>/<quote>/<attempt>.json` path.
  - The hash, bytes, schema and three digests are matched against the read-back snapshot or the stored snapshot header.
  - The 200 body is rebuilt from an explicit allowlist. Anything missing or wrong returns 503, with no cleanup or undo.
  - A same-key retry returns the durable result only after the same validation.
- **Logo:** an issuer with a non-empty `logo_url` fails closed with `logo_snapshot_policy_pending` (HTTP 409) before any
  reservation. `logo_url` is a mutable external URL, so logo bytes cannot be bound to an issued snapshot. This is a
  limitation, not a logo feature; future logo support needs a separate immutable logo artifact. It is NOT applied to the
  live product.
- One activation phase per component.
- Sources:
  - `docs/subscriptions-prep-2026-10-07/CLAUDE_NEXT_STEP_SPEC.md`
  - `docs/subscriptions-prep-2026-10-07/CLAUDE_PREP_CLOSURE_SPEC.md`

## Commands

| Purpose | Command |
|---|---|
| Prep tests | `npx vitest run --config subscriptions-prep/vitest.config.mjs` |
| TS typecheck | `node subscriptions-prep/typecheck-prep.cjs` |
| **Canonical DB gate** (all migrations under the pinned execution contract; canonical + prep tests) | `node scripts/db-test/run-db-tests.mjs --extra-migrations subscriptions-prep/sql --extra-tests-dir subscriptions-prep/db-tests` |
| Gate negative controls | `node subscriptions-prep/gate-controls/run-gate-controls.mjs --out-dir <dir>` |
| DB mutants (isolated, canonical runner) | `node subscriptions-prep/gate-controls/run-db-mutants.mjs --out-dir <dir>` |
| TS mutants (isolated) | `node subscriptions-prep/gate-controls/run-ts-mutants.mjs --out-dir <dir>` |

- **Superseded:** `subscriptions-prep/diagnostic/` is historical (see `SUPERSEDED.md` there).
- **Not a gate:** `--only` produces a FOCUSED run and `--contract` a CONTROL run; neither is ever a gate.
- **Activation:** needs a Codex re-review and a separate, explicit Owner authorization.
