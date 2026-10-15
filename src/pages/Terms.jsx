import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { goBackOrHome } from '../utils/goBackOrHome';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeoFor } from '../shared/publicSeoRoutes';
import ProFlowLogo from '../components/ProFlowLogo';

export default function Terms({ isHebrew }) {
  const navigate = useNavigate();

  useEffect(() => {
    // ר' הערה מלאה ב-Contact.jsx - /terms הלא-מקודד הוא alias לתאימות
    // בלבד, מופנה מיד (replace) ליעד המקומי שכבר נפתר כשנוחתים עליו ישירות.
    if (window.location.pathname === '/terms') {
      navigate(isHebrew ? '/he/terms' : '/en/terms', { replace: true });
    }

    // One public SEO authority (src/shared/publicSeoRoutes.js), shared with the prerender build (2026-09-28).
    setSeoMeta(publicSeoFor('terms', isHebrew ? 'he' : 'en'));
  }, [isHebrew, navigate]);

  // Task 39: section links (e.g. /he/terms#cancellation from the landing footer / FAQ) land on that section.
  useEffect(() => {
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  // Task 39 (Owner final scope 2026-10-13): original wording from docs/TEKANGO_LEGAL_DOCUMENTS_SPEC_AND_DRAFT_2026-10-13.txt with the
  // Owner's details and the Owner's final refund decision. The purchase / renewal / cancellation / refund terms apply WHEN a subscription is
  // purchased; purchase and payment are not active today (no checkout, no charge) - the page states both facts. HE / EN carry the same
  // obligations; the phone number appears on the Israeli site only. Approved product facts (prices, Free-10 counting rule, catalog
  // expansion) are unchanged.
  const t = isHebrew ? {
    title: 'תנאי שימוש (Terms of Service)',
    lastUpdated: 'עדכון אחרון: 13 באוקטובר 2026',
    back: 'חזור אחורה',
    sections: [
      {
        id: 'operator',
        title: '1. השירות והמפעיל',
        content: [
          'TEKANGO ("השירות") היא מערכת מקוונת לניהול מידע עסקי ולהכנת הצעות מחיר ומסמכים, בהתאם ליכולות הזמינות בה בפועל. יכולת שמוצגת כמתוכננת או כ"עדיין לא פעילה" אינה חלק מהשירות הפעיל עד להפעלתה.',
          'השירות מופעל בידי שלמה סיני, עוסק מס׳ 023716913, רחוב שרה אהרונסון, רמת גן ("המפעיל"). לפניות: support@tekango.com או בטלפון 050-2993806. אין במקום קבלת קהל.',
          'בהרשמה ובשימוש בשירות אתם מסכימים לתנאים אלה. השימוש מיועד למי שמוסמך לפעול בשמו או בשם העסק שעבורו נפתח החשבון.',
        ],
      },
      {
        id: 'account',
        title: '2. חשבון ושימוש מותר',
        content: [
          'יש למסור פרטים נכונים, לשמור על פרטי הגישה ולעדכן אותנו בכל חשד לשימוש לא מורשה. אין להשתמש בשירות כדי לפגוע באחרים, לעבד תוכן בלתי חוקי, לנסות לגשת לחשבונות אחרים או לעקוף מגבלות של השירות.',
          'אתם אחראים להרשאות שנתתם לאנשים מטעמכם; אין בכך כדי לפטור את המפעיל מחובותיו לפי דין. גישה של המפעיל לתוכן של חשבון לצורך תמיכה תיעשה רק לפי צורך מוגדר, בהיקף המינימלי ובלי לפגוע בהפרדה בין חשבונות.',
        ],
      },
      {
        id: 'documents',
        title: '3. מסמכים, מידע ועוזר ה-AI',
        content: 'לפני אישור או שליחה של מסמך, יש לבדוק את פרטי הנמען, הסכומים, המטבע, המסים, התוכן והתנאים. השירות ועוזר ה-AI הם כלים מסייעים ואינם תחליף לייעוץ משפטי, חשבונאי או מיסויי; הצעות ניסוח ותשובות עשויות לדרוש תיקון. אישור וחתימה של לקוח על הצעה מתבצעים במנגנון הדיגיטלי שבשירות, ואין בתנאים אלה התחייבות לסיווג משפטי מסוים של החתימה.',
      },
      {
        // Owner unified instruction 2026-10-07 (4.b.6) + subscriptions cutover (OD-01..OD-08, OD-16) + Task 36 (L2) counting sentence: unchanged facts.
        id: 'plans',
        title: '4. מסלולים ומחירים',
        content: [
          'אחרי 10 ההצעות החינמיות, המנוי הוא מסלול אחד שכולל את כל היכולות הזמינות בשירות, בתשלום חודשי או שנתי מתחדש: 30.00 ₪ לחודש או 306.00 ₪ לשנה. המחירים כוללים מע״מ. סגנונות הצגת ההצעה אינם מסלולים. זכויות קיימות במסלול קודם נשמרות ואינן משתנות אוטומטית.',
          'מסלול חינם כולל 10 הצעות בסך הכול, ללא תפוגה. הצעה נספרת כשהיא יוצאת ללקוח (שליחה, קישור ציבורי, PDF סופי או הדפסה סופית). הפקה חוזרת של אותה גרסה לאותו לקוח, בכל ערוץ, אינה נספרת שוב; שינוי הלקוח, שם הנמען או תוכן ההצעה והפקה מחדש נספרים כהצעה נוספת. טיוטה ותצוגה מקדימה אינן נספרות, מחיקת הצעה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים. כל מסלול בתשלום כולל 100 מוצרי קטלוג, והרחבה של 100 מוצרים נוספים עולה 5.00 ₪ לחודש, רק בבחירה מפורשת.',
          'זמינות כיום: מערכת המסלולים החדשה, רכישת מנוי ותשלום מקוון עדיין אינם פעילים, ולא נגבה תשלום כלשהו דרך השירות. פרסום התנאים שלהלן אינו הפעלה של תשלום.',
        ],
      },
      {
        id: 'purchase',
        title: '5. רכישת מנוי וחידוש',
        content: [
          'התנאים בסעיף זה ובסעיף 6 חלים בעת רכישת מנוי. לפני הרכישה יוצגו הסכום, המטבע, תקופת המנוי (חודשית או שנתית), מועד החיוב ותנאי החידוש, והרכישה תתבצע רק לאחר אישור מפורש שלכם לעסקה. פתיחת חשבון, צפייה במחירים או קבלת תנאים אלה אינן אישור לחיוב.',
          'מנוי חודשי מתחדש בכל חודש ומנוי שנתי מתחדש בכל שנה, לפי ההרשאה שאישרתם, עד לביטולו. התשלום יעובד באמצעות ספק תשלום חיצוני בערוץ התשלום שהשירות יציע, ושם בית העסק שיופיע בחיוב יוצג בעת הרכישה. אישור עסקה או כישלון תשלום יימסרו לכם.',
        ],
      },
      {
        id: 'cancellation',
        title: '6. ביטול מנוי והחזרים',
        content: [
          'אפשר לבקש ביטול מנוי בכל עת במייל אל support@tekango.com (בנושא: "בקשת ביטול מנוי") או בבקשה מתוך חלון המסלולים או ההגדרות במערכת. הבקשה מטופלת בידי הצוות, ואישור יישלח אליכם עם מועד סיום המנוי והפסקת החיובים; זהו אינו ביטול אוטומטי בממשק.',
          'אפשר לבחור באחת משתי דרכים: (א) הפסקת החידוש - המנוי ממשיך עד סוף התקופה ששולמה ולא יחודש לאחריה; (ב) סיום מוקדם - בקשה לסיים את המנוי בהקדם תטופל במועד הנדרש לפי הדין, ויינתן החזר כמפורט להלן.',
          'החזר: בסיום מוקדם של תקופה ששולמה מראש, יוחזר החלק היחסי של התקופה שלא נוצלה, ממועד כניסת הביטול לתוקף, לפי המחיר ששולם בפועל ומספר הימים בתקופה. ההנחה השנתית לא תישלל בדיעבד.',
          'דמי ביטול ייגבו רק כאשר הדין מתיר זאת וכפי שהוצג לפני הרכישה, ולא יעלו על הנמוך מבין 5% ממחיר העסקה או 100 ₪. לא ייגבו דמי ביטול כאשר הדין אוסר זאת (למשל ביטול בשל פגם, אי-התאמה או אי-אספקה), לא ינוכה סכום מעבר ליתרה שמותר לנכות ממנה, ולא תתווסף אוטומטית עמלה של חברת האשראי.',
          'תנאים אלה אינם גורעים מזכויות ביטול, מועדים וסעדים לפי הדין החל עליכם. ביטול מנוי אינו סגירת חשבון ואינו בקשה למחיקת מידע - אלה בקשות נפרדות (ראו מדיניות הפרטיות).',
        ],
      },
      {
        id: 'open',
        title: '7. נושאים שטרם הוחלטו',
        content: 'הנושאים הבאים טרם הוחלטו, ויפורסמו לפני הפעלת המסלולים: מגבלות ההצעות במסלולים בתשלום; קבצים מצורפים; נפח אחסון; מכסות AI; מיסוי מעבר לכלילת המע״מ במחירים בישראל; ומשך שמירת נתונים ומסמכים.',
      },
      {
        id: 'ip',
        title: '8. תוכן וזכויות',
        content: 'הזכויות במערכת, בקוד, בעיצוב ובסימני המסחר שייכות למפעיל או לבעלי הזכויות בהם. אתם שומרים על זכויותיכם בנתוני העסק ובתוכן שאתם מזינים, ומעניקים למפעיל הרשאה מוגבלת לאחסן ולעבד אותם לצורך מתן השירות בלבד, כמתואר במדיניות הפרטיות. אין בהרשאה זו היתר למכור את התוכן העסקי שלכם או להשתמש בו למטרה אחרת.',
      },
      {
        id: 'availability',
        title: '9. זמינות, השעיה וסיום',
        content: 'השירות עשוי להיות מושפע מתחזוקה, מתקלות ומספקים חיצוניים, ואין התחייבות לזמינות רציפה. השעיה בשל הפרה או סיכון תיעשה בהיקף הנדרש ובהודעה ככל שניתן. ניתן לייצא כיום את היסטוריית ההצעות ודוחות ההוצאות לקובצי CSV. אין בתנאים אלה התחייבות לשמירה לצמיתות או למחיקה מיידית מכל מערכת גיבוי.',
      },
      {
        id: 'liability',
        title: '10. אחריות ושינויים',
        content: 'השירות ניתן כפי שהוא, והמפעיל אינו אחראי לנזק עקיף או לאובדן רווחים הנובעים מהשימוש בו, ככל שהדין מתיר זאת. הגבלה זו כפופה לדין ואינה שוללת זכויות או אחריות שאין להתנות עליהן. שינוי מהותי בתנאים או במחיר יימסר מראש בדרך מתאימה ולפי הדין, ולא ישנה בדיעבד חיוב שכבר אושר.',
      },
      {
        id: 'law',
        title: '11. הדין החל וסמכות שיפוט',
        content: 'על תנאים אלה יחולו דיני מדינת ישראל, וסמכות השיפוט תהיה נתונה לבתי המשפט המוסמכים במחוז תל אביב. אין בכך כדי לשלול זכויות מחייבות החלות על משתמשים לפי דין אחר.',
      },
    ],
  } : {
    title: 'Terms of Service',
    lastUpdated: 'Last updated: October 13, 2026',
    back: 'Go Back',
    sections: [
      {
        id: 'operator',
        title: '1. The Service and the Operator',
        content: [
          'TEKANGO ("the Service") is an online system for managing business information and preparing quotes and documents, according to the capabilities actually available in it. A capability shown as planned or "not active yet" is not part of the active Service until it is activated.',
          'The Service is operated by Shlomo Sinai, Israeli business registration (osek) no. 023716913, Sarah Aharonson Street, Ramat Gan, Israel ("the Operator"). Contact: info@tekango.com. The Operator does not receive visitors in person.',
          'By registering and using the Service you agree to these terms. The Service is intended for people authorized to act for themselves or for the business for which the account is opened.',
        ],
      },
      {
        id: 'account',
        title: '2. Account and Permitted Use',
        content: [
          'Provide accurate details, keep your sign-in details safe and tell us about any suspected unauthorized use. Do not use the Service to harm others, to process unlawful content, to try to access other accounts or to circumvent the Service\'s limits.',
          'You are responsible for the permissions you give people acting for you; this does not release the Operator from its obligations under the law. The Operator accesses an account\'s content for support only for a defined need, to the minimum extent and without breaking the separation between accounts.',
        ],
      },
      {
        id: 'documents',
        title: '3. Documents, Information and the AI Assistant',
        content: 'Before you approve or send a document, check the recipient details, amounts, currency, taxes, content and terms. The Service and the AI assistant are helping tools and are not a substitute for legal, accounting or tax advice; suggested wording and answers may need correction. A client\'s approval and signature of a quote use the digital mechanism in the Service, and these terms do not promise any particular legal classification of that signature.',
      },
      {
        // Owner unified instruction 2026-10-07 (4.b.6) + subscriptions cutover (OD-01, OD-02, OD-06..OD-08, OD-16): unchanged facts.
        id: 'plans',
        title: '4. Plans and Prices',
        content: [
          'After the 10 free quotes, the subscription is one package with every capability available in the Service, billed monthly or annually and renewing: 18.00 USD per month or 184.00 USD per year. Billing is always in USD; a price shown in your local currency is only an estimate. Quote presentation styles are not plans. Existing rights on an earlier plan are kept and do not change automatically.',
          'The Free plan includes 10 quotes in total, with no expiry. A quote counts when it reaches a client (sending it, sharing its public link, or producing its final PDF or print). Producing the same version again for the same client, on any channel, does not count again; changing the client, the recipient name or the quote content and producing it again counts as another quote. Drafts and previews do not count, deleting a quote does not give one back, and existing documents stay accessible. Every paid plan includes 100 catalog products, and 100 more products cost 3.00 USD per month, only when you explicitly choose it.',
          'Availability today: the new plan system, subscription purchase and online payment are not active yet, and no payment is collected through the Service. Publishing the terms below does not activate payment.',
        ],
      },
      {
        id: 'purchase',
        title: '5. Buying a Subscription and Renewal',
        content: [
          'This section and section 6 apply when a subscription is purchased. Before the purchase you will see the amount, the currency, the subscription period (monthly or annual), the charge date and the renewal terms, and the purchase happens only after your explicit approval of the transaction. Opening an account, viewing prices or accepting these terms is not an approval to charge you.',
          'A monthly subscription renews every month and an annual subscription renews every year, according to the authorization you approved, until it is cancelled. Payment will be processed by an external payment provider in the payment channel the Service offers, and the merchant name that will appear on the charge is shown at purchase. You will be told when a transaction is approved or a payment fails.',
        ],
      },
      {
        id: 'cancellation',
        title: '6. Cancellation and Refunds',
        content: [
          'You can ask to cancel a subscription at any time by email to info@tekango.com (subject: "Subscription cancellation request") or with a request from the plans window or the settings in the app. Our team handles the request and sends you a confirmation with the date the subscription ends and the charges stop; it is not an automatic cancellation in the app.',
          'You can choose either: (a) stopping the renewal - the subscription continues until the end of the period you paid for and does not renew after it; or (b) early termination - a request to end the subscription as soon as possible is handled within the time required by law, with a refund as described below.',
          'Refund: on early termination of a prepaid period, the proportional part of the unused period, from the date the cancellation takes effect, is refunded according to the price actually paid and the number of days in the period. The annual discount is not clawed back.',
          'A cancellation fee is charged only where the law permits it and as disclosed before the purchase, and it never exceeds the lower of 5% of the transaction price or the fixed cap set by Israeli consumer protection law. No cancellation fee is charged where the law forbids it (for example a cancellation because of a defect, non-conformity or non-supply), nothing is deducted beyond the balance from which a deduction is allowed, and no card-company fee is added automatically.',
          'These terms do not limit the cancellation rights, deadlines and remedies under the law that applies to you. Cancelling a subscription is not closing the account and not a request to delete data - those are separate requests (see the Privacy Policy).',
        ],
      },
      {
        id: 'open',
        title: '7. Matters Not Yet Decided',
        content: 'The following have not been decided yet and will be published before the plans are activated: quote limits of the paid plans; attachments; storage; AI quotas; taxes; and data and document retention periods.',
      },
      {
        id: 'ip',
        title: '8. Content and Rights',
        content: 'The rights in the system, its code, design and trademarks belong to the Operator or to their rights holders. You keep your rights in your business data and the content you enter, and you give the Operator a limited permission to store and process them only to provide the Service, as described in the Privacy Policy. This permission does not allow selling your business content or using it for any other purpose.',
      },
      {
        id: 'availability',
        title: '9. Availability, Suspension and Termination',
        content: 'The Service may be affected by maintenance, faults and external providers, and continuous availability is not promised. A suspension because of a breach or a risk is limited to what is needed and is notified where possible. You can export your quote history and expense reports to CSV files today. These terms do not promise permanent retention or immediate deletion from every backup system.',
      },
      {
        id: 'liability',
        title: '10. Liability and Changes',
        content: 'The Service is provided as is, and the Operator is not liable for indirect damage or loss of profits arising from its use, to the extent the law permits. This limitation is subject to the law and does not exclude rights or liability that cannot be waived. A material change to these terms or to a price is notified in advance in a suitable way and according to the law, and never changes a charge you have already approved.',
      },
      {
        id: 'law',
        title: '11. Governing Law and Jurisdiction',
        content: 'These terms are governed by the laws of the State of Israel, and the competent courts in the Tel Aviv district have jurisdiction. This does not remove mandatory rights that apply to users under another law.',
      },
    ],
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
              <section key={idx} id={sec.id}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#818cf8', marginBottom: '10px' }}>{sec.title}</h2>
                {(Array.isArray(sec.content) ? sec.content : [sec.content]).map((para, i) => <p key={i} style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.7', margin: '0 0 10px' }}>{para}</p>)}
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