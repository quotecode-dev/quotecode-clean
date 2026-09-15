import { useState, useEffect, useRef } from 'react';
import { X, Package, Ruler, ChevronRight, ChevronLeft, Lock, Check, Pencil, Sparkles } from 'lucide-react';
import { LIGHT as NEON } from '../theme/neonTheme';
import { cmToM, mToCm, computeMeasurementValue, resolveCalculationMethod, getActiveQuantity, sumMeasurementAreas } from '../utils/professionalQuoteItem';

// חוק ברזל (Smart Quote Final UX Simplification task, Owner-authorized,
// "a first-time user should understand what to do without explanation"):
// אשף-הוספה/עריכה מודרך יחיד, 4 שלבים חובה בלבד (Decision 1): מה מוסיפים ->
// איך מחשבים את המחיר -> הזנת המספרים הרלוונטיים -> בדיקה לפני הוספה.
// פרטים ללקוח הם הרחבה אופציונלית בתוך שלב הבדיקה, לא שלב חובה נפרד
// (מתקן את "optional customer details behave like a compulsory step").
// כל שלב חובה נושא כותרת + משפט-הסבר קצר אחד מתחתיה (Decision 5) - למה
// השלב הזה קיים ומה לעשות עכשיו, לא פסקה טכנית.
//
// שלב 1 (מה מוסיפים) נפתח ישר על שדה-התיאור עצמו - אין עוד "בחרו קודם
// טקסט-חופשי או קטלוג" (מתקן "the first step asks for an input mechanism
// before the real business task"); קטלוג הוא קישור משני מתחת, מוצג רק אם
// יש בכלל קטלוג.
//
// שלב 2 (איך מחשבים את המחיר) מציג רק 2 שיטות בולטות - מומלצת (אם יש
// המלצה אמיתית מפרופיל העסק, getRecommendedPricingMethod) + שיטת-בסיס
// אחת - שאר השיטות הנתמכות תמיד נגישות תחת "אפשרויות נוספות", לעולם לא
// נעולות/מוסתרות-לצמיתות (Decision 2/3 - "industry is guidance, not
// pricing authority").
//
// שלב 3: הסבר דינמי לפי השיטה שנבחרה; שורת-מידה שהתחילה (רוחב או גובה
// הוזנו) חייבת להיות שלמה כדי להמשיך - לעולם לא מסוננת בשקט (Part E, תיקון
// לבאג-Codex אמיתי: "incomplete additional measurements may disappear
// silently").
//
// שלב 4 (בדיקה לפני הוספה): מציג את כל המידות בפועל (לא "+3 מידות נוספות"
// בלבד - תיקון לבאג-Codex "Review hides all but the first size"), בשפה
// אנושית (לא "Final quantity"/"Pricing method").
//
// עריכה (editingItem): נפתח ישר בשלב הבדיקה, עם משפט-הנחיה נפרד למצב-
// עריכה. שינוי שיטת-תמחור בעריכה מזהיר תמיד לפני שינוי-פרשנות (Part K) -
// לא רק כשמידות עומדות-להימחק. מנוע-החישוב עצמו (professionalQuoteItem.js)
// לא השתנה - נקודת-אמת יחידה.

const STEPS = { WHAT: 1, PRICING: 2, DETAILS: 3, REVIEW: 4 };
const ALL_METHODS = ['fixed', 'units', 'area', 'linear'];

function blankState(defaultSectionKey) {
  return {
    description: '',
    catalogServiceId: '',
    pricingMethod: null, // 'fixed' | 'units' | 'area' | 'linear'
    widthCm: '',
    heightCm: '',
    extraMeasureRows: [],
    quantity: '1',
    unitPrice: '',
    sectionKey: defaultSectionKey || '',
    specRows: [],
  };
}

// חוק ברזל (§J - Add/Edit unification, "quantity-one item keeps its
// original pricing semantics"): תיקון לבאג-Codex אמיתי - הניחוש הקודם
// (quantity===1 -> 'fixed') היה מפרש-מחדש בשקט פריט שנשמר כ"כמות 1 יחידה
// × מחיר ליחידה" כאילו היה "סכום קבוע אחד", למרות ששני הייצוגים חשבוניים
// זהים (1×X=X) - המשמעות המקורית שהמשתמש בחר אינה נשמרת בשום עמודה קיימת
// היום. פריט לא-נמדד תמיד נפתח לעריכה כ-'units' (הצגה שאינה מאבדת מידע:
// הכמות/המחיר-ליחידה האמיתיים מוצגים כפי שהם) - לעולם לא מנוחש כ-'fixed'.
// המשתמש עדיין יכול לבחור 'fixed' במפורש דרך שלב 2 אם זו אכן כוונתו.
function stateFromItem(item, defaultSectionKey) {
  const pricingMethod = item.pricing_unit === 'linear_meter'
    ? 'linear'
    : item.pricing_unit === 'm2'
      ? 'area'
      : 'units';
  const rows = Array.isArray(item.measurements) ? item.measurements : [];
  const [firstRow, ...restRows] = rows;
  return {
    description: item.description || '',
    catalogServiceId: '',
    pricingMethod,
    widthCm: firstRow ? mToCm(firstRow.width) : '',
    heightCm: firstRow ? mToCm(firstRow.height) : '',
    extraMeasureRows: restRows.map((r) => ({ widthCm: mToCm(r.width), heightCm: mToCm(r.height), label: r.label || '' })),
    // חוק ברזל (SQ-F03-B - "non-area/non-length structured units being
    // collapsed": a manual hour/day/kg/professional-unit item can carry a
    // real effective quantity in calculated_quantity while its flat
    // quantity column is a different placeholder value - reading raw
    // item.quantity here silently showed/re-saved the WRONG number the
    // moment the field round-tripped through this wizard. getActiveQuantity
    // (the one existing canonical authority, already used by Dashboard.jsx/
    // QuoteForm.jsx for the exact same "what is the real charged quantity"
    // question) is a strict superset: for an ordinary simple item with no
    // calculated_quantity at all, it already falls back to item.quantity -
    // byte-identical to the previous behavior for every non-professional
    // item, so this only changes previously-wrong professional-manual cases.
    quantity: pricingMethod === 'units' ? String(getActiveQuantity(item) || item.quantity || '1') : '1',
    unitPrice: item.unit_price != null ? String(item.unit_price) : '',
    sectionKey: item.section_key || defaultSectionKey || '',
    specRows: Array.isArray(item.specification) ? item.specification.map((r) => ({ label: r.label || '', value: r.value || '' })) : [],
    _hadMeasurementRows: rows.length > 0,
  };
}

// חוק ברזל (Part B - "business type MUST influence which pricing methods
// are shown first... but MUST NOT lock pricing"): בדיוק 2 שיטות בולטות
// תמיד (המלצה, אם קיימת אמיתית, + שיטת-בסיס אחת) - שאר השיטות תמיד נגישות
// תחת "אפשרויות נוספות" (Decision 3). ללא המלצה (domain כללי/לא מוגדר) -
// סדר גנרי-שמרני (fixed,units), לא ניחוש.
function getVisibleMethods(recommendedMethod) {
  if (recommendedMethod && ALL_METHODS.includes(recommendedMethod)) {
    const partner = recommendedMethod === 'units' ? 'fixed' : 'units';
    return [recommendedMethod, partner];
  }
  return ['fixed', 'units'];
}

export default function AddItemWizard({
  isOpen,
  onClose,
  onAdd,
  editingItem,
  isHebrew,
  sym,
  formatNum,
  services,
  sections,
  defaultSectionKey,
  canUseProfessionalQuotes,
  onRequestUpgrade,
  recommendedMethod,
}) {
  const isEditMode = !!editingItem;
  const [step, setStep] = useState(STEPS.WHAT);
  const [description, setDescription] = useState('');
  const [catalogServiceId, setCatalogServiceId] = useState('');
  // חוק ברזל (Smart Quote End-to-End Structural Unification task, Locked
  // Decision 6 - "Catalog First"): כשיש קטלוג, ברירת-המחדל של שלב 1 היא
  // רשימת-הקטלוג עצמה (showManualEntry===false) - לא שדה-הזנה-חופשית
  // עם קישור-משני לקטלוג כמו קודם. showManualEntry===true חושף את שדה
  // ההזנה הידנית (גם אחרי בחירה מהקטלוג, כדי לאפשר עריכה/בדיקה של השם/
  // מחיר שמולאו-מראש - "may safely prefill... item name; description;
  // known price"). כשאין קטלוג כלל (services.length===0) המשתנה הזה לא
  // משפיע - שדה ההזנה הידנית מוצג ישירות, ללא שלב-בחירה מיותר.
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pricingMethod, setPricingMethod] = useState(null);
  const [showMoreMethods, setShowMoreMethods] = useState(false);
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [extraMeasureRows, setExtraMeasureRows] = useState([]); // [{ widthCm, heightCm, label }]
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [sectionKey, setSectionKey] = useState(defaultSectionKey || '');
  const [specRows, setSpecRows] = useState([]);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [errors, setErrors] = useState({});
  const firstFieldRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerElRef = useRef(null);
  // חוק ברזל (Part K - "never silently reinterpret... require explicit
  // confirmation when destructive"): שיטת-התמחור שהייתה בפתיחה בעריכה -
  // כל שינוי שלה (לא רק אובדן שורות-מידה) עלול לפרש-מחדש את אותם מספרים
  // גולמיים (למשל מחיר-ליחידה -> סכום-כולל) - מוזהר תמיד, לא רק כשמידות
  // בסיכון.
  const methodAtOpenRef = useRef(null);
  const hadMeasurementRowsAtOpenRef = useRef(false);
  // חוק ברזל (SQ-F03, Codex Smart Quote P0/P1 review - "unified Edit can
  // silently replace saved pricing/measurement semantics"): methodAtOpenRef
  // לבדו אינו מספיק כדי להבחין "המשתמש מעולם לא נגע בשיטת-התמחור" מ-"המשתמש
  // המיר שיטה ואישר" - שני המצבים מסתיימים עם methodAtOpenRef.current===
  // pricingMethod (ה-ref עצמו מתעדכן ל-target ברגע האישור, שורה למטה).
  // דגל נפרד זה true אך ורק כשהקונברסיה המפורשת-והמאושרת (Part K, קיים)
  // אכן קרתה בפועל - handleConfirm משתמש בו כדי להחליט אם מותר לשמר בשקט
  // שדות שלאשף אין UI עבורם כלל (quantity_source ידני, is_pricing_driving
  // לכל שורה, label של שורת-המידה הראשונה, pricing_unit לא-נמדד כמו שעה/
  // ק"ג/יום) - "editing must be non-destructive by default... unless the
  // user explicitly chooses a semantic conversion".
  const conversionConfirmedRef = useRef(false);

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const recompute = () => setIsNarrow(window.matchMedia('(max-width: 560px)').matches);
    recompute();
    const mq = window.matchMedia('(max-width: 560px)');
    mq.addEventListener ? mq.addEventListener('change', recompute) : mq.addListener(recompute);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', recompute) : mq.removeListener(recompute);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      const s = stateFromItem(editingItem, defaultSectionKey);
      setDescription(s.description);
      setCatalogServiceId(s.catalogServiceId);
      // חוק ברזל (Catalog First, Decision 6): במצב-עריכה תמיד מוצג שדה
      // ההזנה הידנית (עם השם הקיים מוצג/ניתן-לעריכה) - לעולם לא רשימת-
      // קטלוג לא-קשורה, גם אם למשתמש יש קטלוג. "Catalog must NOT silently
      // override saved quote-item semantics during Edit."
      setShowManualEntry(true);
      setPricingMethod(s.pricingMethod);
      setShowMoreMethods(!getVisibleMethods(recommendedMethod).includes(s.pricingMethod));
      setWidthCm(s.widthCm);
      setHeightCm(s.heightCm);
      setExtraMeasureRows(s.extraMeasureRows);
      setQuantity(s.quantity);
      setUnitPrice(s.unitPrice);
      setSectionKey(s.sectionKey);
      setSpecRows(s.specRows);
      setShowCustomerDetails(s.specRows.length > 0);
      methodAtOpenRef.current = s.pricingMethod;
      hadMeasurementRowsAtOpenRef.current = s._hadMeasurementRows;
      conversionConfirmedRef.current = false;
      // חוק ברזל (§C/Decision 5, "editing reopens the same guided editor
      // populated with the saved values"): קפיצה ישר לבדיקה - עם משפט-
      // הנחיה נפרד למצב-עריכה (t.editModeExplanation).
      setStep(STEPS.REVIEW);
    } else {
      const s = blankState(defaultSectionKey);
      setDescription(s.description);
      setCatalogServiceId(s.catalogServiceId);
      // חוק ברזל (Catalog First, Decision 6): הוספה חדשה - כשיש קטלוג,
      // ברירת-המחדל היא רשימת-הקטלוג עצמה (showManualEntry=false); כשאין
      // קטלוג כלל, הערך הזה לא משפיע (התנאי services.length===0 מדלג
      // ישירות להזנה ידנית ב-JSX, "no unnecessary source-choice card").
      setShowManualEntry(false);
      setPricingMethod(s.pricingMethod);
      setShowMoreMethods(false);
      setWidthCm(s.widthCm);
      setHeightCm(s.heightCm);
      setExtraMeasureRows(s.extraMeasureRows);
      setQuantity(s.quantity);
      setUnitPrice(s.unitPrice);
      setSectionKey(s.sectionKey);
      setSpecRows(s.specRows);
      setShowCustomerDetails(false);
      methodAtOpenRef.current = null;
      hadMeasurementRowsAtOpenRef.current = false;
      conversionConfirmedRef.current = false;
      setStep(STEPS.WHAT);
    }
    setErrors({});
  }, [isOpen, editingItem, defaultSectionKey, recommendedMethod]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus();
      else dialogRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, step]);

  useEffect(() => {
    if (isOpen) {
      triggerElRef.current = document.activeElement;
    } else if (triggerElRef.current && document.body.contains(triggerElRef.current)) {
      triggerElRef.current.focus();
      triggerElRef.current = null;
    }
  }, [isOpen]);

  function trapFocus(e) {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!isOpen) return null;

  const t = {
    title: isEditMode ? (isHebrew ? 'עריכת מוצר או עבודה' : 'Edit product or work') : (isHebrew ? 'הוספת מוצר או עבודה' : 'Add product or work'),
    step1Title: isHebrew ? 'מה מוסיפים?' : 'What are you adding?',
    step1Explanation: isHebrew ? 'כתבו את המוצר או העבודה שתרצו להוסיף להצעה.' : 'Enter the product or work you want to add to the quote.',
    // חוק ברזל (Smart Quote End-to-End Structural Unification task, Locked
    // Decision 6 - "Catalog First"): כשיש קטלוג, ההסבר מתאר את חוויית-
    // הבחירה מהקטלוג עצמה, לא הזנה חופשית - ה-explanation חייב לשקף את
    // מה שהשדה בפועל מציג (חוק Step-Header-Guidance הקיים, §161).
    step1ExplanationCatalog: isHebrew ? 'בחרו מוצר או עבודה שכבר שמרתם בקטלוג, או הוסיפו פריט חדש.' : 'Choose a product or work you already saved in your catalog, or add a new one.',
    descPlaceholder: isHebrew ? 'למשל: התקנה, ידיות או רשת לחלון' : 'e.g. Installation, handles, or a window screen',
    chooseFromCatalog: isHebrew ? 'בחירה מהמוצרים השמורים' : 'Choose from saved products',
    catalogPick: isHebrew ? 'בחר פריט...' : 'Select an item...',
    catalogFirstHeading: isHebrew ? 'בחרו מוצר או עבודה מהקטלוג' : 'Choose a product or work from your catalog',
    manualFallbackLink: isHebrew ? 'לא מצאתם בקטלוג? הוסיפו מוצר או עבודה ידנית' : 'Not in the catalog? Add a product or work manually',
    backToCatalogLink: isHebrew ? 'חזרה לבחירה מהקטלוג' : 'Back to catalog',
    step2Title: isHebrew ? 'איך מחשבים את המחיר?' : 'How is the price worked out?',
    step2Explanation: isHebrew ? 'בחרו איך אתם בדרך כלל גובים על המוצר או העבודה הזאת.' : 'Choose how you normally charge for this product or work.',
    methodFixed: isHebrew ? 'מחיר כולל' : 'One total price',
    methodFixedExample: isHebrew ? 'לדוגמה: ₪500' : 'e.g. $500',
    methodUnitsChoice: isHebrew ? 'מחיר לכל יחידה' : 'Price for each',
    methodUnitsExample: isHebrew ? 'לדוגמה: 6 × 25 = 150' : 'e.g. 6 × 25 = 150',
    methodAreaChoice: isHebrew ? 'מחיר לפי שטח' : 'Price by area',
    methodAreaExample: isHebrew ? 'לדוגמה: 4.4 מ"ר × 100 = 440' : 'e.g. 4.4 m² × 100 = 440',
    methodLinearChoice: isHebrew ? 'מחיר לפי אורך' : 'Price by length',
    methodLinearExample: isHebrew ? 'לדוגמה: 5 מ\' × 40 = 200' : 'e.g. 5 m × 40 = 200',
    recommended: isHebrew ? 'מומלץ' : 'Recommended',
    moreOptions: isHebrew ? 'אפשרויות נוספות' : 'More options',
    step3TitleFixed: isHebrew ? 'סכום העבודה' : 'Amount',
    step3ExplanationFixed: isHebrew ? 'הזינו את המחיר הכולל שתרצו לגבות.' : 'Enter the total price you want to charge.',
    fixedAmountLabel: isHebrew ? 'מה המחיר הכולל?' : 'What is the total price?',
    step3TitleUnits: isHebrew ? 'כמות ומחיר' : 'Quantity & price',
    step3ExplanationUnits: isHebrew ? 'הזינו כמה יחידות יש ומה המחיר לכל יחידה.' : 'Enter how many units there are and the price for each.',
    quantityLabel: isHebrew ? 'כמה יחידות?' : 'How many?',
    unitPriceLabel: isHebrew ? 'מה המחיר לכל יחידה?' : 'What is the price for each?',
    step3TitleArea: isHebrew ? 'מידות' : 'Sizes',
    step3ExplanationArea: isHebrew ? 'הזינו את המידות ואנחנו נחשב עבורכם את השטח והמחיר.' : 'Enter the sizes and we’ll calculate the area and price for you.',
    areaHelper: isHebrew ? 'הזינו בס״מ. נחשב את השטח במ"ר.' : 'Enter centimetres. We’ll calculate square metres.',
    step3TitleLinear: isHebrew ? 'אורך' : 'Length',
    step3ExplanationLinear: isHebrew ? 'הזינו את האורך והמחיר ליחידת אורך.' : 'Enter the length and the price per unit of length.',
    sizeN: isHebrew ? (n) => `מידה ${n}` : (n) => `Size ${n}`,
    widthCm: isHebrew ? 'רוחב (ס"מ)' : 'Width (cm)',
    heightCm: isHebrew ? 'גובה (ס"מ)' : 'Height (cm)',
    lengthCm: isHebrew ? 'אורך (ס"מ)' : 'Length (cm)',
    unitPriceArea: isHebrew ? 'מחיר לכל מ"ר' : 'Price per m²',
    unitPriceLinear: isHebrew ? 'מחיר לכל מטר' : 'Price per metre',
    addAnotherSize: isHebrew ? '+ הוספת מידה נוספת' : '+ Add another size',
    removeSize: isHebrew ? 'הסר מידה זו' : 'Remove this size',
    sizeLabelOptional: isHebrew ? 'מיקום או שם — לא חובה' : 'Location or name — optional',
    step4Title: isHebrew ? 'בדיקה לפני הוספה' : 'Check before adding',
    step4Explanation: isHebrew ? 'בדקו שהפרטים והמחיר נכונים לפני שהמוצר או העבודה מתווספים להצעה.' : 'Check the details and price before this product or work is added to the quote.',
    editModeExplanation: isHebrew ? 'בדקו את הפרטים הקיימים ובחרו מה תרצו לשנות.' : 'Review the current details and choose what you want to change.',
    addCustomerDetailsToggle: isHebrew ? 'להוסיף פרטים ללקוח?' : 'Add details for the customer?',
    customerDetailsHelper: isHebrew ? 'לא חובה — למשל צבע, חומר או הערה' : 'Optional — for example colour, material, or a note',
    customerDetailsPriceNote: isHebrew ? 'הפרטים האלה לא משנים את המחיר' : 'These details do not change the price',
    detailLabel: isHebrew ? 'פרט' : 'Detail',
    detailPlaceholder: isHebrew ? 'למשל: צבע' : 'e.g. Colour',
    detailValuePlaceholder: isHebrew ? 'למשל: לבן' : 'e.g. White',
    addSpecRow: isHebrew ? '+ הוסף פרט' : '+ Add detail',
    groupLabel: isHebrew ? 'יחידה (דירה / חדר / אזור) - לא חובה' : 'Unit (apartment / room / area) - optional',
    noGroup: isHebrew ? 'ללא יחידה' : 'No unit',
    changeName: isHebrew ? 'שינוי שם' : 'Change name',
    changePricingAndSizes: isHebrew ? 'שינוי מחיר ומידות' : 'Change price and sizes',
    changePricingMethod: isHebrew ? 'שינוי שיטת תמחור' : 'Change how it is priced',
    totalAreaLabel: isHebrew ? 'סה"כ שטח' : 'Total area',
    totalLengthLabel: isHebrew ? 'סה"כ אורך' : 'Total length',
    totalLabel: isHebrew ? 'סה"כ' : 'Total',
    customerPreviewTitle: isHebrew ? 'כך הלקוח יראה את הפריט' : 'This is what the customer will see',
    back: isHebrew ? 'חזרה' : 'Back',
    next: isHebrew ? 'הבא' : 'Next',
    addItem: isEditMode ? (isHebrew ? 'שמירת שינויים' : 'Save changes') : (isHebrew ? 'הוספה להצעה' : 'Add to quote'),
    cancel: isHebrew ? 'ביטול' : 'Cancel',
    edit: isHebrew ? 'עריכה' : 'Edit',
    stepLabels: isHebrew
      ? ['מה מוסיפים', 'איך מתמחרים', 'פרטים', 'בדיקה']
      : ['What', 'Pricing', 'Details', 'Check'],
    stepOfTotal: isHebrew ? (n, total) => `שלב ${n} מתוך ${total}` : (n, total) => `Step ${n} of ${total}`,
    missingDescription: isHebrew ? 'יש להזין שם או תיאור לפריט' : 'Please enter a name or description for this item',
    missingMethod: isHebrew ? 'יש לבחור כיצד לתמחר את הפריט' : 'Please choose how to charge for this item',
    missingWidth: isHebrew ? 'יש להזין רוחב גדול מ-0' : 'Please enter a width greater than 0',
    missingHeight: isHebrew ? 'יש להזין גובה גדול מ-0' : 'Please enter a height greater than 0',
    missingLength: isHebrew ? 'יש להזין אורך גדול מ-0' : 'Please enter a length greater than 0',
    missingQuantity: isHebrew ? 'יש להזין כמות גדולה מ-0' : 'Please enter a quantity greater than 0',
    missingPrice: isHebrew ? 'יש להזין מחיר' : 'Please enter a price',
    missingAmount: isHebrew ? 'יש להזין סכום' : 'Please enter an amount',
    rowNeedsHeight: isHebrew ? (n) => `במידה ${n} חסר גובה. השלימו או הסירו אותה.` : (n) => `Size ${n} needs a height. Complete or remove it.`,
    rowNeedsWidth: isHebrew ? (n) => `במידה ${n} חסר רוחב. השלימו או הסירו אותה.` : (n) => `Size ${n} needs a width. Complete or remove it.`,
    upgradeNeeded: isHebrew ? 'זמין במסלול Basic ומעלה' : 'Available on the Basic plan and above',
    calcPreviewArea: isHebrew ? (w, h, m2) => `${w} × ${h} ס"מ = ${m2} מ"ר` : (w, h, m2) => `${w} × ${h} cm = ${m2} m²`,
    calcPreviewLinear: isHebrew ? (l, m) => `${l} ס"מ = ${m} מ'` : (l, m) => `${l} cm = ${m} m`,
    destructiveConversionConfirm: isHebrew
      ? 'שינוי שיטת התמחור עלול לשנות את פירוש הסכומים הקיימים. להמשיך?'
      : 'Changing the pricing method may change how the existing numbers are interpreted. Continue?',
  };

  const isMeasureMethod = pricingMethod === 'area' || pricingMethod === 'linear';
  const widthM = cmToM(widthCm);
  const heightM = cmToM(heightCm);
  const primaryRowValue = isMeasureMethod
    ? computeMeasurementValue(pricingMethod, widthM, pricingMethod === 'linear' ? undefined : heightM)
    : null;
  const extraRowValues = isMeasureMethod
    ? extraMeasureRows.map((row) => computeMeasurementValue(pricingMethod, cmToM(row.widthCm), pricingMethod === 'linear' ? undefined : cmToM(row.heightCm)))
    : [];
  const validExtraRowValues = extraRowValues.filter((v) => v != null && Number.isFinite(v));
  const calculatedValue = isMeasureMethod
    ? (primaryRowValue != null || validExtraRowValues.length > 0
      ? (primaryRowValue || 0) + validExtraRowValues.reduce((sum, v) => sum + v, 0)
      : null)
    : null;

  function addMeasureRow() {
    setExtraMeasureRows((rows) => [...rows, { widthCm: '', heightCm: '', label: '' }]);
  }
  function updateMeasureRow(idx, field, value) {
    setExtraMeasureRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function removeMeasureRow(idx) {
    setExtraMeasureRows((rows) => rows.filter((_, i) => i !== idx));
    setErrors((e) => {
      if (!e.rows) return e;
      const rows = { ...e.rows };
      delete rows[idx];
      return { ...e, rows };
    });
  }

  // חוק ברזל (Part E - תיקון-שורש לבאג-Codex "incomplete additional
  // measurements may disappear silently"): כל שורה נוספת שהתחילה (רוחב
  // או גובה כלשהו הוזן) חייבת להיות שלמה כדי להמשיך - לעולם לא מסוננת
  // בשקט ב-Confirm. שורה שלא נגעו בה כלל (שני השדות ריקים) אינה "התחילה",
  // ולכן מותר להתעלם ממנה בבטחה (בדיוק כמו התנהגות-הסינון הקיימת של
  // sumMeasurementAreas/handleConfirm).
  function validateStep() {
    const e = {};
    if (step === STEPS.WHAT) {
      if (!description.trim()) e.description = t.missingDescription;
    }
    if (step === STEPS.PRICING) {
      if (!pricingMethod) e.method = t.missingMethod;
    }
    if (step === STEPS.DETAILS) {
      if (pricingMethod === 'fixed') {
        if (unitPrice === '' || Number.isNaN(Number(unitPrice))) e.unitPrice = t.missingAmount;
      } else if (pricingMethod === 'units') {
        if (!(Number(quantity) > 0)) e.quantity = t.missingQuantity;
        if (unitPrice === '' || Number.isNaN(Number(unitPrice))) e.unitPrice = t.missingPrice;
      } else if (isMeasureMethod) {
        if (!(Number(widthCm) > 0)) e.width = pricingMethod === 'linear' ? t.missingLength : t.missingWidth;
        if (pricingMethod === 'area' && !(Number(heightCm) > 0)) e.height = t.missingHeight;
        if (unitPrice === '' || Number.isNaN(Number(unitPrice))) e.unitPrice = t.missingPrice;

        const rowErrors = {};
        extraMeasureRows.forEach((row, idx) => {
          const rowStarted = row.widthCm !== '' || row.heightCm !== '';
          if (!rowStarted) return;
          const widthOk = Number(row.widthCm) > 0;
          const heightOk = pricingMethod === 'linear' || Number(row.heightCm) > 0;
          if (!widthOk) rowErrors[idx] = t.rowNeedsWidth(idx + 2);
          else if (!heightOk) rowErrors[idx] = t.rowNeedsHeight(idx + 2);
        });
        if (Object.keys(rowErrors).length > 0) e.rows = rowErrors;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (!validateStep()) return;
    if (step === STEPS.WHAT) {
      setStep(STEPS.PRICING);
      return;
    }
    if (step === STEPS.PRICING) {
      // חוק ברזל (Part K - "never silently reinterpret... require explicit
      // confirmation when destructive"): בעריכה, כל שינוי-שיטה אמיתי (לא
      // רק כזה שמאבד שורות-מידה) עלול לפרש-מחדש את אותם מספרים גולמיים -
      // תמיד מוזהר לפני שהמעבר בפועל קורה.
      if (isEditMode && methodAtOpenRef.current && methodAtOpenRef.current !== pricingMethod) {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(t.destructiveConversionConfirm)) {
          return;
        }
        methodAtOpenRef.current = pricingMethod;
        hadMeasurementRowsAtOpenRef.current = false;
        conversionConfirmedRef.current = true;
      }
      setStep(STEPS.DETAILS);
      return;
    }
    if (step === STEPS.DETAILS) {
      setStep(STEPS.REVIEW);
    }
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(STEPS.WHAT, s - 1));
  }

  function goToStep(target) {
    setErrors({});
    setStep(target);
  }

  function choosePricingMethod(m) {
    if (m === 'area' || m === 'linear') {
      if (!canUseProfessionalQuotes) {
        onRequestUpgrade?.();
        return;
      }
    }
    setPricingMethod(m);
  }

  function handleCatalogPick(id) {
    setCatalogServiceId(id);
    const svc = services.find((s) => String(s.id) === String(id));
    if (svc) {
      setDescription(svc.name);
      setUnitPrice(String(svc.price));
    }
    // חוק ברזל (Catalog First, Decision 6): אחרי בחירה מהקטלוג עוברים
    // לתצוגת ההזנה הידנית (עכשיו ממולאת-מראש עם השם/מחיר מהקטלוג) כדי
    // לאפשר בדיקה/עריכה לפני "הבא" - "may safely prefill... name;
    // description; known price" - לא מתקדמים אוטומטית לשלב הבא.
    setShowManualEntry(true);
  }

  function handleConfirm() {
    if (!pricingMethod) {
      setErrors({ method: t.missingMethod });
      return;
    }
    const finalSectionKey = sectionKey || null;
    // חוק ברזל (SQ-F03): true רק כשזו עריכת פריט קיים שמעולם לא עברה
    // קונברסיית-שיטה מפורשת-ומאושרת (Part K) - במקרה הזה, ורק בו, מותר
    // לשמר בשקט שדות שלאשף אין UI עבורם כלל (ר' ההסבר ליד conversionConfirmedRef
    // למעלה). קונברסיה מאושרת בפועל = כוונת-שינוי-פרשנות מפורשת של המשתמש,
    // ואז השדות החדשים/הריקים של הענף הנוכחי הם הנכונים, לא שימור.
    const isNonDestructiveEdit = isEditMode && !conversionConfirmedRef.current;

    let newItem;
    if (isMeasureMethod) {
      const calcMethod = resolveCalculationMethod(pricingMethod === 'linear' ? 'linear_meter' : 'm2', 'calculated');
      const originalMeasurements = isNonDestructiveEdit && Array.isArray(editingItem?.measurements) ? editingItem.measurements : [];
      const [originalFirstRow, ...originalExtraRows] = originalMeasurements;
      // חוק ברזל (SQ-F03 - "first measurement label being erased"): שורה 0
      // היחידה שהאשף אינו חושף לה שדה-label בכלל (רק לשורות "extra") -
      // ה-label שלה קיים רק בפריט השמור המקורי, ומשוחזר כאן ישירות מ-
      // editingItem, לא מ-state האשף (שמעולם לא קלט אותו).
      const rawRows = [{ widthCm, heightCm, label: originalFirstRow?.label || '' }, ...extraMeasureRows];
      const measurementRows = rawRows
        .map((row, idx) => {
          const rWidthM = cmToM(row.widthCm);
          const rHeightM = pricingMethod === 'linear' ? '' : cmToM(row.heightCm);
          const rowValue = computeMeasurementValue(pricingMethod, rWidthM, pricingMethod === 'linear' ? undefined : rHeightM);
          // חוק ברזל (SQ-F03 - "is_pricing_driving being rewritten"): האשף
          // אינו חושף UI לדגל הזה בכלל - שימור לפי מיקום-שורה מקורי (אותו
          // עיקרון בדיוק כמו ה-label לעיל) הוא הדרך היחידה שלא לדרוס בשקט
          // שורת-מידה שסומנה "תצוגה בלבד" (is_pricing_driving:false) בעורך
          // הפריט הרגיל (Dashboard.jsx toggleMeasurementPricingDriving).
          const originalRow = idx === 0 ? originalFirstRow : originalExtraRows[idx - 1];
          const preservedDriving = originalRow && originalRow.is_pricing_driving === false ? false : true;
          return { widthCm: row.widthCm, heightCm: row.heightCm, widthM: rWidthM, heightM: rHeightM, label: row.label || '', rowValue, isDriving: preservedDriving };
        })
        .filter((row) => row.rowValue != null && Number.isFinite(row.rowValue))
        .map((row) => ({
          width: row.widthM,
          height: row.heightM,
          unit: 'm',
          calculated_area: row.rowValue,
          label: row.label,
          is_pricing_driving: row.isDriving,
        }));
      // חוק ברזל (SQ-F03-A closure, real severe bug found by Codex's fresh
      // re-review): סכימה נאיבית (reduce גולמי על כל measurementRows) הייתה
      // מצרפת גם שורות is_pricing_driving===false ("תצוגה בלבד") לתוך הכמות
      // בפועל - למשל שורה מתמחרת 1.5m² + שורת-תצוגה-בלבד 2m² (מחיר שמור
      // 300 = 1.5×200) הייתה קופצת ל-3.5m²/700 אחרי עריכת-שם-בלבד גרידא,
      // בלי שהמשתמש נגע במידות. sumMeasurementAreas (אותה סמכות קנונית
      // יחידה שכבר משמשת בכל מקום אחר בפרויקט לאותה שאלה בדיוק, ר.
      // professionalQuoteItem.js) מדלגת נכון על שורות תצוגה-בלבד - לא נוסחה
      // שנייה, אותה סמכות בדיוק.
      const totalValue = measurementRows.length > 0
        ? sumMeasurementAreas(measurementRows, calcMethod)
        : null;
      // חוק ברזל (SQ-F03 - "measured item with manual quantity being
      // re-emitted as calculated quantity"): האשף אינו חושף שדה-קלט לערך-
      // ידני נפרד כלל - quantity_source==='manual' המקורי, כשקיים ולא
      // מדובר בקונברסיה מאושרת, משוחזר במדויק (כולל calculated_quantity
      // המספרי שנשמר), בדיוק כמו "override ידני תמיד מנצח" הקיים כבר
      // ב-professionalQuoteItem.js/Dashboard.jsx toggleManualQuantityOverride.
      const originalQuantitySource = isNonDestructiveEdit ? editingItem?.quantity_source : null;
      const isManualPreserved = originalQuantitySource === 'manual';
      const finalQuantitySource = isManualPreserved ? 'manual' : 'calculated';
      const finalCalcMethod = isManualPreserved ? 'manual' : calcMethod;
      const finalCalculatedQuantity = isManualPreserved
        ? ((editingItem.calculated_quantity !== undefined && editingItem.calculated_quantity !== null && editingItem.calculated_quantity !== '')
          ? editingItem.calculated_quantity
          : (totalValue != null ? totalValue : ''))
        : (totalValue != null ? totalValue : '');
      newItem = {
        description,
        quantity: '1',
        unit_price: unitPrice,
        isFromCatalog: !!catalogServiceId,
        section_key: finalSectionKey,
        pricing_unit: pricingMethod === 'linear' ? 'linear_meter' : 'm2',
        quantity_source: finalQuantitySource,
        calculation_method: finalCalcMethod,
        measurements: measurementRows,
        calculated_quantity: finalCalculatedQuantity,
      };
    } else if (pricingMethod === 'units') {
      newItem = {
        description,
        quantity: quantity || '1',
        unit_price: unitPrice,
        isFromCatalog: !!catalogServiceId,
        section_key: finalSectionKey,
      };
      // חוק ברזל (SQ-F03 - "non-area/non-length structured units being
      // collapsed into generic quantity semantics"): פריט לא-נמדד עם
      // pricing_unit מקצועי (unit/kg/hour/day) עובר-הידרציה תמיד ל-
      // pricingMethod 'units' הגנרי (האשף אינו מבחין ביניהם ב-UI כלל, ר'
      // §J למעלה) - עריכה שלא כללה קונברסיה מפורשת-ומאושרת חייבת לשמר את
      // ה-pricing_unit/quantity_source/calculation_method המדויקים, אחרת
      // המחיקה השקטה שלהם הופכת פריט-שעות/ק"ג/יום מקצועי לפריט פשוט.
      if (isNonDestructiveEdit && editingItem?.pricing_unit && editingItem.pricing_unit !== 'm2' && editingItem.pricing_unit !== 'linear_meter') {
        newItem.pricing_unit = editingItem.pricing_unit;
        newItem.quantity_source = editingItem.quantity_source || 'manual';
        newItem.calculation_method = editingItem.calculation_method || 'manual';
        // חוק ברזל (SQ-F03-B closure, "ONE-PASS SMART QUOTE FINAL
        // REMEDIATION" task): quantity_source/calculation_method/pricing_unit
        // לבדם אינם מספיקים - בלעדי כתיבת calculated_quantity גם כן, פריט-
        // שעות/ק"ג/יום ידני היה קורס לכמות האפקטיבית השגויה (getActiveQuantity
        // נופל בחזרה ל-newItem.quantity הגולמי כש-calculated_quantity חסר).
        // `quantity` כאן הוא שדה-הקלט של האשף עצמו, שכעת משוחזר-נכון מ-
        // getActiveQuantity ב-stateFromItem (ר' התיקון למעלה) - כך שערך לא-
        // נגוע (עריכת-שם-בלבד) משמר במדויק את המספר האמיתי, וערך שהמשתמש
        // אכן שינה בכוונה בשדה הזה (שינוי-כמות לגיטימי לפריט-כמות-ידנית,
        // לא קונברסיית-שיטה) עדיין מתקבל - לעולם לא "קפוא" על הערך המקורי.
        newItem.calculated_quantity = (quantity !== '' && quantity != null && Number.isFinite(Number(quantity)))
          ? Number(quantity)
          : editingItem.calculated_quantity;
      }
    } else {
      // 'fixed'
      newItem = {
        description,
        quantity: '1',
        unit_price: unitPrice,
        isFromCatalog: !!catalogServiceId,
        section_key: finalSectionKey,
      };
    }
    if (editingItem && editingItem.id) newItem.id = editingItem.id;
    if (specRows.length > 0) {
      newItem.specification = specRows.filter((r) => r.label.trim() || r.value.trim());
    }
    onAdd(newItem);
    onClose();
  }

  const dir = isHebrew ? 'rtl' : 'ltr';
  const total = pricingMethod === 'units'
    ? (Number(quantity) || 0) * (Number(unitPrice) || 0)
    : isMeasureMethod
      ? (calculatedValue != null ? calculatedValue * (Number(unitPrice) || 0) : null)
      : (Number(unitPrice) || 0);

  const priceIsValid = unitPrice !== '' && !Number.isNaN(Number(unitPrice)) && Number(unitPrice) >= 0;
  let formulaText = null;
  if (priceIsValid && total != null) {
    if (isMeasureMethod && calculatedValue != null) {
      const unitWord = pricingMethod === 'area' ? (isHebrew ? 'מ"ר' : 'm²') : (isHebrew ? 'מ\'' : 'm');
      formulaText = `${calculatedValue.toFixed(2)} ${unitWord} × ${sym}${formatNum ? formatNum(unitPrice) : unitPrice} = ${sym}${formatNum ? formatNum(total) : total.toFixed(2)}`;
    } else if (pricingMethod === 'units' && Number(quantity) > 0) {
      formulaText = `${quantity} × ${sym}${formatNum ? formatNum(unitPrice) : unitPrice} = ${sym}${formatNum ? formatNum(total) : total.toFixed(2)}`;
    }
  }

  const visibleMethods = getVisibleMethods(recommendedMethod);
  const moreMethods = ALL_METHODS.filter((m) => !visibleMethods.includes(m));
  const methodMeta = {
    fixed: { icon: <Package size={20} />, title: t.methodFixed, example: t.methodFixedExample },
    units: { icon: <Package size={20} />, title: t.methodUnitsChoice, example: t.methodUnitsExample },
    area: { icon: <Ruler size={20} />, title: t.methodAreaChoice, example: t.methodAreaExample },
    linear: { icon: <Ruler size={20} />, title: t.methodLinearChoice, example: t.methodLinearExample },
  };

  const step3Explanation = pricingMethod === 'fixed' ? t.step3ExplanationFixed
    : pricingMethod === 'units' ? t.step3ExplanationUnits
      : pricingMethod === 'area' ? t.step3ExplanationArea
        : pricingMethod === 'linear' ? t.step3ExplanationLinear
          : '';
  const step3Title = pricingMethod === 'fixed' ? t.step3TitleFixed
    : pricingMethod === 'units' ? t.step3TitleUnits
      : pricingMethod === 'area' ? t.step3TitleArea
        : pricingMethod === 'linear' ? t.step3TitleLinear
          : '';

  const allRowsForReview = isMeasureMethod
    ? [{ widthCm, heightCm, label: '' }, ...extraMeasureRows]
      .map((row) => ({ ...row, value: computeMeasurementValue(pricingMethod, cmToM(row.widthCm), pricingMethod === 'linear' ? undefined : cmToM(row.heightCm)) }))
      .filter((row) => row.value != null && Number.isFinite(row.value))
    : [];

  const methodResultLine = pricingMethod === 'fixed'
    ? (total != null ? `${t.totalLabel}: ${sym}${formatNum ? formatNum(total) : total.toFixed(2)}` : null)
    : formulaText;

  const activeGroupName = sections && sections.length > 0 && sectionKey ? (sections.find((s) => s.key === sectionKey)?.name || t.noGroup) : null;
  const activeSpecRows = specRows.filter((r) => r.label.trim() || r.value.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      dir={dir}
      ref={dialogRef}
      tabIndex={-1}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box', outline: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); return; } trapFocus(e); }}
    >
      <div style={{ background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${NEON.border}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: NEON.textPrimary }}>{t.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, display: 'flex', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <StepIndicator step={step} isHebrew={isHebrew} isNarrow={isNarrow} labels={t.stepLabels} stepOfTotal={t.stepOfTotal} />

        <div style={{ padding: '20px', overflowY: 'auto', flex: '1 1 auto' }}>
          {step === STEPS.WHAT && (
            <div>
              {/* חוק ברזל (Smart Quote End-to-End Structural Unification
                  task, Locked Decision 6 - "Catalog First"): כשלעסק יש
                  קטלוג שמור, המסלול הראשי בשלב 1 הוא בחירה מהקטלוג עצמו -
                  לא שדה-הזנה-חופשית עם קישור-משני לקטלוג. הסבר-השלב
                  (Step-Header-Guidance, §161) משתנה בהתאם - "בחרו..." לא
                  "כתבו..." - כדי לשקף את מה שהשדה בפועל מציג. אין קטלוג
                  בכלל => מדלגים ישירות להזנה ידנית, "no unnecessary
                  source-choice card" (זהה-בייט להתנהגות הקודמת). */}
              <StepHeading
                title={t.step1Title}
                explanation={(services && services.length > 0 && !showManualEntry) ? t.step1ExplanationCatalog : t.step1Explanation}
              />

              {services && services.length > 0 && !showManualEntry ? (
                <div>
                  <FieldLabel>{t.catalogFirstHeading}</FieldLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                    {services.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        ref={idx === 0 ? firstFieldRef : undefined}
                        onClick={() => handleCatalogPick(s.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%', boxSizing: 'border-box', background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.86rem', fontWeight: 700, color: NEON.textPrimary }}
                      >
                        <span>{s.name}</span>
                        <span className="pf-money" style={{ color: NEON.violet, fontWeight: 800, flexShrink: 0 }}>{sym}{formatNum ? formatNum(s.price) : s.price}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowManualEntry(true)} style={{ marginTop: '12px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                    {t.manualFallbackLink}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    id="wiz-description"
                    ref={firstFieldRef}
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.descPlaceholder}
                    aria-invalid={!!errors.description}
                    aria-describedby={errors.description ? 'wiz-description-error' : undefined}
                    style={{ ...inputStyle(isHebrew), padding: '13px 14px' }}
                  />
                  {errors.description && <ErrorText id="wiz-description-error">{errors.description}</ErrorText>}

                  {services && services.length > 0 && (
                    <button type="button" onClick={() => setShowManualEntry(false)} style={{ marginTop: '14px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                      {t.backToCatalogLink}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === STEPS.PRICING && (
            <div>
              <StepHeading title={t.step2Title} explanation={t.step2Explanation} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visibleMethods.map((m) => (
                  <MethodCard
                    key={m}
                    icon={methodMeta[m].icon}
                    title={methodMeta[m].title}
                    example={methodMeta[m].example}
                    recommended={m === recommendedMethod}
                    recommendedLabel={t.recommended}
                    onClick={() => choosePricingMethod(m)}
                    selected={pricingMethod === m}
                    locked={(m === 'area' || m === 'linear') && !canUseProfessionalQuotes}
                    lockedLabel={t.upgradeNeeded}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePricingMethod(m); } }}
                  />
                ))}
              </div>
              {!showMoreMethods ? (
                <button type="button" onClick={() => setShowMoreMethods(true)} style={{ marginTop: '10px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                  {t.moreOptions}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {moreMethods.map((m) => (
                    <MethodCard
                      key={m}
                      icon={methodMeta[m].icon}
                      title={methodMeta[m].title}
                      example={methodMeta[m].example}
                      recommended={m === recommendedMethod}
                      recommendedLabel={t.recommended}
                      onClick={() => choosePricingMethod(m)}
                      selected={pricingMethod === m}
                      locked={(m === 'area' || m === 'linear') && !canUseProfessionalQuotes}
                      lockedLabel={t.upgradeNeeded}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePricingMethod(m); } }}
                    />
                  ))}
                </div>
              )}
              {errors.method && <ErrorText>{errors.method}</ErrorText>}
            </div>
          )}

          {step === STEPS.DETAILS && pricingMethod === 'fixed' && (
            <div>
              <StepHeading title={step3Title} explanation={step3Explanation} />
              <FieldLabel htmlFor="wiz-fixed-amount">{`${t.fixedAmountLabel} (${sym})`}</FieldLabel>
              <input id="wiz-fixed-amount" ref={firstFieldRef} type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-fixed-amount-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-fixed-amount-error">{errors.unitPrice}</ErrorText>}
            </div>
          )}

          {step === STEPS.DETAILS && pricingMethod === 'units' && (
            <div>
              <StepHeading title={step3Title} explanation={step3Explanation} />
              <FieldLabel htmlFor="wiz-quantity">{t.quantityLabel}</FieldLabel>
              <input id="wiz-quantity" ref={firstFieldRef} type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? 'wiz-quantity-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.quantity && <ErrorText id="wiz-quantity-error">{errors.quantity}</ErrorText>}
              <FieldLabel htmlFor="wiz-unit-price">{`${t.unitPriceLabel} (${sym})`}</FieldLabel>
              <input id="wiz-unit-price" type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitprice-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitprice-error">{errors.unitPrice}</ErrorText>}
              {formulaText && (
                <div aria-live="polite" style={{ marginTop: '8px', fontSize: '0.9rem', color: NEON.violet, fontWeight: '800' }}>
                  {formulaText}
                </div>
              )}
            </div>
          )}

          {step === STEPS.DETAILS && isMeasureMethod && (
            <div>
              <StepHeading title={step3Title} explanation={step3Explanation} />
              {pricingMethod === 'area' && (
                <p style={{ fontSize: '0.78rem', color: NEON.textSecondary, margin: '0 0 10px' }}>{t.areaHelper}</p>
              )}
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' }}>{t.sizeN(1)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: pricingMethod === 'area' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                <div>
                  <FieldLabel htmlFor="wiz-width">{pricingMethod === 'linear' ? t.lengthCm : t.widthCm}</FieldLabel>
                  <input id="wiz-width" ref={firstFieldRef} type="number" min="0" step="any" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} aria-invalid={!!errors.width} aria-describedby={errors.width ? 'wiz-width-error' : undefined} style={inputStyle(isHebrew)} />
                  {errors.width && <ErrorText id="wiz-width-error">{errors.width}</ErrorText>}
                </div>
                {pricingMethod === 'area' && (
                  <div>
                    <FieldLabel htmlFor="wiz-height">{t.heightCm}</FieldLabel>
                    <input id="wiz-height" type="number" min="0" step="any" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} aria-invalid={!!errors.height} aria-describedby={errors.height ? 'wiz-height-error' : undefined} style={inputStyle(isHebrew)} />
                    {errors.height && <ErrorText id="wiz-height-error">{errors.height}</ErrorText>}
                  </div>
                )}
              </div>
              {primaryRowValue != null && (
                <div aria-live="polite" style={{ marginTop: '10px', fontSize: '0.85rem', color: NEON.violetLight, fontWeight: '600' }}>
                  {pricingMethod === 'area' ? t.calcPreviewArea(widthCm, heightCm, primaryRowValue.toFixed(2)) : t.calcPreviewLinear(widthCm, primaryRowValue.toFixed(2))}
                </div>
              )}

              {extraMeasureRows.map((row, idx) => {
                const rowValue = computeMeasurementValue(pricingMethod, cmToM(row.widthCm), pricingMethod === 'linear' ? undefined : cmToM(row.heightCm));
                const rowError = errors.rows && errors.rows[idx];
                return (
                  <div key={idx} style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px dashed ${NEON.border}` }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' }}>{t.sizeN(idx + 2)}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: pricingMethod === 'area' ? '1fr 1fr' : '1fr', gap: '10px', flex: 1 }}>
                        <div>
                          <FieldLabel htmlFor={`wiz-extra-width-${idx}`}>{pricingMethod === 'linear' ? t.lengthCm : t.widthCm}</FieldLabel>
                          <input id={`wiz-extra-width-${idx}`} type="number" min="0" step="any" value={row.widthCm} onChange={(e) => updateMeasureRow(idx, 'widthCm', e.target.value)} aria-invalid={!!rowError} style={inputStyle(isHebrew)} />
                        </div>
                        {pricingMethod === 'area' && (
                          <div>
                            <FieldLabel htmlFor={`wiz-extra-height-${idx}`}>{t.heightCm}</FieldLabel>
                            <input id={`wiz-extra-height-${idx}`} type="number" min="0" step="any" value={row.heightCm} onChange={(e) => updateMeasureRow(idx, 'heightCm', e.target.value)} aria-invalid={!!rowError} style={inputStyle(isHebrew)} />
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removeMeasureRow(idx)} aria-label={t.removeSize} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, padding: '10px', marginTop: '18px', minWidth: '40px', minHeight: '40px' }}>
                        <X size={18} />
                      </button>
                    </div>
                    {rowError && <ErrorText>{rowError}</ErrorText>}
                    <input aria-label={t.sizeLabelOptional} placeholder={t.sizeLabelOptional} value={row.label} onChange={(e) => updateMeasureRow(idx, 'label', e.target.value)} style={{ ...inputStyle(isHebrew), marginTop: '8px' }} />
                    {rowValue != null && (
                      <div aria-live="polite" style={{ marginTop: '8px', fontSize: '0.85rem', color: NEON.violetLight, fontWeight: '600' }}>
                        {pricingMethod === 'area' ? t.calcPreviewArea(row.widthCm, row.heightCm, rowValue.toFixed(2)) : t.calcPreviewLinear(row.widthCm, rowValue.toFixed(2))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ marginTop: '14px' }}>
                <button type="button" onClick={addMeasureRow} style={{ background: 'none', border: `1px dashed ${NEON.violet}`, color: NEON.violet, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', width: '100%', minHeight: '44px' }}>
                  {t.addAnotherSize}
                </button>
              </div>

              {calculatedValue != null && extraMeasureRows.length > 0 && (
                <div aria-live="polite" style={{ marginTop: '14px', fontSize: '0.9rem', color: NEON.textPrimary, fontWeight: '700' }}>
                  {pricingMethod === 'area' ? `${t.totalAreaLabel}: ${calculatedValue.toFixed(2)} ${isHebrew ? 'מ"ר' : 'm²'}` : `${t.totalLengthLabel}: ${calculatedValue.toFixed(2)} ${isHebrew ? 'מ\'' : 'm'}`}
                </div>
              )}

              <FieldLabel htmlFor="wiz-unit-price-m">{`${pricingMethod === 'area' ? t.unitPriceArea : t.unitPriceLinear} (${sym})`}</FieldLabel>
              <input id="wiz-unit-price-m" type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitpricem-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitpricem-error">{errors.unitPrice}</ErrorText>}
              {formulaText && (
                <div aria-live="polite" style={{ marginTop: '8px', fontSize: '0.9rem', color: NEON.violet, fontWeight: '800' }}>
                  {formulaText}
                </div>
              )}
            </div>
          )}

          {step === STEPS.REVIEW && (
            <div>
              <StepHeading title={t.step4Title} explanation={isEditMode ? t.editModeExplanation : t.step4Explanation} />

              <ReviewGroup label={description || '—'} isHebrew={isHebrew} onEdit={() => goToStep(STEPS.WHAT)} editLabel={t.changeName}>
                {isMeasureMethod && allRowsForReview.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {allRowsForReview.map((row, i) => (
                      <SummaryRow
                        key={i}
                        label={row.label ? `${t.sizeN(i + 1)} — ${row.label}` : t.sizeN(i + 1)}
                        value={pricingMethod === 'area' ? `${row.widthCm} × ${row.heightCm} cm = ${row.value.toFixed(2)} m²` : `${row.widthCm} cm = ${row.value.toFixed(2)} m`}
                        isHebrew={isHebrew}
                      />
                    ))}
                    <SummaryRow label={pricingMethod === 'area' ? t.totalAreaLabel : t.totalLengthLabel} value={`${calculatedValue != null ? calculatedValue.toFixed(2) : '—'} ${pricingMethod === 'area' ? 'm²' : 'm'}`} isHebrew={isHebrew} />
                  </div>
                )}
                {pricingMethod === 'units' && (
                  <SummaryRow label={t.quantityLabel} value={quantity || '—'} isHebrew={isHebrew} />
                )}
                {methodResultLine && (
                  <div aria-live="polite" style={{ marginTop: '6px', fontSize: '0.92rem', color: NEON.violet, fontWeight: '800' }}>
                    {methodResultLine}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <EditLink label={t.changePricingAndSizes} onClick={() => goToStep(STEPS.DETAILS)} />
                  <EditLink label={t.changePricingMethod} onClick={() => goToStep(STEPS.PRICING)} />
                </div>
              </ReviewGroup>

              <div style={{ background: NEON.bgCardAlt, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                {total != null && (
                  <div aria-live="polite" style={{ fontSize: '1rem', color: NEON.violet, fontWeight: '800' }}>
                    {sym}{formatNum ? formatNum(total) : total.toFixed(2)}
                  </div>
                )}
              </div>

              {!showCustomerDetails ? (
                <button type="button" onClick={() => setShowCustomerDetails(true)} style={{ background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', padding: 0, marginBottom: '14px', display: 'block' }}>
                  {t.addCustomerDetailsToggle}
                </button>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '2px' }}>{t.addCustomerDetailsToggle}</div>
                  <p style={{ fontSize: '0.76rem', color: NEON.textSecondary, margin: '0 0 4px' }}>{t.customerDetailsHelper}</p>
                  <p style={{ fontSize: '0.74rem', color: NEON.textMuted, margin: '0 0 10px', fontStyle: 'italic' }}>{t.customerDetailsPriceNote}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {specRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px' }}>
                        <input aria-label={t.detailLabel} placeholder={t.detailPlaceholder} value={row.label} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, label: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                        <input aria-label={isHebrew ? 'ערך' : 'Value'} placeholder={t.detailValuePlaceholder} value={row.value} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, value: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                        <button type="button" onClick={() => setSpecRows((rows) => rows.filter((_, ri) => ri !== i))} aria-label={isHebrew ? 'הסר שורה' : 'Remove row'} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '40px', flexShrink: 0 }}><X size={12} strokeWidth={3} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setSpecRows((rows) => [...rows, { label: '', value: '' }])} style={{ background: 'none', border: `1px dashed ${NEON.borderStrong}`, borderRadius: '8px', padding: '10px', color: NEON.textSecondary, fontSize: '0.8rem', cursor: 'pointer', minHeight: '40px' }}>{t.addSpecRow}</button>
                  </div>
                  {sections && sections.length > 0 && (
                    <div>
                      <FieldLabel htmlFor="wiz-section">{t.groupLabel}</FieldLabel>
                      <select id="wiz-section" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} style={inputStyle(isHebrew)}>
                        <option value="">{t.noGroup}</option>
                        {sections.map((s) => <option key={s.key} value={s.key}>{s.name || t.noGroup}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* חוק ברזל (Part I - customer-view predictability): תצוגה
                  מקדימה מבוססת אך ורק על שדות שהמסלול הציבורי-האמיתי
                  (PublicQuote.jsx/PublicQuoteEn.jsx, ר' §160) כבר מציג -
                  לעולם לא מבטיחה שדה שלא נתמך בפועל. */}
              <div style={{ border: `1px dashed ${NEON.borderStrong}`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: '700', color: NEON.textMuted, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '8px' }}>
                  <Sparkles size={12} />
                  {t.customerPreviewTitle}
                </div>
                <div style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.9rem' }}>{description || '—'}</div>
                {activeGroupName && <div style={{ fontSize: '0.76rem', color: NEON.textSecondary, marginTop: '2px' }}>{activeGroupName}</div>}
                {isMeasureMethod && allRowsForReview.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: '4px' }}>
                    {allRowsForReview.length} {isHebrew ? 'מידות' : 'sizes'} · {calculatedValue != null ? calculatedValue.toFixed(2) : '—'} {pricingMethod === 'area' ? 'm²' : 'm'}
                  </div>
                )}
                {pricingMethod === 'units' && (
                  <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: '4px' }}>{quantity} × {sym}{unitPrice || 0}</div>
                )}
                {activeSpecRows.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: '4px' }}>
                    {activeSpecRows.map((r, i) => <span key={i}>{i > 0 ? ' · ' : ''}{r.label}{r.label && r.value ? ': ' : ''}{r.value}</span>)}
                  </div>
                )}
                {total != null && (
                  <div style={{ fontWeight: '800', color: NEON.violet, marginTop: '6px' }}>{sym}{formatNum ? formatNum(total) : total.toFixed(2)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* חוק ברזל (Part N - Mobile first-class, תיקון-שורש לבאג-Codex
            "Mobile actions move too far down with long measurement
            lists"): position:sticky+bottom:0 בתוך אותו מכל-גלילה (לא
            fixed לכל המסך, כדי לא לשבור containment/overlay) - כפתורי
            הבא/חזרה תמיד נגישים בלי גלילה נוספת, גם עם 4+ שורות-מידה. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: `1px solid ${NEON.border}`, background: NEON.bgCard, position: 'sticky', bottom: 0, flexShrink: 0 }}>
          <button type="button" onClick={step === STEPS.WHAT ? onClose : goBack} style={secondaryBtnStyle}>
            {isHebrew ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {step === STEPS.WHAT ? t.cancel : t.back}
          </button>
          {step === STEPS.REVIEW ? (
            <button type="button" onClick={handleConfirm} style={primaryBtnStyle}>{t.addItem}</button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={step === STEPS.PRICING && !pricingMethod}
              style={{ ...primaryBtnStyle, opacity: (step === STEPS.PRICING && !pricingMethod) ? 0.5 : 1, cursor: (step === STEPS.PRICING && !pricingMethod) ? 'not-allowed' : 'pointer' }}
            >
              {t.next}
              {isHebrew ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// חוק ברזל (Decision 5 - "every required stage must show a clear heading
// + one short explanatory sentence directly beneath it"): נקודת-רינדור
// יחידה כדי שכל השלבים ישמרו על אותה מדרגיות ויזואלית (כותרת מודגשת,
// הסבר משני קטן-יותר וממוסך) - לא ארבע מימושים עצמאיים שעלולים להתפצל.
function StepHeading({ title, explanation }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, margin: 0 }}>{title}</h3>
      {explanation && <p style={{ fontSize: '0.8rem', color: NEON.textSecondary, margin: '4px 0 0', lineHeight: '1.4' }}>{explanation}</p>}
    </div>
  );
}

function StepIndicator({ step, isHebrew, isNarrow, labels, stepOfTotal }) {
  const total = labels.length;
  const currentLabel = labels[step - 1];
  if (isNarrow) {
    return (
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-valuetext={`${stepOfTotal(step, total)}: ${currentLabel}`}
        style={{ padding: '12px 20px 0', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: NEON.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLabel}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: '600', color: NEON.textSecondary, whiteSpace: 'nowrap', flexShrink: 0 }}>{stepOfTotal(step, total)}</span>
        </div>
        <div style={{ marginTop: '6px', height: '4px', borderRadius: '2px', background: NEON.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / total) * 100}%`, background: NEON.gradient, borderRadius: '2px', transition: 'width 0.2s ease' }} />
        </div>
      </div>
    );
  }
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-valuetext={`${stepOfTotal(step, total)}: ${currentLabel}`}
      style={{ display: 'flex', padding: '14px 20px 0', gap: '4px', flexShrink: 0 }}
    >
      {labels.map((label, i) => {
        const n = i + 1;
        const isDone = n < step;
        const isCurrent = n === step;
        return (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
            {i > 0 && (
              <div style={{ position: 'absolute', top: '11px', [isHebrew ? 'right' : 'left']: '-50%', width: '100%', height: '2px', background: isDone || isCurrent ? NEON.violet : NEON.border, zIndex: 0 }} />
            )}
            <div
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                zIndex: 1, width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: '800',
                background: isDone || isCurrent ? NEON.gradient : NEON.bgCardAlt,
                color: isDone || isCurrent ? '#ffffff' : NEON.textMuted,
                border: `1px solid ${isDone || isCurrent ? 'transparent' : NEON.borderStrong}`,
              }}
            >
              {isDone ? <Check size={12} strokeWidth={3} /> : n}
            </div>
            <span style={{ fontSize: '0.66rem', fontWeight: isCurrent ? '700' : '500', color: isCurrent ? NEON.textPrimary : NEON.textSecondary, textAlign: 'center', lineHeight: '1.2' }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MethodCard({ icon, title, example, recommended, recommendedLabel, onClick, selected, locked, lockedLabel, onKeyDown }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
        border: `2px solid ${selected ? NEON.violet : NEON.border}`,
        background: selected ? 'rgba(139,92,246,0.06)' : NEON.bgCardAlt,
        minHeight: '44px',
      }}
    >
      <div style={{ color: locked ? NEON.textMuted : NEON.violetLight, flexShrink: 0 }}>{locked ? <Lock size={22} /> : icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.92rem' }}>{title}</span>
          {recommended && !locked && (
            <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#fff', background: NEON.violet, borderRadius: '999px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {recommendedLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.78rem', color: NEON.textSecondary }}>{locked ? lockedLabel : example}</div>
      </div>
    </div>
  );
}

function FieldLabel({ htmlFor, children }) {
  return <label htmlFor={htmlFor} style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '4px', marginTop: '10px' }}>{children}</label>;
}

function ErrorText({ id, children }) {
  return <div id={id} role="alert" style={{ color: NEON.red, fontSize: '0.75rem', marginTop: '4px' }}>{children}</div>;
}

function EditLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: '6px 4px', minHeight: '32px' }}>
      <Pencil size={11} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function ReviewGroup({ label, isHebrew, onEdit, editLabel, children }) {
  return (
    <div style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', gap: '8px' }}>
        <span style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.95rem' }}>{label}</span>
        <EditLink label={editLabel} onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, isHebrew }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0', flexDirection: isHebrew ? 'row-reverse' : 'row', gap: '8px' }}>
      <span style={{ color: NEON.textSecondary }}>{label}</span>
      <span style={{ color: NEON.textPrimary, fontWeight: '600' }}>{value}</span>
    </div>
  );
}

function inputStyle(isHebrew) {
  return { width: '100%', padding: '11px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', minHeight: '44px' };
}

const primaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: NEON.gradient, color: 'white', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };
const secondaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, padding: '12px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };
