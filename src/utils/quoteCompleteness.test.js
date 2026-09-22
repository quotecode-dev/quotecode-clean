import { describe, it, expect } from 'vitest';
import { countRealQuoteItems, isUnfinishedQuoteForm, isUnfinishedSavedQuote } from './quoteCompleteness';

describe('SMART-QUOTE-01 quote completeness', () => {
  it('the untouched placeholder row and nameless rows are not real items', () => {
    expect(countRealQuoteItems([{ description: '', quantity: '1', unit_price: '' }])).toBe(0);
    expect(countRealQuoteItems([{ description: '  ', quantity: '2', unit_price: '5' }])).toBe(0);
    expect(countRealQuoteItems([{ description: 'Window', quantity: '1', unit_price: '100' }])).toBe(1);
  });
  it('editor: unfinished without a real item or with nothing to charge', () => {
    expect(isUnfinishedQuoteForm({ items: [{ description: '', quantity: '1', unit_price: '' }], totalAmount: 0 })).toBe(true);
    expect(isUnfinishedQuoteForm({ items: [{ description: 'Window', quantity: '1', unit_price: '0' }], totalAmount: 0 })).toBe(true);
    expect(isUnfinishedQuoteForm({ items: [{ description: 'Window', quantity: '1', unit_price: '100' }], totalAmount: 118 })).toBe(false);
  });
  it('saved: zero total or no items is unfinished; signed/approved/paid history never is', () => {
    expect(isUnfinishedSavedQuote({ status: 'draft', total: 0 })).toBe(true);
    expect(isUnfinishedSavedQuote({ status: 'sent', total: 100 }, [])).toBe(true);
    expect(isUnfinishedSavedQuote({ status: 'draft', total: 100 }, [{}])).toBe(false);
    expect(isUnfinishedSavedQuote({ status: 'approved', total: 0 })).toBe(false);
    expect(isUnfinishedSavedQuote({ status: 'draft', total: 0, signature: 'data:image/png;base64,AA==' })).toBe(false);
  });
});
