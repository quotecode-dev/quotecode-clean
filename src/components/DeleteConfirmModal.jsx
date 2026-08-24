import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { NEON, FONT_HE, FONT_EN, neonGhostButtonStyle } from '../theme/neonTheme';

// רכיב מחיקה-מאשרת יחיד ומשותף לכל זרימות המחיקה באפליקציה - מחליף את כל
// window.confirm() המובנים של הדפדפן כדי לשמור על עיצוב אחיד (NEON כהה)
// ולאפשר טקסט/מזהה ישות דינמיים. ר' Dashboard.jsx לזרימת ה-request/confirm
// בפועל - הרכיב עצמו נשאר "טיפש" (props בלבד), לא מבצע שום קריאת מחיקה.
export default function DeleteConfirmModal({ isOpen, isHebrew, title, message, confirmLabel, cancelLabel, isDeleting, onCancel, onConfirm }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="no-print"
      onClick={() => { if (!isDeleting) onCancel(); }}
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: NEON.bgElevated, border: `1px solid ${NEON.borderStrong}`, borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '340px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.55)', fontFamily: isHebrew ? FONT_HE : FONT_EN, boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(248,113,113,0.12)', color: NEON.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={14} strokeWidth={2.4} />
          </div>
          <h3 style={{ margin: 0, color: NEON.textPrimary, fontSize: '1rem', fontWeight: '800' }}>
            {title}
          </h3>
        </div>

        <p style={{ color: NEON.textSecondary, fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 18px 0', textAlign: isHebrew ? 'right' : 'left' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={neonGhostButtonStyle({ flex: 1, padding: '9px', fontSize: '0.85rem', opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' })}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            style={{ flex: 1, background: NEON.redDark, color: '#fff', border: 'none', padding: '9px', borderRadius: '8px', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.85rem', opacity: isDeleting ? 0.7 : 1, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}
          >
            {isDeleting ? (isHebrew ? 'מוחק…' : 'Deleting…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
