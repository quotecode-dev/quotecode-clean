// Codex release 1 (Owner 2026-10-29, typed: "מאשר שחרור 1 של קודקס עכשיו: שער ההפקה למחיר חסר בכל פלט חדש כולל שליחה חוזרת (החלטה 1)
// ונוסח המכסה המדויק (החלטה 2), כולל שינוי ב-L-09, L-13, L-14, L-15, L-17, L-24"); docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 1.
// The server rule itself is proven in the DB harness (scripts/db-test/tests/432_quote_missing_price_output_gate.sql).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from './pages/PublicQuote';
import PublicQuoteEn from './pages/PublicQuoteEn';
import { outputBlockedMessage } from './domain/subscriptions/outputAuthority';
import { CODE_STATUS, createQuoteOutputOrchestrator } from '../supabase/functions/subscription-authority/authorizeOutput';

vi.mock('./shared/supabase', () => ({ supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } } }));
afterEach(cleanup);
const src = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('the server: every channel, a re-send included', () => {
  it('the migration checks readiness right after the version is bound and BEFORE the answer for an already-output version', () => {
    const m = src('supabase/migrations/20261029200000_quote_missing_price_output_gate.sql');
    const gate = m.indexOf('v_ready := public.quote_document_price_readiness(v_doc);');
    expect(gate).toBeGreaterThan(m.indexOf("RETURN jsonb_build_object('ok', false, 'code', 'quote_changed', 'contentDigest', v_digest);"));
    expect(gate).toBeLessThan(m.indexOf("RETURN public.quote_output_final_response(v_final) || jsonb_build_object('alreadyFinalized', true);"));
    expect(gate).toBeLessThan(m.indexOf('INSERT INTO public.quote_output_attempts'));
    expect(m).toContain("REVOKE ALL ON FUNCTION public.quote_document_price_readiness(jsonb) FROM PUBLIC, anon, authenticated;");
  });
  it.each(['missing_price', 'price_state_unverified'])('%s reaches the client as its own code (409): no snapshot, no finalize', async (code) => {
    expect(CODE_STATUS[code]).toBe(409);
    const never = () => vi.fn(async () => { throw new Error('must not be called on a refusal'); });
    const sql = { prepare: vi.fn(async () => ({ ok: false, code, missingCount: 2 })), finalize: never(), abort: never(), descriptor: never(),
      attemptState: never(), listForReconcile: never(), markSnapshotDeleted: never() };
    const storage = { put: never(), get: never(), remove: never() };
    const o = createQuoteOutputOrchestrator({ sql, storage, presentation: { load: async () => ({ style: 'classic', styleVersion: 1, branding: null, media: [] }) },
      assets: { read: async () => null } });
    const Q = '10000000-0000-4000-8000-000000000432';
    for (const channel of ['send', 'public_share', 'final_pdf', 'final_print']) {
      const r = await o.output({ userId: '00000000-0000-4000-8000-000000000432' }, { quoteId: Q, channel, idempotencyKey: `out:${Q}:${channel}:${'a'.repeat(64)}`, expectedDigest: 'a'.repeat(64) });
      expect(r).toEqual({ status: 409, body: { ok: false, code } });
    }
    expect(sql.finalize).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });
});

describe('decision 2: the exact sentence', () => {
  it('HE / EN: nothing was sent and this action used no additional quote', () => {
    for (const code of ['missing_price', 'price_state_unverified']) {
      expect(outputBlockedMessage(code, true)).toBe('יש בהצעה פריטים ללא מחיר. השלימו את המחירים לפני שליחה, שיתוף או הפקה. לא נשלח דבר, ולא נוצלה הצעה נוספת בפעולה הזו.');
      expect(outputBlockedMessage(code, false)).toBe('Some quote items have no price. Complete their prices before sending, sharing or exporting. Nothing was sent, and this attempt did not use an additional quote.');
    }
  });
  it('the editor refuses leaving Draft with a line without a price BEFORE anything is saved (so the sentence is true)', () => {
    const d = src('src/pages/Dashboard.jsx');
    const guard = d.indexOf("saveBlock('QUOTE_INCOMPLETE_ITEMS', outputBlockedMessage('missing_price', isHebrew));");
    expect(guard).toBeGreaterThan(0);
    expect(d.slice(guard - 400, guard)).toContain("=== 'draft'\n        && String(quoteStatus || '').toLowerCase() !== 'draft' && missingPriceItems(items).length");
    // before the persistence (the orchestrator call) of the same save
    expect(guard).toBeLessThan(d.indexOf('const leaveDraftViaAuthority = '));
  });
});

const data = (quote = {}) => ({
  quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, status: 'sent', signature: null, tax_rate: 0.18, client_type: 'business',
    total: 1180, subtotal: 1000, discount: 0, currency: 'ILS', ...quote },
  business: { business_name: 'Test Business' }, client: { company_name: 'Test Client' },
  items: [{ description: 'ריצוף', quantity: 10, price: 100, total_price: 1000 }, { description: 'פינוי פסולת', quantity: 1, price: 0, total_price: 0, price_missing: true }],
  sections: [], attachments: [],
});

describe('the customer page: no product print / PDF of a quote with a line without a price (viewing stays)', () => {
  it.each([
    ['HE', PublicQuote, 'הדפסת המסמך', 'תמציתי', 'אפשר לצפות בהצעה הקיימת. להפקת מסמך מלא, בקשו מהעסק הצעה מעודכנת עם כל המחירים.'],
    ['EN', PublicQuoteEn, 'Print Document', 'Compact', 'You can view the existing quote. For a complete document, ask the business for an updated quote with every price.'],
  ])('%s', async (_l, Page, printLabel, compact, refusal) => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<MemoryRouter><Page quoteData={data()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(printLabel));
    fireEvent.click(screen.getByText(compact));
    await waitFor(() => expect(screen.getByText(refusal)).toBeTruthy());
    await new Promise((r) => setTimeout(r, 120));
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
  });
  it.each([['HE', PublicQuote, 'הדפסת המסמך', 'תמציתי'], ['EN', PublicQuoteEn, 'Print Document', 'Compact']])('%s: a complete quote still prints', async (_l, Page, printLabel, compact) => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const d = data(); d.items = [d.items[0]];
    render(<MemoryRouter><Page quoteData={d} /></MemoryRouter>);
    fireEvent.click(screen.getByText(printLabel));
    fireEvent.click(screen.getByText(compact));
    await waitFor(() => expect(print).toHaveBeenCalled());
    print.mockRestore();
  });
});
