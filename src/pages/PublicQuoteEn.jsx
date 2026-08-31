import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip, Phone, Printer } from 'lucide-react';
import PdfFileIcon from '../components/PdfFileIcon';
import { formatAddress } from '../utils/addressFormat';
import { formatMoney } from '../utils/money';

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

  const { canvasRef, hasSigned, isActive, activateSigning, deactivateSigning, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

  // The inline "please sign" warning clears itself as soon as a valid signature exists
  useEffect(() => {
    if (hasSigned) setSignatureWarning(false);
  }, [hasSigned]);

  useEffect(() => {
    document.title = "ProFlow - Digital Price Quote";

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
    if (!hasSigned) { setSignatureWarning(true); return; }
    try {
      const { error } = await supabase.rpc('public_approve_quote', {
        p_quote_id: quote.id,
        p_signature_data_url: getSignatureDataUrl(),
      });
      if (error) throw error;
      setApproved(true);
    } catch (err) {
      // Technical/database details stay in the console only - the public
      // customer only ever sees a generic, friendly message, never raw error.message.
      console.error('Error approving quote:', err);
      setApproveToast({ type: 'error', message: "We couldn't approve the quote. Please try again." });
    }
  };

  const rawCurrency = (quote.currency || business?.currency || 'USD').toUpperCase();
  const effectiveCurrency = ['USD', 'EUR', 'GBP'].includes(rawCurrency) ? rawCurrency : 'USD';
  const currencySymbol = effectiveCurrency === 'EUR' ? '€' : effectiveCurrency === 'GBP' ? '£' : '$';

  let parsedItems = [];
  try { parsedItems = typeof quote.items === 'string' ? JSON.parse(quote.items) : (Array.isArray(quote.items) ? quote.items : []); } catch { /* keep default [] */ }

  const subtotal = quote.subtotal ? Number(quote.subtotal) : parsedItems.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);
  const total = Number(quote.total || 0) > 0 ? Number(quote.total) : subtotal;

  const bizName = business?.business_name || 'ProFlow Business';
  const bizLogo = business?.logo_url;
  const bizTaxId = business?.tax_id;
  const bizEmail = business?.email;
  const bizPhone = formatDisplayPhone(business?.phone);
  const bizAddress = business?.address;
  const isOwnerViewing = quote.is_owner_viewing;

  return (
    <div className="pq-page" dir="ltr" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
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
      <div className="pq-card pq-card-desktop-width" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'var(--pf-doc-shell-border-width) solid #e2e8f0', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' }}>
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
          <div className="pq-section" style={{ width: '100%', maxWidth: '380px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, boxSizing: 'border-box' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#ef4444' }}>
                <span>Discount ({quote.discount}%):</span>
                <span className="pf-money">{currencySymbol}{formatNum(Math.max(subtotal - total, 0))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Subtotal:</span><span className="pf-money">{currencySymbol}{formatNum(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', borderTop: `2px solid ${LIGHT.borderStrong}`, paddingTop: '12px' }}>
              <span>Total:</span><span className="pf-money" style={{ color: LIGHT.violet }}>{currencySymbol}{formatNum(total)}</span>
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
            {quote.signature && quote.signature.startsWith('data:image') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ marginBottom: '5px', fontSize: '0.9rem' }}>Digital Signature:</div>
                <img src={quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
              </div>
            )}
          </div>
        ) : isOwnerViewing ? (
          <div className="pq-section" style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe', textAlign: 'center' }}>
            ℹ️ Admin View: Signature area is displayed to the client only.
          </div>
        ) : (
          <div className="pq-section no-print" style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Client Signature to Approve This Quote:</h4>
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

        {/* Item 7 (Public Quote Bottom Actions - updated per Owner visual
            reference): three equal-height "tiles", icon above label, one
            horizontal group. "Call Me" reuses the exact same bizPhone/tel:
            normalization as the existing PublicQuoteHeader.jsx CTA (no
            second source of truth) - hidden entirely if no valid business
            phone exists (group becomes two tiles, not three, same
            `bizPhone &&` pattern as before). "Print Document" calls a real
            window.print(). "Download PDF" - the visual architecture is
            ready for it (first/primary purple tile, exact position
            requested) but it is intentionally NOT functional yet (item 8,
            still deferred) - explicit rule: never fake PDF functionality,
            never make it look functional while secretly just opening
            print. So this is a non-clickable <div> (no <button>/<a>, no
            onClick), aria-disabled, reduced opacity, and an always-visible
            "(Coming Soon)" label - visible on touch/mobile too, where
            cursor:not-allowed alone would never be seen. Whole group is
            no-print. */}
        <div className={`pq-action-tiles no-print ${bizPhone ? '' : 'pq-action-tiles-two'}`} style={{ display: 'flex', gap: '12px', paddingTop: '10px', paddingBottom: '5px' }}>
          <div
            aria-disabled="true"
            role="button"
            title="PDF download coming soon"
            className="pq-action-tile"
            style={{ background: LIGHT.gradient, color: 'white', border: 'none', opacity: 0.62, cursor: 'not-allowed' }}
          >
            <PdfFileIcon size={26} strokeWidth={1.75} />
            <span>Download PDF</span>
            <span style={{ fontSize: '0.65rem', fontWeight: '600', opacity: 0.9 }}>(Coming Soon)</span>
          </div>
          {bizPhone && (
            <a
              href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
              className="pq-action-tile"
              style={{ background: 'white', color: LIGHT.violet, border: `2px solid ${LIGHT.violet}`, textDecoration: 'none' }}
            >
              <Phone size={26} strokeWidth={1.75} />
              <span>Call Me</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="pq-action-tile"
            style={{ background: 'white', color: LIGHT.violet, border: `2px solid ${LIGHT.violet}`, cursor: 'pointer' }}
          >
            <Printer size={26} strokeWidth={1.75} />
            <span>Print Document</span>
          </button>
        </div>
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={false} />
    </div>
  );
}
