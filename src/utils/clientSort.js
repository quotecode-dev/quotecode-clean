// חוק ברזל (Clients Table Completion task, §4 - מיון עצמאי לפי סוג לקוח +
// מיון-שם רגיש-לוקאל): נקודת-חישוב טהורה יחידה, לא-תלויית-DOM, לכן ניתנת
// לבדיקת-יחידה - Dashboard.jsx (rowsMeta/filteredClients) קורא לה, לא
// משכפל את הלוגיקה בעצמו. מוצא ומייצא מ-Dashboard.jsx בדיוק כפי שהיה
// (זהה-בייט להתנהגות שכבר אומתה חי בדפדפן), רק כפונקציה עצמאית-לבדיקה.

// חוק ברזל: סוג-לקוח אינו שדה-מחרוזת רגיל לצורכי מיון - "business"/"private"
// הם שני ערכים ידועים בלבד, וכל ערך אחר (null/חסר/לא-מוכר) חייב תמיד ליפול
// אחרון, ללא קשר לכיוון-המיון (עולה/יורד) - "repeated activation reverses
// the order" חל רק על היחס בין business/private עצמם, לא על מיקום
// הלא-מוכרים.
function compareClientType(a, b, direction) {
  const rank = (v) => (v === 'business' || v === 'private') ? 0 : 1;
  const aRank = rank(a.client_type);
  const bRank = rank(b.client_type);
  if (aRank !== bRank) return aRank - bRank;
  if (aRank === 1) return 0;
  if (a.client_type === b.client_type) return 0;
  const order = direction === 'asc' ? -1 : 1;
  return a.client_type === 'business' ? order : -order;
}

// שם/שדה-מחרוזת כללי: localeCompare עם 'he'/'en' לפי שוק ההצעה הנוכחית
// (לא רק toLowerCase+השוואת code-point, שלא מכבד כללי-מיון עבריים/אנגליים
// אמיתיים). Array.prototype.sort יציב (מובטח ע"י ECMA-262), לכן שדות
// שווים-בערכם לא נזקקים לייצוב-ידני נוסף כאן.
function compareGenericField(a, b, field, direction, isHebrew) {
  let aVal = a[field];
  let bVal = b[field];
  if (aVal === null || aVal === undefined) aVal = '';
  if (bVal === null || bVal === undefined) bVal = '';

  if (typeof aVal === 'string' && typeof bVal === 'string') {
    const cmp = aVal.localeCompare(bVal, isHebrew ? 'he' : 'en', { sensitivity: 'base', numeric: true });
    return direction === 'asc' ? cmp : -cmp;
  }

  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

// נקודת-כניסה יחידה - Dashboard.jsx קורא ל-clients.sort((a,b) =>
// compareClients(a, b, { field: clientSortField, direction: clientSortDirection, isHebrew }))
export function compareClients(a, b, { field, direction, isHebrew }) {
  if (field === 'client_type') return compareClientType(a, b, direction);
  return compareGenericField(a, b, field, direction, isHebrew);
}
