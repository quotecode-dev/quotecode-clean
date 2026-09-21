import { describe, it, expect } from 'vitest';
import { getPristineQuoteFormState, projectNameForPersist } from './quoteFormState';

describe('pristine new-quote state (the reset shared by new / cancel / after-save / logout / account switch)', () => {
  const p = getPristineQuoteFormState({ defaultTerms: 'T', defaultWarranty: 'W', isLocalIsraeliBusiness: true, currency: 'USD' });
  it('quoteStatus is reset to Draft (it leaked from the previous quote before)', () => { expect(p.quoteStatus).toBe('Draft'); });
  it('quoteStructureMode is reset to null (it leaked from the previous quote before)', () => { expect(p.quoteStructureMode).toBeNull(); });
  it('projectName, sections, items, client and text fields are cleared; defaults come from Business Settings', () => {
    expect(p).toMatchObject({ projectName: '', sections: [], clientName: '', clientEmail: '', notes: '', discount: '', validUntil: '', terms: 'T', warranty: 'W' });
    expect(p.items).toEqual([{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }]);
  });
  it('market currency: Local is always ILS; International keeps a valid currency or falls back to USD', () => {
    expect(p.currency).toBe('ILS');
    expect(getPristineQuoteFormState({ isLocalIsraeliBusiness: false, currency: 'EUR' }).currency).toBe('EUR');
    expect(getPristineQuoteFormState({ isLocalIsraeliBusiness: false, currency: '' }).currency).toBe('USD');
  });
  it('returns a fresh items array each time (no shared mutable state between quotes)', () => {
    const a = getPristineQuoteFormState(); const b = getPristineQuoteFormState();
    expect(a.items).not.toBe(b.items); a.items[0].description = 'x'; expect(b.items[0].description).toBe('');
  });
});

describe('projectNameForPersist', () => {
  it('writes trimmed text, and null (never an empty string) when empty', () => {
    expect(projectNameForPersist('  Villa Cohen ')).toBe('Villa Cohen');
    expect(projectNameForPersist('')).toBeNull(); expect(projectNameForPersist('   ')).toBeNull(); expect(projectNameForPersist(undefined)).toBeNull();
  });
});
