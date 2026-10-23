import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import QuotesTab from './QuotesTab';
import { formatMoneyForCurrency } from '../utils/money';

// Sortable table header + hot-quote banner (owner correction 2026-10-08). QuotesTab owns the visible order; the harness below
// owns only the sort STATE with the exact semantics of Dashboard.handleQuoteSort (same column toggles direction, a different
// column starts ascending) and the same filter step (search + status) that Dashboard applies before handing quotes down.

const t = { recentHistory: 'History', quotesNav: 'Quotes', searchQuote: 'Search', filterStatus: 'Status' };
const FIELD = { id: 'id', client: 'client', subject: 'subject', status: 'status', views: 'views', date: 'created_at', amount: 'total' };

const mk = (letter, over = {}) => ({
  id: `quote-${letter}`,
  status: 'draft',
  signature: null,
  clients: { company_name: `Client ${letter}`, client_type: 'business' },
  subtotal: 100,
  discount: 0,
  total: 100,
  currency: 'ILS',
  tax_rate: 18,
  view_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  quote_items: [{ description: 'Item' }],
  client_type: 'business',
  email_bounced: false,
  ...over,
});

// A..F with distinct values for every sortable key (see the expected orders below).
const FIXTURE = [
  mk('A', { quote_number: 100738, clients: { company_name: 'client 10' }, subject: 'Zeta', status: 'draft', total: 50, view_count: 1, created_at: '2026-01-05T10:00:00.000Z' }),
  mk('B', { quote_number: 100739, clients: { company_name: 'client 2' }, subject: 'alpha', status: 'sent', total: 1200.5, view_count: 2, created_at: '2026-02-01T10:00:00.000Z' }),
  mk('C', { quote_number: 100737, clients: { company_name: 'Charlie' }, subject: 'Beta', status: 'approved', total: 9, view_count: 40, created_at: '2026-01-20T10:00:00.000Z' }),
  mk('D', { quote_number: 100736, clients: { company_name: 'bravo' }, subject: 'gamma', status: 'paid', total: 10000, view_count: 7, created_at: '2026-03-10T10:00:00.000Z' }),
  mk('E', { quote_number: 100735, clients: { company_name: 'Delta' }, subject: 'Eps', status: 'draft', total: 0, view_count: 0, created_at: '2026-02-15T10:00:00.000Z' }),
  mk('F', { quote_number: 100740, clients: { company_name: 'Echo' }, subject: 'hot one', status: 'sent', total: 300, view_count: 5, created_at: '2026-02-20T10:00:00.000Z' }),
];

// ascending expectations by column (letters). Descending is the reverse where every key is distinct.
// Ties keep the incoming order in BOTH directions, so a column with a tie names its descending order explicitly.
const DESC = { status: ['D', 'C', 'F', 'A', 'B', 'E'] };
const ASC = {
  id: ['E', 'D', 'C', 'A', 'B', 'F'],
  client: ['D', 'C', 'B', 'A', 'E', 'F'], // bravo, Charlie, client 2, client 10 (numeric collation), Delta, Echo
  subject: ['B', 'C', 'E', 'D', 'F', 'A'], // alpha, Beta, Eps, gamma, hot one, Zeta (case-insensitive)
  // night task 2026-10-16 (R-07): the status column sorts by the SHOWN status - A is a Draft the customer opened once, shown
  // "Sent · viewed", so it sorts with the sent quote B (a tie that keeps the incoming order in both directions)
  status: ['E', 'A', 'B', 'F', 'C', 'D'], // unfinished, sent (A viewed draft, B), viewed/hot, approved, paid
  views: ['E', 'A', 'B', 'F', 'D', 'C'], // 0, 1, 2, 5, 7, 40 (a number, not "40" < "5")
  date: ['A', 'C', 'B', 'E', 'F', 'D'],
  amount: ['E', 'C', 'A', 'F', 'B', 'D'], // 0, 9, 50, 300, 1200.5, 10000 (a number, not a string)
};

function Harness({ isHebrew = false, quotes = FIXTURE, initialField = 'created_at', initialDirection = 'desc', search = '', status = 'All', onSort, extra = {} }) {
  const [field, setField] = useState(initialField);
  const [direction, setDirection] = useState(initialDirection);
  const handleQuoteSort = (next) => {
    onSort?.(next);
    if (next === field) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else { setField(next); setDirection('asc'); }
  };
  const visible = quotes.filter((q) => (!search || (q.clients?.company_name || '').toLowerCase().includes(search.toLowerCase()))
    && (status === 'All' || q.status === status));
  return (
    <QuotesTab
      quotes={visible}
      allQuotes={quotes}
      searchTerm={search}
      setSearchTerm={vi.fn()}
      statusFilter={status}
      setStatusFilter={vi.fn()}
      quoteSortField={field}
      quoteSortDirection={direction}
      handleQuoteSort={handleQuoteSort}
      handleExportQuotes={vi.fn()}
      handleEditClick={vi.fn()}
      handleDuplicateQuote={vi.fn()}
      sendWhatsApp={vi.fn()}
      handleDeleteQuote={vi.fn()}
      handleProtectedAction={vi.fn((id, action, fn) => fn())}
      activeTooltip={{ quoteId: null, action: null }}
      openDropdownId={null}
      isHebrew={isHebrew}
      isLocalIsraeliBusiness={isHebrew}
      formatMoneyDisplay={(val, cur) => formatMoneyForCurrency(val, cur || 'ILS')}
      t={t}
      setPendingEmailQuote={vi.fn()}
      emailStatuses={{}}
      currency="ILS"
      {...extra}
      />
  );
}

// Owner console 2026-10-18, typed: "שיראה מסך מלא לפי דפים, הסתיים הדף שיהיה כפתור למטה להציג את הדף הבא" + "שההצעה תופיע לפי הסדר" (accepted: "מעולה, תנעל")
// the list is paged (no "show all"): the six fixture quotes are all on page one, in their sorted order
const showAll = () => {};
const orderOf = (container) => [...container.querySelectorAll('.quote-modern-number')].map((n) => n.textContent.replace(/^#?A/, ''))
  .map((num) => ({ 100735: 'E', 100736: 'D', 100737: 'C', 100738: 'A', 100739: 'B', 100740: 'F' }[num]));
const header = (key) => document.querySelector(`.quote-modern-head-btn[data-sort-key="${key}"]`);
const columnOf = (key) => header(key).closest('[role="columnheader"]');

describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('sortable table header - %s', (_label, isHebrew) => {
  it('renders a localized header row of seven separate column headers (Owner R4: no Action column), above the rows', () => {
    const { container } = render(<Harness isHebrew={isHebrew} />);
    const head = container.querySelector('.quote-modern-head');
    expect(head).not.toBeNull();
    expect(head.compareDocumentPosition(container.querySelector('.quote-modern-item'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const row = head.querySelector('[role="row"]');
    // seven direct columnheader children, one per row cell, in the same DOM order as the row cells (no grouped/stacked headers)
    expect([...row.children].map((c) => c.getAttribute('role'))).toEqual(Array(7).fill('columnheader'));
    expect([...row.children].map((c) => c.querySelector('.quote-modern-head-btn').dataset.sortKey)).toEqual(['id', 'client', 'subject', 'status', 'views', 'created_at', 'total']);
    const rowCells = [...container.querySelector('.quote-modern-row').children].filter((c) => !c.classList.contains('quote-modern-toggle')).map((c) => [...c.classList].find((k) => k.startsWith('quote-modern-')));
    expect(rowCells).toEqual(['quote-modern-number', 'quote-modern-client', 'quote-modern-title', 'quote-modern-status', 'quote-modern-views', 'quote-modern-date', 'quote-modern-amount']);
    expect(head.querySelector('.quote-modern-head-action')).toBeNull();
    expect(head.querySelector('.quote-modern-head-identity, .quote-modern-head-state, .quote-modern-head-text')).toBeNull();
    const labels = [...head.querySelectorAll('.quote-modern-head-label')].map((n) => n.textContent);
    expect(labels).toEqual(isHebrew
      ? ['מס׳ הצעה', 'לקוח', 'כותרת ההצעה', 'מצב', 'צפיות', 'תאריך', 'סכום']
      : ['Quote #', 'Client', 'Quote title', 'Status', 'Views', 'Date', 'Amount']);
    expect(container.querySelector('.quote-modern-list')).toHaveAttribute('dir', isHebrew ? 'rtl' : 'ltr');
  });

  it('every header is a real <button> inside a columnheader inside a row, and starts unsorted except the default date column', () => {
    render(<Harness isHebrew={isHebrew} />);
    for (const key of Object.values(FIELD)) {
      const btn = header(key);
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn.closest('[role="row"]')).not.toBeNull();
      expect(columnOf(key)).toHaveAttribute('aria-sort', key === 'created_at' ? 'descending' : 'none');
    }
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it.each(Object.keys(ASC))('%s header: first click ascending, second click descending, with aria-sort + chevron on the active column only', (name) => {
    const key = FIELD[name];
    const { container } = render(<Harness isHebrew={isHebrew} initialField={name === 'date' ? 'created_at' : 'id'} initialDirection="desc" />);
    showAll(isHebrew);
    const asc = ASC[name];
    // date (the active default, descending) and id (initial descending) toggle on the first click; every other column starts ascending
    fireEvent.click(header(key));
    expect(orderOf(container)).toEqual(asc);
    expect(columnOf(key)).toHaveAttribute('aria-sort', 'ascending');
    expect(columnOf(key).querySelector('[data-sort-icon="asc"]')).not.toBeNull();
    for (const other of Object.values(FIELD).filter((k) => k !== key)) {
      expect(columnOf(other)).toHaveAttribute('aria-sort', 'none');
      expect(columnOf(other).querySelector('svg')).toBeNull();
    }
    fireEvent.click(header(key));
    expect(orderOf(container)).toEqual(DESC[name] || [...asc].reverse());
    expect(columnOf(key)).toHaveAttribute('aria-sort', 'descending');
    expect(columnOf(key).querySelector('[data-sort-icon="desc"]')).not.toBeNull();
    fireEvent.click(header(key));
    expect(orderOf(container)).toEqual(asc);
    expect(columnOf(key)).toHaveAttribute('aria-sort', 'ascending');
  });

  it('R4: no Action header or action cell; every row keeps its status-aware primary action inside its own dropdown', () => {
    const { container } = render(<Harness isHebrew={isHebrew} initialField="id" initialDirection="desc" />);
    showAll(isHebrew);
    expect(header('action')).toBeNull();
    expect(container.querySelector('.quote-modern-row > .quote-modern-action')).toBeNull();
    const letter = { 100735: 'E', 100736: 'D', 100737: 'C', 100738: 'A', 100739: 'B', 100740: 'F' };
    const kinds = {};
    for (const item of [...container.querySelectorAll('.quote-modern-item')]) {
      const key = letter[item.querySelector('.quote-modern-number').textContent.replace(/^#?A/, '')];
      fireEvent.click(item.querySelector('.quote-modern-toggle'));
      kinds[key] = item.querySelector('.quote-modern-detail .quote-modern-action').dataset.action;
    }
    // F = track (hot, even a draft), E = continue editing, A/B = open, C/D = view - the unchanged precedence
    expect(kinds).toEqual({ A: 'open', B: 'open', C: 'view', D: 'view', E: 'edit', F: 'track' });
  });

  it('switching to a different column starts ascending again', () => {
    const { container } = render(<Harness isHebrew={isHebrew} />);
    showAll(isHebrew);
    fireEvent.click(header('total'));
    fireEvent.click(header('total'));
    expect(columnOf('total')).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(header('views'));
    expect(columnOf('views')).toHaveAttribute('aria-sort', 'ascending');
    expect(columnOf('total')).toHaveAttribute('aria-sort', 'none');
    expect(orderOf(container)).toEqual(ASC.views);
  });

  it('quote # sorts numerically with the prefix-aware key (A100739 > A100738)', () => {
    const { container } = render(<Harness isHebrew={isHebrew} initialField="client" />);
    showAll(isHebrew);
    fireEvent.click(header('id'));
    fireEvent.click(header('id'));
    const numbers = [...container.querySelectorAll('.quote-modern-number')].map((n) => n.textContent);
    expect(numbers.slice(0, 3)).toEqual(['A100740', 'A100739', 'A100738']);
  });

  it('the toolbar Sort button toggles the direction of the CURRENT column and the header chevron follows', () => {
    const onSort = vi.fn();
    const { container } = render(<Harness isHebrew={isHebrew} initialField="total" initialDirection="asc" onSort={onSort} />);
    showAll(isHebrew);
    expect(orderOf(container)).toEqual(ASC.amount);
    fireEvent.click(screen.getByRole('button', { name: isHebrew ? 'החלפת כיוון המיון' : 'Toggle sort direction' }));
    expect(onSort).toHaveBeenLastCalledWith('total');
    expect(orderOf(container)).toEqual([...ASC.amount].reverse());
    expect(columnOf('total')).toHaveAttribute('aria-sort', 'descending');
  });

  it('the default is the date column, newest first', () => {
    const { container } = render(<Harness isHebrew={isHebrew} />);
    showAll(isHebrew);
    expect(orderOf(container)).toEqual([...ASC.date].reverse());
  });

  it('sort is stable: equal keys keep the incoming order and sorting is idempotent', () => {
    const same = ['A', 'B', 'C', 'D', 'E'].map((l, i) => mk(l, { quote_number: 200000 + i, view_count: 2, total: 77, status: 'sent' }));
    const { container } = render(<Harness isHebrew={isHebrew} quotes={same} initialField="id" />);
    showAll(isHebrew);
    const ids = () => [...container.querySelectorAll('.quote-modern-number')].map((n) => n.textContent);
    fireEvent.click(header('views'));
    expect(ids()).toEqual(['A200000', 'A200001', 'A200002', 'A200003', 'A200004']);
    fireEvent.click(header('views'));
    expect(ids()).toEqual(['A200000', 'A200001', 'A200002', 'A200003', 'A200004']);
    fireEvent.click(header('total'));
    expect(ids()).toEqual(['A200000', 'A200001', 'A200002', 'A200003', 'A200004']);
  });

  it('works with search/filter: only the matching quotes are ordered', () => {
    const { container } = render(<Harness isHebrew={isHebrew} status="draft" initialField="id" />);
    fireEvent.click(header('total'));
    expect(orderOf(container)).toEqual(['E', 'A']); // draft only (E 0, A 50) ascending by amount
    fireEvent.click(header('total'));
    expect(orderOf(container)).toEqual(['A', 'E']);
    const searched = render(<Harness isHebrew={isHebrew} search="client" initialField="id" />);
    expect(searched.container.querySelectorAll('.quote-modern-item').length).toBe(2);
  });

  it('the page keeps the sorted order: the hot quote is NOT promoted out of order (Owner 2026-10-18 "שההצעה תופיע לפי הסדר")', () => {
    const { container } = render(<Harness isHebrew={isHebrew} initialField="id" />);
    fireEvent.click(header('client'));
    expect(orderOf(container)).toEqual(ASC.client);
    expect(container.querySelectorAll('.quote-modern-item.is-hot')).toHaveLength(1);
    expect(container.querySelectorAll('.quote-modern-item')).toHaveLength(6);
    expect(container.querySelector('[data-testid="quote-pager"]')).toBeNull(); // one page only
  });

  it('the header buttons are keyboard operable (Enter/Space activate a native button)', () => {
    const onSort = vi.fn();
    render(<Harness isHebrew={isHebrew} onSort={onSort} />);
    const btn = header('views');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn); // a native <button> turns Enter/Space into click
    expect(onSort).toHaveBeenCalledWith('views');
  });

  it('shows no header strip when there are no quotes', () => {
    const { container } = render(<Harness isHebrew={isHebrew} quotes={[]} />);
    expect(container.querySelector('.quote-modern-head')).toBeNull();
  });
});

describe.each([
  ['Hebrew/RTL', true, ' צפה בהצעה ', ' פעמים ועדיין לא חתם.', 'פתיחה ומעקב', 'הצעה חמה', 'הלקוח'],
  ['English/LTR', false, ' viewed this quote ', ' times and still hasn’t signed.', 'Open & track', 'Hot quote', 'The client'],
])('hot quote banner - %s', (_label, isHebrew, mid, tail, actionLabel, retiredTitle, genericClient) => {
  const hotList = () => [
    mk('a'),
    mk('hotA', { view_count: 4, status: 'sent', created_at: '2026-02-01T00:00:00.000Z' }),
    mk('hotB', { view_count: 9, status: 'sent', created_at: '2026-01-15T00:00:00.000Z' }),
  ];

  // Owner update 2026-10-09 (all devices): no flame, no "hot quote" title - one eye and the exact sentence with the real count
  it('shows only the exact sentence with the hottest quote\'s real view count and ONE eye icon (no flame, no title)', () => {
    const { container } = render(<Harness isHebrew={isHebrew} quotes={hotList()} />);
    const banner = screen.getByTestId('hot-quote-banner');
    expect(banner).toHaveAttribute('data-hot-quote-id', 'quote-hotB');
    // Owner correction 2026-10-09: the eye sits first (inline-start: right in HE, left in EN), then the REAL client name
    expect(banner.querySelector('.quote-hot-banner-name').textContent).toBe('Client hotB');
    expect(banner.querySelector('.quote-hot-banner-text').textContent).toBe(`Client hotB${mid}9${tail}`);
    expect(banner.firstElementChild).toHaveClass('quote-hot-banner-action');
    expect(banner.children[1]).toHaveClass('quote-hot-banner-text');
    expect(banner.querySelector('.quote-hot-banner-text').textContent).not.toContain(genericClient);
    expect(banner.textContent).not.toContain(retiredTitle);
    expect(banner.querySelector('.quote-hot-banner-label, .quote-hot-banner-flame')).toBeNull();
    const count = banner.querySelector('bdi.pf-num');
    expect(count).toHaveAttribute('dir', 'ltr');
    expect(count.textContent).toBe('9');
    // Owner 2026-10-19 (L-25 / L-26): the eye + the visible text action share the name; the eye stays the first child
    const named = within(banner).getAllByRole('button', { name: actionLabel });
    expect(named).toHaveLength(2);
    const eye = named[0];
    // exactly one icon in the whole banner: the original illustrated TEKANGO eye (not Lucide) inside the Open & track button
    expect(banner.querySelectorAll('svg')).toHaveLength(1);
    const icon = eye.querySelector('svg.quote-hot-banner-eye');
    expect(icon).toHaveAttribute('data-icon', 'tekango-eye');
    expect(icon.getAttribute('class')).not.toMatch(/lucide/);
    expect(icon).toHaveAttribute('width', '24');
    expect(icon.querySelectorAll('.tk-eye-lid')).toHaveLength(1);
    expect(container.textContent).not.toContain(retiredTitle);
    // no emoji glyph anywhere in the banner
    expect(banner.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    // directly under the header band, above the toolbar/title block
    expect(banner.compareDocumentPosition(container.querySelector('.quote-workspace-header'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('is the same quote the row promotion leads with (most views; ties newest)', () => {
    const tie = [mk('a'), mk('old', { view_count: 5, status: 'sent', created_at: '2026-01-01T00:00:00.000Z' }), mk('new', { view_count: 5, status: 'sent', created_at: '2026-03-01T00:00:00.000Z' })];
    const { container } = render(<Harness isHebrew={isHebrew} quotes={tie} />);
    expect(screen.getByTestId('hot-quote-banner')).toHaveAttribute('data-hot-quote-id', 'quote-new');
    expect(container.querySelector('.quote-modern-client-name').textContent).toBe('Client new');
  });

  it('is hidden when no quote is hot (under 3 views, or approved/paid)', () => {
    const calm = [mk('a', { view_count: 2, status: 'sent' }), mk('b', { view_count: 40, status: 'approved' }), mk('c', { view_count: 12, status: 'paid' })];
    render(<Harness isHebrew={isHebrew} quotes={calm} />);
    expect(screen.queryByTestId('hot-quote-banner')).toBeNull();
  });

  it('keeps the existing fallback (the proposal title) when the quote has no client', () => {
    const noClient = [mk('x', { view_count: 3, status: 'sent', clients: null, subject: 'Roof repair' })];
    render(<Harness isHebrew={isHebrew} quotes={noClient} />);
    const banner = screen.getByTestId('hot-quote-banner');
    expect(banner.querySelector('.quote-hot-banner-name').textContent).toBe('Roof repair');
    expect(banner.querySelector('.quote-hot-banner-text').textContent).toBe(`Roof repair${mid}3${tail}`);
  });

  it('the eye button opens the same tracking details as the hot row action (and never toggles them shut)', () => {
    const { container } = render(<Harness isHebrew={isHebrew} quotes={hotList()} />);
    expect(container.querySelector('.quote-modern-detail')).toBeNull();
    const eye = within(screen.getByTestId('hot-quote-banner')).getAllByRole('button', { name: actionLabel })[0];
    fireEvent.click(eye);
    expect(container.querySelector('#quote-modern-detail-quote-hotB')).not.toBeNull();
    fireEvent.click(eye);
    expect(container.querySelector('#quote-modern-detail-quote-hotB')).not.toBeNull();
    const rowAction = container.querySelector('.quote-modern-item.is-hot .quote-modern-action');
    expect(rowAction).toHaveAttribute('data-action', 'track');
    expect(rowAction).toHaveAttribute('aria-expanded', 'true');
  });
});

// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-25 וב-L-26 לפס "הצעד הבא" לפי התוכנית" - the same banner cycles the next steps
describe('next-step banner (Owner 2026-10-19)', () => {
  // Owner 2026-10-23: the calendar day in the banner's OWN market zone (Hebrew harness = Asia/Jerusalem, English = UTC), stepped by
  // calendar days - a UTC day against the Israel rule failed every run 00:00-03:00 Israel
  const day = (offset, timeZone = 'UTC') => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [y, m, d] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  };
  const tasksClient = (tasks) => ({ from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: tasks, error: null }) }) }) }) });

  it('an overdue task leads, with its "View task" button opening that task through the bell subject event', async () => {
    const task = { id: 't1', user_id: 'u1', status: 'open', title: 'להתקשר לדוד', due_date: day(-8, 'Asia/Jerusalem'), due_time: null };
    const got = [];
    const on = (e) => got.push(e.detail);
    window.addEventListener('tekango-open-bell-subject', on);
    try {
      render(<Harness isHebrew quotes={[mk('a')]} extra={{ tasksClient: tasksClient([task]), userId: 'u1' }} />);
      // Owner 2026-10-19 (L-25 / L-26): the phone's short line repeats the title (aria-hidden) - the full sentence is the one checked here
      const banner = await screen.findByText('להתקשר לדוד', { ignore: '[data-testid="next-step-short"] *, script, style' }).then((n) => n.closest('[data-testid="hot-quote-banner"]'));
      expect(banner).toHaveAttribute('data-step-kind', 'task');
      expect(banner.querySelector('.quote-hot-banner-text').textContent).toMatch(/^משימה באיחור: להתקשר לדוד – הייתה אמורה להתבצע ב-.+\.$/);
      expect(banner.querySelector('bdi.pf-num')).toHaveAttribute('dir', 'ltr');
      fireEvent.click(within(banner).getByTestId('next-step-action'));
      expect(got).toEqual([{ kind: 'task', taskId: 't1' }]);
    } finally { window.removeEventListener('tekango-open-bell-subject', on); }
  });

  it('a quote whose validity ends within 3 days and still awaits the customer gets its own step (EN mirrored)', () => {
    render(<Harness quotes={[mk('exp', { status: 'sent', view_count: 1, valid_until: day(2) })]} />);
    const banner = screen.getByTestId('hot-quote-banner');
    expect(banner).toHaveAttribute('data-step-kind', 'expiring');
    expect(banner.querySelector('.quote-hot-banner-text').textContent).toBe('The quote for Client exp expires in 2 days and still isn’t signed.');
    expect(within(banner).getByTestId('next-step-action').textContent).toBe('Open & track');
  });

  it('nothing due: the approved next-step empty copy', () => {
    render(<Harness isHebrew quotes={[mk('a')]} />);
    expect(screen.getByTestId('hot-quote-empty').textContent).toBe('אין כרגע צעד דחוף. משימה באיחור, הצעה חמה או הצעה שתוקפה מסתיים יופיעו כאן.');
  });
});
