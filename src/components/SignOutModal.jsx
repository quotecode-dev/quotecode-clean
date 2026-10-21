
import { APP, APP_STATUS, SHADOW } from '../theme/neonTheme';

export default function SignOutModal({ isOpen, onClose, onConfirm, isHebrew, hasUnsavedDraft = false }) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(24,33,43,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: APP.bgCard, padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: SHADOW.lg, textAlign: isHebrew ? 'right' : 'left' }}>
        <h3 style={{ marginTop: 0, color: APP.textPrimary, fontSize: '1.1rem', marginBottom: '12px', fontWeight: '700' }}>
          {isHebrew ? 'להתנתק מהמערכת?' : 'Are you sure you want to sign out?'}
        </h3>
        {hasUnsavedDraft && (
          <p data-testid="signout-unsaved-warning" style={{ color: APP_STATUS.warning.fg, background: APP_STATUS.warning.bg, border: `1px solid ${APP_STATUS.warning.border}`, borderRadius: '6px', padding: '8px 10px', fontSize: '0.88rem', margin: '0 0 8px' }}>
            {isHebrew ? 'יש הצעה שלא נשמרה. התנתקות תמחק אותה (ואת הטיוטה) ממכשיר זה.' : 'You have an unsaved quote. Signing out will delete it (and its local draft) from this device.'}
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: Cancel button closes the sign-out confirmation dialog without signing out */}
          <button 
            onClick={onClose}
            style={{ flex: 1, background: APP.bgCardAlt, color: APP.textSecondary, border: `1px solid ${APP.borderStrong}`, padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}
          >
            {isHebrew ? 'ביטול' : 'Cancel'}
          </button>
          {/* PRODUCT_TRUTH_DECORATIVE: Confirm button signs the user out; session/auth management, not a registered product capability */}
          <button 
            onClick={onConfirm}
            style={{ flex: 1, background: APP.violet, color: APP.textOnAccent, border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: 'none' }}
          >
            {isHebrew ? 'אישור' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
