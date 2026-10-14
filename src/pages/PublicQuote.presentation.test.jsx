// IRON-PUBLIC-001 / IRON-MARKET-001/003/004 / IRON-ILS-001 / IRON-DATE-001 - what the customer sees on the public quote link,
// rendered from the REAL pages (PublicQuote = HE/Local/ILS, PublicQuoteEn = EN/International) and the real route component
// (SmartPublicQuote). Only the network edge (supabase.functions.invoke / rpc) is isolated. Section disclosure, the table
// column contract, the owner-only signing gate and expiry already have their own suites and are not repeated here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicQuote from './PublicQuote';
import PublicQuoteEn from './PublicQuoteEn';
import SmartPublicQuote from '../components/SmartPublicQuote';
import { supabase } from '../shared/supabase';

vi.mock('../shared/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));

const QID = 'a29b1fbb-f2ca-427d-88b2-6198d138eb89';
const build = (over = {}) => ({
  quote: { id: QID, quote_number: 100701, status: 'sent', signature: null, tax_rate: 0.18, client_type: 'business', is_owner_viewing: false,
    subtotal: 1000, total: 1180, discount: 0, created_at: '2026-01-15T10:00:00.000Z', currency: 'ILS', ...over.quote },
  business: { business_name: 'Issuer Co', tax_id: '515151515', phone: '03-5551234', email: 'office@issuer.test', address: 'Tel Aviv', ...over.business },
  client: over.client === null ? null : { company_name: 'Client Ltd', email: 'buyer@client.test', phone: '+972501234567', address: 'Haifa', ...over.client },
  items: over.items ?? [{ description: 'Synthetic item', quantity: 1, price: 1000, total_price: 1000 }],
  sections: over.sections ?? [],
  attachments: over.attachments ?? [],
});
const he = (over) => render(<MemoryRouter><PublicQuote quoteData={build(over)} /></MemoryRouter>);
const en = (over = {}) => render(<MemoryRouter><PublicQuoteEn quoteData={build({ ...over, quote: { currency: 'USD', tax_rate: 0, total: 1000, ...over.quote } })} /></MemoryRouter>);
const strip = (x) => (x || '').replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const money = (c) => [...c.querySelectorAll('.pf-money')].map((e) => strip(e.textContent));
const totalsText = (c) => strip(c.querySelector('.pq-totals-box')?.textContent || c.querySelector('.pq-total-final-amount').closest('.pq-section, div').textContent);
const finalTotal = (c) => strip(c.querySelector('.pq-total-final-amount').textContent);

beforeEach(() => {
  supabase.rpc.mockReset(); supabase.rpc.mockResolvedValue({ error: null });
  supabase.functions.invoke.mockReset();
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('page identity: a private, non-indexed document in the quote market language', () => {
  it('HE page: lang=he, dir=rtl, Hebrew title, robots noindex/nofollow, and the page root is RTL', () => {
    const { container } = he();
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['he', 'rtl']);
    expect(document.title).toBe('TEKANGO - הצעת מחיר דיגיטלית');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(container.querySelector('.pq-page')).toHaveAttribute('dir', 'rtl');
  });
  it('EN page: lang=en, dir=ltr, English title, robots noindex/nofollow, and the page root is LTR', () => {
    const { container } = en();
    expect([document.documentElement.lang, document.documentElement.dir]).toEqual(['en', 'ltr']);
    expect(document.title).toBe('TEKANGO - Digital Price Quote');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    expect(container.querySelector('.pq-page')).toHaveAttribute('dir', 'ltr');
  });
  it('re-rendering never duplicates the robots tag and an existing permissive tag is overwritten to noindex', () => {
    const tag = document.createElement('meta'); tag.name = 'robots'; tag.content = 'index, follow'; document.head.appendChild(tag);
    he(); cleanup(); en();
    const tags = document.head.querySelectorAll('meta[name="robots"]');
    expect(tags).toHaveLength(1);
    expect(tags[0]).toHaveAttribute('content', 'noindex, nofollow');
  });
});

describe('header meta follows the quote market (number, issue date, validity)', () => {
  it('HE: quote number A100701 and the issue date in Local DD/MM/YYYY', () => {
    const { container } = he();
    expect(container.querySelector('.pq-header-number')).toHaveTextContent('A100701');
    expect(container.textContent).toMatch(/תאריך:\s*15\/01\/2026/);
  });
  it('EN: quote number A100701 and the issue date in International MM/DD/YYYY', () => {
    const { container } = en();
    expect(container.querySelector('.pq-header-number')).toHaveTextContent('A100701');
    expect(container.textContent).toMatch(/Date:\s*01\/15\/2026/);
  });
  it('the valid-until line uses the same market date order, and is absent when no validity date is stored', () => {
    const a = he({ quote: { valid_until: '2099-03-04' } }).container;
    expect(a.textContent).toMatch(/בתוקף עד:\s*04\/03\/2099/);
    cleanup();
    const b = en({ quote: { valid_until: '2099-03-04' } }).container;
    expect(b.textContent).toMatch(/Valid( until)?:\s*03\/04\/2099/);
    cleanup();
    expect(he().container.querySelector('.pq-header-valid')).toBeNull();
  });
  it('a quote without a persisted number shows the short id fallback, never an empty number', () => {
    const { container } = he({ quote: { quote_number: null } });
    expect(container.querySelector('.pq-header-number')).toHaveTextContent('#a29b1fbb');
  });
  it('the issuer letterhead shows the business details on both pages', () => {
    for (const mount of [he, en]) {
      const { container } = mount();
      for (const v of ['Issuer Co', '515151515', 'office@issuer.test']) expect(container.textContent).toContain(v);
      cleanup();
    }
  });
});

describe('recipient block', () => {
  it('HE: "לכבוד:" with the client company, greeting, LTR email, phone shown as a local Israeli number, address', () => {
    const { container } = he();
    const box = container.querySelector('.pq-recipient');
    expect(box).toHaveTextContent('לכבוד:');
    expect(box.querySelector('.pq-recipient-name')).toHaveTextContent('Client Ltd');
    expect(box).toHaveTextContent('שלום, להלן הצעת המחיר שהוכנה עבורך בקפידה:');
    const details = [...box.querySelectorAll('.pq-recipient-detail')];
    expect(details[0]).toHaveTextContent('buyer@client.test');
    expect(details[0]).toHaveStyle({ direction: 'ltr' });
    expect(details[1]).toHaveTextContent('050-1234567');
    expect(box).toHaveTextContent('Haifa');
  });
  it('EN: "To:" with the company, the English greeting, and the phone exactly as stored (no Israeli rewriting)', () => {
    const { container } = en({ client: { phone: '+1 415 555 0100' } });
    const box = container.querySelector('.pq-recipient');
    expect(box).toHaveTextContent('To:');
    expect(box).toHaveTextContent('Hello, please find the price quote prepared for you below:');
    expect(box).toHaveTextContent('+1 415 555 0100');
  });
  it('a quote with no client record still addresses the reader (HE "לקוח נכבד", EN "Valued Client")', () => {
    expect(he({ client: null }).container.querySelector('.pq-recipient-name')).toHaveTextContent('לקוח נכבד');
    cleanup();
    expect(en({ client: null }).container.querySelector('.pq-recipient-name')).toHaveTextContent('Valued Client');
  });
  it('the attention block appears only when a contact person is stored, with the role under the name', () => {
    expect(he().container.querySelectorAll('.pq-recipient')).toHaveLength(1);
    cleanup();
    const { container } = he({ quote: { attn_name: 'Dana Levi', attn_role: 'Procurement' } });
    const attn = container.querySelectorAll('.pq-recipient')[1];
    expect(attn).toHaveTextContent('לידי:');
    expect(attn.querySelector('.pq-recipient-name')).toHaveTextContent('Dana Levi');
    expect(attn).toHaveTextContent('Procurement');
    cleanup();
    expect(en({ quote: { attn_name: 'Dana Levi' } }).container.querySelectorAll('.pq-recipient')[1]).toHaveTextContent('Attn:');
  });
  it('the quote subject is presented as the subject line on both pages', () => {
    expect(he({ quote: { subject: 'חלונות לבית' } }).container.textContent).toMatch(/נושא ההצעה:\s*חלונות לבית/);
    cleanup();
    expect(en({ quote: { subject: 'Windows' } }).container.textContent).toMatch(/Subject:\s*Windows/);
  });
});

describe('HE / Local / ILS totals: whole shekels ".00", VAT by client type', () => {
  it('business client: subtotal, VAT added on top, and the total - all whole shekels', () => {
    const { container } = he();
    expect(totalsText(container)).toContain('סיכוםביניים:₪1,000.00');
    expect(totalsText(container)).toContain('מע"מ(18%):₪180.00');
    expect(finalTotal(container)).toBe('₪1,180.00');
  });
  it('awkward stored values still display whole shekels with ".00", and net + VAT equals the shown total exactly', () => {
    const { container } = he({ quote: { subtotal: 1040.4, total: 1227.67, client_type: 'private' } });
    for (const m of money(container)) expect(m).toMatch(/^₪-?[\d,]+\.00$/);
    const nums = [...container.querySelectorAll('.pq-totals-box .pf-money')].map((e) => Number(strip(e.textContent).replace(/[₪,]/g, '')));
    const [net, vat, total] = nums.slice(-3);
    expect(net + vat).toBe(total);
    expect(total).toBe(1228);
  });
  it('private client: no subtotal row; the VAT is extracted from the price (amount before VAT + VAT)', () => {
    const { container } = he({ quote: { client_type: 'private', subtotal: 1180, total: 1180 } });
    const t = totalsText(container);
    expect(t).not.toContain('סיכוםביניים');
    expect(t).toContain('סכוםלפנימע"מ:₪1,000.00');
    expect(t).toContain('מע"מ(18%):₪180.00');
    expect(finalTotal(container)).toBe('₪1,180.00');
  });
  it('a stored discount shows its percent and the discount amount in whole shekels, marked as a deduction', () => {
    const { container } = he({ quote: { discount: 10, subtotal: 1000, total: 1062 } });
    const row = container.querySelector('.pf-money.pq-discount-negative');
    expect(container.textContent).toContain('הנחה (10%):');
    expect(strip(row.textContent)).toBe('₪100.00');
  });
  it('an ambiguous client type never invents a VAT line', () => {
    const { container } = he({ quote: { client_type: null } });
    expect(totalsText(container)).not.toContain('מע"מ');
    expect(finalTotal(container)).toBe('₪1,180.00');
  });
  it('when no total is stored, the page computes it from the stored subtotal with the persisted VAT rate', () => {
    const { container } = he({ quote: { total: null, subtotal: 1000 } });
    expect(finalTotal(container)).toBe('₪1,180.00');
  });
  it('every amount on the HE page carries ₪ and no International symbol', () => {
    const { container } = he();
    for (const m of money(container)) expect(m.startsWith('₪')).toBe(true);
    expect(container.textContent).not.toMatch(/[$€£]\d/);
  });
});

describe('EN / International totals: cents kept, persisted currency, no VAT line', () => {
  it('USD keeps cents: $1,227.20 total and subtotal, and no VAT row', () => {
    const { container } = en({ quote: { subtotal: 1227.2, total: 1227.2 } });
    expect(finalTotal(container)).toBe('$1,227.20');
    expect(container.textContent).toContain('Subtotal:');
    expect(container.textContent).not.toMatch(/VAT/);
    expect(container.textContent).not.toContain('₪');
  });
  it.each([['EUR', '€'], ['GBP', '£']])('a historical %s quote keeps its own symbol on every amount', (cur, sym) => {
    const { container } = en({ quote: { currency: cur, subtotal: 50.5, total: 50.5 } });
    for (const m of money(container)) expect(m.startsWith(sym)).toBe(true);
    expect(finalTotal(container)).toBe(`${sym}50.50`);
  });
  it('a quote without a stored currency uses the issuer currency; anything outside USD/EUR/GBP never shows as ₪ here', () => {
    expect(finalTotal(en({ quote: { currency: null }, business: { currency: 'GBP' } }).container)).toBe('£1,000.00');
    cleanup();
    expect(finalTotal(en({ quote: { currency: 'JPY' } }).container)).toBe('$1,000.00');
  });
  it('the discount row shows the percent and the stored subtotal-to-total difference', () => {
    const { container } = en({ quote: { discount: 10, subtotal: 200, total: 180 } });
    expect(container.textContent).toContain('Discount (10%):');
    expect(strip(container.querySelector('.pq-discount-negative .pf-money').textContent)).toBe('$20.00');
  });
  it('when no total is stored the subtotal is the total (never 0)', () => {
    expect(finalTotal(en({ quote: { total: 0, subtotal: 75.25 } }).container)).toBe('$75.25');
  });
});

describe('terms, warranty, notes and attachments', () => {
  it('HE: terms / warranty / notes appear with their labels and keep the author\'s line breaks; absent when empty', () => {
    const { container } = he({ quote: { terms: 'שורה 1\nשורה 2', warranty: '12 חודשים', notes: 'הערה' } });
    for (const label of ['תקנון ותנאים:', 'אחריות:', 'הערות נוספות:']) expect(container.textContent).toContain(label);
    const terms = [...container.querySelectorAll('div')].find((d) => d.textContent === 'שורה 1\nשורה 2');
    expect(terms).toHaveStyle({ whiteSpace: 'pre-wrap' });
    cleanup();
    const bare = he().container.textContent;
    for (const label of ['תקנון ותנאים:', 'אחריות:', 'הערות נוספות:']) expect(bare).not.toContain(label);
  });
  it('EN: Terms & Conditions / Warranty / Additional Notes', () => {
    const { container } = en({ quote: { terms: 'Net 30', warranty: '1 year', notes: 'Thanks' } });
    for (const label of ['Terms & Conditions:', 'Warranty:', 'Additional Notes:']) expect(container.textContent).toContain(label);
  });
  it('HE attachments open in a new tab without opener access; an unnamed file gets a numbered label', () => {
    he({ attachments: [{ file_name: 'plan.pdf', url: 'https://signed.test/a' }, { file_name: '', url: 'https://signed.test/b' }] });
    const a = screen.getByText(/plan\.pdf/).closest('a');
    expect(a).toHaveAttribute('href', 'https://signed.test/a');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/קובץ מצורף #2/)).toBeInTheDocument();
  });
  it('no attachments is stated explicitly on both pages (never an empty box)', () => {
    expect(he().container.textContent).toContain('אין קובץ מצורף להצעה זו');
    cleanup();
    expect(en().container.textContent).toContain('No attachment included with this quote.');
  });
  it('EN attachments use the English fallback label', () => {
    en({ attachments: [{ file_name: null, url: 'https://signed.test/x' }] });
    expect(screen.getByText(/Attachment #1/).closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('contact tiles (the reader contacts the ISSUER)', () => {
  it('HE: every call control (header CTA + action tile) dials the same issuer number, and the CTA label never carries the number', () => {
    he({ business: { phone: '050-7654321' } });
    const calls = screen.getAllByText('חייג/י אליי').map((e) => e.closest('a'));
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const a of calls) {
      expect(a).toHaveAttribute('href', 'tel:0507654321');
      expect(a.textContent).not.toMatch(/\d/);
    }
  });
  it('HE: the WhatsApp tile opens wa.me in international format with a message naming the quote number', () => {
    he({ business: { phone: '050-7654321' } });
    const wa = screen.getByText('וואטסאפ').closest('a');
    const url = new URL(wa.getAttribute('href'));
    expect(url.host + url.pathname).toBe('wa.me/972507654321');
    expect(url.searchParams.get('text')).toBe('שלום, יש לי שאלה לגבי הצעת המחיר מספר A100701.');
    expect(wa).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('HE: a stored +972 / 00972 number reaches the same WhatsApp number', () => {
    he({ business: { phone: '+972-50-765-4321' } });
    expect(new URL(screen.getByText('וואטסאפ').closest('a').getAttribute('href')).pathname).toBe('/972507654321');
    cleanup();
    he({ business: { phone: '00972507654321' } });
    expect(new URL(screen.getByText('וואטסאפ').closest('a').getAttribute('href')).pathname).toBe('/972507654321');
  });
  it('without an issuer phone there is no call / WhatsApp tile; PDF and print remain', () => {
    const { container } = he({ business: { phone: '' } });
    expect(screen.queryByText('חייג/י אליי')).toBeNull();
    expect(screen.queryByText('וואטסאפ')).toBeNull();
    expect(container.querySelector('.pq-action-tiles')).toHaveClass('pq-action-tiles-two');
    expect(screen.getByText('הורד כ-PDF')).toBeInTheDocument();
    expect(screen.getByText('הדפס מסמך')).toBeInTheDocument();
  });
  it('EN: international numbers are used as stored (no +972 rewriting) and the English message names the quote', () => {
    en({ business: { phone: '+1 (415) 555-0100' } });
    for (const label of ['Call Me', 'Call me']) for (const e of screen.getAllByText(label)) expect(e.closest('a')).toHaveAttribute('href', 'tel:+14155550100');
    const url = new URL(screen.getByText('WhatsApp').closest('a').getAttribute('href'));
    expect(url.pathname).toBe('/14155550100');
    expect(url.searchParams.get('text')).toBe('Hi, I have a question about quote number A100701.');
  });
  it('HE: the TEKANGO credit in the footer is an LTR-isolated brand that leads to the Hebrew site', () => {
    const { container } = he();
    const brand = [...container.querySelectorAll('span')].find((s) => s.textContent.trim() === 'TEKANGO');
    expect(brand).toHaveAttribute('dir', 'ltr');
    expect(brand).toHaveStyle({ unicodeBidi: 'isolate' });
  });
});

describe('historical signature record', () => {
  it('a signed quote whose stored signature is not an image shows the textual confirmation (never a broken image)', () => {
    he({ quote: { status: 'approved', signature: 'signed-legacy-token' } });
    expect(screen.getByText('חתימה דיגיטלית התקבלה בהצלחה')).toBeInTheDocument();
    expect(screen.queryByAltText('Client Signature')).toBeNull();
  });
  it('a signed quote loaded later shows the stored image under "חתימה דיגיטלית:" / "Digital Signature:"', () => {
    const png = 'data:image/png;base64,AAAA';
    he({ quote: { status: 'approved', signature: png } });
    expect(screen.getByText('חתימה דיגיטלית:')).toBeInTheDocument();
    expect(screen.getByAltText('Client Signature')).toHaveAttribute('src', png);
    cleanup();
    en({ quote: { status: 'approved', signature: png } });
    expect(screen.getByText('Digital Signature:')).toBeInTheDocument();
  });
});

describe('SmartPublicQuote: the public route picks the page from the quote\'s OWN persisted market data', () => {
  const route = (id = QID) => render(<MemoryRouter initialEntries={[`/q/${id}`]}><Routes><Route path="/q/:id" element={<SmartPublicQuote />} /></Routes></MemoryRouter>);
  it('shows a loading state, then asks get-public-quote for exactly the link id', async () => {
    let resolve; supabase.functions.invoke.mockReturnValue(new Promise((r) => { resolve = r; }));
    route();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(supabase.functions.invoke).toHaveBeenCalledWith('get-public-quote', { body: { quote_id: QID } });
    resolve({ data: build(), error: null });
    await screen.findByText('לכבוד:');
  });
  it('404 and any other failure show the same bilingual not-found page, with no technical detail', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 404 }, message: 'Quote not found' } });
    route();
    expect(await screen.findByText('Quote not found or expired.')).toBeInTheDocument();
    expect(screen.getByText('הצעת המחיר אינה נמצאת או שפג תוקפה.')).toHaveAttribute('dir', 'rtl');
    cleanup();
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 400 }, message: 'Unable to load quote' } });
    route();
    expect(await screen.findByText('Quote not found or expired.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Unable to load quote');
  });
  it('a response without a quote is treated as unavailable (never a half-rendered page)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { business: {} }, error: null });
    route();
    expect(await screen.findByText('Quote not found or expired.')).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('an ILS quote opens the Hebrew page and a 0%-tax USD quote the English page', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: build(), error: null });
    route();
    expect(await screen.findByText('לכבוד:')).toBeInTheDocument();
    cleanup();
    supabase.functions.invoke.mockResolvedValue({ data: build({ quote: { currency: 'USD', tax_rate: 0 } }), error: null });
    route();
    expect(await screen.findByText('To:')).toBeInTheDocument();
  });
  it('a historical ILS quote of an issuer that is now International still opens in ₪ (the quote\'s own currency wins)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: build({ business: { currency: 'USD' } }), error: null });
    const { container } = route();
    await screen.findByText('לכבוד:');
    expect(finalTotal(container)).toBe('₪1,180.00');
  });
  it('a successful load records one view for that quote; a failing view counter never breaks the page', async () => {
    supabase.rpc.mockRejectedValue(new Error('counter down'));
    supabase.functions.invoke.mockResolvedValue({ data: build(), error: null });
    route();
    await screen.findByText('לכבוד:');
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('public_increment_quote_view', { p_quote_id: QID }));
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(screen.getByText('לכבוד:')).toBeInTheDocument();
  });
  it('the owner opening their own link sees the same document with the advisory admin note instead of the signing form', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: build({ quote: { is_owner_viewing: true } }), error: null });
    const { container } = route();
    await screen.findByText(/תצוגת מנהל/);
    expect(finalTotal(container)).toBe('₪1,180.00');
    expect(container.querySelector('.pq-commercial-table')).not.toBeNull();
    fireEvent.click(screen.getByText('הדפס מסמך'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
