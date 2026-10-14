# SUPERSEDED: diagnostic runner (historical)

The files in this folder (`run-diagnostic.mjs`, `make-diag-fidelity.cjs`, `diag-pre-20260930-acl-seed.sql`) were the
non-canonical workaround of the fix round.

They are superseded by the canonical runner's explicit execution contract:

- `scripts/db-test/migration-contract.json`
- `scripts/db-test/fixtures/supabase-platform-pre-20260930.sql`
- immediate replay on each migration's own post-state

They are also superseded by the controls and mutants in `subscriptions-prep/gate-controls/`.

The files are kept only as history of the fix-round evidence (`C:\tekango-evidence\subscriptions-prep-fix-20261007T103354\`).
They are not a gate and are not to be used for new evidence.
