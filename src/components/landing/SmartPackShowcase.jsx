// "חכם פלוס" / SMART PACK landing promotion (Owner console 2026-10-20: "לעדכן בדפי הנחיתה פרסום של חבילת התענוג, משהו בולט עם אנימציה
// שיפרט את כל היכולות ... (בינתיים רק בשרת הטסט)", "מקצועי, בולט, מודרני, ובאנימציה"; name "בעברית אולי "חכם פלוס" ובאנגלית SMART PACK").
//  - TEST ONLY: rendered only in a non-production build (the TEST 5186 preview runs mode "localtest"); a production build never shows it,
//    so the LIVE landing and its prerendered pages are unchanged until the Owner approves a LIVE release.
//  - The add-on price is the Owner decision of 2026-10-20 (10 ILS / 5 USD a month; yearly with the main plan's 15% saving), shown as an
//    add-on to the subscription and always a choice; nothing here is purchasable (the plan system is not active).
//  - Motion: a scripted assistant demo, a voice wave and staggered cards; everything is static and fully visible when the user asked
//    for reduced motion.
import { useEffect, useRef, useState } from 'react';
import { Bot, Mic, Sparkles, Check, BrainCircuit, AudioLines, WandSparkles, FileStack, ScanFace } from 'lucide-react';
import './smartPack.css';
import { SMART_PACK_ENABLED } from './smartPackFacts';


// Owner 2026-10-20 ("להחליף את האייקונים האלה גם למשהו מודרני יותר"): modern icons on a glossy animated tile
const ICONS = { chat: BrainCircuit, voice: AudioLines, ai: WandSparkles, files: FileStack, twin: ScanFace };

export default function SmartPackShowcase({ copy, isHe, plansHref }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the demo conversation plays once the section is on screen, then loops slowly (question -> typing -> answer -> pause)
  useEffect(() => {
    if (!visible) return undefined;
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setStep(3); return undefined; }
    const timings = [700, 1300, 1400, 4200];
    let i = 0;
    let timer;
    const tick = () => { i = (i + 1) % 4; setStep(i); timer = setTimeout(tick, timings[i]); };
    timer = setTimeout(tick, timings[0]);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!SMART_PACK_ENABLED || !copy) return null;
  return (
    <section ref={ref} className={`sp-section${visible ? ' is-visible' : ''}`} id="smart-pack" aria-labelledby="sp-title" dir={isHe ? 'rtl' : 'ltr'} data-testid="smart-pack">
      <div className="sp-glow" aria-hidden="true" />
      <div className="sp-inner">
        <header className="sp-head">
          <span className="sp-badge"><Sparkles size={14} aria-hidden="true" />{copy.badge}</span>
          <h2 id="sp-title"><span className="sp-name">{copy.name}</span></h2>
          <p className="sp-lead">{copy.lead}</p>
        </header>

        <div className="sp-grid">
          <div className="sp-demo" aria-label={copy.demoLabel} role="img">
            <div className="sp-demo-bar"><span className="sp-dot" /><span className="sp-dot" /><span className="sp-dot" /><span className="sp-demo-title">{copy.demoTitle}</span></div>
            <div className="sp-demo-body">
              <div className={`sp-bubble sp-user${step >= 1 ? ' is-on' : ''}`}>
                <Mic size={14} aria-hidden="true" />
                <span>{copy.demoQuestion}</span>
              </div>
              <div className={`sp-wave${step === 1 ? ' is-on' : ''}`} aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.08}s` }} />)}</div>
              <div className={`sp-typing${step === 2 ? ' is-on' : ''}`} aria-hidden="true"><i /><i /><i /></div>
              <div className={`sp-bubble sp-bot${step >= 3 ? ' is-on' : ''}`}>
                <Bot size={14} aria-hidden="true" />
                <span>{copy.demoAnswer}</span>
              </div>
            </div>
          </div>

          <ul className="sp-features">
            {copy.features.map((f, i) => {
              const Icon = ICONS[f.icon] || Sparkles;
              return (
                <li key={f.title} className="sp-card" style={{ transitionDelay: `${0.12 + i * 0.09}s` }}>
                  <span className="sp-icon"><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></span>
                  <div>
                    <h3>{f.title}{f.soon && <span className="sp-soon">{copy.soon}</span>}</h3>
                    <p>{f.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sp-offer">
          <div className="sp-price">
            <strong dir="ltr">{copy.priceMonth}</strong>
            <span>{copy.priceMonthLabel}</span>
            <em>{copy.priceYear}</em>
          </div>
          <ul className="sp-points">
            {copy.points.map((p) => <li key={p}><Check size={15} aria-hidden="true" />{p}</li>)}
          </ul>
          {/* PRODUCT_TRUTH_DECORATIVE: in-page link to the plans section of the same landing page (nothing is purchased or signed up here) */}
          <a className="sp-cta" href={plansHref}>{copy.cta}</a>
        </div>
        <p className="sp-note">{copy.note}</p>
      </div>
    </section>
  );
}
