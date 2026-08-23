import React from 'react';

export default function ProFlowLogo({ size = 48, rtl = false, darkText = false, logoUrl = '', bizName = '' }) {
  // כל דפי המערכת (כולל הדשבורד) עברו לעיצוב ניאון-דארק, כך שטקסט הלוגו
  // תמיד בהיר כברירת מחדל; darkText נותר כדריסה מפורשת בלבד למי שבאמת צריך אותה.
  const shouldUseDarkText = darkText;

  // מצב שגיאה בטעינת התמונה מנוהל באמצעות State נקי ובטוח לריאקט
  const [imgError, setImgError] = React.useState(false);

  // איפוס שגיאת התמונה ברגע שהכתובת משתנה
  React.useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  // 1. אם יש לוגו תקין ואין שגיאת טעינה. לוגואים שהועלו ע"י בתי עסק הם כמעט
  // תמיד קבצי JPG/PNG עם קנבס לבן אטום - הצגתם גולמיים על פס כהה יוצרת מלבן
  // לבן שנראה כמו תקלה ויזואלית. עוטפים אותם בשבב לבן מעוגל ומכוון בכוונה
  // (padding + radius + shadow עדין) כך שהלבן ייראה כעיצוב מכוון ולא כתקלה.
  if (logoUrl && logoUrl.trim() !== '' && !imgError) {
    return (
      <div dir="ltr" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#ffffff', borderRadius: '10px', padding: '4px 10px',
        boxShadow: '0 2px 10px -2px rgba(0,0,0,0.35)', lineHeight: 0
      }}>
        <img
          src={logoUrl}
          alt="Business Logo"
          onError={() => setImgError(true)}
          style={{ height: `${Math.round(size * 0.7)}px`, width: 'auto', objectFit: 'contain', maxWidth: '160px', display: 'block' }}
        />
      </div>
    );
  }

  // 2. אם אין לוגו או שהתמונה נכשלה בטעינה, נציג את שם העסק ב-BOLD אם קיים
  if (bizName && bizName.trim() !== '') {
    return (
      <span style={{ 
        fontSize: `${size * 0.6}px`, 
        fontWeight: 'bold', 
        color: shouldUseDarkText ? '#0f172a' : '#ffffff',
        fontFamily: 'Inter, Segoe UI, sans-serif'
      }}>
        {bizName}
      </span>
    );
  }

  // 3. ברירת מחדל: לוגו ProFlow
  return (
    <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {!rtl && (
        <div style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          flexShrink: 0
        }}>
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
      <span style={{ 
        fontSize: `${size * 0.75}px`, 
        fontWeight: '900', 
        letterSpacing: '-0.5px', 
        display: 'flex', 
        alignItems: 'center',
        fontFamily: 'Inter, Segoe UI, sans-serif'
      }}>
        <span style={{ color: shouldUseDarkText ? '#0f172a' : '#ffffff' }}>Pro</span>
        <span style={{ color: '#4f46e5', marginLeft: '2px' }}>Flow</span>
      </span>
      {rtl && (
        <div style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          flexShrink: 0,
          marginLeft: '10px'
        }}>
          <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
    </div>
  );
}