import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import DraggableCalculator from './DraggableCalculator';
import AddItemWizard from './AddItemWizard';
import { Calculator, Calendar, Paperclip, MapPin, X, AlertTriangle, Rocket, Lock, Plus, CopyPlus, ChevronDown, MoreVertical, Pencil, Trash2, FolderInput, ListPlus, RotateCcw, FileText, Building2, LayoutList } from 'lucide-react';
import { LIGHT as NEON, FONT_HE, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { formatNumberLocal, calculateQuoteFinancials } from '../utils/regionConfig';
import { formatQuoteFallback } from '../utils/quoteNumber';
import { getProfessionalUnitLabel, getActiveQuantity, isProfessionalItem, isMeasurableUnit, withActiveQuantities, groupItemsBySection } from '../utils/professionalQuoteItem';

const getDialByCurrency = (curr) => {
  if (curr === 'GBP') return { dial: '+44', label: 'GB (+44)' };
  if (curr === 'EUR') return { dial: '+49', label: 'DE (+49)' };
  if (curr === 'CAD') return { dial: '+1', label: 'CA (+1)' };
  if (curr === 'AUD') return { dial: '+61', label: 'AU (+61)' };
  if (curr === 'USD') return { dial: '+1', label: 'US (+1)' };
  return { dial: '+972', label: 'IL (+972)' };
};

export default function QuoteForm({
  editingQuoteId,
  editingQuoteNumber,
  onSave,
  onCancel,
  clientName, setClientName,
  clientEmail, setClientEmail,
  clientPhone, setClientPhone,
  clientType, setClientType,
  clientTaxId, setClientTaxId,
  clientAddress, setClientAddress,
  quoteSubject, setQuoteSubject,
  attnName, setAttnName,
  attnRole, setAttnRole,
  currency,
  quoteStatus, setQuoteStatus,
  validUntil, setValidUntil,
  discount, setDiscount,
  terms, setTerms,
  warranty, setWarranty,
  defaultTerms,
  defaultWarranty,
  notes, setNotes,
  items, setItems,
  sections, setSections, addSection, renameSection, removeSection,
  quoteStructureMode, setQuoteStructureMode,
  projectName, setProjectName,
  services,
  clients,
  isHebrew,
  isLocalIsraeliBusiness,
  t,
  sym,
  formatNum,
  subtotal,
  discountAmount,
  taxAmount,
  totalAmount,
  removeItem,
  handleItemChange,
  canUseAttachments,
  canUseProfessionalQuotes,
  recommendedPricingMethod,
  duplicateItem,
  canUseProfessionalQuoteReuse,
  onOpenPricingModal,
  quoteFiles,
  setQuoteFiles,
  allUserAttachments
}) {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const dateInputRef = useRef(null);

  // חוק ברזל (Professional Quotes Stage C, §158, Visible-but-Locked, §155.1.11):
  // אותו מודל-שדרוג קיים בדיוק (לא מודל חדש - "do NOT build a large reusable
  // upgrade-modal architecture merely for Stage C") - הכללה ל-reason string
  // כדי לשרת גם attachments (PRO) וגם professionalQuotes Core (BASIC+),
  // שתי הודעות שונות דרך אותו JSX/state.
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(null); // null | 'attachments' | 'professional'
  const [errorMessage, setErrorMessage] = useState('');

  // חוק ברזל (Owner Visual Review - Correction 4, "one consolidated actions
  // menu"): אינדקס יחיד פתוח (לא boolean-per-index) - מבטיח תפריט-פעולות
  // אחד בכל רגע נתון, ונסגר אוטומטית בלחיצה מחוץ לתפריט (לא נשאר תקוע
  // פתוח כשהמשתמש עובר הלאה).
  const [openActionsMenu, setOpenActionsMenu] = useState(null);

  // חוק ברזל (Two-Stage Completion Task, Stage 1D - "simplify without losing
  // history"): שני textarea-ים גדולים תמיד-גלויים (תנאים+אחריות) תפסו שטח
  // אנכי משמעותי גם כשהם כבר בדיוק ברירת-המחדל מהגדרות העסק (המקרה הנפוץ
  // ביותר) - קומפקטי-מקופל כברירת מחדל, עם אינדיקציה ברורה אם ההצעה הזו
  // כן הותאמה אישית (terms/warranty בפועל שונים מברירות-המחדל הנוכחיות של
  // העסק - defaultTerms/defaultWarranty, שני props חדשים מ-Dashboard.jsx,
  // בלי שכפול-מקור-אמת: עדיין nur קורא את אותו state שהעסק כבר מנהל).
  const [termsWarrantyExpanded, setTermsWarrantyExpanded] = useState(false);
  const isTermsWarrantyCustomized = terms !== (defaultTerms ?? '') || warranty !== (defaultWarranty ?? '');
  // חוק ברזל: "confirmation if doing so would overwrite custom text" - אם
  // הערכים הנוכחיים כבר זהים לברירת-המחדל, אין מה "לאבד" ואין צורך לחסום
  // בדיאלוג-אישור מיותר.
  const handleRestoreTermsWarrantyDefaults = () => {
    if (isTermsWarrantyCustomized) {
      const msg = isHebrew
        ? 'פעולה זו תחליף את התנאים/האחריות המותאמים של הצעה זו בברירת המחדל הנוכחית מהגדרות העסק. להמשיך?'
        : 'This will replace this quote\'s customized terms/warranty with the current Business Settings defaults. Continue?';
      if (!window.confirm(msg)) return;
    }
    setTerms(defaultTerms ?? '');
    setWarranty(defaultWarranty ?? '');
  };
  useEffect(() => {
    if (openActionsMenu == null) return;
    const closeMenu = () => setOpenActionsMenu(null);
    // חוק ברזל (Addendum - תפריט-פעולות תפוס תחת סרגל צד, RTL): Escape סוגר
    // את התפריט בדיוק כמו לחיצה-מחוץ-לו - נדרש מפורש (Addendum: "Escape").
    // הזרת ה-focus לכפתור-המפעיל עצמו מטופלת בתוך CompactItemCard (שם ה-
    // ref לכפתור בפועל קיים), לא כאן.
    const onKeyDown = (e) => { if (e.key === 'Escape') closeMenu(); };
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openActionsMenu]);

  // חוק ברזל (Owner-Approved Smart Quote UX, Stage 2): פעולת-כניסה דומיננטית
  // יחידה - פותחת AddItemWizard, שבסיום בונה אובייקט-פריט שלם (זהה-צורה
  // למה ש-handleProfessionalUnitChange/handleCatalogAdd הקיימים כבר מייצרים)
  // ומוסיף אותו ב-setItems אחד אטומי - לא נתיב-הוספה שני-במקביל, רק חזית
  // מודרכת לפני אותה תוצאת-נתונים בדיוק. wizardSectionKey מאפשר גם את כפתור
  // "+ פריט לקטגוריה זו" הקיים לפתוח את אותו אשף עם הקטגוריה כבר-נבחרת.
  const [isAddWizardOpen, setIsAddWizardOpen] = useState(false);
  const [wizardSectionKey, setWizardSectionKey] = useState(null);
  // חוק ברזל (Smart Quote Guided UX Completion task, §C - Add/Edit
  // unification): editingItemIndex הוא היחיד שמבחין בין הוספה (null) לעריכה
  // (אינדקס אמיתי) - אותו AddItemWizard, אותו קולבק (handleWizardSave),
  // אין עוד משטח-עריכה נפרד/טכני שני. openEditWizard הוא ה-onEdit היחיד
  // שכל כרטיס-פריט קורא לו עכשיו.
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const openAddWizard = (sectionKey = null) => { setWizardSectionKey(sectionKey); setEditingItemIndex(null); setIsAddWizardOpen(true); };
  const openEditWizard = (index) => { setEditingItemIndex(index); setIsAddWizardOpen(true); };
  const handleWizardSave = (savedItem) => {
    if (editingItemIndex != null) {
      setItems(items.map((it, i) => (i === editingItemIndex ? savedItem : it)));
      return;
    }
    setItems([...items, savedItem]);
  };

  // חוק ברזל (Smart Quote Structure-First UX Correction task): כל יחידה
  // (unit/section) היא כעת קונטיינר-עבודה חי - Decision 10 (collapse/
  // expand, session-only, ללא schema/persistence חדשים - "do not add
  // schema only for UI collapse state"). ברירת-המחדל היא "מורחב" (הרשימה
  // הריקה עצמה היא כבר אינדיקציה שימושית - "empty units must remain
  // visibly empty" ולכן לא כדאי לקפל ברירת-מחדל) - collapsedUnitKeys
  // מחזיק רק את מה שהמשתמש-בפועל קיפל, לא ההפך.
  const [collapsedUnitKeys, setCollapsedUnitKeys] = useState(() => new Set());
  const toggleUnitCollapsed = (key) => {
    setCollapsedUnitKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  // חוק ברזל (Decision 7 - "create / rename / remove unit safely"): הסרת
  // יחידה עם פריטים בתוכה לעולם לא מוחקת/מייתמת פריטים בשקט - נפתח דיאלוג-
  // בחירה בטוח (ביטול / העברה ל"לא משויך" / העברה ליחידה אחרת קיימת).
  // יחידה ריקה מוסרת מיידית, ללא דיאלוג - "remove empty unit" בלבד.
  const [unitRemovalTarget, setUnitRemovalTarget] = useState(null); // { key, name, itemCount } | null
  const [unitRemovalDestination, setUnitRemovalDestination] = useState('');
  const requestRemoveSection = (section, itemCount) => {
    if (itemCount === 0) { removeSection(section.key); return; }
    setUnitRemovalDestination('');
    setUnitRemovalTarget({ key: section.key, name: section.name || (isHebrew ? '(ללא שם)' : '(unnamed)'), itemCount });
  };
  const confirmRemoveSection = () => {
    if (!unitRemovalTarget) return;
    const { key } = unitRemovalTarget;
    const destinationKey = unitRemovalDestination || null; // '' = Unassigned
    setItems(prev => prev.map(it => (it.section_key === key ? { ...it, section_key: destinationKey } : it)));
    removeSection(key);
    setUnitRemovalTarget(null);
  };

  // חוק ברזל (Decision 11 - "unit subtotal must reconcile exactly with the
  // items shown in that unit... never maintain a second independent
  // financial calculation"): אותה נקודת-אמת קנונית בדיוק ש-Dashboard.jsx
  // עצמו כבר משתמש בה לסכום-הביניים הכולל (calculateQuoteFinancials +
  // withActiveQuantities) - country/clientType מושמטים בכוונה (enteredSubtotal
  // מחושב לפני כל ענף תלוי-מע"מ/אזור בפונקציה עצמה, ר' regionConfig.js -
  // getRegionTaxRate(undefined) עצמה בטוחה/לא-זורקת) כי כאן נדרש רק סכום-
  // ביניים גולמי, לא מס/הנחה ברמת-היחידה. discount:0 בכוונה - הנחת ההצעה
  // כולה מוצגת פעם אחת בלבד, ברמת ההצעה, לא כפולה בכל יחידה.
  const computeUnitSubtotal = (indices) => {
    const unitItems = indices.map(i => items[i]);
    return calculateQuoteFinancials({ items: withActiveQuantities(unitItems), discount: 0 }).enteredSubtotal;
  };

  // חוק ברזל (Decision 8 - "change quote structure without data loss"):
  // Regular -> Divided לעולם לא נדרש למחוק/להמציא נתונים - בכל פריט קיים
  // כבר section_key===null (בהכרח, כל עוד המבנה היה Regular - הבורר/הכפתור
  // הגלובלי לא מציעים שיוך-יחידה בכלל) - אז המעבר עצמו הוא רק שינוי-דגל,
  // הפריטים הקיימים "נופלים" אוטומטית ל-"לא משויך" (unassignedIndices
  // למטה), בדיוק כפי שנדרש ("a clearly visible temporary Unassigned
  // container requiring review") בלי אף מוטציה על items/sections.
  const handleSwitchToDivided = () => setQuoteStructureMode('divided');

  // Divided -> Regular: תמיד בטוח (איחוד לרשימה שטוחה אחת, אף פריט/סכום
  // לא הולך לאיבוד - section_key מתאפס לכולם) אך דורש אישור מפורש לפני
  // איבוד-המבנה עצמו (לא הנתונים) - "truthful blocking is better than
  // destructive convenience" מתייחס למקרה מסוכן-אמיתי, וזה אינו כזה.
  const handleSwitchToRegular = () => {
    const msg = isHebrew
      ? 'המעבר להצעה רגילה יאחד את כל היחידות לרשימה אחת. כל הפריטים והסכומים יישמרו במלואם. להמשיך?'
      : 'Switching to a regular quote will merge all units into one list. All items and amounts will be fully preserved. Continue?';
    if (!window.confirm(msg)) return;
    setItems(prev => prev.map(it => ({ ...it, section_key: null })));
    setSections([]);
    setQuoteStructureMode('regular');
  };

  const currencyPhoneConfig = getDialByCurrency(currency);
  const defaultDial = isLocalIsraeliBusiness ? '+972' : currencyPhoneConfig.dial;
  const defaultLabel = isLocalIsraeliBusiness ? 'IL (+972)' : currencyPhoneConfig.label;
  const [localPhone, setLocalPhone] = useState('');

  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setClientPhone(`${defaultDial} ${numVal}`);
  };

  useEffect(() => {
    if (clientPhone) {
      if (clientPhone.startsWith(defaultDial)) {
        setLocalPhone(clientPhone.replace(defaultDial, '').trim());
      } else {
        const clean = clientPhone.replace(/^\+\d+/, '').trim();
        setLocalPhone(clean || clientPhone);
      }
    } else {
      setLocalPhone('');
    }
  }, [clientPhone, defaultDial]);

  const handleAddressFieldChange = (newStreet, newCity, newState, newZip) => {
    setStreet(newStreet);
    setCity(newCity);
    setStateProv(newState);
    setZipCode(newZip);
    const combined = `${newStreet}|${newCity}|${newState}|${newZip}`;
    setClientAddress(combined);
  };

  useEffect(() => {
    if (clientAddress) {
      const parts = clientAddress.split('|');
      if (parts.length >= 4) {
        setStreet(parts[0] || '');
        setCity(parts[1] || '');
        setStateProv(parts[2] || '');
        setZipCode(parts[3] || '');
      } else {
        setStreet(clientAddress);
        setCity('');
        setStateProv('');
        setZipCode('');
      }
    } else {
      setStreet('');
      setCity('');
      setStateProv('');
      setZipCode('');
    }
  }, [clientAddress]);

  const handleClientSelect = (e) => {
    const val = e.target.value;
    setClientName(val);
    const found = clients.find(c => c.company_name?.toLowerCase() === val.toLowerCase());
    if (found) {
      setClientEmail(found.email || '');
      setClientPhone(found.phone || '');
      setClientType(found.client_type || '');
      setClientTaxId(found.tax_id || '');
      setClientAddress(found.address || '');
    }
  };

  // חוק ברזל (§168 - Project/Section hierarchy, PROFLOW_TODO.md 30.C):
  // מחשב סדר-תצוגה בלבד (לא משנה את מערך-ה-state items עצמו, ולא את
  // sort_order שנשמר בפועל - זה נגזר מחדש מ-handleSaveQuote ב-Dashboard.jsx
  // לפי הסדר הזה בדיוק בזמן השמירה) - פריטים מקובצים לפי ה-section שלהם
  // (לפי sort_order של ה-sections), ואז כל הפריטים ה"ללא-קטגוריה"
  // (unsectioned, כולל section_key שמצביע ל-section שהוסר) בסוף - זהה-בייט
  // לפריסה השטוחה הקיימת עבור הצעה בלי sections כלל (orderedItemIndices
  // === [0,1,2,...] בדיוק).
  // חוק ברזל (Smart Quote End-to-End Structural Unification task, Part O
  // anti-patch self-check - "no UI component should independently
  // rediscover grouping from raw arrays"): קיבוץ-לפי-אינדקסים כאן קורא
  // עכשיו ישירות ל-groupItemsBySection (professionalQuoteItem.js), אותה
  // פונקציה קנונית ש-quotePresentationModel.js גם היא בנויה עליה - לא
  // פרדיקטה מקבילה עצמאית יותר (כפי שהייתה עד למשימה הזו). ה-editor
  // עצמו לעולם לא קורא ל-buildEditorPresentationModel ישירות: המודל הזה
  // מסנן יחידות-ללא-שם-ממשי-עדיין (tempKey טרי) כי הוא מיועד לתצוגה
  // סופית/ללקוח - אך העורך חייב להציג גם יחידה כזו (המשתמש באמצע הקלדת
  // השם שלה, ר' Journey 2), ולכן ממשיך להשתמש ב-groupItemsBySection
  // הגולמי (ללא הסינון-על-שם), רק ממיר item-objects בחזרה ל-index (via
  // items.indexOf, בטוח - כל item הוא reference ייחודי מתוך items עצמו)
  // כדי ש-onEdit/onDelete/onDuplicate/handleItemChange הקיימים (עובדים
  // לפי index) ימשיכו לפעול ללא שינוי, גם מתוך כרטיס-יחידה מקונן.
  const { groups: sectionGroups, unsectioned: unsectionedItems } = groupItemsBySection(items, sections);
  const unitItemIndices = sectionGroups.map(({ section, items: groupItems }) => ({
    section,
    indices: groupItems.map((it) => items.indexOf(it)),
  }));
  const unassignedIndices = unsectionedItems.map((it) => items.indexOf(it));
  const orderedItemIndices = [...unitItemIndices.flatMap(g => g.indices), ...unassignedIndices];

  // חוק ברזל (Smart Quote Structure-First UX Correction task): נקודת-
  // רינדור משותפת יחידה לכרטיס-פריט קומפקטי - הרשימה השטוחה (Regular) וכל
  // כרטיס-יחידה (Divided, ר' UnitCard למטה) קוראים לה, כך שאין שני עותקים
  // בלתי-תלויים של אותו JSX/props. sectionName תמיד null כאן - במצב Regular
  // אין sections בכלל (מבנה), ובמצב Divided ההכלה-בתוך-כרטיס-היחידה כבר
  // מציינת את השיוך, תג-badge חוזר-על-עצמו היה כפילות-מיותרת.
  const renderItemCard = (index) => {
    const item = items[index];
    const isPro = isProfessionalItem(item);
    const isMeasurable = isMeasurableUnit(item.pricing_unit);
    const activeQty = getActiveQuantity(item);
    const unitPriceLabel = getProfessionalUnitLabel(item.pricing_unit, isHebrew);
    const compactCalcSummary = isPro && isMeasurable
      ? `${formatNum(activeQty)} ${unitPriceLabel} × ${sym}${formatNum(item.unit_price || 0)}`
      : `${formatNum(activeQty)} × ${sym}${formatNum(item.unit_price || 0)}`;
    const compactHasSpec = Array.isArray(item.specification) && item.specification.length > 0;
    return (
      <CompactItemCard
        isHebrew={isHebrew}
        name={item.isFromCatalog || item.description ? item.description : (isHebrew ? '(ללא שם)' : '(unnamed)')}
        calcSummary={compactCalcSummary}
        total={`${sym}${formatNum(activeQty * Number(item.unit_price || 0))}`}
        hasSpec={compactHasSpec}
        sectionName={null}
        onExpand={() => openEditWizard(index)}
        menuOpen={openActionsMenu === index}
        onToggleMenu={(e) => { e.stopPropagation(); setOpenActionsMenu(openActionsMenu === index ? null : index); }}
        onEdit={() => { setOpenActionsMenu(null); openEditWizard(index); }}
        onDuplicate={() => {
          setOpenActionsMenu(null);
          if (isPro && !canUseProfessionalQuoteReuse) { setShowUpgradeConfirm('reuse'); return; }
          duplicateItem(index);
        }}
        canDuplicate={true}
        duplicateLocked={isPro && !canUseProfessionalQuoteReuse}
        sections={sections}
        currentSectionKey={item.section_key || ''}
        onMoveSection={(key) => { handleItemChange(index, 'section_key', key || null); }}
        onDelete={() => { setOpenActionsMenu(null); removeItem(index); }}
        canDelete={items.length > 1}
      />
    );
  };

  // חוק ברזל (Entitlement/Quota Centralization, §150, סעיף 4): קורא ישירות
  // ל-entitlement.attachments (resolveAccountEntitlement, מחושב פעם אחת
  // ב-Dashboard.jsx ומועבר כ-canUseAttachments) - במקום userPlan==='pro'||
  // isSuperAdmin, נוסחה שלישית ועצמאית שניחשה את אותה עובדה בעצמה
  // (Core Architectural Law: "component C guesses plan" - בדיוק המקרה
  // שתועד). כבר כולל super_admin (entitlement.attachments = isSuperAdmin ||
  // planDef.attachments) - לא נדרש תנאי נפרד.
  const handleAttachmentClick = () => {
    if (!canUseAttachments) {
      setShowUpgradeConfirm('attachments');
    } else {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        const MAX_FILE_SIZE = 3 * 1024 * 1024;

        // חישוב גלובלי של כל הקבצים בענן + קבצי הטיוטה הנוכחיים בטופס
        const existingGlobalBytes = (allUserAttachments || []).reduce((acc, f) => acc + (Number(f.file_size || f.size || 0)), 0);
        const currentDraftBytes = (quoteFiles || []).filter(f => !f.id).reduce((acc, f) => acc + (Number(f.size || f.file_size || 0)), 0);
        const CURRENT_TOTAL_SIZE = existingGlobalBytes + currentDraftBytes;
        const MAX_TOTAL_SIZE = 30 * 1024 * 1024;

        for (let file of files) {
          if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(isHebrew ? `הקובץ "${file.name}" חורג מהגודל המותר לקובץ יחיד (עד 3MB).` : `File "${file.name}" exceeds the 3MB limit for a single file.`);
            return;
          }
          if (CURRENT_TOTAL_SIZE + file.size > MAX_TOTAL_SIZE) {
            setErrorMessage(isHebrew ? `העלאת קובץ זה תעבור את מכסת הנפח הכוללת לעסק (30MB).` : `Uploading this file exceeds the total 30MB capacity limit for your business.`);
            return;
          }
        }
        setErrorMessage('');
        setQuoteFiles(prev => [...(prev || []), ...files]);
      };
      fileInput.click();
    }
  };

  const removeFile = async (index) => {
    const targetFile = (quoteFiles || [])[index];
    if (targetFile && targetFile.id) {
      const { supabase } = await import('../shared/supabase');
      await supabase.from('quote_attachments').delete().eq('id', targetFile.id);
    }
    setQuoteFiles(prev => (prev || []).filter((_, i) => i !== index));
  };

  // חישוב גלובלי אמיתי של הנפח שנותר מתוך 30 מגה לכלל העסק
  const globalAttachmentsBytes = (allUserAttachments || []).reduce((acc, f) => acc + (Number(f.file_size || f.size || 0)), 0);
  const draftAttachmentsBytes = (quoteFiles || []).filter(f => !f.id).reduce((acc, f) => acc + (Number(f.size || f.file_size || 0)), 0);
  const totalGlobalBytes = globalAttachmentsBytes + draftAttachmentsBytes;
  const remainingMb = Math.max(0, (30 - (totalGlobalBytes / (1024 * 1024)))).toFixed(1);

  const isUS = currency === 'USD';
  const dateFormatLabel = isUS ? 'MM-DD-YYYY' : 'DD-MM-YYYY';

  const getDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return isUS ? `${m}-${d}-${y}` : `${d}-${m}-${y}`;
    }
    return dateStr;
  };

  const handleDisplayDateChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);

    if (val.length === 8) {
      const p1 = val.slice(0, 2);
      const p2 = val.slice(2, 4);
      const p3 = val.slice(4, 8);
      if (isUS) {
        setValidUntil(`${p3}-${p1}-${p2}`);
      } else {
        setValidUntil(`${p3}-${p2}-${p1}`);
      }
    } else {
      setValidUntil(e.target.value);
    }
  };

  return (
    <div style={{ background: 'transparent', padding: '4px 0 20px', borderRadius: 0, marginBottom: '20px', border: 'none', borderTop: editingQuoteId ? `3px solid ${NEON.violet}` : 'none', boxShadow: 'none', fontFamily: FONT_HE }}>
      {/* V2 "boxes inside boxes" correction (Owner explicit): the outer form
          canvas no longer carries its own border+shadow when creating a new
          quote - every section already has its own card treatment (border+
          shadow), so an outer box around all of them was a redundant second
          frame. The one meaningful exception: editing an existing quote keeps
          a clear signal (now a colored top accent bar instead of a full
          boxed border, so it still reads instantly as "editing mode" without
          reintroducing the double-box feeling for the common create-new
          case). Padding reduced now that there's no outer frame competing
          for visual weight with the section cards inside it. */}
      <DraggableCalculator isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} isHebrew={isHebrew} currency={currency} />

      <AddItemWizard
        isOpen={isAddWizardOpen}
        onClose={() => setIsAddWizardOpen(false)}
        onAdd={handleWizardSave}
        editingItem={editingItemIndex != null ? items[editingItemIndex] : null}
        isHebrew={isHebrew}
        sym={sym}
        formatNum={formatNum}
        services={services}
        sections={sections}
        defaultSectionKey={wizardSectionKey}
        canUseProfessionalQuotes={canUseProfessionalQuotes}
        recommendedMethod={recommendedPricingMethod}
        onRequestUpgrade={() => { setIsAddWizardOpen(false); setShowUpgradeConfirm('professional'); }}
      />

      {/* מודל שדרוג PRO מעוצב */}
      {showUpgradeConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '14px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', ...neonGlowTextStyle }}>
              <Rocket size={18} color={NEON.violetLight} />
              {showUpgradeConfirm === 'professional'
                ? (isHebrew ? 'זמין במסלולים בתשלום' : 'Available with a paid plan')
                : (isHebrew ? 'שדרוג למסלול PRO' : 'Upgrade to PRO Plan')}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              {showUpgradeConfirm === 'professional'
                ? (isHebrew
                    ? 'הוספת מידות ופרטים מקצועיים להצעה זמינה במסלולי BASIC ומעלה - כך תוכלו למדוד, לחשב ולהציג הצעות מקצועיות ומדויקות יותר. לשדרג עכשיו?'
                    : 'Adding measurements and professional details to a quote is available on BASIC and above - measure, calculate, and present more accurate professional quotes. Upgrade now?')
                : (isHebrew
                    ? 'אופציה זו הינה למשתמשי מסלול PRO בלבד. האם תרצה לשדרג את חשבונך כעת?'
                    : 'This option is for PRO plan users only. Would you like to upgrade your account now?')}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowUpgradeConfirm(null);
                  if (onOpenPricingModal) onOpenPricingModal();
                }}
                style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON.glow }}
              >
                {isHebrew ? 'כן, שדרג עכשיו' : 'Yes, Upgrade Now'}
              </button>
              <button
                type="button"
                onClick={() => setShowUpgradeConfirm(null)}
                style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {isHebrew ? 'לא תודה' : 'No Thanks'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל שגיאות עיצובי נקי במקום alert */}
      {errorMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} dir={isHebrew ? 'rtl' : 'ltr'}>
          <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '24px', borderRadius: '14px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: NEON.red, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              {isHebrew ? 'שגיאה בהעלאת קובץ' : 'File Upload Error'}
            </h3>
            <p style={{ color: NEON.textSecondary, fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON.glow }}
            >
              {isHebrew ? 'אישור' : 'OK'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${NEON.border}`, flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ marginTop: 0, fontSize: '1.3rem', fontWeight: '800', marginBottom: '4px', color: NEON.textPrimary }}>
            {editingQuoteId
              ? `${isHebrew ? 'עריכת הצעה ' : 'Editing Quote '}${formatQuoteFallback({ id: editingQuoteId, quote_number: editingQuoteNumber })}`
              : (isHebrew ? 'יצירת הצעת מחיר חדשה' : 'Create New Quote')}
          </h2>
          <p style={{ color: NEON.textSecondary, margin: 0, fontSize: '0.82rem' }}>
            {isHebrew ? 'הזן את פרטי ההצעה ושמור את השינויים' : 'Enter the quote details and save changes'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: NEON.bgCard, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}
        >
          {isHebrew ? 'ביטול וחזרה לרשימה' : 'Cancel & Return'}
        </button>
      </div>

      <form onSubmit={onSave}>
        {/* V2 Visual Completion Pass: Client Details + Quote Details now sit
            side-by-side (Image 1 reference) via the same auto-fit/minmax grid
            pattern already used everywhere else in this file for field rows -
            no new responsive mechanism, stacks to one column automatically
            below ~660px total width.
            חוק ברזל (Task H - mobile page-level horizontal overflow fix,
            live-measured root cause): minmax(320px, 1fr) בלבד (בלי min())
            אילץ track ברוחב 320px קבוע גם כשה-container הזמין צר יותר
            (למשל 308px ב-viewport 320px, אחרי padding של dash-main-content) -
            נמדד בפועל: gridTemplateColumns מחושב ל-"320px", clientWidth=308,
            scrollWidth=320 - חריגה אמיתית של 12px שהתפשטה עד dash-app-shell
            (שם נבלעה רק בגלל overflow-x:hidden הגנתי שכבר קיים שם, לא תוקן
            כאן במקור). minmax(min(320px, 100%), 1fr) הוא אותו טור בדיוק בכל
            רוחב שבו 320px נכנס בנוחות (מעל ~660px total width, שתי עמודות;
            ומתחת לזה, עמודה אחת ברוחב 320px כרגיל) - רק כש-100% הזמין קטן
            מ-320px, ה-min() קוצץ את המינימום לרוחב הזמין בפועל במקום לאלץ
            חריגה. שאר ה-minmax grids בקובץ הזה (160px/140px/120px) לא נגעו -
            נבדקו בפועל בכל 5 הרוחבים (320/360/375/390/430) ומעולם לא הגיעו
            למינימום שלהם (רוחב זמין תמיד גדול מהמינימום), אז אינם צריכים
            את אותו תיקון. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '14px', marginBottom: '14px' }}>
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: NEON.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
          {isHebrew ? 'פרטי לקוח' : 'Client Details'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientName}</label>
            <input
              type="text"
              value={clientName}
              onChange={handleClientSelect}
              list="existing-clients-list"
              placeholder="e.g. Acme Corp"
              required
              style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
            />
            <datalist id="existing-clients-list">
              {clients.map(c => <option key={c.id} value={c.company_name} />)}
            </datalist>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'סוג לקוח (חובה)' : 'Client Type'}</label>
            <select
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              required={!editingQuoteId}
              style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.85rem' }}
            >
              <option value="" disabled>{isHebrew ? 'בחר סוג לקוח...' : 'Select Client Type...'}</option>
              <option value="business">{isHebrew ? 'עסקי (חברה/עוסק)' : 'Business'}</option>
              <option value="private">{isHebrew ? 'פרטי (B2C)' : 'Private'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientEmail}</label>
            <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.clientPhone}</label>
            {/* חוק ברזל (Stage 1B, תיקון-שורש): נמצא חי (סריקת scrollWidth
                על כל אלמנט ב-392px) ש-scrollWidth=242 מול clientWidth=166 -
                ה-input הפנימי (flex:1) לא הצטמצם מתחת לרוחב-התוכן הטבעי
                שלו (ברירת-מחדל min-width:auto בפריט-flex), כך שהמכל כולו
                נאלץ לרוחב-מינימלי גדול מהעמודה שהוקצתה לו ב-grid ההורה -
                עם overflow:hidden זה לא הזליג לגלילת-עמוד, אבל כן קטע/דחס
                את שדה-הטלפון בפועל. minWidth:0 על שני הרמות (המכל + ה-
                input) הוא התיקון הסטנדרטי-הנכון לבעיית-flex הזו, לא עוד
                overflow-hidden. */}
            <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, overflow: 'hidden', boxSizing: 'border-box', minWidth: 0 }}>
              <div style={{ background: NEON.bgCardAlt, padding: '7px 10px', fontSize: '0.8rem', color: NEON.textPrimary, fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: `1px solid ${NEON.borderStrong}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {defaultLabel}
              </div>
              <input
                type="text"
                value={localPhone}
                onChange={(e) => handleLocalPhoneChange(e.target.value)}
                placeholder="502345678"
                style={{ flex: '1 1 auto', minWidth: 0, padding: '7px 10px', border: 'none', outline: 'none', background: 'transparent', color: NEON.textPrimary, direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'ח.פ / עוסק / ת.ז' : 'Tax ID / ID'}</label>
            <input type="text" value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} required={clientType === 'business'} style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>

          {/* Item 18 - Attention Contact ("לידי"/"Attn"), quote-level (not
              client-level - a historical quote must keep showing who it was
              addressed to even if the client's own contacts later change,
              per the TODO's own explicit data principle). Both optional,
              placed inside the same auto-wrapping grid as the fields above
              so Mobile stacking is already handled for free - no extra
              media query needed. */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'לידי (איש קשר, לא חובה)' : 'Attn (contact, optional)'}</label>
            <input type="text" value={attnName || ''} onChange={(e) => setAttnName(e.target.value)} placeholder={isHebrew ? 'לדוגמה: שמעון לוי' : 'e.g. Simon Levy'} style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'תפקיד / תואר (לא חובה)' : 'Role / Title (optional)'}</label>
            <input type="text" value={attnRole || ''} onChange={(e) => setAttnRole(e.target.value)} placeholder={isHebrew ? 'לדוגמה: מנהל פרויקטים' : 'e.g. Project Manager'} style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
        </div>
        </div>

        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: '800', color: NEON.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
          {isHebrew ? 'פרטי הצעה' : 'Quote Details'}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>
            {isHebrew ? 'נושא ההזמנה / ההצעה' : 'Order / Quote Subject'}
          </label>
          <input
            type="text"
            value={quoteSubject || ''}
            onChange={(e) => setQuoteSubject(e.target.value)}
            placeholder={isHebrew ? 'לדוגמה: אספקת רשתות ואלומניום לפרויקט' : 'e.g. Aluminum & Network Supply'}
            style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
          />
        </div>

        {/* חוק ברזל (§168 - Project/Section hierarchy, PROFLOW_TODO.md 30.C):
            שדה אופציונלי-לגמרי, ריק כברירת מחדל - "Project ו-Section חייבים
            להיות אופציונליים, לעולם לא מבנה כפוי". לקוח שלא צריך את זה
            פשוט לא ממלא, ההצעה נשמרת שטוחה בדיוק כמו היום. */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>
            {isHebrew ? 'שם פרויקט (לא חובה)' : 'Project name (optional)'}
          </label>
          <input
            type="text"
            value={projectName || ''}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={isHebrew ? 'לדוגמה: פרויקט חולון' : 'e.g. Holon Project'}
            style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
          />
        </div>
        </div>
        </div>

        {/* Cross-Surface Visual Consolidation / Create Quote §11: matches
            the established section-card pattern used by the Client/Quote
            Details and Currency/Status/Discount cards elsewhere in this
            form (16px radius, subtle shadow, NEON.bgCard) instead of this
            block's own older, shallower bgCardAlt sub-panel treatment -
            fully integrates Attachments into the same card system rather
            than a visually-lesser-tier box. Container-level only - upload/
            entitlement/file-list logic untouched. */}
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: '700', color: NEON.textSecondary, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
            <Paperclip size={13} color={NEON.violetLight} />
            {isHebrew ? 'קבצים מצורפים / שרטוטים (PRO בלבד)' : 'Attachments (PRO only)'}
          </label>

          {canUseAttachments && (
            <div style={{ fontSize: '0.75rem', color: NEON.textMuted, fontWeight: '600', marginBottom: '8px' }}>
              {isHebrew ? `נשארו לך ${remainingMb} מגה להעלאת קבצים` : `Remaining: ${remainingMb}MB`}
            </div>
          )}

          <button
            type="button"
            onClick={handleAttachmentClick}
            style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: '1px solid rgba(167, 139, 250, 0.4)', padding: '6px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', marginBottom: (quoteFiles || []).length > 0 ? '8px' : '0', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Paperclip size={13} strokeWidth={2.5} />
            {isHebrew ? 'צרף קובץ (עד 3MB)' : 'Attach File (Max 3MB)'}
          </button>

          {(quoteFiles || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {(quoteFiles || []).map((file, idx) => {
                const displayName = file.name || file.file_name || `File #${idx + 1}`;
                const rawBytes = file.size || file.file_size || 0;
                const displaySize = (rawBytes / (1024 * 1024)).toFixed(2);
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: NEON.bgInput, padding: '4px 8px', borderRadius: '6px', border: `1px solid ${NEON.borderStrong}`, fontSize: '0.8rem' }}>
                    <a href={file.file_url || '#'} target="_blank" rel="noopener noreferrer" style={{ color: NEON.violetLighter, textDecoration: 'underline' }}>
                      {displayName} ({displaySize} MB)
                    </a>
                    <button type="button" onClick={() => removeFile(idx)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center' }}><X size={12} strokeWidth={3} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cross-Surface Visual Consolidation / Create Quote §11: same
            card-system integration as the Attachments block above - see
            its comment for the full rationale. */}
        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '8px' }}>
            <MapPin size={13} color={NEON.red} />
            {isHebrew ? 'כתובת הלקוח' : 'Client Address Details'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'רחוב ומספר' : 'Street Address'} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה / מחוז' : 'State / Province'} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder={isHebrew ? 'מיקוד (ZIP)' : 'ZIP / Postal'} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.currency}</label>
            <select
              value={currency}
              disabled={true}
              style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgCardAlt, boxSizing: 'border-box', fontSize: '0.85rem', fontWeight: 'bold', color: NEON.violetLight, cursor: 'not-allowed' }}
            >
              <option value={currency}>{currency} ({sym})</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.status}</label>
            <select value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value)} style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', fontSize: '0.85rem' }}>
              <option value="Draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
              <option value="Sent">{isHebrew ? 'נשלח' : 'Sent'}</option>
              <option value="Approved">{isHebrew ? 'אושר' : 'Approved'}</option>
              <option value="Paid">{isHebrew ? 'שולם' : 'Paid'}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>
              {t.validUntil} <span style={{ color: NEON.violetLight, fontWeight: 'bold' }}>({dateFormatLabel})</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                value={getDisplayDate(validUntil)}
                onChange={handleDisplayDateChange}
                placeholder={dateFormatLabel}
                style={{ width: '100%', padding: '7px 32px 7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }}
              />
              <input
                type="date"
                ref={dateInputRef}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
                    dateInputRef.current.showPicker();
                  } else if (dateInputRef.current) {
                    dateInputRef.current.click();
                  }
                }}
                style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: NEON.textMuted, padding: 0, display: 'flex', alignItems: 'center' }}
                title="Open calendar"
              >
                <Calendar size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{t.discount}</label>
            <input type="text" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', boxSizing: 'border-box', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
        </div>
        </div>

        <div style={{ background: NEON.bgCard, border: `1px solid ${NEON.border}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
        {/* חוק ברזל (Two-Stage Completion Task, Stage 1D): תנאים+אחריות
            מקופלים כברירת מחדל - הערכים בפועל (terms/warranty) הם כבר
            snapshot אמיתי שהועתק מ-defaultTerms/defaultWarranty ברגע יצירת
            ההצעה (Dashboard.jsx, handleCreateNewQuoteClick) - זה כבר קיים
            ונכון ברמת ה-state/DB (quotes.terms/quotes.warranty, migration
            20260830000004). השינוי כאן הוא תצוגתי בלבד: לא לגלול טקסט גדול
            תמיד, אלא לקפל אותו כשהוא כבר == ברירת-המחדל, עם אפשרות מפורשת
            להתאמה + שחזור בטוח. אינו נוגע בשום migration/עמודה חדשה. */}
        <div style={{ marginBottom: '12px', border: `1px solid ${NEON.border}`, borderRadius: '10px', background: NEON.bgCardAlt, padding: '10px 12px' }}>
          {/* חוק ברזל (Stage 1B, נמצא חי - 320px English): "Terms & Warranty" +
              "Customize for this quote" לא נכנסו יחד בשורה אחת ב-320px
              (scrollWidth 78 מול clientWidth 65 על תווית הכותרת) - הפתרון
              הוא flexWrap:'wrap' (השורה השנייה נופלת לשורה משלה), לא
              הקטנת-טקסט/קיצוץ, כדי שהתווית המלאה תמיד תישאר קריאה. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', minWidth: 0 }}>
              <FileText size={14} strokeWidth={2.2} color={NEON.violetLight} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: NEON.textPrimary }}>{isHebrew ? 'תנאים ואחריות' : 'Terms & Warranty'}</span>
            </div>
            {!termsWarrantyExpanded && (
              <button type="button" onClick={() => setTermsWarrantyExpanded(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', color: NEON.violetLight, borderRadius: '999px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                <Pencil size={11} strokeWidth={2.5} />
                {isHebrew ? 'התאמה להצעה זו' : 'Customize for this quote'}
              </button>
            )}
          </div>
          {!termsWarrantyExpanded && (
            <div style={{ fontSize: '0.74rem', color: NEON.textSecondary, marginTop: '6px' }}>
              {isTermsWarrantyCustomized
                ? (isHebrew ? 'התנאים והאחריות הותאמו אישית עבור הצעה זו.' : 'Terms and warranty were customized for this quote.')
                : (isHebrew ? 'התנאים והאחריות נטענו אוטומטית מהגדרות העסק.' : 'Default terms and warranty were loaded from Business Settings.')}
            </div>
          )}
          {termsWarrantyExpanded && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{currency === 'ILS' ? 'תקנון ותנאים' : 'Terms & Conditions'}</label>
                <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows="3" style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: currency === 'ILS' ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
              </div>
              {/* חוק ברזל (Item 23 Warranty, TEST Acceptance Package 1): שדה נפרד
                  מ"תנאים כלליים" בכוונה - עמודת quote.warranty נפרדת לחלוטין
                  מ-quote.terms, לא הרחבה של אותו שדה. חסימת עריכה אחרי נעילת
                  הצעה מטופלת כבר בכל ה-QuoteForm הזה במעלה הזרימה (handleEditClick
                  ב-Dashboard.jsx מסרב לפתוח טופס עריכה כלל להצעה נעולה) ובאכיפה
                  נוספת ברמת ה-DB (guard_quote_immutability) - בדיוק כמו terms/notes
                  למעלה/למטה, בלי צורך ב-disabled ייעודי כאן. */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'אחריות' : 'Warranty'}</label>
                <textarea value={warranty} onChange={(e) => setWarranty(e.target.value)} rows="3" style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: currency === 'ILS' ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <button type="button" onClick={handleRestoreTermsWarrantyDefaults} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, borderRadius: '8px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer' }}>
                  <RotateCcw size={12} strokeWidth={2.4} />
                  {isHebrew ? 'שחזר ברירת מחדל מהגדרות העסק' : 'Restore Business Settings defaults'}
                </button>
                <button type="button" onClick={() => setTermsWarrantyExpanded(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', padding: '5px 4px' }}>
                  <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
                  {isHebrew ? 'כווץ' : 'Collapse'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: NEON.textSecondary, marginBottom: '3px' }}>{isHebrew ? 'הערות נוספות' : 'Additional Notes'}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" style={{ width: '100%', padding: '11px 14px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', lineHeight: '1.4' }} />
        </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: '0 0 10px', ...neonGlowTextStyle }}>{t.quoteItems}</h3>

        {/* חוק ברזל (Smart Quote Structure-First UX Correction task,
            Locked Decision 1/Part B): ההחלטה המבנית הראשונה - לפני כל
            פעולת-הוספה - היא "איך תרצו לבנות את ההצעה?", לא עוד קישור-
            אופציונלי אחרי שכבר אפשר להוסיף פריט. מוצג רק להצעה חדשה-
            ריקה-לגמרי שעדיין לא הוכרעה (quoteStructureMode===null) -
            הצעה קיימת (עריכה/שכפול) לעולם לא רואה את זה, ר' Dashboard.jsx
            inferStructureModeFromQuote (Decision 9). "Smart Quote" לא
            משמש כשם-הניגוד ל"הצעה רגילה" (Decision 1 - "the division
            choice is about structure, not intelligence"). */}
        {quoteStructureMode == null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: NEON.textPrimary, textAlign: isHebrew ? 'right' : 'left' }}>
              {isHebrew ? 'איך תרצו לבנות את ההצעה?' : 'How would you like to structure this quote?'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setQuoteStructureMode('regular')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isHebrew ? 'flex-end' : 'flex-start', gap: '6px', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.9rem', color: NEON.textPrimary }}>
                  <LayoutList size={16} color={NEON.violetLight} />
                  {isHebrew ? 'הצעה רגילה' : 'Regular quote'}
                </span>
                <span style={{ fontSize: '0.78rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
                  {isHebrew ? 'כל המוצרים והעבודות מופיעים ברשימה אחת.' : 'All products and work appear in one list.'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleSwitchToDivided}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isHebrew ? 'flex-end' : 'flex-start', gap: '6px', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgCardAlt, border: `1px solid ${NEON.violetLight}`, borderRadius: '12px', padding: '16px', cursor: 'pointer' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.9rem', color: NEON.textPrimary }}>
                  <Building2 size={16} color={NEON.violetLight} />
                  {isHebrew ? 'הצעה לפי חלוקה' : 'Quote by units'}
                </span>
                <span style={{ fontSize: '0.78rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
                  {isHebrew ? 'מתאים לדירות, חדרים, קומות, אזורים או יחידות נפרדות.' : 'Ideal for apartments, rooms, floors, areas, or separate work units.'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* חוק ברזל (Locked Decision 2 - "the regular path must remain
            fast"): כל מה שהיה קיים לפני המשימה הזו נשמר בייט-לבייט - כפתור
            הפעולה הראשי, המחשבון, האשף המפושט, ההמלצות מודעות-לעסק,
            ארבעת-השלבים, פרטי-לקוח אופציונליים, כל תיקוני-הבטיחות - שום
            UI לניהול-יחידות לא מוצג במצב הזה בכלל. */}
        {quoteStructureMode === 'regular' && (
          <>
            <button
              type="button"
              onClick={() => openAddWizard(null)}
              style={{ background: NEON.gradient, border: 'none', color: 'white', padding: '13px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', boxShadow: NEON.glow, marginBottom: '8px' }}
            >
              <Plus size={18} strokeWidth={3} />
              {isHebrew ? 'הוספת מוצר או עבודה' : 'Add product or work'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setIsCalcOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', padding: '2px 0' }}>
                <Calculator size={13} strokeWidth={2.2} />
                {isHebrew ? 'מחשבון' : 'Calculator'}
              </button>
              {/* חוק ברזל (Locked Decision 8 - "Regular -> Divided... the
                  user may discover later that a regular quote should have
                  been divided"): קישור-טקסט משני קבוע, לא רק בזמן-יצירה -
                  פריטים קיימים (section_key===null תמיד במצב Regular) נופלים
                  אוטומטית ל"לא משויך" הגלוי ברגע המעבר, בלי מוטציה כלל. */}
              <button type="button" onClick={handleSwitchToDivided} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', padding: '2px 0' }}>
                <Building2 size={13} strokeWidth={2.2} />
                {isHebrew ? 'מעבר להצעה לפי חלוקה' : 'Switch to a divided quote'}
              </button>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
              {isHebrew
                ? 'אפשר להוסיף מוצר או עבודה, לבחור מהקטלוג, או לתמחר לפי מידות - בלי צורך להכיר את המונחים הפנימיים.'
                : 'Add a product or work item, pick one from your catalog, or price it by measurements — no internal terminology required.'}
            </p>
          </>
        )}

        {/* חוק ברזל (Locked Decision 3/4/6 - "the system first allows
            creating the units"; "do not keep a visually-competing global
            Add button"; "every unit is a live working container"): במצב
            מחולק אין כפתור-הוספה גלובלי בכלל - כל פעולת-הוספה שייכת
            ליחידה ספציפית (או ל"לא משויך" הגלוי), ר' לוח-היחידות למטה. */}
        {quoteStructureMode === 'divided' && (
          <>
            <p style={{ margin: 0, fontSize: '0.78rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
              {isHebrew
                ? 'צרו את היחידות בהצעה, ואז הוסיפו לכל יחידה את המוצרים והעבודות שלה.'
                : 'Create the units in the quote, then add the relevant products and work to each one.'}
            </p>
            <button type="button" onClick={handleSwitchToRegular} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.76rem', fontWeight: '600', cursor: 'pointer', padding: '6px 0 0' }}>
              <LayoutList size={13} strokeWidth={2.2} />
              {isHebrew ? 'מעבר להצעה רגילה' : 'Switch to a regular quote'}
            </button>
          </>
        )}
        </div>

        {quoteStructureMode === 'regular' && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 14px', color: NEON.textSecondary, fontSize: '0.82rem', background: NEON.bgCardAlt, borderRadius: '10px', border: `1px dashed ${NEON.borderStrong}`, marginBottom: '10px' }}>
            {isHebrew ? 'עדיין לא נוספו מוצרים או עבודות להצעה זו.' : 'No products or work added to this quote yet.'}
          </div>
        )}

        {/* חוק ברזל (Smart Quote Guided UX Completion task, §C - Add/Edit
            unification, נשמר): כל פריט הוא כרטיס-סיכום קומפקטי - עריכה
            עוברת דרך AddItemWizard (editingItem), לא עוד שורה
            קלאסית+פאנל-מקצועי inline. renderItemCard משותף בין הרשימה
            השטוחה (Regular) לבין כל כרטיס-יחידה (Divided) - נקודת-רינדור
            יחידה לכל פריט, לא שני עותקים בלתי-תלויים. */}
        {quoteStructureMode === 'regular' && orderedItemIndices.map((index) => (
          <div key={index}>{renderItemCard(index)}</div>
        ))}

        {/* חוק ברזל (Part C/Locked Decision 4/5/7/10 - "the divided-quote
            unit board"): כל יחידה היא קונטיינר-עבודה חי וגלוי תמיד - שם,
            ספירת-פריטים, סכום-ביניים, מצב-ריק, פעולת-הוספה מפורשת - גם
            כשמכווץ. groupItemsBySection (professionalQuoteItem.js) הוא
            נקודת-הקיבוץ הקנונית; כאן נדרשים אינדקסים (לא אובייקטי-פריט,
            ר' unitItemIndices למעלה) כדי שפעולות עריכה/מחיקה/שכפול
            הקיימות ימשיכו לפעול ללא שינוי. */}
        {quoteStructureMode === 'divided' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {unitItemIndices.map(({ section, indices }) => (
              <UnitCard
                key={section.key}
                isHebrew={isHebrew}
                sym={sym}
                formatNum={formatNum}
                section={section}
                itemCount={indices.length}
                subtotal={computeUnitSubtotal(indices)}
                collapsed={collapsedUnitKeys.has(section.key)}
                onToggleCollapse={() => toggleUnitCollapsed(section.key)}
                onRename={(name) => renameSection(section.key, name)}
                onRemove={() => requestRemoveSection(section, indices.length)}
                onAddItem={() => openAddWizard(section.key)}
              >
                {indices.map((index) => (
                  <div key={index}>{renderItemCard(index)}</div>
                ))}
              </UnitCard>
            ))}

            {/* חוק ברזל (Locked Decision 8 - Regular->Divided): פריטים
                קיימים בלי יחידה (או ששיוכם הוסר, ר' requestRemoveSection)
                נופלים תמיד ל"לא משויך" הגלוי - לעולם לא נעלמים, לעולם לא
                מקבלים שם-יחידה מומצא. הכרטיס הזה מוצג רק כשיש בו תוכן. */}
            {unassignedIndices.length > 0 && (
              <UnitCard
                isHebrew={isHebrew}
                sym={sym}
                formatNum={formatNum}
                section={{ key: '__unassigned__', name: isHebrew ? 'לא משויך' : 'Unassigned' }}
                itemCount={unassignedIndices.length}
                subtotal={computeUnitSubtotal(unassignedIndices)}
                collapsed={collapsedUnitKeys.has('__unassigned__')}
                onToggleCollapse={() => toggleUnitCollapsed('__unassigned__')}
                isUnassigned
                onAddItem={() => openAddWizard(null)}
              >
                {unassignedIndices.map((index) => (
                  <div key={index}>{renderItemCard(index)}</div>
                ))}
              </UnitCard>
            )}

            <button type="button" onClick={addSection} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: `1px dashed ${NEON.borderStrong}`, color: NEON.violetLight, borderRadius: '10px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', minHeight: '44px' }}>
              <Plus size={15} strokeWidth={3} />
              {sections.length === 0
                ? (isHebrew ? 'הוספת היחידה הראשונה' : 'Add the first unit')
                : (isHebrew ? 'הוסף עוד יחידה' : 'Add another unit')}
            </button>
          </div>
        )}

        {/* חוק ברזל (Locked Decision 7 - "create / rename / remove unit
            safely"): הסרת יחידה לא-ריקה לעולם לא קורית ישירות מלחיצת-כפתור
            אחת - נדרש דיאלוג-בחירה בטוח ומפורש (ביטול / העברה ל"לא משויך" /
            העברה ליחידה קיימת אחרת). "No data loss" - removeSection עצמו
            (Dashboard.jsx) גם ככה לעולם לא מוחק פריטים, רק מאפס section_key -
            הדיאלוג הזה מוסיף את השקיפות/הבחירה שהייתה חסרה, לא בטיחות חדשה
            ברמת ה-state עצמו. */}
        {unitRemovalTarget && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }} dir={isHebrew ? 'rtl' : 'ltr'}>
            <div style={{ background: NEON.bgElevated, border: `1px solid ${NEON.border}`, padding: '22px', borderRadius: '14px', maxWidth: '380px', width: '90%', textAlign: isHebrew ? 'right' : 'left', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}>
              <h3 style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle, flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <AlertTriangle size={18} color={NEON.red} />
                {isHebrew ? `הסרת ${unitRemovalTarget.name}` : `Remove ${unitRemovalTarget.name}`}
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
                {isHebrew
                  ? `ליחידה זו יש ${unitRemovalTarget.itemCount} פריטים. הם לא יימחקו - לאן להעביר אותם?`
                  : `This unit has ${unitRemovalTarget.itemCount} item(s). They will not be deleted - where should they move?`}
              </p>
              <select
                aria-label={isHebrew ? 'העברת הפריטים אל' : 'Move items to'}
                value={unitRemovalDestination}
                onChange={(e) => setUnitRemovalDestination(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', marginBottom: '14px' }}
              >
                <option value="">{isHebrew ? 'לא משויך' : 'Unassigned'}</option>
                {sections.filter(s => s.key !== unitRemovalTarget.key).map(s => (
                  <option key={s.key} value={s.key}>{s.name || (isHebrew ? '(ללא שם)' : '(unnamed)')}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '8px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <button type="button" onClick={() => setUnitRemovalTarget(null)} style={{ flex: 1, background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, borderRadius: '8px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  {isHebrew ? 'ביטול' : 'Cancel'}
                </button>
                <button type="button" onClick={confirmRemoveSection} style={{ flex: 1, background: NEON.red, border: 'none', color: 'white', borderRadius: '8px', padding: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  {isHebrew ? 'הסר יחידה' : 'Remove unit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* חוק ברזל (Global Surface Audit + Money Alignment Fix, סבב זה):
            כל שורה הייתה div נפרד עם display:flex/justifyContent:space-between
            משלה - כל שורה הייתה "קונטיינר flex" עצמאי, כך שרוחב עמודת הסכום
            נקבע בנפרד לכל שורה (shrink-to-fit) ולא היה עמודה משותפת אחת -
            תחת RTL, הסכום (הילד השני, "end" פיזית = שמאל) היה נדבק לקצה
            השמאלי הקבוע של השורה שלו, כך שהקצה השמאלי (לא הימני, איפה
            שהספרות בפועל) היה המשותף - בדיוק ההפך ממה שנדרש ליישור לפי
            ערך-מקום (ראה .pf-money-row/.pf-money-cell למטה). הפתרון
            המבני: כל שורות הטוטלים הן עכשיו ילדים ישירים של גריד אחד
            משותף (grid-template-columns: 1fr auto) - כך שעמודת הסכום
            (auto) מחושבת פעם אחת עבור כל השורות יחד, לא בנפרד לכל שורה;
            כל תג <> (React Fragment) לא יוצר DOM node נפרד ולכן לא שובר
            את שיתוף העמודה. textAlign:'right' על כל תא-סכום (לא מותנה
            ב-isHebrew - סכום כספי תמיד מיושר לימין הפיזי, גם תחת LTR
            (שם flex-end כבר יישר נכון קודם, ולא נפגע כאן)). קו הפרדה לפני
            השורה הסופית הוא ילד-גריד נפרד שפורש שתי העמודות
            (gridColumn:'1 / -1') כדי שהקו יהיה רציף על פני כל הרוחב, לא
            שני קטעים נפרדים בכל תא. */}
        <div className="pf-money-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: '10px', borderTop: `2px solid ${NEON.border}`, marginTop: '12px', paddingTop: '8px' }}>
          {/* Local Private: אין שורת "סכום ביניים" נפרדת - היא כפולה ל-total
              (שניהם ה-ברוטו שהוזן/ה-total הסופי). מציגים ישירות את פירוט
              החשבונאות הרגיל: סכום לפני מע"מ / מע"מ / סה"כ, בדיוק כמו Business. */}
          {!(isLocalIsraeliBusiness && isHebrew && clientType === 'private') && (
            <>
              <span style={{ color: NEON.textSecondary, fontSize: '0.8rem' }}>{t.subtotal}</span>
              <span className="pf-money" style={{ color: NEON.textSecondary, fontSize: '0.8rem', textAlign: 'right' }}>{sym}{formatNum(subtotal)}</span>
            </>
          )}
          {discount > 0 && (
            <>
              <span style={{ color: NEON.red, fontSize: '0.8rem' }}>{isHebrew ? `הנחה (${discount}%):` : `Discount (${discount}%):`}</span>
              <span className="pf-money" style={{ color: NEON.red, fontSize: '0.8rem', textAlign: 'right' }}>-{sym}{formatNum(discountAmount)}</span>
            </>
          )}
          {isLocalIsraeliBusiness && isHebrew && clientType === 'private' ? (
            // תצוגה חשבונאית רגילה (Private): "סכום לפני מע"מ" / "מע"מ (18%)"
            // - אותם ערכים בדיוק כמו קודם (netAmount=total-taxAmount, taxAmount),
            // רק תוויות/סדר שונים; אין נוסחה חדשה. formatNumberLocal (לא
            // formatNum) כדי לא לאבד אגורות (254.24, לא 254.00).
            <>
              <span style={{ color: NEON.textSecondary, fontSize: '0.8rem' }}>סכום לפני מע"מ:</span>
              <span className="pf-money" style={{ color: NEON.textSecondary, fontSize: '0.8rem', textAlign: 'right' }}>{sym}{formatNumberLocal(totalAmount - taxAmount, isHebrew)}</span>
              <span style={{ color: NEON.textSecondary, fontSize: '0.8rem' }}>מע"מ (18%):</span>
              <span className="pf-money" style={{ color: NEON.textSecondary, fontSize: '0.8rem', textAlign: 'right' }}>{sym}{formatNumberLocal(taxAmount, isHebrew)}</span>
            </>
          ) : (
            isLocalIsraeliBusiness && isHebrew && (
              <>
                <span style={{ color: NEON.textSecondary, fontSize: '0.8rem' }}>{t.vat}</span>
                <span className="pf-money" style={{ color: NEON.textSecondary, fontSize: '0.8rem', textAlign: 'right' }}>{sym}{formatNum(taxAmount)}</span>
              </>
            )
          )}
          <div style={{ gridColumn: '1 / -1', marginTop: '6px' }} />
          <span style={{ ...neonGlowTextStyle, fontSize: '1rem', fontWeight: '800' }}>{t.totalAmount}</span>
          <span className="pf-money" style={{ color: NEON.violetLight, fontSize: '1rem', fontWeight: '800', textAlign: 'right' }}>{sym}{formatNum(totalAmount)}</span>
        </div>

        {/* חוק ברזל (Trial Expiration -> FREE, Full Entitlement Audit + Fix):
            הכפתור הזה היה חסום לגמרי (disabled) כש-isTrialExpired, ללא תלות
            ב-plan/effectivePlan בכלל - כלומר חוסם גם יצירת ההצעה הראשונה/
            ה-5 המותרות ל-FREE אחרי שניסיון פג, בסתירה מלאה לדרישת הבעלים
            "FREE limits", לא "אפס לצמיתות". הוסר בכוונה - האכיפה הנכונה
            כבר קיימת בשתי נקודות: מכסת 5/חודש נבדקת ב-handleSaveQuote
            (Dashboard.jsx, עם effectivePlan המתוקן), וזכאות עריכה/שכפול
            כבר נבדקת לפני שהטופס הזה נפתח בכלל (handleProtectedAction ב-
            QuotesTab.jsx, isBasicOrAbove/isPro). אין צורך בשער שלישי, כפול
            ולא-מתואם, כאן. */}
        <button type="submit" style={{ width: '100%', background: editingQuoteId ? NEON.emeraldDark : NEON.gradient, color: 'white', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', marginTop: '16px', boxShadow: editingQuoteId ? '0 4px 14px -2px rgba(16, 185, 129, 0.4)' : NEON.glow }}>
           {editingQuoteId ? t.updateQuote : t.generateSave}
        </button>
      </form>
    </div>
  );
}

// חוק ברזל (Owner Visual Review - Correction 4, "compact saved-item
// row/card"): הפריט הגדול ביותר שנדחה בסבב הקודם. שם + סיכום-חישוב תמציתי
// + סה"כ + תגיות אופציונליות (רק כשקיימות) + כפתור-הרחבה יחיד + תפריט-
// פעולות מאוחד אחד (לא כמה כפתורים נפרדים כמו קודם). התפריט מכיל רק
// פעולות נתמכות בפועל (Edit/Duplicate/Move section/Delete) - Delete
// מופרד ויזואלית (קו+צבע אדום) כפעולה ההרסנית היחידה, בדיוק כנדרש.
// אינו מכיל שום לוגיקת-עסק עצמאית - כל handler מועבר מלמעלה, מפעיל בדיוק
// את אותן פונקציות קיימות (duplicateItem/removeItem/handleItemChange).
function CompactItemCard({
  isHebrew, name, calcSummary, total, hasSpec, sectionName,
  onExpand, menuOpen, onToggleMenu, onEdit, onDuplicate, canDuplicate, duplicateLocked,
  sections, currentSectionKey, onMoveSection, onDelete, canDelete,
}) {
  const [movingSectionOpen, setMovingSectionOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  // חוק ברזל (Addendum - "menu partially clipped by the surrounding quote
  // container"): נבדק ונחשף חי - הכפתור ⋮ יושב קרוב לגבול-הימני של
  // .dash-main-content (הגלילה-הראשית, overflow:auto), והעיגון הישן
  // (position:absolute, left/right:0 יחסי-ל-parent) הרחיב את התפריט
  // 133px מעבר לגבול הזה, אל מתחת לסרגל-הצד - .dash-main-content קטע
  // אותו בשקט (overflow:auto, לא נגלל-אליו אף פעם כי הוא מעבר לתוכן
  // הרגיל). תיקון-שורש: לא רק להחליף left/right קשיח (זה עדיין ישבר
  // בכל רוחב/מיקום אחר) - למדוד בפועל את מיקום-הכפתור מול חלון-התצוגה
  // (לא מול ה-container) ולמקם את התפריט via portal (React.createPortal
  // ל-document.body, position:fixed) כך שאף אב עם overflow לא יכול
  // לקטוע אותו בכלל, עם זיהוי-התנגשות אמיתי (פינה שמתחלפת אם אין מקום).
  const [coords, setCoords] = useState(null); // {top, left, placeAbove}
  useLayoutEffect(() => {
    if (!menuOpen) { setCoords(null); return; }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const reposition = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuW = menuEl ? menuEl.offsetWidth : 190;
      const menuH = menuEl ? menuEl.offsetHeight : 160;
      const gap = 4;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // אנכי: ברירת-מחדל מתחת לכפתור; אם אין מקום - נפתח כלפי מעלה
      // ("open upward... when there is insufficient space").
      const fitsBelow = triggerRect.bottom + gap + menuH <= vh;
      const top = fitsBelow ? triggerRect.bottom + gap : Math.max(gap, triggerRect.top - gap - menuH);
      // אופקי: עוגן-מועדף תלוי-locale (ימין-ל-שמאל בעברית, מראה ב-
      // אנגלית) - אך תמיד נבדק מול חלון-התצוגה בפועל (לא ה-container
      // הפנימי) ומתהפך אם חורג. שני הכיוונים בודקים גם גלישה-שמאלה.
      let left = isHebrew ? triggerRect.right - menuW : triggerRect.left;
      if (left + menuW > vw - gap) left = vw - gap - menuW;
      if (left < gap) left = gap;
      setCoords({ top, left });
    };
    reposition();
    // חלון-שנשתנה-גודל/גלילה בזמן שהתפריט פתוח - ממקם מחדש, לא נשאר
    // "תקוע" במיקום-ישן שכבר לא תואם את מיקום הכפתור האמיתי.
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [menuOpen, movingSectionOpen, isHebrew]);

  // חוק ברזל (Addendum - "returning focus to the three-dot trigger"): כל
  // סגירה (Escape/click-outside/פעולה שנבחרה) חוזרת ל-focus על הכפתור
  // המפעיל עצמו - לא "נזרקת" לתחילת הדף. נבדק guard על wasOpen כדי
  // להימנע מ-focus מיותר ברינדור הראשוני (menuOpen מתחיל false).
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (menuOpen) { wasOpenRef.current = true; return; }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <div style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', color: NEON.textPrimary, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>{calcSummary}</span>
            {hasSpec && <CardBadge icon={<Paperclip size={10} />} label={isHebrew ? 'פרטים' : 'Details'} />}
            {sectionName && <CardBadge icon={<FolderInput size={10} />} label={sectionName} />}
          </div>
        </div>
        <div className="pf-money" style={{ fontWeight: '800', color: NEON.violet, fontSize: '0.88rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{total}</div>
        {/* חוק ברזל (Smart Quote Final UX Simplification task, Part L -
            "replace ambiguous chevrons with explicit visible edit
            affordance"): טקסט "עריכה"/"Edit" גלוי, לא רק חץ-כיוון ללא
            הסבר; יעד-מגע 44px לפחות (Part N - מובייל כמעמד ראשון). */}
        <button type="button" onClick={onExpand} aria-label={isHebrew ? 'עריכה' : 'Edit'} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', minWidth: '44px', minHeight: '44px', padding: '0 10px', justifyContent: 'center', cursor: 'pointer', color: NEON.textSecondary, flexShrink: 0, fontSize: '0.76rem', fontWeight: '600' }}>
          <Pencil size={13} />
          <span>{isHebrew ? 'עריכה' : 'Edit'}</span>
        </button>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button ref={triggerRef} type="button" onClick={onToggleMenu} aria-label={isHebrew ? 'פעולות נוספות' : 'More actions'} aria-haspopup="menu" aria-expanded={menuOpen} style={{ background: 'none', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: NEON.textSecondary }}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: coords ? `${coords.top}px` : '-9999px',
                left: coords ? `${coords.left}px` : '-9999px',
                visibility: coords ? 'visible' : 'hidden',
                background: NEON.bgCard, border: `1px solid ${NEON.border}`, borderRadius: '8px',
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.25)', minWidth: '190px', zIndex: 2000, overflow: 'hidden',
              }}
            >
              <MenuItem icon={<Pencil size={13} />} label={isHebrew ? 'ערוך' : 'Edit'} onClick={onEdit} />
              {canDuplicate && (
                <MenuItem
                  icon={duplicateLocked ? <Lock size={13} /> : <CopyPlus size={13} />}
                  label={isHebrew ? 'שכפל פריט' : 'Duplicate item'}
                  onClick={onDuplicate}
                />
              )}
              {sections && sections.length > 0 && (
                <MenuItem icon={<ListPlus size={13} />} label={isHebrew ? 'העבר ליחידה...' : 'Move to unit...'} onClick={() => setMovingSectionOpen((v) => !v)} />
              )}
              {movingSectionOpen && (
                <div style={{ padding: '4px 10px 8px' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    autoFocus
                    value={currentSectionKey}
                    onChange={(e) => { onMoveSection(e.target.value); setMovingSectionOpen(false); }}
                    style={{ width: '100%', padding: '5px 6px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.78rem' }}
                  >
                    <option value="">{isHebrew ? 'ללא יחידה' : 'No unit'}</option>
                    {sections.map((s) => <option key={s.key} value={s.key}>{s.name || (isHebrew ? '(ללא שם)' : '(unnamed)')}</option>)}
                  </select>
                </div>
              )}
              {canDelete && (
                <>
                  <div style={{ borderTop: `1px solid ${NEON.border}` }} />
                  <MenuItem icon={<Trash2 size={13} />} label={isHebrew ? 'מחק פריט' : 'Delete item'} onClick={onDelete} destructive />
                </>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}

// חוק ברזל (Smart Quote Structure-First UX Correction task, Locked
// Decision 4/5/10 - "every unit is a live working container"): כרטיס-
// יחידה יחיד, מוצג תמיד (גם מכווץ) עם שם/ספירת-פריטים/סכום-ביניים/מצב-
// ריק/פעולת-הוספה מפורשת - "the user must be able to scan all units and
// immediately identify a forgotten or empty unit" בלי צורך להרחיב אף
// כרטיס. isUnassigned: כרטיס "לא משויך" הגלוי (Decision 8) - שם קבוע,
// לא ניתן לשינוי-שם/הסרה (אין section אמיתית מאחוריו).
function UnitCard({
  isHebrew, sym, formatNum, section, itemCount, subtotal, collapsed,
  onToggleCollapse, onRename, onRemove, onAddItem, isUnassigned, children,
}) {
  const unitLabel = section.name || (isHebrew ? 'יחידה זו' : 'this unit');
  return (
    <div style={{ border: `1px solid ${isUnassigned ? NEON.borderStrong : NEON.violetLight}`, borderRadius: '12px', background: NEON.bgCardAlt, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 12px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
        <button type="button" onClick={onToggleCollapse} aria-label={collapsed ? (isHebrew ? 'הרחב יחידה' : 'Expand unit') : (isHebrew ? 'כווץ יחידה' : 'Collapse unit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: NEON.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', minHeight: '32px', flexShrink: 0 }}>
          <ChevronDown size={16} style={{ transform: collapsed ? (isHebrew ? 'rotate(90deg)' : 'rotate(-90deg)') : 'rotate(0deg)', transition: 'transform 0.15s' }} />
        </button>

        <Building2 size={15} color={NEON.violetLight} style={{ flexShrink: 0 }} />

        {isUnassigned ? (
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: NEON.textPrimary, flex: '1 1 140px' }}>{section.name}</span>
        ) : (
          <input
            type="text"
            value={section.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder={isHebrew ? 'לדוגמה: דירה 33, חדר שינה, בניין A' : 'e.g. Apartment 33, Bedroom, Building A'}
            style={{ flex: '1 1 140px', minWidth: '120px', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', fontWeight: 800, textAlign: isHebrew ? 'right' : 'left' }}
          />
        )}

        {/* חוק ברזל (Decision 4 - "even when collapsed, the user must be
            able to see at minimum: item count; unit subtotal; whether it
            is empty"): גלוי תמיד בשורת-הכותרת עצמה, לא רק במצב-מורחב. */}
        <span style={{ fontSize: '0.78rem', color: NEON.textSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {itemCount === 0
            ? (isHebrew ? 'עדיין לא נוספו פריטים' : 'No items added yet')
            : (isHebrew ? `${itemCount} פריטים` : `${itemCount} item${itemCount === 1 ? '' : 's'}`)}
        </span>

        {itemCount > 0 && (
          <span className="pf-money" style={{ fontSize: '0.85rem', fontWeight: 800, color: NEON.violet, whiteSpace: 'nowrap' }}>{sym}{formatNum(subtotal)}</span>
        )}

        {!isUnassigned && (
          <button type="button" onClick={onRemove} title={isHebrew ? 'הסר יחידה' : 'Remove unit'} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>

      {/* חוק ברזל (Locked Decision 6 - "the primary Add Item action
          belongs inside each unit"; Decision 4 - "clear Add Item action"
          visible even collapsed): כפתור-ההוספה נשאר גלוי גם כשמכווץ, לא רק
          בגוף-המורחב - הקשר-היחידה כבר ידוע (הצטרפות אוטומטית לאשף, ר'
          defaultSectionKey/wizardSectionKey ב-QuoteForm.jsx). */}
      <div style={{ padding: '0 12px 10px' }}>
        <button type="button" onClick={onAddItem} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: NEON.bgInput, border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, minHeight: '40px' }}>
          <Plus size={14} strokeWidth={3} />
          {isHebrew ? `הוסף מוצר או עבודה ל${unitLabel}` : `Add product or work to ${unitLabel}`}
        </button>
      </div>

      {!collapsed && itemCount > 0 && (
        <div style={{ borderTop: `1px solid ${NEON.borderStrong}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function CardBadge({ icon, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(139,92,246,0.10)', color: NEON.violetLight, borderRadius: '999px', padding: '2px 7px', fontSize: '0.68rem', fontWeight: '600' }}>
      {icon}{label}
    </span>
  );
}

function MenuItem({ icon, label, onClick, destructive }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: destructive ? NEON.red : NEON.textPrimary, textAlign: 'start' }}
    >
      {icon}{label}
    </button>
  );
}
