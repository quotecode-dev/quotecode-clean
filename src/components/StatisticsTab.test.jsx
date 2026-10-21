// Task 17: Statistics screen (rendered, HE/RTL + EN/LTR) - KPIs, filters, hot-quote actions reusing the existing handlers,
// truthful omissions, per-currency money and the responsive layout rules.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StatisticsTab from './StatisticsTab';
import { formatMoneyForCurrency } from '../utils/money';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();
const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
const q = (id, status, views, ageDays, total, currency, extra = {}) => ({
  id, quote_number: Number(id.replace(/\D/g, '')) || 7, status, view_count: views, created_at: daysAgo(ageDays), total, currency, tax_rate: currency === 'ILS' ? 18 : 0,
  clients: { company_name: `Client ${id}` }, subject: `Title ${id}`, ...extra,
});
const ILS_QUOTES = [q('q1', 'sent', 7, 2, 1227.5, 'ILS'), q('q2', 'draft', 4, 1, 300.2, 'ILS'), q('q3', 'approved', 9, 3, 500, 'ILS'), q('q4', 'paid', 0, 50, 99.6, 'ILS'), q('q5', 'sent', 0, 1, 10, 'ILS')];
const MIXED = [q('u1', 'sent', 5, 1, 100.25, 'USD'), q('u2', 'sent', 0, 1, 50.75, 'USD'), q('e1', 'approved', 1, 1, 200.4, 'EUR'), q('g1', 'sent', 3, 2, 80.1, 'GBP')];
const props = (over = {}) => ({
  quotes: ILS_QUOTES, isHebrew: true, isLocalIsraeliBusiness: true, currency: 'ILS', now: NOW,
  formatMoneyDisplay: (v, cur) => formatMoneyForCurrency(v, cur || (over.isLocalIsraeliBusiness === false ? over.currency : 'ILS')),
  handleProtectedAction: vi.fn((id, action, fn) => fn()), sendWhatsApp: vi.fn(), requestEmailSend: vi.fn(),
  activeTooltip: { quoteId: null, action: null }, ...over,
});
const kpi = (c, key) => strip(c.querySelector(`[data-kpi="${key}"] .pf-stats-kpi-value`).textContent);

afterEach(() => { vi.restoreAllMocks(); });

describe('Task 17 Statistics screen (HE / Local / ILS)', () => {
  it('shows the truthful KPIs for the default 30-day period', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('סטטיסטיקה');
    expect(kpi(container, 'created')).toBe('4'); // q4 is 50 days old
    expect(kpi(container, 'awaiting')).toBe('3'); // night task R-08: q1 q5 sent + q2 a draft the customer viewed
    expect(kpi(container, 'viewed')).toBe('3');
    expect(kpi(container, 'won')).toBe('1');
    expect(kpi(container, 'hot')).toBe('2');
    expect(kpi(container, 'conversion')).toBe('25%'); // 1 / (3 awaiting + 1 won)
    expect(kpi(container, 'value')).toBe('₪2,038.00'); // 1227.50 + 300.20 + 500 + 10 = 2037.70 -> whole shekel
    expect(container.textContent).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
  });
  it('the hot list is ordered by views then newest, shows full numbers without # and the persisted amount', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    const rows = [...container.querySelectorAll('[data-hot-quote-id]')];
    expect(rows.map((r) => r.dataset.hotQuoteId)).toEqual(['q1', 'q2']); // q3 approved is never hot
    expect(within(rows[0]).getByTestId('hot-number').textContent).not.toContain('#');
    expect(within(rows[0]).getByTestId('hot-views').textContent).toBe('7');
    expect(strip(rows[0].textContent)).toContain('₪1,228.00');
    expect(within(rows[0]).getByTestId('hot-status').textContent).toBe('נצפתה, ממתינה'); // R-22: the list's shown status
  });
  it('hot-quote actions reuse the existing handlers and guards', () => {
    const p = props();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(<StatisticsTab {...p} />);
    const row = container.querySelector('[data-hot-quote-id="q1"]');
    fireEvent.click(within(row).getByText('צפייה בהצעה'));
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/public-quote/q1`, '_blank');
    fireEvent.click(within(row).getByText('וואטסאפ'));
    expect(p.handleProtectedAction).toHaveBeenCalledWith('q1', 'whatsapp', expect.any(Function));
    expect(p.sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1' }));
    fireEvent.click(within(row).getByText('שלח במייל'));
    expect(p.requestEmailSend).toHaveBeenCalledWith(expect.objectContaining({ id: 'q1' }));
    expect(container.textContent).not.toMatch(/העתק קישור|Copy link/); // no canonical copy-link implementation exists
  });
  it('an entitlement-blocked WhatsApp shows the existing plan tooltip and never sends', () => {
    const p = props({ handleProtectedAction: vi.fn(), activeTooltip: { quoteId: 'q1', action: 'whatsapp' } });
    const { container } = render(<StatisticsTab {...p} />);
    fireEvent.click(within(container.querySelector('[data-hot-quote-id="q1"]')).getByText('וואטסאפ'));
    expect(p.sendWhatsApp).not.toHaveBeenCalled();
    expect(container.textContent).toContain('לא כלול במסלול הנוכחי');
  });
  it('period and status filters change the population; status options are only the canonical enum', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    fireEvent.click(container.querySelector('[data-period="all"]'));
    expect(container.querySelector('[data-period="all"]').getAttribute('aria-pressed')).toBe('true');
    expect(kpi(container, 'created')).toBe('5');
    const select = screen.getByTestId('statistics-status');
    expect([...select.options].map((o) => o.value)).toEqual(['all', 'draft', 'sent', 'approved', 'paid']);
    fireEvent.change(select, { target: { value: 'approved' } });
    expect(kpi(container, 'created')).toBe('1');
    expect(screen.getByTestId('statistics-hot-empty')).toBeTruthy();
  });
  it('states the unsupported metrics instead of fabricating them', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    expect(screen.getByTestId('statistics-unsupported-note').textContent).toMatch(/נדחתה/);
    expect(container.querySelector('[data-kpi="rejected"]')).toBeNull();
    expect(container.querySelector('[data-kpi*="time"]')).toBeNull();
  });
});

describe('Task 17 Statistics screen (EN / International / mixed currencies)', () => {
  it('EUR account: value by currency, never one mixed total; amounts keep cents', () => {
    const { container } = render(<StatisticsTab {...props({ quotes: MIXED, isHebrew: false, isLocalIsraeliBusiness: false, currency: 'EUR' })} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Statistics');
    const tokens = [...container.querySelectorAll('[data-kpi="value"] .pf-money[data-currency]')].map((e) => strip(e.textContent));
    expect(tokens).toEqual(['€200.40', '$151.00', '£80.10']);
    expect(strip(container.querySelector('[data-kpi="value"]').textContent)).not.toContain('431.50');
    expect(container.querySelector('[data-kpi="value"] .pf-stats-kpi-label').textContent).toBe('Quote value by currency');
    const hot = [...container.querySelectorAll('[data-hot-quote-id]')];
    expect(hot.map((r) => r.dataset.hotQuoteId)).toEqual(['u1', 'g1']);
    expect(strip(hot[0].textContent)).toContain('$100.25');
    expect(strip(hot[1].textContent)).toContain('£80.10');
    expect(container.textContent).not.toContain('₪');
  });
  it('International view link opens the English public quote', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(<StatisticsTab {...props({ quotes: MIXED, isHebrew: false, isLocalIsraeliBusiness: false, currency: 'EUR' })} />);
    fireEvent.click(within(container.querySelector('[data-hot-quote-id="u1"]')).getByText('View quote'));
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/en/public-quote/u1?lang=en`, '_blank');
  });
});

describe('Task 17 Statistics layout contract (responsive + bidi)', () => {
  it('numbers, dates and amounts are LTR-isolated atoms; layout uses logical properties and breakpoints', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    container.querySelectorAll('.pf-stats-kpi-value bdi, [data-testid="hot-number"], [data-testid="hot-views"]').forEach((b) => {
      expect(b).toHaveAttribute('dir', 'ltr'); expect(b).toHaveClass('pf-num');
    });
    const css = container.querySelector('style').textContent;
    expect(css).toMatch(/@media \(max-width: 900px\)/);
    expect(css).toMatch(/@media \(max-width: 560px\)/);
    expect(css).toMatch(/border-inline-start: 3px solid/);
    expect(css).not.toMatch(/(^|[\s;{])(margin|padding)-(left|right):|text-align: (left|right)|border-(left|right):/);
    expect(css).toMatch(/min-block-size: 40px/); // touch targets on phones
  });

  // live 360px probe: content painted past the height-constrained screen card and under the footer link; the shared
  // .pf-screen contract makes .pf-screen-body the ONLY vertical scroll owner below the static header + filters
  it('KPIs, hot list and note live inside the one .pf-screen-body scroll owner; header and filters stay static', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    const scr = screen.getByTestId('statistics-screen');
    const body = screen.getByTestId('statistics-body');
    expect(body.parentElement).toBe(scr);
    expect(body).toHaveClass('pf-screen-body');
    expect(scr.querySelectorAll(':scope > .pf-screen-body')).toHaveLength(1);
    for (const sel of ['[data-testid="statistics-kpis"]', '[data-testid="statistics-hot-list"]', '[data-testid="statistics-unsupported-note"]']) {
      expect(body.contains(container.querySelector(sel)), sel).toBe(true);
    }
    expect(body.contains(container.querySelector('.pf-stats-filters'))).toBe(false);
    expect(body.contains(scr.querySelector('h2'))).toBe(false);
  });

  it('Owner update 2026-10-09: no flame icon - the hot list heading carries the original illustrated eye (not Lucide)', () => {
    render(<StatisticsTab {...props()} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.querySelectorAll('svg')).toHaveLength(1);
    expect(heading.querySelector('svg')).toHaveAttribute('data-icon', 'tekango-eye');
    expect(heading.querySelector('svg').getAttribute('class')).not.toMatch(/lucide|flame/);
  });
});

// Codex Task 17 review follow-up (fixed in Task 18): a hot quote without a client shows its own title, then its full number -
// never 'N/A' and never a fabricated client; the same rule as the hot-quote alert.
describe('Statistics hot list - truthful missing-client fallback', () => {
  it('client name when present, else the quote title, else the full quote number (LTR-isolated)', () => {
    const list = [
      q('q1', 'sent', 9, 1, 100, 'ILS'),
      q('q2', 'sent', 8, 1, 100, 'ILS', { clients: null }),
      q('q3', 'sent', 7, 1, 100, 'ILS', { clients: { company_name: '  ' }, subject: '', quote_subject: '', quote_number: 12345 }),
    ];
    const { container } = render(<StatisticsTab {...props({ quotes: list })} />);
    fireEvent.click(container.querySelector('[data-period="all"]'));
    const cells = [...container.querySelectorAll('.pf-stats-hot-client')];
    expect(cells.map((c) => c.getAttribute('data-party'))).toEqual(['client', 'title', 'number']);
    expect(cells[0].textContent).toBe('Client q1');
    expect(cells[1].textContent).toBe('Title q2');
    expect(cells[2].textContent).not.toMatch(/#/);
    expect(cells[2].textContent).toMatch(/12345/);
    expect(cells[2].querySelector('bdi')).toHaveAttribute('dir', 'ltr');
    expect(container.textContent).not.toMatch(/N\/A/);
  });
});

// Task 18: each actionable hot quote offers "Create follow-up task"; it hands the quote to the Tasks screen (pre-linked there) and
// creates nothing itself.
describe('Statistics hot list - create follow-up task', () => {
  it.each([[true, 'יצירת משימת מעקב'], [false, 'Create follow-up task']])('isHebrew=%s: one action per hot quote, calling back with that quote', (isHebrew, label) => {
    const onCreateFollowUpTask = vi.fn();
    const { container } = render(<StatisticsTab {...props({ isHebrew, onCreateFollowUpTask })} />);
    const rows = [...container.querySelectorAll('[data-hot-quote-id]')];
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(within(row).getAllByTestId('hot-follow-up')).toHaveLength(1));
    fireEvent.click(within(rows[0]).getByRole('button', { name: label }));
    expect(onCreateFollowUpTask).toHaveBeenCalledTimes(1);
    expect(onCreateFollowUpTask.mock.calls[0][0].id).toBe(rows[0].getAttribute('data-hot-quote-id'));
  });
  it('without the Tasks wiring the action is not offered (no dead control)', () => {
    const { container } = render(<StatisticsTab {...props()} />);
    expect(container.querySelector('[data-testid="hot-follow-up"]')).toBeNull();
  });
});
