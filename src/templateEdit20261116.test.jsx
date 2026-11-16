// Owner console 2026-11-16 (typed: "מאשר עריכת תבנית בחלון בחירת התבנית: שינוי שם, שינוי, מחיקה והוספה של שורות ושמירת התבנית, כולל שינוי
// ב-L-09, ושחרור עד הלייב"): a saved template is edited inside the template window - name, rows (description / quantity / price), delete a row,
// add a row, "Save template"; everything else the template holds stays as it was saved; Hebrew and English together.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { applyTemplateEdits, templateEditGroups, templateEditProblem, templateEditRows } from './utils/quoteTemplates';
import { updateTemplate } from './utils/quoteTemplatesClient';
import { TemplatePickerDialog } from './components/QuoteTemplateDialogs';

const USER = 'user-a';
const QUOTE_TPL = {
  schema: 'quote-template/v1', structure_mode: 'divided', currency: 'ILS', price_basis: 'excl_vat', terms: 'Terms', subject: 'Bath',
  sections: [{ key: 's1', name: 'קומה 1', kind: 'floor' }, { key: 's2', name: 'דירה 3', kind: 'apartment', parent_key: 's1' }],
  items: [
    { description: 'ריצוף', quantity: 13, unit_price: 150, pricing_unit: 'm2', calculated_quantity: 12.5, section_key: 's2' },
    { description: 'פינוי פסולת', quantity: 1, unit_price: 450, billing: 'fixed' },
    { description: 'צביעה', quantity: 2, section_key: 's2' },
  ],
};
const UNIT_TPL = {
  schema: 'quote-template/v1', kind: 'unit', structure_mode: 'divided', sections: [{ key: 's1', name: 'Apartment type A' }],
  items: [{ description: 'Tiles', quantity: 12, unit_price: 40, pricing_unit: 'm2', calculated_quantity: 12, quantity_source: 'calculated', calculation_method: 'area',
    measurements: [{ width: 3, height: 4, unit: 'm', sort_order: 0, is_pricing_driving: true }], section_key: 's1' }],
};

describe('template edit: the pure part', () => {
  it('rows are shown with the quantity the user sees (a measured row: its area), places in tree order, rows of no place in "whole template"', () => {
    expect(templateEditRows(QUOTE_TPL).map((r) => [r.ref, r.description, r.quantity, r.unit_price, r.section_key])).toEqual([
      [0, 'ריצוף', '12.5', '150', 's2'], [1, 'פינוי פסולת', '1', '450', ''], [2, 'צביעה', '2', '', 's2']]);
    expect(templateEditGroups(QUOTE_TPL)).toEqual([{ key: '', name: null, depth: 0 }, { key: 's1', name: 'קומה 1', depth: 0 }, { key: 's2', name: 'דירה 3', depth: 1 }]);
    expect(templateEditGroups(UNIT_TPL)).toEqual([{ key: 's1', name: 'Apartment type A', depth: 0 }]);
  });
  it('nothing edited = the very same template (every field, every row)', () => {
    expect(applyTemplateEdits(QUOTE_TPL, templateEditRows(QUOTE_TPL))).toEqual(QUOTE_TPL);
    expect(applyTemplateEdits(UNIT_TPL, templateEditRows(UNIT_TPL))).toEqual(UNIT_TPL);
  });
  it('edits: description, price removed, a row deleted, a row added under a place; currency, VAT basis, places and texts stay (L-09)', () => {
    const rows = templateEditRows(QUOTE_TPL);
    rows[0].description = 'ריצוף פורצלן'; rows[2].unit_price = '';
    const next = applyTemplateEdits(QUOTE_TPL, [rows[0], rows[2], { ref: null, description: 'איטום', quantity: '3', unit_price: '90', section_key: 's1' }]);
    expect(next.items).toEqual([
      { description: 'ריצוף פורצלן', quantity: 13, unit_price: 150, pricing_unit: 'm2', calculated_quantity: 12.5, section_key: 's2' },
      { description: 'צביעה', quantity: 2, section_key: 's2' },
      { description: 'איטום', quantity: 3, unit_price: 90, section_key: 's1' }]);
    for (const k of ['currency', 'price_basis', 'sections', 'terms', 'subject', 'structure_mode', 'schema']) expect(next[k]).toEqual(QUOTE_TPL[k]);
  });
  it('a changed quantity is the user number: a measured unit row loses its sizes and becomes manual; a fractional count is kept exactly', () => {
    const [row] = templateEditRows(UNIT_TPL);
    const [line] = applyTemplateEdits(UNIT_TPL, [{ ...row, quantity: '15.5' }]).items;
    expect(line).toEqual({ description: 'Tiles', quantity: 16, unit_price: 40, pricing_unit: 'm2', calculated_quantity: 15.5, quantity_source: 'manual', calculation_method: 'manual', section_key: 's1' });
    const plain = applyTemplateEdits(QUOTE_TPL, [{ ...templateEditRows(QUOTE_TPL)[1], quantity: '2.5' }]).items[0];
    expect(plain).toEqual({ description: 'פינוי פסולת', quantity: 3, unit_price: 450, pricing_unit: 'unit', calculated_quantity: 2.5 });
    const added = applyTemplateEdits(UNIT_TPL, [row, { ref: null, description: 'Paint', quantity: '1', unit_price: '', section_key: '' }]).items[1];
    expect(added).toEqual({ description: 'Paint', quantity: 1, section_key: 's1' }); // a unit template's rows all belong to its one place
  });
  it('problems are named, never saved: no rows, a row with no description, quantity 0 / text, a price that is not a number', () => {
    const ok = { description: 'x', quantity: '1', unit_price: '' };
    expect(templateEditProblem([ok])).toBe(null);
    expect(templateEditProblem([])).toBe('no_items');
    expect(templateEditProblem([{ ...ok, description: '  ' }])).toBe('row_no_description');
    expect(templateEditProblem([{ ...ok, quantity: '0' }])).toBe('bad_quantity');
    expect(templateEditProblem([{ ...ok, quantity: 'abc' }])).toBe('bad_quantity');
    expect(templateEditProblem([{ ...ok, unit_price: '-5' }])).toBe('bad_price');
    expect(templateEditProblem([{ ...ok, unit_price: 'x' }])).toBe('bad_price');
  });
});

describe('template edit: storage', () => {
  const updater = (result, calls) => ({ from: vi.fn((table) => { calls.push(['from', table]); const b = { update: (v) => { calls.push(['update', v]); return b; }, eq: (k, v) => { calls.push(['eq', k, v]); return b; }, select: () => b, single: () => Promise.resolve(result) }; return b; }) });
  it('updates only the owner own row, with the sanitized content; a duplicate name is named', async () => {
    const calls = [];
    const r = await updateTemplate(updater({ data: { id: 't1', user_id: USER, name: 'New', content: QUOTE_TPL }, error: null }, calls), USER, 't1', '  New  ', { ...QUOTE_TPL, client_name: 'x' });
    expect(r.ok).toBe(true);
    expect(calls).toContainEqual(['from', 'quote_templates']);
    expect(calls).toContainEqual(['eq', 'id', 't1']);
    expect(calls).toContainEqual(['eq', 'user_id', USER]);
    const upd = calls.find((c) => c[0] === 'update')[1];
    expect(upd.name).toBe('New'); expect(upd.content).not.toHaveProperty('client_name');
    const dup = await updateTemplate(updater({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "quote_templates_owner_name"' } }, []), USER, 't1', 'Old', QUOTE_TPL);
    expect(dup.error.code).toBe('duplicate_name');
    expect((await updateTemplate(updater({}, []), USER, 't1', '   ', QUOTE_TPL)).error).toEqual({ code: 'invalid', message: 'name_required' });
    expect((await updateTemplate(updater({}, []), USER, 't1', 'x', { ...QUOTE_TPL, items: [] })).error.message).toBe('no_items');
  });
});

describe('template edit: the window (Hebrew and English)', () => {
  const client = (rows, onUpdate) => ({ from: vi.fn(() => {
    let upd = null;
    const b = { select: () => b, eq: () => b, order: () => Promise.resolve({ data: rows, error: null }), update: (v) => { upd = v; return b; },
      single: () => Promise.resolve(onUpdate(upd)) };
    return b;
  }) });
  for (const he of [true, false]) {
    const T = (h, e) => (he ? h : e);
    it(`${he ? 'HE' : 'EN'}: Edit -> rename, change, delete, add a row -> Save template; the list shows the saved template`, async () => {
      const sent = [];
      const c = client([{ id: 't1', user_id: USER, name: 'Bath', content: QUOTE_TPL }], (u) => { sent.push(u); return { data: { id: 't1', user_id: USER, ...u }, error: null }; });
      render(<TemplatePickerDialog isHebrew={he} client={c} userId={USER} formatMoney={String} onClose={vi.fn()} onUse={vi.fn()} />);
      fireEvent.click(await screen.findByTestId('template-edit'));
      const dlg = screen.getByTestId('edit-template-dialog');
      expect(dlg.getAttribute('dir')).toBe(he ? 'rtl' : 'ltr');
      expect(within(dlg).getByRole('heading', { level: 2 }).textContent).toContain(T('עריכת התבנית', 'Edit the template'));
      expect(within(dlg).getAllByTestId('template-edit-group').map((g) => g.querySelector('h3').textContent)).toEqual([T('כל התבנית', 'Whole template'), 'קומה 1', 'דירה 3']);
      expect([...dlg.querySelectorAll('label[for^="tpl-row-price-"]')].map((l) => l.textContent)).toEqual(Array(3).fill(T('מחיר (₪)', 'Price (₪)')));
      expect(dlg.querySelector('label[for="tpl-row-qty-0"]').textContent).toBe(T('כמות (מ״ר)', 'Quantity (m²)')); // the measured row says its unit
      expect(dlg.querySelector('label[for="tpl-row-qty-1"]').textContent).toBe(T('כמות', 'Quantity')); // a fixed amount has none
      fireEvent.change(screen.getByTestId('template-edit-name'), { target: { value: 'Bath 2' } });
      const descs = screen.getAllByTestId('template-edit-desc');
      fireEvent.change(descs[1], { target: { value: 'ריצוף פורצלן' } }); // rows are shown by place: whole template first
      fireEvent.click(screen.getAllByTestId('template-edit-delete-row')[2]);
      fireEvent.click(screen.getAllByTestId('template-edit-add-row')[1]);
      const newDesc = document.querySelector('[data-edit-uid="3"]'); // the new row, under "קומה 1"
      expect(newDesc.closest('[data-testid="template-edit-group"]').querySelector('h3').textContent).toBe('קומה 1');
      await waitFor(() => expect(document.activeElement).toBe(newDesc));
      fireEvent.change(newDesc, { target: { value: 'א' } });
      expect(document.activeElement).toBe(newDesc); // typing keeps the focus in the field
      fireEvent.change(newDesc, { target: { value: 'איטום' } });
      fireEvent.click(screen.getByTestId('template-edit-save'));
      await screen.findByTestId('template-edit-saved');
      expect(screen.getByTestId('template-edit-saved').textContent).toBe(T('התבנית נשמרה.', 'Template saved.'));
      expect(sent[0].name).toBe('Bath 2');
      expect(sent[0].content.items.map((i) => [i.description, i.section_key ?? null])).toEqual([['ריצוף פורצלן', 's2'], ['פינוי פסולת', null], ['איטום', 's1']]);
      expect(screen.getByTestId('template-preview').textContent).toContain('Bath 2');
    });
    it(`${he ? 'HE' : 'EN'}: an empty description / a duplicate name is said plainly and nothing closes; Cancel returns to the list unchanged`, async () => {
      const c = client([{ id: 't1', user_id: USER, name: 'Bath', content: QUOTE_TPL }], () => ({ data: null, error: { code: '23505', message: 'quote_templates_owner_name' } }));
      render(<TemplatePickerDialog isHebrew={he} client={c} userId={USER} formatMoney={String} onClose={vi.fn()} onUse={vi.fn()} />);
      fireEvent.click(await screen.findByTestId('template-edit'));
      fireEvent.click(screen.getAllByTestId('template-edit-add-row')[0]);
      fireEvent.click(screen.getByTestId('template-edit-save'));
      expect(screen.getByTestId('template-edit-result').textContent).toBe(T('יש שורה בלי תיאור. כתבו תיאור או מחקו את השורה.', 'A row has no description. Write one or delete the row.'));
      fireEvent.click(screen.getAllByTestId('template-edit-delete-row')[1]); // the new empty row sits under "whole template", after its one row
      fireEvent.click(screen.getByTestId('template-edit-save'));
      await waitFor(() => expect(screen.getByTestId('template-edit-result').textContent).toBe(T('כבר יש תבנית בשם הזה, של הצעה או של יחידה. בחרו שם אחר.', 'A quote or unit template with this name already exists. Choose another name.')));
      fireEvent.click(screen.getByTestId('template-edit-cancel'));
      expect(screen.getByTestId('pick-template-dialog')).toBeTruthy();
      expect(screen.queryByTestId('template-edit-saved')).toBeNull();
    });
  }
});
