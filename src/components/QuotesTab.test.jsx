import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import QuotesTab from './QuotesTab';
import { formatMoneyForCurrency } from '../utils/money';

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
    formatMoneyDisplay: (n) => String(n),
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

// חוק ברזל (Authenticated App Consolidation task, §4 - Primary Row Content):
// השורה הראשית של הדסקטופ מוגבלת עכשיו לששת השדות ה"PRIMARY" שהמשימה
// מפרטת - Client Name/Order#/Amount/Status/Date/Expand-control, בדיוק
// בסדר הזה ב-DOM (Client Name ראשון, per the task's own stated priority
// order) - dir={tableDir} הקיים ממשיך למקם/לשקף אוטומטית בשתי השפות, בלי
// תנאי isHebrew נוסף על סדר ה-DOM עצמו (אותו עיקרון שכבר נקבע לכל שאר
// הקובץ).
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Desktop primary row (%s)', (_label, isHebrew) => {
  it('renders exactly six primary columns: expand-control first (Owner correction), Client Name second, in the same DOM order for both languages', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const headerCells = Array.from(container.querySelectorAll('table thead tr th'));
    expect(headerCells).toHaveLength(6);
    // Owner correction (RTL/LTR Sidebar Position + Quote-Row Expand Control
    // task): the expand-control column is now first in DOM order - under
    // dir it lands at the row's true inline-start (physically right for
    // Hebrew, physically left for English), "before the quote's primary
    // information" per the Owner's own wording. It has no header text
    // (icon-only), so the first textual column is Client Name, now second.
    expect(headerCells[0].textContent.trim()).toBe('');
    expect(headerCells[1].textContent).toContain(isHebrew ? 'שם לקוח' : 'Client Name');
  });

  it('does not show Client Type, Views, Description, Email status, or Actions in the collapsed primary row', () => {
    const props = buildProps(isHebrew, { view_count: 42, quote_items: [{ description: 'A very specific unique description string' }] });
    render(<QuotesTab {...props} />);

    expect(screen.queryByText('A very specific unique description string')).not.toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByText(isHebrew ? 'ערוך' : 'Edit')).not.toBeInTheDocument();
  });

  it('centers every textual desktop header over its own column', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const headerCells = Array.from(container.querySelectorAll('table thead tr th'));
    const labelledByText = headerCells.filter((th) => th.textContent.trim().length > 0);
    labelledByText.forEach((th) => {
      expect(th.style.textAlign).toBe('center');
    });
  });

  it('keeps CENTER-classified body cells centered and the Client Name cell edge-aligned (Table Column Geometry Contract)', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const cells = Array.from(container.querySelectorAll('table tbody tr:first-child td'));
    const startAlign = isHebrew ? 'right' : 'left';

    // Owner correction: Expand-control(0) is now first (centered, icon-only);
    // Client Name(1) is the only edge-aligned free-text primary column now.
    expect(cells[1].style.textAlign).toBe(startAlign);
    // Expand-control(0), Order(2), Amount(3), Status(4), Date(5) are all centered.
    [0, 2, 3, 4, 5].forEach((i) => {
      expect(cells[i].style.textAlign).toBe('center');
    });
  });

  it('places the expand-control button as the very first cell in DOM order, before every primary-info cell (Owner correction: chevron at the start of the reading direction)', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const firstCell = container.querySelector('table tbody tr:first-child td:first-child');
    expect(firstCell.querySelector('button[aria-label]')).toBeTruthy();
    expect(firstCell.textContent.trim()).toBe('');
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

    expect(screen.getByText('A very specific unique description string')).toBeInTheDocument();
    expect(screen.getByText(isHebrew ? '7 צפיות' : '7 views')).toBeInTheDocument();
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

    const amountCell = Array.from(container.querySelectorAll('table tbody tr:first-child td')).find(
      (td) => td.textContent.includes('200'),
    );
    expect(amountCell.textContent).not.toContain('לפני מע"מ');
    expect(amountCell.getAttribute('title')).toContain('לפני מע"מ');
  });

  it('EN: never renders a before-VAT title attribute, even though no equivalent International semantic exists', () => {
    const props = buildProps(false, { total: 200 });
    const { container } = render(<QuotesTab {...props} />);

    const amountCell = Array.from(container.querySelectorAll('table tbody tr:first-child td')).find(
      (td) => td.textContent.includes('200'),
    );
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

    expect(screen.getByText(isHebrew ? `${viewCount} צפיות` : `${viewCount} views`)).toBeInTheDocument();
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
    expect(screen.getByText('Test Client')).toBeInTheDocument();
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

// IRON-ILS-001: HE/Local/ILS shows every amount as the nearest whole shekel (half-up) with ".00" - rows, overview, cards and
// tooltips all use the ONE canonical formatter (no exact-cent list formatter). Display only: the passed data never changes.
describe('IRON-ILS-001 QuotesTab amounts use the canonical formatter only', () => {
  const mk = (id, over = {}) => ({ ...baseQuote, id: `quote-${id}`, ...over });
  const canonicalMoney = (account) => (val, cur) => formatMoneyForCurrency(val, cur || account);
  const ilsProps = (list) => ({ ...buildProps(true), quotes: list, allQuotes: list, formatMoneyDisplay: canonicalMoney('ILS') });
  const strip = (x) => x.replace(/[\s‎‏‪-‮⁦-⁩]+/g, '');
  const rowAmounts = (c) => [...c.querySelectorAll('td [data-qh="amount"]')].map((e) => strip(e.textContent));
  const overviewTotal = () => strip(screen.getByTestId('quote-overview').querySelector('[data-qh-overview="total"] .pf-money').textContent);

  it('Local/ILS: raw 1227.20 renders ₪1,227.00 in the row and the 18,397.20 total renders ₪18,397.00 in the overview', () => {
    const list = [mk('1', { total: 1227.2, status: 'sent' }), mk('2', { total: 17170, status: 'draft' })];
    const { container } = render(<QuotesTab {...ilsProps(list)} />);
    expect(rowAmounts(container)).toContain('₪1,227.00');
    expect(overviewTotal()).toBe('₪18,397.00');
    expect(strip(container.textContent)).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
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
    const cardAmounts = [...container.querySelectorAll('.quote-card [data-testid="quote-card-amount"]')].map((e) => strip(e.textContent));
    expect(cardAmounts).toEqual(['₪1,227.00', '₪191.00']);
    expect(overviewTotal()).toBe('₪1,418.00');
    expect(strip(container.textContent)).not.toMatch(/₪[\d,]+\.(?!00)\d\d/);
  });

  it.each([['USD', '$'], ['EUR', '€'], ['GBP', '£']])('International %s keeps cents (1,227.20) in the row and the overview', (cur, symbol) => {
    const list = [mk('1', { total: 1227.2, currency: cur }), mk('2', { total: 17170, currency: cur })];
    const props = { ...buildProps(false), quotes: list, allQuotes: list, currency: cur, formatMoneyDisplay: canonicalMoney(cur) };
    const { container } = render(<QuotesTab {...props} />);
    expect(rowAmounts(container)).toContain(`${symbol}1,227.20`);
    expect(overviewTotal()).toBe(`${symbol}18,397.20`);
    expect(container.textContent).not.toContain('₪');
  });
});

// IRON-MARKET-004 / IRON-ILS-001: the HE "before VAT" hint is derived from the quote's OWN persisted data (subtotal /
// discount / tax_rate / currency), never from the account's current market or a hard-coded rate.
describe('QuotesTab before-VAT hint (HE) follows each quote\'s persisted figures', () => {
  const canonical = (account) => (val, cur) => formatMoneyForCurrency(val, cur || account);
  const hint = (container) => [...container.querySelectorAll('td[title]')].map((td) => td.getAttribute('title')).find((tt) => tt.startsWith('לפני מע"מ'));
  const mount = (over) => {
    const q = { ...baseQuote, ...over };
    return render(<QuotesTab {...buildProps(true)} quotes={[q]} allQuotes={[q]} formatMoneyDisplay={canonical('ILS')} />).container;
  };
  it('business ILS quote: the hint is the subtotal after the discount, in whole shekels', () => {
    expect(hint(mount({ client_type: 'business', clients: { company_name: 'B', client_type: 'business' }, subtotal: 1000, discount: 10, total: 1062, tax_rate: 0.18 }))).toBe('לפני מע"מ: ₪900.00');
  });
  it('private ILS quote: the VAT is extracted at the quote\'s persisted 18% (₪1,180.00 -> ₪1,000.00)', () => {
    expect(hint(mount({ client_type: 'private', clients: { company_name: 'P', client_type: 'private' }, subtotal: 1180, total: 1180, tax_rate: 0.18 }))).toBe('לפני מע"מ: ₪1,000.00');
  });
  it('a historical 0%-tax USD quote shown in a Local account invents no VAT: its before-VAT amount is its total', () => {
    expect(hint(mount({ client_type: 'private', clients: { company_name: 'U', client_type: 'private' }, subtotal: 1000, total: 1000, currency: 'USD', tax_rate: 0 }))).toBe('לפני מע"מ: $1,000.00');
  });
  it('the mobile card carries the same hint as the table row', () => {
    mockMobileMatchMedia();
    const q = { ...baseQuote, client_type: 'private', clients: { company_name: 'P', client_type: 'private' }, subtotal: 1180, total: 1180, tax_rate: 0.18 };
    render(<QuotesTab {...buildProps(true)} quotes={[q]} allQuotes={[q]} formatMoneyDisplay={canonical('ILS')} />);
    expect(screen.getByTestId('quote-card-amount')).toHaveAttribute('title', 'לפני מע"מ: ₪1,000.00');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The candidate Quote History as a whole: header controls, sorting / filtering hand-off to the parent, status and cell
// semantics per market (IRON-MARKET-001/003/004, IRON-DATE-001, IRON-ILS-001), every row action and its entitlement gate,
// the signed-quote lock (IRON-SIGN-001), the mobile card surface and empty / damaged data. Real component, real formatters.
// ---------------------------------------------------------------------------------------------------------------------
const money = (account) => (val, cur) => formatMoneyForCurrency(val, cur || account);
const q = (over = {}) => ({ ...baseQuote, ...over });
const mountList = (isHebrew, list, extra = {}) => {
  const props = { ...buildProps(isHebrew), quotes: list, allQuotes: list, formatMoneyDisplay: money(isHebrew ? 'ILS' : 'USD'), ...extra };
  return { props, ...render(<QuotesTab {...props} />) };
};
const headerCells = (container) => [...container.querySelector('thead').querySelectorAll('th')];

describe('Quote History header controls', () => {
  it('HE: the title comes from the screen copy and "Export CSV" calls the export handler exactly once', () => {
    const { props } = mountList(true, [q()]);
    expect(screen.getByText('History')).toBeInTheDocument();
    fireEvent.click(screen.getByText('ייצא לאקסל (CSV)'));
    expect(props.handleExportQuotes).toHaveBeenCalledTimes(1);
  });
  it('EN: the export control is labelled "Export CSV" and is the same single action', () => {
    const { props } = mountList(false, [q()]);
    fireEvent.click(screen.getByText('Export CSV'));
    expect(props.handleExportQuotes).toHaveBeenCalledTimes(1);
  });
  it('the search box is controlled by the parent: it shows the current term and reports every edit', () => {
    const { props } = mountList(true, [q()], { searchTerm: 'Acme' });
    const box = screen.getByPlaceholderText('Search');
    expect(box).toHaveValue('Acme');
    fireEvent.change(box, { target: { value: 'A1007' } });
    expect(props.setSearchTerm).toHaveBeenCalledWith('A1007');
  });
  it('the search text aligns with the reading direction (HE right, EN left)', () => {
    mountList(true, [q()]);
    expect(screen.getByPlaceholderText('Search')).toHaveStyle({ textAlign: 'right' });
    cleanup();
    mountList(false, [q()]);
    expect(screen.getByPlaceholderText('Search')).toHaveStyle({ textAlign: 'left' });
  });
  it('HE status filter: All + the four persisted statuses with Hebrew labels; it reflects and reports the filter', () => {
    const { props, container } = mountList(true, [q()], { statusFilter: 'sent' });
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'paid'));
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([['All', 'Status'], ['draft', 'טיוטה'], ['sent', 'נשלח'], ['approved', 'אושר'], ['paid', 'שולם']]);
    expect(select).toHaveValue('sent');
    fireEvent.change(select, { target: { value: 'approved' } });
    expect(props.setStatusFilter).toHaveBeenCalledWith('approved');
  });
  it('EN status filter labels', () => {
    const { container } = mountList(false, [q()]);
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'paid'));
    expect([...select.options].map((o) => o.textContent)).toEqual(['Status', 'Draft', 'Sent', 'Approved', 'Paid']);
  });
});

describe('Quote History sorting is owned by the parent', () => {
  it('each sortable header asks the parent to sort by its own field', () => {
    const { props, container } = mountList(true, [q()]);
    const byLabel = (label) => headerCells(container).find((th) => th.textContent.trim().startsWith(label));
    for (const [label, field] of [['שם לקוח', 'client'], ['מס׳ הצעה', 'id'], ['הסכום', 'total'], ['סטטוס', 'status'], ['תאריך', 'date']]) {
      fireEvent.click(byLabel(label));
      expect(props.handleQuoteSort).toHaveBeenLastCalledWith(field);
    }
    expect(props.handleQuoteSort).toHaveBeenCalledTimes(5);
  });
  it('only the active sort column shows the direction mark: ▲ ascending, ▼ descending', () => {
    const { container, rerender, props } = mountList(false, [q()], { quoteSortField: 'total', quoteSortDirection: 'asc' });
    const marks = () => headerCells(container).filter((th) => /[▲▼]/.test(th.textContent)).map((th) => th.textContent.trim());
    expect(marks()).toEqual(['Amount ▲']);
    rerender(<QuotesTab {...props} quoteSortField="date" quoteSortDirection="desc" />);
    expect(marks()).toEqual(['Date ▼']);
  });
  it('the expand-control column is not a sort control', () => {
    const { props, container } = mountList(true, [q()]);
    fireEvent.click(headerCells(container)[0]);
    expect(props.handleQuoteSort).not.toHaveBeenCalled();
  });
  it('rows are rendered in exactly the order the parent supplies (no second, hidden ordering)', () => {
    const list = [q({ id: 'a', quote_number: 3 }), q({ id: 'b', quote_number: 1 }), q({ id: 'c', quote_number: 2 })];
    const { container } = mountList(true, list);
    expect([...container.querySelectorAll('[data-qh="number"]')].map((e) => e.textContent)).toEqual(['A3', 'A1', 'A2']);
  });
});

describe('Quote History mobile filters and sort', () => {
  const mobile = (isHebrew, extra) => { mockMobileMatchMedia(); return mountList(isHebrew, [q()], extra); };
  it('the filter panel starts closed behind an accessible toggle (aria-haspopup / aria-expanded / label)', () => {
    mobile(true);
    const toggle = screen.getByRole('button', { name: 'סינון ומיון' });
    expect(toggle).toHaveAttribute('aria-haspopup', 'true');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('מיון')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('מיון')).toBeInTheDocument();
  });
  it('inside the panel the status filter reports to the parent', () => {
    const { props, container } = mobile(true);
    fireEvent.click(screen.getByRole('button', { name: 'סינון ומיון' }));
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'paid'));
    fireEvent.change(select, { target: { value: 'paid' } });
    expect(props.setStatusFilter).toHaveBeenCalledWith('paid');
  });
  it('HE sort fields: the seven sortable fields in order with Hebrew names; choosing one asks the parent to sort by it', () => {
    const { props, container } = mobile(true, { quoteSortField: 'date' });
    fireEvent.click(screen.getByRole('button', { name: 'סינון ומיון' }));
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'views'));
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([['id', 'מס׳ הצעה'], ['client', 'שם לקוח'], ['clientType', 'סוג לקוח'], ['total', 'הסכום'], ['date', 'תאריך'], ['status', 'סטטוס'], ['views', 'צפיות']]);
    expect(select).toHaveValue('date');
    fireEvent.change(select, { target: { value: 'views' } });
    expect(props.handleQuoteSort).toHaveBeenCalledWith('views');
  });
  it('EN sort field names', () => {
    const { container } = mobile(false);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const select = [...container.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'views'));
    expect([...select.options].map((o) => o.textContent)).toEqual(['Quote #', 'Client Name', 'Client Type', 'Amount', 'Date', 'Status', 'Views']);
  });
  it('the direction toggle shows the current direction and re-sorts the same field (the parent flips it)', () => {
    const { props } = mobile(false, { quoteSortField: 'total', quoteSortDirection: 'asc' });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const dir = screen.getByRole('button', { name: 'Toggle sort direction' });
    expect(dir).toHaveTextContent('▲');
    fireEvent.click(dir);
    expect(props.handleQuoteSort).toHaveBeenCalledWith('total');
  });
  it('the panel has its own Close control', () => {
    mobile(true);
    const toggle = screen.getByRole('button', { name: 'סינון ומיון' });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText('סגור'));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('מיון')).toBeNull();
  });
  it('the mobile search box is the same controlled search', () => {
    const { props } = mobile(true, { searchTerm: 'x' });
    const box = screen.getByPlaceholderText('Search');
    expect(box).toHaveValue('x');
    fireEvent.change(box, { target: { value: 'xy' } });
    expect(props.setSearchTerm).toHaveBeenCalledWith('xy');
  });
  it('the layout the geometry gate reads: data-qh-layout is "cards" on mobile and "table" on desktop', () => {
    const { container } = mobile(true);
    expect(container.querySelector('[data-qh-layout]')).toHaveAttribute('data-qh-layout', 'cards');
    cleanup();
    delete window.matchMedia;
    expect(mountList(true, [q()]).container.querySelector('[data-qh-layout]')).toHaveAttribute('data-qh-layout', 'table');
  });
});

describe('Quote History status badges', () => {
  const badges = (container) => [...container.querySelectorAll('[data-qh="status"]')].map((e) => e.textContent);
  const finished = { total: 118, quote_items: [{ description: 'Item' }] };
  it('HE: approved / paid / sent / draft, case-insensitive; an unknown or missing status reads as a draft', () => {
    const list = ['approved', 'PAID', 'Sent', 'draft', 'weird', null].map((status, i) => q({ id: `s${i}`, status, ...finished }));
    expect(badges(mountList(true, list).container)).toEqual(['אושר', 'שולם', 'נשלח', 'טיוטה', 'טיוטה', 'טיוטה']);
  });
  it('EN badges', () => {
    const list = ['approved', 'paid', 'sent', 'draft'].map((status, i) => q({ id: `s${i}`, status, ...finished }));
    expect(badges(mountList(false, list).container)).toEqual(['Approved', 'Paid', 'Sent', 'Draft']);
  });
  it('an unfinished draft (no total / no items) is labelled as such; a sent quote is never relabelled', () => {
    const list = [q({ id: 'u1', status: 'draft', total: 0, quote_items: [] }), q({ id: 'u2', status: 'draft', ...finished }), q({ id: 'u3', status: 'sent', total: 0, quote_items: [] })];
    expect(badges(mountList(true, list).container)).toEqual(['טיוטה לא גמורה', 'טיוטה', 'נשלח']);
    cleanup();
    expect(badges(mountList(false, [list[0]]).container)).toEqual(['Unfinished draft']);
  });
});

describe('Quote History cells', () => {
  it('quote number: the persisted number (A100701) or the short id fallback, always LTR', () => {
    const { container } = mountList(true, [q({ id: 'n1', quote_number: 100701 }), q({ id: 'abcdef123456', quote_number: null })]);
    const cells = [...container.querySelectorAll('[data-qh="number"]')];
    expect(cells.map((c) => c.textContent)).toEqual(['A100701', '#abcdef12']);
    for (const c of cells) expect(c.closest('td')).toHaveStyle({ direction: 'ltr' });
  });
  it('dates follow the account market format: HE DD/MM/YYYY, EN MM/DD/YYYY, in an LTR cell', () => {
    const d = (isHebrew) => mountList(isHebrew, [q({ created_at: '2026-01-15T10:00:00.000Z' })]).container.querySelector('[data-qh="date"]');
    expect(d(true).textContent).toBe('15/01/2026');
    cleanup();
    const en = d(false);
    expect(en.textContent).toBe('01/15/2026');
    expect(en.closest('td')).toHaveStyle({ direction: 'ltr' });
  });
  it('a late-evening UTC timestamp falls on the market\'s own calendar day (Local: Jerusalem next day; International: UTC)', () => {
    const late = q({ created_at: '2026-01-15T23:30:00.000Z' });
    expect(mountList(true, [late]).container.querySelector('[data-qh="date"]').textContent).toBe('16/01/2026');
    cleanup();
    expect(mountList(false, [late]).container.querySelector('[data-qh="date"]').textContent).toBe('01/15/2026');
  });
  it('a damaged date or amount never prints "Invalid Date" / "NaN"', () => {
    const { container } = mountList(true, [q({ created_at: 'not-a-date', total: null })]);
    expect(container.textContent).not.toMatch(/Invalid Date|NaN/);
    expect(container.querySelector('td [data-qh="amount"]').textContent.replace(/\s/g, '')).toBe('₪0.00');
  });
  it('the client cell ellipsizes visually but keeps the full name in its title; a quote without a client reads "N/A"', () => {
    const long = 'A Very Long Client Company Name That Will Not Fit In The Column Ltd';
    const { container } = mountList(true, [q({ id: 'c1', clients: { company_name: long, client_type: 'business' } }), q({ id: 'c2', clients: null })]);
    const cells = [...container.querySelectorAll('[data-qh="client"]')];
    expect(cells[0].closest('td')).toHaveAttribute('title', long);
    expect(cells[0]).toHaveStyle({ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' });
    expect(cells[1].textContent).toBe('N/A');
  });
});

describe('Quote History detail panel', () => {
  it('HE client type: a business client shows the business badge + label; a private client the private one', () => {
    mountList(true, [q({ clients: { company_name: 'B', client_type: 'business' } })]);
    expandFirstRow();
    expect(screen.getByRole('img', { name: 'לקוח עסקי' })).toBeInTheDocument();
    cleanup();
    mountList(true, [q({ clients: { company_name: 'P', client_type: 'private' } })]);
    expandFirstRow();
    expect(screen.getByRole('img', { name: 'לקוח פרטי' })).toBeInTheDocument();
  });
  it('EN client type labels, and no client-type claim at all when the type is unknown', () => {
    mountList(false, [q({ clients: { company_name: 'B', client_type: 'business' } })]);
    expandFirstRow();
    expect(screen.getByRole('img', { name: 'Business Client' })).toBeInTheDocument();
    cleanup();
    mountList(false, [q({ clients: { company_name: 'X', client_type: null } })]);
    expandFirstRow();
    expect(screen.queryByRole('img', { name: /Client$/ })).toBeNull();
  });
  it('a quote without items says so instead of showing an empty description (HE / EN)', () => {
    mountList(true, [q({ quote_items: [] })]);
    expandFirstRow();
    expect(screen.getByText('אין תיאור פריט')).toBeInTheDocument();
    cleanup();
    mountList(false, [q({ quote_items: [] })]);
    expandFirstRow();
    expect(screen.getByText('No item description')).toBeInTheDocument();
  });
});

describe('Quote History row actions', () => {
  let open;
  beforeEach(() => { open = vi.spyOn(window, 'open').mockImplementation(() => null); });
  afterEach(() => open.mockRestore());
  const act = (label) => fireEvent.click(screen.getByText(label).closest('button'));
  it('View opens a Local (ILS) quote on the Hebrew public page in a new tab', () => {
    mountList(true, [q({ id: 'loc-1', currency: 'ILS', tax_rate: 0.18 })]);
    expandFirstRow(); act('צפה');
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/public-quote/loc-1`, '_blank');
  });
  it('View opens a 0%-tax International quote on the English public page', () => {
    mountList(false, [q({ id: 'int-1', currency: 'USD', tax_rate: 0 })]);
    expandFirstRow(); act('View');
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/en/public-quote/int-1?lang=en`, '_blank');
  });
  it('a historical USD quote inside a Local (Hebrew) account still opens the English page - the quote\'s own market decides', () => {
    mountList(true, [q({ id: 'hist-1', currency: 'USD', tax_rate: 0 })]);
    expandFirstRow(); act('צפה');
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/en/public-quote/hist-1?lang=en`, '_blank');
  });
  it('a taxed quote without a stored currency is treated as Local (Hebrew page)', () => {
    mountList(false, [q({ id: 'tax-1', currency: null, tax_rate: 0.18 })]);
    expandFirstRow(); act('View');
    expect(open).toHaveBeenCalledWith(`${window.location.origin}/public-quote/tax-1`, '_blank');
  });
  it('Edit goes through the entitlement gate as "edit" and then opens the editor with this quote', () => {
    const { props } = mountList(true, [q({ id: 'e1' })]);
    expandFirstRow(); act('ערוך');
    expect(props.handleProtectedAction).toHaveBeenCalledWith('e1', 'edit', expect.any(Function));
    expect(props.handleEditClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });
  it('Duplicate goes through the gate as "duplicate" and is allowed even for a signed (locked) quote', () => {
    const { props } = mountList(true, [q({ id: 'd1', status: 'approved', signature: 'data:image/png;base64,AAAA' })]);
    expandFirstRow(); act('שכפל');
    expect(props.handleProtectedAction).toHaveBeenCalledWith('d1', 'duplicate', expect.any(Function));
    expect(props.handleDuplicateQuote).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }));
  });
  it('WhatsApp goes through the gate as "whatsapp" and sends this quote', () => {
    const { props } = mountList(true, [q({ id: 'w1' })]);
    expandFirstRow(); act('וואטסאפ');
    expect(props.handleProtectedAction).toHaveBeenCalledWith('w1', 'whatsapp', expect.any(Function));
    expect(props.sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }));
  });
  it('Email hands this quote to the email flow directly (no plan gate), also for a signed quote', () => {
    const { props } = mountList(true, [q({ id: 'm1', status: 'approved', signature: 'data:image/png;base64,AAAA' })]);
    expandFirstRow(); act('שלח במייל');
    expect(props.setPendingEmailQuote).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    expect(props.handleProtectedAction).not.toHaveBeenCalled();
  });
  it('Delete goes through the gate as "delete" and passes the displayed number and client for the confirmation', () => {
    const { props } = mountList(true, [q({ id: 'x1', quote_number: 100701, clients: { company_name: 'Client Ltd', client_type: 'business' } })]);
    expandFirstRow(); act('מחק');
    expect(props.handleProtectedAction).toHaveBeenCalledWith('x1', 'delete', expect.any(Function));
    expect(props.handleDeleteQuote).toHaveBeenCalledWith('x1', { number: 'A100701', clientName: 'Client Ltd' });
  });
  it('a gate that refuses never runs the action: edit / duplicate / WhatsApp / delete handlers stay untouched', () => {
    const refuse = vi.fn();
    const { props } = mountList(true, [q({ id: 'g1' })], { handleProtectedAction: refuse });
    expandFirstRow();
    for (const label of ['ערוך', 'שכפל', 'וואטסאפ', 'מחק']) act(label);
    expect(refuse).toHaveBeenCalledTimes(4);
    for (const h of [props.handleEditClick, props.handleDuplicateQuote, props.sendWhatsApp, props.handleDeleteQuote]) expect(h).not.toHaveBeenCalled();
  });
  it('EN action labels, in the same order as HE', () => {
    mountList(false, [q()]);
    expandFirstRow();
    const labels = ['View', 'Edit', 'Duplicate', 'WhatsApp', 'Email', 'Delete'];
    const nodes = labels.map((l) => screen.getByText(l));
    for (let i = 1; i < nodes.length; i += 1) expect(nodes[i - 1].compareDocumentPosition(nodes[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('a signed quote locks only Edit and Delete: View, Duplicate, WhatsApp and Email stay available', () => {
    mountList(true, [q({ status: 'approved', signature: 'data:image/png;base64,AAAA' })]);
    expandFirstRow();
    for (const label of ['ערוך', 'מחק']) expect(screen.getByText(label).closest('button')).toBeDisabled();
    for (const label of ['צפה', 'שכפל', 'וואטסאפ', 'שלח במייל']) expect(screen.getByText(label).closest('button')).not.toBeDisabled();
  });
  it('the parent\'s plan hint appears only on the gated action of the quote it names', () => {
    const list = [q({ id: 'h1' }), q({ id: 'h2' })];
    const { container } = mountList(true, list, { activeTooltip: { quoteId: 'h1', action: 'whatsapp' } });
    fireEvent.click(screen.getAllByLabelText('הצג פרטים נוספים')[0]); // rows are single-expand: open the named quote (h1)
    const hints = container.querySelectorAll('.feature-lock-tooltip');
    expect(hints).toHaveLength(1);
    expect(hints[0].parentElement).toHaveTextContent('וואטסאפ');
  });
  it('an edit hint is shown next to Edit of that quote only', () => {
    const { container } = mountList(false, [q({ id: 'h1' })], { activeTooltip: { quoteId: 'h1', action: 'edit' } });
    expandFirstRow();
    const hints = container.querySelectorAll('.feature-lock-tooltip');
    expect(hints).toHaveLength(1);
    expect(hints[0].parentElement).toHaveTextContent('Edit');
  });
});

describe('Quote History mobile card', () => {
  beforeEach(() => mockMobileMatchMedia());
  it('the expanded card offers the same actions, through the same gate', () => {
    const { props, container } = mountList(true, [q({ id: 'mc1' })]);
    fireEvent.click(container.querySelector('.quote-card button'));
    for (const label of ['צפה', 'ערוך', 'שכפל', 'וואטסאפ', 'שלח במייל', 'מחק']) expect(screen.getByText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByText('ערוך').closest('button'));
    expect(props.handleProtectedAction).toHaveBeenCalledWith('mc1', 'edit', expect.any(Function));
  });
  it('a signed quote card locks Edit / Delete with the signed-quote explanation', () => {
    const { container } = mountList(true, [q({ status: 'approved', signature: 'data:image/png;base64,AAAA' })]);
    fireEvent.click(container.querySelector('.quote-card button'));
    expect(screen.getByText('ערוך').closest('button')).toHaveAttribute('title', 'לא ניתן לערוך הצעה חתומה');
    expect(screen.getByText('מחק').closest('button')).toHaveAttribute('title', 'לא ניתן למחוק הצעה חתומה');
  });
  it('Export CSV stays available in the card layout (one shared header)', () => {
    const { props } = mountList(true, [q()]);
    fireEvent.click(screen.getByText('ייצא לאקסל (CSV)'));
    expect(props.handleExportQuotes).toHaveBeenCalledTimes(1);
  });
  it('the card date uses the market format', () => {
    const { container } = mountList(false, [q({ created_at: '2026-01-15T10:00:00.000Z' })]);
    expect(container.querySelector('.quote-card [data-qh="date"]').textContent).toBe('01/15/2026');
  });
});

describe('Quote History with no quotes', () => {
  it('desktop states that there are no quotes (HE / EN)', () => {
    mountList(true, []);
    expect(screen.getByText('לא נמצאו הצעות מחיר במסד הנתונים.')).toBeInTheDocument();
    cleanup();
    mountList(false, []);
    expect(screen.getByText('No quotes found in the database.')).toBeInTheDocument();
  });
  it('mobile states the same, with no empty card', () => {
    mockMobileMatchMedia();
    const { container } = mountList(true, []);
    expect(screen.getByText('לא נמצאו הצעות מחיר במסד הנתונים.')).toBeInTheDocument();
    expect(container.querySelector('.quote-card')).toBeNull();
  });
  it('the overview shows zero counts and a zero total in the account currency (never an empty / NaN cell)', () => {
    mountList(true, []);
    const cells = [...screen.getByTestId('quote-overview').querySelectorAll('[data-qh-overview]')];
    expect(cells.slice(0, 3).map((c) => c.querySelector('.quote-overview-value').textContent)).toEqual(['0', '0', '0']);
    expect(cells[3].querySelector('.pf-money').textContent.replace(/\s/g, '')).toBe('₪0.00');
  });
  it('overview count labels follow the language', () => {
    const labels = () => [...screen.getByTestId('quote-overview').querySelectorAll('.quote-overview-label')].slice(0, 3).map((e) => e.textContent);
    mountList(true, [q()]);
    expect(labels()).toEqual(['הצעות', 'ממתינות', 'אושרו']);
    cleanup();
    mountList(false, [q()]);
    expect(labels()).toEqual(['Quotes', 'Awaiting', 'Approved']);
  });
});
