// Night task 2026-10-16 (Owner-approved doc 31eae0a7) - frontend findings of docs/MIGRATION_RETRO_AUDIT_2026-10-16.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { buildTemplateContent, templateToFormState, templateSummary, templatePriceBasis, clientTypeForPriceBasis, templateCurrencyUnknown, templateCurrencyMismatch } from './utils/quoteTemplates';
import { withPersistableQuantity, getActiveQuantity } from './utils/professionalQuoteItem';
import { draftLinesToQuoteItems } from './utils/aiQuoteDraftClient';

const read = (p) => readFileSync(join(cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('src/pages/Dashboard.jsx');
const form = (over = {}) => ({ items: [{ description: 'חלון', quantity: '2', unit_price: '1180' }], sections: [], currency: 'ILS', ...over });

describe('R-03: a template remembers whether its prices include VAT (L-09, Owner-approved)', () => {
  it('the basis comes from the Israeli client type only', () => {
    expect(templatePriceBasis(true, 'private')).toBe('incl_vat');
    expect(templatePriceBasis(true, 'business')).toBe('excl_vat');
    expect(templatePriceBasis(true, '')).toBeNull();
    expect(templatePriceBasis(false, 'private')).toBeNull();
    expect(clientTypeForPriceBasis('incl_vat')).toBe('private');
    expect(clientTypeForPriceBasis('excl_vat')).toBe('business');
    expect(clientTypeForPriceBasis(null)).toBeNull();
  });
  it('saved with priced lines, read back, shown in the summary; never without prices', () => {
    const c = buildTemplateContent(form({ priceBasis: 'incl_vat' }));
    expect(c.price_basis).toBe('incl_vat');
    expect(templateToFormState(c, () => 'k').priceBasis).toBe('incl_vat');
    expect(templateSummary(c).priceBasis).toBe('incl_vat');
    expect(buildTemplateContent(form({ priceBasis: 'incl_vat' }), { prices: false }).price_basis).toBeUndefined();
    expect(buildTemplateContent(form({ priceBasis: 'bogus' })).price_basis).toBeUndefined();
    expect(templateToFormState({ ...c, price_basis: 'bogus' }, () => 'k').priceBasis).toBeNull();
  });
  it('using a template sets the matching client type, or asks the user to check when the basis is unknown', () => {
    expect(dash).toContain('priceBasis: templatePriceBasis(isLocalIsraeliBusiness, clientType)');
    expect(dash).toContain('const templateClientType = clientTypeForPriceBasis(f.priceBasis);');
    expect(dash).toContain('if (templateClientType) setClientType(templateClientType);');
    expect(dash).toContain('התבנית נשמרה לפני שנשמר בה אם המחירים כוללים מע"מ.');
  });
  it('the template summary names the right basis', () => {
    const dlg = read('src/components/QuoteTemplateDialogs.jsx');
    expect(dlg).toContain("subtotalInclVat: 'סכום כולל מע\"מ, לפני הנחה'");
    expect(dlg).toContain("s.priceBasis === 'incl_vat' ? C.subtotalInclVat : C.subtotal");
  });
});

describe('R-20: a template saved before it remembered its currency asks (L-09, Owner-approved)', () => {
  it('unknown currency + prices -> ask; a known currency keeps the existing mismatch check', () => {
    const old = templateToFormState({ schema: 'quote-template/v1', items: [{ description: 'x', quantity: 1, unit_price: 50 }] }, () => 'k');
    expect(old.currency).toBeNull();
    expect(templateCurrencyUnknown(old)).toBe(true);
    expect(templateCurrencyMismatch(old, 'EUR')).toBe(false);
    expect(templateCurrencyUnknown({ ...old, items: [{ description: 'x', quantity: '1', unit_price: '' }] })).toBe(false);
    expect(dash).toContain('} else if (templateCurrencyUnknown(f)) {');
  });
});

describe('R-05: a fractional quantity never fails the save', () => {
  it('2.5 hours is stored as quantity 1 + a manual calculated quantity of 2.5 - the same price', () => {
    const it0 = { description: 'עבודה', quantity: '2.5', unit_price: '200', pricing_unit: 'hour' };
    const p = withPersistableQuantity(it0);
    expect(p).toMatchObject({ quantity: '1', calculated_quantity: 2.5, quantity_source: 'manual', calculation_method: 'manual', pricing_unit: 'hour' });
    expect(getActiveQuantity(p) * Number(p.unit_price)).toBe(500);
  });
  it('a plain fractional count becomes a "unit" line with the same amount', () => {
    expect(withPersistableQuantity({ description: 'x', quantity: '1.5', unit_price: '10' })).toMatchObject({ quantity: '1', pricing_unit: 'unit', calculated_quantity: 1.5 });
  });
  it('integers and measured lines are untouched (a measured line keeps its calculated quantity)', () => {
    const i = { description: 'x', quantity: '3', unit_price: '10' };
    expect(withPersistableQuantity(i)).toBe(i);
    expect(withPersistableQuantity({ description: 'x', quantity: '1.4', calculated_quantity: 6, pricing_unit: 'm2' })).toMatchObject({ quantity: '1', calculated_quantity: 6 });
  });
  it('AI draft lines in hours / kg / units with decimals all become persistable integer quantities', () => {
    for (const unit of ['hour', 'kg', 'day', 'unit', undefined]) {
      const [row] = draftLinesToQuoteItems([{ description: 'x', quantity: 2.5, unit, unitPrice: 100 }]);
      const p = withPersistableQuantity(row);
      expect(Number.isInteger(Number(p.quantity)), String(unit)).toBe(true);
      expect(getActiveQuantity(p), String(unit)).toBe(2.5);
    }
  });
  it('the save goes through it', () => {
    expect(dash).toContain('let itemsForPersist = excludeUntouchedPlaceholderItems(items).map(withPersistableQuantity);');
  });
});
