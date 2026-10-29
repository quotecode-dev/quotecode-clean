import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { invokeWithFreshSession } from '../shared/invokeWithFreshSession';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { financialsMatchingStored } from '../utils/storedQuoteFinancials';
import { formatAddress } from '../utils/addressFormat';
import { formatMoney, formatWholeMoney } from '../utils/money';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip, Phone, Printer, MessageCircle, Loader2 } from 'lucide-react';
import { QuoteMediaRail, QuoteMediaHero, QuoteItemThumb } from '../quoteDocument/QuoteMedia';
import { mediaForItem } from '../quoteDocument/quoteMediaModel';
import { normalizeStyleId, styleSupportsImages, DEFAULT_QUOTE_STYLE } from '../quoteDocument/quoteStyles';
import '../quoteDocument/quoteDocument.css';
// Task 16 round 4: narrow-screen item rows (owned separately from quoteDocument.css; loaded after it).
import '../quoteDocument/narrowItems.css';
import PdfFileIcon from '../components/PdfFileIcon';
import QuotePrintModeModal from '../components/QuotePrintModeModal';
import { formatQuoteFallback, formatQuoteNumber } from '../utils/quoteNumber';
import { generateQuotePdf, buildQuotePdfFilename } from '../utils/generateQuotePdf';
import { classifyQuoteApprovalError } from '../utils/quoteApprovalErrorClassification';
import { resolveQuoteExpired } from '../utils/quoteValidity';
import { isUnfinishedSavedQuote, missingPriceOutputNotice, publicItemsForNotice } from '../utils/quoteCompleteness';
import { getActiveQuantity, getProfessionalUnitLabel, formatMeasurementLine } from '../utils/professionalQuoteItem';
import { buildCustomerPresentationModel } from '../utils/quotePresentationModel';
import { formatDeviceShortDateTime } from '../utils/shortDate';
import { outputGate, authorizeWithNotice, outputBlockedMessage } from '../domain/subscriptions/outputAuthority';
import PublicThanksNotice from '../components/PublicThanksNotice';
import { useAmountAxis } from '../quoteDocument/useAmountAxis';
import { openAttachmentFresh } from '../utils/freshAttachmentLink';
import { askConfirm, showNotice } from '../components/AppDialog';

// חוק ברזל (תיקון בעלים - עיגול שקל שלם ל"סה"כ לתשלום", עקבי חשבונאית
// ולא רק תצוגתי): קובץ זה הוא Local/ILS בלעדית (currencySymbol קבוע ל-₪
// למעלה, SmartPublicQuote כבר מנתב הצעות Local בלבד לכאן) - אין צורך
// בתנאי שוק כאן בכלל, בניגוד ל-PublicQuoteEn.jsx שאסור לגעת בו. גרסה
// קודמת עיגלה רק את הסה"כ המוצג והשאירה נטו/מע"מ לא-מעוגלים - הבעלים
// דרש שהסכום יסגור בדיוק (נטו+מע"מ המוצגים = הסה"כ המעוגל, לא רק
// שהסה"כ עצמו יהיה שלם). ר' finalTotalRounded/netAmountDisplay/
// vatAmountDisplay למטה למימוש המדויק - Math.round (לא floor/ceil) נבחר
// לעיגול הסה"כ: 2505.49→2505, 2505.50→2506, 2505.51→2506.
//
// עדכון 2026-08-28 (Cross-Market Regression Audit): formatNum כאן היה
// שכפול פרטי, זהה-לגמרי-בפועל, של formatMoney הקנוני (utils/money.js) -
// Dashboard.jsx ו-PublicQuoteEn.jsx כבר אוחדו לקרוא ל-formatMoney, קובץ
// זה לבדו נשאר מאחור. formatNum כאן משמש אך ורק כשכבת-תצוגה (2 ספרות
// אחרי הנקודה) על ערכים שכבר עברו עיגול-שקל-שלם למעלה (finalTotalRounded
// וכו') - הוא עצמו לעולם לא מעגל בפועל, בדיוק כמו formatMoney - כך שהחלפה
// לקריאה ל-formatMoney אינה משנה שום התנהגות עיגול קיימת, רק מסירה שכפול.
const formatNum = (val) => formatMoney(val);
// A QUANTITY is not money: keep every stored decimal (3.375 m2 stays 3.375, never 3.38) - at least 2 decimals so an
// area quantity keeps its approved look (3.40 m2). Display only; the stored / calculated value is untouched.
// Item-table money strings of this length (symbol included, e.g. '₪98,765.00') switch the narrow-screen table to the
// content-aware layout (see wideAmounts).
const WIDE_AMOUNT_CHARS = 10;
const formatQty = (val) => {
  const n = Number(val || 0);
  try {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  } catch {
    return String(n);
  }
};


// חוק ברזל (Public Quote Section-Level Smart Dropdown task, supersedes the
// old orderPublicItemsByGroup/global-dropdown design entirely): one quote-
// level dropdown is now WRONG per the Owner's own correction - each real
// section/room is its own independently-collapsible commercial unit. Still
// a thin wrapper around buildCustomerPresentationModel (quotePresentationModel
// .js) - the one grouping/subtotal source QuoteForm.jsx's editor also builds
// on - never a second independent grouping formula. Returns [] for a flat
// (non-divided) quote - callers fall back to the plain classic table in
// that case (§9: "do NOT invent fake sections"). Unassigned items (real
// items with no section) are folded into one pseudo-section using the
// EXISTING canonical label QuoteForm.jsx already uses for this exact bucket
// (`section: { key: '__unassigned__', name: 'לא משויך' }`, QuoteForm.jsx
// ~line 1100) - not an invented room name. Its subtotal formula matches
// DividedQuoteUnits.jsx's own identical unassigned-subtotal reduce (line
// ~425) - same authoritative data, not a third independent calculation.
function buildDisplaySections(items, sections) {
  const model = buildCustomerPresentationModel(items, sections);
  if (!model.isDivided) return [];
  const display = model.units
    .filter((u) => u.itemCount > 0)
    .map((u) => ({ key: u.key ?? u.id, title: u.title, items: u.items, subtotal: u.subtotal }));
  if (model.unassignedItems.length > 0) {
    const subtotal = model.unassignedItems.reduce((sum, it) => sum + Number(it.total_price ?? (Number(it.quantity || 1) * Number(it.price || 0))), 0);
    display.push({ key: '__unassigned__', title: 'לא משויך', items: model.unassignedItems, subtotal });
  }
  return display;
}

// Task 16: the same "every section open / every section closed" map the print chooser applies, reusable for an
// externally-driven detail level (creator preview / sample route).
function allSectionsMap(items, sections, open) {
  const map = {};
  buildDisplaySections(items, sections).forEach((s) => { map[s.key] = open; });
  return map;
}

const formatDisplayPhone = (phone) => {
  if (!phone) return '';
  let clean = phone.trim();
  if (clean.startsWith('+972')) {
    clean = '0' + clean.slice(4).replace(/\D/g, '');
  } else if (clean.startsWith('972')) {
    clean = '0' + clean.slice(3).replace(/\D/g, '');
  } else if (!clean.startsWith('0') && clean.length === 9) {
    clean = '0' + clean;
  }

  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 9) {
    const prefix = digits.startsWith('03') || digits.startsWith('02') || digits.startsWith('04') || digits.startsWith('08') || digits.startsWith('09') ? digits.slice(0, 2) : digits.slice(0, 3);
    const rest = digits.slice(prefix.length);
    return `${prefix}-${rest}`;
  }
  return clean;
};

// PRODUCT_TRUTH_CAPABILITY: public_quote_view
// Task 16 (CONTRACT §4): `presentation` = the quote-presentation public_get payload ({ mode, style, branding, media });
// absent / invalid => the legacy Classic composition with live branding and no media. `previewMode` = the creator
// preview / sample route: no approve RPC, no signature pad, no navigation, no network, no global page side effects and
// no print CSS. `detail` ('compact' | 'expanded', optional) drives Compact/Expanded from outside (preview / sample);
// `onApproved` lets SmartPublicQuote re-fetch the (now frozen) presentation after a successful approval.
// `standalonePrint` (previewMode only): the preview IS the whole browser page (the /:lang/sample-quote route, never the
// embedded creator preview), so its native Print uses the same A4 print contract as the public quote (the page print CSS
// and the document's print rules) instead of printing the screen layout (cloud-fix3: footer-only second page).
export default function PublicQuote({ quoteData, presentation = null, previewMode = false, detail = null, onApproved = null, standalonePrint = false, onFinalSnapshot = null, capabilityToken = null, thanks = null }) {
  const navigate = useNavigate();
  const { quote, business, client, items, attachments, sections: quoteSections } = quoteData;
  // Owner 2026-10-23 (typed L-09..L-27): an attachment link older than 4 minutes is re-read on click (utils/freshAttachmentLink.js)
  const attachmentsLoadedAtRef = useRef(Date.now());
  const reloadAttachments = previewMode ? null : async () => {
    const { data, error } = await supabase.functions.invoke('get-public-quote', { body: capabilityToken ? { capability_token: capabilityToken } : { quote_id: quote?.id } });
    if (error) throw error;
    return data;
  };
  // חוק ברזל (Public Quote Section-Level Smart Dropdown task, §9 - "if a
  // quote has no section/room hierarchy, keep the normal classic commercial
  // table, do NOT invent fake sections"): [] for a flat quote - every
  // rendering/state decision below branches on displaySections.length, never
  // on whether individual items happen to be professional. quoteData.items/
  // quoteSections are fixed props (not state), safe to recompute every render.
  const displaySections = buildDisplaySections(items, quoteSections);
  // Task 16: the document detail level. An explicit `detail` prop wins; in previewMode the creator preview may pass it
  // as presentation.detail. A public page without either keeps its existing default (Compact).
  const presentationDetail = previewMode && (presentation?.detail === 'compact' || presentation?.detail === 'expanded') ? presentation.detail : null;
  const docDetail = detail === 'compact' || detail === 'expanded' ? detail : presentationDetail;
  const [approved, setApproved] = useState(quote.status === 'approved' || Boolean(quote.signature));
  const [signatureWarning, setSignatureWarning] = useState(false);
  const [approveToast, setApproveToast] = useState(null);
  // חוק ברזל (Public Quote Section-Level Smart Dropdown task, supersedes the
  // old single global smartDetailsExpanded boolean below): the Owner
  // corrected the presentation contract AGAIN - disclosure is owned per
  // SECTION, not per quote and not per item. Keyed by section key
  // (`__unassigned__` for the unassigned pseudo-section); a real section id
  // never collides with it. Each section defaults to collapsed
  // (`!!expandedSections[key]` is false until explicitly toggled) and
  // expands fully independently of every other section - no accordion
  // coupling, matching §4's own explicit requirement.
  const [expandedSections, setExpandedSections] = useState(() => (docDetail === 'expanded' ? allSectionsMap(items, quoteSections, true) : {}));
  // Item-table semantics (cloud-fix4b, A12): a per-instance id prefix for the column headers, so every body cell names
  // its own header (headers="<th id>") - unique even when two documents share a page.
  const tableUid = useId();
  const colId = (key) => `${tableUid}-col-${key}`;
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // חוק ברזל (Owner-Approved Signature Record Improvement - audit-verified
  // gap): quotes.signature (data URL) הוא עמודת-החתימה היחידה שקיימת בפועל -
  // אין signed_at, אין signer_name, אין שום עמודת-timestamp-אחרת על quotes
  // (נבדק ישירות במיגרציות). לכן "מי חתם ומתי" לא ניתן לשחזור אמין בסבב-
  // צפייה נפרד/עתידי בלי migration (מחוץ לתחום המשימה הנוכחית). מה שכן בטוח
  // וללא-migration: לתפוס שם-חותם *מאושר-במפורש-ע"י-החותם עצמו* (לא recipient/
  // attn_name שהעסק הזין, בלי אישור) ברגע החתימה הזה עצמו, ולהציג אותו +
  // חותמת-זמן-צד-לקוח יחד עם התמונה - נכון ומדויק אך ורק לאורך חיי-הטעינה
  // הנוכחיים של הדף (state React רגיל, לא persisted).
  const [signerName, setSignerName] = useState(quote.attn_name || '');
  const [signerCompany, setSignerCompany] = useState(client?.company_name || '');
  const [signerRole, setSignerRole] = useState(quote.attn_role || '');
  const [signerNameWarning, setSignerNameWarning] = useState(false);
  const [justSignedAt, setJustSignedAt] = useState(null);
  const [justSignedImageDataUrl, setJustSignedImageDataUrl] = useState(null);
  const isBusinessCustomer = quote.client_type === 'business';

  // חוק ברזל (Public Quote PDF/Print UX task): printMode/printModalOpen/
  // printIntent/pdfGenerating הם state UI-מקומי-בלבד, אף פעם לא נשלחים
  // לשרת. "הורד PDF" ו"הדפס מסמך" בעבר שתיהן קראו בפועל ל-window.print()
  // בלבד - "הורדת PDF" מעולם לא הייתה הורדה אמיתית. עכשיו שני המסלולים
  // נפרדים: printIntent==='print' ממשיך להפעיל אך ורק window.print()
  // (בלתי נגוע); printIntent==='pdf' קורא ל-generateQuotePdf האמיתי
  // (html2canvas+jsPDF) ולעולם לא ל-window.print().
  // חוק ברזל (Final Public Quote Restoration task - "DEFAULT PUBLIC QUOTE
  // STATE - HARD LOCK", supersedes the old Locked Decision 11): הבעלים
  // תיקן במפורש - הצעה מחולקת חייבת להיפתח עם כל היחידות מכווצות (שם +
  // סה"כ בלבד, בדיוק כמו Compact), לא Expanded. "Expanded" כ-mode נשאר
  // קיים ומלא בתפקידו רק כבחירה מפורשת בתצוגת-הדפסה/PDF (QuotePrintModeModal)
  // - אף פעם לא ברירת-המחדל של הפתיחה הרגילה. הצעה רגילה ממשיכה עם
  // compact, זהה-בייט להתנהגות הקודמת.
  const [printMode, setPrintMode] = useState(docDetail === 'expanded' ? 'expanded' : 'compact');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printIntent, setPrintIntent] = useState('print');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const cardRef = useRef(null);
  // IRON-NUMERIC-001: the totals share the table Amount column's axis on screen (Owner 2026-10-18)
  useAmountAxis(cardRef);

  // Task 16 previewMode: the creator preview frame is a container (e.g. 390px "mobile" mode inside a desktop
  // viewport), so the letterhead's viewport matchMedia branch cannot see it - follow the card's own width instead.
  const [previewCompactHeader, setPreviewCompactHeader] = useState(false);
  useEffect(() => {
    if (!previewMode || !cardRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const el = cardRef.current;
    // cloud-fix4 (A13, ledger D24): under PRINT the card is laid out at the A4 width (718px) - that is not a narrow
    // preview frame, so the letterhead keeps the branch it had on screen (no print-only compact / smaller title).
    const printing = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('print').matches;
    const measure = () => { if (!printing()) setPreviewCompactHeader(el.getBoundingClientRect().width <= 768); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewMode]);

  // Task 16: an externally-driven detail level re-applies the same one-time open/closed choice the print chooser makes.
  useEffect(() => {
    if (docDetail !== 'compact' && docDetail !== 'expanded') return;
    setPrintMode(docDetail);
    setExpandedSections(allSectionsMap(items, quoteSections, docDetail === 'expanded'));
    // items/quoteSections are fixed props of one quote; only an explicit detail change re-applies the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docDetail]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintModalOpen(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const openPrintChooser = (intent) => {
    setPrintIntent(intent);
    setPrintModalOpen(true);
  };

  // חוק ברזל (Public Quote Section-Level Smart Dropdown task, §12 - "Compact
  // = every section in its collapsed commercial-summary form. Expanded =
  // every section's summary PLUS its full Smart detail"): sets every real
  // section (+ the unassigned pseudo-section, if any) to the same open/
  // closed state at once, at the moment of explicit choice - not a
  // continuous binding, so a manual on-screen per-section toggle afterward
  // is never fought by this effect (same "one-time set" pattern the old
  // per-item version used).
  const handleChooseOutputMode = async (mode) => {
    setPrintMode(mode);
    setExpandedSections(allSectionsMap(items, quoteSections, mode === 'expanded'));
    setPrintModalOpen(false);
    // OD-02: the ONE output-authority gate for final Print / final PDF. The phase comes from the SERVER (get-public-quote):
    // a capability-URL viewer prints the already-finalized artifact; the verified owner in the enforced phase must obtain
    // a server authorization (first client output consumes once) and prints the finalized snapshot fetched with the
    // short-lived grant; every other viewer is on the unchanged legacy path (when enforced, only pre-cutover quotes are
    // served to them at all).
    const finalChannel = printIntent === 'print' ? 'final_print' : 'final_pdf';
    // Task 35 (F4): the verified owner is told about lines without a price (and the partial total) before a final PDF / print;
    // cancel = nothing is authorized or printed. The flag reaches this page only once get-public-quote returns price_missing.
    // Codex release 1 (Owner 2026-10-29, typed: "מאשר שחרור 1 של קודקס עכשיו: שער ההפקה למחיר חסר בכל פלט חדש כולל שליחה חוזרת ...", L-24): no product print / PDF of a quote with a line
    // without a price for ANY viewer - the existing quote stays viewable (a browser's own print cannot be blocked)
    if (quoteData.viewerIsOwner !== true && missingPriceOutputNotice(quote, { isHebrew: true, items: publicItemsForNotice(items) })) {
      setApproveToast({ type: 'error', message: 'אפשר לצפות בהצעה הקיימת. להפקת מסמך מלא, בקשו מהעסק הצעה מעודכנת עם כל המחירים.' });
      return;
    }
    if (quoteData.viewerIsOwner === true) {
      const notice = missingPriceOutputNotice(quote, { isHebrew: true, items: publicItemsForNotice(items) });
      if (notice && notice.blocked) { setApproveToast({ type: 'error', message: notice.text }); return; }
      if (notice && !(await askConfirm(notice.text, true))) return;
    }
    const serverPhase = quoteData.capability ? 'off' : (quoteData.viewerIsOwner === true ? (quoteData.outputPhase || 'off') : 'off');
    const gate = outputGate(finalChannel, serverPhase);
    if (gate.mode === 'authority_required') {
      const auth = await authorizeWithNotice({ channel: finalChannel, quoteId: quote.id, invoke: (name, opts) => invokeWithFreshSession(name, opts), confirm: (text) => askConfirm(text, true), isHebrew: true });
      const snap = auth.proceed
        ? await supabase.functions.invoke('get-public-quote', { body: { output_grant: auth.grant, channel: finalChannel } })
        : null;
      if (!auth.proceed || snap?.error || !snap?.data?.quote || !onFinalSnapshot) {
        if (auth.mode === 'cancelled') return;
        setApproveToast({ type: 'error', message: outputBlockedMessage(auth.proceed ? 'final_response_invalid' : auth.code, true) });
        return;
      }
      onFinalSnapshot(snap.data);
      await new Promise((resolve) => setTimeout(resolve, 80));
    } else if (!gate.proceed) return;

    if (printIntent === 'print') {
      // PRODUCT_TRUTH_CAPABILITY: quote_print
      setTimeout(() => window.print(), 50);
      return;
    }

    if (pdfGenerating) return; // הגנה מפני לחיצה כפולה
    setPdfGenerating(true);
    try {
      // ה-class .pq-pdf-capturing (ר' <style> למטה) חייב להיות מוחל ו-DOM
      // חייב להספיק לצייר-מחדש (reflow) לפני שה-canvas נלכד - setTimeout
      // (לא rAF כפול, שנתקע בטאב לא-פעיל) נותן frame אמיתי אחד לדפדפן.
      await new Promise((resolve) => setTimeout(resolve, 80));
      const filename = buildQuotePdfFilename(formatQuoteNumber(quote.quote_number));
      await generateQuotePdf({ captureEl: cardRef.current, filename });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setApproveToast({ type: 'error', message: 'לא הצלחנו להפיק את קובץ ה-PDF. נסו שוב בעוד רגע.' });
    } finally {
      setPdfGenerating(false);
    }
  };

  const { canvasRef, hasSigned, isActive, activateSigning, deactivateSigning, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

  // ההתראה המקומית "יש לחתום" נעלמת אוטומטית ברגע שיש חתימה תקפה בקנבס
  useEffect(() => {
    if (hasSigned) setSignatureWarning(false);
  }, [hasSigned]);

  useEffect(() => {
    if (signerName.trim()) setSignerNameWarning(false);
  }, [signerName]);

  useEffect(() => {
    // Task 16 previewMode: embedded in the dashboard / sample route - never touch the host document (title, robots,
    // lang/dir). The sample route sets its own noindex/title.
    if (previewMode) return;
    document.title = "TEKANGO - הצעת מחיר דיגיטלית";

    // חוק ברזל: דף הצעת מחיר ציבורי מכיל נתוני לקוח/עסק ספציפיים ולעולם
    // אסור שייכנס לאינדקס של גוגל. ר' הגנה מקבילה ב-vercel.json
    // (X-Robots-Tag) וב-robots.txt - זהו רק שכבת ההגנה בצד הלקוח.
    let robotsTag = document.querySelector('meta[name="robots"]');
    if (!robotsTag) {
      robotsTag = document.createElement('meta');
      robotsTag.name = 'robots';
      document.head.appendChild(robotsTag);
    }
    robotsTag.setAttribute('content', 'noindex, nofollow');

    // עמוד זה תמיד מציג תוכן עברי/RTL - ללא קשר לבאנדל (Local/Global)
    // שממנו הגיע (ר' PublicQuoteEn.jsx). זיהוי השפה/המטבע נעשה כעת פעם
    // אחת בלבד ב-SmartPublicQuote, שמעביר את הרכיב הנכון כבר מהתחלה.
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
  }, [previewMode]);

  // OD-1: an expired quote stays viewable but cannot be accepted. This page is the Local (HE/ILS) market, so the validity
  // day ends in Asia/Jerusalem (server truth `is_expired` wins when get-public-quote provides it). The stored date is never changed.
  const isExpired = resolveQuoteExpired(quote, 'Local');
  // SMART-QUOTE-01: an unfinished draft never masquerades as a customer-ready quote (screen, print, PDF) and cannot be signed.
  const isUnfinishedDraft = isUnfinishedSavedQuote(quote, items);

  // PRODUCT_TRUTH_CAPABILITY: public_quote_sign
  const handleApprove = async () => {
    if (previewMode) return; // Task 16: a preview never approves (no RPC, no network).
    if (isExpired) {
      setApproveToast({ type: 'error', message: classifyQuoteApprovalError('Quote expired', true).userMessage });
      return;
    }
    if (isUnfinishedDraft) return;
    let blocked = false;
    if (!signerName.trim()) {
      setSignerNameWarning(true);
      blocked = true;
    }
    if (!hasSigned) {
      setSignatureWarning(true);
      blocked = true;
    }
    if (blocked) return;

    try {
      // חוק ברזל: ה-RPC עצמו (public_approve_quote) נשאר בלתי-נגוע לגמרי -
      // עדיין מקבל רק p_quote_id/p_signature_data_url בדיוק כמו היום.
      // signerName/Company/Role נשארים ב-state הצד-לקוח בלבד לתצוגה מיידית -
      // לא נשלחים לשרת.
      const signatureDataUrl = getSignatureDataUrl();
      // OD-02: approval/signature use the same artifact as the link. On the capability route the server resolves the token
      // (op 'approve'); the quote id alone authorizes nothing there. Legacy links keep the id RPC (guarded server-side).
      // Owner 2026-10-25 (typed L-24): sign AND store who signed (name; company and role for a business customer) in one server call;
      // a server without the new functions yet (the database is updated first) falls back to the former call
      const signer = { p_signer_name: signerName.trim(), p_signer_company: isBusinessCustomer ? (signerCompany.trim() || null) : null,
        p_signer_role: isBusinessCustomer ? (signerRole.trim() || null) : null };
      let { error } = capabilityToken
        ? await supabase.rpc('public_approve_quote_capability_signed', { p_token: capabilityToken, p_signature_data_url: signatureDataUrl, ...signer })
        : await supabase.rpc('public_approve_quote_signed', { p_quote_id: quote.id, p_signature_data_url: signatureDataUrl, ...signer });
      if (error && (error.code === 'PGRST202' || /could not find the function/i.test(String(error.message || '')))) {
        ({ error } = capabilityToken
          ? await supabase.rpc('public_approve_quote_capability', { p_token: capabilityToken, p_signature_data_url: signatureDataUrl })
          : await supabase.rpc('public_approve_quote', { p_quote_id: quote.id, p_signature_data_url: signatureDataUrl }));
      }

      if (error) throw error;
      // חוק ברזל (Owner-Approved Signature Record Improvement): quote.signature
      // הוא prop סטטי מטעינת-הדף הראשונית (SmartPublicQuote.jsx, fetch יחיד,
      // לעולם לא מרוענן אחרי RPC) - שומרים את ה-data URL שכבר חושב ברגע הזה
      // עצמו (אותם בייטים בדיוק שנשלחו לשרת) ב-state מקומי לתצוגה מיידית.
      setJustSignedImageDataUrl(signatureDataUrl);
      setJustSignedAt(new Date());
      setApproved(true);
      // Task 16: the server freezes the presentation snapshot once the quote is locked - let the host re-fetch it.
      if (typeof onApproved === 'function') onApproved();
    } catch (err) {
      // הפרטים הטכניים/מסד הנתונים נשארים ב-console בלבד - הלקוח הציבורי
      // רואה הודעה בטוחה וספציפית (classifyQuoteApprovalError), לא raw
      // error.message. הבלוק היחיד שה-RPC חוסם כעת הוא הבעלים המדויק של
      // ההצעה הזו (public_approve_quote, 20260909000000) - חשבון עסקי אחר
      // מותר לו לחתום כלקוח לגיטימי.
      console.error('Error approving quote:', err);
      const { userMessage } = classifyQuoteApprovalError(err?.message, true);
      setApproveToast({ type: 'error', message: userMessage });
    }
  };

  const isHebrew = true;
  const currencySymbol = '₪';
  // שיעור המע"מ נגזר מנתוני ההצעה השמורים (tax_rate) ולא קבוע קשיח - כך שהתעריף
  // שהוצג/הוסכם בעת יצירת ההצעה הוא זה שיוצג גם בקישור הציבורי, גם אם ברירת המחדל תשתנה בעתיד
  const vatRate = (quote.tax_rate !== undefined && quote.tax_rate !== null && Number.isFinite(Number(quote.tax_rate)) && Number(quote.tax_rate) >= 0)
    ? Number(quote.tax_rate)
    : 0.18;

  let parsedItems = [];
  try {
    if (typeof quote.items === 'string') {
      parsedItems = JSON.parse(quote.items);
    } else if (Array.isArray(quote.items)) {
      parsedItems = quote.items;
    }
  } catch {
    parsedItems = [];
  }

  const dbTotal = Number(quote.total || 0);
  const calculatedSubtotalFromItems = parsedItems.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);

  const resolvedSubtotal = quote.subtotal
    ? Number(quote.subtotal)
    : (calculatedSubtotalFromItems > 0 ? calculatedSubtotalFromItems : (dbTotal > 0 ? dbTotal / (1 + vatRate) : 0));

  // נקודת אמת אחת: אותה calculateQuoteFinancials ששימשה בזמן השמירה (Step 1-3)
  // מחושבת כאן מחדש מהנתונים השמורים (subtotal/discount/tax_rate) - "פריט"
  // סינתטי יחיד ששוויו resolvedSubtotal מזין את הפונקציה בדיוק כמו שהיה
  // מוזן subtotal אמיתי, בלי לשכפל נוסחת מע"מ עצמאית כאן ובלי להסתמך על
  // recompute מהפריטים (שעלול לסטות מהערך השמור).
  // Owner 2026-10-23: the same IRON-ILS-001 rounding as the editor (an old shekel quote keeps its stored amounts - storedQuoteFinancials.js)
  const financials = financialsMatchingStored({
    country: 'Local',
    currency: quote.currency,
    clientType: quote.client_type,
    items: [{ quantity: 1, unit_price: resolvedSubtotal }],
    discount: quote.discount,
    taxRateOverride: vatRate,
  }, quote.total);

  const isAmbiguousClientType = financials.clientTypeAmbiguous;
  const isPrivateDisplay = !isAmbiguousClientType && quote.client_type === 'private';

  // חוק ברזל §6: client_type חסר/לא-מזוהה על הצעה מקומית - לעולם לא מנחשים
  // Business ולא Private, ולעולם לא מציגים ללקוח פירוט מע"מ (מחושב/מוסף/כלול)
  // שמבוסס על ניחוש כזה. במצב הזה מציגים אך ורק ערכים אמינים ששמורים כבר
  // בהצעה עצמה ושאינם דורשים כל פרשנות Business/Private: subtotal, discount
  // ו-total השמורים - בלי netAmount/vatAmount מחושבים (ה-JSX למטה פשוט לא
  // מרנדר שורת מע"מ/נטו כלל כש-isAmbiguousClientType===true).
  const subtotal = isAmbiguousClientType ? resolvedSubtotal : financials.enteredSubtotal;
  const discountAmountDisplay = isAmbiguousClientType
    ? (resolvedSubtotal * (Number(quote.discount || 0) / 100))
    : financials.discountAmount;
  const netAmount = financials.netAmount;
  const total = dbTotal > 0 ? dbTotal : (isAmbiguousClientType ? (subtotal - discountAmountDisplay) : financials.total);

  // חוק ברזל (תיקון בעלים - עיגול שקל שלם, עקבי חשבונאית לא רק תצוגתי):
  // total מעוגל תחילה לשקל שלם - זהו הערך המוצג כ"סה"כ לתשלום" (finalTotalRounded).
  // בניגוד לגרסה הקודמת (עיגול הסה"כ בלבד, נטו/מע"מ נשארו לא-מעוגלים
  // ולא הסתכמו בדיוק ל-Total המוצג) - כאן הצד ה"גמיש" (התלוי, לא הראשי)
  // של נטו/מע"מ מחושב מחדש מה-total המעוגל, כך שנטו+מע"מ המוצגים
  // מסתכמים בדיוק ל-finalTotalRounded עד האגורה, בדיוק כמו שהבעלים דרש:
  //   Private (ברוטו כולל מע"מ הוא הראשי - ר' calculateQuoteFinancials):
  //     netAmountDisplay = finalTotalRounded / 1.18 (מעוגל לאגורות),
  //     vatAmountDisplay = finalTotalRounded - netAmountDisplay (השארית
  //     המדויקת, לא 18% טהור - כך הסכום תמיד סוגר בדיוק).
  //   Business (נטו הוא הראשי - הסכום שהוזן בפועל לפני מע"מ, לא משתנה):
  //     netAmountDisplay נשאר net האמיתי שהוזן, ללא שינוי; vatAmountDisplay
  //     מחושב כשארית (finalTotalRounded - net) במקום net*18% הטהור, כדי
  //     שהסכום יסגור בדיוק בלי לגעת בסכום הנטו שהוזן בפועל.
  // חשוב: זו התאמת *תצוגה* בלבד ב-Public Quote - quotes.total השמור
  // במסד הנתונים ולוגיקת החישוב/השמירה ב-Dashboard.jsx (יצירה/עריכה)
  // אינם משתנים כלל על ידי זה.
  const finalTotalRounded = !isAmbiguousClientType ? Math.round(total) : total;
  const netAmountDisplay = isPrivateDisplay
    ? Math.round((finalTotalRounded / (1 + vatRate)) * 100) / 100
    : netAmount;

  // חוק ברזל (Urgent Money Format Correction task - הרחבה מפורשת-בעלים של
  // "עגל לשקל שלם, הצג עם שתי ספרות" לקופסת-הסה"כ למטה: סיכום-ביניים/מע"מ/
  // סה"כ סופי - לא רק לכרטיסי-הפריט/יחידה בהצעה מחולקת). netAmountDisplay/
  // finalTotalRounded למעלה *לא* נגעו - "do not change pricing calculations".
  // vatAmountDisplay המדויק-לאגורה (finalTotalRounded - netAmountDisplay)
  // הוסר - לא היה עוד קורא אחריו ברגע שהתצוגה עברה למשתני-*WholeDisplay
  // למטה, שמשתמשים באותה שיטת-שארית בדיוק, רק ברמת-השלם: netAmountWholeDisplay
  // מעוגל-לשלם באופן עצמאי; vatAmountWholeDisplay הוא תמיד השארית
  // (finalTotalWholeDisplay - netAmountWholeDisplay), לעולם לא מעוגל בנפרד -
  // כך נטו+מע"מ המוצגים תמיד מסתכמים בדיוק לסה"כ המוצג, גם ברמת-השלם, בדיוק
  // כמו שהבעלים דרש במקור לרמת-האגורה. subtotalWholeDisplay/
  // discountWholeDisplay מעוגלים עצמאית - אינם חלק ממשולש הסגירה-המדויקת
  // (subtotal/discount אינם מוצגים יחד עם net+vat+total באותה שורת-בדיקה),
  // רק לעקביות חזותית בתוך אותה קופסת-סכומים.
  const finalTotalWholeDisplay = Math.round(Number(finalTotalRounded || 0));
  const netAmountWholeDisplay = Math.round(Number(netAmountDisplay || 0));
  const vatAmountWholeDisplay = finalTotalWholeDisplay - netAmountWholeDisplay;
  const subtotalWholeDisplay = Math.round(Number(subtotal || 0));
  const discountWholeDisplay = Math.round(Number(discountAmountDisplay || 0));

  // Task 16 presentation (CONTRACT §3 public_get). Anything unexpected => legacy Classic, live branding, no media.
  // An ISSUED snapshot's frozen branding overrides the live business fields, so later profile edits never restyle it.
  const docStyle = normalizeStyleId(presentation?.style) || DEFAULT_QUOTE_STYLE;
  const issuedBranding = presentation?.mode === 'issued' && presentation?.branding && typeof presentation.branding === 'object' ? presentation.branding : null;
  // Subscriptions (continuation C): a capability / grant document IS the immutable issued snapshot; its business block (from
  // get-public-quote, incl. the read-back verified logo of the bound asset) is authoritative - presentation branding never
  // overrides it (an issuer/v2 snapshot carries the logo as an asset, not as a URL the presentation layer could repeat).
  // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #25: the business details shown (name, logo, phone, email, address) are the LIVE business settings again, as before the
  // new interface; an issued snapshot only fills a field the live settings do not have.
  const liveBusiness = Object.fromEntries(Object.entries(business || {}).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  const brand = { ...(issuedBranding || {}), ...liveBusiness };
  const docMedia = styleSupportsImages(docStyle) && Array.isArray(presentation?.media) ? presentation.media.filter((m) => m && typeof m === 'object') : [];
  // Rail / hero show the project & product images; row-bound 'item' images appear as row thumbnails instead.
  const showcaseMedia = docMedia.filter((m) => m.role !== 'item');
  const showItemThumbs = docMedia.length > 0;

  const bizName = brand.business_name || 'עסק ישראלי';
  const bizLogo = brand.logo_url;
  const bizTaxId = brand.tax_id;
  const bizEmail = brand.email;
  const bizPhone = formatDisplayPhone(brand.phone);
  const bizAddress = brand.address;

  const clientPhoneFormatted = formatDisplayPhone(client?.phone);
  const isOwnerViewing = quote.is_owner_viewing;
  const displayTerms = quote.terms;

  // חוק ברזל (Public Quote Redesign - WhatsApp contact action): אותה
  // נורמליזציית-טלפון בדיוק (00→+, 0 מקומי→+972, ספרות-בלבד→+) כמו
  // sendWhatsApp הקיים כבר ב-Dashboard.jsx - לא נוסחה עצמאית שנייה. הודעה
  // קצרה עם מספר ההצעה - הצופה בעמוד הוא הלקוח עצמו, לא שולח-בשם-העסק.
  // PRODUCT_TRUTH_CAPABILITY: public_whatsapp_contact
  const bizWhatsAppHref = (() => {
    const raw = brand.phone ? String(brand.phone).trim() : '';
    if (!raw) return null;
    let clean = raw.replace(/[^\d+]/g, '');
    if (clean.startsWith('00')) clean = '+' + clean.slice(2);
    else if (clean.startsWith('0') && !clean.startsWith('00')) clean = '+972' + clean.slice(1);
    else if (/^\d{9,15}$/.test(clean)) clean = '+' + clean;
    const phoneForUrl = clean.replace('+', '');
    if (!phoneForUrl) return null;
    const numberDisplay = formatQuoteFallback(quote);
    const text = `שלום, יש לי שאלה לגבי הצעת המחיר מספר ${numberDisplay}.`;
    return `https://wa.me/${phoneForUrl}?text=${encodeURIComponent(text)}`;
  })();

  // ---------------------------------------------------------------------------------------------------------------
  // Task 16 - document / action separation (CONTRACT §4). `.pq-card` (cardRef) is the ONLY capture root for Direct PDF
  // and the printed document: letterhead, parties, media, the four-column table, totals, terms/notes, the read-only
  // approval/status record and the document footer. The action tiles (PDF / Print / Call / WhatsApp) are app UI that
  // render INSIDE the card on screen (ledger D21a: base c65f742 position, in the end-of-document group above the footer)
  // and never reach an output: .no-print removes them from native Print, data-html2canvas-ignore + `.pq-pdf-capturing
  // .no-print` remove them from the Direct PDF capture. The print-mode chooser, the signature INPUT pad and the
  // owner/admin/preview notices render as siblings OUTSIDE the card (.no-print as well).
  // ---------------------------------------------------------------------------------------------------------------
  const quoteNumberDisplay = formatQuoteNumber(quote.quote_number) || formatQuoteFallback(quote);

  // Smart/Professional detail lines of one item (same content the section-expanded rows always showed).
  const renderItemDetailLines = (item, withQuantityLine) => {
    const isPro = Boolean(item.pricing_unit);
    const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : Number(item.quantity || 1);
    const unitLabel = isPro ? getProfessionalUnitLabel(item.pricing_unit, true) : '';
    const measurements = Array.isArray(item.measurements) ? item.measurements : [];
    const specRows = Array.isArray(item.specification) ? item.specification.filter((s) => s.label || s.value) : [];
    return (
      <>
        {withQuantityLine && isPro && (
          <div className="pq-item-detail pq-item-detail-strong">{`כמות: ${formatQty(activeQty)} ${unitLabel}`}</div>
        )}
        {measurements.length > 0 && (
          <div className="pq-item-detail">
            {measurements.map((m, mi) => (
              <div key={mi}>{formatMeasurementLine(m, isHebrew, formatNum)}</div>
            ))}
          </div>
        )}
        {specRows.length > 0 && (
          <div className="pq-item-detail">
            {specRows.map((s, si) => (
              <div key={si}>{s.label}{s.label && s.value ? ': ' : ''}{s.value}</div>
            ))}
          </div>
        )}
      </>
    );
  };

  // Description cell: the item text, optional detail lines, and (Modern/Visual) the row-bound product thumbnail INSIDE
  // the cell - never a fifth column.
  const renderDescriptionCell = (item, detailLines) => {
    const label = item.description || item.name || 'פריט';
    const thumb = showItemThumbs ? mediaForItem(docMedia, item.description) : null;
    if (!thumb) return <>{label}{detailLines}</>;
    return (
      <div className="pq-item-with-thumb">
        <QuoteItemThumb image={thumb} isHebrew={isHebrew} />
        <div className="pq-item-text">{label}{detailLines}</div>
      </div>
    );
  };

  const letterhead = (
    <PublicQuoteHeader
      variant={docStyle}
      approved={approved}
      isHebrew={isHebrew}
      bizLogo={bizLogo}
      bizName={bizName}
      showNameWithLogo={brand.show_name_with_logo === true}
      bizTaxId={bizTaxId}
      bizPhone={bizPhone}
      bizEmail={bizEmail}
      bizAddress={bizAddress}
      quote={quote}
      isExpired={isExpired && !approved}
      compact={previewMode ? previewCompactHeader : (pdfGenerating ? false : undefined)}
    />
  );

  const unfinishedBanner = isUnfinishedDraft ? (
    <div className="pq-unfinished-banner" data-testid="pq-unfinished" role="status" style={{ margin: '12px 16px 0', padding: '10px 14px', borderRadius: '10px', background: '#fff7ed', border: '2px dashed #fb923c', color: '#9a3412', fontWeight: 800, fontSize: '0.92rem', textAlign: 'center' }}>
      טיוטה לא גמורה - זו אינה הצעת מחיר סופית ואין לאשר אותה.
    </div>
  ) : null;

  // Recipient ("לכבוד") + Attn ("לידי"): DOM order drives the RTL placement (recipient right, Attn left); flexWrap drops
  // Attn below on narrow screens. Roles: data-role="client" (the quote's addressee) / data-role="contact" (Attn, only
  // when quote.attn_name exists). Visual treatment restored from the approved base c65f742 (quoteDocument.css
  // .pq-recipient: #faf9fd card, 4px violet inline-start rule, client name 800 in LIGHT.violet).
  const parties = (
    <div className="pq-parties">
      <div className="pq-recipient pq-recipient-client" data-role="client" style={{ textAlign: 'right' }}>
        <div className="pq-recipient-label">
          <UserRound size={13} strokeWidth={2.4} />
          לכבוד:
        </div>
        <div className="pq-recipient-name">{client?.company_name || 'מקבלי ההצעה'}</div>
        <div className="pq-recipient-intro">שלום, הנה הצעת המחיר שהכנו עבורכם:</div>
        {client?.email && <div className="pq-recipient-detail" style={{ direction: 'ltr', textAlign: 'right' }}>{client.email}</div>}
        {clientPhoneFormatted && <div className="pq-recipient-detail" style={{ direction: 'ltr', textAlign: 'right' }}>{clientPhoneFormatted}</div>}
        {client?.address && <div className="pq-recipient-detail">{formatAddress(client.address, true)}</div>}
        {/* Subject (ledger D09, cloud-fix4): back in the recipient card as base c65f742 - dashed rule, violet label. */}
        {quote.subject && (
          <div className="pq-recipient-subject">
            <span className="pq-recipient-subject-label">נושא ההצעה: </span>
            <span className="pq-recipient-subject-value">{quote.subject}</span>
          </div>
        )}
      </div>
      {quote.attn_name && (
        <div className="pq-recipient pq-recipient-contact" data-role="contact" style={{ textAlign: 'right' }}>
          <div className="pq-recipient-label">
            <UserRound size={13} strokeWidth={2.4} />
            לידי:
          </div>
          <div className="pq-recipient-name">{quote.attn_name}</div>
          {quote.attn_role && <div className="pq-recipient-detail">{quote.attn_role}</div>}
        </div>
      )}
    </div>
  );

  // Public Quote Section-Level Smart Dropdown contract (unchanged): a FLAT quote renders the plain four-column table;
  // a quote WITH real sections renders each section as its own independently-collapsible row group (collapsed = one
  // commercial-summary row: item count / "—" / authoritative section subtotal). Column-Geometry Lock: table-layout
  // fixed + ONE explicit <colgroup> is the single column contract for every row shape (the Mobile media query only
  // overrides the same four <col> classes). Every money cell is white-space:nowrap.
  // Owner decision 2026-10-05: local exception to IRON-NUMERIC-001 shared right edge for the three item columns only -
  // Quantity / Unit price / Amount (th + every td, unit and section rows) are physically CENTRED; .pf-money keeps its
  // tabular/lining LTR isolation. The description column stays in language direction; the totals grid keeps the
  // shared right edge.
  // Flat rows (no sections) show the description only, in Compact AND Expanded - base c65f742 / master plan decision 4
  // (Compact/Expanded is professional-detail visibility of SECTION rows only; ledger D26, cloud-fix3).
  // Long amounts (cloud-fix3): when the longest money string of the item table (unit price, line total, section
  // subtotal - as displayed, with the currency symbol) reaches WIDE_AMOUNT_CHARS, the table is marked pq-amounts-wide and
  // on narrow screens (<= 640px / the 640px preview frame) its layout becomes content-aware: the <colgroup> widths stay
  // the preferred geometry, but a money column is never narrower than its value (no clipped / scrolled / hidden digits).
  // A table whose values fit keeps exactly the approved geometry.
  const longestItemMoney = Math.max(0, ...[
    ...(items || []).flatMap((it) => {
      const price = Number(it.price || it.unit_price || 0);
      return [price, Number(it.total_price || (Number(it.quantity || 1) * price))];
    }),
    ...displaySections.map((sec) => Number(sec.subtotal || 0)),
  ].map((v) => `${currencySymbol}${formatWholeMoney(v)}`.length));
  const wideAmounts = longestItemMoney >= WIDE_AMOUNT_CHARS;

  // Table semantics (cloud-fix4b, A12, Codex review of 5117916): a phone-width pq-amounts-wide table is laid out as a
  // CSS grid with display:contents rows (src/quoteDocument/narrowItems.css). The semantic <table> stays, and the
  // association no longer depends on the CSS display: every <th> is scope="col" with an id, every item / summary /
  // subtotal value cell names its own column header (headers="<th id>"), and table / rowgroup / row / columnheader /
  // cell roles are explicit (the documented guard for engines that drop table roles when a table part's display
  // changes). DOM order = reading order: description, quantity, unit price, amount (the grid only places the cells).
  // Spanning cells (local fix 5, Codex review of 4a5eb18 P1) are associated by meaning, not with every header: the
  // expanded section heading (colspan 4) and the section subtotal label (colspan 3) are the row's description -> the
  // description header; the HE no-items line (colspan 4, a description that states the amount) -> description + amount.
  // Gate: scripts/task16/qa/a11y/table-semantics.mjs.
  const commercialTable = (
    <div className="pq-table-wrap" style={{ overflowX: 'auto' }}>
      <table role="table" className={`pq-commercial-table${wideAmounts ? ' pq-amounts-wide' : ''}`} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', textAlign: 'right' }}>
        <colgroup>
          <col className="pq-col-desc" style={{ width: '40%' }} />
          <col className="pq-col-qty" style={{ width: '18%' }} />
          <col className="pq-col-price" style={{ width: '21%' }} />
          <col className="pq-col-total" style={{ width: '21%' }} />
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            <th id={colId('desc')} scope="col" role="columnheader" className="pq-th-desc" style={{ textAlign: 'right' }}>תיאור פריט</th>
            <th id={colId('qty')} scope="col" role="columnheader" className="pq-th-qty" style={{ textAlign: 'center' }}>כמות</th>
            <th id={colId('price')} scope="col" role="columnheader" className="pq-th-price" style={{ textAlign: 'center' }}>מחיר יחידה</th>
            <th id={colId('total')} scope="col" role="columnheader" className="pq-th-total" style={{ textAlign: 'center' }}>סה״כ</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {!items || items.length === 0 ? (
            <tr role="row">
              <td headers={`${colId('desc')} ${colId('total')}`} role="cell" colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>
                הצעת מחיר כללית בסך <span className="pf-money">{formatWholeMoney(finalTotalRounded)}</span> {currencySymbol}
              </td>
            </tr>
          ) : displaySections.length === 0 ? (
            items.map((item, index) => {
              const itemPrice = Number(item.price || 0);
              const rawQty = Number(item.quantity || 1);
              const isPro = Boolean(item.pricing_unit);
              const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : rawQty;
              const unitLabel = isPro ? getProfessionalUnitLabel(item.pricing_unit, true) : '';
              return (
                <tr role="row" key={index}>
                  <td headers={colId('desc')} role="cell" className="pq-td-desc" style={{ textAlign: 'right' }}>{renderDescriptionCell(item, null)}</td>
                  <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}><span className="pq-num-slot">{isPro ? formatQty(activeQty) : rawQty}</span><span className="pq-unit-slot">{isPro && unitLabel ? `\u00a0${unitLabel}` : ''}</span></td>
                  <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>טרם תומחר</span> : <span className="pf-money">{currencySymbol}{formatWholeMoney(itemPrice)}</span>}</td>
                  <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>טרם תומחר</span> : <span className="pf-money">{currencySymbol}{formatWholeMoney(item.total_price || (rawQty * itemPrice))}</span>}</td>
                </tr>
              );
            })
          ) : (
            displaySections.map((section) => {
              const isOpen = !!expandedSections[section.key];
              const chevron = isOpen ? '▲' : '▼';
              if (!isOpen) {
                // Section Summary Row Correction: Quantity = real item count ("N פריטים", QuoteForm's own copy), Unit
                // Price = "—" (no meaningful single value across mixed pricing methods), Total = section subtotal.
                const itemCount = section.items.length;
                return (
                  <tr role="row" key={section.key}>
                    <td headers={colId('desc')} role="cell" className="pq-td-desc" style={{ textAlign: 'right' }}>
                      {/* PRODUCT_TRUTH_DECORATIVE: expands a collapsed line-item section row within the public quote view table */}
                      <button type="button" className="pq-section-toggle" onClick={() => toggleSection(section.key)} aria-expanded={false}>{`${section.title} ${chevron}`}</button>
                    </td>
                    <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}>{`פריטים: ${itemCount}`}</td>
                    <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center' }}>—</td>
                    {/* IRON-NUMERIC-001 (local fix 7): a section summary amount is a SUMMARY value - it sits on the protected right axis
                        like the expanded section subtotal row; the item-column centring exception covers items only. */}
                    <td headers={colId('total')} role="cell" className="pq-td-total pq-td-summary" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span className="pf-money">{currencySymbol}{formatWholeMoney(section.subtotal)}</span></td>
                  </tr>
                );
              }
              return (
                <Fragment key={section.key}>
                  <tr role="row">
                    <td headers={colId('desc')} role="cell" colSpan="4" style={{ padding: '14px 10px 4px', textAlign: 'right' }}>
                      {/* PRODUCT_TRUTH_DECORATIVE: collapses an expanded line-item section back to its summary row */}
                      <button type="button" className="pq-section-toggle" onClick={() => toggleSection(section.key)} aria-expanded={true}>{`${section.title} ${chevron}`}</button>
                    </td>
                  </tr>
                  {section.items.map((item, i) => {
                    const itemPrice = Number(item.price || 0);
                    const rawQty = Number(item.quantity || 1);
                    const isPro = Boolean(item.pricing_unit);
                    const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : rawQty;
                    return (
                      <tr role="row" key={i}>
                        <td headers={colId('desc')} role="cell" className="pq-td-desc" style={{ textAlign: 'right' }}>{renderDescriptionCell(item, renderItemDetailLines(item, true))}</td>
                        <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}><span className="pq-num-slot">{isPro ? formatQty(activeQty) : rawQty}</span><span className="pq-unit-slot" /></td>
                        <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>טרם תומחר</span> : <span className="pf-money">{currencySymbol}{formatWholeMoney(itemPrice)}</span>}</td>
                        <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>טרם תומחר</span> : <span className="pf-money">{currencySymbol}{formatWholeMoney(item.total_price || (rawQty * itemPrice))}</span>}</td>
                      </tr>
                    );
                  })}
                  <tr role="row" className="pq-section-subtotal-row">
                    <td headers={colId('desc')} role="cell" colSpan="3" style={{ textAlign: 'right', fontWeight: 700 }}>{`סה״כ ${section.title}`}</td>
                    <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span className="pf-money">{currencySymbol}{formatWholeMoney(section.subtotal)}</span></td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // Attachments - restored to the approved base c65f742 behaviour (retro audit R-5, 2026-10-05): ALWAYS rendered; when
  // the quote has no attachments the base empty-state line is shown. Container restored to the base look too (ledger D17,
  // cloud-fix3: #f8fafc panel, 1px #e2e8f0 frame, radius 10, violet paperclip + links); the empty-state line keeps a
  // readable #64748b instead of the base #94a3b8 (~2.4:1) - Owner question Q5.
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const attachmentsBlock = (
    <div className={`pq-section pq-attachments${hasAttachments ? '' : ' pq-attachments--empty'}`} style={{ textAlign: 'right' }}>
      <div className="pq-attachments-title">
        <Paperclip size={14} strokeWidth={2.2} color="#7c3aed" />
        קבצים ושרטוטים מצורפים להצעה:
      </div>
      {hasAttachments ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attachments.map((att, idx) => (
            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="pq-attachment-link" onClick={(e) => openAttachmentFresh(e, { att, index: idx, loadedAt: attachmentsLoadedAtRef.current, reload: reloadAttachments, notify: (t) => showNotice(t, true), removedText: 'הקובץ הזה כבר לא מצורף להצעה.' })}>
              📄 {att.file_name || `קובץ מצורף #${idx + 1}`}
            </a>
          ))}
        </div>
      ) : (
        <div className="pq-attachments-empty">אין קובץ מצורף להצעה זו</div>
      )}
    </div>
  );

  // Totals - one grid (pq-totals-grid) so every amount shares one column (Money Alignment Fix); DOM order [label,
  // amount] under RTL puts labels right / amounts left; the whole block sits at the physical left (flex-end under RTL).
  // IRON-ILS-001: every amount is a *WholeDisplay value through formatWholeMoney; net + VAT always sum to the shown total.
  // client_type ambiguous: never a guessed VAT breakdown - only the stored subtotal / discount / total.
  // Task 36 (Owner, section A): a line flagged price_missing (only when true) - the total is marked partial on the customer's document.
  const hasMissingPrice = (items || []).some((it) => it?.price_missing === true);
  const totalsBlock = (
    <div className="pq-totals-wrap" style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div className="pq-section pq-totals-grid pq-totals-box" style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
        {!isPrivateDisplay && (
          <>
            <span className="pq-total-label">סכום ביניים:</span>
            <span className="pf-money pq-total-value">{currencySymbol}{formatWholeMoney(subtotalWholeDisplay)}</span>
          </>
        )}
        {quote.discount > 0 && (
          <>
            <span className="pq-total-label pq-discount-negative">הנחה ({quote.discount}%):</span>
            <span className="pf-money pq-total-value pq-discount-negative">{currencySymbol}{formatWholeMoney(discountWholeDisplay)}</span>
          </>
        )}
        {isAmbiguousClientType ? null : isPrivateDisplay ? (
          <>
            <span className="pq-total-label">סכום לפני מע״מ:</span>
            <span className="pf-money pq-total-value">{currencySymbol}{formatWholeMoney(netAmountWholeDisplay)}</span>
            <span className="pq-total-label">מע״מ (18%):</span>
            <span className="pf-money pq-total-value">{currencySymbol}{formatWholeMoney(vatAmountWholeDisplay)}</span>
          </>
        ) : (
          <>
            <span className="pq-total-label">מע״מ (18%):</span>
            <span className="pf-money pq-total-value">{currencySymbol}{formatWholeMoney(vatAmountWholeDisplay)}</span>
          </>
        )}
        <div className="pq-total-rule" />
        <span className="pq-total-final-label">סה״כ לתשלום:</span>
        <span className="pf-money pq-total-final-amount">{currencySymbol}{formatWholeMoney(finalTotalWholeDisplay)}</span>
        {hasMissingPrice && <span data-testid="pq-total-partial" className="pq-total-partial" style={{ gridColumn: '1 / -1', marginTop: '6px', fontSize: '0.82em', color: '#b45309', fontWeight: 600 }}>הסכום חלקי: יש בהצעה פריטים שטרם תומחרו.</span>}
      </div>
    </div>
  );

  // Terms / Warranty (Item 23: the frozen quote.warranty snapshot) / Notes - not rendered when empty.
  const noteEntries = [
    displayTerms ? { key: 'terms', title: 'תקנון ותנאים:', body: displayTerms } : null,
    quote.warranty ? { key: 'warranty', title: 'אחריות:', body: quote.warranty } : null,
    quote.notes ? { key: 'notes', title: 'הערות נוספות:', body: quote.notes } : null,
  ].filter(Boolean);
  const notesBlock = noteEntries.length > 0 ? (
    <div className="pq-doc-notes">
      {noteEntries.map((n) => (
        <div key={n.key} className="pq-section pq-doc-note" style={{ textAlign: 'right' }}>
          <div className="pq-doc-note-title">{n.title}</div>
          <div className="pq-doc-note-body">{n.body}</div>
        </div>
      ))}
    </div>
  ) : null;

  // Read-only approval / status record INSIDE the document. Owner-Approved Signature Record Improvement: quote.signature
  // is a static prop from the first page load - right after a first signature justSignedImageDataUrl (the exact bytes
  // just sent) is shown, with the signer name/time captured at that moment; a later visit shows the generic label.
  const signatureSrc = justSignedImageDataUrl || quote.signature;
  let approvalRecord = null;
  if (approved) {
    approvalRecord = (
      <div className="pq-section pq-approval pq-approval-signed" style={{ textAlign: 'start' }}>
        <div className="pq-approval-title">✓ הצעת המחיר אושרה ונחתמה.</div>
        <div className="pq-approval-record">
          {signatureSrc && signatureSrc.startsWith('data:image') ? (
            justSignedAt ? (
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>נחתם על ידי: {signerName}</div>
                {isBusinessCustomer && signerCompany && (
                  <div style={{ marginBottom: '2px' }}>בשם: {signerCompany}{signerRole ? ` (${signerRole})` : ''}</div>
                )}
                <div style={{ marginBottom: '2px' }}>
                  תאריך ושעת חתימה: {formatDeviceShortDateTime(justSignedAt, 'Local')}
                </div>
                <div>
                  מס׳ הצעה: {quoteNumberDisplay}
                </div>
                <img className="pq-signature-img" src={signatureSrc} alt="Client Signature" />
              </div>
            ) : quote.signer_name ? (
              // Owner 2026-10-25 (typed L-24): a later visit says who signed (stored with the signature)
              <div style={{ textAlign: 'start' }} data-testid="pq-stored-signer">
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>נחתם על ידי: <bdi>{quote.signer_name}</bdi></div>
                {quote.signer_company && (
                  <div style={{ marginBottom: '2px' }}>בשם: <bdi>{quote.signer_company}</bdi>{quote.signer_role ? <> (<bdi>{quote.signer_role}</bdi>)</> : null}</div>
                )}
                {quote.signed_at && <div style={{ marginBottom: '2px' }}>תאריך ושעת חתימה: {formatDeviceShortDateTime(new Date(quote.signed_at), 'Local')}</div>}
                <div>מס׳ הצעה: {quoteNumberDisplay}</div>
                <img className="pq-signature-img" src={quote.signature} alt="Client Signature" />
              </div>
            ) : (
              <div>
                <div>חתימה דיגיטלית:</div>
                <img className="pq-signature-img" src={quote.signature} alt="Client Signature" />
              </div>
            )
          ) : 'החתימה הדיגיטלית התקבלה'}
        </div>
      </div>
    );
  } else if (isExpired && !isUnfinishedDraft) {
    // OD-1: an expired quote stays viewable but cannot be accepted - the document itself states it.
    approvalRecord = (
      <div className="pq-section pq-doc-status" role="status" data-testid="pq-expired">
        ⏳ תוקף הצעת המחיר הסתיים, ולכן לא ניתן לאשר או לחתום עליה כעת.
        <div className="pq-doc-status-sub">לקבלת הצעה מעודכנת פנו לעסק ששלח אותה.</div>
      </div>
    );
  } else if (!isUnfinishedDraft) {
    // Unsigned: a fine rule + signature line (a printed copy can still be signed by hand).
    approvalRecord = (
      <div className="pq-section pq-approval pq-print-only" style={{ textAlign: 'right' }}>
        <div className="pq-approval-copy">
          <div className="pq-approval-title">אישור ההצעה</div>
          <p>חתימה מאשרת את תנאי ההצעה</p>
        </div>
        <div className="pq-sigline">חתימה</div>
      </div>
    );
  }

  // Unfinished draft, not signable (ledger D27, cloud-fix4): base c65f742 orange panel INSIDE the document, in the
  // approval area (same condition and text as before - only position and styling return to base).
  const unfinishedNotice = (!previewMode && !approved && !isOwnerViewing && isUnfinishedDraft) ? (
    <div className="pq-section pq-doc-status pq-doc-status-unfinished" role="status" data-testid="pq-unfinished-nosign">
      ההצעה עדיין בהכנה ולכן אינה זמינה לחתימה.
    </div>
  ) : null;

  // Document footer (ledger D23, cloud-fix4): base c65f742 - the HE credit line only, centred, 0.9rem #64748b, violet
  // TEKANGO link. The Task 16 "{business} · {number}" line is removed (no print need: the number is in the letterhead,
  // which every printed quote opens with; pagination gates do not depend on it).
  const docFooter = (
    <div className="pq-doc-foot">
      <span>המסמך הופק באמצעות{' '}
        {previewMode ? (
          <span dir="ltr" className="pq-doc-credit">TEKANGO</span>
        ) : (
          /* PRODUCT_TRUTH_DECORATIVE: footer TEKANGO branding link navigating to the main marketing homepage */
          <span onClick={() => navigate('/he')} dir="ltr" className="pq-doc-credit pq-doc-credit-link">
            TEKANGO
          </span>
        )}
        {' '}– התוכנה שעושה לעסקים את החיים קלים.
      </span>
    </div>
  );

  // End of the document as ONE keep-together group (cloud-fix4, A13): the last body block (terms / notes, or the totals
  // when there are none) + the approval / status record + the footer. Chromium does not honour break-before: avoid at the
  // end of the card (measured: HE Visual signed printed a footer-only page 2), so native Print keeps the group together
  // with break-inside: avoid on .pq-doc-end - the end never starts a page alone and the signature record never leaves
  // its body context. On screen the wrapper is a plain block (same order and spacing).
  // Action tiles (PDF / Print / Call / WhatsApp) - ledger D21a (cloud-fix4, A13, A17 G4b): back INSIDE the document card
  // at the base c65f742 position (after the approval / signature area, above the footer), app UI kept out of every
  // output: .no-print (native Print), data-html2canvas-ignore + .pq-pdf-capturing .no-print (Direct PDF capture). The
  // round-locked tile rules (equal tiles, one row on phones, labels >= 12px) are unchanged (page CSS below).
  const actionTiles = (previewMode && !standalonePrint) ? null : (
    <div data-html2canvas-ignore="true" className={`pq-action-tiles no-print ${bizPhone ? '' : 'pq-action-tiles-two'}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', paddingBottom: '5px' }}>
      {/* PRODUCT_TRUTH_CAPABILITY: quote_pdf */}
      <button
        type="button"
        onClick={() => openPrintChooser('pdf')}
        disabled={pdfGenerating}
        className="pq-action-tile"
        style={{ background: LIGHT.gradient, color: 'white', border: 'none', cursor: pdfGenerating ? 'wait' : 'pointer', opacity: pdfGenerating ? 0.75 : 1 }}
      >
        {pdfGenerating ? <Loader2 size={26} strokeWidth={1.75} className="pq-spin" /> : <PdfFileIcon size={26} strokeWidth={1.75} />}
        <span>{pdfGenerating ? 'מפיק PDF…' : 'הורדה כ-PDF'}</span>
      </button>
      {/* PRODUCT_TRUTH_CAPABILITY: quote_print */}
      <button
        type="button"
        onClick={() => openPrintChooser('print')}
        className="pq-action-tile"
        style={{ background: 'white', color: '#475569', border: '2px solid #cbd5e1', cursor: 'pointer' }}
      >
        <Printer size={26} strokeWidth={1.75} />
        <span>הדפסת המסמך</span>
      </button>
      {/* PRODUCT_TRUTH_CAPABILITY: public_call */}
      {bizPhone && (
        <a
          href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
          className="pq-action-tile"
          style={{ background: 'white', color: LIGHT.sky, border: `2px solid ${LIGHT.sky}`, textDecoration: 'none' }}
        >
          <Phone size={26} strokeWidth={1.75} />
          <span>התקשרו אלינו</span>
        </a>
      )}
      {bizWhatsAppHref && (
        <a
          href={bizWhatsAppHref}
          target="_blank"
          rel="noopener noreferrer"
          className="pq-action-tile"
          style={{ background: 'white', color: LIGHT.emerald, border: `2px solid ${LIGHT.emerald}`, textDecoration: 'none' }}
        >
          <MessageCircle size={26} strokeWidth={1.75} />
          <span>וואטסאפ</span>
        </a>
      )}
    </div>
  );

  // App UI outside the document: preview notice / owner notice / not-signable notice / signature INPUT pad.
  let signArea = null;
  if (previewMode) {
    signArea = (
      <div className="pq-app-notice pq-app-notice-preview" role="note" data-testid="pq-preview-notice">
        תצוגה מקדימה של המסמך שהלקוח יקבל. אישור וחתימה זמינים ללקוח בקישור ששותף בלבד.
      </div>
    );
  } else if (approved) {
    // Task 27 (spec §6): the owner's optional thank-you - present only when the server returned it for this SIGNED quote
    signArea = <PublicThanksNotice thanks={quoteData?.output_channel ? null : (thanks ?? quoteData?.thanks ?? null)} isHebrew={true} />;
  } else if (isOwnerViewing) {
    signArea = (
      <div className="pq-app-notice pq-app-notice-info">
        ℹ️ תצוגת מנהל: אזור החתימה מוצג ללקוח בלבד.
        {isExpired && (
          <div data-testid="pq-owner-expired-hint" style={{ marginTop: '8px', fontWeight: '500' }}>
            תוקף ההצעה הסתיים - הלקוח לא יוכל לחתום עליה עד שתעדכנו את תאריך התוקף בעריכת ההצעה או תפיקו הצעה מעודכנת.
          </div>
        )}
      </div>
    );
  } else if (isUnfinishedDraft) {
    // ledger D27 (cloud-fix4): the "not available for signature" state is shown INSIDE the document (unfinishedNotice).
    signArea = null;
  } else if (!isExpired) {
    signArea = (
      <div className="pq-sign-panel no-print" style={{ boxSizing: 'border-box' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>חתימת לקוח לאישור ההצעה:</h4>
        {/* Owner-Approved Signature Record Improvement - "smallest clear confirmation step": the signer-name field is
            pre-filled from attn_name as an editable suggestion only; the value shown is what the signer confirms. */}
        <div style={{ maxWidth: '350px', margin: '0 auto 12px', textAlign: 'right' }}>
          <label htmlFor="pq-signer-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>שם מלא לחתימה <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="pq-signer-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="לדוגמה: ישראל ישראלי"
            aria-required="true"
            aria-invalid={signerNameWarning}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${signerNameWarning ? '#dc2626' : '#cbd5e1'}`, borderRadius: '8px', fontSize: '16px', textAlign: 'right', marginBottom: isBusinessCustomer ? '8px' : 0 }}
          />
          {isBusinessCustomer && (
            <>
              <label htmlFor="pq-signer-company" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                בשם (חברה/עסק) - אופציונלי
              </label>
              <input
                id="pq-signer-company"
                type="text"
                value={signerCompany}
                onChange={(e) => setSignerCompany(e.target.value)}
                placeholder="לדוגמה: חברה בע״מ"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', textAlign: 'right', marginBottom: '8px' }}
              />
              <label htmlFor="pq-signer-role" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                תפקיד - אופציונלי
              </label>
              <input
                id="pq-signer-role"
                type="text"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="לדוגמה: מנכ״ל"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', textAlign: 'right' }}
              />
            </>
          )}
          {signerNameWarning && (
            <div role="alert" style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: '700', marginTop: '4px' }}>הזינו שם מלא לפני האישור</div>
          )}
        </div>
        {/* Mobile Signature Pad Scroll-Block Fix: by default the canvas lets vertical scrolling through (pan-y) and shows
            a "tap to sign" affordance; only an explicit tap activates drawing (touchAction none). "סיום" returns to
            scrolling without erasing the drawn signature. */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto 10px', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            width={350}
            height={150}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ display: 'block', touchAction: isActive ? 'none' : 'pan-y', cursor: isActive ? 'crosshair' : 'default', maxWidth: '100%', height: 'auto' }}
          />
          {/* PRODUCT_TRUTH_DECORATIVE: activates the signature-drawing canvas; sub-step of the already-marked public_quote_sign flow */}
          {!isActive && !hasSigned && (
            <button
              type="button"
              onClick={activateSigning}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(248,250,252,0.85)', border: 'none', color: '#475569', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >הפעלת אזור החתימה</button>
          )}
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: clears the currently drawn signature before submission */}
          {(isActive || hasSigned) && (
            <button type="button" onClick={clearSignature} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>ניקוי החתימה</button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: ends signature-drawing mode without submitting approval */}
          {isActive && (
            <button type="button" onClick={deactivateSigning} style={{ background: LIGHT.violet, color: 'white', border: 'none', padding: '4px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>
              סיום
            </button>
          )}
        </div>
        {signatureWarning && (
          <div role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '700', marginBottom: '10px' }}>חתמו על המסמך לפני האישור</div>
        )}
        <div>
          {/* PRODUCT_TRUTH_CAPABILITY: public_quote_sign */}
          <button onClick={handleApprove} style={{ background: hasSigned ? LIGHT.gradient : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? LIGHT.glow : 'none', maxWidth: '100%', boxSizing: 'border-box' }}>אישור וחתימה על הצעת המחיר ✓</button>
        </div>
      </div>
    );
  }


  const signInDoc = !!signArea && !previewMode && !approved && !isOwnerViewing && !isUnfinishedDraft && !isExpired;
  const endBody = notesBlock || totalsBlock;
  const docEnd = (
    <div className="pq-doc-end">
      {endBody}
      {approvalRecord}
      {unfinishedNotice}
      {/* Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #18: the signature pad is back INSIDE the document, right after
          the terms / notes (as before the new interface); app UI only - never printed or captured into the PDF */}
      {signInDoc ? <div className="pq-actions pq-actions-in-doc no-print" data-html2canvas-ignore="true">{signArea}</div> : null}
      {actionTiles}
      {docFooter}
    </div>
  );

  // Composition by presentation style (one commercial model, three arrangements).
  let documentBody;
  if (docStyle === 'modern') {
    documentBody = (
      <>
        {letterhead}
        {unfinishedBanner}
        {showcaseMedia.length > 0 && <QuoteMediaRail media={showcaseMedia} isHebrew={isHebrew} />}
        {parties}
        <div className="pq-body-grid">
          <div className="pq-body-main" style={{ minWidth: 0 }}>
            {commercialTable}
            {attachmentsBlock}
          </div>
          {notesBlock && (
            <aside className="pq-body-aside" style={{ minWidth: 0 }}>
              {totalsBlock}
            </aside>
          )}
        </div>
        {docEnd}
      </>
    );
  } else {
    documentBody = (
      <>
        {letterhead}
        {unfinishedBanner}
        {docStyle === 'visual' && showcaseMedia.length > 0 && <QuoteMediaHero media={showcaseMedia} isHebrew={isHebrew} />}
        {parties}
        {commercialTable}
        {attachmentsBlock}
        {notesBlock && totalsBlock}
        {docEnd}
      </>
    );
  }


  // `.pq-preview` (and no print CSS) only for an EMBEDDED preview; a standalone preview page prints as the document.
  const embeddedPreview = previewMode && !standalonePrint;

  return (
    <div className={`pq-page${pdfGenerating ? ' pq-pdf-capturing' : ''}${embeddedPreview ? ' pq-preview' : ''}${previewMode && standalonePrint ? ' pq-standalone-preview' : ''}`} data-print-mode={printMode} data-pq-style={docStyle} dir="rtl" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: previewMode ? 'transparent' : '#f8fafc', /* ledger D25b: base page tone */ minHeight: previewMode ? 0 : '100vh', padding: previewMode ? 0 : '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <style>{`${PQ_SCREEN_CSS}${embeddedPreview ? '' : PQ_PRINT_CSS}`}</style>
      {/* Owner 2026-10-07: the on-screen white paper is A4-width at 96dpi (794px). The 18px decorative frame on
          each side makes the outer card 830px. Narrow viewports remain fluid. Print and Direct PDF remove the frame. */}
      <div className="pq-column pq-card-desktop-width" style={{ width: '100%', maxWidth: '830px' }}>
        <div ref={cardRef} className={`pq-card pq-style-${docStyle}`} data-pq-style={docStyle} style={{ background: 'white', borderRadius: '22px', boxShadow: '0 9px 28px rgba(16,29,35,0.11)', border: '18px solid #dfe8e5', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
          {documentBody}
        </div>

        {signArea && !signInDoc ? (
          <div className="pq-actions no-print">
            {signArea}
          </div>
        ) : null}

        {!previewMode && (
          <QuotePrintModeModal
            open={printModalOpen}
            isHebrew={isHebrew}
            intent={printIntent}
            onClose={() => setPrintModalOpen(false)}
            onChoose={handleChooseOutputMode}
          />
        )}
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={true} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Page CSS. Screen rules are always emitted (the first <style> - pinned by PublicQuote.structuredDisplay.test.jsx);
// print rules are emitted ONLY outside previewMode, so an embedded creator preview never leaks @page / table / tr print
// rules into the dashboard. The document's own look lives in src/quoteDocument/quoteDocument.css (scoped).
// ---------------------------------------------------------------------------------------------------------------------
const PQ_SCREEN_CSS = `
        .pq-card { padding: 28px 30px 20px; }
        /* Bottom Actions (Owner visual reference): equal tiles (flex:1), icon above label, uniform height;
           pq-action-tiles-two only removes a tile, the rest stay equal. */
        .pq-action-tiles { align-items: stretch; }
        .pq-action-tile {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          /* בעל המערכת 2026-10-18 ("לגבי המחשב תשתמש בנמוך יותר"; בטלפון "שניהם נראים אותו דבר" - נשאר 78 למטה): במחשב הגובה הנמוך */
          min-height: 62px;
          padding: 9px 6px;
          border-radius: 10px;
          text-align: center;
          font-weight: 700;
          font-size: 0.82rem;
          box-sizing: border-box;
        }
        /* 830px outer card - 2 * 18px frame = 794px white A4 paper at 96dpi. */
        @media (min-width: 1024px) {
          .pq-card-desktop-width {
            width: 100% !important;
            max-width: 830px !important;
          }
        }
        @media (max-width: 640px) {
          /* Phone keeps the same paper, with the landing sample's compact frame and insets. */
          .pq-page {
            padding: 4px !important;
          }
          /* Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #20: phone = the real phone width again, no paper frame (the Owner's own fix, three times) */
          .pq-card {
            padding: 2px !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .pq-section {
            padding: 10px 12px !important;
          }
          .pq-recipient {
            padding: 6px 10px !important;
            margin-bottom: 10px !important;
          }
          /* The tile group stays one horizontal row on Mobile - only padding/font/gap shrink (labels >= 12px). */
          .pq-action-tile {
            min-height: 78px !important;
            padding: 10px 4px !important;
            font-size: 0.75rem !important;
            gap: 4px !important;
          }
          /* Public Quote Mobile 4-Column Geometry Correction (Owner rejected the stacked-card layout): the SAME four
             columns, fixed by geometry only - a Mobile-only <colgroup> override (Total gets more room) and tighter
             cell padding. table-layout:fixed keeps the <col> widths the only geometry source. */
          .pq-commercial-table {
            table-layout: fixed !important;
          }
          .pq-col-desc { width: 40% !important; }
          .pq-col-qty { width: 15% !important; }
          .pq-col-price { width: 18% !important; }
          .pq-col-total { width: 27% !important; }
          .pq-commercial-table th,
          .pq-commercial-table td {
            padding: 8px 4px !important;
          }
          .pq-commercial-table th {
            font-size: 0.78rem !important;
          }
        }
        /* Direct PDF via html2canvas: applied only while generateQuotePdf runs (html2canvas photographs the DOM, it
           does not print). The capture root is .pq-card: these rules drop the card's screen chrome and every .no-print
           element inside it - the on-screen action tiles (also data-html2canvas-ignore) never reach the PDF. */
        .pq-pdf-capturing .no-print {
          display: none !important;
        }
        .pq-pdf-capturing .pq-card {
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
        }
        .pq-pdf-capturing .pq-unit-disclosure {
          display: none !important;
        }
        .pq-pdf-capturing .pq-unit-expanded .pq-unit-head-total {
          display: none !important;
        }
        .pq-pdf-capturing .pq-unit-title {
          font-size: 1.05rem !important;
          font-weight: 800 !important;
        }
        .pq-spin {
          animation: pq-spin-rotate 0.9s linear infinite;
        }
        @keyframes pq-spin-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
`;

const PQ_PRINT_CSS = `
        /* Item 7 (Public Quote Print): .no-print (src/index.css) hides every app control; this removes page chrome. */
        @media print {
          .pq-page {
            background: #ffffff !important;
            padding: 0 !important;
            display: block !important;
            min-height: 0 !important;
          }
          /* ONE SHARED A4 DOCUMENT CONTRACT: 190mm (= 210mm A4 - 2*10mm), the same content width
             generateQuotePdf.getA4ContentBoxPt() uses; padding-bottom trimmed so a short document never spills a
             near-empty second page (trailing decorative whitespace only). */
          .pq-card {
            box-shadow: none !important;
            border: none !important;
            max-width: 190mm !important;
            margin: 0 auto !important;
            padding-bottom: 8px !important;
          }
          @page {
            size: A4;
            margin: 12mm 10mm;
          }
          table { border-collapse: collapse; }
          thead { display: table-header-group; }
          tr, .pq-section, .pq-unit-item, .pq-recipient, .pq-action-tile {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .pq-header-box {
            box-shadow: none !important;
          }
          .pq-card, .pq-card * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* PRINT/PDF STATIC-DOCUMENT CLEANUP: the interactive disclosure control is meaningless on paper; in Expanded
             only the unit footer total is kept. */
          .pq-unit-disclosure {
            display: none !important;
          }
          .pq-unit-expanded .pq-unit-head-total {
            display: none !important;
          }
          .pq-unit-title {
            font-size: 1.05rem !important;
            font-weight: 800 !important;
          }
        }
`;
