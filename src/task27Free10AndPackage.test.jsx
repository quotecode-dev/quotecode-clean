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
    expect(screen.queryByTestId('plans-modal-card-free')).toBeNull(); // Owner 2026-10-25: Free is never a card to choose
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
  // Codex audit M06 (Owner 2026-10-21 "כן, לתקן"): focus starts at the top of the window (the close X), so the title stays in view on a phone
  it('closes by the button, the X, Escape and the backdrop; focus starts at the top (the close X)', () => {
    const p = props();
    render(<Free10UpgradeWindow {...p} />);
    expect(document.activeElement).toBe(screen.getByTestId('free10-upgrade-x'));
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
  it('Owner 2026-10-20: the 7 free days ended before the 10 quotes - its own true sentence, HE / RTL and EN / LTR', () => {
    const ended = { limit: 10, consumed: 3, reserved: 0, remaining: 7, endsAt: '2026-10-28T10:00:00.000Z', periodEnded: true };
    const { unmount } = render(<Free10UpgradeWindow {...props({ free10: ended })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('תמו 7 ימי החינם (נוצלו 3 מתוך 10 ההצעות החינמיות).');
    expect(screen.getByTestId('free10-upgrade-window').getAttribute('dir')).toBe('rtl');
    unmount();
    render(<Free10UpgradeWindow {...props({ isHebrew: false, market: 'INTERNATIONAL', free10: ended })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('The 7 free days have ended (3 of 10 free quotes used).');
    expect(screen.getByTestId('free10-upgrade-window').getAttribute('dir')).toBe('ltr');
  });
  it('Owner 2026-10-18 + Codex audit M-01: a limited paid account - the sentence of the reason the server states, HE / RTL and EN / LTR', () => {
    const { unmount } = render(<Free10UpgradeWindow {...props({ free10: null, limited: 'payment_failed' })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('התשלום לחידוש המנוי לא עבר, ולכן החשבון מוגבל. ההצעות והלקוחות הקיימים נשארים זמינים.');
    expect(screen.getByTestId('free10-upgrade-window').getAttribute('dir')).toBe('rtl');
    unmount();
    const c = render(<Free10UpgradeWindow {...props({ free10: null, limited: 'cancelled' })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('המנוי הסתיים בעקבות בקשת הביטול שלכם, ולכן החשבון מוגבל. ההצעות והלקוחות הקיימים נשארים זמינים.');
    c.unmount();
    // a reason the server did not state is never shown as a failed payment
    const n = render(<Free10UpgradeWindow {...props({ free10: null, limited: true })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('התקופה ששולמה הסתיימה, ולכן החשבון מוגבל. ההצעות והלקוחות הקיימים נשארים זמינים.');
    n.unmount();
    render(<Free10UpgradeWindow {...props({ isHebrew: false, market: 'INTERNATIONAL', free10: null, limited: 'cancelled' })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('Your subscription has ended following your cancellation request, so the account is limited. Your existing quotes and clients remain available.');
    expect(screen.getByTestId('free10-upgrade-window').getAttribute('dir')).toBe('ltr');
  });
  it('both ended (10 used by the last day): the 10-quotes sentence', () => {
    render(<Free10UpgradeWindow {...props({ free10: { limit: 10, consumed: 10, reserved: 0, remaining: 0, endsAt: '2026-10-28T10:00:00.000Z', periodEnded: true } })} />);
    expect(screen.getByTestId('free10-upgrade-used').textContent).toBe('נוצלו כל 10 ההצעות החינמיות (10 נוצלו).');
  });
});

describe('Dashboard: the Free-10 check precedes any insert / reservation on every new-quote path (source guards)', () => {
  const dash = read('pages/Dashboard.jsx');
  it('one decision from the server summary; only an attempted paid action opens the window', () => {
    // Owner 2026-10-18: LIFETIME is unlimited (also when granted after activation) - the server guard exempts it the same way
    expect(dash).toMatch(/const free10Blocked = \(\) => \{\s*\/\/[^\n]*\n\s*if \(isLifetimeAccount \|\| decideFree10Action\(accountSummary\)\.allowed\) return false;\s*setFree10Window\(true\);\s*return true;\s*\};/);
    expect((dash.match(/setFree10Window\(true\)/g) || []).length).toBe(7); // the helper, three output refusals (WhatsApp, email, Task 28 copy message), the server create refusal, the editor issue / Sent through the authority (Owner 2026-10-18), the refused items of an existing draft (Owner 2026-10-20)
    expect(dash).not.toMatch(/setInterval\([^)]*Free10|setTimeout\([^)]*setFree10Window/);
  });
  it('new / measured / AI / duplicate stop before anything opens; save stops before persistQuote', () => {
    // Owner 2026-10-24 (typed L-15): the new-quote paths pass their kind (the business-details return reopens the same kind)
    expect(dash).toMatch(/const handleCreateNewQuoteClick = \(variant\) => \{\s*if \(free10Blocked\(\)\) return false;/);
    expect(dash).toMatch(/const handleCreateStructuredQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\('structured'\) === false\) return;/);
    // Owner console 2026-10-25 (typed L-05 approval): without SMART PACK the branch runs the Free-10 check itself before any notice
    expect(dash).toMatch(/const handleCreateAiQuoteClick = \(\) => \{\n(?:\s*\/\/[^\n]*\n)*\s*if \(!smartPackAllowed\) \{ if \(!free10Blocked\(\)\) setLockedCapability\('smart_pack'\); return; \}\s*if \(handleCreateNewQuoteClick\('ai'\) === false\) return;/);
    expect(dash).toMatch(/const handleDuplicateQuote = async \(quote\) => \{\s*if \(free10Blocked\(\)\) return;/);
    const save = dash.slice(dash.indexOf('async function handleSaveQuote'), dash.indexOf('const saveResult = await persistQuote('));
    expect(save).toMatch(/if \(!editingQuoteId && free10Blocked\(\)\) return;/);
  });
  it('a first output refused for Free-10 and a server-refused new quote open the same window', () => {
    // Owner 2026-10-20: both server refusals - 10 quotes used (free_issue_limit_reached) or the 7 free days ended (free_period_ended)
    expect(dash).toMatch(/const FREE10_END_CODES = new Set\(\['free_issue_limit_reached', 'free_period_ended'\]\);/);
    expect(dash).toMatch(/const FREE10_END_RE = \/free_issue_limit_reached\|free_period_ended\|subscription_limited\/;/);
    expect((dash.match(/if \(FREE10_END_CODES\.has\(auth\.code\)\) setFree10Window\(true\);/g) || []).length).toBe(4); // WhatsApp + email (send), the Task 28 copy message (public_share) and the editor issue / Sent (Owner 2026-10-18)
    // the window is the whole answer to a refused save: no second alert with the raw server text on top of it - except when removing
    // the new quote shell failed too (that notice must still show)
    expect(dash).toMatch(/if \(FREE10_END_RE\.test\(String\(saveResult\.error\?\.message \|\| ''\)\)\) \{\s*setFree10Window\(true\); refreshAccountSummary\(\);\s*if \(!\(saveResult\.stage === 'structure' && saveResult\.compensationFailed\)\) return;\s*\}/);
    // the items of an existing draft refused (partial save): the window opens next to the truthful partial notice
    expect(dash).toMatch(/if \(saveResult\.outcome === 'partial' && \(saveResult\.stage === 'structure' \|\| saveResult\.stage === 'items'\)\) \{\s*\/\/[^\n]*\n\s*if \(FREE10_END_RE\.test\(String\(saveResult\.error\?\.message \|\| ''\)\)\) \{ setFree10Window\(true\); refreshAccountSummary\(\); \}/);
  });
  it('the public customer page never reads the owner subscription (no paywall for the customer)', () => {
    for (const f of ['pages/PublicQuote.jsx', 'pages/PublicQuoteEn.jsx', 'components/SmartPublicQuote.jsx']) {
      expect(read(f)).not.toMatch(/get_account_summary|useAccountSummary|Free10UpgradeWindow|decideFree10Action/);
    }
  });
});
