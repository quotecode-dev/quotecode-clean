import { useState, useEffect, useRef } from 'react';
import { X, Package, Ruler, BookOpen, ChevronRight, ChevronLeft, Lock, Check, Pencil } from 'lucide-react';
import { LIGHT as NEON } from '../theme/neonTheme';
import { cmToM, computeMeasurementValue, resolveCalculationMethod } from '../utils/professionalQuoteItem';

// חוק ברזל (Owner-Approved Smart Quote UX, Stage 2): מנגנון-הוספה מודרך
// יחיד, המחליף את שלושת מנגנוני-ההוספה שהיו גלויים בו-זמנית (כפתור "הוסף
// פריט" ריק, בורר "הוספה מהירה" מהקטלוג, ולוגיקת-פריט-מקצועי שהופיעה רק
// אחרי ההוספה) - לא מחליף/משכפל את מנוע-החישוב הקיים: בונה אובייקט-פריט
// יחיד, בצורה הזהה-בייט לצורה שכבר מיוצרת היום ע"י handleProfessionalUnitChange
// + addMeasurementRow + handleMeasurementChange יחד (Dashboard.jsx), ומוסיף
// אותו במחיקה אטומית אחת (setItems([...items, newItem])) - בדיוק כמו
// שה-handleCatalogAdd/handleAddFromCatalog הקיימים כבר עושים היום. אין כאן
// נוסחת-חישוב חדשה: cmToM/computeMeasurementValue/resolveCalculationMethod
// הם אותם עוזרים טהורים ש-Dashboard.jsx כבר משתמש בהם.
//
// למה בנייה אטומית ולא קריאה חוזרת ל-addItem+handleItemChange הקיימים:
// addItem/handleItemChange (Dashboard.jsx) קוראים את items מה-closure החיצוני
// ולא משתמשים בטופס-הפונקציה (prev => ...) - קריאה כפולה סינכרונית לשניהם
// (או לכמה handleItemChange ברצף) באותו tick היתה עלולה לדרוס שינוי אחד עם
// השני (התנהגות React batching אמיתית, לא היפותטית). בניית אובייקט-פריט
// שלם אחד מראש, ואז setItems יחיד, נמנעת מהסיכון הזה לגמרי.

const STEPS = { CHOOSE_METHOD: 1, DESCRIBE: 2, QUANTIFY: 3, REVIEW: 4 };

export default function AddItemWizard({
  isOpen,
  onClose,
  onAdd,
  isHebrew,
  sym,
  formatNum,
  services,
  sections,
  defaultSectionKey,
  canUseProfessionalQuotes,
  onRequestUpgrade,
}) {
  const [step, setStep] = useState(STEPS.CHOOSE_METHOD);
  const [method, setMethod] = useState(null); // 'units' | 'measure' | 'catalog'
  const [description, setDescription] = useState('');
  const [catalogServiceId, setCatalogServiceId] = useState('');
  const [measureType, setMeasureType] = useState('area'); // 'area' | 'linear'
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [sectionKey, setSectionKey] = useState(defaultSectionKey || '');
  const [specRows, setSpecRows] = useState([]);
  const [showSpec, setShowSpec] = useState(false);
  const [errors, setErrors] = useState({});
  const firstFieldRef = useRef(null);
  const dialogRef = useRef(null);
  const triggerElRef = useRef(null);

  // חוק ברזל (Owner Visual Review - Correction 1, "Make progress
  // understandable"): מחוון-שלב מגיב לרוחב - אותה טכניקת matchMedia שכבר
  // הוכיחה את עצמה ב-PublicQuoteHeader.jsx (isMobileView), לא ספריה חדשה.
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
    if (isOpen) {
      setStep(STEPS.CHOOSE_METHOD);
      setMethod(null);
      setDescription('');
      setCatalogServiceId('');
      setMeasureType('area');
      setWidthCm('');
      setHeightCm('');
      setQuantity('1');
      setUnitPrice('');
      setSectionKey(defaultSectionKey || '');
      setSpecRows([]);
      setShowSpec(false);
      setErrors({});
    }
  }, [isOpen, defaultSectionKey]);

  // חוק ברזל (Owner Visual Review - "full keyboard-only traversal, modal
  // focus entry/containment/return" - נבדק חי, נמצא באג אמיתי): לפני התיקון,
  // firstFieldRef קיים רק בשלבי DESCRIBE/QUANTIFY (יש שדה קלט) - בשלב
  // CHOOSE_METHOD הראשון (בלי שדות) שום דבר לא קיבל focus בכלל, גם עם
  // לחיצת-עכבר אמיתית (נמדד חי: document.activeElement נשאר BODY אחרי
  // פתיחת האשף) - משתמש מקלדת לא יודע היכן הוא נמצא. תוקן: נופל-חזרה
  // ל-dialogRef עצמו (tabIndex=-1, לא חלק מסדר-Tab הרגיל, רק יעד-focus
  // תכנותי) כשאין firstFieldRef בשלב הנוכחי.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus();
      else dialogRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, step]);

  // חוק ברזל (Modal focus entry/return - נבדק חי): שומר את האלמנט שהיה
  // ממוקד רגע לפני הפתיחה (בדרך כלל כפתור "הוסף פריט להצעה" עצמו) ומחזיר
  // אליו focus בסגירה - כך שמשתמש-מקלדת לא "נזרק" לתחילת הדף אחרי סגירה.
  useEffect(() => {
    if (isOpen) {
      triggerElRef.current = document.activeElement;
    } else if (triggerElRef.current && document.body.contains(triggerElRef.current)) {
      triggerElRef.current.focus();
      triggerElRef.current = null;
    }
  }, [isOpen]);

  // חוק ברזל (Modal focus containment - נבדק חי): Tab/Shift+Tab בקצה
  // רשימת-האלמנטים-הממוקדים-בפועל בתוך הדיאלוג עוטף חזרה לקצה השני, במקום
  // לברוח לתוכן שמאחורי ה-overlay (שלא אמור להיות נגיש בכלל בזמן שהדיאלוג
  // פתוח). מחושב מחדש בכל Tab (לא unknown-list פעם אחת) כי שלבי האשף
  // מחליפים את השדות הגלויים לגמרי בין שלב לשלב.
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
    title: isHebrew ? 'הוסף פריט להצעה' : 'Add item to quote',
    step1Title: isHebrew ? 'איך תרצה להוסיף את הפריט?' : 'How would you like to add this item?',
    byUnits: isHebrew ? 'לפי יחידות' : 'By units',
    byUnitsDesc: isHebrew ? 'מוצרים, שעות, משקל, ימים או כמות פשוטה' : 'Products, hours, weight, days, or simple quantities',
    byMeasure: isHebrew ? 'לפי שטח או אורך' : 'By area or length',
    byMeasureDesc: isHebrew ? 'חלונות, דלתות, ריצוף ועבודות נמדדות' : 'Windows, doors, flooring, and measured work',
    fromCatalog: isHebrew ? 'מהקטלוג שלי' : 'From my catalog',
    fromCatalogDesc: isHebrew ? 'בחר פריט קיים מהקטלוג' : 'Choose an existing catalog item',
    step2TitleUnits: isHebrew ? 'מה אתה מוסיף?' : 'What are you adding?',
    step2TitleCatalog: isHebrew ? 'בחר פריט מהקטלוג' : 'Choose a catalog item',
    descLabel: isHebrew ? 'שם / תיאור הפריט' : 'Item name / description',
    descPlaceholder: isHebrew ? 'לדוגמה: חלון אלומיניום' : 'e.g. Aluminum window',
    catalogPick: isHebrew ? 'בחר פריט...' : 'Select an item...',
    step3TitleUnits: isHebrew ? 'כמות ומחיר' : 'Quantity & price',
    step3TitleMeasure: isHebrew ? 'הזן את מידות הפריט' : 'Enter the item measurements',
    area: isHebrew ? 'שטח (רוחב × גובה)' : 'Area (width × height)',
    linear: isHebrew ? 'אורך' : 'Length',
    widthCm: isHebrew ? 'רוחב (ס"מ)' : 'Width (cm)',
    heightCm: isHebrew ? 'גובה (ס"מ)' : 'Height (cm)',
    lengthCm: isHebrew ? 'אורך (ס"מ)' : 'Length (cm)',
    quantity: isHebrew ? 'כמות' : 'Quantity',
    unitPrice: isHebrew ? 'מחיר ליחידה' : 'Unit price',
    unitPriceArea: isHebrew ? 'מחיר לכל מ"ר' : 'Price per m²',
    unitPriceLinear: isHebrew ? 'מחיר לכל מטר' : 'Price per metre',
    step4Title: isHebrew ? 'סקירה והוספה' : 'Review and add',
    specToggle: isHebrew ? 'פרטים שיופיעו ללקוח — לא משפיעים על המחיר' : 'Details shown to the customer — do not affect price',
    specLabel: isHebrew ? 'תווית' : 'Label',
    specValue: isHebrew ? 'ערך' : 'Value',
    addSpecRow: isHebrew ? '+ הוסף שורת פרט' : '+ Add detail row',
    section: isHebrew ? 'קטגוריה (אופציונלי)' : 'Section (optional)',
    noSection: isHebrew ? 'ללא קטגוריה' : 'No section',
    back: isHebrew ? 'חזרה' : 'Back',
    next: isHebrew ? 'הבא' : 'Next',
    addItem: isHebrew ? 'הוסף פריט' : 'Add item',
    cancel: isHebrew ? 'ביטול' : 'Cancel',
    edit: isHebrew ? 'ערוך' : 'Edit',
    editItemType: isHebrew ? 'ערוך סוג פריט' : 'Edit item type',
    itemNameGroupLabel: isHebrew ? 'שם ופרטי הפריט' : 'Item name & details',
    calcGroupLabel: isHebrew ? 'חישוב ותמחור' : 'Calculation & pricing',
    methodLabel: isHebrew ? 'שיטת חישוב' : 'Calculation method',
    methodUnits: isHebrew ? 'לפי יחידות' : 'By units',
    methodArea: isHebrew ? 'לפי שטח' : 'By area',
    methodLinear: isHebrew ? 'לפי אורך' : 'By length',
    methodCatalog: isHebrew ? 'מהקטלוג' : 'From catalog',
    dimensionsLabel: isHebrew ? 'מידות' : 'Dimensions',
    finalQuantityLabel: isHebrew ? 'כמות סופית' : 'Final quantity',
    sectionSummaryLabel: isHebrew ? 'קטגוריה' : 'Section',
    specSummaryLabel: isHebrew ? 'פרטים ללקוח' : 'Customer-visible details',
    // חוק ברזל (Owner Visual Review - Correction 1): תוויות מחוון-השלב -
    // "מספר+תווית", לא רק פס-צבע. אותם 4 שלבים בדיוק (STEPS למעלה), לא
    // רשימה נפרדת שעלולה להתפצל מהם עם הזמן.
    stepLabels: isHebrew
      ? ['סוג הפריט', 'פרטי הפריט', 'חישוב', 'סיכום']
      : ['Item type', 'Item details', 'Calculation', 'Review'],
    stepOfTotal: isHebrew ? (n, total) => `שלב ${n} מתוך ${total}` : (n, total) => `Step ${n} of ${total}`,
    missingDescription: isHebrew ? 'יש להזין שם או תיאור לפריט' : 'Please enter a name or description for this item',
    missingCatalog: isHebrew ? 'יש לבחור פריט מהקטלוג' : 'Please choose a catalog item',
    missingWidth: isHebrew ? 'יש להזין רוחב גדול מ-0' : 'Please enter a width greater than 0',
    missingHeight: isHebrew ? 'יש להזין גובה גדול מ-0 (או בחר "אורך" אם אין גובה רלוונטי)' : 'Please enter a height greater than 0 (or choose "Length" if height doesn\'t apply)',
    missingLength: isHebrew ? 'יש להזין אורך גדול מ-0' : 'Please enter a length greater than 0',
    missingQuantity: isHebrew ? 'יש להזין כמות גדולה מ-0' : 'Please enter a quantity greater than 0',
    missingPrice: isHebrew ? 'יש להזין מחיר' : 'Please enter a price',
    upgradeNeeded: isHebrew ? 'הצעות מחיר לפי מדידה זמינות במסלול Basic ומעלה' : 'Measurement-based quotes are available on the Basic plan and above',
    upgradeCta: isHebrew ? 'שדרג מסלול' : 'Upgrade plan',
    calcPreviewArea: isHebrew ? (w, h, m2) => `${w} × ${h} ס"מ = ${m2} מ"ר` : (w, h, m2) => `${w} × ${h} cm = ${m2} m²`,
    calcPreviewLinear: isHebrew ? (l, m) => `${l} ס"מ = ${m} מטר אורך` : (l, m) => `${l} cm = ${m} linear meters`,
    calcPreviewTotal: isHebrew ? (qty, unit, price, total) => `${qty} ${unit} × ${sym}${price} = ${sym}${total}` : (qty, unit, price, total) => `${qty} ${unit} × ${sym}${price} = ${sym}${total}`,
  };

  // חישוב-תצוגה חי - אותם עוזרים קנוניים בדיוק כמו Dashboard.jsx, לא נוסחה
  // עצמאית. widthCm/heightCm מומרים למטרים רק לצורך החישוב/האחסון הסופי -
  // התצוגה עצמה תמיד בס"מ, לפי דרישת הבעלים המפורשת.
  const widthM = cmToM(widthCm);
  const heightM = cmToM(heightCm);
  const calculationMethod = method === 'measure' ? measureType : null;
  const calculatedValue = method === 'measure'
    ? computeMeasurementValue(calculationMethod, widthM, calculationMethod === 'linear' ? undefined : heightM)
    : null;

  function validateStep() {
    const e = {};
    if (step === STEPS.DESCRIBE) {
      if (method === 'catalog') {
        if (!catalogServiceId) e.catalog = t.missingCatalog;
      } else if (!description.trim()) {
        e.description = t.missingDescription;
      }
    }
    if (step === STEPS.QUANTIFY) {
      if (method === 'units') {
        if (!(Number(quantity) > 0)) e.quantity = t.missingQuantity;
        if (unitPrice === '' || Number.isNaN(Number(unitPrice))) e.unitPrice = t.missingPrice;
      } else if (method === 'measure') {
        if (!(Number(widthCm) > 0)) e.width = measureType === 'linear' ? t.missingLength : t.missingWidth;
        if (measureType === 'area' && !(Number(heightCm) > 0)) e.height = t.missingHeight;
        if (unitPrice === '' || Number.isNaN(Number(unitPrice))) e.unitPrice = t.missingPrice;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (!validateStep()) return;
    if (step === STEPS.CHOOSE_METHOD) {
      if (method === 'catalog') {
        const svc = services.find((s) => String(s.id) === String(catalogServiceId));
        if (svc) { setDescription(svc.name); setUnitPrice(String(svc.price)); }
        setStep(STEPS.REVIEW);
        return;
      }
      setStep(STEPS.DESCRIBE);
      return;
    }
    if (step === STEPS.DESCRIBE) {
      setStep(STEPS.QUANTIFY);
      return;
    }
    if (step === STEPS.QUANTIFY) {
      setStep(STEPS.REVIEW);
    }
  }

  function goBack() {
    setErrors({});
    if (step === STEPS.REVIEW && method === 'catalog') { setStep(STEPS.CHOOSE_METHOD); return; }
    setStep((s) => Math.max(STEPS.CHOOSE_METHOD, s - 1));
  }

  // חוק ברזל (Owner Visual Review - Correction 3, "ערוך/Edit action beside
  // each logical review group"): קפיצה ישירה לשלב הרצוי, בלי validateStep()
  // (לעולם לא חוסם קפיצה-לתיקון בגלל שדה *אחר* עדיין לא תקין) ובלי לאפס
  // אף ערך שכבר הוזן - כל ה-state כבר חי ברמת הרכיב, לא ברמת-השלב, כך
  // שמעבר שלבים כאן זהה לגמרי ל-Back/Next הקיימים מבחינת שימור-נתונים.
  function goToStep(target) {
    setErrors({});
    setStep(target);
  }

  function chooseMethod(m) {
    if (m === 'measure' && !canUseProfessionalQuotes) {
      onRequestUpgrade?.();
      return;
    }
    setMethod(m);
  }

  function handleConfirm() {
    // חוק ברזל: הנתיב מ-CHOOSE_METHOD ישר ל-REVIEW (קטלוג) מדלג על שלבי
    // DESCRIBE/QUANTIFY הרגילים לגמרי - האימות שלהם (validateStep, שתלוי
    // ב-step הנוכחי) לעולם לא רץ עליו, אז נבדק כאן במפורש לפני ההוספה
    // בפועל, לא רק ב-goNext. נתפס ע"י בדיקת-רגרסיה אמיתית (AddItemWizard.test.jsx).
    if (method === 'catalog' && !catalogServiceId) {
      setErrors({ catalog: t.missingCatalog });
      return;
    }
    let newItem;
    const finalSectionKey = sectionKey || null;
    if (method === 'catalog') {
      const svc = services.find((s) => String(s.id) === String(catalogServiceId));
      newItem = {
        description: svc ? svc.name : description,
        quantity: '1',
        unit_price: svc ? svc.price : unitPrice,
        isFromCatalog: true,
        section_key: finalSectionKey,
      };
    } else if (method === 'measure') {
      const calcMethod = resolveCalculationMethod(measureType === 'linear' ? 'linear_meter' : 'm2', 'calculated');
      const measurementRow = {
        width: widthM,
        height: measureType === 'linear' ? '' : heightM,
        unit: 'm',
        calculated_area: calculatedValue,
        label: '',
        is_pricing_driving: true,
      };
      newItem = {
        description,
        quantity: '1',
        unit_price: unitPrice,
        isFromCatalog: false,
        section_key: finalSectionKey,
        pricing_unit: measureType === 'linear' ? 'linear_meter' : 'm2',
        quantity_source: 'calculated',
        calculation_method: calcMethod,
        measurements: [measurementRow],
        calculated_quantity: calculatedValue != null ? calculatedValue : '',
      };
    } else {
      newItem = {
        description,
        quantity: quantity || '1',
        unit_price: unitPrice,
        isFromCatalog: false,
        section_key: finalSectionKey,
      };
    }
    if (specRows.length > 0) {
      newItem.specification = specRows.filter((r) => r.label.trim() || r.value.trim());
    }
    onAdd(newItem);
    onClose();
  }

  const dir = isHebrew ? 'rtl' : 'ltr';
  // חוק ברזל (Owner Visual Review - Correction 3, באג אמיתי שנתפס חי
  // בבדיקת-דפדפן עם קטלוג לא-ריק אמיתי): בחירת פריט-קטלוג קורית *בתוך*
  // שלב REVIEW עצמו (ה-<select> יושב שם, לא בשלב נפרד) - onChange שלו
  // מעדכן רק catalogServiceId, לעולם לא unitPrice/description (אלה
  // מסונכרנים רק בנתיב-הקיצור מ-goNext, שרץ *לפני* שהמשתמש בכלל בחר
  // משהו כשה-catalog select יושב ב-REVIEW). handleConfirm כבר היה נכון
  // (מחפש services.find(...) מחדש בזמן-האישור עצמו, לא unitPrice) - כך
  // שהפריט הסופי-שנשמר תמיד קיבל את המחיר הנכון, אבל תצוגת ה-total
  // *החיה* בזמן שהמשתמש עדיין בוחן קטלוג הציגה $0.00 באופן מטעה. תוקן
  // ע"י אותו lookup-מחדש בדיוק, לא unitPrice הבלתי-מסונכרן.
  const selectedCatalogService = method === 'catalog'
    ? services.find((s) => String(s.id) === String(catalogServiceId))
    : null;
  const total = method === 'units'
    ? (Number(quantity) || 0) * (Number(unitPrice) || 0)
    : method === 'measure'
      ? (calculatedValue != null ? calculatedValue * (Number(unitPrice) || 0) : null)
      : method === 'catalog'
        ? (selectedCatalogService ? Number(selectedCatalogService.price) || 0 : null)
        : (Number(unitPrice) || 0);

  // חוק ברזל (Owner Visual Review - Correction 2/3, "live plain-language
  // calculation block" + "complete pricing formula on review"): נקודת-
  // בנייה יחידה לטקסט-הנוסחה המלאה (כמות/מידה × מחיר = סה"כ), משמשת גם
  // בשלב QUANTIFY (תצוגה חיה) וגם בשלב REVIEW (הנוסחה המלאה) - כדי שלא
  // תהיינה שתי מחרוזות-נוסחה עצמאיות שעלולות להתפצל. משתמש רק בערכים
  // שכבר חושבו למעלה (total/calculatedValue/unitPrice) - אין כאן חישוב
  // שני, רק פורמט-טקסט.
  const priceIsValid = unitPrice !== '' && !Number.isNaN(Number(unitPrice)) && Number(unitPrice) >= 0;
  let formulaText = null;
  if (priceIsValid && total != null) {
    if (method === 'measure' && calculatedValue != null) {
      const unitWord = measureType === 'area' ? (isHebrew ? 'מ"ר' : 'm²') : (isHebrew ? 'מטר אורך' : 'linear meters');
      formulaText = t.calcPreviewTotal(calculatedValue.toFixed(2), unitWord, formatNum ? formatNum(unitPrice) : unitPrice, formatNum ? formatNum(total) : total.toFixed(2));
    } else if (method === 'units' && Number(quantity) > 0) {
      formulaText = t.calcPreviewTotal(quantity, '', formatNum ? formatNum(unitPrice) : unitPrice, formatNum ? formatNum(total) : total.toFixed(2)).replace('  ×', ' ×');
    }
  }

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
      <div style={{ background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${NEON.border}` }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: NEON.textPrimary }}>{t.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, display: 'flex', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* חוק ברזל (Owner Visual Review - Correction 1, "Make progress
            understandable"): 4 פסים סתמיים (סגול/אפור) הוחלפו במחוון שמתקשר
            גם מספר וגם תווית - "מה זה אומר" לא רק "כמה נשאר". ברוחב צר,
            קורס לשם-השלב הנוכחי + "שלב X מתוך 4" בשורה אחת (בלי הצפה
            אופקית, בלי הקטנת-טקסט מתחת לגודל קריא) - בדיוק כפי שהבעלים
            ביקש במפורש, לא הנחשה עצמאית. */}
        <StepIndicator step={step} isHebrew={isHebrew} isNarrow={isNarrow} labels={t.stepLabels} stepOfTotal={t.stepOfTotal} />

        <div style={{ padding: '20px' }}>
          {step === STEPS.CHOOSE_METHOD && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '14px' }}>{t.step1Title}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <MethodCard icon={<Package size={22} />} title={t.byUnits} desc={t.byUnitsDesc} onClick={() => chooseMethod('units')} selected={method === 'units'} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseMethod('units'); } }} />
                <MethodCard icon={<Ruler size={22} />} title={t.byMeasure} desc={t.byMeasureDesc} onClick={() => chooseMethod('measure')} selected={method === 'measure'} locked={!canUseProfessionalQuotes} lockedLabel={t.upgradeNeeded} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseMethod('measure'); } }} />
                <MethodCard icon={<BookOpen size={22} />} title={t.fromCatalog} desc={t.fromCatalogDesc} onClick={() => chooseMethod('catalog')} selected={method === 'catalog'} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseMethod('catalog'); } }} />
              </div>
            </div>
          )}

          {step === STEPS.DESCRIBE && method !== 'catalog' && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '14px' }}>{t.step2TitleUnits}</h3>
              <FieldLabel htmlFor="wiz-description">{t.descLabel}</FieldLabel>
              <input
                id="wiz-description"
                ref={firstFieldRef}
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descPlaceholder}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'wiz-description-error' : undefined}
                style={inputStyle(isHebrew)}
              />
              {errors.description && <ErrorText id="wiz-description-error">{errors.description}</ErrorText>}
            </div>
          )}

          {step === STEPS.QUANTIFY && method === 'units' && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '14px' }}>{t.step3TitleUnits}</h3>
              <FieldLabel htmlFor="wiz-quantity">{t.quantity}</FieldLabel>
              <input id="wiz-quantity" ref={firstFieldRef} type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? 'wiz-quantity-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.quantity && <ErrorText id="wiz-quantity-error">{errors.quantity}</ErrorText>}
              <FieldLabel htmlFor="wiz-unit-price">{t.unitPrice}</FieldLabel>
              <input id="wiz-unit-price" type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitprice-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitprice-error">{errors.unitPrice}</ErrorText>}
            </div>
          )}

          {step === STEPS.QUANTIFY && method === 'measure' && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '14px' }}>{t.step3TitleMeasure}</h3>
              <div role="radiogroup" aria-label={t.step3TitleMeasure} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <ToggleBtn active={measureType === 'area'} onClick={() => setMeasureType('area')}>{t.area}</ToggleBtn>
                <ToggleBtn active={measureType === 'linear'} onClick={() => setMeasureType('linear')}>{t.linear}</ToggleBtn>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: measureType === 'area' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                <div>
                  <FieldLabel htmlFor="wiz-width">{measureType === 'linear' ? t.lengthCm : t.widthCm}</FieldLabel>
                  <input id="wiz-width" ref={firstFieldRef} type="number" min="0" step="any" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} aria-invalid={!!errors.width} aria-describedby={errors.width ? 'wiz-width-error' : undefined} style={inputStyle(isHebrew)} />
                  {errors.width && <ErrorText id="wiz-width-error">{errors.width}</ErrorText>}
                </div>
                {measureType === 'area' && (
                  <div>
                    <FieldLabel htmlFor="wiz-height">{t.heightCm}</FieldLabel>
                    <input id="wiz-height" type="number" min="0" step="any" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} aria-invalid={!!errors.height} aria-describedby={errors.height ? 'wiz-height-error' : undefined} style={inputStyle(isHebrew)} />
                    {errors.height && <ErrorText id="wiz-height-error">{errors.height}</ErrorText>}
                  </div>
                )}
              </div>
              {calculatedValue != null && (
                <div aria-live="polite" style={{ marginTop: '10px', fontSize: '0.85rem', color: NEON.violetLight, fontWeight: '600' }}>
                  {measureType === 'area' ? t.calcPreviewArea(widthCm, heightCm, calculatedValue.toFixed(2)) : t.calcPreviewLinear(widthCm, calculatedValue.toFixed(2))}
                </div>
              )}
              <FieldLabel htmlFor="wiz-unit-price-m">{measureType === 'area' ? t.unitPriceArea : t.unitPriceLinear}</FieldLabel>
              <input id="wiz-unit-price-m" type="number" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitpricem-error' : undefined} style={inputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitpricem-error">{errors.unitPrice}</ErrorText>}
              {/* חוק ברזל (Owner Visual Review - Correction 2, "live, plain-
                  language calculation block before the Next button"): שורה
                  שנייה - שטח/אורך × מחיר = סה"כ - מופיעה תוך כדי הקלדה,
                  לפני כפתור הבא, בדיוק כפי שהבעלים דרש (הדוגמה: "3.60 מ"ר
                  × ₪300 = ₪1,080"). formulaText מחושב פעם אחת למעלה
                  (משותף עם REVIEW) - אין נוסחה עצמאית שנייה כאן. */}
              {formulaText && (
                <div aria-live="polite" style={{ marginTop: '8px', fontSize: '0.9rem', color: NEON.violet, fontWeight: '800' }}>
                  {formulaText}
                </div>
              )}
            </div>
          )}

          {step === STEPS.REVIEW && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, margin: 0 }}>{t.step4Title}</h3>
                {/* חוק ברזל (Owner Visual Review - Correction 3, "ערוך/Edit
                    ליד כל קבוצה לוגית"): קבוצת "סוג הפריט" עצמה - קופצת
                    ל-CHOOSE_METHOD לכל method (גם קטלוג), כדי לאפשר להחליף
                    שיטת-הוספה שלמה בלי ללחוץ Back שוב ושוב. */}
                <EditLink label={t.editItemType} onClick={() => goToStep(STEPS.CHOOSE_METHOD)} />
              </div>

              {method === 'catalog' && (
                <div style={{ marginBottom: '14px' }}>
                  <FieldLabel htmlFor="wiz-catalog-select">{t.step2TitleCatalog}</FieldLabel>
                  <select id="wiz-catalog-select" value={catalogServiceId} onChange={(e) => setCatalogServiceId(e.target.value)} aria-invalid={!!errors.catalog} style={inputStyle(isHebrew)}>
                    <option value="">{t.catalogPick}</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name} - {sym}{formatNum ? formatNum(s.price) : s.price}</option>)}
                  </select>
                  {errors.catalog && <ErrorText>{errors.catalog}</ErrorText>}
                </div>
              )}

              {/* קבוצה 1: שם ופרטי הפריט - Edit קופץ ל-DESCRIBE (לא קיים
                  לקטלוג - שם הפריט שם נגזר מהבחירה עצמה, אין שלב תיאור
                  נפרד לערוך). */}
              {method !== 'catalog' && (
                <ReviewGroup label={t.itemNameGroupLabel} isHebrew={isHebrew} onEdit={() => goToStep(STEPS.DESCRIBE)} editLabel={t.edit}>
                  <div style={{ fontWeight: '700', color: NEON.textPrimary }}>{description || '—'}</div>
                </ReviewGroup>
              )}

              {/* קבוצה 2: חישוב ותמחור - שיטה, מידות/כמות, מחיר-ליחידה,
                  כמות סופית, הנוסחה המלאה - כל השדות שהבעלים מנה במפורש,
                  לא רק מידות+סה"כ כמו קודם. Edit קופץ ל-QUANTIFY (לא קיים
                  לקטלוג - אין שלב כימות נפרד, המחיר מגיע מהקטלוג עצמו). */}
              {method !== 'catalog' && (
                <ReviewGroup label={t.calcGroupLabel} isHebrew={isHebrew} onEdit={() => goToStep(STEPS.QUANTIFY)} editLabel={t.edit}>
                  <SummaryRow label={t.methodLabel} value={method === 'units' ? t.methodUnits : (measureType === 'area' ? t.methodArea : t.methodLinear)} isHebrew={isHebrew} />
                  {method === 'measure' && (
                    <SummaryRow
                      label={t.dimensionsLabel}
                      value={measureType === 'area' ? `${widthCm || '—'} × ${heightCm || '—'} ${isHebrew ? 'ס"מ' : 'cm'}` : `${widthCm || '—'} ${isHebrew ? 'ס"מ' : 'cm'}`}
                      isHebrew={isHebrew}
                    />
                  )}
                  {method === 'units' && <SummaryRow label={t.quantity} value={quantity || '—'} isHebrew={isHebrew} />}
                  <SummaryRow label={method === 'units' ? t.unitPrice : (measureType === 'area' ? t.unitPriceArea : t.unitPriceLinear)} value={unitPrice !== '' ? `${sym}${formatNum ? formatNum(unitPrice) : unitPrice}` : '—'} isHebrew={isHebrew} />
                  {method === 'measure' && calculatedValue != null && (
                    <SummaryRow label={t.finalQuantityLabel} value={calculatedValue.toFixed(2)} isHebrew={isHebrew} />
                  )}
                  {formulaText && (
                    <div aria-live="polite" style={{ marginTop: '6px', fontSize: '0.85rem', color: NEON.violet, fontWeight: '700' }}>
                      {formulaText}
                    </div>
                  )}
                </ReviewGroup>
              )}

              <div style={{ background: NEON.bgCardAlt, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                {method === 'catalog' && (
                  <div style={{ fontWeight: '700', color: NEON.textPrimary, marginBottom: '6px' }}>{services.find((s) => String(s.id) === String(catalogServiceId))?.name || '—'}</div>
                )}
                {total != null && (
                  <div aria-live="polite" style={{ fontSize: '0.95rem', color: NEON.violet, fontWeight: '800' }}>
                    {sym}{formatNum ? formatNum(total) : total.toFixed(2)}
                  </div>
                )}
              </div>

              {sections && sections.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <FieldLabel htmlFor="wiz-section">{t.section}</FieldLabel>
                  <select id="wiz-section" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} style={inputStyle(isHebrew)}>
                    <option value="">{t.noSection}</option>
                    {sections.map((s) => <option key={s.key} value={s.key}>{s.name || t.noSection}</option>)}
                  </select>
                </div>
              )}

              <button type="button" onClick={() => setShowSpec((v) => !v)} aria-expanded={showSpec} style={{ background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '8px', display: 'block' }}>
                {t.specToggle}
              </button>
              {showSpec && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {specRows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px' }}>
                      <input aria-label={t.specLabel} placeholder={t.specLabel} value={row.label} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, label: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                      <input aria-label={t.specValue} placeholder={t.specValue} value={row.value} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, value: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                    </div>
                  ))}
                  <button type="button" onClick={() => setSpecRows((rows) => [...rows, { label: '', value: '' }])} style={{ background: 'none', border: `1px dashed ${NEON.borderStrong}`, borderRadius: '8px', padding: '6px', color: NEON.textSecondary, fontSize: '0.78rem', cursor: 'pointer' }}>{t.addSpecRow}</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderTop: `1px solid ${NEON.border}` }}>
          <button type="button" onClick={step === STEPS.CHOOSE_METHOD ? onClose : goBack} style={secondaryBtnStyle}>
            {isHebrew ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {step === STEPS.CHOOSE_METHOD ? t.cancel : t.back}
          </button>
          {step === STEPS.REVIEW ? (
            <button type="button" onClick={handleConfirm} style={primaryBtnStyle}>{t.addItem}</button>
          ) : (
            <button type="button" onClick={goNext} disabled={step === STEPS.CHOOSE_METHOD && !method} style={{ ...primaryBtnStyle, opacity: (step === STEPS.CHOOSE_METHOD && !method) ? 0.5 : 1, cursor: (step === STEPS.CHOOSE_METHOD && !method) ? 'not-allowed' : 'pointer' }}>
              {t.next}
              {isHebrew ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// חוק ברזל (Owner Visual Review - Correction 1): מחוון-שלב נגיש - כל שלב
// עצמו נושא aria-current כשהוא הנוכחי, וה-wrapper כולו נושא role="progressbar"
// עם aria-valuenow/aria-valuetext כדי שקורא-מסך יכריז "שלב 2 מתוך 4: פרטי
// הפריט" בלי צורך בטקסט חוזר-על-עצמו כפול. ברוחב רגיל: 4 "צעדים" מחוברים
// בקו, כל אחד עם עיגול-מספר (✓ לשלמים) + תווית קצרה מתחתיו. ברוחב צר:
// שורה אחת - שם השלב הנוכחי (מודגש) + "שלב X מתוך 4" (מוחלש), מעליה פס-
// התקדמות דק אחד - לא 4 עיגולים שיציפו רוחב מובייל צר.
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
        style={{ padding: '12px 20px 0' }}
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
      style={{ display: 'flex', padding: '14px 20px 0', gap: '4px' }}
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

function MethodCard({ icon, title, desc, onClick, selected, locked, lockedLabel, onKeyDown }) {
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
      }}
    >
      <div style={{ color: locked ? NEON.textMuted : NEON.violetLight, flexShrink: 0 }}>{locked ? <Lock size={22} /> : icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.92rem' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: NEON.textSecondary }}>{locked ? lockedLabel : desc}</div>
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

function ToggleBtn({ active, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${active ? NEON.violet : NEON.borderStrong}`, background: active ? 'rgba(139,92,246,0.1)' : NEON.bgInput, color: active ? NEON.violet : NEON.textPrimary, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

// חוק ברזל (Owner Visual Review - Correction 3): כפתור-קישור זעיר, לא
// כפתור-פעולה ראשי - שינוי-שלב הוא ניווט משני, לא צריך לתחרות חזותית עם
// "הוסף פריט"/"הבא".
function EditLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: '2px 4px' }}>
      <Pencil size={11} strokeWidth={2.5} />
      {label}
    </button>
  );
}

// חוק ברזל (Owner Visual Review - Correction 3, "כל קבוצה לוגית + Edit"):
// עטיפה משותפת אחת לכל קבוצת-סקירה (כותרת+Edit בשורה אחת, תוכן מתחת) -
// כדי ששתי הקבוצות (שם/פרטים, חישוב/תמחור) ייראו עקביות זו לזו, לא שתי
// מבנים עצמאיים שעלולים להתפצל בעיצוב עם הזמן.
function ReviewGroup({ label, isHebrew, onEdit, editLabel, children }) {
  return (
    <div style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: NEON.textMuted, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
        <EditLink label={editLabel} onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

// חוק ברזל (Owner Visual Review - Correction 3, "Clearly show ... unit
// price, final quantity ..."): שורת תווית/ערך אחידה לכל השדות שהבעלים
// מנה במפורש - נקודת-רינדור יחידה כדי שכולן ייראו זהות (יישור, גודל-גופן).
function SummaryRow({ label, value, isHebrew }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
      <span style={{ color: NEON.textSecondary }}>{label}</span>
      <span style={{ color: NEON.textPrimary, fontWeight: '600' }}>{value}</span>
    </div>
  );
}

function inputStyle(isHebrew) {
  return { width: '100%', padding: '11px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left' };
}

const primaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: NEON.gradient, color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' };
const secondaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, padding: '10px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' };
