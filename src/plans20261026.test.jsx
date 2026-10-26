// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-22: שורת המחיר הכולל עם חכם פלוס בכרטיס המנוי ..." and "מאשר את התוכנית א עד ז בשחרור
// אחד ..."): the plans window of a subscriber whose SMART PACK renews with the plan says the total; abroad the card is in the account
// currency with the USD charge, and SMART PACK is an information line - HE + EN.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { parseAccountSummary } from '../supabase/functions/_shared/subscriptionContract.ts';
import PricingModal from './components/PricingModal';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

afterEach(cleanup);
const base = (over = {}) => ({ ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'enforced' },
  market: 'IL', plan: { id: 'all_inclusive' }, subscriptionStatus: 'active', capabilities: ['quote_style.classic'], eligiblePlans: {}, free10: null,
  catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false }, priceCatalogVersion: null,
  billing: { paidThrough: '2026-11-25T10:00:00.000Z', graceEndsAt: null, inGrace: false, limited: false, renewalStopped: false, limitedReason: null },
  billingPeriod: 'month', smartPack: { active: false, source: null, until: null }, ...over });
// the client adds billingPeriod to the parsed summary (subscriptionStatus.js withBillingPeriod)
const S = (over = {}) => ({ ...parseAccountSummary(base(over)), billingPeriod: 'billingPeriod' in over ? over.billingPeriod : 'month' });
const open = (isHebrew, summary, extra = {}) => render(<PricingModal isOpen onClose={() => {}} isHebrew={isHebrew} isLocalIsraeliBusiness={summary.market === 'IL'} accountSummary={summary} currency="ILS" {...extra} />);

describe('א - the total with SMART PACK on the subscriber card (HE + EN)', () => {
  it.each([[true, 'כולל חכם פלוס: ₪40.00 לחודש'], [false, 'Including SMART PACK: ₪40.00 / month']])('renewing line (isHebrew %s)', (isHebrew, text) => {
    open(isHebrew, S({ smartPack: { active: true, source: 'add_on', until: null } }));
    expect(screen.getByTestId('plans-smart-pack-total').textContent).toBe(text);
    expect(screen.getByTestId('plans-smart-pack-total')).toHaveAttribute('dir', isHebrew ? 'rtl' : 'ltr');
    expect(screen.getByTestId('plans-modal-card-all_inclusive').querySelector('[data-price]').textContent).toBe('₪30.00'); // the package price stays
  });
  it.each([[true, 'כולל חכם פלוס: ₪408.00 לשנה'], [false, 'Including SMART PACK: ₪408.00 / year']])('annual subscriber (isHebrew %s)', (isHebrew, text) => {
    const s = S({ smartPack: { active: true, source: 'add_on', until: null } });
    open(isHebrew, { ...s, billingPeriod: 'year' });
    expect(screen.getByTestId('plans-smart-pack-total').textContent).toBe(text);
  });
  it.each([true, false])('never a total while SMART PACK is not on the standing order (it ends on a date) or not active (isHebrew %s)', (isHebrew) => {
    open(isHebrew, S({ smartPack: { active: true, source: 'add_on', until: '2026-11-25T10:00:00.000Z' } }));
    expect(screen.queryByTestId('plans-smart-pack-total')).toBeNull();
    cleanup();
    open(isHebrew, S());
    expect(screen.queryByTestId('plans-smart-pack-total')).toBeNull();
  });
});

describe('ד - abroad: SMART PACK information only (HE + EN), never in Israel', () => {
  const intl = () => S({ market: 'INTERNATIONAL', plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, billingPeriod: null,
    free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 } });
  it.each([[true, 'הרכישה מחוץ לישראל תיפתח בקרוב.'], [false, 'Buying it outside Israel opens soon.']])('isHebrew %s', (isHebrew, end) => {
    open(isHebrew, intl(), { currency: 'USD' });
    const line = screen.getByTestId('plans-smart-pack-abroad');
    expect(line.textContent.endsWith(end)).toBe(true);
    expect(line).toHaveAttribute('dir', isHebrew ? 'rtl' : 'ltr');
    expect(line.querySelectorAll('bdi[dir="ltr"]').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId('plans-smart-pack-add-on-pay')).toBeNull();
    expect(document.querySelector('[data-addon-toggle]')).toBeNull();
  });
  it('Israel: no abroad line', () => {
    open(true, S());
    expect(screen.queryByTestId('plans-smart-pack-abroad')).toBeNull();
  });
});

describe('ג - the plans window takes the account currency, not the open quote currency', () => {
  it('accountCurrency wins over currency (a USD quote open on a GBP account)', () => {
    const src = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8');
    expect(src).toMatch(/accountCurrency=\{businessCurrency\}/);
    expect(src).toMatch(/setBusinessCurrency\(userCurr\)/);
  });
});
