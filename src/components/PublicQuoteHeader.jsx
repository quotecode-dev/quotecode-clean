import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { LIGHT } from '../theme/neonTheme';

// חוק ברזל: "חייג/י אליי" הוא CTA טקסטואלי בלבד - המספר עצמו לעולם לא
// מוצג *על גבי הכפתור* (מוצג כטקסט מידע נפרד למעלה, בדיוק כמו קודם) -
// קישור ה-tel: מכיל אותו רק כפעולה טכנית, לא כתוכן גלוי.
export default function PublicQuoteHeader({ isHebrew, bizLogo, bizName, bizTaxId, bizPhone, bizEmail, bizAddress, quote }) {
  const hasLogo = bizLogo && bizLogo.length > 5;

  // חוק ברזל (תיקון בעלים מאושר - כותרת מובייל קומפקטית): לפני התיקון,
  // ה-flex-wrap הרגיל של הדסקטופ גרם לתיבת "הצעת מחיר #.../תאריך" (עמודה
  // שנייה) לגלוש למובייל כבלוק לבן גדול ונפרד *מתחת* לפרטי העסק - נמדד
  // בפועל כ-261px גובה כותרת כולל. רינדור מותנה אמיתי (JS, לא רק CSS) בין
  // דסקטופ למובייל - בדיוק התבנית שכבר הוכיחה את עצמה ב-QuotesTab.jsx -
  // מאפשר קומפוזיציה שונה לגמרי במובייל (מספר/תאריך משולבים כשורת מטא-דאטה
  // קטנה בתוך הכותרת, לא כרטיס עצמאי) בלי לגעת כלל בעץ ה-JSX של הדסקטופ.
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

  const dateStr = new Date(quote.created_at).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB');
  const validUntilStr = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB') : null;

  if (isMobileView) {
    // חוק ברזל (תיקון בעלים - קומפוזיציית כותרת מובייל, העברה נוספת):
    // קודם, מספר/תאריך ההצעה ישבו בשורה נפרדת ברוחב מלא מתחת לפרטי העסק
    // (עם border-top משלה) - זה בזבז גובה שהאזור השמאלי/משני (מתחת ל-CTA)
    // כבר היה יכול להכיל. הועברו לעמודה השנייה (יחד עם ה-CTA), מתחתיו
    // ממש - אין עוד שורה שלישית נפרדת בכלל. סדר ה-DOM כאן [עמודת עסק,
    // עמודת CTA+מטא-דאטה] מכוון בכוונה - תחת dir="rtl"/"ltr" שכבר מגיע
    // מהעמוד המארח, הפריט הראשון תמיד ממוקם בצד ה"התחלה" (ימין בעברית,
    // שמאל באנגלית) - אותה טכניקת מיפוי-דרך-סדר-DOM שכבר הוכיחה את עצמה
    // בכל שאר הקומפוננטות בפרויקט, בלי צורך בתנאי isHebrew על סדר העמודות
    // עצמו (רק על יישור הטקסט הפנימי של העמודה המשנית).
    return (
      <div style={{ background: LIGHT.gradient, borderRadius: '12px', padding: '10px 14px', marginBottom: '10px', boxShadow: LIGHT.glow }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {hasLogo ? (
              <div style={{ background: 'rgba(255,255,255,0.92)', display: 'inline-block', padding: '3px 8px', borderRadius: '6px', minWidth: 0 }}>
                <img src={bizLogo} alt={bizName} style={{ maxHeight: '26px', maxWidth: '120px', objectFit: 'contain', display: 'block' }} />
              </div>
            ) : (
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {bizName}
              </div>
            )}
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.92)', lineHeight: '1.35', marginTop: '4px' }}>
              {bizTaxId && <div>{isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:'} {bizTaxId}</div>}
              {bizPhone && <div>{isHebrew ? 'טלפון:' : 'Phone:'} {bizPhone}</div>}
              {bizEmail && <div>{bizEmail}</div>}
              {bizAddress && <div>{bizAddress}</div>}
            </div>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: isHebrew ? 'flex-start' : 'flex-end', gap: '5px' }}>
            {bizPhone && (
              <a
                href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.94)', color: LIGHT.violet, textDecoration: 'none', fontWeight: '700', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}
              >
                <Phone size={11} strokeWidth={2.6} />
                {isHebrew ? 'חייג/י אליי' : 'Call me'}
              </a>
            )}
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.95)', lineHeight: '1.3', textAlign: isHebrew ? 'left' : 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: '800' }}>#{quote.id?.slice(0, 8)}</div>
              <div>{isHebrew ? 'תאריך:' : 'Date:'} {dateStr}</div>
              {validUntilStr && (
                <div style={{ color: '#fecaca', fontWeight: '700' }}>{isHebrew ? 'בתוקף עד:' : 'Valid:'} {validUntilStr}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // חוק ברזל (החלטת בעלים מאושרת - קומפקטיזציה): padding/margin/gap
    // הוקטנו בכ-35-40% לעומת הגרסה הקודמת (רכיב משותף Local+International -
    // התיקון חל בו-זמנית על שתי השפות מעצם היותו רכיב יחיד משותף). כל
    // המידע הקיים נשמר במלואו - רק ריווח/גדלים הוקטנו.
    <div style={{ background: LIGHT.gradient, borderRadius: '14px', padding: '14px 20px', marginBottom: '14px', boxShadow: LIGHT.glow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>

        {/* צד לוגו/שם העסק */}
        <div style={{ flex: '1 1 220px', textAlign: isHebrew ? 'right' : 'left' }}>
          {hasLogo ? (
            <div style={{ background: 'rgba(255,255,255,0.92)', display: 'inline-block', padding: '5px 10px', borderRadius: '8px', marginBottom: '6px' }}>
              <img src={bizLogo} alt={bizName} style={{ maxHeight: '38px', maxWidth: '140px', objectFit: 'contain', display: 'block' }} />
            </div>
          ) : (
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#ffffff', fontWeight: '800' }}>{bizName}</h2>
          )}

          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.92)', lineHeight: '1.4' }}>
            {bizTaxId && <div>{isHebrew ? 'ח.פ / עוסק:' : 'Tax ID:'} {bizTaxId}</div>}
            {bizPhone && <div>{isHebrew ? 'טלפון:' : 'Phone:'} {bizPhone}</div>}
            {bizEmail && <div>{bizEmail}</div>}
            {bizAddress && <div>{bizAddress}</div>}
          </div>

          {bizPhone && (
            <a
              href={`tel:${bizPhone.replace(/[^\d+]/g, '')}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: 'rgba(255,255,255,0.94)', color: LIGHT.violet, textDecoration: 'none', fontWeight: '700', fontSize: '0.8rem', padding: '5px 12px', borderRadius: '999px' }}
            >
              <Phone size={13} strokeWidth={2.4} />
              {isHebrew ? 'חייג/י אליי' : 'Call me'}
            </a>
          )}
        </div>

        {/* תיבת פרטי הצעת המחיר */}
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.95)', padding: '10px 14px', borderRadius: '10px', minWidth: '170px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1f1b2e', marginBottom: '3px' }}>{isHebrew ? 'הצעת מחיר' : 'Price Quote'}</div>
          <div style={{ color: LIGHT.violet, fontWeight: 'bold', fontFamily: 'monospace' }}>#{quote.id?.slice(0, 8)}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b6580', marginTop: '3px' }}>
            {isHebrew ? 'תאריך:' : 'Date:'} {new Date(quote.created_at).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB')}
          </div>
          {quote.valid_until && (
            <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 'bold' }}>
              {isHebrew ? 'בתוקף עד:' : 'Valid until:'} {new Date(quote.valid_until).toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}