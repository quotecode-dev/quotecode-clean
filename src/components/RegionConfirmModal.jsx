import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { REGION_RULES } from '../utils/regionConfig';

const LOCK_PHRASE = 'CONFIRM';

export default function RegionConfirmModal({ isOpen, onClose, onConfirm, userEmail, newCountry, isHebrew }) {
  const [typedPhrase, setTypedPhrase] = useState('');

  // מאפסים את הטקסט שהוקלד בכל פתיחה/החלפת יעד, כדי שאישור על משתמש אחד
  // לא "יידבק" בטעות לחלון הבא שנפתח על משתמש אחר.
  useEffect(() => {
    if (isOpen) setTypedPhrase('');
  }, [isOpen, newCountry, userEmail]);

  if (!isOpen) return null;

  const isGoingInternational = newCountry === 'International';
  const vatPercent = Math.round((isGoingInternational ? REGION_RULES.INTERNATIONAL.vatRate : REGION_RULES.LOCAL.vatRate) * 100);
  const newCurrency = isGoingInternational ? 'USD' : 'ILS';
  const regionLabel = isGoingInternational
    ? (isHebrew ? 'בינלאומי' : 'International')
    : (isHebrew ? 'מקומי (ישראל)' : 'Local (Israel)');

  const isUnlocked = typedPhrase.trim().toUpperCase() === LOCK_PHRASE;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center' }}>

        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' }}>
          <Lock size={20} strokeWidth={2.2} />
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.15rem', marginBottom: '8px', fontWeight: '800' }}>
          {isHebrew ? 'אישור שינוי אזור פעילות' : 'Confirm Region Change'}
        </h3>

        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '14px', lineHeight: '1.4' }}>
          {isHebrew ? 'האם אתה בטוח שברצונך לשנות את אזור הפעילות של' : 'Are you sure you want to change the region for'}
          {' '}
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', direction: 'ltr', display: 'inline-block' }}>{userEmail}</span>
          {' '}
          {isHebrew ? 'ל-' : 'to '}
          <strong style={{ color: '#4f46e5' }}>{regionLabel}</strong>?
        </p>

        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', textAlign: isHebrew ? 'right' : 'left' }}>
          <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: '700', marginBottom: '6px' }}>
            {isHebrew ? 'זהו שינוי לחוק מס מחייב - השפעה מיידית:' : 'This is a binding tax-rule change — immediate effect:'}
          </div>
          <ul style={{ margin: 0, paddingInlineStart: '18px', fontSize: '0.78rem', color: '#78350f', lineHeight: '1.6' }}>
            <li>{isHebrew ? `מע"מ על הצעות מחיר חדשות: ${vatPercent}%` : `VAT on new quotes: ${vatPercent}%`}</li>
            <li>{isHebrew ? `מטבע ברירת מחדל: ${newCurrency}` : `Default currency: ${newCurrency}`}</li>
            <li>{isHebrew ? 'הצעות מחיר קיימות שכבר נשמרו לא ישתנו' : 'Quotes already saved are not affected'}</li>
          </ul>
        </div>

        <div style={{ textAlign: isHebrew ? 'right' : 'left', marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', fontWeight: '600', marginBottom: '6px' }}>
            {isHebrew
              ? <>הקלד <strong style={{ color: '#1e293b' }}>{LOCK_PHRASE}</strong> כדי לבטל את הנעילה ולאשר:</>
              : <>Type <strong style={{ color: '#1e293b' }}>{LOCK_PHRASE}</strong> to unlock and confirm:</>}
          </label>
          <input
            type="text"
            autoFocus
            value={typedPhrase}
            onChange={(e) => setTypedPhrase(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && isUnlocked) onConfirm(); }}
            placeholder={LOCK_PHRASE}
            dir="ltr"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: `1px solid ${isUnlocked ? '#4f46e5' : '#cbd5e1'}`, fontSize: '0.9rem', fontWeight: '700', letterSpacing: '1px', textAlign: 'center', color: '#1e293b', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            disabled={!isUnlocked}
            style={{
              flex: 1.4,
              background: isUnlocked ? '#4f46e5' : '#c7d2fe',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '6px',
              cursor: isUnlocked ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.85rem',
              boxShadow: isUnlocked ? '0 2px 6px rgba(79, 70, 229, 0.2)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            {!isUnlocked && <Lock size={13} strokeWidth={2.5} />}
            {isHebrew ? `אישור: מעבר ל-${regionLabel} (${vatPercent}% מע"מ)` : `Confirm: Switch to ${regionLabel} (${vatPercent}% VAT)`}
          </button>
        </div>
      </div>
    </div>
  );
}
