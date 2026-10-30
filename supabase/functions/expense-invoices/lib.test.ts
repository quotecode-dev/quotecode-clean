// expense-invoices (Owner console 2026-10-22, typed L-22): only the Owner's two mailboxes, read-only; a signed short state (real HMAC); every
// email read once, a failed one retried and never lost; the VAT rule is code; nothing reaches PayPlus without approval, never twice, and a
// failed PayPlus search blocks the send; a failure stays on the row.
import { describe, it, expect, vi } from 'vitest';
import {
  expenseHandler, oauthCallback, scanBatch, parseMessage, validateExtraction, vatRule, gmailQuery, payplusFields, invoicePatch, settingsPatch,
  signState, verifyState, sameDocument, documentMatch, findDocument, sameSupplier, searchAllPages, payplusPage, PayplusCreateError, createAnswerDefinite, payplusRecords, callbackFailure, boiRate, payplusReason, createExpenseAt, subcategoryUuids, EXPENSE_MODEL, EXPENSE_FALLBACK_MODEL, type ExpenseDeps,
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
    updateUnlessSent: vi.fn(async (id, p) => { if (!rows[id] || ['sent', 'sending', 'unknown'].includes(String(rows[id].status))) return false; rows[id] = { ...rows[id], ...p }; return true; }),
    claimForSend: vi.fn(async (id) => { if (!rows[id] || !['approved', 'send_failed'].includes(String(rows[id].status))) return null; rows[id].status = 'sending'; return { ...rows[id] }; }),
    finishSend: vi.fn(async (id, p) => { if (rows[id]?.status === 'sending') rows[id] = { ...rows[id], ...p }; }),
    resolveUnknown: vi.fn(async (id, p) => { if (rows[id]?.status !== 'unknown') return false; rows[id] = { ...rows[id], ...p }; return true; }),
    claimUnknown: vi.fn(async (id) => {
      if (rows[id]?.status !== 'unknown') return null;
      const since = String(rows[id].updated_at ?? new Date(NOW).toISOString());
      rows[id].status = 'sending';
      return { ...rows[id], unknown_since: since } as never;
    }),
    expireStaleSending: vi.fn(async () => 0),
    sameInvoiceElsewhere: vi.fn(async (row) => Object.values(rows).some((r) => r.id !== row.id && r.doc_number === row.doc_number
      && ['sending', 'sent', 'unknown'].includes(String(r.status)) && sameSupplier(r, row))),
    settings: async () => ({ expense_types: [{ id: 5554, name: 'תוכנה' }], default_subcategory_id: 5554 }),
    saveSettings: vi.fn(async () => {}),
    upload: vi.fn(async () => {}),
    signedUrl: async () => 'https://signed',
    download: async () => 'JVBERi0=',
    payplusSearch: vi.fn(async () => []),
    payplusCreate: vi.fn(async () => 'pp-uuid-1'),
    payplusSubcategories: vi.fn(async () => ({})),
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
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: 'INV-1001', docUID: 'existing-1', total_items_base_currency: 35, currency_code: 'USD', customer: { customer_name: 'Supabase Inc' } }]) });
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
    expect(sameDocument({ number: '1', total_items_base_currency: 1, customer: { customer_name: 'Supabase, Inc.' } }, { doc_number: '1', supplier_name: 'Supabase Inc', amount: 1, currency: 'ILS' })).toBe(true);
    // Codex N07: the same supplier with no amount on the record is not a certain match
    expect(sameDocument({ number: '1', customer: { customer_name: 'Supabase, Inc.' } }, { doc_number: '1', supplier_name: 'Supabase Inc', amount: 1 })).toBe(false);
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
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: 'X-7', docUID: 'existing-7', total_items_base_currency: 129.5, customer: { customer_name: 'Other' } }]) });
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

// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, ... L-22 ... לפי התוכנית לתיקון 22 ממצאי קודקס מ-28/10"): Codex F05 / F06
describe('Codex F05 / F06: never twice, never another supplier document', () => {
  const ILS_ROW = (o: P = {}) => ({ status: 'approved', supplier_name: 'Acme Ltd', supplier_vat_id: null, email_subject: null, doc_number: '1001', doc_date: '2026-09-01',
    amount: 100, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, file_path: null, ...o });
  const put = (d: ReturnType<typeof deps>, id: string, o: P = {}) => { d.rows[id] = { id, ...ILS_ROW(o) }; return id; };
  const A = '55555555-5555-4555-8555-555555555551';
  const B = '55555555-5555-4555-8555-555555555552';
  it('the same number and amount of ANOTHER supplier is never taken as ours - and never created blindly either', async () => {
    const d = deps({ payplusSearch: vi.fn(async () => [{ number: '1001', docUID: 'other-1', total_items_base_currency: 100, customer: { customer_name: 'Beta Corp' } }]) });
    put(d, A);
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'payplus_ambiguous' }]);
    // Codex N06: it waits in "Check in PayPlus" for the Owner's decision - never sendable again by itself
    expect(d.rows[A].status).toBe('unknown');
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it('Codex N07: an amount counts only in its own currency; insufficient identity is never "none"', () => {
    const usd = { doc_number: '7', supplier_name: 'Acme Ltd', amount: 35, currency: 'USD' };
    // the shekel amount sent against an ILS record = ours; the USD amount against an ILS record is a currency mix = not certain
    expect(documentMatch({ number: '7', total_items_base_currency: 128.1, currency_code: 'ILS', customer: { customer_name: 'Acme Ltd' } }, usd, 128.1)).toBe('match');
    expect(documentMatch({ number: '7', total_items_base_currency: 35, currency_code: 'ILS', customer: { customer_name: 'Acme Ltd' } }, usd, 128.1)).toBe('ambiguous');
    expect(documentMatch({ number: '7', total_items_base_currency: 35, currency_code: 'USD', customer: { customer_name: 'Acme Ltd' } }, usd, 128.1)).toBe('match');
    // no supplier identity: the same number is "none" only when the known amount differs from every amount of ours
    expect(documentMatch({ number: '7', total_items_base_currency: 35 }, usd, 128.1)).toBe('ambiguous');
    expect(documentMatch({ number: '7' }, usd, 128.1)).toBe('ambiguous');
    expect(documentMatch({ number: '7', total_items_base_currency: 999 }, usd, 128.1)).toBe('none');
    // another supplier's name with one of our amounts in any currency: not certain either way
    expect(documentMatch({ number: '7', total_items_base_currency: 35, customer: { customer_name: 'Beta Corp' } }, usd, 128.1)).toBe('ambiguous');
  });
  it('a part of a name is not the same supplier ("Meta" is not "Metatron Ltd")', () => {
    expect(documentMatch({ number: '1', total_items_base_currency: 5, customer: { customer_name: 'Metatron Ltd' } }, { doc_number: '1', supplier_name: 'Meta', amount: 9 })).toBe('none');
    expect(sameSupplier({ supplier_name: 'Meta' }, { supplier_name: 'Metatron Ltd' })).toBe(false);
  });
  it('tax ids decide over names; a record without a supplier is never a certain match', () => {
    expect(documentMatch({ number: '1', total_items_base_currency: 5, supplier_vat_id: '51-234567-8', customer: { customer_name: 'X' } }, { doc_number: '1', supplier_name: 'Y', supplier_vat_id: '512345678', amount: 5, currency: 'ILS' })).toBe('match');
    expect(documentMatch({ number: '1', total_items_base_currency: 5, supplier_vat_id: '511111111' }, { doc_number: '1', supplier_name: 'Y', supplier_vat_id: '512345678', amount: 5 })).toBe('none');
    expect(documentMatch({ number: '1', total_items_base_currency: 5 }, { doc_number: '1', supplier_name: 'Y', amount: 5 })).toBe('ambiguous');
    expect(findDocument([{ number: '1', total_items_base_currency: 5, customer: { customer_name: 'Y' } }, { number: '1', total_items_base_currency: 5, customer: { customer_name: 'Y' } }], { doc_number: '1', supplier_name: 'Y', amount: 5 }, 5)).toBe('ambiguous');
  });
  it('no answer from PayPlus after the create: unknown - never sent again automatically', async () => {
    const d = deps({ payplusCreate: vi.fn(async () => { throw new PayplusCreateError('PayPlus: The signal has been aborted', false); }) });
    put(d, A);
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'payplus_unknown' }]);
    expect(d.rows[A].status).toBe('unknown');
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'not_approved' }]);
    expect(d.payplusCreate).toHaveBeenCalledTimes(1);
    expect((await expenseHandler({ action: 'update', id: A, patch: { status: 'approved' } }, d, 'u1')).status).toBe(409);
  });
  it('a definite PayPlus refusal stays a plain failure that can be sent again', async () => {
    const d = deps({ payplusCreate: vi.fn(async () => { throw new PayplusCreateError('PayPlus 422: bad field', true); }) });
    put(d, A);
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'payplus_failed' }]);
    expect(d.rows[A].status).toBe('send_failed');
  });
  it('the answer classes: a 4xx (not 408) or a JSON refusal is definite; a time-out, 5xx, 408 or an unreadable 2xx is unknown', () => {
    expect(createAnswerDefinite(422, '{}')).toBe(true);
    expect(createAnswerDefinite(200, '{"status":"error"}')).toBe(true);
    expect(createAnswerDefinite(408, '')).toBe(false);
    expect(createAnswerDefinite(502, '')).toBe(false);
    expect(createAnswerDefinite(200, '<html>')).toBe(false);
  });
  it('created in PayPlus but not marked here: the row stays sending (it becomes unknown) - never sent again', async () => {
    const d = deps();
    d.finishSend = vi.fn(async () => { throw new Error('database'); });
    put(d, A);
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'unrecorded' }]);
    expect(d.rows[A].status).toBe('sending');
    expect(d.payplusCreate).toHaveBeenCalledTimes(1);
  });
  it('every send first turns a stuck "sending" (over 15 minutes) into unknown', async () => {
    const d = deps();
    put(d, A);
    await expenseHandler({ action: 'send', ids: [A] }, d, 'u1');
    expect(d.expireStaleSending).toHaveBeenCalledTimes(1);
    const cutoff = Date.parse((d.expireStaleSending as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(NOW - cutoff).toBeGreaterThanOrEqual(15 * 60000 - 1000);
  });
  it('the same invoice of the same supplier in another row is never sent twice', async () => {
    const d = deps();
    put(d, A, { status: 'sent', payplus_uuid: 'pp-1' });
    put(d, B, { supplier_name: 'ACME  ltd' });
    expect((await expenseHandler({ action: 'send', ids: [B] }, d, 'u1')).body.results).toEqual([{ id: B, ok: false, code: 'duplicate_local' }]);
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it('the search reads every page; a total not reached or a repeated page blocks the send', async () => {
    const rec = (i: number) => ({ number: '1001', n: i });
    const pages = (total: number, per: number[]) => { let k = 0; return vi.fn(async () => { const c = per[k++] ?? 0; return { items: Array.from({ length: c }, (_, i) => rec(k * 100 + i)), total }; }); };
    expect(await searchAllPages(pages(70, [50, 20]))).toHaveLength(70);
    await expect(searchAllPages(pages(120, [50, 20]))).rejects.toThrow('search_incomplete');
    const same = vi.fn(async () => ({ items: Array.from({ length: 50 }, () => rec(1)), total: null }));
    await expect(searchAllPages(same)).rejects.toThrow('search_incomplete');
    expect(await searchAllPages(async () => 'empty' as const)).toEqual([]);
    expect(payplusPage({ status: 'success', details: { numItems: 70, items: [rec(1)] } })).toEqual({ items: [rec(1)], total: 70 });
  });
  it('the match on page 2 counts: already in PayPlus, nothing created', async () => {
    const d = deps({ payplusSearch: vi.fn(async () => [...Array.from({ length: 50 }, (_, i) => ({ number: `1001-${i}` })), { number: '1001', docUID: 'p2', total_items_base_currency: 100, customer: { customer_name: 'Acme Ltd' } }]) });
    put(d, A);
    expect((await expenseHandler({ action: 'send', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: true, code: 'already_in_payplus' }]);
    expect(d.payplusCreate).not.toHaveBeenCalled();
  });
  it('"Check in PayPlus": found = sent; not found = stays unknown (never sendable again by itself); never a create', async () => {
    const old = new Date(NOW - 20 * 60000).toISOString();
    const fresh = new Date(NOW - 60000).toISOString();
    let d = deps({ payplusSearch: vi.fn(async () => [{ number: '1001', docUID: 'pp-found', total_items_base_currency: 100, customer: { customer_name: 'Acme Ltd' } }]) });
    put(d, A, { status: 'unknown', updated_at: fresh });
    expect((await expenseHandler({ action: 'reconcile', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: true, code: 'already_in_payplus' }]);
    expect(d.rows[A]).toMatchObject({ status: 'sent', payplus_uuid: 'pp-found' });
    d = deps();
    put(d, A, { status: 'unknown', updated_at: old });
    // Codex N05 (Owner 2026-10-28, decision 2): not found by the search is not proof - it stays unknown until the Owner decides
    expect((await expenseHandler({ action: 'reconcile', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'not_in_payplus' }]);
    expect(d.rows[A].status).toBe('unknown');
    d = deps();
    put(d, A, { status: 'unknown', updated_at: fresh });
    expect((await expenseHandler({ action: 'reconcile', ids: [A] }, d, 'u1')).body.results).toEqual([{ id: A, ok: false, code: 'not_in_payplus' }]);
    expect(d.rows[A]).toMatchObject({ status: 'unknown', updated_at: fresh });
    expect(d.payplusCreate).not.toHaveBeenCalled();
    expect((await expenseHandler({ action: 'reconcile', ids: [B] }, d, 'u1')).body.results).toEqual([{ id: B, ok: false, code: 'not_unknown' }]);
  });
});

// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01, L-09, L-11, L-14, L-15, L-17, L-22, L-23, L-25 לפי התוכנית לתיקון 17 ממצאי קודקס על בקשת
// מיזוג 113, כולל ארבע ההחלטות שהוצעו"), decision 2: the Owner decides an unknown expense - three buttons, nothing sent or searched
// Codex R07 (Owner 2026-10-29, L-22): a send that never finished is released on its own - no types, no other send, no PayPlus call
describe('Codex R07: a stuck send moves to "Check in PayPlus" by itself', () => {
  it('only the 15-minute rule of the server; nothing is created or searched', async () => {
    const d = deps();
    const r = await expenseHandler({ action: 'release_stuck' }, d, 'u1');
    expect(r).toMatchObject({ status: 200, body: { ok: true, moved: 0 } });
    expect(d.expireStaleSending).toHaveBeenCalledWith(new Date(Number(d.expireStaleSending.mock.calls[0][0] ? Date.parse(d.expireStaleSending.mock.calls[0][0] as string) : 0)).toISOString());
    expect(d.payplusCreate).not.toHaveBeenCalled();
    expect(d.payplusSearch).not.toHaveBeenCalled();
    const down = deps({ expireStaleSending: vi.fn(async () => { throw new Error('db'); }) });
    expect((await expenseHandler({ action: 'release_stuck' }, down, 'u1')).status).toBe(503);
  });
});

describe('Codex N06: the Owner decides an expense PayPlus may have', () => {
  const C = '66666666-6666-4666-8666-666666666661';
  const row = (o: P = {}) => ({ id: C, status: 'unknown', supplier_name: 'Acme Ltd', doc_number: '9', doc_date: '2026-09-01', amount: 10, currency: 'ILS', ...o });
  it('found = sent (marked by the Owner); duplicate = closed; not created = can be sent again; only an unknown row; never PayPlus', async () => {
    for (const [decision, status] of [['found', 'sent'], ['duplicate', 'rejected'], ['not_created', 'send_failed']] as const) {
      const d = deps();
      d.rows[C] = row();
      expect((await expenseHandler({ action: 'resolve', ids: [C], decision }, d, 'u1')).body.results).toEqual([{ id: C, ok: true }]);
      expect(d.rows[C].status).toBe(status);
      if (decision === 'found') expect(d.rows[C]).toMatchObject({ payplus_uuid: 'owner-verified', sent_at: expect.any(String) });
      expect(d.payplusCreate).not.toHaveBeenCalled();
      expect(d.payplusSearch).not.toHaveBeenCalled();
    }
    const d = deps();
    d.rows[C] = row({ status: 'sent' });
    expect((await expenseHandler({ action: 'resolve', ids: [C], decision: 'duplicate' }, d, 'u1')).body.results).toEqual([{ id: C, ok: false, code: 'not_unknown' }]);
    expect(d.rows[C].status).toBe('sent');
    expect((await expenseHandler({ action: 'resolve', ids: [C], decision: 'send' }, d, 'u1')).status).toBe(400);
    expect((await expenseHandler({ action: 'resolve', ids: ['x'], decision: 'found' }, d, 'u1')).status).toBe(400);
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
  it('L-22 (Owner 2026-10-28, "הסרת עדכון ההוצאות שנשלחו בפתיחת המסך"): there is no update of sent expenses any more', async () => {
    const d = deps({ payplusSubcategories: vi.fn(async () => ({ 2402: SW })) });
    expect(await expenseHandler({ action: 'sync_types' }, d, 'u1')).toEqual({ status: 400, body: { ok: false, code: 'invalid_action' } });
    expect(d.payplusCreate).not.toHaveBeenCalled();
    expect(d.payplusSubcategories).not.toHaveBeenCalled();
  });
});

describe('L-22 (Owner 2026-10-28, "שמירת מזהי סוגי ההוצאה של פיי פלוס בהגדרות הכלי"): the type ids saved with the tool', () => {
  const SW = '0a14899e-db7d-4c1c-9cc8-0d27b5e09c20';
  it('a type keeps its PayPlus id; a malformed id is refused', () => {
    expect(settingsPatch({ expenseTypes: [{ id: 2402, name: 'תוכנה', uuid: ` ${SW.toUpperCase()} ` }, { id: 2403, name: 'טלפון' }], defaultSubcategoryId: 2402 }, 'T'))
      .toEqual({ expense_types: [{ id: 2402, name: 'תוכנה', uuid: SW }, { id: 2403, name: 'טלפון' }], default_subcategory_id: 2402, updated_at: 'T' });
    expect(settingsPatch({ expenseTypes: [{ id: 2402, name: 'תוכנה', uuid: 'not-an-id' }], defaultSubcategoryId: 2402 }, 'T')).toBeNull();
  });
  it('PayPlus gives no list: the saved id is used for a new expense', async () => {
    const d = deps({
      settings: async () => ({ expense_types: [{ id: 2402, name: 'תוכנה', uuid: SW }], default_subcategory_id: 2402 }),
      payplusSubcategories: vi.fn(async () => ({})),
    });
    const id = '77777777-7777-7777-7777-777777777777';
    d.rows[id] = { id, status: 'approved', supplier_name: 'Z', email_subject: null, doc_number: '3', doc_date: '2026-08-01', amount: 5, currency: 'ILS', amount_includes_vat: false, vat_percentage: 0, file_path: null, subcategory_id: 2402 };
    expect((await expenseHandler({ action: 'send', ids: [id] }, d, 'u1')).body.results).toEqual([{ id, ok: true }]);
    expect((d.payplusCreate as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ subcategory_id: '2402', subcategory_uuid: SW });
  });
});
