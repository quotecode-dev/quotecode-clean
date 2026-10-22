// Owner console 2026-10-22 (typed: "מאשר שינוי ב-L-22: כרטיס החינם בחלון המסלולים מוצג רק כשתקופת החינם פעילה"): the free card is shown
// only while the account's free period is running; an account that ended or used it (or pays) sees only the paid package card.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PricingModal from './PricingModal';
import { freePeriodActive } from '../domain/subscriptions/subscriptionStatus';

afterEach(() => cleanup());

const summary = (free10) => ({ state: 'ready', free10 });

describe('freePeriodActive', () => {
  it('a running trial is an active free period', () => expect(freePeriodActive({ key: 'trial' }, null)).toBe(true));
  it('Free-10 with quotes left inside the 7 days is active', () => {
    expect(freePeriodActive({ key: 'free10', remaining: 4 }, summary({ remaining: 4, periodEnded: false }))).toBe(true);
  });
  it('Free-10 with no quotes left is not active', () => {
    expect(freePeriodActive({ key: 'free10', remaining: 0 }, summary({ remaining: 0, periodEnded: false }))).toBe(false);
  });
  it('Free-10 whose 7 days ended is not active, even with quotes left', () => {
    expect(freePeriodActive({ key: 'free10', remaining: 6 }, summary({ remaining: 6, periodEnded: true }))).toBe(false);
  });
  it.each(['trial_ended', 'paid_monthly', 'paid_annual', 'paid_unverified', 'lifetime', 'free10_inactive'])('%s is not active', (key) => {
    expect(freePeriodActive({ key }, null)).toBe(false);
  });
});

describe('PricingModal free card', () => {
  it.each([true, false])('isHebrew=%s: free period running - both cards', (he) => {
    const { queryByTestId } = render(<PricingModal isOpen onClose={() => {}} isHebrew={he} isLocalIsraeliBusiness={he} freePlanActive />);
    expect(queryByTestId('plans-modal-card-free')).not.toBeNull();
    expect(queryByTestId('plans-modal-card-all_inclusive')).not.toBeNull();
  });
  it.each([true, false])('isHebrew=%s: free period over - only the paid package card', (he) => {
    const { queryByTestId, container } = render(<PricingModal isOpen onClose={() => {}} isHebrew={he} isLocalIsraeliBusiness={he} freePlanActive={false} />);
    expect(queryByTestId('plans-modal-card-free')).toBeNull();
    expect(queryByTestId('plans-modal-card-all_inclusive')).not.toBeNull();
    expect(container.textContent).toMatch(he ? /30/ : /\$18/);
  });
});
