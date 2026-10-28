// expense-invoices (Owner console 2026-10-22, typed L-22): only the Owner's two mailboxes, read-only; a signed short state (real HMAC); every
// email read once, a failed one retried and never lost; the VAT rule is code; nothing reaches PayPlus without approval, never twice, and a
// failed PayPlus search blocks the send; a failure stays on the row.
import { describe, it, expect, vi } from 'vitest';
import {
  expenseHandler, oauthCallback, scanBatch, parseMessage, validateExtraction, vatRule, gmailQuery, payplusFields, invoicePatch, settingsPatch,
  signState, verifyState, sameDocument, payplusRecords, callbackFailure, EXPENSE_MODEL, EXPENSE_FALLBACK_MODEL, type ExpenseDeps,
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
    expect(fields).toMatchObject({ number: 'INV-1001', doc_date: '2026-09-01', subcategory_id: '5554', amount: '35.00', currency_code: 'USD', amount_includes_vat: 'false' });
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
