
export default function UserDetailsModal({ isOpen, onClose, user, isHebrew }) {
  if (!isOpen || !user) return null;

  // אם זה מודל רשימת משתמשים חדשים (Super Admin)
  if (user.isNewUsersListModal) {
    const usersList = user.users || [];
    return (
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
        <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '550px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
          
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

          <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800' }}>
            {isHebrew ? 'משתמשים חדשים ב-24 השעות האחרונות' : 'New Users (Last 24 Hours)'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
            {usersList.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>{isHebrew ? 'אין משתמשים חדשים ב-24 השעות האחרונות.' : 'No new users in the last 24 hours.'}</p>
            ) : (
              usersList.map((u, idx) => (
                <div key={idx} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{u.email || 'N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.business_name || 'עסק חדש'} | {u.country || 'Local'}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 'bold' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              ))
            )}
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

  // בדיקה האם מנוי לכל החיים (רק אם trial_ends_at הוא ממש null / undefined)
  const isSuperAdminUser = user.role === 'super_admin';
  const isLifetime = isSuperAdminUser || user.trial_ends_at === null || user.trial_ends_at === undefined;
  const rawPlan = (user.plan || 'free').toLowerCase();
  // Lifetime שקול ל-PRO גם אם שדה ה-plan הגולמי נשאר "free"/"basic" (handleToggleLifetime מעדכן רק trial_ends_at)
  const isGrantedLifetimePro = isLifetime && !isSuperAdminUser && rawPlan !== 'pro';
  const displayPlan = (isSuperAdminUser || isLifetime) ? 'PRO' : rawPlan.toUpperCase();

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '450px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }}>✕</button>

        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>

        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800' }}>
          {isHebrew ? 'פרטי משתמש מלאים' : 'User Full Details'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: '#334155' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'אימייל:' : 'Email:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.email || user.user_email || 'N/A'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'שם העסק:' : 'Business Name:'}</strong>
            <span style={{ fontWeight: '600', color: '#0f172a' }}>{user.business_name || 'New Business'}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.tax_id || (isHebrew ? 'לא הוזן' : 'Not provided')}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'טלפון עסק:' : 'Phone:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: '#0f172a' }}>{user.phone || (isHebrew ? 'לא הוזן' : 'Not provided')}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'כתובת עסק:' : 'Address:'}</strong>
            <span style={{ fontWeight: '600', color: '#0f172a' }}>{user.address || (isHebrew ? 'לא הוזנה' : 'Not provided')}</span>
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <strong style={{ color: '#64748b', display: 'inline-block', width: '120px' }}>{isHebrew ? 'חבילה פעילה:' : 'Plan:'}</strong>
            <span style={{ fontWeight: 'bold', color: isGrantedLifetimePro ? '#7c3aed' : '#4f46e5', textTransform: 'uppercase' }}>
              {displayPlan}{isGrantedLifetimePro ? (isHebrew ? ' (לכל החיים)' : ' (Lifetime)') : ''}
            </span>
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