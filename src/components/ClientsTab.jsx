import React from 'react';

export default function ClientsTab({
  filteredClients = [],
  clientSearchTerm = '',
  setClientSearchTerm,
  clientSortField,
  clientSortDirection,
  handleClientSort,
  setEditingClient,
  handleDeleteClient,
  quotes = [],
  isHebrew,
  t
}) {
  const safeClients = Array.isArray(filteredClients) ? filteredClients : [];

  const handleClientDeleteAttempt = (clientId) => {
    // בדיקה מחמירה האם ללקוח יש הצעות מחיר כלשהן או הצעות חתומות/מאושרות
    const clientQuotes = quotes.filter(q => q.client_id === clientId);
    
    const hasSignedOrApprovedQuote = clientQuotes.some(q => {
      const status = (q.status || '').toLowerCase();
      return status === 'approved' || status === 'paid' || status === 'signed' || q.signature;
    });

    if (hasSignedOrApprovedQuote) {
      alert(isHebrew ? 'שגיאה חמורה: לא ניתן למחוק לקוח שיש לו הצעה חתומה או מאושרת במערכת!' : 'Error: Cannot delete a client with a signed or approved quote!');
      return;
    }

    if (clientQuotes.length > 0) {
      alert(isHebrew ? 'שגיאה: לא ניתן למחוק לקוח שיש לו הצעות מחיר פעילות במערכת!' : 'Error: Cannot delete a client with existing quotes!');
      return;
    }

    handleDeleteClient(clientId);
  };

  return (
    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '1.0rem', color: '#1e293b', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          {isHebrew ? 'ניהול ספר לקוחות (CRM)' : 'Clients Management'}
        </h2>
      </div>
      <p style={{ color: '#64748b', marginBottom: '12px', fontSize: '0.8rem' }}>
        {isHebrew ? `סה"כ ${safeClients.length} לקוחות רשומים במערכת` : `${safeClients.length} total clients registered in the system`}
      </p>

      <div style={{ marginBottom: '12px' }}>
        <input 
          type="text" 
          placeholder={isHebrew ? "חיפוש לקוח לפי שם, אימייל או ח.פ..." : "Search client..."} 
          value={clientSearchTerm}
          onChange={(e) => setClientSearchTerm(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '220px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: '#f8fafc' }}
        />
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '450px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('company_name')}>
                {isHebrew ? 'שם חברה / לקוח' : 'Company / Name'} {clientSortField === 'company_name' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('tax_id')}>
                {isHebrew ? 'ח.פ / ת.ז' : 'Tax ID'} {clientSortField === 'tax_id' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('email')}>
                {isHebrew ? 'אימייל' : 'Email'} {clientSortField === 'email' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('phone')}>
                {isHebrew ? 'טלפון' : 'Phone'} {clientSortField === 'phone' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('address')}>
                {isHebrew ? 'כתובת' : 'Address'} {clientSortField === 'address' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('client_type')}>
                {isHebrew ? 'סוג לקוח' : 'Type'} {clientSortField === 'client_type' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('notes')}>
                {isHebrew ? 'הערות / הנחיות' : 'Notes'} {clientSortField === 'notes' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th style={{ padding: '6px' }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {safeClients.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: '#94a3b8', fontSize: '0.8rem' }}>
                  {isHebrew ? 'לא נמצאו לקוחות התואמים את החיפוש.' : 'No clients found.'}
                </td>
              </tr>
            ) : (
              safeClients.map((client) => (
                <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem' }}>
                  <td style={{ padding: '8px 6px', fontWeight: '500', color: '#1e293b' }}>{client.company_name}</td>
                  <td style={{ padding: '8px 6px', color: '#475569' }}><span dir="ltr">{client.tax_id || '-'}</span></td>
                  <td style={{ padding: '8px 6px', color: '#475569', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{client.email || '-'}</td>
                  <td style={{ padding: '8px 6px', color: '#475569', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{client.phone || '-'}</td>
                  <td style={{ padding: '8px 6px', color: '#475569' }}>{client.address || '-'}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{
                      background: client.client_type === 'business' ? '#dbeafe' : '#f1f5f9',
                      color: client.client_type === 'business' ? '#1e40af' : '#475569',
                      padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600'
                    }}>
                      {client.client_type === 'business' ? (isHebrew ? 'עסקי' : 'Business') : (isHebrew ? 'פרטי' : 'Private')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 6px', color: '#4f46e5', fontWeight: '400' }}>
                    {client.notes ? (
                      <span style={{ background: '#e0e7ff', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>
                        {client.notes}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button 
                      onClick={() => setEditingClient(client)}
                      style={{ background: '#e0e7ff', color: '#4f46e5', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      {isHebrew ? 'ערוך' : 'Edit'}
                    </button>
                    <button 
                      onClick={() => handleClientDeleteAttempt(client.id)}
                      style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      {t.delete}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}