import { useEffect, useRef, useState } from 'react';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip, Phone, Printer, MessageCircle, Loader2 } from 'lucide-react';
import PdfFileIcon from '../components/PdfFileIcon';
import QuotePrintModeModal from '../components/QuotePrintModeModal';
import { classifyQuoteApprovalError } from '../utils/quoteApprovalErrorClassification';
import { formatAddress } from '../utils/addressFormat';
import { formatMoney } from '../utils/money';
import { formatQuoteFallback, formatQuoteNumber } from '../utils/quoteNumber';
import { generateQuotePdf, buildQuotePdfFilename } from '../utils/generateQuotePdf';

// Money Consolidation (Global Surface Audit finding I-1): this local
// formatNum used to Math.round() every amount before formatting - silently
// discarding cents on every International (USD/EUR/GBP) price/subtotal/
// discount/total on this entire page. International retains full cent
// precision always (no whole-unit rounding rule exists for International -
// that rule is Local/ILS-only, and lives exclusively in PublicQuote.jsx).
const formatNum = (val) => formatMoney(val);

const formatDisplayPhone = (phone) => {
  if (!phone) return '';
  return phone.trim();
};

export default function PublicQuoteEn({ quoteData }) {
  const { quote, business, client, items, attachments } = quoteData;
  const [approved, setApproved] = useState(quote.status === 'approved' || Boolean(quote.signature));
  const [signatureWarning, setSignatureWarning] = useState(false);
  const [approveToast, setApproveToast] = useState(null);

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
  const [printMode, setPrintMode] = useState('compact');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printIntent, setPrintIntent] = useState('print');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const handleAfterPrint = () => setPrintModalOpen(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const openPrintChooser = (intent) => {
    setPrintIntent(intent);
    setPrintModalOpen(true);
  };

  const handleChooseOutputMode = async (mode) => {
    setPrintMode(mode);
    setPrintModalOpen(false);

    if (printIntent === 'print') {
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
  }, []);

  const handleApprove = async () => {
    let blocked = false;
    if (!signerName.trim()) { setSignerNameWarning(true); blocked = true; }
    if (!hasSigned) { setSignatureWarning(true); blocked = true; }
    if (blocked) return;
    try {
      const signatureDataUrl = getSignatureDataUrl();
      const { error } = await supabase.rpc('public_approve_quote', {
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
    } catch (err) {
      // Technical/database details stay in the console only - the public
      // customer sees a safe, specific message (classifyQuoteApprovalError),
      // never raw error.message. The UI already prevents the business-account
      // case up front (below, isOtherBusinessAccount) - this is defense-in-
      // depth for a stale/already-open client only.
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

  const bizName = business?.business_name || 'TEKANGO Business';
  const bizLogo = business?.logo_url;
  const bizTaxId = business?.tax_id;
  const bizEmail = business?.email;
  const bizPhone = formatDisplayPhone(business?.phone);
  const bizAddress = business?.address;
  const isOwnerViewing = quote.is_owner_viewing;
  // Iron rule (Signature Contract Fix, systemic remediation task): any OTHER
  // authenticated business account (not this quote's own owner) is blocked
  // from signing as the customer by the RPC (public_approve_quote,
  // 20260831000000) - but until this fix the UI only hid the signing area
  // from the exact owner, so a different business account still saw the full
  // signing UI and only got a generic failure after signing. caller_is_
  // business_account (get-public-quote) mirrors that exact decision, read-
  // only, so the UI blocks it up front, before canvas entry, without ever
  // touching the RPC itself.
  const isOtherBusinessAccount = Boolean(quote.caller_is_business_account) && !isOwnerViewing;

  // Public Quote Redesign - WhatsApp contact action: same phone
  // normalization as sendWhatsApp (Dashboard.jsx) and PublicQuote.jsx (HE) -
  // not a third independent formula. The visitor here IS the client, so
  // this messages the business, not the client.
  const bizWhatsAppHref = (() => {
    const raw = business?.phone ? String(business.phone).trim() : '';
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

  return (
    <div className={`pq-page${pdfGenerating ? ' pq-pdf-capturing' : ''}`} data-print-mode={printMode} dir="ltr" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <style>{`
        .pq-card { padding: var(--pf-doc-shell-padding); }
        /* Iron rule (Public Quote Bottom Actions - Owner visual reference):
           three equal tiles (flex:1) in one group, icon above label,
           uniform height. pq-action-tiles-two (added when no valid
           bizPhone) doesn't change the layout mechanism - it just removes
           one tile; the remaining two stay flex:1 equal to each other. */
        .pq-action-tiles { align-items: stretch; }
        .pq-action-tile {
          flex: 1 1 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 92px;
          padding: 14px 8px;
          border-radius: 16px;
          text-align: center;
          font-weight: 700;
          font-size: 0.82rem;
          box-sizing: border-box;
        }
        /* Iron rule (Width Consistency Fix, this pass - see src/index.css
           for the full explanation): --pf-desktop-content-width is the
           VISUAL CONTENT width, not the shell width. The white document
           shell (.pq-card) has its own decorative padding+border (40px +
           1px) between the shell boundary and the visible content inside
           it - applying the token directly to the shell's own max-width
           (as a prior pass did) made the shell 980px while the actual
           visible content inside it was only 898px (980 - 2*40px padding
           - 2*1px border) - an 82px/8.4% mismatch against Dashboard.jsx's
           true 980px content, live-measured and owner-confirmed as a real
           defect. Fixed: the shell's own max-width now adds the padding/
           border budget back on top of the content token via calc(), so
           the shell is wider than 980px by exactly its own decorative
           inset, and the content sections inside it (plain block children
           filling the shell's content box) come out to exactly 980px
           automatically - no change needed to any individual section's
           own width. */
        @media (min-width: 1024px) {
          .pq-card-desktop-width {
            width: 100% !important;
            max-width: calc(var(--pf-desktop-content-width) + (2 * var(--pf-doc-shell-padding)) + (2 * var(--pf-doc-shell-border-width))) !important;
          }
        }
        @media (max-width: 640px) {
          /* Iron rule (owner-approved correction - genuine mobile width,
             not A4): the outer wrapper's fixed 20px padding (.pq-page) was
             the root cause of the "A4 page floating in the phone" feel -
             it was never viewport-dependent at all. Reduced to 6px only
             below 640px (owner's 4-8px target), Desktop's original 20px
             untouched outside this media query. */
          .pq-page {
            padding: 4px !important;
          }
          /* Iron rule (owner correction, third pass - "still looks like an
             A4 page"): live measurement showed the real problem was not
             .pq-card's own width (378px of 390px - already inside target)
             but that every individually-visible block (attachments/totals/
             terms/notes/signature) still kept its original desktop-only
             internal padding (15-20px) that no mobile pass had ever
             touched, stacked on top of the card's own 12px padding. That
             doubled inset per side is what still read as "a page with
             margins" even though the outer wrapper chain itself already
             measured correctly. Fix: the card's own padding is now nearly
             zero on Mobile (each block already supplies its own visual
             separation via its own background/border - the card no longer
             needs to add a second "paper frame" on top of that), and a
             new shared class (pq-section) applies one consistent, sane
             padding (10px 12px) to every one of those blocks, so all of
             them - not just the outer wrapper - actually align to the
             same visual width. */
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
          .pq-recipient-name {
            font-size: 0.95rem !important;
            margin-top: 2px !important;
          }
          /* Iron rule: the group stays one horizontal row on mobile too
             (not stacked into separate full-width buttons) - only padding/
             font/gap shrink so labels stay readable and the touch target
             stays usable at 360-390px. */
          .pq-action-tile {
            min-height: 78px !important;
            padding: 10px 4px !important;
            font-size: 0.7rem !important;
            gap: 4px !important;
          }
        }
        /* Item 7 (Public Quote Print): .no-print (src/index.css) already
           hides the signature-input controls and the bottom action bar
           globally under @media print - this block only removes decorative
           page chrome (outer padding, card shadow/border) that wastes paper
           and looks wrong once actually printed, without hiding any content. */
        @media print {
          .pq-page {
            background: #ffffff !important;
            padding: 0 !important;
            display: block !important;
            min-height: 0 !important;
          }
          .pq-card {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
          }
          /* Public Quote Redesign - Print/PDF: A4-first pagination, no
             interactive chrome, avoided page splits, thead repetition. */
          @page {
            size: A4;
            margin: 12mm 10mm;
          }
          table { border-collapse: collapse; }
          thead { display: table-header-group; }
          tr, .pq-section, .pq-recipient, .pq-action-tile {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* PDF Correction task - Readability: the dark header reads great
             on screen but is unreadable in print - here, and only here, the
             header becomes a light box with solid dark text. */
          .pq-header-box {
            background: #ffffff !important;
            border: 1.5px solid #334155 !important;
            box-shadow: none !important;
          }
          .pq-header-box, .pq-header-box * {
            color: #0f172a !important;
            text-shadow: none !important;
          }
          .pq-header-glass {
            background: #f1f5f9 !important;
            border: 1px solid #94a3b8 !important;
          }
          .pq-header-number { color: #4338ca !important; }
          .pq-header-valid { color: #b91c1c !important; }
          .pq-card, .pq-card * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .pq-total-final-label, .pq-total-final-amount {
            color: #0f172a !important;
          }
          .pq-total-final-amount {
            color: #4c1d95 !important;
          }
          .pq-totals-box {
            border: 1.5px solid #0f172a !important;
            background: #f8fafc !important;
          }
          .pq-discount-negative {
            color: #b91c1c !important;
          }
        }
        /* PDF Correction task - Direct PDF via html2canvas: this class is
           applied only for the moment generateQuotePdf runs - repeats the
           identical logic under an explicit class instead of a media query
           (real Print stays untouched, but shares the same color values so
           PDF and print output look consistent). */
        .pq-pdf-capturing .no-print {
          display: none !important;
        }
        .pq-pdf-capturing .pq-card {
          box-shadow: none !important;
          border: none !important;
        }
        .pq-pdf-capturing .pq-header-box {
          background: #ffffff !important;
          border: 1.5px solid #334155 !important;
          box-shadow: none !important;
        }
        .pq-pdf-capturing .pq-header-box, .pq-pdf-capturing .pq-header-box * {
          color: #0f172a !important;
        }
        /* Faded PDF Logo Correction task - live-proven: html2canvas paints
           the .pq-logo-chip's translucent background OVER its child logo
           image, not behind it. Since .pq-header-box is already forced
           fully opaque white at capture time, the chip's own background is
           redundant then - removing it (transparent) only during capture
           eliminates the bug's opportunity entirely. Shared component with
           PublicQuote.jsx - same rule there. */
        .pq-pdf-capturing .pq-logo-chip {
          background: transparent !important;
        }
        .pq-pdf-capturing .pq-header-glass {
          background: #f1f5f9 !important;
          border: 1px solid #94a3b8 !important;
        }
        .pq-pdf-capturing .pq-header-number { color: #4338ca !important; }
        .pq-pdf-capturing .pq-header-valid { color: #b91c1c !important; }
        .pq-pdf-capturing .pq-total-final-label,
        .pq-pdf-capturing .pq-total-final-amount {
          color: #0f172a !important;
        }
        .pq-pdf-capturing .pq-total-final-amount {
          color: #4c1d95 !important;
        }
        .pq-pdf-capturing .pq-totals-box {
          border: 1.5px solid #0f172a !important;
          background: #f8fafc !important;
        }
        .pq-pdf-capturing .pq-discount-negative {
          color: #b91c1c !important;
        }
        .pq-spin {
          animation: pq-spin-rotate 0.9s linear infinite;
        }
        @keyframes pq-spin-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {/* Iron rule (owner-approved correction - responsive document, not A4):
          maxWidth increased from 800px to 1100px, mirroring PublicQuote.jsx -
          800px caused excessive side margins on wide desktops and an "A4
          page squeezed in the browser" feel. Mobile is unaffected -
          width:'100%' already caps at the actual screen width regardless
          of maxWidth.
          Owner correction (Baseline Closure Part 11 - Desktop overshot):
          reduced by ~10% of the previously-implemented width (not 10
          viewport percentage points): 92%->82.8%, maxWidth 1400px->1260px
          (both *0.9). New approx targets: 1366px->~1098px,
          1440px->~1157px, 1920px->1260px, matching the owner's guidance
          range. Mobile (base width:100%) untouched - this only lives
          inside @media (min-width:1024px).
          Third correction (Global Surface Audit + Implementation Pass): the
          owner reported 82.8%/1260px was still too wide against a
          reference quote - no reference file/image was actually supplied
          this pass, flagged explicitly rather than guessed past silently
          (same honesty precedent as the earlier missing-image episode in
          §18.AX). Switched from a viewport-percentage model to a stable
          fixed document max-width instead of a third percentage cut:
          980px, still centered via the existing .pq-page justifyContent:
          'center'. Wider than the old 800px (previously judged "too
          narrow/A4-like") but meaningfully narrower than 1260px - a
          reasoned choice against the qualitative guidance given (centered,
          professional document proportions, readable tables), not measured
          against an actual reference image. Should be revisited precisely
          once a reference is supplied. Mobile untouched.
          Fourth correction (Owner decision - Global Surface Audit
          follow-up): the Owner confirmed 980px as the canonical Desktop
          width SHARED with the authenticated app (Dashboard.jsx), which
          previously used its own independent 1040px - the two-value split
          was rejected as an inconsistency. The value is now sourced from
          one shared CSS variable, --pf-desktop-content-width
          (src/index.css), referenced by this file, PublicQuote.jsx, and
          Dashboard.jsx - no more locally-duplicated literals to drift
          apart.
          Fifth correction (Width Consistency Fix, this pass): while wiring
          up the shell-vs-content calc() fix (see the .pq-card-desktop-width
          rule above), found this shell was missing the 1px border that
          PublicQuote.jsx's own shell already has (`border: 'var(--pf-doc-
          shell-border-width) solid #e2e8f0'`) - a pre-existing, purely
          accidental HE/EN styling drift (both share the same .pq-card
          class/padding, but only the Hebrew file's inline style ever had
          an explicit border). Added it here too so both language shells
          are visually identical AND so the shared calc() formula (content
          + 2*padding + 2*border) is accurate for both files without a
          special-cased exception for English's border being 0. */}
      <div ref={cardRef} className="pq-card pq-card-desktop-width" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'var(--pf-doc-shell-border-width) solid #e2e8f0', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' }}>
        <PublicQuoteHeader isHebrew={false} bizLogo={bizLogo} bizName={bizName} bizTaxId={bizTaxId} bizPhone={bizPhone} bizEmail={bizEmail} bizAddress={bizAddress} quote={quote} />

        {/* Iron rule (owner correction - recipient visual hierarchy): the
            label stays dark/normal - the recipient's own data (name, and
            any other client fields this page shows) moves to the brand
            purple (LIGHT.violet, same token as the header/other purple
            emphasis) to give the customer's identity more visual
            prominence, mirroring the identical inversion made on the
            Hebrew page. Label text aligned to "To:" per the owner's own
            approved example composition (was "Client:") - wording only,
            no recipient data changed. */}
        {/* Item 18 (Attn parity) - same flex-row-with-wrap pattern as the
            Hebrew page: recipient first in DOM lands on the left under
            natural LTR ("To:"), Attn second lands on the right ("Attn:"),
            matching the TODO's own English example composition with no
            extra ordering logic. flexWrap drops Attn below on narrow/
            Mobile screens automatically. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '25px' }}>
        <div className="pq-recipient" style={{ flex: '1 1 240px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}`, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase' }}>
            <UserRound size={13} strokeWidth={2.4} />
            To:
          </div>
          <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', marginTop: '4px', color: LIGHT.violet }}>{client?.company_name || 'Valued Client'}</div>
          {/* Public Quote Redesign - "respectful intro sentence": display
              only, never saved, never affects any calculation - mirrors the
              Hebrew page's own intro line. */}
          <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '2px', marginBottom: '6px' }}>
            Hello, please find the price quote prepared for you below:
          </div>
          {/* Baseline Closure Part 16 (English recipient contact parity):
              client.email/phone/address already exist in the payload
              (get-public-quote/index.ts already selects+returns them - this
              is not new data, only a previously-missing presentation on
              this page; the Hebrew page has shown these fields for a while).
              Natural LTR order/alignment - no direction override needed
              since this whole page is already dir="ltr", unlike Hebrew
              which needed an explicit LTR override inside its RTL context. */}
          {client?.email && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', marginTop: '4px' }}>{client.email}</div>}
          {formatDisplayPhone(client?.phone) && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', marginTop: '2px' }}>{formatDisplayPhone(client.phone)}</div>}
          {client?.address && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', marginTop: '2px' }}>{formatAddress(client.address, false)}</div>}
          {quote.subject && <div style={{ marginTop: '10px', fontWeight: 'bold' }}>Subject: <span style={{ fontWeight: 'normal' }}>{quote.subject}</span></div>}
        </div>

        {quote.attn_name && (
          <div className="pq-recipient" style={{ flex: '1 1 240px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}`, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase' }}>
              <UserRound size={13} strokeWidth={2.4} />
              Attn:
            </div>
            <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', marginTop: '4px', color: LIGHT.violet }}>{quote.attn_name}</div>
            {quote.attn_role && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', marginTop: '2px' }}>{quote.attn_role}</div>}
          </div>
        )}
        </div>

        {/* Iron rule (parity fix): wrapped in an overflowX:'auto' container
            with no forced minWidth, exactly mirroring PublicQuote.jsx's
            Hebrew table structure - this wrapper was previously missing
            here entirely, a genuine gap risking horizontal page overflow
            on narrow/mobile screens. No minWidth is set (matching Hebrew),
            so the table shrinks/wraps naturally on narrow screens instead
            of forcing a horizontal scrollbar - true composition parity,
            not just a defensive safety net that behaves differently. */}
        <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#475569' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Unit Price</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 10px' }}>{item.description || 'Item'}</td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}><span className="pf-money">{currencySymbol}{formatNum(item.price)}</span></td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold' }}><span className="pf-money">{currencySymbol}{formatNum(item.total_price || item.price * item.quantity)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Attachments Section - always visible (product awareness: the customer
            should see the system supports attachments even when none exist) */}
        <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
            <Paperclip size={14} color={LIGHT.violet} strokeWidth={2.2} />
            Attached Files & Documents:
          </div>
          {attachments && attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att, idx) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: LIGHT.violet, textDecoration: 'underline', fontSize: '0.9rem', fontWeight: '600' }}>
                  📄 {att.file_name || `Attachment #${idx + 1}`}
                </a>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No attachment included with this quote.</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div className="pq-section pq-totals-box" style={{ width: '100%', maxWidth: '380px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, boxSizing: 'border-box' }}>
            {/* Iron rule (owner correction - parity audit finding): this row
                did not exist at all before - a discounted quote showed
                Subtotal then Total with no visible explanation for the
                difference, exactly the "data silently disappears due to
                market" gap this pass was tasked with finding and fixing
                (not market-specific decoration - a real transactional
                value). Mirrors the Hebrew page's discount row exactly:
                red, no visual minus sign. Uses subtotal-total directly
                (no VAT breakdown exists on this page at all, unlike
                Hebrew's calculateQuoteFinancials - that is a separate,
                larger, not-yet-audited question, not conflated with this
                targeted fix). */}
            {Number(quote.discount) > 0 && (
              <div className="pq-discount-negative" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#ef4444' }}>
                <span>Discount ({quote.discount}%):</span>
                <span className="pf-money">{currencySymbol}{formatNum(Math.max(subtotal - total, 0))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Subtotal:</span><span className="pf-money">{currencySymbol}{formatNum(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', borderTop: `2px solid ${LIGHT.borderStrong}`, paddingTop: '12px' }}>
              <span className="pq-total-final-label">Total:</span><span className="pf-money pq-total-final-amount" style={{ color: LIGHT.violet }}>{currencySymbol}{formatNum(total)}</span>
            </div>
          </div>
        </div>

        {/* Baseline Closure Part 15 (English Terms/Notes parity): quote.terms
            and quote.notes already exist in the payload (get-public-quote/
            index.ts already selects+returns both) and are already shown on
            the Hebrew page - this page simply never rendered them. Generic
            English section headings ("Terms & Conditions:" / "Additional
            Notes:"), not a translation of the Hebrew labels; the field
            content itself (quote.terms / quote.notes) is shown exactly as
            stored - never invented or translated. */}
        {quote.terms && (
          <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Terms & Conditions:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.terms}</div>
          </div>
        )}

        {/* Item 23 Warranty: quote.warranty is a frozen snapshot from quote
            creation time - never re-fetched from current Business Settings.
            Not rendered at all if null/empty, same as quote.terms/notes above. */}
        {quote.warranty && (
          <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Warranty:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.warranty}</div>
          </div>
        )}

        {quote.notes && (
          <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Additional Notes:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.notes}</div>
          </div>
        )}

        {approved ? (
          <div className="pq-section" style={{ background: '#dcfce7', color: '#166534', padding: '20px', borderRadius: '12px', fontWeight: 'bold', textAlign: 'center' }}>
            ✓ This quote has been successfully approved and signed!
            {/* Owner-Approved Signature Record Improvement: quote.signature is
                a static prop from the initial page load, never refetched
                after the RPC - right after a first sign it is still null.
                justSignedImageDataUrl (the exact bytes just sent to the
                server) is checked first so the image renders immediately. */}
            {(justSignedImageDataUrl || quote.signature) && (justSignedImageDataUrl || quote.signature).startsWith('data:image') && (
              <div style={{ marginTop: '10px' }}>
                {/* justSignedAt only exists for a signature made right now,
                    this page load (not persisted). A separate/later visit
                    intentionally falls back to the old generic label rather
                    than fabricating a name/date. */}
                {justSignedAt ? (
                  <div style={{ textAlign: 'start' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '6px' }}>Signed by: {signerName}</div>
                    {isBusinessCustomer && signerCompany && (
                      <div style={{ fontSize: '0.85rem', marginBottom: '2px' }}>On behalf of: {signerCompany}{signerRole ? ` (${signerRole})` : ''}</div>
                    )}
                    <div style={{ fontSize: '0.82rem', color: '#166534', marginBottom: '2px' }}>
                      Signed on: {justSignedAt.toLocaleDateString('en-GB')}, {justSignedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#166534', marginBottom: '8px' }}>
                      Quote #: {formatQuoteNumber(quote.quote_number) || formatQuoteFallback(quote)}
                    </div>
                    <img src={justSignedImageDataUrl || quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '5px', fontSize: '0.9rem' }}>Digital Signature:</div>
                    <img src={quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isOwnerViewing ? (
          <div className="pq-section" style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe', textAlign: 'center' }}>
            ℹ️ Admin View: Signature area is displayed to the client only.
          </div>
        ) : isOtherBusinessAccount ? (
          <div className="pq-section" style={{ background: '#fff7ed', color: '#9a3412', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #fed7aa', textAlign: 'center' }}>
            ⚠️ This quote cannot be signed from a logged-in business account. To sign as the customer, open this link in a private/incognito window, or sign out of your business account first.
          </div>
        ) : (
          <div className="pq-section no-print" style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Client Signature to Approve This Quote:</h4>
            {/* Owner-Approved Signature Record Improvement - "smallest clear
                confirmation step": pre-filled from attn_name (the value the
                business entered, not confirmed by the signer) as an editable
                suggestion only - the value actually used for display is
                whatever the signer sees and confirms by clicking Approve. */}
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
            {/* Iron rule (Mobile Signature Pad Scroll-Block Fix, real-device
                Owner correction): the canvas used to always be touchAction:
                'none' - any vertical swipe over it (even one meant to scroll
                the page) got captured and drew a line instead of scrolling.
                Now, by default (isActive=false) the canvas allows normal
                vertical scrolling through it (touchAction:'pan-y') and shows
                a semi-transparent "Tap to sign" activation affordance - only
                an explicit tap/click on it switches to drawing mode
                (touchAction:'none', captures everything including vertical
                strokes - the legitimate intent at that point). "Done"
                returns to normal scroll without erasing the signature. */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto 10px', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', boxSizing: 'border-box', overflow: 'hidden' }}>
              <canvas ref={canvasRef} width={350} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{ display: 'block', touchAction: isActive ? 'none' : 'pan-y', cursor: isActive ? 'crosshair' : 'default', maxWidth: '100%', height: 'auto' }} />
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
              {(isActive || hasSigned) && (
                <button type="button" onClick={clearSignature} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Clear Signature</button>
              )}
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
              <button onClick={handleApprove} style={{ background: hasSigned ? LIGHT.gradient : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? LIGHT.glow : 'none', maxWidth: '100%', boxSizing: 'border-box' }}>
                Approve & Sign This Quote ✓
              </button>
            </div>
          </div>
        )}

        {/* Public Quote PDF Correction task - Bottom Actions: 4 tiles,
            PDF/Print/Call/WhatsApp, each with an action-specific semantic
            color. **Root cause fixed this round**: previously "Download PDF"
            and "Print Document" both called window.print() only - "Download
            PDF" was never a real direct download. The two paths now fully
            diverge (see handleChooseOutputMode above): "Print Document"
            still only ever calls window.print() (untouched); "Download PDF"
            calls the real generateQuotePdf and produces a real .pdf file.
            Both paths share the same QuotePrintModeModal. "Call Me" keeps
            the exact same bizPhone/tel: normalization as PublicQuoteHeader.jsx's
            own CTA. WhatsApp hidden under the same condition. Whole group +
            modal are no-print. */}
        <div className={`pq-action-tiles no-print ${bizPhone ? '' : 'pq-action-tiles-two'}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', paddingBottom: '5px' }}>
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
          <button
            type="button"
            onClick={() => openPrintChooser('print')}
            className="pq-action-tile"
            style={{ background: 'white', color: '#475569', border: '2px solid #cbd5e1', cursor: 'pointer' }}
          >
            <Printer size={26} strokeWidth={1.75} />
            <span>Print Document</span>
          </button>
          {bizPhone && (
            <a
              href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
              className="pq-action-tile"
              style={{ background: 'white', color: LIGHT.sky, border: `2px solid ${LIGHT.sky}`, textDecoration: 'none' }}
            >
              <Phone size={26} strokeWidth={1.75} />
              <span>Call Me</span>
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

        <QuotePrintModeModal
          open={printModalOpen}
          isHebrew={false}
          intent={printIntent}
          onClose={() => setPrintModalOpen(false)}
          onChoose={handleChooseOutputMode}
        />
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={false} />
    </div>
  );
}
