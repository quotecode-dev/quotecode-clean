// Task 37 (D2): the price_missing flag reaches the customer page from BOTH public paths - the legacy row read (index.ts select) and the
// issued snapshot (rendererFromSnapshot) - and ONLY when true, so every existing response stays byte-identical.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { rendererFromSnapshot } from './publicAccess';
import { canonicalSnapshotPath } from '../_shared/capabilityToken';

const OWNER = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const ATT = '33333333-3333-4333-8333-333333333333';
const item = (o: Record<string, unknown>) => ({ description: 'x', quantity: 1, unit_price: 0, total_price: 0, pricing_unit: null, calculated_quantity: null, quantity_source: null,
  specification: null, section_id: null, calculation_method: null, sort_order: 1, measurements: [], ...o });
const snapshot = (items: unknown[]) => ({
  kind: 'tekango-issued-quote-document', schemaVersion: 1, attemptId: ATT, ownerId: OWNER, quoteId: Q, customerBinding: 'c1',
  requestedChannel: 'send', preparedAt: '2026-10-12T10:00:00Z', contentDigest: 'a'.repeat(64), issuerDigest: 'b'.repeat(64), presentationDigest: 'c'.repeat(64),
  document: { documentProjection: 'quote-document/v1',
    quote: { id: Q, quote_number: 1, created_at: '2026-10-01T00:00:00Z', valid_until: '2999-01-01', currency: 'ILS', client_type: 'business', subject: 's', project_name: 'p',
      attn_name: 'a', attn_role: 'r', subtotal: 100, discount: 0, tax_rate: 18, total: 118, terms: 't', warranty: 'w', notes: 'n' },
    customer: null, sections: [], items, attachmentCount: 0, attachmentManifest: [] },
  issuer: null, presentation: { presentationProjection: 'presentation/v1', style: 'classic', styleVersion: 1, branding: null, media: [] },
});
const bound = { userId: OWNER, quoteId: Q, attemptId: ATT, snapshotPath: canonicalSnapshotPath(OWNER, Q, ATT), snapshotSha256: 'a'.repeat(64) };
const render = (items: unknown[]) => rendererFromSnapshot(snapshot(items), bound, null, { callerUserId: null, now: new Date('2026-10-12T12:00:00Z') }) as { items: Record<string, unknown>[] };

describe('price_missing on the public quote', () => {
  it('the issued snapshot path carries price_missing: true for a missing line only', () => {
    const r = render([item({ description: 'missing', sort_order: 1, price_missing: true }), item({ description: 'intentional 0', sort_order: 2 }), item({ description: 'priced', unit_price: 100, total_price: 100, sort_order: 3, price_missing: false })]);
    expect(r.items.map((i) => i.price_missing)).toEqual([true, undefined, undefined]);
    expect(Object.prototype.hasOwnProperty.call(r.items[1], 'price_missing')).toBe(false);
  });
  it('a document without the flag renders exactly as before (no new key anywhere)', () => {
    const r = render([item({ description: 'a' }), item({ description: 'b', unit_price: 5, total_price: 5, sort_order: 2 })]);
    expect(JSON.stringify(r)).not.toContain('price_missing');
  });
  it('the legacy row read selects the durable column and passes it through only when true', () => {
    const src = readFileSync(join(cwd(), 'supabase', 'functions', 'get-public-quote', 'index.ts'), 'utf8');
    expect(src).toMatch(/quote_items \( description, quantity, unit_price, total_price, price_missing,/);
    expect(src).toContain("...(i.price_missing === true ? { price_missing: true } : {}),");
  });
});
