// Customer Twin ("בדיקת הלקוח", Owner night task 2026-10-22): the panel - counters, the free checklist, the AI view, approve-one-by-one,
// the closed states; HE / RTL and EN / LTR. The recipient side never reads any of it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import CustomerTwinPanel from './components/CustomerTwinPanel';
import { twinPayloadFromEditor, twinPayloadFromQuoteRow } from './utils/customerTwinClient';

afterEach(cleanup);

const quote = twinPayloadFromEditor({
  market: 'IL', currency: 'ILS', quoteSubject: 'שיפוץ מטבח', terms: 'תשלום בסיום', warranty: '', validUntil: '', taxRate: 18, clientType: 'private',
  discount: 0, subtotal: 1500, totalAmount: 1770,
  items: [{ description: 'פירוק מטבח קיים כולל פינוי', quantity: '1', unit_price: '1500', specification: [] }],
});
const analysis = {
  schema: 'customer-twin/1',
  personas: [{ kind: 'price', state: 'hesitant', says: 'המחיר לא מוסבר' }, { kind: 'quality', state: 'convinced', says: 'נראה מקצועי' }, { kind: 'skeptic', state: 'may_stop', says: 'מה כלול?' }],
  persuasive: ['פירוט ברור'], blockers: ['אין אחריות'], strengthen: ['להוסיף אחריות'],
  edits: [{ target: 'warranty', itemNumber: null, text: 'אחריות ___ חודשים על העבודה', reason: 'הלקוח רוצה ביטחון' }],
};
function client({ status = { ok: true, monthlyLimit: 20, monthlyRemaining: 18, purchasedRemaining: 4, purchasedTotal: 10 }, invoke } = {}) {
  return {
    rpc: vi.fn(async () => ({ data: status, error: null })),
    functions: { invoke: invoke || vi.fn(async () => ({ data: { ok: true, cached: false, analysis, checklist: [], status: { ...status, monthlyRemaining: 17 } }, error: null })) },
  };
}
const errorReply = (code, status = 429) => vi.fn(async () => ({ data: null, error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ ok: false, code, status: { monthlyLimit: 20, monthlyRemaining: 0, purchasedRemaining: 0, purchasedTotal: 0 } }), { status }) } }));

describe('Customer Twin panel', () => {
  it('opens with the counters ("2 of 20" / "4 of 10") and the free checklist, nothing sent until the click', async () => {
    const sb = client();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={sb} quote={quote} market="IL" mode="editor" onApplyEdit={() => {}} />);
    expect(screen.getByTestId('customer-twin-panel').getAttribute('dir')).toBe('rtl');
    await waitFor(() => expect(screen.getByTestId('customer-twin-counter').textContent).toContain('נשארו לכם 18 מתוך 20 בדיקות החודש'));
    expect(screen.getByTestId('customer-twin-counter').textContent).toContain('4 מתוך 10 בדיקות שנקנו');
    const checks = screen.getByTestId('customer-twin-checklist');
    expect(checks.querySelector('[data-check="warranty"]').getAttribute('data-status')).toBe('missing');
    expect(checks.querySelector('[data-check="disposal"]').getAttribute('data-status')).toBe('ok');
    expect(sb.functions.invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('customer-twin-internal').textContent).toMatch(/הלקוח לא רואה אותה/);
  });
  it('the AI view: three customers, three lists, and a suggestion added ONLY on approval', async () => {
    const onApplyEdit = vi.fn();
    const sb = client();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={sb} quote={quote} market="IL" mode="editor" onApplyEdit={onApplyEdit} />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-personas')).toBeTruthy());
    expect(sb.functions.invoke).toHaveBeenCalledWith('customer-twin', { body: { quote } });
    const personas = [...screen.getByTestId('customer-twin-personas').querySelectorAll('[data-persona]')].map((n) => `${n.dataset.persona}:${n.dataset.state}`);
    expect(personas).toEqual(['quality:convinced', 'price:hesitant', 'skeptic:may_stop']); // the binding reference's order
    expect(screen.getByText('עלול לעצור')).toBeTruthy();
    expect(onApplyEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('customer-twin-apply'));
    expect(onApplyEdit).toHaveBeenCalledWith(analysis.edits[0]);
    expect(screen.getByText('נוסף להצעה')).toBeTruthy();
    expect(screen.getByTestId('customer-twin-counter').textContent).toContain('17 מתוך 20');
  });
  it('from the list: read-only, the owner opens the editor to add', async () => {
    const onOpenEditor = vi.fn();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew={false} supabase={client()} quote={quote} market="INTERNATIONAL" mode="list" onOpenEditor={onOpenEditor} />);
    expect(screen.getByTestId('customer-twin-panel').getAttribute('dir')).toBe('ltr');
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-edits')).toBeTruthy());
    expect(screen.queryByTestId('customer-twin-apply')).toBeNull();
    fireEvent.click(screen.getByText('Open in the editor'));
    expect(onOpenEditor).toHaveBeenCalled();
  });
  it('closed states: the month used up / no SMART PACK (purchase "coming soon") / not available here', async () => {
    const r1 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply('quota_exhausted') })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('נוצלו כל 20 הבדיקות של החודש'));
    expect(screen.getByTestId('customer-twin-error').textContent).toContain('20 בדיקות נוספות ב־5 ₪');
    r1.unmount();
    const onOpenPlans = vi.fn();
    const r2 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply('smart_pack_required', 403) })} quote={quote} market="IL" onOpenPlans={onOpenPlans} />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('חלק מחכם פלוס'));
    expect(screen.getByTestId('customer-twin-error').textContent).toContain('10 בדיקות נוספות ב־5 ₪');
    fireEvent.click(screen.getByText('למסך המסלולים'));
    expect(onOpenPlans).toHaveBeenCalled();
    r2.unmount();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: vi.fn(async () => ({ data: null, error: { name: 'FunctionsFetchError' } })) })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').dataset.code).toBe('not_deployed'));
  });
  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<CustomerTwinPanel open onClose={onClose} isHebrew supabase={client()} quote={quote} market="IL" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Customer Twin payloads: only quote content', () => {
  it('a saved list row maps to the same allow-listed shape', () => {
    const q = twinPayloadFromQuoteRow({ currency: 'ILS', quote_subject: 'מקלחת', terms: 'שוטף + 30', warranty: 'שנה', valid_until: '2026-12-01', tax_rate: 18, client_type: 'business',
      discount: 5, subtotal: 1000, total: 1121, client_name: 'X', notes: 'Y', quote_items: [{ description: 'החלפת ברז', quantity: 2, unit_price: 500 }] }, 'IL');
    expect(q).toMatchObject({ market: 'IL', subject: 'מקלחת', clientType: 'business', items: [{ description: 'החלפת ברז', quantity: 2, unitPrice: 500 }] });
    expect(JSON.stringify(q)).not.toMatch(/"X"|"Y"/);
  });
});

describe('the recipient never sees it', () => {
  it('the public quote functions and pages never read the Customer Twin tables or call it', () => {
    for (const f of ['supabase/functions/get-public-quote/index.ts', 'supabase/functions/quote-presentation/index.ts', 'src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/customer_twin|customer-twin|CustomerTwin/);
    }
  });
});
