// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (LifetimeConfirmModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================


export default function LifetimeConfirmModal({ isOpen, onClose, onConfirm, userEmail, isHebrew }) {
  if (!isOpen) return null;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        
        <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '1.4rem' }}>
          ♾️
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '8px', fontWeight: '800' }}>
          {isHebrew ? 'הענקת מנוי לכל החיים (Lifetime)' : 'Grant Lifetime Subscription'}
        </h3>
        
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4' }}>
          {isHebrew ? 'האם אתה בטוח שברצונך להעניק למשתמש זה גישת לכל החיים ולבטל לחלוטין את תקופת הניסיון?' : 'Are you sure you want to grant lifetime access to this user?'}
          <br />
          <strong style={{ color: '#4f46e5', direction: 'ltr', display: 'inline-block', marginTop: '6px' }}>{userEmail}</strong>
        </p>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: '#7c3aed', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', boxShadow: '0 2px 6px rgba(124, 58, 237, 0.2)' }}>
            {isHebrew ? 'אישור והענקת Lifetime' : 'Confirm Lifetime'}
          </button>
        </div>
      </div>
    </div>
  );
}