import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProFlowLogo from '../components/ProFlowLogo';
import AIChatWidget from '../AIChatWidget';
import AccessibilityModal from '../components/AccessibilityModal';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function LandingGlobal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  useEffect(() => {
    document.title = "ProFlow - Business & Quoting SaaS Platform";

    let canonicalLink = document.querySelector("link[rel='canonical']");
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = 'https://www.quotecodepro.com/en';

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
    hreflangHe.href = 'https://www.quotecodepro.com/';

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
    <div dir="ltr" style={{ fontFamily: 'Inter, Segoe UI, Tahoma, sans-serif', background: '#090d16', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      
      <style>{`
        .hover-card {
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .hover-card:hover {
          transform: translateY(-4px);
          border-color: #6366f1;
          box-shadow: 0 16px 30px -10px rgba(99, 102, 241, 0.2);
        }
        .hero-glow {
          background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.15) 0%, rgba(15, 23, 42, 0) 60%);
        }
        .preview-box {
          box-shadow: 0 25px 60px -15px rgba(99, 102, 241, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .pain-box {
          box-shadow: 0 20px 40px -15px rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .faq-item {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          margin-bottom: 10px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .faq-item:hover {
          border-color: rgba(99, 102, 241, 0.4);
        }
        .pricing-toggle-container {
          display: inline-flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 4px;
          background: #111827;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s;
          font-size: 0.9rem;
          margin: 0 10px;
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
      <div style={{ background: 'linear-gradient(90deg, #4f46e5, #10b981)', color: 'white', padding: '8px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Launch Promotion! 14-day free trial - with full access to all PRO features!
      </div>

      {/* Header */}
      <header style={{ background: 'rgba(9, 13, 22, 0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div className="header-container">
          
          <div className="header-logo" style={{ cursor: 'pointer', background: 'rgba(255, 255, 255, 0.04)', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/en')}>
            <ProFlowLogo size={32} rtl={false} />
          </div>
          
          <div className="header-actions">
            {onForgotPassword && (
              <button onClick={onForgotPassword} style={{ background: 'transparent', color: '#818cf8', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                Forgot Password?
              </button>
            )}
            <button className="nav-btn" onClick={() => navigate('/dashboard?lang=en')} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
              <span className="desktop-btn-text">Sign In / Dashboard</span>
              <span className="mobile-btn-text">Sign In</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-glow" style={{ flex: 1, padding: '60px 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', textAlign: 'center' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(99, 102, 241, 0.12))', color: '#34d399', padding: '8px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: '700', marginBottom: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#f97316" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            Launch Promotion: 14-day free trial for all PRO features!
          </div>
          
          <h1 className="hero-title" style={{ fontSize: '3.2rem', fontWeight: '800', color: '#ffffff', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-0.5px' }}>
            Business Management, Quotes & Invoicing <br />
            <span style={{ background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Easily, Fast & Smart</span>
          </h1>
          
          <p style={{ fontSize: '1.15rem', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 28px auto', lineHeight: '1.5' }}>
            An advanced global SaaS platform tailored for modern businesses (featuring automated tax handling, digital signatures, and streamlined client management).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <button onClick={() => navigate('/dashboard?signup=true&lang=en')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Start 14-Day Free PRO Trial Now
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0z"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3z"/></svg>
            </button>
            <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: '700' }}>
              14 days completely free for all PRO features!
            </span>
          </div>

          <div style={{ marginBottom: '50px', color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3, 4, 5].map(i => <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
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
              style={{ width: '100%', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(99, 102, 241, 0.35)', border: '1px solid rgba(255, 255, 255, 0.15)', display: 'block' }}
            >
              <source src="/proflow-demoEN.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>

          {/* Pain-Point Section */}
          <div className="pain-box" style={{ background: '#111827', borderRadius: '14px', overflow: 'hidden', maxWidth: '800px', margin: '0 auto 40px auto', padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '5px 14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: '700' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Sound Familiar?
              </span>
              <h2 style={{ fontSize: '1.9rem', fontWeight: '800', color: '#ffffff', marginTop: '12px', marginBottom: '8px' }}>
                Tired of struggling with price quotes and endless paperwork?
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                Forget hours spent on clunky Word documents, manual tax calculations, and exhausting follow-ups for client approvals.
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', textAlign: 'left' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ color: '#f87171', fontWeight: '700', fontSize: '0.85rem', marginBottom: '12px' }}>The old way</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['Hours spent on clunky Word documents', 'Manual, error-prone tax calculations', 'Chasing clients for approvals', 'Scattered quotes and client records'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.07)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '18px 20px' }}>
                <div style={{ color: '#34d399', fontWeight: '700', fontSize: '0.85rem', marginBottom: '12px' }}>With ProFlow</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['A polished quote ready in a minute', 'Taxes calculated automatically', 'Instant digital signature & approval', 'Every client and quote in one place'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '0.9rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', color: '#34d399', fontWeight: '700', fontSize: '1rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1-1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              There is a much easier, smarter, and professional way to run your business with ProFlow!
            </div>
          </div>

          {/* Dashboard Preview Box */}
          <div className="preview-box" style={{ borderRadius: '14px', overflow: 'hidden', background: '#111827', maxWidth: '800px', margin: '0 auto 60px auto', padding: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Quotes This Month</div>
                <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>24</div>
              </div>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Monthly Revenue</div>
                <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>{currencySymbol} 12,400</div>
              </div>
              <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Active Clients</div>
                <div style={{ color: '#818cf8', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>142</div>
              </div>
            </div>
            <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', border: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              This is how your business dashboard will look in ProFlow
            </div>
          </div>

          {/* Features Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', textAlign: 'left', marginBottom: '60px' }}>
            <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(251, 191, 36, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Quotes in Minutes</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Create professional, beautiful price quotes including automated tax calculations, discounts, and items from your catalog.</p>
            </div>
            
            <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(99, 102, 241, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Digital Signatures & Approvals</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Send a direct link to your client to review, digitally sign, and approve orders from any smartphone or computer.</p>
            </div>

            <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Income & Expense Tracking</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Track business profits, manage operating expenses, and view accurate financial reports in real time.</p>
            </div>
          </div>

          {/* Pricing Section - Global */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>Plans & Pricing</h2>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '1.05rem' }}>Choose the best plan for your business.</p>
            
            <div className="pricing-toggle-container">
              <button 
                onClick={() => setBillingCycle('monthly')}
                style={{ background: billingCycle === 'monthly' ? '#6366f1' : 'transparent', color: billingCycle === 'monthly' ? '#ffffff' : '#94a3b8', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                Monthly Billing
              </button>
              <button 
                onClick={() => setBillingCycle('annual')}
                style={{ background: billingCycle === 'annual' ? '#6366f1' : 'transparent', color: billingCycle === 'annual' ? '#ffffff' : '#94a3b8', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Annual Billing</span>
                <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Save 20%!</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', textAlign: 'left' }}>
              
              {/* Free */}
              <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Free Plan</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>Ideal for getting started.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '2px' }}>{currencySymbol}0 <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#94a3b8' }}>/ month</span></div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px' }}>Total {currencySymbol}0/year</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Up to 5 quotes per month</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Basic client management</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Email support</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                </ul>
                <button 
                  data-price-id={getGlobalPriceId('free')}
                  onClick={() => navigate('/dashboard?signup=true&lang=en')} 
                  style={{ marginTop: 'auto', background: '#1f2937', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Start for Free
                </button>
              </div>

              {/* Basic Plan */}
              <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Basic Plan</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>For small businesses needing robust tools.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '2px' }}>
                  {currencySymbol}{basicPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#94a3b8' }}>/ month</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${basicYearlyTotal}/year` : `Total ${currencySymbol}${basicYearlyTotal}/year (Billed annually)`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Up to 20 quotes per month</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Digital signatures & client management</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                </ul>
                <button 
                  data-price-id={getGlobalPriceId('basic')}
                  onClick={() => navigate('/dashboard?signup=true&lang=en')} 
                  style={{ marginTop: 'auto', background: '#1f2937', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Select Basic Plan
                </button>
              </div>

              {/* Pro / Business Plan */}
              <div className="hover-card" style={{ background: '#111827', padding: '28px', borderRadius: '14px', border: '2px solid #6366f1', boxShadow: '0 12px 25px rgba(99, 102, 241, 0.15)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '16px', background: '#6366f1', color: 'white', padding: '3px 10px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Most Popular
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Pro Business Plan</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>For growing agencies and businesses with no limits.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '800', color: '#818cf8', marginBottom: '2px' }}>
                  {currencySymbol}{proPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#94a3b8' }}>/ month</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${proYearlyTotal}/year` : `Total ${currencySymbol}${proYearlyTotal}/year (Billed annually)`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#818cf8" style={{ flexShrink: 0 }} />Unlimited quotes</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#818cf8" style={{ flexShrink: 0 }} />Full income & expense tracking</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#818cf8" style={{ flexShrink: 0 }} />File & drawing attachments (up to 30MB)</li>
                </ul>
                <button 
                  data-price-id={getGlobalPriceId('pro')}
                  onClick={() => navigate('/dashboard?signup=true&lang=en')} 
                  style={{ marginTop: 'auto', background: '#6366f1', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(99,102,241,0.3)' }}
                >
                  Select PRO Plan
                </button>
              </div>

            </div>
          </div>

          {/* FAQ Section */}
          <div style={{ marginBottom: '60px', textAlign: 'left', maxWidth: '750px', margin: '0 auto 60px auto' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px', textAlign: 'center' }}>Frequently Asked Questions</h2>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.95rem', textAlign: 'center' }}>Everything you need to know about the platform.</p>
            
            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-item" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setOpenFaq(openFaq === idx ? null : idx)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', fontSize: '1.0rem', color: '#ffffff' }}>
                  <span>{faq.q}</span>
                  <span style={{ color: '#818cf8', fontSize: '1.1rem' }}>{openFaq === idx ? '−' : '+'}</span>
                </div>
                {openFaq === idx && (
                  <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#05070a', color: '#64748b', padding: '40px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => navigate('/terms')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Terms of Service</button>
            <span style={{ color: '#334155' }}>|</span>
            <button onClick={() => navigate('/privacy')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
            <span style={{ color: '#334155' }}>|</span>
            <button onClick={() => setAccessibilityOpen(true)} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Accessibility</button>
            <span style={{ color: '#334155' }}>|</span>
            <button onClick={() => navigate('/contact')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Contact Us (info@quotecodepro.com)</button>
            <span style={{ color: '#334155' }}>|</span>
            <button onClick={() => navigate('/public-tools')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#818cf8', fontWeight: 'bold' }}>Business Tools</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} ProFlow Global. All rights reserved.</p>
        </div>
      </footer>

      <AIChatWidget isHebrew={false} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} isHebrew={false} />

    </div>
  );
}