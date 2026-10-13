import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const t = isHebrew ? {
    title: 'תנאי שימוש (Terms of Service)',
    lastUpdated: 'עדכון אחרון: אוקטובר 2026',
    back: 'חזור אחורה',
    sections: [
      {
        title: '1. קבלת התנאים',
        content: 'בעצם ההרשמה והשימוש במערכת TEKANGO ("השירות"), אתה מסכים להיות כפוף לתנאים אלו. אם אינך מסכים לתנאים, אנא אל תשתמש במערכת.'
      },
      {
        title: '2. תיאור השירות',
        content: 'TEKANGO היא פלטפורמת SaaS עננית לניהול עסק, הפקת הצעות מחיר, גבייה, ניהול הוצאות וניהול לקוחות. השירות מסופק למשתמשים במצבו הנוכחי ("As-Is").'
      },
      {
        title: '3. חשבון משתמש ואבטחה',
        content: 'אתה אחראי באופן בלעדי לשמור על סודיות פרטי ההתחברות שלך (אימייל וסיסמה). כל פעולה שתתבצע תחת החשבון שלך היא באחריותך. אנו משתמשים בטכנולוגיות אבטחה והצפנה מתקדמות בענן, אך איננו יכולים להבטיח חסינות מוחלטת מפני פריצות או תקלות רשת.'
      },
      {
        // Owner unified instruction 2026-10-07 (4.b.6) + subscriptions cutover (OD-01..OD-08, OD-16): approved facts only -
        // canonical plan names, Free-10 rules, the approved IL prices INCLUDING VAT; no payment exists, so no recurring /
        // non-refundable / cancellation promise. Open branches (OPEN-01/02/08/09/10/11/13) are marked "not decided, will be
        // published before activation" - never an invented policy. Legal review pending. Task 36 (L2): the Free-10 counting sentence = the
        // canonical Owner decision 2026-10-11 (version + customer), the same rule as the landing FAQ and the server ledger.
        title: '4. מסלולים ותשלומים',
        content: 'אחרי 10 ההצעות החינמיות, המנוי הוא מסלול אחד שכולל את כל היכולות הזמינות בשירות, בתשלום חודשי או שנתי מתחדש: 30.00 ₪ לחודש או 306.00 ₪ לשנה. סגנונות הצגת ההצעה אינם מסלולים. זכויות קיימות במסלול קודם נשמרות ואינן משתנות אוטומטית. מסלול חינם כולל 10 הצעות בסך הכול, ללא תפוגה. הצעה נספרת כשהיא יוצאת ללקוח (שליחה, קישור ציבורי, PDF סופי או הדפסה סופית). הפקה חוזרת של אותה גרסה לאותו לקוח, בכל ערוץ, אינה נספרת שוב; שינוי הלקוח, שם הנמען או תוכן ההצעה והפקה מחדש נספרים כהצעה נוספת. טיוטה ותצוגה מקדימה אינן נספרות, מחיקת הצעה אינה מחזירה אותה, ומסמכים קיימים נשארים נגישים. כל מסלול בתשלום כולל 100 מוצרי קטלוג, והרחבה של 100 מוצרים נוספים עולה 5.00 ₪ לחודש, רק בבחירה מפורשת. המחירים כוללים מע״מ. מערכת המסלולים החדשה עדיין אינה פעילה: מסלולים בתשלום ותשלום מקוון אינם זמינים כרגע, ולא נגבה תשלום כלשהו דרך השירות. תנאי התשלום, החיוב והביטול של מסלולים בתשלום טרם נקבעו.'
      },
      {
        title: '4א. נושאים שטרם הוחלטו',
        content: 'הנושאים הבאים טרם הוחלטו, ויפורסמו לפני הפעלת המסלולים: מגבלות ההצעות במסלולים בתשלום; קבצים מצורפים; נפח אחסון; מכסות AI; ביטול, החזרים וחיוב יחסי; מיסוי מעבר לכלילת המע״מ במחירים בישראל; ומשך שמירת נתונים ומסמכים.'
      },
      {
        title: '5. קניין רוחני',
        content: 'כל הזכויות, הקוד, העיצוב (UI/UX) והקניין הרוחני של המערכת שייכים בלעדית ל-TEKANGO. אין להעתיק, לשכפל, להפיץ או להשתמש בתוכן המערכת למטרות מסחריות מתחרות ללא אישור מפורש בכתב.'
      },
      {
        title: '6. הגבלת אחריות',
        content: 'TEKANGO, מנהליה ועובדיה לא יישאו באחריות לכל נזק ישיר או עקיף, אובדן נתונים, הפסד הכנסות או עיכוב בפעילות העסקית שייגרם כתוצאה משימוש, אי-יכולת להשתמש במערכת, או תקלות צד שלישי (כגון שרתי הענן).'
      },
      {
        title: '7. הדין החל וסמכות שיפוט',
        content: 'על תנאים אלו יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל סכסוך הנוגע למערכת תהיה נתונה לבתי המשפט המוסמכים במחוז תל אביב.'
      }
    ]
  } : {
    title: 'Terms of Service',
    lastUpdated: 'Last Updated: October 2026',
    back: 'Go Back',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By registering and using the TEKANGO platform ("the Service"), you agree to be bound by these terms. If you do not agree to these terms, please refrain from using the platform.'
      },
      {
        title: '2. Description of Service',
        content: 'TEKANGO is a cloud-based SaaS platform designed for business management, price quoting, billing, expense tracking, and CRM. The service is provided on an "As-Is" and "As-Available" basis.'
      },
      {
        title: '3. User Account and Security',
        content: 'You are entirely responsible for maintaining the confidentiality of your login credentials. Any activity occurring under your account is your sole responsibility. While we employ advanced cloud security and encryption technologies, we cannot guarantee absolute immunity from cyber breaches.'
      },
      {
        // Owner unified instruction 2026-10-07 (4.b.6) + subscriptions cutover (OD-01, OD-02, OD-06..OD-08, OD-16): approved
        // International facts only - USD catalog prices, billing always in USD, a local-currency figure is only an estimate; no
        // shekel price on the English page (OD-11). Open branches are marked "not decided". Legal review pending.
        title: '4. Plans and Payments',
        content: 'After the 10 free quotes, the subscription is one package with every capability available in the service, billed monthly or annually and renewing: 18.00 USD per month or 184.00 USD per year. Quote presentation styles are not plans. Existing rights on an earlier plan are kept and do not change automatically. The Free plan includes 10 quotes in total, with no expiry. A quote counts when it reaches a client (sending it, sharing its public link, or producing its final PDF or print). Producing the same version again for the same client, on any channel, does not count again; changing the client, the recipient name or the quote content and producing it again counts as another quote. Drafts and previews do not count, deleting a quote does not give one back, and existing documents stay accessible. Every paid plan includes 100 catalog products, and 100 more products cost 3.00 USD per month, only when you explicitly choose it. Billing is always in USD; a price shown in your local currency is only an estimate. The new plan system is not active yet: Paid plans and online payment are not currently available, and no payment is collected through the service. Payment, billing and cancellation terms for paid plans have not been decided yet.'
      },
      {
        title: '4a. Matters Not Yet Decided',
        content: 'The following have not been decided yet and will be published before the plans are activated: quote limits of the paid plans; attachments; storage; AI quotas; cancellation, refunds and proration; taxes; and data and document retention periods.'
      },
      {
        title: '5. Intellectual Property',
        content: 'All rights, code, UI/UX design, and intellectual property associated with the platform belong exclusively to TEKANGO. You may not copy, reproduce, distribute, or reverse-engineer the platform for competing commercial purposes without explicit written consent.'
      },
      {
        title: '6. Limitation of Liability',
        content: 'TEKANGO, its directors, and employees shall not be liable for any direct, indirect, incidental, or consequential damages, data loss, or loss of revenue resulting from the use or inability to use the platform, including third-party server downtimes.'
      },
      {
        title: '7. Governing Law',
        content: 'These terms shall be governed by the laws of the jurisdiction in which the platform operates. Any legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Tel Aviv, Israel.'
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
            onClick={() => navigate(-1)} 
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
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#818cf8', marginBottom: '10px' }}>{sec.title}</h2>
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