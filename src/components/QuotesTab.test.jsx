import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import QuotesTab from './QuotesTab';
import { formatMoneyForCurrency } from '../utils/money';

// Dashboard's exact injected money formatter (Dashboard.jsx: formatMoneyDisplay = (val, cur) => formatMoneyForCurrency(val, cur || account)).
const canonicalMoney = (accountCurrency) => (val, cur) => formatMoneyForCurrency(val, cur || accountCurrency);

// חוק ברזל (Authenticated App Consolidation task, §6 Mobile Quote History):
// אותו דפוס-mock קיים כבר ב-PublicQuoteHeader.test.jsx - לא הומצא מנגנון
// חדש. isMobileView נקבע ב-lazy initializer מ-window.matchMedia('(max-width:
// 768px)').matches, כך שה-mock חייב להיות מוגדר *לפני* הרינדור.
function mockMobileMatchMedia() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

afterEach(() => {
  delete window.matchMedia;
});

const baseQuote = {
  id: 'quote-test-id-000000',
  status: 'pending',
  signature: null,
  clients: { company_name: 'Test Client', client_type: 'business' },
  subtotal: 100,
  discount: 0,
  total: 118,
  currency: 'ILS',
  tax_rate: 18,
  view_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  quote_items: [{ description: 'Item' }],
  client_type: 'business',
  email_bounced: false,
};

const t = {
  recentHistory: 'History',
  quotesNav: 'Quotes',
  searchQuote: 'Search',
  filterStatus: 'Status',
};

function buildProps(isHebrew, quoteOverrides = {}, handlers = {}) {
  const quote = { ...baseQuote, ...quoteOverrides };
  return {
    quotes: [quote],
    searchTerm: '',
    setSearchTerm: vi.fn(),
    statusFilter: 'All',
    setStatusFilter: vi.fn(),
    quoteSortField: 'date',
    quoteSortDirection: 'desc',
    handleQuoteSort: vi.fn(),
    handleCreateNewQuoteClick: vi.fn(),
    handleExportQuotes: vi.fn(),
    handleEditClick: vi.fn(),
    handleDuplicateQuote: vi.fn(),
    sendWhatsApp: vi.fn(),
    handleDeleteQuote: vi.fn(),
    handleProtectedAction: handlers.handleProtectedAction || vi.fn((id, action, fn) => fn()),
    activeTooltip: { quoteId: null, action: null },
    openDropdownId: null,
    isHebrew,
    isLocalIsraeliBusiness: isHebrew,
    formatNum: (n) => String(n),
    formatMoneyDisplay: canonicalMoney(isHebrew ? 'ILS' : 'USD'),
    t,
    setPendingEmailQuote: vi.fn(),
    emailStatuses: {},
    currency: isHebrew ? 'ILS' : 'USD',
    quote,
  };
}

// חוק ברזל (Authenticated App Consolidation task, §5 Expandable Row): כל
// הבדיקות בקובץ הזה שצריכות לראות פרטים משניים (Client Type/Views/Email/
// Description/Actions) חייבות קודם להרחיב את השורה - בדיוק כמו משתמש אמיתי
// שלוחץ על בקרת-ההרחבה. הפונקציה הזו לוחצת על כפתור-ההרחבה היחיד שקיים
// כרגע ב-DOM (הטבלה מרנדרת שורה אחת בכל הבדיקות האלה).
// The row's view count is wrapped in a bidi-isolated .pf-num atom, so its text is split across nodes: match by full textContent.
const byFullText = (text) => screen.queryAllByText((_content, el) => el.textContent === text && !Array.from(el.children).some((c) => c.textContent === text));

function expandFirstRow() {
  const toggle = screen.getByLabelText(/הצג פרטים נוספים|Show more details/);
  fireEvent.click(toggle);
}

describe.each([
  ['English', false, 'Cannot edit a signed quote', 'Cannot delete a signed quote'],
  ['Hebrew', true, 'לא ניתן לערוך הצעה חתומה', 'לא ניתן למחוק הצעה חתומה'],
])('QuotesTab lock state (%s)', (_label, isHebrew, editTooltip, deleteTooltip) => {
  it('leaves Edit/Delete enabled for a pending quote', () => {
    const props = buildProps(isHebrew, { status: 'pending', signature: null });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    const editBtn = screen.getByText(isHebrew ? 'ערוך' : 'Edit').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק' : 'Delete').closest('button');

    expect(editBtn).not.toBeDisabled();
    expect(deleteBtn).not.toBeDisabled();
    expect(screen.queryByTitle(editTooltip)).not.toBeInTheDocument();
    expect(screen.queryByTitle(deleteTooltip)).not.toBeInTheDocument();
  });

  it('disables Edit/Delete with the correct tooltip for an approved quote', () => {
    const props = buildProps(isHebrew, { status: 'approved', signature: null });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    const editBtn = screen.getByText(isHebrew ? 'ערוך' : 'Edit').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק' : 'Delete').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn).toHaveAttribute('title', editTooltip);
    expect(deleteBtn).toHaveAttribute('title', deleteTooltip);
  });

  it('disables Edit/Delete with the correct tooltip for a paid quote', () => {
    const props = buildProps(isHebrew, { status: 'paid', signature: null });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    const editBtn = screen.getByText(isHebrew ? 'ערוך' : 'Edit').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק' : 'Delete').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn).toHaveAttribute('title', editTooltip);
    expect(deleteBtn).toHaveAttribute('title', deleteTooltip);
  });

  it('disables Edit/Delete for a signed quote with an unrelated status', () => {
    const props = buildProps(isHebrew, { status: 'sent', signature: 'data:image/png;base64,abc' });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    const editBtn = screen.getByText(isHebrew ? 'ערוך' : 'Edit').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק' : 'Delete').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
  });

  it('never invokes the edit/delete handlers when clicking a locked button', () => {
    const handleProtectedAction = vi.fn();
    const props = buildProps(isHebrew, { status: 'approved', signature: null }, { handleProtectedAction });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    const editBtn = screen.getByText(isHebrew ? 'ערוך' : 'Edit').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק' : 'Delete').closest('button');

    fireEvent.click(editBtn);
    fireEvent.click(deleteBtn);

    expect(handleProtectedAction).not.toHaveBeenCalled();
  });
});

// Owner-approved 2026-10-08 list-first desktop row. One DOM order mirrors
// through dir: identity -> status/activity -> date -> fixed money slot -> action.
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Desktop primary row (%s)', (_label, isHebrew) => {
  it('renders the Owner R4 seven-cell desktop row (no Action cell) in one mirrored DOM order', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const row = container.querySelector('.quote-modern-row');
    // Owner R5: the dropdown trigger is the row's first child (positioned in the leading padding, not a grid track); the
    // seven data cells follow it
    expect(row.children).toHaveLength(8);
    expect(row.children[0]).toHaveClass('quote-modern-toggle');
    const cells = [...row.children].slice(1);
    expect(row.querySelector('.quote-modern-action')).toBeNull();
    ['quote-modern-number', 'quote-modern-client', 'quote-modern-title', 'quote-modern-status', 'quote-modern-views', 'quote-modern-date', 'quote-modern-amount']
      .forEach((cls, i) => expect(cells[i]).toHaveClass(cls));
  });

  it('shows subject and activity in the collapsed row, while secondary actions stay in the expansion', () => {
    const props = buildProps(isHebrew, { view_count: 42, quote_items: [{ description: 'A very specific unique description string' }] });
    render(<QuotesTab {...props} />);

    expect(screen.getByText('A very specific unique description string')).toBeInTheDocument();
    // Owner R3: the collapsed row shows the bare view count ONLY in its own Views cell (no label stacked under status).
    expect(document.querySelector('.quote-modern-row .quote-modern-views').textContent).toBe('42');
    expect(byFullText(isHebrew ? '42 צפיות' : '42 views')).toHaveLength(0);
    expect(screen.queryByText(isHebrew ? 'ערוך' : 'Edit')).not.toBeInTheDocument();
  });

  it('uses one fixed tabular money slot for place-value alignment', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);
    const amount = container.querySelector('.quote-modern-amount');
    expect(amount).toHaveClass('pf-num', 'pf-money', 'pf-money-slot');
  });

  it('expands the detail panel with aria-expanded/aria-controls wired to the panel, and toggles closed on a second click', () => {
    const props = buildProps(isHebrew);
    render(<QuotesTab {...props} />);

    const toggle = screen.getByLabelText(/הצג פרטים נוספים|Show more details/);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(panelId)).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(panelId)).toBeNull();
  });

  it('shows Client Type, Views, and the item description once the row is expanded', () => {
    const props = buildProps(isHebrew, { view_count: 7, quote_items: [{ description: 'A very specific unique description string' }] });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    expect(screen.getAllByText('A very specific unique description string')).toHaveLength(2);
    expect(document.querySelector('.quote-modern-row .quote-modern-views').textContent).toBe('7');
    expect(byFullText(isHebrew ? '7 צפיות' : '7 views')).toHaveLength(1);
    expect(screen.getByText(isHebrew ? 'לקוח עסקי' : 'Business Client')).toBeInTheDocument();
  });

  it('only the expanded quote renders its detail panel when multiple quotes are present (single-expand/accordion model)', () => {
    const quoteB = { ...baseQuote, id: 'quote-test-id-000001', clients: { company_name: 'Second Client', client_type: 'private' } };
    const props = { ...buildProps(isHebrew), quotes: [baseQuote, quoteB] };
    render(<QuotesTab {...props} />);

    const toggles = screen.getAllByLabelText(/הצג פרטים נוספים|Show more details/);
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggles[1]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
  });
});

// חוק ברזל (Final Quote-History Polish task - HE-Only Before-VAT Density +
// Market Separation, נשמר): "לפני מע"מ" הוא ריכוז עסקי מקומי-ישראלי בלבד.
describe('QuotesTab Amount cell - HE-only Before-VAT tooltip (Market Separation)', () => {
  it('HE: shows only the final amount visibly, with the before-VAT value available as a title tooltip', () => {
    const props = buildProps(true, { total: 200 });
    const { container } = render(<QuotesTab {...props} />);

    const amountCell = container.querySelector('.quote-modern-amount');
    expect(amountCell.textContent).not.toContain('לפני מע"מ');
    expect(amountCell.getAttribute('title')).toContain('לפני מע״מ');
  });

  it('EN: never renders a before-VAT title attribute, even though no equivalent International semantic exists', () => {
    const props = buildProps(false, { total: 200 });
    const { container } = render(<QuotesTab {...props} />);

    const amountCell = container.querySelector('.quote-modern-amount');
    expect(amountCell.getAttribute('title')).toBeNull();
  });
});

// חוק ברזל (Authenticated App Consolidation task, §4): Views עבר לפאנל-
// ההרחבה - הבדיקה מגנה על כך שהערך (כולל 0, ערך תקף ולא "חסר") עדיין
// מוצג בפועל אחרי הרחבה, בשתי השפות.
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Views (expanded detail panel) (%s)', (_label, isHebrew) => {
  it.each([0, 1, 19, 999])('renders the real view_count=%i once expanded, including the valid value 0', (viewCount) => {
    const props = buildProps(isHebrew, { view_count: viewCount });
    render(<QuotesTab {...props} />);
    expandFirstRow();

    expect(document.querySelector('.quote-modern-row .quote-modern-views').textContent).toBe(String(viewCount));
    expect(byFullText(isHebrew ? `${viewCount} צפיות` : `${viewCount} views`)).toHaveLength(1);
  });
});

// חוק ברזל (Quote History Final Polish task, Part M - Email Indicator
// Regression, נשמר - עבר לפאנל-ההרחבה): renderEmailDot הוא פונקציונלי, לא
// דקורטיבי - RED = email_bounced=true *או* emailStatus קיים-אך-לא-'success';
// GREEN = emailStatus==='success'; BLANK = שני התנאים falsy (ואז אין שורת
// מייל כלל בפאנל-ההרחבה, לא רק נקודה חסרה).
describe('QuotesTab email indicator (functional, not decorative)', () => {
  it('renders no email-status line when there is no bounce and no send attempt', () => {
    const props = buildProps(true, { email_bounced: false });
    render(<QuotesTab {...props} />);
    expandFirstRow();
    expect(screen.queryByText(/אימייל נשלח בהצלחה|שליחת האימייל נכשלה|כתובת המייל אינה קיימת/)).not.toBeInTheDocument();
  });

  it('renders a bounced-state message when quote.email_bounced is true, regardless of emailStatus', () => {
    const props = buildProps(true, { email_bounced: true });
    render(<QuotesTab {...props} />);
    expandFirstRow();
    expect(screen.getByText('כתובת המייל אינה קיימת')).toBeInTheDocument();
  });

  it('renders a success-state message when emailStatus is "success"', () => {
    const props = buildProps(false, { id: baseQuote.id, email_bounced: false });
    props.emailStatuses = { [baseQuote.id]: 'success' };
    render(<QuotesTab {...props} />);
    expandFirstRow();
    expect(screen.getByText('Email sent successfully')).toBeInTheDocument();
  });
});

// חוק ברזל (Authenticated App Consolidation task, §6): הכרטיס הנייד חולק
// את אותה "פילוסופיית אינטראקציה" עם הדסקטופ (PRIMARY תמיד גלוי, SECONDARY
// מאחורי הרחבה) - הבדיקות האלה מגנות על כך שהכרטיס עצמו הוא כפתור-נגיש
// (aria-expanded, לא רק div+onClick) ושהשדות ה-PRIMARY (שם/סכום/מספר
// הזמנה/תאריך/סטטוס) גלויים תמיד, בעוד Description/Views/Client Type
// דורשים הרחבה - זהה לעקרון הדסקטופ, layout שונה בלבד.
describe('QuotesTab mobile card (§6)', () => {
  it('renders the primary fields directly on the card and hides secondary fields until expanded', () => {
    mockMobileMatchMedia();
    const props = buildProps(true, { view_count: 3, quote_items: [{ description: 'Mobile-only unique description' }] });
    render(<QuotesTab {...props} />);

    // Primary: client name, amount, order#, date, status badge are all
    // immediately visible without any interaction.
    expect(within(document.querySelector('.quote-card')).getByText('Test Client')).toBeInTheDocument();
    expect(screen.getAllByText(/118/)[0]).toBeInTheDocument();

    // Secondary: description/views are not visible until expanded.
    expect(screen.queryByText('Mobile-only unique description')).not.toBeInTheDocument();
    expect(screen.queryByText('3 צפיות')).not.toBeInTheDocument();
  });

  it('the whole card is a real, keyboard-activatable button that toggles aria-expanded and reveals the detail panel', () => {
    mockMobileMatchMedia();
    const props = buildProps(true, { quote_items: [{ description: 'Mobile-only unique description' }] });
    render(<QuotesTab {...props} />);

    const card = document.querySelector('.quote-card button');
    expect(card.tagName).toBe('BUTTON');
    expect(card).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Mobile-only unique description')).toBeInTheDocument();
  });

  it.each([
    ['Hebrew/RTL', true],
    ['English/LTR', false],
  ])('places the chevron as the very first child of the card button, before the client name (Owner correction: chevron at the start of the reading direction) - %s', (_label, isHebrew) => {
    mockMobileMatchMedia();
    const props = buildProps(isHebrew);
    render(<QuotesTab {...props} />);

    const card = document.querySelector('.quote-card button');
    const firstChild = card.firstElementChild;
    // The chevron is an <svg> (lucide-react ChevronDown); the content div
    // (name/amount/order/date/status) is a second, later child.
    expect(firstChild.tagName.toLowerCase()).toBe('svg');
    expect(card.querySelector('.pf-font-variable')).not.toBe(firstChild);
  });
});

// Owner approval 2026-10-08 supersedes the earlier sketch-only R25 rollback:
// the compact overview is now an explicit part of the quote-list-first
// dashboard and must derive from the complete collection, not filtered rows.
function mockMediaQueries(matching) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}
const TABLET_QUERY = '(min-width: 769px) and (max-width: 1180px)';
const STATUS_MIX = [
  { ...baseQuote, id: 'q-draft-1', status: 'draft' },
  { ...baseQuote, id: 'q-sent-1', status: 'sent' },
  { ...baseQuote, id: 'q-approved-1', status: 'approved' },
  { ...baseQuote, id: 'q-paid-1', status: 'paid' },
];

describe.each([
  ['Hebrew/RTL', true, ['הצעות', 'ממתינות', 'אושרו', 'סה״כ']], // Task 23: plural approved-count label
  ['English/LTR', false, ['Quotes', 'Awaiting', 'Approved', 'Total value']],
])('QuotesTab quote-list-first overview - %s', (_label, isHebrew, metricLabels) => {
  it.each([
    ['tablet', () => mockMediaQueries([TABLET_QUERY])],
    ['desktop', () => mockMediaQueries([])],
    ['phone', () => mockMobileMatchMedia()],
  ])('%s: renders one compact overview with all four real-data labels', (_vp, setup) => {
    setup();
    render(<QuotesTab {...buildProps(isHebrew)} quotes={STATUS_MIX} allQuotes={STATUS_MIX} />);
    const overview = screen.getByTestId('quote-overview');
    metricLabels.forEach((label) => expect(overview).toHaveTextContent(label));
    expect(overview.querySelectorAll('[data-qh-overview]')).toHaveLength(4);
  });
  it('desktop/tablet header keeps title/export and search/status controls', () => {
    mockMediaQueries([TABLET_QUERY]);
    render(<QuotesTab {...buildProps(isHebrew)} quotes={STATUS_MIX} />);
    const headerRow = screen.getByTestId('quote-list-header');
    expect(headerRow.children).toHaveLength(2);
    expect(headerRow.children[0].querySelector('h2')).not.toBeNull();
    expect(headerRow.children[1].querySelector('input')).not.toBeNull();
    // the status filter (base capability) still lists every status
    const opts = [...headerRow.querySelectorAll('select option')].map((o) => o.value);
    // night task 2026-10-16 (R-07, Owner-approved L-13 / L-14): the filter speaks the shown status labels
    expect(opts).toEqual(['All', 'needs_sending', 'unfinished', 'sent', 'hot', 'approved', 'paid']);
  });
  it('keeps overview totals stable when the visible list is filtered', () => {
    const props = buildProps(isHebrew);
    render(<QuotesTab {...props} quotes={[STATUS_MIX[0]]} allQuotes={STATUS_MIX} />);
    expect(screen.getByTestId('quote-overview').querySelector('[data-qh-overview="all"]')).toHaveTextContent('4');
  });
});

describe.each([
  ['Hebrew/RTL', true, 'הצעה חמה'],
  ['English/LTR', false, 'Hot quote'],
])('QuotesTab inline hot quote signal - %s', (_label, isHebrew, label) => {
  it('marks only a viewed, non-final quote as hot without inventing a persisted status', () => {
    const hot = { ...baseQuote, view_count: 3, status: 'sent' };
    const final = { ...baseQuote, id: 'approved-quote', view_count: 12, status: 'approved' };
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[hot, final]} allQuotes={[hot, final]} />);
    expect(container.querySelectorAll('.quote-modern-item[data-hot-quote="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.quote-modern-item.is-hot')).toHaveLength(1);
  });

  // Owner update 2026-10-09 (all devices): the "hot quote" title and the flame are removed; the orange frame stays
  it('renders no "hot quote" title and no flame / emoji glyph anywhere (row, banner)', () => {
    const hot = { ...baseQuote, view_count: 5, status: 'sent' };
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[hot]} allQuotes={[hot]} />);
    expect(container.querySelector('.quote-modern-hot, .quote-card-hot, .quote-hot-banner-flame, .quote-hot-banner-label')).toBeNull();
    expect(container.textContent).not.toContain(label);
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(container.querySelector('.quote-modern-item.is-hot')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Approved 980px dashboard (2026-10-08) behaviour
// ---------------------------------------------------------------------------------------------------------------------------
const mk = (id, over = {}) => ({ ...baseQuote, id, clients: { company_name: `Client ${id}`, client_type: 'business' }, ...over });

describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab approved toolbar - %s', (_label, isHebrew) => {
  it('renders Sort, Filter, Search, New quote in ONE DOM order with no inline direction override (dir mirrors it)', () => {
    const props = { ...buildProps(isHebrew), onCreateQuote: vi.fn() };
    const { container } = render(<QuotesTab {...props} />);
    const controls = container.querySelector('.quote-workspace-controls');
    expect(controls.getAttribute('style')).toBeNull();
    expect(controls.hasAttribute('dir')).toBe(false);
    const kids = [...controls.children].map((c) => c.className.split(' ')[0]);
    // Owner console 2026-10-18, typed: "את היצוא לאקסל למקם מימין למיון": the export is first, beside Sort
    expect(kids).toEqual(['quote-export-compact', 'quote-sort-direction', 'quote-filter-control', 'quote-search-control', 'pf-newquote-menu']);
    controls.querySelectorAll('[style]').forEach((el) => expect(el.getAttribute('style')).not.toMatch(/direction/));
  });

  it('keeps the header at exactly two children and no History icon next to the title', () => {
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} onCreateQuote={vi.fn()} />);
    const header = screen.getByTestId('quote-list-header');
    expect(header.children).toHaveLength(2);
    expect(header.querySelector('h2').querySelector('svg')).toBeNull();
    expect(container.querySelector('.quote-workspace-title').textContent).toBe('Quotes');
  });

  it('uses short visible labels with the long wording in aria-label, and the search input still works', () => {
    const props = { ...buildProps(isHebrew), onCreateQuote: vi.fn() };
    render(<QuotesTab {...props} />);
    const search = screen.getByRole('textbox');
    expect(search).toHaveAttribute('placeholder', isHebrew ? 'חיפוש' : 'Search');
    expect(search).toHaveAttribute('aria-label', 'Search');
    fireEvent.change(search, { target: { value: 'abc' } });
    expect(props.setSearchTerm).toHaveBeenCalledWith('abc');
    const sort = screen.getByRole('button', { name: isHebrew ? 'הפוך כיוון מיון' : 'Toggle sort direction' });
    expect(sort).toHaveTextContent(isHebrew ? 'מיון' : 'Sort');
    fireEvent.click(sort);
    expect(props.handleQuoteSort).toHaveBeenCalledWith('date');
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'sent' } });
    expect(props.setStatusFilter).toHaveBeenCalledWith('sent');
  });

  it('the New quote button is a menu with the three plain-language choices wired to their handlers', () => {
    const onCreateQuote = vi.fn();
    const onCreateAiQuote = vi.fn();
    const onCreateStructuredQuote = vi.fn();
    render(<QuotesTab {...buildProps(isHebrew)} onCreateQuote={onCreateQuote} onCreateAiQuote={onCreateAiQuote} onCreateStructuredQuote={onCreateStructuredQuote} />);
    const trigger = screen.getByRole('button', { name: isHebrew ? 'הצעת מחיר חדשה' : 'New quote' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.dataset.choice)).toEqual(['standard', 'ai', 'structured']);
    fireEvent.click(items[1]);
    expect(onCreateAiQuote).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(screen.getAllByRole('menuitem')[2]);
    expect(onCreateStructuredQuote).toHaveBeenCalledTimes(1);
    fireEvent.click(trigger);
    fireEvent.click(screen.getAllByRole('menuitem')[0]);
    expect(onCreateQuote).toHaveBeenCalledTimes(1);
  });

  it('the menu closes on Escape and on an outside click', () => {
    render(<QuotesTab {...buildProps(isHebrew)} onCreateQuote={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: isHebrew ? 'הצעת מחיר חדשה' : 'New quote' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab approved rows - %s', (_label, isHebrew) => {
  it('orders each row number -> client -> title -> status -> views -> date -> amount, one value per cell', () => {
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} />);
    const row = container.querySelector('.quote-modern-row');
    // Owner R5: the leading-edge dropdown trigger comes first and is not a data cell
    const cells = [...row.children].filter((c) => !c.classList.contains('quote-modern-toggle'));
    expect(cells.map((c) => [...c.classList].find((k) => k.startsWith('quote-modern-')))).toEqual(['quote-modern-number', 'quote-modern-client', 'quote-modern-title', 'quote-modern-status', 'quote-modern-views', 'quote-modern-date', 'quote-modern-amount']);
    expect(cells[0]).toHaveClass('quote-modern-number', 'pf-num');
    expect(cells[0]).toHaveAttribute('dir', 'ltr');
    expect(cells[4]).toHaveClass('pf-num');
    expect(cells[4]).toHaveAttribute('dir', 'ltr');
    expect(row.querySelector('.quote-modern-text, .quote-modern-identity, .quote-modern-state, .quote-modern-subject')).toBeNull();
  });

  it('wraps the currency symbol for spacing without changing the amount text', () => {
    const { container } = render(<QuotesTab {...buildProps(isHebrew, { total: 1227.2, currency: 'ILS' })} />);
    const amount = container.querySelector('.quote-modern-amount');
    expect(amount.querySelector('.pf-money-sym').textContent).toBe('₪');
    // the text is exactly symbol + the canonical formatter output (IRON-ILS-001: raw 1227.2 -> 1,227.00)
    expect(amount.textContent).toBe(`₪${formatMoneyForCurrency(1227.2, 'ILS')}`);
    expect(amount.textContent).toBe('₪1,227.00');
  });

  // Owner console 2026-10-18, typed: "שיראה מסך מלא לפי דפים, הסתיים הדף שיהיה כפתור למטה להציג את הדף הבא" + "שההצעה תופיע לפי הסדר" (accepted: "מעולה, תנעל")
  it('pages: a full page, then "next page" shows the following quotes in order; "page X of Y"; every quote exactly once', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `q${String(i).padStart(2, '0')}`);
    const all = ids.map((id) => mk(id));
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={all} allQuotes={all} />);
    const names = () => [...container.querySelectorAll('.quote-modern-client-name')].map((n) => n.textContent);
    const page1 = names();
    expect(page1).toHaveLength(10); // the page size before the screen is measured
    const info = () => container.querySelector('.quote-modern-page-info').textContent;
    expect(info()).toBe(isHebrew ? 'עמוד 1 מתוך 2' : 'Page 1 of 2');
    expect(container.querySelector('[data-page="prev"]').disabled).toBe(true);
    fireEvent.click(container.querySelector('[data-page="next"]'));
    const page2 = names();
    expect(info()).toBe(isHebrew ? 'עמוד 2 מתוך 2' : 'Page 2 of 2');
    expect(container.querySelector('[data-page="next"]').disabled).toBe(true);
    expect([...page1, ...page2]).toEqual(all.map((q) => q.clients.company_name));
    expect(screen.queryByText(isHebrew ? 'הצגת כל ההצעות' : 'Show all quotes')).toBeNull();
  });

  // Owner console 2026-10-18 ("שההצעה תופיע לפי הסדר"): no hot quote is promoted - every quote keeps its sorted place, none is dropped
  it('keeps every quote, hot ones included, in the list order - none promoted, none dropped, none duplicated', () => {
    const list = [mk('a'), mk('b'), mk('c'), mk('d'), mk('hotA', { view_count: 4, status: 'sent', created_at: '2026-02-01T00:00:00.000Z' }), mk('hotB', { view_count: 9, status: 'sent', created_at: '2026-01-15T00:00:00.000Z' })];
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={list} allQuotes={list} />);
    const names = [...container.querySelectorAll('.quote-modern-client-name')].map((n) => n.textContent);
    // the default order is newest first: hotA (Feb), hotB (Jan), then the others - the hottest (hotB, 9 views) is NOT moved to the top
    expect(names.slice(0, 2)).toEqual(['Client hotA', 'Client hotB']);
    expect([...names].sort()).toEqual(list.map((q) => q.clients.company_name).sort());
    expect(container.querySelectorAll('.quote-modern-item.is-hot')).toHaveLength(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it('breaks a views tie by the newest quote', () => {
    const list = [mk('a'), mk('old', { view_count: 5, status: 'sent', created_at: '2026-01-01T00:00:00.000Z' }), mk('new', { view_count: 5, status: 'sent', created_at: '2026-03-01T00:00:00.000Z' })];
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={list} allQuotes={list} />);
    expect(container.querySelector('.quote-modern-client-name').textContent).toBe('Client new');
  });

  it('action label precedence: hot -> Open & track (even for a draft), unfinished draft -> Continue editing, complete draft -> Open, approved/paid -> View', () => {
    const label = (quote) => {
      const { container, unmount } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[quote]} allQuotes={[quote]} />);
      expect(container.querySelector('.quote-modern-action')).toBeNull(); // collapsed: no always-visible action
      fireEvent.click(container.querySelector('.quote-modern-toggle'));
      const text = container.querySelector('.quote-modern-detail .quote-modern-action').textContent;
      unmount();
      return text;
    };
    expect(label(mk('x', { status: 'draft', view_count: 3 }))).toBe(isHebrew ? 'פתיחה ומעקב' : 'Open & track');
    expect(label(mk('x', { status: 'sent', view_count: 3 }))).toBe(isHebrew ? 'פתיחה ומעקב' : 'Open & track');
    expect(label(mk('x', { status: 'draft', total: 0 }))).toBe(isHebrew ? 'המשך עריכה' : 'Continue editing');
    expect(label(mk('x', { status: 'draft' }))).toBe(isHebrew ? 'פתיחה' : 'Open');
    expect(label(mk('x', { status: 'approved', view_count: 8 }))).toBe(isHebrew ? 'צפייה' : 'View');
    expect(label(mk('x', { status: 'paid' }))).toBe(isHebrew ? 'צפייה' : 'View');
  });

  it('derives the state text: complete draft = Needs sending, unfinished draft = Draft, hot = Viewed/awaiting, approved colored text', () => {
    const state = (quote) => {
      const { container, unmount } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[quote]} allQuotes={[quote]} />);
      const el = container.querySelector('.quote-modern-status');
      const out = [el.textContent, el.dataset.tone];
      unmount();
      return out;
    };
    expect(state(mk('x', { status: 'draft' }))).toEqual([isHebrew ? 'צריך לשלוח' : 'Needs sending', 'needs-sending']);
    expect(state(mk('x', { status: 'draft', total: 0 }))).toEqual([isHebrew ? 'טיוטה' : 'Draft', 'draft']);
    expect(state(mk('x', { status: 'sent', view_count: 4 }))).toEqual([isHebrew ? 'נצפתה, ממתינה' : 'Viewed, awaiting', 'hot']);
    expect(state(mk('x', { status: 'approved' }))).toEqual([isHebrew ? 'אושרה' : 'Approved', 'approved']);
    // Owner 2026-10-15: a sent quote the customer has not opened yet says so; once opened it is plain Sent (3+ opens = hot)
    expect(state(mk('x', { status: 'sent', view_count: 0 }))).toEqual([isHebrew ? 'נשלחה · טרם נצפתה' : 'Sent · not viewed yet', 'sent']);
    // AUD-03 (Owner 2026-10-15): opened 1-2 times = "Sent · viewed" (also a Draft whose link was shared by hand); 3+ = hot
    expect(state(mk('x', { status: 'sent', view_count: 1 }))).toEqual([isHebrew ? 'נשלחה · נצפתה' : 'Sent · viewed', 'sent']);
    expect(state(mk('x', { status: 'draft', view_count: 2 }))).toEqual([isHebrew ? 'נשלחה · נצפתה' : 'Sent · viewed', 'sent']);
    expect(state(mk('x', { status: 'draft', view_count: 3 }))).toEqual([isHebrew ? 'נצפתה, ממתינה' : 'Viewed, awaiting', 'hot']);  });

  it('dropdown primary actions use the existing handlers: edit for Continue editing, the public link for View, the tracking panel for Open / Open & track', () => {
    const handleProtectedAction = vi.fn((id, action, fn) => fn());
    const handleEditClick = vi.fn();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = { ...buildProps(isHebrew, {}, { handleProtectedAction }), handleEditClick };

    const unfinished = mk('u', { status: 'draft', total: 0 });
    const r1 = render(<QuotesTab {...props} quotes={[unfinished]} allQuotes={[unfinished]} />);
    fireEvent.click(r1.container.querySelector('.quote-modern-toggle'));
    fireEvent.click(r1.container.querySelector('.quote-modern-detail .quote-modern-action'));
    expect(handleProtectedAction).toHaveBeenCalledWith('u', 'edit', expect.any(Function));
    expect(handleEditClick).toHaveBeenCalledWith(unfinished);
    r1.unmount();

    const approved = mk('p', { status: 'approved' });
    const r2 = render(<QuotesTab {...props} quotes={[approved]} allQuotes={[approved]} />);
    fireEvent.click(r2.container.querySelector('.quote-modern-toggle'));
    fireEvent.click(r2.container.querySelector('.quote-modern-detail .quote-modern-action'));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/public-quote/p'), '_blank');
    r2.unmount();

    const hot = mk('h', { status: 'sent', view_count: 5 });
    const r3 = render(<QuotesTab {...props} quotes={[hot]} allQuotes={[hot]} />);
    const trigger = r3.container.querySelector('.quote-modern-toggle');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const action = r3.container.querySelector('.quote-modern-detail .quote-modern-action');
    expect(action).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(action.getAttribute('aria-controls'))).toBeTruthy();
    fireEvent.click(action); // Open & track from inside the dropdown never toggles it shut
    expect(document.getElementById(action.getAttribute('aria-controls'))).toBeTruthy();
    // the label never flips to Close
    expect(action.textContent).toBe(isHebrew ? 'פתיחה ומעקב' : 'Open & track');
    r3.unmount();
    open.mockRestore();
  });

  it('every row, hot or not, reserves the same transparent 4px start edge through one identical grid (no per-row template)', () => {
    const list = [mk('a'), mk('h', { status: 'sent', view_count: 5 })];
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={list} allQuotes={list} />);
    const rows = container.querySelectorAll('.quote-modern-row');
    expect(rows).toHaveLength(2);
    rows.forEach((row) => expect(row.getAttribute('style')).toBeNull());
    expect(container.querySelector('.quote-modern-list')).toHaveAttribute('dir', isHebrew ? 'rtl' : 'ltr');
  });

  it('shows today / yesterday with an isolated time and an older quote as its short date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
    try {
      const list = [mk('t', { created_at: '2026-10-08T06:10:00.000Z' }), mk('y', { created_at: '2026-10-07T06:20:00.000Z' }), mk('o', { created_at: '2026-01-01T00:00:00.000Z' })];
      const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={list} allQuotes={list} />);
      const dates = [...container.querySelectorAll('.quote-modern-date')].map((d) => d.textContent);
      expect(dates[0]).toMatch(isHebrew ? /^היום, \d{2}:\d{2}$/ : /^Today, \d{2}:\d{2}$/);
      expect(dates[1]).toMatch(isHebrew ? /^אתמול, \d{2}:\d{2}$/ : /^Yesterday, \d{2}:\d{2}$/);
      expect(dates[2]).toBe(isHebrew ? '01/01/2026' : '01/01/2026');
      container.querySelectorAll('.quote-modern-date bdi').forEach((b) => {
        expect(b).toHaveAttribute('dir', 'ltr');
        expect(b).toHaveClass('pf-num');
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

// IRON-ILS-001: HE/Local/ILS shows every amount as the nearest whole shekel (half-up) with ".00" - rows, overview, cards and
// tooltips all use the ONE canonical formatter (no exact-cent list formatter). Display only: the passed data never changes.
describe('IRON-ILS-001 QuotesTab amounts use the canonical formatter only', () => {
  const ilsProps = (list) => ({ ...buildProps(true), quotes: list, allQuotes: list, formatMoneyDisplay: canonicalMoney('ILS') });
  const rowAmounts = (c) => [...c.querySelectorAll('.quote-modern-amount')].map((e) => e.textContent);
  const overviewTotal = () => screen.getByTestId('quote-overview').querySelector('[data-qh-overview="total"] .pf-money').textContent;

  it('Local/ILS: raw 1227.20 renders ₪1,227.00 in the row and the 18,397.20 total renders ₪18,397.00 in the overview', () => {
    const list = [mk('1', { total: 1227.2, status: 'sent' }), mk('2', { total: 17170, status: 'draft' })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    expect(rowAmounts(container)).toContain('₪1,227.00');
    expect(overviewTotal()).toBe('₪18,397.00');
    expect(container.textContent).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
  });

  it('Local/ILS: half-up - raw 1227.50 renders ₪1,228.00', () => {
    const list = [mk('1', { total: 1227.5 })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    expect(rowAmounts(container)).toEqual(['₪1,228.00']);
    expect(overviewTotal()).toBe('₪1,228.00');
  });

  it('Local/ILS: a negative half value shows exactly the canonical function result (half away from zero)', () => {
    const list = [mk('1', { total: -1227.5 })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    const canonical = formatMoneyForCurrency(-1227.5, 'ILS');
    expect(canonical).toBe('-1,228.00');
    expect(rowAmounts(container)).toEqual([`₪${canonical}`]);
    expect(overviewTotal()).toBe(`₪${canonical}`);
  });

  it('display only: the quotes handed to the component are not mutated', () => {
    const list = [mk('1', { total: 1227.2 }), mk('2', { total: 18397.2 }), mk('3', { total: 1227.5 })];
    const before = JSON.parse(JSON.stringify(list));
    render(<QuotesTab {...ilsProps(list)} />);
    expect(list).toEqual(before);
    expect(list.map((q) => q.total)).toEqual([1227.2, 18397.2, 1227.5]);
  });

  it('Local/ILS mobile cards and the overview use the same whole-shekel text', () => {
    mockMobileMatchMedia();
    const list = [mk('1', { total: 1227.2 }), mk('2', { total: 191.16 })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    const cardAmounts = [...container.querySelectorAll('.quote-card [data-qh="amount"]')].map((e) => e.textContent);
    expect(cardAmounts.length).toBeGreaterThan(0);
    for (const a of cardAmounts) expect(a).toMatch(/\.00$/);
    expect(container.textContent).toContain('₪1,227.00');
    expect(container.textContent).toContain('₪191.00');
    expect(container.textContent).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
  });

  it.each([['USD', '$'], ['EUR', '€'], ['GBP', '£']])('International %s keeps cents (1,227.20) in the row and the overview', (cur, symbol) => {
    const list = [mk('1', { total: 1227.2, currency: cur }), mk('2', { total: 17170, currency: cur })];
    const props = { ...buildProps(false), quotes: list, allQuotes: list, currency: cur, formatMoneyDisplay: canonicalMoney(cur) };
    const { container } = render(<QuotesTab {...props} />);
    expect(rowAmounts(container)).toContain(`${symbol}1,227.20`);
    expect(overviewTotal()).toBe(`${symbol}18,397.20`);
    expect(container.textContent).not.toContain('₪');
  });

  it('marks 13+ character amounts as long from the SAME canonical text that is displayed', () => {
    const list = [mk('1', { total: 1234567.4 }), mk('2', { total: 12345 })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    const amounts = [...container.querySelectorAll('.quote-modern-amount')];
    const long = amounts.find((a) => a.textContent === '₪1,234,567.00');
    const short = amounts.find((a) => a.textContent === '₪12,345.00');
    expect(long).toHaveClass('is-long');
    expect(short).not.toHaveClass('is-long');
  });

  it('a plain sent quote is tone "sent" (teal) and only a hot quote is tone "hot"', () => {
    const list = [mk('1', { status: 'sent', view_count: 1 }), mk('2', { status: 'sent', view_count: 5 })];
    const { container } = render(<QuotesTab {...buildProps(false)} quotes={list} allQuotes={list} />);
    const tones = [...container.querySelectorAll('.quote-modern-status')].map((e) => e.dataset.tone).sort();
    expect(tones).toEqual(['hot', 'sent']);
  });
});

describe('QuotesTab overview (approved strip)', () => {
  it('counts Awaiting as sent quotes only and Approved as approved + paid, in the cell order quotes / awaiting / approved / total', () => {
    const list = [mk('1', { status: 'draft' }), mk('2', { status: 'sent' }), mk('3', { status: 'sent' }), mk('4', { status: 'approved' }), mk('5', { status: 'paid' })];
    render(<QuotesTab {...buildProps(true)} quotes={list} allQuotes={list} />);
    const cells = [...screen.getByTestId('quote-overview').querySelectorAll('[data-qh-overview]')];
    expect(cells.map((c) => c.dataset.qhOverview)).toEqual(['all', 'awaiting', 'approved', 'total']);
    expect(cells[0].querySelector('.quote-overview-value').textContent).toBe('5');
    expect(cells[1].querySelector('.quote-overview-value').textContent).toBe('2');
    expect(cells[2].querySelector('.quote-overview-value').textContent).toBe('2');
    expect(cells[3].querySelector('.pf-money-sym').textContent).toBe('₪');
    cells.forEach((c) => expect(c.firstElementChild).toHaveClass('quote-overview-value'));
  });
});

// Owner R4 (2026-10-08 23:05): no Action column, every row action inside the row dropdown, quote numbers without '#', shown in full.
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Owner R4 - %s', (_label, isHebrew) => {
  it('renders no Action header and no action cell; the chevron trigger is the existing accessible expand button (not a column)', () => {
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} />);
    expect(container.querySelector('.quote-modern-head-action, [data-sort-key="action"]')).toBeNull();
    expect(container.querySelectorAll('.quote-modern-head-row > [role="columnheader"]')).toHaveLength(7);
    const trigger = container.querySelector('.quote-modern-row > .quote-modern-toggle'); // Owner R5: moved to the row edge
    expect(trigger.tagName).toBe('BUTTON'); // native button: Enter/Space and touch activation for free
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger.getAttribute('aria-label')).toMatch(isHebrew ? /הצג פרטים נוספים/ : /Show more details/);
    expect(trigger.querySelector('svg.quote-modern-chevron')).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-controls', `quote-modern-detail-${baseQuote.id}`);
  });

  it('every prior row action is reachable in the dropdown: the status-aware primary action first, then View/Edit/Duplicate/WhatsApp/Email/Delete', () => {
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} />);
    fireEvent.click(container.querySelector('.quote-modern-toggle'));
    const panel = container.querySelector('.quote-modern-detail');
    const primary = panel.querySelector('.quote-modern-action');
    expect(primary).not.toBeNull();
    expect(primary.dataset.action).toBeTruthy();
    const text = panel.textContent;
    for (const label of isHebrew ? ['צפה', 'ערוך', 'שכפל', 'וואטסאפ', 'שלח במייל', 'מחק'] : ['View', 'Edit', 'Duplicate', 'WhatsApp', 'Email', 'Delete']) expect(text).toContain(label);
    // the primary action is the first focusable control in the dropdown (focus order: trigger -> primary -> secondary)
    expect(panel.querySelector('button')).toBe(primary);
  });

  it('displays quote numbers without a literal # and in full (long alphanumeric), LTR-isolated', () => {
    const long = mk('long', { quote_number: 1234567890 });
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[long, mk('n')]} allQuotes={[long, mk('n')]} />);
    const numbers = [...container.querySelectorAll('.quote-modern-number')];
    expect(numbers.length).toBe(2);
    for (const n of numbers) {
      expect(n.textContent.startsWith('#')).toBe(false);
      expect(n).toHaveAttribute('dir', 'ltr');
      expect(n).toHaveClass('pf-num');
    }
    expect(numbers.some((n) => n.textContent === 'A1234567890')).toBe(true);
    expect(numbers.some((n) => /…|\.\.\./.test(n.textContent))).toBe(false);
  });

  it('a quote without a persisted number still shows its id fallback without the # prefix', () => {
    const noNum = mk('nonum', { quote_number: null });
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[noNum]} allQuotes={[noNum]} />);
    const n = container.querySelector('.quote-modern-number').textContent;
    expect(n.startsWith('#')).toBe(false);
    expect(n.length).toBeGreaterThan(0);
  });
});

// Owner R5 (2026-10-08 23:50): the dropdown trigger is the row's structural leading-edge control (right in HE, left in EN) -
// outside the quote-number content and NOT inside the Client cell; the Client cell holds only the client name (no phantom gap).
// Rendered x-geometry of the actual visible header labels vs row content is proven by the real-browser matrix in
// evidence/managed-dashboard-final/r5/.
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Owner R5 leading-edge trigger - %s', (_label, isHebrew) => {
  it('the trigger is the first child of every row, a native button outside the Client and quote-number cells', () => {
    const quotes = [mk('a'), mk('b', { status: 'sent', view_count: 5 }), mk('c', { status: 'approved' })];
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={quotes} allQuotes={quotes} />);
    const list = container.querySelector('.quote-modern-list');
    // the structural leading edge comes from the real list direction: right in HE, left in EN
    expect(list).toHaveAttribute('dir', isHebrew ? 'rtl' : 'ltr');
    const rows = [...container.querySelectorAll('.quote-modern-row')];
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const trigger = row.firstElementChild;
      expect(trigger).toHaveClass('quote-modern-toggle');
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger.getAttribute('aria-label')).toMatch(isHebrew ? /הצג פרטים נוספים/ : /Show more details/);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.querySelector('svg.quote-modern-chevron')).not.toBeNull();
      // immediately followed by the quote-number cell (the trigger sits beside/outside it)
      expect(trigger.nextElementSibling).toHaveClass('quote-modern-number');
      expect(row.querySelectorAll('.quote-modern-toggle')).toHaveLength(1);
      const client = row.querySelector(':scope > .quote-modern-client');
      expect(client.tagName).toBe('SPAN');
      expect(client.contains(trigger)).toBe(false);
      expect(client.querySelector('button, svg, .quote-modern-chevron')).toBeNull();
      // the client cell holds only the name: nothing before it can leave a gap
      expect([...client.children].map((c) => c.className)).toEqual(['quote-modern-client-name']);
      const number = row.querySelector(':scope > .quote-modern-number');
      expect(number.contains(trigger)).toBe(false);
      expect(number.children).toHaveLength(0);
      expect(number.textContent.startsWith('#')).toBe(false);
    }
    // exactly one control per row before the seven data cells; the header still has seven sortable headers (no Action column)
    expect(container.querySelectorAll('.quote-modern-head-row > [role="columnheader"]')).toHaveLength(7);
    expect(container.querySelector('.quote-modern-head-action, [data-sort-key="action"]')).toBeNull();
  });

  it('the moved trigger opens the same shared dropdown with every row action, and closes it again', () => {
    const hot = mk('h', { status: 'sent', view_count: 5 });
    const { container } = render(<QuotesTab {...buildProps(isHebrew)} quotes={[hot]} allQuotes={[hot]} />);
    const trigger = container.querySelector('.quote-modern-row > .quote-modern-toggle');
    expect(trigger).toHaveAttribute('aria-controls', 'quote-modern-detail-h');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('quote-modern-detail-h');
    expect(panel).toBeTruthy();
    expect(panel.querySelector('button')).toBe(panel.querySelector('.quote-modern-action'));
    expect(panel.querySelector('.quote-modern-action').textContent).toBe(isHebrew ? 'פתיחה ומעקב' : 'Open & track');
    for (const label of isHebrew ? ['צפה', 'ערוך', 'שכפל', 'וואטסאפ', 'שלח במייל', 'מחק'] : ['View', 'Edit', 'Duplicate', 'WhatsApp', 'Email', 'Delete']) expect(panel.textContent).toContain(label);
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('quote-modern-detail-h')).toBeNull();
  });
});

// IRON-DATE-001 (Codex Task 17 review follow-up, fixed in Task 18): the AUTHENTICATED ACCOUNT MARKET decides the date order and the
// product time zone of the quote list - never the UI language. 2026-01-15T23:30Z is 01/15/2026 in UTC (International) and
// 16/01/2026 in Asia/Jerusalem (Local).
describe('QuotesTab dates follow the account market, not the UI language', () => {
  const late = { ...baseQuote, id: 'late', created_at: '2026-01-15T23:30:00.000Z' };
  const dateOf = (c) => c.querySelector('.quote-modern-date').textContent;
  it.each([
    ['Hebrew UI on an International account', true, false, '01/15/2026'],
    ['English UI on a Local account', false, true, '16/01/2026'],
    ['Hebrew UI on a Local account', true, true, '16/01/2026'],
    ['English UI on an International account', false, false, '01/15/2026'],
  ])('%s', (_label, isHebrew, isLocalIsraeliBusiness, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00.000Z'));
    try {
      const { container } = render(<QuotesTab {...buildProps(isHebrew)} isLocalIsraeliBusiness={isLocalIsraeliBusiness} quotes={[late]} allQuotes={[late]} />);
      expect(dateOf(container)).toBe(expected);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Owner console 2026-10-18, typed: "מאשר שינוי ב-L-19: פס ההצעה החמה יתחלף כל 4 שניות בין כל ההצעות החמות"
describe('QuotesTab hot-quote banner rotation (L-19 change 2026-10-18)', () => {
  afterEach(() => { vi.useRealTimers(); });
  const q = (id, views, created) => ({ ...baseQuote, id, view_count: views, status: 'sent', created_at: created });
  it('shows every hot quote in turn every 4 seconds, hottest first; a single hot quote never rotates', () => {
    vi.useFakeTimers();
    const list = [q('h3', 3, '2026-03-01T00:00:00.000Z'), q('h9', 9, '2026-01-01T00:00:00.000Z'), q('h5', 5, '2026-02-01T00:00:00.000Z'), { ...baseQuote, id: 'cold', view_count: 1, status: 'sent' }];
    const { container } = render(<QuotesTab {...buildProps(true)} quotes={list} allQuotes={list} />);
    const shown = () => container.querySelector('[data-testid="hot-quote-banner"]').getAttribute('data-hot-quote-id');
    expect(container.querySelector('[data-testid="hot-quote-banner"]').getAttribute('data-hot-count')).toBe('3');
    expect(shown()).toBe('h9');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(shown()).toBe('h5');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(shown()).toBe('h3');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(shown()).toBe('h9');
  });
  it('pauses while hovered or focused so its action can be used', () => {
    vi.useFakeTimers();
    const list = [q('a', 4, '2026-01-01T00:00:00.000Z'), q('b', 7, '2026-01-02T00:00:00.000Z')];
    const { container } = render(<QuotesTab {...buildProps(false)} quotes={list} allQuotes={list} />);
    const banner = () => container.querySelector('[data-testid="hot-quote-banner"]');
    expect(banner().getAttribute('data-hot-quote-id')).toBe('b');
    fireEvent.mouseEnter(banner());
    act(() => { vi.advanceTimersByTime(12000); });
    expect(banner().getAttribute('data-hot-quote-id')).toBe('b');
    fireEvent.mouseLeave(banner());
    act(() => { vi.advanceTimersByTime(4000); });
    expect(banner().getAttribute('data-hot-quote-id')).toBe('a');
  });
  it('the banner action shows every row when the shown hot quote is outside the compact four, and opens it', () => {
    vi.useFakeTimers();
    const cold = (id, d) => ({ ...baseQuote, id, view_count: 0, status: 'sent', created_at: d });
    const list = [q('hotTop', 9, '2026-01-01T00:00:00.000Z'), cold('c1', '2026-05-01T00:00:00.000Z'), cold('c2', '2026-05-02T00:00:00.000Z'), cold('c3', '2026-05-03T00:00:00.000Z'), cold('c4', '2026-05-04T00:00:00.000Z'), q('hotLow', 3, '2026-01-02T00:00:00.000Z')];
    const { container } = render(<QuotesTab {...buildProps(true)} quotes={list} allQuotes={list} />);
    act(() => { vi.advanceTimersByTime(4000); });
    const banner = container.querySelector('[data-testid="hot-quote-banner"]');
    expect(banner.getAttribute('data-hot-quote-id')).toBe('hotLow');
    fireEvent.click(banner.querySelector('button'));
    act(() => { vi.runOnlyPendingTimers(); });
    expect(container.querySelector('#quote-modern-detail-hotLow')).not.toBeNull();
  });
  it('one hot quote: no rotation; the list order keeps the hottest first (L-07)', () => {
    vi.useFakeTimers();
    const list = [q('only', 6, '2026-01-01T00:00:00.000Z'), { ...baseQuote, id: 'cold', view_count: 0, status: 'sent' }];
    const { container } = render(<QuotesTab {...buildProps(true)} quotes={list} allQuotes={list} />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(container.querySelector('[data-testid="hot-quote-banner"]').getAttribute('data-hot-quote-id')).toBe('only');
  });
});
