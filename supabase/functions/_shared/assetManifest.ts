// Immutable media / attachment manifests and the reference-safe GC planner (spec Phase 3 "Attachments/catalog media",
// §8 "GC removes only assets proven unreferenced"; OD-18; OPEN-08 retention, OPEN-13 attachments).
// Pure module: no Deno globals, no I/O. Callers read the stored objects server-side and pass the facts they READ BACK.
//
// * A manifest entry binds owner, quote, asset id, canonical object path, sha256, bytes, MIME and version. Every entry is
//   checked against the object facts read back from Storage (never a client claim): owner, hash, size and MIME must match.
// * Attachments: eligibility, count, types and sizes are NOT decided (OPEN-13). The policy is configured-unset, so any
//   attachment entry fails closed with attachment_policy_pending. No value is invented here.
// * GC: deletes only objects that are owned by the requesting owner, are attempt/upload orphans, and are proven unreferenced by
//   a COMPLETE reference set. Anything retention-dependent (issued snapshots, finalized assets) is never deleted (OPEN-08).

export const MANIFEST_SCHEMA = 'asset-manifest/v1';
export const MEDIA_MIMES = Object.freeze(['image/jpeg', 'image/png', 'image/webp'] as const);
const EXT_FOR: Readonly<Record<string, string>> = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

// OPEN-13: every value null = configured-unset. Changing any of these needs an Owner decision; until then: fail closed.
export const ATTACHMENT_POLICY = Object.freeze({
  eligiblePlans: null as null | readonly string[],
  maxCount: null as null | number,
  allowedMimes: null as null | readonly string[],
  maxBytes: null as null | number,
  decision: 'OPEN-13',
});
export type AttachmentPolicy = typeof ATTACHMENT_POLICY;

export function attachmentPolicyState(policy: { eligiblePlans: unknown; maxCount: unknown; allowedMimes: unknown; maxBytes: unknown } = ATTACHMENT_POLICY):
  { configured: false; code: 'attachment_policy_pending' } | { configured: true } {
  const set = Array.isArray(policy.eligiblePlans) && Number.isInteger(policy.maxCount) && Array.isArray(policy.allowedMimes)
    && Number.isInteger(policy.maxBytes);
  return set ? { configured: true } : { configured: false, code: 'attachment_policy_pending' };
}

export type ManifestKind = 'quote_media' | 'attachment';
export type ManifestInput = { kind: ManifestKind; assetId: string; ownerId: string; quoteId: string; path: string; sha256: string;
  bytes: number; mime: string; version: number };
/** What the server READ BACK for the object at `path` (owner = the folder the object lives under; never a client value). */
export type StoredFacts = { path: string; ownerId: string; sha256: string; bytes: number; mime: string } | null;
export type ManifestEntry = Readonly<ManifestInput>;
export type ManifestResult =
  | { ok: true; manifest: { schema: typeof MANIFEST_SCHEMA; ownerId: string; quoteId: string; entries: readonly ManifestEntry[] } }
  | { ok: false; code: ManifestFailure; index?: number };
export type ManifestFailure = 'invalid_manifest' | 'owner_mismatch' | 'hash_mismatch' | 'size_mismatch' | 'mime_mismatch'
  | 'object_missing' | 'path_mismatch' | 'duplicate_entry' | 'attachment_policy_pending';

/** Canonical quote-media path (quote-presentation layout): t16-presentation/<owner>/assets/<assetId>.<ext>. */
export function quoteMediaPath(ownerId: string, assetId: string, mime: string): string | null {
  const ext = EXT_FOR[mime];
  return ext && UUID_RE.test(ownerId) && UUID_RE.test(assetId) ? `t16-presentation/${ownerId}/assets/${assetId}.${ext}` : null;
}

function validShape(e: unknown): e is ManifestInput {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  return (x.kind === 'quote_media' || x.kind === 'attachment') && typeof x.assetId === 'string' && UUID_RE.test(x.assetId)
    && typeof x.ownerId === 'string' && UUID_RE.test(x.ownerId) && typeof x.quoteId === 'string' && UUID_RE.test(x.quoteId)
    && typeof x.path === 'string' && x.path.length > 0 && !x.path.includes('..') && !x.path.startsWith('/')
    && typeof x.sha256 === 'string' && HEX64_RE.test(x.sha256) && Number.isSafeInteger(x.bytes) && (x.bytes as number) > 0
    && typeof x.mime === 'string' && Number.isSafeInteger(x.version) && (x.version as number) >= 1;
}

/**
 * Builds the immutable manifest for one quote of one owner. `readBack(path)` returns the facts of the stored object.
 * Order is preserved (it is part of the bound presentation). Any mismatch fails the WHOLE manifest (no partial manifest).
 */
export async function buildAssetManifest(
  owner: { ownerId: string; quoteId: string },
  inputs: readonly unknown[],
  readBack: (path: string) => Promise<StoredFacts>,
  policy: Parameters<typeof attachmentPolicyState>[0] = ATTACHMENT_POLICY,
): Promise<ManifestResult> {
  if (!UUID_RE.test(owner?.ownerId ?? '') || !UUID_RE.test(owner?.quoteId ?? '') || !Array.isArray(inputs)) return { ok: false, code: 'invalid_manifest' };
  const seen = new Set<string>();
  const entries: ManifestEntry[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const e = inputs[i];
    if (!validShape(e)) return { ok: false, code: 'invalid_manifest', index: i };
    if (e.kind === 'attachment' && !attachmentPolicyState(policy).configured) return { ok: false, code: 'attachment_policy_pending', index: i };
    if (e.ownerId !== owner.ownerId || e.quoteId !== owner.quoteId) return { ok: false, code: 'owner_mismatch', index: i };
    if (!(MEDIA_MIMES as readonly string[]).includes(e.mime) && e.kind === 'quote_media') return { ok: false, code: 'mime_mismatch', index: i };
    if (e.kind === 'quote_media' && e.path !== quoteMediaPath(e.ownerId, e.assetId, e.mime)) return { ok: false, code: 'path_mismatch', index: i };
    const key = `${e.kind}:${e.assetId}`;
    if (seen.has(key)) return { ok: false, code: 'duplicate_entry', index: i };
    seen.add(key);
    let facts: StoredFacts;
    try { facts = await readBack(e.path); } catch { return { ok: false, code: 'object_missing', index: i }; }
    if (!facts) return { ok: false, code: 'object_missing', index: i };
    if (facts.path !== e.path) return { ok: false, code: 'path_mismatch', index: i };
    if (facts.ownerId !== e.ownerId) return { ok: false, code: 'owner_mismatch', index: i };
    if (facts.sha256 !== e.sha256) return { ok: false, code: 'hash_mismatch', index: i };
    if (facts.bytes !== e.bytes) return { ok: false, code: 'size_mismatch', index: i };
    if (facts.mime !== e.mime) return { ok: false, code: 'mime_mismatch', index: i };
    entries.push(Object.freeze({ kind: e.kind, assetId: e.assetId, ownerId: e.ownerId, quoteId: e.quoteId, path: e.path,
      sha256: e.sha256, bytes: e.bytes, mime: e.mime, version: e.version }));
  }
  return { ok: true, manifest: Object.freeze({ schema: MANIFEST_SCHEMA, ownerId: owner.ownerId, quoteId: owner.quoteId, entries: Object.freeze(entries) }) };
}

// ---------------------------------------------------------------------------------------------------------------------
// GC planner. Candidates come from a listing of the owner's own prefix; references from EVERY reader that can point at an
// object (drafts, catalog links, presentation issued.json snapshots, issued-documents snapshots, signed-retention holds).
// `referencesComplete` must be explicitly true (the caller proved it read every reference source); otherwise nothing is
// deleted. Retention-dependent classes are never deleted while OPEN-08 is undecided.
// ---------------------------------------------------------------------------------------------------------------------
export type GcClass = 'attempt_orphan' | 'upload_orphan' | 'issued_snapshot' | 'finalized_asset' | 'logo_asset' | 'unknown';
export type GcCandidate = { path: string; ownerId: string; class: GcClass };
export type GcPlan = { delete: string[]; keep: { path: string; reason: string }[] };
export const RETENTION_DELETION_ENABLED = false; // OPEN-08: no retention policy -> retention-dependent deletion disabled

export function planGarbageCollection(input: { ownerId: string; candidates: readonly GcCandidate[]; references: Iterable<string>;
  referencesComplete: boolean }): GcPlan {
  const plan: GcPlan = { delete: [], keep: [] };
  const refs = new Set(Array.from(input.references ?? [], String));
  for (const c of input.candidates ?? []) {
    if (!c || typeof c.path !== 'string') continue;
    if (!UUID_RE.test(input.ownerId ?? '') || c.ownerId !== input.ownerId || !pathOwnedBy(c.path, input.ownerId)) {
      plan.keep.push({ path: c.path, reason: 'not_owned' }); continue;
    }
    if (c.class !== 'attempt_orphan' && c.class !== 'upload_orphan') {
      plan.keep.push({ path: c.path, reason: RETENTION_DELETION_ENABLED ? 'class_not_collectable' : 'retention_policy_pending' }); continue;
    }
    if (input.referencesComplete !== true) { plan.keep.push({ path: c.path, reason: 'references_incomplete' }); continue; }
    if (refs.has(c.path)) { plan.keep.push({ path: c.path, reason: 'referenced' }); continue; }
    plan.delete.push(c.path);
  }
  return plan;
}

/** The object lives under one of the owner's server-only prefixes (never another account's folder). */
export function pathOwnedBy(path: string, ownerId: string): boolean {
  if (typeof path !== 'string' || path.includes('..') || path.startsWith('/')) return false;
  return path.startsWith(`t16-presentation/${ownerId}/`) || path.startsWith(`account-assets/${ownerId}/`)
    || path.startsWith(`issued-documents/${ownerId}/`);
}

/** Every asset id an issued presentation snapshot / draft / catalog references (for the reference set). */
export function referencedAssetPaths(ownerId: string, docs: readonly unknown[], extOf: (assetId: string) => string | null): string[] {
  const out = new Set<string>();
  const add = (id: unknown) => {
    if (typeof id !== 'string' || !UUID_RE.test(id.toLowerCase())) return;
    const ext = extOf(id.toLowerCase());
    out.add(`t16-presentation/${ownerId}/assets/${id.toLowerCase()}.json`);
    if (ext) out.add(`t16-presentation/${ownerId}/assets/${id.toLowerCase()}.${ext}`);
  };
  for (const d of docs ?? []) {
    if (!d || typeof d !== 'object') continue;
    const media = (d as { media?: unknown }).media;
    if (Array.isArray(media)) for (const m of media) add((m as { assetId?: unknown })?.assetId);
    const links = (d as { links?: unknown }).links;
    if (links && typeof links === 'object') for (const l of Object.values(links as Record<string, unknown>)) add((l as { assetId?: unknown })?.assetId);
    const pres = (d as { presentation?: { media?: unknown } }).presentation;
    if (pres && Array.isArray(pres.media)) for (const m of pres.media) add((m as { assetId?: unknown })?.assetId);
  }
  return [...out];
}
