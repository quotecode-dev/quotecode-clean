import React from 'react';

export default function UserDetailsModal({ isOpen, onClose, user, isHebrew }) {
  if (!isOpen || !user) return null;

  const isLifetime = user.trial_ends_at === null || user.trial_ends_at === undefined;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', fontSize: '1.2rem' }}>
          👤
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800' }}>
          {isHebrew ? 'פרטי משתמש מלאים' : 'User Full Details'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: '#334155' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'אימייל:' : 'Email:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.email || 'N/A'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'שם העסק:' : 'Business Name:'}</strong>
            <span style={{ fontWeight: '600', color: '#0f172a' }}>{user.business_name || 'New Business'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.tax_id || 'N/A'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'טלפון עסק:' : 'Phone:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.phone || 'N/A'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'כתובת עסק:' : 'Address:'}</strong>
            <span style={{ fontWeight: '600', color: '#0f172a' }}>{user.address || 'N/A'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'חבילה פעילה:' : 'Plan:'}</strong>
            <span style={{ fontWeight: 'bold', color: '#4f46e5', textTransform: 'uppercase' }}>{user.plan || 'Free'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'אזור פעילות:' : 'Region:'}</strong>
            <span style={{ fontWeight: 'bold', color: (user.country || 'Local') === 'Local' ? '#166534' : '#991b1b' }}>{user.country === 'International' ? 'Intl' : 'LCL'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'הרשאה (Role):' : 'Role:'}</strong>
            <span style={{ fontWeight: '600', color: user.role === 'super_admin' ? '#ef4444' : '#0f172a' }}>{user.role || 'user'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'סטטוס מנוי:' : 'Subscription:'}</strong>
            <span style={{ fontWeight: '600', color: '#7c3aed' }}>
              {isLifetime ? (isHebrew ? '♾️ מנוי לכל החיים (Lifetime)' : 'Lifetime Active') : (isHebrew ? `ניסיון פעיל עד ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}` : `Trial until ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}`)}
            </span>
          </div>
          <div>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'כניסה אחרונה:' : 'Last Sign In:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.last_sign_in ? new Date(user.last_sign_in).toLocaleString('en-GB') : 'N/A'}</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={onClose} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>
            {isHebrew ? 'סגור חלון' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}