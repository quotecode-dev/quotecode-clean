// Task 16 (correction A) - refined "three presentation styles" section (#styles): style tabs (WAI-ARIA tabs,
// keyboard: arrows follow the visual order, Home/End), the style copy from the ONE shared definition (STYLE_COPY in
// src/quoteDocument/quoteStyles.js) and the readable sample document in that style. Commercial plan pricing is not
// part of this presentation-style showcase.
// SSR-safe: no window/document access during render.
// Landing truth (cloud-fix4 A14, ledger L09 / IRON-LANDING-001): outside TEST every account resolves to the Classic
// presentation (supabase/functions/quote-presentation/lib.ts resolveTier -> 'classic'; PRESENTATION_TIERS classic
// includes only 'classic'). So the section opens on Classic - the capability every account has - and labels it as
// such; Modern and Visual stay visible only as illustrations, each tab and panel marked "preview only / not currently
// available" and without the "included" check marks (a demo is not availability). No public link to the
// sample-quote route (ledger L08). No tier is mapped to a plan here.
import { Fragment, useRef, useState } from 'react';
import { CheckCircle2, Eye } from 'lucide-react';
import { QUOTE_STYLE_IDS, STYLE_COPY } from '../../quoteDocument/quoteStyles';
import LandingQuoteDocument from './LandingQuoteDocument';
import { DEFAULT_SHOWCASE_STYLE, isShowcaseStyleAvailable } from './showcaseAvailability';

export default function QuoteStyleShowcase({ locale = 'he', copy }) {
  const lang = locale === 'he' ? 'he' : 'en';
  const isRtl = lang === 'he';
  const styles = STYLE_COPY[lang];
  const [active, setActive] = useState(DEFAULT_SHOWCASE_STYLE);
  const tabRefs = useRef({});

  const focusTab = (id) => {
    setActive(id);
    const el = tabRefs.current[id];
    if (el && typeof el.focus === 'function') el.focus();
  };

  const onTabKeyDown = (e) => {
    const i = QUOTE_STYLE_IDS.indexOf(active);
    const n = QUOTE_STYLE_IDS.length;
    let next = null;
    if (e.key === 'ArrowRight') next = QUOTE_STYLE_IDS[(i + (isRtl ? -1 : 1) + n) % n];
    else if (e.key === 'ArrowLeft') next = QUOTE_STYLE_IDS[(i + (isRtl ? 1 : -1) + n) % n];
    else if (e.key === 'Home') next = QUOTE_STYLE_IDS[0];
    else if (e.key === 'End') next = QUOTE_STYLE_IDS[n - 1];
    if (next) { e.preventDefault(); focusTab(next); }
  };

  const current = styles[active];
  const available = isShowcaseStyleAvailable(active);
  const BenefitIcon = available ? CheckCircle2 : Eye;
  return (
    <section className="tl-section tl-alt" id="styles" aria-labelledby="tl-styles-title" data-task16-showcase={lang}>
      <div className="tl-inner">
        <div className="tl-title">
          <span className="tl-eyebrow">{copy.eyebrow}</span>
          <h2 id="tl-styles-title">{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
        <div className="tl-tabs" role="tablist" aria-label={copy.tablistLabel}>
          {QUOTE_STYLE_IDS.map((id) => (
            <Fragment key={id}>
              {/* PRODUCT_TRUTH_DECORATIVE: public landing style tab - switches which style the sample document shows; no account or quote state */}
              <button
                ref={(el) => { tabRefs.current[id] = el; }}
                type="button"
                role="tab"
                id={`tl-tab-${id}`}
                aria-selected={active === id}
                aria-controls="tl-style-panel"
                tabIndex={active === id ? 0 : -1}
                className="tl-tab"
                onClick={() => setActive(id)}
                onKeyDown={onTabKeyDown}
              >
                {styles[id].title}
                <span className={`tl-tab-badge${isShowcaseStyleAvailable(id) ? ' is-available' : ''}`}>
                  {isShowcaseStyleAvailable(id) ? copy.availableBadge : copy.previewBadge}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        <div className="tl-showcase" role="tabpanel" id="tl-style-panel" aria-labelledby={`tl-tab-${active}`} data-style-availability={available ? 'available' : 'preview-only'}>
          <div className="tl-style-copy">
            {copy.photo && (
              <figure className="tl-style-photo">
                <img src={copy.photo.src} width={copy.photo.width} height={copy.photo.height} loading="lazy" decoding="async" alt={copy.photo.alt} />
              </figure>
            )}
            <h3>{current.title}</h3>
            <p className={`tl-style-status${available ? ' is-available' : ''}`}>{available ? copy.availableBadge : copy.previewNote}</p>
            <p>{current.description}</p>
            <ul className={available ? undefined : 'is-preview'}>
              {current.benefits.map((b) => <li key={b}><BenefitIcon size={17} aria-hidden="true" />{b}</li>)}
            </ul>
            <p className="tl-style-shared">{copy.shared}</p>
          </div>
          <figure className="tl-viewer" aria-label={copy.viewerLabel}>
            <LandingQuoteDocument locale={lang} style={active} />
          </figure>
        </div>
      </div>
    </section>
  );
}
