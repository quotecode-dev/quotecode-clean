// Owner console 2026-11-04 (typed: "מאשר את תוכנית ההתקנה, כולל שינוי ב-L-11 ו-L-17"): how to put TEKANGO on the home screen when the
// browser has no install window of its own - iPhone / iPad (Share, then "Add to Home Screen") or another browser (its menu). The mark is
// the approved TEKANGO app icon (law 45). Escape or "Got it" close it; Tab stays in the window. HE / RTL and EN / LTR.
import { useEffect, useRef } from 'react';
import { APP as NEON } from '../theme/neonTheme';
import useFocusTrap from './quotePresentation/useFocusTrap';

export const INSTALL_APP_ICON = '/tekango-app-icon-192.png';

const COPY = {
  he: {
    title: 'התקנת TEKANGO במסך הבית',
    ios: ['לוחצים על כפתור השיתוף בדפדפן (ריבוע עם חץ למעלה).', 'בוחרים "הוספה למסך הבית".'],
    browser: ['פותחים את תפריט הדפדפן (שלוש הנקודות).', 'בוחרים "התקנת אפליקציה" או "הוספה למסך הבית".'],
    after: 'האייקון של TEKANGO יופיע במסך הבית, והאתר ייפתח ממנו במסך מלא.',
    ok: 'הבנתי',
  },
  en: {
    title: 'Install TEKANGO on your home screen',
    ios: ['Tap the Share button in the browser (a square with an arrow up).', 'Choose "Add to Home Screen".'],
    browser: ['Open the browser menu (the three dots).', 'Choose "Install app" or "Add to Home screen".'],
    after: 'The TEKANGO icon appears on your home screen and opens the site full screen.',
    ok: 'Got it',
  },
};

export default function InstallAppSheet({ steps, isHebrew, onClose }) {
  const cardRef = useRef(null);
  const okRef = useRef(null);
  useFocusTrap(cardRef, true);
  useEffect(() => { okRef.current?.focus(); }, []);
  const t = isHebrew ? COPY.he : COPY.en;
  const list = steps === 'ios' ? t.ios : t.browser;

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, padding: '16px', boxSizing: 'border-box' };
  const card = { background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '400px', boxSizing: 'border-box', padding: '20px 18px 18px', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', textAlign: isHebrew ? 'right' : 'left' };
  const num = { flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', background: NEON.gradient, color: '#fff', fontWeight: 800, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  const primaryBtn = { minHeight: '44px', width: '100%', padding: '0 16px', borderRadius: '10px', border: 'none', background: NEON.gradient, color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', marginTop: '16px' };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tk-install-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="install-app-sheet" data-steps={steps === 'ios' ? 'ios' : 'browser'}
      className="no-print" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} style={overlay}>
      <div ref={cardRef} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <img src={INSTALL_APP_ICON} alt="" width={48} height={48} style={{ borderRadius: '12px', flexShrink: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.18)' }} />
          <h3 id="tk-install-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: NEON.textPrimary, lineHeight: 1.35 }}>{t.title}</h3>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {list.map((line, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.92rem', lineHeight: 1.5, color: NEON.textPrimary }}>
              <span style={num} aria-hidden="true">{i + 1}</span>
              <span style={{ minWidth: 0, paddingTop: '3px' }}>{line}</span>
            </li>
          ))}
        </ol>
        <p style={{ margin: '14px 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: NEON.textSecondary }}>{t.after}</p>
        {/* PRODUCT_TRUTH_DECORATIVE: closes the install explanation; changes no data */}
        <button ref={okRef} type="button" onClick={onClose} data-testid="install-app-ok" style={primaryBtn}>{t.ok}</button>
      </div>
    </div>
  );
}
