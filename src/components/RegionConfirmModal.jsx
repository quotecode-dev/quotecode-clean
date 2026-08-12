import React from 'react';

export default function RegionConfirmModal({ isOpen, onClose, onConfirm, userEmail, newCountry, isHebrew }) {
  if (!isOpen) return null;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto', fontSize: '1.2rem' }}>
          🌐
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.15rem', marginBottom: '8px', fontWeight: '800' }}>
          {isHebrew ? 'אישור שינוי אזור פעילות' : 'Confirm Region Change'}
        </h3>
        
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4' }}>
          {isHebrew ? 'האם אתה בטוח שברצונך לשנות את אזור הפעילות ל-' : 'Are you sure you want to change region to '}
          <strong style={{ color: '#4f46e5' }}>{newCountry === 'Local' ? 'LCL' : 'Intl'}</strong>?
          <br />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', direction: 'ltr', display: 'inline-block', marginTop: '4px' }}>{userEmail}</span>
        </p>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
            {isHebrew ? 'אישור שינוי' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}