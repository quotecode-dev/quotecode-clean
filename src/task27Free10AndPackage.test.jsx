// Task 27 (§249 + the Owner's 2026-10-11 amendment, §253): the in-app package offer (one price source, one price at a time) and the
// Free-10 upgrade window (only on an attempted paid action; dismissible; no timer; never a global lock), plus the Dashboard source
// guards that place the check BEFORE any insert / reservation on every new-quote path.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pricingModalModel } from './domain/subscriptions/pricingModalModel';
import PackageOfferCards from './components/PackageOfferCards';
import Free10UpgradeWindow from './components/Free10UpgradeWindow';
import PricingModal from './components/PricingModal';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const code = (rel) => read(rel).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
afterEach(() => cleanup());

const shown = (root) => [...root.querySelectorAll('[data-billing-period]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim());
const note = (root) => [...root.querySelectorAll('[data-period-note]')].map((n) => n.textContent.trim());

describe('in-app package offer (pricingModalModel + PackageOfferCards)', () => {
  it('IL: Free-10 + the package, ₪30.00 / ₪306.00 incl. VAT, saving ₪54.00 = 15% only on Annual; one price at a time', () => {
    const m = pricingModalModel({ isHebrew: true, market: 'IL' });
    expect(m.plans.map((p) => p.id)).toEqual(['free', 'all_inclusive']);
    expect(m.priceNote).toBe('המחירים כוללים מע״מ.');
    const { container } = render(<PackageOfferCards model={m} isHebrew />);
    const card = screen.getByTestId('plans-modal-card-all_inclusive');
    expect(shown(card)).toEqual(['₪30.00/ חודש']);
    expect(note(card)).toEqual([]);
    fireEvent.click(within(card).getByLabelText('שנתי'));
    expect(shown(card)).toEqual(['₪306.00/ שנה']);
    expect(note(card)).toEqual(['חיסכון של 15% — ₪54.00 בשנה']);
    expect(container.textContent).not.toMatch(/\$|USD|29\.00|49\.00|69\.00/);
  });
  it('INTERNATIONAL: $18.00 / $184.00 USD, saving $32.00 "approximately 15%", charged in USD; no ₪', () => {
    const m = pricingModalModel({ isHebrew: false, market: 'INTERNATIONAL' });
    expect(m.priceNote).toBe('Prices are in US dollars. Charged in USD.');
    const { container } = render(<PackageOfferCards model={m} isHebrew={false} />);
    const card = screen.getByTestId('plans-modal-card-all_inclusive');
    expect(shown(card)).toEqual(['$18.00USD / month']);
    fireEvent.click(within(card).getByLabelText('Annual'));
    expect(shown(card)).toEqual(['$184.00USD / year']);
    expect(note(card)).toEqual(['Save approximately 15% — $32.00 per year']);
    expect(container.textContent).not.toMatch(/₪|ILS|183\.60|32\.40/);
  });
  it('PricingModal renders the package offer, keeps the AI header and states purchase is not available', () => {
    render(<PricingModal isOpen onClose={() => {}} isHebrew isLocalIsraeliBusiness accountSummary={{ state: 'not_deployed' }} />);
    expect(screen.getByTestId('plans-modal-card-free')).toBeTruthy();
    expect(screen.getByTestId('plans-modal-card-all_inclusive')).toBeTruthy();
    expect(screen.queryByTestId('plans-modal-card-classic')).toBeNull();
    expect(screen.getByTestId('plans-modal-availability').textContent).toMatch(/רכישת מנוי עדיין לא זמינה/);
    expect(read('components/PricingModal.jsx')).toMatch(/<AiModalHeader/);
  });
});

describe('Free-10 upgrade window', () => {
  const props = (over = {}) => ({ open: true, onClose: vi.fn(), isHebrew: true, market: 'IL', free10: { limit: 10, consumed: 9, reserved: 1, remaining: 0 }, ...over });
  it('states the server counter, what stays permitted, and offers the package; the subscription choice is not available (no fake purchase)', () => {
    render(<Free10UpgradeWindow {...props()} />);
    const w = screen.getByTestId('free10-upgrade-window');
    expect(w.getAttribute('role')).toBe('dialog');
    expect(w.getAttribute('aria-modal')).toBe('true');
    expect(w.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('heading', { name: /המשיכו לעבוד ללא הגבלה/ })).toBeTruthy();
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('נוצלו כל 10 ההצעות החינמיות (9 נוצלו, 1 בתהליך שליחה).');
    expect(screen.getByTestId('free10-upgrade-allowed').textContent).toMatch(/לצפות בהצעות הקיימות/);
    expect(screen.getByTestId('free10-upgrade-choose').disabled).toBe(true);
    expect(screen.getByTestId('free10-upgrade-unavailable').textContent).toMatch(/לא מתבצע חיוב/);
    expect(screen.getByTestId('free10-upgrade-card-all_inclusive')).toBeTruthy();
    expect(screen.queryByTestId('free10-upgrade-card-free')).toBeNull();
    expect(w.textContent).not.toMatch(/\$|USD/);
  });
  it('closes by the button, the X, Escape and the backdrop; focus starts on "back to work"', () => {
    const p = props();
    render(<Free10UpgradeWindow {...p} />);
    expect(document.activeElement).toBe(screen.getByTestId('free10-upgrade-close'));
    fireEvent.click(screen.getByTestId('free10-upgrade-close'));
    fireEvent.click(screen.getByTestId('free10-upgrade-x'));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('free10-upgrade-backdrop'));
    expect(p.onClose).toHaveBeenCalledTimes(4);
  });
  it('closed = nothing rendered; no timer anywhere in the window (it never re-opens by itself)', () => {
    const { container } = render(<Free10UpgradeWindow {...props({ open: false })} />);
    expect(container.innerHTML).toBe('');
    expect(code('components/Free10UpgradeWindow.jsx')).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/);
  });
  it('EN / INTERNATIONAL: LTR, USD only', () => {
    render(<Free10UpgradeWindow {...props({ isHebrew: false, market: 'INTERNATIONAL', free10: { limit: 10, consumed: 10, reserved: 0, remaining: 0 } })} />);
    const w = screen.getByTestId('free10-upgrade-window');
    expect(w.getAttribute('dir')).toBe('ltr');
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('All 10 free quotes have been used (10 used).');
    expect(w.textContent).not.toMatch(/₪|ILS/);
  });
});

describe('Dashboard: the Free-10 check precedes any insert / reservation on every new-quote path (source guards)', () => {
  const dash = read('pages/Dashboard.jsx');
  it('one decision from the server summary; only an attempted paid action opens the window', () => {
    // Owner 2026-10-18: LIFETIME is unlimited (also when granted after activation) - the server guard exempts it the same way
    expect(dash).toMatch(/const free10Blocked = \(\) => \{\s*\/\/[^\n]*\n\s*if \(isLifetimeAccount \|\| decideFree10Action\(accountSummary\)\.allowed\) return false;\s*setFree10Window\(true\);\s*return true;\s*\};/);
    expect((dash.match(/setFree10Window\(true\)/g) || []).length).toBe(6); // the helper, three output refusals (WhatsApp, email, Task 28 copy message), the server create refusal, the editor issue / Sent through the authority (Owner 2026-10-18)
    expect(dash).not.toMatch(/setInterval\([^)]*Free10|setTimeout\([^)]*setFree10Window/);
  });
  it('new / measured / AI / duplicate stop before anything opens; save stops before persistQuote', () => {
    expect(dash).toMatch(/const handleCreateNewQuoteClick = \(\) => \{\s*if \(free10Blocked\(\)\) return false;/);
    expect(dash).toMatch(/const handleCreateStructuredQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\(\) === false\) return;/);
    expect(dash).toMatch(/const handleCreateAiQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\(\) === false\) return;/);
    expect(dash).toMatch(/const handleDuplicateQuote = async \(quote\) => \{\s*if \(free10Blocked\(\)\) return;/);
    const save = dash.slice(dash.indexOf('async function handleSaveQuote'), dash.indexOf('const saveResult = await persistQuote('));
    expect(save).toMatch(/if \(!editingQuoteId && free10Blocked\(\)\) return;/);
  });
  it('a first output refused for Free-10 and a server-refused new quote open the same window', () => {
    expect((dash.match(/if \(auth\.code === 'free_issue_limit_reached'\) setFree10Window\(true\);/g) || []).length).toBe(4); // WhatsApp + email (send), the Task 28 copy message (public_share) and the editor issue / Sent (Owner 2026-10-18)
    expect(dash).toMatch(/if \(\/free_issue_limit_reached\/\.test\(String\(saveResult\.error\?\.message \|\| ''\)\)\) \{ setFree10Window\(true\); refreshAccountSummary\(\); \}/);
  });
  it('the public customer page never reads the owner subscription (no paywall for the customer)', () => {
    for (const f of ['pages/PublicQuote.jsx', 'pages/PublicQuoteEn.jsx', 'components/SmartPublicQuote.jsx']) {
      expect(read(f)).not.toMatch(/get_account_summary|useAccountSummary|Free10UpgradeWindow|decideFree10Action/);
    }
  });
});
