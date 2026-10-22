// Customer Twin ("בדיקת הלקוח", Owner night task 2026-10-22; Codex review fixes 2026-10-23): the panel - counters, the free checklist,
// the AI view, approve-one-by-one, honest notices, the closed states; HE / RTL and EN / LTR. The recipient side never reads any of it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import CustomerTwinPanel from './components/CustomerTwinPanel';
import { twinPayloadFromEditor, twinPayloadFromQuoteRow } from './utils/customerTwinClient';

afterEach(cleanup);

const { quote } = twinPayloadFromEditor({
  market: 'IL', currency: 'ILS', quoteSubject: 'שיפוץ מטבח', terms: 'תשלום בסיום', warranty: '', validUntil: '', taxRate: 0.18, clientType: 'private',
  discount: 0, financials: { subtotal: 1500, discountAmount: 0, netAmount: 1271.19, taxAmount: 228.81, total: 1500 },
  items: [{ description: 'פירוק מטבח קיים כולל פינוי', quantity: '1', unit_price: '1500', specification: [] }],
});
const analysis = {
  schema: 'customer-twin/1',
  personas: [{ kind: 'price', state: 'hesitant', says: 'המחיר 1,500 ₪ לא מוסבר' }, { kind: 'quality', state: 'convinced', says: 'נראה מקצועי' }, { kind: 'skeptic', state: 'may_stop', says: 'מה כלול?' }],
  persuasive: ['פירוט ברור'], blockers: ['אין אחריות'], strengthen: ['להוסיף אחריות'],
  edits: [{ target: 'warranty', itemNumber: null, text: 'אחריות ___ חודשים על העבודה', reason: 'הלקוח רוצה ביטחון' }],
};
function client({ status = { ok: true, monthlyLimit: 20, monthlyRemaining: 18, purchasedRemaining: 4, purchasedTotal: 10 }, invoke, session = true } = {}) {
  return {
    auth: { getSession: vi.fn(async () => ({ data: { session: session ? { access_token: 'tok' } : null } })), refreshSession: vi.fn(async () => ({ data: { session: null } })) },
    rpc: vi.fn(async () => ({ data: status, error: null })),
    functions: { invoke: invoke || vi.fn(async () => ({ data: { ok: true, cached: false, saved: true, analysis, checklist: [], status: { ...status, monthlyRemaining: 17 } }, error: null })) },
  };
}
const errorReply = (body, status = 429) => vi.fn(async () => ({ data: null, error: { name: 'FunctionsHttpError', context: new Response(JSON.stringify({ ok: false, ...body,
  status: { monthlyLimit: 20, monthlyRemaining: 0, purchasedRemaining: 0, purchasedTotal: 0 } }), { status }) } }));

describe('Customer Twin panel', () => {
  it('opens with the counters ("2 of 20" / "4 of 10") and the free checklist, nothing sent until the click', async () => {
    const sb = client();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={sb} quote={quote} market="IL" mode="editor" onApplyEdit={() => {}} />);
    expect(screen.getByTestId('customer-twin-panel').getAttribute('dir')).toBe('rtl');
    await waitFor(() => expect(screen.getByTestId('customer-twin-counter').textContent).toContain('נשארו לכם 18 מתוך 20 בדיקות החודש'));
    expect(screen.getByTestId('customer-twin-counter').textContent).toContain('נשארו לכם 4 מתוך 10 הבדיקות שקניתם');
    const checks = screen.getByTestId('customer-twin-checklist');
    expect(checks.querySelector('[data-check="warranty"]').getAttribute('data-status')).toBe('missing');
    expect(checks.querySelector('[data-check="disposal"]').getAttribute('data-status')).toBe('ok');
    expect(checks.querySelector('[data-check="validity"]').getAttribute('data-status')).toBe('warn');
    expect(sb.functions.invoke).not.toHaveBeenCalled();
    expect(screen.getByTestId('customer-twin-internal').textContent).toMatch(/הלקוח לא רואה אותה/);
    expect(screen.getByTestId('customer-twin-brand').querySelector('svg[data-customer-twin-icon="color"]').getAttribute('width')).toBe('64'); // law 45: the large mark
    expect(screen.getByTestId('customer-twin-run').querySelector('svg[data-customer-twin-icon="light"]')).toBeTruthy(); // white on the blue button
  });
  it('the AI view: three customers, money in the market format, a suggestion added ONLY on approval; the call uses a fresh session', async () => {
    const onApplyEdit = vi.fn();
    const sb = client();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={sb} quote={quote} market="IL" mode="editor" onApplyEdit={onApplyEdit} />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-personas')).toBeTruthy());
    expect(sb.functions.invoke).toHaveBeenCalledWith('customer-twin', { body: { quote }, headers: { Authorization: 'Bearer tok' } });
    const personas = [...screen.getByTestId('customer-twin-personas').querySelectorAll('[data-persona]')].map((n) => `${n.dataset.persona}:${n.dataset.state}`);
    expect(personas).toEqual(['quality:convinced', 'price:hesitant', 'skeptic:may_stop']); // the binding reference's order
    const priceCard = screen.getByTestId('customer-twin-personas').querySelector('[data-persona="price"]');
    expect(priceCard.textContent).toContain('1,500.00'); // IRON-ILS-001
    expect(priceCard.querySelector('p bdi[dir="ltr"]')).toBeTruthy(); // IRON-NUMERIC-001
    expect(screen.getByText('עלול לוותר')).toBeTruthy();
    expect(onApplyEdit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('customer-twin-apply'));
    expect(onApplyEdit).toHaveBeenCalledWith(analysis.edits[0]);
    expect(screen.getByText('נוסף להצעה')).toBeTruthy();
    expect(screen.getByTestId('customer-twin-counter').textContent).toContain('17 מתוך 20');
  });
  it('a stored analysis shows its date; an answer that was not saved says so honestly', async () => {
    const cached = vi.fn(async () => ({ data: { ok: true, cached: true, analyzedAt: '2026-10-20T08:00:00Z', analysis, checklist: [] }, error: null }));
    const r1 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: cached })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-cached').textContent).toMatch(/20[./]10[./]2026/));
    r1.unmount();
    const notSaved = vi.fn(async () => ({ data: { ok: true, cached: false, saved: false, refunded: true, analysis, checklist: [] }, error: null }));
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: notSaved })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-not-saved').textContent).toBe('הניתוח לא נשמר, ולכן הבדיקה לא נספרה.'));
  });
  it('a failed check says "not counted" ONLY when the refund was confirmed', async () => {
    const r1 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply({ code: 'provider_failure', refunded: true }, 502) })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('והיא לא נספרה'));
    r1.unmount();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply({ code: 'provider_failure', refunded: false }, 502) })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('תוחזר אוטומטית'));
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
  it('closed states: the month used up / no SMART PACK / signed out / not available here', async () => {
    const r1 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply({ code: 'quota_exhausted' }) })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('נוצלו כל 20 הבדיקות של החודש'));
    expect(screen.getByTestId('customer-twin-error').textContent).toContain('20 בדיקות נוספות ב־₪5.00'); // IRON-ILS-001 whole shekels
    r1.unmount();
    const onOpenPlans = vi.fn();
    const r2 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ invoke: errorReply({ code: 'smart_pack_required' }, 403) })} quote={quote} market="IL" onOpenPlans={onOpenPlans} />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('חלק מחכם פלוס'));
    expect(screen.getByTestId('customer-twin-error').textContent).toContain('10 בדיקות נוספות ב־₪5.00');
    fireEvent.click(screen.getByText('למסך המסלולים'));
    expect(onOpenPlans).toHaveBeenCalled();
    r2.unmount();
    const r3 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client({ session: false })} quote={quote} market="IL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').dataset.code).toBe('unauthenticated'));
    r3.unmount();
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

describe('Customer Twin: a re-run, no market / too long, the price by market', () => {
  it('"check again" clears the "added" marks of the previous answer', async () => {
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client()} quote={quote} market="IL" mode="editor" onApplyEdit={() => {}} />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => screen.getByTestId('customer-twin-apply'));
    fireEvent.click(screen.getByTestId('customer-twin-apply'));
    expect(screen.queryByTestId('customer-twin-apply')).toBeNull();
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-apply')).toBeTruthy());
  });
  it('no business country / a too-long quote: an explanation; an international account sees dollars', async () => {
    const r1 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client()} quote={null} market={null} />);
    expect(screen.getByTestId('customer-twin-not-checkable').textContent).toContain('מדינת העסק');
    r1.unmount();
    const r2 = render(<CustomerTwinPanel open onClose={() => {}} isHebrew supabase={client()} quote={null} tooLong market="IL" />);
    expect(screen.getByTestId('customer-twin-not-checkable').textContent).toContain('ארוכה מדי');
    r2.unmount();
    render(<CustomerTwinPanel open onClose={() => {}} isHebrew={false} supabase={client({ invoke: errorReply({ code: 'smart_pack_required' }, 403) })} quote={quote} market="INTERNATIONAL" />);
    fireEvent.click(screen.getByTestId('customer-twin-run'));
    await waitFor(() => expect(screen.getByTestId('customer-twin-error').textContent).toContain('10 more checks for $2.00'));
  });
});

describe('Customer Twin payloads: only quote content', () => {
  it('a saved list row: the saved order, the active quantity, the stored amounts as facts, the client removed', () => {
    const row = { currency: 'ILS', quote_subject: 'מקלחת למשפחת כהן', terms: 'שוטף + 30', warranty: 'שנה', valid_until: '2026-12-01', tax_rate: 0.18, client_type: 'business',
      discount: 5, subtotal: 1000, total: 1121, client_name: 'X', notes: 'Y',
      quote_items: [{ description: 'שני', quantity: 1, calculated_quantity: 12.5, pricing_unit: 'm2', unit_price: 100, sort_order: 2 }, { description: 'ראשון', quantity: 3, unit_price: 5, sort_order: 1 }] };
    const { quote: q, tooLong } = twinPayloadFromQuoteRow(row, 'IL', ['משפחת כהן']);
    expect(tooLong).toBe(false);
    expect(q).toMatchObject({ market: 'IL', clientType: 'business' });
    expect(q.items.map((i) => [i.ref, i.description, i.quantity])).toEqual([[1, 'ראשון', 3], [2, 'שני', 12.5]]);
    expect(q.subject).toBe('מקלחת ל[…]');
    expect(q.facts).toMatchObject({ subtotal: 1000, discountAmount: 50, total: 1121 });
    expect(JSON.stringify(q)).not.toMatch(/"X"|"Y"/);
  });
  it('the editor and the list send the same items for the same saved quote (never charged twice)', () => {
    const editor = twinPayloadFromEditor({ market: 'IL', currency: 'ILS', quoteSubject: 'S', terms: 't', warranty: '', validUntil: '2026-12-01', taxRate: 0.18, clientType: 'private', discount: 0,
      items: [{ description: 'ראשון', quantity: '3', calculated_quantity: '', unit_price: '5' }, { description: 'שני', quantity: '1', calculated_quantity: 12.5, pricing_unit: 'm2', unit_price: '100' }] }).quote;
    const list = twinPayloadFromQuoteRow({ currency: 'ILS', quote_subject: 'S', terms: 't', valid_until: '2026-12-01', tax_rate: 0.18, client_type: 'private', discount: 0, subtotal: 1265, total: 1265,
      quote_items: [{ description: 'שני', quantity: 1, calculated_quantity: 12.5, pricing_unit: 'm2', unit_price: 100, sort_order: 2 }, { description: 'ראשון', quantity: 3, unit_price: 5, sort_order: 1 }] }, 'IL').quote;
    expect(editor.items).toEqual(list.items);
  });
  it('a too-long quote is refused up front, before any request', () => {
    expect(twinPayloadFromEditor({ market: 'IL', items: Array.from({ length: 41 }, (_, i) => ({ description: `פריט ${i}`, quantity: 1, unit_price: 1 })) })).toEqual({ quote: null, tooLong: true });
  });
});

describe('the recipient never sees it', () => {
  it('the public quote functions and pages never read the Customer Twin tables or call it', () => {
    for (const f of ['supabase/functions/get-public-quote/index.ts', 'supabase/functions/quote-presentation/index.ts', 'src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/customer_twin|customer-twin|CustomerTwin/);
    }
  });
});
