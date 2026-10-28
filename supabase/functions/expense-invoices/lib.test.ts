// expense-invoices (Owner console 2026-10-22, typed L-22): only the Owner's two mailboxes, read-only; a signed short state (real HMAC); every
// email read once, a failed one retried and never lost; the VAT rule is code; nothing reaches PayPlus without approval, never twice, and a
// failed PayPlus search blocks the send; a failure stays on the row.
import { describe, it, expect, vi } from 'vitest';
import {
  expenseHandler, oauthCallback, scanBatch, parseMessage, validateExtraction, vatRule, gmailQuery, payplusFields, invoicePatch, settingsPatch,
  signState, verifyState, sameDocument, payplusRecords, callbackFailure, boiRate, payplusReason, createExpenseAt, subcategoryUuids, EXPENSE_MODEL, EXPENSE_FALLBACK_MODEL, type ExpenseDeps,
} from './lib.ts';

const NOW = Date.parse('2026-10-22T18:00:00Z');
const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('synthetic-state-key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const realHmac = async (text: string) => [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const answer = (o: Record<string, unknown> = {}) => JSON.stringify({
  is_invoice: true, addressed_to_us: true, business_related: true, confidence: 'high', reason_he: 'חשבונית חודשית על שירות ענן, על שם QUOTECODE',
  main_document_index: 0, supplier_name: 'Supabase Inc', supplier_vat_id: null, supplier_country: 'foreign', doc_type: 'receipt', doc_number: 'INV-1001',
  doc_date: '2026-09-01', total_amount: 35, currency: 'USD', vat_amount: null, category: 'software_cloud', ...o,
});
type P = Record<string, unknown>;
const gmailMessage = (id: string, parts: P[] | null = null) => ({
  id, internalDate: String(Date.parse('2026-09-01T10:00:00Z')),
  payload: {
    mimeType: 'multipart/mixed', headers: [{ name: 'Subject', value: 'Your receipt' }, { name: 'From', value: 'Supabase <billing@supabase.io>' }],
    parts: parts ?? [
      { mimeType: 'text/plain', body: { data: b64url('Thanks for your payment of $35.00. '.repeat(8)) } },
      { mimeType: 'application/pdf', filename: 'Receipt-1001.pdf', body: { attachmentId: 'att1', size: 2000 } },
    ],
  },
});

function deps(over: Partial<ExpenseDeps> = {}) {
  const rows: Record<string, P> = {};
  const seenMap = new Map<string, { outcome: string; attempts: number }>();
  const conns: Record<string, P> = { 'quotecodedev@gmail.com': { mailbox: 'quotecodedev@gmail.com', scanned_until: null } };
  let t = NOW;
  let n = 0;
  const d: ExpenseDeps & { rows: typeof rows; conns: typeof conns; seenMap: typeof seenMap } = {
    rows, conns, seenMap,
    caller: vi.fn(async () => 'admin' as const),
    isSuperAdmin: vi.fn(async () => true),
    config: { clientId: 'cid', redirectUri: 'https://x.supabase.co/functions/v1/expense-invoices/oauth-callback', appUrl: 'https://www.tekango.com' },
    hmac: realHmac,
    now: () => (t += 10),
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    exchangeCode: vi.fn(async () => ({ refreshToken: 'refresh-1234567', accessToken: 'acc' })),
    accessToken: vi.fn(async () => 'acc'),
    revoke: vi.fn(async () => {}),
    profileEmail: vi.fn(async () => 'QuoteCodeDev@gmail.com'),
    listMessageIds: vi.fn(async () => ['m1', 'm2']),
    getMessage: vi.fn(async (_a, id) => gmailMessage(id)),
    getAttachment: vi.fn(async () => b64url('%PDF-1.4 fake')),
    complete: vi.fn(async () => ({ content: answer() })),
    connections: async () => Object.values(conns) as { mailbox: string; scanned_until: string | null }[],
    token: async (m) => (conns[m] ? 'refresh-1234567' : null),
    saveToken: vi.fn(async () => {}),
    saveConnection: vi.fn(async (m, p) => { conns[m] = { ...(conns[m] || { mailbox: m }), ...p }; }),
    removeConnection: vi.fn(async (m) => { delete conns[m]; }),
    seen: async (_m, ids) => new Set(ids.filter((i) => seenMap.has(i) && seenMap.get(i)!.outcome !== 'retry')),
    markSeen: vi.fn(async (_m, id, outcome) => { seenMap.set(id, { outcome, attempts: seenMap.get(id)?.attempts ?? 0 }); }),
    recordRetry: vi.fn(async (_m, id) => { const a = (seenMap.get(id)?.attempts ?? 0) + 1; seenMap.set(id, { outcome: 'retry', attempts: a }); return a; }),
    isDuplicate: async (s, num) => Object.values(rows).some((r) => String(r.supplier_name).toLowerCase() === s.toLowerCase() && r.doc_number === num),
    insertInvoice: vi.fn(async (row) => { rows[String(row.id)] = { ...row }; return String(row.id); }),
    invoices: async (ids) => ids.map((i) => rows[i]).filter(Boolean),
    updateUnlessSent: vi.fn(async (id, p) => { if (!rows[id] || ['sent', 'sending'].includes(String(rows[id].status))) return false; rows[id] = { ...rows[id], ...p }; return true; }),
    claimForSend: vi.fn(async (id) => { if (!rows[id] || !['approved', 'send_failed'].includes(String(rows[id].status))) return null; rows[id].status = 'sending'; return { ...rows[id] }; }),
    finishSend: vi.fn(async (id, p) => { if (rows[id]?.status === 'sending') rows[id] = { ...rows[id], ...p }; }),
    settings: async () => ({ expense_types: [{ id: 5554, name: 'תוכנה' }], default_subcategory_id: 5554 }),
    saveSettings: vi.fn(async () => {}),
    upload: vi.fn(async () => {}),
    signedUrl: async () => 'https://signed',
    download: async () => 'JVBERi0=',
    payplusSearch: vi.fn(async () => []),
    payplusCreate: vi.fn(async () => 'pp-uuid-1'),
    payplusSubcategories: vi.fn(async () => ({})),
    payplusList: vi.fn(async () => []),
    payplusUpdate: vi.fn(async () => {}),
    sentInvoices: vi.fn(async () => []),
    ilsRate: vi.fn(async () => ({ rate: 3.7, date: '2026-09-01' })),
    notifyOwner: vi.fn(async () => {}),
    ...over,
  };
  return d;
}

describe('OAuth', () => {
  it('connect: only the two mailboxes, a signed short-lived state, read-only scope', async () => {
    const d = deps();
    expect((await expenseHandler({ action: 'connect', mailbox: 'someone@gmail.com' }, d, 'u1')).status).toBe(400);
    const r = await expenseHandler({ action: 'connect', mailbox: 'shlomisiny@gmail.com' }, d, 'u1');
    const url = new URL(String(r.body.url));
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.readonly');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('login_hint')).toBe('shlomisiny@gmail.com');
    expect(await verifyState(url.searchParams.get('state'), d.hmac, NOW)).toEqual({ u: 'u1', m: 'shlomisiny@gmail.com' });
  });
  it('a forged, tampered or expired state is refused', async () => {
    const d = deps();
    const st = await signState({ u: 'u1', m: 'quotecodedev@gmail.com', e: NOW + 60000 }, d.hmac);
    const [body, sig] = st.split('.');
    const otherBody = btoa(JSON.stringify({ u: 'u2', m: 'quotecodedev@gmail.com', e: NOW + 60000 })).replace(/=+$/, '');
    expect(await verifyState(`${otherBody}.${sig}`, d.hmac, NOW)).toBeNull();
    expect(await verifyState(`${body}.${sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'))}`, d.hmac, NOW)).toBeNull();
    expect(await verifyState(await signState({ u: 'u1', m: 'quotecodedev@gmail.com', e: NOW - 1 }, d.hmac), d.hmac, NOW)).toBeNull();
  });
  it('callback stores the token only for the mailbox asked for, by a user who is still super admin', async () => {
    const d = deps();
    const st = await signState({ u: 'u1', m: 'quotecodedev@gmail.com', e: NOW + 60000 }, d.hmac);
    expect((await oauthCallback({ code: 'c', state: st }, d)).redirect).toContain('expenseConnect=ok');
    expect(d.saveToken).toHaveBeenCalledWith('quotecodedev@gmail.com', 'refresh-1234567');
    const other = deps({ profileEmail: async () => 'stranger@gmail.com' });
    expect((await oauthCallback({ code: 'c', state: st }, other)).redirect).toContain('expenseConnect=wrong_mailbox');
    expect(other.saveToken).not.toHaveBeenCalled();
    const demoted = deps({ isSuperAdmin: async () => false });
    expect((await oauthCallback({ code: 'c', state: st }, demoted)).redirect).toContain('expenseConnect=failed');
    expect(demoted.exchangeCode).not.toHaveBeenCalled();
    expect((await oauthCallback({ code: 'c', state: 'x.y' }, d)).redirect).toContain('expenseConnect=expired');
  });
  it('a failed connection names its step from fixed codes only', async () => {
    const st = await signState({ u: 'u1', m: 'quotecodedev@gmail.com', e: NOW + 60000 }, realHmac);
    const token = deps({ exchangeCode: async () => { throw new Error('google_token:invalid_client'); } });
    expect((await oauthCallback({ code: 'c', state: st }, token)).redirect).toContain('expenseConnect=failed_token_invalid_client');
    const profile = deps({ profileEmail: async () => { throw new Error('gmail_403'); } });
    expect((await oauthCallback({ code: 'c', state: st }, profile)).redirect).toContain('expenseConnect=failed_profile_403');
    const store = deps({ saveToken: async () => { throw new Error('database'); } });
    expect((await oauthCallback({ code: 'c', state: st }, store)).redirect).toContain('expenseConnect=failed_store');
    expect(callbackFailure('token', 'google_token:<script>')).toBe('failed_token');
    expect(callbackFailure('profile', 'gmail_999')).toBe('failed_profile');
  });
  it('disconnect also withdraws the Google permission', async () => {
    const d = deps();
    await expenseHandler({ action: 'disconnect', mailbox: 'quotecodedev@gmail.com' }, d, 'u1');
    expect(d.revoke).toHaveBeenCalledWith('refresh-1234567');
    expect(d.conns['quotecodedev@gmail.com']).toBeUndefined();
  });
  it('a cron call may only scan; nobody else may do anything', async () => {
    expect((await expenseHandler({ action: 'send', ids: [] }, deps({ caller: async () => 'cron' }), null)).status).toBe(403);
    expect((await expenseHandler({ action: 'scan' }, deps({ caller: async () => null }), null)).status).toBe(401);
  });
});

describe('reading emails', () => {
  it('the Gmail query starts at Israel midnight of 28/07/2026 (epoch seconds) and never asks for every PDF', () => {
    const q = gmailQuery('2026-07-28');
    expect(q.startsWith(`after:${(Date.parse('2026-07-28T00:00:00Z') - 3 * 3600 * 1000) / 1000} `)).toBe(true);
    expect(q).toContain('-in:sent');
    expect(q).toContain('חשבונית');
    expect(q).not.toContain('filename:pdf');
  });
  it('parses subject, sender, Hebrew body (base64url with - and _) and the PDF; inline logos are skipped and the PDF comes first', () => {
    const hebrew = 'תודה על התשלום ₪117.50 ?>>?'.repeat(10);
    const m = parseMessage(gmailMessage('m1', [
      { mimeType: 'text/plain', body: { data: b64url(hebrew) } },
      { mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-Disposition', value: 'inline; filename="logo.png"' }], body: { attachmentId: 'logo', size: 40000 } },
      { mimeType: 'image/png', filename: 'tiny.png', body: { attachmentId: 'tiny', size: 900 } },
      { mimeType: 'image/jpeg', filename: 'scan.jpg', body: { attachmentId: 'scan', size: 90000 } },
      { mimeType: 'application/octet-stream', filename: 'Invoice-77.pdf', body: { attachmentId: 'pdf', size: 3000 } },
    ]));
    expect(b64url(hebrew)).toMatch(/[-_]/);
    expect(m?.text).toContain('₪117.50');
    expect(m?.attachments.map((a) => a.attachmentId)).toEqual(['pdf', 'scan']);
  });
  it('a stub plain part gives way to the HTML body', () => {
    const m = parseMessage(gmailMessage('m1', [{ mimeType: 'multipart/alternative', parts: [
      { mimeType: 'text/plain', body: { data: b64url('View in browser') } },
      { mimeType: 'text/html', body: { data: b64url('<html><body><p>Total charged</p><div>$120.00</div><style>.x{}</style></body></html>') } },
    ] }]));
    expect(m?.text).toContain('$120.00');
    expect(m?.text).not.toContain('View in browser');
  });
  it('the answer is validated: no invented dates, digits-only VAT id, an index inside the documents', () => {
    const x = validateExtraction(answer({ doc_date: '2031-01-01', supplier_vat_id: '51-234567-8', main_document_index: 5, currency: '₪' }), 1, NOW);
    expect(x?.docDate).toBeNull();
    expect(x?.supplierVatId).toBe('512345678');
    expect(x?.mainDocumentIndex).toBeNull();
    expect(x?.currency).toBe('ILS');
    expect(validateExtraction('not json', 0, NOW)).toBeNull();
  });
  it('VAT: ILS with VAT from a non-foreign supplier = included at 18%; foreign = none', () => {
    expect(vatRule({ supplierCountry: 'IL', currency: 'ILS', vatAmount: 54, docType: 'tax_invoice' })).toEqual({ amountIncludesVat: true, vatPercentage: 18 });
    expect(vatRule({ supplierCountry: 'unknown', currency: 'ILS', vatAmount: 17.9, docType: 'receipt' })).toEqual({ amountIncludesVat: true, vatPercentage: 18 });
    expect(vatRule({ supplierCountry: 'foreign', currency: 'USD', vatAmount: null, docType: 'receipt' })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
    expect(vatRule({ supplierCountry: 'IL', currency: 'ILS', vatAmount: null, docType: 'receipt' })).toEqual({ amountIncludesVat: false, vatPercentage: 0 });
  });
});

describe('scan', () => {
  it('every email is read once; an invoice becomes a pending row with its file stored first; a second scan reads nothing', async () => {
    const d = deps({ listMessageIds: vi.fn(async () => ['m1']) });
    const r = await scanBatch(d, 100000);
    expect(r).toMatchObject({ processed: 1, found: 1, remaining: 0, failed: 0 });
    const row = Object.values(d.rows)[0];
    expect(row).toMatchObject({ status: 'pending', supplier_name: 'Supabase Inc', amount: 35, currency: 'USD', amount_includes_vat: false, has_file: true, confidence: 'high' });
    expect(row.file_path).toBe(`${row.id}.pdf`);
    expect((d.upload as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]).toBeLessThan((d.insertInvoice as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    expect(d.conns['quotecodedev@gmail.com'].scanned_until).toBe('2026-10-22');
    expect((await scanBatch(d, 100000)).processed).toBe(0);
  });
  it('an upload failure stores no row and the email is read again', async () => {
    const d = deps({ listMessageIds: async () => ['m1'], upload: async () => { throw new Error('storage'); } });
    await scanBatch(d, 100000);
    expect(Object.keys(d.rows)).toHaveLength(0);
    expect(d.seenMap.get('m1')).toEqual({ outcome: 'retry', attempts: 1 });
  });
  it('private, not ours or a duplicate = kept aside (excluded) with the reason; not an invoice = no row', async () => {
    const answers = [answer({ business_related: false, reason_he: 'הזמנת אוכל' }), answer({ doc_number: 'X' }), answer({ doc_number: 'X' }), answer({ is_invoice: false })];
    const d = deps({ listMessageIds: async () => ['a', 'b', 'c', 'd'], complete: vi.fn(async () => ({ content: answers.shift() as string })) });
    const r = await scanBatch(d, 100000);
    expect(r.found).toBe(1);
    const st = Object.values(d.rows).map((x) => [x.status, String(x.reason).slice(0, 8)]);
    expect(st).toEqual([['excluded', 'נראית פר'], ['pending', 'חשבונית '], ['excluded', 'כפילות: ']]);
  });
  it('the fallback model is used when the main model is unavailable', async () => {
    const complete = vi.fn(async ({ model }) => { if (model === EXPENSE_MODEL) throw new Error('model_unavailable'); return { content: answer() }; });
    await scanBatch(deps({ listMessageIds: async () => ['m1'], complete }), 100000);
    expect(complete.mock.calls.map((c) => c[0].model)).toEqual([EXPENSE_MODEL, EXPENSE_FALLBACK_MODEL]);
  });
  it('a failed email is never lost: the mailbox is not "scanned until today", it is retried, and marked failed after 3 attempts', async () => {
    const d = deps({ listMessageIds: async () => ['m9'], complete: async () => { throw new Error('ai_failed'); } });
    const r1 = await scanBatch(d, 100000);
    expect(r1).toMatchObject({ processed: 1, failed: 0, remaining: 0 });
    expect(d.conns['quotecodedev@gmail.com'].scanned_until ?? null).toBeNull();
    expect(String(d.conns['quotecodedev@gmail.com'].last_error)).toContain('ינוסו שוב');
    await scanBatch(d, 100000);
    const r3 = await scanBatch(d, 100000);
    expect(r3.failed).toBe(1);
    expect(d.seenMap.get('m9')).toEqual({ outcome: 'failed', attempts: 3 });
    expect(d.conns['quotecodedev@gmail.com'].scanned_until).toBe('2026-10-22');
    expect((await scanBatch(d, 100000)).processed).toBe(0);
  });
  it('the time budget stops the batch and reports what is left', async () => {
    const d = deps({ listMessageIds: async () => ['a', 'b', 'c'] });
    const r = await scanBatch(d, 25);
    expect(r.processed).toBeLessThan(3);
    expect(r.remaining).toBe(3 - r.processed);
    expect(d.conns['quotecodedev@gmail.com'].scanned_until ?? null).toBeNull();
  });
  it('a rejected Google token is shown on the mailbox, not hidden', async () => {
    const d = deps({ accessToken: async () => { throw new Error('google_token'); } });
    await scanBatch(d, 100000);
    expect(String(d.conns['quotecodedev@gmail.com'].last_error)).toContain('לחבר את התיבה מחדש');
  });
});

describe('approval and PayPlus', () => {
  const approved = (d: ReturnType<typeof deps>, extra: P = {}) => {
    const id = '11111111-1111-1111-1111-111111111111';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Supabase Inc', email_subject: 'Your receipt', doc_number: 'INV-1001', doc_date: '2026-09-01', amount: 35,
      currency: 'USD', amount_includes_vat: false, vat_percentage: 0, file_path: `${id}.pdf`, file_name: 'Receipt.pdf', file_type: 'application/pdf', ...extra };
    return id;
  };
  it('only approved rows are sent (claimed first), with the file and the expense type; the row becomes sent', async () => {
    const d = deps();
    const id = approved(d);
    const r = await expenseHandler({ action: 'send', ids: [id] }, d, 'u1');
    expect(r.body.results).toEqual([{ id, ok: true }]);
    const [fields, file] = (d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0];
    // L-22 (Owner 2026-10-28): a foreign invoice goes in shekels at the representative rate of its date; the original amount opens the description
    expect(fields).toMatchObject({ number: 'INV-1001', doc_date: '2026-09-01', subcategory_id: '5554', amount: '129.50', currency_code: 'ILS', amount_includes_vat: 'false' });
    expect(fields.description).toBe('USD 35.00 × 3.7 (שער יציג 01/09/2026) · Supabase Inc - Your receipt');
    expect(d.ilsRate).toHaveBeenCalledWith('USD', '2026-09-01');
    expect(file).toMatchObject({ name: 'Receipt.pdf', type: 'application/pdf' });
    expect(d.rows[id]).toMatchObject({ status: 'sent', payplus_uuid: 'pp-uuid-1' });
  });
  it('two sends at once: only one reaches PayPlus', async () => {
    const d = deps();
    const id = approved(d);
    const [a, b] = await Promise.all([expenseHandler({ action: 'send', ids: [id] }, d, 'u1'), expenseHandler({ action: 'send', ids: [id] }, d, 'u1')]);
    expect([a.body.results, b.body.results].flat().filter((x) => (x as P).ok)).toHaveLength(1);
    expect(d.payplusCreate).toHaveBeenCalledTimes(1);
  });
  it('a pending row is not sent; the same number AND amount already in PayPlus is never sent twice', async () => {
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: 'INV-1001', docUID: 'existing-1', total_items_base_currency: 35 }]) });
    const id = approved(d, { status: 'pending' });
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: false, code: 'not_approved' }]);
    d.rows[id].status = 'approved';
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true, code: 'already_in_payplus' }]);
    expect(d.rows[id]).toMatchObject({ status: 'sent', payplus_uuid: 'existing-1' });
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it("another supplier's document with the same number is NOT a duplicate - the row is sent", async () => {
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: 'INV-1001', docUID: 'x', total_items_base_currency: 999, customer: { customer_name: 'Other Ltd' } }]) });
    const id = approved(d);
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true }]);
    expect(d.payplusCreate).toHaveBeenCalledTimes(1);
  });
  it('a failed PayPlus search blocks the send (never treated as "nothing found")', async () => {
    const d = deps({ payplusSearch: async () => { throw new Error('PayPlus search answer not understood'); } });
    const id = approved(d);
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: false, code: 'payplus_search_failed' }]);
    expect(d.payplusCreate).not.toHaveBeenCalled();
    expect(d.rows[id].status).toBe('send_failed');
  });
  it('a PayPlus failure is kept on the row', async () => {
    const d = deps({ payplusCreate: async () => { throw new Error('PayPlus 422: number must be numeric'); } });
    const id = approved(d);
    await expenseHandler({ action: 'send', ids: [id] }, d, 'u1');
    expect(d.rows[id]).toMatchObject({ status: 'send_failed', send_error: 'PayPlus 422: number must be numeric' });
  });
  it('the PayPlus search answer shapes; anything else is not understood', () => {
    expect(payplusRecords([{ number: '1' }])).toHaveLength(1);
    expect(payplusRecords({ data: [{ number: '1' }] })).toHaveLength(1);
    expect(payplusRecords({ status: 'ok' })).toBeNull();
    // the live PayPlus answer (2026-10-28): the list under details.items; an empty search is an empty list, not an error
    expect(payplusRecords({ status: 'success', details: { numItems: 0, numPages: 0, items: [], statistics: { totalAmount: 0 } } })).toEqual([]);
    expect(payplusRecords({ status: 'success', details: { numItems: 1, items: [{ number: '217295035' }] } })).toHaveLength(1);
    expect(payplusRecords({ status: 'success', details: { numItems: 1 } })).toBeNull();
    expect(sameDocument({ number: '1', customer: { customer_name: 'Supabase, Inc.' } }, { doc_number: '1', supplier_name: 'Supabase Inc', amount: 1 })).toBe(true);
  });
  it('a row without number / date / amount cannot be sent; at most 10 per call', async () => {
    expect(payplusFields({ doc_number: null, doc_date: '2026-09-01', amount: 1, currency: 'ILS' }, 1)).toBeNull();
    const ids = Array.from({ length: 11 }, (_, i) => `11111111-1111-1111-1111-1111111111${String(i).padStart(2, '0')}`);
    expect((await expenseHandler({ action: 'send', ids }, deps(), 'u1')).status).toBe(400);
  });
  it('edits are limited to known fields and a sent / sending row cannot change', async () => {
    expect(invoicePatch({ status: 'sent' })).toBeNull();
    expect(invoicePatch({ payplus_uuid: 'x' })).toBeNull();
    expect(invoicePatch({ docDate: '2026-02-31x' })).toBeNull();
    expect(invoicePatch({ status: 'approved', amount: 12.5 })).toEqual({ status: 'approved', amount: 12.5 });
    const d = deps();
    const id = approved(d, { status: 'sent', payplus_uuid: 'p' });
    const r = await expenseHandler({ action: 'update', id, patch: { status: 'rejected' } }, d, 'u1');
    expect(r).toEqual({ status: 409, body: { ok: false, code: 'already_sent', updated: 0 } });
    expect(d.rows[id].status).toBe('sent');
  });
  it('settings: expense types with unique positive ids, the default must be one of them', () => {
    expect(settingsPatch({ expenseTypes: [{ id: 5554, name: 'תוכנה' }], defaultSubcategoryId: 5554 }, 'now')).toMatchObject({ default_subcategory_id: 5554 });
    expect(settingsPatch({ expenseTypes: [{ id: 5554, name: 'תוכנה' }], defaultSubcategoryId: 9 }, 'now')).toBeNull();
    expect(settingsPatch({ expenseTypes: [{ id: -1, name: 'x' }] }, 'now')).toBeNull();
  });
});

describe('L-22 (Owner 2026-10-28, "שער יציג לפי תאריך החשבונית בשליחה לפיי פלוס"): a foreign invoice at the representative rate of its date', () => {
  const csv = ['SERIES_CODE,FREQ,BASE_CURRENCY,COUNTER_CURRENCY,UNIT_MEASURE,DATA_TYPE,DATA_SOURCE,TIME_COLLECT,CONF_STATUS,PUB_WEBSITE,UNIT_MULT,COMMENTS,TIME_PERIOD,OBS_VALUE,RELEASE_STATUS',
    'RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-10-22,3.712,YP', 'RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-10-23,3.705,YP',
    'RER_USD_ILS,D,USD,ILS,ILS,OF00,BOI_MRKT,V,F,Y,0,,2026-10-26,3.078,YP'].join('\n');
  it('the last rate published on or before the date (a weekend takes Friday); nothing before = none', () => {
    expect(boiRate(csv, '2026-10-25')).toEqual({ rate: 3.705, date: '2026-10-23' });
    expect(boiRate(csv, '2026-10-26')).toEqual({ rate: 3.078, date: '2026-10-26' });
    expect(boiRate(csv, '2026-10-01')).toBeNull();
    expect(boiRate('not,a,csv', '2026-10-25')).toBeNull();
    expect(boiRate(csv.replace(/,0,,2026-10-23/, ',2,,2026-10-23'), '2026-10-25')).toEqual({ rate: 3.712, date: '2026-10-22' }); // a per-100 series is skipped
  });
  it('a shekel invoice is sent as it is - no rate is looked up', async () => {
    const d = deps();
    const id = '22222222-2222-2222-2222-222222222222';
    d.rows[id] = { id, status: 'approved', supplier_name: 'גולן טלקום', email_subject: null, doc_number: '3413915', doc_date: '2026-09-15', amount: 88,
      currency: 'ILS', amount_includes_vat: true, vat_percentage: 18, file_path: null };
    await expenseHandler({ action: 'send', ids: [id] }, d, 'u1');
    expect((d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ amount: '88.00', currency_code: 'ILS', amount_includes_vat: 'true', vat_percentage: '18', description: 'גולן טלקום' });
    expect(d.ilsRate).not.toHaveBeenCalled();
  });
  it('no rate for the date = not sent, with the reason; nothing reaches PayPlus', async () => {
    const d = deps({ ilsRate: vi.fn(async () => null) });
    const id = '33333333-3333-3333-3333-333333333333';
    d.rows[id] = { id, status: 'approved', supplier_name: 'OpenAI', email_subject: null, doc_number: '9', doc_date: '2026-10-22', amount: 10, currency: 'USD', amount_includes_vat: false, vat_percentage: 0, file_path: null };
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: false, code: 'rate_unavailable' }]);
    expect(d.rows[id]).toMatchObject({ status: 'send_failed', send_error: 'השער היציג של USD ליום 22/10/2026 לא נמצא, לא נשלח' });
    expect(d.payplusSearch).not.toHaveBeenCalled();
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it('the same number with the shekel amount already in PayPlus is the same document (never sent twice)', async () => {
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: 'X-7', docUID: 'existing-7', total_items_base_currency: 129.5 }]) });
    const id = '44444444-4444-4444-4444-444444444444';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Other', email_subject: null, doc_number: 'X-7', doc_date: '2026-09-01', amount: 35, currency: 'USD', amount_includes_vat: false, vat_percentage: 0, file_path: null };
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true, code: 'already_in_payplus' }]);
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it('a foreign row without a rate gives no PayPlus fields', () => {
    expect(payplusFields({ doc_number: '1', doc_date: '2026-09-01', amount: 1, currency: 'USD' }, 1)).toBeNull();
    expect(payplusFields({ doc_number: '1', doc_date: '2026-09-01', amount: 1, currency: 'USD' }, 1, { rate: 3.5, date: '2026-09-01' })).toMatchObject({ amount: '3.50', currency_code: 'ILS' });
  });
});

describe('L-22 (Owner 2026-10-28, "הצגת ההסבר המלא של פיי פלוס בשליחה שנדחתה"): PayPlus explains a refusal', () => {
  it('from whichever field the explanation comes in; an HTML page becomes its text; an empty body says so', () => {
    expect(payplusReason(JSON.stringify({ results: { status: 'error', code: 403, description: 'expenses module is not allowed for this key' }, data: null })))
      .toBe('expenses module is not allowed for this key');
    expect(payplusReason(JSON.stringify({ status: 'error', message: 'number must be numeric' }))).toBe('number must be numeric');
    expect(payplusReason(JSON.stringify({ status: 'error', details: { field: 'subcategory_id' } }))).toBe('{"field":"subcategory_id"}');
    expect(payplusReason('<html><head><style>p{}</style></head><body><h1>403 Forbidden</h1><p>Request blocked</p></body></html>')).toBe('403 Forbidden Request blocked');
    expect(payplusReason('')).toBe('no answer body');
    expect(payplusReason('x'.repeat(500))).toHaveLength(300);
  });
});

describe('L-22 (Owner 2026-10-28, "כתובת השליחה של הוצאה חדשה לפיי פלוס"): a new expense goes to /books/expenses', () => {
  it('the first address is /books/expenses; an answer there is final', async () => {
    const post = vi.fn(async () => ({ status: 200, text: '{"status":"success"}' }));
    expect(await createExpenseAt(post)).toEqual({ status: 200, text: '{"status":"success"}' });
    expect(post.mock.calls).toEqual([['/books/expenses']]);
    const refused = vi.fn(async () => ({ status: 403, text: '{"message":"not allowed"}' }));
    expect((await createExpenseAt(refused)).text).toBe('{"message":"not allowed"}');
    expect(refused).toHaveBeenCalledTimes(1);
  });
  it('only an empty 403 (nothing created) tries /expenses once', async () => {
    const post = vi.fn(async (path: string) => (path === '/books/expenses' ? { status: 403, text: ' ' } : { status: 200, text: 'ok' }));
    expect(await createExpenseAt(post)).toEqual({ status: 200, text: 'ok' });
    expect(post.mock.calls).toEqual([['/books/expenses'], ['/expenses']]);
    const both = vi.fn(async () => ({ status: 403, text: '' }));
    expect(await createExpenseAt(both)).toEqual({ status: 403, text: '' });
    expect(both).toHaveBeenCalledTimes(2);
  });
});

describe('L-22 (Owner 2026-10-28, "שליחת סוג ההוצאה לפיי פלוס לפי המזהה שלהם"): the expense type goes by its PayPlus uuid', () => {
  const SW = '0a14899e-db7d-4c1c-9cc8-0d27b5e09c20';
  const EQ = '5114636c-4094-481c-a8d3-d194152a9d50';
  const list = { status: 'success', details: [{ id: 3086, name: 'הוצאות הנהלה וכלליות', subcategories: [{ id: 2402, uuid: SW }, { id: 2404, uuid: EQ }, { id: 'x', uuid: 'bad' }] }] };
  it('reads PayPlus\'s expense types list as number -> uuid; anything else is no entry', () => {
    expect(subcategoryUuids(list)).toEqual({ 2402: SW, 2404: EQ });
    expect(subcategoryUuids(null)).toEqual({});
    expect(subcategoryUuids({ details: 'x' })).toEqual({});
  });
  it('a new expense is sent with the type uuid (the number stays as before)', async () => {
    const d = deps({ payplusSubcategories: vi.fn(async () => ({ 2402: SW })) });
    const id = '55555555-5555-5555-5555-555555555555';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Electra', email_subject: null, doc_number: '477186582', doc_date: '2026-07-31', amount: 319, currency: 'ILS', amount_includes_vat: true, vat_percentage: 18, file_path: null, subcategory_id: 2402 };
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true }]);
    expect((d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ subcategory_id: '2402', subcategory_uuid: SW, amount: '319.00' });
  });
  it('the types list unavailable: the expense is still sent, without the uuid', async () => {
    const d = deps({ payplusSubcategories: vi.fn(async () => { throw new Error('down'); }) });
    const id = '66666666-6666-6666-6666-666666666666';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Electra', email_subject: null, doc_number: '1', doc_date: '2026-07-31', amount: 10, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, file_path: null, subcategory_id: 2402 };
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true }]);
    expect((d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0][0].subcategory_uuid).toBeUndefined();
  });
  it('the expenses already in PayPlus WITHOUT a type get it (same fields + the uuid); one with a type is never touched', async () => {
    const sent = [
      { id: 'a', status: 'sent', payplus_uuid: 'pp-1', supplier_name: 'Electra', email_subject: null, doc_number: '477186582', doc_date: '2026-07-31', amount: 319, currency: 'ILS', amount_includes_vat: true, vat_percentage: 18, subcategory_id: 2404 },
      { id: 'b', status: 'sent', payplus_uuid: 'created', supplier_name: 'Proton AG', email_subject: null, doc_number: '26288941', doc_date: '2026-08-18', amount: 47.88, currency: 'USD', amount_includes_vat: false, vat_percentage: 0, subcategory_id: null },
      { id: 'c', status: 'sent', payplus_uuid: 'pp-3', supplier_name: 'X', email_subject: null, doc_number: '9', doc_date: '2026-08-18', amount: 5, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, subcategory_id: 2402 },
    ];
    const d = deps({
      settings: async () => ({ expense_types: [{ id: 2402, name: 'תוכנה' }], default_subcategory_id: 2402 }),
      payplusSubcategories: vi.fn(async () => ({ 2402: SW, 2404: EQ })),
      sentInvoices: vi.fn(async () => sent),
      payplusList: vi.fn(async () => [
        { uuid: 'pp-1', number: '477186582', subcategory: {} },
        { uuid: 'pp-2', number: '26288941', subcategory: {} },
        { uuid: 'pp-3', number: '9', subcategory: { uuid: SW } },
        { uuid: 'pp-9', number: 'not-ours', subcategory: {} },
      ]),
      ilsRate: vi.fn(async () => ({ rate: 2.986, date: '2026-08-18' })),
    });
    expect((await expenseHandler({ action: 'sync_types' }, d, 'u1')).body).toEqual({ ok: true, updated: 2, failed: 0, types: 2 });
    const calls = (d.payplusUpdate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => c[0])).toEqual(['pp-1', 'pp-2']);
    expect(calls[0][1]).toMatchObject({ number: '477186582', amount: '319.00', vat_percentage: '18', subcategory_id: '2404', subcategory_uuid: EQ });
    expect(calls[1][1]).toMatchObject({ number: '26288941', amount: '142.97', currency_code: 'ILS', subcategory_id: '2402', subcategory_uuid: SW });
  });
  it('no types list: nothing is changed and the screen is told', async () => {
    const d = deps({ sentInvoices: vi.fn(async () => [{ id: 'a', status: 'sent', payplus_uuid: 'pp-1', doc_number: '1' }]) });
    expect((await expenseHandler({ action: 'sync_types' }, d, 'u1')).body).toEqual({ ok: true, updated: 0, failed: 0, types: 0 });
    expect(d.payplusList).not.toHaveBeenCalled();
    expect(d.payplusUpdate).not.toHaveBeenCalled();
  });
});

describe('L-22 (Owner 2026-10-28, "שמירת מזהי סוגי ההוצאה של פיי פלוס בהגדרות הכלי"): the type ids saved with the tool', () => {
  const SW = '0a14899e-db7d-4c1c-9cc8-0d27b5e09c20';
  it('a type keeps its PayPlus id; a malformed id is refused', () => {
    expect(settingsPatch({ expenseTypes: [{ id: 2402, name: 'תוכנה', uuid: ` ${SW.toUpperCase()} ` }, { id: 2403, name: 'טלפון' }], defaultSubcategoryId: 2402 }, 'T'))
      .toEqual({ expense_types: [{ id: 2402, name: 'תוכנה', uuid: SW }, { id: 2403, name: 'טלפון' }], default_subcategory_id: 2402, updated_at: 'T' });
    expect(settingsPatch({ expenseTypes: [{ id: 2402, name: 'תוכנה', uuid: 'not-an-id' }], defaultSubcategoryId: 2402 }, 'T')).toBeNull();
  });
  it('PayPlus gives no list: the saved id is used for the update and for a new expense; a refusal is reported in PayPlus words', async () => {
    const d = deps({
      settings: async () => ({ expense_types: [{ id: 2402, name: 'תוכנה', uuid: SW }], default_subcategory_id: 2402 }),
      payplusSubcategories: vi.fn(async () => ({})),
      sentInvoices: vi.fn(async () => [{ id: 'a', status: 'sent', payplus_uuid: 'pp-1', supplier_name: 'X', email_subject: null, doc_number: '1', doc_date: '2026-08-01', amount: 10, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, subcategory_id: 2402 },
        { id: 'b', status: 'sent', payplus_uuid: 'pp-2', supplier_name: 'Y', email_subject: null, doc_number: '2', doc_date: '2026-08-01', amount: 20, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, subcategory_id: 2402 }]),
      payplusList: vi.fn(async () => [{ uuid: 'pp-1', number: '1', subcategory: {} }, { uuid: 'pp-2', number: '2', subcategory: {} }]),
      payplusUpdate: vi.fn(async (uuid: string) => { if (uuid === 'pp-2') throw new Error('PayPlus 422: subcategory_uuid is invalid'); }),
    });
    expect((await expenseHandler({ action: 'sync_types' }, d, 'u1')).body).toEqual({ ok: true, updated: 1, failed: 1, types: 1, error: 'PayPlus 422: subcategory_uuid is invalid' });
    expect((d.payplusUpdate as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ subcategory_uuid: SW });
    const id = '77777777-7777-7777-7777-777777777777';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Z', email_subject: null, doc_number: '3', doc_date: '2026-08-01', amount: 5, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, file_path: null, subcategory_id: 2402 };
    await expenseHandler({ action: 'send', ids: [id] }, d, 'u1');
    expect((d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ subcategory_uuid: SW });
  });
  it('the PayPlus list itself failing is reported to the screen', async () => {
    const d = deps({
      settings: async () => ({ expense_types: [{ id: 2402, name: 'תוכנה', uuid: SW }], default_subcategory_id: 2402 }),
      sentInvoices: vi.fn(async () => [{ id: 'a', status: 'sent', payplus_uuid: 'pp-1', doc_number: '1' }]),
      payplusList: vi.fn(async () => { throw new Error('PayPlus list 403'); }),
    });
    expect(await expenseHandler({ action: 'sync_types' }, d, 'u1')).toEqual({ status: 502, body: { ok: false, code: 'payplus_failed', error: 'PayPlus list 403' } });
  });
});
