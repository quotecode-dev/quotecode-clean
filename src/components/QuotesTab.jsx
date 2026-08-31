// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (QuotesTab.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import { useState, useEffect } from 'react';
import { formatDateLocal } from '../utils/regionConfig';
import { History, Download, Building2, User, Eye, Mail, Pencil, Copy, MessageCircle, Trash2 } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
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
  { value: 'id', he: 'מספר הזמנה', en: '# Order' },
  { value: 'client', he: 'שם לקוח', en: 'Client Name' },
  { value: 'clientType', he: 'סוג לקוח', en: 'Client Type' },
  { value: 'total', he: 'הסכום', en: 'Amount' },
  { value: 'date', he: 'תאריך', en: 'Date' },
  { value: 'status', he: 'סטטוס', en: 'Status' },
  { value: 'views', he: 'צפיות', en: 'Views' },
];

const CLIENT_TYPE_BADGE_SIZE = 24;
// חוק ברזל (Signature Fix + Mobile Cleanup task, תיקון-בעלים חי - "Fixed
// Mobile Metadata Columns"): הבעלים דחה מפורשות את הגרסה הראשונה (flex +
// flexWrap) - שם שם-לקוח ארוך "דחף" ויכל לגרום ל-Client Type/Views לעבור
// שורה או לזוז, כך שהעמודות לא היו יציבות/זהות בין כרטיסים. התיקון: grid
// אמיתי עם שלושה tracks ברוחב קבוע לחלוטין (לא flex עם wrap) - Client Type
// ו-Views מקבלים רוחב-פיקסלים מפורש (זהה בכל כרטיס, גם כש-Views ריק),
// שם-הלקוח מקבל 1fr ונחתך ב-ellipsis בשורה אחת בלבד, לעולם לא עוטף. ר'
// ה-JSX למטה: שלושת האלמנטים (סוג/צפיות/שם) תמיד מרונדרים (אף פעם לא
// null) כך שמיקום ה-grid tracks נשאר קבוע תמיד, גם בהצעה עם 0 צפיות.
const MOBILE_META_TYPE_COL = CLIENT_TYPE_BADGE_SIZE; // 24px, בדיוק רוחב הבאדג'
const MOBILE_META_VIEWS_COL = 32; // מספיק ל-"👁 999" (3 ספרות) בלי לגלוש
const MOBILE_META_AMOUNT_COL = 78; // מספיק לרוב הסכומים המציאותיים (עד ~6 ספרות עם מטבע ואגורות) בלי להזיז את Type/Views
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
  setOpenDropdownId,
  dropdownPos,
  dropdownRef,
  handleToggleDropdown,
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

  const renderActionsMenu = (quote, isDropdownOpen, isLocked) => (
    isDropdownOpen && (
      <>
        <div
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999998, background: 'transparent' }}
          onClick={() => setOpenDropdownId(null)}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            background: NEON.bgElevated,
            border: `1px solid ${NEON.borderStrong}`,
            borderRadius: '10px',
            boxShadow: '0 12px 28px -8px rgba(31,27,46,0.18)',
            zIndex: 999999,
            minWidth: '180px',
            padding: '4px 0',
            textAlign: isHebrew ? 'right' : 'left'
          }}
        >
          <button
            onClick={() => { setOpenDropdownId(null); window.open(getQuoteViewLink(quote), '_blank'); }}
            style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.violet, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(124,58,237,0.06)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            <Eye size={15} color={NEON.violetLight} strokeWidth={2.2} />
            <span>{isHebrew ? 'צפה במסמך' : 'View Quote'}</span>
          </button>

          <div style={{ position: 'relative' }}>
            <span
              title={isLocked ? (isHebrew ? 'לא ניתן לערוך הצעה חתומה' : 'Cannot edit a signed quote') : undefined}
              style={{ display: 'block', width: '100%' }}
            >
              <button
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  setOpenDropdownId(null);
                  handleProtectedAction(quote.id, 'edit', () => handleEditClick(quote));
                }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: isLocked ? NEON.textMuted : NEON.amber, opacity: isLocked ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                onMouseEnter={(e) => { if (!isLocked) e.target.style.background = 'rgba(180,83,9,0.08)'; }}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <Pencil size={15} color={isLocked ? NEON.textMuted : NEON.amber} strokeWidth={2.2} />
                <span>{isHebrew ? 'ערוך במסמך' : 'Edit Quote'}</span>
              </button>
            </span>
            {activeTooltip.quoteId === quote.id && activeTooltip.action === 'edit' && (
              <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
                {isHebrew ? '🚀 בשביל פונקציה זו יש לדרג את המנוי למסלול Basic או Pro' : '🚀 Please upgrade your subscription to Basic or Pro to use this feature'}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setOpenDropdownId(null);
                handleProtectedAction(quote.id, 'duplicate', () => handleDuplicateQuote(quote));
              }}
              style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.sky, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(2,132,199,0.08)'}
              onMouseLeave={(e) => e.target.style.background = 'none'}
            >
              <Copy size={15} color={NEON.sky} strokeWidth={2.2} />
              <span>{isHebrew ? 'שכפל במסמך' : 'Duplicate Quote'}</span>
            </button>
            {activeTooltip.quoteId === quote.id && activeTooltip.action === 'duplicate' && (
              <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
                {isHebrew ? '🚀 בשביל פונקציה זו יש לדרג את המנוי למסלול Basic או Pro' : '🚀 Please upgrade your subscription to Basic or Pro to use this feature'}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setOpenDropdownId(null);
                handleProtectedAction(quote.id, 'whatsapp', () => sendWhatsApp(quote));
              }}
              style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.emerald, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(5,150,105,0.08)'}
              onMouseLeave={(e) => e.target.style.background = 'none'}
            >
              <MessageCircle size={15} color={NEON.emerald} strokeWidth={2.2} />
              <span>{isHebrew ? 'שלח בוואטסאפ' : 'Send WhatsApp'}</span>
            </button>
            {activeTooltip.quoteId === quote.id && activeTooltip.action === 'whatsapp' && (
              <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
                {isHebrew ? '🚀 פונקציה זו (שליחה בוואטסאפ וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (WhatsApp sending & file attachments) is for Pro plan only'}
              </div>
            )}
          </div>

          <button
            onClick={() => { setOpenDropdownId(null); setPendingEmailQuote(quote); }}
            style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.sky, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(2,132,199,0.08)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            <Mail size={15} color={NEON.sky} strokeWidth={2.2} />
            <span>{isHebrew ? 'שלח במייל' : 'Send Email'}</span>
          </button>

          <div style={{ position: 'relative' }}>
            <span
              title={isLocked ? (isHebrew ? 'לא ניתן למחוק הצעה חתומה' : 'Cannot delete a signed quote') : undefined}
              style={{ display: 'block', width: '100%' }}
            >
              <button
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  setOpenDropdownId(null);
                  handleProtectedAction(quote.id, 'delete', () => handleDeleteQuote(quote.id, { number: formatQuoteFallback(quote), clientName: quote.clients?.company_name }));
                }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: isLocked ? NEON.textMuted : NEON.red, opacity: isLocked ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                onMouseEnter={(e) => { if (!isLocked) e.target.style.background = 'rgba(220, 38, 38, 0.08)'; }}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                <Trash2 size={15} color={isLocked ? NEON.textMuted : NEON.red} strokeWidth={2.2} />
                <span>{isHebrew ? 'מחק מסמך' : 'Delete Quote'}</span>
              </button>
            </span>
            {activeTooltip.quoteId === quote.id && activeTooltip.action === 'delete' && (
              <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.textPrimary, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(31,27,46,0.3)' }}>
                {isHebrew ? '🚀 פונקציה זו (מחיקה וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (Deletion & file attachments) is for Pro plan only'}
              </div>
            )}
          </div>
        </div>
      </>
    )
  );

  return (
    // חוק ברזל (Owner QA Correction task, Mobile Width Utilization): padding
    // האחיד (14px, דסקטופ+מובייל כאחד) יצר שוליים מוכפלים במובייל - viewport
    // → dash-main-content (6px, override קיים מתחת ל-768px) → ה-padding
    // הזה (14px) → padding הפנימי של כל כרטיס-הצעה (10px) - סה"כ 30px משני
    // הצדדים לפני שהתוכן בכלל מתחיל, בדיוק דפוס-הבעיה שהבעלים תיאר. isMobileView
    // כבר קיים בקומפוננטה הזו בדיוק לצורך הזה (טבלה מול כרטיסים) - נעשה שימוש
    // חוזר בו כאן, לא נוסף מנגנון-CSS/media-query מקביל. דסקטופ (14px) לא נגע
    // בכלל - התנאי חל רק כש-isMobileView אמיתי.
    <div style={{ background: NEON.bgCard, padding: isMobileView ? '8px' : '14px', borderRadius: '14px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
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
            style={{ background: '#111827', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px -2px rgba(17, 24, 39, 0.3)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#1f2937'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#111827'}
          >
            <Download size={15} strokeWidth={2.5} />
            <span>{isHebrew ? 'ייצא לאקסל (CSV)' : 'Export CSV'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', width: '100%', maxWidth: '350px' }}>
          <input
            type="text"
            placeholder={t.searchQuote}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: '1 1 130px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: '1 1 90px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary }}
          >
            <option value="All">{t.filterStatus}</option>
            <option value="draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
            <option value="sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
            <option value="approved">{isHebrew ? 'אושר' : 'Approved'}</option>
            <option value="paid">{isHebrew ? 'שולם' : 'Paid'}</option>
          </select>
        </div>
      </div>

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
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: isHebrew ? 'right' : 'left', minWidth: '700px' }} dir={tableDir}>
          <thead>
            {/* חוק ברזל (Owner New Final Dashboard Structure task - FRAME B):
                Frame B עוטף אך ורק את שורת-הכותרות (thead), לא את שורות-
                הנתונים - אותו טוקן-סגול/עובי-גבול/radius בדיוק כמו Frame A
                (dash-upper-section, #E9D5FF/1px/12px), כדי ששני המסגרות
                ייראו כזוג-מתואם, לפי דרישת הבעלים. טכניקה: border-collapse
                כבר קיים על הטבלה (collapse) - במקום border ברמת ה-<tr>
                (תמיכת-דפדפנים לא עקבית ל-border-radius ב-tr תחת collapse),
                כל <th> מקבל בעצמו borderTop+borderBottom (1px #E9D5FF) -
                אלה מתמזגים לקו רציף אחד לאורך כל השורה תחת collapse. רק
                שני התאים הקיצוניים (הראשון/האחרון בסדר ה-DOM) מקבלים גם
                border בצד החיצוני-הפיזי שלהם + עיגול-פינות בצד הזה - כדי
                שהמסגרת תיראה כמלבן שלם אחד, לא כרשת-תאים. הצד הפיזי תלוי-
                כיוון (isHebrew) בדיוק כמו כל שאר ה-inline-start/end בקובץ
                הזה - Client Type (ראשון ב-DOM) בקצה הימני ב-HE/השמאלי
                ב-EN; Actions (אחרון ב-DOM) בקצה הנגדי. */}
            <tr style={{ color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {/* חוק ברזל (Desktop HE/EN Mirroring Fix): Client Type + Views
                  עברו להיות שני הטורים הראשונים בסדר ה-DOM (לפני # Order/שם
                  לקוח), כדי שיתאימו לכלל הקבוע - Client Type הוא הפריט
                  הראשון/החיצוני ביותר מקצה ה-inline-start (ימין ב-RTL, שמאל
                  ב-LTR), Views מיד אחריו - תוך הסתמכות על dir={tableDir}
                  הקיים כבר על ה-<table> לשיקוף אוטומטי, בדיוק כמו הכלל
                  שכבר נקבע ל-Mobile (§63) - סדר DOM אחיד לא-מותנה-בשפה. */}
              <th style={{ padding: '4px 4px', textAlign: 'center', width: `${CLIENT_TYPE_BADGE_SIZE + 10}px`, cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF', ...(isHebrew ? { borderRight: '1px solid #E9D5FF', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' } : { borderLeft: '1px solid #E9D5FF', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }) }} onClick={() => handleQuoteSort('clientType')}>
                {isHebrew ? 'סוג לקוח' : 'Client Type'} {quoteSortField === 'clientType' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {/* חוק ברזל (Desktop Final Layout Pass - Owner requirement): עמודת
                  הצפיות עברה לאייקון-בלבד (בלי הטקסט "צפיות"/"Views") - האייקון
                  כבר מזוהה אוניברסלית, והכותרת המלאה הייתה מיותרת ברוחב הצר
                  הזה. aria-label + title נשמרים לנגישות/טולטיפ.
                  עדכון (Quote History Final Polish task - Views Numeric Geometry
                  Contract): הרוחב עודכן שוב 28px→46px - תא-הגוף עכשיו שומר
                  רוחב-מספר קבוע (ר' ה-<td> למטה) שרוחבו הכולל בפועל (~39px+
                  ריפוד) חורג מ-28px; table-layout ברירת המחדל (auto, לא נקבע
                  fixed) היה מרחיב את העמודה ממילא לפי תוכן-הגוף - עדכון הרוחב
                  המוצהר כאן רק הופך את זה למפורש/צפוי במקום מרומז. */}
              <th style={{ padding: '4px 2px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '46px', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('views')} title={isHebrew ? 'מיון לפי צפיות' : 'Sort by views'} aria-label={isHebrew ? 'צפיות' : 'Views'}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}><Eye size={12} color={NEON.textSecondary} />{quoteSortField === 'views' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              {/* חוק ברזל (Desktop Final Layout Pass - Owner requirement): אייקון
                  ה-# הדקורטיבי הוסר (הטקסט המקומי כבר מזהה את העמודה); הכותרת
                  ממורכזת עכשיו מעל הטור (לא צמודה לקצה); הרוחב הוגדר במפורש
                  צר (72px) כי ערכי מספר-הזמנה עצמם (למשל A100732) קצרים -
                  הכותרת המילולית עצמה עשויה להיעטף לשתי שורות, זה תקין; מה
                  שאסור להיעטף הוא הערך עצמו בשורה (formatQuoteFallback). */}
              <th style={{ padding: '4px 4px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '72px', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('id')}>
                {isHebrew ? 'מספר הזמנה' : '# Order'} {quoteSortField === 'id' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('client')}>
                {isHebrew ? 'שם לקוח' : 'Client Name'} {quoteSortField === 'client' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {/* חוק ברזל (Desktop Final Layout Pass - Owner requirement,
                  §9 "Description gets the recovered space"): מוטב העיקרי של
                  הרוחב שהתפנה מ-Views/Email/Order/הסרת אייקונים דקורטיביים -
                  minWidth הוגדל מ-130px ל-190px כדי להציג משמעותית יותר טקסט
                  לפני החיתוך (ellipsis) הקיים על תא הגוף (title מלא נשאר
                  ב-hover, לא נוגעים בהתנהגות הקיימת). */}
              <th style={{ padding: '4px 6px', textAlign: 'center', minWidth: '190px', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }}>
                {isHebrew ? 'תיאור' : 'Description'}
              </th>
              <th style={{ padding: '4px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('total')}>
                {isHebrew ? 'הסכום' : 'Amount'} {quoteSortField === 'total' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('date')}>
                {isHebrew ? 'תאריך' : 'Date'} {quoteSortField === 'date' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '4px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }} onClick={() => handleQuoteSort('status')}>
                {isHebrew ? 'סטטוס' : 'Status'} {quoteSortField === 'status' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              {/* חוק ברזל (Desktop Final Layout Pass): עמודת סטטוס שליחת המייל
                  כבר הייתה אייקון-בלבד (Mail) - לא נוסף/הוסר תוכן, רק צומצם
                  מעט הרוחב (36px→28px) ומורכז, בדיוק כמו יתר העמודות הצרות.
                  הסמנטיקה של האדום/ירוק/ריק בגוף הטבלה (renderEmailDot) לא
                  נגעה בה כלל - נשארת זהה. */}
              <th style={{ padding: '4px 2px', textAlign: 'center', width: '28px', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF' }}>
                <Mail size={12} color={NEON.sky} style={{ display: 'inline-block' }} />
              </th>
              {/* חוק ברזל (Owner-Locked Regression Rule task, UI QA - EN Actions
                  Clipping - נשמר, לא רגרסיה): minWidth מפורש עדיין קיים כדי
                  שכפתור "Actions ▼"/"פעולות ▼" יישאר קריא/שמיש במלואו; הערך
                  צומצם מ-110px ל-92px (מספיק לתוכן הכפתור בפועל בשתי השפות,
                  נמדד חי) כחלק מהתאמת הטבלה לרוחב הקנוני החדש - ולא הוסר
                  לגמרי, כדי שלא ליצור את אותה רגרסיה מחדש. עדכון (Desktop
                  Final Layout Pass): רק ה-textAlign שונה למרכוז (לפי דרישת
                  הבעלים למרכז כל כותרות הטבלה) - ה-minWidth עצמו לא נגוע. */}
              <th style={{ padding: '4px 6px', textAlign: 'center', minWidth: '92px', borderTop: '1px solid #E9D5FF', borderBottom: '1px solid #E9D5FF', ...(isHebrew ? { borderLeft: '1px solid #E9D5FF', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' } : { borderRight: '1px solid #E9D5FF', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }) }}>
                {isHebrew ? 'פעולות' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsMeta.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
                  {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
                </td>
              </tr>
            ) : (
              rowsMeta.map(({ quote, isDropdownOpen, isLocked, emailStatus, firstItemDesc, beforeVatAmount, quoteSym, badge }) => (
                // חוק ברזל (Critical Signature Forensic Audit + Final Canonical
                // Width Alignment task, §58 Quote History Desktop Density):
                // ריפוד אנכי לכל תא צומצם מ-6px ל-4px (הכי משמעותי לגובה
                // השורה בפועל - שני צדדים * 2px = 4px פחות גובה לכל שורה),
                // וריפוד אופקי מ-8px ל-6px (תורם גם לצפיפות וגם להתאמת-הרוחב
                // הכוללת של §12/§58). שום מידע לא הוסר - התיאור/סכום-לפני-מע"מ/
                // כל תא נשארו קיימים במלואם, רק פחות "אוויר" סביבם.
                <tr key={quote.id} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                  <td style={{ padding: '4px 4px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ClientTypeBadge clientType={quote.clients?.client_type} isHebrew={isHebrew} />
                    </div>
                  </td>
                  {/* חוק ברזל (Quote History Final Polish task - Views Numeric Geometry
                      Contract): הבעיה שהבעלים דיווח עליה - `justifyContent:'center'`
                      סביב [מספר, אייקון] ממרכז את *הקבוצה* כיחידה, כך שכשספירת
                      הספרות גדלה (0→19→999) רוחב הקבוצה עצמה גדל ומיקום ה-X
                      בפועל של האייקון זז בהתאם, גם אם רוחב העמודה עצמו לא זז.
                      התיקון: תת-תיבת-מספר ברוחב-קבוע (22px, מספיק ל-3 ספרות
                      לפי בדיקה חיה), מיושרת לימין (textAlign:'right' - כוונה,
                      *לא* isHebrew?...: הכיוון הזה אינו תלוי-שפה בכלל, כי סדר
                      הספרות עצמו (9,9,9) תמיד LTR גם בטקסט עברי - עוגן ספרת-
                      האחדות תמיד בקצה הימני של התיבה, כך שספרות חדשות "נדחפות"
                      שמאלה בלבד, בדיוק כמו יישור-מקום-ערכי במסמכים חשבונאיים)
                      עם font-variant-numeric:'tabular-nums' (כל ספרה תופסת
                      רוחב-גליף זהה, כך שעמודות-אחדות/עשרות/מאות מיושרות אנכית
                      בין שורות שונות). האייקון flexShrink:0 בגודל קבוע. כתוצאה
                      מכך רוחב-הקבוצה הכולל קבוע לחלוטין (22+3+14=39px) בלי תלות
                      בערך - textAlign:'center' על ה-td עצמו הופך אז למרכוז
                      עקבי-אמיתי של יחידה קבועה-רוחב, לא של תוכן גדל-וקטן. סדר
                      ה-DOM (מספר ואז אייקון) לא השתנה - dir={tableDir} הקיים
                      כבר על הטבלה ממשיך למרכז/למקם נכון אוטומטית בשתי השפות
                      (ר' PROFLOW_PROJECT_CONTEXT.md, Tabular Numeric Geometry
                      Contract). */}
                  <td style={{ padding: '4px 2px', verticalAlign: 'middle', textAlign: 'center', color: NEON.textMuted, fontSize: '0.8rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ display: 'inline-block', width: '22px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{quote.view_count || 0}</span>
                      <Eye size={14} color={NEON.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
                    </span>
                  </td>
                  {/* חוק ברזל (Final Quote-History Polish task - Order Column
                      Centering): כמו Amount/Actions בסבב הקודם - textAlign:
                      'center' על הכותרת בלבד לא הספיק, כי התוכן בגוף התא
                      היה עדיין צמוד לקצה (offset מדוד ~5.3-6.1px ב-EN בין
                      מרכז הכותרת למרכז ערך מספר-ההזמנה בפועל). מרכוז ה-td
                      עצמו (במקום isHebrew?'right':'left') מיישר את שניהם על
                      אותו מרכז גיאומטרי, בלי לגעת בערך/בלוגיקה של מספר
                      ההזמנה עצמו (formatQuoteFallback, direction/whiteSpace
                      לא נגועים).
                      חוק ברזל (Typography Hierarchy Contract, המשימה הנוכחית):
                      700→600 - הבעלים ביקש שמספר-ההזמנה ישמור על זיהוי דרך
                      הצבע הסגול המאושר בלבד, בלי הדגשה מוגזמת דרך משקל-פונט
                      מקסימלי בנוסף לצבע - שני ערוצי-הדגשה בו-זמנית (צבע+
                      700) היו מיותרים. הצבע/ה-direction/ה-whiteSpace לא נגעו. */}
                  <td style={{ padding: '4px 4px', verticalAlign: 'middle', textAlign: 'center', fontWeight: '600', color: NEON.violet, direction: 'ltr', whiteSpace: 'nowrap' }}>
                    {formatQuoteFallback(quote)}
                  </td>
                  {/* חוק ברזל (Typography Hierarchy Contract): 700→600 - הבעלים
                      דיווח ששם-הלקוח כבד מדי חזותית. "table primary value" -
                      תפקיד עקבי בשתי השפות ובין דסקטופ/מובייל (ר' השורה
                      המקבילה במובייל למטה, אותו שינוי בדיוק).
                      חוק ברזל (Owner Exact Typography Implementation task):
                      600→300 מדויק (לא 400, לא קירוב) - מומש דרך
                      @fontsource-variable/rubik (ציר משקל אמיתי 300-900,
                      ר' src/fonts.css) עם fontFamily מפורש נקודתי - רק
                      התא הזה עובר ל-'Rubik Variable', שאר האתר ממשיך
                      ב-family 'Rubik' הבדיד הקיים ללא שינוי. גודל הפונט/
                      הצבע/הרוחב/ה-ellipsis/ה-title לא נגעו. */}
                  <td className="pf-font-variable" style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quote.clients?.company_name || ''}>
                    {quote.clients?.company_name || 'N/A'}
                  </td>
                  {/* חוק ברזל (Desktop Final Layout Pass, §9): maxWidth הוגדל
                      מ-190px ל-260px כדי לתת ביטוי אמיתי לרוחב שהתפנה (ר'
                      minWidth של הכותרת למעלה) - עדיין חתוך/ellipsis יציב,
                      לא ללא-הגבלה; title מלא ב-hover נשאר ללא שינוי. */}
                  <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: NEON.textSecondary, fontSize: '0.8rem', lineHeight: '1.3', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={firstItemDesc || ''}>
                    {firstItemDesc || '-'}
                  </td>
                  {/* חוק ברזל (Owner Visual Feedback - Amount/Actions Header
                      Centering task): textAlign שונה מ-edge-aligned למרכוז -
                      נמדד חי ש-textAlign:'center' על הכותרת בלבד לא הספיק,
                      כי התוכן בגוף התא היה עדיין צמוד לקצה (offset מדוד
                      ~11.76px בין מרכז הכותרת למרכז הסכום בפועל ב-EN) -
                      מרכוז שני הצדדים (כותרת+גוף) על אותו טור מבטיח יישור
                      גיאומטרי אמיתי, לא רק textAlign זהה.
                      חוק ברזל (Owner Visual QA Correction task - Amount
                      Numeric Place-Value Alignment, מכליל את ה-Numeric
                      Geometry Contract שנוצר עבור Views על Amount): הבעלים
                      זיהה חזותית שמרכוז *כל מחרוזת-הסכום המפורמטת* כיחידה
                      (למשל "$10.00" מול "$5,625.00") גורם לספרת-האגורות
                      לנוע שמאלה/ימינה לפי אורך המחרוזת הכולל - בדיוק אותה
                      משפחת-באג שכבר תוקנה ב-Views (מרכוז קבוצה גדלה-וקטנה
                      במקום עוגן קבוע). התיקון זהה בעיקרון: div פנימי ברוחב-
                      קבוע (92px, נבדק חי עד $99,999.00) וממוין-ימין (עוגן
                      ספרת-האגורות/היחידות בקצה הימני, קבוע לחלוטין - "ימין"
                      בכוונה ולא isHebrew?..., כי סדר הספרות עצמו תמיד LTR
                      גם בטקסט עברי, בדיוק כמו Views/Order למעלה), עם
                      pf-money (tabular-nums+direction:ltr כבר קיים ב-
                      index.css) שדואג שכל ספרה תופסת רוחב-גליף זהה - כך
                      שאחדות מתחת לאחדות, עשרות מתחת לעשרות וכו' לאורך כל
                      העמודה. מרכוז ה-div הפנימי (רוחב-קבוע) בתוך ה-td עצמו
                      (textAlign:'center' לא נגע) שומר גם על "מרכז-כותרת ≈
                      מרכז-גוף" (§79) כי רוחב-הקבוצה עכשיו קבוע לחלוטין ולא
                      תלוי-תוכן - שתי הדרישות (place-value + header-body
                      centering) מתקיימות בו-זמנית, לא מתחרות. סמל המטבע
                      (quoteSym) לא טופל בנפרד - הוא חלק מאותה מחרוזת ממוינת-
                      ימין, וגדילת ספרות "דוחפת" אותו שמאלה בלבד, בדיוק כמו
                      שהפסיק-אלפים/הסימן עצמו לא אמורים להזיז את עוגן-
                      היחידות. */}
                  {/* חוק ברזל (Final Quote-History Polish task - HE-Only
                      Before-VAT Density): הבעלים ביקש שהשורה השנייה הקבועה
                      "לפני מע"מ: ₪X" (שצרכה גובה-שורה קבוע בכל הצעה של עסק
                      ישראלי) תיעלם מהתצוגה הגלויה - הערך עצמו (beforeVatAmount,
                      חושב למעלה, לא נגוע) זמין עכשיו רק דרך title (hover)
                      על תא הסכום, לא כשורה נוספת גלויה. השומר isLocalIsraeliBusiness
                      && isHebrew זהה לחלוטין לשומר הקודם - לא נוסף/שונה
                      תנאי - כך שזה נשאר בלתי-אפשרי מבנית (fail-closed) עבור
                      International, בדיוק כמו קודם, לא רק "לא ממומש". חוק
                      ברזל קבוע (Market Separation): אין ואסור שיהיה מקבילה
                      ל-International - אין title ל-Before VAT באנגלית, כי
                      אין ל-International בכלל את הסמנטיקה העסקית הזו. */}
                  <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center' }} title={isLocalIsraeliBusiness && isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(beforeVatAmount)}` : undefined}>
                    {/* חוק ברזל (Owner QA Correction task, Row Amount Typography, סבב
                        שני, PRESERVED): 800→600 (משימה קודמת) → 600→500 (משימה קודמת) - Rubik
                        מוטען עם קובץ weight נפרד לכל אחד מ-400/500/600/700/800/900
                        (ר' src/fonts.css) כך ש-500 הוא רינדור אמיתי ומובחן, לא
                        fallback סינתטי. Total Revenue (Dashboard.jsx) 600 - כך
                        שסכום-שורה נשאר קל-יותר-משמעותית מ-Total Revenue, לא שווה לו.
                        אומת מחדש (Quote History Final Polish task, Typography
                        Hierarchy Contract - Part A): הבדיקה כללה גם Amount, אבל
                        המשקל כבר הופחת פעמיים בסבב קודם ומתועד כ-PRESERVED - לא
                        נפתח מחדש כאן, כדי לא לבטל תיקון-בעלים קודם על סמך ניחוש;
                        אם הבעלים רוצה הפחתה נוספת בסבב הבדיקה החזותית הבא, זה
                        שינוי חד-שורתי ידוע וממוקד. */}
                    {/* חוק ברזל (Owner Typography + Amount Geometry Correction task -
                        Amount Header Centering Regression): הבעלים זיהה חזותית
                        שהכותרת "הסכום"/"Amount" נראית לא-ממורכזת מעל האזור
                        המספרי בפועל, למרות שמרכז-התיבה עצמו (92px, נמדד) כן
                        התאים במדויק למרכז-הכותרת (0px offset מדוד). השורש: 92px
                        נבחר עבור מקרה-קיצון אישי (99,999.00$, לא חלק מרשימת
                        הבדיקה של הבעלים) - עבור ערכים טיפוסיים/מציאותיים (למשל
                        ₪84.75, ~50px רוחב-טקסט טבעי) זה השאיר שוליים-ריקים
                        גדולים בצד שמאל התיבה (HE) שהזיזו את הטקסט *הנראה
                        לעין* הרחק ממרכז-הכותרת, גם כש-*תיבת*-ה-92px עצמה
                        ממורכזת נכון. תוקן ל-76px - נמדד חי שמספיק בנוחות לטווח
                        הבדיקה המפורש של הבעלים (עד ₪5,625.00/$5,625.00,
                        ~68-71px רוחב-טקסט טבעי), בלי clipping (אין overflow:
                        hidden על התיבה) גם אם ערך חריג-קיצוני נדיר יחרוג
                        מעט מעבר לרוחב המוצהר - הוא פשוט ימשיך שמאלה, לא
                        ייחתך. זה מצמצם משמעותית את השוליים-הריקים לעומת 92px,
                        כך שמרכז-הטקסט הנראה לעין מתקרב הרבה יותר למרכז-
                        התיבה/הכותרת - האיזון הטוב ביותר האפשרי בין שני
                        האילוצים (place-value + header-centering) כשתוכן
                        משתנה-רוחב מיושר-ימין מטבעו. */}
                    <div style={{ display: 'inline-block', width: '76px', textAlign: 'right', fontWeight: '400', color: NEON.textPrimary, fontSize: '0.9rem' }}>
                      <span className="pf-money">{quoteSym}{formatNum(quote.total)}</span>
                    </div>
                  </td>
                  {/* חוק ברזל (Quote History All-Column Geometry Gate task -
                      Date Column Centering): הבעלים זיהה חזותית שכותרת
                      "תאריך" לא ממורכזת מעל הערכים בפועל - נמדד חי offset
                      של ~1.62px ב-HE (מעל הסף המחמיר של <=1px). אותה
                      משפחת-באג בדיוק כמו Order/Amount/Actions בעבר: הכותרת
                      כבר textAlign:'center', אבל תא-הגוף היה עדיין צמוד-קצה
                      (isHebrew?'right':'left'). בניגוד ל-Amount, תאריכים
                      הם באורך-תווים קבוע בתוך אותה שפה (למשל "30/08/2026")
                      - אין כאן בעיית place-value-גדל-וקטן, כך שמרכוז
                      המחרוזת השלמה (במקום תיבה פנימית ברוחב-קבוע) בטוח
                      ומספיק, בדיוק כמו Order Number. direction:'ltr' לא
                      נגוע - התאריך ממשיך לרנדר בסדר-ספרות LTR נכון גם
                      בתוך שורת RTL. */}
                  <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center', color: NEON.textMuted, fontSize: '0.75rem', direction: 'ltr' }}>
                    {formatDateLocal(quote.created_at, isHebrew, currency)}
                  </td>
                  <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', display: 'inline-block' }}>
                      {badge.text}
                    </span>
                  </td>

                  <td style={{ padding: '4px 2px', verticalAlign: 'middle', textAlign: 'center' }}>
                    {renderEmailDot(quote, emailStatus)}
                  </td>

                  {/* חוק ברזל (Owner Visual Feedback - Amount/Actions Header
                      Centering task): כמו Amount למעלה - נמדד חי offset של
                      ~9.78px בין מרכז הכותרת "Actions"/"פעולות" למרכז הכפתור
                      בפועל (שהיה צמוד לקצה ה-inline-end). מרכוז ה-td עצמו
                      (לא רק הכותרת) מיישר את שניהם על אותו מרכז גיאומטרי,
                      בלי תלות באורך התוכן. handleToggleDropdown מחשב את מיקום
                      התפריט חי מ-getBoundingClientRect של הכפתור בזמן הלחיצה
                      (לא מונח קבוע על קצה העמודה), כך שמרכוז הכפתור לא שובר
                      את מיקום התפריט הנפתח. */}
                  <td style={{ padding: '4px 6px', verticalAlign: 'middle', textAlign: 'center', position: 'relative' }}>
                    <div ref={dropdownRef} style={{ display: 'inline-block', position: 'relative' }}>
                      <button
                        onClick={(e) => handleToggleDropdown(e, quote.id)}
                        style={{
                          background: NEON.gradient,
                          color: 'white',
                          border: 'none',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.7rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          boxShadow: NEON.glowSoft
                        }}
                      >
                        {isHebrew ? 'פעולות ▼' : 'Actions ▼'}
                      </button>
                      {renderActionsMenu(quote, isDropdownOpen, isLocked)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ============ MOBILE: real card layout, not a shrunk table ============ */}
      {/* חוק ברזל (תיקון בעלים מאושר - צפיפות מובייל): הכרטיס הנייד צומצם
          משלוש שורות מוערמות (שם+סטטוס / סכום+תאריך / צפיות+פעולות, ~141px
          מדוד בפועל) לשתי שורות קומפקטיות בלבד (~65px יעד), תוך שמירה על
          כל פרט קיים - שום מידע לא הוסר, רק אורגן מחדש. שורה 2 (מספר הזמנה/
          תאריך/סטטוס + נורית-מייל/פעולות) עדיין ללא תנאי isHebrew על הסדר -
          ה-dir כבר ממקם את הילד הראשון בצד ה"התחלה" הנכון בכל שפה.
          עדכון (Signature Fix + Mobile Cleanup task, §8-11 - דרישת בעלים
          מפורשת): שורה 1 עודכנה בכוונה - סוג לקוח וצפיות עברו לשם, כאשכול
          אחד יחד עם שם הלקוח. Views הוסר משורה 2 (שם היה קודם) - אין שכפול,
          אותו state/quote.view_count, רק מיקום אחד.
          תיקון-בעלים נוסף, כלל קבוע (Mobile-Only HE/EN Directional Mirroring
          Fix): הסדר הסמנטי מ-inline-start הוא תמיד סוג לקוח → צפיות → שם
          לקוח, בשתי השפות (ימין ב-HE, שמאל ב-EN) - לא רצף הפוך בין השפות.
          ר' ההערה המפורטת בהמשך הקומפוננטה (ליד ה-grid עצמו) לרקע המלא
          ולמה גרסה קודמת הפכה את הרצף הסמנטי בטעות.
          תיקון-בעלים חי, אותה משימה (נדחה בפועל ע"י הבעלים אחרי בדיקה
          חזותית חיה): הגרסה הראשונה השתמשה ב-flex+flexWrap - שם-לקוח ארוך
          "דחף" ויכל לגרום לעטיפת שורה שהזיזה את סוג-לקוח/צפיות בין
          כרטיסים שונים, כך שהעמודות לא היו יציבות. תוקן ל-CSS Grid אמיתי
          עם שלושה tracks ברוחב-פיקסלים קבוע ל-Client Type/Views (זהה בכל
          כרטיס, גם כש-Views ריק - שני האלמנטים תמיד מרונדרים, אף פעם לא
          null, בדיוק כדי שמיקום ה-tracks לא ישתנה) ו-1fr לשם-הלקוח, חתוך
          ב-ellipsis בשורה אחת בלבד (לעולם לא עוטף). ר' MOBILE_META_TYPE_COL/
          MOBILE_META_VIEWS_COL למעלה. title= (טולטיפ דפדפן טבעי) על שם-
          הלקוח החתוך - אותו דפוס-נגישות-קיים-בדיוק שכבר בשימוש בעמודת שם-
          הלקוח/תיאור בטבלת הדסקטופ (title על maxWidth+ellipsis), לא הומצא
          מנגנון נגיעה/hover חדש עבור הדרישה הזו. */}
      {isMobileView && (
      <>
      {/* חוק ברזל (Mobile Quote History Sorting, דרישת בעלים נוספת -
          נוספה לתוך ההיקף המאושר של המשימה הזו באמצע ההרצה): הדסקטופ
          מאבד את יכולת המיון בטבלה כשה-layout הרספונסיבי הופך אותה
          לכרטיסי מובייל - זו רגרסיית-יכולת אמיתית (הכלל החדש: "טרנספורמציה
          רספונסיבית חייבת לשמר יכולת פונקציונלית, לא רק תוכן נראה" - ר'
          PROFLOW_PROJECT_CONTEXT.md). הפקד הזה אינו מנוע-מיון נפרד: הוא
          קורא ישירות ל-handleQuoteSort/quoteSortField/quoteSortDirection -
          בדיוק אותם props שה-<th onClick> של הדסקטופ כבר משתמשים בהם -
          כך שה-state, ההתנהגות וה"toggle כיוון בבחירה חוזרת על אותו שדה"
          זהים ב-100% בין דסקטופ למובייל. select לבדו לא יכול "לגלות
          מחדש" אותו value (דפדפנים לא מפעילים change על אותה בחירה) -
          לכן כפתור כיוון (▲/▼) נפרד קורא ל-handleQuoteSort(quoteSortField)
          עם אותו שדה, בדיוק כמו לחיצה חוזרת על כותרת עמודה בדסקטופ. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }} dir={tableDir}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: NEON.textSecondary, flexShrink: 0 }}>
          {isHebrew ? 'מיון:' : 'Sort:'}
        </span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rowsMeta.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
            {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
          </div>
        ) : (
          rowsMeta.map(({ quote, isDropdownOpen, isLocked, emailStatus, quoteSym, badge }) => {
            // שלושת אלה מרונדרים תמיד (אף פעם לא null) - ר' ההערה למעלה,
            // חובה לשם יציבות ה-grid tracks בין כרטיסים.
            const clientTypeEl = (
              <span key="type" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClientTypeBadge clientType={quote.clients?.client_type} isHebrew={isHebrew} />
              </span>
            );
            // חוק ברזל (Owner Visual QA - Mobile Views Column, תיקון נקודתי):
            // 0 צפיות הוא ערך תקף (לא ערך-חסר) - הבעלים דחה מפורשות הסתרה
            // מותנית (`view_count > 0 &&`) שהייתה קודם. עכשיו האייקון+
            // המספר מרונדרים תמיד, כולל 0, באותה מוסכמה חזותית בדיוק. אין
            // שינוי במיקום/רוחב/גיאומטריית ה-grid - רק תוכן הטרק עצמו.
            // חוק ברזל (Quote History Final Polish task - Views Numeric Geometry
            // Contract): אותה בעיה/תיקון בדיוק כמו עמודת הדסקטופ למעלה - תת-
            // תיבת-מספר ברוחב-קבוע (17px, בתוך ה-grid track הקבוע-ורוחב
            // MOBILE_META_VIEWS_COL=32px שכבר קיים), מיושרת-ימין +
            // tabular-nums, אייקון flexShrink:0. רוחב-הקבוצה הכולל (11+2+17=30px)
            // קבוע וללא תלות בערך, בתוך ה-32px השמורים ממילא.
            const viewsEl = (
              <span key="views" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', color: NEON.textMuted, fontSize: '0.7rem' }}>
                <Eye size={11} color={NEON.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ display: 'inline-block', width: '17px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{quote.view_count || 0}</span>
              </span>
            );
            {/* חוק ברזל (Typography Hierarchy Contract): 700→600, אותו תפקיד
                ("table primary value") ואותו שינוי-משקל בדיוק כמו תא שם-הלקוח
                בטבלת הדסקטופ למעלה - HE/EN ודסקטופ/מובייל חייבים היררכיה
                חזותית שקולה, לא רק בתוך אותה תצוגה.
                חוק ברזל (Owner Exact Typography Implementation task): 600→300
                מדויק, אותו fontFamily נקודתי 'Rubik Variable' בדיוק כמו
                הדסקטופ למעלה - עקביות מוחלטת בין דסקטופ/מובייל, לא רק
                בתוך שפה אחת. */}
            const clientNameEl = (
              <span
                key="name"
                className="pf-font-variable"
                style={{ fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, fontSize: '0.85rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                title={quote.clients?.company_name || 'N/A'}
              >
                {quote.clients?.company_name || 'N/A'}
              </span>
            );
            // חוק ברזל (Owner Visual QA Correction task - Amount Numeric
            // Place-Value Alignment): textAlign היה isHebrew?'left':'right'
            // - זה עיגן את *הצד השמאלי* של המחרוזת ב-HE, לא את ספרת-
            // האגורות/היחידות (שתמיד בקצה הימני, כי pf-money כופה
            // direction:'ltr' על סדר הספרות גם בתוך שורה עברית) - כלומר
            // בפועל, גדילת-ספרות ב-HE הייתה מזיזה את עוגן-היחידות ימינה,
            // בדיוק ההפרה שהבעלים אסר. תוקן ל-'right' קבוע (לא תלוי-שפה),
            // בתוך אותו grid track ברוחב-קבוע (MOBILE_META_AMOUNT_COL,
            // לא נגוע) שכבר קיים - עוגן-היחידות עכשיו קבוע בשתי השפות.
            const amountEl = (
              <div key="amount" style={{ fontWeight: '400', color: NEON.textPrimary, fontSize: '0.95rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                <span className="pf-money">{quoteSym}{formatNum(quote.total)}</span>
              </div>
            );
            return (
            <div key={quote.id} style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '8px 10px' }} dir={tableDir}>
              {/* חוק ברזל (Mobile-Only HE/EN Directional Mirroring Fix, תיקון-
                  בעלים - כלל קבוע חדש): הגרסה הקודמת השתמשה בסדר-DOM תלוי-
                  שפה מפורש (isHebrew ? [Type,Views,Name] : [Name,Views,Type])
                  כדי לייצר את מה שנראה כמו "שיקוף" - אבל זה בפועל *הפך את
                  הרצף הסמנטי* בין השפות (HE: Type→Views→Name; EN: Name→
                  Views→Type), לא רק את הכיוון. הבעלים תיקן את העיקרון: שיקוף
                  RTL/LTR אמיתי משמר את סדר-העדיפות הסמנטי (Type ראשון, Views
                  שני, Name שלישי) בשתי השפות כשסופרים מ-inline-start של כל
                  שפה (ימין ב-HE, שמאל ב-EN) - הכיוון משתנה, הסדר הסמנטי לא.
                  התיקון: סדר-DOM *אחיד*, ללא תנאי isHebrew בכלל - בדיוק כמו
                  שורה 2 (מספר הזמנה/תאריך/סטטוס) שכבר משתמשת בדפוס הזה
                  בהצלחה. ה-dir={tableDir} הקיים כבר על הכרטיס עושה את כל
                  עבודת-השיקוף הפיזי לבד: track 1 של ה-grid (Type) יושב תמיד
                  ב-inline-start (ימין ב-RTL, שמאל ב-LTR), track 2 (Views) אחריו,
                  track 3 (Name, 1fr) אחריו, track 4 (Amount) בקצה הנגדי -
                  זהה בדיוק לדפוס ה-flex+dir המקורי שכבר תועד למעלה. הסכום
                  (טרק רביעי, רוחב-פיקסלים קבוע) נשאר כפי שהיה - ר' ההערה
                  ההיסטורית שלו למטה לרקע המלא של אותו תיקון-רוחב. */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `${MOBILE_META_TYPE_COL}px ${MOBILE_META_VIEWS_COL}px 1fr ${MOBILE_META_AMOUNT_COL}px`,
                alignItems: 'center',
                columnGap: '6px'
              }}>
                {clientTypeEl}{viewsEl}{clientNameEl}{amountEl}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', fontSize: '0.7rem', color: NEON.textMuted }}>
                  {/* חוק ברזל (Typography Hierarchy Contract, המשימה הנוכחית):
                      700→600, אותו שינוי בדיוק כמו תא מספר-ההזמנה בדסקטופ -
                      זהות דרך צבע, לא דרך משקל-פונט מקסימלי כפול. */}
                  <span style={{ fontWeight: '600', color: NEON.violet, direction: 'ltr' }}>{formatQuoteFallback(quote)}</span>
                  <span>·</span>
                  <span style={{ direction: 'ltr', whiteSpace: 'nowrap' }}>{formatDateLocal(quote.created_at, isHebrew, currency)}</span>
                  <span>·</span>
                  <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {badge.text}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {renderEmailDot(quote, emailStatus)}
                  <div ref={dropdownRef} style={{ display: 'inline-block', position: 'relative' }}>
                    <button
                      onClick={(e) => handleToggleDropdown(e, quote.id)}
                      style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '4px 10px', borderRadius: '7px', cursor: 'pointer', fontWeight: '600', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: NEON.glowSoft, whiteSpace: 'nowrap' }}
                    >
                      {isHebrew ? 'פעולות ▼' : 'Actions ▼'}
                    </button>
                    {renderActionsMenu(quote, isDropdownOpen, isLocked)}
                  </div>
                </div>
              </div>
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
