// Unified quote (Owner console 2026-11-11, spec docs/SPEC_UNIFIED_COMPLEX_QUOTE_2026-11-12.md): ONE place for the words of a quote's
// groups and rooms. Decision 1: every button uses the word the user chose ("הוספת דירה"); without a choice the fallback is "חלק" /
// "Section"; "יחידה" stays a billing method only. Decision 2: a room is a tag on a row ('all' = the whole place; empty = not stated).

export const GROUP_KINDS = Object.freeze(['apartment', 'room', 'floor', 'section']);

const WORDS = Object.freeze({
  apartment: { he: ['דירה', 'דירות'], en: ['Apartment', 'Apartments'] },
  room: { he: ['חדר', 'חדרים'], en: ['Room', 'Rooms'] },
  floor: { he: ['קומה', 'קומות'], en: ['Floor', 'Floors'] },
  section: { he: ['חלק', 'חלקים'], en: ['Section', 'Sections'] },
});

export function normalizeGroupKind(kind) {
  return GROUP_KINDS.includes(kind) ? kind : 'section';
}

/** the group word: groupWord('apartment', true) -> "דירה"; plural -> "דירות"; English capitalised */
export function groupWord(kind, isHebrew, { plural = false } = {}) {
  const w = WORDS[normalizeGroupKind(kind)][isHebrew ? 'he' : 'en'];
  return plural ? w[1] : w[0];
}

/** a group's default name: "דירה 2" / "Apartment 2" (idx is 0-based) */
export function defaultGroupName(kind, idx, isHebrew) {
  return `${groupWord(kind, isHebrew)} ${Number(idx) + 1}`;
}

// the rooms offered when a work item is placed (the user can also type another room)
export const ROOM_CHOICES = Object.freeze([
  { key: 'all', he: 'כל המקום', en: 'The whole place' },
  { key: 'kitchen', he: 'מטבח', en: 'Kitchen' },
  { key: 'bathroom', he: 'שירותים', en: 'Bathroom' },
  { key: 'living', he: 'סלון', en: 'Living room' },
  { key: 'bedroom', he: 'חדר שינה', en: 'Bedroom' },
  { key: 'balcony', he: 'מרפסת', en: 'Balcony' },
]);

/** "the whole place" in the words of the group: "כל הדירה" / "The whole apartment" */
export function wholePlaceLabel(kind, isHebrew) {
  const k = normalizeGroupKind(kind);
  if (isHebrew) return { apartment: 'כל הדירה', room: 'כל החדר', floor: 'כל הקומה', section: 'כל המקום' }[k];
  return { apartment: 'The whole apartment', room: 'The whole room', floor: 'The whole floor', section: 'The whole place' }[k];
}

/** the text of a stored room tag: 'all' -> "כל הדירה"; a known key -> its word; free text as typed; empty -> '' (nothing shown) */
export function roomLabel(room, isHebrew, kind = 'section') {
  const r = typeof room === 'string' ? room.trim() : '';
  if (!r) return '';
  if (r === 'all') return wholePlaceLabel(kind, isHebrew);
  const known = ROOM_CHOICES.find((c) => c.key === r);
  return known ? (isHebrew ? known.he : known.en) : r;
}
