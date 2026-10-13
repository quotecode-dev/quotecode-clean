// Task 16 - Quote Experience V2: customer-facing quote media (Modern rail, Visual hero, row thumbnail).
// Pure presentation: no network, no interactive controls. Media items are the public_get shape
// `{ url|null, caption, alt, role: 'hero'|'support'|'item', itemKey, missing }` (CONTRACT section 3).
// No media => every component renders null (the page omits the media area; no empty boxes, no "no images" copy).
// A missing / unreadable image => neutral tile + kept caption + short localized "image unavailable" label.
// Every <img> is capture-safe for the PDF path: crossOrigin anonymous, eager, async decode, fixed aspect box.
import { useState } from 'react';
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

// One image inside a fixed-ratio frame. Falls back to the neutral tile when missing or when loading fails.
function MediaFrame({ item, isHebrew, width, height, frameClass, showLabel = true }) {
  const url = typeof item.url === 'string' && item.url ? item.url : null;
  const [failedUrl, setFailedUrl] = useState(null);
  const missing = item.missing === true || !url || failedUrl === url;
  const alt = textOf(item.alt) || textOf(item.caption);
  const label = unavailableLabel(isHebrew);

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
