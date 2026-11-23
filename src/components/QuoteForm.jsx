import { Fragment, useState, useEffect, useRef } from 'react';
import { phonePlaceholder } from '../utils/phoneDisplay';
import { businessDial, joinPhone } from '../utils/phoneDial';
import AddItemWizard from './AddItemWizard';
import QuoteTreeEditor from './quoteTree/QuoteTreeEditor';
import { structureOf } from './quoteTree/treeModel';
import { HelpCircle } from './quoteTree/QuoteTreeEditor';
import { Paperclip, X, AlertTriangle, ChevronDown, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import EllipsisText from './EllipsisText';
import CustomerTwinIcon from './CustomerTwinIcon';
import { APP as NEON, FONT_HE } from '../theme/neonTheme';
import QuotePresentationPanel from './quotePresentation/QuotePresentationPanel';
import { formatMoneyForCurrency } from '../utils/money';
import { formatQuoteFallback } from '../utils/quoteNumber';
import { isProfessionalItem } from '../utils/professionalQuoteItem';
import { computeItemWizardState } from '../utils/quoteWorkflowContext';
import { isUntouchedPlaceholderItem } from '../utils/structuredQuoteItemPersistence';
import { isUnfinishedQuoteForm } from '../utils/quoteCompleteness';
import { isQuoteAcceptanceExpired } from '../utils/quoteValidity';
import { publishBlocker, resolveBlockers } from '../utils/aiHelpBlockers';
import AiHelpButton from './AiHelpButton';
import CapabilityUpgradeNotice from './subscriptions/CapabilityUpgradeNotice';
import ServiceScheduleFields from './ServiceScheduleFields';
import { SketchIcon } from './SketchIcons';
import AddressSuggestInput from './AddressSuggestInput';
import { askConfirm } from './AppDialog';

// OD-17: which capability each locked action of the form explains (the one CapabilityUpgradeNotice)
const UPGRADE_CAPABILITY = Object.freeze({ professional: 'professional_quote.use', reuse: 'professional_quote.reuse', attachments: 'quote_attachment.upload',
  smart_pack: 'smart_pack' });

// AI HELP V4 §5: the browser's own required-field validation is the owner of these blockers; the product marks each required
// control with data-help-field (never DOM text scraping) and the blocker resolves as soon as the field is filled.
const INVALID_FIELD_BLOCKER = { client_name: 'QUOTE_MISSING_CLIENT', client_type: 'QUOTE_MISSING_CLIENT_TYPE' };
// Codex review 2026-11-09: a business client's Tax ID made of spaces only is missing too - the same message; the browser checks a pattern
// only on a non-empty value, so an empty field still meets "required" first
const TAX_ID_NOT_BLANK = String.raw`.*\S.*`;

// SMART-QUOTE first-use flow: a numbered step label (1 who / 2 what / 3 price / 4 review & save).
function StepHeading({ n, title, hint }) {
  return (
    <div className="sq-step qe-step" data-testid={`sq-step-${n}`}>
      <i aria-hidden="true">{n}</i>
      <div>
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
    </div>
  );
}

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
  onBack = null, // Owner 2026-10-25 (typed L-09 / L-15): the same step as the phone Back - the draft stays on this device
  // Owner night task 2026-10-22 (typed approval, adding the entry button only): opens Customer Twin ("בדיקת הלקוח") for the open draft
  onOpenCustomerTwin = null,
  clientName, setClientName,
  clientEmail, setClientEmail,
  clientPhone, setClientPhone,
  businessPhone = null, // Owner 2026-10-25: the business's saved phone (its chosen country code)
  clientType, setClientType,
  clientTaxId, setClientTaxId,
  clientAddress, setClientAddress,
  quoteSubject, setQuoteSubject,
  attnName, setAttnName,
  attnRole, setAttnRole,
  currency,
  quoteStatus, setQuoteStatus,
  validUntil, setValidUntil,
  serviceSchedule = null, setServiceSchedule = null, serviceScheduleState = 'ready',
  onSaveClientNow = null,
  // Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): save one unit as a unit template / add one unit from a saved unit template
  onSaveUnitTemplate = null,
  onAddUnitFromTemplate = null,
  discount, setDiscount,
  terms, setTerms,
  warranty, setWarranty,
  defaultTerms,
  defaultWarranty,
  notes, setNotes,
  items, setItems,
  sections, setSections,
  quoteStructureMode, setQuoteStructureMode,
  projectName, setProjectName,
  services,
  clients,
  isHebrew,
  isLocalIsraeliBusiness,
  // 2026-11-12 (unified quote): 'client' = the first step only; 'editor' = the work screen with the client strip
  flowStep = 'editor',
  onFlowStep = null,
  t,
  sym,
  formatMoneyDisplay,
  subtotal,
  discountAmount,
  taxAmount,
  totalAmount,
  canUseAttachments,
  // Owner console 2026-10-25 (typed L-05 approval): attachments are SMART PACK while the plan system is enforced (Dashboard decides)
  smartPackAllowed = true,
  canUseProfessionalQuotes,
  recommendedPricingMethod,
  canUseProfessionalQuoteReuse,
  onOpenPricingModal,
  // OD-20: server account summary for the capability notice (current plan line); never a plan source for gates
  accountSummary,
  quoteFiles,
  setQuoteFiles,
  allUserAttachments,
  onWizardStateChange,
  onStageAttachmentRemoval,
  onOpenAttachment,
  wizardResume = null,
  onWizardDraftChange,
  // Task 16 (Quote Experience V2): presentation controller (style / images / preview / issue). Absent => no panel.
  presentationController = null,
  presentationSavedStatus = null,
  onIssueQuote,
  issueBusy = false,
  onCatalogItemAdded,
  // 2026-11-13: "also save to the catalog" from the add form (Dashboard: no duplicate name, real success only)
  onSaveToCatalog = null,
}) {
  // IRON-ILS-001: money is displayed ONLY through the canonical currency-keyed path (Dashboard injects it; the fallback derives from the account market, never from UI language).
  const fmtMoney = formatMoneyDisplay || ((v) => formatMoneyForCurrency(v, isLocalIsraeliBusiness ? 'ILS' : undefined));
  // SMART-QUOTE-02: an undecided structure is simply the regular list (never a blocking first decision).
  const structureMode = quoteStructureMode || 'regular';
  // SMART-QUOTE-01: unfinished = no real priced item yet -> only an explicitly labelled unfinished draft can be saved.
  const isUnfinished = isUnfinishedQuoteForm({ items, totalAmount });
  // Owner console 2026-11-09 (typed: "מספר עוסק ... לכתוב שזה חובה, ולהוסיף הודעה בעברית (לא הודעה גנרית אלה הודעה ברורה שלנו)", incl. L-09):
  // a business client's missing tax ID shows our own message under the field instead of the browser's bubble
  const [taxIdMissing, setTaxIdMissing] = useState(false);
  // Task 16: a new quote, or a saved quote that stays a Draft, is saved as a draft (never sent or issued by saving)
  const savesAsDraft = !editingQuoteId || String(quoteStatus || '').toLowerCase() === 'draft';
  // SMART-QUOTE-04: the same case-insensitive match the save uses (Dashboard.handleSaveQuote) - disclosed before saving.
  const matchedClient = (clients || []).find((c) => (c.company_name || '').toLowerCase() === String(clientName || '').toLowerCase()) || null;
  // OD-1 issuer path: a past validity date is shown with the fix (extend it) - the stored date is only changed by the user.
  const validityExpired = isQuoteAcceptanceExpired(validUntil, isLocalIsraeliBusiness ? 'Local' : 'International');
  const hasOptionalDetails = Boolean(editingQuoteId || quoteSubject || projectName || (quoteFiles || []).length || clientAddress || notes || validUntil || attnName || attnRole || serviceSchedule?.date);
  const [showMoreDetails, setShowMoreDetails] = useState(hasOptionalDetails);
  // 2026-11-15 (the demo, Codex D02; Owner: "גם ככה אין מקום בנייד"): the contact details stay folded - also when a chosen client fills
  // them; "פרטי קשר (לא חובה)" opens them
  const [showClientContact, setShowClientContact] = useState(false);
  // opens (never auto-closes) as soon as any optional value appears (e.g. a restored draft), so entered data is never hidden
  useEffect(() => { if (hasOptionalDetails) setShowMoreDetails(true); }, [hasOptionalDetails]);
  // 2026-11-15 (Owner video: on a phone everything jumps while typing): while a field has the keyboard on a phone, the bottom bar and the
  // calculator button step aside (html.pf-typing), and the field keeps its place on the screen when the page above it changes size
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const phone = window.matchMedia('(max-width: 768px)');
    const html = document.documentElement;
    const typeable = (el) => Boolean(el) && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|hidden)$/i.test(el.type || '')));
    const scrollerOf = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const oy = getComputedStyle(a).overflowY; if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1) return a; } return window; };
    // the anchor is the element the user is on inside the quote form (a field, or the Add button). Its place in the page content is followed:
    // when something above it appears or goes (the status line, the example button), the page is scrolled by the same amount, so it stays
    // where the finger is. A scroll (the user's, or the browser showing the field above the keyboard) does not move it in the content.
    let field = null; let scroller = window; let rel = 0; let back = 0;
    const posOf = (el) => (scroller === window ? el.getBoundingClientRect().top + window.scrollY : el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop);
    function keep() {
      if (!field || !field.isConnected || document.activeElement !== field) return;
      const d = posOf(field) - rel;
      if (Math.abs(d) > 1) scroller.scrollBy(0, d);
      rel = posOf(field);
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => keep()) : null;
    const watch = () => { if (!ro) return; ro.disconnect(); ro.observe(document.body); if (scroller !== window) [...scroller.children].forEach((c) => ro.observe(c)); const f = field && field.closest('form'); if (f) ro.observe(f); };
    const on = (e) => {
      const el = e.target;
      if (!phone.matches || !el || typeof el.closest !== 'function' || !el.closest('form')) return;
      field = el; scroller = scrollerOf(el); rel = posOf(el); watch();
      // the browser's own scroll anchoring would move the page a second time - this code is the one anchor while the user is in the form
      html.classList.add('pf-anchor');
      if (typeable(el)) { clearTimeout(back); html.classList.add('pf-typing'); } // leaving a field is handled by off() (after the tap)
    };
    // the bottom bar comes back only after the tap that left the field is over (it never jumps in under the finger - 2026-11-15)
    const off = () => { clearTimeout(back); back = setTimeout(() => { const a = document.activeElement; if (!typeable(a)) html.classList.remove('pf-typing'); if (!a || a === document.body) field = null; }, 400); };
    // a tap, a key or typing may change the page above the anchor a frame or two later - follow it for a moment
    let until = 0; let raf = 0;
    const tick = () => { keep(); raf = Date.now() < until ? requestAnimationFrame(tick) : 0; };
    const settle = (e) => { if (!field || !e.target || typeof e.target.closest !== 'function' || !e.target.closest('form')) return; until = Date.now() + 900; if (!raf) raf = requestAnimationFrame(tick); };
    const evs = [['focusin', on], ['focusout', off], ['click', settle], ['input', settle], ['keydown', settle]];
    evs.forEach(([n, h]) => document.addEventListener(n, h, true));
    return () => { if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); evs.forEach(([n, h]) => document.removeEventListener(n, h, true)); clearTimeout(back); html.classList.remove('pf-typing'); html.classList.remove('pf-anchor'); };
  }, []);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');

  // חוק ברזל (Professional Quotes Stage C, §158, Visible-but-Locked, §155.1.11):
  // אותו מודל-שדרוג קיים בדיוק (לא מודל חדש - "do NOT build a large reusable
  // upgrade-modal architecture merely for Stage C") - הכללה ל-reason string
  // כדי לשרת גם attachments (PRO) וגם professionalQuotes Core (BASIC+),
  // שתי הודעות שונות דרך אותו JSX/state.
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(null); // null | 'attachments' | 'professional'
  const [errorMessage, setErrorMessage] = useState('');

  // חוק ברזל (Two-Stage Completion Task, Stage 1D - "simplify without losing
  // history"): שני textarea-ים גדולים תמיד-גלויים (תנאים+אחריות) תפסו שטח
  // אנכי משמעותי גם כשהם כבר בדיוק ברירת-המחדל מהגדרות העסק (המקרה הנפוץ
  // ביותר) - קומפקטי-מקופל כברירת מחדל, עם אינדיקציה ברורה אם ההצעה הזו
  // כן הותאמה אישית (terms/warranty בפועל שונים מברירות-המחדל הנוכחיות של
  // העסק - defaultTerms/defaultWarranty, שני props חדשים מ-Dashboard.jsx,
  // בלי שכפול-מקור-אמת: עדיין nur קורא את אותו state שהעסק כבר מנהל).
  // 2026-11-13 (13/11 spec): the structure the editor shows (simple / grouped / tiered) - opens from the saved headings; the summary panel
  // PRODUCT_TRUTH_CAPABILITY: measured_quote
  // the structure of the work area (simple / by apartments / floors, apartments and rooms) - rows priced by unit, area, length, kg, hours or days
  const [treeStructure, setTreeStructure] = useState(() => structureOf(sections || []));
  // headings that arrive after the form opened (the AI smart quote, a template, a loaded quote) raise the structure to what they need - never
  // lower it, and only when the need itself grows (a rename / duplicate never flips a structure the user chose)
  const lastNeed = useRef(structureOf(sections || []));
  useEffect(() => {
    const need = structureOf(sections || []);
    const rank = { simple: 0, grouped: 1, tiered: 2 };
    if (rank[need] > rank[lastNeed.current]) setTreeStructure((prev) => (rank[prev] < rank[need] ? need : prev));
    lastNeed.current = need;
  }, [sections]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState([]);
  const [, setEditorPage] = useState(false);
  // the summary opens right above the bar (the 13/11 demo); Escape or a click outside the bar closes it
  const toggleSummary = () => setSummaryOpen((v) => !v);
  // 2026-11-15 (the demo): a section of the quote details opens as its own page; "שמירת הפרטים" keeps, "חזרה ללא שמירה" puts everything
  // back; "→ חזרה" with something unsaved is refused with the demo's sentence. A row typed and not added blocks it (and the save / preview).
  const [detailsPage, setDetailsPage] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [barBlock, setBarBlock] = useState(false);
  const detailsSnap = useRef(null);
  const detailsNow = () => ({ quoteSubject, projectName, validUntil, serviceSchedule, notes, terms, warranty, discount, quoteFiles, quoteStatus });
  const detailsChanged = () => { const a = detailsSnap.current || {}; const b = detailsNow(); return Object.keys(b).some((k) => (k === 'quoteFiles' ? (a[k] || []) !== (b[k] || []) : JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))); };
  const openDetailsPage = (k) => {
    if (pendingRows.length) { setBarBlock(true); return; }
    detailsSnap.current = detailsNow(); setDetailsError(''); setDetailsPage(k);
    setTimeout(() => document.querySelector('[data-testid="sq-details-page"]')?.scrollIntoView?.({ block: 'start' }), 0);
  };
  const closeDetails = () => { setDetailsPage(null); setDetailsError(''); detailsSnap.current = null; };
  const backFromDetailsPage = () => { if (detailsChanged()) { setDetailsError(isHebrew ? 'יש שינויים שטרם נשמרו. שמרו אותם, או לחצו ״חזרה ללא שמירה״.' : 'There are unsaved changes. Save them, or click "Back without saving".'); return; } closeDetails(); };
  const saveDetailsPage = () => { if (detailsPage === 'discount' && discountInvalid) return; closeDetails(); };
  const closeDetailsNoSave = () => {
    const a = detailsSnap.current;
    if (a) {
      setQuoteSubject(a.quoteSubject); setProjectName(a.projectName); setValidUntil(a.validUntil); if (typeof setServiceSchedule === 'function') setServiceSchedule(a.serviceSchedule);
      setNotes(a.notes); setTerms(a.terms); setWarranty(a.warranty); setDiscount(a.discount); if (typeof setQuoteFiles === 'function') setQuoteFiles(a.quoteFiles); if (typeof setQuoteStatus === 'function') setQuoteStatus(a.quoteStatus);
    }
    closeDetails();
  };
  const detailsTitle = (k) => ({ project: isHebrew ? 'פרויקט, כתובת ותוקף' : 'Project, address and validity', notes: isHebrew ? 'הערות לכל ההצעה' : 'Notes for the whole quote',
    terms: isHebrew ? 'תנאים ואחריות' : 'Terms and warranty', discount: isHebrew ? 'הנחה' : 'Discount', files: isHebrew ? 'קבצים ותמונות' : 'Files and images',
    design: isHebrew ? 'עיצוב והנפקת ההצעה' : 'Quote design and issuing', status: isHebrew ? 'מצב ההצעה' : 'Quote status' })[k] || '';
  useEffect(() => {
    if (!summaryOpen) return undefined;
    const out = (e) => { if (!e.target.closest?.('[data-testid="qt-bar"], [data-testid="qt-summary-panel"]')) setSummaryOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setSummaryOpen(false); };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [summaryOpen]);
  const isTermsWarrantyCustomized = terms !== (defaultTerms ?? '') || warranty !== (defaultWarranty ?? '');
  // חוק ברזל: "confirmation if doing so would overwrite custom text" - אם
  // הערכים הנוכחיים כבר זהים לברירת-המחדל, אין מה "לאבד" ואין צורך לחסום
  // בדיאלוג-אישור מיותר.
  const handleRestoreTermsWarrantyDefaults = async () => {
    if (isTermsWarrantyCustomized) {
      const msg = isHebrew
        ? 'פעולה זו תחליף את התנאים/האחריות המותאמים של הצעה זו בברירת המחדל הנוכחית מהגדרות העסק. להמשיך?'
        : 'This will replace this quote\'s customized terms/warranty with the current Business Settings defaults. Continue?';
      if (!(await askConfirm(msg, isHebrew))) return;
    }
    setTerms(defaultTerms ?? '');
    setWarranty(defaultWarranty ?? '');
  };
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
  // Durable drafts: re-open an unfinished wizard from a restored draft (applied once per restored draft object)
  const [wizardResumeState, setWizardResumeState] = useState(null);
  const wizardResumeAppliedRef = useRef(null);
  useEffect(() => {
    if (!wizardResume || wizardResume === wizardResumeAppliedRef.current) return;
    wizardResumeAppliedRef.current = wizardResume;
    setWizardSectionKey(wizardResume.wizardSectionKey ?? null);
    setEditingItemIndex(wizardResume.editingItemIndex ?? null);
    setWizardResumeState(wizardResume.state || null);
    setIsAddWizardOpen(true);
  }, [wizardResume]);
  // Owner console 2026-11-08 (stage 2, decision 8, typed: "מאשר החלטה 8 ..."): the item window opens only to finish (or cancel) an item
  // window that an older draft restored; after it the work continues in the rows (no "add another item?" - a row is added in place).
  const handleWizardSave = (savedItem) => {
    if (editingItemIndex != null) {
      setItems(items.map((it, i) => (i === editingItemIndex ? savedItem : it)));
      return;
    }
    setItems((prev) => [...prev.filter((it) => !isUntouchedPlaceholderItem(it)), savedItem]);
  };
  // Owner console 2026-10-26 (typed L-09 approval, docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md): the catalog items checked together in the
  // wizard are added in ONE update, in their order; the wizard already reported each catalog item (onCatalogItemAdded).
  // Owner console 2026-10-26 (typed L-09 / L-15, real-walk finding 4): "add another item?" follows EVERY addition, a catalog selection too.
  const handleWizardSaveMany = (added) => {
    if (!Array.isArray(added) || added.length === 0) return;
    setItems((prev) => [...prev.filter((it) => !isUntouchedPlaceholderItem(it)), ...added]);
  };
  // the rows of every list share one key store, so a row keeps its typed entry and focus when its item object is replaced or it moves
  const rowKeys = useRef(null);
  if (!rowKeys.current) rowKeys.current = { map: new WeakMap(), seq: 0, focus: null };
  // 2026-11-12: rows added from the work window open their (collapsed) group, so the new work is seen
  // PRODUCT_TRUTH_CAPABILITY: professional_reuse
  // a professional row (and a heading holding one) is duplicated only with the reuse entitlement - otherwise the upgrade window opens
  const canDuplicateRow = (it) => !(isProfessionalItem(it) && !canUseProfessionalQuoteReuse);

  // AI Chat Hardening overnight task, Track B/C: bubbles the item-wizard's
  // own open/add-vs-edit/professional-vs-simple/measurements-present state
  // up to Dashboard.jsx (the only place AIChatWidget is mounted) via a
  // single optional callback prop - QuoteForm's own internal state
  // (isAddWizardOpen/editingItemIndex) is not otherwise exposed. `items`
  // itself is already Dashboard-owned lifted state, so this effect only
  // needs to report the wizard's own two private fields; the derivation
  // logic itself lives in the shared, independently-tested
  // src/utils/quoteWorkflowContext.js, never duplicated here.
  // Context-Driven AI Chat V3, §10: AddItemWizard's own live step/pricing-
  // method/measurement-progress snapshot (see its `onLiveStateChange` prop)
  // - merged into computeItemWizardState below, never re-derived here.
  const [wizardLiveState, setWizardLiveState] = useState(null);

  const hasClientNameForHelp = !!String(clientName || '').trim();
  useEffect(() => { if (hasClientNameForHelp) resolveBlockers(['QUOTE_MISSING_CLIENT']); }, [hasClientNameForHelp]);
  useEffect(() => { if (clientType) resolveBlockers(['QUOTE_MISSING_CLIENT_TYPE']); }, [clientType]);

  useEffect(() => {
    if (!onWizardStateChange) return;
    onWizardStateChange(computeItemWizardState({
      isOpen: isAddWizardOpen,
      editingItem: editingItemIndex != null ? items[editingItemIndex] : null,
      liveState: wizardLiveState,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddWizardOpen, editingItemIndex, items, wizardLiveState]);

  // Owner 2026-10-25 (typed L-01, L-09): International = the business's own chosen code (its saved phone), else by currency
  const currencyPhoneConfig = businessPhone ? businessDial({ isLocal: false, currency, businessPhone }) : getDialByCurrency(currency);
  const defaultDial = isLocalIsraeliBusiness ? '+972' : currencyPhoneConfig.dial;
  const defaultLabel = isLocalIsraeliBusiness ? 'IL (+972)' : currencyPhoneConfig.label;
  const [localPhone, setLocalPhone] = useState('');

  // Owner 2026-10-25 (typed L-07, L-08, L-09): stored without the trunk 0 after the country code
  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setClientPhone(joinPhone(defaultDial, numVal));
  };

  useEffect(() => {
    if (clientPhone && joinPhone(defaultDial, localPhone) === clientPhone) return; // the typed text (with its 0) stays as typed
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
  }, [clientPhone, defaultDial]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Owner 2026-10-15: the price step knows whether a real item exists, and a discount is a percentage between 0 and 100
  const realItemsNow = (items || []).filter((it) => it && !isUntouchedPlaceholderItem(it) && String(it.description || '').trim() !== '');
  // the simple-quotes sketch (Owner 20/11-21/11): the totals card and the summary always say "סה״כ לתשלום"; the bar says "סכום חלקי" only
  // while the quote has no line yet
  const totalLabel = isHebrew ? 'סה״כ לתשלום' : 'Total';
  const barTotalLabel = realItemsNow.length === 0 ? (isHebrew ? 'סכום חלקי' : 'Partial total') : totalLabel;
  useEffect(() => { if (!pendingRows.length) setBarBlock(false); }, [pendingRows.length]);
  // Owner console 2026-11-08 (restore item 07; body of 4f1592f2:src/components/QuoteForm.jsx 473-485): one synthetic example line, local
  // only (never saved: the save asks to remove it first; editing it turns it into an ordinary line of the user's own). 100 x 200 cm at 600
  // per m2 in the quote's currency. 2026-11-12 (unified quote): offered in the empty list line - no capability is lost.
  const addLocalExample = () => {
    const example = {
      description: isHebrew ? 'חלון אלומיניום (דוגמה)' : 'Aluminium window (example)', quantity: '1', unit_price: '600', isFromCatalog: false, section_key: null,
      pricing_unit: 'm2', quantity_source: 'calculated', calculation_method: 'area', calculated_quantity: 2,
      measurements: [{ width: 1, height: 2, unit: 'm', calculated_area: 2, label: '', is_pricing_driving: true }], _localExample: true,
    };
    setItems((prev) => [...prev.filter((it) => !isUntouchedPlaceholderItem(it) && !(it && it._localExample)), example]);
  };
  const discountInvalid = String(discount ?? '').trim() !== '' && (!Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100);

  // חוק ברזל (Entitlement/Quota Centralization, §150, סעיף 4): קורא ישירות
  // ל-entitlement.attachments (resolveAccountEntitlement, מחושב פעם אחת
  // ב-Dashboard.jsx ומועבר כ-canUseAttachments) - במקום userPlan==='pro'||
  // isSuperAdmin, נוסחה שלישית ועצמאית שניחשה את אותה עובדה בעצמה
  // (Core Architectural Law: "component C guesses plan" - בדיוק המקרה
  // שתועד). כבר כולל super_admin (entitlement.attachments = isSuperAdmin ||
  // planDef.attachments) - לא נדרש תנאי נפרד.
  // Owner 2026-11-11 (finding 5, option א; typed L-09): a business client's tax id is required in the Israeli (Local) market only - the
  // market decides, never the UI language; abroad it is marked optional and the quote saves without it
  const taxIdRequired = clientType === 'business' && isLocalIsraeliBusiness !== false;
  // Owner console 2026-11-11 (typed: "ללא מע״מ" bold and in another colour) + the sketch of 20/11 (typed L-09): the VAT notice of a BUSINESS
  // client, Israel only (the market decides, never the language) - at the top of the client step; in the work screen behind the "ללא מע״מ" chip.
  // A private client's prices include VAT: the totals say it ("מע״מ (18%) · כלול").
  const vatNotice = isLocalIsraeliBusiness && clientType === 'business' ? (
    <div className="sq-vat-notice" data-testid="sq-vat-notice" data-client-type={clientType} role="status">
      {isHebrew ? <>שימו לב: הסכומים ללקוח עסקי הינם <strong className="sq-vat-word">ללא מע״מ</strong>, והמע״מ יתווסף למחיר הסופי</> : <>Please note: amounts for business clients <strong className="sq-vat-word">exclude VAT</strong>. VAT will be added to the final price</>}
    </div>
  ) : null;
  // "שמירת הלקוח והמשך" of the client step (Owner 2026-11-13, answer 3 "א" - the demo button): the same required fields as a save (name,
  // type, an Israeli business client's tax id); a NEW client is saved to the client list right away, a chosen client is never duplicated
  const [savingClient, setSavingClient] = useState(false);
  // 2026-11-15 (the demo): the client step's button words and sentences
  const returningToQuote = Boolean(editingQuoteId) || (items || []).some((it) => it && !isUntouchedPlaceholderItem(it) && String(it.description || '').trim());
  const clientButtonText = matchedClient ? (returningToQuote ? (isHebrew ? 'חזרה להצעה' : 'Back to the quote') : (isHebrew ? 'להמשך' : 'Continue'))
    : (returningToQuote ? (isHebrew ? 'שמירת הלקוח וחזרה להצעה' : 'Save the client and back to the quote') : (isHebrew ? 'שמירת הלקוח והמשך' : 'Save the client and continue'));
  const [clientError, setClientError] = useState('');
  const continueFromClient = async () => {
    if (savingClient) return;
    if (!String(clientName || '').trim() || !clientType) { setClientError(isHebrew ? 'מלאו את שם הלקוח ובחרו לקוח פרטי או עסקי.' : 'Fill in the client name and choose a private or business client.'); return; }
    setClientError('');
    const form = document.querySelector('form.pf-editor-form');
    const fields = form ? [...form.querySelectorAll('input, select')].filter((el) => el.required) : [];
    const bad = fields.find((el) => !el.checkValidity());
    if (bad) { bad.reportValidity(); return; }
    if (!matchedClient && String(clientName || '').trim() && typeof onSaveClientNow === 'function') {
      setSavingClient(true);
      try {
        await onSaveClientNow({ company_name: String(clientName).trim(), client_type: clientType, tax_id: clientTaxId, email: clientEmail, phone: clientPhone, address: clientAddress });
      } finally { setSavingClient(false); }
    }
    if (typeof onFlowStep === 'function') onFlowStep('editor');
  };
  // PRODUCT_TRUTH_CAPABILITY: attachments
  const handleAttachmentClick = () => {
    if (!canUseAttachments) {
      publishBlocker('ATTACHMENTS_REQUIRE_PRO', { scope: 'editor' });
      // Owner 2026-11-11 (finding 46): the block stays; attachments belong to SMART PACK (the server grants the capability only while it
      // is active), so the notice is the SMART PACK one with the plans button - never "the plans that will include this are not decided"
      setShowUpgradeConfirm('smart_pack');
    } else if (!smartPackAllowed) {
      setShowUpgradeConfirm('smart_pack'); // L-05 (2026-10-25): the SMART PACK notice; no file picker opens
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

        // Owner 2026-10-23 (typed L-09..L-27): the cap counts every file of this selection together, not each one alone.
        let selectionBytes = 0;
        for (let file of files) {
          if (file.size > MAX_FILE_SIZE) {
            publishBlocker('ATTACHMENT_FILE_TOO_LARGE', { scope: 'editor' });
            setErrorMessage(isHebrew ? `הקובץ ״${file.name}״ גדול מהמותר לקובץ אחד (עד 3 MB).` : `File "${file.name}" exceeds the 3MB limit for a single file.`);
            return;
          }
          selectionBytes += file.size;
          if (CURRENT_TOTAL_SIZE + selectionBytes > MAX_TOTAL_SIZE) {
            publishBlocker('ATTACHMENT_TOTAL_EXCEEDED', { scope: 'editor' });
            setErrorMessage(isHebrew ? `העלאת הקובץ תחרוג ממכסת נפח הקבצים של העסק (30 MB).` : `Uploading this file exceeds the total 30MB capacity limit for your business.`);
            return;
          }
        }
        setErrorMessage('');
        resolveBlockers(['ATTACHMENT_FILE_TOO_LARGE', 'ATTACHMENT_TOTAL_EXCEEDED']); // confirmed: an accepted selection
        setQuoteFiles(prev => [...(prev || []), ...files]);
      };
      fileInput.click();
    }
  };

  // Durable drafts (2026-09-21): removing an EXISTING attachment is only STAGED here (Dashboard deletes the row after a
  // fully successful Save). Cancel/reload therefore never delete an attachment from the database.
  const removeFile = (index) => {
    const targetFile = (quoteFiles || [])[index];
    if (targetFile && targetFile.id && onStageAttachmentRemoval) onStageAttachmentRemoval(targetFile.id);
    setQuoteFiles(prev => (prev || []).filter((_, i) => i !== index));
  };

  // חישוב גלובלי אמיתי של הנפח שנותר מתוך 30 מגה לכלל העסק
  const globalAttachmentsBytes = (allUserAttachments || []).reduce((acc, f) => acc + (Number(f.file_size || f.size || 0)), 0);
  const draftAttachmentsBytes = (quoteFiles || []).filter(f => !f.id).reduce((acc, f) => acc + (Number(f.size || f.file_size || 0)), 0);
  const totalGlobalBytes = globalAttachmentsBytes + draftAttachmentsBytes;
  const remainingMb = Math.max(0, (30 - (totalGlobalBytes / (1024 * 1024)))).toFixed(1);

  // Owner 2026-10-23 (typed L-09, morning report item 5; IRON-DATE-001): the ACCOUNT MARKET decides the date order, never the currency -
  // a EUR / GBP account showed DD-MM while every other screen shows MM/DD
  const isUS = isLocalIsraeliBusiness !== true;
  const dateFormatLabel = isUS ? 'MM/DD/YYYY' : 'DD/MM/YYYY'; // IRON-DATE-001: the product's slash date (Codex spec item 5)

  const getDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return isUS ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
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

  // 2026-11-20/21 (Owner console, the simple-quotes sketch + L-07 / L-09 / L-15 / L-19 ...): the editor bar of the sketch (ebar) - the back
  // arrow, the title with the client name (a tap goes to the client step) and one "⋯" menu (edit client, improve quote, from a saved
  // template, show an example, cancel and back to the list)
  const [barMenu, setBarMenu] = useState(false);
  const barMenuRef = useRef(null);
  const barMenuBtn = useRef(null);
  useEffect(() => {
    if (!barMenu) return undefined;
    const out = (e) => { if (barMenuRef.current && !barMenuRef.current.contains(e.target)) setBarMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') { setBarMenu(false); barMenuBtn.current?.focus(); } };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [barMenu]);
  const [clientHelp, setClientHelp] = useState(null);
  const [vatOpen, setVatOpen] = useState(false);
  useEffect(() => {
    if (!detailsPage) return undefined;
    const esc = (e) => { if (e.key === 'Escape') backFromDetailsPage(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  });
  const onEditor = flowStep === 'editor' && typeof onFlowStep === 'function';
  const onWork = flowStep !== 'client';
  const titleText = editingQuoteId ? `${isHebrew ? 'עריכת הצעה ' : 'Edit quote '}${formatQuoteFallback({ id: editingQuoteId, quote_number: editingQuoteNumber })}` : (isHebrew ? 'הצעה חדשה' : 'New quote');
  const hasWork = (items || []).some((it) => it && String(it.description || '').trim()) || (sections || []).length > 0;
  const runMenu = (fn) => () => { setBarMenu(false); fn(); };
  const leaveOk = () => { if (pendingRows.length) { setBarBlock(true); return false; } return true; };
  // the sketch: the accessibility statement is a quiet link in the editor itself (the global footer gives way to the bar)
  const a11yLink = (
    <div className="qe-a11y">
      {/* PRODUCT_TRUTH_DECORATIVE: opens the accessibility statement - the same window as the footer's own button */}
      <button type="button" className="qt-link" onClick={() => document.querySelector('.dash-footer button')?.click()}>{isHebrew ? 'הצהרת נגישות' : 'Accessibility Statement'}</button>
    </div>
  );
  const money = (v) => <span className="pf-money">{sym}{fmtMoney(v)}</span>;
  // the client step: the sketch's field row (the label beside its field, "?" opens the explanation under the row)
  const helpQ = (k, label, testId) => (
    // PRODUCT_TRUTH_DECORATIVE: opens / closes the explanation of a client field
    <button type="button" className="qt-q" aria-label={(isHebrew ? 'הסבר: ' : 'Explain: ') + label} aria-expanded={clientHelp === k} data-testid={testId} onClick={() => setClientHelp(clientHelp === k ? null : k)}>?</button>
  );
  const fieldRow = (k, label, htmlFor, control, { help = null, testId = null, after = null } = {}) => (
    <div className="qe-f">
      <label htmlFor={htmlFor}>{label}{help && helpQ(k, label.replace(/\s*\(.*\)$/, ''), testId)}</label>
      <div className="qe-fc">{control}</div>
      {help && clientHelp === k && <div className="qe-help" role="note">{help}</div>}
      {after}
    </div>
  );
  // the totals under the work, always shown (the sketch's totalsCard) - on the same amount axis as the rows (IRON-NUMERIC-001)
  const subShown = isLocalIsraeliBusiness && clientType === 'private' ? totalAmount + (Number(discountAmount) || 0) : subtotal;
  const showDiscount = discount > 0 || Math.round(Number(discountAmount) || 0) >= 1;
  const discountLabel = discount > 0 ? <>{isHebrew ? 'הנחה' : 'Discount'} (<bdi dir="ltr" className="pf-num">{discount}%</bdi>)</> : (isHebrew ? 'הנחת עיגול' : 'Rounding discount');
  const vatLabel = <>{isHebrew ? 'מע״מ' : 'VAT'} (<bdi dir="ltr" className="pf-num">18%</bdi>){clientType === 'private' ? (isHebrew ? ' · כלול' : ' · included') : ''}</>;
  const totalRows = [
    ['sub', isHebrew ? 'סכום ביניים' : 'Subtotal', money(subShown)],
    showDiscount ? ['disc', discountLabel, <span key="d" className="pf-money qe-neg">-{sym}{fmtMoney(discountAmount)}</span>] : null,
    isLocalIsraeliBusiness ? ['vat', vatLabel, money(taxAmount)] : null,
  ].filter(Boolean);
  const partialMark = (items || []).some((it) => it && it._invalid) && <span data-testid="sq-total-partial" className="qe-partial">{isHebrew ? 'הסכום עדיין חלקי' : 'Partial total'}</span>;
  const vatChip = isLocalIsraeliBusiness && clientType === 'business' ? (
    // PRODUCT_TRUTH_DECORATIVE: shows / hides the VAT notice of a business client (Israel)
    <button type="button" className="qt-vchip" aria-expanded={vatOpen} data-testid="sq-vat-chip" onClick={() => setVatOpen((v) => !v)}>{isHebrew ? 'ללא מע״מ' : 'Excl. VAT'}</button>
  ) : null;

  return (
    <div className="pf-screen qe" style={{ background: 'transparent', padding: 0, borderRadius: 0, marginBottom: 0, border: 'none', boxShadow: 'none', fontFamily: FONT_HE }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <AddItemWizard
        isOpen={isAddWizardOpen}
        onClose={() => { setIsAddWizardOpen(false); setWizardResumeState(null); }}
        onAdd={handleWizardSave}
        editingItem={editingItemIndex != null ? items[editingItemIndex] : null}
        isHebrew={isHebrew}
        sym={sym}
        formatMoneyDisplay={fmtMoney}
        services={services}
        sections={sections}
        defaultSectionKey={wizardSectionKey}
        canUseProfessionalQuotes={canUseProfessionalQuotes}
        recommendedMethod={recommendedPricingMethod}
        onRequestUpgrade={() => { setIsAddWizardOpen(false); setShowUpgradeConfirm('professional'); }}
        onLiveStateChange={setWizardLiveState}
        resumeState={wizardResumeState}
        onDraftSnapshot={(st) => { if (onWizardDraftChange) onWizardDraftChange(st ? { open: true, editingItemIndex, wizardSectionKey, state: st } : null); }}
        onCatalogItemAdded={onCatalogItemAdded}
        onAddMany={handleWizardSaveMany}
        quoteItems={items}
        international={isLocalIsraeliBusiness === false}
      />
      {/* OD-17: the one capability notice (no Basic/Pro wording, no purchase, no mutation; close is a no-op) */}
      <CapabilityUpgradeNotice
        lang={isHebrew ? 'he' : 'en'}
        capabilityId={UPGRADE_CAPABILITY[showUpgradeConfirm] || null}
        summary={accountSummary}
        details={<div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}><AiHelpButton isHebrew={isHebrew} long testId="ai-help-upgrade" /></div>}
        onUpgrade={() => { setShowUpgradeConfirm(null); if (onOpenPricingModal) onOpenPricingModal(); }}
        onClose={() => setShowUpgradeConfirm(null)}
        idPrefix="qf-upgrade"
      />

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
            {/* AI HELP V4 §8: help stays reachable while this overlay covers the app (closing it does not clear the blocker) */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><AiHelpButton isHebrew={isHebrew} long testId="ai-help-file-error" /></div>
            {/* PRODUCT_TRUTH_DECORATIVE: dismisses the file-upload-error modal ('OK' button) */}
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

      <form id="pf-editor-form" className="pf-screen-body pf-editor-form" data-quote-form="editor" onSubmit={onSave} onInvalidCapture={(e) => { const code = INVALID_FIELD_BLOCKER[e.target?.dataset?.helpField]; if (code) publishBlocker(code, { scope: 'editor', stage: 'validating' }); }}>
        <div className="qe-ebar">
          {/* Owner 2026-10-25 (typed L-09 / L-15): Back keeps the draft on this device (asks only when there are unsaved changes); in the work
              screen of a new quote it goes back to the client step (the sketch's arrow) */}
          {typeof onBack === 'function' && (
            // PRODUCT_TRUTH_DECORATIVE: leaves the editor like the phone Back; the local draft is kept, nothing is deleted or saved to the server
            <button type="button" className="qt-ib qe-back" onClick={flowStep === 'editor' && !editingQuoteId && typeof onFlowStep === 'function' ? () => { if (leaveOk()) onFlowStep('client'); } : onBack} data-testid="editor-back"
              aria-label={isHebrew ? 'חזרה' : 'Back'} title={isHebrew ? 'חזרה בלי למחוק: הטיוטה נשארת שמורה במכשיר הזה' : 'Back without deleting: the draft stays on this device'}>
              {isHebrew ? <ArrowRight size={20} strokeWidth={2} aria-hidden="true" /> : <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />}
            </button>
          )}
          <h2 className="qe-ttl">
            <span className="qe-ttl-t">{titleText}</span>
            {onEditor && String(clientName || '').trim() && (<>
              <span className="qe-tsep" aria-hidden="true">·</span>
              {/* PRODUCT_TRUTH_DECORATIVE: goes back to the client step of the same quote (nothing is lost) */}
              <button type="button" className="qe-cname" data-testid="sq-client-strip" aria-label={`${isHebrew ? 'עריכת הלקוח' : 'Edit client'}: ${clientName}`} onClick={() => { if (leaveOk()) onFlowStep('client'); }}><EllipsisText text={clientName} /></button>
            </>)}
          </h2>
          <span className="qt-menu-wrap" ref={barMenuRef}>
            {/* PRODUCT_TRUTH_DECORATIVE: the "more actions" menu of the editor bar */}
            <button ref={barMenuBtn} type="button" className="qt-btn qt-btn--sm qe-more" aria-haspopup="menu" aria-expanded={barMenu} aria-label={isHebrew ? 'עוד פעולות' : 'More actions'} data-testid="editor-more" onClick={() => setBarMenu((v) => !v)}><SketchIcon name="dots" size={17} /></button>
            {barMenu && (
              <div className="qt-menu qe-menu" role="menu" aria-label={isHebrew ? 'עוד פעולות' : 'More actions'}>
                {onEditor && (
                  // PRODUCT_TRUTH_DECORATIVE: goes back to the client step of the same quote (nothing is lost)
                  <button type="button" role="menuitem" onClick={runMenu(() => { if (leaveOk()) onFlowStep('client'); })}><SketchIcon name="pen" size={17} /><span className="qt-menu-label">{isHebrew ? 'עריכת הלקוח' : 'Edit client'}</span></button>
                )}
                {typeof onOpenCustomerTwin === 'function' && (
                  // PRODUCT_TRUTH_DECORATIVE: opens the Customer Twin panel for the open draft (internal; changes nothing by itself)
                  // Owner 2026-10-24 (typed L-07, L-09, L-13, L-29): named "שיפור ההצעה", with what it does on hover
                  <button type="button" role="menuitem" data-testid="customer-twin-open" onClick={runMenu(onOpenCustomerTwin)}
                    title={isHebrew ? 'מציע מה לשנות בהצעה כדי שתהיה ברורה ואטרקטיבית יותר בעיני הלקוח שלכם.' : 'Suggests what to change in the quote so it is clearer and more attractive to your customer.'}>
                    <CustomerTwinIcon size={17} /><span className="qt-menu-label">{isHebrew ? 'שיפור ההצעה' : 'Improve quote'}</span></button>
                )}
                {onWork && typeof onAddUnitFromTemplate === 'function' && (
                  // PRODUCT_TRUTH_DECORATIVE: "from a saved template" (stage 4) - opens the unit templates; one section with its rows is added
                  <button type="button" role="menuitem" data-testid="unit-from-template" onClick={runMenu(onAddUnitFromTemplate)}><SketchIcon name="tmpl" size={17} /><span className="qt-menu-label">{isHebrew ? 'מתבנית שמורה' : 'From a saved template'}</span></button>
                )}
                {onWork && !hasWork && (
                  // PRODUCT_TRUTH_DECORATIVE: adds ONE local, never-saved example line to learn the row from (Owner restore item 07)
                  <button type="button" role="menuitem" data-testid="quote-show-example" onClick={runMenu(addLocalExample)}><svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg><span className="qt-menu-label">{isHebrew ? 'הצגת דוגמה (לא נשמרת)' : 'Show an example (not saved)'}</span></button>
                )}
                <hr />
                {/* PRODUCT_TRUTH_DECORATIVE: 'Cancel & Return' - closes the quote form via onCancel without saving */}
                <button type="button" role="menuitem" data-testid="editor-cancel" onClick={runMenu(onCancel)}><X size={17} strokeWidth={2} aria-hidden="true" /><span className="qt-menu-label">{isHebrew ? 'ביטול וחזרה לרשימה' : 'Cancel & Return'}</span></button>
              </div>
            )}
          </span>
        </div>
        {/* SMART-QUOTE (2026-09-22, Owner-locked first-use flow): 1 who is it for -> 2 what work/product -> 3 price -> 4 review & save.
            Professional capability (catalog, measured items, sections, attachments, terms) is unchanged. */}
        {!onEditor && (<>
        <StepHeading n={1} title={isHebrew ? 'למי מכינים את ההצעה?' : 'Who is this quote for?'} />
        {/* Owner console 2026-11-11 (the two sentences) + the sketch (20/11): the VAT notice of a business client at the top of the client step, Israel only */}
        {vatNotice}
        <div className="pf-m-surface qe-card" style={{ background: '#ffffff', border: '1px solid #e3e8e9', borderRadius: '10px', padding: '12px' }}>
          {fieldRow('existing', isHebrew ? 'בחירת לקוח קיים (לא חובה)' : 'Choose an existing client (optional)', 'sq-client-existing', (
            // an existing client fills its details (no duplicate is made); "+ add a new client" empties a picked client's details for a new one
            <select id="sq-client-existing" data-testid="sq-client-existing" className="qe-in" value={matchedClient ? String(matchedClient.id) : (clientName.trim() ? '__new' : '')}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__new') { if (matchedClient) { setClientName(''); setClientEmail(''); setClientPhone(''); setClientTaxId(''); setClientAddress(''); } return; }
                const c = clients.find((x) => String(x.id) === v);
                if (c) handleClientSelect({ target: { value: c.company_name || '' } });
              }}>
              <option value="__new">{isHebrew ? '+ הוספת לקוח חדש' : '+ Add a new client'}</option>
              {/* Owner console 2026-11-18, typed: "רשימת הלקוחות" / "Client list" (the longer wording was cut at phone width) */}
              <option value="" disabled hidden>{isHebrew ? 'רשימת הלקוחות' : 'Client list'}</option>
              {[...clients].sort((a, b) => String(a.company_name || '').localeCompare(String(b.company_name || ''), isHebrew ? 'he' : 'en', { numeric: true, sensitivity: 'base' }))
                .map((c) => <option key={c.id} value={String(c.id)}>{c.company_name}</option>)}
            </select>
          ), { help: isHebrew ? '״הוספת לקוח חדש״ נמצאת בראש הרשימה. אפשר גם לבחור לקוח שמור או למלא ישירות את השם והסוג למטה. לקוח חדש נשמר ברשימה בלחיצה על ״שמירת הלקוח והמשך״.' : '"Add a new client" is at the top of the list. You can also pick a saved client or fill in the name and type below. A new client is saved to the list when you click "Save the client and continue".', testId: 'sq-help-client-existing' })}
          {fieldRow('name', t.clientName, 'sq-client-name', (
            <input id="sq-client-name" type="text" className="qe-in" value={clientName} onChange={handleClientSelect} placeholder={isHebrew ? 'הקלידו את שם הלקוח' : 'Type the client name'} data-help-field="client_name" required />
          ), { help: isHebrew ? 'הקלידו את שם הלקוח שיופיע בהצעת המחיר. אין צורך לבחור לקוח מהרשימה כדי להוסיף חדש.' : 'Type the client name that appears on the quote. There is no need to pick from the list to add a new one.', testId: 'sq-help-client-name' })}
          {fieldRow('type', isHebrew ? 'סוג הלקוח' : 'Client type', 'sq-client-type', (
            <select id="sq-client-type" className="qe-in" value={clientType} onChange={(e) => setClientType(e.target.value)} data-help-field="client_type" required={!editingQuoteId}>
              <option value="" disabled>{isHebrew ? 'בחרו סוג לקוח' : 'Choose the client type'}</option>
              <option value="private">{isHebrew ? 'לקוח פרטי' : 'Private client'}</option>
              <option value="business">{isHebrew ? 'לקוח עסקי' : 'Business client'}</option>
            </select>
          ), { help: isHebrew ? 'לקוח פרטי הוא אדם או משפחה. לקוח עסקי הוא חברה או עוסק.' : 'A private client is a person or a family. A business client is a company or a self-employed business.', testId: 'sq-help-client-type' })}
          {/* a business client's number (required in Israel only - never an Israeli id forced abroad); a private client's ID in the contact details */}
          {(clientType === 'business' || showClientContact) && fieldRow('tax', clientType === 'business'
            ? (isHebrew ? 'מספר עוסק מורשה / חברה' : 'Business / company number') + (taxIdRequired ? (isHebrew ? ' (חובה)' : ' (required)') : (isHebrew ? ' (לא חובה)' : ' (optional)'))
            : (isHebrew ? 'ת״ז (לא חובה)' : 'ID (optional)'), 'sq-client-tax-id', (
            <input id="sq-client-tax-id" className="qe-in qe-ltr" inputMode={clientType === 'business' && taxIdRequired ? 'numeric' : undefined}
              placeholder={clientType === 'business' ? (isHebrew ? 'הקלידו מספר עוסק מורשה או חברה' : 'Type the business or company number') : undefined} data-testid="sq-client-tax-id" type="text" value={clientTaxId}
              onChange={(e) => { setClientTaxId(e.target.value); if (taxIdMissing) setTaxIdMissing(false); }}
              onInvalid={(e) => { e.preventDefault(); setTaxIdMissing(true); e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); e.target.focus({ preventScroll: true }); }}
              required={taxIdRequired} aria-invalid={taxIdMissing && taxIdRequired ? true : undefined}
              pattern={taxIdRequired ? TAX_ID_NOT_BLANK : undefined}
              aria-describedby={taxIdMissing && taxIdRequired ? 'sq-client-tax-id-missing' : undefined}
              style={taxIdMissing && taxIdRequired ? { borderColor: NEON.red } : undefined} />
          ), { help: clientType === 'business' ? (taxIdRequired ? (isHebrew ? 'הקלידו את מספר העוסק המורשה או החברה של הלקוח. זהו שדה חובה ללקוח עסקי.' : 'Type the client\'s licensed dealer or company number. It is required for a business client.')
            : (isHebrew ? 'מספר העסק או החברה של הלקוח, אם יש. לא חובה.' : 'The client\'s business or company number, if there is one. Optional.')) : null, testId: 'sq-help-client-tax',
          after: taxIdMissing && taxIdRequired ? (
            <p id="sq-client-tax-id-missing" data-testid="sq-client-tax-id-missing" role="alert" className="qe-err">
              {isHebrew ? 'חסר מספר עוסק. ללקוח עסקי צריך למלא מספר עוסק מורשה או חברה.' : 'The business number is missing. A business client needs a business or company number.'}
            </p>) : null })}

          {/* Owner round 1 (2026-10-15): contact details and the attention contact are optional - one toggle (folded by default, 2026-11-15) */}
          {/* PRODUCT_TRUTH_DECORATIVE: shows / hides the optional client contact fields (email, phone, attention contact) */}
          <button type="button" className="qe-tog" data-testid="sq-client-contact-toggle" aria-expanded={showClientContact} onClick={() => setShowClientContact((v) => !v)}>
            {isHebrew ? 'פרטי קשר (לא חובה)' : 'Contact details (optional)'}
            <ChevronDown size={15} style={{ transform: showClientContact ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>
          {showClientContact && (<>
            {fieldRow('phone', isHebrew ? 'טלפון' : 'Phone', 'sq-client-phone', (
              // Owner 2026-11-11 (findings 17 + 21): the code alone ("+1", "+972"); the number reads left to right in both languages (IRON numeric bidi)
              <div className="qe-ph" style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', minWidth: 0 }}>
                <span className="qe-ph-code"><bdi dir="ltr" title={defaultLabel}>{defaultDial}</bdi></span>
                <input id="sq-client-phone" type="text" className="qe-in qe-ltr" value={localPhone} onChange={(e) => handleLocalPhoneChange(e.target.value)} placeholder={phonePlaceholder(defaultDial)} />
              </div>
            ), { help: isHebrew ? 'טלפון ליצירת קשר.' : 'A phone number to reach the client.', testId: 'sq-help-client-phone' })}
            {fieldRow('email', isHebrew ? 'דוא״ל' : 'E-mail', 'sq-client-email', (
              <input id="sq-client-email" className="qe-in qe-ltr" placeholder={isHebrew ? 'הקלידו כתובת דוא״ל' : 'Type an e-mail address'} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            ), { help: isHebrew ? 'כתובת הדוא״ל של הלקוח.' : "The client's e-mail address.", testId: 'sq-help-client-email' })}
            {fieldRow('addr', isHebrew ? 'כתובת' : 'Address', 'sq-client-address', (
              <div className="qe-addr">
                {/* night task 2026-11-16 (Owner typed, L-07 / L-08 / L-09, item 2): the city comes first in every language and market (the Israel suggestions need it) */}
                {(() => {
                  const cityField = <AddressSuggestInput key="city" kind="city" enabled={isLocalIsraeliBusiness === true} isHebrew={isHebrew} value={city} onChange={(v) => handleAddressFieldChange(street, v, stateProv, zipCode)} inputProps={{ type: 'text', className: 'qe-in', 'data-testid': 'quote-address-city', 'aria-label': isHebrew ? 'עיר' : 'City', placeholder: isHebrew ? 'עיר' : 'City' }} />;
                  const streetField = <AddressSuggestInput key="street" kind="street" enabled={isLocalIsraeliBusiness === true} isHebrew={isHebrew} cityText={city} value={street} onChange={(v) => handleAddressFieldChange(v, city, stateProv, zipCode)} inputProps={{ id: 'sq-client-address', type: 'text', className: 'qe-in', 'data-testid': 'quote-address-street', 'aria-label': isHebrew ? 'רחוב ומספר' : 'Street Address', placeholder: isHebrew ? 'רחוב ומספר' : 'Street Address' }} />;
                  return [cityField, streetField];
                })()}
                <input type="text" className="qe-in" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה / מחוז' : 'State / Province'} aria-label={isHebrew ? 'מדינה / מחוז' : 'State / Province'} />
                <input type="text" className="qe-in qe-ltr" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder={isHebrew ? 'מיקוד' : 'ZIP / Postal'} aria-label={isHebrew ? 'מיקוד' : 'ZIP / Postal'} />
              </div>
            ), { help: isHebrew ? 'הכתובת שתופיע בהצעה.' : 'The address that appears on the quote.', testId: 'sq-help-client-address' })}
            {/* Item 18 - Attention Contact ("לידי"/"Attn"), quote-level: a historical quote keeps who it was addressed to */}
            {fieldRow('attn', isHebrew ? 'לידי (איש קשר, לא חובה)' : 'Attn (contact, optional)', 'sq-client-attn', (
              <input id="sq-client-attn" type="text" className="qe-in" value={attnName || ''} onChange={(e) => setAttnName(e.target.value)} placeholder={isHebrew ? 'לדוגמה: שמעון לוי' : 'e.g. John Smith'} />
            ))}
            {fieldRow('role', isHebrew ? 'תפקיד / תואר (לא חובה)' : 'Role / Title (optional)', 'sq-client-role', (
              <input id="sq-client-role" type="text" className="qe-in" value={attnRole || ''} onChange={(e) => setAttnRole(e.target.value)} placeholder={isHebrew ? 'לדוגמה: מנהל פרויקטים' : 'e.g. Project Manager'} />
            ))}
          </>)}
          {flowStep === 'client' && clientError && <p className="qe-err" role="alert" data-testid="sq-client-error">{clientError}</p>}
          {flowStep === 'client' && (
            <div className="sq-client-continue">
              {/* PRODUCT_TRUTH_DECORATIVE: saves a new client to the client list (a chosen client is not duplicated) and continues to the work screen of the same quote */}
              <button type="button" className="qt-btn qt-btn--p" data-testid="sq-client-continue" disabled={savingClient} onClick={continueFromClient}>{clientButtonText}</button>
            </div>
          )}
        </div>
        {a11yLink}
        </>)}

        {flowStep !== 'client' && (<>
        <div className="sq-g-work" data-testid="sq-editor-grid">
          <QuoteTreeEditor isHebrew={isHebrew} international={isLocalIsraeliBusiness === false} items={items} setItems={setItems} sections={sections || []}
            setSections={(next) => { setSections(next); if ((next || []).length && structureMode !== 'divided') setQuoteStructureMode('divided'); if (!(next || []).length && structureMode === 'divided') setQuoteStructureMode('regular'); }}
            services={services} sym={sym} fmtMoney={fmtMoney} structure={treeStructure} onStructure={setTreeStructure}
            onSaveToCatalog={onSaveToCatalog} onCatalogItemAdded={onCatalogItemAdded} recommendedMethod={recommendedPricingMethod}
            onSaveHeadingTemplate={typeof onSaveUnitTemplate === 'function' ? onSaveUnitTemplate : null}
            canDuplicateRow={canDuplicateRow} onDuplicateLocked={() => setShowUpgradeConfirm('reuse')}
            keyStore={rowKeys.current} onPendingChange={setPendingRows} onPageChange={setEditorPage}
            canUseMeasured={canUseProfessionalQuotes !== false} onMeasuredLocked={() => setShowUpgradeConfirm('professional')}
            lineExtra={vatChip} />
          {vatChip && vatOpen && vatNotice}
          {/* the totals under the work, always shown (the sketch's totalsCard): the same columns as the rows, so every amount ends on one axis */}
          <div className="qt-items qt-tots" aria-label={isHebrew ? 'סיכום ההצעה' : 'Quote summary'} data-testid="sq-totals">
            {totalRows.map(([k, label, value]) => <div key={k} className="qt-ir qt-trw"><span>{label}</span><span className="qt-ir-s">{value}</span><span /></div>)}
            <div className="qt-ir qt-trw qt-gt"><span>{totalLabel}{partialMark}</span><span className="qt-ir-s">{money(totalAmount)}</span><span /></div>
          </div>
        </div>

        {/* 2026-11-15 (the demo) + 20/11 (the sketch): "פרטים נוספים להצעה (לא חובה)" - a line that opens the section buttons; each opens its
            own window (the fields, "שמירת הפרטים" / "חזרה ללא שמירה"). The quote design and its issuing and the status of a saved quote are
            buttons in the same grid - nothing is dropped. */}
        <div className="sq-g-details">
          <div className="qt-extras" data-testid="sq-details" dir={isHebrew ? 'rtl' : 'ltr'}>
            {/* PRODUCT_TRUTH_DECORATIVE: opens / closes the buttons of the quote details */}
            <button type="button" className="qt-extras-tg" data-testid="sq-more-details-toggle" aria-expanded={showMoreDetails} onClick={() => setShowMoreDetails((v) => !v)}>
              <ChevronDown size={15} aria-hidden="true" style={{ transform: showMoreDetails ? 'none' : `rotate(${isHebrew ? 90 : -90}deg)` }} />{isHebrew ? 'פרטים נוספים להצעה (לא חובה)' : 'More quote details (optional)'}
            </button>
            {showMoreDetails && (
              <div className="qt-xg" data-testid="sq-more-details">
                {[['project', isHebrew ? 'פרויקט, כתובת ותוקף' : 'Project, address and validity'], ['notes', isHebrew ? 'הערות לכל ההצעה' : 'Notes for the whole quote'],
                  ['terms', isHebrew ? 'תנאים ואחריות' : 'Terms and warranty'], ['discount', isHebrew ? 'הנחה' : 'Discount'], ['files', isHebrew ? 'קבצים ותמונות' : 'Files and images'],
                  ...(presentationController ? [['design', isHebrew ? 'עיצוב והנפקת ההצעה' : 'Quote design and issuing']] : []), ...(editingQuoteId ? [['status', isHebrew ? 'מצב ההצעה' : 'Quote status']] : [])]
                  .map(([k, label]) => (
                    // PRODUCT_TRUTH_DECORATIVE: opens one section of the quote details in its own window (nothing changes until "שמירת הפרטים")
                    <button key={k} type="button" className="sq-extras-btn" data-testid={`sq-extra-${k}`} onClick={() => openDetailsPage(k)}>{label}</button>
                  ))}
              </div>
            )}
          </div>
        </div>
        {detailsPage && (
          <div className="qt-ov" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) backFromDetailsPage(); }}>
            <div className={`qt-dlg sq-details-page${detailsPage === 'design' ? ' qt-dlg--wide' : ''}`} role="dialog" aria-modal="true" aria-label={detailsTitle(detailsPage)} data-testid="sq-details-page" dir={isHebrew ? 'rtl' : 'ltr'}>
              <h3>{detailsTitle(detailsPage)}</h3>
              {detailsError && <div className="qt-note" role="alert" data-testid="sq-details-error">{detailsError}</div>}
              <section className="qe-dfields" data-testid="sq-details-page-card">
              {detailsPage === 'project' && (<>
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-subject">{isHebrew ? 'כותרת ההצעה' : 'Quote title'}</label></div>
                  <input id="sq-subject" className="qt-input" type="text" value={quoteSubject || ''} placeholder={isHebrew ? 'לשיפוץ הנכס (לדוגמה)' : 'e.g. Home renovation'} onChange={(e) => setQuoteSubject(e.target.value)} />
                </div>
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-project">{isHebrew ? 'שם הפרויקט' : 'Project name'}</label></div>
                  <input id="sq-project" className="qt-input" type="text" value={projectName || ''} onChange={(e) => setProjectName(e.target.value)} />
                </div>
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-valid-until">{isHebrew ? 'בתוקף עד' : 'Valid until'}</label></div>
                  <input id="sq-valid-until" className="qt-input" type="text" value={getDisplayDate(validUntil)} onChange={handleDisplayDateChange} placeholder={isHebrew ? (isUS ? 'חודש/יום/שנה' : 'יום/חודש/שנה') : dateFormatLabel} style={{ direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }} />
                  {validityExpired && <div data-testid="sq-validity-expired" role="status" style={{ marginTop: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#9a3412' }}>{isHebrew ? 'תאריך התוקף עבר - הלקוח לא יוכל לחתום עד שתאריכו את התוקף.' : 'The validity date has passed - the customer cannot sign until you extend it.'}</div>}
                </div>
                {typeof setServiceSchedule === 'function' && <ServiceScheduleFields value={serviceSchedule} onChange={setServiceSchedule} state={serviceScheduleState} isHebrew={isHebrew} isUS={isUS} />}
              </>)}
              {detailsPage === 'notes' && (
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-notes">{isHebrew ? 'הערות לכל ההצעה' : 'Notes for the whole quote'}</label><HelpCircle inline testId="sq-help-notes" label={isHebrew ? 'הסבר: הערות' : 'Explain: notes'} text={isHebrew ? 'הערות שיופיעו בהצעה, מתחת לעבודות.' : 'Notes that appear in the quote, under the works.'} /></div>
                  <textarea id="sq-notes" className="qt-input qt-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              )}
              {detailsPage === 'terms' && (<>
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-terms">{isHebrew ? 'תנאי תשלום' : 'Payment terms'}</label><HelpCircle inline testId="sq-help-terms" label={isHebrew ? 'הסבר: תנאי תשלום' : 'Explain: payment terms'} text={isHebrew ? 'התנאים נטענו מהגדרות העסק. שינוי כאן חל על ההצעה הזו בלבד.' : 'The terms come from the business settings. A change here applies to this quote only.'} /></div>
                  <textarea id="sq-terms" className="qt-input qt-textarea" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-warranty">{isHebrew ? 'אחריות' : 'Warranty'}</label><HelpCircle inline testId="sq-help-warranty" label={isHebrew ? 'הסבר: אחריות' : 'Explain: warranty'} text={isHebrew ? 'האחריות נטענה מהגדרות העסק. שינוי כאן חל על ההצעה הזו בלבד.' : 'The warranty comes from the business settings. A change here applies to this quote only.'} /></div>
                  <textarea id="sq-warranty" className="qt-input qt-textarea" rows={4} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
                </div>
                {/* PRODUCT_TRUTH_DECORATIVE: puts the business's saved default terms / warranty back into this quote */}
                <button type="button" className="qt-link" style={{ alignSelf: 'flex-start' }} onClick={handleRestoreTermsWarrantyDefaults}>{isHebrew ? 'שחזור ברירת המחדל מהגדרות העסק' : 'Restore Business Settings defaults'}</button>
              </>)}
              {detailsPage === 'discount' && (
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-discount">{isHebrew ? 'הנחה באחוזים' : 'Discount in percent'}</label><HelpCircle inline testId="sq-help-discount" label={isHebrew ? 'הסבר: הנחה' : 'Explain: discount'} text={isHebrew ? 'האחוז יורד פעם אחת מסכום ההצעה. 0 פירושו ללא הנחה.' : 'The percent comes off the quote total once. 0 means no discount.'} /></div>
                  <input id="sq-discount" data-testid="sq-discount" className="qt-input pf-num" type="text" inputMode="decimal" dir="ltr" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" aria-invalid={discountInvalid} aria-describedby={discountInvalid ? 'sq-discount-error' : undefined} />
                  {discountInvalid && <div id="sq-discount-error" role="alert" style={{ color: NEON.red, fontSize: '0.74rem', marginTop: '4px' }}>{isHebrew ? 'הנחה צריכה להיות בין 0 ל־100 אחוז.' : 'A discount must be between 0 and 100 percent.'}</div>}
                </div>
              )}
              {detailsPage === 'files' && (
                <div className="qt-field">
                  <div className="qt-page-label"><span className="sq-label-text">{isHebrew ? 'בחירת קבצים להצעה' : 'Choose files for the quote'}</span><HelpCircle inline testId="sq-help-files" label={isHebrew ? 'הסבר: קבצים' : 'Explain: files'} text={isHebrew ? 'קבצים ושרטוטים שיצורפו להצעה. עד 3 מגה לקובץ.' : 'Files and drawings attached to the quote. Up to 3 MB per file.'} /></div>
                  {canUseAttachments && <div style={{ fontSize: '0.75rem', color: NEON.textMuted, fontWeight: 600 }}>{isHebrew ? <>נפח פנוי להעלאת קבצים: <bdi dir="ltr">{`${remainingMb} MB`}</bdi></> : `Free space for attachments: ${remainingMb} MB`}</div>}
                  <button type="button" className="qt-btn" style={{ alignSelf: 'flex-start' }} onClick={handleAttachmentClick}>
                    <Paperclip size={13} strokeWidth={2.5} /> {isHebrew ? <span>צירוף קובץ ללקוח (עד <bdi dir="ltr">3 MB</bdi>)</span> : 'Attach file for client (max 3 MB)'}
                  </button>
                  {(quoteFiles || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      {(quoteFiles || []).map((file, idx) => {
                        const displayName = file.name || file.file_name || `File #${idx + 1}`;
                        const displaySize = ((file.size || file.file_size || 0) / (1024 * 1024)).toFixed(2);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: NEON.bgInput, padding: '4px 8px', borderRadius: '6px', border: `1px solid ${NEON.borderStrong}`, fontSize: '0.8rem' }}>
                            {/* PRODUCT_TRUTH_DECORATIVE: opens an already-uploaded attachment via a signed URL; sub-action of the already-documented attachments capability */}
                            {file.id && onOpenAttachment ? (
                              <button type="button" onClick={() => onOpenAttachment(file)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: NEON.violetLight, textDecoration: 'underline', font: 'inherit', textAlign: 'start' }}>{displayName} ({displaySize} MB)</button>
                            ) : (<span style={{ color: NEON.textSecondary }}>{displayName} ({displaySize} MB)</span>)}
                            {/* PRODUCT_TRUTH_DECORATIVE: removes a single file from the in-progress attachments list before save; a list-item delete control */}
                            <button type="button" onClick={() => removeFile(idx)} aria-label={isHebrew ? `הסרת הקובץ ${displayName}` : `Remove attachment ${displayName}`} style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', minWidth: 32, minHeight: 32, justifyContent: 'center' }}><X size={12} strokeWidth={3} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {detailsPage === 'design' && presentationController && (
                <QuotePresentationPanel ctl={presentationController} items={items} editingQuoteId={editingQuoteId} savedStatus={presentationSavedStatus}
                  isUnfinished={isUnfinished} savesAsDraft={savesAsDraft} onIssue={onIssueQuote} issueBusy={issueBusy} />
              )}
              {detailsPage === 'status' && editingQuoteId && (
                <div className="qt-field">
                  <div className="qt-page-label"><label htmlFor="sq-status">{isHebrew ? 'מצב ההצעה' : 'Quote status'}</label></div>
                  <select id="sq-status" className="qt-select" value={quoteStatus} onChange={(e) => setQuoteStatus(e.target.value)}>
                    <option value="Draft">{isHebrew ? 'טיוטה' : 'Draft'}</option>
                    <option value="Sent" disabled={isUnfinished}>{isHebrew ? 'נשלחה' : 'Sent'}</option>
                    <option value="Approved" disabled={isUnfinished}>{isHebrew ? 'אושרה' : 'Approved'}</option>
                    <option value="Paid" disabled={isUnfinished}>{isHebrew ? 'שולמה' : 'Paid'}</option>
                  </select>
                </div>
              )}
              </section>
              <div className="qt-dlg-acts">
                {/* PRODUCT_TRUTH_DECORATIVE: closes the window - everything changed in it goes back to what it was */}
                <button type="button" className="qt-btn" data-testid="sq-details-close" onClick={closeDetailsNoSave}>{isHebrew ? 'חזרה ללא שמירה' : 'Back without saving'}</button>
                {/* PRODUCT_TRUTH_DECORATIVE: keeps what was changed in this window and returns to the quote */}
                <button type="button" className="qt-btn qt-btn--p" data-testid="sq-details-save" onClick={saveDetailsPage}>{isHebrew ? 'שמירת הפרטים' : 'Save the details'}</button>
              </div>
            </div>
          </div>
        )}

        {a11yLink}
        {/* the sketch's bar (sbar): save and what the client sees at the start; the total (its summary opens on a tap) ON the amount axis */}
        <div className="sq-g-bar">
          <div className="qt-sbar" data-testid="qt-bar">
            <span className="qt-acts2">
              {/* PRODUCT_TRUTH_DECORATIVE: the quote form's own submit button; the real create/edit distinction and capability markers live on the resolved onSave handler in Dashboard.jsx (quote_create/quote_edit) */}
              <button type="submit" data-testid="sq-save" className="qt-btn qt-btn--p" onClick={(e) => { if (pendingRows.length) { e.preventDefault(); setBarBlock(true); } }}>
                {isUnfinished ? (isHebrew ? 'שמירה כטיוטה לא גמורה' : 'Save unfinished draft') : editingQuoteId ? (isHebrew ? 'עדכון ההצעה' : 'Update the quote') : (isHebrew ? 'שמירת ההצעה' : 'Save the quote')}
              </button>
              {presentationController && typeof presentationController.openPreview === 'function' && (
                // PRODUCT_TRUTH_DECORATIVE: the preview only the user sees - what the client will see
                <button type="button" className="qt-btn" data-testid="qt-customer-view" aria-label={isHebrew ? 'כך הלקוח יראה' : 'Client view'} onClick={() => { if (pendingRows.length) { setBarBlock(true); return; } presentationController.openPreview(); }}>
                  <Eye size={16} strokeWidth={2} aria-hidden="true" /><span className="qt-lbl">{isHebrew ? 'כך הלקוח יראה' : 'Client view'}</span></button>
              )}
            </span>
            {/* PRODUCT_TRUTH_DECORATIVE: opens / closes the quote summary (the amounts and VAT) */}
            <button type="button" className="qt-tot" aria-label={isHebrew ? 'סיכום ההצעה' : 'Quote summary'} aria-expanded={summaryOpen} data-testid="qt-summary-toggle" onClick={toggleSummary}>
              <small data-testid="qt-bar-total-label">{barTotalLabel} ▴</small><b>{money(totalAmount)}</b></button>
            <span />
            {barBlock && pendingRows.length > 0 && (
              <div className="qt-bar-warn" role="alert" data-testid="qt-bar-pending">{isHebrew ? 'השורה עדיין לא נוספה. לחצו ״הוספה״ או ״ניקוי השורה״ לפני המעבר.' : 'The row was not added yet. Click "Add" or "Clear" before moving on.'}</div>
            )}
            {/* the editor's message line (the sketch's toast: "השורה נוספה להצעה. ביטול הפעולה האחרונה") sits right above the bar */}
            <div className="qt-status-slot" data-testid="qt-status-slot" />
          </div>
        </div>
        {summaryOpen && (
          <div className="qt-ov" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummaryOpen(false); }}>
            <div className="qt-dlg" role="dialog" aria-modal="true" aria-label={isHebrew ? 'סיכום ההצעה' : 'Quote summary'} data-testid="qt-summary-panel">
              <h3>{isHebrew ? 'סיכום ההצעה' : 'Quote summary'}</h3>
              <section className="sq-summary" data-testid="sq-summary" dir={isHebrew ? 'rtl' : 'ltr'}>
                {/* one amount column (IRON-NUMERIC-001): every amount ends on the same right edge */}
                <div className="qt-tgrid">
                  {totalRows.map(([k, label, value]) => <Fragment key={k}><span>{label}</span>{value}</Fragment>)}
                  {partialMark}
                  <span className="qt-tsep" />
                  <div data-testid="sq-save-total" className="qt-tgrid-total"><span>{totalLabel}</span>{money(totalAmount)}</div>
                </div>
              </section>
              <div className="qt-dlg-acts">{/* PRODUCT_TRUTH_DECORATIVE: closes the quote summary window */}<button type="button" className="qt-btn" onClick={() => setSummaryOpen(false)}>{isHebrew ? 'סגירה' : 'Close'}</button></div>
            </div>
          </div>
        )}
        </>)}
      </form>
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
