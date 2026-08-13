import React, { useEffect } from 'react';

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

  // זיהוי מטבע אוטומטי לפי מיקום/אזור אם טרם הוגדר מטבע בינלאומי
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
      <h2 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: '700', marginTop: 0, marginBottom: '16px' }}>
        {isHebrew ? 'הגדרות עסק' : 'Business Settings'}
      </h2>
      <form onSubmit={handleSaveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'שם העסק' : 'Business Name'}</label>
            <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No'}</label>
            <input type="text" value={bizTaxId} onChange={(e) => setBizTaxId(e.target.value)} placeholder="516000000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'אימייל עסק' : 'Business Email'}</label>
            <input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="business@example.com" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'טלפון עסק' : 'Business Phone'}</label>
            <input type="text" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="050-0000000" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>
              {isHebrew ? 'מטבע העסק' : 'Business Currency'}
            </label>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLocalIsraeliBusiness}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: isLocalIsraeliBusiness ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem', fontWeight: 'bold', color: '#4f46e5' }}
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

          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'כתובת העסק' : 'Business Address'}</label>
            <input type="text" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="e.g. Main St 10, City" style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: '#f8fafc', fontSize: '0.85rem' }} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'כתובת תמונת לוגו (URL)' : 'Logo Image URL'} {bizPlan !== 'pro' && <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>(Requires Pro plan)</span>}</label>
          <input type="url" value={bizLogoUrl} onChange={(e) => setBizLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" disabled={bizPlan !== 'pro'} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: bizPlan !== 'pro' ? '#f1f5f9' : '#f8fafc', fontSize: '0.85rem' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>{isHebrew ? 'תנאים כלליים ברירת מחדל להצעות חדשות' : 'Default Terms & Conditions for New Quotes'}</label>
          <textarea 
            value={defaultTerms} 
            onChange={(e) => setDefaultTerms(e.target.value)} 
            rows="4"
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }} 
          />
        </div>

        <button type="submit" style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
          {isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings'}
        </button>
      </form>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          {isHebrew ? 'ניהול מנוי וחבילת שירות' : 'Subscription Management'}
        </h3>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '8px' }}>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             </div>
             <div>
               <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>{bizPlan} PLAN</div>
               <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                 {isTrialExpired ? (isHebrew ? 'תקופת הניסיון הסתיימה' : 'Trial Expired') : (trialDaysLeft ? (isHebrew ? `נותרו ${trialDaysLeft} ימי ניסיון` : `Trial ends in ${trialDaysLeft} days`) : (isHebrew ? 'מנוי פעיל' : 'Active Subscription'))}
               </div>
             </div>
           </div>
           <div style={{ display: 'flex', gap: '8px' }}>
             <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#4f46e5', color: 'white', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="m16 14-4-4-4 4"/><path d="M2 22h20"/></svg>
               {isHebrew ? 'שדרוג / שינוי מסלול' : 'Upgrade / Change Plan'}
             </button>
             {bizPlan !== 'free' && (
               <button type="button" onClick={() => setShowPricingModal(true)} style={{ background: '#fff', color: '#dc2626', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
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