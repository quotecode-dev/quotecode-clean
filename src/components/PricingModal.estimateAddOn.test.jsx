// Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22: אומדן המטבע המקומי בחלון המסלולים כולל את חכם פלוס"): with the SMART PACK box
// ticked, the GBP / EUR estimate is of the total that would be charged in USD (package + add-on), same rate and rounding; unticked, the
// estimate is exactly as before; Israel and USD accounts have no estimate at all.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';

vi.mock('../domain/subscriptions/localPriceEstimate', async (orig) => {
  const real = await orig();
  return { ...real, loadUsdRate: vi.fn(async () => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(Date.now() - 3600 * 1000).toISOString(), source: 'ExchangeRate-API' })) };
});
const { default: PricingModal } = await import('./PricingModal');

afterEach(cleanup);
const rate = () => ({ currency: 'GBP', usdToCurrency: 0.757, asOf: new Date(Date.now() - 3600 * 1000).toISOString(), source: 'ExchangeRate-API' });

describe('the local-currency estimate with SMART PACK', () => {
  it('model: $23 / $235 with the add-on -> about £17.41 / £177.90 (EN and HE); without it the note is unchanged', () => {
    const en = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
    expect(en.estimateNote).toMatch(/^Estimate in GBP only: about £13\.63 per month or £139\.29 per year/);
    expect(en.estimateNoteWithAddOn).toMatch(/^Estimate in GBP only, with SMART PACK: about £17\.41 per month or £177\.90 per year at the ExchangeRate-API rate of \d{4}-\d{2}-\d{2}\. Charged in USD\.$/);
    const he = pricingModalModel({ isHebrew: true, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: rate() });
    expect(he.estimateNoteWithAddOn).toMatch(/^הערכה ב-GBP בלבד, כולל חכם פלוס: כ-£17\.41 לחודש או כ-£177\.90 לשנה, לפי שער ExchangeRate-API מ-\d{4}-\d{2}-\d{2}\. החיוב בדולר ארה״ב\.$/);
  });
  it('model: no rate, a USD account or Israel -> no add-on estimate', () => {
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'GBP', estimateRate: null }).estimateNoteWithAddOn).toBeNull();
    expect(pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL', accountCurrency: 'USD', estimateRate: rate() }).estimateNoteWithAddOn).toBeNull();
    expect(pricingModalModel({ isHebrew: true, market: 'IL', accountCurrency: 'GBP', estimateRate: rate() }).estimateNoteWithAddOn).toBeNull();
  });
  // Owner console 2026-10-25 (typed L-22 + findings 1-13): purchasing is not open abroad - no pay button, so no SMART PACK box; the
  // estimate stays the package estimate (the model keeps the add-on estimate for when purchasing opens there)
  it('the window abroad (no pay button): no SMART PACK box, the package estimate only', async () => {
    const props = { onClose: () => {}, isHebrew: false, isLocalIsraeliBusiness: false, currency: 'GBP' };
    const { container } = render(<PricingModal isOpen {...props} />);
    const line = () => screen.getByTestId('plans-modal-estimate').textContent;
    await waitFor(() => expect(line()).toMatch(/^Estimate in GBP only: about £13\.63 per month/));
    expect(container.querySelector('input[data-addon-toggle]')).toBeNull();
    expect(fireEvent).toBeTypeOf('function');
  });
});
