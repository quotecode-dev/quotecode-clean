import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';

const formatNum = (val) => Math.round(Number(val || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export default function PublicQuote() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const { canvasRef, hasSigned, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

  useEffect(() => {
    document.title = "ProFlow - הצעת מחיר דיגיטלית";
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

      // שליפת קבצים מצורפים להצעה זו מטאבלת quote_attachments
      const { data: attData } = await supabase
        .from('quote_attachments')
        .select('*')
        .eq('quote_id', id);
      
      if (attData) {
        setAttachments(attData);
      }

      if (data?.user_id) {
        const { data: bData } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (bData) {
          setBusinessSettings(bData);
        }
      }

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
      setError('הצעת המחיר אינה נמצאת או שפג תוקפה.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!hasSigned) {
      alert('נא לחתום על גבי המסמך לפני האישור');
      return;
    }

    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          signature: getSignatureDataUrl()
        })
        .eq('id', id);

      if (error) throw error;
      setApproved(true);
    } catch (err) {
      console.error('Error approving quote:', err);
      alert(`שגיאה באישור ההצעה: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif' }}>
        <h2>טוען הצעת מחיר...</h2>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', textAlign: 'center', padding: '20px' }}>
        <h2>{error || 'הצעת המחיר אינה נמצאת'}</h2>
      </div>
    );
  }

  const isHebrew = true;
  const currencySymbol = '₪';
  // שיעור המע"מ נגזר מנתוני ההצעה השמורים (tax_rate) ולא קבוע קשיח - כך שהתעריף
  // שהוצג/הוסכם בעת יצירת ההצעה הוא זה שיוצג גם בקישור הציבורי, גם אם ברירת המחדל תשתנה בעתיד
  const vatRate = (quote.tax_rate !== undefined && quote.tax_rate !== null) ? Number(quote.tax_rate) : 0.18;

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
  
  const subtotal = quote.subtotal ? Number(quote.subtotal) : (calculatedSubtotalFromItems > 0 ? calculatedSubtotalFromItems : (dbTotal > 0 ? dbTotal / (1 + vatRate) : 0));
  const vatAmount = quote.vat !== undefined && quote.vat !== null ? Number(quote.vat) : subtotal * vatRate;
  const total = dbTotal > 0 ? dbTotal : (subtotal + vatAmount);

  const bizName = businessSettings?.business_name || quote.businessSettings?.business_name || 'עסק ישראלי';
  const bizLogo = businessSettings?.logo_url || quote.businessSettings?.logo_url;
  const bizTaxId = businessSettings?.tax_id || quote.businessSettings?.tax_id;
  const bizEmail = businessSettings?.email || quote.businessSettings?.email;
  const bizPhone = formatDisplayPhone(businessSettings?.phone || quote.businessSettings?.phone);
  const bizAddress = businessSettings?.address || quote.businessSettings?.address;

  const clientPhoneFormatted = formatDisplayPhone(quote.clients?.phone);
  const isOwnerViewing = currentUserId && quote.user_id && currentUserId === quote.user_id;
  const displayTerms = quote.terms;

  return (
    <div dir="rtl" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', width: '100%', maxWidth: '800px', boxSizing: 'border-box' }}>
        
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
        <div style={{ background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', marginBottom: '25px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '5px' }}>לכבוד:</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{quote.clients?.company_name || quote.client_name || 'לקוח נכבד'}</div>
          {quote.clients?.email && <div style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{quote.clients.email}</div>}
          {clientPhoneFormatted && <div style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{clientPhoneFormatted}</div>}
          {quote.clients?.address && <div style={{ color: '#475569', fontSize: '0.9rem' }}>{quote.clients.address}</div>}

          {quote.subject && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '0.95rem', color: '#0f172a', fontWeight: 'bold' }}>
              <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>נושא ההצעה: </span>
              <span style={{ fontWeight: 'normal' }}>{quote.subject}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div style={{ overflowX: 'auto', marginBottom: '25px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.85rem' }}>
                <th style={{ padding: '10px', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>תיאור פריט</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>כמות</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>מחיר יחידה</th>
                <th style={{ padding: '10px', textAlign: 'left', borderRadius: '8px 0 0 8px' }}>סה"כ</th>
              </tr>
            </thead>
            <tbody>
              {quote.quote_items && quote.quote_items.length > 0 ? (
                quote.quote_items.map((item, index) => {
                  const itemPrice = Number(item.price || item.unit_price || 0);
                  const itemQty = Number(item.quantity || 1);
                  return (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
                      <td style={{ padding: '12px 10px', color: '#1e293b', textAlign: 'right' }}>{item.description || item.name || 'פריט'}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', color: '#475569' }}>{itemQty}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'left', color: '#475569' }}>{currencySymbol}{formatNum(itemPrice)}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>{currencySymbol}{formatNum(item.total_price || (itemQty * itemPrice))}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    הצעת מחיר כללית בסך {formatNum(total)} {currencySymbol}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Attachments Section for Israeli Clients */}
        {attachments.length > 0 && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>קבצים ושרטוטים מצורפים להצעה:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att, idx) => (
                <a key={idx} href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', textDecoration: 'underline', fontSize: '0.9rem', fontWeight: '600' }}>
                  📄 {att.file_name || `קובץ מצורף #${idx + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
          <div style={{ width: '300px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
              <span>סיכום ביניים:</span>
              <span>{currencySymbol}{formatNum(subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ef4444', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                <span>הנחה ({quote.discount}%):</span>
                <span>-{currencySymbol}{formatNum((subtotal * quote.discount) / 100)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
              <span>מע"מ (18%):</span>
              <span>{currencySymbol}{formatNum(vatAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '900', color: '#1e293b', borderTop: '2px solid #cbd5e1', paddingTop: '10px', marginTop: '5px', flexDirection: 'row-reverse' }}>
              <span>סה"כ לתשלום:</span>
              <span style={{ color: '#4f46e5' }}>{currencySymbol}{formatNum(total)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Notes */}
        {displayTerms && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>תקנון ותנאים:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{displayTerms}</div>
          </div>
        )}

        {quote.notes && (
          <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>הערות נוספות:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.notes}</div>
          </div>
        )}

        {/* Signature */}
        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '25px', textAlign: 'center' }}>
          {approved ? (
            <div style={{ background: '#dcfce7', color: '#166534', padding: '20px', borderRadius: '12px', fontWeight: 'bold' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '5px' }}>✓ הצעת מחיר זו אושרה ונחתמה בהצלחה!</div>
              <div style={{ fontSize: '0.9rem', color: '#15803d', marginTop: '10px' }}>
                {quote.signature && quote.signature.startsWith('data:image') ? (
                  <div>
                    <div style={{ marginBottom: '5px' }}>חתימה דיגיטלית:</div>
                    <img src={quote.signature} alt="Client Signature" style={{ maxHeight: '100px', maxWidth: '100%', border: '1px solid #166534', borderRadius: '8px', background: 'white', padding: '4px' }} />
                  </div>
                ) : 'חתימה דיגיטלית התקבלה בהצלחה'}
              </div>
            </div>
          ) : isOwnerViewing ? (
            <div style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe' }}>
              ℹ️ תצוגת מנהל: אזור החתימה מוצג ללקוח בלבד.
            </div>
          ) : (
            <div style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>חתימת לקוח לאישור ההצעה:</h4>
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
                <button type="button" onClick={clearSignature} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  נקה חתימה
                </button>
              </div>
              <div>
                <button onClick={handleApprove} style={{ background: hasSigned ? '#10b981' : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none', maxWidth: '100%', boxSizing: 'border-box' }}>
                  אשר וחתום על הצעת המחיר ✓
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '20px', marginTop: '25px', color: '#64748b', fontSize: '0.9rem' }}>
          <span>
            מסמך זה נערך ע"י{' '}
            <span onClick={() => navigate('/he')} style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>
              ProFlow
            </span>
            {' '}– התוכנה שעושה לעסקים את החיים קלים.
          </span>
        </div>

      </div>
    </div>
  );
}