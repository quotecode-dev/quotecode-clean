import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';

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
    <div dir="ltr" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%', maxWidth: '800px', boxSizing: 'border-box' }}>
        <PublicQuoteHeader isHebrew={false} bizLogo={bizLogo} bizName={bizName} bizTaxId={bizTaxId} bizPhone={bizPhone} bizEmail={bizEmail} bizAddress={bizAddress} quote={quote} />

        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Client:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{client?.company_name || 'Valued Client'}</div>
          {quote.subject && <div style={{ marginTop: '10px', fontWeight: 'bold' }}>Subject: <span style={{ fontWeight: 'normal' }}>{quote.subject}</span></div>}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
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

        {/* Attachments Section for International Clients */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Attached Files & Documents:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att, idx) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', textDecoration: 'underline', fontSize: '0.9rem', fontWeight: '600' }}>
                  📄 {att.file_name || `Attachment #${idx + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div style={{ width: '300px', background: '#f8fafc', padding: '20px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Subtotal:</span><span>{currencySymbol}{formatNum(subtotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '900', borderTop: '2px solid #cbd5e1', paddingTop: '10px' }}>
              <span>Total:</span><span style={{ color: '#4f46e5' }}>{currencySymbol}{formatNum(total)}</span>
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
          <div style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', textAlign: 'center', boxSizing: 'border-box' }}>
            <h4>Client Signature:</h4>
            <canvas ref={canvasRef} width={350} height={150} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{ display: 'block', width: '100%', maxWidth: '350px', height: 'auto', margin: '0 auto', border: '1px dashed #94a3b8', borderRadius: '8px', cursor: 'crosshair', background: 'white', boxSizing: 'border-box' }} />
            <div style={{ marginTop: '10px' }}>
              <button type="button" onClick={clearSignature} style={{ padding: '5px 15px', marginRight: '10px' }}>Clear</button>
              <button onClick={handleApprove} style={{ padding: '5px 15px', background: '#10b981', color: 'white', border: 'none' }}>Approve</button>
            </div>
            {signatureWarning && (
              <div role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '700', marginTop: '10px' }}>
                Please sign the quote before approval
              </div>
            )}
          </div>
        )}
      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={false} />
    </div>
  );
}
