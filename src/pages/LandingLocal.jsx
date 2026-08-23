import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from '../components/ProFlowLogo';
import AIChatWidget from '../AIChatWidget';
import AccessibilityModal from '../components/AccessibilityModal';
import {
  CheckCircle2, XCircle, Flame, Rocket, Star, AlertTriangle,
  Zap, PenTool, BarChart3, ChevronDown, Mail, Wrench, LogIn, KeyRound,
  Gift, Layers, Crown, FileText, Wallet, Users, Lightbulb
} from 'lucide-react';
import { NEON, FONT_HE, loadNeonFonts } from '../theme/neonTheme';

// שם קצר מקומי לתאימות לשאר הקובץ - אותם טוקנים מוגדרים מרכזית ב-neonTheme
// כדי שהעיצוב יישאר מאוחד מול LandingGlobal.jsx ו-Dashboard.jsx.
const NEON_GRADIENT = NEON.gradient;
const NEON_GLOW = NEON.glow;

export default function LandingLocal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  useEffect(() => {
    document.title = "ProFlow - מערכת SaaS לניהול עסק והפקת הצעות מחיר חכמות";

    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', 'ProFlow - מערכת ניהול עסק חכמה: הפקת הצעות מחיר, ניהול לקוחות, חתימה דיגיטלית וחישוב מע"מ אוטומטי לעסקים בישראל.');

    // עצמי: canonical משקף את הנתיב שבו נצפה בפועל (/ או /he) ולא ערך קבוע -
    // אחרת ביקור אמיתי ב-/he היה מוצהר כפיל של השורש הריק ומאבד את הסיכוי
    // להיות מאונדקס בפני עצמו
    let canonicalLink = document.querySelector("link[rel='canonical']");
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = window.location.pathname === '/he'
      ? 'https://www.quotecodepro.com/he'
      : 'https://www.quotecodepro.com/';

    // תואם ל-hreflang שכבר מוצהר ב-sitemap.xml (he -> /he) - קודם הוצמד
    // בטעות לשורש הריק, מה שסתר את המפה ובלבל את האיתות הדו-לשוני ל-Google
    let hreflangHe = document.querySelector("link[hreflang='he']");
    if (!hreflangHe) {
      hreflangHe = document.createElement('link');
      hreflangHe.rel = 'alternate';
      hreflangHe.hreflang = 'he';
      document.head.appendChild(hreflangHe);
    }
    hreflangHe.href = 'https://www.quotecodepro.com/he';

    let hreflangEn = document.querySelector("link[hreflang='en']");
    if (!hreflangEn) {
      hreflangEn = document.createElement('link');
      hreflangEn.rel = 'alternate';
      hreflangEn.hreflang = 'en';
      document.head.appendChild(hreflangEn);
    }
    hreflangEn.href = 'https://www.quotecodepro.com/en';

    loadNeonFonts();
  }, []);

  const getLocalPriceId = (planType) => {
    return billingCycle === 'monthly' ? `price_${planType}_il_monthly` : `price_${planType}_il_yearly`;
  };

  const faqs = [
    {
      q: 'האם המחירים המוצגים כוללים מע"מ?',
      a: 'כן! כל המחירים במסלולים מותאמים לשוק הישראלי וכוללים מע"מ 18% כחוק (עם פירוט הסכום לפני מע"מ).'
    },
    {
      q: 'מה כוללת תקופת הניסיון של 14 יום?',
      a: 'תקופת הניסיון מעניקה לך גישה מלאה וחופשית לכל פיצ\'רי ה-PRO של המערכת (הצעות מחיר ללא הגבלה, שליחת וואטסאפ, צירוף קבצים ושרטוטים ועוד) למשך 14 יום ללא שום התחייבות.'
    },
    {
      q: 'מה קורה בתום 14 ימי הניסיון אם איני רוכש מנוי?',
      a: 'החשבון שלך יעבור אוטומטית למסלול החינמי (FREE) עם המגבלות שלו, כך שתוכל להמשיך להשתמש במערכת בראש שקט.'
    },
    {
      q: 'האם המערכת מותאמת לסמארטפון ולמחשב?',
      a: 'כן, ProFlow פותחה כפלטפורמת SaaS מודרנית רספונסיבית לחלוטין, המאפשרת לך להפיק הצעות ולנהל את העסק מכל מחשב, טאבלט או סמארטפון.'
    },
    {
      q: 'האם הנתונים העסקיים שלי מאובטחים בענן?',
      a: 'בהחלט. אנו משתמשים במסדי נתונים מתקדמים בענן ברמת אבטחה גבוהה ביותר, עם הצפנה מלאה וגיבויים אוטומטיים שמבטיחים שהמידע שלך תמיד שמור.'
    },
    {
      q: 'האם ניתן לייצא את נתוני ההצעות והדוחות לאקסל?',
      a: 'כן, תוכל בכל רגע לייצא את כל היסטוריית הצעות המחיר ודוחות ההוצאות שלך לקובצי CSV המותאמים במיוחד לאקסל ולתוכנות הנהלת חשבונות.'
    }
  ];

  return (
    <div dir="rtl" style={{ fontFamily: FONT_HE, background: NEON.bg, minHeight: '100vh', color: NEON.textPrimary, display: 'flex', flexDirection: 'column', overflowX: 'hidden', letterSpacing: '-0.01em' }}>

      <style>{`
        .hover-card {
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .hover-card:hover {
          transform: translateY(-6px);
          border-color: rgba(167, 139, 250, 0.5);
          box-shadow: 0 24px 40px -14px rgba(139, 92, 246, 0.35);
        }
        .neon-btn {
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .neon-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }
        .ghost-btn {
          transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
        }
        .ghost-btn:hover {
          border-color: rgba(167, 139, 250, 0.6) !important;
          background: rgba(139, 92, 246, 0.08) !important;
        }
        .hero-glow {
          background:
            radial-gradient(circle at 20% 10%, rgba(139, 92, 246, 0.16) 0%, rgba(5, 5, 6, 0) 55%),
            radial-gradient(circle at 80% 15%, rgba(236, 72, 153, 0.12) 0%, rgba(5, 5, 6, 0) 55%);
        }
        .preview-box {
          box-shadow: 0 25px 60px -15px rgba(139, 92, 246, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pain-box {
          box-shadow: 0 20px 40px -15px rgba(239, 68, 68, 0.18);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .faq-item {
          background: #0c0c10;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          margin-bottom: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .faq-item:hover {
          border-color: rgba(167, 139, 250, 0.4);
        }
        .footer-link {
          color: #a1a1aa;
          text-decoration: none;
          transition: color 0.2s;
          font-size: 0.9rem;
          margin: 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .footer-link:hover {
          color: #ffffff;
        }

        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1050px;
          margin: 0 auto;
          padding: 12px 20px;
          width: 100%;
          box-sizing: border-box;
        }

        .desktop-btn-text {
          display: inline;
        }
        .mobile-btn-text {
          display: none;
        }

        @media (max-width: 768px) {
          .header-container {
            display: flex;
            flex-wrap: nowrap !important;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            gap: 0;
          }
          .header-logo {
            order: 1;
            flex-shrink: 0 !important;
          }
          .header-actions {
            order: 2;
            flex-shrink: 0 !important;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .desktop-btn-text {
            display: none;
          }
          .mobile-btn-text {
            display: inline;
          }
          .nav-btn {
            padding: 8px 14px !important;
            font-size: 0.8rem !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .hero-title {
            font-size: 2.2rem !important;
          }
        }
      `}</style>

      {/* Top Banner Launch Special */}
      <div style={{ background: NEON_GRADIENT, color: 'white', padding: '10px 20px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
        <Rocket size={16} strokeWidth={2.5} />
        מבצע! 14 יום חינם לגמרי - עם גישה מלאה לכל הפיצ'רים של מסלול ה-PRO!
      </div>

      {/* Header */}
      <header style={{ background: 'rgba(5, 5, 6, 0.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div className="header-container">

          <div className="header-logo" style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/he')}>
            <ProFlowLogo size={32} rtl={true} />
          </div>

          <div className="header-actions">
            {onForgotPassword && (
              <button onClick={onForgotPassword} style={{ background: 'transparent', color: '#c4b5fd', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <KeyRound size={13} />
                שכחת סיסמה?
              </button>
            )}
            <button className="nav-btn neon-btn" onClick={() => navigate('/dashboard?lang=he')} style={{ background: NEON_GRADIENT, color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', boxShadow: NEON_GLOW, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <LogIn size={15} strokeWidth={2.5} />
              <span className="desktop-btn-text">כניסה למערכת / התחברות</span>
              <span className="mobile-btn-text">כניסה / התחברות</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-glow" style={{ flex: 1, padding: '60px 16px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', textAlign: 'center' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#f0abfc', padding: '8px 20px', borderRadius: '30px', fontSize: '0.9rem', fontWeight: '800', marginBottom: '20px', border: '1px solid rgba(236, 72, 153, 0.35)', boxShadow: '0 0 30px rgba(236, 72, 153, 0.2)' }}>
            <Flame size={16} color="#f97316" fill="#f97316" strokeWidth={1.5} />
            מבצע השקה: 14 יום ניסיון חינם לכל פיצ'רי ה-PRO!
          </div>

          <h1 className="hero-title" style={{ fontSize: '3.2rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', marginBottom: '20px', letterSpacing: '-1.5px' }}>
            ניהול עסק, הפקת הצעות מחיר וגבייה <br />
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>בקלות, במהירות ובחכמה</span>
          </h1>

          <p style={{ fontSize: '1.15rem', color: '#a1a1aa', maxWidth: '750px', margin: '0 auto 25px auto', lineHeight: '1.6' }}>
            פלטפורמת SaaS מתקדמת המותאמת במיוחד לשוק הישראלי (כולל ניהול מע"מ 18% כחוק, מטבע שקלי, חתימות דיגיטליות וניהול לקוחות).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button
              className="neon-btn"
              onClick={() => navigate('/dashboard?signup=true&lang=he')}
              style={{ background: NEON_GRADIENT, color: 'white', border: 'none', padding: '14px 32px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '800', cursor: 'pointer', boxShadow: NEON_GLOW, display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              התחל 14 יום ניסיון חינם ב-PRO עכשיו
              <Rocket size={19} strokeWidth={2.5} />
            </button>
            <span style={{ color: '#34d399', fontSize: '0.95rem', fontWeight: '800' }}>
              14 יום חינם לגמרי לכל פיצ'רי ה-PRO!
            </span>
          </div>

          <div style={{ marginBottom: '50px', color: '#a1a1aa', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} color="#fbbf24" fill="#fbbf24" strokeWidth={1} />)}
            </span>
            מעל 500 עסקים כבר מפיקים הצעות מחיר בקלות
          </div>

          {/* AI Video Demo Showcase */}
          <div style={{ margin: '0 auto 40px auto', maxWidth: '400px' }}>
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', display: 'block' }}
            >
              <source src="/proflow-demo.mp4" type="video/mp4" />
              הדפדפן שלך אינו תומך בהצגת סרטונים.
            </video>
          </div>

          {/* Pain-Point Section with AI Image */}
          <div className="pain-box" style={{ background: '#0c0c10', borderRadius: '16px', overflow: 'hidden', maxWidth: '850px', margin: '0 auto 40px auto', padding: '24px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
                <AlertTriangle size={14} />
                מוכר לך היטב?
              </span>
              <h2 style={{ fontSize: '1.9rem', fontWeight: '900', color: '#ffffff', marginTop: '12px', marginBottom: '8px' }}>
                לא נמאס לך להסתבך עם הצעות מחיר וניירת אינסופית?
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '1rem' }}>
                שכח משעות מול קבצי וורד מסורבלים, חישובי מע"מ ידניים ומרדפים מעייפים אחרי אישורים מלקוחות.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '18px 20px' }}>
                <div style={{ color: '#f87171', fontWeight: '800', fontSize: '0.85rem', marginBottom: '12px' }}>הדרך הישנה</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['שעות מול קבצי וורד מסורבלים', 'חישובי מע"מ ידניים ומייגעים', 'מרדפים אחרי לקוחות לאישור', 'בלגן בניהול הצעות ולקוחות'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4d4d8', fontSize: '0.9rem' }}>
                      <XCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '18px 20px' }}>
                <div style={{ color: '#34d399', fontWeight: '800', fontSize: '0.85rem', marginBottom: '12px' }}>עם ProFlow</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['הצעת מחיר מוכנה ומעוצבת תוך דקה', 'מע"מ 18% מחושב אוטומטית', 'חתימה דיגיטלית ואישור מיידי', 'כל הלקוחות וההצעות במקום אחד'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e4e4e7', fontSize: '0.9rem' }}>
                      <CheckCircle2 size={16} color="#34d399" style={{ flexShrink: 0 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', color: '#c4b5fd', fontWeight: '700', fontSize: '1rem' }}>
              <Lightbulb size={18} color="#f0abfc" fill="#f0abfc" strokeWidth={1} />
              יש דרך הרבה יותר קלה, חכמה ומקצועית לנהל את העסק שלך עם ProFlow!
            </div>
          </div>

          {/* Dashboard Preview Box */}
          <div className="preview-box" style={{ borderRadius: '16px', overflow: 'hidden', background: '#0c0c10', maxWidth: '850px', margin: '0 auto 60px auto', padding: '24px', textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={13} color="#a78bfa" />הצעות מחיר החודש</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>24</div>
              </div>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={13} color="#34d399" />הכנסות (כולל מע"מ 18%)</div>
                <div style={{ color: '#34d399', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>₪ 84,200</div>
              </div>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={13} color="#38bdf8" />לקוחות פעילים</div>
                <div style={{ color: '#818cf8', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>142</div>
              </div>
            </div>
            <div style={{ background: '#131318', padding: '20px', borderRadius: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              כך ייראה דשבורד הניהול של העסק שלך ב-ProFlow
            </div>
          </div>

          {/* Features Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', textAlign: 'right', marginBottom: '60px' }}>
            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(251, 191, 36, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(251, 191, 36, 0.35)' }}>
                <Zap size={28} color="#fbbf24" fill="#fbbf24" strokeWidth={1} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>הפקת הצעות מחיר בדקה</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6' }}>צור הצעות מחיר מקצועיות ומהודרות הכוללות חישוב מע"מ אוטומטי, הנחות ומוצרים מהקטלוג שלך.</p>
            </div>

            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(139, 92, 246, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(139, 92, 246, 0.4)' }}>
                <PenTool size={26} color="#a78bfa" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>חתימה דיגיטלית ואישור לקוח</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6' }}>שלח לינק ללקוח שיוכל לצפות במסמך, לחתום דיגיטלית ולאשר את ההזמנה מכל סמארטפון או מחשב.</p>
            </div>

            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(16, 185, 129, 0.4)' }}>
                <BarChart3 size={26} color="#34d399" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>ניהול הכנסות והוצאות</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6' }}>עקוב אחר רווחי העסק, נהל הוצאות שוטפות וצפה בדוחות פיננסיים מדויקים בזמן אמת.</p>
            </div>
          </div>

          {/* Pricing Section - Israel */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '10px' }}>מסלולים ומחירים</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '25px', fontSize: '1.05rem' }}>בחר את המסלול המתאים ביותר לעסק שלך.</p>

            <div style={{ display: 'inline-flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', background: '#0c0c10', padding: '4px', borderRadius: '12px', marginBottom: '30px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{ background: billingCycle === 'annual' ? NEON_GRADIENT : 'transparent', color: billingCycle === 'annual' ? '#ffffff' : '#a1a1aa', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                <span>מסלול שנתי</span>
                <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>חסוך 20%!</span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{ background: billingCycle === 'monthly' ? NEON_GRADIENT : 'transparent', color: billingCycle === 'monthly' ? '#ffffff' : '#a1a1aa', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                מסלול חודשי
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', textAlign: 'right' }}>

              {/* Free */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#a1a1aa', display: 'inline-flex', width: 'fit-content' }}><Gift size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>מסלול חינמי</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>מתאים לעסקים בתחילת הדרך.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px' }}>0 ₪ <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ חודש</span></div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>סה"כ 0 ₪ לשנה</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />עד 5 הצעות מחיר בחודש</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />ניהול לקוחות בסיסי</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />תמיכה במייל</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא שליחה ישירה בווצאפ</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא צירוף קבצים ושרטוטים להזמנות</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('free')}
                  className="ghost-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=he')}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  התחל בחינם
                </button>
              </div>

              {/* Basic Plan */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#38bdf8', display: 'inline-flex', width: 'fit-content' }}><Layers size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>מסלול בסיסי (Basic)</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>לעסקים קטנים שצריכים פתרון מושלם.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px' }}>
                  {billingCycle === 'monthly' ? '49 ₪' : '39 ₪'} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ חודש</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? 'סה"כ 588 ₪ לשנה' : 'סה"כ 468 ₪ לשנה (בחיוב שנתי)'}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '-12px', marginBottom: '12px' }}>
                  {billingCycle === 'monthly' ? '* כולל מע"מ 18% (41.53 ₪ לפני מע"מ)' : '* חיוב שנתי, כולל מע"מ 18% (33.05 ₪ לפני מע"מ)'}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />עד 20 הצעות מחיר בחודש</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />חתימה דיגיטלית וניהול לקוחות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא שליחה ישירה בווצאפ</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא צירוף קבצים ושרטוטים להזמנות</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('basic')}
                  className="ghost-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=he')}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  בחר מסלול Basic
                </button>
              </div>

              {/* Pro / Business Plan (Highlighted) */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '2px solid #8b5cf6', boxShadow: '0 15px 35px -8px rgba(139, 92, 246, 0.4)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '20px', background: NEON_GRADIENT, color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 14px -2px rgba(236, 72, 153, 0.5)' }}>
                  הפופולרי ביותר
                  <Star size={12} fill="currentColor" strokeWidth={0} />
                </div>
                <div style={{ marginBottom: '10px', color: '#c4b5fd', display: 'inline-flex', width: 'fit-content' }}><Crown size={22} fill="#c4b5fd" strokeWidth={1.5} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>מסלול עסקי (Pro)</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>לסוכנויות ועסקים צומחים ללא מגבלות.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#c4b5fd', marginBottom: '2px' }}>
                  {billingCycle === 'monthly' ? '99 ₪' : '79 ₪'} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ חודש</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? 'סה"כ 1,188 ₪ לשנה' : 'סה"כ 948 ₪ לשנה (בחיוב שנתי)'}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '-12px', marginBottom: '12px' }}>
                  {billingCycle === 'monthly' ? '* כולל מע"מ 18% (83.90 ₪ לפני מע"מ)' : '* חיוב שנתי, כולל מע"מ 18% (66.95 ₪ לפני מע"מ)'}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />הצעות מחיר ללא הגבלה כלל</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />שליחה ישירה בווצאפ (WhatsApp)</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />ניהול הכנסות והוצאות מלא</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />צירוף קבצים ושרטוטים להזמנות (עד 30MB)</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('pro')}
                  className="neon-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=he')}
                  style={{ marginTop: 'auto', background: NEON_GRADIENT, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON_GLOW }}
                >
                  בחר מסלול PRO
                </button>
              </div>

            </div>
          </div>

          {/* FAQ Section */}
          <div style={{ marginBottom: '40px', textAlign: 'right', maxWidth: '800px', margin: '0 auto 40px auto' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px', textAlign: 'center' }}>שאלות נפוצות</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '1rem', textAlign: 'center' }}>כל מה ששאלת על המערכת, במקום אחד.</p>

            <div className="faq-container">
              {faqs.map((faq, idx) => (
                <div key={idx} className="faq-item" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#ffffff', gap: '10px' }}>
                    <span>{faq.q}</span>
                    <ChevronDown size={18} color="#c4b5fd" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </div>
                  {openFaq === idx && (
                    <div style={{ marginTop: '10px', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#000000', color: '#71717a', padding: '40px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => navigate('/terms')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>תנאי שימוש</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/privacy')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>מדיניות פרטיות</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => setAccessibilityOpen(true)} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>נגישות</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/contact')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Mail size={13} />צור קשר (support@quotecodepro.com)</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/tools')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#c4b5fd', fontWeight: 'bold' }}><Wrench size={13} />כלים לעסקים</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} ProFlow Israel. כל הזכויות שמורות.</p>
        </div>
      </footer>

      <AIChatWidget isHebrew={true} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} isHebrew={true} />

    </div>
  );
}
