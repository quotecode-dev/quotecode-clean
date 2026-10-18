// Task 16 - Quote Experience V2: customer-facing quote media (Modern rail, Visual hero, row thumbnail).
// Pure presentation: no network. The ONE control: a tap / click on an image opens it large over the page (Owner console 2026-10-18 ("והאם הלקוח יכול ללחוץ על התמונה בכדי להגדיל אותה?" -> "כן בטח להוסיף")) -
// screen only: the overlay lives outside the document card (never in the Direct PDF) and is hidden in print; the invisible zoom
// button lies OVER the image (the <img> stays the frame's direct child, as the PDF cover step expects). Media items are the public_get shape
// `{ url|null, caption, alt, role: 'hero'|'support'|'item', itemKey, missing }` (CONTRACT section 3).
// No media => every component renders null (the page omits the media area; no empty boxes, no "no images" copy).
// A missing / unreadable image => neutral tile + kept caption + short localized "image unavailable" label.
// Every <img> is capture-safe for the PDF path: crossOrigin anonymous, eager, async decode, fixed aspect box.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './quoteMedia.css';

import { MEDIA_UNAVAILABLE_LABEL, RAIL_MAX_ITEMS, HERO_MAX_SUPPORTS } from './quoteMediaModel';

function usableMedia(media) {
  if (!Array.isArray(media)) return [];
  const list = media.filter((m) => m && typeof m === 'object');
  // Stable order: explicit `order` when present, otherwise the given sequence.
  return list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.m.order) ? a.m.order : a.i;
      const bo = Number.isFinite(b.m.order) ? b.m.order : b.i;
      return ao - bo || a.i - b.i;
    })
    .map((x) => x.m);
}

function unavailableLabel(isHebrew) {
  return isHebrew ? MEDIA_UNAVAILABLE_LABEL.he : MEDIA_UNAVAILABLE_LABEL.en;
}

function textOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// The enlarged image over the page: Esc / the X / a click outside the image closes it; focus moves to X and returns to the image.
function ImageLightbox({ url, alt, caption, isHebrew, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  const closeLabel = isHebrew ? 'סגירת התמונה' : 'Close image';
  return createPortal(
    // PRODUCT_TRUTH_DECORATIVE: the enlarged-image backdrop - a click outside the image closes the screen-only viewer
    <div className="pq-lightbox no-print" data-html2canvas-ignore="true" role="dialog" aria-modal="true" aria-label={alt || (isHebrew ? 'תמונה' : 'Image')}
      dir={isHebrew ? 'rtl' : 'ltr'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* PRODUCT_TRUTH_DECORATIVE: closes the enlarged image view (screen-only image viewer) */}
      <button type="button" ref={closeRef} className="pq-lightbox-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>×</button>
      {/* PRODUCT_TRUTH_DECORATIVE: a click beside the enlarged image (not on it) closes the screen-only viewer */}
      <figure className="pq-lightbox-figure" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img className="pq-lightbox-img" src={url} alt={alt} referrerPolicy="no-referrer" />
        {caption ? <figcaption className="pq-lightbox-caption">{caption}</figcaption> : null}
      </figure>
    </div>,
    document.body,
  );
}

// One image inside a fixed-ratio frame. Falls back to the neutral tile when missing or when loading fails.
function MediaFrame({ item, isHebrew, width, height, frameClass, showLabel = true }) {
  const url = typeof item.url === 'string' && item.url ? item.url : null;
  const [failedUrl, setFailedUrl] = useState(null);
  const missing = item.missing === true || !url || failedUrl === url;
  const alt = textOf(item.alt) || textOf(item.caption);
  const label = unavailableLabel(isHebrew);
  const [open, setOpen] = useState(false);

  if (missing) {
    return (
      <span
        className={`pq-media-frame pq-media-missing ${frameClass || ''}`.trim()}
        data-pq-media-state="missing"
        role="img"
        aria-label={alt ? `${alt} - ${label}` : label}
      >
        {showLabel ? (
          <span className="pq-media-missing-label">{label}</span>
        ) : (
          <span className="pq-media-sr">{label}</span>
        )}
      </span>
    );
  }

  return (
    <span className={`pq-media-frame ${frameClass || ''}`.trim()} data-pq-media-state="ok">
      <img
        className="pq-media-img"
        src={url}
        alt={alt}
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailedUrl(url)}
      />
      {/* PRODUCT_TRUTH_DECORATIVE: opens this quote image large over the page (a screen-only image viewer) */}
      <button type="button" className="pq-media-zoom no-print" data-html2canvas-ignore="true" onClick={() => setOpen(true)}
        aria-label={isHebrew ? `הגדלת התמונה${alt ? `: ${alt}` : ''}` : `Enlarge image${alt ? `: ${alt}` : ''}`} />
      {open ? <ImageLightbox url={url} alt={alt} caption={textOf(item.caption)} isHebrew={isHebrew} onClose={() => setOpen(false)} /> : null}
    </span>
  );
}

// MODERN: a calm row of product images (3 per row; 2 per row when narrow), captions below each image.
export function QuoteMediaRail({ media, isHebrew }) {
  const items = usableMedia(media).slice(0, RAIL_MAX_ITEMS);
  if (!items.length) return null;
  return (
    <section
      className="pq-media pq-media-rail"
      dir={isHebrew ? 'rtl' : 'ltr'}
      data-pq-media-count={items.length}
    >
      <div className="pq-media-rail-grid">
        {items.map((item, i) => {
          const caption = textOf(item.caption);
          return (
            <figure className="pq-media-figure pq-media-rail-figure" key={`${item.url || 'missing'}-${i}`}>
              <MediaFrame item={item} isHebrew={isHebrew} width={800} height={600} frameClass="pq-media-ratio" />
              {caption ? <figcaption className="pq-media-caption">{caption}</figcaption> : null}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

// VISUAL: one primary image (role 'hero', else the first) with its caption, plus up to 4 supporting images.
export function QuoteMediaHero({ media, isHebrew }) {
  const items = usableMedia(media);
  if (!items.length) return null;
  const hero = items.find((m) => m.role === 'hero') || items[0];
  const supports = items
    .filter((m) => m !== hero && (m.role === 'support' || m.role === 'item' || !m.role))
    .slice(0, HERO_MAX_SUPPORTS);
  const heroCaption = textOf(hero.caption);
  const sideClass = supports.length === 0 ? 'pq-media-hero--solo' : supports.length > 2 ? 'pq-media-hero--grid' : 'pq-media-hero--stack';
  return (
    <section
      className={`pq-media pq-media-hero ${sideClass}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      data-pq-media-count={1 + supports.length}
    >
      <div className="pq-media-hero-layout">
        <figure className="pq-media-figure pq-media-hero-main">
          <MediaFrame item={hero} isHebrew={isHebrew} width={1600} height={1200} frameClass="pq-media-ratio" />
          {heroCaption ? <figcaption className="pq-media-caption pq-media-hero-caption">{heroCaption}</figcaption> : null}
        </figure>
        {supports.length ? (
          <div className="pq-media-hero-side">
            {supports.map((item, i) => {
              const caption = textOf(item.caption);
              return (
                <figure className="pq-media-figure pq-media-hero-support" key={`${item.url || 'missing'}-${i}`}>
                  <MediaFrame item={item} isHebrew={isHebrew} width={800} height={600} frameClass="pq-media-ratio" />
                  {caption ? <figcaption className="pq-media-caption">{caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

// Row thumbnail: rendered INSIDE the item description cell (never as a table column). 48px square.
export function QuoteItemThumb({ image, isHebrew }) {
  if (!image || typeof image !== 'object') return null;
  return (
    <span className="pq-media pq-media-thumb" dir={isHebrew ? 'rtl' : 'ltr'}>
      <MediaFrame item={image} isHebrew={isHebrew} width={96} height={96} frameClass="pq-media-thumb-frame" showLabel={false} />
    </span>
  );
}
