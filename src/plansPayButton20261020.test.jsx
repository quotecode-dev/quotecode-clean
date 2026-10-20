// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-22: כפתור לתשלום במסך המסלולים, ותיבת חכם פלוס שנוספת לאותו תשלום"): the plans-window
// pay button. Off (today) = the plans window renders exactly as before; on = the package card pays for the chosen period, the ticked
// SMART PACK box joins the same payment, the server answers with its own payment page, and a refusal is shown in words.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PricingModal from './components/PricingModal';
import { parseAccountSummary } from '../supabase/functions/_shared/subscriptionContract.ts';
import { packageCheckoutAvailable, startPackageCheckout, newCheckoutKey, checkoutErrorMessage } from './domain/subscriptions/packageCheckout';

afterEach(cleanup);
const raw = (over = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'prepared' },
  market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7 }, catalog: { active: 4, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
  priceCatalogVersion: 'pv1:0123456789abcdef', ...over,
});
const summary = (over) => parseAccountSummary(raw(over));
const pkg = (billing = { paidThrough: '2026-11-20T10:00:00.000Z', graceEndsAt: null, inGrace: false, limited: false }) =>
  summary({ plan: { id: 'all_inclusive' }, subscriptionStatus: 'active', free10: null, catalog: { active: 4, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true }, billing });

describe('packageCheckoutAvailable (server summary only)', () => {
  it('only while the server billing phase is on; never LIFETIME; an active package only when limited', () => {
    expect(packageCheckoutAvailable(summary({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } }))).toBe(false); // today
    expect(packageCheckoutAvailable(summary())).toBe(true);
    expect(packageCheckoutAvailable(summary(), true)).toBe(false);
    expect(packageCheckoutAvailable({ state: 'not_activated' })).toBe(false);
    expect(packageCheckoutAvailable(pkg())).toBe(false);
    expect(packageCheckoutAvailable(pkg({ paidThrough: '2026-11-20T10:00:00.000Z', graceEndsAt: '2026-11-23T10:00:00.000Z', inGrace: false, limited: true }))).toBe(true);
    expect(packageCheckoutAvailable(summary({ plan: { id: 'modern' }, subscriptionStatus: 'active', free10: null }))).toBe(false);
  });
  it('the idempotency key fits the server alphabet; the request carries the box and the period only', async () => {
    expect(newCheckoutKey()).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    const invoke = vi.fn(async () => ({ data: { ok: true, redirectUrl: 'https://payments.payplus.co.il/x' } }));
    expect(await startPackageCheckout({ billingPeriod: 'year', smartPack: true, invoke, key: 'pkg_key_0123456789abcdef' })).toEqual({ ok: true, redirectUrl: 'https://payments.payplus.co.il/x' });
    expect(invoke).toHaveBeenCalledWith('subscription-authority', { body: { action: 'checkout_intent', planId: 'all_inclusive', billingPeriod: 'year', smartPack: true, blocks: 0, idempotencyKey: 'pkg_key_0123456789abcdef' } });
    const refused = vi.fn(async () => ({ data: null, error: { context: { json: async () => ({ ok: false, code: 'payment_update_required' }) } } }));
    expect(await startPackageCheckout({ billingPeriod: 'month', invoke: refused })).toEqual({ ok: false, code: 'payment_update_required' });
    expect(await startPackageCheckout({ billingPeriod: 'week', invoke })).toEqual({ ok: false, code: 'invalid_request' });
    expect(checkoutErrorMessage('x', true)).toMatch(/לא בוצע חיוב/);
  });
});

describe('the plans window', () => {
  it('billing off (today): no pay button and no fee line - the window is unchanged', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } })} onPurchase={vi.fn()} />);
    expect(screen.queryByTestId('plans-pay')).toBeNull();
    expect(screen.queryByTestId('plans-pay-fee')).toBeNull();
  });
  it('HE / RTL: annual + SMART PACK ticked -> onPurchase({ year, smartPack }); the fee notice is shown before paying', async () => {
    const onPurchase = vi.fn(async () => ({ ok: true }));
    const { container } = render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} onPurchase={onPurchase} />);
    const btn = screen.getByTestId('plans-pay');
    expect(btn.textContent).toBe('לתשלום');
    expect(screen.getByTestId('plans-pay-fee').textContent).toMatch(/סעיף 6/);
    expect(screen.getByTestId('plans-pay-fee').getAttribute('dir')).toBe('rtl');
    fireEvent.click(container.querySelector('input[data-period="year"]'));
    fireEvent.click(container.querySelector('input[data-addon-toggle]'));
    fireEvent.click(btn);
    await waitFor(() => expect(onPurchase).toHaveBeenCalledWith({ billingPeriod: 'year', smartPack: true }));
  });
  // Owner console 2026-10-21 (typed L-22 / L-01 approval, "השוק"): the button is Israel-only, so the English view is an Israeli account's
  it('EN / LTR: a refusal is shown in words and the button comes back', async () => {
    const onPurchase = vi.fn(async () => ({ ok: false, code: 'already_subscribed' }));
    render(<PricingModal isOpen onClose={() => {}} isHebrew={false} isLocalIsraeliBusiness accountSummary={summary()} onPurchase={onPurchase} />);
    const btn = screen.getByTestId('plans-pay');
    expect(btn.textContent).toBe('Pay now');
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('plans-pay-error').textContent).toBe('This account already has an active package. No payment page was opened.'));
    expect(screen.getByTestId('plans-pay').disabled).toBe(false);
    expect(onPurchase).toHaveBeenCalledWith({ billingPeriod: 'month', smartPack: false });
  });
  it('LIFETIME never sees a pay button', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={summary()} isLifetime onPurchase={vi.fn()} />);
    expect(screen.queryByTestId('plans-pay')).toBeNull();
  });
});
