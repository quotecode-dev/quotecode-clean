// Owner console 2026-10-25 (typed: "מאשר לתקן את ממצאים 1 עד 13 בעברית ובאנגלית, כולל שינוי ב-L-01, L-14, L-17, L-22"): every account state
// through the plans window, the SMART PACK lines and the return from a payment page - each in Hebrew AND English (the Owner: "לבדוק תמיד
// גם באנגלית! חייב להיות סנכרון מלא בכל שינוי").
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { parseAccountSummary, smartPackPurchasePath } from '../supabase/functions/_shared/subscriptionContract.ts';
import { buildAddOnLinkBody, PAYPLUS_RETURN_PATHS, payplusProviderFromSecrets } from '../supabase/functions/subscription-authority/payplus.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_STATUS_ORDER, STATUS_MEDALLION_KIND } from './domain/subscriptions/subscriptionStatus';
import { capabilityNoticeCopy as noticeCopy } from './domain/subscriptions/capabilityNoticeCopy';
import PricingModal from './components/PricingModal';
import { capabilityNoticeCopy } from './domain/subscriptions/capabilityNoticeCopy';
import { accountStatusModel } from './domain/subscriptions/accountSummaryClient';
import { accountStatus, accountStatusSentence, statusMedallionModel } from './domain/subscriptions/subscriptionStatus';
import { VOICE_COPY } from './utils/voiceAssistant';
import { billingReturnFromSearch, billingReturnState, billingReturnText, packageCheckoutAvailable, pastDueLine, plansAvailabilityLine,
  smartPackAddOnAvailable, smartPackStatusLine } from './domain/subscriptions/packageCheckout';

afterEach(cleanup);
const PAID_THROUGH = '2026-11-20T10:00:00.000Z';
const GRACE = '2026-11-23T10:00:00.000Z';
const base = (over = {}) => ({ ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'enforced' },
  market: 'IL', plan: { id: 'all_inclusive' }, subscriptionStatus: 'active', capabilities: ['quote_style.classic'], eligiblePlans: {}, free10: null,
  catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false }, priceCatalogVersion: null,
  billing: { paidThrough: PAID_THROUGH, graceEndsAt: null, inGrace: false, limited: false, renewalStopped: false, limitedReason: null },
  smartPack: { active: false, source: null, until: null }, ...over });
const S = (over) => parseAccountSummary(base(over));
const active = () => S();
const pastDue = () => S({ subscriptionStatus: 'past_due', billing: { paidThrough: PAID_THROUGH, graceEndsAt: GRACE, inGrace: true, limited: false, renewalStopped: false, limitedReason: null } });
const limited = () => S({ billing: { paidThrough: PAID_THROUGH, graceEndsAt: GRACE, inGrace: false, limited: true, renewalStopped: true, limitedReason: 'cancelled' } });
const stopped = () => S({ billing: { paidThrough: PAID_THROUGH, graceEndsAt: null, inGrace: false, limited: false, renewalStopped: true, limitedReason: null } });
const freeEnded = () => S({ plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined,
  free10: { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: '2026-10-20T00:00:00.000Z', periodEnded: true } });
const intl = () => S({ market: 'INTERNATIONAL', plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined,
  free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 } });
const withSmartPack = (sp) => S({ smartPack: sp });
const LANGS = [[true, 'he'], [false, 'en']];

describe('1 - back from a cancelled SMART PACK page (HE + EN)', () => {
  it('its own cancel page; "cancelled" - never "payment confirmed"', () => {
    expect(PAYPLUS_RETURN_PATHS.addOnCancel).toBe('/dashboard?billing=smart_pack_cancelled');
    const body = buildAddOnLinkBody({ paymentPageUid: '33333333-3333-4333-8333-333333333333', callbackUrl: 'https://x.supabase.co/cb', successUrl: 'https://www.tekango.com/s',
      failureUrl: 'https://www.tekango.com/f', cancelUrl: 'https://www.tekango.com/c', addOnCancelUrl: 'https://www.tekango.com/dashboard?billing=smart_pack_cancelled' },
      { addOnId: '44444444-4444-4444-8444-444444444444', amountMinor: 700, billingPeriod: 'month' });
    expect(body.refURL_cancel).toBe('https://www.tekango.com/dashboard?billing=smart_pack_cancelled');
    expect(billingReturnFromSearch('?billing=smart_pack_cancelled')).toBe('smart_pack_cancelled');
    expect(billingReturnState('smart_pack_cancelled', active(), 1000)).toBe('cancelled');
    expect(billingReturnText('cancelled', true, { addOn: true })).toBe('התשלום בוטל. לא בוצע חיוב.');
    expect(billingReturnText('cancelled', false, { addOn: true })).toBe('The payment was cancelled. Nothing was charged.');
  });
});

describe('2 / 3 - a failed renewal and a limited account are said so (HE + EN, header and plans window)', () => {
  it('past due', () => {
    expect(accountStatus({}, pastDue()).key).toBe('paid_past_due');
    expect(statusMedallionModel({}, pastDue(), { isHebrew: true }).label).toBe('החיוב האחרון לא עבר');
    expect(statusMedallionModel({}, pastDue(), { isHebrew: false }).label).toBe('Last payment failed');
  });
  it('limited', () => {
    expect(accountStatus({}, limited()).key).toBe('paid_limited');
    expect(statusMedallionModel({}, limited(), { isHebrew: true }).label).toBe('המנוי הסתיים');
    expect(statusMedallionModel({}, limited(), { isHebrew: false }).label).toBe('Subscription ended');
    expect(accountStatusSentence(accountStatus({}, limited()), true)).toBe('המנוי שלכם הסתיים, והחשבון מוגבל');
  });
});

describe('4 - a failed renewal gets no pay button, but the mailbox to write to (HE + EN)', () => {
  it('no button; the line names the mailbox', () => {
    expect(packageCheckoutAvailable(pastDue())).toBe(false);
    expect(packageCheckoutAvailable(limited())).toBe(true); // limited may pay again
    expect(pastDueLine(pastDue(), true)).toEqual({ text: 'לעדכון הכרטיס של המנוי כתבו לנו:', mail: 'support@tekango.com' });
    expect(pastDueLine(pastDue(), false).text).toBe('To update the card of your subscription, write to us:');
    expect(accountStatusSentence(accountStatus({}, pastDue()), true)).toBe('החיוב האחרון של המנוי לא עבר, ונחייב שוב את הכרטיס השמור');
    expect(accountStatusSentence(accountStatus({}, pastDue()), false)).toBe('Your last subscription charge did not go through; the saved card will be charged again');
    expect(pastDueLine(active(), true)).toBeNull();
  });
  it.each(LANGS)('the plans window (isHebrew %s): the past-due line with a mailto, no pay button', (isHebrew) => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness accountSummary={pastDue()} onPurchase={vi.fn()} />);
    const line = screen.getByTestId('plans-modal-past-due');
    expect(line.querySelector('a').getAttribute('href')).toBe('mailto:support@tekango.com');
    expect(screen.queryByTestId('plans-pay')).toBeNull();
    expect(document.querySelector('[data-addon-toggle]')).toBeNull();
  });
});

describe('5 - "you can add it in the plans window" only where it can be bought now (HE + EN)', () => {
  it('the one path decision per state', () => {
    expect(smartPackPurchasePath(active())).toBe('add_on');
    expect(smartPackPurchasePath(S({ plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 } }))).toBe('package');
    expect(smartPackPurchasePath(limited())).toBe('package');
    expect(smartPackPurchasePath(pastDue())).toBeNull();
    expect(smartPackPurchasePath(stopped())).toBeNull();
    expect(smartPackPurchasePath(intl())).toBeNull();
    expect(smartPackPurchasePath(S({ plan: { id: 'classic' } }))).toBeNull();
    expect(smartPackPurchasePath(active(), true)).toBeNull();
    expect(smartPackAddOnAvailable(stopped())).toBe(false);
  });
  it.each(LANGS)('the notice / the voice note (isHebrew %s)', (isHebrew, lang) => {
    const open = capabilityNoticeCopy(lang, 'smart_pack', active());
    expect(open.explanation).toMatch(isHebrew ? /אפשר להוסיף אותו בחלון המסלולים\.$/ : /You can add it in the plans window\.$/);
    for (const s of [pastDue(), stopped(), S({ plan: { id: 'classic' } })]) {
      const c = capabilityNoticeCopy(lang, 'smart_pack', s);
      expect(c.explanation).not.toMatch(/חלון המסלולים|plans window/);
      expect(c.eligible).toBe('');
    }
    expect(VOICE_COPY[lang].smartPack).toMatch(isHebrew ? /בחלון המסלולים\.$/ : /in the plans window\.$/);
    expect(VOICE_COPY[lang].smartPackNoPath).not.toMatch(/חלון|window|מסך|view/);
  });
});

describe('7 - the availability line says the truth, with a retry (HE + EN)', () => {
  it('loading / not readable / not open abroad', () => {
    expect(plansAvailabilityLine({ state: 'loading' }, true)).toEqual({ kind: 'loading', text: 'טוען את פרטי החשבון…' });
    expect(plansAvailabilityLine({ state: 'loading' }, false).text).toBe('Loading your account details…');
    expect(plansAvailabilityLine({ state: 'unavailable', code: 'not_authenticated' }, true).text).toBe('לא הצלחנו לטעון את פרטי החשבון. אפשר לנסות שוב.');
    expect(plansAvailabilityLine({ state: 'invalid', code: 'schema' }, false).text).toBe('We could not load your account details. You can try again.');
    expect(plansAvailabilityLine(intl(), true).text).toBe('הרכישה עדיין לא פתוחה בחשבונות מחוץ לישראל, ולא מתבצע חיוב.');
    expect(plansAvailabilityLine(intl(), false).text).toBe('Purchasing is not open yet for accounts outside Israel, and nothing is charged.');
  });
  it.each(LANGS)('the plans window (isHebrew %s): a summary that did not load can be read again', (isHebrew) => {
    const retry = vi.fn();
    render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness accountSummary={{ state: 'unavailable', code: 'not_authenticated' }} onRetrySummary={retry} />);
    expect(screen.getByTestId('plans-modal-availability')).toHaveAttribute('data-kind', 'error');
    fireEvent.click(screen.getByTestId('plans-modal-retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('8 - the 7 free days ended: nothing left (HE + EN)', () => {
  it('header, plans line, account detail', () => {
    expect(statusMedallionModel({}, freeEnded(), { isHebrew: true })).toMatchObject({ label: '10 הצעות חינם · 7 ימי החינם הסתיימו', remaining: 0 });
    expect(statusMedallionModel({}, freeEnded(), { isHebrew: false }).label).toBe('10 free quotes · the 7 free days have ended');
    expect(accountStatusModel(freeEnded(), 'he').detail).toBe('7 ימי החינם הסתיימו');
    expect(accountStatusModel(freeEnded(), 'en').detail).toBe('The 7 free days have ended');
  });
});

describe('10 - the account\'s SMART PACK line (HE + EN)', () => {
  const fmt = () => '20/11/2026';
  it('active with the line / until a date / in the free days / none', () => {
    expect(smartPackStatusLine(withSmartPack({ active: true, source: 'add_on', until: null }), true, fmt)).toBe('חכם פלוס פעיל, ומתחדש יחד עם המנוי');
    expect(smartPackStatusLine(withSmartPack({ active: true, source: 'add_on', until: null }), false, fmt)).toBe('SMART PACK is active and renews with your plan');
    expect(smartPackStatusLine(withSmartPack({ active: true, source: 'add_on', until: PAID_THROUGH }), true, fmt)).toBe('חכם פלוס פעיל עד 20/11/2026');
    expect(smartPackStatusLine(withSmartPack({ active: true, source: 'add_on', until: PAID_THROUGH }), false, fmt)).toBe('SMART PACK is active until 20/11/2026');
    expect(smartPackStatusLine(S({ plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 },
      smartPack: { active: true, source: 'free_window', until: PAID_THROUGH } }), true, fmt)).toBe('חכם פלוס כלול בימי החינם עד 20/11/2026. כדי להמשיך איתו אחרי רכישת מנוי, סמנו את חכם פלוס בתשלום.');
    expect(smartPackStatusLine(S({ plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 },
      smartPack: { active: true, source: 'free_window', until: PAID_THROUGH } }), false, fmt)).toBe('SMART PACK is included in your free days until 20/11/2026. To keep it after you subscribe, tick SMART PACK when you pay.');
    // no pay button (abroad) = no "tick it when you pay" (HE + EN)
    const abroad = S({ market: 'INTERNATIONAL', plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 },
      smartPack: { active: true, source: 'free_window', until: PAID_THROUGH } });
    expect(smartPackStatusLine(abroad, true, fmt)).toBe('חכם פלוס כלול בימי החינם עד 20/11/2026.');
    expect(smartPackStatusLine(abroad, false, fmt)).toBe('SMART PACK is included in your free days until 20/11/2026.');
    expect(smartPackStatusLine(active(), true, fmt)).toBeNull();
  });
  it.each(LANGS)('shown in the plans window (isHebrew %s)', (isHebrew) => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness accountSummary={withSmartPack({ active: true, source: 'add_on', until: null })} />);
    expect(screen.getByTestId('plans-modal-smart-pack-status').textContent).toBe(isHebrew ? 'חכם פלוס פעיל, ומתחדש יחד עם המנוי' : 'SMART PACK is active and renews with your plan');
  });
});

describe('review follow-ups (HE + EN)', () => {
  const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
  it('the real provider config sends the add-on cancel page', async () => {
    const env = { PAYPLUS_API_KEY: 'synthetic-api-key', PAYPLUS_SECRET_KEY: 'synthetic-secret-not-a-real-key-0123', PAYPLUS_PAYMENT_PAGE_UID: '33333333-3333-4333-8333-333333333333', PAYPLUS_ENVIRONMENT: 'production' };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ results: { status: 'success' }, data: { payment_page_link: 'https://payments.payplus.co.il/x', page_request_uid: '1a2aee2e-0000-4000-8000-000000000005' } }) }));
    const p = payplusProviderFromSecrets((n) => env[n], 'https://project.supabase.co', fetch, () => Date.now());
    await p.createAddOnCheckout({ addOnId: '44444444-4444-4444-8444-444444444444', currency: 'ILS', amountMinor: 700, billingPeriod: 'month' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).refURL_cancel).toBe('https://www.tekango.com/dashboard?billing=smart_pack_cancelled');
  });
  it('the admin filter / counts keep only the statuses its server knows; the new ones use the paid medallion (no new icon)', () => {
    expect(ACCOUNT_STATUS_ORDER).not.toContain('paid_past_due');
    expect(ACCOUNT_STATUS_ORDER).not.toContain('paid_limited');
    expect(STATUS_MEDALLION_KIND.paid_past_due).toBe('plan');
    expect(STATUS_MEDALLION_KIND.paid_limited).toBe('plan');
  });
  it('abroad: the same sentence in the notice and the plans window (EN), plural address in HE', () => {
    expect(noticeCopy('en', 'smart_pack', intl()).explanation).toMatch(/ Purchasing is not open yet for accounts outside Israel\.$/);
    expect(noticeCopy('he', 'smart_pack', intl()).explanation).toMatch(/ הרכישה עדיין לא פתוחה בחשבונות מחוץ לישראל\.$/);
    expect(accountStatusModel(pastDue(), 'he').detail).toBe('החיוב האחרון לא עבר');
    expect(read('src/components/PackageOfferCards.jsx')).toContain("isHebrew ? 'המסלול שלכם' : 'Your plan'");
  });
  it('Dashboard wiring: retry from the plans window; "not open abroad" only from the server', () => {
    const dash = read('src/pages/Dashboard.jsx');
    expect(dash).toMatch(/onRetrySummary=\{refreshAccountSummary\}/);
    expect(dash).toMatch(/closedAbroad=\{plansAvailabilityLine\(accountSummary, isHebrew\)\?\.kind === 'closed_abroad'\}/);
  });
  it('an account not assigned to a plan is told so, with a retry (HE + EN)', () => {
    expect(plansAvailabilityLine({ state: 'unprovisioned', code: 'account_not_provisioned' }, true).text).toBe('החשבון עדיין לא שויך למסלול, ולכן אי אפשר לרכוש כרגע. אפשר לנסות שוב, או לכתוב לנו.');
    expect(plansAvailabilityLine({ state: 'unprovisioned', code: 'account_not_provisioned' }, false).text).toBe('Your account is not assigned to a plan yet, so nothing can be bought right now. You can try again, or write to us.');
  });
});

describe('6 / 11 - an active subscriber\'s plans window: no ₪40 box with nothing to press (HE + EN)', () => {
  it.each(LANGS)('isHebrew %s', (isHebrew) => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness accountSummary={active()} onPurchase={vi.fn()} />);
    expect(document.querySelector('[data-addon-toggle]')).toBeNull();
    expect(screen.queryByTestId('plans-pay')).toBeNull();
  });
});
