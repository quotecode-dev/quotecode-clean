// Task 16 - builds the creator live-preview DTO in the SAME shape get-public-quote returns
// ({ quote, business, client, sections, items, attachments }), plus the `presentation` prop in the public_get shape.
//
// FINANCIAL LAW: nothing financial is computed here. Quote-level subtotal / tax_rate / total come from the values the
// Dashboard already computes for the save (previewFinancials -> subtotal / taxRate / totalAmount); an item's
// total_price uses the save's own expression (getActiveQuantity(item) * unit_price, Dashboard itemsPayload) and the
// untouched placeholder row is dropped exactly like the save does (excludeUntouchedPlaceholderItems).
import { getActiveQuantity, normalizeSpecificationRows } from '../../utils/professionalQuoteItem';
import { excludeUntouchedPlaceholderItems } from '../../utils/structuredQuoteItemPersistence';
import { QUOTE_STYLE_VERSIONS, normalizeStyleId, DEFAULT_QUOTE_STYLE } from '../../quoteDocument/quoteStyles';
import { normalizePresentationState } from './presentationState';

const str = (v) => (v === undefined || v === null ? '' : String(v));
const orNull = (v) => (v === undefined || v === null || v === '' ? null : v);

// HE/ILS market rule - identical to SmartPublicQuote.jsx (tax_rate > 0 || currency === 'ILS').
export function isLocalPreviewQuote(quote) {
  return Number(quote?.tax_rate) > 0 || String(quote?.currency || '').toUpperCase() === 'ILS';
}

function mapItem(item) {
  const measurements = Array.isArray(item.measurements) ? item.measurements : [];
  return {
    description: str(item.description),
    quantity: Number(item.quantity || 1),
    price: Number(item.unit_price || 0),
    total_price: getActiveQuantity(item) * Number(item.unit_price || 0),
    pricing_unit: item.pricing_unit || undefined,
    calculated_quantity: (item.calculated_quantity !== undefined && item.calculated_quantity !== '' && item.calculated_quantity !== null)
      ? Number(item.calculated_quantity) : undefined,
    quantity_source: item.quantity_source || undefined,
    calculation_method: item.calculation_method || undefined,
    specification: normalizeSpecificationRows(item.specification),
    section_id: item.section_key || null,
    measurements: measurements
      .filter((m) => !(m.width === '' && m.height === ''))
      .map((m) => ({
        width: m.width !== '' && m.width != null ? Number(m.width) : null,
        height: m.height !== '' && m.height != null ? Number(m.height) : null,
        unit: m.unit || 'm',
        calculated_area: m.calculated_area != null && m.calculated_area !== '' ? Number(m.calculated_area) : null,
        label: m.label || '',
        is_pricing_driving: m.is_pricing_driving !== false,
      })),
  };
}

/**
 * @param {object} args
 * @param {object} args.editor     editor state (Dashboard quote state)
 * @param {object} args.financials { subtotal, taxRate, total } - the Dashboard's own computed values
 * @param {object} args.business   { business_name, logo_url, tax_id, email, phone, address, currency }
 * @param {object} args.presentation { style (effective), presentation (draft state), mediaUrls: { [assetId]: url|null } }
 */
export function buildPreviewQuoteData({ editor = {}, financials = {}, business = null, presentation = {} } = {}) {
  const sections = (Array.isArray(editor.sections) ? editor.sections : [])
    .filter((s) => str(s?.name).trim() !== '')
    .map((s) => ({ id: s.key ?? s.id, name: s.name }));
  const items = excludeUntouchedPlaceholderItems(Array.isArray(editor.items) ? editor.items : []).map(mapItem);
  const status = str(editor.quoteStatus || 'draft').toLowerCase();

  const quote = {
    id: editor.quoteId || 'preview',
    quote_number: editor.quoteNumber ?? null,
    attn_name: orNull(str(editor.attnName).trim()) || orNull(editor.clientName),
    attn_role: orNull(editor.attnRole),
    created_at: editor.createdAt || new Date().toISOString(),
    valid_until: orNull(editor.validUntil),
    tax_rate: Number(financials.taxRate ?? 0),
    subtotal: Number(financials.subtotal ?? 0),
    total: Number(financials.total ?? 0),
    discount: Number(editor.discount || 0),
    terms: str(editor.terms),
    warranty: str(editor.warranty),
    notes: str(editor.notes),
    subject: str(editor.quoteSubject),
    status,
    signature: null,
    currency: editor.currency || business?.currency || null,
    client_type: editor.clientType || null,
    // the owner is looking at their own quote: no customer signature pad in the preview
    is_owner_viewing: true,
    project_name: orNull(str(editor.projectName).trim()),
  };

  const quoteData = {
    quote,
    business: business ? {
      business_name: business.business_name ?? null,
      logo_url: business.logo_url || null,
      tax_id: business.tax_id ?? null,
      email: business.email ?? null,
      phone: business.phone ?? null,
      address: business.address ?? null,
      currency: business.currency ?? null,
    } : null,
    client: (str(editor.clientName).trim() || editor.clientEmail || editor.clientPhone || editor.clientAddress) ? {
      company_name: str(editor.clientName),
      email: str(editor.clientEmail),
      phone: str(editor.clientPhone),
      address: str(editor.clientAddress),
    } : null,
    sections,
    items,
    // Attachment links need signed URLs (network); the preview never fetches them.
    attachments: [],
  };

  const draft = normalizePresentationState(presentation.presentation);
  const style = normalizeStyleId(presentation.style) || DEFAULT_QUOTE_STYLE;
  const urls = presentation.mediaUrls || {};
  const presentationProp = {
    mode: 'draft',
    style,
    styleVersion: QUOTE_STYLE_VERSIONS[style],
    branding: null,
    detail: draft.detail || 'compact',
    media: draft.media.map((m) => {
      const url = typeof urls[m.assetId] === 'string' && urls[m.assetId] ? urls[m.assetId] : null;
      return { url, caption: m.caption, alt: m.alt || m.caption, role: m.role, itemKey: m.itemKey, missing: !url && urls[m.assetId] === null };
    }),
  };

  return { quoteData, presentation: presentationProp, isLocal: isLocalPreviewQuote(quote) };
}
