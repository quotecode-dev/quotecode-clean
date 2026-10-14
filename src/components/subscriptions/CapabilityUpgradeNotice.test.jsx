// OD-17: one accessible upgrade notice; explains locally, names the current canonical plan, lists only server-approved
// eligible plans, offers the plans view, and never mutates anything (close is a no-op).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CapabilityUpgradeNotice from './CapabilityUpgradeNotice';
import { capabilityNoticeCopy } from '../../domain/subscriptions/capabilityNoticeCopy';
import { parseAccountSummary, CAPABILITY_IDS } from '../../../supabase/functions/_shared/subscriptionContract.ts';

const freeSummary = (eligiblePlans = {}) => parseAccountSummary({
  ok: true, schema: 'account-summary/v1', version: 2, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' },
  market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans,
  free10: { limit: 10, consumed: 0, reserved: 0, remaining: 10 }, catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
  priceCatalogVersion: '2026-10-07.1',
});

describe('CapabilityUpgradeNotice', () => {
  it('renders nothing without a capability', () => {
    const { container } = render(<CapabilityUpgradeNotice lang="he" capabilityId={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('dialog: title, current canonical plan, "not decided" eligibility, upgrade + close; focus on the heading', () => {
    const onUpgrade = vi.fn();
    const onClose = vi.fn();
    render(<CapabilityUpgradeNotice lang="he" capabilityId="catalog_product_image.upload" summary={freeSummary()} onUpgrade={onUpgrade} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { name: /תמונות מוצר בקטלוג אינו כלול במסלול הנוכחי/ })).toHaveFocus();
    expect(screen.getByTestId('cap-notice-current-plan').textContent).toBe('המסלול הנוכחי: חינם');
    expect(screen.getByTestId('cap-notice-eligible').textContent).toBe('המסלולים שיכללו יכולת זו טרם נקבעו.');
    fireEvent.click(screen.getByTestId('cap-notice-upgrade'));
    expect(onUpgrade).toHaveBeenCalledWith('catalog_product_image.upload');
    fireEvent.click(screen.getByTestId('cap-notice-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes; backdrop click closes; clicking inside does not', () => {
    const onClose = vi.fn();
    render(<CapabilityUpgradeNotice lang="en" capabilityId="quote.edit_duplicate" summary={{ state: 'not_deployed' }} onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByTestId('cap-notice-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('lists eligible plans only when the server provides an approved list', () => {
    render(<CapabilityUpgradeNotice lang="en" capabilityId="quote_style.modern" summary={freeSummary({ 'quote_style.modern': ['modern', 'visual'] })} onClose={() => {}} />);
    expect(screen.getByTestId('cap-notice-eligible').textContent).toBe('Included in: Modern, Visual');
  });

  it('neutral account states never invent a plan', () => {
    for (const state of ['loading', 'not_activated', 'not_deployed', 'unprovisioned', 'unavailable']) {
      const c = capabilityNoticeCopy('en', 'quote.whatsapp_delete', { state });
      expect(c.currentPlan).not.toMatch(/Free|Classic|Modern|Visual|Basic|Pro|trial/);
    }
  });

  it('copy for every capability is free of legacy plan names, trials, quotas and unlimited claims', () => {
    for (const id of CAPABILITY_IDS) {
      for (const lang of ['he', 'en']) {
        const c = capabilityNoticeCopy(lang, id, freeSummary());
        expect(Object.values(c).join(' ')).not.toMatch(/\b(Basic|Pro|BASIC|PRO|trial|unlimited)\b|ניסיון|ללא הגבלה|בסיסי|\d+\s*\/\s*\d+/);
      }
    }
  });

  it('inline variant is a labelled region and calls no callback by itself', () => {
    const onUpgrade = vi.fn();
    const onClose = vi.fn();
    render(<CapabilityUpgradeNotice lang="en" variant="inline" capabilityId="quote_style.visual" summary={{ state: 'not_deployed' }} onUpgrade={onUpgrade} onClose={onClose} />);
    expect(screen.getByRole('region', { name: /Visual style is not included/ })).toBeInTheDocument();
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
