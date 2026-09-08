import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuotesTab from './QuotesTab';

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
