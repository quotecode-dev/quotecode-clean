// Owner console 2026-11-01 (typed: "מאשר: זיהוי חשבוניות זיכוי בכלי ההוצאות, סימון בלי אפשרות אישור, כולל שינוי ב-L-22, שחרור עד הלייב אחרי שמסיימים את הסרטון"):
// + (typed: "כל חשבונית זיכוי עוברת לפיי פלוס במינוס, כל מסמך בפני עצמו, בלי חישוב נטו, אחרי אישור שלי במסך"): the real case: Sparkiz credit note 30530, 370 ILS printed
// WITHOUT a minus, "מסמך זה מבטל מסמך מספר 30529".
import { describe, it, expect, vi } from 'vitest';
import { processMessage, validateExtraction, payplusFields, documentMatch, vatRule, EXTRACTION_SCHEMA, type ExpenseDeps } from './lib.ts';

const NOW = Date.parse('2026-11-02T08:00:00Z');
const base = {
  is_invoice: true, addressed_to_us: true, business_related: true, confidence: 'high', reason_he: 'מסמך של ספרקיז על שם TEKANGO',
  main_document_index: null, supplier_name: 'אור ממן', supplier_vat_id: '311214605', supplier_country: 'IL', doc_type: 'credit_note', doc_number: '30530',
  credited_doc_number: '30529', doc_date: '2026-11-01', total_amount: 370, currency: 'ILS', vat_amount: 0, category: 'ai', supplier_tax_status: 'unknown',
};
const mail = (id: string) => ({
  id, internalDate: String(NOW),
  payload: { mimeType: 'text/plain', headers: [{ name: 'Subject', value: 'חשבונית מס זיכוי' }, { name: 'From', value: 'Sparkiz <info@sparkiz.ai>' }], body: { data: btoa('credit') } },
});
function deps(answer: Record<string, unknown>, dup = false) {
  const rows: Record<string, unknown>[] = [];
  const d = {
    rows,
    now: () => NOW,
    uuid: () => '00000000-0000-4000-8000-000000000001',
    getMessage: vi.fn(async (_a: string, id: string) => mail(id)),
    getAttachment: vi.fn(async () => ''),
    fetchDocument: vi.fn(async () => ''),
    complete: vi.fn(async () => ({ content: JSON.stringify(answer) })),
    markSeen: vi.fn(async () => {}),
    isDuplicate: async () => dup,
    insertInvoice: vi.fn(async (row: Record<string, unknown>) => { rows.push(row); return String(row.id); }),
    upload: vi.fn(async () => {}),
  };
  return d as unknown as ExpenseDeps & { rows: Record<string, unknown>[] };
}

describe('supplier credit notes', () => {
  it('the model can name a credit note and the document it cancels', () => {
    const props = (EXTRACTION_SCHEMA as unknown as { schema: { properties: Record<string, { enum?: string[] }>; required: string[] } }).schema;
    expect(props.properties.doc_type.enum).toContain('credit_note');
    expect(props.required).toContain('credited_doc_number');
  });
  it('a positive printed amount is kept; a printed minus is stored as the positive credited amount', () => {
    const a = validateExtraction(JSON.stringify(base), 0, NOW)!;
    expect([a.docType, a.totalAmount, a.creditedDocNumber]).toEqual(['credit_note', 370, '30529']);
    expect(validateExtraction(JSON.stringify({ ...base, total_amount: -370 }), 0, NOW)!.totalAmount).toBe(370);
  });
  it('an ordinary charge keeps refusing a negative amount and never carries a credited number', () => {
    const x = validateExtraction(JSON.stringify({ ...base, doc_type: 'tax_invoice_receipt', total_amount: -390, credited_doc_number: '1' }), 0, NOW)!;
    expect(x.totalAmount).toBeNull();
    expect(x.creditedDocNumber).toBeNull();
  });
  it('a credit note waits for approval like any document, and says what it is', async () => {
    const d = deps(base);
    expect(await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'c1')).toBe('invoice');
    expect(d.rows[0]).toMatchObject({ doc_type: 'credit_note', credited_doc_number: '30529', status: 'pending', amount: 370 });
    expect(String(d.rows[0].reason)).toContain('חשבונית זיכוי');
  });
  it('it goes to PayPlus with a minus and the PayPlus credit-note type; a charge goes as before', () => {
    const row = { doc_type: 'credit_note', doc_number: '30530', doc_date: '2026-11-01', amount: 370, currency: 'ILS', amount_includes_vat: true, vat_percentage: 18, supplier_name: 'אור ממן' };
    const f = payplusFields(row, 7, null, null)!;
    expect([f.amount, f.doc_type_code, f.amount_includes_vat, f.vat_percentage]).toEqual(['-370.00', 'inv_refund', 'true', '18']);
    const c = payplusFields({ ...row, doc_type: 'tax_invoice_receipt', doc_number: '30529', amount: 390 }, 7, null, null)!;
    expect(c.amount).toBe('390.00');
    expect(c.doc_type_code).toBeUndefined();
  });
  it('a foreign credit note is sent in shekels with a minus', () => {
    const f = payplusFields({ doc_type: 'credit_note', doc_number: 'CR1', doc_date: '2026-11-01', amount: 10, currency: 'USD', amount_includes_vat: false, vat_percentage: 0 }, 7, { rate: 3.5, date: '2026-11-01' }, null)!;
    expect([f.amount, f.currency_code]).toEqual(['-35.00', 'ILS']);
  });
  it('the same credit note already in PayPlus with a minus is a match, never a second send', () => {
    const row = { doc_type: 'credit_note', doc_number: '30530', amount: 370, currency: 'ILS', supplier_vat_id: '311214605', supplier_name: 'אור ממן' };
    expect(documentMatch({ number: '30530', amount: -370, supplier: { vat_id: '311214605' } }, row, -370)).toBe('match');
  });
  it('an exempt dealer is without VAT; an authorised dealer or company is with VAT', () => {
    const r = (o: Record<string, unknown>) => { const x = validateExtraction(JSON.stringify({ ...base, ...o }), 0, NOW)!; return vatRule(x); };
    expect(r({ supplier_tax_status: 'exempt', vat_amount: 0 })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
    expect(r({ supplier_tax_status: 'exempt', vat_amount: 56 })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
    expect(r({ supplier_tax_status: 'licensed', vat_amount: null })).toEqual({ amountIncludesVat: true, vatPercentage: 18 });
    expect(r({ supplier_tax_status: 'licensed', vat_amount: -56.44 })).toEqual({ amountIncludesVat: true, vatPercentage: 18 });
    expect(r({ supplier_tax_status: 'unknown', vat_amount: 56.44 })).toEqual({ amountIncludesVat: true, vatPercentage: 18 });
    expect(r({ supplier_tax_status: 'unknown', vat_amount: null })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
    expect(r({ supplier_tax_status: 'licensed', supplier_country: 'foreign', currency: 'USD' })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
  });
  it('the charge itself still waits for approval as before', async () => {
    const d = deps({ ...base, doc_type: 'tax_invoice_receipt', doc_number: '30529', credited_doc_number: null, total_amount: 390 });
    expect(await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'c2')).toBe('invoice');
    expect(d.rows[0]).toMatchObject({ status: 'pending', amount: 390, credited_doc_number: null });
  });
});
