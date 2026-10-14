// Task 16 - creator live preview. Renders the SAME customer page (PublicQuote for the HE/ILS market, PublicQuoteEn
// otherwise - SmartPublicQuote's rule) with `previewMode` and a DTO built from editor state. The device toggle is a
// plain width container (no iframe), so switching size, orientation or layout never resets any state.
import { Component, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone, FileText, X, EyeOff } from 'lucide-react';
import PublicQuote from '../../pages/PublicQuote';
import PublicQuoteEn from '../../pages/PublicQuoteEn';
import { STYLE_COPY } from '../../quoteDocument/quoteStyles';

const DEVICE_WIDTH = { desktop: null, mobile: 390, a4: 794 };

class PreviewBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error('[quote-preview] render failed', err?.message); }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function QuotePreviewPane({ ctl, previewData, mode = 'split', onClose, onHide, headingRef }) {
  const { copy, lang, ui } = ctl;
  const deferred = useDeferredValue(previewData);
  const scrollRef = useRef(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setAvail(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const device = ui.device in DEVICE_WIDTH ? ui.device : 'desktop';
  const frameW = DEVICE_WIDTH[device];
  const zoom = frameW && avail > 0 && avail < frameW ? Math.max(0.3, avail / frameW) : 1;
  const styleName = (lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en)[ctl.shownStyle]?.title || ctl.shownStyle;
  const devices = [
    { id: 'desktop', label: copy.deviceDesktop, Icon: Monitor },
    { id: 'mobile', label: copy.deviceMobile, Icon: Smartphone },
    { id: 'a4', label: copy.deviceA4, Icon: FileText },
  ];
  const data = deferred || previewData;
  const Page = data?.isLocal ? PublicQuote : PublicQuoteEn;
  return (
    <section className="qp-preview qp-root" aria-labelledby="qp-preview-heading" dir={lang === 'he' ? 'rtl' : 'ltr'} data-testid="qp-preview">
      <div className="qp-preview-bar">
        <h3 id="qp-preview-heading" ref={headingRef} tabIndex={-1} className="qp-panel-title" style={{ margin: 0 }}>{copy.preview} · {styleName}</h3>
        <div className="qp-row">
          <div className="qp-seg" role="group" aria-label={copy.deviceLabel}>
            {devices.map(({ id, label, Icon }) => (
              // PRODUCT_TRUTH_DECORATIVE: switches the preview width container (desktop / mobile 390 / A4); view-only
              <button key={id} type="button" aria-pressed={device === id} onClick={() => ctl.setDevice(id)} data-testid={`qp-device-${id}`}>
                <Icon size={13} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          {mode === 'split' && onHide && (
            // PRODUCT_TRUTH_DECORATIVE: hides the side-by-side preview column; view-only
            <button type="button" className="qp-btn qp-btn--icon" aria-label={copy.hidePreview} title={copy.hidePreview} onClick={onHide} data-testid="qp-preview-hide">
              <EyeOff size={15} aria-hidden="true" />
            </button>
          )}
          {mode === 'sheet' && onClose && (
            // PRODUCT_TRUTH_DECORATIVE: closes the full-width preview sheet; view-only
            <button type="button" className="qp-btn" onClick={onClose} data-testid="qp-preview-close">
              <X size={15} aria-hidden="true" />{copy.closePreview}
            </button>
          )}
        </div>
      </div>
      {ctl.previewStyle ? (
        <p className={`qp-preview-label${ctl.previewIsLocked ? ' qp-preview-label--locked' : ''}`} role="status" data-testid="qp-preview-only-label">
          {ctl.previewIsLocked ? copy.previewOnlyLabel : copy.preview}
          {' '}
          {/* PRODUCT_TRUTH_DECORATIVE: leaves the style-only preview and returns to the quote's own style */}
          <button type="button" className="qp-btn qp-btn--ghost" onClick={ctl.clearPreviewStyle} data-testid="qp-preview-exit-style">{copy.close}</button>
        </p>
      ) : (
        <p className="qp-preview-label">{copy.previewNote}</p>
      )}
      <div className="qp-preview-scroll" ref={scrollRef}>
        {data ? (
          <div className={`qp-device qp-device--${device}`} style={zoom !== 1 ? { zoom } : undefined} data-preview-device={device}>
            <PreviewBoundary resetKey={`${ctl.shownStyle}|${device}`} fallback={<p className="qp-preview-empty" role="alert">{copy.previewFailed}</p>}>
              <Page quoteData={data.quoteData} presentation={data.presentation} previewMode />
            </PreviewBoundary>
          </div>
        ) : (
          <p className="qp-preview-empty">{copy.contextLoading}</p>
        )}
      </div>
    </section>
  );
}
