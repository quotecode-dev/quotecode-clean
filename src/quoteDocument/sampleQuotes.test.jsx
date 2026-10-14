import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicQuote from '../pages/PublicQuote';
import PublicQuoteEn from '../pages/PublicQuoteEn';
import { calculateQuoteFinancials } from '../utils/regionConfig';
import { formatWholeMoney } from '../utils/money';
import {
  buildSampleQuote,
  buildSampleItems,
  computeLineTotal,
  parseSampleQuery,
  SAMPLE_DISCOUNT_PERCENT,
  SAMPLE_LONG_REPEAT,
} from './sampleQuotes';

vi.mock('../shared/supabase', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ error: null }), functions: { invoke: vi.fn() } },
}));

const cents = (n) => Math.round(Number(n) * 100);
const NOW = new Date('2026-10-04T09:00:00Z');

describe('Task 16 sample quotes - every amount is computed from the rows (save-path rules)', () => {
  for (const locale of ['he', 'en']) {
    for (const length of ['short', 'long']) {
      it(`${locale}/${length}: subtotal = sum of the persisted line totals; total = calculateQuoteFinancials of the same rows`, () => {
        const { quoteData } = buildSampleQuote({ locale, length, now: NOW });
        const { quote, items } = quoteData;
        expect(items).toHaveLength(length === 'long' ? 3 * SAMPLE_LONG_REPEAT : 3);
        for (const it of items) expect(cents(it.total_price)).toBe(cents(computeLineTotal(it)));
        const rowSumCents = items.reduce((s, it) => s + cents(it.total_price), 0);
        expect(cents(quote.subtotal)).toBe(rowSumCents);
        const fin = calculateQuoteFinancials({
          country: locale === 'he' ? 'Local' : 'International',
          clientType: 'business',
          items: items.map((it) => ({ quantity: it.calculated_quantity ?? it.quantity, unit_price: it.unit_price })),
          discount: SAMPLE_DISCOUNT_PERCENT,
        });
        expect(cents(quote.total)).toBe(cents(fin.total));
        expect(quote.discount).toBe(SAMPLE_DISCOUNT_PERCENT);
      });
    }
  }

  it('the refined package rows: 2 x 1,200 + 3.4 m2 x 450 + 1 x 850 = 4,780.00; the long variant is exactly six times that (28,680.00)', () => {
    const short = buildSampleQuote({ locale: 'he', length: 'short', now: NOW }).quoteData.quote;
    const long = buildSampleQuote({ locale: 'he', length: 'long', now: NOW }).quoteData.quote;
    expect(short.subtotal).toBe(4780);
    expect(long.subtotal).toBe(28680);
    expect(cents(long.subtotal)).toBe(cents(short.subtotal) * SAMPLE_LONG_REPEAT);
    // HE business: 10% discount, 18% VAT on the discounted net.
    expect(short.total).toBe(5076.36);
    expect(long.total).toBe(30458.16);
    // EN International: no VAT.
    expect(buildSampleQuote({ locale: 'en', length: 'short', now: NOW }).quoteData.quote.total).toBe(4302);
  });

  it('the area-priced row keeps the DB shape: integer quantity + decimal calculated_quantity + pricing_unit', () => {
    const worktop = buildSampleItems('he', 'short')[1];
    expect(worktop.quantity).toBe(1);
    expect(worktop.calculated_quantity).toBe(3.4);
    expect(worktop.pricing_unit).toBe('m2');
    expect(worktop.total_price).toBe(1530);
  });

  it('query parsing falls back safely', () => {
    expect(parseSampleQuery('?style=visual&length=long&detail=expanded&images=0')).toEqual({ style: 'visual', length: 'long', detail: 'expanded', images: false });
    expect(parseSampleQuery('?style=bogus')).toEqual({ style: 'classic', length: 'short', detail: 'compact', images: true });
  });

  it('images=0 => no media; a non-image style ignores media entirely', () => {
    expect(buildSampleQuote({ images: false }).presentation.media).toEqual([]);
    const media = buildSampleQuote({ style: 'modern' }).presentation.media;
    expect(media).toHaveLength(6);
    expect(media.filter((m) => m.itemKey)).toHaveLength(3);
    expect(media.filter((m) => m.itemKey).every((m) => m.role === 'item')).toBe(true);
  });

  it('HE and EN demos share the aluminum identity, logo and the same three real-photo media files', () => {
    const he = buildSampleQuote({ locale: 'he', style: 'visual' });
    const en = buildSampleQuote({ locale: 'en', style: 'visual' });
    expect(he.quoteData.business).toMatchObject({ business_name: 'ויסטארו', logo_url: expect.stringMatching(/vistaro-symbol\.png$/) });
    expect(en.quoteData.business).toMatchObject({ business_name: 'VISTARO', logo_url: expect.stringMatching(/vistaro-symbol\.png$/) });
    expect(he.quoteData.quote.subject).toContain('אלומיניום');
    expect(en.quoteData.quote.subject).toContain('aluminum');
    const files = (sample) => sample.presentation.media.filter((m) => !m.itemKey).map((m) => m.url.split('/').pop());
    expect(files(he)).toEqual(['aluminum-window.jpg', 'aluminum-installation.jpg', 'aluminum-door.jpg']);
    expect(files(en)).toEqual(files(he));
  });
});

describe('Task 16 sample quotes - displayed HE amounts obey IRON-ILS-001 (whole shekels, ".00")', () => {
  const amountsIn = (container) => (container.querySelector('.pq-card').textContent.match(/₪[\d,]+\.\d\d/g) || []);

  for (const length of ['short', 'long']) {
    it(`HE ${length}: every ₪ amount in the document ends in .00 and the totals equal the whole-shekel rounding of the computed values`, () => {
      const { quoteData, presentation } = buildSampleQuote({ locale: 'he', length, now: NOW });
      const { container } = render(<MemoryRouter><PublicQuote quoteData={quoteData} presentation={presentation} previewMode /></MemoryRouter>);
      const amounts = amountsIn(container);
      expect(amounts.length).toBeGreaterThan(0);
      for (const a of amounts) expect(a).toMatch(/\.00$/);
      const final = container.querySelector('.pq-total-final-amount').textContent;
      expect(final).toBe(`₪${formatWholeMoney(quoteData.quote.total)}`);
      expect(container.querySelector('.pq-card').textContent).toContain(`₪${formatWholeMoney(quoteData.quote.subtotal)}`);
    });
  }

  it('half-shekel rule: 12.50 -> ₪13.00, 12.49 -> ₪12.00 (unit and line amounts on the public document)', () => {
    const { quoteData } = buildSampleQuote({ locale: 'he', now: NOW });
    const items = [
      { description: 'Half up', quantity: 1, price: 12.5, unit_price: 12.5, total_price: 12.5 },
      { description: 'Half down', quantity: 1, price: 12.49, unit_price: 12.49, total_price: 12.49 },
    ];
    const data = { ...quoteData, items, quote: { ...quoteData.quote, subtotal: 24.99, discount: 0, total: 29.49 } };
    const { container } = render(<MemoryRouter><PublicQuote quoteData={data} previewMode /></MemoryRouter>);
    const up = [...container.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Half up'));
    const down = [...container.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Half down'));
    expect(up.textContent).toContain('₪13.00');
    expect(down.textContent).toContain('₪12.00');
    expect(container.querySelector('.pq-total-final-amount').textContent).toBe('₪29.00');
  });

  it('EN keeps cents (International never uses the whole-shekel formatter)', () => {
    const { quoteData, presentation } = buildSampleQuote({ locale: 'en', now: NOW });
    const { container } = render(<PublicQuoteEn quoteData={quoteData} presentation={presentation} previewMode />);
    expect(container.querySelector('.pq-total-final-amount').textContent).toBe('$4,302.00');
    expect(container.textContent).not.toContain('₪');
  });
});
