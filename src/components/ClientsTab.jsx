// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (ClientsTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React, { useState } from 'react';
import { Users, Pencil, Trash2, Building2, Hash, Mail, Phone, MapPin, Tag, StickyNote } from 'lucide-react';

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
  const [clientErrorMsg, setClientErrorMsg] = useState({ clientId: null, text: '' });

  const handleClientDeleteAttempt = (clientId) => {
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
    handleDeleteClient(clientId);
  };

  return (
    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '1.0rem', color: '#1e293b', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#7c3aed" strokeWidth={2.2} />
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} color="#0ea5e9" />{isHebrew ? 'שם חברה / לקוח' : 'Company / Name'} {clientSortField === 'company_name' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('tax_id')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={12} color="#f59e0b" />{isHebrew ? 'ח.פ / ת.ז' : 'Tax ID'} {clientSortField === 'tax_id' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('email')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Mail size={12} color="#4f46e5" />{isHebrew ? 'אימייל' : 'Email'} {clientSortField === 'email' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('phone')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={12} color="#10b981" />{isHebrew ? 'טלפון' : 'Phone'} {clientSortField === 'phone' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('address')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} color="#ef4444" />{isHebrew ? 'כתובת' : 'Address'} {clientSortField === 'address' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('client_type')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Tag size={12} color="#7c3aed" />{isHebrew ? 'סוג לקוח' : 'Type'} {clientSortField === 'client_type' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('notes')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><StickyNote size={12} color="#f59e0b" />{isHebrew ? 'הערות / הנחיות' : 'Notes'} {clientSortField === 'notes' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
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
              safeClients.map((client) => {
                const clientQuotes = quotes.filter(q => q.client_id === client.id);
                const hasSignedOrApproved = clientQuotes.some(q => {
                  const status = (q.status || '').toLowerCase();
                  return status === 'approved' || status === 'paid' || status === 'signed' || q.signature;
                });
                const hasError = clientErrorMsg.clientId === client.id;

                return (
                  <React.Fragment key={client.id}>
                    <tr style={{ borderBottom: hasError ? 'none' : '1px solid #f1f5f9', fontSize: '0.8rem' }}>
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
                          <Pencil size={12} color="#4f46e5" strokeWidth={2.5} />
                          {isHebrew ? 'ערוך' : 'Edit'}
                        </button>
                        <button 
                          onClick={() => handleClientDeleteAttempt(client.id)}
                          title={hasSignedOrApproved ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעה חתומה או מאושרת' : 'Cannot delete client with signed/approved quote') : (clientQuotes.length > 0 ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעות פעילות' : 'Cannot delete client with active quotes') : '')}
                          style={{ 
                            background: hasSignedOrApproved ? '#f1f5f9' : '#fee2e2', 
                            color: hasSignedOrApproved ? '#94a3b8' : '#991b1b', 
                            border: 'none', padding: '3px 6px', borderRadius: '4px', 
                            cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', 
                            display: 'inline-flex', alignItems: 'center', gap: '3px' 
                          }}
                        >
                          <Trash2 size={12} color={hasSignedOrApproved ? '#94a3b8' : '#ef4444'} strokeWidth={2.5} />
                          {t.delete}
                        </button>
                      </td>
                    </tr>
                    {hasError && (
                      <tr>
                        <td colSpan="8" style={{ background: '#fef2f2', borderBottom: '1px solid #f87171', padding: '8px 12px', color: '#991b1b', fontSize: '0.8rem', fontWeight: '600', textAlign: isHebrew ? 'right' : 'left' }}>
                          {clientErrorMsg.text}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}