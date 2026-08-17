import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Terms({ isHebrew }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = isHebrew ? 'ProFlow - תנאי שימוש' : 'ProFlow - Terms of Service';
  }, [isHebrew]);

  // מילון תרגומים מלא לתנאי השימוש
  const t = isHebrew ? {
    title: 'תנאי שימוש (Terms of Service)',
    lastUpdated: 'עדכון אחרון: אוגוסט 2026',
    back: 'חזור אחורה',
    sections: [
      {
        title: '1. קבלת התנאים',
        content: 'בעצם ההרשמה והשימוש במערכת ProFlow ("השירות"), אתה מסכים להיות כפוף לתנאים אלו. אם אינך מסכים לתנאים, אנא אל תשתמש במערכת.'
      },
      {
        title: '2. תיאור השירות',
        content: 'ProFlow היא פלטפורמת SaaS עננית לניהול עסק, הפקת הצעות מחיר, גבייה, ניהול הוצאות וניהול לקוחות. השירות מסופק למשתמשים במצבו הנוכחי ("As-Is").'
      },
      {
        title: '3. חשבון משתמש ואבטחה',
        content: 'אתה אחראי באופן בלעדי לשמור על סודיות פרטי ההתחברות שלך (אימייל וסיסמה). כל פעולה שתתבצע תחת החשבון שלך היא באחריותך. אנו משתמשים בטכנולוגיות אבטחה והצפנה מתקדמות בענן, אך איננו יכולים להבטיח חסינות מוחלטת מפני פריצות או תקלות רשת.'
      },
      {
        title: '4. מינויים, תשלומים ומדיניות החזרים כספיים (Refunds)',
        content: 'אנו מציעים תקופת ניסיון חינמית (Trial) למשך 14 ימים. לאחר תקופה זו, המשך גישה לתכונות ה-PRO מותנית בתשלום דמי מנוי מחזוריים (חודשיים או שנתיים). מכיוון שמדובר בשירות תוכנה דיגיטלי, לא יינתנו החזרים כספיים על תקופות יחסיות ששולמו. תוכל לבטל את המנוי בכל עת והוא יסתיים בתום תקופת החיוב הנוכחית שלך.'
      },
      {
        title: '5. קניין רוחני',
        content: 'כל הזכויות, הקוד, העיצוב (UI/UX) והקניין הרוחני של המערכת שייכים בלעדית ל-ProFlow. אין להעתיק, לשכפל, להפיץ או להשתמש בתוכן המערכת למטרות מסחריות מתחרות ללא אישור מפורש בכתב.'
      },
      {
        title: '6. הגבלת אחריות',
        content: 'ProFlow, מנהליה ועובדיה לא יישאו באחריות לכל נזק ישיר או עקיף, אובדן נתונים, הפסד הכנסות או עיכוב בפעילות העסקית שייגרם כתוצאה משימוש, אי-יכולת להשתמש במערכת, או תקלות צד שלישי (כגון שרתי הענן).'
      },
      {
        title: '7. הדין החל וסמכות שיפוט',
        content: 'על תנאים אלו יחולו דיני מדינת ישראל. סמכות השיפוט הבלעדית בכל סכסוך הנוגע למערכת תהיה נתונה לבתי המשפט המוסמכים במחוז תל אביב.'
      }
    ]
  } : {
    title: 'Terms of Service',
    lastUpdated: 'Last Updated: August 2026',
    back: 'Go Back',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By registering and using the ProFlow platform ("the Service"), you agree to be bound by these terms. If you do not agree to these terms, please refrain from using the platform.'
      },
      {
        title: '2. Description of Service',
        content: 'ProFlow is a cloud-based SaaS platform designed for business management, price quoting, billing, expense tracking, and CRM. The service is provided on an "As-Is" and "As-Available" basis.'
      },
      {
        title: '3. User Account and Security',
        content: 'You are entirely responsible for maintaining the confidentiality of your login credentials. Any activity occurring under your account is your sole responsibility. While we employ advanced cloud security and encryption technologies, we cannot guarantee absolute immunity from cyber breaches.'
      },
      {
        title: '4. Subscriptions, Payments, and Refund Policy',
        content: 'We offer a 14-day free trial. Following this period, continued access to PRO features requires a paid recurring subscription (monthly or annual). As this is a digital software service, all payments are non-refundable. You may cancel your subscription at any time, and the cancellation will take effect at the end of your current billing cycle.'
      },
      {
        title: '5. Intellectual Property',
        content: 'All rights, code, UI/UX design, and intellectual property associated with the platform belong exclusively to ProFlow. You may not copy, reproduce, distribute, or reverse-engineer the platform for competing commercial purposes without explicit written consent.'
      },
      {
        title: '6. Limitation of Liability',
        content: 'ProFlow, its directors, and employees shall not be liable for any direct, indirect, incidental, or consequential damages, data loss, or loss of revenue resulting from the use or inability to use the platform, including third-party server downtimes.'
      },
      {
        title: '7. Governing Law',
        content: 'These terms shall be governed by the laws of the jurisdiction in which the platform operates. Any legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Tel Aviv, Israel.'
      }
    ]
  };

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: 'Inter, Segoe UI, Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ background: 'rgba(9, 13, 22, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             ProFlow
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
        &copy; {new Date().getFullYear()} ProFlow. {isHebrew ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
      </footer>
    </div>
  );
}