// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (EditClientModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState, useEffect } from 'react';
import AiModalHeader from './AiModalHeader';
import { APP, APP_STATUS, SHADOW } from '../theme/neonTheme';

// חוק ברזל (Consolidated Open UI Corrections task, §G1): isNew (חדש) -
// אותו מודל/שדות/ולידציה בדיוק, רק כותרת+תווית-כפתור מתחלפות בין "עריכה"
// ל"יצירה", ו-client (כשקיים) מאפס את הטופס לריק במקום למלא ערכים קיימים.
// onSave עדיין מקבל את כל השדות המלאים בדיוק כמו קודם - Dashboard.jsx
// מחליט אם זו INSERT או UPDATE (handleCreateClient/handleSaveUpdatedClient
// בהתאמה), לא המודל הזה.
export default function EditClientModal({ isOpen, onClose, client, onSave, isHebrew, isNew = false }) {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clientType, setClientType] = useState('business');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  // Owner bug 2026-10-14 (no city for a client): the address is edited as street / city / state / zip and stored in the ONE canonical
  // format "street|city|state|zip" (utils/addressFormat.js, the same as the quote form and the business). A legacy single-field address
  // stays as the street line - never split or rewritten silently.
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const setAddressParts = (nextStreet, nextCity, nextState, nextZip) => {
    setStreet(nextStreet); setCity(nextCity); setStateProv(nextState); setZipCode(nextZip);
    const any = [nextStreet, nextCity, nextState, nextZip].some((v) => String(v || '').trim() !== '');
    setAddress(any ? `${nextStreet}|${nextCity}|${nextState}|${nextZip}` : '');
  };
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
      const rawAddress = client.address || '';
      setAddress(rawAddress);
      if (rawAddress.includes('|')) {
        const parts = rawAddress.split('|');
        setStreet(parts[0] || ''); setCity(parts[1] || ''); setStateProv(parts[2] || ''); setZipCode(parts[3] || '');
      } else {
        setStreet(rawAddress); setCity(''); setStateProv(''); setZipCode('');
      }
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
  }, [client, defaultDial, isNew]);

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
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(24,33,43,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: APP.bgCard, padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '450px', boxShadow: SHADOW.lg, textAlign: isHebrew ? 'right' : 'left', position: 'relative' }}>
        

        {/* §51.16: ONE header row - title · AI action (centred on desktop) · Close */}
        <AiModalHeader titleAs="h3" title={isNew ? (isHebrew ? 'לקוח חדש' : 'New Client') : (isHebrew ? 'עריכת פרטי לקוח' : 'Edit Client Details')}
          onClose={onClose} closeLabel={isHebrew ? 'סגור' : 'Close'} closeContent="✕" isHebrew={isHebrew} testId="ai-help-edit-client" style={{ color: APP.textPrimary, marginBottom: '16px' }} />

        {errorMsg && (
          <div style={{ background: APP_STATUS.error.bg, border: `1px solid ${APP_STATUS.error.border}`, color: APP_STATUS.error.fg, padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'שם חברה / לקוח' : 'Company / Name'}</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'אימייל' : 'Email'}</label>
              <input type="text" value={email} onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'טלפון' : 'Phone'}</label>
              <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', background: 'white', overflow: 'hidden', boxSizing: 'border-box' }}>
                <div style={{ background: APP.bgCardAlt, padding: '8px 10px', fontSize: '0.85rem', color: APP.textPrimary, fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: `1px solid ${APP.borderStrong}`, whiteSpace: 'nowrap' }}>
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
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'סוג לקוח' : 'Client Type'}</label>
              <select value={clientType} onChange={(e) => setClientType(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }}>
                <option value="business">{isHebrew ? 'עסקי' : 'Business'}</option>
                <option value="private">{isHebrew ? 'פרטי' : 'Private'}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'ח.פ / ת.ז' : 'Tax ID'}</label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'כתובת' : 'Address'}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
                <input type="text" data-testid="client-address-street" aria-label={isHebrew ? 'רחוב ומספר' : 'Street address'} placeholder={isHebrew ? 'רחוב ומספר' : 'Street address'} value={street} onChange={(e) => setAddressParts(e.target.value, city, stateProv, zipCode)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
                <input type="text" data-testid="client-address-city" aria-label={isHebrew ? 'עיר' : 'City'} placeholder={isHebrew ? 'עיר' : 'City'} value={city} onChange={(e) => setAddressParts(street, e.target.value, stateProv, zipCode)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
                <input type="text" data-testid="client-address-state" aria-label={isHebrew ? 'מדינה / מחוז' : 'State / Province'} placeholder={isHebrew ? 'מדינה / מחוז' : 'State / Province'} value={stateProv} onChange={(e) => setAddressParts(street, city, e.target.value, zipCode)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
                <input type="text" data-testid="client-address-zip" aria-label={isHebrew ? 'מיקוד' : 'ZIP / Postal'} placeholder={isHebrew ? 'מיקוד' : 'ZIP / Postal'} value={zipCode} onChange={(e) => setAddressParts(street, city, stateProv, e.target.value)} dir="ltr" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: APP.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'הערות / הנחיות' : 'Notes'}</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${APP.borderStrong}`, borderRadius: '6px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
            {/* PRODUCT_TRUTH_DECORATIVE: Cancel button discards the in-progress client create/edit form without saving */}
            <button type="button" onClick={onClose} style={{ flex: 1, background: APP.bgCardAlt, color: APP.textSecondary, border: `1px solid ${APP.borderStrong}`, padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem' }}>
              {isHebrew ? 'ביטול' : 'Cancel'}
            </button>
            {/* PRODUCT_TRUTH_CAPABILITY: clients */}
            <button type="submit" style={{ flex: 1, background: APP.violet, color: APP.textOnAccent, border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', boxShadow: 'none' }}>
              {isNew ? (isHebrew ? 'צור לקוח' : 'Create Client') : (isHebrew ? 'שמור שינויים' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
