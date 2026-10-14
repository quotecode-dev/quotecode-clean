// Task 16 - catalog image for one service: attach / replace (upload + catalog_link) and unlink (catalog_link with null;
// the stored asset is never deleted). Linked images are bound automatically to quote rows added from this service.
import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Unlink } from 'lucide-react';
import { uploadPresentationMedia, linkCatalogMedia } from '../../utils/quotePresentationClient';
import { catalogLinkFor } from './useQuotePresentationEditor';
import { uploadErrorMessage, presentationErrorMessage } from './presentationCopy';
import { QP_VARS } from './qpTheme';
import './quotePresentation.css';

export default function CatalogMediaControl({ ctl, service }) {
  const { copy, lang, context, urls } = ctl;
  const link = catalogLinkFor(context.catalog, service.id);
  const fileRef = useRef(null);
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { ensureUrls } = ctl;
  useEffect(() => { if (link?.assetId) ensureUrls([link.assetId]); }, [link?.assetId, ensureUrls]);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(null);
    const up = await uploadPresentationMedia(file);
    if (!up.ok) { setBusy(false); setError(uploadErrorMessage(lang, up.code)); return; }
    const assetId = up.data?.asset?.id || up.data?.asset?.assetId || up.data?.id;
    // L2: never call catalog_link without a real asset id (a null id would UNLINK the current image)
    if (typeof assetId !== 'string' || !assetId) { setBusy(false); setError(presentationErrorMessage(lang, 'invalid_response')); return; }
    const caption = String(service.name || '').trim().slice(0, 140);
    const r = await linkCatalogMedia(service.id, assetId, caption);
    setBusy(false);
    if (!r.ok) { setError(presentationErrorMessage(lang, r.code)); return; }
    ctl.setCatalogLink(service.id, { assetId, caption });
    ensureUrls([assetId]);
  };

  const unlink = async () => {
    setBusy(true); setError(null);
    const r = await linkCatalogMedia(service.id, null, '');
    setBusy(false);
    if (!r.ok) { setError(presentationErrorMessage(lang, r.code)); return; }
    ctl.setCatalogLink(service.id, null);
  };

  if (context.status === 'error') return <p className="qp-notice qp-notice--error" role="alert" style={QP_VARS}>{copy.catalogUnavailable}</p>;
  const url = link ? urls[link.assetId] : null;
  return (
    <div className="qp-root qp-catalog" dir={lang === 'he' ? 'rtl' : 'ltr'} style={QP_VARS} data-testid={`qp-catalog-media-${service.id}`}>
      {link ? (url ? <img className="qp-thumb" src={url} alt={link.caption || service.name} /> : <span className="qp-thumb">{url === null ? copy.thumbMissing : copy.thumbLoading}</span>)
        : <span className="qp-thumb" aria-hidden="true">—</span>}
      <div className="qp-media-fields">
        <p className="qp-hint" style={{ margin: 0 }}>{link ? copy.catalogUsage : copy.catalogNone}</p>
        <div className="qp-media-actions">
          <input ref={fileRef} id={`${uid}-file`} className="qp-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} tabIndex={-1} aria-hidden="true" />
          {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
          <button type="button" className="qp-btn" disabled={busy || context.status !== 'ready'} onClick={() => fileRef.current?.click()} data-testid={`qp-catalog-attach-${service.id}`}>
            <ImagePlus size={13} aria-hidden="true" />{busy ? copy.uploading : (link ? copy.catalogReplace : copy.catalogAttach)}
          </button>
          {link && (
            // PRODUCT_TRUTH_CAPABILITY: catalog
            <button type="button" className="qp-btn qp-btn--danger" disabled={busy} title={copy.catalogRemoveHint} onClick={unlink} data-testid={`qp-catalog-unlink-${service.id}`}>
              <Unlink size={13} aria-hidden="true" />{copy.catalogRemove}
            </button>
          )}
        </div>
        {link && <p className="qp-hint" style={{ margin: 0 }}>{copy.catalogRemoveHint}</p>}
        {error && <p className="qp-notice qp-notice--error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
