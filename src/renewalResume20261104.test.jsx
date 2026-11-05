// Owner console 2026-11-04 (typed: "מאשר המשך חיוב מתחדש בלי חיוב מיידי מחלון המסלולים, כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"; the
// Owner: "לא שייך לחייב לקוח בחיוב חדש כשיש לו מנוי משולם"): a stopped renewal resumes from the plans window - the line says the date of
// every charge from the end of the paid period, the button resumes on the account's own period, nothing is charged today, and the return
// from the page never says "payment confirmed".
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PricingModal from './components/PricingModal';
import { parseAccountSummary } from '../supabase/functions/_shared/subscriptionContract.ts';
import { renewalResumeAvailable, renewalResumeLine, billingReturnState, billingReturnText, packageCheckoutAvailable, startPackageCheckout } from './domain/subscriptions/packageCheckout';
import { withBillingPeriod } from './domain/subscriptions/subscriptionStatus';
import { formatShortDate } from './utils/shortDate';

afterEach(cleanup);
const raw = (over = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'enforced' },
  market: 'IL', plan: { id: 'all_inclusive' }, subscriptionStatus: 'active', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: null, catalog: { active: 4, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true },
  priceCatalogVersion: 'pv1:0123456789abcdef', ...over,
});
const PT = new Date(Date.now() + 21 * 86_400_000).toISOString();
// as the app reads it: the shared parser, then the server billing period (withBillingPeriod)
const stopped = (over = {}, billing = {}) => {
  const r = raw({ billingPeriod: 'month', billing: { paidThrough: PT, graceEndsAt: PT, inGrace: false, limited: false, renewalStopped: true, ...billing }, ...over });
  return withBillingPeriod(parseAccountSummary(r), r);
};
// IRON-DATE-001: the account's market short date (Israel DD/MM/YYYY)
const dmy = (iso) => formatShortDate(iso, 'Local');

describe('who may resume', () => {
  it('a live stopped renewal paid after today; never a renewing one, a limited one, LIFETIME, billing off, or a period that ends today', () => {
    expect(renewalResumeAvailable(stopped())).toBe(true);
    expect(packageCheckoutAvailable(stopped())).toBe(false); // no second package
    expect(renewalResumeAvailable(stopped({}, { renewalStopped: false }))).toBe(false);
    expect(renewalResumeAvailable(stopped({}, { limited: true }))).toBe(false);
    expect(renewalResumeAvailable(stopped(), true)).toBe(false);
    expect(renewalResumeAvailable(stopped({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } }))).toBe(false);
    expect(renewalResumeAvailable(stopped({}, { paidThrough: new Date(Date.now() - 3600_000).toISOString() }))).toBe(false);
  });
  it('the line, in the Owner\'s words, with the market short date (monthly / yearly; Hebrew / English)', () => {
    expect(renewalResumeLine(stopped(), true)).toBe(`בחרתם להמשיך עם החיוב המתחדש, ולכן תחויבו בכל חודש בתאריך ${dmy(PT)}. עד אז לא יבוצע חיוב.`);
    expect(renewalResumeLine(stopped({ billingPeriod: 'year' }), true)).toContain('בכל שנה');
    expect(renewalResumeLine(stopped(), false)).toBe(`You chose to continue the renewing charge, so you will be charged every month on ${dmy(PT)}. Nothing is charged until then.`);
  });
  it('the request passes the server answer\'s resume flag on (the departure remembers it)', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true, redirectUrl: 'https://payments.payplus.co.il/x', resume: true, firstChargeAt: PT } }));
    expect(await startPackageCheckout({ billingPeriod: 'month', invoke })).toEqual({ ok: true, redirectUrl: 'https://payments.payplus.co.il/x', resume: true });
  });
});

describe('the return from the page of a resume', () => {
  it('confirmed only when the server says the renewal runs again; never "payment confirmed"', () => {
    expect(billingReturnState('processing', stopped(), 1000, { resume: true })).toBe('waiting');
    expect(billingReturnState('processing', stopped({}, { renewalStopped: false }), 1000, { resume: true })).toBe('confirmed');
    expect(billingReturnState('processing', stopped(), 1000)).toBe('confirmed'); // an ordinary purchase: unchanged
    expect(billingReturnText('confirmed', true, { resume: true })).toBe('החיוב המתחדש חודש. לא בוצע חיוב היום.');
    expect(billingReturnText('waiting', false, { resume: true })).toMatch(/Nothing was charged/);
    expect(billingReturnText('confirmed', true, { resume: true })).not.toMatch(/התשלום אושר/);
  });
});

describe('the plans window', () => {
  for (const isHebrew of [true, false]) {
    it(`${isHebrew ? 'HE' : 'EN'}: the line and the resume button on the account's own period; the SMART PACK box (unticked without SMART PACK), no period choice; the click resumes that period`, async () => {
      const onPurchase = vi.fn(async () => ({ ok: true }));
      render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness accountSummary={stopped()} currency="ILS" onPurchase={onPurchase} />);
      expect(screen.getByTestId('plans-resume-line').textContent).toContain(dmy(PT));
      // the date is one isolated LTR unit (RTL: never "2026./11/26")
      const date = document.querySelector('[data-resume-date]');
      expect(date.textContent).toBe(isHebrew ? dmy(PT) : formatShortDate(PT, 'Local'));
      expect(date.getAttribute('dir')).toBe('ltr');
      const button = screen.getByTestId('plans-resume');
      expect(button.textContent).toBe(isHebrew ? 'המשך החיוב המתחדש' : 'Continue the renewing charge');
      expect(screen.queryByTestId('plans-pay')).toBeNull();
      expect(document.querySelector('[data-addon-toggle]').checked).toBe(false);
      expect(document.querySelector('[data-period-choice]')).toBeNull();
      expect(screen.queryByTestId('plans-resume-addon-note')).toBeNull();
      fireEvent.click(button);
      await waitFor(() => expect(onPurchase).toHaveBeenCalledWith({ billingPeriod: 'month', smartPack: false, addAfter: false }));
    });
  }
  it('no SMART PACK now, ticked: the note says pro rata right after the renewal; the resume carries the package only and the add-on follows', async () => {
    const onPurchase = vi.fn(async () => ({ ok: true }));
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={stopped()} currency="ILS" onPurchase={onPurchase} />);
    fireEvent.click(document.querySelector('[data-addon-toggle]'));
    expect(screen.getByTestId('plans-resume-addon-note').textContent).toBe(`חכם פלוס יתווסף מיד אחרי החידוש: תשלום יחסי רק עליו עד ${dmy(PT)}, ומ-${dmy(PT)} הוא כלול בחיוב החודשי.`);
    fireEvent.click(screen.getByTestId('plans-resume'));
    await waitFor(() => expect(onPurchase).toHaveBeenCalledWith({ billingPeriod: 'month', smartPack: false, addAfter: true }));
  });
  it('SMART PACK active now: the box starts ticked and the resume keeps it on the standing order; unticked, it is left off (to the period end)', async () => {
    const withSp = () => { const r = raw({ billingPeriod: 'month', smartPack: { active: true, source: 'add_on', until: null },
      billing: { paidThrough: PT, graceEndsAt: PT, inGrace: false, limited: false, renewalStopped: true } }); return withBillingPeriod(parseAccountSummary(r), r); };
    const onPurchase = vi.fn(async () => ({ ok: true }));
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={withSp()} currency="ILS" onPurchase={onPurchase} />);
    expect(document.querySelector('[data-addon-toggle]').checked).toBe(true);
    expect(screen.queryByTestId('plans-resume-addon-note')).toBeNull();
    fireEvent.click(screen.getByTestId('plans-resume'));
    await waitFor(() => expect(onPurchase).toHaveBeenLastCalledWith({ billingPeriod: 'month', smartPack: true, addAfter: false }));
    cleanup(); // (the button stays busy after a click - a fresh window for the second choice)
    const onPurchase2 = vi.fn(async () => ({ ok: true }));
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={withSp()} currency="ILS" onPurchase={onPurchase2} />);
    fireEvent.click(document.querySelector('[data-addon-toggle]'));
    fireEvent.click(screen.getByTestId('plans-resume'));
    await waitFor(() => expect(onPurchase2).toHaveBeenLastCalledWith({ billingPeriod: 'month', smartPack: false, addAfter: false }));
  });
  it('a renewing subscriber sees neither the line nor the button', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={stopped({}, { renewalStopped: false })} currency="ILS" onPurchase={vi.fn()} />);
    expect(screen.queryByTestId('plans-resume')).toBeNull();
    expect(screen.queryByTestId('plans-resume-line')).toBeNull();
  });
  it('back from the page: the resume words, never "payment confirmed"', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={stopped({}, { renewalStopped: false })} currency="ILS" onPurchase={vi.fn()}
      billingReturn={{ state: 'confirmed', resume: true }} />);
    expect(screen.getByTestId('plans-modal-billing-return').textContent).toBe('החיוב המתחדש חודש. לא בוצע חיוב היום.');
  });
  it('back from the page with SMART PACK still to add: the words point to its pro-rata offer in the window', () => {
    expect(billingReturnText('confirmed', true, { resume: true, addAfter: true })).toBe('החיוב המתחדש חודש. לא בוצע חיוב היום. עכשיו אפשר להוסיף את חכם פלוס בחלון הזה, בתשלום יחסי רק עליו.');
  });
});
