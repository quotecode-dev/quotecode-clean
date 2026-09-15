import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { getActiveQuantity, getProfessionalUnitLabel, formatMeasurementLine } from '../utils/professionalQuoteItem';
import { wrapAsSingletonGroups } from '../utils/presentationGrouping';

// חוק ברזל (Smart Quote Final Visual Correction task - "ONE DISCLOSURE
// CONTROL PER UNIT. ZERO ITEM-LEVEL DISCLOSURE CONTROLS.", RE-CONFIRMED
// and CLARIFIED by the Smart Quote Final Closure task, and RE-CONFIRMED
// again by the Final Claude Builder task after Codex root-cause review):
// נקודת-רינדור יחידה לתצוגת יחידות/דירות בהצעת-מחיר מחולקת ללקוח - היחיד
// שנקרא הן מ-PublicQuote.jsx (HE) הן מ-PublicQuoteEn.jsx (EN), הן
// ל-Compact הן ל-Expanded (mode prop) - כדי שהתיקון הזה יתקיים במקום אחד
// יחיד (ר' PROFLOW_ARCHITECTURE.md §28 "One Quote Model, Many Views").
//
// היררכיה סופית - הוחלפה (Final Smart Quote Merge + Rounding Remediation
// task, Part 1 - הבעלים מבטל במפורש את חוק "ONE SAVED ITEM = ONE
// CUSTOMER-FACING ITEM ROW" שהיה מוחלט עד כה, ומחליף אותו ב-"CANONICAL
// SAVED ITEMS -> SAFE PRESENTATION GROUPING -> CUSTOMER VIEW"): items
// קנוניים תואמים-לחלוטין (ר' presentationGrouping.js למפתח-ההתאמה המדויק)
// מוצגים כבלוק-לקוח אחד; items קנוניים עצמם, ה-DB, וזהות-העריכה נשארים
// נפרדים לחלוטין - הקיבוץ הוא תצוגה-בלבד, מחושב תמיד ב-
// quotePresentationModel.js (presentationGroups), לעולם לא כאן. UNIT
// DISCLOSURE נשאר בקר-הגילוי היחיד ללא שינוי - כשהיחידה פתוחה, כל
// PRESENTATION GROUP (בין אם יחיד ובין אם ממוזג) מוצג כבלוק נפרד משלו, עם
// המידות/המפרט שלו תמיד גלויים inline - ZERO בקר-גילוי נוסף, לא ברמת-
// group ולא ברמת-item.
//
// תיקון-חזות (Final Claude Builder task after Codex root-cause review -
// "root cause: this is a technical <table>, not primarily a CSS override
// bug"): כל המבנה מבוסס-<table>/<thead> הוחלף בכרטיסי-תצוגה (card markup)
// לפי השפה החזותית המאושרת. הפניה חזותית-בלבד: CustomerQuoteItemRow.jsx
// (וריאנט B סיפק את נוסח בקר-הגילוי היחיד ברמת-יחידה - "פירוט מידות
// ומפרט"/"Measurements & specification"; דפוס "שורות צפופות בתוך מיכל-
// משותף אחד" מוריאנט B+; סמנטיקת "תמיד-גלוי, בלי toggle" מוריאנט C) -
// בלי לייבא state/פרסור/הנחות-עברית-מוצמדת/הנחות-שקל-מוצמד ספציפיים
// לדמו הזה (אותו קובץ, customerFriendlySpec.js, נשאר לא-בשימוש כאן בכוונה
// כי הוא מוצמד לעברית/₪). שום prop/state קיים לא השתנה - הבסיס החזותי הזה
// קפוא ב-Part 12 של המשימה הנוכחית.
//
// חוק ברזל חדש - עיגול-כסף ללקוח (Part 9, מתוקן ב-"Urgent Money Format
// Correction" task - הכלל הנכון הוא "עגל לשקל שלם, ואז הצג תמיד עם שתי
// ספרות אחרי הנקודה" - כלומר ₪7,659.00, לעולם לא ₪7,659 בלי נקודה ולעולם
// לא ₪7,658.82 עם אגורות אמיתיות): formatNum (מוזרק) ממשיך לשמש אך ורק
// למספרים לא-כספיים (כמות/שטח/מידה - לעולם לא מעוגל לשלם, אחרת "12.55
// מ"ר" היה נהרס). formatMoneyDisplay (מוזרק בנפרד, ברירת-מחדל formatNum
// לתאימות-לאחור) הוא ורק הוא שמעצב סכומי-₪/מטבע בפועל (מחיר-יחידה, סה"כ-
// פריט/קבוצה, סה"כ-יחידה) - כדי ש-PublicQuote.jsx (HE/ILS) יזריק את
// formatWholeMoney (utils/money.js - עיגול-לשקל-שלם ואז שתי-ספרות-קבועות)
// ו-PublicQuoteEn.jsx (International) ימשיך להזריק את formatNum הרגיל
// (דיוק-אגורות/סנט מלא, ללא שינוי) - אותו רכיב-רינדור יחיד משרת שתי חוקי-
// עיגול שונים בלי branch לפי isHebrew כאן בכלל.
function normalizeSpecRows(specification) {
  return Array.isArray(specification) ? specification.filter((s) => s.label || s.value) : [];
}

// חוק ברזל (Final Money Place-Value Alignment Fix task - Codex root-cause:
// a per-row min-width guess does NOT create one shared numeric column when
// (a) each row lives in an independently-positioned container with its own
// insets and (b) money tokens across roles use different font sizes -
// shared WIDTH alone cannot fix a METRICS mismatch, and a METRICS fix alone
// cannot fix a GEOMETRY mismatch; both are required together):
// - NUMERIC METRICS: every comparable money token (unit header total, item/
//   group amount, unit footer subtotal, Unassigned total) now shares the
//   exact same font-size/weight here (MONEY_TOKEN_FONT_STYLE) - titles keep
//   their own independent typography, only the money GLYPHS are normalized,
//   so "ones under ones" holds digit-by-digit, not just at the string's
//   outer edges.
// - SHARED GEOMETRY: --pq-money-column-width (index.css's .pq-money-cell)
//   is computed ONCE, in JS, for the whole currently-rendered divided-quote
//   region - the widest real rendered .pq-money-token, remeasured after
//   every render and once more after document.fonts.ready (never derived
//   from character count/ch alone, never per-row).
// - PHYSICAL INSET COMPENSATION: the unit header row and the Unassigned
//   label row both use horizontal padding 16px, while every item/group/
//   unit-footer row uses 14px - a real, pre-existing, approved layout
//   difference this task must NOT alter (titles must not move). Since the
//   money slot is the flex "end" item and space-between pins it flush to
//   its OWN container's inner edge, a fixed shared width alone would still
//   leave the 16px-padded rows' slot 2px further right than the 14px-padded
//   rows'. HEADER_MONEY_INSET_COMPENSATION_PX (applied via MoneyCell's
//   wideInsetRow flag, used by both the header and the Unassigned label
//   row) corrects ONLY those two rows' money wrapper - a structural, role-
//   scoped constant, never a per-value/per-amount hack - so its physical
//   right edge lands on the exact same line as every 14px-padded row's.
const MONEY_TOKEN_FONT_STYLE = { fontWeight: 800, fontSize: '0.92rem' };
const HEADER_ROW_INSET_PX = 16;
const ITEM_ROW_INSET_PX = 14;
const HEADER_MONEY_INSET_COMPENSATION_PX = -(HEADER_ROW_INSET_PX - ITEM_ROW_INSET_PX);

// עטיפת-סכום משותפת אחת - התא (pq-money-cell, רוחב-משותף קבוע מה-CSS var
// שמחושב ב-DividedQuoteUnits עצמו) עוטף את ה-token (pq-money-token, מנותק-
// LTR/tabular-nums/מטריקה משותפת). wideInsetRow הוא הדגל היחיד שמפעיל את
// פיצוי-ה-inset הפיזי למעלה (לשורות עם padding אופקי 16px - כותרת-יחידה
// וכותרת-"לא משויך" כאחד, לעומת 14px בכל שורת-פריט/סה"כ-יחידה) - שום ערך/
// סכום ספציפי לא משפיע על הרוחב/המיקום, זהו קבוע מבני-תפקיד יחיד.
//
// חוק ברזל (EN money-column alignment fix, Codex fresh re-review, "ONE-PASS
// SMART QUOTE FINAL REMEDIATION" task - "direction-independent compensation
// currently applied where direction-sensitive compensation is required"):
// שלושה ניסויים אמיתיים ב-DOM (browser-harness, לא ניחוש):
// (1) ב-HE (RTL) התא הכספי נוחת פיזית בצד **שמאל** - marginLeft:-2px הוא
//     הפיצוי הנכון שם (כותרת+פריט: 0px spread, נמדד ואומת - ללא שינוי).
// (2) ב-EN (LTR) התא הכספי נוחת פיזית בצד **ימין** - marginLeft (בכל
//     סימן) נמדד כחסר-השפעה לחלוטין על מיקומו (0px ו-+2px נתנו את אותה
//     תוצאה בדיוק, right=836) - כי margin-left פועל בצד השמאלי-הפיזי של
//     התא, שאינו הצד הרלוונטי כשהתא צמוד לגבול-ה-padding הימני-הפיזי של
//     השורה. (3) marginRight:-2px ב-LTR כן הזיז את הקופסה בפועל (right
//     836->838, נמדד) - שולי שליליים בצד הפיזי שבו התא-הכספי בפועל נוגע
//     בגבול-ה-padding הם המנגנון הנכון לחרוג 2px מעבר ל-padding-inset
//     העודף (16px מול 14px), בשני הכיוונים כאחד - רק שהצד הפיזי הרלוונטי
//     הפוך בין השפות (שמאל ב-RTL, ימין ב-LTR), בדיוק כפי שנמדד. אין כאן
//     "רוחב/spacing/typography/מבנה-כרטיס" חדש - אך ורק תיקון equivalent-
//     but-direction-aware לאותו פיצוי-מבני קיים, מותנה ב-isHebrew.
function MoneyCell({ currencySymbol, amount, formatMoneyDisplay, color, whiteSpace = 'nowrap', wideInsetRow = false, isHebrew = true }) {
  return (
    <span
      className="pq-money-cell"
      style={wideInsetRow
        ? (isHebrew
          ? { marginLeft: `${HEADER_MONEY_INSET_COMPENSATION_PX}px` }
          : { marginRight: `${HEADER_MONEY_INSET_COMPENSATION_PX}px` })
        : undefined}
    >
      <span className="pf-money pq-money-token" style={{ ...MONEY_TOKEN_FONT_STYLE, color, whiteSpace }}>
        {currencySymbol}{formatMoneyDisplay(amount)}
      </span>
    </span>
  );
}

// נגזר-תצוגה יחיד מ-presentation group אחד (יחיד או ממוזג) - מחזיר בדיוק
// את השדות ש-GroupBlock צריך לרנדר, בלי לגעת ב-item(ים) הקנוני(ים) עצמם.
// group יחיד (merged===false) מייצר תוצאה זהה-בייט לחישוב הפר-פריט הישן
// (המקרה השכיח ביותר - אין שום רגרסיה חזותית לפריט שלא מוזג).
function buildGroupDisplayData(group, isHebrew, formatNum) {
  const first = group.members[0];
  const isPro = Boolean(first.pricing_unit);
  const unitLabel = isPro ? getProfessionalUnitLabel(first.pricing_unit, isHebrew) : '';
  const itemPrice = Number(first.price ?? first.unit_price ?? 0);
  const measurements = group.members.flatMap((m) => (Array.isArray(m.measurements) ? m.measurements : []));
  const specRows = normalizeSpecRows(first.specification);

  let qtyText = null;
  if (group.merged) {
    // חוק ברזל (Part 6 - "if quantity semantics are not safely additive,
    // omit the combined quantity rather than fabricate it"): combinedQuantity
    // כבר null אם presentationGrouping.js לא הצליח לחשב אותו בבטחה.
    if (group.combinedQuantity != null) {
      qtyText = isPro
        ? `${formatNum(group.combinedQuantity)} ${unitLabel}`
        : `${formatNum(group.combinedQuantity)} ${isHebrew ? 'יח׳' : 'pcs'}`;
    }
  } else {
    const rawQty = Number(first.quantity || 1);
    const activeQty = isPro ? getActiveQuantity({ quantity: first.quantity, calculated_quantity: first.calculated_quantity }) : rawQty;
    qtyText = isPro ? `${formatNum(activeQty)} ${unitLabel}` : `${rawQty} ${isHebrew ? 'יח׳' : 'pcs'}`;
  }

  // חוק ברזל (Part 5 - "GROUP TOTAL = SUM OF CANONICAL STORED ITEM TOTALS"):
  // group.groupTotal כבר מחושב ב-presentationGrouping.js בדיוק ככה עבור
  // group ממוזג; group יחיד ממשיך עם אותו fallback הקיים כבר לפני המשימה
  // הזו (total_price הקנוני, אחרת activeQty*itemPrice).
  const totalPrice = group.merged
    ? group.groupTotal
    : (first.total_price ?? (getActiveQuantity(first) * itemPrice));

  return {
    title: first.description || first.name || (isHebrew ? 'פריט' : 'Item'),
    itemPrice,
    totalPrice,
    qtyText,
    measurements,
    specRows,
  };
}

// בלוק-פריט/קבוצה אחד (כרטיס-דחוס בתוך מיכל היחידה המשותף) - כותרת+סכום
// הם הזוג הראשי (primary pair), כמות/מידה ומחיר-יחידה הם טקסט משני
// (subordinate), מידות/מפרט (אם יש) תמיד גלויים מתחתיהם - ZERO בקר-גילוי
// כלשהו ברמת-group. משותף ליחידה אמיתית ולדלי "לא משויך" (Expanded, שם כל
// group הוא תמיד יחיד - ר' wrapAsSingletonGroups). class="pq-unit-item" -
// יעד scoped לחסימת-פיצול-עמוד ב-PDF/Print, ברמת group בודד בלבד (לעולם
// לא ברמת-יחידה שלמה - ר' generateQuotePdf.js).
function GroupBlock({ group, isHebrew, currencySymbol, formatNum, formatMoneyDisplay, isLast }) {
  const { title, itemPrice, totalPrice, qtyText, measurements, specRows } = buildGroupDisplayData(group, isHebrew, formatNum);
  const hasDetails = measurements.length > 0 || specRows.length > 0;

  return (
    <div className="pq-unit-item" style={{ padding: '10px 14px', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b', minWidth: 0 }}>
          {title}
        </span>
        <MoneyCell currencySymbol={currencySymbol} amount={totalPrice} formatMoneyDisplay={formatMoneyDisplay} color="#1e293b" />
      </div>
      <div style={{ marginTop: '2px', fontSize: '0.78rem', color: '#6b6580' }}>
        {qtyText && (<>{qtyText}{' · '}</>)}
        {currencySymbol}{formatMoneyDisplay(itemPrice)} {isHebrew ? 'ליחידה' : 'each'}
      </div>
      {/* חוק ברזל: מידות/מפרט תמיד גלויים כאן כשהיחידה פתוחה - ZERO בקר-
          גילוי פר-group, לא כפתור, לא chevron, לא קישור. כל המידות מכל
          החברים המקוריים (סדר-הופעה מקורי, ללא דה-דופליקציה - Part 7). */}
      {hasDetails && (
        <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#475569' }}>
          {measurements.length > 0 && (
            <div style={{ marginBottom: specRows.length > 0 ? '4px' : 0 }}>
              {measurements.map((m, mi) => (
                <div key={mi}>{formatMeasurementLine(m, isHebrew, formatNum)}</div>
              ))}
            </div>
          )}
          {specRows.length > 0 && (
            <div>
              {specRows.map((s, si) => (
                <div key={si}>{s.label}{s.label && s.value ? ': ' : ''}{s.value}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// בלוקי-group משותפים (יחידה אמיתית + דלי "לא משויך" ב-Expanded) - קבוצות
// כבר מחושבות (presentationGroups מ-quotePresentationModel.js ליחידה
// אמיתית; wrapAsSingletonGroups ל"לא משויך" - ר' Part 3, לעולם לא מקובץ
// בפאס הזה) - כאן רק ממפים לתצוגה, בסדר-ההופעה-הראשונה המדויק שכבר נקבע
// (Part 8). מיכל-משותף אחד (בלי כרטיס נפרד לכל group) - השורה האחרונה
// בלי קו-הפרדה.
function GroupBlocks({ groups, isHebrew, currencySymbol, formatNum, formatMoneyDisplay }) {
  const list = groups || [];
  return list.map((group, idx) => (
    <GroupBlock
      key={group.members[0]?.id || group.firstIndex || idx}
      group={group}
      isHebrew={isHebrew}
      currencySymbol={currencySymbol}
      formatNum={formatNum}
      formatMoneyDisplay={formatMoneyDisplay}
      isLast={idx === list.length - 1}
    />
  ));
}

export default function DividedQuoteUnits({ units, unassignedItems, mode, resetToken, isHebrew, currencySymbol, formatNum, formatMoneyDisplay }) {
  const [collapsedUnits, setCollapsedUnits] = useState(() => Object.fromEntries(units.map((u) => [u.id, mode === 'compact'])));
  // חוק ברזל: ברירת-מחדל formatNum עצמו כשההורה לא מזריק formatMoneyDisplay
  // (תאימות-לאחור לכל קורא/בדיקה קיימים) - זהה-בייט להתנהגות-לפני-המשימה
  // הזו (2 ספרות אחרי הנקודה בכל מקום).
  const moneyFmt = formatMoneyDisplay || formatNum;

  // חוק ברזל (Final Money Place-Value Alignment Fix task - "shared minimum
  // width... measure actual formatted money tokens... determine the widest
  // rendered token... assign one shared width to the divided quote root...
  // resolve after fonts are ready... recalculate when relevant quote
  // content changes"): מדידה אמיתית ב-DOM, לא ניחוש לפי אורך-מחרוזת. רץ
  // אחרי כל render (שאילתה זולה - כמה עשרות elements לכל היותר) וגם שוב
  // אחרי document.fonts.ready (המדידה הראשונה עלולה לקרות עם גופן-חלופה
  // עוד לפני שהגופן האמיתי נטען, ולתת רוחב שגוי-מעט). מכסה מיחידות
  // מכווצות (הכותרת שלהן תמיד ב-DOM) ומיחידות פתוחות (הפריטים שלהן
  // מצטרפים ל-DOM ברגע הפתיחה, ומודדים ב-render הבא באופן טבעי).
  const rootRef = useRef(null);
  const [moneyColumnWidth, setMoneyColumnWidth] = useState(null);

  const measureMoneyColumn = () => {
    const root = rootRef.current;
    if (!root) return;
    const tokens = root.querySelectorAll('.pq-money-token');
    let max = 0;
    tokens.forEach((el) => {
      if (el.scrollWidth > max) max = el.scrollWidth;
    });
    if (max > 0) {
      setMoneyColumnWidth((prev) => (prev !== max ? max : prev));
    }
  };

  useLayoutEffect(() => {
    measureMoneyColumn();
  });

  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureMoneyColumn).catch(() => {});
    }
  }, []);

  // חוק ברזל (Final Smart Quote Correction task - Codex P0-4 "DETERMINISTIC
  // COMPACT/EXPANDED EXPORT"): התלות היא resetToken (מונה שהאב מעלה בכל
  // בחירה מפורשת מה-modal), לא mode עצמו - כדי שבחירת אותו mode פעמיים
  // ברצף (למשל Compact ואז שוב Compact) תמיד תאפס מחדש מצב-קיפול שנפתח
  // ידנית בין הבחירות, ולא "תדלוף" לתוך פלט-Print/PDF הבא. mode עדיין
  // קובע את ערך-האיפוס עצמו (collapsed ל-compact, open ל-expanded).
  useEffect(() => {
    setCollapsedUnits(Object.fromEntries(units.map((u) => [u.id, mode === 'compact'])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken, mode]);

  const toggleUnit = (id) => setCollapsedUnits((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    // חוק ברזל (PDF/Print Document Safety Contract - "ATOMIC DOCUMENT
    // BLOCKS MUST NEVER SPLIT ACROSS PAGES" scoped to the SMALLEST
    // meaningful block, ONE-PASS SMART QUOTE FINAL REMEDIATION task, real
    // root cause of the Owner's video-observed "nearly-empty first page /
    // extra page" defect). This ROOT wrapper previously ALSO carried
    // `pq-section` - treating EVERY unit (all 3 of them, plus Unassigned)
    // as ONE single giant atomic "must not split" block. A page boundary
    // that would land anywhere inside that combined region pushed the
    // ENTIRE divided-quote content to the next page, leaving whatever came
    // before it (header/recipient) alone on a mostly-empty first page -
    // exactly the "massive unused whitespace caused by over-broad
    // break-inside:avoid on a huge parent block" failure class this
    // contract explicitly names. Fixed by removing `pq-section` from THIS
    // root (so multiple separate units CAN now flow across a page break
    // between them, exactly as they should) and adding it instead to EACH
    // individual unit's own wrapper (below) and to the Unassigned bucket's
    // own wrapper - the atomic boundary is now scoped to one unit card at a
    // time, never the whole region. `rootRef`'s own money-column-width
    // measurement (`measureMoneyColumn`, above) is unaffected - it already
    // queries `.pq-money-token` directly, never depends on this class.
    <div
      ref={rootRef}
      style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px', '--pq-money-column-width': moneyColumnWidth ? `${moneyColumnWidth}px` : 'auto' }}
    >
      {units.map((unit) => {
        const collapsed = !!collapsedUnits[unit.id];
        // חוק ברזל (Part 4 - "every canonical input item must belong to
        // exactly one presentation group"): quotePresentationModel.js כבר
        // חישב presentationGroups; fallback ל-wrapAsSingletonGroups(unit.items)
        // הוא רק הגנת-תאימות-לאחור למקרה תיאורטי שהמודל לא סופק (למשל
        // בדיקת-רכיב ישנה שמזריקה unit ידני בלי השדה החדש) - לא נתיב-קיבוץ
        // שני עצמאי.
        const groups = Array.isArray(unit.presentationGroups) ? unit.presentationGroups : wrapAsSingletonGroups(unit.items);
        return (
          // חוק ברזל (CORRECTIVE ADDENDUM: PRINT/PDF STATIC-DOCUMENT CLEANUP
          // task): pq-unit-collapsed/pq-unit-expanded מוסיף רק סמן-מבנה
          // ל-CSS פרינט/PDF-בלבד למטה (מסתיר את כפילות-הסה"כ בכותרת כשהיחידה
          // פתוחה בפלט סטטי) - לא משפיע על שום דבר במסך האינטראקטיבי הרגיל.
          // חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task, real Owner-
          // video evidence of excessive Download-PDF dead space): pq-unit-card
          // מסמן את היחידה כבלוק "רך" (soft) עבור generateQuotePdf.js - עדיין
          // pq-section לצורך הגנת break-inside:avoid בהדפסה טבעית (לא נגוע
          // במשימה הזו) ולצורך ה-padding המשותף במובייל, אך generateQuotePdf.js
          // כעת מזהה pq-unit-card במפורש ומחריג אותו מרשימת "הגנה קשיחה תמיד"
          // (tr/.pq-unit-item/.pq-recipient/.pq-header-box, וכל .pq-section
          // אחר) - יחידה שלמה מוזזת לעמוד הבא רק אם הבזבוז הנובע מכך קטן/שווה
          // ל-22% מגובה עמוד; אחרת מותר לה "להיפרץ" בגבול-פריט (.pq-unit-item
          // עצמו נשאר תמיד מוגן, לעולם לא נפרץ פנימה).
          <div key={unit.id} className={`pq-section pq-unit-card${collapsed ? ' pq-unit-collapsed' : ' pq-unit-expanded'}`} style={{ border: '1px solid #e4e1ee', borderRadius: '12px', background: '#ffffff', overflow: 'hidden' }}>
            {/* בקר-הגילוי היחיד של היחידה הזו - שם-יחידה, סה"כ-יחידה, ובקר-
                גילוי אחד גלוי (טקסט-פעולה סגול מאושר, לא chevron טכני
                בלבד) - שלושה יסודות-תצוגה נפרדים, בקר לחיצה אחד יחיד
                (Final Claude Builder task - "CLOSED UNIT VISUAL CONTRACT").
                aria-label נשמר בדיוק כפי שהיה, כדי לשמר תאימות-נגישות
                ותאימות-בדיקות קיימת. */}
            {/* חוק ברזל (Final Public Quote Restoration task - "RTL SIDE
                OWNERSHIP - HARD LOCK"): שם-יחידה = ימין, סה"כ-יחידה = שמאל
                ב-HE. */}
            <button
              type="button"
              onClick={() => toggleUnit(unit.id)}
              dir={isHebrew ? 'rtl' : 'ltr'}
              aria-label={collapsed ? (isHebrew ? 'הרחב יחידה' : 'Expand unit') : (isHebrew ? 'כווץ יחידה' : 'Collapse unit')}
              style={{
                width: '100%', display: 'flex', flexDirection: 'column', gap: '4px',
                padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: isHebrew ? 'right' : 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                <span className="pq-unit-title" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', minWidth: 0 }}>{unit.title}</span>
                <span className="pq-unit-head-total">
                  <MoneyCell currencySymbol={currencySymbol} amount={unit.subtotal} formatMoneyDisplay={moneyFmt} color="#1e293b" wideInsetRow isHebrew={isHebrew} />
                </span>
              </span>
              {/* חוק ברזל (CORRECTIVE ADDENDUM task - "INTERACTIVE DISCLOSURE
                  CONTROLS = SCREEN ONLY"): pq-unit-disclosure - בקר אינטראקטיבי
                  (chevron + טקסט Show/Hide) שמשמעותי רק על המסך החי; מוסתר
                  ב-PDF/פרינט הסטטיים (CSS למטה ב-PublicQuote.jsx/PublicQuoteEn.jsx)
                  בלי להשאיר רווח ריק (display:none מלא, לא visibility). */}
              <span className="pq-unit-disclosure" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7c3aed', fontSize: '0.82rem', fontWeight: 600 }}>
                <ChevronDown size={14} style={{ flexShrink: 0, transform: collapsed ? (isHebrew ? 'rotate(90deg)' : 'rotate(-90deg)') : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                {collapsed ? (isHebrew ? 'פירוט מידות ומפרט' : 'Measurements & specification') : (isHebrew ? 'הסתר מידות ומפרט' : 'Hide measurements & specification')}
              </span>
            </button>

            {!collapsed && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <GroupBlocks groups={groups} isHebrew={isHebrew} currencySymbol={currencySymbol} formatNum={formatNum} formatMoneyDisplay={moneyFmt} />
                </div>
                <div className="pq-unit-foot-total" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid #f1f5f9', background: '#faf9fd' }} dir={isHebrew ? 'rtl' : 'ltr'}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#6b6580', minWidth: 0 }}>
                    {isHebrew ? `סה"כ ${unit.title}` : `Total ${unit.title}:`}
                  </span>
                  <MoneyCell currencySymbol={currencySymbol} amount={unit.subtotal} formatMoneyDisplay={moneyFmt} color="#1e293b" />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* דלי "לא משויך" (Decision 8, editor-side) - תמיד גלוי, אף פעם לא
          ניתן-לקיפול (אין "יחידה" אמיתית כאן לקפל). חוק ברזל (Codex P0-5
          "UNASSIGNED ITEMS IN COMPACT"): ב-Compact מציג רק סיכום (שם +
          סה"כ) - ZERO בלוקי-פריט, בדיוק כמו יחידה אמיתית מכווצת. ב-
          Expanded מציג כל item בנפרד (Part 3 - "לא משויך" חסר-זהות-יחידה-
          אמיתית, לעולם לא מקובץ בפאס הזה - wrapAsSingletonGroups), אותו
          כלל בדיוק כמו יחידה אמיתית, ובאותה שפת-כרטיס מאושרת - לעולם לא
          נשמט מהסכומים. הסכום מחושב מ-total_price הקנוני, לעולם לא נוסחה
          חדשה. */}
      {Array.isArray(unassignedItems) && unassignedItems.length > 0 && (
        // חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task): pq-unit-card
        // כאן גם - הדלי יכול להכיל הרבה items (Expanded), אותה בעיית
        // "בלוק-ענק-אטומי" כמו יחידה אמיתית, אותו טיפול רך.
        <div className="pq-section pq-unit-card" style={{ border: '1px dashed #d5d0e6', borderRadius: '12px', background: '#ffffff', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#6b6580', minWidth: 0 }}>{isHebrew ? 'לא משויך' : 'Unassigned'}</span>
            {mode === 'compact' && (
              <MoneyCell
                currencySymbol={currencySymbol}
                amount={unassignedItems.reduce((sum, it) => sum + Number(it.total_price ?? (getActiveQuantity(it) * Number(it.price ?? it.unit_price ?? 0))), 0)}
                formatMoneyDisplay={moneyFmt}
                color="#1e293b"
                wideInsetRow
                isHebrew={isHebrew}
              />
            )}
          </div>
          {mode !== 'compact' && (
            <div style={{ borderTop: '1px solid #f1f5f9' }}>
              <GroupBlocks groups={wrapAsSingletonGroups(unassignedItems)} isHebrew={isHebrew} currencySymbol={currencySymbol} formatNum={formatNum} formatMoneyDisplay={moneyFmt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
