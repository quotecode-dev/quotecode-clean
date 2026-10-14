// Task 26 (Owner correction 2026-10-11) - Business settings → quote design: the live preview of the chosen QUOTE style. It renders the
// REAL customer page (PublicQuote for HE / Local - ILS, PublicQuoteEn for EN / International - SmartPublicQuote's rule) in `previewMode`
// with the approved synthetic sample quote of /sample-quote (src/quoteDocument/sampleQuotes.js: every amount computed by the app's own save
// rules), so the preview is the produced document, not a mock. Same renderer and device rule as the creator preview (Task 16 plan §6,
// QuotePreviewPane): where the space is narrower than a phone, the document is laid out at the 390px phone width and scaled to fit. View-only: nothing is approved, sent or saved, and it never touches the business card.
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import PublicQuote from '../../pages/PublicQuote';
import PublicQuoteEn from '../../pages/PublicQuoteEn';
import { buildSampleQuote } from '../../quoteDocument/sampleQuotes';
import { STYLE_COPY } from '../../quoteDocument/quoteStyles';

const PHONE_WIDTH = 390; // the creator preview's mobile device width

class PreviewBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('[settings-quote-preview] render failed', err?.message); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function SettingsQuotePreview({ lang, style, locked, copy }) {
  const sample = useMemo(() => buildSampleQuote({ locale: lang === 'he' ? 'he' : 'en', style }), [lang, style]);
  const Page = lang === 'he' ? PublicQuote : PublicQuoteEn;
  const scrollRef = useRef(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setAvail(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const phone = avail > 0 && avail < PHONE_WIDTH;
  const zoom = phone ? Math.max(0.5, avail / PHONE_WIDTH) : 1;
  return (
    <section className="qp-settings-preview" aria-labelledby="qp-settings-preview-title" data-testid="qp-settings-preview" data-preview-style={sample.style}>
      <div className="qp-settings-preview-head">
        <h4 id="qp-settings-preview-title" className="qp-panel-title" style={{ margin: 0 }}>{copy.settingsPreviewTitle} · {(lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en)[sample.style]?.title || sample.style}</h4>
      </div>
      <p className={`qp-preview-label${locked ? ' qp-preview-label--locked' : ''}`} role="status" data-testid="qp-settings-preview-label">
        {locked ? copy.previewOnlyLabel : copy.settingsPreviewNote}
      </p>
      <div className="qp-preview-scroll" ref={scrollRef}>
        <div className={`qp-device qp-device--${phone ? 'mobile' : 'desktop'}`} style={zoom !== 1 ? { zoom, maxWidth: 'none' } : undefined} data-preview-device={phone ? 'mobile' : 'desktop'}>
          <PreviewBoundary resetKey={sample.style} fallback={<p className="qp-preview-empty" role="alert">{copy.previewFailed}</p>}>
            <Page quoteData={sample.quoteData} presentation={sample.presentation} previewMode />
          </PreviewBoundary>
        </div>
      </div>
    </section>
  );
}
