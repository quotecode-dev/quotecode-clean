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
import { NEON, FONT_EN } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { getPlanPricingDisplay, getStripePriceId } from '../utils/pricingCatalog';
import { VIDEOS_READY } from './landingVideoConfig';

export default function LandingGlobal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  // VIDEOS_READY is the explicit public feature-gate for the commercial
  // video section below, imported from a shared module together with
  // LandingLocal.jsx so both locales can never diverge into a mismatched
  // release state. It stays false until the Owner separately authorizes
  // flipping it for a real release - this file alone never makes that call.
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
    // Final canonical rule (iron rule, see PROFLOW_HANDOFF.md §16): only an
    // explicit ?lang= override may move the canonical of bare "/" (with or
    // without a query string) to a specific language target. Geo/
    // localStorage/navigator.language may decide which bundle actually
    // renders at bare "/" for a human visitor, but must never affect its
    // canonical - bare "/" with no ?lang= always self-canonicalizes to "/",
    // even when English is what's shown. If LandingGlobal renders at all
    // with a valid explicit ?lang=he/en present, that already means main.jsx
    // picked English because of that ?lang - the self-canonical /en matches
    // exactly the language actually rendered. An invalid ?lang= value
    // (anything other than he/en - main.jsx itself doesn't recognize it
    // either) does not count as an explicit override and falls back to the
    // normal pathname rule.
    const langParam = new URLSearchParams(window.location.search).get('lang');
    const explicitLang = langParam === 'he' || langParam === 'en' ? langParam : null;
    const canonicalPath = explicitLang
      ? '/en'
      : window.location.pathname === '/en'
      ? '/en'
      : '/';

    setSeoMeta({
      title: "TEKANGO - Business & Quoting SaaS Platform",
      description: 'TEKANGO is a smart business management SaaS: create quotes, manage clients, get digital signatures, and automate tax calculations - built for businesses worldwide.',
      canonicalPath,
      lang: 'en',
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
        inLanguage: 'en',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description: 'A smart business management SaaS: create quotes, manage clients, get digital signatures, and automate tax calculations - built for businesses worldwide.',
      },
    });

    try {
      const userLang = (navigator.language || '').toLowerCase();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

      // חוק ברזל: המטבעות הבינלאומיים המותרים הם אך ורק USD/EUR/GBP - אין
      // להוסיף AUD/CAD או כל מטבע נוסף. אזורים שאינם תואמים אף תנאי (כולל
      // אוסטרליה) נופלים לברירת המחדל $ (USD).
      if (userLang.includes('en-gb') || timeZone.includes('London')) {
        setCurrencySymbol('£');
      } else if (userLang.includes('de') || userLang.includes('fr') || userLang.includes('es') || userLang.includes('it') || timeZone.includes('Europe')) {
        setCurrencySymbol('€');
      } else {
        setCurrencySymbol('$');
      }
    } catch {
      setCurrencySymbol('$');
    }
  }, []);

  // חוק ברזל / Unified Landing/Tools/Billing-Readiness task, §B: derived
  // from one canonical source (pricingCatalog.js), shared with
  // LandingLocal.jsx, instead of a locally-computed price table - same
  // currently-displayed prices, not invented, verified in pricingCatalog.test.js.
  const currencyMarket = currencySymbol === '£' ? 'gbp' : currencySymbol === '€' ? 'eur' : 'usd';
  const basicPricing = getPlanPricingDisplay(currencyMarket, 'basic', billingCycle);
  const proPricing = getPlanPricingDisplay(currencyMarket, 'pro', billingCycle);
  const basicPrice = basicPricing.monthlyRate;
  const basicYearlyTotal = basicPricing.annualTotal;
  const proPrice = proPricing.monthlyRate;
  const proYearlyTotal = proPricing.annualTotal;

  const getGlobalPriceId = (planType) => getStripePriceId(planType, 'global', billingCycle);

  const faqs = [
    {
      q: 'Do the displayed prices include taxes?',
      a: 'Yes! All pricing tiers are structured for international standards with clear tax breakdowns where applicable.'
    },
    {
      // Root-cause fix (Final Landing Polish task, Part A, mirrors
      // LandingLocal.jsx): two overlapping trial FAQ items each independently
      // repeated the trial duration - combined into one question/answer with
      // a single duration mention, per the task's 3-location budget.
      q: 'What does the free trial include, and what happens when it ends?',
      a: 'For 14 days you get full and unrestricted access to all PRO features (unlimited quotes, digital client approvals, file attachments, and more), with no obligations. If you don\'t subscribe by the end of the trial, your account automatically moves to the FREE tier with its standard limitations, so you can keep using the platform without interruption.'
    },
    {
      q: 'Is the platform optimized for mobile and desktop?',
      a: <>Yes, <BrandName /> is built as a fully responsive modern SaaS platform, allowing you to generate quotes and manage your business from any computer, tablet, or smartphone.</>
    },
    {
      q: 'Is my business data secure on the cloud?',
      a: 'Your data is stored on cloud infrastructure built on Supabase/PostgreSQL, which includes encryption in transit (TLS) and at rest as part of the standard cloud infrastructure. Access to your data is restricted to your own account.'
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

        .signin-text-compact {
          display: none;
        }

        /* Post-Recovery + EN Login CTA Parity Fix: the icon-only fallback
           below previously left EN's existing-user login access with no
           textual label at all at this width - unlike LandingLocal.jsx's
           own header, which always keeps a textual "כניסה" even at its
           narrowest breakpoint. Swaps to the shorter "Login" instead of
           hiding text entirely, with the gaps below tightened to absorb as
           much of the added width as possible without touching the
           adjacent Start Free Trial button (out of this fix's scope).
           Live-measured (iPhone 13 / 390px - this project's own tested
           Mobile viewport, playwright.config.js): clean, no overflow, no
           overlap between the two buttons. Below ~340px (already
           independently overflowing before this fix, caused by the Free
           Trial button's own width budget, not Sign In - not part of this
           project's tested viewport matrix): residual overflow remains,
           reported separately, not fixed here (would require touching the
           Free Trial button, outside this fix's scope). */
        @media (max-width: 400px) {
          .signin-text {
            display: none;
          }
          .signin-text-compact {
            display: inline;
          }
          .nav-btn:not(.neon-btn) {
            padding: 8px 10px !important;
            gap: 4px !important;
          }
          .header-actions {
            gap: 6px !important;
          }
        }
      `}</style>

      {/* Root-cause fix (Final Landing Polish task, Part A - mirrors
          LandingLocal.jsx): removed entirely rather than trimmed - it
          repeated the same trial claim as the hero badge/CTA/helper line
          below, and the helper line was chosen as the single hero-section
          occurrence. */}

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
            {/* Iron rule (Stage 2A - "one dominant trial CTA"): mirrors the
                LandingLocal.jsx header restructure - Sign In demoted to a
                secondary/transparent button, trial promoted to the sole
                primary gradient action. */}
            <button className="nav-btn" onClick={() => navigate('/dashboard?lang=en')} aria-label="Sign In" style={{ background: 'transparent', color: '#e4e4e7', border: '1px solid rgba(255,255,255,0.14)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <LogIn size={14} strokeWidth={2.5} />
              <span className="signin-text">Sign In</span>
              <span className="signin-text-compact">Login</span>
            </button>
            <button className="nav-btn neon-btn" onClick={() => navigate('/dashboard?signup=true&lang=en')} style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', boxShadow: NEON.glow, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpRight size={15} strokeWidth={2.5} />
              <span className="desktop-btn-text">Start Free Trial</span>
              <span className="mobile-btn-text">Free Trial</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-glow" style={{ flex: 1, padding: '60px 20px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', textAlign: 'center' }}>

          {/* Root-cause fix (Part A, mirrors LandingLocal.jsx): removed - this
              badge duplicated the same trial claim as the CTA button and the
              helper line below it, which is the single hero-section
              occurrence per the task's 3-location trial-message budget. */}

          {/* Mirror of LandingLocal.jsx: "Invoicing" removed from the headline -
              ProFlow does not issue invoices, and no real invoicing capability
              exists in the product. The headline now only describes
              capabilities verified in code: smart quotes + business management. */}
          <h1 className="hero-title" style={{ fontSize: '3.2rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-1.5px' }}>
            Smart Quotes & Business Management <br />
            <span style={{ background: 'linear-gradient(to right, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Easily, Fast & Professionally</span>
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
              Start Free Trial
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </button>
            <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: '800' }}>
              14-day full PRO trial, no credit card required
            </span>
          </div>

          {/* Mirror of LandingLocal.jsx: the "Over 500 businesses" trust-signal
              line was removed entirely - no verified real number backs this
              claim, and it was not replaced with a different invented figure. */}

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

            {/* Root-cause fix (Stage 2D): found via live 320px measurement
                that 240px was too wide to fit two columns' worth of content
                inside this box's available width (sw:238-240 vs cw:230),
                causing it to be silently clipped by the parent's
                overflow:hidden. Narrowed the minimum for a safe margin. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', textAlign: 'left' }}>
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
                <div style={{ color: '#34d399', fontWeight: '700', fontSize: '0.85rem', marginBottom: '12px' }}>With <BrandName /></div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', color: '#e4e4e7', fontWeight: '700', fontSize: '1rem' }}>
              <Lightbulb size={18} color="#f0abfc" fill="#f0abfc" strokeWidth={1} />
              <span>There is a much easier, smarter, and professional way to run your business with <BrandName />!</span>
            </div>
          </div>

          {/* Dashboard Preview Box - a visible "Sample data" badge was added so
              these illustrative numbers are never mistaken for real traction. */}
          <div className="preview-box" style={{ borderRadius: '16px', overflow: 'hidden', background: '#0c0c10', maxWidth: '800px', margin: '0 auto 60px auto', padding: '24px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></div>
              </div>
              <span style={{ background: 'rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: '0.72rem', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>Sample data</span>
            </div>
            {/* Root-cause fix (Stage 2D): a fixed 3-column grid can't shrink
                below its content's intrinsic width at narrow viewports
                (found via live 320/360px measurement - third card's rect
                pushed to x:280 outside a 230px-wide container). LandingLocal's
                Hebrew mirror already uses auto-fit/minmax for this same grid,
                collapsing to fewer columns instead of clipping. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
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
              This is how your business dashboard will look in <BrandName />
            </div>
          </div>

          {/* Iron rule (Two-Stage Completion Task, Stage 2A - "Three-step
              explanation: Create → Send → Approve & Sign"): mirrors the
              LandingLocal.jsx section, mapped to the same verified
              capabilities (Smart Quote wizard, share link, digital signature
              + public_approve_quote). */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>How It Works</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '30px', fontSize: '1.05rem' }}>From a blank page to a signed quote in minutes.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', textAlign: 'center' }}>
              {[
                { icon: <FilePlus2 size={26} color="#a78bfa" strokeWidth={2} />, glow: 'rgba(139, 92, 246, 0.4)', bg: 'rgba(139, 92, 246, 0.12)', n: '1', title: 'Create', desc: 'Build a guided quote - a simple item, calculated by measurements, or picked from your catalog. Totals and tax update as you type.' },
                { icon: <Send size={24} color="#38bdf8" strokeWidth={2.2} />, glow: 'rgba(56, 189, 248, 0.4)', bg: 'rgba(56, 189, 248, 0.12)', n: '2', title: 'Send', desc: 'Share a personal link so the client can view the polished quote on any device - no printing, no heavy attachments.' },
                { icon: <ShieldCheck size={24} color="#34d399" strokeWidth={2.2} />, glow: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.12)', n: '3', title: 'Approve & Sign', desc: 'The client approves and signs digitally right from their phone - and you get notified instantly.' },
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

          {/* This section shows ONE complete, approved English commercial film
              (problem -> product -> real workflow -> customer approval ->
              result -> CTA), mirroring LandingLocal.jsx - replacing an earlier
              four-teaser format the Owner found unclear. The four original
              teaser files were removed from disk with explicit Owner
              authorization after a privacy review found unreferenced/unsafe
              content in them (Final Landing Pre-Release Fixes task) - there is
              nothing left to preserve. Gate: VIDEOS_READY controls public
              visibility; showVideosSection ORs in the query-param-only local
              preview override (?previewVideos=1) for pre-release QA. No
              autoplay; poster + click-to-play only. */}
          {showVideosSection && (
            <div style={{ marginBottom: '60px' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>
                <PlayCircle size={22} style={{ verticalAlign: '-3px', marginInlineEnd: '8px' }} aria-hidden="true" color="#c4b5fd" />
                See It In Action
              </h2>
              <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '0.95rem' }}>From a client's request to a signed quote - one short film, using demo data only.</p>
              <div style={{ maxWidth: '860px', margin: '0 auto', background: '#0c0c10', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <video
                  controls
                  preload="none"
                  poster="/videos/proflow-en-commercial-poster.jpg"
                  aria-label="TEKANGO - from quote to approval and signature"
                  style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000' }}
                  onEnded={(e) => { e.currentTarget.currentTime = 0; }}
                >
                  <source src="/videos/proflow-en-commercial.mp4" type="video/mp4" />
                  {/* Final Landing Pre-Release Fixes task: captions are already burned
                      into the video; `default` here would make the browser's native VTT
                      renderer show a second, overlapping copy on top of them - matches the
                      Hebrew track's already-correct architecture. The track stays present
                      and selectable via the player's own captions menu. */}
                  <track kind="captions" src="/videos/proflow-en-commercial.vtt" srcLang="en" label="Captions" />
                </video>
                <div style={{ padding: '18px 20px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#ffffff', margin: '0 0 4px', fontWeight: '700' }}>From Quote to Approval and Signature</h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.88rem', margin: 0 }}>How <BrandName /> turns a client's request into a professional quote - sent, approved, and signed right from their phone.</p>
                </div>
              </div>
            </div>
          )}

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

            {/* §C - Professional/trade capability messaging (PROFLOW_TODO.md
                #44/#52): grounded in a real, verified capability
                (QuoteForm.jsx - calculated_quantity/calculated_area,
                area/linear method, multiple measurement rows per item) -
                written generically across trades, not tied to any one
                industry. Feature->Benefit->Outcome: structured measurements
                -> fewer manual calculations/errors -> faster, more accurate
                repeat quoting. No plan/tier claimed here on purpose
                (professionalQuotes is Basic+Pro, not Free-wide and not
                PRO-exclusive - that detail already lives on the pricing
                cards below, not duplicated here). */}
            <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ marginBottom: '16px', background: 'rgba(56, 189, 248, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(56, 189, 248, 0.4)' }}>
                <Ruler size={26} color="#38bdf8" strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Professional Quotes with Measurements & Specs</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5' }}>Build a quote from real measurements (area or length), with multiple measurement rows per item and automatic quantity calculation - suited for glass and aluminum work, flooring, electrical, plumbing, and other trades. Fewer manual calculations and errors, more accurate quotes, and time saved on repeat quoting.</p>
            </div>
          </div>

          {/* Pricing Section - Global */}
          <div style={{ marginBottom: '60px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px' }}>Plans & Pricing</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '10px', fontSize: '1.05rem' }}>Choose the best plan for your business.</p>
            {/* Mirror of LandingLocal.jsx: no real billing/checkout system is
                connected yet (billing-checkout-stub is a scaffold, not a real
                charge) - every new signup actually creates the same full PRO
                trial account regardless of which card is clicked. This
                sentence makes that transparent instead of implying a real
                plan-selection mechanism exists. */}
            {/* §C - post-trial payment wording: does not invent a commercial
                process (no "we'll charge you automatically", no "our team
                will contact you") - only facts true today: signup starts a
                trial, selecting a plan/cycle does not charge at signup,
                actual payment completion is a separate later step (mechanism
                deliberately unspecified - it doesn't exist yet, see the final report). */}
            <p style={{ color: '#c4b5fd', marginBottom: '25px', fontSize: '0.85rem', fontWeight: '600' }}>Every new signup starts with the same full 14-day PRO trial, regardless of which plan card you click - once the trial ends, you can continue on whichever plan best fits your business. Selecting a plan or billing cycle here does not charge you at signup - it's only a preference we'll take into account later; completing actual payment is a separate, later step.</p>

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
                {/* §B (Proportional Workspace Correction task): one shared
                    badge covering both Basic and Pro across 3 possible
                    currencies (USD/GBP/EUR) - real savings range ~17-21%
                    depending on plan/currency (pricingCatalog.js), so a
                    single "20%" is not always accurate (GBP Basic is only
                    ~17%). Non-numeric wording here; the exact computed
                    percentage for the currently-displayed currency shows on
                    each plan card below (basicPricing/proPricing.savingsPercent). */}
                <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Save with annual billing!</span>
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
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending or quote deletion</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No editing/duplicating a saved quote</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('free')}
                  className="ghost-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=en&intendedPlan=free&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Start Free Trial
                </button>
              </div>

              {/* Basic Plan */}
              <div className="hover-card" style={{ background: '#0c0c10', padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '10px', color: '#38bdf8', display: 'inline-flex', width: 'fit-content' }}><Layers size={22} strokeWidth={2} /></div>
                <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '8px', fontWeight: '700' }}>Basic Plan</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '16px' }}>For small businesses needing robust tools.</p>
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#ffffff', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  {currencySymbol}{basicPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ month</span>
                  {/* §B: exact percentage for this plan+currency, computed
                      from pricingCatalog.js - not a fixed/invented number. */}
                  {billingCycle === 'annual' && (
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>Save {basicPricing.savingsPercent}%</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${basicYearlyTotal}/year` : `Total ${currencySymbol}${basicYearlyTotal}/year (Billed annually)`}
                </div>
                {/* Real capability matrix (verified in planCatalog.js): Smart/
                    professional quotes and edit/duplicate are both already
                    true at BASIC - neither was mentioned on this card before. */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Up to 20 quotes per month</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Digital signatures & client management</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Edit & duplicate saved quotes</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />Smart quotes with structured professional specifications</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No direct WhatsApp sending or quote deletion</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><XCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />No file & drawing attachments</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('basic')}
                  className="ghost-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=en&intendedPlan=basic&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.04)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Start Free Trial
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
                <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#c4b5fd', marginBottom: '2px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  {currencySymbol}{proPrice} <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: '#a1a1aa' }}>/ month</span>
                  {billingCycle === 'annual' && (
                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>Save {proPricing.savingsPercent}%</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px' }}>
                  {billingCycle === 'monthly' ? `Total ${currencySymbol}${proYearlyTotal}/year` : `Total ${currencySymbol}${proYearlyTotal}/year (Billed annually)`}
                </div>
                {/* Real capability matrix (verified in planCatalog.js and the
                    actual gating call sites in Dashboard.jsx/QuoteForm.jsx):
                    Finances/Clients/Catalog/CSV/AI Chat are available on
                    every tier including FREE - listing "income & expense
                    tracking" as PRO-exclusive was misleading and has been
                    replaced with the capabilities that are genuinely gated
                    behind PRO in the code. */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', color: '#d4d4d8', fontSize: '0.9rem', lineHeight: '2', flex: 1 }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />Unlimited quotes</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />WhatsApp sending and quote deletion</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />Advanced professional-item duplication/reuse</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={16} color="#c4b5fd" style={{ flexShrink: 0 }} />File & drawing attachments (up to 30MB)</li>
                </ul>
                <button
                  data-price-id={getGlobalPriceId('pro')}
                  className="neon-btn"
                  onClick={() => navigate(`/dashboard?signup=true&lang=en&intendedPlan=pro&intendedCycle=${billingCycle}`)}
                  style={{ marginTop: 'auto', background: NEON.gradient, color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', boxShadow: NEON.glow }}
                >
                  Start Free Trial
                </button>
              </div>

            </div>
          </div>

          {/* FAQ Section */}
          <div style={{ marginBottom: '60px', textAlign: 'left', maxWidth: '750px', margin: '0 auto 60px auto' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: '800', color: '#ffffff', marginBottom: '8px', textAlign: 'center' }}>Frequently Asked Questions</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '24px', fontSize: '0.95rem', textAlign: 'center' }}>Everything you need to know about the platform.</p>

            {faqs.map((faq, idx) => (
              // Accessibility fix (QA finding, High): this was a clickable div with no
              // tabIndex/role/aria-expanded - keyboard-unreachable and not identifiable
              // as an expandable control to screen readers. Standard accordion pattern now.
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', fontSize: '1.0rem', color: '#ffffff', gap: '10px' }}>
                  <span>{faq.q}</span>
                  <ChevronDown size={18} color="#c4b5fd" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
                {openFaq === idx && (
                  <div id={`faq-answer-${idx}`} style={{ marginTop: '10px', color: '#a1a1aa', fontSize: '0.9rem', lineHeight: '1.5', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Business Tools cross-link - a restrained visual pointer to the
              free tools hub (/en/tools - currency/unit/metals/crypto
              calculators, already built and live, unrelated to the paid
              quoting product). Copy is factual and modest only - no invented
              user-count/rating claims (mirrors the §5 "Over 500 businesses"
              removal above - not replaced with a different unverified number). */}
          <div className="hover-card" style={{ background: '#0c0c10', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.22)', padding: '32px 28px', maxWidth: '700px', margin: '0 auto 60px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(139, 92, 246, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', boxShadow: '0 0 24px -6px rgba(139, 92, 246, 0.4)' }}>
              <BriefcaseBusiness size={24} color="#a78bfa" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>Free Business Tools</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '500px', margin: 0 }}>
              Free business tools: currency, unit, metals & crypto calculators - available to everyone, no signup required, as a free companion to <BrandName />.
            </p>
            <button
              className="ghost-btn"
              onClick={() => navigate('/en/tools')}
              style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.35)', padding: '10px 22px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              Explore the Free Business Tools
              <BriefcaseBusiness size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Root-cause fix (Final Landing Polish task, Part A, mirrors
              LandingLocal.jsx): removed the duplicate trial-duration mention
              here - the final CTA now focuses purely on the outcome, per the
              task's 3-location trial-message budget (hero / pricing / FAQ). */}
          <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(56,189,248,0.08))', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '18px', padding: '36px 24px', maxWidth: '750px', margin: '0 auto 60px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>Ready to create your first quote?</h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.92rem', margin: 0 }}>A professional quote, ready in minutes.</p>
            <button
              className="neon-btn"
              onClick={() => navigate('/dashboard?signup=true&lang=en')}
              style={{ background: NEON.gradient, color: '#ffffff', border: 'none', padding: '13px 30px', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: NEON.glow }}
            >
              <ArrowUpRight size={17} strokeWidth={2.5} />
              Start Free Trial
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: '#000000', color: '#71717a', padding: '40px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px' }}>
            <button onClick={() => navigate('/en/terms')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Terms of Service</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/en/privacy')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Privacy Policy</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => setAccessibilityOpen(true)} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Accessibility</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/en/contact')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Mail size={13} />Contact Us (info@tekango.com)</button>
            <span style={{ color: '#27272a' }}>|</span>
            <button onClick={() => navigate('/en/tools')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#c4b5fd', fontWeight: 'bold' }}><BriefcaseBusiness size={13} />Business Tools</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} <BrandName /> Global. All rights reserved.</p>
        </div>
      </footer>

      <AIChatWidget isHebrew={false} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={() => setAccessibilityOpen(false)} isHebrew={false} />

    </div>
  );
}
