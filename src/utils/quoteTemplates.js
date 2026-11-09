// Task 27 (P2, spec §6) - whole-quote templates, the PURE part (no I/O). A template keeps only what the owner chose to reuse - the
// structure (sections), the lines (description / unit / quantity / optional price / specification), the texts (subject, project name,
// terms, warranty, notes) and the presentation references (style, owner media refs, detail level) - and NEVER a customer, contact,
// identity, number, status, signature, payment, public link, view count or any date. The same forbidden keys are refused by the database
// (quote_templates_content_sanitized); here they are removed recursively, so a nested value can never carry them either.
// Using a template opens a NEW, unsaved quote form (the normal Free-10 check applies before it opens); nothing is saved or sent.
import { normalizePresentationState, hasServerContent } from '../components/quotePresentation/presentationState';
import { normalizeSpecificationRows, withPersistableQuantity, normalizeRepeatCount } from './professionalQuoteItem';

export const TEMPLATE_SCHEMA = 'quote-template/v1';
export const TEMPLATE_NAME_MAX = 80;
export const TEMPLATE_MAX_ITEMS = 200;
export const FORBIDDEN_TEMPLATE_KEYS = Object.freeze([
  'client', 'clients', 'client_id', 'client_name', 'client_email', 'client_phone', 'client_tax_id', 'client_address', 'attn_name', 'attn_role',
  'quote_number', 'quote_id', 'id', 'status', 'signature', 'signed_at', 'paid_at', 'payment', 'public_token', 'public_link', 'view_count',
  'valid_until', 'created_at', 'service_date', 'user_id',
]);
const FORBIDDEN = new Set(FORBIDDEN_TEMPLATE_KEYS);
export const DEFAULT_TEMPLATE_KEEP = Object.freeze({ prices: true, texts: true, subject: false, presentation: true });
// R-03: the VAT basis of kept prices - only an Israeli (Local) quote has one (a private client is priced including VAT)
export const PRICE_BASES = Object.freeze(['incl_vat', 'excl_vat']);
export function templatePriceBasis(isLocalMarket, clientType) {
  if (!isLocalMarket) return null;
  return clientType === 'private' ? 'incl_vat' : clientType === 'business' ? 'excl_vat' : null;
}
export const clientTypeForPriceBasis = (basis) => (basis === 'incl_vat' ? 'private' : basis === 'excl_vat' ? 'business' : null);

const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
// Task 36 (missing price): '' / null mean "not entered" - Number('') is 0, which turned a missing price into an intentional free 0
const num = (v) => { if (v === '' || v == null || (typeof v === 'string' && v.trim() === '')) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

// Removes every forbidden key at any depth (arrays and objects); primitives pass through.
export function stripForbiddenKeys(value) {
  if (Array.isArray(value)) return value.map(stripForbiddenKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !FORBIDDEN.has(k)).map(([k, v]) => [k, stripForbiddenKeys(v)]));
  }
  return value;
}

export function normalizeTemplateName(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) return { ok: false, error: 'name_required' };
  if (n.length > TEMPLATE_NAME_MAX) return { ok: false, error: 'name_too_long' };
  return { ok: true, value: n };
}

// form = the quote editor state (Dashboard): items, sections, quoteStructureMode, quoteSubject, projectName, terms, warranty, notes,
// quotePresentation. keep = which optional parts to include.
export function buildTemplateContent(form, keep = DEFAULT_TEMPLATE_KEEP) {
  const k = { ...DEFAULT_TEMPLATE_KEEP, ...(keep || {}) };
  const sections = (Array.isArray(form?.sections) ? form.sections : []).filter((s) => str(s?.name).trim())
    // Owner console 2026-11-08 (stage 3 of the one quote builder): a unit of N identical copies keeps its count (only above 1); the internal price link is never part of a template
    .map((s, i) => ({ key: `s${i + 1}`, name: str(s.name, 200).trim(), from: s.key, ...(normalizeRepeatCount(s.repeat_count) > 1 ? { repeat_count: normalizeRepeatCount(s.repeat_count) } : {}) }));
  const keyOf = new Map(sections.map((s) => [s.from, s.key]));
  const items = (Array.isArray(form?.items) ? form.items : []).filter((it) => str(it?.description).trim()).slice(0, TEMPLATE_MAX_ITEMS).map((raw) => {
    // Owner 2026-10-23 (typed L-09 / L-17, morning report item 6): a fractional count (2.5) is kept exactly - stored the way a saved quote
    // stores it (quantity 1 + the real amount as a manual calculated quantity), never rounded to 3
    const it = withPersistableQuantity(raw);
    const line = { description: str(it.description, 1000).trim(), quantity: Math.max(1, Math.round(num(it.quantity) ?? 1)) };
    if (k.prices) { const p = num(it.unit_price); if (p !== null) line.unit_price = p; }
    if (it.pricing_unit) line.pricing_unit = str(it.pricing_unit, 40);
    // a measured line keeps its resulting quantity (the job's measurements themselves are not part of a template)
    const cq = it.calculated_quantity === '' || it.calculated_quantity == null ? null : num(it.calculated_quantity);
    if (it.pricing_unit && cq !== null) line.calculated_quantity = cq;
    const spec = normalizeSpecificationRows(it.specification);
    if (spec.length) line.specification = spec;
    const sk = it.section_key != null ? keyOf.get(it.section_key) : null;
    if (sk) line.section_key = sk;
    return line;
  });
  const content = {
    schema: TEMPLATE_SCHEMA,
    structure_mode: form?.quoteStructureMode === 'divided' ? 'divided' : null,
    sections: sections.map(({ key, name, repeat_count }) => ({ key, name, ...(repeat_count ? { repeat_count } : {}) })),
    items,
  };
  // Owner round 1 (Codex spec A5): kept prices remember their currency, so a quote in another currency never takes them over silently
  if (k.prices && items.some((it) => it.unit_price !== undefined) && /^[A-Z]{3}$/.test(String(form?.currency || '').toUpperCase())) content.currency = String(form.currency).toUpperCase();
  // Night task 2026-10-16 (R-03, Owner-approved L-09): kept prices also remember whether they include VAT (an Israeli private-client
  // quote is priced including VAT, a business-client quote before VAT), so a template is never applied about 18% off
  if (k.prices && items.some((it) => it.unit_price !== undefined) && PRICE_BASES.includes(form?.priceBasis)) content.price_basis = form.priceBasis;
  if (k.subject) {
    if (str(form?.quoteSubject).trim()) content.subject = str(form.quoteSubject, 300).trim();
    if (str(form?.projectName).trim()) content.project_name = str(form.projectName, 300).trim();
  }
  if (k.texts) {
    for (const [from, to] of [['terms', 'terms'], ['warranty', 'warranty'], ['notes', 'notes']]) if (str(form?.[from]).trim()) content[to] = str(form[from], 8000);
  }
  if (k.presentation) {
    const p = normalizePresentationState(form?.quotePresentation);
    if (hasServerContent(p)) content.presentation = { style: p.style, media: p.media, detail: p.detail };
  }
  return stripForbiddenKeys(content);
}

// A stored template -> safe content (unknown schema = unusable; forbidden keys removed again on the way in).
export function readTemplateContent(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== TEMPLATE_SCHEMA) return null;
  return stripForbiddenKeys(raw);
}

export function templateSummary(content) {
  const c = readTemplateContent(content);
  if (!c) return null;
  const items = Array.isArray(c.items) ? c.items : [];
  const priced = items.filter((it) => num(it.unit_price) !== null);
  // Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): a whole-quote or a unit template
  const kind = templateKind(c);
  const copiesOf = new Map((Array.isArray(c.sections) ? c.sections : []).map((s) => [s?.key, normalizeRepeatCount(s?.repeat_count)]));
  return {
    kind,
    itemCount: items.length,
    sectionCount: Array.isArray(c.sections) ? c.sections.length : 0,
    hasPrices: priced.length > 0,
    subtotal: priced.reduce((acc, it) => acc + (num(it.unit_price) || 0) * (num(it.calculated_quantity) ?? num(it.quantity) ?? 1) * (copiesOf.get(it.section_key) || 1), 0),
    hasTexts: Boolean(c.terms || c.warranty || c.notes),
    hasPresentation: Boolean(c.presentation),
    priceBasis: PRICE_BASES.includes(c.price_basis) ? c.price_basis : null,
  };
}

// A5: the template's prices are in another currency than the new quote -> the user decides; never a conversion (no exchange rate here).
export function templateCurrencyMismatch(formState, quoteCurrency) {
  if (!formState || !formState.currency || !quoteCurrency) return false;
  const priced = (formState.items || []).some((it) => it.unit_price !== '' && it.unit_price != null);
  return priced && formState.currency !== String(quoteCurrency).toUpperCase();
}
// R-20 (Owner-approved L-09): a template saved before 2026-10-15 kept prices without their currency - the user is asked, never assumed
export function templateCurrencyUnknown(formState) {
  if (!formState || formState.currency) return false;
  return (formState.items || []).some((it) => it.unit_price !== '' && it.unit_price != null);
}
export function withoutPrices(items) {
  return (items || []).map((it) => ({ ...it, unit_price: '' }));
}

// The NEW quote form state from a template. newKey() makes fresh section keys (never the template's own); items get no ids.
export function templateToFormState(content, newKey) {
  const c = readTemplateContent(content);
  if (!c || templateKind(c) === TEMPLATE_KIND_UNIT) return null; // Owner console 2026-11-08 (stage 4 of the one quote builder, decision 6): a unit template is added to an open quote, never opened as one
  const sectionKeys = new Map();
  const sections = (Array.isArray(c.sections) ? c.sections : []).filter((s) => str(s?.name).trim()).map((s, i) => {
    const key = newKey(); sectionKeys.set(s.key, key);
    return { key, id: null, name: str(s.name, 200), sort_order: i, repeat_count: normalizeRepeatCount(s.repeat_count) };
  });
  const items = (Array.isArray(c.items) ? c.items : []).filter((it) => str(it?.description).trim()).map((it) => {
    const row = { description: str(it.description, 1000), quantity: String(num(it.quantity) ?? 1), unit_price: num(it.unit_price) !== null ? String(num(it.unit_price)) : '' };
    if (it.pricing_unit) row.pricing_unit = str(it.pricing_unit, 40);
    if (it.pricing_unit && num(it.calculated_quantity) !== null) {
      row.calculated_quantity = num(it.calculated_quantity); row.quantity_source = 'manual'; row.calculation_method = 'manual';
    }
    const spec = normalizeSpecificationRows(it.specification);
    if (spec.length) row.specification = spec;
    if (it.section_key && sectionKeys.has(it.section_key)) row.section_key = sectionKeys.get(it.section_key);
    return row;
  });
  return {
    items: items.length ? items : null,
    currency: typeof c.currency === 'string' && /^[A-Z]{3}$/.test(c.currency) ? c.currency : null,
    priceBasis: PRICE_BASES.includes(c.price_basis) ? c.price_basis : null,
    sections,
    quoteStructureMode: c.structure_mode === 'divided' || sections.length ? 'divided' : null,
    quoteSubject: str(c.subject) || null,
    projectName: str(c.project_name) || null,
    terms: typeof c.terms === 'string' ? c.terms : null,
    warranty: typeof c.warranty === 'string' ? c.warranty : null,
    notes: typeof c.notes === 'string' ? c.notes : null,
    presentation: c.presentation ? normalizePresentationState(c.presentation) : null,
  };
}

// Owner console 2026-11-08 (stage 4 of the one quote builder, typed: "מאשר את שלב 3 ... ואת שלב 4 (תבנית יחידה) לפי ההחלטות, כולל ... שינוי
// ב-L-09, L-17, ..."; decision 6): a UNIT template - one unit with its rows, kept in the same table and schema ('quote-template/v1') with
// kind: 'unit' (a record without kind is a whole-quote template). It keeps the jobs, the billing type, the numeric sizes (with their order
// and the "counts in the price" flag - never a place name), the details only when chosen, the prices only when chosen (with their currency
// and VAT basis); never ids, a price link, a unit count, a customer, an address, a date or a subject. It is inserted as ONE copy (count 1).
export const TEMPLATE_KIND_UNIT = 'unit';
export const templateKind = (content) => (content && content.kind === TEMPLATE_KIND_UNIT ? TEMPLATE_KIND_UNIT : 'quote');
export const DEFAULT_UNIT_TEMPLATE_KEEP = Object.freeze({ prices: true, details: false });
const sizeOf = (m, i) => {
  const w = num(m?.width); const h = num(m?.height);
  if (w === null && h === null) return null;
  const out = { width: w, height: h, unit: ['m', 'cm', 'ft', 'in'].includes(m?.unit) ? m.unit : 'm', sort_order: i, is_pricing_driving: m?.is_pricing_driving !== false };
  const a = num(m?.calculated_area);
  if (a !== null) out.calculated_area = a;
  return out;
};
// form = the editor state ({ items, sections, currency, priceBasis }); sectionKey = the unit to keep; rowBilling(item) = the row's billing
// type on screen ('fixed' / 'units' / 'area' / 'linear'), so a fixed amount comes back as a fixed amount
export function buildUnitTemplateContent(form, sectionKey, keep = DEFAULT_UNIT_TEMPLATE_KEEP, rowBilling = null) {
  const k = { ...DEFAULT_UNIT_TEMPLATE_KEEP, ...(keep || {}) };
  const section = (Array.isArray(form?.sections) ? form.sections : []).find((s) => s && s.key === sectionKey);
  if (!section) return null;
  const items = (Array.isArray(form?.items) ? form.items : []).filter((it) => it && it.section_key === sectionKey && str(it.description).trim())
    .slice(0, TEMPLATE_MAX_ITEMS).map((raw) => {
      const it = withPersistableQuantity(raw);
      const line = { description: str(it.description, 1000).trim(), quantity: Math.max(1, Math.round(num(it.quantity) ?? 1)) };
      if (k.prices) { const p = num(it.unit_price); if (p !== null) line.unit_price = p; }
      if (it.pricing_unit) line.pricing_unit = str(it.pricing_unit, 40);
      const cq = it.calculated_quantity === '' || it.calculated_quantity == null ? null : num(it.calculated_quantity);
      if (it.pricing_unit && cq !== null) line.calculated_quantity = cq;
      if (it.quantity_source === 'calculated' || it.quantity_source === 'manual') line.quantity_source = it.quantity_source;
      if (typeof it.calculation_method === 'string' && it.calculation_method) line.calculation_method = str(it.calculation_method, 40);
      const sizes = (Array.isArray(it.measurements) ? it.measurements : []).map(sizeOf).filter(Boolean).map((m, i) => ({ ...m, sort_order: i }));
      if (sizes.length) line.measurements = sizes;
      const billing = typeof rowBilling === 'function' ? rowBilling(raw) : null;
      if (billing === 'fixed' || billing === 'units') line.billing = billing;
      if (k.details) { const spec = normalizeSpecificationRows(it.specification); if (spec.length) line.specification = spec; }
      line.section_key = 's1';
      return line;
    });
  const content = { schema: TEMPLATE_SCHEMA, kind: TEMPLATE_KIND_UNIT, structure_mode: 'divided', sections: [{ key: 's1', name: str(section.name, 200).trim() }], items };
  const priced = k.prices && items.some((it) => it.unit_price !== undefined);
  if (priced && /^[A-Z]{3}$/.test(String(form?.currency || '').toUpperCase())) content.currency = String(form.currency).toUpperCase();
  if (priced && PRICE_BASES.includes(form?.priceBasis)) content.price_basis = form.priceBasis;
  return stripForbiddenKeys(content);
}
// Which price questions adding a unit template needs (the whole-quote template rules, R-03 / R-20 / A5): currency 'mismatch' (prices are
// removed, after a confirm) or 'unknown' (use as is / without prices); for an Israeli quote basis 'unknown' or 'mismatch' (incl. vs before VAT
// against the chosen client type). A quote with no client type yet asks nothing about the basis (the template's basis then sets it).
export function unitTemplatePriceQuestions(u, { currency, isLocal, clientType } = {}) {
  const priced = (u?.items || []).some((it) => it.unit_price !== '' && it.unit_price != null);
  if (!priced) return { currency: null, basis: null };
  const cur = currency ? String(currency).toUpperCase() : null;
  const currencyQ = !u.currency ? 'unknown' : (cur && u.currency !== cur ? 'mismatch' : null);
  if (currencyQ === 'mismatch' || !isLocal) return { currency: currencyQ, basis: null };
  const quoteBasis = templatePriceBasis(true, clientType);
  const basis = !u.priceBasis ? (quoteBasis ? 'unknown' : null) : (quoteBasis && u.priceBasis !== quoteBasis ? 'mismatch' : null);
  return { currency: currencyQ, basis };
}
// A unit template -> ONE new unit (count 1, a fresh key from newKey()) and its rows (no ids, no price link), ready to add to the open quote
export function unitTemplateToRows(content, newKey) {
  const c = readTemplateContent(content);
  if (!c || templateKind(c) !== TEMPLATE_KIND_UNIT) return null;
  const src = (Array.isArray(c.sections) ? c.sections : [])[0];
  if (!src || !str(src.name).trim()) return null;
  const key = newKey();
  const items = (Array.isArray(c.items) ? c.items : []).filter((it) => str(it?.description).trim()).map((it) => {
    const row = { description: str(it.description, 1000), quantity: String(num(it.quantity) ?? 1), unit_price: num(it.unit_price) !== null ? String(num(it.unit_price)) : '', isFromCatalog: false, section_key: key };
    if (it.pricing_unit) row.pricing_unit = str(it.pricing_unit, 40);
    if (it.pricing_unit && num(it.calculated_quantity) !== null) row.calculated_quantity = num(it.calculated_quantity);
    if (it.quantity_source === 'calculated' || it.quantity_source === 'manual') row.quantity_source = it.quantity_source;
    if (typeof it.calculation_method === 'string' && it.calculation_method) row.calculation_method = it.calculation_method;
    const sizes = (Array.isArray(it.measurements) ? it.measurements : []).map(sizeOf).filter(Boolean)
      .map((m) => ({ width: m.width ?? '', height: m.height ?? '', unit: m.unit, calculated_area: m.calculated_area ?? null, label: '', is_pricing_driving: m.is_pricing_driving }));
    if (sizes.length) row.measurements = sizes;
    else if (it.pricing_unit && num(it.calculated_quantity) !== null && it.quantity_source !== 'calculated') { row.quantity_source = 'manual'; row.calculation_method = 'manual'; }
    if (it.billing === 'fixed' || it.billing === 'units') row._billing = it.billing;
    const spec = normalizeSpecificationRows(it.specification);
    if (spec.length) row.specification = spec;
    return row;
  });
  return {
    section: { key, id: null, name: str(src.name, 200), repeat_count: 1 },
    items,
    currency: typeof c.currency === 'string' && /^[A-Z]{3}$/.test(c.currency) ? c.currency : null,
    priceBasis: PRICE_BASES.includes(c.price_basis) ? c.price_basis : null,
  };
}
