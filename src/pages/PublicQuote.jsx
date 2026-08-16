import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import PublicQuoteHeader from '../components/PublicQuoteHeader';

const formatNum = (val) => Math.round(Number(val || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDisplayPhone = (phone, isInternational) => {
  if (!phone) return '';
  let clean = phone.trim();
  if (!isInternational) {
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
  }
  return clean;
};

export default function PublicQuote() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    if (id) {
      fetchQuoteAndIncrementView();
    }
  }, [id]);

  const fetchQuoteAndIncrementView = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      setCurrentUserId(userId);

      const { data, error } = await supabase
        .from('quotes')
        .select(`*, clients (*), quote_items (*)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      setQuote(data);

      let bizData = null;
      if (data?.user_id) {
        const { data: bData } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (bData) {
          bizData = bData;
          setBusinessSettings(bData);
        }
      }

      // Increment view count only if viewer is NOT the quote owner
      const isOwner = userId && data.user_id && userId === data.user_id;
      if (!isOwner) {
        const newViewCount = (data.view_count || 0) + 1;
        await supabase
          .from('quotes')
          .update({ view_count: newViewCount })
          .eq('id', id);
      }

      if (data?.status === 'approved' || data?.signature) {
        setApproved(true);
      }
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError('הצעת המחיר אינה נמצאת או שפג תוקפה / Quote not found or expired.');
    } finally {
      setLoading(false);
    }
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleApprove = async () => {
    if (!hasSigned) {
      alert(isHebrew ? 'נא לחתום על גבי המסמך לפני האישור' : 'Please sign the quote before approval');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null;

      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          signature: signatureDataUrl
        })
        .eq('id', id);

      if (error) {
        console.error("Supabase direct update error:", error);
        throw error;
      }

      setApproved(true);
    } catch (err) {
      console.error('Error approving quote:', err);
      alert(isHebrew ? `שגיאה באישור ההצעה: ${err.message}` : `Error approving quote: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Tahoma' }}>
        <h2>Loading quote...</h2>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Tahoma', textAlign: 'center', padding: '20px' }}>
        <h2>{error || 'Quote not found'}</h2>
      </div>
    );
  }

  const isInternationalBiz = businessSettings?.country === 'International' || (quote.currency && quote.currency !== 'ILS');
  const isHebrew = !isInternationalBiz && (quote.currency === 'ILS' || quote.isHebrew !== false);

  const currencySymbol = quote.currency === 'USD' ? '$' : quote.currency === 'EUR' ? '€' : quote.currency === 'GBP' ? '£' : '₪';
  const vatRate = isHebrew ? 0.18 : 0;

  let parsedItems = [];
  try {
    if (typeof quote.items === 'string') {
      parsedItems = JSON.parse(quote.items);
    } else if (Array.isArray(quote.items)) {
      parsedItems = quote.items;
    }
  } catch (e) {
    parsedItems = [];
  }

  const dbTotal = Number(quote.total || 0);
  const calculatedSubtotalFromItems = parsedItems.reduce((acc, item) => acc + (Number(item.price || item.unit_price || 0) * Number(item.quantity || 1)), 0);
  
  const subtotal = quote.subtotal ? Number(quote.subtotal) : (calculatedSubtotalFromItems > 0 ? calculatedSubtotalFromItems : (dbTotal > 0 ? dbTotal / (1 + vatRate) : 0));
  const vatAmount = quote.vat !== undefined && quote.vat !== null ? Number(quote.vat) : subtotal * vatRate;
  const total = dbTotal > 0 ? dbTotal : (subtotal + vatAmount);

  const bizName = businessSettings?.business_name || quote.businessSettings?.business_name || 'ProFlow Business';
  const bizLogo = businessSettings?.logo_url || quote.businessSettings?.logo_url;
  const bizTaxId = businessSettings?.tax_id || quote.businessSettings?.tax_id;
  const bizEmail = businessSettings?.email || quote.businessSettings?.email;
  const bizPhone = formatDisplayPhone(businessSettings?.phone || quote.businessSettings?.phone, isInternationalBiz);
  const bizAddress = businessSettings?.address || quote.businessSettings?.address;

  const clientPhoneFormatted = formatDisplayPhone(quote.clients?.phone, isInternationalBiz);

  const isOwnerViewing = currentUserId && quote.user_id && currentUserId === quote.user_id;

  // Strict International Terms & Conditions Override Fallback
  let displayTerms = quote.terms;
  if (!isHebrew && displayTerms && /[א-ת]/.test(displayTerms)) {
    displayTerms = `General Terms:
1. Validity: This quote is valid for 30 days from issuance.
2. Payment: Payment shall be made in cash or via bank transfer as agreed in advance.
3. Delivery: Product delivery within 30 business days from order confirmation and payment.`;
  }

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', width: '100%', maxWidth: '800px', boxSizing: 'border-box' }}>
        
        {/* Isolated Header Component */}
        <PublicQuoteHeader 
          isHebrew={isHebrew}
          bizLogo={bizLogo}
          bizName={bizName}
          bizTaxId={bizTaxId}
          bizPhone={bizPhone}
          bizEmail={bizEmail}
          bizAddress={bizAddress}
          quote={quote}
        />

        {/* Client & Business Info */}
        <div style={{ background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #e2e8f0', textAlign: isHebrew ? 'right' : 'left' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>{isHebrew ? 'לכבוד:' : 'Client:'}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{quote.clients?.company_name || quote.client_name || (isHebrew ? 'לקוח נכבד' : 'Valued Client')}</div>
          {quote.clients?.email && <div style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{quote.clients.email}</div>}
          {clientPhoneFormatted && <div style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: isHebrew ? 'right' : 'left' }}>{clientPhoneFormatted}</div>}
          {quote.clients?.address && <div style={{ color: '#475569', fontSize: '0.9rem' }}>{quote.clients.address}</div>}
        </div>

        {/* Items Table */}
        <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.85rem' }}>
                <th style={{ padding: '10px', textAlign: isHebrew ? 'right' : 'left', borderRadius: isHebrew ? '0 8px 8px 0' : '8px 0 0 8px' }}>{isHebrew ? 'תיאור פריט' : 'Description'}</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>{isHebrew ? 'כמות' : 'Qty'}</th>
                <th style={{ padding: '10px', textAlign: isHebrew ? 'left' : 'right' }}>{isHebrew ? 'מחיר יחידה' : 'Unit Price'}</th>
                <th style={{ padding: '10px', textAlign: isHebrew ? 'left' : 'right', borderRadius: isHebrew ? '8px 0 0 8px' : '0 8px 8px 0' }}>{isHebrew ? 'סה"כ' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items && quote.quote_items.length > 0 ? (
                quote.quote_items.map((item, index) => {
                  const itemPrice = Number(item.price || item.unit_price || 0);
                  const itemQty = Number(item.quantity || 1);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
                      <td style={{ padding: '12px 10px', color: '#1e293b', textAlign: isHebrew ? 'right' : 'left' }}>{item.description || item.name || (isHebrew ? 'פריט' : 'Item')}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', color: '#475569' }}>{itemQty}</td>
                      <td style={{ padding: '12px 10px', textAlign: isHebrew ? 'left' : 'right', color: '#475569' }}>{currencySymbol}{formatNum(itemPrice)}</td>
                      <td style={{ padding: '12px 10px', textAlign: isHebrew ? 'left' : 'right', fontWeight: 'bold', color: '#1e293b' }}>{currencySymbol}{formatNum(item.total_price || (itemQty * itemPrice))}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    {isHebrew ? `הצעת מחיר כללית בסך ${formatNum(total)} ${currencySymbol}` : `General Quote total ${formatNum(total)} ${currencySymbol}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: isHebrew ? 'flex-start' : 'flex-end', marginBottom: '30px' }}>
          <div style={{ width: '300px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
              <span>{isHebrew ? 'סיכום ביניים:' : 'Subtotal:'}</span>
              <span>{currencySymbol}{formatNum(subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ef4444', fontSize: '0.9rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <span>{isHebrew ? `הנחה (${quote.discount}%):` : `Discount (${quote.discount}%):`}</span>
                <span>-{currencySymbol}{formatNum((subtotal * quote.discount) / 100)}</span>
              </div>
            )}
            {vatRate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
                <span>{isHebrew ? 'מע"מ (18%):' : 'VAT (18%):'}</span>
                <span>{currencySymbol}{formatNum(vatAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', borderTop: '2px solid #cbd5e1', paddingTop: '10px', marginTop: '5px', flexDirection: isHebrew ? 'row-reverse' : 'row' }}>
              <span>{isHebrew ? 'סה"כ לתשלום:' : 'Total:'}</span>
              <span style={{ color: '#4f46e5' }}>{currencySymbol}{formatNum(total)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Notes Display */}
        {displayTerms && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: isHebrew ? 'right' : 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>{isHebrew ? 'תקנון ותנאים:' : 'Terms & Conditions:'}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{displayTerms}</div>
          </div>
        )}

        {quote.notes && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: isHebrew ? 'right' : 'left' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>{isHebrew ? 'הערות נוספות:' : 'Additional Notes:'}</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.notes}</div>
          </div>
        )}

        {/* Signature & Approval Section */}
        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '25px', textAlign: 'center' }}>
          {approved ? (
            <div style={{ background: '#dcfce7', color: '#166534', padding: '20px', borderRadius: '12px', fontWeight: 'bold' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>
                {isHebrew ? '✓ הצעת מחיר זו אושרה ונחתמה בהצלחה!' : '✓ This quote has been successfully approved and signed!'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#15803d', marginTop: '10px' }}>
                {quote.signature && quote.signature.startsWith('data:image') ? (
                  <div>
                    <div style={{ marginBottom: '5px' }}>{isHebrew ? 'חתימה דיגיטלית:' : 'Digital Signature:'}</div>
                    <img src={quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
                  </div>
                ) : quote.signature ? (
                  `${isHebrew ? 'שם החותם' : 'Signed by'}: ${quote.signature}`
                ) : (
                  isHebrew ? 'חתימה דיגיטלית התקבלה בהצלחה' : 'Digital signature received'
                )}
              </div>
            </div>
          ) : isOwnerViewing ? (
            <div style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe' }}>
              {isHebrew ? 'ℹ️ תצוגת מנהל: אזור החתימה מוצג ללקוח בלבד.' : 'ℹ️ Owner Preview: Client signature box is hidden from your view.'}
            </div>
          ) : (
            <div style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>
                {isHebrew ? 'חתימת לקוח לאישור ההצעה:' : 'Client Signature for Quote Approval:'}
              </h4>
              
              <div style={{ display: 'inline-block', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', cursor: 'crosshair', marginBottom: '10px', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
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
                  style={{ display: 'block', touchAction: 'none', maxWidth: '100%', height: 'auto' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={clearSignature}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {isHebrew ? 'נקה חתימה' : 'Clear Signature'}
                </button>
              </div>
              <div>
                <button
                  onClick={handleApprove}
                  style={{ background: hasSigned ? '#10b981' : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none', maxWidth: '100%', boxSizing: 'border-box' }}
                >
                  {isHebrew ? 'אשר וחתום על הצעת המחיר ✓' : 'Approve & Sign Quote ✓'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with dynamic ProFlow link */}
        <div style={{ textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '25px', color: '#64748b', fontSize: '0.9rem' }}>
          {isHebrew ? (
            <span>
              מסמך זה נערך ע"י{' '}
              <span
                onClick={() => navigate('/he')}
                style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
              >
                ProFlow
              </span>
              {' '}– התוכנה שעושה לעסקים את החיים קלים.
            </span>
          ) : (
            <span>
              This document was generated by{' '}
              <span
                onClick={() => navigate('/')}
                style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
              >
                ProFlow
              </span>
              {' '}– the software that makes business life easy.
            </span>
          )}
        </div>

      </div>
    </div>
  );
}