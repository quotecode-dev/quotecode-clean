import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuotesTab from './QuotesTab';

const baseQuote = {
  id: 'quote-test-id-000000',
  status: 'pending',
  signature: null,
  clients: { company_name: 'Test Client' },
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
    openDropdownId: quote.id,
    setOpenDropdownId: vi.fn(),
    dropdownPos: { top: 0, left: 0 },
    dropdownRef: { current: null },
    handleToggleDropdown: vi.fn(),
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

describe.each([
  ['English', false, 'Cannot edit a signed quote', 'Cannot delete a signed quote'],
  ['Hebrew', true, 'לא ניתן לערוך הצעה חתומה', 'לא ניתן למחוק הצעה חתומה'],
])('QuotesTab lock state (%s)', (_label, isHebrew, editTooltip, deleteTooltip) => {
  it('leaves Edit/Delete enabled for a pending quote', () => {
    const props = buildProps(isHebrew, { status: 'pending', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).not.toBeDisabled();
    expect(deleteBtn).not.toBeDisabled();
    expect(editBtn.parentElement).not.toHaveAttribute('title');
    expect(deleteBtn.parentElement).not.toHaveAttribute('title');
    expect(screen.queryByTitle(editTooltip)).not.toBeInTheDocument();
    expect(screen.queryByTitle(deleteTooltip)).not.toBeInTheDocument();
  });

  it('disables Edit/Delete with the correct tooltip on the wrapper for an approved quote', () => {
    const props = buildProps(isHebrew, { status: 'approved', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn.parentElement).toHaveAttribute('title', editTooltip);
    expect(deleteBtn.parentElement).toHaveAttribute('title', deleteTooltip);
    expect(screen.getByTitle(editTooltip)).toBe(editBtn.parentElement);
    expect(screen.getByTitle(deleteTooltip)).toBe(deleteBtn.parentElement);
  });

  it('disables Edit/Delete with the correct tooltip on the wrapper for a paid quote', () => {
    const props = buildProps(isHebrew, { status: 'paid', signature: null });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(editBtn.parentElement).toHaveAttribute('title', editTooltip);
    expect(deleteBtn.parentElement).toHaveAttribute('title', deleteTooltip);
  });

  it('disables Edit/Delete for a signed quote with an unrelated status', () => {
    const props = buildProps(isHebrew, { status: 'sent', signature: 'data:image/png;base64,abc' });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
  });

  it('never invokes the edit/delete handlers when clicking a locked button', () => {
    const handleProtectedAction = vi.fn();
    const props = buildProps(isHebrew, { status: 'approved', signature: null }, { handleProtectedAction });
    render(<QuotesTab {...props} />);

    const editBtn = screen.getByText(isHebrew ? 'ערוך במסמך' : 'Edit Quote').closest('button');
    const deleteBtn = screen.getByText(isHebrew ? 'מחק מסמך' : 'Delete Quote').closest('button');

    fireEvent.click(editBtn);
    fireEvent.click(deleteBtn);

    expect(handleProtectedAction).not.toHaveBeenCalled();
  });
});

// חוק ברזל (Quote History Desktop HE/EN Mirroring Fix): Client Type + Views
// חייבים להיות שני הטורים הראשונים בסדר ה-DOM של טבלת הדסקטופ (לפני # Order/
// שם לקוח/יתר העמודות) - אותו סדר DOM אחיד לשתי השפות, בהסתמכות על dir
// שכבר קיים על ה-<table> לשיקוף RTL/LTR אוטומטי. הבדיקה הזו מגנה על סדר
// ה-DOM עצמו (לא על מיקום ויזואלי בפועל, ש-jsdom לא מחשב פריסה אמיתית
// עבורו) - ר' PROFLOW_PROJECT_CONTEXT.md לאימות הפריסה החזותית האמיתי
// בדפדפן אמיתי, שמשלים בדיקה זו ולא מוחלף על ידה.
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Desktop column order (%s)', (_label, isHebrew) => {
  it('places Client Type first and the icon-only Views header immediately second', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const headerCells = Array.from(container.querySelectorAll('table thead tr th'));
    expect(headerCells[0].textContent).toContain(isHebrew ? 'סוג לקוח' : 'Client Type');
    // Desktop Final Layout Pass (Owner requirement): Views header text was
    // intentionally removed in favor of an icon-only column; the accessible
    // label/tooltip must remain so the column stays identifiable without
    // visible text.
    expect(headerCells[1].textContent).not.toContain(isHebrew ? 'צפיות' : 'Views');
    expect(headerCells[1].getAttribute('aria-label')).toBe(isHebrew ? 'צפיות' : 'Views');
    expect(headerCells[1].getAttribute('title')).toBe(isHebrew ? 'מיון לפי צפיות' : 'Sort by views');
  });

  it('places the Client Type badge cell first and the Views cell immediately second in each row', () => {
    const props = buildProps(isHebrew, { view_count: 0 });
    const { container } = render(<QuotesTab {...props} />);

    const bodyCells = Array.from(container.querySelectorAll('table tbody tr:first-child td'));
    // Client Type cell (first) renders the badge, not text; Views cell (second)
    // must render the numeric value, including the literal digit "0" - a
    // truthiness check (view_count && ...) would render nothing instead.
    expect(bodyCells[1].textContent).toContain('0');
  });

  // חוק ברזל (Desktop Final Layout Pass - Owner requirement): כותרות הטבלה
  // חייבות להיות ממורכזות מעל הטור שלהן (לא צמודות לקצה) בשתי השפות.
  it('centers every textual desktop header over its own column', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const headerCells = Array.from(container.querySelectorAll('table thead tr th'));
    // Exclude the icon-only Views/Email columns and Client Type, whose
    // centering was already established before this task - this guard is
    // specifically for the columns whose header text used to hug an edge.
    const labelledByText = headerCells.filter((th) => th.textContent.trim().length > 0);
    labelledByText.forEach((th) => {
      expect(th.style.textAlign).toBe('center');
    });
  });

  // חוק ברזל (Desktop Final Layout Pass - Owner requirement): אייקונים
  // דקורטיביים (Hash/AlignLeft/Banknote/Calendar/CircleDot) שלא השתתפו
  // בשום פונקציונליות (המיון תלוי בלחיצה על כל תא הכותרת, לא באייקון עצמו)
  // הוסרו; אייקונים פונקציונליים (Eye/Mail, וה-icon של ClientTypeBadge)
  // נשארו. הבדיקה סופרת SVG-ים בשורת הכותרת בלבד ומוודאת שלא נשארו יותר
  // מהצפוי (Eye + Mail + אייקון ClientTypeBadge כש-client_type מוגדר).
  it('removes decorative header icons while keeping the functional ones', () => {
    const props = buildProps(isHebrew, { clients: { company_name: 'Test Client', client_type: 'business' } });
    const { container } = render(<QuotesTab {...props} />);

    const headerRow = container.querySelector('table thead tr');
    const headerSvgCount = headerRow.querySelectorAll('svg').length;
    // Eye (Views) + Mail (email status) = exactly 2 functional header icons.
    expect(headerSvgCount).toBe(2);
  });

  // חוק ברזל (Quote History All-Column Geometry Gate task - PROFLOW TABLE
  // COLUMN GEOMETRY CONTRACT): מגן על ה-regression class שקרה שוב ושוב
  // (Order/Amount/Actions/Date בזה אחר זה) - כותרת עם textAlign:'center'
  // אבל תא-גוף שנשאר צמוד-קצה. הבדיקה הזו בודקת מבנית (לא פיקסלים - jsdom
  // לא מחשב פריסה אמיתית, ר' PROFLOW_PROJECT_CONTEXT.md לאימות הגיאומטריה
  // האמיתית בדפדפן) שכל עמודות ה-CENTER המסווגות שומרות textAlign:'center'
  // גם בכותרת וגם בגוף - ושכל עמודות ה-START המסווגות (Client Name/
  // Description) *לא* הופכות ל-center בטעות (ההיפוך ההפוך היה שובר את
  // קריאות-הטקסט המכוונת). כל שינוי עתידי שמשנה עמודה אחת בטעות אמור
  // להיתפס כאן, לפני שיידרש לגלות אותו מחדש דרך Browser Harness.
  it('keeps CENTER-classified body cells centered and START-classified body cells edge-aligned (Table Column Geometry Contract)', () => {
    const props = buildProps(isHebrew);
    const { container } = render(<QuotesTab {...props} />);

    const cells = Array.from(container.querySelectorAll('table tbody tr:first-child td'));
    const startAlign = isHebrew ? 'right' : 'left';

    // CENTER: Client Type(0), Order(2), Amount(5 outer td), Date(6), Status(7), Actions(9)
    [0, 2, 5, 6, 7, 9].forEach((i) => {
      expect(cells[i].style.textAlign).toBe('center');
    });

    // START: Client Name(3), Description(4) - intentionally edge-aligned free text
    [3, 4].forEach((i) => {
      expect(cells[i].style.textAlign).toBe(startAlign);
    });
  });
});

// חוק ברזל (Final Quote-History Polish task - HE-Only Before-VAT Density +
// Market Separation): "לפני מע"מ" הוא ריכוז עסקי מקומי-ישראלי בלבד. הבדיקה
// הזו מגנה משני הכיוונים: (1) HE - הערך זמין רק כ-title (לא כשורה גלויה
// קבועה), (2) EN - אין שום title כזה בכלל, אפילו לא ריק - לא רק "לא מוצג",
// אלא לגמרי לא-קיים ב-DOM, מדגים את כלל ה-fail-closed של הפרדת השווקים.
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

// חוק ברזל (Quote History Final Polish task - Views Numeric Geometry
// Contract): מגן על המבנה שמייצר גיאומטריה דטרמיניסטית (לא על פיקסלים
// בפועל - jsdom לא מחשב פריסה אמיתית; ר' PROFLOW_PROJECT_CONTEXT.md
// לאימות ה-getBoundingClientRect האמיתי בדפדפן) - תת-תיבת-מספר ברוחב-קבוע
// + tabular-nums קיימים בפועל ב-DOM, בכל ספירת-ספרות, ו-Views=0 עדיין
// מוצג (לא מוסתר ע"י בדיקת-אמת).
describe.each([
  ['Hebrew/RTL', true],
  ['English/LTR', false],
])('QuotesTab Views cell numeric geometry (%s)', (_label, isHebrew) => {
  it.each([0, 1, 9, 10, 19, 99, 100, 637, 999])('renders a fixed-width, right-aligned, tabular-nums number box for view_count=%i', (viewCount) => {
    const props = buildProps(isHebrew, { view_count: viewCount });
    const { container } = render(<QuotesTab {...props} />);

    const viewsCell = container.querySelectorAll('table tbody tr:first-child td')[1];
    // חוק ברזל: לא מספיק להשוות textContent - ה-span העוטף (inline-flex)
    // גם הוא מכיל את אותו טקסט בדיוק (ה-SVG לא תורם טקסט), לכן חייבים
    // לזהות ספציפית את תת-תיבת-המספר עצמה (זו שיש לה style.width מוגדר).
    const numberBox = Array.from(viewsCell.querySelectorAll('span')).find(
      (el) => el.textContent === String(viewCount) && el.style.width,
    );
    expect(numberBox).toBeTruthy();
    expect(numberBox.style.width).toBe('22px');
    expect(numberBox.style.textAlign).toBe('right');
    expect(numberBox.style.fontVariantNumeric).toBe('tabular-nums');
    // האייקון עצמו קיים תמיד לצד תיבת-המספר, ללא תלות בערך.
    expect(viewsCell.querySelector('svg')).toBeTruthy();
  });
});

// חוק ברזל (Quote History Final Polish task, Part M - Email Indicator
// Regression, לא נבדק קודם בקובץ הזה): renderEmailDot הוא פונקציונלי, לא
// דקורטיבי (ר' §-ים קודמים ב-PROFLOW_PROJECT_CONTEXT.md) - RED = בהצעה
// email_bounced=true *או* emailStatus קיים-אך-לא-'success'; GREEN =
// emailStatus==='success'; BLANK = שני התנאים falsy. שלוש הבדיקות מגנות
// על שלושת המצבים כדי שסבב-ניקוי חזותי עתידי לא יסיר את הסמנטיקה בטעות.
describe('QuotesTab email indicator (functional, not decorative)', () => {
  it('renders no dot when there is no bounce and no send attempt', () => {
    const props = buildProps(true, { email_bounced: false });
    const { container } = render(<QuotesTab {...props} />);
    const emailCell = container.querySelectorAll('table tbody tr:first-child td')[8];
    expect(emailCell.querySelector('span[style*="border-radius"]')).toBeNull();
  });

  it('renders a bounced-state dot when quote.email_bounced is true, regardless of emailStatus', () => {
    const props = buildProps(true, { email_bounced: true });
    const { container } = render(<QuotesTab {...props} />);
    const emailCell = container.querySelectorAll('table tbody tr:first-child td')[8];
    const dot = emailCell.querySelector('span[title]');
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('title')).toBe('כתובת המייל ששלחת אינה קיימת');
  });

  it('renders a success-state dot when emailStatus is "success"', () => {
    const props = buildProps(false, { id: baseQuote.id, email_bounced: false });
    props.emailStatuses = { [baseQuote.id]: 'success' };
    const { container } = render(<QuotesTab {...props} />);
    const emailCell = container.querySelectorAll('table tbody tr:first-child td')[8];
    const dot = emailCell.querySelector('span[title]');
    expect(dot).toBeTruthy();
    expect(dot.getAttribute('title')).toBe('Email sent successfully');
  });
});
