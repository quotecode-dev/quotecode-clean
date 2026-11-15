// 2026-11-13 (Owner: the customer sees the TREE of headings - floor > apartment > room - in today's look, a total for every heading,
// the full / partial choice of today; typed L-24 / L-27 / L-28 / L-29): the customer page's display sections, shared by PublicQuote
// (HE) and PublicQuoteEn (EN). A quote without parents gives EXACTLY the list it gave before (same keys, order, totals, filtering);
// every node only gains depth 0, no children and its own item count.
import { buildCustomerPresentationModel } from './quotePresentationModel';

/**
 * @returns {Array<{ key, title, items, subtotal, repeatCount, unitTotal, depth, children, treeItemCount, parentKey }>} pre-order (a parent
 *   before its children); unitTotal of a heading with sub-headings = its own lines + every sub-heading's total; a heading with no line in its
 *   whole sub-tree is not shown (as before: an empty unit was never shown); the unassigned bucket last, at the top level
 */
export function buildDisplayTree(items, sections, unassignedTitle) {
  const model = buildCustomerPresentationModel(items, sections);
  if (!model.isDivided) return [];
  const parentOf = new Map((Array.isArray(sections) ? sections : []).map((s) => [s.id ?? s.key, s.parent_id ?? s.parent_key ?? null]));
  const units = model.units.map((u) => ({ key: u.key ?? u.id, title: u.title, items: u.items, subtotal: u.subtotal, repeatCount: u.repeatCount || 1,
    ownTotal: u.unitTotal ?? u.subtotal }));
  const byKey = new Map(units.map((u) => [u.key, u]));
  // a parent counts only when it is a shown unit of this quote and no loop leads back (else the heading is at the top)
  const validParent = (key) => {
    const p = parentOf.get(key);
    if (!p || p === key || !byKey.has(p)) return null;
    const seen = new Set([key]);
    for (let k = p; k; k = parentOf.get(k) ?? null) { if (seen.has(k)) return null; seen.add(k); if (!byKey.has(k)) break; }
    return p;
  };
  const kids = new Map();
  for (const u of units) { const p = validParent(u.key); u.parentKey = p; if (p) kids.set(p, [...(kids.get(p) || []), u]); }
  const build = (u, depth) => {
    const children = depth >= 4 ? [] : (kids.get(u.key) || []).map((c) => build(c, depth + 1)).filter(Boolean);
    const treeItemCount = u.items.length + children.reduce((n, c) => n + c.treeItemCount, 0);
    if (treeItemCount === 0) return null;
    return { key: u.key, title: u.title, items: u.items, subtotal: u.subtotal, repeatCount: u.repeatCount,
      unitTotal: children.length ? u.ownTotal + children.reduce((n, c) => n + c.unitTotal, 0) : u.ownTotal,
      depth, children, treeItemCount, parentKey: u.parentKey };
  };
  const list = [];
  const flatten = (n) => { list.push(n); n.children.forEach(flatten); };
  units.filter((u) => !u.parentKey).map((u) => build(u, 0)).filter(Boolean).forEach(flatten);
  if (model.unassignedItems.length > 0) {
    const subtotal = model.unassignedItems.reduce((sum, it) => sum + Number(it.total_price ?? (Number(it.quantity || 1) * Number(it.price || 0))), 0);
    list.push({ key: '__unassigned__', title: unassignedTitle, items: model.unassignedItems, subtotal, repeatCount: 1, unitTotal: subtotal,
      depth: 0, children: [], treeItemCount: model.unassignedItems.length, parentKey: null });
  }
  return list;
}

/** the open / closed map of the full and the partial view: full = every heading open; partial = a heading that holds sub-headings stays
 *  open, every heading without sub-headings folds to its summary row (a quote without parents: every heading folds - exactly as before) */
export function sectionOpenMap(list, open) {
  const map = {};
  (list || []).forEach((s) => { map[s.key] = open ? true : (s.children || []).length > 0; });
  return map;
}
