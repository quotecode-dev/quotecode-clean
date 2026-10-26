// Night task 2026-10-16 (Owner-approved doc 31eae0a7) - frontend findings of docs/MIGRATION_RETRO_AUDIT_2026-10-16.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { buildTemplateContent, templateToFormState, templateSummary, templatePriceBasis, clientTypeForPriceBasis, templateCurrencyUnknown, templateCurrencyMismatch } from './utils/quoteTemplates';
import { withPersistableQuantity, getActiveQuantity } from './utils/professionalQuoteItem';
import { draftLinesToQuoteItems } from './utils/aiQuoteDraftClient';
import { saveReminderSettings } from './utils/reminders';
import { quoteDisplayStatus, quoteDisplayLabel, matchesQuoteFilter, isQuoteAwaiting } from './utils/quoteStatusDisplay';
import { getQuoteStatusKey } from './utils/quoteListSort';
import { quoteAwaitsCustomer } from '../supabase/functions/_shared/reminderRules.js';

const read = (p) => readFileSync(join(cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('src/pages/Dashboard.jsx');
const form = (over = {}) => ({ items: [{ description: 'חלון', quantity: '2', unit_price: '1180' }], sections: [], currency: 'ILS', ...over });

describe('R-03: a template remembers whether its prices include VAT (L-09, Owner-approved)', () => {
  it('the basis comes from the Israeli client type only', () => {
    expect(templatePriceBasis(true, 'private')).toBe('incl_vat');
    expect(templatePriceBasis(true, 'business')).toBe('excl_vat');
    expect(templatePriceBasis(true, '')).toBeNull();
    expect(templatePriceBasis(false, 'private')).toBeNull();
    expect(clientTypeForPriceBasis('incl_vat')).toBe('private');
    expect(clientTypeForPriceBasis('excl_vat')).toBe('business');
    expect(clientTypeForPriceBasis(null)).toBeNull();
  });
  it('saved with priced lines, read back, shown in the summary; never without prices', () => {
    const c = buildTemplateContent(form({ priceBasis: 'incl_vat' }));
    expect(c.price_basis).toBe('incl_vat');
    expect(templateToFormState(c, () => 'k').priceBasis).toBe('incl_vat');
    expect(templateSummary(c).priceBasis).toBe('incl_vat');
    expect(buildTemplateContent(form({ priceBasis: 'incl_vat' }), { prices: false }).price_basis).toBeUndefined();
    expect(buildTemplateContent(form({ priceBasis: 'bogus' })).price_basis).toBeUndefined();
    expect(templateToFormState({ ...c, price_basis: 'bogus' }, () => 'k').priceBasis).toBeNull();
  });
  it('using a template sets the matching client type, or asks the user to check when the basis is unknown', () => {
    expect(dash).toContain('priceBasis: templatePriceBasis(isLocalIsraeliBusiness, clientType)');
    expect(dash).toContain('const templateClientType = clientTypeForPriceBasis(f.priceBasis);');
    expect(dash).toContain('if (templateClientType) setClientType(templateClientType);');
    expect(dash).toContain('בתבנית הזו עדיין לא נשמר מידע אם המחירים כוללים מע״מ.');
  });
  it('the template summary names the right basis', () => {
    const dlg = read('src/components/QuoteTemplateDialogs.jsx');
    expect(dlg).toContain("subtotalInclVat: 'סכום כולל מע״מ, לפני הנחה'");
    expect(dlg).toContain("s.priceBasis === 'incl_vat' ? C.subtotalInclVat : C.subtotal");
  });
});

describe('R-20: a template saved before it remembered its currency asks (L-09, Owner-approved)', () => {
  it('unknown currency + prices -> ask; a known currency keeps the existing mismatch check', () => {
    const old = templateToFormState({ schema: 'quote-template/v1', items: [{ description: 'x', quantity: 1, unit_price: 50 }] }, () => 'k');
    expect(old.currency).toBeNull();
    expect(templateCurrencyUnknown(old)).toBe(true);
    expect(templateCurrencyMismatch(old, 'EUR')).toBe(false);
    expect(templateCurrencyUnknown({ ...old, items: [{ description: 'x', quantity: '1', unit_price: '' }] })).toBe(false);
    expect(dash).toContain('} else if (templateCurrencyUnknown(f)) {');
  });
});

describe('R-05: a fractional quantity never fails the save', () => {
  it('2.5 hours is stored as quantity 1 + a manual calculated quantity of 2.5 - the same price', () => {
    const it0 = { description: 'עבודה', quantity: '2.5', unit_price: '200', pricing_unit: 'hour' };
    const p = withPersistableQuantity(it0);
    expect(p).toMatchObject({ quantity: '1', calculated_quantity: 2.5, quantity_source: 'manual', calculation_method: 'manual', pricing_unit: 'hour' });
    expect(getActiveQuantity(p) * Number(p.unit_price)).toBe(500);
  });
  it('a plain fractional count becomes a "unit" line with the same amount', () => {
    expect(withPersistableQuantity({ description: 'x', quantity: '1.5', unit_price: '10' })).toMatchObject({ quantity: '1', pricing_unit: 'unit', calculated_quantity: 1.5 });
  });
  it('integers and measured lines are untouched (a measured line keeps its calculated quantity)', () => {
    const i = { description: 'x', quantity: '3', unit_price: '10' };
    expect(withPersistableQuantity(i)).toBe(i);
    expect(withPersistableQuantity({ description: 'x', quantity: '1.4', calculated_quantity: 6, pricing_unit: 'm2' })).toMatchObject({ quantity: '1', calculated_quantity: 6 });
  });
  it('AI draft lines in hours / kg / units with decimals all become persistable integer quantities', () => {
    for (const unit of ['hour', 'kg', 'day', 'unit', undefined]) {
      const [row] = draftLinesToQuoteItems([{ description: 'x', quantity: 2.5, unit, unitPrice: 100 }]);
      const p = withPersistableQuantity(row);
      expect(Number.isInteger(Number(p.quantity)), String(unit)).toBe(true);
      expect(getActiveQuantity(p), String(unit)).toBe(2.5);
    }
  });
  it('the save goes through it', () => {
    expect(dash).toContain('let itemsForPersist = excludeUntouchedPlaceholderItems(items).map(withPersistableQuantity);');
  });
});

describe('R-06 / R-07 / R-08: one shown status, one awaiting rule', () => {
  const q = (status, view_count = 0, extra = {}) => ({ id: 'x', status, view_count, total: 100, quote_items: [{ description: 'a', quantity: 1, unit_price: 100 }], ...extra });
  it('the shown status', () => {
    expect(quoteDisplayStatus(q('draft', 0))).toBe('needs_sending');
    expect(quoteDisplayStatus(q('draft', 1))).toBe('sent_viewed');
    expect(quoteDisplayStatus(q('sent', 0))).toBe('sent_not_viewed');
    expect(quoteDisplayStatus(q('sent', 3))).toBe('hot');
    expect(quoteDisplayStatus(q('approved', 9))).toBe('approved');
    expect(quoteDisplayLabel('sent_viewed', true)).toBe('נשלחה · נצפתה');
    expect(quoteDisplayLabel('needs_sending', false)).toBe('Draft · ready to send'); // Owner 2026-10-26 (typed L-13 / L-14 / L-17)
  });
  it('the filter and the sort follow the shown status', () => {
    expect(matchesQuoteFilter(q('draft', 1), 'sent')).toBe(true);
    expect(matchesQuoteFilter(q('draft', 1), 'draft')).toBe(false);
    expect(matchesQuoteFilter(q('draft', 0), 'needs_sending')).toBe(true);
    expect(matchesQuoteFilter(q('sent', 4), 'hot')).toBe(true);
    expect(matchesQuoteFilter(q('paid'), 'All')).toBe(true);
    expect(getQuoteStatusKey(q('draft', 1))).toBe('sent');
  });
  it('awaiting is the same in the list, reminders and the calendar', () => {
    const viewedDraft = q('draft', 2);
    expect(isQuoteAwaiting(viewedDraft)).toBe(true);
    expect(quoteAwaitsCustomer(viewedDraft, () => false)).toBe(true);
    expect(quoteAwaitsCustomer(q('approved', 2), () => false)).toBe(false);
    expect(quoteAwaitsCustomer(q('sent'), () => true)).toBe(false); // expired
    expect(read('src/utils/calendarModel.js')).toContain('if (!q || !isAwaitingQuote(q)) continue;');
  });
  it('the cards, the old table and the client list show the shown status', () => {
    const tab = read('src/components/QuotesTab.jsx');
    expect(tab.match(/\{statusLabel\}\n\s*<\/span>/g)).toHaveLength(2);
    expect(read('src/components/ClientsTab.jsx')).toContain('const latestBadge = latestQuote ? statusBadgeFor(latestQuote, isHebrew) : null;');
  });
});

describe('R-09 / R-10 / R-12 / R-13 / R-19 / R-23 wiring', () => {
  it('R-09: the bell follows time and task writes', () => {
    const nc = read('src/components/NotificationCenter.jsx');
    expect(nc).toContain('const id = setInterval(() => setMinuteTick((n) => n + 1), 60000);');
    expect(nc).toContain('window.addEventListener(TASKS_CHANGED_EVENT, onChanged);');
    expect(read('src/utils/tasksClient.js').match(/return announced\(/g)).toHaveLength(5);
  });
  it('R-10: dashes and loading lines while the quotes load', () => {
    expect(read('src/components/StatisticsTab.jsx')).toContain("{notLoaded ? '—' : k.value}");
    expect(dash).toContain("{dataLoad.quotes !== 'ok' && quotes.length === 0 ? '—' : totalQuotesCount}");
    expect(dash.match(/quotesReady=\{dataLoad\.quotes === 'ok' \|\| quotes\.length > 0\}/g)).toHaveLength(2);
  });
  it('R-12 / R-13: an honest stuck screen with Try again (no reload) and Sign out', () => {
    expect(dash).toContain('if (attempt >= 5 && settingsGen === loadGenRef.current) setStartupStuck(true);');
    expect(dash).toContain('sleep: settingsRetrySleep,');
    expect(dash).toContain('onStartupRetry={retryStartupNow}');
    expect(dash).not.toMatch(/location\.reload\(/);
    expect(read('src/components/AuthScreen.jsx')).toContain('data-testid="startup-stuck"');
  });
  it('R-19: a server failure of the public quote is temporary (503), not "not found"', () => {
    expect(read('supabase/functions/get-public-quote/index.ts')).toContain("return jsonResponse({ error: 'temporarily_unavailable' }, 503);");
    expect(read('src/components/SmartPublicQuote.jsx')).toContain("setState({ status: status === 404 ? 'notfound' : 'unavailable', dto: null });");
  });
  it('R-23: Issue runs the form checks and never issues a quote with a missing price; the wizard takes the Edit-price rules', () => {
    expect(dash).toContain(`document.querySelector('form[data-quote-form="editor"]')`);
    expect(dash).toContain('if (missingPriceItems(items).length) {');
    expect(read('src/components/AddItemWizard.jsx')).toContain('const isWizardPriceValid = (v) => !/,/.test(String(v)) && parsePriceInput(v).ok');
  });
});

describe('R-26: saving the reminder settings never writes a false history line', () => {
  const fake = ({ updateRow, insertError = null }) => {
    const calls = [];
    const updateResult = () => ({ data: updateRow || calls.filter((c) => c === 'update').length > 1 ? { user_id: 'u1', mode: 'in_app' } : null, error: null });
    const updChain = () => ({ eq: () => updChain(), select: () => ({ maybeSingle: async () => updateResult(), single: async () => updateResult() }) });
    return {
      calls,
      from: () => ({
        update: () => { calls.push('update'); return updChain(); },
        insert: () => { calls.push('insert'); return { select: () => ({ single: async () => (insertError ? { data: null, error: insertError } : { data: { user_id: 'u1', mode: 'in_app' }, error: null }) }) }; },
      }),
    };
  };
  it('an existing row is UPDATEd (never an upsert that fires the INSERT trigger)', async () => {
    const c = fake({ updateRow: true });
    expect((await saveReminderSettings(c, 'u1', { mode: 'in_app' })).ok).toBe(true);
    expect(c.calls).toEqual(['update']);
  });
  it('no row -> INSERT; a row created meanwhile by another tab (23505) -> UPDATE', async () => {
    const a = fake({ updateRow: false });
    expect((await saveReminderSettings(a, 'u1', { mode: 'in_app' })).ok).toBe(true);
    expect(a.calls).toEqual(['update', 'insert']);
    const b = fake({ updateRow: false, insertError: { code: '23505', message: 'duplicate' } });
    expect((await saveReminderSettings(b, 'u1', { mode: 'in_app' })).ok).toBe(true);
    expect(b.calls).toEqual(['update', 'insert', 'update']);
  });
  it('the save has no upsert', () => {
    expect(read('src/utils/reminders.js')).not.toMatch(/from\('reminder_settings'\)\.upsert\(/);
  });
});

describe('Phase C: the admin overview counters (Owner default 5)', () => {
  it('signed in in the last 10 minutes (last_sign_in), Israel, International - market from the stored country', () => {
    const o = read('src/components/AdminOverview.jsx');
    // Owner console 2026-10-16, typed: "מאשר מימוש אפיון האדמין של קודקס (CODEX_SPEC_ADMIN_REDESIGN_2026-10-16) ... ופתיחת L-03 L-07 L-17 L-20
    // לשינויים שבאפיון" - spec §4.1: the counters come from the server summary;
    // the loaded-rows fallback keeps the same rule (last_sign_in within 10 minutes, market from the stored country)
    expect(o).toContain('signed10m: users.filter((a) => recentMs(a.last_sign_in)).length,');
    expect(o).toContain('signed10m: s.signedInLast10m');
    expect(o).toContain("resolveAdminMarket(a).market === 'Local'");
    expect(o).toContain("resolveAdminMarket(a).market === 'International'");
  });
});
