import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { parsePriceInput } from '../utils/itemPrice';
import AiModalHeader from './AiModalHeader';
import { X, Package, Ruler, ChevronRight, ChevronLeft, Lock, Check, Pencil, Sparkles } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { formatMoneyForCurrency } from '../utils/money';
import { cmToM, mToCm, computeMeasurementValue, resolveCalculationMethod, getActiveQuantity, sumMeasurementAreas, isMeasurableUnit, getProfessionalUnitLabel } from '../utils/professionalQuoteItem';
import { askConfirm } from './AppDialog';

// Task 34 extension (Owner AI specification, section ג): a MANUAL quantity with a measured unit (36 m², 8 linear meters, no measurement
// rows - the AI-draft hand-off / the form's manual override) is a charged quantity in its own right: the unit is not proof that the quantity
// came from dimensions. Such an item opens on its manual quantity (with its unit), never on invented width / height.
const isManualMeasured = (item) => !!item && isMeasurableUnit(item.pricing_unit) && item.quantity_source === 'manual'
  && !(Array.isArray(item.measurements) && item.measurements.length > 0);

// Task 39: the stored item description limit (quote_items.description varchar(255)).
export const ITEM_DESCRIPTION_MAX = 255;

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

// Owner round 1 (2026-10-15, Codex spec A2 / A4, plan approved: "זה מעולה"): TWO screens - the item (what + how it is priced + the
// numbers, all four methods visible) and the check. The live step ids reported to the AI context stay what / pricing / details /
// review (derived from progress on the item screen), so the chat contract is unchanged.
const STEPS = { ITEM: 1, REVIEW: 2 };
const ALL_METHODS = ['fixed', 'units', 'area', 'linear'];
// A4: sizes are typed in cm (default) or m; the stored measurements stay canonical metres.
const round4 = (n) => Math.round(n * 10000) / 10000;
const convertSizeText = (v, toUnit) => {
  if (v === '' || v == null || !Number.isFinite(Number(v))) return v;
  return String(round4(toUnit === 'm' ? Number(v) / 100 : Number(v) * 100));
};

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
  const pricingMethod = isManualMeasured(item)
    ? 'units'
    : item.pricing_unit === 'linear_meter'
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
// Owner round 1 (A2): every method is visible; the business recommendation (advisory only) comes first.
function getOrderedMethods(recommendedMethod) {
  if (recommendedMethod && ALL_METHODS.includes(recommendedMethod)) return [recommendedMethod, ...ALL_METHODS.filter((m) => m !== recommendedMethod)];
  return ALL_METHODS;
}

// R-23 (night task 2026-10-16): the wizard accepts exactly what "Edit price" accepts (utils/itemPrice.js parsePriceInput: '.' decimal point,
// up to 2 decimals, at most 10,000,000), minus thousands commas - the wizard hands the raw text to the quote, which reads it as a number.
const isWizardPriceValid = (v) => !/,/.test(String(v)) && parsePriceInput(v).ok && parsePriceInput(v).value !== '';

// Owner console 2026-10-26 (typed: "מאשר שינוי ב-L-09, L-15 ו-L-17 לפי docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md ..."): catalog items are
// ticked (one or several) and checked together before they are added. The catalog stores a name and a price only, so every ticked item
// starts as "price for each", quantity 1 - the unit is never guessed from the name; per metre / m² is chosen on the check screen.
const catalogPriceText = (p) => (p === null || p === undefined || p === '' || !Number.isFinite(Number(p)) || Number(p) < 0 ? '' : String(p));
const draftFromService = (sv) => ({ key: String(sv.id), serviceId: String(sv.id), description: String(sv.name ?? ''), method: 'units', quantity: '1',
  unitPrice: catalogPriceText(sv.price), useSizes: false, manualQty: '', widthCm: '', heightCm: '', unit: 'cm', extraRows: [], specRows: [], showDetails: false });
// a ticked item's sizes are typed in its own cm / m (Owner 2026-10-26, the same engine as a typed item); every row -> canonical metres
const pickSizeToM = (p, v) => cmToM(p.unit === 'm' ? convertSizeText(v, 'cm') : v);
const pickSizeRows = (p) => [{ widthCm: p.widthCm, heightCm: p.heightCm, label: '' }, ...(p.extraRows || [])];
const pickRowValue = (p, r) => computeMeasurementValue(p.method, pickSizeToM(p, r.widthCm), p.method === 'linear' ? undefined : pickSizeToM(p, r.heightCm));
const pickQuantity = (p) => {
  if (p.method === 'fixed') return 1;
  if (p.method === 'units') return Number(p.quantity) || 0;
  if (!p.useSizes) return Number(p.manualQty) || 0;
  return pickSizeRows(p).map((r) => pickRowValue(p, r)).filter((v) => v != null && Number.isFinite(v)).reduce((sum, v) => sum + v, 0);
};
const pid = (idx, field) => `wiz-pick-${idx}-${field}`;

export default function AddItemWizard({
  isOpen,
  onClose,
  onAdd,
  editingItem,
  isHebrew,
  sym,
  formatMoneyDisplay,
  services,
  sections,
  defaultSectionKey,
  canUseProfessionalQuotes,
  onRequestUpgrade,
  recommendedMethod,
  onLiveStateChange,
  // Durable drafts (2026-09-21): `resumeState` re-opens an UNFINISHED wizard exactly where the user left it;
  // `onDraftSnapshot` reports every value the wizard holds (or null when closed) so it can be persisted.
  resumeState = null,
  onDraftSnapshot,
  // Task 16: a NEW item added from a catalog service reports (serviceId, item) so its linked catalog image can be bound.
  onCatalogItemAdded,
  // Owner 2026-10-26: several checked catalog items are added together (one update); the quote's items mark a catalog item already in it
  onAddMany = null,
  quoteItems = null,
}) {
  // IRON-ILS-001: every money amount goes through the injected canonical formatter; the fallback is the same canonical
  // currency-keyed path ('₪' is only ever the Local/ILS symbol) - never a raw number or toFixed.
  const money = formatMoneyDisplay || ((v) => formatMoneyForCurrency(v, sym === '₪' ? 'ILS' : undefined));
  const isEditMode = !!editingItem;
  const resumeRef = useRef(resumeState);
  resumeRef.current = resumeState;
  const resumeConsumedRef = useRef(false);
  const [step, setStep] = useState(STEPS.ITEM);
  // Owner 2026-10-15: every wizard step opens at its own top (the review step used to open at step 1's scroll offset)
  const stepBodyRef = useRef(null);
  useLayoutEffect(() => { if (stepBodyRef.current) stepBodyRef.current.scrollTop = 0; }, [step]);
  const [measureUnit, setMeasureUnit] = useState('cm');
  // "I already know the area / length": a manual measured quantity (the existing Task 34 manual-measured item), no invented sizes
  const [useManualQty, setUseManualQty] = useState(false);
  const [manualQty, setManualQty] = useState('');
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
  // Task 34: the unit a kept professional item is charged in (m², linear meter, hour, kg, day) - shown next to its manual quantity
  const preservedUnitLabel = pricingMethod === 'units' && editingItem?.pricing_unit && (isManualMeasured(editingItem) || !isMeasurableUnit(editingItem.pricing_unit))
    ? getProfessionalUnitLabel(editingItem.pricing_unit, isHebrew) : null;
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [extraMeasureRows, setExtraMeasureRows] = useState([]); // [{ widthCm, heightCm, label }]
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [sectionKey, setSectionKey] = useState(defaultSectionKey || '');
  const [specRows, setSpecRows] = useState([]);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [errors, setErrors] = useState({});
  // Owner 2026-10-26 (L-09 / L-15 / L-17, Codex F-01..F-03): the ticked catalog drafts, their errors, and the guidance after a blocked
  // action - the first missing field (and its message) is brought into the visible part of the window and focused; a short
  // "Complete: ..." line sits next to the action itself.
  const [picks, setPicks] = useState([]);
  const [multiErrors, setMultiErrors] = useState({});
  const [pickNotice, setPickNotice] = useState('');
  const [reveal, setReveal] = useState(null); // { id, errorId, n }
  const [blocked, setBlocked] = useState(null); // { id, errorId, label }
  const reviewHeadingRef = useRef(null);
  const addingRef = useRef(false);
  // Owner 2026-10-26 (typed L-09 / L-15, real-walk finding 1): what the wizard held when it opened - leaving with anything else asks first
  const initialSigRef = useRef(null);
  const captureInitialRef = useRef(false);
  const draftSig = JSON.stringify([description, pricingMethod, widthCm, heightCm, extraMeasureRows, quantity, unitPrice, sectionKey, specRows, useManualQty, manualQty, picks]);
  // declared BEFORE the open effect: it reads the state the open effect set, one render later
  useEffect(() => {
    if (!isOpen) { initialSigRef.current = null; return; }
    if (captureInitialRef.current) { initialSigRef.current = draftSig; captureInitialRef.current = false; }
  });
  const defaultSectionKeyRef = useRef(defaultSectionKey);
  defaultSectionKeyRef.current = defaultSectionKey;
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
    if (!isOpen) { resumeConsumedRef.current = false; return; }
    const rs = resumeRef.current;
    if (rs && !resumeConsumedRef.current) {
      // restoring an unfinished wizard from a durable draft: every field, not the blank/edit defaults
      resumeConsumedRef.current = true;
      setDescription(rs.description ?? '');
      setCatalogServiceId(rs.catalogServiceId ?? '');
      setShowManualEntry(!!rs.showManualEntry);
      setPricingMethod(rs.pricingMethod ?? null);
      setMeasureUnit(rs.measureUnit === 'm' ? 'm' : 'cm');
      setUseManualQty(!!rs.useManualQty);
      setManualQty(rs.manualQty ?? '');
      setWidthCm(rs.widthCm ?? '');
      setHeightCm(rs.heightCm ?? '');
      setExtraMeasureRows(Array.isArray(rs.extraMeasureRows) ? rs.extraMeasureRows : []);
      setQuantity(rs.quantity ?? '1');
      setUnitPrice(rs.unitPrice ?? '');
      setSectionKey(rs.sectionKey ?? '');
      setSpecRows(Array.isArray(rs.specRows) ? rs.specRows : []);
      setShowCustomerDetails(!!rs.showCustomerDetails);
      setPicks(Array.isArray(rs.picks) ? rs.picks : []);
      setMultiErrors({}); setPickNotice(''); setBlocked(null);
      methodAtOpenRef.current = rs.methodAtOpen ?? null;
      hadMeasurementRowsAtOpenRef.current = !!rs.hadMeasurementRowsAtOpen;
      conversionConfirmedRef.current = !!rs.conversionConfirmed;
      // a draft saved by the earlier 4-step wizard (no stepModel) resumes on the item screen, or on the check if it was there
      setStep(rs.stepModel === 2 ? (rs.step === STEPS.REVIEW ? STEPS.REVIEW : STEPS.ITEM) : (rs.step === 4 ? STEPS.REVIEW : STEPS.ITEM));
      setErrors({});
      captureInitialRef.current = true;
      return;
    }
    if (editingItem) {
      const s = stateFromItem(editingItem, defaultSectionKeyRef.current);
      setDescription(s.description);
      setCatalogServiceId(s.catalogServiceId);
      // חוק ברזל (Catalog First, Decision 6): במצב-עריכה תמיד מוצג שדה
      // ההזנה הידנית (עם השם הקיים מוצג/ניתן-לעריכה) - לעולם לא רשימת-
      // קטלוג לא-קשורה, גם אם למשתמש יש קטלוג. "Catalog must NOT silently
      // override saved quote-item semantics during Edit."
      setShowManualEntry(true);
      setPricingMethod(s.pricingMethod);
      setMeasureUnit('cm');
      setUseManualQty(false);
      setManualQty('');
      setWidthCm(s.widthCm);
      setHeightCm(s.heightCm);
      setExtraMeasureRows(s.extraMeasureRows);
      setQuantity(s.quantity);
      setUnitPrice(s.unitPrice);
      setSectionKey(s.sectionKey);
      setSpecRows(s.specRows);
      setShowCustomerDetails(s.specRows.length > 0);
      setPicks([]);
      methodAtOpenRef.current = s.pricingMethod;
      hadMeasurementRowsAtOpenRef.current = s._hadMeasurementRows;
      conversionConfirmedRef.current = false;
      // חוק ברזל (§C/Decision 5, "editing reopens the same guided editor
      // populated with the saved values"): קפיצה ישר לבדיקה - עם משפט-
      // הנחיה נפרד למצב-עריכה (t.editModeExplanation).
      setStep(STEPS.REVIEW);
    } else {
      const s = blankState(defaultSectionKeyRef.current);
      setDescription(s.description);
      setCatalogServiceId(s.catalogServiceId);
      // חוק ברזל (Catalog First, Decision 6): הוספה חדשה - כשיש קטלוג,
      // ברירת-המחדל היא רשימת-הקטלוג עצמה (showManualEntry=false); כשאין
      // קטלוג כלל, הערך הזה לא משפיע (התנאי services.length===0 מדלג
      // ישירות להזנה ידנית ב-JSX, "no unnecessary source-choice card").
      setShowManualEntry(false);
      setPricingMethod(s.pricingMethod);
      setMeasureUnit('cm');
      setUseManualQty(false);
      setManualQty('');
      setWidthCm(s.widthCm);
      setHeightCm(s.heightCm);
      setExtraMeasureRows(s.extraMeasureRows);
      setQuantity(s.quantity);
      setUnitPrice(s.unitPrice);
      setSectionKey(s.sectionKey);
      setSpecRows(s.specRows);
      setShowCustomerDetails(false);
      setPicks([]);
      methodAtOpenRef.current = null;
      hadMeasurementRowsAtOpenRef.current = false;
      conversionConfirmedRef.current = false;
      setStep(STEPS.ITEM);
    }
    setErrors({});
    setMultiErrors({}); setPickNotice(''); setBlocked(null);
    captureInitialRef.current = true;
  }, [isOpen, editingItem]);

  // Context-Driven AI Chat V3, §10 "Item Wizard Context": the wizard is the
  // only place that actually knows its own live step/pricing-method/
  // measurement-progress while the user is mid-flow - quoteWorkflowContext.js
  // (consumed by QuoteForm.jsx) previously only ever saw the wizard's
  // OPEN/CLOSED boundary and (on edit) the already-saved item shape, never
  // this live in-progress state. Reports a small, bounded, non-PII snapshot
  // upward on every change - no description/specification/measurement TEXT
  // ever leaves this component, only counts/enums/booleans, matching the
  // same trust level quoteWorkflowContext.js already documents for the rest
  // of the workflow snapshot. `onLiveStateChange` is optional so this
  // component still works standalone/in tests with no listener wired.
  useEffect(() => {
    if (!onLiveStateChange) return;
    if (!isOpen) {
      onLiveStateChange(null);
      return;
    }
    const measurementCount = (pricingMethod === 'area' || pricingMethod === 'linear') && !useManualQty
      ? (widthCm ? 1 : 0) + extraMeasureRows.filter((r) => r.widthCm).length
      : 0;
    onLiveStateChange({
      // the item screen reports how far the user got on it (the chat contract keeps its four step ids)
      step: step === STEPS.REVIEW ? 'review' : pricingMethod ? 'details' : description.trim() ? 'pricing' : 'what',
      pricingMethod,
      measurementCount,
      hasSpecification: specRows.length > 0,
      hasQuantity: pricingMethod === 'units' ? Number(quantity) > 0 : true,
      hasUnitPrice: Number(unitPrice) > 0,
    });
  }, [onLiveStateChange, isOpen, step, description, pricingMethod, useManualQty, widthCm, extraMeasureRows, specRows, quantity, unitPrice]);

  // Durable drafts: report the FULL serializable wizard state while open (null when closed). Contains user text, so
  // it is only ever handed to the local draft persistence, never to diagnostics/AI context.
  useEffect(() => {
    if (!onDraftSnapshot) return;
    if (!isOpen) { onDraftSnapshot(null); return; }
    onDraftSnapshot({
      stepModel: 2, step, description, catalogServiceId, showManualEntry, pricingMethod, measureUnit, useManualQty, manualQty, widthCm, heightCm, extraMeasureRows,
      quantity, unitPrice, sectionKey, specRows, showCustomerDetails, picks,
      methodAtOpen: methodAtOpenRef.current, hadMeasurementRowsAtOpen: hadMeasurementRowsAtOpenRef.current, conversionConfirmed: conversionConfirmedRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, description, catalogServiceId, showManualEntry, pricingMethod, measureUnit, useManualQty, manualQty, widthCm, heightCm, extraMeasureRows, quantity, unitPrice, sectionKey, specRows, showCustomerDetails, picks]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      // Owner 2026-10-26 (L-15): the check screen opens on its own heading (screen readers and the keyboard start there)
      if (step === STEPS.REVIEW && reviewHeadingRef.current) reviewHeadingRef.current.focus({ preventScroll: true });
      else if (firstFieldRef.current) firstFieldRef.current.focus();
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

  // Owner 2026-10-26 (L-15, Codex F-01 / F-02): the field to reveal (a missing one after a blocked action, or the first field a chosen
  // method opened) and its message are scrolled into the visible part of the step body - between the heading and the buttons - and the
  // field gets the focus. Measured against the scrolling body itself, never only against the screen.
  useLayoutEffect(() => {
    if (!reveal) return;
    const body = stepBodyRef.current;
    const field = typeof document !== 'undefined' ? document.getElementById(reveal.id) : null;
    if (!body || !field) return;
    const err = reveal.errorId ? document.getElementById(reveal.errorId) : null;
    const b = body.getBoundingClientRect();
    const rects = [field.getBoundingClientRect(), ...(err ? [err.getBoundingClientRect()] : [])];
    const top = Math.min(...rects.map((r) => r.top)) - b.top + body.scrollTop - 12;
    const bottom = Math.max(...rects.map((r) => r.bottom)) - b.top + body.scrollTop + 12;
    if (top < body.scrollTop) body.scrollTop = Math.max(0, top);
    else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = Math.max(0, Math.min(top, bottom - body.clientHeight));
    if (typeof field.focus === 'function') field.focus({ preventScroll: true });
  }, [reveal]);

  // Owner 2026-10-26 (typed L-15, real-walk finding 3): after a blocked attempt the "Complete" line and the messages follow every change -
  // a field that was filled is no longer named (no stale red line), the next missing one is
  useEffect(() => {
    if (!isOpen || !blocked) return;
    if (step === STEPS.REVIEW && picks.length > 0 && !editingItem) {
      const { all, target } = computePickErrors();
      setMultiErrors(all);
      setBlocked(target);
      return;
    }
    if (step === STEPS.ITEM && picks.length === 0) {
      const e = computeStepErrors();
      setErrors(e);
      setBlocked(Object.keys(e).length ? firstMissing(e) : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, pricingMethod, unitPrice, quantity, widthCm, heightCm, extraMeasureRows, manualQty, useManualQty, picks]);

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
    step1ExplanationBoth: isHebrew ? 'כתבו מה העבודה, או בחרו מוצר שכבר שמרתם בקטלוג.' : 'Type the job, or choose a product you already saved in your catalog.',
    catalogOrHeading: isHebrew ? 'או בחרו מהקטלוג' : 'Or choose from your catalog',
    descPlaceholder: isHebrew ? 'למשל: התקנה, ידיות או רשת לחלון' : 'e.g. Installation, handles, or a window screen',
    chooseFromCatalog: isHebrew ? 'בחירה מהמוצרים השמורים' : 'Choose from saved products',
    catalogPick: isHebrew ? 'בחירת פריט…' : 'Select an item...',
    catalogFirstHeading: isHebrew ? 'בחרו מוצר או עבודה מהקטלוג' : 'Choose a product or work from your catalog',
    manualFallbackLink: isHebrew ? 'לא מצאתם בקטלוג? הוסיפו מוצר או עבודה ידנית' : 'Not in the catalog? Add a product or work manually',
    backToCatalogLink: isHebrew ? 'חזרה לבחירה מהקטלוג' : 'Back to catalog',
    step2Title: isHebrew ? 'איך מחשבים את המחיר?' : 'How is the price worked out?',
    step2Explanation: isHebrew ? 'בחרו איך אתם בדרך כלל גובים תשלום על המוצר או העבודה הזאת.' : 'Choose how you normally charge for this product or work.',
    methodFixed: isHebrew ? 'מחיר כולל' : 'One total price',
    // Owner 2026-10-26 (L-17, Codex F-06): the example is in the quote's own currency, never the language's
    methodFixedExample: isHebrew ? `לדוגמה: ${sym}${money(500)}` : `e.g. ${sym}${money(500)}`,
    methodUnitsChoice: isHebrew ? 'מחיר לכל יחידה' : 'Price for each',
    methodUnitsExample: isHebrew ? 'לדוגמה: 6 × 25 = 150' : 'e.g. 6 × 25 = 150',
    methodAreaChoice: isHebrew ? 'מחיר לפי שטח' : 'Price by area',
    methodAreaExample: isHebrew ? 'לדוגמה: 4.4 מ״ר × 100 = 440' : 'e.g. 4.4 m² × 100 = 440',
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
    areaHelper: isHebrew ? 'הזינו בס״מ. נחשב את השטח במ״ר.' : 'Enter centimetres. We’ll calculate square metres.',
    step3TitleLinear: isHebrew ? 'אורך' : 'Length',
    step3ExplanationLinear: isHebrew ? 'הזינו את האורך והמחיר ליחידת אורך.' : 'Enter the length and the price per unit of length.',
    sizeN: isHebrew ? (n) => `מידה ${n}` : (n) => `Size ${n}`,
    widthCm: isHebrew ? `רוחב (${measureUnit === 'm' ? 'מ\'' : 'ס״מ'})` : `Width (${measureUnit === 'm' ? 'm' : 'cm'})`,
    heightCm: isHebrew ? `גובה (${measureUnit === 'm' ? 'מ\'' : 'ס״מ'})` : `Height (${measureUnit === 'm' ? 'm' : 'cm'})`,
    lengthCm: isHebrew ? `אורך (${measureUnit === 'm' ? 'מ\'' : 'ס״מ'})` : `Length (${measureUnit === 'm' ? 'm' : 'cm'})`,
    sizeUnitLabel: isHebrew ? 'יחידת מידה' : 'Size unit',
    unitCm: isHebrew ? 'ס״מ' : 'cm',
    unitM: isHebrew ? 'מטר' : 'm',
    knowArea: isHebrew ? 'השטח כבר ידוע?' : 'I already know the area',
    knowLength: isHebrew ? 'האורך כבר ידוע?' : 'I already know the length',
    backToSizes: isHebrew ? 'חזרה להזנת מידות' : 'Enter sizes instead',
    manualAreaLabel: isHebrew ? 'כמה מ״ר?' : 'How many m²?',
    manualLengthLabel: isHebrew ? 'כמה מטרים של אורך?' : 'How many metres?',
    missingManualQty: isHebrew ? 'יש להזין כמות גדולה מ-0' : 'Please enter a quantity greater than 0',
    toReview: isHebrew ? 'המשך לבדיקה' : 'Continue to check',
    unitChangeConfirm: isHebrew ? 'שינוי היחידה דורש בדיקה מחדש של המחיר. להמשיך?' : 'Changing the unit requires reviewing the price. Continue?',
    calcNote: isHebrew ? 'הנחה ומע״מ מחושבים בסיכום ההצעה' : 'Discount and tax are calculated in the quote summary',
    unitPriceArea: isHebrew ? 'מחיר לכל מ״ר' : 'Price per m²',
    unitPriceLinear: isHebrew ? 'מחיר לכל מטר' : 'Price per metre',
    addAnotherSize: isHebrew ? '+ הוספת מידה נוספת' : '+ Add another size',
    removeSize: isHebrew ? 'הסרת המידה' : 'Remove this size',
    sizeLabelOptional: isHebrew ? 'מיקום או שם — לא חובה' : 'Location or name — optional',
    step4Title: isHebrew ? 'בדיקה לפני הוספה' : 'Check before adding',
    step4Explanation: isHebrew ? 'בדקו שהפרטים והמחיר נכונים לפני שהמוצר או העבודה מתווספים להצעה.' : 'Check the details and price before this product or work is added to the quote.',
    editModeExplanation: isHebrew ? 'בדקו את הפרטים הקיימים ובחרו מה תרצו לשנות.' : 'Review the current details and choose what you want to change.',
    addCustomerDetailsToggle: isHebrew ? 'להוסיף פרטים שיוצגו ללקוח?' : 'Add details for the customer?',
    customerDetailsHelper: isHebrew ? 'לא חובה — למשל צבע, חומר או הערה' : 'Optional — for example colour, material, or a note',
    customerDetailsPriceNote: isHebrew ? 'הפרטים האלה לא משנים את המחיר' : 'These details do not change the price',
    detailLabel: isHebrew ? 'פרט' : 'Detail',
    detailPlaceholder: isHebrew ? 'למשל: צבע' : 'e.g. Colour',
    detailValuePlaceholder: isHebrew ? 'למשל: לבן' : 'e.g. White',
    addSpecRow: isHebrew ? '+ הוספת פרט' : '+ Add detail',
    groupLabel: isHebrew ? 'יחידה בהצעה (דירה, חדר או אזור) — לא חובה' : 'Unit (apartment / room / area) - optional',
    noGroup: isHebrew ? 'ללא יחידה' : 'No unit',
    changeName: isHebrew ? 'שינוי שם' : 'Change name',
    changePricingAndSizes: isHebrew ? 'שינוי מחיר ומידות' : 'Change price and sizes',
    changePricingMethod: isHebrew ? 'שינוי שיטת תמחור' : 'Change how it is priced',
    totalAreaLabel: isHebrew ? 'סה״כ שטח' : 'Total area',
    totalLengthLabel: isHebrew ? 'סה״כ אורך' : 'Total length',
    totalLabel: isHebrew ? 'סה״כ' : 'Total',
    customerPreviewTitle: isHebrew ? 'כך הלקוח יראה את הפריט' : 'This is what the customer will see',
    back: isHebrew ? 'חזרה' : 'Back',
    next: isHebrew ? 'הבא' : 'Next',
    addItem: isEditMode ? (isHebrew ? 'שמירת שינויים' : 'Save changes') : (isHebrew ? 'הוספה להצעה' : 'Add to quote'),
    cancel: isHebrew ? 'ביטול' : 'Cancel',
    edit: isHebrew ? 'עריכה' : 'Edit',
    stepLabels: isHebrew
      ? ['הפריט', 'בדיקה']
      : ['Item', 'Check'],
    stepOfTotal: isHebrew ? (n, total) => `שלב ${n} מתוך ${total}` : (n, total) => `Step ${n} of ${total}`,
    missingDescription: isHebrew ? 'יש להזין שם או תיאור לפריט' : 'Please enter a name or description for this item',
    // Task 39: quote_items.description is varchar(255) (migration 20260930000000) - a longer text must be shortened by the user, never
    // truncated silently or lost at save.
    descriptionTooLong: (n) => (isHebrew ? `התיאור ארוך מדי: ${n} תווים. אפשר עד ${ITEM_DESCRIPTION_MAX} תווים.` : `The description is too long: ${n} characters. Up to ${ITEM_DESCRIPTION_MAX} characters are allowed.`),
    missingMethod: isHebrew ? 'יש לבחור כיצד לתמחר את הפריט' : 'Please choose how to charge for this item',
    missingWidth: isHebrew ? 'יש להזין רוחב גדול מ-0' : 'Please enter a width greater than 0',
    missingHeight: isHebrew ? 'יש להזין גובה גדול מ-0' : 'Please enter a height greater than 0',
    missingLength: isHebrew ? 'יש להזין אורך גדול מ-0' : 'Please enter a length greater than 0',
    missingQuantity: isHebrew ? 'יש להזין כמות גדולה מ-0' : 'Please enter a quantity greater than 0',
    missingPrice: isHebrew ? 'יש להזין מחיר' : 'Please enter a price',
    // night task 2026-10-16 (R-23): the same price rules as "Edit price" - never a value that is refused later
    invalidPrice: isHebrew ? 'הזינו מחיר תקין: מספר עם נקודה עשרונית (עד 2 ספרות אחריה), בלי פסיקים, עד 10,000,000.' : 'Enter a valid price: a number with a decimal point (up to 2 decimals), no commas, up to 10,000,000.',
    missingAmount: isHebrew ? 'יש להזין סכום' : 'Please enter an amount',
    rowNeedsHeight: isHebrew ? (n) => `במידה ${n} חסר גובה. השלימו או הסירו אותה.` : (n) => `Size ${n} needs a height. Complete or remove it.`,
    rowNeedsWidth: isHebrew ? (n) => `במידה ${n} חסר רוחב. השלימו או הסירו אותה.` : (n) => `Size ${n} needs a width. Complete or remove it.`,
    upgradeNeeded: isHebrew ? 'לא כלול במסלול הנוכחי' : 'Not included in the current plan',
    calcPreviewArea: isHebrew ? (w, h, m2) => `${w} × ${h} ${measureUnit === 'm' ? 'מ\'' : 'ס״מ'} = ${m2} מ״ר` : (w, h, m2) => `${w} × ${h} ${measureUnit === 'm' ? 'm' : 'cm'} = ${m2} m²`,
    calcPreviewLinear: isHebrew ? (l, m) => `${l} ${measureUnit === 'm' ? 'מ\'' : 'ס״מ'} = ${m} מ'` : (l, m) => `${l} ${measureUnit === 'm' ? 'm' : 'cm'} = ${m} m`,
    completeLabel: isHebrew ? 'צריך להשלים:' : 'Complete:',
    fieldNames: isHebrew
      ? { description: 'שם הפריט', method: 'שיטת התמחור', amount: 'הסכום', quantity: 'הכמות', price: 'המחיר', width: 'הרוחב', height: 'הגובה', length: 'האורך', manualQty: 'הכמות', row: (n) => `מידה ${n}`, unavailable: 'פריט שאינו בקטלוג' }
      : { description: 'item name', method: 'pricing method', amount: 'amount', quantity: 'quantity', price: 'price', width: 'width', height: 'height', length: 'length', manualQty: 'quantity', row: (n) => `size ${n}`, unavailable: 'an item no longer in the catalog' },
    picked: (n) => (isHebrew ? `נבחרו ${n}` : `${n} selected`),
    toReviewCount: (n) => (isHebrew ? `המשך לבדיקה (${n})` : `Continue to check (${n})`),
    catalogNote: isHebrew
      ? 'הקטלוג שומר שם ומחיר בלבד. כל פריט מתחיל בכמות 1 ובמחיר לכל יחידה. אם המחיר הוא למטר או למ״ר, שנו את השיטה והזינו את האורך או השטח לפני ההוספה.'
      : 'The catalog stores a name and price only. Each item starts with quantity 1 and a price for each. For a price per metre or m², change the method and enter the length or area before adding.',
    pickedHint: isHebrew ? 'לכתיבת פריט אחר, הקלידו כאן' : 'To type a different item, type here',
    switchToCatalogConfirm: isHebrew ? 'להחליף את הפריט שהתחלתם לכתוב בבחירה מהקטלוג? הפריטים שכבר בהצעה לא ישתנו.' : 'Replace the item you started typing with the catalog selection? Items already in the quote do not change.',
    switchToCatalogLabels: isHebrew ? { yes: 'להחליף', no: 'להשאיר' } : { yes: 'Replace', no: 'Keep it' },
    switchToFreeConfirm: isHebrew ? 'לבטל את הבחירה מהקטלוג ולכתוב פריט חדש?' : 'Clear the catalog selection and type a new item?',
    switchToFreeLabels: isHebrew ? { yes: 'לבטל את הבחירה', no: 'להשאיר' } : { yes: 'Clear the selection', no: 'Keep it' },
    multiTitle: (n) => (isHebrew ? (n === 1 ? 'בדיקת פריט אחד לפני הוספה' : `בדיקת ${n} פריטים לפני הוספה`) : (n === 1 ? 'Check 1 item before adding' : `Check ${n} items before adding`)),
    multiExplanation: isHebrew ? 'אפשר לשנות לכל פריט את השם, השיטה, הכמות והמחיר, או להסיר אותו.' : 'For each item you can change the name, method, quantity and price, or remove it.',
    itemN: (n) => (isHebrew ? `פריט ${n}` : `Item ${n}`),
    nameLabel: isHebrew ? 'שם הפריט' : 'Item name',
    removePick: (name) => (isHebrew ? `הסרת ${name} מהבחירה` : `Remove ${name} from the selection`),
    removeShort: isHebrew ? 'הסרה' : 'Remove',
    lineTotal: isHebrew ? 'סכום השורה' : 'Line total',
    selectedSum: isHebrew ? 'סכום הפריטים שנבחרו' : 'Total of the selected items',
    addMany: (n) => (isHebrew ? (n === 1 ? 'הוספת פריט אחד להצעה' : `הוספת ${n} פריטים להצעה`) : (n === 1 ? 'Add 1 item to the quote' : `Add ${n} items to the quote`)),
    enterSizes: isHebrew ? 'הזנת מידות' : 'Enter sizes',
    sizeLabel: (kind, u) => (isHebrew
      ? `${kind === 'width' ? 'רוחב' : kind === 'height' ? 'גובה' : 'אורך'} (${u === 'm' ? 'מ\'' : 'ס״מ'})`
      : `${kind === 'width' ? 'Width' : kind === 'height' ? 'Height' : 'Length'} (${u === 'm' ? 'm' : 'cm'})`),
    leaveNewConfirm: isHebrew ? 'לצאת בלי להוסיף את הפריט? מה שהוקלד או סומן לא יישמר.' : 'Leave without adding the item? What you typed or ticked will not be kept.',
    leaveEditConfirm: isHebrew ? 'לצאת בלי לשמור את השינויים בפריט?' : 'Leave without saving the changes to this item?',
    leaveNewLabels: isHebrew ? { yes: 'לצאת בלי להוסיף', no: 'להמשיך' } : { yes: 'Leave without adding', no: 'Keep going' },
    leaveEditLabels: isHebrew ? { yes: 'לצאת בלי לשמור', no: 'להמשיך' } : { yes: 'Leave without saving', no: 'Keep going' },
    inQuoteAlready: isHebrew ? 'כבר קיים בהצעה; יתווסף כפריט נפרד.' : 'Already in the quote; it will be added as a separate item.',
    notInCatalog: isHebrew ? 'הפריט אינו זמין עוד בקטלוג.' : 'This item is no longer in the catalog.',
    keepAsFree: isHebrew ? 'להשאיר כפריט חופשי' : 'Keep it as a free item',
    unavailableError: isHebrew ? 'הסירו את הפריט או השאירו אותו כפריט חופשי.' : 'Remove the item or keep it as a free item.',
    noPicksLeft: isHebrew ? 'לא נשארו פריטים בבחירה. סמנו פריטים בקטלוג או כתבו פריט חדש.' : 'No items are left in the selection. Tick items in the catalog or type a new item.',
    addTo: (name) => (isHebrew ? `יתווסף ל: ${name}` : `Added to: ${name}`),
    lockedOption: isHebrew ? ' (לא כלול במסלול)' : ' (not in your plan)',
    destructiveConversionConfirm: isHebrew
      ? 'שינוי שיטת התמחור עלול לשנות את משמעות הסכומים הקיימים. להמשיך?'
      : 'Changing the pricing method may change how the existing numbers are interpreted. Continue?',
  };

  const isMeasureMethod = pricingMethod === 'area' || pricingMethod === 'linear';
  // sizes are held in the unit the user types (measureUnit); every calculation goes through cm -> canonical metres
  const toCm = (v) => (measureUnit === 'm' ? convertSizeText(v, 'cm') : v);
  const sizeToM = (v) => cmToM(toCm(v));
  const widthM = sizeToM(widthCm);
  const heightM = sizeToM(heightCm);
  const manualQtyValue = useManualQty && Number(manualQty) > 0 ? Number(manualQty) : null;
  const primaryRowValue = isMeasureMethod && !useManualQty
    ? computeMeasurementValue(pricingMethod, widthM, pricingMethod === 'linear' ? undefined : heightM)
    : null;
  const extraRowValues = isMeasureMethod && !useManualQty
    ? extraMeasureRows.map((row) => computeMeasurementValue(pricingMethod, sizeToM(row.widthCm), pricingMethod === 'linear' ? undefined : sizeToM(row.heightCm)))
    : [];
  const validExtraRowValues = extraRowValues.filter((v) => v != null && Number.isFinite(v));
  const calculatedValue = !isMeasureMethod ? null
    : useManualQty ? manualQtyValue
      : (primaryRowValue != null || validExtraRowValues.length > 0
        ? (primaryRowValue || 0) + validExtraRowValues.reduce((sum, v) => sum + v, 0)
        : null);

  function changeMeasureUnit(next) {
    if (next === measureUnit) return;
    setWidthCm((v) => convertSizeText(v, next));
    setHeightCm((v) => convertSizeText(v, next));
    setExtraMeasureRows((rows) => rows.map((r) => ({ ...r, widthCm: convertSizeText(r.widthCm, next), heightCm: convertSizeText(r.heightCm, next) })));
    setMeasureUnit(next);
  }

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

  // Owner 2026-10-26: ticked catalog drafts (one list for one or several items)
  const isMulti = !isEditMode && picks.length > 0;
  const catalogOrder = (key) => { const i = (services || []).findIndex((s) => String(s.id) === key); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const freeDraftStarted = () => description.trim() !== '' || pricingMethod !== null || unitPrice !== '';
  function clearFreeDraft() {
    setDescription(''); setCatalogServiceId(''); setPricingMethod(null); setUnitPrice(''); setQuantity('1'); setWidthCm(''); setHeightCm('');
    setExtraMeasureRows([]); setUseManualQty(false); setManualQty(''); setErrors({});
  }
  async function togglePick(sv) {
    const key = String(sv.id);
    setPickNotice(''); setBlocked(null);
    if (picks.some((p) => p.key === key)) { setPicks((prev) => prev.filter((p) => p.key !== key)); setMultiErrors({}); return; }
    // a started free-text item is never mixed silently with a catalog item
    if (picks.length === 0 && freeDraftStarted()) {
      if (!(await askConfirm(t.switchToCatalogConfirm, isHebrew, t.switchToCatalogLabels))) return;
      clearFreeDraft();
    }
    setPicks((prev) => (prev.some((p) => p.key === key) ? prev : [...prev, draftFromService(sv)].sort((a, b) => catalogOrder(a.key) - catalogOrder(b.key))));
  }
  function updatePick(idx, patch) {
    setPicks((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    setMultiErrors((e) => { if (!e[idx]) return e; const next = { ...e }; delete next[idx]; return next; });
  }
  const firstPickField = (idx, m, useSizes) => pid(idx, m === 'fixed' ? 'price' : m === 'units' ? 'quantity' : useSizes ? 'width' : 'manualQty');
  async function setPickMethod(idx, m) {
    const p = picks[idx];
    if (!p || p.method === m) return;
    // the same rule as one item: a price typed for one unit is never kept silently for another
    if (p.unitPrice !== '' && !(await askConfirm(t.unitChangeConfirm, isHebrew))) return;
    updatePick(idx, { method: m, useSizes: false, manualQty: '', widthCm: '', heightCm: '', extraRows: [], unit: 'cm', quantity: p.quantity || '1' });
    setReveal({ id: firstPickField(idx, m, false), n: Date.now() });
  }
  function setPickSizes(idx, useSizes) {
    const p = picks[idx];
    if (!p) return;
    updatePick(idx, { useSizes, manualQty: '', widthCm: '', heightCm: '', extraRows: [], unit: 'cm' });
    setReveal({ id: firstPickField(idx, p.method, useSizes), n: Date.now() });
  }
  function changePickUnit(idx, next) {
    const p = picks[idx];
    if (!p || (p.unit || 'cm') === next) return;
    updatePick(idx, { unit: next, widthCm: convertSizeText(p.widthCm, next), heightCm: convertSizeText(p.heightCm, next),
      extraRows: (p.extraRows || []).map((r) => ({ ...r, widthCm: convertSizeText(r.widthCm, next), heightCm: convertSizeText(r.heightCm, next) })) });
  }
  function addPickRow(idx) {
    const p = picks[idx];
    if (!p) return;
    const i = (p.extraRows || []).length;
    updatePick(idx, { extraRows: [...(p.extraRows || []), { widthCm: '', heightCm: '', label: '' }] });
    setReveal({ id: pid(idx, `xw${i}`), n: Date.now() });
  }
  const updatePickRow = (idx, i, patch) => { const p = picks[idx]; if (p) updatePick(idx, { extraRows: p.extraRows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)) }); };
  const removePickRow = (idx, i) => { const p = picks[idx]; if (p) updatePick(idx, { extraRows: p.extraRows.filter((_, ri) => ri !== i) }); };
  const updatePickSpec = (idx, i, patch) => { const p = picks[idx]; if (p) updatePick(idx, { specRows: p.specRows.map((r, ri) => (ri === i ? { ...r, ...patch } : r)) }); };
  function removePick(idx) {
    const rest = picks.filter((_, i) => i !== idx);
    setPicks(rest); setMultiErrors({}); setBlocked(null);
    if (rest.length === 0) { setStep(STEPS.ITEM); setPickNotice(t.noPicksLeft); return; }
    // the focus moves to the item now in that place (never lost with the removed button)
    setReveal({ id: pid(Math.min(idx, rest.length - 1), 'title'), n: Date.now() });
  }
  function computePickErrors() {
    const all = {};
    let first = null;
    picks.forEach((p, idx) => {
      const e = {};
      const order = [];
      const miss = (field, msg, name, focusField = field) => { e[field] = msg; order.push([field, name, focusField]); };
      if (!p.description.trim()) miss('description', t.missingDescription, t.fieldNames.description);
      else if (p.description.length > ITEM_DESCRIPTION_MAX) miss('description', t.descriptionTooLong(p.description.length), t.fieldNames.description);
      if (p.method === 'units' && !(Number(p.quantity) > 0)) miss('quantity', t.missingQuantity, t.fieldNames.quantity);
      if (p.method === 'area' || p.method === 'linear') {
        if (!p.useSizes) { if (!(Number(p.manualQty) > 0)) miss('manualQty', t.missingManualQty, t.fieldNames.manualQty); }
        else {
          if (!(Number(p.widthCm) > 0)) miss('width', p.method === 'linear' ? t.missingLength : t.missingWidth, p.method === 'linear' ? t.fieldNames.length : t.fieldNames.width);
          if (p.method === 'area' && !(Number(p.heightCm) > 0)) miss('height', t.missingHeight, t.fieldNames.height);
          // an extra size that was started must be complete (never dropped silently - the same rule as a typed item)
          (p.extraRows || []).forEach((r, i) => {
            if (r.widthCm === '' && r.heightCm === '') return;
            if (!(Number(r.widthCm) > 0)) miss(`row${i}`, t.rowNeedsWidth(i + 2), t.fieldNames.row(i + 2), `xw${i}`);
            else if (p.method === 'area' && !(Number(r.heightCm) > 0)) miss(`row${i}`, t.rowNeedsHeight(i + 2), t.fieldNames.row(i + 2), `xh${i}`);
          });
        }
      }
      if (p.unitPrice === '') miss('price', p.method === 'fixed' ? t.missingAmount : t.missingPrice, p.method === 'fixed' ? t.fieldNames.amount : t.fieldNames.price);
      else if (!isWizardPriceValid(p.unitPrice)) miss('price', t.invalidPrice, t.fieldNames.price);
      const available = !p.serviceId || (services || []).some((s) => String(s.id) === p.serviceId);
      if (!available) miss('unavailable', t.unavailableError, t.fieldNames.unavailable, 'keep');
      if (order.length) { all[idx] = e; if (!first) first = { idx, field: order[0][0], name: order[0][1], focusField: order[0][2] }; }
    });
    const target = first ? { id: pid(first.idx, first.focusField), errorId: `${pid(first.idx, first.field)}-error`, label: `${t.itemN(first.idx + 1)}: ${first.name}` } : null;
    return { all, target };
  }
  function validatePicks() {
    const { all, target } = computePickErrors();
    setMultiErrors(all);
    setBlocked(target);
    if (!target) return true;
    setReveal({ ...target, n: Date.now() });
    return false;
  }

  function itemFromPick(p, finalSectionKey) {
    const base = { description: p.description, unit_price: p.unitPrice, isFromCatalog: !!p.serviceId, section_key: finalSectionKey };
    const spec = (p.specRows || []).filter((r) => r.label.trim() || r.value.trim());
    if ((p.specRows || []).length > 0) base.specification = spec;
    if (p.method === 'fixed') return { ...base, quantity: '1' };
    if (p.method === 'units') return { ...base, quantity: p.quantity || '1' };
    const pricingUnit = p.method === 'linear' ? 'linear_meter' : 'm2';
    if (!p.useSizes) {
      return { ...base, quantity: '1', pricing_unit: pricingUnit, quantity_source: 'manual', calculation_method: 'manual', measurements: [], calculated_quantity: Number(p.manualQty) };
    }
    const calcMethod = resolveCalculationMethod(pricingUnit, 'calculated');
    const measurements = pickSizeRows(p)
      .map((r) => ({ widthM: pickSizeToM(p, r.widthCm), heightM: p.method === 'linear' ? '' : pickSizeToM(p, r.heightCm), label: r.label || '', value: pickRowValue(p, r) }))
      .filter((r) => r.value != null && Number.isFinite(r.value))
      .map((r) => ({ width: r.widthM, height: r.heightM, unit: 'm', calculated_area: r.value, label: r.label, is_pricing_driving: true }));
    return { ...base, quantity: '1', pricing_unit: pricingUnit, quantity_source: 'calculated', calculation_method: calcMethod, measurements,
      calculated_quantity: sumMeasurementAreas(measurements, calcMethod) };
  }
  // ONE update for the whole selection (no half selection, no double click); the window closes only after the items were handed over
  function handleConfirmMany() {
    if (addingRef.current) return;
    if (!validatePicks()) return;
    addingRef.current = true;
    try {
      const finalSectionKey = sectionKey || null;
      const items = picks.map((p) => itemFromPick(p, finalSectionKey));
      if (typeof onCatalogItemAdded === 'function') picks.forEach((p, i) => { if (p.serviceId) onCatalogItemAdded(p.serviceId, items[i]); });
      if (typeof onAddMany === 'function') onAddMany(items); else items.forEach((it) => onAdd(it));
      onClose();
    } finally {
      addingRef.current = false;
    }
  }

  // חוק ברזל (Part E - תיקון-שורש לבאג-Codex "incomplete additional
  // measurements may disappear silently"): כל שורה נוספת שהתחילה (רוחב
  // או גובה כלשהו הוזן) חייבת להיות שלמה כדי להמשיך - לעולם לא מסוננת
  // בשקט ב-Confirm. שורה שלא נגעו בה כלל (שני השדות ריקים) אינה "התחילה",
  // ולכן מותר להתעלם ממנה בבטחה (בדיוק כמו התנהגות-הסינון הקיימת של
  // sumMeasurementAreas/handleConfirm).
  function computeStepErrors() {
    const e = {};
    if (step === STEPS.ITEM) {
      if (!description.trim()) e.description = t.missingDescription;
      else if (description.length > ITEM_DESCRIPTION_MAX) e.description = t.descriptionTooLong(description.length);
      if (!pricingMethod) e.method = t.missingMethod;
      if (pricingMethod === 'fixed') {
        if (unitPrice === '') e.unitPrice = t.missingAmount; else if (!isWizardPriceValid(unitPrice)) e.unitPrice = t.invalidPrice;
      } else if (pricingMethod === 'units') {
        if (!(Number(quantity) > 0)) e.quantity = t.missingQuantity;
        if (unitPrice === '') e.unitPrice = t.missingPrice; else if (!isWizardPriceValid(unitPrice)) e.unitPrice = t.invalidPrice;
      } else if (isMeasureMethod && useManualQty) {
        if (!(Number(manualQty) > 0)) e.manualQty = t.missingManualQty;
        if (unitPrice === '') e.unitPrice = t.missingPrice; else if (!isWizardPriceValid(unitPrice)) e.unitPrice = t.invalidPrice;
      } else if (isMeasureMethod) {
        if (!(Number(widthCm) > 0)) e.width = pricingMethod === 'linear' ? t.missingLength : t.missingWidth;
        if (pricingMethod === 'area' && !(Number(heightCm) > 0)) e.height = t.missingHeight;
        if (unitPrice === '') e.unitPrice = t.missingPrice; else if (!isWizardPriceValid(unitPrice)) e.unitPrice = t.invalidPrice;

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
    return e;
  }
  function validateStep() {
    const e = computeStepErrors();
    setErrors(e);
    return e;
  }

  // Owner 2026-10-26 (L-15, Codex F-01): the first missing field in the order it is shown - name, method, quantity / sizes, price
  function firstMissing(e) {
    const order = [['description', 'wiz-description', 'wiz-description-error', t.fieldNames.description],
      ['method', `wiz-method-${getOrderedMethods(recommendedMethod)[0]}`, 'wiz-method-error', t.fieldNames.method]];
    if (pricingMethod === 'fixed') order.push(['unitPrice', 'wiz-fixed-amount', 'wiz-fixed-amount-error', t.fieldNames.amount]);
    else if (pricingMethod === 'units') order.push(['quantity', 'wiz-quantity', 'wiz-quantity-error', t.fieldNames.quantity], ['unitPrice', 'wiz-unit-price', 'wiz-unitprice-error', t.fieldNames.price]);
    else if (isMeasureMethod && useManualQty) order.push(['manualQty', 'wiz-manual-qty', 'wiz-manual-qty-error', t.fieldNames.manualQty], ['unitPrice', 'wiz-unit-price-m', 'wiz-unitpricem-error', t.fieldNames.price]);
    else if (isMeasureMethod) {
      order.push(['width', 'wiz-width', 'wiz-width-error', pricingMethod === 'linear' ? t.fieldNames.length : t.fieldNames.width], ['height', 'wiz-height', 'wiz-height-error', t.fieldNames.height]);
      extraMeasureRows.forEach((row, idx) => {
        if (!e.rows || !e.rows[idx]) return;
        const widthBad = !(Number(row.widthCm) > 0);
        order.push([`row${idx}`, widthBad ? `wiz-extra-width-${idx}` : `wiz-extra-height-${idx}`, `wiz-extra-row-error-${idx}`, t.fieldNames.row(idx + 2)]);
      });
      order.push(['unitPrice', 'wiz-unit-price-m', 'wiz-unitpricem-error', t.fieldNames.price]);
    }
    const hit = order.find(([key]) => (key.startsWith('row') ? e.rows && e.rows[Number(key.slice(3))] : e[key]));
    return hit ? { id: hit[1], errorId: hit[2], label: hit[3] } : null;
  }

  function goNext() {
    // ticked catalog items go straight to their shared check (each one is completed there)
    if (isMulti) { setErrors({}); setBlocked(null); setStep(STEPS.REVIEW); return; }
    const e = validateStep();
    const target = Object.keys(e).length ? firstMissing(e) : null;
    if (target) { setBlocked(target); setReveal({ ...target, n: Date.now() }); return; }
    if (Object.keys(e).length) return;
    setBlocked(null);
    setStep(STEPS.REVIEW);
  }

  async function requestClose() {
    const changed = initialSigRef.current !== null && draftSig !== initialSigRef.current;
    if (changed && !(await askConfirm(isEditMode ? t.leaveEditConfirm : t.leaveNewConfirm, isHebrew, isEditMode ? t.leaveEditLabels : t.leaveNewLabels))) return;
    onClose();
  }

  function goBack() {
    setErrors({});
    setBlocked(null);
    setStep(STEPS.ITEM);
  }

  function goToStep(target) {
    setErrors({});
    setBlocked(null);
    setStep(target);
  }

  async function choosePricingMethod(m) {
    if (m === 'area' || m === 'linear') {
      if (!canUseProfessionalQuotes) {
        onRequestUpgrade?.();
        return;
      }
    }
    if (m === pricingMethod) return;
    // Owner 2026-10-26 (typed L-09 approval): the app's own question window, in the wizard's language
    const confirmed = (text) => askConfirm(text, isHebrew);
    if (isEditMode && methodAtOpenRef.current && methodAtOpenRef.current !== m) {
      // חוק ברזל (Part K - "never silently reinterpret... require explicit confirmation when destructive"): in edit, every real method
      // change may reinterpret the same raw numbers - always warned before it happens (now at the method choice itself).
      if (!(await confirmed(t.destructiveConversionConfirm))) return;
      methodAtOpenRef.current = m;
      hadMeasurementRowsAtOpenRef.current = false;
      conversionConfirmedRef.current = true;
    } else if (!isEditMode && pricingMethod && unitPrice !== '') {
      // Owner round 1 (Codex spec §4.6): a price typed for one unit is never kept silently for another
      if (!(await confirmed(t.unitChangeConfirm))) return;
    }
    setPricingMethod(m);
    setErrors((e) => ({ ...e, method: undefined }));
    setBlocked(null);
    // Owner 2026-10-26 (L-15, Codex F-02): the fields the method opened are brought into view, the first one focused
    setReveal({ id: m === 'fixed' ? 'wiz-fixed-amount' : m === 'units' ? 'wiz-quantity' : useManualQty ? 'wiz-manual-qty' : 'wiz-width', n: Date.now() });
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
    if (isMeasureMethod && useManualQty) {
      // "I already know the area / length": the existing manual measured item (Task 34) - a charged quantity in its unit, no sizes
      newItem = {
        description,
        quantity: '1',
        unit_price: unitPrice,
        isFromCatalog: !!catalogServiceId,
        section_key: finalSectionKey,
        pricing_unit: pricingMethod === 'linear' ? 'linear_meter' : 'm2',
        quantity_source: 'manual',
        calculation_method: 'manual',
        measurements: [],
        calculated_quantity: Number(manualQty),
      };
    } else if (isMeasureMethod) {
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
          const rWidthM = sizeToM(row.widthCm);
          const rHeightM = pricingMethod === 'linear' ? '' : sizeToM(row.heightCm);
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
      // Task 34: a manual measured item (isManualMeasured) keeps its measured unit, manual source and (empty) measurement rows as well
      if (isNonDestructiveEdit && isManualMeasured(editingItem)) {
        newItem.quantity = editingItem.quantity ?? '1';
        newItem.pricing_unit = editingItem.pricing_unit;
        newItem.quantity_source = 'manual';
        newItem.calculation_method = editingItem.calculation_method || 'manual';
        newItem.measurements = Array.isArray(editingItem.measurements) ? editingItem.measurements : [];
        newItem.calculated_quantity = (quantity !== '' && quantity != null && Number.isFinite(Number(quantity))) ? Number(quantity) : editingItem.calculated_quantity;
      } else if (isNonDestructiveEdit && editingItem?.pricing_unit && editingItem.pricing_unit !== 'm2' && editingItem.pricing_unit !== 'linear_meter') {
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
    if (catalogServiceId && !isEditMode && typeof onCatalogItemAdded === 'function') onCatalogItemAdded(catalogServiceId, newItem);
    onAdd(newItem);
    onClose();
  }

  const dir = isHebrew ? 'rtl' : 'ltr';
  const total = pricingMethod === 'units'
    ? (Number(quantity) || 0) * (Number(unitPrice) || 0)
    : isMeasureMethod
      ? (calculatedValue != null ? calculatedValue * (Number(unitPrice) || 0) : null)
      : (Number(unitPrice) || 0);

  // Display-only unit word (stored measurements stay cm / m² / m); shared by the formula and the review step.
  const measureUnitWord = pricingMethod === 'area' ? (isHebrew ? 'מ״ר' : 'm²') : (isHebrew ? 'מ\'' : 'm');
  const priceIsValid = unitPrice !== '' && !Number.isNaN(Number(unitPrice)) && Number(unitPrice) >= 0;
  // Owner 2026-10-26 (L-17, Codex F-05): every number and amount is its own LTR-isolated tabular atom (the words around them keep the language)
  const num = (v) => <bdi className="pf-num">{v}</bdi>;
  const amt = (v) => <bdi className="pf-money">{sym}{money(v)}</bdi>;
  let formulaText = null;
  if (priceIsValid && total != null) {
    if (isMeasureMethod && calculatedValue != null) {
      formulaText = <>{num(calculatedValue.toFixed(2))} {measureUnitWord} × {amt(unitPrice)} = {amt(total)}</>;
    } else if (pricingMethod === 'units' && Number(quantity) > 0) {
      formulaText = <>{num(quantity)} × {amt(unitPrice)} = {amt(total)}</>;
    }
  }

  const orderedMethods = getOrderedMethods(recommendedMethod);
  // the item screen always shows the free-text field, the methods and the numbers (the catalog is a list below the field)
  const catalogListShown = false;
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

  const allRowsForReview = isMeasureMethod && !useManualQty
    ? [{ widthCm, heightCm, label: '' }, ...extraMeasureRows]
      .map((row) => ({ ...row, value: computeMeasurementValue(pricingMethod, sizeToM(row.widthCm), pricingMethod === 'linear' ? undefined : sizeToM(row.heightCm)) }))
      .filter((row) => row.value != null && Number.isFinite(row.value))
    : [];

  const methodResultLine = pricingMethod === 'fixed'
    ? (total != null ? <>{t.totalLabel}: {amt(total)}</> : null)
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
      onKeyDown={(e) => { if (e.key === 'Escape') { requestClose(); return; } trapFocus(e); }}
    >
      <div style={{ background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}
      >
        {/* §51.16: ONE header row - title · AI action (centred on desktop) · Close; the ONE assistant opens above this dialog, the wizard stays as-is */}
        <AiModalHeader className="pf-modal-head--bar" title={t.title} onClose={requestClose} closeLabel={t.cancel} closeContent={<X size={20} />} isHebrew={isHebrew} testId="ai-help-wizard"
          style={{ borderBottom: `1px solid ${NEON.border}`, flexShrink: 0, color: NEON.textPrimary }} />

        <StepIndicator step={step} isHebrew={isHebrew} isNarrow={isNarrow} labels={t.stepLabels} stepOfTotal={t.stepOfTotal} />

        <div ref={stepBodyRef} style={{ padding: '20px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {step === STEPS.ITEM && (
            <div>
              {/* חוק ברזל (Smart Quote End-to-End Structural Unification
                  task, Locked Decision 6 - "Catalog First"): כשלעסק יש
                  קטלוג שמור, המסלול הראשי בשלב 1 הוא בחירה מהקטלוג עצמו -
                  לא שדה-הזנה-חופשית עם קישור-משני לקטלוג. הסבר-השלב
                  (Step-Header-Guidance, §161) משתנה בהתאם - "בחרו..." לא
                  "כתבו..." - כדי לשקף את מה שהשדה בפועל מציג. אין קטלוג
                  בכלל => מדלגים ישירות להזנה ידנית, "no unnecessary
                  source-choice card" (זהה-בייט להתנהגות הקודמת). */}
              {/* Owner 2026-10-15 (typed approval, David's video: the catalog-first list hid how to add a new job): the free-text
                  field comes FIRST, the saved catalog below it as "or choose from your catalog". Picking from the catalog fills the
                  name and price into the same field set; nothing is hidden behind a link. */}
              <StepHeading
                title={t.step1Title}
                explanation={(services && services.length > 0) ? t.step1ExplanationBoth : t.step1Explanation}
              />
              <input
                id="wiz-description"
                ref={firstFieldRef}
                type="text"
                value={description}
                onChange={(e) => {
                  const v = e.target.value;
                  // Owner 2026-10-26: typing a new item while catalog items are ticked asks first - never a silent mix
                  if (isMulti) { askConfirm(t.switchToFreeConfirm, isHebrew, t.switchToFreeLabels).then((ok) => { if (ok) { setPicks([]); setMultiErrors({}); setBlocked(null); setDescription(v); } }); return; }
                  setDescription(v); if (catalogServiceId) setCatalogServiceId('');
                }}
                placeholder={isMulti ? t.pickedHint : t.descPlaceholder}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'wiz-description-error' : undefined}
                style={{ ...inputStyle(isHebrew), padding: '13px 14px' }}
              />
              {errors.description && <ErrorText id="wiz-description-error">{errors.description}</ErrorText>}
              {services && services.length > 0 && !isEditMode && (
                <div style={{ marginTop: '12px' }}>
                  <FieldLabel>{t.catalogOrHeading}</FieldLabel>
                  {/* Owner 2026-10-26 (L-09, Codex F-03): a real tick box per catalog item - one or several, counted; nothing is added from the list itself */}
                  <div role="status" aria-live="polite" aria-atomic="true" data-testid="wiz-picked-count" style={{ fontSize: '0.78rem', fontWeight: 700, color: NEON.textSecondary, margin: '2px 0 4px' }}>{t.picked(picks.length)}</div>
                  <div data-testid="wiz-catalog-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', maxHeight: '176px', overflowY: 'auto' }}>
                    {services.map((sv) => {
                      const on = picks.some((p) => p.key === String(sv.id));
                      return (
                        <label key={sv.id} data-testid={`wiz-catalog-pick-${sv.id}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', boxSizing: 'border-box', background: on ? NEON.violetLighter : NEON.bgCardAlt, border: `1px solid ${on ? NEON.violet : NEON.borderStrong}`, borderRadius: '10px', padding: '10px 12px', minHeight: '44px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: NEON.textPrimary }}>
                          {/* PRODUCT_TRUTH_DECORATIVE: ticks / unticks one saved catalog item for the shared check before adding; nothing is added from the list */}
                          <input type="checkbox" checked={on} onChange={() => togglePick(sv)} style={{ width: '20px', height: '20px', margin: 0, flexShrink: 0, accentColor: NEON.violet, cursor: 'pointer' }} />
                          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{sv.name}</span>
                          <bdi className="pf-money pf-money-slot" style={{ color: NEON.violet, fontWeight: 800 }}>{sym}{money(sv.price)}</bdi>
                        </label>
                      );
                    })}
                  </div>
                  {isMulti && <p data-testid="wiz-catalog-note" style={{ ...detailNoteStyle, margin: '8px 0 0' }}>{t.catalogNote}</p>}
                </div>
              )}
              {pickNotice && <p role="status" data-testid="wiz-pick-notice" style={{ ...detailNoteStyle, margin: '8px 0 0', color: NEON.textPrimary, fontWeight: 700 }}>{pickNotice}</p>}
            </div>
          )}

          {step === STEPS.ITEM && !catalogListShown && !isMulti && (
            <div style={{ marginTop: '18px' }}>
              <StepHeading id="wiz-methods-title" title={t.step2Title} explanation={null} />
              <div role="group" aria-labelledby="wiz-methods-title" aria-describedby={errors.method ? 'wiz-method-error' : undefined} style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '8px' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: selects one of the four pricing methods (all visible; the business recommendation first) on the item screen */}
                {orderedMethods.map((m) => (
                  <MethodCard
                    key={m}
                    id={`wiz-method-${m}`}
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
              {errors.method && <ErrorText id="wiz-method-error">{errors.method}</ErrorText>}
            </div>
          )}

          {step === STEPS.ITEM && !catalogListShown && !isMulti && pricingMethod === 'fixed' && (
            <div style={{ marginTop: '14px' }}>
              <p style={detailNoteStyle}>{step3Explanation}</p>
              <FieldLabel htmlFor="wiz-fixed-amount">{`${t.fixedAmountLabel} (${sym})`}</FieldLabel>
              <input id="wiz-fixed-amount" type="number" dir="ltr" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-fixed-amount-error' : undefined} style={numInputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-fixed-amount-error">{errors.unitPrice}</ErrorText>}
            </div>
          )}

          {step === STEPS.ITEM && !catalogListShown && !isMulti && pricingMethod === 'units' && (
            <div style={{ marginTop: '14px' }}>
              <p style={detailNoteStyle}>{step3Explanation}</p>
              <FieldLabel htmlFor="wiz-quantity">{preservedUnitLabel ? `${t.quantityLabel.replace(/\?$/, '')} (${preservedUnitLabel})` : t.quantityLabel}</FieldLabel>
              <input id="wiz-quantity" type="number" dir="ltr" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-invalid={!!errors.quantity} aria-describedby={errors.quantity ? 'wiz-quantity-error' : undefined} style={numInputStyle(isHebrew)} />
              {errors.quantity && <ErrorText id="wiz-quantity-error">{errors.quantity}</ErrorText>}
              <FieldLabel htmlFor="wiz-unit-price">{`${t.unitPriceLabel} (${sym})`}</FieldLabel>
              <input id="wiz-unit-price" type="number" dir="ltr" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitprice-error' : undefined} style={numInputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitprice-error">{errors.unitPrice}</ErrorText>}
              {formulaText && (
                <div aria-live="polite" style={{ marginTop: '8px', fontSize: '0.9rem', color: NEON.violet, fontWeight: '800' }}>
                  {formulaText}
                </div>
              )}
            </div>
          )}

          {step === STEPS.ITEM && !catalogListShown && !isMulti && isMeasureMethod && (
            <div style={{ marginTop: '14px' }}>
              <p style={detailNoteStyle}>{step3Explanation}</p>
              {!useManualQty && (
                <div role="group" aria-label={t.sizeUnitLabel} style={{ display: 'inline-flex', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '10px' }}>
                  {/* PRODUCT_TRUTH_DECORATIVE: cm / m switch for the typed sizes (stored measurements stay metres) */}
                  {[['cm', t.unitCm], ['m', t.unitM]].map(([u, label]) => (
                    <button key={u} type="button" aria-pressed={measureUnit === u} onClick={() => changeMeasureUnit(u)} data-testid={`wiz-unit-${u}`}
                      style={{ border: 'none', padding: '8px 16px', minHeight: '44px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: measureUnit === u ? NEON.violet : 'transparent', color: measureUnit === u ? '#fff' : NEON.textSecondary }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {useManualQty ? (
                <div>
                  <FieldLabel htmlFor="wiz-manual-qty">{pricingMethod === 'area' ? t.manualAreaLabel : t.manualLengthLabel}</FieldLabel>
                  <input id="wiz-manual-qty" type="number" dir="ltr" min="0" step="any" value={manualQty} onChange={(e) => setManualQty(e.target.value)} aria-invalid={!!errors.manualQty} aria-describedby={errors.manualQty ? 'wiz-manual-qty-error' : undefined} style={numInputStyle(isHebrew)} />
                  {errors.manualQty && <ErrorText id="wiz-manual-qty-error">{errors.manualQty}</ErrorText>}
                  {/* PRODUCT_TRUTH_DECORATIVE: switches back from a known quantity to entering sizes */}
                  <button type="button" onClick={() => setUseManualQty(false)} style={linkBtnStyle}>{t.backToSizes}</button>
                </div>
              ) : (
              <>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' }}>{t.sizeN(1)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: pricingMethod === 'area' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                <div>
                  <FieldLabel htmlFor="wiz-width">{pricingMethod === 'linear' ? t.lengthCm : t.widthCm}</FieldLabel>
                  <input id="wiz-width" type="number" dir="ltr" min="0" step="any" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} aria-invalid={!!errors.width} aria-describedby={errors.width ? 'wiz-width-error' : undefined} style={numInputStyle(isHebrew)} />
                  {errors.width && <ErrorText id="wiz-width-error">{errors.width}</ErrorText>}
                </div>
                {pricingMethod === 'area' && (
                  <div>
                    <FieldLabel htmlFor="wiz-height">{t.heightCm}</FieldLabel>
                    <input id="wiz-height" type="number" dir="ltr" min="0" step="any" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} aria-invalid={!!errors.height} aria-describedby={errors.height ? 'wiz-height-error' : undefined} style={numInputStyle(isHebrew)} />
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
                const rowValue = computeMeasurementValue(pricingMethod, sizeToM(row.widthCm), pricingMethod === 'linear' ? undefined : sizeToM(row.heightCm));
                const rowError = errors.rows && errors.rows[idx];
                const rowWidthBad = !!rowError && !(Number(row.widthCm) > 0);
                const rowHeightBad = !!rowError && !rowWidthBad;
                const rowErrorId = rowError ? `wiz-extra-row-error-${idx}` : undefined;
                return (
                  <div key={idx} style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px dashed ${NEON.border}` }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' }}>{t.sizeN(idx + 2)}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: pricingMethod === 'area' ? '1fr 1fr' : '1fr', gap: '10px', flex: 1 }}>
                        <div>
                          <FieldLabel htmlFor={`wiz-extra-width-${idx}`}>{pricingMethod === 'linear' ? t.lengthCm : t.widthCm}</FieldLabel>
                          <input id={`wiz-extra-width-${idx}`} type="number" dir="ltr" min="0" step="any" value={row.widthCm} onChange={(e) => updateMeasureRow(idx, 'widthCm', e.target.value)} aria-invalid={rowWidthBad} aria-describedby={rowWidthBad ? rowErrorId : undefined} style={numInputStyle(isHebrew)} />
                        </div>
                        {pricingMethod === 'area' && (
                          <div>
                            <FieldLabel htmlFor={`wiz-extra-height-${idx}`}>{t.heightCm}</FieldLabel>
                            <input id={`wiz-extra-height-${idx}`} type="number" dir="ltr" min="0" step="any" value={row.heightCm} onChange={(e) => updateMeasureRow(idx, 'heightCm', e.target.value)} aria-invalid={rowHeightBad} aria-describedby={rowHeightBad ? rowErrorId : undefined} style={numInputStyle(isHebrew)} />
                          </div>
                        )}
                      </div>
                      {/* PRODUCT_TRUTH_DECORATIVE: removes one measurement row in the area/linear measuring step */}
                      <button type="button" onClick={() => removeMeasureRow(idx)} aria-label={t.removeSize} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, padding: '10px', marginTop: '18px', minWidth: '44px', minHeight: '44px' }}>
                        <X size={18} />
                      </button>
                    </div>
                    {rowError && <ErrorText id={rowErrorId}>{rowError}</ErrorText>}
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
                {/* PRODUCT_TRUTH_DECORATIVE: 'Add another size' button appending a new measurement row */}
                <button type="button" onClick={addMeasureRow} style={{ background: 'none', border: `1px dashed ${NEON.violet}`, color: NEON.violet, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', width: '100%', minHeight: '44px' }}>
                  {t.addAnotherSize}
                </button>
              </div>

              {calculatedValue != null && extraMeasureRows.length > 0 && (
                <div aria-live="polite" style={{ marginTop: '14px', fontSize: '0.9rem', color: NEON.textPrimary, fontWeight: '700' }}>
                  {pricingMethod === 'area' ? `${t.totalAreaLabel}: ${calculatedValue.toFixed(2)} ${isHebrew ? 'מ״ר' : 'm²'}` : `${t.totalLengthLabel}: ${calculatedValue.toFixed(2)} ${isHebrew ? 'מ\'' : 'm'}`}
                </div>
              )}

              {/* PRODUCT_TRUTH_DECORATIVE: switches from sizes to a known area / length (manual quantity, no invented sizes) */}
              <button type="button" onClick={() => setUseManualQty(true)} style={linkBtnStyle}>{pricingMethod === 'area' ? t.knowArea : t.knowLength}</button>
              </>
              )}
              <FieldLabel htmlFor="wiz-unit-price-m">{`${pricingMethod === 'area' ? t.unitPriceArea : t.unitPriceLinear} (${sym})`}</FieldLabel>
              <input id="wiz-unit-price-m" type="number" dir="ltr" min="0" step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} aria-invalid={!!errors.unitPrice} aria-describedby={errors.unitPrice ? 'wiz-unitpricem-error' : undefined} style={numInputStyle(isHebrew)} />
              {errors.unitPrice && <ErrorText id="wiz-unitpricem-error">{errors.unitPrice}</ErrorText>}
              {formulaText && (
                <div aria-live="polite" data-testid="wiz-calc" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: NEON.bgCardAlt, display: 'grid', gap: '2px' }}>
                  <span style={{ fontSize: '0.9rem', color: NEON.violet, fontWeight: '800' }}>{formulaText}</span>
                  <span style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{t.calcNote}</span>
                </div>
              )}
            </div>
          )}


          {step === STEPS.REVIEW && isMulti && (
            <div data-testid="wiz-multi-review">
              <StepHeading headingRef={reviewHeadingRef} title={t.multiTitle(picks.length)} explanation={t.multiExplanation} />
              {sections && sections.length > 0 && (
                <p data-testid="wiz-multi-target" style={{ ...detailNoteStyle, fontWeight: 700, color: NEON.textPrimary }}>{t.addTo(activeGroupName || t.noGroup)}</p>
              )}
              <p style={detailNoteStyle}>{t.catalogNote}</p>
              {picks.map((p, idx) => {
                const e = multiErrors[idx] || {};
                const fid = (f) => pid(idx, f);
                const errProps = (f) => ({ 'aria-invalid': !!e[f], 'aria-describedby': e[f] ? `${fid(f)}-error` : undefined });
                const measured = p.method === 'area' || p.method === 'linear';
                const available = !p.serviceId || (services || []).some((s) => String(s.id) === p.serviceId);
                const inQuote = Array.isArray(quoteItems) && p.description.trim() !== ''
                  && quoteItems.some((it) => it && String(it.description || '').trim() === p.description.trim());
                const priceLabel = p.method === 'fixed' ? t.fixedAmountLabel : p.method === 'units' ? t.unitPriceLabel : p.method === 'area' ? t.unitPriceArea : t.unitPriceLinear;
                return (
                  <section key={p.key} data-testid={`wiz-pick-row-${idx}`} aria-labelledby={fid('title')}
                    style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <h4 id={fid('title')} tabIndex={-1} style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: NEON.textPrimary, outline: 'none' }}>{t.itemN(idx + 1)}</h4>
                      {/* PRODUCT_TRUTH_DECORATIVE: removes one ticked catalog item from the selection on the check screen; nothing in the quote changes */}
                      <button type="button" id={fid('remove')} onClick={() => removePick(idx)} aria-label={t.removePick(p.description || t.itemN(idx + 1))}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', minHeight: '44px', padding: '0 6px' }}>
                        <X size={14} />{t.removeShort}
                      </button>
                    </div>
                    <FieldLabel htmlFor={fid('description')}>{t.nameLabel}</FieldLabel>
                    <input id={fid('description')} type="text" value={p.description} onChange={(ev) => updatePick(idx, { description: ev.target.value })} {...errProps('description')} style={inputStyle(isHebrew)} />
                    {e.description && <ErrorText id={`${fid('description')}-error`}>{e.description}</ErrorText>}
                    <FieldLabel htmlFor={fid('method')}>{t.step2Title}</FieldLabel>
                    {/* PRODUCT_TRUTH_DECORATIVE: chooses how one ticked catalog item is priced (the same four methods; per metre / m² ask for the length / area) */}
                    <select id={fid('method')} value={p.method} onChange={(ev) => setPickMethod(idx, ev.target.value)} style={inputStyle(isHebrew)}>
                      {ALL_METHODS.map((m) => {
                        const locked = (m === 'area' || m === 'linear') && !canUseProfessionalQuotes;
                        return <option key={m} value={m} disabled={locked}>{methodMeta[m].title}{locked ? t.lockedOption : ''}</option>;
                      })}
                    </select>
                    {p.method === 'units' && (
                      <>
                        <FieldLabel htmlFor={fid('quantity')}>{t.quantityLabel}</FieldLabel>
                        <input id={fid('quantity')} type="number" dir="ltr" min="0" step="any" value={p.quantity} onChange={(ev) => updatePick(idx, { quantity: ev.target.value })} {...errProps('quantity')} style={numInputStyle(isHebrew)} />
                        {e.quantity && <ErrorText id={`${fid('quantity')}-error`}>{e.quantity}</ErrorText>}
                      </>
                    )}
                    {measured && !p.useSizes && (
                      <>
                        <FieldLabel htmlFor={fid('manualQty')}>{p.method === 'area' ? t.manualAreaLabel : t.manualLengthLabel}</FieldLabel>
                        <input id={fid('manualQty')} type="number" dir="ltr" min="0" step="any" value={p.manualQty} onChange={(ev) => updatePick(idx, { manualQty: ev.target.value })} {...errProps('manualQty')} style={numInputStyle(isHebrew)} />
                        {e.manualQty && <ErrorText id={`${fid('manualQty')}-error`}>{e.manualQty}</ErrorText>}
                        {/* PRODUCT_TRUTH_DECORATIVE: switches one ticked item from a known area / length to entering its sizes in cm */}
                        <button type="button" onClick={() => setPickSizes(idx, true)} style={linkBtnStyle}>{t.enterSizes}</button>
                      </>
                    )}
                    {measured && p.useSizes && (
                      <>
                        <div role="group" aria-label={t.sizeUnitLabel} style={{ display: 'inline-flex', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', overflow: 'hidden', margin: '10px 0 4px' }}>
                          {/* PRODUCT_TRUTH_DECORATIVE: cm / m switch for one ticked item's typed sizes (stored measurements stay metres) */}
                          {[['cm', t.unitCm], ['m', t.unitM]].map(([u, label]) => (
                            <button key={u} type="button" aria-pressed={(p.unit || 'cm') === u} onClick={() => changePickUnit(idx, u)} data-testid={`${fid('unit')}-${u}`}
                              style={{ border: 'none', padding: '8px 16px', minHeight: '44px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: (p.unit || 'cm') === u ? NEON.violet : 'transparent', color: (p.unit || 'cm') === u ? '#fff' : NEON.textSecondary }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, margin: '6px 0 0' }}>{t.sizeN(1)}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: p.method === 'area' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                          <div>
                            <FieldLabel htmlFor={fid('width')}>{t.sizeLabel(p.method === 'linear' ? 'length' : 'width', p.unit)}</FieldLabel>
                            <input id={fid('width')} type="number" dir="ltr" min="0" step="any" value={p.widthCm} onChange={(ev) => updatePick(idx, { widthCm: ev.target.value })} {...errProps('width')} style={numInputStyle(isHebrew)} />
                            {e.width && <ErrorText id={`${fid('width')}-error`}>{e.width}</ErrorText>}
                          </div>
                          {p.method === 'area' && (
                            <div>
                              <FieldLabel htmlFor={fid('height')}>{t.sizeLabel('height', p.unit)}</FieldLabel>
                              <input id={fid('height')} type="number" dir="ltr" min="0" step="any" value={p.heightCm} onChange={(ev) => updatePick(idx, { heightCm: ev.target.value })} {...errProps('height')} style={numInputStyle(isHebrew)} />
                              {e.height && <ErrorText id={`${fid('height')}-error`}>{e.height}</ErrorText>}
                            </div>
                          )}
                        </div>
                        {(p.extraRows || []).map((r, i) => {
                          const rowErr = e[`row${i}`];
                          const widthBad = !!rowErr && !(Number(r.widthCm) > 0);
                          const heightBad = !!rowErr && !widthBad;
                          const rowErrId = `${fid(`row${i}`)}-error`;
                          return (
                            <div key={i} style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px dashed ${NEON.border}` }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary }}>{t.sizeN(i + 2)}</div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: p.method === 'area' ? '1fr 1fr' : '1fr', gap: '10px', flex: 1 }}>
                                  <div>
                                    <FieldLabel htmlFor={fid(`xw${i}`)}>{t.sizeLabel(p.method === 'linear' ? 'length' : 'width', p.unit)}</FieldLabel>
                                    <input id={fid(`xw${i}`)} type="number" dir="ltr" min="0" step="any" value={r.widthCm} onChange={(ev) => updatePickRow(idx, i, { widthCm: ev.target.value })} aria-invalid={widthBad} aria-describedby={widthBad ? rowErrId : undefined} style={numInputStyle(isHebrew)} />
                                  </div>
                                  {p.method === 'area' && (
                                    <div>
                                      <FieldLabel htmlFor={fid(`xh${i}`)}>{t.sizeLabel('height', p.unit)}</FieldLabel>
                                      <input id={fid(`xh${i}`)} type="number" dir="ltr" min="0" step="any" value={r.heightCm} onChange={(ev) => updatePickRow(idx, i, { heightCm: ev.target.value })} aria-invalid={heightBad} aria-describedby={heightBad ? rowErrId : undefined} style={numInputStyle(isHebrew)} />
                                    </div>
                                  )}
                                </div>
                                {/* PRODUCT_TRUTH_DECORATIVE: removes one extra size of a ticked item on the check screen */}
                                <button type="button" onClick={() => removePickRow(idx, i)} aria-label={t.removeSize} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, marginTop: '22px', minWidth: '44px', minHeight: '44px' }}><X size={18} /></button>
                              </div>
                              {rowErr && <ErrorText id={rowErrId}>{rowErr}</ErrorText>}
                              <input aria-label={t.sizeLabelOptional} placeholder={t.sizeLabelOptional} value={r.label} onChange={(ev) => updatePickRow(idx, i, { label: ev.target.value })} style={{ ...inputStyle(isHebrew), marginTop: '8px' }} />
                            </div>
                          );
                        })}
                        {/* PRODUCT_TRUTH_DECORATIVE: adds another size to a ticked item on the check screen */}
                        <button type="button" onClick={() => addPickRow(idx)} style={{ background: 'none', border: `1px dashed ${NEON.violet}`, color: NEON.violet, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', width: '100%', minHeight: '44px', marginTop: '12px' }}>
                          {t.addAnotherSize}
                        </button>
                        {(p.extraRows || []).length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '0.85rem', fontWeight: 700, color: NEON.textPrimary }}>
                            {p.method === 'area' ? t.totalAreaLabel : t.totalLengthLabel}: {num(pickQuantity(p).toFixed(2))} {p.method === 'area' ? (isHebrew ? 'מ״ר' : 'm²') : (isHebrew ? 'מ\'' : 'm')}
                          </div>
                        )}
                        {/* PRODUCT_TRUTH_DECORATIVE: switches one ticked item from sizes back to a known area / length */}
                        <button type="button" onClick={() => setPickSizes(idx, false)} style={linkBtnStyle}>{p.method === 'area' ? t.knowArea : t.knowLength}</button>
                      </>
                    )}
                    <FieldLabel htmlFor={fid('price')}>{`${priceLabel} (${sym})`}</FieldLabel>
                    <input id={fid('price')} type="number" dir="ltr" min="0" step="any" value={p.unitPrice} onChange={(ev) => updatePick(idx, { unitPrice: ev.target.value })} {...errProps('price')} style={numInputStyle(isHebrew)} />
                    {e.price && <ErrorText id={`${fid('price')}-error`}>{e.price}</ErrorText>}
                    <div data-testid={`wiz-pick-total-${idx}`} style={{ marginTop: '8px', fontSize: '0.88rem', fontWeight: 800, color: NEON.violet }}>
                      {t.lineTotal}: {amt(pickQuantity(p) * (Number(p.unitPrice) || 0))}
                    </div>
                    {!p.showDetails ? (
                      // PRODUCT_TRUTH_DECORATIVE: opens the optional details for the customer of one ticked item (they do not change the price)
                      <button type="button" onClick={() => updatePick(idx, { showDetails: true, specRows: (p.specRows || []).length ? p.specRows : [{ label: '', value: '' }] })} style={linkBtnStyle}>{t.addCustomerDetailsToggle}</button>
                    ) : (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NEON.textPrimary }}>{t.addCustomerDetailsToggle}</div>
                        <p style={{ fontSize: '0.76rem', color: NEON.textSecondary, margin: '2px 0' }}>{t.customerDetailsHelper}</p>
                        <p style={{ fontSize: '0.75rem', color: NEON.textMuted, margin: '0 0 8px', fontStyle: 'italic' }}>{t.customerDetailsPriceNote}</p>
                        {(p.specRows || []).map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <input aria-label={t.detailLabel} placeholder={t.detailPlaceholder} value={r.label} onChange={(ev) => updatePickSpec(idx, i, { label: ev.target.value })} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                            <input aria-label={isHebrew ? 'ערך' : 'Value'} placeholder={t.detailValuePlaceholder} value={r.value} onChange={(ev) => updatePickSpec(idx, i, { value: ev.target.value })} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                            {/* PRODUCT_TRUTH_DECORATIVE: removes one optional detail row of a ticked item */}
                            <button type="button" onClick={() => updatePick(idx, { specRows: p.specRows.filter((_, ri) => ri !== i) })} aria-label={isHebrew ? 'הסרת השורה' : 'Remove row'} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '44px', minHeight: '44px', flexShrink: 0 }}><X size={12} strokeWidth={3} /></button>
                          </div>
                        ))}
                        {/* PRODUCT_TRUTH_DECORATIVE: adds a blank optional detail row to one ticked item */}
                        <button type="button" onClick={() => updatePick(idx, { specRows: [...(p.specRows || []), { label: '', value: '' }] })} style={{ background: 'none', border: `1px dashed ${NEON.borderStrong}`, borderRadius: '8px', padding: '10px', color: NEON.textSecondary, fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px', width: '100%' }}>{t.addSpecRow}</button>
                      </div>
                    )}
                    {inQuote && <p data-testid={`wiz-pick-in-quote-${idx}`} style={{ ...detailNoteStyle, margin: '6px 0 0' }}>{t.inQuoteAlready}</p>}
                    {!available && (
                      <div style={{ marginTop: '6px' }}>
                        <p style={{ ...detailNoteStyle, margin: 0, color: NEON.red }}>{t.notInCatalog}</p>
                        {/* PRODUCT_TRUTH_DECORATIVE: keeps a ticked item that left the catalog as a free item (its name and price as shown) */}
                        <button type="button" id={fid('keep')} onClick={() => updatePick(idx, { serviceId: '' })} aria-describedby={e.unavailable ? `${fid('unavailable')}-error` : undefined} style={linkBtnStyle}>{t.keepAsFree}</button>
                        {e.unavailable && <ErrorText id={`${fid('unavailable')}-error`}>{e.unavailable}</ErrorText>}
                      </div>
                    )}
                  </section>
                );
              })}
              {sections && sections.length > 0 && (
                <div>
                  <FieldLabel htmlFor="wiz-multi-section">{t.groupLabel}</FieldLabel>
                  {/* PRODUCT_TRUTH_DECORATIVE: chooses the unit (apartment / room / area) the whole selection is added to */}
                  <select id="wiz-multi-section" value={sectionKey} onChange={(ev) => setSectionKey(ev.target.value)} style={inputStyle(isHebrew)}>
                    <option value="">{t.noGroup}</option>
                    {sections.map((s) => <option key={s.key} value={s.key}>{s.name || t.noGroup}</option>)}
                  </select>
                </div>
              )}
              <div data-testid="wiz-multi-sum" style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '10px', background: NEON.bgCardAlt, display: 'grid', gap: '2px' }}>
                <span style={{ fontSize: '0.92rem', color: NEON.violet, fontWeight: 800 }}>{t.selectedSum}: {amt(picks.reduce((sum, p) => sum + pickQuantity(p) * (Number(p.unitPrice) || 0), 0))}</span>
                <span style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{t.calcNote}</span>
              </div>
            </div>
          )}

          {step === STEPS.REVIEW && !isMulti && (
            <div>
              <StepHeading headingRef={reviewHeadingRef} title={t.step4Title} explanation={isEditMode ? t.editModeExplanation : t.step4Explanation} />

              <ReviewGroup label={description || '—'} isHebrew={isHebrew} onEdit={() => goToStep(STEPS.ITEM)} editLabel={t.changeName}>
                {isMeasureMethod && useManualQty && (
                  <SummaryRow label={pricingMethod === 'area' ? t.totalAreaLabel : t.totalLengthLabel} value={`${calculatedValue != null ? calculatedValue.toFixed(2) : '—'} ${measureUnitWord}`} isHebrew={isHebrew} />
                )}
                {isMeasureMethod && allRowsForReview.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {allRowsForReview.map((row, i) => (
                      <SummaryRow
                        key={i}
                        label={row.label ? `${t.sizeN(i + 1)} — ${row.label}` : t.sizeN(i + 1)}
                        value={pricingMethod === 'area' ? t.calcPreviewArea(row.widthCm, row.heightCm, row.value.toFixed(2)) : t.calcPreviewLinear(row.widthCm, row.value.toFixed(2))}
                        isHebrew={isHebrew}
                      />
                    ))}
                    <SummaryRow label={pricingMethod === 'area' ? t.totalAreaLabel : t.totalLengthLabel} value={`${calculatedValue != null ? calculatedValue.toFixed(2) : '—'} ${measureUnitWord}`} isHebrew={isHebrew} />
                  </div>
                )}
                {pricingMethod === 'units' && (
                  <SummaryRow label={t.quantityLabel} value={quantity ? `${quantity}${preservedUnitLabel ? ` ${preservedUnitLabel}` : ''}` : '—'} isHebrew={isHebrew} />
                )}
                {methodResultLine && (
                  <div aria-live="polite" style={{ marginTop: '6px', fontSize: '0.92rem', color: NEON.violet, fontWeight: '800' }}>
                    {methodResultLine}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {/* PRODUCT_TRUTH_DECORATIVE: review-step edit link jumping back to the sizes/pricing details step */}
                  <EditLink label={t.changePricingAndSizes} onClick={() => goToStep(STEPS.ITEM)} />
                  {/* PRODUCT_TRUTH_DECORATIVE: review-step edit link jumping back to the pricing-method step */}
                  <EditLink label={t.changePricingMethod} onClick={() => goToStep(STEPS.ITEM)} />
                </div>
              </ReviewGroup>

              <div style={{ background: NEON.bgCardAlt, borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                {total != null && (
                  <div aria-live="polite" style={{ fontSize: '1rem', color: NEON.violet, fontWeight: '800' }}>
                    {amt(total)}
                  </div>
                )}
              </div>

              {/* PRODUCT_TRUTH_DECORATIVE: 'Add customer details' toggle revealing optional spec rows and a unit/group picker */}
              {!showCustomerDetails ? (
                <button type="button" onClick={() => setShowCustomerDetails(true)} style={{ background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', padding: '0 2px', minHeight: '44px', marginBottom: '6px', display: 'block' }}>
                  {t.addCustomerDetailsToggle}
                </button>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: NEON.textPrimary, marginBottom: '2px' }}>{t.addCustomerDetailsToggle}</div>
                  <p style={{ fontSize: '0.76rem', color: NEON.textSecondary, margin: '0 0 4px' }}>{t.customerDetailsHelper}</p>
                  <p style={{ fontSize: '0.75rem', color: NEON.textMuted, margin: '0 0 10px', fontStyle: 'italic' }}>{t.customerDetailsPriceNote}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {specRows.map((row, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px' }}>
                        <input aria-label={t.detailLabel} placeholder={t.detailPlaceholder} value={row.label} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, label: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                        <input aria-label={isHebrew ? 'ערך' : 'Value'} placeholder={t.detailValuePlaceholder} value={row.value} onChange={(e) => setSpecRows((rows) => rows.map((r, ri) => ri === i ? { ...r, value: e.target.value } : r))} style={{ ...inputStyle(isHebrew), flex: 1 }} />
                        {/* PRODUCT_TRUTH_DECORATIVE: removes one optional detail row from the item's spec list */}
                        <button type="button" onClick={() => setSpecRows((rows) => rows.filter((_, ri) => ri !== i))} aria-label={isHebrew ? 'הסרת השורה' : 'Remove row'} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '44px', minHeight: '44px', flexShrink: 0 }}><X size={12} strokeWidth={3} /></button>
                      </div>
                    ))}
                    {/* PRODUCT_TRUTH_DECORATIVE: adds a new blank optional detail row to the item's spec list */}
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
                    {allRowsForReview.length} {isHebrew ? 'מידות' : 'sizes'} · {calculatedValue != null ? calculatedValue.toFixed(2) : '—'} {measureUnitWord}
                  </div>
                )}
                {pricingMethod === 'units' && (
                  <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: '4px' }}>{num(quantity)} × {amt(unitPrice || 0)}</div>
                )}
                {activeSpecRows.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: '4px' }}>
                    {activeSpecRows.map((r, i) => <span key={i}>{i > 0 ? ' · ' : ''}{r.label}{r.label && r.value ? ': ' : ''}{r.value}</span>)}
                  </div>
                )}
                {total != null && (
                  <div style={{ fontWeight: '800', color: NEON.violet, marginTop: '6px' }}>{amt(total)}</div>
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
        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${NEON.border}`, background: NEON.bgCard, position: 'sticky', bottom: 0, flexShrink: 0 }}>
        {/* Owner 2026-10-26 (L-15, Codex F-01): a blocked action always answers next to the button - what is missing, and a way to it */}
        {blocked && (
          <div role="status" data-testid="wiz-blocked" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', fontSize: '0.8rem', fontWeight: 700, color: NEON.red }}>
            <span>{t.completeLabel}</span>
            {/* PRODUCT_TRUTH_DECORATIVE: takes the user to the missing field (scrolls it into view and focuses it); nothing changes */}
            <button type="button" onClick={() => setReveal({ ...blocked, n: Date.now() })} style={{ background: 'none', border: 'none', padding: '0 6px', color: NEON.red, fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', minHeight: '44px' }}>{blocked.label}</button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: footer 'Back' button; closes the wizard on the first step or steps back one page otherwise */}
          <button type="button" onClick={step === STEPS.ITEM ? requestClose : goBack} style={secondaryBtnStyle}>
            {isHebrew ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {step === STEPS.ITEM ? t.cancel : t.back}
          </button>
          {/* PRODUCT_TRUTH_DECORATIVE: 'Add item' confirm button on the final review step; completes the already-documented add-item wizard */}
          {step === STEPS.REVIEW ? (
            <button type="button" onClick={isMulti ? handleConfirmMany : handleConfirm} data-testid={isMulti ? 'wiz-add-many' : undefined} style={primaryBtnStyle}>{isMulti ? t.addMany(picks.length) : t.addItem}</button>
          ) : (
            // PRODUCT_TRUTH_DECORATIVE: footer 'Next' button advancing the wizard, disabled until a pricing method is chosen
            <button
              type="button"
              onClick={goNext}
              style={primaryBtnStyle}
            >
              {isMulti ? t.toReviewCount(picks.length) : t.toReview}
              {isHebrew ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// חוק ברזל (Decision 5 - "every required stage must show a clear heading
// + one short explanatory sentence directly beneath it"): נקודת-רינדור
// יחידה כדי שכל השלבים ישמרו על אותה מדרגיות ויזואלית (כותרת מודגשת,
// הסבר משני קטן-יותר וממוסך) - לא ארבע מימושים עצמאיים שעלולים להתפצל.
function StepHeading({ title, explanation, id, headingRef }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <h3 id={id} ref={headingRef} tabIndex={headingRef ? -1 : undefined} style={{ fontSize: '0.95rem', fontWeight: '700', color: NEON.textPrimary, margin: 0, outline: 'none' }}>{title}</h3>
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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexDirection: 'row' }}>
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

// PRODUCT_TRUTH_DECORATIVE: MethodCard's own selectable div; a generic reusable pricing-method-selection card whose behavior is supplied by its callers (already assessed above)
function MethodCard({ id, icon, title, example, recommended, recommendedLabel, onClick, selected, locked, lockedLabel, onKeyDown }) {
  // Owner 2026-10-26 (real-walk finding 5): the focused card is always visibly marked (also after a programmatic focus)
  const [focused, setFocused] = useState(false);
  return (
    <div
      id={id}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
        border: `2px solid ${selected ? NEON.violet : NEON.border}`,
        background: selected ? NEON.violetLighter : NEON.bgCardAlt,
        minHeight: '44px',
        outline: focused ? `3px solid ${NEON.violetLight}` : 'none',
        outlineOffset: '2px',
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

// PRODUCT_TRUTH_DECORATIVE: EditLink's own generic reusable text-link button; renders whatever label/onClick its caller supplies
function EditLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', padding: '6px 4px', minHeight: '44px' }}>
      <Pencil size={11} strokeWidth={2.5} />
      {label}
    </button>
  );
}

function ReviewGroup({ label, onEdit, editLabel, children }) {
  return (
    <div style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexDirection: 'row', gap: '8px' }}>
        <span style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.95rem' }}>{label}</span>
        {/* PRODUCT_TRUTH_DECORATIVE: EditLink usage inside the description/name review group; jumps back to step 1 to change the name/description */}
        <EditLink label={editLabel} onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0', flexDirection: 'row', gap: '8px' }}>
      <span style={{ color: NEON.textSecondary }}>{label}</span>
      {/* Owner 2026-10-26 (L-17, Codex F-05): the value is its own isolated run with tabular digits */}
      <bdi style={{ color: NEON.textPrimary, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{value}</bdi>
    </div>
  );
}

function inputStyle(isHebrew) {
  return { width: '100%', padding: '11px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', minHeight: '44px' };
}

// Owner 2026-10-26 (L-17, Codex F-05): a number field is an LTR-isolated tabular value; it stays aligned to the start of the language
function numInputStyle(isHebrew) {
  return { ...inputStyle(isHebrew), direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' };
}

const detailNoteStyle = { fontSize: '0.8rem', color: NEON.textSecondary, margin: '0 0 8px', lineHeight: '1.4' };
const linkBtnStyle = { display: 'block', marginTop: '6px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: '6px 0', minHeight: '44px' };
const primaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: NEON.gradient, color: 'white', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };
const secondaryBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, padding: '12px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };
