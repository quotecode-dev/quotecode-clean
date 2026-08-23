import { REGION_RULES } from '../utils/regionConfig';

export default function RegionConfirmModal({ isOpen, onClose, onConfirm, userEmail, newCountry, isHebrew }) {
  if (!isOpen) return null;

  const isGoingInternational = newCountry === 'International';
  const vatPercent = Math.round((isGoingInternational ? REGION_RULES.INTERNATIONAL.vatRate : REGION_RULES.LOCAL.vatRate) * 100);
  const newCurrency = isGoingInternational ? 'USD' : 'ILS';
  const regionLabel = isGoingInternational
    ? (isHebrew ? 'בינלאומי' : 'International')
    : (isHebrew ? 'מקומי (ישראל)' : 'Local (Israel)');

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center' }}>

        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto', fontSize: '1.2rem' }}>
          🌐
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

        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', textAlign: isHebrew ? 'right' : 'left' }}>
          <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: '700', marginBottom: '6px' }}>
            {isHebrew ? 'זהו שינוי לחוק מס מחייב - השפעה מיידית:' : 'This is a binding tax-rule change — immediate effect:'}
          </div>
          <ul style={{ margin: 0, paddingInlineStart: '18px', fontSize: '0.78rem', color: '#78350f', lineHeight: '1.6' }}>
            <li>{isHebrew ? `מע"מ על הצעות מחיר חדשות: ${vatPercent}%` : `VAT on new quotes: ${vatPercent}%`}</li>
            <li>{isHebrew ? `מטבע ברירת מחדל: ${newCurrency}` : `Default currency: ${newCurrency}`}</li>
            <li>{isHebrew ? 'הצעות מחיר קיימות שכבר נשמרו לא ישתנו' : 'Quotes already saved are not affected'}</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button onClick={onConfirm} style={{ flex: 1.4, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
            {isHebrew ? `אישור: מעבר ל-${regionLabel} (${vatPercent}% מע"מ)` : `Confirm: Switch to ${regionLabel} (${vatPercent}% VAT)`}
          </button>
        </div>
      </div>
    </div>
  );
}
