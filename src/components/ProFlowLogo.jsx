import React from 'react';

// הפרמטר rtl נשמר לתאימות לאחור בלבד (קריאות קיימות עדיין מעבירות אותו) -
// המותג הטקסטואלי הנקי הנוכחי סימטרי ואינו זקוק עוד לכיוון שונה לכל שפה.
export default function ProFlowLogo({ size = 48, darkText = false, logoUrl = '', bizName = '' }) {
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

  // 3. ברירת מחדל: לוגו ProFlow - מותג טקסטואלי נקי בהשראת ניאון-דארק, ללא
  // תיבת רקע/אייקון כלשהי. "Pro" בלבן חד ו"Flow" בגרדיאנט ניאון-סגול זוהר
  // (הזוהר מושג באמצעות drop-shadow שפועל גם מעל טקסט עם background-clip).
  return (
    <span dir="ltr" style={{
      fontSize: `${size * 0.75}px`,
      fontWeight: '900',
      letterSpacing: '-0.5px',
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'Inter, Segoe UI, sans-serif',
      lineHeight: 1
    }}>
      <span style={{ color: shouldUseDarkText ? '#0f172a' : '#ffffff' }}>Pro</span>
      <span style={{
        marginLeft: '1px',
        background: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: '#c084fc',
        filter: 'drop-shadow(0 0 8px rgba(192, 132, 252, 0.55))'
      }}>Flow</span>
    </span>
  );
}