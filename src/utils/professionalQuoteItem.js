// חוק ברזל (Professional Quotes Stage C, PROFLOW_PROJECT_CONTEXT.md §158,
// Owner-approved unit set §155.1.4/§156): נקודת-אמת יחידה לרשימת יחידות-
// המדידה/תמחור המקצועיות. מערך-נתונים רגיל, לא enum בקוד ולא ב-DB (הטור
// quote_items.pricing_unit הוא text רגיל, ר' Stage A) - כך שיחידה עתידית
// (m³/liter וכו') היא רשומה חדשה כאן, לעולם לא migration/redesign.
export const PROFESSIONAL_UNITS = [
  { id: 'unit', he: 'יחידה', en: 'unit' },
  { id: 'm2', he: 'מ"ר', en: 'm²' },
  { id: 'linear_meter', he: 'מטר אורך', en: 'linear meter' },
  { id: 'kg', he: 'ק"ג', en: 'kg' },
  { id: 'hour', he: 'שעה', en: 'hour' },
  { id: 'day', he: 'יום', en: 'day' },
];

export function getProfessionalUnitLabel(unitId, isHebrew) {
  const found = PROFESSIONAL_UNITS.find(u => u.id === unitId);
  if (!found) return unitId || '';
  return isHebrew ? found.he : found.en;
}

// חוק ברזל (Business Professional Profile, Owner Night Run task,
// PROFLOW_PROJECT_CONTEXT.md §160.4 - Gap #2): רשימת-נתונים פשוטה, לא enum,
// מייצגת "סוג העיסוק המקצועי" של העסק - "ברירת מחדל רלוונטית", לא סיווג
// נעול. domain ≠ pricing unit בכוונה (דרישה מפורשת של הבעלים, §5 במשימה):
// עסק אלומיניום עשוי להשתמש גם ב-unit/מטר-אורך, לא רק מ"ר - defaultUnit כאן
// הוא רק הצעה-ראשונית לפריט מקצועי חדש, לעולם לא נעילה (המשתמש יכול תמיד
// לבחור יחידה אחרת דרך אותו בורר-יחידה הקיים כבר ב-QuoteForm.jsx). domain
// חדש = רשומה חדשה כאן, לעולם לא migration/schema.
export const PROFESSIONAL_DOMAINS = [
  { id: 'general', he: 'כללי / אחר', en: 'General / Other', defaultUnit: null },
  { id: 'aluminum_metal', he: 'אלומיניום ומתכת', en: 'Aluminum & Metalwork', defaultUnit: 'm2' },
  { id: 'carpentry_wood', he: 'נגרות ועץ', en: 'Carpentry & Woodwork', defaultUnit: 'm2' },
  { id: 'construction_renovation', he: 'בנייה ושיפוצים', en: 'Construction & Renovation', defaultUnit: 'unit' },
  { id: 'consulting_services', he: 'ייעוץ ושירותים מקצועיים', en: 'Consulting & Professional Services', defaultUnit: 'hour' },
  { id: 'products_retail', he: 'מכירת מוצרים', en: 'Product Sales', defaultUnit: 'unit' },
];

export function getProfessionalDomainLabel(domainId, isHebrew) {
  const found = PROFESSIONAL_DOMAINS.find(d => d.id === domainId);
  if (!found) return '';
  return isHebrew ? found.he : found.en;
}

// נופל בבטחה ל-null (ללא הצעה) עבור domain לא-מוכר/ריק - הבורר עצמו נשאר
// תמיד על "ללא (פריט רגיל)" כברירת-מחדל, בדיוק כמו היום, זו רק תוספת-נוחות.
export function getDefaultProfessionalUnit(domainId) {
  const found = PROFESSIONAL_DOMAINS.find(d => d.id === domainId);
  return found ? found.defaultUnit : null;
}

// חוק ברזל (§168 audit finding - "MEASURABLE_UNIT_ID is a single hardcoded
// constant, no real formula framework"): מוחלף כאן במפה אמיתית וניתנת-
// להרחבה (unit→method), לא בעוד קבוע יחיד. כל CALCULATION_METHODS הוא
// מזהה-מבנה בטוח (לעולם לא קוד-לביצוע שהמשתמש מזין) - הלוגיקה שמאחורי כל
// method קבועה ומוגדרת כאן בלבד. יחידת-מדידה עתידית = רשומה חדשה ב-
// UNIT_CALCULATION_METHOD, לעולם לא branch חדש מפוזר בקוד.
export const CALCULATION_METHODS = [
  { id: 'manual', he: 'ידני', en: 'Manual' },
  { id: 'quantity', he: 'כמות / יחידות', en: 'Quantity / count' },
  { id: 'area', he: 'שטח (רוחב × גובה)', en: 'Area (width × height)' },
  { id: 'linear', he: 'אורך (מטר רץ)', en: 'Linear length' },
];

export function getCalculationMethodLabel(methodId, isHebrew) {
  const found = CALCULATION_METHODS.find(m => m.id === methodId);
  if (!found) return methodId || '';
  return isHebrew ? found.he : found.en;
}

// יחידות עם נוסחת-מדידה אמיתית מאחוריהן (§155.8/§157 - עדיין רק אלה
// שאושרו: m²=שטח, ועכשיו גם linear_meter=אורך יחיד, ר' §168). kg/hour/day/
// unit נשארות כמות-ידנית-תמיד בכוונה - אין לנחש נוסחת-משקל/שעה שלא אושרה.
export const UNIT_CALCULATION_METHOD = {
  m2: 'area',
  linear_meter: 'linear',
};

// נשמר לתאימות-לאחור (טסטים/צרכנים קיימים) - m² עדיין היחידה ה"ראשית".
export const MEASURABLE_UNIT_ID = 'm2';
export const MEASURABLE_UNIT_IDS = Object.keys(UNIT_CALCULATION_METHOD);

export function isMeasurableUnit(unitId) {
  return Object.prototype.hasOwnProperty.call(UNIT_CALCULATION_METHOD, unitId);
}

// נקודת-קריאה יחידה לקביעת ה-calculation_method שיישמר בפועל על פריט -
// override ידני (quantity_source==='manual') תמיד מנצח; אחרת נגזר
// מ-pricing_unit; יחידה לא-נמדדת נופלת ל-'quantity' (כמות/יחידות ידנית,
// זהה-בייט להתנהגות הקיימת של unit/kg/hour/day).
export function resolveCalculationMethod(pricingUnit, quantitySource) {
  if (!pricingUnit) return null;
  if (quantitySource === 'manual') return 'manual';
  const measured = UNIT_CALCULATION_METHOD[pricingUnit];
  return measured || 'quantity';
}

// ערך שורת-מידה בודדת עבור method נתון - 'linear' משתמש ברוחב בלבד (ערך-
// אורך יחיד; height לא בשימוש/מוסתר ב-UI עבור method זה), כל method אחר
// (ברירת מחדל 'area') משתמש בהתנהגות הקיימת width×height ללא שינוי.
export function computeMeasurementValue(method, width, height) {
  if (method === 'linear') {
    const w = Number(width);
    if (!Number.isFinite(w) || w <= 0) return null;
    return w;
  }
  return computeMeasurementArea(width, height);
}

// חוק ברזל (LIFETIME/FREE-TRIAL-safe, §156): הפעולה היחידה שקובעת אם פריט
// הוא "מקצועי" היא נוכחות pricing_unit - לא דגל UI נפרד, כדי שלא יהיה מקור-
// אמת שני לאותה עובדה.
export function isProfessionalItem(item) {
  return Boolean(item && item.pricing_unit);
}

// חוק ברזל (Dimension Input — cm entry, Owner-required, §165.x): הנתונים
// המאוחסנים (quote_item_measurements.width/height, וכל חישוב-שטח קיים)
// נשארים במטרים ללא שינוי - התיקון הזה הוא גבול-UI בלבד (QuoteForm.jsx
// משתמש בזה רק לתצוגה/קלט, לא לאחסון). ממיר-מספר טהור, ללא תלות ב-DOM,
// לכן ניתן לבדיקת-יחידה. עיגול ל-10 ספרות עשרוניות מונע רעש-float
// (למשל 1.235×100=123.49999999999999 בלי זה) מבלי לאבד דיוק אמיתי -
// הערכים הנתמכים (כגון 123.5/211.5 ס"מ) דורשים בדיוק שתי ספרות אחרי
// הנקודה במטרים.
export function cmToM(cm) {
  if (cm === '' || cm === null || cm === undefined) return '';
  const n = Number(cm);
  if (!Number.isFinite(n)) return '';
  return Math.round((n / 100) * 1e10) / 1e10;
}

export function mToCm(m) {
  if (m === '' || m === null || m === undefined) return '';
  const n = Number(m);
  if (!Number.isFinite(n)) return '';
  return Math.round(n * 100 * 1e10) / 1e10;
}

// חוק ברזל (§4/§10 - Public Quote compact summary, Owner-approved A46-style
// presentation "8 openings • 22.04 m²" נבנה מנתונים מובנים אמיתיים - לא
// מ-notes מפוענחים (customerFriendlySpec.js/professionalItemClassifier.js
// הישנים, שאינם קרואים כאן כלל). בונה רק את חלק-הספירה ("8 פתחים"/
// "8 openings", יחיד/רבים) - את "• Y מ"ר" הצרכן (PublicQuote.jsx/
// PublicQuoteEn.jsx) כבר בונה בעצמו (formatNum מקומי-לקובץ קיים שם).
// טהור, לא תלוי-DOM, לכן ניתן לבדיקת-יחידה.
export function getMeasurementCountLabel(count, isHebrew) {
  const n = Number(count) || 0;
  if (isHebrew) return `${n} ${n === 1 ? 'פתח' : 'פתחים'}`;
  return `${n} ${n === 1 ? 'opening' : 'openings'}`;
}

export function computeMeasurementArea(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return w * h;
}

// חוק ברזל (§7 - "item calculated quantity = sum of applicable calculated
// measurement rows"): מסכם רק שורות עם שטח/אורך תקין (מתעלם משורות חלקיות/
// ריקות בזמן הקלדה) - לא זורק שגיאה על שורה לא-שלמה, פשוט לא סופר אותה
// עדיין. חוק ברזל נוסף (§168, specification-vs-pricing-driving, 30.E):
// שורה עם is_pricing_driving===false (מפורש) מוצגת ללקוח אך לעולם לא
// נספרת - ברירת המחדל (undefined, כל השורות הקיימות מלפני התוספת הזו)
// היא true, זהה-בייט להתנהגות הקודמת. method אופציונלי (ברירת מחדל 'area')
// שומר תאימות-לאחור מלאה לכל קורא קיים שלא מעביר אותו.
export function sumMeasurementAreas(measurements, method) {
  const rows = Array.isArray(measurements) ? measurements : [];
  let total = null;
  for (const row of rows) {
    if (row && row.is_pricing_driving === false) continue;
    const area = row && row.calculated_area != null && row.calculated_area !== ''
      ? Number(row.calculated_area)
      : computeMeasurementValue(method || 'area', row?.width, row?.height);
    if (area != null && Number.isFinite(area)) {
      total = (total || 0) + area;
    }
  }
  return total;
}

// חוק ברזל (§7/§168 - specification-only data, 30.E "Pricing Unit ≠
// Specification Data"): specification מאוחסן כמערך {label,value} פשוט
// בתוך עמודת quote_items.specification jsonb הקיימת-אך-לא-מחווטת (Stage A) -
// שומר-סדר, free-form, תוויות שהמשתמש בעצמו מגדיר (לעולם לא רשימת-שדות
// קבועה באפליקציה) - בדיוק כוונת-העיצוב המקורית של "generic JSONB bag"
// ב-30.E. שורות ריקות (label וגם value ריקים) מסוננות כדי לא לשמור רעש.
export function normalizeSpecificationRows(specification) {
  if (!Array.isArray(specification)) return [];
  return specification
    .filter(row => row && (String(row.label || '').trim() || String(row.value || '').trim()))
    .map(row => ({ label: row.label || '', value: row.value || '' }));
}

// חוק ברזל (§155.8 item 3, Stage A): quote_items.quantity הקיים נשאר
// integer NOT NULL בלי לגעת בו - הכמות "הפעילה" בפועל לתמחור היא
// calculated_quantity כשהיא קיימת (בין אם חושבה או הוזנה ידנית), אחרת
// quantity הרגיל (פריט Simple). נקודת-קריאה יחידה לעובדה הזו - לא נוסחה
// עצמאית בכל צרכן (Dashboard.jsx preview/save, QuoteForm.jsx תצוגת-שורה).
export function getActiveQuantity(item) {
  if (!item) return 0;
  const cq = item.calculated_quantity;
  if (cq !== undefined && cq !== null && cq !== '') {
    const n = Number(cq);
    if (Number.isFinite(n)) return n;
  }
  return Number(item.quantity || 0);
}

// חוק ברזל (§168 - Project/Section hierarchy, 30.C): קיבוץ טהור, ללא-DOM,
// של items תחת ה-sections שלהם - נקודת-חישוב יחידה ש-QuoteForm.jsx (עריכה)
// ו-PublicQuote.jsx/PublicQuoteEn.jsx (תצוגת-לקוח) שניהם קוראים לה, כדי
// שהיגיון-הקיבוץ לא יתממש פעמיים בנפרד. item.section_key/section.key הם
// מזהה-הצטרפות מנורמל (id אמיתי אחרי טעינה/שמירה, tempKey לפני-שמירה
// חדש) - הצרכן (Dashboard.jsx) אחראי לשמור על עקביות ביניהם. items בלי
// section_key תואם נופלים ל"ללא קטגוריה" (unsectioned) - קבוצה אחרונה,
// ללא כותרת - זהה-בייט להתנהגות השטוחה הקיימת עבור הצעה בלי sections כלל.
export function groupItemsBySection(items, sections) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeSections = (Array.isArray(sections) ? sections : [])
    .slice()
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const sectionKeys = new Set(safeSections.map(s => s.key));
  const groups = safeSections.map(section => ({
    section,
    items: safeItems.filter(it => it.section_key && it.section_key === section.key),
  }));
  const unsectioned = safeItems.filter(it => !it.section_key || !sectionKeys.has(it.section_key));
  return { groups, unsectioned };
}

// עותק items עם quantity מוחלף בכמות הפעילה, לשימוש חד-פעמי לפני קריאה
// ל-calculateQuoteFinancials (regionConfig.js) - לא נוגע בפונקציה הקנונית
// עצמה, רק מנרמל את הקלט שלה, בדיוק כמו שכל צרכן קיים כבר עושה עם
// items גולמי.
export function withActiveQuantities(items) {
  return (items || []).map(it => ({ ...it, quantity: getActiveQuantity(it) }));
}
