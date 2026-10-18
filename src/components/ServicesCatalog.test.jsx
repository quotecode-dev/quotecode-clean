// OD-18 (catalog product image gate) + OD-19 (compact catalog layout) - ServicesCatalog component tests.
// The image action is gated by the ONE shared decision rule (decideCapability); a locked action stays visible and focusable,
// asks the parent to open CapabilityUpgradeNotice, and never opens image controls / a file picker / an upload or link call.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const client = vi.hoisted(() => ({
  fetchPresentationContext: vi.fn(), setDefaultStyle: vi.fn(), uploadPresentationMedia: vi.fn(), fetchMediaUrls: vi.fn(),
  fetchQuotePresentation: vi.fn(), saveQuotePresentation: vi.fn(), issueQuotePresentation: vi.fn(), linkCatalogMedia: vi.fn(),
}));
vi.mock('../utils/quotePresentationClient', () => client);
vi.mock('../shared/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

import ServicesCatalog from './ServicesCatalog';
import { presentationCopy } from './quotePresentation/presentationCopy';
import { parseAccountSummary } from '../../supabase/functions/_shared/subscriptionContract.ts';
import { formatMoneyForCurrency } from '../utils/money';

const CAP = 'catalog_product_image.upload';
const raw = (overrides = {}) => ({
  ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'off', catalog: 'off', billing: 'off' }, market: 'IL',
  plan: { id: 'classic' }, subscriptionStatus: 'active', capabilities: ['quote_style.classic'], eligiblePlans: {}, free10: null,
  catalog: { active: 2, countDefinition: 'unset', limit: 100, blocks: 0, limitDecided: true }, priceCatalogVersion: null, ...overrides,
});
const FREE_READY = parseAccountSummary(raw({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' }, plan: { id: 'free' }, subscriptionStatus: 'none', free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 }, catalog: { active: 2, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false } }));
const NOT_ACTIVATED = parseAccountSummary({ ok: false, code: 'not_activated' });
const UNPROVISIONED = parseAccountSummary({ ok: false, code: 'account_not_provisioned' });
const PAID_ENFORCED_WITH = parseAccountSummary(raw({ phase: { output: 'enforced', catalog: 'enforced', billing: 'off' }, capabilities: ['quote_style.classic', CAP] }));
const PAID_ENFORCED_WITHOUT = parseAccountSummary(raw({ phase: { output: 'enforced', catalog: 'enforced', billing: 'off' } }));
const LEGACY_TRUE = { [CAP]: true };

function controller() {
  return {
    copy: presentationCopy('en'), lang: 'en',
    context: { status: 'ready', catalog: {} }, urls: {},
    ensureUrls: vi.fn(), setCatalogLink: vi.fn(),
  };
}

const t = { serviceName: 'Name', defaultPrice: 'Default price', description: 'Description', actions: 'Actions' };
const services = [{ id: 's1', name: 'Glass panel', price: 191.16 }, { id: 's2', name: 'Frame', price: 100.5 }];
function props(over = {}) {
  const isHebrew = over.isHebrew ?? false;
  return {
    t, isHebrew, newServiceName: '', setNewServiceName: vi.fn(), newServicePrice: '', setNewServicePrice: vi.fn(), handleAddService: vi.fn(),
    services, editingServiceId: null, setEditingServiceId: vi.fn(), editServiceName: '', setEditServiceName: vi.fn(), editServicePrice: '', setEditServicePrice: vi.fn(),
    handleSaveEditedService: vi.fn(), handleDeleteService: vi.fn(), sym: isHebrew ? '₪' : '$',
    formatMoneyDisplay: (v) => formatMoneyForCurrency(v, isHebrew ? 'ILS' : 'USD'),
    presentationController: controller(),
    ...over,
  };
}

beforeEach(() => { Object.values(client).forEach((f) => f.mockReset()); });
afterEach(cleanup);

function expectNoMutation(p) {
  expect(screen.queryByTestId('qp-catalog-media-s1')).toBeNull();
  expect(document.querySelector('input[type="file"]')).toBeNull();
  expect(client.uploadPresentationMedia).not.toHaveBeenCalled();
  expect(client.linkCatalogMedia).not.toHaveBeenCalled();
  expect(p.presentationController.setCatalogLink).not.toHaveBeenCalled();
  expect(p.presentationController.ensureUrls).not.toHaveBeenCalled();
}

describe('OD-18 catalog product image gate', () => {
  const lockedCases = [
    ['ready Free summary (even when legacyCapabilities says true)', FREE_READY, LEGACY_TRUE],
    ['unprovisioned account', UNPROVISIONED, LEGACY_TRUE],
    ['ready paid, enforced, capability not granted', PAID_ENFORCED_WITHOUT, LEGACY_TRUE],
    ['no summary and no explicit legacy capability (fail closed)', undefined, undefined],
  ];
  for (const [name, summary, legacy] of lockedCases) {
    it(`locked: ${name} -> click / Enter / Space call onLockedCapability, never open controls, file picker, upload or link`, () => {
      const onLockedCapability = vi.fn();
      const p = props({ accountSummary: summary, legacyCapabilities: legacy, onLockedCapability });
      render(<ServicesCatalog {...p} />);
      const btn = screen.getByTestId('catalog-image-toggle-s1');
      // visible + focusable, named with the product
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute('tabindex')).toBeNull();
      expect(btn.getAttribute('aria-label')).toContain('Glass panel');
      expect(btn.getAttribute('aria-label')).toContain('not included');
      expect(btn.getAttribute('data-locked')).toBe('true');
      btn.focus();
      expect(document.activeElement).toBe(btn);

      fireEvent.click(btn, { detail: 1 });
      expect(onLockedCapability).toHaveBeenCalledTimes(1);
      expect(onLockedCapability).toHaveBeenLastCalledWith(CAP);
      expectNoMutation(p);

      fireEvent.keyDown(btn, { key: 'Enter' });
      expect(onLockedCapability).toHaveBeenCalledTimes(2);
      fireEvent.keyDown(btn, { key: ' ' });
      expect(onLockedCapability).toHaveBeenCalledTimes(3);
      // a keyboard-synthesized click right after a handled key press is not a second activation
      fireEvent.click(btn, { detail: 0 });
      expect(onLockedCapability).toHaveBeenCalledTimes(3);
      expectNoMutation(p);
      expect(btn.getAttribute('aria-expanded')).toBeNull();
    });
  }

  it('locked without a parent notice handler: the action stays visible and shows a local accessible message (no mutation)', () => {
    const p = props({ accountSummary: FREE_READY, legacyCapabilities: LEGACY_TRUE });
    render(<ServicesCatalog {...p} />);
    fireEvent.click(screen.getByTestId('catalog-image-toggle-s1'), { detail: 1 });
    const msg = screen.getByTestId('catalog-image-locked-s1');
    expect(msg.getAttribute('role')).toBe('status');
    expect(msg.textContent).toContain('Catalog product images');
    expectNoMutation(p);
  });

  const allowedCases = [
    ['summary not_activated + legacy true (legacy behavior kept)', NOT_ACTIVATED, LEGACY_TRUE],
    ['summary loading/undefined + legacy true', undefined, LEGACY_TRUE],
    ['ready paid, enforced, capability granted by the server', PAID_ENFORCED_WITH, undefined],
  ];
  for (const [name, summary, legacy] of allowedCases) {
    it(`allowed: ${name} -> the image controls open as before`, () => {
      const onLockedCapability = vi.fn();
      const p = props({ accountSummary: summary, legacyCapabilities: legacy, onLockedCapability });
      render(<ServicesCatalog {...p} />);
      const btn = screen.getByTestId('catalog-image-toggle-s1');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.getAttribute('aria-label')).toBe('Image for Glass panel');
      fireEvent.click(btn, { detail: 1 });
      expect(screen.getByTestId('qp-catalog-media-s1')).toBeTruthy();
      expect(screen.getByTestId('qp-catalog-attach-s1')).toBeTruthy();
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      expect(onLockedCapability).not.toHaveBeenCalled();
      fireEvent.keyDown(btn, { key: 'Enter' });
      expect(screen.queryByTestId('qp-catalog-media-s1')).toBeNull();
    });
  }

  it('no presentation controller -> no image action at all (unchanged Task 16 rule)', () => {
    render(<ServicesCatalog {...props({ presentationController: null, accountSummary: FREE_READY })} />);
    expect(screen.queryByTestId('catalog-image-toggle-s1')).toBeNull();
  });
});

describe('OD-19 compact catalog layout + unchanged behavior', () => {
  for (const isHebrew of [true, false]) {
    it(`${isHebrew ? 'HE/RTL' : 'EN/LTR'}: grid rows (description | price | ONE actions area), named 44px actions, logical tab order, canonical money`, () => {
      const p = props({ isHebrew, accountSummary: NOT_ACTIVATED, legacyCapabilities: LEGACY_TRUE });
      const { container } = render(<ServicesCatalog {...p} />);
      const list = screen.getByTestId('catalog-list');
      expect(list.getAttribute('dir')).toBe(isHebrew ? 'rtl' : 'ltr');
      expect(container.querySelector('.svc-cat-head').getAttribute('aria-hidden')).toBe('true');
      const row = screen.getByTestId('catalog-row-s1');
      const grid = row.querySelector('.svc-cat-grid.svc-cat-row');
      expect([...grid.children].map((c) => c.className)).toEqual(['svc-cat-desc', 'svc-cat-price', 'svc-cat-actions']);
      const actions = within(grid.querySelector('.svc-cat-actions')).getAllByRole('button');
      expect(actions.map((b) => b.getAttribute('data-testid'))).toEqual(['catalog-edit-s1', 'catalog-delete-s1', 'catalog-image-toggle-s1']);
      for (const b of actions) {
        expect(b.className).toMatch(/\bsvc-cat-btn\b/);
        expect(b.getAttribute('aria-label')).toContain('Glass panel');
        expect(b.getAttribute('type')).toBe('button');
      }
      expect(grid.querySelector('.svc-cat-actions').getAttribute('role')).toBe('group');
      const price = screen.getByTestId('catalog-price-s1');
      expect(price.className).toBe('svc-cat-money');
      expect(price.textContent).toBe(isHebrew ? '₪191.00' : '$191.16');
      expect(screen.getByTestId('catalog-price-s2').textContent).toBe(isHebrew ? '₪101.00' : '$100.50');
      // no tiny split actions (the replaced 0.65rem / 3px buttons)
      expect(container.innerHTML).not.toMatch(/0\.65rem|padding: 3px 6px/);
    });
  }

  it('edit / save / cancel / delete call the same handlers as before', () => {
    const p = props({ accountSummary: NOT_ACTIVATED, legacyCapabilities: LEGACY_TRUE });
    const { rerender } = render(<ServicesCatalog {...p} />);
    fireEvent.click(screen.getByTestId('catalog-edit-s1'));
    expect(p.setEditingServiceId).toHaveBeenCalledWith('s1');
    expect(p.setEditServiceName).toHaveBeenCalledWith('Glass panel');
    expect(p.setEditServicePrice).toHaveBeenCalledWith(191.16);
    fireEvent.click(screen.getByTestId('catalog-delete-s2'));
    expect(p.handleDeleteService).toHaveBeenCalledWith('s2', 'Frame');
    rerender(<ServicesCatalog {...p} editingServiceId="s1" editServiceName="Glass panel" editServicePrice="191.16" />);
    const row = screen.getByTestId('catalog-row-s1');
    expect(within(row).getByRole('textbox', { name: 'Name' }).value).toBe('Glass panel');
    expect(within(row).getByRole('spinbutton', { name: 'Default price' }).value).toBe('191.16');
    fireEvent.click(within(row).getByRole('button', { name: 'Save Glass panel' }));
    expect(p.handleSaveEditedService).toHaveBeenCalledWith('s1');
    fireEvent.click(within(row).getByRole('button', { name: 'Cancel editing Glass panel' }));
    expect(p.setEditingServiceId).toHaveBeenLastCalledWith(null);
  });

  it('search filters by name client-side; add form submits through handleAddService and closes', () => {
    const p = props({ accountSummary: NOT_ACTIVATED, legacyCapabilities: LEGACY_TRUE });
    render(<ServicesCatalog {...p} />);
    fireEvent.change(screen.getByPlaceholderText('Search catalog...'), { target: { value: 'fra' } });
    expect(screen.queryByTestId('catalog-row-s1')).toBeNull();
    expect(screen.getByTestId('catalog-row-s2')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Search catalog...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No catalog items match your search.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    fireEvent.submit(screen.getByPlaceholderText('Name').closest('form'));
    expect(p.handleAddService).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText('Name')).toBeNull();
  });

  it('the scoped stylesheet fixes a deterministic grid: explicit tracks, min-width:0, 44px targets, focus ring, tabular numerals, narrow breakpoint', () => {
    const css = readFileSync(join(cwd(), 'src', 'components', 'servicesCatalog.css'), 'utf8');
    // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי עכשיו!!!!!!", #14): the row buttons carry their words again, so the actions
    // column sizes to its content
    expect(css).toMatch(/\.svc-cat-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\) 9\.5rem max-content;[^}]*min-width: 0;/);
    expect(css).toMatch(/@container svccat \(max-width: 559\.98px\) \{\s*\.svc-cat-grid \{\s*grid-template-columns: minmax\(0, 1fr\) 8\.5rem;\s*grid-template-areas: "desc price" "actions actions";/);
    expect(css).toMatch(/\.svc-cat-btn \{[^}]*width: 44px;[^}]*height: 44px;[^}]*min-width: 44px;[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.svc-cat-btn:focus-visible \{ outline: 3px solid/);
    expect(css).toMatch(/\.svc-cat-money \{[^}]*font-variant-numeric: tabular-nums[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.svc-cat-price \{[^}]*text-align: end;/);
    expect(css).not.toMatch(/overflow-x|text-overflow: ellipsis/);
  });
});
