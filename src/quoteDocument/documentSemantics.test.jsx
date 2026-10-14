// IRON-PRINT-001 / IRON-NUMERIC-001 / IRON-ILS-001 / IRON-MARKET-003 / IRON-DATE-001 / IRON-LANDING-001 / IRON-DATA-001 -
// the QUOTATION DOCUMENT as this candidate ships it:
//   A. the synthetic sample quotation (src/quoteDocument/sampleQuotes.js) - built with the save path's own rules, and
//      rendered by the REAL public quote pages;
//   B/C. the item-image binding (quoteMediaModel) and the one media component the landing uses (QuoteItemThumb);
//   D/E/F. the landing quotation model + document renderer + style showcase (rendered on /he and /en in this release);
//   G. the public quote print / Direct-PDF document flow and its print / capture CSS contract.
// Real modules throughout. Isolated only: the PDF engine call (generateQuotePdf - its own suite covers it), window.print,
// and the network client. Nothing here claims a real printer / browser PDF proof (that is the Owner / browser evidence).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';
import { buildSampleItems, buildSampleMedia, buildSampleQuote, computeLineTotal, computeSampleFinancials, parseSampleQuery, SAMPLE_DISCOUNT_PERCENT, SAMPLE_LONG_REPEAT } from './sampleQuotes';
import { MEDIA_UNAVAILABLE_LABEL, mediaForItem, normalizeItemKey } from './quoteMediaModel';
import { QuoteItemThumb } from './QuoteMedia';
import { QUOTE_STYLE_IDS, STYLE_COPY } from './quoteStyles';
import { buildLandingQuoteModel } from '../components/landing/landingQuoteModel';
import LandingQuoteDocument from '../components/landing/LandingQuoteDocument';
import QuoteStyleShowcase from '../components/landing/QuoteStyleShowcase';
import { generateQuotePdf } from '../utils/generateQuotePdf';

vi.mock('../shared/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('../utils/generateQuotePdf', async (importOriginal) => ({ ...(await importOriginal()), generateQuotePdf: vi.fn() }));

const strip = (x) => (x || '').replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const NOW = new Date('2026-10-13T09:00:00.000Z');
const PUBLIC_QUOTE_KEYS = ['attn_name', 'attn_role', 'client_type', 'created_at', 'currency', 'discount', 'id', 'is_expired', 'is_owner_viewing', 'notes',
  'project_name', 'quote_number', 'signature', 'status', 'subject', 'subtotal', 'tax_rate', 'terms', 'total', 'valid_until', 'warranty'];

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('A. the sample quotation is built by the save path\'s own rules', () => {
  it('a line total is the ACTIVE quantity x unit price in cents (area rows use calculated_quantity)', () => {
    expect(computeLineTotal({ quantity: 2, unit_price: 1200 })).toBe(2400);
    expect(computeLineTotal({ quantity: 1, calculated_quantity: 3.4, pricing_unit: 'm2', unit_price: 450 })).toBe(1530);
    expect(computeLineTotal({ quantity: 3, unit_price: 0.335 })).toBe(1.01);
  });
  it('the short sample is three DB-shaped rows: price = unit_price, a persisted line total, an area row keeping integer quantity + calculated_quantity', () => {
    const items = buildSampleItems('he', 'short');
    expect(items.map((i) => [i.quantity, i.calculated_quantity, i.pricing_unit, i.price, i.total_price])).toEqual([[2, null, null, 1200, 2400], [1, 3.4, 'm2', 450, 1530], [1, null, null, 850, 850]]);
    for (const i of items) expect(Array.isArray(i.specification) && Array.isArray(i.measurements)).toBe(true);
  });
  it('the long sample repeats the three rows six times with unique numbered descriptions and recomputed totals', () => {
    const items = buildSampleItems('en', 'long');
    expect(items).toHaveLength(3 * SAMPLE_LONG_REPEAT);
    expect(new Set(items.map((i) => i.description)).size).toBe(items.length);
    expect(items[3].description).toBe('Steel-look aluminum window · 4');
    expect(items.reduce((s, i) => s + i.total_price, 0)).toBe(28680);
  });
  it('HE / Local business: subtotal 4,780, 10% discount 478, VAT 18% added on the net = total 5,076.36 (persisted with cents)', () => {
    const fin = computeSampleFinancials(buildSampleItems('he'), { country: 'Local', clientType: 'business', discount: SAMPLE_DISCOUNT_PERCENT });
    expect(fin).toEqual({ subtotal: 4780, discountAmount: 478, netAmount: 4302, taxRate: 0.18, taxAmount: 774.36, total: 5076.36 });
  });
  it('EN / International: no tax (rate 0), total = net 4,302 in USD', () => {
    const { quoteData } = buildSampleQuote({ locale: 'en', now: NOW });
    expect([quoteData.quote.currency, quoteData.quote.tax_rate, quoteData.quote.total]).toEqual(['USD', 0, 4302]);
  });
  it('the sample quote is shaped exactly like a get-public-quote response (no field the public endpoint would not send)', () => {
    const { quoteData } = buildSampleQuote({ now: NOW });
    for (const k of Object.keys(quoteData.quote)) expect(PUBLIC_QUOTE_KEYS, k).toContain(k);
    expect(Object.keys(quoteData).sort()).toEqual(['attachments', 'business', 'client', 'items', 'quote', 'sections']);
  });
  it('rendered by the REAL Hebrew public page, the sample shows whole-shekel amounts (5,076.36 -> ₪5,076.00)', () => {
    const { quoteData } = buildSampleQuote({ now: NOW });
    const { container } = render(<MemoryRouter><PublicQuote quoteData={quoteData} /></MemoryRouter>);
    expect(strip(container.querySelector('.pq-total-final-amount').textContent)).toBe('₪5,076.00');
    for (const m of container.querySelectorAll('.pf-money')) expect(strip(m.textContent)).toMatch(/^₪[\d,]+\.00$/);
  });
  it('rendered by the REAL English public page, the sample keeps cents in USD and never shows ₪', () => {
    const { quoteData } = buildSampleQuote({ locale: 'en', now: NOW });
    const { container } = render(<MemoryRouter><PublicQuoteEn quoteData={quoteData} /></MemoryRouter>);
    expect(strip(container.querySelector('.pq-total-final-amount').textContent)).toBe('$4,302.00');
    expect(container.textContent).not.toContain('₪');
  });
  it('dates are date-only values: issued "today" and valid for 27 more days (never a shifted timestamp)', () => {
    const { quote } = buildSampleQuote({ now: NOW }).quoteData;
    expect([quote.created_at, quote.valid_until]).toEqual(['2026-10-13', '2026-11-09']);
  });
  it('query parsing: unknown values fall back (classic / short / compact / images on); images=0 removes media', () => {
    expect(parseSampleQuery('?style=gold&length=xl&detail=all')).toEqual({ style: 'classic', length: 'short', detail: 'compact', images: true });
    expect(parseSampleQuery('?style=visual&length=long&detail=expanded&images=0')).toEqual({ style: 'visual', length: 'long', detail: 'expanded', images: false });
    expect(buildSampleQuote({ images: false, now: NOW }).presentation.media).toEqual([]);
    expect(buildSampleQuote({ style: 'bogus', now: NOW }).style).toBe('classic');
  });
});

describe('B. item image binding (quoteMediaModel)', () => {
  it('an item key is the trimmed, whitespace-collapsed, lower-cased description; empty / non-text has no key', () => {
    expect(normalizeItemKey('  Steel-look   Aluminum\tWindow ')).toBe('steel-look aluminum window');
    for (const v of ['', '   ', null, undefined, 42, {}]) expect(normalizeItemKey(v)).toBeNull();
  });
  it('a row binds to the media with the same key, preferring role "item" over a showcase role', () => {
    const media = [{ itemKey: 'door', role: 'support', url: 's' }, { itemKey: 'Door ', role: 'item', url: 'i' }];
    expect(mediaForItem(media, ' door').url).toBe('i');
  });
  it('any role with a matching key binds when there is no item image; no match / no media / no key bind nothing', () => {
    expect(mediaForItem([{ itemKey: 'door', role: 'hero', url: 'h' }], 'Door').url).toBe('h');
    expect(mediaForItem([{ itemKey: 'door', role: 'item', url: 'i' }], 'window')).toBeNull();
    expect(mediaForItem(null, 'door')).toBeNull();
    expect(mediaForItem([{ itemKey: 'door', role: 'item' }], '  ')).toBeNull();
  });
  it('in the sample, every item image binds to exactly its own row; showcase images bind to no row', () => {
    for (const locale of ['he', 'en']) {
      const media = buildSampleMedia(locale);
      const items = buildSampleItems(locale);
      expect(items.map((it) => mediaForItem(media, it.description)?.alt)).toEqual(media.filter((m) => m.role === 'item').map((m) => m.alt));
      for (const m of media.filter((x) => x.role !== 'item')) expect(m.itemKey).toBeNull();
    }
  });
});

describe('C. QuoteItemThumb (the media component the landing document renders)', () => {
  it('a usable image renders as a 96x96 CORS-safe, no-referrer image with its alt text, in the document direction', () => {
    const { container } = render(<QuoteItemThumb image={{ url: '/x.jpg', alt: 'Window', role: 'item' }} isHebrew />);
    const img = container.querySelector('img');
    expect([img.getAttribute('alt'), img.getAttribute('width'), img.getAttribute('height')]).toEqual(['Window', '96', '96']);
    expect(img).toHaveAttribute('crossorigin', 'anonymous');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(container.querySelector('.pq-media-thumb')).toHaveAttribute('dir', 'rtl');
  });
  it('a missing image is an announced placeholder (role=img, "<alt> - unavailable"), never a broken <img>', () => {
    const { container } = render(<QuoteItemThumb image={{ url: '', alt: 'Door', role: 'item' }} isHebrew={false} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', `Door - ${MEDIA_UNAVAILABLE_LABEL.en}`);
    cleanup();
    render(<QuoteItemThumb image={{ url: '/x.jpg', missing: true }} isHebrew />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', MEDIA_UNAVAILABLE_LABEL.he);
  });
  it('an image that fails to load switches to the placeholder (no silent broken image in a sent document)', () => {
    const { container } = render(<QuoteItemThumb image={{ url: '/gone.jpg', alt: 'Seal' }} isHebrew />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('[data-pq-media-state="missing"]')).toHaveAttribute('aria-label', `Seal - ${MEDIA_UNAVAILABLE_LABEL.he}`);
  });
  it('no image object renders nothing at all', () => {
    expect(render(<QuoteItemThumb image={null} isHebrew />).container.innerHTML).toBe('');
  });
});

describe('D. the landing quotation model (the numbers the landing shows)', () => {
  const he = buildLandingQuoteModel('he');
  const en = buildLandingQuoteModel('en');
  it('HE: whole-shekel totals; VAT shown as whole total minus whole net, so the lines add up exactly', () => {
    expect(he.totals).toEqual({ subtotal: '₪4,780.00', discount: '−₪478.00', tax: '₪774.00', total: '₪5,076.00' });
    expect(he.raw.subtotal - he.raw.discount + he.raw.tax).toBe(he.raw.total);
  });
  it('EN: cents in USD and no tax line at all (International rate 0)', () => {
    expect(en.totals).toEqual({ subtotal: '$4,780.00', discount: '−$478.00', tax: null, total: '$4,302.00' });
  });
  it('HE rows: quantity as counted (2 / 3.4 / 1) and every unit / line amount in whole shekels', () => {
    expect(he.rows.map((r) => [r.qty, r.unit, r.amount])).toEqual([['2', '₪1,200.00', '₪2,400.00'], ['3.4', '₪450.00', '₪1,530.00'], ['1', '₪850.00', '₪850.00']]);
  });
  it('EN rows: the same quantities with USD amounts', () => {
    expect(en.rows.map((r) => [r.qty, r.unit, r.amount])).toEqual([['2', '$1,200.00', '$2,400.00'], ['3.4', '$450.00', '$1,530.00'], ['1', '$850.00', '$850.00']]);
  });
  it('the landing never shows a number the sample quotation would not: same rows, same financial source', () => {
    const fin = computeSampleFinancials(buildSampleItems('en'), { country: 'International', clientType: 'business', discount: SAMPLE_DISCOUNT_PERCENT });
    expect(en.raw).toEqual({ subtotal: fin.subtotal, discount: fin.discountAmount, tax: fin.taxAmount, total: fin.total });
    expect(he.rows.map((r) => r.name)).toEqual(buildSampleItems('he').map((i) => i.description));
  });
  it('dates follow the market: HE DD/MM/YYYY, EN MM/DD/YYYY', () => {
    expect([he.date, he.valid]).toEqual(['04/10/2026', '31/10/2026']);
    expect([en.date, en.valid]).toEqual(['10/04/2026', '10/31/2026']);
  });
  it('direction and language: HE rtl/he, EN ltr/en; any other locale falls back to HE', () => {
    expect([he.dir, he.lang, en.dir, en.lang]).toEqual(['rtl', 'he', 'ltr', 'en']);
    expect(buildLandingQuoteModel('fr').lang).toBe('he');
  });
  it('the attention contact: fixture by default, none when switched off, a given synthetic contact otherwise (a nameless one is none)', () => {
    expect(he.contact).toEqual({ name: 'נועה לוי', role: null });
    expect(buildLandingQuoteModel('he', { contact: false }).contact).toBeNull();
    expect(buildLandingQuoteModel('en', { contact: { name: 'Sam Ray', role: 'PM' } }).contact).toEqual({ name: 'Sam Ray', role: 'PM' });
    expect(buildLandingQuoteModel('en', { contact: { role: 'PM' } }).contact).toBeNull();
  });
  it('each row carries its own bound item image; the showcase images are the three captioned non-item photos', () => {
    expect(en.rows.map((r) => r.image.alt)).toEqual(['Steel-look aluminum window', 'Glass and aluminum partition', 'Installation and final alignment']);
    expect(en.images).toHaveLength(3);
    for (const img of en.images) expect(img.caption).toBeTruthy();
  });
  it('synthetic personas only: every email / domain is a reserved example domain (IRON-DATA-001)', () => {
    const text = JSON.stringify([he, en, buildSampleQuote({ now: NOW }), buildSampleQuote({ locale: 'en', now: NOW })]);
    const emails = text.match(/[\w.+-]+@[\w.-]+/g);
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/@(example\.com|[\w-]+\.example)$/);
  });
});

describe('E. the landing quotation document (rendered)', () => {
  const doc = (props) => render(<LandingQuoteDocument {...props} />).container.querySelector('article');
  it('HE classic: an RTL Hebrew article titled "הצעת מחיר · <subject>"', () => {
    const a = doc({ locale: 'he' });
    expect([a.getAttribute('dir'), a.getAttribute('lang'), a.dataset.landingDoc]).toEqual(['rtl', 'he', 'classic']);
    expect(a.querySelector('.tl-doc-title')).toHaveTextContent('הצעת מחיר · עבודות אלומיניום למשרד');
  });
  it('EN classic: an LTR English article', () => {
    const a = doc({ locale: 'en' });
    expect([a.getAttribute('dir'), a.getAttribute('lang')]).toEqual(['ltr', 'en']);
    expect(a.querySelector('.tl-doc-title')).toHaveTextContent('Quotation · Office aluminum works');
  });
  it('quote number, date and validity are LTR-isolated values under their labels', () => {
    const a = doc({ locale: 'he' });
    const cells = [...a.querySelectorAll('.tl-meta-cell')].map((c) => [c.querySelector('small').textContent, c.querySelector('b').textContent, c.querySelector('b').getAttribute('dir')]);
    expect(cells).toEqual([['מס׳ הצעה', 'Q-1048', 'ltr'], ['תאריך', '04/10/2026', 'ltr'], ['בתוקף עד', '31/10/2026', 'ltr']]);
  });
  it('the issuer: logo named by the business, phone bidi-isolated as LTR', () => {
    const a = doc({ locale: 'he' });
    expect(a.querySelector('.tl-issuer-logo')).toHaveAttribute('alt', 'ויסטארו');
    expect(a.querySelector('.tl-issuer-phone bdi')).toHaveAttribute('dir', 'ltr');
  });
  it('recipient parties: the client block always; the attention block only when a contact exists', () => {
    const a = doc({ locale: 'en' });
    expect(a.querySelector('[data-role="client"]')).toHaveTextContent('ToNorthline Workspaces Ltd.18 Harbor Way, Portland');
    expect(a.querySelector('[data-role="contact"]')).toHaveTextContent('AttnNora Lane');
    cleanup();
    expect(doc({ locale: 'en', contact: false }).querySelector('[data-role="contact"]')).toBeNull();
  });
  it('the item table: four column headers in reading order, numeric headers and cells on the numeric axis, every number cell LTR', () => {
    const t = doc({ locale: 'he' }).querySelector('.tl-items');
    expect([...t.querySelectorAll('thead th')].map((th) => [th.textContent, th.getAttribute('scope')])).toEqual([['פריט ותיאור', 'col'], ['כמות', 'col'], ['מחיר יחידה', 'col'], ['סכום', 'col']]);
    for (const th of [...t.querySelectorAll('thead th')].slice(1)) expect(th).toHaveClass('tl-num-axis');
    for (const tr of t.querySelectorAll('tbody tr')) for (const td of [...tr.children].slice(1)) expect(td).toHaveAttribute('dir', 'ltr');
  });
  it('an aligned amount is announced in full (aria-label) while its integer / fraction parts sit on the decimal axis', () => {
    const t = doc({ locale: 'he' }).querySelector('.tl-items');
    const cell = t.querySelectorAll('tbody tr')[0].children[3].querySelector('.tl-num-value');
    expect(cell).toHaveAttribute('aria-label', '₪2,400.00');
    expect([cell.querySelector('.tl-num-integer').textContent, cell.querySelector('.tl-num-fraction').textContent]).toEqual(['₪2,400', '.00']);
  });
  it('an integer quantity keeps the axis with a hidden placeholder fraction, but is announced as exactly "2"', () => {
    const qty = doc({ locale: 'he' }).querySelector('.tl-items tbody tr').children[1].querySelector('.tl-num-value');
    expect(qty).toHaveAttribute('aria-label', '2');
    expect(qty.querySelector('.tl-num-fraction')).toHaveClass('tl-num-fraction--placeholder');
    expect(qty.querySelector('.tl-num-fraction')).toHaveAttribute('aria-hidden', 'true');
  });
  it('the discount keeps its minus sign inside the aligned amount (−₪478 | .00)', () => {
    const rows = [...doc({ locale: 'he' }).querySelectorAll('.tl-total-row')];
    const disc = rows[1].querySelector('.tl-num-value');
    expect(disc).toHaveAttribute('aria-label', '−₪478.00');
    expect(disc.querySelector('.tl-num-integer').textContent).toBe('−₪478');
  });
  it('HE totals: subtotal, discount, VAT, total (final row last); EN: no tax row', () => {
    const he = [...doc({ locale: 'he' }).querySelectorAll('.tl-total-row')].map((r) => [r.querySelector('span').textContent, r.querySelector('.tl-num-value').getAttribute('aria-label')]);
    expect(he).toEqual([['סכום ביניים', '₪4,780.00'], ['הנחה (10%)', '−₪478.00'], ['מע״מ (18%)', '₪774.00'], ['סה״כ לתשלום', '₪5,076.00']]);
    cleanup();
    const en = doc({ locale: 'en' });
    expect([...en.querySelectorAll('.tl-total-row')].map((r) => r.querySelector('span').textContent)).toEqual(['Subtotal', 'Discount (10%)', 'Total']);
    expect(en.querySelector('.tl-total-row:last-child')).toHaveClass('tl-final');
  });
  it('image support by style: Classic none; Modern a 3-photo rail + row thumbnails; Visual a hero + 2 side photos + row thumbnails', () => {
    const c = doc({ locale: 'en', style: 'classic' });
    expect([c.querySelectorAll('figure').length, c.querySelectorAll('.pq-media-thumb').length]).toEqual([0, 0]);
    cleanup();
    const m = doc({ locale: 'en', style: 'modern' });
    expect([m.querySelectorAll('.tl-rail figure').length, m.querySelectorAll('.pq-media-thumb').length]).toEqual([3, 3]);
    cleanup();
    const v = doc({ locale: 'en', style: 'visual' });
    expect([v.querySelectorAll('.tl-visual-hero figure').length, v.querySelectorAll('.tl-visual-side figure').length, v.querySelectorAll('.pq-media-thumb').length]).toEqual([1, 2, 3]);
  });
  it('Visual moves the quote number into the band and out of the meta; Classic / Modern keep it in the meta', () => {
    const v = doc({ locale: 'he', style: 'visual' });
    expect(v.querySelector('.tl-visual-number b')).toHaveTextContent('Q-1048');
    expect([...v.querySelectorAll('.tl-meta-cell small')].map((s) => s.textContent)).toEqual(['תאריך', 'בתוקף עד']);
    cleanup();
    expect(doc({ locale: 'he', style: 'modern' }).querySelector('.tl-visual-number')).toBeNull();
  });
  it('Expanded shows each row\'s specification line; Compact (default) shows the item names only', () => {
    expect(doc({ locale: 'en' }).querySelectorAll('.tl-item-detail')).toHaveLength(0);
    cleanup();
    const details = [...doc({ locale: 'en', expanded: true }).querySelectorAll('.tl-item-detail')].map((d) => d.textContent);
    expect(details[0]).toBe('Made to measure, black profile and insulated glazing');
  });
  it('the PDF / print / call / WhatsApp actions are an illustration only: hidden from assistive tech and not interactive', () => {
    const a = doc({ locale: 'he' });
    const actions = a.querySelector('.tl-doc-actions');
    expect(actions).toHaveAttribute('aria-hidden', 'true');
    expect(actions.querySelectorAll('a, button, [onclick], [href]')).toHaveLength(0);
    expect(a.querySelector('.tl-header-call')).toHaveAttribute('aria-hidden', 'true');
    expect(a.querySelectorAll('a, button, input, canvas')).toHaveLength(0);
  });
  it('the approval area is a printed signature line, not a working signing form', () => {
    const appr = doc({ locale: 'en' }).querySelector('.tl-approval');
    expect(appr).toHaveTextContent('Quote approval');
    expect(appr.querySelector('.tl-sigline')).toHaveTextContent('Signature');
    expect(appr.querySelectorAll('input, canvas, button')).toHaveLength(0);
  });
  it('the document foot names the issuer and an LTR "number · page 1 / 1"', () => {
    const foot = doc({ locale: 'he' }).querySelector('.tl-doc-foot');
    expect(foot.children[0]).toHaveTextContent('ויסטארו');
    expect(foot.children[1]).toHaveAttribute('dir', 'ltr');
    expect(foot.children[1]).toHaveTextContent('Q-1048 · 1 / 1');
  });
  it('showcase photos are decorative (empty alt) with a visible caption and lazy loading; row images keep a real alt', () => {
    const m = doc({ locale: 'he', style: 'modern' });
    for (const fig of m.querySelectorAll('.tl-rail figure')) {
      expect(fig.querySelector('img')).toHaveAttribute('alt', '');
      expect(fig.querySelector('img')).toHaveAttribute('loading', 'lazy');
      expect(fig.querySelector('figcaption').textContent.length).toBeGreaterThan(0);
    }
    for (const img of m.querySelectorAll('.pq-media-thumb img')) expect(img.getAttribute('alt')).not.toBe('');
  });
  it('markets never mix in the document: no $ in the Hebrew document, no ₪ in the English one, and no HE amount has agorot', () => {
    for (const style of QUOTE_STYLE_IDS) {
      const h = doc({ locale: 'he', style });
      expect(h.textContent).not.toContain('$');
      for (const v of h.querySelectorAll('.tl-num-value')) expect(v.getAttribute('aria-label')).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
      cleanup();
      expect(doc({ locale: 'en', style }).textContent).not.toContain('₪');
      cleanup();
    }
  });
});

describe('F. the style showcase on the landing', () => {
  const copy = { eyebrow: 'e', title: 'Styles', intro: 'i', tablistLabel: 'Quote styles', availableBadge: 'Available', previewBadge: 'Preview', previewNote: 'Preview only', shared: 's', viewerLabel: 'Sample document' };
  const show = (locale) => render(<QuoteStyleShowcase locale={locale} copy={copy} />);
  it('one tab per style, in the canonical order, titled from the locale copy; Classic selected and the only tab in the tab order', () => {
    show('he');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.id)).toEqual(QUOTE_STYLE_IDS.map((id) => `tl-tab-${id}`));
    expect(tabs.map((t) => t.textContent.startsWith(STYLE_COPY.he[t.id.slice(7)].title))).toEqual([true, true, true]);
    expect(tabs.map((t) => [t.getAttribute('aria-selected'), t.tabIndex])).toEqual([['true', 0], ['false', -1], ['false', -1]]);
  });
  it('choosing a tab switches the panel, its label and the rendered document style', () => {
    const { container } = show('en');
    fireEvent.click(screen.getByRole('tab', { name: /Visual/ }));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tl-tab-visual');
    expect(container.querySelector('[data-landing-doc]').dataset.landingDoc).toBe('visual');
    expect(within(screen.getByRole('tabpanel')).getByRole('heading', { level: 3 })).toHaveTextContent(STYLE_COPY.en.visual.title);
  });
  it('arrow keys follow the reading direction: in RTL ArrowLeft goes forward, in LTR ArrowRight does; Home / End jump', () => {
    show('he');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { selected: true }).id).toBe('tl-tab-modern');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'End' });
    expect(screen.getByRole('tab', { selected: true }).id).toBe('tl-tab-visual');
    cleanup();
    show('en');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true }).id).toBe('tl-tab-modern');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'Home' });
    expect(screen.getByRole('tab', { selected: true }).id).toBe('tl-tab-classic');
  });
  it('only Classic is presented as available; Modern / Visual are labelled previews (no availability claim)', () => {
    const { container } = show('en');
    expect(screen.getAllByRole('tab').map((t) => t.querySelector('.tl-tab-badge').textContent)).toEqual(['Available', 'Preview', 'Preview']);
    fireEvent.click(screen.getByRole('tab', { name: /Modern/ }));
    expect(container.querySelector('.tl-showcase')).toHaveAttribute('data-style-availability', 'preview-only');
    expect(container.querySelector('.tl-style-status')).toHaveTextContent('Preview only');
    expect(container.querySelector('.tl-style-copy ul')).toHaveClass('is-preview');
  });
  it('the panel lists the active style\'s own benefits and renders the document in the showcase language', () => {
    const { container } = show('he');
    expect([...container.querySelectorAll('.tl-style-copy li')].map((li) => li.textContent)).toEqual(STYLE_COPY.he.classic.benefits);
    expect(container.querySelector('[data-landing-doc]')).toHaveAttribute('lang', 'he');
  });
});

describe('G. public quote print / Direct-PDF document flow', () => {
  const data = (quote = {}) => ({
    quote: { id: 'a29b1fbb-f2ca-427d-88b2-6198d138eb89', quote_number: 100701, status: 'sent', signature: null, tax_rate: 0.18, client_type: 'business',
      is_owner_viewing: false, subtotal: 1000, total: 1180, created_at: '2026-01-15T10:00:00.000Z', currency: 'ILS', ...quote },
    business: { business_name: 'Issuer Co' }, client: { company_name: 'Client Ltd' }, items: [{ description: 'A', quantity: 1, price: 1000, total_price: 1000 }], sections: [], attachments: [],
  });
  const he = (quote) => render(<MemoryRouter><PublicQuote quoteData={data(quote)} /></MemoryRouter>).container;
  const en = (quote) => render(<MemoryRouter><PublicQuoteEn quoteData={data({ currency: 'USD', tax_rate: 0, total: 1000, ...quote })} /></MemoryRouter>).container;
  beforeEach(() => {
    generateQuotePdf.mockReset();
    window.print = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('Print opens the output chooser (a modal dialog titled for printing) and Close dismisses it without printing', () => {
    he();
    fireEvent.click(screen.getByText('הדפס מסמך'));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveAttribute('aria-label', 'הדפסת מסמך');
    fireEvent.click(within(dlg).getByLabelText('סגור'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.print).not.toHaveBeenCalled();
  });
  it('choosing Compact sets the document print mode, closes the chooser and then prints once', async () => {
    const c = he();
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(c.querySelector('.pq-page')).toHaveAttribute('data-print-mode', 'compact');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });
  it('choosing Expanded prints the expanded document (EN)', async () => {
    const c = en();
    fireEvent.click(screen.getByText('Print Document'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Print document');
    fireEvent.click(screen.getByText('Expanded'));
    expect(c.querySelector('.pq-page')).toHaveAttribute('data-print-mode', 'expanded');
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });
  it('the browser "afterprint" event closes a chooser that is still open', () => {
    he();
    fireEvent.click(screen.getByText('הדפס מסמך'));
    fireEvent(window, new Event('afterprint'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('Direct PDF captures the document card (not the page chrome) under the capture class, named after the quote number', async () => {
    let finish; generateQuotePdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    const c = he();
    fireEvent.click(screen.getByText('הורד כ-PDF'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'הורדת PDF');
    fireEvent.click(screen.getByText('תמציתי'));
    expect(c.querySelector('.pq-page')).toHaveClass('pq-pdf-capturing');
    await waitFor(() => expect(generateQuotePdf).toHaveBeenCalledTimes(1));
    const { captureEl, filename } = generateQuotePdf.mock.calls[0][0];
    expect(captureEl).toBe(c.querySelector('.pq-card'));
    expect(filename).toBe('Tekango-Quote-A100701.pdf');
    expect(window.print).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(c.querySelector('.pq-page')).not.toHaveClass('pq-pdf-capturing'));
  });
  it('while the PDF is being produced the tile is disabled and says so; a second request is ignored', async () => {
    let finish; generateQuotePdf.mockImplementation(() => new Promise((r) => { finish = r; }));
    he();
    fireEvent.click(screen.getByText('הורד כ-PDF'));
    fireEvent.click(screen.getByText('תמציתי'));
    const tile = screen.getByText('מפיק PDF...').closest('button');
    expect(tile).toBeDisabled();
    fireEvent.click(tile);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(generateQuotePdf).toHaveBeenCalledTimes(1));
    finish();
    await waitFor(() => expect(screen.getByText('הורד כ-PDF').closest('button')).not.toBeDisabled());
    expect(generateQuotePdf).toHaveBeenCalledTimes(1);
  });
  it('the Direct PDF captures the detail level the reader chose: Expanded is applied to the document before capture', async () => {
    let modeAtCapture = null;
    const c = en();
    generateQuotePdf.mockImplementation(async () => { modeAtCapture = c.querySelector('.pq-page').getAttribute('data-print-mode'); });
    fireEvent.click(screen.getByText('Download PDF'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Download PDF');
    fireEvent.click(screen.getByText('Expanded'));
    await waitFor(() => expect(generateQuotePdf).toHaveBeenCalledTimes(1));
    expect(modeAtCapture).toBe('expanded');
  });
  it('a quote without a persisted number downloads as the generic file name (never an empty or unsafe name)', async () => {
    generateQuotePdf.mockResolvedValue();
    en({ quote_number: null });
    fireEvent.click(screen.getByText('Download PDF'));
    fireEvent.click(screen.getByText('Compact'));
    await waitFor(() => expect(generateQuotePdf).toHaveBeenCalledTimes(1));
    expect(generateQuotePdf.mock.calls[0][0].filename).toBe('Tekango-Quote.pdf');
  });
  it('a PDF failure is reported in the page language and leaves the document usable (capture class removed, tile enabled)', async () => {
    generateQuotePdf.mockRejectedValue(new Error('canvas tainted'));
    const c = he();
    fireEvent.click(screen.getByText('הורד כ-PDF'));
    fireEvent.click(screen.getByText('תמציתי'));
    expect(await screen.findByRole('status')).toHaveTextContent('לא הצלחנו להפיק את קובץ ה-PDF. נסו שוב בעוד רגע.');
    expect(c.querySelector('.pq-page')).not.toHaveClass('pq-pdf-capturing');
    expect(screen.getByText('הורד כ-PDF').closest('button')).not.toBeDisabled();
    expect(document.body.textContent).not.toContain('canvas tainted');
    cleanup();
    en();
    fireEvent.click(screen.getByText('Download PDF'));
    fireEvent.click(screen.getByText('Compact'));
    expect(await screen.findByRole('status')).toHaveTextContent("We couldn't generate the PDF file. Please try again.");
  });
  it('only the interactive parts are excluded from print / PDF: signing form and action tiles are no-print; totals, terms and the approval record are not', () => {
    const c = he({ terms: 'Net 30' });
    expect(screen.getByText('חתימת לקוח לאישור ההצעה:').closest('.no-print')).not.toBeNull();
    expect(c.querySelector('.pq-action-tiles')).toHaveClass('no-print');
    expect(c.querySelector('.pq-totals-box').closest('.no-print')).toBeNull();
    expect(screen.getByText('Net 30').closest('.no-print')).toBeNull();
    cleanup();
    he({ status: 'approved', signature: 'data:image/png;base64,AAAA' });
    expect(screen.getByText(/הצעת מחיר זו אושרה ונחתמה בהצלחה/).closest('.no-print')).toBeNull();
  });

  const pageCss = (file) => [...readFileSync(join(cwd(), 'src', 'pages', file), 'utf8').matchAll(/<style>\{`([\s\S]*?)`\}<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (css, head) => { const i = css.indexOf(head); let d = 0; let j = i; for (; j < css.length; j += 1) { if (css[j] === '{') d += 1; if (css[j] === '}') { d -= 1; if (d === 0) break; } } return css.slice(i, j + 1); };
  const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim().replace(/\s+/g, ' '), m[2].replace(/\s+/g, ' ').trim()]);

  it('print CSS: A4 with 12mm/10mm margins, the table head repeats on every page, rows / sections / recipient never split', () => {
    const p = block(pageCss('PublicQuote.jsx'), '@media print {');
    expect(p).toMatch(/@page \{\s*size: A4;\s*margin: 12mm 10mm;\s*\}/);
    expect(p).toMatch(/thead \{ display: table-header-group; \}/);
    expect(p).toMatch(/tr, \.pq-section, \.pq-unit-item, \.pq-recipient, \.pq-action-tile \{\s*break-inside: avoid;\s*page-break-inside: avoid;/);
    expect(p).toMatch(/\.pq-card, \.pq-card \* \{\s*-webkit-print-color-adjust: exact !important;\s*print-color-adjust: exact !important;/);
  });
  it('the interactive parts are hidden on paper by the ONE global print rule, and in the Direct PDF by the capture rule', () => {
    const global = readFileSync(join(cwd(), 'src', 'index.css'), 'utf8');
    expect(block(global, '@media print {')).toMatch(/\.no-print \{\s*display: none !important;\s*\}/);
    for (const f of ['PublicQuote.jsx', 'PublicQuoteEn.jsx']) expect(pageCss(f)).toMatch(/\.pq-pdf-capturing \.no-print \{\s*display: none !important;\s*\}/);
  });
  it('the Direct PDF looks like the printout: every visual print rule has a capture twin with the same declarations (HE and EN)', () => {
    for (const f of ['PublicQuote.jsx', 'PublicQuoteEn.jsx']) {
      const css = pageCss(f);
      const capture = new Map(rules(css).filter(([s]) => s.includes('.pq-pdf-capturing')).map(([s, d]) => [s.replace(/\.pq-pdf-capturing /g, ''), d]));
      const visual = rules(block(css, '@media print {').replace(/^@media print \{/, '')).filter(([s]) => s.startsWith('.pq-') && !/^\.pq-(page|card)\b/.test(s) && !/pq-section|pq-action-tile/.test(s));
      expect(visual.length).toBeGreaterThanOrEqual(10);
      // The ONE named difference: print additionally drops text-shadow on the header text; html2canvas capture keeps the
      // header colour rule only. Every other visual declaration must be identical.
      for (const [sel, decl] of visual) expect(capture.get(sel), `${f}: ${sel}`).toBe(decl.replace(/\s*text-shadow: none !important;/, ''));
      expect(visual.filter(([, d]) => /text-shadow/.test(d)).map(([s]) => s)).toEqual(['.pq-header-box, .pq-header-box *']);
    }
  });
  it('the Hebrew and English documents share one identical print contract', () => {
    expect(block(pageCss('PublicQuoteEn.jsx'), '@media print {')).toBe(block(pageCss('PublicQuote.jsx'), '@media print {'));
  });
});
