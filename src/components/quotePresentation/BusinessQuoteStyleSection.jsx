// Task 16 - Settings: "Default quote style". The same picker in default mode; only styles included in the presentation
// tier can become the default (set_default is also enforced by the server).
// Task 26 (Owner correction 2026-10-11): this is the QUOTE design section. Choosing any of the three styles shows the approved sample quote
// in that style immediately below (SettingsQuotePreview, the real renderer) - no save and no leaving the screen needed. An included style
// still becomes the business default exactly as before; a style outside the tier is shown "preview only" and never becomes the default.
// It affects quote previews / produced quotes only - never the digital business card or reminders.
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { STYLE_COPY, isStyleIncluded } from '../../quoteDocument/quoteStyles';
import QuoteStylePicker from './QuoteStylePicker';
import SettingsQuotePreview from './SettingsQuotePreview';
import { QP_VARS } from './qpTheme';
import { presentationErrorMessage } from './presentationCopy';
import './quotePresentation.css';

export default function BusinessQuoteStyleSection({ ctl }) {
  const { copy, lang, context, tier } = ctl;
  const [msg, setMsg] = useState(null);
  const [busyStyle, setBusyStyle] = useState(null);
  const [previewed, setPreviewed] = useState(null); // null = follows the business default
  const title = (s) => (lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en)[s]?.title || s;
  const shown = previewed || ctl.businessDefault || 'classic';

  const makeDefault = async (style) => {
    setBusyStyle(style);
    setMsg(null);
    const r = await ctl.makeDefault(style);
    setBusyStyle(null);
    if (r.ok) setMsg({ kind: 'ok', text: copy.defaultSaved(title(style)) });
    else setMsg({ kind: 'error', text: copy.defaultFailed(presentationErrorMessage(lang, r.code)) });
  };

  return (
    <section className="qp-root qp-panel" dir={lang === 'he' ? 'rtl' : 'ltr'} style={QP_VARS} data-testid="qp-settings-default-style">
      <p className="qp-hint" style={{ marginTop: 0, marginBottom: 8 }}>{copy.settingsHint}</p>
      {context.status === 'ready' && <p className="qp-review-note">{copy.entitlement[tier] || copy.entitlement.classic}</p>}
      {context.status === 'error' ? (
        <p className="qp-notice" role="alert">
          {copy.contextError}{' '}
          {/* PRODUCT_TRUTH_DECORATIVE: retries loading the appearance settings (read-only request) */}
          <button type="button" className="qp-btn qp-btn--ghost" onClick={ctl.reloadContext}><RefreshCw size={12} aria-hidden="true" />{copy.retry}</button>
        </p>
      ) : context.status !== 'ready' ? (
        <p className="qp-hint" role="status">{copy.contextLoading}</p>
      ) : (
        <>
          <QuoteStylePicker
            lang={lang}
            tier={tier}
            mode="default"
            selectedStyle={ctl.businessDefault}
            businessDefault={ctl.businessDefault}
            busyStyle={busyStyle}
            onMakeDefault={makeDefault}
            onLockedSelect={() => {}}
            onActivate={setPreviewed}
            previewedStyle={shown}
            idPrefix="qp-default-style"
          />
          {msg && <p className={`qp-notice${msg.kind === 'error' ? ' qp-notice--error' : ''}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
          <SettingsQuotePreview lang={lang} style={shown} locked={!isStyleIncluded(tier, shown)} copy={copy} />
        </>
      )}
    </section>
  );
}
