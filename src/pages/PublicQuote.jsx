import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { calculateQuoteFinancials } from '../utils/regionConfig';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip } from 'lucide-react';

// חוק ברזל: ללא Math.round מוקדם - ערכי מע"מ/נטו של הצעה פרטית (VAT-inclusive)
// הם לרוב לא-שלמים (למשל 254.24), וכל עיגול-לשלם לפני הצגת האגורות היה
// שובר את ההתאמה (Net + VAT כלול = Total) שהצעת P0 מחייבת להציג במדויק.
const formatNum = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export default function PublicQuote({ quoteData }) {
  const navigate = useNavigate();
  const { quote, business, client, items, attachments } = quoteData;
  const [approved, setApproved] = useState(quote.status === 'approved' || Boolean(quote.signature));
  const [signatureWarning, setSignatureWarning] = useState(false);
  const [approveToast, setApproveToast] = useState(null);

  const { canvasRef, hasSigned, startDrawing, draw, stopDrawing, clearSignature, getSignatureDataUrl } = useSignaturePad();

  // ההתראה המקומית "יש לחתום" נעלמת אוטומטית ברגע שיש חתימה תקפה בקנבס
  useEffect(() => {
    if (hasSigned) setSignatureWarning(false);
  }, [hasSigned]);

  useEffect(() => {
    document.title = "ProFlow - הצעת מחיר דיגיטלית";

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
  }, []);

  const handleApprove = async () => {
    if (!hasSigned) {
      setSignatureWarning(true);
      return;
    }

    try {
      const { error } = await supabase.rpc('public_approve_quote', {
        p_quote_id: quote.id,
        p_signature_data_url: getSignatureDataUrl(),
      });

      if (error) throw error;
      setApproved(true);
    } catch (err) {
      // הפרטים הטכניים/מסד הנתונים נשארים ב-console בלבד - הלקוח הציבורי
      // רואה רק הודעה כללית וידידותית, לא raw error.message.
      console.error('Error approving quote:', err);
      setApproveToast({ type: 'error', message: 'לא הצלחנו לאשר את ההצעה. נסו שוב בעוד רגע.' });
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
  const financials = calculateQuoteFinancials({
    country: 'Local',
    clientType: quote.client_type,
    items: [{ quantity: 1, unit_price: resolvedSubtotal }],
    discount: quote.discount,
    taxRateOverride: vatRate,
  });

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
  const vatAmount = financials.taxAmount;
  const total = dbTotal > 0 ? dbTotal : (isAmbiguousClientType ? (subtotal - discountAmountDisplay) : financials.total);

  const bizName = business?.business_name || 'עסק ישראלי';
  const bizLogo = business?.logo_url;
  const bizTaxId = business?.tax_id;
  const bizEmail = business?.email;
  const bizPhone = formatDisplayPhone(business?.phone);
  const bizAddress = business?.address;

  const clientPhoneFormatted = formatDisplayPhone(client?.phone);
  const isOwnerViewing = quote.is_owner_viewing;
  const displayTerms = quote.terms;

  return (
    <div className="pq-page" dir="rtl" style={{ fontFamily: 'Segoe UI, Arial, Tahoma, sans-serif', background: '#f8fafc', minHeight: '100vh', padding: '20px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' }}>
      <style>{`
        .pq-card { padding: 40px; }
        @media (max-width: 640px) {
          /* חוק ברזל (תיקון בעלים מאושר - רוחב מובייל אמיתי, לא A4):
             ה-padding הקבוע 20px של המעטפת החיצונית (.pq-page) הוא הגורם
             השורשי לתחושת "דף A4 צף בתוך הטלפון" - הוא לא היה תלוי-viewport
             בכלל, זהה בדסקטופ ובמובייל. הוקטן כאן ל-6px רק מתחת ל-640px -
             משאיר גבול קטן וסביר (יעד הבעלים: 4-8px) בלי לגעת בערך
             הדסקטופ המקורי (20px, לא במדיה query זו). */
          .pq-page {
            padding: 6px !important;
          }
          /* חוק ברזל (תיקון בעלים - העברה נוספת, "עדיין נראה כמו A4"):
             מדידה חיה גילתה שהתיקון הקודם (6px ל-.pq-page) היה נכון וטופל
             בעבר, אך .pq-card עצמו (הכרטיס הלבן) שמר padding פנימי של 18px
             מצד קודם - פי 3 מה-gutter החיצוני (6px). בפועל: הכרטיס הלבן
             עצמו כן משתרע כמעט לכל רוחב המסך (378px מתוך 390px), אבל
             *התוכן בפועל* (כותרת/פרטי נמען/פריטים) התחיל רק ב-340px רוחב
             (87.2% מה-viewport) - בדיוק התחושה של "דף עם שוליים גדולים"
             שהבעלים עדיין תיאר, גם כשהכרטיס החיצוני עצמו כבר היה ברוחב
             נכון. הוקטן ל-12px כדי לצמצם את השוליים הפנימיים משמעותית
             (רוחב תוכן חדש: 354px, 90.8%) בלי לגעת ב-gutter החיצוני (6px,
             כבר בתוך יעד הבעלים 4-8px) ובלי לפגוע בקריאות (לא edge-to-edge
             מלא). */
          .pq-card { padding: 12px; }
          .pq-recipient {
            padding: 6px 10px !important;
            margin-bottom: 10px !important;
          }
          .pq-recipient-label {
            margin-bottom: 2px !important;
          }
          .pq-recipient-name {
            font-size: 0.95rem !important;
          }
          .pq-recipient-detail {
            font-size: 0.78rem !important;
            line-height: 1.25 !important;
          }
        }
      `}</style>
      {/* חוק ברזל (תיקון בעלים מאושר - הצעת מחיר כמסמך רספונסיבי, לא A4):
          maxWidth הוגדל מ-800px ל-1100px - 800px גרם למרווחים צדדיים
          מוגזמים בדסקטופ רחב ולתחושת "עמוד A4 מכווץ בדפדפן". 1100px עדיין
          שומר על רוחב קריאה סביר (לא edge-to-edge מלא, שהיה פוגע בקריאות
          טקסט ארוך) אך מנצל את רוחב הדפדפן טוב יותר. במובייל אין השפעה -
          width:'100%' כבר חוסם לרוחב המסך בפועל ללא קשר ל-maxWidth. */}
      <div className="pq-card" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' }}>

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
        <div className="pq-recipient" style={{ background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', marginBottom: '25px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}`, textAlign: 'right' }}>
          <div className="pq-recipient-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: LIGHT.violet, fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
            <UserRound size={13} strokeWidth={2.4} />
            לכבוד:
          </div>
          <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>{client?.company_name || 'לקוח נכבד'}</div>
          {client?.email && <div className="pq-recipient-detail" style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{client.email}</div>}
          {clientPhoneFormatted && <div className="pq-recipient-detail" style={{ color: '#475569', fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{clientPhoneFormatted}</div>}
          {client?.address && <div style={{ color: '#475569', fontSize: '0.9rem' }}>{client.address}</div>}

          {quote.subject && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '0.95rem', color: '#0f172a', fontWeight: 'bold' }}>
              <span style={{ color: LIGHT.violet, fontWeight: 'bold' }}>נושא ההצעה: </span>
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
              {items && items.length > 0 ? (
                items.map((item, index) => {
                  const itemPrice = Number(item.price || 0);
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

        {/* Attachments Section - always visible (product awareness: the customer
            should see the system supports attachments even when none exist) */}
        <div style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
            <Paperclip size={14} color={LIGHT.violet} strokeWidth={2.2} />
            קבצים ושרטוטים מצורפים להצעה:
          </div>
          {attachments && attachments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att, idx) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: LIGHT.violet, textDecoration: 'underline', fontSize: '0.9rem', fontWeight: '600' }}>
                  📄 {att.file_name || `קובץ מצורף #${idx + 1}`}
                </a>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>אין קובץ מצורף להצעה זו</div>
          )}
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '30px' }}>
          <div style={{ width: '100%', maxWidth: '380px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, boxSizing: 'border-box' }}>
            {/* Local Private: אין שורת "סכום ביניים" נפרדת - היא כפולה ל-total
                (שניהם ה-ברוטו שהוזן/ה-total הסופי). מציגים ישירות את פירוט
                החשבונאות הרגיל: סכום לפני מע"מ / מע"מ / סה"כ, בדיוק כמו Business. */}
            {!isPrivateDisplay && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                <span>סיכום ביניים:</span>
                <span>{currencySymbol}{formatNum(subtotal)}</span>
              </div>
            )}
            {quote.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ef4444', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                <span>הנחה ({quote.discount}%):</span>
                <span>-{currencySymbol}{formatNum(discountAmountDisplay)}</span>
              </div>
            )}
            {/* client_type חסר/לא-מזוהה: לעולם לא מציגים פירוט מע"מ (מוסף/כלול/
                נטו) מבוסס-ניחוש - לא Business, לא Private. מציגים רק
                subtotal/discount/total האמינים שכבר שמורים, בלי שורת מע"מ כלל. */}
            {isAmbiguousClientType ? null : isPrivateDisplay ? (
              // תצוגה חשבונאית רגילה (Private): "סכום לפני מע"מ" / "מע"מ (18%)"
              // - אותם ערכים בדיוק כמו קודם (netAmount, vatAmount), רק
              // תוויות/סדר שונים; אין נוסחה חדשה.
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                  <span>סכום לפני מע"מ:</span>
                  <span>{currencySymbol}{formatNum(netAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                  <span>מע"מ (18%):</span>
                  <span>{currencySymbol}{formatNum(vatAmount)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#64748b', fontSize: '0.9rem', flexDirection: 'row-reverse' }}>
                <span>מע"מ (18%):</span>
                <span>{currencySymbol}{formatNum(vatAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '900', color: '#1e293b', borderTop: `2px solid ${LIGHT.borderStrong}`, paddingTop: '12px', marginTop: '5px', flexDirection: 'row-reverse' }}>
              <span>סה"כ לתשלום:</span>
              <span style={{ color: LIGHT.violet }}>{currencySymbol}{formatNum(total)}</span>
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
              <div style={{ display: 'block', width: '100%', maxWidth: '350px', margin: '0 auto 10px', border: '1px dashed #94a3b8', background: 'white', borderRadius: '8px', cursor: 'crosshair', boxSizing: 'border-box', overflow: 'hidden' }}>
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
              {signatureWarning && (
                <div role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '700', marginBottom: '10px' }}>
                  נא לחתום על גבי המסמך לפני האישור
                </div>
              )}
              <div>
                <button onClick={handleApprove} style={{ background: hasSigned ? LIGHT.gradient : '#94a3b8', color: 'white', border: 'none', padding: '16px 36px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasSigned ? 'pointer' : 'not-allowed', boxShadow: hasSigned ? LIGHT.glow : 'none', maxWidth: '100%', boxSizing: 'border-box' }}>
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
            <span onClick={() => navigate('/he')} style={{ color: LIGHT.violet, cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>
              ProFlow
            </span>
            {' '}– התוכנה שעושה לעסקים את החיים קלים.
          </span>
        </div>

      </div>
      <Toast toast={approveToast} onDismiss={() => setApproveToast(null)} isHebrew={true} />
    </div>
  );
}
