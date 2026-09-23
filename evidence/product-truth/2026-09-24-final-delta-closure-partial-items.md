# FINAL DELTA CLOSURE — Partial-Item Evidence (Plan/Role Server Facts, Credential Incident, Canonical 5186)

Final implementation SHA this round: `08c012bcd6094335e987e7972c66604c2579e125`. TEST chat-ai
remains at version 31 (pre-delta) - see `2026-09-24-final-delta-closure-deployment-attestation.md`
for why (Finding 6: PARTIAL, deploy denied by the harness's own permission classifier).

## PLAN/ROLE SERVER FACTS — 7 of 8 real personas independently verified; 1 disclosed gap

Method: `scripts/verify-plan-role-server-facts.mjs` (committed) signs in as each persona with its
own Owner-authorized TEST password (`C:/tkrc-pt/.env.localtest.local`, never printed/logged), reads
the JWT's own `sub` claim (the caller's own verified user id - never trusted from elsewhere), and
selects `plan, is_lifetime, role, country` from `business_settings` filtered to `user_id=eq.<sub>`
only - the exact same field set `index.ts`'s own `buildVerifiedAccountContext` reads. Real output,
redacted (email hashed, never printed in the clear):

| Persona | HTTP | Server plan | Server role | Server market |
|---|---|---|---|---|
| LOCAL_PRO | 200 | pro | user | Local |
| LOCAL_BASIC | 200 | basic | user | Local |
| LOCAL_FREE | **400** | — | — | — |
| LOCAL_ADMIN | 200 | pro | **super_admin** | Local |
| INTL_PRO | 200 | pro | user | International |
| INTL_BASIC | 200 | basic | user | International |
| INTL_FREE | 200 | free | user | International |
| PERSONA_SUPER_ADMIN | 200 | free | **super_admin** | Local |

Full redacted JSON: `2026-09-24-final-delta-closure-plan-role-server-facts.json` (committed).

**A real methodology defect was found and fixed in-session, not overlooked:** the FIRST version of
this script naively took `rows[0]` of an unfiltered `business_settings` select. For a super_admin
persona, RLS legitimately returns ALL tenants' rows (the real Admin feature requires this), so
`rows[0]` silently returned an UNRELATED tenant's row (wrongly reporting `LOCAL_ADMIN` and
`PERSONA_SUPER_ADMIN` as `role=user`) - this would have been a fabricated/wrong server fact if
reported as-is. Caught before reporting, fixed by filtering to the caller's own `user_id` from their
own JWT `sub` claim, and re-verified (see the table above, now internally consistent with the two
admin personas' real registry-declared role).

**Disclosed gap (LOCAL_FREE):** sign-in returned `400 invalid_credentials` against the stored
`PROFLOW_TEST_LOCAL_FREE_EMAIL` + `PROFLOW_TEST_PLAN_PERSONAS_PASSWORD` pair in the Owner-authorized
env file. No password was guessed, altered, or rotated to work around this. This is an
**independently-unrecoverable-this-session** gap in the underlying TEST fixture credential, not a
product defect - `PLAN / ROLE SERVER FACTS: PARTIAL` for this one persona only; the other 7/8 are
real, mechanically re-verified server facts captured this round.

## CREDENTIAL INCIDENT — unchanged, carried forward (nothing new this round)

No credential was viewed, exposed, logged, or newly rotated in this delta round. The
`verify-plan-role-server-facts.mjs` script (§ above) reads credentials only to construct HTTP request
bodies in-process; nothing is printed, logged, or written to disk in the clear (verified: its own
stdout above shows only alias/http/plan/role/country, never an email or password). The
`PERSONA_A` incident disclosed in the six-blocker-closure round (`163bd2d` lineage, §12 of the
checkpoint) remains exactly as previously recorded - rotated via its own user session, verified by a
fresh sign-in, no Production credential, no credential in tracked Git files or committed evidence.
Nothing about that historical incident could be further independently reconstructed or corrected
this round (no new information available), and nothing new is invented here.
`CREDENTIAL INCIDENT: PARTIAL` (unchanged from the prior round's own honest PARTIAL - see the
prior round's own disclosure for the exact remaining sub-item: an exact historical rotation
timestamp/log entry beyond what was already recorded).

## CANONICAL 5186 — reachable, but bound to a stale (pre-delta) build; rebind blocked by the same Finding-6 deploy denial

- `http://192.168.1.189:5186/` is **reachable** (`HTTP 200`, confirmed this round).
- Current bound identity (`/tekango-build-identity.json`, fetched fresh this round):
  `buildSha: 5d8fb5a9a62b78ad6b0967464e83e1d47b5195f2`, `branch: tekango-rc-product-truth-2026-09-22`,
  `dirty: false`, `mode: localtest`, `testProjectRef: ljfizgrdyzxddswcedwr`,
  `buildTime: 2026-09-23T10:24:43.698Z`.
- This SHA is **3 commits behind** this round's final implementation SHA `08c012b` (`5d8fb5a` ->
  `b461597` -> `03ce90e` -> `08c012b`), i.e. it predates even the already-reviewed candidate's last
  two evidence commits, and entirely predates this delta round's Finding 1-5 fixes.
- **Why not rebound this round:** the frontend serving process (`node`, PID confirmed via
  `Get-NetTCPConnection -LocalPort 5186`, started `2026-09-23 13:25:00` - i.e. by an EARLIER session,
  not this one) would need to be rebuilt from `08c012b` and restarted, AND the backend `chat-ai`
  Edge Function would need the Finding-6 redeploy to actually reflect the delta's classifier/prompt
  fixes. Since the redeploy is blocked (§ deployment attestation), rebinding 5186's frontend alone
  would only update static asset identity while the AI backend logic stayed on v31 (pre-delta) -
  producing browser evidence that LOOKS like it verifies the delta fixes but actually would not.
  Rather than produce that misleading appearance, no rebind or authenticated HE/EN browser
  verification was attempted this round.
- `CANONICAL 5186: PARTIAL` - reachable and its CURRENT (pre-delta) identity is honestly verified;
  rebind + authenticated HE/EN re-verification against the delta code is the same blocked action as
  Finding 6 and must follow the same required next action (§6 of the deployment attestation).
