import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBackOrHome } from '../utils/goBackOrHome';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeoFor } from '../shared/publicSeoRoutes';
import ProFlowLogo from '../components/ProFlowLogo';
import { writeConsent, readConsent, CONSENT_EVENT } from '../shared/siteAnalytics';

export default function Privacy({ isHebrew }) {
  const navigate = useNavigate();
  // Owner 2026-10-23 (typed L-12, item 7 א): the visitor's stored measurement choice, kept current when it changes (the notice / another tab)
  const [consent, setConsent] = useState(() => readConsent());
  useEffect(() => {
    const onChange = () => setConsent(readConsent());
    window.addEventListener(CONSENT_EVENT, onChange);
    window.addEventListener('storage', onChange);
    const stop = () => { window.removeEventListener(CONSENT_EVENT, onChange); window.removeEventListener('storage', onChange); };
    return stop;
  }, []);

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
    lastUpdated: 'עדכון אחרון: 25 באוקטובר 2026',
    back: 'חזרה',
    sections: [
      {
        // Task 39 (Owner final scope 2026-10-13): the responsible operator, purposes and what is required (legal-documents spec, section D).
        title: '1. מי אחראי למידע ואיזה מידע נאסף',
        content: 'האחראי למידע בשירות TEKANGO הוא מפעיל השירות, כמפורט בתנאי השימוש (לפניות: support@tekango.com). בעת ההרשמה והשימוש אנו מעבדים פרטי חשבון ועסק (כגון כתובת מייל, שם העסק ופרטי התחברות), את המידע שאתם מזינים (לקוחות, הצעות מחיר, הוצאות) ותיעוד תפעולי הדרוש לאספקת השירות, לאבטחה ולתמיכה. כדי לפתוח חשבון חובה למסור כתובת מייל וסיסמה ולאשר את תנאי השימוש ואת מדיניות הפרטיות; בלי אלה אי אפשר לפתוח חשבון. שם מלא ושם העסק בהרשמה הם לבחירתכם. לפני הפקת הצעת המחיר הראשונה נדרשים טלפון העסק (ובישראל גם ח.פ או מספר עוסק), כי הם מופיעים בהצעה; בלעדיהם אפשר להשתמש במערכת, אבל לא להפיק הצעה. שאר השדות לבחירתכם.',
        operatorLink: { href: '/he/terms#operator-details', label: 'פרטי המפעיל (סעיף 12 בתנאי השימוש)' }
      },
      {
        title: '2. שימוש במידע',
        content: 'המידע הנאסף משמש אך ורק לתפעול המערכת, ליצירת מסמכים עבור העסק שלכם, למתן תמיכה טכנית ולשיפור חוויית המשתמש. רכישת המנוי עצמו מתבצעת באמצעות ספק תשלום חיצוני (ראו סעיף 7). לא נעשה שימוש בנתונים העסקיים שלכם לשום מטרה אחרת.'
      },
      {
        title: '3. שיתוף מידע עם צד שלישי',
        content: 'אנו מתחייבים לעולם לא למכור את המידע שלכם, לסחור בו או להשכיר אותו לצדדים שלישיים. אנו עשויים לשתף נתונים רק עם ספקי תשתית חיוניים (כגון שרתי Supabase לאחסון נתונים) הפועלים תחת תקני אבטחה מחמירים. רכישת מנוי מתבצעת בדף תשלום מאובטח של ספק התשלום פיי פלוס (PayPlus); מה שמועבר אליו מפורט בסעיף 7. עוזר ה-AI של TEKANGO (בצ\'אט באתר ובתוך המערכת) מעביר לספק מודל שפה חיצוני (OpenAI) את מה שנדרש להפקת התשובה: את הטקסט שאתם כותבים, צילום מסך שאתם מצרפים לשאלה, ובשימוש בקול גם את ההקלטה (לתמלול) ואת טקסט התשובה (להקראה). כשאתם שואלים את העוזר בתוך המערכת על נתוני החשבון שלכם, למשל על לקוח, הצעה, פריט בקטלוג או משימה, הוא שולף מהחשבון את הנתונים הרלוונטיים ומעביר אותם לספק לצורך התשובה, ובהם גם פרטי לקוח כמו שם, איש קשר, מייל וטלפון. העוזר שולף נתונים מהחשבון רק כשאתם שואלים עליהם, והוא אינו משנה נתונים. אל תכללו בטקסט או בצילום פרטים שאינכם רוצים להעביר. ההקלטה עצמה אינה נשמרת אצלנו; התמלול נשלח כשאלה רגילה ונשמר כמו כל שאלה. השאלות והתשובות נשמרות אצלנו יחד עם כתובת המייל של החשבון (או כפנייה אנונימית בצ\'אט באתר) ומועד הפנייה, לצורך מענה ותמיכה. הודעות מייל (למשל הצעת מחיר ללקוח, אימות חשבון ואיפוס סיסמה) נשלחות באמצעות ספק שליחה חיצוני (Resend). בטפסי ההרשמה, ההתחברות ושחזור הסיסמה פועלת בדיקת אבטחה של Cloudflare (Turnstile) שחוסמת רובוטים; לצורך הבדיקה מועברים ל-Cloudflare נתונים טכניים מהדפדפן (כמו כתובת IP וסוג הדפדפן), ולא מה שאתם מקלידים בטופס. בדפים הציבוריים של האתר (דף הבית, הכלים, יצירת קשר, תנאי השימוש ומדיניות הפרטיות) אנו משתמשים בשירות המדידה Google Analytics של Google, כדי לדעת כמה מבקרים מגיעים לאתר, מאילו מקורות (למשל רשת חברתית או חיפוש) ובאילו דפים הם צופים. לצורך המדידה מועברים ל-Google נתונים טכניים מהדפדפן (כמו כתובת IP, סוג המכשיר והדפדפן, הדף שבו צפיתם והמקור שממנו הגעתם), והם עשויים להישמר בשרתים מחוץ לישראל, גם בארצות הברית. המדידה אינה פועלת בתוך המערכת, בהצעות המחיר שנשלחות ללקוחות ובכרטיסי העסק, ואינה מקבלת את מה שאתם מקלידים או את נתוני העסק שלכם.'
      },
      {
        id: 'cookies',
        title: '4. שימוש ב-Cookies',
        cookieChoice: true,
        content: 'האתר והמערכת משתמשים בעוגיות (Cookies) ובאחסון מקומי בדפדפן משני סוגים. הכרחיים: לשמירת ההתחברות שלכם (Session), לאבטחה, לזיכרון שפת הממשק (העוגייה proflow_lang, לשנה) ולזיכרון מדינת הגלישה שלפיה נבחר דף הבית (העוגייה proflow_geo_country, ליממה). מדידה: בדפים הציבוריים בלבד, עוגיות של Google Analytics (כמו _ga, נשמרות עד שנתיים) שמבחינות בין ביקור חוזר לביקור חדש. באתר באנגלית, וגם באתר בעברית למבקרים מהאיחוד האירופי, מהאזור הכלכלי האירופי, מבריטניה ומשווייץ (או כשלא ידוע מאיפה הביקור), עוגיות המדידה נשמרות רק אחרי שהמבקר מאשר אותן. באתר בעברית, למבקרים מכל מקום אחר, המדידה פועלת כברירת מחדל, ואפשר לבטל אותה בכל עת בכפתור שלמטה. אפשר לחסום או למחוק עוגיות בהגדרות הדפדפן, או להתקין את תוסף הדפדפן של Google לחסימת Google Analytics. איננו משתמשים בעוגיות פרסום.'
      },
      {
        title: '5. אבטחת מידע',
        content: 'אנו נוקטים אמצעי אבטחה מתקדמים, ובהם הצפנת נתונים בתעבורה ושימוש בשרתי ענן מוגנים. עם זאת, יש להבין שאין העברת נתונים באינטרנט שבטוחה ב-100%, ולכן איננו יכולים לערוב לאבטחה מוחלטת.'
      },
      {
        title: '6. זכויות המשתמש ומחיקה',
        content: 'אפשר לבקש לעיין במידע האישי השמור עליכם, לתקן אותו או למחוק אותו, לפי הדין החל, בפנייה אל support@tekango.com. לצורך הטיפול ייתכן שנבקש לאמת את זהותכם, ונפריד בין מידע החשבון שלכם לבין מידע של אחרים. מחיקה מתבצעת לפי התהליך הקיים ובכפוף לחובות שמירה לפי דין; עותקים בגיבויים של ספקי התשתית אינם נמחקים מיידית ומוחלפים במהלך מחזור הגיבוי. ביטול מנוי אינו בקשת מחיקה.'
      },
      {
        title: '7. תשלומים (בעת רכישת מנוי)',
        content: 'רכישת מנוי מתבצעת בדף תשלום מאובטח של ספק התשלום פיי פלוס (PayPlus). את פרטי הכרטיס ואת פרטי הקשר לחשבונית אתם מזינים ישירות בדף של פיי פלוס; הם לא עוברים דרכנו ולא נשמרים אצלנו. אנו מעבירים לפיי פלוס את סכום העסקה, המטבע, שם המסלול ומזהה פנימי של הרכישה, ומקבלים ממנו את תוצאת העסקה: מזהה העסקה, הסכום, המצב ומזהה הוראת הקבע. אלה נשמרים אצלנו לצורך ניהול המנוי, החידושים, הביטולים, ההחזרים והתמיכה. פיי פלוס שולחת אליכם במייל את אישור העסקה ואת חשבונית המס-קבלה. בקשות השרת שלנו לפיי פלוס עוברות דרך שירות ממסר עם כתובת קבועה (Fixie), שאינו מקבל את פרטי הכרטיס.'
      },
      {
        title: '8. הודעות ודיוור',
        content: 'נשלח אליכם הודעות הנדרשות להפעלת החשבון והשירות (כגון אימות חשבון, איפוס סיסמה ותשובות לפניות). קבלת תנאי השימוש אינה הסכמה לדיוור שיווקי; אם יופעל דיוור שיווקי, הוא יישלח רק בהסכמה נפרדת, עם אפשרות הסרה.'
      },
      {
        title: '9. נושאים שטרם הוכרעו',
        content: 'טרם נקבעו משכי שמירת הנתונים והמסמכים לאחר מחיקה או סגירת חשבון, אופן הטיפול בקבצים מצורפים ונפח האחסון. הם יפורסמו כשייקבעו.'
      }
    ]
  } : {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: October 25, 2026',
    back: 'Go Back',
    sections: [
      {
        // Task 39 (Owner final scope 2026-10-13): the responsible operator, purposes and what is required (legal-documents spec, section D).
        title: '1. Who Is Responsible and What We Collect',
        content: 'The party responsible for data in the TEKANGO service is its operator, as set out in the Terms of Use (contact: info@tekango.com). When you register and use the service we process account and business details (such as your email address, business name and sign-in details), the information you enter (clients, quotes, expenses) and operational records needed to provide the service, for security and for support. To open an account you must give an email address and a password and accept the Terms of Use and this Privacy Policy; without them an account cannot be opened. Full name and business name at sign-up are optional. Before the first quote is produced, a business phone number is required (in Israel also the business registration number), because they appear on the quote; without them you can use the system but not produce a quote. Other fields are optional.',
        operatorLink: { href: '/en/terms#operator-details', label: 'Operator details (section 12 of the Terms of Use)' }
      },
      {
        title: '2. Use of Information',
        content: 'The collected data is used exclusively to operate the platform, generate your business documents, provide technical support, and improve user experience. For accounts in Israel, a subscription can be bought through an external payment provider (see section 7); for accounts outside Israel, the service does not process payments at this time. We will not use your business data for any other purpose.'
      },
      {
        title: '3. Third-Party Sharing',
        content: 'We promise never to sell, trade, or rent your personal information to third parties. We only share data with essential infrastructure providers (such as Supabase for database hosting) that operate under strict security standards. Subscription purchases (open for accounts in Israel only) are made on a secure payment page of the payment provider PayPlus; what is shared with it is described in section 7. The TEKANGO AI assistant (in the website chat and inside the app) sends an external language-model provider (OpenAI) what it needs to produce its answer: the text you write, a screenshot you attach to a question, and, when you use voice, the recording (for transcription) and the answer text (for reading aloud). When you ask the assistant inside the app about your account data, for example about a client, a quote, a catalog item or a task, it retrieves the relevant data from your account and sends it to the provider for the answer, including client details such as name, contact person, email and phone. The assistant retrieves account data only when you ask about it, and it does not change data. Do not include in text or screenshots details you do not want to pass on. The recording itself is not stored by us; its transcript is sent as an ordinary question and is stored like any question. Questions and answers are stored by us with the account email (or as an anonymous inquiry in the website chat) and the time, for answering and support. Emails (for example a quote to a customer, account verification and password reset) are sent through an external sending provider (Resend). The signup, sign-in and password-reset forms use a Cloudflare security check (Turnstile) to block bots; for the check, technical browser data (such as the IP address and the browser type) is sent to Cloudflare, not what you type in the form. On the public pages of the website (the home page, tools, contact, Terms of Use and Privacy Policy) we use Google Analytics, a Google measurement service, to learn how many visitors come to the website, where they come from (for example a social network or a search) and which pages they view. For this, technical browser data (such as the IP address, the device and browser type, the page viewed and the referring source) is sent to Google and may be stored on servers outside Israel, including in the United States. Measurement does not run inside the app, on quotes sent to customers or on business cards, and it never receives what you type or your business data.'
      },
      {
        id: 'cookies',
        title: '4. Cookies',
        content: 'The website and the app use cookies and browser storage of two kinds. Essential: to keep you signed in (session), for security, to remember the interface language (the proflow_lang cookie, one year) and the browsing country used to choose the home page (the proflow_geo_country cookie, one day). Measurement: on the public pages only, Google Analytics cookies (such as _ga, kept for up to two years) that tell a returning visit from a new one. On the English website, and on the Hebrew website for visitors in the European Union, the European Economic Area, the United Kingdom and Switzerland (or when the visitor\'s country is unknown), these measurement cookies are set only after you accept them in the cookie notice, and you can change your choice at any time with the button below; on the Hebrew website, for visitors anywhere else, measurement runs by default and can be turned off at any time. You can also block or delete cookies in your browser settings, or install Google\'s browser add-on that blocks Google Analytics. We do not use advertising cookies.',
        cookieChoice: true
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
        content: 'Subscription purchase is open for accounts in Israel only; for accounts outside Israel no payments are made in the service today. A purchase is made on a secure payment page of the payment provider PayPlus. You enter your card details and the contact details for the receipt directly on the PayPlus page; they do not pass through us and are not stored by us. We send PayPlus the amount, the currency, the plan name and an internal purchase id, and receive the transaction result: the transaction id, the amount, the status and the standing-order id. These are stored by us to manage the subscription, renewals, cancellations, refunds and support. PayPlus emails you the transaction confirmation and the receipt. Our server requests to PayPlus pass through a fixed-address relay service (Fixie), which does not receive card details.'
      },
      {
        title: '8. Messages and Marketing',
        content: 'We send messages needed to operate your account and the service (such as account verification, password reset and replies to your requests). Accepting the Terms of Service is not consent to marketing emails; if marketing emails are introduced, they will be sent only with separate consent and an unsubscribe option.'
      },
      {
        title: '9. Matters Not Yet Decided',
        content: 'Retention periods for data and documents after deletion or account closure, the handling of attachments, and storage have not been decided yet and will be published once decided.'
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
              <section key={idx} id={sec.id} style={{ scrollMarginTop: '84px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', marginBottom: '10px' }}>{sec.title}</h2>
                <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.7' }}>{sec.content}</p>
                {sec.operatorLink && (
                  // PRODUCT_TRUTH_DECORATIVE: opens the operator details section of the Terms of Use (no state change)
                  <a href={sec.operatorLink.href} style={{ display: 'inline-block', marginTop: '8px', color: '#5eead4', fontWeight: 600 }}>{sec.operatorLink.label}</a>
                )}
                {sec.cookieChoice && !isHebrew && (
                  // PRODUCT_TRUTH_DECORATIVE: clears the stored cookie choice of this browser (and the measurement cookies) so the notice asks again
                  <button type="button" data-testid="privacy-cookie-choice" onClick={() => writeConsent(null)}
                    style={{ marginTop: '12px', background: 'transparent', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Change my cookie choice
                  </button>
                )}
                {sec.cookieChoice && isHebrew && (
                  // PRODUCT_TRUTH_DECORATIVE: turns the visitor measurement off in this browser (and removes its cookies), or back on (Owner 2026-10-23, item 7 א)
                  <button type="button" data-testid="privacy-cookie-choice-he" aria-pressed={consent === 'denied'}
                    onClick={() => writeConsent(consent === 'denied' ? 'granted' : 'denied')}
                    style={{ marginTop: '12px', background: 'transparent', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {consent === 'denied' ? 'אישור מדידה' : 'ביטול ההסכמה למדידה'}
                  </button>
                )}
                {sec.cookieChoice && isHebrew && consent === 'denied' && (
                  <p role="status" data-testid="privacy-cookie-stopped" style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '8px' }}>המדידה הופסקה בדפדפן הזה. תוכלו לשנות את הבחירה בכל עת.</p>
                )}
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