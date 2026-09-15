// חוק ברזל (Final Smart Quote Merge + Rounding Remediation task - הבעלים
// מבטל במפורש את "ONE SAVED ITEM = ONE CUSTOMER-FACING ITEM ROW" כחוק
// מוחלט לתצוגת-לקוח, ומחליף אותו ב-CANONICAL SAVED ITEMS -> SAFE
// PRESENTATION GROUPING -> CUSTOMER VIEW): פונקציה טהורה, ללא-DOM, שמקבצת
// items קנוניים תואמים-לחלוטין לבלוק-תצוגה אחד ללקוח - ה-items הקנוניים
// עצמם (persistence/editor identity, ר' Dashboard.jsx/QuoteForm.jsx)
// נשארים נפרדים, בלתי-נגועים, לעולם לא נכתבים-מחדש/נמזגים בפועל. קיבוץ
// הוא תצוגה-בלבד - קורא יחיד: quotePresentationModel.js (לעולם לא
// DividedQuoteUnits.jsx עצמו, כדי לשמור על הארכיטקטורה הנדרשת: CANONICAL
// ITEMS -> PRESENTATION GROUPS -> DIVIDED QUOTE UI).
//
// "כשלא בטוח - אל תקבץ" (הדרישה המפורשת של המשימה): false-negative
// (שני items תואמים שנשארים נפרדים) מקובל; false-positive (מיזוג שגוי של
// items שונים מסחרית) אסור לחלוטין. לכן מפתח-ההתאמה דורש שוויון מדויק על
// כל שדה סמנטי-מסחרי בו-זמנית - אף לא שדה אחד מנוחש/מקורב.
import { getActiveQuantity, CALCULATION_METHODS } from './professionalQuoteItem';

// חוק ברזל (SQ-F04 closure, Codex fresh re-review, "ONE-PASS SMART QUOTE
// FINAL REMEDIATION" task): "Unrecognized legacy calculation-method values
// must not group" / "Unrecognized legacy quantity-source values must not
// group" - קודם hasRequiredGroupingFields בדק רק "האם השדה קיים" (isMissing),
// לא "האם הערך עצמו הוא אחד הערכים המוכרים". שני items ששניהם נושאים אותו
// ערך legacy לא-מוכר (למשל string ישן/משובש) היו "תואמים" רק כי המחרוזות
// זהות - בלי שום ערובה שהמשמעות האמיתית מאחורי ערך לא-מוכר אכן זהה. CALCULATION_
// METHODS הוא אותה רשימה קנונית יחידה כבר משמשת בכל הפרויקט (professionalQuoteItem.js) -
// לא רשימה שנייה כאן.
const RECOGNIZED_CALCULATION_METHODS = new Set(CALCULATION_METHODS.map((m) => m.id));
const RECOGNIZED_QUANTITY_SOURCES = new Set(['calculated', 'manual']);

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// חוק ברזל: specification חייב להיות זהה-לחלוטין (אותם label/value, אותו
// סדר) כדי לקבץ - הבדל-מפרט משמעותי לעולם לא "מנורמל" - ר' Part 7 (task
// prompt). specification ריק בשני האגפים = תואם (שניהם "אין מפרט").
function specificationSignature(specification) {
  const rows = Array.isArray(specification)
    ? specification.filter((s) => s && (String(s.label || '').trim() || String(s.value || '').trim()))
    : [];
  return JSON.stringify(rows.map((r) => [normalizeText(r.label), normalizeText(r.value)]));
}

// חוק ברזל (Part 3 - "at minimum require compatibility for..."): פריט זכאי
// לקיבוץ רק אם יש לו pricing_unit מפורש (פריט מקצועי/נמדד - לא פריט "מחיר
// כולל" פשוט, שאין לו סמנטיקת-כמות/מידה משותפת ברורה למיזוג בטוח) וגם
// total_price קנוני תקף (Part 5 - "missing/invalid/ambiguous stored totals
// should block grouping and preserve items separately").
function hasValidStoredTotal(item) {
  return toFiniteNumber(item?.total_price) !== null;
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

// חוק ברזל (SQ-F04, Codex Smart Quote P0/P1 review - "presentation grouping
// eligibility is too permissive in uncertain cases"): קודם compatibilityKey
// נפל-בחזרה ל-'' עבור calculation_method/quantity_source חסרים - שני items
// ששניהם חסרי-שדה היו "מתאימים" במקרה דרך אותו '' משותף, במקום להיחסם
// כ"לא-ודאי". זהו בדיוק המקרה ש-Codex מנה: "method is missing; quantity
// source is missing; rate is missing" - כל שדה חובה חסר חוסם זכאות-קיבוץ
// לגמרי (לא רק משנה את המפתח), כך שלעולם לא יכול להיווצר "התאמה במקרה".
function hasRequiredGroupingFields(item) {
  if (isMissing(item.calculation_method)) return false;
  if (isMissing(item.quantity_source)) return false;
  if (toFiniteNumber(item.price ?? item.unit_price) === null) return false;
  // SQ-F04 closure: a present-but-unrecognized value is exactly as unsafe
  // to trust as a missing one - "unrecognized legacy calculation-method/
  // quantity-source values must not group", even when two items happen to
  // share the identical unrecognized string.
  if (!RECOGNIZED_CALCULATION_METHODS.has(item.calculation_method)) return false;
  if (!RECOGNIZED_QUANTITY_SOURCES.has(item.quantity_source)) return false;
  return true;
}

// חוק ברזל (SQ-F04 - "measurement units conflict"): אף מפתח-התאמה קודם לא
// בדק בכלל את שדה .unit של שורות-המידה. פריט שבו שורות-המידה שלו עצמו
// חלוקות בין יחידות-מידה שונות (למשל m/cm מעורבים) הוא פנימית לא-עקבי -
// לעולם לא זכאי-קיבוץ. '' (ולא null) כשאין שורות-מידה כלל (vacuous, לא
// קונפליקט - פריט לא-נמדד לגיטימי, לדוגמה quantity_source==='manual').
function measurementUnitSignature(item) {
  const rows = Array.isArray(item?.measurements)
    ? item.measurements
    : (Array.isArray(item?.quote_item_measurements) ? item.quote_item_measurements : []);
  if (rows.length === 0) return '';
  const units = new Set(rows.map((r) => normalizeText(r?.unit || '')));
  if (units.size !== 1) return null;
  return [...units][0];
}

function isGroupingEligible(item) {
  if (!item || !item.pricing_unit || !hasValidStoredTotal(item)) return false;
  if (!hasRequiredGroupingFields(item)) return false;
  if (measurementUnitSignature(item) === null) return false;
  return true;
}

// מפתח-התאמה אחד, המכסה בו-זמנית: אותו שם מסחרי מנורמל, אותה שיטת-תמחור
// מפורשת, אותה יחידת-תמחור מפורשת, אותו קצב-מחיר במדויק (full precision,
// לא מעוגל), אותו מקור-כמות (calculated/manual - חוסם "SAME NAME,
// CALCULATED VS MANUAL" מ-Part 11), אותו מפרט תואם, ואותה יחידת-מידה
// (SQ-F04). שני items עם אותו מפתח = תואמים-לחלוטין; כל הבדל באחד השדות
// האלה = מפתחות שונים = לעולם לא מקובצים (Part 11 - כל מקרי-השלילה
// הנדרשים). קריאה למפתח מותנית ב-isGroupingEligible כבר לפני-כן (כל
// השדות המשמשים כאן כבר מובטחים לא-חסרים), אז אין כאן שום || '' נוסף.
function compatibilityKey(item) {
  const rate = toFiniteNumber(item.price ?? item.unit_price);
  return [
    normalizeText(item.description || item.name),
    item.pricing_unit,
    item.calculation_method,
    // חוק ברזל (SQ-F04 - "near-but-not-identical rates are normalized
    // together by fixed precision"): String(rate) הוא הייצוג הקנוני,
    // חסר-אובדן, של Number ב-JS (round-trip מדויק) - לא toFixed(6), שהוא
    // עיגול-קבוע שעלול תיאורטית להשוות שני קצבים שונים-במדויק זה מזה.
    String(rate),
    item.quantity_source,
    specificationSignature(item.specification),
    measurementUnitSignature(item),
  ].join('␟');
}

function finalizeGroup(members, firstIndex, key) {
  if (members.length === 1) {
    return { merged: false, members, key, firstIndex, combinedQuantity: null, groupTotal: null };
  }
  // חוק ברזל (Part 6 - "combined quantity/area may be shown only if
  // semantically safe... use canonical full-precision quantity/measurement
  // values... never sum already-rounded display strings"): getActiveQuantity
  // מחזיר את הכמות הקנונית המלאה (calculated_quantity אם קיים, אחרת
  // quantity) - מסתכם כאן, לפני כל עיגול-תצוגה. בטוח לחיבור-ליניארי כי
  // מפתח-ההתאמה כבר אכף אותו pricing_unit/calculation_method/quantity_source
  // בין כל החברים - שטח+שטח, אורך+אורך, כמות+כמות של אותה יחידה בדיוק.
  // חוק ברזל (SQ-F04 - "calculated quantity is invalid and falls back
  // unsafely"): getActiveQuantity עצמו נופל-בחזרה בשקט ל-quantity השטוח
  // כש-calculated_quantity אינו-תקין (NaN/לא-סופי) - נכון ומכוון לצורך
  // עדכון פיננסי (ר' SQ-F01), אבל לא כאן: combinedQuantity לתצוגה חייב
  // לזהות אי-תקינות כזו במפורש ולא "לבנות" ממנה כמות-משולבת מטעה. Part 4:
  // "do not fabricate a combined quantity... omit the combined quantity
  // if grouping is still independently safe" - הקיבוץ עצמו (merged:true)
  // עדיין תקף; רק combinedQuantity הופך ל-null.
  const activeQuantities = members.map((m) => {
    if (m.quantity_source === 'calculated') {
      const cq = m.calculated_quantity;
      // חוק ברזל (SQ-F04 closure, Codex fresh re-review): "quantity_source=
      // 'calculated' with calculated_quantity=null/empty must NOT fabricate
      // a combined quantity from flat quantity fallback." הבדיקה הקודמת
      // תפסה רק ערך-נוכח-אך-לא-תקין (NaN) כ"לא-תקין" - ערך חסר לגמרי
      // (undefined/null/'') נפל דרך ל-getActiveQuantity, שנופל-בחזרה בשקט
      // ל-quantity השטוח (בדיוק ה"בדיה" שהמשימה אוסרת). עכשיו "חסר" נחשב
      // זהה ל"לא-תקין" לצורך combinedQuantity בלבד - הקיבוץ עצמו (merged)
      // עדיין תקף כשכל שאר הסמנטיקה תואמת (Part 4/5), רק הכמות-המשולבת
      // מוצגת null במקום מספר בדוי.
      const missingOrInvalid = cq === undefined || cq === null || cq === '' || !Number.isFinite(Number(cq));
      if (missingOrInvalid) return null;
    }
    return getActiveQuantity(m);
  });
  const allFinite = activeQuantities.every((q) => Number.isFinite(q));
  const combinedQuantity = allFinite ? activeQuantities.reduce((a, b) => a + b, 0) : null;
  // חוק ברזל (Part 5 - "GROUP TOTAL = SUM OF CANONICAL STORED ITEM TOTALS...
  // do NOT recompute from combined displayed area x rate... reconstructed
  // measurements... synthetic merged-item pricing"): סכום total_price הקנוני
  // בלבד, כל חבר - שני items הגיעו לכאן רק אם שניהם עברו hasValidStoredTotal
  // כבר ב-isGroupingEligible, אז Number(...) בטוח כאן.
  const groupTotal = members.reduce((sum, m) => sum + Number(m.total_price), 0);
  return { merged: true, members, key, firstIndex, combinedQuantity, groupTotal };
}

// חוק ברזל (Part 8 - "SORT / ORDER LAW... first-occurrence ordering...
// the merged group occupies the position of its first canonical member"):
// עוברים על ה-items בסדר המקורי המדויק; קבוצה חדשה תמיד נוצרת במיקום
// ההופעה-הראשונה שלה; חבר תואם מאוחר יותר מצטרף לקבוצה הקיימת (לא יוצר
// מיקום חדש משלו) - כך "Window A -> Shower -> Window B" הופך בדיוק ל-
// "Combined Windows -> Shower", לעולם לא ממוין מחדש לפי שם/סכום/קצב.
export function buildPresentationGroups(items) {
  const list = Array.isArray(items) ? items : [];
  const slots = [];
  const keyToSlotIndex = new Map();

  list.forEach((item, idx) => {
    const eligible = isGroupingEligible(item);
    const key = eligible ? compatibilityKey(item) : null;
    if (eligible && keyToSlotIndex.has(key)) {
      slots[keyToSlotIndex.get(key)].members.push(item);
      return;
    }
    const slotIndex = slots.length;
    slots.push({ members: [item], firstIndex: idx, key });
    if (eligible) keyToSlotIndex.set(key, slotIndex);
  });

  return slots.map((s) => finalizeGroup(s.members, s.firstIndex, s.key));
}

// חוק ברזל (Part 3 - "Keep Unassigned items separate in this pass unless
// existing code already has an unambiguous real unit identity"): דלי "לא
// משויך" חסר-זהות-יחידה-אמיתית מטבעו - לעולם לא עובר קיבוץ בפועל בפאס הזה.
// עוטף כל item בקבוצה-יחיד (singleton) כדי ש-DividedQuoteUnits.jsx יוכל
// להשתמש באותו צינור-רינדור בדיוק ליחידות אמיתיות ול"לא משויך" כאחד, בלי
// שני מסלולי-קוד נפרדים.
export function wrapAsSingletonGroups(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item, idx) => ({ merged: false, members: [item], key: null, firstIndex: idx, combinedQuantity: null, groupTotal: null }));
}
