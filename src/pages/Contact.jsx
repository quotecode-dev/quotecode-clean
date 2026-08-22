import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AIChatWidget from '../AIChatWidget';

export default function Contact({ isHebrew }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = isHebrew ? 'ProFlow - צור קשר ותמיכה' : 'ProFlow - Contact Us & Support';
  }, [isHebrew]);

  const t = isHebrew ? {
    title: 'צור קשר',
    subtitle: 'נשמח לעזור! אנחנו זמינים עבורך לכל שאלה, בקשה או תקלה טכנית.',
    back: 'חזור אחורה',
    emailTitle: 'אימייל לתמיכה',
    emailValue: 'support@quotecodepro.com',
    emailDesc: 'פניות בנושאי שירות לקוחות, תמיכה טכנית ושאלות על המערכת.',
    responseTimeTitle: 'זמני מענה',
    responseTimeValue: 'אנו משתדלים להשיב לכל פנייה בתוך 24 שעות.',
    responseTimeDesc: 'בימי חול (א\'-ה\'). פניות שיישלחו בסוף השבוע ייענו ביום העסקים הבא.',
    aiTitle: 'צ\'אט תמיכה חכם (AI)',
    aiDesc: 'קבל מענה מיידי 24/7 לשאלות נפוצות, תפעול המערכת והדרכות בעזרת עוזר ה-AI שלנו.',
    aiButton: 'התחל צ\'אט ✦',
    footerText: 'ProFlow Israel - פלטפורמת ה-SaaS המתקדמת לניהול עסק.'
  } : {
    title: 'Contact Us',
    subtitle: 'We are here to help! Reach out for any questions, requests, or technical support.',
    back: 'Go Back',
    emailTitle: 'Support Email',
    emailValue: 'support@quotecodepro.com',
    emailDesc: 'For customer service, technical support, and general inquiries.',
    responseTimeTitle: 'Response Time',
    responseTimeValue: 'We aim to respond to all inquiries within 24 hours.',
    responseTimeDesc: 'On business days. Inquiries sent over the weekend will be addressed on the next business day.',
    aiTitle: 'AI Support Chat',
    aiDesc: 'Get instant 24/7 answers to common questions, system operations, and guides using our AI assistant.',
    aiButton: 'Start Chat ✦',
    footerText: 'ProFlow Global - The advanced SaaS platform for business management.'
  };

  const handleAiClick = () => {
    window.dispatchEvent(new CustomEvent('open-proflow-ai-chat'));
  };

  return (
    <div dir={isHebrew ? 'rtl' : 'ltr'} style={{ fontFamily: 'Inter, Segoe UI, Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      
      <style>{`
        .contact-card {
          background: #1f2937;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 30px;
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          height: 100%;
        }
        .contact-card:hover {
          transform: translateY(-5px);
          border-color: #6366f1;
          box-shadow: 0 15px 30px -10px rgba(99, 102, 241, 0.2);
        }
        .contact-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .ai-btn {
          margin-top: auto;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
          width: 100%;
          text-align: center;
          margin-top: 20px;
        }
        .ai-btn:hover {
          opacity: 0.9;
          transform: scale(1.02);
        }
      `}</style>

      {/* Header */}
      <header style={{ background: 'rgba(9, 13, 22, 0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
             </div>
             ProFlow
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <AIChatWidget isHebrew={isHebrew} isDashboard={false} />
            <button 
              onClick={() => navigate(-1)} 
              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.target.style.color = '#ffffff'; e.target.style.borderColor = '#ffffff'; }}
              onMouseLeave={(e) => { e.target.style.color = '#94a3b8'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              {t.back}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '60px 20px' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '900', color: '#ffffff', marginBottom: '16px', letterSpacing: '-0.5px' }}>{t.title}</h1>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>{t.subtitle}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            
            {/* Email Card */}
            <div className="contact-card">
              <div className="contact-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', marginBottom: '10px' }}>{t.emailTitle}</h2>
              <a href={`mailto:${t.emailValue}`} style={{ color: '#3b82f6', fontSize: '1.15rem', fontWeight: 'bold', textDecoration: 'none', marginBottom: '12px', display: 'inline-block' }}>{t.emailValue}</a>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>{t.emailDesc}</p>
            </div>

            {/* Response Time Card */}
            <div className="contact-card">
              <div className="contact-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', marginBottom: '10px' }}>{t.responseTimeTitle}</h2>
              <div style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '12px' }}>{t.responseTimeValue}</div>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>{t.responseTimeDesc}</p>
            </div>

            {/* AI Chat Card */}
            <div className="contact-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, background: '#10b981', color: 'white', padding: '4px 12px', borderBottomLeftRadius: isHebrew ? '0' : '16px', borderBottomRightRadius: isHebrew ? '16px' : '0', fontSize: '0.75rem', fontWeight: 'bold' }}>
                Active 24/7
              </div>
              <div className="contact-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', marginBottom: '10px' }}>{t.aiTitle}</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>{t.aiDesc}</p>
              <button className="ai-btn" onClick={handleAiClick}>{t.aiButton}</button>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        &copy; {new Date().getFullYear()} {t.footerText}
      </footer>
    </div>
  );
}