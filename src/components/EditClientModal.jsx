// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (EditClientModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React, { useState, useEffect } from 'react';

export default function EditClientModal({ isOpen, onClose, client, onSave, isHebrew }) {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clientType, setClientType] = useState('business');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const defaultDial = isHebrew ? '+972' : '+1';
  const defaultLabel = isHebrew ? 'IL (+972)' : 'US (+1)';
  const [localPhone, setLocalPhone] = useState('');

  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setPhone(`${defaultDial} ${numVal}`);
  };

  useEffect(() => {
    if (client) {
      setCompanyName(client.company_name || '');
      setEmail(client.email || '');
      setClientType(client.client_type || 'business');
      setTaxId(client.tax_id || '');
      setAddress(client.address || '');
      setNotes(client.notes || '');
      setErrorMsg('');

      const rawPhone = client.phone || '';
      if (rawPhone.startsWith(defaultDial)) {
        setLocalPhone(rawPhone.replace(defaultDial, '').trim());
      } else {
        const clean = rawPhone.replace(/^\+\d+/, '').trim();
        setLocalPhone(clean || rawPhone);
      }
    }
  }, [client, defaultDial]);

  if (!isOpen || !client) return null;

  const validateEmail = (emailVal) => {
    if (!emailVal || typeof emailVal !== 'string') return false;
    const cleanEmail = emailVal.trim();
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|co\.il|org|net|edu|gov|io|info|biz|co|me|tv|ws)$/i;
    return re.test(cleanEmail);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (email && email.trim() !== '' && !validateEmail(email)) {
      setErrorMsg(isHebrew ? 'שגיאה: כתובת אימייל אינה תקינה (בדוק סיומת כגון .com או .co.il)' : 'Error: Invalid email address format!');
      return;
    }

    onSave({
      ...client,
      company_name: companyName,
      email: email.trim(),
      phone,
      client_type: clientType,
      tax_id: taxId,
      address,
      notes
    });
    onClose();
  };

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left', position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800' }}>
          {isHebrew ? 'עריכת פרטי לקוח' : 'Edit Client Details'}
        </h3>

        {errorMsg && (
          <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'שם חברה / לקוח' : 'Company / Name'}</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'אימייל' : 'Email'}</label>
              <input type="text" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'טלפון' : 'Phone'}</label>
              <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ background: '#f1f5f9', padding: '8px 10px', fontSize: '0.85rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                  {defaultLabel}
                </div>
                <input 
                  type="text" 
                  value={localPhone} 
                  onChange={(e) => handleLocalPhoneChange(e.target.value)} 
                  placeholder="502345678" 
                  style={{ flex: 1, padding: '8px 10px', border: 'none', outline: 'none', background: 'transparent', direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'סוג לקוח' : 'Client Type'}</label>
              <select value={clientType} onChange={(e) => setClientType(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}>
                <option value="business">{isHebrew ? 'עסקי' : 'Business'}</option>
                <option value="private">{isHebrew ? 'פרטי' : 'Private'}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'ח.פ / ת.ז' : 'Tax ID'}</label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'כתובת' : 'Address'}</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'הערות / הנחיות' : 'Notes'}</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
              {isHebrew ? 'ביטול' : 'Cancel'}
            </button>
            <button type="submit" style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
              {isHebrew ? 'שמור שינויים' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}