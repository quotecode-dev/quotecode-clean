// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AccessibilityModal.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================


import { useEffect } from 'react';
import BrandName from './BrandName';

// PRODUCT_TRUTH_CAPABILITY: accessibility_tools
// Task 36 (§ד keyboard / labels): the statement is announced as a modal dialog named by its heading, and Escape closes it.
export default function AccessibilityModal({ isOpen, onClose, isHebrew }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div role="dialog" aria-modal="true" aria-labelledby="a11y-statement-title" style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: isHebrew ? 'right' : 'left' }}>
        <h3 id="a11y-statement-title" style={{ marginTop: 0, color: '#1e293b', fontSize: '1.4rem', marginBottom: '15px' }}>
          {isHebrew ? '♿ הצהרת נגישות' : '♿ Accessibility Statement'}
        </h3>
        
        {/* Task 39 (Owner final scope 2026-10-13, legal-documents spec section E): facts only - scope, a real date, adjustments verified in
            this product's gates (page language + direction, phone width without horizontal scrolling, this dialog's semantics + Escape),
            a stated limitation, and a real contact. No full-compliance (AA / IS 5568) or exemption claim. */}
        {isHebrew ? (
          <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p><BrandName onDark={false} /> פועלת לשפר את הנגישות של האתר ושל המערכת. הצהרה זו מתייחסת לעמודי האתר הציבוריים ולמערכת לאחר ההתחברות, ונכונה ל-13 באוקטובר 2026.</p>
            <p>התאמות שנבדקו: בכל עמוד מוגדרים השפה וכיוון הכתיבה (עברית מימין לשמאל, אנגלית משמאל לימין); העמודים מותאמים לרוחב מסך של טלפון בלי גלילה לרוחב; וחלון הצהרה זה מוכרז כחלון דו-שיח ונסגר גם במקש Escape.</p>
            <p>מגבלות: טרם בוצעה בדיקת נגישות מלאה לפי התקן, ולכן איננו מצהירים על עמידה מלאה בו. ייתכן שחלקים באתר ובמערכת עדיין אינם נגישים במלואם.</p>
            <p>לקבלת סיוע או לדיווח על קושי בנגישות אפשר לפנות במייל אל {/* PRODUCT_TRUTH_DECORATIVE: mailto link to the accessibility contact (service mailbox) */}<a href="mailto:support@tekango.com?subject=%D7%A0%D7%92%D7%99%D7%A9%D7%95%D7%AA"><bdi dir="ltr">support@tekango.com</bdi></a> או בטלפון {/* PRODUCT_TRUTH_DECORATIVE: tel link to the accessibility contact phone (Israeli site only) */}<a href="tel:+972502993806"><bdi dir="ltr">050-2993806</bdi></a>. כדאי לציין את כתובת העמוד, הפעולה שלא הצליחה, הדפדפן והטכנולוגיה המסייעת שבה השתמשתם. אין לצרף סיסמאות או מידע רגיש.</p>
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p><BrandName onDark={false} /> works to improve the accessibility of its website and system. This statement covers the public website pages and the system after sign-in, and is correct as of October 13, 2026.</p>
            <p>Adjustments that were checked: every page declares its language and text direction (Hebrew right-to-left, English left-to-right); pages fit a phone-width screen without horizontal scrolling; and this statement is announced as a dialog and also closes with the Escape key.</p>
            <p>Limitations: a full accessibility audit against the standard has not been carried out yet, so we do not claim full conformance. Some parts of the website and the system may not yet be fully accessible.</p>
            <p>For help or to report an accessibility difficulty, email {/* PRODUCT_TRUTH_DECORATIVE: mailto link to the accessibility contact (service mailbox) */}<a href="mailto:info@tekango.com?subject=Accessibility">info@tekango.com</a>. Please include the page address, the action that did not work, your browser and the assistive technology you used. Do not include passwords or sensitive information.</p>
          </div>
        )}

        {/* PRODUCT_TRUTH_DECORATIVE: closes the accessibility statement modal; a dismiss control for the informational dialog already marked accessibility_tools */}
        <button onClick={onClose} style={{ marginTop: '25px', width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
          {isHebrew ? 'סגור' : 'Close'}
        </button>
      </div>
    </div>
  );
}