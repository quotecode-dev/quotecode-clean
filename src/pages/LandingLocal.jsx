import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from '../components/ProFlowLogo';
import BrandName from '../components/BrandName';
import AIChatWidget from '../AIChatWidget';
import AccessibilityModal from '../components/AccessibilityModal';
import {
  CheckCircle2, XCircle, Star, AlertTriangle,
  Zap, PenTool, BarChart3, ChevronDown, Mail, LogIn, KeyRound,
  Gift, Layers, Crown, FileText, Wallet, Users, Lightbulb, Ruler,
  FilePlus2, Send, ShieldCheck, PlayCircle, ArrowUpRight, BriefcaseBusiness
} from 'lucide-react';
import { NEON, FONT_HE } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { getPlanPricingDisplay, getVatBreakdown, getStripePriceId } from '../utils/pricingCatalog';
import { VIDEOS_READY } from './landingVideoConfig';

// שם קצר מקומי לתאימות לשאר הקובץ - אותם טוקנים מוגדרים מרכזית ב-neonTheme
// כדי שהעיצוב יישאר מאוחד מול LandingGlobal.jsx ו-Dashboard.jsx.
const NEON_GRADIENT = NEON.gradient;
const NEON_GLOW = NEON.glow;

export default function LandingLocal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  // חוק ברזל (§B - billing-ready pricing foundation): נגזר ממקור-אמת קנוני
  // אחד (pricingCatalog.js), לא ממחרוזות/חשבון-נפרד כאן - זהה ל-LandingGlobal.jsx.
  const basicPricing = getPlanPricingDisplay('il', 'basic', billingCycle);
  const proPricing = getPlanPricingDisplay('il', 'pro', billingCycle);
  const basicVat = getVatBreakdown(basicPricing.monthlyRate);
  const proVat = getVatBreakdown(proPricing.monthlyRate);
  const [openFaq, setOpenFaq] = useState(null);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  // VIDEOS_READY הוא שער-תכונה מפורש וציבורי למקטע הסרטון המאושר (סרטון
  // עברי שלם אחד, שאושר סופית ע"י הבעלים), מיובא ממודול משותף אחד יחד עם
  // LandingGlobal.jsx כדי ששתי השפות לעולם לא יסטו למצב-שחרור שונה. כשהוא
  // false (ברירת המחדל) המקטע כולו לא מרונדר בכלל (לא null-אחרי-טעינה, לא
  // מלבן-כהה-ריק) - הוא הופך ל-true רק באישור נפרד ומפורש של הבעלים.
  // Final Landing Polish task, Part C: "provide a safe TEST/local preview
  // mechanism... that does not expose unfinished videos in normal
  // rendering." VIDEOS_READY itself stays false (the real public gate,
  // untouched) - this is a query-param-only escape hatch (?previewVideos=1)
  // used only to QA/demo the real assets locally before Owner approval.
  const [previewVideos] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('previewVideos') === '1'; } catch { return false; }
  });
  const showVideosSection = VIDEOS_READY || previewVideos;

  useEffect(() => {
    // כלל קנוני סופי (חוק ברזל, ר' PROFLOW_HANDOFF.md §16): רק ?lang=
    // מפורש רשאי להזיז את הקנוני של "/" הריק/עם query ליעד שפה ספציפי.
    // geo/localStorage/navigator.language עשויים לקבוע איזה באנדל מוצג
    // בפועל ב-"/" הריק עבור בן-אדם, אבל לעולם לא ישפיעו על הקנוני שלו -
    // "/" הריק ללא ?lang= תמיד קנוני לעצמו ("/"), גם כשעברית מוצגת בו.
    // אם LandingLocal בכלל רונדר עם ?lang=he/en מפורש ותקין, זה כבר אומר
    // ש-main.jsx בחר עברית בגלל אותו ?lang - הקנוני העצמי /he תואם בדיוק
    // לשפה שבאמת הוצגה. ערך ?lang= לא תקין (כל דבר חוץ מ-he/en - main.jsx
    // עצמו לא מכיר בו) לא נחשב override מפורש ונופל לכלל pathname הרגיל.
    const langParam = new URLSearchParams(window.location.search).get('lang');
    const explicitLang = langParam === 'he' || langParam === 'en' ? langParam : null;
    const canonicalPath = explicitLang
      ? '/he'
      : window.location.pathname === '/he'
      ? '/he'
      : '/';

    // חוק ברזל (§13 - Locale metadata correction): lang:'he' חדש (מתקן
    // <html lang="en" dir="ltr"> הקבוע שמעולם לא התעדכן, ר' seoMeta.js).
    // updateSocial:false הוסר בכוונה - זה בדיוק ה"שלב עתידי" שההערה הישנה
    // התייחסה אליו; og:*/twitter:*/og:locale מתעדכנים עכשיו נכון לעברית.
    // structuredData: עוקף את ה-JSON-LD הסטטי (SoftwareApplication,
    // priceCurrency:"USD") שירש לדף הזה תמיד - כאן ILS, כולל מע"מ.
    setSeoMeta({
      title: "TEKANGO - מערכת SaaS לניהול עסק והפקת הצעות מחיר חכמות",
      description: 'TEKANGO - מערכת ניהול עסק חכמה: הפקת הצעות מחיר, ניהול לקוחות, חתימה דיגיטלית וחישוב מע"מ אוטומטי לעסקים בישראל.',
      canonicalPath,
      lang: 'he',
      hreflang: [
        { lang: 'he', path: '/he' },
        { lang: 'en', path: '/en' },
        { lang: 'x-default', path: '/' },
      ],
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'TEKANGO',
        operatingSystem: 'All',
        applicationCategory: 'BusinessApplication',
        inLanguage: 'he',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'ILS' },
        description: 'מערכת ניהול עסק חכמה להפקת הצעות מחיר, ניהול לקוחות וחישוב מע"מ אוטומטי לעסקים בישראל.',
      },
    });
  }, []);

  const getLocalPriceId = (planType) => getStripePriceId(planType, 'il', billingCycle);

  const faqs = [
    {
      q: 'האם המחירים המוצגים כוללים מע"מ?',
      a: 'כן! כל המחירים במסלולים מותאמים לשוק הישראלי וכוללים מע"מ 18% כחוק (עם פירוט הסכום לפני מע"מ).'
    },
    {
      // Root-cause fix (Final Landing Polish task, Part A): two overlapping
      // trial FAQ items ("what does the trial include" / "what happens when
      // it ends") each independently repeated the trial duration - combined
      // into one question/answer with a single duration mention, per the
      // task's 3-location trial-message budget (hero / pricing / FAQ).
      q: 'מה כוללת תקופת הניסיון החינמית, ומה קורה בסיומה?',
      a: 'לאורך 14 יום מקבלים גישה מלאה וחופשית לכל פיצ\'רי ה-PRO (הצעות מחיר ללא הגבלה, שליחת וואטסאפ, צירוף קבצים ושרטוטים ועוד), ללא שום התחייבות. אם לא רוכשים מנוי בתום התקופה, החשבון עובר אוטומטית למסלול החינמי (FREE) עם המגבלות שלו, כך שאפשר להמשיך להשתמש במערכת בראש שקט.'
    },
    {
      q: 'האם המערכת מותאמת לסמארטפון ולמחשב?',
      a: <>כן, <BrandName /> פותחה כפלטפורמת SaaS מודרנית רספונסיבית לחלוטין, המאפשרת לך להפיק הצעות ולנהל את העסק מכל מחשב, טאבלט או סמארטפון.</>
    },
    {
      // חוק ברזל (§9 - FAQ, security and trust language): "רמת אבטחה גבוהה
      // ביותר"/"הצפנה מלאה"/"גיבויים אוטומטיים" הוחלפו בניסוח מדויק וניתן-
      // לאימות - Supabase/PostgreSQL מספקים הצפנה בתעבורה (TLS) ובאחסון
      // כברירת-מחדל של התשתית, זו עובדה שניתן לאמת מול ספק התשתית עצמו;
      // "רמת האבטחה הגבוהה ביותר" ו"גיבויים אוטומטיים" (שלא אומתה תצורתם
      // הספציפית בפרויקט הזה) הוסרו מהתשובה ולא הוחלפו בטענה לא-מאומתת אחרת.
      q: 'האם הנתונים העסקיים שלי מאובטחים בענן?',
      a: 'הנתונים שלך מאוחסנים בתשתית ענן מבוססת Supabase/PostgreSQL, הכוללת הצפנה בתעבורה (TLS) ובאחסון כחלק מתשתית הענן הסטנדרטית. הגישה לנתונים מוגבלת לחשבון שלך בלבד.'
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

      {/* Root-cause fix (Final Landing Polish task, Part A - "de-duplicate the
          14-day trial message"): this top banner repeated the exact same
          trial claim as the hero badge/CTA/helper line below it - removed
          entirely rather than trimmed, since the hero helper line (below)
          was chosen as the single hero-section occurrence. */}

      {/* Header */}
      <header style={{ background: 'rgba(5, 5, 6, 0.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div className="header-container">

          <div className="header-logo" style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/he')}>
            <ProFlowLogo size={32} rtl={true} />
          </div>

          {/* חוק ברזל (Two-Stage Completion Task, Stage 2A - "compact
              navigation with one dominant trial CTA"): לפני התיקון, הפעולה
              היחידה בסרגל הייתה "כניסה למערכת" (מיועדת למשתמש קיים) בעיצוב
              ה-primary היחיד - למבקר חדש (הרוב המכריע בדף שיווקי) לא היה
              CTA דומיננטי בסרגל בכלל. עכשיו "התחל ניסיון חינם" הוא ה-CTA
              היחיד בעיצוב-primary (גרדיאנט) בסרגל; "כניסה" יורד לקישור-
              משני קטן וברור לצדו - עדיין נגיש-מיידית, לא נעלם. */}
          <div className="header-actions">
            {onForgotPassword && (
              <button onClick={onForgotPassword} style={{ background: 'transparent', color: '#c4b5fd', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', marginLeft: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <KeyRound size={13} />
                שכחת סיסמה?
              </button>
            )}
            <button onClick={() => navigate('/dashboard?lang=he')} style={{ background: 'transparent', color: '#d4d4d8', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 4px' }}>
              <LogIn size={14} strokeWidth={2.5} />
              <span className="desktop-btn-text">כניסה למערכת</span>
              <span className="mobile-btn-text">כניסה</span>
            </button>
            <button className="nav-btn neon-btn" onClick={() => navigate('/dashboard?signup=true&lang=he')} style={{ background: NEON_GRADIENT, color: 'white', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', boxShadow: NEON_GLOW, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpRight size={15} strokeWidth={2.5} />
              <span className="desktop-btn-text">התחל ניסיון חינם</span>
              <span className="mobile-btn-text">נסה חינם</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-glow" style={{ flex: 1, padding: '60px 16px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', textAlign: 'center' }}>

          {/* Root-cause fix (Part A): this badge duplicated the same "14-day
              trial" claim as the CTA button and the helper line right below
              it. Removed rather than trimmed - the helper line below is the
              single hero-section trial occurrence per the task's 3-location
              budget (hero / pricing / FAQ). */}

          {/* חוק ברזל (§5 - Confirmed copy decisions): "גבייה" הוסרה מהכותרת -
              יכולת גבייה/תשלומים אמיתית אינה קיימת במוצר (אין אינטגרציית
              Stripe פעילה, ר' billing-checkout-stub - שלד בלבד, לא מבצע
              חיוב). הכותרת עכשיו מתארת רק יכולות שאומתו בפועל בקוד: הפקת
              הצעות מחיר חכמות + ניהול עסק. */}
          <h1 className="hero-title" style={{ fontSize: '3.2rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.2', marginBottom: '20px', letterSpacing: '-1.5px' }}>
            הצעות מחיר חכמות וניהול העסק <br />
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>בקלות, במהירות ובמקצועיות</span>
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
              התחל ניסיון חינם
              <ArrowUpRight size={19} strokeWidth={2.5} />
            </button>
            <span style={{ color: '#34d399', fontSize: '0.95rem', fontWeight: '800' }}>
              14 יום ניסיון PRO מלא, ללא כרטיס אשראי
            </span>
          </div>

          {/* חוק ברזל (§5 - Confirmed copy decisions): "מעל 500 עסקים" הוסר -
              אין נתון-אמת מאומת התומך בטענה הזו (לא מספר-לקוחות אמיתי
              שאומת). לא הוחלף במספר-בדוי אחר - שורת-האמון הוסרה כליל, לא
              "תוקנה" למספר קטן יותר שגם הוא לא מאומת. */}

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

            {/* Root-cause fix (Stage 2D): 240px was right at the edge of a
                320px viewport's available width (measured sw:240 vs cw:238)
                - narrowed the minimum to keep a safe margin at the smallest
                supported width instead of relying on the parent's
                overflow:hidden to silently clip it. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
                <div style={{ color: '#34d399', fontWeight: '800', fontSize: '0.85rem', marginBottom: '12px' }}>עם <BrandName /></div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', color: '#e4e4e7', fontWeight: '700', fontSize: '1rem' }}>
              <Lightbulb size={18} color="#f0abfc" fill="#f0abfc" strokeWidth={1} />
              <span>יש דרך הרבה יותר קלה, חכמה ומקצועית לנהל את העסק שלך עם <BrandName />!</span>
            </div>
          </div>

          {/* חוק ברזל (§5 - "Do not present illustrative dashboard values as
              genuine business traction"): תג "לדוגמה בלבד" חדש, גלוי וברור,
              נוסף לתיבה - הנתונים המוצגים (24/₪84,200/142) נשארים דוגמה
              מדגימה, לא שונו לנתונים אמיתיים (אין דרך "לאמת" נתון-לקוח בודד
              כ"אמיתי" בדף שיווקי בלי לחשוף נתוני-לקוח אמיתיים) - הפתרון
              הנדרש הוא תיוג חד-משמעי כדוגמה, לא הסתרת המספרים. */}
          <div className="preview-box" style={{ borderRadius: '16px', overflow: 'hidden', background: '#0c0c10', maxWidth: '850px', margin: '0 auto 60px auto', padding: '24px', textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></div>
              </div>
              <span style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: '0.72rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>לדוגמה בלבד</span>
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
              כך ייראה דשבורד הניהול של העסק שלך ב-<BrandName />
            </div>
          </div>

          {/* חוק ברזל (Two-Stage Completion Task, Stage 2A - "Three-step
              explanation: Create → Send → Approve & Sign"): מקטע חדש
              לגמרי - לא היה קיים קודם בדף. שלושת השלבים ממופים ישירות
              ליכולות שכבר קיימות ואומתו בקוד (Smart Quote wizard,
              שליחה/לינק-ציבורי, useSignaturePad+public_approve_quote) -
              לא תיאור-שיווקי גנרי. */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>איך זה עובד?</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '30px', fontSize: '1.05rem' }}>משלוש דקות עד הצעה חתומה.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', textAlign: 'center' }}>
              {[
                { icon: <FilePlus2 size={26} color="#a78bfa" strokeWidth={2} />, glow: 'rgba(139, 92, 246, 0.4)', bg: 'rgba(139, 92, 246, 0.12)', n: '1', title: 'יצירה', desc: 'בונים הצעה מודרכת - פריט רגיל, לפי מידות או מהקטלוג. החישוב והמע"מ מתעדכנים תוך כדי הקלדה.' },
                { icon: <Send size={24} color="#38bdf8" strokeWidth={2.2} />, glow: 'rgba(56, 189, 248, 0.4)', bg: 'rgba(56, 189, 248, 0.12)', n: '2', title: 'שליחה', desc: 'שולחים ללקוח לינק אישי לצפייה בהצעה המעוצבת, מכל מכשיר - בלי הדפסה, בלי מייל כבד.' },
                { icon: <ShieldCheck size={24} color="#34d399" strokeWidth={2.2} />, glow: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.12)', n: '3', title: 'אישור וחתימה', desc: 'הלקוח מאשר וחותם דיגיטלית ישירות מהטלפון - ואתם מקבלים עדכון מיידי.' },
              ].map((step) => (
                <div key={step.n} style={{ position: 'relative', background: '#0c0c10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '30px 22px 24px' }}>
                  <div style={{ position: 'absolute', top: '14px', insetInlineEnd: '18px', fontSize: '0.72rem', fontWeight: '800', color: 'rgba(255,255,255,0.25)' }}>{step.n}</div>
                  <div style={{ margin: '0 auto 16px', background: step.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: `0 0 24px -6px ${step.glow}` }}>
                    {step.icon}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>{step.title}</h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* This section shows ONE complete, Owner-approved Hebrew commercial
              film (problem -> product -> real workflow -> customer approval ->
              result -> CTA), replacing an earlier four-teaser format the Owner
              found unclear. The four original teaser files were removed from
              disk with explicit Owner authorization after a privacy review
              found unreferenced/unsafe content in them (Final Landing
              Pre-Release Fixes task) - there is nothing left to preserve.
              Gate: VIDEOS_READY controls public visibility; showVideosSection
              ORs in the query-param-only local preview override
              (?previewVideos=1) for pre-release QA. No autoplay; poster +
              click-to-play only. */}
          {showVideosSection && (
            <div style={{ marginBottom: '60px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
                <PlayCircle size={22} style={{ verticalAlign: '-3px', marginInlineEnd: '8px' }} aria-hidden="true" color="#c4b5fd" />
                ראו את זה בפעולה
              </h2>
              <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '0.95rem' }}>מבקשה של לקוח ועד הצעה חתומה - סרטון קצר אחד, על נתוני הדגמה בלבד.</p>
              <div style={{ maxWidth: '860px', margin: '0 auto', background: '#0c0c10', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <video
                  controls
                  preload="none"
                  poster="/videos/proflow-he-commercial-poster.jpg"
                  aria-label="TEKANGO - מהצעת מחיר ועד אישור וחתימה"
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000' }}
                  onEnded={(e) => { e.currentTarget.currentTime = 0; }}
                >
                  <source src="/videos/proflow-he-commercial.mp4" type="video/mp4" />
                  {/* Hebrew Commercial Correction task - Correction 4: captions are already
                      burned into the video; `default` here would make the browser's native
                      VTT renderer show a second, overlapping copy on top of them. The track
                      stays present and selectable via the player's own captions menu. */}
                  <track kind="captions" src="/videos/proflow-he-commercial.vtt" srcLang="he" label="כתוביות" />
                </video>
                <div style={{ padding: '18px 20px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#ffffff', margin: '0 0 4px', fontWeight: '700' }}>מהצעת מחיר ועד אישור וחתימה</h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: 0 }}>איך <BrandName /> הופך בקשת לקוח להצעה מקצועית, שנשלחת, מאושרת ונחתמת - ישירות מהטלפון.</p>
                </div>
              </div>
            </div>
          )}

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

            {/* חוק ברזל (§C - Professional/trade capability messaging,
                PROFLOW_TODO.md #44/#52, Owner-authorized this task):
                מבוסס על יכולת אמיתית ומאומתת בקוד (QuoteForm.jsx -
                calculated_quantity/calculated_area, method='area'|'linear',
                מספר שורות-מדידה לכל פריט) - לא תיאור ספציפי-אלומיניום (ר'
                דרישת הבעלים המפורשת "Must be generic, not aluminum-
                specific"). תרגום Feature→Benefit→Outcome: מדידות מובנות →
                פחות חישוב ידני/טעויות → הצעות מדויקות ומהירות יותר על
                עבודות חוזרות. לא מוזכר שיוך-מסלול כאן בכוונה (professionalQuotes
                זמין ב-Basic+Pro, לא Free-כלל ולא PRO-בלעדי - פירוט המסלולים
                כבר קיים בכרטיסי המחיר עצמם למטה, לא כפול כאן). */}
            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(56, 189, 248, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(56, 189, 248, 0.4)' }}>
                <Ruler size={26} color="#38bdf8" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>הצעות מחיר מקצועיות עם מדידות ומפרט</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6' }}>בנה הצעה לפי מידות אמיתיות (שטח או אורך), עם כמה שורות-מדידה לכל פריט וחישוב כמות אוטומטי - מתאים לעבודות זכוכית ואלומיניום, ריצוף, חשמל, אינסטלציה ותחומי עבודה נוספים. פחות חישובים ידניים וטעויות, הצעות מדויקות יותר וחיסכון בזמן על הצעות חוזרות.</p>
            </div>
          </div>

          {/* Pricing Section - Israel */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '10px' }}>מסלולים ומחירים</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '10px', fontSize: '1.05rem' }}>בחר את המסלול המתאים ביותר לעסק שלך.</p>
            {/* חוק ברזל (§8 - Signup and pricing CTA correction): אין כרגע
                מנגנון-חיוב/בחירת-מסלול אמיתי (Stripe אינו מחובר -
                billing-checkout-stub הוא שלד בלבד, לא מבצע חיוב) - כל
                הרשמה חדשה יוצרת בפועל את אותו חשבון-ניסיון PRO מלא, ללא
                תלות בכרטיס שנלחץ. במקום לבנות מנגנון-בחירה שלא קיים,
                המשפט הבא הופך את זה לשקוף וכן ללקוח, בדיוק כהנחיית המשימה
                "make every CTA communicate that honestly". */}
            {/* חוק ברזל (§C - ניסוח תשלום שלאחר-ניסיון): לא ממציא תהליך
                מסחרי (לא "נחייב אוטומטית", לא "הצוות ייצור קשר") - רק עובדות
                אמיתיות היום: הרשמה מתחילה ניסיון, בחירת מסלול/מחזור לא
                מחייבת בהרשמה, השלמת תשלום היא צעד נפרד מאוחר יותר (ללא
                פירוט מנגנון, שאינו קיים עדיין - ר' הדוח הסופי). */}
            <p style={{ color: '#c4b5fd', marginBottom: '25px', fontSize: '0.85rem', fontWeight: '600' }}>כל הרשמה חדשה מתחילה בניסיון PRO מלא ל-14 יום, ללא תלות במסלול שבחרת להציג - בסיום התקופה תוכל/י להמשיך במסלול המתאים לך. בחירת מסלול/מחזור תשלום כאן אינה מבצעת שום חיוב בהרשמה - זו העדפה בלבד שתילקח בחשבון בהמשך; השלמת תשלום בפועל היא צעד נפרד ומאוחר יותר.</p>

            {/* Root-cause fix (Two-Stage Completion Task, Stage 2D): found via
                live 320/360px measurement that this row bled off both edges
                (rect.x:-35, width:339 vs a 288px-wide container) because
                flexWrap was pinned to 'nowrap' while its two buttons (one
                carrying a discount badge) together need ~330px. LandingGlobal's
                English mirror already uses flex-wrap:wrap for this same
                toggle - bringing Hebrew in line with it. */}
            <div style={{ display: 'inline-flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', background: '#0c0c10', padding: '4px', borderRadius: '12px', marginBottom: '30px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{ background: billingCycle === 'annual' ? NEON_GRADIENT : 'transparent', color: billingCycle === 'annual' ? '#ffffff' : '#a1a1aa', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                <span>מסלול שנתי</span>
                {/* חוק ברזל (§B - Proportional Workspace Correction task):
                    תג משותף אחד שחל בו-זמנית על BASIC ו-PRO - אחוז החיסכון
                    האמיתי (pricingCatalog.js) שונה מעט בין השניים (~20.4%
                    מול ~20.2% ב-ILS) ומשמעותית בין מטבעות בדף הבינלאומי -
                    תג משותף לא יכול להציג מספר מדויק אחד שנכון לשניהם, אז
                    זה נשאר ניסוח לא-מספרי כן; האחוז המדויק בפועל מוצג בכל
                    כרטיס-מסלול בנפרד למטה (מ-basicPricing/proPricing.savingsPercent). */}
                <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>חסוך במעבר לשנתי!</span>
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
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא שליחה ישירה בווצאפ, ללא מחיקת הצעות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא צירוף קבצים ושרטוטים להזמנות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא עריכה/שכפול של הצעה שמורה</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('free')}
                  className="ghost-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=he&intendedPlan=free&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  התחל ניסיון חינם
                </button>
              </div>

              {/* Basic Plan */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#38bdf8', display: 'inline-flex', width: 'fit-content' }}><Layers size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>מסלול בסיסי (Basic)</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>לעסקים קטנים שצריכים פתרון מושלם.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  {basicPricing.monthlyRate} ₪ <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ חודש</span>
                  {/* חוק ברזל (§B): אחוז מדויק לכרטיס הזה בלבד, מחושב מ-
                      pricingCatalog.js (basicPricing.savingsPercent) - לא
                      מספר קבוע/מומצא. */}
                  {billingCycle === 'annual' && (
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>חיסכון {basicPricing.savingsPercent}%</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `סה"כ ${basicPricing.annualTotal.toLocaleString('he-IL')} ₪ לשנה` : `סה"כ ${basicPricing.annualTotal.toLocaleString('he-IL')} ₪ לשנה (בחיוב שנתי)`}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '-12px', marginBottom: '12px' }}>
                  {billingCycle === 'monthly' ? `* כולל מע"מ 18% (${basicVat.beforeVat.toFixed(2)} ₪ לפני מע"מ)` : `* חיוב שנתי, כולל מע"מ 18% (${basicVat.beforeVat.toFixed(2)} ₪ לפני מע"מ)`}
                </p>
                {/* חוק ברזל (§4 - capability matrix, מאומת בקוד):
                    professionalQuotes=true כבר ב-BASIC (planCatalog.js) -
                    לא היה מוזכר כלל קודם בעמוד הזה. editDuplicate=true גם
                    ב-BASIC (עריכה/שכפול הצעות שמורות). whatsappDelete
                    (שליחת-וואטסאפ + מחיקת-הצעה, שני מסלולים תחת דגל אחד
                    בקוד) ו-attachments נשארים false ל-BASIC - נכון כפי שהיה. */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />עד 20 הצעות מחיר בחודש</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />חתימה דיגיטלית וניהול לקוחות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />עריכה ושכפול של הצעות שמורות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />הצעות מחיר חכמות עם מפרט מקצועי ומידות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא שליחה ישירה בווצאפ, ללא מחיקת הצעות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />ללא צירוף קבצים ושרטוטים להזמנות</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('basic')}
                  className="ghost-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=he&intendedPlan=basic&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  התחל ניסיון חינם
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
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#c4b5fd', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  {proPricing.monthlyRate} ₪ <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ חודש</span>
                  {billingCycle === 'annual' && (
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>חיסכון {proPricing.savingsPercent}%</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `סה"כ ${proPricing.annualTotal.toLocaleString('he-IL')} ₪ לשנה` : `סה"כ ${proPricing.annualTotal.toLocaleString('he-IL')} ₪ לשנה (בחיוב שנתי)`}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '-12px', marginBottom: '12px' }}>
                  {billingCycle === 'monthly' ? `* כולל מע"מ 18% (${proVat.beforeVat.toFixed(2)} ₪ לפני מע"מ)` : `* חיוב שנתי, כולל מע"מ 18% (${proVat.beforeVat.toFixed(2)} ₪ לפני מע"מ)`}
                </p>
                {/* חוק ברזל (§4 - capability matrix, real defect found and
                    fixed): "ניהול הכנסות והוצאות מלא" הוצג קודם כאילו הוא
                    בלעדי ל-PRO - אומת בקוד (Dashboard.jsx) שאין שום שער-
                    זכאות סביב Finances/Clients/Catalog/CSV/AI Chat כלל -
                    הם זמינים בכל מסלול, כולל FREE. הוחלף בשתי יכולות
                    שאומתו כבלעדיות-PRO אמיתיות בקוד: professionalQuoteReuse
                    (שכפול פריטים מקצועיים) ו-editDuplicate/whatsappDelete
                    שכבר מכוסים למעלה. */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />הצעות מחיר ללא הגבלה כלל</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />שליחה ישירה בווצאפ ומחיקת הצעות</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />שכפול מתקדם של פריטים מקצועיים</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />צירוף קבצים ושרטוטים להזמנות (עד 30MB)</li>
                </ul>
                <button
                  data-price-id={getLocalPriceId('pro')}
                  className="neon-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=he&intendedPlan=pro&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: NEON_GRADIENT, color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: NEON_GLOW }}
                >
                  התחל ניסיון חינם
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
                // חוק ברזל (§16 QA finding - High): פריט ה-FAQ היה clickable div ללא
                // tabIndex/role/aria-expanded - בלתי-נגיש למקלדת ובלתי-מזוהה לקורא-מסך
                // כפקד-הרחבה. תוקן לתבנית accordion-button תקנית.
                <div
                  key={idx}
                  className="faq-item"
                  role="button"
                  tabIndex={0}
                  aria-expanded={openFaq === idx}
                  aria-controls={`faq-answer-${idx}`}
                  style={{ padding: '16px', cursor: 'pointer' }}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenFaq(openFaq === idx ? null : idx);
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '1rem', color: '#ffffff', gap: '10px' }}>
                    <span>{faq.q}</span>
                    <ChevronDown size={18} color="#c4b5fd" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </div>
                  {openFaq === idx && (
                    <div id={`faq-answer-${idx}`} style={{ marginTop: '10px', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.6', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Business Tools cross-link - קישור ויזואלי מרוסן לחוברת הכלים
              החינמיים (/he/tools - מחשבוני מטבעות/יחידות/מתכות/קריפטו,
              כבר בנויים ופעילים, ללא קשר למוצר התמחור בתשלום). ניסוח עובדתי
              ומצומצם בלבד - ללא מספרי-משתמשים/דירוגים בדויים (ר' חוק ברזל
              §5 למעלה - "מעל 500 עסקים" הוסר ולא הוחלף בטענה לא-מאומתת). */}
          <div className="hover-card" style={{ background: '#0c0c10', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.22)', padding: '32px 28px', maxWidth: '750px', margin: '0 auto 60px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(139, 92, 246, 0.4)' }}>
              <BriefcaseBusiness size={24} color="#a78bfa" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>כלים עסקיים חינמיים</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '520px', margin: 0 }}>
              כלים עסקיים בחינם: מחשבוני מטבעות, יחידות, מתכות וקריפטו - זמינים לכולם ללא הרשמה, כתוסף חופשי ל-<BrandName />.
            </p>
            <button
              className="ghost-btn"
              onClick={() => navigate('/he/tools')}
              style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.35)', padding: '10px 22px', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              למעבר לכלים העסקיים
              <BriefcaseBusiness size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Root-cause fix (Final Landing Polish task, Part A): the final CTA
              previously repeated the same "14-day trial" duration already
              stated in the hero and pricing sections. Per the task's
              3-location budget, this band now focuses purely on the
              outcome - no trial-duration mention. */}
          <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(56,189,248,0.08))', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '18px', padding: '36px 24px', maxWidth: '750px', margin: '0 auto 60px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>מוכנים ליצור את ההצעה הראשונה שלכם?</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.92rem', margin: 0 }}>הצעה מקצועית, מוכנה תוך דקות.</p>
            <button
              className="neon-btn"
              onClick={() => navigate('/dashboard?signup=true&lang=he')}
              style={{ background: NEON_GRADIENT, color: '#ffffff', border: 'none', padding: '13px 30px', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: NEON_GLOW }}
            >
              <ArrowUpRight size={17} strokeWidth={2.5} />
              התחל ניסיון חינם
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#000000', color: '#71717a', padding: '40px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => navigate('/he/terms')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>תנאי שימוש</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/he/privacy')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>מדיניות פרטיות</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => setAccessibilityOpen(true)} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>נגישות</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/he/contact')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Mail size={13} />צור קשר (support@tekango.com)</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/he/tools')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#c4b5fd', fontWeight: 'bold' }}><BriefcaseBusiness size={13} />כלים לעסקים</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} <BrandName /> ישראל. כל הזכויות שמורות.</p>
        </div>
      </footer>

      <AIChatWidget isHebrew={true} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} isHebrew={true} />

    </div>
  );
}
