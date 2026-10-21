// OD-16 / OD-20: the plan badge renders only the server account summary. No legacy FREE/BASIC/PRO/LIFETIME/trial label,
// no monthly counter, no balance that the server did not return.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanIdentityBadge from './PlanIdentityBadge';
import { parseAccountSummary } from '../../supabase/functions/_shared/subscriptionContract.ts';

const ready = (planId, over = {}) => parseAccountSummary({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' },
  market: 'IL', plan: { id: planId }, subscriptionStatus: planId === 'free' ? 'none' : 'active', capabilities: ['quote_style.classic'],
  eligiblePlans: {}, free10: planId === 'free' ? { limit: 10, consumed: 4, reserved: 0, remaining: 6 } : null,
  catalog: planId === 'free' ? { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false } : { active: 0, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true },
  priceCatalogVersion: '2026-10-07.1', ...over,
});

const LEGACY = /\b(FREE|BASIC|PRO|LIFETIME|Basic|Pro|TRIAL|trial)\b|ניסיון|\d+\s*\/\s*\d+/;

describe('PlanIdentityBadge (server summary only)', () => {
  it.each([
    ['free', 'חינם', 'Free'], ['classic', 'קלאסיק', 'Classic'], ['modern', 'מודרן', 'Modern'], ['visual', 'ויזואל', 'Visual'],
  ])('canonical %s name in HE and EN', (planId, he, en) => {
    const { rerender, container } = render(<PlanIdentityBadge summary={ready(planId)} isHebrew variant="compact" />);
    expect(screen.getByText(he)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(LEGACY);
    rerender(<PlanIdentityBadge summary={ready(planId)} isHebrew={false} variant="compact" />);
    expect(screen.getByText(en)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(LEGACY);
  });

  it('Free shows the server balance, never a 0/5 counter', () => {
    const { rerender } = render(<PlanIdentityBadge summary={ready('free')} isHebrew variant="compact" />);
    expect(screen.getByTestId('plan-identity-detail').textContent).toBe('יתרה: 6 מתוך 10 הצעות');
    rerender(<PlanIdentityBadge summary={ready('free')} isHebrew={false} variant="compact" />);
    expect(screen.getByTestId('plan-identity-detail').textContent).toBe('6 of 10 free quotes left');
    rerender(<PlanIdentityBadge summary={ready('free')} isHebrew={false} variant="compact" singleLine />);
    expect(screen.getByText('6 left')).toBeInTheDocument();
  });

  it.each([
    [{ state: 'loading' }, 'טוען מסלול…', 'Loading plan…'],
    [{ state: 'not_activated' }, 'מסלולים: טרם הופעלו', 'Plans: not active yet'],
    [{ state: 'not_deployed' }, 'מסלולים: טרם הופעלו', 'Plans: not active yet'],
    [{ state: 'unprovisioned' }, 'החשבון טרם שויך למסלול', 'Account not assigned to a plan'],
    [{ state: 'unavailable' }, 'פרטי המסלול אינם זמינים', 'Plan details unavailable'],
    [{ state: 'invalid' }, 'פרטי המסלול אינם זמינים', 'Plan details unavailable'],
    [undefined, 'טוען מסלול…', 'Loading plan…'],
  ])('neutral / fail-closed state %#', (summary, he, en) => {
    const { rerender, container } = render(<PlanIdentityBadge summary={summary} isHebrew variant="compact" />);
    expect(screen.getByText(he)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/חינם|קלאסיק|מודרן|ויזואל/);
    expect(screen.queryByTestId('plan-identity-detail')).toBeNull();
    rerender(<PlanIdentityBadge summary={summary} isHebrew={false} variant="compact" />);
    expect(screen.getByText(en)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(LEGACY);
  });

  it('a forged summary (legacy plan id) renders the fail-closed state', () => {
    const forged = parseAccountSummary({ ok: true, schema: 'account-summary/v1', plan: { id: 'pro' } });
    render(<PlanIdentityBadge summary={forged} isHebrew={false} variant="compact" />);
    expect(screen.getByText('Plan details unavailable')).toBeInTheDocument();
  });

  it('shows the upgrade indicator only when upgradeAvailable is true', () => {
    const { container: a } = render(<PlanIdentityBadge summary={ready('free')} isHebrew={false} variant="compact" upgradeAvailable />);
    const { container: b } = render(<PlanIdentityBadge summary={ready('free')} isHebrew={false} variant="compact" />);
    expect(a.querySelectorAll('svg').length).toBe(b.querySelectorAll('svg').length + 1);
  });

  it('header and panel variants render the same model', () => {
    const { rerender } = render(<PlanIdentityBadge summary={ready('visual')} isHebrew variant="header" />);
    expect(screen.getByText('ויזואל')).toBeInTheDocument();
    rerender(<PlanIdentityBadge summary={{ state: 'not_deployed' }} isHebrew={false} variant="panel" />);
    expect(screen.getByText('Plans: not active yet')).toBeInTheDocument();
  });
});
