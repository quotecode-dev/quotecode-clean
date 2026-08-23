import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSeoMeta } from '../utils/seoMeta';

export default function Privacy({ isHebrew }) {
  const navigate = useNavigate();

  useEffect(() => {
    setSeoMeta({
      title: isHebrew ? 'ProFlow - מדיניות פרטיות' : 'ProFlow - Privacy Policy',
      description: isHebrew ? 'מדיניות הפרטיות המלאה של פלטפורמת ProFlow ואופן השימוש בנתוני המשתמשים.' : 'Full Privacy Policy for the ProFlow platform and how user data is handled.',
      canonicalPath: isHebrew ? '/privacy' : '/en/privacy'
    });
  }, [isHebrew]);

  const t = isHebrew ? {
    title: 'מדיניות פרטיות (Privacy Policy)',
    lastUpdated: 'עדכון אחרון: אוגוסט 2026',
    back: 'חזור אחורה',
    sections: [
      {
        title: '1. איסוף מידע',
        content: 'בעת ההרשמה והשימוש במערכת ProFlow, אנו אוספים מידע אישי בסיסי כגון כתובת אימייל ופרטי התחברות. בנוסף, המערכת שומרת את הנתונים שאתה מזין (לקוחות, הצעות מחיר, הוצאות) כדי לספק לך את השירות.'
      },
      {
        title: '2. שימוש במידע',
        content: 'המידע הנאסף משמש אך ורק לצורך תפעול המערכת, יצירת מסמכים עבור העסק שלך, עיבוד תשלומים, מתן תמיכה טכנית ושיפור חוויית המשתמש. אנו לא נעשה שימוש בנתונים העסקיים שלך לשום מטרה אחרת.'
      },
      {
        title: '3. שיתוף מידע עם צד שלישי',
        content: 'אנו מתחייבים לעולם לא למכור, לסחור או להשכיר את המידע שלך לצדדים שלישיים. אנו עשויים לשתף נתונים רק עם ספקי תשתית חיוניים (כגון שרתי Supabase לאחסון נתונים, וספקי סליקה מאובטחים) הפועלים תחת תקני אבטחה מחמירים.'
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
        title: '6. זכויות המשתמש',
        content: 'זכותך המלאה לעיין במידע האישי שלך השמור במערכת, לעדכן אותו, או לבקש את מחיקתו המוחלטת. למחיקת החשבון וכל הנתונים המקושרים אליו, תוכל לפנות אלינו דרך עמוד "צור קשר".'
      }
    ]
  } : {
    title: 'Privacy Policy',
    lastUpdated: 'Last Updated: August 2026',
    back: 'Go Back',
    sections: [
      {
        title: '1. Data Collection',
        content: 'When you register and use the ProFlow platform, we collect basic personal information such as your email address and login details. Additionally, the system stores the business data you input (clients, quotes, expenses) to provide the service.'
      },
      {
        title: '2. Use of Information',
        content: 'The collected data is used exclusively to operate the platform, generate your business documents, process billing, provide technical support, and improve user experience. We will not use your business data for any other purpose.'
      },
      {
        title: '3. Third-Party Sharing',
        content: 'We promise never to sell, trade, or rent your personal information to third parties. We only share data with essential infrastructure providers (such as Supabase for database hosting and secure payment processors) that operate under strict security standards.'
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
        title: '6. User Rights',
        content: 'You have the right to access, update, or request the complete deletion of your personal information stored in our system. To delete your account and all associated data, please reach out to us via the Contact Us page.'
      }
    ]
  };

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: 'Inter, Segoe UI, Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ background: 'rgba(9, 13, 22, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
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
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', marginBottom: '10px' }}>{sec.title}</h2>
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