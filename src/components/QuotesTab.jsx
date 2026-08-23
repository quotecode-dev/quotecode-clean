// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (QuotesTab.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import { formatDateLocal } from '../utils/regionConfig';
import { History, Plus, Download, Hash, Building2, AlignLeft, DollarSign, Calendar, CircleDot, Eye, Mail, Pencil, Copy, MessageCircle, Trash2 } from 'lucide-react';
import { NEON } from '../theme/neonTheme';

export default function QuotesTab({
  quotes,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  quoteSortField,
  quoteSortDirection,
  handleQuoteSort,
  handleCreateNewQuoteClick,
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

  // השפה/מע"מ של קישור ההצעה נגזרים מנתוני ההצעה השמורים (currency/tax_rate)
  // ולא מהגדרת השפה הנוכחית של המשתמש המחובר - כך שקישור להצעה בינלאומית
  // תמיד יפתח כאנגלית/ללא מע"מ, גם אם נוצר ע"י בעל עסק ישראלי, ולהיפך.
  const getQuoteViewLink = (quote) => {
    const isLocalQuote = Number(quote?.tax_rate) > 0 || (quote?.currency || '').toUpperCase() === 'ILS';
    return isLocalQuote
      ? `${window.location.origin}/public-quote/${quote.id}`
      : `${window.location.origin}/en/public-quote/${quote.id}?lang=en`;
  };

  const getQuoteCurrencySymbol = (quoteCurr) => {
    const curr = (quoteCurr || '').toUpperCase();
    if (curr === 'EUR') return '€';
    if (curr === 'GBP') return '£';
    if (curr === 'USD' || curr === '$') return '$';
    if (curr === 'ILS' || curr === '₪') {
      if (!isHebrew) return '$';
      return '₪';
    }
    if (!isHebrew) {
      const curUpper = (currency || '').toUpperCase();
      if (curUpper === 'EUR') return '€';
      if (curUpper === 'GBP') return '£';
      if (curUpper === 'USD') return '$';
      return '$';
    }
    return '₪';
  };

  const getStatusBadge = (st) => {
    switch(st) {
      case 'approved': return { bg: 'rgba(16, 185, 129, 0.15)', color: NEON.emerald, text: isHebrew ? 'אושר' : 'Approved' };
      case 'paid': return { bg: 'rgba(56, 189, 248, 0.15)', color: NEON.sky, text: isHebrew ? 'שולם' : 'Paid' };
      case 'sent': return { bg: 'rgba(251, 191, 36, 0.15)', color: NEON.amber, text: isHebrew ? 'נשלח' : 'Sent' };
      default: return { bg: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, text: isHebrew ? 'טיוטה' : 'Draft' };
    }
  };

  return (
    <div style={{ background: NEON.bgCard, padding: '14px', borderRadius: '14px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.05rem', color: NEON.textPrimary, fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.01em' }}>
            <span style={{ background: 'rgba(139, 92, 246, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '9px', boxShadow: '0 0 16px -4px rgba(139, 92, 246, 0.55)', flexShrink: 0 }}>
              <History size={16} color={NEON.violetLight} strokeWidth={2.3} />
            </span>
            {t.recentHistory}
          </h2>
          <button
            onClick={handleCreateNewQuoteClick}
            style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: NEON.glow }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>{isHebrew ? 'צור הצעת מחיר חדשה' : 'Create New Quote'}</span>
          </button>
          <button
            onClick={handleExportQuotes}
            style={{ background: NEON.emeraldDark, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 10px -2px rgba(16, 185, 129, 0.4)' }}
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
            style={{ flex: '1 1 130px', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: '1 1 90px', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '600', color: NEON.textSecondary }}
          >
            <option value="All">{t.filterStatus}</option>
            <option value="draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
            <option value="sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
            <option value="approved">{isHebrew ? 'אושר' : 'Approved'}</option>
            <option value="paid">{isHebrew ? 'שולם' : 'Paid'}</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '750px' }} dir={tableDir}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('id')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={12} color={NEON.amber} />{isHebrew ? 'מספר הזמנה' : '# Order'} {quoteSortField === 'id' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('client')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} color={NEON.sky} />{isHebrew ? 'שם לקוח' : 'Client Name'} {quoteSortField === 'client' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', minWidth: '200px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlignLeft size={12} color={NEON.textSecondary} />{isHebrew ? 'תיאור' : 'Description'}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('total')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DollarSign size={12} color={NEON.emerald} />{isHebrew ? 'הסכום' : 'Amount'} {quoteSortField === 'total' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('date')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} color={NEON.violetLight} />{isHebrew ? 'תאריך' : 'Date'} {quoteSortField === 'date' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('status')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CircleDot size={12} color={NEON.violetLighter} />{isHebrew ? 'סטטוס' : 'Status'} {quoteSortField === 'status' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '60px' }} onClick={() => handleQuoteSort('views')} title={isHebrew ? 'מיון לפי צפיות' : 'Sort by views'}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Eye size={12} color={NEON.textSecondary} />{isHebrew ? 'צפיות' : 'Views'} {quoteSortField === 'views' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: '50px' }}>
                <Mail size={12} color={NEON.sky} style={{ display: 'inline-block' }} />
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'left' : 'right' }}>
                {isHebrew ? 'פעולות' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.85rem' }}>
                  {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
                </td>
              </tr>
            ) : (
              quotes.map((quote) => {
                const currentStatus = quote.status ? quote.status.toLowerCase() : 'draft';
                const isDropdownOpen = openDropdownId === quote.id;
                const emailStatus = emailStatuses ? emailStatuses[quote.id] : null;

                const firstItemDesc = quote.quote_items && quote.quote_items.length > 0 ? quote.quote_items[0].description : '';
                const rawSubtotal = quote.subtotal || 0;
                const rawDiscount = quote.discount || 0;
                const discBase = rawSubtotal - ((rawSubtotal * rawDiscount) / 100);
                const isBizClient = (quote.client_type || quote.clients?.client_type) === 'business';
                const beforeVatAmount = isBizClient && isHebrew ? discBase : (quote.total / 1.18);

                const quoteSym = getQuoteCurrencySymbol(quote.currency);
                const badge = getStatusBadge(currentStatus);

                return (
                  <tr key={quote.id} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: NEON.violetLight, direction: 'ltr' }}>
                      #{quote.id.slice(0, 6)}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: NEON.textPrimary }}>
                      {quote.clients?.company_name || 'N/A'}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: NEON.textSecondary, fontSize: '0.8rem', lineHeight: '1.3' }}>
                      {firstItemDesc || '-'}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left' }}>
                      <div style={{ fontWeight: '800', color: NEON.textPrimary, fontSize: '0.85rem' }}>
                        {quoteSym}{formatNum(quote.total)}
                      </div>
                      {isLocalIsraeliBusiness && isHebrew && (
                        <div style={{ fontSize: '0.6rem', color: NEON.textMuted, marginTop: '1px' }}>
                          {isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(beforeVatAmount)}` : `Before VAT: ${quoteSym}${formatNum(beforeVatAmount)}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: NEON.textMuted, fontSize: '0.75rem', direction: 'ltr' }}>
                      {formatDateLocal(quote.created_at, isHebrew, currency)}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <span style={{ background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-block' }}>
                        {badge.text}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: 'center', color: NEON.textMuted, fontSize: '0.8rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{quote.view_count || 0}</span>
                        <Eye size={14} color={NEON.textMuted} strokeWidth={2} />
                      </span>
                    </td>

                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
                      {emailStatus && (
                        <span
                          title={emailStatus === 'success' ? (isHebrew ? 'אימייל נשלח בהצלחה' : 'Email sent successfully') : (isHebrew ? 'שליחת האימייל נכשלה' : 'Email failed')}
                          style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: emailStatus === 'success' ? NEON.emeraldDark : NEON.redDark,
                            boxShadow: emailStatus === 'success' ? '0 0 6px rgba(16, 185, 129, 0.6)' : '0 0 6px rgba(239, 68, 68, 0.6)'
                          }}
                        />
                      )}
                    </td>

                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'left' : 'right', position: 'relative' }}>
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

                        {isDropdownOpen && (
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
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                zIndex: 999999,
                                minWidth: '180px',
                                padding: '4px 0',
                                textAlign: isHebrew ? 'right' : 'left'
                              }}
                            >
                              <button
                                onClick={() => { setOpenDropdownId(null); window.open(getQuoteViewLink(quote), '_blank'); }}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.violetLighter, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <Eye size={15} color={NEON.violetLight} strokeWidth={2.2} />
                                <span>{isHebrew ? 'צפה במסמך' : 'View Quote'}</span>
                              </button>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleProtectedAction(quote.id, 'edit', () => handleEditClick(quote));
                                  }}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.amber, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <Pencil size={15} color={NEON.amber} strokeWidth={2.2} />
                                  <span>{isHebrew ? 'ערוך במסמך' : 'Edit Quote'}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'edit' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
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
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <Copy size={15} color={NEON.sky} strokeWidth={2.2} />
                                  <span>{isHebrew ? 'שכפל במסמך' : 'Duplicate Quote'}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'duplicate' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
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
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <MessageCircle size={15} color={NEON.emerald} strokeWidth={2.2} />
                                  <span>{isHebrew ? 'שלח בוואטסאפ' : 'Send WhatsApp'}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'whatsapp' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                    {isHebrew ? '🚀 פונקציה זו (שליחה בוואטסאפ וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (WhatsApp sending & file attachments) is for Pro plan only'}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => { setOpenDropdownId(null); setPendingEmailQuote(quote); }}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.sky, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.06)'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <Mail size={15} color={NEON.sky} strokeWidth={2.2} />
                                <span>{isHebrew ? 'שלח במייל' : 'Send Email'}</span>
                              </button>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleProtectedAction(quote.id, 'delete', () => handleDeleteQuote(quote.id));
                                  }}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: NEON.red, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.12)'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <Trash2 size={15} color={NEON.red} strokeWidth={2.2} />
                                  <span>{isHebrew ? 'מחק מסמך' : 'Delete Quote'}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'delete' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 999999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                    {isHebrew ? '🚀 פונקציה זו (מחיקה וצירוף קבצים) היא למנוי Pro בלבד' : '🚀 This function (Deletion & file attachments) is for Pro plan only'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
