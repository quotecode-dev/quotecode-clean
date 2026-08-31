import { NEON, neonGlowTextStyle } from '../theme/neonTheme';
import { resolveAccountEntitlement } from '../utils/accountEntitlement';

export default function UserDetailsModal({ isOpen, onClose, user, isHebrew }) {
  if (!isOpen || !user) return null;

  // אם זה מודל רשימת משתמשים חדשים (Super Admin)
  if (user.isNewUsersListModal) {
    const usersList = user.users || [];
    return (
      <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
        <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '550px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>

          <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: NEON.textMuted, fontWeight: 'bold' }}>✕</button>

          <h3 style={{ marginTop: 0, fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800', ...neonGlowTextStyle }}>
            {isHebrew ? 'משתמשים חדשים ב-24 השעות האחרונות' : 'New Users (Last 24 Hours)'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
            {usersList.length === 0 ? (
              <p style={{ color: NEON.textMuted, textAlign: 'center', padding: '20px' }}>{isHebrew ? 'אין משתמשים חדשים ב-24 השעות האחרונות.' : 'No new users in the last 24 hours.'}</p>
            ) : (
              usersList.map((u, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${NEON.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: NEON.textPrimary }}>{u.email || 'N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: NEON.textMuted }}>{u.business_name || (isHebrew ? 'עסק חדש' : 'New Business')} | {u.country || 'Local'}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: NEON.violetLight, fontWeight: 'bold' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button onClick={onClose} style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '9px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', boxShadow: NEON.glow }}>
              {isHebrew ? 'סגור חלון' : 'Close'}
            </button>
          </div>

        </div>
      </div>
    );
  }

  // חוק ברזל (Admin V2 Foundation — Phase 1, תיקון הבאג המאושר): הלוגיקה
  // הישנה כאן גזרה Lifetime מ-trial_ends_at===null בלבד - בדיוק גם החתימה
  // של ביטול-עצמי (PricingModal.jsx), כך שחשבון FREE שביטל את עצמו הוצג
  // כ-"PRO (Lifetime)". התיקון: כל הגזירה (tier/Lifetime/badge) עוברת דרך
  // resolveAccountEntitlement() - נקודת-האמת היחידה המשותפת עכשיו גם ל-
  // AdminUsersTab.jsx וגם ל-Dashboard.jsx/SettingsTab.jsx (דרך computeEffectivePlan
  // הקיים, לא נגוע). ר' src/utils/accountEntitlement.js לפירוט המלא. הצורה
  // המוחזרת החוצה (isSuperAdminUser/isLifetime/displayPlan/isGrantedLifetimePro/
  // isTrialActive) נשמרה זהה בכוונה - כדי שה-JSX למטה לא ידרוש שום שינוי.
  const resolved = resolveAccountEntitlement({ plan: user.plan, trialEndsAt: user.trial_ends_at, role: user.role });
  const isSuperAdminUser = resolved.isSuperAdmin;
  const isLifetime = resolved.isLifetime || isSuperAdminUser;
  const isGrantedLifetimePro = resolved.isLifetime;
  // displayPlan הופך עכשיו ל-tier המחושב (נכון תמיד - כולל ניסיון-שפג,
  // Lifetime, ו-super_admin), לא ל-rawPlan הגולמי - מתקן את מחלקת-הבאג
  // המלאה (לא רק את מקרה ה-null הספציפי).
  const displayPlan = resolved.tier.toUpperCase();

  // מצב מנוי - רק Lifetime וניסיון (עדיין בתוקף / פג) הם עובדות שניתן להוכיח
  // מהנתונים הקיימים. אין עדיין חיבור סליקה אמיתי, כך שאין כאן ניסוח שמרמז
  // על תשלום מאומת - ר' מפרט הרדיזיין של ה-Admin UI.
  const isTrialActive = resolved.trialStatus === 'active' || resolved.trialStatus === 'expiringSoon';

  const row = (label, value, opts = {}) => (
    <div style={{ paddingBottom: '8px' }}>
      <strong style={{ color: NEON.textMuted, display: 'inline-block', width: '130px', fontWeight: '600', fontSize: '0.78rem' }}>{label}</strong>
      <span dir={opts.ltr ? 'ltr' : undefined} style={{ fontWeight: '600', color: opts.color || NEON.textPrimary }}>{value}</span>
    </div>
  );

  // כתובת עסק מאוחסנת כמחרוזת מאוחדת "רחוב|עיר|מדינה/אזור|מיקוד" (ר' SettingsTab.jsx).
  // מציגים "רחוב, עיר" קריא, ללא "|", ללא סוגריים, וללא פסיק מיותר כשחסר ערך אחד.
  const formatAddressCity = (rawAddress) => {
    if (!rawAddress) return '';
    const parts = rawAddress.split('|');
    if (parts.length >= 4) {
      const street = (parts[0] || '').trim();
      const city = (parts[1] || '').trim();
      if (street && city) return `${street}, ${city}`;
      return street || city || '';
    }
    return rawAddress.trim();
  };
  const addressCityDisplay = formatAddressCity(user.address);

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: '14px', [isHebrew ? 'left' : 'right']: '14px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: NEON.textMuted, fontWeight: 'bold' }}>✕</button>

        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>

        <h3 style={{ marginTop: 0, fontSize: '1.2rem', marginBottom: '16px', fontWeight: '800', ...neonGlowTextStyle }}>
          {isHebrew ? 'פרטי משתמש מלאים' : 'User Full Details'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: NEON.textSecondary }}>
          {row(isHebrew ? 'אימייל:' : 'Email:', user.email || user.user_email || 'N/A', { ltr: true })}
          {row(isHebrew ? 'שם העסק:' : 'Business Name:', user.business_name || 'New Business')}
          {row(isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:', user.tax_id || (isHebrew ? 'לא הוזן' : 'Not provided'), { ltr: true })}
          {row(isHebrew ? 'טלפון עסק:' : 'Phone:', user.phone || (isHebrew ? 'לא הוזן' : 'Not provided'), { ltr: true })}
          {row(isHebrew ? 'כתובת עסק:' : 'Address:', addressCityDisplay || (isHebrew ? 'לא הוזנה' : 'Not provided'))}
          {row(
            isHebrew ? 'חבילה פעילה:' : 'Plan:',
            <span style={{ fontWeight: 'bold', color: isGrantedLifetimePro ? NEON.violetLight : NEON.sky, textTransform: 'uppercase' }}>
              {displayPlan}{isGrantedLifetimePro ? (isHebrew ? ' (לכל החיים)' : ' (Lifetime)') : ''}
            </span>
          )}
          {row(
            isHebrew ? 'אזור פעילות:' : 'Region:',
            <span style={{ fontWeight: 'bold', color: (user.country || 'Local') === 'Local' ? NEON.emerald : NEON.red }}>
              {user.country === 'International' ? 'Intl' : 'LCL'}
            </span>
          )}
          {row(
            isHebrew ? 'הרשאה (Role):' : 'Role:',
            user.role || 'user',
            { color: isSuperAdminUser ? NEON.red : NEON.textPrimary }
          )}
          {row(
            isHebrew ? 'סטטוס מנוי:' : 'Subscription:',
            <span style={{ fontWeight: '600', color: NEON.violetLight }}>
              {isLifetime
                ? (isHebrew ? '♾️ מנוי לכל החיים (Lifetime)' : 'Lifetime Active')
                : isTrialActive
                  ? (isHebrew ? `ניסיון פעיל עד ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}` : `Trial active until ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}`)
                  : (isHebrew ? `הניסיון פג בתאריך ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}` : `Trial expired on ${new Date(user.trial_ends_at).toLocaleDateString('en-GB')}`)}
            </span>
          )}
          <div>
            <strong style={{ color: NEON.textMuted, display: 'inline-block', width: '130px', fontWeight: '600', fontSize: '0.78rem' }}>{isHebrew ? 'כניסה אחרונה:' : 'Last Sign In:'}</strong>
            <span dir="ltr" style={{ fontWeight: '600', color: NEON.textPrimary }}>{user.last_sign_in ? new Date(user.last_sign_in).toLocaleString('en-GB') : 'N/A'}</span>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={onClose} style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '9px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', boxShadow: NEON.glow }}>
            {isHebrew ? 'סגור חלון' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
