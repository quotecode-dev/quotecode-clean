// Task 16 - pure media helpers shared by QuoteMedia.jsx, the quote pages, sample fixtures and the creator.
// Kept out of the component module so React fast refresh stays component-only.
export const MEDIA_UNAVAILABLE_LABEL = Object.freeze({
  he: 'תמונה אינה זמינה',
  en: 'Image unavailable',
});

export const RAIL_MAX_ITEMS = 6;
export const HERO_MAX_SUPPORTS = 4;

// itemKey = item description normalized (trim, collapse whitespace, lowercase). null for empty / non-string.
export function normalizeItemKey(text) {
  if (typeof text !== 'string') return null;
  const key = text.trim().replace(/\s+/g, ' ').toLowerCase();
  return key ? key : null;
}

// The image bound to a quote row: the first media whose itemKey matches the row description.
// Role 'item' is the intended binding; any role with a matching itemKey also binds.
export function mediaForItem(media, description) {
  const key = normalizeItemKey(description);
  if (!key || !Array.isArray(media)) return null;
  const matches = media.filter((m) => m && typeof m === 'object' && normalizeItemKey(m.itemKey) === key);
  return matches.find((m) => m.role === 'item') || matches[0] || null;
}
