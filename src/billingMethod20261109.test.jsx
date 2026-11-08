// Owner console 2026-11-09 (item 08, typed: "שמור את אופן החיוב בשדה נפרד במסד. השורה תיפתח נכון, והמסמך של הלקוח לא ישתנה בכלל. זה דורש
// מיגרציה, ולכן שחרור ארוך יותר."): a row without a pricing unit and without sizes keeps the user's choice between a fixed amount and
// units in quote_items.billing_method (migration 20261109100000). Old rows (null) open exactly as before (decision 3).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import QuoteRowsEditor from './components/QuoteRowsEditor';
import { rowEntry, storedBillingMethod } from './utils/quoteItemEntry';

afterEach(cleanup);
const read = (p) => readFileSync(p, 'utf8');
const SAVED_ONE = { id: 'a8000000-0000-4000-8000-000000000001', description: 'התקנה', quantity: 1, unit_price: '500', section_key: null };

function H({ initial }) {
  const [items, setItems] = useState(initial);
  return <QuoteRowsEditor items={items} setItems={setItems} isHebrew sym="₪" fmtMoney={(v) => Number(v).toFixed(2)} />;
}

describe('item 08 · the billing method of a row is stored apart from the customer document', () => {
  it('storedBillingMethod: only fixed / units of a row with no pricing unit and no sizes', () => {
    expect(storedBillingMethod({ ...SAVED_ONE, _billing: 'units' })).toBe('units');
    expect(storedBillingMethod({ ...SAVED_ONE, _billing: 'fixed' })).toBe('fixed');
    expect(storedBillingMethod({ ...SAVED_ONE, billing_method: 'units' })).toBe('units');
    // the screen mark wins over the stored value (the user just changed it)
    expect(storedBillingMethod({ ...SAVED_ONE, billing_method: 'units', _billing: 'fixed' })).toBe('fixed');
    expect(storedBillingMethod(SAVED_ONE)).toBeNull();
    expect(storedBillingMethod({ ...SAVED_ONE, _billing: 'units', pricing_unit: 'hour' })).toBeNull();
    expect(storedBillingMethod({ ...SAVED_ONE, _billing: 'units', measurements: [{ width: 1, height: 1 }] })).toBeNull();
    expect(storedBillingMethod({ ...SAVED_ONE, billing_method: 'units', quote_item_measurements: [{ width: 1, height: 1 }] })).toBeNull();
    expect(storedBillingMethod({ ...SAVED_ONE, _billing: 'area' })).toBeNull();
  });

  it('a saved "1 unit" row reopens as units; an old row (nothing stored) still opens as a fixed amount (decision 3)', () => {
    expect(rowEntry({ ...SAVED_ONE, billing_method: 'units' }, false).pricingMethod).toBe('units');
    expect(rowEntry({ ...SAVED_ONE, billing_method: 'units' }, false).quantity).toBe('1');
    expect(rowEntry({ ...SAVED_ONE, billing_method: 'fixed' }, false).pricingMethod).toBe('fixed');
    expect(rowEntry(SAVED_ONE, false).pricingMethod).toBe('fixed');
    // a row with a quantity above 1 was never ambiguous
    expect(rowEntry({ ...SAVED_ONE, quantity: 3 }, false).pricingMethod).toBe('units');
  });

  it('the row editor shows the stored choice', () => {
    render(<H initial={[{ ...SAVED_ONE, _billing: 'units' }]} />);
    const sel = screen.getByRole('combobox', { name: 'אופן חיוב' });
    expect(sel.value).toBe('units');
  });

  it('the app reads the column into the row and writes it with every item (save and the change check)', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain("...(item.billing_method === 'fixed' || item.billing_method === 'units' ? { _billing: item.billing_method } : {}),");
    expect(d).toContain('.select(`${richItemCols}, price_missing, price_link_id, billing_method`)');
    expect(d).toContain("if (fetchItemsErr && String(fetchItemsErr.message || '').includes('billing_method')) {");
    expect(d).toContain('billing_method: storedBillingMethod(it), // item 08');
    expect(d).toContain('billing_method: storedBillingMethod(item), // item 08');
  });

  it('the migration: a nullable column limited to fixed / units, kept when the key is absent, and never in the customer document', () => {
    const sql = read('supabase/migrations/20261109100000_quote_item_billing_method.sql');
    expect(sql).toContain('ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS billing_method text NULL;');
    expect(sql).toContain("CHECK (billing_method IS NULL OR billing_method IN ('fixed', 'units'))");
    expect(sql).toContain("billing_method = CASE WHEN v_item ? 'billing_method' THEN NULLIF(v_item->>'billing_method', '') ELSE billing_method END");
    expect(sql).not.toContain('CREATE OR REPLACE FUNCTION public.quote_output_deal_document');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.save_quote_structured(uuid, jsonb, jsonb, jsonb, uuid[], uuid[]) TO authenticated;');
  });
});
