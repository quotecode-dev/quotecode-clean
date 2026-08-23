// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (ClientsTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React, { useState } from 'react';
import { Users, Pencil, Trash2, Building2, Hash, Mail, Phone, MapPin, Tag, StickyNote } from 'lucide-react';
import { NEON } from '../theme/neonTheme';

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
    <div style={{ background: NEON.bgCard, padding: '18px', borderRadius: '14px', border: `1px solid ${NEON.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '1.0rem', color: NEON.textPrimary, fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color={NEON.violetLight} strokeWidth={2.2} />
          {isHebrew ? 'ניהול ספר לקוחות (CRM)' : 'Clients Management'}
        </h2>
      </div>
      <p style={{ color: NEON.textSecondary, marginBottom: '12px', fontSize: '0.8rem' }}>
        {isHebrew ? `סה"כ ${safeClients.length} לקוחות רשומים במערכת` : `${safeClients.length} total clients registered in the system`}
      </p>

      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder={isHebrew ? "חיפוש לקוח לפי שם, אימייל או ח.פ..." : "Search client..."}
          value={clientSearchTerm}
          onChange={(e) => setClientSearchTerm(e.target.value)}
          style={{ padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', width: '220px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
        />
      </div>

      <div style={{ overflowX: 'auto', background: NEON.bgCard, borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '450px' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('company_name')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} color={NEON.sky} />{isHebrew ? 'שם חברה / לקוח' : 'Company / Name'} {clientSortField === 'company_name' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('tax_id')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={12} color={NEON.amber} />{isHebrew ? 'ח.פ / ת.ז' : 'Tax ID'} {clientSortField === 'tax_id' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('email')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Mail size={12} color={NEON.violetLight} />{isHebrew ? 'אימייל' : 'Email'} {clientSortField === 'email' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('phone')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Phone size={12} color={NEON.emerald} />{isHebrew ? 'טלפון' : 'Phone'} {clientSortField === 'phone' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('address')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} color={NEON.red} />{isHebrew ? 'כתובת' : 'Address'} {clientSortField === 'address' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('client_type')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Tag size={12} color={NEON.violetLighter} />{isHebrew ? 'סוג לקוח' : 'Type'} {clientSortField === 'client_type' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleClientSort('notes')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><StickyNote size={12} color={NEON.amber} />{isHebrew ? 'הערות / הנחיות' : 'Notes'} {clientSortField === 'notes' ? (clientSortDirection === 'asc' ? '▲' : '▼') : ''}</span>
              </th>
              <th style={{ padding: '6px' }}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {safeClients.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '25px', color: NEON.textMuted, fontSize: '0.8rem' }}>
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
                    <tr style={{ borderBottom: hasError ? 'none' : `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                      <td style={{ padding: '8px 6px', fontWeight: '500', color: NEON.textPrimary }}>{client.company_name}</td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary }}><span dir="ltr">{client.tax_id || '-'}</span></td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{client.email || '-'}</td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary, direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{client.phone || '-'}</td>
                      <td style={{ padding: '8px 6px', color: NEON.textSecondary }}>{client.address || '-'}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{
                          background: client.client_type === 'business' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)',
                          color: client.client_type === 'business' ? NEON.sky : NEON.textSecondary,
                          padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600'
                        }}>
                          {client.client_type === 'business' ? (isHebrew ? 'עסקי' : 'Business') : (isHebrew ? 'פרטי' : 'Private')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', color: NEON.violetLight, fontWeight: '400' }}>
                        {client.notes ? (
                          <span style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '2px 5px', borderRadius: '4px', fontSize: '0.7rem' }}>
                            {client.notes}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          onClick={() => setEditingClient(client)}
                          style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Pencil size={12} color={NEON.violetLight} strokeWidth={2.5} />
                          {isHebrew ? 'ערוך' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleClientDeleteAttempt(client.id)}
                          title={hasSignedOrApproved ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעה חתומה או מאושרת' : 'Cannot delete client with signed/approved quote') : (clientQuotes.length > 0 ? (isHebrew ? 'לא ניתן למחוק לקוח עם הצעות פעילות' : 'Cannot delete client with active quotes') : '')}
                          style={{
                            background: hasSignedOrApproved ? 'rgba(255,255,255,0.06)' : 'rgba(239, 68, 68, 0.15)',
                            color: hasSignedOrApproved ? NEON.textMuted : NEON.red,
                            border: 'none', padding: '3px 6px', borderRadius: '4px',
                            cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem',
                            display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}
                        >
                          <Trash2 size={12} color={hasSignedOrApproved ? NEON.textMuted : NEON.red} strokeWidth={2.5} />
                          {t.delete}
                        </button>
                      </td>
                    </tr>
                    {hasError && (
                      <tr>
                        <td colSpan="8" style={{ background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid rgba(248, 113, 113, 0.3)', padding: '8px 12px', color: NEON.red, fontSize: '0.8rem', fontWeight: '600', textAlign: isHebrew ? 'right' : 'left' }}>
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
