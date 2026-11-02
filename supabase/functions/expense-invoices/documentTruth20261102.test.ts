// Owner console 2026-11-02 (typed: "מאשר תיקון R01 ו-R02 של קודקס, כולל שינוי ב-L-22, שחרור עד הלייב"): a record in PayPlus must prove it is this document.
import { describe, it, expect } from 'vitest';
import { documentMatch, recordDate, RESOLUTIONS } from './lib.ts';

const row = (o: Record<string, unknown> = {}) => ({ doc_type: 'tax_invoice_receipt', doc_number: '1', doc_date: '2026-11-01', amount: 90, currency: 'ILS', supplier_vat_id: '311214605', supplier_name: 'Synthetic', ...o });
const rec = (o: Record<string, unknown> = {}) => ({ number: '1', amount: 90, supplier: { vat_id: '311214605' }, ...o });

describe('R02: the date and the period', () => {
  it('the same number, supplier and amount on the same date is the document', () => {
    expect(documentMatch(rec({ doc_date: '2026-11-01' }), row(), 90)).toBe('match');
    expect(documentMatch(rec(), row(), 90)).toBe('match'); // a record with no date: as before
  });
  it('another date is never "already there": the Owner checks PayPlus', () => {
    expect(documentMatch(rec({ doc_date: '2025-11-01' }), row(), 90)).toBe('ambiguous');
    expect(documentMatch(rec({ date: '01/11/2025' }), row(), 90)).toBe('ambiguous');
  });
  it('the Owner\'s own series needs a record that proves its date', () => {
    expect(documentMatch(rec(), row({ identity_series: '2026' }), 90)).toBe('ambiguous');
    expect(documentMatch(rec({ doc_date: '2025-11-01' }), row({ identity_series: '2026' }), 90)).toBe('ambiguous');
    expect(documentMatch(rec({ doc_date: '2026-11-01' }), row({ identity_series: '2026' }), 90)).toBe('match');
  });
  it('reads the date forms a record can carry', () => {
    expect(recordDate({ doc_date: '2026-11-01T00:00:00Z' })).toBe('2026-11-01');
    expect(recordDate({ value_date: '01/11/2026' })).toBe('2026-11-01');
    expect(recordDate({ doc_date: 'soon' })).toBeNull();
    expect(recordDate({})).toBeNull();
  });
  it('"not created" clears the next send only by the Owner\'s answer', () => {
    expect(RESOLUTIONS.not_created.payplus_match_cleared).toBe(true);
    expect(RESOLUTIONS.found.payplus_match_cleared).toBeUndefined();
  });
});

describe('R01: a charge and a credit note are two documents', () => {
  const credit = (o: Record<string, unknown> = {}) => row({ doc_type: 'credit_note', amount: 20, ...o });
  it('the charge in PayPlus is not the credit note, and the credit note is not the charge', () => {
    expect(documentMatch(rec({ amount: 100 }), credit(), -20)).toBe('none');
    expect(documentMatch(rec({ amount: -20 }), row({ amount: 100 }), 100)).toBe('none');
  });
  it('the credit note itself is found', () => {
    expect(documentMatch(rec({ amount: -20 }), credit(), -20)).toBe('match');
  });
  it('the same size with the other sign proves nothing: never a second document, the Owner checks', () => {
    expect(documentMatch(rec({ amount: 20 }), credit(), -20)).toBe('ambiguous');
  });
});
