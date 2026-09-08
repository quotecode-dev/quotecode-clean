// חוק ברזל (Authenticated UI Coherence task, Business Logo Presentation):
// פונקציה טהורה (ללא DOM/Canvas) שסורקת ImageData ומחזירה את תיבת-החסימה
// (bounding box) של הפיקסלים שאינם שקופים-לחלוטין (alpha !== 0) בלבד -
// לעולם לא "פיקסלים לבנים" (לוגו עם רקע-לבן מכוון לא ייחתך בטעות, רק
// שקיפות-אמיתית נחשבת "שוליים ריקים"). זו בדיוק ההבחנה שהמשימה דורשת:
// "whitespace baked into the uploaded image" (padding שקוף אמיתי בתוך
// קובץ PNG/SVG) לעומת עיצוב-לוגו לגיטימי עם רקע לבן/בהיר. מופרדת מ-DOM
// כדי שתהיה ניתנת-לבדיקה-ישירה (unit test) בלי jsdom/canvas אמיתי.
export function computeTransparentTrimBounds(data, width, height) {
  if (!data || !width || !height) {
    return { x: 0, y: 0, width: width || 0, height: height || 0, trimmed: false };
  }

  const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];

  const isRowTransparent = (y) => {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) !== 0) return false;
    }
    return true;
  };
  const isColTransparent = (x) => {
    for (let y = 0; y < height; y++) {
      if (alphaAt(x, y) !== 0) return false;
    }
    return true;
  };

  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;

  while (top < bottom && isRowTransparent(top)) top++;
  while (bottom > top && isRowTransparent(bottom)) bottom--;
  while (left < right && isColTransparent(left)) left++;
  while (right > left && isColTransparent(right)) right--;

  // התמונה שקופה-לחלוטין (אין תוכן נראה בכלל) - לא ניתן לחתוך למשהו
  // משמעותי, מחזיר את התיבה המקורית ומסמן שלא נחתך כלום (בטוח - ה-caller
  // נופל חזרה לתמונה המקורית ללא שינוי, אף פעם לא ל"ריק").
  if (top >= bottom && left >= right && alphaAt(left, top) === 0) {
    return { x: 0, y: 0, width, height, trimmed: false };
  }

  const trimmed = left > 0 || top > 0 || right < width - 1 || bottom < height - 1;
  return { x: left, y: top, width: (right - left + 1), height: (bottom - top + 1), trimmed };
}
