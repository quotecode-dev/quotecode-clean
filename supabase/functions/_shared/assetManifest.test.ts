// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  ATTACHMENT_POLICY, attachmentPolicyState, buildAssetManifest, planGarbageCollection, quoteMediaPath, referencedAssetPaths,
  RETENTION_DELETION_ENABLED, type StoredFacts,
} from './assetManifest';

const OWN = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const Q = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const A2 = '44444444-4444-4444-8444-444444444444';
const H1 = '1'.repeat(64); const H2 = '2'.repeat(64);
const media = (assetId: string, sha256: string, extra: Record<string, unknown> = {}) => ({ kind: 'quote_media', assetId, ownerId: OWN, quoteId: Q,
  path: quoteMediaPath(OWN, assetId, 'image/png')!, sha256, bytes: 100, mime: 'image/png', version: 1, ...extra });
const store = (facts: Record<string, StoredFacts>) => vi.fn(async (p: string) => facts[p] ?? null);
const factsFor = (assetId: string, sha256: string, over: Partial<NonNullable<StoredFacts>> = {}) => ({ path: quoteMediaPath(OWN, assetId, 'image/png')!, ownerId: OWN, sha256, bytes: 100, mime: 'image/png', ...over });

describe('buildAssetManifest: every entry checked against the READ-BACK object facts', () => {
  it('ordered, immutable manifest for a valid set', async () => {
    const read = store({ [factsFor(A1, H1).path]: factsFor(A1, H1), [factsFor(A2, H2).path]: factsFor(A2, H2) });
    const r = await buildAssetManifest({ ownerId: OWN, quoteId: Q }, [media(A2, H2), media(A1, H1)], read);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.entries.map((e) => e.assetId)).toEqual([A2, A1]);
      expect(Object.isFrozen(r.manifest.entries[0])).toBe(true);
    }
  });
  it.each([
    ['owner mismatch (entry claims another owner)', [media(A1, H1, { ownerId: OTHER })], {}, 'owner_mismatch'],
    ['owner mismatch (object lives under another owner)', [media(A1, H1)], { ownerId: OTHER }, 'owner_mismatch'],
    ['hash mismatch (bytes replaced at the same path)', [media(A1, H1)], { sha256: H2 }, 'hash_mismatch'],
    ['size mismatch', [media(A1, H1)], { bytes: 101 }, 'size_mismatch'],
    ['MIME mismatch', [media(A1, H1)], { mime: 'image/jpeg' }, 'mime_mismatch'],
    ['quote mismatch', [media(A1, H1, { quoteId: A2 })], {}, 'owner_mismatch'],
    ['non-canonical path', [media(A1, H1, { path: `t16-presentation/${OWN}/assets/${A2}.png` })], {}, 'path_mismatch'],
    ['duplicate entry', [media(A1, H1), media(A1, H1)], {}, 'duplicate_entry'],
    ['svg', [media(A1, H1, { mime: 'image/svg+xml' })], {}, 'mime_mismatch'],
    ['malformed', [{ kind: 'quote_media', assetId: 'x' }], {}, 'invalid_manifest'],
  ])('%s -> %s (whole manifest refused)', async (_n, inputs, over, code) => {
    const read = store({ [factsFor(A1, H1).path]: factsFor(A1, H1, over as never) });
    const r = await buildAssetManifest({ ownerId: OWN, quoteId: Q }, inputs, read);
    expect(r).toMatchObject({ ok: false, code });
  });
  it('a missing object fails closed', async () => {
    expect(await buildAssetManifest({ ownerId: OWN, quoteId: Q }, [media(A1, H1)], store({}))).toMatchObject({ ok: false, code: 'object_missing' });
  });
});

describe('attachments: OPEN-13 configured-unset -> attachment_policy_pending (fail closed)', () => {
  it('the policy has no invented value', () => {
    expect(ATTACHMENT_POLICY).toMatchObject({ eligiblePlans: null, maxCount: null, allowedMimes: null, maxBytes: null });
    expect(attachmentPolicyState()).toEqual({ configured: false, code: 'attachment_policy_pending' });
  });
  it('any attachment entry is refused before any Storage read', async () => {
    const read = vi.fn();
    const r = await buildAssetManifest({ ownerId: OWN, quoteId: Q }, [{ ...media(A1, H1), kind: 'attachment', path: `${OWN}/${Q}_1.pdf`, mime: 'application/pdf' }], read);
    expect(r).toMatchObject({ ok: false, code: 'attachment_policy_pending' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('GC: only owned attempt/upload orphans proven unreferenced; retention-dependent deletion disabled', () => {
  const p = (id: string, ext = 'png') => `t16-presentation/${OWN}/assets/${id}.${ext}`;
  it('deletes an unreferenced owned orphan; keeps referenced, foreign, retention-dependent', () => {
    const plan = planGarbageCollection({ ownerId: OWN, referencesComplete: true, references: [p(A1)], candidates: [
      { path: p(A1), ownerId: OWN, class: 'upload_orphan' },
      { path: p(A2), ownerId: OWN, class: 'upload_orphan' },
      { path: `issued-documents/${OWN}/${Q}/${A1}.json`, ownerId: OWN, class: 'issued_snapshot' },
      { path: `account-assets/${OWN}/${A2}.png`, ownerId: OWN, class: 'logo_asset' },
      { path: `t16-presentation/${OTHER}/assets/${A2}.png`, ownerId: OWN, class: 'upload_orphan' },
      { path: `t16-presentation/${OTHER}/assets/${A1}.png`, ownerId: OTHER, class: 'attempt_orphan' },
    ] });
    expect(plan.delete).toEqual([p(A2)]);
    expect(plan.keep.map((k) => k.reason)).toEqual(['referenced', 'retention_policy_pending', 'retention_policy_pending', 'not_owned', 'not_owned']);
    expect(RETENTION_DELETION_ENABLED).toBe(false);
  });
  it('incomplete reference proof deletes nothing', () => {
    expect(planGarbageCollection({ ownerId: OWN, referencesComplete: false, references: [], candidates: [{ path: p(A2), ownerId: OWN, class: 'attempt_orphan' }] }).delete).toEqual([]);
  });
  it('an asset referenced by an issued presentation snapshot is in the reference set, so it can never be collected', () => {
    const issued = { v: 1, style: 'modern', media: [{ assetId: A1 }] };
    const refs = referencedAssetPaths(OWN, [issued, { links: { 7: { assetId: A2 } } }], () => 'png');
    expect(refs).toEqual(expect.arrayContaining([p(A1), p(A1, 'json'), p(A2)]));
    const plan = planGarbageCollection({ ownerId: OWN, referencesComplete: true, references: refs,
      candidates: [{ path: p(A1), ownerId: OWN, class: 'upload_orphan' }, { path: p(A2), ownerId: OWN, class: 'upload_orphan' }] });
    expect(plan.delete).toEqual([]);
  });
});
