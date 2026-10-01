# P0 AQP 0929 - protected Production execution channel (authorization + TEST verification)

Status: BUILD ONLY. Nothing in this directory has been executed against any database, GitHub setting or Supabase setting.
Every step in "Remaining provisioning steps" needs its own explicit Owner authorization.

## 1. Purpose

Apply exactly one migration, `20260929000000_drop_legacy_approve_quote_public.sql`
(sha256 `7c9c1fb54e7ce99896b9ba49f17b0608c686c340faa65ecefbb78ef949929ef4`, candidate commit
`623ac1ee01995b071b5f0d9a8f3d6f1cef87cc23`), to Production `ixabnzhjeqevtbhdfswv` exactly once, through:

1. a `workflow_dispatch`-only GitHub workflow in a protected Environment, which obtains one GitHub OIDC token and calls
2. the `p0-aqp-0929-broker` Edge Function, which independently verifies the OIDC token, the Owner authorization
   (`tekango-migration-authorization/3`) and the TEST verification report (`tekango-aqp-test-verification/2`), claims the
   one-shot state row, and sends the embedded, reviewed Production bundle in one Management API call.

This directory holds the artifact schemas, the authorization template and this document. The actual signed authorization and the
actual TEST report are instance artifacts and are never committed (see section 11).

## 2. Invariants

- One migration, one Production project, one send. No retry, no forward fix under this authorization (`forwardFixPermitted: false`),
  `oneShot: true`.
- The TEST report binds the committed TEST channel exactly: registry `tekango-test-migration-registry/2` revision R3
  sha256 `a93685d9d1cc3cfd68b67d020a1308ba0a7c0a8f131d97ddddee2b7348d540d9` (= the R2 registry
  `242678137ee6b341c0b1dad13844bc44e49ebd5630a4e42ad0871dd8c756a667` + step 7; R2 stays pinned as the history registry), run evidence
  `tekango-test-migration-run/2`,
  session-check SQL v2 sha256 `d29ba6ca169cd8687a9e67bf332afd1a37e3ef440aa25644fb2d12cf75697534` (`tekango-test-apply-session-check/2`, run
  under TEST_READ_ONLY as `supabase_read_only_user`; the v1 session check `851951309ccc...` is refused), atomicity probe
  `00-atomicity-probe.sql` (`5270596f53def403a2a2c8dbbb506a577f8c9956a7ccb06b41010aa94d45fd11`), and the seven ordered steps below.
  `/1` registry, run-evidence, report and `/2` authorization documents are refused.
- Every TEST step is `APPLIED` exactly once, in order 1..7, with exit 0 and no timeout re-check. Missing, duplicated, reordered,
  dry-run, stopped, `NOT_APPLIED`, `UNKNOWN`, probe-only or extra steps refuse the report.
- M1 (TEKANGO Codex spec Milestone 1, Track B option (a)): the steps span EXACTLY two runs - run 1 = the R19 history run (steps 1..6
  with the R2 registry; its run evidence sha256 `67538b44929ca4aa6ebb6631187fa76b6f0bcb9f678423d4b5360b7273e026cb` is a build pin),
  run 2 = the M1 run (step 7, registry R3). One run, three runs, reordered runs or another split refuse the report. The aqp captures
  bracket the run that applied `20260929000000` (run 1); the ledger capture follows the last run (24 rows). Production semantics are
  unchanged: one migration (`20260929000000`), the same bundle, candidate commit and authorization scope.
- Superseded: the R21 TEST report `8adef4c7e5e338d064d96505180dc72b8d579cec6e9f09c41c45a04afe740d26` (six steps, one run, registry R2)
  is refused by this checker; it remains checkable as history with the checker at its own tooling commit (`aacbe88` .. `d26b48f`).
- Freshness: final TEST capture < `issuedAt` <= now < `expiresAt`; `expiresAt - issuedAt <= 72 h`; `now - issuedAt <= 72 h`;
  `now - finalTestCaptureAt <= 72 h`; no timestamp after now (zero skew).
- Unknown keys are refused at every level of both artifacts. Secret- or customer-shaped content (JWT, Supabase / GitHub / AWS
  tokens, private keys, bearer headers, credential assignments, URLs with credentials, database URLs, e-mail addresses, UUIDs,
  phone-like numbers, high-entropy mixed-case tokens, control and bidi characters) is refused anywhere. Errors never echo values.
- Any pin that is `PENDING`, missing or malformed refuses everything (fail closed).
- The caller (workflow) can never supply SQL, a project ref, a target, a bundle, a URL or a credential to the broker.

| # | version | file | file sha256 | TEST bundle | bundle sha256 |
|---|---------|------|-------------|-------------|---------------|
| 1 | 20260917000000 | 20260917000000_prod_forward_professional_quote_items_stage_a.sql | f59279ba858c026cd99e3f5ccbc6b13efa33453c2a36fd4d61521f585824462f | 01-20260917000000.sql | 5b5c62a0b383452cb673a7eec13c7fec5fab0bdcb3d127fc8c3a09e1229a1458 |
| 2 | 20260917000001 | 20260917000001_prod_forward_business_professional_domain.sql | eddfa64b9b3f3592fad4a5cdacb4472d4a523740d0f5d654842e80d9ff7998b1 | 02-20260917000001.sql | 901f93f8c671bdb5257aa35e3a457aab8b6f159812b377bb41cf32d268dfeb5b |
| 3 | 20260917000002 | 20260917000002_prod_forward_professional_quote_hierarchy.sql | ef3e1ac26256005a9ec9431e190f2ab31132fbe7f43168de08d079ca267d20e4 | 03-20260917000002.sql | f311c13020ac93ccec5926297a9687ddaf96c9f457f68e75ab5bba5c772e088b |
| 4 | 20260917000003 | 20260917000003_prod_forward_save_quote_structured_atomic_function.sql | 5185f19b75dcde35eddbb4a4a4746139aef2f03939ee14965762ed904dc439af | 04-20260917000003.sql | fc9aaf993af6858323f6e669b15fe3b0ac5005a7fc4a0f2ec3438ff01330d0dc |
| 5 | 20260927000000 | 20260927000000_trial_reminder_delivery_claims.sql | 97d2017ed55ce06ca4683973adc69e48372d87a74e9c60e5a26d8b3a60a1d729 | 05-20260927000000.sql | e81fe1323387bd4ff82ac32dd8b01832aeb0ec18d7c6844e7705354a6004d0aa |
| 6 | 20260929000000 | 20260929000000_drop_legacy_approve_quote_public.sql | 7c9c1fb54e7ce99896b9ba49f17b0608c686c340faa65ecefbb78ef949929ef4 | 06-20260929000000.sql | 9da76c2d2ad568b8d5e0134bc939cfff1187e324f36c77f04057e8241b696417 |
| 7 | 20260930000000 | 20260930000000_converge_mirror_runtime_contract.sql | 54a9680340d3d0581976e6214c75bdcb4da1af9403057d850277df4bda43dd1f | 07-20260930000000.sql | 6dc0d1ff0581058f34f6028f8b1042963d3e861f32233ec7c4786c025c985b3a |

Steps 1-6 ran in the R19 history run (bundles 01-06 are the R2 bytes that were sent; the guard no longer pins them). Step 7 runs in the
M1 run (the guard pins only the atomicity probe and 07). Bundle 07 (M1 fix round R1-M1) holds the data tables locked from right after its
step guard to COMMIT (registry R3 step 7 `bodyLock`), so no concurrent row write can land between the file's TKM data guards and its
retypes; the pre-fix bytes `ed6d129e...` are superseded and unpinned.

M1 S1 (Owner decision S1, 2026-10-01; TECHNICAL storage precision - TEST money columns converge to the Production numeric(10,2) /
numeric(5,2) shape; not a money / product law, IRON-ILS-001 untouched): step 7 is the S1-amended `20260930000000` (same version,
never applied anywhere; sha256 `54a96803...`, canonical `1128361c`: TKM05 refuses only GENUINE sub-cent values, representation residue
is coerced by the retype) and bundle 07 v2 (`6dc0d1ff...`, registry R3 `a93685d9...`) takes `LOCK TABLE public.clients, public.quotes
IN SHARE MODE;` + `LOCK TABLE public.quote_items IN SHARE ROW EXCLUSIVE MODE;` and then runs the bound S1 pre-step (TEST only): it
re-binds the LIVE read-only S1 binding (fingerprints / counts / aggregate deltas; TKS100-TKS105), UPDATEs exactly the 4 bound GENUINE
`quote_items.total_price` rows to `round(x, 2)` (TKS106) and proves every other value unchanged (TKS107-TKS111) before the migration.
Superseded: bundle `f935e9da...`, registry `2dd150c1...`, file `6af52b48...`. Production semantics are unchanged (the Production
bundle, 0929 pins and authorization scope are untouched; on Production every 0930 data clause is a no-op).

## 3. File map

Canonical repository (`quotecode-dev/quotecode-clean`):

| path | role |
|------|------|
| `ops/p0-aqp-0929/README.md` | this document |
| `ops/p0-aqp-0929/authorization.schema.json` | JSON Schema of `tekango-migration-authorization/3` (generated) |
| `ops/p0-aqp-0929/authorization.TEMPLATE.json` | placeholder template; never passes the checker (generated) |
| `ops/p0-aqp-0929/test-verification-report.schema.json` | JSON Schema of `tekango-aqp-test-verification/2` (generated) |
| `.github/workflows/p0-aqp-0929-production-migration.yml` | the dispatch-only workflow (separate file owner) |
| `supabase/functions/p0-aqp-0929-broker/policy.ts` | broker logic; mirrors the verifier below 1:1 |
| `supabase/functions/p0-aqp-0929-broker/bundle.ts` | generated Production bundle, `PRODUCTION_BUNDLE_SQL` / `PRODUCTION_BUNDLE_SHA256` |
| `supabase/functions/p0-aqp-0929-broker/index.ts` | wiring only |

Tooling repository (`C:\tkrtool-iron`, not public):

| path | role |
|------|------|
| `scripts/mirror/aqp-authorization-lib.js` | the reference verifier (pure): pins, canonical JSON, report generator + checker, authorization checker, `verifyProductionRelease` |
| `scripts/mirror/aqp-authorization.mjs` | CLI: `check-test-report`, `check-authorization`, `release-key`, `generate-test-report`, `write-templates`; JSON Schema generators |
| `scripts/mirror/aqp-authorization.test.js` | acceptance + negative suite (reads the committed registry / bundles read-only) |
| `scripts/mirror/build-aqp-production-bundle.mjs` | generates `bundle.ts` from the reviewed AQP builder |

The three JSON files here are generated: `node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs write-templates --dir <this dir>`;
a test asserts they equal the generator output byte for byte.

## 4. Canonical JSON hashing rule (both artifacts; the broker re-implements it identically)

1. Canonical text of a value = `ser(value, "") + "\n"`, where
   - `null`, `true`, `false` as JSON;
   - numbers: safe integers only (`Number.isSafeInteger`, not `-0`) as `String(n)`; any other number is rejected;
   - strings: `JSON.stringify(s)` (ECMAScript escaping: `"` `\` and U+0000..U+001F escaped, lowercase `\u00xx`; everything else
     literal); strings containing a lone surrogate are rejected;
   - arrays: `[]` when empty, else `"[\n"` + items each prefixed by the child indent, joined by `",\n"`, then `"\n" + indent + "]"`;
   - objects: keys sorted with the default JavaScript sort (UTF-16 code-unit order); `{}` when empty, else `"{\n"` +
     `childIndent + JSON.stringify(key) + ": " + ser(value, childIndent)` joined by `",\n"`, then `"\n" + indent + "}"`;
   - child indent = parent indent + two spaces; `undefined`, functions, symbols, bigint are rejected.
   (Identical to `JSON.stringify(deepSortedValue, null, 2) + "\n"` for every document the schemas allow.)
2. Acceptance of received bytes: decode with `new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` (invalid UTF-8 rejected,
   a leading U+FEFF rejected); `JSON.parse`; the value must be a plain object; `canonicalJson(value)` must equal the decoded text
   exactly (so CRLF, other whitespace, other key order, duplicate keys, a missing trailing LF are all rejected).
3. Artifact sha256 = lowercase hex SHA-256 of the received bytes (equal to SHA-256 of the UTF-8 canonical text). Never
   re-canonicalize and hash.
4. `ownerDecisionTextSha256` = SHA-256 of the UTF-8 bytes of `ownerDecisionText`.
5. Release key = SHA-256 of the UTF-8 string `releaseId|authorizationSha256|testReportSha256|productionBundleSha256`
   (`releaseId` = `tekango-p0-aqp-remediation-2026-09-29`; the three hashes 64 lowercase hex, validated before use).

## 5. Pins and where they live

### 5.1 Build-time code pins (committed; broker `policy.ts` mirrors `aqp-authorization-lib.js`)

| name | value | lives in |
|------|-------|----------|
| releaseId | `tekango-p0-aqp-remediation-2026-09-29` | `BUILD_PINS` |
| repository / repositoryId | `quotecode-dev/quotecode-clean` / `1332524138` | `BUILD_PINS` |
| repositoryOwner / repositoryOwnerId | `quotecode-dev` / `309962619` (User account) | `BUILD_PINS` |
| ref | `refs/heads/main` | `BUILD_PINS` |
| workflowPath | `.github/workflows/p0-aqp-0929-production-migration.yml` | `BUILD_PINS` |
| environment | `production-migration-0929` | `BUILD_PINS` |
| oidcAudience | `tekango-p0-aqp-0929-broker` | `BUILD_PINS` |
| candidateCommit | `623ac1ee01995b071b5f0d9a8f3d6f1cef87cc23` | `BUILD_PINS` |
| migrationVersion / migrationFile / migrationSha256 | see section 1 | `BUILD_PINS` |
| productionRef / testRef | `ixabnzhjeqevtbhdfswv` / `ljfizgrdyzxddswcedwr` | `BUILD_PINS` |
| testRegistrySha256 | `a93685d9d1cc3cfd68b67d020a1308ba0a7c0a8f131d97ddddee2b7348d540d9` (registry R3) | `BUILD_PINS` |
| testHistoryRegistrySha256 | `242678137ee6b341c0b1dad13844bc44e49ebd5630a4e42ad0871dd8c756a667` (registry R2, the R19 run) | `BUILD_PINS` |
| testHistoryRunSha256 | `67538b44929ca4aa6ebb6631187fa76b6f0bcb9f678423d4b5360b7273e026cb` (the R19 run evidence) | `BUILD_PINS` |
| sessionCheckSha256 | `d29ba6ca169cd8687a9e67bf332afd1a37e3ef440aa25644fb2d12cf75697534` (session check v2) | `BUILD_PINS` |
| atomicity probe bundle | name + sha256, section 2 | `ATOMICITY_PROBE_BUNDLE` |
| seven ordered steps, two-run plan | table in section 2 | `EXPECTED_TEST_STEPS`, `AQP_RUN_PLAN` (broker: `testSteps`, `testRunPlan`) |
| productionBundleSha256 | generated by the bundle builder | broker: `PRODUCTION_BUNDLE_SHA256` in `bundle.ts`; tooling: `--production-bundle-sha256` input (`BUILD_PINS` ships `PENDING`) |

### 5.2 Deploy-time pins (cannot exist at build time; `PENDING` in code; fail closed)

| key | format | why it cannot be a code pin |
|-----|--------|-----------------------------|
| `workflowSha` | 40 lowercase hex | the `main` commit that contains the workflow + broker; a commit cannot contain its own hash |
| `executorCommit` | 40 lowercase hex | the tooling commit that generated the Production bundle (committed by the lead later); must equal `PRODUCTION_BUNDLE_META.generatorCommit` in `bundle.ts` |
| `authorizationSha256` | 64 lowercase hex | the Owner authorization is written after everything else is pinned |
| `testReportSha256` | 64 lowercase hex | the report exists only after the authorized TEST run |

They live in ONE value, the broker secret `P0_AQP_0929_DEPLOY_PINS` (Supabase Edge Function secret of the Production project),
strict JSON with exactly these four keys, e.g. the shape
`{"authorizationSha256":"<64-hex>","executorCommit":"<40-hex>","testReportSha256":"<64-hex>","workflowSha":"<40-hex>"}`.
Missing, unparseable, unknown / missing key, wrong format or `PENDING` refuses every request. The same values appear as
`bindings.workflowSha`, `bindings.executorCommit`, `bindings.testReportSha256` in the authorization, and must equal them.
The tooling reads the same JSON from `--deploy-pins <file>` or the same env name.

## 6. Artifacts

### 6.1 Authorization `tekango-migration-authorization/3`

Closed keys: `schema`, `authorizedBy` (`Owner`), `scope` (`APPLY_ONE_MIGRATION_TO_PRODUCTION_VIA_BROKER`), `releaseId`,
`ownerDecisionText` (verbatim, <= 4000 chars, names `20260929000000` and `ixabnzhjeqevtbhdfswv`, no placeholders),
`ownerDecisionTextSha256`, `bindings` (closed: `repository`, `repositoryId`, `repositoryOwner`, `repositoryOwnerId`, `ref`,
`workflowPath`, `workflowSha`, `environment`, `oidcAudience`, `candidateCommit`, `migrationVersion`, `migrationFile`,
`migrationSha256`, `productionRef`, `productionBundleSha256`, `executorCommit`, `testRegistrySha256`, `testReportSha256`),
`issuedAt`, `expiresAt` (strict UTC `YYYY-MM-DDTHH:MM:SS[.mmm]Z`), `oneShot` (`true`), `forwardFixPermitted` (`false`).
Start from `authorization.TEMPLATE.json`; the file must then be written in canonical form (section 4).

### 6.2 TEST verification report `tekango-aqp-test-verification/2`

Generated only by `aqp-authorization.mjs generate-test-report` from: the run evidence file(s) of the authorized TEST run(s)
(`tekango-test-migration-run/2`), the committed registry / session-check SQL / 7 bundles (read-only, hash-checked), fresh
read-only AQP security-probe captures before and after the 0929 run (verified in-process by `verify-aqp-remediation`), and a
fresh read-only TEST ledger capture after the last run. It records per run the evidence sha256, `runUtc` and the probe result,
per step the pinned identity plus ledger counts and post-capture / post-session hashes, the AQP verify summary, the ledger row of
the migration, `finalTestCaptureAt` (latest capture / run timestamp) and the generator commit. The output path must be outside
every git checkout; the file is never overwritten.

## 7. One-shot state (B-1) - NOT EXECUTED - separate authorization

Provisioning is a one-time Production DDL + insert performed by a separately authorized operator step. It is NOT a migration
(never under `supabase/migrations`, never in the ledger) and has NOT been run. It is aligned with the broker runtime contract
(`policy.ts`: `ONESHOT_TABLE`, `readbackSql`, `casSql`, `terminalSql`): the broker needs `release_key text PRIMARY KEY`,
`state text NOT NULL`, `updated_at timestamptz`; every other column is nullable or defaulted; the broker never INSERTs or DELETEs.

```sql
-- NOT EXECUTED - requires its own Owner authorization. Production ixabnzhjeqevtbhdfswv only. One transaction.
-- <BROKER_DB_ROLE> = the database role the Management API `database/query` endpoint runs as for the scoped token
-- (expected `postgres`; confirm first by a separately authorized read-only `SELECT current_user` through the same endpoint).
BEGIN;
CREATE SCHEMA tekango_release_ops;
REVOKE ALL ON SCHEMA tekango_release_ops FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE tekango_release_ops.p0_aqp_0929_oneshot (
  release_key          text PRIMARY KEY CHECK (release_key ~ '^[0-9a-f]{64}$'),
  state                text NOT NULL CHECK (state IN ('PENDING', 'RUNNING', 'APPLIED', 'NOT_APPLIED', 'UNKNOWN')),
  updated_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),
  created_at           timestamptz NOT NULL DEFAULT pg_catalog.now(),
  authorization_sha256 text CHECK (authorization_sha256 ~ '^[0-9a-f]{64}$'),
  test_report_sha256   text CHECK (test_report_sha256 ~ '^[0-9a-f]{64}$'),
  bundle_sha256        text CHECK (bundle_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE FUNCTION tekango_release_ops.p0_aqp_0929_oneshot_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN RAISE EXCEPTION 'TK_ONESHOT_NO_DELETE'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'PENDING' THEN RAISE EXCEPTION 'TK_ONESHOT_INSERT_NOT_PENDING'; END IF;
    IF EXISTS (SELECT 1 FROM tekango_release_ops.p0_aqp_0929_oneshot) THEN RAISE EXCEPTION 'TK_ONESHOT_SINGLE_ROW'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.release_key IS DISTINCT FROM OLD.release_key OR NEW.authorization_sha256 IS DISTINCT FROM OLD.authorization_sha256
     OR NEW.test_report_sha256 IS DISTINCT FROM OLD.test_report_sha256 OR NEW.bundle_sha256 IS DISTINCT FROM OLD.bundle_sha256
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'TK_ONESHOT_IMMUTABLE';
  END IF;
  IF NOT ((OLD.state = 'PENDING' AND NEW.state = 'RUNNING')
       OR (OLD.state = 'RUNNING' AND NEW.state IN ('APPLIED', 'NOT_APPLIED', 'UNKNOWN'))) THEN
    RAISE EXCEPTION 'TK_ONESHOT_TRANSITION';
  END IF;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tekango_release_ops.p0_aqp_0929_oneshot_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER p0_aqp_0929_oneshot_guard_row BEFORE INSERT OR UPDATE OR DELETE ON tekango_release_ops.p0_aqp_0929_oneshot
  FOR EACH ROW EXECUTE FUNCTION tekango_release_ops.p0_aqp_0929_oneshot_guard();
CREATE TRIGGER p0_aqp_0929_oneshot_guard_truncate BEFORE TRUNCATE ON tekango_release_ops.p0_aqp_0929_oneshot
  FOR EACH STATEMENT EXECUTE FUNCTION tekango_release_ops.p0_aqp_0929_oneshot_guard();

-- exactly one PENDING row for the deploy-time release key
-- (node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs release-key --deploy-pins <pins.json> --production-bundle-sha256 <64-hex>)
INSERT INTO tekango_release_ops.p0_aqp_0929_oneshot (release_key, state, authorization_sha256, test_report_sha256, bundle_sha256)
VALUES ('<RELEASE_KEY>', 'PENDING', '<authorizationSha256>', '<testReportSha256>', '<PRODUCTION_BUNDLE_SHA256>');

-- grants, AFTER the insert: the broker role gets SELECT on the table and UPDATE of (state, updated_at) only - no INSERT,
-- DELETE, TRUNCATE, REFERENCES or TRIGGER. (If <BROKER_DB_ROLE> owns the table, REVOKE still removes the owner's ACL entries,
-- but an owner could re-grant them; the trigger remains the enforcement - see Limits.)
REVOKE ALL ON TABLE tekango_release_ops.p0_aqp_0929_oneshot FROM PUBLIC, anon, authenticated, service_role, <BROKER_DB_ROLE>;
GRANT USAGE ON SCHEMA tekango_release_ops TO <BROKER_DB_ROLE>;
GRANT SELECT ON TABLE tekango_release_ops.p0_aqp_0929_oneshot TO <BROKER_DB_ROLE>;
GRANT UPDATE (state, updated_at) ON TABLE tekango_release_ops.p0_aqp_0929_oneshot TO <BROKER_DB_ROLE>;
COMMIT;
```

The broker role additionally needs (already true for `postgres`; nothing to grant here): SELECT on
`supabase_migrations.schema_migrations`, read access to `pg_catalog` (the read-back), and the privileges the reviewed Production
bundle itself requires (drop of the legacy `public.approve_quote_public` overloads, one ledger insert).

States: `APPLIED`, `NOT_APPLIED`, `UNKNOWN` are terminal. A row left in `RUNNING` is treated as `UNKNOWN` by every reader.

Exact broker statements (source of truth `policy.ts`; body always `{"query": <sql>}` to
`POST https://api.supabase.com/v1/projects/ixabnzhjeqevtbhdfswv/database/query`; `<rk>` = release key, 64 lowercase hex,
validated before interpolation; no caller value ever reaches SQL; no retry of any call):

1. Pre-check / read-back, one read-only `SELECT pg_catalog.json_build_object(...) AS tk_readback`: the one-shot `state` for
   `<rk>`, the ledger versions, the `20260929000000` ledger row digest, the `public.approve_quote_public` overloads.
2. CAS, one autocommit call:
   `UPDATE tekango_release_ops.p0_aqp_0929_oneshot SET state = 'RUNNING', updated_at = pg_catalog.now() WHERE release_key = '<rk>' AND state = 'PENDING' RETURNING release_key, state`
   - A clean answer of zero rows -> refuse (consumed / unknown / not provisioned); the bundle is never sent.
   - An AMBIGUOUS CAS (timeout, abort, network error, 5xx, unparseable answer, or anything but exactly one row
     `{release_key: <rk>, state: RUNNING}`) -> `UNKNOWN` (HTTP 502); the bundle is never sent, but the row may now be `RUNNING`.
     Before ANY re-dispatch an independent, separately authorized read-only check of the one-shot row, the ledger and the AQP
     overloads is required (and see "Recovery" below: a `RUNNING` row is consumed).
3. Bundle: `PRODUCTION_BUNDLE_SQL` from `bundle.ts`, exactly once.
4. The read-back (statement 1) decides `APPLIED`. `NOT_APPLIED` ONLY when BOTH hold: (a) the bundle call returned a server SQL
   error (4xx with a JSON error message) that carries a rollback-proving code, AND (b) the read-back proves the exact pre-state
   (ledger without `20260929000000`, both legacy overloads present). Every other combination (another error, no code, a generic
   `ERROR`, `25P02`, timeout, abort, network error, 5xx, unparseable, or a read-back that is not exactly the pre-state) -> `UNKNOWN`.
   Rollback-proving codes (copied from `policy.ts` `BUNDLE_ROLLBACK_TK_CODES` / `BUNDLE_ROLLBACK_SQLSTATES`, `provenRollbackCode`):
   - the 13 TK codes: `TK_SEARCH_PATH`, `TK_REPLAY_REFUSED`, `TK_LEDGER_IDENTITY_MISMATCH`, `TK_PRESTATE_DRIFT`,
     `TK_POSTCONDITION`, `TK_AQP_SEARCH_PATH`, `TK_AQP_UNEXPECTED_OVERLOAD`, `TK_AQP_UNEXPECTED_DEFINITION`, `TK_AQP_DEPENDENCY`,
     `TK_AQP_CANONICAL_MISSING`, `TK_AQP_CANONICAL_DEFINITION`, `TK_AQP_CANONICAL_ACL`, `TK_AQP_POST_STILL_PRESENT`;
   - the SQLSTATEs `55P03` (lock_not_available / lock_timeout) and `57014` (query_canceled / statement_timeout).
   Anchored-shape rule: a TK code counts only in the Postgres error shape `ERROR:\s+(P0001|TKA0[0-7]):\s+TK_[A-Z0-9_]+`; EVERY
   `TK_*` token anywhere in the message must be such an anchored match AND on the list (an unanchored or unlisted `TK_*` token,
   e.g. echoed query text, makes the error unproven -> `UNKNOWN`). Only when the message contains no `TK_*` token at all may a
   SQLSTATE prove rollback, and only as `ERROR:\s+(55P03|57014):`. If the real Management API error text carries no such prefix,
   `NOT_APPLIED` is simply unreachable (fail closed to `UNKNOWN`).
5. Terminal, best effort:
   `UPDATE tekango_release_ops.p0_aqp_0929_oneshot SET state = '<APPLIED|NOT_APPLIED|UNKNOWN>', updated_at = pg_catalog.now() WHERE release_key = '<rk>' AND state = 'RUNNING' RETURNING state`
   If it fails, the row stays `RUNNING` (= `UNKNOWN`).

### 7.1 Time budgets - a long statement ends UNKNOWN (fail closed)

| limit | value | where |
|-------|-------|-------|
| broker request budget | 140 s (`REQUEST_BUDGET_MS`) | `policy.ts` |
| broker abort of the bundle call | 95 s (`TIMEOUTS_MS.bundle`) | `policy.ts` |
| bundle `statement_timeout` (transaction-local) | 120 s | reviewed AQP builder -> `bundle.ts` |
| workflow client timeout on the broker call | `curl --max-time 150` | workflow |

The broker stops waiting for the bundle call after 95 s, while the server may keep executing the statement until its 120 s
`statement_timeout` (and could still commit). A bundle call without an answer within 95 s is therefore never classified
`APPLIED` or `NOT_APPLIED` from that call: the outcome is `UNKNOWN` (the row stays `RUNNING` or becomes `UNKNOWN`), there is no
retry, and the state can only be resolved by an independent, separately authorized read-only check taken no earlier than
120 s + 30 s after the send (ledger row `20260929000000`, AQP overloads, no lingering backend). The same holds when the workflow's
client timeout fires: the workflow reports UNKNOWN; the database state is whatever the broker recorded in the one-shot row.

### 7.2 Recovery - never an in-place reset

The one-shot table holds exactly ONE row, ever (the trigger refuses a second INSERT and any DELETE / TRUNCATE; terminal states are
final). Therefore every outcome that consumed the row without applying the migration - a row left `RUNNING`, `NOT_APPLIED`, or
`UNKNOWN` that an independent read-only check resolves as "not applied" - requires a NEW, separately authorized release:
a new TEST report and / or Owner authorization as needed, new deploy pins, a NEW release key, and explicit, separately authorized
DDL for its state (e.g. a new, separately named one-shot table). The existing row is never reset, updated back to `PENDING`,
deleted or re-inserted, and the trigger is never disabled for that purpose. An `UNKNOWN` that resolves as "applied" is recorded
by the independent check; nothing is re-sent.

Limits (documented, not solved by the trigger): the table owner / `postgres` can still `ALTER TABLE ... DISABLE TRIGGER`,
re-grant itself privileges or `DROP` the table; the guarantee relies on the broker only ever sending its fixed statements, and on
nobody else holding the token.

## 8. GitHub Environment and branch protection requirements (single-owner governance; supersedes B-4)

Facts (public read-only API, 2026-09-29): the repository is PUBLIC; the owner `quotecode-dev` is a User account (id `309962619`);
existing Environments are `Preview` and `Production` only; `production-migration-0929` does not exist yet; branch protection on
`main` was not readable unauthenticated; no rulesets were returned. Re-read 2026-10-01: `production-migration-0929` still 404,
`main` unprotected.

OWNER DECISION (2026-10-01, Packet 1, single-owner governance - SUPERSEDES the B-4 decision below): the Owner has exactly one
legitimate GitHub account. The second-human reviewer assumption is formally superseded. Fake, duplicate, bot, Claude or Codex
reviewer identities are FORBIDDEN. Unavailable dual-human control is replaced by: explicit Owner authorization + independent
Codex review + immutable pins (deploy pins, `workflowSha`, bundle / report / authorization hashes) + delayed secrets (Environment
secrets set only right before dispatch) + one-shot / no-retry / terminal read-back (broker CAS, section 7).

Required BEFORE the workflow first reaches `main` (configuration authorization + read-back proof):

- Environment `production-migration-0929`: required reviewers = 0; `prevent_self_review` NOT APPLICABLE (disabled / unset - there
  is no second reviewer); administrators may NOT bypass (`can_admins_bypass: false`, mandatory); deployment branch policy = custom
  branch policy, selected branches only, `main` only (mandatory); no wait timer; no custom protection app; NO Environment secrets.
- Branch `main`: an active ruleset on `refs/heads/main` - deletion restricted, force pushes blocked, linear history required,
  bypass list empty. Pull requests are not required ONLY for the one reviewed fast-forward that brings the workflow + broker to
  `main`; immediately after it the same ruleset is tightened to require a pull request (approving reviews = 0), keeping the
  deletion restriction, force-push block, linear history and empty bypass list.
- Actions: GitHub-hosted runners only; actions pinned to full commit SHAs; `permissions: contents: read, id-token: write`.

Required BEFORE any Production dispatch (not before the workflow first reaches `main`):

- Environment secrets `P0_AQP_0929_AUTHORIZATION_B64` / `P0_AQP_0929_TEST_REPORT_B64` exist ONLY as secrets of that Environment
  (never repository- or organization-level secrets with the same names); nothing else in the Environment.
- Explicit Owner authorization + independent Codex review of the exact final package (section 10).

Provisioning readback checklist (all must hold, read back after configuration; any deviation stops Production execution):

- [ ] Environment `production-migration-0929` exists.
- [ ] Required reviewers = 0 (no fabricated or substitute reviewer identity).
- [ ] `prevent_self_review` disabled / unset (not applicable).
- [ ] `can_admins_bypass` is `false`.
- [ ] Deployment branch policy is a custom branch policy allowing `main` only (no other branch or tag pattern).
- [ ] No wait timer, no custom protection app.
- [ ] Environment secrets: none before the workflow reaches `main`; exactly the two artifact secrets only right before dispatch.
- [ ] `main` ruleset as listed above (deletion restricted, force push blocked, linear history, empty bypass; pull request
      required after the one reviewed fast-forward).

SUPERSEDED (history, kept verbatim): OWNER DECISION (2026-09-29, B-4): `prevent_self_review` STAYS ENABLED and must never be
weakened. A SECOND GitHub identity, `<SECOND_GITHUB_REVIEWER>`, is the Environment's required reviewer. The concrete identity is
designated by the Owner at the separately authorized Environment-provisioning step (it is not needed at build time and is never
invented here). The identity that dispatches the workflow must NOT be `<SECOND_GITHUB_REVIEWER>`.

## 9. Supabase token requirements

- Held only by the broker, as the Production Edge Function secret `P0_AQP_0929_SUPABASE_DB_TOKEN`; read only after every OIDC,
  request-body, pin and artifact check has passed.
- Must be a scoped token limited to project `ixabnzhjeqevtbhdfswv` with Database read-write only (the Management API
  `POST /v1/projects/ixabnzhjeqevtbhdfswv/database/query`). Never a classic account-wide personal access token, never the
  `service_role` key, never a database password.
- Token kind check in the broker: the value must match `^sbp_fc[A-Za-z0-9_-]{16,256}$` (`SCOPED_TOKEN_RE` in `policy.ts`);
  anything else (e.g. a classic `sbp_` token) is refused before any call. The `sbp_fc` prefix for scoped tokens is taken from
  Supabase documentation and is UNVERIFIED until provisioning: if the issued token has another shape, execution stops and the
  pattern is changed only through a reviewed code change, never by weakening the check. The prefix proves the kind only; the
  scope itself is proven by the negative proofs below.
- Short expiry covering only the authorization window; revoked right after the terminal state is recorded.
- Required negative proofs before use (network calls; separate authorization): the token is refused by another project (TEST) and
  by non-database Management API endpoints. If a token with this scope cannot be issued, Production execution stops.

## 10. Remaining provisioning steps (each needs its own explicit authorization)

1. Lead review + commit of the tooling files (gives `executorCommit`) and of the canonical files; independent review of the
   broker, workflow and generated bundle.
2. Track A: authorized TEST session check, atomicity probe and six-step TEST run; fresh AQP before/after captures and a ledger
   capture; `generate-test-report` (output outside every checkout) -> `testReportSha256`.
3. Single-owner governance (section 8, Owner decision 2026-10-01, supersedes B-4): no second reviewer identity is designated;
   the Owner's one GitHub account dispatches; explicit Owner authorization + independent Codex review + immutable pins + delayed
   secrets + one-shot / no-retry / terminal read-back replace dual-human control.
4. GitHub configuration: create + configure Environment `production-migration-0929` (required reviewers 0, admin bypass off,
   `main` only, no secrets) and the `main` ruleset; readback proof against the section 8 checklist.
5. Merge workflow + broker to `main` -> `workflowSha`. FREEZE `main` from this step until the dispatch (step 12): any further
   commit to `main` changes the OIDC `workflow_sha` claim of the run, and the broker refuses it (401) because it no longer equals
   the pinned `workflowSha`. A needed change means a new `workflowSha`, new deploy pins and a new authorization.
6. Create the scoped Supabase token; negative-scope proofs.
7. Owner writes the authorization v3 (after the final TEST capture, within 72 h of it) -> `authorizationSha256`.
8. Assemble `P0_AQP_0929_DEPLOY_PINS` (its `executorCommit` must equal `PRODUCTION_BUNDLE_META.generatorCommit` of the
   reviewed `bundle.ts`, otherwise stop); compute the release key; set the broker secrets (`P0_AQP_0929_DEPLOY_PINS`,
   `P0_AQP_0929_SUPABASE_DB_TOKEN`) and the Environment secrets (authorization, report).
9. One-shot provisioning in Production (section 7) with the PENDING row for that release key.
10. Deploy the broker (separate infrastructure authorization); broker validation-only proof that cannot reach the database endpoint.
11. Verify both layers: `aqp-authorization.mjs check-authorization` (tooling) and the broker validation path, same result.
12. Final explicit Owner authorization to dispatch the workflow once. Afterwards: record the terminal state; an `UNKNOWN` /
    `RUNNING` row is resolved only by an independent read-only check; revoke the token; remove the secrets.

Notes:

- `.gitattributes`: no change is required and none was made (verified by the lead). `bundle.ts` is already covered by
  `supabase/functions/**/*.ts text eol=lf`; the workflow, the ops JSON files and this README are never hashed; the tests compare
  EOL-agnostically; `autocrlf` stores LF blobs.
- Product-truth baseline: `src/data/productTruthInteractiveBaseline.json` lists the 3 broker files with 0 interactive elements
  and 0 markers. A READY (generated) `bundle.ts` must keep 0 / 0: after generating it, verify with
  `npx vitest run src/data/productTruthInteractiveCompleteness.test.js` in the canonical repository (parses JSON,
  EOL-independent). The raw `node scripts/generate-product-truth-interactive-baseline.js --check` compares bytes and may report
  a CRLF-only "stale" on Windows autocrlf checkouts, which is not a content change.

Steps 7-12 must complete while the report is <= 72 h old and the authorization is valid; otherwise restart from step 2 or 7.
A consumed-without-apply outcome restarts as a NEW release (section 7.2), never by resetting the existing row.

## 11. Never commit

- GitHub OIDC tokens; Supabase personal access tokens, scoped tokens, `service_role` / anon keys, database passwords or URLs.
- The actual signed authorization v3, the actual TEST verification report, the deploy-pins instance value.
- Run evidence, captures, session-check outputs, raw terminal output, Management API request / response bodies.
- Customer rows, customer identifiers, customer names, e-mail addresses or phone numbers.
- Anything under the tooling repository's `scripts/backend-package/evidence/**`, and the unrelated `owner-binding.json` change.

## 12. Operator commands (local, no network, no database)

```
node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs check-test-report <report.json>
node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs check-authorization <authorization.json> --test-report <report.json> --deploy-pins <pins.json> --production-bundle-sha256 <64-hex>
node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs release-key --deploy-pins <pins.json> --production-bundle-sha256 <64-hex>
node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs generate-test-report --run-evidence <f> [...] --aqp-before <f> --aqp-after <f> --ledger-capture <f> --out <path outside every checkout>
node C:/tkrtool-iron/scripts/mirror/aqp-authorization.mjs write-templates --dir C:/tkseo-initial-html/ops/p0-aqp-0929
```

Exit codes: 0 PASS, 1 FAIL / refused, 64 usage.
