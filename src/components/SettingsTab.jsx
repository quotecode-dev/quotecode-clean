import React, { useState, useEffect } from 'react';

// פונקציית עזר לזיהוי קידומת לפי מטבע עסק
const getDialByCurrency = (curr) => {
  if (curr === 'GBP') return { dial: '+44', label: 'GB (+44)' };
  if (curr === 'EUR') return { dial: '+49', label: 'DE (+49)' };
  if (curr === 'CAD') return { dial: '+1', label: 'CA (+1)' };
  if (curr === 'AUD') return { dial: '+61', label: 'AU (+61)' };
  if (curr === 'USD') return { dial: '+1', label: 'US (+1)' };
  return { dial: '+972', label: 'IL (+972)' };
};

export default function SettingsTab({
  t,
  isHebrew,
  handleSaveSettings,
  bizName,
  setBizName,
  bizTaxId,
  setBizTaxId,
  bizEmail,
  setBizEmail,
  bizPhone,
  setBizPhone,
  currency,
  setCurrency,
  isLocalIsraeliBusiness,
  bizAddress,
  setBizAddress,
  bizLogoUrl,
  setBizLogoUrl,
  bizPlan,
  defaultTerms,
  setDefaultTerms,
  isTrialExpired,
  trialDaysLeft,
  setShowPricingModal
}) {
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [logoError, setLogoError] = useState('');

  // אכיפה מוחלטת: אם העסק מקומי בישראל, המטבע חייב להיות תמיד ILS!
  useEffect(() => {
    if (isLocalIsraeliBusiness && currency !== 'ILS') {
      setCurrency('ILS');
    }
  }, [isLocalIsraeliBusiness, currency, setCurrency]);

  // גזירת הקידומת האוטומטית לפי מטבע העסק בפועל
  const currencyPhoneConfig = getDialByCurrency(currency);
  const defaultDial = isLocalIsraeliBusiness ? '+972' : currencyPhoneConfig.dial;
  const defaultLabel = isLocalIsraeliBusiness ? 'IL (+972)' : currencyPhoneConfig.label;

  const [localPhone, setLocalPhone] = useState('');

  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setBizPhone(`${defaultDial} ${numVal}`);
  };

  useEffect(() => {
    if (bizPhone) {
      if (bizPhone.startsWith(defaultDial)) {
        setLocalPhone(bizPhone.replace(defaultDial, '').trim());
      } else {
        const clean = bizPhone.replace(/^\+\d+/, '').trim();
        setLocalPhone(clean || bizPhone);
      }
    } else {
      setLocalPhone('');
    }
  }, [bizPhone, defaultDial]);

  useEffect(() => {
    if (bizAddress) {
      const parts = bizAddress.split('|');
      if (parts.length >= 4) {
        setStreet(parts[0] || '');
        setCity(parts[1] || '');
        setStateProv(parts[2] || '');
        setZipCode(parts[3] || '');
      } else {
        setStreet(bizAddress);
      }
    }
  }, []);

  const handleAddressFieldChange = (newStreet, newCity, newState, newZip) => {
    setStreet(newStreet);
    setCity(newCity);
    setStateProv(newState);
    setZipCode(newZip);
    const combined = `${newStreet}|${newCity}|${newState}|${newZip}`;
    setBizAddress(combined);
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoError('');

    if (file.size > 500 * 1024) {
      setLogoError(isHebrew ? 'הקובץ חורג ממשקל 500KB. אנא בחר קובץ קטן יותר.' : 'File exceeds 500KB. Please choose a smaller file.');
      return;
    }

    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setLogoError(isHebrew ? 'ניתן להעלות קבצי SVG, JPG או PNG בלבד.' : 'Only SVG, JPG or PNG files are allowed.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setBizLogoUrl(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  // מניעת דורסנות מטבע מיותרת לעסקים מקומיים
  useEffect(() => {
    if (!isLocalIsraeliBusiness && (!currency || currency === 'USD')) {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const userLang = navigator.language || '';
        if (timeZone.includes('London') || userLang.includes('en-GB')) {
          setCurrency('GBP');
        } else if (timeZone.includes('Europe') || userLang.includes('de') || userLang.includes('fr')) {
          setCurrency('EUR');
        }
      } catch (e) {}
    }
  }, [isLocalIsraeliBusiness, currency, setCurrency]);

  return (
    <div style={{ background: 'white', padding: '18px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', border: '1px solid #f1f5f9' }}>
      <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '500', marginTop: 0, marginBottom: '16px' }}>
        {isHebrew ? 'הגדרות עסק' : 'Business Settings'}
      </h2>
      <form onSubmit={handleSaveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'שם העסק' : 'Business Name'}</label>
            <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No'}</label>
            <input type="text" value={bizTaxId} onChange={(e) => setBizTaxId(e.target.value)} placeholder="516000000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'אימייל עסק' : 'Business Email'}</label>
            <input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="business@example.com" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'טלפון עסק' : 'Business Phone'}</label>
            <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ background: '#f1f5f9', padding: '7px 10px', fontSize: '0.8rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                {defaultLabel}
              </div>
              <input 
                type="text" 
                value={localPhone} 
                onChange={(e) => handleLocalPhoneChange(e.target.value)} 
                placeholder="500000000" 
                style={{ flex: 1, padding: '7px 8px', border: 'none', outline: 'none', background: 'transparent', direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>
              {isHebrew ? 'מטבע העסק' : 'Business Currency'}
            </label>
            <select 
              value={isLocalIsraeliBusiness ? 'ILS' : currency} 
              onChange={(e) => !isLocalIsraeliBusiness && setCurrency(e.target.value)}
              disabled={isLocalIsraeliBusiness}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: isLocalIsraeliBusiness ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem', fontWeight: '400', color: '#4f46e5' }}
            >
              {isLocalIsraeliBusiness ? (
                <option value="ILS">ILS (₪)</option>
              ) : (
                <>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '500', marginTop: 0, marginBottom: '10px' }}>
            {isHebrew ? 'כתובת העסק' : 'Business Address Details'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: '#64748b', marginBottom: '2px' }}>{isHebrew ? 'רחוב ומספר' : 'Street Address'}</label>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'הזן כתובת רחוב ומספר' : 'e.g. 123 Main St'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: '#64748b', marginBottom: '2px' }}>{isHebrew ? 'עיר' : 'City'}</label>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: '#64748b', marginBottom: '2px' }}>{isHebrew ? 'מדינה / מחוז (State)' : 'State / Province'}</label>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה/אזור' : 'State / Region'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: '#64748b', marginBottom: '2px' }}>{isHebrew ? 'מיקוד (ZIP / Postal)' : 'ZIP / Postal Code'}</label>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder="10001" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>
            {isHebrew ? 'כתובת תמונת לוגו (URL) או העלאת קובץ' : 'Logo Image URL or File Upload'} {bizPlan !== 'pro' && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>(Requires Pro plan)</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="url" 
              value={bizLogoUrl} 
              onChange={(e) => setBizLogoUrl(e.target.value)} 
              placeholder="https://example.com/logo.svg" 
              disabled={bizPlan !== 'pro'} 
              style={{ flex: 1, minWidth: '220px', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: bizPlan !== 'pro' ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem' }} 
            />
            <label style={{ background: bizPlan !== 'pro' ? '#e2e8f0' : '#4f46e5', color: bizPlan !== 'pro' ? '#94a3b8' : 'white', padding: '7px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: bizPlan !== 'pro' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <span>{isHebrew ? 'העלה קובץ' : 'Upload File'}</span>
              <input 
                type="file" 
                accept=".svg,.png,.jpg,.jpeg" 
                onChange={handleLogoFileChange} 
                disabled={bizPlan !== 'pro'} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            {isHebrew ? 'ניתן להעלות קבצים עד משקל של 500KB ואך ורק מסוג של SVG JPG וכו\'' : 'Files up to 500KB only, formats: SVG, JPG, PNG, etc.'}
          </div>
          {logoError && (
            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' }}>
              {logoError}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '400', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'תנאים כלליים ברירת מחדל להצעות חדשות' : 'Default Terms & Conditions for New Quotes'}</label>
          <textarea 
            value={defaultTerms} 
            onChange={(e) => setDefaultTerms(e.target.value)} 
            rows="4"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }} 
          />
        </div>

        <button type="submit" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '400', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
          {isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings'}
        </button>
      </form>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: '500', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          {isHebrew ? 'ניהול מנוי וחבילת שירות' : 'Subscription Management'}
        </h3>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '8px' }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             </div>
             <div>
               <div style={{ fontSize: '0.9rem', fontWeight: '400', color: '#0f172a', textTransform: 'uppercase' }}>{bizPlan} PLAN</div>
               <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                 {isTrialExpired ? (isHebrew ? 'תקופת הניסיון הסתיימה' : 'Trial Expired') : (trialDaysLeft ? (isHebrew ? `נותרו ${trialDaysLeft} ימי ניסיון` : `Trial ends in ${trialDaysLeft} days`) : (isHebrew ? 'מנוי פעיל' : 'Active Subscription'))}
               </div>
             </div>
           </div>
           <div style={{ display: 'flex', gap: '8px' }}>
             <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#4f46e5', color: 'white', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: '400', display: 'flex', alignItems: 'center', gap: '5px' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="m16 14-4-4-4 4"/><path d="M2 22h20"/></svg>
               {isHebrew ? 'שדרוג / שינוי מסלול' : 'Upgrade / Change Plan'}
             </button>
             {bizPlan !== 'free' && (
               <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#fff', color: '#dc2626', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: '400', display: 'flex': alignItems: 'center', gap: '5px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {isHebrew ? 'ביטול מנוי' : 'Cancel Subscription'}
               </button>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}