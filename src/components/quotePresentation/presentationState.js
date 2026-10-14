// Task 16 - Quote Experience V2: the creator's presentation draft state (pure, framework-free, unit-tested).
//
// Shape (lives in Dashboard quote state and in the durable local draft payload as `quotePresentation`):
//   { style: null | 'classic' | 'modern' | 'visual',   // per-quote override; null = use the business default
//     media: MediaRef[],                                  // CONTRACT section 2 MediaRef (assetId, caption, alt, role, itemKey, order)
//     detail: null | 'compact' | 'expanded' }             // preview/output default only - never a paid tier
// Nothing here talks to the network; quotePresentationClient.js is the only transport.
import { normalizeStyleId, styleSupportsImages, isStyleIncluded, resolveEffectiveStyle } from '../../quoteDocument/quoteStyles';

export const MAX_MEDIA_REFS = 12; // = quote-presentation MAX_MEDIA_REFS (server re-validates)
export const MAX_CAPTION_LENGTH = 140; // = quote-presentation MAX_TEXT_LENGTH
export const MEDIA_ROLES = Object.freeze(['hero', 'support', 'item']);
export const DETAIL_MODES = Object.freeze(['compact', 'expanded']);

export const PRISTINE_PRESENTATION = Object.freeze({ style: null, media: Object.freeze([]), detail: null });

export function createPristinePresentation() {
  return { style: null, media: [], detail: null };
}

// Same rule as QuoteMedia.normalizeItemKey / the server: trim, collapse whitespace, lowercase; '' -> null.
export function normalizeItemKey(text) {
  if (typeof text !== 'string') return null;
  const key = text.trim().replace(/\s+/g, ' ').toLowerCase();
  return key ? key : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.slice(0, MAX_CAPTION_LENGTH) : '';
}

function normalizeMediaRef(raw, index) {
  if (!raw || typeof raw !== 'object' || typeof raw.assetId !== 'string' || !raw.assetId) return null;
  const role = MEDIA_ROLES.includes(raw.role) ? raw.role : 'support';
  const itemKey = normalizeItemKey(raw.itemKey);
  return {
    assetId: raw.assetId,
    caption: cleanText(raw.caption),
    alt: cleanText(raw.alt),
    role: role === 'item' && !itemKey ? 'support' : role,
    itemKey: role === 'item' ? itemKey : null,
    order: index,
  };
}

// Accepts anything (old drafts, server records, garbage) and returns a valid state. Never throws.
export function normalizePresentationState(raw) {
  if (!raw || typeof raw !== 'object') return createPristinePresentation();
  const seen = new Set();
  const media = [];
  (Array.isArray(raw.media) ? raw.media : [])
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.m?.order) ? a.m.order : a.i;
      const bo = Number.isFinite(b.m?.order) ? b.m.order : b.i;
      return ao - bo || a.i - b.i;
    })
    .forEach(({ m }) => {
      const ref = normalizeMediaRef(m, media.length);
      if (!ref) return;
      const k = `${ref.assetId}|${ref.itemKey || ''}|${ref.role}`;
      if (seen.has(k) || media.length >= MAX_MEDIA_REFS) return;
      seen.add(k);
      media.push(ref);
    });
  const out = {
    style: normalizeStyleId(raw.style),
    media,
    detail: DETAIL_MODES.includes(raw.detail) ? raw.detail : null,
  };
  // recordKnown: this (existing-quote) value was built on the LOADED saved record, so a restored copy of it is
  // authoritative (the owner's removals / explicit return to the default survive). Only present when true.
  if (raw.recordKnown === true) out.recordKnown = true;
  return out;
}

export function isPristinePresentation(value) {
  const v = normalizePresentationState(value);
  return v.style === null && v.media.length === 0 && v.detail === null;
}

// Equality of what the SERVER stores (style + media). `detail` is local-only.
export function sameServerPresentation(a, b) {
  const x = normalizePresentationState(a);
  const y = normalizePresentationState(b);
  return x.style === y.style && JSON.stringify(toServerMedia(x.media)) === JSON.stringify(toServerMedia(y.media));
}

// The exact MediaRef list sent to save_quote (no local-only fields, contiguous order).
export function toServerMedia(media) {
  return normalizePresentationState({ media }).media.map((m, i) => ({
    assetId: m.assetId, caption: m.caption.trim(), alt: (m.alt || m.caption).trim(), role: m.role, itemKey: m.itemKey, order: i,
  }));
}

const reindex = (list) => list.map((m, i) => ({ ...m, order: i }));

export function addMedia(state, ref) {
  const s = normalizePresentationState(state);
  if (s.media.length >= MAX_MEDIA_REFS) return { state: s, added: false, reason: 'too_many_media' };
  const next = normalizePresentationState({ ...s, media: [...s.media, { ...ref, order: s.media.length }] });
  return { state: next, added: next.media.length > s.media.length, reason: next.media.length > s.media.length ? null : 'duplicate' };
}

export function removeMediaAt(state, index) {
  const s = normalizePresentationState(state);
  return { ...s, media: reindex(s.media.filter((_, i) => i !== index)) };
}

export function moveMedia(state, index, delta) {
  const s = normalizePresentationState(state);
  const to = index + delta;
  if (index < 0 || index >= s.media.length || to < 0 || to >= s.media.length) return s;
  const list = s.media.slice();
  const [m] = list.splice(index, 1);
  list.splice(to, 0, m);
  return { ...s, media: reindex(list) };
}

export function updateMediaAt(state, index, patch) {
  const s = normalizePresentationState(state);
  if (index < 0 || index >= s.media.length) return s;
  const cur = s.media[index];
  const merged = { ...cur, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'caption')) {
    merged.caption = cleanText(patch.caption);
    // alt follows the caption unless the owner gave a distinct alt text
    if (!Object.prototype.hasOwnProperty.call(patch, 'alt') && (!cur.alt || cur.alt === cur.caption)) merged.alt = merged.caption;
  }
  if (merged.role !== 'item') merged.itemKey = null;
  const list = s.media.slice();
  list[index] = merged;
  return { ...s, media: reindex(list) };
}

// Catalog -> quote: an item added from a catalog service that has a linked image gets that image bound to its row.
// Idempotent (the same asset bound to the same row is never added twice).
export function bindCatalogMedia(state, { assetId, caption = '', description }) {
  const itemKey = normalizeItemKey(description);
  if (!assetId || !itemKey) return { state: normalizePresentationState(state), added: false, reason: 'invalid' };
  const s = normalizePresentationState(state);
  if (s.media.some((m) => m.assetId === assetId && m.itemKey === itemKey)) return { state: s, added: false, reason: 'duplicate' };
  return addMedia(s, { assetId, caption, alt: caption, role: 'item', itemKey });
}

// Item options for binding: one per distinct non-empty normalized description, in item order.
export function itemKeyOptions(items) {
  const out = [];
  const seen = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    const key = normalizeItemKey(it?.description);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: String(it.description).trim() });
  }
  return out;
}

// What the creator is showing / will issue. Mirrors the server: draft override -> business default -> Classic.
export function resolveCreatorStyle({ presentation, businessDefault, tier }) {
  const s = normalizePresentationState(presentation);
  return resolveEffectiveStyle({ draftStyle: s.style, businessDefault, tierId: tier });
}

// Non-destructive downgrade notice: the draft keeps a style the current tier no longer includes.
export function needsDowngradeNotice({ presentation, tier }) {
  const s = normalizePresentationState(presentation);
  return !!s.style && !isStyleIncluded(tier, s.style);
}

export function imagesShownFor(style) {
  return styleSupportsImages(style);
}

// Something the SERVER stores (style override or images). `detail` is local-only and never a reason to call the server.
export function hasServerContent(value) {
  const v = normalizePresentationState(value);
  return v.style !== null || v.media.length > 0;
}
