// subscription-authority - I/O adapters from a minimal Supabase-like client shape to the pure interfaces (orchestrator,
// output route, logo import). No Deno globals and no remote imports: the Edge entry passes the real supabase-js client;
// tests pass in-memory fakes. Every adapter reads with the SERVICE client and takes the user id from the verified JWT.
import type { MediaAssetSource, OutputSql, PresentationIntent, PresentationSource, SnapshotStorage } from './authorizeOutput.ts';
import type { AssetSql, AssetStorage } from './authority.ts';
import { classifyPhaseRead, isMissingRelationError } from '../_shared/activationPhase.ts';
import {
  BUCKET, assetMetaPath, assetObjectPath, draftPath, extForMime, isStorageConflict, isStorageNotFound, normalizeStoredDraft,
  readDefaultStyle, settingsPath,
} from '../quote-presentation/lib.ts';
import { DEFAULT_QUOTE_STYLE, QUOTE_STYLE_VERSIONS, styleSupportsImages } from '../_shared/quoteStyleCapabilities.ts';

export type RpcResult = { data: unknown; error: unknown };
export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
export interface BucketApi {
  upload(path: string, bytes: Uint8Array, opts: { contentType: string; upsert: boolean; cacheControl?: string }): Promise<{ error: unknown }>;
  download(path: string): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> } | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
}
export interface TableReader {
  /** select `columns` from `table` where `column` = `value`, at most one row */
  one(table: string, columns: string, column: string, value: string): Promise<RpcResult>;
}

const HEX64 = /^[0-9a-f]{64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** rpc that throws on error (the orchestrator converts a throw into a fail-closed 503) */
export function strictRpc(rpc: Rpc) {
  return async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const { data, error } = await rpc(fn, args);
    if (error) throw new Error(`${fn}_failed`);
    return data;
  };
}

// ------------------------------------------------------------------------------------------------ orchestrator SQL
export function rpcOutputSql(rpc: Rpc): OutputSql {
  const call = strictRpc(rpc);
  return {
    prepare: (a) => call('prepare_quote_output', { p_user_id: a.userId, p_quote_id: a.quoteId, p_channel: a.channel,
      p_idempotency_key: a.idempotencyKey, p_expected_digest: a.expectedDigest, p_style: a.style, p_media_count: a.mediaCount,
      p_style_version: a.styleVersion, p_presentation_digest: a.presentationDigest }),
    finalize: (a) => call('finalize_quote_output', { p_user_id: a.userId, p_attempt_id: a.attemptId, p_snapshot_path: a.snapshotPath,
      p_sha256: a.sha256, p_bytes: a.bytes, p_schema_version: a.schemaVersion, p_presentation_digest: a.presentationDigest }),
    abort: (a) => call('abort_quote_output', { p_user_id: a.userId, p_attempt_id: a.attemptId, p_failure_code: a.failureCode }),
    descriptor: (a) => call('get_output_descriptor', { p_quote_id: a.quoteId }),
    attemptState: (a) => call('get_output_attempt_state', { p_user_id: a.userId, p_attempt_id: a.attemptId }),
    listForReconcile: (a) => call('list_output_attempts_for_reconcile', { p_min_age: `${Math.max(0, Math.floor(a.minAgeSeconds))} seconds`, p_limit: a.limit }),
    markSnapshotDeleted: (a) => call('mark_output_snapshot_deleted', { p_attempt_id: a.attemptId }),
  };
}

// ------------------------------------------------------------------------------------------------ Storage
export async function readBytes(bucket: BucketApi, path: string): Promise<Uint8Array | null> {
  const { data, error } = await bucket.download(path);
  if (error) {
    if (isStorageNotFound(error)) return null;
    throw new Error('storage_unavailable');
  }
  if (!data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
export async function readJsonObject(bucket: BucketApi, path: string): Promise<unknown | null> {
  const b = await readBytes(bucket, path);
  if (!b) return null;
  return JSON.parse(new TextDecoder().decode(b)); // corrupt -> throws -> fail closed
}
/** create-only write: 'created', or 'exists' on an upsert:false conflict; any other failure throws */
export async function putNew(bucket: BucketApi, path: string, bytes: Uint8Array, contentType: string): Promise<'created' | 'exists'> {
  const { error } = await bucket.upload(path, bytes, { contentType, upsert: false, cacheControl: '0' });
  if (!error) return 'created';
  if (isStorageConflict(error)) return 'exists';
  throw new Error('storage_unavailable');
}

export function bucketSnapshotStorage(bucket: BucketApi): SnapshotStorage {
  return {
    put: (path, bytes) => putNew(bucket, path, bytes, 'application/json'),
    get: (path) => readBytes(bucket, path),
    remove: async (path) => {
      const { error } = await bucket.remove([path]);
      if (error && !isStorageNotFound(error)) throw new Error('storage_unavailable');
    },
  };
}

// ------------------------------------------------------------------------------------------------ presentation intent
type AssetMeta = { id: string; mime: string; sha256: string; bytes: number };
function parseMeta(raw: unknown, assetId: string): AssetMeta | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || raw.id.toLowerCase() !== assetId) return null;
  if (!extForMime(raw.mime) || typeof raw.sha256 !== 'string' || !HEX64.test(raw.sha256) || !Number.isSafeInteger(raw.bytes) || (raw.bytes as number) <= 0) return null;
  return { id: assetId, mime: raw.mime as string, sha256: raw.sha256, bytes: raw.bytes as number };
}

/**
 * Server-side presentation intent from the owner's quote-presentation draft + default style + asset metas.
 * The `branding` slot of the prep presentation body carries the media LAYOUT projection (role / item / caption / alt / order),
 * so captions are bound by the presentation digest and can be rendered from the immutable snapshot. It carries no business
 * identity: the issuer (incl. logo) is bound separately by SQL (issuer/v1). A draft media ref whose meta is missing or not the
 * owner's is mapped to an unverifiable ref, so the orchestrator answers media_verification_failed (never a silent drop).
 */
export function storagePresentationSource(bucket: BucketApi): PresentationSource {
  return {
    async load(userId: string, quoteId: string): Promise<PresentationIntent> {
      const [draftRaw, settingsRaw] = await Promise.all([readJsonObject(bucket, draftPath(userId, quoteId)), readJsonObject(bucket, settingsPath(userId))]);
      const draft = normalizeStoredDraft(draftRaw);
      const style = draft?.style ?? readDefaultStyle(settingsRaw) ?? DEFAULT_QUOTE_STYLE;
      const layout = draft && styleSupportsImages(style) ? draft.media : [];
      const media = await Promise.all(layout.map(async (m) => {
        const meta = parseMeta(await readJsonObject(bucket, assetMetaPath(userId, m.assetId)), m.assetId);
        return meta ? { assetId: m.assetId, sha256: meta.sha256, bytes: meta.bytes } : { assetId: m.assetId, sha256: '0'.repeat(64), bytes: 1 };
      }));
      return {
        style, styleVersion: QUOTE_STYLE_VERSIONS[style],
        branding: { layoutProjection: 'presentation-layout/v1',
          media: layout.map((m) => ({ assetId: m.assetId, role: m.role, itemKey: m.itemKey, caption: m.caption, alt: m.alt, order: m.order })) },
        media,
      };
    },
  };
}

/** Owner-scoped read of an uploaded media asset: only under the owner's own prefix, only when its meta agrees. */
export function storageMediaAssetSource(bucket: BucketApi): MediaAssetSource {
  return {
    async read(userId: string, assetId: string): Promise<Uint8Array | null> {
      const meta = parseMeta(await readJsonObject(bucket, assetMetaPath(userId, assetId)), assetId.toLowerCase());
      const ext = meta ? extForMime(meta.mime) : null;
      if (!meta || !ext) return null;
      return readBytes(bucket, assetObjectPath(userId, assetId, ext));
    },
  };
}

// ------------------------------------------------------------------------------------------------ phase / market / capabilities
export function freeIssuePhaseReader(tables: TableReader) {
  return async (): Promise<string> => classifyPhaseRead(await tables.one('subscription_activation', 'phase', 'component', 'free_issue'));
}

export function marketInputsReader(tables: TableReader) {
  return async (userId: string) => {
    const [am, bs] = await Promise.all([
      tables.one('account_market', 'market', 'user_id', userId),
      tables.one('business_settings', 'country', 'user_id', userId),
    ]);
    // account_market absent in this environment (table missing) = no server market row; any other error fails closed
    const amMissing = !!am.error && isMissingRelationError(am.error, 'account_market');
    if ((am.error && !amMissing) || bs.error) throw new Error('market_unavailable');
    return { accountMarket: amMissing ? undefined : (am.data as { market?: unknown } | null)?.market, businessCountry: (bs.data as { country?: unknown } | null)?.country };
  };
}

export function capabilityRpcs(rpc: Rpc) {
  const call = strictRpc(rpc);
  return {
    mintCapability: (a: { userId: string; attemptId: string; tokenHash: string; allowedOps: string[]; expiresAt: string | null }) =>
      call('mint_public_capability', { p_user_id: a.userId, p_attempt_id: a.attemptId, p_token_hash: a.tokenHash, p_allowed_ops: a.allowedOps, p_expires_at: a.expiresAt }),
    issueGrant: (a: { userId: string; attemptId: string; channel: string; grantHash: string; ttlSeconds: number }) =>
      call('issue_output_grant', { p_user_id: a.userId, p_attempt_id: a.attemptId, p_channel: a.channel, p_grant_hash: a.grantHash, p_ttl_seconds: a.ttlSeconds }),
  };
}

// ------------------------------------------------------------------------------------------------ logo (billing/assets SQL)
export function rpcAssetSql(rpc: Rpc): AssetSql {
  const call = strictRpc(rpc);
  return {
    reserveLogo: async (a) => (await call('reserve_logo_asset', { p_owner_id: a.ownerId, p_mime: a.mime, p_sha256: a.sha256, p_bytes: a.bytes,
      p_width: a.width, p_height: a.height })) as Record<string, unknown>,
    finalizeLogo: async (a) => (await call('finalize_logo_asset', { p_owner_id: a.ownerId, p_asset_id: a.assetId, p_sha256: a.sha256,
      p_bytes: a.bytes })) as Record<string, unknown>,
  };
}
export function bucketAssetStorage(bucket: BucketApi): AssetStorage {
  return { putNew: (path, bytes, contentType) => putNew(bucket, path, bytes, contentType), read: (path) => readBytes(bucket, path) };
}

export { BUCKET };
