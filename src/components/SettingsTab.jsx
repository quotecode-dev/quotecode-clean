import { useState, useEffect } from 'react';
import { Settings, Building2, Hash, Mail, Phone, Coins, MapPin, Image as ImageIcon, FileText, Shield, Users, ArrowUpCircle, XCircle } from 'lucide-react';
import { NEON, neonGlowTextStyle } from '../theme/neonTheme';

// פונקציית עזר לזיהוי קידומת לפי מטבע עסק
const getDialByCurrency = (curr, isLocal) => {
  if (isLocal || curr === 'ILS') return { dial: '+972', label: 'IL (+972)' };
  if (curr === 'GBP') return { dial: '+44', label: 'GB (+44)' };
  if (curr === 'EUR') return { dial: '+49', label: 'DE (+49)' };
  if (curr === 'CAD') return { dial: '+1', label: 'CA (+1)' };
  if (curr === 'AUD') return { dial: '+61', label: 'AU (+61)' };
  if (curr === 'USD') return { dial: '+1', label: 'US (+1)' };
  return { dial: '+972', label: 'IL (+972)' };
};

export default function SettingsTab({
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

  // אכיפה מוחלטת: אם העסק מקומי בישראל, המטבע חייב להיות תמיד ILS ברזל
  useEffect(() => {
    if (isLocalIsraeliBusiness && currency !== 'ILS') {
      setCurrency('ILS');
    }
  }, [isLocalIsraeliBusiness, currency, setCurrency]);

  // גזירת הקידומת האוטומטית עם אכיפה מלאה למקומיים
  const effectiveCurr = isLocalIsraeliBusiness ? 'ILS' : currency;
  const currencyPhoneConfig = getDialByCurrency(effectiveCurr, isLocalIsraeliBusiness);
  const defaultDial = currencyPhoneConfig.dial;
  const defaultLabel = currencyPhoneConfig.label;

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
    } else {
      setStreet('');
      setCity('');
      setStateProv('');
      setZipCode('');
    }
  }, [bizAddress]);

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

  return (
    <div style={{ background: NEON.bgCard, padding: '18px', borderRadius: '14px', border: `1px solid ${NEON.border}` }}>
      <h2 style={{ fontSize: '1rem', fontWeight: '800', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
        <Settings size={18} color={NEON.violetLight} strokeWidth={2.2} />
        {isHebrew ? 'הגדרות עסק' : 'Business Settings'}
      </h2>
      <form onSubmit={handleSaveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Building2 size={13} color={NEON.sky} />{isHebrew ? 'שם העסק' : 'Business Name'}</label>
            <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Hash size={13} color={NEON.amber} />{isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No'}</label>
            <input type="text" value={bizTaxId} onChange={(e) => setBizTaxId(e.target.value)} placeholder="516000000" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Mail size={13} color={NEON.violetLight} />{isHebrew ? 'אימייל עסק' : 'Business Email'}</label>
            <input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="business@example.com" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Phone size={13} color={NEON.emerald} />{isHebrew ? 'טלפון עסק' : 'Business Phone'}</label>
            <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '7px 10px', fontSize: '0.8rem', color: NEON.textPrimary, fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: `1px solid ${NEON.borderStrong}`, whiteSpace: 'nowrap' }}>
                {defaultLabel}
              </div>
              <input
                type="text"
                value={localPhone}
                onChange={(e) => handleLocalPhoneChange(e.target.value)}
                placeholder="500000000"
                style={{ flex: 1, padding: '7px 8px', border: 'none', outline: 'none', background: 'transparent', color: NEON.textPrimary, direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}>
              <Coins size={13} color={NEON.amber} />{isHebrew ? 'מטבע העסק' : 'Business Currency'}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLocalIsraeliBusiness}
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: isLocalIsraeliBusiness ? 'rgba(255,255,255,0.04)' : NEON.bgInput, fontSize: '0.85rem', fontWeight: '400', color: NEON.violetLight }}
            >
              {isLocalIsraeliBusiness ? (
                <option value="ILS">ILS (₪)</option>
              ) : (
                <>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.85rem', color: NEON.textSecondary, fontWeight: '500', marginTop: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color={NEON.red} />{isHebrew ? 'כתובת העסק' : 'Business Address Details'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'רחוב ומספר' : 'Street Address'}</label>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'הזן כתובת רחוב ומספר' : 'e.g. 123 Main St'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'עיר' : 'City'}</label>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'מדינה / מחוז (State)' : 'State / Province'}</label>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה/אזור' : 'State / Region'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'מיקוד (ZIP / Postal)' : 'ZIP / Postal Code'}</label>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder="10001" style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}>
            <ImageIcon size={13} color={NEON.violetLight} />{isHebrew ? 'כתובת תמונת לוגו (URL) או העלאת קובץ' : 'Logo Image URL or File Upload'} {bizPlan !== 'pro' && <span style={{ color: NEON.amber, fontSize: '0.7rem' }}>(Requires Pro plan)</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={bizLogoUrl}
              onChange={(e) => setBizLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.svg"
              disabled={bizPlan !== 'pro'}
              style={{ flex: 1, minWidth: '220px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: bizPlan !== 'pro' ? 'rgba(255,255,255,0.03)' : NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
            />
            <label style={{ background: bizPlan !== 'pro' ? 'rgba(255,255,255,0.08)' : NEON.gradient, color: bizPlan !== 'pro' ? NEON.textMuted : 'white', padding: '7px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: bizPlan !== 'pro' ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: bizPlan !== 'pro' ? 'none' : NEON.glowSoft }}>
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
          <div style={{ fontSize: '0.72rem', color: NEON.textMuted, marginTop: '4px' }}>
            {isHebrew ? 'ניתן להעלות קבצים עד משקל של 500KB ואך ורק מסוג של SVG JPG וכו\'' : 'Files up to 500KB only, formats: SVG, JPG, PNG, etc.'}
          </div>
          {logoError && (
            <div style={{ fontSize: '0.75rem', color: NEON.red, marginTop: '3px' }}>
              {logoError}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><FileText size={13} color={NEON.textSecondary} />{isHebrew ? 'תנאים כלליים ברירת מחדל להצעות חדשות' : 'Default Terms & Conditions for New Quotes'}</label>
          <textarea
            value={defaultTerms}
            onChange={(e) => setDefaultTerms(e.target.value)}
            rows="4"
            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }}
          />
        </div>

        <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
          {isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings'}
        </button>
      </form>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${NEON.border}` }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...neonGlowTextStyle }}>
          <Shield size={16} color={NEON.violetLight} strokeWidth={2} />
          {isHebrew ? 'ניהול מנוי וחבילת שירות' : 'Subscription Management'}
        </h3>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: `1px solid ${NEON.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, padding: '8px', borderRadius: '8px', display: 'flex' }}>
               <Users size={20} strokeWidth={2} />
             </div>
             <div>
               <div style={{ fontSize: '0.9rem', fontWeight: '400', color: NEON.textPrimary, textTransform: 'uppercase' }}>{bizPlan} PLAN</div>
               <div style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>
                 {isTrialExpired ? (isHebrew ? 'תקופת הניסיון הסתיימה' : 'Trial Expired') : (trialDaysLeft ? (isHebrew ? `נותרו ${trialDaysLeft} ימי ניסיון` : `Trial ends in ${trialDaysLeft} days`) : (isHebrew ? 'מנוי פעיל' : 'Active Subscription'))}
               </div>
             </div>
           </div>
           <div style={{ display: 'flex', gap: '8px' }}>
             <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: NEON.gradient, color: 'white', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: NEON.glowSoft }}>
               <ArrowUpCircle size={14} strokeWidth={2} />
               {isHebrew ? 'שדרוג / שינוי מסלול' : 'Upgrade / Change Plan'}
             </button>
             {bizPlan !== 'free' && (
               <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: NEON.red, padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(248, 113, 113, 0.35)', cursor: 'pointer', fontWeight: '400', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <XCircle size={14} strokeWidth={2} />
                  {isHebrew ? 'ביטול מנוי' : 'Cancel Subscription'}
               </button>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
