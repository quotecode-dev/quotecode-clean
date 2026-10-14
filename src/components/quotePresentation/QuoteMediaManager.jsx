// Task 16 - quote images (Modern / Visual): upload, caption, role, bind to an item row, reorder (buttons, keyboard
// accessible), remove from THIS quote (the stored asset is never deleted). Thumbnails use signed URLs from the
// quote-presentation function. In Classic the images stay in the draft and are noted as shown in Modern / Visual.
import { useId, useRef } from 'react';
import { ArrowUp, ArrowDown, X, ImagePlus } from 'lucide-react';
import { imagesShownFor, itemKeyOptions, moveMedia, removeMediaAt, updateMediaAt, MAX_MEDIA_REFS, MAX_CAPTION_LENGTH } from './presentationState';
import { uploadErrorMessage } from './presentationCopy';

const blockEnter = (e) => { if (e.key === 'Enter') e.preventDefault(); }; // never submit the surrounding quote form

function Thumb({ url, label, copy }) {
  if (url === undefined) return <span className="qp-thumb" aria-hidden="true">{copy.thumbLoading}</span>;
  if (!url) return <span className="qp-thumb" role="img" aria-label={`${label} - ${copy.thumbMissing}`}>{copy.thumbMissing}</span>;
  return <img className="qp-thumb" src={url} alt={label} loading="lazy" decoding="async" />;
}

export default function QuoteMediaManager({ ctl, items, readOnly = false }) {
  const { copy, lang, value, urls, uploading, uploadError } = ctl;
  const fileRef = useRef(null);
  const uid = useId();
  const media = value.media;
  const options = itemKeyOptions(items);
  const optionKeys = new Set(options.map((o) => o.key));
  const showsImages = imagesShownFor(ctl.shownStyle);
  const full = media.length >= MAX_MEDIA_REFS;
  // stable keys that follow an image when it is reordered or its role changes (focus stays on the moved control)
  const seenAssets = new Map();
  const keys = media.map((m) => { const n = (seenAssets.get(m.assetId) || 0) + 1; seenAssets.set(m.assetId, n); return `${m.assetId}#${n}`; });

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) await ctl.upload(file);
  };

  return (
    <div className="qp-section" data-testid="qp-media">
      <h4 className="qp-section-title">{copy.imagesTitle}</h4>
      <p className="qp-hint">{copy.imagesHint}</p>
      {!showsImages && media.length > 0 && (
        <p className="qp-notice" role="note" data-testid="qp-media-classic-note">{copy.imagesClassicNote}</p>
      )}
      {!readOnly && (
        <div className="qp-row" style={{ marginTop: 8 }}>
          <input ref={fileRef} id={`${uid}-file`} className="qp-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} tabIndex={-1} aria-hidden="true" data-testid="qp-media-file" />
          {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
          <button type="button" className="qp-btn" disabled={uploading || full} onClick={() => fileRef.current?.click()} data-testid="qp-media-upload">
            <ImagePlus size={14} aria-hidden="true" />{uploading ? copy.uploading : copy.upload}
          </button>
          <span className="qp-hint">{media.length}/{MAX_MEDIA_REFS}</span>
        </div>
      )}
      {uploadError && (
        <p className="qp-notice qp-notice--error" role="alert" data-testid="qp-media-error">{uploadErrorMessage(lang, uploadError.code)}</p>
      )}
      {media.length === 0 ? (
        <p className="qp-hint" style={{ marginTop: 8 }}>{copy.noImages}</p>
      ) : (
        <ol className="qp-media-list" aria-label={copy.imagesTitle}>
          {media.map((m, i) => {
            const label = m.caption || copy.imageN(i + 1);
            const fid = `${uid}-${i}`;
            const itemMissing = m.role === 'item' && m.itemKey && !optionKeys.has(m.itemKey);
            return (
              <li key={keys[i]} className="qp-media-item" data-testid={`qp-media-item-${i}`}>
                <Thumb url={urls[m.assetId]} label={label} copy={copy} />
                <div className="qp-media-fields">
                  <div className="qp-field">
                    <label htmlFor={`${fid}-cap`}>{copy.caption}</label>
                    <input id={`${fid}-cap`} className="qp-input" type="text" maxLength={MAX_CAPTION_LENGTH} value={m.caption} disabled={readOnly}
                      onKeyDown={blockEnter} onChange={(e) => ctl.update((cur) => updateMediaAt(cur, i, { caption: e.target.value }))} />
                  </div>
                  <div className="qp-row">
                    <div className="qp-field" style={{ flex: '1 1 140px' }}>
                      <label htmlFor={`${fid}-role`}>{copy.role}</label>
                      <select id={`${fid}-role`} className="qp-select" value={m.role} disabled={readOnly}
                        onChange={(e) => {
                          const role = e.target.value;
                          ctl.update((cur) => updateMediaAt(cur, i, role === 'item' ? { role, itemKey: m.itemKey || options[0]?.key || null } : { role }));
                        }}>
                        <option value="hero">{copy.roleHero}</option>
                        <option value="support">{copy.roleSupport}</option>
                        <option value="item" disabled={options.length === 0}>{copy.roleItem}</option>
                      </select>
                    </div>
                    {m.role === 'item' && (
                      <div className="qp-field" style={{ flex: '2 1 180px' }}>
                        <label htmlFor={`${fid}-item`}>{copy.boundItem}</label>
                        <select id={`${fid}-item`} className="qp-select" value={m.itemKey || ''} disabled={readOnly}
                          onChange={(e) => ctl.update((cur) => updateMediaAt(cur, i, { itemKey: e.target.value || null }))}>
                          {!m.itemKey && <option value="">{copy.chooseItem}</option>}
                          {itemMissing && <option value={m.itemKey}>{m.itemKey}</option>}
                          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {itemMissing && <p className="qp-notice qp-notice--warn" role="note">{copy.itemMissing}</p>}
                  {!readOnly && (
                    <div className="qp-media-actions">
                      {/* PRODUCT_TRUTH_DECORATIVE: moves an image one position earlier in this quote's image order */}
                      <button type="button" className="qp-btn qp-btn--icon" disabled={i === 0} aria-label={`${copy.moveUp}: ${label}`} onClick={() => ctl.update((cur) => moveMedia(cur, i, -1))} data-testid={`qp-media-up-${i}`}>
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      {/* PRODUCT_TRUTH_DECORATIVE: moves an image one position later in this quote's image order */}
                      <button type="button" className="qp-btn qp-btn--icon" disabled={i === media.length - 1} aria-label={`${copy.moveDown}: ${label}`} onClick={() => ctl.update((cur) => moveMedia(cur, i, 1))} data-testid={`qp-media-down-${i}`}>
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                      {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
                      <button type="button" className="qp-btn qp-btn--danger" aria-label={`${copy.removeFromQuote}: ${label}`} title={copy.removeHint} onClick={() => ctl.update((cur) => removeMediaAt(cur, i))} data-testid={`qp-media-remove-${i}`}>
                        <X size={14} aria-hidden="true" />{copy.removeFromQuote}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {!readOnly && media.length > 0 && <p className="qp-hint" style={{ marginTop: 6 }}>{copy.removeHint}</p>}
    </div>
  );
}
