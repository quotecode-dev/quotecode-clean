// Task 16 (correction A) - the approved refined landing composition (revision-r2-refined landing-he/en.html), shared by
// LandingLocal.jsx (HE, /he) and LandingGlobal.jsx (EN, /en). The page files own every customer-facing string and all
// commercial data (prices from pricingCatalog, auth entry points, intended-plan hints) so the landing truth gates keep
// scanning them; this component owns layout only. Sections: header / hero with a large readable quotation / three
// styles / how it works (base three steps, ledger L07) / (released commercial film) / the base five capability cards
// (ledger L15: no management preview) / current plans (+ the TEST-only proposed comparison) / FAQ / free business tools
// (base section, ledger L03) / closing CTA / footer.
// No public link to the sample-quote route (ledger L08). SSR-safe (rendered by src/entry-prerender.jsx).
import { Fragment, useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import AIChatWidget from '../../AIChatWidget';
import AccessibilityModal from '../AccessibilityModal';
import LandingHeader from './LandingHeader';
import LandingQuoteDocument from './LandingQuoteDocument';
import QuoteStyleShowcase from './QuoteStyleShowcase';
import LandingPlans from './LandingPlans';
import { LANDING_CSS } from './landingStyles';
import { useLauncherStepAside } from '../../hooks/useLauncherStepAside';

// Surfaces the floating AI launcher may never cover (it steps aside while it would). Owner 2026-10-14 ("the chat button is almost
// never shown - the animation is nice but it must be felt"; measured on LIVE: visible on 10-12% of the phone scroll, 34% on desktop):
// ONLY what a visitor clicks - the plan cards and their Free-10 button and every link / button / FAQ question / footer link. Body text,
// headings and the sample quotations are no longer protected (visible on 72-77% of the phone scroll, 71-75% on desktop).
const PROTECTED_FROM_LAUNCHER = '#plans .tl-plan, #plans .tl-plans-cta, '
  + '.tl-hero a, .tl-hero button, .tl-section a, .tl-section button, .tl-section summary, .tl-closing a, .tl-closing button, .tl-footer a';

function go(navigate, href) {
  return (e) => {
    if (!navigate || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
}

export default function LandingPage({
  lang, copy, plans, navigate, onForgotPassword,
  accessibilityOpen = false, onAccessibilityOpen, onAccessibilityClose,
}) {
  const isHe = lang === 'he';
  const rootRef = useRef(null);
  const ToolsIcon = copy.tools ? copy.tools.icon : null;

  // Light page background while the landing is mounted (overscroll / short-content areas): the app's global body is
  // dark for the authenticated shell. The class is removed on unmount, so no other route is affected. (Before JS, the
  // landing stylesheet's :has() rule covers the prerendered first paint.)
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('tl-landing-active');
    return () => html.classList.remove('tl-landing-active');
  }, []);

  // The floating AI chat launcher is fixed to a bottom corner. Whenever it would sit on top of a sample quotation it
  // steps aside (hidden until the document scrolls away), so it never covers document content; it is back as soon
  // as the document is no longer under it. Client-only; rAF-throttled. Task 26: the plan cards and the plans-section
  // Free-10 button are protected the same way (at 768px the launcher covered a card's status line and price choice).
  // Task 36 (Codex landing review L6, measured at text-line level: the pill covered the hero heading / text and the hero Free-10 button
  // at rest, e.g. EN 320x640, HE 1280x480): the hero heading, text and status line and EVERY action of the page (links, buttons, FAQ
  // questions, footer links) are protected the same way - the approved pill keeps its look and steps aside only while it would cover them.
  useLauncherStepAside(rootRef, PROTECTED_FROM_LAUNCHER, 'tl-launcher-aside');
  return (
    <div ref={rootRef} className="tl-landing" dir={isHe ? 'rtl' : 'ltr'} lang={lang} style={{ fontFamily: copy.fontFamily }}>
      <style>{LANDING_CSS}</style>
      <LandingHeader nav={copy.nav} links={copy.links} navigate={navigate} onForgotPassword={onForgotPassword} />

      <main>
        <section className="tl-hero" aria-labelledby="tl-hero-title">
          <div className="tl-hero-copy">
            <div className="tl-hero-sequence" aria-hidden="true">
              <div className="tl-hero-scene-photo" aria-hidden="true">
                <img src="/assets/landing/hero-workshop.webp" alt="" />
              </div>
              <div className="tl-hero-sequence-copy">
                <span className="tl-hero-sequence-eyebrow">{copy.hero.motion.eyebrow}</span>
                <div className="tl-hero-sequence-title">{copy.hero.motion.title}</div>
                <p>{copy.hero.motion.text}</p>
                <span className="tl-cta tl-hero-sequence-cta">{copy.hero.motion.cta}<ArrowUpRight size={17} strokeWidth={2.2} aria-hidden="true" /></span>
              </div>
              <img
                className="tl-hero-sequence-phone"
                src={isHe ? '/assets/landing/hero-phone-he.webp' : '/assets/landing/hero-phone-en.webp'}
                alt=""
                aria-hidden="true"
              />
            </div>

            <div className="tl-hero-original">
              {copy.hero.eyebrow && <span className="tl-eyebrow">{copy.hero.eyebrow}</span>}
              <h1 id="tl-hero-title">{copy.hero.title}</h1>
              <p className="tl-hero-text">{copy.hero.text}</p>
              <div className="tl-hero-actions">
                {/* PRODUCT_TRUTH_DECORATIVE: primary signup entry point (the auth screen owns signup); Free-10 label paired with its "not active yet" status */}
                <a className="tl-cta tl-free10-cta" href={copy.links.signup} onClick={go(navigate, copy.links.signup)} data-free10-cta><span className="tl-free10-label">{copy.free10.cta}</span><span className="tl-free10-status" data-free10-status>{copy.free10.status}</span><ArrowUpRight size={17} strokeWidth={2.2} aria-hidden="true" /></a>
              </div>
              <p className="tl-trial">{copy.hero.trial}</p>
            </div>
          </div>
          <figure className="tl-hero-proof" aria-label={copy.hero.docLabel}>
            <div className="tl-hero-paper">
              <LandingQuoteDocument locale={lang} style="classic" />
            </div>
          </figure>
        </section>

        <QuoteStyleShowcase locale={lang} copy={copy.styles} />

        <section className="tl-section" id="workflow" aria-labelledby="tl-flow-title">
          <div className="tl-inner">
            <div className="tl-title">
              {copy.workflow.eyebrow && <span className="tl-eyebrow">{copy.workflow.eyebrow}</span>}
              <h2 id="tl-flow-title">{copy.workflow.title}</h2>
              {copy.workflow.intro && <p>{copy.workflow.intro}</p>}
            </div>
            <ol className="tl-flow">
              {copy.workflow.steps.map((s, i) => (
                <li key={s.title} className="tl-flow-step">
                  <span className="tl-flow-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Owner 2026-10-06 (local fix 5): the commercial video section is removed from the landing (HE/EN); the next
            section follows the workflow directly - nothing replaces it (the approved animation is a separate step). */}
        <section className="tl-section tl-alt" id="business" aria-labelledby={copy.business.title ? 'tl-business-title' : undefined}>
          <div className="tl-inner">
            {/* Authority ledger L15: no management preview / reference benefits; the base five capability cards. */}
            {/* Authority ledger L07b: the base feature-card block had no heading - none unless the copy supplies one. */}
            {copy.business.title && (
              <div className="tl-title">
                {copy.business.eyebrow && <span className="tl-eyebrow">{copy.business.eyebrow}</span>}
                <h2 id="tl-business-title">{copy.business.title}</h2>
              </div>
            )}
            <div className="tl-capabilities">
              {copy.business.capabilities.map((c) => {
                const Icon = c.icon;
                return (
                  <article key={c.title} className="tl-capability">
                    {Icon && <span className="tl-capability-icon" aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>}
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </article>
                );
              })}
              {/* Task 27 (Owner-approved image, spec §5): the tradesperson showing the quotes list - same place and proportions as before */}
              <figure className="tl-phone-showcase">
                <img
                  src={isHe ? '/assets/landing/quotes-list-he.webp' : '/assets/landing/quotes-list-en.webp'}
                  width="1122"
                  height="1402"
                  loading="lazy"
                  decoding="async"
                  alt={copy.business.phoneShowcaseAlt}
                />
              </figure>
            </div>
          </div>
        </section>

        <section className="tl-section" id="plans" aria-labelledby="tl-plans-title">
          <div className="tl-inner">
            <div className="tl-title">
              {/* Base plans heading (L12): the section has no eyebrow unless the copy supplies one. */}
              {copy.plans.eyebrow && <span className="tl-eyebrow">{copy.plans.eyebrow}</span>}
              <h2 id="tl-plans-title">{copy.plans.title}</h2>
              <p>{copy.plans.intro}</p>
            </div>
            <p className="tl-plans-note">{copy.plans.trialNote}</p>
            <LandingPlans copy={copy.plans} plans={plans} />
            <div className="tl-plans-cta">
              {/* PRODUCT_TRUTH_DECORATIVE: plans-section signup entry point (the auth screen owns signup), outside the review cards; Free-10 label paired with its "not active yet" status */}
              <a className="tl-cta tl-free10-cta" href={copy.links.signup} onClick={go(navigate, copy.links.signup)} data-free10-cta><span className="tl-free10-label">{copy.free10.cta}</span><span className="tl-free10-status" data-free10-status>{copy.free10.status}</span><ArrowUpRight size={17} strokeWidth={2.2} aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section className="tl-section tl-alt" id="faq" aria-labelledby="tl-faq-title">
          <div className="tl-inner">
            <div className="tl-title">
              {copy.faq.eyebrow && <span className="tl-eyebrow">{copy.faq.eyebrow}</span>}
              <h2 id="tl-faq-title">{copy.faq.title}</h2>
              {copy.faq.intro && <p>{copy.faq.intro}</p>}
            </div>
            <div className="tl-faq">
              {copy.faq.items.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <div className="tl-faq-a">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {copy.tools && (
          <section className="tl-section" id="tools" aria-labelledby="tl-tools-title">
            <div className="tl-inner">
              <div className="tl-tools">
                <div className="tl-tools-copy">
                  {ToolsIcon && <span className="tl-capability-icon" aria-hidden="true"><ToolsIcon size={20} strokeWidth={2} /></span>}
                  <div>
                    <h2 id="tl-tools-title">{copy.tools.title}</h2>
                    <p>{copy.tools.text}</p>
                  </div>
                </div>
                {/* PRODUCT_TRUTH_DECORATIVE: public link to the free business tools hub (/he|en/tools, no signup) */}
                <a className="tl-ghost" href={copy.tools.href} onClick={go(navigate, copy.tools.href)}>{copy.tools.cta}<ArrowUpRight size={16} strokeWidth={2.2} aria-hidden="true" /></a>
              </div>
            </div>
          </section>
        )}

        <section className="tl-closing" aria-labelledby="tl-closing-title">
          <div className="tl-inner">
            <h2 id="tl-closing-title">{copy.closing.title}</h2>
            <p>{copy.closing.text}</p>
            {/* PRODUCT_TRUTH_DECORATIVE: closing signup entry point (the auth screen owns signup); Free-10 label paired with its "not active yet" status */}
            <a className="tl-cta tl-free10-cta" href={copy.links.signup} onClick={go(navigate, copy.links.signup)} data-free10-cta><span className="tl-free10-label">{copy.free10.cta}</span><span className="tl-free10-status" data-free10-status>{copy.free10.status}</span><ArrowUpRight size={17} strokeWidth={2.2} aria-hidden="true" /></a>
          </div>
        </section>
      </main>

      <footer className="tl-footer">
        <div className="tl-footer-inner">
          <p>{copy.footer.copyright}</p>
          <nav className="tl-footer-links">
            {copy.footer.links.map((l) => {
              const Icon = l.icon;
              return (
                <Fragment key={l.label}>
                  {l.kind === 'accessibility' ? (
                    // PRODUCT_TRUTH_DECORATIVE: opens the accessibility statement / tools dialog
                    <button type="button" onClick={onAccessibilityOpen}>{l.label}</button>
                  ) : (
                    // PRODUCT_TRUTH_DECORATIVE: public legal / contact / tools page link
                    <a href={l.href} onClick={go(navigate, l.href)}>{Icon && <Icon size={14} aria-hidden="true" />}{l.label}</a>
                  )}
                </Fragment>
              );
            })}
          </nav>
        </div>
      </footer>

      <AIChatWidget isHebrew={isHe} isDashboard={false} />
      <AccessibilityModal isOpen={accessibilityOpen} onClose={onAccessibilityClose} isHebrew={isHe} />
    </div>
  );
}
