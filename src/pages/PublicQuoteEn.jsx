import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../shared/supabase';
import { invokeWithFreshSession } from '../shared/invokeWithFreshSession';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip, Phone, Printer, MessageCircle, Loader2 } from 'lucide-react';
import PdfFileIcon from '../components/PdfFileIcon';
import QuotePrintModeModal from '../components/QuotePrintModeModal';
import { classifyQuoteApprovalError } from '../utils/quoteApprovalErrorClassification';
import { resolveQuoteExpired } from '../utils/quoteValidity';
import { isUnfinishedSavedQuote, missingPriceOutputNotice, publicItemsForNotice } from '../utils/quoteCompleteness';
import { formatAddress } from '../utils/addressFormat';
import { formatMoney } from '../utils/money';
import { formatQuoteFallback, formatQuoteNumber } from '../utils/quoteNumber';
import { generateQuotePdf, buildQuotePdfFilename } from '../utils/generateQuotePdf';
import { getActiveQuantity, getProfessionalUnitLabel, formatMeasurementLine } from '../utils/professionalQuoteItem';
import { buildCustomerPresentationModel } from '../utils/quotePresentationModel';
import { formatDeviceShortDateTime } from '../utils/shortDate';
import { QuoteMediaRail, QuoteMediaHero, QuoteItemThumb } from '../quoteDocument/QuoteMedia';
import { mediaForItem } from '../quoteDocument/quoteMediaModel';
import { normalizeStyleId, styleSupportsImages, DEFAULT_QUOTE_STYLE } from '../quoteDocument/quoteStyles';
import '../quoteDocument/quoteDocument.css';
// Task 16 round 4: narrow-screen item rows (owned separately from quoteDocument.css; loaded after it).
import '../quoteDocument/narrowItems.css';
import { outputGate, authorizeWithNotice, outputBlockedMessage } from '../domain/subscriptions/outputAuthority';
import PublicThanksNotice from '../components/PublicThanksNotice';
import { useAmountAxis } from '../quoteDocument/useAmountAxis';
import { openAttachmentFresh } from '../utils/freshAttachmentLink';

// Money Consolidation (Global Surface Audit finding I-1): this local
// formatNum used to Math.round() every amount before formatting - silently
// discarding cents on every International (USD/EUR/GBP) price/subtotal/
// discount/total on this entire page. International retains full cent
// precision always (no whole-unit rounding rule exists for International -
// that rule is Local/ILS-only, and lives exclusively in PublicQuote.jsx).
//
// Re-confirmed 2026-09-14 (Final Smart Quote Merge + Rounding Remediation
// task, Part 9): that task explicitly asked whether whole-money display
// should extend to International too - the Owner confirmed HE/ILS only.
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

// Public Quote Section-Level Smart Dropdown task - see PublicQuote.jsx/HE's
// own copy of this function for the full rationale (kept as its own local
// adapter, matching this file's established pattern of not sharing RENDER
// code with the HE page, but delegating all grouping/subtotal logic to the
// shared, canonical buildCustomerPresentationModel). Returns [] for a flat
// (non-divided) quote. "Unassigned" is the existing canonical label
// QuoteForm.jsx already uses for this exact bucket - not invented here.
function buildDisplaySections(items, sections) {
  const model = buildCustomerPresentationModel(items, sections);
  if (!model.isDivided) return [];
  const display = model.units
    .filter((u) => u.itemCount > 0)
    .map((u) => ({ key: u.key ?? u.id, title: u.title, items: u.items, subtotal: u.subtotal }));
  if (model.unassignedItems.length > 0) {
    const subtotal = model.unassignedItems.reduce((sum, it) => sum + Number(it.total_price ?? (Number(it.quantity || 1) * Number(it.price || 0))), 0);
    display.push({ key: '__unassigned__', title: 'Unassigned', items: model.unassignedItems, subtotal });
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
  return phone.trim();
};

// PRODUCT_TRUTH_CAPABILITY: public_quote_view
// Task 16 (CONTRACT §4) - same props as PublicQuote.jsx (HE): `presentation` (public_get payload; absent => legacy
// Classic), `previewMode` (no approve, no pad, no navigation, no network, no host-document side effects, no print CSS),
// `detail` ('compact' | 'expanded', optional), `onApproved` and `standalonePrint` (previewMode only: the sample route's
// native Print uses the public quote's A4 print contract). This page never navigates (rendered without a Router).
export default function PublicQuoteEn({ quoteData, presentation = null, previewMode = false, detail = null, onApproved = null, standalonePrint = false, onFinalSnapshot = null, capabilityToken = null, thanks = null }) {
  const { quote, business, client, items, attachments, sections: quoteSections } = quoteData;
  // Owner 2026-10-23 (typed L-09..L-27): an attachment link older than 4 minutes is re-read on click (utils/freshAttachmentLink.js)
  const attachmentsLoadedAtRef = useRef(Date.now());
  const reloadAttachments = previewMode ? null : async () => {
    const { data, error } = await supabase.functions.invoke('get-public-quote', { body: capabilityToken ? { capability_token: capabilityToken } : { quote_id: quote?.id } });
    if (error) throw error;
    return data;
  };
  // Public Quote Section-Level Smart Dropdown task (same rule as
  // PublicQuote.jsx/HE - see that file's own copy of this comment for the
  // full rationale): [] for a flat quote.
  const displaySections = buildDisplaySections(items, quoteSections);
  // Task 16: the document detail level. An explicit `detail` prop wins; in previewMode the creator preview may pass it
  // as presentation.detail. A public page without either keeps its existing default (Compact).
  const presentationDetail = previewMode && (presentation?.detail === 'compact' || presentation?.detail === 'expanded') ? presentation.detail : null;
  const docDetail = detail === 'compact' || detail === 'expanded' ? detail : presentationDetail;
  const [approved, setApproved] = useState(quote.status === 'approved' || Boolean(quote.signature));
  const [signatureWarning, setSignatureWarning] = useState(false);
  const [approveToast, setApproveToast] = useState(null);
  // Public Quote Section-Level Smart Dropdown task, supersedes the old
  // single global smartDetailsExpanded boolean below (same rule as
  // PublicQuote.jsx/HE - see that file's own copy of this comment for the
  // full rationale). Keyed by section key; independent per section.
  const [expandedSections, setExpandedSections] = useState(() => (docDetail === 'expanded' ? allSectionsMap(items, quoteSections, true) : {}));
  // Item-table semantics (cloud-fix4b, A12): a per-instance id prefix for the column headers, so every body cell names
  // its own header (headers="<th id>") - unique even when two documents share a page.
  const tableUid = useId();
  const colId = (key) => `${tableUid}-col-${key}`;
  const toggleSection = (key) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Owner-Approved Signature Record Improvement - symmetric with
  // PublicQuote.jsx (HE); see that file's comment for the full audited-gap
  // rationale. State only, never persisted, never a silent reuse of attn_name.
  const [signerName, setSignerName] = useState(quote.attn_name || '');
  const [signerCompany, setSignerCompany] = useState(client?.company_name || '');
  const [signerRole, setSignerRole] = useState(quote.attn_role || '');
  const [signerNameWarning, setSignerNameWarning] = useState(false);
  const [justSignedAt, setJustSignedAt] = useState(null);
  const [justSignedImageDataUrl, setJustSignedImageDataUrl] = useState(null);
  const isBusinessCustomer = quote.client_type === 'business';

  // Public Quote PDF/Print UX task: printMode/printModalOpen/printIntent/
  // pdfGenerating are local UI state only, never sent to the server.
  // "Download PDF" and "Print" used to both just call window.print() - now
  // they genuinely diverge: printIntent==='print' still only ever calls
  // window.print() (untouched); printIntent==='pdf' calls the real
  // generateQuotePdf (html2canvas+jsPDF) and never window.print().
  // Final Public Quote Restoration task - "DEFAULT PUBLIC QUOTE STATE -
  // HARD LOCK" (supersedes the old Locked Decision 11): a divided quote
  // must open with every unit collapsed, matching PublicQuote.jsx (HE)
  // exactly. Expanded remains a real, fully-functional mode - only reached
  // via an explicit Print/PDF chooser selection, never the default on
  // normal open. A regular quote keeps the existing compact default.
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

  // Public Quote Section-Level Smart Dropdown task (same rule as
  // PublicQuote.jsx/HE - see that file's own copy of this comment for the
  // full rationale): sets every section to the same open/closed state at
  // the moment of explicit choice.
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
    if (quoteData.viewerIsOwner === true) {
      const notice = missingPriceOutputNotice(quote, { isHebrew: false, items: publicItemsForNotice(items) });
      if (notice && notice.blocked) { setApproveToast({ type: 'error', message: notice.text }); return; }
      if (notice && !window.confirm(notice.text)) return;
    }
    const serverPhase = quoteData.capability ? 'off' : (quoteData.viewerIsOwner === true ? (quoteData.outputPhase || 'off') : 'off');
    const gate = outputGate(finalChannel, serverPhase);
    if (gate.mode === 'authority_required') {
      const auth = await authorizeWithNotice({ channel: finalChannel, quoteId: quote.id, invoke: (name, opts) => invokeWithFreshSession(name, opts), confirm: (text) => window.confirm(text), isHebrew: false });
      const snap = auth.proceed
        ? await supabase.functions.invoke('get-public-quote', { body: { output_grant: auth.grant, channel: finalChannel } })
        : null;
      if (!auth.proceed || snap?.error || !snap?.data?.quote || !onFinalSnapshot) {
        if (auth.mode === 'cancelled') return;
        setApproveToast({ type: 'error', message: outputBlockedMessage(auth.proceed ? 'final_response_invalid' : auth.code, false) });
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

    if (pdfGenerating) return; // duplicate-click guard
    setPdfGenerating(true);
    try {
      // A real frame so .pq-pdf-capturing + data-print-mode reflow before
      // html2canvas captures (setTimeout, not rAF, which browsers throttle
      // nearly to a halt in a backgrounded tab).
      await new Promise((resolve) => setTimeout(resolve, 80));
      const filename = buildQuotePdfFilename(formatQuoteNumber(quote.quote_number));
      await generateQuotePdf({ captureEl: cardRef.current, filename });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setApproveToast({ type: 'error', message: "We couldn't generate the PDF file. Please try again." });
    } finally {
      setPdfGenerating(false);
    }
  };

  const { canvasRef, hasSigned, isActive, activateSigning, deactivateSigning, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

  // The inline "please sign" warning clears itself as soon as a valid signature exists
  useEffect(() => {
    if (hasSigned) setSignatureWarning(false);
  }, [hasSigned]);

  useEffect(() => {
    if (signerName.trim()) setSignerNameWarning(false);
  }, [signerName]);

  useEffect(() => {
    // Task 16 previewMode: embedded in the dashboard / sample route - never touch the host document.
    if (previewMode) return;
    document.title = "TEKANGO - Digital Price Quote";

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

    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, [previewMode]);

  // OD-1: an expired quote stays viewable but cannot be accepted. International market: the validity day ends only when it has
  // ended everywhere (Anywhere on Earth); server truth `is_expired` wins when provided. The stored date is never changed.
  const isExpired = resolveQuoteExpired(quote, 'International');
  // SMART-QUOTE-01: an unfinished draft never masquerades as a customer-ready quote (screen, print, PDF) and cannot be signed.
  const isUnfinishedDraft = isUnfinishedSavedQuote(quote, items);

  // PRODUCT_TRUTH_CAPABILITY: public_quote_sign
  const handleApprove = async () => {
    if (previewMode) return; // Task 16: a preview never approves (no RPC, no network).
    if (isExpired) {
      setApproveToast({ type: 'error', message: classifyQuoteApprovalError('Quote expired', false).userMessage });
      return;
    }
    if (isUnfinishedDraft) return;
    let blocked = false;
    if (!signerName.trim()) { setSignerNameWarning(true); blocked = true; }
    if (!hasSigned) { setSignatureWarning(true); blocked = true; }
    if (blocked) return;
    try {
      const signatureDataUrl = getSignatureDataUrl();
      // OD-02: approval/signature use the same artifact as the link. On the capability route the server resolves the token
      // (op 'approve'); the quote id alone authorizes nothing there. Legacy links keep the id RPC (guarded server-side).
      const { error } = capabilityToken
        ? await supabase.rpc('public_approve_quote_capability', { p_token: capabilityToken, p_signature_data_url: signatureDataUrl })
        : await supabase.rpc('public_approve_quote', {
          p_quote_id: quote.id,
          p_signature_data_url: signatureDataUrl,
        });
      if (error) throw error;
      // Owner-Approved Signature Record Improvement: quote.signature is a
      // static prop from the initial page load (SmartPublicQuote.jsx fetches
      // once, never refetches after the RPC) - right after a first sign it
      // is still null. Store the data URL just computed (the same bytes just
      // sent to the server) in local state for immediate display.
      setJustSignedImageDataUrl(signatureDataUrl);
      setJustSignedAt(new Date());
      setApproved(true);
      // Task 16: the server freezes the presentation snapshot once the quote is locked - let the host re-fetch it.
      if (typeof onApproved === 'function') onApproved();
    } catch (err) {
      // Error handling: console-only technical details; the customer sees a safe, specific message (classifyQuoteApprovalError). The RPC now blocks only this quote's own owner, not any business account.
      console.error('Error approving quote:', err);
      const { userMessage } = classifyQuoteApprovalError(err?.message, false);
      setApproveToast({ type: 'error', message: userMessage });
    }
  };

  const rawCurrency = (quote.currency || business?.currency || 'USD').toUpperCase();
  const effectiveCurrency = ['USD', 'EUR', 'GBP'].includes(rawCurrency) ? rawCurrency : 'USD';
  const currencySymbol = effectiveCurrency === 'EUR' ? '€' : effectiveCurrency === 'GBP' ? '£' : '$';

  let parsedItems = [];
  try { parsedItems = typeof quote.items === 'string' ? JSON.parse(quote.items) : (Array.isArray(quote.items) ? quote.items : []); } catch { /* keep default [] */ }

  const subtotal = quote.subtotal ? Number(quote.subtotal) : parsedItems.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);
  const total = Number(quote.total || 0) > 0 ? Number(quote.total) : subtotal;

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

  const bizName = brand.business_name || 'TEKANGO Business';
  const bizLogo = brand.logo_url;
  const bizTaxId = brand.tax_id;
  const bizEmail = brand.email;
  const bizPhone = formatDisplayPhone(brand.phone);
  const bizAddress = brand.address;
  const isOwnerViewing = quote.is_owner_viewing;

  // Public Quote Redesign - WhatsApp contact action: same phone
  // normalization as sendWhatsApp (Dashboard.jsx) and PublicQuote.jsx (HE) -
  // not a third independent formula. The visitor here IS the client, so
  // this messages the business, not the client.
  // PRODUCT_TRUTH_CAPABILITY: public_whatsapp_contact
  const bizWhatsAppHref = (() => {
    const raw = brand.phone ? String(brand.phone).trim() : '';
    if (!raw) return null;
    // International businesses store phone numbers already in full
    // international format - no country code is invented here, unlike the
    // Local +972 assumption that would be wrong for an International
    // business based anywhere else.
    let clean = raw.replace(/[^\d+]/g, '');
    if (clean.startsWith('00')) clean = '+' + clean.slice(2);
    else if (/^\d{9,15}$/.test(clean)) clean = '+' + clean;
    const phoneForUrl = clean.replace('+', '');
    if (!phoneForUrl) return null;
    const numberDisplay = formatQuoteFallback(quote);
    const text = `Hi, I have a question about quote number ${numberDisplay}.`;
    return `https://wa.me/${phoneForUrl}?text=${encodeURIComponent(text)}`;
  })();

  // ---------------------------------------------------------------------------------------------------------------
  // Task 16 - document / action separation (CONTRACT §4), mirrored from PublicQuote.jsx (HE). `.pq-card` (cardRef) is
  // the ONLY capture root for Direct PDF and the printed document. The action tiles (PDF / Print / Call / WhatsApp)
  // render INSIDE the card on screen (ledger D21a, end-of-document group above the footer) and never reach an output:
  // .no-print (native Print), data-html2canvas-ignore + `.pq-pdf-capturing .no-print` (Direct PDF). The print-mode
  // chooser, the signature INPUT pad and owner/admin/preview notices render OUTSIDE the card (.no-print as well).
  // International money: formatMoney (cents) only - never the Local whole-shekel formatter.
  // ---------------------------------------------------------------------------------------------------------------
  const quoteNumberDisplay = formatQuoteNumber(quote.quote_number) || formatQuoteFallback(quote);

  const renderItemDetailLines = (item, withQuantityLine) => {
    const isPro = Boolean(item.pricing_unit);
    const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : Number(item.quantity || 1);
    const unitLabel = isPro ? getProfessionalUnitLabel(item.pricing_unit, false) : '';
    const measurements = Array.isArray(item.measurements) ? item.measurements : [];
    const specRows = Array.isArray(item.specification) ? item.specification.filter((s) => s.label || s.value) : [];
    return (
      <>
        {withQuantityLine && isPro && (
          <div className="pq-item-detail pq-item-detail-strong">{`Quantity: ${formatQty(activeQty)} ${unitLabel}`}</div>
        )}
        {measurements.length > 0 && (
          <div className="pq-item-detail">
            {measurements.map((m, mi) => (
              <div key={mi}>{formatMeasurementLine(m, false, formatNum)}</div>
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

  // Description cell: text, optional detail lines and (Modern/Visual) the row-bound thumbnail INSIDE the cell.
  const renderDescriptionCell = (item, detailLines) => {
    const label = item.description || 'Item';
    const thumb = showItemThumbs ? mediaForItem(docMedia, item.description) : null;
    if (!thumb) return <>{label}{detailLines}</>;
    return (
      <div className="pq-item-with-thumb">
        <QuoteItemThumb image={thumb} isHebrew={false} />
        <div className="pq-item-text">{label}{detailLines}</div>
      </div>
    );
  };

  const letterhead = (
    <PublicQuoteHeader
      variant={docStyle}
      approved={approved}
      isHebrew={false}
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
      Unfinished draft - this is not a final quote and cannot be approved.
    </div>
  ) : null;

  // Recipient ("To:") + Attn: natural LTR order; flexWrap drops Attn below on narrow screens. Roles: data-role="client"
  // / data-role="contact" (Attn, only when quote.attn_name exists). Visual treatment restored from the approved base
  // c65f742 (quoteDocument.css .pq-recipient).
  const parties = (
    <div className="pq-parties">
      <div className="pq-recipient pq-recipient-client" data-role="client">
        <div className="pq-recipient-label">
          <UserRound size={13} strokeWidth={2.4} />
          To:
        </div>
        <div className="pq-recipient-name">{client?.company_name || 'Valued Client'}</div>
        <div className="pq-recipient-intro">Hello, please find the price quote prepared for you below:</div>
        {client?.email && <div className="pq-recipient-detail">{client.email}</div>}
        {formatDisplayPhone(client?.phone) && <div className="pq-recipient-detail">{formatDisplayPhone(client.phone)}</div>}
        {client?.address && <div className="pq-recipient-detail">{formatAddress(client.address, false)}</div>}
        {/* Subject (ledger D09, cloud-fix4): back in the recipient card as base c65f742 ("Subject: X"). */}
        {quote.subject && (
          <div className="pq-recipient-subject pq-recipient-subject-en">
            <span className="pq-recipient-subject-label">Subject: </span>
            <span className="pq-recipient-subject-value">{quote.subject}</span>
          </div>
        )}
      </div>
      {quote.attn_name && (
        <div className="pq-recipient pq-recipient-contact" data-role="contact">
          <div className="pq-recipient-label">
            <UserRound size={13} strokeWidth={2.4} />
            Attn:
          </div>
          <div className="pq-recipient-name">{quote.attn_name}</div>
          {quote.attn_role && <div className="pq-recipient-detail">{quote.attn_role}</div>}
        </div>
      )}
    </div>
  );

  // Section-Level Smart Dropdown + Column-Geometry Lock contracts, identical to HE (see PublicQuote.jsx): flat quote =
  // plain four-column table; sectioned quote = independently-collapsible row groups; table-layout fixed + ONE <colgroup>.
  // Owner decision 2026-10-05: local exception to IRON-NUMERIC-001 shared right edge for the three item columns only -
  // Qty / Unit Price / Total (th + every td, unit and section rows) are physically CENTRED (.pf-money keeps its LTR
  // tabular isolation); Description stays left (language direction); the totals grid keeps the shared right edge.
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
  ].map((v) => `${currencySymbol}${formatNum(v)}`.length));
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
      <table role="table" className={`pq-commercial-table${wideAmounts ? ' pq-amounts-wide' : ''}`} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col className="pq-col-desc" style={{ width: '40%' }} />
          <col className="pq-col-qty" style={{ width: '18%' }} />
          <col className="pq-col-price" style={{ width: '21%' }} />
          <col className="pq-col-total" style={{ width: '21%' }} />
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            <th id={colId('desc')} scope="col" role="columnheader" className="pq-th-desc" style={{ textAlign: 'left' }}>Description</th>
            <th id={colId('qty')} scope="col" role="columnheader" className="pq-th-qty" style={{ textAlign: 'center' }}>Qty</th>
            <th id={colId('price')} scope="col" role="columnheader" className="pq-th-price" style={{ textAlign: 'center' }}>Unit Price</th>
            <th id={colId('total')} scope="col" role="columnheader" className="pq-th-total" style={{ textAlign: 'center' }}>Total</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {displaySections.length === 0 ? (
            (items || []).map((item, i) => {
              const isPro = Boolean(item.pricing_unit);
              const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : Number(item.quantity || 1);
              const unitLabel = isPro ? getProfessionalUnitLabel(item.pricing_unit, false) : '';
              return (
                <tr role="row" key={i}>
                  <td headers={colId('desc')} role="cell" className="pq-td-desc">{renderDescriptionCell(item, null)}</td>
                  <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}><span className="pq-num-slot">{isPro ? formatQty(activeQty) : item.quantity}</span><span className="pq-unit-slot">{isPro && unitLabel ? `\u00a0${unitLabel}` : ''}</span></td>
                  <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>Not priced yet</span> : <span className="pf-money">{currencySymbol}{formatNum(item.price)}</span>}</td>
                  <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>Not priced yet</span> : <span className="pf-money">{currencySymbol}{formatNum(item.total_price || item.price * item.quantity)}</span>}</td>
                </tr>
              );
            })
          ) : (
            displaySections.map((section) => {
              const isOpen = !!expandedSections[section.key];
              const chevron = isOpen ? '▲' : '▼';
              if (!isOpen) {
                // Section Summary Row Correction (same rule as HE): real item count, "—", authoritative subtotal.
                const itemCount = section.items.length;
                return (
                  <tr role="row" key={section.key}>
                    <td headers={colId('desc')} role="cell" className="pq-td-desc">
                      {/* PRODUCT_TRUTH_DECORATIVE: expands a collapsed line-item section row within the public quote view table */}
                      <button type="button" className="pq-section-toggle" onClick={() => toggleSection(section.key)} aria-expanded={false}>{`${section.title} ${chevron}`}</button>
                    </td>
                    <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}>{`${itemCount} item${itemCount === 1 ? '' : 's'}`}</td>
                    <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center' }}>—</td>
                    {/* IRON-NUMERIC-001 (local fix 7): a section summary amount is a SUMMARY value - it sits on the protected right axis
                        like the expanded section subtotal row; the item-column centring exception covers items only. */}
                    <td headers={colId('total')} role="cell" className="pq-td-total pq-td-summary" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span className="pf-money">{currencySymbol}{formatNum(section.subtotal)}</span></td>
                  </tr>
                );
              }
              return (
                <Fragment key={section.key}>
                  <tr role="row">
                    <td headers={colId('desc')} role="cell" colSpan="4" style={{ padding: '14px 10px 4px' }}>
                      {/* PRODUCT_TRUTH_DECORATIVE: collapses an expanded line-item section back to its summary row */}
                      <button type="button" className="pq-section-toggle" onClick={() => toggleSection(section.key)} aria-expanded={true}>{`${section.title} ${chevron}`}</button>
                    </td>
                  </tr>
                  {section.items.map((item, i) => {
                    const isPro = Boolean(item.pricing_unit);
                    const activeQty = isPro ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : Number(item.quantity || 1);
                    return (
                      <tr role="row" key={i}>
                        <td headers={colId('desc')} role="cell" className="pq-td-desc">{renderDescriptionCell(item, renderItemDetailLines(item, true))}</td>
                        <td headers={colId('qty')} role="cell" className="pq-td-qty" style={{ textAlign: 'center' }}><span className="pq-num-slot">{isPro ? formatQty(activeQty) : item.quantity}</span><span className="pq-unit-slot" /></td>
                        <td headers={colId('price')} role="cell" className="pq-td-price" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>Not priced yet</span> : <span className="pf-money">{currencySymbol}{formatNum(item.price)}</span>}</td>
                        <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{item.price_missing === true ? <span className="pq-price-missing" style={{ color: '#b45309', fontWeight: 600 }}>Not priced yet</span> : <span className="pf-money">{currencySymbol}{formatNum(item.total_price || item.price * item.quantity)}</span>}</td>
                      </tr>
                    );
                  })}
                  <tr role="row" className="pq-section-subtotal-row">
                    <td headers={colId('desc')} role="cell" colSpan="3" style={{ textAlign: 'right', fontWeight: 700 }}>{`Total ${section.title}:`}</td>
                    <td headers={colId('total')} role="cell" className="pq-td-total" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span className="pf-money">{currencySymbol}{formatNum(section.subtotal)}</span></td>
                  </tr>
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // Attachments - restored to the approved base c65f742 behaviour (retro audit R-5, 2026-10-05): ALWAYS rendered, with
  // the base empty-state line when there are none (same as HE), in the base container (ledger D17, cloud-fix3; the empty
  // line keeps a readable #64748b - Owner question Q5).
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const attachmentsBlock = (
    <div className={`pq-section pq-attachments${hasAttachments ? '' : ' pq-attachments--empty'}`}>
      <div className="pq-attachments-title">
        <Paperclip size={14} strokeWidth={2.2} color="#7c3aed" />
        Attached Files & Documents:
      </div>
      {hasAttachments ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attachments.map((att, idx) => (
            <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="pq-attachment-link" onClick={(e) => openAttachmentFresh(e, { att, index: idx, loadedAt: attachmentsLoadedAtRef.current, reload: reloadAttachments })}>
              📄 {att.file_name || `Attachment #${idx + 1}`}
            </a>
          ))}
        </div>
      ) : (
        <div className="pq-attachments-empty">No attachment included with this quote.</div>
      )}
    </div>
  );

  // Totals - one shared grid so every amount aligns in one column. Discount row (parity finding): red, no minus sign,
  // subtotal - total (no VAT breakdown exists for International).
  // Task 36 (Owner, section A): a line flagged price_missing (only when true) - the total is marked partial on the customer's document.
  const hasMissingPrice = (items || []).some((it) => it?.price_missing === true);
  const totalsBlock = (
    <div className="pq-totals-wrap" style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div className="pq-section pq-totals-grid pq-totals-box" style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
        {Number(quote.discount) > 0 && (
          <>
            <span className="pq-total-label pq-discount-negative">Discount ({quote.discount}%):</span>
            <span className="pf-money pq-total-value pq-discount-negative">{currencySymbol}{formatNum(Math.max(subtotal - total, 0))}</span>
          </>
        )}
        <span className="pq-total-label">Subtotal:</span>
        <span className="pf-money pq-total-value">{currencySymbol}{formatNum(subtotal)}</span>
        <div className="pq-total-rule" />
        <span className="pq-total-final-label">Total:</span>
        <span className="pf-money pq-total-final-amount">{currencySymbol}{formatNum(total)}</span>
        {hasMissingPrice && <span data-testid="pq-total-partial" className="pq-total-partial" style={{ gridColumn: '1 / -1', marginTop: '6px', fontSize: '0.82em', color: '#b45309', fontWeight: 600 }}>Partial total: some items in this quote are not priced yet.</span>}
      </div>
    </div>
  );

  // Terms / Warranty (frozen snapshot) / Notes - shown exactly as stored, never invented or translated.
  const noteEntries = [
    quote.terms ? { key: 'terms', title: 'Terms & Conditions:', body: quote.terms } : null,
    quote.warranty ? { key: 'warranty', title: 'Warranty:', body: quote.warranty } : null,
    quote.notes ? { key: 'notes', title: 'Additional Notes:', body: quote.notes } : null,
  ].filter(Boolean);
  const notesBlock = noteEntries.length > 0 ? (
    <div className="pq-doc-notes">
      {noteEntries.map((n) => (
        <div key={n.key} className="pq-section pq-doc-note">
          <div className="pq-doc-note-title">{n.title}</div>
          <div className="pq-doc-note-body">{n.body}</div>
        </div>
      ))}
    </div>
  ) : null;

  // Read-only approval / status record INSIDE the document (Owner-Approved Signature Record Improvement, same as HE).
  const signatureSrc = justSignedImageDataUrl || quote.signature;
  let approvalRecord = null;
  if (approved) {
    approvalRecord = (
      <div className="pq-section pq-approval pq-approval-signed" style={{ textAlign: 'start' }}>
        <div className="pq-approval-title">✓ This quote has been successfully approved and signed!</div>
        {signatureSrc && signatureSrc.startsWith('data:image') && (
          <div className="pq-approval-record">
            {justSignedAt ? (
              <div style={{ textAlign: 'start' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Signed by: {signerName}</div>
                {isBusinessCustomer && signerCompany && (
                  <div style={{ marginBottom: '2px' }}>On behalf of: {signerCompany}{signerRole ? ` (${signerRole})` : ''}</div>
                )}
                <div style={{ marginBottom: '2px' }}>
                  Signed on: {formatDeviceShortDateTime(justSignedAt, 'International')}
                </div>
                <div>
                  Quote #: {quoteNumberDisplay}
                </div>
                <img className="pq-signature-img" src={signatureSrc} alt="Client Signature" />
              </div>
            ) : (
              <div>
                <div>Digital Signature:</div>
                <img className="pq-signature-img" src={quote.signature} alt="Client Signature" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  } else if (isExpired && !isUnfinishedDraft) {
    approvalRecord = (
      <div className="pq-section pq-doc-status" role="status" data-testid="pq-expired">
        ⏳ This quote has expired and can no longer be approved or signed.
        <div className="pq-doc-status-sub">Please contact the business that sent it for an updated quote.</div>
      </div>
    );
  } else if (!isUnfinishedDraft) {
    approvalRecord = (
      <div className="pq-section pq-approval pq-print-only">
        <div className="pq-approval-copy">
          <div className="pq-approval-title">Quote approval</div>
          <p>Signature confirms the quotation terms</p>
        </div>
        <div className="pq-sigline">Signature</div>
      </div>
    );
  }

  // Unfinished draft, not signable (ledger D27, cloud-fix4): base c65f742 orange panel INSIDE the document, in the
  // approval area (same condition and text as before - only position and styling return to base).
  const unfinishedNotice = (!previewMode && !approved && !isOwnerViewing && isUnfinishedDraft) ? (
    <div className="pq-section pq-doc-status pq-doc-status-unfinished" role="status" data-testid="pq-unfinished-nosign">
      This quote is still being prepared, so it is not available for signature.
    </div>
  ) : null;

  // Document footer (ledger D23, cloud-fix4): base c65f742 International page has NO footer (no credit line); the Task 16
  // "{business} · {number}" line is removed.
  const docFooter = null;

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
        <span>{pdfGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
      </button>
      {/* PRODUCT_TRUTH_CAPABILITY: quote_print */}
      <button
        type="button"
        onClick={() => openPrintChooser('print')}
        className="pq-action-tile"
        style={{ background: 'white', color: '#475569', border: '2px solid #cbd5e1', cursor: 'pointer' }}
      >
        <Printer size={26} strokeWidth={1.75} />
        <span>Print Document</span>
      </button>
      {/* PRODUCT_TRUTH_CAPABILITY: public_call */}
      {bizPhone && (
        <a
          href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
          className="pq-action-tile"
          style={{ background: 'white', color: LIGHT.sky, border: `2px solid ${LIGHT.sky}`, textDecoration: 'none' }}
        >
          <Phone size={26} strokeWidth={1.75} />
          <span>Call us</span>
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
          <span>WhatsApp</span>
        </a>
      )}
    </div>
  );

  let signArea = null;
  if (previewMode) {
    signArea = (
      <div className="pq-app-notice pq-app-notice-preview" role="note" data-testid="pq-preview-notice">
        Preview of the document your customer receives. Approval and signature are available to the customer only through the shared link.
      </div>
    );
  } else if (approved) {
    // Task 27 (spec §6): the owner's optional thank-you - present only when the server returned it for this SIGNED quote
    signArea = <PublicThanksNotice thanks={quoteData?.output_channel ? null : (thanks ?? quoteData?.thanks ?? null)} isHebrew={false} />;
  } else if (isOwnerViewing) {
    signArea = (
      <div className="pq-app-notice pq-app-notice-info">
        ℹ️ Admin View: Signature area is displayed to the client only.
        {isExpired && (
          <div data-testid="pq-owner-expired-hint" style={{ marginTop: '8px', fontWeight: '500' }}>
            This quote has expired - your customer cannot sign it until you extend the validity date in the quote editor or send an updated quote.
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
        <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Client Signature to Approve This Quote:</h4>
        {/* Owner-Approved Signature Record Improvement - "smallest clear confirmation step": pre-filled from attn_name as
            an editable suggestion only; the value used is whatever the signer confirms by clicking Approve. */}
        <div style={{ maxWidth: '350px', margin: '0 auto 12px', textAlign: 'left' }}>
          <label htmlFor="pq-signer-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
            Signer's full name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="pq-signer-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="e.g. John Smith"
            aria-required="true"
            aria-invalid={signerNameWarning}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${signerNameWarning ? '#dc2626' : '#cbd5e1'}`, borderRadius: '8px', fontSize: '16px', textAlign: 'left', marginBottom: isBusinessCustomer ? '8px' : 0 }}
          />
          {isBusinessCustomer && (
            <>
              <label htmlFor="pq-signer-company" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                On behalf of (company) - optional
              </label>
              <input
                id="pq-signer-company"
                type="text"
                value={signerCompany}
                onChange={(e) => setSignerCompany(e.target.value)}
                placeholder="e.g. Acme Inc."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', textAlign: 'left', marginBottom: '8px' }}
              />
              <label htmlFor="pq-signer-role" style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                Title - optional
              </label>
              <input
                id="pq-signer-role"
                type="text"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="e.g. CEO"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '16px', textAlign: 'left' }}
              />
            </>
          )}
          {signerNameWarning && (
            <div role="alert" style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: '700', marginTop: '4px' }}>
              Please enter the signer's full name before approving
            </div>
          )}
        </div>
        {/* Mobile Signature Pad Scroll-Block Fix: pan-y by default + "Tap to sign" affordance; drawing only after an
            explicit tap (touchAction none); "Done" returns to scrolling without erasing the signature. */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto 10px', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
          <canvas ref={canvasRef} width={350} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{ display: 'block', touchAction: isActive ? 'none' : 'pan-y', cursor: isActive ? 'crosshair' : 'default', maxWidth: '100%', height: 'auto' }} />
          {/* PRODUCT_TRUTH_DECORATIVE: activates the signature-drawing canvas; sub-step of the already-marked public_quote_sign flow */}
          {!isActive && !hasSigned && (
            <button
              type="button"
              onClick={activateSigning}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'rgba(248,250,252,0.85)', border: 'none', color: '#475569', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Tap to sign
            </button>
          )}
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: clears the currently drawn signature before submission */}
          {(isActive || hasSigned) && (
            <button type="button" onClick={clearSignature} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Clear Signature</button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: ends signature-drawing mode without submitting approval */}
          {isActive && (
            <button type="button" onClick={deactivateSigning} style={{ background: LIGHT.violet, color: 'white', border: 'none', padding: '4px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>Done</button>
          )}
        </div>
        {signatureWarning && (
          <div role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '700', marginBottom: '10px' }}>
            Please sign the quote before approval
          </div>
        )}
        <div>
          {/* PRODUCT_TRUTH_CAPABILITY: public_quote_sign */}
          <button onClick={handleApprove} style={{ background: hasSigned ? LIGHT.gradient : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? LIGHT.glow : 'none', maxWidth: '100%', boxSizing: 'border-box' }}>
            Approve & Sign This Quote ✓
          </button>
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
        {showcaseMedia.length > 0 && <QuoteMediaRail media={showcaseMedia} isHebrew={false} />}
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
        {docStyle === 'visual' && showcaseMedia.length > 0 && <QuoteMediaHero media={showcaseMedia} isHebrew={false} />}
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
    <div className={`pq-page${pdfGenerating ? ' pq-pdf-capturing' : ''}${embeddedPreview ? ' pq-preview' : ''}${previewMode && standalonePrint ? ' pq-standalone-preview' : ''}`} data-print-mode={printMode} data-pq-style={docStyle} dir="ltr" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: previewMode ? 'transparent' : '#f8fafc', /* ledger D25b: base page tone */ minHeight: previewMode ? 0 : '100vh', padding: previewMode ? 0 : '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <style>{`${PQ_SCREEN_CSS}${embeddedPreview ? '' : PQ_PRINT_CSS}`}</style>
      {/* Same A4-width screen paper as HE: 794px white paper + 18px decorative frame per side = 830px outer card. */}
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
            isHebrew={false}
            intent={printIntent}
            onClose={() => setPrintModalOpen(false)}
            onChoose={handleChooseOutputMode}
          />
        )}
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={false} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Page CSS (hand-mirrored from PublicQuote.jsx). Screen rules always (first <style>, pinned by tests); print rules only
// outside previewMode so an embedded preview never leaks print CSS. The document look: src/quoteDocument/quoteDocument.css.
// ---------------------------------------------------------------------------------------------------------------------
const PQ_SCREEN_CSS = `
        .pq-card { padding: 28px 30px 20px; }
        /* Bottom Actions (Owner visual reference): equal tiles (flex:1), icon above label, uniform height. */
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
          /* Public Quote Mobile 4-Column Geometry Correction (mirrored from HE): the same four columns, a Mobile-only
             <colgroup> override + tighter cell padding. */
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
        /* Direct PDF via html2canvas (applied only while generateQuotePdf runs; capture root = .pq-card): drops the
           card chrome and every .no-print element inside it - the on-screen action tiles never reach the PDF. */
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
          /* ONE SHARED A4 DOCUMENT CONTRACT: 190mm, the same content width as generateQuotePdf.getA4ContentBoxPt();
             padding-bottom trimmed so a short document never spills a near-empty second page. */
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
