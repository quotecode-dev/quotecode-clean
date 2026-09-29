// @vitest-environment node
// p0-aqp-0929-broker policy tests. Runner-neutral:
//   node --test supabase/functions/p0-aqp-0929-broker/policy.test.ts     (Node >= 22.6 type stripping; node:test)
//   npx vitest run supabase/functions/p0-aqp-0929-broker/policy.test.ts  (vitest globals; the canonical `vitest run` picks it up)
// Provably offline: every fetch is an injected fake that records calls; no network, no DB, no file writes.
// All tokens / keys / artifacts are synthetic and generated at test time (RSA keypair via WebCrypto).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CODE_PINS, createHandler, createHandlerWithPins, DB_TOKEN_ENV, DEPLOY_PINS_ENV, GITHUB_JWKS_URL, MANAGEMENT_API_QUERY_URL,
  makeGithubJwksLoader, pinnedFetch, parseDeployPins, checkBundle, credentialShapeOk, expectedOidcClaims, readbackSql, casSql, terminalSql,
  sha256Hex, canonicalJson, releaseKeyOf, TEST_REPORT_SCHEMA, AUTH_SCHEMA, verifyProductionRelease, ALLOWED_ENV, SCOPED_TOKEN_RE,
  BUNDLE_ROLLBACK_TK_CODES, provenRollbackCode, parseBearer,
} from './policy.ts';

// ---- runner adapter (node:test under `node --test`, vitest globals under vitest) ----------------------------------------------
type TestFn = (name: string, fn: () => unknown | Promise<unknown>) => unknown;
const G = globalThis as unknown as { process?: { env?: Record<string, string | undefined> }; test?: TestFn };
const underVitest = Boolean(G.process?.env?.VITEST) && typeof G.test === 'function';
const test: TestFn = underVitest ? (G.test as TestFn) : ((await import('node:test')).test as unknown as TestFn);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const enc = new TextEncoder();

// ===================================================================================================================================
// Fixtures: keys, tokens, bundle, artifacts, fakes
// ===================================================================================================================================
const RSA = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const kpA = (await crypto.subtle.generateKey(RSA, true, ['sign', 'verify'])) as CryptoKeyPair;
const kpB = (await crypto.subtle.generateKey(RSA, true, ['sign', 'verify'])) as CryptoKeyPair;
const KID = 'synthetic-kid-A';
const jwkA = { ...(await crypto.subtle.exportKey('jwk', kpA.publicKey)), kid: KID, use: 'sig', alg: 'RS256' } as Record<string, unknown>;
delete jwkA.key_ops; delete jwkA.ext;
const JWKS = { keys: [jwkA] };

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uJson = (o: unknown) => b64u(enc.encode(JSON.stringify(o)));
const b64std = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, key: CryptoKey = kpA.privateKey): Promise<string> {
  const h = b64uJson(header); const p = b64uJson(payload);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64u(sig)}`;
}

const NOW_MS = Date.parse('2026-09-30T10:00:00.000Z');
const NOW_S = Math.floor(NOW_MS / 1000);
const WORKFLOW_SHA = '1'.repeat(40);
const EXECUTOR_COMMIT = '2'.repeat(40);
const FAKE_TOKEN = `sbp_fc${'0'.repeat(40)}`; // synthetic scoped-token shape; never a real credential

function claims(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...expectedOidcClaims(CODE_PINS), workflow_sha: WORKFLOW_SHA, sha: WORKFLOW_SHA, job_workflow_ref: expectedOidcClaims(CODE_PINS).workflow_ref, jti: 'synthetic-jti', actor: 'synthetic-actor', run_id: '1', run_number: '1',
    repository_visibility: 'public', ref_protected: 'true', job_workflow_sha: WORKFLOW_SHA, workflow: 'p0-aqp-0929', iat: NOW_S - 10, nbf: NOW_S - 70, exp: NOW_S + 290, ...over };
}
const HDR = { alg: 'RS256', typ: 'JWT', kid: KID, x5t: 'synthetic-thumbprint' };
const validJwt = (over: Record<string, unknown> = {}, hdr: Record<string, unknown> = HDR) => signJwt(hdr, claims(over));

// Synthetic Production bundle that satisfies the broker's structural tripwires (NOT the real bundle - that is bundle.ts, PENDING).
const PRE = CODE_PINS.productionPreApplyLedger;
const POST = [...PRE, CODE_PINS.migrationVersion].sort();
const BUNDLE_SQL = [
  'BEGIN ISOLATION LEVEL READ COMMITTED;',
  'SET LOCAL search_path = pg_catalog, pg_temp;',
  "SET LOCAL lock_timeout = '5s';",
  "SET LOCAL statement_timeout = '120s';",
  'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;',
  `DO $tk_guard$ BEGIN /* synthetic fixture */ RAISE NOTICE 'TK_REPLAY_REFUSED TK_PRESTATE_DRIFT ${`ARRAY[${PRE.map((v) => `'${v}'`).join(',')}]::text[]`.replace(/'/g, "''")}'; END $tk_guard$;`,
  `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('${CODE_PINS.migrationVersion}', '${CODE_PINS.migrationName}', ARRAY[$tk_x$synthetic$tk_x$]);`,
  "DO $tk_post$ BEGIN RAISE NOTICE 'TK_POSTCONDITION'; END $tk_post$;",
  `-- ${`ARRAY[${PRE.map((v) => `'${v}'`).join(',')}]::text[]`}`,
  'COMMIT;',
  '',
].join('\n');
const BUNDLE_SHA = await sha256Hex(enc.encode(BUNDLE_SQL));
const META_READY = Object.freeze({ status: 'READY', profileId: CODE_PINS.profileId, migrationFile: CODE_PINS.migrationFile, migrationSha256: CODE_PINS.migrationSha256,
  candidateCommit: CODE_PINS.candidateCommit, targetKind: 'PRODUCTION', targetRef: CODE_PINS.productionRef, generatorCommit: '2'.repeat(40) /* == EXECUTOR_COMMIT deploy pin */ });
const BUNDLE = Object.freeze({ PRODUCTION_BUNDLE_SQL: BUNDLE_SQL, PRODUCTION_BUNDLE_SHA256: BUNDLE_SHA, PRODUCTION_BUNDLE_META: META_READY });
const PINS = Object.freeze({ ...CODE_PINS, productionBundleSha256: BUNDLE_SHA });

// ---- artifacts (authorization v3 + TEST report /2), canonical bytes ------------------------------------------------------------
// Synthetic, schema-exact artifacts (canonical bytes). Hash-like values are obviously fake repeated hex digits.
const H = (c: string) => c.repeat(64);
const T = { run: '2026-09-30T06:00:00.000Z', before: '2026-09-30T05:59:00.000Z', after: '2026-09-30T06:01:00.000Z', ledger: '2026-09-30T06:02:00.000Z', issued: '2026-09-30T08:00:00.000Z', expires: '2026-10-01T08:00:00.000Z' };
type J = Record<string, any>; // test-only mutable fixture shape
function baseReport(): J {
  return {
    schema: TEST_REPORT_SCHEMA, verdict: 'PASS',
    target: { env: 'TEST', ref: CODE_PINS.testRef },
    migration: { version: CODE_PINS.migrationVersion, file: CODE_PINS.migrationFile, sha256: CODE_PINS.migrationSha256, candidateCommit: CODE_PINS.candidateCommit },
    registry: { schema: 'tekango-test-migration-registry/2', sha256: CODE_PINS.testRegistrySha256, sourceCommit: CODE_PINS.candidateCommit, targetRef: CODE_PINS.testRef, initialLedgerCount: 17 },
    sessionCheckSqlSha256: CODE_PINS.sessionCheckSha256,
    atomicityProbe: { bundleName: CODE_PINS.atomicityProbeBundle.name, bundleSha256: CODE_PINS.atomicityProbeBundle.sha256 },
    testRun: {
      runSchema: 'tekango-test-migration-run/2', toolingCommit: EXECUTOR_COMMIT,
      runs: [{ evidenceSha256: H('b'), runUtc: T.run, probe: { outcome: 'PROBE_ATOMIC', tkCode: 'TK_TXN_PROBE', postCaptureSha256: H('c'), postSessionSha256: H('d') }, steps: [1, 2, 3, 4, 5, 6] }],
      steps: CODE_PINS.testSteps.map((p) => ({ ...p, outcome: 'APPLIED', runEvidenceSha256: H('b'), preLedgerCount: 16 + p.step, postLedgerCount: 17 + p.step, postCaptureSha256: H('e'), postSessionSha256: H('f') })),
    },
    aqpVerify: { verdict: 'PASS', checksTotal: 12, beforeCaptureSha256: H('1'), afterCaptureSha256: H('2'), beforeCollectedAt: T.before, afterCollectedAt: T.after },
    ledger: { captureSha256: H('3'), collectedAt: T.ledger, projectRef: CODE_PINS.testRef, rowCount: 23, migrationRow: { version: CODE_PINS.migrationVersion, name: CODE_PINS.migrationName, nStatements: 1, statementsSha256: CODE_PINS.migrationSha256, stmt1Sha256: CODE_PINS.migrationSha256 } },
    finalTestCaptureAt: T.ledger,
    generator: { toolingCommit: EXECUTOR_COMMIT, clean: true },
  };
}
const OWNER_TEXT = `Owner decision (synthetic test text): apply migration ${CODE_PINS.migrationVersion} once to Production ${CODE_PINS.productionRef} through the protected broker.`;
async function baseAuth(reportSha: string): Promise<J> {
  return {
    schema: AUTH_SCHEMA, authorizedBy: 'Owner', scope: 'APPLY_ONE_MIGRATION_TO_PRODUCTION_VIA_BROKER', releaseId: CODE_PINS.releaseId,
    ownerDecisionText: OWNER_TEXT, ownerDecisionTextSha256: await sha256Hex(enc.encode(OWNER_TEXT)),
    bindings: {
      repository: CODE_PINS.repository, repositoryId: CODE_PINS.repositoryId, repositoryOwner: CODE_PINS.repositoryOwner, repositoryOwnerId: CODE_PINS.repositoryOwnerId,
      ref: CODE_PINS.ref, workflowPath: CODE_PINS.workflowPath, workflowSha: WORKFLOW_SHA, environment: CODE_PINS.environment, oidcAudience: CODE_PINS.oidcAudience,
      candidateCommit: CODE_PINS.candidateCommit, migrationVersion: CODE_PINS.migrationVersion, migrationFile: CODE_PINS.migrationFile, migrationSha256: CODE_PINS.migrationSha256,
      productionRef: CODE_PINS.productionRef, productionBundleSha256: BUNDLE_SHA, executorCommit: EXECUTOR_COMMIT, testRegistrySha256: CODE_PINS.testRegistrySha256, testReportSha256: reportSha,
    },
    issuedAt: T.issued, expiresAt: T.expires, oneShot: true, forwardFixPermitted: false,
  };
}
const canonBytes = (o: unknown) => enc.encode(canonicalJson(o));
const clone = <X>(o: X): X => JSON.parse(JSON.stringify(o));
// Build a consistent (report, authorization, deploy pins) triple after applying mutations; the authorization always binds the
// (possibly mutated) report bytes and the deploy pins always pin both, so every failure is attributable to the mutation alone.
async function triple(mutReport: (r: J) => void = () => {}, mutAuth: (a: J) => void | Promise<void> = () => {}, rawReport?: Uint8Array, rawAuth?: Uint8Array) {
  const r = baseReport(); mutReport(r);
  const reportBytes = rawReport ?? canonBytes(r);
  const a = await baseAuth(await sha256Hex(reportBytes)); await mutAuth(a);
  const authBytes = rawAuth ?? canonBytes(a);
  const deploy = { workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: await sha256Hex(authBytes), testReportSha256: await sha256Hex(reportBytes) };
  return { reportBytes, authBytes, deploy };
}
const ART = await (async () => { const t = await triple(); return { authBytes: t.authBytes, reportBytes: t.reportBytes }; })();

// ---- fakes -------------------------------------------------------------------------------------------------------------------------
type Call = { url: string; init: RequestInit; query: string; kind: string };
type Reply = { status: number; body: string } | Error;
const rbRow = (o: Record<string, unknown>) => JSON.stringify([{ tk_readback: o }]);
const PRE_RB = { oneshotState: 'PENDING', ledgerVersions: PRE, ledgerRow: null, overloads: CODE_PINS.legacyOverloads };
const APPLIED_RB = { oneshotState: 'RUNNING', ledgerVersions: POST, ledgerRow: `${CODE_PINS.migrationSha256}:1:${CODE_PINS.migrationName}`, overloads: [] };
const UNCHANGED_RB = { ...PRE_RB, oneshotState: 'RUNNING' };

// Scripted Management API fake. Replies are picked by call kind; every call is recorded and must hit the fixed URL.
function mgmtFake(script: Partial<Record<'precheck' | 'cas' | 'bundle' | 'readback' | 'terminal', Reply | ((c: Call) => Reply)>> = {}) {
  const calls: Call[] = [];
  let readbacks = 0;
  const defaults = {
    precheck: { status: 201, body: rbRow(PRE_RB) } as Reply,
    cas: (c: Call): Reply => ({ status: 201, body: JSON.stringify([{ release_key: /release_key = '([0-9a-f]{64})'/.exec(c.query)![1], state: 'RUNNING' }]) }),
    bundle: { status: 201, body: '[]' } as Reply,
    readback: { status: 201, body: rbRow(APPLIED_RB) } as Reply,
    terminal: (c: Call): Reply => ({ status: 201, body: JSON.stringify([{ state: /SET state = '([A-Z_]+)'/.exec(c.query)![1] }]) }),
  };
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    assert.equal(url, MANAGEMENT_API_QUERY_URL, 'only the fixed Management API endpoint may be called');
    assert.equal(new URL(url).host, 'api.supabase.com');
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal, 'every call carries an AbortSignal timeout');
    const query = JSON.parse(String(init.body)).query as string;
    assert.deepEqual(Object.keys(JSON.parse(String(init.body))), ['query']);
    let kind: string;
    if (query === BUNDLE_SQL) kind = 'bundle';
    else if (query.startsWith('SELECT pg_catalog.json_build_object(')) kind = readbacks++ === 0 ? 'precheck' : 'readback';
    else if (query.includes("SET state = 'RUNNING'")) kind = 'cas';
    else if (query.startsWith('UPDATE ')) kind = 'terminal';
    else throw new Error(`unexpected query kind: ${query.slice(0, 40)}`);
    const c: Call = { url, init, query, kind };
    calls.push(c);
    const s = (script as Record<string, unknown>)[kind] ?? (defaults as Record<string, unknown>)[kind];
    const r = (typeof s === 'function' ? (s as (c: Call) => Reply)(c) : s) as Reply;
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls, kinds: () => calls.map((c) => c.kind) };
}
const throwingFetch = async (): Promise<Response> => { throw new Error('NETWORK FORBIDDEN IN THIS TEST'); };

function envFake(values: Record<string, string | undefined>) {
  const reads: string[] = [];
  return { env: (name: string) => { reads.push(name); return values[name]; }, reads };
}

async function world(opts: { deploy?: Record<string, unknown> | string | undefined; token?: string | undefined; fetchImpl?: ReturnType<typeof mgmtFake>; bundle?: unknown; pins?: typeof PINS; jwks?: () => Promise<unknown>; auth?: Uint8Array; report?: Uint8Array } = {}) {
  const auth = opts.auth ?? ART.authBytes; const report = opts.report ?? ART.reportBytes;
  const deploy = 'deploy' in opts ? opts.deploy : { workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: await sha256Hex(auth), testReportSha256: await sha256Hex(report) };
  const e = envFake({ [DEPLOY_PINS_ENV]: typeof deploy === 'string' || deploy === undefined ? deploy : JSON.stringify(deploy), [DB_TOKEN_ENV]: 'token' in opts ? opts.token : FAKE_TOKEN });
  const m = opts.fetchImpl ?? mgmtFake();
  const logs: Record<string, unknown>[] = [];
  const handler = createHandlerWithPins({ fetch: m.fetch, env: e.env, now: () => NOW_MS, jwks: opts.jwks ?? (async () => JWKS), bundle: ('bundle' in opts ? opts.bundle : BUNDLE) as never, log: (r) => logs.push(r) }, opts.pins ?? PINS);
  return { handler, m, e, logs, auth, report };
}
function req({ jwt, body, method = 'POST', headers = {} }: { jwt?: string | null; body?: unknown; method?: string; headers?: Record<string, string> } = {}) {
  const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
  if (jwt) h.authorization = `Bearer ${jwt}`;
  return new Request('https://broker.example.test/functions/v1/p0-aqp-0929-broker', { method, headers: h, body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
}
const bodyOf = (auth: Uint8Array = ART.authBytes, report: Uint8Array = ART.reportBytes) => ({ authorization: b64std(auth), testReport: b64std(report) });
async function call(w: Awaited<ReturnType<typeof world>>, r: Request) {
  const res = await w.handler(r);
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) as Record<string, unknown> };
}
function assertNoCredentialRead(w: Awaited<ReturnType<typeof world>>) {
  assert.ok(!w.e.reads.includes(DB_TOKEN_ENV), 'the DB credential must not be read on a refused request');
  assert.equal(w.m.calls.length, 0, 'no Management API call on a refused request');
}
function assertSanitized(text: string, extra: string[] = []) {
  for (const bad of [FAKE_TOKEN, 'sbp_', 'synthetic@example.test', 'SELECT', 'INSERT', 'UPDATE', 'eyJ', 'BEGIN', 'Bearer', 'secret-row', ...extra]) assert.ok(!text.includes(bad), `response/log must not contain ${bad}`);
  const o = JSON.parse(text);
  for (const k of Object.keys(o)) assert.ok(['state', 'reason', 'releaseKey', 'bundleSha256', 'authorizationSha256', 'testReportSha256', 'deployPinsSha256', 'terminalRecorded', 'code'].includes(k), `unexpected response key ${k}`);
}

// ===================================================================================================================================
// Happy path + one-shot state machine
// ===================================================================================================================================
test('happy path: all checks pass -> precheck, CAS, exactly ONE bundle call, read-back, terminal APPLIED', async () => {
  const w = await world();
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.state, 'APPLIED');
  assert.deepEqual(w.m.kinds(), ['precheck', 'cas', 'bundle', 'readback', 'terminal']);
  assert.equal(w.m.calls.filter((c) => c.kind === 'bundle').length, 1);
  assert.equal(r.json.terminalRecorded, true);
  const rk = await releaseKeyOf(CODE_PINS.releaseId, await sha256Hex(ART.authBytes), await sha256Hex(ART.reportBytes), BUNDLE_SHA);
  assert.equal(r.json.releaseKey, rk);
  assert.equal(r.json.bundleSha256, BUNDLE_SHA);
  for (const c of w.m.calls) assert.equal((c.init.headers as Record<string, string>).authorization, `Bearer ${FAKE_TOKEN}`);
  assert.ok(w.m.calls.every((c) => c.kind === 'bundle' || c.query.includes(rk) || !c.query.includes('release_key')));
  assertSanitized(r.text);
  assert.ok(!JSON.stringify(w.logs).includes(FAKE_TOKEN));
  assert.equal(r.json.deployPinsSha256, await sha256Hex(enc.encode(JSON.stringify({ workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: await sha256Hex(ART.authBytes), testReportSha256: await sha256Hex(ART.reportBytes) }))));
  // credential read exactly once, and only after the deploy pins
  assert.deepEqual(w.e.reads, [DEPLOY_PINS_ENV, DB_TOKEN_ENV]);
});

test('createHandler (production entry) refuses everything while the code bundle pin is PENDING', async () => {
  assert.equal(CODE_PINS.productionBundleSha256, 'PENDING');
  const e = envFake({ [DEPLOY_PINS_ENV]: JSON.stringify({ workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: '3'.repeat(64), testReportSha256: '4'.repeat(64) }), [DB_TOKEN_ENV]: FAKE_TOKEN });
  const h = createHandler({ fetch: throwingFetch, env: e.env, now: () => NOW_MS, jwks: async () => JWKS, bundle: BUNDLE as never });
  const res = await h(req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).reason, 'BROKER_NOT_READY');
  assert.ok(!e.reads.includes(DB_TOKEN_ENV));
});

test('one-shot: CAS 0 rows (consumed / replay / concurrent) -> REFUSED, the bundle is never sent', async () => {
  const w = await world({ fetchImpl: mgmtFake({ cas: { status: 201, body: '[]' } }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.json.state, 'REFUSED'); assert.equal(r.json.reason, 'CAS_REFUSED');
  assert.deepEqual(w.m.kinds(), ['precheck', 'cas']);
});

test('one-shot: two concurrent requests against one PENDING row -> exactly one bundle call in total (stateful fake DB)', async () => {
  // fake DB model: the CAS is the only PENDING -> RUNNING transition; the bundle flips the ledger/overloads; terminal records state.
  const db = { oneshot: 'PENDING', applied: false };
  const read = (): Reply => ({ status: 201, body: rbRow({ oneshotState: db.oneshot, ledgerVersions: db.applied ? POST : PRE, ledgerRow: db.applied ? APPLIED_RB.ledgerRow : null, overloads: db.applied ? [] : CODE_PINS.legacyOverloads }) });
  const shared = mgmtFake({
    precheck: read, readback: read,
    cas: (c) => { if (db.oneshot !== 'PENDING') return { status: 201, body: '[]' }; db.oneshot = 'RUNNING'; return { status: 201, body: JSON.stringify([{ release_key: /release_key = '([0-9a-f]{64})'/.exec(c.query)![1], state: 'RUNNING' }]) }; },
    bundle: () => { db.applied = true; return { status: 201, body: '[]' }; },
    terminal: (c) => { if (db.oneshot !== 'RUNNING') return { status: 201, body: '[]' }; db.oneshot = /SET state = '([A-Z_]+)'/.exec(c.query)![1]; return { status: 201, body: JSON.stringify([{ state: db.oneshot }]) }; },
  });
  const w1 = await world({ fetchImpl: shared }); const w2 = await world({ fetchImpl: shared });
  const [a, b] = await Promise.all([call(w1, req({ jwt: await validJwt(), body: bodyOf() })), call(w2, req({ jwt: await validJwt(), body: bodyOf() }))]);
  assert.equal(shared.calls.filter((c) => c.kind === 'bundle').length, 1, 'exactly one bundle call across both requests');
  const reasons = [a.json.reason, b.json.reason];
  assert.equal(reasons.filter((x) => x === 'APPLIED').length, 1, JSON.stringify(reasons));
  assert.ok(['CAS_REFUSED', 'ONESHOT_NOT_PENDING'].includes(reasons.find((x) => x !== 'APPLIED') as string), JSON.stringify(reasons));
  assert.equal(db.oneshot, 'APPLIED');
  // a later replay of the same valid request is refused at the read-only pre-check, without any mutation
  const before = shared.calls.length;
  const w3 = await world({ fetchImpl: shared });
  const c3 = await call(w3, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(c3.json.reason, 'ONESHOT_NOT_PENDING'); assert.equal(shared.calls.length, before + 1);
});

test('one-shot: replay after a terminal state -> precheck refuses, no CAS, no bundle', async () => {
  for (const s of ['RUNNING', 'APPLIED', 'NOT_APPLIED', 'UNKNOWN', null]) {
    const w = await world({ fetchImpl: mgmtFake({ precheck: { status: 201, body: rbRow({ ...PRE_RB, oneshotState: s }) } }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.reason, 'ONESHOT_NOT_PENDING', String(s));
    assert.deepEqual(w.m.kinds(), ['precheck']);
  }
});

test('ledger already present -> REFUSED LEDGER_PRESENT without any mutation', async () => {
  const w = await world({ fetchImpl: mgmtFake({ precheck: { status: 201, body: rbRow({ ...PRE_RB, ledgerVersions: POST, ledgerRow: `${CODE_PINS.migrationSha256}:1:${CODE_PINS.migrationName}`, overloads: [] }) } }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.status, 409); assert.equal(r.json.reason, 'LEDGER_PRESENT');
  assert.deepEqual(w.m.kinds(), ['precheck']);
});

test('pre-state drift (ledger or overloads differ) -> REFUSED PRESTATE_DRIFT, no mutation', async () => {
  for (const drift of [{ ledgerVersions: PRE.slice(1) }, { ledgerVersions: [...PRE, '20990101000000'] }, { overloads: ['approve_quote_public(uuid)'] }, { overloads: [] }]) {
    const w = await world({ fetchImpl: mgmtFake({ precheck: { status: 201, body: rbRow({ ...PRE_RB, ...drift }) } }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.reason, 'PRESTATE_DRIFT');
    assert.deepEqual(w.m.kinds(), ['precheck']);
  }
});

test('precheck failure (network, 5xx, unparseable, wrong shape) -> REFUSED PRECHECK_FAILED, no mutation', async () => {
  for (const rep of [new Error('boom'), { status: 500, body: '{}' }, { status: 201, body: 'not json' }, { status: 201, body: '[]' }, { status: 201, body: JSON.stringify([{ tk_readback: { ...PRE_RB, extra: 1 } }]) }] as Reply[]) {
    const w = await world({ fetchImpl: mgmtFake({ precheck: rep }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.reason, 'PRECHECK_FAILED');
    assert.deepEqual(w.m.kinds(), ['precheck']);
  }
});

test('CAS ambiguous (timeout / network / 5xx / any error body / odd rows) -> UNKNOWN 502 CAS_AMBIGUOUS, the bundle is never sent', async () => {
  for (const rep of [new DOMException('timed out', 'TimeoutError'), new TypeError('fetch failed'), { status: 503, body: '{}' }, { status: 504, body: '<html>gw</html>' },
    { status: 400, body: JSON.stringify({ message: 'Failed to run sql query: ERROR:  timeout' }) }, { status: 201, body: JSON.stringify([{ release_key: 'x', state: 'RUNNING' }]) },
    { status: 201, body: JSON.stringify([{ release_key: 'a'.repeat(64), state: 'PENDING' }]) }, { status: 201, body: '{"a":1}' }, { status: 201, body: '[{"release_key":' }] as Reply[]) {
    const w = await world({ fetchImpl: mgmtFake({ cas: rep as Reply }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.status, 502); assert.equal(r.json.state, 'UNKNOWN'); assert.equal(r.json.reason, 'CAS_AMBIGUOUS'); assert.equal(r.json.terminalRecorded, false);
    assert.deepEqual(w.m.kinds(), ['precheck', 'cas'], 'no bundle, no terminal update after an ambiguous CAS');
    assertSanitized(r.text);
  }
});

test('bundle timeout / network error / 5xx / unparseable -> UNKNOWN, exactly one bundle call, never retried, no read-back', async () => {
  for (const rep of [new DOMException('The operation was aborted due to timeout', 'TimeoutError'), new TypeError('fetch failed'), { status: 500, body: '{"message":"internal"}' }, { status: 502, body: '<html>bad gateway</html>' }, { status: 504, body: '' }, { status: 201, body: 'garbage' }] as Reply[]) {
    const w = await world({ fetchImpl: mgmtFake({ bundle: rep }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.status, 502); assert.equal(r.json.state, 'UNKNOWN'); assert.equal(r.json.reason, 'BUNDLE_AMBIGUOUS');
    assert.deepEqual(w.m.kinds(), ['precheck', 'cas', 'bundle', 'terminal']);
    assert.ok(w.m.calls[3].query.includes("SET state = 'UNKNOWN'"));
    assert.equal(r.json.terminalRecorded, true);
  }
});

test('bundle 4xx SQL error + read-back proves unchanged -> NOT_APPLIED (only case), TK code surfaced, nothing else', async () => {
  const w = await world({ fetchImpl: mgmtFake({ bundle: { status: 400, body: JSON.stringify({ message: `Failed to run sql query: ERROR:  P0001: TK_PRESTATE_DRIFT: the snapshot changed ${FAKE_TOKEN} synthetic@example.test secret-row` }) }, readback: { status: 201, body: rbRow(UNCHANGED_RB) } }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.status, 409); assert.equal(r.json.state, 'NOT_APPLIED'); assert.equal(r.json.code, 'TK_PRESTATE_DRIFT');
  assert.deepEqual(w.m.kinds(), ['precheck', 'cas', 'bundle', 'readback', 'terminal']);
  assert.ok(w.m.calls[4].query.includes("SET state = 'NOT_APPLIED'"));
  assertSanitized(r.text);
});

test('NOT_APPLIED only for rollback-proving codes (every bundle TK guard code, 55P03, 57014) + unchanged read-back', async () => {
  const proven = ['TK_SEARCH_PATH', 'TK_REPLAY_REFUSED', 'TK_LEDGER_IDENTITY_MISMATCH', 'TK_PRESTATE_DRIFT', 'TK_POSTCONDITION', 'TK_AQP_SEARCH_PATH', 'TK_AQP_UNEXPECTED_OVERLOAD',
    'TK_AQP_UNEXPECTED_DEFINITION', 'TK_AQP_DEPENDENCY', 'TK_AQP_CANONICAL_MISSING', 'TK_AQP_CANONICAL_DEFINITION', 'TK_AQP_CANONICAL_ACL', 'TK_AQP_POST_STILL_PRESENT'];
  assert.deepEqual([...BUNDLE_ROLLBACK_TK_CODES].sort(), [...proven].sort());
  const msgs: [string, string][] = [...proven.map((c): [string, string] => [`Failed to run sql query: ERROR:  P0001: ${c}: synthetic detail`, c]),
    ['Failed to run sql query: ERROR:  55P03: canceling statement due to lock timeout', '55P03'], ['Failed to run sql query: ERROR:  57014: canceling statement due to statement timeout', '57014']];
  for (const [message, code] of msgs) {
    const w = await world({ fetchImpl: mgmtFake({ bundle: { status: 400, body: JSON.stringify({ message }) }, readback: { status: 201, body: rbRow(UNCHANGED_RB) } }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.state, 'NOT_APPLIED', message); assert.equal(r.json.code, code);
    assert.deepEqual(w.m.kinds(), ['precheck', 'cas', 'bundle', 'readback', 'terminal']);
  }
});

test('generic / unproven 4xx "ERROR" (no rollback-proving code) -> UNKNOWN SQL_ERROR_UNPROVEN even with an unchanged read-back', async () => {
  for (const message of [
    'Failed to run sql query: ERROR:  timeout', // RB probe case
    'ERROR: canceling statement due to user request', 'ERROR: 40001: could not serialize access', 'ERROR: x',
    'ERROR: P0001: TK_INJECTED_FAULT at before-drop', 'ERROR: P0001: TK_BEHAVIOUR: something', 'ERROR: TK_PRESTATE_DRIFT and TK_SOMETHING_ELSE',
    'ERROR: TK_PRESTATE_DRIFTX',
    // RB LOW-A: only the Postgres error shape counts, never a token anywhere
    "ERROR:  P0001: TK_PRESTATE_DRIFT: drift; QUERY: DO $tk_guard$ ... RAISE EXCEPTION 'TK_SEARCH_PATH: executor search_path not pinned'", // echoed query text
    'ERROR:  syntax error at or near "TK_SEARCH_PATH"', 'ERROR: TK_PRESTATE_DRIFT (no SQLSTATE prefix)', 'ERROR: request took 57014 ms', 'ERROR: 55P03 lock wait',
    'ERROR:  P0001: TK_PRESTATE_DRIFT: x ERROR:  55P03: y TK_OTHER', 'ERROR:  TKA09: TK_AQP_DEPENDENCY: unknown migration SQLSTATE',
  ]) {
    const w = await world({ fetchImpl: mgmtFake({ bundle: { status: 400, body: JSON.stringify({ message }) }, readback: { status: 201, body: rbRow(UNCHANGED_RB) } }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.status, 502, message); assert.equal(r.json.state, 'UNKNOWN', message);
    assert.equal(w.m.calls.filter((c) => c.kind === 'bundle').length, 1);
    assert.ok(w.m.calls.at(-1)!.query.includes("SET state = 'UNKNOWN'"));
  }
  const w = await world({ fetchImpl: mgmtFake({ bundle: { status: 400, body: JSON.stringify({ message: 'Failed to run sql query: ERROR:  timeout' }) }, readback: { status: 201, body: rbRow(UNCHANGED_RB) } }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.json.reason, 'SQL_ERROR_UNPROVEN'); assert.deepEqual(w.m.kinds(), ['precheck', 'cas', 'bundle', 'terminal']);
  assert.equal(provenRollbackCode('ERROR: P0001: TK_REPLAY_REFUSED: 20260929000000 is already recorded'), 'TK_REPLAY_REFUSED');
  assert.equal(provenRollbackCode('ERROR: timeout'), null);
  assert.equal(provenRollbackCode('Failed to run sql query: ERROR:  TKA03: TK_AQP_DEPENDENCY: 1 object(s) depend'), 'TK_AQP_DEPENDENCY');
  assert.equal(provenRollbackCode('ERROR:  57014: canceling statement due to statement timeout'), '57014');
  assert.equal(provenRollbackCode('ERROR: request took 57014 ms'), null);
  assert.equal(provenRollbackCode("ERROR:  P0001: TK_PRESTATE_DRIFT: x; QUERY: ... 'TK_SEARCH_PATH: ...'"), null, 'echoed TK token');
});

test('bundle proven SQL error but read-back NOT provably unchanged / read-back failure -> UNKNOWN', async () => {
  const sqlErr = { status: 400, body: JSON.stringify({ message: 'ERROR: P0001: TK_REPLAY_REFUSED: already recorded' }) };
  for (const rb of [{ status: 201, body: rbRow(APPLIED_RB) }, { status: 201, body: rbRow({ ...UNCHANGED_RB, oneshotState: 'PENDING' }) }, { status: 500, body: '{}' }, new Error('x'), { status: 201, body: rbRow({ ...UNCHANGED_RB, overloads: ['approve_quote_public(uuid)'] }) }] as Reply[]) {
    const w = await world({ fetchImpl: mgmtFake({ bundle: sqlErr, readback: rb }) });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.state, 'UNKNOWN');
    assert.equal(w.m.calls.filter((c) => c.kind === 'bundle').length, 1);
  }
});

test('bundle 2xx but read-back does not prove APPLIED -> UNKNOWN; 401/403/404 without SQL error -> UNKNOWN', async () => {
  const w = await world({ fetchImpl: mgmtFake({ readback: { status: 201, body: rbRow(UNCHANGED_RB) } }) });
  assert.equal((await call(w, req({ jwt: await validJwt(), body: bodyOf() }))).json.state, 'UNKNOWN');
  for (const st of [401, 403, 404, 429]) {
    const w2 = await world({ fetchImpl: mgmtFake({ bundle: { status: st, body: '{"message":"denied"}' } }) });
    const r2 = await call(w2, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r2.json.state, 'UNKNOWN'); assert.deepEqual(w2.m.kinds(), ['precheck', 'cas', 'bundle', 'terminal']);
  }
});

test('terminal update failure is best-effort: state still reported, terminalRecorded=false, no retry', async () => {
  const w = await world({ fetchImpl: mgmtFake({ terminal: new Error('down') }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.json.state, 'APPLIED'); assert.equal(r.json.terminalRecorded, false);
  assert.equal(w.m.calls.filter((c) => c.kind === 'terminal').length, 1);
});

test('redaction: token and upstream bodies (rows, emails, SQL echo) never reach the response or the logs', async () => {
  const leaky = JSON.stringify([{ tk_readback: { ...APPLIED_RB } }]).replace('"overloads"', `"x":"${FAKE_TOKEN}","overloads"`);
  const w = await world({ fetchImpl: mgmtFake({ bundle: { status: 500, body: JSON.stringify({ message: `${FAKE_TOKEN} synthetic@example.test secret-row SELECT` }) }, readback: { status: 201, body: leaky } }) });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assertSanitized(r.text);
  const logText = JSON.stringify(w.logs);
  for (const bad of [FAKE_TOKEN, 'synthetic@example.test', 'secret-row', 'SELECT', 'eyJ']) assert.ok(!logText.includes(bad), `log leaked ${bad}`);
  for (const l of w.logs) for (const v of Object.values(l)) assert.ok(typeof v === 'boolean' || typeof v === 'number' || /^[A-Za-z0-9_.:-]{0,64}$/.test(String(v)), `log value not a constant code: ${v}`);
});

test('SQL sent to the Management API is built only from constants + a hex release key', () => {
  const rk = 'a'.repeat(64);
  for (const s of [readbackSql(rk, CODE_PINS), casSql(rk), terminalSql(rk, 'APPLIED'), terminalSql(rk, 'NOT_APPLIED'), terminalSql(rk, 'UNKNOWN')]) {
    assert.ok(s.includes(rk)); assert.ok(!/;\s*\S/.test(s.replace(/'[^']*'/g, "''")), 'single statement');
  }
  assert.ok(!/\bINSERT\b|\bDELETE\b|\bUPDATE\b|\bDROP\b/.test(readbackSql(rk, CODE_PINS)), 'read-back is a pure SELECT');
  for (const bad of ["x'; DROP TABLE t; --", 'A'.repeat(64), 'a'.repeat(63)]) {
    assert.throws(() => casSql(bad)); assert.throws(() => readbackSql(bad, CODE_PINS)); assert.throws(() => terminalSql(bad, 'APPLIED'));
  }
  assert.throws(() => terminalSql(rk, 'RUNNING' as never));
  assert.ok(casSql(rk).includes("WHERE release_key = '" + rk + "' AND state = 'PENDING'"));
  assert.ok(terminalSql(rk, 'UNKNOWN').includes("AND state = 'RUNNING'"));
});

// ===================================================================================================================================
// Validation-only proof + credential ordering
// ===================================================================================================================================
test('validation-only: a fully valid request with NO credential configured never calls fetch (throwing fake) -> NO_CREDENTIAL', async () => {
  let n = 0;
  const w = await world({ token: undefined });
  const h = createHandlerWithPins({ fetch: async () => { n += 1; throw new Error('forbidden'); }, env: w.e.env, now: () => NOW_MS, jwks: async () => JWKS, bundle: BUNDLE as never }, PINS);
  const res = await h(req({ jwt: await validJwt(), body: bodyOf() }));
  const j = await res.json();
  assert.equal(res.status, 503); assert.equal(j.reason, 'NO_CREDENTIAL'); assert.equal(n, 0);
  // validation passed: the hashes are reported
  assert.equal(j.bundleSha256, BUNDLE_SHA); assert.ok(/^[0-9a-f]{64}$/.test(j.releaseKey));
});

test('validation-only: a valid request that fails at a LATE check (artifact / pin) never calls fetch and never reads the token', async () => {
  let n = 0;
  const e = envFake({ [DEPLOY_PINS_ENV]: JSON.stringify({ workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: await sha256Hex(ART.authBytes), testReportSha256: '5'.repeat(64) }), [DB_TOKEN_ENV]: FAKE_TOKEN });
  const h = createHandlerWithPins({ fetch: async () => { n += 1; throw new Error('forbidden'); }, env: e.env, now: () => NOW_MS, jwks: async () => JWKS, bundle: BUNDLE as never }, PINS);
  const res = await h(req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal((await res.json()).reason, 'ARTIFACT_PIN_MISMATCH'); assert.equal(n, 0); assert.ok(!e.reads.includes(DB_TOKEN_ENV));
});

test('credential kind: only a scoped sbp_fc token; classic PAT / JWT-shaped / project API keys / whitespace refused before any call', async () => {
  for (const t of [[b64uJson({ alg: 'HS256' }), b64uJson({ role: 'synthetic' }), 'c2lnbmF0dXJl'].join('.'), `sbp_${'0'.repeat(40)}`, `sb_${'secret'}_${'0'.repeat(22)}`, `sb_${'publishable'}_${'0'.repeat(20)}`, 'sbp_fcshort', 'short', `${FAKE_TOKEN} `, `${FAKE_TOKEN}\n`, `${FAKE_TOKEN}.x`]) {
    assert.equal(credentialShapeOk(t), false, t.slice(0, 12));
    const w = await world({ token: t });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.reason, 'CREDENTIAL_FORMAT'); assert.equal(w.m.calls.length, 0);
    assert.ok(!r.text.includes(t.trim()));
  }
  assert.equal(credentialShapeOk(FAKE_TOKEN), true);
});

// ===================================================================================================================================
// OIDC negative suite (every failure -> 401 UNAUTHENTICATED, no credential read, no Management API call)
// ===================================================================================================================================
async function expectUnauth(jwt: string | null, label: string, extraHeaders: Record<string, string> = {}, jwks?: () => Promise<unknown>) {
  const w = await world(jwks ? { jwks } : {});
  const r = await call(w, req({ jwt, body: bodyOf(), headers: extraHeaders }));
  assert.equal(r.status, 401, `${label}: ${r.text}`);
  assert.deepEqual(r.json, { state: 'REFUSED', reason: 'UNAUTHENTICATED' }, label);
  assertNoCredentialRead(w);
}
const CLAIM_CASES: [string, Record<string, unknown>][] = [
  ['issuer', { iss: 'https://token.actions.githubusercontent.com.evil.example' }],
  ['issuer trailing slash', { iss: 'https://token.actions.githubusercontent.com/' }],
  ['audience', { aud: 'sts.amazonaws.com' }],
  ['audience array', { aud: ['tekango-p0-aqp-0929-broker'] }],
  ['subject', { sub: 'repo:quotecode-dev/quotecode-clean:environment:production-migration-0929' }],
  ['repository', { repository: 'someone/quotecode-clean' }],
  ['repository_id', { repository_id: '1332524139' }],
  ['repository_id number', { repository_id: 1332524138 }],
  ['repository_owner', { repository_owner: 'someone' }],
  ['repository_owner_id', { repository_owner_id: '309962618' }],
  ['ref', { ref: 'refs/heads/feature' }],
  ['ref tag', { ref: 'refs/tags/main' }],
  ['ref_type', { ref_type: 'tag' }],
  ['workflow_ref', { workflow_ref: 'quotecode-dev/quotecode-clean/.github/workflows/other.yml@refs/heads/main' }],
  ['job_workflow_ref', { job_workflow_ref: 'evil/reusable/.github/workflows/x.yml@refs/heads/main' }],
  ['workflow_sha', { workflow_sha: '9'.repeat(40) }],
  ['sha', { sha: '9'.repeat(40) }],
  ['job_workflow_sha', { job_workflow_sha: '9'.repeat(40) }],
  ['environment', { environment: 'Production' }],
  ['environment missing', { environment: undefined }],
  ['event push', { event_name: 'push' }],
  ['event dynamic', { event_name: 'dynamic' }],
  ['runner self-hosted', { runner_environment: 'self-hosted' }],
  ['run_attempt 2', { run_attempt: '2' }],
  ['run_attempt number', { run_attempt: 1 }],
  ['ref_protected false', { ref_protected: 'false' }],
  ['expired', { exp: NOW_S - 61, iat: NOW_S - 200, nbf: NOW_S - 300 }],
  ['nbf future', { nbf: NOW_S + 120 }],
  ['iat future', { iat: NOW_S + 120, exp: NOW_S + 400 }],
  ['too old', { iat: NOW_S - 301, exp: NOW_S + 100 }],
  ['lifetime too long', { iat: NOW_S - 10, exp: NOW_S + 7200 }],
  ['exp missing', { exp: undefined }],
  ['iat string', { iat: String(NOW_S) }],
  ['nbf missing', { nbf: undefined }],
];
for (const [label, over] of CLAIM_CASES) {
  test(`OIDC claim refused: ${label}`, async () => {
    const c = claims(over);
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete c[k];
    await expectUnauth(await signJwt(HDR, c), label);
  });
}
test('OIDC: every expected claim is individually required (removing any one refuses)', async () => {
  for (const k of [...Object.keys(expectedOidcClaims(CODE_PINS)), 'workflow_sha']) {
    const c = claims(); delete c[k];
    await expectUnauth(await signJwt(HDR, c), `missing ${k}`);
  }
});
test('OIDC: workflow_sha must equal the deploy pin (a valid token from another commit is refused)', async () => {
  const w = await world({ deploy: { workflowSha: '7'.repeat(40), executorCommit: EXECUTOR_COMMIT, authorizationSha256: await sha256Hex(ART.authBytes), testReportSha256: await sha256Hex(ART.reportBytes) } });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.status, 401); assertNoCredentialRead(w);
});
test('OIDC: signature / algorithm / key failures', async () => {
  const good = await validJwt();
  const [h, p, s] = good.split('.');
  // payload tampered after signing
  await expectUnauth(`${h}.${b64uJson({ ...claims(), run_attempt: '1', actor: 'mallory' })}.${s}`, 'tampered payload');
  // signature bit-flip
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)), (ch) => ch.charCodeAt(0)); sig[10] ^= 1;
  await expectUnauth(`${h}.${p}.${b64u(sig)}`, 'bit-flipped signature');
  // signed by another key announcing the same kid
  await expectUnauth(await signJwt(HDR, claims(), kpB.privateKey), 'wrong key same kid');
  // alg none
  await expectUnauth(`${b64uJson({ alg: 'none', typ: 'JWT', kid: KID })}.${b64uJson(claims())}.`, 'alg none (empty sig)');
  await expectUnauth(`${b64uJson({ alg: 'none', typ: 'JWT', kid: KID })}.${b64uJson(claims())}.${s}`, 'alg none');
  // HS256 with the public modulus as HMAC secret (key-confusion)
  const hk = await crypto.subtle.importKey('raw', enc.encode(String(jwkA.n)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hh = b64uJson({ alg: 'HS256', typ: 'JWT', kid: KID }); const pp = b64uJson(claims());
  await expectUnauth(`${hh}.${pp}.${b64u(new Uint8Array(await crypto.subtle.sign('HMAC', hk, enc.encode(`${hh}.${pp}`))))}`, 'HS256 confusion');
  // RS512 / PS256 announced
  await expectUnauth(await signJwt({ ...HDR, alg: 'RS512' }, claims()), 'RS512');
  await expectUnauth(await signJwt({ ...HDR, alg: 'PS256' }, claims()), 'PS256');
  // unknown / missing kid; duplicated kid in JWKS; embedded-key headers
  await expectUnauth(await signJwt({ ...HDR, kid: 'unknown-kid' }, claims()), 'unknown kid');
  await expectUnauth(await signJwt({ alg: 'RS256', typ: 'JWT' }, claims()), 'missing kid');
  await expectUnauth(good, 'duplicate kid in JWKS', {}, async () => ({ keys: [jwkA, jwkA] }));
  await expectUnauth(good, 'JWKS key alg mismatch', {}, async () => ({ keys: [{ ...jwkA, alg: 'RS512' }] }));
  await expectUnauth(good, 'JWKS key use enc', {}, async () => ({ keys: [{ ...jwkA, use: 'enc' }] }));
  await expectUnauth(good, 'JWKS unavailable', {}, async () => { throw new Error('down'); });
  await expectUnauth(good, 'JWKS malformed', {}, async () => ({ nokeys: true }));
  for (const k of ['jku', 'jwk', 'x5u', 'x5c', 'crit']) await expectUnauth(await signJwt({ ...HDR, [k]: k === 'crit' ? ['exp'] : 'https://attacker.example' }, claims()), `header ${k}`);
  await expectUnauth(await signJwt({ ...HDR, typ: 'at+jwt' }, claims()), 'typ');
});
test('OIDC: missing / malformed Authorization header', async () => {
  await expectUnauth(null, 'no header');
  const w = await world();
  for (const hv of ['Basic Zm9vOmJhcg==', `bearer ${await validJwt()}`, `Bearer ${await validJwt()} x`, 'Bearer a.b', 'Bearer ...', `Bearer ${'a'.repeat(9000)}.b.c`]) {
    const r = await call(w, req({ jwt: null, body: bodyOf(), headers: { authorization: hv } }));
    assert.equal(r.status, 401, hv.slice(0, 20));
  }
  assertNoCredentialRead(w);
});
test('OIDC: the positive token passes verification (sanity for the negative suite)', async () => {
  const w = await world({ token: undefined });
  const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(r.json.reason, 'NO_CREDENTIAL');
});

// ===================================================================================================================================
// Request / body shape
// ===================================================================================================================================
test('request shape: method, content type, size cap', async () => {
  const w = await world();
  assert.equal((await call(w, req({ method: 'GET' }))).status, 405);
  assert.equal((await call(w, req({ method: 'PUT', jwt: await validJwt(), body: bodyOf() }))).status, 405);
  assert.equal((await call(w, req({ jwt: await validJwt(), body: bodyOf(), headers: { 'content-type': 'text/plain' } }))).status, 415);
  const big = JSON.stringify({ authorization: 'A'.repeat(300 * 1024), testReport: 'AAAA' });
  assert.equal((await call(w, req({ jwt: await validJwt(), body: big }))).status, 413);
  assert.equal((await call(w, req({ jwt: await validJwt(), body: bodyOf(), headers: { 'content-length': String(10 * 1024 * 1024) } }))).status, 413);
  assertNoCredentialRead(w);
});
test('body: closed keys - SQL / ref / target / bundle / url / endpoint / credential / unknown keys are refused', async () => {
  for (const k of ['sql', 'query', 'ref', 'projectRef', 'project_ref', 'target', 'bundle', 'bundleSql', 'url', 'endpoint', 'token', 'credential', 'apikey', 'releaseKey', 'extra', '__proto__']) {
    const w = await world();
    const body = `{${JSON.stringify(k)}:"x",${JSON.stringify(bodyOf()).slice(1)}`;
    const r = await call(w, req({ jwt: await validJwt(), body }));
    assert.equal(r.status, 400, k); assert.equal(r.json.reason, 'BODY_SHAPE'); assertNoCredentialRead(w);
  }
});
test('body: malformed values refused (missing key, non-base64, whitespace, url-safe alphabet, non-canonical padding, types, JSON)', async () => {
  const good = bodyOf();
  const bads: unknown[] = [
    { authorization: good.authorization }, { testReport: good.testReport }, [], 'x', null,
    { ...good, authorization: `${good.authorization.slice(0, 8)}\n${good.authorization.slice(8)}` },
    { ...good, authorization: good.authorization.replace(/\+/g, '-').replace(/\//g, '_') + (/[+/]/.test(good.authorization) ? '' : '-') },
    { ...good, testReport: 'QQ=' }, { ...good, testReport: 'QR==' }, { ...good, testReport: '' }, { ...good, testReport: 1 }, { ...good, authorization: { a: 1 } },
  ];
  for (const b of bads) {
    const w = await world();
    const r = await call(w, req({ jwt: await validJwt(), body: b }));
    assert.equal(r.status, 400, JSON.stringify(b).slice(0, 40)); assertNoCredentialRead(w);
  }
  const w = await world();
  assert.equal((await call(w, req({ jwt: await validJwt(), body: '{"authorization":' }))).status, 400);
  assert.equal((await call(w, req({ jwt: await validJwt(), body: `\ufeff${JSON.stringify(good)}` }))).status, 400);
});

// ===================================================================================================================================
// Deploy pins + bundle
// ===================================================================================================================================
test('deploy pins: missing / PENDING / extra key / bad format / non-JSON -> BROKER_NOT_READY for every request', async () => {
  const ok = { workflowSha: WORKFLOW_SHA, executorCommit: EXECUTOR_COMMIT, authorizationSha256: '3'.repeat(64), testReportSha256: '4'.repeat(64) };
  const bads: (Record<string, unknown> | string | undefined)[] = [undefined, '', 'PENDING', '{', '[]', { ...ok, workflowSha: 'PENDING' }, { ...ok, executorCommit: 'PENDING' }, { ...ok, authorizationSha256: 'PENDING' },
    { ...ok, testReportSha256: 'PENDING' }, { ...ok, extra: 'x' }, { workflowSha: WORKFLOW_SHA }, { ...ok, workflowSha: 'A'.repeat(40) }, { ...ok, authorizationSha256: '3'.repeat(63) }, { ...ok, testReportSha256: 4 }];
  for (const d of bads) {
    assert.throws(() => parseDeployPins(typeof d === 'string' || d === undefined ? d : JSON.stringify(d)));
    const w = await world({ deploy: d });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.status, 503, JSON.stringify(d)); assert.equal(r.json.reason, 'BROKER_NOT_READY'); assertNoCredentialRead(w);
  }
  assert.deepEqual(parseDeployPins(JSON.stringify(ok)), ok);
});
test('bundle: PENDING stub / sha mismatch / code pin PENDING / wrong target / TEST ref / psql meta / structure -> BROKER_NOT_READY', async () => {
  const variants: [string, unknown, typeof PINS?][] = [
    ['pending stub', { PRODUCTION_BUNDLE_SQL: '', PRODUCTION_BUNDLE_SHA256: 'PENDING', PRODUCTION_BUNDLE_META: { ...META_READY, status: 'PENDING_PRODUCTION_PRESTATE_CAPTURE' } }],
    ['status', { ...BUNDLE, PRODUCTION_BUNDLE_META: { ...META_READY, status: 'DRAFT' } }],
    ['code pin PENDING', BUNDLE, CODE_PINS as typeof PINS],
    ['declared sha != bytes', { ...BUNDLE, PRODUCTION_BUNDLE_SQL: BUNDLE_SQL.replace('COMMIT;', 'COMMIT; ') }],
    ['code pin != bundle', BUNDLE, { ...PINS, productionBundleSha256: 'f'.repeat(64) }],
    ['meta TEST target', { ...BUNDLE, PRODUCTION_BUNDLE_META: { ...META_READY, targetKind: 'TEST', targetRef: CODE_PINS.testRef } }],
    ['meta other migration', { ...BUNDLE, PRODUCTION_BUNDLE_META: { ...META_READY, migrationSha256: '0'.repeat(64) } }],
    ['missing', undefined],
  ];
  for (const [label, b, pins] of variants) {
    await assert.rejects(checkBundle(b, pins ?? PINS, EXECUTOR_COMMIT), (e: Error & { code?: string }) => e.code === 'BROKER_NOT_READY', label);
    const w = await world({ bundle: b ?? null, pins });
    const r = await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
    assert.equal(r.json.reason, 'BROKER_NOT_READY', label); assertNoCredentialRead(w);
  }
  // structural tripwires on an otherwise consistent (self-hashed + pinned) bundle
  const mutate = async (label: string, sql: string) => {
    const sha = await sha256Hex(enc.encode(sql));
    await assert.rejects(checkBundle({ PRODUCTION_BUNDLE_SQL: sql, PRODUCTION_BUNDLE_SHA256: sha, PRODUCTION_BUNDLE_META: META_READY }, { ...PINS, productionBundleSha256: sha }, EXECUTOR_COMMIT), (e: Error & { code?: string }) => e.code === 'BROKER_NOT_READY', label);
  };
  await mutate('psql meta line', `\\set ON_ERROR_STOP on\n${BUNDLE_SQL}`);
  await mutate('TEST ref embedded (TEST-prestate bundle)', BUNDLE_SQL.replace('-- ARRAY', `-- ${CODE_PINS.testRef} ARRAY`));
  await mutate('CRLF', BUNDLE_SQL.replace(/\n/g, '\r\n'));
  await mutate('no BEGIN first', `SELECT 1;\n${BUNDLE_SQL}`);
  await mutate('no final COMMIT', BUNDLE_SQL.replace(/COMMIT;\n$/, 'ROLLBACK;\n'));
  await mutate('two ledger inserts', BUNDLE_SQL.replace('DO $tk_post$', `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('1');\nDO $tk_post$`));
  await mutate('no replay guard', BUNDLE_SQL.replace(/TK_REPLAY_REFUSED/g, 'TK_X'));
  await mutate('TEST pre-ledger (17 rows)', BUNDLE_SQL.split(`ARRAY[${PRE.map((v) => `'${v}'`).join(',')}]::text[]`).join('ARRAY[]::text[]').split(`ARRAY[${PRE.map((v) => `''${v}''`).join(',')}]::text[]`).join('ARRAY[]::text[]'));
  await mutate('no ledger lock', BUNDLE_SQL.replace('LOCK TABLE', '-- LOCK'));
  assert.equal(await checkBundle(BUNDLE, PINS, EXECUTOR_COMMIT), BUNDLE_SHA);
  // generatorCommit must equal the deploy-pinned executorCommit (LOW-1)
  for (const [label, meta, ex] of [['generatorCommit PENDING', { ...META_READY, generatorCommit: 'PENDING' }, EXECUTOR_COMMIT], ['generatorCommit missing', (({ generatorCommit: _g, ...m }) => m)(META_READY), EXECUTOR_COMMIT],
    ['generatorCommit != executorCommit', { ...META_READY, generatorCommit: '9'.repeat(40) }, EXECUTOR_COMMIT], ['generatorCommit uppercase', { ...META_READY, generatorCommit: 'A'.repeat(40) }, EXECUTOR_COMMIT],
    ['executorCommit PENDING', META_READY, 'PENDING']] as [string, Record<string, unknown>, string][]) {
    await assert.rejects(checkBundle({ ...BUNDLE, PRODUCTION_BUNDLE_META: meta }, PINS, ex), (e: Error & { code?: string; detail?: string }) => e.code === 'BROKER_NOT_READY' && e.detail === 'bundle-generator-commit', label);
  }
  const wg = await world({ deploy: { workflowSha: WORKFLOW_SHA, executorCommit: '9'.repeat(40), authorizationSha256: await sha256Hex(ART.authBytes), testReportSha256: await sha256Hex(ART.reportBytes) } });
  const rg = await call(wg, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal(rg.json.reason, 'BROKER_NOT_READY'); assertNoCredentialRead(wg);
});
test('bundle.ts (generated by B6) is consistent with the broker gate: PENDING refused; READY must verify against the code pin', async () => {
  const p = join(HERE, 'bundle.ts');
  if (!existsSync(p)) return; // generated by B6; absent only mid-build
  const real = await import('./bundle.ts');
  const b = { PRODUCTION_BUNDLE_SQL: real.PRODUCTION_BUNDLE_SQL, PRODUCTION_BUNDLE_SHA256: real.PRODUCTION_BUNDLE_SHA256, PRODUCTION_BUNDLE_META: real.PRODUCTION_BUNDLE_META };
  if (real.PRODUCTION_BUNDLE_META.status !== 'READY') {
    assert.equal(CODE_PINS.productionBundleSha256, 'PENDING', 'code pin must stay PENDING while bundle.ts is PENDING');
    await assert.rejects(checkBundle(b, CODE_PINS, EXECUTOR_COMMIT));
  } else {
    assert.equal(await sha256Hex(enc.encode(real.PRODUCTION_BUNDLE_SQL)), real.PRODUCTION_BUNDLE_SHA256);
    assert.equal(await checkBundle(b, CODE_PINS, String(real.PRODUCTION_BUNDLE_META.generatorCommit)), CODE_PINS.productionBundleSha256, 'READY bundle must pass with the committed code pin');
  }
});

// ===================================================================================================================================
// Wiring: index.ts, fetch pinning, JWKS loader, config.toml, purity of policy.ts
// ===================================================================================================================================
test('pinnedFetch: any URL other than the fixed one rejects without touching the underlying fetch', async () => {
  const seen: string[] = [];
  const f = pinnedFetch(async (u) => { seen.push(u); return new Response('[]', { status: 201 }); }, MANAGEMENT_API_QUERY_URL);
  for (const u of ['https://api.supabase.com/v1/projects/ljfizgrdyzxddswcedwr/database/query', 'https://api.supabase.com/v1/projects/ixabnzhjeqevtbhdfswv/database/query?x=1', 'https://evil.example/v1/projects/ixabnzhjeqevtbhdfswv/database/query', 'http://api.supabase.com/v1/projects/ixabnzhjeqevtbhdfswv/database/query']) await assert.rejects(f(u, {}));
  assert.equal(seen.length, 0);
  await f(MANAGEMENT_API_QUERY_URL, {}); assert.deepEqual(seen, [MANAGEMENT_API_QUERY_URL]);
});
test('JWKS loader: fixed GitHub URL, no redirects, timeout signal, strict shape', async () => {
  const seen: [string, RequestInit][] = [];
  const ok = makeGithubJwksLoader(async (u, i) => { seen.push([u, i]); return new Response(JSON.stringify(JWKS), { status: 200 }); });
  assert.deepEqual(await ok(), JWKS);
  assert.equal(seen[0][0], GITHUB_JWKS_URL); assert.equal(seen[0][1].redirect, 'error'); assert.ok(seen[0][1].signal instanceof AbortSignal);
  await assert.rejects(makeGithubJwksLoader(async () => new Response('{}', { status: 500 }))());
  await assert.rejects(makeGithubJwksLoader(async () => new Response('{"keys":{}}', { status: 200 }))());
  await assert.rejects(makeGithubJwksLoader(async () => new Response('x'.repeat(70 * 1024), { status: 200 }))());
});
test('index.ts is wiring only: relative imports only, createHandler (never the test seam), fixed URLs via pinnedFetch, Deno.serve once', () => {
  const src = readFileSync(join(HERE, 'index.ts'), 'utf8');
  assert.ok(!src.includes('\r'), 'LF only');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['./bundle.ts', './policy.ts']);
  assert.ok(!/https?:\/\/|npm:|jsr:/.test(src.replace(/^\/\/.*$/gm, '')), 'no URL / remote specifier in code');
  assert.ok(!src.includes('createHandlerWithPins'));
  assert.equal(src.match(/Deno\.serve\(/g)?.length, 1);
  assert.ok(src.includes('pinnedFetch((url, init) => fetch(url, init), MANAGEMENT_API_QUERY_URL)'));
  assert.ok(src.includes('makeGithubJwksLoader(pinnedFetch((url, init) => fetch(url, init), GITHUB_JWKS_URL))'));
  assert.ok(!/Deno\.env\.get\('P0_/.test(src), 'env names are decided by policy.ts, not by the wiring');
});
test('policy.ts is pure: no imports, no Deno / process / console globals, LF only, fixed endpoints', () => {
  const src = readFileSync(join(HERE, 'policy.ts'), 'utf8');
  assert.ok(!src.includes('\r'));
  assert.ok(!/^\s*import\s/m.test(src), 'no imports at all (zero remote imports, WebCrypto only)');
  const code = stripComments(src);
  for (const g of ['Deno.', 'process.', 'console.', 'require(', 'eval(', 'new Function']) assert.ok(!code.includes(g), g);
  assert.equal(MANAGEMENT_API_QUERY_URL, 'https://api.supabase.com/v1/projects/ixabnzhjeqevtbhdfswv/database/query');
  assert.equal(GITHUB_JWKS_URL, 'https://token.actions.githubusercontent.com/.well-known/jwks');
  assert.equal((code.match(/https:\/\/api\.supabase\.com/g) || []).length, 2, 'origin + query URL constants only');
});
test('config.toml: exact broker block appended (verify_jwt=false justified, entrypoint) - EOL-agnostic', () => {
  const t = readFileSync(join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8').replace(/\r\n/g, '\n');
  const blocks = t.split('[functions.p0-aqp-0929-broker]');
  assert.equal(blocks.length, 2, 'exactly one broker block');
  const body = blocks[1].split(/\n\[/)[0];
  assert.match(body, /\nenabled = true\n/);
  assert.match(body, /\nverify_jwt = false\n/);
  assert.match(body, /\nentrypoint = "\.\/functions\/p0-aqp-0929-broker\/index\.ts"\n$/);
  assert.equal((body.match(/^verify_jwt = /gm) || []).length, 1);
  assert.match(body, /# verify_jwt=false on purpose/);
});

// ===================================================================================================================================
// Artifacts: authorization v3 + TEST report /2 (independent TS port of the tooling verifier)
// ===================================================================================================================================
async function expectArtifactRefused(label: string, t: Awaited<ReturnType<typeof triple>>, needle?: RegExp) {
  const v = await verifyProductionRelease(t.authBytes, t.reportBytes, t.deploy, NOW_MS, PINS);
  assert.equal(v.ok, false, `${label}: must be refused`);
  if (needle) assert.ok(v.errors.some((e) => needle.test(e)), `${label}: expected ${needle} in ${JSON.stringify(v.errors)}`);
  for (const e of v.errors) for (const bad of ['synthetic@example.test', 'eyJ', 'sbp_', OWNER_TEXT]) assert.ok(!e.includes(bad), `${label}: error text echoes an artifact value`);
}
test('artifacts: the synthetic /2 report + v3 authorization are accepted (positive control)', async () => {
  const t = await triple();
  const v = await verifyProductionRelease(t.authBytes, t.reportBytes, t.deploy, NOW_MS, PINS);
  assert.deepEqual(v.errors, []); assert.equal(v.ok, true);
});
test('artifacts: /1 documents and /1 inner schemas are refused; /2 accepted', async () => {
  await expectArtifactRefused('report /1', await triple((r) => { r.schema = 'tekango-aqp-test-verification/1'; }), /report\.schema/);
  await expectArtifactRefused('registry /1', await triple((r) => { r.registry.schema = 'tekango-test-migration-registry/1'; }), /registry\.schema/);
  await expectArtifactRefused('run /1', await triple((r) => { r.testRun.runSchema = 'tekango-test-migration-run/1'; }), /runSchema/);
  await expectArtifactRefused('auth /2', await triple(undefined, (a) => { a.schema = 'tekango-migration-authorization/2'; }), /authorization\.schema/);
});
test('artifacts: TEST report step / registry / hash tampering is refused', async () => {
  const cases: [string, (r: J) => void, RegExp?][] = [
    ['wrong step order', (r) => { const s = r.testRun.steps; [s[0], s[1]] = [s[1], s[0]]; }, /pinned step/],
    ['runs step order', (r) => { r.testRun.runs[0].steps = [2, 1, 3, 4, 5, 6]; }, /1,2,3,4,5,6/],
    ['missing step', (r) => { r.testRun.steps.pop(); r.testRun.runs[0].steps = [1, 2, 3, 4, 5]; }],
    ['duplicated step', (r) => { r.testRun.runs[0].steps = [1, 2, 3, 4, 5, 5]; }],
    ['extra step', (r) => { r.testRun.runs[0].steps = [1, 2, 3, 4, 5, 6, 7]; }],
    ['wrong version', (r) => { r.testRun.steps[2].version = '20260917000009'; }],
    ['wrong step name (file)', (r) => { r.testRun.steps[1].file = '20260917000001_other.sql'; }],
    ['wrong bundle hash', (r) => { r.testRun.steps[5].bundleSha256 = H('9'); }],
    ['wrong bundle name', (r) => { r.testRun.steps[5].bundleName = '06-other.sql'; }],
    ['wrong registry hash', (r) => { r.registry.sha256 = H('a'); }],
    ['wrong run-evidence hash', (r) => { r.testRun.steps[3].runEvidenceSha256 = H('a'); }],
    ['NOT_APPLIED step', (r) => { r.testRun.steps[4].outcome = 'NOT_APPLIED'; }],
    ['UNKNOWN step', (r) => { r.testRun.steps[4].outcome = 'UNKNOWN'; }],
    ['dry-run step', (r) => { r.testRun.steps[0].outcome = 'DRY_RUN (not sent)'; }],
    ['probe not atomic', (r) => { r.testRun.runs[0].probe.outcome = 'UNKNOWN'; }],
    ['probe tk code', (r) => { r.testRun.runs[0].probe.tkCode = 'TK_OTHER'; }],
    ['probe bundle', (r) => { r.atomicityProbe.bundleSha256 = H('a'); }],
    ['session check', (r) => { r.sessionCheckSqlSha256 = H('a'); }],
    ['ledger counts', (r) => { r.testRun.steps[0].postLedgerCount = 99; }],
    ['verdict', (r) => { r.verdict = 'FAIL'; }],
    ['target ref', (r) => { r.target.ref = CODE_PINS.productionRef; }],
    ['target env', (r) => { r.target.env = 'PRODUCTION'; }],
    ['migration sha', (r) => { r.migration.sha256 = H('a'); }],
    ['candidate commit', (r) => { r.migration.candidateCommit = '9'.repeat(40); }],
    ['ledger row', (r) => { r.ledger.migrationRow.nStatements = 2; }],
    ['ledger row count', (r) => { r.ledger.rowCount = 22; }],
    ['aqp verdict', (r) => { r.aqpVerify.verdict = 'FAIL'; }],
    ['aqp captures do not bracket the 0929 run', (r) => { r.aqpVerify.beforeCollectedAt = '2026-09-30T06:00:30.000Z'; }],
    ['final capture not the latest', (r) => { r.finalTestCaptureAt = T.after; }],
    ['generator not clean', (r) => { r.generator.clean = false; }],
    ['unknown top-level key', (r) => { r.extra = 'x'; }, /unknown key/],
    ['unknown nested key', (r) => { r.testRun.steps[0].extra = 'x'; }, /unknown key/],
    ['future-dated capture', (r) => { r.ledger.collectedAt = '2026-09-30T11:00:00.000Z'; r.finalTestCaptureAt = '2026-09-30T11:00:00.000Z'; }, /future-dated/],
    ['non-strict timestamp', (r) => { r.ledger.collectedAt = '2026-09-30T06:02:00Z '; }],
  ];
  for (const [label, mut, needle] of cases) await expectArtifactRefused(label, await triple(mut), needle);
});
test('artifacts: secret- / customer-shaped content is refused anywhere (never echoed)', async () => {
  for (const [label, v] of [['email', 'synthetic@example.test'], ['jwt', `${b64uJson({ alg: 'RS256' })}.${b64uJson({ sub: 'x' })}`], ['supabase token', `sbp_${'0'.repeat(40)}`], ['uuid', '00000000-0000-0000-0000-000000000000'], ['bidi', 'a\u202Eb']]) {
    await expectArtifactRefused(`report ${label}`, await triple((r) => { r.testRun.steps[0].extra = v; }), /secret- or customer-shaped/);
    await expectArtifactRefused(`auth ${label}`, await triple(undefined, async (a) => { a.ownerDecisionText = `${OWNER_TEXT} ${v}`; a.ownerDecisionTextSha256 = await sha256Hex(enc.encode(a.ownerDecisionText)); }), /secret- or customer-shaped/);
  }
});
test('artifacts: non-canonical bytes (CRLF, key order, missing trailing LF, BOM, whitespace) are refused', async () => {
  const r = baseReport(); const canon = canonicalJson(r);
  const variants: [string, string | Uint8Array][] = [
    ['CRLF', canon.replace(/\n/g, '\r\n')], ['no trailing LF', canon.slice(0, -1)], ['two trailing LF', `${canon}\n`], ['compact', `${JSON.stringify(r)}\n`],
    ['unsorted', `${JSON.stringify({ verdict: r.verdict, ...r }, null, 2)}\n`], ['4-space', `${JSON.stringify(JSON.parse(canon), null, 4)}\n`], ['float', canon.replace('"checksTotal": 12', '"checksTotal": 1.5')],
    ['BOM', new Uint8Array([0xef, 0xbb, 0xbf, ...enc.encode(canon)])], ['invalid UTF-8', new Uint8Array([0x7b, 0xff, 0x7d])],
  ];
  for (const [label, v] of variants) {
    const bytes = typeof v === 'string' ? enc.encode(v) : v;
    await expectArtifactRefused(`report ${label}`, await triple(undefined, undefined, bytes));
    const a = await baseAuth(await sha256Hex(ART.reportBytes)); const ac = canonicalJson(a);
    await expectArtifactRefused(`auth ${label}`, await triple(undefined, undefined, undefined, typeof v === 'string' ? enc.encode(label === 'CRLF' ? ac.replace(/\n/g, '\r\n') : label === 'no trailing LF' ? ac.slice(0, -1) : `${JSON.stringify(a)}\n`) : v));
  }
});
test('artifacts: authorization field / binding tampering is refused (every binding key individually)', async () => {
  const cases: [string, (a: J) => void | Promise<void>, RegExp?][] = [
    ['authorizedBy', (a) => { a.authorizedBy = 'Lead'; }], ['scope', (a) => { a.scope = 'ANY'; }], ['releaseId', (a) => { a.releaseId = 'tekango-other-release'; }],
    ['oneShot false', (a) => { a.oneShot = false; }, /oneShot/], ['oneShot missing', (a) => { delete a.oneShot; }],
    ['forward fix permitted', (a) => { a.forwardFixPermitted = true; }, /forwardFixPermitted/],
    ['owner text sha', (a) => { a.ownerDecisionTextSha256 = H('a'); }],
    ['owner text placeholder', async (a) => { a.ownerDecisionText = `{{VERBATIM}} ${OWNER_TEXT}`; a.ownerDecisionTextSha256 = await sha256Hex(enc.encode(a.ownerDecisionText)); }, /placeholder/],
    ['owner text PENDING', async (a) => { a.ownerDecisionText = `${OWNER_TEXT} PENDING`; a.ownerDecisionTextSha256 = await sha256Hex(enc.encode(a.ownerDecisionText)); }, /placeholder/],
    ['owner text without migration', async (a) => { a.ownerDecisionText = `Owner decision for ${CODE_PINS.productionRef}`; a.ownerDecisionTextSha256 = await sha256Hex(enc.encode(a.ownerDecisionText)); }],
    ['owner text too long', async (a) => { a.ownerDecisionText = `${OWNER_TEXT} ${'x '.repeat(2100)}`; a.ownerDecisionTextSha256 = await sha256Hex(enc.encode(a.ownerDecisionText)); }],
    ['unknown key', (a) => { a.extra = true; }], ['unknown binding key', (a) => { a.bindings.extra = 'x'; }], ['missing binding', (a) => { delete a.bindings.executorCommit; }],
    ['binding PENDING', (a) => { a.bindings.workflowSha = 'PENDING'; }, /PENDING/], ['productionRef = TEST ref', (a) => { a.bindings.productionRef = CODE_PINS.testRef; }],
    ['expired', (a) => { a.issuedAt = '2026-09-27T12:00:00.000Z'; a.expiresAt = '2026-09-30T09:00:00.000Z'; }, /EXPIRED/],
    ['validity > 72h', (a) => { a.expiresAt = '2026-10-03T08:00:01.000Z'; }, /72 h/],
    ['issued in the future', (a) => { a.issuedAt = '2026-09-30T10:00:01.000Z'; a.expiresAt = '2026-10-01T10:00:00.000Z'; }, /future-dated/],
    ['issued before the final TEST capture', (a) => { a.issuedAt = '2026-09-30T06:01:59.000Z'; }, /strictly before/],
    ['issued at the final TEST capture', (a) => { a.issuedAt = T.ledger; }, /strictly before/],
    ['expires == issued', (a) => { a.expiresAt = a.issuedAt; }],
    ['bad timestamp', (a) => { a.issuedAt = '2026-09-30 08:00:00'; }],
  ];
  for (const [label, mut, needle] of cases) await expectArtifactRefused(label, await triple(undefined, mut), needle);
  const alt: Record<string, string> = { repository: 'someone/quotecode-clean', repositoryId: '1332524139', repositoryOwner: 'someone', repositoryOwnerId: '309962618', ref: 'refs/heads/dev',
    workflowPath: '.github/workflows/other.yml', workflowSha: '7'.repeat(40), environment: 'production', oidcAudience: 'other-audience', candidateCommit: '7'.repeat(40), migrationVersion: '20260929000001',
    migrationFile: '20260929000001_other.sql', migrationSha256: H('7'), productionRef: 'aaaaaaaaaaaaaaaaaaaa', productionBundleSha256: H('7'), executorCommit: '7'.repeat(40), testRegistrySha256: H('7'), testReportSha256: H('7') };
  for (const k of Object.keys(alt)) await expectArtifactRefused(`binding ${k}`, await triple(undefined, (a) => { a.bindings[k] = alt[k]; }), new RegExp(`bindings\\.${k}`));
});
test('artifacts: stale report (> 72 h before now) is refused even with a fresh authorization', async () => {
  const shift = (s: string) => new Date(Date.parse(s) - 80 * 3600 * 1000).toISOString();
  await expectArtifactRefused('stale report', await triple((r) => {
    r.testRun.runs[0].runUtc = shift(T.run); r.aqpVerify.beforeCollectedAt = shift(T.before); r.aqpVerify.afterCollectedAt = shift(T.after); r.ledger.collectedAt = shift(T.ledger); r.finalTestCaptureAt = shift(T.ledger);
  }), /older than 72 h/);
});
test('artifacts: any PENDING build pin refuses (bundle pin, registry pin)', async () => {
  const t = await triple();
  for (const k of ['productionBundleSha256', 'testRegistrySha256', 'sessionCheckSha256', 'candidateCommit'] as const) {
    const v = await verifyProductionRelease(t.authBytes, t.reportBytes, t.deploy, NOW_MS, { ...PINS, [k]: 'PENDING' } as typeof PINS);
    assert.equal(v.ok, false, k);
  }
});
test('artifacts through the handler: tampered report / authorization -> 403, pins mismatch -> 403, never a Management API call', async () => {
  const bad = await triple((r) => { r.testRun.steps[5].bundleSha256 = H('9'); });
  let w = await world({ auth: bad.authBytes, report: bad.reportBytes });
  let r = await call(w, req({ jwt: await validJwt(), body: bodyOf(bad.authBytes, bad.reportBytes) }));
  assert.equal(r.status, 403); assert.equal(r.json.reason, 'TEST_REPORT_INVALID'); assertNoCredentialRead(w); assertSanitized(r.text);
  const badA = await triple(undefined, (a) => { a.forwardFixPermitted = true; });
  w = await world({ auth: badA.authBytes, report: badA.reportBytes });
  r = await call(w, req({ jwt: await validJwt(), body: bodyOf(badA.authBytes, badA.reportBytes) }));
  assert.equal(r.status, 403); assert.equal(r.json.reason, 'AUTHORIZATION_INVALID'); assertNoCredentialRead(w);
  // bytes differ from the deploy pins (e.g. another valid authorization) -> ARTIFACT_PIN_MISMATCH
  const other = await triple(undefined, (a) => { a.expiresAt = '2026-10-01T07:59:59.000Z'; });
  w = await world();
  r = await call(w, req({ jwt: await validJwt(), body: bodyOf(other.authBytes, ART.reportBytes) }));
  assert.equal(r.json.reason, 'ARTIFACT_PIN_MISMATCH'); assertNoCredentialRead(w);
  assert.equal(r.json.authorizationSha256, await sha256Hex(other.authBytes));
});
test('release key = sha256(releaseId|authSha|reportSha|bundleSha) (B5 HASHING_RULE section 3)', async () => {
  const k = await releaseKeyOf(CODE_PINS.releaseId, H('1'), H('2'), H('3'));
  assert.equal(k, await sha256Hex(enc.encode(`${CODE_PINS.releaseId}|${H('1')}|${H('2')}|${H('3')}`)));
  await assert.rejects(releaseKeyOf(CODE_PINS.releaseId, 'PENDING', H('2'), H('3')));
});
test('canonicalJson: sorted keys, 2-space, LF, one trailing LF; floats / lone surrogates rejected', () => {
  assert.equal(canonicalJson({ b: 1, a: [true, null, 'x'], c: {} }), '{\n  "a": [\n    true,\n    null,\n    "x"\n  ],\n  "b": 1,\n  "c": {}\n}\n');
  assert.throws(() => canonicalJson({ a: 1.5 })); assert.throws(() => canonicalJson({ a: '\uD800' })); assert.throws(() => canonicalJson({ a: undefined }));
});

// ===================================================================================================================================
// Workflow static policy (B-3): .github/workflows/p0-aqp-0929-production-migration.yml read as TEXT (no YAML library)
// ===================================================================================================================================
const WF_PATH = join(REPO_ROOT, '.github', 'workflows', 'p0-aqp-0929-production-migration.yml');
const BROKER_URL = 'https://ixabnzhjeqevtbhdfswv.supabase.co/functions/v1/p0-aqp-0929-broker';
function wf(): { text: string; lines: string[]; code: string[]; runBlocks: string[][] } {
  assert.ok(existsSync(WF_PATH), `workflow missing: ${WF_PATH}`);
  const text = readFileSync(WF_PATH, 'utf8').replace(/\r\n/g, '\n'); // EOL-agnostic: content is asserted, not line endings
  const lines = text.split('\n');
  const code = lines.map((l) => (/^\s*#/.test(l) ? '' : l)); // full-line comments removed
  const runBlocks: string[][] = [];
  code.forEach((l, i) => {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(l);
    if (!m) return;
    const ind = m[1].length;
    if (m[2] && !/^[|>][-+]?\s*$/.test(m[2])) { runBlocks.push([m[2]]); return; }
    const block: string[] = [];
    for (let j = i + 1; j < code.length; j += 1) {
      if (code[j].trim() === '') { block.push(''); continue; }
      if (code[j].length - code[j].trimStart().length <= ind) break;
      block.push(code[j]);
    }
    runBlocks.push(block);
  });
  return { text, lines, code, runBlocks };
}
// top-level YAML section (column-0 key) -> its lines
function section(code: string[], key: string): string[] | null {
  const i = code.findIndex((l) => new RegExp(`^${key}:`).test(l));
  if (i < 0) return null;
  const out = [code[i]];
  for (let j = i + 1; j < code.length && !/^[A-Za-z]/.test(code[j]); j += 1) out.push(code[j]);
  return out;
}
test('workflow: trigger is workflow_dispatch only, no inputs, no other events', () => {
  const { text, code } = wf();
  assert.ok(!text.includes('\r'), 'no stray CR inside a line');
  const on = section(code, 'on');
  assert.ok(on, 'on: present');
  assert.deepEqual(on!.filter((l) => l.trim() !== ''), ['on:', '  workflow_dispatch:'], 'on: must be exactly workflow_dispatch with no configuration');
  assert.ok(!code.some((l) => /^['"]?true['"]?:/.test(l)), 'no YAML-1.1 "true:" alias for on:');
  for (const ev of ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_run', 'workflow_call', 'repository_dispatch', 'issue_comment', 'issues', 'release', 'merge_group', 'deployment', 'check_run', 'inputs'])
    assert.ok(!code.some((l) => new RegExp(`^\\s*-?\\s*${ev}\\s*:`).test(l)), `forbidden trigger/key ${ev}`);
});
test('workflow: permissions only contents: read + id-token: write (top level empty or the same), nothing else', () => {
  const { code } = wf();
  const permLines: string[] = [];
  code.forEach((l, i) => {
    const m = /^(\s*)permissions:\s*(.*)$/.exec(l);
    if (!m) return;
    if (m[2].trim() !== '') { assert.equal(m[2].trim(), '{}', `inline permissions must be {} (line ${i + 1})`); return; }
    for (let j = i + 1; j < code.length && (code[j].trim() === '' || code[j].length - code[j].trimStart().length > m[1].length); j += 1) if (code[j].trim()) permLines.push(code[j].trim());
  });
  assert.ok(permLines.length > 0, 'the job declares its permissions');
  assert.deepEqual([...new Set(permLines)].sort(), ['contents: read', 'id-token: write']);
  assert.ok(!code.some((l) => /write-all|read-all/.test(l)));
});
test('workflow: fixed concurrency group, cancel-in-progress false; protected Environment; GitHub-hosted runner', () => {
  const { code } = wf();
  const conc = section(code, 'concurrency');
  assert.ok(conc, 'top-level concurrency');
  const group = conc!.map((l) => /^\s+group:\s*(.+)$/.exec(l)?.[1]).find(Boolean);
  assert.ok(group && !group.includes('${{'), 'fixed group (no expression)');
  assert.ok(conc!.some((l) => /^\s+cancel-in-progress:\s*false\s*$/.test(l)));
  const envs = code.map((l) => /^\s+environment:\s*(.*)$/.exec(l)?.[1]).filter((x) => x !== undefined);
  assert.deepEqual(envs, ['production-migration-0929'], 'exactly one job Environment, the protected one (scalar form)');
  const runsOn = code.map((l) => /^\s+runs-on:\s*(.*)$/.exec(l)?.[1]).filter((x) => x !== undefined) as string[];
  assert.ok(runsOn.length >= 1 && runsOn.every((r) => /^ubuntu-\d{2}\.\d{2}$/.test(r.trim())), `GitHub-hosted pinned image only: ${runsOn}`);
  assert.ok(!code.some((l) => /self-hosted/.test(l)));
  assert.ok(!code.some((l) => /continue-on-error:\s*true/.test(l)));
  assert.ok(!code.some((l) => /^\s+(container|services):/.test(l)), 'no containers / services');
});
test('workflow: every `uses:` is pinned to a 40-hex commit SHA', () => {
  const { code } = wf();
  for (const l of code) {
    const m = /^\s*-?\s*uses:\s*(\S+)/.exec(l);
    if (m) assert.match(m[1], /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+@[0-9a-f]{40}$/, `unpinned action: ${m[1]}`);
  }
});
test('workflow: no `${{` expression inside any run: block; secrets only via env: of exactly the two artifact secrets', () => {
  const { code, runBlocks } = wf();
  assert.ok(runBlocks.length >= 1);
  for (const b of runBlocks) for (const l of b) assert.ok(!l.includes('${{'), `expression inside run: ${l.trim()}`);
  const exprLines = code.filter((l) => l.includes('${{'));
  for (const l of exprLines) assert.match(l.trim(), /^P0_AQP_0929_(AUTHORIZATION|TEST_REPORT)_B64: \$\{\{ secrets\.P0_AQP_0929_(AUTHORIZATION|TEST_REPORT)_B64 \}\}$/, `unexpected expression: ${l.trim()}`);
  const secrets = [...new Set(code.join('\n').match(/secrets\.[A-Za-z0-9_]+/g) || [])].sort();
  assert.deepEqual(secrets, ['secrets.P0_AQP_0929_AUTHORIZATION_B64', 'secrets.P0_AQP_0929_TEST_REPORT_B64']);
  assert.ok(!/SUPABASE_(ACCESS_TOKEN|DB_URL|SERVICE_ROLE)|P0_AQP_0929_SUPABASE_DB_TOKEN|sbp_/.test(code.join('\n')), 'no Supabase credential in GitHub');
});
test('workflow: no retry loops; exactly one OIDC GET and exactly ONE curl POST to the fixed broker URL', () => {
  const { runBlocks } = wf();
  const run = runBlocks.map((b) => b.join('\n')).join('\n');
  const noComments = run.split('\n').map((l) => l.replace(/^\s*#.*$/, '')).join('\n');
  assert.ok(!/\b(while|until)\b/.test(noComments), 'no while/until loops');
  assert.ok(!/\bset\s+-[a-z]*x/.test(noComments), 'no xtrace (would print secrets)');
  assert.ok(!/--retry(?!\s+0\b)/.test(noComments) && !/--retry-(all-errors|connrefused|delay|max-time)/.test(noComments), 'curl --retry 0 only');
  assert.ok(!/(^|\s)(wget|gh|node|deno|npx|supabase|psql)\s/m.test(noComments), 'no other network / DB clients');
  const blocks = noComments.split(/\bcurl(?=\s+--)/).slice(1).map((b) => b.split('\n\n')[0]); // curl COMMANDS (flags follow), not the word in a message
  assert.equal(blocks.length, 2, 'exactly two curl invocations (one OIDC GET, one broker POST)');
  for (const b of blocks) assert.ok(/--max-redirs 0/.test(b) && /--proto '=https'/.test(b) && /--retry 0/.test(b) && /--max-time \d+/.test(b), 'https only, no redirects, no retry, bounded');
  for (const m of noComments.matchAll(/\bfor\b[\s\S]*?\bdone\b/g)) assert.ok(!/\bcurl\s+--/.test(m[0]), 'no curl inside a loop');
  assert.equal((noComments.match(/--request POST|-X POST/g) || []).length, 1, 'exactly one POST');
  assert.equal((noComments.match(/--data-binary/g) || []).length, 1);
  assert.equal((noComments.match(/https:\/\/[A-Za-z0-9.-]+\.supabase\.co[^\s'"]*/g) || []).length, 1, 'exactly one Supabase URL literal');
  assert.ok(noComments.includes(`readonly BROKER_URL='${BROKER_URL}'`), 'the fixed broker URL literal');
  assert.equal((noComments.match(/"\$\{BROKER_URL\}"/g) || []).length, 1, 'BROKER_URL used once');
  assert.ok(!/api\.supabase\.com/.test(noComments), 'the workflow never talks to the Management API');
  assert.ok(/audience=\$\{AUDIENCE\}/.test(noComments) && noComments.includes("readonly AUDIENCE='tekango-p0-aqp-0929-broker'"), 'OIDC audience fixed');
});
test('workflow: the broker request body has exactly the two keys the broker accepts', () => {
  const { runBlocks } = wf();
  const run = runBlocks.map((b) => b.join('\n')).join('\n');
  const m = /jq -n -c '(\{[^']*\})'/.exec(run);
  assert.ok(m, 'body built by jq -n');
  assert.equal(m![1], '{authorization: env.P0_AQP_0929_AUTHORIZATION_B64, testReport: env.P0_AQP_0929_TEST_REPORT_B64}');
});

// ===================================================================================================================================
// Lead amendments: env allowlist, deadline, optional OIDC claims, scoped token kind
// ===================================================================================================================================
// full-line and trailing `//` comments (a `//` preceded by whitespace or at line start; `https://` is kept)
function stripComments(src: string): string { return src.replace(/(^|\s)\/\/.*$/gm, '$1'); }
test('env allowlist: only the two broker names are ever read, in order, token last; no other Supabase env anywhere', async () => {
  assert.deepEqual([...ALLOWED_ENV], [DEPLOY_PINS_ENV, DB_TOKEN_ENV]);
  const w = await world();
  await call(w, req({ jwt: await validJwt(), body: bodyOf() }));
  assert.deepEqual(w.e.reads, [DEPLOY_PINS_ENV, DB_TOKEN_ENV]);
  for (const f of ['policy.ts', 'index.ts']) {
    const code = stripComments(readFileSync(join(HERE, f), 'utf8'));
    for (const bad of ['SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ACCESS_TOKEN', 'toObject']) assert.ok(!code.includes(bad), `${f} references ${bad}`);
  }
  const idx = readFileSync(join(HERE, 'index.ts'), 'utf8');
  assert.equal((stripComments(idx).match(/Deno\.env\./g) || []).length, 1);
  assert.ok(idx.includes('env: (name) => (ALLOWED_ENV.includes(name) ? Deno.env.get(name) : undefined),'));
});
test('deadline: if the pre-check ends after the pre-CAS deadline, refuse before any mutation', async () => {
  const w = await world();
  let n = 0;
  const h = createHandlerWithPins({ fetch: w.m.fetch, env: w.e.env, now: () => (n++ === 0 ? NOW_MS : NOW_MS + 26_000), jwks: async () => JWKS, bundle: BUNDLE as never }, PINS);
  const res = await h(req({ jwt: await validJwt(), body: bodyOf() }));
  assert.equal((await res.json()).reason, 'DEADLINE'); assert.deepEqual(w.m.kinds(), ['precheck']);
});
test('OIDC: job_workflow_ref / job_workflow_sha / sha / ref_protected are optional (absent -> accepted, present -> must be consistent)', async () => {
  const c = claims(); for (const k of ['job_workflow_ref', 'job_workflow_sha', 'sha', 'ref_protected']) delete c[k];
  const w = await world({ token: undefined });
  const r = await call(w, req({ jwt: await signJwt(HDR, c), body: bodyOf() }));
  assert.equal(r.json.reason, 'NO_CREDENTIAL', r.text);
  await expectUnauth(await validJwt({ job_workflow_sha: '8'.repeat(40) }), 'inconsistent job_workflow_sha');
  await expectUnauth(await validJwt({ workflow_sha: 'PENDING' }), 'workflow_sha not hex');
});
test('scoped token kind: sbp_fc only', () => {
  assert.ok(SCOPED_TOKEN_RE.test(FAKE_TOKEN));
  assert.ok(!SCOPED_TOKEN_RE.test(`sbp_${'a'.repeat(40)}`));
});

test('malformed Authorization header is refused BEFORE the JWKS is fetched (no outbound call at all)', async () => {
  const good = await validJwt();
  for (const hv of [null, '', 'Basic Zm9vOmJhcg==', `bearer ${good}`, `Bearer ${good} x`, 'Bearer a.b', 'Bearer a..c', 'Bearer ...', `Bearer ${good}.d`, `Bearer ${'a'.repeat(9000)}.b.c`, 'Bearer a.b.c=', `Token ${good}`]) {
    let jwksCalls = 0;
    const w = await world({ jwks: async () => { jwksCalls += 1; return JWKS; } });
    const r = await call(w, req({ jwt: null, body: bodyOf(), headers: hv === null ? {} : { authorization: hv } }));
    assert.equal(r.status, 401, String(hv).slice(0, 20)); assert.equal(jwksCalls, 0, `JWKS fetched for ${String(hv).slice(0, 20)}`);
    assertNoCredentialRead(w);
  }
  assert.throws(() => parseBearer('Bearer a.b')); assert.deepEqual(parseBearer('Bearer a.b.c'), ['a', 'b', 'c']);
  let jwksCalls = 0;
  const w = await world({ jwks: async () => { jwksCalls += 1; return JWKS; }, token: undefined });
  await call(w, req({ jwt: good, body: bodyOf() }));
  assert.equal(jwksCalls, 1, 'a well-formed header fetches the JWKS exactly once');
});
