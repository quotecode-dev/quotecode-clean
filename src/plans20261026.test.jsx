// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-22: שורת המחיר הכולל עם חכם פלוס בכרטיס המנוי ..." and "מאשר את התוכנית א עד ז בשחרור
// אחד ..."): the plans window of a subscriber whose SMART PACK renews with the plan says the total; abroad the card is in the account
// currency with the USD charge, and SMART PACK is an information line - HE + EN.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
  // Owner console 2026-10-26 (typed: "מאשר להציג את שורת המחיר הכולל עם חכם פלוס גם בלשונית השנתי")
  it.each([[true, 'כולל חכם פלוס: ₪408.00 לשנה'], [false, 'Including SMART PACK: ₪408.00 / year']])('a monthly subscriber on the annual tab sees the annual total too (isHebrew %s)', (isHebrew, text) => {
    open(isHebrew, S({ smartPack: { active: true, source: 'add_on', until: null } }));
    fireEvent.click(document.querySelector('input[data-period="year"]'));
    expect(screen.getByTestId('plans-smart-pack-total').textContent).toBe(text);
    expect(screen.getByTestId('plans-modal-card-all_inclusive').querySelector('[data-price]').textContent).toBe('₪306.00');
  });
  it.each([true, false])('never a total while SMART PACK is not on the standing order (it ends on a date) or not active (isHebrew %s)', (isHebrew) => {
    open(isHebrew, S({ smartPack: { active: true, source: 'add_on', until: '2026-11-25T10:00:00.000Z' } }));
    expect(screen.queryByTestId('plans-smart-pack-total')).toBeNull();
    cleanup();
    open(isHebrew, S());
    expect(screen.queryByTestId('plans-smart-pack-total')).toBeNull();
  });
});

// Owner console 2026-11-01 (typed: "מאשר פתיחת הרכישה בחו"ל לפי ההמלצות א-ה, כולל שינוי ב-L-01, L-05, ... L-22")
describe('ד retired (2026-11-01): abroad SMART PACK is bought like in Israel - no information-only line (HE + EN)', () => {
  const intl = () => S({ market: 'INTERNATIONAL', plan: { id: 'free' }, subscriptionStatus: 'none', billing: undefined, billingPeriod: null,
    free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 } });
  it.each([true, false])('isHebrew %s', (isHebrew) => {
    open(isHebrew, intl(), { currency: 'USD' });
    expect(screen.queryByTestId('plans-smart-pack-abroad')).toBeNull();
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
