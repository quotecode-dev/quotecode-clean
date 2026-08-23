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
import { NEON, FONT_EN } from '../theme/neonTheme';

export default function LandingGlobal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  useEffect(() => {
    document.title = "ProFlow - Business & Quoting SaaS Platform";

    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', 'ProFlow is a smart business management SaaS: create quotes, manage clients, get digital signatures, and automate tax calculations - built for businesses worldwide.');

    // עצמי: canonical משקף את הנתיב שבו נצפה בפועל (/ או /en) ולא ערך קבוע -
    // אחרת ביקור אמיתי בשורש הריק (זוהה כאנגלית) היה מוצהר כפיל של /en
    let canonicalLink = document.querySelector("link[rel='canonical']");
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = window.location.pathname === '/en'
      ? 'https://www.quotecodepro.com/en'
      : 'https://www.quotecodepro.com/';

    let hreflangEn = document.querySelector("link[hreflang='en']");
    if (!hreflangEn) {
      hreflangEn = document.createElement('link');
      hreflangEn.rel = 'alternate';
      hreflangEn.hreflang = 'en';
      document.head.appendChild(hreflangEn);
    }
    hreflangEn.href = 'https://www.quotecodepro.com/en';

    let hreflangHe = document.querySelector("link[hreflang='he']");
    if (!hreflangHe) {
      hreflangHe = document.createElement('link');
      hreflangHe.rel = 'alternate';
      hreflangHe.hreflang = 'he';
      document.head.appendChild(hreflangHe);
    }
    // תואם ל-sitemap.xml (he -> /he); קודם הוצמד בטעות לשורש הריק
    hreflangHe.href = 'https://www.quotecodepro.com/he';

    try {
      const userLang = (navigator.language || '').toLowerCase();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

      if (userLang.includes('en-gb') || timeZone.includes('London')) {
        setCurrencySymbol('£');
      } else if (userLang.includes('de') || userLang.includes('fr') || userLang.includes('es') || userLang.includes('it') || timeZone.includes('Europe')) {
        setCurrencySymbol('€');
      } else if (userLang.includes('en-au')) {
        setCurrencySymbol('A$');
      } else {
        setCurrencySymbol('$');
      }
    } catch {
      setCurrencySymbol('$');
    }
  }, []);

  const getPricing = () => {
    if (currencySymbol === '£') {
      return {
        basicMonthly: 12, basicYearly: 10,
        proMonthly: 24, proYearly: 19
      };
    } else if (currencySymbol === '€') {
      return {
        basicMonthly: 14, basicYearly: 11,
        proMonthly: 27, proYearly: 22
      };
    } else {
      return {
        basicMonthly: 15, basicYearly: 12,
        proMonthly: 29, proYearly: 23
      };
    }
  };

  const prices = getPricing();

  const basicPrice = billingCycle === 'monthly' ? prices.basicMonthly : prices.basicYearly;
  const basicYearlyTotal = billingCycle === 'monthly' ? prices.basicMonthly * 12 : prices.basicYearly * 12;

  const proPrice = billingCycle === 'monthly' ? prices.proMonthly : prices.proYearly;
  const proYearlyTotal = billingCycle === 'monthly' ? prices.proMonthly * 12 : prices.proYearly * 12;

  const getGlobalPriceId = (planType) => {
    return billingCycle === 'monthly' ? `price_${planType}_global_monthly` : `price_${planType}_global_yearly`;
  };

  const faqs = [
    {
      q: 'Do the displayed prices include taxes?',
      a: 'Yes! All pricing tiers are structured for international standards with clear tax breakdowns where applicable.'
    },
    {
      q: 'What is included in the 14-day free trial?',
      a: 'The trial gives you full and unrestricted access to all PRO features (unlimited quotes, digital client approvals, file attachments, and more) for 14 days with no obligations.'
    },
    {
      q: 'What happens after the 14-day trial if I do not subscribe?',
      a: 'Your account will automatically move to the FREE tier with its standard limitations, so you can continue using the platform peacefully.'
    },
    {
      q: 'Is the platform optimized for mobile and desktop?',
      a: 'Yes, ProFlow is built as a fully responsive modern SaaS platform, allowing you to generate quotes and manage your business from any computer, tablet, or smartphone.'
    },
    {
      q: 'Is my business data secure on the cloud?',
      a: 'Absolutely. We utilize state-of-the-art enterprise-grade cloud databases with strict security, encryption, and automated backups to ensure your data is always safe.'
    },
    {
      q: 'Can I export my financial reports and quotes?',
      a: 'Yes, you can easily export all your business quotes and expense reports into CSV format compatible with Excel and accounting software.'
    }
  ];

  return (
    <div dir="ltr" style={{ fontFamily: FONT_EN, background: NEON.bg, minHeight: '100vh', color: NEON.textPrimary, display: 'flex', flexDirection: 'column', overflowX: 'hidden', letterSpacing: '-0.01em' }}>

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
          margin-bottom: 10px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .faq-item:hover {
          border-color: rgba(167, 139, 250, 0.4);
        }
        .pricing-toggle-container {
          display: inline-flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 4px;
          background: #0c0c10;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.08);
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
            flex-direction: row;
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

      {/* Top Banner Launch Promotion */}
      <div style={{ background: NEON.gradient, color: 'white', padding: '8px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
        <Rocket size={16} strokeWidth={2.5} />
        Launch Promotion! 14-day free trial - with full access to all PRO features!
      </div>

      {/* Header */}
      <header style={{ background: 'rgba(5, 5, 6, 0.85)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div className="header-container">

          <div className="header-logo" style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/en')}>
            <ProFlowLogo size={32} rtl={false} />
          </div>

          <div className="header-actions">
            {onForgotPassword && (
              <button onClick={onForgotPassword} style={{ background: 'transparent', color: '#c4b5fd', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <KeyRound size={13} />
                Forgot Password?
              </button>
            )}
            <button className="nav-btn neon-btn" onClick={() => navigate('/dashboard?lang=en')} style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', boxShadow: NEON.glow, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <LogIn size={15} strokeWidth={2.5} />
              <span className="desktop-btn-text">Sign In / Dashboard</span>
              <span className="mobile-btn-text">Sign In</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-glow" style={{ flex: 1, padding: '60px 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', textAlign: 'center' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#f0abfc', padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '800', marginBottom: '20px', border: '1px solid rgba(236, 72, 153, 0.35)', boxShadow: '0 0 30px rgba(236, 72, 153, 0.2)' }}>
            <Flame size={16} color="#f97316" fill="#f97316" strokeWidth={1.5} />
            Launch Promotion: 14-day free trial for all PRO features!
          </div>

          <h1 className="hero-title" style={{ fontSize: '3.2rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-1.5px' }}>
            Business Management, Quotes & Invoicing <br />
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Easily, Fast & Smart</span>
          </h1>

          <p style={{ fontSize: '1.15rem', color: '#a1a1aa', maxWidth: '700px', margin: '0 auto 28px auto', lineHeight: '1.5' }}>
            An advanced global SaaS platform tailored for modern businesses (featuring automated tax handling, digital signatures, and streamlined client management).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button
              className="neon-btn"
              onClick={() => navigate('/dashboard?signup=true&lang=en')}
              style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '12px 30px', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', boxShadow: NEON.glow, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Start 14-Day Free PRO Trial Now
              <Rocket size={18} strokeWidth={2.5} />
            </button>
            <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: '800' }}>
              14 days completely free for all PRO features!
            </span>
          </div>

          <div style={{ marginBottom: '50px', color: '#a1a1aa', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} color="#fbbf24" fill="#fbbf24" strokeWidth={1} />)}
            </span>
            Over 500 businesses already generate quotes with ease
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
              <source src="/proflow-demoEN.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>

          {/* Pain-Point Section */}
          <div className="pain-box" style={{ background: '#0c0c10', borderRadius: '16px', overflow: 'hidden', maxWidth: '800px', margin: '0 auto 40px auto', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: '5px 14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: '700' }}>
                <AlertTriangle size={14} />
                Sound Familiar?
              </span>
              <h2 style={{ fontSize: '1.9rem', fontWeight: '900', color: '#ffffff', marginTop: '12px', marginBottom: '8px' }}>
                Tired of struggling with price quotes and endless paperwork?
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.95rem' }}>
                Forget hours spent on clunky Word documents, manual tax calculations, and exhausting follow-ups for client approvals.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', textAlign: 'left' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ color: '#f87171', fontWeight: '700', fontSize: '0.85rem', marginBottom: '12px' }}>The old way</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['Hours spent on clunky Word documents', 'Manual, error-prone tax calculations', 'Chasing clients for approvals', 'Scattered quotes and client records'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4d4d8', fontSize: '0.9rem' }}>
                      <XCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ color: '#34d399', fontWeight: '700', fontSize: '0.85rem', marginBottom: '12px' }}>With ProFlow</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['A polished quote ready in a minute', 'Taxes calculated automatically', 'Instant digital signature & approval', 'Every client and quote in one place'].map((t, i) => (
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
              There is a much easier, smarter, and professional way to run your business with ProFlow!
            </div>
          </div>

          {/* Dashboard Preview Box */}
          <div className="preview-box" style={{ borderRadius: '16px', overflow: 'hidden', background: '#0c0c10', maxWidth: '800px', margin: '0 auto 60px auto', padding: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={13} color="#a78bfa" />Quotes This Month</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>24</div>
              </div>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={13} color="#34d399" />Monthly Revenue</div>
                <div style={{ color: '#34d399', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{currencySymbol} 12,400</div>
              </div>
              <div style={{ background: '#131318', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#a1a1aa', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={13} color="#38bdf8" />Active Clients</div>
                <div style={{ color: '#818cf8', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>142</div>
              </div>
            </div>
            <div style={{ background: '#131318', padding: '20px', borderRadius: '10px', textAlign: 'center', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              This is how your business dashboard will look in ProFlow
            </div>
          </div>

          {/* Features Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', textAlign: 'left', marginBottom: '60px' }}>
            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(251, 191, 36, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(251, 191, 36, 0.35)' }}>
                <Zap size={28} color="#fbbf24" fill="#fbbf24" strokeWidth={1} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Quotes in Minutes</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>Create professional, beautiful price quotes including automated tax calculations, discounts, and items from your catalog.</p>
            </div>

            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(139, 92, 246, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(139, 92, 246, 0.4)' }}>
                <PenTool size={26} color="#a78bfa" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Digital Signatures & Approvals</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>Send a direct link to your client to review, digitally sign, and approve orders from any smartphone or computer.</p>
            </div>

            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(16, 185, 129, 0.4)' }}>
                <BarChart3 size={26} color="#34d399" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Income & Expense Tracking</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>Track business profits, manage operating expenses, and view accurate financial reports in real time.</p>
            </div>
          </div>

          {/* Pricing Section - Global */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>Plans & Pricing</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '1.05rem' }}>Choose the best plan for your business.</p>

            <div className="pricing-toggle-container">
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{ background: billingCycle === 'monthly' ? NEON.gradient : 'transparent', color: billingCycle === 'monthly' ? '#ffffff' : '#a1a1aa', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{ background: billingCycle === 'annual' ? NEON.gradient : 'transparent', color: billingCycle === 'annual' ? '#ffffff' : '#a1a1aa', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Annual Billing</span>
                <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Save 20%!</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', textAlign: 'left' }}>

              {/* Free */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#a1a1aa', display: 'inline-flex', width: 'fit-content' }}><Gift size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Free Plan</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>Ideal for getting started.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px' }}>{currencySymbol}0 <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ month</span></div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>Total {currencySymbol}0/year</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Up to 5 quotes per month</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Basic client management</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Email support</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('free')}
                  className="ghost-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=en')}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Start for Free
                </button>
              </div>

              {/* Basic Plan */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#38bdf8', display: 'inline-flex', width: 'fit-content' }}><Layers size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Basic Plan</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>For small businesses needing robust tools.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px' }}>
                  {currencySymbol}{basicPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ month</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${basicYearlyTotal}/year` : `Total ${currencySymbol}${basicYearlyTotal}/year (Billed annually)`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Up to 20 quotes per month</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Digital signatures & client management</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('basic')}
                  className="ghost-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=en')}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Select Basic Plan
                </button>
              </div>

              {/* Pro / Business Plan */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '2px solid #8b5cf6', boxShadow: '0 15px 35px -8px rgba(139, 92, 246, 0.4)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '16px', background: NEON.gradient, color: 'white', padding: '3px 10px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 14px -2px rgba(236, 72, 153, 0.5)' }}>
                  Most Popular
                  <Star size={12} fill="currentColor" strokeWidth={0} />
                </div>
                <div style={{ marginBottom: '10px', color: '#c4b5fd', display: 'inline-flex', width: 'fit-content' }}><Crown size={22} fill="#c4b5fd" strokeWidth={1.5} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Pro Business Plan</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>For growing agencies and businesses with no limits.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#c4b5fd', marginBottom: '2px' }}>
                  {currencySymbol}{proPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ month</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${proYearlyTotal}/year` : `Total ${currencySymbol}${proYearlyTotal}/year (Billed annually)`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />Unlimited quotes</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />Full income & expense tracking</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />File & drawing attachments (up to 30MB)</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('pro')}
                  className="neon-btn"
                  onClick={() => navigate('/dashboard?signup=true&lang=en')}
                  style={{ marginTop: 'auto', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: NEON.glow }}
                >
                  Select PRO Plan
                </button>
              </div>

            </div>
          </div>

          {/* FAQ Section */}
          <div style={{ marginBottom: '60px', textAlign: 'left', maxWidth: '750px', margin: '0 auto 60px auto' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px', textAlign: 'center' }}>Frequently Asked Questions</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '0.95rem', textAlign: 'center' }}>Everything you need to know about the platform.</p>

            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-item" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', fontSize: '1.0rem', color: '#ffffff', gap: '10px' }}>
                  <span>{faq.q}</span>
                  <ChevronDown size={18} color="#c4b5fd" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
                {openFaq === idx && (
                  <div style={{ marginTop: '10px', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#000000', color: '#71717a', padding: '40px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => navigate('/terms')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Terms of Service</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/privacy')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => setAccessibilityOpen(true)} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Accessibility</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/contact')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Mail size={13} />Contact Us (info@quotecodepro.com)</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/tools')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#c4b5fd', fontWeight: 'bold' }}><Wrench size={13} />Business Tools</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} ProFlow Global. All rights reserved.</p>
        </div>
      </footer>

      <AIChatWidget isHebrew={false} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} isHebrew={false} />

    </div>
  );
}
