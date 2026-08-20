// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי וסטריקט (QuotesTab.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה.
// ==========================================

import React from 'react';
import { formatDateLocal } from '../utils/regionConfig';

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
  executeEmailSend,
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
  sym,
  formatNum,
  t,
  setPendingEmailQuote,
  emailStatuses,
  currency
}) {
  const tableDir = isHebrew ? 'rtl' : 'ltr';

  // פונקציה חכמה ומדויקת המבטיחה ניתוב לעמוד הציבורי הנכון בהתאם לשפת הממשק (עברית או אנגלית)
  const getQuoteViewLink = (quoteId) => {
    return isHebrew ? `/public-quote/${quoteId}` : `/en/public-quote/${quoteId}`;
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
      case 'approved': return { bg: '#dcfce7', color: '#166534', text: isHebrew ? 'אושר' : 'Approved' };
      case 'paid': return { bg: '#dbeafe', color: '#1e40af', text: isHebrew ? 'שולם' : 'Paid' };
      case 'sent': return { bg: '#fef9c3', color: '#854d0e', text: isHebrew ? 'נשלח' : 'Sent' };
      default: return { bg: '#f1f5f9', color: '#475569', text: isHebrew ? 'טיוטה' : 'Draft' };
    }
  };

  return (
    <div style={{ background: 'white', padding: '14px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '800', margin: 0 }}>{t.recentHistory}</h2>
          <button 
            onClick={handleCreateNewQuoteClick}
            style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>{isHebrew ? 'צור הצעת מחיר חדשה' : 'Create New Quote'}</span>
          </button>
          <button 
            onClick={handleExportQuotes}
            style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>{isHebrew ? 'ייצא לאקסל (CSV)' : 'Export CSV'}</span>
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', width: '100%', maxWidth: '350px' }}>
          <input 
            type="text" 
            placeholder={t.searchQuote} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: '1 1 130px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }}
          />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: '1 1 90px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}
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
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('id')}>
                {isHebrew ? 'מספר הזמנה' : '# Order'} {quoteSortField === 'id' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('client')}>
                {isHebrew ? 'שם לקוח' : 'Client Name'} {quoteSortField === 'client' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', minWidth: '200px' }}>
                {isHebrew ? 'תיאור' : 'Description'}
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('total')}>
                {isHebrew ? 'הסכום' : 'Amount'} {quoteSortField === 'total' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('date')}>
                {isHebrew ? 'תאריך' : 'Date'} {quoteSortField === 'date' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleQuoteSort('status')}>
                {isHebrew ? 'סטטוס' : 'Status'} {quoteSortField === 'status' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '60px' }} onClick={() => handleQuoteSort('views')} title={isHebrew ? 'מיון לפי צפיות' : 'Sort by views'}>
                {isHebrew ? 'צפיות' : 'Views'} {quoteSortField === 'views' ? (quoteSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '8px 6px', textAlign: 'center', width: '50px' }}>
                {isHebrew ? 'מייל' : 'Email'}
              </th>
              <th style={{ padding: '8px 6px', textAlign: isHebrew ? 'left' : 'right' }}>
                {isHebrew ? 'פעולות' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  {isHebrew ? 'לא נמצאו הצעות מחיר במסד הנתונים.' : 'No quotes found in the database.'}
                </td>
              </tr>
            ) : (
              quotes.map((quote) => {
                const currentStatus = quote.status ? quote.status.toLowerCase() : 'draft';
                const isLocked = currentStatus === 'approved' || currentStatus === 'paid' || quote.signature;
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
                  <tr key={quote.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: '#4f46e5', direction: 'ltr' }}>
                      #{quote.id.slice(0, 6)}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', fontWeight: '700', color: '#0f172a' }}>
                      {quote.clients?.company_name || 'N/A'}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: '#334155', fontSize: '0.8rem', lineHeight: '1.3' }}>
                      {firstItemDesc || '-'}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem' }}>
                        {quoteSym}{formatNum(quote.total)}
                      </div>
                      {isLocalIsraeliBusiness && isHebrew && (
                        <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '1px' }}>
                          {isHebrew ? `לפני מע"מ: ${quoteSym}${formatNum(beforeVatAmount)}` : `Before VAT: ${quoteSym}${formatNum(beforeVatAmount)}`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'right' : 'left', color: '#64748b', fontSize: '0.75rem', direction: 'ltr' }}>
                      {formatDateLocal(quote.created_at, isHebrew, currency)}
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: 'center' }}>
                      <span style={{ background: badge.bg, color: badge.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', display: 'inline-block' }}>
                        {badge.text}
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{quote.view_count || 0}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
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
                            background: emailStatus === 'success' ? '#10b981' : '#ef4444',
                            boxShadow: emailStatus === 'success' ? '0 0 4px rgba(16, 185, 129, 0.4)' : '0 0 4px rgba(239, 68, 68, 0.4)'
                          }} 
                        />
                      )}
                    </td>

                    <td style={{ padding: '8px 6px', verticalAlign: 'middle', textAlign: isHebrew ? 'left' : 'right', position: 'relative' }}>
                      <div ref={dropdownRef} style={{ display: 'inline-block', position: 'relative' }}>
                        <button
                          onClick={(e) => handleToggleDropdown(e, quote.id)}
                          style={{
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.7rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            boxShadow: '0 1px 3px rgba(79, 70, 229, 0.2)'
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
                                background: 'white',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                zIndex: 999999,
                                minWidth: '180px',
                                padding: '4px 0',
                                textAlign: isHebrew ? 'right' : 'left'
                              }}
                            >
                              <button
                                onClick={() => { setOpenDropdownId(null); window.open(getQuoteViewLink(quote.id), '_blank'); }}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: '#3730a3', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                <span>{isHebrew ? 'צפה במסמך' : 'View Quote'}</span>
                              </button>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    if (!isLocked) {
                                      setOpenDropdownId(null);
                                      handleProtectedAction(quote.id, 'edit', () => handleEditClick(quote));
                                    }
                                  }}
                                  disabled={isLocked}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: isLocked ? '#94a3b8' : '#d97706', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => { if(!isLocked) e.target.style.background = '#f1f5f9'; }}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  {isLocked ? (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                  ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L19.5 9.5z"/></svg>
                                  )}
                                  <span>{isLocked ? (isHebrew ? 'עריכה נעולה' : 'Locked') : (isHebrew ? 'ערוך במסמך' : 'Edit Quote')}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'edit' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: '#1e293b', color: '#fff', padding: '5px 10px', borderRadius: '5px', fontSize: '0.7rem', whiteSpace: 'nowrap', zIndex: 999999 }}>
                                    {isHebrew ? '🚀 אופציה זו זמינה למנויי Basic ומעלה' : '🚀 Available on Basic plan+'}
                                  </div>
                                )}
                              </div>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleProtectedAction(quote.id, 'duplicate', () => handleDuplicateQuote(quote));
                                  }}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: '#0d9488', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  <span>{isHebrew ? 'שכפל במסמך' : 'Duplicate Quote'}</span>
                                </button>
                              </div>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    if (!isLocked) {
                                      setOpenDropdownId(null);
                                      handleProtectedAction(quote.id, 'whatsapp', () => sendWhatsApp(quote));
                                    }
                                  }}
                                  disabled={isLocked}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                                  <span>{isHebrew ? 'שלח בוואטסאפ' : 'Send WhatsApp'}</span>
                                </button>
                              </div>

                              <button
                                onClick={() => { setOpenDropdownId(null); setPendingEmailQuote(quote); }}
                                style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: 'pointer', fontSize: '0.8rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                <span>{isHebrew ? 'שלח במייל' : 'Send Email'}</span>
                              </button>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    if (!isLocked) {
                                      setOpenDropdownId(null);
                                      handleProtectedAction(quote.id, 'delete', () => handleDeleteQuote(quote.id));
                                    }
                                  }}
                                  disabled={isLocked}
                                  style={{ width: '100%', background: 'none', border: 'none', padding: '7px 12px', textAlign: isHebrew ? 'right' : 'left', cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '0.8rem', color: isLocked ? '#94a3b8' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
                                  onMouseEnter={(e) => { if(!isLocked) e.target.style.background = '#fee2e2'; }}
                                  onMouseLeave={(e) => e.target.style.background = 'none'}
                                >
                                  {isLocked ? (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                  ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                  )}
                                  <span>{isLocked ? (isHebrew ? 'מחיקה נעולה' : 'Locked') : (isHebrew ? 'מחק מסמך' : 'Delete Quote')}</span>
                                </button>
                                {activeTooltip.quoteId === quote.id && activeTooltip.action === 'delete' && (
                                  <div className="feature-lock-tooltip" style={{ position: 'absolute', top: 0, [isHebrew ? 'right' : 'left']: '105%', background: '#1e293b', color: '#fff', padding: '5px 10px', borderRadius: '5px', fontSize: '0.7rem', whiteSpace: 'nowrap', zIndex: 999999 }}>
                                    {isHebrew ? '🚀 אופציה זו זמינה למנויי PRO' : '🚀 Available on PRO plan'}
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