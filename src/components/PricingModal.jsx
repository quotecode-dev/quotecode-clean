// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (PricingModal.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import React, { useState } from 'react';
import { supabase } from '../shared/supabase';

export default function PricingModal({ isOpen, onClose, isHebrew, isLocalIsraeliBusiness, currentPlan, userId, onPlanUpdated, currency }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showCancelFlow, setShowCancelFlow] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOtherText, setCancelOtherText] = useState('');
  const [dataPreference, setDataPreference] = useState('archive'); // 'archive' or 'delete'
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  if (!isOpen) return null;

  // הגדרת סימול המטבע הנכון לפי המשתמש (₪, £, €, $)
  const upperCurr = (currency || '').toUpperCase();
  const planSym = isLocalIsraeliBusiness ? '₪' : (upperCurr === 'EUR' ? '€' : upperCurr === 'GBP' ? '£' : '$');

  // חישוב מחירים דינמי לפי המטבע בפועל
  const basicMonthlyNum = isLocalIsraeliBusiness ? 49 : (upperCurr === 'EUR' ? 35 : upperCurr === 'GBP' ? 30 : 39);
  const basicYearlyMonthlyNum = isLocalIsraeliBusiness ? 39 : (upperCurr === 'EUR' ? 28 : upperCurr === 'GBP' ? 24 : 29);
  
  const proMonthlyNum = isLocalIsraeliBusiness ? 99 : (upperCurr === 'EUR' ? 79 : upperCurr === 'GBP' ? 69 : 89);
  const proYearlyMonthlyNum = isLocalIsraeliBusiness ? 79 : (upperCurr === 'EUR' ? 62 : upperCurr === 'GBP' ? 55 : 69);

  const basicMonthlyPrice = `${planSym}${basicMonthlyNum}`;
  const basicYearlyMonthlyPrice = `${planSym}${basicYearlyMonthlyNum}`;
  const basicYearlyTotal = `${planSym}${basicYearlyMonthlyNum * 12}`;
  const basicMonthlyTotalYear = `${planSym}${basicMonthlyNum * 12}`;

  const proMonthlyPrice = `${planSym}${proMonthlyNum}`;
  const proYearlyMonthlyPrice = `${planSym}${proYearlyMonthlyNum}`;
  const proYearlyTotal = `${planSym}${proYearlyMonthlyNum * 12}`;
  const proMonthlyTotalYear = `${planSym}${proMonthlyNum * 12}`;

  // מזהי תוכנית למערכת הסליקה (Billing Price IDs / SKUs)
  const getSelectedPriceId = (planType) => {
    const region = isLocalIsraeliBusiness ? 'il' : 'global';
    if (planType === 'basic') {
      return billingCycle === 'monthly' ? `price_basic_${region}_monthly` : `price_basic_${region}_yearly`;
    } else {
      return billingCycle === 'monthly' ? `price_pro_${region}_monthly` : `price_pro_${region}_yearly`;
    }
  };

  const handleSelectPlan = (planType) => {
    const priceId = getSelectedPriceId(planType);
    alert(isHebrew ? `נבחר מסלול: ${planType.toUpperCase()} (${billingCycle}). מזהה סליקה: ${priceId}` : `Selected plan: ${planType.toUpperCase()} (${billingCycle}). Price ID: ${priceId}`);
    onClose();
  };

  const handleConfirmCancellation = async (e) => {
    e.preventDefault();
    if (!cancelReason) {
      alert(isHebrew ? 'נא לבחור סיבת ביטול אחת לפחות.' : 'Please select a cancellation reason.');
      return;
    }

    setIsSubmittingCancel(true);
    try {
      if (userId) {
        const { error } = await supabase
          .from('business_settings')
          .update({
            plan: 'free',
            trial_ends_at: null,
          })
          .eq('user_id', userId);

        if (error) throw error;

        if (dataPreference === 'delete') {
          await supabase.from('quotes').delete().eq('user_id', userId);
          await supabase.from('clients').delete().eq('user_id', userId);
          await supabase.from('services').delete().eq('user_id', userId);
          await supabase.from('expenses').delete().eq('user_id', userId);
        }
      }

      alert(isHebrew ? 'המנוי בוטל בהצלחה. תודה שהשתמשת ב-ProFlow.' : 'Subscription successfully canceled. Thank you for using ProFlow.');
      setShowCancelFlow(false);
      if (onPlanUpdated) onPlanUpdated();
      onClose();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      alert(isHebrew ? `שגיאה בביטול המנוי: ${err.message}` : `Error canceling subscription: ${err.message}`);
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '720px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

        {!showCancelFlow ? (
          <>
            <h2 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.3rem', textAlign: 'center', marginBottom: '4px' }}>
              {isHebrew ? '🚀 שדרג את העסק שלך עם ProFlow' : '🚀 Upgrade Your Business with ProFlow'}
            </h2>
            <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
              {isHebrew ? 'בחר את המסלול המתאים ביותר לצרכים שלך והתחל לעבוד ללא הגבלות' : 'Choose the best plan for your needs and work without limits'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ background: '#f1f5f9', padding: '3px', borderRadius: '24px', display: 'flex', gap: '4px', border: '1px solid #cbd5e1' }}>
                <button
                  onClick={() => setBillingCycle('monthly')}
                  style={{
                    background: billingCycle === 'monthly' ? '#4f46e5' : 'transparent',
                    color: billingCycle === 'monthly' ? 'white' : '#475569',
                    border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {isHebrew ? 'חיוב חודשי' : 'Monthly Billing'}
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  style={{
                    background: billingCycle === 'yearly' ? '#4f46e5' : 'transparent',
                    color: billingCycle === 'yearly' ? 'white' : '#475569',
                    border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  {isHebrew ? 'חיוב שנתי (חודשיים מתנה! 20% הנחה)' : 'Yearly Billing (2 Months Free!)'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              
              {/* Basic Plan */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.1rem' }}>{isHebrew ? 'מנוי בסיסי (Basic)' : 'Basic Plan'}</h3>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5', marginBottom: '2px' }}>
                  {billingCycle === 'monthly' ? basicMonthlyPrice : basicYearlyMonthlyPrice} 
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>{isHebrew ? '/ חודש' : '/ month'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px' }}>
                  {billingCycle === 'monthly' 
                    ? (isHebrew ? `סה"כ ${basicMonthlyTotalYear} לשנה` : `Total ${basicMonthlyTotalYear}/year`) 
                    : (isHebrew ? `סה"כ ${basicYearlyTotal} לשנה (בחיוב שנתי)` : `Total ${basicYearlyTotal}/year (Billed annually)`)}
                </div>
                {billingCycle === 'yearly' && (
                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700', marginBottom: '10px' }}>
                    {isHebrew ? 'חיוב שנתי (חסוך 20% בשנה)' : 'Billed annually (Save 20%)'}
                  </div>
                )}
                
                <ul style={{ margin: '0 0 16px 0', padding: isHebrew ? '0 16px 0 0' : '0 0 0 16px', color: '#475569', fontSize: '0.8rem', lineHeight: '1.5', flex: 1 }}>
                  <li>{isHebrew ? 'עד 20 הצעות מחיר בחודש' : 'Up to 20 quotes/month'}</li>
                  <li>{isHebrew ? 'חתימה דיגיטלית וניהול לקוחות' : 'Digital signature & client management'}</li>
                  <li style={{ color: '#ef4444' }}>{isHebrew ? '✗ ללא שליחה ישירה בווצאפ' : '✗ No WhatsApp sending'}</li>
                  <li style={{ color: '#ef4444' }}>{isHebrew ? '✗ ללא צירוף קבצים ושרטוטים להצעות' : '✗ No file attachments or drawings'}</li>
                </ul>
                <button 
                  data-price-id={getSelectedPriceId('basic')}
                  onClick={() => handleSelectPlan('basic')} 
                  style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isHebrew ? 'בחר מסלול Basic' : 'Select Basic'}
                </button>
              </div>

              {/* PRO Plan */}
              <div style={{ border: '2px solid #4f46e5', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', background: 'white', boxShadow: '0 8px 12px -2px rgba(79, 70, 229, 0.1)' }}>
                <div style={{ background: '#4f46e5', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginBottom: '6px' }}>{isHebrew ? 'הפופולרי ביותר ⭐' : 'POPULAR ⭐'}</div>
                <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.1rem' }}>{isHebrew ? 'מסלול עסקי (Pro)' : 'PRO Plan'}</h3>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5', marginBottom: '2px' }}>
                  {billingCycle === 'monthly' ? proMonthlyPrice : proYearlyMonthlyPrice} 
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>{isHebrew ? '/ חודש' : '/ month'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px' }}>
                  {billingCycle === 'monthly' 
                    ? (isHebrew ? `סה"כ ${proMonthlyTotalYear} לשנה` : `Total ${proMonthlyTotalYear}/year`) 
                    : (isHebrew ? `סה"כ ${proYearlyTotal} לשנה (בחיוב שנתי)` : `Total ${proYearlyTotal}/year (Billed annually)`)}
                </div>
                {billingCycle === 'yearly' && (
                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '700', marginBottom: '10px' }}>
                    {isHebrew ? 'חיוב שנתי (חסוך 20% בשנה)' : 'Billed annually (Save 20%)'}
                  </div>
                )}

                <ul style={{ margin: '0 0 16px 0', padding: isHebrew ? '0 16px 0 0' : '0 0 0 16px', color: '#475569', fontSize: '0.8rem', lineHeight: '1.5', flex: 1 }}>
                  <li>{isHebrew ? 'הצעות מחיר ללא הגבלה כלל' : 'Unlimited quotes without restrictions'}</li>
                  <li>{isHebrew ? 'שליחה ישירה בוואטסאפ (WhatsApp)' : 'Direct WhatsApp sending'}</li>
                  <li>{isHebrew ? 'ניהול הכנסות והוצאות מלא' : 'Full income and expense management'}</li>
                  <li>{isHebrew ? '✓ צירוף קבצים ושרטוטים להצעות (עד 30MB)' : '✓ File attachments & drawings to quotes (up to 30MB)'}</li>
                </ul>
                <button 
                  data-price-id={getSelectedPriceId('pro')}
                  onClick={() => handleSelectPlan('pro')} 
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)' }}
                >
                  {isHebrew ? 'בחר מסלול PRO' : 'Select PRO'}
                </button>
              </div>

            </div>

            {currentPlan && currentPlan !== 'free' && (
              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                <button
                  onClick={() => setShowCancelFlow(true)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}
                >
                  {isHebrew ? 'ביטול מנוי פעיל' : 'Cancel active subscription'}
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginTop: '10px' }}>
              {isHebrew ? 'יש לך שאלות? צור איתנו קשר דרך עוזר ה-AI או במייל.' : 'Have questions? Contact us via AI assistant or email.'}
            </div>
          </>
        ) : (
          <form onSubmit={handleConfirmCancellation}>
            <h2 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '8px' }}>
              {isHebrew ? '💔 מצטערים לשמוע שאתה עוזב' : '💔 We are sorry to see you go'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
              {isHebrew 
                ? 'נשמח אם תסביר לנו בקצרה למה בחרת לבטל את המנוי שלך, כדי שנוכל להשתפר:' 
                : 'Please let us know why you are canceling so we can improve:'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '0.85rem', color: '#334155' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cancelReason" value="price_high" checked={cancelReason === 'price_high'} onChange={(e) => setCancelReason(e.target.value)} required />
                {isHebrew ? 'המחיר גבוה מדי' : 'Price is too high'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cancelReason" value="better_alternative" checked={cancelReason === 'better_alternative'} onChange={(e) => setCancelReason(e.target.value)} />
                {isHebrew ? 'מצאתי תוכנה טובה יותר' : 'Found a better software alternative'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cancelReason" value="technical_issues" checked={cancelReason === 'technical_issues'} onChange={(e) => setCancelReason(e.target.value)} />
                {isHebrew ? 'יש הרבה בעיות טכניות' : 'Too many technical issues'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cancelReason" value="no_longer_needed" checked={cancelReason === 'no_longer_needed'} onChange={(e) => setCancelReason(e.target.value)} />
                {isHebrew ? 'כבר אין לי צורך בתוכנה' : 'No longer need the software'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="cancelReason" value="other" checked={cancelReason === 'other'} onChange={(e) => setCancelReason(e.target.value)} />
                {isHebrew ? 'אחר' : 'Other'}
              </label>
            </div>

            {cancelReason === 'other' && (
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  value={cancelOtherText}
                  onChange={(e) => setCancelOtherText(e.target.value)}
                  placeholder={isHebrew ? 'פרט כאן...' : 'Please specify...'}
                  rows="2"
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
            )}

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                {isHebrew ? 'מה תרצה לעשות עם הנתונים שלך?' : 'What would you like to do with your data?'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#475569' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="dataPref" value="archive" checked={dataPreference === 'archive'} onChange={(e) => setDataPreference(e.target.value)} />
                  {isHebrew ? 'ביטול מנוי - שמירת כל הנתונים בארכיון (לצפייה עתידית)' : 'Cancel subscription - Archive all data (Keep read-only access)'}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="dataPref" value="delete" checked={dataPreference === 'delete'} onChange={(e) => setDataPreference(e.target.value)} />
                  {isHebrew ? 'ביטול מנוי - מחיקת כל הנתונים לצמיתות לאלתר' : 'Cancel subscription - Delete all data immediately'}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCancelFlow(false)}
                style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {isHebrew ? 'חזרה' : 'Back'}
              </button>
              <button
                type="submit"
                disabled={isSubmittingCancel}
                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {isSubmittingCancel ? (isHebrew ? 'מעבד ביטול...' : 'Processing...') : (isHebrew ? 'אישור ביטול סופי' : 'Confirm Final Cancellation')}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}