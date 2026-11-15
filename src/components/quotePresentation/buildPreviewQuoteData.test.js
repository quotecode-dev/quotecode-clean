import { describe, it, expect } from 'vitest';
import { buildPreviewQuoteData, isLocalPreviewQuote } from './buildPreviewQuoteData';

const A = '11111111-1111-4111-8111-111111111111';

const editor = (over = {}) => ({
  quoteId: 'q-1', quoteNumber: 1048, createdAt: '2026-10-04T10:00:00.000Z',
  clientName: 'Studio Kav', clientEmail: 'a@b.c', clientPhone: '050', clientType: 'business', clientAddress: 'Haifa',
  quoteSubject: 'Shelving', attnName: '', attnRole: '', currency: 'ILS', quoteStatus: 'Draft', validUntil: '2026-10-31',
  discount: '10', terms: 'T', warranty: 'W', notes: 'N', projectName: '  Office  ',
  sections: [{ key: 's1', name: 'Kitchen' }, { key: 's2', name: '  ' }],
  items: [
    { description: 'Shelf', quantity: '2', unit_price: '100', section_key: 's1' },
    { description: 'Board', quantity: '1', unit_price: '50', pricing_unit: 'm2', calculated_quantity: '3', quantity_source: 'calculated', measurements: [{ width: '1', height: '3', unit: 'm', label: '' }, { width: '', height: '' }] },
    { description: '', quantity: '1', unit_price: '' },
  ],
  ...over,
});

describe('buildPreviewQuoteData', () => {
  it('produces the get-public-quote shape and reuses the Dashboard financial values verbatim', () => {
    const { quoteData, isLocal } = buildPreviewQuoteData({
      editor: editor(),
      financials: { subtotal: 1234.5, taxRate: 0.18, total: 1456.71 },
      business: { business_name: 'Kav', logo_url: '', tax_id: '5', email: 'e', phone: 'p', address: 'a', currency: 'ILS' },
      presentation: { style: 'modern', presentation: null, mediaUrls: {} },
    });
    expect(Object.keys(quoteData).sort()).toEqual(['attachments', 'business', 'client', 'items', 'quote', 'sections']);
    expect(quoteData.quote).toMatchObject({ id: 'q-1', quote_number: 1048, subtotal: 1234.5, tax_rate: 0.18, total: 1456.71, discount: 10, status: 'draft', signature: null, is_owner_viewing: true, project_name: 'Office', attn_name: 'Studio Kav' });
    expect(quoteData.sections).toEqual([{ id: 's1', name: 'Kitchen' }]);
    // untouched placeholder dropped (same rule as the save); total_price is the save's own expression
    expect(quoteData.items).toHaveLength(2);
    expect(quoteData.items[0]).toMatchObject({ description: 'Shelf', quantity: 2, price: 100, total_price: 200, section_id: 's1' });
    expect(quoteData.items[1]).toMatchObject({ total_price: 150, pricing_unit: 'm2', calculated_quantity: 3 });
    expect(quoteData.items[1].measurements).toHaveLength(1);
    expect(quoteData.attachments).toEqual([]);
    expect(isLocal).toBe(true);
  });

  it('market rule matches SmartPublicQuote: tax_rate > 0 || currency ILS', () => {
    expect(isLocalPreviewQuote({ tax_rate: 0, currency: 'USD' })).toBe(false);
    expect(isLocalPreviewQuote({ tax_rate: 0, currency: 'ils' })).toBe(true);
    expect(isLocalPreviewQuote({ tax_rate: 0.17, currency: 'USD' })).toBe(true);
    const r = buildPreviewQuoteData({ editor: editor({ currency: 'USD' }), financials: { subtotal: 1, taxRate: 0, total: 1 } });
    expect(r.isLocal).toBe(false);
  });

  it('presentation prop follows the public_get shape with the effective style, detail and signed URLs', () => {
    const { presentation } = buildPreviewQuoteData({
      editor: editor(),
      financials: {},
      presentation: {
        style: 'visual',
        presentation: { style: null, detail: 'expanded', media: [{ assetId: A, caption: 'Hero', role: 'hero' }, { assetId: 'b', caption: 'Gone', role: 'support' }] },
        mediaUrls: { [A]: 'https://signed/a', b: null },
      },
    });
    expect(presentation).toMatchObject({ mode: 'draft', style: 'visual', styleVersion: 1, branding: null, detail: 'expanded' });
    expect(presentation.media).toEqual([
      { url: 'https://signed/a', caption: 'Hero', alt: 'Hero', role: 'hero', itemKey: null, missing: false },
      { url: null, caption: 'Gone', alt: 'Gone', role: 'support', itemKey: null, missing: true },
    ]);
  });

  it('client is null when no client details were entered; unknown style falls back to classic', () => {
    const r = buildPreviewQuoteData({ editor: editor({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' }), presentation: { style: 'gold' } });
    expect(r.quoteData.client).toBe(null);
    expect(r.presentation.style).toBe('classic');
  });
});
