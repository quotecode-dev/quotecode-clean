// Task 16 (correction A) - refined landing navigation. Desktop (> 1180 px): logo, sign-in and one primary CTA, section
// links. Tablet / phone: logo, primary CTA and a Menu button that opens a drawer on the physical inline-start side
// (HE right, EN left) with the section links, sign-in and forgot password.
// No visible HE/EN switch (Owner 2026-10-05): the locale routes /he and /en, the locale auth links and the
// canonical/hreflang alternates stay; only the visible cross-language link is gone (header and drawer, every width).
// Action placement (Owner 2026-10-05): HE = logo AND sign-in/trial actions on the physical right; EN = logo on the left,
// sign-in/sign-up actions on the right (CSS order in landing.css, `.tl-landing[dir='rtl']`).
// The drawer is closed on the server render (SSR-safe); Escape / backdrop close it and focus returns to the opener.
import { useEffect, useRef, useState } from 'react';
import { Menu, X, LogIn, KeyRound } from 'lucide-react';
import ProFlowLogo from '../ProFlowLogo';

function go(navigate, href) {
  return (e) => {
    if (!navigate || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
}

export default function LandingHeader({ nav, links, navigate, onForgotPassword }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const drawer = drawerRef.current;
    const opener = openerRef.current;
    const focusables = () => (drawer ? [...drawer.querySelectorAll('a[href],button:not([disabled])')] : []);
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  const close = () => setOpen(false);
  // A section with its own `href` is a separate page (Owner 2026-10-27: the guides index), opened through the router; the rest are in-page anchors.
  const sectionLinks = nav.sections.map((s) => ({ ...s, page: Boolean(s.href), href: s.href || `#${s.id}` }));

  // Task 21: the drawer is rendered as a SIBLING of the header, never inside it - `.tl-header` has `backdrop-filter`, which makes it the
  // containing block of a `position: fixed` descendant, so a drawer inside it was clipped to the ~60px header box (links + sign-in invisible).
  return (
    <>
    <header className="tl-header">
      <div className="tl-nav">
        {/* PRODUCT_TRUTH_DECORATIVE: public landing logo link back to this locale's landing page */}
        <a className="tl-logo" href={links.home} onClick={go(navigate, links.home)} aria-label={nav.homeLabel}>
          <ProFlowLogo size={30} darkText />
        </a>
        <nav className="tl-menu" aria-label={nav.label}>
          {sectionLinks.map((s) => (
            // PRODUCT_TRUTH_DECORATIVE: in-page anchor to a landing section, or the public guides page
            <a key={s.id} className="tl-menu-link" href={s.href} onClick={s.page ? go(navigate, s.href) : undefined}>{s.label}</a>
          ))}
        </nav>
        <div className="tl-actions">
          {onForgotPassword && (
            // PRODUCT_TRUTH_DECORATIVE: opens the existing forgot-password flow (owned by the auth screen)
            <button type="button" className="tl-forgot" onClick={onForgotPassword}><KeyRound size={13} aria-hidden="true" />{nav.forgotPassword}</button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: sign-in entry point for existing accounts (the auth screen owns authentication) */}
          <a className="tl-login" href={links.login} onClick={go(navigate, links.login)}>
            <LogIn size={15} strokeWidth={2.2} aria-hidden="true" />{nav.login}
          </a>
          {/* PRODUCT_TRUTH_DECORATIVE: primary signup entry point (the auth screen owns signup); the Free-10 label is always paired with its "not active yet" status (IRON-LANDING-001) */}
          <a className="tl-cta tl-header-cta tl-free10-cta" href={links.signup} onClick={go(navigate, links.signup)} data-free10-cta>
            <span className="tl-free10-label">{nav.cta}</span>
            {nav.ctaStatus && <span className="tl-free10-status" data-free10-status>{nav.ctaStatus}</span>}
          </a>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the landing navigation drawer on tablet and phone widths */}
          <button
            ref={openerRef}
            type="button"
            className="tl-menu-toggle"
            aria-label={nav.menu}
            aria-expanded={open}
            aria-controls="tl-menu-drawer"
            onClick={() => setOpen(true)}
          >
            <Menu size={18} aria-hidden="true" /><span>{nav.menu}</span>
          </button>
        </div>
      </div>
    </header>
      {open && (
        <div className="tl-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="tl-drawer" id="tl-menu-drawer" role="dialog" aria-modal="true" aria-label={nav.label} ref={drawerRef}>
            {/* PRODUCT_TRUTH_DECORATIVE: closes the landing navigation drawer */}
            <button type="button" className="tl-drawer-close" aria-label={nav.closeMenu} onClick={close}><X size={22} aria-hidden="true" /></button>
            <nav className="tl-drawer-nav" aria-label={nav.label}>
              {sectionLinks.map((s) => (
                // PRODUCT_TRUTH_DECORATIVE: in-page anchor to a landing section, or the public guides page (drawer copy of the header link)
                <a key={s.id} href={s.href} onClick={s.page ? (e) => { close(); go(navigate, s.href)(e); } : close}>{s.label}</a>
              ))}
              {/* Drawer = tablet/phone widths: the base narrow-width sign-in label (HE 'כניסה') when the copy has one. */}
              {/* PRODUCT_TRUTH_DECORATIVE: sign-in entry point for existing accounts (drawer copy) */}
              <a href={links.login} onClick={(e) => { close(); go(navigate, links.login)(e); }}><LogIn size={16} aria-hidden="true" />{nav.loginShort || nav.login}</a>
              {onForgotPassword && (
                // PRODUCT_TRUTH_DECORATIVE: opens the existing forgot-password flow (owned by the auth screen)
                <button type="button" onClick={() => { close(); onForgotPassword(); }}><KeyRound size={16} aria-hidden="true" />{nav.forgotPassword}</button>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
