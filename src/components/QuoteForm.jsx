import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import DraggableCalculator from './DraggableCalculator';
import AddItemWizard from './AddItemWizard';
import { Calculator, Calendar, Paperclip, MapPin, X, AlertTriangle, Rocket, Ruler, Lock, Plus, CopyPlus, ChevronDown, MoreVertical, Pencil, Trash2, FolderInput, ListPlus, RotateCcw, FileText } from 'lucide-react';
import { LIGHT as NEON, FONT_HE, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { formatNumberLocal } from '../utils/regionConfig';
import { formatQuoteFallback } from '../utils/quoteNumber';
import { PROFESSIONAL_UNITS, getProfessionalUnitLabel, getActiveQuantity, isProfessionalItem, cmToM, mToCm, isMeasurableUnit, resolveCalculationMethod } from '../utils/professionalQuoteItem';

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
  sections, addSection, renameSection, removeSection,
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
  businessDefaultProfessionalUnit,
  duplicateItem,
  canUseProfessionalQuoteReuse,
  handleProfessionalUnitChange,
  addMeasurementRow,
  removeMeasurementRow,
  handleMeasurementChange,
  toggleManualQuantityOverride,
  handleManualQuantityChange,
  toggleMeasurementPricingDriving,
  addSpecificationRow,
  handleSpecificationChange,
  removeSpecificationRow,
  onOpenPricingModal,
  quoteFiles,
  setQuoteFiles,
  allUserAttachments
}) {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  // חוק ברזל (Two-Stage Completion Task, Stage 1B - תיקון-שורש, לא סימפטום):
  // נמצא חי (סריקת scrollWidth>clientWidth על כל האלמנטים ב-392px) ששורת
  // העריכה הקלאסית (Description/Qty/Price/Total) נשאה minWidth:'650px'
  // קשיח בתוך מכל overflow-x:auto - זה לא הזליג ל-document.documentElement.
  // scrollWidth (שנשאר תקין, 392===392), אבל יצר אזור-גלילה-אופקית פנימי
  // שמשתרע על כמעט כל רוחב המסך ("אפשר להחליק בהצעה כולה בצדדים" - בדיוק
  // תיאור הבעלים). התיקון האמיתי: באותם רוחבים, השורה הקלאסית (רק שורת-
  // הפתיחה הריקה + פריטים שהורחבו במפורש דרך "ערוך" - לא כרטיסי-הסיכום
  // הקומפקטיים, שכבר תמיד responsive) עוברת לפריסה מוערמת (label מעל שדה),
  // לא רוחב-קבוע+גלילה. אותה טכניקת matchMedia שכבר הוכיחה עצמה ב-
  // AddItemWizard.jsx/PublicQuoteHeader.jsx.
  const [isNarrowForm, setIsNarrowForm] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const recompute = () => setIsNarrowForm(window.matchMedia('(max-width: 640px)').matches);
    recompute();
    const mq = window.matchMedia('(max-width: 640px)');
    mq.addEventListener ? mq.addEventListener('change', recompute) : mq.addListener(recompute);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', recompute) : mq.removeListener(recompute);
    };
  }, []);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const dateInputRef = useRef(null);

  // חוק ברזל (Professional Quotes Stage C, §158): מצב UI-בלבד, לעולם לא
  // נשלח לשרת (לא חלק מ-items) - אינדקס→boolean, override ידני של ברירת-
  // המחדל "פתוח כשיש כבר נתונים מקצועיים" (isProItemExpanded למטה).
  const [expandedProItems, setExpandedProItems] = useState({});
  const isProItemExpanded = (index, item) => expandedProItems[index] ?? isProfessionalItem(item);
  const handleProfessionalToggleClick = (index, item) => {
    if (!canUseProfessionalQuotes && !isProfessionalItem(item)) {
      setShowUpgradeConfirm('professional');
      return;
    }
    const willExpand = !isProItemExpanded(index, item);
    // חוק ברזל (Business Professional Profile, Owner Night Run task, §160.4,
    // Gap #2): ברירת-מחדל, לא נעילה - כשפריט חדש (עדיין ללא pricing_unit) נפתח
    // לראשונה ולעסק יש professional_domain עם defaultUnit, הבורר קופץ ישירות
    // ליחידה המומלצת במקום ל-"ללא (פריט רגיל)" - חוסך לחיצה חוזרת-על-עצמה
    // לרוב הפריטים, אך המשתמש עדיין יכול לבחור יחידה אחרת/לחזור ל-Simple
    // באותו בורר הקיים, ללא הבדל. פריט שכבר יש לו pricing_unit (עריכה חוזרת)
    // אף פעם לא נדרס.
    if (willExpand && !item.pricing_unit && businessDefaultProfessionalUnit) {
      handleProfessionalUnitChange(index, businessDefaultProfessionalUnit);
    }
    setExpandedProItems(prev => ({ ...prev, [index]: willExpand }));
  };

  // חוק ברזל (Professional Quotes Stage C, §158, Visible-but-Locked, §155.1.11):
  // אותו מודל-שדרוג קיים בדיוק (לא מודל חדש - "do NOT build a large reusable
  // upgrade-modal architecture merely for Stage C") - הכללה ל-reason string
  // כדי לשרת גם attachments (PRO) וגם professionalQuotes Core (BASIC+),
  // שתי הודעות שונות דרך אותו JSX/state.
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(null); // null | 'attachments' | 'professional'
  const [errorMessage, setErrorMessage] = useState('');

  // חוק ברזל (Owner Visual Review - Correction 4, "compact saved-item card"):
  // מצב UI-בלבד נפרד לגמרי מ-expandedProItems למעלה (זה שולט על הפאנל
  // המקצועי הפנימי בלבד; זה כאן שולט על כל הכרטיס - קלט-שורה מלא מול
  // כרטיס-סיכום קומפקטי). ברירת המחדל היא "סגור/קומפקטי" לכל פריט - לא
  // "פתוח כשיש נתונים מקצועיים" כמו expandedProItems, כי הבעלים ביקש
  // במפורש שהמצב-הסגור יהיה ברירת-המחדל אחרי הוספה (§4: "do not leave
  // the user with the old permanently open spreadsheet-like editor").
  // חריג יחיד: שורת-הפתיחה הריקה (עדיין אין items אמיתיים) ממשיכה
  // להיות ערוכה ישירות בשורה, כמו תמיד - היא לא "פריט שמור" עדיין.
  const [itemCardOpen, setItemCardOpen] = useState({});
  const isBlankStarterRow = (item) => items.length === 1 && item.description === '' && item.unit_price === '';
  const isItemCardOpen = (index, item) => isBlankStarterRow(item) || (itemCardOpen[index] ?? false);
  // "רק פריט אחד מורחב בו-זמנית כשמעשי" (§4) - פתיחת פריט סוגרת את כל
  // השאר; סגירה פשוט מסירה את הדגל של האינדקס הזה.
  const toggleItemCard = (index) => {
    setItemCardOpen(prev => {
      const willOpen = !(prev[index] ?? false);
      return willOpen ? { [index]: true } : { ...prev, [index]: false };
    });
  };

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
  const openAddWizard = (sectionKey = null) => { setWizardSectionKey(sectionKey); setIsAddWizardOpen(true); };
  // חוק ברזל: אותו תנאי-בדיוק שכבר קיים ב-handleCatalogAdd/handleAddFromCatalog
  // (Dashboard.jsx) - הצעה חדשה מתחילה עם שורת-פתיחה ריקה אחת; אם זו עדיין
  // אותה שורה בלי תיאור/מחיר, האשף מחליף אותה במקום להשאיר שורה ריקה לצד
  // הפריט האמיתי הראשון.
  const handleWizardAdd = (newItem) => {
    if (items.length === 1 && items[0].description === '' && items[0].unit_price === '') {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
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
  const sectionKeySet = new Set(sections.map(s => s.key));
  const sortedSections = sections.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const orderedItemIndices = [
    ...sortedSections.flatMap(s => items.map((it, idx) => idx).filter(idx => items[idx].section_key === s.key)),
    ...items.map((it, idx) => idx).filter(idx => !items[idx].section_key || !sectionKeySet.has(items[idx].section_key)),
  ];

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
        onAdd={handleWizardAdd}
        isHebrew={isHebrew}
        sym={sym}
        formatNum={formatNum}
        services={services}
        sections={sections}
        defaultSectionKey={wizardSectionKey}
        canUseProfessionalQuotes={canUseProfessionalQuotes}
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

        <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0, ...neonGlowTextStyle }}>{t.quoteItems}</h3>
            <div style={{ display: 'flex', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsCalcOpen(true)}
                title={isHebrew ? 'מחשבון' : 'Calculator'}
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.4)',
                  padding: '5px 8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: NEON.violetLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Calculator size={16} strokeWidth={2.2} />
              </button>
              {/* חוק ברזל (Owner-Approved Smart Quote UX, Stage 2, §A):
                  מחליף את שני מנגנוני-ההוספה שהיו גלויים בו-זמנית (בורר
                  "הוספה מהירה" מהקטלוג + כפתור "הוסף פריט" ריק) בפעולה
                  דומיננטית אחת - האשף עצמו מציע גם קטלוג וגם יחידות/מדידה
                  כבחירה מודרכת בשלב 1, לא שלושה נתיבים מקבילים גלויים יחד.
                  addItem/handleCatalogAdd (הקיימים, Dashboard.jsx/למעלה)
                  אינם נמחקים - handleWizardAdd משתמש באותו תנאי-שורת-פתיחה
                  בדיוק, רק לא נקראים יותר משני כפתורים נפרדים כאן. */}
              <button type="button" onClick={() => openAddWizard(null)} style={{ background: NEON.gradient, border: 'none', color: 'white', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} strokeWidth={3} />
                {isHebrew ? 'הוסף פריט להצעה' : 'Add item to quote'}
              </button>
              {/* חוק ברזל (§168 - Project/Section hierarchy, PROFLOW_TODO.md
                  30.C): "+ Add Section" תמיד גלוי, לצד כפתורי-ההוספה
                  הקיימים - תוספת אופציונלית, לא מבנה כפוי. לחיצה יוצרת
                  section ריק (tempKey) מיד - השם עצמו נערך inline למטה. */}
              <button type="button" onClick={addSection} style={{ background: 'rgba(139, 92, 246, 0.10)', border: '1px solid rgba(139, 92, 246, 0.3)', color: NEON.violetLight, padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem' }}>
                {isHebrew ? '+ הוסף קטגוריה' : '+ Add Section'}
              </button>
            </div>
        </div>
        {/* חוק ברזל (Two-Stage Completion Task, Stage 1A - "one short,
            friendly helper sentence"): קומפקטי בכוונה - שורת-טקסט משנית
            אחת, לא כרטיס/באנר/פאנל-הדרכה, בלי שוליים אנכיים נוספים
            שיתפחו את הכותרת. עוטף באופן טבעי ב-320px (אין white-space:
            nowrap). */}
        <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: NEON.textSecondary, lineHeight: '1.4' }}>
          {isHebrew
            ? 'הוסיפו להצעה מוצרים או עבודות — אפשר להזין פריט רגיל, לחשב לפי מידות או לבחור מהקטלוג.'
            : 'Add products or work to this quote — enter a simple item, calculate it by measurements, or pick one from your catalog.'}
        </p>
        </div>

        {/* חוק ברזל (§168 - Project/Section hierarchy, 30.C): ניהול ה-
            sections עצמם - שם חופשי-לחלוטין (data המשתמש, לא מושג-אפליקציה
            קבוע), הסרה משאירה את הפריטים (רק מאפסת section_key שלהם). */}
        {sections.length > 0 && (
          <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sections.map(section => (
              <div key={section.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <input
                  type="text"
                  value={section.name}
                  onChange={(e) => renameSection(section.key, e.target.value)}
                  placeholder={isHebrew ? 'לדוגמה: דירה 33' : 'e.g. Apartment 33'}
                  style={{ flex: '0 1 220px', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.82rem', fontWeight: 700, textAlign: isHebrew ? 'right' : 'left' }}
                />
                <button type="button" onClick={() => openAddWizard(section.key)} style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}>
                  {isHebrew ? '+ פריט לקטגוריה זו' : '+ Item in this section'}
                </button>
                <button type="button" onClick={() => removeSection(section.key)} title={isHebrew ? 'הסר קטגוריה (הפריטים נשארים)' : 'Remove section (items are kept)'} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={13} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* חוק ברזל (Stage 1B): כותרת-העמודות המשותפת רלוונטית רק לפריסת-
            הרשת הקלאסית (Description|Qty|Price|Total באותה שורה) - בפריסה
            המוערמת (narrow) לכל שדה כבר יש תווית-inline משלו (ר' StackedRow
            למטה), אז כותרת נפרדת מיותרת ולא-responsive; מוסתרת לגמרי שם
            במקום להישאר כאלמנט 650px-רוחב-קשיח נוסף. */}
        {!isNarrowForm && (
          <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '5px' }}>
            <div style={{ minWidth: '650px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '4px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 'bold', color: NEON.textSecondary }}>
                <span>{t.description}</span>
                <span>{t.quantity}</span>
                <span>{t.unitPrice}</span>
                <span>{t.totalPrice}</span>
                {items.length > 1 && <span></span>}
              </div>
            </div>
          </div>
        )}

        {/* חוק ברזל (Professional Quotes Stage C, §158): כל פריט הוא כעת
            wrapper עצמאי - השורה הקלאסית (Description/Qty/Price/Total)
            שומרת בדיוק על אותו minWidth:650px+overflowX:auto לכל פריט
            בנפרד (זהה-ויזואלית להתנהגות הקודמת, ששיתפה scroll-container
            אחד לכל השורות יחד - עדיין 650px רוחב-מינימלי לכל שורה, בלי
            שינוי מוחשי). הלוח/פאנל המקצועי (כשמורחב) יושב מתחת, מחוץ
            למכל הגלילה-האופקית לגמרי - לא "טבלה רחבה הדורשת גלילה
            אופקית" (§17 בעלים), רק השדות הקלאסיים הקיימים ממשיכים
            להתנהג כפי שהתנהגו תמיד. */}
        {orderedItemIndices.map((index, renderPos) => {
          const item = items[index];
          const isPro = isProfessionalItem(item);
          const isMeasurable = isMeasurableUnit(item.pricing_unit);
          const isExpanded = isProItemExpanded(index, item);
          const activeQty = getActiveQuantity(item);
          // חוק ברזל (§168 - real calculation-method framework, 30.B/30.E):
          // נגזר תמיד מ-pricing_unit+quantity_source (לא נשמר UI-state
          // עצמאי) - 'linear' משתמש רק ברוחב (מוצג כ"אורך") ולא בגובה.
          const method = resolveCalculationMethod(item.pricing_unit, item.quantity_source);
          const isLinear = method === 'linear';
          const unitLabel = getProfessionalUnitLabel(item.pricing_unit, isHebrew);
          // חוק ברזל (§168 - Project/Section hierarchy, 30.C): כותרת-
          // section מוצגת רק במעבר אמיתי לתוך section (לא לכל פריט בתוכו) -
          // items.map() המקורי לא שונה בכלל, רק סדר-האיטרציה
          // (orderedItemIndices) והכותרת-האופציונלית-הזו נוספו סביבו.
          const currentSection = item.section_key && sectionKeySet.has(item.section_key) ? sortedSections.find(s => s.key === item.section_key) : null;
          const prevIndex = renderPos > 0 ? orderedItemIndices[renderPos - 1] : null;
          const prevItem = prevIndex != null ? items[prevIndex] : null;
          const prevSectionKey = prevItem && prevItem.section_key && sectionKeySet.has(prevItem.section_key) ? prevItem.section_key : null;
          const showSectionHeader = currentSection && currentSection.key !== prevSectionKey;
          const cardOpen = isItemCardOpen(index, item);
          const isBlankStarter = isBlankStarterRow(item);
          // חוק ברזל (Owner Visual Review - Correction 4, "concise calculation
          // summary"): נקודת-בנייה יחידה לטקסט-הסיכום הקומפקטי - נגזר מאותם
          // ערכים-קנוניים כבר-מחושבים למעלה (activeQty/method/unitLabel),
          // לא נוסחה עצמאית. פריט מקצועי-נמדד: "3.60 מ"ר × ₪300"; כל פריט
          // אחר (פשוט/יחידות/קטלוג): "5 × ₪50".
          const compactCalcSummary = isPro && isMeasurable
            ? `${formatNum(activeQty)} ${unitLabel} × ${sym}${formatNum(item.unit_price || 0)}`
            : `${formatNum(activeQty)} × ${sym}${formatNum(item.unit_price || 0)}`;
          const compactHasSpec = Array.isArray(item.specification) && item.specification.length > 0;
          return (
            <div key={index}>
            {showSectionHeader && (
              <div style={{ margin: '14px 0 6px', paddingTop: '10px', borderTop: `1px dashed ${NEON.borderStrong}`, fontSize: '0.85rem', fontWeight: 800, color: NEON.violetLight, textAlign: isHebrew ? 'right' : 'left' }}>
                {isHebrew ? `קטגוריה: ${currentSection.name}` : `Section: ${currentSection.name}`}
              </div>
            )}
            {/* חוק ברזל (Owner Visual Review - Correction 4, "compact
                saved-item card"): כרטיס-סיכום קומפקטי הוא ברירת-המחדל לכל
                פריט "שמור" (לא שורת-הפתיחה הריקה) - לא משכפל/מוחק את
                העורך-המלא הקיים (isBlankStarter ממשיך להתנהג בדיוק כמו
                קודם), רק עוטף אותו בבחירת-תצוגה. */}
            {!isBlankStarter && !cardOpen && (
              <CompactItemCard
                isHebrew={isHebrew}
                name={item.isFromCatalog || item.description ? item.description : (isHebrew ? '(ללא שם)' : '(unnamed)')}
                calcSummary={compactCalcSummary}
                total={`${sym}${formatNum(activeQty * Number(item.unit_price || 0))}`}
                hasSpec={compactHasSpec}
                // חוק ברזל (§4 - "optional indicators only when present",
                // באג אמיתי שנתפס חי בבדיקת-דפדפן): section.name יכול
                // להיות '' (ברירת-מחדל לפני שהמשתמש בפועל משנה אותו,
                // addSection) - מחרוזת ריקה היא falsy ב-JS, אז
                // currentSection?.name ישיר היה מדליק תג-badge ריק/נעלם
                // גם כשהפריט *כן* משויך ל-section אמיתית (currentSection
                // עצמו truthy). הבדיקה כאן היא על נוכחות ה-section, לא על
                // מחרוזת-השם שלה - עם אותה נפילה-חזרה בדיוק ("(ללא שם)"/
                // "(unnamed)") שכבר קיימת בבוררי ה-section האחרים למטה.
                sectionName={currentSection ? (currentSection.name || (isHebrew ? '(ללא שם)' : '(unnamed)')) : null}
                onExpand={() => toggleItemCard(index)}
                menuOpen={openActionsMenu === index}
                onToggleMenu={(e) => { e.stopPropagation(); setOpenActionsMenu(openActionsMenu === index ? null : index); }}
                onEdit={() => { setOpenActionsMenu(null); toggleItemCard(index); }}
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
            )}
            {(isBlankStarter || cardOpen) && (
            <div style={{ marginBottom: '6px' }}>
              {!isBlankStarter && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                  <button type="button" onClick={() => toggleItemCard(index)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: NEON.textSecondary, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: '4px' }}>
                    <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />
                    {isHebrew ? 'כווץ' : 'Collapse'}
                  </button>
                </div>
              )}
              {isNarrowForm ? (
                // חוק ברזל (Stage 1B, תיקון-שורש): פריסה מוערמת (label מעל
                // שדה, לא רשת-4-עמודות ברוחב-קבוע) - אותם handlers/ערכים
                // בדיוק כמו הפריסה הרחבה למטה, בלי minWidth/overflow-x
                // בכלל, כך שאין שום אזור-גלילה-אופקית-פנימי ליצור.
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: NEON.bgCardAlt, padding: '10px', borderRadius: isExpanded ? '8px 8px 0 0' : '8px', border: `1px solid ${NEON.border}`, borderBottom: isExpanded ? 'none' : `1px solid ${NEON.border}` }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: NEON.textMuted, marginBottom: '3px' }}>{t.description}</label>
                    <input
                      type="text"
                      placeholder={t.description}
                      value={item.description}
                      onChange={(e) => !item.isFromCatalog && handleItemChange(index, 'description', e.target.value)}
                      readOnly={item.isFromCatalog}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', fontSize: '16px', background: item.isFromCatalog ? NEON.bgCardAlt : NEON.bgInput, color: NEON.textPrimary, cursor: item.isFromCatalog ? 'not-allowed' : 'text' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: NEON.textMuted, marginBottom: '3px' }}>{t.quantity}</label>
                      {isPro ? (
                        <div
                          title={isHebrew ? 'כמות זו מחושבת מהפאנל המקצועי (מידות/כמות ידנית) למטה - ולא ניתנת לעריכה כאן' : 'This quantity is calculated from the professional panel below (measurements / manual quantity) — not editable here'}
                          style={{ padding: '9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgCardAlt, color: NEON.textSecondary, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help' }}
                        >
                          <span>{formatNum(activeQty)}</span>
                          <span style={{ fontSize: '0.65rem', color: NEON.violetLight, fontWeight: 600 }}>{isHebrew ? '(מחושב)' : '(calc.)'}</span>
                        </div>
                      ) : (
                        <input type="number" step="any" placeholder={t.quantity} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px' }} />
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: NEON.textMuted, marginBottom: '3px' }}>{t.unitPrice}</label>
                      <input type="number" step="any" placeholder={t.unitPrice} value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', padding: '9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: NEON.textMuted, marginBottom: '3px' }}>{t.totalPrice}</label>
                      <div className="pf-money" style={{ padding: '9px', background: NEON.bgInput, border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', color: NEON.textPrimary, textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontWeight: 700 }}>{sym}{formatNum(activeQty * Number(item.unit_price || 0))}</div>
                    </div>
                    {items.length > 1 && <button type="button" onClick={() => removeItem(index)} aria-label={isHebrew ? 'מחק פריט' : 'Delete item'} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} strokeWidth={3} /></button>}
                  </div>
                </div>
              ) : (
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: '650px', display: 'grid', gridTemplateColumns: items.length > 1 ? '2fr 1fr 1fr 1fr 36px' : '2fr 1fr 1fr 1fr', gap: '6px', background: NEON.bgCardAlt, padding: '6px', borderRadius: isExpanded ? '8px 8px 0 0' : '8px', border: `1px solid ${NEON.border}`, borderBottom: isExpanded ? 'none' : `1px solid ${NEON.border}` }}>
                  <input
                    type="text"
                    placeholder={t.description}
                    value={item.description}
                    onChange={(e) => !item.isFromCatalog && handleItemChange(index, 'description', e.target.value)}
                    readOnly={item.isFromCatalog}
                    required
                    style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', fontSize: '0.8rem', background: item.isFromCatalog ? NEON.bgCardAlt : NEON.bgInput, color: NEON.textPrimary, cursor: item.isFromCatalog ? 'not-allowed' : 'text' }}
                  />
                  {/* חוק ברזל (§7 - Quantity disconnect fix, Owner-required): לפריט
                      מקצועי, ה"כמות" הגלויה כאן היא activeQty (זהה-בייט לכמות
                      שהכסף משתמש בה, getActiveQuantity) - לא עוד item.quantity
                      הגולמי (שנשאר "1" בלי-נגיעה, לעולם לא edited/repurposed -
                      איסור מפורש). השדה מוצג read-only עם רמז ויזואלי (רקע מנוגד
                      + title) שהערך מגיע מהפאנל המקצועי למטה; פריט Simple ממשיך
                      להיות שדה חופשי לגמרי, בלי שינוי. */}
                  {isPro ? (
                    <div
                      title={isHebrew ? 'כמות זו מחושבת מהפאנל המקצועי (מידות/כמות ידנית) למטה - ולא ניתנת לעריכה כאן' : 'This quantity is calculated from the professional panel below (measurements / manual quantity) — not editable here'}
                      style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgCardAlt, color: NEON.textSecondary, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help' }}
                    >
                      <span>{formatNum(activeQty)}</span>
                      <span style={{ fontSize: '0.65rem', color: NEON.violetLight, fontWeight: 600 }}>{isHebrew ? '(מחושב)' : '(calc.)'}</span>
                    </div>
                  ) : (
                    <input type="number" step="any" placeholder={t.quantity} value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                  )}
                  <input type="number" step="any" placeholder={t.unitPrice} value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} required style={{ padding: '7px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                  {/* חוק ברזל (Money Alignment Fix, סבב קודם): יישור-ימין תמיד,
                      בלי קשר לשפה. חוק ברזל (Professional Quotes Stage C):
                      הסכום משתמש בכמות הפעילה (getActiveQuantity) - זהה-בייט
                      ל-item.quantity הרגיל עבור פריט Simple, ומחליף אותו
                      ל-calculated_quantity עבור פריט מקצועי. */}
                  <div className="pf-money" style={{ padding: '7px', background: NEON.bgInput, border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', color: NEON.textPrimary, textAlign: 'right', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{sym}{formatNum(activeQty * Number(item.unit_price || 0))}</div>
                  {items.length > 1 && <button type="button" onClick={() => removeItem(index)} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={3} /></button>}
                </div>
              </div>
              )}

              {/* חוק ברזל (§2/§4 בעלים - Progressive Disclosure): קישור-פתיחה
                  זמין תמיד לכל פריט (לא מסתתר, "Visible-but-Locked" §155.1.11) -
                  משתמש לא-זכאי שעדיין אין לו נתונים מקצועיים רואה 🔒 ומקבל
                  את מודל-השדרוג בלחיצה מכוונת; לעולם לא popup אוטומטי. */}
              <div style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: isExpanded ? '10px' : '6px 8px' }}>
                {/* חוק ברזל (Professional Trigger Discoverability Fix, Owner Night
                    Run task, PROFLOW_PROJECT_CONTEXT.md §160.2 - Gap #1): הבעלים
                    דיווח שהקישור הקודם (טקסט שקוף, ללא רקע/מסגרת, צבע textMuted
                    "חלש") נראה כמו טקסט משני/מבוטל - כמעט ופוספס לגמרי. עכשיו
                    כפתור-pill מובחן (רקע+מסגרת בגוון סגול-בהיר, כמו badge/chip
                    קיימים אחרים במוצר) - נראה בבירור לחיץ, אך במכוון *לא* גרדיאנט
                    מלא כמו כפתור-הפעולה-הראשי (Save Quote) כדי לא "לצעוק" יותר
                    ממנו. מצב-פתוח/סגור ניכר משתיים: עוצמת-הרקע גבוהה יותר כשפתוח,
                    וטקסט "הסתר"/"הוסף" משתנה (כפי שכבר היה). לא תלוי בצבע בלבד -
                    האייקון (Ruler, קשור-מידה) קבוע בשתי המצבים, המנעול (Lock)
                    מתווסף רק כשלא-זכאי, זהה להתנהגות הקודמת. */}
                <button
                  type="button"
                  onClick={() => handleProfessionalToggleClick(index, item)}
                  style={{
                    background: isExpanded ? 'rgba(139, 92, 246, 0.20)' : 'rgba(139, 92, 246, 0.10)',
                    border: `1px solid ${isExpanded ? 'rgba(139, 92, 246, 0.45)' : 'rgba(139, 92, 246, 0.25)'}`,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: NEON.violetLight,
                    flexDirection: isHebrew ? 'row-reverse' : 'row',
                  }}
                >
                  {!canUseProfessionalQuotes && !isPro && <Lock size={12} strokeWidth={2.5} />}
                  <Ruler size={14} strokeWidth={2.4} />
                  {isExpanded
                    ? (isHebrew ? 'הסתר מידות / פירוט מקצועי' : 'Hide measurements / professional details')
                    : (isHebrew ? 'הוסף מידות / פירוט מקצועי' : 'Add measurements / professional details')}
                </button>

                {/* חוק ברזל (Professional Quotes Stage F - Advanced Reuse,
                    PROFLOW_PROJECT_CONTEXT.md §155.18 שורה F/§165): מוצג רק
                    לפריט שכבר מקצועי (isPro) - "שכפול" נתונים שעדיין לא קיימים
                    חסר-משמעות. Visible-but-Locked (§155.14): הכפתור עצמו תמיד
                    גלוי ל-BASIC (לא נעלם), אך לחיצה בלי professionalQuoteReuse
                    (PRO+) פותחת את אותו מודל-שדרוג הקיים כבר (ר' showUpgradeConfirm
                    למעלה, כל ערך שאינו 'professional' מקבל את הודעת-PRO הגנרית
                    הקיימת). professionalQuotes (Core) ≠ professionalQuoteReuse
                    (Advanced) - שני capabilities נפרדים, לא flag אחד. */}
                {isPro && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canUseProfessionalQuoteReuse) {
                        setShowUpgradeConfirm('reuse');
                        return;
                      }
                      duplicateItem(index);
                    }}
                    title={isHebrew ? 'שכפל פריט מקצועי זה' : 'Duplicate this professional item'}
                    style={{
                      background: NEON.bgCardAlt,
                      border: `1px solid ${NEON.borderStrong}`,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: NEON.textSecondary,
                      marginInlineStart: '6px',
                      flexDirection: isHebrew ? 'row-reverse' : 'row',
                    }}
                  >
                    {!canUseProfessionalQuoteReuse && <Lock size={11} strokeWidth={2.5} />}
                    <CopyPlus size={13} strokeWidth={2.2} />
                    {isHebrew ? 'שכפל פריט' : 'Duplicate item'}
                  </button>
                )}

                {isExpanded && (
                  <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: `1px dashed ${NEON.border}` }} dir={isHebrew ? 'rtl' : 'ltr'}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: NEON.textSecondary, marginBottom: '3px' }}>
                        {isHebrew ? 'יחידת תמחור מקצועית' : 'Professional pricing unit'}
                      </label>
                      <select
                        value={item.pricing_unit || ''}
                        onChange={(e) => handleProfessionalUnitChange(index, e.target.value)}
                        disabled={!canUseProfessionalQuotes}
                        style={{ padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', minWidth: '180px' }}
                      >
                        <option value="">{isHebrew ? 'ללא (פריט רגיל)' : 'None (Simple item)'}</option>
                        {PROFESSIONAL_UNITS.map(u => <option key={u.id} value={u.id}>{isHebrew ? u.he : u.en}</option>)}
                      </select>
                    </div>

                    {/* חוק ברזל (§168 - Project/Section hierarchy, 30.C):
                        שיוך-section ברמת-פריט, אופציונלי - "ללא קטגוריה"
                        (unsectioned) הוא הערך המקורי/ברירת המחדל, זהה-בייט
                        לפריט שטוח קיים. מוצג רק כשקיימת לפחות section אחת -
                        אין טעם להציג בורר ריק להצעה בלי sections כלל. */}
                    {sections.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: NEON.textSecondary, marginBottom: '3px' }}>
                          {isHebrew ? 'קטגוריה' : 'Section'}
                        </label>
                        <select
                          value={item.section_key || ''}
                          onChange={(e) => handleItemChange(index, 'section_key', e.target.value || null)}
                          style={{ padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', minWidth: '180px' }}
                        >
                          <option value="">{isHebrew ? 'ללא קטגוריה' : 'No section'}</option>
                          {sections.map(s => <option key={s.key} value={s.key}>{s.name || (isHebrew ? '(ללא שם)' : '(unnamed)')}</option>)}
                        </select>
                      </div>
                    )}

                    {isMeasurable && (
                      item.quantity_source === 'manual' ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: NEON.textSecondary }}>
                              {isHebrew ? `כמות ידנית (${unitLabel})` : `Manual quantity (${unitLabel})`}
                            </label>
                            <button type="button" onClick={() => toggleManualQuantityOverride(index)} disabled={!canUseProfessionalQuotes} style={{ background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                              {isHebrew ? 'חזרה לחישוב לפי מידות' : 'Back to calculated from measurements'}
                            </button>
                          </div>
                          <input type="number" step="any" value={item.calculated_quantity} onChange={(e) => handleManualQuantityChange(index, e.target.value)} disabled={!canUseProfessionalQuotes} style={{ padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', width: '140px' }} />
                        </div>
                      ) : (
                        <div>
                          {(item.measurements || []).map((m, mIdx) => (
                            <div key={mIdx} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px', alignItems: 'flex-end' }}>
                              {/* חוק ברזל (Dimension Input — cm entry, Owner-required):
                                  קלט/תצוגה בס"מ בלבד, גבול-UI טהור - m.width/m.height
                                  עצמם (state/persistence/quote_item_measurements) נשארים
                                  במטרים ללא שינוי כלל (mToCm/cmToM, professionalQuoteItem.js,
                                  לא נוגעים ב-DB/בחישוב-השטח הקיים). זה בדיוק "הגבול הנכון
                                  ביישום", לא שכתוב-סכימה. */}
                              <div style={{ flex: '1 1 90px' }}>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: NEON.textMuted, marginBottom: '2px' }}>{isLinear ? (isHebrew ? 'אורך (ס"מ)' : 'Length (cm)') : (isHebrew ? 'רוחב (ס"מ)' : 'Width (cm)')}</label>
                                <input type="number" step="any" min="0" value={mToCm(m.width)} onChange={(e) => handleMeasurementChange(index, mIdx, 'width', e.target.value === '' ? '' : cmToM(e.target.value))} disabled={!canUseProfessionalQuotes} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                              </div>
                              {/* חוק ברזל (§168 - real calculation-method framework):
                                  Height מוסתר לגמרי עבור method='linear' - אין
                                  "גובה" רלוונטי לאורך יחיד (מטר רץ), לא רק
                                  ערך-לא-בשימוש שנשאר גלוי ומבלבל. */}
                              {!isLinear && (
                                <div style={{ flex: '1 1 90px' }}>
                                  <label style={{ display: 'block', fontSize: '0.68rem', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'גובה (ס"מ)' : 'Height (cm)'}</label>
                                  <input type="number" step="any" min="0" value={mToCm(m.height)} onChange={(e) => handleMeasurementChange(index, mIdx, 'height', e.target.value === '' ? '' : cmToM(e.target.value))} disabled={!canUseProfessionalQuotes} style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem' }} />
                                </div>
                              )}
                              <div style={{ flex: '1 1 90px' }}>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: NEON.textMuted, marginBottom: '2px' }}>{isLinear ? (isHebrew ? 'אורך' : 'Length') : (isHebrew ? 'שטח' : 'Area')}</label>
                                <div style={{ padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgCardAlt, color: NEON.textSecondary, fontSize: '0.8rem' }}>
                                  {m.calculated_area != null ? `${formatNum(m.calculated_area)} ${isLinear ? (isHebrew ? 'מ\'' : 'm') : 'm²'}` : '—'}
                                </div>
                              </div>
                              {/* חוק ברזל (§168 - specification-vs-pricing-driving,
                                  30.E "Pricing Unit ≠ Specification Data"): מוצג
                                  ללקוח תמיד (Public Quote), אך שורה עם is_pricing_
                                  driving===false לעולם לא נספרת ב-calculated_quantity -
                                  הנתון עצמו (width/height) לעולם לא נמחק. */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: '0 0 auto' }}>
                                <label style={{ fontSize: '0.62rem', color: NEON.textMuted, whiteSpace: 'nowrap' }}>{isHebrew ? 'משפיע על מחיר' : 'Affects price'}</label>
                                <input
                                  type="checkbox"
                                  checked={m.is_pricing_driving !== false}
                                  onChange={() => toggleMeasurementPricingDriving(index, mIdx)}
                                  disabled={!canUseProfessionalQuotes}
                                  title={isHebrew ? 'בטל כדי להציג מידה זו ללקוח בלי שתשפיע על הכמות/המחיר' : 'Uncheck to show this measurement to the customer without it affecting quantity/price'}
                                />
                              </div>
                              {(item.measurements.length > 1) && (
                                <button type="button" onClick={() => removeMeasurementRow(index, mIdx)} disabled={!canUseProfessionalQuotes} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <X size={13} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          ))}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                            <button type="button" onClick={() => addMeasurementRow(index)} disabled={!canUseProfessionalQuotes} style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Plus size={12} strokeWidth={2.5} />
                              {isHebrew ? 'הוסף מידה' : 'Add measurement'}
                            </button>
                            <button type="button" onClick={() => toggleManualQuantityOverride(index)} disabled={!canUseProfessionalQuotes} style={{ background: 'none', border: 'none', color: NEON.violetLight, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                              {isHebrew ? 'הזן כמות ידנית' : 'Enter manual quantity'}
                            </button>
                            <span style={{ fontSize: '0.75rem', color: NEON.textSecondary, fontWeight: 600 }}>
                              {isHebrew ? 'כמות מחושבת: ' : 'Calculated quantity: '}{formatNum(activeQty)} {unitLabel}
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {item.pricing_unit && !isMeasurable && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: NEON.textSecondary, marginBottom: '3px' }}>
                          {isHebrew ? `כמות (${getProfessionalUnitLabel(item.pricing_unit, isHebrew)})` : `Quantity (${getProfessionalUnitLabel(item.pricing_unit, isHebrew)})`}
                        </label>
                        <input type="number" step="any" value={item.calculated_quantity} onChange={(e) => handleManualQuantityChange(index, e.target.value)} disabled={!canUseProfessionalQuotes} style={{ padding: '6px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.8rem', width: '140px' }} />
                      </div>
                    )}

                    {/* חוק ברזל (§168 - specification-only data, 30.E
                        "Pricing Unit ≠ Specification Data"): רשימת {תווית,ערך}
                        חופשית-לגמרי - התוויות הן נתון-משתמש (color/profile/
                        glass/וכו', לעולם לא רשימת-שדות קבועה של האפליקציה).
                        מוצג ללקוח (Public Quote) אך לעולם לא משפיע על
                        calculated_quantity/total_price. */}
                    {item.pricing_unit && (
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px dashed ${NEON.border}` }}>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: NEON.textSecondary, marginBottom: '4px' }}>
                          {isHebrew ? 'מפרט טכני (לתצוגה בלבד, לא משפיע על המחיר)' : 'Technical specification (display only, never affects price)'}
                        </label>
                        {(item.specification || []).map((spec, sIdx) => (
                          <div key={sIdx} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'center' }}>
                            <input type="text" value={spec.label} onChange={(e) => handleSpecificationChange(index, sIdx, 'label', e.target.value)} placeholder={isHebrew ? 'לדוגמה: צבע' : 'e.g. Color'} disabled={!canUseProfessionalQuotes} style={{ flex: '1 1 110px', padding: '5px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.78rem' }} />
                            <input type="text" value={spec.value} onChange={(e) => handleSpecificationChange(index, sIdx, 'value', e.target.value)} placeholder={isHebrew ? 'לדוגמה: לבן' : 'e.g. White'} disabled={!canUseProfessionalQuotes} style={{ flex: '1 1 140px', padding: '5px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.78rem' }} />
                            <button type="button" onClick={() => removeSpecificationRow(index, sIdx)} disabled={!canUseProfessionalQuotes} style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: NEON.red, width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <X size={12} strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addSpecificationRow(index)} disabled={!canUseProfessionalQuotes} style={{ background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, color: NEON.textPrimary, padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Plus size={12} strokeWidth={2.5} />
                          {isHebrew ? 'הוסף שדה מפרט' : 'Add specification field'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
            </div>
          );
        })}

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
        <button type="button" onClick={onExpand} aria-label={isHebrew ? 'הרחב/ערוך פריט' : 'Expand/edit item'} style={{ background: 'none', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: NEON.textSecondary, flexShrink: 0 }}>
          <ChevronDown size={15} />
        </button>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button ref={triggerRef} type="button" onClick={onToggleMenu} aria-label={isHebrew ? 'פעולות נוספות' : 'More actions'} aria-haspopup="menu" aria-expanded={menuOpen} style={{ background: 'none', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: NEON.textSecondary }}>
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
                <MenuItem icon={<ListPlus size={13} />} label={isHebrew ? 'העבר לקטגוריה...' : 'Move to section...'} onClick={() => setMovingSectionOpen((v) => !v)} />
              )}
              {movingSectionOpen && (
                <div style={{ padding: '4px 10px 8px' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    autoFocus
                    value={currentSectionKey}
                    onChange={(e) => { onMoveSection(e.target.value); setMovingSectionOpen(false); }}
                    style={{ width: '100%', padding: '5px 6px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.78rem' }}
                  >
                    <option value="">{isHebrew ? 'ללא קטגוריה' : 'No section'}</option>
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
