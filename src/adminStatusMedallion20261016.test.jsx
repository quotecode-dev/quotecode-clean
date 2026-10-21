// Owner console 2026-10-16: the subscription status - a distinct medallion per status, in the user's header medallion style, the SAME
// medallion and words in the user's header and in the admin (approvals naming L-03 / L-07), refined by the approved admin spec
// (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16 §5, D-01 / D-02 / D-06): monthly / annual only from the server's billing period, an active
// subscription without one "needs verification", the 10 free quotes counter only from the server, no "no subscription" status.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AdminAccountStatus, AdminAccountStatusIcon } from './components/AdminSubscriptionState';
import { accountStatus, accountStatusWords, accountStatusSentence, statusMedallionModel, withBillingPeriod, breakdownFromCounts, ACCOUNT_STATUS, ACCOUNT_STATUS_ORDER, STATUS_MEDALLION_KIND } from './domain/subscriptions/subscriptionStatus';
import HeaderPlanMedallion, { PLAN_MEDALLION_VISUAL } from './components/HeaderPlanMedallion';
import fs from 'node:fs';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const active = (billingPeriod) => ({ state: 'ready', subscriptionStatus: 'active', planId: 'all_inclusive', ...(billingPeriod !== undefined ? { billingPeriod } : {}) });
const free10 = (consumed, reserved = 0) => ({ state: 'ready', planId: 'free', subscriptionStatus: 'none', phase: { output: 'enforced' }, free10: { limit: 10, consumed, reserved, remaining: 10 - consumed - reserved } });

describe('admin subscription status (Owner 2026-10-16, admin spec §5)', () => {
  it('one status per account: LIFETIME > paid (period from the server only) > 10 free quotes > trial > expired > not yet active', () => {
    expect(accountStatus({ is_lifetime: true }, active('month'), NOW).key).toBe('lifetime');
    expect(accountStatus({}, active('month'), NOW).key).toBe('paid_monthly');
    expect(accountStatus({}, active('year'), NOW).key).toBe('paid_annual');
    expect(accountStatus({}, active(null), NOW).key).toBe('paid_unverified'); // D-06: never a default month
    expect(accountStatus({}, active(), NOW).key).toBe('paid_unverified');
    expect(accountStatus({}, free10(3), NOW)).toMatchObject({ key: 'free10', consumed: 3, remaining: 7, total: 10 });
    expect(accountStatus({ plan: 'pro' }, null, NOW).key).toBe('free10_inactive'); // the legacy plan field never makes a paying account
    expect(accountStatus({ trial_ends_at: '2026-10-20T00:00:00Z' }, null, NOW).key).toBe('trial');
    expect(accountStatus({ trial_ends_at: '2026-10-01T00:00:00Z' }, null, NOW).key).toBe('trial_ended');
    expect(accountStatus({}, { state: 'ready', subscriptionStatus: 'past_due' }, NOW).key).toBe('free10_inactive');
    expect(Object.keys(ACCOUNT_STATUS)).not.toContain('none');
  });

  it('withBillingPeriod: only month / year for a ready, active, non-free summary; anything else null', () => {
    expect(withBillingPeriod({ state: 'ready', subscriptionStatus: 'active', planId: 'all_inclusive' }, { billingPeriod: 'year' }).billingPeriod).toBe('year');
    expect(withBillingPeriod({ state: 'ready', subscriptionStatus: 'active', planId: 'all_inclusive' }, { billingPeriod: 'week' }).billingPeriod).toBeNull();
    expect(withBillingPeriod({ state: 'ready', subscriptionStatus: 'active', planId: 'all_inclusive' }, {}).billingPeriod).toBeNull();
    expect(withBillingPeriod({ state: 'ready', subscriptionStatus: 'none', planId: 'free' }, { billingPeriod: 'month' }).billingPeriod).toBeNull();
    expect(withBillingPeriod({ state: 'not_activated' }, { billingPeriod: 'month' })).toEqual({ state: 'not_activated' });
  });

  it('the count always lists the six main statuses (monthly and annual even at 0), the other two only when present', () => {
    expect(breakdownFromCounts({ trial_ended: 9, lifetime: 6, free10_inactive: 2 }).map((r) => [r.key, r.count])).toEqual([
      ['free10', 0], ['trial', 0], ['trial_ended', 9], ['paid_monthly', 0], ['paid_annual', 0], ['lifetime', 6], ['free10_inactive', 2]]);
  });

  it('every main status has its own medallion; LIFETIME and monthly are the user header medallions; one visual table', () => {
    const main = ['free10', 'trial', 'trial_ended', 'paid_monthly', 'paid_annual', 'lifetime'];
    const kinds = main.map((k) => {
      const { container } = render(<AdminAccountStatusIcon statusKey={k} />);
      const mark = container.querySelector('.pmm');
      expect(mark.querySelector('svg.pmm-ring')).toBeTruthy();
      return mark.getAttribute('data-plan-kind');
    });
    expect(new Set(kinds).size).toBe(main.length);
    expect(kinds[main.indexOf('lifetime')]).toBe('lifetime');
    expect(kinds[main.indexOf('paid_monthly')]).toBe('plan');
    for (const kind of Object.values(STATUS_MEDALLION_KIND)) expect(PLAN_MEDALLION_VISUAL[kind], kind).toBeTruthy();
    expect(ACCOUNT_STATUS_ORDER).toHaveLength(Object.keys(ACCOUNT_STATUS).length);
  });

  // Owner console 2026-10-16 (approval naming L-03): "the icon in the user interface and the admin must be the same"
  it('the user header medallion and the admin show the SAME medallion and the same status for every status', () => {
    const cases = [
      [{ is_lifetime: true }, null], [{}, active('month')], [{}, active('year')], [{}, active(null)], [{}, free10(3, 1)],
      [{ trial_ends_at: '2099-10-20T00:00:00Z' }, null], [{ trial_ends_at: '2020-10-01T00:00:00Z' }, null], [{ plan: 'pro' }, { state: 'not_activated' }],
    ];
    const fmt = () => '20/10/2099';
    for (const [account, summary] of cases) {
      const model = statusMedallionModel(account, summary, { isHebrew: true, formatDate: fmt });
      const { getByTestId, unmount } = render(<HeaderPlanMedallion model={model} isHebrew onOpen={() => {}} />);
      const header = getByTestId('header-plan-button');
      const { container } = render(<AdminAccountStatus account={account} summary={summary} isHebrew formatDate={fmt} />);
      expect(header.dataset.planKind).toBe(container.querySelector('.pmm').getAttribute('data-plan-kind'));
      expect(container.querySelector('[data-status]').getAttribute('data-status')).toBe(model.statusKey);
      expect(header.querySelector('.hpm-bubble').textContent).toBe(accountStatusWords(accountStatus(account, summary), true, fmt));
      unmount();
    }
    expect(accountStatusWords(accountStatus({}, free10(3)), true)).toBe('10 הצעות חינם · 3/10 נוצלו');
  });

  it('the plans window line states the same status, a date only where one exists', () => {
    const fmt = () => '20/10/2099';
    expect(accountStatusSentence({ key: 'trial', until: 'x' }, true, fmt)).toBe('יש לך תקופת ניסיון עד 20/10/2099');
    expect(accountStatusSentence({ key: 'trial_ended' }, false, fmt)).toBe('Your trial has ended');
    expect(accountStatusSentence({ key: 'paid_monthly' }, true, fmt)).toBe('יש לך מנוי חודשי פעיל');
    expect(accountStatusSentence({ key: 'paid_unverified' }, true, fmt)).toBe('יש לך מנוי פעיל');
    expect(accountStatusSentence({ key: 'free10', consumed: 3, reserved: 1, total: 10 }, true, fmt)).toBe('ניצלת 3 מתוך 10 הצעות חינם (1 בתהליך)');
    expect(accountStatusSentence({ key: 'free10_inactive' }, true, fmt)).toBe('10 ההצעות החינמיות שלך עוד לא הופעלו, והחשבון אינו מוגבל');
    const dash = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(dash).toMatch(/statusLine=\{accountStatusSentence\(ownSubscriptionStatus, isHebrew, statusDate\)\}/);
    expect(fs.readFileSync('src/components/PricingModal.jsx', 'utf8')).toMatch(/data-testid="plans-modal-subscription-status" role="status"/);
  });

  it('words beside the medallion, HE + EN; the trial date is an isolated LTR number', () => {
    const { container: he } = render(<AdminAccountStatus account={{ trial_ends_at: '2099-10-20T00:00:00Z' }} isHebrew formatDate={() => '20/10/2099'} />);
    expect(he.querySelector('strong').textContent).toBe('בניסיון');
    expect(he.querySelector('bdi[dir="ltr"], bdi.av-num').textContent).toBe('20/10/2099');
    const { container: en } = render(<AdminAccountStatus account={{}} summary={active('month')} isHebrew={false} />);
    expect(en.querySelector('strong').textContent).toBe('Monthly subscription');
    const { container: life } = render(<AdminAccountStatus account={{ is_lifetime: true }} isHebrew />);
    expect(life.querySelector('strong').textContent).toBe('מנוי LIFETIME');
    const { container: srv } = render(<AdminAccountStatus account={{}} statusKey="free10" isHebrew />);
    expect(srv.querySelector('strong').textContent).toBe('10 הצעות חינם'); // a server row without the counter: the name only
  });
});
