// Task 27 (P2, spec §6) - whole-quote templates, the PURE part (no I/O). A template keeps only what the owner chose to reuse - the
// structure (sections), the lines (description / unit / quantity / optional price / specification), the texts (subject, project name,
// terms, warranty, notes) and the presentation references (style, owner media refs, detail level) - and NEVER a customer, contact,
// identity, number, status, signature, payment, public link, view count or any date. The same forbidden keys are refused by the database
// (quote_templates_content_sanitized); here they are removed recursively, so a nested value can never carry them either.
// Using a template opens a NEW, unsaved quote form (the normal Free-10 check applies before it opens); nothing is saved or sent.
import { normalizePresentationState, hasServerContent } from '../components/quotePresentation/presentationState';
import { normalizeSpecificationRows } from './professionalQuoteItem';

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
    .map((s, i) => ({ key: `s${i + 1}`, name: str(s.name, 200).trim(), from: s.key }));
  const keyOf = new Map(sections.map((s) => [s.from, s.key]));
  const items = (Array.isArray(form?.items) ? form.items : []).filter((it) => str(it?.description).trim()).slice(0, TEMPLATE_MAX_ITEMS).map((it) => {
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
    sections: sections.map(({ key, name }) => ({ key, name })),
    items,
  };
  // Owner round 1 (Codex spec A5): kept prices remember their currency, so a quote in another currency never takes them over silently
  if (k.prices && items.some((it) => it.unit_price !== undefined) && /^[A-Z]{3}$/.test(String(form?.currency || '').toUpperCase())) content.currency = String(form.currency).toUpperCase();
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
  return {
    itemCount: items.length,
    sectionCount: Array.isArray(c.sections) ? c.sections.length : 0,
    hasPrices: priced.length > 0,
    subtotal: priced.reduce((acc, it) => acc + (num(it.unit_price) || 0) * (num(it.calculated_quantity) ?? num(it.quantity) ?? 1), 0),
    hasTexts: Boolean(c.terms || c.warranty || c.notes),
    hasPresentation: Boolean(c.presentation),
  };
}

// A5: the template's prices are in another currency than the new quote -> the user decides; never a conversion (no exchange rate here).
export function templateCurrencyMismatch(formState, quoteCurrency) {
  if (!formState || !formState.currency || !quoteCurrency) return false;
  const priced = (formState.items || []).some((it) => it.unit_price !== '' && it.unit_price != null);
  return priced && formState.currency !== String(quoteCurrency).toUpperCase();
}
export function withoutPrices(items) {
  return (items || []).map((it) => ({ ...it, unit_price: '' }));
}

// The NEW quote form state from a template. newKey() makes fresh section keys (never the template's own); items get no ids.
export function templateToFormState(content, newKey) {
  const c = readTemplateContent(content);
  if (!c) return null;
  const sectionKeys = new Map();
  const sections = (Array.isArray(c.sections) ? c.sections : []).filter((s) => str(s?.name).trim()).map((s, i) => {
    const key = newKey(); sectionKeys.set(s.key, key);
    return { key, id: null, name: str(s.name, 200), sort_order: i };
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
