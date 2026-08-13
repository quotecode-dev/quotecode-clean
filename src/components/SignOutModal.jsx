import React from 'react';

export default function SignOutModal({ isOpen, onClose, onConfirm, isHebrew }) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.1rem', marginBottom: '12px', fontWeight: '700' }}>
          {isHebrew ? 'האם ברצונך להתנתק מהמערכת?' : 'Are you sure you want to sign out?'}
        </h3>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          <button 
            onClick={onClose}
            style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button 
            onClick={onConfirm}
            style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}
          >
            {isHebrew ? 'אישור' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}