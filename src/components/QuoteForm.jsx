import { useState, useEffect, useRef } from 'react';
import DraggableCalculator from './DraggableCalculator';
import { Calculator, Calendar, Paperclip, MapPin, X, AlertTriangle, Rocket } from 'lucide-react';
import { NEON, FONT_HE, neonGlowTextStyle } from '../theme/neonTheme';
import { formatNumberLocal } from '../utils/regionConfig';

const getDialByCurrency = (curr) => {
  if (curr === 'GBP') return { dial: '+44', label: 'GB (+44)' };
  if (curr === 'EUR') return { dial: '+49', label: 'DE (+49)' };
  if (curr === 'CAD') return { dial: '+1', label: 'CA (+1)' };
  if (curr === 'AUD') return { dial: '+61', label: 'AU (+61)' };
  if (curr === 'USD') return { dial: '+1', label: 'US (+1)' };
  return { dial: '+972', label: 'IL (+972)' };
};

export default function QuoteForm({
  editingQuoteId,
  onSave,
  onCancel,
  clientName, setClientName,
  clientEmail, setClientEmail,
  clientPhone, setClientPhone,
  clientType, setClientType,
  clientTaxId, setClientTaxId,
  clientAddress, setClientAddress,
  quoteSubject, setQuoteSubject,
  currency,
  quoteStatus, setQuoteStatus,
  validUntil, setValidUntil,
  discount, setDiscount,
  terms, setTerms,
  notes, setNotes,
  items, setItems,
  services,
  clients,
  isHebrew,
  isLocalIsraeliBusiness,
  t,
  sym,
  formatNum,
  subtotal,
  discountAmount,
  taxAmount,
  totalAmount,
  isTrialExpired,
  isSuperAdmin,
  addItem,
  removeItem,
  handleItemChange,
  userPlan,
  onOpenPricingModal,
  quoteFiles,
  setQuoteFiles,
  allUserAttachments
}) {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const dateInputRef = useRef(null);

  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currencyPhoneConfig = getDialByCurrency(currency);
  const defaultDial = isLocalIsraeliBusiness ? '+972' : currencyPhoneConfig.dial;
  const defaultLabel = isLocalIsraeliBusiness ? 'IL (+972)' : currencyPhoneConfig.label;
  const [localPhone, setLocalPhone] = useState('');

  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setClientPhone(`${defaultDial} ${numVal}`);
  };

  useEffect(() => {
    if (clientPhone) {
      if (clientPhone.startsWith(defaultDial)) {
        setLocalPhone(clientPhone.replace(defaultDial, '').trim());
      } else {
        const clean = clientPhone.replace(/^\+\d+/, '').trim();
        setLocalPhone(clean || clientPhone);
      }
    } else {
      setLocalPhone('');
    }
  }, [clientPhone, defaultDial]);

  const handleAddressFieldChange = (newStreet, newCity, newState, newZip) => {
    setStreet(newStreet);
    setCity(newCity);
    setStateProv(newState);
    setZipCode(newZip);
    const combined = `${newStreet}|${newCity}|${newState}|${newZip}`;
    setClientAddress(combined);
  };

  useEffect(() => {
    if (clientAddress) {
      const parts = clientAddress.split('|');
      if (parts.length >= 4) {
        setStreet(parts[0] || '');
        setCity(parts[1] || '');
        setStateProv(parts[2] || '');
        setZipCode(parts[3] || '');
      } else {
        setStreet(clientAddress);
        setCity('');
        setStateProv('');
        setZipCode('');
      }
    } else {
      setStreet('');
      setCity('');
      setStateProv('');
      setZipCode('');
    }
  }, [clientAddress]);

  const handleClientSelect = (e) => {
    const val = e.target.value;
    setClientName(val);
    const found = clients.find(c => c.company_name?.toLowerCase() === val.toLowerCase());
    if (found) {
      setClientEmail(found.email || '');
      setClientPhone(found.phone || '');
      setClientType(found.client_type || '');
      setClientTaxId(found.tax_id || '');
      setClientAddress(found.address || '');
    }
  };

  const handleCatalogAdd = (e) => {
    const sId = e.target.value;
    if (!sId) return;
    const svc = services.find(s => s.id.toString() === sId);
    if (svc) {
      if (items.length === 1 && items[0].description === '' && items[0].unit_price === '') {
        setItems([{ description: svc.name, quantity: '1', unit_price: svc.price, isFromCatalog: true }]);
      } else {
        setItems([...items, { description: svc.name, quantity: '1', unit_price: svc.price, isFromCatalog: true }]);
      }
    }
    e.target.value = '';
  };

  const handleAttachmentClick = () => {
    const isProOrAdmin = userPlan === 'pro' || isSuperAdmin;
    if (!isProOrAdmin) {
      setShowUpgradeConfirm(true);
    } else {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        const MAX_FILE_SIZE = 3 * 1024 * 1024;

        // חישוב גלובלי של כל הקבצים בענן + קבצי הטיוטה הנוכחיים בטופס
        const existingGlobalBytes = (allUserAttachments || []).reduce((acc, f) => acc + (Number(f.file_size || f.size || 0)), 0);
        const currentDraftBytes = (quoteFiles || []).filter(f => !f.id).reduce((acc, f) => acc + (Number(f.size || f.file_size || 0)), 0);
        const CURRENT_TOTAL_SIZE = existingGlobalBytes + currentDraftBytes;
        const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

        for (let file of files) {
          if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(isHebrew ? `הקובץ "${file.name}" חורג מהגודל המותר לקובץ יחיד (עד 3MB).` : `File "${file.name}" exceeds the 3MB limit for a single file.`);
            return;
          }
          if (CURRENT_TOTAL_SIZE + file.size > MAX_TOTAL_SIZE) {
            setErrorMessage(isHebrew ? `העלאת קובץ זה תעבור את מכסת הנפח הכוללת לעסק (30MB).` : `Uploading this file exceeds the total 30MB capacity limit for your business.`);
            return;
          }
        }
        setErrorMessage('');
        setQuoteFiles(prev => [...(prev || []), ...files]);
      };
      fileInput.click();
    }
  };

  const removeFile = async (index) => {
    const targetFile = (quoteFiles || [])[index];
    if (targetFile && targetFile.id) {
      const { supabase } = await import('../shared/supabase');
      await supabase.from('quote_attachments').delete().eq('id', targetFile.id);
    }
    setQuoteFiles(prev => (prev || []).filter((_, i) => i !== index));
  };

  // חישוב גלובלי אמיתי של הנפח שנותר מתוך 30 מגה לכלל העסק
  const globalAttachmentsBytes = (allUserAttachments || []).reduce((acc, f) => acc + (Number(f.file_size || f.size || 0)), 0);
  const draftAttachmentsBytes = (quoteFiles || []).filter(f => !f.id).reduce((acc, f) => acc + (Number(f.size || f.file_size || 0)), 0);
  const totalGlobalBytes = globalAttachmentsBytes + draftAttachmentsBytes;
  const remainingMb = Math.max(0, (30 - (totalGlobalBytes / (1024 * 1024)))).toFixed(1);

  const isUS = currency === 'USD';
  const dateFormatLabel = isUS ? 'MM-DD-YYYY' : 'DD-MM-YYYY';

  const getDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return isUS ? `${m}-${d}-${y}` : `${d}-${m}-${y}`;
    }
    return dateStr;
  };

  const handleDisplayDateChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);

    if (val.length === 8) {
      const p1 = val.slice(0, 2);
      const p2 = val.slice(2, 4);
      const p3 = val.slice(4, 8);
      if (isUS) {
        setValidUntil(`${p3}-${p1}-${p2}`);
      } else {
        setValidUntil(`${p3}-${p2}-${p1}`);
      }
    } else {
      setValidUntil(e.target.value);
    }
  };

  return (
    <div style={{ background: NEON.bgCard, padding: '16px', borderRadius: '14px', marginBottom: '20px', border: editingQuoteId ? `2px solid ${NEON.violet}` : `1px solid ${NEON.border}`, fontFamily: FONT_HE }}>
      <DraggableCalculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} isHebrew={isHebrew} currency={currency} />

      {/* מודל שדרוג PRO מעוצב */}
      {showUpgradeConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '14px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', ...neonGlowTextStyle }}>
              <Rocket size={18} color={NEON.violetLight} />
              {isHebrew ? 'שדרוג למסלול PRO' : 'Upgrade to PRO Plan'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              {isHebrew
                ? 'אופציה זו הינה למשתמשי מסלול PRO בלבד. האם תרצה לשדרג את חשבונך כעת?'
                : 'This option is for PRO plan users only. Would you like to upgrade your account now?'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeConfirm(false);
                  if (onOpenPricingModal) onOpenPricingModal();
                }}
                style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON.glow }}
              >
                {isHebrew ? 'כן, שדרג עכשיו' : 'Yes, Upgrade Now'}
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeConfirm(false)}
                style={{ background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {isHebrew ? 'לא תודה' : 'No Thanks'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל שגיאות עיצובי נקי במקום alert */}
      {errorMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '14px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: NEON.red, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              {isHebrew ? 'שגיאה בהעלאת קובץ' : 'File Upload Error'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON.glow }}
            >
              {isHebrew ? 'אישור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem', fontWeight: '800', marginBottom: '3px', ...neonGlowTextStyle }}>
            {editingQuoteId ? `${isHebrew ? 'עריכת הצעה #' : 'Editing Quote #'}${editingQuoteId.slice(0, 6)}` : (isHebrew ? 'יצירת הצעת מחיר חדשה' : 'Create New Quote')}
          </h2>
          <p style={{ color: NEON.textSecondary, margin: 0, fontSize: '0.8rem' }}>
            {isHebrew ? 'הזן את פרטי ההצעה ושמור את השינויים' : 'Enter the quote details and save changes'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}
        >
          {isHebrew ? 'ביטול וחזרה לרשימה' : 'Cancel & Return'}
        </button>
      </div>

      <form onSubmit={onSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientName}</label>
            <input
              type="text"
              value={clientName}
              onChange={handleClientSelect}
              list="existing-clients-list"
              placeholder="e.g. Acme Corp"
              required
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
            />
            <datalist id="existing-clients-list">
              {clients.map(c => <option key={c.id} value={c.company_name} />)}
            </datalist>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'סוג לקוח (חובה)' : 'Client Type'}</label>
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              required={!editingQuoteId}
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.85rem' }}
            >
              <option value="" disabled>{isHebrew ? 'בחר סוג לקוח...' : 'Select Client Type...'}</option>
              <option value="business">{isHebrew ? 'עסקי (חברה/עוסק)' : 'Business'}</option>
              <option value="private">{isHebrew ? 'פרטי (B2C)' : 'Private'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientEmail}</label>
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientPhone}</label>
            <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '7px 10px', fontSize: '0.8rem', color: NEON.textPrimary, fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: `1px solid ${NEON.borderStrong}`, whiteSpace: 'nowrap' }}>
                {defaultLabel}
              </div>
              <input
                type="text"
                value={localPhone}
                onChange={(e) => handleLocalPhoneChange(e.target.value)}
                placeholder="502345678"
                style={{ flex: 1, padding: '7px 10px', border: 'none', outline: 'none', background: 'transparent', color: NEON.textPrimary, direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק / ת.ז' : 'Tax ID / ID'}</label>
            <input type="text" value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} required={clientType === 'business'} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>
            {isHebrew ? 'נושא ההזמנה / ההצעה' : 'Order / Quote Subject'}
          </label>
          <input
            type="text"
            value={quoteSubject || ''}
            onChange={(e) => setQuoteSubject(e.target.value)}
            placeholder={isHebrew ? 'לדוגמה: אספקת רשתות ואלומניום לפרויקט' : 'e.g. Aluminum & Network Supply'}
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
          />
        </div>

        {/* אזור קבצים מצורפים נקי */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '12px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '700', color: NEON.textSecondary, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <Paperclip size={13} color={NEON.violetLight} />
            {isHebrew ? 'קבצים מצורפים / שרטוטים (PRO בלבד)' : 'Attachments (PRO only)'}
          </label>

          {(userPlan === 'pro' || isSuperAdmin) && (
            <div style={{ fontSize: '0.75rem', color: NEON.textMuted, fontWeight: '600', marginBottom: '8px' }}>
              {isHebrew ? `נשארו לך ${remainingMb} מגה להעלאת קבצים` : `Remaining: ${remainingMb}MB`}
            </div>
          )}

          <button
            type="button"
            onClick={handleAttachmentClick}
            style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: '1px solid rgba(167, 139, 250, 0.4)', padding: '6px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', marginBottom: (quoteFiles || []).length > 0 ? '8px' : '0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Paperclip size={13} strokeWidth={2.5} />
            {isHebrew ? 'צרף קובץ (עד 3MB)' : 'Attach File (Max 3MB)'}
          </button>

          {(quoteFiles || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {(quoteFiles || []).map((file, idx) => {
                const displayName = file.name || file.file_name || `File #${idx + 1}`;
                const rawBytes = file.size || file.file_size || 0;
                const displaySize = (rawBytes / (1024 * 1024)).toFixed(2);
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: NEON.bgInput, padding: '4px 8px', borderRadius: '6px', border: `1px solid ${NEON.borderStrong}`, fontSize: '0.8rem' }}>
                    <a href={file.file_url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: NEON.violetLighter, textDecoration: 'underline' }}>
                      {displayName} ({displaySize} MB)
                    </a>
                    <button type="button" onClick={() => removeFile(idx)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center' }}><X size={12} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '8px' }}>
            <MapPin size={13} color={NEON.red} />
            {isHebrew ? 'כתובת הלקוח' : 'Client Address Details'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'רחוב ומספר' : 'Street Address'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה / מחוז' : 'State / Province'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder={isHebrew ? 'מיקוד (ZIP)' : 'ZIP / Postal'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.currency}</label>
            <select
              value={currency}
              disabled={true}
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box', fontSize: '0.85rem', fontWeight: 'bold', color: NEON.violetLight, cursor: 'not-allowed' }}
            >
              <option value={currency}>{currency} ({sym})</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.status}</label>
            <select value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.85rem' }}>
              <option value="Draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
              <option value="Sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
              <option value="Approved">{isHebrew ? 'אושר' : 'Approved'}</option>
              <option value="Paid">{isHebrew ? 'שולם' : 'Paid'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>
              {t.validUntil} <span style={{ color: NEON.violetLight, fontWeight: 'bold' }}>({dateFormatLabel})</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={getDisplayDate(validUntil)}
                onChange={handleDisplayDateChange}
                placeholder={dateFormatLabel}
                style={{ width: '100%', padding: '7px 32px 7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }}
              />
              <input
                type="date"
                ref={dateInputRef}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
                    dateInputRef.current.showPicker();
                  } else if (dateInputRef.current) {
                    dateInputRef.current.click();
                  }
                }}
                style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: NEON.textMuted, padding: 0, display: 'flex', alignItems: 'center' }}
                title="Open calendar"
              >
                <Calendar size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.discount}</label>
            <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{currency === 'ILS' ? 'תקנון ותנאים' : 'Terms & Conditions'}</label>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows="3" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: currency === 'ILS' ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'הערות נוספות' : 'Additional Notes'}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, ...neonGlowTextStyle }}>{t.quoteItems}</h3>
            <div style={{ display: 'flex', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsCalcOpen(true)}
                title={isHebrew ? 'מחשבון' : 'Calculator'}
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: NEON.violetLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Calculator size={16} strokeWidth={2.2} />
              </button>
              <select onChange={handleCatalogAdd} style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${NEON.borderStrong}`, background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.75rem' }}>
                <option value="">{t.quickAdd}</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} - {sym}{formatNum(s.price)}</option>)}
              </select>
              <button type="button" onClick={addItem} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '400', fontSize: '0.75rem' }}>{t.addItem}</button>
            </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '5px' }}>
          <div style={{ minWidth: '650px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '4px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 'bold', color: NEON.textSecondary }}>
              <span>{t.description}</span>
              <span>{t.quantity}</span>
              <span>{t.unitPrice}</span>
              <span>{t.totalPrice}</span>
              {items.length > 1 && <span></span>}
            </div>

            {items.map((item, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '8px', border: `1px solid ${NEON.border}` }}>
                <input
                  type="text"
                  placeholder={t.description}
                  value={item.description}
                  onChange={(e) => !item.isFromCatalog && handleItemChange(index, 'description', e.target.value)}
                  readOnly={item.isFromCatalog}
                  required
                  style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', fontSize: '0.8rem', background: item.isFromCatalog ? 'rgba(255,255,255,0.04)' : NEON.bgInput, color: NEON.textPrimary, cursor: item.isFromCatalog ? 'not-allowed' : 'text' }}
                />
                <input type="number" step="any" placeholder={t.quantity} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                <input type="number" step="any" placeholder={t.unitPrice} value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                <div style={{ padding: '7px', background: NEON.bgInput, border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', color: NEON.textPrimary, textAlign: isHebrew ? 'left' : 'right', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: isHebrew ? 'flex-start' : 'flex-end' }}>{sym}{formatNum(Number(item.quantity || 0) * Number(item.unit_price || 0))}</div>
                {items.length > 1 && <button type="button" onClick={() => removeItem(index)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={3} /></button>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${NEON.border}`, marginTop: '12px', paddingTop: '8px' }}>
          {/* Local Private: אין שורת "סכום ביניים" נפרדת - היא כפולה ל-total
              (שניהם ה-ברוטו שהוזן/ה-total הסופי). מציגים ישירות את פירוט
              החשבונאות הרגיל: סכום לפני מע"מ / מע"מ / סה"כ, בדיוק כמו Business. */}
          {!(isLocalIsraeliBusiness && isHebrew && clientType === 'private') && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: NEON.textSecondary, fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
              <span>{t.subtotal}</span>
              <span>{sym}{formatNum(subtotal)}</span>
            </div>
          )}
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: NEON.red, fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}><span>{isHebrew ? `הנחה (${discount}%):` : `Discount (${discount}%):`}</span><span>-{sym}{formatNum(discountAmount)}</span></div>}
          {isLocalIsraeliBusiness && isHebrew && clientType === 'private' ? (
            // תצוגה חשבונאית רגילה (Private): "סכום לפני מע"מ" / "מע"מ (18%)"
            // - אותם ערכים בדיוק כמו קודם (netAmount=total-taxAmount, taxAmount),
            // רק תוויות/סדר שונים; אין נוסחה חדשה. formatNumberLocal (לא
            // formatNum) כדי לא לאבד אגורות (254.24, לא 254.00).
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: NEON.textSecondary, fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <span>סכום לפני מע"מ:</span>
                <span>{sym}{formatNumberLocal(totalAmount - taxAmount, isHebrew)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: NEON.textSecondary, fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <span>מע"מ (18%):</span>
                <span>{sym}{formatNumberLocal(taxAmount, isHebrew)}</span>
              </div>
            </>
          ) : (
            isLocalIsraeliBusiness && isHebrew && <div style={{ display: 'flex', justifyContent: 'space-between', color: NEON.textSecondary, fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}><span>{t.vat}</span><span>{sym}{formatNum(taxAmount)}</span></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '800', marginTop: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
             <span style={{ ...neonGlowTextStyle }}>{t.totalAmount}</span>
             <span style={{ color: NEON.violetLight }}>{sym}{formatNum(totalAmount)}</span>
          </div>
        </div>

        <button type="submit" disabled={isTrialExpired && !isSuperAdmin} style={{ width: '100%', background: editingQuoteId ? NEON.emeraldDark : NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', marginTop: '16px', boxShadow: editingQuoteId ? '0 4px 14px -2px rgba(16, 185, 129, 0.4)' : NEON.glow }}>
           {editingQuoteId ? t.updateQuote : t.generateSave}
        </button>
      </form>
    </div>
  );
}
