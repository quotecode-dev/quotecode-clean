// Owner console 2026-11-01 (typed: "מאשר שהמערכת תוריד את חשבוניות פיי פלוס מהקישור במייל ותסרוק מחדש מ-28/07, כולל שינוי ב-L-22, שחרור עד
// הלייב יחד עם המנוי לכל החיים"): a PayPlus charge email has no file - its invoice-receipt is a PDF behind the email link (through a click
// tracker). Only that sender and only the PayPlus document address are fetched; the PayPlus emails decided before this read once more.
import { describe, it, expect, vi } from 'vitest';
import { linkedDocumentUrl, linkedSenderQuery, parseMessage, processMessage, scanBatch, LINKED_DOCS_SINCE, type ExpenseDeps } from './lib.ts';

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const DOC = 'https://restapi.payplus.co.il/getdoc/s/o/c90eaa62-52e9-43a3-8797-63cddeebd9b1.pdf';
const TRACKED = `https://8596jmye.r.eu-central-1.awstrack.me/L0/${encodeURIComponent(DOC)}/1/0109019a-abc/xyz=`;
const payplusMail = (id: string, href = TRACKED, from = 'PayPlus <no-reply@payplus.co.il>') => ({
  id, internalDate: String(Date.parse('2026-11-01T05:19:00Z')),
  payload: {
    mimeType: 'multipart/alternative', headers: [{ name: 'Subject', value: 'החיוב שלך אצל פיי פלוס בע"מ התקבל' }, { name: 'From', value: from }],
    parts: [{ mimeType: 'text/html', body: { data: b64url(`<p>היי TEKANGO, החיוב שלך אושר!</p><a href="${href}">צפייה בחשבונית / קבלה</a> <a href="mailto:service@payplus.co.il">service</a>`) } }],
  },
});
const answer = JSON.stringify({
  is_invoice: true, addressed_to_us: true, business_related: true, confidence: 'high', reason_he: 'חשבונית מס קבלה של פיי פלוס על שם TEKANGO',
  main_document_index: 0, supplier_name: 'פיי פלוס בע"מ', supplier_vat_id: '515322683', supplier_country: 'IL', doc_type: 'tax_invoice_receipt', doc_number: '387604',
  doc_date: '2026-11-01', total_amount: 229.04, currency: 'ILS', vat_amount: 34.94, category: 'software_cloud',
});

function deps(over: Partial<ExpenseDeps> = {}) {
  const rows: Record<string, Record<string, unknown>> = {};
  const seenMap = new Map<string, { outcome: string; at: string }>();
  let t = Date.parse('2026-11-02T08:00:00Z');
  let n = 0;
  const d = {
    rows, seenMap,
    now: () => (t += 10),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    accessToken: vi.fn(async () => 'acc'),
    listMessageIds: vi.fn(async () => [] as string[]),
    getMessage: vi.fn(async (_a: string, id: string) => payplusMail(id)),
    getAttachment: vi.fn(async () => ''),
    fetchDocument: vi.fn(async () => btoa('%PDF-1.7 payplus')),
    complete: vi.fn(async () => ({ content: answer })),
    connections: async () => [{ mailbox: 'quotecodedev@gmail.com', scanned_until: '2026-11-01' }],
    token: async () => 'refresh-1234567',
    saveConnection: vi.fn(async () => {}),
    seen: async (_m: string, ids: string[]) => new Set(ids.filter((i) => seenMap.has(i))),
    notInvoiceBefore: async (_m: string, ids: string[], before: string) => new Set(ids.filter((i) => seenMap.get(i)?.outcome === 'not_invoice' && seenMap.get(i)!.at < before)),
    markSeen: vi.fn(async (_m: string, id: string, outcome: string) => { seenMap.set(id, { outcome, at: new Date(t).toISOString() }); }),
    recordRetry: vi.fn(async () => 1),
    isDuplicate: async (s: string, num: string) => Object.values(rows).some((r) => r.supplier_name === s && r.doc_number === num),
    insertInvoice: vi.fn(async (row: Record<string, unknown>) => { rows[String(row.id)] = { ...row }; return String(row.id); }),
    upload: vi.fn(async () => {}),
    ...over,
  };
  return d as unknown as ExpenseDeps & { rows: typeof rows; seenMap: typeof seenMap; fetchDocument: ReturnType<typeof vi.fn>; upload: ReturnType<typeof vi.fn> };
}

describe('the PayPlus document link', () => {
  it('the click tracker is decoded to the PayPlus document address; anything else is refused', () => {
    expect(linkedDocumentUrl(TRACKED)).toBe(DOC);
    expect(linkedDocumentUrl(DOC)).toBe(DOC);
    expect(linkedDocumentUrl('https://evil.example/getdoc/x.pdf')).toBeNull();
    expect(linkedDocumentUrl('http://restapi.payplus.co.il/getdoc/s/o/c90eaa62-52e9.pdf')).toBeNull();
    expect(linkedDocumentUrl('https://restapi.payplus.co.il/getdoc/../../etc/passwd.pdf')).toBeNull();
    expect(linkedDocumentUrl(`https://x.r.eu-central-1.awstrack.me/L0/${encodeURIComponent('https://www.payplus.co.il/terms')}/1/a`)).toBeNull();
    expect(linkedDocumentUrl('mailto:service@payplus.co.il')).toBeNull();
  });
  it('the email links are read from the HTML', () => {
    expect(parseMessage(payplusMail('p1'))!.links).toContain(TRACKED);
  });
  it('the Gmail search of the one-time pass: PayPlus mail since the first scan day', () => {
    expect(linkedSenderQuery()).toMatch(/^after:\d+ from:payplus\.co\.il -in:chats/);
  });
});

describe('a PayPlus charge email becomes an invoice with its PDF', () => {
  it('the PDF is fetched from the link, sent to the reader and stored with the row', async () => {
    const d = deps();
    expect(await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'p1')).toBe('invoice');
    expect(d.fetchDocument).toHaveBeenCalledWith(DOC);
    const row = Object.values(d.rows)[0];
    expect(row).toMatchObject({ status: 'pending', supplier_name: 'פיי פלוס בע"מ', doc_number: '387604', amount: 229.04, has_file: true, file_type: 'application/pdf' });
    expect(d.upload).toHaveBeenCalledTimes(1);
  });
  it('another sender with the same link is never fetched', async () => {
    const d = deps({ getMessage: vi.fn(async (_a: string, id: string) => payplusMail(id, TRACKED, 'Someone <x@example.com>')) });
    await processMessage(d, 'quotecodedev@gmail.com', 'acc', 'p2');
    expect(d.fetchDocument).not.toHaveBeenCalled();
  });
  it('a document that cannot be fetched now = the email is retried (never decided without its invoice)', async () => {
    const d = deps({ fetchDocument: vi.fn(async () => null) });
    await expect(processMessage(d, 'quotecodedev@gmail.com', 'acc', 'p3')).rejects.toThrow('linked_document_unavailable');
    expect(Object.keys(d.rows)).toHaveLength(0);
  });
});

describe('the one-time pass over the PayPlus emails decided before (from 28/07)', () => {
  it('an email decided "not an invoice" before the link was read is read once more - and only once', async () => {
    const d = deps({ listMessageIds: vi.fn(async (_a: string, q: string) => (q.includes('from:payplus.co.il') ? ['old1', 'old2'] : [])) });
    d.seenMap.set('old1', { outcome: 'not_invoice', at: '2026-10-15T09:00:00Z' });
    d.seenMap.set('old2', { outcome: 'invoice', at: '2026-10-15T09:00:00Z' });
    const r = await scanBatch(d, 100000);
    expect(r.found).toBe(1);
    expect(Object.values(d.rows).map((x) => x.message_id)).toEqual(['old1']);
    expect(d.seenMap.get('old1')!.at >= LINKED_DOCS_SINCE).toBe(true);
    const again = await scanBatch(d, 100000);
    expect(again.processed).toBe(0);
  });
});
