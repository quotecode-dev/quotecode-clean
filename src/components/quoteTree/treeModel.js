// 2026-11-13 (Owner: the manual quote of the 13/11 spec / demo; typed L-05 ... L-29): the heading TREE of the editor - pure helpers on the
// editor's own state (sections: { key, id?, name, kind?, parent_key?, sort_order, repeat_count }, items: { section_key, ... }). Nothing
// here talks to the server; the save sends parent_client_key (Dashboard) and the server checks the tree again.
import { getActiveQuantity, normalizeRepeatCount } from '../../utils/professionalQuoteItem';
import { groupWord } from '../../utils/quoteGroups';
import { newUuid } from '../../utils/quoteSaveOrchestrator';

export const MAX_DEPTH = 4;
/** the editor's word for a heading kind - "נושא" / "Topic" for a heading the user chose as "another topic" (spec 5: "+ הוספת נושא");
 *  a heading with no kind (older quotes) keeps the system word of 11/11 */
export function kindWord(kind, isHebrew, { plural = false } = {}) {
  if (kind === 'section') return isHebrew ? (plural ? 'נושאים' : 'נושא') : (plural ? 'Topics' : 'Topic');
  return groupWord(kind, isHebrew, { plural });
}
/** a name not yet taken among the given names (case-insensitive): base, then "base 2", "base 3", ... */
export function freeName(base, taken) {
  const has = (n) => taken.has(String(n).trim().toLowerCase());
  if (!has(base)) return base;
  for (let i = 2; i < 10000; i += 1) if (!has(`${base} ${i}`)) return `${base} ${i}`;
  return base;
}
const byOrder = (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
const keyOf = (s) => s && (s.key ?? s.id);

/** the parent key of a heading, only when it is a heading of this quote and no loop leads back (else the top) */
export function parentOf(sections, key) {
  const list = Array.isArray(sections) ? sections : [];
  const by = new Map(list.map((s) => [keyOf(s), s]));
  const p = by.get(key)?.parent_key ?? null;
  if (!p || p === key || !by.has(p)) return null;
  const seen = new Set([key]);
  for (let k = p; k; k = by.get(k)?.parent_key ?? null) { if (seen.has(k)) return null; seen.add(k); if (!by.has(k)) break; }
  return p;
}
export const childrenOf = (sections, parentKey) => (Array.isArray(sections) ? sections : []).filter((s) => parentOf(sections, keyOf(s)) === (parentKey ?? null)).sort(byOrder);
export const topHeadings = (sections) => childrenOf(sections, null);
/** the headings from the top down to `key` (inclusive) */
export function pathOf(sections, key) {
  const by = new Map((Array.isArray(sections) ? sections : []).map((s) => [keyOf(s), s]));
  const out = []; const seen = new Set();
  for (let k = key; k && by.has(k) && !seen.has(k) && out.length < MAX_DEPTH + 1; k = parentOf(sections, k)) { seen.add(k); out.unshift(by.get(k)); }
  return out;
}
export const depthOf = (sections, key) => Math.max(0, pathOf(sections, key).length - 1);
export function subtreeKeys(sections, key) {
  const out = [key];
  for (const c of childrenOf(sections, key)) out.push(...subtreeKeys(sections, keyOf(c)));
  return out;
}
/** the item indices of a heading (null = the whole quote: rows of no heading or of a heading that is gone) */
export function itemIndicesOf(items, sections, key) {
  const keys = new Set((Array.isArray(sections) ? sections : []).map(keyOf));
  return (Array.isArray(items) ? items : []).map((it, i) => ({ it, i }))
    .filter(({ it }) => (key == null ? !it?.section_key || !keys.has(it.section_key) : it?.section_key === key)).map(({ i }) => i);
}
/** a row's total as the editor shows it (price x the active quantity; a fixed amount = its price); an empty price counts as nothing */
export function lineTotal(item) {
  if (!item) return 0;
  const price = Number(String(item.unit_price ?? '').replace(/,/g, ''));
  if (item.unit_price === '' || item.unit_price == null || !Number.isFinite(price)) return 0;
  const qty = item.pricing_unit ? getActiveQuantity({ quantity: item.quantity, calculated_quantity: item.calculated_quantity }) : Number(item.quantity || 1);
  return (Number.isFinite(qty) ? qty : 0) * price;
}
/** a heading's total: its own rows (x its copies of an older quote) + every sub-heading */
export function headingTotal(items, sections, key) {
  const sec = (sections || []).find((s) => keyOf(s) === key);
  const own = itemIndicesOf(items, sections, key).reduce((n, i) => n + lineTotal(items[i]), 0) * normalizeRepeatCount(sec?.repeat_count);
  return own + childrenOf(sections, key).reduce((n, c) => n + headingTotal(items, sections, keyOf(c)), 0);
}
/** sort_order renumbered in pre-order (a parent before its children) - every reader that does not know the tree still lists them readably */
export function renumber(sections) {
  const out = []; const walk = (p) => childrenOf(sections, p).forEach((s) => { out.push(s); walk(keyOf(s)); });
  walk(null);
  const seen = new Set(out.map(keyOf));
  (sections || []).forEach((s) => { if (!seen.has(keyOf(s))) out.push(s); });
  return out.map((s, i) => ({ ...s, sort_order: i }));
}
let seq = 0;
export const newKey = () => { seq += 1; return `tmp_section_${Date.now()}_${seq}_${Math.random().toString(36).slice(2, 6)}`; };
/** new headings of one kind under a parent (null = the top), after the existing siblings; names given or "<kind> N" */
export function addHeadings(sections, { kind, names, parentKey = null }, isHebrew) {
  const sibs = childrenOf(sections, parentKey);
  // every name differs from its siblings: an empty name takes the next free "<kind> N" (never one already used, typed or existing)
  const taken = new Set([...sibs.map((s) => String(s.name || '').trim().toLowerCase()), ...names.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)]);
  // the number of an empty slot is the one its placeholder showed ("<kind> N" by its place), moved on only when that name is taken
  const base = sibs.filter((s) => s.kind === kind).length;
  const autoName = (i) => { let k = base + i + 1; let n = `${kindWord(kind, isHebrew)} ${k}`; while (taken.has(n.toLowerCase())) { k += 1; n = `${kindWord(kind, isHebrew)} ${k}`; } taken.add(n.toLowerCase()); return n; };
  const fresh = names.map((n, i) => ({ key: newKey(), id: null, kind, parent_key: parentKey, repeat_count: 1,
    name: String(n || '').trim() || autoName(i),
    sort_order: (sibs.length ? Math.max(...sibs.map((s) => Number(s.sort_order) || 0)) : -1) + 0.001 * (i + 1) }));
  return { sections: renumber([...(sections || []), ...fresh]), added: fresh.map(keyOf) };
}
/** a heading removed: its sub-headings and its rows move up to its parent (never lost) */
export function removeHeading(sections, items, key) {
  const up = parentOf(sections, key);
  const nextSections = renumber((sections || []).filter((s) => keyOf(s) !== key).map((s) => (s.parent_key === key ? { ...s, parent_key: up } : s)));
  const nextItems = (items || []).map((it) => (it && it.section_key === key ? { ...it, section_key: up } : it));
  return { sections: nextSections, items: nextItems };
}
/** 2026-11-13 (the 13/11 demo "מחיקת <kind> עם התוכן"): a heading removed WITH everything under it (sub-headings and rows); the editor offers undo */
export function removeHeadingWithContent(sections, items, key) {
  const gone = new Set(subtreeKeys(sections, key));
  return {
    sections: renumber((sections || []).filter((s) => !gone.has(keyOf(s)))),
    items: (items || []).filter((it) => !(it && gone.has(it.section_key))),
  };
}
/** the first heading among the siblings of `key` (the same parent) - the source of "copy the works from the first one" */
export function firstSiblingOf(sections, key) {
  const sibs = childrenOf(sections, parentOf(sections, key));
  return sibs.length && keyOf(sibs[0]) !== key ? sibs[0] : null;
}
/** the rows of the first sibling heading are ADDED to this heading (the approved demo of 13/11: "העבודות נוספו. התוכן שהיה כאן נשמר." -
 *  nothing existing is overwritten or removed); the copies get no id and no price link */
export function copyRowsFromFirst(sections, items, key, isReal = (it) => Boolean(it)) {
  const first = firstSiblingOf(sections, key);
  const list = items || [];
  if (!first) return list;
  const copies = list.filter((it) => it && it.section_key === keyOf(first) && isReal(it)).map((it) => {
    const c = { ...it, section_key: key }; delete c.id; delete c.price_link_id;
    if (Array.isArray(it.measurements)) c.measurements = it.measurements.map((m) => { const x = { ...m }; delete x.id; return x; });
    return c;
  });
  return [...list, ...copies];
}
/** a heading duplicated with everything under it - new keys, its rows copied (no ids) right after it. As before 13/11 (Owner stage 3,
 *  2026-11-08): every source row and its copy share one price-link id (a row already linked keeps its group), so a later price change
 *  offers "only here" or all the linked rows. */
export function duplicateHeading(sections, items, key, isHebrew) {
  const keys = subtreeKeys(sections, key);
  const map = new Map(keys.map((k) => [k, newKey()]));
  const src = (sections || []).filter((s) => keys.includes(keyOf(s)));
  const siblingNames = new Set(childrenOf(sections, parentOf(sections, key)).map((x) => String(x.name || '').trim().toLowerCase()));
  // an older heading of N identical copies keeps its count in the copy (the copy stands for the same work)
  const copies = src.map((s) => ({ ...s, id: null, key: map.get(keyOf(s)), repeat_count: normalizeRepeatCount(s.repeat_count),
    parent_key: keyOf(s) === key ? parentOf(sections, key) : map.get(s.parent_key),
    // Owner 2026-11-08 (restore item 11): a copy of an unnamed heading keeps an empty name; a named one is "<name> - עותק" (then "- עותק 2" ...)
    name: keyOf(s) === key ? (s.name ? freeName(`${s.name} - ${isHebrew ? 'עותק' : 'copy'}`, siblingNames) : '') : s.name, sort_order: (Number(s.sort_order) || 0) + 0.5 }));
  const linkOf = new Map();
  const linkedItems = (items || []).map((it) => {
    if (!it || !keys.includes(it.section_key)) return it;
    const link = it.price_link_id || newUuid();
    linkOf.set(it, link);
    return it.price_link_id ? it : { ...it, price_link_id: link };
  });
  const rows = (items || []).filter((it) => it && keys.includes(it.section_key)).map((it) => {
    const c = { ...it, section_key: map.get(it.section_key), price_link_id: linkOf.get(it) }; delete c.id;
    if (Array.isArray(it.measurements)) c.measurements = it.measurements.map((m) => { const x = { ...m }; delete x.id; return x; });
    return c;
  });
  return { sections: renumber([...(sections || []), ...copies]), items: [...linkedItems, ...rows], copyKey: map.get(key) };
}
/** a heading moved one place up / down among its siblings */
export function moveHeading(sections, key, dir) {
  const p = parentOf(sections, key); const sibs = childrenOf(sections, p);
  const at = sibs.findIndex((s) => keyOf(s) === key); const to = at + dir;
  if (at < 0 || to < 0 || to >= sibs.length) return sections;
  const a = sibs[at]; const b = sibs[to];
  return renumber((sections || []).map((s) => (keyOf(s) === keyOf(a) ? { ...s, sort_order: Number(b.sort_order) || 0 } : keyOf(s) === keyOf(b) ? { ...s, sort_order: Number(a.sort_order) || 0 } : s)));
}
/** the structure a quote opens in: parents -> "floors, apartments and rooms"; headings -> "by apartments"; none -> simple */
export const structureOf = (sections) => ((sections || []).some((s) => s.parent_key) ? 'tiered' : (sections || []).length ? 'grouped' : 'simple');
/** names must differ among siblings (the same name under different parents is fine) */
export function duplicateNames(sections, parentKey, names) {
  const taken = new Set(childrenOf(sections, parentKey).map((s) => String(s.name || '').trim().toLowerCase()));
  const seen = new Set(); const dup = [];
  names.map((n) => String(n || '').trim().toLowerCase()).forEach((n, i) => { if (!n) return; if (taken.has(n) || seen.has(n)) dup.push(i); seen.add(n); });
  return dup;
}
/** product names sorted for the search list: by language, numbers in their natural order */
export const sortServices = (services, isHebrew) => (services || []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), isHebrew ? 'he' : 'en', { numeric: true, sensitivity: 'base' }));
