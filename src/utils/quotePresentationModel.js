// חוק ברזל (Smart Quote End-to-End Structural Unification task, Part B -
// "create/reuse one pure, testable representation of a quote for
// presentation"): נקודת-אמת יחידה ל"האם ההצעה מחולקת, ומה בתוך כל
// יחידה" - הצרכן הראשון ש-QuoteForm.jsx (עורך) ו-PublicQuote.jsx/
// PublicQuoteEn.jsx (תצוגת-לקוח/הדפסה/PDF, שכן ה-DOM שלהן עצמן נלכד
// ישירות ל-Print/PDF - ר' generateQuotePdf.js/QuotePrintModeModal.jsx,
// אין נתיב-רינדור נפרד לPrint/PDF כלל) קוראים לו - אף אחד מהם לא בונה
// קיבוץ/סכום-ביניים באופן עצמאי משלו. הקיבוץ עצמו עובר תמיד דרך
// groupItemsBySection (professionalQuoteItem.js), אף פעם לא נכתב-מחדש
// כאן.
//
// שתי צורות-קלט אמיתיות וחייבות-להישאר-שונות (Decision 15 - "unit
// subtotal must derive from the SAME CANONICAL item amounts used by the
// quote subtotal", לעולם לא נוסחה שלישית עצמאית):
//   - editor (buildEditorPresentationModel): items במצב-עריכה חי, לפני
//     שמירה - total_price לא בהכרח מעודכן/קיים על פריט לא-שמור. הסכום
//     הקנוני הוא בדיוק מה ש-Dashboard.jsx עצמו מחשב לפני שמירה
//     (calculateQuoteFinancials + withActiveQuantities).
//   - customer (buildCustomerPresentationModel): items שכבר נשמרו/נטענו
//     (מ-get-public-quote, או מה-form אחרי טעינת-עריכה) - total_price
//     הוא הסכום הקנוני שכבר חושב ונשמר בפועל; מסתכמים אותו ישירות,
//     לעולם לא מחשבים-מחדש כמות×מחיר בשכבת-התצוגה.
//
// שתי הבנייה מייצרות את אותה צורת-פלט בדיוק, כך שכל שכבת-רינדור
// (UnitCard, PublicQuote, ובעקיפין Print/PDF) אדישה למקור הנתונים.
import { groupItemsBySection, withActiveQuantities } from './professionalQuoteItem';
import { calculateQuoteFinancials } from './regionConfig';
import { buildPresentationGroups } from './presentationGrouping';

// חוק ברזל: יחידה "אמיתית" היא כזו עם שם לא-ריק בלבד - יחידה זמנית-
// חדשה-ללא-שם-עדיין (tempKey, לפני ששם הוזן) אינה הופכת הצעה ל"מחולקת"
// (Structure-First task, Decision 9's own inference rule, נשמר תואם).
export function isQuoteDivided(sections) {
  return Array.isArray(sections) && sections.some((s) => (s?.name || '').trim() !== '');
}

function sumTotalPrice(items) {
  return (items || []).reduce((sum, it) => {
    const explicit = it.total_price;
    if (explicit !== undefined && explicit !== null && explicit !== '') return sum + Number(explicit);
    // חוק ברזל: נפילה-חזרה בלבד לפריט-לקוח ישן/שטוח בלי total_price
    // מפורש - זהה לנוסחת ה-fallback הקיימת כבר ב-PublicQuote.jsx עצמו
    // (rawQty * itemPrice), לא נוסחה שלישית.
    return sum + Number(it.quantity || 1) * Number(it.price || 0);
  }, 0);
}

function computeEditorSubtotal(items) {
  return calculateQuoteFinancials({ items: withActiveQuantities(items), discount: 0 }).enteredSubtotal;
}

function buildModel(items, sections, { itemKeyField, sectionKeyField, computeSubtotal }) {
  const safeItems = Array.isArray(items) ? items : [];
  const divided = isQuoteDivided(sections);

  if (!divided) {
    return {
      isDivided: false,
      units: [],
      unassignedItems: safeItems,
      quoteSubtotal: computeSubtotal(safeItems),
    };
  }

  const { groups, unsectioned } = groupItemsBySection(safeItems, sections, { itemKeyField, sectionKeyField });
  const units = groups
    // חוק ברזל: יחידה בלי שם ממשי (tempKey טרי, טרם-נקרא) אינה מוצגת
    // כיחידת-תצוגה עצמאית - פריטיה (אם בכלל יש, מקרה-קצה בלתי-סביר) מוצגים
    // תחת unassigned, לא תחת כותרת ריקה. תואם ל-isQuoteDivided למעלה.
    .filter((g) => (g.section?.name || '').trim() !== '')
    .map((g) => ({
      id: g.section.id ?? g.section.key,
      key: g.section.key ?? g.section.id,
      title: g.section.name,
      items: g.items,
      itemCount: g.items.length,
      subtotal: computeSubtotal(g.items),
      // חוק ברזל (Final Smart Quote Merge + Rounding Remediation task -
      // "CANONICAL SAVED ITEMS -> SAFE PRESENTATION GROUPING -> CUSTOMER
      // VIEW"): נגזרת-תצוגה-בלבד מ-items הקנוניים למעלה, לא מחליפה/מוחקת
      // אותם - כל צרכן קיים שממשיך לקרוא ל-.items (למשל, אם יתווסף בעתיד)
      // ממשיך לראות בדיוק את הרשימה השטוחה המקורית. רק DividedQuoteUnits.jsx
      // (תצוגת-לקוח) קורא ל-presentationGroups בפועל; QuoteForm.jsx (עורך)
      // אינו קורא ל-buildEditorPresentationModel כלל (ר' הערתו שם) ולכן
      // אינו מושפע.
      presentationGroups: buildPresentationGroups(g.items),
    }));
  const unnamedGroupItems = groups
    .filter((g) => (g.section?.name || '').trim() === '')
    .flatMap((g) => g.items);

  return {
    isDivided: true,
    units,
    unassignedItems: [...unsectioned, ...unnamedGroupItems],
    quoteSubtotal: computeSubtotal(safeItems),
  };
}

// Editor shape: item.section_key / section.key (tempKey pre-save, real id
// post-save) - see QuoteForm.jsx.
export function buildEditorPresentationModel(items, sections) {
  return buildModel(items, sections, { itemKeyField: 'section_key', sectionKeyField: 'key', computeSubtotal: computeEditorSubtotal });
}

// Customer/persisted shape: item.section_id / section.id - see
// get-public-quote/index.ts's own response contract, consumed by
// PublicQuote.jsx/PublicQuoteEn.jsx (and, via the same DOM, Print/PDF).
export function buildCustomerPresentationModel(items, sections) {
  return buildModel(items, sections, { itemKeyField: 'section_id', sectionKeyField: 'id', computeSubtotal: sumTotalPrice });
}
