import { describe, it, expect } from 'vitest';
import * as client from './quoteStyles.js';
import * as server from '../../supabase/functions/_shared/quoteStyleCapabilities.ts';

// The authoritative quote-presentation function decides entitlement with the Deno twin; the creator UI and the landing
// comparison use quoteStyles.js. Any drift would let the UI promise what the server refuses (or the reverse).
describe('quoteStyleCapabilities.ts parity with quoteStyles.js (Task 16)', () => {
  it('has identical style ids, versions, default, tiers and commercial mapping status', () => {
    expect(server.QUOTE_STYLE_IDS).toEqual(client.QUOTE_STYLE_IDS);
    expect(server.QUOTE_STYLE_VERSIONS).toEqual(client.QUOTE_STYLE_VERSIONS);
    expect(server.DEFAULT_QUOTE_STYLE).toBe(client.DEFAULT_QUOTE_STYLE);
    expect(JSON.parse(JSON.stringify(server.PRESENTATION_TIERS))).toEqual(JSON.parse(JSON.stringify(client.PRESENTATION_TIERS)));
    expect(server.COMMERCIAL_MAPPING_STATUS).toBe(client.COMMERCIAL_MAPPING_STATUS);
    expect(server.COMMERCIAL_MAPPING_STATUS).toBe('pending_owner_decision');
  });

  const values = ['classic', 'modern', 'visual', 'Classic', 'pro', 'free', '', null, undefined, 1, {}, ['classic']];

  it('normalizeStyleId / normalizeTierId / styleSupportsImages agree on every input', () => {
    for (const v of values) {
      expect(server.normalizeStyleId(v), String(v)).toBe(client.normalizeStyleId(v));
      expect(server.normalizeTierId(v), String(v)).toBe(client.normalizeTierId(v));
      expect(server.styleSupportsImages(v), String(v)).toBe(client.styleSupportsImages(v));
    }
  });

  it('isStyleIncluded agrees on the full tier x style matrix (including junk)', () => {
    for (const t of values) for (const s of values) {
      expect(server.isStyleIncluded(t, s), `${String(t)} / ${String(s)}`).toBe(client.isStyleIncluded(t, s));
    }
  });

  it('inclusive tiers: classic < modern < visual', () => {
    expect(server.isStyleIncluded('classic', 'modern')).toBe(false);
    expect(server.isStyleIncluded('modern', 'modern')).toBe(true);
    expect(server.isStyleIncluded('modern', 'visual')).toBe(false);
    expect(server.isStyleIncluded('visual', 'classic')).toBe(true);
  });

  it('resolveEffectiveStyle agrees on every draft x default x tier combination', () => {
    for (const draftStyle of values) for (const businessDefault of values) for (const tierId of ['classic', 'modern', 'visual', 'x', null]) {
      expect(server.resolveEffectiveStyle({ draftStyle, businessDefault, tierId }))
        .toEqual(client.resolveEffectiveStyle({ draftStyle, businessDefault, tierId }));
    }
  });
});
