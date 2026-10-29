// TEKANGO subscriptions - the ONE output orchestrator for send / public_share / final_pdf / final_print.
// PREPARATION / NOT ACTIVATED / NOT WIRED (prep schema v3, 2026-10-07 Codex closure round). Nothing in src/,
// supabase/functions or api/ imports this file; the existing product output paths are NOT connected to it.
//
// Saga (Storage and SQL are not one atomic transaction):
//   1. media verification (server) -> every presentation media ref is read from the OWNED asset store and its SHA-256 and
//                                     byte size must match; the presentation digest covers style, styleVersion, branding and
//                                     the ordered media manifest (assetId, sha256, bytes)
//   2. prepare_quote_output (SQL)  -> PREPARING reservation binding document (quote-document/v1), issuer (issuer/v1) and
//                                     presentation digests, style, style version and media count
//   3. immutable snapshot           -> EXPECTED canonical bytes are built from the bound state; an object already at the path
//                                     is accepted only if it is byte-identical to them; the read-back must be byte-identical
//   4. finalize_quote_output (SQL) -> the ONLY commit point (re-checks document, issuer and presentation digests)
//   5. reveal                       -> only a FINALIZED descriptor whose stored object hash/size matches
// Trust boundary: the SQL functions are service_role-only; `userId` MUST come from the verified JWT (the Edge wrapper's job).
// The body is never a source of user, plan, style, package or media rights. SQL cannot read Storage: the snapshot hash and
// the presentation digest are computed HERE from server objects and recorded/compared by SQL.
// Cleanup deletes an object only when it is proven to belong to the attempt (its header carries the attempt's bound
// identity and digests); an object of unknown provenance (snapshot_conflict) is never deleted.

export const OUTPUT_CHANNELS = Object.freeze(['send', 'public_share', 'final_pdf', 'final_print'] as const);
export type OutputChannel = (typeof OUTPUT_CHANNELS)[number];
export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_KIND = 'tekango-issued-quote-document';
export const PRESENTATION_PROJECTION = 'presentation/v1';
const STYLE_IDS = ['classic', 'modern', 'visual'] as const;
type StyleId = (typeof STYLE_IDS)[number];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

export type MediaRef = { assetId: string; sha256: string; bytes: number };
export type PresentationIntent = { style: StyleId; styleVersion: number; branding: Json; media: MediaRef[] };

export interface OutputSql {
  prepare(a: { userId: string; quoteId: string; channel: OutputChannel; idempotencyKey: string; expectedDigest: string;
    style: StyleId; mediaCount: number; styleVersion: number; presentationDigest: string }): Promise<unknown>;
  finalize(a: { userId: string; attemptId: string; snapshotPath: string; sha256: string; bytes: number;
    schemaVersion: number; presentationDigest: string }): Promise<unknown>;
  abort(a: { userId: string; attemptId: string; failureCode: string }): Promise<unknown>;
  descriptor(a: { quoteId: string }): Promise<unknown>;
  attemptState(a: { userId: string; attemptId: string }): Promise<unknown>;
  listForReconcile(a: { minAgeSeconds: number; limit: number }): Promise<unknown>;
  markSnapshotDeleted(a: { attemptId: string }): Promise<unknown>;
}
export interface SnapshotStorage {
  /** create-only write (upsert:false). Resolves 'created', or 'exists' when an object is already at the path; rejects on failure. */
  put(path: string, bytes: Uint8Array): Promise<'created' | 'exists'>;
  /** the stored bytes, or null when no object exists at the path */
  get(path: string): Promise<Uint8Array | null>;
  /** idempotent delete (a missing object is not an error) */
  remove(path: string): Promise<void>;
}
/** Server-side read of the presentation draft (style, version, branding, ordered media refs). Never the client. */
export interface PresentationSource { load(userId: string, quoteId: string): Promise<PresentationIntent> }
/** Server-side, owner-scoped read of an uploaded media asset (e.g. `${userId}/assets/<id>.<ext>`); null when absent. */
export interface MediaAssetSource { read(userId: string, assetId: string): Promise<Uint8Array | null> }
export type Incident = { code: 'document_unavailable' | 'reconcile_error'; attemptId?: string; quoteId?: string; detail: string };

export type OutputResponse = { status: number; body: JsonObject };

// SQL / orchestrator code -> HTTP status. Anything unknown fails closed (503).
export const CODE_STATUS: Readonly<Record<string, number>> = Object.freeze({
  not_activated: 409,
  account_not_provisioned: 409,
  quote_not_found: 404,
  idempotency_key_reused: 409,
  customer_changed_new_quote_required: 409,
  customer_binding_missing: 409,
  legacy_issue_policy_pending: 409,
  attachment_snapshot_policy_pending: 409,
  logo_snapshot_policy_pending: 409,  // a mutable external logo URL cannot enter an issued snapshot (no logo feature implied)
  // Codex release 1 (Owner 2026-10-29, typed: "מאשר שחרור 1 של קודקס עכשיו: שער ההפקה למחיר חסר בכל פלט חדש כולל שליחה חוזרת ..."): a version with a line without a price never
  // goes out on any channel, a re-send included (migration 20261029200000); nothing was reserved or counted
  missing_price: 409,
  price_state_unverified: 409,
  issuer_missing: 409,
  quote_changed: 409,
  output_in_progress: 409,  // Task 31 (Owner-authorized PREP extension): another version of this quote holds the one live reservation - retryable; nothing reserved or counted
  quote_closed: 409,        // Task 31 (Owner-authorized PREP extension): a signed / closed quote cannot produce a new counted version; its issued version stays re-sendable
  issuer_changed: 409,
  presentation_changed: 409,
  media_verification_failed: 409,
  style_not_entitled: 403,
  media_not_entitled: 403,
  paid_quote_policy_pending: 403,
  free_issue_limit_reached: 403,
  attempt_aborted: 409,
  attempt_expired: 409,
  attempt_not_found: 404,
  snapshot_conflict: 409,
  snapshot_mismatch: 409,
  snapshot_missing: 503,
  snapshot_metadata_missing: 503,
  document_unavailable: 410,
  not_finalized: 404,
});
// finalize outcomes after which the attempt is ABORTED/EXPIRED in SQL, so its own object must be removed
const ABORTING_FINALIZE_CODES = new Set(['quote_changed', 'issuer_changed', 'presentation_changed',
  'customer_changed_new_quote_required', 'style_not_entitled', 'media_not_entitled', 'paid_quote_policy_pending',
  'free_issue_limit_reached', 'quote_not_found', 'attempt_expired']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;
const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const isChannel = (v: unknown): v is OutputChannel => typeof v === 'string' && (OUTPUT_CHANNELS as readonly string[]).includes(v);
const isStyle = (v: unknown): v is StyleId => typeof v === 'string' && (STYLE_IDS as readonly string[]).includes(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fail = (status: number, code: string, extra: JsonObject = {}): OutputResponse => ({ status, body: { ok: false, code, ...extra } });
const unavailable = (code = 'output_unavailable'): OutputResponse => fail(503, code);
const fromCode = (data: JsonObject): OutputResponse => {
  const code = typeof data.code === 'string' ? data.code : '';
  const status = Object.prototype.hasOwnProperty.call(CODE_STATUS, code) ? CODE_STATUS[code] : undefined;
  if (status === undefined) return unavailable();
  const extra: JsonObject = {};
  if (isObject(data.freeIssues)) extra.freeIssues = data.freeIssues;
  return fail(status, code, extra);
};

/** Canonical JSON: object keys sorted recursively, no whitespace. Same input -> byte-identical output. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('canonicalJson: non-finite number');
    if (value === undefined) throw new TypeError('canonicalJson: undefined');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.byteLength === b.byteLength && a.every((x, i) => x === b[i]);

/** The bound presentation: style, version, branding and the ORDERED media manifest. */
export function presentationBody(intent: PresentationIntent): JsonObject {
  return { presentationProjection: PRESENTATION_PROJECTION, style: intent.style, styleVersion: intent.styleVersion,
    branding: intent.branding, media: intent.media.map((m) => ({ assetId: m.assetId, sha256: m.sha256, bytes: m.bytes })) };
}
export async function presentationDigest(intent: PresentationIntent, hash = sha256Hex): Promise<string> {
  return hash(new TextEncoder().encode(canonicalJson(presentationBody(intent))));
}

export type Preparing = {
  attemptId: string; ownerId: string; quoteId: string; customerBinding: string; channel: OutputChannel; style: StyleId;
  styleVersion: number; mediaCount: number; snapshotPath: string; contentDigest: string; currentDigest: string | null;
  issuerDigest: string; currentIssuerDigest: string | null; presentationDigest: string; reservedAt: string;
  document: Json; issuer: Json;
};
export function parsePreparing(d: JsonObject): Preparing | null {
  const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : null);
  const attemptId = s('attemptId'); const ownerId = s('ownerId'); const quoteId = s('quoteId');
  const snapshotPath = s('snapshotPath'); const contentDigest = s('contentDigest'); const reservedAt = s('reservedAt');
  const customerBinding = s('customerBinding'); const issuerDigest = s('issuerDigest'); const pDigest = s('presentationDigest');
  if (!attemptId || !UUID_RE.test(attemptId) || !ownerId || !quoteId || !customerBinding || !snapshotPath || !reservedAt
      || !contentDigest || !HEX64_RE.test(contentDigest) || !issuerDigest || !HEX64_RE.test(issuerDigest)
      || !pDigest || !HEX64_RE.test(pDigest) || !isChannel(d.channel) || !isStyle(d.style) || !isCount(d.mediaCount)
      || !isCount(d.styleVersion) || d.styleVersion < 1) return null;
  if (snapshotPath !== `issued-documents/${ownerId}/${quoteId}/${attemptId}.json`) return null;  // SQL-derived path only
  return { attemptId, ownerId, quoteId, customerBinding, channel: d.channel, style: d.style, styleVersion: d.styleVersion,
    mediaCount: d.mediaCount, snapshotPath, contentDigest, currentDigest: s('currentDigest'), issuerDigest,
    currentIssuerDigest: s('currentIssuerDigest'), presentationDigest: pDigest, reservedAt, document: d.document ?? null,
    issuer: d.issuer ?? null };
}

/** The immutable full-document snapshot. Deterministic for one attempt (no wall-clock value; the issue time is the ledger's
 *  finalizedAt, `preparedAt` is the reservation time). */
export function buildSnapshot(p: Preparing, intent: PresentationIntent): JsonObject {
  return {
    kind: SNAPSHOT_KIND, schemaVersion: SNAPSHOT_SCHEMA_VERSION, attemptId: p.attemptId, ownerId: p.ownerId, quoteId: p.quoteId,
    customerBinding: p.customerBinding, requestedChannel: p.channel, preparedAt: p.reservedAt,
    contentDigest: p.contentDigest, issuerDigest: p.issuerDigest, presentationDigest: p.presentationDigest,
    document: p.document, issuer: p.issuer, presentation: presentationBody(intent),
  };
}

/** Header ownership proof used ONLY to decide that a cleanup may delete an object: it carries this attempt's identity and
 *  all three bound digests. Never used to accept or finalize (that needs the full byte comparison). */
function headerOwnedBy(bytes: Uint8Array, a: { attemptId: string; ownerId: string; quoteId: string; contentDigest: string;
  issuerDigest: string; presentationDigest: string }): boolean {
  try {
    const o = JSON.parse(new TextDecoder().decode(bytes));
    return isObject(o) && o.kind === SNAPSHOT_KIND && o.schemaVersion === SNAPSHOT_SCHEMA_VERSION && o.attemptId === a.attemptId
      && o.ownerId === a.ownerId && o.quoteId === a.quoteId && o.contentDigest === a.contentDigest
      && o.issuerDigest === a.issuerDigest && o.presentationDigest === a.presentationDigest;
  } catch { return false; }
}

// ------------------------------------------------------------------------------------------------------------------------
// The ONE parser / normalizer of a FINALIZED response (CODEX_PREP_LOGO_FINAL_REVIEW section 7). Used for the three success
// paths: prepare that is already finalized (reuse / retry), a fresh finalize, and reveal. Every required field is checked and
// cross-checked; the 200 body is REBUILT from this explicit allowlist (an unknown field is never copied). Anything missing or
// wrong -> null -> the caller fails closed with 503.
// ------------------------------------------------------------------------------------------------------------------------
const ISSUED_PATH_RE = /^issued-documents\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.json$/;
export type FinalDescriptor = { path: string; sha256: string; bytes: number; schemaVersion: number; contentDigest: string;
  issuerDigest: string; presentationDigest: string };
export type ParsedFinal = { body: JsonObject; ownerId: string; attemptId: string; quoteId: string; firstChannel: OutputChannel;
  descriptor: FinalDescriptor };
export function parseFinal(raw: unknown, ctx: { quoteId: string; ownerId?: string }): ParsedFinal | null {
  if (!isObject(raw) || raw.ok !== true || raw.state !== 'finalized') return null;
  const { attemptId, quoteId, firstChannel, consumed, accountMode, finalizedAt } = raw;
  if (typeof attemptId !== 'string' || !UUID_RE.test(attemptId)) return null;
  if (typeof quoteId !== 'string' || !UUID_RE.test(quoteId) || quoteId !== ctx.quoteId) return null;   // the requested quote only
  if (!isChannel(firstChannel) || typeof consumed !== 'boolean' || (accountMode !== 'free_10' && accountMode !== 'paid')) return null;
  if (typeof finalizedAt !== 'string' || !Number.isFinite(Date.parse(finalizedAt))) return null;
  if (Object.prototype.hasOwnProperty.call(raw, 'alreadyFinalized') && typeof raw.alreadyFinalized !== 'boolean') return null;
  const d = raw.descriptor;
  if (!isObject(d) || typeof d.path !== 'string') return null;
  // canonical path, and the identities it encodes must be the response's own (owner = trusted caller when known)
  const m = d.path.match(ISSUED_PATH_RE);
  if (!m || !UUID_RE.test(m[1]) || m[2] !== quoteId || m[3] !== attemptId) return null;
  if (ctx.ownerId !== undefined && m[1] !== ctx.ownerId) return null;
  const hex = (v: Json | undefined): v is string => typeof v === 'string' && HEX64_RE.test(v);
  if (!hex(d.sha256) || !hex(d.contentDigest) || !hex(d.issuerDigest) || !hex(d.presentationDigest)) return null;
  if (!isCount(d.bytes) || d.bytes <= 0 || d.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null;
  const descriptor: FinalDescriptor = { path: d.path, sha256: d.sha256, bytes: d.bytes, schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    contentDigest: d.contentDigest, issuerDigest: d.issuerDigest, presentationDigest: d.presentationDigest };
  const body: JsonObject = { ok: true, state: 'finalized', attemptId, quoteId, firstChannel, consumed, accountMode, finalizedAt,
    descriptor: { ...descriptor } };
  if (typeof raw.alreadyFinalized === 'boolean') body.alreadyFinalized = raw.alreadyFinalized;
  return { body, ownerId: m[1], attemptId, quoteId, firstChannel, descriptor };
}

/** true when the issuer block carries a non-empty logo URL (NULL / empty / whitespace-only = no logo). Never fetched. */
export function hasLogo(issuer: unknown): boolean {
  return isObject(issuer) && typeof issuer.logo_url === 'string' && issuer.logo_url.trim() !== '';
}

function validIntent(v: unknown): v is PresentationIntent {
  return isObject(v) && isStyle(v.style) && isCount(v.styleVersion) && v.styleVersion >= 1 && Array.isArray(v.media)
    && v.media.every((m) => isObject(m) && typeof m.assetId === 'string' && m.assetId.length > 0 && typeof m.sha256 === 'string'
      && HEX64_RE.test(m.sha256) && isCount(m.bytes) && m.bytes > 0);
}

export function createQuoteOutputOrchestrator(deps: {
  sql: OutputSql; storage: SnapshotStorage; presentation: PresentationSource; assets: MediaAssetSource;
  hash?: (b: Uint8Array) => Promise<string>; onIncident?: (i: Incident) => void; writeAttempts?: number;
}) {
  const { sql, storage, presentation, assets } = deps;
  const hash = deps.hash ?? sha256Hex;
  const onIncident = deps.onIncident ?? (() => {});
  const writeAttempts = Math.max(1, deps.writeAttempts ?? 2);
  const call = async (f: () => Promise<unknown>): Promise<JsonObject | null> => {
    try { const r = await f(); return isObject(r) ? r : null; } catch { return null; }
  };

  /** Server-side presentation intent with every media ref verified against the owned asset object (hash + bytes). */
  async function verifiedIntent(userId: string, quoteId: string): Promise<{ ok: true; intent: PresentationIntent; digest: string } | { ok: false; res: OutputResponse }> {
    let intent: unknown;
    try { intent = await presentation.load(userId, quoteId); } catch { return { ok: false, res: unavailable() }; }
    if (!validIntent(intent)) return { ok: false, res: unavailable() };
    for (const m of intent.media) {
      let obj: Uint8Array | null;
      try { obj = await assets.read(userId, m.assetId); } catch { return { ok: false, res: unavailable('storage_unavailable') }; }
      if (!obj || obj.byteLength !== m.bytes || (await hash(obj)) !== m.sha256) {
        return { ok: false, res: fail(409, 'media_verification_failed', { assetId: m.assetId }) };
      }
    }
    return { ok: true, intent, digest: await presentationDigest(intent, hash) };
  }

  /** Remove the object at the attempt path only if it is proven to be this attempt's own snapshot. */
  async function cleanupOwned(a: { attemptId: string; ownerId: string; quoteId: string; contentDigest: string; issuerDigest: string;
    presentationDigest: string; snapshotPath: string }): Promise<string> {
    try {
      const obj = await storage.get(a.snapshotPath);
      if (obj && !headerOwnedBy(obj, a)) return 'kept_not_proven_owned';
      if (obj) await storage.remove(a.snapshotPath);
      await sql.markSnapshotDeleted({ attemptId: a.attemptId });
      return obj ? 'deleted' : 'absent';
    } catch { return 'cleanup_error'; }  // the reconciler retries
  }

  /** The single FULL verifier: drift checks against the bound reservation, then the expected canonical bytes. */
  function expectedFor(p: Preparing, intent: PresentationIntent, digest: string): { ok: true; bytes: Uint8Array } | { ok: false; code: string } {
    if (p.currentDigest !== p.contentDigest) return { ok: false, code: 'quote_changed' };
    if (p.currentIssuerDigest !== p.issuerDigest) return { ok: false, code: 'issuer_changed' };
    if (digest !== p.presentationDigest || intent.style !== p.style || intent.styleVersion !== p.styleVersion
        || intent.media.length !== p.mediaCount) return { ok: false, code: 'presentation_changed' };
    // defence in depth (SQL refuses it at prepare): a logo URL is mutable, so it never enters an issued snapshot
    if (hasLogo(p.issuer)) return { ok: false, code: 'logo_snapshot_policy_pending' };
    return { ok: true, bytes: new TextEncoder().encode(canonicalJson(buildSnapshot(p, intent))) };
  }

  /** Verifies the stored artifact of a FINALIZED descriptor. Never regenerates a document. */
  async function verifiedFinal(raw: unknown, ctx: { quoteId: string; ownerId?: string }): Promise<OutputResponse> {
    const f = parseFinal(raw, ctx);
    if (!f) return unavailable('final_response_invalid');
    const d = f.descriptor;
    let bytes: Uint8Array | null = null;
    try { bytes = await storage.get(d.path); } catch { return unavailable('storage_unavailable'); }
    if (!bytes || (await hash(bytes)) !== d.sha256 || bytes.byteLength !== d.bytes) {
      onIncident({ code: 'document_unavailable', attemptId: f.attemptId, quoteId: f.quoteId,
        detail: bytes ? 'stored snapshot hash/size mismatch' : 'stored snapshot missing' });
      return fail(410, 'document_unavailable', { attemptId: f.attemptId });
    }
    // the stored snapshot itself must carry the identities and digests the descriptor claims (ownership cross-check)
    if (!headerOwnedBy(bytes, { attemptId: f.attemptId, ownerId: f.ownerId, quoteId: f.quoteId, contentDigest: d.contentDigest,
      issuerDigest: d.issuerDigest, presentationDigest: d.presentationDigest })) {
      onIncident({ code: 'document_unavailable', attemptId: f.attemptId, quoteId: f.quoteId, detail: 'stored snapshot identity mismatch' });
      return unavailable('final_response_invalid');
    }
    return { status: 200, body: f.body };
  }

  /** The single output command for all four channels. `auth.userId` must come from the verified JWT. */
  async function output(auth: { userId: string }, body: unknown): Promise<OutputResponse> {
    if (!isObject(auth) || typeof auth.userId !== 'string' || !UUID_RE.test(auth.userId)) return fail(401, 'not_authenticated');
    if (!isObject(body)) return fail(400, 'invalid_request', { field: 'body' });
    const { quoteId, channel, idempotencyKey, expectedDigest } = body;
    if (typeof quoteId !== 'string' || !UUID_RE.test(quoteId)) return fail(400, 'invalid_request', { field: 'quoteId' });
    if (!isChannel(channel)) return fail(400, 'invalid_request', { field: 'channel' });  // preview/draft are not output channels
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 200) return fail(400, 'invalid_request', { field: 'idempotencyKey' });
    if (typeof expectedDigest !== 'string' || !HEX64_RE.test(expectedDigest)) return fail(400, 'invalid_request', { field: 'expectedDigest' });
    const userId = auth.userId;

    const v = await verifiedIntent(userId, quoteId);
    if (!v.ok) return v.res;
    const { intent, digest } = v;

    const prep = await call(() => sql.prepare({ userId, quoteId, channel, idempotencyKey, expectedDigest, style: intent.style,
      mediaCount: intent.media.length, styleVersion: intent.styleVersion, presentationDigest: digest }));
    if (!prep) return unavailable();
    if (prep.ok === true && prep.state === 'finalized') return verifiedFinal(prep, { quoteId, ownerId: userId });   // reuse / retry: durable final, no new consumption
    if (prep.ok !== true) return fromCode(prep);
    if (prep.state !== 'preparing') return unavailable();
    const p = parsePreparing(prep);
    if (!p || p.ownerId !== userId || p.quoteId !== quoteId) return unavailable();

    const expected = expectedFor(p, intent, digest);
    if (!expected.ok) {
      // the reservation can never finalize: abort it and remove ONLY its own (proven) object
      await call(() => sql.abort({ userId, attemptId: p.attemptId, failureCode: expected.code }));
      await cleanupOwned(p);
      return fail(409, expected.code);
    }

    // immutable write: create-only; an existing object is accepted only if byte-identical to the expected bytes
    let written = false;
    for (let i = 0; i < writeAttempts && !written; i++) {
      try {
        const r = await storage.put(p.snapshotPath, expected.bytes);
        if (r === 'created') written = true;
        else {
          const existing = await storage.get(p.snapshotPath);
          if (!existing || !sameBytes(existing, expected.bytes)) {
            await call(() => sql.abort({ userId, attemptId: p.attemptId, failureCode: 'snapshot_conflict' }));
            return fail(409, 'snapshot_conflict');  // never overwritten, never deleted: provenance unknown
          }
          written = true;
        }
      } catch { /* bounded retry of the same create to the same path */ }
    }
    if (!written) return unavailable('storage_unavailable');  // attempt stays PREPARING: same key retries; TTL expiry releases it

    // read back: the stored bytes must be exactly the expected bytes (hash, size and schema follow)
    let stored: Uint8Array | null = null;
    try { stored = await storage.get(p.snapshotPath); } catch { return unavailable('storage_unavailable'); }
    if (!stored || !sameBytes(stored, expected.bytes)) return unavailable('snapshot_readback_mismatch');
    const sha256 = await hash(stored);

    const fin = await call(() => sql.finalize({ userId, attemptId: p.attemptId, snapshotPath: p.snapshotPath, sha256,
      bytes: stored.byteLength, schemaVersion: SNAPSHOT_SCHEMA_VERSION, presentationDigest: digest }));
    if (!fin) return unavailable('finalize_outcome_unknown');  // retry with the same key returns the durable outcome
    if (fin.ok === true) {
      // the same parser, then cross-checked against the snapshot that was READ BACK and the trusted reservation context
      const f = parseFinal(fin, { quoteId, ownerId: userId });
      const d = f?.descriptor;
      const consistent = !!f && !!d && f.attemptId === p.attemptId && f.firstChannel === p.channel && d.path === p.snapshotPath
        && d.sha256 === sha256 && d.bytes === stored.byteLength && d.schemaVersion === SNAPSHOT_SCHEMA_VERSION
        && d.contentDigest === p.contentDigest && d.issuerDigest === p.issuerDigest && d.presentationDigest === p.presentationDigest;
      // malformed / inconsistent: fail closed. NO cleanup and no undo - SQL may have committed; a retry with the same key gets
      // the durable result through prepare -> parseFinal -> hash/size/identity verification, without a second consumption.
      if (!f || !consistent) return unavailable('final_response_invalid');
      return { status: 200, body: f.body };
    }
    const code = typeof fin.code === 'string' ? fin.code : '';
    if (ABORTING_FINALIZE_CODES.has(code)) await cleanupOwned(p);
    return fromCode(fin);
  }

  /** Read-only reveal for public link / send payload / final PDF / final Print: never consumes, never freezes, never creates. */
  async function reveal(quoteId: unknown): Promise<OutputResponse> {
    if (typeof quoteId !== 'string' || !UUID_RE.test(quoteId)) return fail(400, 'invalid_request', { field: 'quoteId' });
    const d = await call(() => sql.descriptor({ quoteId }));
    if (!d) return unavailable();
    if (d.ok !== true) return fromCode(d);
    return verifiedFinal(d, { quoteId });   // owner proven by the canonical path and cross-checked against the stored snapshot
  }

  /** Idempotent reconciler (no cron in prep). Acts on SQL state; finalizes only with the SAME full verifier as `output`. */
  async function reconcile(opts: { minAgeSeconds: number; limit: number }) {
    const log: JsonObject[] = [];
    let rows: unknown;
    try { rows = await sql.listForReconcile(opts); } catch { return { ok: false, log }; }
    if (!Array.isArray(rows)) return { ok: false, log };
    for (const r of rows) {
      if (!isObject(r) || typeof r.attemptId !== 'string' || typeof r.userId !== 'string' || typeof r.quoteId !== 'string'
          || typeof r.snapshotPath !== 'string') continue;
      const { attemptId, userId, quoteId, snapshotPath } = r;
      const bound = { attemptId, ownerId: userId, quoteId, snapshotPath, contentDigest: String(r.contentDigest),
        issuerDigest: String(r.issuerDigest), presentationDigest: String(r.presentationDigest) };
      try {
        if (r.state === 'preparing' && r.pastTtl !== true) {
          const st = await call(() => sql.attemptState({ userId, attemptId }));
          const p = st && st.ok === true ? parsePreparing(st) : null;
          if (!p) { log.push({ attemptId, action: 'skip_state_unavailable' }); continue; }
          const v = await verifiedIntent(userId, quoteId);
          if (!v.ok) { log.push({ attemptId, action: 'skip_presentation_unverified' }); continue; }
          const expected = expectedFor(p, v.intent, v.digest);
          if (!expected.ok) { log.push({ attemptId, action: 'skip_drift', code: expected.code }); continue; }
          const obj = await storage.get(snapshotPath);
          if (!obj) { log.push({ attemptId, action: 'skip_no_object' }); continue; }
          if (!sameBytes(obj, expected.bytes)) { log.push({ attemptId, action: 'skip_object_not_expected_bytes' }); continue; }
          const sha256 = await hash(obj);
          const fin = await call(() => sql.finalize({ userId, attemptId, snapshotPath, sha256, bytes: obj.byteLength,
            schemaVersion: SNAPSHOT_SCHEMA_VERSION, presentationDigest: v.digest }));
          const ok = !!fin && fin.ok === true;
          if (!ok && fin && ABORTING_FINALIZE_CODES.has(String(fin.code))) await cleanupOwned(bound);
          log.push({ attemptId, action: ok ? 'finalized' : 'finalize_refused', code: fin?.code ?? null });
        } else if (r.state === 'preparing') {
          await sql.abort({ userId, attemptId, failureCode: 'reservation_ttl' });
          log.push({ attemptId, action: 'expired', cleanup: await cleanupOwned(bound) });
        } else if ((r.state === 'aborted' || r.state === 'expired') && r.failureCode !== 'snapshot_conflict') {
          log.push({ attemptId, action: 'orphan_cleanup', cleanup: await cleanupOwned(bound) });
        } else if (r.failureCode === 'snapshot_conflict') {
          log.push({ attemptId, action: 'kept_conflict_object_unknown_provenance' });
        }
      } catch (e) {
        onIncident({ code: 'reconcile_error', attemptId, detail: String((e as Error)?.message ?? e) });
        log.push({ attemptId, action: 'error' });
      }
    }
    return { ok: true, log };
  }

  return { output, reveal, reconcile };
}
