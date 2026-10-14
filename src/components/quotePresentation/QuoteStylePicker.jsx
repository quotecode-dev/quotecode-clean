// Task 16 - Classic / Modern / Visual style cards. Used by the creator ("Use for this quote" + "Make default") and by
// Settings ("Default quote style", default mode). A style outside the presentation tier shows a lock icon + text (never
// color only); activating it calls onLockedSelect (explanation/preview) and never changes the selection or the default.
import { Lock, Check, Star, Eye } from 'lucide-react';
import { QUOTE_STYLE_IDS, STYLE_COPY, isStyleIncluded } from '../../quoteDocument/quoteStyles';
import { presentationCopy } from './presentationCopy';

export default function QuoteStylePicker({
  lang = 'en',
  tier = 'classic',
  mode = 'quote', // 'quote' | 'default'
  selectedStyle = null, // quote mode: the draft override (null = follows the default); default mode: the business default
  effectiveStyle = null, // quote mode: what the quote shows (override -> default -> Classic)
  businessDefault = null,
  readOnly = false,
  tierKnown = true, // false while the presentation context is loading/unavailable: no locks, no changes
  busyStyle = null,
  onSelect,
  onMakeDefault,
  onLockedSelect,
  // Task 26 (Settings): called on EVERY activation (included or locked, default or not) so the caller can show that style in its live
  // preview; `previewedStyle` marks the card shown there. Both optional - the creator does not pass them.
  onActivate,
  previewedStyle = null,
  idPrefix = 'qp-style',
}) {
  const copy = presentationCopy(lang);
  const styleCopy = lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en;
  const labelId = `${idPrefix}-label`;
  return (
    <div role="group" aria-labelledby={labelId}>
      <h4 id={labelId} className={mode === 'default' ? 'qp-section-title' : 'qp-sr'}>{mode === 'default' ? copy.settingsTitle : copy.styleGroupLabel}</h4>
      <div className="qp-cards">
        {QUOTE_STYLE_IDS.map((style) => {
          const included = isStyleIncluded(tier, style);
          const isDefault = businessDefault === style || (!businessDefault && style === 'classic');
          const pressed = mode === 'default' ? isDefault : (effectiveStyle === style);
          const isOverride = mode === 'quote' && selectedStyle === style;
          const c = styleCopy[style];
          const previewed = previewedStyle === style;
          const activate = () => {
            if (readOnly || !tierKnown) return;
            if (onActivate) onActivate(style);
            if (!included) { if (onLockedSelect) onLockedSelect(style); return; }
            if (mode === 'default') { if (onMakeDefault && !isDefault) onMakeDefault(style); return; }
            if (onSelect) onSelect(style);
          };
          const cardProps = {
            className: 'qp-card-main',
            'aria-pressed': pressed,
            disabled: !tierKnown || (readOnly && !pressed),
            onClick: activate,
            'data-testid': `${idPrefix}-select-${style}`,
          };
          const cardBody = (
            <>
              {tierKnown && !included && (
                <span className="qp-lock-badge" data-testid={`${idPrefix}-locked-${style}`}>
                  <Lock size={10} aria-hidden="true" />{copy.lockedShort}
                  <span className="qp-sr"> — {copy.locked}</span>
                </span>
              )}
              <span aria-hidden="true" className={`qp-mini qp-mini--${style}`} />
              <span className="qp-card-title">{c.title}</span>
              <small className="qp-card-desc">{copy.cardShort[style]}</small>
              {(tierKnown && isDefault) || (mode === 'quote' && pressed) || previewed ? (
                <span className="qp-card-meta">
                  {mode === 'quote' && pressed && (
                    <span className="qp-card-state"><Check size={11} aria-hidden="true" />{isOverride ? copy.usedForQuote : copy.followsDefault}</span>
                  )}
                  {tierKnown && isDefault && (mode === 'default' || isOverride || !pressed) && (
                    <span className="qp-card-default"><Star size={11} aria-hidden="true" />{copy.isDefault}</span>
                  )}
                  {previewed && (
                    <span className="qp-card-state" data-testid={`${idPrefix}-previewed-${style}`}><Eye size={11} aria-hidden="true" />{copy.previewing}</span>
                  )}
                </span>
              ) : null}
              <span className="qp-sr">{mode === 'default' ? copy.makeDefault : copy.useForQuote}. {c.description}</span>
            </>
          );
          return (
            <div key={style} className={`qp-card${pressed ? ' is-selected' : ''}${previewed ? ' is-previewed' : ''}${tierKnown && !included ? ' is-locked' : ''}`} data-testid={`${idPrefix}-card-${style}`}>
              {mode === 'default' ? (
                // PRODUCT_TRUTH_CAPABILITY: business_settings
                <button type="button" {...cardProps}>{cardBody}</button>
              ) : (
                // PRODUCT_TRUTH_CAPABILITY: quote_create
                <button type="button" {...cardProps}>{cardBody}</button>
              )}
              {mode === 'quote' && onMakeDefault && tierKnown && included && !isDefault && !readOnly && (
                <div className="qp-card-foot">
                  {/* PRODUCT_TRUTH_CAPABILITY: business_settings */}
                  <button type="button" className="qp-btn qp-btn--ghost" disabled={busyStyle === style} onClick={() => onMakeDefault(style)} data-testid={`${idPrefix}-default-${style}`}>
                    <Star size={12} aria-hidden="true" />{copy.makeDefault}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
