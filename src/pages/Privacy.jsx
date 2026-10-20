import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBackOrHome } from '../utils/goBackOrHome';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeoFor } from '../shared/publicSeoRoutes';
import ProFlowLogo from '../components/ProFlowLogo';

export default function Privacy({ isHebrew }) {
  const navigate = useNavigate();

  useEffect(() => {
    // ר' הערה מלאה ב-Contact.jsx - /privacy הלא-מקודד הוא alias לתאימות
    // בלבד, מופנה מיד (replace) ליעד המקומי שכבר נפתר כשנוחתים עליו ישירות.
    if (window.location.pathname === '/privacy') {
      navigate(isHebrew ? '/he/privacy' : '/en/privacy', { replace: true });
    }

    // One public SEO authority (src/shared/publicSeoRoutes.js), shared with the prerender build (2026-09-28).
    setSeoMeta(publicSeoFor('privacy', isHebrew ? 'he' : 'en'));
  }, [isHebrew, navigate]);

  const t = isHebrew ? {
    title: 'מדיניות פרטיות (Privacy Policy)',
    lastUpdated: 'עדכון אחרון: 20 באוקטובר 2026',
    back: 'חזור אחורה',
    sections: [
      {
        // Task 39 (Owner final scope 2026-10-13): the responsible operator, purposes and what is required (legal-documents spec, section D).
        title: '1. מי אחראי למידע ואיזה מידע נאסף',
        content: 'האחראי למידע בשירות TEKANGO הוא מפעיל השירות, כמפורט בתנאי השימוש (לפניות: support@tekango.com). בעת ההרשמה והשימוש אנו מעבדים פרטי חשבון ועסק (כגון כתובת אימייל, שם העסק ופרטי התחברות), את המידע שאתם מזינים (לקוחות, הצעות מחיר, הוצאות) ותיעוד תפעולי הדרוש לאספקת השירות, לאבטחה ולתמיכה. פרטי ההתחברות והעסק הבסיסיים נדרשים לפתיחת חשבון; בלעדיהם לא ניתן לספק את השירות. שדות נוספים הם לבחירתכם.'
      },
      {
        title: '2. שימוש במידע',
        content: 'המידע הנאסף משמש אך ורק לצורך תפעול המערכת, יצירת מסמכים עבור העסק שלך, מתן תמיכה טכנית ושיפור חוויית המשתמש. השירות אינו מעבד תשלומים כרגע. אנו לא נעשה שימוש בנתונים העסקיים שלך לשום מטרה אחרת.'
      },
      {
        title: '3. שיתוף מידע עם צד שלישי',
        content: 'אנו מתחייבים לעולם לא למכור, לסחור או להשכיר את המידע שלך לצדדים שלישיים. אנו עשויים לשתף נתונים רק עם ספקי תשתית חיוניים (כגון שרתי Supabase לאחסון נתונים) הפועלים תחת תקני אבטחה מחמירים. כרגע אין ספק סליקה מחובר לשירות; ספק התשלום ופרטי השיתוף עמו יפורסמו לפני הפעלת המסלולים בתשלום. עוזר ה-AI של TEKANGO (בצ\'אט באתר ובתוך המערכת) מעביר את הטקסט שאתם כותבים לספק מודל שפה חיצוני (OpenAI) לצורך הפקת התשובה. המערכת אינה מצרפת לשאלה באופן אוטומטי את פרטי הלקוחות שלכם (שם, אימייל, טלפון, כתובת). טקסט שאתם מקלידים בעצמכם נשלח כפי שנכתב, ולכן אל תכללו בו פרטים שאינכם רוצים להעביר. השאלות והתשובות נשמרות אצלנו יחד עם כתובת המייל של החשבון (או כפנייה אנונימית בצ\'אט באתר) ומועד הפנייה, לצורך מענה ותמיכה. הודעות מייל (למשל הצעת מחיר ללקוח, אימות חשבון ואיפוס סיסמה) נשלחות באמצעות ספק שליחה חיצוני (Resend). בטפסי ההרשמה, ההתחברות ושחזור הסיסמה פועלת בדיקת אבטחה של Cloudflare (Turnstile) שחוסמת רובוטים; לצורך הבדיקה מועברים ל-Cloudflare נתונים טכניים מהדפדפן (כמו כתובת IP וסוג הדפדפן), ולא מה שאתם מקלידים בטופס.'
      },
      {
        title: '4. שימוש ב-Cookies',
        content: 'המערכת משתמשת בקובצי עוגיות (Cookies) הכרחיים בלבד. קבצים אלו חיוניים לצורך שמירת ההתחברות שלך (Session), ניהול אבטחה וזיהוי שפת הממשק (עברית/אנגלית). אין במערכת קוקיז למטרות מעקב פרסומי חודרני.'
      },
      {
        title: '5. אבטחת מידע',
        content: 'אנו נוקטים באמצעי אבטחה מתקדמים הכוללים הצפנת נתונים בתעבורה ושימוש בשרתי ענן מוגנים. עם זאת, עליך להבין כי שום העברת נתונים באינטרנט אינה בטוחה ב-100%, ולכן איננו יכולים לערוב לאבטחה מוחלטת.'
      },
      {
        title: '6. זכויות המשתמש ומחיקה',
        content: 'אפשר לבקש לעיין במידע האישי השמור עליכם, לתקן אותו או למחוק אותו, לפי הדין החל, בפנייה אל support@tekango.com. לצורך הטיפול ייתכן שנבקש לאמת את זהותכם, ונפריד בין מידע החשבון שלכם לבין מידע של אחרים. מחיקה מתבצעת לפי התהליך הקיים ובכפוף לחובות שמירה לפי דין; עותקים בגיבויים של ספקי התשתית אינם נמחקים מיידית ומוחלפים במהלך מחזור הגיבוי. ביטול מנוי אינו בקשת מחיקה.'
      },
      {
        title: '7. תשלומים (בעת רכישת מנוי)',
        content: 'כיום לא מתבצעים תשלומים בשירות. בעת ביצוע רכישה, ספק התשלום החיצוני יעבד את פרטי התשלום הנדרשים לביצוע העסקה, והשירות יעבד את פרטי העסקה והסטטוס הדרושים לניהול המנוי ולתמיכה. זהות הספק ופרטי העיבוד יוצגו בתהליך הרכישה ובמדיניות זו לפני הפעלת התשלום.'
      },
      {
        title: '8. הודעות ודיוור',
        content: 'נשלח אליכם הודעות הנדרשות להפעלת החשבון והשירות (כגון אימות חשבון, איפוס סיסמה ותשובות לפניות). קבלת תנאי השימוש אינה הסכמה לדיוור שיווקי; אם יופעל דיוור שיווקי, הוא יישלח רק בהסכמה נפרדת, עם אפשרות הסרה.'
      },
      {
        title: '9. נושאים שטרם הוחלטו',
        content: 'משכי שמירת הנתונים והמסמכים לאחר מחיקה או סגירת חשבון, הטיפול בקבצים מצורפים ונפח האחסון טרם הוחלטו, ויפורסמו לפני הפעלת המסלולים.'
      }
    ]
  } : {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: October 20, 2026',
    back: 'Go Back',
    sections: [
      {
        // Task 39 (Owner final scope 2026-10-13): the responsible operator, purposes and what is required (legal-documents spec, section D).
        title: '1. Who Is Responsible and What We Collect',
        content: 'The party responsible for data in the TEKANGO service is its operator, as set out in the Terms of Use (contact: info@tekango.com). When you register and use the service we process account and business details (such as your email address, business name and sign-in details), the information you enter (clients, quotes, expenses) and operational records needed to provide the service, for security and for support. The basic sign-in and business details are required to open an account; without them the service cannot be provided. Other fields are optional.'
      },
      {
        title: '2. Use of Information',
        content: 'The collected data is used exclusively to operate the platform, generate your business documents, provide technical support, and improve user experience. The service does not process payments at this time. We will not use your business data for any other purpose.'
      },
      {
        title: '3. Third-Party Sharing',
        content: 'We promise never to sell, trade, or rent your personal information to third parties. We only share data with essential infrastructure providers (such as Supabase for database hosting) that operate under strict security standards. No payment processor is connected to the service at this time; the payment provider and what is shared with it will be published before paid plans are activated. The TEKANGO AI assistant (in the website chat and inside the app) sends the text you write to an external language-model provider (OpenAI) to produce its answer. The system does not automatically attach your customers\' details (name, email, phone, address) to a question. Text you type yourself is sent as written, so do not include details you do not want to pass on. Questions and answers are stored by us with the account email (or as an anonymous inquiry in the website chat) and the time, for answering and support. Emails (for example a quote to a customer, account verification and password reset) are sent through an external sending provider (Resend). The signup, sign-in and password-reset forms use a Cloudflare security check (Turnstile) to block bots; for the check, technical browser data (such as the IP address and the browser type) is sent to Cloudflare, not what you type in the form.'
      },
      {
        title: '4. Cookies',
        content: 'The platform uses only essential Cookies. These are necessary for maintaining your active session, managing security, and identifying your interface language. We do not use intrusive advertising tracking cookies.'
      },
      {
        title: '5. Data Security',
        content: 'We implement advanced security measures, including data encryption in transit and secure cloud hosting. However, please understand that no internet transmission is 100% secure, and we cannot guarantee absolute security.'
      },
      {
        title: '6. Your Rights and Deletion',
        content: 'You can ask to access, correct or delete the personal information stored about you, according to the applicable law, by writing to info@tekango.com. To handle the request we may ask to verify your identity, and we keep your account information separate from other people\'s information. Deletion follows the existing process and is subject to retention duties under the law; copies in our infrastructure providers\' backups are not deleted immediately and are replaced during the backup cycle. Cancelling a subscription is not a deletion request.'
      },
      {
        title: '7. Payments (When a Subscription Is Purchased)',
        content: 'No payments are made in the service today. When a purchase is made, the external payment provider will process the payment details needed for the transaction, and the service will process the transaction details and status needed to manage the subscription and for support. The provider and the processing details will be shown in the purchase flow and in this policy before payment is activated.'
      },
      {
        title: '8. Messages and Marketing',
        content: 'We send messages needed to operate your account and the service (such as account verification, password reset and replies to your requests). Accepting the Terms of Service is not consent to marketing emails; if marketing emails are introduced, they will be sent only with separate consent and an unsubscribe option.'
      },
      {
        title: '9. Matters Not Yet Decided',
        content: 'Retention periods for data and documents after deletion or account closure, the handling of attachments, and storage have not been decided yet and will be published before the plans are activated.'
      }
    ]
  };

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: "'Rubik', Arial, Segoe UI, Tahoma, sans-serif", background: '#090d16', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ background: 'rgba(9, 13, 22, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ProFlowLogo size={32} />
          </div>
          <button
            onClick={() => goBackOrHome(navigate, isHebrew)} 
            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.target.style.color = '#ffffff'; e.target.style.borderColor = '#ffffff'; }}
            onMouseLeave={(e) => { e.target.style.color = '#94a3b8'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          >
            {t.back}
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '40px 20px' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto', background: '#111827', padding: '40px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '8px', letterSpacing: '-0.5px' }}>{t.title}</h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '40px', fontWeight: '500' }}>{t.lastUpdated}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {t.sections.map((sec, idx) => (
              <section key={idx}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', marginBottom: '10px' }}>{sec.title}</h2>
                <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.7' }}>{sec.content}</p>
              </section>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        &copy; {new Date().getFullYear()} TEKANGO. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
      </footer>
    </div>
  );
}