// Owner console 2026-10-30 (typed: "מאשר שינוי ב-L-22: הצגת חשבוניות PDF בתוך המסך"): a PDF invoice opens inside the screen (the content
// policy allows a local blob: frame), an image stays an image, and any other type is only downloaded - never shown inside the admin page.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) } } }));
const { default: AdminExpenseInvoices } = await import('./AdminExpenseInvoices');

const inv = { id: 'a', mailbox: 'quotecodedev@gmail.com', emailFrom: 'Eleven Labs <invoice@stripe.test>', supplierName: 'Eleven Labs Inc.', supplierVatId: null,
  docNumber: '2858-9873-4221', docDate: '2026-10-29', amount: 3, currency: 'ILS', amountIncludesVat: true, vatPercentage: 0, category: 'software_cloud',
  confidence: 'high', reason: 'קבלה', hasFile: true, status: 'pending' };
const state = { data: { ok: true, connections: [], invoices: [inv], settings: { expenseTypes: [], defaultSubcategoryId: null } }, error: null };

beforeEach(() => {
  rpc.mockReset(); invoke.mockReset();
  rpc.mockResolvedValue(state);
  invoke.mockResolvedValue({ data: { ok: true, url: 'https://x.supabase.co/storage/v1/object/sign/expense/a.pdf?token=t' }, error: null });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:local/1');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const open = async (type, he = true) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type }) })));
  const r = render(<AdminExpenseInvoices isHebrew={he} />);
  fireEvent.click(await r.findByTestId('expense-file-a'));
  await r.findByTestId('expense-file-preview');
  return r;
};

describe('the invoice file inside the screen', () => {
  it.each([true, false])('isHebrew=%s: a PDF opens in a frame inside the screen', async (he) => {
    const { getByTestId, queryByTestId } = await open('application/pdf', he);
    expect(getByTestId('expense-file-frame').getAttribute('src')).toBe('blob:local/1');
    expect(getByTestId('expense-file-frame').getAttribute('title')).toBe(he ? 'החשבונית' : 'The invoice');
    expect(queryByTestId('expense-file-download')).toBeNull();
  });
  it('an image stays an image', async () => {
    const { getByTestId, queryByTestId } = await open('image/png');
    expect(getByTestId('expense-file-preview').querySelector('img').getAttribute('src')).toBe('blob:local/1');
    expect(queryByTestId('expense-file-frame')).toBeNull();
  });
  it.each([true, false])('isHebrew=%s: any other type is only downloaded, never framed', async (he) => {
    const { getByTestId, queryByTestId } = await open('text/html', he);
    expect(queryByTestId('expense-file-frame')).toBeNull();
    expect(getByTestId('expense-file-download').textContent).toBe(he ? 'הורדת הקובץ' : 'Download the file');
    expect(getByTestId('expense-file-download').hasAttribute('download')).toBe(true);
  });
  it('the content policy allows a local blob: frame and nothing wider (no plugin objects, Turnstile kept)', () => {
    const headers = JSON.parse(readFileSync(join(cwd(), 'vercel.json'), 'utf8')).headers.find((h) => h.source === '/(.*)').headers;
    const csp = headers.find((h) => h.key === 'Content-Security-Policy').value;
    expect(csp).toContain('frame-src blob: https://challenges.cloudflare.com;');
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/frame-src[^;]*\*/);
  });
});
