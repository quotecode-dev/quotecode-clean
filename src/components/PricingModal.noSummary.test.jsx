// Task 39 (Owner choice): the new plans window is also released where no account-summary service exists (LIVE). Without a summary prop
// it shows no plan line - never a permanent "Loading plan…"; with a summary (TEST) the line is unchanged. Prices / availability stay.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PricingModal from './PricingModal';
import { LOADING_SUMMARY } from '../domain/subscriptions/accountSummaryClient';

afterEach(() => cleanup());

describe('PricingModal without an account summary (LIVE)', () => {
  it.each([[true, 'IL'], [false, 'INTERNATIONAL']])('isHebrew=%s: no plan line, no "Loading plan"; the package, its prices and availability are shown', (he) => {
    const { queryByTestId, getByTestId, container } = render(<PricingModal isOpen onClose={() => {}} isHebrew={he} isLocalIsraeliBusiness={he} />);
    expect(queryByTestId('plans-modal-current')).toBeNull();
    expect(container.textContent).not.toMatch(/טוען מסלול|Loading plan/);
    expect(getByTestId('plans-modal-availability').textContent.length).toBeGreaterThan(10);
    expect(container.textContent).toMatch(he ? /30/ : /\$18/);
  });
  it('with a summary (TEST) the plan line is still shown, also while loading', () => {
    const { getByTestId } = render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={LOADING_SUMMARY} />);
    expect(getByTestId('plans-modal-current').textContent).toContain('טוען מסלול');
  });
});
