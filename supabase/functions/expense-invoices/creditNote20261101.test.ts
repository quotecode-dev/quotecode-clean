// Owner console 2026-11-01 (typed: "מאשר: זיהוי חשבוניות זיכוי בכלי ההוצאות, סימון בלי אפשרות אישור, כולל שינוי ב-L-22, שחרור עד הלייב אחרי שמסיימים את הסרטון"):
// a supplier credit note is recorded for the record and never enters the approval list. The real case: Sparkiz credit note 30530, 370 ILS printed
// WITHOUT a minus, "מסמך זה מבטל מסמך מספר 30529".
import { describe, it, expect, vi } from 'vitest';
import { processMessage, validateExtraction, EXTRACTION_SCHEMA, type ExpenseDeps } from './lib.ts';

const NOW = Date.parse('2026-11-02T08:00:00Z');
const base = {
  is_invoice: true, addressed_to_us: true, business_related: true, confidence: 'high', reason_he: 'מסמך של ספרקיז על שם TEKANGO',
  main_document_index: null, supplier_name: 'אור ממן', supplier_vat_id: '311214605', supplier_country: 'IL', doc_type: 'credit_note', doc_number: '30530',
  credited_doc_number: '30529', doc_date: '2026-11-01', total_amount: 370, currency: 'ILS', vat_amount: 0, category: 'ai',
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
  it('a credit note is recorded as excluded, says why, and never waits for approval', async () => {
    const d = deps(base);
    expect(await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'c1')).toBe('excluded');
    expect(d.rows[0]).toMatchObject({ doc_type: 'credit_note', credited_doc_number: '30529', status: 'excluded', amount: 370 });
    expect(String(d.rows[0].reason)).toContain('חשבונית זיכוי - לא נספרת כהוצאה');
  });
  it('the charge itself still waits for approval as before', async () => {
    const d = deps({ ...base, doc_type: 'tax_invoice_receipt', doc_number: '30529', credited_doc_number: null, total_amount: 390 });
    expect(await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'c2')).toBe('invoice');
    expect(d.rows[0]).toMatchObject({ status: 'pending', amount: 390, credited_doc_number: null });
  });
});
