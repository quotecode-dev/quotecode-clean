// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-05: יכולות חכם פלוס נחסמות ברגע הלחיצה למי שאין לו חכם פלוס"; "ב: חיוב יחסי עכשיו"):
// SMART PACK features are blocked at the click (the notice with the plans button; nothing opens), and an active subscriber adds SMART
// PACK with the server's pro-rata amount.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAccountSummary } from '../supabase/functions/_shared/subscriptionContract.ts';
import { capabilityNoticeCopy } from './domain/subscriptions/capabilityNoticeCopy';
import CapabilityUpgradeNotice from './components/subscriptions/CapabilityUpgradeNotice';
import SmartPackAddOnOffer from './components/SmartPackAddOnOffer';
import { billingReturnFromSearch, billingReturnState, billingReturnText, loadSmartPackAddOnQuote, smartPackAddOnAvailable,
  smartPackAddOnErrorMessage, startSmartPackAddOn } from './domain/subscriptions/packageCheckout';

afterEach(cleanup);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const summary = (over = {}) => parseAccountSummary({ ok: true, schema: 'account-summary/v1', version: 1,
  phase: { output: 'enforced', catalog: 'prepared', billing: 'enforced' }, market: 'IL', plan: { id: 'all_inclusive' }, subscriptionStatus: 'active',
  capabilities: ['quote_style.classic', 'quote_attachment.upload'], eligiblePlans: {}, free10: null,
  catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false }, priceCatalogVersion: null,
  smartPack: { active: false, source: null, until: null }, ...over });

describe('the SMART PACK notice', () => {
  it('says what SMART PACK is, its Israeli price and where to add it; nothing changed, nothing charged', () => {
    const c = capabilityNoticeCopy('he', 'smart_pack', summary());
    expect(c.title).toBe('האפשרות הזו כלולה בחכם פלוס');
    expect(c.explanation).toMatch(/צ׳אט קולי, הצעה חכמה עם AI והכתבה בקול, וקבצים מצורפים להצעה\. אפשר להוסיף אותו בחלון המסלולים\.$/);
    expect(c.eligible).toBe('המחיר: ₪10.00 לחודש, או ₪102.00 לשנה במנוי שנתי.');
    // the promise only while the plans window can sell it (purchasing off = no promise, no price)
    const off = capabilityNoticeCopy('he', 'smart_pack', summary({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } }));
    expect(off.explanation).not.toMatch(/חלון המסלולים/);
    expect(off.eligible).toBe('');
    expect(c.unchanged).toBe('לא בוצע שום שינוי ולא בוצע חיוב.');
    expect(capabilityNoticeCopy('en', 'smart_pack', summary({ market: 'INTERNATIONAL' }))).toMatchObject({
      title: 'This is part of SMART PACK', eligible: '' });
    expect(capabilityNoticeCopy('en', 'smart_pack', summary({ market: 'INTERNATIONAL' })).explanation).toMatch(/cannot be purchased yet for accounts outside Israel\.$/);
  });
  it('renders as the one capability dialog with the plans button', () => {
    const onUpgrade = vi.fn();
    render(<CapabilityUpgradeNotice lang="he" capabilityId="smart_pack" summary={summary()} onUpgrade={onUpgrade} onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-capability', 'smart_pack');
    fireEvent.click(screen.getByTestId('cap-notice-upgrade'));
    expect(onUpgrade).toHaveBeenCalledWith('smart_pack');
  });
});

describe('blocked at the click (source guards)', () => {
  it('the smart quote: checked before any form or dialog opens', () => {
    const dash = read('src/pages/Dashboard.jsx');
    expect(dash).toMatch(/const handleCreateAiQuoteClick = \(\) => \{\n(?: {4}\/\/[^\n]*\n)* {4}if \(!smartPackAllowed\) \{ if \(!free10Blocked\(\)\) setLockedCapability\('smart_pack'\); return; \}\n {4}if \(handleCreateNewQuoteClick\('ai'\) === false\) return;/);
    // the chat's "smart quote" link takes the click-time decision too (never a stale one)
    expect(dash).toMatch(/case 'open_ai_quote':\n {10}closeEditor\(\);\n {10}setActiveTab\('main'\);\n {10}handleCreateAiQuoteClickRef\.current\?\.\(\);/);
    // a save with new files and no SMART PACK writes nothing and shows the notice
    expect(dash).toMatch(/if \(!smartPackAllowed && quoteFiles\.some\(\(f\) => !f\.id\)\) \{ setLockedCapability\('smart_pack'\); return; \}/);
    expect(read('src/pages/Dashboard.jsx')).toMatch(/const smartPackAllowed = isLifetimeAccount \|\| decideSmartPack\(accountSummary\)\.allowed;/);
  });
  it('attachments: the notice instead of the file picker', () => {
    expect(read('src/components/QuoteForm.jsx')).toMatch(/\} else if \(!smartPackAllowed\) \{\n {6}setShowUpgradeConfirm\('smart_pack'\);[^\n]*\n {4}\} else \{\n {6}const fileInput = document\.createElement\('input'\);/);
    expect(read('src/pages/Dashboard.jsx')).toMatch(/canUseAttachments=\{canUseCapability\('quote_attachment\.upload'\)\}\n {14}smartPackAllowed=\{smartPackAllowed\}/);
  });
  it('voice chat: the microphone and a spoken answer mode never open without SMART PACK - the note with the plans button', () => {
    const src = read('src/AIChatWidget.jsx');
    expect(src).toMatch(/if \(!voiceEnabled \|\| recording \|\| transcribing \|\| loading\) return;\n {4}if \(smartPackLocked\) \{ addSmartPackNote\(\); return; \}\n {4}stopPlayback\(\);\n {4}let stream;/);
    expect(src).toMatch(/if \(mode !== 'text' && smartPackLocked\) \{ setVoiceMenuOpen\(false\); addSmartPackNote\(\); return; \}/);
    expect(src).toMatch(/const smartPackLocked = Boolean\(isDashboard\) && decideSmartPack\(accountSummary\)\.allowed === false;/);
    expect(src).toMatch(/data-testid="ai-chat-smart-pack-plans" onClick=\{\(\) => \{ setIsOpen\(false\); openPlans\(\); \}\}/);
  });
});

describe('SMART PACK for an active subscriber', () => {
  it('offered only to a live Israeli package without SMART PACK (server summary), never LIFETIME', () => {
    expect(smartPackAddOnAvailable(summary())).toBe(true);
    expect(smartPackAddOnAvailable(summary(), true)).toBe(false);
    expect(smartPackAddOnAvailable(summary({ smartPack: { active: true, source: 'add_on', until: null } }))).toBe(false);
    expect(smartPackAddOnAvailable(summary({ market: 'INTERNATIONAL' }))).toBe(false);
    expect(smartPackAddOnAvailable(summary({ plan: { id: 'free' }, subscriptionStatus: 'none', free10: { limit: 10, consumed: 0, reserved: 0, remaining: 10 } }))).toBe(false);
    expect(smartPackAddOnAvailable(summary({ phase: { output: 'enforced', catalog: 'prepared', billing: 'off' } }))).toBe(false);
  });
  it('the quote and the page are asked from the server; the browser sends no amount', async () => {
    const invoke = vi.fn(async (_fn, { body }) => ({ data: body.action === 'smart_pack_add_on_quote'
      ? { ok: true, currency: 'ILS', amountMinor: 667, recurringMinor: 1000, period: 'month', periodEnd: '2026-11-20T10:00:00.000Z' }
      : { ok: true, redirectUrl: 'https://payments.payplus.co.il/x' } }));
    expect(await loadSmartPackAddOnQuote({ invoke })).toEqual({ ok: true, amountMinor: 667, recurringMinor: 1000, period: 'month', periodEnd: '2026-11-20T10:00:00.000Z' });
    expect(await startSmartPackAddOn({ invoke, key: 'pkg_' + 'k'.repeat(32) })).toEqual({ ok: true, redirectUrl: 'https://payments.payplus.co.il/x' });
    expect(invoke.mock.calls[1][1]).toEqual({ body: { action: 'smart_pack_add_on_intent', idempotencyKey: 'pkg_' + 'k'.repeat(32) } });
    expect(smartPackAddOnErrorMessage('already_included', true)).toBe('חכם פלוס כבר פעיל בחשבון. לא בוצע חיוב.');
  });
  it('the offer shows the server amounts and leaves for the server page', async () => {
    const onLeave = vi.fn();
    const invoke = vi.fn(async (_fn, { body }) => ({ data: body.action === 'smart_pack_add_on_quote'
      ? { ok: true, currency: 'ILS', amountMinor: 700, recurringMinor: 1000, period: 'month', periodEnd: '2026-11-20T10:00:00.000Z' }
      : { ok: true, redirectUrl: 'https://payments.payplus.co.il/x' } }));
    render(<SmartPackAddOnOffer isHebrew invoke={invoke} onLeave={onLeave} />);
    await waitFor(() => expect(screen.getByTestId('plans-smart-pack-add-on')).toBeInTheDocument());
    expect(screen.getByTestId('plans-smart-pack-add-on-now').textContent).toBe('לתשלום עכשיו: ₪7.00 (חלק יחסי עד 20/11/2026)');
    expect([...screen.getByTestId('plans-smart-pack-add-on-now').querySelectorAll('bdi')].map((b) => b.getAttribute('dir'))).toEqual(['ltr', 'ltr']);
    expect(screen.getByTestId('plans-smart-pack-add-on-then').textContent).toBe('אחר כך ₪10.00 לחודש, יחד עם חידוש המנוי.');
    fireEvent.click(screen.getByTestId('plans-smart-pack-add-on-pay'));
    await waitFor(() => expect(onLeave).toHaveBeenCalledWith('https://payments.payplus.co.il/x'));
  });
  it('nothing is offered when the server has no quote for the account', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: false, code: 'not_eligible' } }));
    const { container } = render(<SmartPackAddOnOffer isHebrew invoke={invoke} onLeave={() => {}} />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
  it('back from the add-on page: confirmed only when the server says SMART PACK is active (the package was active already)', () => {
    expect(billingReturnFromSearch('?billing=smart_pack')).toBe('smart_pack');
    expect(billingReturnState('smart_pack', summary(), 1000)).toBe('waiting');
    expect(billingReturnState('smart_pack', summary(), 95000)).toBe('timeout');
    expect(billingReturnState('smart_pack_failed', summary(), 1000)).toBe('failed');
    expect(billingReturnState('smart_pack', summary({ smartPack: { active: true, source: 'add_on', until: '2026-11-20T10:00:00.000Z' } }), 1000)).toBe('confirmed');
    expect(billingReturnState('processing', summary(), 1000)).toBe('confirmed'); // the package return is unchanged
    expect(billingReturnText('confirmed', true, { addOn: true })).toBe('התשלום אושר. חכם פלוס פעיל.');
    expect(billingReturnText('failed', true, { addOn: true })).toBe('התשלום לא הושלם וחכם פלוס לא נוסף. אפשר לנסות שוב.');
  });
});
