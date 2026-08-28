// נקודת אמת יחידה לעיצוב כתובת לתצוגה ללקוח/משתמש - כל מקום שמציג כתובת
// (business_settings.address או clients.address, שניהם מאוחסנים באותו
// פורמט "street|city|state|zip") חייב לקרוא לפונקציה הזו ולא לשכפל
// .replace('|', ',') משלו, כדי שהפורמט לא יסטה בין מקומות שונים.
//
// חוק ברזל (מגבלה אמיתית, לא הנחה): אין בשום מקום בסכימה שדה "מדינה"
// נפרד לעסק/ללקוח - רק Local/International הבינארי (market), לא מדינה
// ספציפית (UK/US/Canada/Australia/...). לכן פירוק אמיתי לפי-מדינה (Part
// 14 - UK "10 Downing Street, London SW1A 2AA" לעומת US "350 Fifth
// Avenue, New York, NY 10118" וכו') אינו אפשרי בפועל בלי להמציא נתון
// שלא קיים - בניגוד מפורש להנחיה "Do NOT invent missing state/region
// data". המימוש כאן משתמש בנפילה-בטוחה סבירה אחת ל-International (רחוב,
// עיר, מדינה/פרובינציה מיקוד) שקוראת בסבירות טובה ברוב המדינות
// דוברות-האנגלית הנתמכות, ולא בפירוק ספציפי-פר-מדינה אמיתי - מוגבל
// ומתועד במפורש כמגבלה, לא מוצג כפתרון מלא.
export const formatAddress = (rawAddress, isHebrew) => {
  if (!rawAddress) return '';
  const parts = rawAddress.split('|');
  if (parts.length < 2) {
    // פורמט ישן/לא-מפוצל (רשומה מלפני הפיצול לשדות, או קלט חופשי) - אין
    // "|" להסיר, ואין מבנה אמין לעצב לפיו; מוצג כפי שהוא, לא ריק.
    return rawAddress.includes('|') ? rawAddress.replace(/\|/g, ', ') : rawAddress;
  }
  const [street, city, state, zip] = parts.map((p) => (p || '').trim());

  if (isHebrew) {
    // יעד מאושר-בעלים מדויק: "רחוב, עיר מיקוד" - פסיק בין רחוב לעיר,
    // רווח (לא פסיק) בין עיר למיקוד, בלי "|".
    //
    // עדכון 2026-08-28 (Cross-Market Regression Audit, מימוש מאושר):
    // ענף זה השמיט בעבר את השדה "מדינה / מחוז" לגמרי, גם כשאוכלס - בניגוד
    // לענף International למטה, ששומר עליו. התיקון: state מוכנס בין city
    // ל-zip (עקבי עם המיקום היחסי ב-International: "City, State Zip"),
    // עם אותו רווח מפריד הקיים כבר בין city ל-zip - לא פסיק נוסף. filter
    // (Boolean) לפני join מבטיח שכשה-state ריק (המקרה הנפוץ היום) הפלט
    // נשאר זהה-בייט לגרסה הקודמת - "עיר מיקוד" בלי רווח כפול/שביר.
    const cityStateZip = [city, state, zip].filter(Boolean).join(' ');
    return [street, cityStateZip].filter(Boolean).join(', ');
  }

  // International - נפילה-בטוחה כללית (לא ספציפית-פר-מדינה אמיתית, ר'
  // ההערה למעלה): "Street, City, State Zip" - משמיט שדות חסרים בלי
  // להמציא נתון.
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, cityStateZip].filter(Boolean).join(', ');
};
