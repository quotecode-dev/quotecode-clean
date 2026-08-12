import React from 'react';

export default function AccessibilityModal({ isOpen, onClose, isHebrew }) {
  if (!isOpen) return null;

  return (
    <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: isHebrew ? 'right' : 'left' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.4rem', marginBottom: '15px' }}>
          {isHebrew ? '♿ הצהרת נגישות' : '♿ Accessibility Statement'}
        </h3>
        
        {isHebrew ? (
          <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p>אנו ב-<strong>ProFlow</strong> רואים חשיבות עליונה בהנגשת המערכת והשירותים שלנו לכלל הציבור, כולל אנשים עם מוגבלויות, מתוך אמונה כי לכל אדם מגיעה הזכות לשוויון, כבוד, נוחות ועצמאות.</p>
            <p>המערכת שלנו נמצאת כעת בשלבי הרצה (Beta), ואנו פועלים באופן שוטף לשפר את הנגישות שלה בהתאם להנחיות תקן הנגישות (WCAG 2.1).</p>
            <p>אם במהלך הגלישה באתר או במערכת נתקלתם בבעיה, תקלה, או שיש לכם הצעה לשיפור בנושא נגישות, אנו נשמח לשמוע מכם ולטפל בנושא בהקדם האפשרי.</p>
          </div>
        ) : (
          <div style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p>At <strong>ProFlow</strong>, we are committed to making our platform and services accessible to everyone, including people with disabilities, believing that everyone deserves the right to equality, dignity, comfort, and independence.</p>
            <p>Our system is currently in its Beta launch phase, and we are actively working to improve its accessibility in accordance with the WCAG 2.1 guidelines.</p>
            <p>If you encounter any accessibility barriers or have suggestions for improvement, we would love to hear from you and address the issue as soon as possible.</p>
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: '25px', width: '100%', background: '#4f46e5', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
          {isHebrew ? 'סגור' : 'Close'}
        </button>
      </div>
    </div>
  );
}