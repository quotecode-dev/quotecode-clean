import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
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
      alert('נא לחתום על גבי המסמך לפני האישור');
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

      if (error) throw error;
      setApproved(true);
    } catch (err) {
      console.error('Error approving quote:', err);
      alert(`שגיאה באישור ההצעה: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Tahoma' }}>
        <h2>טוען הצעת מחיר...</h2>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Segoe UI, Tahoma', textAlign: 'center', padding: '20px' }}>
        <h2>{error || 'הצעת המחיר אינה נמצאת'}</h2>
      </div>
    );
  }

  // עסק מקומי תמיד עובד בשקלים
  const isHebrew = true;
  const currencySymbol = '₪';
  const vatRate = 0.18;

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
    <div dir="rtl" style={{ fontFamily: 'Segoe UI, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
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

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
          <div style={{ width: '300px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
              <span>סיכום ביניים:</span>
              <span>{currencySymbol}{formatNum(subtotal)}</span>
            </div>
            {quote.discount >