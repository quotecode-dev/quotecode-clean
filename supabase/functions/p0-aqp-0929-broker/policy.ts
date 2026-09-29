// p0-aqp-0929-broker / policy.ts - ALL broker logic. PURE: no Deno globals, no module-level I/O, no clock, no env access.
// Everything external arrives through `deps` ({ fetch, env, now, jwks, bundle, log? }); only web-standard globals are used
// (crypto.subtle, TextEncoder/TextDecoder, atob/btoa, AbortSignal.timeout, Request/Response). index.ts is wiring only.
//
// What this function is: the ONE protected execution channel for the Production run of migration 20260929000000
// (drop legacy public.approve_quote_public overloads). It is called exactly once by the GitHub Actions workflow
// .github/workflows/p0-aqp-0929-production-migration.yml (Environment production-migration-0929, workflow_dispatch only).
//
// Order of operations (every step fails closed; nothing after a failed step runs):
//   1. request shape: POST, application/json, Content-Length / body size cap.
//   2. GitHub OIDC: RS256 only, kid in GitHub's JWKS (fixed URL), WebCrypto signature, iss / aud / immutable sub / exp-nbf-iat-age,
//      repository + immutable repository / owner ids, refs/heads/main, workflow_ref, Environment, workflow_dispatch,
//      github-hosted runner, run_attempt 1. Unauthenticated callers get only { state: REFUSED, reason: UNAUTHENTICATED }.
//   3. deploy-time pins: env P0_AQP_0929_DEPLOY_PINS (strict JSON, closed keys, strict hex; PENDING / missing -> refuse everything);
//      the OIDC workflow_sha must equal the pinned workflowSha.
//   4. the embedded Production bundle: META READY, sha256 recomputed at runtime == bundle.ts constant == code pin, structure.
//   5. body: closed keys {authorization, testReport}; base64 of the exact artifact bytes; nothing else (no SQL/ref/target/url/...).
//   6. artifacts: sha256(bytes) == deploy pins; authorization v3 + TEST report /2 verified independently (TypeScript port of the
//      tooling verifier aqp-authorization-lib.js, B5 HASHING_RULE); freshness / ordering; bindings to every code + deploy pin.
//   7. ONLY NOW the credential env P0_AQP_0929_SUPABASE_DB_TOKEN is read (kind check: scoped sbp_fc token; scope is proven at
//      provisioning). Env access is allowlisted to exactly these two names.
//   8. one-shot DB phase against the FIXED Management API endpoint (never a caller value), body exactly {"query": <sql>}:
//        a. read-only pre-check (one SELECT): one-shot row PENDING, 0929 not on the ledger, exact Production pre-state ledger/overloads;
//        b. CAS: UPDATE ... SET state='RUNNING' WHERE release_key=<hex> AND state='PENDING' RETURNING ... (clean 0 rows -> REFUSED;
//           anything but the one expected row -> UNKNOWN / 502 CAS_AMBIGUOUS; in both cases the bundle is never sent);
//        c. exactly ONE bundle POST (never retried);
//        d. read-only read-back (one SELECT) decides APPLIED / NOT_APPLIED / UNKNOWN (timeout/network/5xx/unparseable -> UNKNOWN;
//           NOT_APPLIED only for a rollback-proving error code (BUNDLE_ROLLBACK_TK_CODES / 55P03 / 57014) + unchanged pre-state);
//        e. best-effort terminal UPDATE (RUNNING -> terminal). If it fails the row stays RUNNING, which every reader treats as UNKNOWN.
//   9. response: sanitized { state, reason, releaseKey, bundleSha256, authorizationSha256, testReportSha256, deployPinsSha256,
//      terminalRecorded, code? (a TK_* code or 55P03 / 57014) }. Never an upstream body, token, SQL, row, claim value or artifact content.

// ===================================================================================================================================
// Constants and pins
// ===================================================================================================================================
export const PENDING = 'PENDING';
export const HEX40 = /^[0-9a-f]{40}$/;
export const HEX64 = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
export const GITHUB_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks';
export const MANAGEMENT_API_ORIGIN = 'https://api.supabase.com';
export const MANAGEMENT_API_QUERY_URL = 'https://api.supabase.com/v1/projects/ixabnzhjeqevtbhdfswv/database/query';
export const DEPLOY_PINS_ENV = 'P0_AQP_0929_DEPLOY_PINS';
export const DB_TOKEN_ENV = 'P0_AQP_0929_SUPABASE_DB_TOKEN';
export const DEPLOY_PIN_KEYS = Object.freeze(['workflowSha', 'executorCommit', 'authorizationSha256', 'testReportSha256']);
export const ONESHOT_TABLE = 'tekango_release_ops.p0_aqp_0929_oneshot';
export const LEDGER_TABLE = 'supabase_migrations.schema_migrations';

// Build-time code pins. productionBundleSha256 stays PENDING until B6 generates the real Production bundle from a fresh Production
// pre-state capture; while PENDING the broker refuses every request (BROKER_NOT_READY).
export const CODE_PINS = Object.freeze({
  releaseId: 'tekango-p0-aqp-remediation-2026-09-29',
  repository: 'quotecode-dev/quotecode-clean',
  repositoryId: '1332524138',
  repositoryOwner: 'quotecode-dev',
  repositoryOwnerId: '309962619',
  ref: 'refs/heads/main',
  workflowPath: '.github/workflows/p0-aqp-0929-production-migration.yml',
  environment: 'production-migration-0929',
  oidcAudience: 'tekango-p0-aqp-0929-broker',
  candidateCommit: '623ac1ee01995b071b5f0d9a8f3d6f1cef87cc23',
  migrationVersion: '20260929000000',
  migrationFile: '20260929000000_drop_legacy_approve_quote_public.sql',
  migrationName: 'drop_legacy_approve_quote_public',
  migrationSha256: '7c9c1fb54e7ce99896b9ba49f17b0608c686c340faa65ecefbb78ef949929ef4',
  profileId: 'aqp-drop-20260929000000',
  productionRef: 'ixabnzhjeqevtbhdfswv',
  testRef: 'ljfizgrdyzxddswcedwr',
  testRegistrySha256: '242678137ee6b341c0b1dad13844bc44e49ebd5630a4e42ad0871dd8c756a667',
  sessionCheckSha256: '851951309cccb8a7f2007d10355e5b62a588d3ad85ec68f6cd7dfde9bb487e57',
  productionBundleSha256: PENDING as string, // PENDING until B6 generates the real bundle from a fresh Production pre-state
  atomicityProbeBundle: Object.freeze({ name: '00-atomicity-probe.sql', sha256: '5270596f53def403a2a2c8dbbb506a577f8c9956a7ccb06b41010aa94d45fd11' }),
  testSteps: Object.freeze([
    Object.freeze({ step: 1, version: '20260917000000', file: '20260917000000_prod_forward_professional_quote_items_stage_a.sql', fileSha256: 'f59279ba858c026cd99e3f5ccbc6b13efa33453c2a36fd4d61521f585824462f', bundleName: '01-20260917000000.sql', bundleSha256: '5b5c62a0b383452cb673a7eec13c7fec5fab0bdcb3d127fc8c3a09e1229a1458' }),
    Object.freeze({ step: 2, version: '20260917000001', file: '20260917000001_prod_forward_business_professional_domain.sql', fileSha256: 'eddfa64b9b3f3592fad4a5cdacb4472d4a523740d0f5d654842e80d9ff7998b1', bundleName: '02-20260917000001.sql', bundleSha256: '901f93f8c671bdb5257aa35e3a457aab8b6f159812b377bb41cf32d268dfeb5b' }),
    Object.freeze({ step: 3, version: '20260917000002', file: '20260917000002_prod_forward_professional_quote_hierarchy.sql', fileSha256: 'ef3e1ac26256005a9ec9431e190f2ab31132fbe7f43168de08d079ca267d20e4', bundleName: '03-20260917000002.sql', bundleSha256: 'f311c13020ac93ccec5926297a9687ddaf96c9f457f68e75ab5bba5c772e088b' }),
    Object.freeze({ step: 4, version: '20260917000003', file: '20260917000003_prod_forward_save_quote_structured_atomic_function.sql', fileSha256: '5185f19b75dcde35eddbb4a4a4746139aef2f03939ee14965762ed904dc439af', bundleName: '04-20260917000003.sql', bundleSha256: 'fc9aaf993af6858323f6e669b15fe3b0ac5005a7fc4a0f2ec3438ff01330d0dc' }),
    Object.freeze({ step: 5, version: '20260927000000', file: '20260927000000_trial_reminder_delivery_claims.sql', fileSha256: '97d2017ed55ce06ca4683973adc69e48372d87a74e9c60e5a26d8b3a60a1d729', bundleName: '05-20260927000000.sql', bundleSha256: 'e81fe1323387bd4ff82ac32dd8b01832aeb0ec18d7c6844e7705354a6004d0aa' }),
    Object.freeze({ step: 6, version: '20260929000000', file: '20260929000000_drop_legacy_approve_quote_public.sql', fileSha256: '7c9c1fb54e7ce99896b9ba49f17b0608c686c340faa65ecefbb78ef949929ef4', bundleName: '06-20260929000000.sql', bundleSha256: '9da76c2d2ad568b8d5e0134bc939cfff1187e324f36c77f04057e8241b696417' }),
  ]),
  // Production ledger BEFORE 0929 (AQP profile preApplyLedger: 14 rows ending 20260927000000) and the legacy overloads it must drop.
  productionPreApplyLedger: Object.freeze(['20260827000000', '20260827000001', '202608270000015', '20260827000002', '20260827000003', '20260828000000', '20260831000000', '20260908000000', '20260917000000', '20260917000001', '20260917000002', '20260917000003', '20260922000000', '20260927000000']),
  legacyOverloads: Object.freeze(['approve_quote_public(uuid)', 'approve_quote_public(uuid, text)']),
});
export type CodePins = typeof CODE_PINS;

// OIDC policy (GitHub Actions). The immutable subject format is enabled on the repository (R8 read-back of
// /actions/oidc/customization/sub: use_immutable_subject=true, prefix repo:quotecode-dev@309962619/quotecode-clean@1332524138).
export const OIDC_SKEW_SEC = 60; // tolerance for exp / nbf / iat against the broker clock
export const OIDC_MAX_AGE_SEC = 300; // the workflow requests the token immediately before the single broker call
export const OIDC_MAX_LIFETIME_SEC = 3600; // exp - iat sanity bound (GitHub issues short-lived tokens)
export const JWT_MAX_CHARS = 8192;
export const BODY_MAX_BYTES = 256 * 1024;
export const ARTIFACT_MAX_BYTES = 96 * 1024;
export const UPSTREAM_READ_MAX_BYTES = 256 * 1024;
export const AUTH_MAX_VALIDITY_MS = 72 * 3600 * 1000;
export const AUTH_MAX_AGE_MS = 72 * 3600 * 1000;
export const REPORT_MAX_AGE_MS = 72 * 3600 * 1000;
export const FUTURE_SKEW_MS = 0;
// Time budget. Edge Functions have a 150 s request idle timeout (Supabase limits), so every outbound call carries its own
// AbortSignal.timeout and the whole request is bounded: jwks 5 + precheck 8 + cas 8 + bundle 95 + readback 10 + terminal 8 = 134 s.
// The CAS is only attempted while at most PRE_CAS_DEADLINE_MS have elapsed (so the bundle always keeps its full budget); after the
// bundle the read-back / terminal calls get min(own timeout, what is left of REQUEST_BUDGET_MS) (>= 1 s). The bundle itself
// carries lock_timeout 5 s / statement_timeout 120 s; a client-side abort is classified UNKNOWN and never retried.
export const TIMEOUTS_MS = Object.freeze({ jwks: 5_000, precheck: 8_000, cas: 8_000, bundle: 95_000, readback: 10_000, terminal: 8_000 });
export const PRE_CAS_DEADLINE_MS = 25_000;
export const REQUEST_BUDGET_MS = 140_000;
// The ONLY environment variables the broker may read (enforced by readEnv here and by the allowlist in index.ts).
export const ALLOWED_ENV: readonly string[] = Object.freeze(['P0_AQP_0929_DEPLOY_PINS', 'P0_AQP_0929_SUPABASE_DB_TOKEN']);

// Claims that must be present with exactly these string values. workflow_sha is checked separately against the deploy pin.
// job_workflow_ref / job_workflow_sha / sha / ref_protected are documented only for some cases: NOT required, but when present
// they must be consistent (job_workflow_ref == workflow_ref, job_workflow_sha == sha == workflow_sha, ref_protected == "true").
export function expectedOidcClaims(pins: CodePins): Record<string, string> {
  const workflowRef = `${pins.repository}/${pins.workflowPath}@${pins.ref}`;
  return {
    iss: GITHUB_ISSUER,
    aud: pins.oidcAudience,
    sub: `repo:${pins.repositoryOwner}@${pins.repositoryOwnerId}/${pins.repository.split('/')[1]}@${pins.repositoryId}:environment:${pins.environment}`,
    repository: pins.repository,
    repository_id: pins.repositoryId,
    repository_owner: pins.repositoryOwner,
    repository_owner_id: pins.repositoryOwnerId,
    ref: pins.ref,
    ref_type: 'branch',
    workflow_ref: workflowRef,
    environment: pins.environment,
    event_name: 'workflow_dispatch',
    runner_environment: 'github-hosted',
    run_attempt: '1',
  };
}

// ===================================================================================================================================
// Small helpers
// ===================================================================================================================================
const enc = new TextEncoder();
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const own = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);
function exactKeys(o: unknown, keys: readonly string[]): o is Obj {
  if (!isObj(o)) return false;
  const ks = Object.keys(o);
  return ks.length === keys.length && keys.every((k) => own(o, k));
}
function hex(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of u) s += b.toString(16).padStart(2, '0');
  return s;
}
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}
const sha256Text = (s: string) => sha256Hex(enc.encode(s));
const isPendingish = (v: unknown) => typeof v !== 'string' || v === '' || v === PENDING;

function nowMs(deps: BrokerDeps): number {
  const n = deps.now();
  const ms = n instanceof Date ? n.getTime() : n;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new BrokerRefusal('BROKER_NOT_READY', 'clock');
  return ms;
}

// Strict base64url (JWT segments): no padding, alphabet only.
function b64urlToBytes(s: string): Uint8Array | null {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  let bin: string;
  try { bin = atob(b64); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
// Strict standard base64 (RFC 4648, '=' padding, no whitespace), canonical (re-encoding must reproduce the input).
export function b64StdToBytes(s: unknown): Uint8Array | null {
  if (typeof s !== 'string' || s.length === 0 || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  let bin: string;
  try { bin = atob(s); } catch { return null; }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  let again = '';
  for (let i = 0; i < out.length; i += 0x8000) again += String.fromCharCode(...out.subarray(i, i + 0x8000));
  if (btoa(again) !== s) return null;
  return out;
}
function decodeJsonSegment(seg: string): Obj | null {
  const b = b64urlToBytes(seg);
  if (!b) return null;
  let v: unknown;
  try { v = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b)); } catch { return null; }
  return isObj(v) ? v : null;
}

// ===================================================================================================================================
// Errors / responses
// ===================================================================================================================================
export class BrokerRefusal extends Error {
  code: string;
  detail: string;
  constructor(code: string, detail = '') { super(code); this.code = code; this.detail = detail; }
}
const HTTP_FOR: Record<string, number> = {
  METHOD_NOT_ALLOWED: 405, UNSUPPORTED_MEDIA_TYPE: 415, BODY_TOO_LARGE: 413, BROKER_NOT_READY: 503, UNAUTHENTICATED: 401,
  BODY_SHAPE: 400, ARTIFACT_PIN_MISMATCH: 403, AUTHORIZATION_INVALID: 403, TEST_REPORT_INVALID: 403, NO_CREDENTIAL: 503,
  CREDENTIAL_FORMAT: 503, PRECHECK_FAILED: 409, ONESHOT_NOT_PENDING: 409, LEDGER_PRESENT: 409, PRESTATE_DRIFT: 409,
  CAS_REFUSED: 409, DEADLINE: 503, INTERNAL: 500,
};
type Hashes = { releaseKey?: string; bundleSha256?: string; authorizationSha256?: string; testReportSha256?: string; deployPinsSha256?: string };
export type BrokerState = 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN' | 'REFUSED';
function respond(status: number, state: BrokerState, reason: string, hashes: Hashes = {}, extra: Obj = {}): Response {
  const body: Obj = { state, reason };
  for (const k of ['releaseKey', 'bundleSha256', 'authorizationSha256', 'testReportSha256', 'deployPinsSha256'] as const) if (typeof hashes[k] === 'string' && HEX64.test(hashes[k] as string)) body[k] = hashes[k];
  for (const [k, v] of Object.entries(extra)) if (typeof v === 'boolean' || (typeof v === 'string' && /^[A-Za-z0-9_.:-]{0,64}$/.test(v))) body[k] = v;
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// ===================================================================================================================================
// Deps
// ===================================================================================================================================
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
// Defense in depth for index.ts: a fetch that can only ever reach ONE fixed URL (any other URL rejects without a network call).
export function pinnedFetch(fetchFn: FetchFn, allowedUrl: string): FetchFn {
  return (url: string, init: RequestInit) => (url === allowedUrl ? fetchFn(url, init) : Promise.reject(new Error('pinned-fetch: URL not allowed')));
}
export interface ProductionBundle {
  PRODUCTION_BUNDLE_SQL: string;
  PRODUCTION_BUNDLE_SHA256: string;
  PRODUCTION_BUNDLE_META: Obj;
}
export interface BrokerDeps {
  fetch: FetchFn;
  env: (name: string) => string | undefined;
  now: () => number | Date;
  jwks: () => Promise<unknown>;
  bundle: ProductionBundle;
  log?: (rec: Record<string, string | number | boolean>) => void;
}
// Env access is allowlisted: the broker can never read SUPABASE_DB_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY or any other name.
function readEnv(deps: BrokerDeps, name: string): string | undefined {
  if (!ALLOWED_ENV.includes(name)) throw new BrokerRefusal('INTERNAL', 'env-not-allowed');
  try { const v = deps.env(name); return typeof v === 'string' ? v : undefined; } catch { return undefined; }
}
function safeLog(deps: BrokerDeps, rec: Record<string, string | number | boolean>) {
  try { deps.log?.(rec); } catch { /* logging never changes the outcome */ }
}

// ===================================================================================================================================
// 2. Server configuration: deploy pins + embedded bundle
// ===================================================================================================================================
export type DeployPins = { workflowSha: string; executorCommit: string; authorizationSha256: string; testReportSha256: string };
export function parseDeployPins(text: unknown): DeployPins {
  if (typeof text !== 'string' || text.trim() === '') throw new BrokerRefusal('BROKER_NOT_READY', 'deploy-pins-missing');
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new BrokerRefusal('BROKER_NOT_READY', 'deploy-pins-json'); }
  if (!exactKeys(v, DEPLOY_PIN_KEYS)) throw new BrokerRefusal('BROKER_NOT_READY', 'deploy-pins-keys');
  const fmt: Record<string, RegExp> = { workflowSha: HEX40, executorCommit: HEX40, authorizationSha256: HEX64, testReportSha256: HEX64 };
  for (const k of DEPLOY_PIN_KEYS) {
    const x = v[k];
    if (isPendingish(x) || !fmt[k].test(x as string)) throw new BrokerRefusal('BROKER_NOT_READY', `deploy-pin-${k}`);
  }
  return Object.freeze({ workflowSha: v.workflowSha as string, executorCommit: v.executorCommit as string, authorizationSha256: v.authorizationSha256 as string, testReportSha256: v.testReportSha256 as string });
}

const ledgerArrayLiteral = (versions: readonly string[]) => `ARRAY[${versions.map((x) => `'${x}'`).join(',')}]::text[]`;
// executorCommit = the deploy pin: the embedded bundle must declare that it was generated by exactly that tooling commit
// (PRODUCTION_BUNDLE_META.generatorCommit, 40-hex; "PENDING" / missing / different -> BROKER_NOT_READY).
export async function checkBundle(bundle: unknown, pins: CodePins, executorCommit: string): Promise<string> {
  const fail = (d: string): never => { throw new BrokerRefusal('BROKER_NOT_READY', `bundle-${d}`); };
  if (!isObj(bundle)) fail('missing');
  const b = bundle as unknown as ProductionBundle;
  const sql = b.PRODUCTION_BUNDLE_SQL; const declared = b.PRODUCTION_BUNDLE_SHA256; const meta = b.PRODUCTION_BUNDLE_META;
  if (typeof sql !== 'string' || typeof declared !== 'string' || !isObj(meta)) fail('shape');
  if (meta.status !== 'READY') fail('status');
  if (typeof meta.generatorCommit !== 'string' || !HEX40.test(meta.generatorCommit) || typeof executorCommit !== 'string' || !HEX40.test(executorCommit) || meta.generatorCommit !== executorCommit) fail('generator-commit');
  if (isPendingish(pins.productionBundleSha256) || !HEX64.test(pins.productionBundleSha256)) fail('code-pin-pending');
  if (!HEX64.test(declared)) fail('declared-sha');
  const actual = await sha256Text(sql);
  if (actual !== declared || actual !== pins.productionBundleSha256) fail('sha-mismatch');
  if (meta.targetKind !== 'PRODUCTION' || meta.targetRef !== pins.productionRef || meta.profileId !== pins.profileId
    || meta.migrationSha256 !== pins.migrationSha256 || meta.migrationFile !== pins.migrationFile || meta.candidateCommit !== pins.candidateCommit) fail('meta');
  // Structural regression checks (the tooling builder + its tests are authoritative; this is an independent runtime tripwire).
  if (sql.includes('\r') || /^\s*\\/m.test(sql)) fail('psql-meta-or-cr');
  if (sql.includes(pins.testRef)) fail('test-ref');
  if (!sql.startsWith('BEGIN ISOLATION LEVEL READ COMMITTED;\nSET LOCAL search_path = pg_catalog, pg_temp;\n')) fail('begin');
  if (!sql.endsWith('\nCOMMIT;\n')) fail('commit');
  const count = (needle: string) => sql.split(needle).length - 1;
  if (count(`INSERT INTO ${LEDGER_TABLE} (version, name, statements) VALUES ('${pins.migrationVersion}', '${pins.migrationName}', ARRAY[`) !== 1) fail('ledger-insert');
  if (count(`INSERT INTO ${LEDGER_TABLE}`) !== 1) fail('ledger-insert-count');
  if (!sql.includes('TK_REPLAY_REFUSED') || !sql.includes('TK_PRESTATE_DRIFT') || !sql.includes('TK_POSTCONDITION')) fail('guards');
  if (!sql.includes(ledgerArrayLiteral(pins.productionPreApplyLedger))) fail('prestate-ledger');
  if (!sql.includes(`LOCK TABLE ${LEDGER_TABLE} IN SHARE ROW EXCLUSIVE MODE;`)) fail('lock');
  return actual;
}

// ===================================================================================================================================
// 3. GitHub OIDC verification (before anything caller-supplied is trusted, before the credential is touched)
// ===================================================================================================================================
const FORBIDDEN_JOSE_HEADERS = ['jku', 'jwk', 'x5u', 'x5c', 'crit', 'b64', 'enc', 'zip', 'epk', 'p2s', 'p2c'];
// Cheap shape gate, run BEFORE the JWKS is fetched: "Bearer " + exactly three non-empty base64url segments, size-capped.
// A malformed request never causes an outbound call.
export function parseBearer(authHeader: string | null): [string, string, string] {
  if (typeof authHeader !== 'string' || authHeader.length > JWT_MAX_CHARS + 7) throw new BrokerRefusal('UNAUTHENTICATED', 'oidc-header');
  const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(authHeader);
  if (!m) throw new BrokerRefusal('UNAUTHENTICATED', 'oidc-bearer-shape');
  return [m[1], m[2], m[3]];
}
export async function verifyGithubOidc(authHeader: string | null, jwksDoc: unknown, nowSec: number, expected: Record<string, string>): Promise<Obj> {
  const fail = (d: string): never => { throw new BrokerRefusal('UNAUTHENTICATED', `oidc-${d}`); };
  const [h64, p64, s64] = parseBearer(authHeader);
  const header = decodeJsonSegment(h64); const payload = decodeJsonSegment(p64); const sig = b64urlToBytes(s64);
  if (!header || !payload || !sig || sig.length === 0) fail('decode');
  const hdr = header as Obj;
  if (hdr.alg !== 'RS256') fail('alg');
  if (typeof hdr.kid !== 'string' || hdr.kid.length === 0 || hdr.kid.length > 256) fail('kid');
  if (own(hdr, 'typ') && hdr.typ !== 'JWT') fail('typ');
  for (const k of FORBIDDEN_JOSE_HEADERS) if (own(hdr, k)) fail(`header-${k}`);
  // key selection: exactly one RSA signing key with this kid in GitHub's JWKS
  const keys = isObj(jwksDoc) && Array.isArray(jwksDoc.keys) ? jwksDoc.keys : null;
  if (!keys) fail('jwks');
  const cands = (keys as unknown[]).filter((k) => isObj(k) && k.kid === hdr.kid);
  if (cands.length !== 1) fail('unknown-kid');
  const jwk = cands[0] as Obj;
  if (jwk.kty !== 'RSA' || (own(jwk, 'use') && jwk.use !== 'sig') || (own(jwk, 'alg') && jwk.alg !== 'RS256')) fail('jwk-type');
  const nBytes = typeof jwk.n === 'string' ? b64urlToBytes(jwk.n) : null;
  if (!nBytes || nBytes.length < 256 || typeof jwk.e !== 'string' || !b64urlToBytes(jwk.e)) fail('jwk-params');
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n as string, e: jwk.e as string, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  } catch { return fail('jwk-import'); }
  let ok = false;
  try { ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, sig as BufferSource, enc.encode(`${h64}.${p64}`) as BufferSource); } catch { ok = false; }
  if (!ok) fail('signature');
  const c = payload as Obj;
  // time claims: numeric seconds, small skew, bounded age and lifetime
  for (const k of ['exp', 'iat', 'nbf']) if (typeof c[k] !== 'number' || !Number.isInteger(c[k])) fail(`${k}-type`);
  const exp = c.exp as number; const iat = c.iat as number; const nbf = c.nbf as number;
  if (nowSec >= exp + OIDC_SKEW_SEC) fail('expired');
  if (nbf > nowSec + OIDC_SKEW_SEC) fail('nbf');
  if (iat > nowSec + OIDC_SKEW_SEC) fail('iat-future');
  if (nowSec - iat > OIDC_MAX_AGE_SEC) fail('too-old');
  if (exp <= iat || exp - iat > OIDC_MAX_LIFETIME_SEC) fail('lifetime');
  // identity claims: exact string equality (aud must be the single custom audience string, not an array)
  for (const [k, v] of Object.entries(expected)) if (typeof c[k] !== 'string' || c[k] !== v) fail(`claim-${k}`);
  if (typeof c.workflow_sha !== 'string' || !HEX40.test(c.workflow_sha)) fail('claim-workflow_sha');
  if (own(c, 'job_workflow_ref') && c.job_workflow_ref !== c.workflow_ref) fail('claim-job_workflow_ref');
  if (own(c, 'job_workflow_sha') && c.job_workflow_sha !== c.workflow_sha) fail('claim-job_workflow_sha');
  if (own(c, 'sha') && c.sha !== c.workflow_sha) fail('claim-sha');
  if (own(c, 'ref_protected') && c.ref_protected !== 'true' && c.ref_protected !== true) fail('claim-ref_protected');
  return c;
}

// GitHub JWKS loader used by index.ts. Fixed URL; no redirects; timeout; size cap; strict JSON object with a keys array.
export function makeGithubJwksLoader(fetchFn: FetchFn) {
  return async (): Promise<unknown> => {
    const res = await fetchFn(GITHUB_JWKS_URL, { method: 'GET', redirect: 'error', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUTS_MS.jwks) });
    if (res.status !== 200) throw new BrokerRefusal('UNAUTHENTICATED', 'jwks-status');
    const text = await readCapped(res, 64 * 1024);
    if (text === null) throw new BrokerRefusal('UNAUTHENTICATED', 'jwks-size');
    const v = JSON.parse(text);
    if (!isObj(v) || !Array.isArray(v.keys)) throw new BrokerRefusal('UNAUTHENTICATED', 'jwks-shape');
    return v;
  };
}

async function readCapped(res: Response, cap: number): Promise<string | null> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > cap) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(n); let o = 0;
  for (const ch of chunks) { all.set(ch, o); o += ch.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(all); } catch { return null; }
}
async function readBodyCapped(req: Request, cap: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > cap) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(n); let o = 0;
  for (const ch of chunks) { all.set(ch, o); o += ch.byteLength; }
  return all;
}

// ===================================================================================================================================
// 4. Body: closed keys, base64 of the exact artifact bytes
// ===================================================================================================================================
export const BODY_KEYS = Object.freeze(['authorization', 'testReport']);
export function parseBody(raw: Uint8Array): { authorizationBytes: Uint8Array; testReportBytes: Uint8Array } {
  const fail = (d: string): never => { throw new BrokerRefusal('BODY_SHAPE', `body-${d}`); };
  let text = '';
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); } catch { fail('utf8'); }
  if (text.charCodeAt(0) === 0xfeff) fail('bom');
  let v: unknown;
  try { v = JSON.parse(text); } catch { return fail('json'); }
  if (!isObj(v)) fail('not-object');
  const o = v as Obj;
  // closed key set: anything else (sql, query, ref, projectRef, target, bundle, url, endpoint, token, credential, ...) is refused
  if (!exactKeys(o, BODY_KEYS)) fail('keys');
  const a = b64StdToBytes(o.authorization); const r = b64StdToBytes(o.testReport);
  if (!a || !r) fail('base64');
  if ((a as Uint8Array).length > ARTIFACT_MAX_BYTES || (r as Uint8Array).length > ARTIFACT_MAX_BYTES) fail('artifact-size');
  return { authorizationBytes: a as Uint8Array, testReportBytes: r as Uint8Array };
}

// ===================================================================================================================================
// 5. Artifacts (mirror of aqp-authorization-lib.js; B5 HASHING_RULE.md)
// ===================================================================================================================================
// Independent TypeScript port of the tooling verifier (C:\tkrtool-iron\scripts\mirror\aqp-authorization-lib.js, B5) and its
// HASHING_RULE: identical constants, canonical JSON rule, secret scanner, closed key sets, pins and freshness/order rules.
// Error texts never echo artifact values; the handler maps any error to a constant refusal code.
export const AUTH_SCHEMA = 'tekango-migration-authorization/3';
export const TEST_REPORT_SCHEMA = 'tekango-aqp-test-verification/2';
export const TEST_REGISTRY_SCHEMA = 'tekango-test-migration-registry/2';
export const TEST_RUN_SCHEMA = 'tekango-test-migration-run/2';
export const OWNER_TEXT_MAX = 4000;
export const AUTH_SCOPE = 'APPLY_ONE_MIGRATION_TO_PRODUCTION_VIA_BROKER';
export const INITIAL_LEDGER_COUNT = 17;
const PROBE_OUTCOME = 'PROBE_ATOMIC';
const PROBE_TK_CODE = 'TK_TXN_PROBE';
export const BUILD_PIN_KEYS = Object.freeze(['releaseId', 'repository', 'repositoryId', 'repositoryOwner', 'repositoryOwnerId', 'ref', 'workflowPath', 'environment', 'oidcAudience',
  'candidateCommit', 'migrationVersion', 'migrationFile', 'migrationSha256', 'productionRef', 'testRef', 'testRegistrySha256', 'sessionCheckSha256', 'productionBundleSha256']);
const STEP_PIN_KEYS = Object.freeze(['step', 'version', 'file', 'fileSha256', 'bundleName', 'bundleSha256']);
export const AUTH_KEYS = Object.freeze(['schema', 'authorizedBy', 'scope', 'releaseId', 'ownerDecisionText', 'ownerDecisionTextSha256', 'bindings', 'issuedAt', 'expiresAt', 'oneShot', 'forwardFixPermitted']);
export const AUTH_BINDING_KEYS = Object.freeze(['repository', 'repositoryId', 'repositoryOwner', 'repositoryOwnerId', 'ref', 'workflowPath', 'workflowSha', 'environment', 'oidcAudience',
  'candidateCommit', 'migrationVersion', 'migrationFile', 'migrationSha256', 'productionRef', 'productionBundleSha256', 'executorCommit', 'testRegistrySha256', 'testReportSha256']);
export const REPORT_KEYS = Object.freeze(['schema', 'verdict', 'target', 'migration', 'registry', 'sessionCheckSqlSha256', 'atomicityProbe', 'testRun', 'aqpVerify', 'ledger', 'finalTestCaptureAt', 'generator']);
const REPORT_TARGET_KEYS = ['env', 'ref'];
const REPORT_MIGRATION_KEYS = ['version', 'file', 'sha256', 'candidateCommit'];
const REPORT_REGISTRY_KEYS = ['schema', 'sha256', 'sourceCommit', 'targetRef', 'initialLedgerCount'];
const REPORT_PROBE_KEYS = ['bundleName', 'bundleSha256'];
const REPORT_TESTRUN_KEYS = ['runSchema', 'toolingCommit', 'runs', 'steps'];
const REPORT_RUN_KEYS = ['evidenceSha256', 'runUtc', 'probe', 'steps'];
const REPORT_RUN_PROBE_KEYS = ['outcome', 'tkCode', 'postCaptureSha256', 'postSessionSha256'];
const REPORT_STEP_KEYS = [...STEP_PIN_KEYS, 'outcome', 'runEvidenceSha256', 'preLedgerCount', 'postLedgerCount', 'postCaptureSha256', 'postSessionSha256'];
const REPORT_AQP_KEYS = ['verdict', 'checksTotal', 'beforeCaptureSha256', 'afterCaptureSha256', 'beforeCollectedAt', 'afterCollectedAt'];
const REPORT_LEDGER_KEYS = ['captureSha256', 'collectedAt', 'projectRef', 'rowCount', 'migrationRow'];
const REPORT_LEDGER_ROW_KEYS = ['version', 'name', 'nStatements', 'statementsSha256', 'stmt1Sha256'];
const REPORT_GENERATOR_KEYS = ['toolingCommit', 'clean'];
const PLACEHOLDER_RE = /\{\{|\}\}|\bTODO\b|\bTBD\b|PLACEHOLDER|\bPENDING\b/i;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z$/;

export function parseIsoStrict(s: unknown): number {
  if (typeof s !== 'string') return NaN;
  const m = ISO_RE.exec(s); if (!m) return NaN;
  const [y, mo, d, h, mi, se] = m.slice(1, 7).map(Number); const ms = m[7] ? Number(m[7]) : 0;
  const t = Date.UTC(y, mo - 1, d, h, mi, se, ms); const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || dt.getUTCHours() !== h || dt.getUTCMinutes() !== mi || dt.getUTCSeconds() !== se) return NaN;
  return t;
}

// Canonical JSON (B5 HASHING_RULE section 1): sorted keys (UTF-16 code-unit order), 2-space indent, `": "`, LF, one trailing LF,
// safe integers only, strings via JSON.stringify, no undefined / lone surrogates / other types.
export function canonicalJson(value: unknown): string {
  const ser = (v: unknown, ind: string): string => {
    if (v === null) return 'null';
    if (v === true) return 'true';
    if (v === false) return 'false';
    if (typeof v === 'number') { if (!Number.isSafeInteger(v) || Object.is(v, -0)) throw new TypeError('canonicalJson: only safe integers are allowed'); return String(v); }
    if (typeof v === 'string') { if (LONE_SURROGATE_RE.test(v)) throw new TypeError('canonicalJson: lone surrogate'); return JSON.stringify(v); }
    const ind2 = `${ind}  `;
    if (Array.isArray(v)) return v.length === 0 ? '[]' : `[\n${v.map((x) => `${ind2}${ser(x, ind2)}`).join(',\n')}\n${ind}]`;
    if (isObj(v)) {
      const keys = Object.keys(v).sort();
      if (keys.length === 0) return '{}';
      return `{\n${keys.map((k) => { if (LONE_SURROGATE_RE.test(k)) throw new TypeError('canonicalJson: lone surrogate'); return `${ind2}${JSON.stringify(k)}: ${ser(v[k], ind2)}`; }).join(',\n')}\n${ind}}`;
    }
    throw new TypeError(`canonicalJson: unsupported value type ${typeof v}`);
  };
  return `${ser(value, '')}\n`;
}

// B5 HASHING_RULE section 2: fatal UTF-8, no BOM, JSON object, bytes === canonicalJson(value); sha256 over the RECEIVED bytes.
export async function decodeCanonicalArtifact(bytes: Uint8Array, label: string): Promise<{ ok: true; value: Obj; sha256: string } | { ok: false; errors: string[] }> {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return { ok: false, errors: [`${label}: not valid UTF-8`] }; }
  if (text.charCodeAt(0) === 0xfeff) return { ok: false, errors: [`${label}: a byte-order mark is not allowed`] };
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { ok: false, errors: [`${label}: not valid JSON`] }; }
  if (!isObj(value)) return { ok: false, errors: [`${label}: not a JSON object`] };
  let canon: string;
  try { canon = canonicalJson(value); } catch { return { ok: false, errors: [`${label}: not canonicalizable`] }; }
  if (canon !== text) return { ok: false, errors: [`${label}: bytes are not the canonical serialization`] };
  return { ok: true, value, sha256: await sha256Hex(bytes) };
}

// Secret- / customer-shaped content scanner (same patterns as the tooling). Returns [{ path, kind }], never the value.
const SECRET_PATTERNS: [string, RegExp][] = [
  ['jwt', /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/],
  ['supabase-token', /\bsbp_[A-Za-z0-9]{8,}|\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/i],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,})/],
  ['aws-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['bearer', /\bBearer\s+[A-Za-z0-9._~+/-]{8,}/i],
  ['credential-assignment', /\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|token)\s*[:=]\s*\S+/i],
  ['url-credentials', /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i],
  ['db-url', /\bpostgres(?:ql)?:\/\//i],
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ['phone-like', /\+\d[\d\s().-]{6,}\d|\b\d{2,4}[\s.-]\d{3,4}[\s.-]\d{3,4}\b|\b0\d{8,9}\b/],
  ['control-char', /[\u0000-\u0009\u000B-\u001F\u007F\u202A-\u202E\u2066-\u2069]/],
];
const HIGH_ENTROPY_RE = /[A-Za-z0-9_\-+/=]{32,}/g;
function secretKinds(s: string): string[] {
  const kinds: string[] = [];
  for (const [kind, re] of SECRET_PATTERNS) if (re.test(s)) kinds.push(kind);
  for (const tok of s.match(HIGH_ENTROPY_RE) || []) {
    if (HEX64.test(tok) || HEX40.test(tok)) continue;
    if (/[A-Z]/.test(tok) && /[a-z]/.test(tok) && /[0-9]/.test(tok)) { kinds.push('high-entropy-token'); break; }
  }
  return kinds;
}
export function scanSecretShaped(value: unknown, path = '$'): { path: string; kind: string }[] {
  const out: { path: string; kind: string }[] = [];
  const safeKey = (k: string) => (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) ? k : '<key>');
  const visit = (v: unknown, p: string) => {
    if (typeof v === 'string') { for (const kind of secretKinds(v)) out.push({ path: p, kind }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => visit(x, `${p}[${i}]`)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Obj)) { for (const kind of secretKinds(k)) out.push({ path: `${p}.<key>`, kind }); visit(x, `${p}.${safeKey(k)}`); }
  };
  visit(value, path);
  return out;
}

function keysOk(o: unknown, keys: readonly string[], label: string, errs: string[]): o is Obj {
  if (!isObj(o)) { errs.push(`${label}: not an object`); return false; }
  const extra = Object.keys(o).filter((k) => !keys.includes(k)); const missing = keys.filter((k) => !own(o, k));
  if (extra.length) errs.push(`${label}: unknown key(s)`);
  if (missing.length) errs.push(`${label}: missing key(s) ${missing.join(', ')}`);
  return extra.length === 0 && missing.length === 0;
}
const isPin = (v: unknown) => !(v === undefined || v === null || v === '' || v === PENDING);
function eqPin(errs: string[], label: string, got: unknown, pin: unknown) {
  if (!isPin(pin)) { errs.push(`${label}: pin is PENDING - refused (fail closed)`); return false; }
  if (got !== pin) { errs.push(`${label}: does not equal the pinned value`); return false; }
  return true;
}
const hexOk = (errs: string[], label: string, v: unknown, re: RegExp = HEX64) => { if (typeof v !== 'string' || !re.test(v)) { errs.push(`${label}: malformed`); return false; } return true; };
const int = (v: unknown) => Number.isSafeInteger(v);
const PIN_FORMATS: Record<string, RegExp> = {
  releaseId: /^[a-z0-9-]{8,80}$/, repository: /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/, repositoryId: /^[1-9][0-9]{0,19}$/, repositoryOwner: /^[A-Za-z0-9-]{1,39}$/,
  repositoryOwnerId: /^[1-9][0-9]{0,19}$/, ref: /^refs\/heads\/main$/, workflowPath: /^\.github\/workflows\/[a-z0-9-]+\.yml$/, environment: /^[a-z0-9-]{1,64}$/,
  oidcAudience: /^[a-z0-9-]{1,64}$/, candidateCommit: HEX40, migrationVersion: /^\d{14}$/, migrationFile: /^\d{14}_[a-z0-9_]+\.sql$/, migrationSha256: HEX64,
  productionRef: /^[a-z]{20}$/, testRef: /^[a-z]{20}$/, testRegistrySha256: HEX64, sessionCheckSha256: HEX64, productionBundleSha256: HEX64,
};
export function checkPinsReady(pins: Obj): string[] {
  const errs: string[] = [];
  for (const k of BUILD_PIN_KEYS) {
    const v = pins[k];
    if (!isPin(v)) errs.push(`build pin ${k} is PENDING - refused (fail closed)`);
    else if (typeof v !== 'string' || !PIN_FORMATS[k].test(v)) errs.push(`build pin ${k} is malformed`);
  }
  if (pins.productionRef === pins.testRef) errs.push('build pin productionRef equals testRef');
  return errs;
}

// (a) TEST verification report /2 (bytes). `now` in ms: any timestamp after now + FUTURE_SKEW_MS is refused.
export async function checkTestReportBytes(bytes: Uint8Array, pins: CodePins, now: number): Promise<{ ok: boolean; errors: string[]; sha256?: string; report?: Obj }> {
  const d = await decodeCanonicalArtifact(bytes, 'report');
  if (!d.ok) return { ok: false, errors: d.errors };
  const r = d.value; const errs: string[] = [];
  for (const l of scanSecretShaped(r, 'report')) errs.push(`${l.path}: secret- or customer-shaped content (${l.kind})`);
  if (!keysOk(r, REPORT_KEYS, 'report', errs)) return { ok: false, errors: errs, sha256: d.sha256 };
  if (r.schema !== TEST_REPORT_SCHEMA) errs.push(`report.schema must be ${TEST_REPORT_SCHEMA}`);
  if (r.verdict !== 'PASS') errs.push('report.verdict must be PASS');
  if (keysOk(r.target, REPORT_TARGET_KEYS, 'report.target', errs)) { if (r.target.env !== 'TEST') errs.push('report.target.env must be TEST'); eqPin(errs, 'report.target.ref', r.target.ref, pins.testRef); }
  if (keysOk(r.migration, REPORT_MIGRATION_KEYS, 'report.migration', errs)) {
    eqPin(errs, 'report.migration.version', r.migration.version, pins.migrationVersion); eqPin(errs, 'report.migration.file', r.migration.file, pins.migrationFile);
    eqPin(errs, 'report.migration.sha256', r.migration.sha256, pins.migrationSha256); eqPin(errs, 'report.migration.candidateCommit', r.migration.candidateCommit, pins.candidateCommit);
  }
  if (keysOk(r.registry, REPORT_REGISTRY_KEYS, 'report.registry', errs)) {
    if (r.registry.schema !== TEST_REGISTRY_SCHEMA) errs.push(`report.registry.schema must be ${TEST_REGISTRY_SCHEMA}`);
    eqPin(errs, 'report.registry.sha256', r.registry.sha256, pins.testRegistrySha256); eqPin(errs, 'report.registry.sourceCommit', r.registry.sourceCommit, pins.candidateCommit);
    eqPin(errs, 'report.registry.targetRef', r.registry.targetRef, pins.testRef);
    if (r.registry.initialLedgerCount !== INITIAL_LEDGER_COUNT) errs.push(`report.registry.initialLedgerCount must be ${INITIAL_LEDGER_COUNT}`);
  }
  eqPin(errs, 'report.sessionCheckSqlSha256', r.sessionCheckSqlSha256, pins.sessionCheckSha256);
  if (keysOk(r.atomicityProbe, REPORT_PROBE_KEYS, 'report.atomicityProbe', errs)) {
    if (r.atomicityProbe.bundleName !== pins.atomicityProbeBundle.name || r.atomicityProbe.bundleSha256 !== pins.atomicityProbeBundle.sha256) errs.push('report.atomicityProbe does not equal the pinned probe bundle');
  }
  const steps6 = pins.testSteps;
  const times: [string, number][] = [];
  let runUtcByStep = new Map<number, number>(); let lastRunMs = NaN;
  if (keysOk(r.testRun, REPORT_TESTRUN_KEYS, 'report.testRun', errs)) {
    const tr = r.testRun;
    if (tr.runSchema !== TEST_RUN_SCHEMA) errs.push(`report.testRun.runSchema must be ${TEST_RUN_SCHEMA}`);
    hexOk(errs, 'report.testRun.toolingCommit', tr.toolingCommit, HEX40);
    const runs = Array.isArray(tr.runs) ? tr.runs : null;
    if (!runs || runs.length < 1 || runs.length > steps6.length) errs.push(`report.testRun.runs must list 1..${steps6.length} runs`);
    const runOfStep = new Map<number, { sha: unknown; t: number }>(); const seen = new Set<unknown>(); const order: number[] = []; let prev = -Infinity;
    (runs || []).forEach((run: unknown, i: number) => {
      const L = `report.testRun.runs[${i}]`;
      if (!keysOk(run, REPORT_RUN_KEYS, L, errs)) return;
      if (hexOk(errs, `${L}.evidenceSha256`, run.evidenceSha256)) { if (seen.has(run.evidenceSha256)) errs.push(`${L}: duplicated run evidence`); seen.add(run.evidenceSha256); }
      const t = parseIsoStrict(run.runUtc);
      if (Number.isNaN(t)) errs.push(`${L}.runUtc must be a strict UTC ISO-8601 timestamp`);
      else { if (!(t > prev)) errs.push(`${L}.runUtc must be strictly after the previous run`); prev = t; lastRunMs = t; times.push([`${L}.runUtc`, t]); }
      if (keysOk(run.probe, REPORT_RUN_PROBE_KEYS, `${L}.probe`, errs)) {
        const p = run.probe as Obj;
        if (p.outcome !== PROBE_OUTCOME) errs.push(`${L}.probe.outcome must be ${PROBE_OUTCOME}`);
        if (p.tkCode !== PROBE_TK_CODE) errs.push(`${L}.probe.tkCode must be ${PROBE_TK_CODE}`);
        hexOk(errs, `${L}.probe.postCaptureSha256`, p.postCaptureSha256); hexOk(errs, `${L}.probe.postSessionSha256`, p.postSessionSha256);
      }
      if (!Array.isArray(run.steps) || run.steps.length === 0 || !run.steps.every(int)) errs.push(`${L}.steps must list the step numbers the run APPLIED`);
      else for (const n of run.steps as number[]) { order.push(n); if (!runOfStep.has(n)) runOfStep.set(n, { sha: run.evidenceSha256, t }); }
    });
    if (order.join(',') !== steps6.map((s) => s.step).join(',')) errs.push('report.testRun.runs: the applied steps across the runs must be exactly 1,2,3,4,5,6 in order');
    runUtcByStep = new Map([...runOfStep].map(([n, v]) => [n, v.t]));
    const steps = Array.isArray(tr.steps) ? tr.steps : null;
    if (!steps || steps.length !== steps6.length) errs.push(`report.testRun.steps must list exactly the ${steps6.length} pinned steps`);
    (steps || []).forEach((s: unknown, i: number) => {
      const L = `report.testRun.steps[${i}]`; const pin = steps6[i] as unknown as Obj & { step: number };
      if (!pin) return;
      if (!keysOk(s, REPORT_STEP_KEYS, L, errs)) return;
      for (const k of STEP_PIN_KEYS) if (s[k] !== pin[k]) errs.push(`${L}.${k} does not equal the pinned step ${pin.step}`);
      if (s.outcome !== 'APPLIED') errs.push(`${L}.outcome must be APPLIED`);
      if (!runOfStep.has(pin.step) || s.runEvidenceSha256 !== runOfStep.get(pin.step)!.sha) errs.push(`${L}.runEvidenceSha256 is not the run that applied step ${pin.step}`);
      if (s.preLedgerCount !== INITIAL_LEDGER_COUNT + pin.step - 1 || s.postLedgerCount !== INITIAL_LEDGER_COUNT + pin.step) errs.push(`${L}: ledger counts are not pinned`);
      hexOk(errs, `${L}.postCaptureSha256`, s.postCaptureSha256); hexOk(errs, `${L}.postSessionSha256`, s.postSessionSha256);
    });
  }
  const migRunMs = runUtcByStep.get(steps6[steps6.length - 1].step);
  let afterMs = NaN;
  if (keysOk(r.aqpVerify, REPORT_AQP_KEYS, 'report.aqpVerify', errs)) {
    const a = r.aqpVerify;
    if (a.verdict !== 'PASS') errs.push('report.aqpVerify.verdict must be PASS');
    if (!int(a.checksTotal) || (a.checksTotal as number) < 1) errs.push('report.aqpVerify.checksTotal must be an integer >= 1');
    hexOk(errs, 'report.aqpVerify.beforeCaptureSha256', a.beforeCaptureSha256); hexOk(errs, 'report.aqpVerify.afterCaptureSha256', a.afterCaptureSha256);
    const b = parseIsoStrict(a.beforeCollectedAt); afterMs = parseIsoStrict(a.afterCollectedAt);
    if (Number.isNaN(b) || Number.isNaN(afterMs)) errs.push('report.aqpVerify collectedAt values must be strict UTC ISO-8601 timestamps');
    else {
      times.push(['report.aqpVerify.beforeCollectedAt', b], ['report.aqpVerify.afterCollectedAt', afterMs]);
      if (!(b < afterMs)) errs.push('report.aqpVerify: before-capture must precede after-capture');
      if (migRunMs !== undefined && !Number.isNaN(migRunMs) && !(b < migRunMs && afterMs > migRunMs)) errs.push('report.aqpVerify: the captures must bracket the run that applied the migration');
    }
  }
  let ledgerMs = NaN;
  if (keysOk(r.ledger, REPORT_LEDGER_KEYS, 'report.ledger', errs)) {
    const l = r.ledger;
    hexOk(errs, 'report.ledger.captureSha256', l.captureSha256); eqPin(errs, 'report.ledger.projectRef', l.projectRef, pins.testRef);
    ledgerMs = parseIsoStrict(l.collectedAt);
    if (Number.isNaN(ledgerMs)) errs.push('report.ledger.collectedAt must be a strict UTC ISO-8601 timestamp');
    else { times.push(['report.ledger.collectedAt', ledgerMs]); if (!(ledgerMs > lastRunMs)) errs.push('report.ledger.collectedAt must be after the last TEST run'); }
    if (l.rowCount !== INITIAL_LEDGER_COUNT + steps6.length) errs.push(`report.ledger.rowCount must be ${INITIAL_LEDGER_COUNT + steps6.length}`);
    const m = l.migrationRow;
    if (keysOk(m, REPORT_LEDGER_ROW_KEYS, 'report.ledger.migrationRow', errs)) {
      if (m.version !== pins.migrationVersion || m.name !== pins.migrationName || m.nStatements !== 1 || m.statementsSha256 !== pins.migrationSha256 || m.stmt1Sha256 !== pins.migrationSha256) errs.push('report.ledger.migrationRow is not exactly the pinned migration');
    }
  }
  const fin = parseIsoStrict(r.finalTestCaptureAt);
  if (Number.isNaN(fin)) errs.push('report.finalTestCaptureAt must be a strict UTC ISO-8601 timestamp');
  else {
    times.push(['report.finalTestCaptureAt', fin]);
    const latest = Math.max(ledgerMs, afterMs, lastRunMs);
    if (!Number.isNaN(latest) && fin !== latest) errs.push('report.finalTestCaptureAt must equal the latest TEST capture / run timestamp in the report');
  }
  if (keysOk(r.generator, REPORT_GENERATOR_KEYS, 'report.generator', errs)) {
    hexOk(errs, 'report.generator.toolingCommit', r.generator.toolingCommit, HEX40);
    if (r.generator.clean !== true) errs.push('report.generator.clean must be true');
  }
  if (!Number.isFinite(now)) errs.push('internal: now');
  else for (const [L, t] of times) if (t > now + FUTURE_SKEW_MS) errs.push(`${L} is future-dated`);
  return { ok: errs.length === 0, errors: errs, sha256: d.sha256, report: errs.length === 0 ? r : undefined };
}

// (b) Authorization v3 (bytes). Build pins = CodePins (productionBundleSha256 = the verified bundle pin), deploy pins validated.
export async function checkAuthorizationBytes(bytes: Uint8Array, pins: CodePins, deploy: DeployPins, now: number, testReportSha256: string | undefined): Promise<{ ok: boolean; errors: string[]; sha256?: string; authorization?: Obj }> {
  if (!Number.isFinite(now)) return { ok: false, errors: ['internal: now'] };
  const d = await decodeCanonicalArtifact(bytes, 'authorization');
  if (!d.ok) return { ok: false, errors: d.errors };
  const a = d.value; const errs: string[] = [];
  for (const l of scanSecretShaped(a, 'authorization')) errs.push(`${l.path}: secret- or customer-shaped content (${l.kind})`);
  errs.push(...checkPinsReady(pins as unknown as Obj));
  if (!keysOk(a, AUTH_KEYS, 'authorization', errs)) return { ok: false, errors: errs, sha256: d.sha256 };
  if (a.schema !== AUTH_SCHEMA) errs.push(`authorization.schema must be ${AUTH_SCHEMA}`);
  if (a.authorizedBy !== 'Owner') errs.push('authorization.authorizedBy must be "Owner"');
  if (a.scope !== AUTH_SCOPE) errs.push(`authorization.scope must be ${AUTH_SCOPE}`);
  eqPin(errs, 'authorization.releaseId', a.releaseId, pins.releaseId);
  const t = a.ownerDecisionText;
  if (typeof t !== 'string' || t.trim() === '') errs.push('authorization.ownerDecisionText must be the non-empty verbatim Owner text');
  else {
    if (PLACEHOLDER_RE.test(t)) errs.push('authorization.ownerDecisionText still contains a template placeholder');
    if (t.length > OWNER_TEXT_MAX) errs.push(`authorization.ownerDecisionText is longer than ${OWNER_TEXT_MAX} characters`);
    if (!t.includes(pins.migrationVersion)) errs.push('authorization.ownerDecisionText must name the migration');
    if (!isPin(pins.productionRef) || !t.includes(pins.productionRef)) errs.push('authorization.ownerDecisionText must name the Production ref');
    if (a.ownerDecisionTextSha256 !== await sha256Text(t)) errs.push('authorization.ownerDecisionTextSha256 != sha256(UTF-8 ownerDecisionText)');
  }
  const b = a.bindings;
  if (keysOk(b, AUTH_BINDING_KEYS, 'authorization.bindings', errs)) {
    for (const k of AUTH_BINDING_KEYS) {
      if (b[k] === PENDING) { errs.push(`authorization.bindings.${k} is PENDING - refused`); continue; }
      const src = (DEPLOY_PIN_KEYS as readonly string[]).includes(k) ? (deploy as unknown as Obj) : (pins as unknown as Obj);
      eqPin(errs, `authorization.bindings.${k}`, b[k], src[k]);
    }
    if (b.productionRef === pins.testRef) errs.push('authorization.bindings.productionRef is the TEST ref');
    if (typeof testReportSha256 !== 'string' || !HEX64.test(testReportSha256) || b.testReportSha256 !== testReportSha256) errs.push('authorization.bindings.testReportSha256 != sha256 of the TEST verification report bytes');
  }
  if (d.sha256 !== deploy.authorizationSha256) errs.push('authorization sha256 != deploy pin authorizationSha256');
  const iss = parseIsoStrict(a.issuedAt); const exp = parseIsoStrict(a.expiresAt);
  if (Number.isNaN(iss)) errs.push('authorization.issuedAt must be a strict UTC ISO-8601 timestamp');
  if (Number.isNaN(exp)) errs.push('authorization.expiresAt must be a strict UTC ISO-8601 timestamp');
  if (!Number.isNaN(iss) && !Number.isNaN(exp)) {
    if (!(exp > iss)) errs.push('authorization.expiresAt must be after issuedAt');
    if (exp - iss > AUTH_MAX_VALIDITY_MS) errs.push('authorization validity window is longer than 72 h');
    if (iss > now + FUTURE_SKEW_MS) errs.push('authorization.issuedAt is future-dated');
    if (now - iss > AUTH_MAX_AGE_MS) errs.push('authorization is older than 72 h (stale)');
    if (now >= exp) errs.push('authorization EXPIRED');
  }
  if (a.oneShot !== true) errs.push('authorization.oneShot must be true');
  if (a.forwardFixPermitted !== false) errs.push('authorization.forwardFixPermitted must be false');
  return { ok: errs.length === 0, errors: errs, sha256: d.sha256, authorization: errs.length === 0 ? a : undefined };
}

// (c) Both artifacts + freshness / ordering (mirror of verifyProductionRelease). Returns every error (tests); the handler only
// exposes a constant code.
export async function verifyProductionRelease(authorizationBytes: Uint8Array, testReportBytes: Uint8Array, deploy: DeployPins, now: number, pins: CodePins): Promise<{ ok: boolean; errors: string[]; reportOk: boolean }> {
  const errs: string[] = [];
  const rep = await checkTestReportBytes(testReportBytes, pins, now);
  errs.push(...rep.errors.map((e) => `test report: ${e}`));
  if (rep.sha256 && rep.sha256 !== deploy.testReportSha256) errs.push('test report sha256 != deploy pin testReportSha256');
  const auth = await checkAuthorizationBytes(authorizationBytes, pins, deploy, now, rep.sha256);
  errs.push(...auth.errors);
  if (rep.ok && auth.ok) {
    const fin = parseIsoStrict(rep.report!.finalTestCaptureAt); const iss = parseIsoStrict(auth.authorization!.issuedAt);
    if (!(fin < iss)) errs.push('the final TEST capture must be strictly before authorization.issuedAt');
    if (now - fin > REPORT_MAX_AGE_MS) errs.push('the TEST verification report is older than 72 h (stale)');
  }
  const errors = [...new Set(errs)];
  return { ok: errors.length === 0, errors, reportOk: rep.ok };
}
export async function verifyArtifacts(a: { authorizationBytes: Uint8Array; testReportBytes: Uint8Array; deploy: DeployPins; bundleSha: string; nowMs: number; pins: CodePins }): Promise<void> {
  // the bundle pin the authorization must bind is the VERIFIED runtime bundle sha (== bundle.ts constant == code pin, see checkBundle)
  const pins = { ...a.pins, productionBundleSha256: a.bundleSha } as CodePins;
  const v = await verifyProductionRelease(a.authorizationBytes, a.testReportBytes, a.deploy, a.nowMs, pins);
  if (!v.ok) throw new BrokerRefusal(v.reportOk ? 'AUTHORIZATION_INVALID' : 'TEST_REPORT_INVALID', `errors-${v.errors.length}`);
}
// B5 HASHING_RULE section 3.
export async function releaseKeyOf(releaseId: string, authorizationSha256: string, testReportSha256: string, productionBundleSha256: string): Promise<string> {
  if (!PIN_FORMATS.releaseId.test(releaseId)) throw new BrokerRefusal('INTERNAL', 'release-id');
  for (const v of [authorizationSha256, testReportSha256, productionBundleSha256]) if (!HEX64.test(v)) throw new BrokerRefusal('INTERNAL', 'release-key-input');
  return sha256Text(`${releaseId}|${authorizationSha256}|${testReportSha256}|${productionBundleSha256}`);
}

// ===================================================================================================================================
// 6. Credential sanity (scope is NOT provable from the string: project + Database-read-write scoping is enforced when the token is
//    provisioned and proven by the separate scoped-token negative proof. Here: refuse obviously wrong kinds of secrets.)
// ===================================================================================================================================
// Supabase documents scoped personal access tokens as starting with `sbp_fc` (classic account-wide PATs: plain `sbp_`, "Legacy").
// A classic PAT, a JWT (anon / service_role / user), a project API key (sb_secret_ / sb_publishable_) or anything with whitespace
// is refused before any call. The prefix proves only the token KIND; its project + Database-read-write scope is proven separately.
export const SCOPED_TOKEN_RE = /^sbp_fc[A-Za-z0-9_-]{16,256}$/;
export function credentialShapeOk(t: unknown): boolean {
  return typeof t === 'string' && SCOPED_TOKEN_RE.test(t);
}

// ===================================================================================================================================
// 7. One-shot DB phase (fixed endpoint; SQL built only from constants + a hex-validated release key)
// ===================================================================================================================================
function assertHexKey(rk: string) { if (!HEX64.test(rk)) throw new BrokerRefusal('INTERNAL', 'release-key'); }
export function readbackSql(rk: string, pins: CodePins): string {
  assertHexKey(rk);
  const V = pins.migrationVersion;
  return `SELECT pg_catalog.json_build_object(
 'oneshotState', (SELECT (o.state)::pg_catalog.text FROM ${ONESHOT_TABLE} o WHERE o.release_key = '${rk}'),
 'ledgerVersions', (SELECT coalesce(pg_catalog.json_agg((m.version)::pg_catalog.text ORDER BY m.version COLLATE "C"), '[]'::pg_catalog.json) FROM ${LEDGER_TABLE} m),
 'ledgerRow', (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(m.statements[1], 'UTF8')), 'hex') || ':' || (pg_catalog.array_length(m.statements, 1))::pg_catalog.text || ':' || (m.name)::pg_catalog.text FROM ${LEDGER_TABLE} m WHERE m.version = '${V}'),
 'overloads', (SELECT coalesce(pg_catalog.json_agg(((p.proname)::pg_catalog.text || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')') ORDER BY pg_catalog.oidvectortypes(p.proargtypes) COLLATE "C"), '[]'::pg_catalog.json) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'approve_quote_public')
) AS tk_readback`;
}
export function casSql(rk: string): string {
  assertHexKey(rk);
  return `UPDATE ${ONESHOT_TABLE} SET state = 'RUNNING', updated_at = pg_catalog.now() WHERE release_key = '${rk}' AND state = 'PENDING' RETURNING release_key, state`;
}
export function terminalSql(rk: string, state: 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN'): string {
  assertHexKey(rk);
  if (!['APPLIED', 'NOT_APPLIED', 'UNKNOWN'].includes(state)) throw new BrokerRefusal('INTERNAL', 'terminal-state');
  return `UPDATE ${ONESHOT_TABLE} SET state = '${state}', updated_at = pg_catalog.now() WHERE release_key = '${rk}' AND state = 'RUNNING' RETURNING state`;
}

// Error codes that PROVE the bundle's single transaction was aborted by the bundle itself (so nothing of it can commit):
//   - every TK_* code the reviewed builder (buildAqpApplySql, migration-executor-profiles.js) raises inside the transaction:
//     TK_SEARCH_PATH, TK_REPLAY_REFUSED, TK_LEDGER_IDENTITY_MISMATCH, TK_PRESTATE_DRIFT (guard, before the migration) and
//     TK_POSTCONDITION (after the DROP, still inside the same uncommitted transaction);
//   - every TK_AQP_* code the verbatim, sha-pinned migration 20260929000000 raises (SQLSTATE TKA00..TKA07);
//   - SQLSTATE 55P03 (lock_timeout) and 57014 (statement cancelled / statement_timeout).
// TK_INJECTED_FAULT (LOCAL_REHEARSAL only) and TK_BEHAVIOUR / TK_PREREQUISITE_MISSING (other scripts) are deliberately absent.
// A generic "ERROR" (e.g. "Failed to run sql query: ERROR:  timeout") proves nothing -> UNKNOWN.
export const BUNDLE_ROLLBACK_TK_CODES: readonly string[] = Object.freeze([
  'TK_SEARCH_PATH', 'TK_REPLAY_REFUSED', 'TK_LEDGER_IDENTITY_MISMATCH', 'TK_PRESTATE_DRIFT', 'TK_POSTCONDITION',
  'TK_AQP_SEARCH_PATH', 'TK_AQP_UNEXPECTED_OVERLOAD', 'TK_AQP_UNEXPECTED_DEFINITION', 'TK_AQP_DEPENDENCY', 'TK_AQP_CANONICAL_MISSING',
  'TK_AQP_CANONICAL_DEFINITION', 'TK_AQP_CANONICAL_ACL', 'TK_AQP_POST_STILL_PRESENT',
]);
export const BUNDLE_ROLLBACK_SQLSTATES: readonly string[] = Object.freeze(['55P03', '57014']);
// Returns the proving code, or null. Matching is anchored to the Postgres error shape, never a token anywhere:
//   - TK codes only as `ERROR:  <P0001|TKA00..TKA07>: TK_...`; every such code must be on the list AND the message must contain no
//     other TK_* token anywhere (e.g. echoed query text) -> otherwise unproven;
//   - with no TK_* token at all, SQLSTATEs only as `ERROR:  55P03:` / `ERROR:  57014:`.
// If the real Management API error text carries no SQLSTATE prefix, NOT_APPLIED is simply unreachable (fail closed to UNKNOWN).
export function provenRollbackCode(message: string): string | null {
  const allTks = message.match(/\bTK_[A-Z0-9_]+\b/g) || [];
  const anchored = [...message.matchAll(/ERROR:\s+(?:P0001|TKA0[0-7]):\s+(TK_[A-Z0-9_]+)\b/g)].map((m) => m[1] ?? '');
  if (allTks.length) return anchored.length && anchored.length === allTks.length && anchored.every((t) => BUNDLE_ROLLBACK_TK_CODES.includes(t)) ? (anchored[0] ?? null) : null;
  const st = /ERROR:\s+(55P03|57014):/.exec(message);
  return st && BUNDLE_ROLLBACK_SQLSTATES.includes(st[1] ?? '') ? (st[1] ?? null) : null;
}
type CallResult = { kind: 'OK'; status: number; json: unknown } | { kind: 'SQL_ERROR'; status: number; provenCode: string | null } | { kind: 'AMBIGUOUS'; why: string };
// ONE fetch per call, never retried. Classification:
//   200/201 + parseable JSON                -> OK
//   4xx + JSON {message: "...ERROR..."}     -> SQL_ERROR, with provenCode only when the message carries a rollback-proving code
//   anything else (network error, abort/timeout, 5xx, other 4xx, unparseable, oversize, 25P02) -> AMBIGUOUS
async function callManagement(deps: BrokerDeps, token: string, sql: string, timeoutMs: number): Promise<CallResult> {
  let res: Response;
  try {
    res = await deps.fetch(MANAGEMENT_API_QUERY_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: sql }),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch { return { kind: 'AMBIGUOUS', why: 'network-or-timeout' }; }
  let text: string | null;
  try { text = await readCapped(res, UPSTREAM_READ_MAX_BYTES); } catch { return { kind: 'AMBIGUOUS', why: 'read-failed' }; }
  if (text === null) return { kind: 'AMBIGUOUS', why: 'oversize-or-binary' };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { kind: 'AMBIGUOUS', why: 'unparseable' }; }
  if (res.status === 200 || res.status === 201) return { kind: 'OK', status: res.status, json };
  if (res.status >= 400 && res.status < 500 && isObj(json) && typeof json.message === 'string' && /\bERROR\b/.test(json.message)) {
    // "current transaction is aborted" (25P02): the pooled session was already in a failed block - nothing about THIS send is proven.
    if (/\b25P02\b|current transaction is aborted/i.test(json.message)) return { kind: 'AMBIGUOUS', why: 'aborted-transaction' };
    return { kind: 'SQL_ERROR', status: res.status, provenCode: provenRollbackCode(json.message) };
  }
  return { kind: 'AMBIGUOUS', why: `status-${res.status}` };
}

export type Readback = { oneshotState: string | null; ledgerVersions: string[]; ledgerRow: string | null; overloads: string[] };
export function parseReadback(json: unknown): Readback | null {
  if (!Array.isArray(json) || json.length !== 1 || !exactKeys(json[0], ['tk_readback'])) return null;
  let r = (json[0] as Obj).tk_readback;
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch { return null; } }
  if (!exactKeys(r, ['oneshotState', 'ledgerVersions', 'ledgerRow', 'overloads'])) return null;
  const strArr = (x: unknown) => Array.isArray(x) && x.every((s) => typeof s === 'string');
  if (!(r.oneshotState === null || typeof r.oneshotState === 'string')) return null;
  if (!(r.ledgerRow === null || typeof r.ledgerRow === 'string')) return null;
  if (!strArr(r.ledgerVersions) || !strArr(r.overloads)) return null;
  return { oneshotState: r.oneshotState as string | null, ledgerVersions: r.ledgerVersions as string[], ledgerRow: r.ledgerRow as string | null, overloads: r.overloads as string[] };
}
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
export function isPreState(r: Readback, pins: CodePins): boolean {
  return !r.ledgerVersions.includes(pins.migrationVersion) && r.ledgerRow === null
    && sameList(r.ledgerVersions, pins.productionPreApplyLedger) && sameList(r.overloads, pins.legacyOverloads);
}
export function isAppliedState(r: Readback, pins: CodePins): boolean {
  const post = [...pins.productionPreApplyLedger, pins.migrationVersion].sort();
  return sameList(r.ledgerVersions, post) && r.ledgerRow === `${pins.migrationSha256}:1:${pins.migrationName}` && r.overloads.length === 0;
}

// ===================================================================================================================================
// Handler
// ===================================================================================================================================
export function createHandler(deps: BrokerDeps): (req: Request) => Promise<Response> {
  return createHandlerWithPins(deps, CODE_PINS);
}

// Test seam: the same handler with an explicit code-pin object (the production bundle pin is PENDING in CODE_PINS, so a full happy
// path can only be exercised with a synthetic bundle + matching pin). index.ts never calls this (asserted by policy.test.ts).
export function createHandlerWithPins(deps: BrokerDeps, pins: CodePins): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const hashes: Hashes = {};
    try {
      return await run(req, deps, pins, hashes);
    } catch (e) {
      if (e instanceof BrokerRefusal) {
        safeLog(deps, { event: 'refused', code: e.code, detail: e.detail });
        return respond(HTTP_FOR[e.code] ?? 500, 'REFUSED', e.code, e.code === 'UNAUTHENTICATED' ? {} : hashes);
      }
      safeLog(deps, { event: 'refused', code: 'INTERNAL', detail: 'unexpected' });
      return respond(500, 'REFUSED', 'INTERNAL', {});
    }
  };
}

async function run(req: Request, deps: BrokerDeps, pins: CodePins, hashes: Hashes): Promise<Response> {
  const t0 = nowMs(deps);
  const elapsed = () => nowMs(deps) - t0;
  const budget = (own: number) => Math.max(1000, Math.min(own, REQUEST_BUDGET_MS - elapsed()));

  // 1. request shape (nothing caller-controlled is trusted yet)
  if (req.method !== 'POST') throw new BrokerRefusal('METHOD_NOT_ALLOWED');
  const ct = (req.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
  if (ct !== 'application/json') throw new BrokerRefusal('UNSUPPORTED_MEDIA_TYPE');
  const cl = req.headers.get('content-length');
  if (cl !== null && (!/^\d{1,9}$/.test(cl) || Number(cl) > BODY_MAX_BYTES)) throw new BrokerRefusal('BODY_TOO_LARGE');

  // 2. GitHub OIDC: signature, algorithm, kid, issuer, audience, subject, times, repository / owner ids, ref, workflow, environment,
  //    event, runner, attempt. Unauthenticated callers learn nothing else (no hashes, no readiness information).
  parseBearer(req.headers.get('authorization')); // shape gate first: a malformed request never triggers the JWKS fetch
  let jwksDoc: unknown;
  try { jwksDoc = await deps.jwks(); } catch { throw new BrokerRefusal('UNAUTHENTICATED', 'oidc-jwks-unavailable'); }
  const claims = await verifyGithubOidc(req.headers.get('authorization'), jwksDoc, Math.floor(t0 / 1000), expectedOidcClaims(pins));

  // 3. deploy-time pins (strict; PENDING / missing / malformed refuses everything); the OIDC workflow_sha must equal the pin
  const rawPins = readEnv(deps, DEPLOY_PINS_ENV);
  if (typeof rawPins === 'string' && rawPins !== '') hashes.deployPinsSha256 = await sha256Text(rawPins);
  const deploy = parseDeployPins(rawPins);
  if (claims.workflow_sha !== deploy.workflowSha) { for (const k of Object.keys(hashes)) delete (hashes as Obj)[k]; throw new BrokerRefusal('UNAUTHENTICATED', 'oidc-claim-workflow_sha-pin'); }

  // 4. the embedded Production bundle: READY, sha256 recomputed at runtime == bundle.ts constant == code pin, structure tripwires
  const bundleSha = await checkBundle(deps.bundle, pins, deploy.executorCommit);
  hashes.bundleSha256 = bundleSha;

  // 5. body: closed keys, base64 of the exact artifact bytes
  const raw = await readBodyCapped(req, BODY_MAX_BYTES);
  if (raw === null) throw new BrokerRefusal('BODY_TOO_LARGE');
  const { authorizationBytes, testReportBytes } = parseBody(raw);

  // 6. artifacts: sha256 over the received bytes == deploy pins; authorization v3 + TEST report /2 verified independently
  const authSha = await sha256Hex(authorizationBytes); const reportSha = await sha256Hex(testReportBytes);
  hashes.authorizationSha256 = authSha; hashes.testReportSha256 = reportSha;
  if (authSha !== deploy.authorizationSha256 || reportSha !== deploy.testReportSha256) throw new BrokerRefusal('ARTIFACT_PIN_MISMATCH');
  await verifyArtifacts({ authorizationBytes, testReportBytes, deploy, bundleSha, nowMs: t0, pins });
  const releaseKey = await releaseKeyOf(pins.releaseId, authSha, reportSha, bundleSha);
  hashes.releaseKey = releaseKey;
  safeLog(deps, { event: 'validated' });

  // 7. credential: first and only read, after every check above passed
  const token = readEnv(deps, DB_TOKEN_ENV);
  if (typeof token !== 'string' || token === '') throw new BrokerRefusal('NO_CREDENTIAL');
  if (!credentialShapeOk(token)) throw new BrokerRefusal('CREDENTIAL_FORMAT');

  // 8a. read-only pre-check (one SELECT): one-shot row PENDING, 0929 not recorded, exact Production pre-state
  const pre = await callManagement(deps, token, readbackSql(releaseKey, pins), TIMEOUTS_MS.precheck);
  const preRb = pre.kind === 'OK' ? parseReadback(pre.json) : null;
  if (!preRb) throw new BrokerRefusal('PRECHECK_FAILED');
  if (preRb.oneshotState !== 'PENDING') throw new BrokerRefusal('ONESHOT_NOT_PENDING');
  if (preRb.ledgerVersions.includes(pins.migrationVersion) || preRb.ledgerRow !== null) throw new BrokerRefusal('LEDGER_PRESENT');
  if (!isPreState(preRb, pins)) throw new BrokerRefusal('PRESTATE_DRIFT');
  if (elapsed() > PRE_CAS_DEADLINE_MS) throw new BrokerRefusal('DEADLINE'); // keep the bundle's full budget; nothing mutated yet

  // 8b. CAS PENDING -> RUNNING (one autocommit statement). A clean 0-row answer -> REFUSED (consumed / concurrent / not
  //     provisioned; nothing changed). Anything else that is not exactly the one expected row (timeout, network, 5xx, any error
  //     body, unexpected rows) -> UNKNOWN / 502: the row may now be RUNNING (= UNKNOWN for every reader). The bundle is never sent.
  const cas = await callManagement(deps, token, casSql(releaseKey), TIMEOUTS_MS.cas);
  const rows = cas.kind === 'OK' ? cas.json : null;
  if (Array.isArray(rows) && rows.length === 0) throw new BrokerRefusal('CAS_REFUSED');
  if (!(Array.isArray(rows) && rows.length === 1 && exactKeys(rows[0], ['release_key', 'state']) && rows[0].release_key === releaseKey && rows[0].state === 'RUNNING')) {
    safeLog(deps, { event: 'cas-ambiguous', outcome: cas.kind });
    return respond(502, 'UNKNOWN', 'CAS_AMBIGUOUS', hashes, { terminalRecorded: false });
  }
  safeLog(deps, { event: 'cas-running' });

  // 8c. exactly ONE bundle call, never retried
  const sent = await callManagement(deps, token, deps.bundle.PRODUCTION_BUNDLE_SQL, TIMEOUTS_MS.bundle);
  safeLog(deps, { event: 'bundle-sent', outcome: sent.kind });

  // 8d. decide: APPLIED only on success + read-back proves the post-state. NOT_APPLIED only on a server SQL error that carries a
  //     rollback-proving code (BUNDLE_ROLLBACK_TK_CODES / 55P03 / 57014) + read-back proves the unchanged pre-state.
  //     Everything else (timeout, network, 5xx, unparseable, generic "ERROR", inconsistent read-back) is UNKNOWN.
  let state: 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN' = 'UNKNOWN';
  let reason = sent.kind === 'AMBIGUOUS' ? 'BUNDLE_AMBIGUOUS' : sent.kind === 'SQL_ERROR' && !sent.provenCode ? 'SQL_ERROR_UNPROVEN' : 'READBACK_INCONCLUSIVE';
  let tkCode = '';
  if (sent.kind === 'OK' || (sent.kind === 'SQL_ERROR' && sent.provenCode)) {
    const rb = await callManagement(deps, token, readbackSql(releaseKey, pins), budget(TIMEOUTS_MS.readback));
    const post = rb.kind === 'OK' ? parseReadback(rb.json) : null;
    if (post && post.oneshotState === 'RUNNING') {
      if (sent.kind === 'OK' && isAppliedState(post, pins)) { state = 'APPLIED'; reason = 'APPLIED'; }
      else if (sent.kind === 'SQL_ERROR' && sent.provenCode && isPreState(post, pins)) { state = 'NOT_APPLIED'; reason = 'SQL_ERROR_UNCHANGED'; tkCode = sent.provenCode; }
    }
  }

  // 8e. terminal state: best-effort, one attempt. If it fails the row stays RUNNING, which every reader treats as UNKNOWN.
  const fin = await callManagement(deps, token, terminalSql(releaseKey, state), budget(TIMEOUTS_MS.terminal));
  const terminalRecorded = fin.kind === 'OK' && Array.isArray(fin.json) && fin.json.length === 1 && exactKeys(fin.json[0], ['state']) && (fin.json[0] as Obj).state === state;
  safeLog(deps, { event: 'terminal', state, terminalRecorded });
  const status = state === 'APPLIED' ? 200 : state === 'NOT_APPLIED' ? 409 : 502;
  const extra: Obj = { terminalRecorded };
  if (tkCode) extra.code = tkCode;
  return respond(status, state, reason, hashes, extra);
}
