// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (ClientsTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Pencil, Trash2, Hash, Mail, MapPin, StickyNote, ChevronDown, FileText, Search, ArrowUpDown, Check } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import { formatAddress } from '../utils/addressFormat';
import { formatDateLocal } from '../utils/regionConfig';

// חוק ברזל (Consolidated Open UI Corrections task, §Clients Visual
// Correction, Owner mid-task correction): ClientAvatar (מדליון-אות-ראשונה
// + תג-פינה, שהוחלף-אליו רק בסבב הקודם ממש) הוסר לגמרי - "significantly
// increased every closed row's height and reduced scan density," לפי
// הבהרת-הבעלים המפורשת. לא הוחלף באייקון/avatar דקורטיבי אחר כלשהו -
// "The client name is already sufficient identification." סוג-הלקוח
// (עסקי/פרטי, כשקיים) מוצג עכשיו כתג-טקסט קומפקטי בלבד (לא מדליון/
// אייקון), בדיוק הספק המדויק: עסקי/פרטי, Business/Private.
// חוק ברזל (Clients Table Completion task, §5 - row-height reduction):
// padding אנכי צומצם מ-2px ל-1px ו-lineHeight נקבע מפורש ל-1 (היה יורש
// line-height רגיל של ~1.4-1.5, שמוסיף גובה-שורה בלתי-נראה מעל/מתחת
// לטקסט עצמו) - התג עצמו יורד מ-~24px גובה מדוד בפועל ל-~18-19px, בדיוק
// טווח-היעד (18-20px), בלי לצמצם את גודל-הפונט (עדיין קריא). fixed width
// slot (ר' desktop/mobile למטה) מבטיח רוחב-עמודה עקבי בין שורות עסקי/
// פרטי/חסר-סוג - שורה בלי badge כלל (clientType לא-ידוע) עדיין תופסת את
// אותו שטח-רוחב, כך שגובה-השורה הכולל לעולם לא תלוי בקיום/העדר הסוג.
function ClientTypeTextBadge({ clientType, isHebrew }) {
  if (clientType !== 'business' && clientType !== 'private') return null;
  const isBusiness = clientType === 'business';
  const label = isBusiness
    ? (isHebrew ? 'עסקי' : 'Business')
    : (isHebrew ? 'פרטי' : 'Private');
  return (
    <span
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: '999px',
        fontSize: '0.66rem',
        lineHeight: 1,
        fontWeight: '700',
        background: isBusiness ? 'rgba(56, 189, 248, 0.15)' : 'rgba(139, 92, 246, 0.12)',
        color: isBusiness ? NEON.sky : NEON.violetLight,
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </span>
  );
}

// חוק ברזל (Design System Coherence task): תג-סטטוס להצעה האחרונה - אותו
// סולם-צבעים/פורמט בדיוק כמו getStatusBadge הקיים ב-QuotesTab.jsx
// (משוכפל מקומית, לא משותף - אותו עיקרון קיים), כדי שסטטוס "הצעה אחרונה"
// כאן ייראה עקבי עם אותו סטטוס בהיסטוריית ההצעות עצמה.
const getStatusBadge = (st, isHebrew) => {
  switch (st) {
    case 'approved': return { bg: 'rgba(5, 150, 105, 0.12)', color: NEON.emerald, text: isHebrew ? 'אושר' : 'Approved' };
    case 'paid': return { bg: 'rgba(2, 132, 199, 0.12)', color: NEON.sky, text: isHebrew ? 'שולם' : 'Paid' };
    case 'sent': return { bg: 'rgba(180, 83, 9, 0.12)', color: NEON.amber, text: isHebrew ? 'נשלח' : 'Sent' };
    default: return { bg: 'rgba(107, 101, 128, 0.10)', color: NEON.textSecondary, text: isHebrew ? 'טיוטה' : 'Draft' };
  }
};

export default function ClientsTab({
  filteredClients = [],
  clientSearchTerm = '',
  setClientSearchTerm,
  clientSortField,
  clientSortDirection,
  handleClientSort,
  setEditingClient,
  handleDeleteClient,
  onCreateClient,
  quotes = [],
  isHebrew,
  currency
}) {
  const safeClients = Array.isArray(filteredClients) ? filteredClients : [];
  const [clientErrorMsg, setClientErrorMsg] = useState({ clientId: null, text: '' });
  const dir = isHebrew ? 'rtl' : 'ltr';

  // חוק ברזל (Authenticated UI Coherence task, Clients Redesign, §Clients):
  // אותו hook בדיוק (lazy matchMedia initializer + מאזין change+resize
  // כפול) כמו QuotesTab.jsx - עקביות-מנגנון מלאה, לא רק עקביות-חזותית,
  // בין שני מסכי-האקורדיון היחידים באפליקציה.
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
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

  // חוק ברזל (Authenticated UI Coherence task, Clients Redesign): מודל
  // single-expand (accordion) זהה לזה הקיים כבר ב-Quote History - "רפרנס
  // האינטראקציה המבוסס" שהמשימה מפרשת מפורשות לאמץ.
  const [expandedClientId, setExpandedClientId] = useState(null);
  const toggleExpanded = (clientId) => {
    setExpandedClientId(prev => (prev === clientId ? null : clientId));
  };

  // חוק ברזל (Clients Table Completion task, §4 - Narrow/mobile behavior):
  // "If two full textual headers cannot fit cleanly, use an accessible
  // compact sorting control or menu with separate options" - במובייל
  // (כרטיסים, לא טבלה) לא הייתה עד עכשיו שום בקרת-מיון גלויה כלל (רק
  // חיפוש). תפריט קומפקטי חדש, לא שני כותרות-טור מלאות שלא ייכנסו ברוחב
  // 320-390px - "Sort by Name"/"Sort by Type" בדיוק כמו שהמשימה מציעה,
  // עם אינדיקטור-כיוון גלוי לשדה הפעיל, קורא לאותו handleClientSort בדיוק
  // כמו הדסקטופ (אין נוסחת-מיון שנייה).
  const [mobileSortMenuOpen, setMobileSortMenuOpen] = useState(false);
  const mobileSortMenuRef = useRef(null);
  useEffect(() => {
    if (!mobileSortMenuOpen) return;
    const handleClickOutside = (e) => {
      if (mobileSortMenuRef.current && !mobileSortMenuRef.current.contains(e.target)) {
        setMobileSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileSortMenuOpen]);

  const handleClientDeleteAttempt = (clientId, clientName) => {
    const clientQuotes = quotes.filter(q => q.client_id === clientId);

    const hasSignedOrApprovedQuote = clientQuotes.some(q => {
      const status = (q.status || '').toLowerCase();
      return status === 'approved' || status === 'paid' || status === 'signed' || q.signature;
    });

    if (hasSignedOrApprovedQuote) {
      setClientErrorMsg({
        clientId,
        text: isHebrew
          ? '⚠️ לא ניתן למחוק לקוח עם הצעות מחיר חתומות או מאושרות (הצעות מאושרות נשמרות במערכת לצורכי תיעוד פיננסי ומשפטי).'
          : '⚠️ Cannot delete client with signed or approved quotes. Approved quotes are retained for financial and legal records.'
      });
      setTimeout(() => setClientErrorMsg({ clientId: null, text: '' }), 7000);
      return;
    }

    if (clientQuotes.length > 0) {
      setClientErrorMsg({
        clientId,
        text: isHebrew
          ? '⚠️ לא ניתן למחוק לקוח עם הצעות מחיר פעילות. יש למחוק את הצעות המחיר הפתוחות של הלקוח תחילה.'
          : '⚠️ Cannot delete client with active quotes. Please delete open quotes first.'
      });
      setTimeout(() => setClientErrorMsg({ clientId: null, text: '' }), 7000);
      return;
    }

    setClientErrorMsg({ clientId: null, text: '' });
    handleDeleteClient(clientId, clientName);
  };

  // חוק ברזל (Authenticated UI Coherence task, Clients Redesign): נתוני-
  // סיכום פר-לקוח (כמות הצעות + הצעה אחרונה) מחושבים פעם אחת מ-quotes
  // (הפרופ הקיים כבר, לא נתון חדש) - בדיוק כמו rowsMeta ב-QuotesTab.jsx.
  // "כמות הצעות" ו"הצעה אחרונה" הם "aggregate/summary information already
  // available to the application" - לא שדה-לקוח חדש/מוסק, רק חישוב-נגזר
  // מ-quotes הקיים שכבר מסונן לפי client_id בדיוק כמו handleClientDeleteAttempt
  // למעלה עשה תמיד.
  const rowsMeta = safeClients.map((client) => {
    const clientQuotes = quotes.filter(q => q.client_id === client.id);
    const hasSignedOrApproved = clientQuotes.some(q => {
      const status = (q.status || '').toLowerCase();
      return status === 'approved' || status === 'paid' || status === 'signed' || q.signature;
    });
    const sortedQuotes = [...clientQuotes].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const latestQuote = sortedQuotes[0] || null;
    return { client, clientQuotes, quoteCount: clientQuotes.length, latestQuote, hasSignedOrApproved };
  });

  const renderDetailPanel = (row) => {
    const { client, quoteCount, latestQuote } = row;
    const latestBadge = latestQuote ? getStatusBadge((latestQuote.status || 'draft').toLowerCase(), isHebrew) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem', color: NEON.textSecondary }}>
          {client.email && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', direction: 'ltr' }}>
              <Mail size={13} color={NEON.textMuted} strokeWidth={2} />
              {client.email}
            </span>
          )}
          {client.tax_id && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', direction: 'ltr' }}>
              <Hash size={13} color={NEON.textMuted} strokeWidth={2} />
              {client.tax_id}
            </span>
          )}
          {client.address && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={13} color={NEON.textMuted} strokeWidth={2} />
              {formatAddress(client.address, isHebrew)}
            </span>
          )}
        </div>
        {client.notes && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', color: NEON.textSecondary }}>
            <StickyNote size={14} color={NEON.textMuted} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{client.notes}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.78rem', color: NEON.textSecondary }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <FileText size={13} color={NEON.textMuted} strokeWidth={2} />
            {isHebrew ? `${quoteCount} הצעות מחיר` : `${quoteCount} quote${quoteCount === 1 ? '' : 's'}`}
          </span>
          {latestQuote && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: NEON.textMuted, direction: 'ltr' }}>
                {isHebrew ? 'הצעה אחרונה:' : 'Latest quote:'} {formatDateLocal(latestQuote.created_at, isHebrew, currency)}
              </span>
              {latestBadge && (
                <span style={{ background: latestBadge.bg, color: latestBadge.color, padding: '2px 7px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  {latestBadge.text}
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            onClick={() => setEditingClient(client)}
            style={{ border: 'none', borderRadius: RADIUS.sm, padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', background: 'rgba(124,58,237,0.10)', color: NEON.violet }}
          >
            <Pencil size={14} color={NEON.violet} strokeWidth={2.2} />
            <span>{isHebrew ? 'ערוך' : 'Edit'}</span>
          </button>
          <button
            onClick={() => handleClientDeleteAttempt(client.id, client.company_name)}
            title={row.hasSignedOrApproved ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעה חתומה או מאושרת' : 'Cannot delete client with signed/approved quote') : (row.quoteCount > 0 ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעות פעילות' : 'Cannot delete client with active quotes') : '')}
            style={{
              border: row.hasSignedOrApproved ? `1px solid ${NEON.border}` : 'none',
              borderRadius: RADIUS.sm, padding: '6px 10px',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600',
              display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
              background: row.hasSignedOrApproved ? NEON.bgCardAlt : 'rgba(220,38,38,0.10)',
              color: row.hasSignedOrApproved ? NEON.textMuted : NEON.red,
              opacity: row.hasSignedOrApproved ? 0.55 : 1
            }}
          >
            <Trash2 size={14} color={row.hasSignedOrApproved ? NEON.textMuted : NEON.red} strokeWidth={2.2} />
            {/* חוק ברזל (Authenticated UI Coherence task, Clients Redesign
                - real defect found and fixed during verification): הכפתור
                השתמש קודם ב-t.delete הגלובלי ("מחק הצעה"/"Delete Quote" -
                תווית ספציפית-להצעת-מחיר, לא ללקוח) - תקלה קדם-קיימת (לא
                נגרמה ע"י הסבב הזה, אך נהייתה בולטת יותר בתוך שורת-הפעולות
                המחודשת). תוקן לתווית נקודתית-ללקוח, עקבית עם Edit הסמוך
                (שגם הוא לא משתמש בטקסט גלובלי). */}
            <span>{isHebrew ? 'מחק' : 'Delete'}</span>
          </button>
        </div>
        {clientErrorMsg.clientId === client.id && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: RADIUS.sm, padding: '8px 12px', color: NEON.red, fontSize: '0.78rem', fontWeight: '600' }}>
            {clientErrorMsg.text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: NEON.bgCard, padding: isMobileView ? '8px' : '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      {/* חוק ברזל (Consolidated Open UI Corrections task, §G1 - Clients
          page header): כותרת קצרה+ישירה (לקוחות/Clients, לא עוד "ניהול
          ספר לקוחות (CRM)" הארוך/הטכני-מדי), מספר-תומך בניסוח-משפט מלא
          ("X לקוחות במערכת"/"X clients", לא רק "(X)" בסוגריים), וכפתור-
          פעולה ראשי אחד וברור ("לקוח חדש"/"New Client", סגול - התאמה
          ישירה לעקרון "one clear primary action" של המשימה) שפותח את אותו
          EditClientModal הקיים (isNew=true, ר' Dashboard.jsx) - לא מודל
          מקביל חדש. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
            <Users size={18} color={NEON.violetLight} strokeWidth={2.2} />
            {isHebrew ? 'לקוחות' : 'Clients'}
          </h2>
          <span style={{ fontSize: '0.78rem', fontWeight: '600', color: NEON.textSecondary }}>
            {isHebrew ? `${safeClients.length} לקוחות במערכת` : `${safeClients.length} client${safeClients.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={onCreateClient}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: NEON.gradient, color: 'white', border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', boxShadow: NEON.glowSoft }}
        >
          <UserPlus size={15} strokeWidth={2.4} />
          {isHebrew ? 'לקוח חדש' : 'New Client'}
        </button>
      </div>

      {/* חוק ברזל (§G2): החיפוש עבר לשורה עצמאית משלו מתחת לכותרת (היה
          חולק שורה עם הכותרת) - "wide search below... the shared toolbar,"
          כדי שיקבל רוחב אמיתי, לא שרידי-מקום לצד הכותרת/הכפתור. */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0 }}>
          <Search size={14} color={NEON.textMuted} strokeWidth={2.2} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isHebrew ? 'right' : 'left']: '10px', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={isHebrew ? 'חיפוש לקוח לפי שם, אימייל או ח.פ...' : 'Search clients...'}
            value={clientSearchTerm}
            onChange={(e) => setClientSearchTerm(e.target.value)}
            style={{ width: '100%', padding: isHebrew ? '8px 30px 8px 12px' : '8px 12px 8px 30px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
        </div>
        {/* חוק ברזל (§4 - Narrow/mobile compact sorting control): מוצג רק
            במובייל - בדסקטופ שני כפתורי-המיון בכותרת-הטבלה כבר מספיקים,
            אין צורך בתפריט כפול. */}
        {isMobileView && (
          <div ref={mobileSortMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMobileSortMenuOpen(prev => !prev)}
              aria-haspopup="menu"
              aria-expanded={mobileSortMenuOpen}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '100%', padding: '0 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, background: NEON.bgInput, color: NEON.textPrimary, cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}
            >
              <ArrowUpDown size={14} color={NEON.violet} strokeWidth={2.2} />
              {clientSortField === 'client_type'
                ? (isHebrew ? 'סוג' : 'Type')
                : (isHebrew ? 'שם' : 'Name')}
              {clientSortDirection === 'asc' ? '▲' : '▼'}
            </button>
            {mobileSortMenuOpen && (
              <div role="menu" style={{ position: 'absolute', top: '105%', [isHebrew ? 'left' : 'right']: 0, background: NEON.bgCard, border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxShadow: SHADOW.md, zIndex: 50, minWidth: '150px', overflow: 'hidden' }}>
                {[
                  { field: 'company_name', label: isHebrew ? 'מיין לפי שם' : 'Sort by Name' },
                  { field: 'client_type', label: isHebrew ? 'מיין לפי סוג לקוח' : 'Sort by Client Type' },
                ].map((opt) => {
                  const isActive = clientSortField === opt.field;
                  return (
                    <button
                      key={opt.field}
                      type="button"
                      role="menuitem"
                      onClick={() => { handleClientSort(opt.field); setMobileSortMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', padding: '9px 12px', background: isActive ? NEON.bgCardAlt : 'transparent', border: 'none', color: NEON.textPrimary, cursor: 'pointer', fontSize: '0.78rem', fontWeight: isActive ? '700' : '500', textAlign: isHebrew ? 'right' : 'left' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isActive && <Check size={13} color={NEON.violet} strokeWidth={2.5} />}
                        {opt.label}
                      </span>
                      {isActive && <span style={{ color: NEON.textMuted }}>{clientSortDirection === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* חוק ברזל (Consolidated Open UI Corrections task, §Clients Visual
          Correction): מצב-פוקוس ומצב-הרחבה עוברים ל-CSS class אמיתי במקום
          inline background בלבד - הבעיה שהבעלים דיווח עליה ("thick black
          outline... looks like a stuck browser focus state") היא ה-outline
          המובנה-כברירת-מחדל של הדפדפן על <button>, שנשאר גלוי כל עוד
          הכפתור ממוקד (אחרי לחיצה, לא רק Tab) - מעולם לא הוגדר עליו
          outline מפורש קודם. :focus-visible (לא :focus) מציג מסגרת-פוקוס
          רק כשהפוקוס הגיע בפועל ממקלדת - התנהגות-נגישות תקנית, לא
          "תקוע" אחרי קליק עכבר. .cli-row-expanded (רקע לבנדר בהיר +
          מסגרת עדינה) הוא מצב-הרחבה ויזואלי נפרד, לא קשור לפוקוס כלל. */}
      <style>{`
        .cli-row-btn { outline: none; }
        .cli-row-btn:focus-visible { outline: 2px solid #c4b5fd; outline-offset: -2px; }
        .cli-row-expanded { background: rgba(139,92,246,0.06) !important; border-inline-start: 2px solid #c4b5fd; }
      `}</style>

      {/* ============ DESKTOP: compact accordion rows ============ */}
      {!isMobileView && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* חוק ברזל (Clients Table Completion task, §4 - מיון עצמאי):
              "שם חברה/לקוח" ו"סוג לקוח" היו כפתור-מיון אחד משותף (התג
              הצמוד לשם "נסע" עם מיון-השם בלי בקרה עצמאית משלו) - עכשיו שני
              כפתורים עצמאיים לגמרי, כל אחד עם אינדיקטור-מיון (▲/▼) משלו
              שמוצג *רק* כשהוא השדה הפעיל כרגע (לא "חץ אחד שנראה כאילו שולט
              בשני השדות"). רוחב-עמודת-הסוג (62px) זהה בדיוק לרוחב תא-הסוג
              בכל שורה למטה, כדי שהעמודות יתיישרו אנכית. */}
          <div dir={dir} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: NEON.textSecondary, fontWeight: '700', borderBottom: `2px solid ${NEON.border}` }}>
            <span style={{ width: '20px', flexShrink: 0 }} />
            <button
              type="button"
              onClick={() => handleClientSort('client_type')}
              aria-sort={clientSortField === 'client_type' ? (clientSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              style={{ width: '62px', flexShrink: 0, textAlign: isHebrew ? 'right' : 'left', background: 'none', border: 'none', color: 'inherit', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', padding: 0 }}
            >
              {isHebrew ? 'סוג' : 'Type'} {clientSortField === 'client_type' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
            </button>
            <button
              type="button"
              onClick={() => handleClientSort('company_name')}
              aria-sort={clientSortField === 'company_name' ? (clientSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              style={{ flex: '1 1 220px', minWidth: 0, textAlign: isHebrew ? 'right' : 'left', background: 'none', border: 'none', color: 'inherit', font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', padding: 0 }}
            >
              {isHebrew ? 'שם חברה / לקוח' : 'Company / Name'} {clientSortField === 'company_name' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
            </button>
            <span style={{ width: '140px', flexShrink: 0, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{isHebrew ? 'איש קשר' : 'Contact'}</span>
            <span style={{ width: '70px', flexShrink: 0, textAlign: isHebrew ? 'right' : 'left' }}>{isHebrew ? 'הצעות' : 'Quotes'}</span>
            <span style={{ width: '90px', flexShrink: 0, textAlign: isHebrew ? 'right' : 'left' }}>{isHebrew ? 'פעילות אחרונה' : 'Last activity'}</span>
          </div>
          {rowsMeta.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.8rem' }}>
              {isHebrew ? 'לא נמצאו לקוחות התואמים את החיפוש.' : 'No clients found.'}
            </div>
          ) : (
            rowsMeta.map((row) => {
              const { client, quoteCount, latestQuote } = row;
              const isExpanded = expandedClientId === client.id;
              const detailId = `client-detail-${client.id}`;
              return (
                <div key={client.id} style={{ borderBottom: `1px solid ${NEON.border}` }}>
                  {/* חוק ברזל (Clients Table Completion task, §5 - target row
                      height 38-40px): padding אנכי צומצם מ-13px - נמדד חי
                      פעמיים: ניסיון ראשון (6px) יצא צר מדי (28.5px, מתחת
                      ליעד), תוקן ל-11px שנמדד בפועל בטווח היעד (ר' דוח-
                      אימות). alignItems:'center' על כל הילדים (chevron/
                      badge/שם/איש-קשר/הצעות/פעילות) מיושרים לאותו ציר-מרכז
                      אנכי אחד. לא הוסר min-height/line-height מיושן - מעולם
                      לא היה כזה על השורה הזו (רק ה-padding עצמו קבע את
                      הגובה). נמדד חי ותועד ב-PROFLOW_CODEX_CHECKPOINT.md. */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(client.id)}
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    aria-label={isHebrew ? 'הצג פרטים נוספים' : 'Show more details'}
                    dir={dir}
                    className={`cli-row-btn${isExpanded ? ' cli-row-expanded' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', padding: '11px 10px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left', fontFamily: 'inherit', borderRadius: RADIUS.sm }}
                  >
                    <ChevronDown size={15} strokeWidth={2.4} color={NEON.violet} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    {/* חוק ברזל (Clients Table Completion task, §4 - עמודת-סוג
                        עצמאית): התג עבר מ-span פנימי בתוך עמודת-השם לעמודה
                        קבועת-רוחב (62px, זהה לרוחב כפתור-המיון "סוג" בכותרת
                        למעלה) - עדיין "directly between the chevron and the
                        client name" (§D, לא שונה), אבל עכשיו מיושר אנכית עם
                        כותרת-העמודה שלו. שורה בלי client_type ידוע עדיין
                        תופסת את אותו רוחב-עמודה (span ריק) - גובה-השורה
                        לעולם לא תלוי בקיום/העדר סוג. */}
                    <span style={{ width: '62px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <ClientTypeTextBadge clientType={client.client_type} isHebrew={isHebrew} />
                    </span>
                    <span
                      className="pf-font-variable"
                      style={{ flex: '1 1 220px', minWidth: 0, fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, fontSize: '0.86rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={client.company_name}
                    >
                      {client.company_name}
                    </span>
                    {/* חוק ברזל (§G3 - contact-method fallback): טלפון כשקיים,
                        אחרת אימייל, אף פעם לא שניהם ואף פעם לא עמודה ריקה
                        שמורה כששניהם חסרים. */}
                    <span style={{ width: '140px', flexShrink: 0, fontSize: '0.78rem', lineHeight: 1.2, color: NEON.textSecondary, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.phone || client.email || ''}
                    </span>
                    <span style={{ width: '70px', flexShrink: 0, fontSize: '0.78rem', lineHeight: 1.2, color: NEON.textSecondary, textAlign: isHebrew ? 'right' : 'left' }}>
                      {quoteCount}
                    </span>
                    <span style={{ width: '90px', flexShrink: 0, fontSize: '0.72rem', lineHeight: 1.2, color: NEON.textMuted, textAlign: isHebrew ? 'right' : 'left', direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {latestQuote ? formatDateLocal(latestQuote.created_at, isHebrew, currency) : ''}
                    </span>
                  </button>
                  {/* חוק ברזל (§Clients Visual Correction, real defect found
                      +fixed): הריפוד היה padding:'... 48px' עם left פיזי
                      קשיח - לא כיווני, כך שביוונית-Hebrew הכניסה הייתה
                      מיושרת מהצד הלא-נכון (שמאל, במקום ימין - איפה
                      שהשברון/השם באמת מתחילים תחת RTL). תוקן ל-
                      paddingInlineStart (תכונת-CSS לוגית) - עוקבת אוטומטית
                      אחרי dir, אותו עיקרון בדיוק כמו border-inline-end
                      הקיים כבר ב-Dashboard.jsx. */}
                  {isExpanded && (
                    <div id={detailId} style={{ paddingTop: '4px', paddingInlineEnd: '12px', paddingBottom: '14px', paddingInlineStart: '38px', background: NEON.bgCardAlt }} dir={dir}>
                      {renderDetailPanel(row)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============ MOBILE: compact accordion cards ============ */}
      {isMobileView && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rowsMeta.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
              {isHebrew ? 'לא נמצאו לקוחות התואמים את החיפוש.' : 'No clients found.'}
            </div>
          ) : (
            rowsMeta.map((row) => {
              const { client, quoteCount, latestQuote } = row;
              const isExpanded = expandedClientId === client.id;
              const detailId = `client-detail-mobile-${client.id}`;
              return (
                <div key={client.id} className="client-card" style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', overflow: 'hidden' }} dir={dir}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(client.id)}
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    aria-label={isHebrew ? 'הצג פרטים נוספים' : 'Show more details'}
                    className={`cli-row-btn${isExpanded ? ' cli-row-expanded' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', boxSizing: 'border-box', background: 'none', border: 'none', padding: '10px 10px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left', fontFamily: 'inherit' }}
                  >
                    <ChevronDown size={15} strokeWidth={2.4} color={NEON.violet} style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {/* §D Focused Clients Correction: same badge-before-name
                          reorder as the Desktop row above - the type
                          indicator now sits between the chevron and the
                          name as one balanced group, not after the name. */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <ClientTypeTextBadge clientType={client.client_type} isHebrew={isHebrew} />
                        <span
                          className="pf-font-variable"
                          style={{ fontFamily: "'Rubik Variable', 'Rubik', sans-serif", fontWeight: '500', color: NEON.textPrimary, fontSize: '0.88rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto' }}
                          title={client.company_name}
                        >
                          {client.company_name}
                        </span>
                        <span style={{ fontWeight: '600', color: NEON.textSecondary, fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {isHebrew ? `${quoteCount} הצעות` : `${quoteCount} quote${quoteCount === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      {(client.phone || client.email || latestQuote) && (
                        <div style={{ marginTop: '3px', display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.72rem', color: NEON.textMuted }}>
                          {(client.phone || client.email) && (
                            <span style={{ direction: 'ltr', textAlign: isHebrew ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {client.phone || client.email}
                            </span>
                          )}
                          {latestQuote && (
                            <span style={{ direction: 'ltr', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {formatDateLocal(latestQuote.created_at, isHebrew, currency)}
                            </span>
                          )}
                        </div>
                      )}
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
      )}
    </div>
  );
}
