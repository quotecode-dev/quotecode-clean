// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (QuotesTab.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import { useState, useEffect, Fragment } from 'react';
import { formatDateLocal } from '../utils/regionConfig';
import { History, Download, Building2, User, Eye, Mail, Pencil, Copy, MessageCircle, Trash2, ChevronDown, FileText, Filter, X } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import { isQuoteImmutable } from '../utils/quoteLock';
import { formatQuoteFallback } from '../utils/quoteNumber';

// חוק ברזל (Client Type Badge, Item 26 - עודכן לעיצוב הסופי לפי סבב תיקון
// חזותי מהבעלים): מקור-האמת היחיד עדיין clients.client_type ('business'/
// 'private', עמודה מפורשת קיימת כבר - ר' EditClientModal.jsx/ClientsTab.jsx/
// QuoteForm.jsx, לא מוסק מ-ח.פ/מע"מ/שם/אימייל, לא שונה בסבב הזה כלל). ערך
// לא-מוכר (לא 'business' ולא 'private') עדיין לא מציג כלום - "no guessing
// silently", ללא שינוי.
//
// עדכון (Item 26 Final UI Refinement): הטקסט הקבוע ("פרטי"/"עסקי") הוסר -
// עכשיו רק האייקון, בתוך מיכל בגודל קבוע (WxH זהים לחלוטין, ר' CLIENT_TYPE_
// BADGE_SIZE) כדי ש-Business ו-Private יתפסו בדיוק את אותו שטח-פריסה בכל
// שורה, בלי הבדל רוחב שיכול לגרום לעמודה "לקפוץ" - זו יישום ישיר של כלל
// עקביות-הרוחב-בממשק החדש (ר' PROFLOW_PROJECT_CONTEXT.md, כלל UI Width
// Consistency). המשמעות עדיין נגישה למרות הסרת הטקסט הקבוע: title (טולטיפ
// דפדפן טבעי ב-hover, ללא תלות חדשה) + aria-label/role="img" (שם נגיש
// לטכנולוגיה מסייעת בכל מצב - עצמאי לגמרי מ-hover/מגע, כך שמובייל לא תלוי
// ב-hover לנכונות). לא הפכנו את המיכל ל-tabIndex ממוקד-מקלדת בכוונה - עשרות
// שורות בטבלה היו הופכות לעצירות-Tab מיותרות; המשמעות הנגישה כבר מובטחת
// ללא תלות בפוקוס דרך aria-label. "Individual"/"לקוח פרטי" ו-"Business"/
// "לקוח עסקי" הן התוויות המדויקות שהבעלים ביקש לטולטיפ הזה בלבד - הבחירה
// הקיימת ב-select/בעמודת ClientsTab לא נגעה בה כלל.
//
// עדכון (Item 26 Owner QA Micro-Fix): הבעלים מצא את הבאדג' חיוור מדי -
// הרקע עכשיו סגול-ProFlow מלא (NEON.violet, אותו טוקן קיים בדיוק כמו הגרדיאנט/
// glow הראשיים בתמה - לא צבע סגול שרירותי חדש), האייקון לבן (NEON.textOnAccent)
// לניגודיות מלאה. ללא גרדיאנט, ללא צל כבד - במכוון, לפי הנחיית הבעלים. אותו
// גודל 24x24 בדיוק, אותה התנהגות title/aria-label, לשני הסוגים (Private/
// Business) אותו טיפול סגול זהה - צורת האייקון בלבד מבדילה בין הסוגים.
// חוק ברזל (Signature Fix + Mobile Cleanup task, דרישת בעלים נוספת -
// Mobile Quote History Sorting): רשימת השדות הניתנים-למיון היא בדיוק
// אותה רשימה שכבר קיימת בכותרות העמודות הניתנות-ללחיצה בטבלת הדסקטופ
// (ר' ה-<th onClick={() => handleQuoteSort(...)}> למטה) - לא הומצא שדה
// מיון נוסף כלשהו למובייל. "תיאור" (Description) לא ניתן-למיון גם
// בדסקטופ (אין עליו onClick/handleQuoteSort כלל) ולכן גם לא מופיע כאן.
const MOBILE_SORT_FIELDS = [
  { value: 'id', he: 'מס׳ הצעה', en: 'Quote #' },
  { value: 'client', he: 'שם לקוח', en: 'Client Name' },
  { value: 'clientType', he: 'סוג לקוח', en: 'Client Type' },
  { value: 'total', he: 'הסכום', en: 'Amount' },
  { value: 'date', he: 'תאריך', en: 'Date' },
  { value: 'status', he: 'סטטוס', en: 'Status' },
  { value: 'views', he: 'צפיות', en: 'Views' },
];

const CLIENT_TYPE_BADGE_SIZE = 24;
function ClientTypeBadge({ clientType, isHebrew }) {
  if (clientType !== 'business' && clientType !== 'private') return null;
  const isBusiness = clientType === 'business';
  const Icon = isBusiness ? Building2 : User;
  const tooltip = isBusiness
    ? (isHebrew ? 'לקוח עסקי' : 'Business Client')
    : (isHebrew ? 'לקוח פרטי' : 'Individual Client');
  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${CLIENT_TYPE_BADGE_SIZE}px`,
        height: `${CLIENT_TYPE_BADGE_SIZE}px`,
        borderRadius: '999px',
        background: NEON.violet,
        color: NEON.textOnAccent,
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      <Icon size={14} strokeWidth={2} />
    </span>
  );
}

export default function QuotesTab({
  quotes,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  quoteSortField,
  quoteSortDirection,
  handleQuoteSort,
  handleExportQuotes,
  handleEditClick,
  handleDuplicateQuote,
  sendWhatsApp,
  handleDeleteQuote,
  handleProtectedAction,
  activeTooltip,
  openDropdownId,
  isHebrew,
  isLocalIsraeliBusiness,
  formatNum,
  t,
  setPendingEmailQuote,
  emailStatuses,
  currency
}) {
  const tableDir = isHebrew ? 'rtl' : 'ltr';

  // רינדור מותנה אמיתי (JS), לא רק הסתרת CSS - כדי שלא יהיו שני עותקים
  // כפולים בו-זמנית בעץ ה-DOM (טבלת דסקטופ + כרטיסי מובייל) עבור אותן
  // הצעות/כפתורי פעולה, מה שהיה שובר גם נגישות (טאב-אינדקס לאלמנטים
  // מוסתרים) וגם בדיקות שמצפות להתאמה יחידה.
  // חוק ברזל (Mobile Horizontal Overflow, TEST Acceptance Package 1 -
  // תיקון בעלים אמיתי במכשיר): ברירת המחדל הקודמת הייתה `false` קשיח
  // (דסקטופ) גם על מכשיר נייד אמיתי - ה-useEffect למטה מתקן את זה רק
  // אחרי הרינדור הראשון. כלומר לרגע קצר בכל טעינה במובייל, הטבלה
  // הרחבה (minWidth:750px) הייתה קיימת בפועל ב-DOM לפני שהתיקון קרה -
  // בדיוק סוג הבאג ש"נעלם" מצילום מסך שנלקח אחרי שהעמוד התייצב, אבל
  // דפדפני מובייל מסוימים לא תמיד מכווצים בחזרה את טווח הגלילה האופקית
  // גם אחרי שהפריסה עצמה כבר תוקנה. התיקון: אתחול עצלני (lazy initializer)
  // שקורא ל-matchMedia באופן סינכררוני כבר ברינדור הראשון עצמו כשהוא
  // באמת קיים (דפדפן אמיתי) - אין עוד רגע-דסקטופ-שגוי בכלל. נשמר בדיוק
  // אותו fallback ל-false בסביבת בדיקות בלי matchMedia אמיתי (jsdom/Vitest).
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    // חוק ברזל: מאזין כפול (matchMedia 'change' + native window 'resize'),
    // שניהם קוראים מחדש window.matchMedia(...).matches בכל הפעלה - בפועל
    // אומת (Phase 2 live QA) ש-Emulation.setDeviceMetricsOverride/שינוי
    // viewport לא תמיד מפעיל את אירוע ה-'change' של אובייקט MediaQueryList
    // קיים, גם כש-matchMedia טרי כבר משקף את הרוחב הנכון - resize הרגיל
    // הוא הרשת ביטחון שמכסה את המקרה הזה בלי לסמוך על ערוץ יחיד.
    const recompute = () => setIsMobileView(window.matchMedia('(max-width: 768px)').matches);
    recompute();
    const mq = window.matchMedia('(max-width: 768px)');
    mq.addEventListener ? mq.addEventListener('change', recompute) : mq.addListener(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', recompute) : mq.removeListener(recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  // חוק ברזל (Authenticated App Consolidation task, §5 Expandable Row):
  // מודל single-expand מכוון (accordion) - לא multi-expand. נבחר כ"ההתנהגות
  // הפשוטה והצפויה ביותר" (הנחיית המשימה עצמה) - רשימת עסק עלולה להכיל
  // עשרות הצעות; אם כמה פאנלים ארוכים (תיאור+פעולות) היו יכולים להישאר
  // פתוחים בו-זמנית, הרשימה הייתה יכולה להתארך בצורה בלתי-צפויה ולאבד
  // הקשר-גלילה. state יחיד משותף לדסקטופ+מובייל (לא שני state נפרדים) -
  // אותה "פילוסופיית אינטראקציה" בשני ה-layouts, לפי דרישת המשימה.
  const [expandedQuoteId, setExpandedQuoteId] = useState(null);
  const toggleExpanded = (quoteId) => {
    setExpandedQuoteId(prev => (prev === quoteId ? null : quoteId));
  };

  // חוק ברזל (Authenticated UI Coherence task, Mobile Lists and Controls):
  // "Consolidate status and sort controls behind one compact Filters
  // control" - מובייל בלבד (דסקטופ, שיש בו מקום, ממשיך להציג את בורר-
  // הסטטוס גלוי ישירות ליד החיפוש כמו קודם - שום שינוי שם). state מקומי
  // טהור (לא נתון עסקי) לפתיחה/סגירה של ה-sheet הקומפקטי.
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // השפה/מע"מ של קישור ההצעה נגזרים מנתוני ההצעה השמורים (currency/tax_rate)
  // ולא מהגדרת השפה הנוכחית של המשתמש המחובר - כך שקישור להצעה בינלאומית
  // תמיד יפתח כאנגלית/ללא מע"מ, גם אם נוצר ע"י בעל עסק ישראלי, ולהיפך.
  const getQuoteViewLink = (quote) => {
    const isLocalQuote = Number(quote?.tax_rate) > 0 || (quote?.currency || '').toUpperCase() === 'ILS';
    return isLocalQuote
      ? `${window.location.origin}/public-quote/${quote.id}`
      : `${window.location.origin}/en/public-quote/${quote.id}?lang=en`;
  };

  // הסמל נגזר אך ורק מקוד המטבע השמור על ההצעה - לעולם לא משפת התצוגה
  // (isHebrew) של מי שצופה בטבלה כרגע. הצעה ב-ILS מציגה ₪ גם כשנצפית
  // באנגלית, והצעה ב-USD/EUR/GBP מציגה את סמלה גם כשנצפית בעברית.
  const getQuoteCurrencySymbol = (quoteCurr) => {
    const curr = (quoteCurr || '').toUpperCase();
    if (curr === 'EUR') return '€';
    if (curr === 'GBP') return '£';
    if (curr === 'ILS' || curr === '₪') return '₪';
    if (curr === 'USD' || curr === '$') return '$';
    // מטבע חסר/לא תקין על ההצעה עצמה - נופל לברירת המחדל של העסק
    const curUpper = (currency || '').toUpperCase();
    if (curUpper === 'EUR') return '€';
    if (curUpper === 'GBP') return '£';
    if (curUpper === 'ILS') return '₪';
    return '$';
  };

  const getStatusBadge = (st) => {
    switch(st) {
      case 'approved': return { bg: 'rgba(5, 150, 105, 0.12)', color: NEON.emerald, text: isHebrew ? 'אושר' : 'Approved' };
      case 'paid': return { bg: 'rgba(2, 132, 199, 0.12)', color: NEON.sky, text: isHebrew ? 'שולם' : 'Paid' };
      case 'sent': return { bg: 'rgba(180, 83, 9, 0.12)', color: NEON.amber, text: isHebrew ? 'נשלח' : 'Sent' };
      default: return { bg: 'rgba(107, 101, 128, 0.10)', color: NEON.textSecondary, text: isHebrew ? 'טיוטה' : 'Draft' };
    }
  };

  // מחושב פעם אחת פר-הצעה ומשמש הן את שורת הטבלה (Desktop) והן את הכרטיס
  // הנייד (Mobile) - כדי שלא לשכפל את אותו חישוב/תפריט הפעולות פעמיים.
  const rowsMeta = quotes.map((quote) => {
    const currentStatus = quote.status ? quote.status.toLowerCase() : 'draft';
    const isDropdownOpen = openDropdownId === quote.id;
    const isLocked = isQuoteImmutable(quote);
    const emailStatus = emailStatuses ? emailStatuses[quote.id] : null;

    const firstItemDesc = quote.quote_items && quote.quote_items.length > 0 ? quote.quote_items[0].description : '';
    const rawSubtotal = quote.subtotal || 0;
    const rawDiscount = quote.discount || 0;
    const discBase = rawSubtotal - ((rawSubtotal * rawDiscount) / 100);
    const isBizClient = (quote.client_type || quote.clients?.client_type) === 'business';
    const beforeVatAmount = isBizClient && isHebrew ? discBase : (quote.total / 1.18);

    const quoteSym = getQuoteCurrencySymbol(quote.currency);
    const badge = getStatusBadge(currentStatus);

    return { quote, currentStatus, isDropdownOpen, isLocked, emailStatus, firstItemDesc, beforeVatAmount, quoteSym, badge };
  });

  const renderEmailDot = (quote, emailStatus) => (
    quote.email_bounced ? (
      // כתובת לא קיימת/הצעה שהוחזרה (מזוהה ע"י resend-email-webhook,
      // לא ע"י תוצאת השליחה המיידית) - נשארת אדומה עד שליחה מחדש מוצלחת
      <span
        title={isHebrew ? 'כתובת המייל ששלחת אינה קיימת' : 'The email address you sent does not exist'}
        style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: NEON.redDark, boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.12)' }}
      />
    ) : emailStatus ? (
      <span
        title={emailStatus === 'success' ? (isHebrew ? 'אימייל נשלח בהצלחה' : 'Email sent successfully') : (isHebrew ? 'שליחת האימייל נכשלה' : 'Email failed')}
        style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: emailStatus === 'success' ? NEON.emeraldDark : NEON.redDark, boxShadow: emailStatus === 'success' ? '0 0 0 3px rgba(4, 120, 87, 0.12)' : '0 0 0 3px rgba(220, 38, 38, 0.12)' }}
      />
    ) : null
  );

  // חוק ברזל (Authenticated App Consolidation task, §4/§5 - Actions move
  // into the Expandable Row): הפונקציה הזו מחליפה את התפריט הצף הקודם
  // (position:fixed popup, מופעל ע"י openDropdownId/dropdownPos) - "פעולות
  // זמינות" הוא בדיוק אחד מהשדות המשניים שהמשימה מפרטת כמועמד למעבר לתוך
  // ה-Expandable Row, במקום עמודה קבועה בשורה הראשית. כל שישה ה-handlers
  // הקיימים (getQuoteViewLink+window.open, handleProtectedAction עוטף
  // handleEditClick/handleDuplicateQuote/sendWhatsApp, setPendingEmailQuote
  // ישיר, handleProtectedAction עוטף handleDeleteQuote) נקראים בדיוק כמו
  // קודם, עם אותם תנאי-נעילה/טולטיפ-הרשאה (activeTooltip.quoteId+action) -
  // רק המיכל הוויזואלי השתנה מ-position:fixed floating menu לשורת-שבבים
  // (chips) שוכנת-במקום בתוך פאנל-ההרחבה, כך שאין עוד "תפריט מעל תפריט"
  // כשלוחצים על שורה שכבר מורחבת. openDropdownId/dropdownPos/dropdownRef/
  // handleToggleDropdown עדיין מתקבלים כ-props (Dashboard.jsx לא נגוע) אך
  // אינם נדרשים עוד כאן - התפריט הצף המקורי הוסר לחלוטין, לא הוסתר.
  // חוק ברזל (Design System Coherence task, Action-Hierarchy Contract):
  // הפעולות עברו מ"כל פעולה מקבלת צבע-נושא משלה" (סגול/כתום/תכלת/ירוק/
  // תכלת/אדום) לסולם-צבע ממושמע אחיד ברחבי המוצר - סגול הוא הפעולה
  // הראשית היחידה (View, כי צפייה היא הפעולה הנפוצה/ה"טבעית" ביותר על
  // הצעה), פעולות רגילות (Edit/Duplicate/WhatsApp/Email) ניטרליות (אותו
  // אפור-שקט כמו כפתור Export CSV הקיים כבר ממש למעלה בקובץ הזה - לא צבע
  // חדש), Delete בלבד אדום. זהות/handler/entitlement-gating/tooltip/
  // aria-label של כל פעולה נשארו זהים לחלוטין - רק הצבע השתנה.
  const renderInlineActions = (quote, isLocked) => {
    const chipBase = { border: 'none', borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' };
    const neutralChip = { background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.border}` };
    const neutralIconColor = NEON.textSecondary;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <button
          onClick={() => window.open(getQuoteViewLink(quote), '_blank')}
          style={{ ...chipBase, background: 'rgba(124,58,237,0.10)', color: NEON.violet }}
        >
          <Eye size={14} color={NEON.violet} strokeWidth={2.2} />
          <span>{isHebrew ? 'צפה' : 'View'}</span>
        </button>

        <span style={{ position: 'relative', display: 'inline-block' }}>
          <button
            disabled={isLocked}
            title={isLocked ? (isHebrew ? 'לא ניתן לערוך הצעה חתומה' : 'Cannot edit a signed quote') : undefined}
            onClick={() => { if (!isLocked) handleProtectedAction(quote.id, 'edit', () => handleEditClick(quote)); }}
            style={{ ...chipBase, ...neutralChip, opacity: isLocked ? 0.55 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
          >
            <Pencil size={14} color={neutralIconColor} strokeWidth={2.2} />
            <span>{isHebrew ? 'ערוך' : 'Edit'}</span>
          </button>
          {activeTooltip.quoteId === quote.id && activeTooltip.action === 'edit' && (
            <div className="feature-lock-tooltip" style={{ position: 'absolute', top: '105%', [isHebrew ? 'right' : 'left']: 0, background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
              {isHebrew ? '🚀 בשביל פונקציה זו יש לדרג את המנוי למסלול Basic או Pro' : '🚀 Please upgrade your subscription to Basic or Pro to use this feature'}
            </div>
          )}
        </span>

        <span style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => handleProtectedAction(quote.id, 'duplicate', () => handleDuplicateQuote(quote))}
            style={{ ...chipBase, ...neutralChip }}
          >
            <Copy size={14} color={neutralIconColor} strokeWidth={2.2} />
            <span>{isHebrew ? 'שכפל' : 'Duplicate'}</span>
          </button>
          {activeTooltip.quoteId === quote.id && activeTooltip.action === 'duplicate' && (
            <div className="feature-lock-tooltip" style={{ position: 'absolute', top: '105%', [isHebrew ? 'right' : 'left']: 0, background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
              {isHebrew ? '🚀 בשביל פונקציה זו יש לדרג את המנוי למסלול Basic או Pro' : '🚀 Please upgrade your subscription to Basic or Pro to use this feature'}
            </div>
          )}
        </span>

        <span style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => handleProtectedAction(quote.id, 'whatsapp', () => sendWhatsApp(quote))}
            style={{ ...chipBase, ...neutralChip }}
          >
            <MessageCircle size={14} color={neutralIconColor} strokeWidth={2.2} />
            <span>{isHebrew ? 'וואטסאפ' : 'WhatsApp'}</span>
          </button>
          {activeTooltip.quoteId === quote.id && activeTooltip.action === 'whatsapp' && (
            <div className="feature-lock-tooltip" style={{ position: 'absolute', top: '105%', [isHebrew ? 'right' : 'left']: 0, background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
              {isHebrew ? '🚀 פונקציה זו (שליחה בוואטסאפ וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (WhatsApp sending & file attachments) is for Pro plan only'}
            </div>
          )}
        </span>

        <button
          onClick={() => setPendingEmailQuote(quote)}
          style={{ ...chipBase, ...neutralChip }}
        >
          <Mail size={14} color={neutralIconColor} strokeWidth={2.2} />
          <span>{isHebrew ? 'שלח במייל' : 'Email'}</span>
        </button>

        <span style={{ position: 'relative', display: 'inline-block' }}>
          <button
            disabled={isLocked}
            title={isLocked ? (isHebrew ? 'לא ניתן למחוק הצעה חתומה' : 'Cannot delete a signed quote') : undefined}
            onClick={() => { if (!isLocked) handleProtectedAction(quote.id, 'delete', () => handleDeleteQuote(quote.id, { number: formatQuoteFallback(quote), clientName: quote.clients?.company_name })); }}
            style={{ ...chipBase, background: isLocked ? NEON.bgCardAlt : 'rgba(220,38,38,0.10)', color: isLocked ? NEON.textMuted : NEON.red, border: isLocked ? `1px solid ${NEON.border}` : 'none', opacity: isLocked ? 0.55 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
          >
            <Trash2 size={14} color={isLocked ? NEON.textMuted : NEON.red} strokeWidth={2.2} />
            <span>{isHebrew ? 'מחק' : 'Delete'}</span>
          </button>
          {activeTooltip.quoteId === quote.id && activeTooltip.action === 'delete' && (
            <div className="feature-lock-tooltip" style={{ position: 'absolute', top: '105%', [isHebrew ? 'right' : 'left']: 0, background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
              {isHebrew ? '🚀 פונקציה זו (מחיקה וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (Deletion & file attachments) is for Pro plan only'}
            </div>
          )}
        </span>
      </div>
    );
  };

  // חוק ברזל (Authenticated App Consolidation task, §4 - Secondary
  // Information): פאנל-הרחבה משותף לדסקטופ (colSpan <td> בתוך <tr> שני)
  // ולמובייל (div מותנה מתחת לכרטיס) - אותו תוכן בדיוק בשני ה-layouts, לפי
  // דרישת המשימה ("share an interaction philosophy even if their layouts
  // differ"). מציג את כל השדות המשניים שהוסרו מהשורה הראשית: תיאור מלא
  // (לא חתוך יותר - היה כבר גלוי, רק חתוך; שום מידע לא הוסר, רק אורגן
  // מחדש), סוג לקוח (עכשיו עם תווית טקסט גלויה, לא רק אייקון+טולטיפ),
  // צפיות, מצב שליחת מייל, ואז שורת הפעולות (renderInlineActions).
  const renderDetailPanel = (row) => {
    const { quote, firstItemDesc, emailStatus, isLocked } = row;
    const clientType = quote.clients?.client_type;
    const clientTypeLabel = clientType === 'business'
      ? (isHebrew ? 'לקוח עסקי' : 'Business Client')
      : clientType === 'private'
        ? (isHebrew ? 'לקוח פרטי' : 'Individual Client')
        : null;
    const emailLabel = quote.email_bounced
      ? (isHebrew ? 'כתובת המייל אינה קיימת' : 'Email address does not exist')
      : emailStatus === 'success'
        ? (isHebrew ? 'אימייל נשלח בהצלחה' : 'Email sent successfully')
        : emailStatus === 'failed'
          ? (isHebrew ? 'שליחת האימייל נכשלה' : 'Email failed')
          : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem', color: NEON.textSecondary }}>
          {clientTypeLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ClientTypeBadge clientType={clientType} isHebrew={isHebrew} />
              {clientTypeLabel}
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Eye size={13} color={NEON.textMuted} strokeWidth={2} />
            {isHebrew ? `${quote.view_count || 0} צפיות` : `${quote.view_count || 0} views`}
          </span>
          {emailLabel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {renderEmailDot(quote, emailStatus)}
              {emailLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', color: NEON.textSecondary }}>
          <FileText size={14} color={NEON.textMuted} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{firstItemDesc || (isHebrew ? 'אין תיאור פריט' : 'No item description')}</span>
        </div>
        {renderInlineActions(quote, isLocked)}
      </div>
    );
  };

  return (
    // חוק ברזל (Owner QA Correction task, Mobile Width Utilization): padding
    // האחיד (14px, דסקטופ+מובייל כאחד) יצר שוליים מוכפלים במובייל - viewport
    // → dash-main-content (6px, override קיים מתחת ל-768px) → ה-padding
    // הזה (14px) → padding הפנימי של כל כרטיס-הצעה (10px) - סה"כ 30px משני
    // הצדדים לפני שהתוכן בכלל מתחיל, בדיוק דפוס-הבעיה שהבעלים תיאר. isMobileView
    // כבר קיים בקומפוננטה הזו בדיוק לצורך הזה (טבלה מול כרטיסים) - נעשה שימוש
    // חוזר בו כאן, לא נוסף מנגנון-CSS/media-query מקביל. דסקטופ (14px) לא נגע
    // בכלל - התנאי חל רק כש-isMobileView אמיתי.
    <div style={{ background: NEON.bgCard, padding: isMobileView ? '8px' : '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm, marginBottom: '16px' }}>
      {/* חוק ברזל (תיקון בעלים מאושר): הוסר flexDirection: row-reverse עבור
          עברית - היה זה הבאג עצמו. במיכל עם dir="rtl" (יורש מה-Dashboard),
          'row' הרגיל כבר ממקם את הילד הראשון ב-DOM (כותרת+ייצוא) ב-"התחלה"
          שהיא מימין, ואת הילד השני (חיפוש+סטטוס) ב-"סוף" שהוא משמאל - בדיוק
          מה שהבעלים ביקש. 'row-reverse' הקודם היפך את זה בטעות. באנגלית
          (dir="ltr"), אותו 'row' הרגיל כבר ממקם כותרת+ייצוא משמאל וחיפוש+
          סטטוס מימין - השיקוף הנכון מתקבל אוטומטית מכיוון הדף, בלי תנאי. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '800', letterSpacing: 'normal', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
            <History size={18} color={NEON.violetLight} strokeWidth={2.2} />
            {t.recentHistory}
          </h2>
          {/* חוק ברזל (החלטת בעלים מאושרת): כפתור "צור הצעת מחיר חדשה" הכפול
              הוסר מכאן - נשאר רק הכפתור הראשי העצמאי בשורת הניווט העליונה
              (handleCreateNewQuoteClick ב-Dashboard.jsx). כפתור ייצוא ה-CSV
              נשאר, שכן הוא שייך לטבלה עצמה. */}
          <button
            onClick={handleExportQuotes}
            style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '7px 14px', borderRadius: RADIUS.pill, cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = NEON.violetLighter; e.currentTarget.style.color = NEON.violet; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = NEON.bgCardAlt; e.currentTarget.style.color = NEON.textSecondary; }}
          >
            <Download size={15} strokeWidth={2.5} />
            <span>{isHebrew ? 'ייצא לאקסל (CSV)' : 'Export CSV'}</span>
          </button>
        </div>

        {/* V2 Visual Completion Pass: row-reverse residual bug fixed - this
            was the exact same "row-reverse for Hebrew is itself the bug"
            pattern already diagnosed and fixed one container up (see the
            comment above), left behind here. Plain 'row' lets the inherited
            dir="rtl"/dir="ltr" mirror correctly with no isHebrew branch.
            Authenticated UI Coherence task, Mobile Lists and Controls:
            desktop keeps this exact search+status arrangement, unchanged
            (there is room for both side by side). Mobile gets its own
            deliberate composition below instead - not this same row
            merely shrunk. */}
        {!isMobileView && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%', maxWidth: '350px' }}>
            <input
              type="text"
              placeholder={t.searchQuote}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: '1 1 130px', padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ flex: '1 1 90px', padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, background: NEON.bgInput, boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary }}
            >
              <option value="All">{t.filterStatus}</option>
              <option value="draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
              <option value="sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
              <option value="approved">{isHebrew ? 'אושר' : 'Approved'}</option>
              <option value="paid">{isHebrew ? 'שולם' : 'Paid'}</option>
            </select>
          </div>
        )}
      </div>

      {/* חוק ברזל (Authenticated UI Coherence task, Mobile Lists and
          Controls): מובייל בלבד - החיפוש מקבל שורה מלאה-רוחב עצמאית
          משלו ("Search receives a full-width usable row," הדרישה המפורשת
          של המשימה), וסטטוס+מיון (שהיו שני פקדים נפרדים - select-סטטוס
          כאן למעלה, select-מיון+כפתור-כיוון בשורה נפרדת למטה) אוחדו
          לכפתור "Filters" קומפקטי יחיד שפותח sheet - "one compact Filters
          control... equivalent accessible pattern." אותם state/handlers
          בדיוק (statusFilter/setStatusFilter/quoteSortField/
          quoteSortDirection/handleQuoteSort) - רק המיכל החזותי השתנה. */}
      {isMobileView && (
        <div style={{ marginBottom: '10px' }} dir={tableDir}>
          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
            <input
              type="text"
              placeholder={t.searchQuote}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: '1 1 auto', minWidth: 0, padding: '8px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
            <button
              type="button"
              onClick={() => setShowMobileFilters(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={showMobileFilters}
              aria-label={isHebrew ? 'סינון ומיון' : 'Filters'}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: `1px solid ${statusFilter !== 'All' || showMobileFilters ? NEON.violet : NEON.borderStrong}`, borderRadius: RADIUS.sm, background: statusFilter !== 'All' ? 'rgba(124,58,237,0.10)' : NEON.bgInput, color: statusFilter !== 'All' ? NEON.violet : NEON.textSecondary, fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <Filter size={14} strokeWidth={2.2} />
              {isHebrew ? 'סינון' : 'Filters'}
            </button>
          </div>
          {showMobileFilters && (
            <div style={{ marginTop: '8px', background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: RADIUS.sm, padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{t.filterStatus}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '7px', background: NEON.bgInput, boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary }}
                >
                  <option value="All">{t.filterStatus}</option>
                  <option value="draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
                  <option value="sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
                  <option value="approved">{isHebrew ? 'אושר' : 'Approved'}</option>
                  <option value="paid">{isHebrew ? 'שולם' : 'Paid'}</option>
                </select>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{isHebrew ? 'מיון' : 'Sort'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    value={quoteSortField}
                    onChange={(e) => handleQuoteSort(e.target.value)}
                    style={{ flex: '1 1 auto', minWidth: 0, padding: '5px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '7px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.75rem', fontWeight: '600' }}
                  >
                    {MOBILE_SORT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{isHebrew ? f.he : f.en}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleQuoteSort(quoteSortField)}
                    title={isHebrew ? 'הפוך כיוון מיון' : 'Toggle sort direction'}
                    aria-label={isHebrew ? 'הפוך כיוון מיון' : 'Toggle sort direction'}
                    style={{ flexShrink: 0, background: NEON.gradient, color: 'white', border: 'none', width: '30px', height: '30px', borderRadius: '7px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', boxShadow: NEON.glowSoft }}
                  >
                    {quoteSortDirection === 'asc' ? '▲' : '▼'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                style={{ alignSelf: isHebrew ? 'flex-start' : 'flex-end', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}
              >
                <X size={12} strokeWidth={2.5} />
                {isHebrew ? 'סגור' : 'Close'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ DESKTOP: sharp light table ============ */}
      {/* חוק ברזל (Critical Signature Forensic Audit + Final Canonical Width
          Alignment task, §58 "Table Fits ProFlow, Not The Reverse"): הבעלים
          דחה מפורשות את ההיגיון הקודם ("72vw חותך את Actions, אז ProFlow
          צריך 85vw") - רוחב המוצר לא נקבע ע"י טבלה בודדת; הטבלה חייבת
          להתאים לרוחב הקנוני (עכשיו 980px, זהה ל-Public Quote), לא להיפך.
          לכן, יחד עם הרחבת שוליים אנכיים מצומצמת (חלק ה-Density, למטה),
          כל עמודת-מטא-דאטה קומפקטית (סוג לקוח/צפיות/מייל/פעולות) צומצמה
          לרוחב-המינימום הנדרש לתוכן שלה בפועל, כדי לפנות מקום לעמודות
          הגמישות/התיאוריות (שם לקוח/תיאור) בלי לגרום ל-overflow אופקי
          ב-980px (952px בפועל בתוך ריפוד הפאנל - ר' index.css). נמדד חי
          ב-1280/1366/1440/1920px, שתי השפות, ר' PROFLOW_CLAUDE_LATEST_
          REPORT.md למדידות המדויקות. */}
      {!isMobileView && (
      <div style={{ overflowX: 'auto' }}>
        {/* חוק ברזל (Owner Visual Correction task - Frame B Corners): הבעלים
            זיהה חזותית שפינות Frame B (המסגרת סביב שורת-הכותרות) חדות, לא
            מעוגלות - למרות ש-getComputedStyle דיווח '12px' על borderTopLeftRadius
            וכו'. שורש-הבעיה: border-radius על <th>/<td> תחת border-collapse:
            'collapse' לא מרונדר ויזואלית בפועל בדפדפנים (מגבלת-CSS ידועה) -
            למרות שה-property עצמו עדיין מוחזר נכון ב-computed style, מה
            שהטעה בדיקה מבוססת-computed-style-בלבד קודם. אומת אמפירית לפני
            התיקון (סימולציית-DOM בטוחה + הפוכה): מעבר ל-borderCollapse:
            'separate' + borderSpacing:0 גורם ל-border-radius לרונדר בפועל,
            עם הבדל-מדיד יחיד ורק על התא הקיצוני (הראשון) - 0.5px, תוצאת-לוואי
            בלתי-נמנעת וצפויה של מעבר מודל-גבולות (הגבול-החיצוני של הטבלה
            כבר לא "חצי-מכווץ" לתוך גבול-הטבלה כמו ב-collapse, אלא מרונדר
            במלואו) - לא שינוי-גיאומטריה אמיתי של עמודה כלשהי; כל שאר רוחבי/
            מיקומי הכותרות זהים ב-100%. */}
        {/* חוק ברזל (Authenticated App Consolidation task, §4 "PRIMARY vs
            SECONDARY INFORMATION" - horizontal-scroll removal): הטבלה
            צומצמה מ-10 עמודות (Client Type/Views/Order#/Client Name/
            Description/Amount/Date/Status/Email/Actions) ל-6 בלבד (Client
            Name/Order#/Amount/Status/Date/Expand-control) - בדיוק רשימת
            "PRIMARY ROW CONTENT" שהמשימה מפרטת. ארבעת העמודות שהוסרו
            (Client Type/Views/Description/Email) + Actions (שהמשימה עצמה
            מציינת כמועמד-סגירה: "available quote actions") עברו לפאנל-
            ההרחבה (renderDetailPanel) - שום מידע/יכולת לא הוסרה, רק אורגנה
            מחדש לפי עקרון PRIMARY/SECONDARY. minWidth הופחת בהתאם - עם
            הרבה פחות עמודות, שם-הלקוח (העמודה הגמישה היחידה) מקבל בפועל
            יותר רוחב מקודם (ר' ה-minWidth שלו למטה), לא פחות, למרות
            ה-minWidth הכולל הנמוך יותר של הטבלה - ר' האריתמטיקה המלאה
            בהערה שלפני ה-<table>. */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: isHebrew ? 'right' : 'left', minWidth: '440px' }} dir={tableDir}>
          <thead>
            {/* חוק ברזל (Owner New Final Dashboard Structure task - FRAME B,
                נשמר): אותו טוקן-סגול/עובי-גבול/radius כמו Frame A. Client
                Name (ראשון ב-DOM עכשיו) בקצה הימני ב-HE/השמאלי ב-EN;
                Expand-control (אחרון ב-DOM) בקצה הנגדי. */}
            <tr style={{ color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {/* OWNER CORRECTION (RTL/LTR Sidebar Position + Quote-Row Expand
                  Control task): the expand-control column moved from LAST to
                  FIRST in DOM order - it must render "at the beginning of the
                  language's natural reading direction, before the quote's
                  primary information" (Owner's own wording), not after it.
                  Under dir={tableDir} this places it at the row's true
                  inline-start: physically RIGHT for Hebrew, physically LEFT
                  for English - matching the corrected chevron rule exactly
                  the same way Client Name used to be placed first for the
                  same reason. No isHebrew-conditional DOM reordering was
                  added - one single column order, mirrored automatically by
                  dir, per this file's own established convention. */}
              {/* חוק ברזל (§5 Expandable Row): בקרת-הרחבה - ללא כותרת מילולית
                  (אייקון-בלבד, כמו Views/Email הישנים), aria-label על הכפתור
                  עצמו בכל שורה נותן את המשמעות הנגישה. */}
              <th style={{ padding: '10px 3px', textAlign: 'center', width: '36px', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5', ...(isHebrew ? { borderRight: '1px solid #ece9f5', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' } : { borderLeft: '1px solid #ece9f5', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }) }} />
              {/* חוק ברזל (Authenticated App Consolidation task): שם הלקוח -
                  עדיין ראשון בין העמודות ה"תוכניות" (מיד אחרי בקרת ההרחבה),
                  לפי "PRIMARY ROW CONTENT" ברשימת המשימה עצמה. minWidth
                  200px נשמר - אין עוד עיגול-פינה על העמודה הזו (עברה לבקרת-
                  ההרחבה, שהיא העמודה החיצונית עכשיו). */}
              {/* חוק ברזל (Authenticated App Consolidation task - UI specialist
                  re-check finding, real defect found+fixed): the six column
                  widths (now including the relocated expand-control column)
                  still sum to ~620-625px against a confirmed ~680px
                  available budget - a real ~55-60px safety margin, unaffected
                  by reordering columns since no width value changed here,
                  only DOM order. */}
              <th style={{ padding: '10px 5px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', minWidth: '200px', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5' }} onClick={() => handleQuoteSort('client')}>
                {isHebrew ? 'שם לקוח' : 'Client Name'} {quoteSortField === 'client' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '10px 3px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '72px', whiteSpace: 'nowrap', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5' }} onClick={() => handleQuoteSort('id')}>
                {isHebrew ? 'מס׳ הצעה' : 'Quote #'} {quoteSortField === 'id' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '10px 5px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '86px', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5' }} onClick={() => handleQuoteSort('total')}>
                {isHebrew ? 'הסכום' : 'Amount'} {quoteSortField === 'total' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '10px 5px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '78px', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5' }} onClick={() => handleQuoteSort('status')}>
                {isHebrew ? 'סטטוס' : 'Status'} {quoteSortField === 'status' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {/* Date is now the last/outer column (was the expand control) -
                  it gains the outer-edge border/corner-radius treatment. */}
              <th style={{ padding: '10px 5px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '100px', borderTop: '1px solid #ece9f5', borderBottom: '1px solid #ece9f5', ...(isHebrew ? { borderLeft: '1px solid #ece9f5', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' } : { borderRight: '1px solid #ece9f5', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }) }} onClick={() => handleQuoteSort('date')}>
                {isHebrew ? 'תאריך' : 'Date'} {quoteSortField === 'date' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsMeta.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
                  {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
                </td>
              </tr>
            ) : (
              rowsMeta.map((row) => {
                const { quote, quoteSym, badge } = row;
                const isExpanded = expandedQuoteId === quote.id;
                const detailId = `quote-detail-${quote.id}`;
                return (
                <Fragment key={quote.id}>
                <tr style={{ borderBottom: isExpanded ? 'none' : `1px solid ${NEON.divider}`, fontSize: '0.82rem', lineHeight: '1.2' }}>
                  {/* OWNER CORRECTION: expand-control cell moved to be the
                      first <td>, matching the reordered <th> above - see the
                      comment on the header row for the full rationale. */}
                  {/* חוק ברזל (Quote History Row Density task, added 2026-09-04):
                      the collapsed row's rendered height was previously
                      dictated almost entirely by THIS cell, not by any text
                      content - the toggle button's own fixed 26x26px visual
                      box (well above the ~16-18px line-height any text cell
                      in this row actually needs) forced this cell alone to
                      ~46px (10px padding + 26px button + 10px padding), even
                      though every sibling cell's real text content would
                      have comfortably fit in ~35-38px. No prior pass in this
                      file's own history/PROFLOW docs had actually measured
                      or targeted a collapsed-row height for Quote History
                      specifically (confirmed by re-reading every existing
                      comment in this file plus PROFLOW_HANDOFF.md/
                      PROFLOW_TODO.md/PROFLOW_PROJECT_CONTEXT.md before this
                      change - the closest prior work was ClientsTab.jsx's
                      own equivalent accordion row, a separate file/component,
                      which went through its own real-browser-measured
                      6px→28.5px-too-small→11px→38.5px-in-band correction;
                      that file's validated 38.5px real number is the closest
                      available evidence for what padding+line-height this
                      shared theme/font actually renders at, and is used
                      below as a calibration reference, not copied blind).
                      Fix here is therefore surgical: the button's own visual
                      box shrinks 26px→20px (still a full ChevronDown-16
                      icon's worth of room), landing this cell at 10+20+10=
                      40px - the top of the requested ~38-40px band, and now
                      the tallest cell in the row (previously false by a wide
                      margin). Tap-target preservation: NOT achieved by
                      shrinking the button and leaving it at that - the
                      button gets 6px of real CSS padding on all sides
                      (pushing its actual clickable/rendered border-box out
                      to 32x32px) offset by an equal -6px margin, which
                      cancels the padding's contribution back out of the
                      surrounding table-cell layout (a negative margin on an
                      inline-flex box reduces its line-box footprint the same
                      way a positive margin would increase it) - so the row's
                      own height budget only "sees" the original 20px, while
                      a mouse/pointer actually clicking anywhere in that
                      32x32px area still hits the button. In the resting
                      (unexpanded, background:transparent) state this is
                      completely invisible - only the aria-expanded highlight
                      background paints slightly larger than the icon, which
                      is a harmless, arguably-helpful larger "active" cue,
                      not a visual regression. */}
                  <td style={{ padding: '10px 3px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleExpanded(quote.id)}
                      aria-expanded={isExpanded}
                      aria-controls={detailId}
                      aria-label={isHebrew ? 'הצג פרטים נוספים' : 'Show more details'}
                      style={{ background: isExpanded ? 'rgba(124,58,237,0.1)' : 'transparent', border: 'none', borderRadius: RADIUS.sm, width: '20px', height: '20px', padding: '6px', margin: '-6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: NEON.violet }}
                    >
                      <ChevronDown size={16} strokeWidth={2.4} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                  </td>
                  {/* חוק ברזל (Typography Hierarchy Contract, נשמר): 600→300
                      מדויק דרך 'Rubik Variable' - זהה למקור. */}
                  {/* חוק ברזל (Quote History Row Density task): 10px→9px
                      vertical - a real, modest reduction (not the button
                      fix's job to carry alone), kept deliberately small since
                      this cell's own text content was never the row's
                      bottleneck (see the button cell's comment above) and an
                      explicit `lineHeight:'1.2'` was added at the <tr> level
                      (inherited here) so this reduction lands on a
                      deterministic content height instead of guessing at the
                      browser/font's default "normal" line-height. */}
                  <td className="pf-font-variable" style={{ padding: '11px 5px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quote.clients?.company_name || ''}>
                    {quote.clients?.company_name || 'N/A'}
                  </td>
                  <td style={{ padding: '11px 3px', verticalAlign: 'middle', textAlign: 'center', fontWeight: '600', color: NEON.violet, direction: 'ltr', whiteSpace: 'nowrap' }}>
                    {formatQuoteFallback(quote)}
                  </td>
                  {/* חוק ברזל (Final Quote-History Polish task - HE-Only Before-VAT
                      Density, נשמר): "לפני מע"מ: ₪X" זמין דרך title (hover)
                      על תא הסכום - לא כשורה נוספת גלויה. אין מקבילה ל-
                      International (Market Separation, ללא שינוי). */}
                  <td style={{ padding: '11px 5px', verticalAlign: 'middle', textAlign: 'center' }} title={isLocalIsraeliBusiness && isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(row.beforeVatAmount)}` : undefined}>
                    <div style={{ display: 'inline-block', width: '70px', textAlign: 'right', fontWeight: '400', color: NEON.textPrimary, fontSize: '0.9rem' }}>
                      <span className="pf-money">{quoteSym}{formatNum(quote.total)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 5px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', display: 'inline-block' }}>
                      {badge.text}
                    </span>
                  </td>
                  <td style={{ padding: '11px 5px', verticalAlign: 'middle', textAlign: 'center', color: NEON.textMuted, fontSize: '0.75rem', direction: 'ltr' }}>
                    {formatDateLocal(quote.created_at, isHebrew, currency)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ borderBottom: `1px solid ${NEON.divider}` }}>
                    <td id={detailId} colSpan={6} style={{ padding: '4px 12px 14px', background: NEON.bgCardAlt }}>
                      {renderDetailPanel(row)}
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}


      {/* ============ MOBILE: expandable card layout (§6) ============ */}
      {/* חוק ברזל (Authenticated App Consolidation task, §6): הכרטיס הנייד
          עבר מ"כל השדות תמיד גלויים" ל-PRIMARY/SECONDARY זהה לעקרון
          הדסקטופ - שורה ראשית (שם לקוח/סכום/מספר הזמנה/תאריך/סטטוס) תמיד
          גלויה, Client Type/Views/Email/Description/Actions עברו לפאנל-
          הרחבה משותף (renderDetailPanel, אותו בדיוק כמו הדסקטופ). כל
          הכרטיס לחיץ (כפתור אמיתי, לא div+onClick) - מטרת-מגע גדולה,
          מקלדת-נגישה חינם. dir={tableDir} הקיים ממשיך למקם/למרכז נכון
          בשתי השפות ללא תנאי isHebrew נוסף כלשהו, כמו בכל שאר הקובץ. */}
      {isMobileView && (
      <>
      {/* חוק ברזל (Authenticated UI Coherence task, Mobile Lists and
          Controls): פקד-המיון הנפרד שהיה כאן (select+כפתור-כיוון, שורה
          עצמאית מעל רשימת הכרטיסים) אוחד לתוך ה-"Filters" sheet הקומפקטי
          החדש למעלה (ר' showMobileFilters) - אותם handleQuoteSort/
          quoteSortField/quoteSortDirection בדיוק, רק המיקום החזותי השתנה.
          יכולת-המיון עצמה (הרגרסיה שהמשימה הקודמת תיקנה) עדיין קיימת
          במלואה, לא נסוגה. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rowsMeta.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
            {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
          </div>
        ) : (
          rowsMeta.map((row) => {
            const { quote, quoteSym, badge } = row;
            const isExpanded = expandedQuoteId === quote.id;
            const detailId = `quote-detail-mobile-${quote.id}`;
            // חוק ברזל (Authenticated App Consolidation task, §6 Mobile
            // Quote History): הכרטיס עצמו מתמצה עכשיו לחמשת השדות
            // ה"PRIMARY" שהמשימה מפרטת - זהה בדיוק לרשימת הדסקטופ (Client
            // Name/Order#/Amount/Status/Date) - Client Type/Views/Email/
            // Description/Actions עברו ל-renderDetailPanel המשותף (אותה
            // "פילוסופיית אינטראקציה" כמו הדסקטופ, לפי דרישת המשימה, גם אם
            // ה-layout שונה: card מלא-לחיצה כאן, כפתור-חץ נקודתי בדסקטופ).
            // ה-<button> העוטף את כל הכרטיס נותן מטרת-מגע גדולה+טבעית,
            // ומקבל aria-expanded/aria-controls + הפעלת-מקלדת חינם (כפתור
            // אמיתי, לא div עם onClick).
            return (
            <div key={quote.id} className="quote-card" style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', overflow: 'hidden' }} dir={tableDir}>
              {/* OWNER CORRECTION (RTL/LTR Sidebar Position + Quote-Row Expand
                  Control task): the chevron moved from the end of the card's
                  own content to a dedicated leading element, first in DOM,
                  before the primary Name/Amount/Order/Date/Status content -
                  matching the desktop table's own corrected expand-control
                  placement (now the first column) and the same "chevron at
                  the beginning of the language's reading direction" rule.
                  The button itself is now a flex row instead of a block, so
                  under dir={tableDir} the chevron (first DOM child) lands at
                  the card's true inline-start: physically RIGHT for Hebrew,
                  physically LEFT for English. */}
              <button
                type="button"
                onClick={() => toggleExpanded(quote.id)}
                aria-expanded={isExpanded}
                aria-controls={detailId}
                aria-label={isHebrew ? 'הצג פרטים נוספים' : 'Show more details'}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', padding: '9px 10px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left', fontFamily: 'inherit' }}
              >
                <ChevronDown size={15} strokeWidth={2.4} color={NEON.violet} style={{ flexShrink: 0, marginTop: '2px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="pf-font-variable"
                      style={{ fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, fontSize: '0.9rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}
                      title={quote.clients?.company_name || 'N/A'}
                    >
                      {quote.clients?.company_name || 'N/A'}
                    </span>
                    <span
                      style={{ fontWeight: '400', color: NEON.textPrimary, fontSize: '0.95rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                      title={isLocalIsraeliBusiness && isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(row.beforeVatAmount)}` : undefined}
                    >
                      <span className="pf-money">{quoteSym}{formatNum(quote.total)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', fontSize: '0.7rem', color: NEON.textMuted }}>
                      <span style={{ fontWeight: '600', color: NEON.violet, direction: 'ltr' }}>{formatQuoteFallback(quote)}</span>
                      <span>·</span>
                      <span style={{ direction: 'ltr', whiteSpace: 'nowrap' }}>{formatDateLocal(quote.created_at, isHebrew, currency)}</span>
                    </div>
                    <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {badge.text}
                    </span>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div id={detailId} style={{ padding: '2px 10px 12px', borderTop: `1px solid ${NEON.border}` }}>
                  {renderDetailPanel(row)}
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
}
