// ==========================================
// 🚨 חוק ברזל קשיח: אכיפת ניתוב שפה דינמי, סטריקט והגנות מנויים (PricingModal.jsx).
// חל איסור מוחלט לפתוח הצעות מחיר בנתיב לא תואם שפה או לעקוף את מגבלות חבילות המנוי (Free/Basic/PRO).
// ==========================================

import { useState } from 'react';
import { X, Rocket, CheckCircle2, XCircle } from 'lucide-react';
import { PRICING_CATALOG, getSavingsPercent } from '../utils/pricingCatalog';
import Toast from './Toast';
import BrandName from './BrandName';
import AiHelpButton from './AiHelpButton';

export default function PricingModal({ isOpen, onClose, isHebrew, isLocalIsraeliBusiness, isLifetime, currency }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [toast, setToast] = useState(null);

  if (!isOpen) return null;

  // הגדרת סימול המטבע הנכון לפי המשתמש (₪, £, €, $)
  const upperCurr = (currency || '').toUpperCase();
  const planSym = isLocalIsraeliBusiness ? '₪' : (upperCurr === 'EUR' ? '€' : upperCurr === 'GBP' ? '£' : '$');

  // חישוב מחירים דינמי לפי המטבע בפועל
  // Phase J (2026-09-22): the in-app comparison uses the ONE canonical price catalog (the landing pages use the same one). The previous
  // hard-coded International numbers here (e.g. Basic $39 / Pro $89) contradicted the published landing prices ($15 / $29).
  const tier = isLocalIsraeliBusiness ? PRICING_CATALOG.il
    : (upperCurr === 'EUR' ? PRICING_CATALOG.global.eur : upperCurr === 'GBP' ? PRICING_CATALOG.global.gbp : PRICING_CATALOG.global.usd);
  const basicMonthlyNum = tier.basic.monthly;
  const basicYearlyMonthlyNum = tier.basic.annualMonthly;

  const proMonthlyNum = tier.pro.monthly;
  const proYearlyMonthlyNum = tier.pro.annualMonthly;

  const basicMonthlyPrice = `${planSym}${basicMonthlyNum}`;
  const basicYearlyMonthlyPrice = `${planSym}${basicYearlyMonthlyNum}`;
  const basicYearlyTotal = `${planSym}${basicYearlyMonthlyNum * 12}`;
  const basicMonthlyTotalYear = `${planSym}${basicMonthlyNum * 12}`;

  const proMonthlyPrice = `${planSym}${proMonthlyNum}`;
  const proYearlyMonthlyPrice = `${planSym}${proYearlyMonthlyNum}`;
  const proYearlyTotal = `${planSym}${proYearlyMonthlyNum * 12}`;
  const proMonthlyTotalYear = `${planSym}${proMonthlyNum * 12}`;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '720px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}><X size={18} strokeWidth={2.5} /></button>
        <div style={{ position: 'absolute', top: '8px', [isHebrew ? 'right' : 'left']: '14px' }}><AiHelpButton isHebrew={isHebrew} compact testId="ai-help-plans" /></div>

        {(
          <>
            <h2 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.3rem', textAlign: 'center', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Rocket size={20} color="#4f46e5" />
              {isHebrew ? <>חבילות <BrandName onDark={false} /></> : <><BrandName onDark={false} /> Plans</>}
            </h2>
            <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
              {isHebrew ? 'השוואת חבילות. שדרוג בתשלום אינו זמין כרגע.' : 'Plan comparison. Paid upgrades are not currently available.'}
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
                  {isHebrew ? 'מסלול שנתי (חיסכון לעומת חודשי)' : 'Annual plan (save vs monthly)'}
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
                    {isHebrew ? `במסלול שנתי (חיסכון ${getSavingsPercent(tier.basic.monthly, tier.basic.annualMonthly)}%)` : `On the annual plan (save ${getSavingsPercent(tier.basic.monthly, tier.basic.annualMonthly)}%)`}
                  </div>
                )}
                
                <ul style={{ margin: '0 0 16px 0', padding: 0, listStyle: 'none', color: '#475569', fontSize: '0.8rem', lineHeight: '1.5', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />{isHebrew ? 'עד 20 הצעות מחיר בחודש' : 'Up to 20 quotes/month'}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />{isHebrew ? 'חתימה דיגיטלית וניהול לקוחות' : 'Digital signature & client management'}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}><XCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />{isHebrew ? 'ללא שליחה ישירה בווצאפ' : 'No WhatsApp sending'}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}><XCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />{isHebrew ? 'ללא צירוף קבצים ושרטוטים להצעות' : 'No file attachments or drawings'}</li>
                </ul>
              </div>

              {/* PRO Plan */}
              <div style={{ border: '2px solid #4f46e5', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', background: 'white', boxShadow: '0 8px 12px -2px rgba(79, 70, 229, 0.1)' }}>
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
                    {isHebrew ? `במסלול שנתי (חיסכון ${getSavingsPercent(tier.pro.monthly, tier.pro.annualMonthly)}%)` : `On the annual plan (save ${getSavingsPercent(tier.pro.monthly, tier.pro.annualMonthly)}%)`}
                  </div>
                )}

                <ul style={{ margin: '0 0 16px 0', padding: 0, listStyle: 'none', color: '#475569', fontSize: '0.8rem', lineHeight: '1.5', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#4f46e5" style={{ flexShrink: 0 }} />{isHebrew ? 'הצעות מחיר ללא הגבלה כלל' : 'Unlimited quotes without restrictions'}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#4f46e5" style={{ flexShrink: 0 }} />{isHebrew ? 'שליחה ישירה בוואטסאפ (WhatsApp)' : 'Direct WhatsApp sending'}</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#4f46e5" style={{ flexShrink: 0 }} />{isHebrew ? 'צירוף קבצים ושרטוטים להצעות (עד 30MB)' : 'File attachments & drawings to quotes (up to 30MB)'}</li>
                </ul>
              </div>

            </div>

            {/* חוק ברזל (Explicit Lifetime Entitlement Model, migration
                20260908000000): Lifetime הוא override מנהלתי, לא מנוי בתשלום -
                אין ביטול עצמי. שרת (guard_business_settings_plan_trial)
                דוחה ממילא כל UPDATE עצמי בזמן ש-is_lifetime=true, כך שהכפתור
                לא היה מצליח בכל מקרה; במקום הודעת שגיאה לא ברורה, מוצג כאן
                הסבר ברור שהביטול/שינוי דורש פנייה למנהל מערכת. */}
            {isLifetime && (
              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px solid #f1f5f9', paddingTop: '15px', color: '#64748b', fontSize: '0.8rem' }}>
                {isHebrew
                  ? 'לחשבון זה גישת Lifetime שהוענקה על ידי מנהל מערכת.'
                  : 'This account has a Lifetime access grant from an administrator.'}
              </div>
            )}

            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', marginTop: '10px' }}>
              {isHebrew ? 'יש לך שאלות? צור איתנו קשר דרך עוזר ה-AI או במייל.' : 'Have questions? Contact us via AI assistant or email.'}
            </div>
          </>
        )}

      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} isHebrew={isHebrew} />
    </div>
  );
}