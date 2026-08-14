import React, { useState, useEffect } from 'react';
import DraggableCalculator from './DraggableCalculator';

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
  currency, setCurrency,
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
  taxRate,
  isTrialExpired,
  isSuperAdmin,
  addItem,
  removeItem,
  handleItemChange,
  handleAddFromCatalog
}) {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');

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

  return (
    <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)', marginBottom: '20px', border: editingQuoteId ? '2px solid #4f46e5' : '1px solid #f1f5f9' }}>
      <DraggableCalculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} isHebrew={isHebrew} currency={currency} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ color: '#1e293b', marginTop: 0, fontSize: '1.1rem', fontWeight: '800', marginBottom: '3px' }}>
            {editingQuoteId ? `${isHebrew ? 'עריכת הצעה #' : 'Editing Quote #'}${editingQuoteId.slice(0, 6)}` : (isHebrew ? 'יצירת הצעת מחיר חדשה' : 'Create New Quote')}
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.8rem' }}>
            {isHebrew ? 'הזן את פרטי ההצעה ושמור את השינויים' : 'Enter the quote details and save changes'}
          </p>
        </div>
        <button 
          type="button" 
          onClick={onCancel}
          style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}
        >
          {isHebrew ? 'ביטול וחזרה לרשימה' : 'Cancel & Return'}
        </button>
      </div>

      <form onSubmit={onSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.clientName}</label>
            <input 
              type="text" 
              value={clientName} 
              onChange={handleClientSelect} 
              list="existing-clients-list"
              placeholder="e.g. Acme Corp" 
              required 
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} 
            />
            <datalist id="existing-clients-list">
              {clients.map(c => <option key={c.id} value={c.company_name} />)}
            </datalist>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'סוג לקוח (חובה)' : 'Client Type'}</label>
            <select 
              value={clientType} 
              onChange={(e) => setClientType(e.target.value)} 
              required 
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', fontSize: '0.85rem' }}
            >
              <option value="" disabled>{isHebrew ? 'בחר סוג לקוח...' : 'Select Client Type...'}</option>
              <option value="business">{isHebrew ? 'עסקי (חברה/עוסק)' : 'Business'}</option>
              <option value="private">{isHebrew ? 'פרטי (B2C)' : 'Private'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.clientEmail}</label>
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.clientPhone}</label>
            <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק / ת.ז' : 'Tax ID / ID'}</label>
            <input type="text" value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} required={clientType === 'business'} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
            {isHebrew ? 'כתובת הלקוח' : 'Client Address Details'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'רחוב ומספר' : 'Street Address'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה / מחוז' : 'State / Province'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder={isHebrew ? 'מיקוד (ZIP)' : 'ZIP / Postal'} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.currency}</label>
            <select 
              value={currency} 
              disabled={true} 
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f1f5f9', boxSizing: 'border-box', fontSize: '0.85rem', fontWeight: 'bold', color: '#4f46e5', cursor: 'not-allowed' }}
            >
              <option value={currency}>{currency} ({sym})</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.status}</label>
            <select value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', fontSize: '0.85rem' }}>
              <option value="Draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
              <option value="Sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
              <option value="Approved">{isHebrew ? 'אושר' : 'Approved'}</option>
              <option value="Paid">{isHebrew ? 'שולם' : 'Paid'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.validUntil}</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{t.discount}</label>
            <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{currency === 'ILS' ? 'תקנון ותנאים' : 'Terms & Conditions'}</label>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows="3" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', textAlign: currency === 'ILS' ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'הערות נוספות' : 'Additional Notes'}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '800', margin: 0 }}>{t.quoteItems}</h3>
            <div style={{ display: 'flex', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => setIsCalcOpen(true)} 
                title={isHebrew ? 'מחשבון' : 'Calculator'}
                style={{ 
                  background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', 
                  border: '1px solid #a5b4fc', 
                  padding: '5px 8px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  color: '#4f46e5', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.15)',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" fill="#ffffff"/>
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <line x1="8" y1="6" x2="16" y2="6"/>
                  <line x1="8" y1="10" x2="10" y2="10"/>
                  <line x1="12" y1="10" x2="14" y2="10"/>
                  <line x1="16" y1="10" x2="16" y2="10"/>
                  <line x1="8" y1="14" x2="10" y2="14"/>
                  <line x1="12" y1="14" x2="14" y2="14"/>
                  <line x1="16" y1="14" x2="16" y2="18"/>
                  <line x1="8" y1="18" x2="10" y2="18"/>
                  <line x1="12" y1="18" x2="14" y2="18"/>
                </svg>
              </button>
              <select onChange={handleCatalogAdd} style={{ padding: '5px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.75rem' }}>
                <option value="">{t.quickAdd}</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} - {sym}{formatNum(s.price)}</option>)}
              </select>
              <button type="button" onClick={addItem} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontWeight: '400', fontSize: '0.75rem' }}>{t.addItem}</button>
            </div>
        </div>

        {/* מעטפת גלילה אופקית מותאמת אישית למובייל */}
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '5px' }}>
          <div style={{ minWidth: '650px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '4px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>
              <span>{t.description}</span>
              <span>{t.quantity}</span>
              <span>{t.unitPrice}</span>
              <span>{t.totalPrice}</span>
              {items.length > 1 && <span></span>}
            </div>

            {items.map((item, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px', background: '#f8fafc', padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <input 
                  type="text" 
                  placeholder={t.description} 
                  value={item.description} 
                  onChange={(e) => !item.isFromCatalog && handleItemChange(index, 'description', e.target.value)} 
                  readOnly={item.isFromCatalog}
                  required 
                  style={{ padding: '7px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem', background: item.isFromCatalog ? '#f1f5f9' : 'white', cursor: item.isFromCatalog ? 'not-allowed' : 'text' }} 
                />
                <input type="number" step="any" placeholder={t.quantity} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required style={{ padding: '7px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem' }} />
                <input type="number" step="any" placeholder={t.unitPrice} value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required style={{ padding: '7px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '0.8rem' }} />
                <div style={{ padding: '7px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '5px', textAlign: isHebrew ? 'left' : 'right', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: isHebrew ? 'flex-start' : 'flex-end' }}>{sym}{formatNum(Number(item.quantity || 0) * Number(item.unit_price || 0))}</div>
                {items.length > 1 && <button type="button" onClick={() => removeItem(index)} style={{ background: '#fee2e2', border: 'none', borderRadius: '5px', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}>✕</button>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '2px solid #f1f5f9', marginTop: '12px', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
            <span>{isLocalIsraeliBusiness && isHebrew && clientType === 'private' ? (isHebrew ? 'סכום ביניים (כולל מע"מ):' : 'Subtotal (Inc. VAT):') : t.subtotal}</span>
            <span>{sym}{formatNum(subtotal)}</span>
          </div>
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}><span>{isHebrew ? `הנחה (${discount}%):` : `Discount (${discount}%):`}</span><span>-{sym}{formatNum(discountAmount)}</span></div>}
          {isLocalIsraeliBusiness && isHebrew && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}><span>{t.vat}</span><span>{sym}{formatNum(taxAmount)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '800', color: '#1e293b', marginTop: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
             <span>{t.totalAmount}</span>
             <span style={{ color: '#4f46e5' }}>{sym}{formatNum(totalAmount)}</span>
          </div>
        </div>

        <button type="submit" disabled={isTrialExpired && !isSuperAdmin} style={{ width: '100%', background: editingQuoteId ? '#10b981' : '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', marginTop: '16px' }}>
           {editingQuoteId ? t.updateQuote : t.generateSave}
        </button>
      </form>
    </div>
  );
}