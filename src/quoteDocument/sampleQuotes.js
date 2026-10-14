// Task 16 - Quote Experience V2: synthetic sample quotes for /he/sample-quote and /en/sample-quote (and any review
// surface that needs a realistic document). Content follows the approved refined package (revision-r2-refined):
// "ויסטארו" / "VISTARO", three items 2 x 1,200, 3.4 m2 x 450, 1 x 850.
//
// Every amount is COMPUTED from the rows by the same rules the app uses when it saves a quote - never hardcoded:
//   - line total  = getActiveQuantity(item) * unit_price      (Dashboard handleSaveQuote -> total_price), cents precision
//   - financials  = calculateQuoteFinancials({ country, clientType, items: withActiveQuantities(items), discount })
//                   (the single financial source handleSaveQuote uses for a new quote)
// The app stores the discount as a PERCENTAGE (quotes.discount, "הנחה (N%)"), so the refined prototype's fixed "500"
// discount cannot be represented as such; the samples use 10% (= 478.00 on the short subtotal of 4,780.00).
// Media follow the server model (quote-presentation keeps itemKey only for role 'item'): hero/support images are the
// showcase (Modern rail / Visual hero); 'item' images bind to a row by itemKey and render as row thumbnails.
// A professional (area-priced) row keeps the DB shape: integer quantity + decimal calculated_quantity + pricing_unit.
//
// The long variant repeats the three rows six times (18 rows) and recomputes every dependent amount from those rows
// (subtotal 28,680.00 before discount).
import { calculateQuoteFinancials } from '../utils/regionConfig';
import { getActiveQuantity, withActiveQuantities } from '../utils/professionalQuoteItem';
import { normalizeStyleId, DEFAULT_QUOTE_STYLE } from './quoteStyles';
import { normalizeItemKey } from './quoteMediaModel';

export const SAMPLE_MEDIA_BASE = '/task16-samples/';
export const SAMPLE_DISCOUNT_PERCENT = 10;
export const SAMPLE_LONG_REPEAT = 6;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// The persisted line total exactly as the save path writes it (getActiveQuantity(item) * unit_price), in cents.
export function computeLineTotal(item) {
  return round2(getActiveQuantity(item) * Number(item.unit_price || 0));
}

// The quote-level financial fields exactly as handleSaveQuote derives them for a new quote.
export function computeSampleFinancials(items, { country, clientType, discount }) {
  const result = calculateQuoteFinancials({ country, clientType, items: withActiveQuantities(items), discount });
  return {
    subtotal: result.enteredSubtotal,
    discountAmount: result.discountAmount,
    netAmount: result.netAmount,
    taxRate: result.taxRate,
    taxAmount: result.taxAmount,
    total: result.total,
  };
}

const CONTENT = {
  he: {
    country: 'Local',
    currency: 'ILS',
    business: { business_name: 'ויסטארו', email: 'office@vistaro.example', address: 'דרך התעשייה 12|חיפה', phone: '050-1234567', tax_id: null, logo_url: `${SAMPLE_MEDIA_BASE}vistaro-symbol.png`, show_name_with_logo: true },
    client: { company_name: 'מרחבי צפון בע״מ', email: 'noa@example.com', phone: null, address: 'דרך הנמל 18|חיפה' },
    attn: 'נועה לוי',
    subject: 'עבודות אלומיניום למשרד',
    project: 'ייצור והתקנת חלונות, מחיצת זכוכית ודלת אלומיניום',
    notes: 'המחיר כולל הובלה והתקנה באזור חיפה. גוון הפרופיל והזכוכית יאושרו לפני הייצור.',
    terms: '50% בתחילת עבודה, יתרה במסירה. זמן אספקה משוער: 21 ימי עבודה.',
    rows: [
      { description: 'חלון אלומיניום בלגי', detail: 'ייצור לפי מידה, פרופיל שחור וזכוכית בידודית', quantity: 2, unit_price: 1200 },
      { description: 'מחיצת זכוכית ואלומיניום', detail: 'פרופיל דק, זכוכית בטיחות והכנה לעיגון', quantity: 1, calculated_quantity: 3.4, pricing_unit: 'm2', unit_price: 450 },
      { description: 'התקנה וכיוון סופי', detail: 'הובלה, התקנה באתר, איטום ובדיקת מסירה', quantity: 1, unit_price: 850 },
    ],
    media: [
      { file: 'aluminum-window.jpg', caption: 'חלון אלומיניום בלגי · פרופיל שחור', alt: 'חלון בעל מסגרות אלומיניום שחורות', role: 'hero', row: null },
      { file: 'aluminum-installation.jpg', caption: 'התקנת מסגרת חלון באתר', alt: 'איש מקצוע מתקין מסגרת חלון', role: 'support', row: null },
      { file: 'aluminum-door.jpg', caption: 'דלת אלומיניום וזכוכית', alt: 'דלת זכוכית במסגרת אלומיניום', role: 'support', row: null },
      { file: 'aluminum-window.jpg', caption: '', alt: 'חלון אלומיניום בלגי', role: 'item', row: 0 },
      { file: 'aluminum-installation.jpg', caption: '', alt: 'מחיצת זכוכית ואלומיניום', role: 'item', row: 1 },
      { file: 'aluminum-door.jpg', caption: '', alt: 'התקנה וכיוון סופי', role: 'item', row: 2 },
    ],
  },
  en: {
    country: 'International',
    currency: 'USD',
    business: { business_name: 'VISTARO', email: 'office@vistaro.example', address: '4 Industry Way|Portland', phone: '+1 503 555 0148', tax_id: null, logo_url: `${SAMPLE_MEDIA_BASE}vistaro-symbol.png`, show_name_with_logo: true },
    client: { company_name: 'Northline Workspaces Ltd.', email: 'nora@example.com', phone: null, address: '18 Harbor Way|Portland' },
    attn: 'Nora Lane',
    subject: 'Office aluminum works',
    project: 'Fabrication and installation of windows, a glass partition and an aluminum door',
    notes: 'Price includes delivery and installation in Portland. Profile finish and glazing will be approved before fabrication.',
    terms: '50% at start, balance on handover. Estimated lead time: 21 business days.',
    rows: [
      { description: 'Steel-look aluminum window', detail: 'Made to measure, black profile and insulated glazing', quantity: 2, unit_price: 1200 },
      { description: 'Glass & aluminum partition', detail: 'Slim profile, safety glass and prepared anchoring', quantity: 1, calculated_quantity: 3.4, pricing_unit: 'm2', unit_price: 450 },
      { description: 'Installation & final alignment', detail: 'Delivery, on-site installation, sealing and handover check', quantity: 1, unit_price: 850 },
    ],
    media: [
      { file: 'aluminum-window.jpg', caption: 'Steel-look window · black aluminum', alt: 'Black framed aluminum window', role: 'hero', row: null },
      { file: 'aluminum-installation.jpg', caption: 'On-site window frame installation', alt: 'Professional installing a window frame', role: 'support', row: null },
      { file: 'aluminum-door.jpg', caption: 'Aluminum and glass door', alt: 'Glass door in an aluminum frame', role: 'support', row: null },
      { file: 'aluminum-window.jpg', caption: '', alt: 'Steel-look aluminum window', role: 'item', row: 0 },
      { file: 'aluminum-installation.jpg', caption: '', alt: 'Glass and aluminum partition', role: 'item', row: 1 },
      { file: 'aluminum-door.jpg', caption: '', alt: 'Installation and final alignment', role: 'item', row: 2 },
    ],
  },
};

// One DB-shaped quote item (get-public-quote shape: price = unit_price) with its persisted line total.
function buildRow(row, description) {
  const item = {
    description,
    quantity: row.quantity,
    unit_price: row.unit_price,
    price: row.unit_price,
    pricing_unit: row.pricing_unit || null,
    calculated_quantity: row.calculated_quantity ?? null,
    quantity_source: row.pricing_unit ? 'manual' : null,
    calculation_method: row.pricing_unit ? 'manual' : null,
    specification: row.detail ? [{ label: '', value: row.detail }] : [],
    measurements: [],
    section_id: null,
  };
  item.total_price = computeLineTotal(item);
  return item;
}

export function buildSampleItems(locale = 'he', length = 'short') {
  const c = CONTENT[locale === 'en' ? 'en' : 'he'];
  const repeat = length === 'long' ? SAMPLE_LONG_REPEAT : 1;
  const items = [];
  for (let r = 0; r < repeat; r += 1) {
    c.rows.forEach((row) => {
      const index = items.length;
      items.push(buildRow(row, index > 2 ? `${row.description} · ${index + 1}` : row.description));
    });
  }
  return items;
}

export function buildSampleMedia(locale = 'he') {
  const c = CONTENT[locale === 'en' ? 'en' : 'he'];
  return c.media.map((m) => ({
    url: `${SAMPLE_MEDIA_BASE}${m.file}`,
    caption: m.caption,
    alt: m.alt,
    role: m.role,
    itemKey: m.row == null ? null : normalizeItemKey(c.rows[m.row].description),
    missing: false,
  }));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (d) => d.toISOString().slice(0, 10);

// -> { quoteData (get-public-quote DTO shape), presentation (public_get shape), style, length, detail, images }
export function buildSampleQuote({ locale = 'he', style = DEFAULT_QUOTE_STYLE, length = 'short', detail = 'compact', images = true, now = new Date() } = {}) {
  const lang = locale === 'en' ? 'en' : 'he';
  const c = CONTENT[lang];
  const effectiveStyle = normalizeStyleId(style) || DEFAULT_QUOTE_STYLE;
  const effectiveLength = length === 'long' ? 'long' : 'short';
  const items = buildSampleItems(lang, effectiveLength);
  const clientType = 'business';
  const fin = computeSampleFinancials(items, { country: c.country, clientType, discount: SAMPLE_DISCOUNT_PERCENT });
  const quote = {
    id: `00000000-0000-4000-8000-0000000016${lang === 'he' ? '01' : '02'}`,
    quote_number: 1048,
    status: 'sent',
    signature: null,
    currency: c.currency,
    tax_rate: fin.taxRate,
    client_type: clientType,
    is_owner_viewing: false,
    subtotal: fin.subtotal,
    discount: SAMPLE_DISCOUNT_PERCENT,
    total: fin.total,
    created_at: isoDate(now),
    valid_until: isoDate(new Date(now.getTime() + 27 * DAY_MS)),
    subject: c.subject,
    project_name: c.project,
    attn_name: c.attn,
    attn_role: null,
    terms: c.terms,
    notes: c.notes,
    warranty: null,
  };
  const quoteData = { quote, business: { ...c.business }, client: { ...c.client }, items, attachments: [], sections: [] };
  const presentation = {
    mode: 'draft',
    style: effectiveStyle,
    styleVersion: 1,
    branding: null,
    media: images ? buildSampleMedia(lang) : [],
  };
  return { quoteData, presentation, style: effectiveStyle, length: effectiveLength, detail: detail === 'expanded' ? 'expanded' : 'compact', images: !!images };
}

// ?style=classic|modern|visual&length=short|long&detail=compact|expanded&images=0|1 (unknown values fall back).
export function parseSampleQuery(search) {
  const q = new URLSearchParams(typeof search === 'string' ? search : '');
  return {
    style: normalizeStyleId(q.get('style')) || DEFAULT_QUOTE_STYLE,
    length: q.get('length') === 'long' ? 'long' : 'short',
    detail: q.get('detail') === 'expanded' ? 'expanded' : 'compact',
    images: q.get('images') !== '0',
  };
}
