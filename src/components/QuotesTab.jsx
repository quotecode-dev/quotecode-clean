// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (QuotesTab.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import { useState, useEffect } from 'react';
import { formatDateLocal } from '../utils/regionConfig';
import { History, Download, Hash, Building2, AlignLeft, Banknote, Calendar, CircleDot, Eye, Mail, Pencil, Copy, MessageCircle, Trash2 } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { isQuoteImmutable } from '../utils/quoteLock';

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
  // מוסתרים) וגם בדיקות שמצפות להתאמה יחידה. ברירת מחדל false (דסקטופ)
  // תואמת לסביבת בדיקות ללא matchMedia אמיתי.
  const [isMobileView, setIsMobileView] = useState(false);
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
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 999998, background: 'transparent' }}
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
                  handleProtectedAction(quote.id, 'delete', () => handleDeleteQuote(quote.id, { number: quote.id.slice(0, 6), clientName: quote.clients?.company_name }));
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
    <div style={{ background: NEON.bgCard, padding: '14px', borderRadius: '14px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
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
            style={{ background: NEON.emeraldDark, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px -2px rgba(4, 120, 87, 0.3)' }}
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
      {!isMobileView && (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '750px' }} dir={tableDir}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('id')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={12} color={NEON.amber} />{isHebrew ? 'מספר הזמנה' : '# Order'} {quoteSortField === 'id' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('client')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} color={NEON.sky} />{isHebrew ? 'שם לקוח' : 'Client Name'} {quoteSortField === 'client' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'right' : 'left', minWidth: '200px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlignLeft size={12} color={NEON.textSecondary} />{isHebrew ? 'תיאור' : 'Description'}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('total')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Banknote size={12} color={NEON.emerald} />{isHebrew ? 'הסכום' : 'Amount'} {quoteSortField === 'total' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('date')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} color={NEON.violetLight} />{isHebrew ? 'תאריך' : 'Date'} {quoteSortField === 'date' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('status')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CircleDot size={12} color={NEON.violetLighter} />{isHebrew ? 'סטטוס' : 'Status'} {quoteSortField === 'status' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '60px' }} onClick={() => handleQuoteSort('views')} title={isHebrew ? 'מיון לפי צפיות' : 'Sort by views'}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={12} color={NEON.textSecondary} />{isHebrew ? 'צפיות' : 'Views'} {quoteSortField === 'views' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: '50px' }}>
                <Mail size={12} color={NEON.sky} style={{ display: 'inline-block' }} />
              </th>
              <th style={{ padding: '6px 8px', textAlign: isHebrew ? 'left' : 'right' }}>
                {isHebrew ? 'פעולות' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowsMeta.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
                  {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
                </td>
              </tr>
            ) : (
              rowsMeta.map(({ quote, isDropdownOpen, isLocked, emailStatus, firstItemDesc, beforeVatAmount, quoteSym, badge }) => (
                <tr key={quote.id} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: NEON.violet, direction: 'ltr' }}>
                    #{quote.id.slice(0, 6)}
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: NEON.textPrimary, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quote.clients?.company_name || ''}>
                    {quote.clients?.company_name || 'N/A'}
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: NEON.textSecondary, fontSize: '0.8rem', lineHeight: '1.3', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={firstItemDesc || ''}>
                    {firstItemDesc || '-'}
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left' }}>
                    <div style={{ fontWeight: '800', color: NEON.textPrimary, fontSize: '0.9rem' }}>
                      {quoteSym}{formatNum(quote.total)}
                    </div>
                    {isLocalIsraeliBusiness && isHebrew && (
                      <div style={{ fontSize: '0.6rem', color: NEON.textMuted, marginTop: '1px' }}>
                        {isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(beforeVatAmount)}` : `Before VAT: ${quoteSym}${formatNum(beforeVatAmount)}`}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: NEON.textMuted, fontSize: '0.75rem', direction: 'ltr' }}>
                    {formatDateLocal(quote.created_at, isHebrew, currency)}
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <span style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700', display: 'inline-block' }}>
                      {badge.text}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center', color: NEON.textMuted, fontSize: '0.8rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>{quote.view_count || 0}</span>
                      <Eye size={14} color={NEON.textMuted} strokeWidth={2} />
                    </span>
                  </td>

                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                    {renderEmailDot(quote, emailStatus)}
                  </td>

                  <td style={{ padding: '6px 8px', verticalAlign: 'middle', textAlign: isHebrew ? 'left' : 'right', position: 'relative' }}>
                    <div ref={dropdownRef} style={{ display: 'inline-block', position: 'relative' }}>
                      <button
                        onClick={(e) => handleToggleDropdown(e, quote.id)}
                        style={{
                          background: NEON.gradient,
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
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
          כל פרט קיים - שום מידע לא הוסר, רק אורגן מחדש. שורה 1: שם לקוח
          (מקוצר בקו-חתך אם ארוך, title מלא ב-hover) + סכום. שורה 2: אשכול
          משני (מספר הזמנה · תאריך · תג סטטוס) + אשכול פעולות (צפיות/נורית
          מייל/פעולות). סדר ה-DOM זהה בעברית ובאנגלית בכוונה - ה-dir שכבר
          מוגדר על הכרטיס גורם למיכל ה-flex למקם את הילד הראשון ב-DOM
          בצד ה"התחלה" הטבעי של כל שפה (ימין ב-RTL, שמאל ב-LTR) ואת השני
          בצד הנגדי - כך ששתי השפות מקבלות שיקוף מכוון נכון מאותו קוד,
          בלי תנאי isHebrew על הסדר עצמו. */}
      {isMobileView && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rowsMeta.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
            {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
          </div>
        ) : (
          rowsMeta.map(({ quote, isDropdownOpen, isLocked, emailStatus, quoteSym, badge }) => (
            <div key={quote.id} style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '8px 10px' }} dir={tableDir}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.85rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}
                  title={quote.clients?.company_name || 'N/A'}
                >
                  {quote.clients?.company_name || 'N/A'}
                </div>
                <div style={{ fontWeight: '800', color: NEON.textPrimary, fontSize: '0.95rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {quoteSym}{formatNum(quote.total)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', fontSize: '0.7rem', color: NEON.textMuted }}>
                  <span style={{ fontWeight: '700', color: NEON.violet, direction: 'ltr' }}>#{quote.id.slice(0, 6)}</span>
                  <span>·</span>
                  <span style={{ direction: 'ltr', whiteSpace: 'nowrap' }}>{formatDateLocal(quote.created_at, isHebrew, currency)}</span>
                  <span>·</span>
                  <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {badge.text}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {quote.view_count > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: NEON.textMuted, fontSize: '0.7rem' }}>
                      <Eye size={11} color={NEON.textMuted} strokeWidth={2} />{quote.view_count}
                    </span>
                  )}
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
          ))
        )}
      </div>
      )}
    </div>
  );
}
