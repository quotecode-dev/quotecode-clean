// Codex review 2026-11-09 (docs/CODEX_REVIEW_LIVE_D1_2026-11-09.md), Owner typed: "מאשר תיקון ממצאי קודקס 1-5 כולל L-05, L-13, L-17, L-24,
// L-25, L-26, L-27, L-28 ושחרור ללייב" + "מאשר שינוי גם ב-L-09, L-15, L-22, L-23 לתיקון ממצאי קודקס 1-5".
//   2. a whole-quote template keeps "units" vs "fixed amount" like a unit template;
//   3. a smart edit that explicitly changes a measured row to units makes a units row (no sizes left, marked units);
//   4. a business client's Tax ID of spaces only is missing too, and the saved Tax ID is trimmed;
//   5. the admin counter says "unavailable" when its state is unknown, "not activated" only when the server said so.
// (1. the version-less signing routes: scripts/db-test/tests/474_signing_requires_version.sql + publicApprovalDecision.task39.test.ts)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';

const rpcState = vi.hoisted(() => ({ reply: {} }));
vi.mock('./shared/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn, args) => { const r = rpcState.reply[fn]; return r ? r(args) : { data: null, error: { code: 'PGRST202' }, status: 404 }; }),
    from: () => ({ select: () => ({ eq: async () => ({ count: 0, error: null }) }) }),
  },
}));

import { buildTemplateContent, templateToFormState } from './utils/quoteTemplates';
import { applyDraftUpdateToItem } from './utils/aiQuoteDraftClient';
import { rowEntry, storedBillingMethod } from './utils/quoteItemEntry';
import { parseDashboardSummary } from './domain/admin/adminAccountsClient';
import AdminPlans from './components/AdminPlans';

const read = (p) => readFileSync(p, 'utf8').split(String.fromCharCode(13)).join('');
beforeEach(() => { rpcState.reply = {}; });
afterEach(cleanup);

describe('2 · a whole-quote template keeps units vs a fixed amount', () => {
  const form = {
    items: [
      { description: 'Visit', quantity: '1', unit_price: '100', _billing: 'units' },
      { description: 'Flat fee', quantity: '1', unit_price: '100', _billing: 'fixed' },
      { description: 'Paint', quantity: '1', unit_price: '50', pricing_unit: 'm2', calculated_quantity: 6, quantity_source: 'manual', calculation_method: 'manual' },
    ],
    sections: [], quoteStructureMode: null,
  };
  const billing = (it) => rowEntry(it, false).pricingMethod;
  it('saving stores the choice of each plain row (and nothing for a measured row)', () => {
    const c = buildTemplateContent(form, undefined, billing);
    expect(c.items.map((it) => it.billing)).toEqual(['units', 'fixed', undefined]);
  });
  it('opening the template gives the rows the same choice back - one unit reopens as units', () => {
    const f = templateToFormState(buildTemplateContent(form, undefined, billing), () => 'k1');
    expect(f.items.map((it) => it._billing)).toEqual(['units', 'fixed', undefined]);
    expect(rowEntry(f.items[0], false).pricingMethod).toBe('units');
    expect(rowEntry(f.items[1], false).pricingMethod).toBe('fixed');
    expect(storedBillingMethod(f.items[0])).toBe('units');
  });
  it('an older template (no billing kept) opens exactly as before', () => {
    const f = templateToFormState(buildTemplateContent(form), () => 'k1');
    expect(f.items.map((it) => it._billing)).toEqual([undefined, undefined, undefined]);
  });
  it('the save dialog passes the screen billing for a whole quote too, and saves the content it shows', () => {
    const d = read('src/components/QuoteTemplateDialogs.jsx');
    expect(d).toContain('buildTemplateContent(form, keep, rowBilling)');
    expect(d).toContain('createTemplate(client, userId, name, form, keep, built)');
    expect(read('src/pages/Dashboard.jsx')).toContain('rowBilling={(it) => rowEntry(it, isLocalIsraeliBusiness === false).pricingMethod} onClose={() => setTemplateDialog(null)} />');
  });
});

describe('3 · smart edit: an explicit change to units makes a units row', () => {
  const area = { id: 'r1', description: 'Wall', quantity: '1', unit_price: '40', pricing_unit: 'm2', calculated_quantity: 6, quantity_source: 'calculated',
    calculation_method: 'area', measurements: [{ width: 2, height: 3, unit: 'm' }] };
  it('area -> 1 unit: no unit, no sizes, marked units, and it opens as units (not as a fixed amount)', () => {
    const next = applyDraftUpdateToItem(area, { unit: 'unit', quantity: 1 });
    expect(next.pricing_unit).toBeUndefined();
    expect(next.measurements).toBeUndefined();
    expect(next._billing).toBe('units');
    expect(storedBillingMethod(next)).toBe('units');
    expect(rowEntry(next, false).pricingMethod).toBe('units');
    expect(next.unit_price).toBe('40');
  });
  it('a change that keeps the basis keeps the row\'s own choice', () => {
    const fixed = { id: 'r2', description: 'Flat', quantity: '1', unit_price: '100', _billing: 'fixed' };
    expect(applyDraftUpdateToItem(fixed, { unitPrice: 120 })._billing).toBe('fixed');
    expect(rowEntry(applyDraftUpdateToItem(fixed, { unitPrice: 120 }), false).pricingMethod).toBe('fixed');
  });
});

describe('4 · a Tax ID of spaces only is missing too', () => {
  it('the business Tax ID field also needs a non-space character (the same message and focus as an empty field)', () => {
    const f = read('src/components/QuoteForm.jsx');
    expect(f).toContain('const TAX_ID_NOT_BLANK = String.raw`.*\\S.*`;');
    expect(f).toContain('pattern={taxIdRequired ? TAX_ID_NOT_BLANK : undefined}'); // Owner 2026-11-11 (finding 5): required in the Israeli market only
    expect(new RegExp(`^(?:${String.raw`.*\S.*`})$`).test('   ')).toBe(false);
    expect(new RegExp(`^(?:${String.raw`.*\S.*`})$`).test(' 51-234567-8 ')).toBe(true);
  });
  it('the saved Tax ID is trimmed (like the email)', () => {
    expect(read('src/pages/Dashboard.jsx')).toContain("tax_id: typeof clientTaxId === 'string' ? clientTaxId.trim() : clientTaxId,");
  });
});

describe('5 · the admin counter: unknown is "unavailable", never "not activated"', () => {
  const summary = (o = {}) => ({
    schema: 'admin-dashboard-summary/v1', generatedAt: '2026-11-09T08:00:00Z', managedAccounts: 1, registrationsLast24h: 0, signedInLast10m: 0,
    market: { Local: 1, International: 0, Unknown: 0 }, planSystem: 'active', testAccounts: 0,
    subscriptionStatus: { lifetime: 1, paid_annual: 0, paid_monthly: 0, paid_unverified: 0, free10: 0, trial: 0, trial_ended: 0, free10_inactive: 0, paid_past_due: 0, paid_limited: 0 },
    ...o,
  });
  it('the parser keeps only what the server said', () => {
    expect(parseDashboardSummary(summary({ free10Counter: 'enforced' })).free10Counter).toBe('enforced');
    expect(parseDashboardSummary(summary({ free10Counter: 'not_enforced' })).free10Counter).toBe('not_enforced');
    expect(parseDashboardSummary(summary()).free10Counter).toBe(null);
  });
  it.each([[true, 'מצב המונה לא זמין כרגע', 'טרם הופעל'], [false, 'Counter status unavailable', 'Not activated']])('isHebrew=%s: a failed summary shows "unavailable"', async (he, unavailable, notActivated) => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: null, error: { message: 'boom', code: '500' }, status: 500 });
    render(<AdminPlans accounts={[]} isHebrew={he} />);
    expect(await screen.findByText(unavailable)).toBeInTheDocument();
    expect(screen.queryByText(notActivated)).toBeNull();
  });
  it.each([[true, 'טרם הופעל'], [false, 'Not activated']])('isHebrew=%s: "not activated" when the server reported it', async (he, notActivated) => {
    rpcState.reply.get_admin_dashboard_summary = () => ({ data: summary({ free10Counter: 'not_enforced' }), error: null });
    render(<AdminPlans accounts={[]} isHebrew={he} />);
    expect(await screen.findByText(notActivated)).toBeInTheDocument();
  });
});
