// Owner console 2026-10-20 (L-22, typed: "מאשר שינוי ב-L-22: תיבת הוספה של חכם פלוס במסך המסלולים בתוך המערכת ..."): the in-app package card
// offers the unticked SMART PACK box; ticked, the shown price is the package plus the add-on for the chosen period (IL / INTERNATIONAL).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import PackageOfferCards from './PackageOfferCards';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';

afterEach(cleanup);
const price = (card) => within(card).getAllByText((_, el) => el?.hasAttribute?.('data-price'))[0].textContent;
// Owner console 2026-10-25 (typed L-22 + findings 1-13): the box exists only next to a pay button
const pay = { enabled: true, busy: false, error: null, onPay: () => {} };

describe('in-app plans view: the SMART PACK add-on box', () => {
  it('IL (HE): unticked by default; ticked -> ₪40.00 monthly and ₪408.00 yearly with the breakdown; the Free card has none', () => {
    render(<PackageOfferCards model={pricingModalModel({ isHebrew: true, market: 'IL' })} isHebrew purchase={pay} />);
    const card = screen.getByTestId('plans-modal-card-all_inclusive');
    const box = card.querySelector('[data-addon-toggle]');
    expect(box.checked).toBe(false);
    expect(price(card)).toBe('₪30.00');
    expect(within(card).getByText((_, el) => el?.hasAttribute?.('data-addon-choice')).textContent).toContain('הוספת חכם פלוס');
    fireEvent.click(box);
    expect(price(card)).toBe('₪40.00');
    expect(card.querySelector('[data-addon-line="month"]').textContent).toBe('כולל חכם פלוס: ₪30.00 + ₪10.00');
    fireEvent.click(card.querySelector('[data-period="year"]'));
    expect(price(card)).toBe('₪408.00');
    expect(screen.getByTestId('plans-modal-card-free').querySelector('[data-addon-toggle]')).toBeNull();
    // what SMART PACK is, right under the box (Owner 2026-10-20)
    expect(card.querySelector('[data-addon-summary]').textContent).toContain('צ׳אט קולי');
  });
  it('INTERNATIONAL (EN): $23.00 monthly and $235.00 yearly when ticked', () => {
    render(<PackageOfferCards model={pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL' })} isHebrew={false} purchase={pay} />);
    const card = screen.getByTestId('plans-modal-card-all_inclusive');
    expect(price(card)).toBe('$18.00');
    fireEvent.click(card.querySelector('[data-addon-toggle]'));
    expect(price(card)).toBe('$23.00');
    fireEvent.click(card.querySelector('[data-period="year"]'));
    expect(price(card)).toBe('$235.00');
    expect(card.querySelector('[data-addon-choice]').textContent).toContain('Add SMART PACK');
  });
  it('HE and EN: no pay button (an active subscriber, the Free-10 window, Settings, a closed market) = no box, no ₪40 / $23, no summary', () => {
    for (const [isHebrew, market, base] of [[true, 'IL', '₪30.00'], [false, 'IL', '₪30.00'], [false, 'INTERNATIONAL', '$18.00'], [true, 'INTERNATIONAL', '$18.00']]) {
      render(<PackageOfferCards model={pricingModalModel({ isHebrew, market })} isHebrew={isHebrew} currentPlanId="all_inclusive" />);
      const card = screen.getByTestId('plans-modal-card-all_inclusive');
      expect(card.querySelector('[data-addon-toggle]')).toBeNull();
      expect(card.querySelector('[data-addon-summary]')).toBeNull();
      expect(price(card)).toBe(base);
      cleanup();
    }
  });
  it('the card of an annual subscriber opens on the annual period (HE and EN)', () => {
    for (const isHebrew of [true, false]) {
      render(<PackageOfferCards model={pricingModalModel({ isHebrew, market: 'IL' })} isHebrew={isHebrew} currentPlanId="all_inclusive" currentPeriod="year" />);
      expect(price(screen.getByTestId('plans-modal-card-all_inclusive'))).toBe('₪306.00');
      cleanup();
    }
  });
});
