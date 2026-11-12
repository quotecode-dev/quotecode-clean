// Owner console 2026-11-10 (typed: "מאשר תיקון פערי עברית-אנגלית 1-14 ותיקון ההחלטות לפי שוק במקום שפה, כולל שינוי ב-L-01, ... L-29,
// שחרור עד הלייב" + "כן" to the English credit line): what the Hebrew customer page does, the English one does too; the app copy says the
// same in both languages; VAT, support mailbox and admin dates follow the market, never the UI language.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import PublicQuoteEn from './pages/PublicQuoteEn';
import { buildSampleQuote } from './quoteDocument/sampleQuotes';

vi.mock('./shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));

const NOW = new Date('2026-10-04T09:00:00Z');
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });
afterEach(cleanup);

function enData({ quote = {}, items } = {}) {
  const { quoteData } = buildSampleQuote({ locale: 'en', now: NOW });
  return { ...quoteData, quote: { ...quoteData.quote, ...quote }, items: items === undefined ? quoteData.items : items };
}
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('English customer page = Hebrew customer page', () => {
  it('a quote with no items states its amount in the table', () => {
    const { container } = render(<PublicQuoteEn quoteData={enData({ items: [], quote: { total: 250 } })} previewMode />);
    expect(container.querySelector('tbody').textContent).toMatch(/General quote for a total of\s*\$250\.00/);
  });
  it('a missing quantity counts as 1 (never blank / NaN) and an item without a description shows its name', () => {
    const { container } = render(<PublicQuoteEn quoteData={enData({ items: [{ name: 'Gate repair', description: '', price: 40, quantity: null }] })} previewMode />);
    const row = container.querySelector('tbody tr');
    expect(row.textContent).toContain('Gate repair');
    expect(row.querySelector('.pq-td-qty').textContent).toContain('1');
    expect(row.querySelector('.pq-td-total').textContent).toContain('40.00');
    expect(row.textContent).not.toContain('NaN');
  });
  it('with no stored total the discount still comes off', () => {
    const items = [{ description: 'Work', price: 100, quantity: 2 }];
    const { container } = render(<PublicQuoteEn quoteData={enData({ items, quote: { total: 0, subtotal: 200, discount: 10 } })} previewMode />);
    expect(container.textContent).toMatch(/Discount \(10%\):\s*\$20\.00/);
  });
  it('the credit line at the bottom, as in Hebrew', () => {
    const { container } = render(<PublicQuoteEn quoteData={enData()} previewMode />);
    expect(container.querySelector('.pq-doc-foot').textContent).toMatch(/^This document was produced with TEKANGO/);
  });
  it('a signed quote whose stored signature is not an image still says it was received', () => {
    render(<PublicQuoteEn quoteData={enData({ quote: { status: 'approved', signature: 'signed-by-legacy-flow' } })} previewMode />);
    expect(screen.getByText('The digital signature was received')).toBeTruthy();
  });
  it('the loading screen speaks the page language', () => {
    expect(src('./components/SmartPublicQuote.jsx')).toMatch(/\{en \? 'Loading\.\.\.' : 'טוען את הצעת המחיר\.\.\.'\}/);
  });
});

describe('the app copy says the same in both languages', () => {
  const dash = src('./pages/Dashboard.jsx');
  it.each([
    ["'לא ניתן לשלוח את המייל: כתובת המייל של הלקוח חסרה או אינה תקינה.' : 'The email cannot be sent: the client email address is missing or invalid.'"],
    ["'לא ניתן למחוק לקוח שיש לו הצעות מחיר במערכת.' : 'A client who has quotes in the system cannot be deleted.'"],
    ["'כתובת המייל אינה תקינה.' : 'The email address is invalid.'"],
    ["trialDaysLeft === 1 ? 'נותר יום אחד'"],
  ])('Dashboard: %s', (pair) => expect(dash).toContain(pair));
  it('no emoji left in an English email message', () => expect(dash).not.toContain('❌ Invalid'));
  it('the editor, list, settings and AI dialog pairs', () => {
    expect(src('./components/QuoteForm.jsx')).toContain("'סוג לקוח (חובה)' : 'Client type (required)'");
    expect(src('./components/QuotesTab.jsx')).toContain("'The email address the quote was sent to does not exist'");
    expect(src('./components/SettingsTab.jsx')).toContain("'You can upload a file of up to 500 KB, in SVG, JPG or PNG format.'");
    expect(src('./components/AiQuoteDraftDialog.jsx')).toContain("generate: 'Create a draft with AI'");
  });
  it('landing: the Hebrew SMART PACK line shows the total; the English FAQ names the buttons', () => {
    expect(src('./pages/LandingLocal.jsx')).toContain("= <bdi dir=\"ltr\">{ilsWithSmartPack('month')}</bdi> לחודש");
    expect(src('./pages/LandingGlobal.jsx')).toContain('press "New quote" and choose "From a saved template"');
  });
});

describe('market, never the UI language', () => {
  it('the editor VAT rows follow the Israeli-business market only', () => {
    const qf = src('./components/QuoteForm.jsx');
    expect(qf).not.toContain('isLocalIsraeliBusiness && isHebrew');
    expect(qf).toContain("isHebrew ? 'סכום לפני מע״מ:' : 'Before VAT:'");
  });
  it('the quote list before-VAT amount and tooltip follow the market', () => {
    const qt = src('./components/QuotesTab.jsx');
    expect(qt).not.toContain('isBizClient && isHebrew');
    expect(qt).not.toContain('isLocalIsraeliBusiness && isHebrew');
  });
  it('the support mailbox in the bell follows the market', () => {
    expect(src('./components/NotificationCenter.jsx')).toMatch(/const supportEmail = \(isLocalIsraeliBusiness === true/);
  });
  it('admin dates never follow the admin language', () => {
    for (const f of ['AdminOverview', 'AdminSystemActivity', 'AdminUserDetails', 'AdminUsersView', 'AdminUsersTab']) {
      expect(src(`./components/${f}.jsx`)).not.toContain("isHebrew ? 'Local' : 'International'");
    }
  });
});
