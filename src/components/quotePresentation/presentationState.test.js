import { describe, it, expect } from 'vitest';
import {
  addMedia, bindCatalogMedia, createPristinePresentation, isPristinePresentation, itemKeyOptions, moveMedia, needsDowngradeNotice,
  normalizeItemKey, normalizePresentationState, removeMediaAt, resolveCreatorStyle, sameServerPresentation, toServerMedia, updateMediaAt, MAX_MEDIA_REFS,
} from './presentationState';
import { normalizeItemKey as mediaNormalizeItemKey } from '../../quoteDocument/quoteMediaModel';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('presentation draft state', () => {
  it('normalizes garbage / old drafts to the pristine state and never throws', () => {
    for (const raw of [null, undefined, 3, 'x', [], { style: 'gold', media: 'no', detail: 'huge' }]) {
      expect(normalizePresentationState(raw)).toEqual({ style: null, media: [], detail: null });
    }
    expect(isPristinePresentation(createPristinePresentation())).toBe(true);
  });

  it('itemKey uses the same rule as QuoteMedia.normalizeItemKey (trim, collapse whitespace, lowercase)', () => {
    for (const t of ['  Aluminum   Window ', 'X', '', '   ', ' חלון  אלומיניום']) expect(normalizeItemKey(t)).toBe(mediaNormalizeItemKey(t));
  });

  it('item role requires an itemKey; other roles never carry one; order is contiguous; captions are limited to 140', () => {
    const s = normalizePresentationState({ media: [
      { assetId: A, role: 'item', itemKey: null, order: 5 },
      { assetId: B, role: 'hero', itemKey: 'x', caption: 'c'.repeat(200), order: 1 },
    ] });
    expect(s.media.map((m) => [m.assetId, m.role, m.itemKey, m.order])).toEqual([[B, 'hero', null, 0], [A, 'support', null, 1]]);
    expect(s.media[0].caption).toHaveLength(140);
  });

  it('add / move / update / remove keep a valid list and remove never touches other refs', () => {
    let s = createPristinePresentation();
    s = addMedia(s, { assetId: A, role: 'support' }).state;
    s = addMedia(s, { assetId: B, role: 'support' }).state;
    s = addMedia(s, { assetId: C, role: 'support' }).state;
    s = moveMedia(s, 2, -1);
    expect(s.media.map((m) => m.assetId)).toEqual([A, C, B]);
    expect(moveMedia(s, 0, -1)).toEqual(s);
    s = updateMediaAt(s, 1, { caption: 'Kitchen' });
    expect(s.media[1]).toMatchObject({ caption: 'Kitchen', alt: 'Kitchen' });
    s = updateMediaAt(s, 1, { role: 'item', itemKey: 'window' });
    expect(s.media[1]).toMatchObject({ role: 'item', itemKey: 'window' });
    s = updateMediaAt(s, 1, { role: 'hero' });
    expect(s.media[1].itemKey).toBe(null);
    s = removeMediaAt(s, 0);
    expect(s.media.map((m) => [m.assetId, m.order])).toEqual([[C, 0], [B, 1]]);
  });

  it('caps the list at 12 images', () => {
    let s = createPristinePresentation();
    for (let i = 0; i < MAX_MEDIA_REFS; i += 1) s = addMedia(s, { assetId: `a${i}`, role: 'support' }).state;
    const r = addMedia(s, { assetId: 'extra', role: 'support' });
    expect(r.added).toBe(false);
    expect(r.reason).toBe('too_many_media');
    expect(r.state.media).toHaveLength(MAX_MEDIA_REFS);
  });

  it('catalog binding adds an item image for the row once (idempotent)', () => {
    let r = bindCatalogMedia(createPristinePresentation(), { assetId: A, caption: 'Window', description: ' Aluminum  Window ' });
    expect(r.added).toBe(true);
    expect(r.state.media[0]).toMatchObject({ assetId: A, role: 'item', itemKey: 'aluminum window', caption: 'Window' });
    r = bindCatalogMedia(r.state, { assetId: A, caption: 'Window', description: 'aluminum window' });
    expect(r.added).toBe(false);
    expect(r.state.media).toHaveLength(1);
  });

  it('server media shape and equality ignore the local-only detail preference', () => {
    const a = { style: 'modern', media: [{ assetId: A, caption: 'x', role: 'support' }], detail: 'expanded' };
    const b = { style: 'modern', media: [{ assetId: A, caption: 'x', alt: 'x', role: 'support', order: 0 }], detail: null };
    expect(sameServerPresentation(a, b)).toBe(true);
    expect(toServerMedia(a.media)).toEqual([{ assetId: A, caption: 'x', alt: 'x', role: 'support', itemKey: null, order: 0 }]);
  });

  it('effective style: draft override -> business default -> Classic; downgrade is reported, never rewritten', () => {
    expect(resolveCreatorStyle({ presentation: null, businessDefault: null, tier: 'classic' })).toEqual({ style: 'classic', source: 'fallback', entitled: true });
    expect(resolveCreatorStyle({ presentation: null, businessDefault: 'modern', tier: 'modern' })).toMatchObject({ style: 'modern', source: 'business_default' });
    expect(resolveCreatorStyle({ presentation: { style: 'visual' }, businessDefault: 'modern', tier: 'modern' })).toMatchObject({ style: 'visual', source: 'draft', entitled: false });
    expect(needsDowngradeNotice({ presentation: { style: 'visual' }, tier: 'modern' })).toBe(true);
    expect(needsDowngradeNotice({ presentation: { style: 'modern' }, tier: 'modern' })).toBe(false);
  });

  it('item options are distinct non-empty descriptions in item order', () => {
    expect(itemKeyOptions([{ description: 'Door' }, { description: '' }, { description: ' door ' }, { description: 'Window' }]))
      .toEqual([{ key: 'door', label: 'Door' }, { key: 'window', label: 'Window' }]);
  });
});
