import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase';
import { useSignaturePad } from '../shared/useSignaturePad';
import PublicQuoteHeader from '../components/PublicQuoteHeader';
import Toast from '../components/Toast';
import { calculateQuoteFinancials } from '../utils/regionConfig';
import { formatAddress } from '../utils/addressFormat';
import { formatMoney } from '../utils/money';
import { LIGHT } from '../theme/neonTheme';
import { UserRound, Paperclip } from 'lucide-react';

// חוק ברזל (תיקון בעלים - עיגול שקל שלם ל"סה"כ לתשלום", עקבי חשבונאית
// ולא רק תצוגתי): קובץ זה הוא Local/ILS בלעדית (currencySymbol קבוע ל-₪
// למעלה, SmartPublicQuote כבר מנתב הצעות Local בלבד לכאן) - אין צורך
// בתנאי שוק כאן בכלל, בניגוד ל-PublicQuoteEn.jsx שאסור לגעת בו. גרסה
// קודמת עיגלה רק את הסה"כ המוצג והשאירה נטו/מע"מ לא-מעוגלים - הבעלים
// דרש שהסכום יסגור בדיוק (נטו+מע"מ המוצגים = הסה"כ המעוגל, לא רק
// שהסה"כ עצמו יהיה שלם). ר' finalTotalRounded/netAmountDisplay/
// vatAmountDisplay למטה למימוש המדויק - Math.round (לא floor/ceil) נבחר
// לעיגול הסה"כ: 2505.49→2505, 2505.50→2506, 2505.51→2506.
//
// עדכון 2026-08-28 (Cross-Market Regression Audit): formatNum כאן היה
// שכפול פרטי, זהה-לגמרי-בפועל, של formatMoney הקנוני (utils/money.js) -
// Dashboard.jsx ו-PublicQuoteEn.jsx כבר אוחדו לקרוא ל-formatMoney, קובץ
// זה לבדו נשאר מאחור. formatNum כאן משמש אך ורק כשכבת-תצוגה (2 ספרות
// אחרי הנקודה) על ערכים שכבר עברו עיגול-שקל-שלם למעלה (finalTotalRounded
// וכו') - הוא עצמו לעולם לא מעגל בפועל, בדיוק כמו formatMoney - כך שהחלפה
// לקריאה ל-formatMoney אינה משנה שום התנהגות עיגול קיימת, רק מסירה שכפול.
const formatNum = (val) => formatMoney(val);

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

  // חוק ברזל (תיקון בעלים - עיגול שקל שלם, עקבי חשבונאית לא רק תצוגתי):
  // total מעוגל תחילה לשקל שלם - זהו הערך המוצג כ"סה"כ לתשלום" (finalTotalRounded).
  // בניגוד לגרסה הקודמת (עיגול הסה"כ בלבד, נטו/מע"מ נשארו לא-מעוגלים
  // ולא הסתכמו בדיוק ל-Total המוצג) - כאן הצד ה"גמיש" (התלוי, לא הראשי)
  // של נטו/מע"מ מחושב מחדש מה-total המעוגל, כך שנטו+מע"מ המוצגים
  // מסתכמים בדיוק ל-finalTotalRounded עד האגורה, בדיוק כמו שהבעלים דרש:
  //   Private (ברוטו כולל מע"מ הוא הראשי - ר' calculateQuoteFinancials):
  //     netAmountDisplay = finalTotalRounded / 1.18 (מעוגל לאגורות),
  //     vatAmountDisplay = finalTotalRounded - netAmountDisplay (השארית
  //     המדויקת, לא 18% טהור - כך הסכום תמיד סוגר בדיוק).
  //   Business (נטו הוא הראשי - הסכום שהוזן בפועל לפני מע"מ, לא משתנה):
  //     netAmountDisplay נשאר net האמיתי שהוזן, ללא שינוי; vatAmountDisplay
  //     מחושב כשארית (finalTotalRounded - net) במקום net*18% הטהור, כדי
  //     שהסכום יסגור בדיוק בלי לגעת בסכום הנטו שהוזן בפועל.
  // חשוב: זו התאמת *תצוגה* בלבד ב-Public Quote - quotes.total השמור
  // במסד הנתונים ולוגיקת החישוב/השמירה ב-Dashboard.jsx (יצירה/עריכה)
  // אינם משתנים כלל על ידי זה.
  const finalTotalRounded = !isAmbiguousClientType ? Math.round(total) : total;
  const netAmountDisplay = isPrivateDisplay
    ? Math.round((finalTotalRounded / (1 + vatRate)) * 100) / 100
    : netAmount;
  const vatAmountDisplay = (!isAmbiguousClientType && netAmountDisplay !== null && netAmountDisplay !== undefined)
    ? Math.round((finalTotalRounded - netAmountDisplay) * 100) / 100
    : vatAmount;

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
        .pq-card { padding: var(--pf-doc-shell-padding); }
        /* חוק ברזל (Width Consistency Fix, סבב זה - ר' src/index.css לפרטים
           המלאים): --pf-desktop-content-width הוא רוחב-התוכן-החזותי, לא
           רוחב-המעטפת. הכרטיס הלבן (.pq-card) הוא "מסמך" עם padding/border
           דקורטיביים משלו (40px + 1px) בין גבול הכרטיס לתוכן הנראה בפועל
           בתוכו - אם max-width של הכרטיס עצמו היה שווה בדיוק לטוקן, התוכן
           הנראה בפועל היה צר ב-82px (2×40px padding + 2×1px border) מהטוקן
           - נמדד חי ואושר כתקלה אמיתית: כרטיס 980px, תוכן נראה 898px בלבד.
           התיקון: max-width של הכרטיס עצמו הוא עכשיו הטוקן *בתוספת* תקציב
           ה-padding/border (calc), כך שהכרטיס עצמו רחב יותר מ-980px בדיוק
           לפי ה-inset הדקורטיבי שלו, והתוכן הנראה בפועל בתוכו (ילדי-בלוק
           רגילים שממלאים את תיבת-התוכן של הכרטיס) יוצא בדיוק 980px
           אוטומטית - בלי לגעת ברוחב של אף סקשן פנימי בנפרד. */
        @media (min-width: 1024px) {
          .pq-card-desktop-width {
            width: 100% !important;
            max-width: calc(var(--pf-desktop-content-width) + (2 * var(--pf-doc-shell-padding)) + (2 * var(--pf-doc-shell-border-width))) !important;
          }
        }
        @media (max-width: 640px) {
          /* חוק ברזל (תיקון בעלים מאושר - רוחב מובייל אמיתי, לא A4):
             ה-padding הקבוע 20px של המעטפת החיצונית (.pq-page) הוא הגורם
             השורשי לתחושת "דף A4 צף בתוך הטלפון" - הוא לא היה תלוי-viewport
             בכלל, זהה בדסקטופ ובמובייל. הוקטן כאן ל-6px רק מתחת ל-640px -
             משאיר גבול קטן וסביר (יעד הבעלים: 4-8px) בלי לגעת בערך
             הדסקטופ המקורי (20px, לא במדיה query זו). */
          .pq-page {
            padding: 4px !important;
          }
          /* חוק ברזל (תיקון בעלים - העברה שלישית, "עדיין נראה כמו דף A4"):
             מדידה חיה חשפה שהבעיה האמיתית לא הייתה ברוחב .pq-card עצמו
             (378px מתוך 390px - כבר בתוך היעד) אלא בכך שכל אחד מהבלוקים
             הנראים בפועל (צירופים/סיכום/תקנון/הערות/חתימה) שמר padding
             פנימי מקורי-לדסקטופ (15-20px) שמעולם לא טופל במעבר מובייל
             כלשהו - בנוסף ל-padding-ה-12px של הכרטיס עצמו. כפל השוליים
             (כרטיס + בלוק) יצר בפועל מרווח כפול בצד כל בלוק, מה שנתן
             תחושת "דף עם שוליים" גם כששרשרת ה-wrapper החיצונית עצמה כבר
             מדדה נכון. הפתרון: לצמצם את ה-padding של הכרטיס עצמו כמעט
             לאפס במובייל (המבנה/הרקע הצבעוני של כל בלוק כבר מספק הפרדה
             חזותית משלו - אין עוד צורך ב"מסגרת נייר" נוספת של הכרטיס),
             ולהחיל padding אחיד וסביר (10px 12px) על כל הבלוקים
             באמצעות class משותף חדש (pq-section) - כך שכל הבלוקים
             מיושרים לאותו רוחב חזותי בפועל, לא רק ה-wrapper החיצוני. */
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
      {/* חוק ברזל (תיקון בעלים - Desktop עדיין נראה כמו דף A4 צר): maxWidth
          קבוע 1100px היה רק 57.3% מרוחב viewport ב-1920px (ו-80.5% ב-
          1366px) - השוליים הריקים משני הצדדים הם בדיוק מה שיצר את
          תחושת "דף A4 צף במסך רחב", גם אחרי שהוגדל פעם קודמת מ-800px.
          width:100% הבסיסי (קריטי למובייל - ר' .pq-page-card-desktop
          למטה) נשאר כפי שהיה, ורק ממעל ל-1024px נוסף override ל-92%
          עם maxWidth 1400px (תקרה סבירה נגד שורות טקסט/טבלה מתוחות
          מדי-לקריאה ברוחבים גדולים במיוחד) - כדי לא לגעת כלל בהתנהגות
          המובייל שכבר אושרה ע"י הבעלים (Part 8 - איסור מפורש על regression).
          נמדד חי (רוחב קודם): 1366px→~1220px, 1440px→~1286px,
          1920px→1400px (נתפס ע"י ה-maxWidth הקודם).
          תיקון בעלים (Baseline Closure Part 11 - "הרוחב הגדיל יותר מדי"):
          הבעלים בדק פיזית ודיווח שהרוחב שלמעלה גדול מדי - נדרש צמצום של
          כ-10% מהרוחב המיושם הנוכחי (לא 10 נקודות אחוז מה-viewport).
          92%→82.8% ו-maxWidth 1400px→1260px (שניהם *0.9 בדיוק) - יעד
          משוער חדש: 1366px→~1098px, 1440px→~1157px, 1920px→1260px,
          תואם לטווח ההנחיה שנתן הבעלים (~1085/~1147/~1260). מובייל
          (width:100% הבסיסי) לא נגע כלל - התיקון הזה חי רק בתוך
          @media (min-width:1024px).
          תיקון שלישי (Global Surface Audit + Implementation Pass): הבעלים
          דיווח שגם 82.8%/1260px עדיין רחב מדי ביחס להצעת-מחיר-ייחוס
          (reference quote) - לא סופק קובץ/תמונה בפועל בסבב הזה, מודגש
          כאן במפורש (באותו רוח כמו אי-קבלת התמונה המתועדת קודם ב-§18.AX)
          ולא מוסתר. במקום צמצום אחוז נוסף (התבנית שכבר חזרה פעמיים ועדיין
          לא הספיקה), עברנו למודל רוחב-מסמך יציב לגמרי: maxWidth קבוע
          980px (לא אחוז-מ-viewport בכלל), עדיין ממורכז דרך justifyContent:
          'center' הקיים כבר ב-.pq-page ההורה. 980px רחב יותר מ-800px הישן
          (שהוגדר בעבר כ"נכשל, נראה כמו A4 צר מדי") אך צר משמעותית מ-1260px
          הקודם - החלטה מנומקת בהנחיה האיכותית שניתנה (ממורכז, פרופורציות
          מסמך מקצועיות, טבלאות קריאות, לא edge-to-edge), לא מדידה מול
          תמונת-ייחוס בפועל. יעד לאימות/תיקון מדויק בסבב הבא כשתסופק
          תמונה. מובייל לא נגע כלל.
          רביעי (Owner decision - Global Surface Audit follow-up): הבעלים
          אישר 980px כרוחב-דסקטופ הקנוני *המשותף* גם לאפליקציה המאומתת
          (Dashboard.jsx) - במקום 980px כאן ו-1040px שם בנפרד. הערך עצמו
          הוצא ממשתנה CSS משותף יחיד, --pf-desktop-content-width
          (src/index.css), כדי שלא יהיה עוד מקום לסטייה עתידית בין
          המשטחים - שני הקבצים (זה ו-PublicQuoteEn.jsx) קוראים לאותו
          המשתנה במקום לשכפל את המספר.
          חמישי (תיקון עקביות-רוחב, סבב זה - ר' src/index.css להסבר המלא):
          התברר שהחלת הטוקן ישירות על ה-max-width של הכרטיס עצמו (כפי
          שנעשה ברביעי) גרמה לכרטיס להיות 980px, אבל התוכן הנראה בפועל
          בתוכו (הכותרת הסגולה/נמען/טבלה/צירופים/תקנון) היה רק 898px -
          82px צר יותר, בגלל ה-padding+border הדקורטיביים של הכרטיס עצמו
          שלא נלקחו בחשבון. נמדד חי ואושר ע"י הבעלים כתקלה אמיתית. עכשיו
          ה-max-width של הכרטיס מחושב ע"י calc() שמוסיף את תקציב ה-
          padding/border בחזרה מעל לטוקן (ר' --pf-doc-shell-padding/
          --pf-doc-shell-border-width ב-src/index.css) - כך שהכרטיס עצמו
          רחב מעט יותר מ-980px (בדיוק לפי ה-inset הדקורטיבי שלו), אבל
          התוכן הנראה בתוכו יוצא בדיוק 980px - זהה ל-Dashboard.jsx. לא
          נדרש שינוי לאף סקשן פנימי בנפרד (כולם ילדי-בלוק רגילים שממלאים
          את תיבת-התוכן של הכרטיס). מובייל לא נגע כלל - ה-override הנפרד
          ב-@media (max-width:640px) ממשיך לקבוע padding:2px משלו,
          בלתי-תלוי בטוקן הזה. */}
      <div className="pq-card pq-card-desktop-width" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'var(--pf-doc-shell-border-width) solid #e2e8f0', width: '100%', maxWidth: '1100px', boxSizing: 'border-box' }}>

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

        {/* Client & Business Info + Attn (item 18) - a flex row so the two
            blocks share the existing horizontal space instead of adding
            page height; DOM order (recipient first, Attn second) drives the
            RTL mirroring naturally (same established pattern as the totals
            fix above) - recipient lands on the right ("לכבוד"), Attn on the
            left ("לידי"), exactly the composition the owner specified,
            with no isHebrew-conditional ordering logic needed. flexWrap
            lets Attn drop below the recipient block on narrow/Mobile
            screens automatically - no separate media query. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '25px' }}>
        <div className="pq-recipient" style={{ flex: '1 1 240px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}`, textAlign: 'right', boxSizing: 'border-box' }}>
          {/* חוק ברזל (תיקון בעלים - היררכיה חזותית לנמען): התווית "לכבוד:"
              נשארת בצבע כהה/רגיל (לא סגול) - נתוני הנמען עצמם (שם/אימייל/
              טלפון/כתובת) עוברים לסגול המותג (LIGHT.violet, אותו טוקן בדיוק
              כמו הכותרת הסגולה) כדי לתת יותר בולטות/כבוד ללקוח. היפוך מכוון
              מהצבעים הקודמים (תווית הייתה סגולה, הנתונים היו כהים/אפורים). */}
          <div className="pq-recipient-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
            <UserRound size={13} strokeWidth={2.4} />
            לכבוד:
          </div>
          <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', color: LIGHT.violet }}>{client?.company_name || 'לקוח נכבד'}</div>
          {client?.email && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{client.email}</div>}
          {clientPhoneFormatted && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem', direction: 'ltr', textAlign: 'right' }}>{clientPhoneFormatted}</div>}
          {client?.address && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem' }}>{formatAddress(client.address, true)}</div>}

          {quote.subject && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', fontSize: '0.95rem', color: '#0f172a', fontWeight: 'bold' }}>
              <span style={{ color: LIGHT.violet, fontWeight: 'bold' }}>נושא ההצעה: </span>
              <span style={{ fontWeight: 'normal' }}>{quote.subject}</span>
            </div>
          )}
        </div>

        {quote.attn_name && (
          <div className="pq-recipient" style={{ flex: '1 1 240px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, borderInlineStart: `4px solid ${LIGHT.violet}`, textAlign: 'right', boxSizing: 'border-box' }}>
            <div className="pq-recipient-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#1e293b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '6px' }}>
              <UserRound size={13} strokeWidth={2.4} />
              לידי:
            </div>
            <div className="pq-recipient-name" style={{ fontSize: '1.2rem', fontWeight: '800', color: LIGHT.violet }}>{quote.attn_name}</div>
            {quote.attn_role && <div className="pq-recipient-detail" style={{ color: LIGHT.violet, fontSize: '0.9rem' }}>{quote.attn_role}</div>}
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
                <th style={{ padding: '10px', textAlign: 'right' }}>מחיר יחידה</th>
                <th style={{ padding: '10px', textAlign: 'right', borderRadius: '8px 0 0 8px' }}>סה"כ</th>
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
                      {/* חוק ברזל (Money Alignment Fix, סבב זה): textAlign:'left'
                          כאן היה שגוי - עמודת המחיר/סה"כ כבר משותפת ברוחב
                          בין שורות (טבלה רגילה, לא grid/flex עצמאי-לשורה),
                          אז תיקון היישור בלבד (ל-'right', תואם לברירת
                          המחדל textAlign:'right' של הטבלה עצמה בשורה 350)
                          מספיק כדי שהספרות יתיישרו לפי ערך-מקום בין
                          שורות פריטים - נמדד חי לפני התיקון: שתי שורות עם
                          left=730.83/513.5 זהה, right משתנה - אחרי התיקון
                          הימני (הנכון) הוא המשותף. */}
                      <td style={{ padding: '12px 10px', textAlign: 'right', color: '#475569' }}><span className="pf-money">{currencySymbol}{formatNum(itemPrice)}</span></td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}><span className="pf-money">{currencySymbol}{formatNum(item.total_price || (itemQty * itemPrice))}</span></td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    הצעת מחיר כללית בסך {formatNum(finalTotalRounded)} {currencySymbol}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Attachments Section - always visible (product awareness: the customer
            should see the system supports attachments even when none exist) */}
        <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
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
        {/* חוק ברזל (תיקון בעלים - כיווניות שורות הסה"כ): כל שורת סה"כ
            הייתה נושאת flexDirection:'row-reverse' מפורש, שנלחם בהתנהגות
            ה-RTL הטבעית של הקונטיינר (dir="rtl" יורש מלמעלה) - התוצאה
            הייתה תווית ב-שמאל וסכום ב-ימין, ההפך המדויק מהיעד. הוסר
            מכל שש השורות: עכשיו סדר ה-DOM [תווית, סכום] בלבד קובע -
            תחת RTL רגיל (בלי override), הילד הראשון (תווית) נופל
            ל"התחלה" הפיזית (ימין), השני (סכום) ל"סוף" (שמאל) - בדיוק
            אותה טכניקת מיפוי-דרך-סדר-DOM שכבר הוכיחה עצמה בכל שאר
            הקומפוננטות בפרויקט. נמדד חי: לפני התיקון תווית ב-x≈1253
            (שמאל), סכום ב-x≈1531 (ימין) - הפוך; אחרי התיקון (ר' בדיקה
            חיה) תווית בימין, סכום בשמאל. */}
        {/* Owner correction (Global Surface Audit Part 9 / Part 11 of this pass):
            the totals CARD itself (outer placement, not the internal
            label/amount row order fixed above) sat on the RIGHT
            (justifyContent:'flex-start' under dir="rtl" = physical start =
            right) - the owner wants the entire card on the LEFT. Changed
            to 'flex-end' (physical end under RTL = left). This is purely
            the outer wrapper's placement; the card's own internal content
            (label right / amount left) is untouched and still correct. On
            Mobile the card is width:100% so justifyContent has no visible
            effect either way - confirmed no Mobile regression. */}
        {/* חוק ברזל (Money Alignment Fix - הביקורת חזרה: tabular-nums לבד לא
            הספיק): כל שורה הייתה div flex עצמאי (space-between) - הסכום
            (הילד השני, "end" פיזית = שמאל תחת RTL) היה נדבק לקצה השמאלי
            הקבוע *של השורה שלו* בלבד - כלומר הקצה המשותף בין שורות היה
            השמאלי, לא הימני (איפה שהספרות/הנקודה העשרונית בפועל נמצאות) -
            בדיוק ההפך מיישור-לפי-ערך-מקום. נמדד חי לפני התיקון: שלוש
            שורות עם left=524.5 זהה, right משתנה (597.19/584.69/647.34) -
            "משותפות בקצה השמאלי", לא בימני. הפתרון המבני: כל שורות
            הטוטלים הן עכשיו ילדים ישירים של גריד אחד (pq-totals-grid,
            gridTemplateColumns: 1fr auto) כך שעמודת הסכום מחושבת פעם אחת
            עבור כל השורות יחד (בדיוק כמו עמודת טבלה משותפת) - לא בנפרד
            לכל שורה כמו קודם. React Fragments (<>) במקום <div> לכל שורה
            כדי שהילדים יצטרפו ישירות לגריד ההורה בלי לשבור את שיתוף
            העמודה. textAlign:'right' על כל תא-סכום (פיזי, לא מותנה שפה -
            סכום כספי תמיד מיושר לימין הפיזי). קו ההפרדה לפני השורה
            הסופית הוא ילד-גריד נפרד שפורש שתי העמודות (gridColumn:'1/-1')
            כדי שהקו יהיה רציף על פני כל הרוחב. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
          <div className="pq-section pq-totals-grid" style={{ width: '100%', maxWidth: '380px', background: '#faf9fd', padding: '16px 20px', borderRadius: '12px', border: `1px solid ${LIGHT.border}`, boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr auto', columnGap: '12px', rowGap: '8px' }}>
            {/* Local Private: אין שורת "סכום ביניים" נפרדת - היא כפולה ל-total
                (שניהם ה-ברוטו שהוזן/ה-total הסופי). מציגים ישירות את פירוט
                החשבונאות הרגיל: סכום לפני מע"מ / מע"מ / סה"כ, בדיוק כמו Business. */}
            {!isPrivateDisplay && (
              <>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>סיכום ביניים:</span>
                <span className="pf-money" style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'right' }}>{currencySymbol}{formatNum(subtotal)}</span>
              </>
            )}
            {quote.discount > 0 && (
              <>
                <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>הנחה ({quote.discount}%):</span>
                <span className="pf-money" style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'right' }}>{currencySymbol}{formatNum(discountAmountDisplay)}</span>
              </>
            )}
            {/* client_type חסר/לא-מזוהה: לעולם לא מציגים פירוט מע"מ (מוסף/כלול/
                נטו) מבוסס-ניחוש - לא Business, לא Private. מציגים רק
                subtotal/discount/total האמינים שכבר שמורים, בלי שורת מע"מ כלל. */}
            {isAmbiguousClientType ? null : isPrivateDisplay ? (
              // תצוגה חשבונאית רגילה (Private): "סכום לפני מע"מ" / "מע"מ (18%)"
              // - אותם ערכים בדיוק כמו קודם (netAmount, vatAmount), רק
              // תוויות/סדר שונים; אין נוסחה חדשה.
              <>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>סכום לפני מע"מ:</span>
                <span className="pf-money" style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'right' }}>{currencySymbol}{formatNum(netAmountDisplay)}</span>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>מע"מ (18%):</span>
                <span className="pf-money" style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'right' }}>{currencySymbol}{formatNum(vatAmountDisplay)}</span>
              </>
            ) : (
              <>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>מע"מ (18%):</span>
                <span className="pf-money" style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'right' }}>{currencySymbol}{formatNum(vatAmountDisplay)}</span>
              </>
            )}
            <div style={{ gridColumn: '1 / -1', borderTop: `2px solid ${LIGHT.borderStrong}`, marginTop: '5px', paddingTop: '4px' }} />
            <span style={{ fontSize: '1.3rem', fontWeight: '900', color: '#1e293b' }}>סה"כ לתשלום:</span>
            <span className="pf-money" style={{ color: LIGHT.violet, fontSize: '1.3rem', fontWeight: '900', textAlign: 'right' }}>{currencySymbol}{formatNum(finalTotalRounded)}</span>
          </div>
        </div>

        {/* Terms & Notes */}
        {displayTerms && (
          <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>תקנון ותנאים:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{displayTerms}</div>
          </div>
        )}

        {quote.notes && (
          <div className="pq-section" style={{ marginBottom: '25px', background: '#f8fafc', padding: '15px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>הערות נוספות:</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{quote.notes}</div>
          </div>
        )}

        {/* Signature */}
        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '25px', textAlign: 'center' }}>
          {approved ? (
            <div className="pq-section" style={{ background: '#dcfce7', color: '#166534', padding: '20px', borderRadius: '12px', fontWeight: 'bold' }}>
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
            <div className="pq-section" style={{ background: '#eff6ff', color: '#1e40af', padding: '15px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '600', border: '1px solid #bfdbfe' }}>
              ℹ️ תצוגת מנהל: אזור החתימה מוצג ללקוח בלבד.
            </div>
          ) : (
            <div className="pq-section" style={{ border: '1px solid #cbd5e1', padding: '20px', borderRadius: '12px', background: '#f8fafc', textAlign: 'center', boxSizing: 'border-box' }}>
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
