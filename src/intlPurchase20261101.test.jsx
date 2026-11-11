// Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, L-06, L-07, L-11, L-12, L-14, L-17, L-22"):
// an account abroad sees SMART PACK in its own currency (USD, the international date order) and is told to write to the international
// mailbox (decision e); the Israeli windows are unchanged.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import SmartPackAddOnOffer from './components/SmartPackAddOnOffer';
import SmartPackRemoval from './components/SmartPackRemoval';
import { checkoutErrorMessage, mailboxForCurrency, smartPackRemovalErrorMessage, PURCHASE_OPEN_MARKETS } from './domain/subscriptions/packageCheckout';

afterEach(cleanup);

describe('the markets and the mailbox', () => {
  it('both markets are open; USD = the international mailbox', () => {
    expect(PURCHASE_OPEN_MARKETS).toEqual(['IL', 'INTERNATIONAL']);
    expect(mailboxForCurrency('USD')).toBe('info@tekango.com');
    expect(mailboxForCurrency('ILS')).toBe('support@tekango.com');
    expect(checkoutErrorMessage('payment_update_required', false, 'info@tekango.com')).toMatch(/write to us: info@tekango\.com$/);
    expect(checkoutErrorMessage('payment_update_required', true)).toMatch(/support@tekango\.com$/);
    expect(smartPackRemovalErrorMessage('refused', false, 'info@tekango.com')).toMatch(/info@tekango\.com$/);
  });
});

describe('the SMART PACK add-on abroad', () => {
  it('EN: $ amounts in cents, the international date order, the USD page', async () => {
    const onLeave = vi.fn();
    const invoke = vi.fn(async (_fn, { body }) => ({ data: body.action === 'smart_pack_add_on_quote'
      ? { ok: true, currency: 'USD', amountMinor: 419, recurringMinor: 500, period: 'month', periodEnd: '2026-11-27T10:00:00.000Z' }
      : { ok: true, redirectUrl: 'https://payments.payplus.co.il/x' } }));
    render(<SmartPackAddOnOffer isHebrew={false} invoke={invoke} onLeave={onLeave} />);
    await waitFor(() => expect(screen.getByTestId('plans-smart-pack-add-on')).toBeInTheDocument());
    expect(screen.getByTestId('plans-smart-pack-add-on').querySelector('h3').textContent).toBe('Add SMART PACK to your plan? (+$5.00 a month)');
    expect(screen.getByTestId('plans-smart-pack-add-on-now').textContent).toBe('Pro-rated charge now until the end of your current billing month: $4.19 (until 27/11/2026)');
    expect(screen.getByTestId('plans-smart-pack-add-on-pay').textContent).toBe('Yes, add SMART PACK - $4.19');
    expect(screen.getByTestId('plans-smart-pack-add-on').textContent).not.toMatch(/₪/);
  });
  it('HE abroad: Hebrew words, $ only (never the shekel)', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true, currency: 'USD', amountMinor: 4250, recurringMinor: 5100, period: 'year', periodEnd: '2027-10-20T10:00:00.000Z' } }));
    render(<SmartPackAddOnOffer isHebrew invoke={invoke} onLeave={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('plans-smart-pack-add-on')).toBeInTheDocument());
    expect(screen.getByTestId('plans-smart-pack-add-on-then').textContent).toBe('מהחידוש הבא: $51.00 לשנה, יחד עם המנוי.');
    expect(screen.getByTestId('plans-smart-pack-add-on').textContent).not.toMatch(/₪/);
  });
  it('an add-on that cannot be loaded abroad points to the international mailbox', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: false, code: 'not_eligible' } }));
    // Codex I01 (Owner 2026-11-02): this test used to pin the Israeli mailbox; the account's market decides
    render(<SmartPackAddOnOffer isHebrew={false} market="INTERNATIONAL" invoke={invoke} onLeave={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('plans-smart-pack-add-on-unavailable')).toBeInTheDocument());
    // without a quote the currency is unknown - the account's market decides
    expect(screen.getByTestId('plans-smart-pack-add-on-unavailable').textContent).toMatch(/info@tekango.com$/);
  });
});

describe('the SMART PACK removal abroad', () => {
  it('EN: the yearly refund in $ and the international date order', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true, currency: 'USD', period: 'year', effectiveAt: '2027-10-20T10:00:00.000Z', refundMinor: 4645, recurringMinor: 5100, feeMinor: 255 } }));
    render(<SmartPackRemoval isHebrew={false} invoke={invoke} onDone={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('plans-smart-pack-remove')).toBeInTheDocument());
    screen.getByTestId('plans-smart-pack-remove').click();
    await waitFor(() => expect(document.body.textContent).toMatch(/until 20\/10\/2027/));
    expect(document.body.textContent).toMatch(/\$46\.45 is refunded/);
    expect(document.body.textContent).not.toMatch(/₪/);
  });
});
