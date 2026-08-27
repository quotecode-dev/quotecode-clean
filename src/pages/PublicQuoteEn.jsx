import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip } from 'lucide-react';

const formatNum = (val) => Math.round(Number(val || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayPhone = (phone) => {
  if (!phone) return '';
  return phone.trim();
};

export default function PublicQuoteEn({ quoteData }) {
  const { quote, business, client, items, attachments } = quoteData;
  const [approved, setApproved] = useState(quote.status === 'approved' || Boolean(quote.signature));
  const [signatureWarning, setSignatureWarning] = useState(false);
  const [approveToast, setApproveToast] = useState(null);

  const { canvasRef, hasSigned, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

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
        .pq-card { padding: 40px; }
        @media (max-width: 640px) {
          /* Iron rule (owner-approved correction - genuine mobile width,
             not A4): the outer wrapper's fixed 20px padding (.pq-page) was
             the root cause of the "A4 page floating in the phone" feel -
             it was never viewport-dependent at all. Reduced to 6px only
             below 640px (owner's 4-8px target), Desktop's original 20px
             untouched outside this media query. */
          .pq-page {
            padding: 6px !important;
          }
          /* Iron rule (owner correction, follow-up pass - "still looks like
             A4"): live measurement showed the previous fix (6px on
             .pq-page) was correct and already in place, but .pq-card
             itself (the white card) still kept 18px of its own internal
             padding per side - 3x the outer 6px gutter. In practice: the
             white card itself did span nearly the full viewport (378px of
             390px), but the *actual content* (header/recipient/items)
             only started at 340px width (87.2% of viewport) - exactly the
             "page with large margins" feel the owner still described,
             even though the outer card was already the right width.
             Reduced to 12px to meaningfully tighten the internal margin
             (new content width: 354px, 90.8%) without touching the outer
             gutter (6px, already inside the owner's 4-8px target) and
             without hurting readability (not full edge-to-edge). */
          .pq-card { padding: 12px; }
          .pq-recipient {
            padding: 6px 10px !important;
            margin-bottom: 10px !important;
          }
          .pq-recipient-name {
            font-size: 0.95rem !important;
            margin-top: 2px !important;
          }
        }
      `}</style>
      {/* Iron rule (owner-approved correction - responsive document, not A4):
          maxWidth increased from 800px to 1100px, mirroring PublicQuote.jsx -
          800px caused excessive side margins on wide desktops and an "A4
          page squeezed in the browser" feel. Mobile is unaffected -
          width:'100%' already caps at the actual screen width regardless
          of maxWidth. */}
      <div className="pq-card" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' }}>
        <PublicQuoteHeader isHebrew={false} bizLogo={bizLogo} bizName={bizName} bizTaxId={bizTaxId} bizPhone={bizPhone} bizEmail={bizEmail} bizAddress={bizAddress} quote={quote} />

        <div className="pq-recipient" style={{ background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: LIGHT.violet, fontWeight: '800', textTransform: 'uppercase' }}>
            <UserRound size={13} strokeWidth={2.4} />
            Client:
          </div>
          <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', marginTop: '4px' }}>{client?.company_name || 'Valued Client'}</div>
          {quote.subject && <div style={{ marginTop: '10px', fontWeight: 'bold' }}>Subject: <span style={{ fontWeight: 'normal' }}>{quote.subject}</span></div>}
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
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{currencySymbol}{formatNum(item.price)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold' }}>{currencySymbol}{formatNum(item.total_price || item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Attachments Section - always visible (product awareness: the customer
            should see the system supports attachments even when none exist) */}
        <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
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
          <div style={{ width: '100%', maxWidth: '380px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Subtotal:</span><span>{currencySymbol}{formatNum(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', borderTop: `2px solid ${LIGHT.borderStrong}`, paddingTop: '12px' }}>
              <span>Total:</span><span style={{ color: LIGHT.violet }}>{currencySymbol}{formatNum(total)}</span>
            </div>
          </div>
        </div>

        {approved ? (
          <div style={{ background: '#dcfce7', color: '#166534', padding: '20px', borderRadius: '12px', fontWeight: 'bold', textAlign: 'center' }}>
            ✓ This quote has been successfully approved and signed!
            {quote.signature && quote.signature.startsWith('data:image') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ marginBottom: '5px', fontSize: '0.9rem' }}>Digital Signature:</div>
                <img src={quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
              </div>
            )}
          </div>
        ) : isOwnerViewing ? (
          <div style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe', textAlign: 'center' }}>
            ℹ️ Admin View: Signature area is displayed to the client only.
          </div>
        ) : (
          <div style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>Client Signature to Approve This Quote:</h4>
            <div style={{ display: 'block', width: '100%', maxWidth: '350px', margin: '0 auto 10px', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', cursor: 'crosshair', boxSizing: 'border-box', overflow: 'hidden' }}>
              <canvas ref={canvasRef} width={350} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{ display: 'block', touchAction: 'none', maxWidth: '100%', height: 'auto' }} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <button type="button" onClick={clearSignature} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Clear Signature</button>
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
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={false} />
    </div>
  );
}
