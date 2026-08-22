// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (EmailConfirmModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import React from 'react';

export default function EmailConfirmModal({ isOpen, onClose, onConfirm, clientEmail, isHebrew }) {
  if (!isOpen) return null;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '1.2rem' }}>
          ✉️
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.15rem', marginBottom: '8px', fontWeight: '700' }}>
          {isHebrew ? 'שליחת הצעת מחיר במייל' : 'Send Quote via Email'}
        </h3>
        
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4' }}>
          {isHebrew ? 'האם לשלוח את הצעת המחיר לכתובת:' : 'Do you want to send the quote to:'}
          <br />
          <strong style={{ color: '#1e293b', direction: 'ltr', display: 'inline-block', marginTop: '4px' }}>{clientEmail}</strong>
        </p>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(79, 70, 229, 0.2)' }}>
            {isHebrew ? 'כן, שלח מייל' : 'Yes, Send'}
          </button>
        </div>
      </div>
    </div>
  );
}