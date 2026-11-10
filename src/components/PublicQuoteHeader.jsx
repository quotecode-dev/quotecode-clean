import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { formatQuoteNumber, formatQuoteFallback } from '../utils/quoteNumber';
import { formatAddress } from '../utils/addressFormat';
import { formatShortDate } from '../utils/shortDate';
import '../quoteDocument/quoteDocument.css';

// Task 16 - Quote Experience V2: the customer document letterhead, shared by PublicQuote.jsx (HE/Local) and
// PublicQuoteEn.jsx (EN/International) - and used standalone by ProfessionalPublicPreview.jsx. No money is rendered here.
//
// variant:
//   'classic' (default, and the legacy fallback): WHITE letterhead - issuer identity (logo when present, else the
//              business name), ONE thin accent rule, the typographic title, then the centred metadata row.
//              Replaces the former dark gradient banner (which needed print/PDF colour inversions to stay legible).
//   'modern':   editorial split header - issuer | metadata column in the band, the large title below it.
//   'visual':   brandline (issuer + quote number), title, then a metadata row.
//
// Header Call CTA (Owner 2026-10-07): the "חייג/י אליי" / "Call me" pill sits in the upper outer corner of the
// screen letterhead (physical left in Hebrew, physical right in English), instead of consuming a row below metadata.
// It is rendered only when the business has a phone, as in base. It is a tel:
// action, so it stays OUT of the printed document and the Direct PDF capture (`no-print` + `data-html2canvas-ignore`,
// hidden under .pq-pdf-capturing): the approved no-UI-in-output contract (CONTRACT.md §4, IRON-PRINT-001 gate
// print/no-ui-text, which lists 'חייג/י אליי') - base printed it; that difference is recorded in the A13 report.
// The business phone also stays in the issuer details as plain text (printed).
//
// Title / subject (cloud-fix4, ledger D09): the title is the base text "הצעת מחיר" / "Price Quote" in every style (the
// subject is back in the recipient card as base "נושא ההצעה: X" / "Subject: X", rendered by the pages). The base
// position (centred inside the quote-info box) is NOT restored: CORRECTION C "Do NOT center the quotation title" and the
// locked band composition keep the start-aligned h1 below the band. The Visual band kicker labels the number
// ("מס׳ הצעה" / "Quote #") so the title is not printed twice; the Modern "<quote> <number>" kicker is gone for the same
// reason (the number is in the metadata column).
//
// Kept contracts (PublicQuoteHeader.test.jsx): .pq-header-box / .pq-header-glass / .pq-logo-chip hooks, the logo <img>
// with crossOrigin="anonymous" + plain-loading fallback, a long business name that wraps (never truncates), the
// 'מס׳ הצעה' / 'Quote #' label, the JS matchMedia mobile branch with a centred metadata stack, and the expired marker
// (data-testid="pq-header-expired").
export default function PublicQuoteHeader({ isHebrew, bizLogo, bizName, bizTaxId, bizPhone, bizEmail, bizAddress, quote, isExpired = false, variant = 'classic', approved = false, compact, showNameWithLogo = false }) {
  const hasLogo = bizLogo && bizLogo.length > 5;

  // Faded PDF Logo Correction task: crossOrigin="anonymous" keeps the html2canvas canvas untainted; on a CORS failure
  // the image falls back to plain loading so on-screen display never breaks.
  const [logoCrossOriginFailed, setLogoCrossOriginFailed] = useState(false);
  useEffect(() => {
    setLogoCrossOriginFailed(false);
  }, [bizLogo]);
  const logoCrossOrigin = logoCrossOriginFailed ? undefined : 'anonymous';
  const handleLogoError = () => setLogoCrossOriginFailed(true);

  // Owner-approved compact mobile header (a real JS branch, not CSS only) - kept for the Classic letterhead.
  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const recompute = () => setIsMobileView(window.matchMedia('(max-width: 768px)').matches);
    recompute();
    const mq = window.matchMedia('(max-width: 768px)');
    mq.addEventListener ? mq.addEventListener('change', recompute) : mq.addListener(recompute);
    window.addEventListener('resize', recompute);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', recompute) : mq.removeListener(recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  // IRON-DATE-001: the HE public page IS the Local market page and the EN page the International one (same rule as OD-1 validity).
  const dateMarket = isHebrew ? 'Local' : 'International';
  const dateStr = formatShortDate(quote.created_at, dateMarket);
  // project_name (IRON-QUOTE-002): the issuer's project identity is part of the customer-facing quote when set.
  const projectName = String(quote.project_name || '').trim();
  const validUntilStr = quote.valid_until ? formatShortDate(quote.valid_until, dateMarket) : null;
  // Quote Number Transition: formatQuoteNumber is null until quote_number exists - every surface falls back to the
  // short-id display (formatQuoteFallback) under the SAME label, so the composition never changes shape.
  const numberDisplay = formatQuoteNumber(quote.quote_number) || formatQuoteFallback(quote);

  // ledger D08 (cloud-fix4): base c65f742 EN phone label "Valid:" (the compact branch: a phone viewport <= 768px, or the
  // compact preview frame); "Valid until" at document widths, Print and the Direct PDF capture (compact={false}).
  const phoneLabels = typeof compact === 'boolean' ? compact : isMobileView;
  const L = isHebrew
    ? { quote: 'הצעת מחיר', number: 'מס׳ הצעה', date: 'תאריך', valid: 'בתוקף עד', project: 'פרויקט', expired: 'פג תוקף', signed: 'נחתמה', taxId: 'ח״פ / עוסק:', phone: 'טלפון:' }
    : { quote: 'Price Quote', number: 'Quote #', date: 'Date', valid: phoneLabels ? 'Valid:' : 'Valid until', project: 'Project', expired: 'Expired', signed: 'Signed', taxId: 'Tax ID:', phone: 'Phone:' };

  const details = (
    <div className="pq-lh-details" dir={isHebrew ? 'rtl' : 'ltr'}>
      {bizTaxId && <div>{L.taxId} <bdi dir="ltr">{bizTaxId}</bdi></div>}
      {/* Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #21: the "Phone:" label before the number again */}
      {bizPhone && <div className="pq-lh-phone">{L.phone} <bdi dir="ltr">{bizPhone}</bdi></div>}
      {bizEmail && <div><bdi dir="ltr">{bizEmail}</bdi></div>}
      {bizAddress && <div>{formatAddress(bizAddress, isHebrew)}</div>}
    </div>
  );

  // Long Business Name / PDF fix: the name wraps (overflowWrap/wordBreak break-word) inside a minWidth:0 column.
  const issuer = (nameAsHeading) => (
    <div className={`pq-lh-issuer${hasLogo ? ' pq-lh-issuer--logo' : ''}`} style={{ minWidth: 0 }}>
      {hasLogo ? (
        <div className={`pq-logo-chip${showNameWithLogo ? ' pq-logo-chip--named' : ''}`}>
          <img src={bizLogo} alt={bizName} crossOrigin={logoCrossOrigin} onError={handleLogoError} />
          {showNameWithLogo
            ? <span className="pq-logo-visible-name">{bizName}</span>
            : <span className="pq-logo-name-sr">{bizName}</span>}
        </div>
      ) : nameAsHeading ? (
        <h2 className="pq-lh-name" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{bizName}</h2>
      ) : (
        <div className="pq-lh-name" style={{ whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>{bizName}</div>
      )}
      {details}
    </div>
  );

  // Metadata cells (Owner correction 2026-10-05): each label and ITS OWN value are centred inside their own cell with
  // the same spacing in every style, HE and EN, screen + print + PDF; no decorative rule above the metadata. The title is
  // not centred and the other document separators (accent rule, table/totals/approval rules) stay.
  const cell = (key, label, value, { valueClass = '', valueDir, after = null } = {}) => (
    <div key={key} className={`pq-meta-cell pq-meta-${key}`} style={{ textAlign: 'center' }}>
      <div className="pq-meta-label">{label}</div>
      <div className={`pq-meta-value ${valueClass}`.trim()} dir={valueDir}>
        {value}
        {after}
      </div>
    </div>
  );
  const numberCell = cell('number', L.number, numberDisplay, { valueClass: 'pq-header-number', valueDir: 'ltr' });
  const dateCell = cell('date', L.date, dateStr);
  // Screen parity: a missing validity date must not collapse the approved three-cell header into two oversized cells.
  // The reserved cell says "—" (no invented date) and is excluded from native print and Direct PDF capture.
  const validCell = validUntilStr
    ? cell('valid', L.valid, validUntilStr, {
      valueClass: `pq-header-valid${isExpired ? ' pq-is-expired' : ''}`,
      after: isExpired ? <span data-testid="pq-header-expired"> · {L.expired}</span> : null,
    })
    : (
      // Owner 2026-10-19 (option ב): the reserved cell keeps its exact place and size but shows nothing - no label, no dash (its
      // invisible content only holds the approved three-cell geometry; screen readers skip it)
      <div key="valid" className="pq-meta-cell pq-meta-valid pq-meta-placeholder no-print" data-html2canvas-ignore="true" aria-hidden="true" style={{ visibility: 'hidden' }}>
        <div className="pq-meta-label">{L.valid}</div>
        <div className="pq-meta-value pq-header-valid" aria-hidden="true">—</div>
      </div>
    );
  // project_name (IRON-QUOTE-002) is a metadata field like the others.
  const projectCell = projectName ? cell('project', L.project, projectName, { valueClass: 'pq-header-project' }) : null;
  const metaGrid = (cells, extraClass = '') => (
    <div className={`pq-header-glass pq-meta ${extraClass}`.trim()} style={{ textAlign: 'center', minWidth: 0 }} data-pq-meta-count={cells.filter(Boolean).length}>
      {cells}
    </div>
  );
  // base: the number never shows on the button itself (tel: href only); white pill, sky text, 0.8rem/700. The compact
  // branch was 0.7rem (11.2px) in base; it is 0.75rem = 12px, the later 12px screen floor (IRON-MOBILE-WIDTH-001).
  // CTA ink: base LIGHT.sky (#0284c7, src/theme/neonTheme.js) is 3.68:1 on the white pill over the band - the darker sky #0369a1 (same hue) is
  // 5.33:1 (cloud-fix4, Owner round 4: a base colour is no accessibility waiver).
  const CTA_INK = '#0369a1';
  const callCta = (compactCta) => (bizPhone ? (
    <div className="pq-lh-call no-print" data-html2canvas-ignore="true">
      {/* PRODUCT_TRUTH_CAPABILITY: public_call */}
      <a
        className="pq-lh-call-cta"
        href={`tel:${String(bizPhone).replace(/[^\d+]/g, '')}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: compactCta ? '4px' : '6px', background: 'rgba(255,255,255,0.94)', color: CTA_INK, textDecoration: 'none', fontWeight: '700', fontSize: compactCta ? '0.75rem' : '0.8rem', padding: compactCta ? '4px 10px' : '5px 12px', borderRadius: '999px', whiteSpace: 'nowrap' }}
      >
        <Phone size={compactCta ? 11 : 13} strokeWidth={compactCta ? 2.6 : 2.4} />
        {isHebrew ? 'התקשרו אלינו' : 'Call us'}
      </a>
    </div>
  ) : null);
  const stateChip = approved ? <span className="pq-state-chip" data-testid="pq-header-signed">{L.signed}</span> : null;
  const documentTitle = (
    <>
      <span>{L.quote}</span>
      {quote.subject && <span className="pq-screen-title-subject"> · {quote.subject}</span>}
    </>
  );
  const documentSubtitle = projectName ? <p className="pq-screen-doc-subtitle">{projectName}</p> : null;

  if (variant === 'modern') {
    return (
      <header className="pq-header-box pq-letterhead pq-letterhead-modern" data-pq-variant="modern">
        <div className="pq-lh-band pq-modern-head" data-pq-band="modern">
          <div className="pq-modern-main" style={{ minWidth: 0 }}>
            {issuer(false)}
          </div>
          <div className="pq-modern-aside" style={{ minWidth: 0 }}>
            {callCta(false)}
            {metaGrid([numberCell, dateCell, validCell, projectCell])}
            {stateChip}
          </div>
        </div>
        <div className="pq-modern-titleblock">
          <h1 className="pq-doc-title">{documentTitle}</h1>
          {documentSubtitle}
        </div>
      </header>
    );
  }

  if (variant === 'visual') {
    return (
      <header className="pq-header-box pq-letterhead pq-letterhead-visual" data-pq-variant="visual">
        <div className="pq-lh-band" data-pq-band="visual">
          <div className="pq-lh-brandline">
            {issuer(false)}
            <div className="pq-lh-corner">
              {callCta(false)}
              <div className="pq-visual-number">
                <div className="pq-doc-kicker">{L.number}</div>
                <b className="pq-header-number" dir="ltr">{numberDisplay}</b>
                {stateChip && <div style={{ marginTop: '8px' }}>{stateChip}</div>}
              </div>
            </div>
          </div>
          {metaGrid([dateCell, validCell, projectCell])}
        </div>
        <h1 className="pq-doc-title">{documentTitle}</h1>
        {documentSubtitle}
      </header>
    );
  }

  // HEADER BAND (Owner 2026-10-05): on SCREEN every style opens with ONE dark band holding the business/issuer block and
  // the quote metadata (number / date / valid-until / project, each label + value centred in its own cell, no rule above
  // them); the document title sits BELOW the band on white - the boundary of the original Task 16 design package
  // (`.doc-head`: issuer + metadata, title underneath). Native Print renders the band white with dark text, and the
  // Direct PDF capture (.pq-pdf-capturing) keeps its existing white letterhead - an explicit, separate output mode while
  // the Owner's Direct PDF decision is pending (quoteDocument.css). The earlier "white letterhead approved" attribution
  // was rejected by the Owner.
  // CLASSIC: band (issuer + centred metadata row), ONE accent rule under the band, then the title. The compact branch
  // (viewport <= 768px via matchMedia, or the preview container via `compact`) differs only in
  // the business-name element and the denser grid; the metadata stays centred identically in HE and EN (AUDIT-005).
  // `compact` (boolean) overrides the viewport branch - the pages pass it in previewMode, where the creator preview
  // frame (a container, not the viewport) decides whether the compact letterhead applies.
  const useCompactBranch = typeof compact === 'boolean' ? compact : isMobileView;
  return (
    <header className={`pq-header-box pq-letterhead pq-letterhead-classic${useCompactBranch ? ' pq-lh-mobile' : ''}`} data-pq-variant="classic">
      <div className="pq-lh-band" data-pq-band="classic">
        <div className="pq-lh-brandline">
          {issuer(!useCompactBranch)}
          {(bizPhone || stateChip) && (
            <div className="pq-lh-corner">
              {callCta(useCompactBranch)}
              {stateChip}
            </div>
          )}
        </div>
        {metaGrid([numberCell, dateCell, validCell, projectCell])}
      </div>
      <div className="pq-lh-rule" aria-hidden="true" />
      <h1 className="pq-doc-title">{documentTitle}</h1>
      {documentSubtitle}
    </header>
  );
}
