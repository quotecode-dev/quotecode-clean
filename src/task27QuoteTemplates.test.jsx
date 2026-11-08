// Task 27 (P2, spec §6): whole-quote templates - what is kept / never kept, preview, use as a NEW unsaved quote, owner-scoped storage.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FORBIDDEN_TEMPLATE_KEYS, buildTemplateContent, readTemplateContent, stripForbiddenKeys, templateSummary, templateToFormState } from './utils/quoteTemplates';
import { classifyTemplateError, createTemplate } from './utils/quoteTemplatesClient';
import { SaveTemplateDialog, TemplatePickerDialog } from './components/QuoteTemplateDialogs';
import NewQuoteMenu from './components/NewQuoteMenu';

const USER = 'user-a';
const FORM = {
  quoteSubject: 'Bathroom', projectName: 'Synthetic project', quoteStructureMode: 'divided',
  sections: [{ key: 'sec-db-1', id: 'sec-db-1', name: 'Walls' }, { key: 'blank', name: '  ' }],
  items: [
    { id: 'item-db-1', description: 'Tiles', quantity: '1', unit_price: '120', pricing_unit: 'm2', calculated_quantity: 12.5, quantity_source: 'calculated', calculation_method: 'area',
      measurements: [{ width: 2.5, height: 5 }], section_key: 'sec-db-1', specification: [{ label: 'Color', value: 'White' }], client_name: 'Leak' },
    { description: 'Labor', quantity: '2', unit_price: '300' },
    { description: '', quantity: '1', unit_price: '' },
  ],
  terms: 'Terms text', warranty: '12 months', notes: 'Bring materials',
  quotePresentation: { style: 'modern', media: [{ assetId: 'asset-1', role: 'hero', caption: 'Hero' }], detail: 'compact' },
  // job-specific / identity fields present on a real editor - must never reach a template
  clientName: 'Synthetic Customer', clientEmail: 'c@synthetic.test', validUntil: '2026-12-01', quoteStatus: 'Sent', quote_number: 1001,
};
const deepKeys = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach((x) => deepKeys(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); deepKeys(x, out); } return out; };

describe('templates - content', () => {
  it('keeps structure / lines / prices / texts / presentation; never a customer, identity, status, number, link or date (at any depth)', () => {
    const c = buildTemplateContent(FORM, { prices: true, texts: true, subject: true, presentation: true });
    expect(c.schema).toBe('quote-template/v1');
    expect(c.sections).toEqual([{ key: 's1', name: 'Walls' }]);
    expect(c.items).toEqual([
      { description: 'Tiles', quantity: 1, unit_price: 120, pricing_unit: 'm2', calculated_quantity: 12.5, specification: [{ label: 'Color', value: 'White' }], section_key: 's1' },
      { description: 'Labor', quantity: 2, unit_price: 300 },
    ]);
    expect(c).toMatchObject({ subject: 'Bathroom', project_name: 'Synthetic project', terms: 'Terms text', warranty: '12 months', notes: 'Bring materials' });
    expect(c.presentation.style).toBe('modern');
    const keys = deepKeys(c);
    for (const k of FORBIDDEN_TEMPLATE_KEYS) expect(keys.has(k)).toBe(false);
    for (const k of ['clientName', 'clientEmail', 'validUntil', 'quoteStatus', 'measurements']) expect(keys.has(k)).toBe(false);
  });
  it('the owner chooses: without prices / texts / subject / presentation', () => {
    const c = buildTemplateContent(FORM, { prices: false, texts: false, subject: false, presentation: false });
    expect(c.items.some((it) => 'unit_price' in it)).toBe(false);
    expect(c.terms).toBeUndefined(); expect(c.subject).toBeUndefined(); expect(c.presentation).toBeUndefined();
    expect(templateSummary(c)).toMatchObject({ itemCount: 2, hasPrices: false, hasTexts: false });
  });
  it('a planted stored value is cleaned again on the way in; an unknown schema is unusable', () => {
    expect(readTemplateContent({ schema: 'quote-template/v1', items: [{ description: 'x', client_email: 'leak' }], signature: 'x' })).toEqual({ schema: 'quote-template/v1', items: [{ description: 'x' }] });
    expect(readTemplateContent({ items: [] })).toBeNull();
    expect(stripForbiddenKeys({ a: { status: 'x', b: [{ valid_until: 'y', ok: 1 }] } })).toEqual({ a: { b: [{ ok: 1 }] } });
  });
  it('use = a NEW form state: fresh section keys, no ids, measured quantity kept as a manual quantity, preview total', () => {
    const c = buildTemplateContent(FORM);
    expect(templateSummary(c).subtotal).toBe(120 * 12.5 + 300 * 2);
    let n = 0;
    const f = templateToFormState(c, () => `new-${++n}`);
    expect(f.sections).toEqual([{ key: 'new-1', id: null, name: 'Walls', sort_order: 0 }]);
    expect(f.items[0]).toMatchObject({ description: 'Tiles', quantity: '1', unit_price: '120', pricing_unit: 'm2', calculated_quantity: 12.5, quantity_source: 'manual', section_key: 'new-1' });
    expect(f.items.every((it) => !('id' in it))).toBe(true);
    expect(f.quoteStructureMode).toBe('divided');
    expect(f.quoteSubject).toBeNull(); // subject is not kept by default
  });
});

describe('templates - storage', () => {
  it('insert is owner-scoped and sanitized; an empty quote is refused before any request', async () => {
    const inserted = [];
    const client = { from: vi.fn(() => ({ insert: (row) => { inserted.push(row); return { select: () => ({ single: () => Promise.resolve({ data: { id: 't1', ...row }, error: null }) }) }; } })) };
    const r = await createTemplate(client, USER, '  Bathroom   basic ', FORM);
    expect(r.ok).toBe(true);
    expect(inserted[0].user_id).toBe(USER);
    expect(inserted[0].name).toBe('Bathroom basic');
    expect(deepKeys(inserted[0].content).has('client_name')).toBe(false);
    const none = await createTemplate(client, USER, 'x', { items: [{ description: '' }] });
    expect(none.error).toEqual({ code: 'invalid', message: 'no_items' });
    expect(inserted).toHaveLength(1);
  });
  it('errors are classified (duplicate name / unavailable)', () => {
    expect(classifyTemplateError({ code: '23505', message: 'duplicate key value violates unique constraint "quote_templates_owner_name"' })).toBe('duplicate_name');
    expect(classifyTemplateError({ code: 'PGRST205', message: 'Could not find the table' })).toBe('unavailable');
  });
});

describe('templates - dialogs', () => {
  it('HE save: name required, the "never kept" list is stated, success only after the database row', async () => {
    const client = { from: vi.fn(() => ({ insert: (row) => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 't1', ...row }, error: null }) }) }) })) };
    render(<SaveTemplateDialog isHebrew client={client} userId={USER} form={FORM} formatMoney={(v) => `₪${v.toFixed(2)}`} onClose={vi.fn()} />);
    expect(screen.getByTestId('template-never').textContent).toMatch(/לקוח ואיש קשר, מספר הצעה, מצב, חתימה, תשלום, קישור ותאריכים/);
    expect(screen.getByTestId('template-summary').textContent).toMatch(/₪2100.00/);
    fireEvent.click(screen.getByTestId('template-save'));
    await waitFor(() => expect(screen.getByTestId('template-save-result').textContent).toBe('יש לתת שם לתבנית.'));
    fireEvent.change(screen.getByTestId('template-name'), { target: { value: 'אמבטיה' } });
    fireEvent.click(screen.getByTestId('template-save'));
    await waitFor(() => expect(screen.getByTestId('template-save-result').textContent).toBe('התבנית נשמרה.'));
  });
  it('EN pick: list -> preview -> use hands over the content; a server without the table says so', async () => {
    const content = buildTemplateContent(FORM);
    const make = (result) => ({ from: vi.fn(() => { const b = { select: () => b, eq: () => b, order: () => Promise.resolve(result) }; return b; }) });
    const onUse = vi.fn();
    const r1 = render(<TemplatePickerDialog isHebrew={false} client={make({ data: [{ id: 't1', user_id: USER, name: 'Bathroom', content }], error: null })} userId={USER} formatMoney={(v) => `$${v.toFixed(2)}`} onClose={vi.fn()} onUse={onUse} />);
    await waitFor(() => expect(screen.getByTestId('template-preview')).toBeInTheDocument());
    expect(screen.getByTestId('template-preview').textContent).toMatch(/Tiles/);
    fireEvent.click(screen.getByTestId('template-use'));
    expect(onUse).toHaveBeenCalledWith(content);
    r1.unmount();
    render(<TemplatePickerDialog isHebrew={false} client={make({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } })} userId={USER} formatMoney={String} onClose={vi.fn()} onUse={onUse} />);
    await waitFor(() => expect(screen.getByTestId('template-list-error').textContent).toMatch(/not available on this server yet/));
  });
  it('the new-quote menu offers the template entry only when the caller wires it', () => {
    const onTemplate = vi.fn();
    const { rerender, container } = render(<div className="dash-shell-outer"><NewQuoteMenu isHebrew onStandard={vi.fn()} /></div>);
    fireEvent.click(container.querySelector('.quote-primary-action'));
    expect(container.querySelector('[data-choice="template"]')).toBeNull();
    rerender(<div className="dash-shell-outer"><NewQuoteMenu isHebrew onStandard={vi.fn()} onTemplate={onTemplate} /></div>);
    fireEvent.click(container.querySelector('.quote-primary-action'));
    fireEvent.click(container.querySelector('.quote-primary-action'));
    fireEvent.click(container.querySelector('[data-choice="template"]'));
    expect(onTemplate).toHaveBeenCalled();
  });
});
